// Non-destructive work/version archive. Never delete or rename an MP4, image,
// online ImageKit resource, or original. Archived entries remain recoverable.
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const file=root=>path.join(root,'src/data/archive-state.json');
const empty=()=>({works:{},versions:{}});
const write=async(p,value)=>{
  const tmp=p+'.'+randomUUID()+'.tmp';
  try{await fs.writeFile(tmp,JSON.stringify(value,null,2)+'\n',{flag:'wx'});await fs.rename(tmp,p);}
  finally{await fs.rm(tmp,{force:true});}
};
export async function readArchive(root){
  try{
    const archive=JSON.parse(await fs.readFile(file(root),'utf8'));
    if(!archive||!archive.works||!archive.versions||Array.isArray(archive.works)||Array.isArray(archive.versions))
      throw fail('回收站索引损坏，请先恢复备份。',500);
    return archive;
  }catch(e){if(e.code==='ENOENT')return empty();throw e;}
}
export const archiveItems=archive=>({
  works:Object.entries(archive.works).map(([id,item])=>({id,...item})),
  versions:Object.entries(archive.versions).flatMap(([projectId,versions])=>
    Object.entries(versions).map(([variantId,item])=>({projectId,variantId,...item}))),
});
export async function updateArchive({projectRoot,workspace,scope,action,projectId,variantId,confirmed,confirmPhrase,projects,managed,featured}){
  if(confirmed!==true)throw fail('此操作需要明确确认。');
  if(!['work','version'].includes(scope)||!['archive','restore'].includes(action))throw fail('不支持的回收站操作。');
  if(!/^[0-9A-Za-z_-]{1,48}$/.test(String(projectId||'')))throw fail('作品编号格式无效。');
  if(scope==='version'&&!variantId)throw fail('请选择需要移入回收站的视频版本。');
  const current=await readArchive(projectRoot),next=structuredClone(current);
  if(action==='archive'&&scope==='work'){
    if(confirmPhrase!=='归档')throw fail('请输入「归档」以确认整部作品移入回收站。');
    const p=projects.find(x=>x.id===projectId);
    if(!p)throw fail('作品不存在或已归档。',404);
    if(featured.includes(projectId))throw fail('此作品位于首页精选，请先将其替换出精选，再移入回收站。',409);
    next.works[projectId]={at:new Date().toISOString(),title:p.title,titleEn:p.titleEn,category:p.category};
  }else if(action==='archive'){
    if(next.works[projectId])throw fail('请先恢复整部作品。',409);
    const p=projects.find(x=>x.id===projectId);
    const version=managed.find(x=>x.id===projectId)?.versions.find(x=>x.id===variantId);
    if(!p||!version)throw fail('视频版本不存在或已归档。',404);
    if(managed.find(x=>x.id===projectId).versions.length<=1)
      throw fail('作品至少需要保留一个视频版本。请归档整部作品，或先添加另一个版本。',409);
    next.versions[projectId]??={};
    next.versions[projectId][variantId]={at:new Date().toISOString(),title:p.title,label:version.label};
  }else if(scope==='work'){
    if(!next.works[projectId])throw fail('回收站中找不到该作品。',404);
    delete next.works[projectId];
  }else{
    if(!next.versions[projectId]?.[variantId])throw fail('回收站中找不到该视频版本。',404);
    if(next.works[projectId])throw fail('请先恢复整部作品，再恢复该视频版本。',409);
    delete next.versions[projectId][variantId];
    if(!Object.keys(next.versions[projectId]).length)delete next.versions[projectId];
  }
  const revDir=path.join(workspace,'project-revisions');await fs.mkdir(revDir,{recursive:true});
  await fs.writeFile(path.join(revDir,'archive-'+randomUUID()+'.json'),
    JSON.stringify({at:new Date().toISOString(),action,scope,projectId,variantId:variantId||null,previous:current,next},null,2)+'\n',{flag:'wx'});
  await write(file(projectRoot),next);
  return {scope,action,projectId,variantId:variantId||null,archived:archiveItems(next)};
}
