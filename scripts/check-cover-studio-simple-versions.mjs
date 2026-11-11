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
  assert.match(await page.locator('.ux-name-section .muted').textContent(),/所有视频版本共用/);
  assert.equal(await page.locator('#ux-variant-chips .ux-variant').count(),2);
  assert.equal(await page.locator('#ux-variant-chips .ux-variant-edit').count(),0,'No pencil to edit version names');
  assert.equal(await page.locator('#ux-rename-current').count(),0,'No duplicate rename control');
  assert.equal(await page.locator('#ux-editor .ux-detail-tabs button').count(),2);
  const rename=page.locator('#ux-version-label-form');
  assert(await rename.isVisible(),'Selected version name fields are permanently visible');
  assert.equal(await rename.evaluate(el=>el.closest('.ux-version-section')!==null),true);
  const originalLabel=await page.locator('#ux-version-label-zh').inputValue();
  assert(await page.locator('.ux-name-section').evaluate(el=>el.getBoundingClientRect().bottom<=document.querySelector('.ux-version-section').getBoundingClientRect().top+1),
    'Shared name must be above the version editor');
  const trash=page.locator('#ux-archive-version');
  assert(await trash.isEnabled(),'With two versions the per-video trash action must be available');
  assert.match(await trash.getAttribute('aria-label'),/仅此视频/);
  assert(await trash.evaluate(el=>{const chips=document.querySelector('#ux-variant-chips').getBoundingClientRect(),t=el.getBoundingClientRect();
    return t.left>=chips.right-1&&Math.abs(t.top-chips.top)<=2&&t.height>=38}),
    'Per-video archive icon must be at the right end of the version-chip row');
  assert.equal(await page.locator('#ux-archive-work').count(),1,'Whole work archive remains a distinct bottom action');
  assert(await page.locator('#ux-version-label-actions').isHidden(),'No idle save/cancel buttons');
  // Switching selected videos with an edited inline name must protect the
  // draft rather than silently discarding or binding it to the wrong video.
  await page.locator('#ux-version-label-zh').fill('未保存版本名');
  await page.locator('#ux-variant-chips .ux-variant').nth(1).click();
  assert(await page.locator('#ux-unsaved-dialog').isVisible());
  await page.locator('#ux-unsaved-keep').click();
  assert.equal(await page.locator('#ux-version-label-zh').inputValue(),'未保存版本名');
  await page.locator('#ux-variant-chips .ux-variant').nth(1).click();
  await page.locator('#ux-unsaved-discard').click();
  assert.equal(await page.locator('#ux-variant-chips .ux-variant[aria-pressed="true"]').count(),1);
  assert.notEqual(await page.locator('#ux-version-label-zh').inputValue(),'未保存版本名');
  assert(await page.locator('#ux-version-label-form').isVisible());
  assert(await page.locator('#ux-version-label-actions').isHidden(),'Switching a version loads its clean name');
  await page.locator('#ux-variant-chips .ux-variant').first().click();
  assert.equal(await page.locator('#ux-version-label-zh').inputValue(),originalLabel);
  await page.locator('#ux-version-label-zh').fill('导演剪辑版');
  await page.locator('#ux-version-label-en').fill('Director Cut');
  assert(await page.locator('#ux-version-label-actions').isVisible(),'Save/revert appear for a real change');
  assert.match(await page.locator('#ux-context-save').textContent(),/未保存/);
  await page.keyboard.press('Escape');
  assert(await rename.isVisible(),'Esc reverts the draft without hiding version fields');
  assert.equal(await page.locator('#ux-version-label-zh').inputValue(),originalLabel);
  assert(await page.locator('#ux-version-label-actions').isHidden());
  assert.equal(await page.evaluate(()=>document.activeElement?.classList.contains('ux-variant')),true,
    'Esc returns focus to selected version label');
  assert(await page.locator('#ux-editor').isVisible());
  await page.locator('#ux-version-label-zh').fill('导演剪辑版');
  await page.locator('#ux-version-label-en').fill('Director Cut');
  await page.locator('#ux-version-label-save').click();
  await page.waitForFunction(()=>document.querySelector('#ux-variant-chips .ux-variant')?.textContent==='导演剪辑版',null,{timeout:20000});
  assert.equal(await page.locator('#ux-title-zh').inputValue(),titleBefore,
    'renaming one version must not rename the shared work');
  // All fields now coexist. Saving one must preserve the draft in another.
  await page.locator('#ux-title-zh').fill(titleBefore+'（临时草稿）');
  await page.locator('#ux-version-label-zh').fill('当前视频草稿');
  await page.locator('#ux-version-label-save').click();
  await page.waitForFunction(()=>document.querySelector('#ux-variant-chips .ux-variant')?.textContent==='当前视频草稿',null,{timeout:10000});
  assert.equal(await page.locator('#ux-title-zh').inputValue(),titleBefore+'（临时草稿）',
    'Saving version name must preserve the unsaved shared work title');
  assert.match(await page.locator('#ux-context-save').textContent(),/未保存/);
  await page.locator('#ux-title-zh').fill(titleBefore);
  await page.locator('#ux-version-label-zh').fill('待保存的当前视频名');
  await page.locator('#ux-url-readonly').click();
  await page.locator('#ux-url-value').fill('https://ik.imagekit.io/Ailuren/videos/inline-keep-draft.mp4');
  await page.locator('#ux-url-save').click();
  await page.waitForFunction(()=>document.querySelector('#ux-url-readonly')?.textContent?.includes('inline-keep-draft.mp4'),null,{timeout:12000});
  assert.equal(await page.locator('#ux-version-label-zh').inputValue(),'待保存的当前视频名',
    'Saving ImageKit URL must preserve the unsaved version name');
  assert(await page.locator('#ux-version-label-actions').isVisible());
  await page.locator('#ux-version-label-cancel').click();
  assert(await page.locator('#ux-version-label-actions').isHidden());
  console.log('CROSS_FIELD_DRAFT_PRESERVATION_PASS');
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
  assert.deepEqual(updated.mainVersionLabel,{zh:'当前视频草稿',en:'Director Cut'});
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
  console.log('SIMPLE_VERSION_UX_PASS: cache, quick search, shared title, always-visible version names, Esc revert, add default C, unsaved file guard, inline edit');
}finally{
  if(browser)await browser.close();
  if(studio)await studio.close();
  await fs.rm(temp,{recursive:true,force:true});
}
