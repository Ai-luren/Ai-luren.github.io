import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createSafePage, getSafeMediaReport } from './lib/safe-media.mjs';

const browser = await chromium.launch({ executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', headless: true });
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5174/';
try {
  for (const [width, lang] of [[320,'zh'],[390,'zh'],[390,'en'],[744,'zh'],[1440,'zh'],[1440,'en']]) {
    const touch = width < 800;
    const page = await createSafePage(browser, { viewport: { width, height: 900 }, hasTouch: touch });
    await page.addInitScript(value => localStorage.setItem('ailuren-lang',value), lang);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base+'index.html#experiments', { waitUntil:'domcontentloaded' });
    await page.locator('#experiments').scrollIntoViewIfNeeded();

    assert.equal(await page.locator('.flip-experiment__row').count(),3);
    assert.equal(await page.locator('.flip-experiment__detail').count(),3);
    await page.locator('.flip-experiment__detail').nth(1).click();
    const lab = page.locator('.lab-project-lightbox');
    await lab.waitFor({state:'visible'});
    assert.equal(await lab.locator('.cinema-player__navigation').count(),1);
    assert.equal(await lab.locator('.lab-project-image-canvas img').count(),1);
    assert.equal(await lab.locator('.lab-project-image-frame img').count(),1);
    assert((await lab.locator('.lab-project-image-frame img').evaluate(e=>e.naturalWidth))>0);
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(language => document.querySelector('#lab-project-title')?.textContent.includes(language==='zh'?'图片对比':'Comparison'), lang);
    assert.equal(await lab.locator('.lab-project-source--primary').getAttribute('href'),'https://ai-luren.github.io/Image-comparison/');
    assert.equal(await lab.locator('.lab-project-pagination button svg').count(),2);
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(language => document.querySelector('#lab-project-title')?.textContent.includes(language==='zh'?'文章配图':'Illustration'),lang);
    if (touch) {
      await lab.locator('.lab-project-source').click();
      const topSheet = page.locator('.external-link-sheet');
      await topSheet.waitFor({state:'visible'});
      assert((await topSheet.locator('.external-link-sheet__domain').innerText()).includes('github.com'));
      assert.equal(await topSheet.locator('.external-link-sheet__continue').getAttribute('target'),'_blank');
      await page.keyboard.press('Escape');
      await topSheet.waitFor({state:'detached'});
      assert.equal(await lab.count(),1,'closing only the topmost sheet');
    }
    await page.keyboard.press('Escape');
    await lab.waitFor({state:'detached'});
    assert.equal(await page.locator('main').evaluate(e=>e.inert),false);

    const dock=page.locator('.closing-social .floating-dock-item');
    await dock.first().scrollIntoViewIfNeeded();
    if (touch) {
      for (const [index,domain] of [[2,'github.com'],[3,'xiaohongshu.com'],[4,'douyin.com'],[5,'feishu.cn']]) {
        await dock.nth(index).click();
        const sheet=page.locator('.external-link-sheet');
        await sheet.waitFor({state:'visible'});
        assert((await sheet.locator('.external-link-sheet__domain').innerText()).includes(domain));
        assert.equal(await sheet.locator('.external-link-sheet__continue').getAttribute('target'),'_blank');
        await sheet.locator('.external-link-sheet__cancel').click();
        await sheet.waitFor({state:'detached'});
      }
    } else {
      await dock.nth(2).hover();
      assert(await page.locator('.floating-dock-label:visible').count() > 0, 'desktop hover label');
      await page.locator('.flip-experiment__link').first().hover();
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.flip-experiment__link .flip-experiment__tooltip')).opacity) > .9, null, { timeout: 2000 });
      assert.equal(await page.locator('.external-link-sheet').count(),0);
    }
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    assert(overflow<=2,'unexpected page overflow '+overflow);
    assert.deepEqual(errors,[]);
    assert.equal(getSafeMediaReport(page).urls.length,0);
    console.log('PASS:',width+'px',lang,'lab detail, touch external confirmation, focus and original links');
    await page.close();
  }
} finally {
  await browser.close();
}
