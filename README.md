# Nagi CSS

**CSS, after the wind. A lint-enforced semantic contract — every class name
has exactly one correct answer, so humans and AI agents converge on the same
output.**

Nagi CSS is a semantic contract and lint toolchain for styling owned markup in
component-based applications. Class names are *derived* — from the configured
surface namespace and file name,
from element and component tables, from a structural ladder — rather than
chosen, and ESLint and Stylelint verify every derivation: template classes,
cross-block contracts, selector structure, ownership edges, and UI-library
boundaries. The CLI accepts configuration from outside the application being
checked, so a target repository needs no lint setup of its own. The toolchain
targets Vue single-file components first; the contract itself is
framework-agnostic.

*Nagi (凪, "NAH-ghee") is Japanese for the calm when the wind dies down — the
state a codebase reaches when naming entropy stops. (Yes, the linter is a bit
naggy. That's the point.)*

[CONTRACT.md](CONTRACT.md) defines the contract; [FAQ.md](FAQ.md) explains why
the design holds and answers common objections.

## Before / after

Familiar-looking Vue that Nagi CSS rejects:

```vue
<template>
  <section class="user-card">
    <span :class="iconName" />
    <div :class="{ 'is-active': status === 'active' }">Ada Lovelace</div>
  </section>
</template>

<style scoped>
.user-card div {
  color: red;
}
</style>
```

```
UserCard.vue
  13:1   ✖  Selector ".user-card div" uses " " between owned elements; use ">".         nagi-css/owned-dom-direct-child
  13:12  ✖  Selector ".user-card div" styles bare <div> inside owned DOM; use a class.  nagi-css/bare-element-selector
   7:5   ✖  Dynamic classes may only supplement a static owned class on the same element   nagi-css/dynamic-class-requires-static-anchor
   8:5   ✖  Class "is-active" encodes runtime state; use a native, ARIA, or data attribute instead  nagi-css/state-not-class
```

The conforming version — every name static, derived, and checkable; runtime
state in attributes:

<!-- nagi-check file=src/components/UserCard.vue -->
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
  > .value {
    color: red;
  }
}
</style>
```

Each rule is doing structural work: `app-user-card` is the surface identity
derived from the configured prefix and `UserCard.vue`; `icon` and `value` come from the configured
anatomy vocabulary; `>` marks an owned parent-child DOM edge, so
the selector tree mirrors the template; the dynamic icon class rides on a
static anchor; and `data-active` keeps state where assistive technology and
CSS attribute selectors both already look.

## Why

Not for the problems component boundaries already solved. Scoped styles ended
collisions, leakage, and ownership disputes, and the contract assumes that
world rather than re-litigating it. What no boundary provides is a
**canonical form** for its inside: given the markup, the correct class for a
node is unique. That is what makes the
contract machine-checkable, what lets a linter drive any author — human or
model — to the same answer, and what keeps a large codebase from silently
accumulating entropy. Names carry meaning in the source
(`<section class="app-user-card">` self-documents), diffs are a changed property
in a named rule rather than a mutated utility string, and dead rules are
mechanically detectable because selectors mirror template structure.

The costs are real: styles are not local to the element, and the structural
vocabulary must be learned. [FAQ.md](FAQ.md) treats both honestly, alongside
the Tailwind and BEM comparisons.

## UI-library boundaries

Nagi CSS never inspects a dependency's internal DOM. Configured component
roots are opaque boundaries: cross them with a descendant step, then resume
owned `>` nesting at a declared slot sub-surface.

```vue
<style scoped>
.orders-page {
  > .ui-data-table {
    .ui-table-column-body {
      > .value {}
    }
  }
}
</style>
```

## Checks

ESLint enforces:

- exact configured-prefix + file-derived surface root names;
- static anchors for dynamic classes;
- fixed element and component classes, including `when-styled` emission;
- exactly one table-first base identity class per element;
- anatomy, role names, reserved HTML names, and alphabetical variants;
- variant names that stay outside the base-identity vocabulary, and outside a
  role name the element itself declares;
- attribute-based runtime state, including variants kept out of class bindings so
  a variant cannot express state;
- owned child components styled by their own derived surface root, with no class
  passed to the tag;
- the STN floor, consecutive-tier, and reach-`g` rules;
- component slot configuration;
- style blocks the toolchain cannot read, rather than skipping them; and
- autofixes for every rule whose correct output the contract computes: missing
  fixed classes, the file-derived surface root name, STN tiers, and variant order.

Stylelint enforces:

- surface-only top-level selectors;
- class selectors instead of bare owned elements;
- `>` for owned DOM edges;
- selector chains that match the template they target, so a rule whose anchor
  class is absent, or whose path does not exist, is reported;
- descendant steps across configured UI-library boundaries;
- owned child component roots as boundaries: their placement may be styled, their
  insides may not, derived from the component tag rather than configuration;
- nested, component-prefixed slot sub-surfaces;
- exactly one base identity class per selector compound;
- anatomy and state vocabulary in selectors;
- variant names that stay outside the protocol vocabulary, including ARIA roles;
- no external layout (`position`, inset, `margin`, `z-index`) on a surface's own
  rule, with a top-layer and anchor-positioning exception — where that exception
  applies, the stacking level itself must come from a token;
- explicit detached configuration for top-level teleported surfaces;
- colors written as a token reference rather than a raw value;
- lengths on scale properties (spacing, radius, border width, type size,
  elevation) written as a token or as a named `--local-*` one-off; and
- token references that resolve, and that read the semantic layer rather than
  primitives, where the project declares its token sources.

## Usage

Run Nagi CSS from this repository without adding lint configuration to the
target repository:

```sh
node packages/cli/src/cli.mjs check \
  --config /absolute/path/to/nagi.config.mjs \
  --cwd /absolute/path/to/application
```

A minimal configuration:

```js
export default {
  eslintFiles: ["src/**/*.vue"],
  stylelintFiles: ["src/**/*.vue"],
  semantic: { surfaceRootPrefixes: ["app-"] },
}
```

`semantic.surfaceRootPrefixes` is required and must contain at least one
lowercase kebab prefix ending in `-`. The `semantic` object also configures
component classes, slot surfaces, library boundary prefixes, emit policy, and vocabulary — see
[skills/nagi-css/references/configuration.md](skills/nagi-css/references/configuration.md).
For opaque UI components, `componentClasses: ["DataTable"]` derives
`pv-data-table`; explicit mappings remain available for exceptions. Do not list
application-owned Vue components in that table.

`--fix` writes the answer for every rule the contract computes: a missing fixed
class, the surface root name derived from the file, an STN tier that follows from
its chain, and variant order. Anatomy choices, state migration, ownership edges,
and anything else needing a decision are reported and left alone.

Every rule is an error by default. `severity` changes that per rule, with `*` as
the fallback, so an existing codebase can adopt the contract without turning the
first run into thousands of failures:

```js
export default {
  eslintFiles: ["src/**/*.vue"],
  stylelintFiles: ["src/**/*.vue"],
  severity: {
    "*": "warn",              // report everything, fail on nothing yet
    "surface-root-name": "error",  // except the names to fix first
    "variant-order": "off",   // a rule the project has decided against
  },
  semantic: { surfaceRootPrefixes: ["app-"] },
}
```

Warnings are reported but do not fail the run; `off` removes the rule. An
unknown rule name is a configuration error, so a typo cannot silently disable a
check. Treat `warn` as a step during adoption — the intended steady state is
errors in CI.

One category defaults to `warn` on purpose: rules that report what the toolchain
**could not verify**, rather than a violation. `unverifiable-dynamic-class` covers
a class binding whose names are assembled at runtime (`:class="iconName"`), where
the code is probably fine but no rule can see the classes it applies. Setting
`"*"` or the rule itself overrides that default in either direction.

Colors must come from a token: `color: #f0a` and `border: 1px solid rgb(0 0 0 / .1)`
are `value-token-required` errors, with no `--local-*` escape, because a color is
never a local decision. `currentColor`, `transparent`, and the system colors are
not colors in that sense and pass.

Lengths on the properties a design system publishes as a scale — spacing, radius,
border width, type size, elevation — are `length-token-required`. A genuine one-off
is allowed but must be named, `--local-optical-nudge: -1px`, so the exception says
why it exists and can be grepped. A surface's own size and position
(`max-inline-size: 32rem`, `top: 12px`), ratios, relative units, zero, angles, and
durations are not scale values and pass.

Neither check needs configuration — both ask only that a token is used, not which
one. They are separate rules so colors can be adopted first.

Nagi CSS ships no design tokens — which values exist is the design system's call.
Point it at the files that declare them and it checks the rest of the boundary:

```js
semantic: {
  surfaceRootPrefixes: ["app-"],
  tokens: {
    sources: [
      { file: "src/tokens/palette.css", layer: "primitive" },
      { file: "src/tokens/semantic.css", layer: "semantic" },
    ],
    exposedPrefixes: ["--pv-datepicker-"],
  },
}
```

Paths are resolved against `--cwd`. Sources are read as data, never linted. A
referenced custom property that no source declares is `unknown-token`, an error
because CSS swallows the typo silently; a primitive referenced from a surface is
`token-layer`. These two stay inactive until `sources` names a file, since without
it there is nothing to compare against. Exempt: a property the same stylesheet
declares — including the `--local-*` one-off escape (`tokens.localPrefix`) — and
prefixes a library exposes as its public styling contract
(`tokens.exposedPrefixes`), which also decides fallbacks: `var(--color-text, #333)`
states a raw color, `var(--pv-datepicker-fg, #333)` documents an exposed default.

## Scope

The toolchain checks **Vue single-file components**: the template together with
the component's own `<style>` blocks, written in **plain CSS**.

Two things are deliberately out of scope:

- **Preprocessor syntax** — Sass/SCSS, Less, Stylus. Native nesting and custom
  properties already cover what the contract needs, and the features that remain
  specific to a preprocessor are ones the contract forbids or cannot verify. See
  [CONTRACT.md](CONTRACT.md#preprocessor-syntax-is-outside-the-contract).
- **Standalone `.css` files** — global stylesheets carry resets, element
  defaults, token declarations, and cross-surface exceptions. None of that is a
  surface's owned styling, which is the only thing this contract governs.

Either could be added if a concrete need appears; neither is designed around in
advance. A style block the toolchain cannot read — a `lang` it does not support,
or styles pulled in through `src` — is reported rather than skipped, so passing
checks means the styles were actually read.

## Agent skill

`skills/nagi-css` packages the contract as an agent workflow: what to derive,
in what order, and how to verify the result with the CLI. An agent applies
the skill; the linter proves the output conforms. This closed loop — generate
against a deterministic contract, then machine-check it — is the intended way
to keep AI-written CSS consistent at scale.

## Repository layout

- `packages/core` - shared configuration and validation
- `packages/eslint-plugin` - template and cross-block rules
- `packages/stylelint-plugin` - selector and stylesheet rules
- `packages/cli` - external-config runner for ESLint and Stylelint
- `skills/nagi-css` - agent workflow for applying the contract

Local target profiles and runner scripts belong under `.sandbox/`. That
directory is ignored and must not contain code intended for publication.

Run the package tests with `pnpm test`.

## License

[MIT](LICENSE)
