# Set up Nagi CSS with Vue

Nagi CSS extends the Vue project's existing ESLint flat config. The official
Vue preset owns `vue-eslint-parser`; Nagi CSS checks the template and the
component's `<style>` blocks without replacing it.

## 1. Install

If ESLint for Vue is not already configured:

```sh
vp add -D eslint eslint-plugin-vue
```

Add Nagi CSS:

```sh
vp add -D @nagi-labs/eslint-plugin-nagi-css
```

## 2. Extend `eslint.config.mjs`

Append Nagi CSS after the Vue preset:

```js
import pluginVue from "eslint-plugin-vue"
import nagiCss from "@nagi-labs/eslint-plugin-nagi-css"

export default [
  ...pluginVue.configs["flat/recommended"],
  ...nagiCss.configs.recommended(
    {
      surfaceRootPrefixes: ["app-"],
    },
    {
      files: ["src/**/*.vue"],
    },
  ),
]
```

If the project already has `eslint.config.mjs`, keep its TypeScript, globals,
and Vue settings and append only the Nagi CSS entry.

## 3. Give the component a derived surface

<!-- nagi-check file=src/components/UserCard.vue prefix=app- -->
```vue
<template>
  <article class="app-user-card" :data-active="active">
    <h2 class="title">Ada Lovelace</h2>
    <p class="p">First programmer</p>
  </article>
</template>

<script setup>
defineProps({
  active: Boolean,
})
</script>

<style scoped>
.app-user-card {
  > .title {}
  > .p {}
}
</style>
```

`UserCard.vue` derives `user-card`; the configured prefix produces
`app-user-card`. Vue's `:class` may supplement a static owned class, while
runtime state belongs in an attribute.

## 4. Run ESLint

```sh
vp exec eslint .
```

Use `vp exec eslint . --fix` for safe derived fixes. A separate Nagi
configuration file is not required.

Continue with the [shared configuration reference](https://github.com/nagi-labs/nagi-css/blob/main/skills/nagi-css/references/configuration.md).
