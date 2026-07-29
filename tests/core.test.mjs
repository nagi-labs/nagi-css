import assert from "node:assert/strict"
import test from "node:test"

import {
  analyzeVueTemplate,
  deriveAllowedSurfaceRootNames,
  defineNagiConfig,
  deriveSurfaceRootName,
  matchSelectorChain,
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

test("row groups self-map and cells share one class, distinguished by ancestor", () => {
  const source = (theadClass) => `<template>
  <section class="price-table">
    <table class="table">
      <thead class="${theadClass}">
        <tr class="row"><th class="cell">Plan</th></tr>
      </thead>
      <tbody class="tbody">
        <tr class="row"><td class="cell">Free</td></tr>
      </tbody>
    </table>
  </section>
</template>
<style>.price-table { > .table { > .thead > .row > .cell {} > .tbody > .row > .cell {} } }</style>`

  const valid = analyzeVueTemplate(source("thead"), "/src/components/PriceTable.vue")
  assert.deepEqual(valid.violations, [])

  const legacy = analyzeVueTemplate(source("rowgroup -head"), "/src/components/PriceTable.vue")
  assert.ok(
    legacy.violations.some(
      ({ message, ruleId }) =>
        ruleId === "element-class-required" && message.includes('"thead"'),
    ),
  )
  // `rowgroup` is no longer an element-table value, so it is only available to a
  // div/span carrying the matching role.
  assert.ok(
    legacy.violations.some(
      ({ message, ruleId }) =>
        ruleId === "anatomy-allowed" && message.includes('"rowgroup"'),
    ),
  )
})

test("rejects a mapping that tries to fix a variant alongside its base", () => {
  assert.deepEqual(
    validateNagiConfig(
      defineNagiConfig({
        surfaceRootPrefixes: ["n-"],
        elementClasses: { thead: "rowgroup -head" },
      }),
    ),
    [
      'elementClasses.thead must be a single base class; received "rowgroup -head". ' +
        "A distinction a selector can reach belongs in an attribute or an ancestor step, " +
        "not a fixed variant",
    ],
  )
  assert.deepEqual(
    validateNagiConfig(
      defineNagiConfig({ surfaceRootPrefixes: ["n-"], elementClasses: { p: "-lead" } }),
    ),
    ['elementClasses.p must be a base class, not a variant; received "-lead"'],
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

test("uses unit as the STN floor without a legacy zone alias", () => {
  assert.deepEqual(defineNagiConfig().tiers, [
    "stratum",
    "region",
    "block",
    "unit",
    "seg",
    "fr",
    "g",
  ])

  const shallow = analyzeVueTemplate(
    `<template><section class="stn-surface"><div class="unit"><div class="seg" /></div></section></template>`,
    "/src/components/StnSurface.vue",
  )
  const deep = analyzeVueTemplate(
    `<template><section class="stn-surface"><div class="stratum"><div class="region"><div class="block"><div class="unit"><div class="seg"><div class="fr"><div class="g" /></div></div></div></div></div></div></section></template>`,
    "/src/components/StnSurface.vue",
  )
  const legacy = analyzeVueTemplate(
    `<template><section class="stn-surface"><div class="zone" /></section></template>`,
    "/src/components/StnSurface.vue",
  )

  assert.deepEqual(shallow.violations, [])
  assert.deepEqual(deep.violations, [])
  assert.equal(
    legacy.violations.some(({ ruleId }) => ruleId === "anatomy-allowed"),
    true,
  )
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
    `<template><section class="shadow-surface"><div class="unit -wrapper" /></section></template>`,
    "/src/components/ShadowSurface.vue",
  )
  const rendered = analyzeVueTemplate(
    `<template><section class="shadow-surface"><div class="unit -span" /></section></template>`,
    "/src/components/ShadowSurface.vue",
  )
  const dynamic = analyzeVueTemplate(
    `<template><section class="shadow-surface"><div class="unit" :class="{ '-title': fancy }" /></section></template>`,
    "/src/components/ShadowSurface.vue",
  )
  const state = analyzeVueTemplate(
    `<template><section class="shadow-surface"><div class="unit -active" /></section></template>`,
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

test("keeps a role-name identity on div/span that shares an element spelling", () => {
  for (const role of ["dialog", "menu", "table", "form", "figure", "main", "option"]) {
    const result = analyzeVueTemplate(
      `<template><section class="role-host"><div class="${role}" role="${role}">x</div></section></template>
<style>.role-host { > .${role} {} }</style>`,
      "/src/components/RoleHost.vue",
    )
    assert.deepEqual(result.violations, [], role)
    assert.equal(result.roleNames.has(role), true, role)
  }

  const mismatched = analyzeVueTemplate(
    `<template><section class="role-host"><div class="dialog">x</div></section></template>`,
    "/src/components/RoleHost.vue",
  )
  assert.equal(
    mismatched.violations.some(({ ruleId }) => ruleId === "reserved-element-name"),
    true,
  )
})

test("treats level-free wrappers as transparent so the surface root stays at the root", () => {
  const wrappers = [
    (inner) => `<Transition name="fade">${inner}</Transition>`,
    (inner) => `<TransitionGroup>${inner}</TransitionGroup>`,
    (inner) => `<KeepAlive>${inner}</KeepAlive>`,
    (inner) => `<Suspense>${inner}</Suspense>`,
    (inner) => `<template v-if="ready">${inner}</template>`,
  ]
  const surface = `<section class="fade-panel"><h2 class="title">Hi</h2></section>`

  for (const wrap of wrappers) {
    const result = analyzeVueTemplate(
      `<template>${wrap(surface)}</template><style>.fade-panel { > .title {} }</style>`,
      "/src/components/FadePanel.vue",
    )
    assert.deepEqual(result.violations, [], wrap(""))
    assert.deepEqual([...result.surfaceRoots], ["fade-panel"])
  }
})

test("a transparent wrapper does not add an STN tier", () => {
  const result = analyzeVueTemplate(
    `<template><section class="stn-host"><div class="unit"><Transition><div class="seg" /></Transition></div></section></template>`,
    "/src/components/StnHost.vue",
  )

  assert.deepEqual(result.violations, [])
})

test("derives page names without walking above the pages directory", () => {
  assert.equal(deriveSurfaceRootName("/src/pages/index.vue"), "index-page")
  assert.equal(deriveSurfaceRootName("/src/pages/[id].vue"), "id-page")
  assert.equal(deriveSurfaceRootName("/src/pages/reports/index.vue"), "reports-page")
  assert.equal(
    deriveSurfaceRootName("/src/pages/procedure/[key]/index.vue"),
    "procedure-page",
  )
})

test("reports malformed element mappings as configuration errors", () => {
  assert.deepEqual(
    validateNagiConfig(
      defineNagiConfig({ surfaceRootPrefixes: ["n-"], elementClasses: { p: null } }),
    ),
    ["elementClasses.p must be a non-empty string; received null"],
  )

  const analysis = analyzeVueTemplate(
    `<template><section class="broken-config"><p>x</p></section></template>`,
    "/src/components/BrokenConfig.vue",
    { elementClasses: { p: null } },
  )
  assert.ok(Array.isArray(analysis.violations))
})

test("reports unreadable style blocks", () => {
  const scss = analyzeVueTemplate(
    `<template><section class="scss-host" /></template><style lang="scss">.scss-host { .unit {} }</style>`,
    "/src/components/ScssHost.vue",
  )
  const external = analyzeVueTemplate(
    `<template><section class="src-host" /></template><style src="./SrcHost.css"></style>`,
    "/src/components/SrcHost.vue",
  )
  const plain = analyzeVueTemplate(
    `<template><section class="plain-host" /></template><style>.plain-host {}</style>`,
    "/src/components/PlainHost.vue",
  )

  assert.deepEqual(scss.styleBlocks, [{ kind: "lang", line: 1, value: "scss" }])
  assert.deepEqual(external.styleBlocks, [
    { kind: "src", line: 1, value: "./SrcHost.css" },
  ])
  assert.deepEqual(plain.styleBlocks, [])

  for (const result of [scss, external]) {
    assert.equal(
      result.violations.some(({ ruleId }) => ruleId === "unsupported-style-syntax"),
      true,
    )
  }
  assert.deepEqual(plain.violations, [])
})

test("checks a selector chain against the template it claims to mirror", () => {
  const tree = analyzeVueTemplate(
    `<template>
      <section class="mirror-host">
        <header class="header"><h2 class="title">Hi</h2></header>
        <ul class="list"><li class="item">a</li><li class="item">b</li></ul>
      </section>
    </template>`,
    "/src/components/MirrorHost.vue",
  ).tree

  // "> title" / "+ item" / "  title" (descendant)
  const chain = (...steps) =>
    steps.map((step, index) =>
      index === 0
        ? { classes: [step.trim()] }
        : {
            classes: [step.replace(/^[>+~]/, "").trim()],
            combinator: /^[>+~]/.test(step) ? step[0] : " ",
          },
    )

  assert.equal(matchSelectorChain(tree, chain("mirror-host", "> header", "> title")).status, "ok")
  assert.equal(matchSelectorChain(tree, chain("mirror-host", "> list", "> item")).status, "ok")
  assert.equal(matchSelectorChain(tree, chain("list", "> item", "+ item")).status, "ok")
  assert.equal(matchSelectorChain(tree, chain("mirror-host", "  title")).status, "ok")

  // title exists, but not as a direct child of the surface root
  assert.equal(
    matchSelectorChain(tree, chain("mirror-host", "> title")).status,
    "mismatch",
  )
  // nothing in the template carries these
  assert.deepEqual(matchSelectorChain(tree, chain("mirror-host", "> icon")), {
    missing: ["icon"],
    status: "dead",
  })
  assert.equal(
    matchSelectorChain(tree, chain("mirror-host", "> header", "> item", "> value")).status,
    "dead",
  )
})

test("gives up on chains the template cannot answer", () => {
  const opaque = analyzeVueTemplate(
    `<template><section class="opaque-host"><DataTable class="pv-data-table"><div class="unit" /></DataTable></section></template>`,
    "/src/components/OpaqueHost.vue",
    { componentClasses: ["DataTable"] },
  ).tree
  const dynamic = analyzeVueTemplate(
    `<template><section class="dynamic-host"><div class="unit" :class="extra" /></section></template>`,
    "/src/components/DynamicHost.vue",
  ).tree

  // below a component root the structure is not ours to know
  assert.equal(
    matchSelectorChain(opaque, [
      { classes: ["pv-data-table"] },
      { classes: ["seg"], combinator: ">" },
    ]).status,
    "unknown",
  )
  // a dynamic class could be supplying the name
  assert.equal(
    matchSelectorChain(dynamic, [
      { classes: ["dynamic-host"] },
      { classes: ["seg"], combinator: ">" },
    ]).status,
    "unknown",
  )
})

test("reports which classes sit on owned component roots", () => {
  const result = analyzeVueTemplate(
    `<template>
      <header class="boundary-host">
        <UserAvatar class="media" />
        <div class="unit" />
      </header>
    </template>
    <style>.boundary-host { > .media {} > .unit {} }</style>`,
    "/src/components/BoundaryHost.vue",
  )
  const ambiguous = analyzeVueTemplate(
    `<template><header class="boundary-host"><UserAvatar class="media" /><div class="media" /></header></template>`,
    "/src/components/BoundaryHost.vue",
  )

  assert.deepEqual([...result.componentRootClasses], ["media"])
  // the same class on a plain element makes it ambiguous, so it is not claimed
  assert.deepEqual([...ambiguous.componentRootClasses], [])
})

test("fixes every violation whose correct output the contract computes", () => {
  const fixed = (source, filename, config) => {
    const { violations } = analyzeVueTemplate(source, filename, config)
    let output = source
    for (const violation of [...violations].sort((a, b) => (b.fix?.range[0] ?? 0) - (a.fix?.range[0] ?? 0))) {
      if (!violation.fix) continue
      output =
        output.slice(0, violation.fix.range[0]) +
        violation.fix.text +
        output.slice(violation.fix.range[1])
    }
    return output
  }

  assert.match(
    fixed(
      `<template><section class="wrong-root" /></template><style>.n-right-root {}</style>`,
      "/src/components/RightRoot.vue",
      { surfaceRootPrefixes: ["n-"] },
    ),
    /class="n-right-root"/,
  )
  assert.match(
    fixed(
      `<template><section class="n-order-host"><div class="unit -z -a" /></section></template>`,
      "/src/components/OrderHost.vue",
      { surfaceRootPrefixes: ["n-"] },
    ),
    /class="unit -a -z"/,
  )
  assert.match(
    fixed(
      `<template><section class="n-stn-host"><div class="seg" /></section></template>`,
      "/src/components/StnHost.vue",
      { surfaceRootPrefixes: ["n-"] },
    ),
    /class="unit"/,
  )
  assert.match(
    fixed(
      `<template><section class="n-stn-host"><div class="unit"><div class="g" /></div></section></template>`,
      "/src/components/StnHost.vue",
      { surfaceRootPrefixes: ["n-"] },
    ),
    /class="seg"/,
  )
})
