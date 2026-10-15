import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const executablePath = ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
const browser = await chromium.launch({ executablePath, headless: true });
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5181/';
const screenshots = process.env.CINEMA_SCREENSHOTS;
if (screenshots) mkdirSync(screenshots, { recursive: true });
const sizes = [[1440,900],[1920,1080],[360,640],[375,667],[393,852],[430,932],[393,640],[852,393]];
async function measure(page) {
  await page.waitForTimeout(250);
  return page.evaluate(() => {
    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}; };
    const video = document.querySelector('.cinema-player video');
    const layoutStyle = getComputedStyle(document.querySelector('.cinema-player__layout'));
    const stage = document.querySelector('.cinema-player__stage').getBoundingClientRect();
    return {paddingTop:parseFloat(layoutStyle.paddingTop),paddingBottom:parseFloat(layoutStyle.paddingBottom),stage:rect('.cinema-player__stage'), caption:rect('.cinema-player__caption'), title:rect('.cinema-player__caption h2'), play:rect('.cinema-player__play'), close:rect('.cinema-player__close'), body:rect('.cinema-player__body'),scrollHeight:document.querySelector('.cinema-player').scrollHeight, ratio:stage.width/stage.height, paused:video.paused, time:video.currentTime, hasSource:video.hasAttribute('src'), readyState:video.readyState, bg:getComputedStyle(document.querySelector('.cinema-player')).backgroundColor, prompt:document.querySelector('.cinema-player__start').textContent.trim(), viewport:[innerWidth,innerHeight], overflow:document.querySelector('.cinema-player').scrollWidth > innerWidth};
  });
}
function check(m) {
  assert(m.paused && m.time === 0);
  assert(!m.hasSource && m.readyState === 0, 'Opening a film must not request video bytes');
  assert.equal(m.prompt,'');
  assert.equal(m.bg,'rgba(0, 0, 0, 0)');
  assert(!m.overflow);
  assert(Math.abs(m.stage.width/m.stage.height-m.ratio)<0.005);
  assert(Math.abs(m.stage.x-m.caption.x)<1);
  assert(m.caption.width<=m.stage.width+1);
  assert(Math.abs(m.title.x-m.stage.x)<1);
  assert(m.caption.y-m.stage.bottom >= 12 && m.caption.y-m.stage.bottom <= 20);
  assert(m.stage.x>=0 && m.stage.right<=m.viewport[0]+1);
  assert(m.body.bottom<=m.viewport[1]+1 || m.scrollHeight>=m.body.bottom-1, 'Overflowing information must remain reachable by modal scrolling');
  assert(m.close.x>=0 && m.close.right<=m.viewport[0] && m.close.y>=0 && m.close.bottom<=m.viewport[1]);
  assert(m.stage.y>=m.close.bottom+8);
  assert(Math.abs(m.play.x+m.play.width/2-(m.stage.x+m.stage.width/2))<1);
  assert(Math.abs(m.play.y+m.play.height/2-(m.stage.y+m.stage.height/2))<1);
}
try {
  for (const [width,height] of sizes) {
    const page = await browser.newPage({viewport:{width,height}});
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
