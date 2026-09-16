// 移动端主导航焦点回归：node scripts/check-mobile-menu-focus.mjs
// 触摸打开菜单不应把第一个链接误聚焦成蓝色大框；键盘 Tab 仍需进入第一个链接。

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

try {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  const toggle = page.locator('.nav-toggle');
  const firstLink = page.locator('#mobile-primary-nav .nav-list a').first();

  await toggle.click();
  await page.waitForTimeout(30);

  const touchOpenState = await page.evaluate(() => {
    const toggleNode = document.querySelector('.nav-toggle');
    const firstNode = document.querySelector('#mobile-primary-nav .nav-list a');
    return {
      activeIsToggle: document.activeElement === toggleNode,
      activeIsFirstLink: document.activeElement === firstNode,
      firstLinkFocusVisible: firstNode.matches(':focus-visible'),
      drawerOpen: document.querySelector('#mobile-nav-drawer').classList.contains('is-open'),
    };
  });
  if (!touchOpenState.drawerOpen) throw new Error('触摸打开后菜单没有进入打开状态');
  if (!touchOpenState.activeIsToggle || touchOpenState.activeIsFirstLink || touchOpenState.firstLinkFocusVisible) {
    throw new Error(`触摸打开菜单的焦点不应落在第一个链接：${JSON.stringify(touchOpenState)}`);
  }

  await page.keyboard.press('Tab');
  const keyboardState = await page.evaluate(() => {
    const firstNode = document.querySelector('#mobile-primary-nav .nav-list a');
    return {
      activeIsFirstLink: document.activeElement === firstNode,
      firstLinkFocusVisible: firstNode.matches(':focus-visible'),
    };
  });
  if (!keyboardState.activeIsFirstLink || !keyboardState.firstLinkFocusVisible) {
    throw new Error(`键盘 Tab 未正确显示第一个链接焦点：${JSON.stringify(keyboardState)}`);
  }

  console.log('移动端菜单焦点回归通过（触摸打开无蓝框，键盘 Tab 保留可见焦点）。');
} finally {
  await browser.close();
}
