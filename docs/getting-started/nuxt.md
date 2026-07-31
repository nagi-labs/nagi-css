# Set up Nagi CSS with Nuxt

Nuxt generates its ESLint flat config in `.nuxt/eslint.config.mjs`. Nagi CSS is
passed to Nuxt's `withNuxt(...)` composer, so Nuxt remains responsible for its
Vue parser, auto-import globals, generated files, and project conventions.

## 1. Enable Nuxt ESLint

If the project does not already use it:

```sh
vp add -D @nuxt/eslint
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["@nuxt/eslint"],
})
```

Prepare the generated config, then install Nagi CSS:

```sh
vp exec nuxi prepare
vp add -D @nagi-labs/eslint-plugin-nagi-css
```

## 2. Compose `eslint.config.mjs`

```js
import withNuxt from "./.nuxt/eslint.config.mjs"
import nagiCss from "@nagi-labs/eslint-plugin-nagi-css"

export default withNuxt(
  ...nagiCss.configs.recommended(
    {
      surfaceRootPrefixes: ["app-"],
    },
    {
      files: ["**/*.vue"],
      ignores: [
        "**/.nuxt/**",
        "**/.output/**",
        "**/dist/**",
      ],
    },
  ),
)
```

This works with both Nuxt 4's `app/` directory and projects whose `pages/`,
`components/`, or `layouts/` directories are at the repository root.

## 3. Use the routed page identity

Files below a `pages` directory receive a `-page` identity.
`app/pages/reports/index.vue` therefore owns `.app-reports-page`.

<!-- nagi-check file=app/pages/reports/index.vue prefix=app- -->
```vue
<template>
  <main class="app-reports-page">
    <h1 class="title">Reports</h1>
  </main>
</template>

<style scoped>
.app-reports-page {
  > .title {}
}
</style>
```

## 4. Run the normal Nuxt lint

```sh
vp exec eslint .
```

Nagi CSS now participates in the same ESLint run as Nuxt. No second Stylelint
run or `nagi.config.mjs` is required.

Keep application-owned component tags aligned with their file names:

```text
app/components/UserAvatar.vue -> <UserAvatar /> -> .app-user-avatar
```

Continue with the [shared configuration reference](https://github.com/nagi-labs/nagi-css/blob/main/skills/nagi-css/references/configuration.md).
