import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createSafePage} from '../../lib/safe-media.mjs';
const browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
const base=process.env.PORTFOLIO_URL||'http://127.0.0.1:5174/';
const results=[];
const get=async(loc)=>loc.evaluate(node=>{
  const label=node.querySelector('.portfolio-link-label');
  const s=label?getComputedStyle(label):null;
  const host=getComputedStyle(node);
  return {text:node.textContent.trim(),offset:s?.textUnderlineOffset,thickness:s?.textDecorationThickness,
   line:s?.textDecorationLine,decorationColor:s?.textDecorationColor,
   hostColor:host.color,hostBackground:host.backgroundColor,hostBorder:host.borderBottomWidth,
   font:host.fontSize,hasLabel:!!label,hasOldLine:getComputedStyle(node,'::after').display};
});
const check=(cond,message)=>{assert(cond,message);console.log('PASS',message)};
try{
 for(const width of [1440,820,390]){
  for(const lang of ['zh','en']){
   const p=await createSafePage(browser,{viewport:{width,height:900}});
   const errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.addInitScript(l=>localStorage.setItem('ailuren-lang',l),lang);
   await p.goto(base+'index.html#experiments',{waitUntil:'domcontentloaded'});
   await p.locator('.flip-experiment__detail').first().waitFor();
   await p.locator('.impact-reach-action--primary').first().waitFor();
   const lab=p.locator('.flip-experiment__detail').first();
   const profile=p.locator('.impact-reach-action--primary').first();
   const visit=p.locator('.impact-reach-action--external').first();
   await lab.scrollIntoViewIfNeeded();
   const links=[['lab',lab],['profile',profile],['visit',visit]];
   if(width>760)links.push(['nav',p.locator('#primary-nav .site-primary-nav a.is-active').first()]);
   for(const [key,loc] of links){
    await loc.scrollIntoViewIfNeeded();
    const before=await get(loc);
    check(before.hasLabel,width+'/'+lang+'/'+key+' dedicated text label');
    check(before.offset==='5px',width+'/'+lang+'/'+key+' shared underline offset: '+before.offset);
    check(before.thickness==='1px',width+'/'+lang+'/'+key+' shared underline thickness');
    check(before.line==='underline',width+'/'+lang+'/'+key+' underline geometry reserved');
    if(width>760 || key!=='nav'){
     await loc.hover();
     await p.waitForTimeout(280);
     const hovered=await get(loc);
     check(hovered.decorationColor!=='rgba(0, 0, 0, 0)' && hovered.decorationColor!=='transparent',
       width+'/'+lang+'/'+key+' hover underline visible: '+hovered.decorationColor);
     if(key==='lab'||key==='profile')check(hovered.hostColor!=='rgb(41, 151, 255)',width+'/'+lang+'/'+key+' does not flash blue');
    }
   }
   if(width>760){
     const nav=p.locator('#primary-nav .site-primary-nav a.is-active').first();
     const state=await get(nav);
     check(state.decorationColor!=='rgba(0, 0, 0, 0)',width+'/'+lang+' nav active underlined');
     check(state.hasOldLine==='none',width+'/'+lang+' old nav pseudo underline retired');
   }
   // Featured library entry must use the same typography-owned 1px / 5px
   // underline, not the retired container-bottom ::after hairline.
   const browse=p.locator('#projects .archive-more a').first();
   await browse.scrollIntoViewIfNeeded();
   const featuredBefore=await get(browse);
   check(featuredBefore.hasLabel,width+'/'+lang+' Featured link has shared text-label element');
   check(featuredBefore.offset==='5px'&&featuredBefore.thickness==='1px'&&featuredBefore.line==='underline',
     width+'/'+lang+' Featured underline matches nav, social and Lab');
   check(featuredBefore.hasOldLine==='none',
     width+'/'+lang+' Featured old padded pseudo underline is absent');
   await browse.hover();
   await p.waitForTimeout(280);
   const featuredHover=await get(browse);
   check(featuredHover.decorationColor!=='rgba(0, 0, 0, 0)' &&
     featuredHover.decorationColor!=='transparent',
     width+'/'+lang+' Featured hover underline follows same color token');
   await lab.click();
   await p.locator('.lab-project-lightbox').waitFor({state:'visible'});
   const source=p.locator('.lab-project-source');
   await source.hover();
   await p.waitForTimeout(260);
   const src=await get(source);
   check(src.offset==='5px'&&src.thickness==='1px',width+'/'+lang+' GitHub source uses unified line');
   check(src.hostBorder==='0px',width+'/'+lang+' no bottom-border source underline');
   await p.keyboard.press('Escape');
   await p.locator('.lab-project-lightbox').waitFor({state:'detached'});
   check(!errors.length,width+'/'+lang+' no JS errors: '+errors.join('; '));
   await p.close();
   results.push({width,lang,okay:true});
  }
 }
 for(const width of [1440,820,390]){
  for(const lang of ['zh','en']){
   const p=await createSafePage(browser,{viewport:{width,height:900}});
   const errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.addInitScript(l=>localStorage.setItem('ailuren-lang',l),lang);
   await p.goto(base+'works.html',{waitUntil:'domcontentloaded'});
   if(width>760){
     const active=p.locator('.library-page-navigation .site-primary-nav a.is-active');
     await active.waitFor({state:'visible'});
     const state=await get(active);
     check(state.hasLabel && state.offset==='5px'&&state.thickness==='1px'&&state.hasOldLine==='none',
       width+'/'+lang+' works nav uses shared style');
     await active.hover();
     await p.waitForTimeout(270);
     const hovered=await get(active);
     check(hovered.decorationColor!=='rgba(0, 0, 0, 0)',width+'/'+lang+' works active underline visible');
   }
   if(width===390){
     const menuButton=p.locator('.library-page-navigation .cinema-player__close');
     await menuButton.click();
     const selected=p.locator('#library-menu .mobile-menu__links .nav-list a.is-active > span').first();
     await selected.waitFor({state:'visible'});
     const mobile=await selected.evaluate(el=>({
       offset:getComputedStyle(el).textUnderlineOffset,
       thickness:getComputedStyle(el).textDecorationThickness,
       line:getComputedStyle(el).textDecorationLine
     }));
     check(mobile.offset==='5px'&&mobile.thickness==='1px'&&mobile.line==='underline',
       width+'/'+lang+' mobile menu uses same underline system');
     await p.keyboard.press('Escape');
     await p.locator('#library-menu').waitFor({state:'detached'});
   }
   check(!errors.length,width+'/'+lang+' works JS errors');
   await p.close();
  }
 }
 console.log('ALL_DONE',JSON.stringify(results));
}finally{await browser.close()}