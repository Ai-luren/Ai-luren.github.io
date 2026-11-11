import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const data=(root,name)=>path.join(root,'src/data',name+'.json');
const read=file=>fs.readFile(file,'utf8').then(JSON.parse);
const json=value=>JSON.stringify(value,null,2)+'\n';
const uuid=value=>/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(String(value||''));
const videoFolders=new Set(['AI Commercials','AI Short Flims','AI Overseas Product Ads','AI Visual Experiments']);

function safeVideoPath(relative) {
  if(typeof relative!=='string'||relative.includes('\\')||path.isAbsolute(relative))throw fail('本地视频路径无效。',422);
  const parts=relative.split('/');
  if(parts.length!==2||!videoFolders.has(parts[0])||parts[1].startsWith('.')||parts[1].includes('..')||!parts[1].endsWith('.mp4'))throw fail('本地视频路径无效。',422);
  return relative;
}
function safePosterPath(relative,category) {
  if(typeof relative!=='string'||relative.includes('\\')||path.isAbsolute(relative))throw fail('播放器海报路径无效。',422);
  const parts=relative.split('/');
  if(parts.length!==2||parts[0]!==category||parts[1].startsWith('.')||parts[1].includes('..')||!parts[1].endsWith('.webp'))throw fail('播放器海报路径无效。',422);
  return relative;
}
async function storeJSON(file,value) {
  const temp=file+'.'+randomUUID()+'.tmp';
  try {await fs.writeFile(temp,json(value),{flag:'wx'});await fs.rename(temp,file);}
  finally {await fs.rm(temp,{force:true});}
}
async function catalog(root) {
  const [metadata,auto,paths]=await Promise.all([
    read(data(root,'project-video-metadata')),
    read(data(root,'auto-projects')),
    read(data(root,'local-video-paths')),
  ]);
  const legacyVariants=await read(data(root,'legacy-video-variants'));
  const archived=await read(data(root,'archive-state')).catch(error=>{
    if(error.code==='ENOENT')return {works:{},versions:{}};throw error;
  });
  const legacyMainLabels=await read(data(root,'legacy-main-version-labels')).catch(error=>{
    if(error.code==='ENOENT')return {};throw error;
  });
  return {metadata,auto,paths,legacyVariants,legacyMainLabels,archived};
}
function versionFromCatalog(project,versionId,c) {
  if(c.archived.versions?.[project.id]?.[versionId])
    throw fail('此版本已移入回收站，请先恢复后再播放或编辑。',404);
  const work=c.auto.find(p=>p.id===project.id);
  const variants=work?.variants||c.legacyVariants[project.id]||[];
  const isMain=versionId==='main';
  const other=isMain?null:variants.find(v=>v.id===versionId);
  if(!isMain&&!other)throw fail('找不到该视频版本。',404);
  const meta=c.metadata[project.id];
  if(!meta)throw fail('没有播放器海报元数据。',422);
  const video=other?.localVideoPath||(work?.localVideoPath||c.paths[project.id]);
  const poster=other?.posterFile||meta.playerPoster;
  const width=other?.videoWidth||meta.videoWidth;
  const height=other?.videoHeight||meta.videoHeight;
  if(!(width>0&&height>0))throw fail('视频显示比例元数据缺失。',422);
  safeVideoPath(video);
  safePosterPath(poster,project.category);
  return {id:versionId,label:other?.label || (isMain ? (work?.mainVersionLabel||c.legacyMainLabels[project.id]||{zh:'主版本',en:'Main version'}) : null),
    poster,video,width,height,time:isMain?(meta.playerPosterTime??null):(other.posterTime??null),
    timeSource:isMain?(meta.playerPosterTimeSource??null):(other.posterTimeSource??null),
    main:isMain,work,other};
}
export async function listPosterVersions(root,projects) {
  const c=await catalog(root);
  return projects.map(project=>{
    const work=c.auto.find(p=>p.id===project.id);
    const versions=[...(c.archived.versions?.[project.id]?.main?[]:['main']),
      ...(work?.variants||c.legacyVariants[project.id]||[])
      .filter(v=>!c.archived.versions?.[project.id]?.[v.id]).map(v=>v.id)].map(id=>{
      const v=versionFromCatalog(project,id,c);
      return {id:v.id,label:v.label,poster:v.poster,time:v.time,width:v.width,height:v.height};
    });
    return {id:project.id,versions};
  });
}
export async function currentPoster({root,projects,projectId,variantId='main'}) {
  const project=projects.find(p=>p.id===projectId);
  if(!project)throw fail('作品不存在。',404);
  const version=versionFromCatalog(project,variantId,await catalog(root));
  const file=path.join(root,'assets/images/player-posters',version.poster);
  const resolved=await fs.realpath(file);
  if(resolved!==file)throw fail('播放器海报必须位于项目素材目录。',422);
  return {file,version,project};
}
export async function currentVideo({root,projects,projectId,variantId='main'}) {
  const project=projects.find(p=>p.id===projectId);
  if(!project)throw fail('作品不存在。',404);
  const version=versionFromCatalog(project,variantId,await catalog(root));
  const file=path.join(root,'assets/videos/works',version.video);
  const resolved=await fs.realpath(file);
  if(resolved!==file)throw fail('视频必须位于本地作品目录。',422);
  const st=await fs.lstat(file);
  if(!st.isFile()||st.size===0||st.size>2*1024**3)throw fail('视频不存在或超过 2 GB。',422);
  return {file,version,project};
}

export async function replacePoster({root,workspace,projects,projectId,variantId='main',exportId,
 expectedPoster,expectedTime,confirmed,exportsDir,sessionsDir,probe}) {
  if(confirmed!==true)throw fail('请先勾选确认更换播放器海报。');
  if(!uuid(exportId))throw fail('无效导出 ID。');
  const project=projects.find(p=>p.id===projectId);
  if(!project)throw fail('作品不存在。',404);
  const c=await catalog(root);
  const v=versionFromCatalog(project,variantId,c);
  if(v.poster!==expectedPoster||(v.time??null)!==(expectedTime??null))
    throw fail('此视频版本的海报已更改，请刷新后重新确认。',409);

  const record=await read(path.join(exportsDir,exportId+'.json'));
  const sid=record.sessionId;
  if(!uuid(sid)||!uuid(record.frameId))throw fail('导出记录不完整。',422);
  const session=await read(path.join(sessionsDir,sid,'session.json'));
  if(session.boundProjectId&&(session.boundProjectId!==projectId||session.boundVariantId!==variantId))
    throw fail('当前视频选帧不属于选定的视频版本。',409);
  const exportPoster=path.join(exportsDir,exportId+'-poster.webp');
  const info=await probe(exportPoster);
  const expectedRatio=v.width/v.height,actualRatio=info.width/info.height;
  if(Math.abs(actualRatio-expectedRatio)>0.018)
    throw fail('新海报与此视频的实际显示比例不一致。请选择该版本视频选帧，或导入相同比例的图片。',422);
  const existing=path.join(root,'assets/images/player-posters',v.poster);
  if(await fs.realpath(existing)!==existing)throw fail('海报路径不安全。',422);
  const old=await fs.lstat(existing);
  if(!old.isFile())throw fail('现有海报不是普通文件。',422);
  const historyDir=path.join(workspace,'project-revisions','poster-history',projectId);
  await fs.mkdir(historyDir,{recursive:true});
  const id=randomUUID();
  const backup=path.join(historyDir,id+'-'+(variantId==='main'?'main':variantId)+'-previous.webp');
  await fs.copyFile(existing,backup);
  const nextTime=session.kind==='video'?Number(record.time):null;
  if(session.kind==='video'&&(!Number.isFinite(nextTime)||nextTime<0||nextTime>=session.metadata.duration))
    throw fail('选帧时间已失效。',422);
  const timeSource=session.kind==='image'?'manual-image':'confirmed-poster-selection';
  if(v.main){
    c.metadata[projectId].playerPosterTime=nextTime;
    c.metadata[projectId].playerPosterTimeSource=timeSource;
  }else{
    v.other.posterTime=nextTime;
    v.other.posterTimeSource=timeSource;
  }
  const targetData=v.main?data(root,'project-video-metadata'):
    data(root,v.work?'auto-projects':'legacy-video-variants');
  const nextData=v.main?c.metadata:(v.work?c.auto:c.legacyVariants);
  const fileTemp=existing+'.'+id+'.tmp';
  try{
    await fs.copyFile(exportPoster,fileTemp);
    await fs.rename(fileTemp,existing);
    await storeJSON(targetData,nextData);
  }catch(error){
    await fs.rm(fileTemp,{force:true});
    await fs.copyFile(backup,existing);
    throw error;
  }
  await fs.writeFile(path.join(historyDir,id+'.json'),json({
    at:new Date().toISOString(),action:'replace-player-poster',projectId,variantId,
    poster:v.poster,backup,previousTime:v.time,previousTimeSource:v.timeSource,
    newTime:nextTime,timeSource,
    aspectRatio:{expected:expectedRatio,actual:actualRatio},sourceName:session.name,
    cardCoverUnchanged:true,videoUnchanged:true,imageKitUrlUnchanged:true,
  }),{flag:'wx'});
  return {projectId,variantId,poster:v.poster,time:nextTime,
    url:'/project-poster/'+encodeURIComponent(projectId)+'/'+encodeURIComponent(variantId)};
}
