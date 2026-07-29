import fs from "node:fs"
import path from "node:path"

import postcssHtml from "postcss-html"
import selectorParser from "postcss-selector-parser"
import stylelint from "stylelint"

import {
  analyzeVueTemplate,
  buildNagiSets,
  defineNagiConfig,
  matchSelectorChain,
  matchesClassPrefix,
  resolveSeverity,
  validateNagiConfig,
} from "@nagi-labs/nagi-css-core"

const ruleIds = [
  "anatomy-allowed",
  "bare-element-selector",
  "boundary-nesting",
  "dead-rule",
  "owned-dom-direct-child",
  "selector-mirrors-template",
  "single-base-identity",
  "slot-surface-top-level",
  "state-not-class",
  "surface-external-layout",
  "top-level-surface-only",
  "valid-config",
  "variant-shadows-vocabulary",
]

const EXTERNAL_LAYOUT_PROPS = new Set([
  "position", "top", "right", "bottom", "left", "inset", "margin",
])

function isExternalLayoutProp(prop) {
  const name = prop.toLowerCase()
  return (
    EXTERNAL_LAYOUT_PROPS.has(name) ||
    name.startsWith("margin-") ||
    name.startsWith("inset-")
  )
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

function findInputFile(root, fallback) {
  let filename = root.source?.input.file
  if (filename) return filename
  // A document whose style blocks were never parsed has no rules to ask, so fall
  // back to the name Stylelint was given.
  for (const node of root.nodes ?? []) {
    filename ??= node.source?.input.file
  }
  root.walkRules((rule) => {
    filename ??= rule.source?.input.file
  })
  return filename ?? fallback
}

const emptyTemplateContext = () => ({
  roleNames: new Set(),
  styleBlocks: [],
  surfaceRoots: new Set(),
  topLayerSurfaces: new Set(),
})

function readTemplateContext(root, config, fallbackFile) {
  const filename = findInputFile(root, fallbackFile)
  if (!filename || path.extname(filename) !== ".vue") return emptyTemplateContext()
  try {
    return analyzeVueTemplate(fs.readFileSync(filename, "utf8"), filename, config)
  } catch {
    return emptyTemplateContext()
  }
}

function analyzeStyles(root, inputConfig, fallbackFile) {
  const config = defineNagiConfig(inputConfig)
  const sets = buildNagiSets(config)
  const {
    expectedClasses = new Set(),
    roleNames,
    surfaceRoots,
    topLayerSurfaces = new Set(),
    tree = [],
  } = readTemplateContext(root, config, fallbackFile)
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

  function checkEdge(rule, combinator, left, right, parentEndsInBoundary = false) {
    // Sibling combinators express order among siblings, not a parent/child step,
    // so the direct-child requirement does not apply to them.
    if (combinator === "+" || combinator === "~") return
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

  function ownDeclsAnchored(container) {
    let anchored = false
    container.each?.((node) => {
      if (node.type === "decl" && isAnchorPlacementProp(node.prop)) anchored = true
      else if (node.type === "atrule" && ownDeclsAnchored(node)) anchored = true
    })
    return anchored
  }

  function checkSurfaceLayout(rule, token) {
    if (!token || topLayerSurfaces.has(token)) return
    if (ownDeclsAnchored(rule)) return
    const walkOwnDecls = (container) => {
      container.each?.((node) => {
        if (node.type === "decl") {
          if (isExternalLayoutProp(node.prop)) {
            report(
              node,
              "surface-external-layout",
              `Surface ".${token}" must not own external layout; "${node.prop}" belongs to the parent layout.`,
              node.prop,
            )
          }
        } else if (node.type === "atrule") {
          walkOwnDecls(node)
        }
      })
    }
    walkOwnDecls(rule)
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
      surfaceSubject ??= surfaceSubjectToken(compounds)
      const chain = extendChain([], compounds, combinators, ">")
      ruleChain ??= chain
      checkMirror(rule, chain)
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
            `Top-level selector ".${token}" is not a surface root in this Vue template.`,
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
      for (let index = 1; index < compounds.length; index += 1) {
        checkEdge(rule, combinators[index - 1], compounds[index - 1], compounds[index])
        checkBareElements(rule, compounds[index])
        checkAnatomy(rule, compounds[index])
      }
    }
    checkSurfaceLayout(rule, surfaceSubject)
    walkNested(rule, alternativesEndInBoundary(alternatives), surfaceSubject, ruleChain)
  }

  function processNested(rule, parentEndsInBoundary, parentSurfaceToken = null, parentChain = null) {
    let alternatives
    try {
      alternatives = selectorAlternatives(rule.selector)
    } catch {
      walkNested(rule, parentEndsInBoundary)
      return
    }
    let surfaceSubject = null
    let ruleChain = null
    for (const nodes of alternatives) {
      const { combinator, mode, rest } = resolveNesting(nodes)
      const { combinators, compounds } = splitCompounds(rest)
      if (compounds.length === 0) continue
      const chain = extendChain(
        parentChain,
        compounds,
        combinators,
        mode === "merge" ? "merge" : combinator,
      )
      ruleChain ??= chain
      checkMirror(rule, chain)
      checkFlattenedBoundary(rule, compounds)
      if (mode === "merge") {
        if (compounds.length === 1) surfaceSubject ??= parentSurfaceToken
        checkAnatomy(rule, compounds[0])
      } else {
        checkEdge(rule, combinator, null, compounds[0], parentEndsInBoundary)
        checkBareElements(rule, compounds[0])
        checkAnatomy(rule, compounds[0])
      }
      for (let index = 1; index < compounds.length; index += 1) {
        checkEdge(rule, combinators[index - 1], compounds[index - 1], compounds[index])
        checkBareElements(rule, compounds[index])
        checkAnatomy(rule, compounds[index])
      }
    }
    checkSurfaceLayout(rule, surfaceSubject)
    walkNested(
      rule,
      alternativesEndInBoundary(alternatives, parentEndsInBoundary, true),
      surfaceSubject,
      ruleChain,
    )
  }

  function walkNested(container, parentEndsInBoundary, parentSurfaceToken = null, parentChain = null) {
    container.each?.((node) => {
      if (node.type === "rule") {
        processNested(node, parentEndsInBoundary, parentSurfaceToken, parentChain)
      } else if (node.type === "atrule") {
        walkNested(node, parentEndsInBoundary, parentSurfaceToken, parentChain)
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
  return violations
}

function cachedAnalysis(root, config, fallbackFile) {
  let analyses = analysisCache.get(root)
  if (!analyses) {
    analyses = new Map()
    analysisCache.set(root, analyses)
  }
  const key = JSON.stringify(config)
  if (!analyses.has(key)) analyses.set(key, analyzeStyles(root, config, fallbackFile))
  return analyses.get(key)
}

function createRule(ruleId) {
  const ruleName = `nagi-css/${ruleId}`
  return stylelint.createPlugin(ruleName, (enabled, options = {}) => {
    return (root, result) => {
      if (!enabled) return
      // `severity` is Stylelint's own secondary option; keep it out of the
      // semantic config so every rule shares one cached analysis.
      const { severity: _severity, ...semanticOptions } = options
      const config = defineNagiConfig(semanticOptions)
      if (ruleId === "valid-config") {
        for (const message of validateNagiConfig(config)) {
          stylelint.utils.report({
            message: `Invalid Nagi CSS configuration: ${message}.`,
            node: root,
            result,
            ruleName,
          })
        }
        return
      }
      for (const violation of cachedAnalysis(root, config, result.opts?.from)) {
        if (violation.ruleId !== ruleId) continue
        stylelint.utils.report({
          message: violation.message,
          node: violation.node,
          result,
          ruleName,
          word: violation.word,
        })
      }
    }
  })
}

const plugins = Object.fromEntries(ruleIds.map((ruleId) => [ruleId, createRule(ruleId)]))

export function createNagiStylelintConfig(config, severity = {}) {
  const semantic = defineNagiConfig(config)
  const levelFor = resolveSeverity(severity)
  return {
    customSyntax: postcssHtml,
    plugins: Object.values(plugins),
    rules: Object.fromEntries(
      ruleIds
        .map((ruleId) => [ruleId, levelFor(ruleId)])
        .filter(([, level]) => level !== "off")
        .map(([ruleId, level]) => [
          `nagi-css/${ruleId}`,
          level === "warn" ? [true, { ...semantic, severity: "warning" }] : [true, semantic],
        ]),
    ),
  }
}

export { plugins, ruleIds }
export default Object.values(plugins)
