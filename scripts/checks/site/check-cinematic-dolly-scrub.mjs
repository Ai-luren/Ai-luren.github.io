import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createSafePage } from '../../lib/safe-media.mjs';

// Test scroll-driven Dolly Through using measured card layouts, not just the
// existence of GSAP tweens or one-shot completion flags.
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5174/';
const browser=await chromium.launch({
  executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  headless:true,
});
const after=(ms=85)=>new Promise(resolve=>setTimeout(resolve,ms));

async function setup(filename,width,lang,reduce=false) {
 const page=await createSafePage(browser,{
   viewport:{width,height:900}, reducedMotion:reduce?'reduce':'no-preference',
 });
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(l=>localStorage.setItem('ailuren-lang',l),lang);
 await page.goto(new URL(filename,base).href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__cinematicReveal?.page===(
   location.pathname.endsWith('works.html')?'works':'home')&&window.__cinematicReveal?.size>0,
   null,{timeout:9000});
 return{page,errors};
}

async function position(page,sel,index,p) {
 const geometry=await page.locator(sel).nth(index).evaluate(el=>{
   const grid=el.closest('.comet-archive,.library-grid');
   if(!grid)throw Error('Missing stable grid ancestor');
   return {
     top:grid.getBoundingClientRect().top+scrollY+el.offsetTop-grid.offsetTop,
     height:el.offsetHeight,
   };
 });
 return page.evaluate(({geometry,p})=>{
   const y=geometry.top-innerHeight*.94+p*(geometry.height+innerHeight*(.94-.12));
   scrollTo({top:Math.max(0,y),behavior:'instant'});
   return Math.max(0,y);
 },{geometry,p});
}
async function sample(page,sel,index=0){
 return page.locator(sel).nth(index).evaluate(el=>{
   const s=getComputedStyle(el),m=new DOMMatrix(s.transform);
   return {
     opacity:Number(s.opacity),
     transform:s.transform,
     y:m.m42,scale:m.m11,x:m.m41,
     rotated:m.m12, is2D:m.is2D,
     p:Number(el.dataset.cinematicProgress),
     state:el.dataset.cinematicState,
   };
 });
}

try{
 for(const filename of ['index.html']){
  const isHome=filename==='index.html';
  for(const width of [390,1440])for(const lang of ['zh','en']){
   const {page,errors}=await setup(filename,width,lang);
   try{
    const selector=isHome?'#projects .comet-card':'.library-grid .comet-card';
    await page.locator(selector).first().waitFor({state:'attached'});
    const metadata=await page.evaluate(()=>({
      source:window.__cinematicReveal.source,
      activeGrids:window.__cinematicReveal.activeGrids,
      reversible:window.__cinematicReveal.reversible,
      mode:window.__cinematicReveal.mode,
    }));
    assert.equal(metadata.mode,'scrub');
    assert.equal(metadata.reversible,true);
    assert(metadata.activeGrids>=1,'GSAP ScrollTrigger must be active');
    // Home: 2x4 mobile / 4x2 desktop. Works can start mid-card at page top,
    // so use a card on the next row to observe the whole approach curve.
    const count=await page.locator(selector).count();
    const index=isHome?Math.min(4,count-1):Math.min(width<=720?4:6,count-1);
    const samples=[];
    for(const progress of [0,.1,.2,.4,.62,.85,1,.85,.4,.2,0]){
      await position(page,selector,index,progress);
      await page.waitForTimeout(100);
      samples.push({target:progress,...await sample(page,selector,index)});
    }
    const [start,early,mid,hold,hold2,exit,far,reverseExit,reverseHold,reverseEnter,reverseStart]=samples;
    const [expectedY,expectedScale]=isHome
      ? width<=720?[84,.936]:[138,.885]
      : width<=720?[70,.945]:[92,.92];
    assert(Math.abs(start.y-expectedY)<=3,
      filename+'/'+width+'/'+lang+' must visibly fly in '+JSON.stringify(start));
    assert(Math.abs(start.scale-expectedScale)<.005,
      filename+'/'+width+'/'+lang+' approach depth '+JSON.stringify(start));
    assert(early.y<start.y-(width<=720?10:16) && early.scale>start.scale,
      filename+'/'+width+'/'+lang+' camera must approach continuously');
    assert(Math.abs(hold.y)<.2&&Math.abs(hold.scale-1)<.002,
      'Reading stage must be full-size, stable and sharp');
    assert(Math.abs(hold2.y)<.2&&Math.abs(hold2.scale-1)<.002,
      'Reading stage must be held over scroll distance');
    // A short Works category may end before its last row fully exits.
    // We intentionally do not add artificial blank space just to animate it.
    if (exit.p>.78) {
      assert(exit.y<-3&&exit.scale>1,
        filename+'/'+width+'/'+lang+' outbound stage while scrollable');
    }
    if(far.p>.80){
      assert(far.y<exit.y&&far.scale>exit.scale,
        filename+'/'+width+'/'+lang+' exit increases with scroll distance');
    }
    assert(Math.abs(reverseExit.y-exit.y)<2 && Math.abs(reverseExit.scale-exit.scale)<.004,
      'Reverse scrolling must return exactly through exit position');
    assert(Math.abs(reverseStart.y-start.y)<3 && Math.abs(reverseStart.scale-start.scale)<.006,
      'Reverse scrolling must return exactly through entrance position');
    assert(samples.every(s=>s.opacity===1 && Math.abs(s.x)<.5 && Math.abs(s.rotated)<.001 && s.is2D),
      'No opacity flicker, horizontal drift, rotation, or 3D projection');
    if (!isHome) {
      // Even in a short category, the first row must actually retreat when
      // the visitor reaches the last scrollable part of the library.
      await page.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
      await page.waitForTimeout(110);
      const firstRowExit=await sample(page,selector,0);
      assert(firstRowExit.y < -3 && firstRowExit.scale > 1,
        filename+'/'+width+'/'+lang+' first row must have a real departure: '+JSON.stringify(firstRowExit));
    }
    assert.deepEqual(errors,[],filename+'/'+width+'/'+lang+' JS errors');
    console.log('PASS scrub + reverse '+filename+' '+width+' '+lang,
      'entrance:'+Math.round(start.y)+'px',
      'exit:'+Math.round(far.y)+'px',
      'grids:'+metadata.activeGrids);
   }finally{await page.close();}
  }
 }

 for(const filename of ['index.html']){
   const {page,errors}=await setup(filename,390,'zh',true);
   try{
     const selector=filename==='index.html'?'#projects .comet-card':'.library-grid .comet-card';
     await page.locator(selector).first().waitFor({state:'attached'});
     await page.locator(selector).first().scrollIntoViewIfNeeded();
     await page.waitForTimeout(110);
     const s=await sample(page,selector);
     assert.equal(s.opacity,1);
     assert.equal(s.transform,'none');
     assert.equal(await page.evaluate(()=>window.__cinematicReveal.activeGrids),0);
     assert.deepEqual(errors,[]);
     console.log('PASS reduced motion '+filename);
   }finally{await page.close();}
 }
 // The archive is a reading/catalogue surface, not another scroll theatre.
 // No transform can run on Works even during refresh, category changes or
 // browser-native scroll restoration; never reintroduce a Works dolly mount.
 for (const width of [390,1440]) for (const lang of ['zh','en']) {
   const page=await createSafePage(browser,{viewport:{width,height:900}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   try {
     await page.addInitScript(l=>localStorage.setItem('ailuren-lang',l),lang);
     await page.goto(new URL('works.html',base).href,{waitUntil:'domcontentloaded'});
     for (let reload=0;reload<2;reload++) {
       if (reload) await page.reload({waitUntil:'domcontentloaded'});
       await page.locator('.library-grid .comet-card').first().waitFor();
       await page.waitForTimeout(130);
       assert.equal(await page.evaluate(()=>Boolean(window.__cinematicReveal)),false,
         'The Works page must not mount cinematic scroll transforms');
       for(const category of ['commercial','short-film','social','visual']) {
         await page.locator('.library-filters button[data-category="'+category+'"]').click();
         await page.waitForTimeout(75);
         const state=await page.locator('.library-grid .comet-card').first().evaluate(node=>({
           transform:getComputedStyle(node).transform,
           motion:node.dataset.cinematicMode,
           opacity:Number(getComputedStyle(node).opacity),
         }));
         assert.equal(state.transform,'none', 'Works card must remain static '+JSON.stringify(state));
         assert.equal(state.motion,undefined);
         assert.equal(state.opacity,1);
       }
     }
     assert.deepEqual(errors,[], 'Works refresh errors '+width+'/'+lang);
     console.log('PASS static Works refresh + filters '+width+' '+lang);
   } finally {await page.close();}
 }

 // Section-level typography follows the same scroll direction as cards,
 // with a gentler entrance/exit; internal closing-card text is never targeted.
 for (const width of [390,1440]) {
   const {page,errors}=await setup('index.html',width,'zh');
   try {
     assert.equal(await page.locator('#hero-title').getAttribute('data-editorial-title'),null);
     assert.equal(await page.locator('#profile-title').getAttribute('data-editorial-title'),null);
     assert.equal(await page.locator('#contact-title').getAttribute('data-editorial-title'),null);
     const place=async (selector,y)=>{
       for(let tries=0;tries<3;tries++){
         await page.evaluate(({selector,y})=>{
           const node=document.querySelector(selector);
           const current=node.getBoundingClientRect().top;
           scrollTo({top:Math.max(0,scrollY+current-y),behavior:'instant'});
         },{selector,y});
         await page.waitForTimeout(55);
       }
       return page.locator(selector).evaluate(el=>({
         state:el.dataset.editorialTitle,opacity:Number(getComputedStyle(el).opacity),
         progress:Number(el.dataset.editorialProgress),transform:getComputedStyle(el).transform,
       }));
     };
     for(const selector of ['#projects .section-intro','#recognition .section-intro',
       '#impact-awards .impact-evidence-label','#experiments .section-intro']){
       const enter=await place(selector,765);
       const read=await place(selector,450);
       const exit=await place(selector,95);
       const back=await place(selector,765);
       const readAgain=await place(selector,450);
       assert.equal(enter.state,'entering');
       assert.equal(read.state,'reading');
       assert.equal(exit.state,'reading');
       assert(enter.opacity<read.opacity-.05,
         'Headings reveal below but never fade out at the TOP boundary');
       assert.equal(exit.opacity,1,'Reverse scroll must preserve heading legibility');
       assert(Math.abs(back.opacity-enter.opacity)<.06 && Math.abs(readAgain.opacity-read.opacity)<.015,
         'Lower-edge entrance must remain reversible with scroll');
       assert.equal(read.transform,'none','Reading headlines remain sharp');
     }
     assert.deepEqual(errors,[]);
     console.log('PASS reversible section/subsection titles '+width);
   } finally {await page.close();}
 }

 // Direct hash navigation, browser scroll restoration and reduced motion must
 // never replay a hidden headline during the initial document paint.
 for(const [width,hash,selector] of [
   [390,'#projects','#projects .section-intro'],
   [1440,'#recognition','#recognition .section-intro'],
   [390,'#impact-reach','#impact-reach .impact-evidence-label'],
 ]) {
   const page=await createSafePage(browser,{viewport:{width,height:900}});
   try {
     await page.goto(new URL('index.html'+hash,base).href,{waitUntil:'domcontentloaded'});
     await page.locator(selector).waitFor();
     await page.waitForTimeout(210);
     const state=await page.locator(selector).evaluate(el=>({opacity:getComputedStyle(el).opacity,
       transform:getComputedStyle(el).transform}));
     assert.deepEqual(state,{opacity:'1',transform:'none'},'Deep-link target must be stable');
   } finally {await page.close();}
 }
 // Regression for the specific real-world complaint: holding an arrow key
 // produces repeated keydown events. Headings must NOT dim near the top,
 // and the dolly must pass the camera rather than shrink on departure.
 for (const width of [390,1440]) {
   const {page,errors}=await setup('index.html',width,'zh');
   try {
     await page.locator('#projects .comet-card').first().waitFor();
     await page.evaluate(() => scrollTo({
       top:Math.max(0,document.querySelector('#projects').offsetTop-800),
       behavior:'instant',
     }));
     await page.waitForTimeout(90);
     const directionData=[];
     for (const key of ['ArrowDown','ArrowUp']) {
       const start=await page.evaluate(()=>scrollY);
       const samples=[];
       for(let i=0;i<55;i++){
         await page.keyboard.down(key);
         await page.waitForTimeout(18);
         if(i%3!==0)continue;
         samples.push(await page.evaluate(()=>{
           const title=document.querySelector('#projects .section-intro');
           const card=document.querySelector('#projects .comet-card');
           return {
             titleTop:title.getBoundingClientRect().top,
             titleOpacity:Number(getComputedStyle(title).opacity),
             cardScale:new DOMMatrix(getComputedStyle(card).transform).m11,
           };
         }));
       }
       await page.keyboard.up(key);
       await page.waitForTimeout(100);
       const end=await page.evaluate(()=>scrollY);
       assert(key==='ArrowDown'?end>start+350:end<start-350,
         width+' held '+key+' must advance the real scroll position');
       assert(samples.every(x=>x.titleTop>110||x.titleOpacity>=.999),
         width+' held '+key+' must never dim a title at viewport top');
       directionData.push({key,start,end,samples});
     }
     const scales=directionData.flatMap(x=>x.samples.map(s=>s.cardScale));
     assert(scales.some(x=>x>1.005),width+' exit should advance past camera');
     assert.deepEqual(errors,[]);
     console.log('PASS held keyboard down/up, top headline opacity and dolly depth '+width);
   } finally {await page.close();}
 }
 console.log('CINEMATIC_DOLLY_SCRUB_PASS');
}finally{await browser.close();}
