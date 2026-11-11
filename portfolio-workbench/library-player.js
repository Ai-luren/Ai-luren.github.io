// Local MP4 playback. Range requests stay inside the loopback workbench.
// A single video drives preview, scrubbing, and the still-frame selection.
export function createLibraryPlayer({onCommitTime,onTimeChange}){
  const $=id=>document.getElementById(id);
  const video=$('ux-video-preview'),range=$('ux-video-timeline');
  const play=$('ux-play-toggle'),clock=$('ux-time-display');
  const error=$('ux-video-error');
  let currentSource='',dragging=false,selectionMode=false,previewBlob=null;
  const displayTime=(s,precise=false)=>{
    const t=Math.max(0,Number(s)||0);
    const minutes=Math.floor(t/60);
    if(precise){
      const milliseconds=Math.round(t*1000);
      const seconds=Math.floor(milliseconds/1000)%60;
      const fraction=String(milliseconds%1000).padStart(3,'0');
      return minutes+':'+String(seconds).padStart(2,'0')+'.'+fraction;
    }
    return minutes+':'+String(Math.floor(t%60)).padStart(2,'0');
  };
  const duration=()=>Number.isFinite(video.duration)?video.duration:0;
  const safeTime=time=>Math.max(0,Math.min(Math.max(0,duration()-.04),Number(time)||0));
  const refresh=()=>{
    const t=Number.isFinite(video.currentTime)?video.currentTime:0;
    range.max=String(Math.max(0,duration()-.04));
    if(!dragging)range.value=String(t);
    clock.textContent=displayTime(t,selectionMode)+' / '+displayTime(duration());
    play.textContent=video.paused?'▶':'Ⅱ';
    play.setAttribute('aria-label',video.paused?'播放视频':'暂停视频');
    if(!dragging)onTimeChange?.(t);
  };
  const releasePreview=()=>{
    if(previewBlob){URL.revokeObjectURL(previewBlob);previewBlob=null;}
  };
  const setSource=(id,version)=>{
    const next='/project-video/'+encodeURIComponent(id)+'/'+encodeURIComponent(version);
    // The MP4 source may be unchanged, but a freshly saved player poster
    // must still be refreshed. Always use a new revision URL for artwork.
    const posterUrl='/project-poster/'+encodeURIComponent(id)+'/'+encodeURIComponent(version)+'?v='+Date.now();
    // A softly blurred *local* poster fills the empty stage behind unusually
    // wide or vertical video. The true pixels remain completely unobstructed.
    video.parentElement.style.setProperty('--stage-ambient','url("'+posterUrl+'")');
    if(currentSource===next&&!previewBlob){
      video.poster=posterUrl;
      return;
    }
    video.pause();
    releasePreview();
    currentSource=next;
    video.poster=posterUrl;
    video.src=next;
    video.load();
    error.hidden=true;
    error.textContent='';
    range.value='0';
    clock.textContent='0:00 / 0:00';
    refresh();
  };
  function previewFile(file){
    video.pause();releasePreview();
    previewBlob=URL.createObjectURL(file);
    currentSource='local-preview';
    video.removeAttribute('poster');
    video.parentElement.style.removeProperty('--stage-ambient');
    video.src=previewBlob;
    video.load();
    error.hidden=true;
    refresh();
  }
  function pause(){video.pause();}
  function clear(){
    video.pause();releasePreview();
    currentSource='';
    video.removeAttribute('src');
    video.removeAttribute('poster');
    video.parentElement.style.removeProperty('--stage-ambient');
    video.load();
    range.value='0';
    refresh();
  }
  const selectMode=active=>{
    selectionMode=Boolean(active);
    refresh();
  };
  const seek=t=>{
    if(duration()>0){
      video.currentTime=safeTime(t);
      refresh();
    }
  };
  video.addEventListener('loadedmetadata',()=>{
    range.disabled=false;
    refresh();
  });
  video.addEventListener('timeupdate',refresh);
  video.addEventListener('durationchange',refresh);
  video.addEventListener('play',refresh);
  video.addEventListener('pause',refresh);
  video.addEventListener('seeked',refresh);
  video.addEventListener('error',()=>{
    // Browser playback may not support the local MP4 codec; FFmpeg frame selection still works.
    error.hidden=false;
    error.textContent='此 MP4 无法在浏览器直接播放，可以使用逐帧按钮提取画面，或导入图片。';
  });
  video.addEventListener('click',()=>play.click());
  play.addEventListener('click',async()=>{
    if(video.paused){
      try{await video.play();}
      catch{error.hidden=false;error.textContent='视频无法播放，可逐帧提取画面或导入图片。';}
    }else video.pause();
    refresh();
  });
  range.addEventListener('pointerdown',()=>dragging=true);
  range.addEventListener('input',()=>{
    const time=Number(range.value)||0;
    seek(time);
    clock.textContent=displayTime(time,selectionMode)+' / '+displayTime(duration());
    onTimeChange?.(time);
  });
  const commit=()=>{
    dragging=false;
    if(selectionMode)onCommitTime?.(safeTime(Number(range.value)));
    refresh();
  };
  range.addEventListener('change',commit);
  range.addEventListener('pointerup',()=>dragging=false);
  const handleShortcuts=e=>{
    if(!selectionMode||!currentSource)return;
    if(['INPUT','TEXTAREA'].includes(e.target?.tagName))return;
    if(e.code==='Space'){
      e.preventDefault();
      play.click();
    }else if(e.key==='ArrowRight'||e.key==='ArrowLeft'){
      e.preventDefault();
      pause();
      seek(video.currentTime+(e.key==='ArrowRight'?.2:-.2));
    }
  };
  video.addEventListener('keydown',handleShortcuts);
  range.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&selectionMode){event.preventDefault();commit();}
  });
  range.disabled=true;
  selectMode(false);
  return {
    setSource,previewFile,pause,clear,seek,selectMode,
    time:()=>safeTime(video.currentTime),
    duration,
    getVideo:()=>video,
    refresh,
  };
}
