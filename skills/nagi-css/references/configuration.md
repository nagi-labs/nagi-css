# Configuration Reference

Put the semantic contract in the application's existing `eslint.config.mjs`.
Append Nagi CSS after the framework's official flat config; Nagi CSS does not
replace the framework parser or globals. Style blocks must be plain CSS:
preprocessor syntax and standalone `.css` files are out of scope.

```js
import nagiCss from "@nagi-labs/eslint-plugin-nagi-css"

export default [
  // The framework's official config comes first.
  ...nagiCss.configs.recommended(
    {
      surfaceRootPrefixes: ["app-"],
      componentClasses: ["DataTable", "Column"],
      componentSlotPrefixes: {
        Column: "ui-table-column",
      },
      componentSlots: {
        Column: {
          body: "ui-table-column-body",
        },
      },
      libraryBoundaryPrefixes: ["pv-"],
      libraryInternalPrefixes: ["vendor-", "icon"],
      declarationMode: "plain",
      emitPolicy: "when-styled",
    },
    {
      files: ["src/**/*.{vue,svelte,astro}"],
      severity: {
        "*": "warn",
        "surface-root-name": "error",
      },
    },
  ),
]
```

`declarationMode` chooses how declarations inside those readable selectors are
authored:

- `"plain"` is the default. `@apply` is rejected, and Nagi CSS can inspect every
  declaration directly.
- `"tailwind-apply"` is an experimental compatibility backend that permits
  Tailwind `@apply`. Template class vocabulary,
  selector nesting, owned-DOM boundaries, state selectors, and selector/template
  matching remain checked. Tailwind owns utility-name validation and expansion;
  Nagi CSS does not claim complete property/value coverage over an unexpanded
  utility list. Raw CSS declarations beside `@apply` are still checked normally.

Arbitrary syntax such as `font-[inherit]` or `[mask-type:luminance]` is rejected
inside `@apply`; keep that property visible as plain CSS. Nagi CSS also recognizes
surface-root position, margin, inset, and z-index utilities so `@apply` cannot
hide external layout ownership. Other named utilities are validated and expanded
by Tailwind. Its coverage and configuration may change before it is promoted to
a stable declaration backend.

The second mode does not permit utility classes in the template. It only changes
the declaration backend behind Nagi's derived classes and nested selectors. Use
it for an owned implementation that deliberately accepts Tailwind as a build
dependency; keep reusable, dependency-free Blueprints on `"plain"`.

`tiers` sets the STN ladder. Its default is seven names, and a surface that is
irreducibly deeper can be given headroom by adding a coarser name at the front —
`tiers: ["plate", "stratum", …, "unit", "seg", "fr", "g"]` — keeping `unit` and
`g`, which the floor and reach-`g` relations anchor on. Shallow surfaces are
unaffected. Extending below `g` is not supported.

`severity` is optional and sits in the second, ESLint-integration argument
because it configures enforcement rather than the vocabulary. Every rule is
`error` unless listed; `*` sets the fallback; `warn` reports without failing
the run; `off` removes the rule.
An unknown rule name is a configuration error, so a typo cannot quietly disable
a check. Use `warn` to stage adoption in an existing codebase — do not leave a
project there, since an unenforced contract is back to consistency by discipline.

Two advisory rules default to `warn` because they do not prove a violation:

- `unverifiable-dynamic-class` reports class names that cannot be checked;
- `layout-only-wrapper` reports a `div`/`span` that appears to exist only for
  flex/grid layout and may be collapsible after rendered verification.

Raise either to `error` when review is mandatory, or turn it `off` when the gaps
or candidates are known and accepted. Neither advisory has a speculative
autofix.

`componentClasses` lists only opaque third-party or UI-library components. The
array shorthand derives each class as `pv-` plus the component name in
kebab-case: `DataTable` becomes `pv-data-table`. Change the default with
`componentClassPrefix`, or use an object for an explicit exception:

```js
componentClassPrefix: "pv-",
componentClasses: {
  DataTable: null,                // pv-data-table
  LegacyGrid: "legacy-grid-root", // explicit override
}
```

Do not register application-owned components here. Their surface root is
derived from their own filename and the required `surfaceRootPrefixes`.

When one repository both consumes package components and owns copied or
replacement implementations, use separate ESLint config entries. Consumer
templates may load the package's `componentClasses` boundary map; owned source
files must omit that map and use their own surface prefix. Otherwise the linter
correctly treats an owned root such as `.n-carousel` as an opaque dependency and
refuses to inspect its children.

Components that only proxy a fixed native element are not opaque library
boundaries. Map them with `intrinsicComponents` so element naming and owned-child
selector checks continue through the proxy. Components that render no DOM at all
go in `transparentComponents`:

```js
intrinsicComponents: {
  "motion.article": "article",
  "motion.div": "div",
  "motion.li": "li",
  "motion.span": "span",
},
transparentComponents: ["AnimatePresence"],
```

Use these only where the rendered shape is fixed by the component API.
`motion.article` always renders an `article`, and `AnimatePresence` contributes no
element. A polymorphic component whose tag is chosen at runtime is not an
intrinsic mapping; its tree remains unverifiable. Neither option changes the
runtime or asks Nagi CSS to understand the component's behavior.

```js
surfaceRootPrefixes: ["n-", "app-"]
```

The array must contain at least one prefix. The accepted roots are exact
derivations. `Button.vue`, `Button.svelte`, and `Button.astro` accept
`.n-button` or `.app-button`, but
rejects both bare `.button` and unrelated `.n-control`. Prefixes must be
lowercase kebab prefixes ending in `-`. Use one prefix for canonical new code;
multiple entries are for repositories that intentionally contain namespaces.

```js
// Incorrect: these become opaque library boundaries.
componentClasses: {
  ArtifactDetailPane: "artifact-detail-pane",
  ScenarioTreePath: "scenario-tree-path",
}

// Correct: omit both. With surfaceRootPrefixes: ["n-"], these files own
// .n-artifact-detail-pane and .n-scenario-tree-path in their respective files.
componentClasses: []
```

Layout around an owned child belongs to a parent-owned wrapper, or to the
child's own surface. Nagi CSS does not expose a separate parent-stylable
`ownedComponentClasses` mapping.

Each slot surface must start with its owning component slot prefix. Use
`componentSlotPrefixes` when a renderless or composite component's slot owner
is more specific than its component root class.

Add a slot surface to `detachedSlotSurfaces` only when its owned wrapper is
actually rendered outside the parent surface tree.

`emitPolicy` is `"when-styled"` by default. Set it to `"always"` when every
mapped native element and component must carry its fixed class whether or not
the current component file styles it.

Under the default, whether a class is required depends on the adjacent style
block, so adding a CSS rule can make previously conforming markup non-conforming
— the report lands in the template, in response to a change in the stylesheet.
`always` makes the requirement a function of the markup alone, at the cost of
classes that nothing styles yet.

Use `libraryBoundaryPrefixes` for opaque component root classes and
`libraryInternalPrefixes` for classes wholly owned by a dependency. A prefix
ending in `-` matches by `startsWith`; another prefix matches itself and its
hyphenated family.

`value-token-required` and `length-token-required` need no configuration. A raw
color (`#f0a`, `rgb(0 0 0 / .1)`, a named color in a gradient) is an error anywhere
in a surface, including inside a `--local-*` declaration and a `var()` fallback:
colors have no local escape. A raw length is an error on scale properties only —
spacing, radius, border width, type size, elevation — and there the escape is a
named `--local-*` declaration, which `localPrefix` renames. Turn either off with
`severity` if a codebase is not ready for it, rather than expecting it to be
inactive by default; colors first is the easier order.

`tokens.semantic` holds the default token names by family (color, space, radius,
strokeWidth, type, shadow, stacking). Names only — no values. Override a family
where the project's roles are named differently; the table is not separately
enforced, it supplies the vocabulary diagnostics suggest and agents reach for.

`tokens` declares where design tokens come from. Nagi CSS ships none: which
values exist is the design system's decision, so the remaining two checks only ask
that a referenced token resolves and reads the right layer.

```js
tokens: {
  sources: [
    { file: "src/tokens/palette.css", layer: "primitive" },
    { file: "src/tokens/semantic.css", layer: "semantic" },
  ],
  exposedPrefixes: ["--pv-datepicker-"],
  localPrefix: "--local-",
}
```

`sources` paths are resolved against the ESLint process's project directory.
The optional standalone CLI resolves them against `--cwd`. Each file is read as
data — never linted, only scanned for the custom properties it declares. `layer` is
`primitive` or `semantic`; a name declared in both counts as semantic. These two
checks are inactive while `sources` is empty — they compare against a set the
project defines — so a project without a token layer is not asked to invent one.

A reference no source declares is `unknown-token`, an error rather than a warning
because CSS drops it silently: `var(--color-surfce)` leaves the property unset
with nothing to notice. A primitive referenced from a surface is `token-layer`.

Exempt from both: a custom property the same stylesheet declares — including a
`--local-*` one-off (`localPrefix`) — and a prefix a component exposes as its
public styling contract (`exposedPrefixes`), which the library owns rather than
the token layer. Both prefixes must start with `--`. `exposedPrefixes` also
exempts a fallback, so `var(--pv-datepicker-fg, #333)` documents an exposed
default while `var(--color-text, #333)` is a raw color.

The semantic object also accepts `surfaceRootPrefixes`, `componentClassPrefix`,
`elementClasses`, `anatomyClasses`, `bannedClasses`, `stateClasses`, `tiers`,
`declarationMode`, `intrinsicComponents`, and `transparentComponents`. Prefer
narrow project mappings over growing anatomy vocabulary to accommodate one local
component.
