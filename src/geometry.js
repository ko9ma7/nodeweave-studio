export const esc = (value='') => String(value)
  .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  .replaceAll('"','&quot;').replaceAll("'",'&#39;');

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function resolveNodeStyle(node, tokens) {
  return {
    fill: node.style?.fill ?? (tokens.nodeGradient?'url(#nw-node-gradient)':tokens.surface),
    stroke: node.style?.stroke ?? tokens.border,
    text: node.style?.text ?? tokens.text,
    strokeWidth: node.style?.strokeWidth ?? tokens.nodeStrokeWidth,
    radius: node.style?.radius ?? tokens.radius,
    fontSize: node.style?.fontSize ?? 15,
    fontWeight: node.style?.fontWeight ?? tokens.labelWeight ?? 650,
    letterSpacing: node.style?.letterSpacing ?? tokens.labelLetterSpacing ?? 0,
    textTransform: node.style?.textTransform ?? tokens.labelTransform ?? 'none',
    opacity: node.style?.opacity ?? 1
  };
}

export function diagramStyleDefs(tokens){
  const g1=esc(tokens.gradientStart||tokens.surface||'#ffffff'),g2=esc(tokens.gradientEnd||tokens.surface2||tokens.surface||'#eef2ff');
  return `<linearGradient id="nw-node-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${g1}"/><stop offset="100%" stop-color="${g2}"/></linearGradient>`;
}

function nodeShadowStyle(tokens){
  const kind=tokens.nodeShadow||'none';if(kind==='none')return '';
  const c=tokens.shadowColor||'#0f172a22',x=Number(tokens.shadowX)||0,y=Number(tokens.shadowY)||5,b=Number(tokens.shadowBlur)||9;
  if(kind==='hard')return `filter:drop-shadow(${x}px ${y}px 0 ${c})`;
  if(kind==='glow')return `filter:drop-shadow(0 0 ${Math.max(4,b)}px ${c})`;
  if(kind==='deep')return `filter:drop-shadow(${x}px ${y}px ${Math.max(8,b)}px ${c})`;
  if(kind==='clay')return `filter:drop-shadow(${x}px ${y}px ${Math.max(7,b)}px ${c})`;
  if(kind==='neumorph')return `filter:drop-shadow(${x}px ${y}px ${Math.max(8,b)}px ${c})`;
  return `filter:drop-shadow(${x}px ${y}px ${Math.max(4,b)}px ${c})`;
}


function safeImageHref(value=''){
  const v=String(value||'').trim();
  return /^(data:image\/(?:png|jpeg|jpg|webp|gif|svg\+xml);base64,|https?:\/\/)/i.test(v)?v:'';
}

function polar(cx,cy,r,angle){return {x:cx+Math.cos(angle)*r,y:cy+Math.sin(angle)*r};}
function donutPath(cx,cy,outer,inner,a0,a1){
  const p0=polar(cx,cy,outer,a0),p1=polar(cx,cy,outer,a1),q1=polar(cx,cy,inner,a1),q0=polar(cx,cy,inner,a0);
  const large=Math.abs(a1-a0)>Math.PI?1:0;
  return `M ${p0.x} ${p0.y} A ${outer} ${outer} 0 ${large} 1 ${p1.x} ${p1.y} L ${q1.x} ${q1.y} A ${inner} ${inner} 0 ${large} 0 ${q0.x} ${q0.y} Z`;
}
function radialPlanMarkup(node,tokens){
  const {x,y,w=520,h=520}=node;const data=node.data||{};const total=Number(data.clockMode)===12?12:24;const segments=Array.isArray(data.segments)?data.segments:[];
  const cx=x+w/2,cy=y+h/2,outer=Math.max(70,Math.min(w,h)/2-34),inner=outer*.52;
  const palette=['#6366f1','#22c55e','#f59e0b','#ec4899','#06b6d4','#8b5cf6','#ef4444','#84cc16'];
  const ring=`<circle cx="${cx}" cy="${cy}" r="${outer}" fill="${esc(tokens.surface)}" stroke="${esc(tokens.border)}" stroke-width="1.5" opacity=".98"/><circle cx="${cx}" cy="${cy}" r="${inner}" fill="${esc(tokens.canvas)}" stroke="${esc(tokens.border)}" stroke-width="1.2"/>`;
  let segMarkup='';let assigned=0;
  segments.forEach((seg,i)=>{let start=Number(seg.start)||0,end=Number(seg.end)||0;start=((start%total)+total)%total;end=((end%total)+total)%total;let duration=(end-start+total)%total;if(duration===0&&String(seg.end)!==String(seg.start))duration=total;if(duration<=0)return;assigned+=duration;const a0=-Math.PI/2+(start/total)*Math.PI*2;const a1=a0+(duration/total)*Math.PI*2;const color=seg.color||palette[i%palette.length];const path=duration>=total-.001?`<circle cx="${cx}" cy="${cy}" r="${(outer+inner)/2}" fill="none" stroke="${esc(color)}" stroke-width="${outer-inner}"/>`:`<path d="${donutPath(cx,cy,outer,inner,a0,a1)}" fill="${esc(color)}" stroke="${esc(tokens.canvas)}" stroke-width="2"/>`;const mid=a0+(a1-a0)/2,lr=(outer+inner)/2,labelPt=polar(cx,cy,lr,mid);const show=duration>=total/24*.8;segMarkup+=`${path}${show?`<text x="${labelPt.x}" y="${labelPt.y-4}" text-anchor="middle" dominant-baseline="middle" fill="${esc(seg.textColor||'#ffffff')}" font-family="${esc(tokens.fontFamily)}" font-size="${Math.max(9,Math.min(13,outer/20))}" font-weight="750" paint-order="stroke" stroke="rgba(0,0,0,.18)" stroke-width="2">${esc(seg.label||'활동')}</text><text x="${labelPt.x}" y="${labelPt.y+11}" text-anchor="middle" dominant-baseline="middle" fill="${esc(seg.textColor||'#ffffff')}" font-family="${esc(tokens.fontFamily)}" font-size="9" font-weight="650">${duration}h</text>`:''}`;});
  let ticks='';const tickEvery=total===24?1:1;for(let i=0;i<total;i+=tickEvery){const a=-Math.PI/2+(i/total)*Math.PI*2;const p1=polar(cx,cy,outer+5,a),p2=polar(cx,cy,outer+(i%(total===24?3:1)===0?15:10),a);ticks+=`<path d="M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}" stroke="${esc(tokens.text)}" stroke-width="${i%(total===24?3:1)===0?1.6:1}" opacity="${i%(total===24?3:1)===0?.65:.3}"/>`;if(total===12||i%3===0){const tp=polar(cx,cy,outer+27,a);ticks+=`<text x="${tp.x}" y="${tp.y}" text-anchor="middle" dominant-baseline="middle" fill="${esc(tokens.muted||tokens.text)}" font-family="${esc(tokens.fontFamily)}" font-size="10" font-weight="700">${i}</text>`;}}
  const title=esc(data.title||`${total}시간 생활계획`),summary=`${Math.round(assigned*10)/10}/${total}h`;
  const center=`<text x="${cx}" y="${cy-8}" text-anchor="middle" fill="${esc(tokens.text)}" font-family="${esc(tokens.fontFamily)}" font-size="${Math.max(16,outer/14)}" font-weight="800">${title}</text><text x="${cx}" y="${cy+18}" text-anchor="middle" fill="${esc(tokens.muted||tokens.text)}" font-family="${esc(tokens.fontFamily)}" font-size="12" font-weight="700">${summary}</text>`;
  return `<g class="smart-radial-plan">${ring}${segMarkup}${ticks}${center}</g>`;
}

function brainMapMarkup(node,tokens){
  const {x,y,w=720,h=620}=node;
  const d=node.data||{};
  const regs=Array.isArray(d.regions)?d.regions:[];
  const colors=['#c4b5fd','#93c5fd','#f9a8d4','#86efac','#fde68a','#fdba74'];
  const X=a=>x+w*a,Y=a=>y+h*a;
  const clipId=`brain-clip-${String(node.id||'node').replace(/[^a-zA-Z0-9_-]/g,'')}`;

  // Calm, left-facing worksheet profile. The face uses soft curves instead of pointed nose/lip steps.
  const head=`
    M ${X(.41)} ${Y(.97)}
    C ${X(.40)} ${Y(.91)} ${X(.39)} ${Y(.85)} ${X(.37)} ${Y(.80)}
    C ${X(.31)} ${Y(.80)} ${X(.25)} ${Y(.78)} ${X(.21)} ${Y(.75)}
    C ${X(.17)} ${Y(.72)} ${X(.16)} ${Y(.67)} ${X(.19)} ${Y(.62)}
    C ${X(.215)} ${Y(.58)} ${X(.20)} ${Y(.55)} ${X(.16)} ${Y(.53)}
    C ${X(.125)} ${Y(.51)} ${X(.115)} ${Y(.48)} ${X(.14)} ${Y(.455)}
    C ${X(.16)} ${Y(.435)} ${X(.16)} ${Y(.415)} ${X(.135)} ${Y(.402)}
    C ${X(.105)} ${Y(.388)} ${X(.09)} ${Y(.37)} ${X(.105)} ${Y(.35)}
    C ${X(.12)} ${Y(.332)} ${X(.15)} ${Y(.32)} ${X(.17)} ${Y(.30)}
    C ${X(.175)} ${Y(.235)} ${X(.205)} ${Y(.18)} ${X(.265)} ${Y(.14)}
    C ${X(.35)} ${Y(.083)} ${X(.46)} ${Y(.06)} ${X(.58)} ${Y(.08)}
    C ${X(.715)} ${Y(.10)} ${X(.81)} ${Y(.17)} ${X(.855)} ${Y(.275)}
    C ${X(.90)} ${Y(.385)} ${X(.895)} ${Y(.51)} ${X(.845)} ${Y(.605)}
    C ${X(.805)} ${Y(.68)} ${X(.80)} ${Y(.74)} ${X(.825)} ${Y(.79)}
    C ${X(.845)} ${Y(.825)} ${X(.825)} ${Y(.85)} ${X(.78)} ${Y(.862)}
    C ${X(.70)} ${Y(.88)} ${X(.63)} ${Y(.88)} ${X(.56)} ${Y(.91)}
    C ${X(.505)} ${Y(.935)} ${X(.455)} ${Y(.985)} ${X(.41)} ${Y(.97)}
    Z`;

  // Six non-overlapping, rounded thought compartments placed inside the cranial area.
  const shapes=[
    `M ${X(.285)} ${Y(.185)} C ${X(.34)} ${Y(.13)} ${X(.44)} ${Y(.125)} ${X(.495)} ${Y(.17)} C ${X(.545)} ${Y(.21)} ${X(.535)} ${Y(.285)} ${X(.475)} ${Y(.33)} C ${X(.405)} ${Y(.38)} ${X(.30)} ${Y(.35)} ${X(.255)} ${Y(.29)} C ${X(.225)} ${Y(.25)} ${X(.245)} ${Y(.215)} ${X(.285)} ${Y(.185)} Z`,
    `M ${X(.535)} ${Y(.165)} C ${X(.60)} ${Y(.125)} ${X(.70)} ${Y(.14)} ${X(.755)} ${Y(.205)} C ${X(.805)} ${Y(.265)} ${X(.795)} ${Y(.345)} ${X(.735)} ${Y(.385)} C ${X(.675)} ${Y(.425)} ${X(.585)} ${Y(.395)} ${X(.535)} ${Y(.335)} C ${X(.495)} ${Y(.285)} ${X(.49)} ${Y(.215)} ${X(.535)} ${Y(.165)} Z`,
    `M ${X(.625)} ${Y(.405)} C ${X(.69)} ${Y(.37)} ${X(.765)} ${Y(.395)} ${X(.785)} ${Y(.46)} C ${X(.81)} ${Y(.535)} ${X(.775)} ${Y(.60)} ${X(.715)} ${Y(.63)} C ${X(.655)} ${Y(.66)} ${X(.595)} ${Y(.615)} ${X(.59)} ${Y(.55)} C ${X(.585)} ${Y(.49)} ${X(.59)} ${Y(.43)} ${X(.625)} ${Y(.405)} Z`,
    `M ${X(.535)} ${Y(.60)} C ${X(.60)} ${Y(.575)} ${X(.69)} ${Y(.595)} ${X(.715)} ${Y(.655)} C ${X(.745)} ${Y(.72)} ${X(.69)} ${Y(.765)} ${X(.605)} ${Y(.78)} C ${X(.525)} ${Y(.795)} ${X(.465)} ${Y(.755)} ${X(.46)} ${Y(.695)} C ${X(.455)} ${Y(.645)} ${X(.485)} ${Y(.615)} ${X(.535)} ${Y(.60)} Z`,
    `M ${X(.275)} ${Y(.555)} C ${X(.34)} ${Y(.515)} ${X(.425)} ${Y(.525)} ${X(.465)} ${Y(.58)} C ${X(.51)} ${Y(.645)} ${X(.475)} ${Y(.715)} ${X(.405)} ${Y(.75)} C ${X(.33)} ${Y(.785)} ${X(.255)} ${Y(.755)} ${X(.225)} ${Y(.69)} C ${X(.195)} ${Y(.63)} ${X(.225)} ${Y(.585)} ${X(.275)} ${Y(.555)} Z`,
    `M ${X(.35)} ${Y(.35)} C ${X(.43)} ${Y(.315)} ${X(.535)} ${Y(.34)} ${X(.585)} ${Y(.405)} C ${X(.64)} ${Y(.475)} ${X(.60)} ${Y(.565)} ${X(.525)} ${Y(.595)} C ${X(.445)} ${Y(.625)} ${X(.35)} ${Y(.59)} ${X(.305)} ${Y(.525)} C ${X(.26)} ${Y(.46)} ${X(.285)} ${Y(.385)} ${X(.35)} ${Y(.35)} Z`
  ];
  const centers=[[.37,.255],[.645,.26],[.69,.505],[.59,.69],[.34,.655],[.45,.475]];
  const regionStroke=Math.max(1.25,Number(tokens.nodeStrokeWidth)||1.5);
  let regions='';
  for(let i=0;i<shapes.length;i++){
    const r=regs[i]||{};
    const color=r.color||colors[i];
    const pct=Math.max(0,Math.min(100,Number(r.percent)||0));
    const [cx,cy]=centers[i];
    const label=esc(r.label||`생각 ${i+1}`);
    regions+=`<path d="${shapes[i]}" fill="${esc(color)}" fill-opacity=".30" stroke="${esc(tokens.text)}" stroke-opacity=".82" stroke-width="${regionStroke}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      <text x="${X(cx)}" y="${Y(cy)-4}" text-anchor="middle" fill="${esc(tokens.text)}" font-family="${esc(tokens.fontFamily)}" font-size="${Math.max(12,Math.min(18,w/43))}" font-weight="800">${label}</text>
      <rect x="${X(cx)-23}" y="${Y(cy)+10}" width="46" height="20" rx="10" fill="${esc(color)}" fill-opacity=".25"/>
      <text x="${X(cx)}" y="${Y(cy)+24}" text-anchor="middle" fill="${esc(tokens.text)}" opacity=".76" font-family="${esc(tokens.fontFamily)}" font-size="10.5" font-weight="800">${pct}%</text>`;
  }
  const total=regs.slice(0,6).reduce((sum,r)=>sum+(Number(r?.percent)||0),0);
  const title=esc(d.title||'내 머릿속');
  return `<g class="smart-brain-map">
    <defs><clipPath id="${clipId}"><path d="${head}"/></clipPath></defs>
    <path d="${head}" fill="${esc(tokens.surface)}" fill-opacity=".58" stroke="${esc(tokens.text)}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    <g clip-path="url(#${clipId})">${regions}</g>
    <circle cx="${X(.182)}" cy="${Y(.332)}" r="${Math.max(2.2,w*.004)}" fill="${esc(tokens.text)}" opacity=".58"/>
    <path d="M ${X(.735)} ${Y(.43)} C ${X(.77)} ${Y(.445)} ${X(.77)} ${Y(.505)} ${X(.735)} ${Y(.525)}" fill="none" stroke="${esc(tokens.text)}" stroke-width="1.35" stroke-linecap="round" opacity=".28" vector-effect="non-scaling-stroke"/>
    <text x="${X(.45)}" y="${Y(.875)}" text-anchor="middle" fill="${esc(tokens.text)}" font-family="${esc(tokens.fontFamily)}" font-size="16" font-weight="850">${title}</text>
    <text x="${X(.45)}" y="${Y(.91)}" text-anchor="middle" fill="${esc(tokens.muted||tokens.text)}" font-family="${esc(tokens.fontFamily)}" font-size="11" font-weight="700">합계 ${total}%</text>
  </g>`;
}
function applySvgPaintOverrides(content,overrides={}){
  let out=String(content||'');
  for(const [from,to] of Object.entries(overrides||{})){
    if(!from||!to)continue;
    for(const attr of ['fill','stroke','stop-color']) out=out.split(`${attr}="${from}"`).join(`${attr}="${to}"`).split(`${attr}='${from}'`).join(`${attr}='${to}'`);
  }
  return out;
}
function svgEffectDef(id,effect,color,accent){
  if(effect==='shadow')return `<filter id="${id}" x="-35%" y="-35%" width="170%" height="180%"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity=".24"/></filter>`;
  if(effect==='glow')return `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceAlpha" stdDeviation="3.2" result="b"/><feFlood flood-color="${esc(accent)}" flood-opacity=".72" result="c"/><feComposite in="c" in2="b" operator="in" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  if(effect==='sticker')return `<filter id="${id}" x="-45%" y="-45%" width="190%" height="190%"><feMorphology in="SourceAlpha" operator="dilate" radius="2.4" result="d"/><feFlood flood-color="${esc(accent)}" result="f"/><feComposite in="f" in2="d" operator="in" result="o"/><feDropShadow dx="0" dy="3" stdDeviation="2" flood-color="#000000" flood-opacity=".18" result="s"/><feMerge><feMergeNode in="s"/><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  if(effect==='tint')return `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%"><feFlood flood-color="${esc(color)}" result="c"/><feComposite in="c" in2="SourceAlpha" operator="in"/></filter>`;
  return '';
}
export function shapePrimitive(node, tokens, extraClass='') {
  const {x,y,w=180,h=84,type} = node;
  const s = resolveNodeStyle(node,tokens);
  const dash=node.style?.dash??tokens.borderDash??'';const shadow=nodeShadowStyle(tokens);
  const common = `fill="${esc(s.fill)}" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}" ${dash?`stroke-dasharray="${esc(dash)}"`:''} opacity="${s.opacity}" vector-effect="non-scaling-stroke" class="node-shape ${extraClass}" ${shadow?`style="${shadow}"`:''}`;
  const r = Math.max(0, Math.min(s.radius, Math.min(w,h)/2));
  if (type === 'radial-plan') return radialPlanMarkup(node,tokens);
  if (type === 'brain-map') return brainMapMarkup(node,tokens);
  if (type === 'custom-svg' && node.customSvg?.content) {
    const vb=node.customSvg.viewBox||'0 0 100 100';
    const nums=String(vb).trim().split(/[\s,]+/).map(Number);
    const [vx,vy,vw,vh]=nums.length===4&&nums.every(Number.isFinite)?nums:[0,0,100,100];
    const cx=vx+vw/2,cy=vy+vh/2;
    const rotation=Number(node.style?.rotation)||0;
    const padding=clamp(Number(node.style?.padding)||0,0,40);
    const scale=Math.max(.2,(100-padding*2)/100);
    const sx=(node.style?.flipX?-1:1)*scale, sy=(node.style?.flipY?-1:1)*scale;
    const iconColor=node.style?.iconColor??tokens.text;
    const accentColor=node.style?.accentColor??tokens.primary;
    const bg=node.style?.iconBackground??'transparent';
    const effect=node.style?.svgEffect||'none';
    const fit=node.style?.svgFit||'contain';
    const preserve=fit==='stretch'?'none':fit==='cover'?'xMidYMid slice':'xMidYMid meet';
    const effectId=`svgfx-${String(node.id||'node').replace(/[^a-zA-Z0-9_-]/g,'')}`;
    const effectDef=svgEffectDef(effectId,effect,iconColor,accentColor);
    const filterAttr=effectDef?`filter="url(#${effectId})"`:'';
    const rootPaint=node.customSvg.rootPaint||{};
    const rootFill=rootPaint.fill??(node.customSvg.origin==='user-import'?'currentColor':null);
    const rootStroke=rootPaint.stroke??null;
    const rootAttrs=[
      rootFill?`fill="${esc(rootFill)}"`:'',
      rootStroke?`stroke="${esc(rootStroke)}"`:'',
      rootPaint.strokeWidth?`stroke-width="${esc(rootPaint.strokeWidth)}"`:'',
      rootPaint.strokeLinecap?`stroke-linecap="${esc(rootPaint.strokeLinecap)}"`:'',
      rootPaint.strokeLinejoin?`stroke-linejoin="${esc(rootPaint.strokeLinejoin)}"`:''
    ].filter(Boolean).join(' ');
    const badge=effect==='badge'?`<rect x="${vx+vw*.04}" y="${vy+vh*.04}" width="${vw*.92}" height="${vh*.92}" rx="${Math.min(vw,vh)*.16}" fill="${esc(accentColor)}" opacity=".14"/>`:'';
    const bgRect=bg&&bg!=='transparent'?`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(Math.max(8,r),Math.min(w,h)/2)}" fill="${esc(bg)}" opacity="${s.opacity}"/>`:'';
    const transform=`translate(${cx} ${cy}) rotate(${rotation}) scale(${sx} ${sy}) translate(${-cx} ${-cy})`;
    const content=applySvgPaintOverrides(node.customSvg.content,node.customSvg.paintOverrides);
    return `${bgRect}<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${esc(vb)}" preserveAspectRatio="${preserve}" overflow="visible" color="${esc(iconColor)}" opacity="${s.opacity}" class="node-shape ${extraClass}" ${rootAttrs}>${effectDef?`<defs>${effectDef}</defs>`:''}${badge}<g transform="${transform}" ${filterAttr}>${content}</g></svg>`;
  }
  if (type === 'decision' || type === 'gateway') {
    const inner=type==='gateway'?`<path d="M ${x+w*.38} ${y+h*.38} L ${x+w*.62} ${y+h*.62} M ${x+w*.62} ${y+h*.38} L ${x+w*.38} ${y+h*.62}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${Math.max(1,s.strokeWidth)}" vector-effect="non-scaling-stroke"/>`:'';
    return `<polygon points="${x+w/2},${y} ${x+w},${y+h/2} ${x+w/2},${y+h} ${x},${y+h/2}" ${common}/>${inner}`;
  }
  if (type === 'terminator') return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h/2}" ${common}/>`;
  if (type === 'io') {
    const k = Math.min(24,w*.16);
    return `<polygon points="${x+k},${y} ${x+w},${y} ${x+w-k},${y+h} ${x},${y+h}" ${common}/>`;
  }
  if (type === 'manual-input') {
    const k=Math.min(20,h*.28);
    return `<polygon points="${x},${y+k} ${x+w},${y} ${x+w},${y+h} ${x},${y+h}" ${common}/>`;
  }
  if (type === 'delay') {
    const rr=h/2;
    return `<path d="M ${x} ${y} H ${x+w-rr} A ${rr} ${rr} 0 0 1 ${x+w-rr} ${y+h} H ${x} Z" ${common}/>`;
  }
  if (type === 'offpage') {
    const tip=Math.min(26,h*.28);
    return `<path d="M ${x} ${y} H ${x+w} V ${y+h-tip} L ${x+w/2} ${y+h} L ${x} ${y+h-tip} Z" ${common}/>`;
  }
  if (type === 'subprocess') {
    const pad=Math.min(16,w*.09);
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${common}/><path d="M ${x+pad} ${y} V ${y+h} M ${x+w-pad} ${y} V ${y+h}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}" vector-effect="non-scaling-stroke"/>`;
  }
  if (type === 'database') {
    const ry = Math.min(12,h*.13);
    return `<path d="M ${x} ${y+ry} A ${w/2} ${ry} 0 0 1 ${x+w} ${y+ry} V ${y+h-ry} A ${w/2} ${ry} 0 0 1 ${x} ${y+h-ry} Z" ${common}/>
      <ellipse cx="${x+w/2}" cy="${y+ry}" rx="${w/2}" ry="${ry}" ${common}/>
      <path d="M ${x} ${y+h-ry} A ${w/2} ${ry} 0 0 0 ${x+w} ${y+h-ry}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}" vector-effect="non-scaling-stroke"/>`;
  }
  if (type === 'table') {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${common}/>
      <path d="M ${x} ${y+h*.28} H ${x+w} M ${x+w*.34} ${y} V ${y+h} M ${x+w*.68} ${y} V ${y+h} M ${x} ${y+h*.52} H ${x+w} M ${x} ${y+h*.76} H ${x+w}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${Math.max(.8,s.strokeWidth*.72)}" opacity=".75" vector-effect="non-scaling-stroke"/>`;
  }
  if (type === 'queue') {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(h/2,r+10)}" ${common}/><path d="M ${x+w*.25} ${y+h*.32} H ${x+w*.76} M ${x+w*.25} ${y+h*.5} H ${x+w*.68} M ${x+w*.25} ${y+h*.68} H ${x+w*.58}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${Math.max(1,s.strokeWidth)}" vector-effect="non-scaling-stroke"/>`;
  }
  if (type === 'document') {
    const wave=14;
    const d=`M ${x} ${y} H ${x+w} V ${y+h-wave} C ${x+w*.76} ${y+h-wave*2.1}, ${x+w*.62} ${y+h+wave*.35}, ${x+w*.38} ${y+h-wave} C ${x+w*.2} ${y+h-wave*2.05}, ${x+w*.1} ${y+h+wave*.25}, ${x} ${y+h-wave} Z`;
    return `<path d="${d}" ${common}/>`;
  }
  if (type === 'folder') {
    const tabW=w*.35,tabH=Math.min(22,h*.24);
    return `<path d="M ${x} ${y+tabH} V ${y+7} H ${x+tabW} L ${x+tabW+18} ${y+tabH} H ${x+w} V ${y+h} H ${x} Z" ${common}/>`;
  }
  if (type === 'package') {
    const top=h*.28;
    return `<path d="M ${x+w/2} ${y} L ${x+w} ${y+top} V ${y+h-top*.15} L ${x+w/2} ${y+h} L ${x} ${y+h-top*.15} V ${y+top} Z" ${common}/><path d="M ${x} ${y+top} L ${x+w/2} ${y+top*2} L ${x+w} ${y+top} M ${x+w/2} ${y+top*2} V ${y+h}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}" vector-effect="non-scaling-stroke"/>`;
  }
  if (type === 'note') {
    const f=Math.min(24,w*.16,h*.25);
    return `<path d="M ${x} ${y} H ${x+w-f} L ${x+w} ${y+f} V ${y+h} H ${x} Z" ${common}/>
      <path d="M ${x+w-f} ${y} V ${y+f} H ${x+w}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}" vector-effect="non-scaling-stroke"/>`;
  }
  if (type === 'callout') {
    const tail=Math.min(24,h*.24);
    return `<path d="M ${x+r} ${y} H ${x+w-r} Q ${x+w} ${y} ${x+w} ${y+r} V ${y+h-tail-r} Q ${x+w} ${y+h-tail} ${x+w-r} ${y+h-tail} H ${x+w*.42} L ${x+w*.3} ${y+h} L ${x+w*.31} ${y+h-tail} H ${x+r} Q ${x} ${y+h-tail} ${x} ${y+h-tail-r} V ${y+r} Q ${x} ${y} ${x+r} ${y} Z" ${common}/>`;
  }
  if (type === 'card') return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.max(10,r)}" ${common}/><path d="M ${x+14} ${y+22} H ${x+w-14}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${Math.max(.8,s.strokeWidth*.7)}" opacity=".55" vector-effect="non-scaling-stroke"/>`;
  if (type === 'circle') return `<ellipse cx="${x+w/2}" cy="${y+h/2}" rx="${w/2}" ry="${h/2}" ${common}/>`;
  if (type === 'triangle') return `<polygon points="${x+w/2},${y} ${x+w},${y+h} ${x},${y+h}" ${common}/>`;
  if (type === 'hexagon') {
    const k=Math.min(28,w*.18);
    return `<polygon points="${x+k},${y} ${x+w-k},${y} ${x+w},${y+h/2} ${x+w-k},${y+h} ${x+k},${y+h} ${x},${y+h/2}" ${common}/>`;
  }
  if (type === 'bookmark') {
    const notch=Math.min(24,h*.22);
    return `<path d="M ${x} ${y} H ${x+w} V ${y+h} L ${x+w/2} ${y+h-notch} L ${x} ${y+h} Z" ${common}/>`;
  }
  if (type === 'tag') {
    const cut=Math.min(28,h*.32), hole=Math.min(8,h*.09);
    return `<path d="M ${x+cut} ${y} H ${x+w} V ${y+h} H ${x+cut} L ${x} ${y+h/2} Z" ${common}/><circle cx="${x+cut*0.55}" cy="${y+h/2}" r="${hole}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}" vector-effect="non-scaling-stroke"/>`;
  }
  if (type === 'chevron') {
    const k=Math.min(34,w*.24);
    return `<polygon points="${x},${y} ${x+w-k},${y} ${x+w},${y+h/2} ${x+w-k},${y+h} ${x},${y+h} ${x+k},${y+h/2}" ${common}/>`;
  }
  if (type === 'pentagon') {
    return `<polygon points="${x+w/2},${y} ${x+w},${y+h*.38} ${x+w*.82},${y+h} ${x+w*.18},${y+h} ${x},${y+h*.38}" ${common}/>`;
  }
  if (type === 'octagon') {
    const k=Math.min(24,Math.min(w,h)*.18);
    return `<polygon points="${x+k},${y} ${x+w-k},${y} ${x+w},${y+k} ${x+w},${y+h-k} ${x+w-k},${y+h} ${x+k},${y+h} ${x},${y+h-k} ${x},${y+k}" ${common}/>`;
  }
  if (type === 'hourglass') {
    return `<path d="M ${x} ${y} H ${x+w} L ${x+w*.62} ${y+h/2} L ${x+w} ${y+h} H ${x} L ${x+w*.38} ${y+h/2} Z" ${common}/>`;
  }
  if (type === 'star') {
    const cx=x+w/2,cy=y+h/2,outer=Math.min(w,h)/2,inner=outer*.46;
    const pts=Array.from({length:10},(_,i)=>{const a=-Math.PI/2+i*Math.PI/5,rr=i%2?inner:outer;return `${cx+Math.cos(a)*rr},${cy+Math.sin(a)*rr}`;}).join(' ');
    return `<polygon points="${pts}" ${common}/>`;
  }
  if (type === 'cloud') {
    const d=`M ${x+w*.2} ${y+h*.74} C ${x+w*.05} ${y+h*.72}, ${x+w*.01} ${y+h*.53}, ${x+w*.12} ${y+h*.43} C ${x+w*.08} ${y+h*.23}, ${x+w*.3} ${y+h*.13}, ${x+w*.43} ${y+h*.25} C ${x+w*.55} ${y+h*.05}, ${x+w*.82} ${y+h*.14}, ${x+w*.82} ${y+h*.35} C ${x+w*.99} ${y+h*.37}, ${x+w*1.02} ${y+h*.62}, ${x+w*.86} ${y+h*.71} C ${x+w*.72} ${y+h*.79}, ${x+w*.36} ${y+h*.78}, ${x+w*.2} ${y+h*.74} Z`;
    return `<path d="${d}" ${common}/>`;
  }
  if (type === 'server') {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${common}/><path d="M ${x} ${y+h*.33} H ${x+w} M ${x} ${y+h*.66} H ${x+w}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}" vector-effect="non-scaling-stroke"/><circle cx="${x+18}" cy="${y+h*.165}" r="3" fill="${esc(s.stroke)}"/><circle cx="${x+18}" cy="${y+h*.495}" r="3" fill="${esc(s.stroke)}"/><circle cx="${x+18}" cy="${y+h*.825}" r="3" fill="${esc(s.stroke)}"/>`;
  }
  if (type === 'browser') {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${common}/><path d="M ${x} ${y+28} H ${x+w}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}" vector-effect="non-scaling-stroke"/><circle cx="${x+14}" cy="${y+14}" r="3" fill="${esc(s.stroke)}"/><circle cx="${x+25}" cy="${y+14}" r="3" fill="${esc(s.stroke)}" opacity=".6"/>`;
  }
  if (type === 'mobile') {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.max(14,r)}" ${common}/><path d="M ${x+w*.36} ${y+12} H ${x+w*.64} M ${x+w*.43} ${y+h-12} H ${x+w*.57}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
  }
  if (type === 'laptop') {
    const screenH=h*.72;
    return `<rect x="${x+w*.08}" y="${y}" width="${w*.84}" height="${screenH}" rx="${Math.max(6,r*.55)}" ${common}/><path d="M ${x} ${y+screenH} H ${x+w} L ${x+w*.9} ${y+h} H ${x+w*.1} Z" ${common}/>`;
  }
  if (type === 'actor') {
    const cx=x+w/2,headR=Math.min(16,w*.15),headY=y+22,bodyTop=headY+headR+8,legY=y+h-22;
    return `<circle cx="${cx}" cy="${headY}" r="${headR}" ${common}/><path d="M ${cx} ${bodyTop} V ${legY-20} M ${x+w*.25} ${bodyTop+18} H ${x+w*.75} M ${cx} ${legY-20} L ${x+w*.3} ${legY} M ${cx} ${legY-20} L ${x+w*.7} ${legY}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${Math.max(2,s.strokeWidth*1.25)}" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
  }
  if (type === 'shield') {
    const d=`M ${x+w/2} ${y} L ${x+w*.88} ${y+h*.17} V ${y+h*.49} C ${x+w*.88} ${y+h*.75} ${x+w*.7} ${y+h*.91} ${x+w/2} ${y+h} C ${x+w*.3} ${y+h*.91} ${x+w*.12} ${y+h*.75} ${x+w*.12} ${y+h*.49} V ${y+h*.17} Z`;
    return `<path d="${d}" ${common}/>`;
  }
  if (type === 'image') {
    const src=safeImageHref(node.media?.src||'');
    const fit=node.media?.fit||'cover';const par=fit==='stretch'?'none':fit==='contain'?'xMidYMid meet':'xMidYMid slice';const clipId=`nw-img-${String(node.id||'node').replace(/[^a-zA-Z0-9_-]/g,'')}`;
    if(src)return `<defs><clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath></defs><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${esc(s.fill)}" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}"/><image href="${esc(src)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="${par}" opacity="${Number(node.media?.opacity??1)}" clip-path="url(#${clipId})"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}" vector-effect="non-scaling-stroke"/>`;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${common}/><circle cx="${x+w*.28}" cy="${y+h*.3}" r="${Math.min(10,w*.06)}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}"/><path d="M ${x+w*.12} ${y+h*.78} L ${x+w*.38} ${y+h*.52} L ${x+w*.53} ${y+h*.66} L ${x+w*.68} ${y+h*.48} L ${x+w*.88} ${y+h*.78}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}" vector-effect="non-scaling-stroke"/><text x="${x+w/2}" y="${y+h*.9}" text-anchor="middle" fill="${esc(s.text)}" font-family="${esc(tokens.fontFamily)}" font-size="11" font-weight="700">이미지를 선택하세요</text>`;
  }
  if (type === 'group') {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${esc(s.fill)}" fill-opacity="0.34" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}" stroke-dasharray="8 6" vector-effect="non-scaling-stroke" class="node-shape ${extraClass}"/>`;
  }
  if (type === 'image') return {x:x+10,y:y+h-38,w:w-20,h:30};
  if (type === 'swimlane') {
    const header=Math.min(70, Math.max(44,w*.13));
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${common}/>
      <path d="M ${x+header} ${y} V ${y+h}" fill="none" stroke="${esc(s.stroke)}" stroke-width="${s.strokeWidth}" vector-effect="non-scaling-stroke"/>`;
  }
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${common}/>`;
}
function textBox(node) {
  const {x,y,w=180,h=84,type} = node;
  if (type === 'custom-svg') {
    const pos=node.customSvg?.labelPosition||'none';
    if(pos==='bottom')return {x:x+10,y:y+h-38,w:w-20,h:32};
    if(pos==='top')return {x:x+10,y:y+8,w:w-20,h:32};
    if(pos==='center')return {x:x+w*.16,y:y+h*.22,w:w*.68,h:h*.56};
    return {x:x+10,y:y+h/2-12,w:w-20,h:24};
  }
  if (type === 'image') return {x:x+10,y:y+h-38,w:w-20,h:30};
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
  if (type === 'bookmark') return {x:x+12,y:y+10,w:w-24,h:h-34};
  if (type === 'tag') return {x:x+26,y:y+8,w:w-34,h:h-16};
  if (type === 'chevron') return {x:x+18,y:y+8,w:w-42,h:h-16};
  if (type === 'pentagon') return {x:x+w*.18,y:y+h*.2,w:w*.64,h:h*.58};
  if (type === 'octagon') return {x:x+w*.16,y:y+h*.16,w:w*.68,h:h*.68};
  if (type === 'hourglass') return {x:x+w*.22,y:y+h*.14,w:w*.56,h:h*.72};
  if (type === 'shield') return {x:x+w*.18,y:y+h*.22,w:w*.64,h:h*.55};
  if (type === 'gateway') return {x:x+w*.18,y:y+h*.18,w:w*.64,h:h*.64};
  if (type === 'decision') return {x:x+w*.16,y:y+h*.18,w:w*.68,h:h*.64};
  return {x:x+10,y:y+8,w:w-20,h:h-16};
}

export function wrapLabel(text, width, fontSize=15, maxLines=5) {
  const raw=String(text ?? '').trim();if(!raw)return [''];const maxChars=Math.max(3,Math.floor(width/Math.max(6,fontSize*.57)));const words=raw.split(/\s+/);const lines=[];let line='';
  for(const original of words){let word=original;while(word.length>maxChars){if(line){lines.push(line);line='';if(lines.length>=maxLines)break;}lines.push(word.slice(0,maxChars));word=word.slice(maxChars);if(lines.length>=maxLines)break;}if(lines.length>=maxLines)break;const test=line?`${line} ${word}`:word;if(test.length<=maxChars)line=test;else{if(line)lines.push(line);line=word;}if(lines.length>=maxLines)break;}
  if(line&&lines.length<maxLines)lines.push(line);const joined=lines.join(' ').replace(/…$/,'');if(lines.length===maxLines&&raw.length>joined.length)lines[maxLines-1]=`${lines[maxLines-1].slice(0,Math.max(1,maxChars-1))}…`;return lines;
}
function fittedText(node,tokens,box){
  const base=resolveNodeStyle(node,tokens);const auto=node.style?.autoTextFit!==false;const min=Math.max(8,Number(node.style?.minFontSize)||9);let size=base.fontSize;let lines=[];
  while(true){const lineH=size*1.28,maxLines=Math.max(1,Math.floor(box.h/lineH));lines=wrapLabel(node.label,box.w,size,maxLines);const truncated=lines.some(l=>l.endsWith('…'));if(!auto||(!truncated&&lines.length*lineH<=box.h+1)||size<=min)break;size-=1;}
  return {style:{...base,fontSize:size},lines};
}
export function nodeTextMarkup(node,tokens,{selected=false}={}) {
  if(node.type==='radial-plan'||node.type==='brain-map')return '';
  if(node.type==='image'&&!node.media?.showCaption)return '';
  if(node.type==='custom-svg'&&(node.customSvg?.labelPosition||'none')==='none')return '';
  const box=textBox(node);const fit=fittedText(node,tokens,box);const s=fit.style,lines=fit.lines;const lineH=s.fontSize*1.28;const startY=box.align==='start'?box.y+s.fontSize:box.y+box.h/2-((lines.length-1)*lineH)/2;const x=box.align==='start'?box.x:box.x+box.w/2;const anchor=box.align==='start'?'start':'middle';
  const captionBg=node.type==='image'?`<rect x="${box.x-6}" y="${box.y-5}" width="${box.w+12}" height="${box.h+10}" rx="8" fill="${esc(node.media?.captionBackground||'#00000099')}"/>`:'';
  return `${captionBg}<text x="${x}" y="${startY}" fill="${esc(node.type==='image'?(node.media?.captionColor||'#ffffff'):s.text)}" font-family="${esc(tokens.fontFamily)}" font-size="${s.fontSize}" font-weight="${s.fontWeight}" letter-spacing="${s.letterSpacing}" text-anchor="${anchor}" dominant-baseline="middle" pointer-events="none" class="node-label${selected?' is-selected':''}">${lines.map((line,i)=>`<tspan x="${x}" dy="${i===0?0:lineH}">${esc(s.textTransform==='uppercase'?line.toUpperCase():line)}</tspan>`).join('')}</text>`;
}

export function portPoint(node,port='right') {
  const {x,y,w=180,h=84}=node;
  const map={left:{x,y:y+h/2},right:{x:x+w,y:y+h/2},top:{x:x+w/2,y},bottom:{x:x+w/2,y:y+h},
    'top-left':{x:x+w*.25,y},'top-right':{x:x+w*.75,y},'bottom-left':{x:x+w*.25,y:y+h},'bottom-right':{x:x+w*.75,y:y+h}};
  return map[port]||map.right;
}

export function portVector(port='right'){
  if(port==='left')return{x:-1,y:0};if(port==='right')return{x:1,y:0};if(port==='top')return{x:0,y:-1};if(port==='bottom')return{x:0,y:1};
  if(port==='top-left')return{x:-.7,y:-.7};if(port==='top-right')return{x:.7,y:-.7};if(port==='bottom-left')return{x:-.7,y:.7};return{x:.7,y:.7};
}

export function nodePortNames(node,tokens={}){
  const count=Number(node.style?.portCount??tokens.portCount??4);
  return count>=8?['top','top-right','right','bottom-right','bottom','bottom-left','left','top-left']:count<=0?[]:['top','right','bottom','left'];
}

export function nearestPort(node, point, tokens={}) {
  const ports=nodePortNames(node,tokens);
  let best=ports[0]||'right',bestD=Infinity;
  for (const p of ports) {const pt=portPoint(node,p),d=(pt.x-point.x)**2+(pt.y-point.y)**2;if(d<bestD){bestD=d;best=p;}}
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
    const v1=portVector(edge.sourcePort||'right'),v2=portVector(edge.targetPort||'left');
    const c1={x:p1.x+v1.x*dx,y:p1.y+v1.y*dy},c2={x:p2.x+v2.x*dx,y:p2.y+v2.y*dy};
    d=`M ${p1.x} ${p1.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
  } else {
    const sv=portVector(edge.sourcePort||'right');const horizontal=Math.abs(sv.x)>=Math.abs(sv.y);
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
  const shape=node.style?.portShape??tokens.portShape??'circle',r=Number(tokens.portSize)||5.5;
  return nodePortNames(node,tokens).map(p=>{const pt=portPoint(node,p);if(shape==='square')return `<rect data-port="${p}" data-node-id="${esc(node.id)}" x="${pt.x-r}" y="${pt.y-r}" width="${r*2}" height="${r*2}" rx="1" fill="${esc(tokens.canvas)}" stroke="${esc(tokens.primary)}" stroke-width="2" vector-effect="non-scaling-stroke" class="port-handle"/>`;if(shape==='diamond')return `<rect data-port="${p}" data-node-id="${esc(node.id)}" x="${pt.x-r}" y="${pt.y-r}" width="${r*2}" height="${r*2}" transform="rotate(45 ${pt.x} ${pt.y})" fill="${esc(tokens.canvas)}" stroke="${esc(tokens.primary)}" stroke-width="2" vector-effect="non-scaling-stroke" class="port-handle"/>`;return `<circle data-port="${p}" data-node-id="${esc(node.id)}" cx="${pt.x}" cy="${pt.y}" r="${r}" fill="${esc(tokens.canvas)}" stroke="${esc(tokens.primary)}" stroke-width="2" vector-effect="non-scaling-stroke" class="port-handle"/>`;}).join('');
}
