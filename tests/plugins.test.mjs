import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { ESLint } from "eslint"
import stylelint from "stylelint"

import { createNagiEslintConfig } from "@nagi-labs/eslint-plugin-nagi-css"
import { createNagiStylelintConfig } from "@nagi-labs/stylelint-plugin-nagi-css"

const root = path.dirname(fileURLToPath(import.meta.url))
const validFile = path.join(root, "fixtures/valid/Component.vue")
const invalidFile = path.join(root, "fixtures/invalid/Component.vue")
const styleFile = path.join(root, "fixtures/style/BoundarySurface.vue")
const invalidStyleFile = path.join(root, "fixtures/style/InvalidBoundarySurface.vue")

const semantic = {
  componentClasses: { Column: "ui-column", DataTable: "ui-data-table" },
  componentSlotPrefixes: { Column: "ui-table-column" },
  componentSlots: { Column: { body: "ui-table-column-body" } },
  libraryBoundaryPrefixes: ["ui-"],
  libraryInternalPrefixes: ["third-party-"],
}

async function lintEslint(file, config = {}) {
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: [createNagiEslintConfig(config)],
  })
  return (await eslint.lintText(await fs.readFile(file, "utf8"), { filePath: file }))[0]
}

async function lintStylelint(file, config = semantic) {
  return stylelint.lint({
    code: await fs.readFile(file, "utf8"),
    codeFilename: file,
    config: createNagiStylelintConfig(config),
  })
}

test("ESLint accepts additive dynamic classes and reports template violations", async () => {
  const valid = await lintEslint(validFile)
  const invalid = await lintEslint(invalidFile)

  assert.equal(valid.errorCount, 0)
  assert.ok(
    invalid.messages.some(
      ({ ruleId }) => ruleId === "nagi-css/dynamic-class-requires-static-anchor",
    ),
  )
  assert.ok(invalid.messages.some(({ ruleId }) => ruleId === "nagi-css/state-not-class"))
})

test("ESLint autofixes an unambiguous required static class", async () => {
  const eslint = new ESLint({
    cwd: root,
    fix: true,
    overrideConfigFile: true,
    overrideConfig: [createNagiEslintConfig({ emitPolicy: "always" })],
  })
  const code = `<template><section class="fix-surface"><button>-</button></section></template>`
  const [result] = await eslint.lintText(code, {
    filePath: path.join(root, "fixtures/FixSurface.vue"),
  })

  assert.match(result.output, /<button class="button">/)
  assert.equal(result.messages.length, 0)
})

test("Stylelint accepts nested UI boundaries and deep library internals", async () => {
  const result = await lintStylelint(styleFile)
  assert.equal(result.errored, false, JSON.stringify(result.results[0].warnings))
})

test("Stylelint treats an automatically derived pv class as a boundary", async () => {
  const result = await stylelint.lint({
    code: `<template><section class="table-host"><DataTable class="pv-data-table" /></section></template>\n<style scoped>.table-host { > .pv-data-table { > .value {} } }</style>`,
    codeFilename: path.join(root, "fixtures/TableHost.vue"),
    config: createNagiStylelintConfig({ componentClasses: ["DataTable"] }),
  })

  assert.equal(
    result.results[0].warnings.some(({ rule }) => rule === "nagi-css/owned-dom-direct-child"),
    true,
  )
})

test("Stylelint recognizes body while template analysis enforces its owner", async () => {
  const result = await stylelint.lint({
    code: `<template><section class="invalid-body"><div class="body" /></section></template>\n<style scoped>.invalid-body { > .body { color: inherit; } }</style>`,
    codeFilename: path.join(root, "fixtures/InvalidBody.vue"),
    config: createNagiStylelintConfig(),
  })

  assert.equal(result.errored, false, JSON.stringify(result.results[0].warnings))
})

test("Stylelint reports every selector contract family", async () => {
  const result = await lintStylelint(invalidStyleFile)
  const rules = new Set(result.results[0].warnings.map(({ rule }) => rule))

  assert.deepEqual(
    [...rules].sort(),
    [
      "nagi-css/anatomy-allowed",
      "nagi-css/bare-element-selector",
      "nagi-css/boundary-nesting",
      "nagi-css/owned-dom-direct-child",
      "nagi-css/slot-surface-top-level",
      "nagi-css/state-not-class",
      "nagi-css/top-level-surface-only",
    ].sort(),
  )
})

test("detached slot surfaces may anchor a top-level selector", async () => {
  const result = await lintStylelint(invalidStyleFile, {
    ...semantic,
    detachedSlotSurfaces: ["ui-table-column-body"],
  })
  const slotWarnings = result.results[0].warnings.filter(
    ({ rule }) => rule === "nagi-css/slot-surface-top-level",
  )
  assert.equal(slotWarnings.length, 0)
})

test("Stylelint keeps external layout off surfaces except top-layer or anchored ones", async () => {
  const bad = await lintStylelint(path.join(root, "fixtures/layout/BadCard.vue"), {})
  const layoutWarnings = bad.results[0].warnings.filter(
    ({ rule }) => rule === "nagi-css/surface-external-layout",
  )
  assert.deepEqual(
    layoutWarnings.map(({ text }) => text.match(/"([a-z-]+)" belongs/)[1]),
    ["margin", "position", "top", "margin-inline"],
  )

  const dialog = await lintStylelint(path.join(root, "fixtures/layout/ConfirmModal.vue"), {})
  assert.equal(dialog.results[0].warnings.length, 0)

  const anchored = await lintStylelint(path.join(root, "fixtures/layout/HintPopover.vue"), {})
  assert.equal(anchored.results[0].warnings.length, 0)
})

test("Stylelint rejects selector variants that shadow vocabulary names", async () => {
  const result = await stylelint.lint({
    code: `<template><section class="shadow-surface"><p class="text -lead">x</p></section></template>
<style scoped>.shadow-surface { > .text.-title {} > .text.-lead {} }</style>`,
    codeFilename: path.join(root, "fixtures/ShadowSurface.vue"),
    config: createNagiStylelintConfig(),
  })
  const shadowWarnings = result.results[0].warnings.filter(
    ({ rule }) => rule === "nagi-css/variant-shadows-vocabulary",
  )

  assert.equal(shadowWarnings.length, 1)
  assert.match(shadowWarnings[0].text, /-title/)
})

test("ESLint rejects template variants that shadow vocabulary names", async () => {
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: [createNagiEslintConfig()],
  })
  const [result] = await eslint.lintText(
    `<template><section class="shadow-surface"><p class="text -title">x</p></section></template>`,
    { filePath: path.join(root, "fixtures/ShadowSurface.vue") },
  )

  assert.ok(
    result.messages.some(({ ruleId }) => ruleId === "nagi-css/variant-shadows-vocabulary"),
  )
})
