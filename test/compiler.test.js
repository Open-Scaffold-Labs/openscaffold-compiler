import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  defineScaffold,
  defineEntity,
  defineAction,
  validateContracts,
  emitVoice,
  buildAuthorizedRealtimeTools,
  emitMcp,
  emitA2a,
  emitSwiftAppIntents,
  emitKotlinAppFunctions,
  compileScaffold,
  createActionRuntime,
} from '../src/index.js';
import {
  buildStarterScaffoldObject,
  discoverTargetRepos,
  installCompilerIntoRepo,
  runFleetRolloutCli,
} from '../bin/rollout-compiler-fleet.mjs';

function createFixtureScaffold() {
  return defineScaffold({
    appId: 'open-restaurant',
    displayName: 'OpenRestaurant',
    version: '1.4.0',
    bundleId: {
      ios: 'com.openscaffoldlabs.openrestaurant',
      android: 'com.openscaffoldlabs.openrestaurant',
    },
    entities: {
      CheckItem: defineEntity({
        id: 'CheckItem',
        title: 'Check Line Item',
        properties: {
          id: { type: 'string', title: 'Line Item ID' },
          name: { type: 'string', title: 'Menu Item Name' },
          priceCents: { type: 'integer', title: 'Price Cents' },
        },
      }),
    },
    actions: [
      defineAction({
        id: 'restaurant.reserve_table',
        title: 'Reserve Dining Table',
        summary: 'Books a guest reservation with 0 bps platform commission.',
        description: 'Reserves a dining table for 1 to 12 guests.',
        tags: ['booking', 'dining'],
        examples: ['Book a table for 4 Friday at 7 PM under Alex Rivera.'],
        semantics: { readOnly: false, destructive: false, idempotent: true, openWorld: false },
        governance: {
          commitMode: 'auto_3s',
          roles: ['external_caller', 'machine_customer', 'host', 'manager', 'owner'],
          dataClass: 'public',
          surfaces: ['voice', 'mcp', 'a2a_public', 'apple_app_intents', 'android_app_functions'],
        },
        commerce: { acpCheckout: true },
        voice: {
          routeRung: 'rung1_economy_s2s',
          deterministicPatterns: ['book table for {party_size}'],
          keyterms: ['patio', 'booth'],
          minConfidence: 0.7,
        },
        input: {
          type: 'object',
          additionalProperties: false,
          required: ['party_size', 'guest_name', 'client_request_id'],
          properties: {
            party_size: { type: 'integer', minimum: 1, maximum: 12, title: 'Party Size', description: 'Guests 1-12.' },
            guest_name: { type: 'string', title: 'Guest Name', description: 'Reservation holder name.' },
            client_request_id: { type: 'string', title: 'Request ID', description: 'UUID for retry safety.' },
          },
        },
        output: {
          type: 'object',
          required: ['confirmation_code'],
          properties: {
            confirmation_code: { type: 'string', title: 'Confirmation Code' },
          },
        },
      }),

      defineAction({
        id: 'restaurant.comp_check_item',
        title: 'Comp Check Line Item',
        summary: 'Applies a comp to an open check item and posts GAAP/Tax adjustments.',
        description: 'Comps an ordered item on an open check.',
        tags: ['pos', 'ledger'],
        examples: ['Comp the ribeye on Table 12 for kitchen delay.'],
        semantics: { readOnly: false, destructive: true, idempotent: true, openWorld: false },
        governance: {
          commitMode: 'approve_1tap',
          roles: ['shift_lead', 'manager', 'owner'],
          dataClass: 'internal',
          surfaces: ['voice', 'mcp', 'a2a_authenticated', 'apple_app_intents', 'android_app_functions'],
          stepUp: { passkeyAboveCents: 10000, dualCustodySelfAccept: false },
        },
        voice: {
          routeRung: 'rung1_economy_s2s',
          keyterms: ['comp', 'ribeye'],
          minConfidence: 0.78,
          teamWhisperChannel: 'foh_managers',
        },
        ledger: {
          books: ['gaap', 'tax'],
          entryTemplate: 'pos.comp_contra_revenue',
          idempotencyKeyField: 'client_request_id',
          sha256Chain: true,
        },
        input: {
          type: 'object',
          additionalProperties: false,
          required: ['table_number', 'check_item_id', 'reason_code', 'client_request_id'],
          properties: {
            table_number: { type: 'integer', minimum: 1, maximum: 999, title: 'Table Number', description: 'Table 1-999.' },
            check_item_id: { type: 'string', entityRef: 'CheckItem', title: 'Check Item', description: 'Item to comp.' },
            discount_percent: { type: 'integer', minimum: 1, maximum: 100, default: 100, title: 'Discount %', description: '1-100%.' },
            reason_code: {
              type: 'string',
              enum: ['kitchen_delay', 'wrong_temp', 'vip_hospitality'],
              title: 'Comp Reason',
              description: 'Contra-revenue reason code.',
            },
            client_request_id: { type: 'string', title: 'Idempotency Key', description: 'Deduplication UUID.' },
          },
        },
        output: {
          type: 'object',
          required: ['comp_amount_cents', 'remaining_check_cents'],
          properties: {
            comp_amount_cents: { type: 'integer', title: 'Comp Amount Cents' },
            remaining_check_cents: { type: 'integer', title: 'Remaining Check Cents' },
          },
        },
      }),

      defineAction({
        id: 'hoa.transfer_reserve_funds',
        title: 'Transfer Reserve Funds',
        summary: 'Dual-custody capital reserve transfer.',
        description: 'Stages a reserve transfer requiring peer board acceptance.',
        semantics: { readOnly: false, destructive: true, idempotent: true, openWorld: false },
        governance: {
          commitMode: 'queue_peer_accept',
          roles: ['treasurer', 'board_president'],
          dataClass: 'internal',
          surfaces: ['voice', 'mcp', 'a2a_authenticated', 'apple_app_intents', 'android_app_functions'],
          stepUp: { passkeyAboveCents: 50000, dualCustodySelfAccept: false },
        },
        ledger: {
          books: ['gaap', 'trust', 'fund'],
          entryTemplate: 'hoa.reserve_transfer',
          idempotencyKeyField: 'client_request_id',
        },
        input: {
          type: 'object',
          required: ['amount_cents', 'client_request_id'],
          properties: {
            amount_cents: { type: 'integer', minimum: 100, maximum: 50000000, title: 'Amount Cents', description: 'Transfer cents.' },
            client_request_id: { type: 'string', title: 'Idempotency Key', description: 'Client UUID.' },
          },
        },
      }),
    ],
  });
}

test('validateContracts enforces Steward-Coop Charter, RBAC isolation, commit modes, and out-of-band identity', () => {
  const valid = createFixtureScaffold();
  assert.deepEqual(validateContracts(valid), { valid: true, actionCount: 3 });

  assert.throws(
    () => defineScaffold({ appId: 'x', displayName: 'X', economics: { platformCommissionBps: 1500 }, actions: [] }),
    /platformCommissionBps must be 0/
  );

  assert.throws(
    () =>
      defineScaffold({
        appId: 'x',
        displayName: 'X',
        actions: [
          defineAction({
            id: 'x.read_data',
            title: 'Read',
            semantics: { readOnly: true },
            governance: { commitMode: 'instant_read', roles: ['owner'], dataClass: 'internal' },
            input: { type: 'object', properties: { tenant_id: { type: 'string' } } },
          }),
        ],
      }),
    /input\.properties\.tenant_id is forbidden/
  );

  assert.throws(
    () =>
      defineScaffold({
        appId: 'x',
        displayName: 'X',
        actions: [
          defineAction({
            id: 'x.secret_op',
            title: 'Secret',
            semantics: { readOnly: true },
            governance: {
              commitMode: 'instant_read',
              roles: ['owner'],
              dataClass: 'internal',
              surfaces: ['a2a_public'],
            },
            input: { type: 'object', properties: {} },
          }),
        ],
      }),
    /cannot be exposed on "a2a_public"/
  );
});

test('emitVoice builds @openscaffold/voice v1.0.0 manifest and strips unauthorized tools pre-session', () => {
  const voice = emitVoice(createFixtureScaffold());
  assert.equal(voice.tools.length, 3);

  const externalTools = buildAuthorizedRealtimeTools(voice, 'external_caller');
  assert.equal(externalTools.length, 1);
  assert.equal(externalTools[0].name, 'restaurant_reserve_table');

  const compTool = voice.tools.find((t) => t.name === 'restaurant_comp_check_item');
  assert.equal(compTool.realtimeDeclaration.parameters.properties.check_item_id.entityRef, undefined);
  assert.deepEqual(compTool.ledger.books, ['gaap', 'tax']);
});

test('emitMcp generates JSON Schema 2020-12 tools, behavior annotations, ID-JAG auth, and Windows ODR connector', () => {
  const { mcpManifest, windowsOdrManifest } = emitMcp(createFixtureScaffold());
  assert.equal(mcpManifest.tools.length, 3);
  assert.equal(
    mcpManifest.serverCapabilities.extensions['io.modelcontextprotocol/enterprise-managed-authorization'].tokenType,
    'urn:ietf:params:oauth:token-type:id-jag'
  );

  const comp = mcpManifest.tools.find((t) => t.name === 'restaurant_comp_check_item');
  assert.equal(comp.inputSchema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(comp.annotations.destructiveHint, true);
  assert.equal(comp.annotations.idempotentHint, true);
  assert.equal(windowsOdrManifest.isolation.sandboxed, true);
});

test('emitA2a separates public AgentCard skills from authenticatedExtendedCard staff skills', () => {
  const { publicAgentCard, authenticatedExtendedCard } = emitA2a(createFixtureScaffold());
  assert.equal(publicAgentCard.skills.length, 1);
  assert.equal(publicAgentCard.skills[0].id, 'restaurant-reserve-table');
  assert.equal(publicAgentCard.supportsAuthenticatedExtendedCard, true);
  assert.equal(authenticatedExtendedCard.skills.length, 3);
  assert.ok(publicAgentCard.capabilities.extensions.some((e) => e.uri === 'urn:acp:agentic-commerce:v1'));
});

test('emitSwiftAppIntents emits AppEntity, AppEnum, @AppIntent(.tool), requestConfirmation, and omits .tool on queue_peer_accept', () => {
  const { swiftSource, skillMarkdown } = emitSwiftAppIntents(createFixtureScaffold());
  assert.match(swiftSource, /struct CheckItemEntity: AppEntity/);
  assert.match(swiftSource, /enum CompCheckItemReasonCodeAppEnum: String, AppEnum/);
  assert.match(swiftSource, /@AppIntent\(\.tool\)\nstruct CompCheckItemIntent: AppIntent/);
  assert.match(swiftSource, /try await requestConfirmation/);
  assert.doesNotMatch(swiftSource, /@AppIntent\(\.tool\)\nstruct TransferReserveFundsIntent/);
  assert.match(swiftSource, /struct TransferReserveFundsIntent: AppIntent/);
  assert.match(skillMarkdown, /open-restaurant-siri-skill/);
});

test('emitKotlinAppFunctions emits @RequiresApi(36) Jetpack service, KDoc Serializable classes, range/enum checks, and XML', () => {
  const { kotlinSource, xmlManifest } = emitKotlinAppFunctions(createFixtureScaffold());
  assert.match(kotlinSource, /@RequiresApi\(36\)/);
  assert.match(kotlinSource, /@AppFunctionServiceEntryPoint/);
  assert.match(kotlinSource, /@AppFunctionSerializable\(isDescribedByKDoc = true\)/);
  assert.match(kotlinSource, /@AppFunctionDeclaration\(isDescribedByKDoc = true\)/);
  assert.match(kotlinSource, /if \(params\.tableNumber !in 1\.\.999\)/);
  assert.match(kotlinSource, /throw AppFunctionInvalidArgumentException/);
  assert.match(xmlManifest, /<app-function id="restaurant\.comp_check_item" method="compCheckItem"/);
});

test('compileScaffold returns all 5 target outputs in a single deterministic pass', () => {
  const bundle = compileScaffold(createFixtureScaffold());
  assert.ok(bundle.voice && bundle.mcp && bundle.a2a && bundle.swiftAppIntents && bundle.kotlinAppFunctions);
});

test('rollout-compiler-fleet synthesizes valid 4-tier contracts for built-in and dynamic Open* verticals', () => {
  const la = buildStarterScaffoldObject('OpenLandscapeArchitect');
  assert.equal(la.appId, 'open-landscape-architect');
  assert.equal(la.actions.length, 4);
  assert.equal(compileScaffold(la).a2a.publicAgentCard.skills.length, 1);

  const hoa = buildStarterScaffoldObject('OpenHOA');
  const hoaRelease = hoa.actions.find((a) => a.id === 'hoa.approve_ledger_adjustment');
  assert.equal(hoaRelease.governance.commitMode, 'queue_peer_accept');
  assert.deepEqual(hoaRelease.ledger.books, ['gaap', 'trust', 'fund']);

  const dentist = buildStarterScaffoldObject('OpenDentist');
  const dentistPulse = dentist.actions.find((a) => a.id === 'dentist.get_operational_pulse');
  assert.equal(dentistPulse.governance.dataClass, 'restricted');
  assert.equal(compileScaffold(dentist).voice.tools[0].zdrRequired, true);

  // Arbitrary 50+ fleet synthesis (e.g. OpenVetClinic)
  const vet = buildStarterScaffoldObject('OpenVetClinic');
  assert.equal(vet.appId, 'open-vet-clinic');
  assert.equal(vet.actions[0].id, 'vet_clinic.get_operational_pulse');
  assert.ok(compileScaffold(vet).mcp.mcpManifest.tools.length === 4);
});

test('rollout-compiler-fleet discovers fleet repos, skips OpenRestaurant by default, and stamps 5 targets + Express routes end to end', async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'osl-compiler-rollout-'));
  try {
    // 1. Flagship OpenRestaurant (should skip without --force)
    fs.mkdirSync(path.join(tmpRoot, 'OpenRestaurant', 'server', 'src'), { recursive: true });
    // 2. Infrastructure package (openscaffold-* should be ignored by app scanner)
    fs.mkdirSync(path.join(tmpRoot, 'openscaffold-voice', 'src'), { recursive: true });
    // 3. Target sibling vertical: OpenLandscapeArchitect
    const laDir = path.join(tmpRoot, 'OpenLandscapeArchitect');
    fs.mkdirSync(path.join(laDir, 'server', 'src'), { recursive: true });
    fs.mkdirSync(path.join(laDir, 'client', 'src'), { recursive: true });

    fs.writeFileSync(
      path.join(laDir, 'package.json'),
      JSON.stringify({ name: 'open-landscape-architect', version: '1.0.0', private: true }, null, 2)
    );
    fs.writeFileSync(
      path.join(laDir, 'server', 'src', 'index.js'),
      [
        "const express = require('express');",
        'const app = express();',
        'function authMiddleware(req, _res, next) { next(); }',
        "app.get('/api/health', (_req, res) => {",
        '  res.json({',
        '    status: "ok",',
        '    voiceVersion: "1.0.0",',
        '  });',
        '});',
        'module.exports = app;',
      ].join('\n')
    );
    fs.writeFileSync(
      path.join(laDir, 'vercel.json'),
      JSON.stringify(
        {
          version: 2,
          builds: [{ src: 'api/index.js', use: '@vercel/node', config: { includeFiles: ['server/migrations/**'] } }],
          routes: [{ handle: 'filesystem' }, { src: '/(.*)', dest: '/index.html' }],
        },
        null,
        2
      )
    );

    const discovered = discoverTargetRepos(tmpRoot).map((p) => path.basename(p)).sort();
    assert.deepEqual(discovered, ['OpenLandscapeArchitect', 'OpenRestaurant']);

    // Dry-run across fleet
    const drySummary = await runFleetRolloutCli([tmpRoot, '--dry-run']);
    assert.equal(drySummary.count, 2);
    const orRes = drySummary.results.find((r) => r.repo === 'OpenRestaurant');
    const laDry = drySummary.results.find((r) => r.repo === 'OpenLandscapeArchitect');
    assert.match(orRes.status, /skipped/);
    assert.equal(laDry.status, 'dry-run');
    assert.equal(laDry.domain, 'landscape_arch');

    // Full install on OpenLandscapeArchitect (without sibling guild copy so test stays self-contained)
    const wired = await installCompilerIntoRepo(laDir, { withGuild: false });
    assert.equal(wired.status, 'wired');
    assert.equal(wired.actionCount, 4);

    // Verify all 9 generated artifacts exist on disk
    for (const rel of [
      'scaffold.config.js',
      'packages/openscaffold-compiler/package.json',
      'generated/voice.actions.json',
      'generated/mcp.tools.json',
      'generated/windows-odr.manifest.json',
      'generated/a2a.agent-card.public.json',
      'generated/a2a.agent-card.authenticated.json',
      'generated/ios/OpenLandscapeArchitectIntents.swift',
      'generated/ios/SKILL.md',
      'generated/android/OpenLandscapeArchitectAppFunctionService.kt',
      'generated/android/open_landscape_architect_app_functions.xml',
      'server/src/services/openscaffold-compiler.js',
      'server/src/routes/action-surfaces.js',
    ]) {
      assert.equal(fs.existsSync(path.join(laDir, rel)), true, `Expected ${rel} to exist`);
    }

    // Verify server/src/index.js and vercel.json were patched cleanly & idempotently
    const patchedServer = fs.readFileSync(path.join(laDir, 'server', 'src', 'index.js'), 'utf8');
    assert.match(patchedServer, /app\.get\('\/\.well-known\/agent\.json'/);
    assert.match(patchedServer, /app\.use\('\/mcp'/);
    assert.match(patchedServer, /compilerVersion:\s*"1\.0\.0"/);

    const patchedVercel = JSON.parse(fs.readFileSync(path.join(laDir, 'vercel.json'), 'utf8'));
    assert.ok(patchedVercel.routes.some((r) => r.src === '/.well-known/agent.json'));
    assert.ok(patchedVercel.builds[0].config.includeFiles.includes('generated/**'));

    // Re-running is idempotent (no duplicate mounts)
    await installCompilerIntoRepo(laDir, { withGuild: false });
    const patchedServer2 = fs.readFileSync(path.join(laDir, 'server', 'src', 'index.js'), 'utf8');
    assert.equal(patchedServer2, patchedServer);

    // Load generated scaffold.config.js dynamically and execute through createActionRuntime
    const loadedMod = await import(pathToFileURL(path.join(laDir, 'scaffold.config.js')).href);
    const loadedScaffold = loadedMod.default ?? loadedMod;
    const rt = createActionRuntime(loadedScaffold, {
      'landscape_arch.get_operational_pulse': async () => ({ status: 'online', active_items: 4 }),
      'landscape_arch.request_direct_booking': async () => ({ booking_ref: 'BKG-1', status: 'confirmed' }),
      'landscape_arch.log_station_milestone': async () => ({ status: 'logged' }),
      'landscape_arch.approve_ledger_adjustment': async () => ({ amount_cents: 5000, status: 'committed' }),
    });

    const pulseOut = await rt.executeActionEnvelope({
      contractId: 'landscape_arch.get_operational_pulse',
      surface: 'mcp',
      context: { actorId: '1', badgeRole: 'principal_architect' },
      input: { window: 'today' },
    });
    assert.equal(pulseOut.ok, true);
    assert.equal(pulseOut.data.active_items, 4);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});
