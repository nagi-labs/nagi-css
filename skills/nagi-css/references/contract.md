# Contract Reference

## Ownership

- Give every styled surface a static identity class.
- Connect styled owned parent-child edges with `>`.
- Use classes for owned styling targets; do not target bare owned elements.
- Keep runtime state in native, ARIA, or `data-*` attributes.
- Derive a surface name from its Vue component or routed page file.
- Use only configured anatomy, element, component, STN, slot, or matching role names below a surface.
- Keep `-variant` classes alphabetical.
- Keep `-variant` names outside the vocabulary (element, component, anatomy, STN, slot, banned, and rendered element names). Variants modify an anchor; they never name what an element is. If a variant wants a vocabulary word (`-title`, `-header`), the element wants that tag or class instead.

## UI Libraries

- Treat configured UI component roots as opaque boundaries.
- List only third-party/UI-library components in `componentClasses`; owned Vue components derive their own surfaces from filenames.
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
<i class="icon" :class="iconName" />
<div class="value" :data-status="status" />
```

Library-owned icon or utility classes may remain dynamic. Literal object and
array keys are linted like static class tokens.

## Fixed Classes

With `when-styled`, a mapped element or component requires its fixed static
class when an SFC selector references that name. With `always`, every mapped
node requires it. Dynamic bindings cannot satisfy this requirement. Nagi CSS
autofixes the class only when the node has no competing owned base class.

`body` is the fixed class of `<body>` only. It is not reusable content anatomy;
use semantic markup, configured anatomy, or STN for component content regions.

## STN

The shallowest STN tier is `zone` or coarser. Descendant STN tiers are
consecutive. A surface that starts above `zone` reaches `g` before the
structural ladder ends.

SVG and MathML internals are excluded. `:deep()` marks non-owned DOM and is not
checked as owned anatomy.
