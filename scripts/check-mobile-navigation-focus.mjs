import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createSafePage, getSafeMediaReport } from './lib/safe-media.mjs';

const executablePath=[
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
assert(executablePath,'Browser required');
const base=process.env.PORTFOLIO_URL || 'http://127.0.0.1:5174/';
const out='/tmp/oil-ui-review/mobile-focus-verification';
mkdirSync(out,{recursive:true});
const cases=[
  {name:'featured',path:'index.html',trigger:'#projects .comet-archive__card',viewer:'.cinema-player[open]'},
  {name:'library',path:'works.html',trigger:'.library-grid .comet-archive__card',viewer:'.cinema-player[open]'},
  {name:'awards',path:'index.html',trigger:'#impact-awards .impact-award-card',viewer:'.impact-award-lightbox'},
  {name:'social',path:'index.html',trigger:'[data-social-profile-trigger]',viewer:'.impact-profile-lightbox'},
  {name:'library-menu',path:'works.html',trigger:'.library-page-navigation .cinema-player__close',viewer:'.library-menu[open]'},
];
const browser=await chromium.launch({executablePath,headless:true});
let passed=0;
try {
  for(const width of [360,390,720]) for(const lang of ['zh','en']) for(const c of cases) {
    const page=await createSafePage(browser,{viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const tag=`${width}px ${lang} ${c.name}`;
    try {
      await page.addInitScript(value=>localStorage.setItem('ailuren-lang',value),lang);
      await page.goto(new URL(c.path,base).href,{waitUntil:'domcontentloaded'});
      const trigger=page.locator(c.trigger).first();
      await trigger.scrollIntoViewIfNeeded();await trigger.tap();
      await page.locator(c.viewer).waitFor({state:'visible',timeout:8000});
      const close=page.locator(c.viewer+' .cinema-player__close').first();
      await close.waitFor({state:'visible'});
      let state=await close.evaluate(el=>({focused:el===document.activeElement,
        modality:document.documentElement.dataset.navInput,
        tap:getComputedStyle(el).webkitTapHighlightColor,
        outline:getComputedStyle(el).outlineStyle}));
      assert.equal(state.focused,true,tag+': close must remain focused for accessibility');
      assert.equal(state.modality,'touch',tag+': touch origin not captured');
      assert.equal(state.tap,'rgba(0, 0, 0, 0)',tag+': tap highlight should be transparent');
      assert.equal(state.outline,'none',tag+': decorative blue ring remains after tapping');
      if(width===390)await page.screenshot({path:`${out}/${c.name}-${lang}-touch.jpg`,type:'jpeg',quality:76});
      // An attached hardware keyboard must restore the blue focus indicator.
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      state=await close.evaluate(el=>({focused:el===document.activeElement,
        visible:el.matches(':focus-visible'),
        outline:getComputedStyle(el).outlineStyle,
        color:getComputedStyle(el).outlineColor,
        modality:document.documentElement.dataset.navInput}));
      assert.equal(state.focused,true,tag+': tab sequence did not return to close');
      assert.equal(state.visible,true,tag+': keyboard focus not visible');
      assert.equal(state.outline,'solid',tag+': keyboard focus ring missing');
      assert.equal(state.color,'rgb(41, 151, 255)',tag+': focus ring should follow design system');
      assert.equal(state.modality,undefined,tag+': touch flag not reset by keyboard');
      // Mimic engines retaining :focus-visible after a subsequent pointer activation.
      await close.evaluate(el=>el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch'})));
      state=await close.evaluate(el=>({visible:el.matches(':focus-visible'),
        outline:getComputedStyle(el).outlineStyle,
        modality:document.documentElement.dataset.navInput}));
      assert.equal(state.modality,'touch',tag+': touch flag not restored');
      assert.equal(state.outline,'none',tag+': retained focus-visible not suppressed on touch');
      // Switching language inside the opened viewer must not wake the ring.
      await page.locator(c.viewer+' .cinema-player__language [data-switch-lang="'+(lang==='zh'?'en':'zh')+'"]').first().tap();
      const expectedLabel=lang==='zh'?'Close viewer':'关闭查看器';
      const switched=await close.evaluate(el=>({name:el.getAttribute('aria-label'),
        modality:document.documentElement.dataset.navInput,
        outline:getComputedStyle(el).outlineStyle}));
      assert.equal(switched.name,expectedLabel,tag+': language did not switch');
      assert.equal(switched.modality,'touch',tag+': language tap lost touch modality');
      assert.equal(switched.outline,'none',tag+': ring appeared after language toggle');
      assert.deepEqual(errors,[],tag+': JS errors');
      assert.equal(getSafeMediaReport(page).urls.length,0,tag+': CDN request occurred');
      passed++;
      console.log('PASS',tag, 'touch hides ring, Tab restores ring, touch hides again');
    }finally{await page.close();}
  }
  // Static home menu has a separate markup implementation, but its top
  // circular control must share the touch/keyboard focus behavior.
  for(const lang of ['zh','en']){
    const page=await createSafePage(browser,{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    try{
      await page.addInitScript(value=>localStorage.setItem('ailuren-lang',value),lang);
      await page.goto(new URL('index.html',base).href,{waitUntil:'domcontentloaded'});
      const menu=page.locator('header .nav-toggle');
      await menu.tap();
      await page.locator('#mobile-nav-drawer').waitFor({state:'visible'});
      let state=await menu.evaluate(el=>({modality:document.documentElement.dataset.navInput,
        outline:getComputedStyle(el).outlineStyle}));
      assert.equal(state.modality,'touch',lang+': home menu tap not registered');
      assert.equal(state.outline,'none',lang+': home menu has blue ring after tap');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(()=>document.documentElement.dataset.navInput),undefined,lang+': Tab not switching modality');
      await page.keyboard.press('Escape');
      await page.locator('#mobile-nav-drawer').waitFor({state:'hidden'});
      console.log('PASS 390px '+lang+' homepage mobile menu: no touch focus ring; keyboard restored');
    }finally{await page.close();}
  }
  console.log('PASS mobile shared navigation focus:',passed,'touch scenarios / 5 states / 3 widths / 2 languages + homepage menus');
}finally{await browser.close();}
