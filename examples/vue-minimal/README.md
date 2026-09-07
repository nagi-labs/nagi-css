# Nagi CSS Vue example

This is an independent consumer workspace. It installs the published
`@nagi-labs/eslint-plugin-nagi-css` 0.5.0 package from npm and does not resolve
any package from the parent repository.

[Open the example in StackBlitz](https://stackblitz.com/fork/github/nagi-labs/nagi-css/tree/main/examples/vue-minimal?startScript=dev)

## Run locally

Requirements: Node.js 22.18 or newer and Vite+.

Clone the repository, enter this independent workspace, and run:

```sh
git clone https://github.com/nagi-labs/nagi-css.git
cd nagi-css/examples/vue-minimal
vp install --frozen-lockfile
vp run lint
vp run build
vp run dev
```

The page contains two formatting buttons. Their Vue state is exposed through
`aria-pressed`, and the CSS selects that real accessibility state instead of a
state class.

## Break the role-derived identity

In `src/format-controls.vue`, temporarily change the element with
`role="group"` from `class="group"` to `class="unit"`, then run:

```sh
vp run lint
```

Because the `div` has an identifying role, its canonical base identity is
`group`. `unit` is not a valid fallback on that element. Restore `group` before
continuing.

## Break the owned selector path

In the same component, temporarily place a `.button` rule directly under
`.unit`:

```css
> .unit {
  > .button {}
}
```

Run `vp run lint` again. The class exists, but the selector is stale: the actual
owned path is `.unit > .group > .button`. Remove the temporary rule to return
the checkout to zero errors.

`editor-panel.vue` demonstrates the component boundary separately. It places
the child through `.app-format-controls`, but never reaches into the child's
`.unit`, `.group`, or `.button` elements.
