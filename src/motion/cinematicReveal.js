import { initEditorialHeadings } from './editorialHeadings.js';

/**
 * Cinematic Dolly Through — a scroll-scrubbed, reversible foreground layer.
 *
 * Apple-style principle: scrolling IS the timeline, not just a start event.
 * One static grid is the geometry anchor; entire card wrappers move relative
 * to the grid, so scaling a card never changes its own progress calculation.
 *
 * This owns only card-wrapper transforms. Headlines, images, buttons, glass
 * treatments, player state, and the existing film-background parallax keep
 * their original owners. No opacity-0, filter blur, DOM wrappers or pinning.
 */
const HOME_TARGETS = [
  ['#projects .comet-card', 'work'],
  ['#recognition .impact-glass', 'panel'],
  ['#experiments .flip-experiment', 'panel'],
  ['#profile .closing-card', 'panel'],
];
// Endpoints are intentional design values, not measurements of Apple's site.
// A card spends the central 48% of its viewport transit at full resolution.
const PRESETS = Object.freeze({
  // Camera approaches the card and continues THROUGH it on exit.
  // Shrinking on both entrance and departure reverses apparent depth and
  // looks especially wrong when holding ArrowUp. Exit instead advances only
  // a subtle 1-2% beyond 1:1; the primary interaction remains native scroll.
  homeDesktop: { enterY: 138, enterScale: .885, exitY: -60, exitScale: 1.02 },
  homeMobile: { enterY: 84, enterScale: .936, exitY: -36, exitScale: 1.012 },
  // Interactive information glass must never shrink its 44px touch targets
  // or shift its horizontal alignment against Expertise headings.
  panelDesktop: { enterY: 44, enterScale: 1, exitY: -12, exitScale: 1 },
  panelMobile: { enterY: 30, enterScale: 1, exitY: -8, exitScale: 1 },
});
const ENTER_END = .33;
const EXIT_START = .75;
const VISIBLE_START = .94; // Card top crossing 94vh starts the scene
const VISIBLE_END = .12; // Card bottom crossing 12vh finishes the scene
const clamp = n => Math.max(0, Math.min(1, n));
// Minimum-jerk S curve: zero slope/acceleration at the joins, so continuous
// keyboard scroll never makes an object visibly snap into / out of motion.
const minimumJerk = n => n * n * n * (n * (n * 6 - 15) + 10);

export function initCinematicReveals() {
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  // Mobile Safari/Chrome collapses the address bar on ordinary scroll. GSAP
  // otherwise refreshes every trigger for those height-only viewport ticks,
  // even when our own card/heading geometry hasn't changed.
  ScrollTrigger?.config?.({ ignoreMobileResize: true });
  const root = document.getElementById('main-content');
  if (!root) return () => {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const disposeHeadings = initEditorialHeadings(root);
  const records = new Map();
  const triggers = new Map();
  let frame = 0;
  let refreshFrame = 0;
  let destroyed = false;
  let previousViewportWidth = innerWidth;

  // Match existing site preference handling; don't infer reduced transparency
  // from reduced motion because those are separate settings.
  const enabled = () => Boolean(gsap && ScrollTrigger && !reduced.matches);


  function apply(rec, value, state) {
    const { node } = rec;
    const signature = state + ':' + Math.round(value.y * 10) + ':' + Math.round(value.scale * 10000);
    // These data fields describe live scrub progress even during the held
    // reading plateau where no CSS transform needs updating.
    node.dataset.cinematicState = state;
    node.dataset.cinematicProgress = String(Math.round(value.progress * 1000) / 1000);
    if (rec.lastSignature === signature) return;
    rec.lastSignature = signature;
    if (state === 'reading') {
      // Fonts and 3:4 artwork must be razor-sharp in the reading portion;
      // leaving a 3D/composited transform here causes unnecessary shimmer.
      if (rec.transformActive) {
        gsap.set(node, { clearProps: 'transform,transformOrigin,willChange' });
        rec.transformActive = false;
      }
      return;
    }
    rec.transformActive = true;
    gsap.set(node, {
      x: 0,
      y: value.y,
      scale: value.scale,
      transformOrigin: '50% 50%',
      force3D: false,
      // No blur, rotationX, alpha, CSS mask or continuous shadow animation.
    });
  }

  function update() {
    frame = 0;
    if (destroyed || !enabled()) return;
    const viewport = innerHeight;
    // Match the site's actual 760/761px navigation and layout breakpoint.
    const mobile = matchMedia('(max-width: 760px)').matches;
    const workSettings = PRESETS[mobile ? 'homeMobile' : 'homeDesktop'];
    const panelSettings = PRESETS[mobile ? 'panelMobile' : 'panelDesktop'];
    // Reading one untransformed anchor per section avoids per-card layout work.
    const anchorMetrics = new Map();
    const stages = [];

    // READ PHASE: locate every card against an untransformed grid first.
    // Do not read bounding boxes between gsap.set calls, or the browser
    // can be forced to recalculate layout for every card in the same frame.
    for (const rec of records.values()) {
      if (!rec.node.isConnected) continue;
      const settings = rec.kind === 'work' ? workSettings : panelSettings;
      let anchorTop = anchorMetrics.get(rec.anchor);
      if (anchorTop === undefined) {
        anchorTop = rec.anchor.getBoundingClientRect().top;
        anchorMetrics.set(rec.anchor, anchorTop);
      }
      // The anchor follows any existing cinematic background translation,
      // while the measured card offset never includes its own transform.
      const top = anchorTop + rec.anchorOffset;
      const height = rec.height;
      const total = Math.max(1, viewport * (VISIBLE_START - VISIBLE_END) + height);
      let progress = clamp((viewport * VISIBLE_START - top) / total);
      if (rec.kind === 'work') {
        progress = clamp(progress - Math.min(rec.column, 3) *
          .022);
      }
      // Short viewports need a gentler approach without changing the
      // full-screen desktop composition or the scroll-driven timeline.
      const viewportFactor = Math.min(1, Math.max(.7, viewport / 820));
      let y = 0;
      let scale = 1;
      let state = 'reading';
      if (progress < ENTER_END) {
        const t = minimumJerk(progress / ENTER_END);
        y = settings.enterY * viewportFactor * (1 - t);
        scale = settings.enterScale + (1 - settings.enterScale) * t;
        state = 'entering';
      } else if (progress > EXIT_START) {
        const t = minimumJerk((progress - EXIT_START) / (1 - EXIT_START));
        y = settings.exitY * viewportFactor * t;
        scale = 1 + (settings.exitScale - 1) * t;
        state = 'exiting';
      }
      stages.push([rec, { progress, y, scale }, state]);
    }

    // WRITE PHASE: one batched pass for transform updates, with each card's
    // full-resolution reading phase explicitly cleared. No alpha changes.
    for (const [rec, value, state] of stages) apply(rec, value, state);
  }

  function queueUpdate() {
    if (!frame && !destroyed) frame = requestAnimationFrame(update);
  }

  function disposeGrid(grid) {
    const trigger = triggers.get(grid);
    trigger?.kill();
    triggers.delete(grid);
  }

  function discover() {
    if (destroyed) return;
    for (const [node, rec] of records) {
      if (node.isConnected && root.contains(node)) continue;
      gsap?.set(node, { clearProps: 'transform,transformOrigin,willChange' });
      records.delete(node);
    }
    const groups = new Set();
    for (const [selector, kind] of HOME_TARGETS) {
      for (const node of root.querySelectorAll(selector)) {
        if (records.has(node)) {
          if (kind === 'work') groups.add(records.get(node).anchor);
          continue;
        }
        const anchor = kind === 'work'
          ? node.closest('.comet-archive, .library-grid')
          : node.closest('.impact-glass, .flip-experiment, .closing-card')?.parentElement || node.parentElement;
        if (!anchor) continue;
        const allSiblings = kind === 'work'
          ? [...anchor.querySelectorAll('.comet-card')] : [node];
        const index = allSiblings.indexOf(node);
        const colCount = kind === 'work'
          ? Math.max(1, getComputedStyle(anchor).gridTemplateColumns.trim().split(/\s+/).length)
          : 1;
        const rec = {
          node, kind, anchor,
          column: Math.max(0, index) % colCount,
          anchorOffset: node.getBoundingClientRect().top - anchor.getBoundingClientRect().top,
          height: node.offsetHeight,
          transformActive: false, lastSignature: null,
        };
        records.set(node, rec);
        node.dataset.cinematicReveal = kind;
        node.dataset.cinematicMode = 'dolly-scrub';
        if (kind === 'work') groups.add(anchor);
      }
    }
    for (const grid of triggers.keys()) if (!groups.has(grid)) disposeGrid(grid);
    if (enabled()) {
      // Register a single ScrollTrigger per grid. A static grid drives ALL its
      // rows without measuring transformed card rectangles on every frame.
      for (const grid of groups) {
        if (triggers.has(grid)) continue;
        triggers.set(grid, ScrollTrigger.create({
          trigger: grid,
          start: 'top bottom',
          end: 'bottom top',
          invalidateOnRefresh: true,
          onUpdate: queueUpdate,
          onRefresh: queueUpdate,
          onToggle: queueUpdate,
        }));
      }
    }
    queueUpdate();
  }

  let queuedDiscovery = false;
  function queueDiscovery() {
    if (queuedDiscovery) return;
    queuedDiscovery = true;
    requestAnimationFrame(() => {
      queuedDiscovery = false;
      discover();
    });
  }

  function onLayoutChange() {
    if (refreshFrame) cancelAnimationFrame(refreshFrame);
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = 0;
      // Clear every moving layer BEFORE any measurements. Reapply the current
      // scroll pose inside this same paint frame: no one-frame flash on resize,
      // language change, or category changes.
      for (const rec of records.values()) {
        if (rec.transformActive) {
          gsap?.set(rec.node, { clearProps: 'transform,transformOrigin,willChange' });
          rec.transformActive = false;
        }
        rec.lastSignature = null;
      }
      const anchors = new Map();
      for (const rec of records.values()) {
        if (!rec.node.isConnected || !rec.anchor.isConnected) continue;
        let anchorTop = anchors.get(rec.anchor);
        if (anchorTop === undefined) {
          anchorTop = rec.anchor.getBoundingClientRect().top;
          anchors.set(rec.anchor, anchorTop);
        }
        rec.anchorOffset = rec.node.getBoundingClientRect().top - anchorTop;
        rec.height = rec.node.offsetHeight;
        if (rec.kind === 'work') {
          const siblings = [...rec.anchor.querySelectorAll('.comet-card')];
          const columns = Math.max(1, getComputedStyle(rec.anchor).gridTemplateColumns.trim().split(/\s+/).length);
          rec.column = Math.max(0, siblings.indexOf(rec.node)) % columns;
        }
      }
      ScrollTrigger?.refresh();
      if (frame) cancelAnimationFrame(frame);
      update();
    });
  }

  function onViewportResize() {
    // Safari / mobile browser bars resize the VISUAL viewport during a swipe.
    // Releasing every card transform and refreshing ScrollTrigger for each
    // address-bar tick causes exactly the flashing / backward jank we avoid.
    // Only an actual width/layout-breakpoint change needs remeasurement.
    if (innerWidth === previousViewportWidth) { queueUpdate(); return; }
    previousViewportWidth = innerWidth;
    onLayoutChange();
  }

  function onReducedChange() {
    for (const rec of records.values()) {
      if (reduced.matches) {
        gsap?.set(rec.node, { clearProps: 'transform,transformOrigin,willChange' });
        rec.transformActive = false;
        rec.node.dataset.cinematicState = 'reading';
      } else rec.lastSignature = null;
    }
    if (reduced.matches) {
      // Stop the ScrollTrigger work entirely while reduced motion is active,
      // rather than leaving listeners observing a visually static page.
      for (const grid of [...triggers.keys()]) disposeGrid(grid);
    } else {
      // Re-enable after a live OS preference change without refreshing page.
      discover();
    }
    queueUpdate();
  }

  const mutation = new MutationObserver(queueDiscovery);
  mutation.observe(root, { childList: true, subtree: true });
  window.addEventListener('scroll', queueUpdate, { passive: true });
  window.addEventListener('resize', onViewportResize, { passive: true });
  window.addEventListener('portfolio:react-ready', onLayoutChange);
  reduced.addEventListener?.('change', onReducedChange);
  discover();

  window.__cinematicReveal = {
    page: 'home', source: 'Cinematic Dolly Through / GSAP ScrollTrigger',
    get size() { return records.size; },
    get activeGrids() { return triggers.size; },
    presets: PRESETS,
    reversible: true,
    mode: 'scrub',
  };

  return () => {
    destroyed = true;
    disposeHeadings();
    mutation.disconnect();
    cancelAnimationFrame(frame);
    cancelAnimationFrame(refreshFrame);
    window.removeEventListener('scroll', queueUpdate);
    window.removeEventListener('resize', onViewportResize);
    window.removeEventListener('portfolio:react-ready', onLayoutChange);
    reduced.removeEventListener?.('change', onReducedChange);
    for (const grid of triggers.keys()) disposeGrid(grid);
    for (const rec of records.values()) {
      gsap?.set(rec.node, { clearProps: 'transform,transformOrigin,willChange' });
      delete rec.node.dataset.cinematicReveal;
      delete rec.node.dataset.cinematicState;
      delete rec.node.dataset.cinematicProgress;
      delete rec.node.dataset.cinematicMode;
    }
    records.clear();
    if (window.__cinematicReveal?.page === 'home') delete window.__cinematicReveal;
  };
}
