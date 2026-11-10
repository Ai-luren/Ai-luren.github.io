import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {chromium} from 'playwright-core';
import {createCoverStudio} from '../tools/cover-studio/server.mjs';
import {createSafePage,getSafeMediaReport} from './lib/safe-media.mjs';

const root=path.resolve(import.meta.dirname,'..');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-desktop-nav-'));
for(const rel of ['src','assets/images','index.html','works.html'])
  await fs.cp(path.join(root,rel),path.join(temp,rel),{recursive:true});
await fs.writeFile(path.join(temp,'package.json'),'{"type":"module"}\n');
await fs.symlink(path.join(root,'node_modules'),path.join(temp,'node_modules'));
const paths=JSON.parse(await fs.readFile(path.join(temp,'src/data/local-video-paths.json'),'utf8'));
const automatic=JSON.parse(await fs.readFile(path.join(temp,'src/data/auto-projects.json'),'utf8'));
const media=new Set(Object.values(paths));
for(const work of automatic){
  if(work.localVideoPath)media.add(work.localVideoPath);
  for(const version of work.variants||[])if(version.localVideoPath)media.add(version.localVideoPath);
}
for(const source of media){
 const file=path.join(temp,'assets/videos/works',source);
 await fs.mkdir(path.dirname(file),{recursive:true});
 await fs.copyFile(path.join(root,'scripts/fixtures/test-landscape.mp4'),file);
}
const ordering=JSON.parse(await fs.readFile(path.join(temp,'src/data/project-order.json'),'utf8'));
const origTitle=await fs.readFile(path.join(root,'src/data/project-title-overrides.json'),'utf8');
let server,browser;
try{
 server=await createCoverStudio({projectRoot:temp,port:5288});
 browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
 const page=await createSafePage(browser,{viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url())});
 await page.goto(server.url);
 await page.waitForFunction(()=>document.querySelectorAll('#ux-gallery .ux-project').length===8);
 assert(await page.locator('#ux-desktop-only').isHidden());
 const all=ordering.all;
 const first=ordering.featured[0],index=all.indexOf(first);
 assert(index>=0&&all.length>=17);
 await page.locator('#ux-gallery .ux-project').first().locator('.ux-project-image').click();
 assert((await page.locator('#ux-editor-id').textContent()).includes('#'+first));
 assert.equal(await page.locator('#ux-work-position').textContent(),(index+1)+' / '+all.length);
 const step=index<all.length-1?1:-1;
 await page.locator(step>0?'#ux-work-next':'#ux-work-prev').click();
 assert((await page.locator('#ux-editor-id').textContent()).includes('#'+all[index+step]));
 assert(await page.locator('#ux-video-preview').evaluate(x=>x.paused));
 await page.keyboard.down('Alt');
 await page.keyboard.press(step>0?'ArrowLeft':'ArrowRight');
 await page.keyboard.up('Alt');
 assert((await page.locator('#ux-editor-id').textContent()).includes('#'+first));
 for(let i=index;i<all.length-1;i++)await page.locator('#ux-work-next').click();
 assert.equal(await page.locator('#ux-work-position').textContent(),all.length+' / '+all.length);
 assert(await page.locator('#ux-work-next').isEnabled(),'Final work must wrap to first.');
 assert((await page.locator('#ux-editor-id').textContent()).includes('#'+all.at(-1)));
 await page.locator('#ux-work-next').click();
 assert.equal(await page.locator('#ux-work-position').textContent(),'1 / '+all.length);
 assert((await page.locator('#ux-editor-id').textContent()).includes('#'+all[0]));
 await page.locator('#ux-work-prev').click();
 assert.equal(await page.locator('#ux-work-position').textContent(),all.length+' / '+all.length);
 await page.locator('#ux-work-prev').click();
 assert.equal(await page.locator('#ux-work-position').textContent(),(all.length-1)+' / '+all.length);
 console.log('ALL_WORKS_SEQUENCE_CIRCULAR_WRAP_AND_KEYBOARD_PASS');

 await page.locator('[data-ux-panel=details]').click();
 const titleBefore=await page.locator('#ux-title-zh').inputValue();
 await page.locator('#ux-title-zh').fill(titleBefore+' 临时草稿');
 await page.locator('#ux-work-next').click();
 assert(await page.locator('#ux-unsaved-dialog').isVisible());
 assert((await page.locator('#ux-unsaved-description').textContent()).includes('作品名称'));
 await page.locator('#ux-unsaved-keep').click();
 assert.equal(await page.locator('#ux-title-zh').inputValue(),titleBefore+' 临时草稿');
 await page.locator('#ux-work-next').click();
 await page.locator('#ux-unsaved-discard').click();
 assert.equal(await page.locator('#ux-work-position').textContent(),all.length+' / '+all.length);
 assert.equal(await page.locator('#ux-title-zh').inputValue(),
   await page.locator('#ux-editor-title').textContent());
 console.log('UNSAVED_GUARD_KEEP_AND_DISCARD_WITH_NAV_PASS');

 await page.locator('#ux-close-editor').click();
 assert(await page.locator('#ux-editor').isHidden());
 await page.locator('[data-filter="commercial"]').click();
 const items=await page.locator('#ux-gallery .ux-project').evaluateAll(xs=>xs.map(x=>x.dataset.id));
 assert(items.length>2);
 await page.locator('#ux-gallery .ux-project').nth(1).locator('.ux-project-image').click();
 const openId=items[1],openIndex=all.indexOf(openId);
 assert.equal(await page.locator('#ux-work-position').textContent(),(openIndex+1)+' / '+all.length);
 await page.locator('#ux-work-prev').click();
 assert((await page.locator('#ux-editor-id').textContent()).includes('#'+all[openIndex-1]));
 await page.locator('#ux-work-next').click();
 assert((await page.locator('#ux-editor-id').textContent()).includes('#'+openId));
 const projects=(await(await fetch(server.url+'/api/bootstrap')).json()).projects;
 const cat=id=>projects.find(p=>p.id===id)?.category;
 const boundary=all.findIndex((id,i)=>i<all.length-1&&cat(id)!==cat(all[i+1]));
 assert(boundary>=0,'fixtures must contain at least two categories');
 await page.locator('#ux-close-editor').click();
 await page.locator('#ux-search').fill(all[boundary]);
 await page.locator('.ux-project[data-id="'+all[boundary]+'"] .ux-project-image').click();
 await page.locator('#ux-work-next').click();
 assert((await page.locator('#ux-editor-id').textContent()).includes('#'+all[boundary+1]));
 assert.notEqual(cat(all[boundary]),cat(all[boundary+1]));
 assert.equal(await page.locator('#ux-categories .ux-filter[aria-pressed=true]').getAttribute('data-filter'),cat(all[boundary+1]),
   'The underlying gallery must follow the new category so closing returns to the selected work.');
 console.log('CROSS_CATEGORY_BOUNDARY_AND_FULL_PORTFOLIO_ORDER_PASS');

 await page.locator('#ux-close-editor').click();
 await page.locator('#ux-search').fill('岳阳楼');
 await page.locator('.ux-project[data-id="06"] .ux-project-image').click();
 assert.equal(await page.locator('#ux-work-position').textContent(),
  (all.indexOf('06')+1)+' / '+all.length);
 const previous=await page.locator('#ux-editor-id').textContent();
 if(await page.locator('#ux-work-next').isEnabled()){
  await page.locator('#ux-work-next').click();
  assert.notEqual(await page.locator('#ux-editor-id').textContent(),previous);
 }
 console.log('SEARCH_RESULT_NAVIGATES_ALL_WORKS_PASS');

 await page.locator('#ux-close-editor').click();
 await page.locator('#ux-search').fill('MEXC');
 const work16=page.locator('.ux-project[data-id="16"] .ux-project-image');
 assert(await work16.count());
 await work16.click();
 const versions=page.locator('#ux-variant-chips .ux-variant');
 assert(await versions.count()>=2);
 assert.equal(await page.locator('#ux-variant-chips').evaluate(e=>e.parentElement.className),'ux-version-switcher',
   'Video versions live together in the right-side version task, with an explicit pencil for each label.');
 assert(await page.locator('#ux-variant-chips').isVisible());
 assert(await page.locator('#ux-stage-version').isVisible(),'Show current video label in the preview summary.');
 const variantGeometry=await page.locator('#ux-variant-chips .ux-variant').evaluateAll(buttons=>
   buttons.map(el=>{const r=el.getBoundingClientRect();return {top:r.top,height:r.height,mid:r.top+r.height/2}}));
 assert(variantGeometry.every(r=>Math.abs(r.mid-variantGeometry[0].mid)<1&&Math.abs(r.height-variantGeometry[0].height)<1),
   'Version tabs must have exactly aligned centerlines and heights.');
 await versions.nth(1).click();
 assert(await versions.nth(1).getAttribute('aria-pressed')==='true');
 if(await page.locator('#ux-work-prev').isEnabled())await page.locator('#ux-work-prev').click();
 else await page.locator('#ux-work-next').click();
 assert(await page.locator('#ux-video-preview').evaluate(x=>x.paused));
 assert.equal(await page.locator('#ux-variant-chips .ux-variant[aria-pressed=true]').count(),1);
 assert((await page.locator('#ux-stage-version').textContent()).includes('主版本')||
   (await page.locator('#ux-stage-version').textContent()).includes('版本 A'));
 console.log('A_B_VERSION_SCOPE_AND_PAUSE_PASS');
 assert.deepEqual(errors,[]);
 assert.equal(getSafeMediaReport(page).urls.length,0);
 await page.close();

 const mobile=await createSafePage(browser,{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await mobile.goto(server.url);
 assert(await mobile.locator('#ux-desktop-only').isVisible());
 assert(await mobile.locator('#ux-library').isHidden());
 assert(await mobile.locator('#ux-editor').isHidden());
 assert((await mobile.locator('#ux-desktop-only').textContent()).includes('Mac'));
 console.log('DESKTOP_ONLY_GATE_PASS');
 await mobile.close();

 assert.equal(await fs.readFile(path.join(root,'src/data/project-title-overrides.json'),'utf8'),origTitle);
 console.log('DESKTOP_NAV_E2E_PASS; production files untouched.');
}finally{
 if(browser)await browser.close();
 if(server)await server.close();
}