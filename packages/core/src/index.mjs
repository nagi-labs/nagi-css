import parseValue from "postcss-value-parser"

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
  td: "cell",
  th: "cell",
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

// Elements the table deliberately leaves without a class of their own.
// div/span carry no meaning to begin with and go to the Semantics model.
// b/i/u/s name a rendering, not a meaning, so self-mapping them would hand out
// `.b` and `.i` — exactly the "raw visual appearance" the contract rejects.
// A styled one has no legal class, which is the pressure to use <strong>/<em>;
// an unstyled one in prose needs no class and is untouched.
const UNMAPPED_ELEMENTS = new Set(["b", "div", "i", "s", "span", "u"])

// The table lists only meaning-bearing overrides; every other rendered
// element self-maps so no element is left without a legal class.
for (const tag of RENDERED_ELEMENTS) {
  if (!UNMAPPED_ELEMENTS.has(tag) && !(tag in ELEMENT_CLASSES)) {
    ELEMENT_CLASSES[tag] = tag
  }
}

const DEFAULT_CONFIG = Object.freeze({
  anatomyClasses: ["actions", "field", "icon", "media", "value"],
  bannedClasses: [
    "b", "box", "container", "content-area", "i", "inner", "s", "thing", "u", "wrapper",
  ],
  componentClassPrefix: "pv-",
  componentClasses: {},
  componentSlotPrefixes: {},
  componentSlots: {},
  detachedSlotSurfaces: [],
  elementClasses: ELEMENT_CLASSES,
  emitPolicy: "when-styled",
  libraryBoundaryPrefixes: [],
  libraryInternalPrefixes: [],
  // A cheap catch for the obvious static spellings. Words that double as a tone
  // (`-success`, `-error`) are deliberately absent: they are legitimate style
  // variants, and the genuinely stateful use is caught by being dynamic.
  stateClasses: [
    "-active", "-busy", "-checked", "-disabled", "-expanded", "-hidden",
    "-invalid", "-loading", "-open", "-pressed", "-selected",
  ],
  surfaceRootPrefixes: [],
  tiers: ["stratum", "region", "block", "unit", "seg", "fr", "g"],
  // Nagi CSS ships no tokens: design values belong to the design system, not to a
  // naming contract. It checks the boundary instead — that a referenced token was
  // declared somewhere the project pointed at, and which layer it came from.
  // Both checks are inactive until `sources` names at least one file.
  tokens: {
    exposedPrefixes: [],
    localPrefix: "--local-",
    sources: [],
  },
})

const TOKEN_LAYERS = ["primitive", "semantic"]

// Custom properties a stylesheet declares. Used on token sources, which are read
// as data and never linted.
export function parseTokenDeclarations(css) {
  const names = new Set()
  for (const [, , name] of css.matchAll(/(^|[;{]|\*\/)\s*(--[\w-]+)\s*:/g)) {
    names.add(name)
  }
  return names
}

export function tokenReferences(value) {
  return [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map(([, name]) => name)
}

// CSS named colors, minus `transparent` and `currentcolor`: a literal name is a
// literal color, and `rebeccapurple` is no more a design decision than `#639`.
const NAMED_COLORS = new Set(
  `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue
   blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk
   crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki
   darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen
   darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue
   dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite
   gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki
   lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
   lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen
   lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen
   magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen
   mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream
   mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid
   palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum
   powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown
   seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen
   steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow
   yellowgreen`
    .trim()
    .split(/\s+/),
)

// System colors (`Canvas`, `GrayText`, `Highlight`) are absent from that list on
// purpose, so forced-colors work stays possible: a color the platform picks is not
// a design decision, and a token there would defeat the point.

// Functions that construct a color from raw components. `color-mix` is absent on
// purpose: it composes colors it is given, so its arguments are what matter.
const COLOR_FUNCTIONS = new Set([
  "color",
  "hsl",
  "hsla",
  "hwb",
  "lab",
  "lch",
  "oklab",
  "oklch",
  "rgb",
  "rgba",
])

// Properties whose unquoted words are author-chosen names, so a family called
// `Tan` or `Silver` must not read as a color.
const NAME_VALUED_PROPS = new Set(["font", "font-family"])

// Raw colors written into a declaration value, so the caller can require a token
// instead. Parsed rather than pattern-matched: `content: "#fff"`,
// `url(icon.svg#red)`, and `font-family: Tan` are not colors, and a regex over the
// raw value cannot tell.
export function rawColorLiterals(value, { property = "", exposedPrefixes = [] } = {}) {
  const found = []
  const named = !NAME_VALUED_PROPS.has(property.toLowerCase())

  const walk = (list) => {
    for (const node of list) {
      if (node.type === "string") continue
      if (node.type === "function") {
        const name = node.value.toLowerCase()
        if (name === "url") continue
        if (name === "var") {
          // A fallback belongs to whoever owns the token. For a prefix the project
          // exposes as a public contract, the component may legitimately be unset,
          // and the fallback is the contract's documented default.
          const [token] = node.nodes
          if (token && matchesClassPrefix(token.value, exposedPrefixes)) continue
          walk(node.nodes.slice(1))
          continue
        }
        // A color function whose components all come from elsewhere — relative
        // color syntax, `oklch(from var(--color-accent) l c h)` — decides nothing.
        if (COLOR_FUNCTIONS.has(name)) {
          const literal = node.nodes.some(
            (child) => child.type !== "function" && /\d/.test(child.value),
          )
          if (literal) {
            found.push(parseValue.stringify(node))
            continue
          }
        }
        walk(node.nodes)
        continue
      }
      if (node.type !== "word") continue
      const value = node.value.toLowerCase()
      if (value.startsWith("#") && /^#[\da-f]{3,8}$/.test(value)) found.push(node.value)
      else if (named && NAMED_COLORS.has(value)) found.push(node.value)
    }
  }

  walk(parseValue(value).nodes)
  return found
}

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
    tokens: { ...DEFAULT_CONFIG.tokens, ...config.tokens },
  }
}

const SEVERITY_LEVELS = ["error", "warn", "off"]
const DEFAULT_SEVERITY_KEY = "*"

// Rules that report what the toolchain could not verify rather than a violation.
// The code may well be correct, so the default is a warning: it tells a project
// where the linter is blind without failing a build over it.
const COVERAGE_RULES = { "unverifiable-dynamic-class": "warn" }

// Per-rule severity. `warn` exists for adopting the contract in an existing
// codebase; the intended steady state is `error` in CI. Explicit configuration
// always wins over a rule's own default, so `"*": "error"` tightens everything.
export function resolveSeverity(severity = {}) {
  const fallback = severity[DEFAULT_SEVERITY_KEY]
  return (ruleId) => severity[ruleId] ?? fallback ?? COVERAGE_RULES[ruleId] ?? "error"
}

export function validateSeverity(severity = {}, knownRuleIds = []) {
  const errors = []
  const known = new Set(knownRuleIds)
  for (const [ruleId, level] of Object.entries(severity)) {
    if (!SEVERITY_LEVELS.includes(level)) {
      errors.push(
        `severity.${ruleId} must be one of ${SEVERITY_LEVELS.join(", ")}; received ${JSON.stringify(level)}`,
      )
    }
    if (ruleId !== DEFAULT_SEVERITY_KEY && known.size > 0 && !known.has(ruleId)) {
      errors.push(`severity.${ruleId} is not a Nagi CSS rule`)
    }
  }
  return errors
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

// A mapping is a single base class. A malformed one is a configuration error,
// reported by validateNagiConfig; tolerate it here so it surfaces as a
// diagnostic rather than a TypeError.
export function mappingBase(value) {
  return typeof value === "string" ? value.trim() : ""
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

  const surfaces = slotSurfaces(config)

  return {
    anatomy,
    banned: new Set(config.bannedClasses),
    componentValues,
    detachedSlotSurfaces: new Set(config.detachedSlotSurfaces),
    elementNameReverse,
    elementValues,
    knownNames: new Set([...elementValues, ...componentValues, ...anatomy, ...stn]),
    renderedElements: new Set(RENDERED_ELEMENTS),
    roleVocabulary: new Set(ARIA_ROLE_NAMES),
    slotSurfaces: surfaces,
    stateClasses: new Set(config.stateClasses),
    stn,
    stnIndex: new Map(config.tiers.map((name, index) => [name, index + 1])),
    // Names the vocabulary hands out as a base identity. A variant using one of
    // these is smuggling in a name the author should have used as the base.
    // ARIA role names are deliberately absent: a role name that is not also a
    // base identity (`search`, `toolbar`, `status`) says *which area this is*,
    // not what the element is, and is only rejected when the element carries the
    // matching role — where it would have been available as a base.
    variantShadowNames: new Set([
      ...elementValues,
      ...componentValues,
      ...anatomy,
      ...stn,
      ...surfaces,
      ...config.bannedClasses,
      ...RENDERED_ELEMENTS,
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

  for (const [tag, value] of Object.entries(config.elementClasses ?? {})) {
    if (typeof value !== "string" || value.trim().length === 0) {
      errors.push(`elementClasses.${tag} must be a non-empty string; received ${String(value)}`)
    } else if (/\s/.test(value.trim())) {
      errors.push(
        `elementClasses.${tag} must be a single base class; received "${value}". A distinction a selector can reach belongs in an attribute or an ancestor step, not a fixed variant`,
      )
    } else if (value.trim().startsWith("-")) {
      errors.push(`elementClasses.${tag} must be a base class, not a variant; received "${value}"`)
    }
  }

  const tokens = config.tokens ?? {}
  if (!Array.isArray(tokens.sources)) {
    errors.push("tokens.sources must be an array")
  } else {
    for (const [index, source] of tokens.sources.entries()) {
      if (typeof source?.file !== "string" || source.file.length === 0) {
        errors.push(`tokens.sources[${index}].file must be a non-empty string`)
      }
      if (!TOKEN_LAYERS.includes(source?.layer)) {
        errors.push(
          `tokens.sources[${index}].layer must be one of ${TOKEN_LAYERS.join(", ")}; received ${JSON.stringify(source?.layer)}`,
        )
      }
    }
  }
  for (const [key, value] of [
    ["localPrefix", tokens.localPrefix],
    ...(tokens.exposedPrefixes ?? []).map((prefix) => ["exposedPrefixes", prefix]),
  ]) {
    if (typeof value !== "string" || !value.startsWith("--")) {
      errors.push(`tokens.${key} entries must be custom property prefixes starting with "--"`)
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
    // Look for the nearest meaningful directory *below* `pages`; never walk above
    // it, or a route at the root of `pages` would inherit the source directory.
    const directories = parts.slice(0, -1)
    const withinPages = directories.slice(directories.lastIndexOf("pages") + 1)
    name =
      [...withinPages].reverse().find((part) => part && !part.startsWith("[")) ??
      basename.replace(/^\[(.*)\]$/, "$1")
  }
  return `${kebabCase(name)}-page`
}

export function deriveAllowedSurfaceRootNames(filename, prefixes = []) {
  const name = deriveSurfaceRootName(filename)
  return Array.isArray(prefixes) && prefixes.length > 0
    ? unique(prefixes.map((prefix) => `${prefix}${name}`))
    : [name]
}

export { DEFAULT_CONFIG, ELEMENT_CLASSES, RENDERED_ELEMENTS, TOKEN_LAYERS }
export {
  analyzeVueTemplate,
  matchSelectorChain,
  unreadableStyleBlocks,
} from "./template-analysis.mjs"
