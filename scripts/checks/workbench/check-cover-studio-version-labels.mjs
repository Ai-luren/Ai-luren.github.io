import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {listManagedVersions,updateVideoVersionLabel} from '../../../portfolio-workbench/project-versions.mjs';

const fixture=await fs.mkdtemp(path.join(os.tmpdir(),'ailuren-version-labels-'));
const dataDir=path.join(fixture,'src/data'),workspace=path.join(fixture,'.cover-studio');
await fs.mkdir(dataDir,{recursive:true});
await fs.mkdir(workspace,{recursive:true});
const write=async(name,value)=>fs.writeFile(path.join(dataDir,name+'.json'),JSON.stringify(value,null,2)+'\n');
const read=async name=>JSON.parse(await fs.readFile(path.join(dataDir,name+'.json'),'utf8'));
const auto=[{id:'16',featured:false,mainVersionLabel:{zh:'版本 A',en:'Version A'},variants:[{
  id:'auto-variant',label:{zh:'版本 B',en:'Version B'},videoUrl:null,
}]}];
const legacyVariants={'01':[{id:'legacy-variant',label:{zh:'旧版',en:'Original'},videoUrl:null}]};
await Promise.all([
  write('auto-projects',auto),write('legacy-video-variants',legacyVariants),
  write('legacy-imagekit-urls',{}),write('legacy-main-version-labels',{}),
]);
const projects=[{id:'16',title:'MEXC 会员权益',featured:false},{id:'01',title:'屈臣氏品牌广告',featured:true}];
const update=async(projectId,variantId,labelZh,labelEn,expectedLabel)=>updateVideoVersionLabel({
  projectRoot:fixture,workspace,projectId,variantId,labelZh,labelEn,expectedLabel,
  confirmed:true,existingProjects:projects,
});
try{
  await update('16','main','主片 A','Main Cut A',auto[0].mainVersionLabel);
  await update('16','auto-variant','精简版 B','Short Cut B',auto[0].variants[0].label);
  await update('01','main','品牌片 A','Brand Film A',{zh:'主版本',en:'Main version'});
  await update('01','legacy-variant','新版 B','New Cut B',legacyVariants['01'][0].label);
  const [savedAuto,savedVariants,savedLegacyLabels]=await Promise.all([
    read('auto-projects'),read('legacy-video-variants'),read('legacy-main-version-labels'),
  ]);
  assert.deepEqual(savedAuto[0].mainVersionLabel,{zh:'主片 A',en:'Main Cut A'});
  assert.deepEqual(savedAuto[0].variants[0].label,{zh:'精简版 B',en:'Short Cut B'});
  assert.deepEqual(savedLegacyLabels['01'],{zh:'品牌片 A',en:'Brand Film A'});
  assert.deepEqual(savedVariants['01'][0].label,{zh:'新版 B',en:'New Cut B'});
  const managed=await listManagedVersions(fixture,projects);
  assert.deepEqual(managed[0].versions.map(v=>v.label),[
    {zh:'主片 A',en:'Main Cut A'},{zh:'精简版 B',en:'Short Cut B'},
  ]);
  assert.deepEqual(managed[1].versions.map(v=>v.label),[
    {zh:'品牌片 A',en:'Brand Film A'},{zh:'新版 B',en:'New Cut B'},
  ]);
  await assert.rejects(()=>update('16','main','冲突名称','Conflicting Name',auto[0].mainVersionLabel),/版本名称已有更新/);
  const revisions=await fs.readdir(path.join(workspace,'project-revisions'));
  assert.equal(revisions.filter(name=>name.startsWith('version-label-')).length,4);
  console.log('AUTO_AND_LEGACY_MAIN_AND_VARIANT_LABELS_PASS');
}finally{
  await fs.rm(fixture,{recursive:true,force:true});
}
