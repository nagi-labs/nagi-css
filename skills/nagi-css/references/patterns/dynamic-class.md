# Dynamic class

Keep a static owned anchor and add dynamic library or variant tokens only beside it.

```vue
<template><section class="icon-label"><span class="icon" :class="iconName"><svg/></span><span class="value" :class="{ '-muted': muted }"/></section></template>
<style scoped>.icon-label { > .icon {} > .value.-muted {} }</style>
```

External config: add the dependency prefix to `libraryInternalPrefixes` only
when `iconName` emits library-owned classes.

Invalid: `:class="iconName"` without `class="icon"` reports
`dynamic-class-requires-static-anchor`; `is-muted` reports `state-not-class`.
Correct by retaining the static anchor and using a stylistic `-muted` variant.
