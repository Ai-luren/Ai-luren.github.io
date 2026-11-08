import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { safeFileName, artworkPath } from './project-titles.mjs';

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const json = value => JSON.stringify(value, null, 2) + '\n';
const dataPath = root => path.join(root, 'src/data/auto-projects.json');
const legacyVariantsPath=root=>path.join(root,'src/data/legacy-video-variants.json');
const safeUuid = value => /^[0-9a-f-]{36}$/i.test(String(value || ''));
const DEFAULT_ENDPOINT = 'https://ik.imagekit.io/Ailuren/';

async function writeAtomically(file, data) {
  const tmp = file + '.' + randomUUID() + '.tmp';
  try { await fsp.writeFile(tmp, json(data), { flag: 'wx' }); await fsp.rename(tmp, file); }
  finally { await fsp.rm(tmp, { force: true }); }
}
function label(value, name) {
  const result = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!result || result.length > 50 || /[\x00-\x1f\x7f<>]/.test(result)) throw fail(name + '需填写且不超过 50 字。');
  return result;
}
function findWork(list, projectId, variantId) {
  const work = list.find(p => p.id === projectId);
  if (!work) throw fail('只能管理工作台创建的新作品。', 404);
  const variant = variantId === 'main' ? work : (work.variants || []).find(v => v.id === variantId);
  if (!variant) throw fail('没有找到这个视频版本。', 404);
  return {work, variant};
}
export function normalizeImageKitUrl(value, { endpoint = DEFAULT_ENDPOINT } = {}) {
  let u, base;
  try { u = new URL(String(value || '').trim()); base = new URL(endpoint); }
  catch { throw fail('请填写有效的 ImageKit MP4 视频地址。'); }
  if (u.protocol !== 'https:' || u.origin !== base.origin ||
      u.username || u.password || u.hash ||
      !u.pathname.startsWith(base.pathname) || !/\.mp4$/i.test(u.pathname) ||
      u.pathname.includes('..')) throw fail('仅接受当前账户的 ImageKit HTTPS MP4 直链。');
  return u.toString();
}
// All 17 works can view/copy/edit their ImageKit video addresses.
 // Legacy URLs live in legacy-imagekit-urls.json; generated versions use auto-projects.json.
 // Video bytes and paths are never changed by URL editing.
export async function listManagedVersions(projectRoot, existingProjects = []) {
  const all = JSON.parse(await fsp.readFile(dataPath(projectRoot), 'utf8'));
  const legacyURLs=JSON.parse(await fsp.readFile(path.join(projectRoot,'src/data/legacy-imagekit-urls.json'),'utf8'));
  const generated = new Map(all.map(p => [p.id, p]));
  const legacyVariants=JSON.parse(await fsp.readFile(legacyVariantsPath(projectRoot),'utf8'));
  return existingProjects.map(existing => {
    const p = generated.get(existing.id);
    if (!p) {
      return {
        id: existing.id, title: existing.title, legacy: true, featured: existing.featured,
        versions: [{
          id: 'main', label: { zh: '主版本', en: 'Main version' },
          videoUrl: legacyURLs[existing.id] || null, sourceName: existing.videoFileName || '',
        }, ...(legacyVariants[existing.id]||[]).map(v=>({
          id:v.id,label:v.label,videoUrl:v.videoUrl||null,
        }))],
      };
    }
    return {
      id: p.id, title: existing.title, legacy: false, featured: p.featured,
      versions: [{
        id: 'main', label: p.mainVersionLabel || {zh:'主版本', en:'Main version'},
        videoUrl: p.videoUrl || null,
      }, ...(p.variants || []).map(v => ({
        id: v.id, label: v.label, videoUrl: v.videoUrl || null,
      }))],
    };
  });
}
export async function appendVideoVersion({ projectRoot, workspace, sessionsDir, sessionId, projectId, time, labelZh, labelEn, posterSource, confirmed, existingProjects=[] }) {
  if (confirmed !== true) throw fail('请确认将此视频加入选中的作品。');
  if (!safeUuid(sessionId)) throw fail('请先导入有效的视频。');
  const session=JSON.parse(await fsp.readFile(path.join(sessionsDir,sessionId,'session.json'),'utf8'));
  if (session.kind!=='video' || !Number.isFinite(Number(time)) || Number(time)<0 || Number(time)>=session.metadata.duration) {
    throw fail('请选择视频及有效的海报选帧时间。');
  }
  const generatedFile=dataPath(projectRoot);
  const list=JSON.parse(await fsp.readFile(generatedFile,'utf8'));
  const work=list.find(p=>p.id===projectId);
  const legacyFile=legacyVariantsPath(projectRoot);
  const legacyVersions=JSON.parse(await fsp.readFile(legacyFile,'utf8'));
  const existing=existingProjects.find(p=>p.id===projectId);
  if(!existing)throw fail('作品不存在。',404);
  const currentVariants=work?.variants||legacyVersions[projectId]||[];
  if(currentVariants.length>=7)throw fail('一个作品最多允许 8 个视频版本。');
  const legacyPaths=work?null:JSON.parse(await fsp.readFile(path.join(projectRoot,'src/data/local-video-paths.json'),'utf8'));
  const mainVideo=work?.localVideoPath||legacyPaths?.[projectId];
  if(!mainVideo)throw fail('找不到原作品的本地 MP4 位置。',422);
  const folder=path.posix.dirname(mainVideo);
  if (!['AI Commercials','AI Short Flims','AI Overseas Product Ads','AI Visual Experiments'].includes(folder)) {
    throw fail('作品的视频路径不合法。');
  }
  const id=randomUUID(), prefix=`auto-${projectId}-variant-${id}`;
  const overrides=JSON.parse(await fsp.readFile(path.join(projectRoot,'src/data/project-title-overrides.json'),'utf8'));
  const visibleEnglishTitle=overrides[projectId]?.en || work?.title.en || existing.titleEn;
  const videoName=safeFileName(visibleEnglishTitle + ' - ' + label(labelEn,'英文版本名称'))+'.mp4';
  const posterName=artworkPath(work?.category||existing.category, path.posix.basename(videoName,'.mp4'));
  const videoPath=path.join(projectRoot,'assets/videos/works',folder,videoName);
  const posterPath=path.join(projectRoot,'assets/images/player-posters',posterName);
  await fsp.mkdir(path.dirname(posterPath),{recursive:true});
  const sourcePath=path.join(sessionsDir,sessionId,session.source);
  const created=[];
  try {
    await fsp.copyFile(sourcePath,videoPath,constants.COPYFILE_EXCL); created.push(videoPath);
    await fsp.copyFile(posterSource,posterPath,constants.COPYFILE_EXCL); created.push(posterPath);
    const variant={
      id,label:{zh:label(labelZh,'中文版本名称'),en:label(labelEn,'英文版本名称')},
      localVideoPath:`${folder}/${videoName}`,videoUrl:null,
      videoWidth:session.metadata.width,videoHeight:session.metadata.height,posterFile:posterName,
    };
    if(work)work.variants=[...currentVariants,variant];
    else legacyVersions[projectId]=[...currentVariants,variant];
    const revision=path.join(workspace,'project-revisions',`variant-${projectId}-${id}.json`);
    await fsp.mkdir(path.dirname(revision),{recursive:true});
    await fsp.writeFile(revision,json({at:new Date().toISOString(),action:'add-variant',projectId,variant,files:created}),{flag:'wx'});
    await writeAtomically(work?generatedFile:legacyFile,work?list:legacyVersions);
    return { projectId, variantId:id, label:variant.label, localVideoPath:variant.localVideoPath };
  } catch(e) {
    await Promise.all(created.map(f=>fsp.rm(f,{force:true})));
    throw e;
  }
}
export async function bindImageKitUrl({ projectRoot, workspace, projectId, variantId='main', url, expectedUrl, confirmed }) {
  if (confirmed!==true) throw fail('请确认关联线上视频地址。');
  const normalized=normalizeImageKitUrl(url);
  const legacyFile=path.join(projectRoot,'src/data/legacy-imagekit-urls.json');
  const legacyURLs=JSON.parse(await fsp.readFile(legacyFile,'utf8'));
  if (Object.prototype.hasOwnProperty.call(legacyURLs,projectId)) {
    if(variantId!=='main'){
      const file=legacyVariantsPath(projectRoot);
      const catalog=JSON.parse(await fsp.readFile(file,'utf8'));
      const variant=(catalog[projectId]||[]).find(v=>v.id===variantId);
      if(!variant)throw fail('找不到旧作品的视频版本。',404);
      if((variant.videoUrl||null)!==(expectedUrl||null))
        throw fail('此线上地址已更新，请刷新后重试。',409);
      if(variant.videoUrl===normalized)return {projectId,variantId,url:normalized,changed:false};
      const previous=variant.videoUrl||null;
      variant.videoUrl=normalized;
      const revision=path.join(workspace,'project-revisions','imagekit-'+projectId+'-'+randomUUID()+'.json');
      await fsp.mkdir(path.dirname(revision),{recursive:true});
      await fsp.writeFile(revision,json({at:new Date().toISOString(),action:'bind-legacy-variant-imagekit-url',
        projectId,variantId,previous,next:normalized}),{flag:'wx'});
      await writeAtomically(file,catalog);
      return {projectId,variantId,url:normalized,changed:true};
    }
    const previous=legacyURLs[projectId];
    if(previous!==(expectedUrl||null))throw fail('此线上地址已更新，请刷新后重试。',409);
    if(previous===normalized)return {projectId,variantId,url:normalized,changed:false};
    legacyURLs[projectId]=normalized;
    const revision=path.join(workspace,'project-revisions', 'imagekit-'+projectId+'-'+randomUUID()+'.json');
    await fsp.mkdir(path.dirname(revision),{recursive:true});
    await fsp.writeFile(revision,json({at:new Date().toISOString(),action:'update-existing-imagekit-url',
      projectId,variantId,previous,next:normalized}),{flag:'wx'});
    await writeAtomically(legacyFile,legacyURLs);
    return {projectId,variantId,url:normalized,changed:true};
  }
  const file=dataPath(projectRoot),list=JSON.parse(await fsp.readFile(file,'utf8'));
  const {variant}=findWork(list,projectId,variantId);
  if ((variant.videoUrl||null)!==(expectedUrl||null)) throw fail('URL 已有变化，请刷新后重试。',409);
  const prior=variant.videoUrl||null;
  variant.videoUrl=normalized;
  const revision=path.join(workspace,'project-revisions',`imagekit-${projectId}-${randomUUID()}.json`);
  await fsp.mkdir(path.dirname(revision),{recursive:true});
  await fsp.writeFile(revision,json({at:new Date().toISOString(),action:'bind-imagekit-url',projectId,variantId,prior,next:normalized}),{flag:'wx'});
  await writeAtomically(file,list);
  return {projectId,variantId,url:normalized};
}
