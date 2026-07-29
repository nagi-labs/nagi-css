import path from "node:path"

import { parse } from "@vue/compiler-sfc"
import postcss from "postcss"
import selectorParser from "postcss-selector-parser"

import {
  buildNagiSets,
  defineNagiConfig,
  deriveAllowedSurfaceRootNames,
  kebabCase,
  mappingBase,
  matchesClassPrefix,
} from "./index.mjs"

const STATE_PREFIX_RE = /^(?:is-|has-)/
const ELEMENT = 1
const NATIVE = 0
const COMPONENT = 1
const TEMPLATE = 3

// Wrappers that add no DOM level of their own, so they neither shift a surface
// root off the template root nor count as a step in an STN chain. Teleport is
// deliberately absent: it moves its content out of the surface, which is what
// detachedSlotSurfaces covers.
const TRANSPARENT_TAGS = new Set([
  "slot",
  "Transition",
  "transition",
  "TransitionGroup",
  "transition-group",
  "KeepAlive",
  "keep-alive",
  "Suspense",
  "suspense",
])

function isTransparentWrapper(node) {
  return (
    node?.type === ELEMENT && (node.tagType === TEMPLATE || TRANSPARENT_TAGS.has(node.tag))
  )
}

// Walking the owned tree that the template describes, so a selector chain can be
// checked against the structure it claims to mirror. Every answer other than
// "ok" is only reported when the tree is certain; anything opaque or dynamic
// resolves to "unknown" and is left alone.
export function matchSelectorChain(tree = [], chain = []) {
  if (chain.length === 0) return { status: "unknown" }
  const anchor = chain[0].classes
  if (anchor.length === 0) return { status: "unknown" }

  const nodesWith = (classes, nodes) =>
    nodes.filter((node) => classes.every((name) => node.classes.includes(name)))
  const allNodes = []
  const positions = new WeakMap()
  const collect = (nodes) => {
    for (const [index, node] of nodes.entries()) {
      allNodes.push(node)
      positions.set(node, { index, siblings: nodes })
      collect(node.children)
    }
  }
  collect(tree)

  const followingSiblings = (node, adjacentOnly) => {
    const at = positions.get(node)
    if (!at) return []
    return adjacentOnly
      ? at.siblings.slice(at.index + 1, at.index + 2)
      : at.siblings.slice(at.index + 1)
  }

  const existsAnywhere = (classes) => nodesWith(classes, allNodes).length > 0
  let sawUnknown = false

  const descendants = (node, deep) => {
    const out = []
    const push = (children) => {
      for (const child of children) {
        out.push(child)
        if (deep && !child.opaque) push(child.children)
      }
    }
    push(node.children)
    return out
  }

  const walk = (node, index) => {
    if (index >= chain.length) return true
    const step = chain[index]
    const sibling = step.combinator === "+" || step.combinator === "~"
    if (node.opaque && !sibling) {
      sawUnknown = true
      return false
    }
    const pool = sibling
      ? followingSiblings(node, step.combinator === "+")
      : descendants(node, step.combinator !== ">")
    if (pool.some((candidate) => candidate.dynamic || (candidate.opaque && !sibling))) {
      sawUnknown = true
    }
    return nodesWith(step.classes, pool).some((candidate) => walk(candidate, index + 1))
  }

  const starts = nodesWith(anchor, allNodes)
  if (starts.length === 0) {
    return existsAnywhere(anchor)
      ? { status: "unknown" }
      : { missing: anchor, status: "dead" }
  }
  if (starts.some((node) => walk(node, 1))) return { status: "ok" }
  if (sawUnknown) return { status: "unknown" }

  const last = chain.at(-1).classes
  return existsAnywhere(last)
    ? { status: "mismatch" }
    : { missing: last, status: "dead" }
}

const SUPPORTED_STYLE_LANGS = new Set(["css"])

// Style blocks the toolchain cannot read. Reported rather than skipped: a file
// whose styles were never parsed must not pass as conforming.
export function unreadableStyleBlocks(styles = []) {
  const blocks = []
  for (const style of styles) {
    const line = style.loc?.start.line ?? 1
    if (style.src) blocks.push({ kind: "src", line, value: style.src })
    else if (style.lang && !SUPPORTED_STYLE_LANGS.has(style.lang)) {
      blocks.push({ kind: "lang", line, value: style.lang })
    }
  }
  return blocks
}

function isVariant(token) {
  return token.startsWith("-")
}

function isLibraryInternal(token, config) {
  return matchesClassPrefix(token, config.libraryInternalPrefixes)
}

function getStaticAttr(node, name) {
  for (const property of node.props ?? []) {
    if (property.type === 6 && property.name === name && property.value) {
      return property.value.content
    }
  }
  return null
}

function hasStaticAttr(node, name) {
  return (node.props ?? []).some((property) => property.type === 6 && property.name === name)
}

function collectLiteralClassTokens(node, output) {
  if (!node || typeof node !== "object") return
  if (
    (node.type === "StringLiteral" || node.type === "Literal") &&
    typeof node.value === "string"
  ) {
    output.push(...node.value.split(/\s+/).filter(Boolean))
    return
  }
  if (node.type === "ArrayExpression") {
    for (const element of node.elements ?? []) collectLiteralClassTokens(element, output)
    return
  }
  if (node.type === "ObjectExpression") {
    for (const property of node.properties ?? []) {
      if (property.type !== "ObjectProperty" && property.type !== "Property") continue
      const key = property.key
      if (key?.type === "Identifier" && !property.computed) output.push(key.name)
      if (
        (key?.type === "StringLiteral" || key?.type === "Literal") &&
        typeof key.value === "string"
      ) {
        output.push(...key.value.split(/\s+/).filter(Boolean))
      }
    }
    return
  }
  if (node.type === "ConditionalExpression") {
    collectLiteralClassTokens(node.consequent, output)
    collectLiteralClassTokens(node.alternate, output)
  }
}

function extractClassInfo(node) {
  const info = {
    dynamic: false,
    dynamicTokens: [],
    staticProp: null,
    staticTokens: [],
  }

  for (const property of node.props ?? []) {
    if (property.type === 6 && property.name === "class" && property.value) {
      info.staticProp = property
      info.staticTokens = property.value.content.split(/\s+/).filter(Boolean)
      continue
    }
    if (
      property.type === 7 &&
      property.name === "bind" &&
      property.arg?.type === 4 &&
      property.arg.isStatic &&
      property.arg.content === "class"
    ) {
      info.dynamic = true
      collectLiteralClassTokens(property.exp?.ast, info.dynamicTokens)
    }
  }
  return info
}

function collectStyledClasses(styles) {
  const classes = new Set()
  for (const style of styles) {
    let root
    try {
      root = postcss.parse(style.content)
    } catch {
      continue
    }
    root.walkRules((rule) => {
      try {
        selectorParser((selectors) => {
          selectors.walkClasses((node) => classes.add(node.value))
        }).processSync(rule.selector)
      } catch {
        // Stylelint reports malformed selectors; template requirements remain best-effort.
      }
    })
  }
  return classes
}

function buildClassFix(node, info, requiredClass) {
  if (info.staticProp) return rewriteClassFix(info, [...info.staticTokens, requiredClass])
  const offset = node.loc.start.offset + 1 + node.tag.length
  return { range: [offset, offset], text: ` class="${requiredClass}"` }
}

// Rewrites the whole static class attribute. Every rule that uses it computes the
// replacement from the contract, so the result is the canonical form by
// construction rather than a guess.
function rewriteClassFix(info, tokens) {
  if (!info.staticProp) return undefined
  if (tokens.length === 0) {
    // Nothing left to carry: drop the attribute rather than leave class="".
    const { loc } = info.staticProp
    return { range: [loc.start.offset - 1, loc.end.offset], text: "" }
  }
  const value = info.staticProp.value
  return {
    range: [value.loc.start.offset, value.loc.end.offset],
    text: `"${tokens.join(" ")}"`,
  }
}

function replaceToken(info, from, to) {
  return rewriteClassFix(
    info,
    info.staticTokens.map((token) => (token === from ? to : token)),
  )
}

function hasOwnedBaseClass(tokens, config) {
  return tokens.some((token) => !isVariant(token) && !isLibraryInternal(token, config))
}

function ownedBaseTokens(tokens, config, sets) {
  return tokens.filter(
    (token) =>
      !isVariant(token) &&
      !STATE_PREFIX_RE.test(token) &&
      !sets.stateClasses.has(token) &&
      !isLibraryInternal(token, config),
  )
}

function push(violations, node, ruleId, message, fix) {
  violations.push({
    ruleId,
    message,
    line: node.loc?.start.line ?? 1,
    column: node.loc?.start.column ?? 1,
    ...(fix ? { fix } : {}),
  })
}

function checkState(token, node, sets, violations) {
  if (!STATE_PREFIX_RE.test(token) && !sets.stateClasses.has(token)) return false
  push(
    violations,
    node,
    "state-not-class",
    `Class "${token}" encodes runtime state; use a native, ARIA, or data attribute instead.`,
  )
  return true
}

export function analyzeVueTemplate(source, filename, inputConfig = {}) {
  const config = defineNagiConfig(inputConfig)
  const sets = buildNagiSets(config)
  const violations = []
  const surfaceRoots = new Set()
  const roleNames = new Set()
  const topLayerSurfaces = new Set()
  const { descriptor } = parse(source, { filename })
  const styleBlocks = unreadableStyleBlocks(descriptor.styles)
  // Stylelint never runs on a file whose style blocks all failed to parse, so this
  // has to be reported from the template side or it would pass as conforming.
  for (const block of styleBlocks) {
    violations.push({
      ruleId: "unsupported-style-syntax",
      message:
        block.kind === "src"
          ? `Style block loads "${block.value}" through src, so its selectors are never checked; write the styles in the block.`
          : `Style block uses lang="${block.value}", which is not supported; styles must be plain CSS.`,
      line: block.line,
      column: 1,
    })
  }
  const template = descriptor.template?.ast
  if (!template) {
    return {
      childSurfaceRoots: new Set(),
      roleNames,
      styleBlocks,
      surfaceRoots,
      topLayerSurfaces,
      tree: [],
      violations,
    }
  }

  const styledClasses = collectStyledClasses(descriptor.styles)
  const expectedRoots = new Set(
    deriveAllowedSurfaceRootNames(filename, config.surfaceRootPrefixes),
  )
  const classRequired = (name) =>
    config.emitPolicy === "always" || styledClasses.has(name)
  const unitIndex = config.tiers.indexOf("unit") + 1
  const leafIndex = config.tiers.indexOf("g") + 1
  const tree = []
  // An owned child component's root already carries the surface root derived from
  // its own file, and Vue puts this surface's scope id on that same element. So the
  // parent styles the child by that class and passes nothing down.
  const childSurfaceRoot = (tag) =>
    config.surfaceRootPrefixes.map((prefix) => `${prefix}${kebabCase(tag)}`)
  const isOwnedComponent = (node) =>
    node.tagType === COMPONENT &&
    !Object.hasOwn(config.componentClasses, node.tag) &&
    !isTransparentWrapper(node)
  const childSurfaceRoots = new Set()
  // Classes the tables would put on elements this template already has. A rule
  // referencing one of these is not dead — the markup is missing the class, which
  // element-class-required already reports.
  const expectedClasses = new Set()

  function visit(node, depth, nearestStnIndex = null, surfaceContext = null, siblings = tree) {
    if (!node || node.type !== ELEMENT) return

    const info = extractClassInfo(node)
    const staticTokens = new Set(info.staticTokens)
    const allTokens = new Set([...info.staticTokens, ...info.dynamicTokens])
    const staticOwnedTokens = info.staticTokens.filter(
      (token) => !isVariant(token) && !isLibraryInternal(token, config),
    )
    const baseTokens = [
      ...new Set(ownedBaseTokens([...info.staticTokens, ...info.dynamicTokens], config, sets)),
    ]

    if (baseTokens.length > 1) {
      push(
        violations,
        node,
        "single-base-identity",
        `Element has multiple base identity classes: "${baseTokens.join(" ")}"; keep exactly one table-first base and express additional semantics with attributes.`,
      )
    }

    // An owned component tag carries no static class of its own; its anchor is the
    // child's surface root, which exists at runtime.
    if (info.dynamic && staticOwnedTokens.length === 0 && !isOwnedComponent(node)) {
      push(
        violations,
        node,
        "dynamic-class-requires-static-anchor",
        "Dynamic classes may only supplement a static owned class on the same element.",
      )
    }

    const slotSurfaceTokens = info.staticTokens.filter((token) => sets.slotSurfaces.has(token))
    const identityTokens = info.staticTokens.filter(
      (token) =>
        expectedRoots.has(token) ||
        (!isVariant(token) &&
          !STATE_PREFIX_RE.test(token) &&
          !sets.stateClasses.has(token) &&
          !isLibraryInternal(token, config) &&
          !sets.knownNames.has(token) &&
          !sets.banned.has(token) &&
          !sets.slotSurfaces.has(token)),
    )
    const matchingRootTokens = identityTokens.filter((token) => expectedRoots.has(token))
    const requiresSurfacePrefix =
      Array.isArray(config.surfaceRootPrefixes) && config.surfaceRootPrefixes.length > 0
    const isMainRoot =
      depth === 0 &&
      (identityTokens.length > 0 || (requiresSurfacePrefix && staticOwnedTokens.length > 0))
    const isSlotSurface = slotSurfaceTokens.length > 0
    const isSurfaceRoot = isMainRoot || isSlotSurface

    if (isMainRoot) {
      for (const token of matchingRootTokens) {
        surfaceRoots.add(token)
      }
      if (matchingRootTokens.length === 0 || identityTokens.length !== matchingRootTokens.length) {
        const expected = [...expectedRoots].map((token) => `".${token}"`).join(" or ")
        // Fixable when a single wrong identity class stands in for a single
        // derivable root name; anything else needs a decision.
        const wrong = identityTokens.filter((token) => !expectedRoots.has(token))
        const fix =
          expectedRoots.size === 1 && wrong.length === 1 && matchingRootTokens.length === 0
            ? replaceToken(info, wrong[0], [...expectedRoots][0])
            : undefined
        push(
          violations,
          node,
          "surface-root-name",
          `Surface root must be named ${expected} from the configured prefix and Vue file name.`,
          fix,
        )
      }
    }
    if (isSlotSurface) {
      for (const token of slotSurfaceTokens) {
        if (sets.detachedSlotSurfaces.has(token)) surfaceRoots.add(token)
      }
    }

    if (isSurfaceRoot && (node.tag === "dialog" || hasStaticAttr(node, "popover"))) {
      for (const token of [...identityTokens, ...slotSurfaceTokens]) {
        topLayerSurfaces.add(token)
      }
    }

    const role = getStaticAttr(node, "role")
    const acceptsRoleIdentity =
      node.tagType === NATIVE && (node.tag === "div" || node.tag === "span")
    if (acceptsRoleIdentity && role && staticTokens.has(role)) roleNames.add(role)

    for (const token of allTokens) checkState(token, node, sets, violations)

    const staticVariants = info.staticTokens.filter(isVariant)
    if (staticVariants.join("\0") !== [...staticVariants].sort().join("\0")) {
      const sorted = [...staticVariants].sort()
      push(
        violations,
        node,
        "variant-order",
        `Variant classes must be alphabetical: "${sorted.join(" ")}".`,
        rewriteClassFix(info, [...info.staticTokens.filter((token) => !isVariant(token)), ...sorted]),
      )
    }

    // A variant that a binding switches on and off is runtime state by definition,
    // whatever the word is. Blocking the mechanism removes the need for the
    // linter to decide which words mean state.
    for (const token of info.dynamicTokens) {
      if (!isVariant(token)) continue
      push(
        violations,
        node,
        "variant-must-be-static",
        `Variant "${token}" is applied by a binding, so it expresses runtime state; keep variants in the static class attribute and use a native, ARIA, or data attribute for state.`,
      )
    }

    for (const token of allTokens) {
      if (!isVariant(token) || sets.stateClasses.has(token)) continue
      const stem = token.slice(1)
      // A role name is only unavailable as a variant when this element could have
      // used it as its base identity — that is, when it carries that role.
      if (sets.roleVocabulary.has(stem) && !sets.variantShadowNames.has(stem)) {
        if (role === stem) {
          push(
            violations,
            node,
            "variant-shadows-vocabulary",
            `Variant "${token}" names the role this element already declares; use "${stem}" as the base identity instead.`,
          )
        }
        continue
      }
      if (sets.variantShadowNames.has(stem)) {
        push(
          violations,
          node,
          "variant-shadows-vocabulary",
          `Variant "${token}" shadows the vocabulary name "${stem}"; variants modify an anchor, they do not name what it is.`,
        )
      }
    }

    for (const token of allTokens) {
      if (sets.banned.has(token)) {
        push(
          violations,
          node,
          "anatomy-allowed",
          `Class "${token}" is a banned generic anatomy name.`,
        )
      }
    }

    for (const token of allTokens) {
      const isStaticRootIdentity = isMainRoot && identityTokens.includes(token)
      if (!isStaticRootIdentity && !isSlotSurface) {
        const arbitrary =
          !isVariant(token) &&
          !STATE_PREFIX_RE.test(token) &&
          !sets.stateClasses.has(token) &&
          !isLibraryInternal(token, config) &&
          !sets.knownNames.has(token) &&
          !sets.banned.has(token) &&
          !sets.slotSurfaces.has(token)
        if (
          arbitrary &&
          !(acceptsRoleIdentity && token === role && staticTokens.has(token))
        ) {
          push(
            violations,
            node,
            "anatomy-allowed",
            `Class "${token}" is not an element, component, anatomy, STN, slot-surface, or matching role name.`,
          )
        }
      }
    }

    if (
      !isSurfaceRoot &&
      node.tagType === NATIVE &&
      node.tag !== "div" &&
      node.tag !== "span" &&
      Object.hasOwn(config.elementClasses, node.tag)
    ) {
      const required = mappingBase(config.elementClasses[node.tag])
      if (required) expectedClasses.add(required)
      const styledTrigger =
        classRequired(required) || [...allTokens].some((token) => styledClasses.has(token))
      if (required && !staticTokens.has(required) && styledTrigger) {
        const fix = hasOwnedBaseClass(info.staticTokens, config)
          ? undefined
          : buildClassFix(node, info, required)
        push(
          violations,
          node,
          "element-class-required",
          `<${node.tag}> requires the static class "${required}"${config.emitPolicy === "when-styled" ? " because it is styled" : ""}.`,
          fix,
        )
      }
    }

    if (
      !isSurfaceRoot &&
      node.tagType === COMPONENT &&
      Object.hasOwn(config.componentClasses, node.tag)
    ) {
      const required = config.componentClasses[node.tag]
      expectedClasses.add(required)
      if (classRequired(required) && !staticTokens.has(required)) {
        const fix = hasOwnedBaseClass(info.staticTokens, config)
          ? undefined
          : buildClassFix(node, info, required)
        push(
          violations,
          node,
          "component-class-required",
          `<${node.tag}> requires the static class "${required}"${config.emitPolicy === "when-styled" ? " because it is styled" : ""}.`,
          fix,
        )
      }
    }

    if (!isSurfaceRoot) {
      for (const token of allTokens) {
        if (isVariant(token) || isLibraryInternal(token, config)) continue
        if (!sets.renderedElements.has(token)) continue
        // A div/span carrying the matching role keeps the role name as its base
        // identity, even when an element shares that spelling (dialog, menu, …).
        if (acceptsRoleIdentity && token === role && staticTokens.has(token)) continue
        const allowed = sets.elementNameReverse.get(token)
        if (!allowed?.has(node.tag)) {
          push(
            violations,
            node,
            "reserved-element-name",
            `Class "${token}" is reserved for <${token}> or an explicitly mapped element.`,
          )
        }
      }
    }

    const ownedComponent = isOwnedComponent(node)
    const derivedRoots = ownedComponent ? childSurfaceRoot(node.tag) : []
    for (const token of derivedRoots) childSurfaceRoots.add(token)

    if (ownedComponent) {
      const passedThrough = info.staticTokens.filter(
        (token) => !isVariant(token) && !derivedRoots.includes(token),
      )
      if (passedThrough.length > 0) {
        push(
          violations,
          node,
          "owned-component-identity",
          `<${node.tag}> is an owned component: its root already carries "${derivedRoots[0]}", so style it with that class from this surface and remove "${passedThrough.join(" ")}".`,
          rewriteClassFix(
            info,
            info.staticTokens.filter((token) => !passedThrough.includes(token)),
          ),
        )
      }
    }

    // The record a selector chain is checked against. Variants are left out: they
    // are frequently conditional, and matching on them would only add doubt. An
    // owned child carries its derived root at runtime even though nothing is
    // written here.
    const record = {
      children: [],
      classes: [
        ...new Set([...info.staticTokens.filter((token) => !isVariant(token)), ...derivedRoots]),
      ],
      dynamic: info.dynamic,
      opaque: node.tagType === COMPONENT || node.tag === "slot",
      tag: node.tag,
    }
    siblings.push(record)

    const stnToken = [...staticTokens].find((token) => sets.stnIndex.has(token))
    const stnIndex = stnToken ? sets.stnIndex.get(stnToken) : null
    const context = isSurfaceRoot ? { coarse: [], hasLeaf: false } : surfaceContext
    if (stnIndex != null) {
      // Both tiers are computed from the chain, so both are fixable: the floor is
      // `unit`, and a child is one tier finer than its nearest STN ancestor.
      if (nearestStnIndex == null && unitIndex > 0 && stnIndex > unitIndex) {
        push(
          violations,
          node,
          "stn-floor",
          `Outermost STN class "${stnToken}" must be unit or coarser.`,
          replaceToken(info, stnToken, config.tiers[unitIndex - 1]),
        )
      } else if (nearestStnIndex != null && stnIndex !== nearestStnIndex + 1) {
        const expected = config.tiers[nearestStnIndex]
        push(
          violations,
          node,
          "stn-order",
          `STN class "${stnToken}" must be exactly one tier finer than its nearest STN ancestor${expected ? `: "${expected}"` : ""}.`,
          expected ? replaceToken(info, stnToken, expected) : undefined,
        )
      }
      if (context) {
        if (unitIndex > 0 && stnIndex < unitIndex) context.coarse.push({ node, token: stnToken })
        if (leafIndex > 0 && stnIndex === leafIndex) context.hasLeaf = true
      }
    }

    if (node.tag !== "svg" && node.tag !== "math") {
      const childNearest = isSurfaceRoot
        ? null
        : stnIndex != null
          ? stnIndex
          : nearestStnIndex
      const visitChildren = (children, childDepth) => {
        for (const child of children ?? []) {
          if (isTransparentWrapper(child)) visitChildren(child.children, childDepth)
          else visit(child, childDepth, childNearest, context, record.children)
        }
      }
      visitChildren(node.children, depth + 1)
    }

    if (isSurfaceRoot && context?.coarse.length > 0 && !context.hasLeaf) {
      const first = context.coarse[0]
      push(
        violations,
        first.node,
        "stn-reach-g",
        `STN class "${first.token}" is coarser than unit, so this surface must reach the "g" tier.`,
      )
    }
  }

  // A transparent wrapper at the template root keeps the surface root at depth 0.
  const visitRoots = (children) => {
    for (const child of children ?? []) {
      if (child?.type !== ELEMENT) continue
      if (isTransparentWrapper(child)) visitRoots(child.children)
      else visit(child, 0)
    }
  }
  visitRoots(template.children)

  return {
    childSurfaceRoots,
    expectedClasses,
    expectedRoots,
    roleNames,
    styleBlocks,
    surfaceRoots,
    topLayerSurfaces,
    tree,
    violations,
    sourceFile: path.resolve(filename),
  }
}
