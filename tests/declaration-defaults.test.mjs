import assert from "node:assert/strict"
import test from "node:test"
import { analyzeComponent, defineNagiConfig, validateNagiConfig } from "@nagi-labs/nagi-css-core"

const definition = (kind, fields) => ({ version: 1, scopes: { sample: { [kind]: { marker: fields } } } })
const config = (definitions) => defineNagiConfig({ surfaceRootPrefixes: ["app-"], roleDefinitions: definitions })
const source = '<template><div class="app-example" data-role="sample/root"></div></template>'

test("required implementation declarations survive transparent Motion wrappers and conditional visibility", () => {
  const input = '<template><div class="app-example" data-role="sample/root"><MotionConfig><AnimatePresence><motion.div v-if="open" class="marker" data-role="sample/marker"><slot /></motion.div></AnimatePresence></MotionConfig></div></template>'
  const options = config([definition("roles", { layer: "implementation", declaration: "required" })])
  options.transparentComponents = ["MotionConfig", "AnimatePresence"]
  options.intrinsicComponents = { "motion.div": "div" }
  const result = analyzeComponent(input, "/example.vue", options)
  assert.deepEqual(result.violations, [])
  const absent = analyzeComponent(input.replace('data-role="sample/marker"', ""), "/example.vue", options)
  assert.ok(absent.violations.some((entry) => entry.ruleId === "unverifiable-presence" && entry.message.includes("sample/marker")))
})

for (const kind of ["roles", "purposes"]) {
  test(`${kind} default to implementation and optional declarations`, () => {
    const result = analyzeComponent(source, "/example.vue", config([definition(kind, {})]))
    assert.deepEqual(result.violations, [])
    const entry = result.roles.registry.find((entry) => entry.scope === "sample" && entry.canonicalName === "marker")
    assert.equal(entry.layer, "implementation")
    assert.equal(entry.declaration, "optional")
  })

  test(`${kind} layer and declaration are independent`, () => {
    for (const layer of ["contract", "implementation"]) {
      for (const declaration of ["required", "optional"]) {
        const result = analyzeComponent(source, "/example.vue", config([definition(kind, { layer, declaration })]))
        assert.equal(result.violations.some((entry) => entry.ruleId === (kind === "roles" ? "required-role-missing" : "required-purpose-missing")), declaration === "required")
      }
    }
  })

  test(`${kind} reject invalid fields and contradictory compatibility declarations`, () => {
    for (const fields of [{ layer: null }, { layer: "other" }, { declaration: true }, { declaration: "always" }, { required: true, declaration: "optional" }, { required: false, declaration: "required" }]) {
      assert.ok(validateNagiConfig(config([definition(kind, fields)])).length, JSON.stringify(fields))
    }
  })

  test(`${kind} composition normalizes defaults and preserves layer differences`, () => {
    assert.deepEqual(validateNagiConfig(config([definition(kind, {}), definition(kind, { layer: "implementation", declaration: "optional" })])), [])
    assert.deepEqual(validateNagiConfig(config([definition(kind, { required: true }), definition(kind, { declaration: "required" })])), [])
    assert.ok(validateNagiConfig(config([definition(kind, {}), definition(kind, { layer: "contract" })])).some((message) => message.includes("Conflicting")))
  })
}
