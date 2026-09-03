# Nagi CSS Contract

## Introduction

Nagi CSS is a styling contract for structuring and writing HTML and CSS in modern web applications.

It is designed for component-based development, AI-assisted implementation, and long-lived codebases where styling must remain readable, stable, and reviewable over time.

The contract begins where component boundaries stop. Scoped styles already
ended the classic naming problems — collisions, leakage, unclear ownership —
and this document assumes that world instead of re-solving it. What a
boundary does not provide is a canonical form for its inside: there, names
are still chosen by taste, selectors can silently outlive the template they
described, and nothing is checkable because nothing defines *correct*. Nagi
CSS supplies that definition. Given the markup and the project's
configuration, the correct class for each node is unique and derived, which is
what makes conformance machine-verifiable and lets any two authors — human or AI — converge on the
same output.

It is **not** a universal rule for the entire rendered tree. Instead, it defines strict rules for styling **owned DOM inside a styling surface**, and lighter contract-based rules for everything outside that boundary.

The contract is built on six principles. Two of them carry the weight:
**Standard-first** decides the public model — CSS selectors and the platform's
own state, not a parallel system in JavaScript — and **Deterministic** is what
turns the rest from qualities many conventions aspire to into claims a machine
can check. Plain CSS is the default declaration backend; an owned implementation
may explicitly delegate declaration expansion to Tailwind without changing the
template or selector contract.

### Semantic

Class names should reflect stable UI meaning rather than raw visual appearance or incidental implementation details.

### Structured

Owned DOM should be understandable from the markup and CSS structure alone, using predictable naming and nesting patterns.

### Scoped

Styling rules should apply only where the component truly owns the DOM structure. Public contracts should be used across non-owned boundaries.

### State-aware

Runtime state should be expressed through native states, ARIA attributes, and `data-*` attributes rather than state classes.

### Standard-first

Styling is expressed in CSS, not in JavaScript. The contract adds no runtime.
Its default `plain` mode adds no build step or new syntax. What it constrains is
CSS with statically readable selectors, native nesting, custom properties, and
container queries, and it uses the platform's own model for state — native
states, ARIA, and `data-*` — rather than a parallel one built out of class names.
An optional `tailwind-apply` mode delegates declaration expansion to an
application-provided Tailwind build while keeping those selectors and states
unchanged. It reaches for the newest parts of the platform
(container queries, the top layer, anchor positioning, Shadow DOM and `::part()`)
instead of working around them.

This is not a preference for older tooling. Semantic CSS has always been
maintainable in principle and unenforceable in practice, and what was missing was
never a new language — it was a definition of *correct* that a machine could
check. Supplying that definition is what lets the platform's own model stay in
place instead of being replaced.

### Deterministic

Naming and structure inside owned DOM must be reproducible by rule, not by taste. Given the same markup **and the same configuration**, two authors — or an AI agent — arrive at the same class names. The contract achieves this by collapsing naming into fixed lookup tables, so that the judgment which remains is about structure rather than about names. Determinism is what makes the rules machine-verifiable. Its exact scope is set out in [Limits of determinism](#limits-of-determinism).

---

## Limits of determinism

The claim this contract makes is precise, and worth stating with its boundaries
rather than letting a reader find them: **given a tree and a configuration, the
correct class for each node is unique.** Both qualifiers are real.

Judgment enters in six places, none of which the linter can settle:

| where | what is not decided by rule |
|---|---|
| the shape of the tree | how many elements exist at all. The contract names a tree; it does not choose one |
| component boundaries | where one surface ends and a child surface begins |
| the residual `div`/`span` | anatomy or STN — `field` or `unit`. The crisp definitions narrow this; they do not remove it |
| variant stems | the domain words a project uses, constrained only by what a variant may *not* be |
| configuration | `surfaceRootPrefixes`, `elementClasses` overrides, `anatomyClasses`, `tiers`, `emitPolicy` all move the target |
| `emitPolicy: when-styled` | whether a class is required depends on the adjacent stylesheet, so the answer comes from the pair |

Two consequences follow, and both are worth saying out loud.

**"Nagi CSS conformant" is relative to a configuration.** Two projects with
different `tiers` or different `elementClasses` overrides are conformant to
different contracts. That is deliberate — a shared configuration is reviewable
and lands in a diff — but it means the phrase names a process, not a fixed
dialect.

**What survives is still the part that matters.** Every item above is a decision
about *structure* or *policy*, made once and visible in review. None of them is a
decision about what to call a node whose place in the tree is already settled.
That is the decision that occurs hundreds of times a day, that no convention has
ever made reproducible, and that this contract removes.

---

## Core contract at a glance

1. Give every styled surface a static identity class derived exactly from its
   configured namespace prefix and component file.
2. Give each styled element exactly one base identity from the first matching
   naming-table step; express additional ARIA semantics with attributes.
3. Keep non-surface class names in the configured element, component, anatomy,
   STN, slot-surface, or explicit `role` vocabulary.
4. Connect styled owned parent-child edges with `>` and target owned elements
   through classes.
5. Treat configured UI component roots as opaque boundaries. Cross them with a
   descendant step, never `>`.
6. Resume owned `>` nesting at a declared slot sub-surface.
7. Prefix each slot sub-surface with its owning component slot prefix.
8. Represent runtime state with native, ARIA, or `data-*` attributes.
9. Keep teleported slot surfaces top-level only when explicitly configured as detached.
10. Keep static `-variant` tokens alphabetical.
11. Keep `-variant` names outside the protocol vocabulary; variants modify an
    anchor, they never name what an element is.

The rest of this document defines each rule precisely and explains the
reasoning behind it.

---

## Document set

This contract is delivered as three layers with distinct audiences:

- **CONTRACT.md (this document)** — the canonical source: concepts *and* method, with rationale. Long by design; read once to understand *why*. [FAQ.md](FAQ.md) answers common objections.
- **Skill (`skills/nagi-css`)** — the short mechanical procedure and the lookup tables, loaded during work. It is a faithful projection of this document; when they disagree, this document wins.
- **Linter (`packages/*`)** — the executable form: one ESLint plugin checks the
  template, component-owned style blocks, and their cross-block relationship.
  It composes with the framework's official flat config without owning its
  parser. An optional CLI runs the ESLint integration from an external
  configuration. The linter ships the built-in Element Class Table; project
  configuration declares the Library Component Class Table and may override any
  built-in element mapping.

---

## Technical Requirements

Nagi CSS assumes the following capabilities:

### Required

- **Component-based architecture**: UI is split into dedicated components or subcomponents.
- **Native CSS nesting**: Owned structure is written with native CSS nesting.
- **Statically analyzable style syntax**: every class name and selector edge must be
  readable from the source without compiling it. Verifiability is what this contract
  trades for, so analyzability is a requirement rather than a preference.

### Recommended

- **Scoped CSS support**: Style isolation where available.
- **CSS custom properties**: For design tokens and theming.
- **Container queries**: For component-level responsive behavior.

### Preprocessor syntax is outside the contract

Styles are plain CSS. Sass/SCSS, Less, and Stylus are not supported.

Native CSS has absorbed what a preprocessor used to be needed for — nesting,
variables (as custom properties, which this contract prefers anyway because they
are live at runtime and cascade), color functions, and math. What remains
specific to a preprocessor is either forbidden here or breaks verifiability:

| Preprocessor-specific feature | Status under this contract |
|---|---|
| `&__title` selector concatenation | produces a BEM name the contract rejects |
| `@each` generating utility classes | standalone utilities are not allowed |
| `$` variables as design tokens | tokens are CSS custom properties |
| `@extend`, selector-emitting `@mixin` | moves or hides selectors from analysis |
| nesting | already native |

So the exclusion follows from the contract's own rules rather than from a tooling
limitation. Support may be reconsidered if a concrete need appears; nothing is
scaffolded for it in advance.

### Declaration authoring modes

`declarationMode: "plain"` is the canonical default. Every declaration is visible
to Nagi CSS, so selector, ownership, layout, token, and raw-value rules can all be
evaluated from the component source. `@apply` in this mode is reported by
`apply-directive-not-enabled`.

`declarationMode: "tailwind-apply"` is an **experimental compatibility backend**
in the 0.3 line, not the standard authoring path. Its coverage and API may change
before promotion to stable. Derived classes, variants, attribute state, nested
`>` edges, and component boundaries remain exactly the same. Only declarations
may use Tailwind utilities behind those selectors:

```css
.app-user-card {
  @apply grid gap-4;

  > .button {
    @apply rounded-md px-3 py-2;
  }
}
```

This is not Tailwind-in-template. Standalone utility classes remain forbidden in
markup. Tailwind validates utility names and expands their declarations. Before
expansion Nagi CSS cannot generally inspect the property and resolved value
behind a named utility, so declaration-dependent rules do not claim complete
coverage of those utilities. Raw declarations written beside `@apply` are still
inspected. The `layout-only-wrapper` advisory is likewise unavailable for a rule
whose layout exists only inside `@apply`.

Arbitrary Tailwind syntax is rejected inside `@apply`. Write `font: inherit`
beside `@apply` instead of hiding it in `font-[inherit]`; the same applies to
arbitrary properties and values. Surface-root position, margin, inset, and
stacking utilities are interpreted far enough to preserve the existing external
layout rule. Tailwind remains responsible for expanding and validating the
ordinary named utilities.

The consequence is intentional and visible: `plain` provides Nagi's full
declaration audit with no CSS toolchain dependency; `tailwind-apply` preserves
the structural contract while delegating declaration correctness to Tailwind and
the application's theme configuration.

---

## Core Concepts

Nagi CSS is built on four core concepts.

- Owned DOM
- Styling Surface
- Style Elements
- Style Variants

### Owned DOM

Owned DOM is the DOM structure that a component or styling surface fully controls and can guarantee.

Controllable means the surface can decide and preserve:

- which elements exist
- which classes and attributes they receive
- how state is represented
- when the structure may change

Example of controllable DOM:

```html
<div class="dialog-panel">
  <header class="header">
    <h2 class="title">Delete item</h2>
  </header>
  <p class="p">Are you sure?</p>
</div>
```

Here, `dialog-panel` owns `header`, `title`, and `text` because their structure and class names are part of the surface implementation.

Example of uncontrollable DOM:

```html
<custom-dialog-panel class="dialog-panel">
  <h2 slot="title">Delete item</h2>
  <third-party-calendar></third-party-calendar>
</custom-dialog-panel>
```

Here, `dialog-panel` may own its own component template, but it does not own the assigned slotted title content or the internal DOM of `third-party-calendar`.

The `<slot>` element itself is owned only when it appears inside the component template. The nodes assigned to that slot are non-owned.

Inside owned DOM, strict naming and CSS authoring rules apply.

Outside owned DOM, styling must rely on public contracts rather than internal structure.

Examples and detailed guidance for uncontrollable DOM are collected in the Appendix: Non-owned Boundaries.

### Styling Surface

A styling surface is a public styling boundary over owned DOM.

A styling surface may correspond to:

- a component root
- a subcomponent
- a slot container
- a stable public part of a larger UI

A styling surface is the unit that owns a local styling contract.

Example:

```html
<section class="settings-panel">
  ...
</section>
```

Here, `settings-panel` is the styling surface class. It is the public boundary where the local styling contract begins.

### Style Elements

Style elements are named sub-parts inside the owned DOM of a styling surface.

They represent stable UI-semantic or structural units that the surface is responsible for styling.

Example:

```html
<section class="settings-panel">
  <header class="header">
    <h2 class="title">Notification settings</h2>
  </header>
  <div class="unit">...</div>
  <footer class="footer">...</footer>
</section>
```

Here, `header`, `title`, `unit`, and `footer` are style elements owned by `settings-panel`.

### Style Variants

Style variants express stylistic differences that apply to a styling surface or one of its style elements.

They do not represent runtime state.

Example:

```html
<section class="settings-panel -compact">
  <header class="header">
    <h2 class="title -muted">Notification settings</h2>
  </header>
</section>
```

Here, `-compact` is a variant of the `settings-panel` surface, and `-muted` is a variant of the `title` element.

Variants modify an anchor; they never name what an element *is*. A variant stem
must therefore stay outside the names the vocabulary hands out as a **base
identity**: element classes, component classes, anatomy, STN tiers, slot surfaces,
banned generic names, and rendered HTML element names (`-title`, `-header`,
`-wrapper`, `-span`). Wanting one of those as a variant is a signal that the
element wants that tag or class instead — a "link-styled button" is a design
error (links navigate, buttons operate), and a title *bar* is not a `-title`
variant but a differently named element.

An **ARIA role name that is not also a base identity** is a different case.
`-search`, `-toolbar`, and `-status` say *which part of the design this is*, and
there is no element or class the author was supposed to use instead — the contract
also forbids adding a role purely as a styling hook. Those are legal variants, and
rejected only on an element that declares the matching role, where the name *was*
available as its base identity (`<div class="unit -dialog" role="dialog">` should
be `<div class="dialog" role="dialog">`).

**A variant is written in the static `class` attribute.** A variant applied by a
binding is runtime state wearing a variant's clothes, so it is rejected
regardless of the word: `:class="{ '-collapsed': !open }"` becomes
`:data-collapsed="!open"`, selected as `[data-collapsed="true"]`. This is what
makes the state rule enforceable — the linter does not have to decide which words
mean state, only that state is what changes.

A static variant does not need a same-base peer. It may restore local meaning to
a generic base (`unit -viewport`) even when that base occurs only once under its
parent. The linter therefore does not infer redundancy from peer counts, an
ancestor path, or an unrelated framework marker such as `data-part`. Accessible
names and ID relationships (`aria-label`, `aria-labelledby`,
`aria-describedby`) are likewise not CSS identities: they remain free to change
with content, locale, and accessibility composition. Nagi CSS rejects only
provable protocol conflicts; whether two different words such as `thead` and
`-head` repeat the same human meaning remains a source-review decision.

#### The variant stem is convention, not derivation

Everything above says what a variant may **not** be. Nothing says what it *is*,
and that is deliberate: a variant encodes a design distinction the contract has no
way to know. `-compact`, `-lead`, `-infra` are the project's words.

So this is the one part of the vocabulary that is not derived, and therefore the
place where naming entropy still collects. The trade is worth naming plainly: the
base identity is derived because it answers "what is this node", which has a
correct answer given the tree; a variant answers "which design distinction is
this", which does not. Deriving it would mean inventing distinctions, and a
contract that guessed here would be wrong more often than a person.

What keeps it bounded is that variants are a small, closed set per surface,
alphabetical, static, and visible in one place — so review can see the whole set
at once. That is a weaker control than derivation, and it is the honest limit of
what this contract mechanizes about names.

---

## Scope of the Contract

Nagi CSS applies strictly **inside owned DOM**.

It does **not** directly govern:

- slotted content owned by a parent
- internal DOM of third-party UI libraries
- portal destinations
- shadow-internal DOM that is not publicly exposed
- global stylesheets: resets, element defaults, token declarations, and
  cross-surface exceptions, none of which is a surface's owned styling

This distinction is essential.

The contract should be treated as:

- **strict inside owned DOM**
- **contract-based at non-owned boundaries**

---

## HTML Class Rules

### 1. Styling Surface

Each styling surface must have one class that identifies the surface.

**The surface root name is derived from configuration and the file, not chosen
(deterministic):**

- a **component** (`…/components/Foo.{vue,svelte,astro}`) → the file basename in kebab-case (`invoice-payment-section.svelte` → `.invoice-payment-section`).
- a **page** (`…/pages/…`) → `<name>-page`, where `<name>` is the file basename, or — when the basename is `index` or a dynamic `[param]` — the nearest meaningful ancestor directory (`procedure/error.astro` → `.error-page`, `procedure/[key]/index.vue` → `.procedure-page`).

`surfaceRootPrefixes` is required and must contain at least one namespace. With
`surfaceRootPrefixes: ["n-"]`, `Button.vue`, `Button.svelte`, or `Button.astro`
must use `.n-button`: bare `.button`
and unrelated `.n-control` both fail. Multiple prefixes are alternative exact
derivations, not a general `startsWith` exemption.

Rules:

- lowercase, kebab-case, stable
- use exactly one configured prefix followed by the file-derived name
- there is one surface root per file, and it sits on the template's root element

Examples:

- `search-form`
- `dialog-panel`
- `user-profile`
- `app-menu`

### 2. Style Elements

Style elements are named sub-parts inside owned DOM.

Rules:

- lowercase
- single word
- UI-semantic where possible
- stable across implementation changes

Preferred examples:

- `header`
- `title`
- `body`
- `footer`
- `button`
- `label`
- `input`
- `icon`
- `field`
- `value`

Avoid vague names such as:

- `wrapper`
- `inner`
- `box`
- `container`
- `thing`
- `content-area`

### 3. Style Variants

Variants must:

- start with `-`
- be lowercase
- represent stylistic meaning, role, density, size, or domain-specific distinction
- may be combined when multiple distinctions apply

Examples:

- `-primary`
- `-compact`
- `-success`
- `-avatar`
- `-sidebar`
- `-dense`

Variants are for styling differences, not runtime state.

Multiple variants may be applied to the same styling surface or style element, and **must be written in alphabetical order** (`-compact -muted`, not `-muted -compact`) so the ordering is deterministic.

Example:

```html
<footer class="footer -dense">...</footer>
```

---

## Semantics

Nagi CSS separates three kinds of semantics.

This distinction is important because class names are styling contracts. A class name should make the UI structure deterministic, not mix UI structure with business data.

### Accessibility Semantics

Accessibility Semantics come from native element roles, ARIA roles, and common interaction roles.

They describe what an element is or does in the accessible interface.

Sources:

- native element roles
- ARIA roles
- common interaction roles

Examples:

- `button`
- `label`
- `input`
- `header`
- `footer`
- `dialog`
- `tab`
- `tabpanel`
- `tooltip`
- `menu`
- `option`
- `status`
- `alert`

Example:

```html
<button class="button">Open</button>
<div class="tabpanel" role="tabpanel">...</div>
```

### UI Anatomy Semantics

UI Anatomy Semantics are contract-defined names for common UI parts that are not directly covered by Accessibility Semantics. They apply only to the residual
`div` / `span` branch of the naming procedure; they never replace a semantic
HTML element's Element Class Table identity.

They are not open-ended. The contract ships a deliberately tiny default allowlist, and a project must decide which additional UI anatomy semantic names are allowed.

Example:

```html
<article class="card">
  <header class="header">
    <h3 class="title">Invoice</h3>
  </header>
  <p class="p">...</p>
</article>
```

### Domain Semantics

Domain Semantics describe business concepts, product concepts, data fields, or domain values.

Domain Semantics may appear in Styling Surface names when they identify the whole surface. Inside a surface, Domain Semantics must be expressed as variants when they affect styling.

Examples:

- `user`
- `profile`
- `invoice`
- `order`
- `shipping-address`

Example:

```html
<article class="card -invoice">
  <header class="header">
    <h3 class="title">Invoice</h3>
  </header>
</article>
```

```html
<div class="field -user">
  <label class="label">User</label>
  <input class="input" />
</div>
```

A surface may use Domain Semantics as its identity:

```html
<article class="invoice-card">
  <header class="header">
    <h3 class="title">Invoice</h3>
  </header>
</article>
```

Avoid putting Domain Semantics into internal style element names:

```html
<article class="invoice-card">
  <div class="invoice-header">
    <h3 class="invoice-title">Invoice</h3>
  </div>
</article>
```

---

## Naming Strategy

The naming procedure is **deterministic and table-first**. Apply the steps in order and stop at the first that matches; within the procedure, judgment is permitted only at the final step (`div`/`span` that no table covers). What the procedure itself takes as given — the tree, the configuration — is covered in [Limits of determinism](#limits-of-determinism).

```
Is the element a styling surface root?      → name by surface identity (HTML Class Rules §1)
Is it an HTML element other than div/span?  → Element Class Table          (no judgment)
Is it a configured UI library component?    → Library Component Class Table (no judgment)
It is a div / span                          → apply the Semantics model: 1 → 2 → 3
```

Domain meaning is never mixed into a style element name; it lives in the surface identity or in a variant.

### Element Class Table (HTML elements, excluding `div`/`span`)

An HTML element other than `div`/`span`, appearing as an **internal style element**, takes a fixed class. The rule is total: **every rendered element self-maps by default — its class is its own tag name** (`<dialog>` → `dialog`, `<form>` → `form`, `<summary>` → `summary`) — and this table lists only the overrides. No element is ever left without a legal class. This removes naming judgment for semantic HTML and confines decisions to `div`/`span`. *When* the class must be present is governed by the linter's `emitPolicy`: **`when-styled`** (default) requires it only where the class is actually referenced in the component's `<style>` (an unstyled subtree carries none), while **`always`** requires it on every matching element for maximum uniformity. Either way the *name* is fixed by rule.

The default has a property worth stating: under `when-styled` the required set of
classes is a function of the markup **and** the stylesheet, not of the markup
alone. Adding one CSS rule can make conforming markup non-conforming, and the fix
is in a different file from the change that caused it. That is the price of not
littering unstyled subtrees with classes nothing uses. `always` removes it — the
answer then depends only on the markup — at the cost of classes that exist before
anything needs them. Pick `always` where uniformity matters more than noise, such
as a design-system package whose markup is read more often than it is styled. Multiple same-tag elements share the base class and are differentiated by variants.

**When is an override justified?** Exactly one criterion:

> **The tag varies for reasons unrelated to styling.**

A class that copies such a tag would have to be edited when the tag changes even
though nothing about the styling changed. Everything else self-maps — including
abbreviations (`<nav>`, `<svg>`, `<dfn>`), because those tags do not vary. The
table therefore has two tiers, and the second one is honest about being taste.

**Mechanical overrides** — required by the criterion above:

| Element | class | Why the tag varies |
|---|---|---|
| `<h1>`–`<h6>` | `title` | heading level follows the document outline, so the same title takes a different tag when the component is reused, or a dynamic one when the level is a prop |
| `<ul>` `<ol>` `<dl>` | `list` | ordered and unordered swap for content reasons while the styling is shared |
| `<li>` | `item` | pairs with `list` |
| `<th>` `<td>` | `cell` | header and body cells share their skin; which one a cell is depends on its row group, and the mandatory `>` chain already names that (`.thead > .row > .cell`) |

**Readability overrides** — not required by the criterion; kept because the tag
name is cryptic and the mapping reads better. Their justification is preference,
and the list is deliberately closed:

| Element | class | |
|---|---|---|
| `<small>` | `note` | side comments and fine print |
| `<a>` | `link` | |
| `<img>` | `image` | |
| `<dt>` | `term` | |
| `<dd>` | `definition` | matches the HTML-AAM role, paired with `term` |
| `<tr>` | `row` | |

A mapping is always **a single base class**. There is no mechanism for fixing a
variant alongside a base: a distinction a selector can reach belongs in an
attribute or an ancestor step (see the notes below), and one it cannot reach
means the elements want different classes.

Everything else self-maps: `<p>` → `p`, `<header>` → `header`, `<section>` → `section`,
`<button>` → `button`, `<dialog>` → `dialog` (a top-layer surface, and a
surface root when natural), `<details>` → `details`, `<form>` → `form`,
`<select>` → `select`, `<thead>` → `thead`, `<tbody>` → `tbody`, and so on for
every rendered element. Notes that survive the trimming:

- **`<p class="p">` means a prose paragraph, not generic UI text.** A short
  label, title-like label, or display string that does not form a paragraph uses
  a `div` / `span` and the first matching Semantics-model identity (often
  `text`). The linter enforces the class boundary (`p.text` is invalid); whether
  the content is genuinely a paragraph remains an HTML-authoring review.

- **`<b>` `<i>` `<u>` `<s>` self-map to nothing.** Their tag names describe a
  rendering (bold, italic, underline, strike-through), not a meaning, so a
  self-map would hand out `.b` and `.i` — the "raw visual appearance" the
  Semantic principle rejects. They are banned as class names instead. In prose
  they need no class and are untouched; a *styled* one has no legal class, which
  is the pressure to use `<strong>`, `<em>`, or a variant on the surrounding
  element. UI Anatomy is limited to `div` and `span`, so an icon wrapper is
  `<span class="icon">`, not `<i class="icon">`.
- `<section>` vagueness is resolved by a variant (`section -payment`), and an
  internal `<article>` that is actually a surface root is named by identity
  (`card`, …).
- `<button>` means the native element only; library button components use
  their configured boundary class.
- `<svg>` self-maps even when glyph-sized. Use an `icon` `div`/`span` wrapper
  only when a separate anatomy wrapper is actually needed. Decorative internal
  `<path>` etc. are not style elements.
- `<select>`/`<textarea>` self-map; a shared control skin targets
  `:is(.input, .select, .textarea)`.
- Row groups self-map, so head and body are distinguished by the ancestor step
  the `>` requirement already forces:
  `.thead > .row > .cell` and `.tbody > .row > .cell`. A row header inside the
  body is the one case an ancestor cannot separate, and it is attribute-reachable:
  `.cell[scope="row"]`.
- Distinctions that live in an attribute are selected through the attribute —
  `<input>` kinds take plain `input` and are styled as
  `.input[type=checkbox]`, `.input[type=radio]`, never through a class copy
  of the `type`.
- ARIA semantics are also attribute-reachable and never replace or supplement
  the fixed base identity. A list separator is
  `<li class="item" role="separator">` and is styled with
  `.item[role="separator"]`; `class="separator"`, `class="item separator"`,
  and `class="item -separator"` are non-canonical on `<li>`.
- ARIA role `menu` on a `div`/`span` still requires an explicit `role`
  attribute; the class `menu` on `<menu>` comes from the self-map.

**Applying the table is rule-based, never taste-based.** The two tiers above are a fixed list; choosing a class from it is mechanical. If the default is semantically wrong, either (a) the element is actually a surface root → name it by identity, or (b) add a variant. Never rename the base class.

**Reserved-element-name rule (machine-enforced).** A class name that equals a **rendered** HTML element name may appear **only** on that element, or on an element the tables deliberately map to it (e.g. `title` on `<h1>`–`<h6>`). So `.button` on a `<div>` is forbidden; `.header` belongs to `<header>` alone. UI library components should not borrow an element-table class just because they render similar markup: a library data-table component should use its configured boundary class, not `table`.

There is no blanket exemption for document-only element names. `body` belongs to `<body>` and is invalid on a `div` or `span`. Deliberate Element Class Table mappings remain valid: headings use `title`, and anchors use `link`. Names not present in the table, anatomy allowlist, accessibility semantics, or STN ladder are not available merely because their native elements normally sit outside a component surface.

### Library Component Class Table (configured components)

A UI library component root that you place in your own markup takes a fixed class from the project's configured table (declared in the linter config, enforced by the linter). A project table should list only opaque third-party/UI-library components the project actually uses. Application-owned components are not listed: each owns the surface root derived from its configured namespace prefix and filename.

When a configured library component does not provide an explicit class value, its class is deterministic: the default `pv-` prefix plus the component name in kebab-case (`DataTable` → `pv-data-table`). `componentClassPrefix` changes the prefix, and an explicit `componentClasses` object value overrides the derived name.

```js
componentClasses: ["DataTable", "Column"]
// pv-data-table, pv-column

componentClasses: {
  DataTable: null,                 // pv-data-table
  LegacyGrid: "legacy-grid-root", // explicit override
}
```

This class is a **UI Library Boundary Class**: an anchor on the component root, not a licence to reach inside. Determinism applies to the *name* and to selector edges around it, not to the library's internal DOM. Style the component's internal DOM only through the non-owned contracts in the Appendix (props → Pass Through → CSS custom properties → `::part()`); never descend from this class into library-owned internals with `>`. See CSS Authoring Rule §4 and the Appendix.

Project config should distinguish:

- boundary classes: application-owned classes placed on UI library component roots;
- internal classes: library-owned classes exposed by the UI library, whether public or private.

The linter receives boundary prefixes separately from internal prefixes so selector edges are deterministic. `libraryBoundaryPrefixes` declares additional opaque root families; `libraryInternalPrefixes` declares library-owned internal classes.

Do not use `componentClasses` as a registry of owned components. An owned child is covered by the rule below instead, which needs no configuration.

### Fixed intrinsic proxies and transparent control components

Some third-party components are neither opaque widgets nor owned child surfaces.
They are syntax around a fixed platform element. `motion.article`, for example,
renders an `article` while adding animation behavior; `AnimatePresence` renders
no wrapper at all. Treating either as an opaque boundary would make the selector
tree less accurate than the runtime DOM.

Declare that fixed relationship explicitly:

```js
intrinsicComponents: {
  "motion.article": "article",
  "motion.div": "div",
  "motion.li": "li",
  "motion.span": "span",
},
transparentComponents: ["AnimatePresence"],
```

An intrinsic proxy receives the mapped Element Class Table identity, and its
children remain owned DOM. A transparent component contributes no selector depth.
These mappings are valid only when the library API fixes the rendered shape. A
polymorphic component whose element is selected dynamically remains opaque; the
linter must not guess its runtime tag.

### Owned child components (nothing is passed down)

An **owned** component you place in your markup already carries a surface root on
its own root element, derived from its own file. So the parent adds no class to
the tag and styles the child by that derived name:

```vue
<template>
  <header class="app-profile-header">
    <UserAvatar />                       <!-- no class here -->
    <NavSidebar class="-collapsed" />    <!-- placement variants may still be passed -->
  </header>
</template>
```
```css
.app-profile-header {
  > .app-user-avatar { margin-inline-end: 0.75rem; }
  > .app-nav-sidebar.-collapsed { inline-size: 3rem; }
}
```

The name is derived the same way as a library boundary class — a prefix plus the
component name in kebab-case — only the prefix comes from `surfaceRootPrefixes`
rather than `componentClassPrefix`. The linter derives the accepted set from the
component tags in the template, so a typo, or a stale name after the component is
renamed, is rejected; nothing has to be declared. This assumes the component's tag
matches its file name, which is the usual convention.

Two consequences:

- **A base class on an owned component tag is a violation.** The child's identity
  is already decided by its file; a second name for the same element would mean
  two correct answers. Variants are different — they express *placement*, which is
  the parent's business, and may be passed down.
- **The parent may style that root and nothing below it.** The DOM inside belongs
  to the child's surface. In Vue this is also how the platform behaves: scoped CSS
  puts the parent's scope id on the child's root element *and no deeper*, so a
  selector reaching inside silently matches nothing. The linter reports it rather
  than leaving it to look intentional.

### The Semantics model (applies only to `div`/`span`)

The following three steps name a `div`/`span` — the only elements the tables do not cover.

### 1. Accessibility Semantics

Use Accessibility Semantics as the first source for base names inside owned DOM.
For a styled `div` or `span` with a static identifying role, this order is
enforced rather than advisory: the matching role name is the base identity, and
an anatomy or STN fallback is rejected. For example,
`<div class="group" role="group">` is canonical; `class="field"` or
`class="unit"` on that same element is not. The linter can replace one
unambiguous fallback while preserving its static variants.

This includes native element roles, ARIA roles, and common interaction roles. For
the residual `div`/`span` step only, a class equal to an **ARIA role name**
(`toolbar`, `tablist`, `tabpanel`, `menu`, `option`, `alert`, `status`,
`dialog`, `separator`, …) is permitted **only when the element carries the
matching `role="X"` attribute**. The non-identifying roles `generic`, `none`,
and `presentation` do not supply a CSS identity and continue to anatomy or STN.
An element already covered by the Element
Class Table keeps that fixed identity and exposes its additional ARIA semantics
through the attribute selector. No explicit `role` on a `div`/`span` → fall
back to a UI Anatomy name or STN.

Example:

```html
<div class="dialog-panel">
  <header class="header">
    <h2 class="title">Delete item</h2>
  </header>
  <footer class="footer">...</footer>
</div>
```

```html
<div class="tabs">
  <button class="button" role="tab" aria-selected="true">Details</button>
  <div class="tabpanel" role="tabpanel">...</div>
</div>

<style>
  .button[role="tab"] { /* ... */ }
</style>
```

### 2. UI Anatomy Semantics

Use UI Anatomy Semantics only when the name is part of the project or contract allowlist.

Default allowlist — deliberately tiny. Each has a crisp definition; anything that does not match exactly falls back to STN.

- `field` — a visible form-field or composite-control frame; its accessible
  label may be inside the frame or associated from a sibling
- `value` — the read-only display of a single datum
- `actions` — a group/row of buttons or action controls
- `media` — a wrapper for an image / figure / illustration
- `icon` — a glyph-sized pictogram wrapper
- `text` — a short textual run or UI label that has no more specific semantic
  element; it is Anatomy and therefore appears only on `div` / `span` (normally
  `span`). An actual prose paragraph remains `<p class="p">`.

Dropped names route elsewhere: `title`/`body` → element table or STN; `list`/`item` → `<ul>`/`<ol>`/`<li>`; `card`/`panel` → STN + a `-card` variant; `status` → a `-success`/`-error` variant or `role="status"`; `trigger`/`overlay`/`viewport` → `role=` or a variant.

Example:

```html
<article class="card">
  <header class="header">
    <h3 class="title">Invoice</h3>
  </header>
  <p class="p">...</p>
</article>
```

### 3. Structural Tier Names (STN)

Use STN only for a `div`/`span` that no Accessibility Semantics or allowlisted UI Anatomy name fits — the structural fallback for elements that would otherwise become `wrapper`, `inner`, or `box`.

The tier ladder, coarse → fine: `stratum` · `region` · `block` · `unit` · `seg` · `fr` · `g`.

STN is **leaf-anchored with a unit floor**. The deepest tier is `g`; shallow chains start at `unit` and go `unit → seg → fr → g`. A chain reaches above `unit` (into `block → region → stratum`) only when it is deep enough to also bottom out at `g`. So the coarse names (`stratum`/`region`/`block`) appear **only in genuinely deep surfaces** — seeing one is a signal the surface is deep (and probably should be split). Depth is counted along the **STN chain** (nearest-STN-ancestor → nearest-STN-descendant), not raw DOM depth: semantic elements and components between STN nodes don't count, so the more semantic the markup, the fewer and shallower the STN names.

The scheme is enforced by three **local relations** — no global depth computation, no absolute "tier = depth":

- **Consecutive (no skip).** A STN element is exactly one tier finer than its nearest STN ancestor (`unit → seg → fr → g`). No skipping, no inversion. Siblings therefore share a tier.
- **Floor.** The shallowest STN in a surface (no STN ancestor) is `unit` or coarser — never `seg`/`fr`/`g` at the top.
- **Reach-g.** If a surface uses any tier coarser than `unit` (`block`/`region`/`stratum`), it must also use `g`. "`block` without `g`" is illegal: a coarse tier only appears when the chain is long enough to reach the leaf.

These three uniquely determine the tiers for any tree and are machine-checkable per surface (parent/child adjacency + a per-surface "is `g` present?" check). A slot sub-surface is its own surface and resets the chain.

- Restore local meaning with a variant (`unit -filters`), never by changing the tier.

#### Layout-only wrapper review

STN names make structural wrappers readable; they do not prove that every
wrapper is necessary. `layout-only-wrapper` therefore reports a **warning** when
a `div` or `span` has only a static class, is the sole visible branch of its
parent, contains one visible template branch, and every declaration applied to
it is flex/grid layout or sizing. The warning asks for review; it does not claim
that the element can be removed.

The rule stays silent when the element owns semantics or behavior (`role`,
`aria-*`, `data-*`, `ref`, events, or other directives), has multiple child
branches, or owns properties such as `overflow`, `position`, `transform`,
`transition`, or `animation`. It has no autofix. Moving layout can change scroll
geometry, intrinsic sizing, containment, or animation ownership, so removal must
be verified in the rendered component and its browser tests.

```html
<!-- review candidate; not automatically invalid -->
<div class="seg -items">
  <article class="article" v-for="item in items">...</article>
</div>
```

```css
.seg.-items {
  display: flex;
  inline-size: 100%;
}
```

#### STN naming charter

`unit` is a hierarchy name, not a measurement unit. In source it appears as a
class token (`class="unit"`, `.unit`), so search for that code form or say “STN
unit” when prose needs to distinguish it from a unit test. Two tiers below it,
`fr` is short for **fraction**. In a class token it is an STN tier; in a CSS
declaration value it retains the standard CSS Grid fractional-unit meaning.
The leaf remains `g` rather than `u`, because `u` collides with the rendered
`<u>` element and its fixed class.

The generic quality of `unit` is deliberate. It is the most frequent STN tier,
and repeated use gives a generic anchor a stable local meaning. Its adjacency
to `block` also supplies the familiar block → unit reading. Rare tiers need
distinctive words because readers repeatedly have to recover their meaning;
the frequent anchor does not.

Rejected alternatives are recorded here so the same constraints do not need
to be rediscovered:

- `pane` — a concrete UI term that implies a visible panel and violates the
  rule against false UI anatomy.
- `area` — collides with the rendered `<area>` element and its fixed class.
- `space` — suggests whitespace or spacing rather than hierarchy, collides
  heavily with layout/token language, and loses the local block → unit reading.
- `tract` — distinctive but too uncommon in ordinary engineering vocabulary;
  intermittent encounters force readers to recover its meaning again.

Example (a shallow surface: two nested STN divs plus an isolated one — all start at `unit`):

```html
<section class="settings-panel">
  <div class="unit -filters">
    <div class="seg -search">...</div>
  </div>
  <div class="unit -summary">...</div>
</section>
```

(`-summary` rather than `-footer`: `footer` is a base identity in the element
table, so a variant may not borrow it — if the block really is the footer, it
should be `<footer class="footer">`. `-search` is fine, because `search` is only
an ARIA role name here and this element does not declare that role.)

> Determinism note: the tier is still fully determined by the tree (no "size" / "start anywhere" judgment) — it is anchored at the leaf (`g`) with a `unit` floor instead of at the root. That keeps it machine-checkable, and makes the coarse tiers a rare "this is deep" signal rather than the default outermost name. (Anchoring `tier = depth-from-root` instead would make `block` appear in shallow trees that never reach `g`.)

#### Depth is capped — splitting is the judgment the ladder rests on

The ladder itself is mechanical: given the markup, the surface root name, the
element/component/anatomy/role tables, and the depth→tier mapping each yield
exactly one answer. What the ladder cannot decide for you is **where to draw
component (styling-surface) boundaries** — when to stop nesting inside one
surface and extract a child component with its own surface root. The contract
*requires* appropriate splitting; it does not, and cannot, fully mechanize it.
This is one of the places listed in [Limits of determinism](#limits-of-determinism),
and the one that bears directly on depth.

- **STN depth is capped at 7 by design.** The seven tiers are finite headroom,
  not a vocabulary. Reaching the deepest tiers means a surface is carrying a lot
  of structure; a genuinely 7-deep surface should be **rare and reserved for
  special, irreducibly deep decoration**. **Depth 8 is not allowed** — split the
  block into its own component/surface instead of inventing an eighth tier.
- **If a surface really is irreducibly deeper, raise the ladder in configuration.**
  `tiers` takes the full ladder, so a project can add a coarser name at the front
  and keep `unit` and `g` in place, which the floor and reach-`g` relations anchor
  on:

  ```js
  tiers: ["plate", "stratum", "region", "block", "unit", "seg", "fr", "g"]
  ```

  Shallow surfaces are unaffected — they still start at `unit`. Two things make
  this a deliberate escape rather than a loophole: it is a change to the shared
  configuration, so it lands in a diff and gets reviewed, and it cannot be done
  locally in the file that wants the extra depth. Extending below `g` is not
  supported; `g` is the leaf.
- **Deterministic split triggers:** a block that is rendered repeatedly
  (`v-for` with its own styled internals), reused across files, or would nest
  past depth 7 **must** become its own surface. These are not judgment calls.
- **The judgment (non-deterministic) part:** beyond those triggers, choosing to
  extract a component *to keep surfaces shallow and readable* is a design
  decision — two authors may reasonably draw the boundaries differently. Prefer
  shallow surfaces; deep nesting is a smell and extraction is the cure. This is
  the contract's only irreducibly non-deterministic step, so it is the one thing
  a linter cannot decide for you — it can only flag "you have gone too deep."
- Tier names grow less familiar as depth increases, so a deep surface *looks*
  uncomfortable on purpose — treat that discomfort as the prompt to split.

### 4. Composition

Composition combines a base name with variants.

The base name must come from the first matching naming step: surface identity,
Element Class Table, Library Component Class Table, or the `div`/`span`
Semantics model. Each element has exactly one base identity.

The variant may express a non-vocabulary styling distinction, density, size, or
Domain Semantics. Additional ARIA semantics stay in `role` and are selected by
attribute; an ARIA role name is never copied into a base or variant after an
earlier table match.

Domain Semantics are allowed in two places only:

- Styling Surface names, when they identify the whole surface
- variants, when a domain distinction affects styling inside a surface

Examples:

```html
<button class="button -trigger">Open</button>
<div class="dialog -confirm" role="dialog">...</div>
<div class="unit -filters">...</div>
<div class="unit -order">...</div>
<article class="invoice-card">...</article>
```

This keeps the base class deterministic while allowing local meaning to be restored through variants.

Avoid putting Domain Semantics into internal style element names:

```html
<article class="invoice-card">
  <div class="invoice-header">
    <h3 class="invoice-title">Invoice</h3>
  </div>
</article>
```

---

## State Rule

Runtime state must **not** be represented by classes.

State should be expressed using the following order of preference:

### 1. Native state and pseudo-classes

Examples:

- `:disabled`
- `:checked`
- `:open`

### 2. ARIA state attributes

Examples:

- `aria-disabled`
- `aria-invalid`
- `aria-busy`
- `aria-expanded`

Use ARIA state attributes when the accessibility state is required. Do not add ARIA attributes only to create styling hooks.

### 3. `data-*` attributes

Examples:

- `data-state`
- `data-size`
- `data-orientation`
- `data-tone`

Use `data-*` attributes only when native or ARIA state is not appropriate and the state is an explicit styling contract of the surface.

Example:

```html
<button class="button -primary" aria-disabled="true">Save</button>
<div class="tabs" data-orientation="horizontal"></div>
```

Avoid state classes such as:

- `is-disabled`
- `has-error`
- `-loading`

---

## Structure Rule

Inside owned DOM:

- a styling surface has one class that identifies the surface
- internal styled parts are style elements
- variants may be applied to the surface or elements
- structure should remain readable from markup alone

Example:

```html
<div class="dialog-panel -compact">
  <header class="header">
    <h2 class="title">Delete item</h2>
  </header>
  <p class="p">Are you sure?</p>
  <footer class="footer">
    <button class="button -secondary">Cancel</button>
    <button class="button -danger">Delete</button>
  </footer>
</div>
```

---

## CSS Authoring Rules

### 1. Surfaces are anchored by their nearest owned scope

A file's main styling surface starts at CSS top level. Additional owned surfaces inside that file should be written where their ownership is clearest:

- if the surface is actually inside the main surface in the rendered DOM, nest it under the nearest owned parent surface;
- if a library boundary, slot insertion, portal, or Shadow DOM means there is no direct `>` path, the nested surface selector may be a descendant selector from that parent surface;
- if the surface is teleported or otherwise not under the main surface in the rendered DOM, write it at CSS top level, declare it as detached in the linter config, and keep its class specific enough to be an explicit contract.

This keeps the CSS structure close to the ownership structure instead of flattening every surface to the root of the stylesheet.

### 2. Elements nested under the surface

Style elements should be written inside the surface block using CSS nesting.

### 3. Direct-child structure inside owned DOM is REQUIRED

Inside owned DOM, a parent and its styled child **MUST** be connected with the direct-child combinator `>`. This is not a preference: it is what bounds the blast radius of a style element. A generic name like `.title` is safe only because it is always anchored to its surface through a `>` chain — `.dialog-panel > .header > .title` cannot collide with `.card > .title`.

A parent/child relationship that **cannot** be expressed with `>` is, by definition, a boundary (a nested surface, a library component's internals, a slot, a portal, or Shadow DOM) — see rule §4. There is no third case inside owned DOM: `>` is mandatory for styled parent→child steps. Descendant combinators (whitespace) are allowed only to anchor an owned nested surface across such a boundary; they are not allowed for ordinary style-element traversal. Bare style-element selectors at CSS top level are not permitted inside owned DOM.

For UI library boundary classes, the edge rule is mechanical:

- owned surface/element → UI library boundary class: use `>`.
- UI library boundary class → a slot sub-surface declared for that component: use a descendant step, never `>`.
- once the selector reaches an owned slot/sub-surface again, resume `>`.

A boundary selector may stop at the component root to control its external
placement. If it continues, its first anchor must be one of that exact
component's declared slot surfaces. Another public component class or a
library-internal class does not substitute for that owned surface. Use
`:deep()` when deliberately adjusting non-owned internals through an explicit
library contract.

Example:

```css
.runtime-page {
  > .lib-data-table .column-cell {
    > .value {
      font-weight: 600;
    }
  }
}
```

Here `.runtime-page → .lib-data-table` is owned markup and uses `>`. `.lib-data-table → .column-cell` crosses library internal DOM or slot insertion and uses a descendant step. `.column-cell → .value` is owned DOM again and uses `>`. The `lib-*` prefix is illustrative; actual boundary prefixes are project-configured.

Example:

```css
.dialog-panel {
  padding: 1rem;
  border-radius: 0.5rem;

  > .header {
    margin-bottom: 0.75rem;
  }

  > .p {
    margin-bottom: 1rem;
  }

  > .footer {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }
}
```

### 4. Do not force `>` across non-owned boundaries

Across slots, third-party library internals, portals, or shadow boundaries, `>` must not be assumed.

### 5. Use readable nesting, not arbitrary flattening

Nesting should reinforce the owned structure of the surface.

---

## Responsibility Rule

A styling surface should contain its own visual skin, but not external layout responsibility.

This rule is machine-enforced (`surface-external-layout`): the linter reports
`position`, inset, `margin`, and `z-index` declarations in a surface root's own
rule, with the top-layer and anchored exception below.

### Avoid on the surface element

- `position`
- `top`, `right`, `bottom`, `left`
- `margin`
- `z-index`
- context-dependent `width` and `height`

These belong to the parent layout.

`z-index` is on that list for the same reason as the rest: where a surface sits
in the stacking order *relative to its siblings* is a decision only the parent can
make correctly. This is also the whole answer to the `z-index: 9999` race — every
escalation is an attempt to beat something outside the component, so returning the
property to the parent removes the battlefield rather than refereeing it.

Layering a surface's **own children** against each other is different: it is a
local structural decision (`> .overlay` sits above `> .content`), the values are
small integers, and no design system publishes a scale for them. That stays
unrestricted.

### Allowed on the surface element

- `padding`
- `border`
- `background`
- `border-radius`
- `box-shadow`
- intrinsic sizing when it is part of the surface’s own meaning

### Exception: top-layer and anchored surfaces

A surface rendered in the top layer (`<dialog>`, a `popover` element) has no
parent layout that could own its placement. For such a surface, anchored
placement is part of its own skin: `position-anchor`, `position-area`,
`position-try-*`, and the inset properties that resolve against its anchor are
allowed on the surface element itself.

This preserves the rule's intent rather than weakening it: placement belongs
to whoever owns the coordinate context. In normal flow that is the parent; in
the top layer it is the surface itself.

Such a surface also owns its stacking order, and that is the one place a stacking
scale genuinely exists — the ordering of modals against toasts against popovers is
a system-wide decision, which is what `--z-modal` style tokens are for. So
`z-index` is allowed here but its value is checked
(`stacking-token-required`): a raw level is a system decision written in one
component.

```css
/* Correct, on a top-layer or anchored surface */
.app-confirm-modal { z-index: var(--z-modal) }
```

In short:

> layout outside, skin inside

---

## Compound Component Rule

A compound UI should not be treated as one giant styling tree.

Each owned styling surface applies the contract independently.

Related components should still be treated as separate styling surfaces unless one surface truly owns the other's DOM structure.

**When to split a block into its own surface (deterministic trigger):** split only when the block is **rendered repeatedly** (a `v-for` with its own styled internals), is **reused across files**, or would nest past **STN depth 7**. Internal complexity alone is *not* a reason to split — a one-off block, however elaborate, stays nested under its surface. (For example: an invoice row rendered by `v-for` becomes its own `InvoiceCard` surface; a one-off section header does not.)

Example:

- `dialog-trigger`
- `dialog-panel`
- `dialog-title`

Each may have its own owned DOM and internal naming structure.

The contract does not require the entire compound UI to collapse into one root.

This keeps component relationships simple: a parent does not need to know whether a child exposes pass-through classes, custom properties, or internal wrapper elements in order to style the compound UI correctly.

**A child component's root is a boundary too (machine-enforced).** When a parent
places a pass-through class on an owned child component, that class names the
child's root element and nothing more. The parent may style the root — its own
external layout responsibility — but must not descend past it, because that DOM
belongs to the child's surface and the child is free to change it. The linter
derives this from the template: a class sitting on a component tag is a child
surface root, and `owned-surface-reach-in` reports any selector that continues
below it. No configuration lists owned components; the tag is the evidence.

```css
.profile-header {
  > .media { margin-inline-end: 0.75rem; }  /* the child's placement: the parent's business */
  > .media > .icon { … }                    /* the child's insides: not the parent's business */
}
```

Unlike a UI-library boundary, there is no descendant-step escape here: a library
inserts wrappers you must cross to reach your own slot content, whereas a child
component you own has a file of its own to style it in.

Preferred example:

```html
<div class="dialog-panel">
  <header class="header">...</header>
  <p class="p">...</p>
</div>

<h2 class="dialog-title">Delete item</h2>
```

In this example, `dialog-panel` and `dialog-title` are related, but each is its own styling surface.

---

## Slot Rule

Slots are API boundaries, not guaranteed owned DOM.

When a surface accepts slotted content:

- style the slot container if owned
- style the inserted content only through public hooks or explicit class contracts
- do not assume internal structure of slotted content

This keeps owned and non-owned responsibility separate.

### Library-component slot sub-surfaces

The hard case is **owned content you place into a library component's slot** (e.g. a `<div>` inside a card-like component's content slot). It is owned by you, but it sits behind the library's non-owned internal wrappers, so it cannot nest under the file's surface root with `>` — and forcing it there means chasing library internals with `:deep(...)`, which is brittle.

The resolution is a **declared sub-surface**, configured per library component + slot (`componentSlots` in the linter config):

```
componentSlots: {
  Card: { title: "card-title", content: "card-content", footer: "card-footer" },
}
```

Each slot surface class must start with its owning component's slot prefix; declare `componentSlotPrefixes` when the prefix is more specific than the component's root class.

The owned wrapper inside each slot carries that class, and it is treated as its **own styling surface**: its children nest under it with `>` — no `:deep()` into library internals, so it is robust to the library's DOM. Multiple instances are distinguished with a variant.

```html
<Card>                                <!-- library root: unstyled here → no class -->
  <template #content>
    <div class="card-content -address">   <!-- declared sub-surface + variant -->
      <div class="field"> … </div>
    </div>
  </template>
</Card>
```
```css
.procedure-page {
  > .lib-card .card-content.-address { /* descendant crosses the library boundary */
    > .field { … }
  }
}
```

If that slot content is teleported and no longer sits below `.procedure-page` in the rendered DOM, keep the slot surface at top level and declare it in `detachedSlotSurfaces` — the linter rejects a top-level slot surface that is not explicitly configured as detached:

```css
.card-content.-address {
  > .field { … }
}
```

These slot→class maps are library-specific and shippable as presets; for a library not yet mapped, generate the `componentSlots` entries from its slot API. To style the library's *own* wrapper spacing, that is a non-owned adjustment via `:deep()` — see the Appendix — distinct from styling your owned slot content.

**Only introduce the sub-surface wrapper when you actually style that slot's content.** If the library's slot already lays the content out and you add no owned styles (e.g. a Dialog `#footer` of bare buttons the library right-aligns), leave it unwrapped — adding a wrapper there displaces the library's own layout and forces you to re-create it (a guess, and a regression risk). The sub-surface is for owned content you style, not a blanket requirement on every slot.

---

## Responsive Rule

### Prefer container queries

Responsive behavior should be defined at the styling surface level using container queries whenever possible.

Example:

```css
.card {
  container-type: inline-size;

  @container (inline-size >= 40rem) {
    > .footer {
      justify-content: space-between;
    }
  }
}
```

### A container name is derived, like every other identifier

An unnamed container is the preferred form: it resolves against the nearest
ancestor, so nothing has to be named at all. When a name *is* needed, it is an
identifier, and the contract derives identifiers rather than letting them be
chosen. The name is the surface, qualified by the element that declares it:

| declared on | name |
|---|---|
| the surface's own rule | the surface root — `app-invoice-card` |
| an owned element's rule | surface root + that element's base identity — `app-invoice-card-media` |

```css
.app-invoice-card {
  container: app-invoice-card / inline-size;

  > .media {
    container-name: app-invoice-card-media;
    container-type: inline-size;

    @container app-invoice-card-media (inline-size >= 20rem) {
      > .icon {}
    }
  }
}
```

The element's base identity is already the canonical name for that node, so this
adds no new vocabulary — it reuses the name the contract had already derived.
Reported as `container-name-derived`, with the expected name in the message.

### A container query stays inside the file that declares the container

`@container app-page-main (…)` written in a child component couples that child to
a name it does not own: the parent could rename or remove the container and
nothing would report it. That is the same reach-across the contract already
rejects for selectors, so a named query may only reference a container declared in
the same file (`container-query-scope`). An unnamed query is always allowed —
matching the nearest ancestor container is a relationship, not a dependency on a
name.

### Animation names are derived too, and unused ones are reported

A `@keyframes` name is an identifier, so it follows the same rule as a container
name: prefix it with the surface root (`app-toast-slide-in`). The tail — what the
motion actually is — is a choice the contract does not make, exactly like a variant
stem.

More useful is the other half: a `@keyframes` that no `animation` in the component
references is reported (`dead-keyframes`). Vue, Svelte, and Astro all rewrite the
name per component, so an unreferenced one is not merely unused — it is unreachable,
and nothing outside the component could animate with it either. Motion meant to be
shared belongs in a global stylesheet, which is outside the contract, so a
component's own block is the whole search space.

Reduced motion is deliberately **not** checked. There is no unique correct reduced
variant of an animation, so a rule could only assert that
`prefers-reduced-motion` is mentioned somewhere — a presence check, not a canonical
form, and the contract does not claim authority it cannot derive. Respecting the
preference remains an accessibility obligation regardless.

### Cascade layers are not used inside a surface

`@layer` reorders the cascade. Everything in this contract exists so that the order
never has to be adjusted: one base identity per compound, `>` chains that mirror the
template, no bare element selectors, no utilities. Specificity inside a surface is
flat by construction.

So a layer inside a surface is an escape hatch back to "make this rule win", which
is the judgment the contract removes everywhere else. Reported as
`cascade-layer-in-surface`.

Two legitimate needs are met elsewhere:

- **Global ordering** — reset, base, theme — belongs in a global stylesheet, which
  is outside the contract by the same decision that excludes standalone `.css`.
- **Letting a consumer override** a component is a public contract: expose a custom
  property. A cascade trick makes the override possible without making it declared.

### Reserve viewport media queries for layout-level changes

Global `@media` rules should primarily handle page-level layout decisions rather than local component behavior.

### Avoid responsive size classes

Do not encode breakpoint behavior into class names such as `-sm`, `-md`, or `-lg` when the concern is responsive layout.

---

## Design Tokens and Utilities

### Design Tokens

Color, spacing, radius, shadow, and typography should be defined through CSS custom properties.

**Colors MUST come from a token.** A color is never a local decision: it belongs
to a palette, it changes with a theme, and the same value written in twenty
surfaces is twenty places to edit. So `color: #f0a`, `border: 1px solid
rgb(0 0 0 / .1)`, and `linear-gradient(…, white, …)` are violations, and there is
no `--local-*` escape for them — a one-off length can be an optical correction, but
a one-off color is a decision made in the wrong file.

```css
/* Incorrect */
.card { background: #fff; border: 1px solid rgb(0 0 0 / 0.1) }

/* Correct */
.card { background: var(--color-surface); border: 1px solid var(--color-border) }
```

What is not a color: `currentColor`, `transparent`, `inherit`, and the system
colors (`Canvas`, `GrayText`, `Highlight`) — the last because forced-colors work
delegates the choice to the platform on purpose. Relative color syntax
(`oklch(from var(--color-accent) l c calc(h + 20))`) derives from a token instead
of stating a color, and is allowed.

**Lengths on scale properties MUST come from a token, or be named.** Spacing,
radius, border width, type size, and elevation are scales a design system
publishes, so a magnitude written inline is a scale decision made in one surface:

```css
/* Incorrect */
.card { padding: 12px; gap: 0.5rem; border: 1px solid var(--color-border) }

/* Correct */
.card { padding: var(--space-3); gap: var(--space-2); border: var(--border-hairline) solid var(--color-border) }
```

Here a one-off is legitimate — an optical correction has no place on a scale — so
there is an escape, and it is a **name**:

```css
.card {
  --local-optical-nudge: -1px;

  translate: 0 var(--local-optical-nudge);
}
```

The value is unchanged; what changed is that the exception now says why it exists,
and `--local-` is greppable across the codebase. This is the same move STN makes
for `wrapper`: not forbidding the case, but requiring it to be named.

What is **not** a scale property: this surface's own size and position
(`inline-size`, `max-block-size`, `top`, `inset`). One surface being `32rem` wide
is a layout decision belonging to that surface, and no design system ships a scale
of content widths. Nor are ratios and relative units (`50%`, `1fr`, `40vh`,
`line-height: 1.5`), zero, angles, or durations.

Neither color nor length checking asks which token is correct, only that one is
used, so both work without configuration. They are separate rules
(`value-token-required`, `length-token-required`) so a project can adopt colors
first — the recommended order, since colors have no legitimate one-off.

Nagi CSS ships **names and no values**. Which colors and magnitudes exist is the
design system's decision — a naming contract that also dictated a palette would be
two products in one. But the names are the same kind of thing as an element class,
and the contract treats them the same way: fixed by default so an author or an
agent knows what to reach for, overridable where a project's roles differ.

| family | names | why this shape |
|---|---|---|
| color | `--color-surface` `--color-text` `--color-text-muted` `--color-border` `--color-accent` `--color-accent-text` `--color-danger` `--color-danger-text` | roles — no ordering makes `--color-3` mean anything |
| spacing | `--space-1` … `--space-8` | numeric — `sm`/`md`/`lg` runs out and invites `xxl` |
| radius | `--radius-1` … `--radius-3` | numeric |
| border width | `--border-width-1` `--border-width-2` | numeric |
| type | `--font-size-1` … `--font-size-6` | numeric |
| elevation | `--shadow-1` … `--shadow-3` | numeric |
| stacking | `--z-dropdown` `--z-sticky` `--z-modal` `--z-toast` | roles, for the same reason colors are |

Rename a family through `tokens.semantic` the way `elementClasses` is overridden.
The table is not separately enforced — a project's own declared names are accepted
by `unknown-token` — because token roles are more contested than HTML tags. What
it buys is a default vocabulary: diagnostics can name the token that was wanted
(`reference a token (--space-*)`), and an agent reaches for `--space-3` without
first having to learn this project's dialect.

Beyond the names, what Nagi CSS checks is the **boundary**: that a token a
surface references actually exists, and that it comes from the layer surfaces are
meant to read.

Point the config at the files that declare them, tagged by layer:

```js
tokens: {
  sources: [
    { file: "src/tokens/palette.css", layer: "primitive" },
    { file: "src/tokens/semantic.css", layer: "semantic" },
  ],
}
```

Sources are read as data and never linted; only the custom property names they
declare are collected. These two checks stay inactive until `sources` names at
least one file — they compare against a set the project defines, and with no set
there is nothing to compare — so a project that has no token layer is not asked to
invent one.

| layer | holds | surfaces may reference |
| --- | --- | --- |
| `primitive` | raw values: `--palette-red-500`, `--size-4` | no |
| `semantic` | roles: `--color-danger-text`, `--space-3` | yes |

Two layers, not three. A third component-level tier
(`--button-background-color`) only pays for itself where a component must be
themeable from outside it, and Nagi CSS already has a name for that case:
whatever a library exposes goes in `exposedPrefixes` and is checked by the
library, not here.

A reference that no source declares is an error rather than a warning, because
CSS swallows it silently: `var(--color-surfce)` leaves the property unset with no
sign that a typo happened.

Three references are exempt:

- a custom property the same stylesheet declares, including the `--local-*`
  one-off escape (`localPrefix`)
- a prefix the project exposes as a component's public styling contract
  (`exposedPrefixes`), which a library owns rather than the token layer
- everything, when `sources` is empty

That second exemption also decides fallbacks. `var(--color-text, #333)` states a
raw color, so it is a violation; `var(--pv-datepicker-fg, #333)` is not, because an
exposed contract may legitimately be unset and the fallback is its documented
default.

### Utilities

Standalone utility classes in markup are not allowed.

Utility-like concerns must be expressed as variants on a styling surface or style element.

Example:

```html
<footer class="footer -dense">...</footer>
```

In this example, `footer` remains the style element, while `-dense` expresses a local styling concern as a variant.

Nagi CSS preserves readable styling surfaces rather than collapsing meaning into flat utility composition.
In `tailwind-apply` mode utilities may implement declarations behind those
surfaces; they do not become the template vocabulary.

### Visual hiding and the accessibility tree

Visual visibility and accessibility-tree exposure are separate concerns. ARIA
does not provide an attribute meaning “visually hidden but still exposed to
assistive technology.” In particular, `aria-hidden="true"` removes content from
the accessibility tree and does not hide it visually.

- When content is absent for everyone, use the native `hidden` attribute or the
  component's native visibility mechanism.
- When an existing native or ARIA state is the source of truth for dynamic UI
  visibility, select that state directly. Do not duplicate it with a class.
- When content must remain available to assistive technology but be visually
  concealed, apply the visually-hidden CSS directly to its derived base selector.
  Do not add `-assistive` or `-sr-only` merely to restate that CSS treatment.
- Never add an ARIA attribute only to obtain a CSS selector.

```html
<span class="status" role="status" aria-live="polite">Saved</span>
```

```css
.settings-panel {
  > .status {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    clip-path: inset(50%);
    overflow: hidden;
  }
}
```

The `status` class is the derived styling identity. The CSS controls visual
presentation; `role` and `aria-live` independently describe accessibility
semantics.

---

## Conformance

### MUST

- each styling surface has one class that identifies the surface
- each element and selector compound has exactly one base identity class
- strict rules apply only inside owned DOM
- state is expressed via native states, ARIA, or `data-*`, not state classes; a
  variant is written in the static class attribute, never applied by a binding,
  so a variant cannot become a state class under another name
- style elements are nested under the surface block in CSS
- `>` MUST connect every parent/child inside owned DOM; a relationship that cannot use `>` marks a non-owned boundary
- a selector chain inside owned DOM MUST match the template structure it targets; where the chain leaves owned DOM the requirement stops
- every HTML element other than `div`/`span` carries its fixed class from the Element Class Table
- additional ARIA semantics on a table-mapped element are selected through attributes, not copied into base or variant classes
- every configured UI library component carries its fixed class from the Library Component Class Table, and that class never descends into library internals
- vague structural names should be avoided when stable UI semantics exist
- STN are fallback names only, and their tiers obey the floor, consecutive-tier, and reach-`g` relations
- external layout responsibility, including `z-index`, must remain outside the
  surface; where a surface legitimately owns its stacking order, the level MUST
  come from a token
- colors MUST come from a token; a raw color has no `--local-*` escape
- lengths on scale properties (spacing, radius, border width, type size, elevation)
  MUST come from a token or be declared as a named `--local-*` value
- where the project declares token sources, every referenced custom property MUST
  be declared by one of them and MUST come from the semantic layer, unless it is
  declared in the same stylesheet or exposed by a library

### SHOULD

- prefer native or UI-semantic names over structural fallback names
- prefer container queries over viewport rules for local behavior
- prefer an unnamed container; where a container is named, the name MUST be derived
  from the surface and the element declaring it, and a named query MUST reference a
  container declared in the same file
- `@keyframes` names are prefixed with the surface root, and an unreferenced
  `@keyframes` MUST NOT be left in a component
- `@layer` MUST NOT be used inside a surface
- prefer public styling contracts over DOM chasing
- keep surface structure readable from markup alone
- use CSS custom properties for tokens and theming

---

## Anti-patterns

Avoid the following:

- treating the entire application DOM as one owned styling tree
- using classes for runtime state
- naming everything `wrapper`, `inner`, or `box`
- overusing STN where UI-semantic names would work
- styling third-party internals as if they were owned DOM
- pushing external layout concerns into reusable surfaces
- reaching for `@layer` or `z-index` to win a cascade or stacking argument the
  structure should have prevented
- collapsing all styling meaning into utility class strings

---

## Appendix: Non-owned Boundaries

Non-owned DOM is outside the strict naming and nesting rules of this contract.

When styling third-party UI, slotted content, portal content, or Shadow DOM components, use public contracts in this order:

1. CSS custom properties
2. documented class / slot / pass-through APIs
3. `data-*` attributes
4. `::part()`
5. descendant selectors only when necessary

Do not treat library internals as owned DOM.

Apply the contract again only after styling returns to a surface you own.

### CSS custom properties

CSS custom properties are useful when a component exposes styling inputs that affect internal or child DOM.

This is not DOM ownership. It is a public contract: the owning component decides what the variable means and where it is consumed.

Use this when a component explicitly supports it:

```css
.date-picker {
  --date-picker-accent-color: var(--color-primary);
}
```

Avoid chasing internal descendants when a variable is available.

### Class and pass-through APIs

Some components expose a documented `className`, slot class, or pass-through API.

Use those APIs to attach styling to the exposed root or slot target. This is especially appropriate for external layout responsibility, because parent surfaces own placement while child surfaces own their own skin.

This is for **third-party** components only. Passing a class to a component owned
by the same codebase is not the way to place it: that child already carries its
own derived surface root, so style it by that name and pass nothing — see
[Owned child components](#owned-child-components-nothing-is-passed-down).

Good use cases for pass-through classes are therefore narrow:

- third-party UI libraries that expose the class as an official styling hook
- parent-owned external layout adjustments such as margin, grid placement, or flex alignment, on such a library component

Example, where `Calendar` comes from a UI library:

```html
<div class="app-booking-form">
  <Calendar class="pv-calendar" />
</div>
```

```css
.app-booking-form {
  > .pv-calendar {
    margin-inline-end: 0.75rem;
  }
}
```

The passed class should not be used to override arbitrary internal DOM of the child component.

### `data-*` attributes

Use `data-*` attributes across non-owned boundaries only when the component or library exposes them as a public state contract.

Example:

```css
.accordion {
  &[data-state="open"] {
    border-color: var(--color-primary);
  }
}
```

Do not invent selectors against private attributes that are not part of the component contract.

### `::part()`

For Shadow DOM, use `::part()` only when the custom element exposes parts intentionally.

Prefer giving the custom element itself a styling surface class, then style the exposed parts from that surface.

```html
<div class="video-section">
  <custom-video-player class="video-player">
    #shadow-root
      <button part="play-button">Play</button>
      <div part="timeline">...</div>
  </custom-video-player>
</div>
```

```css
.video-player {
  &::part(play-button) {
    background-color: red;
  }
}
```

This keeps the custom element as the styling surface instead of letting an unrelated parent reach too far into its internals.

### Descendant selectors

Use descendant selectors across non-owned boundaries only as a last resort.

They are acceptable only when the target structure is stable enough for the project and no better public contract exists.

---

## Summary

Nagi CSS is a strict local styling contract for **owned DOM inside a styling surface**.

It preserves the strengths of semantic class naming and nested CSS while adapting them to modern UI realities such as compound components, slots, third-party libraries, and AI-assisted implementation.

Its core rule is simple:

> Apply strict semantic structure where DOM is owned.
> Use public contracts where DOM is not owned.
