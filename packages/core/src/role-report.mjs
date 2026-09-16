import { analyzeTemplate } from "./template-analysis.mjs"
import { analyzeComponentStyles } from "./style-analysis.mjs"
import path from "node:path"

export function analyzeComponent(source, filename, config = {}) {
  let template
  try {
    template = analyzeTemplate(source, filename, config)
  } catch (error) {
    if (error.code !== "NAGI_TEMPLATE_PARSE") throw error
    return {
      sourceFile: path.resolve(filename),
      violations: [{ ruleId: "template-parse-error", message: error.message, line: 1, column: 1 }],
    }
  }
  const violations = [
    ...template.violations,
    ...analyzeComponentStyles(source, filename, config, template),
  ]
  if (violations.some((entry) => entry.ruleId === "unsupported-style-syntax")) {
    for (const entry of violations) if (entry.ruleId !== "variant-order") delete entry.fix
  }
  return { ...template, violations }
}

export function createRoleReport(analyses) {
  const files = analyses.map((analysis) => ({
    file: analysis.sourceFile,
    nodes: analysis.roles?.nodes ?? [],
    scopes: analysis.roles?.scopes ?? [],
    diagnostics: analysis.violations.map(({ ruleId, message, line, column, range }) => ({
      ruleId,
      message,
      line,
      column,
      range,
    })),
    candidates: analysis.roles?.candidates ?? [],
  }))
  const nodes = files.flatMap((file) => file.nodes)
  const styled = nodes.filter((node) => node.styled && node.category === "internal")
  const valid = styled.filter((node) => node.status === "ok" && node.classification)
  const count = (kind) => valid.filter((node) => node.classification === kind).length
  const P = count("predefined"),
    D = count("defined"),
    U = count("unregistered"),
    T = count("structural"),
    N = P + D + U + T
  const rate = (count) => ({
    count,
    total: N,
    percentage: N ? Number(((count / N) * 100).toFixed(1)) : null,
  })
  const used = new Set(analyses.flatMap((analysis) => analysis.roles?.used ?? []))
  const custom = new Map(
    analyses
      .flatMap((analysis) => analysis.roles?.registry ?? [])
      .filter((entry) => entry.provider === "Custom")
      .map((entry) => [entry.id, entry]),
  )
  const builtin = new Map(
    analyses
      .flatMap((analysis) => analysis.roles?.registry ?? [])
      .filter((entry) => entry.provider === "BuiltinAnatomy")
      .map((entry) => [entry.id, entry]),
  )
  return {
    version: 3,
    unit: "static styled internal template declaration",
    P,
    D,
    U,
    T,
    N,
    parseFailures: analyses.filter((analysis) => !analysis.roles).length,
    unverifiableNodes: nodes.filter((node) => node.status === "unknown").length,
    unverifiedScopes: files.reduce(
      (count, file) => count + file.scopes.filter((scope) => scope.status !== "resolved").length,
      0,
    ),
    predefinedRate: rate(P),
    definedRate: rate(D),
    definitionCoverage: rate(P + D),
    unregisteredRate: rate(U),
    structuralRate: rate(T),
    providers: Object.fromEntries(
      ["HTML", "ARIA", "BuiltinAnatomy", "Custom"].map((provider) => [
        provider,
        valid.filter((node) => node.provider === provider).length,
      ]),
    ),
    surfaces: nodes.filter((node) => node.category === "surface").length,
    componentBoundaries: nodes.filter((node) => node.category === "boundary").length,
    invalid: styled.filter((node) => node.status === "invalid").length,
    unknown: styled.filter(
      (node) => node.status === "unknown" || (!node.classification && node.status !== "invalid"),
    ).length,
    unstyledInternal: nodes.filter((node) => !node.styled && node.category === "internal").length,
    customDefinitions: [...custom.values()].map((entry) => ({
      ...entry,
      usage: used.has(entry.id) ? "used" : "unused",
    })),
    purposeDefinitions: [...new Map(analyses
      .flatMap((analysis) => analysis.roles?.registry ?? [])
      .filter((entry) => entry.provider === "Purpose")
      .map((entry) => [entry.id, entry])).values()].map((entry) => ({
        ...entry,
        usage: used.has(entry.id) ? "used" : "unused",
      })),
    builtinDefinitions: [...builtin.values()].map((entry) => ({
      ...entry,
      usage: used.has(entry.id) ? "used" : "unused",
    })),
    unregistered: files.flatMap((file) =>
      file.nodes
        .filter((node) => node.status === "ok" && node.classification === "unregistered")
        .map((node) => ({
          file: file.file,
          line: node.line,
          name: node.base,
          scope: node.scope,
          context: node.context,
        })),
    ),
    files,
  }
}
