// Read-only acceptance test against the ALREADY RUNNING local workbench.
// Isolated browser tests can pass while a stale 5190 process still serves old
// Node routes, so run this after every workbench source change/restart.
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {createSafePage,getSafeMediaReport} from './lib/safe-media.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const workbenchDir=path.join(root,'tools','cover-studio');
const base=new URL(process.env.WORKBENCH_URL || 'http://127.0.0.1:5190/');
assert(base.protocol==='http:' && base.hostname==='127.0.0.1',
  'Live workbench tests must only use local 127.0.0.1 (never an external server)');
const restartHint='请在本机重新启动工作台：关闭旧 npm run covers 进程，再运行 npm run covers。';
const get=async pathname=>{
  let response;
  try {response=await fetch(new URL(pathname,base),{signal:AbortSignal.timeout(9000)});}
  catch(error){throw new Error(`本地工作台无法连接 (${pathname})。${restartHint}`,{cause:error});}
  assert(response.ok,`工作台 ${pathname} 返回 HTTP ${response.status}。可能仍在运行旧服务。${restartHint}`);
  return response;
};

// A fresh frontend file with an old server-side static allowlist can return
// 404 and leave the whole library stuck at "正在读取作品库…".
const runtime=await (await get('/api/runtime-health')).json();
assert.equal(runtime.healthy,true,'工作台服务未就绪');
assert(Number.isFinite(runtime.startedAt),'服务未提供本次启动时间，请重启旧服务');
const trackedFiles=(await fs.readdir(workbenchDir)).filter(name=>/\.(?:mjs|js|css|html)$/.test(name));
const outdated=[];
for(const file of trackedFiles){
  const stat=await fs.stat(path.join(workbenchDir,file));
  if(stat.mtimeMs>runtime.startedAt+1000)outdated.push(file);
}
assert.equal(outdated.length,0,
  `工作台服务启动后更新过代码：${outdated.join('、')}。${restartHint}`);
for(const resource of ['/','/app.js','/library-ui.js','/imagekit-url.js',
  '/library-cover-editor.js','/library-player.js','/library-history.js',
  '/style.css','/workbench-enhancements.css'])await get(resource);
const data=await (await get('/api/bootstrap')).json();
assert(Array.isArray(data.projects)&&data.projects.length>0,'作品库接口返回空作品列表');
assert(data.ordering?.featured?.length===8,'作品库精选顺序未正确加载');
console.log('LIVE_SERVER_AND_MODULES_PASS',data.projects.length,'部作品');

const binary=['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
assert(binary,'需要本机安装 Edge 或 Chrome 才能验收工作台');
const browser=await chromium.launch({executablePath:binary,headless:true});
try{
  const page=await createSafePage(browser,{viewport:{width:1440,height:900}});
  const errors=[],failed=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{
    if(response.url().startsWith(base.origin)&&response.status()>=400)
      failed.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(base.href,{waitUntil:'domcontentloaded',timeout:12000});
  await page.waitForFunction(()=>{
    const overview=document.querySelector('#ux-overview')?.textContent||'';
    return document.querySelectorAll('#ux-gallery .ux-project').length>0 &&
      !overview.includes('正在读取');
  },null,{timeout:18000});
  const state=await page.evaluate(()=>({
    overview:document.querySelector('#ux-overview')?.textContent,
    status:document.querySelector('#status')?.textContent,
    cards:document.querySelectorAll('#ux-gallery .ux-project').length,
  }));
  assert.equal(state.cards,8,'首页精选列表未完整呈现');
  assert(!state.status?.includes('失败'),'工作台界面出现错误：'+state.status);
  await page.locator('#ux-gallery .ux-project-image').first().click();
  assert(await page.locator('#ux-editor').isVisible(),'点击作品未能打开详情');
  assert.equal(await page.locator('.ux-detail-tabs button').count(),2,
    '右侧应是「作品管理」和「封面与海报」两个入口');
  assert(await page.locator('.ux-name-section').isVisible(),
    '共享作品名称必须在作品管理面板中显示');
  assert(await page.locator('#ux-variant-chips').isVisible(),
    '视频版本必须在作品管理面板中显示');
  assert(await page.locator('#ux-open-imagekit').isVisible(),'ImageKit 快捷入口未加载');
  assert.equal(await page.locator('#ux-open-imagekit').getAttribute('href'),
    'https://imagekit.io/dashboard/media-library');
  await page.locator('#ux-url-readonly').click();
  assert(await page.locator('#ux-url-form').isVisible(),'ImageKit 地址编辑框打不开');
  // No save call: checking the real production workbench must never mutate data.
  await page.locator('#ux-url-cancel').click();
  assert.deepEqual(errors,[],'页面 JavaScript 出错');
  assert.deepEqual(failed,[],'本地页面有资源返回错误状态');
  assert.equal(getSafeMediaReport(page).urls.length,0,'禁止真实 ImageKit 请求');
  console.log('LIVE_BROWSER_READY',JSON.stringify(state),'0 JS errors, 0 HTTP errors, 0 ImageKit requests');
  await page.close();
}finally{await browser.close();}
console.log('WORKBENCH_LIVE_PASS — 运行中的真实工作台可正常打开、浏览与编辑地址');
