import { createSafePage, createSafeContext } from '../../lib/safe-media.mjs';
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
  normal:{chrome:'rgba(28, 28, 30, 0.96)',glass:'rgba(26, 27, 31, 0.82)',
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
      const page=await createSafePage(browser, {viewport:{width,height:900}});
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
        // Dynamic sections can mount before native hash restoration. Material
        // comparisons need the settled Expertise nav surface, not Hero chrome.
        await page.locator('#impact-reach').scrollIntoViewIfNeeded();
        await page.waitForFunction(()=>{
          const node=document.querySelector('#impact-reach');
          const r=node?.getBoundingClientRect();
          return r && r.top<innerHeight && r.bottom>0 &&
            !document.body.classList.contains('is-on-hero');
        },null,{timeout:7000});
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
        // Background-color has a 220ms transition on A+ cards. Rewriting an
        // @supports condition is a dynamic style change; sample its settled
        // material rather than the earlier rgba transition frame.
        if (mode === 'unsupported') await page.waitForTimeout(320);
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
            mobile:material('#projects .portfolio-work-card--unified'),
            hero:material('#top .hero-proof-card'),
            // Branding now belongs to the closing card itself. It is
            // noninteractive and no separate footer bar/copyright remains.
            footerPlacement:(()=>{
              const card=document.querySelector('#profile .closing-card');
              const footer=document.querySelector('.closing-footer');
              if(!card||!footer)return null;
              const style=getComputedStyle(footer);
              const brand=card.querySelector('.closing-footer');
              const brandDisplay=brand ? getComputedStyle(brand).display : 'missing';
              const logo=card.querySelector('.closing-footer .footer-avatar')?.getBoundingClientRect();
              const social=card.querySelector('.floating-dock-item')?.getBoundingClientRect();
              const socialButtons=[...card.querySelectorAll('.closing-social .floating-dock-item')];
              return {
                brandDisplay,
                mobileDockOneRow:socialButtons.length===6 &&
                  Math.max(...socialButtons.map(x=>x.getBoundingClientRect().top))-
                  Math.min(...socialButtons.map(x=>x.getBoundingClientRect().top))<2,
                circleGeometry:brandDisplay!=='none'&&logo&&social ? {
                  logoDiameter:logo.width, socialDiameter:social.width,
                  logoHeight:logo.height, socialHeight:social.height,
                  centerDelta:(logo.top+logo.height/2)-(social.top+social.height/2),
                } : null,
                insideCard:card.contains(footer),
                outerFooterCount:document.querySelectorAll('body > footer').length,
                brandInsideCard:!!card.querySelector('.footer-brand:not(a)'),
                noCopyright:!card.querySelector('.footer-bottom-copy'),
                brandNotClickable:!card.querySelector('.footer-brand[href]'),
                socialDockInsideCard:!!card.querySelector('#footer-dock-react-root'),
                isolation:style.isolation,
                zIndex:style.zIndex,
                pseudoDisplay:getComputedStyle(footer,'::before').display,
                background:style.backgroundColor,
              };
            })(),
            pageOverflow:document.documentElement.scrollWidth-innerWidth,
          };
        },selectors);
        const name=width+'px '+lang+' '+mode,exp=expected[mode==='normal'?'normal':'fallback'];
        assert(evidence.pageOverflow<=2,name+': viewport overflow');
        const placement=evidence.footerPlacement;
        assert(placement,name+': missing closing footer inside card');
        assert.equal(placement.insideCard,true,name+': closing footer must be INSIDE the contact glass card');
        assert.equal(placement.outerFooterCount,0,name+': avoid a detached footer below the card');
        assert(placement.brandInsideCard&&placement.noCopyright&&placement.brandNotClickable&&placement.socialDockInsideCard,
          name+': brand and dock share the card, with no navigation or redundant copyright');
        assert.equal(placement.isolation,'auto',name+': footer must not isolate a transparent compositing layer');
        assert.equal(placement.zIndex,'auto',name+': footer must not create a positive stacking layer');
        assert.equal(placement.pseudoDisplay,'none',name+': remove transparent footer pseudo');
        assert.equal(placement.background,'rgba(0, 0, 0, 0)',name+': footer remains transparent inside card');
        assert(placement.mobileDockOneRow,name+': social dock icons should share one row');
        const circles=placement.circleGeometry;
        if(width<=760){
          assert.equal(placement.brandDisplay,'none',name+': repeated creator brand must be hidden on phones');
          assert.equal(circles,null,name+': hidden mobile creator logo should not occupy space');
        }else{
          assert.equal(placement.brandDisplay,'flex',name+': desktop creator brand must remain');
          assert(circles,name+': desktop brand and dock controls need measurable circles');
          assert(Math.abs(circles.logoDiameter-circles.socialDiameter)<=1,
            name+': desktop logo and social button widths differ');
          assert(Math.abs(circles.logoHeight-circles.socialHeight)<=1,
            name+': desktop logo and social button heights differ');
          assert(Math.abs(circles.centerDelta)<=2,
            name+': desktop logo and social icons are not vertically aligned');
        }
        for(const [selector,panel] of Object.entries(evidence.fields)){
          assert(panel&&panel.visible,name+': missing '+selector);
          assert.equal(panel.background,exp.glass,name+': glass color '+selector);
          assert.equal(panel.blur,exp.glassBlur,name+': glass blur '+selector);
          assert.equal(panel.radius,'24px',name+': panel radius '+selector);
        }
        for(const panel of [evidence.hero,evidence.mobile]){
          if(!panel?.visible)continue;
          assert.equal(panel.background,exp.glass,name+': Hero and individual Featured card glass');
          assert.equal(panel.blur,exp.glassBlur,name+': Hero and individual Featured card blur');
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
