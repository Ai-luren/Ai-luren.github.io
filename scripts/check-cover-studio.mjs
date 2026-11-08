import { createSafePage, createSafeContext } from './lib/safe-media.mjs';
// End-to-end checks write only to an isolated temporary project, never the real covers.
import { createCoverStudio } from '../tools/cover-studio/server.mjs';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = process.cwd();
const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'ailuren-cover-studio-'));
for (const file of ['src', 'assets/images', 'works.html']) await fs.cp(path.join(root, file), path.join(fixture, file), { recursive: true });
await fs.mkdir(path.join(fixture, 'screenshots'), { recursive: true });
await fs.mkdir(path.join(fixture, 'assets/videos'), { recursive: true });
await fs.symlink(path.join(root, 'assets/videos/works'), path.join(fixture, 'assets/videos/works'));
await fs.symlink(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'));
await fs.writeFile(path.join(fixture, 'package.json'), '{"type":"module"}');
// All 17 published covers now have canonical category-based paths. Do not clear the fixture mapping.
const realMappingBefore = await fs.readFile(path.join(root, 'src/data/project-cover-overrides.json'), 'utf8');
const tool = await createCoverStudio({ projectRoot: fixture, port: 5192 });
const vite = await createServer({ root: fixture, configFile: path.join(root, 'vite.config.js'), server: { host: '127.0.0.1', port: 5193, strictPort: true, fs: { allow: [fixture, root] } }, logLevel: 'error' });
await vite.listen();
const browser = await chromium.launch({ executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', headless: true });
const page = await createSafePage(browser, { viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const mapping = () => fs.readFile(path.join(fixture, 'src/data/project-cover-overrides.json'), 'utf8').then(JSON.parse);
const ffprobe = file => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,codec_name', '-of', 'json', file])).streams[0];
const sha = async file => createHash('sha256').update(await fs.readFile(file)).digest('hex');
try {
  await page.goto(tool.url); await page.locator('.ux-advanced-nav').evaluate(x=>x.open=true); await page.waitForFunction(() => document.querySelector('#status').textContent.includes('已载入') || document.querySelector('#status').textContent.includes('就绪'));
  await page.evaluate(()=>document.querySelector('[data-ux-advanced="cover"]').click());
  const boot = await (await fetch(`${tool.url}/api/bootstrap`)).json();
  const blocked = await fetch(`${tool.url}/api/export`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://example.com', 'X-Cover-Token': boot.token }, body: '{}' });
  assert.equal(blocked.status, 403);
  const unconfirmed = await fetch(`${tool.url}/api/export`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Cover-Token': boot.token }, body: JSON.stringify({ confirmed: false }) });
  assert.equal(unconfirmed.status, 400);
  const localVideoPaths=JSON.parse(await fs.readFile(path.join(root,'src/data/local-video-paths.json'),'utf8'));
  const inputs = [
    ['landscape', '10', 'assets/videos/works/'+localVideoPaths['10']],
    ['portrait', '12', 'assets/videos/works/'+localVideoPaths['12']],
  ];
  for (const [kind, projectId, source] of inputs) {
    const original = path.join(root, source), before = await sha(original), beforeMap = await mapping();
    await page.locator('#project-select').selectOption(projectId);
    await page.locator('#video-file').setInputFiles(original);
    await page.waitForFunction(() => document.querySelectorAll('.candidates button').length === 12 && !document.querySelector('#video-file').disabled, null, { timeout: 120000 });
    assert.equal(await page.locator('.candidates button').count(), 12);
    const sessionNames = await fs.readdir(path.join(fixture, '.cover-studio/sessions'));
    const retained = await Promise.all(sessionNames.map(async id => {
      const dir = path.join(fixture, '.cover-studio/sessions', id);
      return { dir, data: JSON.parse(await fs.readFile(path.join(dir, 'session.json'), 'utf8')) };
    }));
    const imported = retained.find(s => s.data.name === path.basename(original));
    assert(imported);
    assert.equal(await sha(path.join(imported.dir, imported.data.source)), before);
    for (let i = 0; i < 12; i++) assert((await fs.stat(path.join(imported.dir, `candidate-${i}.jpg`))).size > 0);
    assert.equal(await page.locator('.candidates button[aria-pressed="true"]').count(), 0);
    assert(await page.locator('#export-cover').isDisabled());
    assert.deepEqual(await mapping(), beforeMap);
    await page.locator('.candidates button').nth(3).click();
    await page.waitForFunction(() => !document.querySelector('#export-cover').disabled);
    await page.locator('#timeline details').evaluate(el=>{el.open=true;});
    await page.locator('#time-input').fill('5.125'); await page.locator('#seek-frame').click();
    await page.waitForFunction(() => !document.querySelector('#export-cover').disabled && document.querySelector('#frame-status').textContent.startsWith('00:05.125'));
    await page.locator('[data-mode="cover"]').click();
    const canvas = page.locator('#cover-preview'); await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + (kind === 'landscape' ? 35 : 0), box.y + box.height / 2 + (kind === 'portrait' ? 35 : 0), { steps: 5 }); await page.mouse.up();
    assert.notEqual(await page.locator(kind === 'landscape' ? '#position-x' : '#position-y').inputValue(), '0.5');
    for (const mode of ['cover', 'contain-blur']) {
      await page.locator(`[data-mode="${mode}"]`).click();
      await page.locator('#export-cover').click();
      await page.waitForFunction(() => !document.querySelector('#export-result').hidden && !document.querySelector('#export-cover').disabled);
      const text = await page.locator('#export-path').innerText(), file = text.split(' · ')[0];
      assert.deepEqual(ffprobe(file), { codec_name: 'webp', width: 900, height: 1200 });
      assert((await fs.stat(file)).size > 1000);
      assert.deepEqual(await mapping(), beforeMap, 'Export must not associate a project.');
      if (mode === 'contain-blur') {
        await page.screenshot({ path: path.join(fixture, 'screenshots', `${kind}.png`), fullPage: true });
        assert.equal(await page.locator('#project-select').inputValue(),projectId,'The selected work must stay unchanged while confirming.');
        assert(await page.locator('#associate-cover').isDisabled());
        assert(await page.locator('#cover-confirm').isVisible(),'The confirmed 3:4 export must remain visible until applied.');
        await page.locator('#replace-consent').check(); await page.locator('#associate-cover').click();
        await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('已更新'));
        const nextMap = await mapping(); assert(nextMap[projectId]);
        assert.equal(nextMap[projectId],boot.overrides[projectId], 'Replacing a cover keeps its stable English-title path.');
        assert((await fs.stat(path.join(fixture, 'assets/images/project-covers', nextMap[projectId]))).size > 0);
        const work = await createSafePage(browser); await work.goto('http://127.0.0.1:5193/works.html'); await work.locator('.library-grid').waitFor();
        if(projectId==='12') await work.locator('.library-filters [data-category="social"]').click();
        const projectTitle = boot.projects.find(p => p.id === projectId).title;
        const card = work.locator('.library-grid .comet-archive__card').filter({ hasText: projectTitle }).first();
        assert(decodeURIComponent(await card.getAttribute('style')).includes(nextMap[projectId]), 'Public library must use the newly associated cover.');
        await card.click(); await work.locator('.cinema-player__play').click(); await work.waitForFunction(() => document.querySelector('video')?.videoWidth > 0); await work.locator('.cinema-player__close').click(); await work.close();
      }
    }
    assert.equal(await sha(original), before, 'Original video must remain untouched.');
    console.log(`${kind}: 12 candidates, manual timestamp, drag, both modes, real WebP files, explicit association and video playback passed.`);
  }
  // Import an existing image without generating video candidates.
  await page.locator('#image-file').setInputFiles(path.join(root, 'assets/images/project-covers/commercial/Wireless Earbuds Lifestyle Ad.webp'));
  await page.waitForFunction(() => !document.querySelector('#export-cover').disabled && document.querySelector('#frame-status').textContent.startsWith('导入图片'));
  assert.equal(await page.locator('.candidates button').count(), 0); await page.locator('#export-cover').click();
  await page.waitForFunction(() => !document.querySelector('#export-result').hidden && !document.querySelector('#export-cover').disabled);
  const imageFile = (await page.locator('#export-path').innerText()).split(' · ')[0]; assert.equal(ffprobe(imageFile).width, 900);
  assert.equal((await mapping())['10'],boot.overrides['10'],'Catalog paths must not change on replacement.');
  const exportedId = path.basename(imageFile, '.webp');
  const featuredResponse = await fetch(`${tool.url}/api/associate`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Cover-Token': boot.token }, body: JSON.stringify({ confirmed: true, replaceExisting: true, projectId: '01', expectedCover: (await mapping())['01'], exportId: exportedId }) });
  assert.equal(featuredResponse.status, 200, 'Featured projects can now replace their 3:4 covers.');
  const featuredMap = await mapping();
  assert.equal(Object.keys(featuredMap).length,17);
  assert.equal(featuredMap['01'],boot.overrides['01']);
  assert((await fs.stat(path.join(fixture,'assets/images/project-covers',featuredMap['01']))).size>0);
  console.log('FEATURED_COVER_REPLACEMENT_PASS: original assets unchanged');
  assert.equal(await fs.readFile(path.join(root, 'src/data/project-cover-overrides.json'), 'utf8'), realMappingBefore);
  assert.deepEqual(errors, []);
  console.log(`Existing-image import, confirmation gates, cross-origin rejection and featured-cover replacement passed.\nIsolated verification files retained at ${fixture}`);
} finally { await browser.close(); await vite.close(); await tool.close(); }
