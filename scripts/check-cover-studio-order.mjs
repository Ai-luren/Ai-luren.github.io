import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { createSafePage, getSafeMediaReport } from './lib/safe-media.mjs';
import { createCoverStudio } from '../tools/cover-studio/server.mjs';

const root=path.resolve(import.meta.dirname,'..');
const fixture=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-independent-curation-')));
for(const name of ['src','assets/images','index.html','works.html'])
  await fs.cp(path.join(root,name),path.join(fixture,name),{recursive:true});
await fs.mkdir(path.join(fixture,'assets/videos/works'),{recursive:true});
await fs.symlink(path.join(root,'node_modules'),path.join(fixture,'node_modules'));
await fs.writeFile(path.join(fixture,'package.json'),'{"type":"module"}\n');
const orderFile=path.join(fixture,'src/data/project-order.json');
const initial=JSON.parse(await fs.readFile(orderFile,'utf8'));
const studio=await createCoverStudio({projectRoot:fixture,port:5201});
let vite,browser;
const errors=[];
try {
  vite=await createServer({root:fixture,configFile:path.join(root,'vite.config.js'),
    server:{host:'127.0.0.1',port:5202,strictPort:true,fs:{allow:[fixture,root]}},logLevel:'error'});
  await vite.listen();
  browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
  const page=await createSafePage(browser,{viewport:{width:1440,height:950}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(studio.url); await page.locator('.ux-advanced-nav').evaluate(x=>x.open=true);
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('已载入'));
  await page.locator('[data-workflow-target="order"]').click();
  const initialCatalog=(await (await fetch(studio.url+'/api/bootstrap')).json()).ordering.projects;
  const catCount=(name)=>initialCatalog.filter(p=>p.category===name).length;
  const nameOf=(id)=>initialCatalog.find(p=>p.id===id)?.title;
  const commercialIds=initial.all.filter(id=>initialCatalog.find(p=>p.id===id)?.category==='commercial');
  assert.equal(await page.locator('#order-items .order-item').count(),8);
  assert.equal(await page.locator('#featured-pool-tabs [data-featured-pool-category]').count(),4);
  assert.equal(await page.locator('#order-category-tabs [data-order-category]').count(),4);
  const commercialCount=await page.locator('.order-candidate').count();
  assert(commercialCount>0,'At least one non-featured commercial must be available in the fixture');
  assert.equal(await page.locator('.order-shift,.order-handle').count(),0);

  // Choose a candidate dynamically: the user may have already changed their
  // actual featured selection before this isolated test copies its fixture.
  const candidateId=await page.locator('.order-candidate').first().getAttribute('data-id');
  const candidateTitle=await page.locator('.order-candidate').first().locator('.order-info strong').innerText();
  const removedId=initial.featured[0];
  await page.locator(`.order-candidate[data-id="${candidateId}"]`).click();
  await page.locator(`#order-items .order-item[data-id="${removedId}"] .order-featured-replace`).click();
  assert.equal(await page.locator('#order-items .order-item').first().getAttribute('data-id'),candidateId);
  assert.deepEqual(JSON.parse(await fs.readFile(orderFile,'utf8')),initial);
  await page.locator('[data-order-scope="all"]').click();
  assert.equal(await page.locator('#order-save').isDisabled(),true,'All order independent: featured draft cannot spill into All Work');
  await page.locator('[data-order-scope="featured"]').click();
  await page.locator('#order-save').click();
  await page.waitForFunction(()=>document.querySelector('#order-message')?.textContent.includes('已保存'),null,{timeout:15000});
  const savedFeatured=JSON.parse(await fs.readFile(orderFile,'utf8'));
  assert.equal(savedFeatured.featured[0],candidateId);
  assert.equal(savedFeatured.featured.length,8);
  assert(!savedFeatured.featured.includes(removedId));
  assert.deepEqual(savedFeatured.all,initial.all,'Featured changes must not rewrite All Work order');
  console.log('FEATURED_SAVED_WITHOUT_LOCK',savedFeatured.featured.join(','));

  const home=await createSafePage(browser,{viewport:{width:1440,height:900}});
  home.on('pageerror',e=>errors.push(e.message));
  await home.goto('http://127.0.0.1:5202/index.html');
  await home.locator('#projects .comet-archive__card').first().waitFor();
  const firstHome=(await home.locator('#projects .comet-archive__title').first().innerText()).trim();
  assert.equal(firstHome,candidateTitle,`Homepage did not pick newly selected featured project`);
  assert.equal(await home.locator('#projects .comet-archive__card').count(),8);
  console.log('HOMEPAGE_SYNC',firstHome);
  await home.close();

  const works=await createSafePage(browser,{viewport:{width:1440,height:900}});
  works.on('pageerror',e=>errors.push(e.message));
  await works.goto('http://127.0.0.1:5202/works.html');
  await works.locator('.library-grid .comet-archive__card').first().waitFor();
  const tabs=await works.locator('.library-filters [data-category]').evaluateAll(els=>els.map(e=>e.dataset.category));
  assert.deepEqual(tabs,['commercial','short-film','social','visual']);
  assert.equal(await works.locator('.library-grid .comet-archive__card').count(),catCount('commercial'));
  const project16 = JSON.parse(await fs.readFile(path.join(fixture,'src/data/auto-projects.json'),'utf8')).find(project => project.id === '16');
  assert(project16, 'The fixture must contain project 16');
  assert(await works.locator('.library-grid .comet-archive__card').filter({hasText:nameOf('16')}).count() >= 1,
    'All Work card must reflect the workbench title');
  assert((await works.locator('.library-intro').innerText()).includes(String(initialCatalog.length)));
  await works.locator('.library-filters [data-category="short-film"]').click();
  assert.equal(await works.locator('.library-grid .comet-archive__card').count(),3);
  await works.locator('.library-filters [data-category="social"]').click();
  assert.equal(await works.locator('.library-grid .comet-archive__card').count(),3);
  await works.locator('.library-filters [data-category="visual"]').click();
  assert.equal(await works.locator('.library-grid .comet-archive__card').count(),2);
  await works.goto('http://127.0.0.1:5202/works.html?category=all');
  assert.equal(await works.locator('.library-grid .comet-archive__card').count(),catCount('commercial'));
  await works.close();

  // All Work can sort independently, including its first item. No pinned
  // cards remain; the original All Work order was kept after Featured save.
  await page.locator('[data-order-scope="all"]').click();
  assert.equal(await page.locator('#order-items .order-item').count(),catCount('commercial'));
  await page.locator('#order-items .order-item').first().focus();
  await page.keyboard.press('ArrowRight');
  const afterMove=await page.locator('#order-items .order-item').first().getAttribute('data-id');
  assert.equal(afterMove,commercialIds[1]);
  assert.equal(await page.locator('#order-save').isEnabled(),true);
  await page.locator('#order-save').click();
  await page.waitForFunction(()=>document.querySelector('#order-message')?.textContent.includes('已保存'));
  const savedAll=JSON.parse(await fs.readFile(orderFile,'utf8'));
  assert.deepEqual(savedAll.featured,savedFeatured.featured);
  assert.equal(savedAll.all.filter(id=>commercialIds.includes(id))[0],commercialIds[1]);
  console.log('ALL_WORK_SAVED_INDEPENDENTLY',savedAll.all.slice(0,5).join(','));

  // Save featured from a filtered candidate category as well.
  await page.locator('[data-order-scope="featured"]').click();
  for(const category of ['social','visual','short-film','commercial']){
    await page.locator(`[data-featured-pool-category="${category}"]`).click();
    if(await page.locator('.order-candidate').count())break;
  }
  const secondCandidate=await page.locator('.order-candidate').first().getAttribute('data-id');
  await page.locator('.order-candidate').first().click();
  await page.locator('#order-items .order-item').last().click();
  assert.equal(await page.locator('#order-items .order-item').last().getAttribute('data-id'),secondCandidate);
  await page.locator('#order-reset').click(); // Restore default only on a draft.
  assert.deepEqual(JSON.parse(await fs.readFile(orderFile,'utf8')),savedAll);
  assert.equal(await page.locator('#order-items .order-item').first().getAttribute('data-id'),'01','Reset restores canonical featured default, not the pre-test custom order');

  const bootstrap=await (await fetch(studio.url+'/api/bootstrap')).json();
  const post=async data=>{
    const response=await fetch(studio.url+'/api/save-order',{
      method:'POST',
      headers:{'Content-Type':'application/json','X-Cover-Token':bootstrap.token},
      body:JSON.stringify(data),
    });
    return response.status;
  };
  assert.equal(await post({scope:'featured',ids:savedFeatured.featured.slice(1),expected:savedFeatured.featured,confirmed:true}),400);
  assert.equal(await post({scope:'featured',ids:Array(8).fill('16'),expected:savedFeatured.featured,confirmed:true}),400);
  assert.equal(await post({scope:'featured',ids:savedFeatured.featured.slice().reverse(),expected:initial.featured,confirmed:true}),409);
  assert.equal(await post({scope:'all',ids:initial.all.slice().reverse(),expected:savedAll.all,confirmed:false}),400);
  assert.deepEqual(JSON.parse(await fs.readFile(orderFile,'utf8')),savedAll);

  const mobile=await createSafePage(browser,{viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto(studio.url); await mobile.locator('.ux-advanced-nav').evaluate(x=>x.open=true);await mobile.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('已载入'));
  await mobile.locator('[data-workflow-target="order"]').click();
  assert.equal(await mobile.locator('#featured-pool-tabs button').count(),4);
  assert.equal(await mobile.locator('#order-items .order-item').count(),8);
  assert.equal(await mobile.locator('#featured-replacement').isVisible(),true);
  await mobile.locator('[data-order-scope="all"]').click();
  assert.equal(await mobile.locator('#order-category-tabs button').count(),4);
  await mobile.locator('[data-order-category="visual"]').click();
  assert.equal(await mobile.locator('#order-items .order-item').count(),2);
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  await mobile.close();
  assert.equal(getSafeMediaReport(page).urls.length,0);
  assert.deepEqual(errors,[]);
  await page.close();
  console.log('INDEPENDENT_FEATURED_E2E_PASS: featured selection saved, homepage sync, all independent, four categories, mobile, validation');
  console.log('ISOLATED_FIXTURE',fixture);
}finally{
  if(browser)await browser.close();
  if(vite)await vite.close();
  await studio.close();
}
