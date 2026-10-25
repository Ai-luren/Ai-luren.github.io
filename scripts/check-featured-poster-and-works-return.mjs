import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createSafePage, getSafeMediaReport} from './lib/safe-media.mjs';

const browser = await chromium.launch({
  executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  headless: true,
});
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5174/';
try{
 for(const width of [390,1440]){
  const p=await createSafePage(browser,{viewport:{width,height:880}});
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route(/\/player-posters\//i, async route=>{
    await new Promise(resolve=>setTimeout(resolve,700));
    try { await route.fallback(); }catch {}
  });
  await p.goto(base,{waitUntil:'domcontentloaded'});
  await p.locator('#projects').scrollIntoViewIfNeeded();
  const card=p.locator('#projects .comet-archive__card').first();
  await card.evaluate(el=>el.click());
  await p.waitForTimeout(105);
  assert.equal(await p.locator('.cinema-player').count(),0,width+': viewer mounted before poster decode');
  await p.locator('.cinema-player').waitFor({state:'visible',timeout:11000});
  assert(await p.locator('.cinema-player__poster').evaluate(img=>img.complete&&img.naturalWidth>0),
    width+': first visible poster not decoded');
  assert.equal(getSafeMediaReport(p).urls.length,0);
  await p.locator('.cinema-player__close').click();
  await p.locator('.cinema-player').waitFor({state:'detached'});
  assert.deepEqual(errors,[]);
  console.log('PASS',width,'slow 16:9 player poster waits for decode, 3:4 cover stays visible until ready');
  await p.close();
 }
 for(const [width,lang] of [[320,'zh'],[320,'en'],[390,'zh'],[390,'en'],[760,'en'],[1440,'zh']]){
  const p=await createSafePage(browser,{viewport:{width,height:880}});
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(lang=>localStorage.setItem('ailuren-lang',lang),lang);
  await p.goto(new URL('works.html',base).href,{waitUntil:'domcontentloaded'});
  const link=p.locator('.library-page-navigation .cinema-player__brand--home-return');
  const label=p.locator('.library-page-navigation .cinema-player__brand-home');
  assert.equal((await label.textContent()).trim(),lang==='en'?'Home':'首页');
  await p.waitForFunction(()=>getComputedStyle(document.querySelector('.library-page-navigation .cinema-player__brand-home')).display!=='none');
  assert.equal(await p.locator('.library-back').count(),0,'Redundant in-page return link remains');
  assert((await link.getAttribute('href'))==='./index.html','Return target must be homepage Hero, not featured anchor');
  await p.evaluate(()=>window.scrollTo(0,Math.floor(document.documentElement.scrollHeight*.75)));
  await p.waitForTimeout(250);
  const geometry=await p.evaluate(()=>{
   const n=document.querySelector('.library-page-navigation .cinema-player__navigation').getBoundingClientRect();
   const t=document.querySelector('.library-page-navigation .cinema-player__brand-home').getBoundingClientRect();
   const l=document.querySelector('.library-page-navigation .cinema-player__language').getBoundingClientRect();
   return {nav:[n.top,n.bottom],home:[t.left,t.right],lang:[l.left,l.right],scroll:scrollY,overflow:document.documentElement.scrollWidth-innerWidth};
  });
  assert(geometry.nav[0]<50,width+' nav scrolled offscreen');
  assert(geometry.overflow<2,width+' unexpected horizontal overflow '+geometry.overflow);
  assert(geometry.home[1]+3<=geometry.lang[0],width+' return label overlaps language');
  await Promise.all([p.waitForURL(url=>/index(?:\.html)?/.test(url.pathname)),link.click()]);
  assert.equal(new URL(p.url()).hash,'','Return must land on homepage Hero, not #projects');
  assert.deepEqual(errors,[]);
  console.log('PASS',width,lang,'fixed home link and return navigation',JSON.stringify(geometry));
  await p.close();
 }
}finally{await browser.close()}
