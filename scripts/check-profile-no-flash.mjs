import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createSafePage, getSafeMediaReport } from './lib/safe-media.mjs';

const executablePath = ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
assert(executablePath);
const browser=await chromium.launch({executablePath,headless:true});
const base=process.env.PORTFOLIO_URL||'http://127.0.0.1:5174/';
try{
 for(const [width,lang] of [[390,'zh'],[390,'en'],[1440,'zh'],[1440,'en']]){
  const page=await createSafePage(browser,{viewport:{width,height:900},deviceScaleFactor:1});
  await page.addInitScript(value=>localStorage.setItem('ailuren-lang',value),lang);
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await page.route(/\/assets\/[^/]+\.webp(?:\?.*)?$/i,async route=>{
    // Delay images without bypassing shared ImageKit request interception.
    await new Promise(resolve=>setTimeout(resolve,550));
    await route.fallback();
  });
  try{
   await page.goto(new URL('index.html#impact-reach',base).href,{waitUntil:'domcontentloaded'});
   await page.locator('#impact-reach').scrollIntoViewIfNeeded();
   for(const id of ['douyin','wechat-channel']){
    const trigger=page.locator('[data-social-profile-trigger="'+id+'"]');
    await trigger.click();
    await page.waitForTimeout(65);
    if(await page.locator('.impact-profile-lightbox').count()){
      assert(await page.locator('.impact-profile-dialog-image').evaluateAll(
        imgs=>imgs.length===2&&imgs.every(img=>img.complete&&img.naturalWidth>0)
      ),width+' '+id+': modal appeared with undecoded images');
    }else{
      assert.equal(await trigger.getAttribute('aria-busy'),'true','Missing loading feedback');
    }
    const modal=page.locator('.impact-profile-lightbox');
    await modal.waitFor({state:'visible',timeout:20000});
    const proof=await page.locator('.impact-profile-dialog-image').evaluateAll(imgs=>imgs.map(img=>({
      done:img.complete,width:img.naturalWidth,height:img.naturalHeight,
      boxWidth:Math.round(img.getBoundingClientRect().width)
    })));
    assert.equal(proof.length,2);
    assert(proof.every(x=>x.done&&x.width&&x.height&&x.boxWidth>0),
      width+' '+id+': screenshot or QR still blank when viewer opened');
    assert.equal(await page.locator('.impact-profile-lightbox .cinema-player__navigation').count(),1);
    await page.locator('.impact-profile-lightbox .cinema-player__close').click();
    await modal.waitFor({state:'detached',timeout:8000});
    assert(await trigger.evaluate(el=>document.activeElement===el),'Focus not returned');
    console.log('PASS',width,lang,id,'decoded screenshot and QR before modal opening');
   }
   assert.deepEqual(errors,[]);
   assert.equal(getSafeMediaReport(page).urls.length,0);
  }finally{await page.close();}
 }
}finally{await browser.close();}
