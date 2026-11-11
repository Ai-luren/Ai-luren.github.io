// Desktop-only visual geometry and modal interaction regression (isolated portfolio fixture).
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {createCoverStudio} from '../tools/cover-studio/server.mjs';
import {createSafePage,getSafeMediaReport} from './lib/safe-media.mjs';
const root=path.resolve(import.meta.dirname,'..');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-phase3-layout-'));
for(const rel of ['src','assets/images','index.html','works.html'])
  await fs.cp(path.join(root,rel),path.join(temp,rel),{recursive:true});
await fs.writeFile(path.join(temp,'package.json'),'{"type":"module"}\n');
await fs.symlink(path.join(root,'node_modules'),path.join(temp,'node_modules'));
let studio,browser;
try{
 studio=await createCoverStudio({projectRoot:temp,port:5338});
 browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
 for(const [width,height] of [[1440,900],[1280,720],[1000,750]]){
  const p=await createSafePage(browser,{viewport:{width,height}});
  const errors=[];p.on('pageerror',error=>errors.push(error.message));
  await p.goto(studio.url);await p.waitForFunction(()=>document.querySelectorAll('#ux-gallery .ux-project').length===8);
  assert(await p.locator('#ux-sort-undo').isHidden());
  await p.locator('#ux-gallery .ux-project-image').first().click();
  const d=await p.evaluate(()=>{
   const q=s=>document.querySelector(s),r=s=>q(s).getBoundingClientRect();
   const stage=r('#ux-editor .ux-studio-stage'),inspector=r('#ux-editor .ux-studio-inspector');
   const prev=r('#ux-work-prev'),next=r('#ux-work-next'),pos=r('#ux-work-position'),top=r('#ux-editor .ux-editor-top');
   return {stageRight:stage.right,inspectorLeft:inspector.left,headerCenter:top.x+top.width/2,
     navCenter:(prev.left+next.right)/2,navArrowDifference:Math.abs(prev.height-next.height),
     positionY:pos.y+pos.height/2,arrowY:prev.y+prev.height/2,
     scroll:q('#ux-editor .ux-studio-inspector').scrollHeight-q('#ux-editor .ux-studio-inspector').clientHeight,
     overlap:Math.max(0,stage.right-inspector.left),
     context:q('#ux-context-version').textContent,stylesheet:[...document.styleSheets].some(x=>x.href?.endsWith('workbench-enhancements.css'))};
  });
  assert(d.stylesheet,'enhancement stylesheet missing');
  assert(d.overlap<=1,'stage overlaps inspector');
  assert(Math.abs(d.navCenter-d.headerCenter)<=2,'top arrows misaligned horizontally');
  assert(d.navArrowDifference<=1,'arrows mismatch sizes');
  assert(Math.abs(d.positionY-d.arrowY)<=2,'numeric position not vertically centered');
  if(width===1440)assert(d.scroll<=2,'details needs unintended scroll at 1440×900');
  await p.locator('[data-ux-panel=versions]').click();
  const imageKitShortcut=await p.locator('#ux-open-imagekit').evaluate(link=>{
    const bounds=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
    const title=document.querySelector('.ux-publish-section .ux-section-heading h3');
    const local=document.querySelector('#ux-preview-current');
    const inspector=document.querySelector('.ux-studio-inspector');
    return {href:link.href,target:link.target,rel:link.rel,text:link.textContent.trim(),
      visible:getComputedStyle(link).display!=='none',link:bounds(link),local:bounds(local),
      title:bounds(title),inspector:bounds(inspector)};
  });
  assert.equal(imageKitShortcut.href,'https://imagekit.io/dashboard/media-library');
  assert.equal(imageKitShortcut.target,'_blank');
  assert(imageKitShortcut.rel.includes('noopener')&&imageKitShortcut.rel.includes('noreferrer'));
  assert.equal(imageKitShortcut.text,'打开 ImageKit ↗');
  assert(imageKitShortcut.visible,'ImageKit shortcut missing in work settings');
  assert(imageKitShortcut.title.right<=imageKitShortcut.link.left+1,'Publish heading overlaps ImageKit shortcut');
  assert(imageKitShortcut.link.right<=imageKitShortcut.local.left+1,'ImageKit shortcut overlaps local preview');
  assert(imageKitShortcut.local.right<=imageKitShortcut.inspector.right+1,'Shortcut clipped outside inspector');
  assert(imageKitShortcut.link.height>=24,'ImageKit shortcut target too small');
  // An outbound link must not open an actual external tab during local checks.
  await p.locator('#ux-open-imagekit').evaluate(link=>link.addEventListener('click',event=>{
    event.preventDefault();window.__imageKitShortcutClicked=true;
  },{once:true}));
  await p.locator('#ux-open-imagekit').click();
  assert(await p.evaluate(()=>window.__imageKitShortcutClicked===true),'ImageKit shortcut not clickable');
  await p.locator('#ux-url-readonly').click();
  assert(await p.locator('#ux-url-form').isVisible(),'ImageKit address editor disrupted');
  await p.locator('#ux-url-cancel').click();
  console.log('IMAGEKIT_SHORTCUT_PASS',width,height,'no overlap or external requests');
  // Secondary dialogs should remain inside the same viewport and retain
  // visible close/actions at laptop heights, without requiring a real restore.
  await p.locator('[data-ux-panel=artwork]').click();
  await p.locator('#ux-history-cover').click();
  const history=await p.evaluate(()=>{
    const panel=document.querySelector('#ux-history-dialog .ux-history-panel').getBoundingClientRect();
    const close=document.querySelector('#ux-history-close').getBoundingClientRect();
    return {panelLeft:panel.left,panelRight:panel.right,panelTop:panel.top,panelBottom:panel.bottom,
      closeRight:close.right,closeTop:close.top,width:innerWidth,height:innerHeight};
  });
  assert(history.panelLeft>=-1&&history.panelRight<=history.width+1&&
    history.panelTop>=-1&&history.panelBottom<=history.height+1&&
    history.closeRight<=history.panelRight+1&&history.closeTop>=history.panelTop-1,
    'artwork history dialog outside desktop viewport');
  await p.locator('#ux-history-close').click();
  await p.locator('#ux-close-editor').click();
  await p.locator('#ux-gallery .ux-project .ux-star').first().click();
  const featured=await p.evaluate(()=>{
    const r=document.querySelector('#ux-feature-dialog .ux-feature-dialog-pane').getBoundingClientRect();
    const x=document.querySelector('#ux-feature-close').getBoundingClientRect();
    return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,
      closeRight:x.right,closeTop:x.top,width:innerWidth,height:innerHeight};
  });
  assert(featured.left>=-1&&featured.right<=featured.width+1&&featured.top>=-1&&
    featured.bottom<=featured.height+1&&featured.closeRight<=featured.right+1&&
    featured.closeTop>=featured.top-1,'featured replacement dialog outside viewport');
  await p.locator('#ux-feature-close').click();
  await p.locator('[data-filter="commercial"]').click();
  await p.locator('.ux-new-project-tile').click();
  const creation=await p.evaluate(()=>{
    const box=id=>document.querySelector(id).getBoundingClientRect();
    const modal=box('#ux-new-editor .ux-new-editor-pane'),left=box('#ux-new-left'),right=box('#ux-new-right');
    const close=box('#ux-new-close'),save=box('#ux-new-save');
    const one=document.querySelector('#ux-new-editor .ux-new-player-picture');
    const two=document.querySelector('#ux-new-editor #preview-wrap');
    return {within:modal.x>=0&&modal.right<=innerWidth+1&&modal.y>=0&&modal.bottom<=innerHeight+1,
      columns:left.right<=right.left+1,close:close.right<=modal.right&&close.top>=modal.top,
      save:save.right<=modal.right&&save.bottom<=modal.bottom,
      backgrounds:[getComputedStyle(one).backgroundColor,getComputedStyle(two).backgroundColor],
      progress:document.querySelector('#ux-new-progress').textContent};
  });
  assert(creation.within&&creation.columns&&creation.close&&creation.save,'new work layout overflow');
  assert.deepEqual(creation.backgrounds,['rgb(0, 0, 0)','rgb(0, 0, 0)'],'preview placeholders must be pure black');
  assert(creation.progress.includes('导入'),'new work guide not initialized');
  assert.deepEqual(errors,[]);
  assert.equal(getSafeMediaReport(p).urls.length,0);
  console.log('PHASE3_LAYOUT_PASS',width,height,'navOffset',d.navCenter-d.headerCenter,'inspectorScroll',d.scroll);
  await p.close();
 }
}finally{if(browser)await browser.close();if(studio)await studio.close();}
