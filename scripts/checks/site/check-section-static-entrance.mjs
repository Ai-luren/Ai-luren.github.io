import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createSafePage } from '../../lib/safe-media.mjs';

const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5174/';
const browser = await chromium.launch({
  executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  headless: true
});
const targets = {
  featuredTitle: '#projects .section-intro',
  featuredGrid: '#projects .motion-stage',
  expertiseTitle: '#recognition .section-intro',
  expertiseBody: '#recognition .recognition-react-root',
  labTitle: '#experiments .section-intro',
  aboutTitle: '#profile .closing-about .section-intro',
  aboutBody: '#profile .about-copy',
  contactTitle: '#profile .footer-contact-copy h2',
  contactCopy: '#profile .footer-contact-copy > p',
  contactInfo: '#profile .footer-contact-direct',
  footerDock: '#footer-dock-react-root .floating-dock-shell'
};

try {
  for (const width of [320, 390, 820, 1440]) {
    for (const lang of ['zh', 'en']) {
      const page = await createSafePage(browser, { viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(value => localStorage.setItem('ailuren-lang', value), lang);
      await page.goto(new URL('index.html#top', base).href, { waitUntil: 'domcontentloaded' });
      await page.locator('#projects .portfolio-work-card--unified').first().waitFor({ state: 'attached' });
      await page.locator('#profile .floating-dock-shell').first().waitFor({ state: 'attached' });
      await page.waitForFunction(() => Boolean(window.gsap && window.ScrollTrigger));

      const inspect = async () => page.evaluate(selectors => {
        const read = selector => {
          const el = document.querySelector(selector);
          if (!el) return null;
          const style = getComputedStyle(el);
          return {
            reveal: el.classList.contains('reveal'),
            opacity: Number(style.opacity),
            transform: style.transform,
            gsapTweens: window.gsap?.getTweensOf(el)?.length ?? 0,
            visible: style.visibility
          };
        };
        return {
          state: Object.fromEntries(Object.entries(selectors).map(([name, selector]) => [name, read(selector)])),
          legacyReveals: document.querySelectorAll(
            '#projects .reveal, #recognition .reveal, #experiments .reveal, #profile .reveal'
          ).length,
          heroRevealCount: document.querySelectorAll('#top .reveal').length,
          overflow: document.documentElement.scrollWidth - window.innerWidth
        };
      }, targets);

      for (const stage of ['before-scroll', 'after-scroll']) {
        if (stage === 'after-scroll') {
          for (const selector of ['#projects', '#recognition', '#experiments', '#profile']) {
            await page.evaluate(sel => {
              const el = document.querySelector(sel);
              window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 120, behavior: 'instant' });
            }, selector);
            await page.waitForTimeout(90);
          }
        }

        const data = await inspect();
        const tag = width + 'px ' + lang + ' ' + stage;
        assert.equal(data.legacyReveals, 0, tag + ': legacy section reveal class remains');
        assert(data.heroRevealCount > 0, tag + ': Hero reveal accidentally removed');
        assert(data.overflow <= 2, tag + ': page horizontal overflow');
        for (const [name, state] of Object.entries(data.state)) {
          assert(state, tag + ': missing ' + name);
          assert.equal(state.reveal, false, tag + ': ' + name + ' has reveal class');
          assert.equal(state.opacity, 1, tag + ': ' + name + ' fades in');
          assert.equal(state.gsapTweens, 0, tag + ': ' + name + ' has entry tween');
          assert.equal(state.transform, 'none', tag + ': ' + name + ' slides in');
          assert.equal(state.visible, 'visible', tag + ': ' + name + ' is hidden');
        }
        assert.deepEqual(errors, [], tag + ': JS errors');
      }

      await page.close();
      console.log('PASS static entrances removed:', width, lang);
    }
  }

  // The Works page shares the design system, but its card/player interactions
  // and thumbnail loading remain unchanged by the homepage-only removal.
  for (const width of [390, 1440]) {
    const page = await createSafePage(browser, { viewport: { width, height: 900 } });
    await page.goto(new URL('works.html', base).href, { waitUntil: 'domcontentloaded' });
    await page.locator('.library-grid .portfolio-work-card--unified').first().waitFor({ state: 'attached' });
    const count = await page.locator('.library-grid .portfolio-work-card--unified').count();
    assert(count > 0, width + ': Works page cards missing');
    await page.close();
  }
  console.log('PASS: 8 viewport/language cases, static content, Hero preserved, Works gallery still present.');
} finally {
  await browser.close();
}
