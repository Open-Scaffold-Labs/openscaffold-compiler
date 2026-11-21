/**
 * src/emitVoice.js
 * Target 1: @openscaffold/voice v1.0.0 Realtime S2S + Rung 0 Grammar + Pre-Session RBAC Matrix
 */

import { toSnakeCase } from './validateContracts.js';

function sanitizeRealtimeParameters(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  const { entityRef, title, ...rest } = schema;
  if (rest.properties) {
    const properties = {};
    for (const [k, v] of Object.entries(rest.properties)) {
      properties[k] = sanitizeRealtimeParameters(v);
    }
    rest.properties = properties;
  }
  return rest;
}

export function emitVoice(scaffold) {
  const voiceActions = scaffold.actions.filter((a) =>
    a.governance.surfaces.includes('voice')
  );

  const permissionMatrix = {};
  const tools = [];

  for (const action of voiceActions) {
    const toolName = toSnakeCase(action.id);

    for (const role of action.governance.roles) {
      if (!permissionMatrix[role]) {
        permissionMatrix[role] = [];
      }
      if (!permissionMatrix[role].includes(toolName)) {
        permissionMatrix[role].push(toolName);
      }
    }

    tools.push({
      name: toolName,
      contractId: action.id,
      version: action.version,
      commitMode: action.governance.commitMode,
      dataClass: action.governance.dataClass,
      zdrRequired: action.governance.dataClass === 'restricted',
      routeRung: action.voice.routeRung,
      minConfidence: action.voice.minConfidence,
      earcon: action.voice.earcon,
      teamWhisperChannel: action.voice.teamWhisperChannel,
      stepUp: action.governance.stepUp,
      deterministicPatterns: [...action.voice.deterministicPatterns],
      keyterms: [...action.voice.keyterms],
      ledger: action.ledger ?? null,
      realtimeDeclaration: {
        type: 'function',
        name: toolName,
        description: action.description || action.summary,
        parameters: sanitizeRealtimeParameters(action.input),
      },
    });
  }

  return {
    schemaVersion: '1.0.0',
    appId: scaffold.appId,
    economics: scaffold.economics,
    permissionMatrix,
    tools,
  };
}

export function buildAuthorizedRealtimeTools(voiceManifest, badgeRole) {
  const allowed = new Set(voiceManifest.permissionMatrix?.[badgeRole] ?? []);
  return voiceManifest.tools
    .filter((tool) => allowed.has(tool.name))
    .map((tool) => tool.realtimeDeclaration);
}
