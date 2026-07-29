# Contract Reference

## Ownership

- Give every styled surface a static identity class.
- Keep exactly one table-first base identity class on each element and selector compound.
- Connect styled owned parent-child edges with `>`.
- Write every selector chain so it matches the template it targets: the linter walks
  the owned tree, so a rule whose anchor class is absent (`dead-rule`) or whose path
  does not exist (`selector-mirrors-template`) is reported.
- Use classes for owned styling targets; do not target bare owned elements.
- Keep runtime state in native, ARIA, or `data-*` attributes.
- Derive a surface name exactly from its configured namespace prefix and Vue component or routed page file.
- Use only configured anatomy, element, component, STN, slot, or matching role names below a surface.
- Keep `-variant` classes alphabetical.
- Keep `-variant` names outside the vocabulary (element, component, anatomy, STN, slot, ARIA role, banned, and rendered element names). Variants modify an anchor; they never name what an element is. If a variant wants a vocabulary word (`-title`, `-separator`, `-header`), use the matching element/class or attribute instead.

## UI Libraries

- Treat configured UI component roots as opaque boundaries.
- List only third-party/UI-library components in `componentClasses`; owned Vue components derive their own surfaces from `surfaceRootPrefixes` and filenames.
- A pass-through class on an owned child component names that child's root. Style the
  root (the parent's external layout) but never descend below it — the child's file owns
  its insides. Reported as `owned-surface-reach-in`, derived from the component tag.
- Unless explicitly overridden, configured component classes are `pv-` plus the component name in kebab-case.
- Do not inspect or select library-internal DOM.
- Nest a declared slot sub-surface inside the UI boundary block.
- Resume `>` for owned children below the slot surface.
- Keep a slot surface top-level only when configuration explicitly marks it detached.

```css
.page {
  > .ui-data-table {
    .ui-table-column-body {
      > .value {}
    }
  }
}
```

## Dynamic Classes

Dynamic classes may supplement a static owned anchor. They cannot provide the
only surface, slot, or style-element class.

```vue
<span class="icon" :class="iconName" />
<div class="value" :data-status="status" />
```

Library-owned icon or utility classes may remain dynamic. Literal object and
array keys are linted like static class tokens.

## Fixed Classes

With `when-styled`, a mapped element requires its fixed static class when any
class on that node is referenced by an SFC selector; a mapped component requires
its class when that configured name is referenced. With `always`, every mapped
node requires it. Dynamic bindings cannot satisfy this requirement. Nagi CSS
autofixes the class only when the node has no competing owned base class.

Additional ARIA semantics never replace a fixed Element Class. Use
`<li class="item" role="separator">` with `.item[role="separator"]`. A matching
role name may be the base only at the residual `div`/`span` step, such as
`<div class="separator" role="separator">`.

`body` is the fixed class of `<body>` only. It is not reusable content anatomy;
use semantic markup, configured anatomy, or STN for component content regions.

## STN

The shallowest STN tier is `unit` or coarser. Descendant STN tiers are
consecutive. A surface that starts above `unit` reaches `g` before the
structural ladder ends.

`unit` is a hierarchy name, not a measurement unit; `fr` means `fraction`.
Use `.unit` / `class="unit"` for code search and “STN unit” when prose is
ambiguous. The canonical contract records why `pane`, `area`, `space`, and
`tract` were rejected.

SVG and MathML internals are excluded. `:deep()` marks non-owned DOM and is not
checked as owned anatomy.
