// Live refresh for *local Vite preview only*. Production Netlify never
// contacts the local workbench, and video files are never requested here.
import {useCallback,useSyncExternalStore} from 'react';

const previewPort=import.meta.env.VITE_LOCAL_PREVIEW_PORT||'5174';
const studioPort=import.meta.env.VITE_LOCAL_STUDIO_PORT||'5190';
const enabled=import.meta.env.DEV
  && ['127.0.0.1','localhost'].includes(window.location.hostname)
  && window.location.port===previewPort;
const listeners=new Set();
const revisions=new Map();
let events=null;
let reloadObserver=null;
function refreshDataWhenSafe(){
  if(!document.querySelector('.cinema-player[open]')){window.location.reload();return;}
  if(reloadObserver)return;
  reloadObserver=new MutationObserver(()=>{
    if(document.querySelector('.cinema-player[open]'))return;
    reloadObserver.disconnect();reloadObserver=null;
    window.location.reload();
  });
  reloadObserver.observe(document.body,{subtree:true,childList:true,
    attributes:true,attributeFilter:['open']});
}
const keyFor=(kind,id,variant='main')=>kind+':'+String(id||'')+':'+String(variant);

function start(){
  if(!enabled||events||!listeners.size)return;
  const stream=new EventSource('http://127.0.0.1:'+studioPort+'/api/preview-events');
  events=stream;
  stream.addEventListener('artwork',message=>{
    try{
      const {kind,projectId,variantId='main',revision}=JSON.parse(message.data);
      if(kind==='reload'){
        // Title/path/order changes must update the entire imported JS data model.
        // Artwork-only changes never reload the page or interrupt a playing video.
        refreshDataWhenSafe();
        return;
      }
      if(!['cover','poster'].includes(kind)||!projectId||!revision)return;
      revisions.set(keyFor(kind,projectId,variantId),String(revision)+'-'+Date.now());
      for(const cb of listeners)cb();
    }catch(error){console.warn('本地封面更新通知无法解析：',error);}
  });
}
const subscribe=callback=>{
  listeners.add(callback);
  start();
  return ()=>{
    listeners.delete(callback);
    if(!listeners.size&&events){events.close();events=null;}
  };
};

export function useLocalArtworkRevision(kind,id,variant='main'){
  const key=keyFor(kind,id,variant);
  const getSnapshot=useCallback(()=>revisions.get(key)||'', [key]);
  return useSyncExternalStore(subscribe,getSnapshot,()=> '');
}
export function revisionedArtworkUrl(url,revision){
  if(!url||!revision||!enabled)return url;
  const separator=url.includes('?')?'&':'?';
  return url+separator+'localArtworkRevision='+encodeURIComponent(revision);
}
