// Standalone, reproducible regression: quiet all-work navigation, per-work
// version indicator isolation and truthful pre-play duration with zero MP4s.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {createSafePage,getSafeMediaReport} from '../../lib/safe-media.mjs';

const meta=JSON.parse(readFileSync(new URL('../../../src/data/project-video-metadata.json',import.meta.url)));
const auto=JSON.parse(readFileSync(new URL('../../../src/data/auto-projects.json',import.meta.url)));
const legacyIds=JSON.parse(readFileSync(new URL('../../../src/data/local-video-paths.json',import.meta.url)));
assert.equal(Object.keys(meta).length,Object.keys(legacyIds).length+auto.length,'Each catalog work needs media metadata');
assert(Object.keys(legacyIds).every(id=>meta[id]?.videoDuration>0));
assert(auto.every(work=>meta[work.id]?.videoDuration>0 && (work.variants||[]).every(v=>v.videoDuration>0)));
assert(Object.keys(meta).length>0 && auto.length>0,'Work catalog metadata is populated');

const base=process.env.PORTFOLIO_URL||'http://127.0.0.1:5174/';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
const time=duration=>`${Math.floor(duration/60)}:${String(Math.floor(duration%60)).padStart(2,'0')}`;
try {
  for(const [width,height,lang] of [[390,844,'zh'],[360,740,'en'],[1440,900,'zh']]){
    const page=await createSafePage(browser,{viewport:{width,height}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(l=>localStorage.setItem('ailuren-lang',l),lang);
    await page.goto(new URL('works.html',base).href,{waitUntil:'domcontentloaded'});
    await page.locator('.library-grid .comet-archive__card[data-project-id="19"]').click();
    await page.waitForFunction(()=>document.querySelector('.cinema-player[open]')?.classList.contains('is-motion-visible'));
    await page.waitForTimeout(330);
    const player=page.locator('.cinema-player[open]');
    const nav=player.locator('.cinema-player__work-nav');
    const count=nav.locator('.cinema-player__count');
    assert.equal(await player.locator('.cinema-player__return').count(),0,
      'Redundant All Work button must not be present inside the viewer');
    assert.equal(await player.locator('.cinema-player__nav-center').count(),0,
      'Position count must stand alone without a stacked menu');
    const visibleCount=await page.locator('.library-grid .comet-archive__card').count();
    assert.equal((await count.innerText()).trim(),`1 / ${visibleCount}`);
    assert((await count.boundingBox()).width>0,'Work position must remain visible');
    const prev=nav.locator('.cinema-player__sequence > button').first();
    assert.equal(await prev.evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)',
      'Work arrows should be subtle ghost controls, not heavy outlined circles');
    assert.equal(await prev.evaluate(el=>getComputedStyle(el).borderTopWidth),'0px');
    assert((await prev.boundingBox()).width>=44,'Work-arrow tap target must be >=44px');
    assert.equal(await player.locator('video').getAttribute('src'),null,'No video requested on open');
    assert.equal(getSafeMediaReport(page).urls.length,0,'Opening work must not fetch ImageKit MP4');
    if(width<=760){
      assert.equal(await player.locator('.cinema-player__mobile-time').innerText(),`0:00 / ${time(meta['19'].videoDuration)}`);
      assert.equal(await player.locator('.cinema-player__seek').isDisabled(),true,'No false seeking before media metadata');
      await player.locator('.cinema-player__version').nth(1).click();
      await page.waitForFunction(()=>document.querySelectorAll('.cinema-player__version')[1]?.getAttribute('aria-pressed')==='true');
      assert.equal(await player.locator('.cinema-player__mobile-time').innerText(),`0:00 / ${time(auto.find(w=>w.id==='19').variants[0].videoDuration)}`);
      assert.equal(await player.locator('video').getAttribute('src'),null);
    }
    // Closing returns to the originating library/filter without a second exit.
    await player.locator('.cinema-player__close').click();
    await player.waitFor({state:'detached'});
    assert(await page.locator('.library-grid .comet-archive__card[data-project-id="19"]').isVisible());
    assert.deepEqual(errors,[]);
    console.log('PASS',width,lang,'single position count, no redundant All Work CTA, original close return, no media fetch');
    await page.close();
  }
  // Featured order: MEXC Perks (2 versions) -> FormFunk Product Film (2 versions).
  // Changing works must remount the version rail without a shared sliding
  // indicator. Switching A/B inside the SAME work retains its Motion glide.
  const page=await createSafePage(browser,{viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL('index.html#projects',base).href,{waitUntil:'domcontentloaded'});
  // Mobile featured archive is paginated 4 + 4; projects 16 and 18 are on page two.
  await page.locator('#projects .comet-archive-pagination [role="tab"]').nth(1).click();
  await page.locator('#projects .comet-archive__card[data-project-id="16"]').click();
  await page.waitForFunction(()=>document.querySelector('.cinema-player[open]')?.classList.contains('is-motion-visible'));
  const modal=page.locator('.cinema-player[open]');
  assert.equal(await modal.getAttribute('data-project-id'),'16');
  assert.equal(await modal.locator('.cinema-player__versions .cinema-player__version').count(),2);
  await modal.locator('.cinema-player__sequence > button').last().click();
  await page.waitForFunction(()=>document.querySelector('.cinema-player')?.dataset.projectId==='18');
  assert.equal(await modal.locator('.cinema-player__versions .cinema-player__version').count(),2);
  assert.equal(await modal.locator('.cinema-player__version[data-visual-selected="true"]').count(),1);
  // The new highlight must immediately be inside the newly selected button,
  // not midway through a transition from the previous work's selector.
  const centers=await modal.locator('.cinema-player__versions').evaluate(track=>{
    const thumb=track.querySelector('.cinema-player__version-thumb');
    const active=track.querySelector('.cinema-player__version[data-visual-selected="true"]');
    const t=thumb.getBoundingClientRect(),a=active.getBoundingClientRect();
    return {thumbCenter:t.x+t.width/2,activeCenter:a.x+a.width/2,transform:getComputedStyle(thumb).transform};
  });
  assert(Math.abs(centers.thumbCenter-centers.activeCenter)<3,
    'Version highlight must not animate from the previous work: '+JSON.stringify(centers));
  assert.equal(await modal.locator('.cinema-player__mobile-time').innerText(),`0:00 / ${time(meta['18'].videoDuration)}`);
  assert.equal(getSafeMediaReport(page).urls.length,0,'Cross-work nav must not preload video');
  assert.deepEqual(errors,[]);
  console.log('PASS featured 16 -> 18: per-work version track remounts without cross-work sliding');
  await page.close();
} finally {await browser.close();}
console.log('NAV_DURATION_PASS: offline media durations, minimal work navigation, scoped animation');
