import fs from "node:fs"
import path from "node:path"

import postcssHtml from "postcss-html"
import stylelint from "stylelint"

import {
  analyzeStyleRoot,
  analyzeTemplate,
  defineNagiConfig,
  emptyTemplateContext,
  resolveSeverity,
  STYLE_RULE_IDS,
  validateNagiConfig,
} from "@nagi-labs/nagi-css-core"

const COMPONENT_EXTENSIONS = new Set([".astro", ".svelte", ".vue"])
const analysisCache = new WeakMap()

function findInputFile(root, fallback) {
  let filename = root.source?.input.file
  if (filename) return filename
  for (const node of root.nodes ?? []) {
    filename ??= node.source?.input.file
  }
  root.walkRules((rule) => {
    filename ??= rule.source?.input.file
  })
  return filename ?? fallback
}

function readTemplateContext(root, config, fallbackFile) {
  const filename = findInputFile(root, fallbackFile)
  if (!filename || !COMPONENT_EXTENSIONS.has(path.extname(filename).toLowerCase())) {
    return emptyTemplateContext()
  }
  try {
    return analyzeTemplate(fs.readFileSync(filename, "utf8"), filename, config)
  } catch {
    return emptyTemplateContext()
  }
}

function cachedAnalysis(root, config, fallbackFile) {
  let analyses = analysisCache.get(root)
  if (!analyses) {
    analyses = new Map()
    analysisCache.set(root, analyses)
  }
  const key = JSON.stringify(config)
  if (!analyses.has(key)) {
    const templateContext = readTemplateContext(root, config, fallbackFile)
    analyses.set(
      key,
      templateContext.styleBlocks?.length > 0
        ? []
        : analyzeStyleRoot(root, config, templateContext),
    )
  }
  return analyses.get(key)
}

function createRule(ruleId) {
  const ruleName = `nagi-css/${ruleId}`
  return stylelint.createPlugin(ruleName, (enabled, options = {}) => {
    return (root, result) => {
      if (!enabled) return
      const { severity: _severity, ...semanticOptions } = options
      const config = defineNagiConfig(semanticOptions)
      if (ruleId === "valid-config") {
        for (const message of validateNagiConfig(config)) {
          stylelint.utils.report({
            message: `Invalid Nagi CSS configuration: ${message}.`,
            node: root,
            result,
            ruleName,
          })
        }
        return
      }
      for (const violation of cachedAnalysis(root, config, result.opts?.from)) {
        if (violation.ruleId !== ruleId) continue
        stylelint.utils.report({
          message: violation.message,
          node: violation.node,
          result,
          ruleName,
          word: violation.word,
        })
      }
    }
  })
}

export const ruleIds = [...STYLE_RULE_IDS, "valid-config"]
const plugins = Object.fromEntries(ruleIds.map((ruleId) => [ruleId, createRule(ruleId)]))

export function createNagiStylelintConfig(config, severity = {}) {
  const semantic = defineNagiConfig(config)
  const levelFor = resolveSeverity(severity)
  return {
    customSyntax: postcssHtml,
    plugins: Object.values(plugins),
    rules: Object.fromEntries(
      ruleIds
        .map((ruleId) => [ruleId, levelFor(ruleId)])
        .filter(([, level]) => level !== "off")
        .map(([ruleId, level]) => [
          `nagi-css/${ruleId}`,
          level === "warn" ? [true, { ...semantic, severity: "warning" }] : [true, semantic],
        ]),
    ),
  }
}

export { plugins }
export default Object.values(plugins)
