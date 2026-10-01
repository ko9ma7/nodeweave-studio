import { BUILTIN_ICONS, DEFAULT_SETTINGS, SHAPES, THEMES, TEMPLATES } from './catalog.js';
import { loadCatalogPacks } from './catalog-loader.js';
import { clamp, diagramStyleDefs, edgeGeometry, esc, nearestPort, nodeBounds, nodeTextMarkup, portsMarkup, resolveNodeStyle, selectionRectMarkup, shapePrimitive } from './geometry.js';
import { copySvg, exportHtml, exportJson, exportRaster, exportSvg } from './export.js';
import { deleteProject, listProjects, loadAutosave, loadUiPrefs, saveAutosave, saveProject, saveUiPrefs } from './storage.js';

const $=(q,root=document)=>root.querySelector(q);
const $$=(q,root=document)=>[...root.querySelectorAll(q)];
const canvas=$('#diagram-canvas');
const viewportEl=$('#canvas-viewport');
const statusEl=$('#status-text');
const toastRegion=$('#toast-region');

await loadCatalogPacks();

const deepClone=(v)=>structuredClone(v);
const uid=(prefix='id')=>`${prefix}-${crypto.randomUUID().slice(0,8)}`;
const themeById=(id)=>THEMES.find(t=>t.id===id)||THEMES[0];
const shapeById=(id)=>SHAPES.find(s=>s.id===id)||SHAPES[0];
const iconById=(id)=>BUILTIN_ICONS.find(i=>i.id===id)||BUILTIN_ICONS[0];

function defaultDocument(){
  const t=TEMPLATES[0], theme=themeById(t.theme);
  return {
    version:1,
    meta:{projectId:uid('project'),name:'제품 온보딩 흐름',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()},
    nodes:t.nodes.map(n=>normalizeNode(n)), edges:t.edges.map(normalizeEdge), tokens:deepClone(theme.tokens), themeId:theme.id,
    settings:deepClone(DEFAULT_SETTINGS)
  };
}
function normalizeNode(n){
  const s=n.type==='custom-svg'?{w:180,h:140,label:'Custom SVG'}:shapeById(n.type);return {id:n.id||uid('node'),type:n.type||'process',x:Number(n.x)||0,y:Number(n.y)||0,w:Number(n.w)||s.w,h:Number(n.h)||s.h,label:n.label??s.label,style:n.style?{...n.style}:{},...(n.customSvg?{customSvg:deepClone(n.customSvg)}:{}),...(n.media?{media:deepClone(n.media)}:{}),...(n.data?{data:deepClone(n.data)}:{})};
}
function customSvgAspectRatio(node){const nums=String(node?.customSvg?.viewBox||'').trim().split(/[\s,]+/).map(Number);return nums.length===4&&nums.every(Number.isFinite)&&nums[2]>0&&nums[3]>0?nums[2]/nums[3]:Math.max(.1,(Number(node?.w)||1)/(Number(node?.h)||1));}
function normalizeEdge(e){return {id:e.id||uid('edge'),source:e.source,target:e.target,sourcePort:e.sourcePort||'right',targetPort:e.targetPort||'left',label:e.label||'',routing:e.routing||'orthogonal',style:e.style?{...e.style}:{}};}
function normalizeDoc(doc){
  const base=defaultDocument(); if(!doc||!Array.isArray(doc.nodes)||!Array.isArray(doc.edges))return base;
  return {version:1,meta:{...base.meta,...doc.meta,updatedAt:new Date().toISOString()},nodes:doc.nodes.map(normalizeNode),edges:doc.edges.map(normalizeEdge),tokens:{...base.tokens,...doc.tokens},themeId:doc.themeId||'minimal',settings:{...DEFAULT_SETTINGS,...doc.settings}};
}

function bytesToBase64Url(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
function base64UrlToBytes(text){const s=text.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-text.length%4)%4);const raw=atob(s),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;}
async function encodeShareDocument(value){const raw=new TextEncoder().encode(JSON.stringify(value));if('CompressionStream' in window){const stream=new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'));return 'gz.'+bytesToBase64Url(new Uint8Array(await new Response(stream).arrayBuffer()));}return 'raw.'+bytesToBase64Url(raw);}
async function decodeShareDocument(value){try{const [mode,payload]=String(value||'').split('.',2);let bytes=base64UrlToBytes(payload||mode);if(mode==='gz'&&'DecompressionStream' in window){const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));bytes=new Uint8Array(await new Response(stream).arrayBuffer());}return JSON.parse(new TextDecoder().decode(bytes));}catch(error){console.warn('공유 링크 해석 실패',error);return null;}}
async function sharedDocumentFromLocation(){const hash=location.hash||'';if(!hash.startsWith('#share='))return null;return decodeShareDocument(hash.slice(7));}

const initialSharedDoc=await sharedDocumentFromLocation();
let doc=normalizeDoc(initialSharedDoc||loadAutosave()||defaultDocument());
let selection={nodeIds:[],edgeId:null};
let viewport={x:80,y:70,scale:1};
let undoStack=[],redoStack=[];
let gesture=null, connectPreview=null, marquee=null, spaceDown=false;
const desktopPanels=window.innerWidth>900;
let leftOpen=desktopPanels,rightOpen=desktopPanels;
let autosaveTimer=null;
let paletteQuery='';
let libraryTab='shapes';
let libraryCategory='all';
let inspectorTab='selection';
let internalClipboard=null;
const uiPrefs=loadUiPrefs();
let librarySort=uiPrefs.librarySort||'recommended';
let libraryView=uiPrefs.libraryView||'grid';

function snapshot(){return deepClone({version:doc.version,meta:doc.meta,nodes:doc.nodes,edges:doc.edges,tokens:doc.tokens,themeId:doc.themeId,settings:doc.settings});}
function restore(s){doc=normalizeDoc(s);selection={nodeIds:[],edgeId:null};scheduleSave();render();}
function pushHistory(previous){undoStack.push(previous||snapshot());if(undoStack.length>80)undoStack.shift();redoStack=[];updateUndoButtons();}
function undo(){if(!undoStack.length)return;redoStack.push(snapshot());restore(undoStack.pop());}
function redo(){if(!redoStack.length)return;undoStack.push(snapshot());restore(redoStack.pop());}
function scheduleSave(){clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>{doc.meta.updatedAt=new Date().toISOString();saveAutosave(snapshot());setStatus('자동 저장됨');},500);}
function commit(mutator,label='변경'){const prev=snapshot();mutator();pushHistory(prev);scheduleSave();render();setStatus(label);}

function setStatus(text){statusEl.textContent=text;}
function toast(message,type='info'){
  const el=document.createElement('div');el.className=`toast toast-${type}`;el.setAttribute('role','status');el.textContent=message;toastRegion.append(el);setTimeout(()=>el.classList.add('show'),10);setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),200)},2600);
}
function updateUndoButtons(){ $('#undo-btn').disabled=!undoStack.length;$('#redo-btn').disabled=!redoStack.length; }

function applyUiTheme(mode=uiPrefs.theme||'system'){
  const resolved=mode==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):mode;
  document.documentElement.dataset.uiTheme=resolved;uiPrefs.theme=mode;saveUiPrefs(uiPrefs);
  $('#ui-theme-btn').dataset.mode=mode;$('#ui-theme-btn').title=`인터페이스 테마: ${mode}`;
}
applyUiTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{if(uiPrefs.theme==='system')applyUiTheme('system');});

function clientToWorld(clientX,clientY){const r=canvas.getBoundingClientRect();return{x:(clientX-r.left-viewport.x)/viewport.scale,y:(clientY-r.top-viewport.y)/viewport.scale};}
function worldToClient(x,y){const r=canvas.getBoundingClientRect();return{x:r.left+viewport.x+x*viewport.scale,y:r.top+viewport.y+y*viewport.scale};}
function viewportCenterWorld(){const r=canvas.getBoundingClientRect();return clientToWorld(r.left+r.width/2,r.top+r.height/2);}
function snap(v){return doc.settings.snap?Math.round(v/doc.settings.gridSize)*doc.settings.gridSize:v;}
function selectedNodes(){return doc.nodes.filter(n=>selection.nodeIds.includes(n.id));}
function selectNode(id,add=false){if(add){selection.nodeIds=selection.nodeIds.includes(id)?selection.nodeIds.filter(x=>x!==id):[...selection.nodeIds,id];}else selection.nodeIds=[id];selection.edgeId=null;render();}
function selectEdge(id){selection={nodeIds:[],edgeId:id};render();}
function clearSelection(){selection={nodeIds:[],edgeId:null};render();}

function smartNodeDefaults(type){
  if(type==='radial-plan')return {label:'',style:{portCount:0},data:{title:'24시간 생활계획',clockMode:24,smallArcLabelMode:'outside',segments:[{label:'수면',start:0,end:7,color:'#6366f1'},{label:'준비/식사',start:7,end:9,color:'#f59e0b'},{label:'일/학교',start:9,end:17,color:'#22c55e'},{label:'운동',start:17,end:19,color:'#06b6d4'},{label:'자유시간',start:19,end:22,color:'#ec4899'},{label:'정리/휴식',start:22,end:24,color:'#8b5cf6'}]}};
  if(type==='brain-map')return {label:'',style:{portCount:0},data:{title:'내 머릿속',silhouette:'profile-left',showPercent:true,autoCallout:true,calloutThreshold:7,regions:[{label:'일 / 공부',percent:35,color:'#c4b5fd'},{label:'가족',percent:20,color:'#93c5fd'},{label:'친구 / 관계',percent:15,color:'#f9a8d4'},{label:'건강',percent:10,color:'#86efac'},{label:'취미',percent:10,color:'#fde68a'},{label:'돈 / 기타',percent:10,color:'#fdba74'}]}};
  if(type==='image')return {label:'',style:{autoTextFit:true},media:{src:'',fit:'cover',opacity:1,showCaption:false,captionBackground:'#00000099',captionColor:'#ffffff'}};
  return {style:{autoTextFit:true}};
}
function addNode(type,point=viewportCenterWorld()){
  const shape=shapeById(type);const extra=smartNodeDefaults(type);const node={id:uid('node'),type,x:snap(point.x-shape.w/2),y:snap(point.y-shape.h/2),w:shape.w,h:shape.h,label:extra.label??shape.label,style:{...(extra.style||{})},...(extra.media?{media:deepClone(extra.media)}:{}),...(extra.data?{data:deepClone(extra.data)}:{})};
  commit(()=>{doc.nodes.push(node);selection={nodeIds:[node.id],edgeId:null};},`${shape.label} 추가`);
}
function addBuiltinIcon(id,point=viewportCenterWorld()){
  const item=iconById(id);const w=Number(item.w)||112,h=Number(item.h)||112;const isBlock=item.mode==='block';
  const node={id:uid('node'),type:'custom-svg',x:snap(point.x-w/2),y:snap(point.y-h/2),w,h,label:isBlock?(item.defaultText||item.label):'',style:{iconColor:doc.tokens.text,padding:isBlock?4:10},customSvg:{viewBox:item.viewBox,content:item.content,name:item.label,origin:item.pack?`catalog:${item.pack}`:'nodeweave-symbols',sourceUrl:item.sourceUrl||'',mode:isBlock?'block':'icon',labelPosition:item.labelPosition||(isBlock?'center':'none')}};
  commit(()=>{doc.nodes.push(node);selection={nodeIds:[node.id],edgeId:null};},`${item.label} SVG 추가`);
}
function moveSelectionZ(mode){
  if(!selection.nodeIds.length)return;commit(()=>{const ids=new Set(selection.nodeIds);const picked=doc.nodes.filter(n=>ids.has(n.id));const rest=doc.nodes.filter(n=>!ids.has(n.id));doc.nodes=mode==='front'?[...rest,...picked]:[...picked,...rest];},mode==='front'?'맨 앞으로':'맨 뒤로');
}
function selectionPayload(){const ids=new Set(selection.nodeIds);return {type:'nodeweave-selection',version:1,nodes:selectedNodes().map(deepClone),edges:doc.edges.filter(e=>ids.has(e.source)&&ids.has(e.target)).map(deepClone)};}
async function copySelection(){
  if(!selection.nodeIds.length)return;internalClipboard=selectionPayload();
  try{await navigator.clipboard?.writeText(JSON.stringify(internalClipboard));}catch{}
  toast(`${selection.nodeIds.length}개 요소를 복사했습니다.`,'success');
}
function pasteSelection(payload=internalClipboard){
  if(!payload?.nodes?.length)return;const prev=snapshot();const map=new Map();const clones=payload.nodes.map(n=>{const id=uid('node');map.set(n.id,id);return normalizeNode({...deepClone(n),id,x:n.x+36,y:n.y+36});});const edges=(payload.edges||[]).filter(e=>map.has(e.source)&&map.has(e.target)).map(e=>normalizeEdge({...deepClone(e),id:uid('edge'),source:map.get(e.source),target:map.get(e.target)}));doc.nodes.push(...clones);doc.edges.push(...edges);selection={nodeIds:clones.map(n=>n.id),edgeId:null};internalClipboard={...deepClone(payload),nodes:clones.map(n=>({...deepClone(n),id:n.id})),edges};pushHistory(prev);scheduleSave();render();toast('복사한 요소를 붙여넣었습니다.','success');
}
function duplicateSelection(){
  const nodes=selectedNodes();if(!nodes.length)return;const prev=snapshot();const map=new Map();const clones=nodes.map(n=>{const id=uid('node');map.set(n.id,id);return{...deepClone(n),id,x:n.x+32,y:n.y+32};});
  const edges=doc.edges.filter(e=>map.has(e.source)&&map.has(e.target)).map(e=>({...deepClone(e),id:uid('edge'),source:map.get(e.source),target:map.get(e.target)}));
  doc.nodes.push(...clones);doc.edges.push(...edges);selection={nodeIds:clones.map(n=>n.id),edgeId:null};pushHistory(prev);scheduleSave();render();toast('선택 요소를 복제했습니다.','success');
}
function deleteSelection(){
  if(!selection.nodeIds.length&&!selection.edgeId)return;
  commit(()=>{if(selection.nodeIds.length){const ids=new Set(selection.nodeIds);doc.nodes=doc.nodes.filter(n=>!ids.has(n.id));doc.edges=doc.edges.filter(e=>!ids.has(e.source)&&!ids.has(e.target));}if(selection.edgeId)doc.edges=doc.edges.filter(e=>e.id!==selection.edgeId);selection={nodeIds:[],edgeId:null};},'삭제');
}
function addEdge(source,sourcePort,target,targetPort){
  if(source===target)return;const exists=doc.edges.some(e=>e.source===source&&e.target===target&&e.sourcePort===sourcePort&&e.targetPort===targetPort);if(exists){toast('같은 연결이 이미 있습니다.');return;}
  commit(()=>doc.edges.push({id:uid('edge'),source,target,sourcePort,targetPort,label:'',routing:doc.settings.routing,style:{}}),'연결선 추가');
}

function edgeMarkup(edge){
  const g=edgeGeometry(edge,doc.nodes);if(!g)return'';const selected=selection.edgeId===edge.id;const stroke=edge.style?.stroke??(selected?doc.tokens.primary:doc.tokens.edge);const width=edge.style?.width??doc.tokens.edgeWidth??1.8;const dash=edge.style?.dash??doc.tokens.edgeDash??'';const arrow=edge.style?.arrow!==false;
  return `<g class="edge-group${selected?' is-selected':''}" data-edge-id="${esc(edge.id)}">
    <path class="edge-hit" d="${g.d}" fill="none" stroke="transparent" stroke-width="16" vector-effect="non-scaling-stroke"/>
    <path class="edge-line" d="${g.d}" fill="none" stroke="${esc(stroke)}" stroke-width="${selected?Math.max(width,2.4):width}" ${dash?`stroke-dasharray="${esc(dash)}"`:''} ${arrow?'marker-end="url(#editor-arrow)"':''} vector-effect="non-scaling-stroke" stroke-linecap="${esc(doc.tokens.edgeLinecap||'round')}" stroke-linejoin="round"/>
    ${edge.label?`<text x="${g.label.x}" y="${g.label.y-8}" fill="${esc(doc.tokens.text)}" font-size="12" font-weight="700" text-anchor="middle" paint-order="stroke" stroke="${esc(doc.tokens.canvas)}" stroke-width="5" stroke-linejoin="round" pointer-events="none">${esc(edge.label)}</text>`:''}
  </g>`;
}
function nodeMarkup(node){
  const selected=selection.nodeIds.includes(node.id);return `<g class="diagram-node${selected?' is-selected':''}" data-node-id="${esc(node.id)}" tabindex="0" role="button" aria-label="${esc(node.label)}">
    ${shapePrimitive(node,doc.tokens)}${nodeTextMarkup(node,doc.tokens,{selected})}
    ${selected?selectionRectMarkup(node,doc.tokens)+portsMarkup(node,doc.tokens):''}
  </g>`;
}
function canvasPatternStyle(tokens,gridSize,showGrid=true){
  const c=tokens.grid||'#dfe3ea',p=tokens.pattern||'grid',sz=Math.max(8,gridSize),accent=tokens.primary||c;
  const line=`linear-gradient(to right,${c} 1px,transparent 1px),linear-gradient(to bottom,${c} 1px,transparent 1px)`;
  if(!showGrid&&['grid','dots','softdots','pixel'].includes(p))return {image:'none',size:'auto'};
  if(p==='none')return {image:'none',size:'auto'};
  if(p==='dots'||p==='softdots')return {image:`radial-gradient(circle,${c} ${p==='dots'?1.2:.8}px,transparent 1.4px)`,size:`${sz}px ${sz}px`};
  if(p==='scanlines')return {image:`repeating-linear-gradient(to bottom,transparent 0,transparent 5px,${c}55 6px),${line}`,size:`100% 6px,${sz}px ${sz}px,${sz}px ${sz}px`};
  if(p==='paper')return {image:`radial-gradient(circle at 20% 30%,${c}55 .7px,transparent .9px),radial-gradient(circle at 70% 60%,${c}44 .6px,transparent .8px)`,size:'18px 18px,23px 23px'};
  if(p==='stripes'||p==='speed')return {image:`repeating-linear-gradient(135deg,transparent 0,transparent ${sz*1.6}px,${c}44 ${sz*1.65}px,${c}44 ${sz*1.75}px)`,size:'auto'};
  if(p==='pixel')return {image:line,size:`${Math.max(10,sz/2)}px ${Math.max(10,sz/2)}px`};
  if(p==='spark'||p==='confetti'||p==='memphis')return {image:`radial-gradient(circle at 18% 24%,${accent}55 0 2px,transparent 3px),radial-gradient(circle at 72% 68%,${tokens.accent||accent}55 0 2px,transparent 3px),linear-gradient(35deg,transparent 48%,${c}33 49% 51%,transparent 52%)`,size:'90px 90px,110px 110px,70px 70px'};
  if(p==='orb'||p==='blob')return {image:`radial-gradient(circle at 12% 18%,${accent}30 0,transparent 26%),radial-gradient(circle at 88% 72%,${tokens.accent||accent}28 0,transparent 28%)`,size:'100% 100%'};
  if(p==='constellation')return {image:`radial-gradient(circle,${accent}66 0 1px,transparent 1.4px),linear-gradient(25deg,transparent 49%,${c}22 50%,transparent 51%)`,size:'46px 46px,120px 120px'};
  if(p==='perspective')return {image:`linear-gradient(${c}55 1px,transparent 1px),linear-gradient(90deg,${c}55 1px,transparent 1px),linear-gradient(to bottom,transparent 55%,${accent}22 100%)`,size:`${sz}px ${sz}px,${sz}px ${sz}px,100% 100%`};
  if(p==='hud')return {image:`linear-gradient(${c}55 1px,transparent 1px),linear-gradient(90deg,${c}55 1px,transparent 1px),radial-gradient(circle at 50% 50%,transparent 0 40%,${accent}12 41%,transparent 42%)`,size:`${sz}px ${sz}px,${sz}px ${sz}px,360px 360px`};
  if(p==='bauhaus')return {image:`radial-gradient(circle at 10% 12%,${accent}25 0 28px,transparent 29px),linear-gradient(45deg,transparent 0 65%,${tokens.accent||accent}1f 66% 76%,transparent 77%)`,size:'220px 220px'};
  if(p==='lines')return {image:`repeating-linear-gradient(to bottom,transparent 0,transparent ${sz*1.4}px,${c}55 ${sz*1.45}px)`,size:'auto'};
  if(p==='frame')return {image:`linear-gradient(90deg,transparent 0 3%,${c}33 3.1%,transparent 3.2% 96.8%,${c}33 96.9%,transparent 97%)`,size:'100% 100%'};
  return {image:line,size:`${sz}px ${sz}px`};
}
function renderCanvas(){
  const gridSize=doc.settings.gridSize*viewport.scale;
  canvas.style.setProperty('--canvas-bg',doc.tokens.canvas);
  canvas.style.setProperty('--grid-color',doc.tokens.grid);
  canvas.style.setProperty('--grid-size',`${Math.max(8,gridSize)}px`);
  const pattern=canvasPatternStyle(doc.tokens,gridSize,doc.settings.grid);canvas.style.backgroundImage=pattern.image;canvas.style.backgroundSize=pattern.size;
  canvas.classList.toggle('grid-off',!doc.settings.grid&&pattern.image==='none');
  const preview=connectPreview?`<path d="M ${connectPreview.start.x} ${connectPreview.start.y} L ${connectPreview.current.x} ${connectPreview.current.y}" fill="none" stroke="${esc(doc.tokens.primary)}" stroke-width="2" stroke-dasharray="6 5" vector-effect="non-scaling-stroke" pointer-events="none"/>`:'';
  const marqueeMarkup=marquee?`<rect x="${Math.min(marquee.start.x,marquee.current.x)}" y="${Math.min(marquee.start.y,marquee.current.y)}" width="${Math.abs(marquee.current.x-marquee.start.x)}" height="${Math.abs(marquee.current.y-marquee.start.y)}" fill="${esc(doc.tokens.primary)}" fill-opacity=".09" stroke="${esc(doc.tokens.primary)}" stroke-width="1.2" stroke-dasharray="5 4" vector-effect="non-scaling-stroke" pointer-events="none"/>`:'';
  viewportEl.setAttribute('transform',`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`);
  viewportEl.innerHTML=`<defs>${diagramStyleDefs(doc.tokens)}<marker id="editor-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth"><path d="M0 0 L10 5 L0 10 z" fill="context-stroke"/></marker></defs>
    <g class="edges-layer">${doc.edges.map(edgeMarkup).join('')}</g><g class="nodes-layer">${doc.nodes.map(nodeMarkup).join('')}</g><g>${preview}${marqueeMarkup}</g>`;
  $('#zoom-readout').textContent=`${Math.round(viewport.scale*100)}%`;
  $('#node-count').textContent=`${doc.nodes.length} 노드 · ${doc.edges.length} 연결`;
  renderMinimap();
}
function renderMinimap(){
  const mm=$('#minimap');const b=nodeBounds(doc.nodes,30);const W=180,H=112;const s=Math.min(W/b.w,H/b.h);const ox=(W-b.w*s)/2-b.x*s,oy=(H-b.h*s)/2-b.y*s;
  mm.innerHTML=`<rect width="180" height="112" rx="10" fill="${esc(doc.tokens.canvas)}"/><g transform="translate(${ox} ${oy}) scale(${s})">${doc.nodes.map(n=>`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="8" fill="${esc(resolveNodeStyle(n,doc.tokens).fill)}" stroke="${esc(doc.tokens.border)}" stroke-width="2" vector-effect="non-scaling-stroke"/>`).join('')}</g>`;
}

function paletteIcon(shape){const n={type:shape.id,x:8,y:8,w:64,h:40,label:'',style:{fill:'var(--panel)',stroke:'currentColor',strokeWidth:1.6,radius:8}};return `<svg viewBox="0 0 80 56" aria-hidden="true">${shapePrimitive(n,{...doc.tokens,surface:'transparent',border:'currentColor',nodeGradient:false,nodeShadow:'none',borderDash:''})}</svg>`;}
function builtinIconPreview(item){return `<svg viewBox="${esc(item.viewBox)}" aria-hidden="true" color="currentColor">${item.content}</svg>`;}
function templateCardMarkup(t,{browser=false}={}){const desc=(t.description||t.keywords||'').split(/\s+/).slice(0,8).join(' ');return `<button class="template-card ${browser?'browser-template-card':''}" data-template-id="${t.id}"><span class="template-category">${esc(t.category)}</span><strong>${esc(t.name)}</strong>${browser?`<p>${esc(desc||'템플릿')}</p>`:''}<small>${t.nodes.length} nodes · ${t.edges.length} edges</small><div class="template-meta"><span class="template-pill">${esc(t.theme||'theme')}</span><span class="template-pill">${esc(t.category)}</span></div>${browser?'<span class="template-action">캔버스로 불러오기</span>':''}</button>`;}
function libraryCollection(tab){return tab==='icons'?BUILTIN_ICONS:tab==='templates'?TEMPLATES:SHAPES;}
function libraryLabel(tab){return tab==='icons'?'SVG 검색 · brain, travel…':tab==='templates'?'템플릿 검색 · 계획표, 로드맵…':'도형 검색 · decision, DB…';}
function matchesLibrary(item,tab,q){const hay=tab==='templates'?`${item.name} ${item.category} ${item.keywords||''} ${item.description||''}`:`${item.label} ${item.category} ${item.keywords||''}`;return !q||hay.toLowerCase().includes(q);}
function libraryItemTitle(item,tab){return tab==='templates'?(item.name||''):(item.label||'');}
function sortLibraryItems(items,tab){const out=[...items];if(librarySort==='name')out.sort((a,b)=>libraryItemTitle(a,tab).localeCompare(libraryItemTitle(b,tab),'ko'));if(librarySort==='category')out.sort((a,b)=>(a.category||'').localeCompare(b.category||'','ko')||libraryItemTitle(a,tab).localeCompare(libraryItemTitle(b,tab),'ko'));return out;}
function filteredLibraryItems(tab=libraryTab,q=paletteQuery,cat=libraryCategory){const qq=q.trim().toLowerCase();return sortLibraryItems(libraryCollection(tab).filter(item=>matchesLibrary(item,tab,qq)&&(!cat||cat==='all'||item.category===cat)),tab);}
function libraryCategories(tab=libraryTab){return [...new Set(libraryCollection(tab).map(item=>item.category))];}
function renderLibraryFilters(targetSelector,tab=libraryTab){const root=$(targetSelector);if(!root)return;const items=libraryCollection(tab);const counts=new Map();items.forEach(item=>counts.set(item.category,(counts.get(item.category)||0)+1));const cats=libraryCategories(tab);root.innerHTML=`<label class="library-category-control"><span>카테고리</span><select data-library-category-select aria-label="카테고리"><option value="all" ${libraryCategory==='all'?'selected':''}>전체 (${items.length})</option>${cats.map(cat=>`<option value="${esc(cat)}" ${libraryCategory===cat?'selected':''}>${esc(cat)} (${counts.get(cat)||0})</option>`).join('')}</select></label>`;}
function resetLibraryScroll(){const scroller=$('#left-panel .panel-scroll');if(scroller)scroller.scrollTop=0;}
function setLibraryTab(tab,{resetQuery=true}={}){libraryTab=tab;libraryCategory='all';if(resetQuery)paletteQuery='';if($('#shape-search'))$('#shape-search').value=paletteQuery;const browserSearch=$('#library-browser-search');if(browserSearch)browserSearch.value=paletteQuery;renderPalette();renderLibraryBrowser();requestAnimationFrame(resetLibraryScroll);}
function setLibraryCategory(cat){libraryCategory=cat||'all';renderPalette();renderLibraryBrowser();requestAnimationFrame(resetLibraryScroll);}
function groupedMarkup(items,cardFn,gridClass){const groups=new Map();items.forEach(item=>{if(!groups.has(item.category))groups.set(item.category,[]);groups.get(item.category).push(item);});return [...groups].map(([cat,groupItems])=>`<section class="palette-group browser-group"><div class="browser-group-header"><h3>${esc(cat)}</h3><span>${groupItems.length}개</span></div><div class="${gridClass}">${groupItems.map(cardFn).join('')}</div></section>`).join('');}
function renderPalette(){
  const shapes=filteredLibraryItems('shapes');
  const icons=filteredLibraryItems('icons');
  const templates=filteredLibraryItems('templates');
  $('#shape-list').innerHTML=shapes.length?groupedMarkup(shapes,s=>`<button class="shape-card" draggable="true" data-shape-id="${s.id}" title="${esc(s.label)} 추가">${paletteIcon(s)}<span>${esc(s.label)}</span></button>`,'shape-grid'):`<div class="empty-state"><strong>도형을 찾지 못했습니다.</strong><span>다른 검색어나 카테고리를 선택해 보세요.</span></div>`;
  $('#icon-list').innerHTML=icons.length?groupedMarkup(icons,i=>`<button class="svg-icon-card" draggable="true" data-icon-id="${i.id}" title="${esc(i.label)} SVG 추가">${builtinIconPreview(i)}<span>${esc(i.label)}</span></button>`,'icon-grid'):`<div class="empty-state"><strong>SVG 심볼을 찾지 못했습니다.</strong><span>다른 검색어나 카테고리를 선택해 보세요.</span></div>`;
  $('#template-list').innerHTML=templates.length?templates.map(t=>templateCardMarkup(t)).join(''):`<div class="empty-state"><strong>템플릿을 찾지 못했습니다.</strong><span>다른 검색어나 카테고리를 선택해 보세요.</span></div>`;
  $('#shape-section').hidden=libraryTab!=='shapes';$('#icon-section').hidden=libraryTab!=='icons';$('#template-section').hidden=libraryTab!=='templates';
  $$('.library-tab').forEach(b=>b.classList.toggle('is-active',b.dataset.libraryTab===libraryTab));
  $('#shape-total').textContent=SHAPES.length;$('#icon-total').textContent=BUILTIN_ICONS.length;$('#template-total').textContent=TEMPLATES.length;
  const search=$('#shape-search');if(search)search.placeholder=libraryLabel(libraryTab);
  const sort=$('#library-sort');if(sort)sort.value=librarySort;
  const view=$('#library-view-toggle');if(view){view.dataset.view=libraryView;view.textContent=libraryView==='grid'?'▦ 격자':'☷ 목록';}
  const left=$('#left-panel');if(left)left.dataset.libraryView=libraryView;
  renderLibraryFilters('#library-filters',libraryTab);
}
function renderLibraryBrowser(){
  const content=$('#library-browser-content');if(!content)return;
  const items=filteredLibraryItems(libraryTab);
  $$('.browser-library-tabs .library-tab').forEach(b=>b.classList.toggle('is-active',b.dataset.libraryTab===libraryTab));
  $('#browser-shape-total').textContent=SHAPES.length;$('#browser-icon-total').textContent=BUILTIN_ICONS.length;$('#browser-template-total').textContent=TEMPLATES.length;
  const search=$('#library-browser-search');if(search)search.placeholder=libraryLabel(libraryTab);
  renderLibraryFilters('#browser-category-filters',libraryTab);
  if(!items.length){content.innerHTML=`<div class="empty-state"><strong>검색 결과가 없습니다.</strong><span>카테고리나 키워드를 바꿔 보세요.</span></div>`;return;}
  if(libraryTab==='shapes')content.innerHTML=groupedMarkup(items,s=>`<button class="shape-card browser-shape-card" draggable="true" data-shape-id="${s.id}" title="${esc(s.label)} 추가">${paletteIcon(s)}<span>${esc(s.label)}</span></button>`,'browser-shape-grid');
  else if(libraryTab==='icons')content.innerHTML=groupedMarkup(items,i=>`<button class="svg-icon-card browser-icon-card" draggable="true" data-icon-id="${i.id}" title="${esc(i.label)} SVG 추가">${builtinIconPreview(i)}<span>${esc(i.label)}</span></button>`,'browser-icon-grid');
  else content.innerHTML=`<section class="browser-group"><div class="browser-group-header"><h3>${libraryCategory==='all'?'전체 템플릿':esc(libraryCategory)}</h3><span>${items.length}개</span></div><div class="browser-template-grid">${items.map(t=>templateCardMarkup(t,{browser:true})).join('')}</div></section>`;
}
function openLibraryBrowser(tab=libraryTab){libraryTab=tab;renderPalette();renderLibraryBrowser();openDialog('#library-browser-dialog');setTimeout(()=>$('#library-browser-search')?.focus(),0);}
function autosizeNodeForText(node){if(!node||!node.label||['radial-plan','brain-map','image','custom-svg'].includes(node.type))return;const fs=Number(node.style?.fontSize)||15;const raw=String(node.label);const longest=Math.max(...raw.split(/\s+/).map(x=>x.length),4);const chars=Math.max(longest,Math.min(32,Math.ceil(Math.sqrt(raw.length*18))));node.w=Math.max(node.w,clamp(chars*fs*.58+34,120,420));const per=Math.max(5,Math.floor((node.w-28)/(fs*.57)));const lines=Math.max(1,Math.ceil(raw.length/per));node.h=Math.max(node.h,clamp(lines*fs*1.35+30,54,260));}
function cleanImageSource(value=''){const v=String(value||'').trim();return /^(data:image\/(?:png|jpeg|jpg|webp|gif|svg\+xml);base64,|https?:\/\/)/i.test(v)?v:'';}
async function readImageFile(file){if(!file)return'';if(!file.type.startsWith('image/'))throw new Error('이미지 파일을 선택하세요.');if(file.size>4*1024*1024)throw new Error('이미지는 4MB 이하를 권장합니다.');return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(new Error('이미지를 읽지 못했습니다.'));reader.readAsDataURL(file);});}
async function createShareLink(){const payload=await encodeShareDocument(snapshot());const url=`${location.origin}${location.pathname}#share=${payload}`;$('#share-url').value=url;$('#share-size').textContent=`링크 데이터 ${Math.round(url.length/1024*10)/10}KB · 서버 업로드 없이 URL 안에 저장`;openDialog('#share-dialog');return url;}
function copyShareLink(){const value=$('#share-url').value;navigator.clipboard?.writeText(value).then(()=>toast('공유 링크를 복사했습니다.','success')).catch(()=>{$('#share-url').select();document.execCommand('copy');toast('공유 링크를 복사했습니다.','success');});}

function inspectorSelectionHtml(){
  const nodes=selectedNodes();const edge=doc.edges.find(e=>e.id===selection.edgeId);
  if(!nodes.length&&!edge)return `<div class="inspector-empty"><div class="empty-icon">⌁</div><strong>요소를 선택하세요</strong><p>노드나 연결선을 선택하면 크기, 색상, 텍스트, 라우팅을 편집할 수 있습니다.</p><kbd>Ctrl/⌘ K</kbd><span>빠른 검색</span></div>`;
  if(edge){const stroke=edge.style?.stroke??doc.tokens.edge;const width=edge.style?.width??1.8;return `<div class="form-stack"><label>연결선 라벨<input data-edge-prop="label" value="${esc(edge.label)}" placeholder="예: 승인, API"></label><label>라우팅<select data-edge-prop="routing"><option value="orthogonal" ${edge.routing==='orthogonal'?'selected':''}>직각</option><option value="bezier" ${edge.routing==='bezier'?'selected':''}>곡선</option><option value="straight" ${edge.routing==='straight'?'selected':''}>직선</option></select></label><div class="field-row"><label>선 색상<input type="color" data-edge-prop="stroke" value="${stroke.startsWith('#')?stroke:'#64748b'}"></label><label>두께<input type="number" min="1" max="8" step="0.2" data-edge-prop="width" value="${width}"></label></div><label>선 스타일<select data-edge-prop="dash"><option value="" ${(edge.style?.dash??'')===''?'selected':''}>실선</option><option value="7 5" ${edge.style?.dash==='7 5'?'selected':''}>점선</option><option value="2 5" ${edge.style?.dash==='2 5'?'selected':''}>도트</option></select></label><label class="switch-row"><span>화살표</span><input type="checkbox" data-edge-prop="arrow" ${edge.style?.arrow!==false?'checked':''}></label><button class="danger-btn" data-action="delete-selection">연결선 삭제</button></div>`;}
  const first=nodes[0], style=resolveNodeStyle(first,doc.tokens), mixed=nodes.length>1;
  if(!mixed&&first.type==='radial-plan'){
    const data=first.data||{},total=Number(data.clockMode)===12?12:24,segs=Array.isArray(data.segments)?data.segments:[];const assigned=segs.reduce((sum,seg)=>{let a=Number(seg.start)||0,b=Number(seg.end)||0;let d=(b-a+total)%total;if(d===0&&String(seg.start)!==String(seg.end))d=total;return sum+d;},0);
    return `<div class="selection-summary"><strong>원형 생활계획표</strong><span>구간을 추가·삭제·재정렬하고 시간을 입력하면 원 비율이 즉시 바뀝니다.</span></div><div class="form-stack smart-editor"><div class="field-row"><label>시계 방식<select data-smart-prop="clockMode"><option value="24" ${total===24?'selected':''}>24시간</option><option value="12" ${total===12?'selected':''}>12시간</option></select></label><label>배정 시간<input value="${Math.round(assigned*10)/10}/${total}h" disabled></label></div><label>가운데 제목<input data-smart-prop="title" value="${esc(data.title||'생활계획')}"></label><label>작은 시간 구간 라벨<select data-smart-prop="smallArcLabelMode"><option value="outside" ${(data.smallArcLabelMode||'outside')==='outside'?'selected':''}>밖으로 빼서 지시선</option><option value="inside" ${data.smallArcLabelMode==='inside'?'selected':''}>가능하면 내부 표시</option><option value="hide" ${data.smallArcLabelMode==='hide'?'selected':''}>숨김</option></select></label><div class="smart-section-head"><h3>시간 구간 <span>${segs.length}개</span></h3><button data-action="plan-sort" class="mini-action">시간순 정렬</button></div><div class="smart-rows">${segs.map((seg,i)=>`<div class="smart-row plan-row" data-plan-index="${i}"><input data-plan-field="color" type="color" value="${esc(seg.color||'#6366f1')}"><input data-plan-field="label" value="${esc(seg.label||'활동')}" aria-label="활동"><input data-plan-field="start" type="number" min="0" max="${total}" step="0.5" value="${seg.start}"><span>→</span><input data-plan-field="end" type="number" min="0" max="${total}" step="0.5" value="${seg.end}"><div class="smart-row-actions"><button data-action="plan-up" data-plan-index="${i}" title="위로">↑</button><button data-action="plan-down" data-plan-index="${i}" title="아래로">↓</button><button data-action="plan-delete" data-plan-index="${i}" title="구간 삭제">×</button></div></div>`).join('')}</div><button data-action="plan-add">＋ 시간 구간 추가</button><div class="field-row"><label>너비<input type="number" data-node-field="w" min="300" max="1000" value="${Math.round(first.w)}"></label><label>높이<input type="number" data-node-field="h" min="300" max="1000" value="${Math.round(first.h)}"></label></div><small class="inspector-help">항목 순서는 자유롭게 바꿀 수 있습니다. 종료 시간이 시작보다 작으면 자정을 넘어가는 구간으로 계산합니다.</small></div>`;
  }
  if(!mixed&&first.type==='brain-map'){
    const data=first.data||{},regions=Array.isArray(data.regions)?data.regions:[];const total=regions.reduce((sum,r)=>sum+(Number(r.percent)||0),0);const silhouette=data.silhouette||'profile-left';const showPercent=data.showPercent!==false;
    return `<div class="selection-summary"><strong>머릿속 생각 지도</strong><span>영역 개수와 순서, 비율, 얼굴 형태를 자유롭게 바꿀 수 있습니다.</span></div><div class="form-stack smart-editor"><label>제목<input data-smart-prop="title" value="${esc(data.title||'내 머릿속')}"></label><div class="field-row"><label>외곽 형태<select data-smart-prop="silhouette"><option value="profile-left" ${silhouette==='profile-left'?'selected':''}>사람 옆모습 · 왼쪽</option><option value="profile-right" ${silhouette==='profile-right'?'selected':''}>사람 옆모습 · 오른쪽</option><option value="head" ${silhouette==='head'?'selected':''}>심플 두상</option><option value="brain" ${silhouette==='brain'?'selected':''}>뇌 / 생각 구름</option></select></label><label class="switch-row"><span>% 표시</span><input data-smart-prop="showPercent" type="checkbox" ${showPercent?'checked':''}></label></div><div class="field-row"><label class="switch-row"><span>작은 생각 자동 콜아웃</span><input data-smart-prop="autoCallout" type="checkbox" ${data.autoCallout!==false?'checked':''}></label><label>콜아웃 기준 %<input data-smart-prop="calloutThreshold" type="number" min="1" max="20" step="1" value="${Number(data.calloutThreshold??7)}"></label></div><div class="smart-total ${total===100?'is-ok':'is-warn'}">합계 <strong>${total}%</strong> ${total===100?'✓':'· 필요하면 100% 맞춤을 누르세요'}</div><div class="smart-section-head"><h3>생각 영역 <span>${regions.length}개</span></h3><button data-action="brain-normalize" class="mini-action">100% 맞춤</button></div><div class="smart-rows">${regions.map((r,i)=>`<div class="smart-row brain-row" data-brain-index="${i}"><input type="color" data-brain-field="color" value="${esc(r.color||'#c4b5fd')}"><input data-brain-field="label" value="${esc(r.label||`생각 ${i+1}`)}"><input type="number" data-brain-field="percent" min="0" max="100" step="1" value="${Number(r.percent)||0}"><span>%</span><select class="brain-display" data-brain-field="display" title="표시 방식"><option value="auto" ${(r.display||'auto')==='auto'?'selected':''}>자동</option><option value="inside" ${r.display==='inside'?'selected':''}>내부</option><option value="callout" ${r.display==='callout'?'selected':''}>지시선</option></select><div class="smart-row-actions"><button data-action="brain-up" data-brain-index="${i}" title="위로">↑</button><button data-action="brain-down" data-brain-index="${i}" title="아래로">↓</button><button data-action="brain-delete" data-brain-index="${i}" title="영역 삭제">×</button></div></div>`).join('')}</div><button data-action="brain-add" ${regions.length>=12?'disabled':''}>＋ 생각 영역 추가</button><small class="inspector-help">2~12개 영역을 사용할 수 있습니다. 비율에 따라 실제 영역 크기가 달라지고, 작은 생각은 자동으로 바깥 지시선 라벨로 전환할 수 있습니다.</small><div class="field-row"><label>너비<input type="number" data-node-field="w" min="480" max="1200" value="${Math.round(first.w)}"></label><label>높이<input type="number" data-node-field="h" min="420" max="1000" value="${Math.round(first.h)}"></label></div></div>`;
  }
  if(!mixed&&first.type==='image'){
    const media=first.media||{};return `<div class="selection-summary"><strong>이미지</strong><span>파일을 넣고 crop/fit과 캡션을 조정합니다.</span></div><div class="form-stack image-inspector"><div class="image-preview">${media.src?`<img src="${esc(media.src)}" alt="">`:'<span>이미지를 선택하세요</span>'}</div><label class="file-btn inspector-file">이미지 파일 선택<input type="file" data-image-upload accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden></label><label>이미지 URL<input data-image-url type="url" value="${/^https?:/i.test(media.src||'')?esc(media.src):''}" placeholder="https://…"></label><div class="field-row"><label>맞춤<select data-image-prop="fit"><option value="cover" ${media.fit==='cover'?'selected':''}>영역 채우기 / Crop</option><option value="contain" ${media.fit==='contain'?'selected':''}>전체 보이기</option><option value="stretch" ${media.fit==='stretch'?'selected':''}>늘려 맞추기</option></select></label><label>투명도<input data-image-prop="opacity" type="number" min="0.1" max="1" step="0.1" value="${Number(media.opacity??1)}"></label></div><label class="switch-row"><span>캡션 표시</span><input data-image-prop="showCaption" type="checkbox" ${media.showCaption?'checked':''}></label>${media.showCaption?`<label>캡션<input data-node-prop="label" value="${esc(first.label||'')}"></label>`:''}<div class="field-row"><label>너비<input type="number" data-node-field="w" min="80" max="1400" value="${Math.round(first.w)}"></label><label>높이<input type="number" data-node-field="h" min="60" max="1000" value="${Math.round(first.h)}"></label></div><div class="button-row"><button data-action="image-remove">이미지 제거</button><button data-action="duplicate">복제</button><button class="danger-btn" data-action="delete-selection">삭제</button></div></div>`;
  }
  if(!mixed&&first.type==='custom-svg'){
    const iconColor=first.style?.iconColor??doc.tokens.text;
    const accentColor=first.style?.accentColor??doc.tokens.primary;
    const iconBg=first.style?.iconBackground??'#ffffff';
    const meta=first.customSvg||{};
    const effect=first.style?.svgEffect||'none';
    const fit=first.style?.svgFit||'contain';
    const paintMode=first.style?.svgPaintMode||'original';
    const svgStrokeWidth=Number(first.style?.svgStrokeWidth)||1.8;
    const slots=(meta.paintSlots||[]).filter(v=>/^#[0-9a-f]{6}$/i.test(v)).slice(0,6);
    const overrides=meta.paintOverrides||{};
    const source=meta.sourceUrl?`<a class="source-link" href="${esc(meta.sourceUrl)}" target="_blank" rel="noopener noreferrer">원본 SVG 출처 ↗</a>`:'';
    const palette=slots.length?`<div class="svg-palette"><strong>원본 색상 슬롯</strong><div class="svg-palette-grid">${slots.map((color,i)=>`<label><span>${i+1}</span><input type="color" data-svg-paint="${esc(color)}" value="${esc(overrides[color]||color)}"></label>`).join('')}</div><small>SVG 안의 고정 HEX 색상을 비파괴 방식으로 바꿉니다.</small></div>`:'';
    return `<div class="selection-summary"><strong>${esc(meta.name||'SVG 자산')}</strong><span>${meta.origin?.startsWith('catalog:')?'JSON 카탈로그 SVG':meta.origin==='nodeweave-symbols'?'NodeWeave 기본 SVG 심볼':'가져온 SVG 자산'}</span></div>
    <div class="form-stack svg-inspector">
      <div class="field-row"><label>사용 방식<select data-svg-prop="mode"><option value="icon" ${meta.mode!=='block'?'selected':''}>그림만</option><option value="block" ${meta.mode==='block'?'selected':''}>텍스트 포함 블록</option></select></label><label>텍스트 위치<select data-svg-prop="labelPosition" ${meta.mode!=='block'?'disabled':''}><option value="center" ${meta.labelPosition==='center'?'selected':''}>가운데</option><option value="top" ${meta.labelPosition==='top'?'selected':''}>위</option><option value="bottom" ${meta.labelPosition==='bottom'?'selected':''}>아래</option><option value="none" ${meta.labelPosition==='none'?'selected':''}>숨김</option></select></label></div>
      ${meta.mode==='block'?`<label>블록 텍스트<textarea data-node-prop="label" rows="2">${esc(first.label)}</textarea></label><label class="switch-row"><span>텍스트 자동 축소</span><input type="checkbox" data-node-prop="autoTextFit" ${first.style?.autoTextFit!==false?'checked':''}></label>`:''}
      <section class="svg-effect-panel"><h3>SVG 색상 · 외곽선 · 효과</h3><div class="field-row"><label>주 색상<input type="color" data-node-prop="iconColor" value="${iconColor.startsWith('#')?iconColor:'#172033'}"></label><label>효과 색상<input type="color" data-node-prop="accentColor" value="${accentColor.startsWith('#')?accentColor:'#5b5cf0'}"></label></div>
      <div class="field-row"><label>표현 방식<select data-node-prop="svgPaintMode"><option value="original" ${paintMode==='original'?'selected':''}>원본 색상</option><option value="monochrome" ${paintMode==='monochrome'?'selected':''}>단색</option><option value="outline" ${paintMode==='outline'?'selected':''}>외곽선만</option><option value="fill" ${paintMode==='fill'?'selected':''}>채우기만</option><option value="hybrid" ${paintMode==='hybrid'?'selected':''}>옅은 채움 + 외곽선</option></select></label><label>외곽선 두께<input type="number" min="0.4" max="8" step="0.2" data-node-prop="svgStrokeWidth" value="${svgStrokeWidth}"></label></div>
      <label>시각 효과<select data-node-prop="svgEffect"><option value="none" ${effect==='none'?'selected':''}>원본</option><option value="tint" ${effect==='tint'?'selected':''}>단색 틴트</option><option value="shadow" ${effect==='shadow'?'selected':''}>소프트 그림자</option><option value="sticker" ${effect==='sticker'?'selected':''}>스티커 외곽선</option><option value="glow" ${effect==='glow'?'selected':''}>글로우</option><option value="badge" ${effect==='badge'?'selected':''}>컬러 배지</option></select></label>
      <div class="field-row"><label>맞춤<select data-node-prop="svgFit"><option value="contain" ${fit==='contain'?'selected':''}>비율 유지</option><option value="cover" ${fit==='cover'?'selected':''}>영역 채우기</option><option value="stretch" ${fit==='stretch'?'selected':''}>늘이기</option></select></label><label class="switch-row"><span>원본 비율 잠금</span><input type="checkbox" data-node-prop="lockAspect" ${first.style?.lockAspect!==false?'checked':''}></label></div>
      <div class="field-row"><label>배경 색상<input type="color" data-node-prop="iconBackground" value="${iconBg.startsWith('#')?iconBg:'#ffffff'}"></label><label>내부 여백<input type="number" min="0" max="40" step="1" data-node-prop="padding" value="${Number(first.style?.padding)||0}"></label></div></section>
      ${palette}
      <div class="field-row"><label>회전<input type="number" min="-360" max="360" step="15" data-node-prop="rotation" value="${Number(first.style?.rotation)||0}"></label><label>현재 비율<input readonly value="${customSvgAspectRatio(first).toFixed(2)} : 1"></label></div>
      <div class="field-row"><label>너비<input type="number" min="32" max="1200" step="1" data-node-field="w" value="${Math.round(first.w)}"></label><label>높이<input type="number" min="32" max="800" step="1" data-node-field="h" value="${Math.round(first.h)}"></label></div>
      <div class="field-row"><label>연결 포인트<select data-node-prop="portCount"><option value="0" ${(first.style?.portCount??0)===0?'selected':''}>없음</option><option value="4" ${(first.style?.portCount??0)===4?'selected':''}>4면</option><option value="8" ${(first.style?.portCount??0)===8?'selected':''}>8개</option></select></label><label>포트 모양<select data-node-prop="portShape"><option value="circle" ${(first.style?.portShape??doc.tokens.portShape)==='circle'?'selected':''}>원형</option><option value="square" ${(first.style?.portShape??doc.tokens.portShape)==='square'?'selected':''}>사각</option><option value="diamond" ${(first.style?.portShape??doc.tokens.portShape)==='diamond'?'selected':''}>다이아</option></select></label></div>
      <div class="button-grid"><button data-action="fit-svg-ratio">원본 비율 맞춤</button><button data-action="flip-x">좌우 반전</button><button data-action="flip-y">상하 반전</button><button data-action="clear-icon-background">배경 없음</button><button data-action="normalize-svg-color">고정색 → 단색화</button><button data-action="reset-svg-palette">색상 슬롯 초기화</button><button data-action="bring-front">맨 앞으로</button><button data-action="send-back">맨 뒤로</button></div>
      ${source}<div class="button-row"><button data-action="duplicate">복제</button><button data-action="copy-selection">복사</button><button class="danger-btn" data-action="delete-selection">삭제</button></div>
    </div>`;
  }
  return `<div class="selection-summary"><strong>${mixed?`${nodes.length}개 노드 선택`:esc(first.label)}</strong><span>${mixed?'여러 요소에 같은 값을 일괄 적용합니다.':esc(shapeById(first.type).label)}</span></div><div class="form-stack">
    ${!mixed?`<label>텍스트<textarea data-node-prop="label" rows="3">${esc(first.label)}</textarea></label>`:''}
    <div class="field-row"><label>채우기<input type="color" data-node-prop="fill" value="${style.fill.startsWith('#')?style.fill:'#ffffff'}"></label><label>테두리<input type="color" data-node-prop="stroke" value="${style.stroke.startsWith('#')?style.stroke:'#64748b'}"></label></div>
    <div class="field-row"><label>텍스트<input type="color" data-node-prop="text" value="${style.text.startsWith('#')?style.text:'#111827'}"></label><label>선 두께<input type="number" min="0.5" max="8" step="0.1" data-node-prop="strokeWidth" value="${style.strokeWidth}"></label></div>
    <div class="field-row"><label>글자 크기<input type="number" min="9" max="48" step="1" data-node-prop="fontSize" value="${style.fontSize}"></label><label>모서리<input type="number" min="0" max="64" step="1" data-node-prop="radius" value="${style.radius}"></label></div>
    ${!mixed?`<div class="field-row"><label>너비<input type="number" min="48" max="1200" step="1" data-node-field="w" value="${Math.round(first.w)}"></label><label>높이<input type="number" min="40" max="800" step="1" data-node-field="h" value="${Math.round(first.h)}"></label></div>`:''}
    ${!mixed?`<div class="field-row"><label class="switch-row"><span>텍스트 자동 축소</span><input type="checkbox" data-node-prop="autoTextFit" ${first.style?.autoTextFit!==false?'checked':''}></label><label class="switch-row"><span>텍스트에 맞춰 크기</span><input type="checkbox" data-node-prop="autoSize" ${first.style?.autoSize?'checked':''}></label></div>`:''}
    ${!mixed?`<div class="field-row"><label>연결 포인트<select data-node-prop="portCount"><option value="0" ${(first.style?.portCount??doc.tokens.portCount)===0?'selected':''}>없음</option><option value="4" ${(first.style?.portCount??doc.tokens.portCount)===4?'selected':''}>4면</option><option value="8" ${(first.style?.portCount??doc.tokens.portCount)===8?'selected':''}>8개</option></select></label><label>포트 모양<select data-node-prop="portShape"><option value="circle" ${(first.style?.portShape??doc.tokens.portShape)==='circle'?'selected':''}>원형</option><option value="square" ${(first.style?.portShape??doc.tokens.portShape)==='square'?'selected':''}>사각</option><option value="diamond" ${(first.style?.portShape??doc.tokens.portShape)==='diamond'?'selected':''}>다이아</option></select></label></div>`:''}
    <div class="button-grid"><button data-action="reset-node-style">테마값 복원</button><button data-action="duplicate">복제</button><button data-action="copy-selection">복사</button><button data-action="bring-front">맨 앞으로</button><button data-action="send-back">맨 뒤로</button><button class="danger-btn" data-action="delete-selection">삭제</button></div></div>`;
}
function inspectorThemeHtml(){
  const groups=new Map();THEMES.forEach(t=>{const cat=t.category||'Built-in';if(!groups.has(cat))groups.set(cat,[]);groups.get(cat).push(t);});
  const cards=[...groups].map(([cat,items])=>`<section class="style-pack-group"><div class="style-pack-head"><strong>${esc(cat)}</strong><span>${items.length}</span></div><div class="theme-grid">${items.map(t=>{const tok=t.tokens||{};const shadow=tok.nodeShadow==='hard'?`${tok.shadowX||5}px ${tok.shadowY||5}px 0 ${tok.shadowColor||tok.border}`:tok.nodeShadow==='none'?'none':`0 5px ${Math.max(6,tok.shadowBlur||10)}px ${tok.shadowColor||'#0002'}`;return `<button class="theme-card ${doc.themeId===t.id?'is-active':''}" data-theme-id="${t.id}"><span class="style-preview" style="background:${tok.canvas};background-image:${(tok.pattern==='dots'||tok.pattern==='softdots')?`radial-gradient(circle,${tok.grid} 1px,transparent 1.5px)`:'none'}"><i style="background:${tok.nodeGradient?`linear-gradient(135deg,${tok.gradientStart},${tok.gradientEnd})`:tok.surface};border:${tok.nodeStrokeWidth||1.5}px solid ${tok.border};border-radius:${tok.radius||0}px;box-shadow:${shadow}"></i><b style="background:${tok.primary}"></b></span><strong>${esc(t.label)}</strong><small>${esc(t.description)}</small></button>`;}).join('')}</div></section>`).join('');
  return `<div class="style-summary"><strong>${THEMES.length} styles</strong><span>색상뿐 아니라 표면·그림자·패턴·타이포·연결선·포트까지 함께 변경합니다.</span></div>${cards}<div class="form-stack token-editor"><h3>세부 토큰</h3><div class="field-row"><label>캔버스<input type="color" data-token="canvas" value="${doc.tokens.canvas}"></label><label>표면<input type="color" data-token="surface" value="${/^#[0-9a-f]{6}$/i.test(doc.tokens.surface)?doc.tokens.surface:'#ffffff'}"></label></div><div class="field-row"><label>주요색<input type="color" data-token="primary" value="${doc.tokens.primary}"></label><label>텍스트<input type="color" data-token="text" value="${doc.tokens.text}"></label></div><div class="field-row"><label>경계<input type="color" data-token="border" value="${/^#[0-9a-f]{6}$/i.test(doc.tokens.border)?doc.tokens.border:'#64748b'}"></label><label>연결선<input type="color" data-token="edge" value="${doc.tokens.edge}"></label></div><label>기본 모서리<input type="range" min="0" max="40" step="1" data-token="radius" value="${doc.tokens.radius}"><output>${doc.tokens.radius}px</output></label><label>기본 연결 포인트<select data-token="portCount"><option value="0" ${doc.tokens.portCount===0?'selected':''}>없음</option><option value="4" ${doc.tokens.portCount===4?'selected':''}>4면</option><option value="8" ${doc.tokens.portCount===8?'selected':''}>8개</option></select></label></div>`;
}
function inspectorLayoutHtml(){return `<div class="form-stack"><h3>자동 레이아웃</h3><label>배치 범위<select id="layout-scope"><option value="flow" ${(doc.settings.layoutScope||'flow')==='flow'?'selected':''}>연결된 흐름만</option><option value="selection" ${doc.settings.layoutScope==='selection'?'selected':''}>현재 선택 요소</option><option value="all" ${doc.settings.layoutScope==='all'?'selected':''}>모든 일반 노드</option></select></label><label>방향<select id="layout-direction"><option value="LR" ${doc.settings.layoutDirection==='LR'?'selected':''}>왼쪽 → 오른쪽</option><option value="TB" ${doc.settings.layoutDirection==='TB'?'selected':''}>위 → 아래</option></select></label><div class="field-row"><label>가로 간격<input id="layout-hgap" type="number" min="24" max="320" value="${doc.settings.horizontalGap}"></label><label>세로 간격<input id="layout-vgap" type="number" min="20" max="240" value="${doc.settings.verticalGap}"></label></div><button class="primary-btn" data-action="auto-layout">선택 범위 자동 배치</button><small class="inspector-help">기본값은 연결선이 있는 흐름만 정리합니다. 머릿속 지도·생활계획표·이미지처럼 독립 배치한 요소는 건드리지 않습니다.</small><h3>선택 요소 정렬</h3><div class="button-grid layout-align-grid"><button data-align="left">왼쪽</button><button data-align="center-x">가운데 X</button><button data-align="right">오른쪽</button><button data-align="top">위쪽</button><button data-align="center-y">가운데 Y</button><button data-align="bottom">아래쪽</button><button data-align="distribute-x">가로 간격</button><button data-align="distribute-y">세로 간격</button></div><h3>화면 맞춤</h3><div class="button-grid"><button data-action="fit-selection">선택 맞춤</button><button data-action="fit-all">전체 맞춤</button></div><h3>캔버스</h3><label class="switch-row"><span>그리드 표시</span><input type="checkbox" data-setting="grid" ${doc.settings.grid?'checked':''}></label><label class="switch-row"><span>그리드 스냅</span><input type="checkbox" data-setting="snap" ${doc.settings.snap?'checked':''}></label><label>그리드 간격<input type="number" min="8" max="80" step="2" data-setting="gridSize" value="${doc.settings.gridSize}"></label></div>`;}
function renderInspector(){
  $$('.inspector-tab').forEach(b=>b.classList.toggle('is-active',b.dataset.tab===inspectorTab));
  $('#inspector-content').innerHTML=inspectorTab==='theme'?inspectorThemeHtml():inspectorTab==='layout'?inspectorLayoutHtml():inspectorSelectionHtml();
}
function render(){renderCanvas();renderPalette();renderLibraryBrowser();renderInspector();$('#project-name').value=doc.meta.name;updateUndoButtons();updatePanelState();}

function updatePanelState(){document.body.classList.toggle('left-closed',!leftOpen);document.body.classList.toggle('right-closed',!rightOpen);}
function zoomAt(factor,clientX,clientY){const before=clientToWorld(clientX,clientY);viewport.scale=clamp(viewport.scale*factor,.2,3.5);const r=canvas.getBoundingClientRect();viewport.x=clientX-r.left-before.x*viewport.scale;viewport.y=clientY-r.top-before.y*viewport.scale;renderCanvas();}
function zoomCenter(factor){const r=canvas.getBoundingClientRect();zoomAt(factor,r.left+r.width/2,r.top+r.height/2);}
function fitNodes(nodes,pad=70){if(!nodes?.length)return;const b=nodeBounds(nodes,pad);const r=canvas.getBoundingClientRect();if(!r.width||!r.height||!b.w||!b.h)return;const scale=clamp(Math.min(r.width/b.w,r.height/b.h),.2,1.5);viewport.scale=scale;viewport.x=(r.width-b.w*scale)/2-b.x*scale;viewport.y=(r.height-b.h*scale)/2-b.y*scale;renderCanvas();}
function fitView(){fitNodes(doc.nodes,70);}
function fitSelection(){const nodes=selectedNodes();if(!nodes.length){toast('맞출 요소를 먼저 선택하세요.');return;}fitNodes(nodes,60);}

function autoLayout(){
  const prev=snapshot();const dir=$('#layout-direction')?.value||doc.settings.layoutDirection;const hGap=Number($('#layout-hgap')?.value)||doc.settings.horizontalGap;const vGap=Number($('#layout-vgap')?.value)||doc.settings.verticalGap;const scope=$('#layout-scope')?.value||doc.settings.layoutScope||'flow';
  doc.settings.layoutDirection=dir;doc.settings.horizontalGap=hGap;doc.settings.verticalGap=vGap;doc.settings.layoutScope=scope;
  const base=doc.nodes.filter(n=>!['group','swimlane'].includes(n.type));
  const linkedIds=new Set(doc.edges.flatMap(e=>[e.source,e.target]));
  let nodes=scope==='selection'?base.filter(n=>selection.nodeIds.includes(n.id)):scope==='all'?base:base.filter(n=>linkedIds.has(n.id));
  if(scope==='selection'&&nodes.length<2){toast('자동 배치할 요소를 두 개 이상 선택하세요.');return;}
  if(!nodes.length){toast('자동 배치할 연결 흐름이 없습니다.');return;}
  const ids=new Set(nodes.map(n=>n.id)),indeg=new Map(nodes.map(n=>[n.id,0])),adj=new Map(nodes.map(n=>[n.id,[]]));
  doc.edges.forEach(e=>{if(ids.has(e.source)&&ids.has(e.target)){adj.get(e.source).push(e.target);indeg.set(e.target,(indeg.get(e.target)||0)+1);}});
  const q=nodes.filter(n=>indeg.get(n.id)===0).map(n=>n.id);if(!q.length)q.push(nodes[0].id);const rank=new Map(q.map(id=>[id,0]));const seen=new Set();
  while(q.length){const id=q.shift();if(seen.has(id))continue;seen.add(id);for(const t of adj.get(id)||[]){rank.set(t,Math.max(rank.get(t)||0,(rank.get(id)||0)+1));indeg.set(t,indeg.get(t)-1);if(indeg.get(t)<=0&&!seen.has(t))q.push(t);}}
  nodes.forEach(n=>{if(!rank.has(n.id))rank.set(n.id,0);});
  const groups=new Map();nodes.forEach(n=>{const r=rank.get(n.id);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(n);});const ranks=[...groups.keys()].sort((a,b)=>a-b);
  if(dir==='LR'){
    let x=80;
    for(const r of ranks){const items=groups.get(r);let y=80;const columnW=Math.max(...items.map(n=>n.w));for(const n of items){n.x=x+(columnW-n.w)/2;n.y=y;y+=n.h+vGap;}x+=columnW+hGap;}
  }else{
    let y=80;
    for(const r of ranks){const items=groups.get(r);let x=80;const rowH=Math.max(...items.map(n=>n.h));for(const n of items){n.x=x;n.y=y+(rowH-n.h)/2;x+=n.w+hGap;}y+=rowH+vGap;}
  }
  pushHistory(prev);scheduleSave();render();fitNodes(nodes,70);toast(scope==='flow'?'연결된 흐름만 정리했습니다.':scope==='selection'?'선택 요소를 정리했습니다.':'일반 노드를 정리했습니다.','success');
}
function alignSelection(mode){const nodes=selectedNodes();if(nodes.length<2){toast('두 개 이상의 노드를 선택하세요.');return;}commit(()=>{if(mode==='left'){const v=Math.min(...nodes.map(n=>n.x));nodes.forEach(n=>n.x=v);}if(mode==='center-x'){const c=nodes.reduce((a,n)=>a+n.x+n.w/2,0)/nodes.length;nodes.forEach(n=>n.x=c-n.w/2);}if(mode==='right'){const v=Math.max(...nodes.map(n=>n.x+n.w));nodes.forEach(n=>n.x=v-n.w);}if(mode==='top'){const v=Math.min(...nodes.map(n=>n.y));nodes.forEach(n=>n.y=v);}if(mode==='center-y'){const c=nodes.reduce((a,n)=>a+n.y+n.h/2,0)/nodes.length;nodes.forEach(n=>n.y=c-n.h/2);}if(mode==='bottom'){const v=Math.max(...nodes.map(n=>n.y+n.h));nodes.forEach(n=>n.y=v-n.h);}if(mode==='distribute-x'){const list=[...nodes].sort((a,b)=>a.x-b.x),left=Math.min(...list.map(n=>n.x)),right=Math.max(...list.map(n=>n.x+n.w)),used=list.reduce((sum,n)=>sum+n.w,0),gap=Math.max(0,(right-left-used)/(list.length-1));let x=left;for(const n of list){n.x=x;x+=n.w+gap;}}if(mode==='distribute-y'){const list=[...nodes].sort((a,b)=>a.y-b.y),top=Math.min(...list.map(n=>n.y)),bottom=Math.max(...list.map(n=>n.y+n.h)),used=list.reduce((sum,n)=>sum+n.h,0),gap=Math.max(0,(bottom-top-used)/(list.length-1));let y=top;for(const n of list){n.y=y;y+=n.h+gap;}}},'정렬');}

function loadTemplate(id){const t=TEMPLATES.find(x=>x.id===id);if(!t)return;const theme=themeById(t.theme);commit(()=>{doc.nodes=t.nodes.map(n=>normalizeNode(deepClone(n)));doc.edges=t.edges.map(e=>normalizeEdge(deepClone(e)));doc.tokens=deepClone(theme.tokens);doc.themeId=theme.id;doc.meta={...doc.meta,projectId:uid('project'),name:t.name,updatedAt:new Date().toISOString()};selection={nodeIds:[],edgeId:null};},'템플릿 적용');setTimeout(fitView,0);}
function applyTheme(id){const t=themeById(id);commit(()=>{doc.tokens=deepClone(t.tokens);doc.themeId=t.id;},`${t.label} 스타일 적용`);}

let svgWorkerInstance=null,svgWorkerSeq=0;
function svgPreflightStats(text=''){return {bytes:new TextEncoder().encode(text).length,pathCount:(String(text).match(/<path\b/gi)||[]).length};}
function prepareSvgText(text){
  const raw=String(text||'');const stats=svgPreflightStats(raw);
  if(stats.bytes<50000&&stats.pathCount<80)return Promise.resolve({text:raw,stats:{...stats,elementCount:0,optimizedBytes:stats.bytes}});
  if(!('Worker'in window))return new Promise(resolve=>requestAnimationFrame(()=>resolve({text:raw,stats:{...stats,elementCount:0,optimizedBytes:stats.bytes}})));
  svgWorkerInstance ||= new Worker('./src/svg-worker.js');
  const id=++svgWorkerSeq;setStatus(`SVG 분석 중 · ${stats.pathCount} paths`);
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{cleanup();reject(new Error('SVG 분석 시간이 너무 오래 걸립니다. 파일을 최적화한 뒤 다시 시도하세요.'));},15000);
    const onMessage=e=>{if(e.data?.id!==id)return;cleanup();if(!e.data.ok)reject(new Error(e.data.error||'SVG 분석 실패'));else resolve({text:e.data.cleaned,stats:e.data.stats});};
    const cleanup=()=>{clearTimeout(timer);svgWorkerInstance?.removeEventListener('message',onMessage);};
    svgWorkerInstance.addEventListener('message',onMessage);svgWorkerInstance.postMessage({id,text:raw});
  });
}
function sanitizeSvgSource(text,prefix,{normalizeColor=false}={}){
  const parsed=new DOMParser().parseFromString(text,'image/svg+xml');
  if(parsed.querySelector('parsererror'))throw new Error('SVG 문법을 읽을 수 없습니다.');
  const root=parsed.documentElement;if(root.nodeName.toLowerCase()!=='svg')throw new Error('SVG 파일이 아닙니다.');
  const allowed=new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','defs','lineargradient','radialgradient','stop','clippath','mask','title','desc','use']);
  const attrs=new Set(['id','d','x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','width','height','points','fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-dasharray','opacity','transform','offset','stop-color','stop-opacity','gradientunits','gradienttransform','viewbox','preserveaspectratio','clip-path','mask','href','xlink:href']);
  for(const el of [...root.querySelectorAll('*')]){if(!allowed.has(el.nodeName.toLowerCase())){el.remove();continue;}for(const a of [...el.attributes]){const name=a.name.toLowerCase(),value=a.value.trim();if(!attrs.has(name)||name.startsWith('on')||/javascript:/i.test(value)||/url\((?!['"]?#)/i.test(value)||(name==='href'||name==='xlink:href')&&!value.startsWith('#'))el.removeAttribute(a.name);}}
  if(normalizeColor){for(const el of [root,...root.querySelectorAll('*')]){const fill=el.getAttribute('fill'),stroke=el.getAttribute('stroke');if(fill&&!/^(none|transparent|currentColor)$/i.test(fill)&&!/^url\(/i.test(fill))el.setAttribute('fill','currentColor');if(stroke&&!/^(none|transparent|currentColor)$/i.test(stroke)&&!/^url\(/i.test(stroke))el.setAttribute('stroke','currentColor');}}
  const idMap=new Map();for(const el of root.querySelectorAll('[id]')){const old=el.id,nw=`${prefix}-${old.replace(/[^a-zA-Z0-9_-]/g,'')||'id'}`;idMap.set(old,nw);el.id=nw;}
  for(const el of root.querySelectorAll('*'))for(const a of [...el.attributes]){let v=a.value;for(const [old,nw] of idMap){v=v.replaceAll(`url(#${old})`,`url(#${nw})`).replaceAll(`#${old}`,`#${nw}`);}el.setAttribute(a.name,v);}
  const viewBox=root.getAttribute('viewBox')||`0 0 ${Number(root.getAttribute('width'))||100} ${Number(root.getAttribute('height'))||100}`;
  const rootPaint={};
  for(const [attr,key] of [['fill','fill'],['stroke','stroke'],['stroke-width','strokeWidth'],['stroke-linecap','strokeLinecap'],['stroke-linejoin','strokeLinejoin']]){const v=root.getAttribute(attr);if(v)rootPaint[key]=v;}
  const paintSet=new Set();
  for(const el of [root,...root.querySelectorAll('*')])for(const attr of ['fill','stroke','stop-color']){const v=el.getAttribute?.(attr);if(v&&/^#[0-9a-f]{6}$/i.test(v))paintSet.add(v.toLowerCase());}
  return {viewBox,content:root.innerHTML,rootPaint,paintSlots:[...paintSet].slice(0,12)};
}
function cleanSourceUrl(value=''){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return'';}}
async function importSvgText(text,{name='SVG 자산',sourceUrl='',normalizeColor=false,point=viewportCenterWorld()}={}){
  const prepared=await prepareSvgText(text);await new Promise(resolve=>requestAnimationFrame(resolve));
  setStatus('SVG 정리 및 색상 분석 중');
  const prefix=uid('svg');const safe=sanitizeSvgSource(prepared.text,prefix,{normalizeColor});
  const nums=String(safe.viewBox).trim().split(/[\s,]+/).map(Number),ratio=nums.length===4&&nums[2]>0&&nums[3]>0?nums[2]/nums[3]:1;
  const longSide=220;let w,h;if(ratio>=1){w=longSide;h=Math.max(72,Math.min(longSide,longSide/ratio));}else{h=longSide;w=Math.max(72,Math.min(longSide,longSide*ratio));}
  const complexity=prepared.stats?.pathCount||0;
  const defaultPaintMode=complexity>120?'original':'original';
  const node={id:uid('node'),type:'custom-svg',x:snap(point.x-w/2),y:snap(point.y-h/2),w:snap(w),h:snap(h),label:'',style:{iconColor:doc.tokens.text,accentColor:doc.tokens.primary,padding:4,portCount:0,lockAspect:true,svgEffect:'none',svgFit:'contain',svgPaintMode:defaultPaintMode,svgStrokeWidth:1.8},customSvg:{...safe,name:name||'SVG 자산',origin:'user-import',sourceUrl:cleanSourceUrl(sourceUrl),mode:'icon',labelPosition:'none',complexity:{pathCount:complexity,bytes:prepared.stats?.bytes||0,optimizedBytes:prepared.stats?.optimizedBytes||0}}};
  commit(()=>{doc.nodes.push(node);selection={nodeIds:[node.id],edgeId:null};},'SVG 자산 추가');setStatus('SVG 추가 완료');toast(complexity>120?`복잡한 SVG(${complexity} paths)를 최적화해 추가했습니다.`:'SVG 원본 비율과 색상 속성을 보존해 추가했습니다.','success');return node;
}
async function importSvgShape(file,point=viewportCenterWorld()){
  return importSvgText(await file.text(),{name:file.name.replace(/\.svg$/i,'')||'SVG 자산',point});
}
function normalizeSelectedSvgColor(){const node=selectedNodes()[0];if(!node||node.type!=='custom-svg')return;const wrapped=`<svg viewBox="${node.customSvg.viewBox}">${node.customSvg.content}</svg>`;const safe=sanitizeSvgSource(wrapped,uid('color'),{normalizeColor:true});commit(()=>{node.customSvg={...node.customSvg,...safe};node.style={...node.style,iconColor:node.style?.iconColor??doc.tokens.text};},'SVG 색상 편집 가능');toast('고정 색상을 currentColor로 정규화했습니다.','success');}
function openSvgPaste(){openDialog('#svg-paste-dialog');$('#svg-paste-input').value='';$('#svg-asset-name').value='';$('#svg-source-url').value='';$('#svg-normalize-color').checked=false;setTimeout(()=>$('#svg-paste-input').focus(),0);}
async function readSvgClipboard(){try{const text=await navigator.clipboard.readText();if(!/^\s*<svg[\s>]/i.test(text))throw new Error('클립보드에 SVG 코드가 없습니다.');$('#svg-paste-input').value=text;toast('클립보드 SVG를 불러왔습니다.','success');}catch(error){toast(error.message||'클립보드를 읽을 수 없습니다.','error');}}

function openDialog(id){const d=$(id);if(d?.showModal)d.showModal();}
function closeDialog(id){$(id)?.close?.();}
function editSelectedLabel(){const nodes=selectedNodes();if(nodes.length!==1)return;$('#edit-label-input').value=nodes[0].label;openDialog('#label-dialog');setTimeout(()=>$('#edit-label-input').focus(),0);}
function openExport(){ $('#export-background').checked=doc.settings.exportBackground;$('#export-scale').value=doc.settings.exportScale;openDialog('#export-dialog'); }
function openProjects(){renderProjects();openDialog('#project-dialog');}
function renderProjects(){const list=listProjects();$('#saved-projects').innerHTML=list.length?list.map(p=>`<div class="saved-project"><button data-load-project="${esc(p.id)}"><strong>${esc(p.name)}</strong><span>${new Date(p.updatedAt).toLocaleString('ko-KR')}</span></button><button class="icon-btn danger-icon" data-delete-project="${esc(p.id)}" aria-label="저장본 삭제">×</button></div>`).join(''):`<div class="empty-state"><strong>저장된 프로젝트가 없습니다.</strong><span>현재 프로젝트를 저장하면 여기에 표시됩니다.</span></div>`;}
function saveCurrentProject(){const item=saveProject(doc.meta.name,snapshot());doc.meta.projectId=item.id;scheduleSave();renderProjects();toast('브라우저에 프로젝트를 저장했습니다.','success');}

function commandItems(query=''){
  const q=query.trim().toLowerCase();const items=[];
  items.push(
    {kind:'스마트',title:'24/12시간 원형 생활계획표',keywords:'생활계획 schedule radial time 24 12',run:()=>addNode('radial-plan')},
    {kind:'스마트',title:'머릿속 생각 지도',keywords:'brain 머리 생각 비율 mind',run:()=>addNode('brain-map')},
    {kind:'미디어',title:'이미지 넣기',keywords:'image photo picture 이미지 사진',run:()=>addNode('image')}
  );
  SHAPES.forEach(s=>items.push({kind:'도형',title:s.label,keywords:s.keywords,run:()=>addNode(s.id)}));
  BUILTIN_ICONS.forEach(i=>items.push({kind:'SVG',title:i.label,keywords:i.keywords,run:()=>addBuiltinIcon(i.id)}));
  TEMPLATES.forEach(t=>items.push({kind:'템플릿',title:t.name,keywords:t.keywords,run:()=>loadTemplate(t.id)}));
  THEMES.forEach(t=>items.push({kind:'스타일',title:t.label,keywords:t.description,run:()=>applyTheme(t.id)}));
  items.push({kind:'명령',title:'자동 레이아웃',keywords:'layout arrange 정렬',run:autoLayout},{kind:'명령',title:'화면에 맞추기',keywords:'fit zoom view',run:fitView},{kind:'명령',title:'SVG 붙여넣기',keywords:'svg paste icon asset 붙여넣기',run:openSvgPaste},{kind:'명령',title:'전체 선택',keywords:'select all 전체 선택',run:()=>{selection={nodeIds:doc.nodes.map(n=>n.id),edgeId:null};render();}},{kind:'명령',title:'내보내기',keywords:'export svg png webp html json',run:openExport},{kind:'명령',title:'프로젝트 저장',keywords:'save local project',run:saveCurrentProject},{kind:'명령',title:'공유 링크 만들기',keywords:'share link 공유 URL',run:createShareLink});
  return items.filter(i=>!q||`${i.kind} ${i.title} ${i.keywords}`.toLowerCase().includes(q)).slice(0,18);
}
let cmdResults=[];
function renderCommands(){const input=$('#command-input'),q=input.value;cmdResults=commandItems(q);$('#command-results').innerHTML=cmdResults.length?cmdResults.map((i,idx)=>`<button data-command-index="${idx}"><span>${esc(i.kind)}</span><strong>${esc(i.title)}</strong></button>`).join(''):`<div class="empty-state"><strong>검색 결과 없음</strong><span>도형, 스타일, 템플릿 또는 명령을 검색하세요.</span></div>`;}
function openCommands(){openDialog('#command-dialog');$('#command-input').value='';renderCommands();setTimeout(()=>$('#command-input').focus(),0);}

canvas.addEventListener('pointerdown',e=>{
  const target=e.target;const port=target.closest?.('[data-port]');const resize=target.closest?.('[data-resize]');const nodeEl=target.closest?.('[data-node-id]');const edgeEl=target.closest?.('[data-edge-id]');
  if(port){e.preventDefault();e.stopPropagation();const node=doc.nodes.find(n=>n.id===port.dataset.nodeId);const p={x:Number(port.getAttribute('cx')),y:Number(port.getAttribute('cy'))};connectPreview={source:node.id,sourcePort:port.dataset.port,start:p,current:p};gesture={type:'connect'};canvas.setPointerCapture(e.pointerId);renderCanvas();return;}
  if(resize){e.preventDefault();e.stopPropagation();const node=doc.nodes.find(n=>n.id===resize.dataset.nodeId);if(!selection.nodeIds.includes(node.id))selection.nodeIds=[node.id];gesture={type:'resize',nodeId:node.id,handle:resize.dataset.resize,start:clientToWorld(e.clientX,e.clientY),initial:deepClone(node),before:snapshot()};canvas.setPointerCapture(e.pointerId);return;}
  if(e.button===1||spaceDown){e.preventDefault();gesture={type:'pan',client:{x:e.clientX,y:e.clientY},viewport:{...viewport}};canvas.setPointerCapture(e.pointerId);return;}
  if(nodeEl){const id=nodeEl.dataset.nodeId;if(e.detail===2){selectNode(id);editSelectedLabel();return;}if(!selection.nodeIds.includes(id))selectNode(id,e.shiftKey);else if(e.shiftKey){selectNode(id,true);return;}const start=clientToWorld(e.clientX,e.clientY);const initial=selectedNodes().map(n=>({id:n.id,x:n.x,y:n.y}));gesture={type:'drag',start,initial,before:snapshot(),moved:false};canvas.setPointerCapture(e.pointerId);return;}
  if(edgeEl){selectEdge(edgeEl.dataset.edgeId);return;}
  if(e.button===0){const p=clientToWorld(e.clientX,e.clientY);marquee={start:p,current:p,add:e.shiftKey};gesture={type:'marquee',startClient:{x:e.clientX,y:e.clientY}};canvas.setPointerCapture(e.pointerId);renderCanvas();}
});
canvas.addEventListener('pointermove',e=>{
  if(!gesture)return;const p=clientToWorld(e.clientX,e.clientY);
  if(gesture.type==='connect'){connectPreview.current=p;renderCanvas();}
  else if(gesture.type==='drag'){const dx=p.x-gesture.start.x,dy=p.y-gesture.start.y;if(Math.abs(dx)+Math.abs(dy)>.4)gesture.moved=true;gesture.initial.forEach(i=>{const n=doc.nodes.find(x=>x.id===i.id);n.x=snap(i.x+dx);n.y=snap(i.y+dy);});renderCanvas();}
  else if(gesture.type==='resize'){const n=doc.nodes.find(x=>x.id===gesture.nodeId),i=gesture.initial;let dx=p.x-gesture.start.x,dy=p.y-gesture.start.y;let x=i.x,y=i.y,w=i.w,h=i.h;if(gesture.handle.includes('e'))w=Math.max(48,i.w+dx);if(gesture.handle.includes('s'))h=Math.max(40,i.h+dy);if(gesture.handle.includes('w')){w=Math.max(48,i.w-dx);x=i.x+i.w-w;}if(gesture.handle.includes('n')){h=Math.max(40,i.h-dy);y=i.y+i.h-h;}if(n.type==='custom-svg'&&n.style?.lockAspect!==false){const ratio=customSvgAspectRatio(i),horizontal=gesture.handle.includes('e')||gesture.handle.includes('w');if(horizontal){h=Math.max(40,w/ratio);if(gesture.handle.includes('n'))y=i.y+i.h-h;}else{w=Math.max(48,h*ratio);if(gesture.handle.includes('w'))x=i.x+i.w-w;}}n.x=snap(x);n.y=snap(y);n.w=snap(w);n.h=snap(h);renderCanvas();}
  else if(gesture.type==='pan'){viewport.x=gesture.viewport.x+(e.clientX-gesture.client.x);viewport.y=gesture.viewport.y+(e.clientY-gesture.client.y);renderCanvas();}
  else if(gesture.type==='marquee'){marquee.current=p;renderCanvas();}
});
canvas.addEventListener('pointerup',e=>{
  if(!gesture)return;
  if(gesture.type==='connect'&&connectPreview){const el=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('[data-node-id]');if(el&&el.dataset.nodeId!==connectPreview.source){const target=doc.nodes.find(n=>n.id===el.dataset.nodeId),world=clientToWorld(e.clientX,e.clientY);const port=nearestPort(target,world,doc.tokens);const {source,sourcePort}=connectPreview;connectPreview=null;gesture=null;addEdge(source,sourcePort,target.id,port);return;}connectPreview=null;renderCanvas();}
  else if(gesture.type==='drag'&&gesture.moved){pushHistory(gesture.before);scheduleSave();render();}
  else if(gesture.type==='resize'){pushHistory(gesture.before);scheduleSave();render();}
  else if(gesture.type==='marquee'&&marquee){const dx=Math.abs(e.clientX-gesture.startClient.x),dy=Math.abs(e.clientY-gesture.startClient.y);if(dx<4&&dy<4){if(!marquee.add)selection={nodeIds:[],edgeId:null};}else{const x1=Math.min(marquee.start.x,marquee.current.x),x2=Math.max(marquee.start.x,marquee.current.x),y1=Math.min(marquee.start.y,marquee.current.y),y2=Math.max(marquee.start.y,marquee.current.y);const ids=doc.nodes.filter(n=>n.x+n.w>=x1&&n.x<=x2&&n.y+n.h>=y1&&n.y<=y2).map(n=>n.id);selection.nodeIds=marquee.add?[...new Set([...selection.nodeIds,...ids])]:ids;selection.edgeId=null;}marquee=null;render();}
  gesture=null;
});
canvas.addEventListener('pointercancel',()=>{gesture=null;connectPreview=null;marquee=null;renderCanvas();});
canvas.addEventListener('wheel',e=>{e.preventDefault();const factor=e.deltaY<0?1.1:.9;zoomAt(factor,e.clientX,e.clientY);},{passive:false});
canvas.addEventListener('dragover',e=>e.preventDefault());
canvas.addEventListener('drop',async e=>{e.preventDefault();const point=clientToWorld(e.clientX,e.clientY);const type=e.dataTransfer.getData('application/x-nodeweave-shape');const iconId=e.dataTransfer.getData('application/x-nodeweave-icon');if(type){addNode(type,point);return;}if(iconId){addBuiltinIcon(iconId,point);return;}const file=[...e.dataTransfer.files].find(f=>f.type==='image/svg+xml'||/\.svg$/i.test(f.name));if(file){try{await importSvgShape(file,point);}catch(err){toast(err.message||'SVG를 가져오지 못했습니다.','error');}}});

$('#left-panel').addEventListener('dragstart',e=>{const shape=e.target.closest('[data-shape-id]'),icon=e.target.closest('[data-icon-id]');if(shape)e.dataTransfer.setData('application/x-nodeweave-shape',shape.dataset.shapeId);if(icon)e.dataTransfer.setData('application/x-nodeweave-icon',icon.dataset.iconId);});
$('#left-panel').addEventListener('click',e=>{const tab=e.target.closest('[data-library-tab]');if(tab){setLibraryTab(tab.dataset.libraryTab);return;}const shape=e.target.closest('[data-shape-id]');if(shape)addNode(shape.dataset.shapeId);const icon=e.target.closest('[data-icon-id]');if(icon)addBuiltinIcon(icon.dataset.iconId);const tpl=e.target.closest('[data-template-id]');if(tpl)loadTemplate(tpl.dataset.templateId);if(e.target.closest('#paste-svg-btn'))openSvgPaste();if(e.target.closest('#browse-library-btn'))openLibraryBrowser();});
$('#left-panel').addEventListener('change',e=>{if(e.target.matches('[data-library-category-select]'))setLibraryCategory(e.target.value);});
$('#shape-search').addEventListener('input',e=>{paletteQuery=e.target.value;renderPalette();renderLibraryBrowser();});
$('#library-sort')?.addEventListener('change',e=>{librarySort=e.target.value;uiPrefs.librarySort=librarySort;saveUiPrefs(uiPrefs);renderPalette();renderLibraryBrowser();});
$('#library-view-toggle')?.addEventListener('click',()=>{libraryView=libraryView==='grid'?'list':'grid';uiPrefs.libraryView=libraryView;saveUiPrefs(uiPrefs);renderPalette();});
$('#library-browser-search')?.addEventListener('input',e=>{paletteQuery=e.target.value;const left=$('#shape-search');if(left)left.value=paletteQuery;renderPalette();renderLibraryBrowser();});
$('#library-browser-dialog')?.addEventListener('click',e=>{const tab=e.target.closest('[data-library-tab]');if(tab){setLibraryTab(tab.dataset.libraryTab,{resetQuery:false});return;}const shape=e.target.closest('[data-shape-id]');if(shape){addNode(shape.dataset.shapeId);return;}const icon=e.target.closest('[data-icon-id]');if(icon){addBuiltinIcon(icon.dataset.iconId);return;}const tpl=e.target.closest('[data-template-id]');if(tpl){loadTemplate(tpl.dataset.templateId);closeDialog('#library-browser-dialog');}});
$('#library-browser-dialog')?.addEventListener('change',e=>{if(e.target.matches('[data-library-category-select]'))setLibraryCategory(e.target.value);});

$('#inspector').addEventListener('click',e=>{
  const tab=e.target.closest('[data-tab]');if(tab){inspectorTab=tab.dataset.tab;renderInspector();return;}
  const theme=e.target.closest('[data-theme-id]');if(theme){applyTheme(theme.dataset.themeId);return;}
  const act=e.target.closest('[data-action]')?.dataset.action;if(act==='delete-selection')deleteSelection();if(act==='duplicate')duplicateSelection();if(act==='copy-selection')copySelection();if(act==='reset-node-style')commit(()=>selectedNodes().forEach(n=>n.style={}),'스타일 복원');if(act==='auto-layout')autoLayout();if(act==='fit-selection')fitSelection();if(act==='fit-all')fitView();if(act==='bring-front')moveSelectionZ('front');if(act==='send-back')moveSelectionZ('back');if(act==='flip-x')commit(()=>selectedNodes().forEach(n=>n.style={...n.style,flipX:!n.style?.flipX}),'좌우 반전');if(act==='flip-y')commit(()=>selectedNodes().forEach(n=>n.style={...n.style,flipY:!n.style?.flipY}),'상하 반전');if(act==='clear-icon-background')commit(()=>selectedNodes().forEach(n=>n.style={...n.style,iconBackground:'transparent'}),'SVG 배경 제거');if(act==='normalize-svg-color')normalizeSelectedSvgColor();if(act==='fit-svg-ratio'){const n=selectedNodes()[0];if(n?.type==='custom-svg')commit(()=>{const ratio=customSvgAspectRatio(n),longSide=Math.max(n.w,n.h,180);if(ratio>=1){n.w=longSide;n.h=longSide/ratio;}else{n.h=longSide;n.w=longSide*ratio;}n.style={...n.style,lockAspect:true};},'SVG 원본 비율 맞춤');}if(act==='reset-svg-palette'){const n=selectedNodes()[0];if(n?.type==='custom-svg')commit(()=>{n.customSvg={...n.customSvg,paintOverrides:{}};},'SVG 색상 슬롯 초기화');}if(act==='image-remove')commit(()=>{const n=selectedNodes()[0];if(n)n.media={...(n.media||{}),src:''};},'이미지 제거');
  if(act==='plan-add')commit(()=>{const n=selectedNodes()[0],total=Number(n.data?.clockMode)===12?12:24;const segs=n.data.segments||(n.data.segments=[]),last=segs.at(-1);const start=last?Number(last.end)||0:0;n.data.segments.push({label:'새 활동',start,end:Math.min(total,start+1),color:['#6366f1','#22c55e','#f59e0b','#ec4899','#06b6d4','#8b5cf6'][segs.length%6]});},'시간 구간 추가');
  if(act==='plan-delete'){const i=Number(e.target.closest('[data-plan-index]')?.dataset.planIndex);commit(()=>{selectedNodes()[0]?.data?.segments?.splice(i,1);},'시간 구간 삭제');}
  if(act==='plan-up'||act==='plan-down'){const i=Number(e.target.closest('[data-plan-index]')?.dataset.planIndex),delta=act==='plan-up'?-1:1;commit(()=>{const segs=selectedNodes()[0]?.data?.segments;if(!segs)return;const j=i+delta;if(i>=0&&j>=0&&j<segs.length)[segs[i],segs[j]]=[segs[j],segs[i]];},'시간 구간 순서 변경');}
  if(act==='plan-sort')commit(()=>{const segs=selectedNodes()[0]?.data?.segments;if(segs)segs.sort((a,b)=>(Number(a.start)||0)-(Number(b.start)||0));},'시간순 정렬');
  if(act==='brain-add')commit(()=>{const n=selectedNodes()[0];if(!n)return;n.data=n.data||{};const regs=n.data.regions||(n.data.regions=[]);if(regs.length>=12)return;const palette=['#c4b5fd','#93c5fd','#f9a8d4','#86efac','#fde68a','#fdba74','#a5f3fc','#fca5a5','#bfdbfe','#d9f99d','#fecdd3','#ddd6fe'];regs.push({label:`생각 ${regs.length+1}`,percent:0,color:palette[regs.length%palette.length],display:'auto'});},'생각 영역 추가');
  if(act==='brain-delete'){const i=Number(e.target.closest('[data-brain-index]')?.dataset.brainIndex);const n=selectedNodes()[0];if((n?.data?.regions?.length||0)<=2){toast('생각 영역은 최소 2개가 필요합니다.','error');}else commit(()=>{n.data.regions.splice(i,1);},'생각 영역 삭제');}
  if(act==='brain-up'||act==='brain-down'){const i=Number(e.target.closest('[data-brain-index]')?.dataset.brainIndex),delta=act==='brain-up'?-1:1;commit(()=>{const regs=selectedNodes()[0]?.data?.regions;if(!regs)return;const j=i+delta;if(i>=0&&j>=0&&j<regs.length)[regs[i],regs[j]]=[regs[j],regs[i]];},'생각 영역 순서 변경');}
  if(act==='brain-normalize')commit(()=>{const regs=selectedNodes()[0]?.data?.regions;if(!regs?.length)return;const raw=regs.map(r=>Math.max(0,Number(r.percent)||0)),sum=raw.reduce((a,b)=>a+b,0);if(sum<=0){const base=Math.floor(100/regs.length),rest=100-base*regs.length;regs.forEach((r,i)=>r.percent=base+(i<rest?1:0));}else{let used=0;regs.forEach((r,i)=>{if(i===regs.length-1)r.percent=100-used;else{r.percent=Math.max(0,Math.round(raw[i]/sum*100));used+=r.percent;}});}},'생각 비율 100% 맞춤');
  const align=e.target.closest('[data-align]');if(align)alignSelection(align.dataset.align);
});
$('#inspector').addEventListener('change',async e=>{
  const el=e.target;const first=selectedNodes()[0];
  if(el.matches('[data-image-upload]')){try{const src=await readImageFile(el.files?.[0]);if(src&&first)commit(()=>{first.media={...(first.media||{}),src};},'이미지 업로드');}catch(err){toast(err.message||'이미지를 읽지 못했습니다.','error');}return;}
  if(el.matches('[data-image-url]')){const src=cleanImageSource(el.value);if(!src&&el.value.trim()){toast('http(s) 이미지 URL만 사용할 수 있습니다.','error');return;}if(first)commit(()=>{first.media={...(first.media||{}),src};},'이미지 URL 변경');return;}
  if(el.dataset.imageProp){const key=el.dataset.imageProp;let value=el.type==='checkbox'?el.checked:el.value;if(key==='opacity')value=Number(value);if(first)commit(()=>{first.media={...(first.media||{}),[key]:value};},`이미지 ${key} 변경`);return;}
  if(el.dataset.svgProp){const key=el.dataset.svgProp,value=el.value;if(first)commit(()=>{first.customSvg={...(first.customSvg||{}),[key]:value};if(key==='mode'){if(value==='icon')first.customSvg.labelPosition='none';else{first.customSvg.labelPosition=first.customSvg.labelPosition==='none'?'center':(first.customSvg.labelPosition||'center');if(!first.label)first.label=first.customSvg.name||'SVG 블록';}}},'SVG 사용 방식 변경');return;}
  if(el.dataset.svgPaint){const key=el.dataset.svgPaint,value=el.value;if(first)commit(()=>{first.customSvg={...(first.customSvg||{}),paintOverrides:{...(first.customSvg?.paintOverrides||{}),[key]:value}};},'SVG 색상 슬롯 변경');return;}
  if(el.dataset.smartProp){const key=el.dataset.smartProp;let value=el.type==='checkbox'?el.checked:el.value;if(['clockMode','calloutThreshold'].includes(key))value=Number(value);if(first)commit(()=>{first.data={...(first.data||{}),[key]:value};},'스마트 도구 설정 변경');return;}
  const planRow=el.closest('[data-plan-index]');if(planRow&&el.dataset.planField){const i=Number(planRow.dataset.planIndex),key=el.dataset.planField;let value=el.type==='number'?Number(el.value):el.value;if(first)commit(()=>{first.data.segments[i]={...first.data.segments[i],[key]:value};},'생활계획 시간 변경');return;}
  const brainRow=el.closest('[data-brain-index]');if(brainRow&&el.dataset.brainField){const i=Number(brainRow.dataset.brainIndex),key=el.dataset.brainField;let value=el.type==='number'?Number(el.value):el.value;if(first)commit(()=>{first.data=first.data||{regions:[]};first.data.regions=first.data.regions||[];if(first.data.regions[i])first.data.regions[i]={...first.data.regions[i],[key]:value};},'생각 영역 변경');return;}
  if(el.dataset.nodeProp){const key=el.dataset.nodeProp;let value=el.type==='checkbox'?el.checked:el.value;if(['strokeWidth','fontSize','radius','rotation','padding','opacity','portCount','svgStrokeWidth'].includes(key))value=Number(value);commit(()=>selectedNodes().forEach(n=>{if(key==='label'){n.label=value;if(n.style?.autoSize)autosizeNodeForText(n);}else{n.style={...n.style,[key]:value};if(key==='autoSize'&&value)autosizeNodeForText(n);}}),`노드 ${key} 변경`);return;}
  if(el.dataset.nodeField){const key=el.dataset.nodeField,value=Math.max(20,Number(el.value)||0);commit(()=>selectedNodes().forEach(n=>{if(n.type==='custom-svg'&&n.style?.lockAspect!==false){const ratio=customSvgAspectRatio(n);if(key==='w'){n.w=value;n.h=Math.max(20,value/ratio);}else if(key==='h'){n.h=value;n.w=Math.max(20,value*ratio);}else n[key]=value;}else n[key]=value;}),`노드 크기 변경`);return;}
  if(el.dataset.edgeProp){const edge=doc.edges.find(x=>x.id===selection.edgeId);if(!edge)return;const key=el.dataset.edgeProp;let value=el.type==='checkbox'?el.checked:el.value;if(key==='width')value=Number(value);commit(()=>{if(['label','routing'].includes(key))edge[key]=value;else edge.style={...edge.style,[key]:value};},`연결선 ${key} 변경`);return;}
  if(el.dataset.token){const key=el.dataset.token;const value=['radius','nodeStrokeWidth','portCount','portSize','edgeWidth'].includes(key)?Number(el.value):el.value;commit(()=>{doc.tokens[key]=value;doc.themeId='custom';},`토큰 ${key} 변경`);return;}
  if(el.id==='layout-scope'){doc.settings.layoutScope=el.value;scheduleSave();renderInspector();return;}
  if(el.dataset.setting){const key=el.dataset.setting,value=el.type==='checkbox'?el.checked:Number(el.value);commit(()=>doc.settings[key]=value,`설정 ${key} 변경`);}
});

$('#project-name').addEventListener('change',e=>commit(()=>doc.meta.name=e.target.value.trim()||'Untitled diagram','프로젝트 이름 변경'));
$('#undo-btn').addEventListener('click',undo);$('#redo-btn').addEventListener('click',redo);$('#fit-btn').addEventListener('click',fitView);$('#zoom-in-btn').addEventListener('click',()=>zoomCenter(1.15));$('#zoom-out-btn').addEventListener('click',()=>zoomCenter(.87));$('#mobile-fit-btn').addEventListener('click',fitView);$('#mobile-zoom-in-btn').addEventListener('click',()=>zoomCenter(1.15));$('#mobile-zoom-out-btn').addEventListener('click',()=>zoomCenter(.87));
$('#auto-layout-btn').addEventListener('click',()=>{inspectorTab='layout';rightOpen=true;render();setTimeout(autoLayout,0);});
$('#export-btn').addEventListener('click',openExport);$('#project-btn').addEventListener('click',openProjects);$('#command-btn').addEventListener('click',openCommands);$('#share-btn')?.addEventListener('click',createShareLink);$('#copy-share-btn')?.addEventListener('click',copyShareLink);$('#native-share-btn')?.addEventListener('click',async()=>{const url=$('#share-url').value;if(navigator.share)try{await navigator.share({title:doc.meta.name,text:'NodeWeave 다이어그램',url});}catch{}});$('#browse-library-btn')?.addEventListener('click',()=>openLibraryBrowser());
$('#left-toggle').addEventListener('click',()=>{leftOpen=!leftOpen;updatePanelState();});$('#right-toggle').addEventListener('click',()=>{rightOpen=!rightOpen;updatePanelState();});
$('#ui-theme-btn').addEventListener('click',()=>{const modes=['system','light','dark'];const next=modes[(modes.indexOf(uiPrefs.theme)+1)%modes.length];applyUiTheme(next);});

$('#label-form').addEventListener('submit',e=>{e.preventDefault();const nodes=selectedNodes();if(nodes.length===1){const value=$('#edit-label-input').value.trim()||'텍스트';commit(()=>nodes[0].label=value,'텍스트 변경');}closeDialog('#label-dialog');});
$('#project-save-btn').addEventListener('click',saveCurrentProject);
$('#project-new-btn').addEventListener('click',()=>{const fresh=defaultDocument();fresh.nodes=[];fresh.edges=[];fresh.meta.name='새 다이어그램';pushHistory(snapshot());doc=fresh;selection={nodeIds:[],edgeId:null};scheduleSave();render();closeDialog('#project-dialog');fitView();});
$('#saved-projects').addEventListener('click',e=>{const load=e.target.closest('[data-load-project]');if(load){const item=listProjects().find(p=>p.id===load.dataset.loadProject);if(item){pushHistory(snapshot());doc=normalizeDoc(item.doc);selection={nodeIds:[],edgeId:null};scheduleSave();render();closeDialog('#project-dialog');setTimeout(fitView,0);}}const del=e.target.closest('[data-delete-project]');if(del){deleteProject(del.dataset.deleteProject);renderProjects();}});

$('#import-input').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const parsed=JSON.parse(await file.text());const next=normalizeDoc(parsed);pushHistory(snapshot());doc=next;selection={nodeIds:[],edgeId:null};scheduleSave();render();closeDialog('#project-dialog');setTimeout(fitView,0);toast('프로젝트를 불러왔습니다.','success');}catch(err){toast('올바른 NodeWeave JSON 파일이 아닙니다.','error');}e.target.value='';});

$('#svg-import-input').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{await importSvgShape(file);closeDialog('#project-dialog');}catch(err){toast(err.message||'SVG 도형을 가져오지 못했습니다.','error');}e.target.value='';});

$('#svg-read-clipboard')?.addEventListener('click',readSvgClipboard);
$('#svg-paste-form').addEventListener('submit',async e=>{e.preventDefault();try{const text=$('#svg-paste-input').value.trim();if(!text)throw new Error('SVG 코드를 입력하세요.');await importSvgText(text,{name:$('#svg-asset-name').value.trim()||'SVG 자산',sourceUrl:$('#svg-source-url').value.trim(),normalizeColor:$('#svg-normalize-color').checked});closeDialog('#svg-paste-dialog');}catch(err){toast(err.message||'SVG를 추가하지 못했습니다.','error');setStatus('SVG 가져오기 실패');}});

$('#export-dialog').addEventListener('click',async e=>{
  const b=e.target.closest('[data-export]');if(!b)return;const format=b.dataset.export;const background=$('#export-background').checked;const scale=Number($('#export-scale').value)||2;doc.settings.exportBackground=background;doc.settings.exportScale=scale;scheduleSave();
  try{b.disabled=true;if(format==='svg')exportSvg(doc,{background});else if(format==='png'||format==='webp')await exportRaster(doc,format,{background,scale});else if(format==='html')exportHtml(doc,{background});else if(format==='json')exportJson(doc);else if(format==='copy-svg'){await copySvg(doc,{background});toast('SVG 코드를 클립보드에 복사했습니다.','success');}setStatus(`${format.toUpperCase()} 내보내기 완료`);}catch(err){console.error(err);toast(err.message||'내보내기에 실패했습니다.','error');}finally{b.disabled=false;}
});

$('#command-input').addEventListener('input',renderCommands);$('#command-results').addEventListener('click',e=>{const b=e.target.closest('[data-command-index]');if(!b)return;const item=cmdResults[Number(b.dataset.commandIndex)];closeDialog('#command-dialog');item?.run();});

$$('dialog [data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close();}));

window.addEventListener('keydown',e=>{
  const input=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable;
  if(e.code==='Space'&&!input){spaceDown=true;document.body.classList.add('is-panning');e.preventDefault();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openCommands();return;}
  if(input)return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'){e.preventDefault();selection={nodeIds:doc.nodes.map(n=>n.id),edgeId:null};render();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='c'){e.preventDefault();copySelection();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();duplicateSelection();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveCurrentProject();}
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteSelection();}
  if(e.key==='Enter'&&selection.nodeIds.length===1){e.preventDefault();editSelectedLabel();}
  if(e.key==='Escape'){connectPreview=null;marquee=null;gesture=null;renderCanvas();}
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&selection.nodeIds.length){e.preventDefault();const step=e.shiftKey?doc.settings.gridSize:1;const prev=snapshot();selectedNodes().forEach(n=>{if(e.key==='ArrowLeft')n.x-=step;if(e.key==='ArrowRight')n.x+=step;if(e.key==='ArrowUp')n.y-=step;if(e.key==='ArrowDown')n.y+=step;});pushHistory(prev);scheduleSave();renderCanvas();}
});

window.addEventListener('paste',async e=>{
  const input=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable;if(input)return;
  const text=e.clipboardData?.getData('text/plain')?.trim()||'';
  if(/^<svg[\s>]/i.test(text)){e.preventDefault();try{await importSvgText(text,{name:'붙여넣은 SVG'});}catch(err){toast(err.message||'SVG를 붙여넣지 못했습니다.','error');}return;}
  if(text.startsWith('{')){try{const payload=JSON.parse(text);if(payload?.type==='nodeweave-selection'&&Array.isArray(payload.nodes)){e.preventDefault();internalClipboard=payload;pasteSelection(payload);return;}}catch{}}
  if(internalClipboard){e.preventDefault();pasteSelection();}
});

window.addEventListener('keyup',e=>{if(e.code==='Space'){spaceDown=false;document.body.classList.remove('is-panning');}});
window.addEventListener('resize',()=>renderCanvas());

if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

render();setTimeout(fitView,80);if(initialSharedDoc)setTimeout(()=>toast('공유 링크에서 다이어그램을 열었습니다. 편집본은 이 브라우저에 저장됩니다.','success'),120);
