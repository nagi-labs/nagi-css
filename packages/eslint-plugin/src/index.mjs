import vueParser from "vue-eslint-parser"

import {
  analyzeComponentStyles,
  analyzeTemplate,
  astroParser,
  defineNagiConfig,
  resolveSeverity,
  svelteParser,
  STYLE_RULE_DESCRIPTIONS,
  typescriptParser,
  validateNagiConfig,
  validateSeverity,
} from "@nagi-labs/nagi-css-core"

const analysisCache = new WeakMap()

// Rules whose correct output the contract computes, so the linter can write it.
// Everything else needs a decision the tool cannot make.
const FIXABLE_RULES = new Set([
  "component-class-required",
  "element-class-required",
  "owned-component-identity",
  "stn-floor",
  "stn-order",
  "surface-root-name",
  "variant-order",
])

const ruleDescriptions = {
  ...STYLE_RULE_DESCRIPTIONS,
  "anatomy-allowed": "Allow only contract anatomy, role, element, component, and STN names",
  "component-class-required": "Require configured static component classes when styled",
  "dynamic-class-requires-static-anchor":
    "Require a static owned class beside every dynamic class binding",
  "element-class-required": "Require configured static element classes when styled",
  "reserved-element-name": "Reserve rendered element names for their mapped elements",
  "owned-component-identity":
    "Style an owned child component by its own derived surface root, not a passed class",
  "single-base-identity": "Allow exactly one base identity class per element",
  "state-not-class": "Represent runtime state with native, ARIA, or data attributes",
  "surface-root-name":
    "Derive component and page surface names from the configured prefix and component file",
  "stn-floor": "Start each STN chain at unit or a coarser tier",
  "stn-order": "Keep adjacent STN tiers consecutive",
  "stn-reach-g": "Make surfaces above unit reach the g tier",
  "unsupported-style-syntax":
    "Report style blocks the toolchain cannot read instead of skipping them",
  "unverifiable-dynamic-class":
    "Report class bindings whose class names the toolchain cannot read",
  "variant-must-be-static":
    "Keep variants out of class bindings, so a variant cannot express runtime state",
  "variant-order": "Keep static variant classes in alphabetical order",
  "variant-shadows-vocabulary":
    "Keep variant names outside the element, component, anatomy, STN, slot, and ARIA role vocabulary",
}

function cachedAnalysis(context, config) {
  const sourceCode = context.sourceCode
  let analyses = analysisCache.get(sourceCode)
  if (!analyses) {
    analyses = new Map()
    analysisCache.set(sourceCode, analyses)
  }
  const key = JSON.stringify(config)
  if (!analyses.has(key)) {
    const template = analyzeTemplate(sourceCode.text, context.filename, config)
    analyses.set(key, {
      ...template,
      violations: [
        ...template.violations,
        ...analyzeComponentStyles(
          sourceCode.text,
          context.filename,
          config,
          template,
        ),
      ],
    })
  }
  return analyses.get(key)
}

function violationLoc(sourceCode, violation) {
  if (violation.range) {
    return {
      start: sourceCode.getLocFromIndex(violation.range[0]),
      end: sourceCode.getLocFromIndex(violation.range[1]),
    }
  }
  return {
    start: {
      line: violation.line,
      column: Math.max(0, violation.column - 1),
    },
  }
}

function createAnalysisRule(ruleId) {
  return {
    meta: {
      type: ruleId === "variant-order" ? "layout" : "problem",
      docs: { description: ruleDescriptions[ruleId] },
      fixable: FIXABLE_RULES.has(ruleId) ? "code" : undefined,
      schema: [{ type: "object" }],
      messages: { violation: "{{message}}" },
    },
    create(context) {
      const config = defineNagiConfig(context.options[0])
      return {
        "Program:exit"() {
          const analysis = cachedAnalysis(context, config)
          for (const violation of analysis.violations) {
            if (violation.ruleId !== ruleId) continue
            context.report({
              loc: violationLoc(context.sourceCode, violation),
              messageId: "violation",
              data: { message: violation.message },
              fix: violation.fix
                ? (fixer) => fixer.replaceTextRange(violation.fix.range, violation.fix.text)
                : undefined,
            })
          }
        },
      }
    },
  }
}

const rules = Object.fromEntries(
  Object.keys(ruleDescriptions).map((ruleId) => [ruleId, createAnalysisRule(ruleId)]),
)

rules["valid-config"] = {
  meta: {
    type: "problem",
    docs: { description: "Validate Nagi CSS surface, component, and slot configuration" },
    schema: [{ type: "object" }],
    messages: { invalid: "{{message}}" },
  },
  create(context) {
    const errors = validateNagiConfig(defineNagiConfig(context.options[0]))
    return {
      Program(node) {
        for (const message of errors) {
          context.report({ node, messageId: "invalid", data: { message } })
        }
      },
    }
  },
}

const plugin = {
  meta: { name: "@nagi-labs/eslint-plugin-nagi-css", version: "0.1.0" },
  rules,
}

const frameworkParsers = {
  astro: { extension: ".astro", parser: astroParser },
  svelte: { extension: ".svelte", parser: svelteParser },
  vue: { extension: ".vue", parser: vueParser },
}

function enabledRules(config, severity) {
  const semantic = defineNagiConfig(config)
  const severityErrors = validateSeverity(severity, Object.keys(rules))
  if (severityErrors.length > 0) {
    throw new Error(`Invalid Nagi CSS severity: ${severityErrors.join("; ")}`)
  }
  const levelFor = resolveSeverity(severity)
  return Object.fromEntries(
    Object.keys(rules)
      .map((ruleId) => [ruleId, levelFor(ruleId)])
      .filter(([, level]) => level !== "off")
      .map(([ruleId, level]) => [`nagi-css/${ruleId}`, [level, semantic]]),
  )
}

// The normal integration deliberately owns neither the parser nor framework
// globals. Vue, Nuxt, Svelte, and Astro official presets remain the source of
// truth for those settings; Nagi CSS only adds its files, plugin, and rules.
export function createNagiEslintConfig(
  config,
  {
    files = ["**/*.{astro,svelte,vue}"],
    ignores,
    severity = {},
  } = {},
) {
  return {
    name: "nagi-css/recommended",
    files,
    ...(ignores ? { ignores } : {}),
    plugins: { "nagi-css": plugin },
    rules: enabledRules(config, severity),
  }
}

function standaloneEslintConfig(config, files, severity, framework) {
  const adapter = frameworkParsers[framework]
  if (!adapter) throw new Error(`Unsupported template framework: ${framework}`)
  return {
    ...createNagiEslintConfig(config, { files, severity }),
    name: `nagi-css/standalone/${framework}`,
    languageOptions: {
      parser: adapter.parser,
      parserOptions: {
        ecmaVersion: "latest",
        extraFileExtensions: [adapter.extension],
        parser: typescriptParser,
        sourceType: "module",
      },
    },
  }
}

// Used by the standalone CLI and by plugin tests. Application configs should use
// `configs.recommended()` so the framework's official parser remains in charge.
export function createNagiStandaloneEslintConfigs(
  config,
  { files = {}, severity = {} } = {},
) {
  return [
    standaloneEslintConfig(config, files.vue ?? ["**/*.vue"], severity, "vue"),
    standaloneEslintConfig(config, files.svelte ?? ["**/*.svelte"], severity, "svelte"),
    standaloneEslintConfig(config, files.astro ?? ["**/*.astro"], severity, "astro"),
  ]
}

plugin.configs = {
  recommended(config, options) {
    return [createNagiEslintConfig(config, options)]
  },
}

export { rules }
export default plugin
