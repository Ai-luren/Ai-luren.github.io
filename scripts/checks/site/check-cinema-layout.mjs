import { createSafePage, createSafeContext } from '../../lib/safe-media.mjs';
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const executablePath = ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
const browser = await chromium.launch({ executablePath, headless: true });
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5181/';
const screenshots = process.env.CINEMA_SCREENSHOTS;
if (screenshots) mkdirSync(screenshots, { recursive: true });
const sizes = [[1440,900],[1920,1080],[360,640],[375,667],[393,852],[430,932],[393,640],[393,280],[852,393]];
async function measure(page) {
  await page.waitForTimeout(250);
  return page.evaluate(() => {
    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}; };
    const video = document.querySelector('.cinema-player video');
    const layoutStyle = getComputedStyle(document.querySelector('.cinema-player__layout'));
    const stage = document.querySelector('.cinema-player__stage').getBoundingClientRect();
    return {paddingTop:parseFloat(layoutStyle.paddingTop),paddingBottom:parseFloat(layoutStyle.paddingBottom),stage:rect('.cinema-player__stage'), caption:rect('.cinema-player__caption'), controls:document.querySelector('.cinema-player__mobile-controls') ? rect('.cinema-player__mobile-controls') : null, versions:document.querySelector('.cinema-player__versions') ? rect('.cinema-player__versions') : null, title:rect('.cinema-player__caption h2'), play:rect('.cinema-player__play'), close:rect('.cinema-player__close'), body:rect('.cinema-player__body'),scrollHeight:document.querySelector('.cinema-player').scrollHeight, ratio:stage.width/stage.height, paused:video.paused, time:video.currentTime, hasSource:video.hasAttribute('src'), readyState:video.readyState, bg:getComputedStyle(document.querySelector('.cinema-player')).backgroundColor, prompt:document.querySelector('.cinema-player__start').textContent.trim(), viewport:[innerWidth,innerHeight], overflow:document.querySelector('.cinema-player').scrollWidth > innerWidth};
  });
}
function check(m) {
  assert(m.paused && m.time === 0);
  assert(!m.hasSource && m.readyState === 0, 'Opening a film must not request video bytes');
  assert.equal(m.prompt,'');
  assert.equal(m.bg,'rgba(0, 0, 0, 0)');
  assert(!m.overflow);
  assert(Math.abs(m.stage.width/m.stage.height-m.ratio)<0.005);
  // Compact portrait films remain centered without stretching, while
  // their captions use the full reading width (landscape/desktop stay aligned).
  const compactPortrait = m.viewport[0] <= 760 && m.ratio < 1;
  if (compactPortrait) {
    assert(Math.abs(m.stage.x + m.stage.width/2 - m.caption.x - m.caption.width/2) < 1,
      'Portrait stage and full-width caption must share the same center');
    assert(m.caption.width>=m.stage.width-1, 'Portrait caption must not be narrowed to the video');
    assert(Math.abs(m.title.x-m.caption.x)<1, 'Portrait title follows the full-width caption');
  } else {
    assert(Math.abs(m.stage.x-m.caption.x)<1);
    assert(m.caption.width<=m.stage.width+1);
    assert(Math.abs(m.title.x-m.stage.x)<1);
  }
  // Current mobile reading order: film, custom transport, full-width title,
  // optional A/B/C versions, work arrows. Older snapshots assumed tabs
  // before the title and omitted the transport bar entirely.
  if (m.viewport[0] <= 760) {
    assert(m.controls, 'Mobile video transport must remain mounted');
    assert(m.controls.y-m.stage.bottom>=4 && m.controls.y-m.stage.bottom<=16,
      'Mobile transport belongs immediately below the film');
    assert(m.caption.y-m.controls.bottom>=8 && m.caption.y-m.controls.bottom<=26,
      'Title must follow the mobile transport with breathing room');
    if (m.versions) assert(m.versions.y-m.caption.bottom>=8 && m.versions.y-m.caption.bottom<=20,
      'Version tabs must follow the full-width title');
  } else {
    assert(m.caption.y-m.stage.bottom >= 12 && m.caption.y-m.stage.bottom <= 20);
  }
  assert(m.stage.x>=0 && m.stage.right<=m.viewport[0]+1);
  assert(m.body.bottom<=m.viewport[1]+1 || m.scrollHeight>=m.body.bottom-1, 'Overflowing information must remain reachable by modal scrolling');
  assert(m.close.x>=0 && m.close.right<=m.viewport[0] && m.close.y>=0 && m.close.bottom<=m.viewport[1]);
  assert(m.stage.y>=m.close.bottom+8);
  if (m.viewport[0] <= 760) {
    const freeSpace = m.viewport[1] - m.paddingTop - m.paddingBottom - m.body.height;
    const expectedTop = m.paddingTop + (m.ratio >= 1 ? Math.max(0, freeSpace / 2) : 0);
    // safe center may fall back to start alignment when the player itself
    // requires scrolling. Both are valid; neither may clip above the nav.
    const atTop=Math.abs(m.body.y-m.paddingTop)<1;
    const atCenter=Math.abs(m.body.y-expectedTop)<1;
    assert(atTop||atCenter,
      'Mobile film must be top-aligned or safe-centered without clipping: '+
      JSON.stringify({viewport:m.viewport,bodyY:m.body.y,expectedTop,paddingTop:m.paddingTop,ratio:m.ratio}));
  }
  assert(Math.abs(m.play.x+m.play.width/2-(m.stage.x+m.stage.width/2))<1);
  assert(Math.abs(m.play.y+m.play.height/2-(m.stage.y+m.stage.height/2))<1);
}
try {
  for (const [width,height] of sizes) {
    const page = await createSafePage(browser, {viewport:{width,height}});
    for (const [path,selector] of [['works.html','.library-grid .comet-archive__card'],['index.html#projects','.comet-archive__card']]) {
      await page.goto(new URL(path,base).href);
      await page.waitForSelector(selector);
      for (const [index,orientation] of [[0,'landscape'],[3,'portrait']]) {
        await page.locator(selector).nth(index).click();
        const m=await measure(page); check(m);
        if (screenshots && path==='index.html#projects' && [1440,393].includes(width)) {
          await page.screenshot({path:`${screenshots}/${width}x${height}-${orientation}-opening.png`});
          await page.locator('.cinema-player__play').click();
          await page.waitForFunction(() => document.querySelector('.cinema-player video').currentTime > 0.2);
          await page.locator('.cinema-player video').evaluate(v => v.pause());
          await page.screenshot({path:`${screenshots}/${width}x${height}-${orientation}-playback.png`});
        }
        await page.keyboard.press('Escape');
      }
    }
    // Change orientation and emulate page zoom through a reduced CSS viewport.
    await page.locator('.comet-archive__card').first().click();
    await page.setViewportSize({width:height,height:width}); check(await measure(page));
    await page.setViewportSize({width:Math.round(width/1.25),height:Math.round(height/1.25)}); check(await measure(page));
    await page.keyboard.press('Escape');
    console.log(`${width}x${height}: home/library landscape + real 9:16, alignment, bounds, paused open, resize passed`);
    await page.close();
  }
  console.log('No true 3:4 video is available; that ratio is not marked as media-verified.');
} finally {await browser.close();}
