import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const base=process.env.PORTFOLIO_URL || 'http://127.0.0.1:5181/';
const out=process.env.NAV_SCREENSHOTS;
if(out)mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
const geometry=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {box:[r.x,r.y,r.width,r.height],surface:s.backgroundColor,border:s.borderColor,radius:s.borderRadius};};
function same(a,b){a.box.forEach((v,i)=>assert(Math.abs(v-b.box[i])<1,`${a.box} != ${b.box}`));assert.equal(a.surface,b.surface);assert.equal(a.border,b.border);assert.equal(a.radius,b.radius);}
async function shot(p,name){if(out)await p.screenshot({path:`${out}/${name}.png`});}
async function arrows(p,width){
 const m=await p.evaluate(()=>{const r=e=>{const x=e.getBoundingClientRect();return {left:x.left,right:x.right,top:x.top,bottom:x.bottom,w:x.width,h:x.height};};return {stage:r(document.querySelector('.cinema-player__stage')),buttons:[...document.querySelectorAll('.cinema-player__sequence button')].map(r),side:document.querySelector('.cinema-player__body').classList.contains('has-side-arrows'),overflow:document.querySelector('.cinema-player').scrollWidth>innerWidth};});
 assert(!m.overflow);assert.equal(m.buttons.length,2);
 for(const b of m.buttons){assert(b.w>=44&&b.h>=44);assert(b.left>=0&&b.right<=width);assert(b.right<=m.stage.left||b.left>=m.stage.right||b.top>=m.stage.bottom,'Arrow overlaps video');}
 if(width<=760)assert(!m.side);
}
try{
 for(const width of [360,375,393,430,1280,1440,1920]){
  const p=await browser.newPage({viewport:{width,height:width<=760?852:1000}});
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(new URL('index.html',base).href);await p.waitForSelector('.comet-archive__card',{state:'attached'});await p.waitForTimeout(450);
  const home=await p.locator('body > header').evaluate(geometry);
  const button=width<=760?await p.locator('header .nav-toggle').evaluate(geometry):null;
  const brand=await p.locator('header .brand').evaluate(geometry);
  if(width<=760){
   await p.locator('.nav-toggle').click();await p.waitForFunction(()=>document.querySelector('#mobile-nav-drawer').classList.contains('is-open'));await p.waitForTimeout(550);
   assert(await p.locator('main').evaluate(el=>el.inert));
   for(let i=0;i<12;i++){await p.keyboard.press('Tab');assert(await p.evaluate(()=>!!document.activeElement.closest('header,#mobile-nav-drawer')));}
   if(width===393)await shot(p,`${width}-home-menu`);
   await p.keyboard.press('Escape');await p.waitForTimeout(450);assert(!await p.locator('main').evaluate(el=>el.inert));
  }
  if([393,1440].includes(width))await shot(p,`${width}-home-navigation`);
  await p.locator('#projects').scrollIntoViewIfNeeded();
  for(const index of [0,3]){
   await p.locator('.comet-archive__card').nth(index).click();await p.waitForFunction(id=>document.querySelector('.cinema-player')?.dataset.projectId===id,String(index+1).padStart(2,'0'));assert.deepEqual(await p.locator('.cinema-player video').evaluate(v=>[v.paused,v.currentTime,v.hasAttribute('src'),v.readyState]),[true,0,false,0]);await p.mouse.move(0,0);await p.waitForTimeout(220);
   same(home,await p.locator('.cinema-player__navigation').evaluate(geometry));if(button)same(button,await p.locator('.cinema-player__close').evaluate(geometry));same(brand,await p.locator('.cinema-player__brand').evaluate(geometry));
   await arrows(p,width);await p.keyboard.press('Escape');
  }
  if(width<=760){await p.locator('.nav-toggle').click();await p.locator('#mobile-primary-nav a[href="#impact-awards"]').click();}
  else await p.locator('#primary-nav [data-impact-nav]').click();
  await p.waitForTimeout(650);
  await p.locator('.impact-award-card').first().click();await p.waitForSelector('#impact-award-lightbox');await p.waitForTimeout(400);await p.mouse.move(0,0);await p.waitForTimeout(220);
  same(home,await p.locator('#impact-award-lightbox .cinema-player__navigation').evaluate(geometry));if(button)same(button,await p.locator('#impact-award-lightbox .cinema-player__close').evaluate(geometry));
  assert.equal(await p.locator('.impact-award-lightbox-close').count(),0);
  const image=await p.locator('#impact-award-lightbox figure > img').getAttribute('src');
  await p.locator('.impact-award-lightbox-nav--next').click();assert.notEqual(await p.locator('#impact-award-lightbox figure > img').getAttribute('src'),image);
  await p.locator('#impact-award-lightbox .cinema-player__language').click();assert.equal(await p.locator('html').getAttribute('lang'),'en');
  for(let i=0;i<12;i++){await p.keyboard.press('Tab');assert(await p.evaluate(()=>!!document.activeElement.closest('#impact-award-lightbox')));}
  if([393,1440].includes(width))await shot(p,`${width}-award-viewer`);
  await p.keyboard.press('Escape');await p.waitForSelector('#impact-award-lightbox',{state:'detached'});
  assert(await p.locator('.impact-award-card').first().evaluate(el=>el===document.activeElement));
  assert(!await p.locator('main').evaluate(el=>el.inert));
  await p.goto(new URL('works.html?category=visual',base).href);
  same(home,await p.locator('.library-page-navigation .cinema-player__navigation').evaluate(geometry));if(button)same(button,await p.locator('.library-page-navigation .cinema-player__close').evaluate(geometry));
  if([393,1440].includes(width))await shot(p,`${width}-works-navigation`);
  if(width<=760){
   await p.locator('.library-page-navigation .cinema-player__close').click();await p.waitForSelector('.library-menu[open]');await p.mouse.move(0,0);await p.waitForTimeout(220);
   same(button,await p.locator('.library-menu .cinema-player__close').evaluate(geometry));
   assert.equal(await p.locator('.shared-menu-links a').count(),7);
   assert((await p.locator('.shared-menu-links a').first().getAttribute('href')).endsWith('index.html#projects'));
   for(let i=0;i<12;i++){await p.keyboard.press('Tab');assert(await p.evaluate(()=>!!document.activeElement.closest('.library-menu')));}
   await p.keyboard.press('Escape');assert.equal(await p.locator('.library-menu').count(),0);
   assert(await p.locator('.library-page-navigation .cinema-player__close').evaluate(el=>el===document.activeElement));
  }
  await p.locator('.library-grid .comet-archive__card').first().click();await p.waitForSelector('.cinema-player[open]');
  assert.equal(await p.locator('.cinema-player__navigation').count(),1);
  same(home,await p.locator('.cinema-player__navigation').evaluate(geometry));
  await p.locator('.cinema-player__return').click();assert.equal(new URL(p.url()).searchParams.get('category'),'visual');
  assert.deepEqual(errors,[]);
  console.log(`${width}px: capsule continuity, responsive navigation, awards navigation/language, arrow hit areas and filtered return passed`);
  await p.close();
 }
 // A blurred scrolling ancestor must never carry the fixed award capsule away.
 const short=await browser.newPage({viewport:{width:393,height:500}});
 await short.goto(new URL('index.html#impact-awards',base).href);
 await short.locator('.nav-toggle').click();await short.locator('#mobile-primary-nav a[href="#impact-awards"]').click();await short.waitForTimeout(650);
 await short.locator('.impact-award-card').first().click();await short.waitForTimeout(400);
 const before=await short.locator('#impact-award-lightbox .cinema-player__navigation').evaluate(geometry);
 await short.locator('#impact-award-lightbox').evaluate(el=>el.scrollTop=300);
 same(before,await short.locator('#impact-award-lightbox .cinema-player__navigation').evaluate(geometry));
 await short.locator('#impact-award-lightbox .cinema-player__close').click();await short.close();
 console.log('Short award viewport: capsule stays fixed while image content scrolls');
 for(const width of [393,1440]) for(const mode of ['normal','reduced','unsupported']) {
  const p=await browser.newPage({viewport:{width,height:width===393?852:1000}});
  const cdp=await p.context().newCDPSession(p);
  await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:mode==='reduced'?'reduce':'no-preference'}]});
  const capability=async()=>{
   if(mode!=='unsupported')return;
   assert(await p.evaluate(()=>{
    let changed=0;
    for(const sheet of document.styleSheets)for(let i=0;i<sheet.cssRules.length;i++){
     const rule=sheet.cssRules[i];
     if(rule.type===CSSRule.SUPPORTS_RULE&&rule.conditionText.includes('backdrop-filter')){
      const condition=rule.conditionText.replaceAll('backdrop-filter','unsupported-backdrop-filter');
      if(!CSS.supports(condition))throw Error('Unsupported condition must exercise fallback');
      const css=rule.cssText.replace(rule.conditionText,condition);sheet.deleteRule(i);sheet.insertRule(css,i);changed++;
     }
    }
    return changed>0;
   }));
  };
  const material=async(selector,pseudo=null)=>{
   const style=await p.locator(selector).evaluate((el,pseudo)=>{const s=getComputedStyle(el,pseudo);return {bg:s.backgroundColor,blur:s.backdropFilter,webkit:s.getPropertyValue('-webkit-backdrop-filter'),opacity:getComputedStyle(el).opacity};},pseudo);
   assert.equal(style.bg,mode==='normal'?'rgba(12, 12, 13, 0.9)':'rgb(12, 12, 13)');
   assert.equal(style.blur,mode==='normal'?'blur(28px) saturate(1.02)':'none');
   assert.equal(style.opacity,'1');
  };
  await p.goto(new URL('index.html#impact-awards',base).href);await p.waitForSelector('.impact-award-card',{state:'attached'});await capability();
  if(width<=760){await p.locator('.nav-toggle').click();await p.locator('#mobile-primary-nav a[href="#impact-awards"]').click();}
  else await p.locator('#primary-nav [data-impact-nav]').click();
  await p.waitForTimeout(650);
  await p.locator('.impact-award-card').first().click();await p.waitForTimeout(420);
  await material('#impact-award-lightbox','::before');
  if(out&&width===393)await shot(p,`${width}-award-${mode}`);
  await p.locator('#impact-award-lightbox .cinema-player__close').click();
  if(mode!=='normal')assert.equal(await p.locator('#impact-award-lightbox').evaluate(el=>getComputedStyle(el).opacity),'1');
  await p.waitForSelector('#impact-award-lightbox',{state:'detached'});
  await p.goto(new URL('works.html',base).href);await capability();
  if(width<=760){
   await p.locator('.library-page-navigation .cinema-player__close').click();await p.waitForSelector('.library-menu[open]');
   await material('.library-menu','::backdrop');
   if(out&&width===393)await shot(p,`${width}-library-menu-${mode}`);
   await p.keyboard.press('Escape');
  }
  console.log(`${width}px ${mode}: award fallback and responsive library navigation passed`);
  await p.close();
 }
}finally{await browser.close();}
