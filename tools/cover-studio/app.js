const $ = id => document.getElementById(id);
const state = { token: '', session: null, frame: null, image: null, mode: 'cover', x: .5, y: .5, exported: null, projects: [], overrides: {}, busy: false };
const timeLabel = time => `${String(Math.floor(time / 60)).padStart(2, '0')}:${(time % 60).toFixed(3).padStart(6, '0')}`;
function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
function syncButtons() {
  document.querySelectorAll('button,input,select').forEach(e => { e.disabled = state.busy; });
  $('export-cover').disabled = state.busy || !state.frame;
  const project = state.projects.find(p => p.id === $('project-select').value);
  $('associate-cover').disabled = state.busy || !state.exported || !project || project.featured || !$('replace-consent').checked;
  if (!state.session || state.session.kind !== 'video') document.querySelectorAll('#timeline input,#timeline button').forEach(e => { e.disabled = true; });
}
async function action(fn) {
  if (state.busy) return;
  state.busy = true; syncButtons();
  try { await fn(); } catch (e) { status(e.message, true); }
  finally { state.busy = false; syncButtons(); }
}
async function api(path, data) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Cover-Token': state.token }, body: JSON.stringify(data) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error || '处理失败'); return result;
}
async function bootstrap() {
  const response = await fetch('/api/bootstrap'); const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  state.token = data.token; state.projects = data.projects; state.overrides = data.overrides || {};
  const selected = $('project-select').value;
  $('project-select').replaceChildren(new Option('暂不关联 / 先导出文件', ''));
  data.projects.forEach(p => {
    const option = new Option(`${p.id} · ${p.title}${p.featured ? '（精选保护）' : ''}`, p.id);
    option.disabled = p.featured; $('project-select').append(option);
  });
  $('project-select').value = selected; showProject();
}
function invalidateExport() {
  state.exported = null; $('export-result').hidden = true; $('replace-consent').checked = false; syncButtons();
}
function geometry(mode) {
  const iw = state.image.naturalWidth, ih = state.image.naturalHeight;
  const factor = mode === 'cover' ? Math.max(900 / iw, 1200 / ih) : Math.min(900 / iw, 1200 / ih);
  const width = iw * factor, height = ih * factor;
  return { width, height, left: (900 - width) * state.x, top: (1200 - height) * state.y };
}
function draw() {
  const canvas = $('cover-preview'), ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, 900, 1200);
  if (!state.image) return;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 900, 1200);
  if (state.mode === 'contain-blur') {
    const bg = geometry('cover'); ctx.save(); ctx.filter = 'blur(28px)';
    // Extend the blurred layer beyond the canvas so transparent blur edges stay outside it.
    ctx.drawImage(state.image, bg.left - 84, bg.top - 84, bg.width + 168, bg.height + 168); ctx.restore();
  }
  const image = geometry(state.mode === 'cover' ? 'cover' : 'contain');
  ctx.drawImage(state.image, image.left, image.top, image.width, image.height);
  $('position-x').value = state.x; $('position-y').value = state.y;
}
function setPosition(x, y) {
  state.x = Math.max(0, Math.min(1, x)); state.y = Math.max(0, Math.min(1, y));
  invalidateExport(); draw();
}
async function selectFrame(time) {
  status('正在提取原尺寸画面…');
  const frame = await api('/api/frame', { sessionId: state.session.id, time });
  const image = new Image(); image.src = frame.url; await image.decode();
  state.frame = frame; state.image = image; state.x = state.y = .5; invalidateExport();
  $('preview-placeholder').hidden = true;
  $('frame-status').textContent = `${state.session.kind === 'video' ? timeLabel(time) : '导入图片'} · 原画面 ${frame.width} × ${frame.height} → 900 × 1200`;
  $('time-input').value = time.toFixed(3); $('time-range').value = time; $('time-label').textContent = timeLabel(time);
  document.querySelectorAll('.candidates button').forEach(b => b.setAttribute('aria-pressed', Math.abs(Number(b.dataset.time) - time) < .001 ? 'true' : 'false'));
  draw(); status('画面已选中。请调整构图；只有点击确认才会导出。');
}
function upload(file, kind) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/import?kind=${kind}&name=${encodeURIComponent(file.name)}`); xhr.setRequestHeader('X-Cover-Token', state.token);
    xhr.upload.onprogress = e => { if (e.lengthComputable) $('upload-progress').value = e.loaded / e.total * 100; };
    xhr.upload.onload = () => status(kind === 'video' ? '素材已复制到本地，FFmpeg 正在生成 12 张候选帧…' : '正在读取图片…');
    xhr.onload = () => { try { const result = JSON.parse(xhr.responseText); xhr.status < 300 ? resolve(result) : reject(new Error(result.error)); } catch { reject(new Error('无法读取本地工具返回的数据。')); } };
    xhr.onerror = () => reject(new Error('连接中断，请确认本地工具仍在运行。'));
    xhr.send(file);
  });
}
async function importMedia(file, kind) {
  if (!file) return;
  state.session = state.frame = state.image = null; invalidateExport(); draw();
  $('preview-placeholder').hidden = false; $('upload-progress').hidden = false; $('upload-progress').value = 0;
  $('candidate-grid').replaceChildren(); $('source-video').pause(); $('source-video').removeAttribute('src'); $('source-video').load(); $('source-video').hidden = true; $('timeline').hidden = true;
  status('正在复制素材到本地工作目录…');
  try {
    const session = await upload(file, kind); state.session = session;
    const m = session.metadata;
    $('metadata').textContent = `${session.name} · ${m.width} × ${m.height} · 比例 ${(m.width / m.height).toFixed(3)}${kind === 'video' ? ` · ${timeLabel(m.duration)} · ${m.fps.toFixed(2)} fps` : ''}`;
    if (kind === 'video') {
      $('timeline').hidden = false; $('source-video').hidden = false; $('source-video').src = session.sourceUrl;
      const max = Math.max(0, m.duration - 1 / m.fps);
      $('time-input').max = $('time-range').max = max; $('time-input').value = $('time-range').value = 0; $('time-label').textContent = timeLabel(0);
      for (const frame of session.candidates) {
        const button = document.createElement('button'); button.type = 'button'; button.dataset.time = frame.time; button.setAttribute('aria-pressed', 'false'); button.setAttribute('aria-label', `选择 ${timeLabel(frame.time)} 的画面`);
        const image = document.createElement('img'); image.src = frame.url; image.alt = `${timeLabel(frame.time)} 候选画面`;
        const label = document.createElement('span'); label.textContent = timeLabel(frame.time);
        button.append(image, label); button.addEventListener('click', () => action(() => selectFrame(frame.time))); $('candidate-grid').append(button);
      }
      status('12 张候选已生成。请自行选择画面，或输入其他时间点。');
    } else { $('candidate-grid').textContent = '使用导入图片，已跳过视频抽帧。'; await selectFrame(0); }
  } finally { $('upload-progress').hidden = true; }
}
for (const [id, kind] of [['video-file', 'video'], ['image-file', 'image']]) $(id).addEventListener('change', e => { const file = e.target.files[0]; action(() => importMedia(file, kind)); e.target.value = ''; });
function manualTime(value) { const max = Number($('time-range').max); return Math.max(0, Math.min(max, Number(value) || 0)); }
$('seek-frame').addEventListener('click', () => action(() => selectFrame(manualTime($('time-input').value))));
$('time-range').addEventListener('input', e => { $('time-input').value = Number(e.target.value).toFixed(3); $('time-label').textContent = timeLabel(Number(e.target.value)); });
$('time-range').addEventListener('change', e => action(() => selectFrame(manualTime(e.target.value))));
$('time-input').addEventListener('keydown', e => { if (e.key === 'Enter') action(() => selectFrame(manualTime(e.target.value))); });
for (const [id, direction] of [['prev-frame', -1], ['next-frame', 1]]) $(id).addEventListener('click', () => action(() => selectFrame(manualTime(Number($('time-input').value) + direction / state.session.metadata.fps))));
document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
  state.mode = button.dataset.mode; document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b === button))); invalidateExport(); draw();
}));
for (const axis of ['x', 'y']) $(`position-${axis}`).addEventListener('input', e => setPosition(axis === 'x' ? Number(e.target.value) : state.x, axis === 'y' ? Number(e.target.value) : state.y));
$('reset-position').addEventListener('click', () => setPosition(.5, .5));
let drag = null;
$('cover-preview').addEventListener('pointerdown', e => {
  if (!state.image || state.busy) return;
  e.currentTarget.setPointerCapture(e.pointerId); drag = { clientX: e.clientX, clientY: e.clientY, x: state.x, y: state.y }; e.currentTarget.classList.add('dragging');
});
$('cover-preview').addEventListener('pointermove', e => {
  if (!drag) return;
  const scale = 900 / e.currentTarget.getBoundingClientRect().width;
  const g = geometry(state.mode === 'cover' ? 'cover' : 'contain');
  const dx = 900 - g.width, dy = 1200 - g.height;
  setPosition(Math.abs(dx) > 1 ? drag.x + (e.clientX - drag.clientX) * scale / dx : drag.x, Math.abs(dy) > 1 ? drag.y + (e.clientY - drag.clientY) * scale / dy : drag.y);
});
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) $('cover-preview').addEventListener(event, () => { drag = null; $('cover-preview').classList.remove('dragging'); });
$('cover-preview').addEventListener('keydown', e => { const move = { ArrowLeft: [-.02, 0], ArrowRight: [.02, 0], ArrowUp: [0, -.02], ArrowDown: [0, .02] }[e.key]; if (move && state.image && !state.busy) { e.preventDefault(); setPosition(state.x + move[0], state.y + move[1]); } });
$('export-cover').addEventListener('click', () => action(async () => {
  status('正在导出 900 × 1200 WebP…');
  const result = await api('/api/export', { sessionId: state.session.id, frameId: state.frame.frameId, time: state.frame.time, mode: state.mode, x: state.x, y: state.y, previewPng: $('cover-preview').toDataURL('image/png'), confirmed: true });
  state.exported = result; $('export-image').src = result.url; $('export-path').textContent = `${result.path} · ${(result.bytes / 1024).toFixed(0)} KB`;
  $('download-cover').href = result.downloadUrl; $('export-result').hidden = false;
  status('封面已导出，作品数据尚未改变。可下载或继续明确关联作品。');
}));
function showProject() {
  const project = state.projects.find(p => p.id === $('project-select').value);
  $('replace-consent').checked = false; $('association-detail').hidden = !project;
  if (project) { $('project-title').textContent = `${project.id} · ${project.title}`; $('current-cover').src = `/project-cover/${project.id}?v=${Date.now()}`; }
  syncButtons();
}
$('project-select').addEventListener('change', showProject);
$('replace-consent').addEventListener('change', syncButtons);
$('refresh-projects').addEventListener('click', () => action(async () => { await bootstrap(); status('作品列表已刷新。'); }));
$('associate-cover').addEventListener('click', () => action(async () => {
  const projectId = $('project-select').value;
  const result = await api('/api/associate', { projectId, exportId: state.exported.id, confirmed: true, replaceExisting: $('replace-consent').checked, expectedCover: state.overrides[projectId] || null });
  state.projects = result.projects; state.overrides = result.overrides; showProject();
  status(`已关联作品 ${projectId}。新封面：${result.path}。原封面保留，刷新作品库即可查看。`);
}));
action(async () => { await bootstrap(); status('本机 FFmpeg 已连接。请选择视频或图片开始。'); });
