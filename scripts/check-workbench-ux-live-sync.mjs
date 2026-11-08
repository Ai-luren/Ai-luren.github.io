// Integration: a real Studio restoration must refresh an already-open Vite tab
// without a page reload, without restarting an active MP4, and without changing
// the portfolio's real files. All writes go to an isolated temporary project.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {createServer as createViteServer} from 'vite';
import {createCoverStudio} from '../tools/cover-studio/server.mjs';
import {createSafePage,getSafeMediaReport} from './lib/safe-media.mjs';

const root=path.resolve(import.meta.dirname,'..');
const fixture=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-ux-sync-'));
const at=(...parts)=>path.join(fixture,...parts);
for(const rel of ['src','assets/images','index.html','works.html']){
 await fs.cp(path.join(root,rel),at(rel),{recursive:true});
}
for(const kind of ['cover-history','poster-history']){
 const dir=at('.cover-studio/project-revisions',kind,'06');
 await fs.mkdir(path.dirname(dir),{recursive:true});
 await fs.cp(path.join(root,'.cover-studio/project-revisions',kind,'06'),dir,{recursive:true});
}
await fs.symlink(path.join(root,'node_modules'),at('node_modules'));
await fs.writeFile(at('package.json'),'{"type":"module"}\n');
const localVideos=JSON.parse(await fs.readFile(at('src/data/local-video-paths.json'),'utf8'));
const videoFile=at('assets/videos/works',localVideos['06']);
await fs.mkdir(path.dirname(videoFile),{recursive:true});
await fs.copyFile(path.join(root,'scripts/fixtures/test-landscape.mp4'),videoFile);
const coverFile=at('assets/images/project-covers/commercial/Yueyang Tower Tourism Film.webp');
const posterFile=at('assets/images/player-posters/commercial/Yueyang Tower Tourism Film.webp');
const hash=async file=>createHash('sha256').update(await fs.readFile(file)).digest('hex');
const official={cover:await hash(path.join(root,'assets/images/project-covers/commercial/Yueyang Tower Tourism Film.webp')),
 poster:await hash(path.join(root,'assets/images/player-posters/commercial/Yueyang Tower Tourism Film.webp'))};
process.env.COVER_STUDIO_PREVIEW_ORIGIN='http://127.0.0.1:5296';
process.env.VITE_LOCAL_PREVIEW_PORT='5296';
process.env.VITE_LOCAL_STUDIO_PORT='5295';
let studio,vite,browser;
const report=[];
try{
 studio=await createCoverStudio({projectRoot:fixture,port:5295});
 vite=await createViteServer({root:fixture,configFile:false,
   server:{host:'127.0.0.1',port:5296,strictPort:true},logLevel:'error'});
 await vite.listen();
 browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
 const p=await createSafePage(browser,{viewport:{width:1440,height:900}});
 const errors=[],navigate=[];
 p.on('pageerror',e=>errors.push(e.message));
 p.on('framenavigated',frame=>{if(frame===p.mainFrame())navigate.push(frame.url())});
 const responsePromise=p.waitForResponse(r=>r.url().includes('5295/api/preview-events')&&r.status()===200,{timeout:12000});
 await p.goto('http://127.0.0.1:5296/works.html?category=commercial&project=06',
   {waitUntil:'domcontentloaded'});
 await responsePromise;
 const card=p.locator('.comet-archive__card[data-project-id="06"]');
 await p.waitForFunction(()=>document.querySelector('.library-preview-target[data-project-id="06"]')!==null);
 const image=card.locator('img.comet-archive__cover');
 const pixels=()=>image.evaluate(async img=>{
   await img.decode();
   const c=document.createElement('canvas');c.width=24;c.height=24;
   c.getContext('2d').drawImage(img,0,0,24,24);
   return [...c.getContext('2d').getImageData(0,0,24,24).data].join(',');
 });
 const coverBefore=await pixels();
 await p.evaluate(()=>window.__previewCheckNoReload=123);
 const {token}=await(await fetch(studio.url+'/api/bootstrap')).json();
 const headers={'Content-Type':'application/json','X-Cover-Token':token};
 const history=async kind=>{
   const res=await fetch(studio.url+'/api/artwork-history?kind='+kind+'&projectId=06&variantId=main');
   assert(res.ok);
   return res.json();
 };
 const restore=async(kind,entry,expectedHash)=>{
   const res=await fetch(studio.url+'/api/restore-artwork',{
     method:'POST',headers,body:JSON.stringify({kind,projectId:'06',variantId:'main',
       revisionId:entry.id,expectedHash,confirmed:true}),
   });
   if(!res.ok)throw new Error(await res.text());
   return res.json();
 };
 const oldCover=await history('cover');
 assert(oldCover.entries.length>0);
 let chosenCover;
 for(const entry of oldCover.entries){
   const res=await fetch(studio.url+entry.imageUrl);
   const currentHash=createHash('sha256').update(Buffer.from(await res.arrayBuffer())).digest('hex');
   if(currentHash!==oldCover.currentHash){chosenCover=entry;break;}
 }
 assert(chosenCover,'a distinct saved cover must exist in source history');
 await restore('cover',chosenCover,oldCover.currentHash);
 await p.waitForFunction(()=>document.querySelector(
   '.comet-archive__card[data-project-id="06"] img.comet-archive__cover')?.src.includes('localArtworkRevision='),
   null,{timeout:12000});
 const coverAfter=await pixels();
 assert.notEqual(coverAfter,coverBefore);
 assert.equal(await p.evaluate(()=>window.__previewCheckNoReload),123);
 assert.equal(await p.evaluate(()=>window.__previewCheckNoReload),123,
   'cover update must not reload the document');
 console.log('LIVE_COVER_REFRESH_NO_PAGE_RELOAD_PASS');

 await card.click();
 const player=p.locator('dialog.cinema-player');
 await player.waitFor({state:'visible'});
 const poster=p.locator('.cinema-player__poster');
 const posterSrcBefore=await poster.getAttribute('src');
 await poster.evaluate(img=>img.decode());
 const previousPoster=await history('poster');
 assert(previousPoster.entries.length>0);
 let chosenPoster;
 for(const entry of previousPoster.entries){
   const res=await fetch(studio.url+entry.imageUrl);
   const h=createHash('sha256').update(Buffer.from(await res.arrayBuffer())).digest('hex');
   if(h!==previousPoster.currentHash){chosenPoster=entry;break;}
 }
 assert(chosenPoster,'a distinct saved player poster must exist');
 await restore('poster',chosenPoster,previousPoster.currentHash);
 await p.waitForFunction(()=>{
   const img=document.querySelector('.cinema-player__poster');
   return img?.src.includes('localArtworkRevision=');
 },null,{timeout:12000});
 const posterSrcAfter=await poster.getAttribute('src');
 assert.notEqual(posterSrcAfter,posterSrcBefore);
 assert(await player.isVisible());
 assert.equal(await p.evaluate(()=>window.__previewCheckNoReload),123);
 assert.equal(await p.evaluate(()=>window.__previewCheckNoReload),123,
   'poster update must not reload the document');
 await poster.evaluate(img=>img.decode());
 console.log('LIVE_POSTER_REFRESH_KEEPS_OPEN_PLAYER_PASS');

 const blocked=await fetch(studio.url+'/api/preview-events',{
   headers:{Origin:'https://example.com'},signal:AbortSignal.timeout(8000)});
 assert.equal(blocked.status,403);
 assert.equal(getSafeMediaReport(p).blocked,0);
 assert.deepEqual(errors,[]);
 await p.close();
 assert.equal(await hash(path.join(root,'assets/images/project-covers/commercial/Yueyang Tower Tourism Film.webp')),official.cover);
 assert.equal(await hash(path.join(root,'assets/images/player-posters/commercial/Yueyang Tower Tourism Film.webp')),official.poster);
 console.log('CROSS_ORIGIN_REJECTED_AND_OFFICIAL_DATA_UNTOUCHED');
 console.log('LIVE_PREVIEW_SYNC_ALL_PASS',fixture);
}finally{
 if(browser)await browser.close();
 if(vite)await vite.close();
 if(studio)await studio.close();
}
