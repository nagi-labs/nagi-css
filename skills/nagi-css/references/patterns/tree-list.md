# Tree list

Use native list semantics and fixed element classes for an owned tree branch.

<!-- nagi-check file=src/components/ScenarioTree.vue -->
```vue
<template><ul class="app-scenario-tree"><li class="item"><button class="button">Node</button><ul class="list"><li class="item"/></ul></li></ul></template>
<style scoped>.app-scenario-tree { > .item { > .button {} > .list { > .item {} } } }</style>
```

External config: none. All list markup shown here is owned.

Invalid: `.node` on an internal `li` reports `anatomy-allowed`; `li {}` reports
`bare-element-selector`. Correct with `list`, `item`, and a variant such as
`item -branch` when visual differentiation is required.
