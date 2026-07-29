# Form

Make the form the surface and keep label/control pairs in the allowed `field` anatomy.

<!-- nagi-check file=src/components/ProfileForm.vue -->
```vue
<template><form class="app-profile-form"><div class="field"><label class="label">Name</label><input class="input"/></div><div class="actions"><button class="button">Save</button></div></form></template>
<style scoped>.app-profile-form { > .field { > .label {} > .input {} } > .actions { > .button {} } }</style>
```

External config: none. The form owns every shown descendant.

Invalid: `.form-group` reports `anatomy-allowed`; `input {}` reports
`bare-element-selector`. Correct with `field`, fixed element classes, and owned
`>` edges.
