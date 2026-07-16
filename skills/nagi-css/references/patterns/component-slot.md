# Component slot

Declare an owned wrapper for content inserted through a library slot.

```vue
<template><div class="card-host"><Card class="pv-card"><template #content><section class="pv-card-content"><p class="text"/></section></template></Card></div></template>
<style scoped>.card-host { > .pv-card { .pv-card-content { > .text {} } } }</style>
```

```js
componentClasses: ["Card"],
componentSlots: { Card: { content: "pv-card-content" } }
```

The card is opaque; `pv-card-content` starts owned DOM again. Invalid slot names
that do not start with the owner prefix fail `valid-config`; a top-level slot
selector reports `slot-surface-top-level`. Correct by nesting it under the boundary.
