import assert from "node:assert/strict"
import test from "node:test"
import { ESLint } from "eslint"
import { analyzeComponent, createRoleReport, defineNagiConfig, validateNagiConfig } from "@nagi-labs/nagi-css-core"
import { createNagiStandaloneEslintConfigs } from "@nagi-labs/eslint-plugin-nagi-css"

const definition = {
  version: 1,
  scopes: {
    carousel: {
      roles: { viewport: {}, fill: {} },
      purposes: {
        next: { declaration: "required", description: "Advances to the next item." },
        trigger: { on: { element: "button" } },
        select: { on: { aria: "button" } },
        position: { on: { aria: "slider" } },
        caption: { on: { aria: "heading" } },
        annotation: { on: { aria: "note" } },
        text: {},
      },
    },
    tooltip: { purposes: { dismiss: {} } },
  },
}
const config = { surfaceRootPrefixes: ["app-"], emitPolicy: "always", roleDefinitions: [definition] }
const wrap = (body) => `<div class="app-example" data-role="carousel/root">${body}</div>`
const analyze = (body, extra = {}) => analyzeComponent(`<template>${wrap(body)}</template>`, "/example.vue", { ...config, ...extra })
const rules = (result) => result.violations.map((item) => item.ruleId)
const next = '<button class="button -next" data-purpose="carousel/next" />'

test("purpose-only declarations keep native, built-in, custom and structural bases", () => {
  for (const markup of [
    next,
    '<a href="/next" class="link -next" data-purpose="carousel/next" />',
    '<div class="text -next" data-purpose="carousel/next" />',
    '<div class="unit -next" data-purpose="carousel/next" />',
    '<div class="fill -next" data-role="carousel/fill" data-purpose="carousel/next" />',
  ]) assert.deepEqual(analyze(markup).violations, [], markup)
})

test("roles alone require their base without a duplicate purpose variant", () => {
  assert.deepEqual(analyze(next + '<div class="viewport" data-role="carousel/viewport" />').violations, [])
  const invalid = analyze(next + '<button class="button" data-role="carousel/viewport" />')
  assert.ok(rules(invalid).includes("scoped-role-conflict"))
})

test("declared purposes do not become base roles when their names overlap built-in vocabulary", () => {
  assert.deepEqual(analyze(next + '<div class="unit -text" data-purpose="carousel/text" />').violations, [])
  assert.ok(rules(analyze(next + '<div class="unit -text" />')).includes("variant-shadows-vocabulary"))
})

test("element-constrained purposes require the actual HTML element", () => {
  assert.deepEqual(analyze(next + '<button class="button -trigger" data-purpose="carousel/trigger" />').violations, [])
  for (const markup of [
    '<a class="link -trigger" data-purpose="carousel/trigger" />',
    '<div role="button" class="button -trigger" data-purpose="carousel/trigger" />',
  ]) assert.ok(rules(analyze(next + markup)).includes("purpose-role-mismatch"))
})

test("ARIA constraints accept native semantics without changing existing HTML class names", () => {
  for (const markup of [
    '<button class="button -select" data-purpose="carousel/select" />',
    '<input type="submit" class="input -select" data-purpose="carousel/select" />',
    '<div role="button" class="button -select" data-purpose="carousel/select" />',
    '<input type="range" class="input -position" data-purpose="carousel/position" />',
    '<h2 class="title -caption" data-purpose="carousel/caption" />',
  ]) assert.deepEqual(analyze(next + markup).violations, [], markup)
  assert.ok(rules(analyze(next + '<small class="note -annotation" data-purpose="carousel/annotation" />')).includes("purpose-role-mismatch"))
  assert.ok(rules(analyze(next + '<button role="tab" class="button -select" data-purpose="carousel/select" />')).includes("purpose-role-mismatch"))
})

test("purpose variants are mandatory even without styles or emitPolicy always", () => {
  const result = analyze('<button data-purpose="carousel/next" />', { emitPolicy: "when-styled" })
  assert.ok(rules(result).includes("purpose-variant-required"))
  assert.ok(rules(result).includes("required-purpose-missing"))
})

test("purpose markers cannot replace role markers or establish scope roots", () => {
  for (const [markup, expected] of [
    ['<div class="fill" data-purpose="carousel/fill" />', "unknown-scoped-purpose"],
    ['<button class="button -next" data-role="carousel/next" />', "unknown-scoped-role"],
    ['<div class="unit" data-purpose="carousel/root" />', "scoped-purpose-syntax"],
  ]) assert.ok(rules(analyze(markup)).includes(expected))
})

test("purpose grammar and names are strict", () => {
  for (const value of ["", "carousel", "/next", "carousel/", "carousel/next/other", "Carousel/next", "carousel/next other"]) {
    assert.ok(rules(analyze(`<button class="button -next" data-purpose="${value}" />`)).includes("scoped-purpose-syntax"), value)
  }
  assert.ok(rules(analyze('<button class="button -next" data-purpose="unknown/next" />')).includes("unknown-scoped-purpose"))
})

test("nested scopes and private child DOM cannot satisfy parent purposes", () => {
  for (const body of [
    `<div class="unit" data-role="tooltip/root">${next}</div>`,
    `<Child>${next}</Child>`,
  ]) {
    const result = analyze(body)
    assert.ok(rules(result).includes("scoped-purpose-context"))
    assert.ok(rules(result).includes("required-purpose-missing"))
  }
  assert.deepEqual(analyze('<Child class="-next" data-purpose="carousel/next" />').violations, [])
  assert.ok(rules(analyze(next + '<Child class="-trigger" data-purpose="carousel/trigger" />')).includes("unverifiable-purpose-role"))
})

test("non-rendering declarations are rejected and slots preserve absence uncertainty", () => {
  for (const tag of ["template", "slot"]) {
    assert.ok(rules(analyze(`<${tag} data-purpose="carousel/next" />`)).includes("scoped-purpose-context"))
  }
  assert.ok(rules(analyze('<slot />')).includes("unverifiable-presence"))
})

test("conditional and repeated purposes count declarations, not runtime presence", () => {
  for (const condition of ['v-if="ready"', 'v-for="item in items"']) {
    assert.deepEqual(analyze(next.replace('<button', `<button ${condition}`)).violations, [])
  }
})

test("purpose constraints and composition are validated without source-order dependence", () => {
  const validate = (defs) => validateNagiConfig(defineNagiConfig({ ...config, roleDefinitions: defs }))
  assert.deepEqual(validate([definition, structuredClone(definition)]), [])
  const conflict = structuredClone(definition)
  conflict.scopes.carousel.purposes.next.on = { element: "button" }
  for (const defs of [[definition, conflict], [conflict, definition]]) assert.ok(validate(defs).some((message) => message.includes("Conflicting")))
  for (const purpose of [
    { on: {} }, { on: "button" }, { on: { element: "button", aria: "button" } },
    { on: { element: "imaginary" } }, { on: { aria: "imaginary" } }, { on: { aria: "generic" } },
    { required: "true" }, { description: " " }, { unknown: true },
  ]) assert.ok(validate([{ version: 1, scopes: { carousel: { purposes: { next: purpose } } } }]).length, JSON.stringify(purpose))
})

test("measurement retains purpose evidence without counting it as a base role", () => {
  const result = analyze(next)
  const report = createRoleReport([result])
  assert.equal(report.P, 1)
  assert.equal(report.D, 0)
  assert.equal(result.roles.nodes[1].scopedPurpose, "carousel/next")
  assert.ok(result.roles.nodes[1].purposeDefinition)
  assert.equal(result.roles.nodes[0].constraints[0].status, "declared")
})

test("Vue Nuxt Svelte Astro and ESLint share purpose validation", async () => {
  for (const file of ["/example.vue", "/components/example.vue", "/example.svelte", "/example.astro"]) {
    const source = file.endsWith("vue") ? `<template>${wrap(next)}</template>` : wrap(next)
    assert.deepEqual(analyzeComponent(source, file, config).violations, [], file)
    const dynamic = file.endsWith("vue") ? ':data-purpose="chosen"' : 'data-purpose={chosen}'
    const result = analyzeComponent(source.replace('data-purpose="carousel/next"', dynamic), file, config)
    assert.ok(rules(result).includes("dynamic-scoped-purpose"), file)
    assert.ok(rules(result).includes("required-purpose-missing"), file)
    const lint = new ESLint({ overrideConfigFile: true, overrideConfig: createNagiStandaloneEslintConfigs(config) })
    assert.equal((await lint.lintText(source, { filePath: file.slice(1) }))[0].errorCount, 0)
  }
})

test("dynamic ARIA constraints remain unverifiable rather than being inferred from CSS", () => {
  const result = analyze(next + '<button class="button -select" :role="kind" data-purpose="carousel/select" />')
  assert.ok(rules(result).includes("unverifiable-purpose-role"))
})

test("on and its legacy role alias normalize identically without changing analysis", () => {
  const legacy = structuredClone(definition)
  for (const purpose of Object.values(legacy.scopes.carousel.purposes)) {
    if (purpose.on) { purpose.role = purpose.on; delete purpose.on }
  }
  const validate = (defs) => validateNagiConfig(defineNagiConfig({ ...config, roleDefinitions: defs }))
  for (const defs of [[definition, legacy], [legacy, definition]]) assert.deepEqual(validate(defs), [])
  for (const file of ["/example.vue", "/components/example.vue", "/example.svelte", "/example.astro"]) {
    for (const node of [
      '<button class="button -trigger" data-purpose="carousel/trigger" />',
      '<div class="button -trigger" role="button" data-purpose="carousel/trigger" />',
      '<input class="input -select" type="submit" data-purpose="carousel/select" />',
      '<button class="button -select" :role="kind" data-purpose="carousel/select" />',
    ]) {
      const source = file.endsWith("vue") ? `<template>${wrap(next + node)}</template>` : wrap(next + node)
      const current = analyzeComponent(source, file, config)
      const previous = analyzeComponent(source, file, { ...config, roleDefinitions: [legacy] })
      assert.deepEqual(current, previous, file)
    }
  }
})

test("on rejects invalid values and mixing both spellings without silently ignoring a constraint", () => {
  const validate = (purpose) => validateNagiConfig(defineNagiConfig({ ...config, roleDefinitions: [
    { version: 1, scopes: { carousel: { purposes: { trigger: purpose } } } },
  ] }))
  for (const on of [null, false, [], {}, "button", { other: "button" }, { element: "button", aria: "button" }, { aria: "none" }]) {
    assert.ok(validate({ on }).some((message) => message.includes(".on")), JSON.stringify(on))
  }
  for (const role of [{ element: "button" }, { aria: "button" }, null]) {
    assert.ok(validate({ on: { element: "button" }, role }).some((message) => message.includes("both on")))
  }
  assert.ok(validate({ role: { element: "imaginary" } }).some((message) => message.includes(".role.element")))
})

test("on preserves metadata defaults and required constrained declarations", () => {
  const constrained = structuredClone(definition)
  constrained.scopes.carousel.purposes.trigger = {
    on: { element: "button" }, layer: "contract", declaration: "required",
  }
  const options = { ...config, roleDefinitions: [constrained] }
  const valid = analyzeComponent(`<template>${wrap(next + '<button class="button -trigger" data-purpose="carousel/trigger" />')}</template>`, "/example.vue", options)
  assert.deepEqual(valid.violations, [])
  const record = valid.roles.registry.find((entry) => entry.provider === "Purpose" && entry.canonicalName === "trigger")
  assert.equal(record.layer, "contract")
  assert.equal(record.declaration, "required")
  assert.deepEqual(record.role, { element: "button" })
  const missing = analyzeComponent(`<template>${wrap(next)}</template>`, "/example.vue", options)
  assert.ok(rules(missing).includes("required-purpose-missing"))
})
