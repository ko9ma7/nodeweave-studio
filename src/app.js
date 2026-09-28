import { BUILTIN_ICONS, DEFAULT_SETTINGS, SHAPES, THEMES, TEMPLATES } from './catalog.js';
import { clamp, diagramStyleDefs, edgeGeometry, esc, nearestPort, nodeBounds, nodeTextMarkup, portsMarkup, resolveNodeStyle, selectionRectMarkup, shapePrimitive } from './geometry.js';
import { copySvg, exportHtml, exportJson, exportRaster, exportSvg } from './export.js';
import { deleteProject, listProjects, loadAutosave, loadUiPrefs, saveAutosave, saveProject, saveUiPrefs } from './storage.js';
import { loadStylePacks } from './style-loader.js';

await loadStylePacks();

const $=(q,root=document)=>root.querySelector(q);
const $$=(q,root=document)=>[...root.querySelectorAll(q)];
const canvas=$('#diagram-canvas');
const viewportEl=$('#canvas-viewport');
const statusEl=$('#status-text');
const toastRegion=$('#toast-region');

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
  const s=n.type==='custom-svg'?{w:180,h:140,label:'Custom SVG'}:shapeById(n.type);return {id:n.id||uid('node'),type:n.type||'process',x:Number(n.x)||0,y:Number(n.y)||0,w:Number(n.w)||s.w,h:Number(n.h)||s.h,label:n.label??s.label,style:n.style?{...n.style}:{},...(n.customSvg?{customSvg:deepClone(n.customSvg)}:{})};
}
function normalizeEdge(e){return {id:e.id||uid('edge'),source:e.source,target:e.target,sourcePort:e.sourcePort||'right',targetPort:e.targetPort||'left',label:e.label||'',routing:e.routing||'orthogonal',style:e.style?{...e.style}:{}};}
function normalizeDoc(doc){
  const base=defaultDocument(); if(!doc||!Array.isArray(doc.nodes)||!Array.isArray(doc.edges))return base;
  return {version:1,meta:{...base.meta,...doc.meta,updatedAt:new Date().toISOString()},nodes:doc.nodes.map(normalizeNode),edges:doc.edges.map(normalizeEdge),tokens:{...base.tokens,...doc.tokens},themeId:doc.themeId||'minimal',settings:{...DEFAULT_SETTINGS,...doc.settings}};
}

let doc=normalizeDoc(loadAutosave()||defaultDocument());
let selection={nodeIds:[],edgeId:null};
let viewport={x:80,y:70,scale:1};
let undoStack=[],redoStack=[];
let gesture=null, connectPreview=null, marquee=null, spaceDown=false;
const desktopPanels=window.innerWidth>900;
let leftOpen=desktopPanels,rightOpen=desktopPanels;
let autosaveTimer=null;
let paletteQuery='';
let libraryTab='shapes';
let inspectorTab='selection';
let internalClipboard=null;
const uiPrefs=loadUiPrefs();

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

function addNode(type,point=viewportCenterWorld()){
  const shape=shapeById(type); const node={id:uid('node'),type,x:snap(point.x-shape.w/2),y:snap(point.y-shape.h/2),w:shape.w,h:shape.h,label:shape.label,style:{}};
  commit(()=>{doc.nodes.push(node);selection={nodeIds:[node.id],edgeId:null};},`${shape.label} 추가`);
}
function addBuiltinIcon(id,point=viewportCenterWorld()){
  const item=iconById(id),isBlock=item.mode==='block',w=Number(item.w)||112,h=Number(item.h)||112;
  const node={id:uid('node'),type:'custom-svg',x:snap(point.x-w/2),y:snap(point.y-h/2),w,h,label:isBlock?(item.defaultText||item.label):'',style:{iconColor:doc.tokens.text,padding:isBlock?2:10},customSvg:{viewBox:item.viewBox,content:item.content,name:item.label,origin:item._managed?'managed-catalog':'nodeweave-symbols',mode:item.mode||'icon',labelPosition:item.labelPosition||'center',sourceUrl:item.sourceUrl||''}};
  commit(()=>{doc.nodes.push(node);selection={nodeIds:[node.id],edgeId:null};},`${item.label} SVG 추가`);
}
function moveSelectionZ(mode){if(!selection.nodeIds.length)return;commit(()=>{const ids=new Set(selection.nodeIds),picked=doc.nodes.filter(n=>ids.has(n.id)),rest=doc.nodes.filter(n=>!ids.has(n.id));doc.nodes=mode==='front'?[...rest,...picked]:[...picked,...rest];},mode==='front'?'맨 앞으로':'맨 뒤로');}
function selectionPayload(){const ids=new Set(selection.nodeIds);return {type:'nodeweave-selection',version:1,nodes:selectedNodes().map(deepClone),edges:doc.edges.filter(e=>ids.has(e.source)&&ids.has(e.target)).map(deepClone)};}
async function copySelection(){if(!selection.nodeIds.length)return;internalClipboard=selectionPayload();try{await navigator.clipboard?.writeText(JSON.stringify(internalClipboard));}catch{}toast(`${selection.nodeIds.length}개 요소를 복사했습니다.`,'success');}
function pasteSelection(payload=internalClipboard){if(!payload?.nodes?.length)return;const prev=snapshot(),map=new Map();const clones=payload.nodes.map(n=>{const id=uid('node');map.set(n.id,id);return normalizeNode({...deepClone(n),id,x:n.x+36,y:n.y+36});});const edges=(payload.edges||[]).filter(e=>map.has(e.source)&&map.has(e.target)).map(e=>normalizeEdge({...deepClone(e),id:uid('edge'),source:map.get(e.source),target:map.get(e.target)}));doc.nodes.push(...clones);doc.edges.push(...edges);selection={nodeIds:clones.map(n=>n.id),edgeId:null};internalClipboard=selectionPayload();pushHistory(prev);scheduleSave();render();toast('복사한 요소를 붙여넣었습니다.','success');}
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
  const g=edgeGeometry(edge,doc.nodes);if(!g)return'';const selected=selection.edgeId===edge.id;const stroke=edge.style?.stroke??(selected?doc.tokens.primary:doc.tokens.edge);const width=edge.style?.width??1.8;const dash=edge.style?.dash??'';const arrow=edge.style?.arrow!==false;
  return `<g class="edge-group${selected?' is-selected':''}" data-edge-id="${esc(edge.id)}">
    <path class="edge-hit" d="${g.d}" fill="none" stroke="transparent" stroke-width="16" vector-effect="non-scaling-stroke"/>
    <path class="edge-line" d="${g.d}" fill="none" stroke="${esc(stroke)}" stroke-width="${selected?Math.max(width,2.4):width}" ${dash?`stroke-dasharray="${esc(dash)}"`:''} ${arrow?'marker-end="url(#editor-arrow)"':''} vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>
    ${edge.label?`<text x="${g.label.x}" y="${g.label.y-8}" fill="${esc(doc.tokens.text)}" font-size="12" font-weight="700" text-anchor="middle" paint-order="stroke" stroke="${esc(doc.tokens.canvas)}" stroke-width="5" stroke-linejoin="round" pointer-events="none">${esc(edge.label)}</text>`:''}
  </g>`;
}
function nodeMarkup(node){
  const selected=selection.nodeIds.includes(node.id);return `<g class="diagram-node${selected?' is-selected':''}" data-node-id="${esc(node.id)}" tabindex="0" role="button" aria-label="${esc(node.label)}">
    ${shapePrimitive(node,doc.tokens)}${nodeTextMarkup(node,doc.tokens,{selected})}
    ${selected?selectionRectMarkup(node,doc.tokens)+portsMarkup(node,doc.tokens):''}
  </g>`;
}
function canvasPatternStyle(){
  const p=doc.tokens.pattern||'grid',g=doc.tokens.grid||'#dfe3ea',a=doc.tokens.accent||doc.tokens.primary;
  if(p==='none')return 'none';
  if(p==='dots'||p==='softdots')return `radial-gradient(circle at 1px 1px, ${g} 1px, transparent 1.4px)`;
  if(p==='scanlines')return `repeating-linear-gradient(0deg, transparent 0 5px, ${g}55 6px)`;
  if(p==='paper')return `linear-gradient(${g}55 1px,transparent 1px),linear-gradient(90deg,${g}55 1px,transparent 1px)`;
  if(p==='lines')return `repeating-linear-gradient(0deg,transparent 0 31px,${g}66 32px)`;
  if(p==='speed')return `repeating-linear-gradient(135deg,transparent 0 28px,${g}55 29px,${g}55 31px,transparent 32px)`;
  if(p==='pixel')return `linear-gradient(${g}88 2px,transparent 2px),linear-gradient(90deg,${g}88 2px,transparent 2px)`;
  if(['spark','confetti','memphis'].includes(p))return `radial-gradient(circle at 20% 22%,${a}55 0 3px,transparent 4px),radial-gradient(circle at 78% 68%,${doc.tokens.primary}44 0 4px,transparent 5px)`;
  if(['orb','blob'].includes(p))return `radial-gradient(circle at 18% 15%,${doc.tokens.primary}24,transparent 32%),radial-gradient(circle at 84% 76%,${a}20,transparent 34%)`;
  if(p==='constellation')return `radial-gradient(circle,${a}66 0 1px,transparent 1.5px)`;
  if(p==='perspective')return `linear-gradient(${g}66 1px,transparent 1px),linear-gradient(90deg,${g}66 1px,transparent 1px)`;
  if(p==='hud')return `linear-gradient(${g}55 1px,transparent 1px),linear-gradient(90deg,${g}55 1px,transparent 1px),radial-gradient(circle at 50% 50%,transparent 55%,${a}12 100%)`;
  if(p==='bauhaus')return `radial-gradient(circle at 85% 15%,${doc.tokens.primary}18 0 70px,transparent 72px),linear-gradient(45deg,transparent 47%,${a}16 48% 52%,transparent 53%)`;
  return `linear-gradient(${g} 1px,transparent 1px),linear-gradient(90deg,${g} 1px,transparent 1px)`;
}

function renderCanvas(){
  const gridSize=doc.settings.gridSize*viewport.scale;
  canvas.style.setProperty('--canvas-bg',doc.tokens.canvas);
  canvas.style.setProperty('--grid-color',doc.tokens.grid);
  canvas.style.setProperty('--grid-size',`${Math.max(8,gridSize)}px`);
  canvas.style.backgroundImage=doc.settings.grid?canvasPatternStyle():'none';
  canvas.style.backgroundSize=['dots','softdots','constellation'].includes(doc.tokens.pattern)?`${Math.max(10,gridSize)}px ${Math.max(10,gridSize)}px`:['scanlines','lines','speed'].includes(doc.tokens.pattern)?'100% 12px':`${Math.max(8,gridSize)}px ${Math.max(8,gridSize)}px`;
  canvas.classList.toggle('grid-off',!doc.settings.grid);
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

function paletteIcon(shape){const n={type:shape.id,x:8,y:8,w:64,h:40,label:'',style:{fill:'var(--panel)',stroke:'currentColor',strokeWidth:1.6,radius:8}};return `<svg viewBox="0 0 80 56" aria-hidden="true">${shapePrimitive(n,{...doc.tokens,surface:'transparent',border:'currentColor'})}</svg>`;}
function builtinIconPreview(item){return `<svg viewBox="${esc(item.viewBox)}" aria-hidden="true" color="currentColor">${item.content}</svg>`;}
function setLibraryTab(tab){libraryTab=tab;paletteQuery='';$('#shape-search').value='';renderPalette();}
function renderPalette(){
  const q=paletteQuery.trim().toLowerCase(),shapes=SHAPES.filter(x=>!q||`${x.label} ${x.category} ${x.keywords}`.toLowerCase().includes(q)),icons=BUILTIN_ICONS.filter(x=>!q||`${x.label} ${x.category} ${x.keywords}`.toLowerCase().includes(q)),templates=TEMPLATES.filter(x=>!q||`${x.name} ${x.category} ${x.keywords}`.toLowerCase().includes(q));
  const sg=new Map();shapes.forEach(x=>{if(!sg.has(x.category))sg.set(x.category,[]);sg.get(x.category).push(x);});
  $('#shape-list').innerHTML=shapes.length?[...sg].map(([cat,items])=>`<section class="palette-group"><h3>${esc(cat)}</h3><div class="shape-grid">${items.map(x=>`<button class="shape-card" draggable="true" data-shape-id="${x.id}" title="${esc(x.label)} 추가">${paletteIcon(x)}<span>${esc(x.label)}</span></button>`).join('')}</div></section>`).join(''):`<div class="empty-state"><strong>도형을 찾지 못했습니다.</strong></div>`;
  const ig=new Map();icons.forEach(x=>{if(!ig.has(x.category))ig.set(x.category,[]);ig.get(x.category).push(x);});
  $('#icon-list').innerHTML=icons.length?[...ig].map(([cat,items])=>`<section class="palette-group icon-palette-group"><h3>${esc(cat)}</h3><div class="icon-grid">${items.map(x=>`<button class="svg-icon-card" draggable="true" data-icon-id="${x.id}" title="${esc(x.label)} SVG 추가">${builtinIconPreview(x)}<span>${esc(x.label)}</span></button>`).join('')}</div></section>`).join(''):`<div class="empty-state"><strong>SVG 심볼을 찾지 못했습니다.</strong></div>`;
  $('#template-list').innerHTML=templates.length?templates.map(t=>`<button class="template-card" data-template-id="${t.id}"><span class="template-category">${esc(t.category)}</span><strong>${esc(t.name)}</strong><small>${t.nodes.length} nodes · ${t.edges.length} edges</small></button>`).join(''):`<div class="empty-state"><strong>템플릿을 찾지 못했습니다.</strong></div>`;
  $('#shape-section').hidden=libraryTab!=='shapes';$('#icon-section').hidden=libraryTab!=='icons';$('#template-section').hidden=libraryTab!=='templates';$$('.library-tab').forEach(b=>b.classList.toggle('is-active',b.dataset.libraryTab===libraryTab));$('#shape-total').textContent=SHAPES.length;$('#icon-total').textContent=BUILTIN_ICONS.length;$('#template-total').textContent=TEMPLATES.length;$('#shape-search').placeholder=libraryTab==='icons'?'SVG 검색 · server, 보안…':libraryTab==='templates'?'템플릿 검색 · incident, 여정…':'도형 검색 · decision, DB…';
}
function inspectorSelectionHtml(){
  const nodes=selectedNodes();const edge=doc.edges.find(e=>e.id===selection.edgeId);
  if(!nodes.length&&!edge)return `<div class="inspector-empty"><div class="empty-icon">⌁</div><strong>요소를 선택하세요</strong><p>노드나 연결선을 선택하면 크기, 색상, 텍스트, 라우팅을 편집할 수 있습니다.</p><kbd>Ctrl/⌘ K</kbd><span>빠른 검색</span></div>`;
  if(edge){const stroke=edge.style?.stroke??doc.tokens.edge;const width=edge.style?.width??1.8;return `<div class="form-stack"><label>연결선 라벨<input data-edge-prop="label" value="${esc(edge.label)}" placeholder="예: 승인, API"></label><label>라우팅<select data-edge-prop="routing"><option value="orthogonal" ${edge.routing==='orthogonal'?'selected':''}>직각</option><option value="bezier" ${edge.routing==='bezier'?'selected':''}>곡선</option><option value="straight" ${edge.routing==='straight'?'selected':''}>직선</option></select></label><div class="field-row"><label>선 색상<input type="color" data-edge-prop="stroke" value="${stroke.startsWith('#')?stroke:'#64748b'}"></label><label>두께<input type="number" min="1" max="8" step="0.2" data-edge-prop="width" value="${width}"></label></div><label>선 스타일<select data-edge-prop="dash"><option value="" ${(edge.style?.dash??'')===''?'selected':''}>실선</option><option value="7 5" ${edge.style?.dash==='7 5'?'selected':''}>점선</option><option value="2 5" ${edge.style?.dash==='2 5'?'selected':''}>도트</option></select></label><label class="switch-row"><span>화살표</span><input type="checkbox" data-edge-prop="arrow" ${edge.style?.arrow!==false?'checked':''}></label><button class="danger-btn" data-action="delete-selection">연결선 삭제</button></div>`;}
  const first=nodes[0], style=resolveNodeStyle(first,doc.tokens), mixed=nodes.length>1;
  if(!mixed&&first.type==='custom-svg'){const iconColor=first.style?.iconColor??doc.tokens.text,iconBg=first.style?.iconBackground??'#ffffff',meta=first.customSvg||{},source=meta.sourceUrl?`<a class="source-link" href="${esc(meta.sourceUrl)}" target="_blank" rel="noopener noreferrer">원본 SVG 출처 ↗</a>`:'';return `<div class="selection-summary"><strong>${esc(meta.name||'SVG 자산')}</strong><span>${meta.origin==='nodeweave-symbols'?'NodeWeave 기본 SVG 심볼':'가져온 SVG 자산'}</span></div><div class="form-stack svg-inspector"><div class="field-row"><label>아이콘 색상<input type="color" data-node-prop="iconColor" value="${iconColor.startsWith('#')?iconColor:'#172033'}"></label><label>배경 색상<input type="color" data-node-prop="iconBackground" value="${iconBg.startsWith('#')?iconBg:'#ffffff'}"></label></div><div class="field-row"><label>회전<input type="number" min="-360" max="360" step="15" data-node-prop="rotation" value="${Number(first.style?.rotation)||0}"></label><label>내부 여백<input type="number" min="0" max="40" data-node-prop="padding" value="${Number(first.style?.padding)||0}"></label></div><div class="field-row"><label>너비<input type="number" min="32" max="1200" data-node-field="w" value="${Math.round(first.w)}"></label><label>높이<input type="number" min="32" max="800" data-node-field="h" value="${Math.round(first.h)}"></label></div><div class="button-grid"><button data-action="flip-x">좌우 반전</button><button data-action="flip-y">상하 반전</button><button data-action="clear-icon-background">배경 없음</button><button data-action="normalize-svg-color">단색 편집화</button><button data-action="bring-front">맨 앞으로</button><button data-action="send-back">맨 뒤로</button></div>${source}<div class="button-row"><button data-action="duplicate">복제</button><button data-action="copy-selection">복사</button><button class="danger-btn" data-action="delete-selection">삭제</button></div></div>`;}
  return `<div class="selection-summary"><strong>${mixed?`${nodes.length}개 노드 선택`:esc(first.label)}</strong><span>${mixed?'여러 요소에 같은 값을 일괄 적용합니다.':esc(shapeById(first.type).label)}</span></div><div class="form-stack">
    ${!mixed?`<label>텍스트<textarea data-node-prop="label" rows="3">${esc(first.label)}</textarea></label>`:''}
    <div class="field-row"><label>채우기<input type="color" data-node-prop="fill" value="${style.fill.startsWith('#')?style.fill:'#ffffff'}"></label><label>테두리<input type="color" data-node-prop="stroke" value="${style.stroke.startsWith('#')?style.stroke:'#64748b'}"></label></div>
    <div class="field-row"><label>텍스트<input type="color" data-node-prop="text" value="${style.text.startsWith('#')?style.text:'#111827'}"></label><label>선 두께<input type="number" min="0.5" max="8" step="0.1" data-node-prop="strokeWidth" value="${style.strokeWidth}"></label></div>
    <div class="field-row"><label>글자 크기<input type="number" min="9" max="48" step="1" data-node-prop="fontSize" value="${style.fontSize}"></label><label>모서리<input type="number" min="0" max="64" step="1" data-node-prop="radius" value="${style.radius}"></label></div>
    ${!mixed?`<div class="field-row"><label>너비<input type="number" min="48" max="1200" step="1" data-node-field="w" value="${Math.round(first.w)}"></label><label>높이<input type="number" min="40" max="800" step="1" data-node-field="h" value="${Math.round(first.h)}"></label></div>`:''}
    <div class="button-grid"><button data-action="reset-node-style">테마값 복원</button><button data-action="duplicate">복제</button><button data-action="copy-selection">복사</button><button data-action="bring-front">맨 앞으로</button><button data-action="send-back">맨 뒤로</button><button class="danger-btn" data-action="delete-selection">삭제</button></div></div>`;
}
function inspectorThemeHtml(){
  const groups=new Map();
  THEMES.forEach(t=>{const c=t.category||'Core';if(!groups.has(c))groups.set(c,[]);groups.get(c).push(t);});
  const card=t=>'<button class="theme-card style-preview '+(doc.themeId===t.id?'is-active':'')+'" data-theme-id="'+esc(t.id)+'" style="--pv-bg:'+esc(t.tokens.canvas)+';--pv-surface:'+esc(t.tokens.surface)+';--pv-primary:'+esc(t.tokens.primary)+';--pv-border:'+esc(t.tokens.border)+';--pv-radius:'+(Number(t.tokens.radius)||0)+'px"><span class="style-preview-art"><i></i><b></b><em></em></span><strong>'+esc(t.label)+'</strong><small>'+esc(t.description)+'</small></button>';
  const cards=[...groups].map(([cat,items])=>'<section class="style-pack-group"><div class="style-pack-head"><strong>'+esc(cat)+'</strong><span>'+items.length+'</span></div><div class="theme-grid">'+items.map(card).join('')+'</div></section>').join('');
  return '<div class="style-summary"><strong>'+THEMES.length+' Style Packs</strong><span>색상 · 그림자 · 패턴 · 연결선 · 포트 · 타이포를 함께 변경합니다.</span></div>'+cards+'<div class="form-stack token-editor"><h3>세부 토큰</h3><div class="field-row"><label>캔버스<input type="color" data-token="canvas" value="'+doc.tokens.canvas+'"></label><label>표면<input type="color" data-token="surface" value="'+doc.tokens.surface+'"></label></div><div class="field-row"><label>주요색<input type="color" data-token="primary" value="'+doc.tokens.primary+'"></label><label>텍스트<input type="color" data-token="text" value="'+doc.tokens.text+'"></label></div><div class="field-row"><label>경계<input type="color" data-token="border" value="'+doc.tokens.border+'"></label><label>연결선<input type="color" data-token="edge" value="'+doc.tokens.edge+'"></label></div><label>기본 모서리<input type="range" min="0" max="40" step="1" data-token="radius" value="'+doc.tokens.radius+'"></label><div class="field-row"><label>기본 포트<select data-token="portCount"><option value="0" '+(Number(doc.tokens.portCount)===0?'selected':'')+'>없음</option><option value="4" '+(Number(doc.tokens.portCount??4)===4?'selected':'')+'>4면</option><option value="8" '+(Number(doc.tokens.portCount)===8?'selected':'')+'>8개</option></select></label><label>포트 형태<select data-token="portShape"><option value="circle" '+(doc.tokens.portShape==='circle'?'selected':'')+'>원형</option><option value="square" '+(doc.tokens.portShape==='square'?'selected':'')+'>사각</option><option value="diamond" '+(doc.tokens.portShape==='diamond'?'selected':'')+'>다이아</option></select></label></div></div>';
}
function inspectorLayoutHtml(){return `<div class="form-stack"><h3>자동 레이아웃</h3><label>방향<select id="layout-direction"><option value="LR" ${doc.settings.layoutDirection==='LR'?'selected':''}>왼쪽 → 오른쪽</option><option value="TB" ${doc.settings.layoutDirection==='TB'?'selected':''}>위 → 아래</option></select></label><div class="field-row"><label>가로 간격<input id="layout-hgap" type="number" min="40" max="320" value="${doc.settings.horizontalGap}"></label><label>세로 간격<input id="layout-vgap" type="number" min="30" max="240" value="${doc.settings.verticalGap}"></label></div><button class="primary-btn" data-action="auto-layout">흐름 기준 자동 배치</button><h3>정렬</h3><div class="button-grid"><button data-align="left">왼쪽</button><button data-align="center-x">가운데 X</button><button data-align="top">위쪽</button><button data-align="center-y">가운데 Y</button><button data-align="distribute-x">가로 분배</button><button data-align="distribute-y">세로 분배</button></div><h3>캔버스</h3><label class="switch-row"><span>그리드 표시</span><input type="checkbox" data-setting="grid" ${doc.settings.grid?'checked':''}></label><label class="switch-row"><span>그리드 스냅</span><input type="checkbox" data-setting="snap" ${doc.settings.snap?'checked':''}></label><label>그리드 간격<input type="number" min="8" max="80" step="2" data-setting="gridSize" value="${doc.settings.gridSize}"></label></div>`;}
function renderInspector(){
  $$('.inspector-tab').forEach(b=>b.classList.toggle('is-active',b.dataset.tab===inspectorTab));
  $('#inspector-content').innerHTML=inspectorTab==='theme'?inspectorThemeHtml():inspectorTab==='layout'?inspectorLayoutHtml():inspectorSelectionHtml();
}
function render(){renderCanvas();renderPalette();renderInspector();$('#project-name').value=doc.meta.name;updateUndoButtons();updatePanelState();}

function updatePanelState(){document.body.classList.toggle('left-closed',!leftOpen);document.body.classList.toggle('right-closed',!rightOpen);}
function zoomAt(factor,clientX,clientY){const before=clientToWorld(clientX,clientY);viewport.scale=clamp(viewport.scale*factor,.2,3.5);const r=canvas.getBoundingClientRect();viewport.x=clientX-r.left-before.x*viewport.scale;viewport.y=clientY-r.top-before.y*viewport.scale;renderCanvas();}
function zoomCenter(factor){const r=canvas.getBoundingClientRect();zoomAt(factor,r.left+r.width/2,r.top+r.height/2);}
function fitView(){const b=nodeBounds(doc.nodes,70);const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;const s=clamp(Math.min(r.width/b.w,r.height/b.h),.2,1.5);viewport.scale=s;viewport.x=(r.width-b.w*s)/2-b.x*s;viewport.y=(r.height-b.h*s)/2-b.y*s;renderCanvas();}

function autoLayout(){
  const prev=snapshot();const dir=$('#layout-direction')?.value||doc.settings.layoutDirection;const hGap=Number($('#layout-hgap')?.value)||doc.settings.horizontalGap;const vGap=Number($('#layout-vgap')?.value)||doc.settings.verticalGap;doc.settings.layoutDirection=dir;doc.settings.horizontalGap=hGap;doc.settings.verticalGap=vGap;
  const nodes=doc.nodes.filter(n=>!['group','swimlane'].includes(n.type));if(!nodes.length)return;
  const ids=new Set(nodes.map(n=>n.id)),indeg=new Map(nodes.map(n=>[n.id,0])),adj=new Map(nodes.map(n=>[n.id,[]]));
  doc.edges.forEach(e=>{if(ids.has(e.source)&&ids.has(e.target)){adj.get(e.source).push(e.target);indeg.set(e.target,(indeg.get(e.target)||0)+1);}});
  const q=nodes.filter(n=>indeg.get(n.id)===0).map(n=>n.id);if(!q.length)q.push(nodes[0].id);const rank=new Map(q.map(id=>[id,0]));const seen=new Set();
  while(q.length){const id=q.shift();seen.add(id);for(const t of adj.get(id)||[]){rank.set(t,Math.max(rank.get(t)||0,(rank.get(id)||0)+1));indeg.set(t,indeg.get(t)-1);if(indeg.get(t)<=0&&!seen.has(t))q.push(t);}}
  nodes.forEach(n=>{if(!rank.has(n.id))rank.set(n.id,0);});const groups=new Map();nodes.forEach(n=>{const r=rank.get(n.id);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(n);});const ranks=[...groups.keys()].sort((a,b)=>a-b);const maxW=Math.max(...nodes.map(n=>n.w)),maxH=Math.max(...nodes.map(n=>n.h));
  ranks.forEach((r,ri)=>{const items=groups.get(r);items.forEach((n,i)=>{if(dir==='LR'){n.x=80+ri*(maxW+hGap);n.y=80+i*(maxH+vGap);}else{n.x=80+i*(maxW+hGap);n.y=80+ri*(maxH+vGap);}});});
  pushHistory(prev);scheduleSave();render();fitView();toast('연결 흐름을 기준으로 자동 배치했습니다.','success');
}
function alignSelection(mode){const nodes=selectedNodes();if(nodes.length<2){toast('두 개 이상의 노드를 선택하세요.');return;}commit(()=>{if(mode==='left'){const v=Math.min(...nodes.map(n=>n.x));nodes.forEach(n=>n.x=v);}if(mode==='center-x'){const c=nodes.reduce((a,n)=>a+n.x+n.w/2,0)/nodes.length;nodes.forEach(n=>n.x=c-n.w/2);}if(mode==='top'){const v=Math.min(...nodes.map(n=>n.y));nodes.forEach(n=>n.y=v);}if(mode==='center-y'){const c=nodes.reduce((a,n)=>a+n.y+n.h/2,0)/nodes.length;nodes.forEach(n=>n.y=c-n.h/2);}if(mode==='distribute-x'){const s=[...nodes].sort((a,b)=>a.x-b.x),min=s[0].x,max=s.at(-1).x;const gap=(max-min)/(s.length-1);s.forEach((n,i)=>n.x=min+gap*i);}if(mode==='distribute-y'){const s=[...nodes].sort((a,b)=>a.y-b.y),min=s[0].y,max=s.at(-1).y;const gap=(max-min)/(s.length-1);s.forEach((n,i)=>n.y=min+gap*i);}},'정렬');}

function loadTemplate(id){const t=TEMPLATES.find(x=>x.id===id);if(!t)return;const theme=themeById(t.theme);commit(()=>{doc.nodes=t.nodes.map(n=>normalizeNode(deepClone(n)));doc.edges=t.edges.map(e=>normalizeEdge(deepClone(e)));doc.tokens=deepClone(theme.tokens);doc.themeId=theme.id;doc.meta={...doc.meta,projectId:uid('project'),name:t.name,updatedAt:new Date().toISOString()};selection={nodeIds:[],edgeId:null};},'템플릿 적용');setTimeout(fitView,0);}
function applyTheme(id){const t=themeById(id);commit(()=>{doc.tokens=deepClone(t.tokens);doc.themeId=t.id;},`${t.label} 스타일 적용`);}

function sanitizeSvgSource(text,prefix,{normalizeColor=false}={}){
  const parsed=new DOMParser().parseFromString(text,'image/svg+xml');if(parsed.querySelector('parsererror'))throw new Error('SVG 문법을 읽을 수 없습니다.');const root=parsed.documentElement;if(root.nodeName.toLowerCase()!=='svg')throw new Error('SVG 파일이 아닙니다.');
  const allowed=new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','defs','lineargradient','radialgradient','stop','clippath','mask','title','desc','use']),attrs=new Set(['id','d','x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','width','height','points','fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-dasharray','opacity','transform','offset','stop-color','stop-opacity','gradientunits','gradienttransform','viewbox','preserveaspectratio','clip-path','mask','href','xlink:href']);
  for(const el of [...root.querySelectorAll('*')]){if(!allowed.has(el.nodeName.toLowerCase())){el.remove();continue;}for(const a of [...el.attributes]){const name=a.name.toLowerCase(),value=a.value.trim();if(!attrs.has(name)||name.startsWith('on')||/javascript:/i.test(value)||/url\((?!['"]?#)/i.test(value)||(name==='href'||name==='xlink:href')&&!value.startsWith('#'))el.removeAttribute(a.name);}}
  if(normalizeColor)for(const el of root.querySelectorAll('*')){const fill=el.getAttribute('fill'),stroke=el.getAttribute('stroke');if(fill&&!/^(none|transparent|currentColor)$/i.test(fill)&&!/^url\(/i.test(fill))el.setAttribute('fill','currentColor');if(stroke&&!/^(none|transparent|currentColor)$/i.test(stroke)&&!/^url\(/i.test(stroke))el.setAttribute('stroke','currentColor');}
  const idMap=new Map();for(const el of root.querySelectorAll('[id]')){const old=el.id,nw=`${prefix}-${old.replace(/[^a-zA-Z0-9_-]/g,'')||'id'}`;idMap.set(old,nw);el.id=nw;}for(const el of root.querySelectorAll('*'))for(const a of [...el.attributes]){let v=a.value;for(const [old,nw] of idMap)v=v.replaceAll(`url(#${old})`,`url(#${nw})`).replaceAll(`#${old}`,`#${nw}`);el.setAttribute(a.name,v);}
  return {viewBox:root.getAttribute('viewBox')||`0 0 ${Number(root.getAttribute('width'))||100} ${Number(root.getAttribute('height'))||100}`,content:root.innerHTML};
}
function cleanSourceUrl(value=''){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return'';}}
function importSvgText(text,{name='SVG 자산',sourceUrl='',normalizeColor=false,point=viewportCenterWorld()}={}){const safe=sanitizeSvgSource(text,uid('svg'),{normalizeColor}),w=140,h=140,node={id:uid('node'),type:'custom-svg',x:snap(point.x-w/2),y:snap(point.y-h/2),w,h,label:'',style:{iconColor:doc.tokens.text,padding:8},customSvg:{...safe,name:name||'SVG 자산',origin:'user-import',sourceUrl:cleanSourceUrl(sourceUrl)}};commit(()=>{doc.nodes.push(node);selection={nodeIds:[node.id],edgeId:null};},'SVG 자산 추가');toast('안전 필터를 거쳐 SVG 자산을 추가했습니다.','success');return node;}
async function importSvgShape(file,point=viewportCenterWorld()){return importSvgText(await file.text(),{name:file.name.replace(/\.svg$/i,'')||'SVG 자산',point});}
function normalizeSelectedSvgColor(){const node=selectedNodes()[0];if(!node||node.type!=='custom-svg')return;const safe=sanitizeSvgSource(`<svg viewBox="${node.customSvg.viewBox}">${node.customSvg.content}</svg>`,uid('color'),{normalizeColor:true});commit(()=>{node.customSvg={...node.customSvg,...safe};node.style={...node.style,iconColor:node.style?.iconColor??doc.tokens.text};},'SVG 색상 편집 가능');}
function openSvgPaste(){openDialog('#svg-paste-dialog');$('#svg-paste-input').value='';$('#svg-asset-name').value='';$('#svg-source-url').value='';$('#svg-normalize-color').checked=false;setTimeout(()=>$('#svg-paste-input').focus(),0);}

function openDialog(id){const d=$(id);if(d?.showModal)d.showModal();}
function closeDialog(id){$(id)?.close?.();}
function editSelectedLabel(){const nodes=selectedNodes();if(nodes.length!==1)return;$('#edit-label-input').value=nodes[0].label;openDialog('#label-dialog');setTimeout(()=>$('#edit-label-input').focus(),0);}
function openExport(){ $('#export-background').checked=doc.settings.exportBackground;$('#export-scale').value=doc.settings.exportScale;openDialog('#export-dialog'); }
function openProjects(){renderProjects();openDialog('#project-dialog');}
function renderProjects(){const list=listProjects();$('#saved-projects').innerHTML=list.length?list.map(p=>`<div class="saved-project"><button data-load-project="${esc(p.id)}"><strong>${esc(p.name)}</strong><span>${new Date(p.updatedAt).toLocaleString('ko-KR')}</span></button><button class="icon-btn danger-icon" data-delete-project="${esc(p.id)}" aria-label="저장본 삭제">×</button></div>`).join(''):`<div class="empty-state"><strong>저장된 프로젝트가 없습니다.</strong><span>현재 프로젝트를 저장하면 여기에 표시됩니다.</span></div>`;}
function saveCurrentProject(){const item=saveProject(doc.meta.name,snapshot());doc.meta.projectId=item.id;scheduleSave();renderProjects();toast('브라우저에 프로젝트를 저장했습니다.','success');}

function commandItems(query=''){
  const q=query.trim().toLowerCase();const items=[];
  SHAPES.forEach(s=>items.push({kind:'도형',title:s.label,keywords:s.keywords,run:()=>addNode(s.id)}));
  BUILTIN_ICONS.forEach(i=>items.push({kind:'SVG',title:i.label,keywords:i.keywords,run:()=>addBuiltinIcon(i.id)}));
  TEMPLATES.forEach(t=>items.push({kind:'템플릿',title:t.name,keywords:t.keywords,run:()=>loadTemplate(t.id)}));
  THEMES.forEach(t=>items.push({kind:'스타일',title:t.label,keywords:t.description,run:()=>applyTheme(t.id)}));
  items.push({kind:'명령',title:'자동 레이아웃',keywords:'layout arrange 정렬',run:autoLayout},{kind:'명령',title:'화면에 맞추기',keywords:'fit zoom view',run:fitView},{kind:'명령',title:'SVG 붙여넣기',keywords:'svg paste icon asset 붙여넣기',run:openSvgPaste},{kind:'명령',title:'내보내기',keywords:'export svg png webp html json',run:openExport},{kind:'명령',title:'프로젝트 저장',keywords:'save local project',run:saveCurrentProject});
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
  else if(gesture.type==='resize'){const n=doc.nodes.find(x=>x.id===gesture.nodeId),i=gesture.initial;let dx=p.x-gesture.start.x,dy=p.y-gesture.start.y;let x=i.x,y=i.y,w=i.w,h=i.h;if(gesture.handle.includes('e'))w=Math.max(48,i.w+dx);if(gesture.handle.includes('s'))h=Math.max(40,i.h+dy);if(gesture.handle.includes('w')){w=Math.max(48,i.w-dx);x=i.x+i.w-w;}if(gesture.handle.includes('n')){h=Math.max(40,i.h-dy);y=i.y+i.h-h;}n.x=snap(x);n.y=snap(y);n.w=snap(w);n.h=snap(h);renderCanvas();}
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
canvas.addEventListener('drop',async e=>{e.preventDefault();const point=clientToWorld(e.clientX,e.clientY),type=e.dataTransfer.getData('application/x-nodeweave-shape'),iconId=e.dataTransfer.getData('application/x-nodeweave-icon');if(type){addNode(type,point);return;}if(iconId){addBuiltinIcon(iconId,point);return;}const file=[...e.dataTransfer.files].find(f=>f.type==='image/svg+xml'||/\.svg$/i.test(f.name));if(file)try{await importSvgShape(file,point);}catch(err){toast(err.message||'SVG를 가져오지 못했습니다.','error');}});

$('#left-panel').addEventListener('dragstart',e=>{const shape=e.target.closest('[data-shape-id]'),icon=e.target.closest('[data-icon-id]');if(shape)e.dataTransfer.setData('application/x-nodeweave-shape',shape.dataset.shapeId);if(icon)e.dataTransfer.setData('application/x-nodeweave-icon',icon.dataset.iconId);});
$('#left-panel').addEventListener('click',e=>{const tab=e.target.closest('[data-library-tab]');if(tab){setLibraryTab(tab.dataset.libraryTab);return;}const shape=e.target.closest('[data-shape-id]');if(shape)addNode(shape.dataset.shapeId);const icon=e.target.closest('[data-icon-id]');if(icon)addBuiltinIcon(icon.dataset.iconId);const tpl=e.target.closest('[data-template-id]');if(tpl)loadTemplate(tpl.dataset.templateId);if(e.target.closest('#paste-svg-btn'))openSvgPaste();});
$('#shape-search').addEventListener('input',e=>{paletteQuery=e.target.value;renderPalette();});

$('#inspector').addEventListener('click',e=>{
  const tab=e.target.closest('[data-tab]');if(tab){inspectorTab=tab.dataset.tab;renderInspector();return;}
  const theme=e.target.closest('[data-theme-id]');if(theme){applyTheme(theme.dataset.themeId);return;}
  const act=e.target.closest('[data-action]')?.dataset.action;if(act==='delete-selection')deleteSelection();if(act==='duplicate')duplicateSelection();if(act==='copy-selection')copySelection();if(act==='reset-node-style')commit(()=>selectedNodes().forEach(n=>n.style={}),'스타일 복원');if(act==='auto-layout')autoLayout();if(act==='bring-front')moveSelectionZ('front');if(act==='send-back')moveSelectionZ('back');if(act==='flip-x')commit(()=>selectedNodes().forEach(n=>n.style={...n.style,flipX:!n.style?.flipX}),'좌우 반전');if(act==='flip-y')commit(()=>selectedNodes().forEach(n=>n.style={...n.style,flipY:!n.style?.flipY}),'상하 반전');if(act==='clear-icon-background')commit(()=>selectedNodes().forEach(n=>n.style={...n.style,iconBackground:'transparent'}),'SVG 배경 제거');if(act==='normalize-svg-color')normalizeSelectedSvgColor();
  const align=e.target.closest('[data-align]');if(align)alignSelection(align.dataset.align);
});
$('#inspector').addEventListener('change',e=>{
  const el=e.target;
  if(el.dataset.nodeProp){const key=el.dataset.nodeProp;let value=el.type==='checkbox'?el.checked:el.value;if(['strokeWidth','fontSize','radius','rotation','padding','opacity'].includes(key))value=Number(value);commit(()=>selectedNodes().forEach(n=>{if(key==='label')n.label=value;else n.style={...n.style,[key]:value};}),`노드 ${key} 변경`);}
  if(el.dataset.nodeField){const key=el.dataset.nodeField,value=Math.max(20,Number(el.value)||0);commit(()=>selectedNodes().forEach(n=>n[key]=value),`노드 크기 변경`);}
  if(el.dataset.edgeProp){const edge=doc.edges.find(x=>x.id===selection.edgeId);if(!edge)return;const key=el.dataset.edgeProp;let value=el.type==='checkbox'?el.checked:el.value;if(key==='width')value=Number(value);commit(()=>{if(['label','routing'].includes(key))edge[key]=value;else edge.style={...edge.style,[key]:value};},`연결선 ${key} 변경`);}
  if(el.dataset.token){const key=el.dataset.token;const value=['radius','nodeStrokeWidth'].includes(key)?Number(el.value):el.value;commit(()=>{doc.tokens[key]=value;doc.themeId='custom';},`토큰 ${key} 변경`);}
  if(el.dataset.setting){const key=el.dataset.setting,value=el.type==='checkbox'?el.checked:Number(el.value);commit(()=>doc.settings[key]=value,`설정 ${key} 변경`);}
});

$('#project-name').addEventListener('change',e=>commit(()=>doc.meta.name=e.target.value.trim()||'Untitled diagram','프로젝트 이름 변경'));
$('#undo-btn').addEventListener('click',undo);$('#redo-btn').addEventListener('click',redo);$('#fit-btn').addEventListener('click',fitView);$('#zoom-in-btn').addEventListener('click',()=>zoomCenter(1.15));$('#zoom-out-btn').addEventListener('click',()=>zoomCenter(.87));$('#mobile-fit-btn').addEventListener('click',fitView);$('#mobile-zoom-in-btn').addEventListener('click',()=>zoomCenter(1.15));$('#mobile-zoom-out-btn').addEventListener('click',()=>zoomCenter(.87));
$('#auto-layout-btn').addEventListener('click',()=>{inspectorTab='layout';rightOpen=true;render();setTimeout(autoLayout,0);});
$('#export-btn').addEventListener('click',openExport);$('#project-btn').addEventListener('click',openProjects);$('#command-btn').addEventListener('click',openCommands);
$('#left-toggle').addEventListener('click',()=>{leftOpen=!leftOpen;updatePanelState();});$('#right-toggle').addEventListener('click',()=>{rightOpen=!rightOpen;updatePanelState();});
$('#ui-theme-btn').addEventListener('click',()=>{const modes=['system','light','dark'];const next=modes[(modes.indexOf(uiPrefs.theme)+1)%modes.length];applyUiTheme(next);});

$('#label-form').addEventListener('submit',e=>{e.preventDefault();const nodes=selectedNodes();if(nodes.length===1){const value=$('#edit-label-input').value.trim()||'텍스트';commit(()=>nodes[0].label=value,'텍스트 변경');}closeDialog('#label-dialog');});
$('#project-save-btn').addEventListener('click',saveCurrentProject);
$('#project-new-btn').addEventListener('click',()=>{const fresh=defaultDocument();fresh.nodes=[];fresh.edges=[];fresh.meta.name='새 다이어그램';pushHistory(snapshot());doc=fresh;selection={nodeIds:[],edgeId:null};scheduleSave();render();closeDialog('#project-dialog');fitView();});
$('#saved-projects').addEventListener('click',e=>{const load=e.target.closest('[data-load-project]');if(load){const item=listProjects().find(p=>p.id===load.dataset.loadProject);if(item){pushHistory(snapshot());doc=normalizeDoc(item.doc);selection={nodeIds:[],edgeId:null};scheduleSave();render();closeDialog('#project-dialog');setTimeout(fitView,0);}}const del=e.target.closest('[data-delete-project]');if(del){deleteProject(del.dataset.deleteProject);renderProjects();}});

$('#import-input').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const parsed=JSON.parse(await file.text());const next=normalizeDoc(parsed);pushHistory(snapshot());doc=next;selection={nodeIds:[],edgeId:null};scheduleSave();render();closeDialog('#project-dialog');setTimeout(fitView,0);toast('프로젝트를 불러왔습니다.','success');}catch(err){toast('올바른 NodeWeave JSON 파일이 아닙니다.','error');}e.target.value='';});

$('#svg-import-input').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{await importSvgShape(file);closeDialog('#project-dialog');}catch(err){toast(err.message||'SVG 도형을 가져오지 못했습니다.','error');}e.target.value='';});
$('#svg-paste-form').addEventListener('submit',e=>{e.preventDefault();try{const text=$('#svg-paste-input').value.trim();if(!text)throw new Error('SVG 코드를 입력하세요.');importSvgText(text,{name:$('#svg-asset-name').value.trim()||'SVG 자산',sourceUrl:$('#svg-source-url').value.trim(),normalizeColor:$('#svg-normalize-color').checked});closeDialog('#svg-paste-dialog');}catch(err){toast(err.message||'SVG를 추가하지 못했습니다.','error');}});

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
window.addEventListener('paste',e=>{const input=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable;if(input)return;const text=e.clipboardData?.getData('text/plain')?.trim()||'';if(/^<svg[\s>]/i.test(text)){e.preventDefault();try{importSvgText(text,{name:'붙여넣은 SVG'});}catch(err){toast(err.message||'SVG를 붙여넣지 못했습니다.','error');}return;}if(text.startsWith('{'))try{const payload=JSON.parse(text);if(payload?.type==='nodeweave-selection'&&Array.isArray(payload.nodes)){e.preventDefault();internalClipboard=payload;pasteSelection(payload);return;}}catch{}if(internalClipboard){e.preventDefault();pasteSelection();}});
window.addEventListener('keyup',e=>{if(e.code==='Space'){spaceDown=false;document.body.classList.remove('is-panning');}});
window.addEventListener('resize',()=>renderCanvas());


async function loadManagedCatalog(){
  const packs=[];
  try{
    const response=await fetch('./catalog/library.json?ts='+Date.now(),{cache:'no-store'});
    if(response.ok)packs.push(await response.json());
  }catch(error){console.warn('[catalog] repository catalog unavailable',error);}
  try{
    const local=localStorage.getItem('nodeweave.catalog.preview.v1');
    if(local)packs.push(JSON.parse(local));
  }catch(error){console.warn('[catalog] local preview invalid',error);}
  const upsert=(list,item)=>{const i=list.findIndex(x=>x.id===item.id);if(i>=0)list[i]=item;else list.push(item);};
  for(const pack of packs){
    for(const raw of Array.isArray(pack?.svgAssets)?pack.svgAssets:[]){
      if(!raw?.id||!raw?.content)continue;
      upsert(BUILTIN_ICONS,{...raw,label:raw.label||raw.id,category:raw.category||'Custom',keywords:raw.keywords||'',viewBox:raw.viewBox||'0 0 100 100',mode:raw.mode||'icon',_managed:true});
    }
    for(const raw of Array.isArray(pack?.templates)?pack.templates:[]){
      if(!raw?.id||!Array.isArray(raw.nodes)||!Array.isArray(raw.edges))continue;
      upsert(TEMPLATES,{...raw,name:raw.name||raw.id,category:raw.category||'Custom',keywords:raw.keywords||'',theme:raw.theme||'minimal'});
    }
  }
}

if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

loadManagedCatalog().finally(()=>{render();setTimeout(fitView,80);});
