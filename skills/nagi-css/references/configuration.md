# Configuration Reference

Keep configuration outside the target repository and export a default object.

Both globs point at Vue single-file components. Style blocks must be plain CSS:
preprocessor syntax and standalone `.css` files are out of scope, so do not add
them to `stylelintFiles`.

```js
import { defineNagiConfig } from "@nagi-labs/nagi-css-core"

export default {
  eslintFiles: ["src/**/*.vue"],
  stylelintFiles: ["src/**/*.vue"],
  severity: {
    "*": "warn",
    "surface-root-name": "error",
  },
  semantic: defineNagiConfig({
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
    emitPolicy: "when-styled",
  }),
}
```

`tiers` sets the STN ladder. Its default is seven names, and a surface that is
irreducibly deeper can be given headroom by adding a coarser name at the front —
`tiers: ["plate", "stratum", …, "unit", "seg", "fr", "g"]` — keeping `unit` and
`g`, which the floor and reach-`g` relations anchor on. Shallow surfaces are
unaffected. Extending below `g` is not supported.

`severity` is optional and sits outside `semantic`, because it configures the
linters rather than the vocabulary. Every rule is `error` unless listed; `*` sets
the fallback; `warn` reports without failing the run; `off` removes the rule.
An unknown rule name is a configuration error, so a typo cannot quietly disable
a check. Use `warn` to stage adoption in an existing codebase — do not leave a
project there, since an unenforced contract is back to consistency by discipline.

`unverifiable-dynamic-class` is the exception: it defaults to `warn` because it
reports what could not be checked rather than a violation. Raise it to `error`
where every element must be verifiable, or turn it `off` if the gaps are known
and accepted.

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

Do not register application-owned Vue components here. Their surface root is
derived from their own filename and the required `surfaceRootPrefixes`.

```js
surfaceRootPrefixes: ["n-", "app-"]
```

The array must contain at least one prefix. The accepted roots are exact
derivations. `Button.vue` accepts `.n-button` or `.app-button`, but
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
// .n-artifact-detail-pane and .n-scenario-tree-path in their respective SFCs.
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
the current SFC styles it.

Use `libraryBoundaryPrefixes` for opaque component root classes and
`libraryInternalPrefixes` for classes wholly owned by a dependency. A prefix
ending in `-` matches by `startsWith`; another prefix matches itself and its
hyphenated family.

`tokens` declares where design tokens come from. Nagi CSS ships none: which
values exist is the design system's decision, so it checks only that a referenced
token resolves and reads the right layer.

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

`sources` paths are resolved against `--cwd`, and each file is read as data —
never linted, only scanned for the custom properties it declares. `layer` is
`primitive` or `semantic`; a name declared in both counts as semantic. Both
checks are inactive while `sources` is empty, so a project without a token layer
is not asked to invent one.

A reference no source declares is `unknown-token`, an error rather than a warning
because CSS drops it silently: `var(--color-surfce)` leaves the property unset
with nothing to notice. A primitive referenced from a surface is `token-layer`.

Exempt from both: a custom property the same stylesheet declares — including a
`--local-*` one-off (`localPrefix`) — and a prefix a component exposes as its
public styling contract (`exposedPrefixes`), which the library owns rather than
the token layer. Both prefixes must start with `--`.

The semantic object also accepts `surfaceRootPrefixes`, `componentClassPrefix`, `elementClasses`, `anatomyClasses`,
`bannedClasses`, `stateClasses`, and `tiers`. Prefer narrow project mappings
over growing anatomy vocabulary to accommodate one local component.
