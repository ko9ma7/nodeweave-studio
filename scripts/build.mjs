import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
const root=path.resolve(import.meta.dirname,'..'); const dist=path.join(root,'dist');
const config=JSON.parse(await readFile(path.join(root,'site.config.json'),'utf8'));
function deriveUrl(){
  if(process.env.SITE_URL)return process.env.SITE_URL.replace(/\/$/,'');
  const repo=process.env.GITHUB_REPOSITORY;
  if(repo){const [owner,name]=repo.split('/');return name.toLowerCase()===`${owner.toLowerCase()}.github.io`?`https://${owner}.github.io`:`https://${owner}.github.io/${name}`;}
  return String(config.siteUrl||'https://example.github.io/nodeweave-studio').replace(/\/$/,'');
}
const siteUrl=deriveUrl();
await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
for(const dir of ['src','assets'])await cp(path.join(root,dir),path.join(dist,dir),{recursive:true});
for(const file of ['manifest.webmanifest','sw.js','.nojekyll'])await cp(path.join(root,file),path.join(dist,file));
for(const file of ['index.html','404.html','robots.txt','sitemap.xml']){
  const raw=await readFile(path.join(root,file),'utf8');
  await writeFile(path.join(dist,file),raw.replaceAll('__SITE_URL__',siteUrl),'utf8');
}
console.log(`[build] site URL: ${siteUrl}`);console.log(`[build] output: ${dist}`);
