// Single in-place history view shared by the card cover and each player-poster variant.
// The server decides which revisions are valid; never construct filesystem paths here.
const $=id=>document.getElementById(id);
const node=(tag,cls,text)=>{
  const e=document.createElement(tag);
  if(cls)e.className=cls;
  if(text!==undefined)e.textContent=String(text);
  return e;
};
const formatDate=value=>{
  if(!value)return '时间未知';
  try{return new Intl.DateTimeFormat('zh-CN',{
    year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,
  }).format(new Date(value));}
  catch{return '时间未知';}
};
export function createArtworkHistoryUI({api,refresh,notify}){
  let view=null,selected=null,nonce=0,working=false,lastFocus=null;
  const wrapper=$('ux-history-dialog');
  const status=(message,error=false)=>{
    $('ux-history-status').textContent=message;
    $('ux-history-status').dataset.error=String(error);
  };
  function close(){
    if(working)return;
    ++nonce;
    view=null;selected=null;
    wrapper.hidden=true;
    $('ux-editor').inert=false;
    $('ux-history-content').hidden=true;
    $('ux-history-list').replaceChildren();
    $('ux-history-restore').disabled=true;
    const origin=lastFocus;lastFocus=null;
    if(origin?.isConnected)origin.focus({preventScroll:true});
  }
  function select(entry){
    if(!view||working)return;
    selected=entry;
    $('ux-history-preview').src=entry.imageUrl;
    $('ux-history-preview-label').textContent='准备恢复 · '+formatDate(entry.at);
    status('已选中历史图片（'+formatDate(entry.at)+'）。右侧预览确认后可恢复；当前图片会自动备份。');
    for(const e of $('ux-history-list').querySelectorAll('button')){
      e.setAttribute('aria-pressed',String(e.dataset.revision===entry.id));
    }
    $('ux-history-restore').disabled=false;
    $('ux-history-restore').textContent='恢复这张'+(view.kind==='cover'?'封面':'海报');
  }
  function draw(){
    if(!view)return;
    const {entries}=view;
    // Never reveal empty black image panels while large historical WebPs load.
    $('ux-history-content').hidden=true;
    $('ux-history-count').textContent=entries.length+' 条';
    const target=$('ux-history-list');target.replaceChildren();
    if(!entries.length){
      status('还没有可恢复的旧图。下次替换时会自动备份到这里。');
      $('ux-history-restore').disabled=true;
      return;
    }
    status('正在加载当前画面与历史封面…');
    $('ux-history-current').src=view.currentUrl+'?historyNow='+Date.now();
    const frag=document.createDocumentFragment();
    for(const item of entries){
      const button=node('button','ux-history-item');
      button.type='button';button.dataset.revision=item.id;
      button.setAttribute('aria-pressed','false');
      button.setAttribute('aria-label','选择'+formatDate(item.at)+'的历史图片');
      const image=node('img');image.src=item.imageUrl;image.loading='lazy';
      image.alt='历史封面缩略图';
      const meta=node('span','ux-history-meta');
      meta.append(node('strong','',formatDate(item.at)),node('small','',item.source));
      button.append(image,meta);
      button.addEventListener('click',()=>select(item));
      frag.append(button);
    }
    target.append(frag);
    select(entries[0]);
    $('ux-history-restore').disabled=true;
    const currentRun=nonce;
    Promise.allSettled([
      $('ux-history-current').decode(),
      $('ux-history-preview').decode(),
    ]).then(results=>{
      if(currentRun!==nonce||!view)return;
      $('ux-history-content').hidden=false;
      const failed=results.some(item=>item.status==='rejected');
      $('ux-history-restore').disabled=failed;
      if(failed)
        status('有图片暂时无法解码，已禁止恢复。请检查历史备份后重试。',true);
      else status('先比较当前画面与历史画面，确认后再恢复。');
    });
  }
  async function open({kind,projectId,variantId='main',variantLabel='',title,opener}){
    if(working)return;
    ++nonce;
    const run=nonce;
    lastFocus=opener||document.activeElement;
    view=null;selected=null;
    wrapper.hidden=false;
    $('ux-editor').inert=true;
    $('ux-history-content').hidden=true;
    $('ux-history-restore').disabled=true;
    $('ux-history-restore').textContent='恢复选中的封面';
    $('ux-history-title').textContent=kind==='cover'?'3:4 封面历史':'播放器海报历史';
    $('ux-history-kicker').textContent=title+(kind==='cover'?' · 作品卡片':
      ' · '+(variantLabel||(variantId==='main'?'主版本':'视频版本')));
    $('ux-history-subtitle').textContent='恢复操作只修改选中的'+(kind==='cover'?'3:4 作品封面':'播放器海报')+'。';
    status('正在读取本地历史备份…');
    $('ux-history-close').focus({preventScroll:true});
    try{
      const query=new URLSearchParams({kind,projectId,variantId});
      const response=await fetch('/api/artwork-history?'+query);
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'读取失败');
      if(run!==nonce)return;
      view=result;
      wrapper.dataset.orientation=Number(result.currentAspectRatio)>1.1?'landscape':'portrait';
      wrapper.style.setProperty('--history-image-ratio',String(result.currentAspectRatio||3/4));
      draw();
    }catch(error){
      if(run===nonce)status('读取失败：'+error.message,true);
    }
  }
  async function restore(){
    if(!view||!selected||working)return;
    const snapshot={...view},revision=selected.id;
    working=true;
    $('ux-history-restore').disabled=true;
    $('ux-history-cancel').disabled=true;
    $('ux-history-close').disabled=true;
    $('ux-history-list').setAttribute('aria-busy','true');
    status('正在恢复旧图，并备份当前图片…');
    try{
      await api('/api/restore-artwork',{
        projectId:snapshot.projectId,kind:snapshot.kind,variantId:snapshot.variantId,
        revisionId:revision,expectedHash:snapshot.currentHash,confirmed:true,
      });
      const projectId=snapshot.projectId,variantId=snapshot.variantId,kind=snapshot.kind;
      working=false;
      close();
      await refresh(projectId,variantId);
      notify((kind==='cover'?'作品封面':'播放器海报')+'已恢复到当前作品 · 刚才使用的图片已备份在历史中。');
    }catch(error){
      status('恢复失败：'+error.message,true);
    }finally{
      working=false;
      $('ux-history-restore').disabled=!selected;
      $('ux-history-cancel').disabled=false;
      $('ux-history-close').disabled=false;
      $('ux-history-list').removeAttribute('aria-busy');
    }
  }
  $('ux-history-close').addEventListener('click',close);
  $('ux-history-cancel').addEventListener('click',close);
  wrapper.querySelector('[data-ux-history-close]').addEventListener('click',close);
  $('ux-history-restore').addEventListener('click',restore);
  return {open,close,isOpen:()=>!wrapper.hidden,isBusy:()=>working};
}
