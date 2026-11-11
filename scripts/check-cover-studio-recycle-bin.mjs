// Non-destructive archive/restore integration. Never modifies the real project.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {chromium} from 'playwright-core';
import {createCoverStudio} from '../tools/cover-studio/server.mjs';
import {projectVideoVersions} from '../src/data/version-order.js';
import {createServer as createViteServer} from 'vite';
import {createSafePage,getSafeMediaReport} from './lib/safe-media.mjs';
const root=path.resolve(import.meta.dirname,'..');
const fixture=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-recycle-safety-'));
for(const part of ['src','assets/images','index.html','works.html'])
  await fs.cp(path.join(root,part),path.join(fixture,part),{recursive:true});
await fs.mkdir(path.join(fixture,'assets/videos'),{recursive:true});
await fs.symlink(path.join(root,'assets/videos/works'),path.join(fixture,'assets/videos/works'));
await fs.symlink(path.join(root,'node_modules'),path.join(fixture,'node_modules'));
await fs.writeFile(path.join(fixture,'package.json'),'{"type":"module"}\n');
let studio,browser;
try{
  studio=await createCoverStudio({projectRoot:fixture,port:5337});
  browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
  const page=await createSafePage(browser,{viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.goto(studio.url);
  await page.waitForSelector('#ux-gallery .ux-project');
  const initial=await(await page.request.get(studio.url+'/api/bootstrap')).json();
  assert.equal(initial.archived.works.length,0);
  assert.equal(initial.archived.versions.length,0);
  const project=initial.ordering.projects.find(x=>x.id==='19');
  assert(project);
  const version=initial.managedProjects.find(p=>p.id==='19').versions.at(-1);
  assert(version.id!=='main');
  const post=async(endpoint,data)=>{
    const result=await page.request.post(studio.url+endpoint,{headers:{'X-Cover-Token':initial.token},data});
    return {status:result.status(),body:await result.json()};
  };
  await page.locator('[data-filter="commercial"]').click();
  await page.locator('#ux-gallery .ux-project[data-id="19"] .ux-project-image').click();
  const count=initial.managedProjects.find(x=>x.id==='19').versions.length;
  assert(count>=2,'Main can be archived only when another video remains');
  assert.equal(await page.locator('.ux-detail-tabs button').count(),2,'Version settings and work settings are merged');
  assert(await page.locator('.ux-name-section').isVisible(),'Shared title belongs in the management tab');
  assert(await page.locator('.ux-publish-section').isVisible(),'ImageKit settings belong in the management tab');
  assert(await page.locator('.ux-featured-detail').isVisible());
  assert.equal(await page.locator('#ux-variant-chips .ux-variant').count(),count);
  assert(await page.locator('#ux-variant-chips .ux-variant[data-version="main"]').count()===1);
  await page.locator('#ux-variant-chips .ux-variant[data-version="main"]').click();
  assert(await page.locator('#ux-archive-version').isEnabled(),'Original main is archiveable with alternatives');
  await page.locator('#ux-archive-version').click();
  assert(await page.locator('#ux-archive-dialog').isVisible());
  assert.match(await page.locator('#ux-archive-message').textContent(),/可以恢复/);
  await page.locator('#ux-archive-cancel').click();
  assert.equal((await(await page.request.get(studio.url+'/api/bootstrap')).json()).archived.versions.length,0,'Cancel must not archive');
  await page.locator('#ux-archive-version').click();
  await page.locator('#ux-archive-confirm').click();
  await page.waitForFunction(count=>document.querySelectorAll('#ux-variant-chips .ux-variant').length===count-1,count,{timeout:18000});
  let data=await(await page.request.get(studio.url+'/api/bootstrap')).json();
  assert.equal(data.archived.versions.length,1);
  assert.equal(data.archived.versions[0].variantId,'main');
  assert.equal(data.managedProjects.find(x=>x.id==='19').versions.length,count-1);
  assert.equal(data.posterVersions.find(x=>x.id==='19').versions.length,count-1);
  assert(!data.posterVersions.find(x=>x.id==='19').versions.some(v=>v.id==='main'));
  assert(!await page.locator('#ux-variant-chips .ux-variant[data-version="main"]').count());
  assert(await page.locator('#ux-stage-version').textContent().then(x=>x.includes('精密入席')||x.includes('谁是主角')));
  assert.equal(data.ordering.projects.length,initial.ordering.projects.length);
  // Actual Vite SSR project model must hide archived main from the PUBLIC
  // player's version list, not just the local workbench's version buttons.
  const vite=await createViteServer({configFile:false,root:fixture,
    server:{middlewareMode:true,watch:null,hmr:false,ws:false},appType:'custom',logLevel:'silent'});
  try{
    const {PROJECTS}=await vite.ssrLoadModule('/src/data/projects.js');
    const siteProject=PROJECTS.find(project=>project.id==='19');
    assert(siteProject?.mainVersionArchived,'The website data model must mark main archived');
    const siteVersions=projectVideoVersions(siteProject);
    assert.equal(siteVersions.length,count-1);
    assert(!siteVersions.some(version=>version.id==='main'));
    assert.equal(siteVersions[0].id,data.posterVersions.find(x=>x.id==='19').versions[0].id);
    assert(siteVersions[0].playerPoster,'The default remaining video needs its own poster');
    console.log('PUBLIC_PLAYER_EXCLUDES_ARCHIVED_MAIN_PASS');
  }finally{await vite.close();}
  console.log('MAIN_VERSION_ARCHIVE_KEEPS_OTHER_VERSIONS_PLAYABLE');

  await page.locator('#ux-close-editor').click();
  await page.locator('#ux-open-trash').click();
  assert.equal(await page.locator('.ux-recycle-item').count(),1);
  await page.locator('.ux-recycle-item button').click();
  await page.waitForFunction(count=>document.querySelectorAll('#ux-variant-chips .ux-variant').length===count,count,{timeout:18000});
  data=await(await page.request.get(studio.url+'/api/bootstrap')).json();
  assert.equal(data.archived.versions.length,0);
  assert(await page.locator('#ux-variant-chips .ux-variant[data-version="main"]').count()===1);
  console.log('MAIN_VERSION_RECOVERY_PRESERVES_ORIGINAL_ID');

  // Archive a non-main version and restore it too.
  await page.locator('#ux-variant-chips .ux-variant[data-version="'+version.id+'"]').click();
  await page.locator('#ux-archive-version').click();
  await page.locator('#ux-archive-confirm').click();
  await page.waitForFunction(count=>document.querySelectorAll('#ux-variant-chips .ux-variant').length===count-1,count,{timeout:18000});
  await page.locator('#ux-close-editor').click();
  await page.locator('#ux-open-trash').click();
  await page.locator('.ux-recycle-item button').click();
  await page.waitForFunction(count=>document.querySelectorAll('#ux-variant-chips .ux-variant').length===count,count,{timeout:18000});
  data=await(await page.request.get(studio.url+'/api/bootstrap')).json();
  assert.equal(data.archived.versions.length,0);
  await page.locator('#ux-close-editor').click();

  // Server must refuse archiving the last remaining video, even if it is
  // an extension rather than main. Verify file paths and metadata untouched.
  const videoIds=data.managedProjects.find(x=>x.id==='19').versions.map(v=>v.id);
  for(const id of videoIds.slice(0,-1)){
    const action=await post('/api/archive-item',{scope:'version',projectId:'19',variantId:id,confirmed:true});
    assert.equal(action.status,200,'Keep archiving until one remains');
  }
  const last=await post('/api/archive-item',{scope:'version',projectId:'19',variantId:videoIds.at(-1),confirmed:true});
  assert.equal(last.status,409,'The last active video must be preserved');
  const singleton=await(await page.request.get(studio.url+'/api/bootstrap')).json();
  assert.deepEqual(singleton.managedProjects.find(x=>x.id==='19').versions.map(v=>v.id),[videoIds.at(-1)]);
  await page.reload();
  await page.waitForFunction(()=>document.querySelectorAll('#ux-gallery .ux-project').length===8);
  await page.locator('[data-filter="commercial"]').click();
  await page.locator('#ux-gallery .ux-project[data-id="19"] .ux-project-image').click();
  assert(await page.locator('#ux-archive-version').isDisabled(),
    'The workbench must disable archive when only one video is available');
  assert.match(await page.locator('#ux-archive-version').getAttribute('title'),/至少保留一个视频/);
  await page.locator('#ux-close-editor').click();
  for(const id of videoIds.slice(0,-1)){
    const restored=await post('/api/restore-item',{scope:'version',projectId:'19',variantId:id,confirmed:true});
    assert.equal(restored.status,200);
  }
  console.log('LAST_VIDEO_CANNOT_BE_ARCHIVED_AND_RESTORE_ALL');

  // Work archive: protect featured item, require explicit phrase.
  const featuredId=initial.ordering.featured[0];
  let r=await post('/api/archive-item',{scope:'work',projectId:featuredId,confirmed:true,confirmPhrase:'归档'});
  assert.equal(r.status,409,'featured work cannot be archived');
  const ordinary=initial.ordering.projects.find(x=>!initial.ordering.featured.includes(x.id)&&x.id!=='19');
  assert(ordinary);
  r=await post('/api/archive-item',{scope:'work',projectId:ordinary.id,confirmed:true,confirmPhrase:'delete'});
  assert.equal(r.status,400,'work archive requires phrase');
  const cat=ordinary.category;
  await page.locator(`[data-filter="${cat}"]`).click();
  await page.locator(`#ux-gallery .ux-project[data-id="${ordinary.id}"] .ux-project-image`).click();
  await page.locator('[data-ux-panel="versions"]').click();
  assert(await page.locator('#ux-archive-work').isEnabled());
  await page.locator('#ux-archive-work').click();
  assert(await page.locator('#ux-archive-dialog').isVisible());
  assert(await page.locator('#ux-archive-confirm').isDisabled());
  await page.locator('#ux-archive-phrase').fill('归档');
  assert(await page.locator('#ux-archive-confirm').isEnabled());
  await page.locator('#ux-archive-confirm').click();
  await page.waitForFunction(()=>document.querySelector('.ux-recycle-item')?.textContent.includes('恢复'),null,{timeout:18000});
  data=await(await page.request.get(studio.url+'/api/bootstrap')).json();
  assert.equal(data.archived.works.length,1);
  assert.equal((await page.request.get(studio.url+'/archived-cover/'+ordinary.id)).status(),200);
  assert(!data.ordering.projects.some(p=>p.id===ordinary.id));
  assert.equal(data.ordering.featured.length,8);
  assert.equal(await page.locator('#ux-gallery .ux-recycle-item').count(),1);
  await page.locator('#ux-gallery .ux-recycle-item button').click();
  await page.waitForFunction(id=>document.querySelector('#ux-editor-id')?.textContent.includes('#'+id)&&!document.querySelector('#ux-editor').hidden,ordinary.id,{timeout:18000});
  data=await(await page.request.get(studio.url+'/api/bootstrap')).json();
  assert.equal(data.archived.works.length,0);
  assert(data.ordering.projects.some(p=>p.id===ordinary.id));
  assert.equal(data.ordering.featured.length,8);
  const catalog=JSON.parse(await fs.readFile(path.join(fixture,'src/data/auto-projects.json'),'utf8'));
  assert.equal(catalog.length,JSON.parse(await fs.readFile(path.join(root,'src/data/auto-projects.json'),'utf8')).length);
  assert.equal(getSafeMediaReport(page).urls.length,0);
  assert.deepEqual(errors,[]);
  console.log('RECYCLE_BIN_PASS: archive/restore version and work, featured protection, required confirmation, files untouched, no network upload, all metadata recoverable');
}finally{
  if(browser)await browser.close();
  if(studio)await studio.close();
  await fs.rm(fixture,{recursive:true,force:true});
}
