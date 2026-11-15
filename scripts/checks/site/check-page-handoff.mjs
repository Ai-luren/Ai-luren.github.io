/* B+C Film → Archive: native optical cut, live minimal/glowing timeline,
   exact history scroll/frame restoration and safe media. */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createSafePage } from '../../lib/safe-media.mjs';

const browserPath = [
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
assert(browserPath, 'Edge/Chrome required');
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5181/';
const browser = await chromium.launch({ executablePath: browserPath, headless: true });

function trace() {
  addEventListener('pagereveal', event => {
    if (!event.viewTransition) return;
    setTimeout(() => {
      const head = document.querySelector('.library-intro');
      sessionStorage.setItem('__p2-qa', JSON.stringify({
        type: [...(event.viewTransition.types || [])],
        animation: getComputedStyle(document.documentElement,
          '::view-transition-new(root)').animationName,
        duration: getComputedStyle(document.documentElement,
          '::view-transition-new(root)').animationDuration,
        heading: head ? getComputedStyle(head).viewTransitionName : null,
        mask: getComputedStyle(document.documentElement,
          '::view-transition-new(root)').maskImage,
        cueOpen: document.querySelector('#portfolio-route-cue')?.matches(':popover-open') || false,
        cueLabel: document.querySelector('#portfolio-route-cue .portfolio-route-cue__label')?.textContent || '',
        cueGlow: document.querySelector('#portfolio-route-cue .portfolio-route-cue__fill')
          ? getComputedStyle(document.querySelector('#portfolio-route-cue .portfolio-route-cue__fill')).boxShadow : '',
        cueProgress: Number(document.querySelector('#portfolio-route-cue .portfolio-route-cue__percent span')?.textContent || 0),
      }));
    }, 60);
  });
}

try {
  for (const [width, height] of [[1440,900], [390,844], [320,700]]) {
    const page = await createSafePage(browser, { viewport: { width, height } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(trace);
    await page.goto(new URL('index.html', base).href, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(650);
    await page.evaluate(() => {
      scrollTo({top:Math.round((document.documentElement.scrollHeight-innerHeight)*.35),behavior:'instant'});
    });
    await page.waitForTimeout(330);
    const before = await page.evaluate(() => ({
      y:scrollY, frame:document.querySelector('#hero-video').currentTime,
    }));
    if (width <= 760) {
      await page.locator('header .nav-toggle').click();
      await page.locator('#mobile-primary-nav a[href="./works.html"]').click({noWaitAfter:true});
    } else {
      await page.locator('#primary-nav a[href="./works.html"]').click({noWaitAfter:true});
    }
    await page.waitForURL('**/works.html',{timeout:8000});
    await page.waitForSelector('.library-grid .comet-archive__item');
    await page.waitForTimeout(750);
    const archive = await page.evaluate(() => ({
      nav:JSON.parse(sessionStorage.getItem('__p2-qa')||'null'),
      backdrop:getComputedStyle(document.querySelector('.work-library'),'::before').backgroundImage,
      background:getComputedStyle(document.querySelector('.work-library')).backgroundColor,
      cards:document.querySelectorAll('.library-grid .comet-archive__item').length,
      videos:document.querySelectorAll('video').length,
      overflow:document.documentElement.scrollWidth-innerWidth,
      flagged:document.documentElement.dataset.archiveArrival,
    }));
    assert(archive.nav?.type.includes('to-archive'),width+'px: missing typed transition');
    assert.equal(archive.nav.animation,'portfolio-optical-in',
      width+'px: native optical scene edit missing');
    assert.equal(archive.nav.duration,'0.66s',width+'px: old 760ms route transition returned');
    assert.equal(archive.nav.heading,'none',width+'px: page content fragmented into separate transition snapshots');
    assert.equal(archive.backdrop,'none',width+'px: ghost city background returned');
    assert(archive.background.includes('11, 12, 15')||archive.background.includes('11, 12, 14'),
      width+'px: archive solid near-black palette changed: '+archive.background);
    assert.equal(archive.nav.mask,'none',
      width+'px: root snapshot must not use a horizontal wipe mask');
    assert.equal(archive.nav.cueOpen,true,
      width+'px: fifth-concept live progress cue not in top layer');
    assert.equal(archive.nav.cueLabel,'加载中',
      width+'px: localized one-line progress label missing');
    assert(archive.nav.cueGlow.includes('rgba(94, 176, 246, 0.42)'),
      width+'px: soft blue glow missing');
    assert.equal(archive.cards,9,width+'px: commercial grid changed');
    assert.equal(archive.videos,0,width+'px: duplicate film plays in library');
    assert.equal(archive.overflow,0,width+'px: horizontal overflow');
    assert.equal(archive.flagged,undefined,width+'px: transition flag leaked');
    await page.locator('.library-filters button[data-category="visual"]').click();
    assert.equal(await page.locator('.library-grid .comet-archive__item').count(),2);
    await page.locator('.library-filters button[data-category="commercial"]').click();
    assert.equal(await page.locator('.library-grid .comet-archive__item').count(),9);
    await page.locator('.library-page-navigation .cinema-player__brand--home-return')
      .click({noWaitAfter:true});
    await page.waitForURL(url => /\/(?:index\.html)?$/.test(new URL(url).pathname));
    await page.waitForTimeout(870);
    const after = await page.evaluate(() => ({
      y:scrollY, frame:document.querySelector('#hero-video').currentTime,
      nav:JSON.parse(sessionStorage.getItem('__p2-qa')||'null'),
    }));
    assert(after.nav?.type.includes('to-film'),width+'px: reverse transition missing');
    assert.equal(after.nav.animation,'portfolio-optical-in',
      width+'px: reverse optical transition missing');
    assert.equal(after.nav.cueLabel,'加载中',
      width+'px: backwards cue must keep the same concise label');
    assert(Math.abs(after.y-before.y)<=15,
      width+'px: previous scroll position not restored '+before.y+' → '+after.y);
    assert(Math.abs(after.frame-before.frame)<.12,width+'px: previous movie frame not restored');
    assert.deepEqual(errors,[],width+'px: JS errors');
    console.log('PASS '+width+'px: B+C optical handoff, single-line soft cue, filters, reverse/scroll');
    await page.close();
  }
  const direct = await createSafePage(browser, {viewport:{width:390,height:844}});
  await direct.goto(new URL('works.html?category=visual',base).href,{waitUntil:'domcontentloaded'});
  await direct.waitForSelector('.library-grid .comet-archive__item');
  assert.equal(await direct.locator('.library-grid .comet-archive__item').count(),2);
  assert.equal(await direct.evaluate(()=>document.documentElement.dataset.archiveArrival),undefined);
  await direct.locator('.library-page-navigation .cinema-player__brand--home-return')
    .click({noWaitAfter:true});
  await direct.waitForURL('**/index.html');
  console.log('PASS direct works link and normal Home navigation');
  await direct.close();

  const reduced = await createSafePage(browser,{viewport:{width:1440,height:900}});
  await reduced.emulateMedia({reducedMotion:'reduce'});
  await reduced.goto(new URL('index.html',base).href,{waitUntil:'domcontentloaded'});
  await reduced.locator('#primary-nav a[href="./works.html"]').click({noWaitAfter:true});
  await reduced.waitForURL('**/works.html');
  await reduced.waitForTimeout(200);
  assert.equal(await reduced.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);
  assert.equal(await reduced.evaluate(()=>document.documentElement.dataset.archiveArrival),undefined);
  console.log('PASS reduced motion fast handoff');
  await reduced.close();
} finally {
  await browser.close();
}
