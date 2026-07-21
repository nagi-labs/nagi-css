import vueParser from "vue-eslint-parser"
import typescriptParser from "@typescript-eslint/parser"

import {
  analyzeVueTemplate,
  defineNagiConfig,
  validateNagiConfig,
} from "@nagi-labs/nagi-css-core"

const analysisCache = new WeakMap()

const ruleDescriptions = {
  "anatomy-allowed": "Allow only contract anatomy, role, element, component, and STN names",
  "component-class-required": "Require configured static component classes when styled",
  "dynamic-class-requires-static-anchor":
    "Require a static owned class beside every dynamic class binding",
  "element-class-required": "Require configured static element classes when styled",
  "reserved-element-name": "Reserve rendered element names for their mapped elements",
  "single-base-identity": "Allow exactly one base identity class per element",
  "state-not-class": "Represent runtime state with native, ARIA, or data attributes",
  "surface-root-name":
    "Derive component and page surface names from the configured prefix and Vue file",
  "stn-floor": "Start each STN chain at zone or a coarser tier",
  "stn-order": "Keep adjacent STN tiers consecutive",
  "stn-reach-g": "Make surfaces above zone reach the g tier",
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
    analyses.set(
      key,
      analyzeVueTemplate(sourceCode.text, context.filename, config),
    )
  }
  return analyses.get(key)
}

function createAnalysisRule(ruleId) {
  return {
    meta: {
      type: ruleId === "variant-order" ? "layout" : "problem",
      docs: { description: ruleDescriptions[ruleId] },
      fixable:
        ruleId === "element-class-required" || ruleId === "component-class-required"
          ? "code"
          : undefined,
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
              loc: {
                start: {
                  line: violation.line,
                  column: Math.max(0, violation.column - 1),
                },
              },
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
  meta: { name: "@nagi-labs/eslint-plugin-nagi-css", version: "0.0.0" },
  rules,
}

export function createNagiEslintConfig(config, files = ["**/*.vue"]) {
  const semantic = defineNagiConfig(config)
  const enabledRules = Object.fromEntries(
    Object.keys(rules).map((ruleId) => [`nagi-css/${ruleId}`, ["error", semantic]]),
  )
  return {
    files,
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        ecmaVersion: "latest",
        extraFileExtensions: [".vue"],
        parser: typescriptParser,
        sourceType: "module",
      },
    },
    plugins: { "nagi-css": plugin },
    rules: enabledRules,
  }
}

export { rules }
export default plugin
