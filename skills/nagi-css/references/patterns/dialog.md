# Dialog

Name the dialog surface by identity; use semantic content and attribute state.

<!-- nagi-check file=src/components/ConfirmDialog.vue -->
```vue
<template><dialog class="app-confirm-dialog" :open="open"><header class="header"><h2 class="title">Delete?</h2></header><p class="text">This cannot be undone.</p><div class="actions"><button class="button">Cancel</button></div></dialog></template>
<style scoped>.app-confirm-dialog { > .header { > .title {} } > .text {} > .actions { > .button {} } }</style>
```

External config: none. The native dialog is the owned surface.

Invalid: `class="dialog"` as a chosen surface name conflicts with deterministic
surface naming; `.body` on content reports `reserved-element-name`. Correct with
the filename-derived root and a semantic `p.text`.
