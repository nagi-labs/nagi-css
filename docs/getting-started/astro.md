# Set up Nagi CSS with Astro

Nagi CSS extends Astro's official ESLint plugin and checks Astro markup,
`class:list`, expressions, and component-owned styles in the same ESLint run.

## 1. Install

```sh
vp add -D eslint eslint-plugin-astro @nagi-labs/eslint-plugin-nagi-css
```

## 2. Extend `eslint.config.mjs`

```js
import eslintPluginAstro from "eslint-plugin-astro"
import nagiCss from "@nagi-labs/eslint-plugin-nagi-css"

export default [
  ...eslintPluginAstro.configs.recommended,
  ...nagiCss.configs.recommended(
    {
      surfaceRootPrefixes: ["app-"],
    },
    {
      files: ["src/**/*.astro"],
    },
  ),
]
```

The Astro preset remains responsible for `astro-eslint-parser`; Nagi CSS adds
only its rules.

## 3. Give the component a derived surface

<!-- nagi-check file=src/components/UserCard.astro prefix=app- -->
```astro
---
const { active = false } = Astro.props
---

<article class="app-user-card" data-active={active}>
  <h2 class="title">Ada Lovelace</h2>
  <p class="text">First programmer</p>
</article>

<style>
  .app-user-card {
    > .title {}
    > .text {}
  }
</style>
```

`class:list` is analyzed as a dynamic class source. Keep the owned identity in
a static `class` attribute and express conditional state with native, ARIA, or
`data-*` attributes.

## 4. Run ESLint

```sh
vp exec eslint "src/**/*.{js,mjs,ts,astro}"
```

A separate Nagi configuration file is not required. Application-owned
components derive their own surfaces; reserve `componentClasses` for opaque
third-party or UI-library components.

Continue with the [shared configuration reference](https://github.com/nagi-labs/nagi-css/blob/main/skills/nagi-css/references/configuration.md).
