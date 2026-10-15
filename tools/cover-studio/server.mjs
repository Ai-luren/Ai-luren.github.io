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
  return { width, height, codedWidth: v.width, codedHeight: v.height, duration: Number(data.format.duration || v.duration || 0), fps: fraction(v.avg_frame_rate, 25), codec: v.codec_name };
}
const writeJSON = (file, value, exclusive = false) => fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { flag: exclusive ? 'wx' : 'w' });
const readJSON = async (file, fallback) => { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT' && fallback !== undefined) return fallback; throw e; } };

export async function createCoverStudio({ projectRoot = path.resolve(TOOL_DIR, '../..'), port = 5190 } = {}) {
  projectRoot = await fs.realpath(projectRoot);
  const workspace = path.join(projectRoot, '.cover-studio');
  const sessionsDir = path.join(workspace, 'sessions'), exportsDir = path.join(workspace, 'exports');
  const customDir = path.join(projectRoot, 'assets/images/project-covers/custom');
  const mappingFile = path.join(projectRoot, 'src/data/project-cover-overrides.json');
  await fs.mkdir(sessionsDir, { recursive: true });
  await fs.mkdir(exportsDir, { recursive: true });
  const token = randomBytes(24).toString('hex');
  const origin = `http://127.0.0.1:${port}`;
  const vite = await createViteServer({ configFile: false, root: projectRoot, server: { middlewareMode: true, watch: null, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' });
  let busy = false;
  async function projects() {
    vite.moduleGraph.invalidateAll();
    const { PROJECTS } = await vite.ssrLoadModule('/src/data/projects.js');
    return PROJECTS.map(p => ({ id: p.id, title: p.title.zh, featured: p.featured, cover: p.cover }));
  }
  async function session(id) {
    if (!uuid(id)) throw fail('无效会话。');
    const dir = path.join(sessionsDir, id);
    return { dir, data: await readJSON(path.join(dir, 'session.json')) };
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
    if (req.headers.origin && req.headers.origin !== origin) throw fail('不接受其他网站的请求。', 403);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; media-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const url = new URL(req.url, origin), pathname = url.pathname;
    if (req.method === 'GET' && pathname === '/api/bootstrap') {
      await command('ffmpeg', ['-version']); await command('ffprobe', ['-version']);
      respond(res, { token, projects: await projects(), overrides: await readJSON(mappingFile, {}), workspace }); return;
    }
    if (req.method === 'GET' && pathname.startsWith('/media/')) {
      const [, , id, file] = pathname.split('/');
      if (!uuid(id) || !/^(source\.(mp4|png|jpe?g|webp)|frame-[a-f0-9-]+\.png|candidate-\d+\.jpg)$/.test(file || '')) throw fail('无效素材路径。');
      await sendFile(req, res, path.join(sessionsDir, id, file)); return;
    }
    if (req.method === 'GET' && pathname.startsWith('/export/')) {
      const id = pathname.split('/')[2]; if (!uuid(id)) throw fail('无效导出。');
      await sendFile(req, res, path.join(exportsDir, `${id}.webp`), url.searchParams.has('download')); return;
    }
    if (req.method === 'GET' && pathname.startsWith('/project-cover/')) {
      const p = (await projects()).find(p => p.id === pathname.split('/')[2]);
      if (!p) throw fail('作品不存在。', 404);
      const file = await fs.realpath(path.resolve(projectRoot, `.${decodeURIComponent(p.cover.split('?')[0])}`));
      if (!file.startsWith(path.join(projectRoot, 'assets/images/') )) throw fail('无效封面路径。', 403);
      await sendFile(req, res, file); return;
    }
    if (req.method === 'GET') {
      const filename = { '/': 'index.html', '/app.js': 'app.js', '/style.css': 'style.css' }[pathname];
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
        const metadata = await probe(path.join(dir, source));
        if (kind === 'video' && !(metadata.duration > 0)) throw fail('无法识别视频时长。', 422);
        const data = { id, kind, name: path.basename(name), source, metadata, candidates: [] };
        if (kind === 'video') {
          for (let i = 0; i < 12; i++) {
            const time = metadata.duration * (.03 + i * .94 / 11), file = `candidate-${i}.jpg`;
            await command('ffmpeg', ['-v', 'error', '-nostdin', '-ss', String(time), '-i', path.join(dir, source), '-frames:v', '1', '-vf', 'scale=640:640:force_original_aspect_ratio=decrease,setsar=1', '-q:v', '3', path.join(dir, file)]);
            data.candidates.push({ time, url: `/media/${id}/${file}` });
          }
        }
        await writeJSON(path.join(dir, 'session.json'), data, true);
        respond(res, { ...data, sourceUrl: `/media/${id}/${source}` }); return;
      }
      const input = await body(req);
      if (pathname === '/api/frame') {
        const { dir, data } = await session(input.sessionId);
        const time = Number(input.time);
        if (!Number.isFinite(time) || time < 0 || (data.kind === 'video' && time >= data.metadata.duration)) throw fail('时间点超出视频范围。');
        const frameId = randomUUID(), file = `frame-${frameId}.png`;
        const args = ['-v', 'error', '-nostdin'];
        if (data.kind === 'video') args.push('-ss', String(time));
        args.push('-i', path.join(dir, data.source), '-frames:v', '1', '-vf', 'scale=ceil(iw*sar):ih,setsar=1', path.join(dir, file));
        await command('ffmpeg', args);
        const metadata = await probe(path.join(dir, file));
        respond(res, { frameId, time, width: metadata.width, height: metadata.height, url: `/media/${data.id}/${file}` }); return;
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
        const { previewPng, ...parameters } = input;
        await writeJSON(path.join(exportsDir, `${id}.json`), { id, ...parameters, sourceName: data.name, createdAt: new Date().toISOString() }, true);
        respond(res, { id, path: file, url: `/export/${id}`, downloadUrl: `/export/${id}?download=1`, bytes: (await fs.stat(file)).size }); return;
      }
      if (pathname === '/api/associate') {
        if (input.confirmed !== true || input.replaceExisting !== true) throw fail('请明确确认关联或替换。');
        if (!uuid(input.exportId)) throw fail('请先确认导出封面。');
        const project = (await projects()).find(p => p.id === input.projectId);
        if (!project) throw fail('请先在作品数据中登记该作品。');
        if (!/^[A-Za-z0-9_-]+$/.test(project.id)) throw fail('作品 ID 请使用字母、数字、短横线或下划线。');
        if (project.featured) throw fail('现有 8 件精选的封面处于保护状态，本轮不替换。', 403);
        await fs.access(path.join(exportsDir, `${input.exportId}.json`));
        const previous = await readJSON(mappingFile, {});
        if ((previous[project.id] || null) !== (input.expectedCover || null)) throw fail('该作品封面已被其他操作更新，请刷新后再确认。', 409);
        const file = `${project.id}-${input.exportId}.webp`, target = path.join(customDir, file);
        if (previous[project.id] === file) {
          respond(res, { projectId: project.id, path: target, projects: await projects(), overrides: previous }); return;
        }
        await fs.mkdir(customDir, { recursive: true });
        await fs.copyFile(path.join(exportsDir, `${input.exportId}.webp`), target, constants.COPYFILE_EXCL);
        const next = { ...previous, [project.id]: file };
        await writeJSON(path.join(workspace, `association-${randomUUID()}.json`), { projectId: project.id, previous, next, exportId: input.exportId, at: new Date().toISOString() }, true);
        const temp = `${mappingFile}.${randomUUID()}.tmp`;
        await writeJSON(temp, next, true); await fs.rename(temp, mappingFile);
        respond(res, { projectId: project.id, path: target, projects: await projects(), overrides: next }); return;
      }
      throw fail('接口不存在。', 404);
    } finally { busy = false; }
  }
  const server = http.createServer((req, res) => route(req, res).catch(e => {
    if (!res.headersSent) respond(res, { error: e.code === 'ENOENT' ? '文件不存在，请重新导入或刷新。' : e.message }, e.status || 500);
    else res.destroy();
  }));
  server.requestTimeout = 15 * 60 * 1000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { server, url: origin, close: async () => { await new Promise(resolve => server.close(resolve)); await vite.close(); } };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = await createCoverStudio({ port: Number(process.env.COVER_STUDIO_PORT || 5190) });
  console.log(`封面工具：${app.url}\n仅本地运行，关闭此终端进程即可停止。`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); process.exit(0); });
}
