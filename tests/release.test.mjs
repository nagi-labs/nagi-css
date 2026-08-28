import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import fs from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { promisify } from "node:util"
import { fileURLToPath } from "node:url"

const execute = promisify(execFile)
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const workspaceVersion = JSON.parse(
  await fs.readFile(path.join(repository, "package.json"), "utf8"),
).version

test("release staging replaces workspace ranges and includes public documents", async () => {
  await execute(process.execPath, [path.join(repository, "scripts/prepare-release.mjs")], {
    cwd: repository,
  })

  const packageDirectories = ["core", "eslint-plugin", "cli"]
  for (const directory of packageDirectories) {
    const root = path.join(repository, ".release/packages", directory)
    const manifest = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"))
    assert.equal(manifest.version, workspaceVersion)
    assert.doesNotMatch(JSON.stringify(manifest), /workspace:/)
    await fs.access(path.join(root, "README.md"))
    await fs.access(path.join(root, "LICENSE"))
  }

  const plugin = JSON.parse(
    await fs.readFile(
      path.join(repository, ".release/packages/eslint-plugin/package.json"),
      "utf8",
    ),
  )
  const cli = JSON.parse(
    await fs.readFile(path.join(repository, ".release/packages/cli/package.json"), "utf8"),
  )
  assert.equal(plugin.dependencies["@nagi-labs/nagi-css-core"], workspaceVersion)
  assert.equal(cli.dependencies["@nagi-labs/nagi-css-core"], workspaceVersion)
  assert.equal(cli.dependencies["@nagi-labs/eslint-plugin-nagi-css"], workspaceVersion)
})
