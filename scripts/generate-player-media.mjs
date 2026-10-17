// Local maintenance only: native-ratio posters and display dimensions, never card covers.
import { createServer } from 'vite';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve(import.meta.dirname, '..');
const overrides = JSON.parse(readFileSync(resolve(root, 'src/data/project-cover-overrides.json'), 'utf8'));
const metadataPath = resolve(root, 'src/data/project-video-metadata.json');
const previous = existsSync(metadataPath) ? JSON.parse(readFileSync(metadataPath, 'utf8')) : {};
const output = { ...previous };
const only = process.argv.find(a => a.startsWith('--id='))?.slice(5);
const explicitTime = process.argv.find(a => a.startsWith('--time='))?.slice(7);
if (explicitTime !== undefined && (!only || !Number.isFinite(Number(explicitTime)) || Number(explicitTime) < 0)) throw new Error('--time requires --id and non-negative seconds.');
function run(bin,args) {
  const result=spawnSync(bin,args,{maxBuffer:32*1024*1024,timeout:120000});
  if(result.error || result.status!==0) throw new Error(`${bin}: ${result.error?.message || result.stderr.toString()}`);
  return result.stdout;
}
const vite = await createServer({configFile:false,root,server:{middlewareMode:true,watch:null,hmr:false,ws:false},appType:'custom',logLevel:'error'});
try {
  const {PROJECTS}=await vite.ssrLoadModule('/src/data/projects.js');
  if(only && !PROJECTS.some(p=>p.id===only)) throw new Error('Unknown project ID');
  mkdirSync(resolve(root,'assets/images/player-posters'),{recursive:true});
  for(const project of PROJECTS.filter(p=>!only || p.id===only)) {
    const url=project.videoUrl;
    if(!url || /^https?:/.test(url)) throw new Error(`Project ${project.id}: local source required for generation.`);
    const source=resolve(root,decodeURI(url).replace(/^\//,''));
    if(!source.startsWith(resolve(root,'assets/videos/works')+'/')) throw new Error('Invalid local source');
    const probe=JSON.parse(run('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,sample_aspect_ratio:stream_side_data=rotation:format=duration','-of','json',source]));
    const stream=probe.streams[0];
    const [sarW,sarH]=(stream.sample_aspect_ratio || '1:1').split(':').map(Number);
    let width=Math.round(stream.width*(sarW && sarH ? sarW/sarH : 1)),height=stream.height;
    const rotation=stream.side_data_list?.find(d=>Number.isFinite(d.rotation))?.rotation || 0;
    if(Math.abs(rotation)%180===90) [width,height]=[height,width];
    let time=Number(explicitTime ?? previous[project.id]?.playerPosterTime ?? Math.min(1,Number(probe.format.duration)/2));
    let timeSource=explicitTime!==undefined ? 'explicit' : previous[project.id]?.playerPosterTimeSource || 'default-1s';
    if(explicitTime===undefined && overrides[project.id]) {
      const exportId=overrides[project.id].match(/([a-f0-9-]{36})\.webp$/)?.[1];
      const recordPath=resolve(root,`.cover-studio/exports/${exportId}.json`);
      if(exportId && existsSync(recordPath)) {
        const record=JSON.parse(readFileSync(recordPath,'utf8'));
        if(record.sourceName===basename(source) && Number.isFinite(record.time)) { time=record.time;timeSource='confirmed-cover-selection'; }
      }
    }
    if(!(time>=0 && time<Number(probe.format.duration))) throw new Error(`Invalid poster time for ${project.id}`);
    const webp=run('ffmpeg',['-v','error','-ss',String(time),'-i',source,'-frames:v','1','-vf',`scale=${width}:${height},setsar=1,scale=w='min(1600,iw)':h='min(1600,ih)':force_original_aspect_ratio=decrease`,'-c:v','libwebp','-quality','88','-f','image2pipe','pipe:1']);
    const title=String(project.title.zh).trim().replace(/[\\/\0<>:"|?*]/g,'-');
    if(!title) throw new Error(`Project ${project.id}: Chinese title required for poster filename.`);
    const filename=`${title}-${createHash('sha256').update(webp).digest('hex').slice(0,12)}.webp`;
    const path=resolve(root,'assets/images/player-posters',filename);
    if(!existsSync(path)) writeFileSync(path,webp,{flag:'wx'});
    output[project.id]={videoWidth:width,videoHeight:height,playerPoster:filename,playerPosterTime:time,playerPosterTimeSource:timeSource};
    console.log(`${project.id}: ${width}×${height}, ${time.toFixed(3)}s (${timeSource})`);
  }
  writeFileSync(metadataPath,JSON.stringify(output,null,2)+'\n');
} finally {await vite.close();}
