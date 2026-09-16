import { elementRoles } from "aria-query"

// Match semantic evidence, not Nagi's HTML-to-class aliases. Unsupported
// context/name-computation requirements stay unknown rather than being guessed.
export function matchesAriaRole(node, expected, { value, present, dynamic }) {
  if (dynamic(node, "role")) return null
  const explicit = value(node, "role")
  if (explicit) return /\s/u.test(explicit) ? null : explicit === expected
  let unknown = false
  for (const [concept, roles] of elementRoles) {
    if (concept.name !== node.tag || !roles.includes(expected)) continue
    let match = true
    let uncertain = Boolean(concept.constraints?.length)
    for (const attribute of concept.attributes ?? []) {
      if (dynamic(node, attribute.name)) {
        uncertain = true
        continue
      }
      const exists = present(node, attribute.name)
      if (attribute.value !== undefined && value(node, attribute.name) !== attribute.value) match = false
      for (const constraint of attribute.constraints ?? []) {
        if (constraint === "undefined") {
          if (exists) match = false
        } else if (constraint === "set") {
          if (!exists) match = false
          // Presence alone does not prove a resolved accessible name or list.
          if (["aria-label", "aria-labelledby", "list"].includes(attribute.name)) uncertain = true
        } else uncertain = true
      }
    }
    if (match && !uncertain) return true
    if (match) unknown = true
  }
  return unknown ? null : false
}
