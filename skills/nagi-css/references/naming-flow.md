# Naming Flow (mechanical)

Deterministic, table-first. Apply top to bottom, stop at the first match. Judgment happens only at the last step (`div`/`span`). Full rationale is in the Nagi CSS contract (`CONTRACT.md` in the Nagi CSS repository) — this is the working procedure. See [contract.md](contract.md) for the compact rule summary.

## Decision procedure

```
1. Styling surface root?          → configured prefix + filename identity (`n-` + `OtpAuthPanel.vue` → `n-otp-auth-panel`)
2. HTML element ≠ div/span?       → Element Class Table            (no judgment)
3. Configured library component?  → Library Component Class Table  (no judgment)
4. div / span?                    → Semantics: 4a → 4b → 4c
```

Domain meaning never goes in a style-element name — only in the surface identity or a variant (`field -recipient`, not `recipient-field`).

## 2. Element Class Table (HTML, excluding div/span) — emit per `emitPolicy`

| element | class | | element | class |
|---|---|---|---|---|
| `h1`–`h6` | `title` | | `ul` `ol` `dl` | `list` (`-description` for dl) |
| `p` | `text` | | `li` | `item` |
| `small` | `note` | | `dt` | `term` |
| `a` | `link` | | `dd` | `definition` |
| `img` | `image` | | `tr` | `row` |
| `th` `td` | `cell` | | | |

Every mapping is **a single base class**; there is no fixed-variant mechanism.
A distinction a selector can reach is selected through it, not copied into a class:

- **attribute** — `<input>` kinds are plain `input`, styled `.input[type=checkbox]`;
  a row header inside the body is `.cell[scope="row"]`
- **ancestor step** — head and body cells differ by their row group, which the
  mandatory `>` chain already names: `.thead > .row > .cell` and `.tbody > .row > .cell`
- ARIA follows the attribute rule: `<li role="separator">` keeps `item` and is
  styled `.item[role="separator"]`; only `div`/`span` may use `separator` as a
  base identity, with a matching role

Every other rendered element **self-maps** (class = tag name): `header`,
`section`, `button`, `dialog`, `form`, `select`, `textarea`, `svg`, `thead`,
`tbody`, `tfoot`, … No element is left without a legal class, except
`<b>` `<i>` `<u>` `<s>`, whose tag names describe a rendering rather than a
meaning: they are banned as class names, so a styled one has to become
`<strong>`/`<em>` or a variant on its surroundings (unstyled prose is untouched,
and `<i class="icon">` still works — that is the anatomy name, not the tag name). An override exists
only where **the tag varies for reasons unrelated to styling** (`h1`–`h6`
follow the document outline); an abbreviation alone is not a reason, so `nav`,
`svg`, and `dfn` self-map. A glyph-sized `<svg>` keeps `svg`; use an `icon`
`div`/`span` wrapper only when a separate anatomy wrapper is actually needed.

Multiple same-tag elements share the base class; differentiate with variants (`button -danger`).
Override only by rule: wrong default → it's a surface root (name by identity) or add a variant. Never rename the base.
An element and a selector compound each carry exactly one base identity;
`item separator` is never a valid composition.

## 3. Library Component Class Table (declared in the config) — emit per `emitPolicy`

A configured UI library component root takes its fixed class from the project's `componentClasses` table. When only component names are listed, the class is derived as `pv-` plus kebab-case. An explicit mapping overrides that default. The config separates boundary prefixes (`libraryBoundaryPrefixes`) from library-internal prefixes (`libraryInternalPrefixes`) so selector edges stay deterministic:

```js
componentClasses: ["DataTable", "Column"]
// DataTable -> pv-data-table; Column -> pv-column
```

List only opaque third-party/UI-library components the project actually uses. Never add an application-owned Vue component: **pass it no class at all**. Its root already carries the surface root derived from its own file, so the parent writes `<UserAvatar />` and styles `> .app-user-avatar` (prefix from `surfaceRootPrefixes` + kebab-case tag). Placement variants may still be passed: `<UserAvatar class="-lead" />`.

This class is a boundary **anchor, not a `>` licence into internals**. Style library internals via props → pass-through APIs → CSS custom properties → `::part()`. Never descend from a boundary class into library-owned internals.

**Owned content in a component's slot** uses a **sub-surface** from the `componentSlots` config: the wrapper inside `<Card><template #content>` is `card-content` (footer → `card-footer`), which starts its own `>` tree with no `:deep` into library internals. Each slot surface starts with its owning component's slot prefix. Multiple instances → variant (`card-content -address`).

## 4. div / span only — the Semantics model

- **4a. Accessibility Semantics** — a class equal to an ARIA role (`toolbar`, `tablist`, `tabpanel`, `menu`, `option`, `alert`, `status`, `dialog`, `separator`, …) is allowed **only when this `div`/`span` carries the matching `role="X"` attribute**. No `role` attribute → no role name. Elements covered by an earlier table keep that table identity and use an attribute selector for the role.
- **4b. UI Anatomy allowlist** (closed, deliberately tiny): `field` (label+control wrapper) · `value` (read-only datum) · `actions` (button/action group) · `media` (image/figure wrapper) · `icon` (glyph-sized pictogram). Nothing else. Banned: `wrapper  container  inner  box  thing  content-area`. Dropped names route elsewhere: `title/body`→element table or STN, `list/item`→`<ul>/<li>`, `card/panel`→STN+`-card`, `status`→`-success` variant or `role="status"`, `trigger/overlay/viewport`→`role=` or variant.
- **4c. STN** — ladder coarse→fine: `stratum · region · block · unit · seg · fr · g`. **Leaf-anchored + unit floor**, enforced by three local relations (depth counted along the **STN chain**, not raw DOM — semantic/component nodes between STN nodes don't count):
  - **Consecutive**: a STN element is exactly one tier finer than its nearest STN ancestor (`unit → seg → fr → g`); no skip, no inversion (siblings share a tier).
  - **Floor**: the shallowest STN in a surface (no STN ancestor) is `unit` or coarser — never `seg`/`fr`/`g` at the top. So an isolated STN div is `unit`.
  - **Reach-g**: if a surface uses a tier coarser than `unit` (`block`/`region`/`stratum`) it must also use `g` ("`block` without `g`" is illegal).

  Effect: coarse names appear only in genuinely deep surfaces (a "this is deep → maybe split" signal). Past `g` → split the surface. Local meaning via a non-vocabulary variant (`unit -filters`), never by changing the tier. `unit` is a hierarchy name, not a measurement unit; `fr` is short for `fraction`.

## Reserved-element-name rule

- A class equal to a **rendered** element name (`header`, `footer`, `label`, `button`, `dialog`, …) may appear **only** on that element, or one the tables map to it (`title` on headings).
- **document-only names are not blanket anatomy**: `body` belongs only to `<body>`. Deliberate table mappings remain available (`title` on headings, `link` on anchors); otherwise use a semantic element, an allowed anatomy name, or STN.
- The linter's `reserved-element-name` rule enforces this from the rendered-element set.

## CSS selector flow

1. Main surface starts at CSS top level.
2. Nested surfaces are written under the nearest owned scope when they remain in that rendered DOM subtree.
3. `>` is **MUST** at every owned parent→child step.
4. UI library boundary edge: owned → boundary class (`ui-*`) uses `>`, then boundary class → exposed slot/sub-surface uses a descendant step.
5. A descendant step is allowed only to anchor a nested surface across a library/slot/shadow boundary; it is not for ordinary style-element traversal.
6. No `>` across library components / named slots / portals / shadow DOM — use public contracts.
7. Style owned elements through classes, not bare element selectors (`> .item`, not `> li`).
8. Nest readably; do not flatten a full descendant path into one selector.

Good:

```css
.procedure-page {
  > .header {
    display: grid;
    > .unit.-intro > .title { margin: 0; }
  }

  > .ui-data-table .ui-table-column-body {
    > .value { font-weight: 600; }
  }
}
```

Bad (flattened, and forces `>` past readability):

```css
.procedure-page > .header > .unit.-intro > .title { margin: 0; }
```

## Example

```html
<article class="invoice-card">
  <header class="header">
    <h3 class="title">Invoice</h3>
  </header>
  <div class="unit">
    <dl class="list -description">
      <div class="field -user">
        <dt class="term">User</dt>
        <dd class="definition">A. Customer</dd>
      </div>
    </dl>
  </div>
  <footer class="footer">...</footer>
</article>
```
