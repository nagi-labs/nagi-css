import { ROLE_NAME } from "./definitions.mjs"

export const ROLE_RULES = {
  "template-parse-error": "Report templates that cannot be analyzed",
  "definition-invalid": "Reject invalid Built-in Anatomy or scoped role definition data",
  "unregistered-semantic-role": "Report semantic names without an applicable definition",
  "scoped-role-syntax": "Require one static scope/role token in data-role",
  "dynamic-scoped-role": "Reject dynamic data-role declarations",
  "unknown-role-scope": "Require data-role scope prefixes to name loaded definitions",
  "unknown-scoped-role": "Require custom data-role names to exist in their scope",
  "scoped-role-context": "Keep each scoped role inside its matching nearest scope root",
  "scoped-role-base-required": "Derive a residual element's base from its custom scoped role",
  "redundant-scoped-role": "Use standard HTML or WAI-ARIA semantics for native scoped roles",
  "required-role-missing": "Require a matching role declaration in each scope instance",
  "unverifiable-presence": "Report required declarations hidden by unresolved content",
  "unverifiable-aria-role": "Report ARIA naming that cannot be resolved statically",
  "role-format": "Use a lowercase kebab-case base role",
  "deprecated-anatomy-config": "Migrate anatomy string extensions to scoped role definitions",
  "scoped-purpose-syntax": "Require one static scope/purpose token in data-purpose",
  "dynamic-scoped-purpose": "Reject dynamic data-purpose declarations",
  "unknown-scoped-purpose": "Require purposes to exist in the referenced scope",
  "scoped-purpose-context": "Keep purposes inside the nearest matching scope",
  "purpose-variant-required": "Require the static variant declared by a purpose",
  "purpose-role-mismatch": "Check a purpose's HTML or ARIA role constraint",
  "unverifiable-purpose-role": "Report purpose constraints that cannot be checked statically",
  "required-purpose-missing": "Require a matching purpose declaration in each scope instance",
  "scoped-role-conflict": "Do not silently replace a declared custom role with a platform base",
}

const SCOPED_ROLE = /^([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\/([a-z][a-z0-9]*(?:-[a-z0-9]+)*)$/u

export function resolveRoles(tree, registry, config, violations) {
  const nodes = []
  const scopes = []
  const used = new Set()
  const candidates = []
  const emit = (node, ruleId, message) => {
    const entry = {
      ruleId,
      message,
      line: node.loc?.start.line ?? 1,
      column: node.loc?.start.column ?? 1,
    }
    violations.push(entry)
    return entry
  }
  const extras = config.anatomyClasses.filter((name) => !registry.anatomy.has(name))
  if (extras.length) {
    emit(
      tree[0] ?? {},
      "deprecated-anatomy-config",
      `anatomyClasses extensions (${extras.join(", ")}) do not define semantics. Register scoped roleDefinitions; the string API will be removed in the next major release.`,
    )
  }

  function walk(node, surface = null, activeScope = null) {
    const firstViolation = violations.length
    const roleRecord = {
      node: nodes.length,
      line: node.loc?.start.line ?? 1,
      column: node.loc?.start.column ?? 1,
      tag: node.tag,
      surface,
      base: node.staticBase ?? null,
      classification: null,
      definition: null,
      semanticDefinition: null,
      provider: null,
      scope: activeScope?.id ?? null,
      context: activeScope?.definition?.id ?? null,
      basis: null,
      reason: null,
      constraints: [],
      styled: Boolean(node.styled),
      conditional: Boolean(node.dynamicBranch),
      runtimePresence: "not-guaranteed",
      category: node.isSurface
        ? "surface"
        : node.opaque
          ? node.tag && !["slot", "template"].includes(node.tag)
            ? "boundary"
            : "unverifiable"
          : "internal",
      status: "ok",
      variants: node.variants ?? [],
      scopedRole: node.scopedRole ?? null,
      scopedPurpose: node.scopedPurpose ?? null,
      purposeDefinition: null,
      role: null,
    }
    node.roleRecord = roleRecord
    nodes.push(roleRecord)

    if (node.isSurface) {
      surface = node.staticBase
      roleRecord.surface = surface
      activeScope = null
    }
    if (node.scopeBoundary) activeScope = null

    const rendered = !node.opaque || node.opaqueKind === "component"
    let scopeHost = false
    let selectedRole = null
    let markerInvalid = false

    if (node.dynamicScopedRole) {
      emit(
        node,
        "dynamic-scoped-role",
        "data-role must be a static literal scope/role token; dynamic declarations are not allowed.",
      )
      roleRecord.status = "invalid"
      markerInvalid = true
    }

    if (node.hasScopedRole && !node.dynamicScopedRole) {
      const match = typeof node.scopedRole === "string" ? SCOPED_ROLE.exec(node.scopedRole) : null
      if (!match) {
        emit(
          node,
          "scoped-role-syntax",
          `Invalid data-role value ${JSON.stringify(node.scopedRole)}; use exactly one static "scope/role" token with lowercase kebab-case names.`,
        )
        roleRecord.status = "invalid"
        markerInvalid = true
      } else {
        const [, scopeName, roleName] = match
        roleRecord.role = roleName
        const definition = registry.scopes.get(scopeName)
        if (!definition) {
          emit(
            node,
            "unknown-role-scope",
            `data-role references unknown scope "${scopeName}".`,
          )
          roleRecord.status = "invalid"
          markerInvalid = true
          if (roleName === "root" && rendered) {
            activeScope = {
              id: `scope:${roleRecord.node}`,
              name: scopeName,
              definition: null,
              found: new Set(),
              unknown: false,
              status: "unknown",
            }
            scopes.push({ id: activeScope.id, scope: scopeName, status: "unknown" })
            scopeHost = true
          }
        } else if (roleName === "root") {
          if (!rendered) {
            emit(
              node,
              "scoped-role-context",
              `data-role="${scopeName}/root" must annotate a rendered owned element.`,
            )
            roleRecord.status = "invalid"
            markerInvalid = true
          } else {
            activeScope = {
              id: `scope:${roleRecord.node}`,
              name: scopeName,
              definition,
              found: new Set(),
              unknown: false,
              status: "resolved",
            }
            scopes.push({ id: activeScope.id, scope: scopeName, status: "resolved" })
            scopeHost = true
          }
        } else if (!rendered) {
          emit(node, "scoped-role-context", "data-role must annotate a rendered owned element.")
          roleRecord.status = "invalid"
          markerInvalid = true
        } else if (!activeScope || activeScope.name !== scopeName) {
          const nearest = activeScope ? `"${activeScope.name}/root"` : "no scope root"
          emit(
            node,
            "scoped-role-context",
            `data-role="${scopeName}/${roleName}" does not match its nearest scope root (${nearest}); scoped roles cannot skip a nearer root or escape to an outer scope.`,
          )
          roleRecord.status = "invalid"
          markerInvalid = true
        } else if (roleName === scopeName) {
          emit(
            node,
            "scoped-role-context",
            `data-role="${scopeName}/${roleName}" repeats the scope name as its local role.`,
          )
          roleRecord.status = "invalid"
          markerInvalid = true
        } else {
          selectedRole = definition.roles.get(roleName)
          if (!selectedRole) {
            emit(
              node,
              "unknown-scoped-role",
              `Role "${roleName}" is not defined in scope "${scopeName}".`,
            )
            roleRecord.status = "invalid"
            markerInvalid = true
          } else if (selectedRole.native) {
            emit(
              node,
              "redundant-scoped-role",
              `Role "${scopeName}/${roleName}" is native; use the matching standard HTML or WAI-ARIA semantic source without data-role.`,
            )
            roleRecord.status = "invalid"
            markerInvalid = true
            selectedRole = null
          } else {
            roleRecord.semanticDefinition = selectedRole.id
          }
        }
      }
    }

    roleRecord.scope = activeScope?.id ?? null
    roleRecord.context = activeScope?.definition?.id ?? null

    // Standard roles are associated with the nearest scope by containment. They
    // keep their HTML/ARIA base role and never need a redundant data-role.
    if (activeScope?.definition) {
      for (const platform of node.platformDefinitions ?? []) {
        const role = activeScope.definition.roles.get(platform.canonicalName)
        if (!role?.native) continue
        activeScope.found.add(role.id)
        used.add(role.id)
        if (!roleRecord.semanticDefinition) roleRecord.semanticDefinition = role.id
      }
    }

    const eligible = node.residual && !node.fixedDefinition && !node.roleUnknown
    let definition = node.fixedDefinition ?? null
    if (selectedRole && !selectedRole.native && (!eligible || node.isSurface) && !node.opaque && !node.roleUnknown) {
      emit(node, "scoped-role-conflict",
        `data-role="${node.scopedRole}" cannot supply its base on <${node.tag}>. Use data-purpose for a purpose on an existing role.`)
      roleRecord.status = "invalid"
      markerInvalid = true
    }
    if (selectedRole && eligible && !node.isSurface && !node.opaque) {
      definition = selectedRole
      if (roleRecord.base !== selectedRole.canonicalName) {
        emit(
          node,
          "scoped-role-base-required",
          `data-role="${selectedRole.scope}/${selectedRole.canonicalName}" requires the base "${selectedRole.canonicalName}" on this residual element; found ${JSON.stringify(roleRecord.base)}.`,
        )
        roleRecord.status = "invalid"
      }
    } else if (eligible && roleRecord.base && !node.isSurface) {
      definition = registry.anatomy.get(roleRecord.base) ?? null
      if (
        !definition &&
        [...registry.html.values()].some((entry) => entry.canonicalName === roleRecord.base)
      ) {
        emit(
          node,
          "reserved-element-name",
          `"${roleRecord.base}" has a platform definition but none applicable to this node. Use the matching native element or an applicable scoped role.`,
        )
        roleRecord.status = "invalid"
      }
    }

    if (roleRecord.category === "internal") {
      if (node.invalidBase) roleRecord.status = "invalid"
      if (node.roleUnknown) {
        roleRecord.status = "unknown"
        roleRecord.reason = "Dynamic, multiple-token, or unsupported ARIA role"
        emit(
          node,
          "unverifiable-aria-role",
          "ARIA role cannot be resolved from a single static identifying role; Nagi does not infer browser role fallback.",
        )
      } else if (node.invalidBase || (roleRecord.base && !ROLE_NAME.test(roleRecord.base))) {
        roleRecord.status = "invalid"
        if (roleRecord.base && !ROLE_NAME.test(roleRecord.base)) {
          emit(
            node,
            "role-format",
            `Invalid base role "${roleRecord.base}"; use lowercase kebab-case.`,
          )
        }
      } else if (definition) {
        roleRecord.definition = definition.id
        roleRecord.provider = definition.provider
        const predefined = ["HTML", "ARIA"].includes(definition.provider)
        roleRecord.basis = predefined ? "platform" : "author-selected-definition"
        roleRecord.reason = predefined
          ? "Applicable predefined platform role"
          : "Author-selected applicable definition"
        if (roleRecord.base === definition.canonicalName) {
          roleRecord.classification = predefined ? "predefined" : "defined"
        } else if (roleRecord.styled || roleRecord.base) roleRecord.status = "invalid"
      } else if (roleRecord.base && config.tiers.includes(roleRecord.base)) {
        roleRecord.classification = "structural"
        roleRecord.reason = "Author-selected structural tier"
      } else if (eligible && roleRecord.base) {
        roleRecord.classification = "unregistered"
        roleRecord.reason = "No applicable definition"
        if (roleRecord.status === "ok") {
          emit(
            node,
            "unregistered-semantic-role",
            `"${roleRecord.base}" is used as a semantic role but has no applicable definition. Define it when its meaning is stable, or use STN when the node is structural.`,
          )
        }
      } else if (roleRecord.styled) {
        roleRecord.status = "unknown"
        roleRecord.reason = "No readable static base role"
      }
    } else {
      roleRecord.reason = "Ownership surface or boundary; excluded from internal coverage"
    }

    if (selectedRole && !selectedRole.native && !markerInvalid && roleRecord.status === "ok") {
      activeScope.found.add(selectedRole.id)
      used.add(selectedRole.id)
    }

    const purposeError = (rule, message) => {
      emit(node, rule, message)
      markerInvalid = true
    }
    if (node.dynamicScopedPurpose) {
      purposeError("dynamic-scoped-purpose", "data-purpose must be a static literal scope/purpose token.")
    } else if (node.hasScopedPurpose) {
      const match = typeof node.scopedPurpose === "string" ? SCOPED_ROLE.exec(node.scopedPurpose) : null
      if (!match || match[2] === "root") {
        purposeError("scoped-purpose-syntax", `Invalid data-purpose value ${JSON.stringify(node.scopedPurpose)}; use one scope/purpose token, not root.`)
      } else {
        const [, scopeName, name] = match
        const scope = registry.scopes.get(scopeName)
        const purpose = scope?.purposes.get(name)
        if (!scope || !purpose) {
          purposeError("unknown-scoped-purpose", `Purpose "${node.scopedPurpose}" is not defined. Use data-role for custom roles.`)
        } else if (!rendered || activeScope?.name !== scopeName) {
          purposeError("scoped-purpose-context", `data-purpose="${node.scopedPurpose}" must annotate a rendered element in its nearest matching scope root.`)
        } else {
          roleRecord.purposeDefinition = purpose.id
          let valid = true
          if (!(node.variants ?? []).includes(`-${name}`)) {
            purposeError("purpose-variant-required", `data-purpose="${node.scopedPurpose}" requires the static variant "-${name}".`)
            valid = false
          }
          if (purpose.role) {
            const { element, aria } = purpose.role
            const ariaMatch = aria ? node.ariaRoleMatches?.[aria] : undefined
            if (node.opaque || (aria && ariaMatch == null)) {
              emit(node, "unverifiable-purpose-role", `The role constraint for "${node.scopedPurpose}" cannot be verified on this node.`)
              roleRecord.status = "unknown"
              valid = false
            } else if (element ? node.tag !== element : !ariaMatch) {
              purposeError("purpose-role-mismatch", `Purpose "${node.scopedPurpose}" requires ${element ? `<${element}>` : `the standard ARIA role "${aria}"`}.`)
              valid = false
            }
          }
          if (valid && roleRecord.status === "ok" && !markerInvalid) {
            activeScope.found.add(purpose.id)
            used.add(purpose.id)
          }
        }
      }
    }

    if (definition && roleRecord.base === definition.canonicalName) used.add(definition.id)
    if (activeScope && node.dynamic && !roleRecord.base) activeScope.unknown = true

    const alternatives = node.fixedDefinition
      ? [node.fixedDefinition]
      : eligible
        ? [selectedRole, ...registry.anatomy.values()].filter(Boolean)
        : []
    for (const variant of node.variants ?? []) {
      if (!ROLE_NAME.test(variant.slice(1))) {
        emit(
          node,
          "role-format",
          `Invalid variant "${variant}"; use a hyphen followed by a lowercase kebab-case name.`,
        )
      }
      const declaredPurpose = registry.definitions.get(roleRecord.purposeDefinition)
      if (declaredPurpose?.canonicalName !== variant.slice(1) && alternatives.some((entry) => entry.canonicalName === variant.slice(1))) {
        emit(
          node,
          "variant-shadows-vocabulary",
          `Variant "${variant}" names a role applicable to this node; choose that base when it describes the role.`,
        )
      }
      if (roleRecord.classification === "structural") {
        candidates.push({
          node: roleRecord.node,
          line: roleRecord.line,
          scope: roleRecord.scope,
          variant,
          evidence: "STN with a static modifier; semantic review required",
          automatic: false,
        })
      }
    }

    if (node.opaque) {
      if (node.opaqueKind !== "component" && activeScope && !scopeHost) activeScope.unknown = true
      for (const child of node.children) walk(child, surface, null)
    } else {
      for (const child of node.children) walk(child, surface, activeScope)
    }

    if (scopeHost && activeScope?.definition) {
      for (const role of [...activeScope.definition.roles.values(), ...activeScope.definition.purposes.values()]) {
        if (!role.required) continue
        const status = activeScope.found.has(role.id)
          ? "declared"
          : activeScope.unknown
            ? "unknown"
            : "missing"
        roleRecord.constraints.push({
          definition: role.id,
          status,
          guarantee: "template-declaration-only",
        })
        if (status === "missing") {
          emit(
            node,
            role.provider === "Purpose" ? "required-purpose-missing" : "required-role-missing",
            `Required ${role.provider === "Purpose" ? "purpose" : "role"} "${activeScope.name}/${role.canonicalName}" has no matching declaration in this scope instance.`,
          )
        }
        if (status === "unknown") {
          emit(
            node,
            "unverifiable-presence",
            `Required ${role.provider === "Purpose" ? "purpose" : "role"} "${activeScope.name}/${role.canonicalName}" cannot be verified across unresolved content in this scope instance.`,
          )
        }
      }
    }

    if (markerInvalid) roleRecord.status = "invalid"
    roleRecord.diagnostics = violations
      .slice(firstViolation)
      .filter((entry) => entry.line === roleRecord.line && entry.column === roleRecord.column)
  }

  for (const node of tree) walk(node)
  return {
    nodes,
    scopes,
    registry: [...registry.definitions.values()],
    used: [...used],
    candidates,
  }
}
