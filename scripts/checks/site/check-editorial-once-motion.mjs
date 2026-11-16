import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createSafePage } from '../../lib/safe-media.mjs';

// Test the CURRENT once-only editorial entry and reverse-scroll stability.
// Geometry sampling, not old scale/dolly animation snapshots, is the contract.
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
 // Apple iPhone Duo editorial rule: a card enters ONCE with vertical Y only;
 // the artwork must remain scale 1, and reverse scrolling never replays it.
 for(const width of [390,1440]) for(const lang of ['zh','en']) {
   const {page,errors}=await setup('index.html',width,lang);
   try {
     const metadata=await page.evaluate(()=>({
       mode:window.__cinematicReveal.mode,
       reversible:window.__cinematicReveal.reversible,
       grids:window.__cinematicReveal.activeGrids,
     }));
     assert.equal(metadata.mode,'entrance-once');
     assert.equal(metadata.reversible,false);
     assert(metadata.grids>0,'the first entrance must still be discoverable');
     const index=4;
     const samples=[];
     for(const progress of [0,.1,.35,.65,.9,1,.4,.1,0]) {
       await position(page,'#projects .comet-card',index,progress);
       await page.waitForTimeout(90);
       samples.push(await sample(page,'#projects .comet-card',index));
     }
     const enterY=width<=760?22:30;
     assert(Math.abs(samples[0].y-enterY)<2,
       width+'/'+lang+' first entrance should be a small vertical rise');
     assert(samples[1].y>0 && samples[1].y<enterY,
       'initial entry should ease smoothly toward its final position');
     assert(samples.every(s=>Math.abs(s.scale-1)<.0002 && s.opacity===1 &&
       Math.abs(s.x)<.2 && Math.abs(s.rotated)<.0002 && s.is2D),
       'Artwork must NEVER shrink, grow, turn, drift, or fade');
     assert(samples.slice(2).every(s=>s.state==='reading'&&s.transform==='none'),
       'After first reveal, cards must remain static on exit AND reverse scroll');
     // The information panels use the same no-scale, no-exit contract.
     for(const selector of ['#recognition .impact-glass',
       '#experiments .flip-experiment','#profile .closing-card']){
       await page.locator(selector).first().scrollIntoViewIfNeeded();
       await page.waitForTimeout(80);
       const panel=await sample(page,selector);
       assert.equal(panel.scale,1,'Informational panels must not zoom: '+selector);
       await page.evaluate(()=>scrollBy({top:-400,behavior:'instant'}));
       await page.waitForTimeout(70);
       const reversed=await sample(page,selector);
       assert.equal(reversed.scale,1,'Reverse panel movement cannot zoom: '+selector);
     }
     assert.deepEqual(errors,[]);
     console.log('PASS one-time unscaled cards/panels '+width+' '+lang);
   }finally{await page.close()}
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
       // Initial viewport / browser restore may have revealed this title
       // before our synthetic test scroll. That must be stable, not replayed.
       if(enter.state==='entering') {
         assert(enter.opacity<read.opacity-.05,
           'Unseen headings should fade gently on first appearance');
       } else {
         assert.equal(enter.state,'stable');
         assert.equal(enter.opacity,1,'Already seen titles must never replay');
       }
       assert(['reading','stable'].includes(read.state), 'Heading must settle to its final pose');
       assert.equal(exit.state,'stable');
       assert.equal(exit.opacity,1,'Titles stay fully readable at the top');
       assert.equal(back.opacity,1,'Upward scrolling must NEVER replay the fade');
       assert.equal(back.transform,'none','Upward scrolling must not slide the heading');
       assert.equal(readAgain.opacity,1,'Re-entering an already seen chapter stays stable');
       assert.equal(read.transform,'none','Reading headlines remain sharp');
     }
     assert.deepEqual(errors,[]);
     console.log('PASS one-time section/subsection titles '+width);
   } finally {await page.close();}
 }

 // iPhone Duo comparison: confirm a genuinely unseen title enters gently,
 // reaches its final pose, then NEVER animates when reversed below the fold.
 for(const width of [390,1440]) {
   const {page,errors}=await setup('index.html',width,'zh');
   try {
     const selector='#impact-awards .impact-evidence-label';
     const place=async y=>{
       await page.evaluate(({selector,y})=>{
         const node=document.querySelector(selector);
         const top=node.getBoundingClientRect().top;
         scrollTo({top:Math.max(0,scrollY+top-y),behavior:'instant'});
       },{selector,y});
       await page.waitForTimeout(120);
       return page.locator(selector).evaluate(el=>({
         state:el.dataset.editorialTitle,
         opacity:Number(getComputedStyle(el).opacity),
         transform:getComputedStyle(el).transform,
       }));
     };
     const entering=await place(765);
     const settled=await place(450);
     const reverse=await place(765);
     assert.equal(entering.state,'entering','Unseen title needs its first entry');
     assert(entering.opacity<.96 && entering.transform!=='none');
     assert(settled.opacity===1 && settled.transform==='none');
     assert(reverse.opacity===1 && reverse.transform==='none' && reverse.state==='stable',
       'Previously seen titles cannot replay on ArrowUp/scroll reversal');
     assert.deepEqual(errors,[]);
     console.log('PASS real unseen headline enters once then stays on reverse '+width);
   } finally { await page.close(); }
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
 // Regression for holding ArrowUp/ArrowDown: no title fades on return,
 // and ALL card scaling must remain exactly 1 while keys are held.
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
     assert(scales.every(x=>Math.abs(x-1)<.0003),width+' no scaling during held keys');
     assert.deepEqual(errors,[]);
     console.log('PASS held keyboard down/up, headline stays and cards never scale '+width);
   } finally {await page.close();}
 }
 console.log('EDITORIAL_ONCE_MOTION_PASS');
}finally{await browser.close();}
