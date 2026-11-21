/**
 * src/validateContracts.js
 * Constitutional schema definitions & validator for scaffold.config.js.
 */

export const COMMIT_MODES = Object.freeze([
  'instant_read',
  'auto_3s',
  'approve_1tap',
  'queue_peer_accept',
]);

export const VOICE_ROUTE_RUNGS = Object.freeze([
  'rung0_deterministic',
  'rung1_economy_s2s',
  'rung2_flagship_s2s',
]);

export const DATA_CLASSES = Object.freeze(['public', 'internal', 'restricted']);

export const SURFACES = Object.freeze([
  'voice',
  'mcp',
  'a2a_public',
  'a2a_authenticated',
  'apple_app_intents',
  'android_app_functions',
]);

export const LEDGER_BOOKS = Object.freeze(['gaap', 'tax', 'trust', 'fund']);

export const FORBIDDEN_IDENTITY_PARAMS = Object.freeze([
  'user_id',
  'actor_id',
  'tenant_id',
  'badge_role',
  'role',
  'api_key',
  'jwt',
  'access_token',
]);

export function toSnakeCase(id) {
  return String(id).replace(/[.-]/g, '_');
}

export function toKebabCase(id) {
  return String(id).replace(/[._]/g, '-');
}

export function toPascalCase(str) {
  return String(str)
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export function toCamelCase(str) {
  const pascal = toPascalCase(str);
  return pascal ? pascal.charAt(0).toLowerCase() + pascal.slice(1) : '';
}

export function defineEconomics(econ = {}) {
  return Object.freeze({
    model: econ.model ?? 'main_street_steward_coop',
    membershipAnnualCents: econ.membershipAnnualCents ?? 14900,
    seatFeeCents: econ.seatFeeCents ?? 0,
    platformCommissionBps: econ.platformCommissionBps ?? 0,
    aiComputeMarkupBps: econ.aiComputeMarkupBps ?? 0,
    allowTenantByok: econ.allowTenantByok ?? true,
    dataExitFeeCents: econ.dataExitFeeCents ?? 0,
    collaboratorShareBps: econ.collaboratorShareBps ?? 3500,
    infrastructureReserveBps: econ.infrastructureReserveBps ?? 4500,
    mainStreetCommonsBps: econ.mainStreetCommonsBps ?? 2000,
  });
}

export function defineEntity(entity) {
  if (!entity || typeof entity.id !== 'string' || !entity.id.trim()) {
    throw new Error('defineEntity requires a non-empty string id.');
  }
  return Object.freeze({
    ...entity,
    spotlightIndexed: entity.spotlightIndexed ?? true,
    properties: { ...(entity.properties ?? {}) },
  });
}

export function defineAction(action) {
  if (!action || typeof action.id !== 'string') {
    throw new Error('defineAction requires an id in "domain.verb_noun" format.');
  }
  const semantics = Object.freeze({
    readOnly: Boolean(action.semantics?.readOnly),
    destructive: Boolean(action.semantics?.destructive),
    idempotent: action.semantics?.idempotent ?? true,
    openWorld: Boolean(action.semantics?.openWorld),
  });
  const governance = Object.freeze({
    commitMode:
      action.governance?.commitMode ?? (semantics.readOnly ? 'instant_read' : 'approve_1tap'),
    roles: Object.freeze([...(action.governance?.roles ?? [])]),
    dataClass: action.governance?.dataClass ?? 'internal',
    surfaces: Object.freeze([...(action.governance?.surfaces ?? ['voice', 'mcp'])]),
    stepUp: action.governance?.stepUp ? Object.freeze({ ...action.governance.stepUp }) : null,
  });
  const voice = Object.freeze({
    routeRung: action.voice?.routeRung ?? 'rung1_economy_s2s',
    deterministicPatterns: Object.freeze([...(action.voice?.deterministicPatterns ?? [])]),
    keyterms: Object.freeze([...(action.voice?.keyterms ?? [])]),
    minConfidence: action.voice?.minConfidence ?? 0.72,
    earcon: action.voice?.earcon ?? 'chime_soft',
    teamWhisperChannel: action.voice?.teamWhisperChannel ?? null,
  });
  const audit = Object.freeze({
    emitVcon: action.audit?.emitVcon ?? true,
    recordPolicyDecision: action.audit?.recordPolicyDecision ?? true,
    retentionDays: action.audit?.retentionDays ?? 2555,
  });

  return Object.freeze({
    ...action,
    version: action.version ?? '1.0.0',
    tags: Object.freeze([...(action.tags ?? [])]),
    examples: Object.freeze([...(action.examples ?? [])]),
    semantics,
    governance,
    voice,
    audit,
  });
}

export function defineScaffold(config) {
  const scaffold = {
    ...config,
    version: config?.version ?? '1.0.0',
    economics: defineEconomics(config?.economics),
    entities: config?.entities ?? {},
    actions: (config?.actions ?? []).map((a) => defineAction(a)),
  };
  validateContracts(scaffold);
  return Object.freeze(scaffold);
}

/**
 * Validates constitutional RBAC, commit-mode, schema, and Main Street Anti-Tollbooth rules.
 */
export function validateContracts(scaffold) {
  const errors = [];

  if (!scaffold || typeof scaffold.appId !== 'string' || !scaffold.appId.trim()) {
    errors.push('Scaffold manifest requires a non-empty appId.');
  }
  if (!scaffold || typeof scaffold.displayName !== 'string' || !scaffold.displayName.trim()) {
    errors.push('Scaffold manifest requires a non-empty displayName.');
  }

  const econ = scaffold?.economics;
  if (econ && (econ.model === 'main_street_steward_coop' || econ.model === 'main_street_utility')) {
    if (econ.platformCommissionBps !== 0) {
      errors.push(`Economics violation: platformCommissionBps must be 0 (got ${econ.platformCommissionBps}).`);
    }
    if (econ.seatFeeCents !== 0) {
      errors.push(`Economics violation: seatFeeCents must be 0 (got ${econ.seatFeeCents}).`);
    }
    if (econ.aiComputeMarkupBps !== 0) {
      errors.push(`Economics violation: aiComputeMarkupBps must be 0 (got ${econ.aiComputeMarkupBps}).`);
    }
    if (econ.allowTenantByok !== true) {
      errors.push('Economics violation: allowTenantByok must be true.');
    }
    if (econ.dataExitFeeCents !== 0) {
      errors.push('Economics violation: dataExitFeeCents must be 0.');
    }
    const totalBps =
      (econ.collaboratorShareBps ?? 0) +
      (econ.infrastructureReserveBps ?? 0) +
      (econ.mainStreetCommonsBps ?? 0);
    if (totalBps !== 10000) {
      errors.push(`Economics violation: steward split basis points must sum to 10000 (got ${totalBps}).`);
    }
  }

  const seenIds = new Set();
  for (const action of scaffold?.actions ?? []) {
    const label = `Action "${action.id}"`;

    if (!/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/.test(action.id)) {
      errors.push(`${label}: id must match "domain.verb_noun" snake_case format.`);
    }
    if (seenIds.has(action.id)) {
      errors.push(`${label}: duplicate action id.`);
    }
    seenIds.add(action.id);

    const { governance, semantics, input, ledger, voice } = action;

    if (!COMMIT_MODES.includes(governance?.commitMode)) {
      errors.push(`${label}: invalid commitMode "${governance?.commitMode}".`);
    }
    if (!DATA_CLASSES.includes(governance?.dataClass)) {
      errors.push(`${label}: invalid dataClass "${governance?.dataClass}".`);
    }
    if (!Array.isArray(governance?.roles) || governance.roles.length === 0) {
      errors.push(`${label}: governance.roles must contain at least one badge role.`);
    }
    for (const surface of governance?.surfaces ?? []) {
      if (!SURFACES.includes(surface)) {
        errors.push(`${label}: unsupported surface "${surface}".`);
      }
    }

    if (governance?.surfaces?.includes('a2a_public') && governance.dataClass !== 'public') {
      errors.push(`${label}: dataClass "${governance.dataClass}" cannot be exposed on "a2a_public".`);
    }

    if (!semantics?.readOnly && governance?.commitMode === 'instant_read') {
      errors.push(`${label}: mutating actions (readOnly: false) cannot use commitMode "instant_read".`);
    }

    if (
      governance?.commitMode === 'queue_peer_accept' &&
      governance?.stepUp?.dualCustodySelfAccept === true
    ) {
      errors.push(`${label}: queue_peer_accept forbids dualCustodySelfAccept: true.`);
    }

    const props = input?.properties ?? {};
    for (const [propName, propSchema] of Object.entries(props)) {
      if (FORBIDDEN_IDENTITY_PARAMS.includes(propName.toLowerCase())) {
        errors.push(
          `${label}: input.properties.${propName} is forbidden; inject caller identity from session/ID-JAG.`
        );
      }
      if (propSchema?.entityRef && !scaffold.entities?.[propSchema.entityRef]) {
        errors.push(
          `${label}: input.properties.${propName} references undeclared entity "${propSchema.entityRef}".`
        );
      }
    }

    if (ledger) {
      if (!Array.isArray(ledger.books) || ledger.books.length === 0) {
        errors.push(`${label}: ledger.books must declare at least one book.`);
      } else {
        for (const book of ledger.books) {
          if (!LEDGER_BOOKS.includes(book)) {
            errors.push(`${label}: invalid ledger book "${book}".`);
          }
        }
      }
      if (!semantics?.readOnly) {
        const keyField = ledger.idempotencyKeyField;
        if (!keyField || !props[keyField]) {
          errors.push(
            `${label}: mutating ledger actions require ledger.idempotencyKeyField present in input.properties.`
          );
        }
      }
    }

    if (!VOICE_ROUTE_RUNGS.includes(voice?.routeRung)) {
      errors.push(`${label}: invalid voice.routeRung "${voice?.routeRung}".`);
    }
    if (
      typeof voice?.minConfidence !== 'number' ||
      voice.minConfidence < 0 ||
      voice.minConfidence > 1
    ) {
      errors.push(`${label}: voice.minConfidence must be between 0.0 and 1.0.`);
    }
  }

  if (errors.length > 0) {
    const err = new Error(`Contract validation failed:\n- ${errors.join('\n- ')}`);
    err.validationErrors = errors;
    throw err;
  }

  return { valid: true, actionCount: (scaffold.actions ?? []).length };
}
