# `@openscaffold/compiler` Architecture (`v1.0.0`)

## 1. Intermediate Representation (`scaffold.config.js`)
Each Open Scaffold Labs vertical defines domain entities (`defineEntity`), actions (`defineAction`), and steward economics (`defineEconomics`) in `scaffold.config.js`.

## 2. Five-Target Lowering Passes
- `emitVoice`: Generates `voice.actions.json` consumed by `@openscaffold/voice` `v1.0.0` (`buildAuthorizedRealtimeTools` strips unpermitted tools pre-session).
- `emitMcp`: Generates `mcp.tools.json` and `windows-odr.manifest.json` with JSON Schema `2020-12` validation and `ID-JAG` token-exchange metadata.
- `emitA2a`: Generates `a2a.agent-card.public.json` (`public` skills + Stripe ACP 0%-commission extension) and `a2a.agent-card.authenticated.json` (`internal` staff skills).
- `emitSwiftAppIntents`: Generates Swift 6 `AppEntity`, `AppEnum`, `@AppIntent(.tool)` structs (`requestConfirmation` on `approve_1tap`; `.tool` omitted on `queue_peer_accept`), and `SKILL.md`.
- `emitKotlinAppFunctions`: Generates Android 16+ `@RequiresApi(36)` Kotlin Jetpack service classes, KDoc `@AppFunctionSerializable` types, and XML index manifests.

## 3. Unified Runtime (`createActionRuntime`)
`executeActionEnvelope` unifies RBAC, ZDR transport verification, ASR confidence floors, idempotency deduplication, 3-second `"Scratch that"` undo, WebAuthn step-up, dual-custody `queue_peer_accept`, 4-book SHA-256 ledger chaining (`gaap`, `tax`, `trust`, `fund`), and IETF `vCon` audit containers.
