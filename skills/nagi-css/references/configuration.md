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

The semantic object also accepts `surfaceRootPrefixes`, `componentClassPrefix`, `elementClasses`, `anatomyClasses`,
`bannedClasses`, `stateClasses`, and `tiers`. Prefer narrow project mappings
over growing anatomy vocabulary to accommodate one local component.
