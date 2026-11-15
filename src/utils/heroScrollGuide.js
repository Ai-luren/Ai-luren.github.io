// Reusable, non-interactive cinematic scroll hint. Visible whenever the
// opening Hero again dominates the viewport, not only on the first visit.
// Keep the guide out of the way as soon as the visitor explores other chapters.
export function initHeroScrollGuide() {
  const cue = document.getElementById('hero-scroll-guide');
  const hero = document.getElementById('top');
  if (!cue || !hero) return;

  let raf = 0;
  const update = () => {
    raf = 0;
    const bounds = hero.getBoundingClientRect();
    const height = window.innerHeight;
    // Small hysteresis prevents a one-pixel boundary from flashing the
    // instruction during touch/momentum scrolling near the chapter seam.
    const showing = cue.dataset.visible === 'true';
    const threshold = showing ? 0.53 : 0.62;
    const inHero = bounds.top <= height * .18 &&
      bounds.bottom >= height * threshold;
    cue.dataset.visible = String(inHero);
  };
  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(update);
  };

  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  addEventListener('pageshow', schedule, { passive: true });
  // On back/forward and hash travel, the browser can restore the scroll
  // position a few frames after the navigation event.
  addEventListener('popstate', schedule);
  addEventListener('hashchange', schedule);

  requestAnimationFrame(() => requestAnimationFrame(() =>
    requestAnimationFrame(() => requestAnimationFrame(update))
  ));
}
