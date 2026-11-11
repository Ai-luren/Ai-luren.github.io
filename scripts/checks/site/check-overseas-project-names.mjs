// Source-grounded bilingual names and physical MP4 audit for product ads.
// Cover and poster filenames are historical assets, not display-title aliases.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { createSafePage, getSafeMediaReport } from '../../lib/safe-media.mjs';
const root=path.resolve(import.meta.dirname,'../../..');
const read=relative=>JSON.parse(readFileSync(path.join(root,relative),'utf8'));
const titleOverrides=read('src/data/project-title-overrides.json');
const localPaths=read('src/data/local-video-paths.json');
const meta=read('src/data/project-video-metadata.json');
const covers=read('src/data/project-cover-overrides.json');
const cases=[
  ['09','commercial'],['10','social'],['11','social'],['13','social'],
].map(([id,category])=>[id,titleOverrides[id].zh,titleOverrides[id].en,category]);
for(const [id,zh,en] of cases){
  assert.deepEqual(titleOverrides[id],{zh,en});
  const video=path.join(root,'assets/videos/works',localPaths[id]);
  assert(existsSync(video),id+' local MP4 renamed but missing');
  assert.equal(path.basename(video),en+'.mp4',id+' MP4 must track English display title');
  assert(existsSync(path.join(root,'assets/images/player-posters',meta[id].playerPoster)),id+' poster missing');
  assert(existsSync(path.join(root,'assets/images/project-covers',covers[id])),id+' custom cover missing');
  assert(meta[id].playerPosterTime>0,id+' original poster time lost');
}
const source=readFileSync(path.join(root,'src/data/projects.js'),'utf8');
const cdnURLs=Object.values(read('src/data/legacy-imagekit-urls.json'));
assert.equal(cdnURLs.length,14,'Keep all remaining published ImageKit URLs');
assert.equal(new Set(cdnURLs).size,14,'Existing CDN URLs must remain distinct');
assert(cdnURLs.every(u=>u.startsWith('https://ik.imagekit.io/Ailuren/tr:orig-true/videos/')&&u.endsWith('.mp4')));
assert(source.includes('legacyVideoUrls['),'Published project URLs must use the editable legacy URL map');
console.log('PASS local 4 MP4 paths, bilingual title data, untouched CDN URLs and preserved posters');
const executablePath=['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
const browser=await chromium.launch({executablePath,headless:true});
const preview=process.env.PORTFOLIO_URL||'http://127.0.0.1:5181/';
const dev=process.env.PORTFOLIO_DEV_URL||'http://127.0.0.1:5174/';
try{
  for(const width of [390,1440]){
    const page=await createSafePage(browser,{viewport:{width,height:900}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>localStorage.setItem('ailuren-lang','zh'));
    await page.goto(new URL('works.html',preview).href);
    for(const [id,zh,,category] of cases){
      await page.locator('[data-category="'+category+'"]').click();
      const card=page.locator('.library-grid .comet-archive__card').filter({hasText:zh}).first();
      assert((await card.innerText()).includes(zh),id+' Chinese title');
      await card.locator('.comet-archive__cover').evaluate(image=>image.decode());
    }
    await page.locator('[data-category="social"]').click();
    assert((await page.locator('.library-grid [data-project-id="10"]').innerText()).includes('AI 海外产品广告'));
    await page.locator('[data-category="commercial"]').click();
    assert.equal(await page.locator('.library-grid [data-project-id="10"]').count(),0,'ID 10 must not remain in commercial');
    const lang=page.locator('.library-page-navigation .cinema-player__language [data-switch-lang="en"]');
    await lang.click();
    await page.waitForFunction(()=>document.documentElement.lang==='en');
    for(const [id,,en,category] of cases){
      await page.locator('[data-category="'+category+'"]').click();
      const card=page.locator('.library-grid .comet-archive__card').filter({hasText:en}).first();
      assert((await card.innerText()).includes(en),id+' English title');
    }
    await page.locator('[data-category="social"]').click();
    assert((await page.locator('.library-grid [data-project-id="10"]').innerText()).includes('AI Product & Social Ads'));
    await page.locator('[data-category="commercial"]').click();
    assert.equal(await page.locator('.library-grid [data-project-id="10"]').count(),0,'ID 10 must not remain in commercial');
    assert.deepEqual(errors,[]);assert.equal(getSafeMediaReport(page).urls.length,0);
    await page.close();
    console.log('PASS bilingual card titles',width);
  }
  for(const width of [390,1440]){
    const page=await createSafePage(browser,{viewport:{width,height:900}});
    await page.route(/\/assets\/videos\/works\/.*\.mp4(?:\?.*)?$/i, route => route.fulfill({
      status: 200, path: path.join(root, 'scripts/fixtures/test-landscape.mp4'), contentType: 'video/mp4',
      headers: { 'accept-ranges': 'bytes', 'cache-control': 'no-store' },
    }));
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>localStorage.setItem('ailuren-lang','zh'));
    await page.goto(new URL('works.html',dev).href);
    for(const [id,zh,,category] of cases){
      await page.locator('[data-category="'+category+'"]').click();
      const card=page.locator('.library-grid .comet-archive__card').filter({hasText:zh}).first();
      await card.evaluate(el=>el.click());
      const player=page.locator('.cinema-player[open]');await player.waitFor();
      const poster=page.locator('.cinema-player__poster');
      assert((await poster.getAttribute('src'))?.includes(encodeURIComponent(meta[id].playerPoster)) ||
        decodeURIComponent(await poster.getAttribute('src')).includes(meta[id].playerPoster),id+' original poster not retained');
      await player.locator('.cinema-player__play').evaluate(el=>el.click());
      await page.waitForFunction(()=>document.querySelector('.cinema-player video')?.currentTime>.04,null,{timeout:20000});
      const details=await player.locator('video').evaluate(video=>({
        url:decodeURIComponent(video.currentSrc),width:video.videoWidth,height:video.videoHeight,
      }));
      assert(details.url.endsWith(localPaths[id]),id+' local video renamed but not linked');
      assert(details.width>0&&details.height>0);
      await player.locator('.cinema-player__close').evaluate(el=>el.click());await player.waitFor({state:'detached'});
    }
    assert.deepEqual(errors,[]);assert.equal(getSafeMediaReport(page).urls.length,0);
    await page.close();console.log('PASS five local video routes with fixture and independent posters',width);
  }
} finally {await browser.close();}
