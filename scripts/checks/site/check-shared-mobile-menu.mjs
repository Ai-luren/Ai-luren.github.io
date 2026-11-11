/** Cross-page menu design and behavior; online video CDN is always blocked. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createSafePage, getSafeMediaReport } from '../../lib/safe-media.mjs';
import { MOBILE_MENU_SOCIAL_PROFILES } from '../../../src/navigation/socialProfiles.js';

const BASE=process.env.PORTFOLIO_URL||'http://127.0.0.1:5174/';
const executablePath='/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
let browser=await chromium.launch({executablePath,headless:true});
const approx=(a,b,msg)=>assert(Math.abs(a-b)<=1.5,`${msg}: ${a} vs ${b}`);
async function load(kind,width,height,lang){
  const page=await createSafePage(browser,{viewport:{width,height},isMobile:true,hasTouch:true});
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.addInitScript(x=>localStorage.setItem('ailuren-lang',x),lang);
  await page.goto(new URL(kind==='home'?'index.html':'works.html',BASE).href,{waitUntil:'domcontentloaded'});
  await page.locator(kind==='home'?'header .nav-toggle':'.library-page-navigation .cinema-player__close').tap();
  const container=kind==='home'?'#mobile-nav-drawer':'#library-menu';
  await page.waitForSelector(kind==='home'?container+'.is-open':container+'[open]');
  await page.locator(container+' .mobile-menu__social-list a').first().waitFor();
  await page.waitForTimeout(240);
  const data=await page.evaluate(({kind,container})=>{
    const root=document.querySelector(container), head=document.querySelector(kind==='home'?'body > header':'#library-menu .cinema-player__navigation');
    const nav=root.querySelector('.mobile-menu__links'),foot=root.querySelector('.mobile-menu__footer'),social=root.querySelector('.mobile-menu__social');
    const box=e=>{const r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height}};
    return {header:box(head),nav:box(nav),footer:box(foot),overlay:kind==='home'?getComputedStyle(root).backgroundColor:getComputedStyle(root,'::backdrop').backgroundColor,
      headerBackground:getComputedStyle(head).backgroundColor,headerBlur:getComputedStyle(head).backdropFilter,
      menuItems:[...nav.querySelectorAll('.nav-list a')].map(a=>({text:a.innerText,href:a.getAttribute('href'),r:box(a),color:getComputedStyle(a).color,font:getComputedStyle(a).fontSize})),
      socialHeading:social.querySelector('.mobile-menu__social-label').innerText,
      socialLinks:[...social.querySelectorAll('a')].map(a=>({text:a.innerText,href:a.href,r:box(a),font:getComputedStyle(a).fontSize})),
      copyright:foot.querySelector('.mobile-menu__copyright').innerText,
      pageOverflow:document.documentElement.scrollWidth-innerWidth,
      footerInView:box(foot).bottom<=innerHeight-8,
      headerVisible:getComputedStyle(head).visibility==='visible',
      disabledSearch:root.querySelector('input[type=search]')===null};
  },{kind,container});
  assert.equal(data.menuItems.length,4,kind+': precisely four main links');
  assert.equal(data.socialLinks.length,4,kind+': precisely four social links');
  assert.deepEqual(data.socialLinks.map(l=>l.href),MOBILE_MENU_SOCIAL_PROFILES.map(l=>l.href),kind+': social links from canonical data');
  assert.deepEqual(data.menuItems.map(x=>x.text),lang==='en'?['Featured','All Work','Expertise','Contact']:['精选作品','全部作品','专业实力','联系']);
  assert.deepEqual(data.socialLinks.map(l=>l.text),MOBILE_MENU_SOCIAL_PROFILES.map(l=>l[lang]));
  assert.equal(data.socialHeading,lang==='en'?'Social':'社交平台');
  assert.equal(data.overlay,'rgba(12, 12, 13, 0.9)',kind+': dark modal material');
  assert.equal(data.headerBackground,'rgba(28, 28, 30, 0.72)',kind+': same menu header surface');
  assert(data.headerVisible&&data.disabledSearch&&data.pageOverflow<=2,kind+': no overflow/search and header visible');
  assert(data.menuItems.every((x,i,arr)=>x.r.left>=0&&x.r.right<=width&&(i===0||x.r.top>=arr[i-1].r.bottom)));
  assert(data.socialLinks.every(x=>x.r.left>=0&&x.r.right<=width&&x.r.height>=43.9),kind+': social hit areas visible');
  assert(data.footer.top>=data.menuItems.at(-1).r.bottom+8,kind+': bottom social block does not overlap menu');
  assert(data.footerInView,kind+': copyright is visible');
  return {page,data,errors:errs,kind,container};
}
try{
  let count=0;
  for(const {width,height} of [{width:320,height:568},{width:393,height:852},{width:760,height:844}])for(const lang of ['zh','en']){
    if(count&&count%2===0){await browser.close();browser=await chromium.launch({executablePath,headless:true});}
    const home=await load('home',width,height,lang);
    const works=await load('works',width,height,lang);
    for(const key of ['top','left','width','height'])approx(home.data.nav[key],works.data.nav[key],width+' '+lang+': nav '+key);
    for(const key of ['top','left','width','height'])approx(home.data.header[key],works.data.header[key],width+' '+lang+': header '+key);
    for(const key of ['top','left','width','height'])approx(home.data.footer[key],works.data.footer[key],width+' '+lang+': footer '+key);
    assert.equal(home.data.headerBlur,works.data.headerBlur);
    for(let i=0;i<4;i++){
      for(const key of ['top','left','width','height'])approx(home.data.menuItems[i].r[key],works.data.menuItems[i].r[key],width+' '+lang+': menu item '+i+' '+key);
      assert.equal(home.data.menuItems[i].font,works.data.menuItems[i].font);
      assert.equal(home.data.socialLinks[i].font,works.data.socialLinks[i].font);
      for(const key of ['top','left','height'])approx(home.data.socialLinks[i].r[key],works.data.socialLinks[i].r[key],width+' '+lang+': social '+i+' '+key);
    }
    // Distinct ACTIVE item is intentional: first on home, second on Works.
    assert.equal(home.data.menuItems[0].color,works.data.menuItems[1].color);
    assert.deepEqual(home.errors,[]);assert.deepEqual(works.errors,[]);
    assert.equal(getSafeMediaReport(home.page).urls.length,0);
    assert.equal(getSafeMediaReport(works.page).urls.length,0);
    await home.page.keyboard.press('Escape');await works.page.keyboard.press('Escape');
    await home.page.waitForFunction(()=>!document.body.classList.contains('mobile-nav-open'));
    await works.page.locator('#library-menu').waitFor({state:'detached'});
    await home.page.close();await works.page.close();
    console.log('PASS',width,height,lang,'home/works menu geometry and materials identical; 4+4 links, no media');
    count++;
  }
  await browser.close();browser=await chromium.launch({executablePath,headless:true});
  for(const kind of ['home','works'])for(const lang of ['zh','en']){
    const {page,container}=await load(kind,390,844,lang);
    const social=page.locator(container+' .mobile-menu__social-list a').filter({hasText:'GitHub'});
    await social.tap();
    await page.locator('.external-link-sheet').waitFor({state:'visible',timeout:3500});
    assert((await page.locator('.external-link-sheet__domain').innerText()).includes('github.com'),kind+': external destination correctly confirmed');
    if(kind==='works')await page.locator('#library-menu').waitFor({state:'detached'});
    await page.locator('.external-link-sheet__cancel').click();
    await page.locator('.external-link-sheet').waitFor({state:'detached'});
    assert.equal(getSafeMediaReport(page).urls.length,0);
    console.log('PASS',kind,lang,'GitHub touch opens existing external confirmation sheet');
    await page.close();
  }
  console.log('SHARED_MOBILE_MENU_PASS');
} finally{await browser.close()}
