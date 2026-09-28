export const esc = (value='') => String(value)
  .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  .replaceAll('"','&quot;').replaceAll("'",'&#39;');

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function resolveNodeStyle(node, tokens) {
  return {
    fill: node.style?.fill ?? tokens.surface,
    stroke: node.style?.stroke ?? tokens.border,
    text: node.style?.text ?? tokens.text,
    strokeWidth: node.style?.strokeWidth ?? tokens.nodeStrokeWidth,
    radius: node.style?.radius ?? tokens.radius,
    fontSize: node.style?.fontSize ?? 15,
    fontWeight: node.style?.fontWeight ?? 650,
    opacity: node.style?.opacity ?? 1
  };
}

export function shapePrimitive(node, tokens, extraClass='') {
  const {x,y,w=180,h=84,type} = node;
  const s = resolveNodeStyle(node,tokens);
  const common = `fill="${esc(s.fill)}" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}" opacity="${s.opacity}" vector-effect="non-scaling-stroke" class="node-shape ${extraClass}"`;
  const r = Math.max(0, Math.min(s.radius, Math.min(w,h)/2));
  if (type === 'custom-svg' && node.customSvg?.content) {
    const vb=esc(node.customSvg.viewBox||'0 0 100 100');
    return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" overflow="visible" class="node-shape ${extraClass}">${node.customSvg.content}</svg>`;
  }
  if (type === 'decision') {
    return `<polygon points="${x+w/2},${y} ${x+w},${y+h/2} ${x+w/2},${y+h} ${x},${y+h/2}" ${common}/>`;
  }
  if (type === 'terminator') return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h/2}" ${common}/>`;
  if (type === 'io') {
    const k = Math.min(24,w*.16);
    return `<polygon points="${x+k},${y} ${x+w},${y} ${x+w-k},${y+h} ${x},${y+h}" ${common}/>`;
  }
  if (type === 'database') {
    const ry = Math.min(12,h*.13);
    return `<path d="M ${x} ${y+ry} A ${w/2} ${ry} 0 0 1 ${x+w} ${y+ry} V ${y+h-ry} A ${w/2} ${ry} 0 0 1 ${x} ${y+h-ry} Z" ${common}/>
      <ellipse cx="${x+w/2}" cy="${y+ry}" rx="${w/2}" ry="${ry}" ${common}/>
      <path d="M ${x} ${y+h-ry} A ${w/2} ${ry} 0 0 0 ${x+w} ${y+h-ry}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}" vector-effect="non-scaling-stroke"/>`;
  }
  if (type === 'document') {
    const wave=14;
    const d=`M ${x} ${y} H ${x+w} V ${y+h-wave} C ${x+w*.76} ${y+h-wave*2.1}, ${x+w*.62} ${y+h+wave*.35}, ${x+w*.38} ${y+h-wave} C ${x+w*.2} ${y+h-wave*2.05}, ${x+w*.1} ${y+h+wave*.25}, ${x} ${y+h-wave} Z`;
    return `<path d="${d}" ${common}/>`;
  }
  if (type === 'note') {
    const f=Math.min(24,w*.16,h*.25);
    return `<path d="M ${x} ${y} H ${x+w-f} L ${x+w} ${y+f} V ${y+h} H ${x} Z" ${common}/>
      <path d="M ${x+w-f} ${y} V ${y+f} H ${x+w}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}" vector-effect="non-scaling-stroke"/>`;
  }
  if (type === 'circle') return `<ellipse cx="${x+w/2}" cy="${y+h/2}" rx="${w/2}" ry="${h/2}" ${common}/>`;
  if (type === 'hexagon') {
    const k=Math.min(28,w*.18);
    return `<polygon points="${x+k},${y} ${x+w-k},${y} ${x+w},${y+h/2} ${x+w-k},${y+h} ${x+k},${y+h} ${x},${y+h/2}" ${common}/>`;
  }
  if (type === 'cloud') {
    const d=`M ${x+w*.2} ${y+h*.74} C ${x+w*.05} ${y+h*.72}, ${x+w*.01} ${y+h*.53}, ${x+w*.12} ${y+h*.43} C ${x+w*.08} ${y+h*.23}, ${x+w*.3} ${y+h*.13}, ${x+w*.43} ${y+h*.25} C ${x+w*.55} ${y+h*.05}, ${x+w*.82} ${y+h*.14}, ${x+w*.82} ${y+h*.35} C ${x+w*.99} ${y+h*.37}, ${x+w*1.02} ${y+h*.62}, ${x+w*.86} ${y+h*.71} C ${x+w*.72} ${y+h*.79}, ${x+w*.36} ${y+h*.78}, ${x+w*.2} ${y+h*.74} Z`;
    return `<path d="${d}" ${common}/>`;
  }
  if (type === 'group') {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${esc(s.fill)}" fill-opacity="0.34" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}" stroke-dasharray="8 6" vector-effect="non-scaling-stroke" class="node-shape ${extraClass}"/>`;
  }
  if (type === 'swimlane') {
    const header=Math.min(70, Math.max(44,w*.13));
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${common}/>
      <path d="M ${x+header} ${y} V ${y+h}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}" vector-effect="non-scaling-stroke"/>`;
  }
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
  return `<text x="${x}" y="${startY}" fill="${esc(s.text)}" font-family="${esc(tokens.fontFamily)}" font-size="${s.fontSize}" font-weight="${s.fontWeight}" text-anchor="${anchor}" dominant-baseline="middle" pointer-events="none" class="node-label${selected?' is-selected':''}">${lines.map((line,i)=>`<tspan x="${x}" dy="${i===0?0:lineH}">${esc(line)}</tspan>`).join('')}</text>`;
}

export function portPoint(node,port='right') {
  const {x,y,w=180,h=84}=node;
  if (port==='left') return {x,y:y+h/2};
  if (port==='top') return {x:x+w/2,y};
  if (port==='bottom') return {x:x+w/2,y:y+h};
  return {x:x+w,y:y+h/2};
}

export function nearestPort(node, point) {
  const ports=['left','right','top','bottom'];
  let best='left',bestD=Infinity;
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
  return ['top','right','bottom','left'].map(p=>{const pt=portPoint(node,p);return `<circle data-port="${p}" data-node-id="${esc(node.id)}" cx="${pt.x}" cy="${pt.y}" r="5.5" fill="${esc(tokens.canvas)}" stroke="${esc(tokens.primary)}" stroke-width="2" vector-effect="non-scaling-stroke" class="port-handle"/>`;}).join('');
}
