// Desktop unified editor: explicit frame stepping and inline URL editing.
// All writes are confined to an isolated cloned portfolio; no CDN requests.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {createCoverStudio} from '../tools/cover-studio/server.mjs';
import {createSafePage,getSafeMediaReport} from './lib/safe-media.mjs';
const projectRoot=path.resolve(import.meta.dirname,'..');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-precise-workbench-'));
for(const rel of ['src','assets/images','index.html','works.html'])
  await fs.cp(path.join(projectRoot,rel),path.join(temp,rel),{recursive:true});
await fs.writeFile(path.join(temp,'package.json'),'{"type":"module"}\n');
await fs.symlink(path.join(projectRoot,'node_modules'),path.join(temp,'node_modules'));
const paths=JSON.parse(await fs.readFile(path.join(temp,'src/data/local-video-paths.json'),'utf8'));
const target=path.join(temp,'assets/videos/works',paths['06']);
await fs.mkdir(path.dirname(target),{recursive:true});
await fs.copyFile(path.join(projectRoot,'scripts/fixtures/test-landscape.mp4'),target);
const sha=async p=>createHash('sha256').update(await fs.readFile(p)).digest('hex');
let server,browser;
try{
 server=await createCoverStudio({projectRoot:temp,port:5297});
 browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
 const page=await createSafePage(browser,{viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url());});
 await page.goto(server.url);
 await page.waitForFunction(()=>document.querySelectorAll('.ux-project').length===8);
 await page.locator('#ux-search').fill('岳阳楼');
 await page.locator('.ux-project[data-id="06"] .ux-project-image').click();
 assert.equal(await page.locator('#ux-frame-select').count(),0);
 const nav=await page.locator('.ux-work-nav').boundingBox();
 assert(Math.abs(nav.x+nav.width/2-720)<=5,'global navigation must be truly centered');
 const readonly=page.locator('#ux-url-readonly');
 await readonly.click();
 assert(await page.locator('#ux-url-form').isVisible());
 assert(await readonly.isHidden(),'The URL must appear only once when editing.');
 assert(await page.locator('#ux-url-save').isVisible());
 assert(await page.locator('#ux-url-cancel').isVisible());
 const old=await page.locator('#ux-url-value').inputValue();
 await page.locator('#ux-url-value').fill(old+'?draft=1');
 await page.locator('#ux-close-editor').click();
 assert(await page.locator('#ux-unsaved-dialog').isVisible());
 await page.locator('#ux-unsaved-keep').click();
 await page.locator('#ux-url-value').click();
 await page.locator('#ux-url-value').press('Escape');
 assert(await page.locator('#ux-url-form').isHidden());
 assert.equal(await page.locator('#ux-url-value').inputValue(),old);
 await readonly.click();
 await page.locator('#ux-url-value').fill(old+'?cancel-test=1');
 await page.locator('#ux-url-cancel').click();
 assert(await page.locator('#ux-url-form').isHidden());
 assert(await readonly.isVisible());
 assert.equal(await page.locator('#ux-url-value').inputValue(),old);
 await readonly.click();
 const url='https://ik.imagekit.io/Ailuren/tr:orig-true/videos/precision-verified.mp4';
 await page.locator('#ux-url-value').fill(url);
 const urlRow=await page.locator('#ux-url-form .ux-url-edit-row').evaluate(row=>{
   const heights=[...row.children].map(x=>x.getBoundingClientRect().height);
   const tops=[...row.children].map(x=>x.getBoundingClientRect().top);
   return {heights,tops};
 });
 assert(urlRow.heights.every(h=>Math.abs(h-urlRow.heights[0])<=1),JSON.stringify(urlRow));
 assert(urlRow.tops.every(y=>Math.abs(y-urlRow.tops[0])<=1),JSON.stringify(urlRow));
 await page.locator('#ux-url-save').click();
 await page.waitForFunction(x=>document.querySelector('#ux-url-readonly')?.textContent===x,url,{timeout:10000});
 assert.equal(JSON.parse(await fs.readFile(path.join(temp,'src/data/legacy-imagekit-urls.json'),'utf8'))['06'],url);
 console.log('INLINE_URL_SINGLE_CLICK_SAVE_ESCAPE_AND_DRAFT_PASS');
 await page.locator('#ux-change-poster').click();
 await page.waitForFunction(()=>document.querySelector('#ux-inline-save')?.disabled===false,
   null,{timeout:25000});
 assert.equal(await page.locator('#ux-inline-frames').count(),0);
 assert.equal(await page.locator('.ux-frame-placeholder').count(),0);
 assert.equal(await page.locator('#ux-inline-grab').count(),0);
 assert.equal(await page.locator('#ux-frame-progress').textContent(),'可逐帧定位');
 assert.equal(await page.locator('.ux-time-field').count(),0);
 assert.equal(await page.locator('#ux-frame-step-label').count(),0);
 assert(await page.locator('#ux-inline-time-input').isHidden());
 assert(await page.locator('#ux-inline-save').isEnabled());
 assert((await page.locator('#ux-inline-save').textContent()).includes('保存当前画面'));
 const buttonHeight=await page.locator('#ux-inline-first,#ux-inline-prev,#ux-inline-next,#ux-inline-last')
  .evaluateAll(xs=>xs.map(x=>x.getBoundingClientRect().height));
 assert(buttonHeight.every(h=>Math.abs(h-buttonHeight[0])<1),JSON.stringify(buttonHeight));
 const posterPath=path.join(temp,'assets/images/player-posters/commercial/Yueyang Tower Tourism Film.webp');
 const posterOriginal=await sha(posterPath);
 // A single step is one *actual* frame based on source metadata (12fps here).
 await page.locator('#ux-inline-first').click();
 await page.waitForFunction(()=>document.querySelector('#ux-inline-title').textContent.includes('已选中')
  && document.querySelector('#ux-inline-save').disabled===false,null,{timeout:30000});
 let t=Number(await page.locator('#ux-inline-time-input').inputValue());
 assert(Math.abs(t)<.0001);
 await page.locator('#ux-inline-next').click();
 await page.waitForFunction(()=>Math.abs(Number(document.querySelector('#ux-inline-time-input').value)-1/12)<.001
  && !document.querySelector('#ux-inline-save').disabled,null,{timeout:30000});
 await page.locator('#ux-inline-prev').click();
 await page.waitForFunction(()=>Number(document.querySelector('#ux-inline-time-input').value)<.001
  && !document.querySelector('#ux-inline-save').disabled,null,{timeout:30000});
 await page.locator('#ux-inline-last').click();
 await page.waitForFunction(()=>document.querySelector('#ux-inline-title').textContent.includes('尾帧')
  && !document.querySelector('#ux-inline-save').disabled,null,{timeout:30000});
 t=Number(await page.locator('#ux-inline-time-input').inputValue());
 assert(t>11&&t<12);
 await page.locator('#ux-inline-save').click();
 await page.waitForFunction(()=>document.querySelector('#ux-inline-cover')?.hidden===true,null,{timeout:60000});
 assert.notEqual(await sha(posterPath),posterOriginal);
 console.log('FIRST_PREV_NEXT_LAST_SINGLE_SAVE_PASS',t,'no visible timestamp or fps');
 // From a fresh picker, no selection is needed: one Save extracts playhead and writes.
 await page.locator('#ux-change-cover').click();
 await page.waitForFunction(()=>!document.querySelector('#ux-inline-save')?.disabled,null,{timeout:30000});
 assert((await page.locator('#ux-inline-save').textContent()).includes('保存当前画面'));
 const coverPath=path.join(temp,'assets/images/project-covers/commercial/Yueyang Tower Tourism Film.webp');
 const coverOriginal=await sha(coverPath);
 await page.locator('#ux-inline-save').click();
 await page.waitForFunction(()=>document.querySelector('#ux-inline-cover')?.hidden===true,null,{timeout:60000});
 assert.notEqual(await sha(coverPath),coverOriginal);
 console.log('SINGLE_SAVE_WITHOUT_SECOND_SET_FRAME_ACTION_PASS');
 assert.deepEqual(errors,[]);
 assert.equal(getSafeMediaReport(page).urls.length,0);
 await page.close();
}finally{
 if(browser)await browser.close();
 if(server)await server.close();
}
