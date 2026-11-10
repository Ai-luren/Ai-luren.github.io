import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {createSafePage,getSafeMediaReport} from './lib/safe-media.mjs';
import {createCoverStudio} from '../tools/cover-studio/server.mjs';
const root=path.resolve(import.meta.dirname,'..');
const fixture=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-unified-one-save-'));
for(const name of ['src','assets/images','index.html','works.html'])
 await fs.cp(path.join(root,name),path.join(fixture,name),{recursive:true});
await fs.symlink(path.join(root,'node_modules'),path.join(fixture,'node_modules'));
await fs.writeFile(path.join(fixture,'package.json'),'{"type":"module"}\n');
const data=async name=>JSON.parse(await fs.readFile(path.join(fixture,'src/data',name+'.json'),'utf8'));
const works=await data('auto-projects');
const mexc=works.find(p=>p.id==='16'),B=mexc.variants[0];
for(const rel of [mexc.localVideoPath,B.localVideoPath]){
 const file=path.join(fixture,'assets/videos/works',rel);
 await fs.mkdir(path.dirname(file),{recursive:true});
 execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=s=1282x720:d=2:r=12',
   '-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-movflags','+faststart','-y',file],{timeout:60000});
}
const meta=(await data('project-video-metadata'))['16'];
const covers=await data('project-cover-overrides');
const cover=path.join(fixture,'assets/images/project-covers',covers['16']);
const mainPoster=path.join(fixture,'assets/images/player-posters',meta.playerPoster);
const variantPoster=path.join(fixture,'assets/images/player-posters',B.posterFile);
const hash=async file=>createHash('sha256').update(await fs.readFile(file)).digest('hex');
const initial={cover:await hash(cover),main:await hash(mainPoster),B:await hash(variantPoster)};
let studio,browser;
try{
 studio=await createCoverStudio({projectRoot:fixture,port:5260});
 browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
 const page=await createSafePage(browser,{viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.goto(studio.url);
 await page.waitForFunction(()=>document.querySelectorAll('#ux-gallery .ux-project').length===8);
 await page.locator('#ux-categories [data-filter="commercial"]').click();
 await page.locator('#ux-gallery .ux-project[data-id="16"] .ux-project-image img').click();
 const titleBefore={zh:await page.locator('#ux-title-zh').inputValue(),en:await page.locator('#ux-title-en').inputValue()};
 await page.locator('#ux-variant-chips .ux-variant-edit').nth(0).click();
 assert(await page.locator('#ux-version-label-form').isVisible());
 await page.locator('#ux-version-label-zh').fill('会员权益 A 测试名');
 await page.locator('#ux-version-label-en').fill('Member Perks A Test Name');
 await page.locator('#ux-version-label-form').evaluate(form=>form.requestSubmit());
 await page.waitForFunction(()=>document.querySelector('#ux-variant-chips .ux-variant')?.textContent==='会员权益 A 测试名'
  &&document.querySelector('#ux-context-version')?.textContent==='会员权益 A 测试名');
 assert.equal(await page.locator('#ux-version-label').textContent().then(text=>text.includes('会员权益 A 测试名')),true);
 assert.deepEqual({zh:await page.locator('#ux-title-zh').inputValue(),en:await page.locator('#ux-title-en').inputValue()},titleBefore);
 assert.equal((await data('auto-projects')).find(p=>p.id==='16').mainVersionLabel.en,'Member Perks A Test Name');
 await page.locator('#ux-add-variant').click();
 assert(await page.locator('#ux-version-form').isVisible());
 assert.equal(await page.locator('#ux-version-en').inputValue(),'Version C');
 await page.locator('#ux-version-cancel').click();
 await page.locator('#ux-variant-chips .ux-variant').nth(1).click();
 await page.locator('[data-ux-panel=artwork]').click();
 await page.locator('#ux-change-poster').click();
 assert.equal(await page.locator('body').getAttribute('data-workflow'),'library');
 assert(await page.locator('#ux-inline-cover').isVisible());
 assert.equal(await page.locator('#ux-inline-cover').getAttribute('data-kind'),'poster');
 await page.waitForFunction(()=>!document.querySelector('#ux-inline-save').disabled,null,{timeout:30000});
 await page.locator('#ux-inline-first').click();
 await page.waitForFunction(()=>document.querySelector('#ux-inline-title').textContent.includes('已选中')
  && document.querySelector('#ux-inline-original').naturalWidth>0,null,{timeout:60000});
 const aspect=await page.locator('#ux-inline-original').evaluate(async img=>{await img.decode();return img.naturalWidth/img.naturalHeight});
 assert(Math.abs(aspect-1282/720)<.02);
 await page.locator('#ux-inline-save').click();
 await page.waitForFunction(()=>document.querySelector('#ux-inline-cover').hidden,null,{timeout:60000});
 assert(await page.locator('#ux-editor').isVisible());
 assert.equal(await page.locator('#ux-editor-title').textContent(),'MEXC 会员权益');
 assert.equal(await page.locator('#ux-variant-chips .ux-variant').nth(1).getAttribute('aria-pressed'),'true');
 assert.equal(await hash(cover),initial.cover);
 assert.equal(await hash(mainPoster),initial.main);
 assert.notEqual(await hash(variantPoster),initial.B);
 assert((await fs.readdir(path.join(fixture,'.cover-studio/project-revisions/poster-history/16')))
   .some(file=>file.endsWith('.json')));
 console.log('ONE_SAVE_VARIANT_B_POSTER_PASS');

 await page.locator('#ux-change-cover').click();
 assert.equal(await page.locator('body').getAttribute('data-workflow'),'library');
 assert.equal(await page.locator('#ux-inline-cover').getAttribute('data-kind'),'cover');
 await page.waitForFunction(()=>!document.querySelector('#ux-inline-save').disabled,null,{timeout:30000});
 await page.locator('#ux-inline-last').click();
 await page.waitForFunction(()=>!document.querySelector('#ux-inline-save').disabled,null,{timeout:60000});
 assert.equal(await page.locator('[data-ux-fit="contain"]').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#ux-inline-old').evaluate(img=>getComputedStyle(img).objectFit),'contain');
 assert.equal(await page.locator('#ux-inline-frames').count(),0);
 await page.screenshot({path:'/tmp/workbench-full-preview-desktop.png',fullPage:false});
 const preview=await page.locator('#ux-inline-canvas').evaluate(x=>[x.width,x.height]);
 assert.deepEqual(preview,[900,1200]);
 await page.locator('#ux-inline-save').click();
 await page.waitForFunction(()=>document.querySelector('#ux-inline-cover').hidden,null,{timeout:60000});
 assert.notEqual(await hash(cover),initial.cover);
 assert.equal(await hash(mainPoster),initial.main);
 assert.notEqual(await hash(variantPoster),initial.B);
 assert((await fs.readdir(path.join(fixture,'.cover-studio/project-revisions/cover-history/16')))
   .some(file=>file.endsWith('.json')));
 assert.deepEqual(errors,[]);
 assert.equal(getSafeMediaReport(page).urls.length,0);
 console.log('ONE_SAVE_3_BY_4_FROM_CURRENT_VERSION_PASS');
 console.log('ALL_QUICK_SAVE_TESTS_PASS isolated',fixture);
}finally{if(browser)await browser.close();if(studio)await studio.close();}
