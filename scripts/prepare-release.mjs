import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const releaseRoot = path.join(repository, ".release")
const packageDefinitions = [
  ["core", "packages/core"],
  ["eslint-plugin", "packages/eslint-plugin"],
  ["cli", "packages/cli"],
]

const rootManifest = JSON.parse(
  await fs.readFile(path.join(repository, "package.json"), "utf8"),
)

function rewriteWorkspaceDependencies(manifest, versions) {
  for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    for (const [name, range] of Object.entries(manifest[field] ?? {})) {
      if (!String(range).startsWith("workspace:")) continue
      const version = versions.get(name)
      if (!version) throw new Error(`${manifest.name}: no release version found for ${name}`)
      manifest[field][name] = version
    }
  }
}

await fs.rm(releaseRoot, { force: true, recursive: true })
await fs.mkdir(path.join(releaseRoot, "packages"), { recursive: true })
await fs.mkdir(path.join(releaseRoot, "tarballs"), { recursive: true })

const manifests = new Map()
for (const [key, directory] of packageDefinitions) {
  const manifest = JSON.parse(
    await fs.readFile(path.join(repository, directory, "package.json"), "utf8"),
  )
  if (manifest.version !== rootManifest.version) {
    throw new Error(
      `${manifest.name}: version ${manifest.version} does not match workspace ${rootManifest.version}`,
    )
  }
  manifests.set(key, { directory, manifest })
}

const versions = new Map(
  [...manifests.values()].map(({ manifest }) => [manifest.name, manifest.version]),
)

for (const [key, { directory, manifest }] of manifests) {
  rewriteWorkspaceDependencies(manifest, versions)
  const destination = path.join(releaseRoot, "packages", key)
  await fs.cp(path.join(repository, directory), destination, { recursive: true })
  await fs.writeFile(
    path.join(destination, "package.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )
  await Promise.all(
    ["README.md", "LICENSE"].map((file) =>
      fs.copyFile(path.join(repository, file), path.join(destination, file)),
    ),
  )
}

const smokeManifest = {
  name: "nagi-css-release-smoke-test",
  private: true,
  type: "module",
  dependencies: Object.fromEntries(
    [...manifests.values()].map(({ manifest }) => {
      const archive = `${manifest.name.slice(1).replace("/", "-")}-${manifest.version}.tgz`
      return [manifest.name, `file:../tarballs/${archive}`]
    }),
  ),
}
await fs.mkdir(path.join(releaseRoot, "smoke"), { recursive: true })
await fs.writeFile(
  path.join(releaseRoot, "smoke", "package.json"),
  `${JSON.stringify(smokeManifest, null, 2)}\n`,
)

process.stdout.write(`Prepared Nagi CSS ${rootManifest.version} in .release/packages\n`)
