import { createSafePage, createSafeContext } from './lib/safe-media.mjs';
import {chromium} from 'playwright-core';
import {existsSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.PORTFOLIO_URL || 'http://127.0.0.1:5181/';
const out=process.env.CINEMA_SCREENSHOTS;
if(out)mkdirSync(out,{recursive:true});
const executablePath=['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'].find(existsSync);
const browser=await chromium.launch({executablePath,headless:true});
const rect=el=>{const r=el.getBoundingClientRect();return[r.x,r.y,r.width,r.height];};
async function ready(p,id){await p.waitForFunction(id=>document.querySelector('.cinema-player')?.dataset.projectId===id,id);assert.equal(await p.locator('.cinema-player video').count(),1);assert.deepEqual(await p.locator('.cinema-player video').evaluate(v=>[v.paused,v.currentTime,v.hasAttribute('src'),v.readyState]),[true,0,false,0]);}
async function shot(p,name){if(out)await p.screenshot({path:`${out}/${name}.png`});}
try{
 for(const width of [360,375,393,430,1280,1440,1920]){
  const p=await createSafePage(browser, {viewport:{width,height:width<=760?852:1000}});
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(new URL('index.html#projects',base).href);await p.waitForSelector('.comet-archive__card',{state:'attached'});await p.locator('#projects').scrollIntoViewIfNeeded();
  if(width===393){await p.locator('.nav-toggle').click();await p.waitForTimeout(600);await shot(p,'393-menu');await p.locator('.nav-toggle').click();await p.waitForTimeout(500);}
  // Desktop (>=1024px) has no toggle: compare the shared right control slot
  // with the visible header language button instead.
  const original=await p.locator(width>=1024?'header #nav-lang':'header .nav-toggle').evaluate(rect);
  const trigger=p.locator('.comet-archive__card').first();await trigger.click();await ready(p,'01');
  const close=await p.locator('.cinema-player__close').evaluate(rect);close.forEach((v,i)=>assert(Math.abs(v-original[i])<1,`Header close geometry changed ${original} -> ${close}`));
  assert.equal(await p.locator('.cinema-player__sequence button').first().isDisabled(),true);
  assert.equal(await p.locator('.cinema-player__count').textContent(),'1 / 8');
  if([393,1440,1920].includes(width))await shot(p,`${width}-landscape`);
  if(width===393){
   await p.locator('.cinema-player__play').click();await p.waitForFunction(()=>document.querySelector('.cinema-player video').currentTime>0.1);
   await p.locator('.cinema-player video').evaluate(v=>window.liveCinemaVideo=v);
   const time=await p.locator('.cinema-player video').evaluate(v=>v.currentTime);
   await p.locator('.cinema-player__language').click();await p.waitForTimeout(300);
   assert(await p.locator('.cinema-player video').evaluate((v,t)=>v===window.liveCinemaVideo&&!v.paused&&v.currentTime>=t,time));
   assert.equal(await p.locator('.cinema-player').getAttribute('data-project-id'),'01');
   assert.equal(await p.locator('html').getAttribute('lang'),'en');
   await shot(p,`${width}-english-playing`);
  }
  await p.locator('.cinema-player__sequence button').last().focus();await p.keyboard.press('Enter');await ready(p,'02');assert(await p.locator('.cinema-player__sequence button').last().evaluate(el=>el===document.activeElement));if(width===393)assert(await p.evaluate(()=>window.liveCinemaVideo.paused&&!window.liveCinemaVideo.getAttribute('src')));
  await p.locator('.cinema-player__sequence button').first().click();await ready(p,'01');
  if([393,1440,1920].includes(width)){
   for(const id of ['02','03','04']){await p.locator('.cinema-player__sequence button').last().click();await ready(p,id);}
   await shot(p,`${width}-portrait`);
  }
  if(width===393){
   for(const id of ['05','06','07','08']){await p.locator('.cinema-player__sequence button').last().click();await ready(p,id);}
   assert(await p.locator('.cinema-player__sequence button').last().isDisabled());assert.equal(await p.locator('.cinema-player__count').textContent(),'8 / 8');
   for(let i=0;i<16;i++){await p.keyboard.press('Tab');assert(await p.evaluate(()=>!!document.activeElement.closest('.cinema-player')));}
   assert(await p.locator('body > header #nav-lang').evaluate(el=>{el.focus();return !!document.activeElement.closest('.cinema-player');}));
  }else{await p.locator('.cinema-player__language').click();await p.waitForFunction(()=>document.documentElement.lang==='en');await ready(p,[1440,1920].includes(width)?'04':'01');}
  await p.keyboard.press('Escape');
  // New shared modal motion retains the native dialog for the 220ms exit.
  // Focus returns only after its backdrop is gone and the dialog unmounts.
  await p.locator('.cinema-player').waitFor({state:'detached'});
  await p.waitForFunction(() => document.activeElement === document.querySelector('.comet-archive__card'));
  assert(await trigger.evaluate(el=>el===document.activeElement));assert.equal(await p.locator('html').getAttribute('lang'),'en');
  if(width===393){
   await trigger.click();await ready(p,'01');
   await p.evaluate(()=>{const video=document.querySelector('.cinema-player video');window.addEventListener('pagehide',()=>sessionStorage.setItem('cinema-left-paused',String(video.paused)),{once:true});});
   await p.locator('.cinema-player__return').click();await p.waitForURL('**/works.html');
   assert.equal(await p.evaluate(()=>sessionStorage.getItem('cinema-left-paused')),'true');
   assert.equal(await p.locator('html').getAttribute('lang'),'en');
  }
  await p.goto(new URL('works.html?category=visual',base).href);const listScroll=await p.evaluate(()=>scrollY);await p.locator('.library-grid .comet-archive__card').first().click();await ready(p,'14');
  assert.equal(await p.locator('.cinema-player__count').textContent(),'1 / 2');
  await p.locator('.cinema-player__sequence button').last().click();await ready(p,'15');assert(await p.locator('.cinema-player__sequence button').last().isDisabled());
  assert.equal(await p.locator('.cinema-player__count').textContent(),'2 / 2');
  await p.locator('.cinema-player__return').scrollIntoViewIfNeeded();await p.locator('.cinema-player__return').click();await p.locator('.cinema-player').waitFor({state:'detached'});assert.equal(new URL(p.url()).searchParams.get('category'),'visual');assert.equal(await p.locator('.library-grid .comet-archive__card').count(),2);assert.equal(await p.locator('.cinema-player').count(),0);assert.equal(await p.evaluate(()=>scrollY),listScroll);
  // In-page history changes retain the site's native back behavior and dismiss cinema.
  await p.evaluate(()=>history.pushState(null,'',location.href+'#history-test'));
  await p.locator('.library-grid .comet-archive__card').first().click();await ready(p,'14');await p.goBack();await p.waitForSelector('.cinema-player',{state:'detached'});
  assert.deepEqual(errors,[]);
  console.log(`${width}px: header continuity, language keeps video, featured/filter sequence, disabled edges, focus, list return and history passed`);await p.close();
 }
 // Short viewport: actions scroll while navigation stays fixed and operable.
 const p=await createSafePage(browser, {viewport:{width:393,height:640}});await p.goto(new URL('works.html',base).href);await p.locator('.library-grid .comet-archive__card').nth(3).click();await ready(p,'04');
 const top=await p.locator('.cinema-player__close').evaluate(rect);await p.locator('.cinema-player__return').scrollIntoViewIfNeeded();const after=await p.locator('.cinema-player__close').evaluate(rect);after.forEach((v,i)=>assert(Math.abs(v-top[i])<1));await p.locator('.cinema-player__close').click();
 await p.close();
 console.log('Short viewport scrolling and fixed cinema navigation passed.');
}finally{await browser.close();}
