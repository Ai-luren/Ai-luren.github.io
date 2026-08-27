// 双语布局溢出检测：npm run check:i18n
// 覆盖 zh/en 两种语言 × 手机/桌面两种视口，检测内容溢出与已知复发点的排版回归。
// 依赖 playwright-core（仅驱动，不带浏览器），使用系统已装的 Chrome 或 Edge。

import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const PORT = 5199;
const URL = `http://localhost:${PORT}/`;
const LANGS = ['zh', 'en'];
const VIEWPORTS = [
  { name: 'mobile', width: 393, height: 852 },
  { name: 'desktop', width: 1440, height: 900 },
];

const BROWSER_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];

function findBrowser() {
  const path = BROWSER_CANDIDATES.find(existsSync);
  if (!path) {
    console.error('未找到可用浏览器（Chrome / Edge / Chromium）。检测需要系统安装其中之一。');
    process.exit(1);
  }
  return path;
}

function startDevServer() {
  const proc = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: process.cwd(),
    stdio: 'ignore',
    detached: false,
  });
  return proc;
}

async function waitForServer(url, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return true;
    } catch { /* 服务未就绪，继续等 */ }
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

// 页面内通用溢出扫描：在当前滚动位置下找横向溢出与文本被裁剪的元素。
// 忽略名单是设计上故意溢出的元素：走马灯 logo 条、奖状轮播（露出下一张）、按钮扫光特效层。
const SCAN_FN = `(() => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const issues = [];
  const selfIgnored = /^(sr-only|logo-loop|specular-button__fx)/;
  const ancestorIgnored = /logo-loop|impact-award-mobile-grid|impact-circular-gallery/;
  for (const el of document.querySelectorAll('body *')) {
    const cls = (el.className || '').toString();
    if (selfIgnored.test(cls) || el.tagName === 'CANVAS') continue;
    if (el.closest && el.closest('.logo-loop, .impact-award-mobile-grid, .impact-circular-gallery')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.bottom < -80 || r.top > vh + 80) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const isLeaf = el.children.length === 0 && el.textContent.trim().length > 0;
    if (r.right > vw + 2 && r.left < vw && (isLeaf || cs.overflow !== 'hidden')) {
      issues.push({ kind: 'viewport-overflow', target: desc(el), right: Math.round(r.right), vw });
    }
    if (isLeaf && el.scrollWidth > el.clientWidth + 2 && cs.textOverflow !== 'ellipsis' && cs.whiteSpace !== 'nowrap') {
      issues.push({ kind: 'text-clipped', target: desc(el), scrollW: el.scrollWidth, clientW: el.clientWidth });
    }
  }
  function desc(el) {
    const c = (el.className || '').toString().trim().split(/\\s+/).slice(0, 2).join('.');
    return el.tagName.toLowerCase() + (c ? '.' + c : '') + ' ' + el.textContent.trim().slice(0, 30);
  }
  return issues;
})()`;

async function scrollTo(page, y) {
  await page.evaluate(v => window.scrollTo(0, v), y);
  await page.waitForTimeout(700);
}

async function scanAt(page) {
  return page.evaluate(SCAN_FN);
}

// 专项断言：这些是历史上真实出现过问题的位置，逐条锁死。
const CHECKS = {
  // ≤760px 时 header 是 width: calc(100% - 24px) 的浮动玻璃胶囊，语言按钮 flex-shrink:0
  // 被中文完整标签顶出过胶囊右缘（不超视口，视觉上是按钮超出玻璃底）。必须对比胶囊右缘而非视口。
  navFits: async (page) => {
    return page.evaluate(() => {
      const btn = document.getElementById('nav-lang');
      const header = document.querySelector('header');
      if (!btn || !header) return { ok: true };
      const br = btn.getBoundingClientRect();
      const hr = header.getBoundingClientRect();
      const overflow = Math.round(br.right - hr.right);
      return { ok: overflow <= 0, detail: `按钮右缘 ${Math.round(br.right)} / 胶囊右缘 ${Math.round(hr.right)}（超出 ${overflow}px）` };
    });
  },
  // 标题行宽 7ch 是刻意设计（限制两行排版的行宽），中文 4 字略超容器但无背景无裁剪、视觉无害；
  // 真正要抓的是标题文字超出视口（会被截断）。
  heroTitle: async (page) => {
    const h1 = await page.$('.hero-title');
    if (!h1) return { ok: true };
    return h1.evaluate(el => {
      const vw = window.innerWidth;
      const bad = Array.from(el.querySelectorAll('span')).filter(s => {
        const r = s.getBoundingClientRect();
        return r.width > 0 && r.right > vw;
      });
      return { ok: bad.length === 0, detail: bad.map(b => b.textContent.slice(0, 16)).join(' | ') };
    });
  },
  workStepAligned: async (page) => {
    if (page.viewportSize().width < 721) return { ok: true };
    const list = await page.$('.experience-list');
    const step = await page.$('.experience-step');
    if (!list || !step) return { ok: true };
    return page.evaluate(([l, s]) => {
      const lr = l.getBoundingClientRect();
      const sr = s.getBoundingClientRect();
      return { ok: sr.right <= lr.right + 1, detail: `卡片右缘 ${Math.round(sr.right)} / 列表右缘 ${Math.round(lr.right)}` };
    }, [list, step]);
  },
  cardsNoOverlap: async (page) => {
    const cards = await page.$$('.comet-archive__card');
    if (!cards.length) return { ok: true };
    return page.evaluate(els => {
      const bad = [];
      for (const c of els) {
        const img = c.querySelector('.comet-archive__image');
        const copy = c.querySelector('.comet-archive__copy');
        if (!img || !copy) continue;
        if (copy.getBoundingClientRect().top < img.getBoundingClientRect().bottom - 1) {
          bad.push(c.querySelector('.comet-archive__copy strong')?.textContent.slice(0, 24));
        }
      }
      return { ok: bad.length === 0, detail: bad.length ? `文字压图: ${bad.join(' | ')}` : '' };
    }, cards);
  },
  qrPopupsCentered: async (page) => {
    const popups = await page.$$('.floating-dock-qr-popup, .impact-reach-qr-popup');
    if (!popups.length) return { ok: true };
    return page.evaluate(els => {
      const bad = [];
      for (const p of els) {
        const prev = p.style.display;
        p.style.display = 'block';
        const img = p.querySelector('img');
        if (img) {
          const pr = p.getBoundingClientRect();
          const ir = img.getBoundingClientRect();
          const leftGap = ir.left - pr.left;
          const rightGap = pr.right - ir.right;
          if (Math.abs(leftGap - rightGap) > 1) {
            bad.push(`${p.querySelector('span')?.textContent || p.className} 左${Math.round(leftGap)} 右${Math.round(rightGap)}`);
          }
        }
        p.style.display = prev;
      }
      return { ok: bad.length === 0, detail: bad.join(' | ') };
    }, popups);
  },
  // Selected Works 卡片顶部 kick 标签是等宽字体（--tech）单行设计。英文 "WORK / xxx" 比中文宽得多，
  // 曾在移动端被省略号截断（如 "WORK / AI Concept Films"）。中英文都不能截断，且英文分类标签需保持精简。
  archiveKickNoClip: async (page) => {
    return page.evaluate(() => {
      const bad = [];
      for (const k of document.querySelectorAll('.comet-archive__award')) {
        if (k.scrollWidth > k.clientWidth + 1) {
          bad.push(`"${k.textContent.trim()}" 需${k.scrollWidth}px/可用${k.clientWidth}px`);
        }
      }
      return { ok: bad.length === 0, detail: bad.join(' | ') };
    });
  },
  // 底部奖项文字不能横向截断。中文单行（nowrap+ellipsis 设计），英文允许 2 行换行。
  // 只查横向：line-height 1.1 小于字体自然行高会让 scrollHeight 天然大于 clientHeight，纵向对比会误报。
  archiveAwardNoClip: async (page) => {
    return page.evaluate(() => {
      const bad = [];
      for (const s of document.querySelectorAll('.comet-archive__details strong')) {
        if (s.scrollWidth > s.clientWidth + 1) {
          bad.push(`"${s.textContent.trim().slice(0, 24)}" 需${s.scrollWidth}px/可用${s.clientWidth}px`);
        }
      }
      return { ok: bad.length === 0, detail: bad.join(' | ') };
    });
  },
  // 导航等 data-i18n 文案必须来自字典。曾出现过导航显示 key 原文（如 "nav.profile"）的反馈，
  // 若字典缺 key 或写入异常，元素会显示 "xx.yy" 形态的 key，逐个元素锁死。
  navNoRawKeys: async (page) => {
    return page.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll('[data-i18n]')) {
        const text = el.textContent.trim();
        if (/^[a-z][a-zA-Z]*\.[a-zA-Z]/.test(text)) {
          bad.push(`${el.getAttribute('data-i18n')} 显示了 "${text.slice(0, 24)}"`);
        }
      }
      return { ok: bad.length === 0, detail: bad.join(' | ') };
    });
  },
};

async function run() {
  const browserPath = findBrowser();
  let server;
  const running = await fetch(URL, { signal: AbortSignal.timeout(2000) }).then(r => r.ok).catch(() => false);
  if (!running) {
    server = startDevServer();
    const ok = await waitForServer(URL);
    if (!ok) {
      console.error('开发服务器启动超时');
      server.kill();
      process.exit(1);
    }
  }

  const browser = await chromium.launch({ executablePath: browserPath });
  const failures = [];
  const warnings = [];

  try {
    for (const vp of VIEWPORTS) {
      for (const lang of LANGS) {
        const label = `[${vp.name} ${lang}]`;
        const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        await context.addInitScript(l => {
          try { window.localStorage.setItem('ailuren-lang', l); } catch { /* 忽略 */ }
        }, lang);
        const page = await context.newPage();
        await page.goto(URL, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2500);

        // 全页滚动采样扫描
        const pageHeight = await page.evaluate(() => document.scrollingElement.scrollHeight);
        for (let y = 0; y <= pageHeight; y += 600) {
          await scrollTo(page, y);
          const issues = await scanAt(page);
          for (const it of issues) failures.push(`${label} ${it.kind}: ${it.target}`);
        }

        // 专项断言（在页面顶部附近执行，导航和 Hero 可见）
        await scrollTo(page, 0);
        for (const [name, fn] of Object.entries(CHECKS)) {
          const result = await fn(page);
          if (result && result.ok === false) {
            failures.push(`${label} ${name} 失败${result.detail ? `（${result.detail}）` : ''}`);
          }
        }
        // 中间宽度专项：导航与作品卡片在窄屏的适配（375/360 是 kick 标签与奖项文字的紧约束宽度）
        if (vp.name === 'mobile') {
          for (const w of [375, 360]) {
            await page.setViewportSize({ width: w, height: vp.height });
            for (const name of ['navFits', 'archiveKickNoClip', 'archiveAwardNoClip']) {
              const result = await CHECKS[name](page);
              if (result && result.ok === false) {
                failures.push(`[mobile-${w}px ${lang}] ${name} 失败（${result.detail}）`);
              }
            }
          }
        }
        await page.close();
        await context.close();
      }
    }
  } finally {
    await browser.close();
    if (server) server.kill();
  }

  if (failures.length) {
    console.error(`\n检测不通过，共 ${failures.length} 处问题：`);
    for (const f of failures) console.error(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log(`\n双语布局检测通过（${VIEWPORTS.length} 视口 × ${LANGS.length} 语言，含全页滚动扫描与专项断言）。`);
}

run().catch(err => {
  console.error('检测脚本异常：', err);
  process.exit(1);
});
