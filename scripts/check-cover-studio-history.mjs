// All writes live in a throwaway fixture; never mutate the portfolio's originals.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {createCoverStudio} from '../tools/cover-studio/server.mjs';
import {createSafePage,getSafeMediaReport} from './lib/safe-media.mjs';

const root=path.resolve(import.meta.dirname,'..');
const fixture=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-history-'));
for(const rel of ['src','assets/images','index.html','works.html'])
 await fs.cp(path.join(root,rel),path.join(fixture,rel),{recursive:true});
await fs.mkdir(path.join(fixture,'.cover-studio/project-revisions/poster-history'),{recursive:true});
await fs.cp(path.join(root,'.cover-studio/project-revisions/poster-history/16'),
 path.join(fixture,'.cover-studio/project-revisions/poster-history/16'),{recursive:true});
await fs.symlink(path.join(root,'node_modules'),path.join(fixture,'node_modules'));
await fs.writeFile(path.join(fixture,'package.json'),'{"type":"module"}\n');
const input=JSON.parse(await fs.readFile(path.join(fixture,'src/data/auto-projects.json'),'utf8'));
const item=input.find(p=>p.id==='16'),variant=item.variants[0];
for(const media of [item.localVideoPath,...item.variants.map(v=>v.localVideoPath)]){
 const dest=path.join(fixture,'assets/videos/works',media);
 await fs.mkdir(path.dirname(dest),{recursive:true});
 await fs.copyFile(path.join(root,'scripts/fixtures/test-landscape.mp4'),dest);
}
const hash=async file=>createHash('sha256').update(await fs.readFile(file)).digest('hex');
const dir=path.join(fixture,'.cover-studio/project-revisions/poster-history/16');
const priorFile=path.join(dir,(await fs.readdir(dir)).find(x=>x.endsWith('.webp')));
const poster=path.join(fixture,'assets/images/player-posters',variant.posterFile);
const meta=JSON.parse(await fs.readFile(path.join(fixture,'src/data/project-video-metadata.json'),'utf8'));
const mainPoster=path.join(fixture,'assets/images/player-posters',meta['16'].playerPoster);
const covers=JSON.parse(await fs.readFile(path.join(fixture,'src/data/project-cover-overrides.json'),'utf8'));
const cover=path.join(fixture,'assets/images/project-covers',covers['16']);
const prodOriginalHash=await hash(path.join(root,'assets/images/player-posters',variant.posterFile));
const initial={poster:await hash(poster),old:await hash(priorFile),main:await hash(mainPoster),
  cover:await hash(cover),auto:await fs.readFile(path.join(fixture,'src/data/auto-projects.json'),'utf8'),
  urls:await fs.readFile(path.join(fixture,'src/data/legacy-imagekit-urls.json'),'utf8')};
assert.notEqual(initial.poster,initial.old);
let studio,browser;
try{
 studio=await createCoverStudio({projectRoot:fixture,port:5285});
 browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
 const page=await createSafePage(browser,{viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.stack));
 page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 await page.goto(studio.url);
 await page.waitForFunction(()=>document.querySelectorAll('.ux-project').length===8);
 await page.locator('[data-filter="commercial"]').click();
 await page.locator('.ux-project[data-id="16"] .ux-project-image').click();
 await page.locator('#ux-variant-chips .ux-variant').nth(1).click();
 await page.locator('[data-ux-panel=artwork]').click();
 await page.locator('#ux-history-poster').click();
 await page.waitForFunction(()=>document.querySelectorAll('#ux-history-list button').length===1);
 assert(await page.locator('#ux-history-dialog').isVisible());
 await page.locator('#ux-history-current').evaluate(img=>img.decode());
 await page.locator('#ux-history-preview').evaluate(img=>img.decode());
 assert.equal(await page.locator('#ux-history-restore').isEnabled(),true);
 await page.screenshot({path:'/tmp/ailuren-history-before-restore.png'});
 const headers={'X-Cover-Token':(await(await fetch(studio.url+'/api/bootstrap')).json()).token,'Content-Type':'application/json'};
 const staleHash=(await(await fetch(studio.url+'/api/artwork-history?kind=poster&projectId=16&variantId='+variant.id)).json()).currentHash;
 await page.locator('#ux-history-restore').click();
 await page.waitForFunction(()=>document.querySelector('#ux-history-dialog').hidden,null,{timeout:30000});
 assert.equal(await hash(poster),initial.old);
 assert.equal(await hash(mainPoster),initial.main);
 assert.equal(await hash(cover),initial.cover);
 let entries=(await(await fetch(studio.url+'/api/artwork-history?kind=poster&projectId=16&variantId='+variant.id)).json()).entries;
 assert.equal(entries.length,2);
 console.log('REAL_EXISTING_POSTER_HISTORY_RESTORE_PASS');

 const stale=await fetch(studio.url+'/api/restore-artwork',{method:'POST',headers,
   body:JSON.stringify({projectId:'16',kind:'poster',variantId:variant.id,revisionId:entries[0].id,
     expectedHash:staleHash,confirmed:true})});
 assert.equal(stale.status,409);
 const cross=await fetch(studio.url+'/artwork-history-image/poster/16/'+entries[0].id+'?variant=main');
 assert.equal(cross.status,404);
 const traversal=await fetch(studio.url+'/api/restore-artwork',{method:'POST',headers,
   body:JSON.stringify({projectId:'16',kind:'poster',variantId:variant.id,revisionId:'../../secret',
     expectedHash:staleHash,confirmed:true})});
 assert.equal(traversal.status,422);
 console.log('STALE_REVISION_CROSS_VARIANT_AND_BAD_ID_BLOCKED');

 await page.locator('#ux-history-poster').click();
 await page.waitForFunction(()=>document.querySelectorAll('#ux-history-list button').length===2);
 await page.locator('#ux-history-restore').click();
 await page.waitForFunction(()=>document.querySelector('#ux-history-dialog').hidden,null,{timeout:30000});
 assert.equal(await hash(poster),initial.poster);
 entries=(await(await fetch(studio.url+'/api/artwork-history?kind=poster&projectId=16&variantId='+variant.id)).json()).entries;
 assert.equal(entries.length,3);
 assert.equal(await hash(mainPoster),initial.main);
 console.log('RESTORED_IMAGE_CAN_BE_REVERSED_LOSSLESSLY');

 await page.locator('#ux-history-cover').click();
 await page.waitForFunction(()=>document.querySelector('#ux-history-status')?.textContent?.includes('还没有可恢复'));
 assert.equal(await page.locator('#ux-history-restore').isEnabled(),false);
 await page.locator('#ux-history-close').click();
 await page.locator('#ux-change-cover').click();
 await page.waitForFunction(()=>!document.querySelector('#ux-inline-save').disabled,null,{timeout:30000});
 await page.locator('#ux-inline-last').click();
 await page.waitForFunction(()=>document.querySelector('#ux-inline-title')?.textContent.includes('尾帧'),null,{timeout:30000});
 await page.waitForFunction(()=>!document.querySelector('#ux-inline-save').disabled,null,{timeout:60000});
 await page.locator('#ux-inline-save').click();
 await page.waitForFunction(()=>document.querySelector('#ux-inline-cover').hidden,null,{timeout:60000});
 assert.notEqual(await hash(cover),initial.cover);
 await page.locator('#ux-history-cover').click();
 await page.waitForFunction(()=>document.querySelectorAll('#ux-history-list button').length===1);
 await page.locator('#ux-history-restore').click();
 await page.waitForFunction(()=>document.querySelector('#ux-history-dialog').hidden,null,{timeout:30000});
 assert.equal(await hash(cover),initial.cover);
 assert.equal(await hash(poster),initial.poster);
 assert.equal(await hash(mainPoster),initial.main);
 console.log('CARD_3_BY_4_HISTORY_RESTORE_PRESERVES_BOTH_POSTERS');

 await page.locator('#ux-history-cover').click();
 await page.waitForFunction(()=>document.querySelectorAll('#ux-history-list button').length===2);
 await page.keyboard.press('Escape');
 assert(await page.locator('#ux-history-dialog').isHidden());
 assert(await page.locator('#ux-editor').isVisible());
 assert.equal(getSafeMediaReport(page).urls.length,0);
 assert.deepEqual(errors,[]);
 await page.close();



 assert.equal(await hash(path.join(root,'assets/images/player-posters',variant.posterFile)),prodOriginalHash);
 assert.equal(await fs.readFile(path.join(fixture,'src/data/legacy-imagekit-urls.json'),'utf8'),initial.urls);
 assert.equal(await fs.readFile(path.join(fixture,'src/data/auto-projects.json'),'utf8'),initial.auto);
 console.log('ALL_ARTWORK_HISTORY_TESTS_PASS in isolated fixture:',fixture);
}finally{
 if(browser)await browser.close();
 if(studio)await studio.close();
}
