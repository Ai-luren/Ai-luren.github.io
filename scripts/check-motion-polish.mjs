import { spawn } from 'node:child_process';

const port = 5289;
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:' + port + '/';
const suites = [
  'scripts/check-motion-modal-entry.mjs',
  'scripts/check-motion-library-filters.mjs',
  'scripts/check-motion-page-prefetch.mjs',
];
const server = process.env.PORTFOLIO_URL ? null : spawn(process.execPath,
  ['./node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { stdio: 'ignore' });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const waitReady = async () => {
  for(let attempt = 0;attempt < 80;attempt++){
    try { if((await fetch(base,{signal:AbortSignal.timeout(750)})).ok)return; }catch {}
    await wait(150);
  }
  throw new Error('Motion QA Vite server unavailable');
};
try {
  await waitReady();
  for(const script of suites) {
    await new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,[script],{stdio:'inherit',env:{...process.env,PORTFOLIO_URL:base}});
      child.once('error',reject);
      child.once('exit',code=>code===0?resolve():reject(new Error(script+' failed ('+code+')')));
    });
  }
  console.log('PASS: three motion stages - modal first paint, filter stability, deferred page prefetch');
} finally {
  if(server){server.kill('SIGTERM');await wait(130);}
}
