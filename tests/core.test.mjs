import assert from "node:assert/strict"
import test from "node:test"

import {
  analyzeTemplate,
  analyzeVueTemplate,
  deriveAllowedSurfaceRootNames,
  defineNagiConfig,
  deriveSurfaceRootName,
  matchSelectorChain,
  parseTokenDeclarations,
  rawColorLiterals,
  rawLengthLiterals,
  resolveSeverity,
  tokenFamilyFor,
  tokenReferences,
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

test("defaults declaration authoring to plain CSS and validates explicit backends", () => {
  assert.equal(defineNagiConfig().declarationMode, "plain")
  assert.equal(
    defineNagiConfig({ declarationMode: "tailwind-apply" }).declarationMode,
    "tailwind-apply",
  )
  assert.deepEqual(
    validateNagiConfig(
      defineNagiConfig({
        declarationMode: "utilities",
        surfaceRootPrefixes: ["app-"],
      }),
    ),
    ['declarationMode must be "plain" or "tailwind-apply"'],
  )
})

test("maps intrinsic render proxies and transparent control components onto owned DOM", () => {
  const result = analyzeVueTemplate(
    `<template>
  <section class="n-motion-card">
    <AnimatePresence>
      <motion.article class="article">
        <p class="p">Ready</p>
      </motion.article>
      <motion.div class="status" role="status">
        <motion.span class="text">Synced</motion.span>
      </motion.div>
    </AnimatePresence>
  </section>
</template>
<style>
.n-motion-card {
  > .article {
    > .p {}
  }
  > .status {
    > .text {}
  }
}
</style>`,
    "/src/components/MotionCard.vue",
    {
      intrinsicComponents: {
        "motion.article": "article",
        "motion.div": "div",
        "motion.span": "span",
      },
      surfaceRootPrefixes: ["n-"],
      transparentComponents: ["AnimatePresence"],
    },
  )

  assert.deepEqual(result.violations, [])
  assert.equal(result.tree[0].children[0].tag, "article")
  assert.equal(Boolean(result.tree[0].children[0].opaque), false)
  assert.equal(result.tree[0].children[1].tag, "div")
  assert.equal(result.tree[0].children[1].children[0].tag, "span")
  assert.deepEqual(
    validateNagiConfig(
      defineNagiConfig({
        intrinsicComponents: { "motion.div": "div", "motion.span": "span" },
        surfaceRootPrefixes: ["n-"],
      }),
    ),
    [],
  )
})

test("validates intrinsic and transparent component mappings", () => {
  assert.deepEqual(
    validateNagiConfig(
      defineNagiConfig({
        intrinsicComponents: { MotionBox: "box" },
        surfaceRootPrefixes: ["n-"],
        transparentComponents: [""],
      }),
    ),
    [
      'intrinsicComponents.MotionBox must map to a rendered HTML element; received "box"',
      "transparentComponents entries must be non-empty component names",
    ],
  )
})

test("keeps initialisms as one kebab-case word in derived surface names", () => {
  assert.equal(deriveSurfaceRootName("/src/components/OTPField.vue"), "otp-field")
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
    `<template><section class="shadow-surface"><p class="p -title">x</p></section></template>
<style>.shadow-surface { > .p {} }</style>`,
    "/src/components/ShadowSurface.vue",
  )
  const modifier = analyzeVueTemplate(
    `<template><section class="shadow-surface"><p class="p -lead">x</p><p class="p -support">y</p></section></template>
<style>.shadow-surface { > .p {} }</style>`,
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

test("keeps Element Class Table identities on their owning tags", () => {
  const spanText = analyzeVueTemplate(
    `<template><section class="text-host"><span class="text">Label</span></section></template>
<style>.text-host { > .text {} }</style>`,
    "/src/components/TextHost.vue",
  )
  const spanTitle = analyzeVueTemplate(
    `<template><section class="text-host"><span class="title">Label</span></section></template>
<style>.text-host { > .title {} }</style>`,
    "/src/components/TextHost.vue",
  )
  const paragraphText = analyzeVueTemplate(
    `<template><section class="text-host"><p class="text">Paragraph</p></section></template>
<style>.text-host { > .text {} }</style>`,
    "/src/components/TextHost.vue",
  )

  assert.deepEqual(spanText.violations, [])
  assert.equal(
    spanTitle.violations.some(({ ruleId }) => ruleId === "reserved-element-name"),
    true,
  )
  assert.equal(
    paragraphText.violations.some(({ ruleId }) => ruleId === "anatomy-allowed"),
    true,
  )
  assert.equal(
    paragraphText.violations.some(({ ruleId }) => ruleId === "element-class-required"),
    true,
  )
})

test("requires an identifying ARIA role before anatomy or STN on div and span", () => {
  const stnFallback = analyzeVueTemplate(
    `<template><section class="role-host"><div class="unit -fields" role="group" /></section></template>`,
    "/src/components/RoleHost.vue",
  )
  const anatomyFallback = analyzeVueTemplate(
    `<template><section class="role-host"><span class="field" role="status" /></section></template>`,
    "/src/components/RoleHost.vue",
  )

  for (const result of [stnFallback, anatomyFallback]) {
    assert.equal(
      result.violations.some(({ ruleId }) => ruleId === "role-identity-required"),
      true,
    )
  }
  assert.equal(
    stnFallback.violations.find(({ ruleId }) => ruleId === "role-identity-required")
      ?.fix?.text,
    '"group -fields"',
  )

  for (const source of [
    `<template><section class="role-host"><div class="group" role="group" /></section></template>`,
    `<template><section class="role-host"><div class="region" role="region" /></section></template>`,
    `<template><section class="role-host"><div class="unit" role="presentation" /></section></template>`,
    `<template><section class="role-host"><li class="item" role="separator" /></section></template>`,
    `<template><div class="role-host" role="group" /></template>`,
  ]) {
    const result = analyzeVueTemplate(source, "/src/components/RoleHost.vue")
    assert.deepEqual(result.violations, [], source)
  }
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

test("derives an owned child component's surface root from its tag", () => {
  const config = { surfaceRootPrefixes: ["app-"], componentClasses: ["DataTable"] }
  const result = analyzeVueTemplate(
    `<template>
      <header class="app-boundary-host">
        <UserAvatar />
        <NavSidebar />
        <DataTable class="pv-data-table" />
      </header>
    </template>
    <style>.app-boundary-host { > .app-user-avatar {} > .app-nav-sidebar {} > .pv-data-table {} }</style>`,
    "/src/components/BoundaryHost.vue",
    config,
  )

  // a configured library root keeps its own boundary class and is not derived
  assert.deepEqual([...result.childSurfaceRoots], ["app-user-avatar", "app-nav-sidebar"])
  assert.deepEqual(result.violations, [])
})

test("rejects a class passed to an owned child component, and removes it", () => {
  const config = { surfaceRootPrefixes: ["app-"] }
  const source = `<template><header class="app-boundary-host"><UserAvatar class="media" /></header></template>`
  const result = analyzeVueTemplate(source, "/src/components/BoundaryHost.vue", config)
  const violation = result.violations.find(
    ({ ruleId }) => ruleId === "owned-component-identity",
  )

  assert.ok(violation, JSON.stringify(result.violations))
  assert.match(violation.message, /already carries "app-user-avatar"/)
  assert.equal(
    source.slice(0, violation.fix.range[0]) +
      violation.fix.text +
      source.slice(violation.fix.range[1]),
    `<template><header class="app-boundary-host"><UserAvatar /></header></template>`,
  )

  // placement variants remain valid when they distinguish same-base peers
  const variant = analyzeVueTemplate(
    `<template><header class="app-boundary-host"><UserAvatar class="-lead" /><UserAvatar class="-trail" /></header></template>
<style>.app-boundary-host { > .app-user-avatar.-lead {} > .app-user-avatar.-trail {} }</style>`,
    "/src/components/BoundaryHost.vue",
    config,
  )
  assert.deepEqual(variant.violations, [])
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

test("a variant applied by a binding is runtime state", () => {
  const config = { surfaceRootPrefixes: ["app-"] }
  const dynamic = analyzeVueTemplate(
    `<template><section class="app-state-host"><div class="unit" :class="{ '-collapsed': !open }" /></section></template>`,
    "/src/components/StateHost.vue",
    config,
  )
  const attribute = analyzeVueTemplate(
    `<template><section class="app-state-host"><div class="unit" :data-collapsed="!open" /></section></template>`,
    "/src/components/StateHost.vue",
    config,
  )
  const staticVariant = analyzeVueTemplate(
    `<template><section class="app-state-host"><div class="unit -collapsed" /></section></template>`,
    "/src/components/StateHost.vue",
    config,
  )

  assert.equal(
    dynamic.violations.some(({ ruleId }) => ruleId === "variant-must-be-static"),
    true,
  )
  assert.deepEqual(attribute.violations, [])
  // static means it does not change, so it is a style variant rather than state
  assert.deepEqual(staticVariant.violations, [])
})

test("only role names that are also base identities are barred from variants", () => {
  const config = { surfaceRootPrefixes: ["app-"] }
  const host = (markup) =>
    analyzeVueTemplate(
      `<template><section class="app-role-variant">${markup}</section></template>`,
      "/src/components/RoleVariant.vue",
      config,
    ).violations.map(({ ruleId }) => ruleId)

  // role names with no base identity behind them say which part of the design this is
  for (const stem of ["search", "toolbar", "status", "tooltip"]) {
    assert.deepEqual(host(`<div class="unit -${stem}" />`), [], stem)
  }
  // names the vocabulary hands out as a base identity stay barred
  for (const stem of ["title", "footer", "nav", "media", "unit"]) {
    assert.deepEqual(
      host(`<div class="seg -${stem}" />`).filter(
        (ruleId) => ruleId === "variant-shadows-vocabulary",
      ),
      ["variant-shadows-vocabulary"],
      stem,
    )
  }
  // and a role name is barred on the element that declares it
  assert.ok(
    host(`<div class="unit -dialog" role="dialog" />`).includes("variant-shadows-vocabulary"),
  )
})

test("a tone word is a variant, not a state class", () => {
  const result = analyzeVueTemplate(
    `<template><section class="app-tone-host"><div class="unit -success" /></section></template>`,
    "/src/components/ToneHost.vue",
    { surfaceRootPrefixes: ["app-"] },
  )

  assert.deepEqual(result.violations, [])
})

test("purely presentational elements get no class of their own", () => {
  const config = { surfaceRootPrefixes: ["app-"] }
  const host = (markup) =>
    analyzeVueTemplate(
      `<template><section class="app-visual-host">${markup}</section></template>
<style>.app-visual-host { > .icon {} > .strong {} }</style>`,
      "/src/components/VisualHost.vue",
      config,
    ).violations

  for (const tag of ["b", "i", "u", "s"]) {
    const violations = host(`<${tag} class="${tag}">x</${tag}>`)
    assert.ok(
      violations.some(
        ({ message, ruleId }) =>
          ruleId === "anatomy-allowed" && message.includes("names a rendering"),
      ),
      tag,
    )
    // one message, not also reserved-element-name
    assert.deepEqual(violations.map(({ ruleId }) => ruleId), ["anatomy-allowed"], tag)
    // an unstyled one in prose needs no class at all
    assert.deepEqual(host(`<${tag}>x</${tag}>`), [], tag)
  }

  // the semantic elements the author should reach for keep their self-map
  assert.deepEqual(host(`<strong class="strong">x</strong>`), [])
  // Anatomy belongs only to div/span, including an icon wrapper.
  assert.ok(host(`<i class="icon" />`).some(({ ruleId }) => ruleId === "anatomy-allowed"))
  assert.deepEqual(host(`<span class="icon" />`), [])
})

test("reports a class binding whose names cannot be read", () => {
  const config = { surfaceRootPrefixes: ["app-"] }
  const host = (binding) =>
    analyzeVueTemplate(
      `<template><section class="app-opaque-host"><span class="icon" ${binding} /></section></template>
<style>.app-opaque-host { > .icon {} }</style>`,
      "/src/components/OpaqueHost.vue",
      config,
    ).violations.filter(({ ruleId }) => ruleId === "unverifiable-dynamic-class")

  // readable: every class the binding can apply is written out
  assert.deepEqual(host(`:class="{ 'icon-large': big }"`), [])
  assert.deepEqual(host(`:class="big ? 'icon-large' : 'icon-small'"`), [])
  assert.deepEqual(host(`:class="['icon-large']"`), [])

  // unreadable: the result is decided at runtime
  for (const binding of [':class="iconName"', ':class="`icon-${size}`"', ':class="pick()"']) {
    assert.equal(host(binding).length, 1, binding)
  }
})

test("reports a layout-only wrapper as a review candidate, not a proven violation", () => {
  const analyze = ({
    attributes = "",
    declarations = "display: flex; inline-size: 100%;",
    children,
    sibling = "",
  } = {}) =>
    analyzeVueTemplate(
      `<template>
  <section class="app-carousel">
    <div class="unit -viewport">
      ${sibling}
      <div class="seg -slides" ${attributes}>
        ${children ?? '<article v-for="item in items" :key="item.id" class="article" />'}
      </div>
    </div>
  </section>
</template>
<style>
.app-carousel {
  > .unit.-viewport {
    overflow: auto;
    > .seg.-slides {
      ${declarations}
      > .article {}
      > .p {}
    }
  }
}
</style>`,
      "/src/components/Carousel.vue",
      { surfaceRootPrefixes: ["app-"] },
    ).violations.filter(({ ruleId }) => ruleId === "layout-only-wrapper")

  const candidate = analyze()
  assert.equal(candidate.length, 1)
  assert.match(candidate[0].message, /review whether that layout can move/u)
  assert.equal("fix" in candidate[0], false)

  for (const attributes of [
    'role="group"',
    'data-part="slides"',
    'ref="track"',
    '@click="activate"',
  ]) {
    assert.deepEqual(analyze({ attributes }), [], attributes)
  }
  assert.deepEqual(analyze({ declarations: "display: flex; overflow: hidden;" }), [])
  assert.deepEqual(analyze({ declarations: "display: flex; transform: translateX(0);" }), [])
  assert.deepEqual(
    analyze({ declarations: "display: flex; &[data-moving] { transform: translateX(0); }" }),
    [],
  )
  assert.deepEqual(
    analyze({
      children: '<article class="article" /><p class="p">Empty</p>',
    }),
    [],
  )
  assert.deepEqual(analyze({ sibling: '<h2 class="title">Choices</h2>' }), [])
})

test("warns when static sibling STN branches cannot be distinguished", () => {
  const warnings = (children) =>
    analyzeVueTemplate(
      `<template>
  <section class="app-toast">
    ${children}
  </section>
</template>`,
      "/src/components/Toast.vue",
      { emitPolicy: "always", surfaceRootPrefixes: ["app-"] },
    ).violations.filter(({ ruleId }) => ruleId === "stn-peer-variant")

  const oneBare = warnings(`
    <div class="unit -announcements" />
    <div class="unit" />
  `)
  assert.equal(oneBare.length, 1)
  assert.match(oneBare[0].message, /add a unique static variant/u)
  assert.equal("fix" in oneBare[0], false)

  assert.equal(
    warnings(`
      <div class="unit -announcements" />
      <div class="unit -stack" />
    `).length,
    0,
  )
  assert.equal(
    warnings(`
      <div class="unit -shared" />
      <div class="unit -shared" />
    `).length,
    2,
  )
})

test("requires a same-base peer for non-STN variants", () => {
  const redundantVariants = (children) =>
    analyzeVueTemplate(
      `<template>
  <section class="app-carousel">
    ${children}
  </section>
</template>`,
      "/src/components/Carousel.vue",
      { emitPolicy: "always", surfaceRootPrefixes: ["app-"] },
    ).violations.filter(({ ruleId }) => ruleId === "variant-requires-peer")

  const slide = redundantVariants(`
    <div class="unit -presence">
      <article class="article -slide" />
    </div>
  `)
  assert.equal(slide.length, 1)
  assert.match(slide[0].message, /article/u)
  assert.match(slide[0].message, /-slide/u)
  assert.equal("fix" in slide[0], false)

  assert.deepEqual(redundantVariants('<div class="unit -presence" />'), [])
  assert.deepEqual(
    redundantVariants(`
      <article class="article -primary" />
      <article class="article -secondary" />
    `),
    [],
  )
  assert.deepEqual(
    redundantVariants(
      '<article class="article -featured" /><article class="article" />',
    ),
    [],
  )
  assert.deepEqual(
    redundantVariants(`
      <header><button class="button -primary" /></header>
      <footer><button class="button -secondary" /></footer>
    `),
    [],
  )

  const configuredComponent = (children) =>
    analyzeVueTemplate(
      `<template><section class="app-actions">${children}</section></template>`,
      "/src/components/Actions.vue",
      {
        componentClasses: { NButton: "n-button" },
        emitPolicy: "always",
        surfaceRootPrefixes: ["app-"],
      },
    ).violations.filter(({ ruleId }) => ruleId === "variant-requires-peer")

  assert.equal(configuredComponent('<NButton class="-primary" />').length, 1)
  assert.deepEqual(
    configuredComponent(
      '<NButton class="-cancel" /><NButton class="-save" />',
    ),
    [],
  )

  const transparent = analyzeVueTemplate(
    `<template><section class="app-nav"><RouterLink class="link -home" /></section></template>`,
    "/src/components/Nav.vue",
    {
      emitPolicy: "always",
      surfaceRootPrefixes: ["app-"],
      transparentComponents: ["RouterLink"],
    },
  ).violations.filter(({ ruleId }) => ruleId === "variant-requires-peer")
  assert.equal(transparent.length, 1)
})

test("does not require peer variants for repeated or mutually exclusive branches", () => {
  const warnings = (children) =>
    analyzeVueTemplate(
      `<template>
  <section class="app-list">
    ${children}
  </section>
</template>`,
      "/src/components/List.vue",
      { emitPolicy: "always", surfaceRootPrefixes: ["app-"] },
    ).violations.filter(({ ruleId }) => ruleId === "stn-peer-variant")

  assert.deepEqual(warnings('<div v-for="item in items" :key="item.id" class="unit" />'), [])
  assert.deepEqual(
    warnings(`
      <div v-if="ready" class="unit" />
      <div v-else class="unit" />
    `),
    [],
  )
  assert.deepEqual(
    warnings(`
      <template v-if="ready"><div class="unit" /></template>
      <template v-else><div class="unit" /></template>
    `),
    [],
  )
})

test("advisory rules warn by default and explicit configuration wins", () => {
  const levelFor = resolveSeverity()
  assert.equal(levelFor("layout-only-wrapper"), "warn")
  assert.equal(levelFor("stn-peer-variant"), "warn")
  assert.equal(levelFor("unverifiable-dynamic-class"), "warn")
  assert.equal(levelFor("anatomy-allowed"), "error")

  // "*" is an explicit choice about everything, so it overrides the rule default
  assert.equal(resolveSeverity({ "*": "error" })("layout-only-wrapper"), "error")
  assert.equal(resolveSeverity({ "*": "error" })("stn-peer-variant"), "error")
  assert.equal(resolveSeverity({ "*": "error" })("unverifiable-dynamic-class"), "error")
  assert.equal(resolveSeverity({ "*": "off" })("unverifiable-dynamic-class"), "off")
  // and a rule-specific entry wins over both
  assert.equal(
    resolveSeverity({ "*": "off", "unverifiable-dynamic-class": "error" })(
      "unverifiable-dynamic-class",
    ),
    "error",
  )
})

test("reads the custom properties a token source declares", () => {
  const names = parseTokenDeclarations(`
    /* --color-commented: red; */
    :root { --color-surface: var(--palette-gray-100); --space-3: 0.75rem }
    [data-theme="dark"] {
      --color-surface: var(--palette-gray-900);
    }
    .thing { color: var(--color-surface) }
  `)

  assert.deepEqual([...names].sort(), ["--color-surface", "--space-3"])
})

test("collects the tokens a declaration value references", () => {
  assert.deepEqual(tokenReferences("var(--color-text, #333)"), ["--color-text"])
  assert.deepEqual(tokenReferences("calc(var( --space-3 ) * -1)"), ["--space-3"])
  assert.deepEqual(tokenReferences("1px solid oklch(62% 0.21 25)"), [])
  assert.deepEqual(tokenReferences("color-mix(in oklab, var(--a), var(--b) 20%)"), ["--a", "--b"])
})

test("validates the token source declaration", () => {
  assert.deepEqual(
    validateNagiConfig(
      defineNagiConfig({
        surfaceRootPrefixes: ["n-"],
        tokens: { sources: [{ file: "tokens/semantic.css", layer: "semantic" }] },
      }),
    ),
    [],
  )
  assert.deepEqual(
    validateNagiConfig(
      defineNagiConfig({
        surfaceRootPrefixes: ["n-"],
        tokens: {
          exposedPrefixes: ["date-picker-"],
          localPrefix: "local-",
          sources: [{ layer: "brand" }],
        },
      }),
    ),
    [
      "tokens.sources[0].file must be a non-empty string",
      'tokens.sources[0].layer must be one of primitive, semantic; received "brand"',
      'tokens.localPrefix entries must be custom property prefixes starting with "--"',
      'tokens.exposedPrefixes entries must be custom property prefixes starting with "--"',
    ],
  )
})

test("tells a raw color from a token, a keyword, and an author-chosen name", () => {
  const raw = (value, property = "color") =>
    rawColorLiterals(value, { property, exposedPrefixes: ["--pv-"] })

  assert.deepEqual(raw("#f0a"), ["#f0a"])
  assert.deepEqual(raw("rgb(0 0 0 / 0.1)"), ["rgb(0 0 0 / 0.1)"])
  assert.deepEqual(raw("linear-gradient(to right, #fff, var(--color-a))", "background"), ["#fff"])
  assert.deepEqual(raw("color-mix(in oklab, var(--a), white 20%)", "background"), ["white"])

  // tokens, keywords, and platform colors decide nothing here
  assert.deepEqual(raw("var(--color-text)"), [])
  assert.deepEqual(raw("currentColor"), [])
  assert.deepEqual(raw("transparent"), [])
  assert.deepEqual(raw("CanvasText", "outline-color"), [])
  assert.deepEqual(raw("color-mix(in oklab, var(--a), var(--b) 20%)", "background"), [])
  // relative color syntax derives from a token rather than stating a color
  assert.deepEqual(raw("oklch(from var(--color-accent) l c calc(h + 20))"), [])

  // a fallback is a raw color, unless the token is a contract the project exposes
  assert.deepEqual(raw("var(--color-text, #333)"), ["#333"])
  assert.deepEqual(raw("var(--pv-datepicker-fg, #333)"), [])

  // not colors: a string, a URL fragment, and a font family that shares a name
  assert.deepEqual(raw('"#fff"', "content"), [])
  assert.deepEqual(raw("url(icon.svg#red)", "background"), [])
  assert.deepEqual(raw("Tan, serif", "font-family"), [])
  assert.deepEqual(raw("13px 0", "padding"), [])
})

test("requires a token for a length only where the design system owns a scale", () => {
  const raw = (property, value) =>
    rawLengthLiterals(value, { property, exposedPrefixes: ["--pv-"] })

  assert.deepEqual(raw("padding", "13px"), ["13px"])
  assert.deepEqual(raw("gap", "0.5rem"), ["0.5rem"])
  assert.deepEqual(raw("border", "1px solid var(--color-border)"), ["1px"])
  assert.deepEqual(raw("padding", "calc(100% - 12px)"), ["12px"])
  assert.deepEqual(raw("padding", "var(--space-3, 12px)"), ["12px"])

  // a scale the design system does not own: this surface's own size and position
  assert.deepEqual(raw("max-inline-size", "32rem"), [])
  assert.deepEqual(raw("top", "12px"), [])

  // not a magnitude the system publishes: zero, a ratio, a relative unit, a token
  assert.deepEqual(raw("padding", "0"), [])
  assert.deepEqual(raw("line-height", "1.5"), [])
  assert.deepEqual(raw("border-radius", "50%"), [])
  assert.deepEqual(raw("padding", "var(--space-3) 0"), [])
  assert.deepEqual(raw("margin-inline", "calc(var(--space-3) * -1)"), [])
  assert.deepEqual(raw("border-width", "var(--pv-thing-width, 2px)"), [])

  // neither an angle nor a duration is a length
  assert.deepEqual(raw("rotate", "45deg"), [])
  assert.deepEqual(raw("transition", "0.2s ease"), [])
})

test("Svelte and Astro use the same semantic template analysis", () => {
  const config = { surfaceRootPrefixes: ["test-"] }
  const cases = [
    [
      "/src/components/SharedCard.svelte",
      `<section class="test-shared-card"><button class="button">Save</button></section>`,
    ],
    [
      "/src/components/SharedCard.astro",
      `<section class="test-shared-card"><button class="button">Save</button></section>`,
    ],
  ]

  for (const [filename, source] of cases) {
    const result = analyzeTemplate(source, filename, config)
    assert.deepEqual(result.violations, [], filename)
    assert.deepEqual([...result.surfaceRoots], ["test-shared-card"], filename)
    assert.equal(result.tree[0].children[0].tag, "button", filename)
  }
})

test("Svelte and Astro conditional branches do not become static STN peers", () => {
  const config = { emitPolicy: "always", surfaceRootPrefixes: ["test-"] }
  const cases = [
    [
      "/src/components/Conditional.svelte",
      `<section class="test-conditional">
  {#if ready}<div class="unit" />{:else}<div class="unit" />{/if}
</section>`,
    ],
    [
      "/src/components/Conditional.astro",
      `<section class="test-conditional">
  {ready ? <div class="unit" /> : <div class="unit" />}
</section>`,
    ],
  ]

  for (const [filename, source] of cases) {
    const warnings = analyzeTemplate(source, filename, config).violations.filter(
      ({ ruleId }) => ruleId === "stn-peer-variant",
    )
    assert.deepEqual(warnings, [], filename)
  }
})

test("dynamic HTML keeps selector-tree conclusions unknown", () => {
  const config = { surfaceRootPrefixes: ["test-"] }
  const cases = [
    [
      "/src/components/RawSurface.svelte",
      `<section class="test-raw-surface">{@html content}</section>`,
    ],
    [
      "/src/components/RawSurface.astro",
      `<section class="test-raw-surface"><div set:html={content} /></section>`,
    ],
  ]

  for (const [filename, source] of cases) {
    const result = analyzeTemplate(source, filename, config)
    const target =
      filename.endsWith(".svelte") ? result.tree[0] : result.tree[0].children[0]
    assert.equal(target.children.some((child) => child.opaque), true, filename)
  }
})

test("ships default token names by family, and nothing else about them", () => {
  const { tokens } = defineNagiConfig({ surfaceRootPrefixes: ["app-"] })

  assert.deepEqual(tokens.semantic.space, [
    "--space-1", "--space-2", "--space-3", "--space-4",
    "--space-5", "--space-6", "--space-7", "--space-8",
  ])
  assert.ok(tokens.semantic.color.includes("--color-surface"))
  assert.ok(tokens.semantic.stacking.includes("--z-modal"))
  // names only: no value is shipped for any of them
  assert.ok(Object.values(tokens.semantic).flat().every((name) => name.startsWith("--")))

  // a project renames a family the way it overrides elementClasses
  const renamed = defineNagiConfig({
    surfaceRootPrefixes: ["app-"],
    tokens: { semantic: { color: ["--fg-default", "--bg-default"] } },
  })
  assert.deepEqual(renamed.tokens.semantic.color, ["--fg-default", "--bg-default"])
})

test("names the token family a scale property draws from", () => {
  assert.deepEqual(tokenFamilyFor("padding-block"), { example: "--space-*", label: "spacing" })
  assert.deepEqual(tokenFamilyFor("gap"), { example: "--space-*", label: "spacing" })
  assert.deepEqual(tokenFamilyFor("border-end-end-radius"), {
    example: "--radius-*",
    label: "radius",
  })
  assert.deepEqual(tokenFamilyFor("box-shadow"), { example: "--shadow-*", label: "elevation" })
  assert.deepEqual(tokenFamilyFor("font-size"), { example: "--font-size-*", label: "type scale" })
  assert.deepEqual(tokenFamilyFor("border-inline-start-width"), {
    example: "--border-width-*",
    label: "border width",
  })
  assert.equal(tokenFamilyFor("color"), null)
})
