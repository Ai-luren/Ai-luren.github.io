/** Regression: mouse pan in Lab, wide social proof index, and synthetic focus. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createSafePage } from '../../lib/safe-media.mjs';
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5174/';
const browser = await chromium.launch({headless:true, executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
try {
  for (const width of [390, 760, 1024, 1280, 1440, 1920]) {
    for (const lang of ['zh', 'en']) {
      const page = await createSafePage(browser, {viewport:{width,height:width===390?844:1080}});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(l=>localStorage.setItem('ailuren-lang',l),lang);
      try {
        await page.goto(new URL('index.html',base).href,{waitUntil:'domcontentloaded'});
        await page.locator('#impact-reach [data-social-profile-trigger="douyin"]').click();
        const modal=page.locator('.impact-profile-lightbox');await modal.waitFor({state:'visible'});
        const index=modal.locator('.impact-profile-index');
        const isIndexVisible=await index.isVisible();
        assert.equal(isIndexVisible,width>=1280,`${width}/${lang}: index breakpoint`);
        if (width>=1280) {
          const buttons=index.locator('.impact-profile-index-item');
          assert.equal(await buttons.count(),4);
          assert.equal(await buttons.nth(0).getAttribute('aria-pressed'),'true');
          const before=await modal.locator('.impact-profile-dialog-image').evaluateAll(imgs=>imgs.map(e=>e.getAttribute('src')));
          await buttons.nth(1).click();
          await page.waitForFunction(()=>document.querySelector('#impact-profile-dialog-title')?.textContent ===
            (localStorage.getItem('ailuren-lang')==='en'?'Xiaohongshu':'小红书'),null,{timeout:8000}).catch(()=>{});
          await page.waitForTimeout(130);
          const after=await modal.locator('.impact-profile-dialog-image').evaluateAll(imgs=>imgs.map(e=>e.getAttribute('src')));
          assert(after[0]!==before[0]&&after[1]!==before[1],`${width}/${lang}: index must switch screenshot AND QR`);
          assert.equal(await buttons.nth(1).getAttribute('aria-pressed'),'true');
          assert((await modal.locator('.impact-profile-pagination-count').textContent()).includes('2 / 4'));
          await modal.locator('.impact-profile-pagination-arrow').last().click();
          await page.waitForTimeout(130);
          assert.equal(await buttons.nth(2).getAttribute('aria-pressed'),'true',`${width}/${lang}: arrows and index must stay in sync`);
          const size=await modal.locator('.impact-profile-dialog').evaluate(e=>{
            const r=e.getBoundingClientRect();return {w:r.width,h:r.height,x:r.x,y:r.y,overflow:document.documentElement.scrollWidth-innerWidth};
          });
          assert(size.overflow<3&&size.x>=0&&size.x+size.w<=width+1,`${width}/${lang}: dialog overflow ${JSON.stringify(size)}`);
        }
        if(lang==='zh'&&[390,1440,1920].includes(width))
          await page.screenshot({path:`.audit/qa-profile-polish-20261116/social-${width}.png`});
        await page.keyboard.press('Escape');await modal.waitFor({state:'detached'});
        assert.deepEqual(errors,[],`${width}/${lang} pageerrors`);
        console.log('PASS_SOCIAL_INDEX',width,lang);
      } finally {await page.close();}
    }
  }
  for(const width of [390,1440]){
    const p=await createSafePage(browser,{viewport:{width,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.goto(new URL('index.html',base).href,{waitUntil:'domcontentloaded'});
    await p.locator('#experiments .flip-experiment__detail').first().click();
    await p.locator('.lab-project-lightbox').waitFor({state:'visible'});
    await p.locator('.lab-project-image-zoom').click();
    const canvas=p.locator('.lab-project-image-canvas.is-zoomed');const box=await canvas.boundingBox();
    const before=await canvas.evaluate(e=>({left:e.scrollLeft,top:e.scrollTop,available:e.scrollWidth-e.clientWidth}));
    assert(before.available>100,`Lab image is actually enlargeable ${width}`);
    await p.mouse.move(box.x+box.width*.72,box.y+box.height*.6);
    await p.mouse.down();
    await p.mouse.move(box.x+box.width*.3,box.y+box.height*.3,{steps:7});
    const during=await canvas.evaluate(e=>({left:e.scrollLeft,top:e.scrollTop,dragging:e.classList.contains('is-dragging')}));
    await p.mouse.up();
    const after=await canvas.evaluate(e=>({left:e.scrollLeft,top:e.scrollTop,dragging:e.classList.contains('is-dragging')}));
    assert(during.left>before.left+50 && during.top>before.top+20,`${width}: mouse drag did not pan image ${JSON.stringify({before,during,after})}`);
    assert(!after.dragging&&after.left===during.left,`${width}: pointer capture not released`);
    const srcBefore=await canvas.locator('img').getAttribute('src');
    await p.keyboard.press('ArrowRight');
    const nextLeft=await canvas.evaluate(e=>e.scrollLeft);
    assert(nextLeft>after.left,`${width}: keyboard panning must scroll`);
    assert.equal(await canvas.locator('img').getAttribute('src'),srcBefore,'ArrowRight must not switch projects while zoomed');
    if(width===1440)await p.screenshot({path:'.audit/qa-profile-polish-20261116/lab-mouse-pan-1440.png'});
    await p.keyboard.press('Escape');
    assert.equal(await p.locator('.lab-project-image-canvas.is-zoomed').count(),0,'first Escape returns fit');
    await p.keyboard.press('Escape');await p.locator('.lab-project-lightbox').waitFor({state:'detached'});
    assert.deepEqual(errors,[]);console.log('PASS_LAB_MOUSE_PAN',width,JSON.stringify({before,during,after,nextLeft}));await p.close();
  }
  for (const width of [390,1440]) {
    const p=await createSafePage(browser,{viewport:{width,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.goto(new URL('works.html?watch=05',base).href,{waitUntil:'domcontentloaded'});
    await p.locator('.cinema-player[open]').waitFor({state:'visible'});
    const close=p.locator('.cinema-player__close').first();
    const initial=await close.evaluate(e=>({focused:e===document.activeElement,focusVisible:e.matches(':focus-visible'),outline:getComputedStyle(e).outlineStyle,synthetic:e.hasAttribute('data-initial-auto-focus')}));
    assert(initial.focused&&initial.synthetic&&initial.outline==='none',`${width}: initial focus ring must be hidden, focus retained ${JSON.stringify(initial)}`);
    if(width===1440)await p.screenshot({path:'.audit/qa-profile-polish-20261116/direct-link-no-ring-1440.png'});
    await p.keyboard.press('Tab');
    assert.equal(await close.getAttribute('data-initial-auto-focus'),null,'Tab restores standard focus rules');
    const keyboard=await p.evaluate(()=>({name:document.activeElement?.tagName,visible:document.activeElement?.matches(':focus-visible'),outline:getComputedStyle(document.activeElement).outlineStyle}));
    assert(keyboard.visible&&keyboard.outline!=='none',`${width}: Tab must show a focus ring ${JSON.stringify(keyboard)}`);
    assert.deepEqual(errors,[]);console.log('PASS_CINEMA_FOCUS',width,JSON.stringify({initial,keyboard}));
    await p.close();
  }
} finally { await browser.close(); }
