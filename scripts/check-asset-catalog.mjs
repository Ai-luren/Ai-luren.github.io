import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>JSON.parse(readFileSync(path.join(root,'src/data',file),'utf8'));
const titles=read('project-title-overrides.json');
const covers=read('project-cover-overrides.json');
const metadata=read('project-video-metadata.json');
const paths=read('local-video-paths.json');
const auto=read('auto-projects.json');
const source=readFileSync(path.join(root,'src/data/projects.js'),'utf8');
const cats={};
for(const match of source.matchAll(/\{ id: '(\d+)', category: '([^']+)'/g)) cats[match[1]]=match[2];
for(const project of auto)cats[project.id]=project.category;
const imageRoots={
  cover:path.join(root,'assets/images/project-covers'),
  poster:path.join(root,'assets/images/player-posters'),
};
const allowed=['commercial','short-film','social','visual'];
const activeCover=new Set(),activePoster=new Set();
let videoCount=0;
function validateArtwork(type,rel,id,name) {
  const parts=String(rel||'').split('/');
  assert.equal(parts.length,2,id+' invalid artwork path '+type+': '+rel);
  assert.equal(parts[0],cats[id],id+' artwork must use project category');
  assert.equal(parts[1],name+'.webp',id+' artwork basename must equal video/title');
  const full=path.join(imageRoots[type],rel);
  assert(existsSync(full),id+' missing '+type+' file: '+full);
  assert(statSync(full).size>500,id+' image is empty or damaged');
  (type==='cover'?activeCover:activePoster).add(rel);
}
for(const [id,title] of Object.entries(titles)) {
  if(auto.some(project=>project.id===id))continue;
  assert(allowed.includes(cats[id]),'Invalid/missing category for '+id);
  assert.equal(title.en,title.en.trim(),'Whitespace in English name '+id);
  assert(!/\s{2,}/.test(title.en),'Repeated spaces in '+id);
  validateArtwork('cover',covers[id],id,title.en);
  const project=auto.find(p=>p.id===id);
  const versions=project?[project.localVideoPath,...(project.variants||[]).map(v=>v.localVideoPath)]:[paths[id]];
  assert(versions.every(Boolean),'Missing MP4 path for '+id);
  const posters=[metadata[id]?.playerPoster,...(project?.variants||[]).map(v=>v.posterFile)];
  assert.equal(posters.length,versions.length,'MP4 version/poster count differs for '+id);
  for(let i=0;i<versions.length;i++){
    const video=versions[i];
    const name=path.posix.basename(video,'.mp4');
    assert(name.startsWith(title.en),'English MP4 basename mismatch: '+id);
    const full=path.join(root,'assets/videos/works',video);
    assert(existsSync(full),'MP4 missing: '+full);
    assert(statSync(full).size>800,'MP4 empty: '+full);
    validateArtwork('poster',posters[i],id,name);
    videoCount++;
  }
}
for(const project of auto) {
  const {id,title}=project;
  assert(allowed.includes(project.category),'Invalid/missing category for '+id);
  assert.equal(title.en,title.en.trim(),'Whitespace in English name '+id);
  assert(!/\s{2,}/.test(title.en),'Repeated spaces in '+id);
  validateArtwork('cover',project.coverFile,id,title.en);
  const versions=[project.localVideoPath,...(project.variants||[]).map(variant=>variant.localVideoPath)];
  const posters=[metadata[id]?.playerPoster,...(project.variants||[]).map(variant=>variant.posterFile)];
  assert(versions.every(Boolean),'Missing MP4 path for '+id);
  assert.equal(posters.length,versions.length,'MP4 version/poster count differs for '+id);
  for(let i=0;i<versions.length;i++){
    const video=versions[i];
    const name=path.posix.basename(video,'.mp4');
    assert(name.startsWith(title.en),'English MP4 basename mismatch: '+id);
    const full=path.join(root,'assets/videos/works',video);
    assert(existsSync(full),'MP4 missing: '+full);
    assert(statSync(full).size>800,'MP4 empty: '+full);
    validateArtwork('poster',posters[i],id,name);
    videoCount++;
  }
}
const projectCount=Object.keys(titles).filter(id=>!auto.some(project=>project.id===id)).length+auto.length;
assert.equal(activeCover.size,projectCount,'Cover filenames collided');
assert.equal(activePoster.size,videoCount,'Player poster filenames collided');
for(const [type,dir] of Object.entries(imageRoots)){
  for(const entry of readdirSync(dir,{withFileTypes:true})){
    if(entry.name==='.DS_Store')continue;
    assert(entry.isDirectory(),'Unexpected loose file in '+type+' root: '+entry.name);
    assert(allowed.includes(entry.name),'Unknown asset category '+entry.name);
    for(const file of readdirSync(path.join(dir,entry.name))){
      if(file==='.DS_Store')continue;
      assert(file.endsWith('.webp'), 'Unexpected non-WebP in '+type+': '+file);
      assert((type==='cover'?activeCover:activePoster).has(entry.name+'/'+file),
        'Unreferenced public '+type+' image: '+entry.name+'/'+file);
      assert(!/^auto-\d+-|[a-f0-9]{8}-[a-f0-9]{4}-/.test(file),
        'Raw UUID leaked into public artwork filename: '+file);
    }
  }
}
assert(!source.includes('project-covers/library/'));
assert(!source.includes('project-covers/custom/'));
assert(!source.includes('player-posters/*.webp'));
console.log('ASSET_CATALOG_PASS',projectCount,'projects',videoCount,'MP4s',
  activeCover.size,'named 3:4 covers',activePoster.size,'named full-aspect posters; four category folders; no public UUID files');
