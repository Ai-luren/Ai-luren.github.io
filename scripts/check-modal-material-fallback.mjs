import { createSafePage, createSafeContext } from './lib/safe-media.mjs';
// Normal rendering, native media emulation, and the real CSS @supports fallback branch.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const executablePath=['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'].find(existsSync);
const browser=await chromium.launch({executablePath,headless:true});
const base=process.env.PORTFOLIO_URL || 'http://127.0.0.1:5181/';
const out=process.env.CINEMA_SCREENSHOTS;
if(out) mkdirSync(out,{recursive:true});
function surface(selector,pseudo=null){
 const el=document.querySelector(selector),s=getComputedStyle(el,pseudo);
 const ancestors=[];for(let n=el;n;n=n.parentElement) ancestors.push(Number(getComputedStyle(n).opacity));
 return {background:s.backgroundColor,blur:s.backdropFilter,opacity:Number(s.opacity),ancestors,image:s.backgroundImage};
}
function checkSurface(s,mode){
 assert.equal(s.background,mode==='normal'?'rgba(12, 12, 13, 0.9)':'rgb(12, 12, 13)');
 assert.equal(s.blur,mode==='normal'?'blur(28px) saturate(1.02)':'none');
 assert.equal(s.opacity,1);assert(s.ancestors.every(v=>v===1));assert.equal(s.image,'none');
}
function box(){const r=document.querySelector('.cinema-player__stage').getBoundingClientRect();return[r.x,r.y,r.width,r.height];}
try{
 for(const width of [393,1440]) for(const lang of ['zh','en']) for(const mode of ['normal','reduced','unsupported']){
  const page=await createSafePage(browser, {viewport:{width,height:width===393?852:900}});
  await page.addInitScript(lang=>localStorage.setItem('ailuren-lang',lang),lang);
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:mode==='reduced'?'reduce':'no-preference'}]});
  await page.goto(new URL('index.html#projects',base).href);
  await page.waitForSelector('.comet-archive__card');
  assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-transparency: reduce)').matches),mode==='reduced');
  if(mode==='unsupported'){
   // Current Chromium cannot disable this shipped CSS feature through a runtime flag.
   // Substitute an unknown property in the @supports condition ONLY: the browser
   // evaluates it as unsupported and executes the original, unmodified fallback declarations.
   const changed=await page.evaluate(()=>{
    let count=0;const visit=sheet=>{
     for(let i=0;i<sheet.cssRules.length;i++){
      const r=sheet.cssRules[i];
      if(r.type===CSSRule.SUPPORTS_RULE && r.conditionText.includes('backdrop-filter')){
       const condition=r.conditionText.replaceAll('backdrop-filter','unsupported-backdrop-filter');
       if(!CSS.supports(condition)) throw new Error('Fallback condition did not become active');
       const css=r.cssText.replace(r.conditionText,condition);sheet.deleteRule(i);sheet.insertRule(css,i);count++;
      }
     }
    };for(const sheet of document.styleSheets) visit(sheet);return count;
   });assert(changed>0,'No actual @supports fallback was exercised');
  }
  await page.locator('#projects').scrollIntoViewIfNeeded();
  if(width===393){
   await page.locator('.nav-toggle').click();
   if(mode!=='normal'){
    const immediate=await page.evaluate(()=>getComputedStyle(document.querySelector('#mobile-nav-drawer')).opacity);
    assert.equal(immediate,'1','Fallback scrim must not fade through underlying content');
   }
   await page.waitForTimeout(600);
   checkSurface(await page.evaluate(`(${surface.toString()})('#mobile-nav-drawer')`),mode);
   if(out)await page.screenshot({path:`${out}/${width}-${lang}-${mode}-menu.png`});
   await page.locator('.nav-toggle').click();
   if(mode!=='normal')assert.equal(await page.locator('#mobile-nav-drawer').evaluate(el=>getComputedStyle(el).opacity),'1');
   await page.waitForTimeout(500);
  }
  for(const [index,format] of [[0,'landscape'],[3,'portrait']]){
   await page.locator('.comet-archive__card').nth(index).click();
   assert.deepEqual(await page.locator('.cinema-player video').evaluate(v=>[v.paused,v.currentTime,v.hasAttribute('src'),v.readyState,v.preload]),[true,0,false,0,'none']);
   await page.locator('.cinema-player__poster').evaluate(img=>img.decode());
   checkSurface(await page.evaluate(`(${surface.toString()})('.cinema-player','::backdrop')`),mode);
   const before=await page.evaluate(box);
   assert(await page.locator('.cinema-player video').evaluate(v=>v.paused&&v.currentTime===0));
   assert.equal(await page.evaluate(()=>document.querySelector('.cinema-player').scrollWidth>innerWidth),false);
   if(out)await page.screenshot({path:`${out}/${width}-${lang}-${mode}-${format}.png`});
   if(width===393&&lang==='zh'&&mode==='normal'&&format==='landscape'){
    await page.locator('.cinema-player__play').click();
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('.cinema-player__poster')).opacity==='0');
    const after=await page.evaluate(box);after.forEach((v,i)=>assert(Math.abs(v-before[i])<1));
   }
   await page.locator('.cinema-player video').evaluate(v=>window.lastFallbackVideo=v);
   await page.keyboard.press('Escape');
   assert(await page.evaluate(()=>window.lastFallbackVideo.paused));
  }
  console.log(`${width}px ${lang} ${mode}: computed material, opacity chain, open/close, no autoplay and stable frames passed`);
  await page.close();
 }
 console.log('Unsupported mode simulates the CSS @supports capability branch; it is not an old-browser or Safari certification.');
}finally{await browser.close();}
