# Scoped role definitions and measurement

This is the definition reference for the [Nagi CSS Contract](../CONTRACT.md).
HTML and WAI-ARIA already provide standard semantic identities. A component may
also need roles whose meaning exists only inside that component, such as a
Range's track and fill. Scoped role definitions register those additional
meanings without putting nonstandard tokens in the HTML `role` attribute.

## Register definition files

Applications that load JSON directly declare the core package alongside the
ESLint plugin:

```sh
vp add -D @nagi-labs/eslint-plugin-nagi-css @nagi-labs/nagi-css-core
```

```js
import nagiCss from "@nagi-labs/eslint-plugin-nagi-css"
import { loadRoleDefinition } from "@nagi-labs/nagi-css-core"

const roles = loadRoleDefinition(new URL("./definitions/range.json", import.meta.url))

export default [
  // Append after the framework's official flat config.
  ...nagiCss.configs.recommended({
    surfaceRootPrefixes: ["app-"],
    roleDefinitions: [roles],
  }),
]
```

The loader reads local JSON without executing it and rejects duplicate JSON
keys. A definition may live in an application or dependency package. A package
can export its definition object or JSON file so consumers can import or load it
directly; consumers do not copy library definitions into their own source tree.
No runtime network access is performed.

`roleDefinitions` also accepts local path strings. Paths resolve against
`definitionsBaseDir`, or the process working directory when omitted. The
standalone CLI defaults that directory to the configuration file's directory.
An explicit `new URL(..., import.meta.url)` remains independent of the working
directory.

The schema is exported as
`@nagi-labs/nagi-css-core/role-definition.schema.json` and checked in at
[`packages/core/src/role-definition.schema.json`](../packages/core/src/role-definition.schema.json).
The package export is the canonical schema reference; Nagi CSS does not promise
a separately hosted schema URL.

## Definition format

Definitions group roles under their semantic scope:

```json
{
  "$schema": "@nagi-labs/nagi-css-core/role-definition.schema.json",
  "version": 1,
  "scopes": {
    "range": {
      "roles": {
        "track": { "required": true },
        "fill": { "required": true, "description": "The portion representing the selected value." },
        "slider": { "required": true, "native": true }
      }
    }
  }
}
```

Scope and role names are lowercase kebab-case. They cannot use an STN tier. A
scope cannot define a local role with the same name, and `root` is reserved and
must not appear in `roles`.

`required` defaults to `false`. A required role needs at least one matching
static declaration in every statically analyzable instance of its scope.

`native` defaults to `false`. In this contract, native means a standard semantic
identity supplied by either HTML or WAI-ARIA, not only an HTML element. A native
role must have the same canonical name as an entry in Nagi CSS's existing HTML
or WAI-ARIA registry. A standard spelling can still be a custom role where the
standard semantic source is not being used: Range's custom `track` role on a
`div` does not become the HTML `<track>` element.

`description` is optional and, when present, must contain non-whitespace text.
It explains the role's meaning and is retained in the shared definition registry.
It does not introduce executable requirements or prove correct DOM placement.
Existing definitions without descriptions remain valid.

The initial schema has no aliases, cardinality ranges, allowed
element lists, states, child graphs, selector definitions, or conditional
requirements. Scoped roles describe semantic declarations, not a headless UI
anatomy API.

## Establish a scope instance

Every declared scope implicitly has a reserved root role. Mark each instance on
an existing rendered owned element:

```html
<div class="app-range" data-role="range/root">
```

The root may be a Surface root or another rendered owned element. It establishes
the semantic region but never supplies `.root` or replaces the element's current
base identity. Surface, component, HTML, and WAI-ARIA rules continue to determine
that base. A non-rendering template, fragment, slot, or transparent component
cannot establish a scope root.

## Declare custom roles

Only custom scoped roles use `data-role`:

```html
<div class="track" data-role="range/track">
  <div class="fill" data-role="range/fill"></div>
</div>
```

The value contains exactly one `/` and two non-empty lowercase kebab-case names.
Nested paths, unknown scopes, unknown roles, and manual uses of reserved `root`
as a definition entry are errors. `data-role` must be a static literal;
bindings, interpolation, computed values, and other dynamic declarations are
errors and never establish a root or satisfy a required role.

On a residual `div` or `span`, a custom scoped role supplies the ordinary local
base name: `range/fill` requires `.fill`, without the scope prefix. On a node
that already has a Surface, component, HTML, or identifying WAI-ARIA identity,
the scoped role is additional semantic evidence and does not replace that base:

```html
<button class="button" data-role="date-picker/trigger"></button>
```

The marker is a semantic source, not a requirement to style through attribute
selectors. Component CSS continues to use the ordinary Nagi class identity.

## Use standard semantics directly

A role declared with `native: true` is satisfied through Nagi CSS's existing
canonical HTML or WAI-ARIA mapping:

```html
<div
  class="slider"
  role="slider"
  aria-valuemin="0"
  aria-valuemax="100"
  aria-valuenow="50"
  tabindex="0"
></div>
```

Do not repeat it as `data-role="range/slider"`. The standard source preserves
the `.slider` identity and satisfies the nearest Range scope's native slider
requirement. A redundant custom marker is reported.

Nagi CSS reuses its existing HTML and WAI-ARIA mappings rather than maintaining
a second standard-role list for scoped definitions. A definition and matching
class do not by themselves implement widget behavior, keyboard interaction,
accessible naming, or valid state transitions.

In Vue, a literal `role` after an attribute spread is statically authoritative:
`v-bind="attrs" role="tablist"` preserves that role. The reverse order remains
unresolved because the spread may replace it. This follows Vue's attribute
merge order; it does not infer the contents of an opaque binding or authorize
overriding a behavior library's protected attributes. Dynamic `data-role`
declarations remain errors regardless of attribute order.

## Nested scopes and ownership boundaries

A nested root is a hard semantic boundary. Every non-root marker must match the
nearest enclosing statically resolved root:

```html
<div class="app-range" data-role="range/root">
  <div class="unit" data-role="tooltip/root">
    <div class="fill" data-role="range/fill"></div>
  </div>
</div>
```

Here `range/fill` is an error. It cannot skip `tooltip/root` to refer back to the
outer Range, and it satisfies neither scope.

An owned child component invocation may carry a scoped role. The boundary itself
counts as that declaration in the parent scope while keeping its derived Surface
identity:

```vue
<div class="app-range" data-role="range/root">
  <RangeFill data-role="range/fill" />
</div>
```

The child's private DOM stays opaque and cannot satisfy other requirements of
the parent scope. A marker on the boundary does not authorize parent selectors
to reach into the child. Configured library boundaries follow the same ownership
rule. Slots, relocated content, and dynamic HTML retain the existing analyzer's
explicit uncertainty behavior.

## Required declaration checks

Required means a matching authored declaration, not runtime presence. A
conditional or loop declaration counts once in source while remaining
runtime-conditional. Each scope root is checked independently.

- A matching custom `data-role` or matching native HTML/WAI-ARIA source is
  `declared`.
- No matching declaration in fully inspectable owned markup is
  `required-role-missing`.
- Unresolved slot or dynamic content that prevents proving absence is
  `unverifiable-presence`.
- Dynamic `data-role` is an error and does not count as unresolved evidence.
- A child component's private DOM is outside the parent's owned region and does
  not satisfy the parent requirement.

These checks do not depend on `emitPolicy`. An unstyled static declaration can
satisfy presence, while CSS identity checks still apply when the node is styled
or otherwise requires a fixed class.

## Composition

Multiple definition files compose deterministically. Each scope has one owner
after composition. A repeated scope is rejected unless its normalized roles are
structurally identical, in which case it is deduplicated. Property order and role
order do not affect equality. Separate sources cannot incrementally merge roles
into the same scope; this avoids load-order-dependent contracts.
Descriptions participate in equality without rewriting their text. A different
description, or a description present in only one duplicate, is a conflict rather
than a load-order-dependent choice of meaning.

## Identity classification and measurement

Internal styled identities remain Predefined, Defined, Unregistered, or
Structural:

- HTML and explicit identifying WAI-ARIA bases are Predefined.
- Built-in Anatomy and custom scoped-role bases are Defined.
- A residual semantic base without an applicable definition is Unregistered and
  warns by default.
- STN remains Structural.

Surface roots, component boundaries, invalid declarations, and unknown nodes are
reported separately. A node with a standard base may also record the scoped role
it satisfies without changing its Predefined classification.

```js
import { analyzeComponent, createIdentityReport } from "@nagi-labs/nagi-css-core"

const analysis = analyzeComponent(source, filename, semanticConfig)
const report = createIdentityReport([analysis])
```

```sh
vp exec nagi-css measure --config ./nagi.config.mjs --cwd .
vp exec nagi-css measure --config ./nagi.config.mjs --cwd . --json
```

Lint and measurement use the same node records. Coverage describes statically
styled internal declarations; it does not prove accessibility, visual behavior,
runtime presence, maintainability, or that an author selected the correct
meaning.
