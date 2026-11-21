#!/usr/bin/env node
/**
 * @openscaffold/compiler — Automated 50-App Fleet Rollout CLI (`v1.0.0`)
 *
 * Pairs directly with `@openscaffold/voice/bin/rollout-fleet.mjs`:
 *   1. Vendors `packages/openscaffold-compiler` (and sibling `packages/openscaffold-guild` when present)
 *      without mutating `package-lock.json` (`npm ci` safe).
 *   2. Synthesizes a vertical-tailored `scaffold.config.js` manifest (covering `instant_read`,
 *      public Door-1 `a2a_public`, 3s `"Scratch that"` `auto_3s`, and `approve_1tap` / dual-custody
 *      `queue_peer_accept` with 4-book SHA-256 ledger hooks).
 *   3. Compiles all 5 deterministic targets into `./generated/` (`voice.actions.json`, `mcp.tools.json`,
 *      `windows-odr.manifest.json`, public & authenticated `A2A` Agent Cards, Swift `AppIntents` + `SKILL.md`,
 *      and Android 16+ Kotlin `AppFunctions` + XML).
 *   4. Wires `server/src/services/openscaffold-compiler.js`, `server/src/routes/action-surfaces.js`,
 *      `server/src/index.js` (`/.well-known/agent.json`, `/mcp`, `/api/action-surfaces`), and `vercel.json`.
 *
 * Usage:
 *   node bin/rollout-compiler-fleet.mjs /Users/daleraaen/Projects --dry-run
 *   node bin/rollout-compiler-fleet.mjs /Users/daleraaen/Projects/OpenLandscapeArchitect
 *   node bin/rollout-compiler-fleet.mjs /Users/daleraaen/Projects --commit --push
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  defineScaffold,
  defineEntity,
  defineAction,
  compileScaffold,
  toPascalCase,
} from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PKG_SOURCE_DIR = path.resolve(__dirname, '..');
const SIBLING_GUILD_DIR = path.resolve(PKG_SOURCE_DIR, '..', 'openscaffold-guild');

export const COMPILER_ENGINE_LABEL =
  '@openscaffold/compiler v1.0.0 (5-target Action Contract compiler + executeActionEnvelope)';
export const COMPILER_ENGINE_VERSION = '1.0.0';

export const VERTICAL_COMPILER_BLUEPRINTS = Object.freeze({
  'open-restaurant': {
    verticalId: 'open-restaurant',
    appName: 'OpenRestaurant',
    domain: 'restaurant',
    roles: ['hostess', 'server', 'runner', 'bartender', 'cook', 'chef', 'manager', 'owner', 'admin'],
    supervisoryRoles: ['manager', 'owner', 'admin'],
    ledgerBooks: ['gaap', 'tax'],
    internalDataClass: 'internal',
    highStakesCommitMode: 'approve_1tap',
    entityId: 'MenuItem',
    entityTitle: 'Menu Catalog Item',
    publicBookingTitle: 'Reserve Dining Table',
    publicBookingSummary: 'Books a direct guest dining reservation on the restaurant schedule.',
    keyterms: ['PMIX', '86', 'patio', 'comp', 'Prime Cost'],
  },
  'open-landscape-architect': {
    verticalId: 'open-landscape-architect',
    appName: 'OpenLandscapeArchitect',
    domain: 'landscape_arch',
    roles: ['project_designer', 'planting_specialist', 'construction_admin', 'principal_architect', 'owner', 'admin'],
    supervisoryRoles: ['principal_architect', 'owner', 'admin'],
    ledgerBooks: ['gaap', 'tax'],
    internalDataClass: 'internal',
    highStakesCommitMode: 'approve_1tap',
    entityId: 'DesignMilestone',
    entityTitle: 'Studio SD/DD/CD Phase Milestone',
    publicBookingTitle: 'Request Site Consultation',
    publicBookingSummary: 'Books a property walkthrough and site consultation directly with the studio.',
    keyterms: ['schematic design', 'planting schedule', 'specimen tree', 'drip zone', 'punchlist'],
  },
  'open-landscape-business': {
    verticalId: 'open-landscape-business',
    appName: 'OpenLandscapeBusiness',
    domain: 'landscape_ops',
    roles: ['estimator', 'crew_lead', 'irrigation_tech', 'arborist', 'fleet_coordinator', 'operations_manager', 'owner', 'admin'],
    supervisoryRoles: ['operations_manager', 'owner', 'admin'],
    ledgerBooks: ['gaap', 'tax'],
    internalDataClass: 'internal',
    highStakesCommitMode: 'approve_1tap',
    entityId: 'WorkOrder',
    entityTitle: 'Field Route Work Order',
    publicBookingTitle: 'Request Property Estimate',
    publicBookingSummary: 'Schedules an on-site maintenance or hardscape estimate directly with the crew office.',
    keyterms: ['route sheet', 'solenoid', 'mulch', 'arborist', 'progress billing'],
  },
  'open-hoa': {
    verticalId: 'open-hoa',
    appName: 'OpenHOA',
    domain: 'hoa',
    roles: ['concierge', 'maintenance_tech', 'architectural_reviewer', 'community_manager', 'treasurer', 'board_president', 'admin'],
    supervisoryRoles: ['treasurer', 'board_president'],
    ledgerBooks: ['gaap', 'trust', 'fund'],
    internalDataClass: 'internal',
    highStakesCommitMode: 'queue_peer_accept',
    entityId: 'ReserveAccount',
    entityTitle: 'Association CIRA Reserve Fund',
    publicBookingTitle: 'Submit Vendor Bid or Clubhouse Request',
    publicBookingSummary: 'Submits a local vendor bid or neighborhood amenity booking request.',
    keyterms: ['reserve study', 'Davis-Stirling', 'ARC submittal', 'operating fund', 'assessment'],
  },
  'open-dentist': {
    verticalId: 'open-dentist',
    appName: 'OpenDentist',
    domain: 'dentist',
    roles: ['front_desk', 'dental_assistant', 'hygienist', 'dentist', 'treatment_coordinator', 'office_manager', 'owner', 'admin'],
    supervisoryRoles: ['dentist', 'office_manager', 'owner', 'admin'],
    ledgerBooks: ['gaap', 'tax'],
    internalDataClass: 'restricted',
    highStakesCommitMode: 'approve_1tap',
    entityId: 'OperatorySlot',
    entityTitle: 'Clinical Operatory Appointment',
    publicBookingTitle: 'Book Hygiene or New-Patient Visit',
    publicBookingSummary: 'Requests a hygiene cleaning or periodic exam slot directly with the practice.',
    keyterms: ['operatory', 'prophy', 'perio chart', 'crown prep', 'sterilization'],
  },
  'open-firehouse': {
    verticalId: 'open-firehouse',
    appName: 'OpenFirehouse',
    domain: 'firehouse',
    roles: ['dispatcher', 'apparatus_operator', 'firefighter', 'paramedic', 'company_officer', 'battalion_chief', 'admin'],
    supervisoryRoles: ['paramedic', 'company_officer', 'battalion_chief'],
    ledgerBooks: ['gaap', 'fund'],
    internalDataClass: 'internal',
    highStakesCommitMode: 'queue_peer_accept',
    entityId: 'ApparatusUnit',
    entityTitle: 'Station Apparatus & ALS Rig',
    publicBookingTitle: 'Request Station Tour or Burn Permit Check',
    publicBookingSummary: 'Schedules a community fire-safety inspection or station education visit.',
    keyterms: ['rig check', 'SCBA', 'ALS seal', 'battalion', 'turnout gear'],
  },
  'open-cpa': {
    verticalId: 'open-cpa',
    appName: 'OpenCPA',
    domain: 'cpa',
    roles: ['intake_coordinator', 'bookkeeper', 'tax_preparer', 'audit_senior', 'tax_manager', 'managing_partner', 'admin'],
    supervisoryRoles: ['tax_manager', 'managing_partner', 'admin'],
    ledgerBooks: ['gaap', 'tax', 'trust'],
    internalDataClass: 'restricted',
    highStakesCommitMode: 'approve_1tap',
    entityId: 'EngagementBinder',
    entityTitle: 'Client 4-Book Tax & Audit Binder',
    publicBookingTitle: 'Schedule Advisory Intake Call',
    publicBookingSummary: 'Books a client tax or CAS onboarding consultation directly with the firm.',
    keyterms: ['Schedule M-1', 'PTET', 'K-1', 'provenance', 'trial balance'],
  },
  'open-church': {
    verticalId: 'open-church',
    appName: 'OpenChurch',
    domain: 'church',
    roles: ['hospitality_lead', 'ministry_coordinator', 'parish_admin', 'finance_steward', 'pastor', 'admin'],
    supervisoryRoles: ['finance_steward', 'pastor'],
    ledgerBooks: ['gaap', 'fund'],
    internalDataClass: 'internal',
    highStakesCommitMode: 'queue_peer_accept',
    entityId: 'MinistryFund',
    entityTitle: 'ASC 958 Designated Ministry Fund',
    publicBookingTitle: 'RSVP Community Gathering or Facility Request',
    publicBookingSummary: 'Registers for a parish event or community hall reservation.',
    keyterms: ['designated fund', 'check-in', 'stewardship', 'fellowship', 'vestry'],
  },
  'open-service-pro': {
    verticalId: 'open-service-pro',
    appName: 'OpenServicePro',
    domain: 'service_pro',
    roles: ['dispatcher', 'field_tech', 'parts_manager', 'service_manager', 'owner', 'admin'],
    supervisoryRoles: ['service_manager', 'owner', 'admin'],
    ledgerBooks: ['gaap', 'tax'],
    internalDataClass: 'internal',
    highStakesCommitMode: 'approve_1tap',
    entityId: 'DispatchJob',
    entityTitle: 'Field Service Dispatch Ticket',
    publicBookingTitle: 'Book Priority Field Service Window',
    publicBookingSummary: 'Books a residential or commercial technician arrival window directly with dispatch.',
    keyterms: ['truck stock', 'capacitor', 'dispatch board', 'diagnostic', 'warranty'],
  },
});

export function resolveVerticalIdFromName(rawName) {
  const clean = String(rawName || '')
    .trim()
    .replace(/^@[^/]+\//, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();

  const aliases = {
    'open-golf': 'open-golf-course-os',
    'open-landscape': 'open-landscape-business',
    'open-property': 'open-property-developer',
    'open-property-manager': 'open-property-developer',
    'recipe-composer': 'fusion-recipe-builder',
  };
  return aliases[clean] || clean || 'open-scaffold-app';
}

export function sanitizeDomainPrefix(verticalId) {
  const stripped = String(verticalId || 'app')
    .replace(/^open-/, '')
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  if (!stripped || !/^[a-z]/.test(stripped)) {
    return `osl_${stripped || 'app'}`;
  }
  return stripped;
}

export function resolveVerticalCompilerBlueprint(rawName) {
  const verticalId = resolveVerticalIdFromName(rawName);
  if (VERTICAL_COMPILER_BLUEPRINTS[verticalId]) {
    return VERTICAL_COMPILER_BLUEPRINTS[verticalId];
  }
  const appName =
    String(rawName || '')
      .trim()
      .replace(/[^a-zA-Z0-9]/g, '') || toPascalCase(verticalId);
  const domain = sanitizeDomainPrefix(verticalId);

  return {
    verticalId,
    appName,
    domain,
    roles: ['intake', 'specialist', 'lead', 'manager', 'owner', 'admin'],
    supervisoryRoles: ['manager', 'owner', 'admin'],
    ledgerBooks: ['gaap', 'tax'],
    internalDataClass: 'internal',
    highStakesCommitMode: 'approve_1tap',
    entityId: 'ServiceRecord',
    entityTitle: `${appName} Operational Record`,
    publicBookingTitle: `Book Direct ${appName} Appointment`,
    publicBookingSummary: `Books a direct client appointment or intake slot with ${appName}.`,
    keyterms: [appName, 'schedule', 'intake', 'approval', 'margin'],
  };
}

export function buildStarterScaffoldObject(rawName, overrides = {}) {
  const bp = resolveVerticalCompilerBlueprint(overrides.verticalId || rawName);
  const appId = bp.verticalId;
  const displayName = overrides.appName || bp.appName;
  const domain = bp.domain;
  const bundleSlug = appId.replace(/[^a-z0-9]/g, '');

  return defineScaffold({
    appId,
    displayName,
    version: overrides.version || '1.0.0',
    description: `Sovereign Main Street operations, Role-Expert Voice Co-Pilot, and 5-door agentic interface for ${displayName}.`,
    bundleId: {
      ios: `com.openscaffoldlabs.${bundleSlug}`,
      android: `com.openscaffoldlabs.${bundleSlug}`,
    },
    endpoints: {
      apiBaseUrl: `urn:openscaffold:api:${appId}`,
      mcpUrl: `urn:openscaffold:mcp:${appId}`,
      a2aUrl: `urn:openscaffold:a2a:${appId}`,
    },
    economics: {
      model: 'main_street_steward_coop',
      membershipAnnualCents: 14900,
      seatFeeCents: 0,
      platformCommissionBps: 0,
      aiComputeMarkupBps: 0,
      allowTenantByok: true,
      dataExitFeeCents: 0,
      collaboratorShareBps: 3500,
      infrastructureReserveBps: 4500,
      mainStreetCommonsBps: 2000,
    },
    entities: {
      [bp.entityId]: defineEntity({
        id: bp.entityId,
        title: bp.entityTitle,
        description: `Primary domain record managed inside ${displayName}.`,
        properties: {
          id: { type: 'string', title: 'Record ID' },
          name: { type: 'string', title: 'Display Label' },
          amountCents: { type: 'integer', title: 'Value (Cents)' },
        },
      }),
    },
    actions: [
      // 1. instant_read — Rung 0 Operational & Margin Pulse
      defineAction({
        id: `${domain}.get_operational_pulse`,
        title: `Get ${displayName} Operational Pulse`,
        summary: `Returns live shift queue, staffing, and margin summary for ${displayName}.`,
        description: `Queries real-time operational readiness, open items, and financial summary for ${displayName}.`,
        tags: ['pulse', 'reporting', domain],
        examples: [`Give me today's ${displayName} shift pulse.`],
        semantics: { readOnly: true, destructive: false, idempotent: true, openWorld: false },
        governance: {
          commitMode: 'instant_read',
          roles: [...bp.roles, 'team_reviewer'],
          dataClass: bp.internalDataClass,
          surfaces: ['voice', 'mcp', 'a2a_authenticated', 'apple_app_intents', 'android_app_functions'],
        },
        voice: {
          routeRung: 'rung0_deterministic',
          deterministicPatterns: ['give me today shift pulse', 'show operational pulse for {window}'],
          keyterms: bp.keyterms,
          minConfidence: 0.68,
        },
        input: {
          type: 'object',
          additionalProperties: false,
          required: ['window'],
          properties: {
            window: {
              type: 'string',
              enum: ['today', 'last_7_days', 'month_to_date'],
              title: 'Reporting Window',
              description: 'Time window for operational aggregation.',
            },
          },
        },
        output: {
          type: 'object',
          required: ['status', 'active_items'],
          properties: {
            status: { type: 'string', title: 'Operational Status' },
            active_items: { type: 'integer', title: 'Active Queue Count' },
          },
        },
      }),

      // 2. Public Door-1 Sovereign Customer / Peer A2A Booking (/.well-known/agent.json)
      defineAction({
        id: `${domain}.request_direct_booking`,
        title: bp.publicBookingTitle,
        summary: bp.publicBookingSummary,
        description: `${bp.publicBookingSummary} Settled directly with the business (online payments: in testing, test mode only).`,
        tags: ['booking', 'intake', 'a2a', domain],
        examples: [`Book an appointment with ${displayName} this Thursday at 2:00 PM.`],
        semantics: { readOnly: false, destructive: false, idempotent: true, openWorld: false },
        governance: {
          commitMode: 'auto_3s',
          roles: ['external_caller', 'machine_customer', ...bp.roles],
          dataClass: 'public',
          surfaces: ['voice', 'mcp', 'a2a_public', 'apple_app_intents', 'android_app_functions'],
        },
        commerce: {
          acpCheckout: true,
        },
        voice: {
          routeRung: 'rung1_economy_s2s',
          keyterms: bp.keyterms,
          minConfidence: 0.7,
        },
        input: {
          type: 'object',
          additionalProperties: false,
          required: ['client_name', 'requested_iso', 'client_request_id'],
          properties: {
            client_name: {
              type: 'string',
              title: 'Client Name',
              description: 'Full name of the customer, resident, or referring peer.',
            },
            requested_iso: {
              type: 'string',
              title: 'Requested Date & Time',
              description: 'Requested ISO-8601 date or local appointment slot.',
            },
            scope_note: {
              type: 'string',
              title: 'Scope Note',
              description: 'Optional summary of requested service.',
            },
            client_request_id: {
              type: 'string',
              title: 'Idempotency Key',
              description: 'UUID preventing duplicate bookings on retry.',
            },
          },
        },
        output: {
          type: 'object',
          required: ['booking_ref', 'status'],
          properties: {
            booking_ref: { type: 'string', title: 'Booking Reference' },
            status: { type: 'string', title: 'Booking Status' },
          },
        },
      }),

      // 3. auto_3s — Frontline Hands-Free Station Update + 3s "Scratch that" Undo
      defineAction({
        id: `${domain}.log_station_milestone`,
        title: 'Log Frontline Station Milestone',
        summary: 'Logs a hands-free station completion with a 3-second spoken Scratch-that undo window.',
        description: 'Records an operational milestone on an active record and whispers peer stations.',
        tags: ['operations', 'whisper', domain],
        examples: ['Mark station milestone complete on record 104'],
        semantics: { readOnly: false, destructive: false, idempotent: true, openWorld: false },
        governance: {
          commitMode: 'auto_3s',
          roles: bp.roles,
          dataClass: bp.internalDataClass,
          surfaces: ['voice', 'mcp', 'a2a_authenticated', 'apple_app_intents', 'android_app_functions'],
        },
        voice: {
          routeRung: 'rung0_deterministic',
          deterministicPatterns: ['mark {record_id} complete', 'log update on {record_id}'],
          keyterms: bp.keyterms,
          minConfidence: 0.74,
          earcon: 'chime_3s_undo',
          teamWhisperChannel: `${domain}_peers`,
        },
        input: {
          type: 'object',
          additionalProperties: false,
          required: ['record_id', 'milestone_note', 'client_request_id'],
          properties: {
            record_id: {
              type: 'string',
              entityRef: bp.entityId,
              title: bp.entityTitle,
              description: `Target ${bp.entityTitle} identifier.`,
            },
            milestone_note: {
              type: 'string',
              title: 'Milestone Note',
              description: 'Concise status note whispered to peer roles.',
            },
            client_request_id: {
              type: 'string',
              title: 'Idempotency Key',
              description: 'Client UUID for safe retry deduplication.',
            },
          },
        },
        output: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', title: 'Status' },
          },
        },
      }),

      // 4. High-Trust Financial / Governance Mutation (approve_1tap or Dual-Custody queue_peer_accept)
      defineAction({
        id: `${domain}.approve_ledger_adjustment`,
        title:
          bp.highStakesCommitMode === 'queue_peer_accept'
            ? 'Stage Dual-Custody Ledger Release'
            : 'Approve Financial Ledger Adjustment',
        summary: 'Stages an audited multi-book SHA-256 adjustment with step-up passkey protection.',
        description:
          bp.highStakesCommitMode === 'queue_peer_accept'
            ? 'Stages a dual-custody fund transfer or seal sign-off requiring a second officer to countersign.'
            : 'Stages a supervisory credit or milestone billing adjustment posted to the SHA-256 ledger.',
        tags: ['ledger', 'governance', domain],
        examples: ['Approve adjustment of 125 dollars for client courtesy.'],
        semantics: { readOnly: false, destructive: true, idempotent: true, openWorld: false },
        governance: {
          commitMode: bp.highStakesCommitMode,
          roles: bp.supervisoryRoles,
          dataClass: bp.internalDataClass,
          surfaces: ['voice', 'mcp', 'a2a_authenticated', 'apple_app_intents', 'android_app_functions'],
          stepUp: {
            passkeyAboveCents: 10000,
            dualCustodySelfAccept: false,
          },
        },
        voice: {
          routeRung: 'rung1_economy_s2s',
          keyterms: bp.keyterms,
          minConfidence: 0.78,
          teamWhisperChannel: `${domain}_supervisors`,
        },
        ledger: {
          books: bp.ledgerBooks,
          entryTemplate: `${domain}.supervised_adjustment`,
          idempotencyKeyField: 'client_request_id',
          sha256Chain: true,
        },
        input: {
          type: 'object',
          additionalProperties: false,
          required: ['record_id', 'amount_cents', 'reason_code', 'client_request_id'],
          properties: {
            record_id: {
              type: 'string',
              entityRef: bp.entityId,
              title: bp.entityTitle,
              description: `Target ${bp.entityTitle} identifier.`,
            },
            amount_cents: {
              type: 'integer',
              minimum: 50,
              maximum: 50000000,
              title: 'Amount (Cents)',
              description: 'Adjustment or release amount in integer cents.',
            },
            reason_code: {
              type: 'string',
              enum: ['service_recovery', 'milestone_release', 'contract_amendment'],
              title: 'Reason Code',
              description: 'Audited general-ledger reason classification.',
            },
            client_request_id: {
              type: 'string',
              title: 'Idempotency Key',
              description: 'UUID preventing duplicate ledger postings.',
            },
          },
        },
        output: {
          type: 'object',
          required: ['amount_cents', 'status'],
          properties: {
            amount_cents: { type: 'integer', title: 'Posted Cents' },
            status: { type: 'string', title: 'Ledger Status' },
          },
        },
      }),
    ],
  });
}

function renderScaffoldConfigSource(scaffoldObj, isRepoEsm) {
  const cleanData = {
    appId: scaffoldObj.appId,
    displayName: scaffoldObj.displayName,
    version: scaffoldObj.version,
    description: scaffoldObj.description,
    bundleId: scaffoldObj.bundleId,
    endpoints: scaffoldObj.endpoints,
    economics: scaffoldObj.economics,
    entities: scaffoldObj.entities,
    actions: scaffoldObj.actions,
  };
  const bodyJson = JSON.stringify(cleanData, null, 2);

  if (isRepoEsm) {
    return `/**
 * ${scaffoldObj.displayName} — Canonical Main Street Steward-Coop Action Contract Manifest
 * Generated by @openscaffold/compiler v1.0.0 (bin/rollout-compiler-fleet.mjs)
 */
import { defineScaffold } from './packages/openscaffold-compiler/src/index.js';

export default defineScaffold(${bodyJson});
`;
  }

  return `/**
 * ${scaffoldObj.displayName} — Canonical Main Street Steward-Coop Action Contract Manifest
 * Generated by @openscaffold/compiler v1.0.0 (bin/rollout-compiler-fleet.mjs)
 */
const { defineScaffold } = require('./packages/openscaffold-compiler/src/index.js');

module.exports = defineScaffold(${bodyJson});
`;
}

function renderActionSurfacesRouteCjs(domain) {
  return `/**
 * 5-Door Constitutional Action Surfaces Router (powered by @openscaffold/compiler v1.0.0)
 * Exposes /.well-known/agent.json, /a2a/agent/authenticatedExtendedCard, /mcp, and /api/action-surfaces
 */
const express = require('express');
const { randomUUID } = require('crypto');
const jwt = require('jsonwebtoken');
const scaffold = require('../../../scaffold.config.js');
const {
  compileScaffold,
  createActionRuntime,
  buildAuthorizedRealtimeTools,
} = require('../services/openscaffold-compiler');

const compiledTargets = compileScaffold(scaffold);

function isPlainRecord(val) {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
  if (Object.prototype.hasOwnProperty.call(val, '__proto__')) return false;
  if (Object.prototype.hasOwnProperty.call(val, 'constructor')) return false;
  if (Object.prototype.hasOwnProperty.call(val, 'prototype')) return false;
  return true;
}

const defaultHandlers = {
  '${domain}.get_operational_pulse': async () => ({ status: 'online', active_items: 0 }),
  '${domain}.request_direct_booking': async () => ({
    booking_ref: 'BKG-' + randomUUID().slice(0, 8).toUpperCase(),
    status: 'confirmed',
  }),
  '${domain}.log_station_milestone': async () => ({ status: 'logged' }),
  '${domain}.approve_ledger_adjustment': async ({ input }) => ({
    amount_cents: Number(input.amount_cents || 0),
    status: 'committed',
  }),
};

const runtime = createActionRuntime(scaffold, defaultHandlers);

function resolveOrigin(req) {
  const host = req.get && req.get('host');
  if (!host) return 'urn:openscaffold:${scaffoldAppPlaceholder(domain)}';
  const proto = req.headers && req.headers['x-forwarded-proto']
    ? String(req.headers['x-forwarded-proto']).split(',')[0].trim()
    : req.protocol || 'http';
  return proto + '://' + host;
}

function wellKnownAgentCard(req, res) {
  const origin = resolveOrigin(req);
  res.json({ ...compiledTargets.a2a.publicAgentCard, url: origin + '/api/action-surfaces/a2a' });
}

function authenticatedAgentCard(req, res) {
  const origin = resolveOrigin(req);
  res.json({ ...compiledTargets.a2a.authenticatedExtendedCard, url: origin + '/api/action-surfaces/a2a' });
}

function createMcpGatewayRouter() {
  const router = express.Router();
  router.get('/', (_req, res) => res.json(compiledTargets.mcp.mcpManifest));
  router.post('/', async (req, res) => {
    const b = req.body;
    if (!isPlainRecord(b) || b.jsonrpc !== '2.0') {
      return res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid JSON-RPC 2.0 payload' } });
    }
    const id = b.id ?? null;
    if (b.method === 'initialize') {
      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2025-06-18',
          serverInfo: compiledTargets.mcp.mcpManifest.serverInfo,
          capabilities: compiledTargets.mcp.mcpManifest.serverCapabilities,
        },
      });
    }
    if (b.method === 'tools/list') {
      return res.json({ jsonrpc: '2.0', id, result: { tools: compiledTargets.mcp.mcpManifest.tools } });
    }
    if (b.method !== 'tools/call') {
      return res.status(400).json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Unsupported method' } });
    }
    const auth = String(req.headers.authorization || '');
    if (!auth.startsWith('Bearer ') || !process.env.JWT_SECRET) {
      return res.status(401).json({ jsonrpc: '2.0', id, error: { code: -32001, message: 'Bearer credential required' } });
    }
    let caller;
    try {
      caller = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ jsonrpc: '2.0', id, error: { code: -32001, message: 'Invalid credential' } });
    }
    const params = isPlainRecord(b.params) ? b.params : {};
    const tool = compiledTargets.mcp.mcpManifest.tools.find((t) => t.name === String(params.name || ''));
    if (!tool) {
      return res.status(404).json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Unknown tool' } });
    }
    if (caller.role === 'team_reviewer' && !tool.annotations?.readOnlyHint) {
      return res.status(403).json({ jsonrpc: '2.0', id, error: { code: -32003, message: 'Reviewer accounts are read-only' } });
    }
    const envelope = await runtime.executeActionEnvelope({
      contractId: tool._meta['osl/contractId'],
      surface: 'mcp',
      context: { actorId: String(caller.id), badgeRole: String(caller.role), zdrVerified: Boolean(caller.zdrVerified) },
      input: isPlainRecord(params.arguments) ? params.arguments : {},
    });
    return res.json({ jsonrpc: '2.0', id, result: { isError: !envelope.ok, structuredContent: envelope } });
  });
  return router;
}

function createStaffActionSurfacesRouter() {
  const router = express.Router();
  router.get('/manifest', (req, res) => {
    const role = String(req.user?.role || 'specialist');
    res.json({
      appId: scaffold.appId,
      version: scaffold.version,
      economics: scaffold.economics,
      authorizedVoiceTools: buildAuthorizedRealtimeTools(compiledTargets.voice, role),
      surfaces: compiledTargets,
      recentVconEvents: runtime.getVconLog().slice(-10),
    });
  });
  router.post('/execute', async (req, res) => {
    if (req.user?.role === 'team_reviewer') return res.status(403).json({ error: 'Insufficient permissions' });
    const b = req.body;
    if (!isPlainRecord(b) || typeof b.contract_id !== 'string') {
      return res.status(400).json({ error: 'Invalid execution payload' });
    }
    const out = await runtime.executeActionEnvelope({
      contractId: b.contract_id,
      surface: b.surface || 'mcp',
      context: {
        actorId: String(req.user?.id || 'staff'),
        badgeRole: String(req.user?.role || 'specialist'),
        zdrVerified: Boolean(b.zdr_verified),
        passkeyVerified: Boolean(b.passkey_verified),
      },
      input: isPlainRecord(b.input) ? b.input : {},
    });
    res.status(out.ok ? 200 : 403).json(out);
  });
  return router;
}

module.exports = {
  compiledTargets,
  runtime,
  wellKnownAgentCard,
  authenticatedAgentCard,
  createMcpGatewayRouter,
  createStaffActionSurfacesRouter,
};
`;
}

function scaffoldAppPlaceholder(domain) {
  return domain.replace(/_/g, '-');
}

function copyDirRecursive(src, dest, skipNames = new Set(['node_modules', '.DS_Store', '.git', 'generated'])) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (skipNames.has(entry.name)) continue;
    const sPath = path.join(src, entry.name);
    const dPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(sPath, dPath, skipNames);
    } else {
      fs.copyFileSync(sPath, dPath);
    }
  }
}

export function isOpenScaffoldAppRepo(dirPath) {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) return false;
  const base = path.basename(dirPath);
  if (base.startsWith('openscaffold-')) return false;
  const hasServer = fs.existsSync(path.join(dirPath, 'server', 'src'));
  const hasClient = fs.existsSync(path.join(dirPath, 'client', 'src'));
  return hasServer || hasClient;
}

export function discoverTargetRepos(inputPath) {
  const resolved = path.resolve(inputPath);
  if (isOpenScaffoldAppRepo(resolved)) {
    return [resolved];
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new Error(`Target path does not exist or is not a directory: ${resolved}`);
  }
  return fs
    .readdirSync(resolved, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => path.join(resolved, d.name))
    .filter(isOpenScaffoldAppRepo);
}

function isEsmPackage(pkgJsonPath) {
  if (!fs.existsSync(pkgJsonPath)) return false;
  try {
    const parsed = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    return parsed.type === 'module';
  } catch {
    return false;
  }
}

function writeCompiledArtifactsSync(scaffold, outDir) {
  const compiled = compileScaffold(scaffold);
  const iosDir = path.join(outDir, 'ios');
  const androidDir = path.join(outDir, 'android');
  fs.mkdirSync(iosDir, { recursive: true });
  fs.mkdirSync(androidDir, { recursive: true });

  const pascalApp = toPascalCase(scaffold.appId);
  fs.writeFileSync(path.join(outDir, 'voice.actions.json'), JSON.stringify(compiled.voice, null, 2));
  fs.writeFileSync(path.join(outDir, 'mcp.tools.json'), JSON.stringify(compiled.mcp.mcpManifest, null, 2));
  fs.writeFileSync(
    path.join(outDir, 'windows-odr.manifest.json'),
    JSON.stringify(compiled.mcp.windowsOdrManifest, null, 2)
  );
  fs.writeFileSync(
    path.join(outDir, 'a2a.agent-card.public.json'),
    JSON.stringify(compiled.a2a.publicAgentCard, null, 2)
  );
  fs.writeFileSync(
    path.join(outDir, 'a2a.agent-card.authenticated.json'),
    JSON.stringify(compiled.a2a.authenticatedExtendedCard, null, 2)
  );
  fs.writeFileSync(path.join(iosDir, `${pascalApp}Intents.swift`), compiled.swiftAppIntents.swiftSource);
  fs.writeFileSync(path.join(iosDir, 'SKILL.md'), compiled.swiftAppIntents.skillMarkdown);
  fs.writeFileSync(
    path.join(androidDir, `${pascalApp}AppFunctionService.kt`),
    compiled.kotlinAppFunctions.kotlinSource
  );
  fs.writeFileSync(
    path.join(androidDir, `${scaffold.appId.replace(/-/g, '_')}_app_functions.xml`),
    compiled.kotlinAppFunctions.xmlManifest
  );

  return compiled;
}

function patchServerIndexCjs(serverIndexPath) {
  if (!fs.existsSync(serverIndexPath)) return false;
  let src = fs.readFileSync(serverIndexPath, 'utf8');
  let changed = false;

  if (!src.includes('/.well-known/agent.json') && !src.includes('/api/action-surfaces')) {
    const hasAuth = src.includes('function authMiddleware') || src.includes('const authMiddleware');
    const authGuard = hasAuth ? 'authMiddleware, ' : '';
    const mountSnippet =
      `\n// 5-Door Action Surfaces (@openscaffold/compiler v1.0.0)\n` +
      `{\n` +
      `  const actionSurfaces = require('./routes/action-surfaces');\n` +
      `  app.get('/.well-known/agent.json', actionSurfaces.wellKnownAgentCard);\n` +
      `  app.get('/a2a/agent/authenticatedExtendedCard', ${authGuard}actionSurfaces.authenticatedAgentCard);\n` +
      `  app.use('/mcp', actionSurfaces.createMcpGatewayRouter());\n` +
      `  app.use('/api/action-surfaces', ${authGuard}actionSurfaces.createStaffActionSurfacesRouter());\n` +
      `}\n`;

    if (src.includes("app.get('/api/health'") || src.includes('app.get("/api/health"')) {
      src = src.replace(/(app\.get\(['"]\/api\/health['"])/, `${mountSnippet}\n$1`);
      changed = true;
    } else if (src.includes('module.exports = app')) {
      src = src.replace('module.exports = app', `${mountSnippet}\nmodule.exports = app`);
      changed = true;
    }
  }

  if (src.includes('voiceVersion:') && !src.includes('compilerVersion:')) {
    src = src.replace(
      /(voiceVersion:\s*[^\n]+,\n)/,
      `$1      compilerVersion: "${COMPILER_ENGINE_VERSION}",\n`
    );
    changed = true;
  } else if (src.includes('booksVersion:') && !src.includes('compilerVersion:')) {
    src = src.replace(
      /(booksVersion:\s*[^\n]+,\n)/,
      `$1      compilerVersion: "${COMPILER_ENGINE_VERSION}",\n`
    );
    changed = true;
  }

  if (changed) fs.writeFileSync(serverIndexPath, src, 'utf8');
  return changed;
}

function patchVercelJson(vercelPath) {
  if (!fs.existsSync(vercelPath)) return false;
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
  } catch {
    return false;
  }
  let changed = false;

  if (Array.isArray(parsed.builds)) {
    const apiBuild = parsed.builds.find((b) => b.src === 'api/index.js');
    if (apiBuild) {
      apiBuild.config = apiBuild.config || {};
      const inc = new Set(apiBuild.config.includeFiles || []);
      for (const pattern of [
        'scaffold.config.js',
        'generated/**',
        'packages/openscaffold-compiler/**',
      ]) {
        if (!inc.has(pattern)) {
          inc.add(pattern);
          changed = true;
        }
      }
      apiBuild.config.includeFiles = [...inc];
    }
  }

  if (Array.isArray(parsed.routes)) {
    const existingSrc = new Set(parsed.routes.map((r) => r.src));
    const needed = [
      { src: '/.well-known/agent.json', dest: '/api/index.js' },
      { src: '/a2a/agent/authenticatedExtendedCard', dest: '/api/index.js' },
      { src: '/mcp', dest: '/api/index.js' },
    ].filter((r) => !existingSrc.has(r.src));

    if (needed.length > 0) {
      const fsIdx = parsed.routes.findIndex((r) => r.handle === 'filesystem');
      if (fsIdx >= 0) {
        parsed.routes.splice(fsIdx, 0, ...needed);
      } else {
        parsed.routes.unshift(...needed);
      }
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(vercelPath, JSON.stringify(parsed, null, 2) + '\n', 'utf8');
  }
  return changed;
}

export async function installCompilerIntoRepo(repoDir, opts = {}) {
  const folderName = path.basename(repoDir);
  if (folderName === 'OpenRestaurant' && !opts.force) {
    return {
      repo: folderName,
      status: 'skipped (flagship repo already custom-wired)',
    };
  }

  const bp = resolveVerticalCompilerBlueprint(opts.verticalId || folderName);
  const starterScaffold = buildStarterScaffoldObject(folderName, {
    verticalId: bp.verticalId,
    appName: bp.appName,
  });

  if (opts.dryRun) {
    return {
      repo: folderName,
      verticalId: bp.verticalId,
      domain: bp.domain,
      actionIds: starterScaffold.actions.map((a) => a.id),
      highStakesCommitMode: bp.highStakesCommitMode,
      dataClass: bp.internalDataClass,
      ledgerBooks: bp.ledgerBooks,
      status: 'dry-run',
    };
  }

  const actionsTaken = [];

  // 1. Vendor packages/openscaffold-compiler (and sibling openscaffold-guild if available)
  const targetCompilerDir = path.join(repoDir, 'packages', 'openscaffold-compiler');
  copyDirRecursive(PKG_SOURCE_DIR, targetCompilerDir);
  actionsTaken.push('vendored packages/openscaffold-compiler');

  const guildSourceDir = opts.guildSourceDir || SIBLING_GUILD_DIR;
  if (opts.withGuild !== false && fs.existsSync(path.join(guildSourceDir, 'package.json'))) {
    const targetGuildDir = path.join(repoDir, 'packages', 'openscaffold-guild');
    copyDirRecursive(guildSourceDir, targetGuildDir);
    actionsTaken.push('vendored packages/openscaffold-guild');
  }

  // 2. Write or load scaffold.config.js & compile all 5 targets into ./generated/
  const rootEsm = isEsmPackage(path.join(repoDir, 'package.json'));
  const configPath = path.join(repoDir, 'scaffold.config.js');
  let activeScaffold = starterScaffold;

  if (!fs.existsSync(configPath) || opts.overwriteManifest) {
    fs.writeFileSync(configPath, renderScaffoldConfigSource(starterScaffold, rootEsm), 'utf8');
    actionsTaken.push(`created scaffold.config.js (${bp.verticalId})`);
  } else {
    const loadedMod = await import(`${pathToFileURL(configPath).href}?t=${Date.now()}`);
    activeScaffold = loadedMod.default ?? loadedMod.scaffold ?? starterScaffold;
  }

  const outDir = path.join(repoDir, 'generated');
  writeCompiledArtifactsSync(activeScaffold, outDir);
  actionsTaken.push('compiled 5 protocol targets into generated/');

  // 3. Wire CJS server adapter + Express action-surfaces router when server/src exists
  const serverSrc = path.join(repoDir, 'server', 'src');
  const serverEsm =
    isEsmPackage(path.join(repoDir, 'server', 'package.json')) || rootEsm;

  if (fs.existsSync(serverSrc) && !serverEsm) {
    const servicesDir = path.join(serverSrc, 'services');
    const routesDir = path.join(serverSrc, 'routes');
    fs.mkdirSync(servicesDir, { recursive: true });
    fs.mkdirSync(routesDir, { recursive: true });

    const adapterPath = path.join(servicesDir, 'openscaffold-compiler.js');
    fs.writeFileSync(
      adapterPath,
      `function loadCanonical() {\n  try {\n    return require('@openscaffold/compiler');\n  } catch (err) {\n    if (err.code !== 'MODULE_NOT_FOUND' && err.code !== 'ERR_MODULE_NOT_FOUND') throw err;\n    return require('../../../packages/openscaffold-compiler/src/index.js');\n  }\n}\n\nmodule.exports = loadCanonical();\n`,
      'utf8'
    );

    const routePath = path.join(routesDir, 'action-surfaces.js');
    if (!fs.existsSync(routePath) || opts.overwriteManifest) {
      fs.writeFileSync(routePath, renderActionSurfacesRouteCjs(bp.domain), 'utf8');
      actionsTaken.push('created server/src/routes/action-surfaces.js');
    }

    if (patchServerIndexCjs(path.join(serverSrc, 'index.js'))) {
      actionsTaken.push('mounted 5-door action surfaces in server/src/index.js');
    }
  }

  if (patchVercelJson(path.join(repoDir, 'vercel.json'))) {
    actionsTaken.push('updated vercel.json routes and includeFiles');
  }

  // 4. Optional Git commit & push (when invoked directly by operator in Terminal)
  if (opts.commit && fs.existsSync(path.join(repoDir, '.git'))) {
    const pathsToAdd = ['packages/openscaffold-compiler', 'scaffold.config.js', 'generated'];
    if (fs.existsSync(path.join(repoDir, 'packages', 'openscaffold-guild'))) {
      pathsToAdd.push('packages/openscaffold-guild');
    }
    if (fs.existsSync(path.join(repoDir, 'server'))) pathsToAdd.push('server');
    if (fs.existsSync(path.join(repoDir, 'vercel.json'))) pathsToAdd.push('vercel.json');

    execFileSync('git', ['add', ...pathsToAdd], { cwd: repoDir, stdio: 'pipe' });
    const diff = execFileSync('git', ['status', '--porcelain'], {
      cwd: repoDir,
      encoding: 'utf8',
    }).trim();
    if (diff) {
      execFileSync(
        'git',
        [
          'commit',
          '-m',
          `feat(compiler): wire @openscaffold/compiler v1.0.0 5-door Action Contracts (${bp.verticalId})`,
        ],
        { cwd: repoDir, stdio: 'pipe' }
      );
      actionsTaken.push('committed to git');
      if (opts.push) {
        execFileSync('git', ['push'], { cwd: repoDir, stdio: 'pipe' });
        actionsTaken.push('pushed to remote');
      }
    }
  }

  return {
    repo: folderName,
    verticalId: bp.verticalId,
    domain: bp.domain,
    actionCount: activeScaffold.actions.length,
    status: 'wired',
    actionsTaken,
  };
}

export async function runFleetRolloutCli(argv = process.argv.slice(2)) {
  const targetArg = argv.find((a) => !a.startsWith('--'));
  if (!targetArg) {
    throw new Error(
      'Usage: node bin/rollout-compiler-fleet.mjs <ProjectsDirOrRepoDir> [--dry-run] [--force] [--overwrite-manifest] [--no-guild] [--commit] [--push]'
    );
  }
  const opts = {
    dryRun: argv.includes('--dry-run'),
    force: argv.includes('--force'),
    overwriteManifest: argv.includes('--overwrite-manifest'),
    withGuild: !argv.includes('--no-guild'),
    commit: argv.includes('--commit'),
    push: argv.includes('--push'),
  };

  const repos = discoverTargetRepos(targetArg);
  const results = [];
  for (const r of repos) {
    results.push(await installCompilerIntoRepo(r, opts));
  }
  return { count: results.length, results };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runFleetRolloutCli()
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
