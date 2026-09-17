# Nagi CSS Contract

Nagi separates names fixed by platform evidence from meanings selected by an
author. It checks the canonical name and applicable context of each selection.
Unregistered semantic names and structural names remain visible as different
choices. Lint and measurement consume this same analysis.

## Surface

A Surface owns a DOM range and its component CSS. Its root keeps the configured
prefix plus file/component identity: `range-slider.vue` with `app-` gives
`app-range-slider`. The author chooses the file's meaning; the class derivation
is mechanical. Prefer a stable responsibility such as `invoice-summary` or
`parking-results`. Naming by temporary placement or appearance is a review
concern, not a universal banned-word list.

Keep component boundaries opaque. Style an owned child by its own derived root
without passing a base class or reaching into its private DOM. Configured library
boundaries and declared slot sub-surfaces retain their existing ownership rules.
Surface identity is separate from an internal node's classification.

## Base role

Every styled internal node has one static base role:

| Classification | Meaning |
| --- | --- |
| Predefined | HTML or an explicit identifying ARIA role determines the canonical base without an anatomy choice. |
| Defined | The author selects an applicable Built-in Anatomy or Custom definition. |
| Unregistered | The author uses a semantic name without an applicable definition; allowed with a warning by default. |
| Structural | The author chooses STN to express structure rather than a named UI part. |

HTML and ARIA provide Predefined roles. Built-in Anatomy and Custom provide
Defined roles. The source is recorded as report detail rather than another
classification. Native and explicit identifying ARIA names retain their own
applicability conditions. For example, `button` remains Predefined on a native
button even when it also declares a component-scoped purpose. Built-in Anatomy
such as `text` and `icon`, and Custom roles such as a Range's `track`, require
the author to select meaning. Registry membership alone proves neither
applicability nor that the right meaning was selected.

A `div.popup` can be used before registration, with a warning. Define it in a
named scope when the meaning is stable, establish an instance with
`data-role="scope/root"`, and declare a custom role with
`data-role="scope/popup"`. `data-role` adds no ARIA behavior. On a residual
`div` or `span`, the local role supplies the ordinary base `.popup`; Surface,
component, HTML, and WAI-ARIA roles retain priority on other nodes. A custom
role on a native element or identifying ARIA node is a conflict, not an ignored
base declaration. Use a purpose when describing the use of an existing role.

A scope root may annotate any rendered owned element and never supplies `.root`.
Nested roots are hard boundaries: a non-root marker must match its nearest root
and cannot refer back through another scope. An owned child component boundary
may itself declare a scoped role, but its private DOM remains outside the
parent's owned scope. Dynamic `data-role` declarations are errors.

Use STN for deliberately structural nodes:
`stratum → region → block → unit → seg → fr → g`.
The shallowest STN is unit or coarser, adjacent STN ancestors use consecutive tiers,
and a Surface using tiers coarser than unit must reach g. `fr` means fragment.
STN is a legitimate choice; reducing its count is not a quality goal. Multiple
siblings may share the same tier and selector.

## Variant and State

A variant is a static purpose, distinction, or modifier that preserves the base.
Write variants in alphabetical order.

Role means what an element is and determines its base class. Purpose means what
that element is used for and determines a variant. Register roles under
`scopes.<scope>.roles` and purposes under `scopes.<scope>.purposes`.
`data-role="range/fill"` requires `.fill`; `data-purpose="pagination/next"`
requires `-next` while preserving the normal base. Purpose declarations may
optionally constrain their target to a specific HTML element or ARIA role.
They do not implement behavior. A role already includes its meaning: do not
repeat it as a same-named purpose variant.

Both markers are static, scoped declarations using the nearest `scope/root`.
They may coexist when a custom role also serves a separate purpose. Purposes do
not establish roots. Dynamic declarations are errors. Ordinary unregistered
variants remain valid under the existing variant rules.

```html
<button class="button -close">Close</button>
<button class="button -primary" disabled>Save</button>
<input class="input -lower" type="range">
<div class="field -firstname">...</div>
```

There is no business/UI/design word partition. Decide whether the word modifies
this node's role. If the node actually represents a popup, prefer `.popup`
over `.unit.-popup`. Lint checks known applicability; it cannot settle this
semantic judgment from natural-language words alone.

State is runtime information represented by native state, ARIA, or explicit
`data-*` attributes. Dynamic variant bindings and state classes remain invalid.
Never add ARIA solely to obtain a class name or styling hook.

## CSS structure

Owned selector paths follow the template through direct-child edges and readable
nesting. Keep exactly one base per selector compound. Unregistered bases undergo
the same selector, ownership, token, and state checks. Reusing a selector for
multiple owned nodes is valid.

Surface external placement belongs to its parent. A root may establish an
internal containing block with `position: relative`. Top-layer capability is
separate from selectors proving `:modal` or `:popover-open` state; z-index
does not order top-layer entries. Existing token, declaration, container, motion
and boundary constraints are specified in [CSS and ownership](docs/css-reference.md).

## Reference and adoption

- [Definition providers, scope, JSON schema, presence, fixes and measurement](docs/definitions.md)
- [Generated Built-in Anatomy definitions](docs/anatomy-definitions.md)
- [Configuration](skills/nagi-css/references/configuration.md)
- [Migration from the previous naming model](docs/migrations/defined-roles.md)
- [Framework setup](docs/getting-started/index.md)
- [FAQ](FAQ.md)

Roles and purposes default independently to `layer: "implementation"` and
`declaration: "optional"`. `layer: "contract"` records shared vocabulary; it
does not imply a required declaration or alter naming. `declaration: "required"`
requests static declaration checks, not constant visibility or behavioral proof.
The legacy boolean `required` remains a compatibility input; contradictory
`required` and `declaration` settings are errors.

Required roles mean matching declarations in each statically analyzable scope
instance, not visibility in every runtime state. Standard roles use their normal
HTML or WAI-ARIA representation instead of redundant `data-role` markup. Unknown
scopes, invalid nodes, unresolved content and parse failures are reported
explicitly. Definition coverage does not
prove accessibility, correct HTML semantics, visual behavior, maintenance time,
or that all names could be uniquely derived from the DOM.

Reuse Predefined names where platform evidence fixes them. Select a Built-in or
Custom Defined name where its meaning applies. Define missing meanings, or use
an Unregistered name while keeping it visible. Use STN for structure without a
part name. Variants modify roles, state lives in attributes, and Surfaces
express ownership. Nagi uses this contract as the shared model for lint and
measurement.
