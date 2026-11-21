/**
 * @openscaffold/compiler - Unified 5-Door Execution Runtime (executeActionEnvelope)
 * Enforces Badge RBAC, ZDR data-class guards, acoustic confidence floors, idempotency,
 * 4-tier commit gates (including dual-custody peer acceptance), 4-book SHA-256 hash-chained
 * ledger entries (@openscaffold/books compatible), and IETF vCon audit emission.
 */

import { createHash, randomUUID } from 'node:crypto';

function sha256Hex(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function createActionRuntime(scaffold, handlers = {}, options = {}) {
  const actionsById = new Map(scaffold.actions.map((a) => [a.id, a]));
  const stagedActions = new Map();
  const idempotencyCache = new Map();
  const ledgerChainByBook = {
    gaap: [],
    tax: [],
    trust: [],
    fund: [],
  };
  const vconAuditLog = [];
  const undoWindowMs = options.undoWindowMs ?? 3000;

  function recordVconEvent({
    operationId,
    contractId,
    surface,
    actorId,
    badgeRole,
    policyDecision,
    reason,
    invocationStatus,
    payloadSummary,
  }) {
    const vconRecord = {
      vcon: '0.0.2',
      uuid: randomUUID(),
      created_at: new Date().toISOString(),
      parties: [
        { role: 'actor', id: actorId, badge_role: badgeRole },
        { role: 'agent_gateway', id: scaffold.appId, surface },
      ],
      events: [
        {
          type: 'policy-decision',
          operation_id: operationId,
          contract_id: contractId,
          outcome: policyDecision,
          reason,
        },
        {
          type: 'tool-invocation',
          operation_id: operationId,
          contract_id: contractId,
          status: invocationStatus,
          summary: payloadSummary ?? null,
        },
      ],
    };
    vconRecord.content_hash = sha256Hex(vconRecord);
    vconAuditLog.push(vconRecord);
    return vconRecord;
  }

  function appendLedgerEntries(action, actorId, approverId, input, result) {
    if (!action.ledger || action.semantics.readOnly) return null;
    const txHashes = {};
    const timestamp = new Date().toISOString();

    for (const book of action.ledger.books) {
      const chain = ledgerChainByBook[book];
      const prevHash = chain.length > 0 ? chain[chain.length - 1].entryHash : 'GENESIS_0000000000000000';
      const entryCore = {
        book,
        seq: chain.length + 1,
        timestamp,
        contractId: action.id,
        template: action.ledger.entryTemplate,
        actorId,
        approverId: approverId ?? actorId,
        idempotencyKey: input[action.ledger.idempotencyKeyField],
        amountCents: result?.comp_amount_cents ?? result?.amount_cents ?? 0,
        prevHash,
      };
      const entryHash = sha256Hex(entryCore);
      const fullEntry = { ...entryCore, entryHash };
      chain.push(fullEntry);
      txHashes[book] = entryHash;
    }

    return txHashes;
  }

  async function executeActionEnvelope({
    contractId,
    surface,
    context,
    input = {},
  }) {
    const operationId = randomUUID();
    const action = actionsById.get(contractId);
    if (!action) {
      return {
        ok: false,
        errorCode: 'UNKNOWN_ACTION',
        recoveryHint: `Action "${contractId}" is not declared in ${scaffold.appId}.`,
      };
    }

    const { actorId, tenantId = 'default', badgeRole, zdrVerified = false, asrConfidence = 1.0, passkeyVerified = false } =
      context ?? {};

    if (!actorId || !badgeRole) {
      recordVconEvent({
        operationId,
        contractId,
        surface,
        actorId: actorId ?? 'anonymous',
        badgeRole: badgeRole ?? 'none',
        policyDecision: 'disallowed',
        reason: 'MISSING_SESSION_IDENTITY',
        invocationStatus: 'denied',
      });
      return {
        ok: false,
        errorCode: 'UNAUTHENTICATED',
        recoveryHint: 'Authenticate session or present valid ID-JAG / Bearer credential.',
      };
    }

    // 1. Badge RBAC Gate
    if (!action.governance.roles.includes(badgeRole)) {
      recordVconEvent({
        operationId,
        contractId,
        surface,
        actorId,
        badgeRole,
        policyDecision: 'disallowed',
        reason: `Badge role "${badgeRole}" not in [${action.governance.roles.join(', ')}]`,
        invocationStatus: 'denied',
      });
      return {
        ok: false,
        errorCode: 'FORBIDDEN_ROLE',
        recoveryHint: `Role "${badgeRole}" cannot execute "${contractId}". Escalate to ${action.governance.roles.join(' or ')}.`,
      };
    }

    // 2. Restricted Data-Class Zero-Data-Retention Gate
    if (action.governance.dataClass === 'restricted' && !zdrVerified) {
      recordVconEvent({
        operationId,
        contractId,
        surface,
        actorId,
        badgeRole,
        policyDecision: 'disallowed',
        reason: 'RESTRICTED_DATA_REQUIRES_ZDR_BAA',
        invocationStatus: 'denied',
      });
      return {
        ok: false,
        errorCode: 'ZDR_TRANSPORT_REQUIRED',
        recoveryHint: 'Restricted PHI/PII actions require a Zero-Data-Retention / BAA-verified session.',
      };
    }

    // 3. Idempotency Deduplication
    const idempField = action.ledger?.idempotencyKeyField ?? (input.client_request_id ? 'client_request_id' : null);
    const idempKey = idempField && input[idempField] ? `${tenantId}:${contractId}:${input[idempField]}` : null;
    if (idempKey && idempotencyCache.has(idempKey)) {
      return { ...idempotencyCache.get(idempKey), idempotentReplay: true };
    }

    // 4. Acoustic Confidence Escalation (noisy kitchen / fireground floor)
    let effectiveCommitMode = action.governance.commitMode;
    if (
      surface === 'voice' &&
      asrConfidence < action.voice.minConfidence &&
      effectiveCommitMode === 'auto_3s'
    ) {
      effectiveCommitMode = 'approve_1tap';
    }

    const handler = handlers[contractId];
    if (typeof handler !== 'function') {
      throw new Error(`Missing handler implementation for action "${contractId}".`);
    }

    // Mode A: instant_read
    if (effectiveCommitMode === 'instant_read') {
      const data = await handler({ input, context });
      recordVconEvent({
        operationId,
        contractId,
        surface,
        actorId,
        badgeRole,
        policyDecision: 'allowed',
        reason: 'instant_read',
        invocationStatus: 'completed',
      });
      return { ok: true, status: 'completed', a2aTaskState: 'completed', data };
    }

    // Mode B: auto_3s (3-second undo grace window + "Scratch that" cancel)
    if (effectiveCommitMode === 'auto_3s') {
      const stagedId = `stg_${randomUUID()}`;
      const preview = await handler({ input, context, phase: 'commit_optimistic' });
      const txHashes = appendLedgerEntries(action, actorId, actorId, input, preview);
      const undoExpiresAt = Date.now() + undoWindowMs;
      stagedActions.set(stagedId, {
        stagedId,
        contractId,
        actorId,
        tenantId,
        input,
        commitMode: 'auto_3s',
        status: 'committed_undoable',
        undoExpiresAt,
      });
      const response = {
        ok: true,
        status: 'committed_auto_3s',
        a2aTaskState: 'completed',
        stagedActionId: stagedId,
        undoExpiresAt,
        teamWhisperChannel: action.voice.teamWhisperChannel,
        ledgerTxHashes: txHashes,
        data: preview,
      };
      if (idempKey) idempotencyCache.set(idempKey, response);
      recordVconEvent({
        operationId,
        contractId,
        surface,
        actorId,
        badgeRole,
        policyDecision: 'allowed',
        reason: 'auto_3s_grace_window',
        invocationStatus: 'completed',
      });
      return response;
    }

    // Mode C & D: approve_1tap and queue_peer_accept (stage before mutating ledger!)
    const stagedId = `stg_${randomUUID()}`;
    const estimatedCents = input.amount_cents ?? input.estimated_cents ?? 0;
    const requiresPasskey =
      action.governance.stepUp?.passkeyAboveCents !== undefined &&
      estimatedCents > action.governance.stepUp.passkeyAboveCents &&
      !passkeyVerified;

    const stageState =
      effectiveCommitMode === 'queue_peer_accept'
        ? 'staged_peer_accept'
        : requiresPasskey
        ? 'auth_step_up_required'
        : 'staged_approve_1tap';

    const a2aTaskState =
      effectiveCommitMode === 'queue_peer_accept'
        ? 'working'
        : requiresPasskey
        ? 'auth-required'
        : 'input-required';

    stagedActions.set(stagedId, {
      stagedId,
      contractId,
      actorId,
      tenantId,
      badgeRole,
      surface,
      input,
      idempKey,
      commitMode: effectiveCommitMode,
      requiresPasskey,
      status: stageState,
    });

    recordVconEvent({
      operationId,
      contractId,
      surface,
      actorId,
      badgeRole,
      policyDecision: 'permission_required',
      reason: stageState,
      invocationStatus: 'pending_confirmation',
    });

    return {
      ok: true,
      status: stageState,
      a2aTaskState,
      stagedActionId: stagedId,
      data: {
        status: stageState,
        staged_action_id: stagedId,
      },
    };
  }

  async function confirmStagedAction({
    stagedActionId,
    approverId,
    approverRole,
    passkeyVerified = false,
  }) {
    const staged = stagedActions.get(stagedActionId);
    if (!staged) {
      return { ok: false, errorCode: 'STAGED_ACTION_NOT_FOUND' };
    }
    const action = actionsById.get(staged.contractId);

    if (!action.governance.roles.includes(approverRole)) {
      return { ok: false, errorCode: 'FORBIDDEN_APPROVER_ROLE' };
    }

    if (staged.commitMode === 'queue_peer_accept' && approverId === staged.actorId) {
      recordVconEvent({
        operationId: randomUUID(),
        contractId: staged.contractId,
        surface: staged.surface,
        actorId: approverId,
        badgeRole: approverRole,
        policyDecision: 'disallowed',
        reason: 'DUAL_CUSTODY_SELF_ACCEPT_FORBIDDEN',
        invocationStatus: 'denied',
      });
      return {
        ok: false,
        errorCode: 'DUAL_CUSTODY_SELF_ACCEPT_FORBIDDEN',
        recoveryHint: 'queue_peer_accept requires a second authorized officer (approverId !== actorId).',
      };
    }

    if (staged.requiresPasskey && !passkeyVerified) {
      return {
        ok: false,
        errorCode: 'PASSKEY_STEP_UP_REQUIRED',
        recoveryHint: 'Present WebAuthn passkey assertion to approve high-value mutation.',
      };
    }

    const handler = handlers[staged.contractId];
    const data = await handler({
      input: staged.input,
      context: { actorId: staged.actorId, approverId, badgeRole: approverRole, tenantId: staged.tenantId },
      phase: 'commit_confirmed',
    });
    const txHashes = appendLedgerEntries(action, staged.actorId, approverId, staged.input, data);
    staged.status = 'committed';

    const finalResponse = {
      ok: true,
      status: 'committed',
      a2aTaskState: 'completed',
      stagedActionId,
      ledgerTxHashes: txHashes,
      data: {
        ...data,
        status: 'committed',
        staged_action_id: stagedActionId,
        ledger_tx_hash: txHashes ? Object.values(txHashes)[0] : undefined,
      },
    };

    if (staged.idempKey) {
      idempotencyCache.set(staged.idempKey, finalResponse);
    }

    recordVconEvent({
      operationId: randomUUID(),
      contractId: staged.contractId,
      surface: staged.surface,
      actorId: approverId,
      badgeRole: approverRole,
      policyDecision: 'allowed',
      reason: `confirmed_${staged.commitMode}`,
      invocationStatus: 'completed',
    });

    return finalResponse;
  }

  function cancelAutoAction({ stagedActionId, actorId }) {
    const staged = stagedActions.get(stagedActionId);
    if (!staged) return { ok: false, errorCode: 'STAGED_ACTION_NOT_FOUND' };
    if (staged.commitMode !== 'auto_3s') {
      return { ok: false, errorCode: 'NOT_AUTO_3S_ACTION' };
    }
    if (Date.now() > staged.undoExpiresAt) {
      return { ok: false, errorCode: 'UNDO_WINDOW_EXPIRED' };
    }
    staged.status = 'canceled_scratch_that';
    recordVconEvent({
      operationId: randomUUID(),
      contractId: staged.contractId,
      surface: 'voice',
      actorId,
      badgeRole: 'staff',
      policyDecision: 'allowed',
      reason: 'spoken_scratch_that_undo',
      invocationStatus: 'canceled',
    });
    return { ok: true, status: 'canceled_scratch_that', a2aTaskState: 'canceled' };
  }

  return {
    executeActionEnvelope,
    confirmStagedAction,
    cancelAutoAction,
    getLedgerEntries: (book) => [...(ledgerChainByBook[book] ?? [])],
    getVconLog: () => [...vconAuditLog],
  };
}
