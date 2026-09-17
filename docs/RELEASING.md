# Releasing Nagi CSS

Nagi CSS publishes three public packages in dependency order:

1. `@nagi-labs/nagi-css-core`
2. `@nagi-labs/eslint-plugin-nagi-css`
3. `@nagi-labs/nagi-css`

All package versions must match the root workspace version. Source manifests
keep `workspace:*` for local development. `vp run release:prepare` creates
publishable copies under `.release/packages`, replaces internal workspace
ranges with the release version, and adds the repository README and LICENSE.

## First release

The first version of each package must be published interactively before npm
can attach a trusted publisher. Run these commands inside the sandbox from the
repository root:

```sh
vp run test
vp run release:prepare
```

Review the generated manifests, then authenticate with npm using an account
that can publish to the `nagi-labs` organization:

```sh
vp exec npm login
```

Publish each prepared package in order. Run each command from its indicated
directory:

```sh
cd .release/packages/core
vp exec npm publish --access public

cd ../eslint-plugin
vp exec npm publish --access public

cd ../cli
vp exec npm publish --access public
```

After all three packages exist, configure the same GitHub Actions trusted
publisher on each package at npmjs.com:

- GitHub organization: `nagi-labs`
- Repository: `nagi-css`
- Workflow filename: `release.yml`
- Environment: `npm`
- Allowed action: `npm stage publish`

Create an `npm` environment in the GitHub repository settings and add required
reviewers if releases should require approval. No `NPM_TOKEN` secret is needed
after trusted publishing is enabled.

Finally, create and push the matching version tag. The workflow safely skips a
package version that already exists, so tagging the manually published first
release does not publish it twice.

```sh
git tag v0.1.0
git push origin v0.1.0
```

## Later releases

Update the root and all package versions together, commit the release, then
push the matching `v<version>` tag. The `Release packages` workflow tests,
packs, installs, and submits the packages to npm staged publishing through
OIDC. Trusted publishing automatically attaches provenance for this public
repository.

Before changing the version:

1. Add the user-visible changes and migration notes to `CHANGELOG.md` and
   `docs/migrations/`.
2. Run `vp run test` from the repository root.
3. Run `vp run release:prepare` and inspect every generated manifest and public
   document under `.release/packages`.
4. Pack and install the generated packages in isolated copies of representative
   consumers. For a contract or configuration change, the Nagi UI Blueprints and
   at least one alternate Implementation component are required scopes; do not
   validate only against workspace imports.
5. Run Nagi CSS lint on those declared conformance scopes and run their component
   tests before tagging. A showcase page that has not adopted the contract must
   remain visibly outside that scope rather than being counted as passing.

While versions remain below 1.0, a new rule, configuration key, default
diagnostic, or derived-name change increments the minor version. Reserve a patch
release for corrections that preserve the existing contract.

## Local candidate verification

Run these commands in the checkout's Node environment (on the host for a host
checkout, or inside the sandbox for a sandbox checkout). They do not publish.
Run tests before packing: release tests and `release:prepare` recreate the
generated `.release` directory, including its consumer installation.

```sh
vp run test
vp run docs:check
vp run release:prepare
```

From each of `.release/packages/core`, `.release/packages/eslint-plugin`, and
`.release/packages/cli`, run:

```sh
vp exec npm pack --pack-destination ../../tarballs --json
```

Inspect the file lists, synchronized versions, internal dependency versions,
schema and definition exports, and public documents. From `.release/smoke`, run:

```sh
vp exec npm install --ignore-scripts --prefix .
vp exec node --input-type=module -e 'await import("@nagi-labs/nagi-css-core"); await import("@nagi-labs/eslint-plugin-nagi-css")'
vp exec node node_modules/@nagi-labs/nagi-css/src/cli.mjs --help
```

Copy `examples/vue-minimal` and the relevant Nagi UI working tree to fresh
temporary directories, excluding `node_modules` and generated reports. Preserve
uncommitted source when it is part of the candidate; a Git archive alone is not
sufficient. Replace Nagi CSS dependencies in these isolated copies with the
packed tarballs. Override transitive core/plugin dependencies to those same
tarballs, so no registry or workspace copy substitutes for the candidate.
Install afresh, then run the Vue example's lint and build.

For the scoped-role integration, check the Button, Checkbox, Disclosure, and
RangeSlider Blueprints, plus alternate owned RangeSlider and CLI-owned Checkbox
implementations. Load the public aggregate CSS definition for the standard
implementations and the selected aggregate for owned implementations. Keep
owned files outside the consumer component-boundary map. Run actual ESLint
against these files as well as the definition audits and related browser tests;
core API probes alone do not exercise the packaged plugin.

Also run the consumer's normal integration and unit checks. Record their results
and inspect the browser runner's `--list` output before relying on a focused
selection. Tests registered by a shared package runner may have locations in
that package rather than the importing spec. Positional spec-file filters can
exclude those tests. Use suite-title selection with `--grep`, or run the full
suite, and confirm that the shared Contract cases are actually listed and run.

Record normal integration and unit results
separately from the focused checks: passing the pilot scopes is not a passing
result for all Blueprints. In particular, migrate deprecated vocabulary
configuration and review newly visible uncertainty diagnostics in integrations
that promote every rule to an error. Do not lower severities or skip existing
tests merely to qualify a candidate.

Consumer migration completion is not a Nagi CSS release gate by itself. Classify
each remaining finding against the documented contract and a reproducible
source example. A false positive, broken package integration, or unresolved
decision requiring a Nagi CSS schema, API, or resolver change blocks release.
An expected uncertainty diagnostic promoted to an error by a consumer's stricter
policy does not, provided its migration implications are documented and the
declared conformance scopes and Nagi CSS checks pass. Keep the consumer's failing
result visible; do not relabel it as passing or require a behavior-library
redesign merely to release the analyzer.

## Approving publication

When the workflow succeeds, review the staged packages on npmjs.com and approve
them in dependency order: core, ESLint plugin, then CLI. Approval makes each
version public. Reject a staged package instead if its contents are not the
expected release. Do not rerun the workflow while the same version is waiting
for approval.
