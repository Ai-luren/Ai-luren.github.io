import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createSafePage, getSafeMediaReport } from './lib/safe-media.mjs';

const executablePath = [
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
assert(executablePath, 'Edge/Chrome browser required');
const browser = await chromium.launch({ executablePath, headless: true });
const base = process.env.PORTFOLIO_URL ?? 'http://127.0.0.1:5174/';
const widths = [320, 360, 390, 430, 720, 760, 761, 768, 820, 899, 900, 1024, 1440, 1920];
let count=0;

try {
  for(const width of widths) for(const lang of ['zh','en']){
    const tag = width+'px '+lang;
    const page = await createSafePage(browser,{viewport:{width,height:900},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    try{
      await page.addInitScript(l=>localStorage.setItem('ailuren-lang',l),lang);
      await page.goto(new URL('index.html',base).href,{waitUntil:'domcontentloaded'});
      for(const anchor of ['#impact-programs','#impact-reach']){
        await page.locator(anchor).scrollIntoViewIfNeeded();
        await page.locator(anchor).waitFor({state:'visible',timeout:10000});
      }
      const state=await page.evaluate(()=>{
        const box=el=>el?.getBoundingClientRect();
        const style=el=>getComputedStyle(el);
        const activeGrid=document.querySelector(innerWidth<=760
          ?'.impact-platform-mobile-grid':'.impact-platform-desktop-grid');
        const tiles=[...activeGrid.querySelectorAll('.impact-platform-mobile-tile,.impact-platform-desktop-tile')];
        const first=tiles[0],second=tiles[1],nextRow=tiles[innerWidth<=760?2:4];
        const gridStyle=style(activeGrid),one=style(first),two=style(second),later=style(nextRow);
        const label=first.querySelector('strong'),role=first.querySelector('span'),img=first.querySelector('img');
        const social=document.querySelector('.impact-reach-dossier');
        const feature=social.querySelector('.impact-reach-feature'),main=feature.querySelector('.impact-reach-feature-main'),actions=feature.querySelector('.impact-reach-feature-actions');
        const list=social.querySelector('.impact-reach-account-list');
        const f=box(feature),m=box(main),a=box(actions),l=box(list);
        const mid=(m.top+a.bottom)/2,center=f.top+f.height/2;
        return {
          platformCount:tiles.length,
          logoCount:tiles.filter(x=>x.querySelector('img')?.naturalWidth>0).length,
          gridColumns:gridStyle.gridTemplateColumns.split(' ').length,
          gap:gridStyle.columnGap,
          noInsetBorder:one.borderTopWidth==='0px'&&one.borderLeftWidth==='0px',
          separatorTop:later.borderTopWidth,
          separatorSide:two.borderLeftWidth,
          background:one.backgroundColor,
          radius:one.borderRadius,
          hoverTransition:one.transitionProperty,
          textOk:box(label).height>0&&box(role).height>0&&box(img).height>0,
          desktopCentered:Math.abs(mid-center),
          featureVerticalCenter:style(feature).justifyContent,
          socialCount:social.querySelectorAll('.impact-reach-account-record').length,
          socialActions:social.querySelectorAll('button[data-social-profile-trigger]').length,
          socialLabel:social.querySelector('.impact-reach-feature-primary')?.textContent.trim(),
          listHeight:l.height,featureHeight:f.height,
          overflow:document.documentElement.scrollWidth-innerWidth,
        };
      });
      assert.equal(state.platformCount,8,tag+': credential count');
      assert.equal(state.gridColumns,width<=760?2:4,tag+': grid columns changed');
      assert.equal(state.gap,'0px',tag+': repeated tile gutters reappeared');
      assert.equal(state.noInsetBorder,true,tag+': unnecessary inner tile border');
      assert.equal(state.separatorSide,'1px',tag+': column separator missing');
      assert.equal(state.separatorTop,'1px',tag+': row separator missing');
      assert.equal(state.background,'rgba(0, 0, 0, 0)',tag+': inset glass still visible');
      assert.equal(state.radius,'0px',tag+': repeated tile radius still visible');
      assert.equal(state.textOk,true,tag+': logo/label hidden');
      assert.equal(state.socialCount,3,tag+': secondary accounts missing');
      assert.equal(state.socialActions,4,tag+': account detail controls missing');
      assert(state.socialLabel.length>0,tag+': primary metric missing');
      assert(state.overflow<=2,tag+': overflow');
      if(width>=900) {
        assert.equal(state.featureVerticalCenter,'center',tag+': feature not vertically centered');
        assert(state.desktopCentered<=25,tag+': feature metric/actions are not centered');
      } else {
        assert.notEqual(state.featureVerticalCenter,'center',tag+': mobile/tablet layout accidentally centered');
      }
      assert.deepEqual(errors,[],tag+': page errors');
      assert.equal(getSafeMediaReport(page).urls.length,0,tag+': attempted ImageKit transfer');
      count++;
      console.log('PASS',tag,'flat platform evidence; balanced social; zero CDN');
    } finally{await page.close();}
  }
}finally{await browser.close();}
console.log('PASS Impact Evidence polish:',count,'width/language combinations');
