// Full UX verification: simple add/rename, shared work title, artwork cache, focus and unsaved guard.
// ALL writes occur in an isolated temporary project, never in the actual portfolio.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {createCoverStudio} from '../tools/cover-studio/server.mjs';
import {createSafePage,getSafeMediaReport} from './lib/safe-media.mjs';

const root=path.resolve(import.meta.dirname,'..');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-simple-versions-'));
const mp4=path.join(temp,'fresh-version.mp4');
for(const part of ['src','assets/images','index.html','works.html'])
  await fs.cp(path.join(root,part),path.join(temp,part),{recursive:true});
await fs.symlink(path.join(root,'node_modules'),path.join(temp,'node_modules'));
await fs.writeFile(path.join(temp,'package.json'),'{"type":"module"}\n');
for(const dirname of ['AI Commercials','AI Overseas Product Ads','AI Short Flims','AI Visual Experiments'])
  await fs.mkdir(path.join(temp,'assets/videos/works',dirname),{recursive:true});
execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=size=640x360:rate=12:duration=1.5',
  '-c:v','libx264','-pix_fmt','yuv420p','-y',mp4]);
let studio,browser;
try{
  studio=await createCoverStudio({projectRoot:temp,port:5309});
  browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
  const page=await createSafePage(browser,{viewport:{width:1440,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(studio.url);await page.waitForSelector('#ux-gallery .ux-project');
  const coverResponse=await page.request.get(studio.url+'/project-cover/16?v=0');
  assert.equal(coverResponse.status(),200);
  assert.match(coverResponse.headers()['cache-control'],/private, max-age=600/);
  const initialSrc=await page.locator('#ux-gallery .ux-project-image img').first().getAttribute('src');
  await page.locator('[data-filter="commercial"]').click();
  await page.locator('[data-filter="featured"]').click();
  assert.equal(await page.locator('#ux-gallery .ux-project-image img').first().getAttribute('src'),initialSrc,
    'switching tabs must not create new timestamp URL');
  await page.locator('#ux-search').fill('MEXC');
  await page.locator('#ux-search-clear').click();
  assert.equal(await page.locator('#ux-search').inputValue(),'');
  await page.locator('[data-filter="commercial"]').click();
  const card=page.locator('#ux-gallery .ux-project[data-id="16"]');
  const titleBefore=await card.locator('.ux-name-zh').textContent();
  await card.locator('.ux-project-image').click();
  assert(await page.locator('#ux-editor').isVisible());
  assert.match(await page.locator('.ux-name-section .muted').textContent(),/整部作品共用/);
  assert.equal(await page.locator('#ux-variant-chips .ux-variant').count(),2);
  await page.locator('#ux-variant-chips .ux-variant-edit').first().click();
  const rename=page.locator('#ux-version-label-form');
  assert(await rename.isVisible());
  assert.equal(await rename.evaluate(el=>el.closest('.ux-version-section')!==null),true);
  await page.locator('#ux-version-label-zh').fill('导演剪辑版');
  await page.locator('#ux-version-label-en').fill('Director Cut');
  assert.match(await page.locator('#ux-context-save').textContent(),/未保存/);
  await page.keyboard.press('Escape');
  assert(await rename.isHidden(),'Esc cancels version rename without closing the work');
  assert.equal(await page.evaluate(()=>document.activeElement?.classList.contains('ux-variant-edit')),true,
    'cancel version name should restore focus to the pencil');
  assert(await page.locator('#ux-editor').isVisible());
  await page.locator('#ux-variant-chips .ux-variant-edit').first().click();
  await page.locator('#ux-version-label-zh').fill('导演剪辑版');
  await page.locator('#ux-version-label-en').fill('Director Cut');
  await page.locator('#ux-version-label-save').click();
  await page.waitForFunction(()=>document.querySelector('#ux-variant-chips .ux-variant')?.textContent==='导演剪辑版',null,{timeout:20000});
  assert.equal(await page.locator('#ux-title-zh').inputValue(),titleBefore,
    'renaming one version must not rename the shared work');
  await page.locator('#ux-add-variant').click();
  assert(await page.locator('#ux-version-form').isVisible());
  assert.equal(await page.locator('#ux-version-advanced').evaluate(el=>el.open),false);
  assert.match(await page.locator('#ux-version-proposed').textContent(),/版本 C/);
  assert(await page.locator('#ux-version-submit').isDisabled());
  await page.locator('#ux-version-file').setInputFiles(mp4);
  assert(await page.locator('#ux-version-submit').isEnabled());
  assert.match(await page.locator('#ux-version-file-name').textContent(),/fresh-version.mp4/);
  await page.locator('#ux-close-editor').click();
  assert(await page.locator('#ux-unsaved-dialog').isVisible(),'selected MP4 must trigger unsaved guard');
  await page.locator('#ux-unsaved-keep').click();
  assert(await page.locator('#ux-version-form').isVisible());
  await page.locator('#ux-version-submit').click();
  await page.waitForFunction(()=>document.querySelectorAll('#ux-variant-chips .ux-variant').length===3,null,{timeout:90000});
  const auto=JSON.parse(await fs.readFile(path.join(temp,'src/data/auto-projects.json'),'utf8'));
  const updated=auto.find(p=>p.id==='16');
  assert.equal(updated.variants.length,2);
  assert.deepEqual(updated.mainVersionLabel,{zh:'导演剪辑版',en:'Director Cut'});
  assert.deepEqual(updated.variants.at(-1).label,{zh:'版本 C',en:'Version C'});
  assert.equal(await page.locator('#ux-title-zh').inputValue(),titleBefore);
  assert.equal(getSafeMediaReport(page).urls.length,0);
  assert.deepEqual(errors,[]);
  await page.locator('#ux-close-editor').click();
  await page.locator('[data-filter="commercial"]').click();
  const name=page.locator('#ux-gallery .ux-project[data-id="16"] .ux-name-zh');
  await name.click();
  await page.locator('#ux-gallery .ux-project[data-id="16"] .ux-inline-name').waitFor();
  await page.locator('#ux-gallery .ux-project[data-id="16"] .ux-inline-name').press('Escape');
  assert.equal(await name.textContent(),titleBefore,'Cancel inline work title without writing');
  console.log('SIMPLE_VERSION_UX_PASS: cache, quick search, shared title, compact rename, Esc, add default C, unsaved file guard, inline edit');
}finally{
  if(browser)await browser.close();
  if(studio)await studio.close();
  await fs.rm(temp,{recursive:true,force:true});
}
