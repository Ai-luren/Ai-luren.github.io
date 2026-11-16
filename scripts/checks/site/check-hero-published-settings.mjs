// Regression: a visitor with stale local video tuning must see the same
// published Hero as a new visitor; do not fetch ImageKit during the check.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createSafePage } from '../../lib/safe-media.mjs';

const browserPath = [
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
if (!browserPath) throw new Error('Browser unavailable');
const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5181/';
try {
  const results = [];
  for (const hasStaleSettings of [false, true]) {
    const page = await createSafePage(browser, { viewport: { width: 1440, height: 900 } });
    if (hasStaleSettings) {
      await page.addInitScript(() => {
        localStorage.setItem('ailuren-hero-mask-v2', '5');
        localStorage.setItem('ailuren-video-tuning-v18', JSON.stringify({
          brightness: 5, saturation: 0, pixelMaster: 100, crtMaster: 100,
          vignette: 0, glow: 99,
        }));
      });
    }
    await page.goto(new URL('index.html', base).href, { waitUntil: 'domcontentloaded' });
    const settings = await page.evaluate(() => ({
      mask: getComputedStyle(document.documentElement).getPropertyValue('--hero-mask-strength').trim(),
      saturation: getComputedStyle(document.documentElement).getPropertyValue('--video-saturation').trim(),
      brightness: getComputedStyle(document.documentElement).getPropertyValue('--video-brightness').trim(),
      settings: window.__videoTuning,
      legacyEditorPresent: !!document.querySelector('#video-tuner'),
      copyMaskDisplay: getComputedStyle(document.querySelector('#top .hero-copy'), '::before').display,
    }));
    assert.equal(settings.legacyEditorPresent, false);
    results.push(settings);
    await page.close();
  }
  assert.deepEqual(results[0], results[1], 'Stale browser localStorage changed published Hero');
  assert.equal(results[0].mask, '0.60');
  assert.equal(results[0].brightness, '0.63');
  assert.equal(results[0].saturation, '0.80');
  assert.equal(results[0].settings.vignette, 0, 'Global WebGL vignette must not create black edge masks');
  assert.equal(results[0].copyMaskDisplay, 'none', 'Hero copy must not add an element-sized rectangular gradient over the video');
  // The seam was most visible on widescreen desktop and can also occur on phones;
  // verify the real final cascade, not the presence of an earlier display:none rule.
  for (const viewport of [{ width: 390, height: 844 }, { width: 1704, height: 960 }]) {
    const page = await createSafePage(browser, { viewport });
    await page.goto(new URL('index.html', base).href, { waitUntil: 'domcontentloaded' });
    const maskDisplay = await page.locator('#top .hero-copy').evaluate(
      element => getComputedStyle(element, '::before').display,
    );
    assert.equal(maskDisplay, 'none', 'Rectangular Hero copy overlay reappeared at width ' + viewport.width);
    await page.close();
  }
  // P1 cinematic story contract: align real film beats to the moment each
  // chapter FIRST enters the viewport, not its document top (which can be
  // beyond the maximum scroll). Do not split the two Featured rows merely
  // to force more background video between the cards.
  for (const viewport of [
    { width: 1440, height: 900, mobile: false },
    { width: 390, height: 844, mobile: true },
  ]) {
    const page = await createSafePage(browser, { viewport });
    await page.goto(new URL('index.html', base).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('#projects .comet-archive__item').length >= (innerWidth > 720 ? 8 : 4), { timeout: 12000 });
    await page.waitForTimeout(400);
    const timeline = await page.evaluate(() => {
      const video = document.getElementById('hero-video');
      const max = document.documentElement.scrollHeight - innerHeight;
      const cue = document.getElementById('hero-scroll-guide');
      const entrySecond = selector => {
        const element = document.querySelector(selector);
        const top = element.getBoundingClientRect().top + scrollY;
        return Math.max(0, (top - innerHeight) / max * video.duration);
      };
      // A+ cards no longer carry their own row padding: the archive grid
      // owns the vertical breathing room via row-gap.
      const featuredGrid = document.querySelector('#projects .comet-archive');
      return {
        cueText: cue?.innerText,
        cueVisible: getComputedStyle(cue).visibility,
        cuePointer: getComputedStyle(cue).pointerEvents,
        cueLinks: cue?.querySelectorAll('a,button').length,
        videoDuration: video.duration,
        featuredRowBreath: parseFloat(getComputedStyle(featuredGrid).rowGap),
        times: {
          projects: entrySecond('#projects .comet-archive'),
          expertise: entrySecond('#recognition'),
          lab: entrySecond('#experiments'),
          about: entrySecond('#profile'),
        },
      };
    });
    assert(timeline.videoDuration > (viewport.mobile ? 13.7 : 14.8) && timeline.videoDuration < (viewport.mobile ? 13.9 : 15.3),
      'Unexpected mobile optical dissolve / desktop scroll-driven film duration');
    assert.equal(timeline.cueVisible, 'visible', 'P1 first-screen scroll cue is missing');
    assert.equal(timeline.cuePointer, 'none', 'Scroll instruction must never block interaction');
    assert.equal(timeline.cueLinks, 0, 'Scroll cue must not jump past the film');
    // The hint must descend along the Y axis, not slide laterally during
    // refresh/font hydration. Arrow cadence is deliberately shorter than
    // the retired 2.5s cycle without adding lateral/repeated movement.
    const cueMotion = await page.evaluate(() => {
      const el = document.getElementById('hero-scroll-guide');
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      const label = el.querySelector(innerWidth<=760
        ? '.hero-scroll-guide__mobile' : '.hero-scroll-guide__desktop');
      const rect = label.getBoundingClientRect();
      const arrow = getComputedStyle(el.querySelector('svg'));
      return {left:box.left,right:box.right,textMid:rect.left+rect.width/2,
        x:new DOMMatrixReadOnly(style.transform).m41,
        arrowDuration:arrow.animationDuration,arrowAnimation:arrow.animationName,
        opacityDuration:style.transitionDuration.split(',')[0].trim()};
    });
    assert(Math.abs(cueMotion.left)<1 && Math.abs(cueMotion.right-viewport.width)<1,
      'Hero guide must use a full-width center anchor, not translateX(-50%)');
    assert(Math.abs(cueMotion.textMid-viewport.width/2)<1,
      'Hero guide label must remain horizontally centered while appearing');
    assert.equal(cueMotion.x,0,'Hero guide must not animate horizontally');
    assert.equal(cueMotion.arrowAnimation,'hero-scroll-cue-drift');
    assert.equal(cueMotion.arrowDuration,'1.8s','Hero chevron should not drift on a slow 2.5s loop');
    assert.equal(cueMotion.opacityDuration,'0.28s','Cue entry should be restrained and responsive');
    if (!viewport.mobile) {
      assert(timeline.cueText.includes('向下滚动'), 'Desktop scroll instruction missing');
      assert(timeline.featuredRowBreath >= 16 && timeline.featuredRowBreath <= 28,
        'Featured card grid rows should keep a restrained 16-28px gap');
      assert(timeline.times.projects >= 1.5 && timeline.times.projects <= 3,
        'First works cards should enter during city/building flight');
      assert(timeline.times.expertise >= 5.5 && timeline.times.expertise <= 8,
        'Expertise should enter during spaceship-to-industrial transition');
      assert(timeline.times.lab >= 10 && timeline.times.lab <= 12.5,
        'Lab should enter during the ring/cloud city reveal');
      assert(timeline.times.about >= 13 && timeline.times.about <= 14.8,
        'Contact should enter near the final cloud city shot');
    } else {
      assert(timeline.cueText.includes('上滑探索'), 'Mobile swipe instruction missing');
    }
    // A guide is a contextual instruction, not a one-time dismissal. It
    // disappears outside the Hero and returns when visitors scroll back.
    await page.evaluate(() => scrollTo({
      top: document.getElementById('projects').offsetTop + 200,
      behavior: 'instant',
    }));
    await page.waitForTimeout(440);
    const away = await page.evaluate(() => ({
      state: document.getElementById('hero-scroll-guide').dataset.visible,
      opacity: getComputedStyle(document.getElementById('hero-scroll-guide')).opacity,
    }));
    assert.equal(away.state, 'false', 'Guide must hide outside Hero');
    assert(+away.opacity < .1, 'Hidden guide must not linger over works');
    const hiddenMotion = await page.locator('#hero-scroll-guide').evaluate(el => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      return {x:matrix.m41,y:matrix.m42};
    });
    assert(Math.abs(hiddenMotion.x)<0.01 && Math.abs(hiddenMotion.y+9)<0.1,
      'Off-Hero pose must sit 9px above final position, with no X displacement');
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(440);
    assert.equal(await page.locator('#hero-scroll-guide').getAttribute('data-visible'),
      'true', 'Guide must return on Hero revisit');
    if (!viewport.mobile) {
      const scrollRail = await page.evaluate(() => {
        const line = document.querySelector('.scroll-rail');
        return {
          width: getComputedStyle(line).width,
          gradient: getComputedStyle(line.firstElementChild).backgroundImage,
          glow: getComputedStyle(line.firstElementChild).boxShadow,
        };
      });
      assert.equal(scrollRail.width, '2px', 'Right rail thickness must match loading bar');
      assert(scrollRail.gradient.includes('linear-gradient'), 'Right rail blue gradient missing');
      assert(scrollRail.glow.includes('rgba(94, 176, 246, 0.42)'), 'Rail must use soft loading glow');
    }
    console.log('PASS P1 story rhythm '+viewport.width+'px: '+JSON.stringify(timeline.times)
      +' (featured row breathing '+timeline.featuredRowBreath+'px)');
    await page.close();
  }
  console.log('PASS: identical published Hero settings, cinematic scroll discovery and chapter-to-film timing');
} finally {
  await browser.close();
}
