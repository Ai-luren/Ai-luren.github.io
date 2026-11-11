import { createInlineCoverEditor } from './library-cover-editor.js';
import { imageKitVideoStem, imageKitVideoError, imageKitVideoURL } from './imagekit-url.js';
import { createLibraryPlayer } from './library-player.js';
import {createArtworkHistoryUI} from './library-history.js';
// Unified work-first screen. The existing media and ordering APIs remain authoritative.
const $=id=>document.getElementById(id);
const categories=[['commercial','商业广告'],['short-film','创意短片'],['social','海外产品广告'],['visual','视觉实验']];
const node=(tag,className,value)=>{
  const out=document.createElement(tag);if(className)out.className=className;
  if(value!==undefined)out.textContent=String(value);return out;
};
const photo=(url,alt)=>{const x=node('img');x.src=url;x.alt=alt||'';x.loading='lazy';return x;};
const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const prefix='https://ik.imagekit.io/Ailuren/tr:orig-true/videos/';
const createPlusIcon=()=>{
  // Centered geometric cross; avoid the font "+" baseline and glyph offsets.
  const ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 24 24');
  svg.setAttribute('aria-hidden','true');
  svg.setAttribute('focusable','false');
  const path=document.createElementNS(ns,'path');
  path.setAttribute('d','M12 5V19M5 12H19');
  path.setAttribute('stroke','currentColor');
  path.setAttribute('stroke-width','2.25');
  path.setAttribute('stroke-linecap','round');
  svg.append(path);
  return svg;
};
const createEditIcon=()=>{
  const ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
  const path=document.createElementNS(ns,'path');
  path.setAttribute('d','m14 5 5 5M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z');
  path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','1.8');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');
  svg.append(path);return svg;
};
const createStarIcon=()=>{
  // A font's ☆ / ★ has a baseline and inconsistent ink bounds across OSes.
  // The vector's path spans equal x/y extents around (12,12), so it centers.
  const ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 24 24');
  svg.setAttribute('aria-hidden','true');
  svg.setAttribute('focusable','false');
  const path=document.createElementNS(ns,'path');
  path.setAttribute('d','M12 2L15.09 8.26L22 9.27L17 14.14L18.18 22L12 18.59L5.82 22L7 14.14L2 9.27L8.91 8.26Z');
  path.setAttribute('stroke-linejoin','round');
  svg.append(path);
  return svg;
};
export function createLibraryUI({state,api,bootstrap,setWorkflow,openCoverWorkflow,openPosterWorkflow,showManaged,openNewProject}){
 let filter='featured',search='',selectedId=null,selectedVersion='main',editingVersionId=null,swapping=null,drag=null,busy=false,activePanel='versions',archivePending=null;
 let notificationTimer=null,suppressDragClickUntil=0,suppressDragClickId=null,undoLast=null,inlineNameTimer=null;
 let beforeEditorFocus=null,pendingNavigation=null,unsavedOrigin=null,versionLabelOpener=null;
 let suppressUrlBlur=false,urlSaving=false;
 let versionDrag=null,versionSortBusy=false,suppressVersionClickUntil=0;
 // A stable image URL lets the browser reuse decoded thumbnails between tabs/searches.
 // Increment only after an actual save/restore, not on every gallery render.
 const artworkRevision={cover:new Map(),poster:new Map()};
 const bumpArtwork=id=>{
   artworkRevision.cover.set(id,(artworkRevision.cover.get(id)||0)+1);
   artworkRevision.poster.set(id,(artworkRevision.poster.get(id)||0)+1);
 };
 const coverURL=id=>'/project-cover/'+encodeURIComponent(id)+'?v='+(artworkRevision.cover.get(id)||0);
 const posterURL=(id,variantId)=>'/project-poster/'+encodeURIComponent(id)+'/'+encodeURIComponent(variantId||'main')+'?v='+(artworkRevision.poster.get(id)||0);
 // Detail arrows browse every work in the canonical full-portfolio order,
 // across category tabs. The tabs are filters, not navigation boundaries.
 let inlineCover;
 const player=createLibraryPlayer({
   onCommitTime:time=>inlineCover?.selectAtTime(time),
   onTimeChange:time=>inlineCover?.syncTime(time),
 });
 inlineCover=createInlineCoverEditor({
   state,api,player,notify:(message,error)=>notify(message,error),
   refresh:async(projectId,variantId)=>{
     await bootstrap();
     bumpArtwork(projectId);
     renderGallery();
     selectedId=projectId;selectedVersion=variantId;
     renderEditor();
   },
 });
 const history=createArtworkHistoryUI({
   api,notify:(message,error)=>notify(message,error),
   refresh:async(projectId,variantId)=>{
     await bootstrap();
     bumpArtwork(projectId);
     renderGallery();
     selectedId=projectId;selectedVersion=variantId;
     renderEditor();
   },
 });
 const list=()=>state.ordering?.projects||[];
 const recycle=()=>state.archived||{works:[],versions:[]};
 const trashCount=()=>recycle().works.length+recycle().versions.length;
 function selectPanel(panel,{focus=false}={}){
   if(panel==='details')panel='versions'; // Legacy call sites share the merged management pane.
   if(!['versions','artwork'].includes(panel))return;
   activePanel=panel;
   $('ux-editor').querySelectorAll('[data-ux-panel]').forEach(button=>{
     const selected=button.dataset.uxPanel===panel;
     button.setAttribute('aria-pressed',String(selected));
     button.tabIndex=selected?0:-1;
     if(selected&&focus)button.focus({preventScroll:true});
   });
   $('ux-editor').querySelectorAll('[data-ux-section]').forEach(section=>{
     section.hidden=section.dataset.uxSection!==panel;
   });
   if(panel==='artwork')$('ux-stage-instruction').textContent='更换封面或播放器海报请使用右侧按钮；可从当前视频选帧或导入图片。';
   else $('ux-stage-instruction').textContent='视频可在左侧播放；在右侧「作品管理」调整版本、名称、线上链接或精选设置。';
 }
 $('ux-editor').querySelectorAll('[data-ux-panel]').forEach(button=>{
   button.addEventListener('click',()=>navigateWithDraft(()=>selectPanel(button.dataset.uxPanel)));
   button.addEventListener('keydown',event=>{
     if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
     event.preventDefault();
     const buttons=[...$('ux-editor').querySelectorAll('[data-ux-panel]')];
     const i=buttons.indexOf(button),next=buttons[(i+(event.key==='ArrowLeft'?-1:1)+buttons.length)%buttons.length];
     navigateWithDraft(()=>selectPanel(next.dataset.uxPanel,{focus:true}));
   });
 });
 const byId=id=>list().find(p=>p.id===id);
 const isFeatured=id=>state.orderDraft?.featured.includes(id);
 const managed=id=>state.managed.find(p=>p.id===id);
 const versions=id=>state.posterVersions.find(p=>p.id===id)?.versions||[];
 const versionById=(id,versionId)=>versions(id).find(v=>v.id===versionId);
 const poster=id=>versions(id).find(v=>v.id===selectedVersion)||versions(id)[0];
 const firstVersion=id=>versions(id)[0]?.id||'main';
 const editableURL=()=>imageKitVideoURL($('ux-url-value').value);
 const filenameOf=imageKitVideoStem;
 const urlError=()=>imageKitVideoError($('ux-url-value').value);
 const syncUrlValidation=()=>{
   const error=$('ux-url-form').hidden?'':urlError();
   $('ux-url-validation').hidden=!error;$('ux-url-validation').textContent=error;
   $('ux-url-value').setAttribute('aria-invalid',String(Boolean(error)));
   $('ux-url-save').disabled=Boolean(error)||urlSaving;
 };
 const syncContext=(message='')=>{
   const project=selectedId&&byId(selectedId),v=selectedId&&poster(selectedId);
   if(!project)return;
   $('ux-context-work').textContent=project.title+' · #'+project.id;
   $('ux-context-version').textContent=v?.label?.zh||'主版本';
   $('ux-context-hint').textContent=message||'';
   $('ux-context-hint').hidden=!message;
   syncSaveIndicator();
 };
 const syncVersionLabelDraftStatus=()=>{
   if(!editingVersionId||$('ux-version-label-form').hidden)return;
   const current=versionById(selectedId,editingVersionId)?.label||{zh:'',en:''};
   const changed=$('ux-version-label-zh').value.trim()!==current.zh||$('ux-version-label-en').value.trim()!==current.en;
   syncSaveIndicator();
 };

 const catName=id=>categories.find(x=>x[0]===id)?.[1]||'作品';
 const changed=scope=>!same(state.orderDraft[scope],state.orderBaseline[scope]);
 const dirty=()=>changed('all')||changed('featured');
 const draftSections=()=>{
   const p=selectedId&&byId(selectedId);
   const work=selectedId&&managed(selectedId);
   const actual=work?.versions.find(v=>v.id===selectedVersion)?.videoUrl||'';
   return {
     title:Boolean(p&&($('ux-title-zh').value.trim()!==p.title||
       $('ux-title-en').value.trim()!==(p.titleEn||''))),
     url:!$('ux-url-form').hidden&&editableURL()!==(actual||''),
     version:!$('ux-version-form').hidden&&Boolean($('ux-version-file').files?.length),
      versionLabel:!$('ux-version-label-form').hidden&&Boolean(editingVersionId)&&(()=>{
        const current=versionById(selectedId,editingVersionId)?.label||{zh:'',en:''};
        return $('ux-version-label-zh').value.trim()!==current.zh||$('ux-version-label-en').value.trim()!==current.en;
      })(),
     cover:Boolean(inlineCover?.hasDraft?.()),
   };
 };
 const anyDraft=()=>Object.values(draftSections()).some(Boolean);
 function syncSaveIndicator({saving=false,error=false}={}){
   const indicator=$('ux-context-save');
   if(!selectedId||!indicator)return;
   const issues=draftSections(),labels=[
     issues.title&&'作品名称',issues.versionLabel&&'版本名称',
     issues.url&&'视频地址',issues.version&&'待添加视频',issues.cover&&'封面画面',
   ].filter(Boolean);
   indicator.dataset.saveState=error?'error':saving?'saving':labels.length?'dirty':'saved';
   indicator.textContent=error?'保存失败 · 修改仍在当前页面':saving?'正在保存到本地…':
     labels.length?labels.join('、')+'有未保存修改':'已保存到本地 · 网站尚未发布';
 }

 const dismissUnsaved=()=>{
   $('ux-unsaved-dialog').hidden=true;
   $('ux-editor').inert=false;
   const origin=unsavedOrigin;
   pendingNavigation=null;unsavedOrigin=null;
   if(origin?.isConnected)origin.focus({preventScroll:true});
 };
 function navigateWithDraft(action){
   if(busy||inlineCover.busy()||history.isBusy()){
     notify('正在处理文件，请在操作完成后再切换。',true);return;
   }
   const issues=draftSections();
   if(!Object.values(issues).some(Boolean)){action();return;}
   pendingNavigation={action,issues};
   unsavedOrigin=document.activeElement;
   const labels=[issues.title&&'作品名称',issues.versionLabel&&'视频版本名称',issues.url&&'ImageKit 地址',
     issues.version&&'尚未添加的视频',issues.cover&&'已选中的封面'].filter(Boolean);
   $('ux-unsaved-description').textContent='这些修改尚未保存：'+labels.join('、')+'。可以继续编辑，或放弃本次草稿。';
   const savable=(issues.title||issues.url||issues.versionLabel)&&!issues.version&&!issues.cover &&
     Number(issues.title)+Number(issues.url)+Number(issues.versionLabel)===1;
   $('ux-unsaved-save').hidden=!savable;
   $('ux-unsaved-save').textContent=issues.title?'保存作品名称并继续':issues.versionLabel?'保存版本名称并继续':'保存地址并继续';
   $('ux-unsaved-dialog').hidden=false;
   $('ux-editor').inert=true;
   $('ux-unsaved-keep').focus({preventScroll:true});
 }
 const notify=(message,error=false)=>{
   $('status').textContent=message;$('status').classList.toggle('error',error);
   const toast=$('ux-toast')||node('div','ux-toast');
   toast.id='ux-toast';toast.setAttribute('role','status');toast.textContent=message;
   toast.dataset.error=String(error);document.body.append(toast);
   clearTimeout(notificationTimer);
   notificationTimer=setTimeout(()=>toast.remove(),error?6500:3500);
 };
 function updateSaveBar(){
   $('ux-sort-state').textContent=busy?'正在保存顺序…':undoLast?'顺序已保存到本地':'';
   $('ux-sort-undo').hidden=!undoLast;
   $('ux-sort-undo').disabled=busy;
 }
 function reservedVersions(id){
   return recycle().versions.filter(item=>item.projectId===id);
 }
 function syncVersionActions(){
   const full=versions(selectedId).length+reservedVersions(selectedId).length>=8;
   const disabled=busy||!managed(selectedId)||full;
   $('ux-add-variant').disabled=disabled;
   $('ux-add-variant').title=full?'每部作品最多 8 个视频版本（包含回收站版本；恢复后仍占用名额）':'为这部作品添加独立 MP4';
 }
 $('ux-sort-undo').addEventListener('click',undoSort);

 function renderFilters(){
   $('ux-trash-count').textContent=String(trashCount());
   $('ux-open-trash').setAttribute('aria-pressed',String(filter==='trash'));
   const target=$('ux-categories');target.replaceChildren();
   const options=[['featured','★ 首页精选',state.orderDraft.featured.length],
     ...categories.map(([id,label])=>[id,label,list().filter(p=>p.category===id).length])];
   for(const [key,title,count] of options){
     const b=node('button','ux-filter');b.type='button';
     b.dataset.filter=key;b.setAttribute('aria-pressed',String(!search&&key===filter));
     b.append(node('span','',title),node('small','',count));
     b.addEventListener('click',()=>{filter=key;search='';$('ux-search').value='';renderGallery();});
     target.append(b);
   }
   $('ux-overview').textContent=list().length+' 部作品 · '+state.orderDraft.featured.length+' 部首页精选';
   $('ux-search').placeholder='搜索全部 '+list().length+' 部作品…';
 }
 function card(project,group,index){
   const a=node('article','ux-project');a.dataset.id=project.id;a.tabIndex=0;
   a.setAttribute('role','button');a.setAttribute('aria-label','编辑 '+project.title);
   const image=node('div','ux-project-image');
   image.append(photo(coverURL(project.id),project.title));
   const controls=node('div','ux-project-controls');
   const meta=node('div','ux-project-meta');
   meta.append(node('span','ux-project-index',String(index+1).padStart(2,'0')));
   const star=node('button','ux-star');star.append(createStarIcon());
   star.type='button';star.title=isFeatured(project.id)?'更换精选作品':'加入首页精选';
   star.setAttribute('aria-pressed',String(isFeatured(project.id)));
   star.setAttribute('aria-label',star.title+'：'+project.title);
   star.addEventListener('click',event=>{event.stopPropagation();askFeatured(project.id);});
   controls.append(star);
   if(!search){
     image.title='点击查看作品，按住拖动调整顺序';
     image.setAttribute('aria-label','按住封面拖动排序：'+project.title);
     image.querySelector('img').draggable=false;
     image.addEventListener('dragstart',event=>event.preventDefault());
     image.addEventListener('pointerdown',event=>startMouseDrag(event,project,group,image));
   }
   meta.append(controls);
   const info=node('div','ux-project-name');
   for(const [language,text,klass] of [['zh',project.title,'ux-name-zh'],['en',project.titleEn,'ux-name-en']]){
     const label=node(language==='zh'?'strong':'span',klass,text);
     label.title='单击修改名称 · Enter 保存 · Esc 取消';
     label.tabIndex=0;label.setAttribute('role','button');
     label.setAttribute('aria-label','修改'+(language==='zh'?'中文':'英文')+'作品名称：'+text);
     label.addEventListener('click',event=>{
       event.stopPropagation();clearTimeout(inlineNameTimer);
       inlineNameTimer=setTimeout(()=>{
         inlineNameTimer=null;
         if(label.isConnected&&$('ux-editor').hidden)editInlineName(project,language,label);
       },170);
     });
     label.addEventListener('dblclick',event=>{
       event.preventDefault();event.stopPropagation();clearTimeout(inlineNameTimer);
       inlineNameTimer=null;editInlineName(project,language,label);
     });
     label.addEventListener('keydown',event=>{
       if(event.key==='Enter'||event.key===' '){
         event.preventDefault();event.stopPropagation();clearTimeout(inlineNameTimer);
         inlineNameTimer=null;editInlineName(project,language,label);
       }
     });
     info.append(label);
   }
   a.append(image,meta,info);
   a.addEventListener('click',event=>{
     if(event.target.closest('button,input'))return;
     if(event.target.closest('.ux-project-name'))return;
     open(project.id);
   });
   a.addEventListener('keydown',event=>{
     if(event.target!==a)return;
     if((event.key==='Enter'||event.key===' ')&&!event.altKey){
       event.preventDefault();open(project.id);
     }
     if(!search&&event.altKey&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
       event.preventDefault();
       const ids=group==='featured'?state.orderDraft.featured:
         state.orderDraft.all.filter(id=>byId(id)?.category===group);
       const step=['ArrowLeft','ArrowUp'].includes(event.key)?-1:1;
       const next=ids.indexOf(project.id)+step;
       if(ids[next])moveItem(project.id,ids[next],group);
     }
   });
   return a;
 }
 function createTile(category){
   const tile=node('button','ux-new-project-tile');
   tile.type='button';tile.dataset.category=category;
   tile.setAttribute('aria-label','在'+catName(category)+'分类新增作品');
   tile.title='新增'+catName(category)+'作品';
   const frame=node('span','ux-new-project-frame');
   const plus=node('span','ux-new-project-symbol');
   plus.append(createPlusIcon());
   frame.append(plus,node('span','ux-new-project-hint','导入 MP4'));
   const labels=node('span','ux-new-project-meta');
   labels.append(node('strong','ux-new-project-title','新增作品'),
     node('span','ux-new-project-description','在此分类创建新作品'));
   tile.append(frame,labels);
   tile.addEventListener('click',()=>openNewProject(category));
   return tile;
 }
 async function restoreArchived(scope,projectId,variantId=''){
   if(busy)return;
   busy=true;
   try{
     await api('/api/restore-item',{scope,projectId,variantId,confirmed:true});
     await bootstrap();
     const p=byId(projectId);
     filter=p?.category||'featured';search='';$('ux-search').value='';
     renderGallery();
     if(p)open(projectId,scope==='version'?variantId:'main');
     notify(scope==='work'?'作品已恢复；视频和封面文件始终保留。':'视频版本已恢复，可以重新切换播放。');
   }catch(e){notify('恢复失败：'+e.message,true);}
   finally{busy=false;}
 }
 function renderTrash(){
   const target=$('ux-gallery'),content=node('section','ux-recycle-section');
   const header=node('div','ux-recycle-intro');
   header.append(node('h3','', '回收站'),node('p','', '仅隐藏在本地作品管理与待发布的网站数据中；文件原样保留。点击「恢复」即可找回。'));
   content.append(header);
   const entries=[...recycle().works.map(p=>({scope:'work',projectId:p.id,title:p.title,detail:'整部作品 · '+catName(p.category),at:p.at})),
     ...recycle().versions.map(v=>({scope:'version',projectId:v.projectId,variantId:v.variantId,
       title:v.label?.zh||'视频版本',detail:'视频版本 · '+v.title,at:v.at,disabled:recycle().works.some(w=>w.id===v.projectId)}))]
     .filter(item=>!search||[item.title,item.detail,item.projectId].some(text=>String(text).toLocaleLowerCase().includes(search.toLocaleLowerCase())));
   if(!entries.length){
     content.append(node('p','ux-recycle-empty',search?'回收站中没有匹配的作品或版本。':'回收站是空的。这里不会永久删除任何本地素材。'));
   }
   for(const item of entries){
     const card=node('div','ux-recycle-item');
     const img=node('div','ux-recycle-thumb');
     img.append(photo(item.scope==='work'||!byId(item.projectId)
       ?'/archived-cover/'+encodeURIComponent(item.projectId):coverURL(item.projectId),item.title));
     const info=node('div','ux-recycle-info');
     info.append(node('strong','',item.title),node('span','',item.detail));
     const restore=node('button','secondary','恢复');restore.type='button';
     restore.disabled=Boolean(item.disabled);
     restore.title=item.disabled?'请先恢复该版本所属作品':'恢复到作品库，原视频文件未改动';
     restore.addEventListener('click',()=>restoreArchived(item.scope,item.projectId,item.variantId||''));
     card.append(img,info,restore);content.append(card);
   }
   target.replaceChildren(content);
   $('ux-search-clear').hidden=!search;
   $('ux-sort-hint').textContent='回收站只负责隐藏和恢复，不会删除本地 MP4、图片或 ImageKit 文件';
   $('ux-sort-state').textContent='';$('ux-sort-undo').hidden=true;
 }
 function renderGallery(){
   if(!state.ordering)return;
   renderFilters();
   $('ux-search').placeholder=filter==='trash'?'搜索回收站…':'搜索全部 '+list().length+' 部作品…';
   if(filter==='trash'){renderTrash();return;}
   const match=p=>!search||[p.title,p.titleEn,p.id,catName(p.category)].some(value=>
     String(value||'').toLocaleLowerCase().includes(search.toLocaleLowerCase()));
   const showCategories=search ? categories : categories.filter(c=>c[0]===filter);
   const source=filter==='featured'&&!search
     ?[{key:'featured',title:'首页精选',ids:state.orderDraft.featured}]
     :showCategories.map(([id,title])=>({key:id,title,
         ids:state.orderDraft.all.filter(x=>byId(x)?.category===id)}));
   const target=$('ux-gallery'),fragment=document.createDocumentFragment();let count=0;
   for(const group of source){
     const items=group.ids.map(byId).filter(p=>p&&match(p));
     if(!items.length&&(group.key==='featured'||search))continue;
     count+=items.length;
     const section=node('section','ux-gallery-section');section.dataset.category=group.key;
     const header=node('div','ux-gallery-heading');
     header.append(node('h3','',group.title),node('small','',items.length+' 部'));
     const grid=node('div','ux-grid');
     items.forEach((p,i)=>grid.append(card(p,group.key,i)));
     if(group.key!=='featured'&&!search)grid.append(createTile(group.key));
     section.append(header,grid);fragment.append(section);
   }
   if(!count&&(search||filter==='featured')){
     const empty=node('div','ux-empty');
     empty.append(node('p','',search?'没有找到与「'+search+'」匹配的作品。':'当前没有精选作品。'));
     if(search){
       const clear=node('button','secondary','清除搜索，查看作品');clear.type='button';
       clear.addEventListener('click',clearSearch);
       empty.append(clear);
     }
     fragment.append(empty);
   }
   target.replaceChildren(fragment);
   $('ux-search-clear').hidden=!search;
   $('ux-sort-hint').textContent=search?'全部分类搜索结果 · 共 '+count+' 部作品 · 清除搜索后可拖拽排序':
     '点击封面编辑 · 按住封面拖动排序，松手自动保存 · ★ 设置精选';
   updateSaveBar();
 }
 function finishDrag(){
   if(!drag)return null;
   const d=drag;drag=null;
   clearTimeout(d.timer);
   if(d.ghost?.isConnected)d.ghost.remove();
   d.image?.closest('.ux-project')?.classList.remove('ux-drag-source');
   document.querySelectorAll('#ux-gallery .ux-project').forEach(card=>
     card.classList.remove('ux-drop-target'));
   document.body.classList.remove('ux-dragging');
   return d;
 }
 function cancelDrag(){finishDrag();}
 function hitTarget(x,y,group){
   const card=document.elementFromPoint(x,y)?.closest('#ux-gallery .ux-project');
   return card?.closest('.ux-gallery-section')?.dataset.category===group ? card:null;
 }
 function activateDrag(d,x,y){
   if(d.active||drag!==d)return;
   d.active=true;
   d.image.closest('.ux-project')?.classList.add('ux-drag-source');
   document.body.classList.add('ux-dragging');
   const ghost=node('div','ux-drag-ghost');
   ghost.append(d.image.querySelector('img').cloneNode(true),node('span','ux-drag-label','拖动调整顺序'));
   d.ghost=ghost;document.body.append(ghost);
   moveDrag(x,y);
 }
 function moveDrag(x,y){
   if(!drag?.active)return;
   drag.ghost.style.transform='translate('+Math.round(x+15)+'px,'+Math.round(y+15)+'px)';
   document.querySelectorAll('#ux-gallery .ux-project').forEach(card=>
     card.classList.remove('ux-drop-target'));
   const target=hitTarget(x,y,drag.group);
   if(target&&target.dataset.id!==drag.id)target.classList.add('ux-drop-target');
 }
 function startMouseDrag(event,project,group,image){
   if(event.pointerType!=='mouse'&&event.pointerType!=='pen')return;
   if(event.button!==0||busy||search||drag)return;
   drag={type:'pointer',id:project.id,group,image,pointerId:event.pointerId,
     x:event.clientX,y:event.clientY,active:false,ghost:null};
   image.setPointerCapture(event.pointerId);
 }
 document.addEventListener('pointermove',event=>{
   const d=drag;
   if(!d||d.type!=='pointer'||d.pointerId!==event.pointerId)return;
   if(!d.active&&Math.hypot(event.clientX-d.x,event.clientY-d.y)>7)
     activateDrag(d,event.clientX,event.clientY);
   if(d.active){event.preventDefault();moveDrag(event.clientX,event.clientY);}
 },{passive:false});
 document.addEventListener('pointerup',event=>{
   const d=drag;
   if(!d||d.type!=='pointer'||d.pointerId!==event.pointerId)return;
   const target=d.active?hitTarget(event.clientX,event.clientY,d.group):null;
   if(d.active){suppressDragClickId=d.id;suppressDragClickUntil=Date.now()+500;}
   if(d.image?.hasPointerCapture(event.pointerId))d.image.releasePointerCapture(event.pointerId);
   finishDrag();
   if(target&&target.dataset.id!==d.id)moveItem(d.id,target.dataset.id,d.group);
 });
 document.addEventListener('pointercancel',event=>{
   if(drag?.type==='pointer'&&drag.pointerId===event.pointerId)cancelDrag();
 });
 document.addEventListener('click',event=>{
   if(Date.now()>suppressDragClickUntil)return;
   if(event.target.closest('.ux-project')?.dataset.id!==suppressDragClickId)return;
   event.preventDefault();event.stopImmediatePropagation();
   suppressDragClickUntil=0;
 },true);
 function applyOrder(result){
   for(const scope of ['featured','all']){
     state.orderBaseline[scope]=[...result[scope]];
     state.orderDraft[scope]=[...result[scope]];
     state.ordering[scope]=[...result[scope]];
   }
   state.ordering.projects.forEach(p=>p.featured=result.featured.includes(p.id));
 }
 async function persistMove(scope,previous,desired){
   if(busy)return;
   busy=true;updateSaveBar();
   try{
     const result=await api('/api/save-order',{
       scope,ids:desired,expected:previous,confirmed:true,
     });
     applyOrder(result);
     renderGallery();
     undoLast={scope,previous:[...previous],saved:[...result[scope]]};
     updateSaveBar();
     notify('顺序已自动保存到本地；可在作品库上方撤销。');
     const toast=$('ux-toast');
     const undo=node('button','ux-undo-button','撤销');
     undo.type='button';undo.addEventListener('click',undoSort);
     toast.append(undo);
   }catch(error){
     state.orderDraft[scope]=[...previous];
     renderGallery();
     notify('排序未能保存，已恢复原顺序：'+error.message,true);
   }finally{busy=false;updateSaveBar();}
 }
 async function undoSort(){
   const last=undoLast;if(!last||busy)return;
   undoLast=null;busy=true;updateSaveBar();
   try{
     const result=await api('/api/save-order',{
       scope:last.scope,ids:last.previous,expected:last.saved,confirmed:true,
     });
     applyOrder(result);renderGallery();notify('已撤销上一次排序');
   }catch(error){notify('撤销失败：'+error.message,true);}
   finally{busy=false;updateSaveBar();}
 }
 function moveItem(fromId,toId,group){
   if(busy||search||fromId===toId)return;
   const scope=group==='featured'?'featured':'all',ids=state.orderDraft[scope];
   const include=id=>scope==='featured'||byId(id)?.category===group;
   if(!include(fromId)||!include(toId))return;
   const previous=[...ids];
   const slots=ids.flatMap((id,i)=>include(id)?[i]:[]);
   const items=slots.map(i=>ids[i]);
   const a=items.indexOf(fromId),b=items.indexOf(toId);
   if(a<0||b<0)return;
   items.splice(a,1);items.splice(b,0,fromId);
   slots.forEach((pos,i)=>ids[pos]=items[i]);
   const desired=[...ids];
   renderGallery();
   persistMove(scope,previous,desired);
 }
 function askFeatured(id){
   if(busy)return;
   if(!$('ux-editor').hidden&&(draftSections().title||draftSections().versionLabel||draftSections().url||
      draftSections().version||draftSections().cover)){
     navigateWithDraft(()=>askFeatured(id));return;
   }
   if(dirty()){notify('请先保存排序，再调整精选作品。',true);return;}
   swapping={id,wasFeatured:isFeatured(id)};
   const target=byId(id),already=swapping.wasFeatured;
   $('ux-feature-title').textContent=already?'选择接替精选的作品':'首页精选已满 · 选择要替换的作品';
   $('ux-feature-description').textContent=already
     ?'首页固定展示 8 部，请选择一部作品接替「'+target.title+'」。'
     :'选择一部当前精选，让「'+target.title+'」加入首页。';
   const choices=already?list().filter(p=>!isFeatured(p.id)):
     state.orderDraft.featured.map(byId).filter(Boolean);
   $('ux-feature-compare').textContent='点击候选作品即可完成替换；鼠标移入或键盘聚焦时预览替换关系。';
   const area=$('ux-feature-options');area.replaceChildren();
   for(const project of choices){
     const button=node('button','ux-replace-item');
     button.type='button';
     button.append(photo(coverURL(project.id),project.title),node('span','',project.title));
     const preview=()=>{
       if(!swapping)return;
       const incoming=swapping.wasFeatured?project:target;
       const outgoing=swapping.wasFeatured?target:project;
       $('ux-feature-compare').textContent='将「'+outgoing.title+'」移出精选 → 「'+incoming.title+'」加入精选（仅修改本地精选，不删除作品）';
     };
     button.addEventListener('pointerenter',preview);
     button.addEventListener('focus',preview);
     button.addEventListener('click',()=>confirmFavorite(id,project.id));
     area.append(button);
   }
   $('ux-feature-dialog').hidden=false;document.body.classList.add('ux-dialog-open');
   $('ux-editor').inert=!$('ux-editor').hidden;
   $('ux-library').inert=true;
   $('ux-feature-close').focus({preventScroll:true});
 }
 function closeFavorite(){
   $('ux-feature-dialog').hidden=true;document.body.classList.remove('ux-dialog-open');swapping=null;
   $('ux-editor').inert=false;
   $('ux-library').inert=!$('ux-editor').hidden;
   if(!$('ux-editor').hidden)$('ux-featured-action').focus({preventScroll:true});
 }
 async function confirmFavorite(id,otherId){
   if(busy||!swapping)return;
   const incoming=swapping.wasFeatured?otherId:id;
   const outgoing=swapping.wasFeatured?id:otherId;
   const chosen=[...state.orderDraft.featured],position=chosen.indexOf(outgoing);
   if(position<0)return;
   chosen[position]=incoming;busy=true;
   try{
     const result=await api('/api/save-order',{
       scope:'featured',ids:chosen,expected:[...state.orderBaseline.featured],confirmed:true,
     });
     applyOrder(result);closeFavorite();renderGallery();renderEditor();
     notify('已将「'+byId(incoming).title+'」加入首页精选，替换「'+byId(outgoing).title+'」。');
   }catch(e){notify('精选调整失败：'+e.message,true);}
   finally{busy=false;syncVersionActions();}
 }
 async function saveTitle(p,zh,en){
   if(busy)return false;
   if(dirty()){notify('请先保存排序，再修改作品名称。',true);return false;}
   if(!zh||!en){notify('中英文标题都不能为空。',true);return false;}
   busy=true;syncSaveIndicator({saving:true});
   try{
     await api('/api/update-title',{
       id:p.id,titleZh:zh,titleEn:en,expectedZh:p.title,expectedEn:p.titleEn,confirmed:true,
     });
     await bootstrap();
     renderGallery();renderEditor();
     $('ux-context-save').textContent='作品名称已保存到本地 · 未发布网站';
     notify('已保存作品名称：本地视频、封面和海报文件名已同步；线上 ImageKit 地址未更改。');
     return true;
   }catch(e){syncSaveIndicator({error:true});notify('保存名称失败：'+e.message,true);return false;}
   finally{busy=false;syncVersionActions();}
 }
 function editInlineName(p,language,label){
   if(busy||dirty()){if(dirty())notify('请先保存当前排序。',true);return;}
   const field=node('input','ux-inline-name');
   field.type='text';field.setAttribute('aria-label','修改'+(language==='zh'?'中文':'英文')+'作品名称');field.maxLength=80;field.value=language==='zh'?p.title:p.titleEn;
   label.replaceWith(field);field.focus();field.select();
   let done=false;
   const restore=(focus=false)=>{if(field.isConnected){field.replaceWith(label);if(focus)label.focus({preventScroll:true});}};
   const commit=()=>{
     if(done)return;done=true;const value=field.value.trim().replace(/\s+/g,' ');
     restore(true);
     if(!value||value===(language==='zh'?p.title:p.titleEn))return;
     void saveTitle(p,language==='zh'?value:p.title,language==='en'?value:p.titleEn);
   };
   field.addEventListener('keydown',event=>{
     event.stopPropagation();
     if(event.key==='Enter'){event.preventDefault();commit();}
     if(event.key==='Escape'){event.preventDefault();done=true;restore(true);}
   });
   field.addEventListener('click',event=>event.stopPropagation());
   // Losing focus cancels an unfinished name edit instead of silently renaming MP4s.
   field.addEventListener('blur',()=>{if(!done){done=true;restore();}},{once:true});
 }
 const navigationIds=()=>state.orderDraft.all.filter(id=>Boolean(byId(id)));
 function updateWorkNavigation(){
   const p=selectedId&&byId(selectedId);
   if(!p)return;
   const ids=navigationIds();
   const position=ids.indexOf(selectedId);
   const prev=$('ux-work-prev'),next=$('ux-work-next');
   // Browsing is circular: end -> start and start -> end.
   // Only a single-work collection disables the chevrons.
   prev.disabled=ids.length<2||position<0;
   next.disabled=ids.length<2||position<0;
   const count=ids.length?position+1:0;
   const scope='全部作品';
   $('ux-work-position').textContent=count+' / '+ids.length;
   $('ux-work-position').title=scope+' · 第 '+count+' 部，共 '+ids.length+' 部；允许跨分类浏览';
   prev.setAttribute('aria-label','上一部作品 · 全部作品');
   next.setAttribute('aria-label','下一部作品 · 全部作品');
   prev.title=prev.disabled?'只有这一部作品':(position===0?'跳转最后一部 · Option + ←':'上一部作品 · Option + ←');
   next.title=next.disabled?'只有这一部作品':(position===ids.length-1?'跳转第一部 · Option + →':'下一部作品 · Option + →');
 }
 function navigateWork(direction){
   if($('ux-editor').hidden||history.isOpen()||!$('ux-unsaved-dialog').hidden)return;
   const ids=navigationIds();
   const index=ids.indexOf(selectedId);
   if(index<0||ids.length<2)return;
   const next=(index+direction+ids.length)%ids.length;
   const id=ids[next];
   navigateWithDraft(()=>{
     inlineCover.cancel();
     player.pause();
     selectedId=id;selectedVersion=firstVersion(id);
     // The selected work may be in a different category from the one that
     // opened the dialog. Keep the underlying library aligned so closing
     // always returns to the visible card instead of the old tab.
     const category=byId(id)?.category;
     if(category&&(filter!==category||search)){
       filter=category;search='';$('ux-search').value='';
       renderGallery();
     }
     beforeEditorFocus=document.querySelector('#ux-gallery .ux-project[data-id="'+id+'"]')||beforeEditorFocus;
     renderEditor();
     const arrow=direction<0?$('ux-work-prev'):$('ux-work-next');
     if(arrow.disabled)($('ux-work-position')).focus({preventScroll:true});
     else arrow.focus({preventScroll:true});
   });
 }
 function open(id,versionId){
   versionId ||= firstVersion(id);
   if(!byId(id))return;
   if(history.isOpen())history.close();
   if(!$('ux-editor').hidden){
     if(selectedId===id&&selectedVersion===versionId)return;
     navigateWithDraft(()=>{finishCloseEditor();open(id,versionId);});return;
   }
   beforeEditorFocus=document.activeElement?.closest?.('#ux-gallery .ux-project')||
     document.querySelector('#ux-gallery .ux-project[data-id="'+id+'"]');
   inlineCover.cancel();
   selectedId=id;selectedVersion=versionId;
   selectPanel('versions');renderEditor();
   $('ux-editor').hidden=false;
   $('ux-library').inert=true;
   document.body.classList.add('ux-editor-open');
   $('ux-editor').querySelector('.ux-editor-pane').focus({preventScroll:true});
 }
 function finishCloseEditor(){
   finishVersionDrag();
   inlineCover.cancel();
   player.clear();
   $('ux-version-form').hidden=true;
   $('ux-version-file').value='';
   if(!$('ux-editor').hidden)syncContext();
   $('ux-url-form').hidden=true;
   $('ux-editor').hidden=true;
   $('ux-library').inert=false;
   document.body.classList.remove('ux-editor-open');
   const origin=beforeEditorFocus?.isConnected?beforeEditorFocus:
     document.querySelector('#ux-gallery .ux-project[data-id="'+selectedId+'"]');
   beforeEditorFocus=null;
   if(origin?.isConnected)origin.focus({preventScroll:true});
 }
 function closeEditor(){
   if(history.isOpen()){history.close();return;}
   navigateWithDraft(finishCloseEditor);
 }
 function finishVersionDrag(){
   const d=versionDrag;versionDrag=null;
   if(!d)return null;
   d.ghost?.remove();
   d.item?.classList.remove('ux-version-drag-source');
   $('ux-variant-chips').querySelectorAll('.ux-variant-item').forEach(item=>item.classList.remove('ux-version-drop-target'));
   document.body.classList.remove('ux-version-dragging');
   return d;
 }
 function versionTargetAt(x,y){
   return document.elementFromPoint(x,y)?.closest('#ux-variant-chips .ux-variant-item')||null;
 }
 function moveVersionGhost(x,y){
   if(!versionDrag?.active)return;
   versionDrag.ghost.style.left=Math.round(x+12)+'px';
   versionDrag.ghost.style.top=Math.round(y+12)+'px';
   $('ux-variant-chips').querySelectorAll('.ux-variant-item').forEach(item=>item.classList.remove('ux-version-drop-target'));
   const target=versionTargetAt(x,y);
   if(target&&target!==versionDrag.item)target.classList.add('ux-version-drop-target');
 }
 function startVersionDrag(event,id,item){
   if(event.button!==0||!['mouse','pen'].includes(event.pointerType)||versionSortBusy||versionDrag||busy||
     inlineCover.busy()||history.isBusy()||anyDraft()||versions(selectedId).length<2)return;
   // Preserve native button click/focus on a short press. Capturing the
   // pointer at pointerdown would retarget click to the outer div and stop
   // version switching. Capture only when an actual drag begins.
   versionDrag={id,item,pointerId:event.pointerId,x:event.clientX,y:event.clientY,active:false,ghost:null};
 }
 document.addEventListener('pointermove',event=>{
   const d=versionDrag;
   if(!d||d.pointerId!==event.pointerId)return;
   if(!d.active&&Math.hypot(event.clientX-d.x,event.clientY-d.y)>7){
     d.active=true;
     d.item.setPointerCapture(event.pointerId);
     d.item.classList.add('ux-version-drag-source');
     document.body.classList.add('ux-version-dragging');
     const ghost=node('div','ux-version-ghost',d.item.querySelector('.ux-variant')?.textContent||'视频版本');
     d.ghost=ghost;document.body.append(ghost);
   }
   if(d.active){event.preventDefault();moveVersionGhost(event.clientX,event.clientY);}
 },{passive:false});
 document.addEventListener('pointerup',event=>{
   const d=versionDrag;
   if(!d||d.pointerId!==event.pointerId)return;
   const target=d.active?versionTargetAt(event.clientX,event.clientY):null;
   if(d.active)suppressVersionClickUntil=Date.now()+500;
   if(d.item?.hasPointerCapture(event.pointerId))d.item.releasePointerCapture(event.pointerId);
   finishVersionDrag();
   if(target&&target!==d.item)void moveVersion(d.id,target.dataset.version);
 });
 document.addEventListener('pointercancel',event=>{
   if(versionDrag?.pointerId===event.pointerId)finishVersionDrag();
 });
 async function moveVersion(sourceId,targetId){
   const projectId=selectedId;
   const options=versions(projectId);
   const before=options.map(option=>option.id);
   const from=before.indexOf(sourceId),to=before.indexOf(targetId);
   if(from<0||to<0||from===to||versionSortBusy||busy||inlineCover.busy()||history.isBusy())return;
   if(anyDraft()){notify('请先保存或取消未完成的修改，再调整版本顺序。',true);return;}
   const next=[...before];next.splice(from,1);next.splice(to,0,sourceId);
   versionSortBusy=true;
   const chips=$('ux-variant-chips');
   const items=new Map([...chips.children].map(item=>[item.dataset.version,item]));
   next.forEach(id=>{if(items.get(id))chips.append(items.get(id));});
   $('ux-version-tip').textContent='正在保存顺序…';
   try{
     await api('/api/save-version-order',{projectId,ids:next,expected:before,confirmed:true});
     for(const group of [state.posterVersions,state.managed]){
       const entry=group.find(item=>item.id===projectId);
       if(entry)entry.versions.sort((a,b)=>next.indexOf(a.id)-next.indexOf(b.id));
     }
     $('ux-version-tip').textContent='顺序已自动保存 · 第一个版本将在网站中优先显示';
     notify('视频版本顺序已自动保存到本地；发布网站后同步生效。');
   }catch(error){
     before.forEach(id=>{if(items.get(id))chips.append(items.get(id));});
     $('ux-version-tip').textContent='排序未保存，可重新拖动';
     notify('版本排序失败：'+error.message,true);
   }finally{versionSortBusy=false;}
 }
 function renderEditor({preserveVersionChips=false}={}){
   if(!selectedId||!byId(selectedId))return;
   const p=byId(selectedId),work=managed(selectedId);
   const options=versions(selectedId);
   if(!options.some(v=>v.id===selectedVersion))selectedVersion=firstVersion(selectedId);
   const v=options.find(v=>v.id===selectedVersion)||options[0];
   const online=work?.versions.find(x=>x.id===v?.id);
   if(v){
     player.setSource(selectedId,v.id);
     $('ux-stage-version').textContent=(v.label?.zh||'主版本')+' · '+v.width+' × '+v.height;
   }
   $('ux-editor-id').textContent='作品 #'+p.id+' · '+catName(p.category);
   $('ux-editor-title').textContent=p.title;
   syncContext();
   updateWorkNavigation();
   const preview=new URL('http://127.0.0.1:5174/works.html');
   preview.searchParams.set('category',p.category);
   preview.searchParams.set('project',p.id);
   $('ux-preview-current').href=preview.toString();
   $('ux-title-zh').value=p.title;
   $('ux-title-en').value=p.titleEn||'';
   $('ux-title-save').hidden=true;
   const currentCover=coverURL(p.id),currentPoster=posterURL(p.id,v?.id);
   if($('ux-cover-img').getAttribute('src')!==currentCover)$('ux-cover-img').src=currentCover;
   if($('ux-poster-img').getAttribute('src')!==currentPoster)$('ux-poster-img').src=currentPoster;
   $('ux-poster-size').textContent=v?v.width+' × '+v.height:'原比例';
   const chips=$('ux-variant-chips');
   if(!preserveVersionChips){
     chips.replaceChildren();
     for(const option of options){
       const item=node('div','ux-variant-item');
       item.dataset.version=option.id;
       item.title='按住拖动调整视频版本顺序；第一个版本会优先播放';
       const b=node('button','ux-variant',option.label?.zh||'主版本');
       b.type='button';b.dataset.version=option.id;b.setAttribute('aria-pressed',String(option.id===selectedVersion));
       b.title='单击切换；按住拖动排序；Shift + ←/→ 键盘调整顺序';
       b.addEventListener('pointerdown',event=>startVersionDrag(event,option.id,item));
       b.addEventListener('keydown',event=>{
         if(!event.shiftKey||!['ArrowLeft','ArrowRight'].includes(event.key))return;
         event.preventDefault();event.stopPropagation();
         const items=[...chips.querySelectorAll('.ux-variant-item')];
         const from=items.indexOf(item),to=from+(event.key==='ArrowLeft'?-1:1);
         if(to>=0&&to<items.length)void moveVersion(option.id,items[to].dataset.version);
       });
       b.addEventListener('click',()=>{
         if(Date.now()<suppressVersionClickUntil)return;
         if(option.id===selectedVersion)return;
         navigateWithDraft(()=>{
           if(history.isOpen())history.close();
           inlineCover.cancel();
           cancelVersion();
           cancelVersionLabel();
           selectedVersion=option.id;
           renderEditor({preserveVersionChips:true});
         });
       });
       const edit=node('button','ux-variant-edit');edit.type='button';edit.append(createEditIcon());
       edit.setAttribute('aria-label','编辑「'+(option.label?.zh||'主版本')+'」的中英文版本名称');
       edit.title='编辑这个视频版本的中英文名称';
       edit.addEventListener('click',()=>startVersionLabelEdit(option.id));
       item.append(b,edit);chips.append(item);
     }
   }else{
     chips.querySelectorAll('.ux-variant').forEach(button=>
       button.setAttribute('aria-pressed',String(button.dataset.version===selectedVersion)));
   }
   chips.hidden=false;
   $('ux-stage-version').hidden=false;
   $('ux-edit-current-version').hidden=true;
   $('ux-edit-current-version').onclick=()=>{selectPanel('versions');startVersionLabelEdit(selectedVersion);};
   $('ux-rename-current').disabled=busy;
   const canArchiveSingleVersion=options.length>1;
   $('ux-archive-version').disabled=busy||!canArchiveSingleVersion;
   $('ux-archive-version').title=canArchiveSingleVersion?'仅归档当前视频版本；其他版本继续保留，文件可恢复。':'至少保留一个视频版本；需要隐藏整部作品请使用「归档整部作品」。';
   $('ux-stage-version').title='当前视频版本；版本切换和重命名请使用右侧「视频版本」';
   $('ux-stage-version').ondblclick=null;
   syncVersionActions();
   $('ux-version-label-form').hidden=true;
   editingVersionId=null;
   const url=online?.videoUrl||null;
   $('ux-cloud-badge').textContent=url?'已配置 ImageKit 地址':'未配置线上视频';
   $('ux-cloud-badge').dataset.connected=String(Boolean(url));
   $('ux-version-label').textContent='当前：'+(v?.label?.zh||'主版本')+' · '+(v?.width||'-')+' × '+(v?.height||'-')+' · 只影响此版本';
   $('ux-version-tip').textContent=options.length>1?'按住版本标签拖动排序，松手自动保存；第一个版本是网页默认播放版本。点标签切换，点铅笔改名。':'当前只有一个视频版本，可通过右侧添加版本。';
   $('ux-url-readonly').textContent=url||'未设置线上视频地址 · 点击填写 ImageKit 链接';
   $('ux-url-readonly').title='单击编辑 ImageKit 地址；进入编辑后可复制或修改';
   $('ux-add-variant').replaceChildren(createPlusIcon(),document.createTextNode('添加视频版本'));
   $('ux-add-variant').hidden=false;
   {
     // Archived versions reserve their existing file names and version slots.
     const index=String.fromCharCode(65+Math.min(options.length+reservedVersions(p.id).length,25));
     $('ux-version-zh').value='版本 '+index;
     $('ux-version-en').value='Version '+index;
     $('ux-version-proposed').textContent='默认：版本 '+index;
     $('ux-version-advanced').open=false;
     $('ux-version-file').value='';
     syncNewVersionFileState();
   }
   $('ux-version-form').hidden=true;
   $('ux-url-form').hidden=true;
   $('ux-url-readonly').hidden=false;
   $('ux-url-value').value=filenameOf(url);
   syncUrlValidation();
   const featured=isFeatured(p.id);
   $('ux-featured-action').replaceChildren(
     createStarIcon(),document.createTextNode(featured?'首页精选 · 更换':'加入首页精选')
   );
   $('ux-featured-action').setAttribute('aria-pressed',String(featured));
   $('ux-archive-work').disabled=featured||busy;
   $('ux-archive-work').textContent=featured?'请先更换首页精选':'移入回收站';
   $('ux-archive-work').title=featured?'先使用上方精选按钮更换掉该作品，才能移入回收站。':'不永久删除视频、封面或线上资源';
   selectPanel(activePanel);
   syncSaveIndicator();
 }
 function launchEditor(kind){
   if(!selectedId)return;
   if(draftSections().title||draftSections().versionLabel||draftSections().url||draftSections().version){
     navigateWithDraft(()=>launchEditor(kind));return;
   }
   if(dirty()){notify('请先保存排序，再编辑封面。',true);return;}
   const v=poster(selectedId);
   if(!v){notify('没有找到对应视频版本。',true);return;}
   syncContext(kind==='poster'?'正在编辑当前版本的播放器海报；不影响 3:4 作品封面或其他版本。':'正在编辑整部作品的 3:4 卡片封面；不会修改各视频版本的海报。');
   inlineCover.start(kind,selectedId,v);
 }
 function syncNewVersionFileState(){
   const file=$('ux-version-file').files?.[0];
   const valid=Boolean(file&&/\.mp4$/i.test(file.name)&&file.size>0&&file.size<=2*1024**3);
   $('ux-version-file-name').textContent=file?file.name:'选择 MP4 视频';
   $('ux-version-file-hint').textContent=file?(file.size/1048576).toFixed(1)+' MB · '+(valid?'可在左侧播放预览':'仅支持不超过 2GB 的 MP4'):
     '点击选择 · 添加后保留原版本';
   $('ux-version-submit').disabled=busy||!valid;
   $('ux-version-submit').textContent='保存为'+$('ux-version-zh').value.trim();
   if(!$('ux-version-form').hidden)syncSaveIndicator();
 }
 function cancelVersion(){
   $('ux-version-form').hidden=true;
   $('ux-version-file').value='';
   $('ux-version-advanced').open=false;
   syncNewVersionFileState();
   if(selectedId)player.setSource(selectedId,selectedVersion);
   const current=poster(selectedId);
   if(current)$('ux-stage-version').textContent=(current.label?.zh||'主版本')+' · '+current.width+' × '+current.height;
   if(selectedId)syncContext();
 }
 function cancelVersionLabel({restoreFocus=false}={}){
   const origin=versionLabelOpener;
   $('ux-version-label-form').hidden=true;
   editingVersionId=null;versionLabelOpener=null;
   if(selectedId)syncContext();
   if(restoreFocus&&origin?.isConnected&&!origin.closest('[inert]'))origin.focus({preventScroll:true});
 }
 function startVersionLabelEdit(variantId){
   if(!selectedId||busy)return;
   selectPanel('versions');
   const opener=document.activeElement;
   navigateWithDraft(()=>{
     cancelVersion();
     let focusOpener=opener;
     if(variantId!==selectedVersion){
       cancelVersionLabel();selectedVersion=variantId;renderEditor();
       // Switching a version recreates the chip: restore focus to its new pencil.
       focusOpener=[...$('ux-variant-chips').querySelectorAll('.ux-variant-item')]
         .find(item=>item.querySelector('.ux-variant')?.dataset.version===variantId)
         ?.querySelector('.ux-variant-edit')||opener;
     }
     const version=versionById(selectedId,variantId);
     if(!version)return;
     editingVersionId=variantId;versionLabelOpener=focusOpener;
     $('ux-version-label-zh').value=version.label?.zh||'';
     $('ux-version-label-en').value=version.label?.en||'';
     $('ux-version-label-current').textContent='当前：'+(version.label?.zh||'主版本');
     $('ux-version-label-status').textContent='保存后，版本切换按钮和当前版本标题会同步更新。';
     $('ux-version-label-form').hidden=false;
     $('ux-version-label-form').scrollIntoView({block:'nearest',behavior:'instant'});
     syncContext('仅重命名当前视频版本，不改变作品名称及其他视频。');
     syncVersionLabelDraftStatus();
     $('ux-version-label-zh').focus();
   });
 }
 async function saveVersionLabel(event){
   event.preventDefault();
   if(busy||!selectedId||!editingVersionId)return;
   if(dirty()){notify('请先保存排序，再修改版本名称。',true);return;}
   const version=versionById(selectedId,editingVersionId);
   if(!version)return;
   const labelZh=$('ux-version-label-zh').value.trim();
   const labelEn=$('ux-version-label-en').value.trim();
   if(!labelZh||!labelEn){notify('请填写中英文版本名称。',true);return;}
   const duplicate=versions(selectedId).some(item=>item.id!==editingVersionId&&
     (item.label?.zh===labelZh||item.label?.en===labelEn));
   if(duplicate){notify('同一作品的中英文版本名称都需要与其他版本区分。',true);return;}
   const projectId=selectedId,variantId=editingVersionId;
   busy=true;$('ux-version-label-save').disabled=true;
   $('ux-version-label-status').textContent='正在保存中英文版本名称…';
   try{
     await api('/api/update-version-label',{
       projectId,variantId,labelZh,labelEn,
       expectedLabel:version.label||{zh:'主版本',en:'Main version'},confirmed:true,
     });
     await bootstrap();
     selectedId=projectId;selectedVersion=variantId;editingVersionId=null;versionLabelOpener=null;
     renderGallery();renderEditor();
     notify('版本名称已保存到本地；切换按钮和当前版本标题已同步，网站尚未发布。');
   }catch(error){
     $('ux-version-label-status').textContent='保存失败：'+error.message;
     notify('保存视频版本名称失败：'+error.message,true);
   }finally{
     busy=false;$('ux-version-label-save').disabled=false;syncVersionActions();
   }
 }
 function launchHistory(kind,opener){
   if(!selectedId||busy)return;
   if(draftSections().title||draftSections().versionLabel||draftSections().url||draftSections().version){
     navigateWithDraft(()=>launchHistory(kind,opener));return;
   }
   if(inlineCover.active()){
     notify('请先退出正在进行的选帧，再查看旧封面。',true);
     return;
   }
   const p=byId(selectedId);
   const version=poster(selectedId);
   history.open({kind,projectId:selectedId,
     variantId:kind==='cover'?'main':selectedVersion,
     variantLabel:kind==='cover'?'':(version?.label?.zh||'主版本'),
     title:p?.title||'作品',opener});
 }
 function launchVersion(){
   selectPanel('versions');
   if(draftSections().title||draftSections().versionLabel||draftSections().url){
     navigateWithDraft(()=>launchVersion());return;
   }
   const work=managed(selectedId);
   if(!work){notify('此作品暂时无法管理版本。',true);return;}
   cancelVersionLabel();
   if(inlineCover.active())inlineCover.cancel();
   const form=$('ux-version-form');
   if(!form.hidden){cancelVersion();return;}
   form.hidden=false;
   form.scrollIntoView({block:'nearest',behavior:'instant'});
   syncContext('添加视频只在本地保存，不覆盖现有视频，也不会上传 ImageKit。');
   $('ux-version-status').textContent='先选择 MP4，再确认左侧画面；需要个性化标签时展开「自定义版本名称」。';
   syncNewVersionFileState();
   $('ux-version-file').focus();
 }
 async function saveVersion(event){
   event.preventDefault();
   const work=managed(selectedId);
   const file=$('ux-version-file').files?.[0];
   if(!work||!file){notify('请选择要添加的 MP4。',true);return;}
   if(!/\.mp4$/i.test(file.name)){notify('视频必须是 MP4 文件。',true);return;}
   if(file.size>2*1024**3){notify('视频不能超过 2GB。',true);return;}
   const labelZh=$('ux-version-zh').value.trim();
   const labelEn=$('ux-version-en').value.trim();
   if(!labelZh||!labelEn){notify('请填写中英文版本名称。',true);return;}
   if([...versions(selectedId),...reservedVersions(selectedId)].some(v=>v.label?.zh===labelZh||v.label?.en===labelEn)){
     $('ux-version-status').textContent='当前名称已被其他版本或回收站中的版本占用，请展开「自定义版本名称」修改。';
     $('ux-version-advanced').open=true;
     notify('版本名称不能与现有版本重复。',true);return;
   }
   if(busy)return;
   const id=selectedId;
   busy=true;
   syncSaveIndicator({saving:true});
   $('ux-version-submit').disabled=true;
   $('ux-version-status').textContent='正在导入 MP4（请勿关闭或切换作品）…';
   try{
     const response=await fetch('/api/import?kind=video&candidates=0&name='+encodeURIComponent(file.name),{
       method:'POST',headers:{'X-Cover-Token':state.token},body:file,
     });
     const imported=await response.json();
     if(!response.ok)throw new Error(imported.error||'导入失败');
     const duration=Number(imported.metadata?.duration)||0;
     if(duration<=0)throw new Error('视频时长无法识别');
     const time=Math.min(Math.max(.1,duration*.18),Math.max(.05,duration-.06));
     $('ux-version-status').textContent='正在保存视频与默认播放器海报…';
     const result=await api('/api/add-version',{
       projectId:id,sessionId:imported.id,time,
       labelZh,labelEn,confirmed:true,
     });
     await bootstrap();
     selectedId=id;selectedVersion=result.variantId;
     $('ux-version-file').value='';
     $('ux-version-form').hidden=true;
     renderGallery();renderEditor();
     notify('已添加「'+labelZh+'」；右侧可以单独更换该版本的播放器海报。');
   }catch(e){
     $('ux-version-status').textContent='添加失败：'+e.message;
     notify('添加视频版本失败：'+e.message,true);
   }finally{
     busy=false;syncNewVersionFileState();syncVersionActions();syncSaveIndicator();
   }
 }
 async function saveURL(){
   const work=managed(selectedId),v=work?.versions.find(x=>x.id===selectedVersion);
   if(!work||!v)return;
   const url=editableURL();
   if(urlError()){notify(urlError(),true);return false;}
   if(busy)return;busy=true;syncSaveIndicator({saving:true});
   try{
     const result=await api('/api/bind-imagekit',{
       projectId:selectedId,variantId:selectedVersion,url,
       expectedUrl:v.videoUrl||null,confirmed:true,
     });
     v.videoUrl=result.url;renderEditor();
     $('ux-context-save').textContent='ImageKit 地址已保存到本地 · 未发布网站';
     notify('已保存：'+(v.label?.zh||'主版本')+' 的 ImageKit 地址（仅本地配置，尚未发布网站）。');
     return true;
   }catch(e){syncSaveIndicator({error:true});notify('保存线上地址失败：'+e.message,true);return false;}
   finally{busy=false;syncVersionActions();}
 }
 const clearSearch=()=>{
   search='';$('ux-search').value='';renderGallery();$('ux-search').focus({preventScroll:true});
 };
 $('ux-create-quick').addEventListener('click',()=>openNewProject(categories.some(c=>c[0]===filter)?filter:'commercial'));
 $('ux-open-trash').addEventListener('click',()=>{
   filter=filter==='trash'?'featured':'trash';search='';$('ux-search').value='';renderGallery();
 });
 $('ux-search-clear').addEventListener('click',clearSearch);
 $('ux-search').addEventListener('input',event=>{
   search=event.target.value.trim();renderGallery();
 });
 $('ux-search').addEventListener('keydown',event=>{
   if(event.key==='Escape'&&search){event.preventDefault();event.stopPropagation();clearSearch();}
 });
 $('ux-work-prev').addEventListener('click',()=>navigateWork(-1));
 $('ux-work-next').addEventListener('click',()=>navigateWork(1));
 $('ux-close-editor').addEventListener('click',closeEditor);
 $('ux-editor').querySelector('[data-ux-close]').addEventListener('click',closeEditor);
 $('ux-feature-close').addEventListener('click',closeFavorite);
 $('ux-feature-dialog').querySelector('[data-ux-feature-close]').addEventListener('click',closeFavorite);
 let archiveFocusOrigin=null;
 function openArchiveDialog(scope){
   if(!selectedId||busy)return;
   if(scope==='work'&&isFeatured(selectedId)){
     notify('这部作品正在首页精选。请先替换精选，再移入回收站。',true);return;
   }
   if(scope==='version'&&versions(selectedId).length<=1){
     notify('这是作品仅剩的最后一个视频版本；需要隐藏整部作品请使用「归档整部作品」。',true);return;
   }
   archiveFocusOrigin=document.activeElement;
   archivePending={scope,projectId:selectedId,variantId:scope==='version'?selectedVersion:''};
   const work=byId(selectedId),v=poster(selectedId);
   $('ux-archive-title').textContent=scope==='work'?'将整部作品移入回收站？':'将这个视频版本移入回收站？';
   $('ux-archive-message').textContent=scope==='work'
     ?'「'+work.title+'」将从本地作品列表和网站待发布数据中隐藏。所有版本、MP4、封面及 ImageKit 地址均保留，可从回收站恢复。首页线上内容不会自动变化。'
     :'「'+(v?.label?.zh||'此版本')+'」只会从当前作品的版本选择中隐藏；MP4 和海报仍在本机，可以恢复。其他视频版本不受影响。';
   $('ux-archive-phrase-row').hidden=scope!=='work';$('ux-archive-phrase').value='';
   $('ux-archive-confirm').disabled=scope==='work';
   $('ux-archive-error').hidden=true;
   $('ux-archive-dialog').hidden=false;
   $('ux-editor').inert=true;document.body.classList.add('ux-dialog-open');
   (scope==='work'?$('ux-archive-phrase'):$('ux-archive-cancel')).focus({preventScroll:true});
 }
 function closeArchiveDialog(){
   $('ux-archive-dialog').hidden=true;
   $('ux-editor').inert=false;
   document.body.classList.remove('ux-dialog-open');
   archivePending=null;
   const origin=archiveFocusOrigin;archiveFocusOrigin=null;
   if(origin?.isConnected&&!origin.closest('[inert]'))origin.focus({preventScroll:true});
 }
 $('ux-archive-phrase').addEventListener('input',()=>{
   $('ux-archive-confirm').disabled=$('ux-archive-phrase').value.trim()!=='归档';
 });
 $('ux-archive-phrase').addEventListener('keydown',event=>{
   if(event.key==='Enter'&&!$('ux-archive-confirm').disabled){event.preventDefault();$('ux-archive-confirm').click();}
 });
 $('ux-archive-cancel').addEventListener('click',closeArchiveDialog);
 $('ux-archive-dialog').querySelector('.ux-archive-backdrop').addEventListener('click',closeArchiveDialog);
 $('ux-archive-confirm').addEventListener('click',async()=>{
   if(!archivePending||busy||$('ux-archive-confirm').disabled)return;
   const item={...archivePending};busy=true;
   $('ux-archive-confirm').disabled=true;$('ux-archive-confirm').textContent='正在移入回收站…';
   try{
     await api('/api/archive-item',{...item,confirmed:true,
       confirmPhrase:item.scope==='work'?'归档':null});
     closeArchiveDialog();
     if(item.scope==='work')finishCloseEditor();
     else{player.pause();}
     await bootstrap();
     filter=item.scope==='work'?'trash':(byId(item.projectId)?.category||'featured');
     renderGallery();
     if(item.scope==='version'){selectedVersion=firstVersion(item.projectId);renderEditor();}
     notify(item.scope==='work'?'作品已移入回收站，可在作品库右上角恢复。':'视频版本已移入回收站，其他版本和所有原始文件不变。');
   }catch(error){
     $('ux-archive-error').textContent='操作失败：'+error.message;
     $('ux-archive-error').hidden=false;
     notify('回收站操作失败：'+error.message,true);
   }finally{
     busy=false;$('ux-archive-confirm').textContent='确认移入回收站';
     $('ux-archive-confirm').disabled=Boolean(archivePending?.scope==='work'&&$('ux-archive-phrase').value.trim()!=='归档');
   }
 });
 const openModal=()=>{
   if(!$('ux-archive-dialog').hidden)return $('ux-archive-dialog');
   if(!$('ux-unsaved-dialog').hidden)return $('ux-unsaved-dialog');
   if(history.isOpen())return $('ux-history-dialog');
   if(!$('ux-feature-dialog').hidden)return $('ux-feature-dialog');
   if(!$('ux-editor').hidden)return $('ux-editor');
   return null;
 };
 document.addEventListener('keydown',event=>{
   // Search is global. Do not hijack a text field, editable name, or modal.
   const typing=event.target instanceof Element&&Boolean(event.target.closest('input,textarea,select,[contenteditable="true"]'));
   const searchShortcut=(event.key==='/'&&!event.altKey&&!event.metaKey&&!event.ctrlKey)||
     (event.key.toLowerCase()==='k'&&(event.metaKey||event.ctrlKey)&&!event.altKey&&!event.shiftKey);
   if(searchShortcut&&!typing&&!openModal()&&state.workflow==='library'){
     event.preventDefault();$('ux-search').focus({preventScroll:true});$('ux-search').select();return;
   }
   if(event.altKey&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&
      ['ArrowLeft','ArrowRight'].includes(event.key)&&
      !$('ux-editor').hidden&&$('ux-unsaved-dialog').hidden&&!history.isOpen()&&
      !event.target.closest('input,textarea,select,[contenteditable="true"]')){
     event.preventDefault();event.stopImmediatePropagation();
     navigateWork(event.key==='ArrowLeft'?-1:1);
     return;
   }
   const modal=openModal();
   if(event.key==='Tab'&&modal){
     const items=[...modal.querySelectorAll(
       'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
     )].filter(el=>!el.hidden&&!el.closest('[hidden],[inert]')&&
       el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
     if(!items.length){event.preventDefault();modal.querySelector('[role="dialog"],[role="alertdialog"]')?.focus();return;}
     const first=items[0],last=items.at(-1),active=document.activeElement;
     if(!modal.contains(active)||(event.shiftKey&&active===first)||(!event.shiftKey&&active===last)){
       event.preventDefault();
       (event.shiftKey?last:first).focus({preventScroll:true});
     }
   }
   if(event.key!=='Escape')return;
   if(!$('ux-archive-dialog').hidden){event.preventDefault();event.stopImmediatePropagation();closeArchiveDialog();return;}
   if(!$('ux-editor').hidden&&$('ux-unsaved-dialog').hidden&&!history.isOpen()){
     if(!$('ux-version-label-form').hidden){
       event.preventDefault();event.stopImmediatePropagation();cancelVersionLabel({restoreFocus:true});return;
     }
     if(!$('ux-version-form').hidden){
       event.preventDefault();event.stopImmediatePropagation();cancelVersion();
       $('ux-add-variant').focus({preventScroll:true});return;
     }
   }
   // Allow the inline ImageKit input to consume Esc before the enclosing
   // editor's capture-phase Escape handler closes the whole work.
   if(event.target.closest('#ux-url-form')&&!$('ux-url-form').hidden&&$('ux-unsaved-dialog').hidden)return;
   if(document.activeElement?.classList.contains('ux-inline-name'))return;
   if(!$('ux-unsaved-dialog').hidden){
     event.preventDefault();event.stopImmediatePropagation();dismissUnsaved();return;
   }
   if(history.isOpen()){event.preventDefault();event.stopImmediatePropagation();history.close();return;}
   if(!$('ux-feature-dialog').hidden){event.preventDefault();event.stopImmediatePropagation();closeFavorite();return;}
   if(!$('ux-editor').hidden){event.preventDefault();event.stopImmediatePropagation();closeEditor();}
 },true);
 const resetDraftInputs=()=>{
   const p=byId(selectedId);
   if(p){$('ux-title-zh').value=p.title;$('ux-title-en').value=p.titleEn||'';}
   $('ux-title-save').hidden=true;
   $('ux-url-form').hidden=true;
   $('ux-url-readonly').hidden=false;
   syncContext();
   cancelVersion();
   cancelVersionLabel();
   inlineCover.cancel();
 };
 $('ux-unsaved-keep').addEventListener('click',dismissUnsaved);
 $('ux-unsaved-discard').addEventListener('click',()=>{
   const next=pendingNavigation?.action;
   dismissUnsaved();
   resetDraftInputs();
   next?.();
 });
 $('ux-unsaved-save').addEventListener('click',async()=>{
   const pending=pendingNavigation;
   if(!pending||busy)return;
   const p=byId(selectedId);
   const fields={titleZh:$('ux-title-zh').value.trim(),titleEn:$('ux-title-en').value.trim(),
     url:$('ux-url-value').value.trim()};
   $('ux-unsaved-save').disabled=true;
   try{
     const saved=pending.issues.title?await saveTitle(p,fields.titleZh,fields.titleEn):
       pending.issues.versionLabel?await saveVersionLabel(new Event('submit',{cancelable:true})).then(()=>!anyDraft()):
       pending.issues.url?await saveURL():false;
     if(saved){
       dismissUnsaved();
       pending.action();
     }
   }finally{$('ux-unsaved-save').disabled=false;}
 });
 window.addEventListener('beforeunload',event=>{
   if(!$('ux-editor').hidden&&anyDraft()){
     event.preventDefault();
     event.returnValue='';
   }
 });
 const updateTitleButton=()=>{
   const p=byId(selectedId);if(!p)return;
   const hasChanges=$('ux-title-zh').value!==p.title||$('ux-title-en').value!==p.titleEn;
   $('ux-title-save').hidden=!hasChanges;
   syncSaveIndicator();
 };
 $('ux-title-zh').addEventListener('input',updateTitleButton);
 $('ux-title-en').addEventListener('input',updateTitleButton);
 $('ux-title-form').addEventListener('submit',event=>{
   event.preventDefault();
   const p=byId(selectedId);
   if(p)saveTitle(p,$('ux-title-zh').value.trim(),$('ux-title-en').value.trim());
 });
 $('ux-change-cover').addEventListener('click',()=>launchEditor('cover'));
 $('ux-change-poster').addEventListener('click',()=>launchEditor('poster'));
 $('ux-history-cover').addEventListener('click',()=>launchHistory('cover',$('ux-history-cover')));
 $('ux-history-poster').addEventListener('click',()=>launchHistory('poster',$('ux-history-poster')));
 $('ux-add-variant').addEventListener('click',launchVersion);
 $('ux-rename-current').addEventListener('click',()=>startVersionLabelEdit(selectedVersion));
 $('ux-archive-version').addEventListener('click',()=>navigateWithDraft(()=>openArchiveDialog('version')));
 $('ux-archive-work').addEventListener('click',()=>navigateWithDraft(()=>openArchiveDialog('work')));
 $('ux-version-cancel').addEventListener('click',cancelVersion);
 $('ux-version-label-cancel').addEventListener('click',()=>cancelVersionLabel({restoreFocus:true}));
 $('ux-version-label-form').addEventListener('submit',saveVersionLabel);
 $('ux-version-label-zh').addEventListener('input',syncVersionLabelDraftStatus);
 $('ux-version-label-en').addEventListener('input',syncVersionLabelDraftStatus);
 $('ux-version-file').addEventListener('change',event=>{
   const file=event.target.files?.[0];
   syncNewVersionFileState();
   if(!file)return;
   if(!/\.mp4$/i.test(file.name)||file.size>2*1024**3){
     $('ux-version-status').textContent='只支持不超过 2GB 的 MP4 视频。';
     return;
   }
   player.previewFile(file);
   $('ux-stage-version').textContent='待添加 · '+file.name;
   $('ux-version-status').textContent='视频已在左侧加载预览；确认版本名称后可添加，不会替换原文件。';
 });
 for(const id of ['ux-version-zh','ux-version-en'])$(id).addEventListener('input',syncNewVersionFileState);
 $('ux-version-advanced').addEventListener('toggle',()=>{
   $('ux-version-proposed').textContent=$('ux-version-advanced').open?'自定义名称':'默认：'+$('ux-version-zh').value.trim();
 });
 $('ux-version-form').addEventListener('submit',saveVersion);
 $('ux-featured-action').addEventListener('click',()=>askFeatured(selectedId));
 function closeUrlEdit({cancel=false}={}){
   if(urlSaving)return;
   suppressUrlBlur=true;
   $('ux-url-form').hidden=true;
   $('ux-url-readonly').hidden=false;
   if(cancel){
     const actual=managed(selectedId)?.versions.find(v=>v.id===selectedVersion)?.videoUrl;
     $('ux-url-value').value=filenameOf(actual);
   }
   syncContext();
   $('ux-url-readonly').focus({preventScroll:true});
   queueMicrotask(()=>{suppressUrlBlur=false;});
 }
 const editUrl=()=>{
   if(!$('ux-url-form').hidden||urlSaving)return;
   $('ux-url-readonly').hidden=true;
   $('ux-url-form').hidden=false;
   syncContext('正在编辑 '+(poster(selectedId)?.label?.zh||'主版本')+' 的 ImageKit 视频地址；前缀固定，保存后仅修改本地配置。');
   syncUrlValidation();
   $('ux-url-value').focus();
   $('ux-url-value').select();
 };
 $('ux-url-value').addEventListener('input',()=>{
   const raw=$('ux-url-value').value.trim();
   if(!imageKitVideoError(raw))$('ux-url-value').value=filenameOf(raw);
   syncUrlValidation();
   syncSaveIndicator();
 });
 $('ux-url-copy').addEventListener('click',async()=>{
   try{await navigator.clipboard.writeText(prefix);$('ux-url-copy').textContent='已复制';}
   catch{notify('复制失败，请选中前缀文字手动复制。',true);}
 });
 $('ux-url-readonly').addEventListener('click',editUrl);
 $('ux-url-readonly').addEventListener('keydown',event=>{
   if(event.key==='Enter'||event.key===' '){
     event.preventDefault();editUrl();
   }
 });
 $('ux-url-form').addEventListener('keydown',event=>{
   if(event.key==='Escape'){
     event.preventDefault();event.stopPropagation();closeUrlEdit({cancel:true});
   }
 });
 $('ux-url-cancel').addEventListener('click',()=>closeUrlEdit({cancel:true}));
 async function commitUrlEdit(){
   if(suppressUrlBlur||urlSaving||$('ux-url-form').hidden)return;
   const actual=managed(selectedId)?.versions.find(v=>v.id===selectedVersion)?.videoUrl||'';
   const value=editableURL();
   if(value===(actual||'')){closeUrlEdit();return;}
   if(urlError()){
     notify(urlError(),true);
     $('ux-url-value').focus({preventScroll:true});
     return;
   }
   urlSaving=true;
   $('ux-url-save').disabled=true;
   $('ux-url-cancel').disabled=true;
   try{await saveURL();}
   finally{
     urlSaving=false;
     $('ux-url-save').disabled=false;
     $('ux-url-cancel').disabled=false;
   }
 }
 $('ux-url-form').addEventListener('submit',event=>{
   event.preventDefault();void commitUrlEdit();
 });
 // No implicit save on blur: leaving for another work/closing must trigger
 // the existing unsaved-change guard instead of silently publishing a draft.
 return {
   refresh(){
     if(state.ordering){renderGallery();if(!$('ux-editor').hidden)renderEditor();}
   },
   syncVisibility(){
     const active=state.workflow==='library';
     $('ux-library').hidden=!active;
     if(!active)closeEditor();
     if(active)renderGallery();
   },
   open,notify,closeEditor,
 };
}
