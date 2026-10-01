self.onmessage=e=>{
  const {id,text}=e.data||{};
  try{
    if(typeof text!=='string')throw new Error('SVG text missing');
    const bytes=new TextEncoder().encode(text).length;
    if(bytes>8_000_000)throw new Error('SVG가 8MB를 초과합니다. 먼저 SVG 최적화를 권장합니다.');
    let cleaned=text
      .replace(/<!DOCTYPE[\s\S]*?>/gi,'')
      .replace(/<!--([\s\S]*?)-->/g,'')
      .replace(/<metadata\b[\s\S]*?<\/metadata>/gi,'')
      .replace(/<sodipodi:namedview\b[\s\S]*?<\/sodipodi:namedview>/gi,'')
      .replace(/\s(?:inkscape|sodipodi):[\w-]+=(["']).*?\1/gi,'');
    const pathCount=(cleaned.match(/<path\b/gi)||[]).length;
    const elementCount=(cleaned.match(/<(?:path|rect|circle|ellipse|line|polyline|polygon|g|use)\b/gi)||[]).length;
    const colors=[...new Set((cleaned.match(/#[0-9a-fA-F]{6}\b/g)||[]).map(v=>v.toLowerCase()))].slice(0,24);
    self.postMessage({id,ok:true,cleaned,stats:{bytes,pathCount,elementCount,colors,optimizedBytes:new TextEncoder().encode(cleaned).length}});
  }catch(error){self.postMessage({id,ok:false,error:error?.message||String(error)});}
};