// Local-only C+ scroll preview; historical A/B modes are retired.
import { activateImmersive, deactivateImmersive } from './heroImmersivePreview.js';
const KEY = 'ailuren-local-hero-review';
const values = new Set(['immersive-long']);
const isJourneyMode = (value) => value === 'immersive-long';
const search = new URLSearchParams(location.search);
const rawQuery = search.get('heroReview');
const queryMode = rawQuery === 'immersive' ? 'immersive-long' : (values.has(rawQuery) ? rawQuery : null);
const savedMode = localStorage.getItem(KEY);
const isRequested = queryMode !== null || (rawQuery === null && (values.has(savedMode) || savedMode === 'immersive'));

if (isRequested) {
  const mode = queryMode || 'immersive-long';
  const css = document.createElement('style');
  css.id = 'local-hero-review-style';
  css.textContent = `
    html[data-hero-review="immersive-long"] :is(
      #video-webgl, #hero-profile-mask, #video-dim,
      #video-overlay, #video-vignette, #hero-first-frame
    ) {
      display: none !important;
      opacity: 0 !important;
    }
    html[data-hero-review="immersive-long"] #video-bg {
      background: #000 !important;
    }
    html[data-hero-review="immersive-long"] #hero-video {
      opacity: 1 !important;
      filter: none !important;
      visibility: visible !important;
    }
    /* Dev-only 15s cinematographic travel. Section IDs and layout stay intact. */
    html[data-hero-review="immersive-long"] .hero-journey-flight {
      display: block; width: 100%; pointer-events: none; position: relative;
    }
    html[data-hero-review="immersive-long"] #projects .section-intro,
    html[data-hero-review="immersive-long"] #projects .motion-stage,
    html[data-hero-review="immersive-long"] #recognition .section-intro,
    html[data-hero-review="immersive-long"] #recognition .recognition-react-root {
      translate: 0 var(--hero-journey-offset, 0px);
    }
    /* Text-only contrast, with no bounded video masks. */
    html[data-hero-review="immersive-long"] #projects .section-note,
    html[data-hero-review="immersive-long"] #projects .projects-meta-row,
    html[data-hero-review="immersive-long"] #recognition .section-intro,
    html[data-hero-review="immersive-long"] #experiments .section-intro {
      text-shadow: 0 2px 12px rgba(0,0,0,.9), 0 0 26px rgba(0,0,0,.45);
    }
    /* 15-second film, not the retired 20-second cut.
       0-5.5s gravity-city; 5.5-8s ship; 8-11s industrial interior;
       11-15s ring / cloud city. Preserve the content layout and invest
       roughly 2.4 video-seconds in each full desktop screen of scrolling. */
    html[data-hero-review="immersive-long"] .hero-journey-flight {
      height: clamp(300px, 50svh, 590px);
    }
    html[data-hero-review="immersive-long"] .hero-journey-flight--after-projects {
      height: clamp(330px, 55svh, 640px);
    }
    html[data-hero-review="immersive-long"] .hero-journey-flight--after-recognition {
      height: clamp(330px, 63svh, 700px);
    }
    html[data-hero-review="immersive-long"] .hero-journey-flight--outro {
      height: clamp(160px, 30svh, 320px);
    }
    /* Cloud-sea contrast is fixed on text only, not via a dark video mask. */
    html[data-hero-review="immersive-long"] #experiments .section-title {
      text-shadow: 0 2px 13px rgba(0,0,0,.94), 0 0 30px rgba(0,0,0,.68);
    }
    @media (max-width: 760px), (prefers-reduced-motion: reduce) {
      html[data-hero-review="immersive-long"] .hero-journey-flight,
      html[data-hero-review="immersive-long"] .hero-journey-flight--after-top,
      html[data-hero-review="immersive-long"] .hero-journey-flight--after-projects,
      html[data-hero-review="immersive-long"] .hero-journey-flight--after-recognition {
        height: clamp(55px, 13svh, 115px);
      }
      /* Mobile still uses the original 15-second clip and compact spacing. */
      html[data-hero-review="immersive-long"] .hero-journey-flight--outro {
        height: clamp(40px, 9svh, 80px);
      }
      html[data-hero-review="immersive-long"] #projects .section-intro,
      html[data-hero-review="immersive-long"] #projects .motion-stage,
      html[data-hero-review="immersive-long"] #recognition .section-intro,
      html[data-hero-review="immersive-long"] #recognition .recognition-react-root {
        translate: none;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      /* A static background should not create extra empty travel distance. */
      html[data-hero-review="immersive-long"] .hero-journey-flight {
        height: 0 !important;
      }
    }
    /* One quiet status indicator and one exit: no dead visual-test presets. */
    #local-hero-review {
      position: fixed; right: max(16px, env(safe-area-inset-right));
      bottom: max(16px, env(safe-area-inset-bottom));
      z-index: 2147483646; display: flex; align-items: center;
      gap: 9px; padding: 5px 5px 5px 12px; max-width: calc(100vw - 32px);
      border: 1px solid #ffffff33; border-radius: 999px;
      background: rgba(13, 15, 20, .88); color: #f5f5f7;
      box-shadow: 0 7px 24px #0008;
      font: 11px/1.3 -apple-system, BlinkMacSystemFont, sans-serif;
    }
    #local-hero-review .preview-mobile { display: none; }
    #local-hero-review button {
      min-height: 32px; border: 1px solid #ffffff32;
      border-radius: 999px; background: #ffffff14; color: inherit;
      padding: 6px 11px; font: inherit; cursor: pointer;
    }
    #local-hero-review button:hover { background: #ffffff26; }
    #local-hero-review button:focus-visible {
      outline: 2px solid #fff; outline-offset: 2px;
    }
    @media (max-width: 760px) {
      #local-hero-review .preview-desktop { display: none; }
      #local-hero-review .preview-mobile { display: inline; }
    }
  `;
  document.head.appendChild(css);

  const heroVideo = document.getElementById('hero-video');
  const originalPoster = heroVideo?.getAttribute('poster');
  const syncPoster = (mode) => {
    if (!heroVideo) return;
    // The published poster still shows the old ship while the experimental
    // desktop film shows the city. Avoid this false scene flash while loading.
    if (mode !== 'normal') heroVideo.removeAttribute('poster');
    else if (originalPoster !== null) heroVideo.setAttribute('poster', originalPoster);
  };

  const root = document.createElement('div');
  root.id = 'local-hero-review';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', '本地 Hero 视觉及滚动验收');
  const status = document.createElement('span');
  status.className = 'preview-desktop';
  status.textContent = '15秒节奏 C+ · 本地预览';
  root.appendChild(status);
  const mobileStatus = document.createElement('span');
  mobileStatus.className = 'preview-mobile';
  mobileStatus.textContent = '本地预览 · 移动端';
  root.appendChild(mobileStatus);
  const exit = document.createElement('button');
  exit.type = 'button';
  exit.textContent = '退出 ×';
  exit.dataset.exit = '';
  root.appendChild(exit);

  function setMode(next) {
    if (!values.has(next)) return;
    const previous = document.documentElement.dataset.heroReview;
    const progress = window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    if (isJourneyMode(previous) && !isJourneyMode(next)) deactivateImmersive();
    document.documentElement.dataset.heroReview = next;
    syncPoster(next);
    if (isJourneyMode(next)) activateImmersive();
    // Preserve the current video frame if re-entering this local preview.
    if (previous && previous !== next) {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      window.scrollTo({ top: Math.round(progress * maxScroll), behavior: 'instant' });
      window.dispatchEvent(new Event('scroll'));
    }
    window.__heroReviewMode = next;
    localStorage.setItem(KEY, next);
    // Keep the local C+ URL and persisted state in sync without a new entry.
    if (previous && previous !== next) {
      const url = new URL(location.href);
      url.searchParams.set('heroReview', next);
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    }
      window.dispatchEvent(new CustomEvent('hero-review-mode-change', { detail: { mode: next } }));
  }

  exit.addEventListener('click', () => {
    const progress = window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    deactivateImmersive();
    syncPoster('normal');
    document.documentElement.removeAttribute('data-hero-review');
    window.__heroReviewMode = 'normal';
    localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent('hero-review-mode-change', { detail: { mode: 'normal' } }));
    css.remove();
    root.remove();
    window.scrollTo({
      top: Math.round(progress * Math.max(1, document.documentElement.scrollHeight - window.innerHeight)),
      behavior: 'instant',
    });
    window.dispatchEvent(new Event('scroll'));
    const url = new URL(location.href);
    url.searchParams.delete('heroReview');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  });

  setMode(mode);
  if (rawQuery === 'immersive') {
    const url = new URL(location.href);
    url.searchParams.set('heroReview', mode);
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  }

  // Preserve the C+ preview's native reading position on refresh/Back.
  // A late-rendered React section can make the browser clamp its first restore
  // against the old, shorter DOM. This is one guarded local-preview recovery,
  // never a forced scroll-to-top or a change to the published page.
  const positionKey = 'ailuren-dev-hero-b-position';
  const urlKey = () => location.pathname + location.search + location.hash;
  window.addEventListener('pagehide', () => {
    if (!isJourneyMode(document.documentElement.dataset.heroReview)) return;
    try {
      sessionStorage.setItem(positionKey, JSON.stringify({
        url: urlKey(),
        pixel: scrollY,
        ratio: scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight),
        width: innerWidth,
        at: Date.now(),
      }));
    } catch { /* Private browsing may disable session storage. */ }
  });

  const navType = performance.getEntriesByType('navigation')[0]?.type;
  let previousPosition = null;
  if (isJourneyMode(mode) && (navType === 'reload' || navType === 'back_forward')) {
    try {
      const stored = JSON.parse(sessionStorage.getItem(positionKey) || 'null');
      if (stored?.url === urlKey() && Date.now() - stored.at < 30 * 60 * 1000
        && Number.isFinite(stored.ratio) && Number.isFinite(stored.pixel)) {
        previousPosition = stored;
      }
    } catch { /* An outdated entry must never break navigation. */ }
  }

  // Fresh hash navigation also needs one pass after React and the site's own
  // initial hash-alignment logic finish. Any real user input cancels both paths.
  const initialHash = location.hash.slice(1);
  const shouldCorrectHash = initialHash && initialHash !== 'top'
    && navType !== 'reload' && navType !== 'back_forward';
  if (previousPosition || shouldCorrectHash) {
    let cancelled = false;
    let done = false;
    let fallback = 0;
    const userEvents = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    const interrupt = () => { cancelled = true; cleanup(); };
    const cleanup = () => {
      userEvents.forEach(type => window.removeEventListener(type, interrupt));
      window.removeEventListener('portfolio:react-ready', onReady);
      clearTimeout(fallback);
    };
    const correctPosition = () => {
      if (done || cancelled) { cleanup(); return; }
      done = true;
      cleanup();
      let desired;
      if (previousPosition && isJourneyMode(document.documentElement.dataset.heroReview)) {
        const max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
        desired = previousPosition.width === innerWidth
          ? previousPosition.pixel
          : previousPosition.ratio * max;
      } else if (shouldCorrectHash && location.hash.slice(1) === initialHash) {
        const target = document.getElementById(decodeURIComponent(initialHash));
        if (!target) return;
        const anchor = initialHash === 'contact'
          ? document.querySelector('#profile .closing-card') || target
          : target.querySelector('.section-intro') || target;
        const rootStyle = getComputedStyle(document.documentElement);
        const headerBottom = document.querySelector('header')?.getBoundingClientRect().bottom || 0;
        const offset = Math.max(
          parseFloat(rootStyle.getPropertyValue('--anchor-offset')) || parseFloat(rootStyle.scrollPaddingTop) || 0,
          headerBottom + 12
        );
        desired = anchor.getBoundingClientRect().top + scrollY - offset;
      }
      if (!Number.isFinite(desired)) return;
      desired = Math.max(0, Math.min(document.documentElement.scrollHeight - innerHeight, desired));
      if (Math.abs(scrollY - desired) > 12) {
        scrollTo({ top: desired, behavior: 'instant' });
        window.dispatchEvent(new Event('scroll'));
      }
    };
    const onReady = () => requestAnimationFrame(() => requestAnimationFrame(correctPosition));
    userEvents.forEach(type => window.addEventListener(type, interrupt, { passive: true }));
    window.addEventListener('portfolio:react-ready', onReady, { once: true });
    fallback = setTimeout(correctPosition, 1500);
  }

  // The control stays outside the masked page so it works while main is hidden.
  if (document.body) document.body.appendChild(root);
  else document.addEventListener('DOMContentLoaded', () => document.body.appendChild(root), { once: true });
}
