/**
 * Step 02 material QA: computed materials in normal, reduced transparency
 * and simulated unsupported backdrop-filter conditions.
 * Unsupported uses real @supports fallback declarations; NOT Safari certification.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const browserPath=[
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].find(existsSync);
assert(browserPath,'Chrome or Edge required');
const port=5241;
const base=process.env.PORTFOLIO_URL||'http://127.0.0.1:'+port+'/';
const widths=[360,390,760,1024,1440];
const selectors=[
  '#impact-awards .impact-glass',
  '#impact-programs .impact-glass',
  '#impact-reach .impact-glass',
  '#experiments .flip-experiment',
  '#profile .closing-card',
];
const expected={
  normal:{chrome:'rgba(28, 28, 30, 0.72)',glass:'rgba(26, 27, 31, 0.82)',
    scrim:'rgba(12, 12, 13, 0.9)',chromeBlur:'blur(22px) saturate(1.08)',glassBlur:'blur(22px) saturate(1.04)',scrimBlur:'blur(28px) saturate(1.02)'},
  fallback:{chrome:'rgb(28, 28, 30)',glass:'rgb(28, 28, 30)',
    scrim:'rgb(12, 12, 13)',chromeBlur:'none',glassBlur:'none',scrimBlur:'none'},
};
async function awaitServer(){
  for(let i=0;i<90;i++){
    try{if((await fetch(base,{signal:AbortSignal.timeout(900)})).ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  throw Error('Vite server failed to start');
}
let server;
try {
  if(!process.env.PORTFOLIO_URL){
    server=spawn(process.execPath,['./node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'});
    await awaitServer();
  }
  const browser=await chromium.launch({headless:true,executablePath:browserPath});
  try {
    for(const width of widths)for(const lang of ['zh','en'])for(const mode of ['normal','reduced','unsupported']){
      const page=await browser.newPage({viewport:{width,height:900}});
      try{
        const errors=[];
        page.on('pageerror',error=>errors.push(error.message));
        await page.addInitScript(value=>localStorage.setItem('ailuren-lang',value),lang);
        if(mode==='reduced'){
          const cdp=await page.context().newCDPSession(page);
          await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});
        }
        await page.goto(new URL('index.html#impact-reach',base).href);
        await page.locator('#impact-reach .impact-glass').waitFor();
        if(mode==='unsupported'){
          const replaced=await page.evaluate(()=>{
            let count=0;
            for(const sheet of document.styleSheets){
              let rules;
              try{rules=sheet.cssRules;}catch{continue;}
              for(let i=0;i<rules.length;i++){
                const rule=rules[i];
                if(rule.type!==CSSRule.SUPPORTS_RULE||!rule.conditionText.includes('backdrop-filter'))continue;
                const condition=rule.conditionText.replaceAll('backdrop-filter','unsupported-backdrop-filter');
                if(!CSS.supports(condition))throw Error('Fallback condition did not activate');
                const replacement=rule.cssText.replace(rule.conditionText,condition);
                sheet.deleteRule(i);
                sheet.insertRule(replacement,i);
                count++;
              }
            }
            return count;
          });
          assert(replaced>0,'No unsupported-filter fallback rules were activated');
        }
        const evidence=await page.evaluate(selectors=>{
          function material(selector,pseudo=null){
            const el=document.querySelector(selector);
            if(!el)return null;
            const style=getComputedStyle(el,pseudo);
            const box=el.getBoundingClientRect();
            return {background:style.backgroundColor,
              blur:style.backdropFilter||style.webkitBackdropFilter,
              border:style.borderTopColor,radius:style.borderTopLeftRadius,
              visible:box.width>0&&box.height>0};
          }
          const fields=Object.fromEntries(selectors.map(selector=>[selector,material(selector)]));
          return {
            fields,chrome:material('body > header'),
            mobile:material('#projects .comet-archive-mobile-shell'),
            hero:material('#top .hero-proof-card'),
            pageOverflow:document.documentElement.scrollWidth-innerWidth,
          };
        },selectors);
        const name=width+'px '+lang+' '+mode,exp=expected[mode==='normal'?'normal':'fallback'];
        assert(evidence.pageOverflow<=2,name+': viewport overflow');
        for(const [selector,panel] of Object.entries(evidence.fields)){
          assert(panel&&panel.visible,name+': missing '+selector);
          assert.equal(panel.background,exp.glass,name+': glass color '+selector);
          assert.equal(panel.blur,exp.glassBlur,name+': glass blur '+selector);
          assert.equal(panel.radius,'24px',name+': panel radius '+selector);
        }
        for(const panel of [evidence.hero,evidence.mobile]){
          if(!panel?.visible)continue;
          assert.equal(panel.background,exp.glass,name+': hero / mobile archive glass');
          assert.equal(panel.blur,exp.glassBlur,name+': hero / mobile archive blur');
        }
        assert.equal(evidence.chrome.background,exp.chrome,name+': chrome surface');
        assert.equal(evidence.chrome.blur,exp.chromeBlur,name+': chrome blur');

        await page.locator('#impact-reach .impact-reach-action').first().click();
        await page.locator('.impact-profile-lightbox').waitFor();
        const modal=await page.locator('.impact-profile-lightbox').evaluate(element=>{
          const style=getComputedStyle(element,'::before');
          return {surface:style.backgroundColor,blur:style.backdropFilter||style.webkitBackdropFilter};
        });
        assert.equal(modal.surface,exp.scrim,name+': scrim surface');
        assert.equal(modal.blur,exp.scrimBlur,name+': scrim blur');
        assert.equal(await page.locator('.impact-profile-lightbox > .cinema-player__navigation').count(),1,name+': shared navigation');
        await page.keyboard.press('Escape');
        await page.locator('.impact-profile-lightbox').waitFor({state:'detached'});
        assert.deepEqual(errors,[],name+': runtime errors');
        console.log('PASS '+name+': 5 glass panels, chrome, QR viewer and fallback');
      }finally{await page.close()}
    }
  }finally{await browser.close()}
  console.log('PASS: material roles across 5 widths × 2 languages × 3 modes');
}finally{
  if(server){server.kill('SIGTERM');await new Promise(resolve=>setTimeout(resolve,150));}
}
