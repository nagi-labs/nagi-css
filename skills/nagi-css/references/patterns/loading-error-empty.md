# Loading, error, and empty states

Represent runtime state with attributes while keeping stable class anchors.

<!-- nagi-check file=src/components/ResultsPanel.vue -->
```vue
<template><section class="app-results-panel" :aria-busy="loading"><p v-if="error" class="text" role="alert">Failed</p><p v-else-if="empty" class="text" role="status">No results</p><ul v-else class="list"/></section></template>
<style scoped>.app-results-panel { &[aria-busy="true"] {} > .text[role="alert"] {} > .text[role="status"] {} > .list {} }</style>
```

External config: none. The surface owns each conditional branch.

Invalid: `.-loading` and `.is-error` report `state-not-class`. Correct with
`aria-busy`, attribute selectors for the live-region roles, or `data-*`
attributes. The `<p>` branches retain their fixed `text` identity.
