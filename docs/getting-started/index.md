# Framework setup

Nagi CSS is an ESLint plugin for Vue, Nuxt, Svelte, and Astro. It checks both
the component template and its plain-CSS `<style>` blocks, so the normal setup
does not need Stylelint or `nagi.config.mjs`.

Choose a guide:

- [Vue](vue.md)
- [Nuxt](nuxt.md)
- [Svelte](svelte.md)
- [Astro](astro.md)

## Common setup

Install the Nagi CSS ESLint plugin in the application:

```sh
vp add -D @nagi-labs/eslint-plugin-nagi-css
```

Then append Nagi CSS after the framework's official flat config:

```js
import nagiCss from "@nagi-labs/eslint-plugin-nagi-css"

export default [
  // The framework's official ESLint config comes first.
  ...nagiCss.configs.recommended({
    surfaceRootPrefixes: ["app-"],
  }),
]
```

Nagi CSS deliberately does not replace the framework parser, globals, or
generated settings. The Vue, Nuxt, Svelte, or Astro preset remains responsible
for those; Nagi CSS contributes only its file scope, plugin, and rules.

Run the project's normal ESLint command. If it has no script yet:

```sh
vp exec eslint .
```

`eslint --fix` applies only answers the contract can derive unambiguously.

## Adopting Nagi CSS incrementally

Severity is the second argument to `recommended`:

```js
...nagiCss.configs.recommended(
  {
    surfaceRootPrefixes: ["app-"],
  },
  {
    severity: {
      "*": "warn",
      "surface-root-name": "error",
    },
  },
)
```

Warnings do not fail ESLint. Remove the fallback after the initial findings
have been resolved; a permanent warning-only setup no longer acts as a contract.

## Optional standalone CLI

The `nagi-css` CLI remains available for checking another repository from the
outside. That advanced workflow uses an external `nagi.config.mjs`; it is not
part of normal framework setup. The CLI also runs the complete rule set through
ESLint and does not require Stylelint.

## Common requirements

- Node.js 22.18 or newer, and any higher minimum required by the framework's
  current ESLint plugin
- component-owned styles written as plain CSS
- at least one lowercase kebab prefix in `surfaceRootPrefixes`

The same rules apply everywhere: runtime state belongs in native, ARIA, or
`data-*` attributes, dynamic classes need a static owned anchor, and selectors
mirror owned DOM with `>`.

See the [configuration reference](https://github.com/nagi-labs/nagi-css/blob/main/skills/nagi-css/references/configuration.md)
for UI-library boundaries, slots, severity, emit policy, and design tokens.
