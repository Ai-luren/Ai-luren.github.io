// Current unified UX: import an existing cover, preview independently from poster,
// save and retain recoverable history, while protecting real assets.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {createCoverStudio} from '../../../portfolio-workbench/server.mjs';
import {createSafePage,getSafeMediaReport} from '../../lib/safe-media.mjs';

const root=path.resolve(import.meta.dirname,'../../..');
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-current-ux-'));
for(const rel of ['src','assets/images','index.html','works.html'])
  await fs.cp(path.join(root,rel),path.join(tmp,rel),{recursive:true});
await fs.mkdir(path.join(tmp,'assets/videos'),{recursive:true});
await fs.symlink(path.join(root,'assets/videos/works'),path.join(tmp,'assets/videos/works'));
await fs.symlink(path.join(root,'node_modules'),path.join(tmp,'node_modules'));
await fs.writeFile(path.join(tmp,'package.json'),'{"type":"module"}\n');
const covers=JSON.parse(await fs.readFile(path.join(tmp,'src/data/project-cover-overrides.json'),'utf8'));
const metadata=JSON.parse(await fs.readFile(path.join(tmp,'src/data/project-video-metadata.json'),'utf8'));
const cover=path.join(tmp,'assets/images/project-covers',covers['01']);
const poster=path.join(tmp,'assets/images/player-posters',metadata['01'].playerPoster);
const realCover=path.join(root,'assets/images/project-covers',covers['01']);
const sha=async f=>createHash('sha256').update(await fs.readFile(f)).digest('hex');
const hashes={cover:await sha(cover),poster:await sha(poster),real:await sha(realCover)};
let studio,browser;
try {
  studio=await createCoverStudio({projectRoot:tmp,port:5224});
  browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
  const page=await createSafePage(browser,{viewport:{width:1440,height:920}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(studio.url);
  assert.equal(await page.locator('.ux-advanced-nav').count(),0,'No duplicate advanced toolbar');
  await page.locator('#ux-categories [data-filter="commercial"]').click();
  const card=page.locator('#ux-gallery .ux-project[data-id="01"]');
  await card.locator('.ux-project-image').click();
  assert(await page.locator('#ux-editor').isVisible());
  assert.equal(await page.locator('#ux-history-cover').isVisible(),true);
  await page.locator('#ux-change-cover').click();
  assert(await page.locator('#ux-inline-cover').isVisible());
  assert.equal(await page.locator('#ux-inline-cover').getAttribute('data-kind'),'cover');
  assert.equal(await page.locator('#ux-inline-frames').count(),0,'No obsolete 12-thumbnail sampler');
  const source=path.join(root,'assets/images/project-covers/commercial/Wireless Earbuds Lifestyle Ad.webp');
  // Import starts asynchronously; setting the file while busy silently discards
  // the change. Wait for the current session to be ready first.
  await page.locator('#ux-inline-image').waitFor({state:'attached'});
  await page.waitForFunction(()=>!document.querySelector('#ux-inline-image').disabled,null,{timeout:30000});
  await page.locator('#ux-inline-image').setInputFiles(source);
  await page.waitForFunction(()=>!document.querySelector('#ux-inline-save').disabled,null,{timeout:40000});
  assert.deepEqual(await page.locator('#ux-inline-canvas').evaluate(c=>[c.width,c.height]),[900,1200]);
  assert.equal(await page.locator('[data-ux-fit="contain"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#ux-inline-old').evaluate(img=>getComputedStyle(img).objectFit),'contain');
  await page.locator('#ux-inline-save').click();
  await page.waitForFunction(()=>document.querySelector('#ux-inline-cover').hidden,null,{timeout:60000});
  assert(await page.locator('#ux-editor').isVisible());
  assert.notEqual(await sha(cover),hashes.cover,'Imported cover must update local file');
  assert.equal(await sha(poster),hashes.poster,'Player poster is independent');
  assert.equal(await sha(realCover),hashes.real,'Formal original folder was never changed');
  const historyFolder=path.join(tmp,'.cover-studio/project-revisions/cover-history/01');
  assert((await fs.readdir(historyFolder)).some(x=>x.endsWith('.json')),'Reversible cover history exists');
  await page.locator('#ux-history-cover').click();
  assert(await page.locator('#ux-history-dialog').isVisible(),'History viewer opens');
  await page.locator('#ux-history-close').click();
  assert(await page.locator('#ux-history-dialog').isHidden());
  await page.locator('#ux-close-editor').click();
  await page.locator('#ux-categories [data-filter="featured"]').click();
  assert.equal(await page.locator('#ux-gallery .ux-project').count(),8);
  assert.equal(getSafeMediaReport(page).urls.length,0);
  assert.deepEqual(errors,[]);
  console.log('CURRENT_COVER_UX_PASS: imported image, 900x1200 preview, independent poster, reversible history, unchanged originals, unified gallery');
} finally {
  if(browser)await browser.close();
  if(studio)await studio.close();
}
