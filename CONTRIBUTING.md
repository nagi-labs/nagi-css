# Contributing

## Setup

```sh
vp install -- --frozen-lockfile
vp run test        # plain `node --test` — Node >= 22.18
```

Application integration belongs in its existing framework `eslint.config.*`.
The optional CLI can still check an application from an external config:

```sh
vp exec node packages/cli/src/cli.mjs check \
  --config /absolute/path/to/nagi.config.mjs \
  --cwd /absolute/path/to/application
```

## Ground rules

- Name ordinary source files in `kebab-case` (`profile-card.vue`,
  `dialog-contract.ts`). Keep component tags in templates in `kebab-case`
  (`<user-avatar>`), while JavaScript and TypeScript class declarations use
  `UpperCamelCase` (`class DialogController`). Standard HTML and SVG element
  spellings, and conventional repository files such as `README.md`, keep their
  established names.
- **CONTRACT.md is normative.** The skill and the linter are projections of
  it; when they disagree, the contract wins. A behavior change lands as one
  change to code, tests, and the affected documents together.
- **Every example must pass the linter**, and `tests/docs.test.mjs` enforces it.
  Mark an example with the file it stands for and it is linted with the rest of
  the suite:

  ```
  <!-- nagi-check file=src/components/user-card.vue -->
  ```

  Optional keys: `prefix=` (default `app-`), `components=DataTable,Column`,
  `slots=Card.content=pv-card-content`, `emit=always`. Only complete `vue` blocks
  can be annotated; a fragment that is not a whole component cannot be checked, so
  keep such examples short and derive them from an annotated one where possible.
- **Shared evidence is the product.** Preserve Predefined platform applicability
  while distinguishing Defined author selections, Unregistered names and Structural nodes.
  New diagnostics and reports consume core node resolution; do not implement
  another semantic dictionary.
- Built-in anatomy definition data lives in `packages/core/src/anatomy-definitions.json`.
  Keep descriptions, examples and exclusions useful. Run `vp run docs:generate`
  and `vp run docs:check` after canonical changes; generated Skill references
  must stay synchronized.
- Definition and coverage claims must distinguish template declaration presence
  from runtime behavior and Defined author selection from Predefined identity.

## Proposing an Element Class Table change

Open an issue with the "Element Class Table proposal" template. A proposal
needs: the element, its current effective class, the proposed mapping, the
meaning-bearing justification, and a collision check (reserved element
names, anatomy, STN tiers, variant-shadow stems).

## Tests

Rule changes need a covering test in `tests/`. The suite is intentionally
plain `node --test`; no test framework dependencies.
