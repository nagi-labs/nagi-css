# Nagi CSS — instructions for coding agents

This file is the portable version of the Nagi CSS contract, for agents that read
`AGENTS.md` (Cursor, Codex, and others). Claude Code loads the richer
`skills/nagi-css` skill instead and does not need this file.

Copy this into the application repository you are working in, or link to it, so
the agent writing components has the rules before it writes them. Mechanical
rules below are enforced by ESLint; the explicitly identified authoring choices
remain review criteria.

Full reasoning: [CONTRACT.md](CONTRACT.md). Objections: [FAQ.md](FAQ.md).

## What this contract is

Class names are **derived, not chosen**. Given a component's markup and the
project's configuration, the correct class for each node is unique, and a linter
checks it. Styling stays in plain CSS in the component's own style block: no
runtime, no build step, no utility classes.

## Naming procedure

Apply top to bottom, stop at the first match.

1. **Surface root** — the component's outermost styled element takes the
   configured prefix plus its own file name: `app-` + `UserCard.vue` →
   `app-user-card`. Never invented.
2. **An HTML element other than `div`/`span`** — takes its fixed class from the
   Element Class Table below. No judgment.
3. **A configured UI-library component** — takes its configured class
   (`DataTable` → `pv-data-table` by default).
4. **`div` / `span`** — and only here is there a choice: an identifying ARIA
   role name backed by a real `role` attribute, then the anatomy allowlist, then
   STN. This priority is mandatory: `role="group"` takes `group`, not `field` or
   `unit`. `generic`, `none`, and `presentation` do not identify a CSS part and
   fall through.

Domain meaning belongs in the surface identity or in a variant, never in a
style-element name: `field -recipient`, not `recipient-field`.

### Element Class Table (the overrides)

| element | class | element | class |
|---|---|---|---|
| `h1`–`h6` | `title` | `ul` `ol` `dl` | `list` |
| `li` | `item` | `small` | `note` |
| `dt` | `term` | `a` | `link` |
| `dd` | `definition` | `img` | `image` |
| `tr` | `row` | `th` `td` | `cell` |

Every other rendered element **self-maps**: `p` → `p`, `header` → `header`,
`section` → `section`, `button` → `button`, `dialog` → `dialog`, `thead` →
`thead`, and so on. `<b>` `<i>` `<u>` `<s>` are the exception — their tag names
describe a rendering rather than a meaning, so those class names are banned;
use `<strong>` / `<em>`, or a variant.

`<p class="p">` is reserved for a prose paragraph. Short UI text that is not a
paragraph normally uses `<span class="text">`; the linter enforces the class/tag
boundary, while whether the content is genuinely prose remains an HTML review.

A distinction a selector can already reach is selected, not renamed:
`.input[type="checkbox"]`, `.item[role="separator"]`, `.thead > .row > .cell`.

### Anatomy allowlist (`div`/`span` only)

`actions` `field` `icon` `media` `text` `value` — and nothing else. `wrapper`,
`container`, `inner`, `box`, `content-area` are banned.

### STN — the structural fallback

For a `div`/`span` that no name above fits. The tier comes from depth, anchored at
the leaf:

`stratum` → `region` → `block` → `unit` → `seg` → `fr` → `g`

Rules: the shallowest tier used is `unit` or coarser; descendant tiers are
consecutive; a surface starting above `unit` must reach `g`. A surface full of
coarse tiers means the component is too deep — split it.

## Variants

- Start with `-`, alphabetical: `class="footer -dense -sr-only"`.
- **Static only.** A variant applied by a binding is runtime state and is
  rejected: `:class="{ '-open': open }"` → `:data-open="open"`, selected as
  `[data-open="true"]`.
- A variant stem may not be a name the vocabulary hands out as a base identity
  (`-title`, `-header`, `-wrapper`, `-span`). The stem itself is the project's
  word — that part is convention, not derivation.

## State

Never a class. Native state first (`:disabled`, `:checked`, `[open]`), then ARIA
(`aria-expanded`), then `data-*` as an explicit styling contract. `is-active`,
`has-error` are rejected.

## CSS

- The surface root selector is top level; style elements nest under it.
- **`>` connects every owned parent-child edge.** A step that cannot use `>` marks
  a non-owned boundary.
- Selector chains must match the template. A rule whose anchor class is absent
  (`dead-rule`) or whose path does not exist (`selector-mirrors-template`) is
  reported.
- Style owned elements through classes, never bare element selectors.
- A configured UI-library component root is **opaque**: cross it with a descendant
  step, never `>`, and never descend into its internals.
- An owned child component: pass it no class. Its root already carries its own
  derived surface root, so style it as `> .app-user-avatar` and do not reach
  inside it.
- No external layout on the surface's own rule — `position`, inset, `margin`,
  `z-index` belong to the parent. Exception: a top-layer (`<dialog>`, popover) or
  anchor-positioned surface owns its placement, and there `z-index` must be a
  token.
- No `@layer` inside a component. No `@keyframes` the component never animates
  with. A named container is `<surface-root>` or `<surface-root>-<element class>`,
  and a named `@container` query may only reference a container this file declares.

```vue
<template>
  <section class="app-user-card">
    <span class="icon" :class="iconName" />
    <div class="value" :data-active="status === 'active'">Ada Lovelace</div>
  </section>
</template>

<style scoped>
.app-user-card {
  > .icon {}
  > .value[data-active="true"] {}
}
</style>
```

## Values

Colors and scale lengths come from tokens, never written raw.

- **Colors**: `color: #f0a`, `border: 1px solid rgb(0 0 0 / .1)`, a named color
  inside a gradient — all rejected. There is no local escape for a color.
  `currentColor`, `transparent`, and the system colors (`Canvas`, `GrayText`) are
  fine.
- **Lengths on scale properties** — spacing, radius, border width, type size,
  elevation. A genuine one-off may instead be a named local value:
  `--local-optical-nudge: -1px`. A surface's own size or position
  (`max-inline-size: 32rem`) is not a scale property and needs no token.

Default token names to reach for, unless the project's config renames a family:

| family | names |
|---|---|
| color | `--color-surface` `--color-text` `--color-text-muted` `--color-border` `--color-accent` `--color-accent-text` `--color-danger` `--color-danger-text` |
| spacing | `--space-1` … `--space-8` |
| radius | `--radius-1` … `--radius-3` |
| border width | `--border-width-1` `--border-width-2` |
| type | `--font-size-1` … `--font-size-6` |
| elevation | `--shadow-1` … `--shadow-3` |
| stacking | `--z-dropdown` `--z-sticky` `--z-modal` `--z-toast` |

## Before you finish

Run the project's ESLint. `--fix` writes the answers the contract computes —
missing fixed classes, the file-derived surface root, STN tiers, variant order —
so run it before reading errors. Everything left needs a decision: fix it at the
markup or selector, and do not add allowlist entries to silence one component.

If a rule looks wrong for the code, say so instead of contorting the markup to
satisfy it. A false positive is a bug in the linter, and reporting it is more
useful than working around it.
