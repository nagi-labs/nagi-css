# Nagi CSS

**CSS, after the wind.** Nagi CSS is a lint-enforced structural contract for
component-owned CSS. It derives names from explicit evidence, validates applicable
definitions, and makes Predefined, Defined, Unregistered, and Structural names
visible. Lint and
measurement use the same analysis.

[Website](https://nagi-labs.github.io/nagi-css/) ·
[Documentation](docs/getting-started/index.md) ·
[Contract](CONTRACT.md)

It keeps semantic classes and selectors in component-owned CSS, with no runtime
of its own. Plain CSS is the stable declaration backend. An experimental,
explicit `tailwind-apply` compatibility backend lets an owned implementation use
Tailwind `@apply` without putting utility classes in its template. One ESLint
plugin checks the component template and its `<style>` blocks together across
Vue, Nuxt, Svelte, and Astro.

## Install

Role names determine base classes; purposes add static variants without replacing
the base. For example, `data-role="range/fill"` uses `.fill`, while
`data-purpose="pagination/next"` uses `.button.-next` or `.link.-next`.
Projects and libraries can register either kind through the same
[scoped definition format](docs/definitions.md). Purpose definitions may constrain
their target HTML element or ARIA role. Existing HTML class names are unchanged.

Requirements:

- Node.js 22.18 or newer
- ESLint 9 or newer
- component-owned `<style>` blocks whose selectors remain statically readable

```sh
npm install --save-dev @nagi-labs/eslint-plugin-nagi-css
```

Using pnpm or Vite+? Use the equivalent development-dependency command for
your package manager.

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

## Try the example

[Open the Vue example in StackBlitz](https://stackblitz.com/fork/github/nagi-labs/nagi-css/tree/main/examples/vue-minimal?startScript=dev),
or clone this repository and change into [`examples/vue-minimal`](examples/vue-minimal).
The example pins the published npm plugin and can be installed, linted, built,
and run without resolving this repository's workspace packages. Detailed local
commands and intentional breakage exercises are in the
[example README](examples/vue-minimal/README.md).

## What it enforces

Surface ownership, base role, variants/state and CSS structure form one contract:

- the surface root from the configured prefix and component filename;
- fixed classes from HTML elements and configured UI components;
- internal roles classified as Predefined, Defined, Unregistered, or Structural;
- native/ARIA Predefined names and described Built-in Anatomy/Custom definitions;
- scoped JSON role definitions with optional role descriptions, selected by static `data-role="scope/role"`
  markers, with required declaration checks;
- unregistered semantic names allowed with warnings while CSS validation continues;
- static modifiers, attribute state, and legitimate shared STN sibling selectors;
- selectors that mirror owned DOM with `>` and stop at component boundaries;
- semantic token references for colors and repeated design-system scale values,
  while component geometry stays plain CSS and genuine one-off optical
  corrections use descriptive `--local-*` values.

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

Visual visibility and accessibility-tree exposure remain separate. ARIA states
may be selected when they already describe real component state, but ARIA must
not be invented as a styling hook. Content that is visually concealed while
remaining available to assistive technology is styled through its derived base
selector rather than an `-assistive` or `-sr-only` class. See
[Visual hiding and the accessibility tree](docs/css-reference.md#visual-hiding-and-the-accessibility-tree).

## Define and measure

The redesigned source API accepts `roleDefinitions` containing scoped JSON
objects or independent local JSON paths. `loadRoleDefinition` reads JSON safely;
`data-role="scope/root"` establishes an instance and custom roles use the same
fully qualified attribute without adding ARIA behavior. See the
[definition reference](docs/definitions.md) and
[Vue/Svelte/Astro examples](examples/custom-roles/README.md).

`nagi-css measure --config nagi.config.mjs --cwd . --json` reports internal
styled declarations as Predefined / Defined / Unregistered / Structural, keeping
surfaces, boundaries and unknowns separate. Predefined names and author-selected
definitions are reported separately. The [0.7.0 migration guide](docs/migrations/0.7.md)
covers the new APIs and configuration diagnostics; the pinned Vue starter still
uses 0.5.1 until publication. Maintainers verify candidate tarballs in isolated
consumers before publishing, as described in the [release guide](docs/RELEASING.md).
Unresolved behavior bundles remain explicit diagnostics; adopting these APIs
does not require a UI library to redesign its behavior API. Consumer migration
findings are assessed separately from analyzer defects and package failures.

## Documentation

- [Definition model migration](docs/migrations/defined-roles.md)
- [Definition and measurement specification](docs/definitions.md)
- [Built-in Anatomy definitions](docs/anatomy-definitions.md)

- [Contract](CONTRACT.md) — the complete naming, selector, ownership, and value rules
- [FAQ](FAQ.md) — design rationale, tradeoffs, and comparisons
- [Configuration reference](skills/nagi-css/references/configuration.md) — UI libraries, slots, severity, emit policy, and tokens
- [Agent instructions](AGENTS.md) — portable rules for agents editing components
- [Agent skill](skills/nagi-css) — the complete generate-and-verify workflow
- [Migrating to 0.5](docs/migrations/0.5.md) — component-name matching and stacking diagnostics
- [Migrating to 0.4](docs/migrations/0.4.md) — peer-based variant rules
- [Migrating to 0.3](docs/migrations/0.3.md) — lint behavior and configuration changes

## Packages

- `@nagi-labs/eslint-plugin-nagi-css` — standard template and component-style integration
- `@nagi-labs/nagi-css-core` — shared configuration and semantic analysis
- `@nagi-labs/nagi-css` — optional standalone runner for external configurations

The ESLint plugin is the normal entry point. The standalone runner supports
external configurations and projects that use another primary linter.

## Scope

Nagi CSS checks Vue, Svelte, and Astro component templates together with their
CSS `<style>` blocks. Nuxt is supported through Vue's parser and Nuxt's generated
ESLint config. The default `plain` declaration mode needs no additional CSS
compiler. `tailwind-apply` requires the application to provide Tailwind's build
integration and remains experimental; its coverage and API may change
before it is promoted to a stable backend.

Preprocessor syntax and standalone `.css` files are outside the component-owned
contract. Global resets, token declarations, and cross-surface exceptions remain
the application's responsibility. See the [contract](CONTRACT.md) for the exact
boundary.

## Acknowledgements

Nagi CSS would not exist in its current form without
[RSCSS](https://ricostacruz.com/rscss/) by
[Rico Sta. Cruz](https://ricostacruz.com/).

RSCSS showed me that a small set of conventions—thinking in components, naming
elements locally, and using direct-child selectors to protect component
boundaries—could make CSS dramatically easier to reason about.

Nagi CSS takes those ideas in a more mechanically enforceable direction,
deriving names from HTML and checking ownership boundaries statically. But its
starting point is unmistakably RSCSS.

Thank you, Rico, for publishing an approach that has shaped how I think about
CSS for years.

## Development

Install dependencies and run the test suite through Vite Plus:

```sh
vp install
vp run test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) before changing vocabulary or rule
behavior. Maintainers should follow the [release guide](docs/RELEASING.md) when
publishing packages.

## License

[MIT](LICENSE), by nagi-labs contributors.
