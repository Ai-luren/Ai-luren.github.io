import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createSafePage,getSafeMediaReport} from './lib/safe-media.mjs';
import {createCoverStudio} from '../tools/cover-studio/server.mjs';

const root=path.resolve(import.meta.dirname,'..');
const fixture=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-unified-ux-'));
for(const relative of ['src','assets/images','index.html','works.html'])
  await fs.cp(path.join(root,relative),path.join(fixture,relative),{recursive:true});
await fs.mkdir(path.join(fixture,'assets/videos'),{recursive:true});
await fs.symlink(path.join(root,'assets/videos/works'),path.join(fixture,'assets/videos/works'));
await fs.symlink(path.join(root,'node_modules'),path.join(fixture,'node_modules'));
await fs.writeFile(path.join(fixture,'package.json'),'{"type":"module"}\n');
const read=async name=>JSON.parse(await fs.readFile(path.join(fixture,'src/data',name+'.json'),'utf8'));
let studio,browser;
try{
 studio=await createCoverStudio({projectRoot:fixture,port:5256});
 browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
 const page=await createSafePage(browser,{viewport:{width:1440,height:940}});
 const errors=[];page.on('pageerror',e=>errors.push(e.stack));
 page.on('response',r=>{if(r.status()===404&&r.url().includes('5190'))errors.push('404 '+r.url());});
 await page.goto(studio.url);
 await page.waitForFunction(()=>document.querySelector('body')?.dataset.workflow==='library'&&document.querySelectorAll('#ux-gallery .ux-project').length===8);
 assert(await page.locator('#ux-library').isVisible());
 assert.equal(await page.locator('[data-workflow-target]').count(),0,
   'The current workbench has one library workflow, not a duplicate navigation bar.');
 assert.equal(await page.locator('#ux-gallery .ux-project').count(),8);
 assert.equal(await page.locator('#ux-categories .ux-filter').count(),5);
 assert.equal(await page.locator('#ux-categories [data-filter="all"]').count(),0);
 assert.equal(await page.locator('#ux-categories [data-filter="featured"]').getAttribute('aria-pressed'),'true');
 for(const [category,count] of [['commercial',9],['short-film',3],['social',4],['visual',2],['featured',8]]){
  await page.locator('#ux-categories [data-filter="'+category+'"]').click();
  assert.equal(await page.locator('#ux-gallery .ux-project').count(),count,'Wrong '+category+' count');
 }
 await page.locator('#ux-categories [data-filter="featured"]').click();
 await page.locator('#ux-search').fill('MEXC');
 assert.equal(await page.locator('#ux-gallery .ux-project').count(),2);
 await page.locator('#ux-search').fill('');
 await page.locator('#ux-categories [data-filter="commercial"]').click();
 console.log('UNIFIED_LIST_AND_GLOBAL_SEARCH_PASS');

 const card16=page.locator('#ux-gallery .ux-project[data-id="16"]');
 await card16.locator('.ux-project-image img').click();
 assert(await page.locator('#ux-editor').isVisible());
 assert.equal(await page.locator('#ux-editor-title').textContent(),'MEXC 会员权益');
 assert.equal(await page.locator('#ux-variant-chips .ux-variant').count(),2);
 assert.equal(await page.locator('#ux-variant-chips').evaluate(e=>e.parentElement.className),'ux-version-toolbar');
 assert(await page.locator('#ux-variant-chips').isVisible());
 await page.locator('#ux-cover-img').evaluate(img=>img.decode());
 await page.locator('#ux-poster-img').evaluate(img=>img.decode());
 await page.locator('#ux-variant-chips .ux-variant').nth(1).click();
 assert.equal(await page.locator('#ux-variant-chips .ux-variant').nth(1).getAttribute('aria-pressed'),'true');
 await page.locator('#ux-change-cover').click();
 assert.equal(await page.locator('body').getAttribute('data-workflow'),'library');
 assert(await page.locator('#ux-inline-cover').isVisible());
 assert.equal(await page.locator('#ux-inline-cover').getAttribute('data-kind'),'cover');
 assert(await page.locator('body>header').isHidden());
 assert(await page.locator('.workflow-tabs').isHidden());
 assert(await page.locator('#ux-editor').isVisible());
 assert.equal(await page.locator('#ux-variant-chips .ux-variant').nth(1).getAttribute('aria-pressed'),'true');
 await page.locator('#ux-inline-cancel').click();
 await page.locator('#ux-close-editor').click();
 console.log('ONE_WORK_TWO_PREVIEWS_AND_DIRECT_VIDEO_PASS');

 const before=await read('project-order');
 const notFeatured='09';
 const allProjects=(await(await fetch(studio.url+'/api/bootstrap')).json()).ordering.projects;
 const category09=allProjects.find(p=>p.id===notFeatured).category;
 await page.locator('#ux-categories [data-filter="'+category09+'"]').click();
 const star=page.locator('.ux-project[data-id="'+notFeatured+'"] .ux-star');
 assert.equal(await star.getAttribute('aria-pressed'),'false');
 await star.click();
 assert(await page.locator('#ux-feature-dialog').isVisible());
 assert.equal(await page.locator('#ux-feature-options button').count(),8);
 const out=before.featured[0];
 await page.locator('#ux-feature-options button').first().click();
 await page.waitForFunction(id=>document.querySelector('.ux-project[data-id="'+id+'"] .ux-star')?.getAttribute('aria-pressed')==='true',notFeatured);
 const fav=await read('project-order');
 assert.equal(fav.featured.length,8);
 assert(fav.featured.includes(notFeatured));
 assert(!fav.featured.includes(out));
 console.log('FAVORITE_SWAP_PASS_WITH_EIGHT_LIMIT');

 await page.locator('#ux-categories [data-filter="featured"]').click();
 const orderBefore=(await read('project-order')).featured;
 const first=page.locator('#ux-gallery .ux-project').first();
 const second=page.locator('#ux-gallery .ux-project').nth(1);
 await first.locator('.ux-project-image').scrollIntoViewIfNeeded();
 const from=await first.locator('.ux-project-image').boundingBox();
 const to=await second.locator('.ux-project-image').boundingBox();
 await page.mouse.move(from.x+from.width/2,from.y+from.height/2);
 await page.mouse.down();
 await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:12});
 await page.mouse.up();
 await page.waitForFunction(()=>document.querySelector('#ux-toast')?.textContent?.includes('顺序已自动保存'));
 const orderAfter=(await read('project-order')).featured;
 assert.notDeepEqual(orderBefore,orderAfter);
 assert.equal(orderAfter[1],orderBefore[0]);
 assert.equal(await page.locator('#ux-save-bar').count(),0);
 assert.equal(await page.locator('.ux-handle').count(),0);
 console.log('IN_PLACE_SORT_AND_PERSISTENCE_PASS');

 await page.locator('#ux-categories [data-filter="commercial"]').click();
 await page.locator('#ux-gallery .ux-project[data-id="16"] .ux-project-image img').click();
 await page.locator('#ux-variant-chips .ux-variant').nth(1).click();
 await page.locator('#ux-url-readonly').click();
 const url='https://ik.imagekit.io/Ailuren/tr:orig-true/videos/verified-unified-workbench.mp4';
 await page.locator('#ux-url-value').fill(url);
 await page.locator('#ux-url-value').press('Enter');
 await page.waitForFunction(()=>document.querySelector('#ux-url-readonly')?.textContent.includes('verified-unified-workbench.mp4'));
 assert.equal((await read('auto-projects')).find(p=>p.id==='16').variants[0].videoUrl,url);
 // The original 14 works are managed in a separate source map, never rewriting their MP4s.
 await page.locator('#ux-close-editor').click();
 await page.locator('#ux-gallery .ux-project[data-id="01"] .ux-project-image img').click();
 assert(await page.locator('#ux-url-readonly').isVisible());
 const originalLegacy=(await read('legacy-imagekit-urls'))['01'];
 assert(originalLegacy.startsWith('https://ik.imagekit.io/Ailuren/tr:orig-true/videos/'));
 assert((await page.locator('#ux-url-readonly').textContent()).includes('watsons-commercial.mp4'));
 await page.locator('#ux-url-readonly').click();
 const legacyNew='https://ik.imagekit.io/Ailuren/tr:orig-true/videos/test-watsons-legacy-connection.mp4';
 await page.locator('#ux-url-value').fill(legacyNew);
 await page.locator('#ux-url-value').press('Enter');
 await page.waitForFunction(()=>document.querySelector('#ux-url-readonly')?.textContent.includes('test-watsons-legacy-connection.mp4'));
 assert.equal((await read('legacy-imagekit-urls'))['01'],legacyNew);
 assert.notEqual((await read('legacy-imagekit-urls'))['01'],originalLegacy);
 assert.equal((await read('auto-projects')).find(p=>p.id==='16').variants[0].videoUrl,url);
 console.log('LEGACY_IMAGEKIT_SOURCE_MAP_EDIT_PASS');
 assert.deepEqual(errors,[]);
 assert.equal(getSafeMediaReport(page).urls.length,0);
 await page.close();
 console.log('INLINE_IMAGEKIT_PER_VARIANT_PASS');


 console.log('UNIFIED_UX_PASS desktop gallery, favorite, sort, cover/poster, URL without cloud upload');
}finally{
 if(browser)await browser.close();
 if(studio)await studio.close();
}
