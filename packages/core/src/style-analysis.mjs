import fs from "node:fs"
import path from "node:path"

import postcss from "postcss"
import selectorParser from "postcss-selector-parser"

import {
  buildNagiSets,
  defineNagiConfig,
  matchSelectorChain,
  matchesClassPrefix,
  parseTokenDeclarations,
  rawColorLiterals,
  rawLengthLiterals,
  tokenFamilyFor,
  tokenReferences,
} from "./index.mjs"

// Token sources are read as data, never linted. Cached per resolved path so a run
// over hundreds of files reads each source once.
const tokenSourceCache = new Map()

function loadTokenLayers(sources = []) {
  const layers = new Map()
  for (const { file, layer } of sources) {
    const resolved = path.resolve(file)
    if (!tokenSourceCache.has(resolved)) {
      try {
        tokenSourceCache.set(resolved, parseTokenDeclarations(fs.readFileSync(resolved, "utf8")))
      } catch {
        tokenSourceCache.set(resolved, null)
      }
    }
    const names = tokenSourceCache.get(resolved)
    if (!names) continue
    for (const name of names) {
      // A name declared in more than one layer is treated as the narrower one:
      // being reachable through the semantic layer is what matters.
      if (layer === "semantic" || !layers.has(name)) layers.set(name, layer)
    }
  }
  return layers
}

export const STYLE_RULE_IDS = [
  "anatomy-allowed",
  "bare-element-selector",
  "boundary-nesting",
  "boundary-slot-surface-required",
  "cascade-layer-in-surface",
  "container-name-derived",
  "container-query-scope",
  "dead-keyframes",
  "dead-rule",
  "length-token-required",
  "owned-dom-direct-child",
  "owned-dom-readable-nesting",
  "owned-surface-reach-in",
  "apply-directive-not-enabled",
  "apply-arbitrary-syntax",
  "selector-mirrors-template",
  "single-base-identity",
  "slot-surface-top-level",
  "stacking-token-required",
  "top-layer-z-index",
  "state-not-class",
  "surface-external-layout",
  "token-layer",
  "top-level-surface-only",
  "unknown-token",
  "value-token-required",
  "variant-shadows-vocabulary",
]

export const STYLE_RULE_DESCRIPTIONS = {
  "anatomy-allowed":
    "Allow only contract anatomy, role, element, component, and STN names in selectors",
  "bare-element-selector": "Require class selectors for styled elements inside owned DOM",
  "boundary-nesting": "Keep slot surfaces nested below their UI-library boundary",
  "boundary-slot-surface-required":
    "Resume owned selectors below a UI-library boundary only at a declared slot surface",
  "cascade-layer-in-surface": "Keep cascade layers out of a surface, where specificity is flat by construction",
  "container-name-derived": "Derive a container name from the surface and the element declaring it",
  "container-query-scope": "Query only containers the component itself declares",
  "dead-keyframes": "Reject keyframes no animation in the component references",
  "dead-rule": "Reject selectors whose classes are absent from the component template",
  "length-token-required": "Require tokens for lengths owned by a design-system scale",
  "owned-dom-direct-child": "Mirror owned parent-child DOM edges with direct-child selectors",
  "owned-dom-readable-nesting": "Express each owned parent-child depth as a nested CSS rule",
  "owned-surface-reach-in": "Keep selectors out of an owned child component's internal DOM",
  "apply-directive-not-enabled":
    "Keep declarations as plain CSS unless the project explicitly enables Tailwind @apply authoring",
  "apply-arbitrary-syntax":
    "Keep arbitrary Tailwind values and properties as visible plain CSS declarations",
  "selector-mirrors-template": "Require selector chains to match the component template",
  "single-base-identity": "Allow exactly one base identity class per selector compound",
  "slot-surface-top-level": "Keep attached slot surfaces below their UI-library boundary",
  "stacking-token-required": "Require a token for the stacking level of a surface that owns its own",
  "top-layer-z-index": "Reject z-index as a way to order top-layer surfaces",
  "state-not-class": "Represent runtime state with native, ARIA, or data attributes",
  "surface-external-layout": "Keep a surface's external layout in its parent",
  "token-layer": "Reference semantic tokens rather than primitive tokens",
  "top-level-surface-only": "Anchor component styles at a surface root",
  "unknown-token": "Require referenced tokens to exist in a configured token source",
  "value-token-required": "Require tokens for color values",
  "variant-shadows-vocabulary": "Keep variants outside the base-identity vocabulary",
}

// `z-index` belongs here for the same reason as `position` and `margin`: where a
// surface sits in the stacking order relative to its siblings is a decision the
// parent makes. Returning it to the parent is what stops the `z-index: 9999` race,
// since every escalation is an attempt to beat something outside the component.
const EXTERNAL_LAYOUT_PROPS = new Set([
  "position", "top", "right", "bottom", "left", "inset", "margin", "z-index",
])

function isExternalLayoutProp(prop) {
  const name = prop.toLowerCase()
  return (
    EXTERNAL_LAYOUT_PROPS.has(name) ||
    name.startsWith("margin-") ||
    name.startsWith("inset-")
  )
}

function isInternalPositioningContext(decl) {
  return decl.prop.toLowerCase() === "position" && decl.value.trim().toLowerCase() === "relative"
}

function isAnchorPlacementProp(prop) {
  const name = prop.toLowerCase()
  return (
    name === "position-anchor" ||
    name === "position-area" ||
    name === "inset-area" ||
    name.startsWith("position-try")
  )
}

function externalLayoutUtility(token) {
  const utility = token.replace(/^(?:[a-z-]+:)+/u, "").replace(/^-/u, "")
  if (new Set(["absolute", "fixed", "static", "sticky"]).has(utility)) {
    return true
  }
  return /^(?:m[trblxyse]?|inset(?:-[xy])?|top|right|bottom|left|start|end|z)-/u.test(
    utility,
  )
}
const analysisCache = new WeakMap()

function splitCompounds(nodes) {
  const compounds = []
  const combinators = []
  let current = []
  for (const node of nodes) {
    if (node.type === "combinator") {
      compounds.push(current)
      combinators.push(node.value.trim() || " ")
      current = []
    } else if (node.type !== "comment") {
      current.push(node)
    }
  }
  compounds.push(current)
  return { combinators, compounds }
}

function resolveNesting(nodes) {
  if (nodes[0]?.type === "nesting") {
    if (nodes[1]?.type === "combinator") {
      return {
        combinator: nodes[1].value.trim() || " ",
        mode: "combinator",
        rest: nodes.slice(2),
      }
    }
    return { mode: "merge", rest: nodes.slice(1) }
  }
  if (nodes[0]?.type === "combinator") {
    return {
      combinator: nodes[0].value.trim() || " ",
      mode: "combinator",
      rest: nodes.slice(1),
    }
  }
  return { combinator: " ", mode: "combinator", rest: nodes }
}

function classNodesDeep(nodes, output = []) {
  for (const node of nodes) {
    if (node.type === "class") output.push(node)
    for (const child of node.nodes ?? []) {
      if (child.nodes) classNodesDeep(child.nodes, output)
    }
  }
  return output
}

function tagNodesDeep(nodes, output = []) {
  for (const node of nodes) {
    if (node.type === "tag") output.push(node)
    for (const child of node.nodes ?? []) {
      if (child.nodes) tagNodesDeep(child.nodes, output)
    }
  }
  return output
}

function hasDeepPseudo(nodes) {
  return nodes.some(
    (node) =>
      (node.type === "pseudo" && node.value === ":deep") ||
      (node.nodes ? hasDeepPseudo(node.nodes.flatMap((child) => child.nodes ?? [])) : false),
  )
}

function isLibraryBoundary(token, sets, config) {
  return (
    !sets.slotSurfaces.has(token) &&
    (sets.componentValues.has(token) ||
      matchesClassPrefix(token, config.libraryBoundaryPrefixes))
  )
}

function isLibraryInternal(token, config) {
  return matchesClassPrefix(token, config.libraryInternalPrefixes)
}

function hasLibraryBoundary(nodes, sets, config) {
  return classNodesDeep(nodes).some((node) => isLibraryBoundary(node.value, sets, config))
}

function libraryBoundaryToken(nodes, sets, config) {
  return classNodesDeep(nodes).find((node) => isLibraryBoundary(node.value, sets, config))
    ?.value
}

function hasNonOwnedBoundary(nodes, sets, config) {
  return classNodesDeep(nodes).some(
    (node) =>
      isLibraryBoundary(node.value, sets, config) ||
      sets.slotSurfaces.has(node.value) ||
      isLibraryInternal(node.value, config),
  )
}

function selectorAlternatives(selector) {
  return selectorParser().astSync(selector).nodes.map((node) => node.nodes)
}

export const emptyTemplateContext = () => ({
  childSurfaceRoots: new Set(),
  expectedClasses: new Set(),
  roleNames: new Set(),
  surfaceRoots: new Set(),
  topLayerCapabilities: new Map(),
  tree: [],
})

export function analyzeStyleRoot(root, inputConfig, templateContext = emptyTemplateContext()) {
  const config = defineNagiConfig(inputConfig)
  const sets = buildNagiSets(config)
  const {
    childSurfaceRoots = new Set(),
    expectedClasses = new Set(),
    roleNames,
    surfaceRoots,
    topLayerCapabilities = new Map(),
    tree = [],
  } = templateContext

  const isOwnedComponentRoot = (token) => childSurfaceRoots.has(token)
  const endsInOwnedComponentRoot = (chain) =>
    chain !== null &&
    !(
      chain.length === 1 &&
      (chain[0]?.classes ?? []).some((token) => surfaceRoots.has(token))
    ) &&
    (chain.at(-1)?.classes ?? []).some(isOwnedComponentRoot)
  const violations = []

  // Only compounds whose classes are all plainly written can be matched against
  // the template: a class inside :is()/:not() means "one of", which the tree
  // cannot answer, and a boundary class means the chain leaves owned DOM.
  function chainCompound(nodes) {
    if (hasDeepPseudo(nodes)) return null
    const direct = nodes.filter((node) => node.type === "class").map((node) => node.value)
    if (classNodesDeep(nodes).length !== direct.length) return null
    const classes = direct.filter(
      (token) =>
        !token.startsWith("-") &&
        !/^(?:is-|has-)/.test(token) &&
        !sets.stateClasses.has(token),
    )
    if (classes.length === 0) return null
    if (
      classes.some(
        (token) =>
          isLibraryBoundary(token, sets, config) ||
          isLibraryInternal(token, config) ||
          sets.slotSurfaces.has(token),
      )
    ) {
      return null
    }
    return classes
  }

  // A class on an owned component root may be styled, but nothing below it: that
  // DOM belongs to the child's own surface. Works on the resolved chain, so a
  // step written in a nested rule is caught the same as a flat one.
  function checkReachIn(rule, chain) {
    if (chain === null || childSurfaceRoots.size === 0) return
    for (let index = 0; index < chain.length - 1; index += 1) {
      // A recursive component has the same class on this surface and on its
      // owned child instances. The selector anchor names this file's surface;
      // only a later occurrence crosses into the recursive child's ownership.
      if (
        index === 0 &&
        (chain[index].classes ?? []).some((token) => surfaceRoots.has(token))
      ) {
        continue
      }
      const owner = chain[index].classes.find(isOwnedComponentRoot)
      if (!owner) continue
      report(
        rule,
        "owned-surface-reach-in",
        `Selector "${rule.selector}" reaches below ".${owner}", the root of an owned child component; that DOM belongs to the child's surface, so style it there or pass a value in.`,
      )
      return
    }
  }

  function checkMirror(rule, chain) {
    if (tree.length === 0 || chain === null || chain.length === 0) return
    const { missing, status } = matchSelectorChain(tree, chain)
    if (status === "dead") {
      // A class the tables would require is missing markup, not a dead rule.
      if (missing.every((token) => expectedClasses.has(token))) return
      report(
        rule,
        "dead-rule",
        `Selector "${rule.selector}" targets ".${missing.join(".")}", which the template does not contain.`,
        `.${missing[0]}`,
      )
      return
    }
    if (status === "mismatch") {
      report(
        rule,
        "selector-mirrors-template",
        `Selector "${rule.selector}" does not follow the template: no element matches this path.`,
      )
    }
  }

  // Grows the resolved chain by one rule's worth of compounds, or gives up (null)
  // as soon as any part of it cannot be matched.
  function extendChain(parentChain, compounds, combinators, mode) {
    if (parentChain === null) return null
    const steps = compounds.map(chainCompound)
    if (steps.some((classes) => classes === null)) return null
    if (mode === "merge") {
      if (parentChain.length === 0) return null
      const merged = parentChain.map((step, index) =>
        index === parentChain.length - 1
          ? { ...step, classes: [...new Set([...step.classes, ...steps[0]])] }
          : step,
      )
      return [
        ...merged,
        ...steps.slice(1).map((classes, index) => ({
          classes,
          combinator: combinators[index] ?? " ",
        })),
      ]
    }
    return [
      ...parentChain,
      ...steps.map((classes, index) => ({
        classes,
        combinator: index === 0 ? (mode ?? " ") : (combinators[index - 1] ?? " "),
      })),
    ]
  }

  function report(node, ruleId, message, word) {
    violations.push({ message, node, ruleId, word })
  }

  function checkState(rule, token) {
    if (!/^(?:is-|has-)/.test(token) && !sets.stateClasses.has(token)) return false
    report(
      rule,
      "state-not-class",
      `Class ".${token}" encodes runtime state; use a native, ARIA, or data attribute instead.`,
      `.${token}`,
    )
    return true
  }

  function checkVariantShadow(rule, token) {
    const stem = token.slice(1)
    // A role name that is not also a base identity is only unavailable where the
    // template actually declares that role.
    if (sets.roleVocabulary.has(stem) && !sets.variantShadowNames.has(stem)) {
      if (!roleNames.has(stem)) return
      report(
        rule,
        "variant-shadows-vocabulary",
        `Variant ".${token}" names a role this template declares; use ".${stem}" as the base identity instead.`,
        `.${token}`,
      )
      return
    }
    if (!sets.variantShadowNames.has(stem)) return
    report(
      rule,
      "variant-shadows-vocabulary",
      `Variant ".${token}" shadows the vocabulary name "${stem}"; variants modify an anchor, they do not name what it is.`,
      `.${token}`,
    )
  }

  function checkSingleBaseIdentity(rule, nodes) {
    const baseTokens = [
      ...new Set(
        nodes
          .filter((node) => node.type === "class")
          .map((node) => node.value)
          .filter(
            (token) =>
              !token.startsWith("-") &&
              !/^(?:is-|has-)/.test(token) &&
              !sets.stateClasses.has(token) &&
              !isLibraryInternal(token, config),
          ),
      ),
    ]
    if (baseTokens.length < 2) return
    report(
      rule,
      "single-base-identity",
      `Selector compound has multiple base identity classes: ".${baseTokens.join(" .")}"; keep exactly one table-first base and express additional semantics with attributes.`,
      `.${baseTokens[1]}`,
    )
  }

  function checkAnatomy(rule, nodes) {
    if (hasDeepPseudo(nodes)) return
    checkSingleBaseIdentity(rule, nodes)
    for (const node of classNodesDeep(nodes)) {
      const token = node.value
      if (checkState(rule, token)) continue
      if (token.startsWith("-")) {
        checkVariantShadow(rule, token)
        continue
      }
      if (isLibraryInternal(token, config)) continue
      if (sets.banned.has(token)) {
        report(rule, "anatomy-allowed", `Class ".${token}" is a banned generic anatomy name.`, `.${token}`)
        continue
      }
      const allowed =
        sets.elementValues.has(token) ||
        sets.anatomy.has(token) ||
        sets.stn.has(token) ||
        sets.componentValues.has(token) ||
        sets.slotSurfaces.has(token) ||
        surfaceRoots.has(token) ||
        // An owned child component placed in this template: derived from its tag,
        // so a typo or a stale name after a rename is rejected here.
        childSurfaceRoots.has(token) ||
        roleNames.has(token)
      if (!allowed) {
        report(
          rule,
          "anatomy-allowed",
          `Class ".${token}" is not an element, component, anatomy, STN, slot-surface, or matching role name.`,
          `.${token}`,
        )
      }
    }
  }

  function checkBareElements(rule, nodes) {
    if (hasDeepPseudo(nodes) || hasNonOwnedBoundary(nodes, sets, config)) return
    for (const node of tagNodesDeep(nodes)) {
      if (node.value === "from" || node.value === "to") continue
      report(
        rule,
        "bare-element-selector",
        `Selector "${rule.selector}" styles bare <${node.value}> inside owned DOM; use a class.`,
        node.value,
      )
    }
  }

  function checkEdge(
    rule,
    combinator,
    left,
    right,
    parentEndsInBoundary = false,
    leftIsOwnedComponentRoot = false,
  ) {
    // Sibling combinators express order among siblings, not a parent/child step,
    // so the direct-child requirement does not apply to them.
    if (combinator === "+" || combinator === "~") return
    // Below an owned component root neither combinator is right; telling the author
    // to switch to ">" would only make the reach-in more emphatic.
    if (
      leftIsOwnedComponentRoot ||
      classNodesDeep(left ?? []).some((node) => isOwnedComponentRoot(node.value))
    ) {
      return
    }
    const leftBoundary = parentEndsInBoundary || hasLibraryBoundary(left ?? [], sets, config)
    const rightCrossesBoundary = hasDeepPseudo(right ?? [])
    if (combinator === ">") {
      if (leftBoundary || rightCrossesBoundary) {
        report(
          rule,
          "owned-dom-direct-child",
          `Selector "${rule.selector}" uses ">" after a UI boundary; use a descendant step across library-owned DOM.`,
        )
      }
      return
    }
    if (!leftBoundary && !rightCrossesBoundary) {
      report(
        rule,
        "owned-dom-direct-child",
        `Selector "${rule.selector}" uses "${combinator}" between owned elements; use ">".`,
      )
    }
  }

  function checkFlattenedBoundary(rule, compounds) {
    for (let index = 0; index < compounds.length - 1; index += 1) {
      if (!hasLibraryBoundary(compounds[index], sets, config)) continue
      const laterClasses = compounds
        .slice(index + 1)
        .flatMap((compound) => classNodesDeep(compound).map((node) => node.value))
      const slot = laterClasses.find((token) => sets.slotSurfaces.has(token))
      if (slot) {
        report(
          rule,
          "boundary-nesting",
          `Slot surface ".${slot}" must be written in a nested rule inside its UI boundary block.`,
          `.${slot}`,
        )
      }
    }
  }

  function checkBoundaryContinuation(rule, boundary, next) {
    if (!boundary || !next || hasDeepPseudo(next)) return
    const allowed = sets.componentSlotsByBoundary.get(boundary) ?? new Set()
    const anchor = classNodesDeep(next).find((node) => allowed.has(node.value))
    if (anchor) return
    report(
      rule,
      "boundary-slot-surface-required",
      `Selector "${rule.selector}" continues below UI boundary ".${boundary}" without one of that component's declared slot surfaces. Style the boundary root itself, use a declared slot surface for owned content, or use :deep() for an explicit non-owned adjustment.`,
    )
  }

  function checkFlatBoundaryContinuations(rule, compounds) {
    for (let index = 0; index < compounds.length - 1; index += 1) {
      checkBoundaryContinuation(
        rule,
        libraryBoundaryToken(compounds[index], sets, config),
        compounds[index + 1],
      )
    }
  }

  function ownDeclsAnchored(container) {
    let anchored = false
    container.each?.((node) => {
      if (node.type === "decl" && isAnchorPlacementProp(node.prop)) anchored = true
      else if (node.type === "atrule" && ownDeclsAnchored(node)) anchored = true
    })
    return anchored
  }

  // Which tokens this stylesheet may reference. Inactive until the project points
  // at a source, because the set of legal names is the project's to define.
  const tokenLayers = loadTokenLayers(config.tokens?.sources)
  const declaredHere = new Set()
  if (tokenLayers.size > 0) {
    root.walkDecls((decl) => {
      if (decl.prop.startsWith("--")) declaredHere.add(decl.prop)
    })
  }

  function checkTokenReferences(decl) {
    if (tokenLayers.size === 0) return
    for (const name of tokenReferences(decl.value)) {
      // Declared in this stylesheet: a --local-* one-off, or a value the surface
      // passes into a component it owns.
      if (declaredHere.has(name)) continue
      if (name.startsWith(config.tokens.localPrefix)) continue
      if (matchesClassPrefix(name, config.tokens.exposedPrefixes)) continue

      const layer = tokenLayers.get(name)
      if (!layer) {
        report(
          decl,
          "unknown-token",
          `"${name}" is not declared by any configured token source, so this declaration silently does nothing; check the spelling or add the token to the design system.`,
          name,
        )
        continue
      }
      if (layer === "primitive") {
        report(
          decl,
          "token-layer",
          `"${name}" is a primitive token; reference a semantic token instead, so a theme change stays inside the token files.`,
          name,
        )
      }
    }
  }

  // A color is always a design decision, so it always belongs to the token layer.
  // Unlike the two rules above this needs no configured source: it does not ask
  // which token is right, only that one is used. There is deliberately no
  // `--local-*` escape — a one-off length can be an optical correction, but a
  // one-off color is a decision made in the wrong file.
  // With no source configured there is no token layer to point at, so "use a
  // token" is advice the reader cannot act on. Say what is actually missing.
  const noTokenLayer =
    (config.tokens?.sources ?? []).length === 0
      ? " This project declares no token layer: add one and point `tokens.sources` at it, or turn this rule off in `severity`."
      : ""

  function checkValueTokens(decl) {
    const options = { property: decl.prop, exposedPrefixes: config.tokens?.exposedPrefixes }
    for (const literal of rawColorLiterals(decl.value, options)) {
      report(
        decl,
        "value-token-required",
        `"${literal}" is a raw color; reference a color token (--color-*) instead, so the color is a decision the design system owns.${noTokenLayer}`,
        literal,
      )
    }
    // The named escape: a `--local-*` declaration is where a genuine one-off
    // magnitude lives, so the exception carries a reason and can be searched for.
    if (decl.prop.startsWith(config.tokens.localPrefix)) return
    const family = tokenFamilyFor(decl.prop)
    for (const literal of rawLengthLiterals(decl.value, options)) {
      report(
        decl,
        "length-token-required",
        `"${literal}" is a raw ${family?.label ?? "length"} value; reference a token${
          family ? ` (${family.example})` : ""
        }, or declare it as a named "${config.tokens.localPrefix}*" value if it is genuinely a one-off.${noTokenLayer}`,
        literal,
      )
    }
  }

  // Declarations belonging to this rule, including ones wrapped in a nested
  // at-rule, but not those of a nested rule — that is a different element.
  function eachOwnDecl(container, visit) {
    container.each?.((node) => {
      if (node.type === "decl") visit(node)
      else if (node.type === "atrule") eachOwnDecl(node, visit)
    })
  }

  // An anchor-positioned surface outside the top layer may need a system stacking
  // token. Top-layer boxes are different: their order is the order in the top
  // layer, so z-index cannot order a modal against a popover or toast there.
  function checkStackingToken(decl) {
    if (decl.prop.toLowerCase() !== "z-index") return
    const value = decl.value.trim()
    if (!/^[+-]?\d+$/.test(value) || Number(value) === 0) return
    report(
      decl,
      "stacking-token-required",
      `"${value}" is a raw stacking level on a surface that owns its own stacking order; reference a stacking token (--z-*) so the order between overlays is decided in one place.${noTokenLayer}`,
      value,
    )
  }

  function compoundGuaranteesTopLayer(compound, token) {
    const capabilities = topLayerCapabilities.get(token)
    if (!capabilities) return false
    return compound.some(
      (node) => node.type === "pseudo" && capabilities.has(node.value.toLowerCase()),
    )
  }

  function topLevelGuaranteesTopLayer(alternatives, token) {
    if (!token || alternatives.length === 0) return false
    return alternatives.every((nodes) => {
      const { compounds } = splitCompounds(nodes)
      const subject = compounds.at(-1) ?? []
      return surfaceSubjectToken(compounds) === token && compoundGuaranteesTopLayer(subject, token)
    })
  }

  function nestedGuaranteesTopLayer(alternatives, token, parentGuaranteesTopLayer) {
    if (!token || alternatives.length === 0) return false
    return alternatives.every((nodes) => {
      const { mode, rest } = resolveNesting(nodes)
      const { compounds } = splitCompounds(rest)
      if (mode !== "merge" || compounds.length !== 1) return false
      return parentGuaranteesTopLayer || compoundGuaranteesTopLayer(compounds[0], token)
    })
  }

  function checkSurfaceLayout(rule, token, isTopLayer = false) {
    if (!token) return
    const ownsPlacement = isTopLayer || ownDeclsAnchored(rule)
    eachOwnDecl(rule, (node) => {
      if (isTopLayer && node.prop.toLowerCase() === "z-index") {
        report(
          node,
          "top-layer-z-index",
          `Selector "${rule.selector}" matches the top-layer state of surface ".${token}", whose boxes are ordered by top-layer insertion order rather than z-index; remove this declaration and coordinate show/popover order instead.`,
          node.prop,
        )
      } else if (ownsPlacement) {
        checkStackingToken(node)
      } else if (isExternalLayoutProp(node.prop) && !isInternalPositioningContext(node)) {
        report(
          node,
          "surface-external-layout",
          `Surface ".${token}" must not own external layout; "${node.prop}" belongs to the parent layout.`,
          node.prop,
        )
      }
    })
    if (!ownsPlacement && config.declarationMode === "tailwind-apply") {
      for (const node of rule.nodes ?? []) {
        if (node.type !== "atrule" || node.name.toLowerCase() !== "apply") continue
        for (const utility of node.params.trim().split(/\s+/u).filter(Boolean)) {
          if (!externalLayoutUtility(utility)) continue
          report(
            node,
            "surface-external-layout",
            `Surface ".${token}" must not own external layout; Tailwind utility "${utility}" expands to placement owned by the parent layout.`,
            utility,
          )
        }
      }
    }
  }

  // A container name is an identifier, so the contract derives it like every other
  // one: from the surface and the element that declares it. The element's own base
  // identity is already the canonical name for that node, so the container name is
  // that name qualified by the surface it lives in.
  function containerNames(decl) {
    const prop = decl.prop.toLowerCase()
    if (prop !== "container" && prop !== "container-name") return []
    const names = prop === "container" ? decl.value.split("/")[0] : decl.value
    return names
      .trim()
      .split(/\s+/)
      .filter((name) => name && name !== "none" && !name.startsWith("var("))
  }

  function checkContainerName(rule, chain) {
    // An unresolvable chain cannot say which element declares the container, and a
    // child component's root is not this file's to name.
    if (chain === null) return
    const identities = chain.at(-1)?.classes ?? []
    if (identities.length === 0 || identities.some(isOwnedComponentRoot)) return

    const expected = new Set()
    for (const surfaceRoot of surfaceRoots) {
      for (const identity of identities) {
        expected.add(identity === surfaceRoot ? surfaceRoot : `${surfaceRoot}-${identity}`)
      }
    }
    if (expected.size === 0) return

    eachOwnDecl(rule, (decl) => {
      for (const name of containerNames(decl)) {
        if (expected.has(name)) continue
        report(
          decl,
          "container-name-derived",
          `Container name "${name}" is not derived from the element that declares it; use "${[...expected].sort()[0]}".`,
          name,
        )
      }
    })
  }

  function surfaceSubjectToken(compounds) {
    for (const node of compounds.at(-1) ?? []) {
      if (node.type === "class" && surfaceRoots.has(node.value)) return node.value
    }
    return null
  }

  function alternativesEndInBoundary(alternatives, parentEndsInBoundary = false, nested = false) {
    return (
      alternatives.length > 0 &&
      alternatives.every((nodes) => {
        const resolved = nested ? resolveNesting(nodes) : { mode: "root", rest: nodes }
        const { compounds } = splitCompounds(resolved.rest)
        const last = compounds.at(-1) ?? []
        if (resolved.mode === "merge" && compounds.length === 1) {
          return parentEndsInBoundary || hasLibraryBoundary(last, sets, config)
        }
        return hasLibraryBoundary(last, sets, config)
      })
    )
  }

  function alternativesBoundaryToken(alternatives, parentBoundaryToken = null, nested = false) {
    const boundaries = alternatives.map((nodes) => {
      const resolved = nested ? resolveNesting(nodes) : { mode: "root", rest: nodes }
      const { compounds } = splitCompounds(resolved.rest)
      const boundary = libraryBoundaryToken(compounds.at(-1) ?? [], sets, config)
      if (resolved.mode === "merge" && compounds.length === 1) {
        return boundary ?? parentBoundaryToken
      }
      return boundary ?? null
    })
    return boundaries.length > 0 && boundaries.every((value) => value === boundaries[0])
      ? boundaries[0]
      : null
  }

  function processTopLevel(rule) {
    let alternatives
    try {
      alternatives = selectorAlternatives(rule.selector)
    } catch {
      return
    }
    let surfaceSubject = null
    let ruleChain = null
    for (const nodes of alternatives) {
      const { combinators, compounds } = splitCompounds(nodes)
      if (compounds.length === 0) continue
      if (compounds.length > 1) {
        report(
          rule,
          "owned-dom-readable-nesting",
          `Selector "${rule.selector}" flattens structure below its surface root; nest each owned depth in its own CSS rule.`,
        )
      }
      surfaceSubject ??= surfaceSubjectToken(compounds)
      const chain = extendChain([], compounds, combinators, ">")
      ruleChain ??= chain
      checkMirror(rule, chain)
      checkReachIn(rule, chain)
      checkBareElements(rule, compounds[0])
      checkSingleBaseIdentity(rule, compounds[0])
      for (const node of compounds[0].filter((candidate) => candidate.type === "class")) {
        const token = node.value
        if (checkState(rule, token)) continue
        if (token.startsWith("-")) {
          checkVariantShadow(rule, token)
          continue
        }
        if (sets.banned.has(token)) {
          report(rule, "anatomy-allowed", `Class ".${token}" is a banned generic anatomy name.`, `.${token}`)
          continue
        }
        if (sets.slotSurfaces.has(token) && !sets.detachedSlotSurfaces.has(token)) {
          report(
            rule,
            "slot-surface-top-level",
            `Slot surface ".${token}" must be nested below its UI boundary unless it is detached.`,
            `.${token}`,
          )
          continue
        }
        if (surfaceRoots.size > 0 && !surfaceRoots.has(token)) {
          report(
            rule,
            "top-level-surface-only",
            `Top-level selector ".${token}" is not a surface root in this component template.`,
            `.${token}`,
          )
        } else if (
          surfaceRoots.size === 0 &&
          (sets.elementValues.has(token) || sets.anatomy.has(token) || sets.stn.has(token))
        ) {
          report(
            rule,
            "top-level-surface-only",
            `Top-level selector ".${token}" is a style element, not a surface root.`,
            `.${token}`,
          )
        }
      }
      checkFlattenedBoundary(rule, compounds)
      checkFlatBoundaryContinuations(rule, compounds)
      for (let index = 1; index < compounds.length; index += 1) {
        checkEdge(rule, combinators[index - 1], compounds[index - 1], compounds[index])
        checkBareElements(rule, compounds[index])
        checkAnatomy(rule, compounds[index])
      }
    }
    const guaranteesTopLayer = topLevelGuaranteesTopLayer(alternatives, surfaceSubject)
    checkSurfaceLayout(rule, surfaceSubject, guaranteesTopLayer)
    checkContainerName(rule, ruleChain)
    walkNested(
      rule,
      alternativesEndInBoundary(alternatives),
      surfaceSubject,
      ruleChain,
      alternativesBoundaryToken(alternatives),
      guaranteesTopLayer,
    )
  }

  function processNested(
    rule,
    parentEndsInBoundary,
    parentSurfaceToken = null,
    parentChain = null,
    parentBoundaryToken = null,
    parentGuaranteesTopLayer = false,
  ) {
    let alternatives
    try {
      alternatives = selectorAlternatives(rule.selector)
    } catch {
      walkNested(
        rule,
        parentEndsInBoundary,
        parentSurfaceToken,
        parentChain,
        parentBoundaryToken,
        parentGuaranteesTopLayer,
      )
      return
    }
    let surfaceSubject = null
    let ruleChain = null
    for (const nodes of alternatives) {
      const { combinator, mode, rest } = resolveNesting(nodes)
      const { combinators, compounds } = splitCompounds(rest)
      if (compounds.length === 0) continue
      if (combinators.includes(">")) {
        report(
          rule,
          "owned-dom-readable-nesting",
          `Selector "${rule.selector}" flattens more than one owned depth; nest each ">" step in its own CSS rule.`,
        )
      }
      const chain = extendChain(
        parentChain,
        compounds,
        combinators,
        mode === "merge" ? "merge" : combinator,
      )
      ruleChain ??= chain
      checkMirror(rule, chain)
      checkReachIn(rule, chain)
      checkFlattenedBoundary(rule, compounds)
      if (mode !== "merge") {
        checkBoundaryContinuation(rule, parentBoundaryToken, compounds[0])
      }
      checkFlatBoundaryContinuations(rule, compounds)
      if (mode === "merge") {
        if (compounds.length === 1) surfaceSubject ??= parentSurfaceToken
        checkAnatomy(rule, compounds[0])
      } else {
        checkEdge(
          rule,
          combinator,
          null,
          compounds[0],
          parentEndsInBoundary,
          endsInOwnedComponentRoot(parentChain),
        )
        checkBareElements(rule, compounds[0])
        checkAnatomy(rule, compounds[0])
      }
      for (let index = 1; index < compounds.length; index += 1) {
        checkEdge(rule, combinators[index - 1], compounds[index - 1], compounds[index])
        checkBareElements(rule, compounds[index])
        checkAnatomy(rule, compounds[index])
      }
    }
    const guaranteesTopLayer = nestedGuaranteesTopLayer(
      alternatives,
      surfaceSubject,
      parentGuaranteesTopLayer,
    )
    checkSurfaceLayout(rule, surfaceSubject, guaranteesTopLayer)
    checkContainerName(rule, ruleChain)
    walkNested(
      rule,
      alternativesEndInBoundary(alternatives, parentEndsInBoundary, true),
      surfaceSubject,
      ruleChain,
      alternativesBoundaryToken(alternatives, parentBoundaryToken, true),
      guaranteesTopLayer,
    )
  }

  function walkNested(
    container,
    parentEndsInBoundary,
    parentSurfaceToken = null,
    parentChain = null,
    parentBoundaryToken = null,
    parentGuaranteesTopLayer = false,
  ) {
    container.each?.((node) => {
      if (node.type === "rule") {
        processNested(
          node,
          parentEndsInBoundary,
          parentSurfaceToken,
          parentChain,
          parentBoundaryToken,
          parentGuaranteesTopLayer,
        )
      } else if (node.type === "atrule") {
        walkNested(
          node,
          parentEndsInBoundary,
          parentSurfaceToken,
          parentChain,
          parentBoundaryToken,
          parentGuaranteesTopLayer,
        )
      }
    })
  }

  function walkRoot(container) {
    container.each?.((node) => {
      if (node.type === "rule") processTopLevel(node)
      else if (node.type === "atrule" || node.type === "root") walkRoot(node)
    })
  }

  walkRoot(root)

  // Nagi's selector and ownership contract does not depend on how declarations
  // are authored. Tailwind `@apply` is therefore an explicit implementation
  // choice rather than an implicit escape hatch. In that mode selector checks
  // remain active, while checks that require expanded declaration values remain
  // Tailwind's responsibility unless a declaration is also written as CSS here.
  if (config.declarationMode !== "tailwind-apply") {
    root.walkAtRules("apply", (atRule) => {
      report(
        atRule,
        "apply-directive-not-enabled",
        '"@apply" requires declarationMode: "tailwind-apply". Keep this surface in plain CSS or enable the Tailwind declaration backend explicitly.',
        "@apply",
      )
    })
  } else {
    root.walkAtRules("apply", (atRule) => {
      const arbitrary = atRule.params.match(/\S*\[[^\]]*\]\S*/u)?.[0]
      if (!arbitrary) return
      report(
        atRule,
        "apply-arbitrary-syntax",
        `Tailwind arbitrary syntax "${arbitrary}" hides a property or value from source analysis; write that declaration as plain CSS beside @apply.`,
        arbitrary,
      )
    })
  }

  // A `@container` query may only name a container this file declares. Querying
  // another component's container couples this surface to a name it does not own,
  // which is the same reach-in the contract rejects for selectors; an unnamed query
  // resolves against the nearest ancestor and is always fine.
  const declaredContainers = new Set()
  root.walkDecls((decl) => {
    for (const name of containerNames(decl)) declaredContainers.add(name)
  })
  root.walkAtRules("container", (atRule) => {
    const [name] = atRule.params.trim().split(/[\s(]/)
    if (!name || name.startsWith("(") || declaredContainers.has(name)) return
    report(
      atRule,
      "container-query-scope",
      `Container query names "${name}", which this file does not declare; query a container declared here, or leave the query unnamed to match the nearest ancestor.`,
      name,
    )
  })

  // Cascade layers reorder the cascade, and the contract's structural rules exist so
  // that the order never needs adjusting: one base identity per compound, `>` chains,
  // no bare element selectors. A layer inside a surface is an escape hatch back to
  // "make this win", and a component that must lose to its consumer has a public
  // contract for that (custom properties), not a cascade trick. Global layer
  // ordering — reset, base, theme — lives in global stylesheets, which are outside
  // the contract by the same decision that excludes standalone `.css`.
  root.walkAtRules("layer", (atRule) => {
    report(
      atRule,
      "cascade-layer-in-surface",
      `"@layer" adjusts cascade order inside a surface; the contract keeps specificity flat so ordering never has to be adjusted. Put global layer ordering in a global stylesheet, and expose a custom property where a consumer must override.`,
      "@layer",
    )
  })

  // A `@keyframes` nobody animates with is dead weight the same way an unmatched
  // selector is. Scoped styles make it stronger than unused — Vue, Svelte, and Astro
  // all rewrite the name per component, so nothing outside can reach it either — but
  // the rule does not depend on that: motion meant to be shared belongs in a global
  // stylesheet, which is outside the contract, so a component's own block is the
  // whole search space.
  const animationNames = new Set()
  let animationsResolvable = true
  root.walkDecls(/^(?:-\w+-)?animation(?:-name)?$/i, (decl) => {
    // A name assembled from a custom property cannot be resolved, so nothing here
    // can be called dead.
    if (decl.value.includes("var(")) animationsResolvable = false
    for (const token of decl.value.split(/[^\w-]+/)) {
      if (token) animationNames.add(token)
    }
  })
  if (animationsResolvable) {
    root.walkAtRules(/^(?:-\w+-)?keyframes$/i, (atRule) => {
      const name = atRule.params.trim().replace(/^(['"])(.*)\1$/, "$2")
      if (!name || animationNames.has(name)) return
      report(
        atRule,
        "dead-keyframes",
        `"@keyframes ${name}" is never referenced in this component; scoped styles rename it per component, so nothing outside animates with it either. Motion meant to be shared belongs in a global stylesheet.`,
        name,
      )
    })
  }

  // Token references are a property of the declaration, not of the selector, so
  // they are checked across the whole stylesheet rather than per surface. Custom
  // property declarations are included: `--local-accent: var(--palette-red-500)`
  // reads the primitive layer just as directly as the property that uses it.
  root.walkDecls((decl) => {
    checkTokenReferences(decl)
    checkValueTokens(decl)
  })
  return violations
}

function cachedAnalysis(root, config, templateContext) {
  let analyses = analysisCache.get(root)
  if (!analyses) {
    analyses = new Map()
    analysisCache.set(root, analyses)
  }
  const key = JSON.stringify(config)
  if (!analyses.has(key)) analyses.set(key, analyzeStyleRoot(root, config, templateContext))
  return analyses.get(key)
}

function readableStyle(style) {
  return !style.src && (!style.lang || style.lang === "css")
}

function blockContentStart(source, style) {
  if (Number.isInteger(style.contentStart)) return style.contentStart
  if (Number.isInteger(style.loc?.start?.offset)) return style.loc.start.offset
  return Math.max(0, source.indexOf(style.content ?? ""))
}

function absoluteViolation(violation, contentStarts) {
  const contentStart = contentStarts.get(violation.node.source?.input) ?? 0
  const range = violation.node.rangeBy(violation.word ? { word: violation.word } : {})
  return {
    message: violation.message,
    range: [
      contentStart + range.start.offset,
      contentStart + range.end.offset,
    ],
    ruleId: violation.ruleId,
  }
}

export function analyzeComponentStyles(source, filename, inputConfig, templateContext) {
  const violations = []
  const roots = []
  const contentStarts = new Map()
  for (const style of templateContext.styles ?? []) {
    if (!readableStyle(style)) continue
    const contentStart = blockContentStart(source, style)
    let root
    try {
      root = postcss.parse(style.content ?? "", { from: filename })
    } catch (error) {
      const relativeOffset = error?.input?.offset ?? 0
      violations.push({
        message: `Style block contains CSS syntax Nagi CSS cannot read: ${
          error?.reason ?? error?.message ?? String(error)
        }.`,
        range: [
          contentStart + relativeOffset,
          contentStart + relativeOffset + 1,
        ],
        ruleId: "unsupported-style-syntax",
      })
      continue
    }
    roots.push(root)
    contentStarts.set(root.source.input, contentStart)
  }
  if (roots.length > 0) {
    const document = postcss.document({ nodes: roots })
    violations.push(
      ...cachedAnalysis(document, inputConfig, templateContext).map((violation) =>
        absoluteViolation(violation, contentStarts),
      ),
    )
  }
  return violations
}
