import assert from 'node:assert/strict';
import {existsSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {createSafePage,getSafeMediaReport} from './lib/safe-media.mjs';
const executablePath=[
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
assert(executablePath,'Browser required');
const browser=await chromium.launch({executablePath,headless:true});
const base=process.env.PORTFOLIO_URL??'http://127.0.0.1:5174/';
const featured={
 zh:['屈臣氏 AI 品牌广告','联想 AI 品牌广告','湖南 AI 文旅宣传','通义万相 AI 品牌广告','霸王茶姬 AI 品牌广告','悠船 AI 创意短片','通义万相 AI 创意短片','宠物 AI 创意短片'],
 en:['Watsons AI Brand Ad','Lenovo AI Brand Ad','Hunan AI Travel Film','Wan AI Brand Ad','Chagee AI Brand Ad','Midjourney AI Short Film','WAN AI Short Film','Pet AI Short Film']
};
const awards={
 zh:['MJ 官方优秀作品','未来AI设计大赛','联想AI比赛','海螺AI动物跳水','无限剧场小赛','海纳星火计划','海纳星火计划','影视级特效小赛'],
 en:['Midjourney Official Featured','Future AI Design Contest','Lenovo AI Competition','Hailuo AI Animal Diving','Infinite Theater Contest','Spark of Haina Program','Spark of Haina Program','Cinematic Effects Contest']
};
const shotdir='.oil-ui/curated-order/shots';mkdirSync(shotdir,{recursive:true});
let passed=0;
try{
 for(const width of [320,390,720,721,1024,1440])for(const lang of ['zh','en']){
  const tag=width+' '+lang;
  const page=await createSafePage(browser,{viewport:{width,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.addInitScript(l=>localStorage.setItem('ailuren-lang',l),lang);
   await page.goto(new URL('index.html',base).href,{waitUntil:'domcontentloaded'});
   const readProjects=async()=>page.locator('#projects .comet-archive__card .comet-archive__title').allTextContents()
     .then(xs=>xs.map(x=>x.replace(/\s+/g,' ').trim()));
   const readAwards=async()=>page.locator('#impact-awards .impact-award-card-caption strong').allTextContents()
     .then(xs=>xs.map(x=>x.replace(/\s+/g,' ').trim()));
   await page.locator('#projects .comet-archive__card').first().waitFor({state:'attached'});
   await page.locator('#impact-awards .impact-award-card').first().waitFor({state:'attached'});
   if(width>720){
     assert.deepEqual(await readProjects(),featured[lang],tag+': desktop featured order');
     assert.deepEqual(await readAwards(),awards[lang],tag+': desktop award order');
   }else{
     assert.deepEqual(await readProjects(),featured[lang].slice(0,4),tag+': featured page 1');
     await page.locator('#projects .comet-archive-pagination button').nth(1).evaluate(e=>e.click());
     assert.deepEqual(await readProjects(),featured[lang].slice(4),tag+': featured page 2');
     await page.locator('#projects .comet-archive-pagination button').first().evaluate(e=>e.click());
     assert.deepEqual(await readProjects(),featured[lang].slice(0,4),tag+': featured page 1 return');
     const pagination=page.locator('#impact-awards .impact-award-pagination button');
     assert.equal(await pagination.count(),8,tag+': award pagination count');
     const urls=[];
     for(let i=0;i<8;i++){
       await pagination.nth(i).evaluate(e=>e.click());
       assert.deepEqual(await readAwards(),[awards[lang][i]],tag+': award pagination '+i);
       urls.push(await page.locator('#impact-awards .impact-award-card img').first().getAttribute('src'));
     }
     assert.notEqual(urls[5],urls[6],tag+': distinct Haina proof images mixed together');
     await pagination.first().evaluate(e=>e.click());
   }
   // Viewer order derives from the same canonical award list.
   await page.locator('#impact-awards .impact-award-card').first().evaluate(e=>e.click());
   await page.locator('.impact-award-lightbox').waitFor({state:'visible',timeout:8500});
   assert.equal((await page.locator('#impact-award-lightbox-title').textContent()).trim(),awards[lang][0],tag+': first award viewer');
   await page.locator('.impact-award-lightbox-nav--next').evaluate(e=>e.click());
   assert.equal((await page.locator('#impact-award-lightbox-title').textContent()).trim(),awards[lang][1],tag+': viewer next sequence');
   await page.locator('.impact-award-lightbox .cinema-player__close').first().evaluate(e=>e.click());
   await page.locator('.impact-award-lightbox').waitFor({state:'detached',timeout:8000});
   await page.locator('#projects .comet-archive__card').first().evaluate(e=>e.click());
   await page.locator('.cinema-player[open]').waitFor({state:'visible',timeout:8500});
   assert.equal((await page.locator('#cinema-player-title').textContent()).trim(),featured[lang][0],tag+': featured viewer');
   assert.equal((await page.locator('.cinema-player__count').textContent()).trim(),'1 / 8',tag+': featured viewer counter');
   await page.locator('.cinema-player__work-nav button').last().evaluate(e=>e.click());
   await page.waitForFunction(expected=>document.querySelector('#cinema-player-title')?.textContent?.trim()===expected,featured[lang][1],{timeout:8000});
   if([390,1440].includes(width)){
     await page.locator('.cinema-player__close').first().evaluate(e=>e.click());
     await page.locator('#projects').scrollIntoViewIfNeeded();await page.waitForTimeout(400);
     await page.screenshot({path:`${shotdir}/featured-${width}-${lang}.jpg`,type:'jpeg',quality:80});
     await page.locator('#impact-awards').scrollIntoViewIfNeeded();await page.waitForTimeout(400);
     await page.screenshot({path:`${shotdir}/awards-${width}-${lang}.jpg`,type:'jpeg',quality:80});
   }
   assert.deepEqual(errors,[],tag+': JavaScript errors');
   assert.equal(getSafeMediaReport(page).urls.length,0,tag+': CDN video request');
   // All Work stays on its original independent ordering.
   const library=await createSafePage(browser,{viewport:{width,height:900}});
   try{
     await library.addInitScript(l=>localStorage.setItem('ailuren-lang',l),lang);
     await library.goto(new URL('works.html',base).href,{waitUntil:'domcontentloaded'});
     await library.locator('.library-grid .comet-archive__card').first().waitFor({state:'attached'});
     const first=(await library.locator('.library-grid .comet-archive__title').first().textContent()).replace(/\s+/g,' ').trim();
     assert.equal(first,featured[lang][0],tag+': library first card changed');
     assert.equal(getSafeMediaReport(library).urls.length,0,tag+': library CDN');
   }finally{await library.close();}
   passed++;console.log('PASS',tag,'ordered 8 featured / 8 awards / viewer steps / unchanged library');
  }finally{await page.close();}
 }
}finally{await browser.close();}
console.log('PASS curated display order:',passed,'width / language combinations');
