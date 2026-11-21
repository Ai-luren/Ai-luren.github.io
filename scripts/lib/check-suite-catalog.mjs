// Single source of truth for quick and deep test queues.
// This module is read-only: listing a plan must not start browsers, servers or mutate project files.
export const quickSuites = Object.freeze({
  smoke: Object.freeze([
    'build', 'check:repo-layout', 'check:plan', 'check:asset-catalog', 'check:local-audit-cache',
    'check:curated-order-smoke', 'check:featured-hover-menu-smoke', 'check:shared-mobile-menu-smoke',
    'check:media-safety', 'check:image-loading', 'check:cascade-contract',
    'check:cinema-fullscreen', 'check:cinema-controls', 'check:cinema-nav-duration',
    'check:cinema-version-motion',
  ]),
  workbench: Object.freeze([
    'check:workbench-storage', 'check:workbench-backdrops',
    'check:workbench-full-flow', 'check:workbench-ux', 'check:workbench-phase3',
    'check:workbench-history', 'check:workbench-icon-alignment',
    'check:workbench-preview-sync', 'check:workbench-version-labels',
    'check:workbench-simple-versions', 'check:workbench-recycle',
  ]),
});

export const deepStandalone = Object.freeze({
  site: Object.freeze([
    'check-unified-navigation.mjs', 'check-cinema-layout.mjs',
    'check-cinema-navigation.mjs', 'check-cinema-playback.mjs',
    'check-cinema-stability.mjs', 'check-project-library.mjs',
    'check-modal-material-fallback.mjs', 'check-desktop-primary-navigation.mjs',
    'check-mobile-menu-focus.mjs',
  ]),
  workbench: Object.freeze([
    'check-cover-studio-inline-bilingual.mjs', 'check-cover-studio-legacy-version.mjs',
    'check-cover-studio-multi-version.mjs', 'check-cover-studio-order.mjs',
    'check-cover-studio-title-mp4.mjs', 'check-cover-studio-ux.mjs',
    'check-cover-studio.mjs', 'check-workbench-ux-draft-guard.mjs',
    'check-workbench-ux-live-sync.mjs',
  ]),
});

const excludeSite = new Set([
  'check:smoke', 'check:project', 'check:adversarial', 'check:site-full',
  'check:workbench-full', 'check:cover-poster', 'check:cinema-local', 'check:plan',
  // Direct aliases are useful for targeted debugging, but these exact test
  // files already run within the deep check:motion-polish composite.
  'check:animated-content', 'check:editorial-motion',
  // Daily sampled aliases run these modules; deep executes the originals fully.
  'check:curated-order-smoke', 'check:featured-hover-menu-smoke',
  'check:shared-mobile-menu-smoke',
]);
const excludeWorkbench = new Set([
  'check:workbench-core', 'check:workbench-full',
  // The composite check:workbench-create already runs this exact test file.
  // Keep the public npm alias for targeted debugging, not another deep run.
  'check:workbench-import-ui',
]);

export function quickPlan(mode = 'smoke') {
  if (mode === 'all') return [...new Set([...quickSuites.smoke, ...quickSuites.workbench])];
  if (mode !== 'smoke' && mode !== 'workbench') throw new Error('Unknown quick mode: ' + mode);
  return [...quickSuites[mode]];
}

export function deepPlan(scripts, mode = 'all') {
  if (!['site', 'workbench', 'all'].includes(mode)) throw new Error('Unknown deep mode: ' + mode);
  const siteNpm = Object.keys(scripts).filter(name =>
    name.startsWith('check:') && !name.startsWith('check:workbench-') && !excludeSite.has(name));
  const workbenchNpm = Object.keys(scripts).filter(name =>
    name.startsWith('check:workbench-') && !excludeWorkbench.has(name)).concat('check:cover-poster');
  const byArea = {
    site: [
      ...siteNpm.map(name => ['npm', 'run', name]),
      ...deepStandalone.site.map(name => ['node', 'scripts/checks/site/' + name]),
    ],
    workbench: [
      ...workbenchNpm.map(name => ['npm', 'run', name]),
      ...deepStandalone.workbench.map(name => ['node', 'scripts/checks/workbench/' + name]),
    ],
  };
  return mode === 'all' ? [...byArea.site, ...byArea.workbench] : byArea[mode];
}

export function directTestModules(command) {
  return [...command.matchAll(/\bnode\s+(scripts\/checks\/[^\s;&|]+\.mjs)\b/g)].map(m => m[1]);
}
