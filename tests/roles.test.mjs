import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { ESLint } from "eslint"
import {
  analyzeComponent,
  analyzeTemplate,
  createRoleReport,
  defineNagiConfig,
  loadRoleDefinition,
  parseDefinitionJson,
  validateNagiConfig,
  resolveSeverity,
  ANATOMY_DEFINITIONS,
} from "@nagi-labs/nagi-css-core"
import { createNagiStandaloneEslintConfigs } from "@nagi-labs/eslint-plugin-nagi-css"

const range = {
  version: 1,
  scopes: {
    range: {
      roles: {
        track: { required: true },
        fill: { required: true },
        slider: { required: true, native: true },
      },
    },
    "date-picker": { roles: { trigger: {} }, purposes: { trigger: { role: { element: "button" } } } },
    tooltip: { roles: { content: {} } },
  },
}
const config = { surfaceRootPrefixes: ["app-"], roleDefinitions: [range], emitPolicy: "always" }
const validRoles =
  '<div class="track" data-role="range/track"><div class="fill" data-role="range/fill" /></div>' +
  '<div class="slider" role="slider" />'
const wrap = (body, attributes = 'data-role="range/root"') =>
  `<template><div class="app-example" ${attributes}>${body}</div></template>`
const analyze = (body, attributes, extra = {}) =>
  analyzeComponent(wrap(body, attributes), "/example.vue", { ...config, ...extra })
const ids = (result) => result.violations.map((entry) => entry.ruleId)

test("shared node resolution drives lint severity and measurement", async () => {
  const source = wrap(validRoles + '<span class="text" /><div class="unit" />')
  const result = analyzeComponent(source, "/example.vue", config)
  const report = createRoleReport([result])
  assert.deepEqual([report.P, report.D, report.U, report.T, report.N], [1, 3, 0, 1, 5])
  assert.equal(report.surfaces, 1)
  assert.equal(report.providers.Custom, 2)
  assert.equal(result.roles.nodes.find((node) => node.base === "slider").provider, "ARIA")
  const linter = new ESLint({
    overrideConfigFile: true,
    overrideConfig: createNagiStandaloneEslintConfigs(config),
  })
  const [lint] = await linter.lintText(source, { filePath: "example.vue" })
  assert.equal(lint.errorCount, 0)
  assert.equal(resolveSeverity({ "unregistered-semantic-role": "error" })("unregistered-semantic-role"), "error")
})

test("plain projects without scoped definitions retain unregistered and structural behavior", () => {
  const result = analyzeComponent(
    '<template><div class="app-example"><div class="popup" /><span class="text" /><div class="unit" /></div></template>',
    "/example.vue",
    { surfaceRootPrefixes: ["app-"], emitPolicy: "always" },
  )
  assert.ok(ids(result).includes("unregistered-semantic-role"))
  const report = createRoleReport([result])
  assert.deepEqual([report.D, report.U, report.T], [1, 1, 1])
})

test("a definition may contain multiple scopes", () => {
  assert.deepEqual(analyze(validRoles).violations, [])
  const datePicker = analyzeComponent(
    '<template><div class="app-example" data-role="date-picker/root"><button class="button -trigger" data-purpose="date-picker/trigger" /></div></template>',
    "/example.vue",
    config,
  )
  assert.deepEqual(datePicker.violations, [])
})

test("custom roles are explicit and derive residual base roles", () => {
  const valid = analyze(validRoles)
  assert.deepEqual(valid.violations, [])
  const fill = valid.roles.nodes.find((node) => node.scopedRole === "range/fill")
  assert.equal(fill.base, "fill")
  assert.equal(fill.classification, "defined")
  assert.equal(fill.provider, "Custom")
  assert.equal(fill.definition, "Custom:range/fill")

  for (const markup of [
    '<div class="unit" data-role="range/fill" />',
    '<div data-role="range/fill" />',
  ]) {
    assert.ok(ids(analyze(markup)).includes("scoped-role-base-required"))
  }
})

test("scope roots preserve surface and non-surface roles", () => {
  const surface = analyze(validRoles)
  assert.equal(surface.roles.nodes[0].base, "app-example")
  assert.equal(surface.roles.nodes[0].definition, null)

  const nested = analyzeComponent(
    `<template><div class="app-example"><section class="section" data-role="range/root">${validRoles}</section></div></template>`,
    "/example.vue",
    config,
  )
  assert.deepEqual(nested.violations, [])
  const root = nested.roles.nodes.find((node) => node.scopedRole === "range/root")
  assert.equal(root.base, "section")
  assert.equal(root.provider, "HTML")
})

test("root is reserved and cannot be declared manually", () => {
  const invalid = { version: 1, scopes: { range: { roles: { root: {} } } } }
  assert.ok(validateNagiConfig(defineNagiConfig({ ...config, roleDefinitions: [invalid] })).some((message) => message.includes("root is reserved")))
})

test("a scope and local role cannot have identical names", () => {
  const invalid = { version: 1, scopes: { range: { roles: { range: {} } } } }
  assert.ok(validateNagiConfig(defineNagiConfig({ ...config, roleDefinitions: [invalid] })).some((message) => message.includes("must not have the same name")))
  assert.ok(ids(analyze('<div class="range" data-role="range/range" />')).includes("scoped-role-context"))
})

test("unknown scopes and roles are rejected", () => {
  assert.ok(ids(analyze(validRoles, 'data-role="unknown/root"')).includes("unknown-role-scope"))
  assert.ok(ids(analyze('<div class="missing" data-role="range/missing" />')).includes("unknown-scoped-role"))
})

test("data-role grammar is strict", () => {
  for (const value of ["", "range", "/fill", "range/", "range/track/fill", "Range/fill", "range/fill value"]) {
    const result = analyze(validRoles, value ? `data-role="${value}"` : "data-role")
    assert.ok(ids(result).includes("scoped-role-syntax"), value)
  }
})

test("dynamic data-role is an error and never proves a required role", () => {
  const result = analyze('<div class="fill" :data-role="chosen" />')
  assert.ok(ids(result).includes("dynamic-scoped-role"))
  assert.ok(ids(result).includes("required-role-missing"))
})

test("generic attribute spreads do not invent dynamic data-role declarations", () => {
  for (const [filename, source] of [
    ["/example.vue", '<template><div class="app-example" v-bind="attrs" /></template>'],
    ["/example.svelte", '<div class="app-example" {...attrs}></div>'],
    ["/example.astro", '<div class="app-example" {...attrs}></div>'],
  ]) {
    const result = analyzeComponent(source, filename, config)
    assert.ok(!ids(result).includes("dynamic-scoped-role"), filename)
  }
})

test("required custom and native roles are checked per scope instance", () => {
  assert.deepEqual(analyze(validRoles).violations, [])
  const customMissing = analyze('<div class="track" data-role="range/track" /><div class="slider" role="slider" />')
  assert.ok(ids(customMissing).includes("required-role-missing"))
  assert.match(customMissing.violations.find((entry) => entry.ruleId === "required-role-missing").message, /range\/fill/u)
  const nativeMissing = analyze('<div class="track" data-role="range/track" /><div class="fill" data-role="range/fill" />')
  assert.ok(nativeMissing.violations.some((entry) => entry.ruleId === "required-role-missing" && entry.message.includes("range/slider")))

  const twoInstances = analyzeComponent(
    `<template><div class="app-example"><div class="unit" data-role="range/root">${validRoles}</div><div class="unit" data-role="range/root"></div></div></template>`,
    "/example.vue",
    config,
  )
  assert.equal(ids(twoInstances).filter((id) => id === "required-role-missing").length, 3)
})

test("native roles use standard semantics without redundant data-role", () => {
  const result = analyze(validRoles)
  assert.equal(result.roles.scopes[0].scope, "range")
  const slider = result.roles.nodes.find((node) => node.base === "slider")
  assert.equal(slider.provider, "ARIA")
  assert.equal(slider.semanticDefinition, "Custom:range/slider")
  assert.ok(result.roles.used.includes("Custom:range/slider"))

  const redundant = analyze(
    '<div class="track" data-role="range/track" /><div class="fill" data-role="range/fill" /><div class="slider" role="slider" data-role="range/slider" />',
  )
  assert.ok(ids(redundant).includes("redundant-scoped-role"))
})

test("native true requires an existing canonical standard role", () => {
  const invalid = { version: 1, scopes: { range: { roles: { imaginary: { native: true } } } } }
  assert.ok(validateNagiConfig(defineNagiConfig({ ...config, roleDefinitions: [invalid] })).some((message) => message.includes("no matching standard role")))
  const customTrack = { version: 1, scopes: { range: { roles: { track: {} } } } }
  assert.deepEqual(validateNagiConfig(defineNagiConfig({ ...config, roleDefinitions: [customTrack] })), [])
})

test("native includes canonical HTML roles as well as WAI-ARIA roles", () => {
  const definition = {
    version: 1,
    scopes: { form: { roles: { button: { required: true, native: true } } } },
  }
  const result = analyzeComponent(
    '<template><div class="app-example" data-role="form/root"><button class="button" /></div></template>',
    "/example.vue",
    { ...config, roleDefinitions: [definition] },
  )
  assert.deepEqual(result.violations, [])
  assert.equal(
    result.roles.nodes.find((node) => node.tag === "button").semanticDefinition,
    "Custom:form/button",
  )
})

test("semantic HTML keeps its base and rejects a competing custom scoped role", () => {
  const result = analyzeComponent(
    '<template><div class="app-example" data-role="date-picker/root"><button class="button" data-role="date-picker/trigger" /></div></template>',
    "/example.vue",
    config,
  )
  assert.ok(ids(result).includes("scoped-role-conflict"))
  const button = result.roles.nodes.find((node) => node.tag === "button")
  assert.equal(button.base, "button")
  assert.equal(button.provider, "HTML")
  assert.equal(button.semanticDefinition, "Custom:date-picker/trigger")
})

test("nested roots are hard boundaries and mismatched roles are errors", () => {
  const definition = {
    version: 1,
    scopes: {
      range: { roles: { fill: { required: true } } },
      tooltip: { roles: { content: { required: true } } },
    },
  }
  const source =
    '<template><div class="app-example" data-role="range/root">' +
    '<div class="unit" data-role="tooltip/root">' +
    '<div class="fill" data-role="range/fill" />' +
    '<div class="content" data-role="tooltip/content" />' +
    "</div></div></template>"
  const result = analyzeComponent(source, "/example.vue", { ...config, roleDefinitions: [definition] })
  assert.ok(ids(result).includes("scoped-role-context"))
  assert.ok(result.violations.some((entry) => entry.ruleId === "required-role-missing" && entry.message.includes("range/fill")))
  assert.ok(!result.violations.some((entry) => entry.ruleId === "required-role-missing" && entry.message.includes("tooltip/content")))
})

test("owned component boundaries may declare roles without exposing private DOM", () => {
  const definition = { version: 1, scopes: { range: { roles: { fill: { required: true } } } } }
  const declared = analyzeComponent(
    '<template><div class="app-example" data-role="range/root"><RangeFill data-role="range/fill" /></div></template>',
    "/example.vue",
    { ...config, roleDefinitions: [definition] },
  )
  assert.deepEqual(declared.violations, [])
  const boundary = declared.roles.nodes.find((node) => node.tag === "RangeFill")
  assert.equal(boundary.category, "boundary")
  assert.equal(boundary.semanticDefinition, "Custom:range/fill")

  const privateOnly = analyzeComponent(
    '<template><div class="app-example" data-role="range/root"><RangeFill><div class="fill" data-role="range/fill" /></RangeFill></div></template>',
    "/example.vue",
    { ...config, roleDefinitions: [definition] },
  )
  assert.ok(ids(privateOnly).includes("required-role-missing"))
  assert.ok(ids(privateOnly).includes("scoped-role-context"))
})

test("slots, relocated content, and dynamic HTML preserve required-role uncertainty", () => {
  const definition = { version: 1, scopes: { range: { roles: { fill: { required: true } } } } }
  for (const child of ["<slot />", '<div v-html="html" />', '<Teleport to="body"><div class="fill" data-role="range/fill" /></Teleport>']) {
    const result = analyzeComponent(
      `<template><div class="app-example" data-role="range/root">${child}</div></template>`,
      "/example.vue",
      { ...config, roleDefinitions: [definition] },
    )
    assert.ok(ids(result).includes("unverifiable-presence"), child)
    assert.ok(!ids(result).includes("required-role-missing"), child)
  }
})

test("scope roots on non-rendering constructs are rejected", () => {
  const result = analyzeComponent(
    `<template data-role="range/root">${validRoles}</template>`,
    "/example.vue",
    config,
  )
  assert.ok(ids(result).includes("scoped-role-context"))
})

test("conditional and repeated role declarations satisfy authored presence", () => {
  const result = analyze(
    '<div v-if="ready" class="track" data-role="range/track" />' +
      '<div v-for="item in items" class="fill" data-role="range/fill" />' +
      '<div class="slider" role="slider" />',
  )
  assert.deepEqual(result.violations, [])
  assert.equal(result.roles.nodes.find((node) => node.role === "fill").conditional, true)
})

test("definition loading validates schema shape, names, booleans, and duplicate JSON keys", async (context) => {
  assert.throws(() => parseDefinitionJson('{"scopes":{"range":{},"r\\u0061nge":{}}}'), /Duplicate JSON key/u)
  assert.throws(() => parseDefinitionJson('{"scopes":'), SyntaxError)
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nagi-definitions-"))
  context.after(() => fs.rm(dir, { force: true, recursive: true }))
  const file = path.join(dir, "scoped-roles.json")
  await fs.writeFile(file, JSON.stringify(range))
  assert.deepEqual(loadRoleDefinition(file), range)
  assert.deepEqual(analyze(validRoles, undefined, { roleDefinitions: [file] }).violations, [])

  for (const definitions of [
    [{ ...range, version: 2 }],
    [{ version: 1, scopes: { Range: { roles: {} } } }],
    [{ version: 1, scopes: { range: { roles: { "bad/name": {} } } } }],
    [{ version: 1, scopes: { range: { roles: { fill: { required: "yes" } } } } }],
    [{ version: 1, scopes: { range: { roles: { fill: { unknown: true } } } } }],
    [{ version: 1, scopes: { range: { roles: { unit: {} } } } }],
    [file + ".missing"],
  ]) {
    assert.ok(validateNagiConfig(defineNagiConfig({ ...config, roleDefinitions: definitions })).length > 0)
  }
})

test("definition composition deduplicates identical scopes and rejects conflicts", () => {
  const first = { version: 1, scopes: { notice: { roles: { message: { required: true } } } } }
  const reordered = { version: 1, scopes: { notice: { roles: { message: { native: false, required: true } } } } }
  assert.deepEqual(validateNagiConfig(defineNagiConfig({ ...config, roleDefinitions: [first, reordered] })), [])
  const conflict = { version: 1, scopes: { notice: { roles: { message: {} } } } }
  assert.ok(validateNagiConfig(defineNagiConfig({ ...config, roleDefinitions: [first, conflict] })).some((message) => message.includes("Conflicting role definitions")))
})

test("built-in anatomy remains shared canonical data", () => {
  for (const entry of ANATOMY_DEFINITIONS) {
    assert.ok(entry.description.trim() && entry.examples.length && entry.excludes.length)
  }
  const result = analyzeComponent(
    '<template><div class="app-example"><div class="popup" /></div></template>',
    "/example.vue",
    { ...config, roleDefinitions: [], anatomyClasses: ["popup"] },
  )
  assert.ok(ids(result).includes("deprecated-anatomy-config"))
})

test("required checks do not depend on emitPolicy", () => {
  const result = analyze(validRoles, undefined, { emitPolicy: "when-styled" })
  assert.deepEqual(result.violations, [])
  const missing = analyze("", undefined, { emitPolicy: "when-styled" })
  assert.ok(ids(missing).includes("required-role-missing"))
})

test("Vue Svelte and Astro share scoped-role semantics", async () => {
  const body = `<div class="app-example" data-role="range/root">${validRoles}</div>`
  for (const extension of ["vue", "svelte", "astro"]) {
    const source = extension === "vue" ? `<template>${body}</template>` : body
    const result = analyzeComponent(source, `/example.${extension}`, config)
    assert.deepEqual(result.violations, [], extension)
    const dynamic =
      extension === "vue"
        ? ':data-role="chosen"'
        : extension === "svelte"
          ? "data-role={chosen}"
          : "data-role={chosen}"
    const unknown = analyzeTemplate(
      source.replace('data-role="range/root"', dynamic),
      `/example.${extension}`,
      config,
    )
    assert.ok(ids(unknown).includes("dynamic-scoped-role"), extension)
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: createNagiStandaloneEslintConfigs(config),
    })
    const [lint] = await eslint.lintText(source, { filePath: `example.${extension}` })
    assert.equal(lint.errorCount, 0, extension)
  }
})

test("Nuxt component paths use the same Vue scoped-role analysis", async () => {
  const source = `<template><div class="app-example" data-role="range/root">${validRoles}</div></template>`
  const result = analyzeComponent(source, "/app/components/example.vue", config)
  assert.deepEqual(result.violations, [])
  const linter = new ESLint({
    overrideConfigFile: true,
    overrideConfig: createNagiStandaloneEslintConfigs(config),
  })
  const [lint] = await linter.lintText(source, { filePath: "app/components/example.vue" })
  assert.equal(lint.errorCount, 0)
})

test("the checked-in examples reproduce their documented measurement", async () => {
  const root = new URL("../examples/custom-roles/", import.meta.url)
  const exampleConfig = (await import(new URL("nagi.config.mjs", root))).default.semantic
  const results = await Promise.all(
    ["vue", "svelte", "astro"].map(async (extension) => {
      const file = new URL(`price-range.${extension}`, root)
      return analyzeComponent(await fs.readFile(file, "utf8"), file.pathname, exampleConfig)
    }),
  )
  for (const result of results) assert.deepEqual(result.violations, [])
  const report = createRoleReport(results)
  assert.equal(report.invalid + report.unknown + report.parseFailures, 0)
  for (const document of [new URL("README.md", root), new URL("../docs/index.html", import.meta.url)]) {
    const text = (await fs.readFile(document, "utf8")).replace(/\s+/gu, " ")
    assert.ok(text.includes(`P=${report.P}, D=${report.D}, U=${report.U}, T=${report.T}, N=${report.N}`), document.href)
  }
})
