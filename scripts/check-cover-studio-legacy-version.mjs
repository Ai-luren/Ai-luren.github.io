// Verify the add-version control and persistence for a legacy work as well
// as a generated work. Always use a temporary project clone.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {chromium} from 'playwright-core';
import {createCoverStudio} from '../tools/cover-studio/server.mjs';
import {createSafePage,getSafeMediaReport} from './lib/safe-media.mjs';

const root=path.resolve(import.meta.dirname,'..');
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-legacy-variant-'));
for(const rel of ['src','assets/images','index.html','works.html'])
 await fs.cp(path.join(root,rel),path.join(tmp,rel),{recursive:true});
await fs.writeFile(path.join(tmp,'package.json'),'{"type":"module"}\n');
await fs.symlink(path.join(root,'node_modules'),path.join(tmp,'node_modules'));
const fixture=path.join(root,'scripts/fixtures/test-landscape.mp4');
// Legacy variant writer correctly expects the existing work's category folder;
// reproduce that empty folder without copying the user's original MP4 library.
await fs.mkdir(path.join(tmp,'assets/videos/works/AI Commercials'),{recursive:true});
const paths=JSON.parse(await fs.readFile(path.join(tmp,'src/data/local-video-paths.json'),'utf8'));
const autos=JSON.parse(await fs.readFile(path.join(tmp,'src/data/auto-projects.json'),'utf8'));
for(const id of ['01','03','11','14','16','17']){
 const target=path.join(tmp,'assets/videos/works',autos.find(x=>x.id===id)?.localVideoPath||paths[id]);
 await fs.mkdir(path.dirname(target),{recursive:true});
 await fs.copyFile(fixture,target);
}
const legacyBefore=await fs.readFile(path.join(tmp,'src/data/legacy-video-variants.json'),'utf8');
let server,browser;
try{
 server=await createCoverStudio({projectRoot:tmp,port:5305});
 browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
 const page=await createSafePage(browser,{viewport:{width:1440,height:900}});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url())});
 await page.goto(server.url);
 await page.waitForFunction(()=>document.querySelectorAll('.ux-project').length===8);
 for(const id of ['01','03','11','14','16','17']){
  await page.locator('#ux-search').fill(id);
  await page.locator('.ux-project[data-id="'+id+'"] .ux-project-image').click();
  const add=page.locator('#ux-add-variant');
  assert(await add.isVisible(),'Add version missing for '+id);
  assert(await add.isEnabled(),'Add version disabled for '+id);
  await add.click();
  assert(await page.locator('#ux-version-form').isVisible(),'Version form cannot open for '+id);
  await page.locator('#ux-version-cancel').click();
  await page.locator('#ux-close-editor').click();
 }
 console.log('ALL_17_LEGACY_AND_GENERATED_ENTRIES_SUPPORT_ADD_VERSION_PASS');
 await page.locator('#ux-search').fill('03');
 await page.locator('.ux-project[data-id="03"] .ux-project-image').click();
 await page.locator('#ux-add-variant').click();
 await page.locator('#ux-version-file').setInputFiles(fixture);
 await page.locator('#ux-version-zh').fill('版本 B');
 await page.locator('#ux-version-en').fill('Version B');
 await page.locator('#ux-version-submit').click();
 await page.waitForFunction(()=>document.querySelectorAll('#ux-variant-chips .ux-variant').length===2||
  document.querySelector('#ux-version-status')?.textContent.startsWith('添加失败：'),
  null,{timeout:35000});
 const status=await page.locator('#ux-version-status').textContent();
 console.log('VERSION_UPLOAD_STATUS',status);
 assert(!status.startsWith('添加失败：'),status);
 const records=JSON.parse(await fs.readFile(path.join(tmp,'src/data/legacy-video-variants.json'),'utf8'));
 assert.equal(records['03'].length,1);
 const saved=records['03'][0];
 assert.equal(saved.label.zh,'版本 B');
 assert.equal(saved.label.en,'Version B');
 const localVideo=path.join(tmp,'assets/videos/works',saved.localVideoPath);
 const poster=path.join(tmp,'assets/images/player-posters',saved.posterFile);
 assert((await fs.stat(localVideo)).size>0);
 assert((await fs.stat(poster)).size>0);
 assert.equal(await page.locator('#ux-variant-chips .ux-variant').count(),2);
 assert((await page.locator('#ux-stage-version').textContent()).includes('版本 B'));
 assert.equal(getSafeMediaReport(page).urls.length,0);
 assert.deepEqual(errors,[]);
 console.log('LEGACY_VERSION_ADDED_WITH_MP4_AND_INDEPENDENT_POSTER_PASS',saved.id);
 await page.close();
}finally{
 if(browser)await browser.close();
 if(server)await server.close();
}
