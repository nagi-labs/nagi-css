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

When the workflow succeeds, review the staged packages on npmjs.com and approve
them in dependency order: core, ESLint plugin, then CLI. Approval makes each
version public. Reject a staged package instead if its contents are not the
expected release. Do not rerun the workflow while the same version is waiting
for approval.
