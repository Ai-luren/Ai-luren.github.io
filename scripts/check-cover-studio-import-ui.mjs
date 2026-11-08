// Regression for the creation modal's permanent visible MP4 import controls.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createCoverStudio} from '../tools/cover-studio/server.mjs';
import {createSafePage,getSafeMediaReport} from './lib/safe-media.mjs';
const root=path.resolve(import.meta.dirname,'..');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-import-ui-'));
for(const rel of ['src','assets/images','index.html','works.html'])
 await fs.cp(path.join(root,rel),path.join(temp,rel),{recursive:true});
await fs.writeFile(path.join(temp,'package.json'),'{"type":"module"}\n');
await fs.symlink(path.join(root,'node_modules'),path.join(temp,'node_modules'));
let server,browser;
try{
 server=await createCoverStudio({projectRoot:temp,port:5308});
 browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
 for(const [width,height] of [[1440,900],[1280,720],[1000,750]]){
  const page=await createSafePage(browser,{viewport:{width,height}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(server.url);
  await page.waitForFunction(()=>document.querySelectorAll('.ux-project').length===8);
  await page.locator('[data-filter="commercial"]').click();
  await page.locator('.ux-new-project-tile').click();
  const result=await page.evaluate(()=>{
   const box=sel=>{
    const e=document.querySelector(sel),r=e.getBoundingClientRect();
    return {x:r.x,right:r.right,cx:r.x+r.width/2,cy:r.y+r.height/2,h:r.height,bottom:r.bottom,visible:!!e.getClientRects().length};
   };
   return {
    icon:box('#ux-new-editor .ux-new-dropzone-icon'),
    svg:box('#ux-new-editor .ux-new-dropzone-icon svg'),
    zone:box('#ux-new-dropzone'),
    picker:box('#ux-new-editor .local-video-picker'),
    select:box('#ux-new-editor #local-video-select'),
    button:box('#ux-new-editor #import-local-video'),
    heading:box('#ux-new-editor .local-video-heading strong'),
    refresh:box('#ux-new-editor #refresh-local-videos'),
    stage:box('#ux-new-left'),
    save:box('#ux-new-use-frame'),
    details:document.querySelectorAll('#ux-new-editor details.local-video-picker').length,
   };
  });
  assert.equal(result.details,0,'MP4 directory must not be a disclosure');
  assert(result.picker.visible&&result.select.visible&&result.button.visible);
  assert(Math.abs(result.svg.cx-result.icon.cx)<=.5,'plus icon horizontal');
  assert(Math.abs(result.svg.cy-result.icon.cy)<=.5,'plus icon vertical');
  assert(Math.abs(result.icon.cx-result.zone.cx)<=1,'plus badge inside dropzone');
  assert(Math.abs(result.select.h-result.button.h)<=1,'select and import button height');
  assert(Math.abs(result.select.cy-result.button.cy)<=1,'select and import button baseline');
  assert(result.picker.right-result.button.right>=17,'import button flush to right edge');
  assert(result.refresh.x-result.heading.right>=6,'refresh button should sit beside section label, not at far right');
  assert(result.save.bottom<=result.stage.bottom+1,'frame action clipped on laptop');
  assert.deepEqual(errors,[]);
  assert.equal(getSafeMediaReport(page).urls.length,0);
  console.log('IMPORT_UI_PASS',width,height,'plus',result.svg.cx,result.svg.cy,'buttonH',result.button.h,'frameBottom',result.save.bottom);
  await page.locator('#ux-new-close').click();
  assert(await page.locator('#ux-new-editor').isHidden());
  await page.locator('.ux-new-project-tile').click();
  assert(await page.locator('#local-video-select').isVisible(),'picker hidden on reopen');
  await page.close();
 }
}finally{
 if(browser)await browser.close();
 if(server)await server.close();
}
