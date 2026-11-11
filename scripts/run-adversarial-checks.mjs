// Deep adversarial regression suite. The maintained quick suite remains check:project.
// All mutation-capable workbench cases use isolated project fixtures.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const scripts=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).scripts;
const mode=process.argv[2]||'all';
if(!['site','workbench','all'].includes(mode)){
  console.error('Usage: node scripts/run-adversarial-checks.mjs [site|workbench|all]');
  process.exit(2);
}
const siteStandalone=[
  'check-unified-navigation.mjs','check-cinema-layout.mjs','check-cinema-navigation.mjs',
  'check-cinema-playback.mjs','check-cinema-stability.mjs','check-project-library.mjs',
  'check-media-presentation.mjs','check-modal-material-fallback.mjs',
  'check-desktop-primary-navigation.mjs','check-mobile-menu-focus.mjs',
];
const workbenchStandalone=[
  'check-cover-studio-add-work.mjs','check-cover-studio-default-video-dir.mjs',
  'check-cover-studio-create-modal.mjs','check-cover-studio-inline-bilingual.mjs',
  'check-cover-studio-legacy-version.mjs','check-cover-studio-multi-version.mjs',
  'check-cover-studio-order.mjs','check-cover-studio-title-mp4.mjs',
  'check-cover-studio-ux.mjs','check-cover-studio.mjs',
  'check-workbench-ux-draft-guard.mjs','check-workbench-ux-live-sync.mjs',
];
const siteNpm=Object.keys(scripts).filter(name=>name.startsWith('check:') &&
 !name.startsWith('check:workbench-') && !['check:smoke','check:project','check:adversarial',
 'check:site-full','check:workbench-full','check:cover-poster','check:cinema-local'].includes(name));
const workbenchNpm=Object.keys(scripts).filter(name=>name.startsWith('check:workbench-') &&
 !['check:workbench-core','check:workbench-full'].includes(name))
 .concat('check:cover-poster');
const all={
  site:[...siteNpm.map(name=>['npm','run',name]),...siteStandalone.map(name=>['node','scripts/checks/site/'+name])],
  workbench:[...workbenchNpm.map(name=>['npm','run',name]),...workbenchStandalone.map(name=>['node','scripts/checks/workbench/'+name])],
};
for(const category of Object.keys(all)){
 for(const spec of all[category]){
  if(spec[0]==='npm')assert(scripts[spec[2]],'Unknown script '+spec[2]);
  else await fs.access(path.join(root,spec[1]));
 }
}
const candidates=mode==='all'?[...all.site,...all.workbench]:all[mode];
const results=[];
const start=Date.now();
const port=5381;
let preview;
function run(cmd,env){
 return new Promise(resolve=>{
  const t=Date.now();
  const child=spawn(cmd[0],cmd.slice(1),{cwd:root,env,detached:true,stdio:['ignore','pipe','pipe']});
  let output='';let timedOut=false;
  const take=chunk=>{output+=chunk.toString();if(output.length>150000)output=output.slice(-150000);};
  child.stdout.on('data',take);child.stderr.on('data',take);
  const timer=setTimeout(()=>{
   timedOut=true;
   try{process.kill(-child.pid,'SIGTERM');}catch{}
  },180000);
  child.on('error',e=>take(String(e)));
  child.on('close',code=>{
   clearTimeout(timer);
   resolve({name:cmd.slice(1).join(' '),command:cmd.join(' '),pass:code===0&&!timedOut,
     code,timedOut,seconds:Math.round((Date.now()-t)/100)/10,
     tail:output.split('\n').slice(-24).join('\n')});
  });
 });
}
function status(line){console.log(line);}
try{
 if(mode==='site'||mode==='all'){
  status('Preparing production build for deep browser tests...');
  const built=await run(['npm','run','build'],process.env);
  if(!built.pass)throw Error('Build failed: '+built.tail);
  const executable=path.join(root,'node_modules/vite/bin/vite.js');
  preview=spawn(process.execPath,[executable,'preview','--host','127.0.0.1','--port',String(port),'--strictPort'],
    {cwd:root,stdio:'ignore'});
  let ready=false;
  for(let i=0;i<60;i++){
   if(preview.exitCode!==null)break;
   try{
    const res=await fetch('http://127.0.0.1:'+port+'/');
    if(res.ok){ready=true;break;}
   }catch{}
   await new Promise(resolve=>setTimeout(resolve,150));
  }
  if(!ready)throw Error('Dedicated Vite preview could not start on port '+port);
 }
 const env={...process.env,PORTFOLIO_URL:'http://127.0.0.1:'+port+'/'};
 for(const [index,cmd] of candidates.entries()){
  status('['+(index+1)+'/'+candidates.length+'] '+cmd.join(' '));
  const r=await run(cmd,env);
  results.push(r);
  status((r.pass?'PASS ':'FAIL ')+r.command+' ('+r.seconds+'s)'+(r.timedOut?' [timeout]':''));
  if(!r.pass)status(r.tail);
 }
}finally{
 if(preview){preview.kill('SIGTERM');await new Promise(resolve=>setTimeout(resolve,200));}
 const report=path.join(root,'.audit/adversarial-qa-20261108');
 await fs.mkdir(report,{recursive:true});
 await fs.writeFile(path.join(report,'latest-'+mode+'-check.json'),
   JSON.stringify({mode,time:new Date().toISOString(),completed:results.length,total:candidates.length,
    passed:results.filter(r=>r.pass).length,results},null,2)+'\n');
 const failed=results.filter(r=>!r.pass);
 status('DEEP_REGRESSION '+mode+': '+(results.length-failed.length)+'/'+results.length+
   ' passed in '+Math.round((Date.now()-start)/1000)+'s');
 if(failed.length||results.length!==candidates.length)process.exitCode=1;
}
