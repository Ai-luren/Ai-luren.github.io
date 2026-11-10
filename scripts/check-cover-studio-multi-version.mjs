// Multi-version creation and playback on current unified workbench; isolated files only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { createSafePage, getSafeMediaReport } from './lib/safe-media.mjs';
import { createCoverStudio } from '../tools/cover-studio/server.mjs';

const root=path.resolve(import.meta.dirname,'..');
const sandbox=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-current-multiversion-'));
for(const rel of ['src','assets/images','index.html','works.html'])
  await fs.cp(path.join(root,rel),path.join(sandbox,rel),{recursive:true});
await fs.mkdir(path.join(sandbox,'assets/videos/works'),{recursive:true});
await fs.symlink(path.join(root,'node_modules'),path.join(sandbox,'node_modules'));
await fs.writeFile(path.join(sandbox,'package.json'),'{"type":"module"}\n');
const before=JSON.parse(await fs.readFile(path.join(sandbox,'src/data/auto-projects.json'),'utf8'));
const project=before.find(p=>p.id==='16');
assert(project && project.variants.length>=1,'Existing multiple-version project must exist');
for(const relative of [project.localVideoPath,...project.variants.map(v=>v.localVideoPath)]) {
  const dst=path.join(sandbox,'assets/videos/works',relative);
  await fs.mkdir(path.dirname(dst),{recursive:true});
  await fs.copyFile(path.join(root,'assets/videos/works',relative),dst);
}
let studio,vite,browser;
try {
  studio=await createCoverStudio({projectRoot:sandbox,port:5198});
  browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
  const page=await createSafePage(browser,{viewport:{width:1440,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(studio.url);
  await page.locator('#ux-categories [data-filter="commercial"]').click();
  await page.locator('.ux-project[data-id="16"] .ux-project-image').click();
  assert.equal(await page.locator('#ux-variant-chips .ux-variant').count(),2);
  await page.locator('#ux-variant-chips .ux-variant').nth(1).click();
  assert.equal(await page.locator('#ux-variant-chips .ux-variant').nth(1).getAttribute('aria-pressed'),'true');
  await page.locator('#ux-add-variant').click();
  assert(await page.locator('#ux-version-form').isVisible());
  await page.locator('#ux-version-file').setInputFiles(path.join(root,'scripts/fixtures/test-portrait.mp4'));
  await page.locator('#ux-version-zh').fill('版本 C');
  await page.locator('#ux-version-en').fill('Version C');
  await page.locator('#ux-version-submit').click();
  await page.waitForFunction(()=>document.querySelectorAll('#ux-variant-chips .ux-variant').length===3 ||
    document.querySelector('#ux-version-status')?.textContent.startsWith('添加失败：'),
    null,{timeout:50000});
  const msg=await page.locator('#ux-version-status').textContent();
  assert(!msg.startsWith('添加失败：'),msg);
  const saved=JSON.parse(await fs.readFile(path.join(sandbox,'src/data/auto-projects.json'),'utf8')).find(p=>p.id==='16');
  assert.equal(saved.variants.length,2);
  assert.equal(saved.variants[1].label.zh,'版本 C');
  assert.equal(saved.variants[1].label.en,'Version C');
  assert.equal(saved.variants[1].videoWidth,608);
  for(const rel of [saved.variants[1].localVideoPath]){
    assert((await fs.stat(path.join(sandbox,'assets/videos/works',rel))).size>1000);
  }
  assert((await fs.stat(path.join(sandbox,'assets/images/player-posters',saved.variants[1].posterFile))).size>500);
  await page.locator('#ux-variant-chips .ux-variant').nth(2).click();
  assert.equal(await page.locator('#ux-variant-chips .ux-variant').nth(2).getAttribute('aria-pressed'),'true');
  const boot=await (await fetch(studio.url+'/api/bootstrap')).json();
  const bad=await fetch(studio.url+'/api/bind-imagekit',{
    method:'POST',headers:{'X-Cover-Token':boot.token,'Content-Type':'application/json'},
    body:JSON.stringify({projectId:'16',variantId:saved.variants[1].id,url:'https://wrong.example/ad.mp4',confirmed:true})
  });
  assert.equal(bad.status,400,'Foreign video host must be rejected');
  await page.close();
  vite=await createServer({root:sandbox,configFile:path.join(root,'vite.config.js'),
    server:{port:5199,host:'127.0.0.1',strictPort:true,fs:{allow:[sandbox,root]}},logLevel:'error'});
  await vite.listen();
  for(const width of [1440,390]){
    const web=await createSafePage(browser,{viewport:{width,height:width===390?844:900}});
    web.on('pageerror',e=>errors.push(e.message));
    await web.goto('http://127.0.0.1:5199/works.html');
    const item=web.locator('.library-grid .comet-archive__card[data-project-id="16"]');
    await item.waitFor();
    await item.click();
    await web.locator('.cinema-player__versions button').first().waitFor();
    assert.equal(await web.locator('.cinema-player__versions button').count(),3);
    await web.locator('.cinema-player__versions button').last().click();
    await web.waitForFunction(()=>document.querySelector('.cinema-player__versions button:last-child')?.getAttribute('aria-pressed')==='true');
    assert.equal(await web.locator('.cinema-player video').evaluate(v=>v.paused&&!v.hasAttribute('src')),true);
    assert.equal(getSafeMediaReport(web).urls.length,0);
    await web.close();
  }
  assert.deepEqual(errors,[]);
  console.log('MULTI_VERSION_CURRENT_PASS: 3 versions, isolated 608px MP4, independent poster, illegal binding refused, desktop/mobile public switch');
}finally{
  if(browser)await browser.close();
  if(vite)await vite.close();
  if(studio)await studio.close();
}
