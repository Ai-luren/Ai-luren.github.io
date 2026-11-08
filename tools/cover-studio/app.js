import { createLibraryUI } from './library-ui.js';
const $ = id => document.getElementById(id);
const IMAGEKIT_URL_PREFIX = 'https://ik.imagekit.io/Ailuren/tr:orig-true/videos/';
const state = { token: '', session: null, frame: null, image: null, mode: 'cover', x: .5, y: .5, exported: null, created: null, projects: [], overrides: {}, managed: [], variantAddedSession: null, workflow: 'new', initialized: false, ordering: null, orderDraft: null, orderBaseline: null, orderScope: 'featured', orderCategory: 'commercial', featuredPoolCategory: 'commercial', featuredSwapTarget: null, featuredCandidate: null, previewView: 'cover', posterVersions: [], libraryReturnTarget: null, libraryReturnVariant: 'main', busy: false };
let libraryUI=null;
let customNewCover=null,customNewCoverUrl=null,customNewPoster=null,customNewPosterUrl=null;
const timeLabel = time => `${String(Math.floor(time / 60)).padStart(2, '0')}:${(time % 60).toFixed(3).padStart(6, '0')}`;
function status(message, error = false) {
  $('status').textContent=message;$('status').classList.toggle('error',error);
  const modalStatus=$('ux-new-status');
  if(modalStatus&&!$('ux-new-editor').hidden){
    modalStatus.textContent=message;
    modalStatus.dataset.error=String(error);
  }
}
function syncButtons() {
  document.body.dataset.mediaStage = !state.session ? 'empty' : state.frame ? 'selected' : 'imported';
  // Legacy media actions and the New Work modal own these busy states.
  // Gallery, detail editor, history and nested dialogs manage their own states;
  // toggling them here can silently re-enable guarded controls.
  document.querySelectorAll('button,input,select').forEach(e => {
    if(e.closest('#ux-library,#ux-editor,#ux-history-dialog,#ux-feature-dialog,#ux-unsaved-dialog'))return;
    e.disabled = state.busy;
  });
  $('order-save').disabled = state.busy || !orderCanSave();
  $('order-reset').disabled = state.busy || !state.ordering || orderSame(state.orderDraft[state.orderScope],orderDefaultFor(state.orderScope));
  const posterChoice = state.posterVersions.find(p => p.id === $('project-select').value)?.versions.find(v=>v.id===$('poster-variant').value);
  const incompatibleSession = state.workflow==='poster' && state.session?.boundProjectId &&
    (state.session.boundProjectId!==$('project-select').value || state.session.boundVariantId!==$('poster-variant').value);
  const incompatibleRatio = state.workflow==='poster' && state.frame && posterChoice &&
    Math.abs(state.frame.width/state.frame.height-posterChoice.width/posterChoice.height)>.018;
  $('export-cover').disabled = state.busy || !state.frame || incompatibleSession || incompatibleRatio ||
    (['cover','poster'].includes(state.workflow) && !$('project-select').value);
  $('import-project-video').disabled = state.busy || !posterChoice;
  $('ux-quick-save').disabled = $('export-cover').disabled;
  $('import-local-video').disabled = state.busy || !$('local-video-select').value;
  $('ux-new-use-frame').disabled=state.busy||state.session?.kind!=='video';
  for(const id of ['ux-new-jog-first','ux-new-jog-prev','ux-new-jog-next','ux-new-jog-last'])
    $(id).disabled=state.busy||state.session?.kind!=='video';
  const newImagekitError=validateNewImagekitFilename();
  $('new-imagekit-url').setAttribute('aria-invalid',String(Boolean(newImagekitError)));
  $('ux-new-imagekit-error').hidden=!newImagekitError;
  $('ux-new-imagekit-error').textContent=newImagekitError||'';
  $('create-project').disabled = state.busy || !state.frame || state.session?.kind !== 'video' ||
    !!state.created || !$('new-title-zh').value.trim() || !$('new-title-en').value.trim() || !$('create-consent').checked || Boolean(newImagekitError);
  $('ux-new-save').disabled=$('create-project').disabled;
  const managed = state.managed.find(p => p.id === $('managed-project').value);
  $('start-add-version').disabled = state.busy || !managed || managed.legacy;
  $('start-cover-for-managed').disabled = state.busy || !managed;
  $('start-poster-for-managed').disabled = state.busy || !managed;
  $('start-imagekit').disabled = state.busy || !managed;
  const selected = managed?.versions.find(v => v.id === $('managed-variant').value);
  $('add-version').disabled = state.busy || !managed || managed.legacy || !state.frame || state.session?.kind !== 'video' ||
    state.variantAddedSession === state.session?.id || !$('variant-title-zh').value.trim() ||
    !$('variant-title-en').value.trim() || !$('variant-consent').checked;
  $('bind-imagekit').disabled = state.busy || !selected ||
    !$('imagekit-url').value.trim().startsWith(IMAGEKIT_URL_PREFIX) ||
    $('imagekit-url').value.trim() === IMAGEKIT_URL_PREFIX || !$('bind-consent').checked;
  const project = state.projects.find(p => p.id === $('project-select').value);
  $('associate-cover').disabled = state.busy || !state.exported || !project || !$('replace-consent').checked ||
    (state.workflow==='poster' && (!posterChoice || !state.exported.posterUrl || incompatibleSession || incompatibleRatio));
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
async function refreshLocalVideos() {
  const previous = $('local-video-select').value;
  const response = await fetch('/api/local-videos');
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '读取默认视频目录失败。');
  $('local-video-directory').textContent = result.directory;
  $('local-video-select').replaceChildren(new Option('请选择 MP4 视频…', ''));
  for (const video of result.files) {
    const megabytes = (video.bytes / 1048576).toFixed(1);
    $('local-video-select').append(new Option(`${video.name} (${megabytes} MB)`, video.name));
  }
  if (result.files.some(video => video.name === previous)) $('local-video-select').value = previous;
  $('local-video-hint').textContent = !result.available
    ? '默认目录不存在，请检查路径，或从其他位置选择 MP4。'
    : result.files.length ? `找到 ${result.files.length} 个 MP4，选择后点击「导入选中 MP4」。不会自动导入。`
      : '该目录目前没有可导入的 MP4。可刷新列表或从其他位置选择。';
  syncButtons();
}
async function bootstrap() {
  const response = await fetch('/api/bootstrap'); const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  state.token = data.token; state.projects = data.projects; state.overrides = data.overrides || {};
  state.managed = data.managedProjects || [];
  state.posterVersions = data.posterVersions || [];
  state.ordering = data.ordering;
  state.orderBaseline = {featured:[...data.ordering.featured],all:[...data.ordering.all]};
  state.orderDraft = {featured:[...data.ordering.featured],all:[...data.ordering.all]};
  renderOrder();
  const oldManaged = state.created?.id || $('managed-project').value || state.managed.findLast(p => !p.legacy)?.id || state.managed.at(-1)?.id || '';
  $('managed-project').replaceChildren(new Option('请选择作品', ''));
  for (const p of state.managed) $('managed-project').append(new Option(`${p.id} · ${p.title}${p.legacy ? '（原有作品）' : ''}`, p.id));
  $('managed-project').value = state.managed.some(p => p.id === oldManaged) ? oldManaged : '';
  showManaged(true);
  const selected = $('project-select').value;
  $('project-select').replaceChildren(new Option('暂不关联 / 先导出文件', ''));
  data.projects.forEach(p => {
    const option = new Option(`${p.id} · ${p.title}${p.featured ? ' · 首页精选' : ''}`, p.id);
    $('project-select').append(option);
  });
  $('project-select').value = selected; showProject();
  await refreshLocalVideos();
  libraryUI?.refresh();
  if (!state.initialized) {
    state.initialized = true;
    setWorkflow('library');
  }
}
function invalidateExport() {
  state.exported = null; $('export-result').hidden = true; $('replace-consent').checked = false; updateCoverConfirm(); syncButtons();
}
function geometry(mode) {
  const iw = state.image.naturalWidth, ih = state.image.naturalHeight;
  const factor = mode === 'cover' ? Math.max(900 / iw, 1200 / ih) : Math.min(900 / iw, 1200 / ih);
  const width = iw * factor, height = ih * factor;
  return { width, height, left: (900 - width) * state.x, top: (1200 - height) * state.y };
}
function setPreviewView(view) {
  state.previewView = view === 'original' ? 'original' : 'cover';
  document.body.dataset.previewView = state.previewView;
  $('preview-wrap').dataset.preview = state.previewView;
  $('preview-wrap').style.aspectRatio = state.previewView === 'original' && state.frame
    ? state.frame.width + ' / ' + state.frame.height : '';
  document.querySelectorAll('[data-preview-view]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.previewView === state.previewView));
  });
  $('cover-preview').hidden = state.previewView !== 'cover';
  $('original-preview').hidden = state.previewView !== 'original' || !state.image;
  $('preview-help').textContent = state.workflow==='poster'
    ? '播放器海报使用此时刻的完整画面，不裁切成 3:4、不拉伸。确认后只更换选中的视频版本的静止海报。'
    : state.previewView === 'original'
      ? '此处仅预览原比例画面。替换 3:4 作品卡片封面，不会覆盖已有播放器海报。'
      : '拖动画面调整 3:4 卡片封面。播放器原比例海报由独立操作维护。';
  if (state.frame) $('frame-status').textContent = (state.session.kind === 'video' ? timeLabel(state.frame.time) : '导入图片') +
    ' · 原画面 ' + state.frame.width + ' × ' + state.frame.height +
    (state.previewView === 'original' ? ' · 原比例完整预览' : ' → 900 × 1200 · 3:4');
}
document.querySelectorAll('[data-preview-view]').forEach(button => button.addEventListener('click', () => setPreviewView(button.dataset.previewView)));
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
function updateNewPlayerPoster(frame=null){
  const image=$('ux-new-player-poster'),placeholder=$('ux-new-poster-placeholder'),
    ratio=$('ux-new-poster-ratio'),meta=$('ux-new-poster-meta');
  if(!frame||state.session?.kind!=='video'){
    image.hidden=true;image.removeAttribute('src');
    placeholder.hidden=false;ratio.textContent='原比例';
    meta.textContent='独立于 3:4 封面，不裁切、不拉伸';
    return;
  }
  image.src=customNewPosterUrl||frame.url;image.hidden=false;placeholder.hidden=true;
  ratio.textContent=frame.width+' × '+frame.height;
  meta.textContent=customNewPoster?'自定义播放器海报 · 原比例完整显示':'选帧 '+timeLabel(frame.time)+' · 完整画幅';
}
async function selectFrame(time) {
  status('正在提取原尺寸画面…');
  const frame = await api('/api/frame', { sessionId: state.session.id, time });
  const image = new Image(); image.src = frame.url; await image.decode();
  state.frame=frame;state.image=state.workflow==='new'&&customNewCover?customNewCover:image;
  state.x=state.y=.5;invalidateExport();
  $('preview-placeholder').hidden = true;
  $('original-preview').src = frame.url;
  updateNewPlayerPoster(frame);
  setPreviewView(state.previewView);
  $('time-input').value = time.toFixed(3); $('time-range').value = time; $('time-label').textContent = timeLabel(time);
  document.querySelectorAll('.candidates button').forEach(b => b.setAttribute('aria-pressed', Math.abs(Number(b.dataset.time) - time) < .001 ? 'true' : 'false'));
  draw();
  const choice=selectedPosterInfo();
  if(state.workflow==='poster' && choice && Math.abs(frame.width/frame.height-choice.width/choice.height)>.018) {
    status('画面比例与选定版本不一致。请从该视频版本选帧，或导入相同比例的图片。',true);
  } else {
    status(state.workflow==='poster'?'已选中原比例画面。核对无误后导出并对比旧海报。':'画面已选中。请调整构图；只有点击确认才会导出。');
  }
}
function upload(file, kind) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const extra=state.workflow==='new'?'&candidates=0':'';
    xhr.open('POST', `/api/import?kind=${kind}&name=${encodeURIComponent(file.name)}` + extra); xhr.setRequestHeader('X-Cover-Token', state.token);
    xhr.upload.onprogress = e => { if (e.lengthComputable) $('upload-progress').value = e.loaded / e.total * 100; };
    xhr.upload.onload = () => status(kind === 'video' ? '素材已复制到本地，正在读取视频信息…' : '正在读取图片…');
    xhr.onload = () => { try { const result = JSON.parse(xhr.responseText); xhr.status < 300 ? resolve(result) : reject(new Error(result.error)); } catch { reject(new Error('无法读取本地工具返回的数据。')); } };
    xhr.onerror = () => reject(new Error('连接中断，请确认本地工具仍在运行。'));
    xhr.send(file);
  });
}
function resetCurrentMedia({resetTitles = false} = {}) {
  if(customNewCoverUrl)URL.revokeObjectURL(customNewCoverUrl);
  customNewCoverUrl=null;customNewCover=null;
  if(customNewPosterUrl)URL.revokeObjectURL(customNewPosterUrl);
  customNewPosterUrl=null;customNewPoster=null;
  $('ux-new-poster-file').value='';
  $('ux-new-cover-file').value='';
  updateNewPlayerPoster();
  state.session = state.frame = state.image = null;
  state.created = null; state.variantAddedSession = null;
  $('create-consent').checked = true;
  $('ux-new-imagekit-copy').textContent='复制';
  $('variant-consent').checked = false;
  $('created-result').hidden = true;
  $('cover-confirm-result').hidden = true;
  $('preview-placeholder').hidden = false;
  $('original-preview').hidden = true;
  $('original-preview').removeAttribute('src');
  $('preview-wrap').style.aspectRatio = '';
  setPreviewView(state.workflow==='poster'?'original':'cover');
  $('upload-progress').hidden = true; $('upload-progress').value = 0;
  $('metadata').textContent = '尚未导入素材';
  $('candidate-grid').replaceChildren();
  $('source-video').pause();
  $('source-video').removeAttribute('src');
  $('source-video').load();
  $('source-video').hidden = true;
  $('timeline').hidden = true;
  if (resetTitles) {
    $('new-title-zh').value = '';
    $('new-title-en').value = '';
    $('new-imagekit-url').value = '';
  }
  invalidateExport();draw();
}
async function importMedia(file, kind, loader = null) {
  if (!file && !loader) return;
  resetCurrentMedia();
  $('upload-progress').hidden = false;
  status('正在复制素材到本地工作目录…');
  try {
    const session = loader ? await loader() : await upload(file, kind); state.session = session;
    if (kind === 'video' && !$('new-title-zh').value.trim()) {
      $('new-title-zh').value = session.name.replace(/\.mp4$/i, '').replace(/[-_]+/g, ' ').trim();
    }
    const m = session.metadata;
    $('metadata').textContent = `${session.name} · ${m.width} × ${m.height} · 比例 ${(m.width / m.height).toFixed(3)}${kind === 'video' ? ` · ${timeLabel(m.duration)} · ${m.fps.toFixed(2)} fps` : ''}`;
    if (kind === 'video') {
      $('timeline').hidden = false; $('source-video').hidden = false; $('source-video').src = session.sourceUrl;
      const max = Math.max(0, m.duration - 1 / m.fps);
      $('time-input').max = $('time-range').max = max; $('time-input').value = $('time-range').value = 0; $('time-label').textContent = timeLabel(0);
      if(state.workflow==='new'){
        $('timeline').querySelector('details').open=true;
        status('视频已载入。播放或拖动时间轴，再点击「使用当前画面」。');
      }else{
        for (const frame of session.candidates||[]) {
          const button = document.createElement('button'); button.type = 'button'; button.dataset.time = frame.time; button.setAttribute('aria-pressed', 'false'); button.setAttribute('aria-label', '选择画面');
          const image = document.createElement('img'); image.src = frame.url; image.alt = '候选画面';
          const label = document.createElement('span'); label.textContent = timeLabel(frame.time);
          button.append(image,label); button.addEventListener('click',()=>action(()=>selectFrame(frame.time))); $('candidate-grid').append(button);
        }
      }
    } else { $('candidate-grid').textContent = '使用导入图片，已跳过视频抽帧。'; await selectFrame(0); }
  } finally { $('upload-progress').hidden = true; }
}
const dropzone=$('ux-new-dropzone');
dropzone.addEventListener('click',()=>$('video-file').click());
dropzone.addEventListener('dragover',e=>{
  e.preventDefault();e.dataTransfer.dropEffect='copy';dropzone.dataset.dragover='true';
});
dropzone.addEventListener('dragleave',e=>{
  if(!dropzone.contains(e.relatedTarget))delete dropzone.dataset.dragover;
});
dropzone.addEventListener('drop',e=>{
  e.preventDefault();delete dropzone.dataset.dragover;
  const file=[...(e.dataTransfer?.files||[])].find(f=>/\.mp4$/i.test(f.name));
  if(file)action(()=>importMedia(file,'video'));
  else status('请拖入一个 MP4 视频文件。',true);
});
$('ux-new-cover-file').addEventListener('change',event=>{
  const file=event.target.files?.[0];event.target.value='';
  if(!file)return;
  if(!state.session||state.session.kind!=='video'){
    status('请先导入一条 MP4，然后再选择自定义封面。',true);return;
  }
  if(!/\.(png|jpe?g|webp)$/i.test(file.name)||file.size>25*1024*1024){
    status('封面只支持 25MB 以内的 PNG、JPEG、WebP。',true);return;
  }
  const url=URL.createObjectURL(file),image=new Image();
  image.onload=()=>{
    if(customNewCoverUrl)URL.revokeObjectURL(customNewCoverUrl);
    customNewCoverUrl=url;customNewCover=image;
    state.image=image;state.x=state.y=.5;
    invalidateExport();draw();
    $('preview-placeholder').hidden=true;
    setPreviewView('cover');
    status('已加载自定义 3:4 封面，播放器海报仍使用视频的选定画面。');
  };
  image.onerror=()=>{
    URL.revokeObjectURL(url);
    status('图片无法读取，请换一张有效的图片。',true);
  };
  image.src=url;
});
$('ux-new-poster-file').addEventListener('change',event=>{
  const file=event.target.files?.[0];event.target.value='';
  if(!file)return;
  if(!state.frame||state.session?.kind!=='video'){
    status('请先导入 MP4 并选择画面，再导入播放器海报。',true);return;
  }
  if(!/\.(png|jpe?g|webp)$/i.test(file.name)||file.size>25*1024*1024){
    status('播放器海报支持 25MB 以内的 PNG、JPEG、WebP。',true);return;
  }
  const url=URL.createObjectURL(file),image=new Image();
  image.onload=()=>{
    const expected=state.frame.width/state.frame.height,actual=image.naturalWidth/image.naturalHeight;
    if(Math.abs(expected-actual)>.018){
      URL.revokeObjectURL(url);status('播放器海报必须与视频画幅比例一致，不能强行拉伸。',true);return;
    }
    if(customNewPosterUrl)URL.revokeObjectURL(customNewPosterUrl);
    customNewPosterUrl=url;customNewPoster=image;
    invalidateExport();updateNewPlayerPoster(state.frame);
    status('已导入自定义播放器海报；3:4 卡片封面保持不变。');
  };
  image.onerror=()=>{URL.revokeObjectURL(url);status('无法读取海报图片。',true);};
  image.src=url;
});
function jogNewFrame(operation){
  if(state.busy||!state.session||state.session.kind!=='video')return;
  const v=$('source-video'),fps=Math.max(1,Number(state.session.metadata.fps)||25);
  const max=manualTime(Number($('time-range').max));
  const index=Math.round(Math.max(0,Math.min(max,Number(v.currentTime)||0))*fps);
  let next=operation==='first'?0:operation==='last'?max:
    Math.max(0,Math.min(max,(index+(operation==='prev'?-1:1))/fps));
  v.pause();
  v.currentTime=next;
  $('time-range').value=String(next);
  $('time-input').value=next.toFixed(3);
  $('time-label').textContent=timeLabel(next);
}
for(const [id,op] of [
  ['ux-new-jog-first','first'],['ux-new-jog-prev','prev'],
  ['ux-new-jog-next','next'],['ux-new-jog-last','last']
])$(id).addEventListener('click',()=>jogNewFrame(op));
$('source-video').addEventListener('timeupdate',()=>{
  if(state.workflow!=='new'||!state.session)return;
  const t=manualTime(Number($('source-video').currentTime)||0);
  $('time-range').value=String(t);
  $('time-input').value=t.toFixed(3);
  $('time-label').textContent=timeLabel(t);
});
document.addEventListener('keydown',event=>{
  if($('ux-new-editor').hidden||!['ArrowLeft','ArrowRight'].includes(event.key)||
      event.altKey||event.ctrlKey||event.metaKey||
      !$('ux-new-discard').hidden||
      event.target.closest('input:not([type=range]),textarea,select,[contenteditable=true]'))return;
  event.preventDefault();event.stopImmediatePropagation();
  jogNewFrame(event.key==='ArrowLeft'?'prev':'next');
},true);
$('ux-new-use-frame').addEventListener('click',()=>action(async()=>{
  if(!state.session||state.session.kind!=='video')throw new Error('请先导入 MP4。');
  await selectFrame(manualTime(Number($('source-video').currentTime)||0));
  if(state.workflow==='new')$('crop-heading').scrollIntoView({behavior:'smooth',block:'nearest'});
}));
$('local-video-select').addEventListener('change', syncButtons);
$('refresh-local-videos').addEventListener('click', () => action(async () => {
  await refreshLocalVideos(); status('默认视频目录已刷新。');
}));
$('import-local-video').addEventListener('click', () => action(async () => {
  const name = $('local-video-select').value;
  if (!name) throw new Error('请从默认目录选择一个 MP4。');
  await importMedia(null, 'video', () => api('/api/import-local', { name,candidates:state.workflow!=='new' }));
}));
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
async function exportCurrent() {
  if (!state.session || !state.frame) throw new Error('请先导入视频并选择画面。');
  status(state.workflow==='poster' ? '正在导出原比例播放器海报…'
    : state.workflow==='cover' ? '正在生成 3:4 卡片封面（不会修改现有播放器海报）…'
    : '正在生成 3:4 封面和原比例播放器海报…');
  const result = await api('/api/export', {
    sessionId: state.session.id, frameId: state.frame.frameId,
    time: state.frame.time, mode: state.mode, x: state.x, y: state.y,
    previewPng: $('cover-preview').toDataURL('image/png'),
    customPosterPng:state.workflow==='new'&&customNewPoster?(() => {
      const canvas=document.createElement('canvas');
      const scale=Math.min(1,1600/Math.max(customNewPoster.naturalWidth,customNewPoster.naturalHeight));
      canvas.width=Math.round(customNewPoster.naturalWidth*scale);canvas.height=Math.round(customNewPoster.naturalHeight*scale);
      canvas.getContext('2d').drawImage(customNewPoster,0,0,canvas.width,canvas.height);
      return canvas.toDataURL('image/jpeg',.88);
    })():null, confirmed: true,
  });
  state.exported = result;
  $('export-image').src = result.url;
  $('export-path').textContent = `${result.path} · ${(result.bytes / 1024).toFixed(0)} KB`;
  $('download-cover').href = result.downloadUrl;
  $('poster-result').hidden = !result.posterUrl || state.workflow === 'cover';
  if (result.posterUrl) $('poster-image').src = result.posterUrl;
  $('export-result').hidden = false;
  $('compare-new-cover').src = result.url;
  updateCoverConfirm();
  if (state.workflow === 'cover' || state.workflow === 'poster') {
    status(state.workflow==='poster' ? '原比例海报已导出。请对比当前海报和新海报，确认无误后应用。' : '已生成新封面，请在下方对比新旧构图并确认应用。');
    if(!state.libraryReturnTarget)$('cover-confirm').scrollIntoView({behavior:'smooth',block:'nearest'});
  } else status('封面与播放器海报已生成。可继续保存作品。');
  return result;
}
$('export-cover').addEventListener('click', () => action(exportCurrent));
for (const id of ['new-title-zh', 'new-title-en', 'new-imagekit-url', 'create-consent', 'new-category']) {
  $(id).addEventListener(id === 'create-consent' ? 'change' : 'input', syncButtons);
}
function normalizeNewImagekitFilename(){
  const input=$('new-imagekit-url'),value=input.value.trim();
  if(!value)return '';
  if(value.startsWith(IMAGEKIT_URL_PREFIX)){
    const filename=value.slice(IMAGEKIT_URL_PREFIX.length);
    input.value=filename;
    return filename;
  }
  return value;
}
function validateNewImagekitFilename(){
  const raw=$('new-imagekit-url').value.trim();
  if(!raw)return '';
  if(/^(?:https?:|\/\/)/i.test(raw))return '只接受当前 ImageKit 前缀下的视频，请粘贴正确链接或只填写文件名。';
  if(!raw.toLowerCase().endsWith('.mp4'))return '视频文件名必须以 .mp4 结尾。';
  if(raw.includes('..')||raw.includes('\\')||raw.startsWith('/')||/[?#<>\x00-\x1f]/.test(raw))
    return '文件名不能包含路径跳转、问号、井号或非法字符。';
  try {
    const url=new URL(IMAGEKIT_URL_PREFIX+raw);
    if(url.origin!=='https://ik.imagekit.io'||!url.pathname.startsWith(new URL(IMAGEKIT_URL_PREFIX).pathname))return '视频地址格式不正确。';
  }catch{return '视频文件名格式不正确。';}
  return '';
}
$('new-imagekit-url').addEventListener('input',()=>{normalizeNewImagekitFilename();syncButtons();});
$('ux-new-imagekit-copy').addEventListener('click',async()=>{
  try{
    await navigator.clipboard.writeText(IMAGEKIT_URL_PREFIX);
    const button=$('ux-new-imagekit-copy');button.textContent='已复制';
    button.setAttribute('aria-label','ImageKit 前缀已复制');
  }catch(e){status('复制失败，请手动选择前缀文字复制。',true);}
});
$('ux-new-save').addEventListener('click',()=>{if(!$('create-project').disabled)$('create-project').click();});
$('create-project').addEventListener('click', () => action(async () => {
  if (!state.session || state.session.kind !== 'video' || !state.frame) throw new Error('请先导入视频并选择画面。');
  if (!$('create-consent').checked) throw new Error('请确认作品信息。');
  if(validateNewImagekitFilename())throw new Error(validateNewImagekitFilename());
  if (!state.exported) await exportCurrent();
  status('正在将视频、封面和播放器海报加入本地作品库…');
  const result = await api('/api/create-project', {
    sessionId: state.session.id, exportId: state.exported.id,
    titleZh: $('new-title-zh').value.trim(), titleEn: $('new-title-en').value.trim(),
    category: $('new-category').value, imagekitUrl: normalizeNewImagekitFilename() ? IMAGEKIT_URL_PREFIX+normalizeNewImagekitFilename() : '',
    confirmed: $('create-consent').checked,
  });
  state.created = result;
  $('created-summary').textContent =
    `${result.id} · ${result.title} ｜ 已保存视频、3:4 封面和原比例播放器海报。源视频保持不变。`;
  $('created-result').hidden = false;
  finishNewProject({created:true});
  await bootstrap();
  libraryUI?.open(result.id);
  status('新增成功：'+result.id+' · '+result.title+'。'+(result.onlineVideoPending?'本地可直接预览；线上视频地址可在作品详情中补充。':'已关联 ImageKit 视频直链。'));
}));


function setWorkflow(mode, { scroll = false } = {}) {
  if (!['library', 'new', 'manage', 'cover', 'poster', 'add-version', 'order'].includes(mode)) return;
  state.workflow = mode;
  document.body.dataset.workflow = mode;
  // Hide optional actions unless explicitly requested; never lose the saved values.
  document.body.dataset.manageAction = mode === 'add-version' ? 'add' : 'overview';
  document.querySelectorAll('[data-workflow-target]').forEach(button => {
    const active = button.dataset.workflowTarget === (mode === 'add-version' ? 'manage' : mode==='poster' ? 'cover' : mode);
    button.setAttribute('aria-pressed', String(active));
  });
  const copy = {
    'library': ['所有作品、封面、精选和发布信息集中在这里。', '选择一部作品直接编辑；封面和播放器海报都能在同一个面板里看到。'],
    'manage': ['集中查看作品、视频版本与播放地址，快速进入封面修改。', '选择作品后可管理版本、修改封面，或预览网站。'],
    'new': ['导入视频、选择封面并填写作品信息。所有修改都只保存在本机。', '三个步骤：导入素材 → 选定封面 → 填写信息并保存'],
    'cover': ['给任何作品更新 3:4 卡片封面，包括首页精选。原封面会保留。', '直接从当前作品的视频选帧，也可以导入新图片。调整后确认替换。'],
    'poster': ['单独更换播放器原比例海报，支持逐个视频版本选择。', '选择作品及版本 → 从当前 MP4 选帧 → 比较原比例画面 → 确认应用'],
    'add-version': ['给现有作品添加另一条 MP4，原有封面和视频都不变。', '① 选另一条 MP4  →  ② 选播放器海报  →  ③ 确认追加版本'],
    'order': ['按网页布局拖拽排序，双击作品中英文名称直接编辑。', '封面拖拽排序 · 文字双击编辑 · 保存顺序后同步本地网站'],
  };
  $('workflow-intro').textContent = copy[mode][0];
  document.querySelector('body>header h1').textContent=mode==='new'?'新增作品':'作品管理工作台';
  $('workflow-guide').textContent = copy[mode][1];
  const replacing=['cover','poster'].includes(mode);
  $('source-heading').textContent = replacing ? '02 / 选择素材' : '01 / 选择视频';
  $('frames-heading').textContent = replacing ? '03 / 挑选画面' : '02 / 挑选画面';
  $('crop-heading').textContent = replacing ? '04 / 检查并确认构图' : '03 / 确认封面';
  document.querySelectorAll('[data-cover-kind]').forEach(b=>
    b.setAttribute('aria-pressed',String(b.dataset.coverKind===(mode==='poster'?'poster':'card'))));
  $('cover-kind-description').textContent = mode==='poster'
    ? '原比例海报只用于播放器加载前的静止画面，不会更换作品卡片的 3:4 封面。'
    : '只更换网站作品卡片的 3:4 封面，不会更动播放器海报。';
  $('association-heading').textContent = mode==='poster' ? '选择要更换播放器海报的作品' : '选择要更换封面的作品';
  $('target-kicker').textContent = mode==='poster' ? 'CURRENT PLAYER POSTER · 当前播放器海报' : 'CURRENT COVER · 当前封面';
  document.querySelector('.poster-version-picker label').firstChild.textContent=mode==='cover'?'从哪个视频版本选帧':'目标视频版本';
  $('import-project-video').textContent='从当前版本视频选帧';
  $('target-safe-note').textContent = mode==='poster'
    ? '此操作仅更新选定版本的原比例海报，保留旧图及选帧记录；3:4 封面、MP4 和 ImageKit 不变。'
    : '替换时保留原图片和修订记录；不修改作品 ID、视频与播放器海报。';
  $('compare-heading').textContent = mode==='poster' ? '核对新旧原比例海报' : '核对新旧封面并替换';
  $('compare-description').textContent = mode==='poster'
    ? '确认选定的作品及视频版本；旧海报和新海报按实际画幅并排展示。'
    : '两张封面并排对比，确认构图后再写入作品集。';
  $('replace-consent-label').textContent = mode==='poster'
    ? '我已核对视频版本和原比例画面，确认仅更新此版本的播放器海报并保留旧图。'
    : '我已确认目标作品与新封面，保留原封面记录并应用修改。';
  $('associate-cover').textContent = mode==='poster' ? '应用原比例海报到播放器' : '应用新封面到作品集';
  $('export-cover').textContent = mode==='poster' ? '确认此帧并导出原比例海报' : '确认使用此封面并导出';
  const quick=Boolean(state.libraryReturnTarget)&&['cover','poster'].includes(mode);
  $('ux-quick-save').hidden=!quick;
  $('ux-quick-note').hidden=!quick;
  $('ux-quick-save').textContent=mode==='poster'?'保存此版本的播放器海报':'保存 3:4 卡片封面';
  if(mode==='poster')setPreviewView('original');
  else if(mode==='cover')setPreviewView('cover');
  updateCoverConfirm();
  $('return-manage').hidden = mode !== 'add-version';
  $('ux-return-library').hidden = mode==='library';
  document.body.dataset.fromLibrary=String(Boolean(state.libraryReturnTarget));
  libraryUI?.syncVisibility();
  if(mode === 'order')renderOrder();
  showProject();
  const taskStatus = {
    library: `已载入 ${state.projects.length} 部作品，点击卡片直接编辑。`,
    manage: `已载入 ${state.projects.length} 部作品；请选择作品查看视频版本。`,
    new: '请选择 MP4 视频，导入后可以挑选 3:4 封面。',
    cover: '先选择目标作品，再导入 MP4 或图片，更换前会保留原封面。',
    poster: '先选择目标作品和视频版本，再点击「从此版本的 MP4 选帧」。',
    'add-version': '请选择另一条 MP4 视频并挑选播放器海报画面。',
    order: `已载入 ${state.projects.length} 部作品；调整顺序后请手动保存。`,
  };
  status(taskStatus[mode]);
  if (scroll) window.scrollTo({top:0,behavior:'instant'});
  syncButtons();
}
// Keep ONE authoritative MP4 creation workflow, but present its existing form
// as a full-height sibling to the project detail dialog. Moving real DOM nodes
// preserves all existing file imports, FFmpeg sessions and backend validations.
let newReturnFocus=null,newReturnScroll=0,newPreviousOverflow='',newMoves=[];
const newModal=$('ux-new-editor'),newDiscard=$('ux-new-discard');
function mountNewPanels(){
  if(newMoves.length)return;
  for(const [selector,destination] of [
    ['.source-panel','ux-new-left'],
    ['.frame-panel','source-panel'],
    ['.crop-panel','ux-new-right'],
    ['.create-work','ux-new-right'],
  ]){
    const panel=document.querySelector('main > '+selector)||
      (selector==='.frame-panel'||selector==='.crop-panel'
        ?document.querySelector('main > .workspace > '+selector):null);
    if(!panel)throw new Error('找不到新增作品区域：'+selector);
    const marker=document.createComment('new-project-original-position: '+selector);
    panel.parentNode.insertBefore(marker,panel);
    if(destination==='source-panel')
      $('ux-new-left').querySelector('.source-panel').append(panel);
    else $(destination).append(panel);
    newMoves.push({panel,marker});
  }
}
function restoreNewPanels(){
  for(const {panel,marker} of newMoves)if(marker.isConnected)marker.replaceWith(panel);
  newMoves=[];
}
function newHasDraft(){
  return Boolean(state.session||state.frame||
    $('new-title-zh').value.trim()||$('new-title-en').value.trim()||
    $('new-imagekit-url').value.trim()||customNewCover||customNewPoster);
}
function finishNewProject({created=false}={}){
  if(newModal.hidden)return;
  if(!created&&state.busy){status('正在保存或处理视频，请完成后再关闭。',true);return;}
  $('source-video').pause();
  newModal.hidden=true;newModal.inert=false;newDiscard.hidden=true;
  $('ux-library').inert=false;
  delete document.body.dataset.newOpen;
  document.body.style.overflow=newPreviousOverflow;
  restoreNewPanels();
  resetCurrentMedia({resetTitles:true});
  setWorkflow('library');
  window.scrollTo({top:newReturnScroll,behavior:'instant'});
  const currentCategory=$('new-category').value;
  const focusTarget=document.querySelector('#ux-gallery .ux-new-project-tile[data-category="'+currentCategory+'"]');
  if(newReturnFocus?.isConnected)newReturnFocus.focus({preventScroll:true});
  else focusTarget?.focus({preventScroll:true});
  newReturnFocus=null;
}
function requestCloseNewProject(){
  if(newModal.hidden)return;
  if(state.busy){status('正在处理本地文件，请完成后再关闭。',true);return;}
  if(newHasDraft()){
    newDiscard.hidden=false;
    newModal.inert=true;
    $('ux-new-keep').focus({preventScroll:true});
  }else finishNewProject();
}
function openNewProject(category='commercial'){
  if(!newModal.hidden)return;
  newReturnFocus=document.activeElement;
  newReturnScroll=window.scrollY;
  newPreviousOverflow=document.body.style.overflow;
  resetCurrentMedia({resetTitles:true});
  state.mode='cover';
  document.querySelectorAll('[data-mode]').forEach(button=>
    button.setAttribute('aria-pressed',String(button.dataset.mode==='cover')));
  $('new-category').value=['commercial','short-film','social','visual'].includes(category)?category:'commercial';
  setWorkflow('new');
  mountNewPanels();
  // Keep the library visible beneath the blurred backdrop. The true workflow
  // is still "new" for create/import logic; library mode only skins the page.
  document.body.dataset.workflow='library';
  document.body.dataset.newOpen='true';
  $('ux-library').hidden=false;
  $('ux-library').inert=true;
  newModal.hidden=false;
  document.body.style.overflow='hidden';
  $('ux-new-category-label').textContent='新增作品 · '+({
    commercial:'商业广告','short-film':'创意短片',social:'海外产品广告',visual:'视觉实验'
  }[$('new-category').value]);
  $('source-heading').textContent='导入视频';
  $('frames-heading').textContent='选择封面画面';
  $('crop-heading').textContent='选择双封面';
  $('ux-new-status').textContent='导入视频 → 选择双封面 → 填写资料 → 保存';
  newModal.querySelector('.ux-new-editor-pane').focus({preventScroll:true});
  syncButtons();
}
$('ux-new-close').addEventListener('click',requestCloseNewProject);
document.querySelector('[data-new-close]').addEventListener('click',requestCloseNewProject);
$('ux-new-keep').addEventListener('click',()=>{
  newDiscard.hidden=true;newModal.inert=false;
  newModal.querySelector('.ux-new-editor-pane').focus({preventScroll:true});
});
$('ux-new-discard-confirm').addEventListener('click',()=>finishNewProject());
document.addEventListener('keydown',event=>{
  if(newModal.hidden||event.key!=='Escape')return;
  event.preventDefault();event.stopImmediatePropagation();
  if(!newDiscard.hidden){
    newDiscard.hidden=true;newModal.inert=false;
    $('ux-new-close').focus({preventScroll:true});
  }else requestCloseNewProject();
},true);
document.addEventListener('keydown',event=>{
  if(newModal.hidden||!newDiscard.hidden||event.key!=='Tab')return;
  const dialog=newModal.querySelector('.ux-new-editor-pane');
  const focusable=[...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),[href]')]
    .filter(x=>x.getClientRects().length);
  const first=focusable[0],last=focusable.at(-1);
  if(!first)return;
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
},true);
function setManageAction(action) {
  if (!['overview', 'cloud'].includes(action)) return;
  document.body.dataset.manageAction = action;
  syncButtons();
}
window.addEventListener('beforeunload',event=>{
  if(!newModal.hidden&&newHasDraft()){
    event.preventDefault();event.returnValue='';
  }
});
document.querySelectorAll('[data-workflow-target]').forEach(button => button.addEventListener('click', () => {
  const next = button.dataset.workflowTarget;
  if (next === 'new' && state.created) resetCurrentMedia({resetTitles:true});
  else if (next==='cover' && state.workflow==='poster') resetCurrentMedia();
  setWorkflow(next, {scroll:true});
}));
$('return-manage').addEventListener('click', () => setWorkflow('manage', {scroll:true}));
$('ux-return-library').addEventListener('click', () => {
  const id=state.libraryReturnTarget,variant=state.libraryReturnVariant;
  state.libraryReturnTarget=null;state.libraryReturnVariant='main';
  setWorkflow('library',{scroll:true});
  if(id)libraryUI?.open(id,variant);
});
$('start-cover-for-managed').addEventListener('click', () => {
  const chosen = $('managed-project').value;
  if (chosen) openCoverWorkflow(chosen);
});
$('start-poster-for-managed').addEventListener('click', () => {
  const {project,version}=chosenManagedVersion();
  if(project)openPosterWorkflow(project.id,version?.id||'main');
});
$('start-add-version').addEventListener('click', () => {
  const {project} = chosenManagedVersion();
  if(!project || project.legacy) return;
  resetCurrentMedia();
  const letter = project.versions.length < 26 ? String.fromCharCode(65 + project.versions.length) : String(project.versions.length + 1);
  $('variant-title-zh').value = `版本 ${letter}`;
  $('variant-title-en').value = `Version ${letter}`;
  setWorkflow('add-version', {scroll:true});
});
$('start-imagekit').addEventListener('click', () => {
  setWorkflow('manage'); setManageAction('cloud');
  document.querySelector('.manage-work').scrollIntoView({behavior:'smooth',block:'start'});
});
function paintManagedVersions(project, selectedVersionId) {
  const container = $('managed-version-summary');
  container.replaceChildren();
  if (!project) {
    const empty = document.createElement('p'); empty.className='muted';
    empty.textContent = '请选择一部作品查看视频版本。';
    container.append(empty);return;
  }
  for (const version of project.versions) {
    const button = document.createElement('button');
    button.type='button'; button.className='version-overview-item';
    button.setAttribute('aria-pressed',String(version.id===selectedVersionId));
    const name=document.createElement('strong');name.textContent=version.label.zh;
    const chip=document.createElement('span');chip.className='version-cloud-status';
    chip.textContent=version.videoUrl ? '已关联 ImageKit' : '待关联 ImageKit';
    chip.dataset.connected=String(Boolean(version.videoUrl));
    const meta=document.createElement('span');meta.className='version-overview-meta';
    meta.textContent=version.videoUrl ? decodeURIComponent(new URL(version.videoUrl).pathname.split('/').at(-1)) : '本地视频可预览，线上地址未配置';
    button.append(name,chip,meta);
    button.addEventListener('click',()=>{
      $('managed-variant').value=version.id;showManagedVariant();
    });
    container.append(button);
  }
}
function chosenManagedVersion() {
  const project = state.managed.find(p => p.id === $('managed-project').value);
  const version = project?.versions.find(v => v.id === $('managed-variant').value);
  return { project, version };
}
function showManaged(preserveVariant = false) {
  const project = state.managed.find(p => p.id === $('managed-project').value);
  const previous = preserveVariant ? $('managed-variant').value : 'main';
  $('managed-variant').replaceChildren();
  for (const v of project?.versions || []) {
    $('managed-variant').append(new Option(v.label?.zh || '视频版本', v.id));
  }
  $('managed-variant').value = project?.versions.some(v => v.id === previous) ? previous : 'main';
  showManagedVariant();
}
function showManagedVariant() {
  const { project, version } = chosenManagedVersion();
  $('imagekit-url').value = version?.videoUrl || IMAGEKIT_URL_PREFIX;
  $('managed-legacy-note').hidden = !project?.legacy;
  $('bind-consent').checked = false;
  $('variant-consent').checked = false;
  paintManagedVersions(project,version?.id);
  const onlineCount = project?.versions.filter(v => Boolean(v.videoUrl)).length || 0;
  $('managed-status').textContent = project
    ? `${project.versions.length} 个视频版本 · ${onlineCount} 条已关联 ImageKit · 共占 1 张作品卡片`
    : '请选择一部作品查看视频版本。';
  $('imagekit-config').textContent = '如视频已在 ImageKit 上传，请粘贴 MP4 直链并确认关联。此工作台不上传素材，也不会产生上传流量。';
  syncButtons();
}
$('managed-project').addEventListener('change', () => { showManaged(false); if (state.workflow === 'manage') setManageAction('overview'); });
$('managed-variant').addEventListener('change', showManagedVariant);
for (const id of ['variant-title-zh','variant-title-en','variant-consent','imagekit-url','bind-consent']) {
  $(id).addEventListener(id.endsWith('consent') ? 'change' : 'input', syncButtons);
}
$('add-version').addEventListener('click', () => action(async () => {
  const { project } = chosenManagedVersion();
  if (!project || !state.session || state.session.kind !== 'video' || !state.frame) throw new Error('请先选作品、导入视频并挑选海报画面。');
  status('正在将本地视频追加到同一个作品，生成原比例播放器海报…');
  const result = await api('/api/add-version', {
    projectId: project.id, sessionId: state.session.id, time: state.frame.time,
    labelZh: $('variant-title-zh').value.trim(), labelEn: $('variant-title-en').value.trim(),
    confirmed: $('variant-consent').checked,
  });
  state.variantAddedSession = state.session.id;
  const selectedProject = project.id;
  await bootstrap();
  $('managed-project').value = selectedProject;
  showManaged(true);
  $('managed-variant').value = result.variantId;
  showManagedVariant();
  if(state.libraryReturnTarget){
    const id=state.libraryReturnTarget;
    state.libraryReturnTarget=null;state.libraryReturnVariant='main';
    setWorkflow('library',{scroll:true});libraryUI?.open(id,result.variantId);
  } else setWorkflow('manage',{scroll:true});
  status(`已把 ${result.label.zh} 加入作品 ${project.id}。一个卡片，两个及以上版本，可在播放器中切换。`);
}));
$('bind-imagekit').addEventListener('click', () => action(async () => {
  const { project, version } = chosenManagedVersion();
  if (!project || !version) throw new Error('请先选择视频版本。');
  const result=await api('/api/bind-imagekit', {
    projectId:project.id, variantId:version.id, url:$('imagekit-url').value.trim(),
    expectedUrl:version.videoUrl || null, confirmed:$('bind-consent').checked,
  });
  await bootstrap();
  status(`ImageKit 地址已关联到 ${project.title} 的 ${version.label.zh}：${result.url}`);
}));

function selectedPosterInfo() {
  const entry=state.posterVersions.find(p=>p.id===$('project-select').value);
  return entry?.versions.find(v=>v.id===$('poster-variant').value)||null;
}
function updateCoverConfirm() {
  const project = state.projects.find(p => p.id === $('project-select').value);
  const poster=selectedPosterInfo();
  const isPoster=state.workflow==='poster';
  $('cover-confirm').hidden = !['cover','poster'].includes(state.workflow) || !state.exported || !project ||
    (isPoster && (!poster || !state.exported.posterUrl));
  $('cover-confirm-target').textContent = project
    ? '即将更新：' + project.id + ' · ' + project.title + (isPoster?' · '+(poster?.label?.zh||'主版本'):'') : '';
  if(state.exported) $('compare-new-cover').src = isPoster ? (state.exported.posterUrl||'') : state.exported.url;
}
function openCoverWorkflow(projectId) {
  resetCurrentMedia();
  setWorkflow('cover', {scroll:true});
  if (state.projects.some(p => p.id === projectId)) {
    $('project-select').value = projectId;
    showProject();
  }
}
function openPosterWorkflow(projectId,variantId='main') {
  resetCurrentMedia();
  setWorkflow('poster', {scroll:true});
  if (state.projects.some(p=>p.id===projectId)) {
    $('project-select').value=projectId;
    showProject();
    if([...$('poster-variant').options].some(option=>option.value===variantId)) {
      $('poster-variant').value=variantId;
      showProject();
    }
  }
}
function showProject() {
  const project = state.projects.find(p => p.id === $('project-select').value);
  const isPoster=state.workflow==='poster';
  const versions=state.posterVersions.find(p=>p.id===project?.id)?.versions||[];
  const prior=$('poster-variant').value;
  $('poster-variant').replaceChildren();
  for(const version of versions)
    $('poster-variant').append(new Option(version.label?.zh || (version.id==='main'?'主版本':'附加版本'),version.id));
  $('poster-variant').value=versions.some(v=>v.id===prior)?prior:'main';
  const selected=selectedPosterInfo();
  document.querySelector('.poster-version-picker').hidden=!['poster','cover'].includes(state.workflow);
  $('cover-confirm-result').hidden = true;
  $('replace-consent').checked = false; $('association-detail').hidden = !project;
  $('target-empty').hidden = Boolean(project);
  if (project) {
    $('project-title').textContent = `${project.id} · ${project.title}${project.featured ? ' · 首页精选' : ''}`;
    const src=isPoster
      ? `/project-poster/${encodeURIComponent(project.id)}/${encodeURIComponent(selected?.id||'main')}?v=${Date.now()}`
      : `/project-cover/${project.id}?v=${Date.now()}`;
    $('current-cover').src=src;
    $('compare-old-cover').src=src;
    $('replace-target-status').textContent=isPoster
      ? `播放器原比例 · ${selected?.width||'-'} × ${selected?.height||'-'} · ${selected?.label?.zh||'主版本'}`
      : project.featured ? '首页精选 · 可更换封面' : '全部作品 · 可更换封面';
  } else {
    $('replace-target-status').textContent = '请选择要更新的作品';
    $('current-cover').removeAttribute('src');
    $('compare-old-cover').removeAttribute('src');
  }
  updateCoverConfirm();
  syncButtons();
}
document.querySelectorAll('[data-cover-kind]').forEach(button=>button.addEventListener('click',()=>{
  const mode=button.dataset.coverKind==='poster'?'poster':'cover';
  if(mode===state.workflow)return;
  const id=$('project-select').value;
  resetCurrentMedia();
  setWorkflow(mode);
  $('project-select').value=id;
  showProject();
}));
$('project-select').addEventListener('change', () => {
  resetCurrentMedia();
  $('poster-variant').value='main';
  showProject();
});
$('poster-variant').addEventListener('change',()=>{
  resetCurrentMedia();showProject();
});
$('import-project-video').addEventListener('click',()=>action(async()=>{
  const projectId=$('project-select').value,variantId=$('poster-variant').value;
  if(!projectId)throw new Error('请先选择作品。');
  await importMedia(null,'video',()=>api('/api/import-project-video',{projectId,variantId}));
}));
$('replace-consent').addEventListener('change', syncButtons);
$('refresh-projects').addEventListener('click', () => action(async () => { await bootstrap(); status('作品列表已刷新。'); }));
async function applyExportedCover(){
  const projectId=$('project-select').value,isPoster=state.workflow==='poster';
  const updatedTitle=state.projects.find(p=>p.id===projectId)?.title||projectId;
  const chosenVariant=$('poster-variant').value;
  if(isPoster){
    const variant=selectedPosterInfo();
    if(!variant||!state.exported?.posterUrl)throw new Error('请先选择正确的视频版本并生成原比例海报。');
    await api('/api/associate-poster',{
      projectId,variantId:variant.id,exportId:state.exported.id,
      expectedPoster:variant.poster,expectedTime:variant.time??null,confirmed:true,
    });
    await bootstrap();
    $('project-select').value=projectId;showProject();
    $('poster-variant').value=chosenVariant;showProject();
  }else{
    const result=await api('/api/associate',{
      projectId,exportId:state.exported.id,confirmed:true,replaceExisting:true,
      expectedCover:state.overrides[projectId]||null,
    });
    state.projects=result.projects;state.overrides=result.overrides;showProject();
  }
  if(state.libraryReturnTarget===projectId){
    const selectedVersion=state.libraryReturnVariant||chosenVariant;
    state.libraryReturnTarget=null;state.libraryReturnVariant='main';
    invalidateExport();
    setWorkflow('library',{scroll:true});
    libraryUI?.refresh();
    libraryUI?.open(projectId,selectedVersion);
    libraryUI?.notify('已更新「'+updatedTitle+'」的'+(isPoster?'原比例播放器海报':'3:4 卡片封面')+'，旧图已备份。');
    return;
  }
  $('cover-confirm-result').hidden=false;
  $('cover-confirm-result').textContent='已成功更新「'+updatedTitle+'」的'+
    (isPoster?'播放器原比例海报':'3:4 作品封面')+'。旧图与修订记录已保留。';
  invalidateExport();
  $('cover-confirm-result').scrollIntoView({behavior:'smooth',block:'center'});
  status('已更新 '+updatedTitle+' 的'+(isPoster?'播放器原比例海报':'3:4 作品封面')+'；未推送 GitHub。');
}
$('associate-cover').addEventListener('click',()=>action(async()=>{
  if(!$('replace-consent').checked)throw new Error('请先核对新旧封面并确认。');
  await applyExportedCover();
}));
$('ux-quick-save').addEventListener('click',()=>action(async()=>{
  if(!state.libraryReturnTarget||!['cover','poster'].includes(state.workflow))
    throw new Error('请先从作品库中选择要修改的封面。');
  if(!state.session||!state.frame)throw new Error('请选择一帧或导入图片。');
  const v=selectedPosterInfo();
  if(state.workflow==='poster'&&v&&Math.abs(state.frame.width/state.frame.height-v.width/v.height)>.018)
    throw new Error('画面比例不匹配。请使用当前视频选帧。');
  await exportCurrent();
  await applyExportedCover();
}));
// A small editor for the two independent display orders. No source or video
// content is mutated until the user explicitly clicks Save.
// Double-click either title below a card to edit it in place.
function editOrderTitle(project, language, label) {
  if (state.busy || document.querySelector('.order-title-input')) return;
  const before = language === 'zh' ? project.title : project.titleEn;
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 80;
  input.value = before;
  input.className = 'order-title-input order-title-input-' + language;
  input.setAttribute('aria-label', language === 'zh' ? '编辑中文作品名称' : 'Edit English project title');
  input.title = 'Enter 保存，Esc 取消；点击外部自动保存';
  label.replaceWith(input);
  input.focus();
  input.select();
  let settled = false;
  function restore() {
    input.replaceWith(label);
  }
  async function save() {
    if (settled) return;
    settled = true;
    const next = input.value.trim().replace(/\s+/g, ' ');
    if (!next || next === before) {
      restore();
      if (!next) status('标题不能为空，已取消修改。', true);
      return;
    }
    const expectedZh = project.title, expectedEn = project.titleEn;
    state.busy = true;
    syncButtons();
    try {
      const result = await api('/api/update-title', {
        id: project.id,
        titleZh: language === 'zh' ? next : expectedZh,
        titleEn: language === 'en' ? next : expectedEn,
        expectedZh, expectedEn, confirmed: true,
      });
      project.title = result.title.zh;
      project.titleEn = result.title.en;
      const local = state.projects.find(item => item.id === project.id);
      if (local) local.title = result.title.zh;
      const managed = state.managed.find(item => item.id === project.id);
      if (managed) managed.title = result.title.zh;
      for (const option of $('managed-project').options) {
        const item = state.managed.find(p => p.id === option.value);
        if (item) option.textContent = item.id + ' · ' + item.title + (item.legacy ? '（原有作品）' : '');
      }
      for (const option of $('project-select').options) {
        const item = state.projects.find(p => p.id === option.value);
        if (item) option.textContent = item.id + ' · ' + item.title + (item.featured ? ' · 首页精选' : '');
      }
      renderOrder();
      $('order-message').textContent = '已同步中文和英文作品名称，刷新本地网页即可查看。';
      const videos = result.renamedFiles?.length || 0;
      const artwork = result.renamedArtwork?.length || 0;
      const summary = videos + artwork ? `；同步更名 ${videos} 个 MP4、${artwork} 张封面与海报` : '';
      status('已保存 ' + project.id + ' · ' + result.title.zh + ' / ' + result.title.en + summary + '。未推送 GitHub。');
    } catch (error) {
      restore();
      status(error.message, true);
    } finally {
      state.busy = false;
      syncButtons();
    }
  }
  input.addEventListener('click', event => event.stopPropagation());
  input.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.isComposing) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      input.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      settled = true;
      restore();
    }
  });
  input.addEventListener('blur', save);
}
let orderDrag = null;
function orderSame(a, b) {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}
function orderHasChanges(scope = state.orderScope) {
  return !!state.orderDraft && !orderSame(state.orderDraft[scope] || [], state.orderBaseline[scope] || []);
}
function orderDefaultFor(scope) {
  if(!state.ordering)return [];
  return [...state.ordering.defaults[scope]];
}
function orderCanSave(scope = state.orderScope) {
  return orderHasChanges(scope);
}
const ORDER_CATEGORY_GROUPS = [
  {id:'commercial', title:'AI 商业广告', subtitle:'Commercials'},
  {id:'short-film', title:'AI 创意短片', subtitle:'Short Films'},
  {id:'social', title:'AI 海外产品广告', subtitle:'Overseas Product Ads'},
  {id:'visual', title:'AI 视觉实验', subtitle:'Visual Experiments'},
];
function orderCategoryOf(id) {
  return state.ordering?.projects.find(project => project.id === id)?.category || 'uncategorized';
}
function orderGroupIds(scope, category) {
  const ids = state.orderDraft?.[scope] || [];
  return category === null ? [...ids] : ids.filter(id => orderCategoryOf(id) === category);
}
function orderMove(fromId, toId) {
  const ids=state.orderDraft?.[state.orderScope];
  if(!ids || fromId===toId)return;
  const from=ids.indexOf(fromId),to=ids.indexOf(toId);
  if(from<0||to<0)return;
  if(state.orderScope==='all'){
    const category=state.orderCategory;
    if(category!==orderCategoryOf(fromId)||category!==orderCategoryOf(toId))return;
    const slots=ids.flatMap((id,index)=>orderCategoryOf(id)===category?[index]:[]);
    const subset=slots.map(i=>ids[i]);
    const targetIndex=subset.indexOf(toId);
    subset.splice(subset.indexOf(fromId),1);
    subset.splice(targetIndex,0,fromId);
    slots.forEach((slot,i)=>{ids[slot]=subset[i]});
  }else{
    ids.splice(from,1);
    ids.splice(to,0,fromId);
  }
  renderOrder();
}
function orderNudge(id, step) {
  const group=orderGroupIds(state.orderScope,
    state.orderScope==='all'?state.orderCategory:null);
  const index=group.indexOf(id), next=index+step;
  if (index < 0 || next < 0 || next >= group.length) return;
  orderMove(id,group[next]);
  document.querySelectorAll('#order-items .order-item').forEach(item=>{
    if(item.dataset.id===id)item.focus({preventScroll:true});
  });
}
function beginFeaturedSwap(id) {
  if(state.busy||state.orderScope!=='featured')return;
  if(state.featuredCandidate){applyFeaturedSwap(state.featuredCandidate,id);return;}
  state.featuredSwapTarget=id;
  state.featuredCandidate=null;
  renderOrder();
  $('featured-replacement').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function applyFeaturedSwap(id, targetId=state.featuredSwapTarget) {
  if(state.busy||!targetId)return;
  const selected=state.orderDraft.featured;
  if(selected.includes(id))return;
  const index=selected.indexOf(targetId);
  if(index<0)return;
  const old=selected[index];
  selected[index]=id;
  state.featuredSwapTarget=null;
  state.featuredCandidate=null;
  renderOrder();
  const titles=new Map(state.ordering.projects.map(p=>[p.id,p.title]));
  $('order-message').textContent=`已用「${titles.get(id)}」替换「${titles.get(old)}」，点击「保存当前顺序」后即可在首页预览。`;
}
function chooseFeaturedCandidate(id) {
  if(state.busy)return;
  if(state.featuredSwapTarget){
    applyFeaturedSwap(id);
  } else {
    state.featuredCandidate=id;
    renderOrder();
    const chosen=state.ordering.projects.find(p=>p.id===id);
    $('order-message').textContent=`已选中「${chosen?.title||''}」。点击上方任意一张精选封面，将它替换为此作品。`;
  }
}
$('featured-replacement-cancel').addEventListener('click',()=>{
  state.featuredSwapTarget=null;
  state.featuredCandidate=null;
  renderOrder();
});
// Candidate-to-featured drag supports both mouse and touch. Only a drop onto
// an actual featured cover swaps; releasing elsewhere preserves the selection.
let candidateDrag=null;
let candidateDragFrame=0;
let suppressCandidateClick=null;
function stopCandidateAutoScroll(){if(candidateDragFrame){cancelAnimationFrame(candidateDragFrame);candidateDragFrame=0;}}
function candidateAutoScroll(){
  if(!candidateDrag)return;
  const y=candidateDrag.y,edge=100;
  if(y<edge)window.scrollBy(0,-Math.max(9,(edge-y)/4));
  else if(y>window.innerHeight-edge)window.scrollBy(0,Math.max(9,(y-(window.innerHeight-edge))/4));
  candidateDragFrame=requestAnimationFrame(candidateAutoScroll);
}
function beginCandidateDrag(id,event) {
  if(state.busy || (event.pointerType==='mouse'&&event.button!==0))return;
  event.preventDefault();
  const cover=event.currentTarget;
  candidateDrag={id,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,
    x:event.clientX,y:event.clientY,moved:false,cover};
  cover.setPointerCapture(event.pointerId);
  candidateDragFrame=requestAnimationFrame(candidateAutoScroll);
}
function moveCandidateDrag(event) {
  if(!candidateDrag||candidateDrag.pointerId!==event.pointerId)return;
  candidateDrag.x=event.clientX;candidateDrag.y=event.clientY;
  candidateDrag.moved ||= Math.hypot(event.clientX-candidateDrag.startX,event.clientY-candidateDrag.startY)>9;
  const destination=document.elementFromPoint(event.clientX,event.clientY)?.closest('#order-items .order-item');
  document.querySelectorAll('#order-items .order-item').forEach(item=>{
    item.classList.toggle('is-candidate-target',candidateDrag.moved&&item===destination);
  });
}
function endCandidateDrag(event) {
  if(!candidateDrag||candidateDrag.pointerId!==event.pointerId)return;
  const drag=candidateDrag;
  const destination=document.elementFromPoint(event.clientX,event.clientY)?.closest('#order-items .order-item');
  candidateDrag=null;
  stopCandidateAutoScroll();
  if(drag.cover.hasPointerCapture(event.pointerId))drag.cover.releasePointerCapture(event.pointerId);
  document.querySelectorAll('#order-items .order-item').forEach(item=>item.classList.remove('is-candidate-target'));
  if(drag.moved){
    suppressCandidateClick=drag.id;
    setTimeout(()=>{if(suppressCandidateClick===drag.id)suppressCandidateClick=null;},0);
    if(destination)applyFeaturedSwap(drag.id,destination.dataset.id);
  }
}
document.addEventListener('pointermove',moveCandidateDrag);
document.addEventListener('pointerup',endCandidateDrag);
document.addEventListener('pointercancel',endCandidateDrag);
function buildOrderCard(project, ordinal, groupSize, scope, candidate = false) {
  const {id}=project;
  const item=document.createElement('li');
  item.className='order-item';
  item.dataset.id=id;
  item.dataset.category=project.category;
  if(candidate){
    item.classList.add('order-candidate');
    item.tabIndex=0;
    item.setAttribute('role','button');
    item.setAttribute('aria-label',`选择 ${project.title} 作为新的精选作品`);
    item.addEventListener('click',event=>{
      if (event.target.closest('.order-name-zh,.order-name-en,.order-title-input')) return;
      if (suppressCandidateClick!==id) chooseFeaturedCandidate(id);
    });
    item.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();chooseFeaturedCandidate(id);}
    });
  }else{
    item.tabIndex=0;
    item.setAttribute('aria-label',`${project.title}，第 ${ordinal+1} 位。拖动封面或按键盘左右箭头改变位置。`);
    item.addEventListener('keydown',event=>{
      if(scope==='featured'&&state.featuredCandidate&&(event.key==='Enter'||event.key===' ')){
        event.preventDefault();applyFeaturedSwap(state.featuredCandidate,id);return;
      }
      const step=event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0;
      if(!step||state.busy)return;
      event.preventDefault();orderNudge(id,step);
    });
    if(scope==='featured')item.addEventListener('click',event=>{
      if(!state.featuredCandidate||event.target.closest('.order-featured-replace,.order-name-zh,.order-name-en,.order-title-input'))return;
      applyFeaturedSwap(state.featuredCandidate,id);
    });
  }
  if (orderDrag?.id===id) item.classList.add('is-order-dragging');
  if(!candidate && scope==='featured' && state.featuredSwapTarget===id)
    item.classList.add('is-featured-swap-target');
  const pinned=false;
  if(candidate && state.featuredCandidate===id)item.classList.add('is-featured-candidate-selected');
  const imageWrap=document.createElement('div');imageWrap.className='order-image-wrap';
  const cover=document.createElement('img');
  cover.className='order-thumb';cover.alt='';cover.loading='lazy';cover.decoding='async';
  cover.src=`/project-cover/${encodeURIComponent(id)}`;
  cover.style.objectFit=(candidate || scope==='featured')?'cover':'contain';
  const number=document.createElement('span');
  number.className='order-position';number.textContent=candidate?'＋':String(ordinal+1).padStart(2,'0');
  imageWrap.append(cover,number);
  const changeCover=document.createElement('button');
  changeCover.type='button';changeCover.className='order-change-cover';
  changeCover.textContent='换封面';changeCover.title='更换此作品的封面图片';
  changeCover.setAttribute('aria-label','更换 ' + project.title + ' 的封面');
  changeCover.addEventListener('click',event=>{event.stopPropagation();openCoverWorkflow(id);});
  imageWrap.append(changeCover);

  const info=document.createElement('div');info.className='order-info';
  const name=document.createElement('strong');name.textContent=project.title;
  name.className='order-name-zh';
  const english=document.createElement('span');english.className='order-name-en';
  english.textContent=project.titleEn || '';
  for (const [label, language] of [[name,'zh'],[english,'en']]) {
    label.title='双击修改；触屏点按修改。Enter 保存，Esc 取消';
    label.addEventListener('click',event=>{
      if (!window.matchMedia('(pointer: coarse)').matches) return;
      event.stopPropagation(); editOrderTitle(project,language,label);
    });
    label.addEventListener('dblclick',event=>{
      event.preventDefault();event.stopPropagation();
      editOrderTitle(project,language,label);
    });
  }
  info.append(name,english);
  if(scope==='featured'&&!candidate){
    const replaceButton=document.createElement('button');
    replaceButton.className='order-featured-replace';replaceButton.type='button';
    replaceButton.textContent='替换此作品';
    replaceButton.setAttribute('aria-pressed',String(state.featuredSwapTarget===id));
    replaceButton.addEventListener('click',()=>beginFeaturedSwap(id));
    info.append(replaceButton);
  }
  // The cover itself is the drag surface. No per-card arrow or grip buttons:
  // they competed visually with the portfolio and made the grid too tall.
  cover.title=candidate?'拖动到上方精选或点选后替换':'拖动封面调整位置';
  const beginDrag=event=>{
    if (state.busy || (event.pointerType==='mouse' && event.button!==0)) return;
    // After selecting a candidate, a click on the featured cover replaces it;
    // don't capture that click as a regular reorder drag.
    if(scope==='featured' && state.featuredCandidate)return;
    event.preventDefault();
    orderDrag={id,pointerId:event.pointerId};
    const list=$('order-items');
    list.setPointerCapture(event.pointerId);
    item.classList.add('is-order-dragging');
  };
  if(candidate)cover.addEventListener('pointerdown',event=>beginCandidateDrag(id,event));
  else cover.addEventListener('pointerdown',beginDrag);
  item.append(imageWrap,info);
  return item;
}
function renderOrder() {
  if (!state.orderDraft || !state.ordering) return;
  const scope=state.orderScope, ids=state.orderDraft[scope];
  const catalog=new Map(state.ordering.projects.map(project=>[project.id,project]));
  $('order-featured-count').textContent=state.orderDraft.featured.length;
  $('order-all-count').textContent=state.orderDraft.all.length;
  document.querySelectorAll('[data-order-scope]').forEach(button=>{
    button.setAttribute('aria-pressed',String(button.dataset.orderScope===scope));
  });
  $('order-scope-description').textContent=scope==='featured'
    ? '上方 8 部精选可直接拖动排序；下方候选作品可直接拖到精选位置替换。两套排序独立保存。'
    : '选择作品分类，拖动封面调整该分类的展示顺序；不会改变首页精选。';
  $('order-category-tabs').hidden=scope!=='all';
  if(scope==='featured'&&state.orderCategory==='all')state.orderCategory='commercial';
  document.querySelectorAll('[data-order-category]').forEach(button=>{
    const category=button.dataset.orderCategory;
    button.setAttribute('aria-pressed',String(category===state.orderCategory));
    button.querySelector('small').textContent=String(ids.filter(id=>orderCategoryOf(id)===category).length);
  });
  $('order-preview').href=scope==='featured'
    ? 'http://127.0.0.1:5174/index.html#projects' : 'http://127.0.0.1:5174/works.html';
  const list=$('order-items'),fragment=document.createDocumentFragment();
  const category=scope==='featured'?null:state.orderCategory;
  const visibleIds=orderGroupIds(scope,category);
  const grid=document.createElement('ol');
  grid.className='order-grid';
  grid.setAttribute('aria-label',scope==='featured'?'首页精选作品顺序':
    `${ORDER_CATEGORY_GROUPS.find(g=>g.id===state.orderCategory)?.title||'分类'}作品顺序`);
  visibleIds.forEach((id,i)=>{
    const project=catalog.get(id);
    if(project)grid.append(buildOrderCard(project,i,visibleIds.length,scope));
  });
  const section=document.createElement('section');
  section.className='order-group';
  section.dataset.category=scope==='featured'?'featured':state.orderCategory;
  section.append(grid);
  fragment.append(section);
  list.replaceChildren(fragment);
  const candidatesSection=$('featured-replacement');
  candidatesSection.hidden=scope!=='featured';
  if(scope==='featured'){
    const targetIndex=state.orderDraft.featured.indexOf(state.featuredSwapTarget);
    const current=state.ordering.projects.find(p=>p.id===state.featuredSwapTarget);
    const hint=state.featuredSwapTarget
      ?`正在替换第 ${targetIndex+1} 位「${current?.title||''}」。点击下方候选封面，或拖到上方目标封面。`
      :state.featuredCandidate
        ?'已选中候选作品。点击上方任意精选位置替换，或重新拖动一张候选封面。'
        :'直接把下方候选封面拖到上方某张精选封面上，或点击候选后再点目标位置。';
    $('featured-replacement-hint').textContent=hint;
    $('featured-replacement-cancel').hidden=!state.featuredSwapTarget&&!state.featuredCandidate;
    document.querySelectorAll('[data-featured-pool-category]').forEach(button=>{
      const category=button.dataset.featuredPoolCategory;
      button.setAttribute('aria-pressed',String(category===state.featuredPoolCategory));
      button.querySelector('small').textContent=String(state.orderDraft.all.filter(id=>
        !state.orderDraft.featured.includes(id)&&orderCategoryOf(id)===category).length);
    });
    const pool=state.orderDraft.all.filter(id=>!state.orderDraft.featured.includes(id)&&
      orderCategoryOf(id)===state.featuredPoolCategory);
    $('featured-replacement-candidates').replaceChildren(...pool.map((id,i)=>
      buildOrderCard(catalog.get(id),i,pool.length,'featured',true)));
  }else $('featured-replacement-candidates').replaceChildren();
  $('order-draft-state').textContent=orderHasChanges()?'未保存的调整':'当前顺序已保存';
  $('order-draft-state').dataset.modified=String(orderHasChanges());
  $('order-save').disabled=state.busy || !orderCanSave();
  $('order-reset').disabled=state.busy || orderSame(ids,orderDefaultFor(scope));
}
$('order-items').addEventListener('pointermove',event=>{
  if(!orderDrag || orderDrag.pointerId!==event.pointerId)return;
  const target = document.elementFromPoint(event.clientX,event.clientY)?.closest('.order-item');
  if(target && $('order-items').contains(target)) orderMove(orderDrag.id,target.dataset.id);
});
function stopOrderDrag(event) {
  if(!orderDrag || orderDrag.pointerId!==event.pointerId)return;
  const list=$('order-items');
  if(list.hasPointerCapture(event.pointerId))list.releasePointerCapture(event.pointerId);
  orderDrag=null;
  renderOrder();
}
$('order-items').addEventListener('pointerup',stopOrderDrag);
$('order-items').addEventListener('pointercancel',stopOrderDrag);
$('order-items').addEventListener('lostpointercapture',()=>{if(orderDrag){orderDrag=null;renderOrder();}});
document.querySelectorAll('[data-order-scope]').forEach(button=>button.addEventListener('click',()=>{
  state.orderScope=button.dataset.orderScope;
  state.featuredSwapTarget=null;
  state.featuredCandidate=null;
  renderOrder();
  $('order-message').textContent='调整后点击保存即可同步本地网页。首页精选和全部作品互不锁定。';
}));
document.querySelectorAll('[data-order-category]').forEach(button=>button.addEventListener('click',()=>{
  state.orderCategory=button.dataset.orderCategory;
  renderOrder();
  $('order-message').textContent='现在展示与作品网页一致的分类筛选。拖动后点击保存，才会更新本地网页。';
}));
document.querySelectorAll('[data-featured-pool-category]').forEach(button=>button.addEventListener('click',()=>{
  state.featuredPoolCategory=button.dataset.featuredPoolCategory;
  renderOrder();
}));
$('order-reset').addEventListener('click',()=>{
  if(!state.ordering)return;
  state.orderDraft[state.orderScope]=orderDefaultFor(state.orderScope);
  if(state.orderScope==='featured'){
    state.featuredSwapTarget=null;
    state.featuredCandidate=null;
  }
  renderOrder();
  $('order-message').textContent='已在页面恢复原始顺序，点击「保存当前顺序」后才会应用到网站。';
});
$('order-save').addEventListener('click',()=>action(async()=>{
  const scope=state.orderScope;
  if(!orderCanSave(scope))return;
  const requested=[...state.orderDraft[scope]];
  const result=await api('/api/save-order',{
    scope,ids:requested,expected:[...state.orderBaseline[scope]],confirmed:true,
  });
  state.orderBaseline.featured=[...result.featured];
  state.orderBaseline.all=[...result.all];
  state.orderDraft.featured=[...result.featured];
  state.orderDraft.all=[...result.all];
  state.ordering.projects.forEach(project=>{project.featured=result.featured.includes(project.id);});
  state.featuredSwapTarget=null;
  state.featuredCandidate=null;
  renderOrder();
  $('order-message').textContent=`已保存${scope==='featured'?'首页精选':'全部作品'}的 ${requested.length} 部作品顺序。刷新对应本地网页即可查看。`;
  status('排序已保存到本地配置，未推送 GitHub 或 Netlify。');
}));

libraryUI=createLibraryUI({
  state,api,bootstrap,setWorkflow,openCoverWorkflow,openPosterWorkflow,showManaged,openNewProject,
});
action(async () => {
  await bootstrap();
  status('已载入 '+state.projects.length+' 部作品。点击封面即可编辑。');
});
