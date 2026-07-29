#!/usr/bin/env node

import path from "node:path"
import { pathToFileURL } from "node:url"

import { ESLint } from "eslint"
import stylelint from "stylelint"

import { createNagiEslintConfig, rules as eslintRules } from "@nagi-labs/eslint-plugin-nagi-css"
import {
  defineNagiConfig,
  validateNagiConfig,
  validateSeverity,
} from "@nagi-labs/nagi-css-core"
import {
  createNagiStylelintConfig,
  ruleIds as stylelintRuleIds,
} from "@nagi-labs/stylelint-plugin-nagi-css"

const knownRuleIds = [...new Set([...Object.keys(eslintRules), ...stylelintRuleIds])]

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
applies unambiguous ESLint fixed-class fixes.`
}

async function loadConfig(configPath) {
  if (!configPath) throw new Error("--config is required")
  const absolute = path.resolve(configPath)
  const module = await import(`${pathToFileURL(absolute).href}?t=${Date.now()}`)
  return module.default ?? module.config ?? module
}

async function runEslint(cwd, config, fix) {
  const files = config.eslintFiles ?? ["**/*.vue"]
  const eslint = new ESLint({
    cwd,
    errorOnUnmatchedPattern: false,
    fix,
    overrideConfigFile: true,
    overrideConfig: [
      { ignores: config.ignores ?? ["**/node_modules/**", "**/dist/**"] },
      createNagiEslintConfig(config.semantic, files, config.severity),
    ],
  })
  const results = await eslint.lintFiles(files)
  if (fix) await ESLint.outputFixes(results)
  const formatter = await eslint.loadFormatter("stylish")
  const output = formatter.format(results)
  if (output) process.stdout.write(output)
  return results.some((result) => result.errorCount > 0)
}

async function runStylelint(cwd, config) {
  const files = config.stylelintFiles ?? ["**/*.vue"]
  const result = await stylelint.lint({
    cwd,
    files,
    config: createNagiStylelintConfig(config.semantic, config.severity),
    ignorePattern: config.ignores ?? ["**/node_modules/**", "**/dist/**"],
    allowEmptyInput: true,
    formatter: "string",
  })
  if (result.report) process.stdout.write(result.report)
  return result.errored
}

export async function run(argv = process.argv.slice(2)) {
  const args = parseArgs(argv)
  if (args.command === "help") {
    process.stdout.write(`${usage()}\n`)
    return 0
  }
  if (args.command !== "check") throw new Error(`Unknown command: ${args.command}`)

  const loaded = await loadConfig(args.config)
  const semantic = defineNagiConfig(loaded.semantic)
  const severity = loaded.severity ?? {}
  const configErrors = [
    ...validateNagiConfig(semantic),
    ...validateSeverity(severity, knownRuleIds),
  ]
  if (configErrors.length > 0) {
    for (const message of configErrors) process.stderr.write(`nagi-css: ${message}\n`)
    return 2
  }

  const config = { ...loaded, semantic, severity }
  const [eslintFailed, stylelintFailed] = await Promise.all([
    runEslint(args.cwd, config, args.fix),
    runStylelint(args.cwd, config),
  ])
  return eslintFailed || stylelintFailed ? 1 : 0
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
