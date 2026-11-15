// Published 15s scroll journey. Flights add transparent film travel between
// existing modules; no duplicated content, changed anchors, or mobile spacing.
// Teardown remains available for tests and safe project maintenance.
const FLIGHT_IDS = ['top', 'projects'];
const PARALLAX_SELECTORS = [
  '#projects .section-intro',
  '#projects .motion-stage',
  '#recognition .section-intro',
  '#recognition .recognition-react-root',
];
let active = false;
let inserted = [];
let parallaxTargets = [];
let frame = 0;

function queueUpdate() {
  if (!active || frame) return;
  frame = requestAnimationFrame(update);
}

function update() {
  frame = 0;
  if (!active || matchMedia('(max-width: 760px), (prefers-reduced-motion: reduce)').matches) return;
  const viewport = window.innerHeight;
  for (const [target, section] of parallaxTargets) {
    const r = section.getBoundingClientRect();
    // Individual CSS 'translate' composes safely with GSAP's entrance transform
    // and native card hover transforms; content moves ~48px slower than the page.
    const progress = Math.max(0, Math.min(1, (viewport - r.top) / (viewport + r.height)));
    target.style.setProperty('--hero-journey-offset', ((progress - 0.5) * 48).toFixed(1) + 'px');
  }
}

function refreshMapping() {
  // GSAP uses viewport positions for reveals; only refresh after travel stages mount.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!active) return;
    window.ScrollTrigger?.refresh();
    window.dispatchEvent(new Event('scroll'));
    queueUpdate();
  }));
}

export function activateImmersive() {
  if (active) return;
  active = true;
  // Extra scroll happens in film-only intervals between existing chapters,
  // rather than as empty padding within title/card content.
  for (const id of FLIGHT_IDS) {
    const section = document.getElementById(id);
    if (!section) continue;
    const travel = document.createElement('div');
    travel.className = 'hero-journey-flight hero-journey-flight--after-' + id;
    travel.setAttribute('aria-hidden', 'true');
    // AI Lab belongs directly after Expertise, without a blank film interval
    // separating the last Expertise evidence panel from its fourth module.
    section.insertAdjacentElement('afterend', travel);
    inserted.push(travel);
  }
  const expertiseGroup = document.getElementById('expertise-group');
  if (expertiseGroup) {
    const travel = document.createElement('div');
    travel.className = 'hero-journey-flight hero-journey-flight--outro';
    travel.setAttribute('aria-hidden', 'true');
    expertiseGroup.insertAdjacentElement('afterend', travel);
    inserted.push(travel);
  }
  parallaxTargets = PARALLAX_SELECTORS.map((selector) => {
    const element = document.querySelector(selector);
    return element ? [element, element.closest('section')] : null;
  }).filter(Boolean);
  window.addEventListener('scroll', queueUpdate, { passive: true });
  window.addEventListener('resize', queueUpdate, { passive: true });
  window.addEventListener('portfolio:react-ready', refreshMapping);
  queueUpdate();
  refreshMapping();
}

export function deactivateImmersive() {
  if (!active) return;
  active = false;
  cancelAnimationFrame(frame);
  frame = 0;
  window.removeEventListener('scroll', queueUpdate);
  window.removeEventListener('resize', queueUpdate);
  window.removeEventListener('portfolio:react-ready', refreshMapping);
  inserted.forEach(node => node.remove());
  inserted = [];
  parallaxTargets.forEach(([element]) => element.style.removeProperty('--hero-journey-offset'));
  parallaxTargets = [];
  requestAnimationFrame(() => {
    window.ScrollTrigger?.refresh();
    window.dispatchEvent(new Event('scroll'));
  });
}
