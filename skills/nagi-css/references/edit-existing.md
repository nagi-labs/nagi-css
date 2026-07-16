# Edit Existing Markup and CSS

Use this when revising existing markup/CSS to follow the Nagi CSS contract.

## Workflow

1. Preserve behavior first.
   - Do not rename classes blindly if scripts, tests, or external consumers depend on them.
   - Search for references before renaming.

2. Identify surfaces.
   - Confirm the HTML structure before renaming classes. Use [naming-flow.md](naming-flow.md) when an element could be a native semantic element, ARIA role, UI anatomy name, or STN.
   - **Upgrade generic `div`/`span` regions to semantic elements where they carry meaning** — a "section" div → `<section>`, a nav → `<nav>`, a list → `<ul>`/`<li>`, a card/region header → `<header>`, page furniture → `<footer>`/`<aside>`. Each upgrade removes a STN tier and makes the structure self-documenting. Heavy STN usage after migration usually means semantic tags were left on the table.
   - Promote stable component roots to Styling Surface names.
   - Keep Domain Semantics in surface names when they identify the whole surface.
   - If the existing surface is a component library wrapper, named slot, portal, or shadow boundary, read [component-library-boundaries.md](component-library-boundaries.md).
   - Do not preserve a parent surface model that reaches through third-party internals or slot insertion structure.

3. Drop wrappers that don't earn their place.
   - A `div`/`span` earns its place only if it is a styling surface, **groups two or more children that must be laid out or styled together**, carries an Accessibility/Anatomy meaning, or is a STN node with actual styled purpose.
   - Remove a wrapper that ends up holding a single (visible) child — e.g. a group whose siblings are `display:none` or were deleted — and promote the child in its place. Delete permanently hidden / dead elements rather than keeping them plus their wrapper.
   - Fewer wrappers = shallower nesting = lower STN tiers and fewer STN elements. This is the everyday complement to "split when too deep" (CONTRACT.md §"Depth is capped"): also **collapse** a level that adds nothing.
   - Example: `<div class="zone"><h1 class="title"/><p class="text -subtitle"/></div>` where the subtitle is always `display:none` → delete the subtitle and the wrapper, leaving `<h1 class="title"/>` directly under the header.

4. Normalize internal style elements.
   - Replace domain-heavy internal names with Accessibility Semantics, allowlisted UI Anatomy Semantics, or STN.
   - Do not keep native element names as class names on other elements. For example, replace `div.body`, `p.details`, `span.label`, and `section.summary`.
   - Replace generic `p` text containers with `span`, `div`, `dl`, `dt`, `dd`, or lists when the content is not prose.
   - Move domain meaning into variants when it affects styling.
   - Do not move raw data/content categories into variants. For example, avoid `-description` when it only identifies the source field.

5. Convert utilities to variants.
   - Replace standalone utility classes with variants on the owned surface or element.
   - Example: `class="footer sr-only"` becomes `class="footer -sr-only"`.

6. Fix state classes.
   - Replace `is-*`, `has-*`, and runtime `-*` state classes with native state, ARIA, or `data-*`.
   - Use `data-*` only as a deliberate styling contract.

7. Respect non-owned boundaries.
   - Do not chase third-party or slotted internals.
   - Use the public contracts listed in CONTRACT.md §"Appendix: Non-owned Boundaries" instead.
   - Split styled slot content into independent owned surfaces when it must carry local CSS.

8. Verify with the linter.
   - Run `nagi-css check` with the project's external configuration; use `--fix` only for unambiguous missing fixed classes.

## Common Refactors

Domain-heavy internal names:

```html
<article class="invoice-card">
  <div class="invoice-header">
    <h3 class="invoice-title">Invoice</h3>
  </div>
</article>
```

Refactor:

```html
<article class="invoice-card">
  <header class="header">
    <h3 class="title">Invoice</h3>
  </header>
</article>
```

Utility class:

```html
<footer class="footer sr-only">...</footer>
```

Refactor:

```html
<footer class="footer -sr-only">...</footer>
```
