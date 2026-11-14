import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  deduplicateSessionSource,
  restoreIndependentSessionSource,
  inspectSessionStorage,
} from '../../../portfolio-workbench/session-storage.mjs';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cover-studio-store-test-'));
const workspace = path.join(root, '.cover-studio');
const data = Buffer.from('synthetic MP4 fixture - cannot be decoded but has stable content');
// Exercise the real CLI entry point from a separate project-shaped fixture.
// Never let dedupe/restore commands operate on the user's real sessions.
const cliDir = path.join(root, 'portfolio-workbench');
await fs.mkdir(cliDir, { recursive: true });
const cliFile = path.join(cliDir, 'session-storage.mjs');
await fs.copyFile(new URL('../../../portfolio-workbench/session-storage.mjs', import.meta.url), cliFile);
// macOS resolves /var to /private/var inside import.meta.url.
const cli = await fs.realpath(cliFile);
function runCli(mode, ...args) {
  const result = spawnSync(process.execPath, [cli, mode, ...args], {
    cwd: os.tmpdir(), encoding: 'utf8', timeout: 10000,
  });
  assert.equal(result.status, 0, `${mode} CLI failed: ${result.stderr || result.error}`);
  return JSON.parse(result.stdout);
}
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
  assert.equal(runCli('scan').videoSessions, 3, 'CLI must resolve the fixture project, not its parent');
  assert.equal(runCli('scan').uniqueSources, 2);

  assert.equal((await deduplicateSessionSource({ workspace, sessionId: first.id })).action, 'already-linked');
  assert.equal((await deduplicateSessionSource({ workspace, sessionId: second.id })).action, 'linked');
  assert.equal((await deduplicateSessionSource({ workspace, sessionId: unique.id })).action, 'already-linked');
  assert.equal((await deduplicateSessionSource({ workspace, sessionId: second.id })).action, 'already-linked');
  assert.equal(runCli('dedupe').alreadyLinked, 3, 'CLI dedupe must operate only on fixture sessions');

  const store = path.join(workspace, 'source-objects', originalHash + '.mp4');
  assert.equal((await fs.stat(first.file)).ino, (await fs.stat(second.file)).ino);
  assert.equal((await fs.stat(first.file)).ino, (await fs.stat(store)).ino);
  assert.equal((await fs.readFile(first.file)).toString(), data.toString());
  assert.equal((await fs.stat(first.file)).mode & 0o222, 0, 'shared source must be read-only');

  result = await inspectSessionStorage({ workspace, verify: true });
  assert.equal(result.verifiedObjects, 2);
  assert.equal(result.alreadyLinked, 3);
  assert.equal(result.sharedBytes, data.length);
  assert.equal(runCli('verify').verifiedObjects, 2, 'CLI verify must inspect fixture objects');
  await restoreIndependentSessionSource({ workspace, sessionId: second.id });
  assert.notEqual((await fs.stat(first.file)).ino, (await fs.stat(second.file)).ino);
  assert.equal((await fs.readFile(second.file)).toString(), data.toString());
  assert.notEqual((await fs.stat(second.file)).mode & 0o200, 0, 'restored source is writable');
  assert.equal(runCli('restore', second.id).sessionId, second.id, 'CLI restore must target the fixture');
  assert.equal((await fs.readFile(second.file)).toString(), data.toString());

  await fs.unlink(first.file);
  assert.equal((await fs.readFile(store)).toString(), data.toString(), 'store survives session deletion');
  await assert.rejects(() => deduplicateSessionSource({ workspace, sessionId: '../../foo' }),
    /Invalid session identifier/);
  console.log('SESSION_STORE_PASS: byte-perfect SHA-256 grouping, immutable hard links, repeat import, independent restore, canonical data survives removal and traversal is rejected');
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
