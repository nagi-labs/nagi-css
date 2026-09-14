---
name: nagi-css
description: Apply, review, configure, or migrate Nagi CSS ownership, Predefined/Defined/Unregistered/Structural identities, semantic scopes, and component CSS checks.
---

# Nagi CSS

Read [the Contract](references/contract.md) before editing markup or CSS and
[definition resolution](references/definitions.md) when choosing a semantic
identity or registering a role. These references are generated from the same
specification used by core and its tests.

Use the project's framework ESLint config and inspect its semantic configuration.
Follow [configuration](references/configuration.md) for package boundaries,
intrinsic proxies, slots, token sources and JSON definitions.

Use a Predefined HTML/ARIA identity when its platform conditions apply. Use an
applicable Defined identity when its description fits the actual node.
Read [Built-in Anatomy definitions](references/anatomy-definitions.md) and the project's
scoped-role JSON. Keep native/ARIA fixed identities. For a stable missing
meaning, help the author write a scoped definition and static `data-role` marker.
An unregistered name may remain a warning; coverage is not the objective.

STN expresses structural choice. Do not add variants solely to distinguish
siblings, or hide a UI part behind `unit -popup`. A native `button -close`
retains a legitimate static modifier. Judge identity versus modifier in context,
without dividing words into business, UI and design categories.

Keep one static base, alphabetical static variants, state in attributes and
owned direct-child CSS paths. Review the [CSS rules](references/css-reference.md)
for boundaries, containing blocks, top-layer ordering, tokens and declaration
constraints.

Do not infer ARIA, add empty required roles, or rename classes without reviewing
selector correspondence. A required role means a declaration in each static
scope instance, not runtime availability. Reject dynamic `data-role`; preserve
explicit uncertainty for slots and other unresolved content.

Run the application's ESLint through `vp exec eslint .`. Review safe fixes and
remaining diagnostics. For measurement, use the shared core/CLI report described
in the definition reference, never a separate vocabulary classifier.

Task guides: [new source](references/write-from-scratch.md),
[existing source](references/edit-existing.md), [review](references/check-conformance.md).
