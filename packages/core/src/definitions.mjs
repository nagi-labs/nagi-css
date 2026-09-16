import fs from "node:fs"
import path from "node:path"
import anatomyData from "./anatomy-definitions.json" with { type: "json" }

export const ANATOMY_DEFINITIONS = anatomyData
export const ROLE_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u

// JSON.parse alone silently discards duplicate keys. Validate the token stream
// first, keeping a separate key set for each object, including nested scopes and
// roles.
export function parseDefinitionJson(text) {
  JSON.parse(text)
  const tokens =
    text.match(/"(?:[^"\\]|\\.)*"|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\]:,]/gu) ??
    []
  let at = 0
  function value() {
    const token = tokens[at++]
    if (token === "{") {
      const keys = new Set()
      while (tokens[at] !== "}") {
        const key = JSON.parse(tokens[at++])
        if (keys.has(key)) throw new Error(`Duplicate JSON key ${JSON.stringify(key)}`)
        keys.add(key)
        at++ // colon; syntax was already checked by JSON.parse
        value()
        if (tokens[at] === ",") at++
      }
      at++
    } else if (token === "[") {
      while (tokens[at] !== "]") {
        value()
        if (tokens[at] === ",") at++
      }
      at++
    }
  }
  value()
  return JSON.parse(text)
}

export function loadRoleDefinition(file) {
  try {
    return parseDefinitionJson(fs.readFileSync(file, "utf8"))
  } catch (error) {
    throw new Error(`Cannot load role definition ${String(file)}: ${error.message}`)
  }
}

const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
const normalizedRoles = (roles) =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(roles)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, role]) => [
          name,
          { native: role.native === true, required: role.required === true, description: role.description ?? null },
        ]),
    ),
  )

export function buildDefinitionRegistry(config) {
  const definitions = new Map()
  const scopes = new Map()
  const errors = []
  const add = (entry) => {
    definitions.set(entry.id, entry)
    return entry
  }
  const make = (provider, canonicalName, context, extra = {}) =>
    add({
      id:
        provider === "Custom" && context?.startsWith("Custom:")
          ? `${context}/${canonicalName}`
          : `${provider}:${context ?? "*"}/${canonicalName}`,
      canonicalName,
      provider,
      context,
      description: null,
      examples: [],
      excludes: [],
      ...extra,
    })
  const html = new Map(
    Object.entries(config.elementClasses).map(([tag, name]) => [
      tag,
      make("HTML", name, tag, {
        description: `The configured standard role for <${tag}>.`,
      }),
    ]),
  )
  const aria = new Map(
    (config.roleNames ?? []).map((name) => [
      name,
      make("ARIA", name, "role", {
        description: `The standard WAI-ARIA ${name} role.`,
      }),
    ]),
  )
  const anatomy = new Map(
    ANATOMY_DEFINITIONS.map((data) => [
      data.canonicalName,
      make("BuiltinAnatomy", data.canonicalName, null, data),
    ]),
  )
  const standardNames = new Set([
    ...[...html.values()].map((entry) => entry.canonicalName),
    ...aria.keys(),
  ])

  const validateObject = (data, where, allowed) => {
    if (!object(data)) {
      errors.push(`${where} must be an object`)
      return false
    }
    for (const key of Object.keys(data)) {
      if (!allowed.has(key)) errors.push(`${where}.${key} is not supported`)
    }
    return true
  }

  if (!Array.isArray(config.roleDefinitions ?? [])) errors.push("roleDefinitions must be an array")
  for (const input of Array.isArray(config.roleDefinitions) ? config.roleDefinitions : []) {
    let data
    try {
      data =
        typeof input === "string"
          ? loadRoleDefinition(path.resolve(config.definitionsBaseDir ?? process.cwd(), input))
          : input
    } catch (error) {
      errors.push(error.message)
      continue
    }
    if (!validateObject(data, "role definition", new Set(["$schema", "version", "scopes"])))
      continue
    if (data.$schema !== undefined && typeof data.$schema !== "string")
      errors.push("role definition.$schema must be a string")
    if (data.version !== 1)
      errors.push(`Unsupported role definition version ${JSON.stringify(data.version)}`)
    if (!object(data.scopes)) {
      errors.push("role definition.scopes must be an object")
      continue
    }

    for (const [scopeName, scopeData] of Object.entries(data.scopes)) {
      const where = `scope ${JSON.stringify(scopeName)}`
      if (!ROLE_NAME.test(scopeName) || config.tiers.includes(scopeName)) {
        errors.push(`Invalid or structural scope name ${JSON.stringify(scopeName)}`)
        continue
      }
      if (!validateObject(scopeData, where, new Set(["roles", "purposes"]))) continue
      if ((!object(scopeData.roles) && scopeData.roles !== undefined) ||
          (!object(scopeData.purposes) && scopeData.purposes !== undefined) ||
          (scopeData.roles === undefined && scopeData.purposes === undefined)) {
        errors.push(`${where} must contain a roles or purposes object`)
        continue
      }

      const validRoles = {}
      for (const [roleName, roleData] of Object.entries(scopeData.roles ?? {})) {
        const roleWhere = `${where}.roles.${JSON.stringify(roleName)}`
        if (
          !ROLE_NAME.test(roleName) ||
          config.tiers.includes(roleName) ||
          roleName === "root" ||
          roleName === scopeName
        ) {
          errors.push(
            roleName === "root"
              ? `${roleWhere}: root is reserved and must not be declared`
              : roleName === scopeName
                ? `${roleWhere}: a scope and one of its local roles must not have the same name`
                : `${roleWhere}: invalid or structural role name`,
          )
          continue
        }
        if (!validateObject(roleData, roleWhere, new Set(["native", "required", "description"]))) continue
        if (roleData.description !== undefined &&
            (typeof roleData.description !== "string" || !roleData.description.trim()))
          errors.push(`${roleWhere}.description must be a non-empty string`)
        if (roleData.native !== undefined && typeof roleData.native !== "boolean")
          errors.push(`${roleWhere}.native must be a boolean`)
        if (roleData.required !== undefined && typeof roleData.required !== "boolean")
          errors.push(`${roleWhere}.required must be a boolean`)
        if (!standardNames.has(roleName) && roleData.native === true)
          errors.push(`${roleWhere} declares native: true but has no matching standard role`)
        validRoles[roleName] = {
          description: roleData.description ?? null,
          native: roleData.native === true,
          required: roleData.required === true,
        }
      }

      const validPurposes = {}
      for (const [name, purpose] of Object.entries(scopeData.purposes ?? {})) {
        const at = `${where}.purposes.${JSON.stringify(name)}`
        if (!ROLE_NAME.test(name) || name === "root" || config.tiers.includes(name)) {
          errors.push(`${at}: invalid or reserved purpose name`)
          continue
        }
        if (!validateObject(purpose, at, new Set(["description", "required", "role"]))) continue
        if (purpose.description !== undefined &&
            (typeof purpose.description !== "string" || !purpose.description.trim()))
          errors.push(`${at}.description must be a non-empty string`)
        if (purpose.required !== undefined && typeof purpose.required !== "boolean")
          errors.push(`${at}.required must be a boolean`)
        let role = null
        if (purpose.role !== undefined) {
          if (!object(purpose.role) || Object.keys(purpose.role).length !== 1 ||
              !("element" in purpose.role || "aria" in purpose.role)) {
            errors.push(`${at}.role must specify exactly one element or aria name`)
          } else {
            const [source, name] = Object.entries(purpose.role)[0]
            if (typeof name !== "string" || !(source === "element" ? html : aria).has(name) ||
                (source === "aria" && ["generic", "none", "presentation"].includes(name)))
              errors.push(`${at}.role.${source} must name an existing identifying ${source} source`)
            else role = { [source]: name }
          }
        }
        validPurposes[name] = {
          description: purpose.description ?? null,
          required: purpose.required === true,
          role,
        }
      }

      const signature = JSON.stringify([
        normalizedRoles(validRoles),
        Object.entries(validPurposes).sort(([a], [b]) => a.localeCompare(b)),
      ])
      const existing = scopes.get(scopeName)
      if (existing) {
        if (existing.signature !== signature)
          errors.push(`Conflicting role definitions for scope ${JSON.stringify(scopeName)}`)
        continue
      }

      const scope = {
        id: `Custom:${scopeName}`,
        name: scopeName,
        roles: new Map(),
        purposes: new Map(),
        signature,
      }
      scopes.set(scopeName, scope)
      for (const [roleName, roleData] of Object.entries(validRoles)) {
        const role = make("Custom", roleName, scope.id, {
          scope: scopeName,
          native: roleData.native,
          required: roleData.required,
          description: roleData.description,
        })
        scope.roles.set(roleName, role)
      }
      for (const [name, data] of Object.entries(validPurposes)) {
        const purpose = make("Purpose", name, scope.id, { scope: scopeName, ...data })
        scope.purposes.set(name, purpose)
      }
    }
  }
  return { definitions, scopes, html, aria, anatomy, standardNames, errors }
}
