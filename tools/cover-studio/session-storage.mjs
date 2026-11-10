import { createReadStream } from 'node:fs';
import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Content-addressed, read-only store for temporary session MP4 files.
// All session URLs and export metadata continue to use sessions/<id>/source.mp4.
// Hard links live within the same .cover-studio volume; never link a formal
// project asset or modify anything under assets/videos/works.
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const OBJECT_NAME = /^[a-f0-9]{64}\.mp4$/;

async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

function sessionPath(workspace, sessionId) {
  if (!UUID.test(sessionId)) throw new Error('Invalid session identifier');
  return path.join(workspace, 'sessions', sessionId);
}

async function videoSource(workspace, sessionId) {
  const folder = sessionPath(workspace, sessionId);
  const folderInfo = await fs.lstat(folder);
  if (!folderInfo.isDirectory() || folderInfo.isSymbolicLink()) throw new Error('Unsafe session folder');
  const record = JSON.parse(await fs.readFile(path.join(folder, 'session.json'), 'utf8'));
  if (record.id !== sessionId || record.kind !== 'video' || record.source !== 'source.mp4') {
    throw new Error('Not a completed MP4 session');
  }
  const source = path.join(folder, 'source.mp4');
  const info = await fs.lstat(source);
  if (!info.isFile() || info.isSymbolicLink() || info.size <= 0) throw new Error('Unsafe source MP4');
  return { folder, source, info };
}

function unchanged(before, after) {
  return before.dev === after.dev && before.ino === after.ino
    && before.size === after.size && before.mtimeMs === after.mtimeMs;
}

export async function deduplicateSessionSource({ workspace, sessionId }) {
  const { folder, source, info } = await videoSource(workspace, sessionId);
  const hash = await digest(source);
  if (!unchanged(info, await fs.lstat(source))) throw new Error('Session video changed during hashing');
  const store = path.join(workspace, 'source-objects');
  await fs.mkdir(store, { recursive: true });
  const object = path.join(store, hash + '.mp4');
  let present = true;
  try {
    const existing = await fs.lstat(object);
    if (!existing.isFile() || existing.isSymbolicLink() || existing.size !== info.size) {
      throw new Error('Content store object is invalid');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    present = false;
  }
  if (!present) {
    try {
      // Linking the first source is lossless and does not duplicate its bytes.
      await fs.link(source, object);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  // Detect corrupted/replaced objects before binding any further sessions.
  if (await digest(object) !== hash) throw new Error('Content store hash mismatch');
  const stored = await fs.lstat(object);
  if (!stored.isFile() || stored.isSymbolicLink()) throw new Error('Unsafe stored source');
  if (!unchanged(info, await fs.lstat(source))) throw new Error('Session video changed before linking');
  if (info.dev === stored.dev && info.ino === stored.ino) {
    await fs.chmod(object, 0o444);
    return { action: 'already-linked', hash, bytes: info.size };
  }
  const temporary = path.join(folder, '.source-link-' + randomUUID() + '.tmp');
  try {
    await fs.link(object, temporary);
    if (!unchanged(info, await fs.lstat(source))) throw new Error('Session video changed before replacement');
    // Atomic path replacement: no consumer sees a partially written MP4.
    await fs.rename(temporary, source);
  } finally {
    await fs.rm(temporary, { force: true });
  }
  // Read-only prevents accidental in-place changes to all shared hard links.
  await fs.chmod(object, 0o444);
  return { action: 'linked', hash, bytes: info.size };
}

export async function restoreIndependentSessionSource({ workspace, sessionId }) {
  const { folder, source, info } = await videoSource(workspace, sessionId);
  const temporary = path.join(folder, '.source-restoring-' + randomUUID() + '.tmp');
  try {
    // The restored source is a separate file (CoW-cloned where supported).
    await fs.copyFile(source, temporary, constants.COPYFILE_EXCL | constants.COPYFILE_FICLONE);
    await fs.chmod(temporary, 0o644);
    if (!unchanged(info, await fs.lstat(source))) throw new Error('Session video changed during restore');
    if (await digest(source) !== await digest(temporary)) throw new Error('Restore hash mismatch');
    await fs.rename(temporary, source);
  } finally {
    await fs.rm(temporary, { force: true });
  }
  return { sessionId, bytes: info.size, independent: true };
}

export async function inspectSessionStorage({ workspace, apply = false, verify = false }) {
  const folder = path.join(workspace, 'sessions');
  const entries = await fs.readdir(folder, { withFileTypes: true });
  const sessions = entries.filter(e => e.isDirectory() && UUID.test(e.name));
  const objects = path.join(workspace, 'source-objects');
  const groups = new Map();
  const totals = { sessions: sessions.length, videoSessions: 0, bytes: 0,
    uniqueSources: 0, sharedBytes: 0, relinked: 0, alreadyLinked: 0,
    previewJpg: 0, previewPng: 0, previewBytes: 0, skipped: 0 };
  for (const entry of sessions) {
    const files = await fs.readdir(path.join(folder, entry.name));
    for (const file of files) {
      if (/^candidate-\d+\.jpg$/.test(file) || /^frame-[a-f0-9-]+\.png$/.test(file)) {
        const item = path.join(folder, entry.name, file);
        const s = await fs.lstat(item);
        if (s.isFile() && !s.isSymbolicLink()) {
          if (file.endsWith('.jpg')) totals.previewJpg++;
          else totals.previewPng++;
          totals.previewBytes += s.size;
        }
      }
    }
    let record;
    try {
      record = await videoSource(workspace, entry.name);
    } catch (error) {
      if (error.code === 'ENOENT' || error.message === 'Not a completed MP4 session') {
        totals.skipped++;
        continue;
      }
      throw error;
    }
    const hash = await digest(record.source);
    if (verify && hash !== await digest(record.source)) throw new Error('Source hash mismatch');
    totals.videoSessions++;
    totals.bytes += record.info.size;
    groups.set(hash, { copies: (groups.get(hash)?.copies || 0) + 1, size: record.info.size });
    const object = path.join(objects, hash + '.mp4');
    let stored = null;
    try { stored = await fs.lstat(object); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (stored) {
      if (!stored.isFile() || stored.isSymbolicLink()) throw new Error('Unsafe store object: ' + hash);
      if (verify && await digest(object) !== hash) throw new Error('Store object corrupted: ' + hash);
      if (stored.ino === record.info.ino && stored.dev === record.info.dev) {
        totals.alreadyLinked++;
      }
    }
    if (apply) {
      const result = await deduplicateSessionSource({ workspace, sessionId: entry.name });
      if (result.action === 'linked') totals.relinked++;
    }
  }
  totals.uniqueSources = groups.size;
  totals.sharedBytes = totals.bytes - [...groups.values()].reduce((sum, group) => sum + group.size, 0);
  if (verify) {
    let names = [];
    try { names = await fs.readdir(objects); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    for (const name of names) {
      if (!OBJECT_NAME.test(name)) throw new Error('Unexpected file in source object store: ' + name);
      if (await digest(path.join(objects, name)) !== name.slice(0, -4)) {
        throw new Error('Object verification failed: ' + name);
      }
    }
    totals.verifiedObjects = names.length;
  }
  return totals;
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const workspace = path.join(root, '.cover-studio');
  const mode = process.argv[2] || 'scan';
  if (!['scan', 'dedupe', 'verify', 'restore'].includes(mode)) {
    console.error('Usage: node tools/cover-studio/session-storage.mjs [scan|dedupe|verify|restore <session-uuid>]');
    process.exitCode = 2;
  } else if (mode === 'restore') {
    console.log(JSON.stringify(await restoreIndependentSessionSource({ workspace, sessionId: process.argv[3] }), null, 2));
  } else {
    const result = await inspectSessionStorage({ workspace, apply: mode === 'dedupe', verify: mode === 'verify' });
    console.log(JSON.stringify({ mode, ...result }, null, 2));
  }
}
