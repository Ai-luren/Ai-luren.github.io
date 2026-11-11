import { spawnSync } from 'node:child_process';

const suites = {
  smoke: ['build', 'check:repo-layout', 'check:asset-catalog', 'check:curated-order', 'check:media-safety', 'check:image-loading', 'check:cinema-fullscreen'],
  workbench: [
    'check:workbench-storage', 'check:workbench-backdrops', 'check:workbench-full-flow',
    'check:workbench-ux', 'check:workbench-phase3', 'check:workbench-history',
    'check:workbench-icon-alignment', 'check:workbench-preview-sync', 'check:workbench-version-labels',
    'check:workbench-simple-versions', 'check:workbench-recycle',
  ],
};
const preset = process.argv[2] || 'smoke';
if (!['smoke', 'workbench', 'all'].includes(preset)) {
  console.error('用法：node scripts/run-check-suite.mjs [smoke|workbench|all]');
  process.exit(2);
}
const queue = [...new Set(preset === 'all' ? [...suites.smoke, ...suites.workbench] : suites[preset])];
console.log('运行验证集合：', preset, '（', queue.length, '项）');
const start = Date.now();
for (const [index, name] of queue.entries()) {
  const begin = Date.now();
  console.log('\n[' + (index + 1) + '/' + queue.length + '] npm run ' + name);
  const result = spawnSync('npm', ['run', name], { stdio: 'inherit', shell: false });
  if (result.error || result.status !== 0) {
    if (result.error) console.error(result.error);
    console.error('失败：' + name + '；前 ' + index + ' 项已通过。');
    process.exit(result.status || 1);
  }
  console.log('通过：' + name + '（' + ((Date.now() - begin) / 1000).toFixed(1) + '秒）');
}
console.log('\nCHECK_SUITE_PASS ' + preset + ': ' + queue.length + '/' + queue.length + '，共 ' + ((Date.now() - start) / 1000).toFixed(1) + ' 秒');
