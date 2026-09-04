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
   - Only for `div`/`span`, apply the Semantics model: Accessibility Semantics (ARIA role) → allowlisted UI Anatomy (`field`, `value`, `actions`, `media`, `icon`) → STN (leaf-anchored ladder with a `unit` floor: `stratum`/`region`/`block`/`unit`/`seg`/`fr`/`g`).
   - `text` is UI Anatomy for a short textual run or UI label on `div` / `span`
     (normally `span`); a prose paragraph uses the Element Class Table identity
     `<p class="p">`. Anatomy never replaces a semantic element's fixed identity.
   - A class equal to a rendered element name appears only on that element. There is no blanket exemption for document-only names: `.body` belongs to `<body>` and is invalid on a content `<div>`. Deliberate mappings such as `.title` on `<h1>`–`<h6>` and `.link` on `<a>` remain valid.
   - Keep exactly one base identity. Additional ARIA semantics on a table-mapped element stay in the attribute: `<li class="item" role="separator">` with `.item[role="separator"]`. Only the residual `div`/`span` step may use the matching role name as its base.

4. Add variants.
   - Use variants for styling role, density, size, domain meaning, and utility-like concerns.
   - Multiple variants are allowed and must be written in alphabetical order.
   - ARIA role names are protocol vocabulary and cannot be copied into variants (`-separator`, `-toolbar`).
   - Example: `class="footer -dense"`.

5. Express runtime state without classes.
   - Prefer native states and pseudo-classes.
   - Use ARIA state attributes when accessibility state is required.
   - Use `data-*` only as an explicit styling contract when native or ARIA state is not appropriate.
   - Do not add ARIA merely to control visual presentation. ARIA controls
     accessibility-tree exposure, not visual hiding.
   - For content that is visually concealed but remains exposed to assistive
     technology, style its derived base selector directly. Do not add
     `-assistive` or `-sr-only` merely to name the treatment.

6. Classify every design value.
   - Use semantic tokens for repeated visual rhythm: colors, spacing, radius,
     border width, type size, and elevation.
   - Keep component geometry and functional values as ordinary CSS: a surface's
     own size or position, ratios, relative units, zero, and angles are not scale
     tokens merely because they contain a number.
   - For a genuine one-off optical correction, declare a descriptive
     `--local-*` custom property in the same stylesheet. Colors have no local
     escape; derive them from a semantic token or add a theme-level token.
   - If the value should recur across components, promote it to the semantic
     token source rather than copying a local value.

7. Verify with the linter.
   - Run the project's normal ESLint command and fix diagnostics at their owning markup or selector.

## Example

```html
<article class="invoice-card">
  <header class="header">
    <h3 class="title">Invoice</h3>
  </header>
  <div class="unit">
    <dl class="list">
      <div class="field -user">
        <dt class="term">User</dt>
        <dd class="definition">A. Customer</dd>
      </div>
    </dl>
  </div>
  <footer class="footer -dense">...</footer>
</article>
```

## Avoid

```html
<article class="invoice-card">
  <div class="invoice-header">
    <h3 class="invoice-title">Invoice</h3>
  </div>
  <div class="content visually-hidden">...</div>
</article>
```

Problems:

- Domain Semantics appear in internal style element names.
- Generic `content` is not deterministic for internal elements. It is acceptable only when it comes from a public contract such as a named slot surface.
- `visually-hidden` is a standalone utility and `content` is not a derived base.
- Native element names must not be reused on other elements.
