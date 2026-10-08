const CACHE_PREFIX='flowing-score-simple-';
const CACHE='flowing-score-simple-v3.7.10';
const ASSETS=['./','./index.html','./face-addon.js','./sync-addon.js','./share-addon.js','./manifest.webmanifest','./embedded/app.gz.b64','./fonts/BIZUDPGothic-Regular.ttf','./fonts/BIZUDPGothic-Bold.ttf','./fonts/OFL.txt'];
// An older worker or HTTP cache may still hold the previous index and addons.
// Refresh every release asset before activating the new offline cache.
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(path=>new Request(path,{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(CACHE_PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const u=new URL(e.request.url);
 if(u.origin!==self.location.origin)return;
 e.respondWith(
  fetch(e.request).then(async r=>{
   if(r.ok){const c=await caches.open(CACHE);await c.put(e.request,r.clone());}
   return r;
  }).catch(async()=>{
   const cached=await caches.match(e.request,{ignoreSearch:true});
   if(cached)return cached;
   if(e.request.mode==='navigate')return caches.match('./index.html');
   throw Error('offline asset unavailable');
  })
 );
});
