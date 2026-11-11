import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createSafePage, getSafeMediaReport } from '../../lib/safe-media.mjs';

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
    assert.equal(await page.locator('.flip-experiment__row .flip-experiment__link').count(),0,
      'AI Lab cards show only View Project; Github remains available inside the project detail');
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
    assert.equal(await lab.locator('.lab-project-source').filter({hasText:'↗'}).count(),0,'lab links must not use ↗ glyphs');
    assert.equal(await lab.locator('.lab-project-pagination button svg').count(),2);
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(language => document.querySelector('#lab-project-title')?.textContent.includes(language==='zh'?'文章配图':'Illustration'),lang);
    if (touch) {
      await lab.locator('.lab-project-source').click();
      const topSheet = page.locator('.external-link-sheet');
      await topSheet.waitFor({state:'visible'});
      assert((await topSheet.locator('.external-link-sheet__domain').innerText()).includes('github.com'));
      assert.equal(await topSheet.locator('.external-link-sheet__domain').innerText(),'github.com');
      assert(!((await topSheet.locator('.external-link-sheet__continue').innerText()).includes('↗')),'confirmation action should have a plain-text label');
      assert.equal(await topSheet.locator('.external-link-sheet__continue').getAttribute('target'),'_blank');
      await page.keyboard.press('Escape');
      await topSheet.waitFor({state:'detached'});
      assert.equal(await lab.count(),1,'closing only the topmost sheet');
    }
    await page.keyboard.press('Escape');
    await lab.waitFor({state:'detached'});
    assert.equal(await page.locator('main').evaluate(e=>e.inert),false);

    // AI social profile links previously bypassed the mobile confirmation
    // surface. The global fallback should catch them without touching desktop
    // link navigation or duplicating existing Dock/Lab sheets.
    const reachLinks=page.locator('#impact-reach .impact-reach-action--external');
    assert.equal(await reachLinks.count(),3,'three clickable AI social media profiles');
    const destinations=[
      ['douyin.com',lang==='en'?'Douyin profile':'抖音主页'],
      ['xiaohongshu.com',lang==='en'?'REDnote profile':'小红书主页'],
      ['kuaishou.com',lang==='en'?'Kuaishou profile':'快手主页'],
    ];
    if(touch){
      for(const [index,[domain,label]] of destinations.entries()){
        const link=reachLinks.nth(index);
        const actualHref=await link.getAttribute('href');
        await link.click();
        const sheet=page.locator('.external-link-sheet');
        await sheet.waitFor({state:'visible'});
        assert.equal(await sheet.count(),1,'only one external confirmation sheet is allowed');
        assert.equal(await sheet.locator('.external-link-sheet__destination').innerText(),label);
        assert((await sheet.locator('.external-link-sheet__domain').innerText()).includes(domain));
        assert.equal(await sheet.locator('.external-link-sheet__continue').getAttribute('href'),actualHref);
        assert.equal(await sheet.locator('.external-link-sheet__continue').getAttribute('target'),'_blank');
        assert.equal(await sheet.locator('.external-link-sheet__continue').getAttribute('data-external-confirmed'),'true');
        await sheet.locator('.external-link-sheet__cancel').click();
        await sheet.waitFor({state:'detached'});
        assert(await link.isVisible(),'closing the external sheet returns to the AI media section');
      }
      // Regression for any future external anchor that does not have its own
      // React onClick handler: one reusable sheet instead of silent navigation.
      await page.evaluate(()=>{
        const anchor=document.createElement('a');
        anchor.id='test-future-external-link';
        anchor.href='https://example.org/portfolio';
        anchor.textContent='Future external resource';
        document.body.appendChild(anchor);
      });
      await page.locator('#test-future-external-link').click();
      const fallback=page.locator('.external-link-sheet');
      await fallback.waitFor({state:'visible'});
      assert.equal(await fallback.locator('.external-link-sheet__domain').innerText(),'example.org');
      assert.equal(await fallback.locator('.external-link-sheet__continue').getAttribute('href'),'https://example.org/portfolio');
      await fallback.locator('.external-link-sheet__cancel').click();
      await fallback.waitFor({state:'detached'});
      assert.equal(await page.locator('#test-future-external-link').count(),1,'fallback must not navigate away');
      await page.locator('#test-future-external-link').evaluate(el=>el.remove());
    }else{
      assert.equal(await reachLinks.first().getAttribute('target'),'_blank',
        'desktop keeps ordinary browser external links');
      assert.equal(await page.locator('.external-link-sheet').count(),0,
        'no preemptive external-link sheet on desktop');
    }

    // Scheme A: plain-text external links, without platform-dependent ↗ glyphs.
    const externalArrowTargets=page.locator([
      '.flip-experiment__link',
      '.lab-project-source',
      '.impact-reach-action--external',
      '.external-link-sheet__domain',
      '.external-link-sheet__continue',
    ].join(', '));
    assert.equal(await externalArrowTargets.filter({hasText:'↗'}).count(),0,
      'external links and confirmation buttons use text-only labels');
    assert.equal(await page.locator('.impact-reach-external-arrow').count(),0,
      'legacy social-profile arrow node should not be rendered');

    const dock=page.locator('.closing-social .floating-dock-item');
    await dock.first().scrollIntoViewIfNeeded();
    if (touch) {
      // Email and WeChat should have explicit choices, not surprising auto-copy
      // or auto-download actions when their toolbar icons are tapped.
      let downloadEvents=0;
      page.on('download',()=>{ downloadEvents++; });
      await dock.nth(0).click();
      const emailSheet=page.locator('.external-link-sheet');
      await emailSheet.waitFor({state:'visible'});
      assert.equal(await emailSheet.locator('.external-link-sheet__contact-value').innerText(),'1746850550@qq.com');
      assert.equal(await emailSheet.locator('.external-link-sheet__cancel').getAttribute('href'),'mailto:1746850550@qq.com');
      assert.match(await emailSheet.locator('.external-link-sheet__continue').innerText(),/复制邮箱地址|Copy email address/);
      assert.equal(downloadEvents,0,'touch email must never trigger a download');
      await emailSheet.locator('.external-link-sheet__dismiss').click();
      await emailSheet.waitFor({state:'detached'});

      await dock.nth(1).click();
      const wechatSheet=page.locator('.external-link-sheet');
      await wechatSheet.waitFor({state:'visible'});
      assert.equal(await wechatSheet.locator('.external-link-sheet__contact-value').innerText(),'15580714085');
      await wechatSheet.locator('.external-link-sheet__qr img').evaluate(img=>img.decode());
      assert.equal(await wechatSheet.locator('.external-link-sheet__qr img').count(),1);
      assert.equal(await wechatSheet.locator('.external-link-sheet__cancel').getAttribute('download'),'wechat-qr-code.webp');
      assert.match(await wechatSheet.locator('.external-link-sheet__continue').innerText(),/复制微信号|Copy WeChat ID/);
      assert.equal(downloadEvents,0,'touch WeChat must not auto-download its QR image');
      const sheetBounds=await wechatSheet.locator('.external-link-sheet__panel').boundingBox();
      assert(sheetBounds.width<=width+1,'mobile contact sheet must fit viewport');
      await wechatSheet.locator('.external-link-sheet__dismiss').click();
      await wechatSheet.waitFor({state:'detached'});
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
      // Desktop WeChat is a scan-friendly hover card, not an auto-download.
      // Moving to other icons must remove it without overlapping tooltips.
      let downloadEvents=0;
      page.on('download',()=>{downloadEvents++;});
      await dock.nth(1).hover();
      const qrPreview=page.locator('.floating-dock-qr');
      await qrPreview.waitFor({state:'visible'});
      await qrPreview.locator('img').evaluate(img=>img.decode());
      assert.match(await qrPreview.innerText(),/微信扫码联系|Scan with WeChat/);
      assert.match(await qrPreview.innerText(),/微信号：15580714085|WeChat ID: 15580714085/);
      assert.doesNotMatch(await qrPreview.innerText(),/扫码添加微信|Scan to connect/,'QR caption should add useful contact information, not repeat the title');
      assert.equal(await page.locator('.floating-dock-label:visible').count(),0,'QR card replaces old download tooltip');
      await dock.nth(1).click();
      assert.equal(downloadEvents,0,'desktop WeChat icon must not download on click');
      for(const [index, expected] of [
        [2,lang==='en'?'Open GitHub profile':'打开 GitHub 主页'],
        [3,lang==='en'?'Open REDnote profile':'打开小红书主页'],
        [0,lang==='en'?'Copy email':'复制邮箱'],
      ]){
        await dock.nth(index).hover();
        await page.waitForTimeout(300); // Past previous tooltip's former exit duration.
        assert.deepEqual(await page.locator('.floating-dock-label:visible').allInnerTexts(),[expected],
          'only the currently hovered icon may expose a tooltip after the QR preview');
        assert.equal(await qrPreview.count(),0,'old WeChat preview must close on next icon');
      }
      await page.mouse.move(10,10);
      assert.equal(await page.locator('.floating-dock-label:visible').count(),0,
        'leaving the dock must remove the last tooltip');
      // Keyboard Tab focus still advertises exactly the focused icon.
      await dock.nth(1).focus();
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('.floating-dock-item:focus').getAttribute('aria-label'),
        lang==='en'?'GitHub profile':'GitHub 主页');
      assert.deepEqual(await page.locator('.floating-dock-label:visible').allInnerTexts(),
        [lang==='en'?'Open GitHub profile':'打开 GitHub 主页'],
        'keyboard focus retains one accessible tooltip');
      // The in-site project is the sole card action now: GitHub source is
      // intentionally offered only in its detail dialog, not on hover.
      await page.locator('.flip-experiment__detail').first().hover();
      assert.equal(await page.locator('.flip-experiment__link').count(),0);
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
