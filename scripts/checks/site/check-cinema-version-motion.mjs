// Regress the same 330ms moving thumb used by the shared language control.
// A version may visually select immediately, but its poster cannot be swapped
// until decoded. All browser media is protected from ImageKit network traffic.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createSafePage, getSafeMediaReport } from '../../lib/safe-media.mjs';

const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5174/';
const browser = await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));

async function metrics(page) {
  return page.locator('.cinema-player__versions').evaluate(track => {
    const selected=track.querySelector('.cinema-player__version-thumb');
    const buttons=[...track.querySelectorAll('.cinema-player__version')];
    const box = el => { const r=el.getBoundingClientRect();return {cx:r.x+r.width/2,width:r.width}; };
    return {thumb:box(selected),buttons:buttons.map(b=>({...box(b),
      selected:b.dataset.visualSelected==='true',pressed:b.getAttribute('aria-pressed')==='true',
      busy:b.getAttribute('aria-busy')==='true'}))};
  });
}

try {
  for(const {width,height,projectId,toIndex,reduced,slowPoster} of [
    {width:390,height:844,projectId:'19',toIndex:2,reduced:false,slowPoster:false},
    {width:360,height:740,projectId:'19',toIndex:1,reduced:false,slowPoster:false},
    {width:1440,height:900,projectId:'16',toIndex:1,reduced:false,slowPoster:true},
    {width:390,height:844,projectId:'16',toIndex:1,reduced:true,slowPoster:false},
  ]){
    const page=await createSafePage(browser,{viewport:{width,height}});
    await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    if(slowPoster) await page.route(/\.webp(?:\?|$)/i,async route=>{
      if(decodeURIComponent(new URL(route.request().url()).pathname).includes('MEXC Member Perks - Version B')){
        await delay(1300);
      }
      try { await route.fallback(); } catch { /* navigation may cancel image requests */ }
    });
    await page.goto(new URL('works.html',base).href,{waitUntil:'domcontentloaded'});
    await page.locator(`.library-grid .comet-archive__card[data-project-id="${projectId}"]`).click();
    await page.waitForFunction(()=>document.querySelector('.cinema-player[open]')?.classList.contains('is-motion-visible'));
    await page.waitForTimeout(350);
    const initial=await metrics(page);
    if(width===360 && projectId==='19'){
      const mobileLabelFit=await page.locator('.cinema-player__versions').evaluate(track=>({
        withinViewport:track.getBoundingClientRect().left>=0 && track.getBoundingClientRect().right<=innerWidth,
        nowrap:[...track.querySelectorAll('.cinema-player__version')].every(b=>
          getComputedStyle(b).whiteSpace==='nowrap' && b.getBoundingClientRect().height<=44),
      }));
      assert(mobileLabelFit.withinViewport && mobileLabelFit.nowrap,
        'Narrow portrait video must not wrap or clip three version titles');
    }
    assert.equal(initial.buttons.filter(x=>x.selected).length,1,'Exactly one visual selection');
    assert.equal(initial.buttons[0].pressed,true,'Initial version is first after opening');
    const targetCenter=initial.buttons[toIndex].cx;
    assert(targetCenter>initial.thumb.cx+20,'Version target has distinct geometry');
    await page.locator('.cinema-player__version').nth(toIndex).click();
    await page.waitForTimeout(reduced?40:100);
    const midway=await metrics(page);
    assert(midway.buttons[toIndex].selected,'Thumb should reflect requested version immediately');
    if(!reduced){
      assert(midway.thumb.cx>initial.thumb.cx+5,'Thumb must visibly travel from the old tab');
      assert(midway.thumb.cx<targetCenter-2,'330ms indicator must not snap instantly to target');
    }
    if(slowPoster){
      assert(midway.buttons[0].pressed,'Actual film must keep version A until B poster decodes');
      assert(midway.buttons[toIndex].busy,'Pending version indicated for screen readers');
      assert(await page.locator('.cinema-player__poster').evaluate(img=>img.complete&&img.naturalWidth>0),
        'Outgoing poster must stay decoded and visible during thumb slide');
    }
    await page.waitForTimeout(360);
    const settled=await metrics(page);
    assert(Math.abs(settled.thumb.cx-targetCenter)<2,'Thumb must settle precisely at target');
    await page.waitForFunction(index=>document.querySelectorAll('.cinema-player__version')[index]?.getAttribute('aria-pressed')==='true',toIndex,{timeout:12000});
    const final=await metrics(page);
    assert.equal(final.buttons.filter(x=>x.pressed).length,1,'Only one actual version remains pressed');
    assert.deepEqual(errors,[],'No browser errors during version switch');
    assert.equal(getSafeMediaReport(page).urls.length,0,'Version switching cannot fetch cloud MP4');
    console.log(`VERSION_MOTION_PASS ${width}px ${projectId} v${toIndex+1} reduced=${reduced} delay=${slowPoster}: glide and decoded poster`);
    await page.close();
  }
}finally {await browser.close();}
