import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { analyzeVueTemplate, resolveSeverity } from "@nagi-labs/nagi-css-core"

// An example has to be free of violations; a coverage warning is not one. The
// README's icon binding is deliberately unreadable, and saying so is correct.
const levelFor = resolveSeverity()

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

// CONTRIBUTING promises that documentation markup is checked the same way
// application code is. An example opts in with a comment naming the file it
// stands for, so the surface root can be derived:
//
//   <!-- nagi-check file=src/components/UserCard.vue prefix=app- -->
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
  const skills = await fs.readdir(path.join(repository, "skills/nagi-css/references"), {
    recursive: true,
  })
  return [
    ...roots,
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
      assert.equal(language, "vue", `${file}: only vue blocks can be checked`)
      checked += 1

      const componentSlots = {}
      for (const entry of options.slots?.split(",") ?? []) {
        const [target, className] = entry.split("=")
        const [component, slot] = target.split(".")
        componentSlots[component] = { ...componentSlots[component], [slot]: className }
      }

      const { violations } = analyzeVueTemplate(block, `/${options.file}`, {
        surfaceRootPrefixes: [options.prefix ?? "app-"],
        ...(options.components ? { componentClasses: options.components.split(",") } : {}),
        ...(Object.keys(componentSlots).length > 0 ? { componentSlots } : {}),
        ...(options.emit ? { emitPolicy: options.emit } : {}),
      })
      for (const violation of violations) {
        if (levelFor(violation.ruleId) !== "error") continue
        failures.push(`${file} (${options.file}) ${violation.ruleId}: ${violation.message}`)
      }
    }
  }

  assert.deepEqual(failures, [])
  assert.ok(checked > 0, "no annotated examples were found")
})
