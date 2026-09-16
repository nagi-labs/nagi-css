# Naming procedure

Use [definition resolution](definitions.md#definition-source-and-applicability) as the source
of truth. Surface/opaque component ownership is separate from internal role.

Preserve Predefined native/ARIA names, then resolve the nearest static
`data-role="scope/root"` and any matching custom scoped role. Choose an applicable
Built-in Anatomy/Custom Defined role, use an
Unregistered semantic name, or choose STN for structure. These choices do not all follow
uniquely from the DOM. A prose paragraph is `<p class="p">`; short UI copy can
use the Built-in Anatomy `text` definition.

Read descriptions, examples and exclusions from [Built-in Anatomy definitions](anatomy-definitions.md).
Never copy a private allowlist into an audit script. Variant words are assessed
as modifiers in context; state remains attribute-based. Scope/presence and
selector ownership are independent constraints.
