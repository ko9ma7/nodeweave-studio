export const esc = (value='') => String(value)
  .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  .replaceAll('"','&quot;').replaceAll("'",'&#39;');

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function resolveNodeStyle(node, tokens) {
  return {
    fill: node.style?.fill ?? (tokens.nodeGradient ? 'url(#nw-node-gradient)' : tokens.surface),
    stroke: node.style?.stroke ?? tokens.border,
    text: node.style?.text ?? tokens.text,
    strokeWidth: node.style?.strokeWidth ?? tokens.nodeStrokeWidth,
    radius: node.style?.radius ?? tokens.radius,
    fontSize: node.style?.fontSize ?? 15,
    fontWeight: node.style?.fontWeight ?? tokens.labelWeight ?? 650,
    opacity: node.style?.opacity ?? 1,
    letterSpacing: node.style?.letterSpacing ?? tokens.labelLetterSpacing ?? 0,
    textTransform: node.style?.textTransform ?? tokens.labelTransform ?? 'none'
  };
}

export function diagramStyleDefs(tokens={}) {
  const start=esc(tokens.gradientStart||tokens.surface||'#ffffff');
  const end=esc(tokens.gradientEnd||tokens.primary||'#eef2ff');
  return `<linearGradient id="nw-node-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${start}"/><stop offset="100%" stop-color="${end}"/></linearGradient>`;
}

function styleFilter(tokens={}) {
  if(!tokens.nodeShadow||tokens.nodeShadow==='none') return '';
  const x=Number(tokens.shadowX)||0,y=Number(tokens.shadowY)||0,b=Math.max(0,Number(tokens.shadowBlur)||0);
  return `filter:drop-shadow(${x}px ${y}px ${b}px ${tokens.shadowColor||'#00000022'});`;
}

export function shapePrimitive(node, tokens, extraClass='') {
  const {x,y,w=180,h=84,type} = node;
  const s = resolveNodeStyle(node,tokens);
  const common = `fill="${esc(s.fill)}" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}" ${tokens.borderDash?`stroke-dasharray="${esc(tokens.borderDash)}"`:''} opacity="${s.opacity}" vector-effect="non-scaling-stroke" style="${styleFilter(tokens)}" class="node-shape ${extraClass}"`;
  const r = Math.max(0, Math.min(s.radius, Math.min(w,h)/2));
  if (type === 'custom-svg' && node.customSvg?.content) {
    const vb=node.customSvg.viewBox||'0 0 100 100';
    const nums=String(vb).trim().split(/[\\s,]+/).map(Number);
    const [vx,vy,vw,vh]=nums.length===4&&nums.every(Number.isFinite)?nums:[0,0,100,100];
    const cx=vx+vw/2,cy=vy+vh/2;
    const rotation=Number(node.style?.rotation)||0;
    const padding=clamp(Number(node.style?.padding)||0,0,40);
    const scale=Math.max(.2,(100-padding*2)/100);
    const sx=(node.style?.flipX?-1:1)*scale,sy=(node.style?.flipY?-1:1)*scale;
    const iconColor=node.style?.iconColor??tokens.text;
    const bg=node.style?.iconBackground??'transparent';
    const bgRect=bg&&bg!=='transparent'?`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(r,Math.min(w,h)/2)}" fill="${esc(bg)}" opacity="${s.opacity}"/>`:'';
    const transform=`translate(${cx} ${cy}) rotate(${rotation}) scale(${sx} ${sy}) translate(${-cx} ${-cy})`;
    return `${bgRect}<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${esc(vb)}" preserveAspectRatio="xMidYMid meet" overflow="visible" color="${esc(iconColor)}" opacity="${s.opacity}" class="node-shape ${extraClass}"><g transform="${transform}">${node.customSvg.content}</g></svg>`;
  }
  if (type === 'decision' || type === 'gateway') {
    const inner=type==='gateway'?`<path d="M ${x+w*.38} ${y+h*.38} L ${x+w*.62} ${y+h*.62} M ${x+w*.62} ${y+h*.38} L ${x+w*.38} ${y+h*.62}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${Math.max(1,s.strokeWidth)}" vector-effect="non-scaling-stroke"/>`:'';
    return `<polygon points="${x+w/2},${y} ${x+w},${y+h/2} ${x+w/2},${y+h} ${x},${y+h/2}" ${common}/>${inner}`;
  }
  if(type==='terminator')return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h/2}" ${common}/>`;
  if(type==='io'){const k=Math.min(24,w*.16);return `<polygon points="${x+k},${y} ${x+w},${y} ${x+w-k},${y+h} ${x},${y+h}" ${common}/>`;}
  if(type==='manual-input'){const k=Math.min(20,h*.28);return `<polygon points="${x},${y+k} ${x+w},${y} ${x+w},${y+h} ${x},${y+h}" ${common}/>`;}
  if(type==='delay'){const rr=h/2;return `<path d="M ${x} ${y} H ${x+w-rr} A ${rr} ${rr} 0 0 1 ${x+w-rr} ${y+h} H ${x} Z" ${common}/>`;}
  if(type==='offpage'){const tip=Math.min(26,h*.28);return `<path d="M ${x} ${y} H ${x+w} V ${y+h-tip} L ${x+w/2} ${y+h} L ${x} ${y+h-tip} Z" ${common}/>`;}
  if(type==='subprocess'){const pad=Math.min(16,w*.09);return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${common}/><path d="M ${x+pad} ${y} V ${y+h} M ${x+w-pad} ${y} V ${y+h}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}" vector-effect="non-scaling-stroke"/>`;}
  if(type==='database'){const ry=Math.min(12,h*.13);return `<path d="M ${x} ${y+ry} A ${w/2} ${ry} 0 0 1 ${x+w} ${y+ry} V ${y+h-ry} A ${w/2} ${ry} 0 0 1 ${x} ${y+h-ry} Z" ${common}/><ellipse cx="${x+w/2}" cy="${y+ry}" rx="${w/2}" ry="${ry}" ${common}/><path d="M ${x} ${y+h-ry} A ${w/2} ${ry} 0 0 0 ${x+w} ${y+h-ry}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}" vector-effect="non-scaling-stroke"/>`;}
  if(type==='table')return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${common}/><path d="M ${x} ${y+h*.28} H ${x+w} M ${x+w*.34} ${y} V ${y+h} M ${x+w*.68} ${y} V ${y+h} M ${x} ${y+h*.52} H ${x+w} M ${x} ${y+h*.76} H ${x+w}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${Math.max(.8,s.strokeWidth*.72)}" opacity=".75" vector-effect="non-scaling-stroke"/>`;
  if(type==='queue')return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(h/2,r+10)}" ${common}/><path d="M ${x+w*.25} ${y+h*.32} H ${x+w*.76} M ${x+w*.25} ${y+h*.5} H ${x+w*.68} M ${x+w*.25} ${y+h*.68} H ${x+w*.58}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${Math.max(1,s.strokeWidth)}" vector-effect="non-scaling-stroke"/>`;
  if(type==='document'){const wave=14,d=`M ${x} ${y} H ${x+w} V ${y+h-wave} C ${x+w*.76} ${y+h-wave*2.1}, ${x+w*.62} ${y+h+wave*.35}, ${x+w*.38} ${y+h-wave} C ${x+w*.2} ${y+h-wave*2.05}, ${x+w*.1} ${y+h+wave*.25}, ${x} ${y+h-wave} Z`;return `<path d="${d}" ${common}/>`;}
  if(type==='folder'){const tw=w*.35,th=Math.min(22,h*.24);return `<path d="M ${x} ${y+th} V ${y+7} H ${x+tw} L ${x+tw+18} ${y+th} H ${x+w} V ${y+h} H ${x} Z" ${common}/>`;}
  if(type==='package'){const top=h*.28;return `<path d="M ${x+w/2} ${y} L ${x+w} ${y+top} V ${y+h-top*.15} L ${x+w/2} ${y+h} L ${x} ${y+h-top*.15} V ${y+top} Z" ${common}/><path d="M ${x} ${y+top} L ${x+w/2} ${y+top*2} L ${x+w} ${y+top} M ${x+w/2} ${y+top*2} V ${y+h}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}" vector-effect="non-scaling-stroke"/>`;}
  if(type==='note'){const f=Math.min(24,w*.16,h*.25);return `<path d="M ${x} ${y} H ${x+w-f} L ${x+w} ${y+f} V ${y+h} H ${x} Z" ${common}/><path d="M ${x+w-f} ${y} V ${y+f} H ${x+w}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}" vector-effect="non-scaling-stroke"/>`;}
  if(type==='callout'){const tail=Math.min(24,h*.24);return `<path d="M ${x+r} ${y} H ${x+w-r} Q ${x+w} ${y} ${x+w} ${y+r} V ${y+h-tail-r} Q ${x+w} ${y+h-tail} ${x+w-r} ${y+h-tail} H ${x+w*.42} L ${x+w*.3} ${y+h} L ${x+w*.31} ${y+h-tail} H ${x+r} Q ${x} ${y+h-tail} ${x} ${y+h-tail-r} V ${y+r} Q ${x} ${y} ${x+r} ${y} Z" ${common}/>`;}
  if(type==='card')return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.max(10,r)}" ${common}/><path d="M ${x+14} ${y+22} H ${x+w-14}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${Math.max(.8,s.strokeWidth*.7)}" opacity=".55" vector-effect="non-scaling-stroke"/>`;
  if(type==='circle')return `<ellipse cx="${x+w/2}" cy="${y+h/2}" rx="${w/2}" ry="${h/2}" ${common}/>`;
  if(type==='triangle')return `<polygon points="${x+w/2},${y} ${x+w},${y+h} ${x},${y+h}" ${common}/>`;
  if(type==='hexagon'){const k=Math.min(28,w*.18);return `<polygon points="${x+k},${y} ${x+w-k},${y} ${x+w},${y+h/2} ${x+w-k},${y+h} ${x+k},${y+h} ${x},${y+h/2}" ${common}/>`;}
  if(type==='star'){const cx=x+w/2,cy=y+h/2,o=Math.min(w,h)/2,i=o*.46,pts=Array.from({length:10},(_,k)=>{const a=-Math.PI/2+k*Math.PI/5,rr=k%2?i:o;return `${cx+Math.cos(a)*rr},${cy+Math.sin(a)*rr}`;}).join(' ');return `<polygon points="${pts}" ${common}/>`;}
  if(type==='cloud'){const d=`M ${x+w*.2} ${y+h*.74} C ${x+w*.05} ${y+h*.72}, ${x+w*.01} ${y+h*.53}, ${x+w*.12} ${y+h*.43} C ${x+w*.08} ${y+h*.23}, ${x+w*.3} ${y+h*.13}, ${x+w*.43} ${y+h*.25} C ${x+w*.55} ${y+h*.05}, ${x+w*.82} ${y+h*.14}, ${x+w*.82} ${y+h*.35} C ${x+w*.99} ${y+h*.37}, ${x+w*1.02} ${y+h*.62}, ${x+w*.86} ${y+h*.71} C ${x+w*.72} ${y+h*.79}, ${x+w*.36} ${y+h*.78}, ${x+w*.2} ${y+h*.74} Z`;return `<path d="${d}" ${common}/>`;}
  if(type==='server')return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${common}/><path d="M ${x} ${y+h*.33} H ${x+w} M ${x} ${y+h*.66} H ${x+w}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}" vector-effect="non-scaling-stroke"/><circle cx="${x+18}" cy="${y+h*.165}" r="3" fill="${esc(s.stroke)}"/><circle cx="${x+18}" cy="${y+h*.495}" r="3" fill="${esc(s.stroke)}"/><circle cx="${x+18}" cy="${y+h*.825}" r="3" fill="${esc(s.stroke)}"/>`;
  if(type==='browser')return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${common}/><path d="M ${x} ${y+28} H ${x+w}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}" vector-effect="non-scaling-stroke"/><circle cx="${x+14}" cy="${y+14}" r="3" fill="${esc(s.stroke)}"/>`;
  if(type==='mobile')return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.max(14,r)}" ${common}/><path d="M ${x+w*.36} ${y+12} H ${x+w*.64} M ${x+w*.43} ${y+h-12} H ${x+w*.57}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
  if(type==='laptop'){const sh=h*.72;return `<rect x="${x+w*.08}" y="${y}" width="${w*.84}" height="${sh}" rx="${Math.max(6,r*.55)}" ${common}/><path d="M ${x} ${y+sh} H ${x+w} L ${x+w*.9} ${y+h} H ${x+w*.1} Z" ${common}/>`;}
  if(type==='actor'){const cx=x+w/2,hr=Math.min(16,w*.15),hy=y+22,bt=hy+hr+8,ly=y+h-22;return `<circle cx="${cx}" cy="${hy}" r="${hr}" ${common}/><path d="M ${cx} ${bt} V ${ly-20} M ${x+w*.25} ${bt+18} H ${x+w*.75} M ${cx} ${ly-20} L ${x+w*.3} ${ly} M ${cx} ${ly-20} L ${x+w*.7} ${ly}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${Math.max(2,s.strokeWidth*1.25)}" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;}
  if(type==='shield'){const d=`M ${x+w/2} ${y} L ${x+w*.88} ${y+h*.17} V ${y+h*.49} C ${x+w*.88} ${y+h*.75} ${x+w*.7} ${y+h*.91} ${x+w/2} ${y+h} C ${x+w*.3} ${y+h*.91} ${x+w*.12} ${y+h*.75} ${x+w*.12} ${y+h*.49} V ${y+h*.17} Z`;return `<path d="${d}" ${common}/>`;}
  if(type==='image')return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${common}/><circle cx="${x+w*.28}" cy="${y+h*.3}" r="${Math.min(10,w*.06)}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}"/><path d="M ${x+w*.12} ${y+h*.78} L ${x+w*.38} ${y+h*.52} L ${x+w*.53} ${y+h*.66} L ${x+w*.68} ${y+h*.48} L ${x+w*.88} ${y+h*.78}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}" vector-effect="non-scaling-stroke"/>`;
  if(type==='group')return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${esc(s.fill)}" fill-opacity="0.34" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}" stroke-dasharray="8 6" vector-effect="non-scaling-stroke" class="node-shape ${extraClass}"/>`;
  if(type==='swimlane'){const header=Math.min(70,Math.max(44,w*.13));return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${common}/><path d="M ${x+header} ${y} V ${y+h}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}" vector-effect="non-scaling-stroke"/>`;}
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${common}/>`;
}
function textBox(node) {
  const {x,y,w=180,h=84,type} = node;
  if (type === 'swimlane') {
    const header=Math.min(70, Math.max(44,w*.13));
    return {x, y, w:header, h};
  }
  if (type === 'database') return {x:x+10,y:y+10,w:w-20,h:h-18};
  if (type === 'document') return {x:x+10,y:y+6,w:w-20,h:h-20};
  if (type === 'note') return {x:x+10,y:y+8,w:w-28,h:h-16};
  if (type === 'group') return {x:x+12,y:y+8,w:w-24,h:28, align:'start'};
  if (type === 'actor') return {x:x+6,y:y+h-28,w:w-12,h:24};
  if (type === 'browser') return {x:x+10,y:y+30,w:w-20,h:h-34};
  if (type === 'mobile') return {x:x+8,y:y+24,w:w-16,h:h-48};
  if (type === 'laptop') return {x:x+18,y:y+12,w:w-36,h:h*.52};
  if (type === 'triangle') return {x:x+w*.2,y:y+h*.35,w:w*.6,h:h*.45};
  if (type === 'shield') return {x:x+w*.18,y:y+h*.22,w:w*.64,h:h*.55};
  if (type === 'gateway') return {x:x+w*.18,y:y+h*.18,w:w*.64,h:h*.64};
  if (type === 'decision') return {x:x+w*.16,y:y+h*.18,w:w*.68,h:h*.64};
  return {x:x+10,y:y+8,w:w-20,h:h-16};
}

export function wrapLabel(text, width, fontSize=15, maxLines=5) {
  const raw=String(text ?? '').trim();
  if (!raw) return [''];
  const maxChars=Math.max(3, Math.floor(width / Math.max(6, fontSize*.57)));
  const words=raw.split(/\s+/);
  const lines=[];
  let line='';
  const pushLong=(word)=>{
    let rest=word;
    while(rest.length>maxChars && lines.length<maxLines){ lines.push(rest.slice(0,maxChars)); rest=rest.slice(maxChars); }
    return rest;
  };
  for (let word of words) {
    if (word.length>maxChars && !line) word=pushLong(word);
    const test=line ? `${line} ${word}` : word;
    if (test.length<=maxChars) line=test;
    else {
      if (line) lines.push(line);
      line=word;
    }
    if (lines.length>=maxLines) break;
  }
  if (line && lines.length<maxLines) lines.push(line);
  if (lines.length===maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines-1]=`${lines[maxLines-1].slice(0,Math.max(1,maxChars-1))}…`;
  }
  return lines;
}

export function nodeTextMarkup(node,tokens,{selected=false}={}) {
  const s=resolveNodeStyle(node,tokens);
  const box=textBox(node);
  const lines=wrapLabel(node.label,box.w,s.fontSize, node.type==='group'?1:5);
  const lineH=s.fontSize*1.28;
  const startY=box.align==='start' ? box.y+s.fontSize : box.y+box.h/2 - ((lines.length-1)*lineH)/2;
  const x=box.align==='start' ? box.x : box.x+box.w/2;
  const anchor=box.align==='start' ? 'start' : 'middle';
  const cooked=lines.map(line=>s.textTransform==='uppercase'?String(line).toUpperCase():line);
  return `<text x="${x}" y="${startY}" fill="${esc(s.text)}" font-family="${esc(tokens.fontFamily)}" font-size="${s.fontSize}" font-weight="${s.fontWeight}" letter-spacing="${s.letterSpacing}" text-anchor="${anchor}" dominant-baseline="middle" pointer-events="none" class="node-label${selected?' is-selected':''}">${cooked.map((line,i)=>`<tspan x="${x}" dy="${i===0?0:lineH}">${esc(line)}</tspan>`).join('')}</text>`;
}

export function portPoint(node,port='right') {
  const {x,y,w=180,h=84}=node;
  const map={
    left:{x,y:y+h/2},right:{x:x+w,y:y+h/2},top:{x:x+w/2,y},bottom:{x:x+w/2,y:y+h},
    'top-left':{x,y},'top-right':{x:x+w,y},'bottom-left':{x,y:y+h},'bottom-right':{x:x+w,y:y+h}
  };
  return map[port]||map.right;
}
export function nodePortNames(node,tokens={}) {
  const count=Number(node.style?.portCount ?? tokens.portCount ?? 4);
  if(count<=0)return [];
  const base=['top','right','bottom','left'];
  return count>=8?[...base,'top-left','top-right','bottom-right','bottom-left']:base;
}
export function nearestPort(node, point, tokens={}) {
  const ports=nodePortNames(node,tokens);
  if(!ports.length)return 'right';
  let best=ports[0],bestD=Infinity;
  for (const p of ports) {
    const pt=portPoint(node,p), d=(pt.x-point.x)**2+(pt.y-point.y)**2;
    if (d<bestD){bestD=d;best=p;}
  }
  return best;
}

export function edgeGeometry(edge,nodes) {
  const a=nodes.find(n=>n.id===edge.source), b=nodes.find(n=>n.id===edge.target);
  if (!a || !b) return null;
  const p1=portPoint(a,edge.sourcePort||'right'), p2=portPoint(b,edge.targetPort||'left');
  const routing=edge.routing||'orthogonal';
  let d='';
  if (routing==='straight') d=`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
  else if (routing==='bezier') {
    const dx=Math.max(48,Math.abs(p2.x-p1.x)*.45), dy=Math.max(48,Math.abs(p2.y-p1.y)*.45);
    const horizontal=['left','right'].includes(edge.sourcePort||'right');
    const c1=horizontal?{x:p1.x+(edge.sourcePort==='left'?-dx:dx),y:p1.y}:{x:p1.x,y:p1.y+(edge.sourcePort==='top'?-dy:dy)};
    const c2=['left','right'].includes(edge.targetPort||'left')?{x:p2.x+(edge.targetPort==='left'?-dx:dx),y:p2.y}:{x:p2.x,y:p2.y+(edge.targetPort==='top'?-dy:dy)};
    d=`M ${p1.x} ${p1.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
  } else {
    const horizontal=['left','right'].includes(edge.sourcePort||'right');
    if (horizontal) { const mx=(p1.x+p2.x)/2; d=`M ${p1.x} ${p1.y} H ${mx} V ${p2.y} H ${p2.x}`; }
    else { const my=(p1.y+p2.y)/2; d=`M ${p1.x} ${p1.y} V ${my} H ${p2.x} V ${p2.y}`; }
  }
  return {d,p1,p2,label:{x:(p1.x+p2.x)/2,y:(p1.y+p2.y)/2}};
}

export function nodeBounds(nodes,padding=0) {
  if (!nodes.length) return {x:0,y:0,w:1000,h:700};
  const minX=Math.min(...nodes.map(n=>n.x))-padding;
  const minY=Math.min(...nodes.map(n=>n.y))-padding;
  const maxX=Math.max(...nodes.map(n=>n.x+(n.w||180)))+padding;
  const maxY=Math.max(...nodes.map(n=>n.y+(n.h||84)))+padding;
  return {x:minX,y:minY,w:maxX-minX,h:maxY-minY};
}

export function selectionRectMarkup(node,tokens) {
  const {x,y,w=180,h=84}=node;
  const hs=7;
  const corners=[['nw',x,y],['ne',x+w,y],['se',x+w,y+h],['sw',x,y+h]];
  return `<rect x="${x-4}" y="${y-4}" width="${w+8}" height="${h+8}" rx="8" fill="none" stroke="${esc(tokens.primary)}" stroke-width="1.5" stroke-dasharray="4 3" vector-effect="non-scaling-stroke" pointer-events="none"/>
  ${corners.map(([p,cx,cy])=>`<rect data-resize="${p}" data-node-id="${esc(node.id)}" x="${cx-hs/2}" y="${cy-hs/2}" width="${hs}" height="${hs}" rx="2" fill="${esc(tokens.primary)}" stroke="white" stroke-width="1" vector-effect="non-scaling-stroke" class="resize-handle"/>`).join('')}`;
}

export function portsMarkup(node,tokens) {
  const size=Number(node.style?.portSize ?? tokens.portSize ?? 8),r=Math.max(3,size/2);
  const shape=node.style?.portShape ?? tokens.portShape ?? 'circle';
  return nodePortNames(node,tokens).map(p=>{const pt=portPoint(node,p),common=`data-port="${p}" data-node-id="${esc(node.id)}" fill="${esc(tokens.canvas)}" stroke="${esc(tokens.primary)}" stroke-width="2" vector-effect="non-scaling-stroke" class="port-handle"`;if(shape==='square')return `<rect ${common} x="${pt.x-r}" y="${pt.y-r}" width="${r*2}" height="${r*2}" rx="1"/>`;if(shape==='diamond')return `<rect ${common} x="${pt.x-r}" y="${pt.y-r}" width="${r*2}" height="${r*2}" transform="rotate(45 ${pt.x} ${pt.y})"/>`;return `<circle ${common} cx="${pt.x}" cy="${pt.y}" r="${r}"/>`;}).join('');
}
