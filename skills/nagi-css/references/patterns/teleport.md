# Teleport

Mark a slot surface detached only when Teleport actually renders it outside the parent tree.

```vue
<template><Teleport to="body"><section class="pv-dialog-content"><p class="p"/></section></Teleport></template>
<style scoped>.pv-dialog-content { > .p {} }</style>
```

```js
componentClasses: ["Dialog"],
componentSlots: { Dialog: { content: "pv-dialog-content" } },
detachedSlotSurfaces: ["pv-dialog-content"]
```

The teleported wrapper is its own owned entry point. Invalid: a top-level slot
surface without `detachedSlotSurfaces` reports `slot-surface-top-level`. Correct
by declaring detachment, not by broadly relaxing selector rules.
