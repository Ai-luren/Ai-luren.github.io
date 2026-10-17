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
  ctas:['查看作品','合作联系'],
  proof:['AI 视频制作','AI 影像效果'],
  details:['品牌广告 · 创意短片','视觉评测 · 创作工作流'],
 },
 en:{
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
      return {
       buttons:buttons.map(e=>e.textContent.trim()),
       proof:proof.map(e=>e.querySelector('strong')?.textContent.trim()),
       details:proof.map(e=>e.querySelector('span')?.textContent.trim()),
       subtitle:subtitle?.textContent.trim(),
       buttonGeometry:buttons.map(e=>{const r=e.getBoundingClientRect();return {x:r.left,right:r.right,width:r.width,height:r.height};}),
       visibleProof:proof.some(e=>getComputedStyle(e).display!=='none'&&getComputedStyle(e.parentElement).display!=='none'),
       overflow:document.documentElement.scrollWidth-innerWidth,
       navCount:document.querySelectorAll('#primary-nav .site-primary-nav >li>a').length
      }
    });
    assert.deepEqual(found.buttons,expected[lang].ctas,tag+': CTA wording');
    assert.deepEqual(found.proof,expected[lang].proof,tag+': proof labels');
    assert.deepEqual(found.details,expected[lang].details,tag+': proof evidence');
    assert((lang==='zh'?found.subtitle.includes('品牌广告')&&found.subtitle.includes('创意短片'):found.subtitle.includes('commercials')&&found.subtitle.includes('short films')),tag+': subtitle must convey commercial-video craft');
    assert(found.buttonGeometry.every(r=>r.x>=0&&r.right<=width+1&&r.height>=44),tag+': CTA out of viewport');
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
