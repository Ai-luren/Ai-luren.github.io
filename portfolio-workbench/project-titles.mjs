import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const read = file => fs.readFile(file, 'utf8').then(JSON.parse);
const json = value => JSON.stringify(value, null, 2) + '\n';

function clean(value, language) {
  const title = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!title || title.length > 80 || /[\x00-\x1f\x7f<>]/.test(title))
    throw fail(language + '作品名称必须填写，且不能超过 80 字或包含控制字符、尖括号。');
  return title;
}

export function safeFileName(title) {
  const name = String(title ?? '').normalize('NFKC')
    .replace(/[\x00-\x1f<>:"/\\|?*]/g, ' ')
    .replace(/’/g, "'").replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '');
  if (!name || name.length > 110 || name === '.' || name === '..' || name.includes('..'))
    throw fail('英文标题无法转换为安全文件名。');
  return name;
}
export const CATEGORY_IDS = Object.freeze(['commercial', 'short-film', 'social', 'visual']);
const VIDEO_FOLDERS = new Set(['AI Commercials', 'AI Short Flims', 'AI Overseas Product Ads', 'AI Visual Experiments']);
export function artworkPath(category, stem) {
  if (!CATEGORY_IDS.includes(category)) throw fail('未知作品分类。', 422);
  return category + '/' + safeFileName(stem) + '.webp';
}
const validPath = (relative, kind) => {
  const parts = String(relative ?? '').split('/');
  const folders = kind === 'video' ? VIDEO_FOLDERS : new Set(CATEGORY_IDS);
  const ext = kind === 'video' ? '.mp4' : '.webp';
  if (parts.length !== 2 || !folders.has(parts[0]) || !parts[1].endsWith(ext) ||
      parts[1].startsWith('.') || parts[1].includes('..') || parts[1].includes('\\') ||
      path.isAbsolute(relative)) throw fail('素材路径异常：' + relative, 422);
  return relative;
};
async function atomicJSON(file, value) {
  const temp = file + '.' + randomUUID() + '.tmp';
  try { await fs.writeFile(temp, json(value), { flag: 'wx' }); await fs.rename(temp, file); }
  finally { await fs.rm(temp, { force: true }); }
}
async function checkPlan(root, files) {
  const seen = new Set();
  for (const item of files) {
    const parent = path.join(root, item.type === 'video' ? 'assets/videos/works' :
      (item.type === 'cover' ? 'assets/images/project-covers' : 'assets/images/player-posters'));
    const srcRel = validPath(item.before, item.type === 'video' ? 'video' : 'image');
    const dstRel = validPath(item.after, item.type === 'video' ? 'video' : 'image');
    if (await fs.realpath(parent) !== parent || await fs.realpath(path.dirname(path.join(parent, srcRel))) !== path.dirname(path.join(parent, srcRel)))
      throw fail('作品目录存在符号链接，不允许跨目录自动更名。', 422);
    const src = path.join(parent, srcRel), dest = path.join(parent, dstRel);
    const stat = await fs.lstat(src);
    if (!stat.isFile() || stat.size === 0) throw fail('素材不存在或不是普通文件：' + srcRel, 422);
    if (seen.has(dest)) throw fail('目标文件名重复：' + dstRel, 409);
    seen.add(dest);
    if (src !== dest) {
      try { await fs.lstat(dest); throw fail('新名称已被占用：' + dstRel, 409); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    item.src = src; item.dest = dest;
  }
}
/**
 * Title edit is a local-only transaction covering the display title,
 * physical MP4, 3:4 cover and ALL original-aspect-ratio player posters.
 * ImageKit URLs, source uploads, IDs, ordering and award data stay unchanged.
 */
export async function saveProjectTitle({
  projectRoot, workspace, projects, id, titleZh, titleEn, expectedZh, expectedEn, confirmed,
}) {
  if (confirmed !== true) throw fail('请先确认修改作品标题。');
  if (!/^\d{2,}$/.test(String(id))) throw fail('作品编号不合法。');
  const project = projects.find(p => p.id === id);
  if (!project) throw fail('作品不存在。', 404);
  const zh = clean(titleZh, '中文'), en = clean(titleEn, '英文');
  if (project.title !== expectedZh || project.titleEn !== expectedEn)
    throw fail('作品名称已有变更，请刷新工作台重新编辑。', 409);
  if (projects.some(p => p.id !== id && (p.title === zh || p.titleEn === en)))
    throw fail('作品库已有相同中文或英文名称。', 409);
  const root = await fs.realpath(projectRoot);
  const data = path.join(root, 'src/data');
  const files = {
    titles: path.join(data,'project-title-overrides.json'),
    paths: path.join(data,'local-video-paths.json'),
    originals: path.join(data,'local-video-origins.json'),
    auto: path.join(data,'auto-projects.json'),
    covers: path.join(data,'project-cover-overrides.json'),
    metadata: path.join(data,'project-video-metadata.json'),
  };
  const [titlesBefore, pathsBefore, originals, autoBefore, coversBefore, metadataBefore] = await Promise.all([
    read(files.titles),read(files.paths),read(files.originals),read(files.auto),read(files.covers),read(files.metadata),
  ]);
  const generated = autoBefore.find(p => p.id === id);
  const category = project.category || (generated && generated.category);
  if (!CATEGORY_IDS.includes(category)) throw fail('缺少有效作品分类。');
  const titleNext = { ...titlesBefore, [id]: { zh, en } };
  const pathsNext = {...pathsBefore}, autoNext = structuredClone(autoBefore);
  const coverNext = {...coversBefore}, metaNext=structuredClone(metadataBefore);
  const currentAuto = autoNext.find(p => p.id === id);
  const plan=[];
  const add=(type,before,after)=>{plan.push({type,before,after});};
  const variantVideoNames = [];
  if (currentAuto) {
    const versions = currentAuto.variants || [];
    const mainStem = en + (versions.length ? ' - Version A' : '');
    const newMain = path.posix.dirname(currentAuto.localVideoPath)+'/'+safeFileName(mainStem)+'.mp4';
    add('video', currentAuto.localVideoPath,newMain);
    variantVideoNames.push({type:'main',next:newMain});
    currentAuto.localVideoPath=newMain;
    currentAuto.title={zh,en};
    for (const [index, variant] of versions.entries()) {
      const versionStem = en + ' - ' + (variant.label?.en || 'Version ' + String.fromCharCode(66+index));
      const next=path.posix.dirname(variant.localVideoPath)+'/'+safeFileName(versionStem)+'.mp4';
      add('video',variant.localVideoPath,next);
      variantVideoNames.push({type:'variant',index,next});
      variant.localVideoPath=next;
    }
  } else {
    const old=pathsBefore[id] || originals[id];
    if (!old) throw fail('找不到已有作品的视频文件。', 404);
    const next=path.posix.dirname(old)+'/'+safeFileName(en)+'.mp4';
    add('video',old,next); pathsNext[id]=next;
    variantVideoNames.push({type:'main',next});
  }
  const oldCover=coversBefore[id] || currentAuto?.coverFile;
  const newCover=artworkPath(category,en);
  if (!oldCover) throw fail('缺少作品封面文件映射。', 422);
  add('cover',oldCover,newCover);coverNext[id]=newCover;
  if (currentAuto) currentAuto.coverFile=newCover;
  const oldPoster=metadataBefore[id]?.playerPoster;
  if (!oldPoster) throw fail('缺少播放器海报映射。', 422);
  const mainPoster=artworkPath(category,path.posix.basename(variantVideoNames[0].next,'.mp4'));
  add('poster',oldPoster,mainPoster);
  metaNext[id].playerPoster=mainPoster;
  if (currentAuto) {
    for (const item of variantVideoNames.filter(item=>item.type==='variant')) {
      const variant=currentAuto.variants[item.index];
      const next=artworkPath(category,path.posix.basename(item.next,'.mp4'));
      add('poster',variant.posterFile,next);
      variant.posterFile=next;
    }
  }
  await checkPlan(root,plan);
  const moved=plan.filter(item=>item.src!==item.dest);
  if (zh===project.title && en===project.titleEn && !moved.length)
    return {id,title:{zh,en},changed:false,renamedFiles:[],renamedArtwork:[]};
  const dir=path.join(workspace,'project-revisions');
  await fs.mkdir(dir,{recursive:true});
  const rid=randomUUID();
  await fs.writeFile(path.join(dir,'title-'+id+'-'+rid+'.json'),json({
    at:new Date().toISOString(),action:'rename-title-video-cover-and-poster',id,
    before:{zh:project.title,en:project.titleEn},after:{zh,en},
    changes:plan.map(({type,before,after})=>({type,before,after})),
    previousTitle:titlesBefore[id]||null,
  }),{flag:'wx'});
  const modified=[], renamed=[];
  const changes=[
    [files.titles,titleNext,titlesBefore],
    [files.covers,coverNext,coversBefore],
    [files.metadata,metaNext,metadataBefore],
    ...(currentAuto ? [[files.auto,autoNext,autoBefore]] : [[files.paths,pathsNext,pathsBefore]]),
  ];
  try {
    for(const item of moved){await fs.rename(item.src,item.dest);renamed.push(item);}
    for(const [file,next,previous] of changes){
      await atomicJSON(file,next);modified.push([file,previous]);
    }
  }catch(error){
    for(const [file,old] of modified.reverse())await atomicJSON(file,old);
    for(const item of renamed.reverse())await fs.rename(item.dest,item.src);
    throw error;
  }
  return {
    id,title:{zh,en},changed:true,
    renamedFiles:moved.filter(item=>item.type==='video').map(item=>({before:item.before,after:item.after})),
    renamedArtwork:moved.filter(item=>item.type!=='video').map(item=>({type:item.type,before:item.before,after:item.after})),
  };
}
