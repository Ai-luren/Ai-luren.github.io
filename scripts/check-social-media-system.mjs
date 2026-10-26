import { createSafePage, createSafeContext } from './lib/safe-media.mjs';
/**
 * Regression contract: AI Media mobile layout + one shared modal navigation.
 * Run: npm run check:social-media (starts its own Vite server)
 * Or: PORTFOLIO_URL=http://127.0.0.1:5181/ npm run check:social-media
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const executablePath = [
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
assert(executablePath, 'Edge or Chrome is required');
const port = 5214;
const base = process.env.PORTFOLIO_URL || `http://127.0.0.1:${port}/`;
const widths = [320,360,390,430,720,760,761,1024,1440];
let server;
const geometry = element => {
  const rect = element.getBoundingClientRect();
  const css = getComputedStyle(element);
  return { rect: [rect.x,rect.y,rect.width,rect.height],
    background: css.backgroundColor, border: css.borderColor, radius: css.borderRadius };
};
const closeEnough = (a,b) => Math.abs(a-b)<1.1;

async function waitForReady() {
  for(let count=0;count<90;count++){
    try {if((await fetch(base,{signal:AbortSignal.timeout(1000)})).ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,160));
  }
  throw Error(`Vite not reachable: ${base}`);
}
try {
  if(!process.env.PORTFOLIO_URL){
    server=spawn(process.execPath,['./node_modules/vite/bin/vite.js',
      '--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'});
    await waitForReady();
  }
  const browser = await chromium.launch({executablePath,headless:true});
  try {
    for(const width of widths)for(const lang of ['zh','en']){
      const page=await createSafePage(browser, {viewport:{width,height:900}});
      try {
        const errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        await page.addInitScript(value=>localStorage.setItem('ailuren-lang',value),lang);
        await page.goto(new URL('index.html#impact-reach',base).href,{waitUntil:'domcontentloaded'});
        await page.locator('#impact-reach .impact-reach-dossier').waitFor();
        const tag=`${width}px ${lang}`;
        const home=await page.locator('body > header').evaluate(geometry);
        const layout=await page.locator('#impact-reach .impact-reach-dossier').evaluate(node=>{
          const bounds=s=>{const r=node.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};};
          return {
            glass:bounds('.impact-reach-dossier-head'),
            feature:bounds('.impact-reach-feature'),
            rows:[...node.querySelectorAll('.impact-reach-account-record')].map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};}),
            layout:getComputedStyle(node.querySelector('.impact-reach-layout')).gridTemplateColumns,
            featureMetricX:bounds('.impact-reach-feature-metrics').x,
            accountMetricX:bounds('.impact-reach-record-metrics').x,
            panelOverflow:node.scrollWidth-node.clientWidth,
            pageOverflow:document.documentElement.scrollWidth-innerWidth,
          };
        });
        assert.equal(layout.rows.length,3,`${tag}: must keep the 1+3 account layout`);
        assert(layout.panelOverflow<=2 && layout.pageOverflow<=2,`${tag}: horizontal overflow`);
        if(width<=720){
          assert(layout.rows[0].y>layout.feature.y+layout.feature.h-2,`${tag}: mobile accounts should stack after feature`);
          assert(layout.rows.every((r,i)=>i===0||r.y>layout.rows[i-1].y),`${tag}: account order`);
          assert(layout.rows.every(r=>closeEnough(r.x,layout.feature.x)),`${tag}: account left edges differ`);
          assert(layout.feature.h<205,`${tag}: featured platform too tall`);
        }
        const actions=page.locator('#impact-reach .impact-reach-action');
        assert.equal(await actions.count(),7,`${tag}: missing actions`);
        // Every available homepage link follows the single combined-account viewer.
        const names=await actions.allTextContents();
        for(const index of [0,2,4,6]){
          assert(names[index].includes(lang==='zh'?'查看账号资料':'View account details'),`${tag}: action order is inconsistent`);
        }
        for(const index of [0,2,6]){
          const trigger=actions.nth(index);
          await trigger.click();
          await page.locator('.impact-profile-lightbox').waitFor();
          const nav=page.locator('.impact-profile-lightbox > .cinema-player__navigation');
          assert.equal(await nav.count(),1,`${tag}: profile viewer must reuse one CinemaNavigation`);
          assert.equal(await page.locator('.impact-profile-dialog-header,.impact-profile-dialog-close').count(),0,
            `${tag}: custom navigation is forbidden`);
          const sample=await nav.evaluate(geometry);
          for(const k of ['background','border','radius'])assert.equal(sample[k],home[k],`${tag}: capsule ${k}`);
          sample.rect.forEach((v,i)=>assert(closeEnough(v,home.rect[i]),`${tag}: capsule geometry ${i}`));
          assert.equal(await page.locator('body > header').evaluate(el=>getComputedStyle(el).visibility),'hidden');
          assert.equal(await page.locator('.impact-profile-lightbox .cinema-player__close').count(),1);
          assert(await page.locator('.impact-profile-lightbox .cinema-player__close').evaluate(el=>el===document.activeElement));
          const proof=page.locator('.impact-profile-dialog-image');
          assert.equal(await proof.count(),2,tag+': account screenshot and QR should coexist');
          await Promise.all([
            proof.nth(0).evaluate(img=>img.decode()),
            proof.nth(1).evaluate(img=>img.decode()),
          ]);
          const details=await page.locator('.impact-profile-dialog').evaluate(dialog=>{
            const screenshot=dialog.querySelector('.impact-profile-proof img').getBoundingClientRect();
            const qr=dialog.querySelector('.impact-profile-qr-panel img').getBoundingClientRect();
            return {
              screenshot:{x:screenshot.x,y:screenshot.y,w:screenshot.width,h:screenshot.height},
              qr:{x:qr.x,y:qr.y,w:qr.width,h:qr.height},
              dialogWidth:dialog.getBoundingClientRect().width,
              lightboxWidth:document.querySelector('.impact-profile-lightbox').clientWidth,
              qrNote:dialog.querySelector('.impact-profile-dialog-qr-note')?.textContent,
            };
          });
          assert(details.screenshot.w>0 && details.qr.w>=130,tag+': invisible combined images');
          assert(details.screenshot.x>=-1 && details.qr.x+details.qr.w<=width+1,tag+': combined viewer horizontal overflow');
          assert(details.qrNote && details.qrNote.length>8,tag+': missing QR instructions');
          if(width<=720){
            assert(details.qr.y>=details.screenshot.y+details.screenshot.h-2,tag+': mobile must stack image and QR');
          }else{
            assert(details.qr.x>=details.screenshot.x+details.screenshot.w-2,tag+': desktop should show two columns');
          }
          assert.equal(await page.locator('a.impact-profile-dialog-action[download]').count(),1);
          // The four proof viewers share an in-modal, decoded account carousel;
          // verify click + keyboard navigation and stable QR content on both
          // phone and desktop without invoking any external profile URLs.
          if(index===0 && [390,1440].includes(width)){
            const cycle=page.locator('.impact-profile-pagination');
            const arrows=cycle.locator('button');
            assert.equal(await arrows.count(),2,`${tag}: profile arrows missing`);
            assert.equal((await cycle.locator('.impact-profile-pagination-count').innerText()).trim(),'1 / 4');
            await arrows.last().click();
            await page.waitForFunction(()=>document.querySelector('.impact-profile-pagination-count')?.textContent.includes('2 / 4'));
            await page.keyboard.press('ArrowRight');
            await page.waitForFunction(()=>document.querySelector('.impact-profile-pagination-count')?.textContent.includes('3 / 4'));
            await arrows.first().click();
            await page.waitForFunction(()=>document.querySelector('.impact-profile-pagination-count')?.textContent.includes('2 / 4'));
            await arrows.first().click();
            await page.waitForFunction(()=>document.querySelector('.impact-profile-pagination-count')?.textContent.includes('1 / 4'));
            assert.equal(await page.locator('.impact-profile-dialog-image').count(),2);
            assert.equal(await page.locator('.impact-profile-lightbox > .cinema-player__navigation').count(),1);
          }
          assert.equal(await page.locator('main').evaluate(el=>el.inert),true);
          for(let i=0;i<5;i++){
            await page.keyboard.press('Tab');
            assert(await page.evaluate(()=>!!document.activeElement.closest('.impact-profile-lightbox')),tag+': focus leaked');
          }
          if(index===2){
            await page.locator('.impact-profile-lightbox .cinema-player__language [data-switch-lang="'+(lang==='zh'?'en':'zh')+'"]').click();
            assert.notEqual(await page.locator('html').getAttribute('lang'),lang);
          }
          await page.keyboard.press('Escape');
          await page.locator('.impact-profile-lightbox').waitFor({state:'detached'});
          assert.equal(await page.locator('main').evaluate(el=>el.inert),false);
          assert.equal(await page.locator('body > header').evaluate(el=>getComputedStyle(el).visibility),'visible');
          try {
            await page.waitForFunction(index => document.querySelectorAll('#impact-reach .impact-reach-action')[index] === document.activeElement, index, {timeout:3000});
          } catch (error) {
            console.log('FOCUS DIAGNOSTIC',tag,index,await page.evaluate(index => ({
              focused:document.activeElement?.outerHTML?.slice(0,260),
              expected:document.querySelectorAll('#impact-reach .impact-reach-action')[index]?.outerHTML?.slice(0,260),
              activeTag:document.activeElement?.tagName,
              profileTriggers:[...document.querySelectorAll('[data-social-profile-trigger]')].map(el=>({id:el.dataset.socialProfileTrigger,focused:el===document.activeElement})),
              backgroundInert:document.querySelector('main')?.inert,
            }),index));
            throw error;
          }
        }
        assert.deepEqual(errors,[],`${tag}: page errors`);
        console.log(`PASS ${tag}: media layout, action order, shared capsule, language, QR, focus`);
      } finally {await page.close()}
    }
  } finally {await browser.close()}
  console.log('PASS: AI Media + combined profile and QR + shared navigation, 9 widths × 2 languages');
} finally {
  if(server){server.kill('SIGTERM');await new Promise(resolve=>setTimeout(resolve,180));}
}
