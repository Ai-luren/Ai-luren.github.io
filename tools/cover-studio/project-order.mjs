import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const ORDER_FILE='src/data/project-order.json';
const DEFAULT_FEATURED=['01','02','06','03','04','07','08','05'];
const FEATURED_COUNT=8;
const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((id,i)=>id===b[i]);
const validSelection=(ids,candidates,count)=>{
  const allowed=new Set(candidates);
  return Array.isArray(ids)&&ids.length===count&&new Set(ids).size===count&&
    ids.every(id=>typeof id==='string'&&allowed.has(id));
};
const normalizedAll=(all,available)=>{
  const valid=new Set(available);
  return [...new Set([...(Array.isArray(all)?all:[]),...available].filter(id=>valid.has(id)))];
};
async function getOrder(root){
  const data=JSON.parse(await fs.readFile(path.join(root,ORDER_FILE),'utf8'));
  if(!data||!Array.isArray(data.all)||!Array.isArray(data.featured))throw fail('作品排序配置文件格式错误。',500);
  return data;
}
function hydrated(raw,projects){
  const ids=projects.map(project=>project.id);
  if(!validSelection(raw.featured,ids,FEATURED_COUNT))throw fail('首页精选必须恰好包含 8 部有效且不重复的作品。',500);
  return {featured:[...raw.featured],all:normalizedAll(raw.all,ids)};
}
export async function describeProjectOrder({projectRoot,projects}){
  const saved=hydrated(await getOrder(projectRoot),projects);
  const ids=projects.map(project=>project.id);
  const defaults={featured:[...DEFAULT_FEATURED],
    all:[...ids].sort((a,b)=>Number(a)-Number(b)||a.localeCompare(b))};
  return {
    ...saved,defaults,
    projects:projects.map(project=>({
      id:project.id,title:project.title,titleEn:project.titleEn,category:project.category||'uncategorized',
      featured:saved.featured.includes(project.id),
    })),
  };
}
export async function saveProjectOrder({projectRoot,workspace,projects,scope,ids,expected,confirmed}){
  if(confirmed!==true)throw fail('请确认保存此作品顺序。');
  if(scope!=='featured'&&scope!=='all')throw fail('只能调整精选作品或全部作品。');
  const raw=await getOrder(projectRoot);
  const current=hydrated(raw,projects);
  const available=projects.map(p=>p.id);
  if(!Array.isArray(ids)||!Array.isArray(expected))throw fail('无效排序数据。');
  if(!same(current[scope],expected))throw fail('排序已经发生变化，请刷新列表后重试。',409);
  if(scope==='featured'&&!validSelection(ids,available,FEATURED_COUNT)){
    throw fail('精选必须恰好 8 部，每部作品只能选一次。');
  }
  if(scope==='all'&&!validSelection(ids,available,available.length)){
    throw fail('全部作品必须包含全部现有项目，不能缺失或重复。');
  }
  const next=scope==='featured'
    ?{featured:[...ids],all:[...current.all]}
    :{featured:[...current.featured],all:[...ids]};
  if(same(current.featured,next.featured)&&same(current.all,next.all))
    return {scope,ids:next[scope],featured:next.featured,all:next.all,changed:false};
  const id=randomUUID(),folder=path.join(workspace,'project-revisions');
  await fs.mkdir(folder,{recursive:true});
  await fs.writeFile(path.join(folder,`order-${scope}-${id}.json`),
    JSON.stringify({at:new Date().toISOString(),action:'reorder',scope,previous:raw,next},null,2)+'\n',{flag:'wx'});
  const file=path.join(projectRoot,ORDER_FILE),tmp=`${file}.${id}.tmp`;
  try{
    await fs.writeFile(tmp,JSON.stringify(next,null,2)+'\n',{flag:'wx'});
    await fs.rename(tmp,file);
  }finally{await fs.rm(tmp,{force:true});}
  return {scope,ids:next[scope],featured:next.featured,all:next.all,changed:true};
}
