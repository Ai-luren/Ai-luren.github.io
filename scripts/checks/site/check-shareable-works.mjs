import assert from 'node:assert/strict';import {chromium} from 'playwright-core';import {createSafePage} from '../../lib/safe-media.mjs';
const b=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
for(const width of [390,1440]){
 for(const [id,category] of [['01','commercial'],['05','short-film'],['10','social'],['14','visual']]){
  const p=await createSafePage(b,{viewport:{width,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{window.__copiedLink='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async url=>{window.__copiedLink=url;}}});});
  await p.goto('http://127.0.0.1:5174/works.html?watch='+id,{waitUntil:'domcontentloaded'});
  await p.locator('.cinema-player[open]').waitFor({timeout:12000});
  assert.equal(await p.locator(`.library-filters button[data-category="${category}"]`).getAttribute('aria-pressed'),'true');
  assert.equal(await p.locator('.cinema-player video').getAttribute('src'),null,'Share must not autoplay or load video');
  await p.locator('.cinema-player__share').click();
  const copied=await p.evaluate(()=>window.__copiedLink);
  assert(new URL(copied).searchParams.get('watch')===id,`Clipboard link id ${id}`);
  await p.goBack({waitUntil:'domcontentloaded'}).catch(()=>{});await p.locator('.cinema-player').waitFor({state:'detached'});
  assert.equal(new URL(p.url()).searchParams.has('watch'),false);
  await p.goForward({waitUntil:'domcontentloaded'}).catch(()=>{});await p.locator('.cinema-player[open]').waitFor();
  assert.equal(new URL(p.url()).searchParams.get('watch'),id);
  await p.locator('.cinema-player__close').first().click();await p.locator('.cinema-player').waitFor({state:'detached'});
  assert.equal(new URL(p.url()).searchParams.has('watch'),false);
  assert.deepEqual(errors,[]);
  console.log('PASS_SHARE_URL',width,id,category);
  await p.close();
 }
 const p=await createSafePage(b,{viewport:{width,height:900}});
 await p.goto('http://127.0.0.1:5174/works.html?project=05',{waitUntil:'domcontentloaded'});
 await p.locator('.library-preview-target').waitFor();
 assert.equal(await p.locator('.cinema-player[open]').count(),0,'Studio preview must NOT open film');
 console.log('PASS_STUDIO_PROJECT_ISOLATION',width);
 await p.close();
}
// A normal work click creates a reversible history entry. Homepage Featured
// only copies a share URL and does not mutate the home route.
for(const width of [390,1440]) {
 const p=await createSafePage(b,{viewport:{width,height:900}});
 await p.goto('http://127.0.0.1:5174/works.html',{waitUntil:'domcontentloaded'});
 await p.locator('.library-grid .comet-archive__card').first().click();
 await p.locator('.cinema-player[open]').waitFor();
 const watch=new URL(p.url()).searchParams.get('watch');
 assert(watch,'Normal card click must set a shareable URL');
 await p.locator('.cinema-player__close').first().click();
 await p.locator('.cinema-player').waitFor({state:'detached'});
 assert.equal(new URL(p.url()).searchParams.get('watch'),null,'Closing a normal card removes the share parameter');
 await p.close();
 const home=await createSafePage(b,{viewport:{width,height:900}});
 await home.addInitScript(()=>{window.__copiedLink='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async url=>{window.__copiedLink=url;}}});});
 await home.goto('http://127.0.0.1:5174/index.html',{waitUntil:'domcontentloaded'});
 await home.locator('#projects .comet-archive__card').first().click();
 await home.locator('.cinema-player[open]').waitFor();
 await home.locator('.cinema-player__share').click();
 const copied=await home.evaluate(()=>window.__copiedLink);
 assert.equal(new URL(copied).pathname,'/works.html');
 assert(new URL(copied).searchParams.get('watch'),'Featured must copy a direct film URL');
 assert.equal(new URL(home.url()).searchParams.has('watch'),false,'Featured viewer must not rewrite home route');
 console.log('PASS_HOME_AND_NORMAL_SHARE',width);
 await home.close();
}
await b.close();
