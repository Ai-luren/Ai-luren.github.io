/**
 * A destination clicked in the primary navigation must stay selected during
 * smooth scrolling past intermediate sections. Manual scrolling afterward
 * must resume normal viewport-driven highlighting.
 */
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';

const executablePath=[
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
assert(executablePath,'Chrome or Edge is required');
const port=5267;
const base=process.env.PORTFOLIO_URL||'http://127.0.0.1:'+port+'/';
let server;
async function ready(){
  for(let i=0;i<85;i++){
    try{if((await fetch(base,{signal:AbortSignal.timeout(900)})).ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  throw Error('Vite test server not ready');
}
async function recorder(page){
  await page.evaluate(()=>{
    const nav=document.querySelector('#primary-nav');
    const value=()=>[...nav.querySelectorAll('a.is-active')].map(a=>a.getAttribute('href'));
    window.__navTransitions=[value()];
    window.__navObserver?.disconnect();
    window.__navObserver=new MutationObserver(()=>{
      const next=value();
      if(JSON.stringify(next)!==JSON.stringify(window.__navTransitions.at(-1)))window.__navTransitions.push(next);
    });
    window.__navObserver.observe(nav,{attributes:true,attributeFilter:['class'],subtree:true});
  });
}
async function values(page){return page.evaluate(()=>window.__navTransitions);}
async function active(page){return page.locator('#primary-nav a.is-active').evaluateAll(es=>es.map(e=>e.getAttribute('href')));}
try{
  if(!process.env.PORTFOLIO_URL){
    server=spawn(process.execPath,['./node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'});
    await ready();
  }
  const browser=await chromium.launch({headless:true,executablePath});
  try{
    for(const width of [1024,1440,1920])for(const lang of ['zh','en'])for(const start of ['projects','recognition']){
      const page=await browser.newPage({viewport:{width,height:900}});
      const tag=width+'px '+lang+' '+start;
      try{
        const errors=[];page.on('pageerror',err=>errors.push(err.message));
        await page.addInitScript(l=>localStorage.setItem('ailuren-lang',l),lang);
        await page.goto(new URL('index.html#'+start,base).href);
        await page.locator('#primary-nav a[href="#contact"]').waitFor();
        await page.evaluate(id=>document.getElementById(id).scrollIntoView({block:'start',behavior:'instant'}),start);
        await page.waitForTimeout(300);
        await recorder(page);
        await page.locator('#primary-nav a[href="#contact"]').click();
        await page.waitForFunction(()=>location.hash==='#contact');
        await page.waitForTimeout(1200);
        assert.deepEqual(await active(page),['#contact'],tag+': destination is not selected');
        const transitions=await values(page);
        assert(!transitions.some((entry,index)=>index>0&&entry.includes('#recognition')),tag+': Expertise flashed during Contact smooth scroll: '+JSON.stringify(transitions));
        assert.equal(transitions.filter(v=>v.includes('#contact')).length,1,tag+': contact selection flickered '+JSON.stringify(transitions));
        // Scroll-driven highlighting must react normally once navigation completes.
        await page.evaluate(()=>document.getElementById('experiments').scrollIntoView({block:'center',behavior:'instant'}));
        await page.waitForFunction(()=>document.querySelector('#primary-nav a[href="#recognition"]')?.classList.contains('is-active'),null,{timeout:1500});
        await page.waitForTimeout(180);
        assert.deepEqual(await active(page),['#recognition'],tag+': scroll observer remained locked after navigation');
        await page.locator('#primary-nav a[href="#projects"]').click();
        await page.waitForFunction(()=>location.hash==='#projects');
        await page.waitForTimeout(1100);
        assert.deepEqual(await active(page),['#projects'],tag+': subsequent click failed');
        assert.deepEqual(errors,[],tag+': runtime errors');
        console.log('PASS '+tag+': no interim selection; scroll and reclick restore');
      }finally{await page.close();}
    }
    // Reduced-motion navigation completes without smooth-scroll intent locking.
    const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
    try{
      await page.goto(new URL('index.html#projects',base).href);
      await page.locator('#primary-nav a[href="#contact"]').click();
      assert.deepEqual(await active(page),['#contact'],'Reduced-motion click should select Contact immediately');
      await page.evaluate(()=>document.getElementById('experiments').scrollIntoView({block:'center',behavior:'instant'}));
      await page.waitForTimeout(150);
      assert.deepEqual(await active(page),['#recognition'],'Reduced-motion manual scroll should reselect Expertise');
      console.log('PASS reduced-motion click and manual scroll');
    }finally{await page.close();}
  }finally{await browser.close();}
  console.log('PASS: 3 desktop widths x 2 languages x 2 origins plus reduced motion');
}finally{
  if(server){server.kill('SIGTERM');await new Promise(resolve=>setTimeout(resolve,130));}
}
