import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createSafePage } from '../../lib/safe-media.mjs';
const browser = await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5174/';
try {
 for(const [width,lang] of [[320,'zh'],[390,'zh'],[390,'en'],[760,'zh'],[1440,'zh']]){
   const p=await createSafePage(browser,{viewport:{width,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.addInitScript(l=>localStorage.setItem('ailuren-lang',l),lang);
   await p.goto(base+'index.html',{waitUntil:'domcontentloaded'});
   await p.locator('.flip-experiment__detail').first().click();
   await p.locator('.lab-project-lightbox').waitFor({state:'visible'});
   const zoom=p.locator('.lab-project-image-zoom');
   assert.equal(await zoom.getAttribute('aria-pressed'),'false');
   await zoom.click();
   assert.equal(await zoom.getAttribute('aria-pressed'),'true');
   const dimension=await p.locator('.lab-project-image-canvas').evaluate(e=>({scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,overflow:getComputedStyle(e).overflowX}));
   assert(dimension.scrollWidth>dimension.clientWidth+30,`Zoom must actually enlarge and pan ${width} ${JSON.stringify(dimension)}`);
   assert(['auto','scroll'].includes(dimension.overflow),`Zoom container must pan ${width}`);
   await p.keyboard.press('Escape');
   assert.equal(await zoom.getAttribute('aria-pressed'),'false','First Escape exits zoom');
   assert.equal(await p.locator('.lab-project-lightbox').count(),1,'First Escape cannot close project');
   await zoom.click();
   await p.locator('.lab-project-image-tabs button').last().click();
   assert.equal(await zoom.getAttribute('aria-pressed'),'false','Switching image resets zoom');
   await p.locator('.lab-project-pagination button').last().click();
   assert.equal(await zoom.getAttribute('aria-pressed'),'false','Switching project resets zoom');
   await p.keyboard.press('Escape');await p.locator('.lab-project-lightbox').waitFor({state:'detached'});
   const hint=p.locator('#impact-awards .impact-award-enlarge-hint');
   assert.equal(await hint.count(),1,'Single understated award hint only');
   assert.match(await hint.textContent(),lang==='en'?/Tap to enlarge/:/点击图片放大/);
   await p.locator('#impact-awards .impact-award-grid-card').first().click();
   await p.locator('#impact-award-lightbox').waitFor({state:'visible'});
   await p.keyboard.press('Escape');await p.locator('#impact-award-lightbox').waitFor({state:'detached'});
   if(width<=760){
     await p.locator('header .nav-toggle').click();await p.waitForTimeout(175);
     const state=await p.locator('#mobile-nav-drawer').evaluate(e=>({opacity:Number(getComputedStyle(e).opacity),bg:getComputedStyle(e).backgroundColor,open:e.classList.contains('is-open')}));
     assert(state.open&&state.opacity>.95,`Menu scrim must appear ahead of labels ${width} ${JSON.stringify(state)}`);
     assert(/0\.97\)/.test(state.bg),`Drawer must hide bright underlying film ${width} ${state.bg}`);
     await p.locator('header .nav-toggle').click();
   }
   assert.deepEqual(errors,[]);
   console.log('PASS_UX_DETAIL',width,lang,JSON.stringify(dimension));
   await p.close();
 }
 console.log('UX_DETAIL_UPGRADES_PASS');
}finally{await browser.close()}
