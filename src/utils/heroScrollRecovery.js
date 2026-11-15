// Homepage scroll-scrub timeline can grow after GSAP/React mount.
// Restore a real reading position on reload/Back, but NEVER force scrollTo(0)
// and NEVER override any new user wheel, touch, pointer, or keyboard input.
const KEY = 'ailuren-home-scroll-15s-v1';
const pathKey = () => location.pathname + location.search + location.hash;
const maxScroll = () => Math.max(0, document.documentElement.scrollHeight - innerHeight);
const read = () => {
  try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); }
  catch { return null; }
};

addEventListener('pagehide', () => {
  try {
    const max = maxScroll();
    sessionStorage.setItem(KEY, JSON.stringify({
      url: pathKey(),
      pixel: scrollY,
      ratio: max > 0 ? scrollY / max : 0,
      width: innerWidth,
      at: Date.now(),
    }));
  } catch { /* Storage can be unavailable in private browsing. */ }
});

const navType = performance.getEntriesByType('navigation')[0]?.type;
if (navType === 'reload' || navType === 'back_forward') {
  const saved = read();
  if (saved?.url === pathKey() && Number.isFinite(saved.pixel)
      && Number.isFinite(saved.ratio) && Number.isFinite(saved.width)
      && Date.now() - saved.at < 30 * 60 * 1000) {
    let cancelled = false;
    let finished = false;
    let fallback;
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    const cancel = () => { cancelled = true; cleanup(); };
    const cleanup = () => {
      clearTimeout(fallback);
      events.forEach(name => removeEventListener(name, cancel));
      removeEventListener('portfolio:react-ready', onReady);
    };
    const restore = () => {
      if (finished || cancelled) { cleanup(); return; }
      finished = true;
      cleanup();
      const max = maxScroll();
      const target = saved.width === innerWidth ? saved.pixel : saved.ratio * max;
      const clamped = Math.max(0, Math.min(max, target));
      if (Math.abs(scrollY - clamped) > 10) {
        scrollTo({ top: clamped, behavior: 'instant' });
        dispatchEvent(new Event('scroll'));
      }
    };
    // The journey performs a two-rAF GSAP ScrollTrigger.refresh after React.
    // Restore on the THIRD frame; restoring in the same frame as refresh gets
    // overwritten by GSAP's internal scroll position bookkeeping.
    const onReady = () => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(restore)));
    events.forEach(name => addEventListener(name, cancel, { passive: true }));
    addEventListener('portfolio:react-ready', onReady, { once: true });
    fallback = setTimeout(restore, 1200);
  }
}
