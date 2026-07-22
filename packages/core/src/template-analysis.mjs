import path from "node:path"

import { parse } from "@vue/compiler-sfc"
import postcss from "postcss"
import selectorParser from "postcss-selector-parser"

import {
  buildNagiSets,
  defineNagiConfig,
  deriveAllowedSurfaceRootNames,
  mappingTokens,
  matchesClassPrefix,
} from "./index.mjs"

const STATE_PREFIX_RE = /^(?:is-|has-)/
const ELEMENT = 1
const NATIVE = 0
const COMPONENT = 1

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
  if (info.staticProp) {
    const value = info.staticProp.value
    return {
      range: [value.loc.start.offset, value.loc.end.offset],
      text: `"${value.content} ${requiredClass}"`,
    }
  }
  const offset = node.loc.start.offset + 1 + node.tag.length
  return { range: [offset, offset], text: ` class="${requiredClass}"` }
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
  const template = descriptor.template?.ast
  if (!template) return { roleNames, surfaceRoots, topLayerSurfaces, violations }

  const styledClasses = collectStyledClasses(descriptor.styles)
  const expectedRoots = new Set(
    deriveAllowedSurfaceRootNames(filename, config.surfaceRootPrefixes),
  )
  const classRequired = (name) =>
    config.emitPolicy === "always" || styledClasses.has(name)
  const unitIndex = config.tiers.indexOf("unit") + 1
  const leafIndex = config.tiers.indexOf("g") + 1

  function visit(node, depth, nearestStnIndex = null, surfaceContext = null) {
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

    if (info.dynamic && staticOwnedTokens.length === 0) {
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
        push(
          violations,
          node,
          "surface-root-name",
          `Surface root must be named ${expected} from the configured prefix and Vue file name.`,
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
      push(
        violations,
        node,
        "variant-order",
        `Variant classes must be alphabetical: "${[...staticVariants].sort().join(" ")}".`,
      )
    }

    for (const token of allTokens) {
      if (!isVariant(token) || sets.stateClasses.has(token)) continue
      const stem = token.slice(1)
      const pairedBases = sets.fixedVariantBases.get(token)
      if (
        !sets.roleVocabulary.has(stem) &&
        pairedBases &&
        [...pairedBases].some((base) => staticTokens.has(base))
      ) {
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
      const required = config.elementClasses[node.tag]
      const requiredTokens = mappingTokens(required)
      const missing = requiredTokens.filter((token) => !staticTokens.has(token))
      const styledTrigger =
        requiredTokens.some((token) => classRequired(token)) ||
        [...allTokens].some((token) => styledClasses.has(token))
      const partialCarry =
        requiredTokens.length > 1 && staticTokens.has(requiredTokens[0])
      if (missing.length > 0 && (styledTrigger || partialCarry)) {
        const fix = hasOwnedBaseClass(info.staticTokens, config)
          ? undefined
          : buildClassFix(node, info, required)
        push(
          violations,
          node,
          "element-class-required",
          `<${node.tag}> requires the static class "${required}"${config.emitPolicy === "when-styled" && !partialCarry ? " because it is styled" : ""}.`,
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

    const stnToken = [...staticTokens].find((token) => sets.stnIndex.has(token))
    const stnIndex = stnToken ? sets.stnIndex.get(stnToken) : null
    const context = isSurfaceRoot ? { coarse: [], hasLeaf: false } : surfaceContext
    if (stnIndex != null) {
      if (nearestStnIndex == null && unitIndex > 0 && stnIndex > unitIndex) {
        push(
          violations,
          node,
          "stn-floor",
          `Outermost STN class "${stnToken}" must be unit or coarser.`,
        )
      } else if (nearestStnIndex != null && stnIndex !== nearestStnIndex + 1) {
        push(
          violations,
          node,
          "stn-order",
          `STN class "${stnToken}" must be exactly one tier finer than its nearest STN ancestor.`,
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
      for (const child of node.children ?? []) {
        const transparent =
          child.type === ELEMENT && (child.tagType === 3 || child.tag === "slot")
        if (transparent) {
          for (const grandchild of child.children ?? []) {
            visit(grandchild, depth + 1, childNearest, context)
          }
        } else {
          visit(child, depth + 1, childNearest, context)
        }
      }
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

  for (const child of template.children ?? []) {
    if (child.type === ELEMENT) visit(child, 0)
  }

  return {
    expectedRoots,
    roleNames,
    surfaceRoots,
    topLayerSurfaces,
    violations,
    sourceFile: path.resolve(filename),
  }
}
