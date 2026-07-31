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

const testSurface = { surfaceRootPrefixes: ["test-"] }

const semantic = {
  ...testSurface,
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
    overrideConfig: [createNagiEslintConfig({ ...testSurface, ...config })],
  })
  return (await eslint.lintText(await fs.readFile(file, "utf8"), { filePath: file }))[0]
}

async function lintStylelint(file, config = semantic) {
  return stylelint.lint({
    code: await fs.readFile(file, "utf8"),
    codeFilename: file,
    config: createNagiStylelintConfig({ ...testSurface, ...config }),
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

test("ESLint and Stylelint share an exact configured surface prefix", async () => {
  const file = path.join(root, "fixtures/prefixed/Toggle.vue")
  const config = { surfaceRootPrefixes: ["n-"] }
  const eslint = await lintEslint(file, config)
  const styles = await lintStylelint(file, config)

  assert.equal(eslint.errorCount, 0)
  assert.equal(styles.errored, false, JSON.stringify(styles.results[0].warnings))
})

test("ESLint autofixes an unambiguous required static class", async () => {
  const eslint = new ESLint({
    cwd: root,
    fix: true,
    overrideConfigFile: true,
    overrideConfig: [createNagiEslintConfig({ ...testSurface, emitPolicy: "always" })],
  })
  const code = `<template><section class="test-fix-surface"><button>-</button></section></template>`
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
    code: `<template><section class="test-table-host"><DataTable class="pv-data-table" /></section></template>\n<style scoped>.test-table-host { > .pv-data-table { > .value {} } }</style>`,
    codeFilename: path.join(root, "fixtures/TableHost.vue"),
    config: createNagiStylelintConfig({ ...testSurface, componentClasses: ["DataTable"] }),
  })

  assert.equal(
    result.results[0].warnings.some(({ rule }) => rule === "nagi-css/owned-dom-direct-child"),
    true,
  )
})

test("Stylelint recognizes body while template analysis enforces its owner", async () => {
  const result = await stylelint.lint({
    code: `<template><section class="test-invalid-body"><div class="body" /></section></template>\n<style scoped>.test-invalid-body { > .body { color: inherit; } }</style>`,
    codeFilename: path.join(root, "fixtures/InvalidBody.vue"),
    config: createNagiStylelintConfig(testSurface),
  })

  assert.equal(result.errored, false, JSON.stringify(result.results[0].warnings))
})

test("Stylelint accepts table-first identity with ARIA attribute semantics", async () => {
  const result = await lintStylelint(
    path.join(root, "fixtures/roles/SeparatorList.vue"),
    {},
  )

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
      "nagi-css/dead-rule",
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
    ["margin", "position", "z-index", "top", "margin-inline"],
  )

  const dialog = await lintStylelint(path.join(root, "fixtures/layout/ConfirmModal.vue"), {})
  assert.equal(dialog.results[0].warnings.length, 0)

  const anchored = await lintStylelint(path.join(root, "fixtures/layout/HintPopover.vue"), {})
  assert.equal(anchored.results[0].warnings.length, 0)
})

test("Stylelint rejects selector variants that shadow vocabulary names", async () => {
  const result = await stylelint.lint({
    code: `<template><section class="test-shadow-surface"><p class="text -lead">x</p></section></template>
<style scoped>.test-shadow-surface { > .text.-title {} > .text.-lead {} }</style>`,
    codeFilename: path.join(root, "fixtures/ShadowSurface.vue"),
    config: createNagiStylelintConfig(testSurface),
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
    overrideConfig: [createNagiEslintConfig(testSurface)],
  })
  const [result] = await eslint.lintText(
    `<template><section class="test-shadow-surface"><p class="text -title">x</p></section></template>`,
    { filePath: path.join(root, "fixtures/ShadowSurface.vue") },
  )

  assert.ok(
    result.messages.some(({ ruleId }) => ruleId === "nagi-css/variant-shadows-vocabulary"),
  )
})

test("ESLint rejects multiple base identities", async () => {
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: [createNagiEslintConfig(testSurface)],
  })
  const [result] = await eslint.lintText(
    `<template><section class="test-separator-list"><li class="item separator" role="separator" /></section></template>`,
    { filePath: path.join(root, "fixtures/SeparatorList.vue") },
  )

  assert.ok(
    result.messages.some(({ ruleId }) => ruleId === "nagi-css/single-base-identity"),
  )
})

test("Stylelint rejects multiple base identities in one compound", async () => {
  const result = await stylelint.lint({
    code: `<style scoped>.test-compound-surface { > .item.unit {} }</style>`,
    codeFilename: path.join(root, "fixtures/CompoundSurface.vue"),
    config: createNagiStylelintConfig(testSurface),
  })

  assert.ok(
    result.results[0].warnings.some(
      ({ rule }) => rule === "nagi-css/single-base-identity",
    ),
  )
})

test("Stylelint rejects the legacy zone STN name", async () => {
  const result = await stylelint.lint({
    code: `<style scoped>.test-legacy-zone-surface { > .zone {} }</style>`,
    codeFilename: path.join(root, "fixtures/LegacyZoneSurface.vue"),
    config: createNagiStylelintConfig(testSurface),
  })

  assert.ok(
    result.results[0].warnings.some(
      ({ rule }) => rule === "nagi-css/anatomy-allowed",
    ),
  )
})

test("Stylelint allows sibling combinators inside owned DOM", async () => {
  const result = await lintStylelint(path.join(root, "fixtures/style/SiblingList.vue"))

  assert.equal(result.errored, false, JSON.stringify(result.results[0].warnings))
})

test("ESLint reports style blocks the toolchain cannot read", async () => {
  const scss = await lintEslint(path.join(root, "fixtures/style/ScssBlock.vue"))
  const external = await lintEslint(path.join(root, "fixtures/style/ExternalStyle.vue"))

  for (const [label, result] of [["scss", scss], ["src", external]]) {
    assert.ok(
      result.messages.some(
        ({ ruleId }) => ruleId === "nagi-css/unsupported-style-syntax",
      ),
      `${label}: ${JSON.stringify(result.messages)}`,
    )
  }

  // Stylelint cannot cover this: it never invokes rules on a file whose style
  // blocks all failed to parse.
  const styles = await lintStylelint(path.join(root, "fixtures/style/ScssBlock.vue"))
  assert.equal(styles.results[0].warnings.length, 0)
})

test("Stylelint allows styling an owned component root but not its inside", async () => {
  const allowed = await lintStylelint(path.join(root, "fixtures/style/OwnedBoundary.vue"))
  const reachIn = await lintStylelint(
    path.join(root, "fixtures/style/OwnedBoundaryReachIn.vue"),
  )

  assert.equal(allowed.errored, false, JSON.stringify(allowed.results[0].warnings))

  const rules = reachIn.results[0].warnings.map(({ rule }) => rule)
  // both the flat and the nested spelling are caught, and neither is told to use ">"
  assert.equal(
    rules.filter((rule) => rule === "nagi-css/owned-surface-reach-in").length,
    2,
    JSON.stringify(reachIn.results[0].warnings),
  )
  assert.equal(rules.includes("nagi-css/owned-dom-direct-child"), false)
})

test("Stylelint checks token references against the configured sources", async () => {
  const tokens = {
    exposedPrefixes: ["--date-picker-"],
    sources: [
      { file: path.join(root, "fixtures/tokens/palette.css"), layer: "primitive" },
      { file: path.join(root, "fixtures/tokens/tokens.css"), layer: "semantic" },
    ],
  }
  const surface = await lintStylelint(path.join(root, "fixtures/tokens/TokenSurface.vue"), {
    ...testSurface,
    tokens,
  })
  const violations = await lintStylelint(path.join(root, "fixtures/tokens/TokenViolations.vue"), {
    ...testSurface,
    tokens,
  })

  // semantic tokens, a --local-* one-off, and a prefix the project exposed
  assert.equal(surface.errored, false, JSON.stringify(surface.results[0].warnings))

  assert.deepEqual(
    violations.results[0].warnings.map(({ line, rule }) => [line, rule]),
    [
      // the alias declaration reads the primitive layer just as directly
      [9, "nagi-css/token-layer"],
      [11, "nagi-css/token-layer"],
      [13, "nagi-css/unknown-token"],
    ],
    JSON.stringify(violations.results[0].warnings),
  )
})

test("Stylelint leaves token references alone until a source is configured", async () => {
  const result = await lintStylelint(path.join(root, "fixtures/tokens/TokenViolations.vue"), {
    ...testSurface,
  })

  assert.equal(result.errored, false, JSON.stringify(result.results[0].warnings))
})

test("Stylelint requires a token for colors, with no configured source needed", async () => {
  const result = await lintStylelint(path.join(root, "fixtures/tokens/RawColors.vue"), {
    ...testSurface,
  })

  assert.deepEqual(
    result.results[0].warnings
      .filter(({ rule }) => rule === "nagi-css/value-token-required")
      .map(({ line, text }) => [line, text.match(/"([^"]+)"/)[1]]),
    [
      [9, "#f0a"], // a --local-* declaration is no escape for a color
      [12, "rgb(0 0 0 / 0.1)"],
      [13, "#333"], // a raw fallback is a raw color
      [17, "white"], // inside a gradient
    ],
    JSON.stringify(result.results[0].warnings),
  )
})

test("Stylelint requires a token for lengths on scale properties only", async () => {
  const result = await lintStylelint(path.join(root, "fixtures/tokens/RawLengths.vue"), {
    ...testSurface,
  })

  assert.deepEqual(
    result.results[0].warnings
      .filter(({ rule }) => rule === "nagi-css/length-token-required")
      .map(({ line, text }) => [line, text.match(/"([^"]+)"/)[1]]),
    [
      [13, "0.5rem"],
      [14, "1px"],
      [20, "1.125rem"],
    ],
    JSON.stringify(result.results[0].warnings),
  )
})

test("Stylelint returns a surface's stacking order to the parent, or to a token", async () => {
  const raw = await lintStylelint(path.join(root, "fixtures/layout/RawStacking.vue"), {})

  // A top-layer surface owns its own stacking order, so the value is checked
  // rather than rejected; layering its own children stays a local decision.
  assert.deepEqual(
    raw.results[0].warnings.map(({ line, rule }) => [line, rule]),
    [[10, "nagi-css/stacking-token-required"]],
    JSON.stringify(raw.results[0].warnings),
  )
})

test("Stylelint derives container names and keeps queries inside the file", async () => {
  const valid = await lintStylelint(path.join(root, "fixtures/style/ContainerSurface.vue"), {})
  const invalid = await lintStylelint(
    path.join(root, "fixtures/style/ContainerViolations.vue"),
    {},
  )

  assert.equal(valid.errored, false, JSON.stringify(valid.results[0].warnings))

  assert.deepEqual(
    invalid.results[0].warnings.map(({ line, rule, text }) => [
      line,
      rule,
      text.match(/"([^"]+)"/)[1],
    ]),
    [
      [9, "nagi-css/container-name-derived", "card"],
      [12, "nagi-css/container-name-derived", "media-box"],
      [14, "nagi-css/container-query-scope", "app-page-main"],
    ],
    JSON.stringify(invalid.results[0].warnings),
  )
})

test("Stylelint reports unused keyframes and cascade layers inside a surface", async () => {
  const result = await lintStylelint(path.join(root, "fixtures/style/MotionSurface.vue"), {})

  assert.deepEqual(
    result.results[0].warnings
      .filter(({ rule }) =>
        rule === "nagi-css/dead-keyframes" || rule === "nagi-css/cascade-layer-in-surface",
      )
      .map(({ line, rule }) => [line, rule]),
    [
      [16, "nagi-css/cascade-layer-in-surface"],
      [12, "nagi-css/dead-keyframes"],
    ],
    JSON.stringify(result.results[0].warnings),
  )
})
