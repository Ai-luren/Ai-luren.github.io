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
for(const name of ['src','assets/images','index.html','works.html'])
  await fs.cp(path.join(root,name),path.join(fixture,name),{recursive:true});
await fs.symlink(path.join(root,'node_modules'),path.join(fixture,'node_modules'));
await fs.writeFile(path.join(fixture,'package.json'),'{"type":"module"}\n');
const load=async name=>JSON.parse(await fs.readFile(path.join(fixture,'src/data',name+'.json'),'utf8'));
const auto=await load('auto-projects'), paths=await load('local-video-paths');
const work16=auto.find(p=>p.id==='16'),b=work16.variants[0];
for(const [relative,dims] of [[paths['01'],'1280x720'],[work16.localVideoPath,'1282x720'],[b.localVideoPath,'1282x720']]){
  const dest=path.join(fixture,'assets/videos/works',relative);
  await fs.mkdir(path.dirname(dest),{recursive:true});
  execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=s='+dims+':d=2:r=12',
    '-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-movflags','+faststart','-y',dest],{timeout:60000});
}
const covers=await load('project-cover-overrides'),meta=await load('project-video-metadata');
const cv=path.join(fixture,'assets/images/project-covers',covers['01']);
const pm=path.join(fixture,'assets/images/player-posters',meta['01'].playerPoster);
const pb=path.join(fixture,'assets/images/player-posters',b.posterFile);
const hash=async f=>createHash('sha256').update(await fs.readFile(f)).digest('hex');
const initial={cover:await hash(cv),posterMain:await hash(pm),posterB:await hash(pb)};
let studio,browser;
try{
 studio=await createCoverStudio({projectRoot:fixture,port:5243});
 browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
 const page=await createSafePage(browser,{viewport:{width:1440,height:980}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(studio.url); await page.locator('.ux-advanced-nav').evaluate(x=>x.open=true);
 await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('已载入'));
 await page.evaluate(()=>document.querySelector('[data-ux-advanced="manage"]').click());
 await page.locator('#managed-project').selectOption('01');
 await page.locator('#start-poster-for-managed').click();
 assert.equal(await page.locator('body').getAttribute('data-workflow'),'poster');
 assert.equal(await page.locator('#project-select').inputValue(),'01');
 assert.equal(await page.locator('#poster-variant').inputValue(),'main');
 await page.locator('#current-cover').evaluate(img=>img.decode());
 await page.locator('#import-project-video').click();
 await page.waitForFunction(()=>document.querySelectorAll('.candidates button').length===12,null,{timeout:60000});
 await page.locator('.candidates button').first().click();
 await page.waitForFunction(()=>!document.querySelector('#export-cover').disabled,null,{timeout:60000});
 assert.equal(await page.locator('#preview-wrap').getAttribute('data-preview'),'original');
 await page.locator('#export-cover').click();
 await page.waitForFunction(()=>!document.querySelector('#cover-confirm').hidden,null,{timeout:60000});
 assert(await page.locator('#poster-result').isVisible());
 const oldRatio=await page.locator('#compare-old-cover').evaluate(async img=>{await img.decode();return img.naturalWidth/img.naturalHeight});
 const newRatio=await page.locator('#compare-new-cover').evaluate(async img=>{await img.decode();return img.naturalWidth/img.naturalHeight});
 assert(Math.abs(oldRatio-newRatio)<.002);
 await page.locator('#replace-consent').check();
 await page.locator('#associate-cover').click();
 await page.waitForFunction(()=>!document.querySelector('#cover-confirm-result').hidden,null,{timeout:60000});
 assert.notEqual(await hash(pm),initial.posterMain);
 assert.equal(await hash(cv),initial.cover);
 assert.equal(await hash(pb),initial.posterB);
 assert.equal((await load('project-video-metadata'))['01'].playerPosterTimeSource,'confirmed-poster-selection');
 console.log('LEGACY_MAIN_POSTER_UPDATE_PASS');

 await page.evaluate(()=>document.querySelector('[data-workflow-target="manage"]').click());
 await page.locator('#managed-project').selectOption('16');
 await page.locator('#managed-version-summary .version-overview-item').nth(1).click();
 assert.equal(await page.locator('#managed-variant').inputValue(),b.id);
 await page.locator('#start-poster-for-managed').click();
 assert.equal(await page.locator('#poster-variant').inputValue(),b.id);
 await page.locator('#import-project-video').click();
 await page.waitForFunction(()=>document.querySelectorAll('.candidates button').length===12,null,{timeout:60000});
 await page.locator('.candidates button').nth(3).click();
 await page.waitForFunction(()=>!document.querySelector('#export-cover').disabled,null,{timeout:60000});
 await page.locator('#export-cover').click();
 await page.waitForFunction(()=>!document.querySelector('#cover-confirm').hidden,null,{timeout:60000});
 const mainBefore=(await load('project-video-metadata'))['16'];
 await page.locator('#replace-consent').check();
 await page.locator('#associate-cover').click();
 await page.waitForFunction(()=>!document.querySelector('#cover-confirm-result').hidden,null,{timeout:60000});
 const next=(await load('auto-projects')).find(p=>p.id==='16').variants[0];
 assert.equal(next.posterFile,b.posterFile);
 assert.equal(next.posterTimeSource,'confirmed-poster-selection');
 assert.deepEqual((await load('project-video-metadata'))['16'],mainBefore);
 assert.notEqual(await hash(pb),initial.posterB);
 assert.equal(await hash(cv),initial.cover);
 assert((await fs.readdir(path.join(fixture,'.cover-studio/project-revisions/poster-history/16'))).some(f=>f.endsWith('.json')));
 console.log('VERSION_B_INDEPENDENT_UPDATE_PASS');

 const wrong=path.join(fixture,'portrait-wrong.png');
 execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=blue:s=720x1280:d=0.1',
   '-frames:v','1','-update','1',wrong],{timeout:30000});
 await page.locator('#image-file').setInputFiles(wrong);
 await page.waitForFunction(()=>document.querySelector('#frame-status')?.textContent.includes('720 × 1280'),null,{timeout:60000});
 assert(await page.locator('#export-cover').isDisabled());
 console.log('INCORRECT_ASPECT_BLOCKED');
 assert.deepEqual(errors,[]);
 assert.equal(getSafeMediaReport(page).urls.length,0);
 await page.close();


 console.log('POSTER_WORKFLOW_PASS desktop; no changes to original project',fixture);
}finally{
 if(browser)await browser.close();
 if(studio)await studio.close();
}
