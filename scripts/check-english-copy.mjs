// English copy contract: naming consistency, copy accuracy, and unchanged Hero lines.
// Only local preview is visited; safe-media blocks ImageKit and unrelated remote media.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {createSafePage,getSafeMediaReport} from './lib/safe-media.mjs';

const base=process.env.PORTFOLIO_URL||'http://127.0.0.1:5174/';
const hero=readFileSync('src/components/HeroTitle.jsx','utf8');
assert(hero.includes("en: ['Video Design', 'Image Design', 'Vibe Coding']"),'Hero word order must remain Video → Image → Vibe Coding');
assert(hero.includes("zh: ['视频设计', '图像设计', '氛围编程']"),'Chinese Hero order must match English');
assert(hero.includes("lang === 'en' ? 'AI Creative'"),'Do not modify the AI Creative prefix');
const old=[
  'Selected Works Archive','AI Overseas Product Ads','AI Platform Creator','AI Media',
  'Midjourney Official Featured','Lenovo Special Thanks','Featured by Tongyi Official',
  'Overseas Wireless Earbuds AI Social Creative Ad','Chinese Giant Aesthetics',
  'AI Article Illustration','Visit homepage','Description / Stack',
  '9 years of motion design at Kuaishou and Xiaomi','Awarded by Kling, Tongyi, and Midjourney',
];
for(const f of ['src/i18n/dictionary.js','src/data/projects.js','src/components/ImpactEvidence.jsx','src/components/ExperimentFlip.jsx','src/components/WorksLibrary.jsx']){
 const content=readFileSync(f,'utf8');
 for(const phrase of old){
  // The old category name survives only as a physical video-directory path.
  if(f==='src/data/projects.js' && phrase==='AI Overseas Product Ads') continue;
  assert(!content.includes(phrase),`${f} retains deprecated English copy: ${phrase}`);
 }
}
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
try{
 for(const width of [390,744,1440]){
  for(const route of ['index.html','works.html']){
   const page=await createSafePage(browser,{viewport:{width,height:900},hasTouch:width<760});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>localStorage.setItem('ailuren-lang','en'));
   await page.goto(new URL(route,base).href,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(route=>route==='index.html'?document.querySelector('#projects-title')?.textContent?.trim()==='Selected Work':document.querySelector('.library-grid .comet-archive__card'),route);
   const checks=await page.evaluate(()=>{
    const text=document.body.innerText;
    return {
     pageTitle:document.title,meta:document.querySelector('meta[name="description"]')?.content,
     brandName:document.querySelector('.nav-brand-name')?.textContent?.trim(),
     footerBrand:document.querySelector('.footer-brand-copy strong')?.textContent?.trim(),
     aboutRole:document.querySelector('.about-role')?.textContent?.trim(),
     drawerBrand:document.querySelector('.mobile-nav-drawer-brand')?.textContent?.trim(),
     ogTitle:document.querySelector('meta[property="og:title"]')?.content,
     ogDescription:document.querySelector('meta[property="og:description"]')?.content,
     ogSiteName:document.querySelector('meta[property="og:site_name"]')?.content,
     featuredHeading:document.querySelector('#projects-title')?.textContent?.trim(),
     creatorHeading:document.querySelector('#impact-programs .impact-evidence-label h2')?.textContent?.trim(),
     socialHeading:document.querySelector('#impact-reach .impact-evidence-label h2')?.textContent?.trim(),
     programDescription:document.querySelector('.impact-platform-desktop-description')?.textContent,
     labTitles:[...document.querySelectorAll('.flip-experiment__title')].map(e=>e.textContent.trim()),
     text, overflow:document.documentElement.scrollWidth-innerWidth,
     awards:[...document.querySelectorAll('#impact-awards .impact-award-card-caption strong')].map(e=>e.textContent.trim()),
     category:document.querySelector('[data-category="social"]')?.innerText,
     titles:[...document.querySelectorAll('.library-grid .comet-archive__title')].map(e=>e.textContent.replace(/\s+/g,' ').trim()),
    };
   });
   assert(checks.overflow<=2,`${width} ${route}: horizontal overflow ${checks.overflow}`);
   assert(checks.pageTitle.includes('Ai Luren'),`${width} ${route}: untranslated page title`);
   if(route==='index.html'){
    assert.equal(checks.brandName,'Ai Luren', 'English navigation branding mismatch');
    assert.equal(checks.footerBrand,'Ai Luren', 'English footer branding mismatch');
    assert.equal(checks.aboutRole,'AI Video Creator', 'English professional title mismatch');
    assert.equal(checks.drawerBrand,'Ai Luren / Menu', 'English mobile drawer branding mismatch');
   }
   assert(!checks.meta.includes('AI路人'),`${width} ${route}: untranslated meta description`);
   assert(!/[\u3400-\u9fff]/.test(checks.ogTitle||''),`${width} ${route}: untranslated OG title`);
   assert(!/[\u3400-\u9fff]/.test(checks.ogDescription||''),`${width} ${route}: untranslated OG description`);
   if(route==='index.html'){
    assert.equal(checks.featuredHeading,'Selected Work','Selected Work heading missing');
    assert.equal(checks.creatorHeading,'Creator Programs','Creator Programs heading missing');
    assert.equal(checks.socialHeading,'Social Media','Social Media heading missing');
    assert(checks.awards.includes('Featured by Midjourney'), 'Midjourney recognition wording missing');
    assert.equal(checks.programDescription,'Recognized through AI creator programs','Program credentials wording missing');
    assert(readFileSync('src/components/ExperimentFlip.jsx','utf8').includes("en: 'AI Editorial Illustration'"), 'Editorial illustration wording missing');
    assert(!checks.meta.includes('Awarded by Kling'), 'Confusing platform awards and selections');
   }else{
    assert(checks.category.includes(width<=760?'Product Ads':'AI Product & Social Ads'), 'Product category label not localized');
    assert(checks.titles.includes('Wireless Earbuds · AI Social Media Ad'), 'Missing natural social video title');
    assert(checks.titles.includes('Chinese-Inspired Giant-Scale Visuals'), 'Missing visual experiment title');
    assert(checks.titles.length===15, 'Lost a work while updating translations');
    assert(!checks.titles.some(t=>t.includes('Overseas Wireless')||t.includes('Overseas Car Seat')), 'Old overseas title displayed');
   }
   assert.deepEqual(errors,[],`${width} ${route}: JavaScript errors`);
   assert.equal(getSafeMediaReport(page).urls.length,0,'Unexpected ImageKit media');
   console.log('PASS',width,route,'English labels, metadata and layout');
   await page.close();
  }
 }
}finally{await browser.close()}
