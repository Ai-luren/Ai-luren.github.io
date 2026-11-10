// Verify actual cross-tab artifact updates in a cloned portfolio.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {createServer} from 'vite';
import {createCoverStudio} from '../tools/cover-studio/server.mjs';
import {createSafePage,getSafeMediaReport} from './lib/safe-media.mjs';

const root=path.resolve(import.meta.dirname,'..');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-preview-sync-'));
const fp=(...args)=>path.join(temp,...args);
for(const rel of ['src','assets/images','index.html','works.html'])
 await fs.cp(path.join(root,rel),fp(rel),{recursive:true});
await fs.writeFile(fp('package.json'),'{"type":"module"}\n');
await fs.symlink(path.join(root,'node_modules'),fp('node_modules'));
const paths=JSON.parse(await fs.readFile(fp('src/data/local-video-paths.json'),'utf8'));
const videoPath=paths['06'];
assert(videoPath);
await fs.mkdir(path.dirname(fp('assets/videos/works',videoPath)),{recursive:true});
await fs.copyFile(path.join(root,'assets/videos/works',videoPath),fp('assets/videos/works',videoPath));
const imagePath=fp('assets/images/project-covers/commercial/Yueyang Tower Tourism Film.webp');
const sha=async p=>createHash('sha256').update(await fs.readFile(p)).digest('hex');
const original=await sha(imagePath);

process.env.VITE_LOCAL_PREVIEW_PORT='5175';
process.env.VITE_LOCAL_STUDIO_PORT='5294';
process.env.COVER_STUDIO_PREVIEW_ORIGIN='http://127.0.0.1:5175';
let vite,studio,browser;
try{
 studio=await createCoverStudio({projectRoot:temp,port:5294});
 vite=await createServer({configFile:false,root:temp,
   server:{host:'127.0.0.1',port:5175,strictPort:true,hmr:false},
   logLevel:'error'});
 await vite.listen();
 browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
 const web=await createSafePage(browser,{viewport:{width:1440,height:900}});
 let loads=0;
 web.on('load',()=>loads++);
 const failures=[];web.on('pageerror',e=>failures.push(e.message));
 web.on('requestfailed',r=>failures.push(r.url()+' '+r.failure()?.errorText));
 await web.goto('http://127.0.0.1:5175/works.html?category=commercial&project=06',{waitUntil:'domcontentloaded'});
 const card=web.locator('.comet-archive__card[data-project-id="06"] img');
 await card.evaluate(img=>img.decode());
 const before=await card.getAttribute('src');
 assert((await web.locator('.comet-archive__card[data-project-id="06"]').getAttribute('data-direct-highlight'))==='true');
 console.log('INITIAL_CARD',before,'loads',loads);
 const studioPage=await createSafePage(browser,{viewport:{width:1440,height:900}});
 await studioPage.goto(studio.url);
 await studioPage.waitForFunction(()=>document.querySelectorAll('.ux-project').length===8);
 await studioPage.locator('#ux-search').fill('岳阳楼');
 await studioPage.locator('.ux-project .ux-project-image').click();
 await studioPage.locator('[data-ux-panel=artwork]').click();
 await studioPage.locator('#ux-change-cover').click();
 await studioPage.waitForFunction(()=>!document.querySelector('#ux-inline-save').disabled,null,{timeout:30000});
 await studioPage.locator('#ux-inline-last').click();
 await studioPage.waitForFunction(()=>document.querySelector('#ux-inline-title')?.textContent.includes('尾帧')
   && !document.querySelector('#ux-inline-save').disabled,null,{timeout:30000});
 await studioPage.waitForFunction(()=>!document.querySelector('#ux-inline-save').disabled,null,{timeout:30000});
 await studioPage.locator('#ux-inline-save').click();
 await studioPage.waitForFunction(()=>document.querySelector('#ux-inline-cover').hidden,null,{timeout:90000});
 assert.notEqual(await sha(imagePath),original);
 await web.waitForFunction(()=>{
   const src=document.querySelector('.comet-archive__card[data-project-id="06"] img')?.src;
   return !!src && src.includes('localArtworkRevision=');
 },null,{timeout:25000});
 const updated=await card.getAttribute('src');
 await card.evaluate(img=>img.decode());
 assert.notEqual(before,updated);
 assert.equal(loads,1,'artwork-only updates should not reload the open web page');
 const url=new URL(updated,'http://127.0.0.1:5175');
 const response=await fetch(url);
 assert(response.ok);
 const bytes=Buffer.from(await response.arrayBuffer());
 assert.equal(createHash('sha256').update(bytes).digest('hex'),await sha(imagePath));
 assert.deepEqual(failures,[]);
 assert.equal(getSafeMediaReport(web).urls.length,0);
 console.log('LIVE_CROSS_TAB_COVER_UPDATED_NO_RELOAD',updated,'loads',loads);

 // The currently opened Cinema Player must update the poster without forcing
 // a page reload, losing its place, or contacting ImageKit.
 await web.locator('.comet-archive__card[data-project-id="06"]').click();
 await web.waitForFunction(()=>document.querySelector('.cinema-player[open] .cinema-player__poster')?.naturalWidth>0);
 const modal=web.locator('.cinema-player[open]');
 const initialPoster=await modal.locator('.cinema-player__poster').getAttribute('src');
 const posterFile=fp('assets/images/player-posters/commercial/Yueyang Tower Tourism Film.webp');
 const posterHash=await sha(posterFile);
 await studioPage.locator('#ux-change-poster').click();
 await studioPage.waitForFunction(()=>!document.querySelector('#ux-inline-save').disabled,null,{timeout:30000});
 await studioPage.locator('#ux-inline-first').click();
 await studioPage.waitForFunction(()=>document.querySelector('#ux-inline-title')?.textContent.includes('已选中')
   && !document.querySelector('#ux-inline-save').disabled,null,{timeout:30000});
 await studioPage.waitForFunction(()=>!document.querySelector('#ux-inline-save').disabled,null,{timeout:30000});
 await studioPage.locator('#ux-inline-save').click();
 await studioPage.waitForFunction(()=>document.querySelector('#ux-inline-cover').hidden,null,{timeout:90000});
 assert.notEqual(await sha(posterFile),posterHash);
 await web.waitForFunction(()=>document.querySelector('.cinema-player[open] .cinema-player__poster')?.src.includes('localArtworkRevision='),null,{timeout:25000});
 const refreshedPoster=await modal.locator('.cinema-player__poster').getAttribute('src');
 assert.notEqual(refreshedPoster,initialPoster);
 await modal.locator('.cinema-player__poster').evaluate(img=>img.decode());
 assert.equal(loads,1);
 assert.equal(await modal.isVisible(),true);
 console.log('LIVE_OPEN_PLAYER_POSTER_UPDATED_NO_RELOAD',refreshedPoster,'loads',loads);

 await studioPage.close();await web.close();
}finally{
 if(browser)await browser.close();
 if(vite)await vite.close();
 if(studio)await studio.close();
}
