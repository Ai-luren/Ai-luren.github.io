/**
 * Step 01: preserve current surface, typography and navigation contract.
 * Browser regression baseline, not a redesign.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const browserBinary = [
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
assert(browserBinary, 'Edge or Chrome required for design-system QA');
const port = 5238;
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:' + port + '/';
const near = (a,b,tolerance=1.5) => Math.abs(a-b)<=tolerance;
let server;
async function awaitServer() {
  for(let i=0;i<90;i++) {
    try {if((await fetch(base,{signal:AbortSignal.timeout(900)})).ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  throw Error('Vite did not start');
}
try {
  if(!process.env.PORTFOLIO_URL) {
    server=spawn(process.execPath,['./node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'});
    await awaitServer();
  }
  const browser=await chromium.launch({executablePath:browserBinary,headless:true});
  try {
    for(const width of [360,390,760,1024,1440])for(const lang of ['zh','en']) {
      const pages={};
      for(const kind of ['home','library']) {
        const page=await browser.newPage({viewport:{width,height:900}});
        await page.addInitScript(value=>localStorage.setItem('ailuren-lang',value),lang);
        await page.goto(new URL(kind==='home'?'index.html#impact-reach':'works.html',base).href);
        await page.locator(kind==='home'?'#impact-reach .impact-glass':'.library-grid .comet-archive__image').first().waitFor();
        pages[kind]=await page.evaluate(kind=>{
          const get=selector=>{
            const el=document.querySelector(selector);if(!el)return null;
            const s=getComputedStyle(el),r=el.getBoundingClientRect();
            return {radius:s.borderRadius,surface:s.backgroundColor,
              blur:s.backdropFilter||s.webkitBackdropFilter,
              fontSize:Number.parseFloat(s.fontSize),
              width:r.width,height:r.height,x:r.x,y:r.y};
          };
          const selectors=kind==='home'?{
            nav:'body > header',title:'#projects .section-title',
            cover:'#projects .comet-archive__image',
            awards:'#impact-awards .impact-glass',
            platform:'#impact-programs .impact-glass',
            media:'#impact-reach .impact-glass',
            lab:'#experiments .flip-experiment',
            about:'#profile .closing-card',
            mobileWorks:'#projects .comet-archive-mobile-shell',
          }:{
            nav:'.library-page-navigation .cinema-player__navigation',
            title:'.library-intro .page-title',
            cover:'.library-grid .comet-archive__image',
          };
          return {viewportOverflow:document.documentElement.scrollWidth-innerWidth,
            elements:Object.fromEntries(Object.entries(selectors).map(([name,selector])=>[name,get(selector)]))};
        },kind);
        await page.close();
      }
      const home=pages.home,library=pages.library,tag=width+'px '+lang;
      assert(home.viewportOverflow<=2&&library.viewportOverflow<=2,tag+': viewport overflow');
      assert(home.elements.nav&&library.elements.nav,tag+': shared nav missing');
      for(const field of ['radius','surface','blur'])
        assert.equal(home.elements.nav[field],library.elements.nav[field],tag+': nav '+field);
      assert(near(home.elements.nav.x,library.elements.nav.x),tag+': nav x');
      assert(near(home.elements.nav.width,library.elements.nav.width),tag+': nav width');
      const glass=home.elements.awards;
      assert(glass&&glass.width>0,tag+': award glass missing');
      for(const name of ['platform','media','lab','about']){
        const panel=home.elements[name];
        assert(panel&&panel.width>0,tag+': '+name+' panel missing');
        for(const field of ['radius','surface','blur'])
          assert.equal(panel[field],glass[field],tag+': '+name+' '+field);
      }
      if(width<=720) {
        const mobile=home.elements.mobileWorks;
        assert(mobile&&mobile.width>0,tag+': mobile work panel missing');
        assert.equal(mobile.surface,glass.surface,tag+': mobile surface');
        assert.equal(mobile.radius,glass.radius,tag+': mobile radius');
      }
      for(const pageData of [home,library]){
        const cover=pageData.elements.cover;
        assert(cover&&cover.width>0&&cover.height>0,tag+': work cover missing');
        assert.equal(cover.radius,'18px',tag+': cover radius');
        assert(near(cover.width/cover.height,.75,.02),tag+': 3:4 cover');
      }
      assert(near(home.elements.title.fontSize,library.elements.title.fontSize),tag+': heading scale differs');
      console.log('PASS '+tag+': 2 pages; nav, glass, cover, typography, overflow');
    }
  }finally{await browser.close();}
  console.log('PASS: design-system baseline (5 widths × 2 languages × 2 pages)');
}finally{
  if(server){server.kill('SIGTERM');await new Promise(resolve=>setTimeout(resolve,150));}
}
