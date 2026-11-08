// Regression for high-frequency keyboard jog and final-time save.
// Runs in an isolated clone: never writes the live portfolio.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {chromium} from 'playwright-core';
import {createCoverStudio} from '../tools/cover-studio/server.mjs';
import {createSafePage,getSafeMediaReport} from './lib/safe-media.mjs';
const root=path.resolve(import.meta.dirname,'..');
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-jog-e2e-'));
for(const rel of ['src','assets/images','index.html','works.html'])
 await fs.cp(path.join(root,rel),path.join(tmp,rel),{recursive:true});
await fs.writeFile(path.join(tmp,'package.json'),'{"type":"module"}\n');
await fs.symlink(path.join(root,'node_modules'),path.join(tmp,'node_modules'));
const names=JSON.parse(await fs.readFile(path.join(tmp,'src/data/local-video-paths.json'),'utf8'));
const src=path.join(tmp,'assets/videos/works',names['06']);
await fs.mkdir(path.dirname(src),{recursive:true});
await fs.copyFile(path.join(root,'scripts/fixtures/test-landscape.mp4'),src);
let server,browser;
try{
 server=await createCoverStudio({projectRoot:tmp,port:5299});
 browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
 const p=await createSafePage(browser,{viewport:{width:1440,height:900}});
 let frames=0;const errors=[];
 p.on('request',r=>{if(r.url().endsWith('/api/frame'))frames++;});
 p.on('pageerror',e=>errors.push(e.stack));
 p.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url())});
 await p.goto(server.url);
 await p.waitForFunction(()=>document.querySelectorAll('.ux-project').length===8);
 await p.locator('#ux-search').fill('岳阳楼');
 await p.locator('.ux-project[data-id="06"] .ux-project-image').click();
 await p.locator('#ux-change-poster').click();
 await p.waitForFunction(()=>!document.querySelector('#ux-inline-next').disabled,null,{timeout:30000});
 assert(await p.locator('#ux-inline-time-input').isHidden());
 assert.equal(await p.locator('#ux-frame-step-label').count(),0);
 const before=frames;
 const started=Date.now();
 for(let i=0;i<10;i++)await p.keyboard.press('ArrowRight');
 const elapsed=Date.now()-started;
 const t=Number(await p.locator('#ux-inline-time-input').inputValue());
 assert(Math.abs(t-10/12)<.001,'jog position '+t);
 const after=frames-before;
 assert(after<=1,'Keyboard stepping should not launch 10 costly FFmpeg tasks, saw '+after);
 assert(await p.locator('#ux-inline-next').isEnabled());
 console.log('FAST_JOG_SYNCHRONOUS',elapsed,'ms',after,'FFmpeg tasks after 10 arrow presses',t);
 await p.waitForFunction(()=>document.querySelector('#ux-inline-title').textContent.includes('已选中 0.833') &&
  !document.querySelector('#ux-inline-save').disabled,null,{timeout:30000});
 assert(frames-before<=2,'After resting only one latest frame should decode');
 const clock=await p.locator('#ux-time-display').textContent();
 assert(clock.includes('.833'),'Selected frame clock should show milliseconds: '+clock);
 for(let i=0;i<3;i++)await p.keyboard.press('ArrowRight');
 const target=Number(await p.locator('#ux-inline-time-input').inputValue());
 assert(Math.abs(target-13/12)<.001);
 await p.locator('#ux-inline-save').click();
 await p.waitForFunction(()=>document.querySelector('#ux-inline-cover').hidden,null,{timeout:60000});
 const meta=JSON.parse(await fs.readFile(path.join(tmp,'src/data/project-video-metadata.json'),'utf8'));
 const saved=meta['06'].playerPosterTime;
 assert(Math.abs(saved-target)<.002,'Saved stale frame '+saved+' instead of '+target);
 assert.deepEqual(errors,[]);
 assert.equal(getSafeMediaReport(p).urls.length,0);
 console.log('FINAL_JOG_SAVE_CORRECT',saved,'no stale frame, no ImageKit requests, no UI errors');
 await p.close();
}finally{
 if(browser)await browser.close();
 if(server)await server.close();
}
