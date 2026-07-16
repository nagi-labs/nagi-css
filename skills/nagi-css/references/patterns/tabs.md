# Tabs

Use matching ARIA roles when role names are class anchors.

```vue
<template><section class="account-tabs"><div class="tablist" role="tablist"><button class="tab" role="tab" aria-selected="true">Profile</button></div><div class="tabpanel" role="tabpanel">...</div></section></template>
<style scoped>.account-tabs { > .tablist { > .tab {} } > .tabpanel {} }</style>
```

External config: none. The surface owns the ARIA structure.

Invalid: `.tab` without `role="tab"` reports `anatomy-allowed`; `.-active`
reports `state-not-class`. Correct with matching roles and `aria-selected`.
