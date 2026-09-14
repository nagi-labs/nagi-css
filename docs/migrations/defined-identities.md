# Migrating to 0.6.0

Version 0.6.0 introduces Predefined, Defined, Unregistered, and Structural
identities, including the `loadRoleDefinition` and `createIdentityReport` exports.
Upgrade the Nagi CSS packages together. During release preparation, install the
packed candidate packages; do not assume the candidate is already on npm.
The minimal Vue example remains pinned to 0.5.1 until publication; release
verification substitutes the candidate tarballs in an isolated copy.
The repository's `examples/custom-roles` exercises the new definition API.

## What changes

- Unknown semantic names on residual `div`/`span` are warnings by default. They
  remain fully subject to CSS matching, ownership, format and state checks.
- `anatomyClasses` string extensions no longer confer Defined status. They are
  accepted as deprecated configuration, warn, and will be removed in the next
  major release. Built-in Anatomy definitions remain available; replace custom
  words with scoped `roleDefinitions` where the meaning is component-local.
- `stn-peer-variant` and `variant-requires-peer` no longer emit findings. Their
  rule keys remain accepted as deprecated no-ops until the next major release.
- `reserved-element-name` and `variant-shadows-vocabulary` use applicability.
  Contextual `track` can coexist with native HTML `track`; fixed native/ARIA
  identities cannot be overridden by an unregistered name.
- Class-only autofixes do not rename a token still referenced by component CSS.
- Unresolved ARIA identities now report `unverifiable-role-identity`, including
  attribute spreads on generic elements whose role cannot be determined from
  source. This is a warning by default, not proof of incorrect runtime ARIA.
  An integration using `severity: { "*": "error" }` promotes it to an error,
  just as it promotes `deprecated-anatomy-config`. Review such integrations
  before upgrading; do not remove behavior bindings or invent roles to silence
  uncertainty. Making an existing invariant role explicit requires checking it
  against the component's behavior and tests.
  Nagi CSS does not require behavior libraries to move their attributes out of
  prop bundles. Resolving that source uncertainty is a consumer design choice,
  not a prerequisite for using the default warning policy.
- Earlier derivation evaluations using all tokens, surfaces or implicit
  components as denominators are not comparable to internal Definition coverage.
  Use `analyzeComponent` / `createIdentityReport`, not an independent dictionary.

## UI parts, modifiers, and structure

A Combobox popup illustrates a semantic role currently expressed as
`unit -popup`. Make the selected role explicit, then define it when its meaning
is stable:

This is a partial naming example, not a replacement for the component's source.
Keep its existing behavior, accessibility attributes and event bindings.
`data-role` must be a static literal; a binding or spread never establishes a
scope or satisfies a required role. Adding a definition alone does not make
dynamic markup verified.

```html
<!-- Before -->
<div class="n-combobox"><div class="unit -popup" popover>...</div></div>
<!-- After: update the corresponding nested CSS from .unit.-popup to .popup -->
<div class="n-combobox" data-role="combobox/root"><div class="popup" data-role="combobox/popup" popover>...</div></div>
```

```json
{
  "version": 1,
  "scopes": {
    "combobox": {
      "roles": {
        "popup": { "required": true }
      }
    }
  }
}
```

Before registering this JSON, `.popup` remains usable with an unregistered
warning, but its `data-role` reference is invalid. Registration verifies the
canonical role and declaration presence; it does not establish that the UI is
an accessible combobox.

A Dialog close button retains `<button class="button -close">`: button is its
native base, close is its static purpose. Range inputs retain `input -lower` and
`input -upper`. These words are not classified into business/UI/design buckets.

A div used solely to group two controls for layout may remain `.unit`. Two such
siblings may share `.unit` and its CSS. Do not add a role, empty wrapper, or
definition just to improve coverage. Surface filenames and component boundaries
do not need to change to adopt scoped roles.

See [the reference](../definitions.md) for scope barriers, presence uncertainty,
severity, schema and measurement. Nagi UI source is a migration example, not
modified by this redesign.
