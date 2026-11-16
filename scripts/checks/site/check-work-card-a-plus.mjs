// Layout invariants are measured without foreground reveal transforms;
// the cinematic suite separately tests motion and its interactions.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createSafePage } from '../../lib/safe-media.mjs';

// A+ regression: shared full-card glass surface, image-first reading order,
// compact caption, optical play-icon centering and no accidental hover overlay.
const binary='/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
const base=process.env.PORTFOLIO_URL || 'http://127.0.0.1:5174/';
const browser=await chromium.launch({executablePath:binary,headless:true});
try {
  for(const width of [320,390,721,1440]){
    for(const lang of ['zh','en']){
      for(const pageName of ['home','works']){
        const page=await createSafePage(browser,{viewport:{width,height:900},reducedMotion:'reduce'});
        const tag=width+'px '+lang+' '+pageName;
        const errors=[];page.on('pageerror',error=>errors.push(error.message));
        await page.addInitScript(value=>localStorage.setItem('ailuren-lang',value),lang);
        await page.goto(new URL(pageName==='home'?'index.html#projects':'works.html',base).href,{waitUntil:'domcontentloaded'});
        const scope=pageName==='home'?'#projects':'.work-library';
        const cards=page.locator(scope+' .portfolio-work-card--unified');
        await cards.first().waitFor();
        await cards.first().scrollIntoViewIfNeeded();
        const info=await cards.evaluateAll(cards=>cards.map(card=>{
          const image=card.querySelector('.comet-archive__image');
          const title=card.querySelector('.comet-archive__title');
          const detail=card.querySelector('.comet-archive__details');
          const badge=image.querySelector('.comet-archive__play-badge');
          const svg=badge.querySelector('svg');
          const rect=el=>el.getBoundingClientRect();
          const surface=getComputedStyle(card),art=getComputedStyle(image);
          const bb=rect(badge),icon=svg?rect(svg):null,box=rect(card),im=rect(image),
            titleBox=rect(title),detailBox=rect(detail);
          return {
            cardId:card.dataset.projectId,
            outerRadius:surface.borderRadius,material:surface.backgroundColor,blur:surface.backdropFilter,
            outerBorder:surface.borderTopWidth,artRadius:art.borderRadius,artBorder:art.borderTopWidth,
            artShadow:art.boxShadow,artRatio:art.aspectRatio,artOverlay:getComputedStyle(image,'::after').display,
            order:im.bottom<titleBox.top+.5&&titleBox.bottom<=detailBox.top+.5,
            captionBottom:box.bottom-detailBox.bottom,gap:detailBox.top-titleBox.bottom,
            badgeCentered:icon?Math.abs((bb.left+bb.right-icon.left-icon.right)/2)<=.65 &&
              Math.abs((bb.top+bb.bottom-icon.top-icon.bottom)/2)<=.65:true,
            path:svg?.querySelector('path')?.getAttribute('d'),
            posterX:im.x,posterY:im.y,posterW:im.width,posterH:im.height,
            top:box.top,detailBottom:detailBox.bottom,
            titleText:title.textContent?.trim(),titleWrap:getComputedStyle(title).wordBreak,
            titleMixed:title.classList.contains('comet-archive__title--mixed-latin-cjk'),
            titleOverflow:title.scrollWidth-title.clientWidth,
          };
        }));
        assert(info.length>=4,tag+': cards missing');
        for(const item of info){
          assert.equal(item.outerBorder,'1px',tag+': missing unified border');
          assert.equal(item.material,'rgba(24, 26, 31, 0.33)',tag+': wrong shared glass');
          assert.equal(item.outerRadius,width<=720?'14px':'18px',tag+': outer radius');
          assert.equal(item.artRadius,width<=720?'9px':'12px',tag+': inset art radius');
          assert.equal(item.artBorder,'0px',tag+': duplicate image border');
          assert.equal(item.artShadow,'none',tag+': duplicate image shadow');
          assert.equal(item.artOverlay,'none',tag+': image overlay returned');
          assert.equal(item.artRatio,'3 / 4',tag+': artwork ratio');
          assert(item.order,tag+': image / title / classification order reversed on '+item.cardId);
          assert(item.captionBottom>=7&&item.captionBottom<=19,tag+': oversized card footer '+item.captionBottom);
          assert(item.gap>=3.5&&item.gap<=45,tag+': title/category gap out of range');
          assert(item.badgeCentered,tag+': play SVG off center '+item.cardId);
          // Short-video feeds benefit from a scannable cover title. Keep
          // Latin brand + Chinese title as intact semantic units on narrow
          // two-column cards rather than a lone Chinese glyph on line two.
          const mixed = lang==='zh' && /^[A-Za-z][A-Za-z0-9.+&-]*\s+[\u3400-\u9fff]/u.test(item.titleText);
          assert.equal(item.titleMixed,mixed,tag+': mixed-script title class');
          if(width<=720&&mixed)assert.equal(item.titleWrap,'keep-all',tag+': semantic word grouping');
          assert(item.titleOverflow<=1,tag+': clipped/overflowing title '+item.cardId);

          if(item.path)assert.equal(item.path,'M9 6.5 18 12 9 17.5Z',tag+': play icon geometric centroid changed');
        }
        const columns=pageName==='home'?(width<=720?2:4):(width>=1280?4:width>=900?3:2);
        for(let i=0;i<info.length;i+=columns){
          const row=info.slice(i,i+columns);
          const max=Math.max(...row.map(x=>x.detailBottom)),
            min=Math.min(...row.map(x=>x.detailBottom));
          assert(max-min<=1.5,tag+': category baselines not aligned in row '+i);
        }
        if(width===390 || width===1440){
          const card=cards.first(),img=card.locator('.comet-archive__image');
          const original=await img.evaluate(el=>getComputedStyle(el).boxShadow);
          await card.hover();
          await page.waitForTimeout(140);
          // A changing hash position or a late cover decode can move the
          // pointer between scrollIntoView and the final hover sampling.
          // Check real CSS :hover, then reacquire the target if necessary.
          if(!(await card.evaluate(el=>el.matches(':hover')&&el.parentElement.matches(':hover')))) {
            await card.hover();
          }
          await page.waitForTimeout(300);
          const after=await card.evaluate(el=>({
            cardBorder:getComputedStyle(el).borderColor,
            imgShadow:getComputedStyle(el.querySelector('.comet-archive__image')).boxShadow
          }));
          assert.equal(after.cardBorder,'rgba(205, 227, 245, 0.46)',tag+': hover should outline entire card');
          assert.equal(after.imgShadow,original,tag+': hover must not add inner shadow');
        }
        assert.deepEqual(errors,[],tag+': JavaScript errors');
        await page.close();
        console.log('PASS '+tag+': unified glass, card proportions, caption alignment, centered play');
      }
    }
  }
  console.log('PASS A+ shared card QA: 4 widths × 2 languages × 2 pages');
} finally {
  await browser.close();
}