// 双语布局溢出检测：npm run check:i18n
// 覆盖 zh/en 两种语言 × 手机/桌面两种视口，检测内容溢出与已知复发点的排版回归。
// 依赖 playwright-core（仅驱动，不带浏览器），使用系统已装的 Chrome 或 Edge。

import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const PORT = 5199;
const URL = `http://127.0.0.1:${PORT}/`;
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
// 位于真实横向滚动容器内部的内容不参与视口判断，避免把可滑动轨道的正常 peek 误报为页面溢出。
const SCAN_FN = `(() => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const issues = [];
  const selfIgnored = /^(sr-only|logo-loop|specular-button__fx)/;
  function isInsideHorizontalScroller(el) {
    let node = el.parentElement;
    while (node) {
      const style = getComputedStyle(node);
      const scrollable = /(auto|scroll|overlay)/.test(style.overflowX);
      if (scrollable && node.scrollWidth > node.clientWidth + 2) return true;
      node = node.parentElement;
    }
    return false;
  }
  for (const el of document.querySelectorAll('body *')) {
    const cls = (el.className || '').toString();
    if (selfIgnored.test(cls) || el.tagName === 'CANVAS') continue;
    if (isInsideHorizontalScroller(el)) continue;
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
  careerTabAligned: async (page) => {
    if (page.viewportSize().width < 721) return { ok: true };
    const list = await page.$('.career-tabs');
    const tab = await page.$('.career-tab');
    if (!list || !tab) return { ok: true };
    return page.evaluate(([l, s]) => {
      const lr = l.getBoundingClientRect();
      const sr = s.getBoundingClientRect();
      return { ok: sr.right <= lr.right + 1, detail: `标签右缘 ${Math.round(sr.right)} / 标签栏右缘 ${Math.round(lr.right)}` };
    }, [list, tab]);
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
  // 移动端获奖轮播的分页圆点必须完整落在外层面板内，不能被面板的 overflow:hidden 裁掉。
  awardPaginationVisible: async (page) => {
    if (page.viewportSize().width > 720) return { ok: true };
    return page.evaluate(() => {
      const shell = document.querySelector('.impact-award-shell');
      const rail = document.querySelector('.impact-award-rail');
      const pagination = document.querySelector('.impact-award-pagination');
      if (!shell || !rail || !pagination) return { ok: true };
      const shellRect = shell.getBoundingClientRect();
      const railRect = rail.getBoundingClientRect();
      const paginationRect = pagination.getBoundingClientRect();
      const style = getComputedStyle(pagination);
      const buttons = pagination.querySelectorAll('button');
      const hidden = style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0;
      const clipped = paginationRect.top < shellRect.top - 1 || paginationRect.bottom > shellRect.bottom + 1;
      const overlapsRail = paginationRect.top < railRect.bottom - 6;
      return {
        ok: !hidden && !clipped && !overlapsRail && buttons.length > 0,
        detail: `分页区域 ${Math.round(paginationRect.top)}-${Math.round(paginationRect.bottom)} / 轨道底部 ${Math.round(railRect.bottom)} / 面板 ${Math.round(shellRect.top)}-${Math.round(shellRect.bottom)}`,
      };
    });
  },
  // 三个影响力模块共享同一套标题-卡片与模块间距；移动端不能被视口高度强行撑满。
  impactRhythm: async (page) => {
    return page.evaluate(() => {
      const rows = [...document.querySelectorAll('.impact-evidence-row')];
      if (rows.length !== 3) return { ok: true };
      const metrics = rows.map((row) => {
        const label = row.querySelector('.impact-evidence-label')?.getBoundingClientRect();
        const panel = row.querySelector(':scope > div:last-child > .impact-glass')?.getBoundingClientRect();
        const rect = row.getBoundingClientRect();
        return {
          id: row.id,
          height: rect.height,
          titleToPanel: label && panel ? panel.top - label.bottom : null,
          top: rect.top + scrollY,
          bottom: rect.bottom + scrollY,
          panelBottom: panel ? panel.bottom + scrollY : null,
        };
      });
      const titleGaps = metrics.map((item) => item.titleToPanel).filter(Number.isFinite);
      const rowGaps = metrics.slice(1).map((item, index) => item.top - metrics[index].bottom);
      const maxDelta = (values) => values.length ? Math.max(...values) - Math.min(...values) : 0;
      const mobile = window.innerWidth <= 720;
      const experimentHeading = document.querySelector('#experiments .section-title');
      const experimentTop = experimentHeading ? experimentHeading.getBoundingClientRect().top + scrollY : null;
      const lastPanelBottom = metrics.at(-1)?.panelBottom;
      const labGap = Number.isFinite(experimentTop) && Number.isFinite(lastPanelBottom) ? experimentTop - lastPanelBottom : 0;
      const mobileOverfull = mobile
        ? metrics.some((item) => item.height > window.innerHeight * .9)
        : false;
      const ok = !mobileOverfull && maxDelta(titleGaps) <= 3 && maxDelta(rowGaps) <= 3 && labGap <= (mobile ? 96 : 128);
      return {
        ok,
        detail: `标题-卡片 ${titleGaps.map(Math.round).join('/')}px / 模块间 ${rowGaps.map(Math.round).join('/')}px / 自媒体-实验室 ${Math.round(labGap)}px / 模块高度 ${metrics.map((item) => Math.round(item.height)).join('/')}`,
      };
    });
  },
  // 设计系统的字体职责必须稳定：标题用展示字体，正文用正文字体，
  // 年份/数据/英文元信息用等宽字体；英文长标题不能被 nowrap 锁死。
  typographyRoles: async (page) => {
    return page.evaluate(() => {
      const visible = (selector) => [...document.querySelectorAll(selector)].filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && getComputedStyle(el).display !== 'none';
      });
      const bad = [];
      const firstFamily = (selector) => {
        const el = visible(selector)[0];
        return el ? getComputedStyle(el).fontFamily : '';
      };
      // Comparing computed family strings keeps this assertion stable across
      // browser font fallback serialization; the design system exposes the
      // role by using a representative element for each family.
      const displayFamily = firstFamily('.impact-evidence-label h2, #experiments .section-title');
      const bodyFamily = firstFamily('.impact-award-description, .impact-platform-desktop-description, .impact-reach-dossier-description');
      const monoFamily = firstFamily('.impact-evidence-note, .impact-platform-desktop-head, .impact-reach-dossier-head');
      const assertFamily = (selector, family, label) => {
        for (const el of visible(selector)) {
          const style = getComputedStyle(el);
          if (family && style.fontFamily !== family) {
            bad.push(`${label}: ${el.textContent.trim().slice(0, 20)} (${style.fontFamily})`);
          }
        }
      };
      assertFamily('.impact-evidence-label h2, #experiments .section-title, .impact-platform-mobile-manifesto h3, .flip-experiment__row-title h3, .impact-award-card-caption strong', displayFamily, '展示字体');
      assertFamily('.impact-award-description, .impact-platform-desktop-description, .impact-platform-mobile-manifesto p, .impact-reach-dossier-description, .flip-experiment__row-description', bodyFamily, '正文字体');
      assertFamily('.impact-evidence-note, .impact-platform-desktop-head, .impact-platform-mobile-meta, .impact-platform-mobile-network-head, .impact-reach-dossier-head, .impact-reach-profile-caption span, .impact-award-card-caption small, .flip-experiment__facts span', monoFamily, '等宽字体');
      for (const el of visible('.impact-evidence-label h2, #experiments .section-title, .impact-platform-mobile-manifesto h3, .flip-experiment__row-title h3, .impact-award-card-caption strong')) {
        if (getComputedStyle(el).fontWeight !== '600') bad.push(`展示字重不一致: ${el.textContent.trim().slice(0, 24)}`);
      }
      if (document.documentElement.lang === 'en') {
        for (const el of visible('.impact-evidence-label h2, .flip-experiment__row-title h3')) {
          if (getComputedStyle(el).whiteSpace === 'nowrap') bad.push(`英文标题仍被 nowrap 锁定: ${el.textContent.trim().slice(0, 24)}`);
        }
      }
      return { ok: bad.length === 0, detail: bad.join(' | ') };
    });
  },
  // 视觉系统的表面层级必须稳定：外层面板 24、内容卡片 18、内部小卡片 12；
  // 桌面工作经历是连续索引条，使用 0 圆角；操作控件使用胶囊，圆形控制使用 50%；
  // 内容层不再叠加第二层模糊。
  surfaceHierarchy: async (page) => {
    return page.evaluate(() => {
      const visible = (selector) => [...document.querySelectorAll(selector)].filter((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      });
      const bad = [];
      const assertRadius = (selector, expected, label) => {
        for (const el of visible(selector)) {
          const actual = getComputedStyle(el).borderRadius;
          if (actual !== expected) bad.push(`${label}: ${el.className || el.tagName}=${actual}，应为${expected}`);
        }
      };
      assertRadius('header, header.is-condensed, #profile .career-strip, .impact-glass, #contact .footer-contact-copy, .floating-dock-panel', '24px', '外层面板圆角');
      assertRadius('#top .hero-proof-card, #projects .comet-archive__image, #profile .career-image, #recognition .impact-award-card, #impact-reach .impact-reach-profile-media, #experiments .flip-experiment__row', '18px', '内容卡片圆角');
      assertRadius('#recognition .impact-platform-desktop-tile, #recognition .impact-platform-mobile-tile, .floating-dock-item', '12px', '内部卡片圆角');
      assertRadius('#profile .career-tab', window.innerWidth > 760 ? '0px' : '12px', '工作经历阶段圆角');
      assertRadius('.hero-actions button, .impact-qr-dialog-actions a, .comet-archive__meta, .impact-reach-profile-hover-label, .video-tuner__toggle', '999px', '操作控件圆角');
      assertRadius('.back-to-top, .brand, .footer-avatar, header .nav-lang, header .nav-contact-icon, .nav-toggle, .mobile-nav-close, .impact-award-rail-nav, .impact-award-card-zoom, .impact-award-lightbox-nav, .impact-award-lightbox-close, .comet-archive-page-arrow, .footer-social a', '50%', '圆形控件圆角');

      const panel = visible('header')[0];
      if (panel) {
        const reference = getComputedStyle(panel);
        for (const el of visible('#profile .career-strip, .impact-glass, #contact .footer-contact-copy, .floating-dock-panel')) {
          const style = getComputedStyle(el);
          if (style.backgroundColor !== reference.backgroundColor || style.backdropFilter !== reference.backdropFilter || style.boxShadow !== reference.boxShadow) {
            bad.push(`外层材质不一致: ${el.className || el.tagName}`);
          }
        }
      }
      for (const el of visible('#projects .comet-archive__image, #profile .career-image, #recognition .impact-award-card, #impact-reach .impact-reach-profile-media, #recognition .impact-platform-desktop-tile, #recognition .impact-platform-mobile-tile, #profile .career-tab, .floating-dock-item')) {
        if (getComputedStyle(el).backdropFilter !== 'none') bad.push(`内容层仍有模糊: ${el.className || el.tagName}`);
      }
      return { ok: bad.length === 0, detail: bad.join(' | ') };
    });
  },
  // 移动端菜单必须把 7 个入口作为同一组动画打开；抽屉本体保持锚定，只做透明度过渡，避免打开/关闭时整体位移；同时禁止 transition: all。
  motionSystem: async (page) => {
    if (page.viewportSize().width > 760) return { ok: true };
    return page.evaluate(() => {
      const bad = [];
      const drawer = document.querySelector('#mobile-nav-drawer');
      const items = [...document.querySelectorAll('#mobile-primary-nav .nav-list li')];
      if (!drawer || items.length !== 7) return { ok: false, detail: `移动菜单项目数 ${items.length}，应为 7` };

      const wasOpen = document.body.classList.contains('mobile-nav-open');
      const wasDrawerOpen = drawer.classList.contains('is-open');
      document.body.classList.add('mobile-nav-open');
      drawer.classList.add('is-open');
      const drawerStyle = getComputedStyle(drawer);
      const itemStyles = items.map((item) => getComputedStyle(item));
      const delays = itemStyles.map((style) => parseFloat(style.animationDelay) || 0);
      if (drawerStyle.transitionProperty === 'none') bad.push('菜单抽屉没有过渡');
      if (!drawerStyle.transitionProperty.split(',').map((value) => value.trim()).includes('opacity')) bad.push('菜单抽屉缺少 opacity 过渡');
      if (drawerStyle.transform !== 'none') bad.push('菜单抽屉不应发生整体位移');
      if (itemStyles.some((style) => style.animationName !== 'mobile-nav-item-in')) bad.push('7 个菜单项没有统一入场动画');
      if (new Set(itemStyles.map((style) => style.animationDuration)).size !== 1) bad.push('菜单项动画时长不一致');
      if (new Set(itemStyles.map((style) => style.animationTimingFunction)).size !== 1) bad.push('菜单项 easing 不一致');
      if (delays.some((delay, index) => index > 0 && delay <= delays[index - 1])) bad.push('菜单项延迟没有递增');
      if (Math.max(...delays) > .18) bad.push(`最后菜单项延迟 ${Math.round(Math.max(...delays) * 1000)}ms 过长`);
      for (const el of document.querySelectorAll('body *')) {
        const style = getComputedStyle(el);
        const hasMotion = style.transitionDuration.split(',').some((value) => parseFloat(value) > 0);
        if (hasMotion && style.transitionProperty.split(',').map((value) => value.trim()).includes('all')) {
          bad.push(`发现 transition: all: ${el.className || el.tagName}`);
          break;
        }
      }
      if (!wasOpen) document.body.classList.remove('mobile-nav-open');
      if (!wasDrawerOpen) drawer.classList.remove('is-open');
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
  // 当前工作经历只有一个可见详情面板，检查动态切换后的内容是否被容器裁剪。
  careerPanelNoOverflow: async (page) => {
    return page.evaluate(() => {
      const panel = document.querySelector('.career-detail');
      if (!panel) return { ok: true };
      const overflow = panel.scrollHeight - panel.clientHeight;
      return { ok: overflow <= 1, detail: `详情面板内容 ${panel.scrollHeight}px / 容器 ${panel.clientHeight}px` };
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
            for (const name of ['navFits', 'archiveKickNoClip', 'archiveAwardNoClip', 'awardPaginationVisible']) {
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
