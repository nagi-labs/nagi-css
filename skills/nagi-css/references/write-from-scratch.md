# Write From Scratch

Use this when creating new markup and CSS under the Nagi CSS contract.

## Workflow

1. Decide the Styling Surface.
   - Decide the HTML structure before assigning classes. Use [naming-flow.md](naming-flow.md) for the element and class naming decision tree.
   - **Choose semantic tags first — this is where you decide how much STN you'll need.** Reach for the most specific semantic element that fits (`<section>`, `<nav>`, `<header>`, `<footer>`, `<aside>`, `<article>`, `<ul>`/`<li>`, `<dl>`, `<figure>`, `<time>`, `<h1>`–`<h6>`, `<button>`, `<a>`, `<label>`, `<table>`…). Each one leaves the `div`/`span` judgment and takes a fixed Element-Table class; reserve `div`/`span` (→ STN) for genuinely meaningless layout/grouping. More semantic markup = fewer, shallower STN names.
   - Use a surface class that identifies the UI surface.
   - Domain Semantics may appear here when they identify the whole surface, such as `user-profile` or `invoice-card`.

2. Define owned DOM.
   - Only name elements whose structure, attributes, classes, and state representation are controlled by the surface.
   - Treat slots, third-party internals, portals, and shadow internals as non-owned unless explicitly exposed by contract.
   - If a component library wrapper or named slot is involved, read [component-library-boundaries.md](component-library-boundaries.md) before choosing names.
   - Do not treat a parent surface, third-party wrapper, and slotted markup as one direct owned tree.

3. Pick style element base names — table-first, follow [naming-flow.md](naming-flow.md).
   - HTML element ≠ `div`/`span`: take the fixed class from the Element Class Table (no judgment).
   - Configured library component: take the fixed class from the Library Component Class Table (no judgment).
   - Only for `div`/`span`, apply the Semantics model: Accessibility Semantics (ARIA role) → allowlisted UI Anatomy (`field`, `value`, `actions`, `media`, `icon`) → STN (leaf-anchored ladder with a `zone` floor: `stratum`/`region`/`block`/`zone`/`seg`/`fr`/`g`).
   - A class equal to a rendered element name appears only on that element. There is no blanket exemption for document-only names: `.body` belongs to `<body>` and is invalid on a content `<div>`. Deliberate mappings such as `.title` on `<h1>`–`<h6>` and `.link` on `<a>` remain valid.

4. Add variants.
   - Use variants for styling role, density, size, domain meaning, and utility-like concerns.
   - Multiple variants are allowed and must be written in alphabetical order.
   - Example: `class="footer -sr-only -toolbar"`.

5. Express runtime state without classes.
   - Prefer native states and pseudo-classes.
   - Use ARIA state attributes when accessibility state is required.
   - Use `data-*` only as an explicit styling contract when native or ARIA state is not appropriate.

6. Verify with the linter.
   - Run `nagi-css check` with the project's external configuration and fix diagnostics at their owning markup or selector.

## Example

```html
<article class="invoice-card">
  <header class="header">
    <h3 class="title">Invoice</h3>
  </header>
  <div class="zone">
    <dl class="list -description">
      <div class="field -user">
        <dt class="term">User</dt>
        <dd class="definition">A. Customer</dd>
      </div>
    </dl>
  </div>
  <footer class="footer -sr-only -toolbar">...</footer>
</article>
```

## Avoid

```html
<article class="invoice-card">
  <div class="invoice-header">
    <h3 class="invoice-title">Invoice</h3>
  </div>
  <div class="content sr-only">...</div>
</article>
```

Problems:

- Domain Semantics appear in internal style element names.
- Generic `content` is not deterministic for internal elements. It is acceptable only when it comes from a public contract such as a named slot surface.
- `sr-only` is a standalone utility instead of a variant.
- Native element names must not be reused on other elements.
