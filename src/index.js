/**
 * src/index.js — @openscaffold/compiler v1.0.0 Public API
 */

export {
  COMMIT_MODES,
  VOICE_ROUTE_RUNGS,
  DATA_CLASSES,
  SURFACES,
  LEDGER_BOOKS,
  FORBIDDEN_IDENTITY_PARAMS,
  toSnakeCase,
  toKebabCase,
  toPascalCase,
  toCamelCase,
  defineEconomics,
  defineEntity,
  defineAction,
  defineScaffold,
  validateContracts,
  validateContracts as validateScaffold,
} from './validateContracts.js';

export {
  emitVoice,
  emitVoice as compileToVoice,
  buildAuthorizedRealtimeTools,
} from './emitVoice.js';
export { emitMcp, emitMcp as compileToMcp } from './emitMcp.js';
export { emitA2a, emitA2a as compileToA2a } from './emitA2a.js';
export {
  emitSwiftAppIntents,
  emitSwiftAppIntents as compileToSwiftAppIntents,
} from './emitSwiftAppIntents.js';
export {
  emitKotlinAppFunctions,
  emitKotlinAppFunctions as compileToKotlinAppFunctions,
} from './emitKotlinAppFunctions.js';
export { createActionRuntime } from './executeActionEnvelope.js';

import { validateContracts } from './validateContracts.js';
import { emitVoice } from './emitVoice.js';
import { emitMcp } from './emitMcp.js';
import { emitA2a } from './emitA2a.js';
import { emitSwiftAppIntents } from './emitSwiftAppIntents.js';
import { emitKotlinAppFunctions } from './emitKotlinAppFunctions.js';

export function compileScaffold(scaffold) {
  validateContracts(scaffold);
  return {
    voice: emitVoice(scaffold),
    mcp: emitMcp(scaffold),
    a2a: emitA2a(scaffold),
    swiftAppIntents: emitSwiftAppIntents(scaffold),
    kotlinAppFunctions: emitKotlinAppFunctions(scaffold),
  };
}

export const compileAllTargets = compileScaffold;
