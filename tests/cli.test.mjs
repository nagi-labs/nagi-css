import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { promisify } from "node:util"
import { fileURLToPath } from "node:url"

const execute = promisify(execFile)
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const cli = path.join(repository, "packages/cli/src/cli.mjs")

test("CLI applies only safe fixed-class fixes from an external config", async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "nagi-css-"))
  context.after(() => fs.rm(directory, { force: true, recursive: true }))
  const component = path.join(directory, "FixSurface.vue")
  const config = path.join(directory, "nagi.config.mjs")
  await fs.writeFile(
    component,
    `<template><section class="fix-surface"><button>Save</button></section></template>
<style>.fix-surface { > .button {} }</style>`,
  )
  await fs.writeFile(
    config,
    `export default { eslintFiles: ["*.vue"], stylelintFiles: ["*.vue"], semantic: {} }`,
  )

  await execute(process.execPath, [cli, "check", "--config", config, "--cwd", directory, "--fix"])

  assert.match(await fs.readFile(component, "utf8"), /<button class="button">/)
})
