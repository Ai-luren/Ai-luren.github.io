(function () {
// Same-origin, cross-document View Transitions (Edge/Chrome).
// Add the SAME type on both sides of a navigation, before the browser paints.
// All other links retain the original unobtrusive cross-fade.
const pageKind = (url) => {
  if (!url) return null;
  try {
    const target = new URL(url, location.href);
    if (target.origin !== location.origin) return null;
    if (/\/works\.html$/.test(target.pathname)) return 'archive';
    if (/(?:\/|\/index\.html)$/.test(target.pathname)) return 'film';
  } catch { /* Malformed URL: keep the native navigation. */ }
  return null;
};
const transitionType = (from, to) => {
  const previous = pageKind(from);
  const next = pageKind(to);
  if (previous === 'film' && next === 'archive') return 'to-archive';
  if (previous === 'archive' && next === 'film') return 'to-film';
  return null;
};

addEventListener('pagehide', clearCue);
addEventListener('pageswap', (event) => {
  clearCue();
  const type = transitionType(location.href, event.activation?.entry?.url);
  if (type && event.viewTransition?.types?.add) event.viewTransition.types.add(type);
});

// One-shot, screen-reader-silent visual feedback for the two gallery
// navigations. Do not intercept anchors or history.back(): native navigation
// owns scroll restoration, the current Hero video frame and browser BFCache.
const CUE_MS = 660;
let activeCue = null;
function readLocale() {
  try {
    const lang = localStorage.getItem('ailuren-lang');
    if (lang === 'en' || lang === 'zh') return lang;
  } catch { /* Storage may be disabled. */ }
  return document.documentElement.lang.toLowerCase().startsWith('en') ? 'en' : 'zh';
}
function cueCopy() {
  // A deliberately minimal single line. Percent is the cinematic transition
  // timeline, not a claim that network resources have finished downloading.
  return readLocale() === 'en' ? 'Loading' : '加载中';
}
function clearCue() {
  if (!activeCue) return;
  cancelAnimationFrame(activeCue.frame);
  clearTimeout(activeCue.timeout);
  const element = activeCue.element;
  activeCue = null;
  try { if (element.matches(':popover-open')) element.hidePopover(); } catch {}
  element.remove();
}
function showCue(type, viewTransition) {
  if (!viewTransition || !['to-film','to-archive'].includes(type) ||
      matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  clearCue();
  const element = document.createElement('div');
  element.className = 'portfolio-route-cue';
  element.id = 'portfolio-route-cue';
  element.setAttribute('aria-hidden','true');
  element.setAttribute('popover','manual');
  const label = cueCopy();
  // One concise label and subtle glow: no third-party animation library.
  element.innerHTML = '<div class="portfolio-route-cue__depth"></div>' +
    '<div class="portfolio-route-cue__indicator">' +
      '<div class="portfolio-route-cue__head">' +
        '<span class="portfolio-route-cue__label"></span>' +
        '<div class="portfolio-route-cue__rail">' +
          '<span class="portfolio-route-cue__fill"></span>' +
          '<span class="portfolio-route-cue__playhead"></span>' +
        '</div><span class="portfolio-route-cue__percent"><span>00</span><small>%</small></span>' +
      '</div>' +
    '</div>';
  element.querySelector('.portfolio-route-cue__label').textContent = label;
  if (!document.body) return;
  document.body.appendChild(element);
  try { element.showPopover(); } catch { element.remove(); return; }
  const fill = element.querySelector('.portfolio-route-cue__fill');
  const head = element.querySelector('.portfolio-route-cue__playhead');
  const digits = element.querySelector('.portfolio-route-cue__percent span');
  const started = performance.now();
  const cue = {element,frame:0,timeout:0};
  activeCue = cue;
  // Progress represents this 660ms edit, not image download readiness.
  const draw = now => {
    if (activeCue !== cue) return;
    const p = Math.min(1,Math.max(0,(now-started)/CUE_MS));
    const q = Math.max(0,Math.min(1,(p-.1)/.69));
    const amount = (q*100).toFixed(2)+'%';
    fill.style.width = amount;
    head.style.left = amount;
    digits.textContent = String(Math.round(q*100)).padStart(2,'0');
    if (p < 1) cue.frame=requestAnimationFrame(draw);
    else clearCue();
  };
  cue.frame=requestAnimationFrame(draw);
  cue.timeout=setTimeout(clearCue,CUE_MS+260);
  // If the native transition finishes or gets skipped, never leave a floating
  // loading-looking overlay on the static destination.
  viewTransition.finished.then(clearCue,clearCue);
}

addEventListener('pagereveal', (event) => {
  const source = window.navigation?.activation?.from?.url;
  const type = transitionType(source, location.href);
  if (!type || !event.viewTransition?.types?.add) return;
  event.viewTransition.types.add(type);
  showCue(type,event.viewTransition);
});
}());
