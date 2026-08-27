# Framework setup

Nagi CSS is an ESLint plugin for Vue, Nuxt, Svelte, and Astro. It checks both
the component template and its plain-CSS `<style>` blocks, so the normal setup
does not need a separate Nagi configuration file.

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

## Declare a token layer

Colors and scale lengths must come from tokens, so a project needs somewhere for
them to come from. Nagi CSS ships the **names** and none of the values: paste this
into `src/tokens/semantic.css`, then replace every value with the design's own.

```css
:root {
  /* Colors are roles: there is no ordering that makes `--color-3` mean anything. */
  --color-surface: #ffffff;
  --color-text: #18181b;
  --color-text-muted: #71717a;
  --color-border: #e4e4e7;
  --color-accent: #2563eb;
  --color-accent-text: #ffffff;
  --color-danger: #dc2626;
  --color-danger-text: #ffffff;

  /* Scales are numeric: `sm`/`md`/`lg` runs out and invites `xxl`. */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;
  --space-7: 3rem;
  --space-8: 4rem;

  --radius-1: 0.25rem;
  --radius-2: 0.5rem;
  --radius-3: 1rem;

  --border-width-1: 1px;
  --border-width-2: 2px;

  --font-size-1: 0.75rem;
  --font-size-2: 0.875rem;
  --font-size-3: 1rem;
  --font-size-4: 1.25rem;
  --font-size-5: 1.5rem;
  --font-size-6: 2rem;

  --shadow-1: 0 1px 2px rgb(0 0 0 / 0.05);
  --shadow-2: 0 4px 12px rgb(0 0 0 / 0.08);
  --shadow-3: 0 12px 32px rgb(0 0 0 / 0.12);

  /* Stacking levels are roles for the same reason colors are. */
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-modal: 300;
  --z-toast: 400;
}
```

Point the config at it, and at any primitive palette it is built from:

```js
...nagiCss.configs.recommended({
  surfaceRootPrefixes: ["app-"],
  tokens: {
    sources: [{ file: "src/tokens/semantic.css", layer: "semantic" }],
  },
})
```

Those two checks — that a referenced token exists, and that it comes from the
semantic layer rather than a raw palette — stay inactive until `sources` names a
file. The names above are defaults a project can rename through `tokens.semantic`;
what they buy is that an agent knows to reach for `--space-3` without being told
this project's vocabulary first.

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
ESLint.

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
