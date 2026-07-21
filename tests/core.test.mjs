import assert from "node:assert/strict"
import test from "node:test"

import {
  analyzeVueTemplate,
  deriveAllowedSurfaceRootNames,
  defineNagiConfig,
  deriveSurfaceRootName,
  validateNagiConfig,
} from "@nagi-labs/nagi-css-core"

test("derives UI library classes with the default pv prefix", () => {
  const shorthand = defineNagiConfig({
    componentClasses: ["DataTable", "PvDialog"],
  })
  const mixed = defineNagiConfig({
    componentClassPrefix: "ui-",
    componentClasses: { Column: null, DataTable: "table-boundary" },
  })

  assert.deepEqual(shorthand.componentClasses, {
    DataTable: "pv-data-table",
    PvDialog: "pv-dialog",
  })
  assert.deepEqual(mixed.componentClasses, {
    Column: "ui-column",
    DataTable: "table-boundary",
  })
})

test("requires an automatically derived UI library class", () => {
  const missing = analyzeVueTemplate(
    `<template><section class="table-host"><DataTable /></section></template><style>.table-host { > .pv-data-table {} }</style>`,
    "/src/components/TableHost.vue",
    { componentClasses: ["DataTable"] },
  )
  const present = analyzeVueTemplate(
    `<template><section class="table-host"><DataTable class="pv-data-table" /></section></template><style>.table-host { > .pv-data-table {} }</style>`,
    "/src/components/TableHost.vue",
    { componentClasses: ["DataTable"] },
  )

  assert.equal(
    missing.violations.some(({ ruleId }) => ruleId === "component-class-required"),
    true,
  )
  assert.deepEqual(present.violations, [])
})

test("table mappings fix a variant alongside the base class", () => {
  const source = (theadClass) => `<template>
  <section class="price-table">
    <table class="table">
      <thead class="${theadClass}">
        <tr class="row"><th class="cell -head">Plan</th></tr>
      </thead>
      <tbody class="rowgroup">
        <tr class="row"><td class="cell">Free</td></tr>
      </tbody>
    </table>
  </section>
</template>
<style>.price-table { > .table { > .rowgroup.-head > .row > .cell {} > .rowgroup > .row > .cell {} } }</style>`

  const valid = analyzeVueTemplate(source("rowgroup -head"), "/src/components/PriceTable.vue")
  assert.deepEqual(valid.violations, [])

  const partial = analyzeVueTemplate(source("rowgroup"), "/src/components/PriceTable.vue")
  assert.ok(
    partial.violations.some(
      ({ message, ruleId }) =>
        ruleId === "element-class-required" && message.includes('"rowgroup -head"'),
    ),
  )
})

test("reserves body for the body element", () => {
  const valid = analyzeVueTemplate(
    `<template><body class="body" /></template>`,
    "/src/App.vue",
  )
  const invalidDiv = analyzeVueTemplate(
    `<template><section class="invalid-body"><div class="body" /></section></template>`,
    "/src/components/InvalidBody.vue",
  )
  const invalidSpan = analyzeVueTemplate(
    `<template><section class="invalid-body"><span class="body" /></section></template>`,
    "/src/components/InvalidBody.vue",
  )

  assert.deepEqual(valid.violations, [])
  for (const result of [invalidDiv, invalidSpan]) {
    assert.equal(
      result.violations.some(({ ruleId }) => ruleId === "reserved-element-name"),
      true,
    )
  }
})

test("accepts deliberate title and link element mappings", () => {
  const source = `<template><section class="mapped-elements"><h2 class="title" /><a class="link" /></section></template>`
  const result = analyzeVueTemplate(source, "/src/components/MappedElements.vue")

  assert.deepEqual(result.violations, [])
})

test("does not grant a blanket document-only name exemption", () => {
  for (const name of ["html", "head", "base", "meta", "style"]) {
    const source = `<template><section class="invalid-name"><div class="${name}" /></section></template>`
    const result = analyzeVueTemplate(source, "/src/components/InvalidName.vue")
    assert.equal(
      result.violations.some(({ ruleId }) => ruleId === "anatomy-allowed"),
      true,
      name,
    )
  }
})

test("validates component-owned slot surface prefixes", () => {
  const valid = defineNagiConfig({
    surfaceRootPrefixes: ["test-"],
    componentClasses: { Card: "ui-card" },
    componentSlots: { Card: { content: "ui-card-content" } },
  })
  const invalid = defineNagiConfig({
    surfaceRootPrefixes: ["test-"],
    componentClasses: { Card: "ui-card" },
    componentSlots: { Card: { content: "content" } },
  })

  assert.deepEqual(validateNagiConfig(valid), [])
  assert.deepEqual(validateNagiConfig(invalid), [
    'componentSlots.Card.content must start with "ui-card-"; received "content"',
  ])
})

test("derives component and routed page surface names", () => {
  assert.equal(deriveSurfaceRootName("/src/components/UserMenu.vue"), "user-menu")
  assert.equal(deriveSurfaceRootName("/src/pages/reports/index.vue"), "reports-page")
  assert.equal(deriveSurfaceRootName("/src/pages/users/[id].vue"), "users-page")
})

test("derives exact prefixed surface names and requires a configured prefix", () => {
  assert.deepEqual(
    deriveAllowedSurfaceRootNames("/src/components/Toggle.vue", ["n-", "app-"]),
    ["n-toggle", "app-toggle"],
  )

  for (const root of ["n-toggle", "app-toggle"]) {
    const result = analyzeVueTemplate(
      `<template><button class="${root}">Toggle</button></template><style>.${root} {}</style>`,
      "/src/components/Toggle.vue",
      { surfaceRootPrefixes: ["n-", "app-"] },
    )
    assert.deepEqual(result.violations, [])
    assert.deepEqual([...result.surfaceRoots], [root])
  }

  for (const root of ["toggle", "n-control"]) {
    const result = analyzeVueTemplate(
      `<template><button class="${root}">Toggle</button></template><style>.${root} {}</style>`,
      "/src/components/Toggle.vue",
      { surfaceRootPrefixes: ["n-"] },
    )
    assert.equal(
      result.violations.some(({ ruleId }) => ruleId === "surface-root-name"),
      true,
      root,
    )
  }
})

test("prefix enforcement recognizes filename roots that overlap element vocabulary", () => {
  const valid = analyzeVueTemplate(
    `<template><button class="n-button">Save</button></template><style>.n-button {}</style>`,
    "/src/components/Button.vue",
    { surfaceRootPrefixes: ["n-"] },
  )
  const missingPrefix = analyzeVueTemplate(
    `<template><button class="button">Save</button></template><style>.button {}</style>`,
    "/src/components/Button.vue",
    { surfaceRootPrefixes: ["n-"] },
  )

  assert.deepEqual(valid.violations, [])
  assert.deepEqual([...valid.surfaceRoots], ["n-button"])
  assert.equal(
    missingPrefix.violations.some(({ ruleId }) => ruleId === "surface-root-name"),
    true,
  )
})

test("validates surface root prefix configuration", () => {
  assert.deepEqual(
    validateNagiConfig(defineNagiConfig({ surfaceRootPrefixes: ["n-", "app-ui-"] })),
    [],
  )
  assert.deepEqual(
    validateNagiConfig(defineNagiConfig()),
    ["surfaceRootPrefixes must contain at least one prefix"],
  )
  assert.deepEqual(
    validateNagiConfig(defineNagiConfig({ surfaceRootPrefixes: [] })),
    ["surfaceRootPrefixes must contain at least one prefix"],
  )
  assert.deepEqual(
    validateNagiConfig(defineNagiConfig({ surfaceRootPrefixes: "n-" })),
    ["surfaceRootPrefixes must be an array"],
  )
  assert.deepEqual(
    validateNagiConfig(defineNagiConfig({ surfaceRootPrefixes: ["N-", "n"] })),
    [
      'surfaceRootPrefixes entries must be lowercase kebab prefixes ending in "-"; received "N-"',
      'surfaceRootPrefixes entries must be lowercase kebab prefixes ending in "-"; received "n"',
    ],
  )
})

test("template analysis covers every semantic template rule", () => {
  const source = `
<script setup>defineProps({ open: Boolean, kind: String })</script>
<template>
  <section class="wrong-root">
    <button class="-z -a" :class="{ 'is-open': open }">Save</button>
    <Widget />
    <div class="wrapper" />
    <div class="mystery" />
    <div class="button" />
    <div class="seg" />
    <div class="block"><div class="fr" /></div>
  </section>
</template>
<style>
.bad-surface { > .button {} > .ui-widget {} }
</style>`
  const result = analyzeVueTemplate(source, "/src/components/BadSurface.vue", {
    componentClasses: { Widget: "ui-widget" },
    emitPolicy: "when-styled",
  })
  const ids = new Set(result.violations.map(({ ruleId }) => ruleId))

  assert.deepEqual(
    [...ids].sort(),
    [
      "anatomy-allowed",
      "component-class-required",
      "dynamic-class-requires-static-anchor",
      "element-class-required",
      "reserved-element-name",
      "state-not-class",
      "surface-root-name",
      "stn-floor",
      "stn-order",
      "stn-reach-g",
      "variant-order",
      "variant-shadows-vocabulary",
    ].sort(),
  )
})

test("when-styled emits only referenced classes while always emits every mapping", () => {
  const source = `
<template><section class="policy-surface"><button>Save</button></section></template>
<style>.policy-surface { color: black; }</style>`
  const whenStyled = analyzeVueTemplate(
    source,
    "/src/components/PolicySurface.vue",
    { emitPolicy: "when-styled" },
  )
  const always = analyzeVueTemplate(source, "/src/components/PolicySurface.vue", {
    emitPolicy: "always",
  })

  assert.equal(
    whenStyled.violations.some(({ ruleId }) => ruleId === "element-class-required"),
    false,
  )
  assert.equal(
    always.violations.some(({ ruleId }) => ruleId === "element-class-required"),
    true,
  )
})

test("does not descend into SVG and MathML internals", () => {
  const source = `
<template>
  <section class="foreign-surface">
    <svg class="svg"><a><path /></a></svg>
    <math><mrow><a /></mrow></math>
  </section>
</template>
<style>.foreign-surface { > .svg {} }</style>`
  const result = analyzeVueTemplate(source, "/src/components/ForeignSurface.vue")
  assert.deepEqual(result.violations, [])
})

test("accepts an anatomy name backed by a matching static role", () => {
  const source = `
<template><section class="role-surface"><div class="toolbar" role="toolbar" /></section></template>
<style>.role-surface { > .toolbar {} }</style>`
  const result = analyzeVueTemplate(source, "/src/components/RoleSurface.vue")

  assert.deepEqual(result.violations, [])
  assert.deepEqual([...result.roleNames], ["toolbar"])
})

test("keeps element-table identity ahead of additional ARIA semantics", () => {
  const valid = analyzeVueTemplate(
    `<template><section class="separator-list"><ul class="list"><li class="item" role="separator" /></ul><div class="separator" role="separator" /></section></template>
<style>.separator-list { > .list { > .item[role="separator"] {} } > .separator {} }</style>`,
    "/src/components/SeparatorList.vue",
  )
  const roleInsteadOfElement = analyzeVueTemplate(
    `<template><section class="separator-list"><li class="separator" role="separator" /></section></template>
<style>.separator-list { > .separator {} }</style>`,
    "/src/components/SeparatorList.vue",
  )
  const multipleBases = analyzeVueTemplate(
    `<template><section class="separator-list"><li class="item separator" role="separator" /></section></template>`,
    "/src/components/SeparatorList.vue",
  )
  const roleVariant = analyzeVueTemplate(
    `<template><section class="separator-list"><li class="item -separator" role="separator" /></section></template>`,
    "/src/components/SeparatorList.vue",
  )
  const mappedRoleVariant = analyzeVueTemplate(
    `<template><section class="separator-list"><li class="item -separator" role="separator" /></section></template>`,
    "/src/components/SeparatorList.vue",
    { elementClasses: { li: "item -separator" } },
  )

  assert.deepEqual(valid.violations, [])
  assert.deepEqual([...valid.roleNames], ["separator"])
  assert.equal(
    roleInsteadOfElement.violations.some(
      ({ ruleId }) => ruleId === "element-class-required",
    ),
    true,
  )
  assert.equal(
    roleInsteadOfElement.violations.some(({ ruleId }) => ruleId === "anatomy-allowed"),
    true,
  )
  assert.deepEqual([...roleInsteadOfElement.roleNames], [])
  assert.equal(
    multipleBases.violations.some(({ ruleId }) => ruleId === "single-base-identity"),
    true,
  )
  assert.equal(
    roleVariant.violations.some(
      ({ ruleId }) => ruleId === "variant-shadows-vocabulary",
    ),
    true,
  )
  assert.equal(
    mappedRoleVariant.violations.some(
      ({ ruleId }) => ruleId === "variant-shadows-vocabulary",
    ),
    true,
  )
})

test("rejects variants that shadow vocabulary names", () => {
  const shadowed = analyzeVueTemplate(
    `<template><section class="shadow-surface"><p class="text -title">x</p></section></template>
<style>.shadow-surface { > .text {} }</style>`,
    "/src/components/ShadowSurface.vue",
  )
  const modifier = analyzeVueTemplate(
    `<template><section class="shadow-surface"><p class="text -lead">x</p></section></template>
<style>.shadow-surface { > .text {} }</style>`,
    "/src/components/ShadowSurface.vue",
  )

  assert.equal(
    shadowed.violations.some(({ ruleId }) => ruleId === "variant-shadows-vocabulary"),
    true,
  )
  assert.deepEqual(modifier.violations, [])
})

test("variant shadow check covers banned names, rendered elements, and dynamic literals", () => {
  const banned = analyzeVueTemplate(
    `<template><section class="shadow-surface"><div class="zone -wrapper" /></section></template>`,
    "/src/components/ShadowSurface.vue",
  )
  const rendered = analyzeVueTemplate(
    `<template><section class="shadow-surface"><div class="zone -span" /></section></template>`,
    "/src/components/ShadowSurface.vue",
  )
  const dynamic = analyzeVueTemplate(
    `<template><section class="shadow-surface"><div class="zone" :class="{ '-title': fancy }" /></section></template>`,
    "/src/components/ShadowSurface.vue",
  )
  const state = analyzeVueTemplate(
    `<template><section class="shadow-surface"><div class="zone -active" /></section></template>`,
    "/src/components/ShadowSurface.vue",
  )

  for (const result of [banned, rendered, dynamic]) {
    assert.equal(
      result.violations.some(({ ruleId }) => ruleId === "variant-shadows-vocabulary"),
      true,
    )
  }
  assert.equal(
    state.violations.some(({ ruleId }) => ruleId === "state-not-class"),
    true,
  )
  assert.equal(
    state.violations.some(({ ruleId }) => ruleId === "variant-shadows-vocabulary"),
    false,
  )
})
