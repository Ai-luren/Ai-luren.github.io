// Two deliberately scoped UX contracts:
// 1) Featured and All Work hover/focus stay on the photograph, never darken it
//    under an expanding black gradient or shift card geometry.
// 2) Mobile homepage menu keeps its existing dark palette, persistent top nav,
//    four accessible links and = -> X animation, with readable editorial layout.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createSafePage,getSafeMediaReport} from '../../lib/safe-media.mjs';
import {assertMobileMenuContract} from '../../lib/mobile-menu-contract.mjs';

const smoke=process.argv.includes('--smoke');
let browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
const base=process.env.PORTFOLIO_URL||'http://127.0.0.1:5174/';
try {
  const looks=[];
  for(const lang of ['zh','en']){
    const p=await createSafePage(browser,{viewport:{width:1440,height:900}});
    const errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.addInitScript(l=>localStorage.setItem('ailuren-lang',l),lang);
    for(const [url,selector] of [['index.html#projects','#projects .comet-archive__card'],['works.html','.work-library .comet-archive__card']]){
      await p.goto(new URL(url,base).href,{waitUntil:'domcontentloaded'});
      const card=p.locator(selector).first(),image=card.locator('.comet-archive__image');
      await card.waitFor();await card.scrollIntoViewIfNeeded();
      const before=await image.boundingBox();
      await card.hover();await p.waitForTimeout(420);
      const s=await image.evaluate(el=>{
        const card=el.closest('.comet-archive__card'),surf=getComputedStyle(card),art=getComputedStyle(el);
        return {border:surf.borderColor,shadow:surf.boxShadow,
          shadowToken:surf.getPropertyValue('--portfolio-work-card-shadow-hover').trim(),
          background:surf.backgroundColor,
          imageBorder:art.borderTopWidth,imageShadow:art.boxShadow,
          pseudoOpacity:getComputedStyle(el,'::after').opacity,
          pseudoDisplay:getComputedStyle(el,'::after').display,
          transform:art.transform,
          badge:getComputedStyle(el.querySelector('.comet-archive__play-badge')).display,
          hover:card.matches(':hover'),
          width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height};
      });
      assert(s.hover,'Card must respond to hover');
      assert.equal(s.border,'rgba(205, 227, 245, 0.46)','A+ outer card border hover');
      const tokenDimensions=s.shadowToken.match(/^0(?:px)?\s+(\d+)px\s+(\d+)px/);
      assert(tokenDimensions && s.shadow.includes(`0px ${tokenDimensions[1]}px ${tokenDimensions[2]}px 0px`)
        && s.shadow.includes(' inset'), 'A+ hover uses the current shared outer-shadow token and inset edge');
      assert.equal(s.imageBorder,'0px','Artwork must not have second border');
      assert.equal(s.imageShadow,'none','Artwork must not have second shadow');
      assert(s.pseudoDisplay==='none'||Number(s.pseudoOpacity)===0,'Artwork must not darken under a gradient');
      assert.equal(s.transform,'none','Artwork must not scale');
      assert.notEqual(s.badge,'none','Single icon badge remains present');
      assert(Math.abs(s.width-before.width)<1 && Math.abs(s.height-before.height)<1,'Artwork dimensions remain stable');
      looks.push({lang,url,border:s.border,shadow:s.shadow});
    }
    assert.deepEqual(errors,[],`card hover JS errors ${lang}`);
    assert.equal(getSafeMediaReport(p).urls.length,0);
    await p.close();
  }
  assert(looks.every(x=>x.border===looks[0].border&&x.shadow===looks[0].shadow),'Home and All Work hover must be pixel-equivalent');
  console.log('PASS featured + library hover matches in zh/en, no expanding black overlay');

  // Deep retains the seven original viewports x both languages.
  // Smoke samples a short phone, a common phone and the mobile boundary.
  const menuCases=smoke
    ? [[320,568,'zh'],[390,844,'en'],[744,760,'zh']]
    : [{w:320,h:568},{w:320,h:700},{w:360,h:740},{w:390,h:844},{w:393,h:852},{w:430,h:932},{w:744,h:760}]
      .flatMap(({w,h})=>['zh','en'].map(lang=>[w,h,lang]));
  let menuDone=0;
  for(const [w,h,lang] of menuCases){
    // Short browser sessions avoid accumulating WebGL/hero-video contexts in
    // one Chromium process across 14 separate mobile homepage navigations.
    if(menuDone && menuDone%4===0){await browser.close();browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});}
    const p=await createSafePage(browser,{viewport:{width:w,height:h},isMobile:true,hasTouch:true});
    const errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.addInitScript(l=>localStorage.setItem('ailuren-lang',l),lang);
    await p.goto(new URL('index.html',base).href,{waitUntil:'domcontentloaded'});
    const header=p.locator('body > header');
    const old=await header.evaluate(el=>el.getBoundingClientRect().toJSON());
    const toggle=p.locator('header .nav-toggle');
    await toggle.tap();
    await p.waitForFunction(()=>document.querySelector('#mobile-nav-drawer')?.classList.contains('is-open'));
    await p.waitForTimeout(460);
    const info=await p.evaluate(()=>{
      const box=e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
      const drawer=document.querySelector('#mobile-nav-drawer'),header=document.querySelector('body > header');
      return {bg:getComputedStyle(drawer).backgroundColor,menuLinks:[...drawer.querySelectorAll('#mobile-primary-nav a')].map(el=>({...box(el),text:el.textContent.trim(),font:parseFloat(getComputedStyle(el).fontSize)})),
        footer:box(drawer.querySelector('.mobile-nav-drawer-foot')),footerText:drawer.querySelector('.mobile-nav-drawer-foot').innerText,
        socialHeading:drawer.querySelector('.mobile-menu__social-label').innerText,
        socialCount:drawer.querySelectorAll('.mobile-menu__social-list a').length,
        header:box(header),headerVisible:getComputedStyle(header).visibility==='visible',
        backgroundOverflow:document.documentElement.scrollWidth-innerWidth,
        pageHeight:innerHeight,drawerScroll:drawer.scrollHeight,drawerClient:drawer.clientHeight,
        active:document.body.classList.contains('mobile-nav-open')};
    });
    assert(info.active,`${w} ${lang}: menu is open`);
    assertMobileMenuContract({
      label:w+' '+lang+' home',lang,width:w,height:h,overlay:info.bg,
      links:info.menuLinks,socialCount:info.socialCount,socialHeading:info.socialHeading,
      headerVisible:info.headerVisible,horizontalOverflow:info.backgroundOverflow,footer:info.footer,
    });
    assert(info.menuLinks.every(l=>l.font>=29.5&&l.height>=58&&l.left>=0&&l.right<=w),`${w} ${lang}: menu typography/touch targets fit`);
    assert(Math.abs(info.header.left-old.left)<1&&Math.abs(info.header.width-old.width)<1,`${w} ${lang}: persistent glass header not shifted`);
    assert(!info.footerText.includes('2024-2026'),`${w} ${lang}: copyright intentionally removed`);
    assert.deepEqual(errors,[],`${w} ${lang}: no JS errors`);
    assert.equal(getSafeMediaReport(p).urls.length,0);
    await p.keyboard.press('Escape');
    await p.waitForFunction(()=>!document.body.classList.contains('mobile-nav-open'));
    assert.equal(await toggle.getAttribute('aria-expanded'),'false',`${w} ${lang}: = and X state restored`);
    console.log('PASS menu',w,h,lang,'links=4, preserved header, no overlap/overflow, Escape');
    await p.close();
    menuDone++;
  }
  // Language switch has its own fresh browser session: the Hero's WebGL
  // scenes are intentionally expensive and unrelated to drawer typography.
  await browser.close();
  browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
  for(const lang of (smoke?['zh']:['zh','en'])){
    const p=await createSafePage(browser,{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    try{
      await p.addInitScript(l=>localStorage.setItem('ailuren-lang',l),lang);
      await p.goto(new URL('index.html',base).href,{waitUntil:'domcontentloaded'});
      const toggle=p.locator('header .nav-toggle');
      await toggle.tap();await p.waitForFunction(()=>document.body.classList.contains('mobile-nav-open'));
      await p.locator('header #nav-lang [data-switch-lang="'+(lang==='zh'?'en':'zh')+'"]').tap();
      assert.equal(await p.locator('#mobile-primary-nav a').first().innerText(),lang==='zh'?'Featured':'精选作品',
        'Existing header language switch must localize menu labels while the drawer stays open');
      assert((await p.locator('#mobile-nav-drawer .mobile-nav-drawer-foot').innerText()).includes(lang==='zh'?'Social':'社交平台'));
      assert.equal(await toggle.getAttribute('aria-expanded'),'true','Language switch does not close the menu');
      await toggle.tap();await p.waitForFunction(()=>!document.body.classList.contains('mobile-nav-open'));
      console.log('PASS live language switch in open menu',lang);
    }finally{await p.close()}
  }
  console.log('FEATURED_HOVER_MOBILE_MENU_PASS');
}finally{await browser.close()}
