// Regression: mobile has a single working seek/play/mute/rate/fullscreen bar.
// Desktop keeps its native controls and the same poster/version lifecycle.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createSafePage,getSafeMediaReport} from '../../lib/safe-media.mjs';

const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
const base=process.env.PORTFOLIO_URL||'http://127.0.0.1:5174/';
try {
  for(const {width,height,projectId,portrait} of [
    {width:390,height:844,projectId:'16',portrait:false},
    {width:360,height:740,projectId:'19',portrait:true},
    {width:320,height:720,projectId:'19',portrait:true},
    {width:393,height:852,projectId:'19',portrait:true},
    {width:402,height:874,projectId:'19',portrait:true},
    {width:1440,height:900,projectId:'16',portrait:false},
  ]){
    const page=await createSafePage(browser,{viewport:{width,height},hasTouch:width<=760});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>localStorage.setItem('ailuren-lang','en'));
    await page.goto(new URL('works.html',base).href,{waitUntil:'domcontentloaded'});
    await page.locator(`.library-grid .comet-archive__card[data-project-id="${projectId}"]`).click();
    await page.waitForFunction(()=>document.querySelector('.cinema-player[open]')?.classList.contains('is-motion-visible'));
    await page.waitForTimeout(320);
    const bar=page.locator('.cinema-player__mobile-controls');
    const video=page.locator('.cinema-player video');
    if(width>760){
      assert.equal(await page.locator('.cinema-player__tap-feedback').count(),0,'Desktop never uses custom playback flash');
      assert.equal(await bar.isVisible(),false,'Desktop keeps its existing UI');
      assert.equal(await video.evaluate(v=>v.controls),true,'Desktop keeps native controls');
      assert.equal(await video.getAttribute('src'),null,'Desktop video still loads on play');
      console.log('PASS desktop native controls untouched',width);await page.close();continue;
    }
    assert(await bar.isVisible(),'Mobile toolbar must be present');
    assert.equal(await video.evaluate(v=>v.controls),false,'Native video controls must not duplicate custom controls');
    assert.equal(await video.getAttribute('src'),null,'Opening the viewer must not download MP4');
    assert.equal(await page.locator('.cinema-player__seek').isDisabled(),true,'Seek disabled before metadata');
    const geometry=await page.evaluate(()=>{
      const root=document.querySelector('.cinema-player');
      const rect=sel=>{let r=root.querySelector(sel).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,right:r.right}};
      return {stage:rect('.cinema-player__stage'),bar:rect('.cinema-player__mobile-controls'),title:rect('.cinema-player__caption'),body:rect('.cinema-player__body'),scrollWidth:root.scrollWidth,viewport:innerWidth};
    });
    assert(geometry.stage.y<145,'Video should be directly below navigation');
    assert(geometry.stage.bottom<=geometry.bar.y+1,'Player toolbar must follow video');
    assert(geometry.bar.bottom<=geometry.title.y+1,'Film title must follow toolbar');
    assert(geometry.scrollWidth<=geometry.viewport,'No horizontal overflow');
    const safeBottom=await page.locator('.cinema-player').evaluate(dialog=>{
      const layout=dialog.querySelector('.cinema-player__layout');
      const nav=dialog.querySelector('.cinema-player__work-nav');
      return {gap:layout.getBoundingClientRect().bottom-nav.getBoundingClientRect().bottom,
        hit:nav.querySelector('button').getBoundingClientRect().height};
    });
    assert(safeBottom.gap>=62,'Mobile work-switch arrows need 64px gesture-safe trailing space');
    if (portrait && height>=800) {
      const bottom=await page.locator('.cinema-player__work-nav').evaluate(el=>el.getBoundingClientRect().bottom);
      assert(bottom<=height-32,'Normal-height iPhones must show all work arrows with 32px visible breathing room before scrolling');
    }
    assert(safeBottom.hit>=44,'Work-switch arrow tap target must remain 44px');
    assert(Math.abs(geometry.title.w-geometry.body.w)<2,'Title must use full content width');
    if(portrait)assert(geometry.stage.w<geometry.body.w,'Portrait stage should be centered without narrowing the caption');
    assert.equal(getSafeMediaReport(page).urls.length,0,'No ImageKit MP4 before playback');
    assert.equal(await page.locator('.cinema-player__play').isVisible(),true,'Centered first-play affordance must remain');
    const mini=page.locator('.cinema-player__mobile-play');
    assert.equal(await mini.isVisible(),true,'Small playback button must be visible before first play');
    assert.equal(await mini.isEnabled(),true,'Small button must start video before any source is attached');
    const initialButton=await mini.boundingBox();
    assert(initialButton.width>=44 && initialButton.height>=44,'Mini playback target must be 44px');
    if(width===390){
      await mini.click(); // First-play works from the permanently visible toolbar too.
    } else {
      await page.locator('.cinema-player__play').click();
    }
    await page.waitForFunction(()=>{const v=document.querySelector('.cinema-player video');return v?.duration>0 && v.currentTime>.15;},null,{timeout:15000});
    assert.equal(await mini.isVisible(),true,'Toolbar pause/play remains visible during playback');
    assert.equal(await page.locator('.cinema-player__play').count(),0,'Central first-play button must leave after playback begins');
    const playingButton=await mini.boundingBox();
    assert(Math.abs(initialButton.x-playingButton.x)<2 && Math.abs(initialButton.y-playingButton.y)<2,
      'Mini play/pause control must not shift when playback starts');
    // The video frame is itself a touch target. A tap toggles the same native
    // media element; it must not rewind or create a second player.
    await video.tap({position:{x:22,y:25}});
    await page.waitForFunction(()=>document.querySelector('.cinema-player video')?.paused===true);
    await page.waitForFunction(() => document.querySelector('.cinema-player__mobile-play')?.getAttribute('aria-label') === 'Play video');
    await page.locator('.cinema-player__tap-feedback[data-action="pause"]').waitFor({state:'attached'});
    const scaleFeedback=await page.locator('.cinema-player__tap-feedback-disc').evaluate(element => {
      const animation=element.getAnimations().find(item=>item.animationName==='cinema-tap-scale');
      return {duration:animation?.effect?.getTiming().duration,
        scales:animation?.effect?.getKeyframes().map(frame=>Number(frame.transform?.match(/scale\(([^)]+)\)/)?.[1]))};
    });
    assert.equal(scaleFeedback.duration,750,'Feedback duration is the approved 750ms');
    const pairedFrames=await page.locator('.cinema-player__tap-feedback').evaluate(element => {
      const fade=element.getAnimations().find(item=>item.animationName==='cinema-tap-fade');
      const zoom=element.querySelector('.cinema-player__tap-feedback-disc')?.getAnimations().find(item=>item.animationName==='cinema-tap-scale');
      return {fadeDuration:fade?.effect?.getTiming().duration,
        fade:fade?.effect?.getKeyframes().map(f=>({offset:f.offset,opacity:Number(f.opacity)})),
        zoom:zoom?.effect?.getKeyframes().map(f=>({offset:f.offset,scale:Number(f.transform?.match(/scale\(([^)]+)\)/)?.[1])}))};
    });
    assert.equal(pairedFrames.fadeDuration,750,'Opacity must run for the same 750ms as scale');
    assert.deepEqual(pairedFrames.fade?.map(f=>f.offset),[0,150/750,600/750,1],
      'Fade-in 150ms, visible hold 450ms, fade-out 150ms');
    assert.deepEqual(pairedFrames.zoom?.map(f=>f.offset),pairedFrames.fade?.map(f=>f.offset),
      'Fade and scale keyframe boundaries must be synchronized');
    assert.deepEqual(pairedFrames.fade?.map(f=>f.opacity),[0,1,1,0],
      'Fade in while growing, stay fully visible, fade out while shrinking');
    assert(scaleFeedback.scales?.length===4 && scaleFeedback.scales[0]<scaleFeedback.scales[1]
      && scaleFeedback.scales[1]===scaleFeedback.scales[2] && scaleFeedback.scales[2]>scaleFeedback.scales[3],
      'Center feedback must grow, hold, then shrink (never grow again on exit)');
    await page.locator('.cinema-player__tap-feedback').waitFor({state:'detached',timeout:2500});
    const pausedAt=await video.evaluate(v=>v.currentTime);
    await video.tap({position:{x:22,y:25}});
    await page.waitForFunction(()=>document.querySelector('.cinema-player video')?.paused===false);
    await page.locator('.cinema-player__tap-feedback[data-action="play"]').waitFor({state:'attached'});
    await page.locator('.cinema-player__tap-feedback').waitFor({state:'detached',timeout:2500});
    assert((await video.evaluate(v=>v.currentTime))>=pausedAt-.3,'Frame tap resumes rather than restarting');
    await page.waitForFunction(()=>!document.querySelector('.cinema-player__seek')?.disabled);
    assert.equal(await page.locator('.cinema-player__seek').isDisabled(),false,'Seek available once duration is known');
    const duration=await video.evaluate(v=>v.duration);
    const seek=page.locator('.cinema-player__seek');
    const bounds=await seek.boundingBox();
    await seek.click({position:{x:bounds.width*.65,y:bounds.height/2}});
    await page.waitForFunction(d=>document.querySelector('.cinema-player video')?.currentTime>d*.25,duration,{timeout:10000});
    const controls=page.locator('.cinema-player__mobile-controls');
    await controls.getByRole('button',{name:'Mute'}).click();
    assert.equal(await video.evaluate(v=>v.muted),true,'Mute toggles real media state');
    await controls.getByRole('button',{name:'Unmute'}).click();
    assert.equal(await video.evaluate(v=>v.muted),false,'Unmute toggles real media state');
    const rateButton=controls.getByRole('button',{name:'Playback speed'});
    await rateButton.click();
    const rateMenu=controls.getByRole('menu',{name:'Playback speed'});
    assert(await rateMenu.isVisible(),'Playback rate opens a real in-system menu, not the native white select');
    assert.equal(await page.locator('.cinema-player__mobile-rate select').count(),0,'Native select is removed');
    assert.equal(await rateMenu.getByRole('menuitemradio').count(),4,'Four speed choices');
    await page.waitForTimeout(210); // Menu entrance is a 180ms scale transition.
    const menuColors=await rateMenu.evaluate(el=>{
      const r=el.getBoundingClientRect(),bar=el.closest('.cinema-player__mobile-controls').getBoundingClientRect();
      return {bg:getComputedStyle(el).backgroundColor,width:r.width,height:r.height,left:r.left,right:r.right,
        centerOffset:Math.abs((r.left+r.right)/2-(bar.left+bar.right)/2),barTop:bar.top,menuBottom:r.bottom,
        all44:[...el.querySelectorAll('button')].every(b=>b.getBoundingClientRect().height>=44)};
    });
    assert.equal(menuColors.bg,'rgba(26, 27, 31, 0.82)','Rate menu uses shared cinematic glass surface');
    const glassEffect=await rateMenu.evaluate(element=>({
      blur:getComputedStyle(element).backdropFilter,
      webkitBlur:getComputedStyle(element).webkitBackdropFilter,
    }));
    assert(glassEffect.blur.includes('blur(22px)') || glassEffect.webkitBlur.includes('blur(22px)'),
      'Speed menu must actually blur behind its translucent glass material');
    assert(menuColors.all44 && menuColors.width>=250,'All four speed choices fit in one 44px horizontal row');
    assert(menuColors.height<65,'Speed menu must be a compact floating pill, never a tall stack');
    assert(menuColors.centerOffset<1,'Speed menu must be visually centered across the video controls');
    assert(menuColors.left>=8 && menuColors.right<=width-8,'Floating menu must stay inside phone edges');
    assert(menuColors.menuBottom<=menuColors.barTop+1,'Speed menu must not cover playback controls');
    await rateMenu.getByRole('menuitemradio',{name:'1.5×'}).click();
    assert.equal(await video.evaluate(v=>v.playbackRate),1.5,'Playback speed applies to actual video');
    assert.equal(await rateButton.getAttribute('aria-expanded'),'false','Menu closes after selecting a rate');
    assert.equal(await rateButton.textContent(),'1.5×','Selected speed appears on compact trigger');
    await rateButton.click();
    await page.keyboard.press('Escape');
    assert.equal(await rateMenu.count(),0,'Esc must close menu without closing the viewer');
    assert.equal(await page.locator('.cinema-player[open]').count(),1,'Viewer must stay open after speed menu Esc');
    await rateButton.click();
    await page.locator('.cinema-player__caption').tap();
    assert.equal(await rateMenu.count(),0,'Tapping outside the speed popover closes it');
    await rateButton.focus();
    await page.keyboard.press('ArrowDown');
    assert.equal(await rateMenu.count(),1,'Keyboard arrow opens playback-speed menu');
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.equal(await video.evaluate(v=>v.playbackRate),1.25,'Keyboard traversal selects a real playback rate');
    await rateButton.click();
    await rateMenu.getByRole('menuitemradio',{name:'1×'}).click();
    assert.equal(await video.evaluate(v=>v.playbackRate),1,'Restore 1× for the rest of the playback checks');
    await controls.getByRole('button',{name:'Pause video'}).click();
    assert.equal(await video.evaluate(v=>v.paused),true,'Pause works');
    await page.locator('.cinema-player__tap-feedback[data-action="pause"]').waitFor({state:'attached'});
    assert.equal(await page.locator('.cinema-player__play').count(),0,'After starting, video tap and the toolbar are the same playback transport');
    const pausedButton=await mini.boundingBox();
    const viewerScroll=await page.locator('.cinema-player').evaluate(el=>el.scrollTop);
    assert(Math.abs(initialButton.x-pausedButton.x)<2 && Math.abs(initialButton.y-pausedButton.y-viewerScroll)<2,
      'Mini transport remains in the same content position even when the short phone scrolls to show the speed menu');
    await controls.getByRole('button',{name:'Play video'}).click();
    await page.waitForFunction(()=>!document.querySelector('.cinema-player video')?.paused);
    await page.locator('.cinema-player__tap-feedback[data-action="play"]').waitFor({state:'attached'});
    if(width===390){
      // Rotating a phone into landscape restores the browser's native controls
      // instead of leaving a video with invisible custom controls.
      const time=await video.evaluate(v=>v.currentTime);
      await page.setViewportSize({width:844,height:390});
      await page.waitForFunction(()=>document.querySelector('.cinema-player video')?.controls===true);
      assert.equal(await bar.isVisible(),false,'Landscape orientation falls back to native controls');
      await page.setViewportSize({width:390,height:844});
      await page.waitForFunction(()=>document.querySelector('.cinema-player video')?.controls===false);
      assert.equal(await bar.isVisible(),true,'Portrait restores compact toolbar');
      assert((await video.evaluate(v=>v.currentTime))>=time,'Orientation change must not reset playback');
    }
    assert.deepEqual(errors,[]);
    if(width===390){
      await page.locator('.cinema-player__version').nth(1).click();
      await page.waitForFunction(()=>document.querySelectorAll('.cinema-player__version')[1]?.getAttribute('aria-pressed')==='true');
      assert.equal(await page.locator('.cinema-player video').getAttribute('src'),null,'Version switches without fetching next video');
      assert.equal(await seek.isDisabled(),true,'Seek resets for the new video version');
    }
    console.log('PASS mobile player',width,height,projectId,'play/pause, seek, mute, speed, lazy load, no layout overflow');
    await page.close();
  }
} finally {await browser.close();}
