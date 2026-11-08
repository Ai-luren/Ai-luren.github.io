import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {currentPoster} from './project-poster.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const uuid=id=>/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(String(id||''));
const validProject=id=>/^[a-zA-Z0-9_-]{1,40}$/.test(String(id||''));
const json=x=>JSON.stringify(x,null,2)+'\n';
const fingerprint=async file=>createHash('sha256').update(await fs.readFile(file)).digest('hex');

async function regularWebp(file){
  const stat=await fs.lstat(file);
  if(!stat.isFile()||stat.size<12||stat.size>25*1024*1024||await fs.realpath(file)!==file)
    throw fail('历史图像不存在或已被修改，请检查本地备份。',422);
  const header=Buffer.alloc(12);
  const f=await fs.open(file,'r');
  try {await f.read(header,0,12,0);}finally{await f.close();}
  if(header.toString('ascii',0,4)!=='RIFF'||header.toString('ascii',8,12)!=='WEBP')
    throw fail('历史封面不是有效的 WebP 图片。',422);
}
const baseDir=(workspace,kind,id)=>path.join(workspace,'project-revisions',
  kind==='cover'?'cover-history':'poster-history',id);
const backupFile=(base,kind,revision,variant)=>
  path.join(base,kind==='cover'?revision+'-previous.webp':
    revision+'-'+variant+'-previous.webp');

async function safeCurrent({root,projects,kind,projectId,variantId}){
  if(!validProject(projectId)||!['cover','poster'].includes(kind))throw fail('历史封面参数无效。',422);
  const project=projects.find(p=>p.id===projectId);
  if(!project)throw fail('作品不存在。',404);
  if(kind==='poster'){
    const result=await currentPoster({root,projects,projectId,variantId});
    await regularWebp(result.file);
    return {...result,expectedRatio:result.version.width/result.version.height};
  }
  if(variantId!=='main')throw fail('作品卡片的 3:4 封面与视频版本无关。',422);
  const source=String(project.cover||'').split('?')[0];
  if(!source.startsWith('/assets/images/project-covers/'))throw fail('项目卡片封面路径异常。',422);
  const rootDir=path.join(root,'assets/images/project-covers');
  const file=path.resolve(root,'.'+decodeURIComponent(source));
  if(!file.startsWith(rootDir+path.sep))throw fail('不允许访问作品封面目录外的文件。',422);
  if(!['.webp'].includes(path.extname(file)))throw fail('作品封面必须是 WebP。',422);
  await regularWebp(file);
  return {file,project,expectedRatio:3/4};
}

async function historyEntries({workspace,kind,projectId,variantId}){
  const directory=baseDir(workspace,kind,projectId);
  let files;
  try{files=await fs.readdir(directory);}
  catch(e){if(e.code==='ENOENT')return [];throw e;}
  const entries=[];
  for(const file of files){
    const revision=file.endsWith('.json')?file.slice(0,-5):'';
    if(!uuid(revision))continue;
    let record;
    try{record=JSON.parse(await fs.readFile(path.join(directory,file),'utf8'));}
    catch{continue;}
    if(record.projectId!==projectId)continue;
    if(kind==='poster'){
      if(!['replace-player-poster','restore-player-poster'].includes(record.action)||
         (record.variantId||'main')!==variantId)continue;
    }else if(!['replace-card-cover','restore-card-cover'].includes(record.action))continue;
    const backup=backupFile(directory,kind,revision,variantId);
    try{await regularWebp(backup);}catch{continue;}
    const dt=Date.parse(record.at);
    const at=Number.isFinite(dt)?new Date(dt).toISOString():null;
    entries.push({
      id:revision,at,action:record.action,
      source:record.action.startsWith('restore')?'恢复前':'更换前',
      time:kind==='poster'?(record.previousTime??null):null,
      imageUrl:'/artwork-history-image/'+kind+'/'+encodeURIComponent(projectId)+'/'+revision+
        (kind==='poster'?'?variant='+encodeURIComponent(variantId):''),
      backup,
      record,
    });
  }
  entries.sort((a,b)=>String(b.at||'').localeCompare(String(a.at||''))||b.id.localeCompare(a.id));
  return entries;
}

// Cap stored WebP snapshots and their JSON records independently for each
// artwork stream: 3:4 card cover, or an individual video variant's poster.
export const HISTORY_LIMIT=3;
export async function pruneArtworkHistory({workspace,kind,projectId,variantId='main',limit=HISTORY_LIMIT}){
  if(!['cover','poster'].includes(kind)||!validProject(projectId))throw fail('历史清理范围无效。',422);
  const entries=await historyEntries({workspace,kind,projectId,variantId});
  const base=baseDir(workspace,kind,projectId);
  const removed=[];
  for(const old of entries.slice(limit)){
    // Delete the backup first; the JSON never points to a file removed
    // from the history UI. Only known revision-matched pairs can be deleted.
    await fs.rm(old.backup,{force:true});
    await fs.rm(path.join(base,old.id+'.json'),{force:true});
    removed.push(old.id);
  }
  return {kept:Math.min(entries.length,limit),removed};
}
export async function pruneAllArtworkHistory({workspace}){
  let count=0;
  for(const kind of ['cover','poster']){
    const top=path.join(workspace,'project-revisions',
      kind==='cover'?'cover-history':'poster-history');
    let projects=[];
    try{projects=await fs.readdir(top,{withFileTypes:true});}
    catch(e){if(e.code==='ENOENT')continue;throw e;}
    for(const entry of projects){
      if(!entry.isDirectory()||!validProject(entry.name))continue;
      const projectId=entry.name;
      const variants=new Set(kind==='cover'?['main']:[]);
      if(kind==='poster'){
        const files=await fs.readdir(path.join(top,projectId));
        for(const name of files){
          if(!uuid(name.endsWith('.json')?name.slice(0,-5):''))continue;
          try{
            const record=JSON.parse(await fs.readFile(path.join(top,projectId,name),'utf8'));
            if(record.projectId===projectId&&['replace-player-poster','restore-player-poster'].includes(record.action))
              variants.add(record.variantId||'main');
          }catch{}
        }
      }
      for(const variantId of variants){
        const result=await pruneArtworkHistory({workspace,kind,projectId,variantId});
        count+=result.removed.length;
      }
    }
  }
  return count;
}
export async function listArtworkHistory({root,workspace,projects,kind,projectId,variantId='main'}){
  const active=await safeCurrent({root,projects,kind,projectId,variantId});
  await pruneArtworkHistory({workspace,kind,projectId,variantId});
  const items=await historyEntries({workspace,kind,projectId,variantId});
  const currentHash=await fingerprint(active.file);
  return {
    kind,projectId,variantId,currentHash,currentAspectRatio:active.expectedRatio,
    currentUrl:kind==='cover'?'/project-cover/'+encodeURIComponent(projectId):
      '/project-poster/'+encodeURIComponent(projectId)+'/'+encodeURIComponent(variantId),
    entries:items.map(({backup,record,...item})=>item),
  };
}

export async function artworkHistoryImage({root,workspace,projects,kind,projectId,variantId='main',revisionId}){
  if(!uuid(revisionId))throw fail('历史记录 ID 不合法。',422);
  await safeCurrent({root,projects,kind,projectId,variantId});
  const entries=await historyEntries({workspace,kind,projectId,variantId});
  const match=entries.find(x=>x.id===revisionId);
  if(!match)throw fail('没有找到可用的历史封面。',404);
  return match.backup;
}

async function atomicJSON(file,value){
  const temp=file+'.'+randomUUID()+'.tmp';
  try{await fs.writeFile(temp,json(value),{flag:'wx'});await fs.rename(temp,file);}
  finally{await fs.rm(temp,{force:true});}
}

export async function restoreArtwork({root,workspace,projects,kind,projectId,
  variantId='main',revisionId,expectedHash,confirmed,probe}){
  if(confirmed!==true)throw fail('请确认恢复选中的历史封面。',422);
  if(!uuid(revisionId)||!(/^[a-f0-9]{64}$/i.test(String(expectedHash||''))))
    throw fail('历史记录或当前版本校验信息不完整。',422);
  const current=await safeCurrent({root,projects,kind,projectId,variantId});
  const nowHash=await fingerprint(current.file);
  if(nowHash!==expectedHash)throw fail('当前封面已被修改，请重新打开历史记录再恢复。',409);
  const entries=await historyEntries({workspace,kind,projectId,variantId});
  const from=entries.find(x=>x.id===revisionId);
  if(!from)throw fail('此历史封面不存在或不属于该作品/版本。',404);
  if(nowHash===await fingerprint(from.backup))throw fail('当前封面已经是这个历史版本，无需恢复。',422);
  const info=await probe(from.backup);
  if(Math.abs(info.width/info.height-current.expectedRatio)>0.018)
    throw fail('该历史图片与当前封面的画幅不匹配，已拒绝恢复。',422);

  const base=baseDir(workspace,kind,projectId);
  await fs.mkdir(base,{recursive:true});
  const id=randomUUID();
  const historyBackup=backupFile(base,kind,id,variantId);
  const temp=current.file+'.'+id+'.tmp';
  await fs.copyFile(current.file,historyBackup);
  const at=new Date().toISOString();
  let metadataFile=null,originalData=null,nextData=null;
  const record={
    at,projectId,variantId,restoredFromRevision:revisionId,sourceName:'artwork-history',
    oldImageKept:true,videoUnchanged:true,imageKitUrlUnchanged:true,
  };
  if(kind==='poster'){
    const isMain=variantId==='main';
    metadataFile=path.join(root,'src/data',isMain?'project-video-metadata.json':'auto-projects.json');
    originalData=JSON.parse(await fs.readFile(metadataFile,'utf8'));
    nextData=structuredClone(originalData);
    const target=isMain?nextData[projectId]:
      nextData.find(x=>x.id===projectId)?.variants?.find(v=>v.id===variantId);
    if(!target)throw fail('找不到当前版本的播放器海报元数据。',409);
    const oldTime=isMain?target.playerPosterTime:target.posterTime;
    const newTime=from.record.previousTime??null;
    const restoredSource=from.record.previousTimeSource||'restored-history';
    if(isMain){
      target.playerPosterTime=newTime;
      target.playerPosterTimeSource=restoredSource;
    }else{
      target.posterTime=newTime;
      target.posterTimeSource=restoredSource;
    }
    Object.assign(record,{action:'restore-player-poster',poster:current.version.poster,
      backup:historyBackup,previousTime:oldTime??null,newTime,
      previousTimeSource:current.version.timeSource??null,timeSource:restoredSource});
  }else Object.assign(record,{action:'restore-card-cover',previousCover:null,
    nextCover:path.relative(path.join(root,'assets/images/project-covers'),current.file),
    previousFileBackup:historyBackup});

  let swapped=false,metadataSaved=false;
  try{
    await fs.copyFile(from.backup,temp);
    await fs.rename(temp,current.file);swapped=true;
    if(metadataFile){
      await atomicJSON(metadataFile,nextData);
      metadataSaved=true;
    }
    await fs.writeFile(path.join(base,id+'.json'),json(record),{flag:'wx'});
  }catch(e){
    if(swapped)await fs.copyFile(historyBackup,current.file);
    if(metadataSaved&&metadataFile)await atomicJSON(metadataFile,originalData);
    throw e;
  }finally{await fs.rm(temp,{force:true});}
  await pruneArtworkHistory({workspace,kind,projectId,variantId});
  return {projectId,variantId,kind,restoredFromRevision:revisionId,
    revisionId:id,currentHash:await fingerprint(current.file)};
}
