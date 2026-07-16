# AGENTS.md

For the contract and rationale, read `CONTRACT.md` and `FAQ.md`. For standard
commands and CLI usage, see `README.md`. Tests: `pnpm test`.

## Cursor Cloud specific instructions

Environment is a pnpm workspace publishing four ESM packages under
`packages/*` (core, eslint-plugin, stylelint-plugin, cli). There is **no build
step** — package `exports` point directly at `src/*.mjs`. Dependencies are
refreshed automatically on startup; the notes below cover non-obvious
startup/run caveats only.

- **Node version gotcha.** The repo declares Node `>=22.18.0` (CI uses Node
  22). The VM's default `node` on `PATH` (`/exec-daemon/node`) is `v22.14.0`,
  which is below that floor, so Node 24 is installed via `nvm` and symlinked
  into `/usr/local/cargo/bin` (first on `PATH`) to win over that shim. Verify
  with `node -v` → `v24.x`.
- **pnpm** is provided by Corepack and pinned to `11.1.3` via the
  `packageManager` field; just run `pnpm ...`.
- **Tests:** `pnpm test` (`node --test tests/*.test.mjs`); covers core,
  ESLint plugin, Stylelint plugin, and the CLI end-to-end.
- **CLI (`nagi-css check`).** Runs ESLint + Stylelint against a target repo
  using an external config, e.g.
  `node packages/cli/src/cli.mjs check --config <cfg.mjs> --cwd <target>`.
  A minimal config is `{ eslintFiles: [...], stylelintFiles: [...], semantic: {} }`.
  It is the tool used to verify the sibling `../nagi-ui` blueprints conform.
  Local target profiles / runner scripts belong under the gitignored
  `.sandbox/` and must not be committed.
- **Docs** at `docs/index.html` are a static file (no server/build).
