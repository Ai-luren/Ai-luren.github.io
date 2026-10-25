import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createSafePage} from './lib/safe-media.mjs';
const browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
for(const [width,lang] of [[320,'zh'],[320,'en'],[390,'zh'],[390,'en'],[720,'en'],[1440,'zh'],[1440,'en']]){
 const p=await createSafePage(browser,{viewport:{width,height:880}});
 await p.addInitScript(value=>localStorage.setItem('ailuren-lang',value),lang);
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(new URL('works.html',process.env.PORTFOLIO_URL || 'http://127.0.0.1:5174/').href,{waitUntil:'domcontentloaded'});
 await p.locator('.library-grid .comet-archive__card').first().waitFor();
 const inspect=()=>p.evaluate(()=>{
   const card=document.querySelector('.library-grid .comet-archive__card');
   const note=document.querySelector('.library-category-note');
   return{y:+card.getBoundingClientRect().y.toFixed(2),h:+note.getBoundingClientRect().height.toFixed(2),count:document.querySelectorAll('.library-grid .comet-archive__card').length,note:note.textContent.trim(),overflow:document.documentElement.scrollWidth>innerWidth+1};
 });
 const initial=await inspect();
 for(const id of ['commercial','social','short-film','visual','all']){
  await p.locator('.library-filters button[data-category="'+id+'"]').click();
  const s=await inspect();
  assert(Math.abs(s.y-initial.y)<1.3,width+' '+lang+' '+id+': card jumps '+(s.y-initial.y)+'px');
  assert(!s.overflow,'page overflows '+width+' '+lang);
 }
 assert.deepEqual(errors,[]);
 console.log('PASS STEP02',width,lang,'noteHeight',initial.h,'cardY',initial.y,'category switching stationary');
 await p.close();
}
await browser.close();
