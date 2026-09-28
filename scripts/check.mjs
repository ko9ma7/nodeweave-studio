import { readFile, access, readdir } from 'node:fs/promises';import { spawnSync } from 'node:child_process';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');let failures=[];
for(const file of ['src/app.js','src/catalog.js','src/geometry.js','src/export.js','src/storage.js','src/style-loader.js','sw.js','scripts/build.mjs','scripts/serve.mjs']){
  const r=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});if(r.status!==0)failures.push(`${file}: ${r.stderr||r.stdout}`);
}
for(const file of ['index.html','src/styles.css','assets/favicon.svg','assets/favicon-32x32.png','assets/apple-touch-icon.png','assets/icon-192.png','assets/icon-512.png','assets/og-image.png','manifest.webmanifest','404.html','.github/workflows/deploy.yml','github-bootstrap.cmd','README.md']){try{await access(path.join(root,file));}catch{failures.push(`missing: ${file}`)}}
try{JSON.parse(await readFile(path.join(root,'manifest.webmanifest'),'utf8'));JSON.parse(await readFile(path.join(root,'site.config.json'),'utf8'));const styles=JSON.parse(await readFile(path.join(root,'catalog/styles.json'),'utf8'));if(!Array.isArray(styles.styles)||styles.styles.length<39)throw new Error('catalog/styles.json must contain at least 39 styles');}catch(e){failures.push(`JSON parse: ${e.message}`)}
const html=await readFile(path.join(root,'index.html'),'utf8');for(const ref of [...html.matchAll(/(?:src|href)="\.\/([^"#?]+)"/g)].map(m=>m[1])){if(ref==='')continue;try{await access(path.join(root,ref));}catch{failures.push(`index ref missing: ${ref}`)}}
try{await access(path.join(root,'dist/index.html'));const built=await readFile(path.join(root,'dist/index.html'),'utf8');if(built.includes('__SITE_URL__'))failures.push('dist/index.html still contains __SITE_URL__');}catch{}
if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log('[check] syntax, assets, metadata references: OK');
