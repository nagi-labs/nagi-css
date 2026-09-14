# Review conformance

Use [the Contract](contract.md), [definitions](definitions.md) and
[CSS ownership rules](css-reference.md). Review diagnostics against the actual
node, applicable provider, nearest scope root and selected definition.

Distinguish a valid Predefined/Defined/Unregistered/Structural choice from a fixed native
mismatch, wrong custom context, missing required declaration, invalid format,
state class or ownership violation. Review the chosen meaning separately from
the mechanical check. A registered name does not prove correct semantics.

Report file/line, violated constraint, current behavior and a concrete correction.
Keep unresolved presence explicit. Do not call warnings errors, require zero
STN, invent ARIA, or ask for definitions solely to raise coverage. Evaluate
template/CSS changes together and use normal lint and behavior checks.
