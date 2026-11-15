import {chromium} from 'playwright-core';
import {createSafePage} from '../../lib/safe-media.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
const base='http://127.0.0.1:5174/index.html';

let cases=0;
try {
 for(const w of [320,390,744,900,1024,1280,1440,1920]){
  for(const lang of ['zh','en']){
   const p=await createSafePage(browser,{viewport:{width:w,height:w<760?844:900},deviceScaleFactor:1});
   const errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.addInitScript(l=>localStorage.setItem('ailuren-lang',l),lang);
   await p.goto(base+'#experiments',{waitUntil:'domcontentloaded'});
   await p.locator('#impact-reach .impact-reach-action--primary').first().waitFor();
   const lab=p.locator('.flip-experiment');await lab.scrollIntoViewIfNeeded();
   await p.waitForTimeout(470);
   const result=await p.evaluate(()=>{
    const R=e=>{let a=e.getBoundingClientRect();return{x:a.x,y:a.y,w:a.width,h:a.height,r:a.right,top:a.top,b:a.bottom}};
    const CSS=e=>{const s=getComputedStyle(e);return{bg:s.backgroundColor,border:s.borderTopWidth,br:s.borderTopRightRadius,paddingL:s.paddingLeft,paddingR:s.paddingRight,justify:s.justifyContent,align:s.textAlign}};
    const header=document.querySelector('.flip-experiment__header span:nth-child(3)');
    const actions=[...document.querySelectorAll('.flip-experiment__actions')];
    const btn=actions[0].querySelector('.flip-experiment__detail');
    const soc=[...document.querySelectorAll('#impact-reach .impact-reach-action--primary')];
    const ext=[...document.querySelectorAll('#impact-reach .impact-reach-action--external')];
    const footer=document.querySelector('#profile .closing-social');
    const contact=document.querySelector('#profile .closing-contact');
    const dock=document.querySelector('#footer-dock-react-root');
    const icons=[...document.querySelectorAll('#profile .floating-dock-item')];
    return{header:R(header),labBtn:R(btn),labCSS:CSS(btn),actions:actions.map(R),headerCSS:CSS(header),
      soc:soc.map(e=>({box:R(e),css:CSS(e)})),ext:ext.map(e=>({box:R(e),css:CSS(e)})),
      footer:R(footer),contact:R(contact),dock:R(dock),icons:icons.map(R),
      socialDockDisplay:getComputedStyle(footer).display,labActionsCount:actions.length,socCount:soc.length,
      overflow:document.documentElement.scrollWidth-innerWidth};
   });
   const tag=w+' '+lang;
   assert(result.labActionsCount===3&&result.socCount===4,tag+': missing actions');
   assert(result.labCSS.border==='0px'&&result.labCSS.bg==='rgba(0, 0, 0, 0)',tag+': lab old pill');
   assert.equal(result.labCSS.align,'left',tag+': lab action text alignment');
   assert(result.soc.every(x=>x.css.border==='0px'&&x.css.bg==='rgba(0, 0, 0, 0)'),tag+': social old pill');
   assert(result.soc.every(x=>x.css.align==='left'),tag+': social action text alignment');
   assert(result.soc.every(x=>x.box.h >= (w<=720?44:40)),tag+': social touch target size');
   assert(result.overflow<=2,tag+': horizontal overflow '+result.overflow);
   if(w>=1024){
     assert(Math.abs(result.contact.x-result.dock.x)<=1.5,tag+': dock misaligned '+result.contact.x+','+result.dock.x);
     assert(result.socialDockDisplay==='grid',tag+': footer not grid');
   }
   if(w>720)assert(result.header.r < result.labBtn.x,
     tag+': Lab description heading should end before the separate action column');
   if([390,1440].includes(w)){
     const link=lab.locator('.flip-experiment__detail').nth(2);
     assert.equal(await link.getAttribute('aria-haspopup'),'dialog',tag+': missing accessible dialog affordance');
     await link.click();
     const modal=p.locator('.lab-project-lightbox');await modal.waitFor({state:'visible'});
     assert.equal(await modal.locator('.lab-project-source').count(),1,tag+': comparison should have only source');
     assert.equal(await modal.locator('.lab-project-source').getAttribute('href'),'https://github.com/Ai-luren/Image-comparison');
     assert.equal(await modal.locator('.lab-project-source--primary').count(),0,tag+': online trial button returned');
     assert.equal((await modal.locator('.lab-project-source').innerText()).trim(),lang==='en'?'GitHub source':'GitHub 源码');
     await p.keyboard.press('Escape');
     await modal.waitFor({state:'detached'});
   }
   if(errors.length)throw new Error(tag+': '+errors.join('; '));
   console.log('PASS',tag,'headerRight',Math.round(result.header.r),'actionRight',Math.round(result.labBtn.r),
    'dockX',Math.round(result.dock.x),'contactX',Math.round(result.contact.x),'overflow',result.overflow);
   await p.close();cases++;
  }
 }
 console.log('PASS editorial actions and footer alignment: '+cases+' viewport/language combinations');
}finally{await browser.close()}