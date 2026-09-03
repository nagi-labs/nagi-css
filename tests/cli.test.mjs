import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { run as runCli } from "../packages/cli/src/cli.mjs"

async function executeCli(args) {
  let stderr = ""
  let stdout = ""
  const code = await runCli(args, {
    stderr: {
      write(value) {
        stderr += value
      },
    },
    stdout: {
      write(value) {
        stdout += value
      },
    },
  })
  return { code, stderr, stdout }
}

test("CLI applies only safe fixed-class fixes from an external config", async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "nagi-css-"))
  context.after(() => fs.rm(directory, { force: true, recursive: true }))
  const component = path.join(directory, "FixSurface.vue")
  const config = path.join(directory, "nagi.config.mjs")
  await fs.writeFile(
    component,
    `<template><section class="test-fix-surface"><button>Save</button></section></template>
<style>.test-fix-surface { > .button {} }</style>`,
  )
  await fs.writeFile(
    config,
    `export default { files: ["*.vue"], semantic: { surfaceRootPrefixes: ["test-"] } }`,
  )

  const result = await executeCli(["check", "--config", config, "--cwd", directory, "--fix"])
  assert.equal(result.code, 0, result.stderr)

  assert.match(await fs.readFile(component, "utf8"), /<button class="button">/)
})

test("CLI discovers and fixes Svelte and Astro files by default", async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "nagi-css-frameworks-"))
  context.after(() => fs.rm(directory, { force: true, recursive: true }))
  const config = path.join(directory, "nagi.config.mjs")
  const files = [
    path.join(directory, "SvelteSurface.svelte"),
    path.join(directory, "AstroSurface.astro"),
  ]
  for (const file of files) {
    await fs.writeFile(
      file,
      `<section class="test-${path.basename(file).startsWith("Svelte") ? "svelte" : "astro"}-surface"><button>Save</button></section>
<style>.test-${path.basename(file).startsWith("Svelte") ? "svelte" : "astro"}-surface { > .button {} }</style>`,
    )
  }
  await fs.writeFile(
    config,
    `export default { semantic: { surfaceRootPrefixes: ["test-"] } }`,
  )

  const result = await executeCli(["check", "--config", config, "--cwd", directory, "--fix"])
  assert.equal(result.code, 0, result.stderr)

  for (const file of files) {
    assert.match(await fs.readFile(file, "utf8"), /<button class="button">/)
  }
})

test("CLI honours per-rule severity, and warnings do not fail the run", async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "nagi-css-"))
  context.after(() => fs.rm(directory, { force: true, recursive: true }))
  const config = path.join(directory, "nagi.config.mjs")
  // Two violations: a banned template class and a missing `>` in its style block.
  await fs.writeFile(
    path.join(directory, "SeveritySurface.vue"),
    `<template><section class="test-severity-surface"><div class="wrapper"><p class="p">x</p></div></section></template>
<style>.test-severity-surface { .p {} }</style>`,
  )

  const run = async (severity) => {
    await fs.writeFile(
      config,
      `export default { files: ["*.vue"], severity: ${JSON.stringify(severity)}, semantic: { surfaceRootPrefixes: ["test-"] } }`,
    )
    return executeCli([
      "check",
      "--config",
      config,
      "--cwd",
      directory,
    ])
  }

  const errors = await run({})
  assert.equal(errors.code, 1)
  assert.match(errors.stdout, /anatomy-allowed/)
  assert.match(errors.stdout, /owned-dom-direct-child/)

  const warnings = await run({ "*": "warn" })
  assert.equal(warnings.code, 0, warnings.stdout)
  assert.match(warnings.stdout, /anatomy-allowed/)
  assert.match(warnings.stdout, /owned-dom-direct-child/)

  const off = await run({ "anatomy-allowed": "off", "owned-dom-direct-child": "off" })
  assert.equal(off.code, 0, off.stdout)
  assert.doesNotMatch(off.stdout, /anatomy-allowed|owned-dom-direct-child/)
})

test("CLI rejects an unknown or malformed severity entry", async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "nagi-css-"))
  context.after(() => fs.rm(directory, { force: true, recursive: true }))
  const config = path.join(directory, "nagi.config.mjs")
  await fs.writeFile(
    config,
    `export default { severity: { "no-such-rule": "warn", "stn-order": "maybe" }, semantic: { surfaceRootPrefixes: ["test-"] } }`,
  )

  const failure = await executeCli([
    "check",
    "--config",
    config,
    "--cwd",
    directory,
  ])

  assert.equal(failure.code, 2)
  assert.match(failure.stderr, /severity\.no-such-rule is not a Nagi CSS rule/)
  assert.match(failure.stderr, /severity\.stn-order must be one of error, warn, off/)
})

test("CLI resolves token sources against the checked directory, not the config file", async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "nagi-css-"))
  const elsewhere = await fs.mkdtemp(path.join(os.tmpdir(), "nagi-css-config-"))
  context.after(() => fs.rm(directory, { force: true, recursive: true }))
  context.after(() => fs.rm(elsewhere, { force: true, recursive: true }))
  const config = path.join(elsewhere, "nagi.config.mjs")
  await fs.writeFile(path.join(directory, "tokens.css"), ":root { --color-surface: #fff }")
  await fs.writeFile(
    path.join(directory, "TokenSurface.vue"),
    `<template><section class="test-token-surface"/></template>
<style>.test-token-surface { background: var(--color-surface); border-color: var(--color-edge) }</style>`,
  )
  await fs.writeFile(
    config,
    `export default { files: ["*.vue"], semantic: {
      surfaceRootPrefixes: ["test-"],
      tokens: { sources: [{ file: "tokens.css", layer: "semantic" }] },
    } }`,
  )

  const failure = await executeCli([
    "check",
    "--config",
    config,
    "--cwd",
    directory,
  ])

  assert.equal(failure.code, 1)
  assert.match(failure.stdout, /"--color-edge" is not declared/)
  assert.doesNotMatch(failure.stdout, /--color-surface/)
})
