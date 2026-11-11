// New-project modal integrates with the existing creation API.
// All MP4 / cover writes happen inside a temporary portfolio clone.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {createCoverStudio} from '../tools/cover-studio/server.mjs';
import {createSafePage,getSafeMediaReport} from './lib/safe-media.mjs';

const root=path.resolve(import.meta.dirname,'..');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-new-project-modal-'));
for(const rel of ['src','assets/images','index.html','works.html'])
 await fs.cp(path.join(root,rel),path.join(temp,rel),{recursive:true});
await fs.writeFile(path.join(temp,'package.json'),'{"type":"module"}\n');
await fs.symlink(path.join(root,'node_modules'),path.join(temp,'node_modules'));
const fixture=path.join(root,'scripts/fixtures/test-landscape.mp4');
const fixtureHash=createHash('sha256').update(await fs.readFile(fixture)).digest('hex');
let server,browser;
try{
 server=await createCoverStudio({projectRoot:temp,port:5304});
 browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
 const p=await createSafePage(browser,{viewport:{width:1440,height:900}});
 const errors=[];p.on('pageerror',e=>errors.push(e.stack));
 p.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url())});
 await p.goto(server.url);
 await p.waitForFunction(()=>document.querySelectorAll('.ux-project').length===8);
 assert.equal(await p.locator('.ux-new-project-tile').count(),0,'featured category must never add');
 assert.equal(await p.locator('.ux-advanced-nav').count(),0,'More tools removed');
 assert.equal(await p.locator('#ux-create').count(),0,'Duplicate global Add button removed');
 for(const cat of ['commercial','short-film','social','visual']){
  await p.locator('[data-filter="'+cat+'"]').click();
  assert.equal(await p.locator('.ux-new-project-tile').count(),1,'missing tile '+cat);
  assert.equal(await p.locator('.ux-new-project-tile').getAttribute('data-category'),cat);
 }
 await p.locator('[data-filter="short-film"]').click();
 await p.locator('.ux-new-project-tile').click();
 assert(await p.locator('#ux-new-editor').isVisible());
 assert.equal(await p.locator('#new-category').inputValue(),'short-film');
 assert.equal(await p.locator('#ux-new-left .source-panel').count(),1);
 assert.equal(await p.locator('#ux-new-left .frame-panel').count(),1);
 assert.equal(await p.locator('#ux-new-right .crop-panel').count(),1);
 assert.equal(await p.locator('#ux-new-right .create-work').count(),1);
 assert(await p.locator('#ux-new-right .create-work').isVisible(),'Shared title and category must be visible before import');
 assert(await p.locator('#ux-new-left .frame-panel').isHidden(),'No disabled frame controls before video import');
 assert(await p.locator('#ux-new-right .crop-panel').isHidden(),'No empty cover previews before video import');
 assert(await p.locator('#ux-new-preimport-note').isVisible(),'Explain automatic two-cover previews before import');
 assert(await p.locator('#new-imagekit-url').isVisible(),'Optional ImageKit filename must be directly visible');
 assert.equal(await p.locator('#ux-new-editor details').count(),0,'No collapsed controls in new work form');
 assert(!(await p.locator('#ux-new-progress').textContent()).includes('/3'),'No false three-step counter');
 assert(await p.locator('#ux-library').isVisible(),'library stays visible behind modal');
 assert(!await p.locator('#ux-new-editor').evaluate(e=>e.closest('body').inert));
 await p.locator('#ux-new-close').click();
 assert(await p.locator('#ux-new-editor').isHidden());
 assert(await p.locator('[data-filter="short-film"][aria-pressed=true]').count()===1);
 assert.equal(await p.locator('#ux-new-editor .source-panel').count(),0,'panels restored');
 console.log('SINGLE_MODAL_AND_CLOSE_RETURNS_TO_ORIGINAL_TAB_PASS');

 await p.locator('.ux-new-project-tile').click();
 await p.locator('#new-title-zh').fill('未保存演示');
 await p.locator('#ux-new-close').click();
 assert(await p.locator('#ux-new-discard').isVisible());
 await p.locator('#ux-new-keep').click();
 assert.equal(await p.locator('#new-title-zh').inputValue(),'未保存演示');
 await p.keyboard.press('Escape');
 assert(await p.locator('#ux-new-discard').isVisible());
 await p.locator('#ux-new-discard-confirm').click();
 assert(await p.locator('#ux-new-editor').isHidden());
 await p.locator('.ux-new-project-tile').click();
 assert.equal(await p.locator('#new-title-zh').inputValue(),'');
 console.log('UNSAVED_CLOSE_KEEP_AND_DISCARD_PASS');

 await p.locator('#video-file').setInputFiles(fixture);
 await p.waitForFunction(()=>document.querySelector('#source-video').readyState>=1
   && document.querySelector('#ux-new-use-frame').disabled===false,null,{timeout:45000});
 await p.waitForFunction(()=>document.querySelector('#ux-new-player-poster')?.naturalWidth>0 &&
   document.querySelector('#preview-placeholder')?.hidden===true,null,{timeout:18000});
 assert(await p.locator('#ux-new-left .frame-panel').isVisible(),'Frame tools appear after importing');
 assert(await p.locator('#ux-new-right .crop-panel').isVisible(),'Auto-selected frame reveals two previews');
 assert(await p.locator('#position-x').isVisible(),'Cover position adjustments must not be hidden in a disclosure');
 assert(await p.locator('#ux-new-preimport-note').isHidden());
 assert.equal(await p.locator('#candidate-grid button').count(),0,'No hidden candidate sampling on new uploads');
 assert.equal(await p.locator('#new-category').inputValue(),'short-film');
 await p.locator('#source-video').evaluate(async v=>{
  v.currentTime=1.5;await new Promise(resolve=>v.addEventListener('seeked',resolve,{once:true}));
 });
 await p.locator('#ux-new-use-frame').click();
 await p.waitForFunction(()=>document.querySelector('#ux-new-player-poster').complete&&
   document.querySelector('#ux-new-player-poster').naturalWidth>0,null,{timeout:15000});
 const playerPosterBeforeCustom=await p.locator('#ux-new-player-poster').getAttribute('src');
 const posterMetadata=await p.locator('#ux-new-poster-ratio').textContent();
 assert(posterMetadata.includes('1280')&&posterMetadata.includes('720'),'original picture should expose actual video size');
 assert(await p.locator('#ux-new-player-poster').isVisible());
 await p.waitForFunction(()=>!document.querySelector('#create-project').disabled===false
   && document.querySelector('#cover-preview')?.width===900
   && document.querySelector('#preview-placeholder')?.hidden===true,null,{timeout:45000});
 const posterCandidate=path.join(root,'assets/images/project-covers/commercial/Yueyang Tower Tourism Film.webp');
 await p.locator('#ux-new-cover-file').setInputFiles(posterCandidate);
 await p.waitForFunction(()=>document.querySelector('#ux-new-status').textContent.includes('自定义'),null,{timeout:15000});
 assert.equal(await p.locator('#ux-new-player-poster').getAttribute('src'),playerPosterBeforeCustom,
   'custom 3:4 artwork must not overwrite the original-aspect player poster');
 assert.equal(await p.locator('#ux-new-player-poster').evaluate(x=>x.naturalWidth),1280);
 const samplePoster=await p.evaluate(()=>{
  const c=document.createElement('canvas');c.width=1280;c.height=720;
  const ctx=c.getContext('2d');ctx.fillStyle='#ec3366';ctx.fillRect(0,0,1280,720);
  return c.toDataURL('image/png').split(',')[1];
 });
 await p.locator('#ux-new-poster-file').setInputFiles({name:'independent-poster.png',mimeType:'image/png',buffer:Buffer.from(samplePoster,'base64')});
 await p.waitForFunction(()=>document.querySelector('#ux-new-poster-meta').textContent.includes('自定义'),null,{timeout:15000});
 assert((await p.locator('#ux-new-player-poster').getAttribute('src')).startsWith('blob:'),'poster should preview imported image');
 console.log('INDEPENDENT_POSTER_PREVIEW_PASS');
 assert(await p.locator('#new-imagekit-url').isVisible(),'ImageKit inputs remain visible after import');
 await p.locator('#new-imagekit-url').fill('https://wrong.example/video.mp4');
 assert.equal(await p.locator('#new-imagekit-url').getAttribute('aria-invalid'),'true');
 assert(await p.locator('#ux-new-imagekit-error').isVisible());
 await p.locator('#new-imagekit-url').fill('invalid-video.mov');
 assert.equal(await p.locator('#new-imagekit-url').getAttribute('aria-invalid'),'true');
 await p.locator('#new-imagekit-url').fill('https://ik.imagekit.io/Ailuren/videos/create-modal-test.mp4');
 assert.equal(await p.locator('#new-imagekit-url').inputValue(),'create-modal-test');
 assert.equal(await p.locator('#new-imagekit-url').getAttribute('aria-invalid'),'false');
 await p.locator('#new-imagekit-url').fill('https://ik.imagekit.io/Ailuren/tr:orig-true/videos/create-modal-test.mp4');
 assert.equal(await p.locator('#new-imagekit-url').inputValue(),'create-modal-test');
 await p.locator('#new-imagekit-url').fill('create-modal-test.mp4');
 assert.equal(await p.locator('#new-imagekit-url').inputValue(),'create-modal-test');

 assert.equal(await p.locator('.ux-new-imagekit-heading a').getAttribute('href'),
   'https://imagekit.io/dashboard/media-library');
 await p.locator('#new-title-zh').fill('创建弹窗测试');
 await p.locator('#new-title-en').fill('Modal Creation Test');
 assert(await p.locator('#create-project').isEnabled());
 assert(await p.locator('#ux-new-save').isEnabled());
 const modalMetrics=await p.evaluate(()=>{
  const a=document.querySelector('#ux-new-editor .ux-new-editor-pane').getBoundingClientRect();
  const c=document.querySelector('#ux-new-close').getBoundingClientRect();
  const root=document.querySelector('#ux-new-editor .ux-new-editor-body');
  return {modalHeight:a.height,modalWidth:a.width,closeWidth:c.width,closeHeight:c.height,
    parentOverflow:root.scrollHeight-root.clientHeight,
    leftOverflow:document.querySelector('#ux-new-left').scrollHeight-document.querySelector('#ux-new-left').clientHeight,
    rightOverflow:document.querySelector('#ux-new-right').scrollHeight-document.querySelector('#ux-new-right').clientHeight};
 });
 assert(modalMetrics.closeWidth>=38&&modalMetrics.closeWidth<=43);
 assert(modalMetrics.parentOverflow===0);
 await p.screenshot({path:'/tmp/ailuren-new-modal-filled.png'});
 await p.locator('#ux-new-save').click();
 await p.waitForFunction(()=>document.querySelector('#status')?.textContent.startsWith('新增成功：'),null,{timeout:120000});
 assert(await p.locator('#ux-new-editor').isHidden());
 assert(await p.locator('#ux-editor').isVisible());
 const detailTitle=await p.locator('#ux-editor-title').textContent();
 assert.equal(detailTitle,'创建弹窗测试');
 const boot=await (await fetch(server.url+'/api/bootstrap')).json();
 const newWork=boot.projects.find(x=>x.title==='创建弹窗测试');
 assert(newWork);
 const createdManaged=boot.managedProjects.find(x=>x.id===newWork.id);
 assert.equal(createdManaged?.versions[0]?.videoUrl,
   'https://ik.imagekit.io/Ailuren/tr:orig-true/videos/create-modal-test.mp4');
 assert.equal(newWork.category,'short-film');
 assert(newWork.titleEn==='Modal Creation Test');
 assert.equal(createHash('sha256').update(await fs.readFile(fixture)).digest('hex'),fixtureHash);
 assert.deepEqual(errors,[]);
 assert.equal(getSafeMediaReport(p).urls.length,0);
 console.log('CUSTOM_COVER_AND_VIDEO_CREATED_IN_ISOLATED_PROJECT_PASS',newWork.id,modalMetrics);
 await p.locator('#ux-close-editor').click();
 assert(await p.locator('#ux-editor').isHidden());
 assert.equal(await p.locator('#ux-new-editor').isHidden(),true);
 console.log('CREATED_DETAIL_CLOSE_RETURNS_TO_LIBRARY_PASS');
 await p.close();
}finally{
 if(browser)await browser.close();
 if(server)await server.close();
}
