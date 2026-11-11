// Verifies save/keep/discard in a temporary copy, never on actual portfolio data.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createCoverStudio} from '../../../portfolio-workbench/server.mjs';
import {createSafePage,getSafeMediaReport} from '../../lib/safe-media.mjs';

const root=path.resolve(import.meta.dirname,'../../..');
const fixture=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-ux-draft-'));
for(const rel of ['src','assets/images','index.html','works.html'])await fs.cp(path.join(root,rel),path.join(fixture,rel),{recursive:true});
const data=(name)=>path.join(fixture,'src/data',name);
await fs.symlink(path.join(root,'node_modules'),path.join(fixture,'node_modules'));
await fs.writeFile(path.join(fixture,'package.json'),'{"type":"module"}\n');
const videoMap=JSON.parse(await fs.readFile(data('local-video-paths.json'),'utf8'));
const video=path.join(fixture,'assets/videos/works',videoMap['06']);
await fs.mkdir(path.dirname(video),{recursive:true});
await fs.copyFile(path.join(root,'scripts/fixtures/test-landscape.mp4'),video);
const originalOfficial=await fs.readFile(path.join(root,'src/data/project-title-overrides.json'),'utf8');
let studio,browser;
try{
 studio=await createCoverStudio({projectRoot:fixture,port:5298});
 browser=await chromium.launch({executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless:true});
 const p=await createSafePage(browser,{viewport:{width:1440,height:900}});
 const errs=[];p.on('pageerror',e=>errs.push(e.stack));
 await p.goto(studio.url);
 await p.waitForFunction(()=>document.querySelectorAll('.ux-project').length===8);
 await p.locator('#ux-search').fill('岳阳楼');
 await p.locator('.ux-project .ux-project-image').click();
 const initial=await p.locator('#ux-title-zh').inputValue();
 const changed=initial+'（临时审查）';
 await p.locator('#ux-title-zh').fill(changed);
 await p.locator('#ux-close-editor').click();
 assert(await p.locator('#ux-unsaved-dialog').isVisible());
 assert(await p.locator('#ux-unsaved-save').isVisible());
 await p.locator('#ux-unsaved-keep').click();
 assert.equal(await p.locator('#ux-title-zh').inputValue(),changed);
 await p.locator('#ux-close-editor').click();
 await p.locator('#ux-unsaved-discard').click();
 assert(await p.locator('#ux-editor').isHidden());
 assert.equal((await fs.readFile(data('project-title-overrides.json'),'utf8')).includes('临时审查'),false);
 console.log('KEEP_EDITING_AND_DISCARD_NOT_WRITING_PASS');
 await p.locator('.ux-project .ux-project-image').click();
 await p.locator('#ux-title-zh').fill(changed);
 await p.locator('#ux-close-editor').click();
 await p.locator('#ux-unsaved-save').click();
 await p.waitForFunction(()=>document.querySelector('#ux-editor').hidden,null,{timeout:30000});
 assert((await fs.readFile(data('project-title-overrides.json'),'utf8')).includes('临时审查'));
 await p.waitForFunction(()=>document.querySelector('#ux-title-zh').value.includes('临时审查'));
 console.log('SAVE_TITLE_AND_CLOSE_PASS');

 await p.locator('#ux-search').fill('MEXC 会员权益');
 await p.locator('.ux-project .ux-project-image').first().click();
 await p.locator('#ux-url-readonly').click();
 assert(await p.locator('#ux-url-form').isVisible());
 await p.locator('#ux-url-value').fill('https://ik.imagekit.io/Ailuren/tr:orig-true/videos/temp-review-file.mp4');
 await p.locator('#ux-close-editor').click();
 assert(await p.locator('#ux-unsaved-save').isVisible());
 await p.locator('#ux-unsaved-save').click();
 await p.waitForFunction(()=>document.querySelector('#ux-editor').hidden,null,{timeout:30000});
 assert((await fs.readFile(data('auto-projects.json'),'utf8')).includes('temp-review-file.mp4'));
 console.log('SAVE_IMAGEKIT_ADDRESS_AND_CLOSE_PASS');

 await p.locator('.ux-project .ux-project-image').first().click();
 await p.locator('#ux-add-variant').click();
 assert(await p.locator('#ux-version-form').isVisible());
 await p.locator('#ux-version-file').setInputFiles(path.join(root,'scripts/fixtures/test-landscape.mp4'));
 await p.locator('#ux-close-editor').click();
 assert(await p.locator('#ux-unsaved-dialog').isVisible());
 assert(await p.locator('#ux-unsaved-save').isHidden());
 await p.locator('#ux-unsaved-discard').click();
 assert(await p.locator('#ux-editor').isHidden());
 assert.equal((await fs.readFile(data('auto-projects.json'),'utf8')).includes('Version C'),false);
 console.log('UNSAVED_MP4_GUARD_WITHOUT_FAKE_SAVE_PASS');

 assert.equal(getSafeMediaReport(p).urls.length,0);
 assert.deepEqual(errs,[]);
 await p.close();
 assert.equal(await fs.readFile(path.join(root,'src/data/project-title-overrides.json'),'utf8'),originalOfficial);
 console.log('DRAFT_GUARD_ALL_PASS',fixture);
}finally{
 if(browser)await browser.close();
 if(studio)await studio.close();
}
