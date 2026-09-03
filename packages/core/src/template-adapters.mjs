import { parse as parseVue } from "@vue/compiler-sfc"
import typescriptParser from "@typescript-eslint/parser"
import * as astroParser from "astro-eslint-parser"
import * as svelteParser from "svelte-eslint-parser"

const ELEMENT = 1
const NATIVE = 0
const COMPONENT = 1
const TEMPLATE = 3

function normalizedLoc(node) {
  const range = node?.range ?? [node?.start ?? 0, node?.end ?? 0]
  const start = node?.loc?.start ?? { line: 1, column: 0 }
  const end = node?.loc?.end ?? start
  return {
    start: { line: start.line, column: start.column + 1, offset: range[0] },
    end: { line: end.line, column: end.column + 1, offset: range[1] },
  }
}

function literalTokens(node, output) {
  if (!node || typeof node !== "object") return
  if (
    (node.type === "StringLiteral" || node.type === "Literal") &&
    typeof node.value === "string"
  ) {
    output.push(...node.value.split(/\s+/).filter(Boolean))
    return
  }
  if (node.type === "TemplateLiteral" && (node.expressions?.length ?? 0) === 0) {
    output.push(
      ...(node.quasis?.[0]?.value?.cooked ?? "").split(/\s+/).filter(Boolean),
    )
    return
  }
  if (node.type === "ArrayExpression") {
    for (const element of node.elements ?? []) literalTokens(element, output)
    return
  }
  if (node.type === "ObjectExpression") {
    for (const property of node.properties ?? []) {
      if (property.type !== "ObjectProperty" && property.type !== "Property") continue
      const key = property.key
      if (key?.type === "Identifier" && !property.computed) output.push(key.name)
      else if (
        (key?.type === "StringLiteral" || key?.type === "Literal") &&
        typeof key.value === "string"
      ) {
        output.push(...key.value.split(/\s+/).filter(Boolean))
      }
    }
    return
  }
  if (node.type === "ConditionalExpression") {
    literalTokens(node.consequent, output)
    literalTokens(node.alternate, output)
    return
  }
  if (node.type === "LogicalExpression") {
    if (node.operator !== "&&") literalTokens(node.left, output)
    literalTokens(node.right, output)
  }
}

function readableClassExpression(node) {
  if (!node || typeof node !== "object") return false
  if (node.type === "StringLiteral" || node.type === "Literal") {
    return typeof node.value === "string"
  }
  if (node.type === "TemplateLiteral") return (node.expressions?.length ?? 0) === 0
  if (node.type === "ArrayExpression") {
    return (node.elements ?? []).every(
      (element) => element == null || readableClassExpression(element),
    )
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
      readableClassExpression(node.consequent) &&
      readableClassExpression(node.alternate)
    )
  }
  if (node.type === "LogicalExpression") {
    return node.operator === "&&"
      ? readableClassExpression(node.right)
      : readableClassExpression(node.left) && readableClassExpression(node.right)
  }
  return false
}

function emptyClassInfo() {
  return {
    dynamic: false,
    dynamicTokens: [],
    opaqueExpressions: [],
    staticProp: null,
    staticTokens: [],
  }
}

function expressionSource(source, node) {
  if (!node?.range) return ""
  return source.slice(node.range[0], node.range[1])
}

function addDynamicExpression(info, expression, source) {
  info.dynamic = true
  literalTokens(expression, info.dynamicTokens)
  if (!readableClassExpression(expression)) {
    info.opaqueExpressions.push(expressionSource(source, expression))
  }
}

function makeStaticProperty(name, content, attribute, valueRange) {
  const valueLoc = valueRange
    ? {
        start: {
          line: attribute.loc?.start.line ?? 1,
          column: (attribute.loc?.start.column ?? 0) + 1,
          offset: valueRange[0],
        },
        end: {
          line: attribute.loc?.end.line ?? attribute.loc?.start.line ?? 1,
          column: (attribute.loc?.end.column ?? attribute.loc?.start.column ?? 0) + 1,
          offset: valueRange[1],
        },
      }
    : normalizedLoc(attribute)
  return {
    type: 6,
    name,
    value: { content, loc: valueLoc },
    loc: normalizedLoc(attribute),
  }
}

function transparent(children, node) {
  return {
    type: ELEMENT,
    tagType: TEMPLATE,
    tag: "template",
    props: [],
    children,
    loc: normalizedLoc(node),
  }
}

function opaque(node) {
  return { nagiOpaque: true, loc: normalizedLoc(node) }
}

function svelteName(node) {
  if (!node) return ""
  if (typeof node.name === "string") return node.name
  if (node.type === "Identifier") return node.name
  if (node.type === "MemberExpression") {
    const object = svelteName(node.object)
    const property = svelteName(node.property)
    return object && property ? `${object}.${property}` : object || property
  }
  return ""
}

function svelteStaticAttribute(attribute, source) {
  if (attribute.type !== "SvelteAttribute") return null
  const name = attribute.key?.name
  if (!name) return null
  if (attribute.boolean) return makeStaticProperty(name, "", attribute, attribute.range)
  if (!(attribute.value ?? []).every((value) => value.type === "SvelteLiteral")) return null
  const content = attribute.value.map((value) => value.value).join("")
  const equals = source.indexOf("=", attribute.key.range[1])
  if (equals < 0 || equals >= attribute.range[1]) {
    return makeStaticProperty(name, content, attribute, attribute.range)
  }
  let valueStart = equals + 1
  while (/\s/.test(source[valueStart] ?? "")) valueStart += 1
  return makeStaticProperty(name, content, attribute, [valueStart, attribute.range[1]])
}

function svelteClassInfo(attributes, source, props) {
  const info = emptyClassInfo()
  for (const attribute of attributes) {
    if (attribute.type === "SvelteAttribute" && attribute.key?.name === "class") {
      const staticProperty = svelteStaticAttribute(attribute, source)
      if (staticProperty) {
        props.push(staticProperty)
        info.staticProp = staticProperty
        info.staticTokens = staticProperty.value.content.split(/\s+/).filter(Boolean)
      } else {
        for (const value of attribute.value ?? []) {
          if (value.type === "SvelteMustacheTag") {
            addDynamicExpression(info, value.expression, source)
          }
        }
      }
      continue
    }
    if (attribute.type === "SvelteDirective" && attribute.kind === "Class") {
      info.dynamic = true
      if (attribute.key?.name?.name) info.dynamicTokens.push(attribute.key.name.name)
      continue
    }
    if (attribute.type === "SvelteSpreadAttribute") {
      info.dynamic = true
      info.opaqueExpressions.push(expressionSource(source, attribute.argument))
    }
  }
  return info
}

function normalizeSvelteElement(node, source) {
  const tag = svelteName(node.name)
  const specialTransparent =
    node.kind === "special" &&
    new Set(["svelte:boundary", "svelte:fragment"]).has(tag)
  if (specialTransparent) {
    return transparent(normalizeSvelteChildren(node.children, source), node)
  }
  if (
    node.kind === "special" &&
    new Set([
      "svelte:body",
      "svelte:document",
      "svelte:head",
      "svelte:options",
      "svelte:window",
    ]).has(tag)
  ) {
    return null
  }

  const attributes = node.startTag?.attributes ?? []
  const props = []
  for (const attribute of attributes) {
    if (attribute.type !== "SvelteAttribute" || attribute.key?.name === "class") continue
    const property = svelteStaticAttribute(attribute, source)
    if (property) props.push(property)
  }
  const classInfo = svelteClassInfo(attributes, source, props)
  const dynamicSpecial =
    tag === "svelte:component" || tag === "svelte:element" || tag === "svelte:self"
  return {
    type: ELEMENT,
    tagType: node.kind === "component" || tag === "svelte:component" ? COMPONENT : NATIVE,
    tag,
    props,
    children: normalizeSvelteChildren(node.children, source),
    loc: normalizedLoc(node),
    nagiClassInfo: classInfo,
    nagiHasClassAttribute: attributes.some(
      (attribute) =>
        (attribute.type === "SvelteAttribute" && attribute.key?.name === "class") ||
        attribute.type === "SvelteSpreadAttribute",
    ),
    nagiHasNonClassAttribute: attributes.some(
      (attribute) =>
        !(
          (attribute.type === "SvelteAttribute" && attribute.key?.name === "class") ||
          (attribute.type === "SvelteDirective" && attribute.kind === "Class")
        ),
    ),
    nagiOpaqueComponent: dynamicSpecial,
  }
}

function svelteBlockChildren(node, source) {
  if (node.type === "SvelteAwaitBlock") {
    return normalizeSvelteChildren(
      [
        ...(node.pending?.children ?? []),
        ...(node.then?.children ?? []),
        ...(node.catch?.children ?? []),
      ],
      source,
    )
  }
  return normalizeSvelteChildren(
    [...(node.children ?? []), ...(node.else?.children ?? [])],
    source,
  )
}

function normalizeSvelteChild(node, source) {
  if (node.type === "SvelteElement") return normalizeSvelteElement(node, source)
  if (
    new Set([
      "SvelteAwaitBlock",
      "SvelteEachBlock",
      "SvelteIfBlock",
      "SvelteKeyBlock",
      "SvelteSnippetBlock",
    ]).has(node.type)
  ) {
    return transparent(svelteBlockChildren(node, source), node)
  }
  if (
    node.type === "SvelteRenderTag" ||
    (node.type === "SvelteMustacheTag" &&
      (node.kind === "raw" || node.kind === "render"))
  ) {
    return opaque(node)
  }
  return null
}

function normalizeSvelteChildren(children, source) {
  return (children ?? [])
    .map((node) => normalizeSvelteChild(node, source))
    .filter(Boolean)
}

function staticStyleAttribute(attributes, name) {
  const attribute = attributes.find(
    (candidate) =>
      candidate.type === "SvelteAttribute" &&
      candidate.key?.name === name &&
      candidate.value?.every((value) => value.type === "SvelteLiteral"),
  )
  return attribute?.value?.map((value) => value.value).join("") || undefined
}

function parseSvelteDocument(source, filename) {
  const { ast } = svelteParser.parseForESLint(source, {
    extraFileExtensions: [".svelte"],
    filePath: filename,
    parser: typescriptParser,
  })
  const styles = ast.body
    .filter((node) => node.type === "SvelteStyleElement")
    .map((node) => ({
      content: (node.children ?? []).map((child) => child.value ?? "").join(""),
      contentStart: node.children?.[0]?.range?.[0] ?? node.startTag?.range?.[1],
      lang: staticStyleAttribute(node.startTag?.attributes ?? [], "lang"),
      src: staticStyleAttribute(node.startTag?.attributes ?? [], "src"),
      loc: normalizedLoc(node),
    }))
  return {
    framework: "Svelte",
    descriptor: {
      styles,
      template: {
        ast: {
          children: normalizeSvelteChildren(
            ast.body.filter((node) => node.type !== "SvelteStyleElement"),
            source,
          ),
        },
      },
    },
  }
}

function jsxName(node) {
  if (!node) return ""
  if (node.type === "JSXIdentifier") return node.name
  if (node.type === "JSXMemberExpression") {
    const object = jsxName(node.object)
    const property = jsxName(node.property)
    return object && property ? `${object}.${property}` : object || property
  }
  if (node.type === "JSXNamespacedName") {
    return `${jsxName(node.namespace)}:${jsxName(node.name)}`
  }
  return ""
}

function astroStaticAttribute(attribute) {
  if (attribute.type !== "JSXAttribute") return null
  const name = jsxName(attribute.name)
  if (!name || name.includes(":")) return null
  if (attribute.value == null) {
    return makeStaticProperty(name, "", attribute, attribute.range)
  }
  if (attribute.value.type !== "Literal" || typeof attribute.value.value !== "string") {
    return null
  }
  return makeStaticProperty(name, attribute.value.value, attribute, attribute.value.range)
}

function astroClassInfo(attributes, source, props) {
  const info = emptyClassInfo()
  for (const attribute of attributes) {
    const name = jsxName(attribute.name)
    if (attribute.type === "JSXAttribute" && name === "class") {
      const staticProperty = astroStaticAttribute(attribute)
      if (staticProperty) {
        props.push(staticProperty)
        info.staticProp = staticProperty
        info.staticTokens = staticProperty.value.content.split(/\s+/).filter(Boolean)
      } else if (attribute.value?.type === "JSXExpressionContainer") {
        addDynamicExpression(info, attribute.value.expression, source)
      }
      continue
    }
    if (
      attribute.type === "JSXAttribute" &&
      (name === "class:list" || name === "classList")
    ) {
      addDynamicExpression(
        info,
        attribute.value?.type === "JSXExpressionContainer"
          ? attribute.value.expression
          : attribute.value,
        source,
      )
      continue
    }
    if (attribute.type === "JSXSpreadAttribute") {
      info.dynamic = true
      info.opaqueExpressions.push(expressionSource(source, attribute.argument))
    }
  }
  return info
}

function normalizeAstroExpression(node, source, styles) {
  if (!node || typeof node !== "object") return []
  if (node.type === "JSXElement") {
    const element = normalizeAstroElement(node, source, styles)
    return element ? [element] : []
  }
  if (node.type === "AstroFragment" || node.type === "JSXFragment") {
    return normalizeAstroChildren(node.children, source, styles)
  }
  if (node.type === "ConditionalExpression") {
    return [
      ...normalizeAstroExpression(node.consequent, source, styles),
      ...normalizeAstroExpression(node.alternate, source, styles),
    ]
  }
  if (node.type === "LogicalExpression") {
    return [
      ...normalizeAstroExpression(node.left, source, styles),
      ...normalizeAstroExpression(node.right, source, styles),
    ]
  }
  if (node.type === "ArrayExpression") {
    return (node.elements ?? []).flatMap((element) =>
      normalizeAstroExpression(element, source, styles),
    )
  }
  if (node.type === "CallExpression") return [opaque(node)]
  return []
}

function normalizeAstroChild(node, source, styles) {
  if (node.type === "JSXElement") return normalizeAstroElement(node, source, styles)
  if (node.type === "AstroFragment" || node.type === "JSXFragment") {
    return transparent(normalizeAstroChildren(node.children, source, styles), node)
  }
  if (node.type === "JSXExpressionContainer") {
    return transparent(normalizeAstroExpression(node.expression, source, styles), node)
  }
  return null
}

function normalizeAstroChildren(children, source, styles) {
  return (children ?? [])
    .map((node) => normalizeAstroChild(node, source, styles))
    .filter(Boolean)
}

function astroStyleAttribute(attributes, name) {
  const attribute = attributes.find(
    (candidate) => candidate.type === "JSXAttribute" && jsxName(candidate.name) === name,
  )
  return attribute?.value?.type === "Literal" && typeof attribute.value.value === "string"
    ? attribute.value.value
    : undefined
}

function normalizeAstroElement(node, source, styles) {
  const opening = node.openingElement
  const tag = jsxName(opening?.name)
  const attributes = opening?.attributes ?? []
  if (tag === "style") {
    styles.push({
      content: (node.children ?? []).map((child) => child.value ?? child.raw ?? "").join(""),
      contentStart: node.children?.[0]?.range?.[0] ?? opening?.range?.[1],
      lang: astroStyleAttribute(attributes, "lang"),
      src: astroStyleAttribute(attributes, "src"),
      loc: normalizedLoc(node),
    })
    return null
  }
  if (tag === "Fragment") {
    return transparent(normalizeAstroChildren(node.children, source, styles), node)
  }
  const props = []
  for (const attribute of attributes) {
    const name = jsxName(attribute.name)
    if (name === "class" || name === "class:list" || name === "classList") continue
    const property = astroStaticAttribute(attribute)
    if (property) props.push(property)
  }
  const classInfo = astroClassInfo(attributes, source, props)
  const rawHtml = attributes.some(
    (attribute) =>
      attribute.type === "JSXAttribute" && jsxName(attribute.name) === "set:html",
  )
  const component = /^[A-Z]/.test(tag) || tag.includes(".")
  return {
    type: ELEMENT,
    tagType: component ? COMPONENT : NATIVE,
    tag,
    props,
    children: [
      ...normalizeAstroChildren(node.children, source, styles),
      ...(rawHtml ? [opaque(node)] : []),
    ],
    loc: normalizedLoc(node),
    nagiClassInfo: classInfo,
    nagiHasClassAttribute: attributes.some((attribute) => {
      const name = jsxName(attribute.name)
      return (
        name === "class" ||
        attribute.type === "JSXSpreadAttribute"
      )
    }),
    nagiHasNonClassAttribute: attributes.some((attribute) => {
      const name = jsxName(attribute.name)
      return !new Set(["class", "class:list", "classList"]).has(name)
    }),
  }
}

function parseAstroDocument(source, filename) {
  const { ast } = astroParser.parseForESLint(source, {
    filePath: filename,
    parser: typescriptParser,
  })
  const styles = []
  const fragments = ast.body.filter((node) => node.type === "AstroFragment")
  return {
    framework: "Astro",
    descriptor: {
      styles,
      template: {
        ast: {
          children: fragments.map((fragment) =>
            transparent(normalizeAstroChildren(fragment.children, source, styles), fragment),
          ),
        },
      },
    },
  }
}

export function frameworkForFilename(filename) {
  if (filename.toLowerCase().endsWith(".svelte")) return "svelte"
  if (filename.toLowerCase().endsWith(".astro")) return "astro"
  return "vue"
}

export function parseTemplateDocument(source, filename) {
  const framework = frameworkForFilename(filename)
  if (framework === "svelte") return parseSvelteDocument(source, filename)
  if (framework === "astro") return parseAstroDocument(source, filename)
  const { descriptor } = parseVue(source, { filename })
  return { descriptor, framework: "Vue" }
}

export { astroParser, svelteParser, typescriptParser }
