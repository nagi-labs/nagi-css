# Form

Make the form the surface and keep label/control pairs in the allowed `field` anatomy.

```vue
<template><form class="profile-form"><div class="field"><label class="label">Name</label><input class="input"/></div><div class="actions"><button class="button">Save</button></div></form></template>
<style scoped>.profile-form { > .field { > .label {} > .input {} } > .actions { > .button {} } }</style>
```

External config: none. The form owns every shown descendant.

Invalid: `.form-group` reports `anatomy-allowed`; `input {}` reports
`bare-element-selector`. Correct with `field`, fixed element classes, and owned
`>` edges.
