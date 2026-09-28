import { SHAPES, BUILTIN_ICONS, TEMPLATES, THEMES } from './catalog.js';

const PREVIEW_KEY='nodeweave.catalog.preview.v1';

function mergeById(target,items=[]){
  const map=new Map(target.map((x,i)=>[x.id,{item:x,index:i}]));
  for(const item of items||[]){
    if(!item?.id)continue;
    const hit=map.get(item.id);
    if(hit) target[hit.index]={...target[hit.index],...item};
    else { map.set(item.id,{item,index:target.length}); target.push(item); }
  }
}
async function fetchJson(url){
  const res=await fetch(url,{cache:'no-store'});
  if(!res.ok)throw new Error(`${url}: ${res.status}`);
  return res.json();
}
function applyPack(pack={}){
  mergeById(SHAPES,pack.shapes);
  mergeById(BUILTIN_ICONS,pack.svgAssets);
  mergeById(TEMPLATES,pack.templates);
  mergeById(THEMES,pack.styles);
}
export async function loadCatalogPacks(){
  const packs=[];
  try{
    const index=await fetchJson('./catalog/index.json');
    for(const file of index.packs||[]){
      try{packs.push(await fetchJson('./catalog/'+file));}
      catch(error){console.warn('[catalog] pack skipped',file,error);}
    }
  }catch(error){
    console.warn('[catalog] index unavailable; falling back to direct packs',error);
    for(const file of ['library.json','styles.json']){
      try{packs.push(await fetchJson('./catalog/'+file));}catch{}
    }
  }
  for(const pack of packs){
    if(Array.isArray(pack?.styles)) applyPack({styles:pack.styles});
    else applyPack(pack);
  }
  try{
    const preview=JSON.parse(localStorage.getItem(PREVIEW_KEY)||'null');
    if(preview)applyPack(preview);
  }catch(error){console.warn('[catalog] preview ignored',error);}
  return {shapes:SHAPES.length,icons:BUILTIN_ICONS.length,templates:TEMPLATES.length,styles:THEMES.length};
}
