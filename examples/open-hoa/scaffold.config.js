/**
 * Reference Flagship Manifest 2: OpenHOA
 * Demonstrates dual-custody fiduciary governance (queue_peer_accept across Trust + Fund books)
 * and zero-toll local vendor bidding over A2A.
 */

import { defineScaffold, defineAction } from '../../src/index.js';

export default defineScaffold({
  appId: 'open-hoa',
  displayName: 'OpenHOA',
  version: '1.2.0',
  actions: [
    defineAction({
      id: 'hoa.transfer_reserve_funds',
      title: 'Transfer HOA Reserve Funds',
      summary: 'Stages a dual-custody reserve transfer requiring a second board officer to countersign.',
      description:
        'Transfers capital between HOA Operating and Capital Reserve accounts. Enforces queue_peer_accept so the treasurer who stages the transfer can never self-approve it.',
      tags: ['treasury', 'reserves', 'fiduciary', 'dual-custody'],
      examples: ['Stage a $12,500 transfer from capital reserves for the roof repair invoice.'],
      semantics: { readOnly: false, destructive: true, idempotent: true, openWorld: false },
      governance: {
        commitMode: 'queue_peer_accept',
        roles: ['treasurer', 'board_president', 'board_secretary'],
        dataClass: 'internal',
        surfaces: ['voice', 'mcp', 'a2a_authenticated', 'apple_app_intents', 'android_app_functions'],
        stepUp: { passkeyAboveCents: 50000, dualCustodySelfAccept: false },
      },
      ledger: {
        books: ['gaap', 'trust', 'fund'],
        entryTemplate: 'hoa.reserve_fund_disbursement',
        idempotencyKeyField: 'client_request_id',
        sha256Chain: true,
      },
      input: {
        type: 'object',
        additionalProperties: false,
        required: ['amount_cents', 'purpose_memo', 'vendor_name', 'client_request_id'],
        properties: {
          amount_cents: { type: 'integer', minimum: 100, maximum: 50000000, title: 'Amount Cents', description: 'Transfer amount in integer cents.' },
          purpose_memo: { type: 'string', title: 'Board Resolution Memo', description: 'Citation to HOA reserve study item or board vote.' },
          vendor_name: { type: 'string', title: 'Vendor Name', description: 'Verified contractor or payee.' },
          client_request_id: { type: 'string', title: 'Idempotency Key', description: 'Client UUID.' },
        },
      },
      output: {
        type: 'object',
        required: ['amount_cents', 'transfer_reference'],
        properties: {
          amount_cents: { type: 'integer', title: 'Amount Cents' },
          transfer_reference: { type: 'string', title: 'Transfer Reference' },
        },
      },
    }),
  ],
});
