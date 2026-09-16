import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"

import {
  analyzeComponentStyles,
  analyzeTemplate,
  defineNagiConfig,
  parseTokenDeclarations,
  resolveSeverity,
  ANATOMY_DEFINITIONS,
} from "@nagi-labs/nagi-css-core"

// An example has to be free of violations; a coverage warning is not one. The
// README's icon binding is deliberately unreadable, and saying so is correct.
const levelFor = resolveSeverity()

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

// CONTRIBUTING promises that documentation markup is checked the same way
// application code is. An example opts in with a comment naming the file it
// stands for, so the surface root can be derived:
//
//   <!-- nagi-check file=src/components/user-card.vue prefix=app- -->
//
// Optional keys: prefix (default app-), components (comma-separated library
// components), slots (Component.slot=class, comma-separated), emit (emitPolicy).
const ANNOTATION = /<!--\s*nagi-check\s+([^>]*?)-->\s*\n```(\w+)\n([\s\S]*?)```/g

function parseAnnotation(raw) {
  const options = {}
  for (const pair of raw.trim().split(/\s+/)) {
    // Only the first `=` separates key from value, so `slots=Card.content=x` works.
    const at = pair.indexOf("=")
    if (at === -1) continue
    options[pair.slice(0, at)] = pair.slice(at + 1)
  }
  return options
}

async function markdownFiles() {
  const roots = ["CONTRACT.md", "README.md", "FAQ.md", "CONTRIBUTING.md"]
  const docs = await fs.readdir(path.join(repository, "docs"), { recursive: true })
  const skills = await fs.readdir(path.join(repository, "skills/nagi-css/references"), {
    recursive: true,
  })
  return [
    ...roots,
    ...docs.filter((name) => name.endsWith(".md")).map((name) => path.join("docs", name)),
    ...skills
      .filter((name) => name.endsWith(".md"))
      .map((name) => path.join("skills/nagi-css/references", name)),
  ]
}

test("every annotated documentation example passes the linter", async () => {
  const files = await markdownFiles()
  const failures = []
  let checked = 0

  for (const file of files) {
    const source = await fs.readFile(path.join(repository, file), "utf8")
    for (const [, raw, language, block] of source.matchAll(ANNOTATION)) {
      const options = parseAnnotation(raw)
      assert.ok(options.file, `${file}: nagi-check needs file=`)
      const extension = path.extname(options.file).slice(1)
      assert.equal(language, extension, `${file}: block language must match file extension`)
      checked += 1

      const componentSlots = {}
      for (const entry of options.slots?.split(",") ?? []) {
        const [target, className] = entry.split("=")
        const [component, slot] = target.split(".")
        componentSlots[component] = { ...componentSlots[component], [slot]: className }
      }

      const config = {
        surfaceRootPrefixes: [options.prefix ?? "app-"],
        ...(options.components ? { componentClasses: options.components.split(",") } : {}),
        ...(Object.keys(componentSlots).length > 0 ? { componentSlots } : {}),
        ...(options.emit ? { emitPolicy: options.emit } : {}),
      }
      const template = analyzeTemplate(block, `/${options.file}`, config)
      const violations = [
        ...template.violations,
        ...analyzeComponentStyles(block, `/${options.file}`, config, template),
      ]
      for (const violation of violations) {
        if (levelFor(violation.ruleId) !== "error") continue
        failures.push(`${file} (${options.file}) ${violation.ruleId}: ${violation.message}`)
      }
    }
  }

  assert.deepEqual(failures, [])
  assert.ok(checked > 0, "no annotated examples were found")
})

test("the documentation site uses the Nagi CSS logo as its favicon and header mark", async () => {
  const [html, logo] = await Promise.all([
    fs.readFile(path.join(repository, "docs/index.html"), "utf8"),
    fs.readFile(path.join(repository, "docs/nagi-css.svg"), "utf8"),
  ])

  assert.match(html, /<link rel="icon" href="nagi-css\.svg" type="image\/svg\+xml">/)
  assert.match(html, /<img class="image" src="nagi-css\.svg" alt="Nagi CSS">/)
  assert.match(logo, /<svg[^>]+viewBox="0 0 64 64"/)
})

test("the documentation site introduces vocabulary and links to its definition guide", async () => {
  const html = await fs.readFile(path.join(repository, "docs/index.html"), "utf8")
  assert.ok(html.includes("Built-in and custom meanings"))
  assert.ok(html.includes("define your own component-scoped vocabulary"))
  assert.match(html, /href="https:\/\/github\.com\/nagi-labs\/nagi-css\/blob\/main\/docs\/definitions\.md">How to define roles/)
  const guide = await fs.readFile(path.join(repository, "docs/definitions.md"), "utf8")
  assert.ok(guide.includes('data-role="range/root"'))
  assert.ok(guide.includes('data-role="range/fill"'))
  assert.ok(html.includes("0.7.0 definition and measure APIs"))
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]))
  // Inspect real start tags, not escaped markup displayed in code examples.
  const tags = html.match(/<[a-z][^>]*>/gi) ?? []
  for (const [, target] of tags.join("\n").matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    if (target.startsWith("#")) {
      assert.ok(ids.has(target.slice(1)), `Missing site anchor ${target}`)
    } else if (!/^(?:[a-z]+:|\/\/)/i.test(target)) {
      await fs.access(path.resolve(repository, "docs", target.split(/[?#]/)[0]))
    }
  }
})

// The starter block is the only place a value ships, and only as a placeholder.
// If it drifts from the table, a project that pastes it gets unknown-token on a
// name the contract told it to use.
test("the getting-started token file declares exactly the names the table promises", async () => {
  const guide = await fs.readFile(path.join(repository, "docs/getting-started/index.md"), "utf8")
  const block = guide.match(/into `src\/tokens\/semantic\.css`[\s\S]*?```css\n([\s\S]*?)```/)

  assert.ok(block, "getting-started no longer contains the starter token file")

  const declared = parseTokenDeclarations(block[1])
  const promised = Object.values(
    defineNagiConfig({ surfaceRootPrefixes: ["app-"] }).tokens.semantic,
  )
    .flat()
    .sort()

  assert.deepEqual([...declared].sort(), promised)
})

test("portable agent guidance matches the paragraph and text roles", async () => {
  const [agents, naming, pattern] = await Promise.all([
    fs.readFile(path.join(repository, "AGENTS.md"), "utf8"),
    fs.readFile(path.join(repository, "skills/nagi-css/references/naming-flow.md"), "utf8"),
    fs.readFile(
      path.join(repository, "skills/nagi-css/references/patterns/loading-error-empty.md"),
      "utf8",
    ),
  ])
  const config = defineNagiConfig({ surfaceRootPrefixes: ["app-"] })

  assert.equal(config.elementClasses.p, "p")
  assert.ok(config.anatomyClasses.includes("text"))
  assert.match(agents, /`p` → `p`/)
  const anatomy = await fs.readFile(path.join(repository, "docs/anatomy-definitions.md"), "utf8")
  assert.deepEqual(
    config.anatomyClasses,
    ANATOMY_DEFINITIONS.map((entry) => entry.canonicalName),
  )
  for (const definition of ANATOMY_DEFINITIONS) {
    assert.ok(anatomy.includes(definition.description))
  }
  assert.doesNotMatch(agents, /\| `p` \| `text` \|/)
  assert.match(naming, /A prose paragraph is `<p class="p">`/)
  assert.match(pattern, /self-mapped `p` role/)
})

test("Skill and built-in anatomy guidance are generated from canonical sources", () => {
  execFileSync(process.execPath, ["scripts/generate-definition-docs.mjs", "--check"], {
    cwd: repository,
  })
})
