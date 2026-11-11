// Mobile fullscreen is a first-class action, independent of tiny native controls.
// ImageKit is intercepted; no live video data is downloaded by these tests.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createSafePage,getSafeMediaReport} from '../../lib/safe-media.mjs';

const base=process.env.PORTFOLIO_URL||'http://127.0.0.1:5174/';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
try {
  for(const {width,height,lang,mode} of [
    {width:390,height:844,lang:'zh',mode:'webkit'},
    {width:360,height:740,lang:'en',mode:'standard'},
    {width:393,height:852,lang:'zh',mode:'standard'},
    {width:1440,height:900,lang:'zh',mode:'desktop'},
  ]){
    const page=await createSafePage(browser,{viewport:{width,height},hasTouch:mode!=='desktop'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(({lang,mode})=>{
      localStorage.setItem('ailuren-lang',lang);
      window.__fullscreenCalls=[];
      if(mode!=='desktop'){
        Object.defineProperty(HTMLVideoElement.prototype,'webkitEnterFullscreen',{configurable:true,value:
          mode==='webkit' ? function(){window.__fullscreenCalls.push('webkit')} : undefined});
        Object.defineProperty(HTMLVideoElement.prototype,'webkitSupportsFullscreen',{configurable:true,value:mode==='webkit'});
        Object.defineProperty(HTMLVideoElement.prototype,'requestFullscreen',{configurable:true,value:function(){window.__fullscreenCalls.push('standard');return Promise.resolve();}});
      }
    },{lang,mode});
    await page.goto(new URL('works.html',base).href,{waitUntil:'domcontentloaded'});
    await page.locator('.library-grid .comet-archive__card').first().click();
    await page.locator('.cinema-player[open] .cinema-player__stage').waitFor();
    const button=page.locator('.cinema-player__fullscreen-action');
    assert.equal(await button.count(),1,`Mobile fullscreen control must exist ${width}`);
    if(mode==='desktop'){
      assert.equal(await button.isVisible(),false,'Desktop must keep native fullscreen controls without extra button');
      assert.deepEqual(errors,[]);await page.close();continue;
    }
    await page.waitForFunction(()=>document.querySelector('.cinema-player[open]')?.classList.contains('is-motion-visible'));
    await page.waitForTimeout(320); // Wait for the measured media layout and entrance animation to stabilize.
    await page.waitForFunction(()=>document.querySelector('.cinema-player__fullscreen-action')?.getBoundingClientRect().height>=44);
    const before=await page.evaluate(()=>{
      const root=document.querySelector('.cinema-player'),video=root.querySelector('video'),stage=root.querySelector('.cinema-player__stage'),button=root.querySelector('.cinema-player__fullscreen-action'),title=root.querySelector('.cinema-player__caption');
      const r=e=>{const b=e.getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right,height:b.height,width:b.width};};
      return {src:video.getAttribute('src'),ready:video.readyState,stage:r(stage),button:r(button),title:r(title),rootScrollHeight:root.scrollHeight};
    });
    assert(!before.src && before.ready===0,'No MP4 loaded before user asks to play/fullscreen');
    assert(before.rootScrollHeight<=height+1,
      `Normal mobile viewport should not need scrolling for the new action: ${width}×${height}`);
    assert(before.button.height>=44,'Fullscreen tap target >=44px');
    assert(before.button.left>=0 && before.button.right<=width+1,'Fullscreen button within viewport');
    assert(before.button.top>=before.stage.bottom,'Fullscreen action follows the video, not native controls');
    assert(before.button.bottom<=before.title.top,'Fullscreen action precedes the work title');
    assert.equal(getSafeMediaReport(page).urls.length,0,'Opening a film should not request CDN media');
    await button.click();
    await page.waitForFunction(()=>document.querySelector('.cinema-player video')?.hasAttribute('src'));
    const calls=await page.evaluate(()=>window.__fullscreenCalls);
    assert.deepEqual(calls,[mode],`Fullscreen API must be called synchronously during first tap, ${width}`);
    assert.equal(await page.locator('.cinema-player video').count(),1,'Native video preserved');
    assert.deepEqual(errors,[]);
    // Development deliberately prefers local MP4s and should not touch ImageKit.
    // When the project has a cloud URL, safe-media substitutes a local fixture.
    const source=await page.locator('.cinema-player video').getAttribute('src');
    assert(source.endsWith('.mp4'),'Fullscreen action must attach the selected film only on tap');
    if(source.includes('imagekit.io')){
      await page.waitForTimeout(120);
      assert(getSafeMediaReport(page).urls.length>=1,'Cloud media request must be intercepted');
    }else{
      assert.equal(getSafeMediaReport(page).urls.length,0,'Local MP4s must not request ImageKit');
    }
    await page.keyboard.press('Escape');
    console.log(`PASS mobile fullscreen ${width}×${height} ${lang}: ${mode}, first-tap media, 44px target, no UI errors`);
    await page.close();
  }
}finally {await browser.close();}
