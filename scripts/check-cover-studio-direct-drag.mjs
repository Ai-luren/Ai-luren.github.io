import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {createSafePage,getSafeMediaReport} from './lib/safe-media.mjs';
import {createCoverStudio} from '../tools/cover-studio/server.mjs';

const root=path.resolve(import.meta.dirname,'..');
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-direct-drag-'));
for(const rel of ['src','assets/images','index.html','works.html'])
  await fs.cp(path.join(root,rel),path.join(tmp,rel),{recursive:true});
await fs.writeFile(path.join(tmp,'package.json'),'{"type":"module"}\n');
await fs.symlink(path.join(root,'node_modules'),path.join(tmp,'node_modules'));
const orderFile=path.join(tmp,'src/data/project-order.json');
const getOrder=async()=>JSON.parse(await fs.readFile(orderFile,'utf8'));
const clone=a=>[...a];
let studio,browser;
try{
 studio=await createCoverStudio({projectRoot:tmp,port:5273});
 browser=await chromium.launch({
   executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true,
 });
 const page=await createSafePage(browser,{viewport:{width:1440,height:930}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(studio.url);
 await page.waitForFunction(()=>document.querySelectorAll('#ux-gallery .ux-project').length===8);
 assert.equal(await page.locator('[data-filter="all"]').count(),0);
 assert.equal(await page.locator('.ux-handle').count(),0);
 assert.equal(await page.locator('#ux-save-bar').count(),0);
 const initial=await getOrder();
 const cover=page.locator('#ux-gallery .ux-project').first().locator('.ux-project-image');
 await cover.click();
 assert(await page.locator('#ux-editor').isVisible(),'A short click must open the editor');
 await page.locator('#ux-close-editor').click();
 assert((await getOrder()).featured.every((id,i)=>id===initial.featured[i]),
   'A click must not change the order');
 console.log('SINGLE_CLICK_OPENS_EDITOR_NO_REORDER');

 const source=page.locator('#ux-gallery .ux-project').first().locator('.ux-project-image');
 const destination=page.locator('#ux-gallery .ux-project').nth(2).locator('.ux-project-image');
 await source.scrollIntoViewIfNeeded();
 const from=await source.boundingBox(),to=await destination.boundingBox();
 await page.mouse.move(from.x+from.width/2,from.y+from.height/2);
 await page.mouse.down();
 await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:15});
 await page.mouse.up();
 await page.waitForFunction(()=>document.querySelector('#ux-toast')?.textContent?.includes('顺序已自动保存'));
 assert(await page.locator('#ux-editor').isHidden(),'Drag must not open the editor');
 let reordered=await getOrder();
 assert.equal(reordered.featured[2],initial.featured[0]);
 assert.equal(reordered.featured.length,8);
 assert.deepEqual(reordered.all,initial.all);
 const undo=page.locator('.ux-undo-button');
 assert(await undo.isVisible());
 await undo.click();
 await page.waitForFunction(()=>document.querySelector('#ux-toast')?.textContent?.includes('已撤销'));
 reordered=await getOrder();
 assert.deepEqual(reordered.featured,initial.featured);
 console.log('DESKTOP_IMAGE_DRAG_AUTOSAVES_AND_UNDO_RESTORES');

 await page.locator('[data-filter="commercial"]').click();
 const oldCat=await getOrder();
 const x=page.locator('#ux-gallery .ux-project').first().locator('.ux-project-image');
 const y=page.locator('#ux-gallery .ux-project').nth(1).locator('.ux-project-image');
 await x.scrollIntoViewIfNeeded();
 const a=await x.boundingBox(),b=await y.boundingBox();
 await page.mouse.move(a.x+a.width/2,a.y+a.height/2);
 await page.mouse.down();
 await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12});
 await page.mouse.up();
 await page.waitForFunction(()=>document.querySelector('#ux-toast')?.textContent?.includes('顺序已自动保存'));
 const after=await getOrder();
 assert.notDeepEqual(after.all,oldCat.all);
 assert.deepEqual(after.featured,oldCat.featured);
 assert.equal(getSafeMediaReport(page).urls.length,0);
 assert.deepEqual(errors,[]);
 await page.close();
 console.log('CATEGORY_ORDER_AUTOSAVES_WITH_FEATURED_UNTOUCHED');


}finally{
 if(browser)await browser.close();
 if(studio)await studio.close();
}
