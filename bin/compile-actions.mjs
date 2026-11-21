#!/usr/bin/env node
/**
 * bin/compile-actions.mjs — Zero-dependency CLI compiler
 * Usage: node bin/compile-actions.mjs --config ./scaffold.config.js --out ./generated
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileScaffold, toPascalCase } from '../src/index.js';

export async function runCli(argv = process.argv.slice(2)) {
  const cfgIdx = argv.indexOf('--config');
  const outIdx = argv.indexOf('--out');
  const configPath = resolve(cfgIdx !== -1 ? argv[cfgIdx + 1] : './scaffold.config.js');
  const outDir = resolve(outIdx !== -1 ? argv[outIdx + 1] : './generated');

  const mod = await import(pathToFileURL(configPath).href);
  const scaffold = mod.default ?? mod.scaffold;
  const compiled = compileScaffold(scaffold);

  const iosDir = join(outDir, 'ios');
  const androidDir = join(outDir, 'android');
  await mkdir(iosDir, { recursive: true });
  await mkdir(androidDir, { recursive: true });

  const pascalApp = toPascalCase(scaffold.appId);

  await Promise.all([
    writeFile(join(outDir, 'voice.actions.json'), JSON.stringify(compiled.voice, null, 2)),
    writeFile(join(outDir, 'mcp.tools.json'), JSON.stringify(compiled.mcp.mcpManifest, null, 2)),
    writeFile(join(outDir, 'windows-odr.manifest.json'), JSON.stringify(compiled.mcp.windowsOdrManifest, null, 2)),
    writeFile(join(outDir, 'a2a.agent-card.public.json'), JSON.stringify(compiled.a2a.publicAgentCard, null, 2)),
    writeFile(join(outDir, 'a2a.agent-card.authenticated.json'), JSON.stringify(compiled.a2a.authenticatedExtendedCard, null, 2)),
    writeFile(join(iosDir, `${pascalApp}Intents.swift`), compiled.swiftAppIntents.swiftSource),
    writeFile(join(iosDir, 'SKILL.md'), compiled.swiftAppIntents.skillMarkdown),
    writeFile(join(androidDir, `${pascalApp}AppFunctionService.kt`), compiled.kotlinAppFunctions.kotlinSource),
    writeFile(join(androidDir, `${scaffold.appId.replace(/-/g, '_')}_app_functions.xml`), compiled.kotlinAppFunctions.xmlManifest),
  ]);

  return { outDir, actionCount: scaffold.actions.length };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  runCli().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
