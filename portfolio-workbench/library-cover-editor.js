// In-place artwork editing. Works entirely inside the selected work's drawer.
// Source videos and completed assets remain untouched until the explicit Save.
const el=id=>document.getElementById(id);
const TIME=t=>Number(t).toFixed(1)+' 秒';
const asImage=src=>new Promise((resolve,reject)=>{
  const img=new Image();
  img.onload=()=>resolve(img);
  img.onerror=()=>reject(new Error('选帧图片无法读取，请重新选择。'));
  img.src=src;
});
export function createInlineCoverEditor({state,api,refresh,notify,player}){
  let task=null,session=null,frame=null,picture=null,seq=0,busy=false,saving=false;
  let importPromise=null,pendingTime=null,pendingLast=false,originalPreview=null,previewBlob=null;
  // The native MP4 element seeks synchronously from the editor's perspective.
  // FFmpeg decodes only after the user stops stepping, never on every click.
  let cursorTime=0,selectionToken=0,extractTimer=null;
  const canvas=el('ux-inline-canvas'),ctx=canvas.getContext('2d');
  const stage=el('ux-inline-cover');
  const say=(text,error=false)=>{
    const label=el('ux-inline-status');
    label.textContent=text;
    label.dataset.error=String(error);
  };
  const validPoster=()=>{
    if(!task||!frame)return false;
    if(task.kind!=='poster')return true;
    return Math.abs(frame.width/frame.height-task.variant.width/task.variant.height)<=.018;
  };
  const frameInterval=()=>session?.metadata?.fps>0?1/session.metadata.fps:1/25;
  const lastTime=()=>Math.max(0,Number(session?.metadata?.lastFrameTime)||0);
  const timeFromInput=()=>{
    const t=Number.isFinite(cursorTime)?cursorTime:player.time();
    return Math.max(0,Math.min(lastTime(),t));
  };
  const setCursor=(time,last=false)=>{
    const t=last?lastTime():Math.max(0,Math.min(lastTime(),Number(time)||0));
    cursorTime=t;
    el('ux-inline-time-input').value=t.toFixed(6);
    return t;
  };
  const stopScheduledExtraction=()=>{
    clearTimeout(extractTimer);extractTimer=null;
    selectionToken++;
  };
  const sync=()=>{
    const videoReady=Boolean(task&&session&&!busy&&!saving&&session.kind==='video');
    el('ux-inline-save').disabled=busy||saving||!task||!session||
      (frame&&Math.abs(Number(frame.time)-timeFromInput())<frameInterval()*.35&&!validPoster());
    for(const name of ['ux-inline-first','ux-inline-prev','ux-inline-next','ux-inline-last']){
      const button=el(name);
      if(button)button.disabled=!videoReady;
    }
    el('ux-inline-image').disabled=busy||saving;
    const target=task?.kind==='poster'?'原比例播放器海报':'3:4 卡片封面';
    el('ux-inline-save').textContent=busy?'正在处理…':(frame?'保存选中画面为':'保存当前画面为')+target;
  };
  function resetSelection(){
    stopScheduledExtraction();
    frame=null;picture=null;pendingTime=null;pendingLast=false;cursorTime=0;
    el('ux-inline-time-input').value='0';
    el('ux-frame-progress').textContent='';
    el('ux-inline-original').hidden=true;
    el('ux-inline-original').removeAttribute('src');
    ctx.clearRect(0,0,900,1200);
    el('ux-inline-preview-frame').classList.remove('ux-has-preview');
    sync();
  }
  function paint(){
    if(!picture)return;
    const w=900,h=1200,iw=picture.naturalWidth,ih=picture.naturalHeight;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle='#101720';ctx.fillRect(0,0,w,h);
    const fill=Math.max(w/iw,h/ih),contain=Math.min(w/iw,h/ih);
    if(Math.abs(iw/ih-w/h)>.001){
      ctx.save();ctx.filter='blur(48px) brightness(.42)';
      ctx.drawImage(picture,(w-iw*fill)/2-60,(h-ih*fill)/2-60,iw*fill+120,ih*fill+120);
      ctx.restore();
    }
    const sw=iw*contain,sh=ih*contain;
    ctx.drawImage(picture,(w-sw)/2,(h-sh)/2,sw,sh);
  }
  function presentation(){
    const poster=task?.kind==='poster';
    el('ux-inline-canvas').hidden=poster;
    el('ux-inline-original').hidden=!poster;
    el('ux-inline-preview-frame').dataset.type=poster?'poster':'cover';
    if(!picture)return;
    if(poster)el('ux-inline-original').src=picture.src;
    else paint();
    const visible=el(poster?'ux-poster-img':'ux-cover-img');
    if(poster){
      visible.src=picture.src;
      visible.dataset.pending='true';
    }else{
      // The local workbench CSP allows blob: but deliberately forbids data:
      // URLs as image sources. Preview the exact canvas as a temporary blob.
      const stamp=seq,currentTask=task;
      canvas.toBlob(blob=>{
        if(!blob||stamp!==seq||task!==currentTask)return;
        if(previewBlob)URL.revokeObjectURL(previewBlob);
        previewBlob=URL.createObjectURL(blob);
        visible.src=previewBlob;
        visible.dataset.pending='true';
      },'image/png');
    }
    el('ux-preview-guidance').textContent='预览中 · 尚未保存';
    el('ux-preview-guidance').dataset.pending='true';
    el('ux-inline-preview-frame').classList.add('ux-has-preview');
  }
  async function chooseFrame(time,id=seq,lastFrame=false,token=selectionToken){
    if(!session||!task)return false;
    const targetTask=task,targetSession=session;
    const isCurrent=()=>id===seq&&token===selectionToken&&
      task===targetTask&&session===targetSession;
    const data=await api('/api/frame',{sessionId:targetSession.id,time,lastFrame});
    if(!isCurrent())return false;
    const image=await asImage(data.url);
    if(!isCurrent())return false;
    frame=data;picture=image;
    setCursor(data.time,data.lastFrame);
    presentation();
    el('ux-inline-title').textContent=data.lastFrame?'已选中视频尾帧':'已选中 '+Number(data.time).toFixed(3)+' 秒';
    if(!validPoster())say('这张图片与当前视频的实际比例不一致。请更换视频画面。',true);
    else say('已预览选定画面，可继续逐帧调整或直接保存。');
    sync();
    return true;
  }
  async function importProjectVideo(id=seq){
    const current=task;
    say('正在读取当前视频的帧率和时长，不生成多余的候选缩略图…');
    const data=await api('/api/import-project-video',{
      projectId:current.projectId,variantId:current.variant.id,
    });
    if(id!==seq||!task)return;
    session=data;
    el('ux-inline-time-input').max=Number(data.metadata.lastFrameTime??data.metadata.duration??0).toFixed(6);
    if(pendingTime===null)setCursor(player.time());
    el('ux-frame-progress').textContent='可逐帧定位';
    sync();
    say('拖动上方时间轴，或使用 ← → 逐帧微调；停下后更新高清预览。');
  }
  async function uploadImage(file,id=seq){
    const name=file.name||'cover.png';
    const r=await fetch('/api/import?kind=image&name='+encodeURIComponent(name),{
      method:'POST',headers:{'X-Cover-Token':state.token},body:file,
    });
    const data=await r.json();
    if(!r.ok)throw new Error(data.error||'导入图片失败。');
    if(id!==seq||!task)return;
    session=data;frame=null;picture=null;
    await chooseFrame(0,id);
  }
  function cancel({force=false}={}){
    if(saving&&!force){
      say('正在保存正式封面，完成后即可退出，以免漏掉刷新。');
      return;
    }
    ++seq;
    stopScheduledExtraction();
    const previous=task;
    if(previous&&originalPreview){
      const target=el(previous.kind==='poster'?'ux-poster-img':'ux-cover-img');
      if(target.dataset.pending==='true'){target.src=originalPreview;delete target.dataset.pending;}
    }
    task=null;session=null;busy=false;importPromise=null;
    resetSelection();stage.hidden=true;
    stage.dataset.kind='';
    player.selectMode(false);
    el('ux-stage-instruction').hidden=false;
    el('ux-preview-guidance').textContent='点击任一封面下方的更换按钮';
    delete el('ux-preview-guidance').dataset.pending;
    el('ux-inline-image').value='';
    el('ux-inline-status').textContent='';
    originalPreview=null;
    if(previewBlob){URL.revokeObjectURL(previewBlob);previewBlob=null;}
  }
  async function start(kind,projectId,variant){
    if(busy)return;
    cancel();
    task={kind,projectId,variant};
    const current=task;
    stage.hidden=false;
    stage.dataset.kind=kind;
    originalPreview=el(kind==='poster'?'ux-poster-img':'ux-cover-img').src;
    player.selectMode(true);
    el('ux-stage-instruction').hidden=true;
    player.pause();
    el('ux-inline-mode-label').textContent=kind==='poster'?'播放器海报 · 原比例':'作品卡片封面 · 3:4';
    el('ux-inline-title').textContent=kind==='poster'?'选择播放器静止画面':'选择新的卡片画面';
    el('ux-inline-safe-note').textContent=kind==='poster'
      ?'原比例完整保留，只更换当前视频版本的播放器海报；旧图会备份。'
      :'自动完整保留取帧构图并补背景，不需要裁切设置；旧封面会备份。';
    const img=el('ux-inline-old');
    img.src=kind==='poster'
      ?'/project-poster/'+encodeURIComponent(projectId)+'/'+encodeURIComponent(variant.id)+'?v='+Date.now()
      :'/project-cover/'+encodeURIComponent(projectId)+'?v='+Date.now();
    sync();
    const id=seq;
    say('原封面保持不变；拖动时间轴、逐帧定位，或直接点保存当前画面。');
    // Do not silently choose the first MP4 frame. Intro black frames can make
    // a good existing cover appear to vanish before the user has picked one.
    // Explicit timeline seeks and frame-step clicks during import queue their time.
    pendingTime=null;pendingLast=false;
    cursorTime=player.time();
    el('ux-inline-time-input').value=cursorTime.toFixed(6);
    busy=true;sync();
    importPromise=importProjectVideo(id);
    try{await importPromise;}
    catch(error){
      if(id===seq)say('视频选帧准备失败：'+error.message+'。请重新尝试，或导入图片。',true);
    }
    finally{
      if(id===seq){
        busy=false;sync();
        if(pendingTime!==null&&session){
          const t=pendingTime,last=pendingLast;pendingTime=null;pendingLast=false;
          await selectAtTime(t,id,last);
        }
      }
    }
  }
  async function save(){
    if(!task||!session||busy||saving)return;
    const selected=task,stamp=seq,pickedTime=player.getVideo().paused?
      timeFromInput():Math.min(lastTime(),player.time());
    const useLast=session.kind==='video'&&
      Math.abs(pickedTime-lastTime())<frameInterval()*.45;
    stopScheduledExtraction(); // Ignore any older FFmpeg response.
    const token=selectionToken;
    saving=true;busy=true;sync();
    say('正在保存当前定位的画面，旧图会自动备份…');
    try{
      // Capture the FINAL playhead, not a frame from an earlier step.
      if(session.kind==='video'&&(!frame||
          Math.abs(Number(frame.time)-pickedTime)>frameInterval()*.35||
          Boolean(frame.lastFrame)!==Boolean(useLast))){
        const ok=await chooseFrame(pickedTime,stamp,useLast,token);
        if(!ok||stamp!==seq||task!==selected)return;
      }
      if(!frame)throw new Error('当前画面提取失败，请重新选择。');
      if(!validPoster())throw new Error('图片比例不匹配，无法用于此播放器海报。');
      if(selected.kind==='poster')paint();
      const result=await api('/api/export',{
        sessionId:session.id,frameId:frame.frameId,time:frame.time,
        mode:'contain-blur',x:.5,y:.5,
        previewPng:canvas.toDataURL('image/png'),confirmed:true,
      });
      if(stamp!==seq||task!==selected)return;
      if(selected.kind==='poster'){
        await api('/api/associate-poster',{
          projectId:selected.projectId,variantId:selected.variant.id,
          exportId:result.id,expectedPoster:selected.variant.poster,
          expectedTime:selected.variant.time??null,confirmed:true,
        });
      }else{
        await api('/api/associate',{
          projectId:selected.projectId,exportId:result.id,
          confirmed:true,replaceExisting:true,
          expectedCover:state.overrides[selected.projectId]||null,
        });
      }
      if(stamp!==seq)return;
      if(task){const target=el(task.kind==='poster'?'ux-poster-img':'ux-cover-img');delete target.dataset.pending;}
      await refresh(selected.projectId,selected.variant.id);
      cancel({force:true});
      notify(selected.kind==='poster'?'播放器原比例海报已保存，卡片封面未修改。':'3:4 卡片封面已保存，播放器海报未修改。');
    }catch(error){if(stamp===seq)say('保存失败：'+error.message,true);}
    finally{saving=false;busy=false;sync();}
  }
  el('ux-inline-cancel').addEventListener('click',()=>cancel());
  el('ux-inline-save').addEventListener('click',save);
  function selectAtTime(time,id=seq,forceLast=false){
    if(!task||saving)return;
    const fps=Number(session?.metadata?.fps)||25;
    const final=lastTime();
    const useLast=Boolean(session&&session.kind==='video'&&
      (forceLast||Number(time)>=final-.5/fps));
    const t=setCursor(time,useLast);
    // Immediate visual feedback comes from the local HTMLVideoElement,
    // not from waiting for a new PNG to be decoded by FFmpeg.
    player.pause();player.seek(t);
    el('ux-inline-title').textContent=useLast?'尾帧 · '+t.toFixed(3)+' 秒':'定位 · '+t.toFixed(3)+' 秒';
    const token=++selectionToken;
    clearTimeout(extractTimer);
    if(!session||busy){
      pendingTime=t;pendingLast=useLast;
      say('正在准备当前视频，定位已记录…');
      return;
    }
    say('当前位置已更新，停止操作后生成高清预览。');
    // Debounce rapid keyboard repeats and clicks; old in-flight responses
    // have their token invalidated and may never replace a newer selection.
    extractTimer=setTimeout(async()=>{
      extractTimer=null;
      if(id!==seq||token!==selectionToken||!task||saving)return;
      try{await chooseFrame(t,id,useLast,token);}
      catch(error){
        if(id===seq&&token===selectionToken)say('取帧失败：'+error.message,true);
      }
    },260);
    sync();
  }
  function stepFrame(direction){
    if(!task||!session||session.kind!=='video'||busy||saving)return;
    const fps=Number(session.metadata.fps)||25;
    const maxIndex=Math.max(0,Math.round(lastTime()*fps));
    const index=Math.max(0,Math.min(maxIndex,Math.round(timeFromInput()*fps)+direction));
    const time=index===maxIndex?lastTime():index/fps;
    selectAtTime(time,seq,index===maxIndex);
  }
  el('ux-inline-prev').addEventListener('click',()=>stepFrame(-1));
  el('ux-inline-next').addEventListener('click',()=>stepFrame(1));
  el('ux-inline-first').addEventListener('click',()=>selectAtTime(0));
  el('ux-inline-last').addEventListener('click',()=>selectAtTime(lastTime(),seq,true));
  // Keyboard auto-repeat gives timeline-like frame stepping, without another
  // text field taking focus or triggering a per-keystroke FFmpeg job.
  document.addEventListener('keydown',event=>{
    if(!task||stage.hidden||event.altKey||event.metaKey||event.ctrlKey||
        !['ArrowLeft','ArrowRight'].includes(event.key)||
        !document.getElementById('ux-unsaved-dialog').hidden||
        !document.getElementById('ux-history-dialog').hidden)return;
    if(event.target.closest('input:not([type=range]),textarea,select,[contenteditable=true]'))return;
    event.preventDefault();event.stopImmediatePropagation();
    stepFrame(event.key==='ArrowLeft'?-1:1);
  },true);
  el('ux-inline-image').addEventListener('change',async event=>{
    const file=event.target.files?.[0];
    event.target.value='';
    if(!file||!task||busy)return;
    busy=true;sync();say('正在读取图片…');
    const id=seq;
    try{await uploadImage(file,id);}
    catch(e){if(id===seq)say(e.message,true);}
    finally{if(id===seq){busy=false;sync();}}
  });
  return {
    start,cancel,active:()=>Boolean(task),
    hasDraft:()=>Boolean(task&&frame),
    busy:()=>saving,
    selectAtTime,
    syncTime(time){
      if(!task||player.getVideo().paused)return;
      setCursor(time);
    }
  };
}
