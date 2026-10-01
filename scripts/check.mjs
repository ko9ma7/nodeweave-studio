import { readFile, access, readdir } from 'node:fs/promises';import { spawnSync } from 'node:child_process';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');let failures=[];
for(const file of ['src/app.js','src/catalog.js','src/catalog-loader.js','src/geometry.js','src/export.js','src/storage.js','src/svg-worker.js','sw.js','scripts/build.mjs','scripts/serve.mjs']){
  const r=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});if(r.status!==0)failures.push(`${file}: ${r.stderr||r.stdout}`);
}
for(const file of ['index.html','admin.html','src/styles.css','catalog/index.json','catalog/library.json','catalog/styles.json','assets/favicon.svg','assets/favicon-32x32.png','assets/apple-touch-icon.png','assets/icon-192.png','assets/icon-512.png','assets/og-image.png','manifest.webmanifest','404.html','.github/workflows/deploy.yml','github-bootstrap.cmd','README.md']){try{await access(path.join(root,file));}catch{failures.push(`missing: ${file}`)}}
try{JSON.parse(await readFile(path.join(root,'manifest.webmanifest'),'utf8'));JSON.parse(await readFile(path.join(root,'site.config.json'),'utf8'));JSON.parse(await readFile(path.join(root,'catalog/index.json'),'utf8'));JSON.parse(await readFile(path.join(root,'catalog/library.json'),'utf8'));JSON.parse(await readFile(path.join(root,'catalog/styles.json'),'utf8'));}catch(e){failures.push(`JSON parse: ${e.message}`)}
const html=await readFile(path.join(root,'index.html'),'utf8');for(const ref of [...html.matchAll(/(?:src|href)="\.\/([^"#?]+)"/g)].map(m=>m[1])){if(ref==='')continue;try{await access(path.join(root,ref));}catch{failures.push(`index ref missing: ${ref}`)}}
try{await access(path.join(root,'dist/index.html'));const built=await readFile(path.join(root,'dist/index.html'),'utf8');if(built.includes('__SITE_URL__'))failures.push('dist/index.html still contains __SITE_URL__');}catch{}
if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log('[check] syntax, assets, metadata references: OK');

const lib=JSON.parse(await readFile(path.join(root,'catalog/library.json'),'utf8'));
const smart=lib.templates?.flatMap(t=>t.nodes||[]).filter(n=>['radial-plan','brain-map'].includes(n.type))||[];
if(!smart.length){console.error('Smart templates missing');process.exit(1)}
for(const n of smart){if(n.type==='radial-plan'&&!Array.isArray(n.data?.segments)){console.error('Radial plan data missing');process.exit(1)}if(n.type==='brain-map'&&!Array.isArray(n.data?.regions)){console.error('Brain map data missing');process.exit(1)}}
console.log(`[check] smart template nodes: ${smart.length}`);
