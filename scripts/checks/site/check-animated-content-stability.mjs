import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createSafePage } from '../../lib/safe-media.mjs';

// Hero remains readable from the first frame and has no opacity reveal, even
// though Featured cards now use independent scroll-driven depth transforms.
const base=process.env.PORTFOLIO_URL||'http://127.0.0.1:5174/';
const browser=await chromium.launch({
  executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true,
});
try{
 for(const width of [390,1440])for(const lang of ['zh','en']){
  const page=await createSafePage(browser,{viewport:{width,height:900}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(l=>localStorage.setItem('ailuren-lang',l),lang);
  try{
   for(let reload=0;reload<2;reload++){
     if(reload)await page.reload({waitUntil:'domcontentloaded'});
     else await page.goto(new URL('index.html',base).href,{waitUntil:'domcontentloaded'});
     const result=await page.evaluate(()=>new Promise(resolve=>{
       const ids=['#hero-title','#top .hero-subtitle','#top .hero-actions'];
       const frames=[];const start=performance.now();
       const tick=()=>{
         frames.push(ids.map(selector=>{
           const el=document.querySelector(selector);
           return el?Number(getComputedStyle(el).opacity):null;
         }));
         if(performance.now()-start<850)requestAnimationFrame(tick);
         else resolve(frames);
       };requestAnimationFrame(tick);
     }));
     assert(result.length>=20);
     const min=Array.from({length:3},(_,i)=>Math.min(...result.map(frame=>frame[i]??1)));
     assert(min.every(n=>n>=.999),width+'/'+lang+' Hero opacity flash: '+min);
     assert.equal(await page.locator('#top .hero-copy .reveal').count(),0);
     assert((await page.locator('#hero-title .text-type__content').textContent()).length>0);
   }
   assert.deepEqual(errors,[],width+'/'+lang+' runtime errors');
   console.log('PASS Hero no-flash on reload',width,lang);
  }finally{await page.close();}
 }
 console.log('HERO_FIRST_PAINT_STABILITY_PASS');
}finally{await browser.close();}
