// Verified rename contract for five overseas product videos. Never accesses ImageKit.
import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium} from 'playwright-core';
import {createSafePage, getSafeMediaReport} from './lib/safe-media.mjs';

const names=[
  ['09','海外无线耳机 AI 场景广告','Wireless Earbuds · AI Lifestyle Ad','commercial'],
  ['10','海外无线耳机 AI 产品展示广告','Wireless Earbuds · AI Product Showcase','commercial'],
  ['11','海外无线耳机 AI 社媒创意广告','Wireless Earbuds · AI Social Media Ad','social'],
  ['12','海外车载坐垫 AI 产品体验广告','Car Seat Cushion · AI Product Demo','social'],
  ['13','海外宠物红光护理仪 AI 产品广告','Pet Red Light Therapy Device · AI Ad','social'],
];
const root=resolve(import.meta.dirname,'..');
const meta=JSON.parse(readFileSync(resolve(root,'src/data/project-video-metadata.json')));
const overrides=JSON.parse(readFileSync(resolve(root,'src/data/project-cover-overrides.json')));
for(const [id,zh,,category] of names){
  const dir=category==='commercial'?'AI Commercials':'AI Overseas Product Ads';
  assert(existsSync(resolve(root,'assets/videos/works',dir,zh+'.mp4')),id+' missing local MP4');
  assert(existsSync(resolve(root,'assets/images/project-covers/library',zh+'.webp')),id+' missing library cover');
  assert(overrides[id].startsWith(zh+'-'));
  assert(meta[id].playerPoster.startsWith(zh+'-'));
  assert(existsSync(resolve(root,'assets/images/project-covers/custom',overrides[id])));
  assert(existsSync(resolve(root,'assets/images/player-posters',meta[id].playerPoster)));
  assert(meta[id].playerPosterTime > 0);
  const idMatch=overrides[id].match(/([0-9a-f-]{36})\.webp$/);
  if (idMatch) {
    const exportRecord=resolve(root,'.cover-studio/exports',idMatch[1]+'.json');
    if (existsSync(exportRecord)) {
      const saved=JSON.parse(readFileSync(exportRecord,'utf8'));
      assert.equal(saved.sourceName,zh+'.mp4',id+' cover-tool export filename out of sync');
      if(saved.sessionId) {
        const sessionFile=resolve(root,'.cover-studio/sessions',saved.sessionId,'session.json');
        if(existsSync(sessionFile)) {
          assert.equal(JSON.parse(readFileSync(sessionFile,'utf8')).name,zh+'.mp4',id+' cover-tool session filename out of sync');
        }
      }
    }
  }
}
const source=readFileSync(resolve(root,'src/data/projects.js'),'utf8');
for(const [id,zh,,category] of names) {
  // category==='social' already explains the overseas audience in Chinese;
  // title presentation is simplified without renaming the actual media files.
  const display = category==='social'?zh.replace(/^海外/,''):zh;
  const sourceLine = source.split('\n').find(line=>line.includes("id: '"+id+"'"));
  assert(sourceLine?.includes("title: { zh: '"+display+"'"), id+': Chinese visible title mismatch');
}

const cdnURLs=source.match(/https:\/\/ik\.imagekit\.io\/Ailuren\/tr:orig-true\/videos\/[^']+/g)||[];
assert.equal(cdnURLs.length,15,'Published 15 ImageKit sources must stay intact');
assert.equal(new Set(cdnURLs).size,15);
console.log('PASS: 5 local videos, 15 renamed covers/posters and metadata, 15 unchanged production CDN URLs');

const browserPath=['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
assert(browserPath);
const b=await chromium.launch({executablePath:browserPath,headless:true});
const preview=process.env.PORTFOLIO_URL || 'http://127.0.0.1:5181/';
const dev=process.env.PORTFOLIO_DEV_URL || 'http://127.0.0.1:5174/';
try {
 for(const width of [390,1440]) {
  const page=await createSafePage(b,{viewport:{width,height:900},hasTouch:width===390,isMobile:width===390});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL('works.html',preview).href,{waitUntil:'domcontentloaded'});
  for(const [id,zh,en] of names){
    const i=Number(id)-1;
    const card=page.locator('.library-grid .comet-archive__card').nth(i);
    const visibleZh = names.find(([key])=>key===id)?.[3]==='social'?zh.replace(/^海外/,''):zh;
    assert((await card.innerText()).includes(visibleZh),`${id} Chinese title mismatch`);
    // Artwork is a real <img>; relying on background-image was obsolete after
    // the mobile-scroll flash fix. Verify the local cover URL and decoding.
    const cover=card.locator('.comet-archive__cover');
    const coverURL=decodeURIComponent(await cover.getAttribute('src'));
    assert(coverURL.includes(zh+'.webp') || coverURL.includes('assets/'),id+' missing displayed cover');
    await cover.scrollIntoViewIfNeeded();
    await cover.evaluate(img=>img.decode());
    assert((await cover.evaluate(img=>img.naturalWidth))>0,id+' image failed to decode');
  }
  await page.locator('.library-page-navigation .cinema-player__language [data-switch-lang="en"]').click();
  await page.waitForFunction(()=>document.documentElement.lang==='en');
  for(const [id,,en] of names){
    const i=Number(id)-1;
    assert((await page.locator('.library-grid .comet-archive__card').nth(i).innerText()).includes(en),id+' English title mismatch');
  }
  const category=page.locator('[data-category="social"]');
  assert((await category.innerText()).includes(width===390?'Product Ads':'AI Product & Social Ads'),'Product & Social Ads category filter mismatch');
  await category.click();
  assert.equal(await page.locator('.library-grid .comet-archive__card').count(),3);
  assert.equal(new URL(page.url()).searchParams.get('category'),'social','Existing category URL must be compatible');
  assert.deepEqual(errors,[]);
  assert.equal(getSafeMediaReport(page).urls.length,0);
  await page.close();
  console.log(`PASS ${width}px: ZH/EN titles, original covers, Overseas category and deep-link compatibility`);
 }
 // Real MP4 playback uses local development server (never production CDN).
 for(const width of [390,1440]){
  const page=await createSafePage(b,{viewport:{width,height:900},hasTouch:width===390,isMobile:width===390});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL('works.html',dev).href,{waitUntil:'domcontentloaded'});
  for(const [id,zh] of names){
    const card=page.locator('.library-grid .comet-archive__card').nth(Number(id)-1);
    await card.evaluate(el=>el.click());
    await page.locator('.cinema-player').waitFor({state:'attached'});
    const visibleZh=names.find(([key])=>key===id)?.[3]==='social'?zh.replace(/^海外/,''):zh;
    assert((await page.locator('#cinema-player-title').textContent()).includes(visibleZh),id+' player title');
    const poster=page.locator('.cinema-player__poster');
    await poster.waitFor({state:'attached'});
    const posterSource=await poster.getAttribute('src');
    assert(posterSource?.includes(encodeURIComponent(zh))||posterSource?.includes(zh),id+' player poster filename missing');
    await page.locator('.cinema-player__play').evaluate(el=>el.click());
    await page.waitForFunction(()=>document.querySelector('.cinema-player video')?.currentTime>.05,{timeout:15000});
    const video=await page.locator('.cinema-player video').evaluate(el=>({src:decodeURIComponent(el.currentSrc),width:el.videoWidth,height:el.videoHeight}));
    assert(video.src.includes(zh+'.mp4'),id+' wrong local file');
    assert(video.width>0&&video.height>0);
    await page.locator('.cinema-player__close').evaluate(el=>el.click());
    await page.locator('.cinema-player').waitFor({state:'detached'});
  }
  assert.deepEqual(errors,[]);
  assert.equal(getSafeMediaReport(page).urls.length,0);
  await page.close();
  console.log(`PASS ${width}px: all 5 actual local MP4s play, custom covers/posters mapped, zero ImageKit traffic`);
 }
} finally {await b.close();}
