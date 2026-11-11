// Fails fast if an automated browser check bypasses the shared ImageKit guard.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join, relative } from 'node:path';
import assert from 'node:assert/strict';

const scripts = resolve(fileURLToPath(new URL('../../', import.meta.url)));
function* findScripts(dir) {
  for (const entry of readdirSync(dir, {withFileTypes:true})) {
    const full=join(dir,entry.name);
    if (entry.isDirectory()) yield* findScripts(full);
    else if (entry.name.endsWith('.mjs')) yield full;
  }
}
let checked = 0;
for (const full of findScripts(scripts)) {
  const file = relative(scripts,full);
  if (file === 'checks/site/check-safe-media-coverage.mjs') continue;
  const content = readFileSync(full, 'utf8');
  if (!content.includes('playwright-core')) continue;
  checked++;
  const expected = file.startsWith('checks/')
    ? /from\s+['"]\.\.\/\.\.\/lib\/safe-media\.mjs['"]/ : /from\s+['"]\.\/lib\/safe-media\.mjs['"]/;
  assert(expected.test(content), `${file}: missing safe-media import`);
  assert(!/\bbrowser\.new(?:Page|Context)\s*\(/.test(content), `${file}: use createSafePage/createSafeContext`);
  assert(!/\broute\.continue\s*\(/.test(content), `${file}: route.continue() can skip ImageKit interception; use route.fallback()`);
}
assert(checked >= 25, 'Unexpectedly few browser tests checked');
console.log(`ImageKit safety coverage: ${checked} Playwright scripts use the shared guard; no direct browser pages/contexts or route.continue() calls.`);
