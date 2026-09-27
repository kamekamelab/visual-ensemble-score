(()=>{
'use strict';
const A=()=>window.__scoreApp;
const $=id=>document.getElementById(id);
let preparedFile=null;

const PACK_FROM="  validateProject(project);\\n  if(!mediaBlob || mediaBlob.size!==project.media?.size) throw Error('教材に含める音源がありません。');\\n  const meta=new TextEncoder().encode(JSON.stringify(project));";
const PACK_TO="  if(!mediaBlob || !mediaBlob.size) throw Error('教材に含める音源がありません。');\\n  const snapshot=structuredClone(project);\\n  if(!snapshot.media)throw Error('教材に含める音源がありません。');\\n  snapshot.media.size=mediaBlob.size;\\n  validateProject(snapshot);\\n  const meta=new TextEncoder().encode(JSON.stringify(snapshot));";
const UNPACK_FROM="  if(project.media?.size!==file.size-12-len)throw Error('教材内の音源が不足しています。');\\n  return {project,blob:file.slice(12+len,file.size,project.media.type)};";
const UNPACK_TO="  const mediaStart=12+len,actualSize=file.size-mediaStart;\\n  if(!project.media||actualSize<=0)throw Error('教材内に音源データがありません。');\\n  if(project.media.size!==actualSize)project.media.size=actualSize;\\n  return {project,blob:file.slice(mediaStart,file.size,project.media.type)};";

function safeName(v){
 return String(v||'デジタル絵譜').replace(/[\\/:*?"<>|]/g,'_').replace(/\\s+/g,' ').trim().slice(0,60)||'デジタル絵譜';
}
function bytes(n){
 if(n<1024)return n+' B';
 if(n<1024*1024)return (n/1024).toFixed(1)+' KB';
 return (n/1024/1024).toFixed(1)+' MB';
}
function blobToB64(blob){
 return blob.arrayBuffer().then(buf=>{
  const u=new Uint8Array(buf),step=0x8000;let s='';
  for(let i=0;i<u.length;i+=step)s+=String.fromCharCode(...u.subarray(i,i+step));
  return btoa(s);
 });
}
function escapeScript(s){return String(s).replace(/<\\/script/gi,'<\\/scr'+'ipt');}
function addStyles(){
 const s=document.createElement('style');s.textContent=`
.share-open{background:#f4f0ff!important;border-color:#9482ca!important}
.share-modal{width:min(540px,calc(100% - 24px))}
.share-box{padding:14px;border:1px solid #dfd4b9;border-radius:12px;background:#fffaf0}
.share-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.share-actions button{min-height:50px;flex:1 1 180px}
.share-note{font-size:12px;color:#736743;line-height:1.6}
.share-ready{font-weight:800;color:#257334}
`;document.head.append(s);
}
function makeUI(){
 if($('shareLessonBtn'))return;
 const btn=document.createElement('button');btn.id='shareLessonBtn';btn.className='share-open';btn.textContent='共有する';
 const actions=$('performanceArea')?.querySelector('.workspace-heading .actions');
 if(actions)actions.prepend(btn);else document.body.append(btn);
 const d=document.createElement('dialog');d.id='shareLessonModal';d.className='share-modal';d.innerHTML=`
 <div class="dialog-head"><h2>教材を共有</h2><button id="shareClose">閉じる</button></div>
 <div class="share-box">
   <p id="shareStatus">共有用HTMLを準備します。</p>
   <p class="share-note">絵譜・顔写真・設定・音源を1つのHTMLにまとめます。受け取った端末では専用アプリがなくても開けます。顔写真も含まれます。</p>
   <div class="share-actions">
     <button id="shareNative" class="primary" disabled>AirDrop / LINEで共有</button>
     <button id="shareSave" disabled>HTMLを保存</button>
   </div>
 </div>`;
 document.body.append(d);
 btn.onclick=()=>prepareShare();
 $('shareClose').onclick=()=>d.close();
 $('shareNative').onclick=()=>nativeShare();
 $('shareSave').onclick=()=>downloadPrepared();
}
async function buildStandalone(){
 const a=A();
 if(!a?.syncExportBundle)throw Error('教材を書き出せませんでした。');
 const bundle=await a.syncExportBundle();
 const [c0,c1,c2,faceCode]=await Promise.all([
  fetch('./embedded/gz0.txt',{cache:'no-store'}).then(r=>r.text()),
  fetch('./embedded/gz1.txt',{cache:'no-store'}).then(r=>r.text()),
  fetch('./embedded/gz2.txt',{cache:'no-store'}).then(r=>r.text()),
  fetch('./face-addon.js',{cache:'no-store'}).then(r=>r.text())
 ]);
 const chunks=[c0.trim(),c1.trim(),c2.trim()];
 const bundleB64=await blobToB64(bundle);
 const expose="window.__scoreApp={INSTRUMENTS,addPart,edited,score,remember,message,getProject:()=>project,getViewPart:()=>viewPart,showPart:(id)=>{viewPart=id;const s=$('partView');if(s)s.value=id;score.mount(id);renderControls();},enterPerformance:()=>setPerform(true),syncImportBundle:async(blob)=>{if(!blob||!blob.size)throw Error('共有教材が空です。');pause();const loaded=await unpackProject(blob);loaded.project.id=uid();project=loaded.project;resetHistory();viewPart='all';setMedia(loaded.blob);score.mount();edited();await flushSave();window.dispatchEvent(new Event('score-project-loaded'));return {title:project.title};}};\\ninit();\\n\\nreturn {};";
 const auto="(async()=>{try{const b64="+JSON.stringify(bundleB64)+",bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);const blob=new Blob([u],{type:'application/octet-stream'});let n=0;while(!window.__scoreApp?.syncImportBundle&&n++<300)await new Promise(r=>setTimeout(r,20));if(!window.__scoreApp?.syncImportBundle)throw Error('教材を開けませんでした。');await window.__scoreApp.syncImportBundle(blob);window.__scoreApp.showPart?.('all');}catch(e){console.error(e);alert('共有教材を開けませんでした。');}})();";
 const innerInject='<style>#sharedBadge{position:fixed;left:6px;bottom:4px;z-index:9999;font-size:10px;color:#777;opacity:.4;pointer-events:none}</style><div id="sharedBadge">共有用HTML</div><script>'+escapeScript(faceCode)+'<\\/script><script>'+escapeScript(auto)+'<\\/script></body></html>';
 const loader=`<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>共有デジタル絵譜</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;background:#faf7ea;color:#3c321e;margin:0;display:grid;place-items:center;min-height:100vh}#msg{padding:24px;text-align:center;font-weight:700}</style></head>
<body><div id="msg">共有されたデジタル絵譜を開いています…</div><script>
(async()=>{
 try{
  const parts=${JSON.stringify(chunks)};
  const b64=parts.join(''),bin=atob(b64),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  let html=await new Response(stream).text();
  html=html.replace(${JSON.stringify(PACK_FROM)},${JSON.stringify(PACK_TO)});
  html=html.replace(${JSON.stringify(UNPACK_FROM)},${JSON.stringify(UNPACK_TO)});
  const expose=${JSON.stringify(expose)};
  html=html.replace('init();\\n\\nreturn {};',expose);
  html=html.replace('</body></html>',${JSON.stringify(innerInject)});
  document.open();document.write(html);document.close();
 }catch(e){console.error(e);document.getElementById('msg').innerHTML='共有教材を開けませんでした。';}
})();
<\\/script></body></html>`;
 return new Blob([loader],{type:'text/html'});
}
async function prepareShare(){
 const d=$('shareLessonModal');d.showModal();
 preparedFile=null;$('shareNative').disabled=true;$('shareSave').disabled=true;
 $('shareStatus').textContent='共有用HTMLを準備しています…';
 try{
   const blob=await buildStandalone(),title=safeName(A()?.getProject?.()?.title);
   preparedFile=new File([blob],title+'.html',{type:'text/html'});
   $('shareStatus').innerHTML='<span class="share-ready">✓ 準備できました</span>　'+bytes(preparedFile.size);
   $('shareSave').disabled=false;
   $('shareNative').disabled=!(navigator.share&&navigator.canShare?.({files:[preparedFile]}));
   if($('shareNative').disabled)$('shareStatus').insertAdjacentHTML('beforeend','<br><span class="share-note">この端末では直接共有できないため「HTMLを保存」を使ってください。</span>');
 }catch(e){
   console.error(e);$('shareStatus').textContent=e.message||'共有用HTMLを作れませんでした。';
 }
}
async function nativeShare(){
 if(!preparedFile)return;
 try{await navigator.share({files:[preparedFile],title:A()?.getProject?.()?.title||'デジタル絵譜'});}
 catch(e){if(e?.name!=='AbortError'){console.error(e);downloadPrepared();}}
}
function downloadPrepared(){
 if(!preparedFile)return;
 const a=document.createElement('a'),url=URL.createObjectURL(preparedFile);
 a.href=url;a.download=preparedFile.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function init(){if(!A())return setTimeout(init,50);addStyles();makeUI();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();