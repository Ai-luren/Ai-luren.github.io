import { createInlineCoverEditor } from './library-cover-editor.js';
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
 let filter='featured',search='',selectedId=null,selectedVersion='main',swapping=null,drag=null,busy=false;
 let notificationTimer=null,suppressDragClickUntil=0,suppressDragClickId=null,undoLast=null;
 let beforeEditorFocus=null,pendingNavigation=null,unsavedOrigin=null;
 let suppressUrlBlur=false,urlSaving=false;
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
     renderGallery();
     selectedId=projectId;selectedVersion=variantId;
     renderEditor();
   },
 });
 const history=createArtworkHistoryUI({
   api,notify:(message,error)=>notify(message,error),
   refresh:async(projectId,variantId)=>{
     await bootstrap();
     renderGallery();
     selectedId=projectId;selectedVersion=variantId;
     renderEditor();
   },
 });
 const list=()=>state.ordering?.projects||[];
 const byId=id=>list().find(p=>p.id===id);
 const isFeatured=id=>state.orderDraft?.featured.includes(id);
 const managed=id=>state.managed.find(p=>p.id===id);
 const versions=id=>state.posterVersions.find(p=>p.id===id)?.versions||[];
 const poster=id=>versions(id).find(v=>v.id===selectedVersion)||versions(id)[0];
 const editableURL=()=>{
   const value=$('ux-url-value').value.trim();
   return value.startsWith(prefix)?value:(value?prefix+value:'');
 };
 const filenameOf=url=>url?.startsWith(prefix)?url.slice(prefix.length):url||'';
 const urlError=()=>{
   const value=editableURL(),raw=$('ux-url-value').value.trim();
   if(!raw)return '请填写视频文件名（.mp4）。';
   if(!value.startsWith(prefix)||/^(?:https?:|\/\/)/i.test(raw)&&!raw.startsWith(prefix))return '只能使用当前 ImageKit 账户的固定前缀。';
   const suffix=filenameOf(value);
   if(!suffix.toLowerCase().endsWith('.mp4'))return '视频文件名必须以 .mp4 结尾。';
   if(suffix.includes('..')||suffix.includes('\\')||suffix.startsWith('/')||/[?#<>\x00-\x1f]/.test(suffix))return '文件名不能包含非法字符或路径跳转。';
   return '';
 };
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
   $('ux-context-save').textContent='已保存到本地 · 未发布网站';
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
     cover:Boolean(inlineCover?.hasDraft?.()),
   };
 };
 const anyDraft=()=>Object.values(draftSections()).some(Boolean);
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
   const labels=[issues.title&&'作品名称',issues.url&&'ImageKit 地址',
     issues.version&&'尚未添加的视频',issues.cover&&'已选中的封面'].filter(Boolean);
   $('ux-unsaved-description').textContent='这些修改尚未保存：'+labels.join('、')+'。可以继续编辑，或放弃本次草稿。';
   const savable=(issues.title||issues.url)&&!issues.version&&!issues.cover &&
     Number(issues.title)+Number(issues.url)===1;
   $('ux-unsaved-save').hidden=!savable;
   $('ux-unsaved-save').textContent=issues.title?'保存名称并继续':'保存地址并继续';
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
 $('ux-sort-undo').addEventListener('click',undoSort);

 function renderFilters(){
   const target=$('ux-categories');target.replaceChildren();
   const options=[['featured','★ 首页精选',state.orderDraft.featured.length],
     ...categories.map(([id,label])=>[id,label,list().filter(p=>p.category===id).length])];
   for(const [key,title,count] of options){
     const b=node('button','ux-filter');b.type='button';
     b.dataset.filter=key;b.setAttribute('aria-pressed',String(key===filter));
     b.append(node('span','',title),node('small','',count));
     b.addEventListener('click',()=>{filter=key;renderGallery();});
     target.append(b);
   }
   $('ux-overview').textContent=list().length+' 部作品 · '+state.orderDraft.featured.length+' 部首页精选';
   $('ux-search').placeholder='搜索 '+list().length+' 部作品…';
 }
 function card(project,group,index){
   const a=node('article','ux-project');a.dataset.id=project.id;a.tabIndex=0;
   a.setAttribute('role','button');a.setAttribute('aria-label','编辑 '+project.title);
   const image=node('div','ux-project-image');
   image.append(photo('/project-cover/'+project.id+'?v='+Date.now(),project.title));
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
     label.title='双击修改名称';
     label.addEventListener('dblclick',event=>{
       event.preventDefault();event.stopPropagation();
       editInlineName(project,language,label);
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
 function renderGallery(){
   if(!state.ordering)return;
   renderFilters();
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
   if(!count&&(search||filter==='featured'))
     fragment.append(node('p','ux-empty','没有找到匹配的作品。'));
   target.replaceChildren(fragment);
   $('ux-sort-hint').textContent=search?'正在搜索全部作品 · 清除搜索后可以直接拖动封面排序':
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
   if(!$('ux-editor').hidden&&(draftSections().title||draftSections().url||
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
     button.append(photo('/project-cover/'+project.id,project.title),node('span','',project.title));
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
   finally{busy=false;}
 }
 async function saveTitle(p,zh,en){
   if(busy)return false;
   if(dirty()){notify('请先保存排序，再修改作品名称。',true);return false;}
   if(!zh||!en){notify('中英文标题都不能为空。',true);return false;}
   busy=true;
   try{
     await api('/api/update-title',{
       id:p.id,titleZh:zh,titleEn:en,expectedZh:p.title,expectedEn:p.titleEn,confirmed:true,
     });
     await bootstrap();
     renderGallery();renderEditor();
     $('ux-context-save').textContent='作品名称已保存到本地 · 未发布网站';
     notify('已保存作品名称：本地视频、封面和海报文件名已同步；线上 ImageKit 地址未更改。');
     return true;
   }catch(e){notify('保存名称失败：'+e.message,true);return false;}
   finally{busy=false;}
 }
 function editInlineName(p,language,label){
   if(busy||dirty()){if(dirty())notify('请先保存当前排序。',true);return;}
   const field=node('input','ux-inline-name');
   field.type='text';field.maxLength=80;field.value=language==='zh'?p.title:p.titleEn;
   label.replaceWith(field);field.focus();field.select();
   let done=false;
   const restore=()=>{if(field.isConnected)field.replaceWith(label);};
   const commit=()=>{
     if(done)return;done=true;const value=field.value.trim().replace(/\s+/g,' ');
     restore();
     if(!value||value===(language==='zh'?p.title:p.titleEn))return;
     saveTitle(p,language==='zh'?value:p.title,language==='en'?value:p.titleEn);
   };
   field.addEventListener('keydown',event=>{
     event.stopPropagation();
     if(event.key==='Enter'){event.preventDefault();field.blur();}
     if(event.key==='Escape'){done=true;restore();}
   });
   field.addEventListener('click',event=>event.stopPropagation());
   field.addEventListener('blur',commit,{once:true});
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
     selectedId=id;selectedVersion='main';
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
 function open(id,versionId='main'){
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
   renderEditor();
   $('ux-editor').hidden=false;
   $('ux-library').inert=true;
   document.body.classList.add('ux-editor-open');
   $('ux-editor').querySelector('.ux-editor-pane').focus({preventScroll:true});
 }
 function finishCloseEditor(){
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
 function renderEditor(){
   if(!selectedId||!byId(selectedId))return;
   const p=byId(selectedId),work=managed(selectedId);
   const options=versions(selectedId);
   if(!options.some(v=>v.id===selectedVersion))selectedVersion='main';
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
   $('ux-cover-img').src='/project-cover/'+p.id+'?v='+Date.now();
   $('ux-poster-img').src='/project-poster/'+p.id+'/'+encodeURIComponent(v?.id||'main')+'?v='+Date.now();
   $('ux-poster-size').textContent=v?v.width+' × '+v.height:'原比例';
   const chips=$('ux-variant-chips');chips.replaceChildren();
   for(const option of options){
     const b=node('button','ux-variant',option.label?.zh||'主版本');
     b.type='button';b.setAttribute('aria-pressed',String(option.id===selectedVersion));
     b.addEventListener('click',()=>{
       if(option.id===selectedVersion)return;
       navigateWithDraft(()=>{
         if(history.isOpen())history.close();
         inlineCover.cancel();
         cancelVersion();
         selectedVersion=option.id;
         renderEditor();
       });
     });
     chips.append(b);
   }
   chips.hidden=options.length<2;
   $('ux-stage-version').hidden=options.length>1;
   const url=online?.videoUrl||null;
   $('ux-cloud-badge').textContent=url?'已配置 ImageKit 地址':'未配置线上视频';
   $('ux-cloud-badge').dataset.connected=String(Boolean(url));
   $('ux-version-label').textContent='当前版本：'+(v?.label?.zh||'主版本')+
     ' · '+(v?.width||'-')+' × '+(v?.height||'-');
   $('ux-url-readonly').textContent=url||'未设置线上视频地址 · 点击填写 ImageKit 链接';
   $('ux-url-readonly').title='单击编辑 ImageKit 地址；进入编辑后可复制或修改';
   $('ux-add-variant').hidden=false;
   {
     const index=String.fromCharCode(65+Math.min(options.length,25));
     $('ux-version-zh').value='版本 '+index;
     $('ux-version-en').value='Version '+index;
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
 }
 function launchEditor(kind){
   if(!selectedId)return;
   if(draftSections().title||draftSections().url||draftSections().version){
     navigateWithDraft(()=>launchEditor(kind));return;
   }
   if(dirty()){notify('请先保存排序，再编辑封面。',true);return;}
   const v=poster(selectedId);
   if(!v){notify('没有找到对应视频版本。',true);return;}
   syncContext(kind==='poster'?'正在编辑当前版本的播放器海报；不影响 3:4 作品封面或其他版本。':'正在编辑整部作品的 3:4 卡片封面；不会修改各视频版本的海报。');
   inlineCover.start(kind,selectedId,v);
 }
 function cancelVersion(){
   $('ux-version-form').hidden=true;
   $('ux-version-file').value='';
   if(selectedId)player.setSource(selectedId,selectedVersion);
   const current=poster(selectedId);
   if(current)$('ux-stage-version').textContent=(current.label?.zh||'主版本')+' · '+current.width+' × '+current.height;
 }
 function launchHistory(kind,opener){
   if(!selectedId||busy)return;
   if(draftSections().title||draftSections().url||draftSections().version){
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
   if(draftSections().title||draftSections().url){
     navigateWithDraft(()=>launchVersion());return;
   }
   const work=managed(selectedId);
   if(!work){notify('此作品暂时无法管理版本。',true);return;}
   if(inlineCover.active())inlineCover.cancel();
   const form=$('ux-version-form');
   if(!form.hidden){cancelVersion();return;}
   form.hidden=false;
   syncContext('正在添加一个新视频版本；原版本与原海报不会被覆盖。');
   $('ux-version-status').textContent='选择 MP4 后可以先在左侧播放预览，确认名称再保存。';
   $('ux-context-save').textContent='正在添加视频版本 · 尚未保存';
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
   if(busy)return;
   const id=selectedId;
   busy=true;
   $('ux-version-submit').disabled=true;
   $('ux-version-status').textContent='正在导入本地 MP4 并创建视频版本…';
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
     busy=false;$('ux-version-submit').disabled=false;
   }
 }
 async function saveURL(){
   const work=managed(selectedId),v=work?.versions.find(x=>x.id===selectedVersion);
   if(!work||!v)return;
   const url=editableURL();
   if(urlError()){notify(urlError(),true);return false;}
   if(busy)return;busy=true;
   try{
     const result=await api('/api/bind-imagekit',{
       projectId:selectedId,variantId:selectedVersion,url,
       expectedUrl:v.videoUrl||null,confirmed:true,
     });
     v.videoUrl=result.url;renderEditor();
     $('ux-context-save').textContent='ImageKit 地址已保存到本地 · 未发布网站';
     notify('已保存：'+(v.label?.zh||'主版本')+' 的 ImageKit 地址（仅本地配置，尚未发布网站）。');
     return true;
   }catch(e){notify('保存线上地址失败：'+e.message,true);return false;}
   finally{busy=false;}
 }
 $('ux-search').addEventListener('input',event=>{
   search=event.target.value.trim();renderGallery();
 });
 $('ux-work-prev').addEventListener('click',()=>navigateWork(-1));
 $('ux-work-next').addEventListener('click',()=>navigateWork(1));
 $('ux-close-editor').addEventListener('click',closeEditor);
 $('ux-editor').querySelector('[data-ux-close]').addEventListener('click',closeEditor);
 $('ux-feature-close').addEventListener('click',closeFavorite);
 $('ux-feature-dialog').querySelector('[data-ux-feature-close]').addEventListener('click',closeFavorite);
 const openModal=()=>{
   if(!$('ux-unsaved-dialog').hidden)return $('ux-unsaved-dialog');
   if(history.isOpen())return $('ux-history-dialog');
   if(!$('ux-feature-dialog').hidden)return $('ux-feature-dialog');
   if(!$('ux-editor').hidden)return $('ux-editor');
   return null;
 };
 document.addEventListener('keydown',event=>{
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
   $('ux-context-save').textContent=hasChanges?'作品名称有未保存修改':'已保存到本地 · 未发布网站';
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
 $('ux-version-cancel').addEventListener('click',cancelVersion);
 $('ux-version-file').addEventListener('change',event=>{
   const file=event.target.files?.[0];
   if(!file)return;
   if(!/\.mp4$/i.test(file.name)||file.size>2*1024**3){
     $('ux-version-status').textContent='只支持不超过 2GB 的 MP4 视频。';
     return;
   }
   player.previewFile(file);
   $('ux-stage-version').textContent='待添加 · '+file.name;
   $('ux-version-status').textContent='视频已在左侧加载预览；确认版本名称后可添加，不会替换原文件。';
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
   if(raw.startsWith(prefix))$('ux-url-value').value=filenameOf(raw);
   syncUrlValidation();
   $('ux-context-save').textContent=editableURL()===(managed(selectedId)?.versions.find(v=>v.id===selectedVersion)?.videoUrl||'')?'已保存到本地 · 未发布网站':'ImageKit 地址有未保存修改';
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
