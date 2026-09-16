// 移动端精选作品手势回归：node scripts/check-mobile-project-gestures.mjs
// 驱动真实页面的触摸事件，锁定横向切页、纵向滚动和快速点击控件的边界。

import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const URL = 'http://127.0.0.1:5174/';
const BROWSER_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];

const executablePath = BROWSER_CANDIDATES.find(existsSync);
if (!executablePath) throw new Error('未找到 Chrome / Edge / Chromium');

const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 393, height: 852 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 1,
});
const page = await context.newPage();

const activePage = () => page.evaluate(() => (
  [...document.querySelectorAll('.comet-archive-pagination button')]
    .findIndex((button) => button.classList.contains('is-active'))
));

async function swipe(selector, { dx, dy }) {
  const box = await page.locator(selector).boundingBox();
  await page.evaluate(({ selector, x, y, dx: deltaX, dy: deltaY }) => {
    const target = document.querySelector(selector);
    const makeTouch = (clientX, clientY) => new Touch({
      identifier: 1,
      target,
      clientX,
      clientY,
      pageX: clientX,
      pageY: clientY,
      screenX: clientX,
      screenY: clientY,
    });
    const send = (type, clientX, clientY) => target.dispatchEvent(new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      touches: type === 'touchend' ? [] : [makeTouch(clientX, clientY)],
      changedTouches: [makeTouch(clientX, clientY)],
    }));
    send('touchstart', x, y);
    send('touchmove', x + deltaX, y + deltaY);
    send('touchend', x + deltaX, y + deltaY);
  }, { selector, x: box.x + box.width / 2, y: box.y + box.height / 2, dx, dy });
  await page.waitForTimeout(250);
}

try {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.locator('#projects').scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);

  const styles = await page.evaluate(() => ({
    shellTouchAction: getComputedStyle(document.querySelector('.comet-archive-mobile-shell')).touchAction,
    nextTouchAction: getComputedStyle(document.querySelector('.comet-archive-page-arrow--next')).touchAction,
    dotTouchAction: getComputedStyle(document.querySelector('.comet-archive-pagination button')).touchAction,
    pagination: (() => {
      const wrapper = document.querySelector('.comet-archive-pagination');
      const active = wrapper?.querySelector('button.is-active');
      const wrapperStyle = wrapper ? getComputedStyle(wrapper) : null;
      const dotStyle = active ? getComputedStyle(active, '::before') : null;
      return {
        background: wrapperStyle?.backgroundColor,
        border: wrapperStyle?.borderStyle,
        activeDotWidth: dotStyle?.width,
      };
    })(),
  }));
  if (styles.shellTouchAction !== 'pan-y') {
    throw new Error(`作品卡片容器 touch-action 应为 pan-y，实际为 ${styles.shellTouchAction}`);
  }
  if (styles.nextTouchAction !== 'manipulation' || styles.dotTouchAction !== 'manipulation') {
    throw new Error(`分页控件 touch-action 应为 manipulation，实际为 ${JSON.stringify(styles)}`);
  }
  if (styles.pagination.background !== 'rgba(0, 0, 0, 0)' || styles.pagination.border !== 'none' || styles.pagination.activeDotWidth !== '20px') {
    throw new Error(`作品分页点视觉样式异常：${JSON.stringify(styles.pagination)}`);
  }

  await swipe('.comet-archive-mobile-shell', { dx: -140, dy: 0 });
  if (await activePage() !== 1) throw new Error('横向左滑没有切换到第 2 页');

  await page.locator('.comet-archive-pagination button').first().click();
  await page.waitForTimeout(100);
  await swipe('.comet-archive-mobile-shell', { dx: 12, dy: 140 });
  if (await activePage() !== 0) throw new Error('纵向滑动错误地切换了作品页');

  await page.locator('#profile').scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  const careerStyles = await page.evaluate(() => ({
    stripTouchAction: getComputedStyle(document.querySelector('#profile .career-strip')).touchAction,
    tabTouchAction: getComputedStyle(document.querySelector('#career-tablist .career-tab')).touchAction,
    pagination: (() => {
      const wrapper = document.querySelector('#profile .career-pagination');
      const active = wrapper?.querySelector('button.is-active');
      const wrapperStyle = wrapper ? getComputedStyle(wrapper) : null;
      const dotStyle = active ? getComputedStyle(active, '::before') : null;
      return {
        background: wrapperStyle?.backgroundColor,
        border: wrapperStyle?.borderStyle,
        activeDotWidth: dotStyle?.width,
      };
    })(),
  }));
  if (careerStyles.stripTouchAction !== 'pan-y') {
    throw new Error(`工作经历容器 touch-action 应为 pan-y，实际为 ${careerStyles.stripTouchAction}`);
  }
  if (careerStyles.pagination.background !== 'rgba(0, 0, 0, 0)' || careerStyles.pagination.border !== 'none' || careerStyles.pagination.activeDotWidth !== '20px') {
    throw new Error(`工作经历分页点视觉样式异常：${JSON.stringify(careerStyles.pagination)}`);
  }
  const activeCareer = () => page.evaluate(() => (
    [...document.querySelectorAll('#career-tablist .career-tab')]
      .findIndex((tab) => tab.classList.contains('is-active'))
  ));
  await swipe('#profile .career-detail', { dx: -140, dy: 0 });
  if (await activeCareer() !== 1) throw new Error('工作经历详情卡片横向左滑没有切换到第 2 段');

  await page.waitForTimeout(500);
  await page.locator('#career-tablist .career-tab').first().click();
  await page.waitForTimeout(100);
  await swipe('#profile .career-detail', { dx: 12, dy: 140 });
  if (await activeCareer() !== 0) throw new Error('工作经历纵向滑动错误地切换了经历');

  await page.locator('#impact-awards').scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  const awardStyles = await page.evaluate(() => ({
    shellTouchAction: getComputedStyle(document.querySelector('.impact-award-shell')).touchAction,
    nextTouchAction: getComputedStyle(document.querySelector('.impact-award-rail-nav--next')).touchAction,
    dotTouchAction: getComputedStyle(document.querySelector('.impact-award-pagination button')).touchAction,
    pagination: (() => {
      const wrapper = document.querySelector('.impact-award-pagination');
      const active = wrapper?.querySelector('button.is-active');
      const wrapperStyle = wrapper ? getComputedStyle(wrapper) : null;
      const dotStyle = active ? getComputedStyle(active, '::before') : null;
      return {
        background: wrapperStyle?.backgroundColor,
        border: wrapperStyle?.borderStyle,
        activeDotWidth: dotStyle?.width,
      };
    })(),
  }));
  if (awardStyles.shellTouchAction !== 'pan-y') {
    throw new Error(`获奖作品容器 touch-action 应为 pan-y，实际为 ${awardStyles.shellTouchAction}`);
  }
  if (awardStyles.nextTouchAction !== 'manipulation' || awardStyles.dotTouchAction !== 'manipulation') {
    throw new Error(`获奖作品控件 touch-action 应为 manipulation，实际为 ${JSON.stringify(awardStyles)}`);
  }
  if (awardStyles.pagination.background !== 'rgba(0, 0, 0, 0)' || awardStyles.pagination.border !== 'none' || awardStyles.pagination.activeDotWidth !== '20px') {
    throw new Error(`获奖作品分页点视觉样式异常：${JSON.stringify(awardStyles.pagination)}`);
  }
  const activeAward = () => page.evaluate(() => (
    [...document.querySelectorAll('.impact-award-pagination button')]
      .findIndex((button) => button.classList.contains('is-active'))
  ));
  await swipe('.impact-award-shell', { dx: -140, dy: 0 });
  if (await activeAward() !== 1) throw new Error('获奖作品横向左滑没有切换到第 2 张');

  await page.locator('.impact-award-pagination button').first().click();
  await page.waitForTimeout(100);
  await swipe('.impact-award-shell', { dx: 12, dy: 140 });
  if (await activeAward() !== 0) throw new Error('获奖作品纵向滑动错误地切换了卡片');

  console.log('移动端卡片手势回归通过（393px：两组卡片横滑、纵滑不切页、快速点击防缩放策略）。');
} finally {
  await browser.close();
}
