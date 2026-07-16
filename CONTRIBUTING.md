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
  - the Element Class Table lists only meaning-bearing overrides; everything
    else self-maps (class = tag name);
  - overrides exist to expand HTML's abbreviations (`dd` → `definition`) or
    to erase authoring-time detail (`h1`–`h6` → `title`);
  - a mapping fixes a variant only for distinctions a selector cannot reach
    (tag differences: `thead` → `rowgroup -head`); attribute-reachable
    distinctions are selected through the attribute (`.input[type=checkbox]`);
  - variants never name what an element is.

## Proposing an Element Class Table change

Open an issue with the "Element Class Table proposal" template. A proposal
needs: the element, its current effective class, the proposed mapping, the
meaning-bearing justification, and a collision check (reserved element
names, anatomy, STN tiers, variant-shadow stems).

## Tests

Rule changes need a covering test in `tests/`. The suite is intentionally
plain `node --test`; no test framework dependencies.
