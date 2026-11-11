import http from 'node:http';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { createReadStream, constants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { createServer as createViteServer } from 'vite';
import { createNewCoverStudioProject } from './project-publisher.mjs';
import { listManagedVersions, appendVideoVersion, bindImageKitUrl, updateVideoVersionLabel } from './project-versions.mjs';
import { describeProjectOrder, saveProjectOrder } from './project-order.mjs';
import {readVersionOrders,saveVersionOrder} from './project-version-order.mjs';
import {orderVideoVersions} from '../../src/data/version-order.js';
import { saveProjectTitle, artworkPath } from './project-titles.mjs';
import { listPosterVersions, currentPoster, currentVideo, replacePoster } from './project-poster.mjs';
import {listArtworkHistory,artworkHistoryImage,restoreArtwork,pruneArtworkHistory,pruneAllArtworkHistory} from './artwork-history.mjs';
import { deduplicateSessionSource } from './session-storage.mjs';
import {readArchive, archiveItems, updateArchive} from './project-archive.mjs';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const uuid = value => /^[a-f0-9-]{36}$/.test(value || '');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4' };
async function command(bin, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', error = '';
    const timer = setTimeout(() => proc.kill('SIGKILL'), 120000);
    proc.stdout.on('data', chunk => { output += chunk; });
    proc.stderr.on('data', chunk => { error = (error + chunk).slice(-4000); });
    proc.on('error', e => { clearTimeout(timer); reject(fail(`无法运行 ${bin}：${e.message}`, 500)); });
    proc.on('close', code => { clearTimeout(timer); code === 0 ? resolve(output) : reject(fail(`${bin} 处理失败：${error || '超时或文件不受支持'}`, 422)); });
  });
}
async function probe(file) {
  const data = JSON.parse(await command('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]));
  const v = data.streams.find(s => s.codec_type === 'video');
  if (!v?.width || !v.height) throw fail('文件中没有可识别的画面。', 422);
  const fraction = (value, fallback = 1) => {
    const parts = String(value || '').split(/[:/]/).map(Number);
    return parts.length === 2 && parts[0] > 0 && parts[1] > 0 ? parts[0] / parts[1] : fallback;
  };
  const rotation = Number(v.side_data_list?.find(s => s.rotation != null)?.rotation || v.tags?.rotate || 0);
  let width = Math.round(v.width * fraction(v.sample_aspect_ratio)), height = v.height;
  if (Math.abs(rotation) % 180 === 90) [width, height] = [height, width];
  const duration=Number(data.format.duration||v.duration||0),fps=fraction(v.avg_frame_rate,25);
  const frames=Number(v.nb_frames)||0;
  const lastFrameTime=frames>0&&fps>0
    ?Math.min(Math.max(0,duration-.001),(frames-1)/fps)
    :Math.max(0,duration-Math.max(.12,1.5/fps));
  return {width,height,codedWidth:v.width,codedHeight:v.height,duration,fps,
    frameCount:frames,lastFrameTime,codec:v.codec_name};
}
const writeJSON = (file, value, exclusive = false) => fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { flag: exclusive ? 'wx' : 'w' });
const readJSON = async (file, fallback) => { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT' && fallback !== undefined) return fallback; throw e; } };

export async function createCoverStudio({ projectRoot = path.resolve(TOOL_DIR, '../..'), port = 5190 } = {}) {
  projectRoot = await fs.realpath(projectRoot);
  const workspace = path.join(projectRoot, '.cover-studio');
  const sessionsDir = path.join(workspace, 'sessions'), exportsDir = path.join(workspace, 'exports');
  const mappingFile = path.join(projectRoot, 'src/data/project-cover-overrides.json');
  // Only this preconfigured, local folder can be browsed through the workbench.
  const defaultVideoDir = path.resolve(process.env.COVER_STUDIO_VIDEO_DIR || '/Users/ailuren/Desktop/重要资料/个人网页作品集-imagekit本地');
  await fs.mkdir(sessionsDir, { recursive: true });
  await fs.mkdir(exportsDir, { recursive: true });
  const token = randomBytes(24).toString('hex');
  const origin = `http://127.0.0.1:${port}`;
  const vite = await createViteServer({ configFile: false, root: projectRoot, server: { middlewareMode: true, watch: null, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' });
  let busy = false;
  // Local preview tabs run on 5174; this read-only SSE channel carries only
  // changed artwork IDs, never project contents, files or auth credentials.
  const previewClients = new Set();
  let previewSequence = 0;
  const announcePreview = (kind, projectId, variantId = 'main') => {
    const message = 'id: ' + (++previewSequence) + '\n'
      + 'event: artwork\n'
      + 'data: ' + JSON.stringify({kind,projectId,variantId,revision:previewSequence}) + '\n\n';
    for (const res of previewClients) {
      if (!res.destroyed) res.write(message);
    }
  };
  async function projects() {
    vite.moduleGraph.invalidateAll();
    const { PROJECTS } = await vite.ssrLoadModule('/src/data/projects.js');
    return PROJECTS.map(p => ({ id: p.id, title: p.title.zh, titleEn: p.title.en, category: p.category, featured: p.featured, cover: p.cover,
      videoFileName: decodeURIComponent((p.videoUrl || '').split('/').at(-1) || '') }));
  }
  async function session(id) {
    if (!uuid(id)) throw fail('无效会话。');
    const dir = path.join(sessionsDir, id);
    return { dir, data: await readJSON(path.join(dir, 'session.json')) };
  }
  function frameCommand({file,target,time,lastFrame=false,filter='scale=ceil(iw*sar):ih,setsar=1'}){
    if(lastFrame){
      // Audio may extend beyond video. Decode the tail and keep its last visual frame.
      return ['-v','error','-nostdin','-sseof','-'+String(Math.min(2,Math.max(.03,time))),
        '-i',file,'-an','-vf',filter,'-fps_mode','passthrough',
        '-update','1','-y',target];
    }
    return ['-v','error','-nostdin','-ss',String(time),
      '-i',file,'-frames:v','1','-vf',filter,target];
  }
  async function finishImport(id, dir, kind, name, source, {candidates=true}={}) {
    const metadata = await probe(path.join(dir, source));
    if (kind === 'video' && !(metadata.duration > 0)) throw fail('无法识别视频时长。', 422);
    const data = { id, kind, name, source, metadata, candidates: [] };
    if (kind === 'video' && candidates) {
      for (let i = 0; i < 12; i++) {
        const last=i===11;
        const time=last?metadata.lastFrameTime:metadata.duration*(.03+i*.89/10);
        const file='candidate-'+i+'.jpg';
        const args=frameCommand({file:path.join(dir,source),target:path.join(dir,file),
          time,lastFrame:last,filter:'scale=640:640:force_original_aspect_ratio=decrease,setsar=1,format=yuvj420p'});
        args.splice(args.length-(last?4:1),0,'-q:v','3');
        await command('ffmpeg',args);
        data.candidates.push({time,url:'/media/'+id+'/'+file,lastFrame:last});
      }
    }
    await writeJSON(path.join(dir, 'session.json'), data, true);
    if (kind === 'video') {
      // Reuse immutable video bytes across sessions. Failure never loses an import.
      try { await deduplicateSessionSource({ workspace, sessionId: id }); }
      catch (error) { console.warn('会话视频复用失败，已保留完整独立副本：', error.message); }
    }
    return { ...data, sourceUrl: `/media/${id}/${source}` };
  }
  async function defaultVideos() {
    let entries;
    try { entries = await fs.readdir(defaultVideoDir, { withFileTypes: true }); }
    catch (e) {
      if (e.code === 'ENOENT') return { directory: defaultVideoDir, available: false, files: [] };
      throw e;
    }
    const files = [];
    for (const entry of entries) {
      if (!entry.isFile() || !/\.mp4$/i.test(entry.name)) continue;
      const file = path.join(defaultVideoDir, entry.name);
      const stat = await fs.stat(file);
      if (stat.size > 0 && stat.size <= 2 * 1024 ** 3) {
        files.push({ name: entry.name, bytes: stat.size, modified: stat.mtimeMs });
      }
    }
    files.sort((a, b) => b.modified - a.modified || a.name.localeCompare(b.name));
    return { directory: defaultVideoDir, available: true, files };
  }
  async function body(req) {
    const parts = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 10 * 1024 ** 2) throw fail('请求太大。', 413); parts.push(chunk); }
    try { return JSON.parse(Buffer.concat(parts).toString()); } catch { throw fail('无效 JSON。'); }
  }
  const respond = (res, data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
  async function sendFile(req, res, file, download = false) {
    const stat = await fs.stat(file);
    const headers = { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' };
    if (download) headers['Content-Disposition'] = `attachment; filename="${path.basename(file)}"`;
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if (range) {
      const start = Number(range[1]), end = Math.min(range[2] ? Number(range[2]) : stat.size - 1, stat.size - 1);
      if (start > end || start >= stat.size) { res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); res.end(); return; }
      res.writeHead(206, { ...headers, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${stat.size}` });
      await pipeline(createReadStream(file, { start, end }), res);
    } else { res.writeHead(200, headers); await pipeline(createReadStream(file), res); }
  }
  async function route(req, res) {
    if (req.headers.host !== `127.0.0.1:${port}`) throw fail('仅允许本地环回地址。', 403);
    const requestPath = new URL(req.url, origin).pathname;
    const previewOrigin = req.headers.origin;
    const allowedPreview = requestPath === '/api/preview-events' && req.method === 'GET'
      && ['http://127.0.0.1:5174','http://localhost:5174',
        process.env.COVER_STUDIO_PREVIEW_ORIGIN].includes(previewOrigin);
    if (req.headers.origin && req.headers.origin !== origin && !allowedPreview)
      throw fail('不接受其他网站的请求。', 403);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const url = new URL(req.url, origin), pathname = url.pathname;
    if (req.method === 'GET' && pathname === '/api/preview-events') {
      // No CORS wildcard: only the two explicitly permitted local Vite origins.
      if (req.headers.origin && !allowedPreview && req.headers.origin !== origin)
        throw fail('预览连接来源不被允许。',403);
      if (allowedPreview) res.setHeader('Access-Control-Allow-Origin',previewOrigin);
      res.writeHead(200,{
        'Content-Type':'text/event-stream; charset=utf-8',
        'Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no',
      });
      res.write('event: ready\ndata: {}\n\n');
      previewClients.add(res);
      const keepAlive = setInterval(() => {
        if (!res.destroyed) res.write(': heartbeat\n\n');
      },25000);
      req.on('close',()=>{clearInterval(keepAlive);previewClients.delete(res);});
      return;
    }
    if (req.method === 'GET' && pathname === '/favicon.ico') {
      res.writeHead(204);res.end();return;
    }
    if (req.method === 'GET' && pathname === '/api/bootstrap') {
      await command('ffmpeg', ['-version']); await command('ffprobe', ['-version']);
      const currentProjects=await projects();
      const orders=await readVersionOrders(projectRoot);
      const sortedList=list=>list.map(item=>({
        ...item, versions:orderVideoVersions(item.versions,orders[item.id]),
      }));
      respond(res, {
        token, projects: currentProjects, overrides: await readJSON(mappingFile, {}), workspace,
        managedProjects: sortedList(await listManagedVersions(projectRoot,currentProjects)),
        posterVersions: sortedList(await listPosterVersions(projectRoot,currentProjects)),
        archived: archiveItems(await readArchive(projectRoot)),
        ordering: await describeProjectOrder({ projectRoot, projects: currentProjects }),
      }); return;
    }
    if (req.method === 'GET' && pathname === '/api/local-videos') {
      respond(res, await defaultVideos()); return;
    }
    if (req.method === 'GET' && pathname.startsWith('/media/')) {
      const [, , id, file] = pathname.split('/');
      if (!uuid(id) || !/^(source\.(mp4|png|jpe?g|webp)|frame-[a-f0-9-]+\.png|candidate-\d+\.jpg)$/.test(file || '')) throw fail('无效素材路径。');
      await sendFile(req, res, path.join(sessionsDir, id, file)); return;
    }
    if (req.method === 'GET' && pathname.startsWith('/export/')) {
      const id = pathname.split('/')[2]; if (!uuid(id)) throw fail('无效导出。');
      await sendFile(req, res, path.join(exportsDir, `${id}${url.searchParams.has('poster') ? '-poster' : ''}.webp`), url.searchParams.has('download')); return;
    }
    if (req.method === 'GET' && pathname.startsWith('/project-video/')) {
      const chunks=pathname.split('/');
      if(chunks.length!==4)throw fail('需要指定作品和视频版本。',422);
      const {file}=await currentVideo({root:projectRoot,projects:await projects(),
        projectId:decodeURIComponent(chunks[2]),variantId:decodeURIComponent(chunks[3])});
      // Serve the already-validated local MP4 with HTTP Range support so
      // playback/scrubbing never transcodes or requests the ImageKit CDN.
      await sendFile(req,res,file);return;
    }
    if (req.method === 'GET' && pathname === '/api/artwork-history') {
      const kind=url.searchParams.get('kind');
      const projectId=url.searchParams.get('projectId');
      const variantId=url.searchParams.get('variantId')||'main';
      respond(res,await listArtworkHistory({root:projectRoot,workspace,
        projects:await projects(),kind,projectId,variantId}));return;
    }
    if (req.method === 'GET' && pathname.startsWith('/artwork-history-image/')) {
      const chunks=pathname.split('/');
      if(chunks.length!==5)throw fail('历史封面路径不合法。',422);
      const file=await artworkHistoryImage({root:projectRoot,workspace,
        projects:await projects(),kind:chunks[2],
        projectId:decodeURIComponent(chunks[3]),revisionId:chunks[4],
        variantId:url.searchParams.get('variant')||'main'});
      await sendFile(req,res,file);return;
    }
    if (req.method === 'GET' && pathname.startsWith('/project-poster/')) {
      const chunks=pathname.split('/');
      if(chunks.length!==4)throw fail('需要指定作品和视频版本。');
      const {file}=await currentPoster({root:projectRoot,projects:await projects(),
        projectId:decodeURIComponent(chunks[2]),variantId:decodeURIComponent(chunks[3])});
      // Only artwork GETs use short private caching. Versioned URLs are
      // invalidated after a successful save or restore in the workbench.
      res.setHeader('Cache-Control','private, max-age=600');
      await sendFile(req,res,file);return;
    }
    if (req.method === 'GET' && pathname.startsWith('/archived-cover/')) {
      const id=decodeURIComponent(pathname.slice('/archived-cover/'.length));
      const archived=await readArchive(projectRoot);
      if(!archived.works[id])throw fail('该作品不在回收站。',404);
      const [overrides,created]=await Promise.all([
        readJSON(mappingFile,{}),readJSON(path.join(projectRoot,'src/data/auto-projects.json'),[]),
      ]);
      const rel=overrides[id]||created.find(p=>p.id===id)?.coverFile;
      if(!rel||!/^(commercial|short-film|social|visual)\/[^/]+\.webp$/.test(rel)||rel.includes('..'))
        throw fail('回收站作品封面不合法。',422);
      const root=path.join(projectRoot,'assets/images/project-covers');
      const file=await fs.realpath(path.join(root,rel));
      if(!file.startsWith(root+path.sep))throw fail('回收站封面路径越界。',403);
      res.setHeader('Cache-Control','private, max-age=120');
      await sendFile(req,res,file);return;
    }
    if (req.method === 'GET' && pathname.startsWith('/project-cover/')) {
      const p = (await projects()).find(p => p.id === pathname.split('/')[2]);
      if (!p) throw fail('作品不存在。', 404);
      const file = await fs.realpath(path.resolve(projectRoot, `.${decodeURIComponent(p.cover.split('?')[0])}`));
      if (!file.startsWith(path.join(projectRoot, 'assets/images/') )) throw fail('无效封面路径。', 403);
      res.setHeader('Cache-Control','private, max-age=600');
      await sendFile(req, res, file); return;
    }
    if (req.method === 'GET') {
      const filename = { '/': 'index.html', '/app.js': 'app.js',
        '/imagekit-url.js': 'imagekit-url.js',
        '/library-ui.js': 'library-ui.js',
        '/library-cover-editor.js': 'library-cover-editor.js',
        '/library-player.js': 'library-player.js',
        '/library-history.js': 'library-history.js', '/style.css': 'style.css',
        '/workbench-enhancements.css': 'workbench-enhancements.css' }[pathname];
      if (!filename) throw fail('页面不存在。', 404);
      await sendFile(req, res, path.join(TOOL_DIR, filename)); return;
    }
    if (req.method !== 'POST' || req.headers['x-cover-token'] !== token) throw fail('请从本地封面工具提交操作。', 403);
    if (busy) throw fail('正在处理上一个操作，请稍后再试。', 409);
    busy = true;
    try {
      if (pathname === '/api/import') {
        const kind = url.searchParams.get('kind'), name = url.searchParams.get('name') || 'untitled';
        if (!['video', 'image'].includes(kind)) throw fail('请选择视频或图片。');
        if (kind === 'video' && !/\.mp4$/i.test(name)) throw fail('请选择 MP4 视频。');
        if (kind === 'image' && !/\.(png|jpe?g|webp)$/i.test(name)) throw fail('图片支持 PNG、JPEG、WebP。');
        const id = randomUUID(), dir = path.join(sessionsDir, id); await fs.mkdir(dir);
        const source = kind === 'video' ? 'source.mp4' : `source${path.extname(name).toLowerCase()}`;
        let size = 0;
        const limit = new Transform({ transform(chunk, enc, cb) { size += chunk.length; cb(size > 2 * 1024 ** 3 ? fail('单文件限制 2GB。', 413) : null, chunk); } });
        await pipeline(req, limit, (await import('node:fs')).createWriteStream(path.join(dir, source), { flags: 'wx' }));
        respond(res, await finishImport(id, dir, kind, path.basename(name), source,
          {candidates:url.searchParams.get('candidates')!=='0'})); return;
      }
      const input = await body(req);
      if (pathname === '/api/import-local') {
        const name = input.name;
        if (typeof name !== 'string' || name.length > 260 || !/\.mp4$/i.test(name) ||
            name !== path.basename(name) || name === '.' || name === '..' || name.includes('\\') || name.includes('/')) {
          throw fail('请从默认文件夹选择一个合法的 MP4。');
        }
        const file = path.join(defaultVideoDir, name);
        const stat = await fs.lstat(file);
        if (!stat.isFile() || stat.size <= 0 || stat.size > 2 * 1024 ** 3) throw fail('文件无效或超过 2GB。');
        const id = randomUUID(), dir = path.join(sessionsDir, id);
        await fs.mkdir(dir);
        await fs.copyFile(file, path.join(dir, 'source.mp4'), constants.COPYFILE_EXCL | constants.COPYFILE_FICLONE);
        respond(res, await finishImport(id, dir, 'video', name, 'source.mp4',
          {candidates:input.candidates!==false})); return;
      }
      if (pathname === '/api/import-project-video') {
        const projectId=String(input.projectId||''),variantId=String(input.variantId||'main');
        const {file}=await currentVideo({root:projectRoot,projects:await projects(),projectId,variantId});
        const id=randomUUID(),dir=path.join(sessionsDir,id);
        await fs.mkdir(dir);
        try {
          await fs.copyFile(file,path.join(dir,'source.mp4'),constants.COPYFILE_FICLONE);
          const details=await finishImport(id,dir,'video',path.basename(file),'source.mp4',
            {candidates:false});
          const sessionFile=path.join(dir,'session.json');
          const state=await readJSON(sessionFile);
          state.boundProjectId=projectId;state.boundVariantId=variantId;
          await writeJSON(sessionFile,state);
          // The workbench does not perform random or evenly spaced sampling.
          // Precise frame extraction happens only on an explicit user action.
          respond(res,{...details,boundProjectId:projectId,
            boundVariantId:variantId});return;
        }catch(error){await fs.rm(dir,{recursive:true,force:true});throw error;}
      }
      if (pathname === '/api/frame') {
        const { dir, data } = await session(input.sessionId);
        const isLast=data.kind==='video'&&input.lastFrame===true;
        const time=isLast?data.metadata.lastFrameTime:Number(input.time);
        if(!Number.isFinite(time)||time<0||(data.kind==='video'&&time>=data.metadata.duration))
          throw fail('时间点超出视频范围。');
        const frameId=randomUUID(),file='frame-'+frameId+'.png';
        const args=data.kind==='video'
          ?frameCommand({file:path.join(dir,data.source),target:path.join(dir,file),time,lastFrame:isLast})
          :['-v','error','-nostdin','-i',path.join(dir,data.source),'-frames:v','1',
            '-vf','scale=ceil(iw*sar):ih,setsar=1',path.join(dir,file)];
        await command('ffmpeg',args);
        const metadata=await probe(path.join(dir,file));
        respond(res,{frameId,time,width:metadata.width,height:metadata.height,
          lastFrame:isLast,url:'/media/'+data.id+'/'+file});return;
      }
      if (pathname === '/api/export') {
        if (input.confirmed !== true) throw fail('需要先确认使用此封面。');
        const { dir, data } = await session(input.sessionId);
        if (!uuid(input.frameId)) throw fail('请先选择画面。');
        const x = Number(input.x), y = Number(input.y);
        if (![x, y].every(v => Number.isFinite(v) && v >= 0 && v <= 1) || !['cover', 'contain-blur'].includes(input.mode)) throw fail('无效裁切参数。');
        const frame = path.join(dir, `frame-${input.frameId}.png`), id = randomUUID();
        await fs.access(frame);
        if (typeof input.previewPng !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(input.previewPng)) throw fail('请从实际裁切预览确认导出。');
        // Encode the exact 900x1200 canvas pixels shown to the user, avoiding
        // crop/blur discrepancies between a browser preview and a second renderer.
        const draft = path.join(exportsDir, `${id}-preview.png`);
        await fs.writeFile(draft, Buffer.from(input.previewPng.split(',')[1], 'base64'), { flag: 'wx' });
        const draftInfo = await probe(draft);
        if (draftInfo.width !== 900 || draftInfo.height !== 1200) throw fail('预览必须是 900 × 1200。');
        const file = path.join(exportsDir, `${id}.webp`);
        await command('ffmpeg', ['-v', 'error', '-nostdin', '-i', draft, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '90', '-compression_level', '6', file]);
        const info = await probe(file); if (info.width !== 900 || info.height !== 1200) throw fail('导出尺寸校验失败。', 500);
        // One confirmed selection produces both formats. The player poster
        // retains the original framing (no 3:4 crop or blur).
        let poster = null;
        if (data.kind === 'video' || data.kind === 'image') {
          const time = Number(input.time);
          if (data.kind === 'video' && (!Number.isFinite(time) || time < 0 || time >= data.metadata.duration)) throw fail('海报选帧时间不合法。');
          poster = path.join(exportsDir, `${id}-poster.webp`);
          // Use the EXACT decoded frame already shown in both preview tabs.
          // /api/frame normalizes sample-aspect-ratio to square pixels. Seeking
          // the video again could land on a different frame or wrong geometry.
          let posterSource=frame;
          if(input.customPosterPng!=null){
            if(data.kind!=='video'||typeof input.customPosterPng!=='string'||
               !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(input.customPosterPng)||
               input.customPosterPng.length>7*1024*1024)throw fail('自定义海报数据不合法。');
            posterSource=path.join(exportsDir,`${id}-custom-poster.jpg`);
            await fs.writeFile(posterSource,Buffer.from(input.customPosterPng.split(',')[1],'base64'),{flag:'wx'});
            const sourceInfo=await probe(posterSource),frameInfo=await probe(frame);
            if(!sourceInfo.width||!sourceInfo.height||
               Math.abs(sourceInfo.width/sourceInfo.height-frameInfo.width/frameInfo.height)>.018)
              throw fail('播放器海报与视频比例不符。');
          }
          await command('ffmpeg', ['-v', 'error', '-nostdin', '-i', posterSource,
            '-frames:v', '1', '-vf', 'scale=1280:1280:force_original_aspect_ratio=decrease,setsar=1',
            '-c:v', 'libwebp', '-quality', '85', poster]);
        }
        const { previewPng, ...parameters } = input;
        await writeJSON(path.join(exportsDir, `${id}.json`), { id, ...parameters, sourceName: data.name, createdAt: new Date().toISOString() }, true);
        respond(res, { id, path: file, url: `/export/${id}`, downloadUrl: `/export/${id}?download=1`, bytes: (await fs.stat(file)).size,
          posterUrl: poster ? `/export/${id}?poster=1` : null, posterPath: poster }); return;
      }
      if (pathname === '/api/save-order') {
        const result = await saveProjectOrder({
          projectRoot, workspace, projects: await projects(),
          scope: input.scope, ids: input.ids, expected: input.expected, confirmed: input.confirmed,
        });
        respond(res, result);
        announcePreview('reload');return;
      }
      if (pathname === '/api/save-version-order') {
        const active=await projects();
        const updated=await saveVersionOrder({
          projectRoot,workspace,projects:active,
          managed:await listManagedVersions(projectRoot,active),
          projectId:String(input.projectId||''),ids:input.ids,
          expected:input.expected,confirmed:input.confirmed,
        });
        respond(res,updated);
        if(updated.changed)announcePreview('reload',input.projectId);
        return;
      }
      if (pathname === '/api/archive-item'||pathname === '/api/restore-item') {
        const active=await projects(),archive=await readArchive(projectRoot);
        const currentOrder=await describeProjectOrder({projectRoot,projects:active});
        const result=await updateArchive({
          projectRoot,workspace,scope:input.scope,
          action:pathname==='/api/archive-item'?'archive':'restore',
          projectId:String(input.projectId||''),variantId:String(input.variantId||''),
          confirmed:input.confirmed,confirmPhrase:input.confirmPhrase,
          projects:active,managed:await listManagedVersions(projectRoot,active),
          featured:currentOrder.featured,
        });
        // Data modules must be refreshed before a subsequent bootstrap request.
        vite.moduleGraph.invalidateAll();
        respond(res,result);announcePreview('reload',input.projectId);return;
      }
      if (pathname === '/api/update-title') {
        const updated=await saveProjectTitle({
          projectRoot, workspace, projects: await projects(), id: input.id,
          titleZh: input.titleZh, titleEn: input.titleEn,
          expectedZh: input.expectedZh, expectedEn: input.expectedEn,
          confirmed: input.confirmed,
        });
        respond(res,updated);
        announcePreview('reload',input.id);
        return;
      }
      if (pathname === '/api/create-project') {
        const result = await createNewCoverStudioProject({
          projectRoot, workspace, sessionsDir, exportsDir, input, existingProjects: await projects(),
        });
        respond(res, { ...result, projects: await projects() });
        announcePreview('reload');return;
      }
      if (pathname === '/api/add-version') {
        if (input.confirmed !== true || !uuid(input.sessionId)) throw fail('请先导入视频并确认添加。');
        const { dir, data } = await session(input.sessionId);
        if (data.kind !== 'video') throw fail('视频版本必须由 MP4 创建。');
        const time = Number(input.time);
        if (!Number.isFinite(time) || time < 0 || time >= data.metadata.duration) throw fail('请指定有效的海报时间点。');
        const draft = path.join(exportsDir, `${randomUUID()}-version-poster.webp`);
        await command('ffmpeg', ['-v','error','-nostdin','-ss',String(time),'-i',path.join(dir,data.source),
          '-frames:v','1','-vf','scale=ceil(iw*sar):ih,setsar=1,scale=1280:1280:force_original_aspect_ratio=decrease,setsar=1',
          '-c:v','libwebp','-quality','85',draft]);
        try {
          const result = await appendVideoVersion({
            projectRoot, workspace, sessionsDir, posterSource: draft,
            sessionId: input.sessionId, projectId: input.projectId, time,
            labelZh: input.labelZh, labelEn: input.labelEn, confirmed:true,
            existingProjects:await projects(),
          });
          respond(res, result);
          announcePreview('reload');return;
        } finally { await fs.rm(draft,{force:true}); }
      }
      if (pathname === '/api/update-version-label') {
        const updated=await updateVideoVersionLabel({
          projectRoot,workspace,projectId:String(input.projectId||''),variantId:String(input.variantId||'main'),
          labelZh:input.labelZh,labelEn:input.labelEn,expectedLabel:input.expectedLabel,
          confirmed:input.confirmed,existingProjects:await projects(),
        });
        respond(res,updated);
        announcePreview('reload',input.projectId);
        return;
      }
      if (pathname === '/api/bind-imagekit') {
        const bound=await bindImageKitUrl({
          projectRoot, workspace, projectId: input.projectId, variantId: input.variantId,
          url: input.url, expectedUrl: input.expectedUrl, confirmed: input.confirmed,
        });
        respond(res,bound);
        announcePreview('reload');return;
      }
      if (pathname === '/api/restore-artwork') {
        const restored=await restoreArtwork({root:projectRoot,workspace,
          projects:await projects(),probe,
          kind:input.kind,projectId:input.projectId,variantId:input.variantId||'main',
          revisionId:input.revisionId,expectedHash:input.expectedHash,confirmed:input.confirmed,
        });
        respond(res,restored);
        announcePreview(input.kind,input.projectId,input.variantId||'main');
        return;
      }
      if (pathname === '/api/associate-poster') {
        const outcome=await replacePoster({
          root:projectRoot,workspace,projects:await projects(),exportsDir,sessionsDir,probe,
          projectId:input.projectId,variantId:input.variantId,
          exportId:input.exportId,expectedPoster:input.expectedPoster,
          expectedTime:input.expectedTime,confirmed:input.confirmed,
        });
        await pruneArtworkHistory({workspace,kind:'poster',projectId:input.projectId,variantId:input.variantId||'main'});
        respond(res,outcome);
        announcePreview('poster',input.projectId,input.variantId||'main');
        return;
      }
      if (pathname === '/api/associate') {
        if (input.confirmed !== true || input.replaceExisting !== true) throw fail('请明确确认关联或替换。');
        if (!uuid(input.exportId)) throw fail('请先确认导出封面。');
        const project = (await projects()).find(p => p.id === input.projectId);
        if (!project) throw fail('请先在作品数据中登记该作品。');
        if (!/^[A-Za-z0-9_-]+$/.test(project.id)) throw fail('作品 ID 请使用字母、数字、短横线或下划线。');
        await fs.access(path.join(exportsDir, `${input.exportId}.json`));
        const previous = await readJSON(mappingFile, {});
        if ((previous[project.id] || null) !== (input.expectedCover || null)) throw fail('该作品封面已被其他操作更新，请刷新后再确认。', 409);
        // Active card covers are always stored under their stable category and
        // exact English title, with no UUIDs visible in Finder.
        const filename = artworkPath(project.category, project.titleEn);
        const directory = path.join(projectRoot, 'assets/images/project-covers', project.category);
        const target = path.join(projectRoot, 'assets/images/project-covers', filename);
        const source = path.join(exportsDir, `${input.exportId}.webp`);
        const oldFile = previous[project.id];
        const historyDir = path.join(workspace, 'project-revisions', 'cover-history', project.id);
        await fs.mkdir(directory, { recursive: true });
        await fs.mkdir(historyDir, { recursive: true });
        const revisionId = randomUUID();
        const backup = path.join(historyDir, `${revisionId}-previous.webp`);
        let hasOld = false;
        try {
          await fs.copyFile(target, backup);
          hasOld = true;
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
          const original=path.resolve(projectRoot,'.'+decodeURIComponent(String(project.cover).split('?')[0]));
          const allowed=path.join(projectRoot,'assets/images/project-covers')+path.sep;
          if(!original.startsWith(allowed)||await fs.realpath(original)!==original)
            throw fail('首次替换封面时无法安全备份原图。',422);
          const stat=await fs.lstat(original);
          if(!stat.isFile()||stat.size===0)throw fail('原始封面文件无效。',422);
          await fs.copyFile(original,backup);
          hasOld=true;
        }
        const temp = target + '.' + revisionId + '.tmp';
        const next = { ...previous, [project.id]: filename };
        try {
          await fs.copyFile(source, temp, constants.COPYFILE_EXCL);
          await fs.rename(temp, target);
          await writeJSON(path.join(historyDir, revisionId + '.json'), {
            at: new Date().toISOString(), action: 'replace-card-cover',
            projectId: project.id, previousCover: oldFile || null, nextCover: filename,
            previousFileBackup: hasOld ? backup : null,
            videoAndPlayerPosterUnchanged: true,
          }, true);
          const configTemp = mappingFile + '.' + revisionId + '.tmp';
          await writeJSON(configTemp, next, true);
          await fs.rename(configTemp, mappingFile);
        } catch (error) {
          await fs.rm(temp, { force: true });
          if (hasOld) await fs.copyFile(backup, target);
          else await fs.rm(target, { force: true });
          throw error;
        }
        await pruneArtworkHistory({workspace,kind:'cover',projectId:project.id});
        respond(res,{projectId:project.id,path:target,projects:await projects(),overrides:next});
        announcePreview('cover',project.id);
        return;
      }
      throw fail('接口不存在。', 404);
    } finally { busy = false; }
  }
  // Existing historical backups are trimmed to the user's requested limit
  // at startup. This only deletes validated snapshot/JSON pairs, not videos.
  await pruneAllArtworkHistory({workspace});
  const server = http.createServer((req, res) => route(req, res).catch(e => {
    if (!res.headersSent) respond(res, { error: e.code === 'ENOENT' ? '文件不存在，请重新导入或刷新。' : e.message }, e.status || 500);
    else res.destroy();
  }));
  server.requestTimeout = 15 * 60 * 1000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { server, url: origin, close: async () => {
    for (const client of previewClients) client.end();
    await new Promise(resolve => server.close(resolve));
    await vite.close();
  } };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = await createCoverStudio({ port: Number(process.env.COVER_STUDIO_PORT || 5190) });
  console.log(`封面工具：${app.url}\n仅本地运行，关闭此终端进程即可停止。`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); process.exit(0); });
}
