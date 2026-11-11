// Real mouse/keyboard reorder on an isolated copy of the portfolio.
// No original media, live JSON, or ImageKit traffic is modified.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {createSafePage,getSafeMediaReport} from '../../lib/safe-media.mjs';
import {createCoverStudio} from '../../../portfolio-workbench/server.mjs';
import {projectVideoVersions,initialProjectPoster} from '../../../src/data/version-order.js';
const root=path.resolve(import.meta.dirname,'../../..');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-version-order-'));
for(const rel of ['src','assets/images','index.html','works.html'])
  await fs.cp(path.join(root,rel),path.join(temp,rel),{recursive:true});
await fs.writeFile(path.join(temp,'package.json'),'{"type":"module"}\n');
await fs.symlink(path.join(root,'node_modules'),path.join(temp,'node_modules'));
const orderFile=path.join(temp,'src/data/project-version-order.json');
// The creator may already have reordered versions locally. Reset only the
// isolated test fixture for a deterministic drag-from-default scenario.
await fs.writeFile(orderFile,'{}\n');
const autoFile=path.join(temp,'src/data/auto-projects.json');
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
// Source data may not yet contain the creator's newest local C version:
// materialize that test-only variant inside the isolated fixture, never in
// the user's live auto-projects.json or Git-backed artwork.
const sourceWorks=await read(autoFile);
const work19=sourceWorks.find(work=>work.id==='19');
assert(work19?.variants?.length,'FormFunk needs at least its B video');
if(!work19.variants.some(version=>version.label.zh==='精密入席')){
  const example=work19.variants.at(-1);
  work19.variants.push({
    ...example,id:'b97c7b50-3dd1-4e09-90d8-d31c3cfb1b2c',
    label:{zh:'精密入席',en:'Precision Served'},videoUrl:null,
  });
  await fs.writeFile(autoFile,JSON.stringify(sourceWorks,null,2)+'\n');
}
const originalAuto=await fs.readFile(autoFile);
const precision=work19.variants.find(version=>version.label.zh==='精密入席');
assert(precision,'Test needs the precision version');
let server,browser;
try{
  server=await createCoverStudio({projectRoot:temp,port:5378});
  browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
  const page=await createSafePage(browser,{viewport:{width:1440,height:900}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(server.url);
  await page.waitForFunction(()=>document.querySelectorAll('#ux-gallery .ux-project').length===8,null,{timeout:20000});
  await page.locator('[data-filter="commercial"]').click();
  await page.locator('.ux-project[data-id="19"] .ux-project-image').click();
  const cards=page.locator('#ux-variant-chips .ux-variant-item');
  assert.equal(await cards.count(),work19.variants.length+1);
  const ids=await cards.evaluateAll(items=>items.map(item=>item.dataset.version));
  assert.deepEqual(ids,['main',...work19.variants.map(v=>v.id)]);
  assert.equal(await page.locator('#ux-stage-version').textContent().then(x=>x.includes('千万别摔')),true);
  // Short click switches video but does not persist any sort.
  await cards.nth(1).locator('.ux-variant').click();
  await page.waitForFunction(id=>document.querySelector('#ux-variant-chips .ux-variant[aria-pressed="true"]')?.dataset.version===id,work19.variants[0].id,{timeout:10000});
  assert.equal(await page.locator('#ux-variant-chips .ux-variant[aria-pressed="true"]').count(),1);
  assert.deepEqual(await read(orderFile),{});
  console.log('VERSION_CLICK_SWITCH_NO_SORT_PASS');
  // Physically drag the precision title (last) over the main title (first).
  const from=await cards.last().locator('.ux-variant').boundingBox();
  const to=await cards.first().locator('.ux-variant').boundingBox();
  await page.mouse.move(from.x+from.width/2,from.y+from.height/2);
  await page.mouse.down();
  await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:20});
  await page.mouse.up();
  await page.waitForFunction(id=>document.querySelector('#ux-variant-chips .ux-variant-item')?.dataset.version===id,precision.id,{timeout:8000});
  await page.waitForFunction(id=>{
    const p=document.querySelector('#ux-version-tip');
    return p?.textContent.includes('顺序已自动保存');
  },null,{timeout:8000});
  const stored=await read(orderFile);
  assert.deepEqual(stored['19'],[precision.id,'main',work19.variants[0].id]);
  assert.deepEqual(await fs.readFile(autoFile),originalAuto,'Reordering must not mutate titles/video/URLs/variant metadata');
  assert.equal(await page.locator('#ux-variant-chips .ux-variant[aria-pressed="true"]').getAttribute('data-version'),work19.variants[0].id,'Changing order must not switch the playing video');
  console.log('VERSION_POINTER_DRAG_AUTOSAVE_AND_SELECTED_VIDEO_PRESERVED_PASS');
  // Check that the public player uses the same first variant and poster.
  const view={
    id:'19',videoUrl:work19.videoUrl,videoWidth:1280,videoHeight:720,
    playerPoster:'main-poster.webp',
    variants:work19.variants.map(v=>({id:v.id,videoUrl:v.videoUrl,playerPoster:v.posterFile,videoWidth:v.videoWidth,videoHeight:v.videoHeight})),
    versionOrder:stored['19'],
  };
  assert.equal(projectVideoVersions(view)[0].id,precision.id);
  assert.equal(initialProjectPoster(view),precision.posterFile);
  await page.reload();
  await page.waitForFunction(()=>document.querySelectorAll('#ux-gallery .ux-project').length===8);
  await page.locator('[data-filter="commercial"]').click();
  await page.locator('.ux-project[data-id="19"] .ux-project-image').click();
  assert.equal(await page.locator('#ux-variant-chips .ux-variant-item').first().getAttribute('data-version'),precision.id);
  assert((await page.locator('#ux-stage-version').textContent()).includes('精密入席'),'First tab must be default video on workbench open');
  console.log('VERSION_RELOAD_PERSISTENCE_AND_DEFAULT_FIRST_PASS');
  // Also verify the creator's example URL is normalized on the reordered
  // version alone. No ImageKit traffic or real source files are accessed.
  await page.locator('[data-ux-panel="versions"]').click();
  await page.locator('#ux-url-readonly').click();
  await page.locator('#ux-url-value').fill('https://ik.imagekit.io/Ailuren/videos/FormFunk-E.mp4');
  assert.equal(await page.locator('#ux-url-value').inputValue(),'FormFunk-E');
  await page.locator('#ux-url-save').click();
  const normalized='https://ik.imagekit.io/Ailuren/tr:orig-true/videos/FormFunk-E.mp4';
  await page.waitForFunction(value=>document.querySelector('#ux-url-readonly')?.textContent===value,normalized,{timeout:12000});
  const updated=(await read(autoFile)).find(item=>item.id==='19');
  assert.equal(updated.variants.find(item=>item.id===precision.id)?.videoUrl,normalized);
  assert.equal(updated.videoUrl,work19.videoUrl,'Changing C URL must not change the main video');
  assert.equal(updated.variants.find(item=>item.id===work19.variants[0].id)?.videoUrl,work19.variants[0].videoUrl,
    'Changing C URL must not change B');
  await page.locator('[data-ux-panel="versions"]').click();
  console.log('RAW_IMAGEKIT_URL_BINDS_ONLY_SELECTED_VERSION_PASS');
  // Keyboard sort back and ensure a protected server rejects stale/invalid input.
  await cards.first().locator('.ux-variant').focus();
  await cards.first().locator('.ux-variant').press('Shift+ArrowRight');
  await page.waitForFunction(()=>document.querySelector('#ux-variant-chips .ux-variant-item')?.dataset.version==='main',null,{timeout:8000});
  await page.waitForFunction(()=>document.querySelector('#ux-version-tip')?.textContent.includes('顺序已自动保存'),null,{timeout:8000});
  assert.equal((await read(orderFile))['19'][1],precision.id);
  const token=await page.evaluate(()=>fetch('/api/bootstrap').then(r=>r.json()).then(d=>d.token));
  const rejected=await page.evaluate(async token=>{
    const res=await fetch('/api/save-version-order',{method:'POST',headers:{'Content-Type':'application/json','X-Cover-Token':token},body:JSON.stringify({projectId:'19',ids:['main','main'],expected:['main','main'],confirmed:true})});
    return res.status;
  },token);
  assert.equal(rejected,422);
  assert.equal((await read(autoFile)).find(item=>item.id==='19').variants.find(item=>item.id===precision.id).videoUrl,
    'https://ik.imagekit.io/Ailuren/tr:orig-true/videos/FormFunk-E.mp4');
  assert.deepEqual(errors,[]);
  assert.equal(getSafeMediaReport(page).urls.length,0);
  console.log('VERSION_KEYBOARD_SORT_AND_SERVER_VALIDATION_PASS');
  await page.close();
}finally{
  if(browser)await browser.close();
  if(server)await server.close();
}
