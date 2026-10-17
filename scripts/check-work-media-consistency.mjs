/* Step 04: matching status affordances, surfaces and viewer across pages. */
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
const binary=['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
assert(binary,'Edge or Chrome required');
const port=5258, base=process.env.PORTFOLIO_URL||'http://127.0.0.1:'+port+'/';
const widths=[320,360,390,430,720,721,760,1024,1440];
let server;
async function ready(){
 for(let i=0;i<90;i++){try{if((await fetch(base,{signal:AbortSignal.timeout(900)})).ok)return;}catch{}
  await new Promise(r=>setTimeout(r,160));}
 throw Error('Vite media test server failed');
}
try {
 if(!process.env.PORTFOLIO_URL){
  server=spawn(process.execPath,['./node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'});
  await ready();
 }
 const browser=await chromium.launch({headless:true,executablePath:binary});
 try{
  for(const width of widths)for(const lang of ['zh','en']){
   const pairs={};
   for(const kind of ['home','library']){
    const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
    try{
     const errors=[];
     page.on('pageerror',e=>errors.push(e.message));
     await page.addInitScript(value=>localStorage.setItem('ailuren-lang',value),lang);
     await page.goto(new URL(kind==='home'?'index.html#projects':'works.html',base).href,{waitUntil:'domcontentloaded'});
     const selector=kind==='home'?'#projects .comet-archive__card':'.library-grid .comet-archive__card';
     const card=page.locator(selector).first();
     await card.waitFor();
     const output=await card.evaluate(card=>{
      const image=card.querySelector('.comet-archive__image'),hint=card.querySelector('.comet-archive__mobile-link'),badge=card.querySelector('.comet-archive__meta');
      const im=getComputedStyle(image),hintStyle=getComputedStyle(hint),imageBox=image.getBoundingClientRect(),hintBox=hint.getBoundingClientRect();
      return {
       mediaBg:im.backgroundColor,border:im.borderTopColor,ratio:im.aspectRatio,round:im.borderRadius,shadow:im.boxShadow,
       status:hint.textContent.trim(),hintVisible:hintStyle.display!=='none'&&hintBox.height>0,
       hintFont:hintStyle.fontSize,hintHeight:hintBox.height,
       cardName:card.querySelector('.comet-archive__title').textContent.trim().replace(/\s+/g,' '),
       badgeText:badge.textContent.trim(),
       captionEnd:card.querySelector('.comet-archive__copy').getBoundingClientRect().bottom,hintStart:hintBox.top,
       coverWidth:imageBox.width,coverHeight:imageBox.height,
       overflow:document.documentElement.scrollWidth-innerWidth};
     });
     const tag=width+'px '+lang+' '+kind;
     assert(output.overflow<=2,tag+': horizontal overflow');
     assert.equal(output.ratio,'3 / 4');
     assert(Math.abs(output.coverWidth/output.coverHeight-.75)<.01);
     assert.equal(output.round,'18px');
     if(width<=720){
      assert(output.hintVisible,tag+': mobile status hidden');
      assert(Math.abs(output.hintHeight-27.39)<1,tag+': mobile status height mismatch');
      assert(output.hintStart>=output.captionEnd-1,tag+': mobile status overlaps caption');
     }else {
      assert(!output.hintVisible,tag+': desktop has second status');
      await card.hover();await page.waitForTimeout(180);
      const opacity=await card.locator('.comet-archive__meta').evaluate(el=>Number(getComputedStyle(el).opacity));
      assert(opacity>.95,tag+': hover/focus status missing');
     }
     if([390,1024].includes(width)){
      await card.click();
      const dialog=page.locator('.cinema-player[open]');
      await dialog.waitFor();
      assert.equal(await page.locator('.cinema-player__navigation').count(),1,tag+': duplicate navigation');
      const state=await dialog.evaluate(el=>{
       const image=el.querySelector('.cinema-player__poster');
       const video=el.querySelector('.cinema-player video');
       return {posterSrc:image?.getAttribute('src'),posterFit:getComputedStyle(image).objectFit,
        videoSource:video?.getAttribute('src')??null,playButton:Boolean(el.querySelector('.cinema-player__play')),
        title:el.querySelector('#cinema-player-title')?.textContent.trim()};
      });
      assert(state.posterSrc,tag+': poster missing');
      assert.equal(state.posterFit,'contain',tag+': poster cropped');
      assert.equal(state.videoSource,null,tag+': video loads before play');
      assert(state.playButton && state.title,tag+': missing video controls/title');
      await dialog.locator('.cinema-player__close').click();
      await dialog.waitFor({state:'detached'});
      assert(await card.evaluate(el=>el===document.activeElement),tag+': focus not restored');
     }
     assert.deepEqual(errors,[],tag+': page errors');
     pairs[kind]=output;
    } finally{await page.close()}
   }
   const a=pairs.home,b=pairs.library,tag=width+'px '+lang;
   for(const field of ['mediaBg','border','ratio','round','shadow','status','cardName','badgeText'])assert.equal(a[field],b[field],tag+': '+field+' mismatch');
   if(width<=720)for(const field of ['hintFont','hintHeight'])assert.equal(a[field],b[field],tag+': '+field+' differs');
   console.log('PASS '+tag+': media surfaces, status, viewer');
  }
 }finally{await browser.close()}
 console.log('PASS: Step 04 cross-page media (9 widths x 2 languages x 2 pages)');
}finally{
 if(server){server.kill('SIGTERM');await new Promise(r=>setTimeout(r,120));}
}
