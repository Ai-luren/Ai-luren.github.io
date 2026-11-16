/**
 * Apple-inspired editorial typography — reveal once on first entry.
 *
 * Only section-level editorial headings are targets. Text INSIDE the closing
 * card ("AI 影像创作者" / "开始合作") is content, never a chapter animation.
 * Hero and the All Work catalogue are intentionally outside this timeline.
 *
 * Entrance is scrubbed against the lower viewport, but completes once.
 * Reverse scroll never repeats a fade or repositions a title (as observed
 * on the ordinary editorial headlines of Apple's iPhone Duo / AirPods 5).
 */
const TARGETS = Object.freeze([
  ['#projects .section-intro', 'chapter'],
  ['#recognition .section-intro', 'chapter'],
  ['#impact-awards .impact-evidence-label', 'subchapter'],
  ['#impact-programs .impact-evidence-label', 'subchapter'],
  ['#impact-reach .impact-evidence-label', 'subchapter'],
  ['#experiments .section-intro', 'subchapter'],
]);
const PRESETS = Object.freeze({
  // AirPods 5 observed: editorial headings rise roughly 20-25px as opacity
  // settles; they do not spring, zoom or blur. Keep our requested reverse-
  // scroll response, which is intentionally different from Apple's one-shot.
  chapter: { desktopY: 27, mobileY: 22, enterOpacity: .2 },
  subchapter: { desktopY: 16, mobileY: 12, enterOpacity: .48 },
});
const clamp = n => Math.max(0, Math.min(1, n));
const smooth = n => n * n * (3 - 2 * n);
const ENTER_END = .30;

export function initEditorialHeadings(root) {
  if (!root) return () => {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const records = new Map();
  let frame = 0;
  let discoveryFrame = 0;
  let disposed = false;
  let firstPaint = true;
  let hasUserScrollIntent = false;
  let previousViewportWidth = innerWidth;

  function clear(rec) {
    rec.node.style.removeProperty('transform');
    rec.node.style.removeProperty('opacity');
    rec.node.style.removeProperty('will-change');
    delete rec.node.dataset.editorialTitle;
    delete rec.node.dataset.editorialProgress;
  }

  function discover() {
    discoveryFrame = 0;
    if (disposed) return;
    for (const [node, rec] of records) {
      if (node.isConnected && root.contains(node)) continue;
      clear(rec);
      records.delete(node);
    }
    for (const [selector, level] of TARGETS) {
      const node = root.querySelector(selector);
      if (!node || records.has(node)) continue;
      // Never style a component's internal content as a chapter heading.
      if (node.closest('.closing-card, .comet-card, .impact-glass')) continue;
      const anchor = node.parentElement;
      if (!anchor) continue;
      const top = node.getBoundingClientRect().top;
      const hashId = decodeURIComponent(location.hash.slice(1));
      const hashTarget = hashId ? document.getElementById(hashId) : null;
      const directHash = Boolean(hashTarget && (hashTarget.contains(node) || node.contains(hashTarget)));
      records.set(node, {
        node, anchor, level,
        offset: top - anchor.getBoundingClientRect().top,
        height: node.offsetHeight,
        // Do not flash/replay headings already visible on reload, hash entry,
        // Back/Forward or during the React first commit.
        freezeUntilScroll: firstPaint && (directHash || (top < innerHeight * .88 && top + node.offsetHeight > 0)),
        isDirectHashTarget: directHash,
        revealed: firstPaint && (directHash || (top < innerHeight * .88 && top + node.offsetHeight > 0)),
        lastSignature: null,
      });
    }
    firstPaint = false;
    queueUpdate();
  }

  function update() {
    frame = 0;
    if (disposed) return;
    if (reduced.matches) {
      for (const rec of records.values()) {
        clear(rec);
        rec.node.dataset.editorialTitle = 'stable';
      }
      return;
    }
    const viewport = innerHeight;
    const mobile = innerWidth <= 760;
    const anchorTops = new Map();
    const stages = [];
    // Read layout first; write transforms only after all headings are measured.
    for (const rec of records.values()) {
      if (!rec.node.isConnected) continue;
      if (rec.freezeUntilScroll || rec.revealed) {
        stages.push([rec, 'stable', 0, 1, 1]);
        continue;
      }
      let anchorTop = anchorTops.get(rec.anchor);
      if (anchorTop === undefined) {
        anchorTop = rec.anchor.getBoundingClientRect().top;
        anchorTops.set(rec.anchor, anchorTop);
      }
      const top = anchorTop + rec.offset;
      const start = viewport * .92;
      const end = viewport * .1 - rec.height;
      const progress = clamp((start - top) / Math.max(1, start - end));
      const setting = PRESETS[rec.level];
      const enterY = mobile ? setting.mobileY : setting.desktopY;
      let y = 0;
      let opacity = 1;
      let state = 'reading';
      if (progress < ENTER_END - .004) {
        const t = smooth(progress / ENTER_END);
        y = enterY * (1 - t);
        opacity = setting.enterOpacity + (1 - setting.enterOpacity) * t;
        state = 'entering';
      } else {
        rec.revealed = true;
      }
      // A fully revealed heading stays opaque and static, even if it crosses
      // back through the lower viewport while holding ArrowUp.
      stages.push([rec, state, y, opacity, progress]);
    }
    for (const [rec, state, y, opacity, progress] of stages) {
      const signature = `${state}:${Math.round(y * 100)}:${Math.round(opacity * 1000)}`;
      if (signature === rec.lastSignature) continue;
      rec.lastSignature = signature;
      rec.node.dataset.editorialTitle = state;
      rec.node.dataset.editorialProgress = String(Math.round(progress * 1000) / 1000);
      // The central reading phase must rasterize at full resolution:
      // no 3D transforms, blur, clipping, mask or permanent will-change.
      rec.node.style.transform = Math.abs(y) < .03 ? 'none' : `translateY(${y.toFixed(2)}px)`;
      rec.node.style.opacity = opacity > .999 ? '1' : opacity.toFixed(3);
    }
  }

  function queueUpdate() {
    if (!frame && !disposed) frame = requestAnimationFrame(update);
  }
  function onScroll() {
    // A heading that was visible during initial hash / Back restoration must
    // not become translucent on the very first scroll tick. Keep it fully
    // readable until it has actually moved OUTSIDE the viewport; from there
    // it can safely enter the ordinary lower-edge reveal on either direction.
    for (const rec of records.values()) {
      if (!rec.freezeUntilScroll) continue;
      const bounds = rec.node.getBoundingClientRect();
      if ((!rec.isDirectHashTarget || hasUserScrollIntent) &&
          (bounds.bottom < -20 || bounds.top > innerHeight + 20)) {
        rec.freezeUntilScroll = false;
        rec.lastSignature = null;
      }
    }
    queueUpdate();
  }
  function onLayoutChange() {
    cancelAnimationFrame(discoveryFrame);
    discoveryFrame = requestAnimationFrame(() => {
      discoveryFrame = 0;
      // Read untransformed offsets and reapply the same scroll pose in one frame.
      for (const rec of records.values()) {
        rec.node.style.removeProperty('transform');
        rec.node.style.removeProperty('opacity');
        rec.lastSignature = null;
      }
      for (const rec of records.values()) {
        if (!rec.node.isConnected || !rec.anchor.isConnected) continue;
        rec.offset = rec.node.getBoundingClientRect().top - rec.anchor.getBoundingClientRect().top;
        rec.height = rec.node.offsetHeight;
      }
      discover();
      if (frame) cancelAnimationFrame(frame);
      update();
    });
  }
  function queueDiscovery() {
    if (!discoveryFrame && !disposed) discoveryFrame = requestAnimationFrame(discover);
  }
  function onReducedChange() {
    for (const rec of records.values()) rec.lastSignature = null;
    queueUpdate();
  }
  // Initial hash alignment and browser Back restoration can dispatch scroll
  // events before the person moves anything. Only explicit input can release
  // the anchored headline's initial stable reading state.
  function noteUserInput() { hasUserScrollIntent = true; }
  function onNavigationKey(event) {
    if (['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key)) noteUserInput();
  }
  function onViewportResize() {
    // iOS toolbar opening/closing changes height during a normal vertical
    // swipe. Recompute progress, but do not clear/re-measure moving headings.
    if (innerWidth === previousViewportWidth) { queueUpdate(); return; }
    previousViewportWidth = innerWidth;
    onLayoutChange();
  }
  const mutation = new MutationObserver(queueDiscovery);
  mutation.observe(root, { childList: true, subtree: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('wheel', noteUserInput, { passive: true });
  window.addEventListener('touchstart', noteUserInput, { passive: true });
  window.addEventListener('pointerdown', noteUserInput, { passive: true });
  window.addEventListener('keydown', onNavigationKey);
  window.addEventListener('resize', onViewportResize, { passive: true });
  window.addEventListener('portfolio:react-ready', onLayoutChange);
  reduced.addEventListener?.('change', onReducedChange);
  discover();

  window.__editorialHeadingMotion = {
    mode: 'scroll-scrub',
    get count() { return records.size; },
    get targets() { return [...records.keys()].map(node => node.querySelector('h2')?.id || node.id); },
  };
  return () => {
    disposed = true;
    mutation.disconnect();
    cancelAnimationFrame(frame);
    cancelAnimationFrame(discoveryFrame);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('wheel', noteUserInput);
    window.removeEventListener('touchstart', noteUserInput);
    window.removeEventListener('pointerdown', noteUserInput);
    window.removeEventListener('keydown', onNavigationKey);
    window.removeEventListener('resize', onViewportResize);
    window.removeEventListener('portfolio:react-ready', onLayoutChange);
    reduced.removeEventListener?.('change', onReducedChange);
    for (const rec of records.values()) clear(rec);
    records.clear();
    delete window.__editorialHeadingMotion;
  };
}
