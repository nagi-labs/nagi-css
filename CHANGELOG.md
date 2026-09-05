# Changelog

## Unreleased

### Changed

- Surface rules explicitly limited by `:modal` or `:popover-open` now reject
  `z-index`, because matching top-layer boxes are ordered by insertion order
  rather than the ordinary z-index stacking rules. A dialog tag or `popover`
  attribute alone no longer produces a top-layer diagnosis; non-top-layer
  anchor-positioned surfaces may still use a stacking token.
- Surface roots may use `position: relative` to establish a containing block
  for owned absolutely positioned children; root inset declarations remain
  external-layout violations.

## 0.4.0 — 2026-09-04

### Changed

- Non-STN variants now require another occurrence of the same base identity in
  the component. The new `variant-requires-peer` error rejects redundant forms
  such as a lone `article -slide`; STN role variants remain exempt.
- Static sibling STN branches at the same tier now receive a
  `stn-peer-variant` review warning when they do not have unique role variants.
  Repeated collections and mutually exclusive conditional branches are
  excluded.

### Migration

See [Migrating to 0.4](docs/migrations/0.4.md).

## 0.3.0

### Added

- ARIA-role-first identity checks for identifying `div` and `span` elements.
- An advisory `layout-only-wrapper` rule for wrappers that may be removable.
- `intrinsicComponents` and `transparentComponents` configuration for render
  proxies such as Motion components and control-only wrappers.
- Explicit declaration backends. Plain CSS remains stable and the
  `tailwind-apply` compatibility backend is experimental.
- Svelte and Astro coverage for the same template and style analysis used by
  Vue components.
- Configuration guidance for repositories that contain both package consumers
  and owned replacement implementations.

### Changed

- Prose paragraphs now self-map to `<p class="p">`. `text` is anatomy for short
  UI text on `div` or `span`; it is no longer the class for a paragraph.
- Element-table identities are reserved for their owning elements more
  consistently.
- Static variants may restore local meaning without requiring another instance
  of the same base class. This 0.3 behavior is superseded by the 0.4
  `variant-requires-peer` rule for non-STN bases.
- Documentation now separates mechanically enforced rules from HTML and design
  review criteria.

### Migration

See [Migrating to 0.3](docs/migrations/0.3.md).

## 0.2.0 — 2026-08-28

- Previous published release. Detailed change notes were not maintained before
  this changelog was introduced.
