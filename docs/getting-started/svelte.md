# Set up Nagi CSS with Svelte

Nagi CSS extends `eslint-plugin-svelte` and checks Svelte markup, class
directives, blocks, and component styles through the same ESLint run.

## 1. Install

```sh
vp add -D eslint eslint-plugin-svelte @nagi-labs/eslint-plugin-nagi-css
```

## 2. Extend `eslint.config.mjs`

```js
import svelte from "eslint-plugin-svelte"
import nagiCss from "@nagi-labs/eslint-plugin-nagi-css"

export default [
  svelte.configs.recommended,
  ...nagiCss.configs.recommended(
    {
      surfaceRootPrefixes: ["app-"],
    },
    {
      files: ["src/**/*.svelte"],
    },
  ),
]
```

Keep any TypeScript or SvelteKit settings already present in the project. Nagi
CSS does not supply or override the Svelte parser.

## 3. Give the component a derived surface

<!-- nagi-check file=src/components/UserCard.svelte prefix=app- -->
```svelte
<script>
  let active = false
</script>

<article class="app-user-card" data-active={active}>
  <h2 class="title">Ada Lovelace</h2>
  <p class="p">First programmer</p>
</article>

<style>
  .app-user-card {
    > .title {}
    > .p {}
  }
</style>
```

Svelte styles are component-scoped by default. `class:name={condition}` is
analyzed as a dynamic class and must accompany a static owned anchor.

## 4. Run ESLint

```sh
vp exec eslint .
```

A separate Nagi configuration file is not required. `<style>` must remain
plain CSS; `lang="scss"` and external style sources are reported.

SvelteKit route files such as `+page.svelte` and `+layout.svelte` do not yet
have route-aware surface-name normalization. Start with ordinary component
paths such as `src/lib/**/*.svelte`.

Continue with the [shared configuration reference](https://github.com/nagi-labs/nagi-css/blob/main/skills/nagi-css/references/configuration.md).
