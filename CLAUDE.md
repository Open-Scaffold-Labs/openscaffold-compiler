# CLAUDE.md — `@openscaffold/compiler`

## Purpose
Canonical zero-dependency Action Contract compiler and 5-door execution runtime (`executeActionEnvelope`) shared across Open Scaffold Labs' 50+ vertical applications.

## Engineering Standards
- **Zero runtime npm dependencies**: Use only Node.js built-ins (`node:crypto`, `node:fs/promises`, `node:path`, `node:url`, `node:test`, `node:assert/strict`).
- **Constitutional Invariants**: Never weaken `validateContracts()` checks on out-of-band identity, `a2a_public` data-class isolation, dual-custody `queue_peer_accept`, or Main Street Steward-Coop zero-commission rules.
- **Verification**: Run `npm test` (`node --test test/compiler.test.js`) and compile both `examples/open-restaurant/scaffold.config.js` and `examples/open-hoa/scaffold.config.js` before pushing to `main`.
