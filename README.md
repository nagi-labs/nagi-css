# Nagi CSS

**CSS, after the wind.** Nagi CSS is a lint-enforced semantic contract for
component-owned CSS. Class names are derived from markup and project
configuration, so humans and AI agents converge on the same answer.

It keeps styling in plain CSS: no runtime, build step, utility classes, or new
syntax. One ESLint plugin checks the component template and its `<style>` blocks
together across Vue, Nuxt, Svelte, and Astro.

## Install

Requirements:

- Node.js 22.18 or newer
- ESLint 9 or newer
- component-owned `<style>` blocks written in plain CSS

```sh
vp add -D @nagi-labs/eslint-plugin-nagi-css
```

Append Nagi CSS after the framework's official flat config:

```js
import nagiCss from "@nagi-labs/eslint-plugin-nagi-css"

export default [
  // The framework's official ESLint config comes first.
  ...nagiCss.configs.recommended({
    surfaceRootPrefixes: ["app-"],
  }),
]
```

Run the application's normal ESLint command. If it does not have one yet:

```sh
vp exec eslint .
```

`eslint --fix` applies only changes whose answer the contract can derive
unambiguously.

Framework-specific setup:

- [Vue](docs/getting-started/vue.md)
- [Nuxt](docs/getting-started/nuxt.md)
- [Svelte](docs/getting-started/svelte.md)
- [Astro](docs/getting-started/astro.md)

The [setup index](docs/getting-started/index.md) covers shared installation,
design tokens, incremental adoption, and verification.

## What it enforces

Given the component and configuration, Nagi CSS derives one canonical form:

- the surface root from the configured prefix and component filename;
- fixed classes from HTML elements and configured UI components;
- a small anatomy vocabulary and structural fallback for `div` and `span`;
- static variants and attribute-based runtime state;
- selectors that mirror owned DOM with `>` and stop at component boundaries;
- token references for colors and design-system scale values.

```vue
<template>
  <section class="app-user-card">
    <span class="icon" :class="iconName" />
    <div class="value" :data-active="status === 'active'">Ada Lovelace</div>
  </section>
</template>

<style scoped>
.app-user-card {
  > .icon {}
  > .value[data-active="true"] {
    color: var(--color-text);
  }
}
</style>
```

Nagi CSS extends the framework's official ESLint config instead of replacing
its parser, globals, or generated settings. A separate configuration file is
not required for normal application setup.

## Documentation

- [Contract](CONTRACT.md) — the complete naming, selector, ownership, and value rules
- [FAQ](FAQ.md) — design rationale, tradeoffs, and comparisons
- [Configuration reference](skills/nagi-css/references/configuration.md) — UI libraries, slots, severity, emit policy, and tokens
- [Agent instructions](AGENTS.md) — portable rules for agents editing components
- [Agent skill](skills/nagi-css) — the complete generate-and-verify workflow

## Packages

- `@nagi-labs/eslint-plugin-nagi-css` — standard template and component-style integration
- `@nagi-labs/nagi-css-core` — shared configuration and semantic analysis
- `@nagi-labs/nagi-css` — optional standalone runner for external configurations

The ESLint plugin is the normal entry point. The standalone runner supports
external configurations and projects that use another primary linter.

## Scope

Nagi CSS checks Vue, Svelte, and Astro component templates together with their
plain-CSS `<style>` blocks. Nuxt is supported through Vue's parser and Nuxt's
generated ESLint config.

Preprocessor syntax and standalone `.css` files are outside the component-owned
contract. Global resets, token declarations, and cross-surface exceptions remain
the application's responsibility. See the [contract](CONTRACT.md) for the exact
boundary.

## Development

Install dependencies and run the test suite through Vite Plus:

```sh
vp install
vp run test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) before changing vocabulary or rule
behavior.

## License

[MIT](LICENSE), by nagi-labs contributors.
