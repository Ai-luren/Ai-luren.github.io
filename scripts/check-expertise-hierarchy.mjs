import { createSafePage, createSafeContext } from './lib/safe-media.mjs';
/* Responsive typography and rhythm of the Expertise group.
 * Measure rendered geometry in a real browser after disabling reveal motion.
 */
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';

const browserPath=['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
assert(browserPath,'Edge or Chrome is required');
const port=5253;
const base=process.env.PORTFOLIO_URL||'http://127.0.0.1:'+port+'/';
const widths=[320,360,390,430,720,760,761,820,1024,1280,1440,1920];
let server;
async function ready(){
  for(let i=0;i<90;i++){try{if((await fetch(base,{signal:AbortSignal.timeout(900)})).ok)return;}catch{}
    await new Promise(r=>setTimeout(r,140));}
  throw Error('Cannot reach website '+base);
}
try{
  if(!process.env.PORTFOLIO_URL){
    server=spawn(process.execPath,['./node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'});
    await ready();
  }
  const browser=await chromium.launch({headless:true,executablePath:browserPath});
  try{
    for(const lang of ['zh','en'])for(const width of widths){
      const page=await createSafePage(browser, {viewport:{width,height:900}});
      const tag=width+'px '+lang;
      try{
        const errors=[];
        page.on('pageerror',error=>errors.push(error.message));
        await page.addInitScript(value=>localStorage.setItem('ailuren-lang',value),lang);
        await page.goto(new URL('index.html#impact-reach',base).href,{waitUntil:'domcontentloaded'});
        await page.locator('#impact-reach .impact-glass').waitFor();
        await page.addStyleTag({content:'.reveal, .section-intro {transform:none!important;opacity:1!important;transition:none!important;animation:none!important}'});
        const result=await page.evaluate(()=>{
          const measure=selector=>{
            const el=document.querySelector(selector);
            if(!el)return null;
            const c=getComputedStyle(el),r=el.getBoundingClientRect();
            return {size:parseFloat(c.fontSize),x:r.left,top:r.top,bottom:r.bottom,visible:r.width>0&&r.height>0,overflow:el.scrollWidth>el.clientWidth+2};
          };
          const main=measure('#recognition .section-title');
          const project=measure('#projects .section-title');
          const award=measure('#impact-awards .impact-evidence-label h2');
          const creator=measure('#impact-programs .impact-evidence-label h2');
          const media=measure('#impact-reach .impact-evidence-label h2');
          const lab=measure('#experiments .section-title');
          const cardTitle=measure('#impact-programs .impact-platform-mobile-manifesto h3');
          const cards=[
            measure('#impact-awards .impact-glass'),
            measure('#impact-programs .impact-glass'),
            measure('#impact-reach .impact-glass'),
            measure('#experiments .flip-experiment'),
          ];
          const children=[award,creator,media,lab];
          return {main,project,children,cardTitle,cards,
            gapToFirst:award.top-main.bottom,
            gaps:children.map((title,i)=>cards[i].top-title.bottom),
            overflow:document.documentElement.scrollWidth-innerWidth};
        });
        assert(result.main&&result.project,tag+': missing main title');
        assert(Math.abs(result.main.size-result.project.size)<1,tag+': unequal top-level titles');
        assert(result.children.every(t=>t?.visible),tag+': missing child heading');
        const sub=result.children[0].size;
        assert(result.main.size>sub+2,tag+': primary title too small');
        assert(result.children.every(t=>Math.abs(t.size-sub)<.5),tag+': uneven subheadings');
        assert(result.children.every(t=>Math.abs(t.x-result.main.x)<=1.5),tag+': H2 left edges must align with Expertise: '+result.children.map(t=>t.x).join('/')+' vs '+result.main.x);
        assert(!result.children.some(t=>t.overflow),tag+': clipped child title');
        if(width<=760)assert(result.cardTitle.size<=sub-3,tag+': card H3 larger than H2');
        const target=width<=760?20:28;
        for(const [i,gap] of result.gaps.entries())assert(Math.abs(gap-target)<=1.25,tag+': gap '+i+'='+gap.toFixed(2)+' expected '+target);
        assert(result.overflow<=2,tag+': horizontal overflow');
        assert.deepEqual(errors,[],tag+': page errors');
        console.log('PASS '+tag+': main '+result.main.size+' > sub '+sub+(width<=760?' > card '+result.cardTitle.size:'')+'; gaps '+result.gaps.map(Math.round).join('/')+'px');
      }finally{await page.close();}
    }
  }finally{await browser.close();}
  console.log('PASS: Expertise hierarchy + equal heading-to-panel gaps (12 widths x 2 languages)');
}finally{
  if(server){server.kill('SIGTERM');await new Promise(r=>setTimeout(r,100));}
}
