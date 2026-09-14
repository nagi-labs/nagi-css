import { loadRoleDefinition } from "@nagi-labs/nagi-css-core"

export default {
  files: ["examples/custom-roles/*.{vue,svelte,astro}"],
  semantic: {
    surfaceRootPrefixes: ["app-"],
    roleDefinitions: [loadRoleDefinition(new URL("./definitions/range.json", import.meta.url))],
  },
}
