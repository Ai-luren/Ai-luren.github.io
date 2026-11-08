import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { safeFileName, artworkPath } from './project-titles.mjs';
import { normalizeImageKitUrl } from './project-versions.mjs';

const CATEGORY_FOLDERS = Object.freeze({
  commercial: 'AI Commercials',
  'short-film': 'AI Short Flims', // Match the existing local archive spelling.
  social: 'AI Overseas Product Ads',
  visual: 'AI Visual Experiments',
});
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const json = value => JSON.stringify(value, null, 2) + '\n';
const readJSON = async file => JSON.parse(await fs.readFile(file, 'utf8'));

function cleanTitle(value, label) {
  const title = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!title || title.length > 80 || /[\x00-\x1f\x7f<>]/.test(title)) {
    throw fail(`${label}不能为空、不能超过 80 字，也不能包含控制字符或尖括号。`);
  }
  return title;
}

async function atomicWrite(file, value) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, json(value), { flag: 'wx' });
    await fs.rename(temporary, file);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

/**
 * An explicitly confirmed new-work transaction. It never changes the existing
 * 15 hand-curated entries and never uploads video to an external service.
 */
export async function createNewCoverStudioProject({
  projectRoot, workspace, sessionsDir, exportsDir, input, existingProjects,
}) {
  if (input.confirmed !== true) throw fail('请先明确确认新增作品。');
  const titleZh = cleanTitle(input.titleZh, '中文标题');
  const titleEn = cleanTitle(input.titleEn, '英文标题');
  // Optional existing ImageKit MP4 is validated before any local files are
  // created. The new-work transaction saves it with the project atomically.
  const videoUrl = String(input.imagekitUrl || '').trim()
    ? normalizeImageKitUrl(input.imagekitUrl) : null;
  const folder = CATEGORY_FOLDERS[input.category];
  if (!folder) throw fail('请选择有效的作品分类。');
  if (!/^[a-f0-9-]{36}$/.test(input.sessionId || '') || !/^[a-f0-9-]{36}$/.test(input.exportId || '')) {
    throw fail('请先导入视频并确认封面。');
  }
  if (existingProjects.some(p => p.title === titleZh)) throw fail('已有同名作品，请修改标题或使用关联已有作品。', 409);

  const session = await readJSON(path.join(sessionsDir, input.sessionId, 'session.json'));
  const exportRecord = await readJSON(path.join(exportsDir, `${input.exportId}.json`));
  if (session.kind !== 'video' || exportRecord.sessionId !== input.sessionId) {
    throw fail('新增作品需要本次视频的已确认封面，不能使用图片或其他会话的导出。');
  }
  const originalVideo = path.join(sessionsDir, input.sessionId, session.source);
  const originalCover = path.join(exportsDir, `${input.exportId}.webp`);
  const originalPoster = path.join(exportsDir, `${input.exportId}-poster.webp`);
  await Promise.all([fs.access(originalVideo), fs.access(originalCover), fs.access(originalPoster)]);

  const dataFile = path.join(projectRoot, 'src/data/auto-projects.json');
  const videoMetadataFile = path.join(projectRoot, 'src/data/project-video-metadata.json');
  const autoProjects = await readJSON(dataFile), videoMetadata = await readJSON(videoMetadataFile);
  if (!Array.isArray(autoProjects)) throw fail('自动作品数据格式错误。', 500);
  const ids = existingProjects.map(p => Number(p.id)).filter(Number.isSafeInteger);
  const id = String(Math.max(0, ...ids) + 1).padStart(2, '0');
  if (existingProjects.some(p => p.id === id) || autoProjects.some(p => p.id === id) || videoMetadata[id]) {
    throw fail('作品编号冲突，请刷新列表。', 409);
  }

  const uid = randomUUID();
  const videoFile = safeFileName(titleEn) + '.mp4';
  const coverFile = artworkPath(input.category, titleEn);
  const posterFile = artworkPath(input.category, titleEn);
  const localVideoPath = `${folder}/${videoFile}`;
  const destVideo = path.join(projectRoot, 'assets/videos/works', folder, videoFile);
  const destCover = path.join(projectRoot, 'assets/images/project-covers', coverFile);
  const destPoster = path.join(projectRoot, 'assets/images/player-posters', posterFile);

  const project = {
    id, category: input.category, featured: false,
    title: { zh: titleZh, en: titleEn },
    award: { zh: '', en: '' }, sourceUrl: null, caseStudy: null,
    localVideoPath, videoUrl, coverFile,
    mainVersionLabel: {
      zh: cleanTitle(input.mainVersionZh || '主版本', '主版本中文名称'),
      en: cleanTitle(input.mainVersionEn || 'Main version', '主版本英文名称'),
    },
  };
  const metadata = {
    videoWidth: session.metadata.width, videoHeight: session.metadata.height,
    playerPoster: posterFile, playerPosterTime: exportRecord.time,
    playerPosterTimeSource: 'cover-studio-confirmed-selection',
  };

  // A journal is retained locally so previous project data can be recovered.
  const historyDir = path.join(workspace, 'project-revisions');
  await fs.mkdir(historyDir, { recursive: true });
  const revision = path.join(historyDir, `${id}-${uid}.json`);
  await fs.writeFile(revision, json({
    createdAt: new Date().toISOString(), action: 'create-project',
    project, priorAutoProjects: autoProjects, priorVideoMetadata: videoMetadata,
    files: [destVideo, destCover, destPoster],
  }), { flag: 'wx' });

  const copied = [];
  try {
    for (const [source, destination] of [
      [originalVideo, destVideo], [originalCover, destCover], [originalPoster, destPoster],
    ]) {
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(source, destination, constants.COPYFILE_EXCL);
      copied.push(destination);
    }
    await atomicWrite(videoMetadataFile, { ...videoMetadata, [id]: metadata });
    await atomicWrite(dataFile, [...autoProjects, project]);
  } catch (error) {
    // Never leave an incomplete entry in the gallery.
    await atomicWrite(videoMetadataFile, videoMetadata);
    await atomicWrite(dataFile, autoProjects);
    await Promise.all(copied.map(file => fs.rm(file, { force: true })));
    throw error;
  }
  return {
    id, title: titleZh, category: input.category,
    videoPath: destVideo, coverPath: destCover, posterPath: destPoster,
    onlineVideoPending: !videoUrl, videoUrl, revision,
  };
}
