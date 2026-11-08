// Non-destructive draft/focus regression in an isolated clone.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createCoverStudio} from '../tools/cover-studio/server.mjs';
import {createSafePage} from './lib/safe-media.mjs';
const root=path.resolve(import.meta.dirname,'..');
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-draft-audit-'));
for(const rel of ['src','assets/images','index.html','works.html'])
 await fs.cp(path.join(root,rel),path.join(tmp,rel),{recursive:true});
await fs.writeFile(path.join(tmp,'package.json'),'{"type":"module"}\n');
await fs.symlink(path.join(root,'node_modules'),path.join(tmp,'node_modules'));
const paths=JSON.parse(await fs.readFile(path.join(tmp,'src/data/local-video-paths.json'),'utf8'));
const media=paths['06'];
await fs.mkdir(path.dirname(path.join(tmp,'assets/videos/works',media)),{recursive:true});
await fs.copyFile(path.join(root,'assets/videos/works',media),path.join(tmp,'assets/videos/works',media));
const titlesFile=path.join(tmp,'src/data/project-title-overrides.json');
const original=await fs.readFile(titlesFile);
let server,browser;
try{
 server=await createCoverStudio({projectRoot:tmp,port:5296});
 browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
 const page=await createSafePage(browser,{viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.url);
 await page.waitForFunction(()=>document.querySelectorAll('.ux-project').length===8);
 await page.locator('#ux-search').fill('岳阳楼');
 const card=page.locator('.ux-project[data-id="06"]');
 await card.locator('.ux-project-image').click();
 const before=await page.locator('#ux-title-zh').inputValue();
 await page.locator('#ux-title-zh').fill(before+'（未保存）');
 await page.locator('#ux-close-editor').click();
 assert(await page.locator('#ux-unsaved-dialog').isVisible());
 assert(await page.locator('#ux-editor').isVisible());
 assert((await page.locator('#ux-unsaved-description').textContent()).includes('作品名称'));
 console.log('DIRTY_CLOSE_PROTECTION_PASS');
 // The only focus targets inside a nested dialog must be that dialog's controls.
 for(const [selector,count] of [['#ux-unsaved-dialog',17]]){
  for(let i=0;i<count;i++){
   await page.keyboard.press('Tab');
   assert(await page.evaluate(sel=>!!document.activeElement?.closest(sel),selector));
  }
 }
 await page.locator('#ux-unsaved-keep').click();
 assert.equal(await page.locator('#ux-title-zh').inputValue(),before+'（未保存）');
 await page.locator('#ux-history-cover').click();
 assert(await page.locator('#ux-unsaved-dialog').isVisible(),
   'Switching to history must not discard an unsaved title.');
 await page.locator('#ux-unsaved-keep').click();
 assert.equal(await page.locator('#ux-title-zh').inputValue(),before+'（未保存）');
 await page.locator('#ux-close-editor').click();
 await page.locator('#ux-unsaved-discard').click();
 assert(await page.locator('#ux-editor').isHidden());
 assert.equal(await fs.readFile(titlesFile,'utf8'),original.toString());
 await card.locator('.ux-project-image').click();
 assert.equal(await page.locator('#ux-title-zh').inputValue(),before);
 await page.locator('#ux-history-cover').click();
 await page.waitForFunction(()=>document.querySelector('#ux-history-dialog')?.hidden===false);
 for(let i=0;i<25;i++){
  await page.keyboard.press('Tab');
  assert(await page.evaluate(()=>!!document.activeElement.closest('#ux-history-dialog')));
 }
 await page.keyboard.press('Escape');
 assert(await page.locator('#ux-history-dialog').isHidden());
 assert.equal(await page.locator('#ux-title-zh').inputValue(),before);
 console.log('NESTED_MODAL_FOCUS_AND_DISCARD_PASS');
 await page.locator('#ux-url-readonly').dblclick();
 const url=await page.locator('#ux-url-value').inputValue();
 await page.locator('#ux-url-value').fill(url+'?draft-only=1');
 await page.locator('#ux-close-editor').click();
 assert(await page.locator('#ux-unsaved-dialog').isVisible());
 assert((await page.locator('#ux-unsaved-description').textContent()).includes('ImageKit'));
 await page.locator('#ux-unsaved-discard').click();
 assert(await page.locator('#ux-editor').isHidden());
 console.log('URL_DRAFT_PROTECTION_PASS');
 for(let i=0;i<35;i++){
  await card.locator('.ux-project-image').click();
  for(let j=0;j<2;j++)await page.keyboard.press('Tab');
  await page.locator('#ux-close-editor').click();
  assert(await page.locator('#ux-editor').isHidden());
 }
 assert.deepEqual(errors,[]);
 assert.equal(await fs.readFile(titlesFile,'utf8'),original.toString());
 console.log('ALL_GUARD_FOCUS_ISOLATED_TESTS_PASS');
 await page.close();
}finally{
 if(browser)await browser.close();
 if(server)await server.close();
}
