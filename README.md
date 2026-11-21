# `@openscaffold/compiler` (`v1.0.0`)

Zero-dependency declarative **Action Contract Compiler, 5-Door Constitutional Runtime & 50-App Fleet Rollout CLI** for Open Scaffold Labs (`Node.js >= 20`, pure ESM).

Declare a business capability once in `scaffold.config.js` and compile deterministically into five production agentic and OS surfaces:

1. **`@openscaffold/voice` (`v1.0.0`)** — Realtime S2S tool declarations, Rung 0 `$0` LLM phrase patterns, vocabulary keyterms, and pre-session Badge RBAC matrices (`emitVoice`).
2. **Model Context Protocol (`MCP`)** — JSON Schema `2020-12` `inputSchema`/`outputSchema`, honest behavior annotations, `ID-JAG` enterprise authorization metadata, and Windows 11 On-Device Agent Registry (`ODR`) connector manifests (`emitMcp`).
3. **Agent2Agent (`A2A`) + ACP Checkout** — Two-tier public vs. authenticated `AgentCard` descriptors with direct merchant settlement (`emitA2a`).
4. **Apple Siri AI `App Intents`** — Swift 6 `@AppIntent(.tool)` structs, `AppEntity` / `AppEnum` types, `requestConfirmation(...)` side-effect gates, and Xcode `SKILL.md` bundles (`emitSwiftAppIntents`).
5. **Google `Android 16+ AppFunctions`** — Jetpack `@RequiresApi(36)` `@AppFunctionServiceEntryPoint`, KDoc-driven `@AppFunctionSerializable` classes, and indexed XML schemas (`emitKotlinAppFunctions`).

## Constitutional Anti-Tollbooth & Steward Enforcement

`validateContracts()` enforces Open Scaffold Labs' Main Street Steward-Coop Charter at build time:
- `platformCommissionBps === 0` (`0` bps order or booking skim)
- `seatFeeCents === 0` (unlimited employee/volunteer badges)
- `aiComputeMarkupBps === 0` & `allowTenantByok === true`
- `dataExitFeeCents === 0`
- Out-of-band identity isolation (rejects `user_id`, `tenant_id`, `role`, or `jwt` inside model input schemas)
- 4-tier commit integrity (`instant_read`, `auto_3s`, `approve_1tap`, and dual-custody `queue_peer_accept`)

## Single-Repo Compile & 50-App Fleet Rollout CLI

```bash
# Compile a single vertical's scaffold.config.js into ./generated
npx openscaffold-compile --config ./scaffold.config.js --out ./generated

# Preview 50-app fleet rollout across /Users/daleraaen/Projects (skips OpenRestaurant unless --force)
node ./bin/rollout-compiler-fleet.mjs /Users/daleraaen/Projects --dry-run

# Stamp scaffold.config.js, generated/ (all 5 targets), and Express routes into a sibling vertical
node ./bin/rollout-compiler-fleet.mjs /Users/daleraaen/Projects/OpenLandscapeArchitect

# Roll out across all sibling Open* repositories, commit, and push
node ./bin/rollout-compiler-fleet.mjs /Users/daleraaen/Projects --commit --push
```

## Running Tests

```bash
npm test
```
