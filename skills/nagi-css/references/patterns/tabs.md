# Tabs

Keep fixed element classes ahead of ARIA semantics; only `div`/`span` use a
matching role name as their class anchor.

<!-- nagi-check file=src/components/AccountTabs.vue -->
```vue
<template><section class="app-account-tabs"><div class="tablist" role="tablist"><button class="button" role="tab" aria-selected="true">Profile</button></div><div class="tabpanel" role="tabpanel">...</div></section></template>
<style scoped>.app-account-tabs { > .tablist { > .button[role="tab"] {} } > .tabpanel {} }</style>
```

External config: none. The surface owns the ARIA structure.

Invalid: `button.tab` ignores the fixed `button` identity; `.-active` reports
`state-not-class`. Correct with `.button[role="tab"]` and `aria-selected`.
