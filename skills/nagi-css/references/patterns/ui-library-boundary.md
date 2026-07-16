# UI-library boundary

List only opaque dependency components; their class defaults to `pv-` plus kebab-case.

```vue
<template><section class="picker-panel"><DatePicker class="pv-date-picker"/></section></template>
<style scoped>.picker-panel { > .pv-date-picker {} }</style>
```

```js
componentClasses: ["DatePicker"]
```

The parent owns placement of the boundary, not the library's internal DOM.
Invalid: `.pv-date-picker > .input` reports `owned-dom-direct-child`. Correct through
library props, pass-through APIs, CSS variables, or `::part()`.
