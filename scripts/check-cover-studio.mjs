// Current unified cover workflow, tested against generated media in an isolated project.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {createSafePage,getSafeMediaReport} from './lib/safe-media.mjs';
import {createCoverStudio} from '../tools/cover-studio/server.mjs';
const root=path.resolve(import.meta.dirname,'..');
const fixture=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-cover-studio-'));
for(const item of ['src','assets/images','index.html','works.html']) await fs.cp(path.join(root,item),path.join(fixture,item),{recursive:true});
await fs.symlink(path.join(root,'node_modules'),path.join(fixture,'node_modules'));await fs.writeFile(path.join(fixture,'package.json'),'{"type":"module"}\n');
const read=async name=>JSON.parse(await fs.readFile(path.join(fixture,'src/data',name+'.json'),'utf8'));
const paths=await read('local-video-paths'),covers=await read('project-cover-overrides'),metadata=await read('project-video-metadata');
const sha=async file=>createHash('sha256').update(await fs.readFile(file)).digest('hex');
const testCases=[['10','640x360'],['12','360x640']];
for(const [id,dims] of testCases){const file=path.join(fixture,'assets/videos/works',paths[id]);await fs.mkdir(path.dirname(file),{recursive:true});execFileSync('ffmpeg',['-v','error','-f','lavfi','-i',`testsrc2=s=${dims}:d=2:r=12`,'-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-movflags','+faststart','-y',file],{timeout:60000});}
let studio,browser;
try{
 studio=await createCoverStudio({projectRoot:fixture,port:5192});
 const boot=await(await fetch(studio.url+'/api/bootstrap')).json();
 const request=(origin,body)=>fetch(studio.url+'/api/export',{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{}),'X-Cover-Token':boot.token},body:JSON.stringify(body)});
 assert.equal((await request('https://example.com',{})).status,403);assert.equal((await request(null,{confirmed:false})).status,400);
 browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
 const page=await createSafePage(browser,{viewport:{width:1440,height:950}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(studio.url);await page.waitForSelector('#ux-gallery .ux-project');
 for(const [id] of testCases){
  const video=path.join(fixture,'assets/videos/works',paths[id]);const cover=path.join(fixture,'assets/images/project-covers',covers[id]);const poster=path.join(fixture,'assets/images/player-posters',metadata[id].playerPoster);
  const before={video:await sha(video),cover:await sha(cover),poster:await sha(poster)};
  await page.locator('#ux-categories [data-filter="social"]').click();await page.locator(`#ux-gallery .ux-project[data-id="${id}"] .ux-project-image`).click();await page.waitForFunction(()=>document.querySelector('#ux-video-preview')?.readyState>=2);
  await page.locator('#ux-change-cover').click();await page.waitForFunction(()=>!document.querySelector('#ux-inline-save')?.disabled,null,{timeout:30000});
  assert.equal(await page.locator('#ux-inline-frames').count(),0);assert.equal(await page.locator('[data-ux-fit="contain"]').getAttribute('aria-pressed'),'true');
  await page.locator('#ux-inline-first').click();await page.waitForFunction(()=>document.querySelector('#ux-inline-title')?.textContent.includes('已选中')&&!document.querySelector('#ux-inline-save').disabled,null,{timeout:30000});
  await page.locator('#ux-inline-save').click();await page.waitForFunction(()=>document.querySelector('#ux-inline-cover')?.hidden,null,{timeout:60000});
  assert.notEqual(await sha(cover),before.cover);assert.equal(await sha(poster),before.poster);assert.equal(await sha(video),before.video);
  const dimensions=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,codec_name','-of','json',cover])).streams[0];assert.deepEqual(dimensions,{codec_name:'webp',width:900,height:1200});
  assert.equal((await read('project-cover-overrides'))[id],covers[id]);assert((await fs.readdir(path.join(fixture,'.cover-studio/project-revisions/cover-history',id))).some(f=>f.endsWith('.json')));
  const card=page.locator(`#ux-gallery .ux-project[data-id="${id}"] img`).first();assert((await card.getAttribute('src')).includes('?v='));await page.locator('#ux-close-editor').click();console.log('COVER_SAVE_PASS',id,'source preserved, poster unchanged, 3:4 WebP and backup');
 }
 assert.deepEqual(errors,[]);assert.equal(getSafeMediaReport(page).urls.length,0);console.log('COVER_WORKFLOW_PASS desktop, cross-origin rejection, no ImageKit requests');
}finally{if(browser)await browser.close();if(studio)await studio.close();}
