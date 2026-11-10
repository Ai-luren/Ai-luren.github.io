import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  deduplicateSessionSource,
  restoreIndependentSessionSource,
  inspectSessionStorage,
} from '../tools/cover-studio/session-storage.mjs';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cover-studio-store-test-'));
const workspace = path.join(root, '.cover-studio');
const data = Buffer.from('synthetic MP4 fixture - cannot be decoded but has stable content');
async function makeVideo(bytes) {
  const id = randomUUID();
  const dir = path.join(workspace, 'sessions', id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'source.mp4'), bytes);
  await fs.writeFile(path.join(dir, 'session.json'),
    JSON.stringify({ id, kind: 'video', source: 'source.mp4', candidates: [] }));
  return { id, file: path.join(dir, 'source.mp4') };
}
try {
  const first = await makeVideo(data);
  const second = await makeVideo(Buffer.from(data));
  const unique = await makeVideo(Buffer.from('a different test video'));
  const originalHash = createHash('sha256').update(data).digest('hex');
  assert.notEqual((await fs.stat(first.file)).ino, (await fs.stat(second.file)).ino);

  let result = await inspectSessionStorage({ workspace });
  assert.equal(result.videoSessions, 3);
  assert.equal(result.uniqueSources, 2);

  assert.equal((await deduplicateSessionSource({ workspace, sessionId: first.id })).action, 'already-linked');
  assert.equal((await deduplicateSessionSource({ workspace, sessionId: second.id })).action, 'linked');
  assert.equal((await deduplicateSessionSource({ workspace, sessionId: unique.id })).action, 'already-linked');
  assert.equal((await deduplicateSessionSource({ workspace, sessionId: second.id })).action, 'already-linked');

  const store = path.join(workspace, 'source-objects', originalHash + '.mp4');
  assert.equal((await fs.stat(first.file)).ino, (await fs.stat(second.file)).ino);
  assert.equal((await fs.stat(first.file)).ino, (await fs.stat(store)).ino);
  assert.equal((await fs.readFile(first.file)).toString(), data.toString());
  assert.equal((await fs.stat(first.file)).mode & 0o222, 0, 'shared source must be read-only');

  result = await inspectSessionStorage({ workspace, verify: true });
  assert.equal(result.verifiedObjects, 2);
  assert.equal(result.alreadyLinked, 3);
  assert.equal(result.sharedBytes, data.length);
  await restoreIndependentSessionSource({ workspace, sessionId: second.id });
  assert.notEqual((await fs.stat(first.file)).ino, (await fs.stat(second.file)).ino);
  assert.equal((await fs.readFile(second.file)).toString(), data.toString());
  assert.notEqual((await fs.stat(second.file)).mode & 0o200, 0, 'restored source is writable');

  await fs.unlink(first.file);
  assert.equal((await fs.readFile(store)).toString(), data.toString(), 'store survives session deletion');
  await assert.rejects(() => deduplicateSessionSource({ workspace, sessionId: '../../foo' }),
    /Invalid session identifier/);
  console.log('SESSION_STORE_PASS: byte-perfect SHA-256 grouping, immutable hard links, repeat import, independent restore, canonical data survives removal and traversal is rejected');
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
