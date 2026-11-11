// Prevent reintroducing visually off-center font glyph icons.
// All checks run against an isolated temporary portfolio project.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {chromium} from 'playwright-core';
import {createCoverStudio} from '../../../portfolio-workbench/server.mjs';
import {createSafePage,getSafeMediaReport} from '../../lib/safe-media.mjs';

const root=path.resolve(import.meta.dirname,'../../..');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-icon-alignment-'));
for(const file of ['src','assets/images','index.html','works.html']){
 await fs.cp(path.join(root,file),path.join(temp,file),{recursive:true});
}
await fs.writeFile(path.join(temp,'package.json'),'{"type":"module"}\n');
await fs.symlink(path.join(root,'node_modules'),path.join(temp,'node_modules'));
let server,browser;
try{
 server=await createCoverStudio({projectRoot:temp,port:5311});
 browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
 for(const [width,height] of [[1440,900],[1280,720],[1000,750]]){
  const page=await createSafePage(browser,{viewport:{width,height}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(server.url);
  await page.waitForFunction(()=>document.querySelectorAll('.ux-project').length===8);

  // The filled and outline states must both be true SVG, NOT ★/☆ text.
  const checkStars=async()=>{
   const stars=await page.locator('#ux-gallery .ux-star').evaluateAll(buttons=>buttons.map(button=>{
     const svg=button.querySelector('svg');
     const path=svg?.querySelector('path');
     if(!path)return {bad:'missing svg'};
     const r=button.getBoundingClientRect(),s=svg.getBoundingClientRect(),ink=path.getBBox();
     return {
       dx:s.x+s.width/2-(r.x+r.width/2),
       dy:s.y+s.height/2-(r.y+r.height/2),
       inkX:ink.x+ink.width/2,inkY:ink.y+ink.height/2,
       text:button.textContent,
       ariaPressed:button.getAttribute('aria-pressed')
     };
   }));
   assert(stars.length>0);
   for(const star of stars){
     assert(!star.bad,JSON.stringify(star));
     assert.equal(star.text,'','No font glyph in star button');
     assert(Math.abs(star.dx)<=.5 && Math.abs(star.dy)<=.5,'SVG star center: '+JSON.stringify(star));
     assert(Math.abs(star.inkX-12)<=.1 && Math.abs(star.inkY-12)<=.1,
      'Star drawn shape must be symmetric in its viewBox: '+JSON.stringify(star));
   }
   return stars;
  };
  const featured=await checkStars();
  assert(featured.some(s=>s.ariaPressed==='true'));
  await page.locator('#ux-gallery .ux-star').first().click();
  assert(await page.locator('#ux-feature-dialog').isVisible(),
   'Replacing a featured work still opens the existing dialog');
  await page.locator('#ux-feature-close').click();

  await page.locator('#ux-gallery .ux-project-image').first().click();
  await page.locator('[data-ux-panel=versions]').click();
  const detail=await page.locator('#ux-featured-action').evaluate(button=>{
   const svg=button.querySelector('svg');
   const r=button.getBoundingClientRect(),s=svg.getBoundingClientRect();
   return {dx:s.x+s.width/2-(r.x+r.width/2),dy:s.y+s.height/2-(r.y+r.height/2),
     display:getComputedStyle(button).display,hasSVG:!!svg};
  });
  assert(detail.hasSVG);
  assert(Math.abs(detail.dy)<.5,'Detail star vertical: '+JSON.stringify(detail));
  await page.locator('#ux-close-editor').click();

  let foundUnselected=false;
  for(const cat of ['commercial','short-film','social','visual']){
   await page.locator('[data-filter="'+cat+'"]').click();
   const stars=await checkStars();
   if(stars.some(s=>s.ariaPressed==='false'))foundUnselected=true;
   const addTile=await page.locator('.ux-new-project-tile').evaluate(tile=>{
     const ring=tile.querySelector('.ux-new-project-symbol');
     const svg=ring?.querySelector('svg');
     const path=svg?.querySelector('path');
     if(!svg||!path)return {error:'Import MP4 tile must contain a real SVG plus'};
     const r=ring.getBoundingClientRect(),s=svg.getBoundingClientRect(),
       frame=tile.querySelector('.ux-new-project-frame').getBoundingClientRect(),
       shape=path.getBBox();
     return {
       dx:(s.left+s.right-r.left-r.right)/2,
       dy:(s.top+s.bottom-r.top-r.bottom)/2,
       frameDx:(r.left+r.right-frame.left-frame.right)/2,
       pathCx:shape.x+shape.width/2,pathCy:shape.y+shape.height/2,
       text:ring.textContent
     };
   });
   assert(!addTile.error,JSON.stringify(addTile));
   assert.equal(addTile.text,'','Import MP4 plus must not be a text glyph');
   assert(Math.abs(addTile.dx)<=.5&&Math.abs(addTile.dy)<=.5,
     'Import MP4 SVG not centered in circle: '+JSON.stringify(addTile));
   assert(Math.abs(addTile.frameDx)<=.5,
     'Import MP4 circle not horizontally centered in tile: '+JSON.stringify(addTile));
   assert(Math.abs(addTile.pathCx-12)<.1&&Math.abs(addTile.pathCy-12)<.1,
     'Import MP4 cross geometry not centered in viewBox: '+JSON.stringify(addTile));
  }
  assert(foundUnselected,'No outline star state tested');

  await page.locator('.ux-new-project-tile').click();
  const selectors=await page.locator('#new-category,#local-video-select').evaluateAll(els=>els.map(el=>{
   const c=getComputedStyle(el);
   return {id:el.id,appearance:c.appearance,
    position:c.backgroundPosition,size:c.backgroundSize,
    padding:c.paddingRight,image:c.backgroundImage};
  }));
  for(const select of selectors){
   assert.equal(select.appearance,'none',select.id+' uses native arrow');
   assert(select.image.startsWith('url('),select.id+' lacks SVG arrow');
   assert(['right 22px center','calc(100% - 22px) 50%'].includes(select.position),
    select.id+' right edge inset: '+select.position);
   assert.equal(select.size,'18px 18px');
   assert.equal(select.padding,'54px');
  }
  const plus=await page.locator('.ux-new-dropzone-icon').evaluate(el=>{
   const svg=el.querySelector('svg');
   const r=el.getBoundingClientRect(),s=svg.getBoundingClientRect();
   return [s.x+s.width/2-(r.x+r.width/2),s.y+s.height/2-(r.y+r.height/2)];
  });
  assert(plus.every(d=>Math.abs(d)<.5));
  assert.deepEqual(errors,[]);
  assert.equal(getSafeMediaReport(page).urls.length,0);
  console.log('ICON_CENTER_PASS',width,height,'gallery SVG stars',featured.length,
   'Import MP4 plus across all 4 categories','detail centerY',detail.dy,'dropdown SVG inset 22px');
  await page.close();
 }
}finally{
 if(browser)await browser.close();
 if(server)await server.close();
}
