# UI-library boundary

List only opaque dependency components; their class defaults to `pv-` plus kebab-case.

<!-- nagi-check file=src/components/PickerPanel.vue components=DatePicker -->
```vue
<template><section class="app-picker-panel"><DatePicker class="pv-date-picker"/></section></template>
<style scoped>.app-picker-panel { > .pv-date-picker {} }</style>
```

```js
componentClasses: ["DatePicker"]
```

The parent owns placement of the boundary, not the library's internal DOM.
Invalid: `.pv-date-picker > .input` reports `owned-dom-direct-child`. Correct through
library props, pass-through APIs, CSS variables, or `::part()`.
