// Fails fast if an automated browser check bypasses the shared ImageKit guard.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const scripts = resolve(fileURLToPath(new URL('.', import.meta.url)));
let checked = 0;
for (const file of readdirSync(scripts).filter(name => name.endsWith('.mjs'))) {
  if (file === 'check-safe-media-coverage.mjs') continue;
  const content = readFileSync(resolve(scripts, file), 'utf8');
  if (!content.includes('playwright-core')) continue;
  checked++;
  assert(content.includes("from './lib/safe-media.mjs'"), `${file}: missing safe-media import`);
  assert(!/\bbrowser\.new(?:Page|Context)\s*\(/.test(content), `${file}: use createSafePage/createSafeContext`);
  assert(!/\broute\.continue\s*\(/.test(content), `${file}: route.continue() can skip ImageKit interception; use route.fallback()`);
}
assert(checked >= 25, 'Unexpectedly few browser tests checked');
console.log(`ImageKit safety coverage: ${checked} Playwright scripts use the shared guard; no direct browser pages/contexts or route.continue() calls.`);
