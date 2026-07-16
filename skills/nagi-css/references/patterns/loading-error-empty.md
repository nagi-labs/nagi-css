# Loading, error, and empty states

Represent runtime state with attributes while keeping stable class anchors.

```vue
<template><section class="results-panel" :aria-busy="loading"><p v-if="error" class="alert" role="alert">Failed</p><p v-else-if="empty" class="status" role="status">No results</p><ul v-else class="list"/></section></template>
<style scoped>.results-panel { &[aria-busy="true"] {} > .alert {} > .status {} > .list {} }</style>
```

External config: none. The surface owns each conditional branch.

Invalid: `.-loading` and `.is-error` report `state-not-class`. Correct with
`aria-busy`, matching live-region roles, or `data-*` attributes.
