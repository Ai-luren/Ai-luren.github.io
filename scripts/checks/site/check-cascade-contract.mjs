// Regressions previously caused by late high-specificity CSS overrides and
// a mobile transport overflowing when the browser viewport was zoomed narrow.
// This test never starts playback, uploads media, or modifies portfolio data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
import postcss from 'postcss';
import {createSafePage,getSafeMediaReport} from '../../lib/safe-media.mjs';

const root=path.resolve(import.meta.dirname,'../../..');
const protectedSelectors=new Set([
 '#ux-editor .ux-editor-top','#ux-editor .ux-work-nav',
 '#ux-editor .ux-work-arrow','#ux-editor .ux-work-position',
 '#ux-editor #ux-close-editor','#ux-new-editor .ux-new-frame-jog button',
 '#ux-new-editor #preview-wrap','#ux-new-editor .ux-new-player-picture',
]);
const css=postcss.parse(fs.readFileSync(path.join(root,'portfolio-workbench/style.css'),'utf8'));
const declarations=new Map();
css.walkRules(rule=>{
 if(rule.selectors.length!==1||!protectedSelectors.has(rule.selector))return;
 let p=rule.parent;const conditions=[];
 while(p&&p.type!=='root'){if(p.type==='atrule')conditions.unshift('@'+p.name+' '+p.params);p=p.parent;}
 rule.walkDecls(decl=>{
  const key=conditions.join('|')+'|'+rule.selector+'|'+decl.prop;
  const group=declarations.get(key)||[];group.push(decl);declarations.set(key,group);
 });
});
for(const [key,group] of declarations){
 assert(group.filter(decl=>decl.important).length<=1,
  'Repeated !important on a protected control: '+key+' — consolidate the owner instead of appending another override');
}

// Do not reintroduce declarations that have a later owner at the same
// selector and media context. Limit this guard to reviewed properties;
// intentional responsive and browser-fallback declarations remain valid.
const singleOwnerProperties=[
 ['portfolio-workbench/workbench-enhancements.css','',[
  ['#ux-editor .ux-version-label-form .ux-version-form-actions','display'],
  ['#ux-editor .ux-version-label-form .ux-version-form-actions','gap'],
  ['#ux-editor .ux-name-section .ux-section-heading .muted','font-size'],
  ['#ux-editor .ux-name-section .ux-section-heading .muted','color'],
  ['#ux-editor .ux-version-section','border-top'],
  ['#ux-editor .ux-name-section','border-top'],
  ['#ux-editor .ux-version-switcher .ux-variant-chips','min-height'],
  ['#ux-editor .ux-safe-archive','margin-top'],
  ['#ux-editor .ux-safe-archive','padding'],
 ]],
 ['src/styles/apple-system.css','@media (max-width: 720px)',[
  ['.impact-platform-mobile-network','padding'],
 ]],
];
for(const [filename,expectedContext,targets] of singleOwnerProperties){
 const fileCss=postcss.parse(fs.readFileSync(path.join(root,filename),'utf8'));
 const counts=new Map();
 fileCss.walkRules(rule=>{
  if(rule.selectors.length!==1)return;
  let context=[],parent=rule.parent;
  while(parent&&parent.type!=='root'){
   if(parent.type==='atrule')context.unshift('@'+parent.name+' '+parent.params);
   parent=parent.parent;
  }
  if(context.join('|')!==expectedContext)return;
  rule.walkDecls(decl=>{
   const key=rule.selector+'|'+decl.prop;
   counts.set(key,(counts.get(key)||0)+1);
  });
 });
 for(const [selector,prop] of targets){
  assert.equal(counts.get(selector+'|'+prop),1,
   'Keep exactly one reviewed CSS owner for '+filename+': '+selector+' / '+prop);
 }
}

const executable=['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
 '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(fs.existsSync);
assert(executable,'Edge/Chrome required');
const port=5279;
const base=process.env.PORTFOLIO_URL||'http://127.0.0.1:'+port+'/';
let server;
if(!process.env.PORTFOLIO_URL){
 server=spawn(process.execPath,['./node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],
  {cwd:root,stdio:'ignore'});
 let connected=false;
 for(let i=0;i<85;i++){
  try{if((await fetch(base,{signal:AbortSignal.timeout(1000)})).ok){connected=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,140));
 }
 assert(connected,'Production preview was not ready');
}
const browser=await chromium.launch({executablePath:executable,headless:true});
try{
 for(const width of [320,390,760,1024,1440]){
  for(const entry of ['index.html','works.html']){
   const page=await createSafePage(browser,{viewport:{width,height:844},reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(new URL(entry,base).href,{waitUntil:'domcontentloaded'});
   if(entry==='index.html'){
    const state=await page.evaluate(()=>{
     const top=document.querySelector('#top');
     const hero=document.querySelector('#top .hero-copy');
     return {heroOverlay:getComputedStyle(hero,'::before').display,
      headerMask:getComputedStyle(top,'::before').display,
      globalOverlay:getComputedStyle(document.querySelector('#video-overlay')).display};
    });
    assert.equal(state.heroOverlay,'none','Hero copy must not regain a hard-edged pseudo-element overlay');
    assert.equal(state.headerMask,'none','Hero section must not regain the legacy rectangular mask');
    assert.equal(state.globalOverlay,'none','Global dim overlay must stay disabled');
   }
   if(width<=760){
    const rects=await page.locator('.nav-language-switch > button').evaluateAll(buttons=>buttons.map(button=>{
     const r=button.getBoundingClientRect();return{width:r.width,height:r.height};
    }));
    assert.equal(rects.length,2);
    for(const r of rects)assert(r.width>=44&&r.height>=44,'Language switch must keep a 44px phone hit target: '+JSON.stringify(r));
   }
   assert.deepEqual(errors,[],'No page runtime errors');
   assert.equal(getSafeMediaReport(page).urls.length,0,'Do not load ImageKit during CSS verification');
   await page.close();
  }
 }
 for(const width of [280,288,320]){
  const page=await createSafePage(browser,{viewport:{width,height:512},reducedMotion:'reduce'});
  await page.goto(new URL('works.html',base).href,{waitUntil:'domcontentloaded'});
  await page.locator('.library-grid .comet-archive__card').first().click();
  await page.locator('.cinema-player[open]').waitFor();
  const data=await page.evaluate(()=>{
   const modal=document.querySelector('.cinema-player[open]');
   const controls=modal.querySelector('.cinema-player__mobile-controls');
   const buttons=[...controls.querySelectorAll('button')].filter(el=>getComputedStyle(el).display!=='none');
   return {scrollWidth:modal.scrollWidth,clientWidth:modal.clientWidth,controlsVisible:getComputedStyle(controls).display!=='none',
    smallestButton:Math.min(...buttons.map(el=>el.getBoundingClientRect().height)),videoSrc:modal.querySelector('video')?.getAttribute('src')};
  });
  assert(data.scrollWidth<=data.clientWidth+1,'Zoomed mobile player must not scroll horizontally: '+JSON.stringify(data));
  assert(data.controlsVisible);
  assert(data.smallestButton>=44,'Mobile control buttons must remain full-height');
  assert(!data.videoSrc,'Opening the player must not preload MP4 bytes');
  assert.equal(getSafeMediaReport(page).urls.length,0);
  await page.close();
 }
 console.log('CASCADE_CONTRACT_PASS — Hero layers, navigation hitboxes, zoomed mobile transport, safe CSS importance and media requests');
}finally{
 await browser.close();
 if(server){server.kill('SIGTERM');await new Promise(resolve=>setTimeout(resolve,160));}
}
