import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import { createSafePage } from './lib/safe-media.mjs';
const b=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
for(const width of [390,1440]){
 const p=await createSafePage(b,{viewport:{width,height:880}});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(process.env.PORTFOLIO_URL || 'http://127.0.0.1:5174/',{waitUntil:'domcontentloaded'});
 for(const item of [
  {id:'film',anchor:'#projects .comet-archive__card',root:'.cinema-player',layer:'.cinema-player',pseudo:'::backdrop',close:'.cinema-player__close'},
  {id:'award',anchor:'#impact-awards .impact-award-card',root:'.impact-award-lightbox',layer:'.impact-award-lightbox',pseudo:'::before',close:'.impact-award-lightbox .cinema-player__close'},
  {id:'profile',anchor:'[data-social-profile-trigger="douyin"]',root:'.impact-profile-lightbox',layer:'.impact-profile-lightbox',pseudo:'::before',close:'.impact-profile-lightbox .cinema-player__close'},
 ]){
  await p.locator(item.anchor).first().scrollIntoViewIfNeeded();await p.locator(item.anchor).first().evaluate(el=>el.click());
  await p.locator(item.root).waitFor({state:'visible'});
  const earlier=await p.evaluate(({root,pseudo})=>Number(getComputedStyle(document.querySelector(root),pseudo).opacity),item);
  assert(earlier>=.92,'Backdrop should obscure background at opening '+item.id+': '+earlier);
  await p.waitForTimeout(320);
  const stable=await p.evaluate(({root,pseudo})=>Number(getComputedStyle(document.querySelector(root),pseudo).opacity),item);
  assert(Math.abs(stable-1)<.001,'Backdrop fails to settle '+item.id+': '+stable);
  await p.locator(item.close).first().evaluate(el=>el.click());
  await p.locator(item.root).waitFor({state:'detached',timeout:8000});
  console.log('PASS STEP01',width,item.id,'immediate',earlier,'settled',stable);
 }
 assert.deepEqual(errs,[]);
 await p.close();
}
await b.close();
