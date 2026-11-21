/**
 * src/emitA2a.js
 * Target 3: Agent2Agent (A2A) Public & Authenticated Extended AgentCards + Stripe ACP
 */

import { toKebabCase } from './validateContracts.js';

function toAgentSkill(action) {
  const modeSuffix =
    action.governance.commitMode === 'approve_1tap'
      ? " Transitions A2A TaskState to 'input-required' (or 'auth-required' above step-up threshold)."
      : action.governance.commitMode === 'queue_peer_accept'
      ? " Transitions A2A TaskState to 'working' until dual-custody peer officer countersigns."
      : '';

  return {
    id: toKebabCase(action.id),
    name: action.title,
    description: `${action.description || action.summary}${modeSuffix}`,
    tags: action.tags.length > 0 ? [...action.tags] : [action.id.split('.')[0]],
    examples: [...action.examples],
    inputModes: ['application/json', 'text/plain'],
    outputModes: ['application/json'],
  };
}

export function emitA2a(scaffold) {
  const publicActions = scaffold.actions.filter((a) =>
    a.governance.surfaces.includes('a2a_public')
  );
  const authActions = scaffold.actions.filter((a) =>
    a.governance.surfaces.includes('a2a_authenticated')
  );

  const a2aEndpoint =
    scaffold.endpoints?.a2aUrl ?? `urn:openscaffold:a2a:${scaffold.appId}`;
  const hasAcp = scaffold.actions.some((a) => Boolean(a.commerce?.acpCheckout));

  const extensions = [
    {
      uri: 'urn:openscaffold:extensions:main-street-zero-toll:v1',
      description: 'Direct merchant settlement with 0% platform commission.',
      required: false,
      params: {
        platformCommissionBps: scaffold.economics.platformCommissionBps,
      },
    },
  ];

  if (hasAcp) {
    extensions.push({
      uri: 'urn:acp:agentic-commerce:v1',
      description: 'Delegated agentic checkout settled directly to merchant Stripe Connect.',
      required: false,
    });
  }

  const publicAgentCard = {
    protocolVersion: '0.2.9',
    name: `${scaffold.displayName} Agent`,
    description:
      scaffold.description ||
      `Direct sovereign Business-to-Agent (B2A) interface for ${scaffold.displayName}.`,
    url: a2aEndpoint,
    provider: {
      organization: scaffold.provider?.organization ?? 'Open Scaffold Labs LLC',
      url: scaffold.provider?.url ?? 'urn:openscaffold:org',
    },
    version: scaffold.version,
    capabilities: {
      streaming: true,
      pushNotifications: true,
      stateTransitionHistory: true,
      extensions,
    },
    defaultInputModes: ['application/json', 'text/plain'],
    defaultOutputModes: ['application/json', 'text/plain'],
    supportsAuthenticatedExtendedCard: authActions.length > 0,
    skills: publicActions.map(toAgentSkill),
  };

  const authenticatedExtendedCard = {
    ...publicAgentCard,
    skills: [
      ...publicActions.map(toAgentSkill),
      ...authActions.map(toAgentSkill),
    ],
  };

  return { publicAgentCard, authenticatedExtendedCard };
}
