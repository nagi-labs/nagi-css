---
name: Element Class Table proposal
about: Propose adding or changing a mapping in the Element Class Table
labels: vocabulary
---

## Element

<!-- e.g. `<output>` -->

## Current effective class

<!-- With the total self-map rule, every rendered element already has a
     class (its tag name). State what it is today. -->

## Proposed mapping

<!-- e.g. `<output>` → `value`, or `<xxx>` → `base -variant` -->

## Why the tag name is not enough

<!-- The table lists only meaning-bearing overrides. Show that the tag name
     encodes HTML history rather than stable UI meaning (like `dd`, `img`,
     `tr`), or that a fixed variant is needed for a distinction a selector
     cannot reach (like `thead` vs `tbody`). Attribute-reachable
     distinctions are rejected: they are selected through the attribute. -->

## Collision check

- [ ] The proposed class is not a rendered HTML element name reserved for
      another element
- [ ] It does not collide with the anatomy allowlist (`actions`, `field`,
      `icon`, `media`, `value`) or the STN tiers (`stratum`…`g`)
- [ ] A fixed variant's stem does not shadow vocabulary outside its base
      (the pairing rule)

## Example markup

```html
<!-- A realistic snippet using the proposed mapping -->
```
