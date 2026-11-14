// Verify local audit compaction only against throwaway fixtures.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'ailuren-audit-cache-'));
const css = path.join(folder, '.audit/maintenance-20261114/css-contract');
const shots = path.join(folder, '.audit/curated-order/shots');
const src = path.join(folder, 'scripts/maintenance/compact-local-audit.mjs');
const fileNames = ['before.json', 'before-new.json', 'before-home.json', 'after.json', 'after-new.json'];
const raw = new Map();
let cliPath;
const sha = b => createHash('sha256').update(b).digest('hex');
function run(mode) {
  const r = spawnSync(process.execPath, [cliPath, mode], { encoding: 'utf8', cwd: os.tmpdir(), timeout: 15000 });
  assert.equal(r.status, 0, r.stderr || r.error?.message);
  return JSON.parse(r.stdout);
}
try {
  await fs.mkdir(css, { recursive: true });
  await fs.mkdir(shots, { recursive: true });
  await fs.mkdir(path.dirname(src), { recursive: true });
  await fs.copyFile(new URL('../../maintenance/compact-local-audit.mjs', import.meta.url), src);
  // The copied entry script must be invoked by its real path on macOS.
  cliPath = await fs.realpath(src);
  assert(cliPath.endsWith('compact-local-audit.mjs'));
  for (const name of fileNames) {
    const data = Buffer.from(JSON.stringify({ name, pixels: new Array(2000).fill('same computed CSS') }));
    raw.set(name, data);
    await fs.writeFile(path.join(css, name), data);
  }
  const screenshot = path.join(shots, 'featured-390-zh.jpg');
  const unrelated = path.join(shots, 'important-review.png');
  await fs.writeFile(screenshot, 'generated screenshot');
  await fs.writeFile(unrelated, 'keep');
  const preserve = [
    ['.cover-studio/sessions/source.mp4', 'real user video'],
    ['assets/videos/hero/hero.mp4', 'hero'],
    ['src/data/projects.js', 'project data'],
    ['.audit/faststart-ready/raw.mp4', 'user media'],
    ['.audit/mobile-scroll-investigation-20261026/original.mp4', 'source backup'],
    ['.audit/phase1-safe-cleanup-20261112/before/file.txt', 'rollback data'],
  ];
  for (const [relative, text] of preserve) {
    const filename = path.join(folder, relative);
    await fs.mkdir(path.dirname(filename), { recursive: true });
    await fs.writeFile(filename, text);
  }
  assert.equal(run('scan').screenshots.length, 1);
  assert.equal((await fs.readFile(screenshot)).toString(), 'generated screenshot');
  assert.equal(run('compact').baselines.filter(row => row.originalBytes === 0).length, 5);
  assert.equal(run('compact').screenshots.length, 0, 'Second cleanup is idempotent');
  assert.equal((await fs.readFile(unrelated)).toString(), 'keep');
  for (const [name, original] of raw) {
    await assert.rejects(fs.stat(path.join(css, name)), { code: 'ENOENT' });
    const archive = await fs.readFile(path.join(css, name + '.gz'));
    assert(archive.length < original.length);
  }
  assert.equal(run('restore').baselines.filter(row => row.originalBytes > 0).length, 5);
  for (const [name, original] of raw) {
    const restored = await fs.readFile(path.join(css, name));
    assert.equal(sha(restored), sha(original));
  }
  for (const [relative, text] of preserve) assert.equal((await fs.readFile(path.join(folder, relative))).toString(), text);
  console.log('LOCAL_AUDIT_CACHE_PASS: scan, gzip, original hashes, safe screenshot allowlist, repeat, restore, protected directories');
} finally {
  await fs.rm(folder, { recursive: true, force: true });
}
