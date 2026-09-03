# Changelog

## 0.3.0 — Unreleased

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
  of the same base class. Runtime state remains attribute-based.
- Documentation now separates mechanically enforced rules from HTML and design
  review criteria.

### Migration

See [Migrating to 0.3](docs/migrations/0.3.md).

## 0.2.0 — 2026-08-28

- Previous published release. Detailed change notes were not maintained before
  this changelog was introduced.
