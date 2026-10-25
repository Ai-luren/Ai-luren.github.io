import { createSafePage, createSafeContext } from './lib/safe-media.mjs';
/**
 * Step 03: shared ProjectCard visual contract on Featured & All Work.
 *
 * Run: npm run check:work-cards
 * Or: PORTFOLIO_URL=http://127.0.0.1:5181/ npm run check:work-cards
 */
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';

const port = 5213;
const base = process.env.PORTFOLIO_URL || `http://127.0.0.1:${port}/`;
const executablePath = [
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
assert(executablePath, 'Chrome or Edge is required');
const widths = [320,360,390,430,500,720,721,760,761,900,1024,1280,1440,1920];
let server;

async function waitForServer() {
  for(let n=0;n<80;n++){
    if(server?.exitCode != null) throw new Error('Vite exited before readiness');
    try { if((await fetch(base,{signal:AbortSignal.timeout(1000)})).ok) return; } catch { /* retry */ }
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  throw new Error(`Unable to connect to ${base}`);
}
const epsilon = 1.1;
const near = (a,b) => Math.abs(a-b) < epsilon;

try{
  if(!process.env.PORTFOLIO_URL){
    server = spawn(process.execPath, ['./node_modules/vite/bin/vite.js',
      '--host','127.0.0.1','--port',String(port),'--strictPort'],{
      cwd:process.cwd(),stdio:'ignore'});
    await waitForServer();
  }
  const browser=await chromium.launch({executablePath,headless:true});
  try{
    for(const width of widths) for(const lang of ['zh','en']){
      const home=await createSafePage(browser, {viewport:{width,height:900}});
      const works=await createSafePage(browser, {viewport:{width,height:900}});
      try{
        const errors=[];
        home.on('pageerror',e=>errors.push('home: '+e.message));
        works.on('pageerror',e=>errors.push('works: '+e.message));
        await Promise.all([home,works].map(page=>page.addInitScript(value=>localStorage.setItem('ailuren-lang',value),lang)));
        await home.goto(new URL('index.html#projects',base).href,{waitUntil:'domcontentloaded'});
        await works.goto(new URL('works.html',base).href,{waitUntil:'domcontentloaded'});
        await home.locator('#projects .comet-archive__card').first().waitFor({state:'attached'});
        await works.locator('.library-grid .comet-archive__card').first().waitFor({state:'attached'});
        const get=async(page,scope)=>page.evaluate(selector=>{
          const root=document.querySelector(selector);
          const item=root.querySelector('.comet-archive__card');
          const image=item.querySelector('.comet-archive__image');
          const title=item.querySelector('.comet-archive__title');
          const copy=item.querySelector('.comet-archive__copy');
          const description=item.querySelector('.comet-archive__details strong');
          const imgRect=image.getBoundingClientRect(),titleRect=title.getBoundingClientRect(),copyRect=copy.getBoundingClientRect();
          const coverCSS=getComputedStyle(image), titleCSS=getComputedStyle(title);
          const copyCSS=getComputedStyle(copy);
          const statusVisible=element=>{
            if(!element)return false;
            const style=getComputedStyle(element),rect=element.getBoundingClientRect();
            return style.display!=='none' && style.visibility!=='hidden' && Number(style.opacity)>.01 && rect.width>0 && rect.height>0;
          };
          const badge=item.querySelector('.comet-archive__image > .comet-archive__play-badge');
          const coverRect=badge?.getBoundingClientRect();
          const status={
            onCover:statusVisible(badge),
            below:statusVisible(item.querySelector('.comet-archive__mobile-link')),
            count:item.querySelectorAll('.comet-archive__play-badge').length,
            label:badge?.textContent.trim(),
            containment:coverRect ? (
              coverRect.left >= imgRect.left - 1 &&
              coverRect.right <= imgRect.right + 1 &&
              coverRect.top >= imgRect.top - 1 &&
              coverRect.bottom <= imgRect.bottom + 1
            ) : false,
          };
          const txt=element=>element.textContent.trim().replace(/\s+/g,' ');
          return {
            title:txt(title),detail:txt(description),
            cover: {ratio:coverCSS.aspectRatio,border:coverCSS.borderTopColor,radius:coverCSS.borderRadius,
              shadow:coverCSS.boxShadow,width:imgRect.width,height:imgRect.height,size:coverCSS.backgroundSize},
            typography:{font:titleCSS.fontSize,weight:titleCSS.fontWeight,line:titleCSS.lineHeight,
              detailSize:getComputedStyle(description).fontSize,detailLine:getComputedStyle(description).lineHeight},
            gapTitle:titleRect.top-imgRect.bottom+parseFloat(titleCSS.paddingTop),
            gapDetail:copyRect.top-titleRect.bottom+parseFloat(copyCSS.paddingTop),
            overflow:document.documentElement.scrollWidth-innerWidth,
            cardOverflow:item.scrollWidth-item.clientWidth,
            cards:root.querySelectorAll('.comet-archive__card').length,
            statusesAllValid:[...root.querySelectorAll('.comet-archive__card')].every(card=>{
              const image=card.querySelector('.comet-archive__image');
              const badges=card.querySelectorAll('.comet-archive__play-badge');
              if(!image||badges.length!==1||card.querySelector('.comet-archive__mobile-link'))return false;
              const badge=badges[0],rect=badge.getBoundingClientRect(),cover=image.getBoundingClientRect(),style=getComputedStyle(badge);
              return style.display!=='none'&&Number(style.opacity)>.01 &&
                rect.width>0&&rect.height>0 && rect.left>=cover.left-1&&rect.right<=cover.right+1
                && rect.top>=cover.top-1&&rect.bottom<=cover.bottom+1;
            }),
            status,
          };
        },scope);
        const [a,b]=await Promise.all([get(home,'#projects'),get(works,'.library-grid')]);
        const tag=`${width}px ${lang}`;
        assert.equal(a.title,b.title,`${tag}: same first project must have same name`);
        assert.equal(a.detail,b.detail,`${tag}: first project award/category differs`);
        assert.equal(a.cover.ratio,'3 / 4',`${tag}: Featured must be 3:4`);
        assert.equal(b.cover.ratio,'3 / 4',`${tag}: All Work must be 3:4`);
        for(const [kind,result] of [['featured',a],['library',b]]){
          assert(near(result.cover.width/result.cover.height,.75),`${tag}: ${kind} cover proportions incorrect`);
          assert(result.cardOverflow<=2,`${tag}: ${kind} card horizontally overflows`);
          assert(result.overflow<=2,`${tag}: ${kind} page horizontally overflows`);
          // One always-visible badge inside the cover on every viewport.
          assert.equal(result.statusesAllValid,true,`${tag}: ${kind} some cards lack their permanent cover badge`);
          assert.equal(result.status.count,1,`${tag}: ${kind} should have exactly one status badge`);
          assert.equal(result.status.onCover,true,`${tag}: ${kind} cover badge not permanently visible`);
          assert.equal(result.status.below,false,`${tag}: ${kind} has an orphan status below the card`);
          assert.equal(result.status.containment,true,`${tag}: ${kind} badge escaped the artwork`);
          assert.equal(result.status.label,lang==='en'?'Play':'播放',`${tag}: ${kind} status translation wrong`);
        }
        for(const prop of ['border','radius','shadow']) assert.equal(a.cover[prop],b.cover[prop],`${tag}: cover ${prop} mismatch`);
        for(const prop of ['font','weight','line','detailSize','detailLine']) assert.equal(a.typography[prop],b.typography[prop],`${tag}: typography ${prop} mismatch`);
        const expectedTitle=width<=720?8:10,expectedDetail=width<=720?4:5;
        for(const [kind,result] of [['featured',a],['library',b]]){
          assert(near(result.gapTitle,expectedTitle),`${tag}: ${kind} cover-to-title gap expected ${expectedTitle}px, got ${result.gapTitle}`);
          assert(near(result.gapDetail,expectedDetail),`${tag}: ${kind} title-to-meta gap expected ${expectedDetail}px, got ${result.gapDetail}`);
        }
        assert.equal(a.cards,width<=720?4:8,`${tag}: Featured count or mobile paging changed`);
        assert.equal(b.cards,15,`${tag}: All Work lost projects`);
        if(width<=760){
          const filters=await works.locator('.library-filters button').evaluateAll(elements=>elements.map(el=>{
            const r=el.getBoundingClientRect(),c=getComputedStyle(el);
            return {w:r.width,h:r.height,display:c.display,label:el.textContent.trim()};
          }));
          assert.equal(filters.length,5,`${tag}: filter count`);
          for(const f of filters) assert(f.w>=43.5&&f.h>=43.5,`${tag}: filter ${f.label} is less than 44px target (${f.w}×${f.h})`);
        }
        assert.deepEqual(errors,[],`${tag}: page errors`);
        console.log(`PASS ${tag}: shared 3:4 / 18px covers, type, gaps, 8/15 works, filter targets`);
      } finally{await home.close();await works.close()}
    }
  }finally{await browser.close()}
  console.log('PASS: Step 03 works design, 14 widths × 2 languages × 2 pages');
}finally{
  if(server){server.kill('SIGTERM');await new Promise(resolve=>setTimeout(resolve,200));}
}
