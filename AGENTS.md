# Nagi CSS — instructions for coding agents

Follow [CONTRACT.md](CONTRACT.md), the [definition reference](docs/definitions.md),
and [CSS/ownership rules](docs/css-reference.md). These documents specify one
shared analysis used by lint and measurement.

- Surface roots use configured prefixes and file/component identities. The
  author chooses a stable responsibility; only class derivation is mechanical.
- Internal bases are Predefined, Defined, Unregistered, or Structural. HTML/ARIA
  produce Predefined identities; Built-in Anatomy/Custom produce Defined ones.
- Preserve applicable native classes, including `p` → `p`, and explicit
  identifying ARIA classes on residual div/span. Do not add ARIA for CSS.
- Use the [generated Built-in Anatomy definitions](docs/anatomy-definitions.md)
  when selecting a built-in meaning, and the registered scoped-role JSON for
  component-local meanings.
- Register stable Custom meanings through `roleDefinitions` JSON grouped by
  scope. Establish a scope with `data-role="scope/root"`; declare each custom
  role with one static `data-role="scope/role"`. Surface identity and semantic
  scope are independent.
- An unregistered semantic name is allowed with a warning. Do not manufacture a
  definition to silence it. Native mismatches, invalid context,
  multiple bases, ownership and CSS errors remain errors.
- STN is legitimate structure. Shared sibling tiers need no variant. Prefer
  `.popup` when popup is the identity; retain `.button.-close` when close
  modifies a native button. Word categories cannot decide this automatically.
- Required roles mean declarations per scope instance, not runtime presence.
  Nested roots are hard boundaries. A child component boundary may carry a role,
  but its private DOM cannot satisfy the parent scope. Preserve uncertainty
  across slots and unresolved content; reject dynamic `data-role` declarations.
- Keep state in native/ARIA/data attributes, static variants alphabetical, owned
  CSS paths direct-child and visibly nested, and boundaries opaque.
- Preserve token, stacking, containing-block, and declaration rules.
- Review fixes; never rename class-only while a selector still uses the old name,
  infer ARIA, or insert empty elements to satisfy a definition.

Run `vp run test`. After changing definitions or canonical documents, run
`vp run docs:generate` and `vp run docs:check`. The Skill's generated references
come from these sources; edit the source, not generated copies.
