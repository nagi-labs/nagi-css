import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { ESLint } from "eslint"

import nagiCss, {
  createNagiStandaloneEslintConfigs,
} from "@nagi-labs/eslint-plugin-nagi-css"
import { typescriptParser } from "@nagi-labs/nagi-css-core"
import vueParser from "vue-eslint-parser"

const root = path.dirname(fileURLToPath(import.meta.url))
const validFile = path.join(root, "fixtures/valid/Component.vue")
const invalidFile = path.join(root, "fixtures/invalid/Component.vue")
const styleFile = path.join(root, "fixtures/style/BoundarySurface.vue")
const invalidStyleFile = path.join(root, "fixtures/style/InvalidBoundarySurface.vue")

const testSurface = { surfaceRootPrefixes: ["test-"] }

test("plugin metadata matches the package version", async () => {
  const manifest = JSON.parse(
    await fs.readFile(
      path.resolve(root, "../packages/eslint-plugin/package.json"),
      "utf8",
    ),
  )

  assert.equal(nagiCss.meta.version, manifest.version)
})

const semantic = {
  ...testSurface,
  componentClasses: { Column: "ui-column", DataTable: "ui-data-table" },
  componentSlotPrefixes: { Column: "ui-table-column" },
  componentSlots: {
    Column: { body: "ui-table-column-body" },
    DataTable: { body: "ui-data-table-body", company: "ui-data-table-cell-company" },
  },
  libraryBoundaryPrefixes: ["ui-"],
  libraryInternalPrefixes: ["third-party-"],
}

async function lintEslint(file, config = {}, code) {
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: createNagiStandaloneEslintConfigs({
      ...testSurface,
      ...config,
    }),
  })
  return (await eslint.lintText(code ?? await fs.readFile(file, "utf8"), {
    filePath: file,
  }))[0]
}

async function lintFrameworkEslint(file, config = {}) {
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: createNagiStandaloneEslintConfigs({
      ...testSurface,
      ...config,
    }),
  })
  return (await eslint.lintText(await fs.readFile(file, "utf8"), { filePath: file }))[0]
}

async function lintStyles(file, config = semantic, code) {
  const result = await lintEslint(file, config, code)
  return {
    errored: result.errorCount > 0,
    results: [{
      warnings: result.messages.map(({ line, message, ruleId }) => ({
        line,
        rule: ruleId,
        text: message,
      })),
    }],
  }
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

test("recommended config layers onto the framework parser without replacing it", async () => {
  const recommended = nagiCss.configs.recommended(testSurface)
  assert.equal(recommended.length, 1)
  assert.equal("languageOptions" in recommended[0], false)

  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.vue"],
        languageOptions: {
          parser: vueParser,
          parserOptions: {
            extraFileExtensions: [".vue"],
            parser: typescriptParser,
          },
        },
      },
      ...recommended,
    ],
  })
  const [result] = await eslint.lintText(await fs.readFile(validFile, "utf8"), {
    filePath: validFile,
  })
  assert.equal(result.errorCount, 0, JSON.stringify(result.messages))
})

test("recommended config rejects unknown severity keys during config loading", () => {
  assert.throws(
    () =>
      nagiCss.configs.recommended(testSurface, {
        severity: { "no-such-rule": "warn" },
      }),
    /severity\.no-such-rule is not a Nagi CSS rule/,
  )
})

test("Tailwind apply is explicit while selector checks remain active", async () => {
  const source = `<template>
  <section class="test-apply-card">
    <button class="button">Save</button>
  </section>
</template>
<style scoped>
.test-apply-card {
  @apply grid gap-4;

  > .button {
    @apply rounded-md px-3 py-2;
  }
}
</style>`

  const plain = await lintEslint(
    path.join(root, "fixtures/style/ApplyCard.vue"),
    {},
    source,
  )
  assert.ok(
    plain.messages.some(
      ({ ruleId }) => ruleId === "nagi-css/apply-directive-not-enabled",
    ),
  )

  const tailwind = await lintEslint(
    path.join(root, "fixtures/style/ApplyCard.vue"),
    { declarationMode: "tailwind-apply" },
    source,
  )
  assert.equal(tailwind.errorCount, 0, JSON.stringify(tailwind.messages))

  const brokenSelector = await lintEslint(
    path.join(root, "fixtures/style/ApplyCard.vue"),
    { declarationMode: "tailwind-apply" },
    source.replace("> .button {", "> .missing {"),
  )
  assert.ok(
    brokenSelector.messages.some(({ ruleId }) => ruleId === "nagi-css/dead-rule"),
  )

  const arbitrary = await lintEslint(
    path.join(root, "fixtures/style/ApplyCard.vue"),
    { declarationMode: "tailwind-apply" },
    source.replace("rounded-md", "font-[inherit]"),
  )
  assert.ok(
    arbitrary.messages.some(
      ({ ruleId }) => ruleId === "nagi-css/apply-arbitrary-syntax",
    ),
  )

  const hiddenSurfaceLayout = await lintEslint(
    path.join(root, "fixtures/style/ApplyCard.vue"),
    { declarationMode: "tailwind-apply" },
    source.replace("@apply grid gap-4;", "@apply relative mt-4 z-10;"),
  )
  assert.equal(
    hiddenSurfaceLayout.messages.filter(
      ({ ruleId }) => ruleId === "nagi-css/surface-external-layout",
    ).length,
    3,
  )
})

test("template and style rules share an exact configured surface prefix", async () => {
  const file = path.join(root, "fixtures/prefixed/Toggle.vue")
  const config = { surfaceRootPrefixes: ["n-"] }
  const eslint = await lintEslint(file, config)
  const styles = await lintStyles(file, config)

  assert.equal(eslint.errorCount, 0)
  assert.equal(styles.errored, false, JSON.stringify(styles.results[0].warnings))
})

test("ESLint autofixes an unambiguous required static class", async () => {
  const eslint = new ESLint({
    cwd: root,
    fix: true,
    overrideConfigFile: true,
    overrideConfig: createNagiStandaloneEslintConfigs({
      ...testSurface,
      emitPolicy: "always",
    }),
  })
  const code = `<template><section class="test-fix-surface"><button>-</button></section></template>`
  const [result] = await eslint.lintText(code, {
    filePath: path.join(root, "fixtures/FixSurface.vue"),
  })

  assert.match(result.output, /<button class="button">/)
  assert.equal(result.messages.length, 0)
})

test("ESLint replaces an anatomy or STN fallback with an identifying role", async () => {
  const eslint = new ESLint({
    cwd: root,
    fix: true,
    overrideConfigFile: true,
    overrideConfig: createNagiStandaloneEslintConfigs(testSurface),
  })
  const [result] = await eslint.lintText(
    `<template><section class="test-role-host"><div class="unit -fields" role="group" /></section></template>`,
    { filePath: path.join(root, "fixtures/RoleHost.vue") },
  )

  assert.match(result.output, /class="group -fields" role="group"/)
  assert.equal(result.messages.length, 0)
})

test("ESLint reports a layout-only wrapper as a non-failing warning without a fix", async () => {
  const result = await lintEslint(
    path.join(root, "fixtures/LayoutWrapper.vue"),
    {},
  `<template>
  <section class="test-layout-wrapper">
    <div class="unit -viewport">
      <div class="seg -items">
        <article v-for="item in items" :key="item.id" class="article" />
      </div>
    </div>
  </section>
</template>
<style>
.test-layout-wrapper {
  > .unit.-viewport {
    overflow: auto;
    > .seg.-items {
      display: flex;
      inline-size: 100%;
      > .article {}
    }
  }
}
</style>`,
  )

  const warning = result.messages.find(
    ({ ruleId }) => ruleId === "nagi-css/layout-only-wrapper",
  )
  assert.ok(warning, JSON.stringify(result.messages))
  assert.equal(warning.severity, 1)
  assert.equal(result.errorCount, 0)
  assert.equal(result.output, undefined)
})

test("ESLint accepts Svelte and Astro component templates and styles", async () => {
  for (const name of ["SvelteCard.svelte", "AstroCard.astro"]) {
    const file = path.join(root, "fixtures/framework", name)
    const eslint = await lintFrameworkEslint(file)
    const styles = await lintStyles(file, {})

    assert.equal(eslint.errorCount, 0, `${name}: ${JSON.stringify(eslint.messages)}`)
    assert.equal(
      styles.errored,
      false,
      `${name}: ${JSON.stringify(styles.results[0].warnings)}`,
    )
  }
})

test("ESLint mirrors selectors against Svelte and Astro templates", async () => {
  for (const name of ["SvelteCard.svelte", "AstroCard.astro"]) {
    const file = path.join(root, "fixtures/framework", name)
    const code = (await fs.readFile(file, "utf8")).replace("> .button {}", "> .missing {}")
    const result = await lintStyles(file, testSurface, code)
    assert.ok(
      result.results[0].warnings.some(({ rule }) => rule === "nagi-css/dead-rule"),
      name,
    )
  }
})

test("ESLint reports component-style violations at Svelte and Astro source lines", async () => {
  for (const [name, line] of [
    ["SvelteCard.svelte", 13],
    ["AstroCard.astro", 17],
  ]) {
    const file = path.join(root, "fixtures/framework", name)
    const code = (await fs.readFile(file, "utf8")).replace("> .button {}", "> .missing {}")
    const eslint = new ESLint({
      cwd: root,
      overrideConfigFile: true,
      overrideConfig: createNagiStandaloneEslintConfigs(testSurface),
    })
    const [result] = await eslint.lintText(code, { filePath: file })
    const violation = result.messages.find(
      ({ ruleId }) => ruleId === "nagi-css/dead-rule",
    )

    assert.ok(violation, `${name}: ${JSON.stringify(result.messages)}`)
    assert.equal(violation.line, line, name)
  }
})

test("Svelte class directives and Astro class:list share dynamic class rules", async () => {
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: createNagiStandaloneEslintConfigs(testSurface),
  })
  const cases = [
    [
      "DynamicSurface.svelte",
      `<script>let active = false</script>
<section class="test-dynamic-surface">
  <button class="button" class:is-active={active} class:-lead={active}>x</button>
</section>`,
    ],
    [
      "DynamicSurface.astro",
      `---
const active = false
---
<section class="test-dynamic-surface">
  <button class="button" class:list={{ "is-active": active, "-lead": active }}>x</button>
</section>`,
    ],
  ]

  for (const [name, code] of cases) {
    const [result] = await eslint.lintText(code, {
      filePath: path.join(root, "fixtures/framework", name),
    })
    const ruleIds = new Set(result.messages.map(({ ruleId }) => ruleId))
    assert.ok(ruleIds.has("nagi-css/state-not-class"), name)
    assert.ok(ruleIds.has("nagi-css/variant-must-be-static"), name)
  }
})

test("ESLint autofixes required classes in Svelte and Astro", async () => {
  const eslint = new ESLint({
    cwd: root,
    fix: true,
    overrideConfigFile: true,
    overrideConfig: createNagiStandaloneEslintConfigs({
      ...testSurface,
      emitPolicy: "always",
    }),
  })

  for (const extension of ["svelte", "astro"]) {
    const [result] = await eslint.lintText(
      `<section class="test-fix-surface"><button>Save</button></section>`,
      {
        filePath: path.join(root, "fixtures/framework", `FixSurface.${extension}`),
      },
    )
    assert.match(result.output, /<button class="button">/, extension)
    assert.equal(result.messages.length, 0, extension)
  }
})

test("ESLint adds a static anchor beside Svelte and Astro class helpers", async () => {
  const eslint = new ESLint({
    cwd: root,
    fix: true,
    overrideConfigFile: true,
    overrideConfig: createNagiStandaloneEslintConfigs({
      ...testSurface,
      emitPolicy: "always",
    }),
  })
  const cases = [
    [
      "AnchorSurface.svelte",
      `<script>let active = false</script>
<section class="test-anchor-surface"><button class:is-active={active}>x</button></section>`,
    ],
    [
      "AnchorSurface.astro",
      `---
const active = false
---
<section class="test-anchor-surface"><button class:list={{ "is-active": active }}>x</button></section>`,
    ],
  ]

  for (const [name, code] of cases) {
    const [result] = await eslint.lintText(code, {
      filePath: path.join(root, "fixtures/framework", name),
    })
    assert.match(result.output, /<button class="button" class(?::is-active|:list)=/, name)
  }
})

test("ESLint does not add a duplicate class attribute beside an opaque binding", async () => {
  const eslint = new ESLint({
    cwd: root,
    fix: true,
    overrideConfigFile: true,
    overrideConfig: createNagiStandaloneEslintConfigs({
      ...testSurface,
      emitPolicy: "always",
    }),
  })

  for (const extension of ["svelte", "astro"]) {
    const code = `<section class="test-opaque-surface"><button class={classes}>x</button></section>`
    const [result] = await eslint.lintText(code, {
      filePath: path.join(root, "fixtures/framework", `OpaqueSurface.${extension}`),
    })
    assert.equal(result.output, undefined, extension)
    assert.equal((result.source.match(/\bclass=/g) ?? []).length, 2, extension)
  }
})

test("ESLint accepts nested UI boundaries and deep library internals", async () => {
  const result = await lintStyles(styleFile)
  assert.equal(result.errored, false, JSON.stringify(result.results[0].warnings))
})

test("ESLint requires a declared slot surface before selectors resume below a UI boundary", async () => {
  const file = path.join(root, "fixtures/TableSlotHost.vue")
  const template = `<template><section class="test-table-slot-host"><DataTable class="ui-data-table"><template #company><div class="ui-data-table-cell-company"><a class="link">Acme</a></div></template></DataTable></section></template>`
  const invalid = await lintStyles(
    file,
    semantic,
    `${template}<style scoped>.test-table-slot-host { > .ui-data-table { .link {} } }</style>`,
  )
  const valid = await lintStyles(
    file,
    semantic,
    `${template}<style scoped>.test-table-slot-host { > .ui-data-table { .ui-data-table-cell-company { > .link {} } } }</style>`,
  )

  assert.ok(
    invalid.results[0].warnings.some(
      ({ rule }) => rule === "nagi-css/boundary-slot-surface-required",
    ),
    JSON.stringify(invalid.results[0].warnings),
  )
  assert.equal(valid.errored, false, JSON.stringify(valid.results[0].warnings))

  const boundaryRoot = await lintStyles(
    file,
    semantic,
    `${template}<style scoped>.test-table-slot-host { > .ui-data-table { margin-inline: auto; } }</style>`,
  )
  assert.equal(boundaryRoot.errored, false, JSON.stringify(boundaryRoot.results[0].warnings))
})

test("ESLint does not treat another public boundary or library internal class as a slot surface", async () => {
  const file = path.join(root, "fixtures/BoundaryReachIn.vue")
  const template = `<template><section class="test-boundary-reach-in"><DataTable class="ui-data-table" /></section></template>`
  for (const selector of [".ui-column", ".third-party-node"]) {
    const result = await lintStyles(
      file,
      semantic,
      `${template}<style scoped>.test-boundary-reach-in { > .ui-data-table { ${selector} {} } }</style>`,
    )
    assert.ok(
      result.results[0].warnings.some(
        ({ rule }) => rule === "nagi-css/boundary-slot-surface-required",
      ),
      `${selector}: ${JSON.stringify(result.results[0].warnings)}`,
    )
  }

  const deep = await lintStyles(
    file,
    semantic,
    `${template}<style scoped>.test-boundary-reach-in { > .ui-data-table { :deep(.third-party-node) {} } }</style>`,
  )
  assert.equal(deep.errored, false, JSON.stringify(deep.results[0].warnings))
})

test("ESLint treats an automatically derived pv class as a boundary", async () => {
  const file = path.join(root, "fixtures/TableHost.vue")
  const result = await lintStyles(file, { ...testSurface, componentClasses: ["DataTable"] }, `<template><section class="test-table-host"><DataTable class="pv-data-table" /></section></template>\n<style scoped>.test-table-host { > .pv-data-table { > .value {} } }</style>`)

  assert.equal(
    result.results[0].warnings.some(({ rule }) => rule === "nagi-css/owned-dom-direct-child"),
    true,
  )
})

test("ESLint reserves body for the matching element", async () => {
  const file = path.join(root, "fixtures/InvalidBody.vue")
  const result = await lintStyles(file, testSurface, `<template><section class="test-invalid-body"><div class="body" /></section></template>\n<style scoped>.test-invalid-body { > .body { color: inherit; } }</style>`)

  assert.ok(
    result.results[0].warnings.some(
      ({ rule }) => rule === "nagi-css/reserved-element-name",
    ),
  )
})

test("ESLint accepts table-first identity with ARIA attribute semantics", async () => {
  const result = await lintStyles(
    path.join(root, "fixtures/roles/SeparatorList.vue"),
    {},
  )

  assert.equal(result.errored, false, JSON.stringify(result.results[0].warnings))
})

test("ESLint reports every selector contract family", async () => {
  const result = await lintStyles(invalidStyleFile)
  const rules = new Set(result.results[0].warnings.map(({ rule }) => rule))

  assert.deepEqual(
    [...rules].sort(),
    [
      "nagi-css/anatomy-allowed",
      "nagi-css/bare-element-selector",
      "nagi-css/boundary-nesting",
      "nagi-css/boundary-slot-surface-required",
      "nagi-css/dead-rule",
      "nagi-css/owned-dom-direct-child",
      "nagi-css/owned-dom-readable-nesting",
      "nagi-css/slot-surface-top-level",
      "nagi-css/state-not-class",
      "nagi-css/top-level-surface-only",
    ].sort(),
  )
})

test("ESLint reports every selector and value contract family", async () => {
  const result = await lintEslint(invalidStyleFile, semantic)
  const ruleIds = new Set(result.messages.map(({ ruleId }) => ruleId))

  for (const ruleId of [
    "anatomy-allowed",
    "bare-element-selector",
    "boundary-nesting",
    "boundary-slot-surface-required",
    "dead-rule",
    "owned-dom-direct-child",
    "owned-dom-readable-nesting",
    "slot-surface-top-level",
    "state-not-class",
    "top-level-surface-only",
  ]) {
    assert.ok(ruleIds.has(`nagi-css/${ruleId}`), ruleId)
  }
})

test("detached slot surfaces may anchor a top-level selector", async () => {
  const result = await lintStyles(invalidStyleFile, {
    ...semantic,
    detachedSlotSurfaces: ["ui-table-column-body"],
  })
  const slotWarnings = result.results[0].warnings.filter(
    ({ rule }) => rule === "nagi-css/slot-surface-top-level",
  )
  assert.equal(slotWarnings.length, 0)
})

test("ESLint keeps external layout off surfaces except top-layer or anchored ones", async () => {
  const bad = await lintStyles(path.join(root, "fixtures/layout/BadCard.vue"), {})
  const layoutWarnings = bad.results[0].warnings.filter(
    ({ rule }) => rule === "nagi-css/surface-external-layout",
  )
  assert.deepEqual(
    layoutWarnings.map(({ text }) => text.match(/"([a-z-]+)" belongs/)[1]),
    ["margin", "position", "z-index", "top", "margin-inline"],
  )

  const dialog = await lintStyles(path.join(root, "fixtures/layout/ConfirmModal.vue"), {})
  assert.equal(dialog.results[0].warnings.length, 0)

  const anchored = await lintStyles(path.join(root, "fixtures/layout/HintPopover.vue"), {})
  assert.equal(anchored.results[0].warnings.length, 0)
})

test("ESLint rejects selector variants that shadow vocabulary names", async () => {
  const file = path.join(root, "fixtures/ShadowSurface.vue")
  const result = await lintStyles(file, testSurface,
    `<template><section class="test-shadow-surface"><p class="p -lead">x</p></section></template>
<style scoped>.test-shadow-surface { > .p.-title {} > .p.-lead {} }</style>`)
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
    overrideConfig: createNagiStandaloneEslintConfigs(testSurface),
  })
  const [result] = await eslint.lintText(
    `<template><section class="test-shadow-surface"><p class="p -title">x</p></section></template>`,
    { filePath: path.join(root, "fixtures/ShadowSurface.vue") },
  )

  assert.ok(
    result.messages.some(({ ruleId }) => ruleId === "nagi-css/variant-shadows-vocabulary"),
  )
})

test("ESLint rejects an Element Class Table identity on the wrong tag", async () => {
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: createNagiStandaloneEslintConfigs(testSurface),
  })
  const [result] = await eslint.lintText(
    `<template><section class="test-text-surface"><p class="text">Paragraph</p><span class="title">Label</span></section></template>
<style scoped>.test-text-surface { > .text {} > .title {} }</style>`,
    { filePath: path.join(root, "fixtures/TextSurface.vue") },
  )

  assert.equal(
    result.messages.filter(({ ruleId }) => ruleId === "nagi-css/reserved-element-name").length,
    1,
  )
  assert.ok(result.messages.some(({ ruleId }) => ruleId === "nagi-css/anatomy-allowed"))
})

test("ESLint rejects multiple base identities", async () => {
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: createNagiStandaloneEslintConfigs(testSurface),
  })
  const [result] = await eslint.lintText(
    `<template><section class="test-separator-list"><li class="item separator" role="separator" /></section></template>`,
    { filePath: path.join(root, "fixtures/SeparatorList.vue") },
  )

  assert.ok(
    result.messages.some(({ ruleId }) => ruleId === "nagi-css/single-base-identity"),
  )
})

test("ESLint rejects multiple base identities in one compound", async () => {
  const file = path.join(root, "fixtures/CompoundSurface.vue")
  const result = await lintStyles(file, testSurface,
    `<template><section class="test-compound-surface"><li class="item unit" /></section></template>
<style scoped>.test-compound-surface { > .item.unit {} }</style>`)

  assert.ok(
    result.results[0].warnings.some(
      ({ rule }) => rule === "nagi-css/single-base-identity",
    ),
  )
})

test("ESLint rejects the legacy zone STN name", async () => {
  const file = path.join(root, "fixtures/LegacyZoneSurface.vue")
  const result = await lintStyles(file, testSurface,
    `<template><section class="test-legacy-zone-surface"><div class="zone" /></section></template>
<style scoped>.test-legacy-zone-surface { > .zone {} }</style>`)

  assert.ok(
    result.results[0].warnings.some(
      ({ rule }) => rule === "nagi-css/anatomy-allowed",
    ),
  )
})

test("ESLint allows sibling combinators inside owned DOM", async () => {
  const result = await lintStyles(path.join(root, "fixtures/style/SiblingList.vue"))

  assert.equal(result.errored, false, JSON.stringify(result.results[0].warnings))
})

test("ESLint requires owned DOM depth to remain visibly nested", async () => {
  const file = path.join(root, "fixtures/style/ReadableNesting.vue")
  const template = `<template><section class="test-readable-nesting"><header class="header"><h2 class="title">Title</h2></header></section></template>`
  const flat = await lintStyles(file, testSurface,
    `${template}<style scoped>.test-readable-nesting > .header > .title { color: var(--color-text); }</style>`)
  const partlyFlat = await lintStyles(file, testSurface,
    `${template}<style scoped>.test-readable-nesting { > .header > .title { color: var(--color-text); } }</style>`)
  const nested = await lintStyles(file, testSurface,
    `${template}<style scoped>.test-readable-nesting { > .header { > .title { color: var(--color-text); } } }</style>`)

  for (const result of [flat, partlyFlat]) {
    assert.ok(
      result.results[0].warnings.some(
        ({ rule }) => rule === "nagi-css/owned-dom-readable-nesting",
      ),
      JSON.stringify(result.results[0].warnings),
    )
  }
  assert.equal(nested.errored, false, JSON.stringify(nested.results[0].warnings))
})

test("ESLint reports a dead path when its final class exists elsewhere in the template", async () => {
  const file = path.join(root, "fixtures/style/RepeatedClassDeadPath.vue")
  const code = `<template><section class="test-repeated-class-dead-path"><div class="unit"><h2 class="title">Title</h2></div><div class="unit"><span class="value">42</span></div></section></template><style scoped>.test-repeated-class-dead-path { > .unit { > .title { > .value {} } } }</style>`
  const result = await lintStyles(file, testSurface, code)

  assert.ok(
    result.results[0].warnings.some(
      ({ rule }) => rule === "nagi-css/selector-mirrors-template",
    ),
    JSON.stringify(result.results[0].warnings),
  )
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

})

test("ESLint reports invalid plain CSS", async () => {
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: createNagiStandaloneEslintConfigs(testSurface),
  })
  const [result] = await eslint.lintText(
    `<template><section class="test-broken-surface" /></template>
<style>.test-broken-surface { color: var(--color-text);</style>`,
    { filePath: path.join(root, "fixtures/BrokenSurface.vue") },
  )

  assert.ok(
    result.messages.some(
      ({ ruleId }) => ruleId === "nagi-css/unsupported-style-syntax",
    ),
    JSON.stringify(result.messages),
  )
})

test("ESLint allows styling an owned component root but not its inside", async () => {
  const allowed = await lintStyles(path.join(root, "fixtures/style/OwnedBoundary.vue"))
  const reachIn = await lintStyles(
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

test("ESLint checks token references against the configured sources", async () => {
  const tokens = {
    exposedPrefixes: ["--date-picker-"],
    sources: [
      { file: path.join(root, "fixtures/tokens/palette.css"), layer: "primitive" },
      { file: path.join(root, "fixtures/tokens/tokens.css"), layer: "semantic" },
    ],
  }
  const surface = await lintStyles(path.join(root, "fixtures/tokens/TokenSurface.vue"), {
    ...testSurface,
    tokens,
  })
  const violations = await lintStyles(path.join(root, "fixtures/tokens/TokenViolations.vue"), {
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

test("ESLint shares component-local token declarations across style blocks", async () => {
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: createNagiStandaloneEslintConfigs({
      ...testSurface,
      tokens: {
        sources: [
          {
            file: path.join(root, "fixtures/tokens/tokens.css"),
            layer: "semantic",
          },
        ],
      },
    }),
  })
  const [result] = await eslint.lintText(
    `<template><section class="test-multi-style" /></template>
<style>.test-multi-style { --surface-color: var(--color-surface); }</style>
<style>.test-multi-style { color: var(--surface-color); }</style>`,
    { filePath: path.join(root, "fixtures/MultiStyle.vue") },
  )

  assert.equal(result.errorCount, 0, JSON.stringify(result.messages))
})

test("ESLint leaves token references alone until a source is configured", async () => {
  const result = await lintStyles(path.join(root, "fixtures/tokens/TokenViolations.vue"), {
    ...testSurface,
  })

  assert.equal(result.errored, false, JSON.stringify(result.results[0].warnings))
})

test("ESLint requires a token for colors, with no configured source needed", async () => {
  const result = await lintStyles(path.join(root, "fixtures/tokens/RawColors.vue"), {
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

test("ESLint requires a token for lengths on scale properties only", async () => {
  const result = await lintStyles(path.join(root, "fixtures/tokens/RawLengths.vue"), {
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

test("ESLint returns a surface's stacking order to the parent, or to a token", async () => {
  const raw = await lintStyles(path.join(root, "fixtures/layout/RawStacking.vue"), {})

  // A top-layer surface owns its own stacking order, so the value is checked
  // rather than rejected; layering its own children stays a local decision.
  assert.deepEqual(
    raw.results[0].warnings.map(({ line, rule }) => [line, rule]),
    [[10, "nagi-css/stacking-token-required"]],
    JSON.stringify(raw.results[0].warnings),
  )
})

test("ESLint derives container names and keeps queries inside the file", async () => {
  const valid = await lintStyles(path.join(root, "fixtures/style/ContainerSurface.vue"), {})
  const invalid = await lintStyles(
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

test("ESLint reports unused keyframes and cascade layers inside a surface", async () => {
  const result = await lintStyles(path.join(root, "fixtures/style/MotionSurface.vue"), {})

  assert.deepEqual(
    result.results[0].warnings
      .filter(({ rule }) =>
        rule === "nagi-css/dead-keyframes" || rule === "nagi-css/cascade-layer-in-surface",
      )
      .map(({ line, rule }) => [line, rule]),
    [
      [12, "nagi-css/dead-keyframes"],
      [16, "nagi-css/cascade-layer-in-surface"],
    ],
    JSON.stringify(result.results[0].warnings),
  )
})

test("the new value and motion rules reach Svelte and Astro through the same analysis", async () => {
  for (const [name, offset] of [
    ["SvelteCard.svelte", 13],
    ["AstroCard.astro", 17],
  ]) {
    const file = path.join(root, "fixtures/framework", name)
    const code = (await fs.readFile(file, "utf8")).replace(
      "> .button {}",
      "> .button { color: #f0a; padding: 12px }",
    )
    const eslint = new ESLint({
      cwd: root,
      overrideConfigFile: true,
      overrideConfig: createNagiStandaloneEslintConfigs(testSurface),
    })
    const [result] = await eslint.lintText(code, { filePath: file })

    assert.deepEqual(
      result.messages
        .filter(({ ruleId }) =>
          ruleId === "nagi-css/value-token-required" ||
          ruleId === "nagi-css/length-token-required",
        )
        .map(({ line, ruleId }) => [line - offset, ruleId]),
      [
        [0, "nagi-css/value-token-required"],
        [0, "nagi-css/length-token-required"],
      ],
      `${name}: ${JSON.stringify(result.messages)}`,
    )
  }
})

test("a diagnostic names the token family, and says so when no layer is declared", async () => {
  const file = path.join(root, "fixtures/tokens/RawLengths.vue")
  const withoutLayer = await lintStyles(file, { ...testSurface })
  const withLayer = await lintStyles(file, {
    ...testSurface,
    tokens: {
      sources: [{ file: path.join(root, "fixtures/tokens/tokens.css"), layer: "semantic" }],
    },
  })

  const texts = (result) =>
    result.results[0].warnings
      .filter(({ rule }) => rule === "nagi-css/length-token-required")
      .map(({ text }) => text)

  // the family the property draws from, not just "use a token"
  assert.ok(texts(withoutLayer).some((text) => text.includes("raw spacing value")))
  assert.ok(texts(withoutLayer).some((text) => text.includes("(--space-*)")))
  assert.ok(texts(withoutLayer).some((text) => text.includes("(--border-width-*)")))
  assert.ok(texts(withoutLayer).some((text) => text.includes("raw type scale value")))

  // advice you cannot act on is named as such, and withdrawn once a layer exists
  assert.ok(texts(withoutLayer).every((text) => text.includes("declares no token layer")))
  assert.ok(texts(withLayer).every((text) => !text.includes("declares no token layer")))
})
