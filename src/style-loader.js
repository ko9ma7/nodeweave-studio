import { THEMES } from './catalog.js';

const mergeTheme=(raw)=>{
  if(!raw?.id||!raw?.tokens)return null;
  return {
    id:String(raw.id),
    label:String(raw.label||raw.id),
    description:String(raw.description||''),
    category:String(raw.category||'Style'),
    tokens:{...raw.tokens}
  };
};

export async function loadStylePacks(){
  try{
    const res=await fetch('./catalog/styles.json',{cache:'no-store'});
    if(!res.ok)throw new Error(`styles.json ${res.status}`);
    const data=await res.json();
    const styles=Array.isArray(data?.styles)?data.styles.map(mergeTheme).filter(Boolean):[];
    for(const theme of styles){
      const index=THEMES.findIndex(t=>t.id===theme.id);
      if(index>=0)THEMES[index]={...THEMES[index],...theme,tokens:{...THEMES[index].tokens,...theme.tokens}};
      else THEMES.push(theme);
    }
    return styles;
  }catch(error){
    console.warn('[NodeWeave] style packs unavailable',error);
    return [];
  }
}
