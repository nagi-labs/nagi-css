# Data table

Treat the library grid as opaque and resume owned structure only in a declared slot surface.

<!-- nagi-check file=src/components/OrdersTable.vue components=DataTable slots=DataTable.body=pv-data-table-body -->
```vue
<template><section class="app-orders-table"><DataTable class="pv-data-table"><template #body><div class="pv-data-table-body"><span class="value"/></div></template></DataTable></section></template>
<style scoped>.app-orders-table { > .pv-data-table { .pv-data-table-body { > .value {} } } }</style>
```

```js
componentClasses: ["DataTable"],
componentSlots: { DataTable: { body: "pv-data-table-body" } }
```

The component root is an opaque boundary; the slot wrapper is owned again.
Invalid: `> .value` directly through the component reports `owned-dom-direct-child`.
Correct by declaring and nesting through the slot surface.
