import { createSafePage, createSafeContext } from './lib/safe-media.mjs';
/* Final two-page portfolio release sanity check.
 * Detailed media, modal and card behaviors retain their focused suites.
 */
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';

const binary=['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
assert(binary,'Chrome or Edge required for final QA');
const port=5272;
const base=process.env.PORTFOLIO_URL||'http://127.0.0.1:'+port+'/';
const widths=[320,360,375,390,430,720,721,760,761,768,820,900,1023,1024,1280,1440,1920];
const langs=['zh','en'];
const expectedNav={
 zh:['精选作品','全部作品','专业实力','联系'],
 en:['Featured','All Work','Expertise','Contact'],
};
let server;
async function ready(){
 for(let i=0;i<90;i++){
  try{if((await fetch(base,{signal:AbortSignal.timeout(900)})).ok)return;}catch{}
  await new Promise(resolve=>setTimeout(resolve,140));
 }
 throw Error('Site not available for responsive QA');
}
try{
 if(!process.env.PORTFOLIO_URL){
  server=spawn(process.execPath,['./node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'});
  await ready();
 }
 const browser=await chromium.launch({headless:true,executablePath:binary});
 try{
  for(const lang of langs)for(const width of widths){
   const page=await createSafePage(browser, {viewport:{width,height:900}});
   try{
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(value=>localStorage.setItem('ailuren-lang',value),lang);
    for(const kind of ['home','works']){
     const url=new URL(kind==='home'?'index.html#projects':'works.html',base);
     await page.goto(url.href,{waitUntil:'domcontentloaded'});
     const card=page.locator(kind==='home'?'#projects .comet-archive__card':'.library-grid .comet-archive__card').first();
     await card.waitFor();
     const evidence=await page.evaluate(kind=>{
      const visible=node=>{
       const s=getComputedStyle(node),r=node.getBoundingClientRect();
       // Off-screen reveal animations intentionally set visibility:hidden until scroll.
       // Geometry exists and dedicated scroll checks verify entrance visibility.
       return s.display!=='none'&&r.width>0&&r.height>0;
      };
      const outOfBounds=[...document.querySelectorAll('main h1,main h2,main h3,main a,main button,.library-grid a,.library-grid button,.closing-contact a')]
       .filter(node=>{
        if(!visible(node))return false;
        // Carousel items outside the clipped horizontal rail are intentional.
        if(node.closest('.impact-award-rail,.comet-archive,.logo-loop'))return false;
        const r=node.getBoundingClientRect();
        return r.left<-2||r.right>innerWidth+2;
       }).slice(0,8).map(node=>node.textContent.trim().slice(0,38));
      const brokenMedia=[...document.querySelectorAll('img')].filter(img=>visible(img)&&img.complete&&!img.naturalWidth)
       .slice(0,8).map(img=>img.currentSrc||img.src);
      const titles=kind==='home'
       ? ['#projects .section-title','#recognition .section-title','#impact-awards .impact-evidence-label h2','#impact-programs .impact-evidence-label h2','#impact-reach .impact-evidence-label h2','#experiments .section-title']
       : ['.library-intro .page-title'];
      const missingTitles=titles.filter(sel=>!document.querySelector(sel)||!visible(document.querySelector(sel)));
      const firstCard=kind==='home'?document.querySelector('#projects .comet-archive__card'):document.querySelector('.library-grid .comet-archive__card');
      const cover=firstCard?.querySelector('.comet-archive__image')?.getBoundingClientRect();
      const nav=kind==='home'?document.querySelector('body > header'):document.querySelector('.library-page-navigation .cinema-player__navigation');
      const menu=kind==='home'?document.querySelector('body > header .nav-toggle'):document.querySelector('.library-page-navigation .cinema-player__close');
      const navLinks=[...(kind==='home'?document.querySelectorAll('#primary-nav .site-primary-nav >li>a'):document.querySelectorAll('.library-page-navigation .site-primary-nav >li>a'))].map(a=>a.textContent.trim());
      return {
       overflow:document.documentElement.scrollWidth-innerWidth,badElements:outOfBounds,
       badImages:brokenMedia,missingTitles,lang:document.documentElement.lang,
       coverRatio:cover?.width/cover?.height,
       cardCount:document.querySelectorAll(kind==='home'?'#projects .comet-archive__card':'.library-grid .comet-archive__card').length,
       navWidth:nav?.getBoundingClientRect().width,menuWidth:menu?.getBoundingClientRect().width,navLinks,
      };
     },kind);
     const tag=width+'px '+lang+' '+kind;
     assert(evidence.overflow<=2,tag+': horizontal overflow '+evidence.overflow);
     assert.deepEqual(evidence.badElements,[],tag+': controls or headings out of bounds');
     assert.deepEqual(evidence.badImages,[],tag+': broken visible image');
     assert.deepEqual(evidence.missingTitles,[],tag+': invisible/missing heading');
     assert(evidence.lang.toLowerCase().startsWith(lang.toLowerCase()),tag+': document language mismatch '+evidence.lang);
     assert(Math.abs(evidence.coverRatio-.75)<=.012,tag+': cover proportion changed');
     // Mobile Featured uses four mounted cards per page; the underlying eight
     // project records and pagination are checked by the work-card suite.
     assert.equal(evidence.cardCount,kind==='home'?(width<=720?4:8):15,tag+': expected visible portfolio cards changed');
     assert(evidence.navWidth>100,tag+': shared navigation missing');
     if(width<=760)assert(evidence.menuWidth>=44,tag+': menu touch target too small');
     if(width>=761)assert.deepEqual(evidence.navLinks,expectedNav[lang],tag+': tablet/desktop nav changed');
     assert.deepEqual(errors,[],tag+': runtime error');
    }
    if([320,390,768,1440].includes(width)){
     await page.goto(new URL('index.html#contact',base).href);
     const dock=page.locator('#footer-dock-react-root a, #footer-dock-react-root button');
     await dock.first().waitFor({state:'attached'});
     // A direct hash load can reach Contact before its reveal observer fires.
     // Reenter the dock explicitly, then verify users can actually see it.
     await page.evaluate(()=>document.querySelector('#footer-dock-react-root a')?.scrollIntoView({block:'center',behavior:'instant'}));
     await dock.first().waitFor({state:'visible',timeout:6000});
     assert.equal(await dock.count(),6,width+'px '+lang+': social controls missing');
     const geometry=await dock.evaluateAll(nodes=>nodes.map(e=>{
      const r=e.getBoundingClientRect();
      return {left:r.left,right:r.right,w:r.width,h:r.height,display:getComputedStyle(e).display};
     }));
     assert(geometry.every(g=>g.left>=0&&g.right<=width+1&&g.w>=44&&g.h>=44&&g.display!=='none'),
      width+'px '+lang+': social controls must fit and be touch accessible');
    }
    console.log('PASS '+width+'px '+lang+': 2 pages, headings, media, navigation and viewport');
   }finally{await page.close();}
  }
 }finally{await browser.close();}
 console.log('PASS Step 06: 17 widths x 2 languages x 2 pages plus social control checks');
}finally{
 if(server){server.kill('SIGTERM');await new Promise(resolve=>setTimeout(resolve,120));}
}
