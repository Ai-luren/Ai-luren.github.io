// Guard the published-site and local-workbench folder contract after refactors.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const at=relative=>path.join(root,relative);
const mustExist=[
  'index.html','works.html','package.json','netlify.toml','vite.config.js',
  'src/App.jsx','src/data/projects.js','portfolio-workbench/server.mjs',
  'portfolio-workbench/index.html','scripts/run-check-suite.mjs',
  'scripts/lib/safe-media.mjs','scripts/checks/site','scripts/checks/workbench',
];
for(const relative of mustExist)assert(fs.existsSync(at(relative)),`Expected portfolio path missing: ${relative}`);
assert(!fs.existsSync(at('tools/cover-studio')),'Legacy nested workbench folder returned');
assert(!fs.existsSync(at('.oil-ui')),'Legacy screenshot output should remain under ignored .audit/');
const npm=JSON.parse(fs.readFileSync(at('package.json'),'utf8')).scripts;
assert(npm.workbench?.includes('portfolio-workbench/server.mjs'),'Local workbench command missing');
assert(npm.covers==='npm run workbench','Legacy covers command must remain available');
for(const [name,command] of Object.entries(npm)){
  for(const match of command.matchAll(/\bnode\s+(scripts\/[^\s;&|]+\.mjs)\b/g)){
    assert(fs.existsSync(at(match[1])),`npm run ${name} points to removed script: ${match[1]}`);
  }
}
let count=0;
for(const area of ['site','workbench']){
  const dir=at(`scripts/checks/${area}`);
  for(const file of fs.readdirSync(dir).filter(file=>file.endsWith('.mjs'))){
    count++;
    const full=path.join(dir,file),source=fs.readFileSync(full,'utf8');
    for(const match of source.matchAll(/\bfrom\s+['"](\.{1,2}\/[^'"]+)['"]/g)){
      assert(fs.existsSync(path.resolve(dir,match[1])),`${area}/${file}: import missing: ${match[1]}`);
    }
    for(const match of source.matchAll(/new URL\(['"](\.{1,2}\/[^'"]+)['"],\s*import\.meta\.url/g)){
      assert(fs.existsSync(path.resolve(dir,match[1])),`${area}/${file}: relative data missing: ${match[1]}`);
    }
  }
}
assert(count>=89,`Expected 89+ regression scripts, found ${count}`);
for(const file of ['README.md','AGENTS.md','docs/交接说明.md']){
 const text=fs.readFileSync(at(file),'utf8');
 assert(text.includes('portfolio-workbench/'),`${file} missing current workbench path`);
 assert(!text.includes('tools/cover-studio/'),`${file} still references removed nested path`);
}
console.log(`REPOSITORY_LAYOUT_PASS: ${count} check modules, ${Object.keys(npm).length} npm scripts, stable Vite/Netlify entry points`);
