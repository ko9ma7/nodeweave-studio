const AUTOSAVE_KEY='nodeweave:autosave:v1';
const PROJECTS_KEY='nodeweave:projects:v1';
const UI_KEY='nodeweave:ui:v1';

export function safeParse(raw,fallback=null){ try{return raw?JSON.parse(raw):fallback;}catch{return fallback;} }
export function loadAutosave(){ return safeParse(localStorage.getItem(AUTOSAVE_KEY)); }
export function saveAutosave(doc){ try{localStorage.setItem(AUTOSAVE_KEY,JSON.stringify(doc));return true;}catch{return false;} }
export function clearAutosave(){ localStorage.removeItem(AUTOSAVE_KEY); }

export function listProjects(){ return safeParse(localStorage.getItem(PROJECTS_KEY),[]) || []; }
export function saveProject(name,doc){
  const list=listProjects();
  const now=new Date().toISOString();
  const id=doc.meta?.projectId || crypto.randomUUID();
  const item={id,name:name||doc.meta?.name||'Untitled diagram',updatedAt:now,doc:{...doc,meta:{...doc.meta,projectId:id,name:name||doc.meta?.name||'Untitled diagram',updatedAt:now}}};
  const next=[item,...list.filter(p=>p.id!==id)].slice(0,20);
  localStorage.setItem(PROJECTS_KEY,JSON.stringify(next));
  return item;
}
export function deleteProject(id){ localStorage.setItem(PROJECTS_KEY,JSON.stringify(listProjects().filter(p=>p.id!==id))); }
export function loadUiPrefs(){ return safeParse(localStorage.getItem(UI_KEY),{theme:'system'}); }
export function saveUiPrefs(prefs){ localStorage.setItem(UI_KEY,JSON.stringify(prefs)); }
