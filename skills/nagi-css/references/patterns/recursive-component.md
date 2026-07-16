# Recursive component

Keep each recursive instance as its own surface; style the parent-owned placement wrapper.

```vue
<template><li class="tree-branch"><button class="button">Node</button><ul class="list"><li class="item"><TreeBranch/></li></ul></li></template>
<style scoped>.tree-branch { > .button {} > .list { > .item {} } }</style>
```

External config: none; do not add `TreeBranch` to `componentClasses` because it
is application-owned.

Invalid: registering `TreeBranch: "tree-branch"` makes the surface an opaque
library boundary and can trigger `owned-dom-direct-child`. Correct by letting
`TreeBranch.vue` derive `.tree-branch` and styling recursion through owned wrappers.
