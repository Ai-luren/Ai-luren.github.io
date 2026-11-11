// Validates last actual video frame, live gallery refresh and exactly three old images.
// The official portfolio is only read: all state changes happen in an isolated clone.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {createCoverStudio} from '../../../portfolio-workbench/server.mjs';
import {createSafePage,getSafeMediaReport} from '../../lib/safe-media.mjs';

const root=path.resolve(import.meta.dirname,'../../..');
const work=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-yueyang-last-'));
const dir=(...args)=>path.join(work,...args);
const hash=async p=>createHash('sha256').update(await fs.readFile(p)).digest('hex');
for(const rel of ['src','assets/images','index.html','works.html']){
 await fs.cp(path.join(root,rel),dir(rel),{recursive:true});
}
await fs.symlink(path.join(root,'node_modules'),dir('node_modules'));
await fs.writeFile(dir('package.json'),'{"type":"module"}\n');
const paths=JSON.parse(await fs.readFile(dir('src/data/local-video-paths.json'),'utf8'));
const video=paths['06'];
assert(video,'Yueyang source must be available');
const videoDest=dir('assets/videos/works',video);
await fs.mkdir(path.dirname(videoDest),{recursive:true});
await fs.copyFile(path.join(root,'assets/videos/works',video),videoDest);
const recordDir=dir('.cover-studio/project-revisions/poster-history/06');
await fs.mkdir(path.dirname(recordDir),{recursive:true});
await fs.cp(path.join(root,'.cover-studio/project-revisions/poster-history/06'),recordDir,{recursive:true});
const coverFile=dir('assets/images/project-covers/commercial/Yueyang Tower Tourism Film.webp');
const posterFile=dir('assets/images/player-posters/commercial/Yueyang Tower Tourism Film.webp');
const before={cover:await hash(coverFile),poster:await hash(posterFile),
  meta:JSON.parse(await fs.readFile(dir('src/data/project-video-metadata.json'),'utf8'))};
const coverHistory=dir('.cover-studio/project-revisions/cover-history/06');
await fs.mkdir(coverHistory,{recursive:true});
for(let i=0;i<4;i++){
 const id=randomUUID();
 await fs.copyFile(coverFile,path.join(coverHistory,id+'-previous.webp'));
 await fs.writeFile(path.join(coverHistory,id+'.json'),JSON.stringify({
  at:new Date(Date.UTC(2026,0,i+1)).toISOString(),
  action:'replace-card-cover',projectId:'06',
 })+'\n');
}
const original=await fs.readFile(path.join(root,'src/data/project-video-metadata.json'),'utf8');
let app,browser;
try{
 app=await createCoverStudio({projectRoot:work,port:5291});
 const base=app.url;
 const get=async path=>{
   const r=await fetch(base+path);
   if(!r.ok)throw new Error(await r.text());
   return r.json();
 };
 const coverBefore=await get('/api/artwork-history?kind=cover&projectId=06');
 const posterBefore=await get('/api/artwork-history?kind=poster&projectId=06&variantId=main');
 assert.equal(coverBefore.entries.length,3);
 assert.equal(posterBefore.entries.length,3);
 const cb=await fs.readdir(coverHistory);
 const pb=await fs.readdir(recordDir);
 assert.equal(cb.filter(x=>x.endsWith('.webp')).length,3);
 assert.equal(pb.filter(x=>x.endsWith('.webp')).length,3);
 console.log('HISTORY_STARTUP_PRUNES_EXISTING_OLDER_THAN_THREE');

 browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
 const page=await createSafePage(browser,{viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.goto(base);
 await page.waitForFunction(()=>document.querySelectorAll('.ux-project').length===8);
 await page.locator('#ux-search').fill('岳阳楼');
 await page.locator('.ux-project').first().locator('.ux-project-image').click();
 await page.waitForFunction(()=>document.querySelector('#ux-video-preview')?.readyState>=2);
 assert(await page.locator('#ux-close-editor').isVisible());
 assert((await page.locator('#ux-close-editor').getAttribute('aria-label')).includes('关闭'));

 await page.locator('#ux-change-poster').click();
 await page.waitForFunction(()=>!document.querySelector('#ux-inline-save').disabled,null,{timeout:30000});
 assert(await page.locator('#ux-inline-last').isEnabled());
 await page.locator('#ux-inline-last').click();
 await page.waitForFunction(()=>document.querySelector('#ux-inline-title')?.textContent.includes('尾帧'),null,{timeout:30000});
 await page.waitForFunction(()=>!document.querySelector('#ux-inline-save').disabled,null,{timeout:30000});
 const input=Number(await page.locator('#ux-inline-time-input').inputValue());
 assert(input>130 && input<134,'last video frame must be near 133.87 sec, not 0');
 const preview=await page.locator('#ux-poster-img').evaluate(async img=>{await img.decode();return [img.naturalWidth,img.naturalHeight]});
 assert(preview[0]/preview[1]>1.7);
 await page.screenshot({path:'/tmp/yueyang-fixed-lastframe.png'});
 console.log('LAST_FRAME_SELECTED',input,preview);

 // Click close while export is running: it must not cancel the subsequent refresh.
 await page.locator('#ux-inline-save').click();
 await page.locator('#ux-close-editor').click();
 assert(await page.locator('#ux-editor').isVisible(),'cannot exit during export');
 await page.waitForFunction(()=>document.querySelector('#ux-inline-cover').hidden,null,{timeout:80000});
 const now=JSON.parse(await fs.readFile(dir('src/data/project-video-metadata.json'),'utf8'));
 assert(now['06'].playerPosterTime>130);
 if(before.meta['06'].playerPosterTime<=130){
   assert.notEqual(await hash(posterFile),before.poster);
 }else{
   assert.equal(await hash(posterFile),before.poster,
     'Re-selecting the same real last video frame should be byte-identical');
 }
 assert.equal(await hash(coverFile),before.cover);
 const playerPoster=await page.locator('#ux-video-preview').getAttribute('poster');
 assert(playerPoster.includes('?v='),'player poster must update even if MP4 is unchanged');
 const image=await page.locator('#ux-poster-img').evaluate(async img=>{await img.decode();return img.src});
 assert(image.includes('v='));
 const historyAfter=await get('/api/artwork-history?kind=poster&projectId=06&variantId=main');
 assert.equal(historyAfter.entries.length,3);
 console.log('SAVED_LAST_FRAME_TIME_NOT_ZERO_AND_RIGHT_PREVIEW_REFRESHED');

 await page.locator('#ux-change-cover').click();
 await page.waitForFunction(()=>!document.querySelector('#ux-inline-save').disabled,null,{timeout:30000});
 await page.locator('#ux-inline-last').click();
 await page.waitForFunction(()=>document.querySelector('#ux-inline-title')?.textContent.includes('尾帧'),
   null,{timeout:30000});
 await page.waitForFunction(()=>!document.querySelector('#ux-inline-save').disabled,null,{timeout:30000});
 await page.locator('#ux-inline-save').click();
 await page.waitForFunction(()=>document.querySelector('#ux-inline-cover').hidden,null,{timeout:80000});
 assert.notEqual(await hash(coverFile),before.cover);
 const card=page.locator('#ux-gallery .ux-project[data-id="06"] img').first();
 const src=await card.getAttribute('src');
 assert(src.startsWith('/project-cover/06?v='));
 const bytes=await (await fetch(base+src)).arrayBuffer();
 assert.equal(createHash('sha256').update(Buffer.from(bytes)).digest('hex'),await hash(coverFile));
 assert.equal((await get('/api/artwork-history?kind=cover&projectId=06')).entries.length,3);
 console.log('COVER_CARD_REFRESHED_AND_HISTORY_CAPPED_3');

 assert.equal(getSafeMediaReport(page).urls.length,0);
 assert.deepEqual(errors,[]);
 await page.close();


 assert.equal(await fs.readFile(path.join(root,'src/data/project-video-metadata.json'),'utf8'),original);
 console.log('ALL_YUEYANG_END_AND_RETENTION_TESTS_PASSED',work);
}finally{
 if(browser)await browser.close();
 if(app)await app.close();
}
