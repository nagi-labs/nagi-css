# Dynamic class

Keep a static owned anchor and add dynamic library tokens only beside it. A
variant may never be applied by a binding: something a binding switches on and
off is runtime state, so it belongs in an attribute.

<!-- nagi-check file=src/components/IconLabel.vue -->
```vue
<template><section class="app-icon-label"><span class="icon" :class="iconName"><svg/></span><span class="value" :data-muted="muted"/></section></template>
<style scoped>.app-icon-label { > .icon {} > .value[data-muted="true"] {} }</style>
```

External config: add the dependency prefix to `libraryInternalPrefixes` only
when `iconName` emits library-owned classes.

Invalid: `:class="iconName"` without `class="icon"` reports
`dynamic-class-requires-static-anchor`; `is-muted` reports `state-not-class`;
`:class="{ '-muted': muted }"` reports `variant-must-be-static`, because a
variant that toggles is state under another name. Correct by keeping the static
anchor and moving the toggle to `data-muted`.

A static variant is still the right tool when it does not change at runtime:
`<span class="value -lead" />` is fine, and only the binding form is rejected.

`:class="iconName"` also draws `unverifiable-dynamic-class`, a **warning**: the
names are assembled at runtime, so no rule can see what lands on the element.
That is a statement about coverage, not a violation. Write the binding as an
object with literal keys when the names should be verified
(`:class="{ 'icon-large': big }"`), or accept the gap.
