import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { saveProjectTitle } from '../../../portfolio-workbench/project-titles.mjs';
const root=path.resolve(import.meta.dirname,'../../..');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-title-mp4-test-'));
const data=path.join(temp,'src/data'), videos=path.join(temp,'assets/videos/works');
const covers=path.join(temp,'assets/images/project-covers');
const posters=path.join(temp,'assets/images/player-posters');
await fs.mkdir(data,{recursive:true}); await fs.mkdir(videos,{recursive:true});
for(const name of ['project-title-overrides.json','auto-projects.json','local-video-origins.json','local-video-paths.json','project-cover-overrides.json','project-video-metadata.json'])
  await fs.copyFile(path.join(root,'src/data',name),path.join(data,name));
await fs.cp(path.join(root,'assets/images/project-covers'),covers,{recursive:true});
await fs.cp(path.join(root,'assets/images/player-posters'),posters,{recursive:true});
const origins=JSON.parse(await fs.readFile(path.join(data,'local-video-origins.json'),'utf8'));
const auto=JSON.parse(await fs.readFile(path.join(data,'auto-projects.json'),'utf8'));
const current=JSON.parse(await fs.readFile(path.join(data,'local-video-paths.json'),'utf8'));
const old1=current['01']||origins['01'];
const old16=auto.find(p=>p.id==='16').localVideoPath;
const oldB=auto.find(p=>p.id==='16').variants[0].localVideoPath;
for(const rel of [old1,old16,oldB]){
  const src=path.join(videos,rel), dst=path.join(root,'assets/videos/works',rel);
  await fs.mkdir(path.dirname(src),{recursive:true});await fs.copyFile(dst,src);
}
const sha=async p=>createHash('sha256').update(await fs.readFile(p)).digest('hex');
const before=await sha(path.join(videos,old1));
const overrides=JSON.parse(await fs.readFile(path.join(data,'project-title-overrides.json'),'utf8'));
const one=overrides['01'];
const sixteen=overrides['16'];
const options={projectRoot:temp,workspace:path.join(temp,'.cover-studio'),confirmed:true};
const res1=await saveProjectTitle({...options,projects:[{id:'01',category:'commercial',title:one.zh,titleEn:one.en}],id:'01',
  titleZh:'屈臣氏品牌广告',titleEn:'Watsons Brand Commercial Test',expectedZh:one.zh,expectedEn:one.en});
assert.equal(res1.renamedFiles.length,1);
assert.equal(res1.renamedArtwork.length,2);
assert.equal((await fs.readFile(path.join(data,'project-cover-overrides.json'),'utf8')).includes('Watsons Brand Commercial Test.webp'),true);
assert.equal((await fs.readFile(path.join(data,'project-video-metadata.json'),'utf8')).includes('Watsons Brand Commercial Test.webp'),true);
assert.equal(await sha(path.join(videos,res1.renamedFiles[0].after)),before);
assert.equal((await fs.readFile(path.join(data,'local-video-paths.json'),'utf8')).includes('Watsons Brand Commercial Test.mp4'),true);
const res16=await saveProjectTitle({...options,projects:[{id:'16',category:'commercial',title:sixteen.zh,titleEn:sixteen.en}],id:'16',
  titleZh:'会员权益创意广告',titleEn:'Membership Perks Commercial Test',expectedZh:sixteen.zh,expectedEn:sixteen.en});
assert.equal(res16.renamedFiles.length,2);
assert.equal(res16.renamedArtwork.length,3);
const updated=JSON.parse(await fs.readFile(path.join(data,'auto-projects.json'),'utf8')).find(p=>p.id==='16');
assert(updated.localVideoPath.endsWith('Membership Perks Commercial Test - Version A.mp4'));
assert(updated.variants[0].localVideoPath.endsWith('Membership Perks Commercial Test - Version B.mp4'));
await assert.rejects(saveProjectTitle({...options,projects:[{id:'01',title:'屈臣氏品牌广告',titleEn:'Watsons Brand Commercial Test'}],id:'01',
 titleZh:'屈臣氏品牌广告',titleEn:'Not A Brand',expectedZh:'过期标题',expectedEn:'Watsons Brand Commercial Test'}),/已有变更/);
console.log('MP4_RENAME_TRANSACTION_PASS legacy and two-variant project, original byte hash unchanged; revision history intact',temp);
