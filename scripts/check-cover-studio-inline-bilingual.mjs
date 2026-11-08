import { createCoverStudio } from '../tools/cover-studio/server.mjs';
import { chromium } from 'playwright-core';
import { createSafePage } from './lib/safe-media.mjs';
import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve(import.meta.dirname,'..');
const fixture=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-inline-bilingual-'));
for (const name of ['src','assets/images','index.html','works.html']) await fs.cp(path.join(root,name),path.join(fixture,name),{recursive:true});
await fs.mkdir(path.join(fixture,'assets/videos/works'),{recursive:true});
// Title edits rename MP4 files, so NEVER symlink a writable fixture to real works.
const legacyPaths=JSON.parse(await fs.readFile(path.join(root,'src/data/local-video-origins.json'),'utf8'));
const renamedPaths=JSON.parse(await fs.readFile(path.join(root,'src/data/local-video-paths.json'),'utf8'));
const autoWorks=JSON.parse(await fs.readFile(path.join(root,'src/data/auto-projects.json'),'utf8'));
const work16=autoWorks.find(item=>item.id==='16');
for (const rel of [renamedPaths['01']||legacyPaths['01'],work16.localVideoPath,...(work16.variants||[]).map(v=>v.localVideoPath)]) {
  const dest=path.join(fixture,'assets/videos/works',rel);
  await fs.mkdir(path.dirname(dest),{recursive:true});
  await fs.copyFile(path.join(root,'assets/videos/works',rel),dest);
}
await fs.symlink(path.join(root,'node_modules'),path.join(fixture,'node_modules'));
await fs.writeFile(path.join(fixture,'package.json'),'{"type":"module"}');
let studio, vite, browser;
const errors=[];
try {
  studio=await createCoverStudio({projectRoot:fixture,port:5214});
  vite=await createServer({root:fixture,configFile:path.join(root,'vite.config.js'),server:{port:5215,host:'127.0.0.1',strictPort:true,fs:{allow:[fixture,root]}},logLevel:'error'});
  await vite.listen();
  browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
  const page=await createSafePage(browser,{viewport:{width:1440,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(studio.url); await page.locator('.ux-advanced-nav').evaluate(x=>x.open=true);
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('已载入'));
  await page.locator('[data-workflow-target="order"]').click();
  const initialTitles=(await (await fetch(studio.url+'/api/bootstrap')).json()).ordering.projects;
  const firstTitle=initialTitles.find(p=>p.id==='01');
  const sixteenthTitle=initialTitles.find(p=>p.id==='16');
  const card=page.locator('#order-items .order-item[data-id="01"]');
  assert.equal(await card.locator('.order-name-zh').textContent(),firstTitle.title);
  assert.equal(await card.locator('.order-name-en').textContent(),firstTitle.titleEn);
  assert.equal(await card.locator('.order-edit-title').count(),0);
  assert.equal(await page.locator('#order-title-editor').count(),0);
  assert.equal(await page.locator('#order-save').isDisabled(),true);
  await card.locator('.order-name-zh').dblclick();
  await card.locator('.order-title-input-zh').fill('屈臣氏 AI 创意品牌广告');
  await card.locator('.order-title-input-zh').press('Enter');
  await page.waitForFunction(()=>document.querySelector('#order-items .order-item[data-id="01"] .order-name-zh')?.textContent==='屈臣氏 AI 创意品牌广告');
  await card.locator('.order-name-en').dblclick();
  await card.locator('.order-title-input-en').fill('Watsons AI Creative Brand Commercial');
  await card.locator('.order-title-input-en').press('Enter');
  await page.waitForFunction(()=>document.querySelector('#order-items .order-item[data-id="01"] .order-name-en')?.textContent==='Watsons AI Creative Brand Commercial');
  const override=JSON.parse(await fs.readFile(path.join(fixture,'src/data/project-title-overrides.json'),'utf8'));
  assert.deepEqual(override['01'],{zh:'屈臣氏 AI 创意品牌广告',en:'Watsons AI Creative Brand Commercial'});
  assert.equal(await page.locator('#order-save').isDisabled(),true,'Title save must not alter sort.');
  const updated=await (await fetch(studio.url+'/api/bootstrap')).json();
  assert.equal(updated.ordering.projects.find(p=>p.id==='01').titleEn,override['01'].en);
  await page.locator('[data-order-scope="all"]').click();
  assert.equal(await page.locator('#order-items .order-item[data-id="01"] .order-name-en').textContent(),override['01'].en);
  const work=page.locator('#order-items .order-item[data-id="16"]');
  assert.equal(await work.locator('.order-name-en').textContent(),sixteenthTitle.titleEn);
  await work.locator('.order-name-en').dblclick();
  await work.locator('.order-title-input-en').fill('Membership Perks Creative Ad');
  await work.locator('.order-title-input-en').press('Enter');
  await page.waitForFunction(()=>document.querySelector('#order-items .order-item[data-id="16"] .order-name-en')?.textContent==='Membership Perks Creative Ad');
  assert.equal(JSON.parse(await fs.readFile(path.join(fixture,'src/data/project-title-overrides.json'),'utf8'))['16'].zh,sixteenthTitle.title);
  const lib=await createSafePage(browser,);
  lib.on('pageerror',e=>errors.push(e.message));
  await lib.goto('http://127.0.0.1:5215/works.html');
  await lib.locator('.library-grid').waitFor();
  assert((await lib.locator('.library-grid').innerText()).includes('屈臣氏 AI 创意品牌广告'));
  await lib.close();
  vite.moduleGraph.invalidateAll();
  const {PROJECTS}=await vite.ssrLoadModule('/src/data/projects.js');
  assert.equal(PROJECTS.find(p=>p.id==='01').title.en,override['01'].en);
  assert.equal(PROJECTS.find(p=>p.id==='16').title.en,'Membership Perks Creative Ad');
  await page.locator('[data-workflow-target="new"]').click();
  assert.equal(await page.locator('#main-version-zh').count(),0);
  assert.equal(await page.locator('#upload-imagekit').count(),0);
  const dims=[[900,1600],[1600,900],[2100,900]];
  for (const [width,height] of dims){
    const file=path.join(fixture,'test-'+width+'x'+height+'.png');
    execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=red:s='+width+'x'+height+':d=1','-frames:v','1','-update','1',file],{timeout:30000});
    await page.locator('#image-file').setInputFiles(file);
    await page.waitForFunction(({width,height})=>document.querySelector('#frame-status')?.textContent.includes(width+' × '+height)&&!document.querySelector('#image-file').disabled,{width,height},{timeout:60000});
    await page.locator('[data-preview-view="original"]').click();
    const actual=await page.locator('#original-preview').evaluate(img=>({w:img.naturalWidth,h:img.naturalHeight,fit:getComputedStyle(img).objectFit}));
    assert.deepEqual(actual,{w:width,h:height,fit:'contain'});
    assert.equal(await page.locator('#preview-wrap').evaluate(el=>getComputedStyle(el).aspectRatio),width+' / '+height);
    await page.locator('[data-preview-view="cover"]').click();
    assert.equal(await page.locator('#cover-preview').isVisible(),true);
    console.log('PREVIEW_RATIO',width+':'+height);
  }

  assert.deepEqual(errors,[]);
  console.log('INLINE_BILINGUAL_AND_RATIOS_PASS');
} finally {
  if(browser)await browser.close();
  if(vite)await vite.close();
  if(studio)await studio.close();
}
