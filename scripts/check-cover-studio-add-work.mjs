import { createCoverStudio } from '../tools/cover-studio/server.mjs';
import { createSafePage, getSafeMediaReport } from './lib/safe-media.mjs';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
const fixture=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-add-work-test-'));
await fs.cp(path.join(root,'src'),path.join(fixture,'src'),{recursive:true});
await fs.cp(path.join(root,'assets/images'),path.join(fixture,'assets/images'),{recursive:true});
await fs.copyFile(path.join(root,'works.html'),path.join(fixture,'works.html'));
await fs.copyFile(path.join(root,'index.html'),path.join(fixture,'index.html'));
await fs.mkdir(path.join(fixture,'assets/videos/works'),{recursive:true});
await fs.symlink(path.join(root,'node_modules'),path.join(fixture,'node_modules'));
await fs.writeFile(path.join(fixture,'package.json'),'{"type":"module"}');
await fs.writeFile(path.join(fixture,'src/data/auto-projects.json'),'[]\n');
// The fixture resets auto-projects, so also remove their media IDs from the fixture.
const metadataPath=path.join(fixture,'src/data/project-video-metadata.json');
const metadataFixture=JSON.parse(await fs.readFile(metadataPath,'utf8'));
for(const id of Object.keys(metadataFixture)) if(Number(id)>15) delete metadataFixture[id];
await fs.writeFile(metadataPath,JSON.stringify(metadataFixture,null,2)+'\n');
const titlesPath=path.join(fixture,'src/data/project-title-overrides.json');
const titlesFixture=JSON.parse(await fs.readFile(titlesPath,'utf8'));
for(const id of Object.keys(titlesFixture)) if(Number(id)>15) delete titlesFixture[id];
await fs.writeFile(titlesPath,JSON.stringify(titlesFixture,null,2)+'\n');
// This isolated fixture has no auto project 16 yet. Its featured IDs and All
// list must therefore reference only the original fifteen projects.
await fs.writeFile(path.join(fixture,'src/data/project-order.json'),JSON.stringify({
  featured:['01','02','06','03','04','07','08','05'],
  all:Array.from({length:15},(_,i)=>String(i+1).padStart(2,'0')),
},null,2)+'\n');
const original=await fs.readFile(path.join(root,'src/data/auto-projects.json'),'utf8');
const app=await createCoverStudio({projectRoot:fixture,port:5196});
let vite;
const browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
try{
  const p=await createSafePage(browser,{viewport:{width:1440,height:900}});
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(app.url);
  await p.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('已载入'));
  await p.locator('#ux-categories [data-filter="commercial"]').click();
  await p.locator('.ux-new-project-tile').click();
  assert(await p.locator('#ux-new-editor').isVisible());
  assert.equal(await p.locator('#new-category').inputValue(),'commercial');
  await p.locator('#video-file').setInputFiles(path.join(root,'scripts/fixtures/test-landscape.mp4'));
  await p.waitForFunction(()=>document.querySelector('#source-video')?.readyState>=1
    && !document.querySelector('#ux-new-use-frame')?.disabled,null,{timeout:60000});
  assert.equal(await p.locator('#candidate-grid button').count(),0,'Precise frame selection replaces obsolete 12-frame sampler');
  await p.locator('#ux-new-use-frame').click();
  await p.waitForFunction(()=>document.querySelector('#ux-new-player-poster')?.naturalWidth>0,null,{timeout:30000});
  await p.locator('#new-title-zh').fill('自动新增测试作品');
  await p.locator('#new-title-en').fill('Automated Demo Work');
  await p.locator('#new-category').selectOption('commercial');
  assert(await p.locator('#ux-new-save').isEnabled(),'Save enabled when source, frame and titles are valid');
  await p.locator('#ux-new-save').click();
  await p.waitForFunction(()=>document.querySelector('#status')?.textContent.startsWith('新增成功：'),null,{timeout:120000});
  assert.equal(await p.locator('body').getAttribute('data-workflow'),'library');
  assert(await p.locator('#ux-editor').isVisible(),'New work should open in unified gallery');
  assert.equal(await p.locator('#ux-editor-title').textContent(),'自动新增测试作品');
  const newItems=JSON.parse(await fs.readFile(path.join(fixture,'src/data/auto-projects.json'),'utf8'));
  assert.equal(newItems.length,1);
  assert.equal(newItems[0].id,'16');
  const meta=JSON.parse(await fs.readFile(path.join(fixture,'src/data/project-video-metadata.json'),'utf8'));
  const video=path.join(fixture,'assets/videos/works',newItems[0].localVideoPath);
  const cover=path.join(fixture,'assets/images/project-covers',newItems[0].coverFile);
  const poster=path.join(fixture,'assets/images/player-posters',meta['16'].playerPoster);
  for(const f of [video,cover,poster])assert((await fs.stat(f)).size>500,'Produced '+f);
  assert.equal(meta['16'].videoWidth,1280);
  assert.equal(meta['16'].videoHeight,720);
  assert.equal((await fs.readFile(path.join(root,'src/data/auto-projects.json'),'utf8')),original);
  console.log('CREATED',JSON.stringify({id:newItems[0].id,video,cover,poster}));
  // SSR project list should update without restarting the workbench.
  const response=await (await fetch(app.url+'/api/bootstrap')).json();
  assert.equal(response.projects.length,16,'Workbench must list newly added project');
  console.log('PROJECTS_AFTER_CREATE',response.projects.length);
  // Browser should show real local video via Vite, not a remote CDN.
  vite=await createServer({root:fixture,configFile:path.join(root,'vite.config.js'),
    server:{host:'127.0.0.1',port:5197,strictPort:true,fs:{allow:[fixture,root]}},logLevel:'error'});
  await vite.listen();
  const works=await createSafePage(browser,{viewport:{width:1440,height:900}});
  const jsErrors=[];works.on('pageerror',e=>jsErrors.push(e.message));
  await works.goto('http://127.0.0.1:5197/works.html');
  await works.locator('.comet-archive__card').first().waitFor();
  assert(await works.locator('.comet-archive__card').count()>=7);
  assert.equal(await works.getByText('自动新增测试作品').count()>=1,true);
  console.log('COMMERCIAL_CATEGORY_CARDS',await works.locator('.comet-archive__card').count());
  await works.getByText('自动新增测试作品').first().click();
  await works.locator('.cinema-player__play').click();
  await works.waitForFunction(()=>document.querySelector('.cinema-player video')?.currentTime>0.1,null,{timeout:15000});
  const playbackPath=await works.locator('.cinema-player video').evaluate(v=>decodeURIComponent(new URL(v.currentSrc).pathname));
  assert(playbackPath.endsWith(newItems[0].localVideoPath),'New work must play its English-named local MP4');
  console.log('LOCAL_PLAYBACK_OK',true);
  assert.deepEqual([...errors,...jsErrors],[], 'Workbench and new-work gallery must have no runtime errors');
  console.log('SAFE_REPORT',JSON.stringify(getSafeMediaReport(works)));
  await works.close();await p.close();
  console.log('ISOLATED_FIXTURE',fixture);
}finally{
  await browser.close();
  if(vite)await vite.close();
  await app.close();
}
