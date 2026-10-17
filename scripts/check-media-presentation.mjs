import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const base=process.env.PORTFOLIO_URL || 'http://127.0.0.1:5181/';
const out=process.env.MEDIA_SCREENSHOTS;
if(out)mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
const viewports=[[1280,800],[1440,900],[1920,1080],[360,740],[375,812],[393,852],[430,932]];
const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
async function shot(p,name){if(out)await p.screenshot({path:`${out}/${name}.png`});}
async function videoState(p){return p.evaluate(()=>{
 const r=el=>{const q=el.getBoundingClientRect();return {x:q.x,y:q.y,w:q.width,h:q.height,right:q.right,bottom:q.bottom};};
 const root=document.querySelector('.cinema-player'),v=root.querySelector('video');
 const stage=root.querySelector('.cinema-player__stage').getBoundingClientRect();
 return {stage:r(root.querySelector('.cinema-player__stage')),caption:r(root.querySelector('.cinema-player__caption')),body:r(root.querySelector('.cinema-player__body')),nav:r(root.querySelector('.cinema-player__navigation')),actions:[...root.querySelectorAll('.cinema-player__work-nav button,.cinema-player__return')].map(r),ratio:stage.width/stage.height,paused:v.paused,time:v.currentTime,hasSource:v.hasAttribute('src'),readyState:v.readyState,fit:getComputedStyle(v).objectFit,overflow:root.scrollWidth>innerWidth,paddingBottom:parseFloat(getComputedStyle(root.querySelector('.cinema-player__layout')).paddingBottom),scrollHeight:root.scrollHeight};
 });}
function videoCheck(m,width,height){
 assert(!m.overflow);assert(m.paused&&m.time===0);assert(!m.hasSource&&m.readyState===0,'Opening/switching must remain lazy');assert.equal(m.fit,'contain');
 assert(Math.abs(m.stage.w/m.stage.h-m.ratio)<.002);
 assert(m.stage.y>=m.nav.bottom+10);assert(Math.abs(m.caption.x-m.stage.x)<1);assert(m.caption.w<=m.stage.w+1);
 assert(m.body.bottom<=height-m.paddingBottom+1,'The complete video + information + navigation group must fit normal viewports');
 for(const b of m.actions){assert(b.h>=44&&b.w>=44);assert(b.x>=0&&b.right<=width+.5&&b.y>=m.nav.bottom&&b.bottom<=height-m.paddingBottom+1);assert(b.right<=m.stage.x||b.x>=m.stage.right||b.y>=m.stage.bottom,'Controls cover film');}
}
try{
 for(const [width,height]of viewports)for(const lang of ['zh','en'])for(const mode of ['normal','reduced']){
  const p=await browser.newPage({viewport:{width,height}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(lang=>localStorage.setItem('ailuren-lang',lang),lang);
  const cdp=await p.context().newCDPSession(p);await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:mode==='reduced'?'reduce':'no-preference'}]});
  await p.goto(new URL('works.html',base).href);
  for(const [index,format]of [[0,'landscape'],[3,'portrait']]){
   await p.locator('.library-grid .comet-archive__card').nth(index).click();await p.waitForFunction(()=>!!document.querySelector('.cinema-player video'));
   const initial=await videoState(p);videoCheck(initial,width,height);
   const bg=await p.locator('.cinema-player').evaluate(el=>getComputedStyle(el,'::backdrop').backgroundColor);assert.equal(bg,mode==='normal'?'rgba(12, 12, 13, 0.9)':'rgb(12, 12, 13)');
   if(out&&lang==='zh'&&[393,1440].includes(width))await shot(p,`${width}-${mode}-video-${format}`);
   if(mode==='normal'&&lang==='zh'&&[393,1440].includes(width)){
    await p.locator('.cinema-player__play').click();await p.waitForFunction(()=>document.querySelector('.cinema-player video').currentTime>.15);
    const playing=await videoState(p);for(const k of ['x','y','w','h'])assert(Math.abs(initial.stage[k]-playing.stage[k])<1,'Playback resized media');
   }
   await p.locator('.cinema-player video').evaluate(v=>window.previousMediaVideo=v);
   await p.keyboard.press('Escape');assert(await p.evaluate(()=>window.previousMediaVideo.paused&&!window.previousMediaVideo.getAttribute('src')));
  }
  await p.goto(new URL('index.html#impact-awards',base).href);await p.waitForSelector('.impact-award-card',{state:'attached'});
  // The desktop navigation has no visible hamburger; the anchor already exists.
  if(await p.locator('.nav-toggle').isVisible()){
    await p.locator('.nav-toggle').click();
    await p.locator('#mobile-primary-nav a[href="#recognition"]').click();
  }else{
    await p.locator('#impact-awards').scrollIntoViewIfNeeded();
  }
  await p.waitForTimeout(450);await p.locator('.impact-award-card').first().click();
  const originals=[];
  for(let index=0;index<8;index++){
   await p.waitForFunction(()=>{const img=document.querySelector('#impact-award-lightbox figure>img');return img?.complete&&img.naturalWidth>0;});await p.waitForTimeout(80);
   const m=await p.evaluate(()=>{
    const r=el=>{const q=el.getBoundingClientRect();return {x:q.x,y:q.y,w:q.width,h:q.height,right:q.right,bottom:q.bottom};};
    const root=document.querySelector('#impact-award-lightbox'),image=root.querySelector('figure>img'),s=getComputedStyle(image),bg=getComputedStyle(root,'::before');
    return {image:r(image),caption:r(root.querySelector('figcaption')),figure:r(root.querySelector('figure')),natural:[image.naturalWidth,image.naturalHeight],src:image.currentSrc,fit:s.objectFit,border:s.borderWidth,arrows:[...root.querySelectorAll('.impact-award-lightbox-nav')].map(r),overflow:root.scrollWidth>innerWidth,paddingBottom:parseFloat(getComputedStyle(root).paddingBottom),bg:bg.backgroundColor,blur:bg.backdropFilter};
   });originals.push(m.src);
   assert(!m.overflow);assert.equal(m.fit,'contain');assert.equal(m.border,'0px');assert(Math.abs(m.image.w/m.image.h-m.natural[0]/m.natural[1])<.002,'CSS creates letterboxing');
   assert(m.figure.bottom<=height-m.paddingBottom+1,`Award caption or arrows clipped: ${width}x${height} ${lang} ${mode} index=${index} ${JSON.stringify(m)}`);assert(m.image.x>=0&&m.image.right<=width);assert(m.caption.y-m.image.bottom>=12&&m.caption.y-m.image.bottom<=16);
   assert.equal(m.bg,mode==='normal'?'rgba(12, 12, 13, 0.9)':'rgb(12, 12, 13)');assert.equal(m.blur,mode==='normal'?'blur(28px) saturate(1.02)':'none');
   for(const a of m.arrows){assert(a.w>=44&&a.h>=44);assert(a.x>=0&&a.right<=width&&a.bottom<=height-m.paddingBottom+1);assert(a.right<=m.image.x||a.x>=m.image.right||a.y>=m.image.bottom,'Award arrow covers certificate');}
   if(width>760){assert(m.image.x-m.arrows[0].right<=24);assert(m.arrows[1].x-m.image.right<=24);}
   if(out&&lang==='zh'&&[393,1440].includes(width)&&[1,3,4,6].includes(index))await shot(p,`${width}-${mode}-award-${index+1}`);
   await p.locator('.impact-award-lightbox-nav--next').click();
  }
  const decodedOriginals=originals.map(src=>decodeURIComponent(src));
  assert.equal(new Set(decodedOriginals).size,8);assert(decodedOriginals.some(src=>src.includes('影视级特效小赛'))&&decodedOriginals.some(src=>src.includes('未来AI设计大赛')));
  for(let i=0;i<10;i++){await p.keyboard.press('Tab');assert(await p.evaluate(()=>!!document.activeElement.closest('#impact-award-lightbox')));}
  await p.keyboard.press('Escape');await p.waitForSelector('#impact-award-lightbox',{state:'detached'});assert(await p.locator('.impact-award-card').first().evaluate(el=>el===document.activeElement));assert(!await p.locator('main').evaluate(el=>el.inert));
  assert.deepEqual(errors,[]);console.log(`${width}x${height} ${lang} ${mode}: complete video controls, true image boundaries, all 8 original awards, shared materials and focus passed`);await p.close();
 }
 // Switching between equally wide films must also update their real height.
 for(const [width,height]of [[360,740],[393,852],[1440,900]]){
  const p=await browser.newPage({viewport:{width,height}});
  await p.addInitScript(()=>localStorage.setItem('ailuren-lang','en'));
  await p.goto(new URL('works.html',base).href);
  // Read production-rendered cards, not /src/* paths available only in dev.
  const projects=await p.locator('.library-grid .comet-archive__card').evaluateAll(cards =>
    cards.map(card=>({video:card.querySelector('.comet-archive__meta')?.textContent.trim()==='Play'}))
  );
  assert.equal(projects.length,15,'All 15 projects must appear in the library');
  await p.locator('.library-grid .comet-archive__card').first().click();
  const seen=new Set();
  let previousId=null;
  for(const [index,project]of projects.entries()){
   if(previousId!==null)await p.waitForFunction(id=>document.querySelector('.cinema-player')?.dataset.projectId!==id,previousId);
   const currentId=await p.locator('.cinema-player').getAttribute('data-project-id');
   assert(currentId&&!seen.has(currentId),'Player must advance to a new project');
   seen.add(currentId);
   if(project.video){
    await p.waitForFunction(()=>!!document.querySelector('.cinema-player video'));
    videoCheck(await videoState(p),width,height);
   }
   if(index<projects.length-1){
    previousId=currentId;
    await p.locator('.cinema-player__sequence button').last().click();
   }
  }
  assert(await p.locator('.cinema-player__sequence button').last().isDisabled());
  console.log(`${width}x${height}: every actual library film switched in sequence with correct source ratio and visible controls`);
  await p.close();
 }
 // A genuinely short viewport keeps one internal scroller and accessible chrome.
 const p=await browser.newPage({viewport:{width:393,height:500}});await p.goto(new URL('works.html',base).href);await p.locator('.library-grid .comet-archive__card').nth(3).click();await p.waitForFunction(()=>!!document.querySelector('.cinema-player video'));
 const scroll=await p.evaluate(()=>scrollY);const close=await p.locator('.cinema-player__close').evaluate(rect);await p.locator('.cinema-player__return').scrollIntoViewIfNeeded();assert.equal(await p.evaluate(()=>scrollY),scroll);assert.deepEqual(await p.locator('.cinema-player__close').evaluate(rect),close);await p.locator('.cinema-player__close').click();
 await p.goto(new URL('index.html#impact-awards',base).href);await p.locator('.nav-toggle').click();await p.locator('#mobile-primary-nav a[href="#recognition"]').click();await p.waitForTimeout(450);await p.locator('.impact-award-card').first().click();
 const nav=await p.locator('#impact-award-lightbox .cinema-player__navigation').evaluate(rect);const pageScroll=await p.evaluate(()=>scrollY);await p.locator('#impact-award-lightbox').evaluate(el=>el.scrollTop=300);assert.deepEqual(await p.locator('#impact-award-lightbox .cinema-player__navigation').evaluate(rect),nav);assert.equal(await p.evaluate(()=>scrollY),pageScroll);await p.locator('#impact-award-lightbox .cinema-player__close').click();await p.close();
 console.log('Short viewport single-scroller access passed. Real award files all share 1124x2000 dimensions; other source-image ratios and real 3:4 video are not marked verified.');
}finally{await browser.close();}
