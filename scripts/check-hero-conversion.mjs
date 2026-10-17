/* Phase 2 Step 07: clear AI-video positioning and direct portfolio/contact
   conversion paths. Existing visual layout, work grid and navigation stay intact. */
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
const binary=['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
assert(binary,'Edge/Chrome required');
const port=5276;
const base=process.env.PORTFOLIO_URL||'http://127.0.0.1:'+port+'/';
const sizes=[320,390,760,1024,1440,1920];
const expected={
 zh:{
  positioning:'AI 视频创意 · 影像效果设计',
  subtitle:'为品牌创作 AI 广告、产品影像与创意短片，从创意构思到最终成片。',
  ctas:['查看作品','合作联系'],
  proof:['AI 视频制作','AI 影像效果'],
  details:['品牌广告 · 创意短片','视觉评测 · 创作工作流'],
 },
 en:{
  positioning:'AI Video Creation · Visual Effects',
  subtitle:'AI-powered commercials, product films and creative shorts for brands — from concept to final cut.',
  ctas:['View Work','Get in Touch'],
  proof:['AI Video','AI Effects'],
  details:['Commercials · Short Films','Visual QA · Creative Workflows'],
 }
};
let server;
async function ready(){
 for(let i=0;i<80;i++){
  try{if((await fetch(base,{signal:AbortSignal.timeout(900)})).ok)return;}catch{}
  await new Promise(resolve=>setTimeout(resolve,160));
 }
 throw Error('Vite not ready');
}
try{
 if(!process.env.PORTFOLIO_URL){
  server=spawn(process.execPath,['./node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'});
  await ready();
 }
 const browser=await chromium.launch({headless:true,executablePath:binary});
 try{
  for(const lang of ['zh','en'])for(const width of sizes){
   const p=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
   const tag=width+'px '+lang;
   try{
    const errors=[];
    p.on('pageerror',e=>errors.push(e.message));
    await p.addInitScript(l=>localStorage.setItem('ailuren-lang',l),lang);
    await p.goto(new URL('index.html#top',base).href);
    const primary=p.locator('#top .hero-actions .hero-primary');
    const secondary=p.locator('#top .hero-actions .hero-secondary');
    await primary.waitFor();
    const found=await p.evaluate(()=>{
      const proof=[...document.querySelectorAll('.hero-proof-card')];
      const buttons=[...document.querySelectorAll('#top .hero-actions button')];
      const subtitle=document.querySelector('.hero-subtitle');
      const positioning=document.querySelector('#top .hero-positioning');
      const kickerBox=positioning?.getBoundingClientRect();
      const headingBox=document.querySelector('#hero-title')?.getBoundingClientRect();
      const video=document.getElementById('hero-video');
      return {
       positioning:positioning?.textContent.trim(),
       positioningSize:parseFloat(getComputedStyle(positioning).fontSize),
       positioningWidth:kickerBox?.width,
       positioningLeft:kickerBox?.left,
       headingTop:headingBox?.top,
       positioningBottom:kickerBox?.bottom,
       videoSources:[...video.querySelectorAll('source')].map(x=>x.getAttribute('src')),
       rotatingTitleCount:document.querySelectorAll('#hero-title .text-type__content').length,
       buttons:buttons.map(e=>e.textContent.trim()),
       proof:proof.map(e=>e.querySelector('strong')?.textContent.trim()),
       details:proof.map(e=>e.querySelector('span')?.textContent.trim()),
       subtitle:subtitle?.textContent.trim(),
       buttonGeometry:buttons.map(e=>{
         const r=e.getBoundingClientRect(),c=getComputedStyle(e);
         return {x:r.left,y:r.top,right:r.right,width:r.width,height:r.height,
           fontSize:parseFloat(c.fontSize),fontWeight:c.fontWeight,radius:c.borderTopLeftRadius};
       }),
       buttonGap:parseFloat(getComputedStyle(document.querySelector('#top .hero-actions')).columnGap),
       subtitleColor:getComputedStyle(subtitle).color,
       visibleProof:proof.some(e=>getComputedStyle(e).display!=='none'&&getComputedStyle(e.parentElement).display!=='none'),
       overflow:document.documentElement.scrollWidth-innerWidth,
       navCount:document.querySelectorAll('#primary-nav .site-primary-nav >li>a').length
      }
    });
    assert.deepEqual(found.buttons,expected[lang].ctas,tag+': CTA wording');
    assert.deepEqual(found.proof,expected[lang].proof,tag+': proof labels');
    assert.deepEqual(found.details,expected[lang].details,tag+': proof evidence');
    assert.equal(found.positioning,expected[lang].positioning,tag+': positioning label');
    assert.equal(found.subtitle,expected[lang].subtitle,tag+': confirmed bilingual subtitle');
    assert(found.positioningLeft>=0&&found.positioningLeft+found.positioningWidth<=width+1,tag+': positioning exceeds viewport');
    assert(found.positioningBottom<found.headingTop,tag+': positioning overlaps animated heading');
    assert.equal(found.positioningSize,width<=720?12:13,tag+': positioning violates type scale');
    assert.equal(found.rotatingTitleCount,1,tag+': three-word typing animation replaced');
    // Vite fingerprints the same source files in production.
    assert(found.videoSources.length===2 && /hero-mobile(?:-[a-zA-Z0-9]+)?\.mp4$/.test(found.videoSources[0]) && /(?:^|\/)hero(?:-[a-zA-Z0-9]+)?\.mp4$/.test(found.videoSources[1]),tag+': scroll video source changed');
    assert(found.buttonGeometry.every(r=>r.x>=0&&r.right<=width+1&&r.height>=44),tag+': CTA out of viewport');
    // Two CTA roles share one geometry and typographic baseline.
    const [a,b]=found.buttonGeometry;
    assert.equal(a.height,b.height,tag+': mismatched CTA height');
    assert.equal(a.height,width<=720?46:48,tag+': CTA breakpoint geometry changed');
    assert.equal(a.fontSize,b.fontSize,tag+': CTA font sizes diverged');
    assert.equal(a.fontSize,width<=720?15:16,tag+': CTA text scale changed');
    assert.equal(a.fontWeight,b.fontWeight,tag+': CTA weights diverged');
    assert.equal(a.fontWeight,'600',tag+': CTA weight should be 600');
    assert.equal(a.radius,b.radius,tag+': CTA rounding diverged');
    assert(Math.abs(a.y-b.y)<1,tag+': CTA top edges are not aligned');
    assert(a.width>b.width && a.width-b.width<=24,tag+': CTA hierarchy is visually unbalanced');
    assert.equal(found.buttonGap,width<=720?10:12,tag+': inconsistent CTA gap');
    assert.equal(found.subtitleColor,'rgba(245, 245, 247, 0.88)',tag+': subtitle legibility token not applied');
    assert.equal(found.overflow,0,tag+': horizontal overflow');
    assert.equal(found.navCount,4,tag+': top navigation changed');
    // Composite the CTA's translucent surface over near-white and near-black
    // footage, rather than assuming one favorable video frame.
    const checkContrast = async state => {
      const stats = await secondary.evaluate(el => {
        const css=getComputedStyle(el);
        const channels=color=>(color.match(/[0-9.]+/g)||[]).map(Number);
        const fg=channels(css.color),bg=channels(css.backgroundColor);
        const luminance=rgb=>{
          const v=rgb.slice(0,3).map(c=>c/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
          return .2126*v[0]+.7152*v[1]+.0722*v[2];
        };
        const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
        const alpha=bg[3]??1;
        return {
          alpha,
          border:parseFloat(css.borderTopWidth),
          ratios:[[0,0,0],[255,255,255]].map(backdrop=>contrast(fg,backdrop.map((value,i)=>bg[i]*alpha+value*(1-alpha)))),
        };
      });
      assert(stats.alpha>=.9,tag+' '+state+': contact CTA not protected from bright footage');
      assert(stats.border>=1,tag+' '+state+': contact CTA has no visible edge');
      assert(stats.ratios.every(r=>r>=7),tag+' '+state+': insufficient contrast '+stats.ratios.join('/'));
    };
    await checkContrast('normal');
    await secondary.hover();
    await checkContrast('hover');
    await primary.click();
    await p.waitForFunction(()=>location.hash==='#projects');
    assert(await p.locator('#projects .comet-archive__card').first().isVisible(),tag+': projects absent');
    await secondary.click();
    await p.waitForFunction(()=>location.hash==='#contact');
    await p.locator('#contact').scrollIntoViewIfNeeded();
    const geom=await p.locator('#contact').boundingBox();
    assert(geom && geom.y<900 && geom.y+geom.height>0,tag+': contact region not reachable');
    assert((await p.locator('#contact a[href^="mailto:"]').count())>=1,tag+': no email option');
    if(width>=1024){
      await p.waitForTimeout(250);
      assert.equal(await p.locator('#primary-nav a.is-active').first().getAttribute('href'),'#contact',tag+': Contact not highlighted');
    }
    assert.deepEqual(errors,[],tag+': runtime errors');
    console.log('PASS '+tag+': capability proof, CTA layout, work and contact paths');
   }finally{await p.close()}
  }
 }finally{await browser.close()}
 console.log('PASS Step 07: 6 widths x 2 languages, Hero-to-work/contact conversion');
}finally{
 if(server){server.kill('SIGTERM');await new Promise(resolve=>setTimeout(resolve,120));}
}
