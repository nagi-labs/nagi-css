# Configuration Reference

Keep configuration outside the target repository and export a default object.

```js
import { defineNagiConfig } from "@nagi-labs/nagi-css-core"

export default {
  eslintFiles: ["src/**/*.vue"],
  stylelintFiles: ["src/**/*.{vue,css}"],
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
derived from their own filename.

```js
// Incorrect: these become opaque library boundaries.
componentClasses: {
  ArtifactDetailPane: "artifact-detail-pane",
  ScenarioTreePath: "scenario-tree-path",
}

// Correct: omit both. ArtifactDetailPane.vue owns .artifact-detail-pane and
// ScenarioTreePath.vue owns .scenario-tree-path in their respective SFCs.
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

The semantic object also accepts `componentClassPrefix`, `elementClasses`, `anatomyClasses`,
`bannedClasses`, `stateClasses`, and `tiers`. Prefer narrow project mappings
over growing anatomy vocabulary to accommodate one local component.
