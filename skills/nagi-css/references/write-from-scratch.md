# Write new component CSS

Read [the Contract](contract.md) and [definition resolution](definitions.md).
Choose native semantics and the Surface's stable responsibility first.
Preserve Predefined native mappings and actual identifying ARIA roles. Select described
Built-in Anatomy or Custom Defined roles where they fit; name stable missing roles explicitly
and let unregistered warnings make them visible. Use STN for structural grouping.

Use scoped JSON definitions and static `data-role="scope/role"` markers only
where a component-local semantic role is useful. Establish each instance with
`data-role="scope/root"`.
Do not add attributes, wrappers or component splits just to pass a naming rule.
Keep CSS paths aligned with owned DOM and use semantic tokens for repeated scale
values. Verify with the application's ESLint and appropriate behavior tests.
