// Manual, allowlisted cleanup for ignored local QA artifacts only.
// Never touches .cover-studio, site assets, project data, or live CSS.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const audit = path.join(projectRoot, '.audit');
const cssDir = path.join(audit, 'maintenance-20261114', 'css-contract');
const manifestPath = path.join(cssDir, 'compressed-baselines-manifest.json');
const names = ['before.json', 'before-new.json', 'before-home.json', 'after.json', 'after-new.json'];
const shotsDir = path.join(audit, 'curated-order', 'shots');
const shotNames = ['featured', 'awards'].flatMap(kind =>
  [390, 1440].flatMap(width => ['zh', 'en'].map(lang => `${kind}-${width}-${lang}.jpg`)));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

async function readIfExists(file) {
  try {
    const info = await fs.lstat(file);
    assert(info.isFile() && !info.isSymbolicLink(), 'Unsafe file: ' + file);
    return await fs.readFile(file);
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}
async function checkDirectories() {
  for (const dir of [audit, path.dirname(cssDir), cssDir, path.dirname(shotsDir), shotsDir]) {
    const info = await fs.lstat(dir);
    assert(info.isDirectory() && !info.isSymbolicLink(), 'Unsafe directory: ' + dir);
  }
}
async function getManifest() {
  const raw = await readIfExists(manifestPath);
  if (!raw) return null;
  const manifest = JSON.parse(raw);
  assert(manifest.version === 1 && Object.keys(manifest.entries).sort().join('|') === names.slice().sort().join('|'),
    'Invalid or incomplete local cache manifest');
  return manifest;
}
function checkArchive(buffer, original, name, manifestEntry = null) {
  assert(buffer, 'Missing compressed baseline: ' + name);
  const recovered = gunzipSync(buffer);
  if (original) assert(recovered.equals(original), 'Compressed data differs: ' + name);
  if (manifestEntry) {
    assert(recovered.length === manifestEntry.bytes && sha(recovered) === manifestEntry.sha256,
      'Archived baseline hash mismatch: ' + name);
  }
  return recovered;
}
export async function inspect({ compact = false, restore = false } = {}) {
  await checkDirectories();
  assert(!(compact && restore), 'Choose compact or restore, not both');
  let manifest = await getManifest();
  if (compact) {
    const originals = new Map();
    const entries = {};
    for (const name of names) {
      const original = await readIfExists(path.join(cssDir, name));
      const packed = await readIfExists(path.join(cssDir, name + '.gz'));
      assert(original || (packed && manifest?.entries[name]), 'Missing baseline, refusing cleanup: ' + name);
      const bytes = original || checkArchive(packed, null, name, manifest.entries[name]);
      if (packed) checkArchive(packed, bytes, name, manifest?.entries[name]);
      else {
        const gz = gzipSync(bytes, { level: 9 });
        checkArchive(gz, bytes, name);
        await fs.writeFile(path.join(cssDir, name + '.gz'), gz, { flag: 'wx' });
      }
      entries[name] = { bytes: bytes.length, sha256: sha(bytes) };
      if (original) originals.set(name, entries[name].sha256);
    }
    if (!manifest) {
      manifest = { version: 1, note: 'Lossless, reversible gzip. Restore before manually running old CSS comparison scripts.', entries };
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    } else {
      for (const name of names) assert(
        manifest.entries[name].sha256 === entries[name].sha256, 'Previous manifest mismatch: ' + name);
    }
    for (const [name, digest] of originals) {
      const file = path.join(cssDir, name);
      const now = await readIfExists(file);
      assert(now && sha(now) === digest, 'Baseline changed during cleanup: ' + name);
      checkArchive(await readIfExists(file + '.gz'), now, name, manifest.entries[name]);
      await fs.unlink(file);
    }
    for (const name of shotNames) {
      const shot = path.join(shotsDir, name);
      if (await readIfExists(shot)) await fs.unlink(shot);
    }
  }
  if (restore) {
    assert(manifest, 'No compressed-baseline manifest to restore from');
    for (const name of names) {
      const filename = path.join(cssDir, name);
      const packed = await readIfExists(filename + '.gz');
      const bytes = checkArchive(packed, null, name, manifest.entries[name]);
      const existing = await readIfExists(filename);
      if (existing) assert(existing.equals(bytes), 'Existing baseline differs: ' + name);
      else await fs.writeFile(filename, bytes, { flag: 'wx' });
    }
  }
  const report = { mode: compact ? 'compact' : restore ? 'restore' : 'scan', baselines: [], screenshots: [] };
  for (const name of names) {
    const original = await readIfExists(path.join(cssDir, name));
    const compressed = await readIfExists(path.join(cssDir, name + '.gz'));
    if (compressed && manifest) checkArchive(compressed, original, name, manifest.entries[name]);
    report.baselines.push({ name, originalBytes: original?.length ?? 0, archivedBytes: compressed?.length ?? 0 });
  }
  for (const name of shotNames) {
    const file = await readIfExists(path.join(shotsDir, name));
    if (file) report.screenshots.push({ name, bytes: file.length });
  }
  report.protectedDirectories = ['.cover-studio/', 'assets/', 'src/data/', 'dist/', '.audit/mobile-scroll-investigation-20261026/', '.audit/faststart-ready/', '.audit/phase1-safe-cleanup-20261112/'];
  return report;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] || 'scan';
  if (!['scan', 'compact', 'restore'].includes(mode)) {
    console.error('Usage: node scripts/maintenance/compact-local-audit.mjs [scan|compact|restore]');
    process.exitCode = 2;
  } else {
    console.log(JSON.stringify(await inspect({ compact: mode === 'compact', restore: mode === 'restore' }), null, 2));
  }
}
