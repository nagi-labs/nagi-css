# Page shell

Use the routed filename for the root and semantic landmarks for owned sections.

<!-- nagi-check file=src/pages/reports/index.vue -->
```vue
<template><div class="app-reports-page"><header class="header"/><main class="main"/><footer class="footer"/></div></template>
<style scoped>.app-reports-page { > .header {} > .main {} > .footer {} }</style>
```

External config: none. Ownership stays inside `app-reports-page`; each `>` is owned.

Invalid: `.page` as the root reports `surface-root-name`; bare `main {}` reports
`bare-element-selector`. Correct by deriving `app-reports-page` from the route and
using the fixed landmark classes shown above.
