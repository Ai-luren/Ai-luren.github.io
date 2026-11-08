// End-to-end isolation: never writes to the user's real portfolio, never uploads to ImageKit.
import { createCoverStudio } from '../tools/cover-studio/server.mjs';
import { createSafePage, getSafeMediaReport } from './lib/safe-media.mjs';
import { normalizeImageKitUrl } from '../tools/cover-studio/project-versions.mjs';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';

const root=path.resolve(import.meta.dirname,'..');
const fixture=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-versioned-work-test-'));
for(const f of ['src','assets/images','works.html','index.html']){
  await fs.cp(path.join(root,f),path.join(fixture,f),{recursive:true});
}
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
const originalData=await fs.readFile(path.join(root,'src/data/auto-projects.json'),'utf8');
const studio=await createCoverStudio({projectRoot:fixture,port:5198});
const browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
let vite=null;
const errors=[];
try{
  const page=await createSafePage(browser,{viewport:{width:1440,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(studio.url); await page.locator('.ux-advanced-nav').evaluate(x=>x.open=true);
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('已载入'));
  await page.locator('[data-workflow-target="new"]').click();
  assert.equal(await page.locator('#upload-imagekit').count(),0);
  assert.equal(await page.locator('#main-version-zh').count(),0);
  assert.equal(await page.locator('#main-version-en').count(),0);
  await page.locator('#video-file').setInputFiles(path.join(root,'scripts/fixtures/test-landscape.mp4'));
  await page.waitForFunction(()=>document.querySelectorAll('.candidates button').length===12&&!document.querySelector('#video-file').disabled,null,{timeout:120000});
  await page.locator('.candidates button').nth(3).click();
  await page.waitForFunction(()=>!document.querySelector('#export-cover').disabled);
  await page.locator('#new-title-zh').fill('MEXC AI 品牌概念广告');
  await page.locator('#new-title-en').fill('MEXC AI Concept Ad');
  await page.locator('#create-consent').check();
  await page.locator('#create-project').click();
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent.startsWith('新增成功：'),null,{timeout:120000});
  assert.equal(await page.locator('body').getAttribute('data-workflow'),'library');
  await page.locator('#ux-close-editor').click();
  await page.locator('[data-workflow-target="manage"]').click();
  assert.equal(await page.locator('#managed-project').inputValue(),'16');
  await page.locator('#start-add-version').click();
  assert.equal(await page.locator('body').getAttribute('data-workflow'),'add-version');
  await page.locator('#video-file').setInputFiles(path.join(root,'scripts/fixtures/test-portrait.mp4'));
  await page.waitForFunction(()=>document.querySelectorAll('.candidates button').length===12&&!document.querySelector('#video-file').disabled,null,{timeout:120000});
  await page.locator('.candidates button').nth(4).click();
  await page.waitForFunction(()=>!document.querySelector('#export-cover').disabled);
  await page.locator('#variant-title-zh').fill('版本 A · 探索');
  await page.locator('#variant-title-en').fill('Version A · Explore');
  await page.locator('#variant-consent').check();
  await page.locator('#add-version').click();
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent.startsWith('已把'),null,{timeout:120000});
  const catalog=JSON.parse(await fs.readFile(path.join(fixture,'src/data/auto-projects.json'),'utf8'));
  assert.equal(catalog.length,1);
  assert.equal(catalog[0].id,'16');
  assert.equal(catalog[0].mainVersionLabel.zh,'主版本');
  assert.equal(catalog[0].mainVersionLabel.en,'Main version');
  assert.equal(catalog[0].variants.length,1);
  const second=catalog[0].variants[0];
  assert.equal(second.label.zh,'版本 A · 探索');
  assert.equal(second.videoWidth,608);
  for (const f of [catalog[0].localVideoPath,second.localVideoPath]) {
    assert((await fs.stat(path.join(fixture,'assets/videos/works',f))).size>1000);
  }
  assert((await fs.stat(path.join(fixture,'assets/images/player-posters',second.posterFile))).size>500);
  assert.equal(await page.locator('#managed-variant option').count(),2);
  const httpJson=async(endpoint,body)=>{
    const boot=await (await fetch(studio.url+'/api/bootstrap')).json();
    const response=await fetch(studio.url+endpoint,{
      method:'POST',headers:{'X-Cover-Token':boot.token,'Content-Type':'application/json'},
      body:JSON.stringify(body),
    });
    return {status:response.status,data:await response.json()};
  };
  const base='https://ik.imagekit.io/Ailuren/tr:orig-true/videos/';
  let rejected=await httpJson('/api/bind-imagekit',{
    projectId:'16',variantId:'main',url:'https://evil.example/copy.mp4',confirmed:true
  });
  assert.equal(rejected.status,400);
  rejected=await httpJson('/api/bind-imagekit',{
    projectId:'16',variantId:'main',url:base+'mexc-b.mp4',confirmed:false
  });
  assert.equal(rejected.status,400);
  rejected=await httpJson('/api/upload-imagekit',{
    projectId:'16',variantId:'main',confirmed:true,
  });
  assert.equal(rejected.status,404);
  const forMain=await httpJson('/api/bind-imagekit',{
    projectId:'16',variantId:'main',url:base+'mexc-b.mp4',expectedUrl:null,confirmed:true
  });
  assert.equal(forMain.status,200,JSON.stringify(forMain.data));
  const forSecond=await httpJson('/api/bind-imagekit',{
    projectId:'16',variantId:second.id,url:base+'mexc-a.mp4',expectedUrl:null,confirmed:true
  });
  assert.equal(forSecond.status,200);
  assert.equal(normalizeImageKitUrl(forMain.data.url),forMain.data.url);
  console.log('BINDING_ONLY: PASS, no external requests');
  assert.equal(await fs.readFile(path.join(root,'src/data/auto-projects.json'),'utf8'),originalData);
  vite=await createServer({root:fixture,configFile:path.join(root,'vite.config.js'),
    server:{host:'127.0.0.1',port:5199,strictPort:true,fs:{allow:[fixture,root]}},
    logLevel:'error'});
  await vite.listen();
  const website=await createSafePage(browser,{viewport:{width:1440,height:900}});
  website.on('pageerror',e=>errors.push(e.message));
  await website.goto('http://127.0.0.1:5199/works.html');
  await website.waitForTimeout(1200);
  console.log('WORKS_PAGE',await website.title(), await website.locator('body').innerText().then(x=>x.slice(0,300)));
  await website.locator('.library-grid .comet-archive__card').last().waitFor();
  assert.equal(await website.locator('.library-grid .comet-archive__card').count(),8);
  await website.locator('.library-grid .comet-archive__card').last().click();
  await website.locator('.cinema-player__versions').waitFor();
  assert.equal(await website.locator('.cinema-player__versions button').count(),2);
  assert.equal(await website.locator('.cinema-player__count').textContent(),'8 / 8');
  await website.locator('.cinema-player__play').click();
  await website.waitForFunction(()=>document.querySelector('.cinema-player video')?.currentTime>.1,null,{timeout:15000});
  assert.equal(await website.locator('.cinema-player video').evaluate(v=>v.videoWidth),1280);
  await website.getByRole('button',{name:'版本 A · 探索'}).click();
  assert.equal(await website.locator('.cinema-player video').evaluate(v=>v.paused&&!v.hasAttribute('src')),true);
  await website.locator('.cinema-player__play').click();
  await website.waitForFunction(()=>document.querySelector('.cinema-player video')?.currentTime>.1,null,{timeout:15000});
  assert.equal(await website.locator('.cinema-player video').evaluate(v=>v.videoWidth),608);
  await website.screenshot({path:path.join(fixture,'multi-player-desktop.png')});
  await website.locator('.cinema-player__close').click();
  await website.locator('.cinema-player').waitFor({state:'detached'});
  assert.equal(getSafeMediaReport(website).urls.length,0);
  await website.close();
  const mobile=await createSafePage(browser,{viewport:{width:390,height:844}});
  mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto('http://127.0.0.1:5199/works.html');
  await mobile.locator('.library-grid .comet-archive__card').last().click();
  await mobile.locator('.cinema-player__versions button').nth(1).click();
  await mobile.screenshot({path:path.join(fixture,'multi-player-mobile.png')});
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true);
  await mobile.close();
  assert.deepEqual(errors,[]);
  console.log('MULTI_VERSION_PLAYBACK: PASS; desktop and mobile; ImageKit requests: 0');
  console.log('ISOLATED_OUTPUT',fixture);
}finally{await browser.close();if(vite)await vite.close();await studio.close();}
