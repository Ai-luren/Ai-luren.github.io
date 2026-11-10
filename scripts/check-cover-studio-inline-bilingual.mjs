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
  await page.goto(studio.url);
  await page.waitForFunction(()=>document.querySelectorAll('#ux-gallery .ux-project').length===8);
  assert.equal(await page.locator('.ux-advanced-nav').count(),0);
  await page.locator('#ux-categories [data-filter="commercial"]').click();
  const card01=page.locator('#ux-gallery .ux-project[data-id="01"]');
  const initial=(await(await fetch(studio.url+'/api/bootstrap')).json()).ordering.projects.find(x=>x.id==='01');
  assert.equal(await card01.locator('.ux-name-zh').textContent(),initial.title);
  assert.equal(await card01.locator('.ux-name-en').textContent(),initial.titleEn);
  async function rename(id,language,newName) {
    await page.locator('#ux-categories [data-filter="commercial"]').click();
    const card=page.locator('#ux-gallery .ux-project[data-id="'+id+'"]');
    await card.locator(language==='zh'?'.ux-name-zh':'.ux-name-en').dblclick();
    const editor=card.locator('.ux-inline-name');
    await editor.fill(newName);
    await editor.press('Enter');
    await page.waitForFunction(({id,language,newName})=>
      document.querySelector('#ux-gallery .ux-project[data-id="'+id+'"] '+(language==='zh'?'.ux-name-zh':'.ux-name-en'))?.textContent===newName,
      {id,language,newName},{timeout:20000});
  }
  await rename('01','zh','屈臣氏 AI 创意品牌广告');
  await rename('01','en','Watsons AI Creative Brand Commercial');
  let override=JSON.parse(await fs.readFile(path.join(fixture,'src/data/project-title-overrides.json'),'utf8'));
  assert.deepEqual(override['01'],{zh:'屈臣氏 AI 创意品牌广告',en:'Watsons AI Creative Brand Commercial'});
  assert.equal((await(await fetch(studio.url+'/api/bootstrap')).json()).ordering.projects.find(x=>x.id==='01').titleEn,override['01'].en);
  await rename('16','en','Membership Perks Creative Ad');
  override=JSON.parse(await fs.readFile(path.join(fixture,'src/data/project-title-overrides.json'),'utf8'));
  assert.equal(override['16'].zh,work16.title.zh);
  assert.equal(override['16'].en,'Membership Perks Creative Ad');
  const updated=JSON.parse(await fs.readFile(path.join(fixture,'src/data/auto-projects.json'),'utf8'));
  assert.equal(updated.find(p=>p.id==='16').variants.length,work16.variants.length);
  const vid01=JSON.parse(await fs.readFile(path.join(fixture,'src/data/local-video-paths.json'),'utf8'))['01'];
  assert((await fs.stat(path.join(fixture,'assets/videos/works',vid01))).size>0);
  await page.locator('#ux-gallery .ux-project[data-id="16"] .ux-project-image').click();
  assert(await page.locator('#ux-editor').isVisible());
  assert.equal(await page.locator('#ux-title-en').inputValue(),'Membership Perks Creative Ad');
  assert.equal(await page.locator('#ux-variant-chips .ux-variant').count(),2);
  await page.locator('#ux-close-editor').click();
  const lib=await createSafePage(browser,{viewport:{width:1440,height:900}});
  lib.on('pageerror',e=>errors.push(e.message));
  await lib.goto('http://127.0.0.1:5215/works.html');
  await lib.locator('.library-grid .comet-archive__card').first().waitFor();
  assert((await lib.locator('.library-grid').innerText()).includes('屈臣氏 AI 创意品牌广告'));
  await lib.close();
  vite.moduleGraph.invalidateAll();
  const {PROJECTS}=await vite.ssrLoadModule('/src/data/projects.js');
  assert.equal(PROJECTS.find(p=>p.id==='01').title.en,override['01'].en);
  assert.equal(PROJECTS.find(p=>p.id==='16').title.en,'Membership Perks Creative Ad');
  assert.deepEqual(errors,[]);
  console.log('INLINE_BILINGUAL_PASS: both languages, legacy and new project, independent versions, MP4 mapping, local site sync');
} finally {
  if(browser)await browser.close();
  if(vite)await vite.close();
  if(studio)await studio.close();
}
