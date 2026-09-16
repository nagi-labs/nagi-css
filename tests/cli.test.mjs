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

test("measure exposes common JSON records, warnings, and parse failures", async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "nagi-measure-"))
  context.after(() => fs.rm(directory, { force: true, recursive: true }))
  const config = path.join(directory, "nagi.config.mjs")
  const file = path.join(directory, "example.vue")
  await fs.writeFile(
    config,
    'export default { files: ["*.vue"], semantic: { surfaceRootPrefixes: ["app-"], emitPolicy: "always" } }',
  )
  await fs.writeFile(
    file,
    '<template><div class="app-example"><div class="popup" /><div class="unit" /><button class="button" /></div></template>',
  )
  const args = ["measure", "--config", config, "--cwd", directory]
  const json = await executeCli([...args, "--json"])
  assert.equal(json.code, 0, json.stderr)
  const report = JSON.parse(json.stdout)
  assert.deepEqual([report.P, report.D, report.U, report.T, report.N], [1, 0, 1, 1, 3])
  assert.equal(report.files[0].nodes[1].classification, "unregistered")
  assert.equal(report.files[0].diagnostics[0].ruleId, "unregistered-semantic-role")
  assert.match((await executeCli(args)).stdout, /Unregistered: 1 \/ 3 = 33.3%/)
  await fs.writeFile(
    path.join(directory, "parts.json"),
    JSON.stringify({
      version: 1,
      scopes: { picker: { roles: { popup: { required: true } } } },
    }),
  )
  await fs.writeFile(
    config,
    'export default { files: ["*.vue"], semantic: { surfaceRootPrefixes: ["app-"], emitPolicy: "always", roleDefinitions: ["parts.json"] } }',
  )
  await fs.writeFile(
    file,
    '<template><div class="app-example" data-role="picker/root"><div class="popup" data-role="picker/popup" /></div></template>',
  )
  const registered = await executeCli([...args, "--json"])
  assert.equal(registered.code, 0, registered.stderr)
  assert.deepEqual(
    [
      JSON.parse(registered.stdout).P,
      JSON.parse(registered.stdout).D,
      JSON.parse(registered.stdout).U,
    ],
    [0, 1, 0],
  )
  await fs.writeFile(file, "<template><div></template>")
  const invalid = await executeCli([...args, "--json"])
  assert.equal(invalid.code, 1)
  assert.equal(JSON.parse(invalid.stdout).parseFailures, 1)
  assert.equal(JSON.parse(invalid.stdout).definitionCoverage.percentage, null)
})

test("CLI applies only safe fixed-class fixes from an external config", async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "nagi-css-"))
  context.after(() => fs.rm(directory, { force: true, recursive: true }))
  const component = path.join(directory, "fix-surface.vue")
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
    path.join(directory, "svelte-surface.svelte"),
    path.join(directory, "astro-surface.astro"),
  ]
  for (const file of files) {
    await fs.writeFile(
      file,
      `<section class="test-${path.basename(file).startsWith("svelte") ? "svelte" : "astro"}-surface"><button>Save</button></section>
<style>.test-${path.basename(file).startsWith("svelte") ? "svelte" : "astro"}-surface { > .button {} }</style>`,
    )
  }
  await fs.writeFile(config, `export default { semantic: { surfaceRootPrefixes: ["test-"] } }`)

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
    path.join(directory, "severity-surface.vue"),
    `<template><section class="test-severity-surface"><div class="wrapper"><p class="p">x</p></div></section></template>
<style>.test-severity-surface { .p {} }</style>`,
  )

  const run = async (severity) => {
    await fs.writeFile(
      config,
      `export default { files: ["*.vue"], severity: ${JSON.stringify(severity)}, semantic: { surfaceRootPrefixes: ["test-"] } }`,
    )
    return executeCli(["check", "--config", config, "--cwd", directory])
  }

  const errors = await run({})
  assert.equal(errors.code, 1)
  assert.match(errors.stdout, /unregistered-semantic-role/)
  assert.match(errors.stdout, /owned-dom-direct-child/)

  const warnings = await run({ "*": "warn" })
  assert.equal(warnings.code, 0, warnings.stdout)
  assert.match(warnings.stdout, /unregistered-semantic-role/)
  assert.match(warnings.stdout, /owned-dom-direct-child/)

  const off = await run({
    "unregistered-semantic-role": "off",
    "owned-dom-direct-child": "off",
  })
  assert.equal(off.code, 0, off.stdout)
  assert.doesNotMatch(off.stdout, /unregistered-semantic-role|owned-dom-direct-child/)
})

test("CLI rejects an unknown or malformed severity entry", async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "nagi-css-"))
  context.after(() => fs.rm(directory, { force: true, recursive: true }))
  const config = path.join(directory, "nagi.config.mjs")
  await fs.writeFile(
    config,
    `export default { severity: { "no-such-rule": "warn", "stn-order": "maybe" }, semantic: { surfaceRootPrefixes: ["test-"] } }`,
  )

  const failure = await executeCli(["check", "--config", config, "--cwd", directory])

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
    path.join(directory, "token-surface.vue"),
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

  const failure = await executeCli(["check", "--config", config, "--cwd", directory])

  assert.equal(failure.code, 1)
  assert.match(failure.stdout, /"--color-edge" is not declared/)
  assert.doesNotMatch(failure.stdout, /--color-surface/)
})
