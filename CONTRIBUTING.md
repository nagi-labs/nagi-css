# Contributing

## Setup

```sh
pnpm install
pnpm test        # plain `node --test` — Node >= 22.18
```

Run the CLI against an application without touching that application's
configuration:

```sh
node packages/cli/src/cli.mjs check \
  --config /absolute/path/to/nagi.config.mjs \
  --cwd /absolute/path/to/application
```

## Ground rules

- **CONTRACT.md is normative.** The skill and the linter are projections of
  it; when they disagree, the contract wins. A behavior change lands as one
  change to code, tests, and the affected documents together.
- **Every example must pass the linter.** Documentation markup is checked
  the same way application code is; do not commit examples the toolchain
  would reject.
- **Determinism is the product.** A proposal that reintroduces judgment
  ("let authors choose…") works against the design. The decision principles
  the vocabulary already follows:
  - the Element Class Table lists only overrides; everything else self-maps
    (class = tag name);
  - **a mechanical override exists only where the tag varies for reasons
    unrelated to styling** (`h1`–`h6` → `title`, since heading level follows the
    document outline). An abbreviation alone is not a reason: `nav`, `svg`, and
    `dfn` self-map;
  - the remaining overrides (`p` → `text`, `a` → `link`, …) are a **closed
    readability tier**, and the repository states plainly that their
    justification is preference rather than rule;
  - a mapping is a single base class. A distinction a selector can reach is
    selected through an attribute (`.input[type=checkbox]`) or an ancestor step
    (`.thead > .row > .cell`); one it cannot reach means the elements want
    different classes;
  - variants never name what an element is.

A table proposal must say **which tier** it belongs to. For the mechanical tier,
name the non-styling reason the tag varies; for the readability tier, expect a
higher bar, since the tier is closed by default.

## Proposing an Element Class Table change

Open an issue with the "Element Class Table proposal" template. A proposal
needs: the element, its current effective class, the proposed mapping, the
meaning-bearing justification, and a collision check (reserved element
names, anatomy, STN tiers, variant-shadow stems).

## Tests

Rule changes need a covering test in `tests/`. The suite is intentionally
plain `node --test`; no test framework dependencies.
