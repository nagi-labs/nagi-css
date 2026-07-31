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
- Derive a surface name exactly from its configured namespace prefix and component or routed page file.
- Use only configured anatomy, element, component, STN, slot, or matching role names below a surface.
- Keep `-variant` classes alphabetical.
- Keep `-variant` stems outside the **base-identity** vocabulary (element, component, anatomy, STN, slot, banned, and rendered element names). Variants modify an anchor; they never name what an element is. If a variant wants one of those (`-title`, `-header`, `-footer`), use the matching element/class or attribute instead.
- An ARIA role name that is *not* a base identity is a legal variant (`-search`, `-toolbar`, `-status`) — it says which part of the design this is. It is rejected only on an element that declares the matching role, where it was available as the base.
- **Write variants in the static `class` attribute.** A variant applied by a binding is runtime state: `:class="{ '-collapsed': !open }"` reports `variant-must-be-static`; use `:data-collapsed="!open"` and select `[data-collapsed="true"]`.

## UI Libraries

- Treat configured UI component roots as opaque boundaries.
- List only third-party/UI-library components in `componentClasses`; owned components derive their own surfaces from `surfaceRootPrefixes` and filenames.
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
class on that node is referenced by a component-file selector; a mapped component requires
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

## Container Queries

Prefer an unnamed container (it resolves against the nearest ancestor). A named
container is derived like any identifier: the surface root on the surface's own
rule, and surface root + the element's base identity on an owned element
(`app-invoice-card-media`) — reported as `container-name-derived`. A named
`@container` query may only reference a container declared in the same file
(`container-query-scope`); querying a parent's container name couples this surface
to a name it does not own. Unnamed queries are always allowed.

## Motion and Cascade

Prefix a `@keyframes` name with the surface root (`app-toast-slide-in`); the tail is
a free choice like a variant stem. A `@keyframes` no `animation` in the component
references is reported (`dead-keyframes`) — scoped styles rename it per component, so
it is unreachable, not just unused. Shared motion belongs in a global stylesheet,
which is outside the contract, so a component's own block is the whole search space.
Reduced motion is not linted: there is no unique correct reduced variant, so it
would be a presence check rather than a derivation.

`@layer` is not used inside a surface (`cascade-layer-in-surface`). The structural
rules keep specificity flat so cascade order never needs adjusting; global layer
ordering belongs in a global stylesheet, and a consumer override is a public
custom property, not a cascade trick.

## Stacking Order

`z-index` on a surface's own rule is external layout: its order among its siblings
is the parent's decision, and this is what removes the `z-index: 9999` race — every
escalation targets something outside the component. A surface that owns its
coordinate context (top-layer, anchor-positioned) may set it, and there the level
must come from a token, since ordering modals against toasts is a system-wide
decision. Layering a surface's own children against each other is a local
structural choice and is unrestricted.

## Design Tokens

Nagi CSS ships no tokens; the design system owns which values exist.

Colors must come from a token, with no configuration and no `--local-*` escape:
`#f0a`, `rgb(0 0 0 / .1)`, and a named color inside a gradient are violations.
`currentColor`, `transparent`, the system colors (`Canvas`, `GrayText`), and
relative color syntax over a token are not.

Lengths must come from a token on scale properties — spacing, radius, border width,
type size, elevation — where a one-off may instead be declared as a named
`--local-*` value in the same rule. A surface's own size and position
(`max-inline-size`, `top`), ratios and relative units (`50%`, `1fr`, `40vh`,
`line-height: 1.5`), zero, angles, and durations are not scale values.

Where the project declares `tokens.sources`, a surface may reference only tokens
those files declare, and only from the `semantic` layer — a `primitive`
(`--palette-red-500`) read from a surface is a violation, because a theme change
should stay inside the token files.

Exempt: a custom property declared in the same stylesheet, including a `--local-*`
one-off for a value that is genuinely local, and a prefix a component exposes as
its public styling contract (`exposedPrefixes`) — which also makes
`var(--pv-thing-fg, #333)` legal where `var(--color-text, #333)` is not. Layer and
declaration checks are inactive while `sources` is empty.
