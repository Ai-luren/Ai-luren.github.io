import {chromium} from 'playwright-core';
import {existsSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.PORTFOLIO_URL || 'http://127.0.0.1:5181/';
const out=process.env.CINEMA_SCREENSHOTS;
if(out) mkdirSync(out,{recursive:true});
const executablePath=['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
const browser=await chromium.launch({executablePath,headless:true});
const rect=()=>{const s=document.querySelector('.cinema-player__stage'),c=document.querySelector('.cinema-player__caption'),v=document.querySelector('.cinema-player video');const r=s.getBoundingClientRect(),i=c.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,cx:i.x,cy:i.y,cw:i.width,paused:v.paused,time:v.currentTime,ready:v.readyState,radius:getComputedStyle(s).borderRadius,clip:getComputedStyle(s).overflow,fit:getComputedStyle(v).objectFit};};
function same(a,b){for(const k of ['x','y','w','h','cx','cy','cw']) assert(Math.abs(a[k]-b[k])<1,`${k}: ${a[k]} -> ${b[k]}`);}
try {
 for(const width of [1440,1920,360,375,393,430]) {
  const height=width>=1000?900:852;
  const page=await browser.newPage({viewport:{width,height}});
  for(const [index,label,ratio] of [[0,'16-9',16/9],[3,'9-16',9/16]]) {
   await page.goto(new URL('works.html',base).href);
   let release; const gate=new Promise(resolve=>release=resolve);
   await page.route('**/assets/videos/works/**',async route=>{await gate;await route.continue();});
   // Capture geometry on the very first rendered modal frame, before metadata is available.
   await page.evaluate(()=>{window.cinemaRects=[];const sample=()=>{const s=document.querySelector('.cinema-player[open] .cinema-player__stage');if(s){const r=s.getBoundingClientRect();window.cinemaRects.push([r.x,r.y,r.width,r.height]);}window.cinemaSampler=requestAnimationFrame(sample);};window.cinemaSampler=requestAnimationFrame(sample);});
   await page.locator('.library-grid .comet-archive__card').nth(index).click();
   const initial=await page.evaluate(rect);
   assert(initial.w>0 && Math.abs(initial.w/initial.h-ratio)<.001);
   assert(initial.paused && initial.time===0 && initial.ready===0);
   assert.equal(initial.clip,'hidden'); assert.equal(initial.fit,'contain');
   assert.equal(initial.radius,width>=1000?'18px':'16px');
   await page.locator('.cinema-player__poster').evaluate(async img=>{await img.decode();});
   assert(await page.locator('.cinema-player__poster').evaluate(img=>Math.abs(img.naturalWidth/img.naturalHeight-Number(img.closest('.cinema-player__stage').style.width.replace('px',''))/Number(img.closest('.cinema-player__stage').style.height.replace('px','')))<.005));
   await page.waitForTimeout(220);
   if(out && [1440,393].includes(width)) await page.screenshot({path:`${out}/${width}-${label}-before.png`});
   release();
   await page.waitForFunction(()=>document.querySelector('.cinema-player video').readyState>=2);
   same(initial,await page.evaluate(rect));
   await page.locator('.cinema-player__play').click();
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('.cinema-player__poster')).opacity==='0');
   same(initial,await page.evaluate(rect));
   assert.equal(await page.locator('.cinema-player__play').count(),0);
   const samples=await page.evaluate(()=>{cancelAnimationFrame(window.cinemaSampler);return window.cinemaRects;});
   for(const r of samples) for(let i=0;i<4;i++) assert(Math.abs(r[i]-[initial.x,initial.y,initial.w,initial.h][i])<1,'Geometry changed after first paint');
   if(out && [1440,393].includes(width)) await page.screenshot({path:`${out}/${width}-${label}-playing.png`});
   await page.locator('.cinema-player video').evaluate(v=>v.requestFullscreen());
   assert(await page.evaluate(()=>document.fullscreenElement?.tagName==='VIDEO'));
   await page.evaluate(()=>document.exitFullscreen());
   same(initial,await page.evaluate(rect));
   await page.locator('.cinema-player video').evaluate(v=>window.previousCinemaVideo=v);
   await page.keyboard.press('Escape');
   assert(await page.evaluate(()=>window.previousCinemaVideo.paused && !window.previousCinemaVideo.getAttribute('src')));
   await page.unroute('**/assets/videos/works/**');
   console.log(`${width}px ${label}: stable first paint → delayed metadata → first decoded frame; native-ratio poster, real rounding, no autoplay, close releases source (${samples.length} samples)`);
  }
  await page.close();
 }
 console.log('No real 3:4 video available; not marked verified.');
} finally {await browser.close();}
