// Version order is display-only. Never reorder physical MP4 files, rename
// variants, or switch the immutable "main" identity when sorting tabs.
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {orderVideoVersions} from '../../src/data/version-order.js';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const relative='src/data/project-version-order.json';
const eq=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((x,i)=>x===b[i]);

export async function readVersionOrders(root) {
  try {
    const data=JSON.parse(await fs.readFile(path.join(root,relative),'utf8'));
    if (!data || Array.isArray(data) || typeof data!=='object') throw fail('版本排序配置格式错误。',500);
    return data;
  } catch(error) {
    if(error.code==='ENOENT')return {};
    throw error;
  }
}

export async function saveVersionOrder({projectRoot,workspace,projectId,ids,expected,confirmed,projects,managed}){
  if(confirmed!==true)throw fail('请确认保存版本顺序。');
  if(!projects.some(project=>project.id===projectId))throw fail('作品不存在。',404);
  const work=managed.find(project=>project.id===projectId);
  if(!work)throw fail('找不到可管理的视频版本。',404);
  const available=work.versions.map(version=>version.id);
  if(available.length<2)throw fail('此作品没有可调整的多个版本。',422);
  const valid=order=>Array.isArray(order)&&order.length===available.length&&new Set(order).size===order.length&&
    order.every(id=>typeof id==='string'&&available.includes(id));
  if(!valid(ids)||!valid(expected))throw fail('排序必须包含当前作品的全部有效版本，不可重复或丢失。',422);
  const file=path.join(projectRoot,relative);
  const map=await readVersionOrders(projectRoot);
  const current=orderVideoVersions(work.versions,map[projectId]).map(version=>version.id);
  if(!eq(current,expected))throw fail('视频版本顺序已被其他操作修改，请刷新后重试。',409);
  if(eq(current,ids))return {projectId,ids:current,changed:false};
  const next={...map,[projectId]:[...ids]};
  const revisionId=randomUUID();
  const backup=path.join(workspace,'project-revisions',`version-order-${projectId}-${revisionId}.json`);
  await fs.mkdir(path.dirname(backup),{recursive:true});
  await fs.writeFile(backup,JSON.stringify({at:new Date().toISOString(),action:'reorder-version-tabs',projectId,previous:current,next:ids},null,2)+'\n',{flag:'wx'});
  const temp=file+'.'+revisionId+'.tmp';
  try{
    await fs.writeFile(temp,JSON.stringify(next,null,2)+'\n',{flag:'wx'});
    await fs.rename(temp,file);
  }finally{await fs.rm(temp,{force:true});}
  return {projectId,ids:[...ids],changed:true};
}
