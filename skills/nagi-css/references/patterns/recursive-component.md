# Recursive component

Keep each recursive instance as its own surface; style the parent-owned placement wrapper.

<!-- nagi-check file=src/components/tree-branch.vue -->
```vue
<template><li class="app-tree-branch"><button class="button">Node</button><ul class="list"><li class="item"><tree-branch/></li></ul></li></template>
<style scoped>.app-tree-branch { > .button {} > .list { > .item {} } }</style>
```

External config: none; do not add `TreeBranch` to `componentClasses` because it
is application-owned.

Invalid: registering `TreeBranch: "app-tree-branch"` makes the surface an opaque
library boundary and can trigger `owned-dom-direct-child`. Correct by letting
`tree-branch.vue` derive `.app-tree-branch` and styling recursion through owned wrappers.
