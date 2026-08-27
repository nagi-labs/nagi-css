---
name: nagi-css
description: Apply, review, configure, or migrate the Nagi CSS semantic styling contract in component-based frontend code. Use when working on owned CSS surfaces, UI-library boundaries, slot sub-surfaces, dynamic classes, Nagi CSS ESLint diagnostics, or Nagi CSS configuration and checks.
---

# Nagi CSS

Use Nagi CSS to keep owned markup structurally explicit without depending on a
UI library's internal DOM.

## Workflow

1. Read [references/contract.md](references/contract.md) before changing markup or selectors, and [references/naming-flow.md](references/naming-flow.md) before assigning any class name.
2. Locate the Nagi CSS entry in the application's `eslint.config.*`, or the
   external configuration when the standalone CLI is explicitly being used.
3. Keep required surface, slot, and style-element classes static.
4. Allow dynamic classes only as additions to a static owned anchor.
5. Treat configured UI roots as opaque boundaries and resume owned nesting at declared slot surfaces.
6. Use attributes for runtime state.
7. Run the application's normal ESLint command.
8. Fix errors at their owning markup or selector; do not add broad allowlists to silence local violations.
9. Re-run ESLint; it checks both the template and component-owned style blocks.

```sh
vp exec eslint .
```

Use `--fix` only after reviewing the target scope. It applies unambiguous
missing fixed-class fixes and leaves semantic choices untouched.

Use the project's existing framework ESLint config.

Treat autofix output as limited to missing fixed classes with no competing base
name. Surface naming, anatomy choices, state migration, and ownership boundaries
require an explicit code change.

Read [references/configuration.md](references/configuration.md) when creating or
changing component, slot, boundary, or detached-surface configuration.

Task-specific guides:

- [references/write-from-scratch.md](references/write-from-scratch.md) — creating new markup and CSS.
- [references/edit-existing.md](references/edit-existing.md) — migrating or revising existing markup and CSS.
- [references/check-conformance.md](references/check-conformance.md) — reviewing code against the contract.
- [references/component-library-boundaries.md](references/component-library-boundaries.md) — UI library wrappers, named slots, portals, and shadow DOM.

Load only the pattern needed for the current component:

| Use case | Reference |
|---|---|
| routed page shell | [page shell](references/patterns/page-shell.md) |
| labels, controls, actions | [form](references/patterns/form.md) |
| library-backed grid | [data table](references/patterns/data-table.md) |
| nested or recursive navigation | [tree list](references/patterns/tree-list.md) |
| modal surface | [dialog](references/patterns/dialog.md) |
| ARIA tab interface | [tabs](references/patterns/tabs.md) |
| opaque dependency root | [UI-library boundary](references/patterns/ui-library-boundary.md) |
| owned slot content | [component slot](references/patterns/component-slot.md) |
| detached rendering | [teleport](references/patterns/teleport.md) |
| async result states | [loading/error/empty](references/patterns/loading-error-empty.md) |
| Framework class bindings | [dynamic class](references/patterns/dynamic-class.md) |
| self-nesting component | [recursive component](references/patterns/recursive-component.md) |
