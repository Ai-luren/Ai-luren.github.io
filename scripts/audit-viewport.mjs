// 对抗式审查 1：断点临界视口 × 中英文，全页滚动扫描溢出/截断/重叠
// 攻击目标：常规检测只用 393/1440，这里用断点边界值（320/360/375/390/414/519/520/559/560/640/719/720/721/760/761/820/900/980/1024/1280/1920）
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const BROWSER = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'].find(existsSync);
const VIEWPORTS = [320, 360, 375, 390, 414, 519, 560, 640, 720, 721, 760, 761, 900, 1024, 1280, 1920];

const SCAN_FN = `(() => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const issues = [];
  const selfIgnored = /^(sr-only|logo-loop|specular-button__fx)/;
  for (const el of document.querySelectorAll('body *')) {
    const cls = (el.className || '').toString();
    if (selfIgnored.test(cls) || el.tagName === 'CANVAS') continue;
    if (el.closest && el.closest('.logo-loop, .impact-award-mobile-grid, .impact-circular-gallery')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.bottom < -80 || r.top > vh + 80) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) continue;
    const isLeaf = el.children.length === 0 && el.textContent.trim().length > 0;
    if (r.right > vw + 2 && r.left < vw && (isLeaf || cs.overflow !== 'hidden')) {
      issues.push({ kind: 'viewport-overflow', target: el.tagName.toLowerCase() + '.' + cls.trim().split(/\\s+/)[0] + ' ' + el.textContent.trim().slice(0, 28) });
    }
    if (isLeaf && el.scrollWidth > el.clientWidth + 2 && cs.textOverflow !== 'ellipsis' && cs.whiteSpace !== 'nowrap') {
      issues.push({ kind: 'text-clipped', target: el.tagName.toLowerCase() + '.' + cls.trim().split(/\\s+/)[0] + ' ' + el.textContent.trim().slice(0, 28) });
    }
    // 新增：nowrap+ellipsis 元素被截断到 3+ 字符消失（信息严重丢失）
    if (isLeaf && cs.whiteSpace === 'nowrap' && cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 6) {
      issues.push({ kind: 'ellipsis-heavy', target: el.tagName.toLowerCase() + '.' + cls.trim().split(/\\s+/)[0] + ' ' + el.textContent.trim().slice(0, 28) });
    }
  }
  return issues;
})()`;

const OVERLAP_FN = `(() => {
  // 文字元素 vs 图片/卡片边界的互相重叠（非父子关系）
  const issues = [];
  const texts = [];
  for (const el of document.querySelectorAll('.comet-archive__copy strong, .comet-archive__award, .comet-archive__meta, .hero-subtitle, .hero-title, .footer-tagline, .experience-step b, .experience-step span')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) texts.push({ el, r, cls: (el.className || '').toString() });
  }
  for (const img of document.querySelectorAll('.comet-archive__image, .experience-illustration, .hero-proof-card img')) {
    const ir = img.getBoundingClientRect();
    if (ir.width === 0) continue;
    for (const t of texts) {
      if (t.el.contains(img) || img.contains(t.el)) continue;
      const overlapX = Math.min(t.r.right, ir.right) - Math.max(t.r.left, ir.left);
      const overlapY = Math.min(t.r.bottom, ir.bottom) - Math.max(t.r.top, ir.top);
      if (overlapX > 8 && overlapY > 8) {
        issues.push('文字[' + t.cls.toString().slice(0, 30) + ' ' + t.el.textContent.trim().slice(0, 14) + '] 压图 ' + Math.round(overlapX) + 'x' + Math.round(overlapY) + 'px');
      }
    }
  }
  return issues;
})()`;

const browser = await chromium.launch({ executablePath: BROWSER });
const report = [];

for (const lang of ['zh', 'en']) {
  for (const vw of VIEWPORTS) {
    const height = vw < 500 ? 852 : vw < 900 ? 900 : 900;
    const context = await browser.newContext({ viewport: { width: vw, height } });
    await context.addInitScript((l) => { try { localStorage.setItem('ailuren-lang', l); } catch (e) {} }, lang);
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message.slice(0, 80)));
    try {
      await page.goto('http://localhost:5174/', { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1200);
      const pageHeight = await page.evaluate(() => document.scrollingElement.scrollHeight);
      const found = new Set();
      for (let y = 0; y <= pageHeight; y += 500) {
        await page.evaluate((v) => window.scrollTo(0, v), y);
        await page.waitForTimeout(350);
        const issues = await page.evaluate(SCAN_FN);
        for (const it of issues) found.add(`${it.kind}: ${it.target}`);
        if (y === 0 || y === Math.floor(pageHeight / 2) * 1) {
          const overlaps = await page.evaluate(OVERLAP_FN);
          for (const o of overlaps) found.add(`overlap: ${o}`);
        }
      }
      if (found.size) {
        report.push({ lang, vw, issues: [...found].slice(0, 12) });
      }
      if (pageErrors.length) {
        report.push({ lang, vw, issues: pageErrors.slice(0, 3).map((e) => `js-error: ${e}`) });
      }
    } catch (e) {
      report.push({ lang, vw, issues: [`加载失败: ${e.message.slice(0, 60)}`] });
    }
    await context.close();
  }
}
await browser.close();

if (!report.length) {
  console.log('✓ 16 个视口 × 中英文全页扫描未发现问题');
} else {
  for (const r of report) {
    console.log(`\n[${r.lang} @${r.vw}px]`);
    for (const i of r.issues) console.log(`  ✗ ${i}`);
  }
  console.log(`\n共 ${report.length} 个视口有异常`);
}
