import path from "node:path"

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
import { parseTemplateDocument } from "./template-adapters.mjs"

const STATE_PREFIX_RE = /^(?:is-|has-)/
const ELEMENT = 1
const NATIVE = 0
const COMPONENT = 1
const TEMPLATE = 3
const NON_IDENTIFYING_ROLES = new Set(["generic", "none", "presentation"])
const DYNAMIC_BRANCH_DIRECTIVES = new Set(["for", "if", "else-if", "else"])
const LAYOUT_WRAPPER_DISPLAY_VALUES = new Set(["flex", "grid", "inline-flex", "inline-grid"])
const LAYOUT_WRAPPER_PROPERTIES = new Set([
  "align-content",
  "align-items",
  "block-size",
  "column-gap",
  "display",
  "flex",
  "flex-basis",
  "flex-direction",
  "flex-flow",
  "flex-grow",
  "flex-shrink",
  "flex-wrap",
  "gap",
  "grid",
  "grid-auto-columns",
  "grid-auto-flow",
  "grid-auto-rows",
  "grid-template",
  "grid-template-areas",
  "grid-template-columns",
  "grid-template-rows",
  "height",
  "inline-size",
  "justify-content",
  "justify-items",
  "max-block-size",
  "max-height",
  "max-inline-size",
  "max-width",
  "min-block-size",
  "min-height",
  "min-inline-size",
  "min-width",
  "place-content",
  "place-items",
  "row-gap",
  "width",
])

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

function isTransparentWrapper(node, config = {}) {
  return (
    node?.type === ELEMENT &&
    (node.tagType === TEMPLATE ||
      TRANSPARENT_TAGS.has(node.tag) ||
      config.transparentComponents?.includes(node.tag))
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

function hasDynamicBranchDirective(node) {
  return (node?.props ?? []).some(
    (property) =>
      property.type === 7 &&
      DYNAMIC_BRANCH_DIRECTIVES.has(property.name),
  )
}

function reviewSiblingStnVariants(children, violations) {
  const peersByTier = new Map()

  for (const child of children) {
    if (!child.stnToken || child.dynamicBranch) continue
    const peers = peersByTier.get(child.stnToken) ?? []
    peers.push(child)
    peersByTier.set(child.stnToken, peers)
  }

  for (const [tier, peers] of peersByTier) {
    if (peers.length < 2) continue

    for (const peer of peers) {
      const hasUniqueVariant = peer.variants.some((variant) =>
        peers.every((other) => other === peer || !other.variants.includes(variant)),
      )
      if (hasUniqueVariant) continue

      push(
        violations,
        peer,
        "stn-peer-variant",
        `Sibling STN branches share "${tier}"; add a unique static variant to distinguish this branch from its peers.`,
      )
    }
  }
}

function reviewNonStnVariantPeers(tree, violations) {
  const records = []

  function collect(children) {
    for (const child of children ?? []) {
      records.push(child)
      collect(child.children)
    }
  }

  collect(tree)

  const baseCounts = new Map()
  for (const record of records) {
    if (record.baseTokens?.length !== 1) continue
    const [base] = record.baseTokens
    baseCounts.set(base, (baseCounts.get(base) ?? 0) + 1)
  }

  for (const record of records) {
    if (record.stnToken || record.baseTokens?.length !== 1 || record.variants?.length === 0) {
      continue
    }
    const [base] = record.baseTokens
    if ((baseCounts.get(base) ?? 0) > 1) continue

    push(
      violations,
      record,
      "variant-requires-peer",
      `Non-STN base "${base}" has no same-base peer in this component, so ${record.variants.length === 1 ? `variant "${record.variants[0]}" is` : `variants "${record.variants.join(" ")}" are`} redundant; remove the variant${record.variants.length === 1 ? "" : "s"} and select "${base}" through the owned structure.`,
    )
  }
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

// Whether every class name a binding can apply is written out in the expression.
// An identifier, a template literal, or a call hides its result, so no rule can
// see the classes that land on the element.
function isReadableClassExpression(node) {
  if (!node || typeof node !== "object") return false
  if (node.type === "StringLiteral" || node.type === "Literal") {
    return typeof node.value === "string"
  }
  if (node.type === "ArrayExpression") {
    return (node.elements ?? []).every(isReadableClassExpression)
  }
  if (node.type === "ObjectExpression") {
    return (node.properties ?? []).every((property) => {
      if (property.type !== "ObjectProperty" && property.type !== "Property") return false
      if (property.computed) return false
      const key = property.key
      return (
        key?.type === "Identifier" ||
        ((key?.type === "StringLiteral" || key?.type === "Literal") &&
          typeof key.value === "string")
      )
    })
  }
  if (node.type === "ConditionalExpression") {
    return (
      isReadableClassExpression(node.consequent) && isReadableClassExpression(node.alternate)
    )
  }
  return false
}

function extractClassInfo(node) {
  if (node.nagiClassInfo) return node.nagiClassInfo
  const info = {
    dynamic: false,
    dynamicTokens: [],
    opaqueExpressions: [],
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
      if (!isReadableClassExpression(property.exp?.ast)) {
        info.opaqueExpressions.push(property.exp?.content ?? "")
      }
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
        // The CSS parser reports malformed selectors; template requirements remain best-effort.
      }
    })
  }
  return classes
}

// Records declarations against the selector subject only. An ancestor class in
// `.surface > .track > .slide` does not own the slide declarations, while the
// final `.slide` compound does. The wrapper advisory intentionally refuses
// conditional subjects because state, pseudo-elements, and attribute branches
// may make the element more than a layout box.
function collectStyleSubjects(styles) {
  const subjects = []
  for (const style of styles) {
    let root
    try {
      root = postcss.parse(style.content)
    } catch {
      continue
    }
    root.walkRules((rule) => {
      const declarations = (rule.nodes ?? [])
        .filter((node) => node.type === "decl")
        .map((node) => ({ prop: node.prop.toLowerCase(), value: node.value.trim().toLowerCase() }))
      if (declarations.length === 0) return
      const unresolvedOwnerBranch = (rule.nodes ?? []).some(
        (node) =>
          node.type === "atrule" ||
          (node.type === "rule" &&
            node.selector
              .split(",")
              .some((selector) => /^\s*&(?!\s*[>+~])/u.test(selector))),
      )
      try {
        selectorParser((selectors) => {
          selectors.each((selector) => {
            const nodes = selector.nodes ?? []
            let start = 0
            for (const [index, node] of nodes.entries()) {
              if (node.type === "combinator") start = index + 1
            }
            const subject = nodes.slice(start).filter((node) => node.type !== "comment")
            const classes = subject
              .filter((node) => node.type === "class")
              .map((node) => node.value)
            if (classes.length === 0) return
            subjects.push({
              classes,
              conditional:
                unresolvedOwnerBranch ||
                subject.some((node) => node.type !== "class" && node.type !== "nesting"),
              declarations,
            })
          })
        }).processSync(rule.selector)
      } catch {
        // Malformed selectors are reported by style analysis. This advisory
        // stays silent when it cannot identify the declaration owner.
      }
    })
  }
  return subjects
}

function hasOnlyStaticClassAttribute(node, info) {
  if (!info.staticProp || info.dynamic || node.nagiHasNonClassAttribute) return false
  return (node.props ?? []).every(
    (property) => property.type === 6 && property.name === "class",
  )
}

function hasOneVisibleChildBranch(node, config) {
  const branches = []
  let unknown = false
  const collect = (children) => {
    for (const child of children ?? []) {
      if (isTransparentWrapper(child, config)) {
        collect(child.children)
      } else if (child?.type === ELEMENT) {
        branches.push(child)
      } else if (child?.nagiOpaque) {
        unknown = true
      } else if (child?.type === 2 && (child.content ?? "").trim() === "") {
        // Ignore whitespace-only Vue text nodes.
      } else if (child?.type === 3) {
        // Comments do not create a rendered child.
      } else if (child != null) {
        unknown = true
      }
    }
  }
  collect(node.children)
  return !unknown && branches.length === 1
}

function isLayoutOnlyWrapper(node, parent, info, styleSubjects, config) {
  if (node.tagType !== NATIVE || (node.tag !== "div" && node.tag !== "span")) return false
  if (
    !parent ||
    !hasOnlyStaticClassAttribute(node, info) ||
    !hasOneVisibleChildBranch(parent, config) ||
    !hasOneVisibleChildBranch(node, config)
  ) {
    return false
  }

  const tokens = new Set(info.staticTokens)
  const matching = styleSubjects.filter(
    (subject) =>
      subject.classes.length > 0 && subject.classes.every((token) => tokens.has(token)),
  )
  if (matching.length === 0 || matching.some((subject) => subject.conditional)) return false

  const declarations = matching.flatMap((subject) => subject.declarations)
  if (declarations.some(({ prop }) => !LAYOUT_WRAPPER_PROPERTIES.has(prop))) return false
  return declarations.some(
    ({ prop, value }) => prop === "display" && LAYOUT_WRAPPER_DISPLAY_VALUES.has(value),
  )
}

function buildClassFix(node, info, requiredClass) {
  if (info.staticProp) return rewriteClassFix(info, [...info.staticTokens, requiredClass])
  if (node.nagiHasClassAttribute) return undefined
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

export function analyzeTemplate(source, filename, inputConfig = {}) {
  const config = defineNagiConfig(inputConfig)
  const sets = buildNagiSets(config)
  const violations = []
  const surfaceRoots = new Set()
  const roleNames = new Set()
  const topLayerSurfaces = new Set()
  const { descriptor, framework } = parseTemplateDocument(source, filename)
  const styleBlocks = unreadableStyleBlocks(descriptor.styles)
  // A style rule never runs on a block that failed to parse, so this
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
  const styleSubjects = collectStyleSubjects(descriptor.styles)
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
    !node.nagiOpaqueComponent &&
    !Object.hasOwn(config.componentClasses, node.tag) &&
    !isTransparentWrapper(node, config) &&
    !Object.hasOwn(config.intrinsicComponents, node.tag)
  const childSurfaceRoots = new Set()
  const variantUsages = []
  // Classes the tables would put on elements this template already has. A rule
  // referencing one of these is not dead — the markup is missing the class, which
  // element-class-required already reports.
  const expectedClasses = new Set()

  function collectVariantUsage(node) {
    if (!node || node.type !== ELEMENT) return

    const info = extractClassInfo(node)
    const variants = info.staticTokens.filter(isVariant)

    const configuredComponentBase =
      node.tagType === COMPONENT && Object.hasOwn(config.componentClasses, node.tag)
        ? config.componentClasses[node.tag]
        : null
    const derivedRoots = isOwnedComponent(node) ? childSurfaceRoot(node.tag) : []
    const baseTokens = [
      ...new Set([
        ...ownedBaseTokens(info.staticTokens, config, sets),
        ...(configuredComponentBase ? [configuredComponentBase] : []),
        ...derivedRoots,
      ]),
    ]
    const stnToken = info.staticTokens.find((token) => sets.stnIndex.has(token))

    variantUsages.push({
      baseTokens,
      children: [],
      loc: node.loc,
      stnToken,
      variants,
    })
  }

  function visit(
    node,
    depth,
    nearestStnIndex = null,
    surfaceContext = null,
    siblings = tree,
    parent = null,
    inheritedDynamicBranch = false,
  ) {
    if (!node || node.type !== ELEMENT) return

    collectVariantUsage(node)

    const intrinsicTag =
      node.tagType === COMPONENT ? config.intrinsicComponents?.[node.tag] : undefined
    if (intrinsicTag) node = { ...node, tag: intrinsicTag, tagType: NATIVE }
    const configuredComponentBase =
      node.tagType === COMPONENT && Object.hasOwn(config.componentClasses, node.tag)
        ? config.componentClasses[node.tag]
        : null

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

    if (!isSurfaceRoot && isLayoutOnlyWrapper(node, parent, info, styleSubjects, config)) {
      push(
        violations,
        node,
        "layout-only-wrapper",
        `<${node.tag} class="${info.staticTokens.join(" ")}"> is its parent's only visible branch, has no semantic or behavioral attributes, and only establishes flex/grid layout around one child template branch; review whether that layout can move to its parent or child and the wrapper can be removed.`,
      )
    }

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
          `Surface root must be named ${expected} from the configured prefix and ${framework} file name.`,
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
    const identifyingRole =
      acceptsRoleIdentity &&
      role &&
      sets.roleVocabulary.has(role) &&
      !NON_IDENTIFYING_ROLES.has(role)

    if (identifyingRole && !isSurfaceRoot) {
      const staticBaseTokens = ownedBaseTokens(info.staticTokens, config, sets)
      const styledTrigger =
        config.emitPolicy === "always" ||
        styledClasses.has(role) ||
        info.staticTokens.some((token) => styledClasses.has(token))

      if (styledTrigger || staticBaseTokens.length > 0) expectedClasses.add(role)
      if (
        (styledTrigger || staticBaseTokens.length > 0) &&
        !staticTokens.has(role)
      ) {
        const fix =
          staticBaseTokens.length === 1
            ? replaceToken(info, staticBaseTokens[0], role)
            : staticBaseTokens.length === 0
              ? info.staticProp
                ? rewriteClassFix(info, [role, ...info.staticTokens])
                : buildClassFix(node, info, role)
              : undefined
        push(
          violations,
          node,
          "role-identity-required",
          `<${node.tag}> with role="${role}" must use "${role}" as its table-first base identity instead of anatomy or STN.`,
          fix,
        )
      }
    }

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

    // Not a violation: a report of what could not be checked. Every other rule
    // silently skips an element whose classes it cannot read, so say so.
    for (const expression of info.opaqueExpressions) {
      push(
        violations,
        node,
        "unverifiable-dynamic-class",
        `Class binding "${expression}" does not spell out the classes it applies, so none of them are checked on this element; write it as an object with literal keys ({ '-lead': isLead }) to have them verified.`,
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
      if (!sets.banned.has(token)) continue
      push(
        violations,
        node,
        "anatomy-allowed",
        sets.renderedElements.has(token)
          ? `Class "${token}" names a rendering rather than a meaning; use a semantic element such as <strong> or <em>, or a variant on the surrounding element.`
          : `Class "${token}" is a banned generic anatomy name.`,
      )
    }

    for (const token of allTokens) {
      if (isVariant(token) || isLibraryInternal(token, config)) continue
      if (!sets.anatomy.has(token) && !sets.stn.has(token)) continue
      if (
        node.tagType === NATIVE &&
        node.tag !== "div" &&
        node.tag !== "span"
      ) {
        push(
          violations,
          node,
          "anatomy-allowed",
          `Class "${token}" is ${sets.anatomy.has(token) ? "UI Anatomy" : "an STN tier"}; only <div> and <span> use the Semantics model. <${node.tag}> keeps its Element Class Table identity.`,
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
        // Already reported as a banned name, with a message that explains why.
        if (sets.banned.has(token)) continue
        // A div/span carrying the matching role keeps the role name as its base
        // identity, even when an element shares that spelling (dialog, menu, …).
        if (acceptsRoleIdentity && token === role && staticTokens.has(token)) continue

        const owners = sets.elementNameReverse.get(token)
        const requiredForTag =
          node.tagType === NATIVE && Object.hasOwn(config.elementClasses, node.tag)
            ? mappingBase(config.elementClasses[node.tag])
            : ""
        const borrowsMappedIdentity = owners && !owners.has(node.tag)
        const replacesMappedIdentity =
          requiredForTag &&
          token !== requiredForTag &&
          sets.knownNames.has(token) &&
          !sets.anatomy.has(token) &&
          !sets.stn.has(token)

        if (borrowsMappedIdentity || replacesMappedIdentity) {
          push(
            violations,
            node,
            "reserved-element-name",
            owners
              ? `Class "${token}" belongs to ${[...owners].map((tag) => `<${tag}>`).join(" or ")} in the Element Class Table; it cannot identify <${node.tag}>.`
              : `<${node.tag}> uses the Element Class Table identity "${requiredForTag}", not "${token}".`,
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

    const stnToken = [...staticTokens].find(
      (token) =>
        sets.stnIndex.has(token) &&
        !(identifyingRole && token === role),
    )

    // The record a selector chain is checked against. Variants are tracked
    // separately for sibling-role review and left out of base identity matching.
    // An owned child carries its derived root at runtime even though nothing is
    // written here.
    const record = {
      baseTokens: [
        ...new Set([
          ...ownedBaseTokens(info.staticTokens, config, sets),
          ...(configuredComponentBase ? [configuredComponentBase] : []),
          ...derivedRoots,
        ]),
      ],
      children: [],
      classes: [
        ...new Set([...info.staticTokens.filter((token) => !isVariant(token)), ...derivedRoots]),
      ],
      dynamic: info.dynamic,
      dynamicBranch:
        inheritedDynamicBranch || node.nagiDynamicBranch || hasDynamicBranchDirective(node),
      loc: node.loc,
      opaque: node.tagType === COMPONENT || node.tag === "slot" || node.nagiOpaqueComponent,
      stnToken,
      tag: node.tag,
      variants: staticVariants,
    }
    siblings.push(record)

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
      const visitChildren = (children, childDepth, inheritedBranch = false) => {
        for (const child of children ?? []) {
          const dynamicBranch =
            inheritedBranch || child?.nagiDynamicBranch || hasDynamicBranchDirective(child)
          if (child?.nagiOpaque) {
            collectVariantUsage(child)
            record.children.push({
              children: [],
              classes: [],
              dynamic: true,
              dynamicBranch,
              opaque: true,
              tag: "",
            })
          } else if (isTransparentWrapper(child, config)) {
            collectVariantUsage(child)
            visitChildren(child.children, childDepth, dynamicBranch)
          } else {
            visit(
              child,
              childDepth,
              childNearest,
              context,
              record.children,
              node,
              dynamicBranch,
            )
          }
        }
      }
      visitChildren(node.children, depth + 1)
      reviewSiblingStnVariants(record.children, violations)
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
  const visitRoots = (children, inheritedBranch = false) => {
    for (const child of children ?? []) {
      if (child?.type !== ELEMENT) continue
      const dynamicBranch =
        inheritedBranch || child?.nagiDynamicBranch || hasDynamicBranchDirective(child)
      if (isTransparentWrapper(child, config)) {
        collectVariantUsage(child)
        visitRoots(child.children, dynamicBranch)
      } else {
        visit(child, 0, null, null, tree, null, dynamicBranch)
      }
    }
  }
  visitRoots(template.children)
  reviewSiblingStnVariants(tree, violations)
  reviewNonStnVariantPeers(variantUsages, violations)

  return {
    childSurfaceRoots,
    expectedClasses,
    expectedRoots,
    roleNames,
    styleBlocks,
    styles: descriptor.styles,
    surfaceRoots,
    topLayerSurfaces,
    tree,
    violations,
    sourceFile: path.resolve(filename),
  }
}

export function analyzeVueTemplate(source, filename, inputConfig = {}) {
  return analyzeTemplate(source, filename, inputConfig)
}
