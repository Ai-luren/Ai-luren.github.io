// Regression for the one-screen video workbench. All writes occur in an isolated copy.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {createSafePage,getSafeMediaReport} from './lib/safe-media.mjs';
import {createCoverStudio} from '../tools/cover-studio/server.mjs';

const root=path.resolve(import.meta.dirname,'..');
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-video-workspace-'));
for(const rel of ['src','assets/images','index.html','works.html'])
  await fs.cp(path.join(root,rel),path.join(tmp,rel),{recursive:true});
await fs.symlink(path.join(root,'node_modules'),path.join(tmp,'node_modules'));
await fs.writeFile(path.join(tmp,'package.json'),'{"type":"module"}\n');
const data=name=>fs.readFile(path.join(tmp,'src/data',name+'.json'),'utf8').then(JSON.parse);
const auto=await data('auto-projects'),work=auto.find(p=>p.id==='16');
assert(work?.variants?.length);
for(const media of [work.localVideoPath,...work.variants.map(v=>v.localVideoPath)]){
  const file=path.join(tmp,'assets/videos/works',media);
  await fs.mkdir(path.dirname(file),{recursive:true});
  await fs.copyFile(path.join(root,'scripts/fixtures/test-landscape.mp4'),file);
}
const hash=async file=>createHash('sha256').update(await fs.readFile(file)).digest('hex');
const poster=path.join(tmp,'assets/images/player-posters',work.variants[0].posterFile);
const beforePoster=await hash(poster);
const originals={
  order:await fs.readFile(path.join(root,'src/data/project-order.json'),'utf8'),
  legacy:await fs.readFile(path.join(root,'src/data/legacy-imagekit-urls.json'),'utf8'),
  auto:await fs.readFile(path.join(root,'src/data/auto-projects.json'),'utf8'),
};
let studio,browser;
try{
  studio=await createCoverStudio({projectRoot:tmp,port:5282});
  browser=await chromium.launch({
    executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true,
  });
  const page=await createSafePage(browser,{viewport:{width:1440,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.stack));
  page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
  await page.goto(studio.url);
  await page.waitForFunction(()=>document.querySelectorAll('#ux-gallery .ux-project').length===8);
  await page.locator('[data-filter="commercial"]').click();
  await page.locator('#ux-gallery .ux-project[data-id="16"] .ux-project-image').click();
  await page.waitForFunction(()=>document.querySelector('#ux-video-preview')?.readyState>=2,{},{timeout:20000});
  assert.equal(await page.locator('#ux-editor').isVisible(),true);
  const layout=await page.evaluate(()=>{
    const modal=document.querySelector('.ux-editor-pane').getBoundingClientRect();
    const header=document.querySelector('.ux-editor-top').getBoundingClientRect();
    const close=document.querySelector('#ux-close-editor').getBoundingClientRect();
    const inspector=document.querySelector('.ux-studio-inspector');
    return {modal:modal.toJSON(),header:header.toJSON(),close:close.toJSON(),
      scroll:inspector.scrollHeight-inspector.clientHeight,
      width:innerWidth,height:innerHeight};
  });
  assert(layout.modal.width>1300);
  assert(layout.header.right>layout.width-40);
  assert(layout.close.top>=0 && layout.close.right<=layout.width);
  assert(layout.scroll<=2,'Desktop inspector should fit without mandatory scrolling at 1440x900');
  const videoSrc=await page.locator('#ux-video-preview').evaluate(v=>v.currentSrc);
  const range=await fetch(videoSrc,{headers:{Range:'bytes=0-1023'}});
  assert.equal(range.status,206);
  assert.equal((await range.arrayBuffer()).byteLength,1024);
  console.log('FULL_SCREEN_FIXED_CLOSE_AND_LOCAL_RANGE_VIDEO_PASS');
  await page.locator('#ux-play-toggle').click();
  await page.waitForTimeout(260);
  assert.equal(await page.locator('#ux-video-preview').evaluate(v=>v.paused),false);
  await page.locator('#ux-play-toggle').click();
  await page.locator('#ux-video-timeline').fill('0.8');
  await page.locator('#ux-video-timeline').dispatchEvent('change');
  assert(Math.abs(await page.locator('#ux-video-preview').evaluate(v=>v.currentTime)-.8)<.15);
  console.log('VIDEO_PLAY_AND_SCRUB_PASS');
  await page.locator('#ux-variant-chips .ux-variant').nth(1).click();
  await page.locator('[data-ux-panel=artwork]').click();
  await page.locator('#ux-change-poster').click();
  await page.waitForFunction(()=>!document.querySelector('#ux-inline-save').disabled,null,{timeout:30000});
  assert.equal(await page.locator('#ux-poster-img').getAttribute('data-pending'),null);
  assert.equal(await page.locator('#ux-inline-frames').count(),0);
  await page.locator('#ux-inline-first').click();
  await page.waitForFunction(()=>document.querySelector('#ux-inline-title')?.textContent.includes('已选中')
    && !document.querySelector('#ux-inline-save').disabled,null,{timeout:30000});
  await page.locator('#ux-inline-next').click();
  await page.waitForFunction(()=>document.querySelector('#ux-inline-title')?.textContent.includes('已选中')
    && !document.querySelector('#ux-inline-save').disabled,null,{timeout:30000});
  assert.equal(await page.locator('#ux-inline-crop-choices').isVisible(),false);
  assert.equal(await page.locator('#ux-poster-img').getAttribute('data-pending'),'true');
  await page.locator('#ux-video-timeline').fill('1.15');
  await page.locator('#ux-video-timeline').dispatchEvent('change');
  await page.waitForFunction(()=>Math.abs(Number(document.querySelector('#ux-inline-time-input').value)-1.15)<.05
    && !document.querySelector('#ux-inline-save').disabled,null,{timeout:60000});
  await page.locator('.ux-studio-inspector').evaluate(el=>el.scrollTop=el.scrollHeight);
  const close=await page.locator('#ux-close-editor').boundingBox();
  assert(close.y>=0&&close.y+close.height<=900);
  await page.locator('#ux-close-editor').click();
  assert(await page.locator('#ux-unsaved-dialog').isVisible(),'Selected but unsaved frame must be protected.');
  await page.locator('#ux-unsaved-discard').click();
  assert(await page.locator('#ux-editor').isHidden());
  assert.equal(await hash(poster),beforePoster,'Unsaved selected frame must not modify a real poster');
  console.log('PRECISE_FRAME_STEP_SCRUB_AND_UNSAVED_GUARD_PASS');

  await page.locator('#ux-gallery .ux-project[data-id="16"] .ux-project-image').click();
  const available=await page.locator('#ux-variant-chips .ux-variant').count();
  assert.equal(available,2);
  await page.locator('#ux-add-variant').click();
  assert(await page.locator('#ux-version-form').isVisible());
  await page.locator('#ux-version-file').setInputFiles(path.join(root,'scripts/fixtures/test-portrait.mp4'));
  await page.waitForFunction(()=>document.querySelector('#ux-video-preview')?.currentSrc.startsWith('blob:')
    && document.querySelector('#ux-video-preview')?.readyState>=2,null,{timeout:20000});
  await page.locator('#ux-play-toggle').click();
  await page.waitForTimeout(170);
  assert.equal(await page.locator('#ux-video-preview').evaluate(v=>v.paused),false);
  await page.locator('#ux-play-toggle').click();
  console.log('UNSAVED_MP4_VERSION_PREVIEW_PASS');
  // Ordinary creation should require only an MP4: A/B/C labels are automatic.
  assert.equal(await page.locator('#ux-version-advanced').evaluate(el=>el.open),false);
  assert.equal(await page.locator('#ux-version-zh').inputValue(),'版本 C');
  assert.equal(await page.locator('#ux-version-en').inputValue(),'Version C');
  await page.locator('#ux-version-submit').click();
  await page.waitForFunction(()=>document.querySelectorAll('#ux-variant-chips .ux-variant').length===3,null,{timeout:90000});
  assert((await page.locator('#ux-stage-version').textContent()).includes('版本 C'));
  const changed=await data('auto-projects');
  const updated=changed.find(p=>p.id==='16');
  assert.equal(updated.variants.length,2);
  assert.equal(updated.variants.at(-1).label.en,'Version C');
  assert((await fs.stat(path.join(tmp,'assets/videos/works',updated.variants.at(-1).localVideoPath))).size>1000);
  console.log('INLINE_MP4_VERSION_CREATION_PASS');

  await page.locator('[data-ux-panel=versions]').click();
  await page.locator('#ux-url-readonly').click();
  const url='https://ik.imagekit.io/Ailuren/tr:orig-true/videos/test-version-c.mp4';
  await page.locator('#ux-url-value').fill(url);
  await page.locator('#ux-url-value').press('Enter');
  await page.waitForFunction(()=>document.querySelector('#ux-url-readonly')?.textContent?.includes('test-version-c.mp4'));
  const after=await data('auto-projects');
  assert.equal(after.find(p=>p.id==='16').variants.at(-1).videoUrl,url);
  assert.equal(getSafeMediaReport(page).urls.length,0);
  console.log('SINGLE_PANE_VERSION_AND_IMAGEKIT_MANAGEMENT_PASS');

  await page.screenshot({path:'/tmp/ailuren-complete-wide-flow.png'});
  assert.deepEqual(errors,[]);
  await page.close();


  assert.equal(await fs.readFile(path.join(root,'src/data/project-order.json'),'utf8'),originals.order);
  assert.equal(await fs.readFile(path.join(root,'src/data/legacy-imagekit-urls.json'),'utf8'),originals.legacy);
  assert.equal(await fs.readFile(path.join(root,'src/data/auto-projects.json'),'utf8'),originals.auto);
  console.log('FULL_FLOW_PASS isolated; production project files untouched',tmp);
}finally{
  if(browser)await browser.close();
  if(studio)await studio.close();
}
