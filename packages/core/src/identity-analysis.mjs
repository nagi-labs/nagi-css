import { IDENTITY_NAME } from "./definitions.mjs"

export const IDENTITY_RULES = {
  "template-parse-error": "Report templates that cannot be analyzed",
  "definition-invalid": "Reject invalid Built-in Anatomy or scoped role definition data",
  "unregistered-semantic-identity": "Report semantic names without an applicable definition",
  "scoped-role-syntax": "Require one static scope/role token in data-role",
  "dynamic-scoped-role": "Reject dynamic data-role declarations",
  "unknown-role-scope": "Require data-role scope prefixes to name loaded definitions",
  "unknown-scoped-role": "Require custom data-role names to exist in their scope",
  "scoped-role-context": "Keep each scoped role inside its matching nearest scope root",
  "scoped-role-identity-required": "Derive a residual element's base from its custom scoped role",
  "redundant-scoped-role": "Use standard HTML or WAI-ARIA semantics for native scoped roles",
  "required-role-missing": "Require a matching role declaration in each scope instance",
  "unverifiable-presence": "Report required declarations hidden by unresolved content",
  "unverifiable-role-identity": "Report ARIA naming that cannot be resolved statically",
  "identity-format": "Use a lowercase kebab-case base identity",
  "deprecated-anatomy-config": "Migrate anatomy string extensions to scoped role definitions",
}

const SCOPED_ROLE = /^([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\/([a-z][a-z0-9]*(?:-[a-z0-9]+)*)$/u

export function resolveIdentities(tree, registry, config, violations) {
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
    const identity = {
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
      role: null,
    }
    node.identity = identity
    nodes.push(identity)

    if (node.isSurface) {
      surface = node.staticBase
      identity.surface = surface
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
      identity.status = "invalid"
      markerInvalid = true
    }

    if (node.hasScopedRole) {
      const match = typeof node.scopedRole === "string" ? SCOPED_ROLE.exec(node.scopedRole) : null
      if (!match) {
        emit(
          node,
          "scoped-role-syntax",
          `Invalid data-role value ${JSON.stringify(node.scopedRole)}; use exactly one static "scope/role" token with lowercase kebab-case names.`,
        )
        identity.status = "invalid"
        markerInvalid = true
      } else {
        const [, scopeName, roleName] = match
        identity.role = roleName
        const definition = registry.scopes.get(scopeName)
        if (!definition) {
          emit(
            node,
            "unknown-role-scope",
            `data-role references unknown scope "${scopeName}".`,
          )
          identity.status = "invalid"
          markerInvalid = true
          if (roleName === "root" && rendered) {
            activeScope = {
              id: `scope:${identity.node}`,
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
            identity.status = "invalid"
            markerInvalid = true
          } else {
            activeScope = {
              id: `scope:${identity.node}`,
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
          identity.status = "invalid"
          markerInvalid = true
        } else if (!activeScope || activeScope.name !== scopeName) {
          const nearest = activeScope ? `"${activeScope.name}/root"` : "no scope root"
          emit(
            node,
            "scoped-role-context",
            `data-role="${scopeName}/${roleName}" does not match its nearest scope root (${nearest}); scoped roles cannot skip a nearer root or escape to an outer scope.`,
          )
          identity.status = "invalid"
          markerInvalid = true
        } else if (roleName === scopeName) {
          emit(
            node,
            "scoped-role-context",
            `data-role="${scopeName}/${roleName}" repeats the scope name as its local role.`,
          )
          identity.status = "invalid"
          markerInvalid = true
        } else {
          selectedRole = definition.roles.get(roleName)
          if (!selectedRole) {
            emit(
              node,
              "unknown-scoped-role",
              `Role "${roleName}" is not defined in scope "${scopeName}".`,
            )
            identity.status = "invalid"
            markerInvalid = true
          } else if (selectedRole.native) {
            emit(
              node,
              "redundant-scoped-role",
              `Role "${scopeName}/${roleName}" is native; use the matching standard HTML or WAI-ARIA semantic source without data-role.`,
            )
            identity.status = "invalid"
            markerInvalid = true
            selectedRole = null
          } else {
            identity.semanticDefinition = selectedRole.id
            activeScope.found.add(selectedRole.id)
            used.add(selectedRole.id)
          }
        }
      }
    }

    identity.scope = activeScope?.id ?? null
    identity.context = activeScope?.definition?.id ?? null

    // Standard roles are associated with the nearest scope by containment. They
    // keep their HTML/ARIA base identity and never need a redundant data-role.
    if (activeScope?.definition) {
      for (const platform of node.platformDefinitions ?? []) {
        const role = activeScope.definition.roles.get(platform.canonicalName)
        if (!role?.native) continue
        activeScope.found.add(role.id)
        used.add(role.id)
        if (!identity.semanticDefinition) identity.semanticDefinition = role.id
      }
    }

    const eligible = node.residual && !node.fixedDefinition && !node.roleUnknown
    let definition = node.fixedDefinition ?? null
    if (selectedRole && eligible && !node.isSurface && !node.opaque) {
      definition = selectedRole
      if (identity.base !== selectedRole.canonicalName) {
        emit(
          node,
          "scoped-role-identity-required",
          `data-role="${selectedRole.scope}/${selectedRole.canonicalName}" requires the base "${selectedRole.canonicalName}" on this residual element; found ${JSON.stringify(identity.base)}.`,
        )
        identity.status = "invalid"
      }
    } else if (eligible && identity.base && !node.isSurface) {
      definition = registry.anatomy.get(identity.base) ?? null
      if (
        !definition &&
        [...registry.html.values()].some((entry) => entry.canonicalName === identity.base)
      ) {
        emit(
          node,
          "reserved-element-name",
          `"${identity.base}" has a platform definition but none applicable to this node. Use the matching native element or an applicable scoped role.`,
        )
        identity.status = "invalid"
      }
    }

    if (identity.category === "internal") {
      if (node.invalidBase) identity.status = "invalid"
      if (node.roleUnknown) {
        identity.status = "unknown"
        identity.reason = "Dynamic, multiple-token, or unsupported ARIA role"
        emit(
          node,
          "unverifiable-role-identity",
          "ARIA role identity cannot be resolved from a single static identifying role; Nagi does not infer browser role fallback.",
        )
      } else if (node.invalidBase || (identity.base && !IDENTITY_NAME.test(identity.base))) {
        identity.status = "invalid"
        if (identity.base && !IDENTITY_NAME.test(identity.base)) {
          emit(
            node,
            "identity-format",
            `Invalid base identity "${identity.base}"; use lowercase kebab-case.`,
          )
        }
      } else if (definition) {
        identity.definition = definition.id
        identity.provider = definition.provider
        const predefined = ["HTML", "ARIA"].includes(definition.provider)
        identity.basis = predefined ? "platform" : "author-selected-definition"
        identity.reason = predefined
          ? "Applicable predefined platform identity"
          : "Author-selected applicable definition"
        if (identity.base === definition.canonicalName) {
          identity.classification = predefined ? "predefined" : "defined"
        } else if (identity.styled || identity.base) identity.status = "invalid"
      } else if (identity.base && config.tiers.includes(identity.base)) {
        identity.classification = "structural"
        identity.reason = "Author-selected structural tier"
      } else if (eligible && identity.base) {
        identity.classification = "unregistered"
        identity.reason = "No applicable definition"
        if (identity.status === "ok") {
          emit(
            node,
            "unregistered-semantic-identity",
            `"${identity.base}" is used as a semantic identity but has no applicable definition. Define it when its meaning is stable, or use STN when the node is structural.`,
          )
        }
      } else if (identity.styled) {
        identity.status = "unknown"
        identity.reason = "No readable static base identity"
      }
    } else {
      identity.reason = "Ownership surface or boundary; excluded from internal coverage"
    }

    if (definition && identity.base === definition.canonicalName) used.add(definition.id)
    if (activeScope && node.dynamic && !identity.base) activeScope.unknown = true

    const alternatives = node.fixedDefinition
      ? [node.fixedDefinition]
      : eligible
        ? [selectedRole, ...registry.anatomy.values()].filter(Boolean)
        : []
    for (const variant of node.variants ?? []) {
      if (!IDENTITY_NAME.test(variant.slice(1))) {
        emit(
          node,
          "identity-format",
          `Invalid variant "${variant}"; use a hyphen followed by a lowercase kebab-case name.`,
        )
      }
      if (alternatives.some((entry) => entry.canonicalName === variant.slice(1))) {
        emit(
          node,
          "variant-shadows-vocabulary",
          `Variant "${variant}" names an identity applicable to this node; choose that base when it describes the role.`,
        )
      }
      if (identity.classification === "structural") {
        candidates.push({
          node: identity.node,
          line: identity.line,
          scope: identity.scope,
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
      for (const role of activeScope.definition.roles.values()) {
        if (!role.required) continue
        const status = activeScope.found.has(role.id)
          ? "declared"
          : activeScope.unknown
            ? "unknown"
            : "missing"
        identity.constraints.push({
          definition: role.id,
          status,
          guarantee: "template-declaration-only",
        })
        if (status === "missing") {
          emit(
            node,
            "required-role-missing",
            `Required role "${activeScope.name}/${role.canonicalName}" has no matching declaration in this scope instance.`,
          )
        }
        if (status === "unknown") {
          emit(
            node,
            "unverifiable-presence",
            `Required role "${activeScope.name}/${role.canonicalName}" cannot be verified across unresolved content in this scope instance.`,
          )
        }
      }
    }

    if (markerInvalid) identity.status = "invalid"
    identity.diagnostics = violations
      .slice(firstViolation)
      .filter((entry) => entry.line === identity.line && entry.column === identity.column)
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
