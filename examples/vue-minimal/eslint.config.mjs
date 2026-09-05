import nagiCss from "@nagi-labs/eslint-plugin-nagi-css"
import pluginVue from "eslint-plugin-vue"

export default [
  ...pluginVue.configs["flat/essential"],
  ...nagiCss.configs.recommended({
    surfaceRootPrefixes: ["demo-"],
  }),
]
