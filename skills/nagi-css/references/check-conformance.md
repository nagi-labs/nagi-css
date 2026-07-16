# Check Conformance

Use this checklist when reviewing markup/CSS against the Nagi CSS contract.

Run `nagi-css check` with the project's external configuration first — the
linter decides the mechanical rules. This checklist covers review framing and
the judgments the linter cannot make.

## Checklist

- Styling Surface:
  - Each surface has one identifying class derived from its file.
  - Domain Semantics are allowed here when they identify the whole surface.
  - The HTML structure is decided before class names are reviewed.

- Owned DOM:
  - Strict rules are applied only where the surface controls structure, attributes, classes, and state representation.
  - Non-owned DOM is handled through public contracts.
  - Component library wrappers, named slots, portals, and shadow DOM are classified before reviewing names.
  - Slot content styled by this component is modeled as a declared slot sub-surface when a third-party component sits between it and the parent surface.

- Style Elements:
  - Native HTML element semantics are used before class naming workarounds.
  - **STN in bulk is a smell — check for skipped semantic tags.** For each `div`/`span` carrying a STN tier, ask whether a more specific semantic element (`section`, `nav`, `header`, `footer`, `aside`, `article`, `ul`/`ol`/`li`, `dl`, `figure`, `time`, …) fits. If it does, it should be that element (self-documenting, Element-Table class), not a `div` + STN tier. A region that reads as a section/nav/list flagged as `block`/`stratum` is a finding.
  - A class matching a rendered HTML element name appears only on that element or on an element the tables deliberately map to it. There is no blanket exemption for document-only names: `.body` belongs to `<body>`.
  - Native element names are not reused as hyphen-delimited class segments for different meanings.
  - `p`, `dl`, `dt`, and `dd` are not overused for layout or component-internal display.
  - `p` is used only for prose paragraphs, not generic text containers.
  - `dl`, `dt`, and `dd` are used only for clear name-value or term-description lists.
  - Layout and component-internal display use `div` or `span` by default unless stronger native semantics are clearly needed.
  - Base names come from Accessibility Semantics, allowlisted UI Anatomy Semantics, or STN.
  - Domain Semantics do not appear in internal style element names.
  - Vague names such as `wrapper`, `container`, `inner`, `box`, `thing`, and `content-area` are avoided.

- Variants:
  - Variants start with `-` and are written in alphabetical order.
  - Variant stems stay outside the contract vocabulary: element classes, component classes, anatomy, STN tiers, slot surfaces, banned generic names, and rendered element names are not variant stems (`-title`, `-header`, `-wrapper`, `-span`).
  - Multiple variants are allowed.
  - Domain distinctions inside a surface are variants only when they create a styling or UI role distinction.
  - Raw data/content categories are not variants, such as `-description` for a field named description.
  - Utility-like concerns are variants.

- Utilities:
  - Standalone utility classes are not used.

- State:
  - Runtime state is not represented by classes.
  - Use native state first, ARIA state second, `data-*` third.
  - `data-*` is only used as an explicit styling contract.

- CSS:
  - The main surface selector is top-level.
  - Nested surface selectors are placed under the nearest owned scope when they remain in that rendered DOM subtree.
  - Teleported or otherwise detached surfaces stay top-level only when declared in `detachedSlotSurfaces`.
  - Style element selectors are nested under their owning parent block.
  - Owned elements are styled through classes, not native element selectors.
  - `>` connects every owned parent→child step (MUST). A step that cannot use `>` is a non-owned boundary, not a descendant selector.
  - UI library boundary classes are edge-checked: owned → boundary class (`pv-*` by default) uses `>`, boundary class → declared slot sub-surface uses a descendant step, and owned DOM after that resumes `>`.
  - Descendant combinators are used only to anchor a nested surface across a library/slot/shadow boundary, not for ordinary style-element traversal.
  - No bare style-element selectors at CSS top level inside owned DOM.
  - Full descendant paths are not flattened when readable nesting can express the same owned structure.
  - Selectors do not cross third-party internals or named slot insertion boundaries.
  - A class placed on a third-party component root is not used as proof that slotted markup is a direct owned descendant.
  - External layout responsibility stays outside reusable surfaces.

## Finding Format

When reviewing, report findings first.

For each issue, include:

- severity
- file and line
- current pattern
- contract rule violated
- suggested replacement

## Quick Examples

Bad:

```html
<article class="invoice-card">
  <div class="invoice-header">
    <h3 class="invoice-title">Invoice</h3>
  </div>
</article>
```

Good:

```html
<article class="invoice-card">
  <header class="header">
    <h3 class="title">Invoice</h3>
  </header>
</article>
```

Bad:

```html
<footer class="footer sr-only">...</footer>
```

Good:

```html
<footer class="footer -sr-only">...</footer>
```
