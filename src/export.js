import { diagramStyleDefs, esc, edgeGeometry, nodeBounds, nodeTextMarkup, resolveNodeStyle, shapePrimitive } from './geometry.js';

function markerDefs(tokens){
  return `<defs>${diagramStyleDefs(tokens)}<marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/></marker></defs>`;
}

function edgeMarkup(edge,state){
  const g=edgeGeometry(edge,state.nodes); if(!g)return '';
  const stroke=edge.style?.stroke??state.tokens.edge;
  const width=edge.style?.width??state.tokens.edgeWidth??1.8;
  const dash=edge.style?.dash??state.tokens.edgeDash??'';
  const arrow=edge.style?.arrow!==false;
  const path=`<path d="${g.d}" fill="none" stroke="${esc(stroke)}" stroke-width="${width}" ${dash?`stroke-dasharray="${esc(dash)}"`:''} ${arrow?'marker-end="url(#arrow)"':''} stroke-linecap="${esc(state.tokens.edgeLinecap||'round')}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
  const label=edge.label?`<text x="${g.label.x}" y="${g.label.y-8}" fill="${esc(state.tokens.text)}" font-family="${esc(state.tokens.fontFamily)}" font-size="12" font-weight="650" text-anchor="middle" paint-order="stroke" stroke="${esc(state.tokens.canvas)}" stroke-width="5" stroke-linejoin="round">${esc(edge.label)}</text>`:'';
  return path+label;
}

export function diagramSvg(state,{background=true,padding=48,includeMetadata=true}={}){
  const bounds=nodeBounds(state.nodes,padding);
  const width=Math.max(1,Math.ceil(bounds.w)),height=Math.max(1,Math.ceil(bounds.h));
  const title=esc(state.meta?.name||'NodeWeave diagram');
  const desc='Diagram exported from NodeWeave Studio';
  const bg=background?`<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.w}" height="${bounds.h}" fill="${esc(state.tokens.canvas)}"/>`:'';
  const edges=state.edges.map(e=>edgeMarkup(e,state)).join('\n');
  const nodes=state.nodes.map(n=>`<g>${shapePrimitive(n,state.tokens)}${nodeTextMarkup(n,state.tokens)}</g>`).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}" role="img" aria-labelledby="diagram-title diagram-desc">
${includeMetadata?`<title id="diagram-title">${title}</title><desc id="diagram-desc">${esc(desc)}</desc>`:''}
${markerDefs(state.tokens)}${bg}<g>${edges}</g><g>${nodes}</g></svg>`;
}

export function downloadBlob(blob,filename){
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url;a.download=filename;document.body.append(a);a.click();a.remove(); setTimeout(()=>URL.revokeObjectURL(url),800);
}
export const slugify=(name='diagram')=>name.toLowerCase().trim().replace(/[^a-z0-9가-힣]+/g,'-').replace(/^-|-$/g,'')||'diagram';

export function exportSvg(state,options={}){ const svg=diagramSvg(state,options); downloadBlob(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}),`${slugify(state.meta?.name)}.svg`); }

export async function exportRaster(state,format='png',{scale=2,background=true}={}){
  const svg=diagramSvg(state,{background});
  const bounds=nodeBounds(state.nodes,48); const width=Math.max(1,Math.ceil(bounds.w*scale)),height=Math.max(1,Math.ceil(bounds.h*scale));
  const blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'}); const url=URL.createObjectURL(blob); const img=new Image();
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');
  ctx.setTransform(scale,0,0,scale,0,0);ctx.drawImage(img,0,0,bounds.w,bounds.h); URL.revokeObjectURL(url);
  const mime=format==='webp'?'image/webp':'image/png'; const out=await new Promise(resolve=>canvas.toBlob(resolve,mime,format==='webp'?.92:undefined));
  if(!out)throw new Error('이미지 변환에 실패했습니다.'); downloadBlob(out,`${slugify(state.meta?.name)}.${format}`);
}

export function exportHtml(state,{background=true}={}){
  const svg=diagramSvg(state,{background});
  const title=esc(state.meta?.name||'Diagram');
  const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>html,body{margin:0;min-height:100%;font-family:system-ui,sans-serif;background:#111827}main{min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box}.frame{max-width:100%;overflow:auto;background:white;border-radius:16px;box-shadow:0 18px 60px #0005}svg{display:block;max-width:100%;height:auto}.hint{position:fixed;right:16px;bottom:16px;background:#111827dd;color:white;padding:8px 12px;border-radius:999px;font-size:12px}</style></head><body><main><div class="frame">${svg}</div></main><div class="hint">NodeWeave HTML export · 브라우저 확대/축소 사용 가능</div></body></html>`;
  downloadBlob(new Blob([html],{type:'text/html;charset=utf-8'}),`${slugify(state.meta?.name)}.html`);
}

export function exportJson(state){
  const doc={version:1,meta:state.meta,nodes:state.nodes,edges:state.edges,tokens:state.tokens,settings:state.settings,themeId:state.themeId};
  downloadBlob(new Blob([JSON.stringify(doc,null,2)],{type:'application/json'}),`${slugify(state.meta?.name)}.nodeweave.json`);
}

export async function copySvg(state,{background=true}={}){
  await navigator.clipboard.writeText(diagramSvg(state,{background}));
}
