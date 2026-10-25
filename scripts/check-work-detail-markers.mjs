import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { createSafePage, getSafeMediaReport } from './lib/safe-media.mjs';

const executablePath = [
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
assert(executablePath, 'Browser required');
const supplied = process.env.PORTFOLIO_URL;
const base = supplied || 'http://127.0.0.1:5266/';
let server;
const near = (a, b, tolerance = 1.25) => Math.abs(a - b) <= tolerance;
async function ready() {
  for (let i = 0; i < 80; i++) {
    try {if ((await fetch(base, {signal:AbortSignal.timeout(1000)})).ok) return;} catch {}
    await new Promise(resolve => setTimeout(resolve, 140));
  }
  throw Error('Unable to start marker-check server');
}
try {
  if (!supplied) {
    server = spawn(process.execPath,['./node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5266','--strictPort'],{stdio:'ignore'});
    await ready();
  }
  const browser = await chromium.launch({executablePath,headless:true});
  try {
    for (const width of [320,360,390,430,720,721,760,761,1024,1440,1920])
      for (const lang of ['zh','en'])
        for (const [path,sel] of [['index.html','#projects .comet-archive__card'],['works.html','.library-grid .comet-archive__card']]) {
          const page = await createSafePage(browser,{viewport:{width,height:900}});
          const tag = `${width}px ${lang} ${path}`;
          try {
            await page.addInitScript(l=>localStorage.setItem('ailuren-lang',l),lang);
            await page.goto(new URL(path,base).href,{waitUntil:'domcontentloaded'});
            await page.locator(sel).first().waitFor({state:'attached'});
            const result = await page.locator(sel).first().evaluate(card=>{
              const title=card.querySelector('.comet-archive__title');
              const detail=card.querySelector('.comet-archive__details');
              const label=detail.querySelector('strong');
              const titleRect=title.getBoundingClientRect(),detailRect=detail.getBoundingClientRect(),labelRect=label.getBoundingClientRect();
              const detailStyle=getComputedStyle(detail),pseudo=getComputedStyle(detail,'::before');
              return {
                titleStart:titleRect.x+parseFloat(getComputedStyle(title).paddingLeft),
                ruleStart:detailRect.x+parseFloat(detailStyle.paddingLeft),
                labelStart:labelRect.x,
                ruleTop:detailRect.y+parseFloat(pseudo.marginTop),
                textTop:labelRect.y,
                ruleWidth:parseFloat(pseudo.width),
                ruleHeight:parseFloat(pseudo.height),
                color:pseudo.backgroundColor,
                overflow:document.documentElement.scrollWidth-innerWidth
              };
            });
            assert(near(result.titleStart,result.ruleStart),tag+': rail and title not left aligned');
            assert(near(result.labelStart-result.ruleStart,12,.1),tag+': wrong text indent');
            assert(near(result.ruleTop-result.textTop,2,.1),tag+': marker not aligned to first line');
            assert.equal(result.ruleWidth,2,tag+': wrong rail width');
            assert.equal(result.ruleHeight,14,tag+': wrong rail height');
            assert.equal(result.color,'rgb(41, 151, 255)',tag+': wrong rail color');
            assert(result.overflow<=2,tag+': horizontal overflow');
            assert.equal(getSafeMediaReport(page).urls.length,0,tag+': ImageKit request occurred');

            if ([390,1440].includes(width)) {
              await page.locator(sel).first().evaluate(el=>el.click());
              await page.locator('.cinema-player__caption p').waitFor({state:'attached',timeout:7500});
              const modal=await page.locator('.cinema-player__caption').evaluate(el=>{
                const title=el.querySelector('h2'),detail=el.querySelector('p'),titleRect=title.getBoundingClientRect(),detailRect=detail.getBoundingClientRect();
                const css=getComputedStyle(detail),pseudo=getComputedStyle(detail,'::before');
                return {
                  titleStart:titleRect.x,
                  ruleStart:detailRect.x,
                  labelStart:detailRect.x+parseFloat(css.paddingLeft),
                  ruleTop:detailRect.y+parseFloat(pseudo.top),
                  textTop:detailRect.y,
                  ruleWidth:parseFloat(pseudo.width),
                  ruleHeight:parseFloat(pseudo.height),
                  borderWidth:parseFloat(css.borderLeftWidth),
                  color:pseudo.backgroundColor,
                  overflow:document.documentElement.scrollWidth-innerWidth,
                };
              });
              assert(near(modal.titleStart,modal.ruleStart),tag+': player rail not title aligned');
              assert(near(modal.labelStart-modal.ruleStart,12,.1),tag+': player label inset differs');
              assert(near(modal.ruleTop-modal.textTop,2,.1),tag+': player rail not on first line');
              assert.equal(modal.ruleWidth,2);
              assert.equal(modal.ruleHeight,14);
              assert.equal(modal.borderWidth,0,tag+': old stretch-to-height border remains');
              assert.equal(modal.color,'rgb(41, 151, 255)');
              assert(modal.overflow<=2,tag+': player overflow');
              assert.equal(getSafeMediaReport(page).urls.length,0,tag+': modal requested CDN');
            }
          } finally {await page.close();}
          console.log('PASS',tag,'title / marker / text geometry');
        }
  } finally {await browser.close();}
  console.log('PASS: Shared blue detail rail across 11 widths × 2 languages × 2 pages plus player dialogs');
} finally {
  if (server) {server.kill('SIGTERM');await new Promise(resolve=>setTimeout(resolve,130));}
}
