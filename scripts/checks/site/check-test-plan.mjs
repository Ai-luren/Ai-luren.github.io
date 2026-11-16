// Read-only QA inventory and plan validator. Never starts a server, browser,
// ffmpeg process or modifies project media. Run: npm run check:plan
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deepPlan, directTestModules, quickPlan } from '../../lib/check-suite-catalog.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const scripts = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts;
const at = filename => path.join(root, filename);
const pathOf = spec => spec[0] === 'node'
  ? [spec[1]]
  : directTestModules(scripts[spec[2]] || '');
const toNpmSpec = name => ['npm', 'run', name];
const quick = {
  smoke: quickPlan('smoke'),
  workbench: quickPlan('workbench'),
  all: quickPlan('all'),
};
const deep = {
  site: deepPlan(scripts, 'site'),
  workbench: deepPlan(scripts, 'workbench'),
  all: deepPlan(scripts, 'all'),
};

for (const [name, tasks] of Object.entries(quick)) {
  assert.equal(new Set(tasks).size, tasks.length, 'Repeated quick npm command in ' + name);
  for (const script of tasks) assert(scripts[script], 'Unknown quick command: ' + script);
}
assert.deepEqual(quick.all, [...quick.smoke, ...quick.workbench],
  'Combined quick plan must preserve existing execution order');
assert.deepEqual(deep.all, [...deep.site, ...deep.workbench],
  'Combined deep plan must preserve site-then-workbench order');

// Detect accidental duplicate execution of the same test file, including
// separate npm aliases for one test and scripts inside composite npm commands.
const pathsByArea = {};
for (const area of ['site', 'workbench']) {
  const owners = new Map();
  for (const spec of deep[area]) {
    if (spec[0] === 'npm') assert(scripts[spec[2]], 'Missing deep npm command: ' + spec[2]);
    const paths = pathOf(spec);
    assert(paths.length > 0, 'Deep command has no known test module: ' + spec.join(' '));
    for (const filename of paths) {
      assert(filename.startsWith('scripts/checks/' + area + '/'),
        'Test categorized under wrong area: ' + filename);
      assert(fs.existsSync(at(filename)), 'Test file missing: ' + filename);
      assert(!owners.has(filename),
        'Deep test would run twice: ' + filename + ' via ' + owners.get(filename) + ' and ' + spec.join(' '));
      owners.set(filename, spec.join(' '));
    }
  }
  pathsByArea[area] = owners;
}

assert(scripts['check:workbench-import-ui']?.includes('check-cover-studio-import-ui.mjs'));
assert(scripts['check:workbench-create']?.includes('check-cover-studio-import-ui.mjs'));
assert(!deep.workbench.some(spec => spec[0] === 'npm' && spec[2] === 'check:workbench-import-ui'),
  'Import UI test is already covered by the create composite; do not run it twice');

// Five motion checks are deliberately grouped under check:motion-polish.
const motionScript = 'scripts/checks/site/check-motion-polish.mjs';
const motionChildren = [
  'scripts/checks/site/check-motion-modal-entry.mjs',
  'scripts/checks/site/check-motion-library-filters.mjs',
  'scripts/checks/site/check-motion-page-prefetch.mjs',
  'scripts/checks/site/check-animated-content-stability.mjs',
  'scripts/checks/site/check-editorial-once-motion.mjs',
];
const motionSource = fs.readFileSync(at(motionScript), 'utf8');
assert(pathsByArea.site.has(motionScript), 'The motion composite must be in site deep QA');
assert(motionSource.includes('spawn(process.execPath'), 'Motion composite no longer executes child checks');
for (const child of motionChildren) {
  assert(motionSource.includes("'" + child + "'"), 'Motion child no longer executed: ' + child);
  assert(!pathsByArea.site.has(child), 'Motion child would run twice: ' + child);
  pathsByArea.site.set(child, 'nested in check:motion-polish');
}

// The local MP4 buffering test deliberately needs an active Vite dev server
// and does not belong to the isolated production-preview deep plan.
const localOnly = 'scripts/checks/site/check-cinema-no-black-transitions.mjs';
assert(scripts['check:cinema-local']?.includes(localOnly), 'Local video test command missing');
assert(!pathsByArea.site.has(localOnly), 'Local-only test must not run against hosted preview');

const counted = {};
for (const area of ['site', 'workbench']) {
  const folder = at('scripts/checks/' + area);
  const files = fs.readdirSync(folder).filter(file => file.endsWith('.mjs'))
    .map(file => 'scripts/checks/' + area + '/' + file);
  // The plan check itself is in quick QA; the local video case has its own
  // explicit command. Everything else should be covered in the deep suite.
  const coverage = new Set(pathsByArea[area].keys());
  if (area === 'site') {
    coverage.add(localOnly);
    assert(quick.smoke.includes('check:plan'), 'Plan guard must be part of quick QA');
    assert(scripts['check:plan']?.includes('check-test-plan.mjs'));
    coverage.add('scripts/checks/site/check-test-plan.mjs');
  }
  const omitted = files.filter(file => !coverage.has(file));
  assert.deepEqual(omitted, [], 'Tests missing from all run paths (' + area + ')');
  counted[area] = { modules: files.length, deepCovered: pathsByArea[area].size };
}

const summary = {
  quick: { site: quick.smoke.length, workbench: quick.workbench.length, total: quick.all.length },
  deep: { site: deep.site.length, workbench: deep.workbench.length, total: deep.all.length },
  modules: {
    site: counted.site.modules, workbench: counted.workbench.modules,
    total: counted.site.modules + counted.workbench.modules,
  },
  special: { localVideo: 'check:cinema-local', nestedMotion: motionChildren.length },
  duplicateDeepExecutions: 0,
};
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ summary, quick, deep }, null, 2));
} else {
  console.log('TEST_PLAN_PASS ' + JSON.stringify(summary));
  console.log('说明：深度测试包括快速测试的一部分，但同一次深测内不重复运行相同文件；有效 npm 命令保持兼容；唯一断言已迁移的冗余测试入口允许退休。');
}
