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
- Keep `-variant` stems outside the **base-identity** vocabulary (element, component, anatomy, STN, slot, banned, and rendered element names). Variants modify an anchor; they never name what an element is. If a variant wants one of those (`-title`, `-header`, `-footer`), use the matching element/class or attribute instead.
- An ARIA role name that is *not* a base identity is a legal variant (`-search`, `-toolbar`, `-status`) — it says which part of the design this is. It is rejected only on an element that declares the matching role, where it was available as the base.
- **Write variants in the static `class` attribute.** A variant applied by a binding is runtime state: `:class="{ '-collapsed': !open }"` reports `variant-must-be-static`; use `:data-collapsed="!open"` and select `[data-collapsed="true"]`.

## UI Libraries

- Treat configured UI component roots as opaque boundaries.
- List only third-party/UI-library components in `componentClasses`; owned Vue components derive their own surfaces from `surfaceRootPrefixes` and filenames.
- **Pass no class to an owned child component.** Its root already carries the surface
  root derived from its own file, so style it by that name: `<UserAvatar />` in the
  markup, `> .app-user-avatar` in the CSS. A base class on the tag is
  `owned-component-identity` (autofixable); placement variants may still be passed
  (`<UserAvatar class="-lead" />` → `> .app-user-avatar.-lead`).
- Style that root — the parent's external layout — but never descend below it: the
  child's file owns its insides. Reported as `owned-surface-reach-in`. The accepted
  names are derived from the component tags in the template, so a typo or a stale
  name after a rename is rejected.
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

## Design Tokens

Nagi CSS ships no tokens; the design system owns which values exist.

Colors must come from a token, with no configuration and no `--local-*` escape:
`#f0a`, `rgb(0 0 0 / .1)`, and a named color inside a gradient are violations.
`currentColor`, `transparent`, the system colors (`Canvas`, `GrayText`), and
relative color syntax over a token are not.

Where the project declares `tokens.sources`, a surface may reference only tokens
those files declare, and only from the `semantic` layer — a `primitive`
(`--palette-red-500`) read from a surface is a violation, because a theme change
should stay inside the token files.

Exempt: a custom property declared in the same stylesheet, including a `--local-*`
one-off for a value that is genuinely local, and a prefix a component exposes as
its public styling contract (`exposedPrefixes`) — which also makes
`var(--pv-thing-fg, #333)` legal where `var(--color-text, #333)` is not. Layer and
declaration checks are inactive while `sources` is empty.
