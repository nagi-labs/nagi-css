#!/usr/bin/env node

import path from "node:path"
import { pathToFileURL } from "node:url"

import { ESLint } from "eslint"

import {
  createNagiStandaloneEslintConfigs,
  rules as eslintRules,
} from "@nagi-labs/eslint-plugin-nagi-css"
import {
  defineNagiConfig,
  validateNagiConfig,
  validateSeverity,
} from "@nagi-labs/nagi-css-core"

const knownRuleIds = Object.keys(eslintRules)

function parseArgs(argv) {
  const args = { command: "check", config: null, cwd: process.cwd(), fix: false }
  const values = [...argv]
  if (values[0] && !values[0].startsWith("-")) args.command = values.shift()

  while (values.length > 0) {
    const value = values.shift()
    if (value === "--config") args.config = values.shift() ?? null
    else if (value === "--cwd") args.cwd = path.resolve(values.shift() ?? ".")
    else if (value === "--fix") args.fix = true
    else if (value === "--help" || value === "-h") args.command = "help"
    else throw new Error(`Unknown argument: ${value}`)
  }

  return args
}

function usage() {
  return `Usage:
  nagi-css check --config <external-config.mjs> --cwd <target-directory> [--fix]

The configuration file may live outside the target repository. --fix only
applies fixes whose correct output the contract can derive.`
}

async function loadConfig(configPath) {
  if (!configPath) throw new Error("--config is required")
  const absolute = path.resolve(configPath)
  const module = await import(`${pathToFileURL(absolute).href}?t=${Date.now()}`)
  return module.default ?? module.config ?? module
}

async function runEslint(cwd, config, fix) {
  const files = config.files ?? ["**/*.{vue,svelte,astro}"]
  const eslint = new ESLint({
    cwd,
    errorOnUnmatchedPattern: false,
    fix,
    overrideConfigFile: true,
    overrideConfig: [
      { ignores: config.ignores ?? ["**/node_modules/**", "**/dist/**"] },
      ...createNagiStandaloneEslintConfigs(config.semantic, {
        severity: config.severity,
      }),
    ],
  })
  const results = await eslint.lintFiles(files)
  if (fix) await ESLint.outputFixes(results)
  return results.flatMap((result) =>
    result.messages.map((message) => ({
      column: message.column ?? 1,
      file: result.filePath,
      line: message.line ?? 1,
      rule: message.ruleId ?? "eslint",
      severity: message.severity === 1 ? "warning" : "error",
      text: message.message,
    })),
  )
}

// Paths relative to the target, sorted by position, with one summary line.
function formatReport(diagnostics, cwd) {
  const byFile = new Map()
  for (const diagnostic of diagnostics) {
    const name = diagnostic.file ? path.relative(cwd, diagnostic.file) : "<unknown>"
    if (!byFile.has(name)) byFile.set(name, [])
    byFile.get(name).push(diagnostic)
  }

  const lines = []
  for (const name of [...byFile.keys()].sort()) {
    const entries = byFile
      .get(name)
      .sort((a, b) => a.line - b.line || a.column - b.column || a.rule.localeCompare(b.rule))
    lines.push("", name)
    const width = Math.max(...entries.map((entry) => `${entry.line}:${entry.column}`.length))
    for (const entry of entries) {
      const at = `${entry.line}:${entry.column}`.padEnd(width)
      const mark = entry.severity === "warning" ? "warning" : "error  "
      lines.push(`  ${at}  ${mark}  ${entry.text}  ${entry.rule}`)
    }
  }

  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length
  const warnings = diagnostics.length - errors
  if (diagnostics.length > 0) {
    lines.push(
      "",
      `${diagnostics.length} problem${diagnostics.length === 1 ? "" : "s"} (${errors} error${
        errors === 1 ? "" : "s"
      }, ${warnings} warning${warnings === 1 ? "" : "s"})`,
      "",
    )
  }
  return lines.join("\n")
}

export async function run(
  argv = process.argv.slice(2),
  output = { stderr: process.stderr, stdout: process.stdout },
) {
  const args = parseArgs(argv)
  if (args.command === "help") {
    output.stdout.write(`${usage()}\n`)
    return 0
  }
  if (args.command !== "check") throw new Error(`Unknown command: ${args.command}`)

  const loaded = await loadConfig(args.config)
  const semantic = defineNagiConfig(loaded.semantic)
  // Token sources are written relative to the application being checked, not to
  // wherever the external config file happens to live.
  semantic.tokens = {
    ...semantic.tokens,
    sources: (semantic.tokens.sources ?? []).map((source) => ({
      ...source,
      file: source?.file ? path.resolve(args.cwd, source.file) : source?.file,
    })),
  }
  const severity = loaded.severity ?? {}
  const configErrors = [
    ...validateNagiConfig(semantic),
    ...validateSeverity(severity, knownRuleIds),
  ]
  if (configErrors.length > 0) {
    for (const message of configErrors) output.stderr.write(`nagi-css: ${message}\n`)
    return 2
  }

  const config = { ...loaded, semantic, severity }
  const diagnostics = await runEslint(args.cwd, config, args.fix)
  const report = formatReport(diagnostics, args.cwd)
  if (report) output.stdout.write(`${report}\n`)
  return diagnostics.some((diagnostic) => diagnostic.severity === "error") ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run()
    .then((code) => {
      process.exitCode = code
    })
    .catch((error) => {
      process.stderr.write(`nagi-css: ${error instanceof Error ? error.message : String(error)}\n`)
      process.exitCode = 2
    })
}
