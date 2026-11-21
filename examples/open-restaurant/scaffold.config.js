/**
 * Reference Flagship Manifest 1: OpenRestaurant
 * Demonstrates all 4 commit tiers, Rung 0 floor commands, 0%-commission direct pickup
 * (replacing 25%-30% delivery marketplace tolls), and 4-book SHA-256 GAAP/Tax accounting.
 */

import { defineScaffold, defineEntity, defineAction } from '../../src/index.js';

export default defineScaffold({
  appId: 'open-restaurant',
  displayName: 'OpenRestaurant',
  version: '1.4.0',
  bundleId: {
    ios: 'com.openscaffoldlabs.openrestaurant',
    android: 'com.openscaffoldlabs.openrestaurant',
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
    CheckItem: defineEntity({
      id: 'CheckItem',
      title: 'Check Line Item',
      description: 'An ordered menu item on an open dining check.',
      properties: {
        id: { type: 'string', title: 'Item ID' },
        name: { type: 'string', title: 'Menu Item Name' },
        priceCents: { type: 'integer', title: 'Price (Cents)' },
      },
    }),
    MenuItem: defineEntity({
      id: 'MenuItem',
      title: 'Menu Catalog Item',
      description: 'An active dish or beverage on the restaurant menu.',
      properties: {
        id: { type: 'string', title: 'SKU ID' },
        name: { type: 'string', title: 'Dish Name' },
        priceCents: { type: 'integer', title: 'Unit Price (Cents)' },
      },
    }),
  },
  actions: [
    // 1. instant_read — Owner / Manager Live PMIX Margin Lookup
    defineAction({
      id: 'restaurant.get_pmix_summary',
      title: 'Get PMIX Category Summary',
      summary: 'Returns real-time Product Mix (PMIX) revenue and gross margin by menu category.',
      description: 'Queries live Product Mix units sold, net sales, and food-cost margin by category.',
      tags: ['reporting', 'pmix', 'margins'],
      examples: ['How many entrees and cocktails have we sold tonight?'],
      semantics: { readOnly: true, destructive: false, idempotent: true, openWorld: false },
      governance: {
        commitMode: 'instant_read',
        roles: ['shift_lead', 'manager', 'owner', 'cpa'],
        dataClass: 'internal',
        surfaces: ['voice', 'mcp', 'a2a_authenticated', 'apple_app_intents', 'android_app_functions'],
      },
      voice: {
        routeRung: 'rung0_deterministic',
        deterministicPatterns: ['show pmix for {date_range}', 'what is our pmix {date_range}'],
        keyterms: ['PMIX', 'food cost', 'entrees', 'pour cost'],
        minConfidence: 0.68,
      },
      input: {
        type: 'object',
        additionalProperties: false,
        required: ['date_range'],
        properties: {
          date_range: {
            type: 'string',
            enum: ['today', 'yesterday', 'week_to_date', 'month_to_date'],
            title: 'Date Range',
            description: 'Reporting window for PMIX aggregation.',
          },
        },
      },
      output: {
        type: 'object',
        required: ['net_sales_cents', 'top_category'],
        properties: {
          net_sales_cents: { type: 'integer', title: 'Net Sales (Cents)' },
          top_category: { type: 'string', title: 'Top Category' },
        },
      },
    }),

    // 2. auto_3s + Rung 0 ($0 LLM) — Kitchen Floor 86 Item
    defineAction({
      id: 'restaurant.eighty_six_item',
      title: '86 Menu Item',
      summary: 'Marks a dish out-of-stock across POS, voice receptionist, and direct ordering.',
      description: 'Immediately marks a menu item out-of-stock with a 3-second spoken Scratch-that undo window.',
      tags: ['kitchen', 'inventory', 'menu'],
      examples: ['86 the halibut special'],
      semantics: { readOnly: false, destructive: false, idempotent: true, openWorld: false },
      governance: {
        commitMode: 'auto_3s',
        roles: ['line_cook', 'chef', 'bartender', 'shift_lead', 'manager', 'owner'],
        dataClass: 'internal',
        surfaces: ['voice', 'mcp', 'apple_app_intents', 'android_app_functions'],
      },
      voice: {
        routeRung: 'rung0_deterministic',
        deterministicPatterns: ['86 {menu_item_id}', 'eighty six {menu_item_id}'],
        keyterms: ['86', 'halibut', 'ribeye', 'burrata'],
        minConfidence: 0.75,
        earcon: 'chime_3s_undo',
        teamWhisperChannel: 'all_foh_boh',
      },
      input: {
        type: 'object',
        additionalProperties: false,
        required: ['menu_item_id', 'client_request_id'],
        properties: {
          menu_item_id: {
            type: 'string',
            entityRef: 'MenuItem',
            title: 'Menu Item',
            description: 'Menu item to mark out-of-stock.',
          },
          client_request_id: {
            type: 'string',
            title: 'Request ID',
            description: 'Client UUID for retry safety.',
          },
        },
      },
      output: {
        type: 'object',
        required: ['status'],
        properties: { status: { type: 'string', title: 'Status' } },
      },
    }),

    // 3. Zero-Toll Direct Pickup Order (0% Commission DoorDash Replacement)
    defineAction({
      id: 'restaurant.order_direct_pickup',
      title: 'Place Commission-Free Direct Pickup Order',
      summary: 'Places a direct takeout order settled 100% to the restaurant via Stripe ACP.',
      description:
        'Places a direct pickup order with 0% platform commission using a Stripe ACP payment token, saving the restaurant 25-30% in third-party delivery app fees.',
      tags: ['ordering', 'takeout', 'acp', 'zero-commission'],
      examples: ['Order two carnitas tacos for pickup at 6:30 PM under Sam Lee.'],
      semantics: { readOnly: false, destructive: false, idempotent: true, openWorld: false },
      governance: {
        commitMode: 'approve_1tap',
        roles: ['external_caller', 'machine_customer', 'host', 'manager', 'owner'],
        dataClass: 'public',
        surfaces: ['voice', 'mcp', 'a2a_public', 'apple_app_intents', 'android_app_functions'],
      },
      commerce: {
        acpCheckout: true,
      },
      ledger: {
        books: ['gaap', 'tax'],
        entryTemplate: 'pos.direct_pickup_sale',
        idempotencyKeyField: 'client_request_id',
        sha256Chain: true,
      },
      input: {
        type: 'object',
        additionalProperties: false,
        required: ['sku_summary', 'amount_cents', 'customer_name', 'acp_payment_token', 'client_request_id'],
        properties: {
          sku_summary: { type: 'string', title: 'Items Ordered', description: 'Compact summary of SKUs and quantities.' },
          amount_cents: { type: 'integer', minimum: 100, maximum: 500000, title: 'Total Cents', description: 'Order total in cents including tax.' },
          customer_name: { type: 'string', title: 'Pickup Name', description: 'Guest name for pickup shelf.' },
          acp_payment_token: { type: 'string', title: 'Stripe ACP Token', description: 'Delegated payment token settled straight to merchant Stripe Connect.' },
          client_request_id: { type: 'string', title: 'Idempotency Key', description: 'UUID preventing duplicate charges.' },
        },
      },
      output: {
        type: 'object',
        required: ['order_number', 'amount_cents'],
        properties: {
          order_number: { type: 'string', title: 'Order Number' },
          amount_cents: { type: 'integer', title: 'Total Cents' },
        },
      },
    }),

    // 4. approve_1tap — Manager Comp Check Item (GAAP + Tax Contra-Revenue)
    defineAction({
      id: 'restaurant.comp_check_item',
      title: 'Comp Check Line Item',
      summary: 'Applies a comp to an open check item and writes SHA-256 GAAP/Tax entries.',
      description: 'Comps an open guest check item by percentage and records contra-revenue.',
      tags: ['pos', 'checks', 'comp', 'ledger'],
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
        keyterms: ['comp', 'ribeye', 'VIP', 'spill'],
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
          table_number: { type: 'integer', minimum: 1, maximum: 999, title: 'Table Number', description: 'Dining table number 1-999.' },
          check_item_id: { type: 'string', entityRef: 'CheckItem', title: 'Check Item', description: 'Line item to comp.' },
          discount_percent: { type: 'integer', minimum: 1, maximum: 100, default: 100, title: 'Discount %', description: 'Comp percentage 1-100.' },
          reason_code: {
            type: 'string',
            enum: ['kitchen_delay', 'wrong_temp', 'vip_hospitality', 'spill_remake'],
            title: 'Reason Code',
            description: 'Accounting reason code.',
          },
          estimated_cents: { type: 'integer', minimum: 0, maximum: 500000, default: 2500, title: 'Estimated Comp Cents', description: 'Estimated value in cents for step-up evaluation.' },
          client_request_id: { type: 'string', title: 'Idempotency Key', description: 'UUID for deduplication.' },
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
  ],
});
