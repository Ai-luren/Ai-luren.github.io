/* Step 05: one accessible dialog boundary including shared navigation,
   consistent keyboard focus, Esc/close restoration and no background escape. */
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';

const browserPath=[
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
assert(browserPath,'Edge or Chrome required');
const port=5265;
const base=process.env.PORTFOLIO_URL||'http://127.0.0.1:'+port+'/';
const widths=[390,760,1024,1440];
let server;
async function ready(){
  for(let i=0;i<80;i++){
    try{if((await fetch(base,{signal:AbortSignal.timeout(1000)})).ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  throw Error('Vite not ready');
}
const checkDialog=async (page,selector,tag) => {
  const dialog=page.locator(selector);
  await dialog.waitFor();
  assert(await dialog.evaluate(el=>el.tagName==='DIALOG'?el.matches(':modal'):el.getAttribute('aria-modal')==='true'),tag+': modal semantics');
  const nav=dialog.locator('.cinema-player__navigation');
  assert.equal(await nav.count(),1,tag+': one navigation within dialog semantics');
  assert.equal(await dialog.locator('.cinema-player__language').count(),1,tag+': missing language control');
  assert.equal(await dialog.locator('.cinema-player__close').count(),1,tag+': missing shared close');
  assert(await dialog.locator('.cinema-player__close').evaluate(el=>el===document.activeElement),tag+': initial focus');
  for(let i=0;i<6;i++){
    await page.keyboard.press('Tab');
    assert(await page.evaluate(sel=>document.querySelector(sel)?.contains(document.activeElement),selector),tag+': focus escaped dialog');
  }
  return dialog;
};
try{
  if(!process.env.PORTFOLIO_URL){
    server=spawn(process.execPath,['./node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'});
    await ready();
  }
  const browser=await chromium.launch({headless:true,executablePath:browserPath});
  try {
    for(const width of widths)for(const lang of ['zh','en']){
      const page=await browser.newPage({viewport:{width,height:900}});
      const tag=width+'px '+lang;
      try{
        const errors=[];page.on('pageerror',err=>errors.push(err.message));
        await page.addInitScript(l=>localStorage.setItem('ailuren-lang',l),lang);
        await page.goto(new URL('index.html#impact-reach',base).href);
        const trigger=page.locator('#impact-reach [data-social-profile-trigger="douyin"]');
        await trigger.click();
        const social=await checkDialog(page,'.impact-profile-lightbox',tag+' account');
        assert.equal(await page.locator('[role="dialog"][aria-modal="true"]:visible').count(),1,tag+': duplicate accessible dialogs');
        assert.equal(await social.getAttribute('aria-labelledby'),'impact-profile-dialog-title');
        assert.equal(await social.locator('.impact-profile-dialog-image').count(),2,tag+': screenshot and QR together');
        for(let i=0;i<7;i++){
          if(await social.locator('.impact-profile-dialog-action').evaluate(el=>el===document.activeElement))break;
          await page.keyboard.press('Tab');
        }
        assert(await social.locator('.impact-profile-dialog-action').evaluate(el=>el===document.activeElement),tag+': Tab cannot reach QR save');
        const ring=await page.evaluate(()=>{
          const target=document.querySelector('.impact-profile-dialog-action');
          const s=getComputedStyle(target);
          return {color:s.outlineColor,width:s.outlineWidth,visible:target.matches(':focus-visible')};
        });
        assert.equal(ring.color,'rgb(41, 151, 255)',tag+': save QR should use shared focus blue');
        assert.equal(ring.width,'2px',tag+': missing 2px focus ring');
        await page.keyboard.press('Escape');
        await social.waitFor({state:'detached'});
        assert(await trigger.evaluate(el=>document.activeElement===el),tag+': profile focus not returned');
        assert.equal(await page.locator('main').evaluate(el=>el.inert),false,tag+': background remains inert');

        const awardTrigger=page.locator('#impact-awards .impact-award-card').first();
        await awardTrigger.click();
        const award=await checkDialog(page,'#impact-award-lightbox',tag+' awards');
        assert.equal(await award.getAttribute('role'),'dialog');
        await page.keyboard.press('Escape');
        await award.waitFor({state:'detached'});
        assert(await awardTrigger.evaluate(el=>el===document.activeElement),tag+': award focus not returned');

        const workTrigger=page.locator('#projects .comet-archive__card').first();
        await workTrigger.click();
        const cinema=await checkDialog(page,'.cinema-player[open]',tag+' cinema');
        assert.equal(await cinema.evaluate(el=>el.tagName),'DIALOG');
        await page.keyboard.press('Escape');
        await cinema.waitFor({state:'detached'});
        assert(await workTrigger.evaluate(el=>el===document.activeElement),tag+': work focus not returned');

        await page.goto(new URL('works.html',base).href);
        await page.locator('.library-page-navigation .cinema-player__navigation').waitFor();
        if(width<=1023){
          const menuTrigger=page.locator('.library-page-navigation .cinema-player__close');
          await menuTrigger.click();
          const menu=page.locator('.library-menu[open]');
          await menu.waitFor();
          assert.equal(await menu.locator('.cinema-player__navigation').count(),1,tag+': works menu navigation');
          assert.equal(await menu.locator('.shared-menu-links a').count(),4,tag+': works menu should have 4 entries');
          assert(await menu.locator('.cinema-player__close').evaluate(el=>el===document.activeElement),tag+': works menu focus');
          for(let i=0;i<6;i++){
            await page.keyboard.press('Tab');
            assert(await menu.evaluate(el=>el.contains(document.activeElement)),tag+': works menu leaked focus');
          }
          await page.keyboard.press('Escape');
          await menu.waitFor({state:'detached'});
          assert(await menuTrigger.evaluate(el=>el===document.activeElement),tag+': works menu focus restoration');
        }else{
          assert.equal(await page.locator('.library-page-navigation .site-primary-nav a').count(),4,tag+': desktop navigation count');
        }
        assert.deepEqual(errors,[],tag+': page errors');
        console.log('PASS '+tag+': account, awards, film and library navigation semantics/focus');
      }finally{await page.close();}
    }
  }finally{await browser.close();}
  console.log('PASS Step 05: 4 widths x 2 languages across unified navigation/dialog interactions');
}finally{
 if(server){server.kill('SIGTERM');await new Promise(resolve=>setTimeout(resolve,130));}
}
