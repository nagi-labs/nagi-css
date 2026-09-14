import assert from "node:assert/strict"
import test from "node:test"
import { analyzeComponent, defineNagiConfig } from "@nagi-labs/nagi-css-core"
import { buildDefinitionRegistry } from "../packages/core/src/definitions.mjs"
import schema from "../packages/core/src/role-definition.schema.json" with { type: "json" }

const definition = (description) => ({
  version: 1,
  scopes: { range: { roles: { fill: { required: true, ...description } } } },
})
const registry = (...roleDefinitions) => buildDefinitionRegistry(defineNagiConfig({ roleDefinitions }))

test("role descriptions are preserved without changing identity or requiring old definitions to add them", () => {
  const text = "The portion representing the selected value."
  const result = registry(definition({ description: text }))
  assert.deepEqual(result.errors, [])
  assert.equal(result.scopes.get("range").roles.get("fill").description, text)
  assert.equal(result.definitions.get("Custom:range/fill").canonicalName, "fill")
  assert.deepEqual(registry(definition({})).errors, [])
  assert.equal(registry(definition({})).scopes.get("range").roles.get("fill").description, null)
  assert.equal(schema.$defs.role.properties.description.type, "string")
  assert.ok(new RegExp(schema.$defs.role.properties.description.pattern).test(text))
})

test("empty or non-string descriptions are rejected", () => {
  for (const description of ["", " \n\t", null, false, 1, [], {}]) {
    assert.ok(registry(definition({ description })).errors.some((error) => error.includes("description must be a non-empty string")))
  }
  assert.equal(new RegExp(schema.$defs.role.properties.description.pattern).test(" \n\t"), false)
})

test("description conflicts cannot be resolved by source order", () => {
  const first = definition({ description: "The selected portion." })
  assert.deepEqual(registry(first, structuredClone(first)).errors, [])
  for (const second of [definition({}), definition({ description: "The remaining portion." })]) {
    for (const sources of [[first, second], [second, first]]) {
      assert.ok(registry(...sources).errors.some((error) => error.includes("Conflicting role definitions")))
    }
  }
})

test("Vue event-only bindings preserve scoped identity while attribute spreads remain unresolved", () => {
  const source = (binding) => `<template><div class="app-example" data-role="range/root"><span class="fill" data-role="range/fill" ${binding} /></div></template>`
  const config = { surfaceRootPrefixes: ["app-"], roleDefinitions: [definition({ description: "The selected portion." })] }
  const valid = analyzeComponent(source('v-on="events"'), "/example.vue", config)
  assert.deepEqual(valid.violations, [])
  assert.equal(valid.identities.nodes.find((node) => node.scopedRole === "range/fill").provider, "Custom")
  for (const binding of ['v-bind="attrs"', ':role="role"', 'v-bind:[name]="value"']) {
    const result = analyzeComponent(source(binding), "/example.vue", config)
    assert.ok(result.violations.some((entry) => entry.ruleId === "unverifiable-role-identity"))
  }
})

test("Vue resolves a literal role after a spread without trusting the reverse order", () => {
  const source = (attributes, base = "tablist") => `<template><div class="app-example"><div class="${base}" ${attributes} /></div></template>`
  const config = { surfaceRootPrefixes: ["app-"], emitPolicy: "always" }
  for (const binding of ['v-bind="attrs"', 'v-bind:[name]="value"']) {
    const resolved = analyzeComponent(source(`${binding} role="tablist"`), "/example.vue", config)
    assert.deepEqual(resolved.violations, [])
    assert.equal(resolved.identities.nodes[1].provider, "ARIA")
    const unknown = analyzeComponent(source(`role="tablist" ${binding}`), "/example.vue", config)
    assert.ok(unknown.violations.some((entry) => entry.ruleId === "unverifiable-role-identity"))
    const mismatch = analyzeComponent(source(`${binding} role="tablist"`, "unit"), "/example.vue", config)
    assert.ok(mismatch.violations.some((entry) => entry.ruleId === "role-identity-required"))
  }
})

test("a resolved Vue role satisfies a native scoped requirement but an overwritten role does not", () => {
  const config = { surfaceRootPrefixes: ["app-"], roleDefinitions: [{
    version: 1, scopes: { tabs: { roles: { tablist: { native: true, required: true } } } },
  }] }
  const analyze = (attributes) => analyzeComponent(`<template><div class="app-example" data-role="tabs/root"><div class="tablist" ${attributes} /></div></template>`, "/example.vue", config)
  assert.deepEqual(analyze('v-bind="attrs" role="tablist"').violations, [])
  assert.ok(analyze('role="tablist" v-bind="attrs"').violations.some((entry) => entry.ruleId === "required-role-missing"))
})
