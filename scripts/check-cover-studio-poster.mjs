// Exercise both poster targets through the current unified editor in an isolated project.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {createSafePage,getSafeMediaReport} from './lib/safe-media.mjs';
import {createCoverStudio} from '../tools/cover-studio/server.mjs';

const root=path.resolve(import.meta.dirname,'..');
const fixture=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-poster-edit-'));
for(const name of ['src','assets/images','index.html','works.html']) await fs.cp(path.join(root,name),path.join(fixture,name),{recursive:true});
await fs.symlink(path.join(root,'node_modules'),path.join(fixture,'node_modules'));
await fs.writeFile(path.join(fixture,'package.json'),'{"type":"module"}\n');
const load=async name=>JSON.parse(await fs.readFile(path.join(fixture,'src/data',name+'.json'),'utf8'));
const auto=await load('auto-projects'), paths=await load('local-video-paths');
const work=auto.find(p=>p.id==='16'), variant=work.variants[0];
for(const [relative,dims] of [[paths['01'],'1280x720'],[work.localVideoPath,'1282x720'],[variant.localVideoPath,'1282x720']]){
 const dest=path.join(fixture,'assets/videos/works',relative);await fs.mkdir(path.dirname(dest),{recursive:true});
 execFileSync('ffmpeg',['-v','error','-f','lavfi','-i',`testsrc2=s=${dims}:d=2:r=12`,'-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-movflags','+faststart','-y',dest],{timeout:60000});
}
const covers=await load('project-cover-overrides'),meta=await load('project-video-metadata');
const cover01=path.join(fixture,'assets/images/project-covers',covers['01']);
const cover16=path.join(fixture,'assets/images/project-covers',work.coverFile);
const main=path.join(fixture,'assets/images/player-posters',meta['01'].playerPoster);
const variantPoster=path.join(fixture,'assets/images/player-posters',variant.posterFile);
const main16=path.join(fixture,'assets/images/player-posters',meta['16'].playerPoster);
const hash=async f=>createHash('sha256').update(await fs.readFile(f)).digest('hex');
const before={cover01:await hash(cover01),cover16:await hash(cover16),main:await hash(main),main16:await hash(main16),variant:await hash(variantPoster)};
let studio,browser;
try{
 studio=await createCoverStudio({projectRoot:fixture,port:5243});
 browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
 const page=await createSafePage(browser,{viewport:{width:1440,height:980}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(studio.url);await page.waitForSelector('#ux-gallery .ux-project');
 const open=async id=>{await page.locator('#ux-search').fill(id==='01'?'屈臣氏':'MEXC 会员权益');await page.locator(`#ux-gallery .ux-project[data-id="${id}"] .ux-project-image`).click();await page.waitForFunction(()=>document.querySelector('#ux-video-preview')?.readyState>=2);};
 const savePoster=async()=>{await page.locator('#ux-change-poster').click();await page.waitForFunction(()=>!document.querySelector('#ux-inline-save')?.disabled,null,{timeout:30000});await page.locator('#ux-inline-first').click();await page.waitForFunction(()=>document.querySelector('#ux-inline-title')?.textContent.includes('已选中')&&!document.querySelector('#ux-inline-save').disabled,null,{timeout:30000});const ratio=await page.locator('#ux-inline-original').evaluate(async img=>{await img.decode();return img.naturalWidth/img.naturalHeight});assert(Math.abs(ratio-1280/720)<.02);await page.locator('#ux-inline-save').click();await page.waitForFunction(()=>document.querySelector('#ux-inline-cover')?.hidden,null,{timeout:60000});};
 await open('01');await savePoster();
 assert.notEqual(await hash(main),before.main);assert.equal(await hash(cover01),before.cover01);assert.equal((await load('project-video-metadata'))['01'].playerPosterTimeSource,'confirmed-poster-selection');
 await page.locator('#ux-close-editor').click();await open('16');await page.locator('#ux-variant-chips .ux-variant').nth(1).click();await page.waitForFunction(()=>document.querySelector('#ux-video-preview')?.readyState>=2);await savePoster();
 const updated=(await load('auto-projects')).find(p=>p.id==='16').variants[0];
 assert.equal(updated.posterFile,variant.posterFile);assert.equal(updated.posterTimeSource,'confirmed-poster-selection');
 assert.notEqual(await hash(variantPoster),before.variant);assert.equal(await hash(main16),before.main16);assert.equal(await hash(cover16),before.cover16);
 assert((await fs.readdir(path.join(fixture,'.cover-studio/project-revisions/poster-history/16'))).some(f=>f.endsWith('.json')));
 assert.deepEqual(errors,[]);assert.equal(getSafeMediaReport(page).urls.length,0);
 console.log('POSTER_WORKFLOW_PASS main and variant B independently saved, correct aspect, backups, no ImageKit requests');
}finally{if(browser)await browser.close();if(studio)await studio.close();}
