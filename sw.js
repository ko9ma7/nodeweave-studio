const CACHE='nodeweave-v1';
const SHELL=['./','./index.html','./src/styles.css','./src/app.js','./src/catalog.js','./src/geometry.js','./src/export.js','./src/storage.js','./assets/favicon.svg','./manifest.webmanifest'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{const copy=response.clone();if(new URL(event.request.url).origin===location.origin)caches.open(CACHE).then(c=>c.put(event.request,copy));return response;}).catch(()=>caches.match('./index.html'))));});
