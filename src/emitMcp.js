/**
 * src/emitMcp.js
 * Target 2: Model Context Protocol (MCP) tools/list + ID-JAG Auth + Windows 11 ODR Connector
 */

import { toSnakeCase } from './validateContracts.js';

function toJsonSchema202012(schema, isRoot = false) {
  if (!schema || typeof schema !== 'object') return schema;
  const { entityRef, ...rest } = schema;
  const node = isRoot
    ? { $schema: 'https://json-schema.org/draft/2020-12/schema', ...rest }
    : { ...rest };
  if (node.properties) {
    const properties = {};
    for (const [k, v] of Object.entries(node.properties)) {
      properties[k] = toJsonSchema202012(v, false);
    }
    node.properties = properties;
  }
  return node;
}

export function emitMcp(scaffold) {
  const mcpActions = scaffold.actions.filter((a) =>
    a.governance.surfaces.includes('mcp')
  );

  const resourceUri =
    scaffold.endpoints?.mcpUrl ?? `urn:openscaffold:mcp:${scaffold.appId}`;

  const tools = mcpActions.map((action) => ({
    name: toSnakeCase(action.id),
    description: action.description || action.summary,
    annotations: {
      title: action.title,
      readOnlyHint: action.semantics.readOnly,
      destructiveHint: action.semantics.readOnly ? false : action.semantics.destructive,
      idempotentHint: action.semantics.idempotent,
      openWorldHint: action.semantics.openWorld,
    },
    inputSchema: toJsonSchema202012(action.input, true),
    ...(action.output ? { outputSchema: toJsonSchema202012(action.output, false) } : {}),
    _meta: {
      'osl/contractId': action.id,
      'osl/commitMode': action.governance.commitMode,
      'osl/requiredRoles': [...action.governance.roles],
      'osl/dataClass': action.governance.dataClass,
      'osl/vconPolicyDecision': action.audit.recordPolicyDecision,
    },
  }));

  const mcpManifest = {
    serverInfo: {
      name: `${scaffold.appId}-mcp`,
      title: `${scaffold.displayName} MCP Server`,
      version: scaffold.version,
    },
    serverCapabilities: {
      tools: { listChanged: false },
      extensions: {
        'io.modelcontextprotocol/enterprise-managed-authorization': {
          tokenType: 'urn:ietf:params:oauth:token-type:id-jag',
          grantType: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          resource: resourceUri,
        },
      },
    },
    tools,
  };

  const windowsOdrManifest = {
    schemaVersion: '1.0',
    connectorId: `com.openscaffoldlabs.${scaffold.appId.replace(/-/g, '')}.mcp`,
    displayName: `${scaffold.displayName} Windows ODR Connector`,
    transport: { type: 'streamable-http', url: resourceUri },
    isolation: { sandboxed: true, auditLoggingRequired: true },
    toolSummary: tools.map((t) => ({
      name: t.name,
      readOnly: t.annotations.readOnlyHint,
      destructive: t.annotations.destructiveHint,
    })),
  };

  return { mcpManifest, windowsOdrManifest };
}
