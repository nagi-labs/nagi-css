const ELEMENT_CLASSES = {
  a: "link",
  article: "article",
  aside: "aside",
  body: "body",
  button: "button",
  caption: "caption",
  dd: "definition",
  dl: "list",
  dt: "term",
  figcaption: "figcaption",
  figure: "figure",
  footer: "footer",
  h1: "title",
  h2: "title",
  h3: "title",
  h4: "title",
  h5: "title",
  h6: "title",
  header: "header",
  img: "image",
  input: "input",
  label: "label",
  li: "item",
  main: "main",
  nav: "nav",
  ol: "list",
  p: "text",
  section: "section",
  small: "note",
  svg: "svg",
  table: "table",
  tbody: "rowgroup",
  td: "cell",
  tfoot: "rowgroup -foot",
  th: "cell -head",
  thead: "rowgroup -head",
  time: "time",
  tr: "row",
  ul: "list",
}

const RENDERED_ELEMENTS = [
  "a", "abbr", "address", "area", "article", "aside", "audio", "b", "bdi", "bdo",
  "blockquote", "body", "button", "canvas", "caption", "cite", "code", "col", "colgroup", "data",
  "datalist", "dd", "del", "details", "dfn", "dialog", "div", "dl", "dt", "em", "embed",
  "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5",
  "h6", "header", "hgroup", "hr", "i", "iframe", "img", "input", "ins", "kbd", "label",
  "legend", "li", "main", "map", "mark", "menu", "meter", "nav", "object", "ol", "optgroup",
  "option", "output", "p", "picture", "pre", "progress", "q", "rp", "rt", "ruby", "s",
  "samp", "section", "select", "slot", "small", "source", "span", "strong", "sub", "summary",
  "sup", "table", "tbody", "td", "textarea", "tfoot", "th", "thead", "time", "tr", "track",
  "u", "ul", "var", "video", "wbr",
]

// Concrete WAI-ARIA roles are protocol vocabulary: they may be base names on
// div/span when backed by a matching role attribute, but never variants.
const ARIA_ROLE_NAMES = [
  "alert", "alertdialog", "application", "article", "banner", "blockquote", "button",
  "caption", "cell", "checkbox", "code", "columnheader", "combobox", "complementary",
  "contentinfo", "definition", "deletion", "dialog", "directory", "document", "emphasis",
  "feed", "figure", "form", "generic", "grid", "gridcell", "group", "heading", "img",
  "insertion", "link", "list", "listbox", "listitem", "log", "main", "marquee", "math",
  "menu", "menubar", "menuitem", "menuitemcheckbox", "menuitemradio", "meter", "navigation",
  "none", "note", "option", "paragraph", "presentation", "progressbar", "radio", "radiogroup",
  "region", "row", "rowgroup", "rowheader", "scrollbar", "search", "searchbox", "separator",
  "slider", "spinbutton", "status", "strong", "subscript", "suggestion", "superscript", "switch",
  "tab", "table", "tablist", "tabpanel", "term", "textbox", "time", "timer", "toolbar",
  "tooltip", "tree", "treegrid", "treeitem",
]

// The table lists only meaning-bearing overrides; every other rendered
// element self-maps so no element is left without a legal class.
for (const tag of RENDERED_ELEMENTS) {
  if (tag !== "div" && tag !== "span" && !(tag in ELEMENT_CLASSES)) {
    ELEMENT_CLASSES[tag] = tag
  }
}

const DEFAULT_CONFIG = Object.freeze({
  anatomyClasses: ["actions", "field", "icon", "media", "value"],
  bannedClasses: ["box", "container", "content-area", "inner", "thing", "wrapper"],
  componentClassPrefix: "pv-",
  componentClasses: {},
  componentSlotPrefixes: {},
  componentSlots: {},
  detachedSlotSurfaces: [],
  elementClasses: ELEMENT_CLASSES,
  emitPolicy: "when-styled",
  libraryBoundaryPrefixes: [],
  libraryInternalPrefixes: [],
  stateClasses: [
    "-active", "-busy", "-checked", "-disabled", "-error", "-expanded", "-hidden",
    "-invalid", "-loading", "-open", "-pressed", "-selected", "-success",
  ],
  surfaceRootPrefixes: [],
  tiers: ["stratum", "region", "block", "zone", "seg", "fr", "g"],
})

function unique(values) {
  return [...new Set(values)]
}

function normalizeArray(value, fallback) {
  const resolved = value ?? fallback
  return Array.isArray(resolved) ? unique(resolved) : resolved
}

function derivedComponentClass(component, prefix) {
  const name = kebabCase(component)
  return name.startsWith(prefix) ? name : `${prefix}${name}`
}

function normalizeComponentClasses(componentClasses, prefix) {
  const entries = Array.isArray(componentClasses)
    ? componentClasses.map((component) => [component, null])
    : Object.entries(componentClasses ?? {})

  return Object.fromEntries(
    entries.map(([component, className]) => [
      component,
      typeof className === "string" && className.length > 0
        ? className
        : derivedComponentClass(component, prefix),
    ]),
  )
}

export function defineNagiConfig(config = {}) {
  const componentClassPrefix = config.componentClassPrefix ?? DEFAULT_CONFIG.componentClassPrefix
  return {
    ...DEFAULT_CONFIG,
    ...config,
    anatomyClasses: unique(config.anatomyClasses ?? DEFAULT_CONFIG.anatomyClasses),
    bannedClasses: unique(config.bannedClasses ?? DEFAULT_CONFIG.bannedClasses),
    componentClassPrefix,
    componentClasses: normalizeComponentClasses(config.componentClasses, componentClassPrefix),
    componentSlotPrefixes: {
      ...DEFAULT_CONFIG.componentSlotPrefixes,
      ...config.componentSlotPrefixes,
    },
    componentSlots: { ...DEFAULT_CONFIG.componentSlots, ...config.componentSlots },
    detachedSlotSurfaces: unique(
      config.detachedSlotSurfaces ?? DEFAULT_CONFIG.detachedSlotSurfaces,
    ),
    elementClasses: { ...DEFAULT_CONFIG.elementClasses, ...config.elementClasses },
    libraryBoundaryPrefixes: unique(
      config.libraryBoundaryPrefixes ?? DEFAULT_CONFIG.libraryBoundaryPrefixes,
    ),
    libraryInternalPrefixes: unique(
      config.libraryInternalPrefixes ?? DEFAULT_CONFIG.libraryInternalPrefixes,
    ),
    stateClasses: unique(config.stateClasses ?? DEFAULT_CONFIG.stateClasses),
    surfaceRootPrefixes: normalizeArray(
      config.surfaceRootPrefixes,
      DEFAULT_CONFIG.surfaceRootPrefixes,
    ),
    tiers: unique(config.tiers ?? DEFAULT_CONFIG.tiers),
  }
}

export function matchesClassPrefix(value, prefixes = []) {
  return prefixes.some((prefix) =>
    prefix.endsWith("-")
      ? value.startsWith(prefix)
      : value === prefix || value.startsWith(`${prefix}-`),
  )
}

export function slotSurfaces(config) {
  return new Set(
    Object.values(config.componentSlots ?? {}).flatMap((slots) => Object.values(slots)),
  )
}

export function mappingBase(value) {
  return value.split(/\s+/, 1)[0]
}

export function mappingTokens(value) {
  return value.split(/\s+/).filter(Boolean)
}

export function buildNagiSets(input) {
  const config = defineNagiConfig(input)
  const elementValues = new Set(
    Object.values(config.elementClasses).map((value) => mappingBase(value)),
  )
  const componentValues = new Set(Object.values(config.componentClasses))
  const anatomy = new Set(config.anatomyClasses)
  const stn = new Set(config.tiers)
  const elementNameReverse = new Map()

  for (const [tag, name] of [
    ...Object.entries(config.elementClasses),
    ...Object.entries(config.componentClasses),
  ]) {
    const base = mappingBase(name)
    if (!elementNameReverse.has(base)) elementNameReverse.set(base, new Set())
    elementNameReverse.get(base).add(tag)
  }

  const fixedVariantBases = new Map()
  const addFixedVariant = (variant, base) => {
    if (!fixedVariantBases.has(variant)) fixedVariantBases.set(variant, new Set())
    fixedVariantBases.get(variant).add(base)
  }
  for (const value of Object.values(config.elementClasses)) {
    const [base, ...variants] = mappingTokens(value)
    for (const variant of variants) addFixedVariant(variant, base)
  }

  const surfaces = slotSurfaces(config)

  return {
    anatomy,
    banned: new Set(config.bannedClasses),
    componentValues,
    detachedSlotSurfaces: new Set(config.detachedSlotSurfaces),
    elementNameReverse,
    elementValues,
    fixedVariantBases,
    knownNames: new Set([...elementValues, ...componentValues, ...anatomy, ...stn]),
    renderedElements: new Set(RENDERED_ELEMENTS),
    roleVocabulary: new Set(ARIA_ROLE_NAMES),
    slotSurfaces: surfaces,
    stateClasses: new Set(config.stateClasses),
    stn,
    stnIndex: new Map(config.tiers.map((name, index) => [name, index + 1])),
    variantShadowNames: new Set([
      ...elementValues,
      ...componentValues,
      ...anatomy,
      ...stn,
      ...surfaces,
      ...config.bannedClasses,
      ...RENDERED_ELEMENTS,
      ...ARIA_ROLE_NAMES,
    ]),
  }
}

export function validateNagiConfig(config) {
  const errors = []
  if (!['always', 'when-styled'].includes(config.emitPolicy)) {
    errors.push('emitPolicy must be "always" or "when-styled"')
  }
  if (typeof config.componentClassPrefix !== "string" || !config.componentClassPrefix) {
    errors.push("componentClassPrefix must be a non-empty string")
  }
  if (!Array.isArray(config.surfaceRootPrefixes)) {
    errors.push("surfaceRootPrefixes must be an array")
  } else if (config.surfaceRootPrefixes.length === 0) {
    errors.push("surfaceRootPrefixes must contain at least one prefix")
  } else {
    for (const prefix of config.surfaceRootPrefixes) {
      if (typeof prefix !== "string" || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*-$/.test(prefix)) {
        errors.push(
          `surfaceRootPrefixes entries must be lowercase kebab prefixes ending in "-"; received "${prefix}"`,
        )
      }
    }
  }

  for (const [component, slots] of Object.entries(config.componentSlots ?? {})) {
    const owner = config.componentSlotPrefixes?.[component] ?? config.componentClasses?.[component]
    if (!owner) {
      errors.push(
        `componentSlots.${component} requires componentSlotPrefixes.${component} or componentClasses.${component}`,
      )
      continue
    }
    for (const [slot, surface] of Object.entries(slots)) {
      if (!surface.startsWith(`${owner}-`)) {
        errors.push(
          `componentSlots.${component}.${slot} must start with "${owner}-"; received "${surface}"`,
        )
      }
    }
  }
  return errors
}

export function kebabCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase()
}

export function deriveSurfaceRootName(filename) {
  const normalized = filename.replaceAll("\\", "/")
  const parts = normalized.split("/")
  const basename = parts.at(-1)?.replace(/\.vue$/, "") ?? ""
  if (parts.includes("components")) return kebabCase(basename)
  if (!parts.includes("pages")) return kebabCase(basename)

  let name = basename
  if (name === "index" || name.startsWith("[")) {
    name = [...parts.slice(0, -1)]
      .reverse()
      .find((part) => part && part !== "pages" && !part.startsWith("[")) ?? basename
  }
  return `${kebabCase(name)}-page`
}

export function deriveAllowedSurfaceRootNames(filename, prefixes = []) {
  const name = deriveSurfaceRootName(filename)
  return Array.isArray(prefixes) && prefixes.length > 0
    ? unique(prefixes.map((prefix) => `${prefix}${name}`))
    : [name]
}

export { DEFAULT_CONFIG, ELEMENT_CLASSES, RENDERED_ELEMENTS }
export { analyzeVueTemplate } from "./template-analysis.mjs"
