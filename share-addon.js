(()=>{
'use strict';
const A=()=>window.__scoreApp;
const $=id=>document.getElementById(id);
let preparedFile=null;

function safeName(v){
 return String(v||'デジタル絵譜').replace(/[\\/:*?"<>|]/g,'_').replace(/\s+/g,' ').trim().slice(0,60)||'デジタル絵譜';
}
function bytes(n){
 if(n<1024)return n+' B';
 if(n<1024*1024)return (n/1024).toFixed(1)+' KB';
 return (n/1024/1024).toFixed(1)+' MB';
}
function msg(t){A()?.message?.(t);}
function addStyles(){
 const s=document.createElement('style');s.textContent=`
.share-open{background:#f4f0ff!important;border-color:#9482ca!important}
.share-import-open{background:#eef8f1!important;border-color:#7eaf8b!important}
.share-modal{width:min(560px,calc(100% - 24px))}
.share-box{padding:14px;border:1px solid #dfd4b9;border-radius:12px;background:#fffaf0}
.share-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.share-actions button{min-height:50px;flex:1 1 180px}
.share-note{font-size:12px;color:#736743;line-height:1.7}
.share-ready{font-weight:800;color:#257334}
.share-step{margin:6px 0;font-weight:750}
`;document.head.append(s);
}
function makeUI(){
 if($('shareLessonBtn'))return;
 const actions=$('performanceArea')?.querySelector('.workspace-heading .actions');

 const shareBtn=document.createElement('button');
 shareBtn.id='shareLessonBtn';
 shareBtn.className='share-open';
 shareBtn.textContent='共有する';

 const importBtn=document.createElement('button');
 importBtn.id='importSharedLessonBtn';
 importBtn.className='share-import-open';
 importBtn.textContent='共有教材を読み込む';

 if(actions){actions.prepend(importBtn);actions.prepend(shareBtn);}
 else{document.body.append(shareBtn,importBtn);}

 const input=document.createElement('input');
 input.id='sharedLessonFile';
 input.type='file';
 input.accept='.dscore,.enscore,application/octet-stream';
 input.hidden=true;
 document.body.append(input);

 const d=document.createElement('dialog');
 d.id='shareLessonModal';
 d.className='share-modal';
 d.innerHTML=`
  <div class="dialog-head"><h2>教材を共有</h2><button id="shareClose">閉じる</button></div>
  <div class="share-box">
   <p id="shareStatus">絵譜・顔写真・設定・音源を1つの共有教材ファイルにまとめます。</p>
   <div class="share-actions">
    <button id="shareNative" class="primary" disabled>AirDrop / LINEで共有</button>
    <button id="shareSave" disabled>共有教材を保存</button>
   </div>
   <hr>
   <p class="share-step">受け取る側</p>
   <p class="share-note">AirDropやLINEで受け取ったファイルを「ファイル」に保存し、このアプリの「共有教材を読み込む」から選んでください。ファイル自体をタップして開く必要はありません。</p>
  </div>`;
 document.body.append(d);

 shareBtn.onclick=()=>prepareShare();
 importBtn.onclick=()=>input.click();
 input.onchange=()=>importShared(input.files?.[0]);
 $('shareClose').onclick=()=>d.close();
 $('shareNative').onclick=()=>nativeShare();
 $('shareSave').onclick=()=>downloadPrepared();
}
async function buildPortableLesson(){
 const a=A(),project=a?.getProject?.(),media=a?.getMediaBlob?.();
 if(!project||!media||!media.size)throw Error('先に音源入りの教材を開いてください。');
 const snapshot=structuredClone(project);
 if(!snapshot.media)snapshot.media={name:'共有音源',type:media.type||'application/octet-stream',size:media.size};
 snapshot.media.size=media.size;
 if(!snapshot.media.type)snapshot.media.type=media.type||'application/octet-stream';
 const meta=new TextEncoder().encode(JSON.stringify(snapshot));
 const header=new ArrayBuffer(12),view=new DataView(header),magic=[68,83,72,65,82,69,49,10];
 magic.forEach((b,i)=>view.setUint8(i,b));
 view.setUint32(8,meta.length,false);
 return new Blob([header,meta,media],{type:'application/octet-stream'});
}
async function prepareShare(){
 const d=$('shareLessonModal');
 d.showModal();
 preparedFile=null;
 $('shareNative').disabled=true;
 $('shareSave').disabled=true;
 $('shareStatus').textContent='共有教材を準備しています…';
 try{
  const blob=await buildPortableLesson();
  const name=safeName(A()?.getProject?.()?.title)+'.dscore';
  preparedFile=new File([blob],name,{type:'application/octet-stream'});
  $('shareStatus').innerHTML='<span class="share-ready">✓ 準備できました</span>　'+bytes(preparedFile.size);
  $('shareSave').disabled=false;
  const canNative=!!(navigator.share&&navigator.canShare?.({files:[preparedFile]}));
  $('shareNative').disabled=!canNative;
  if(!canNative)$('shareStatus').insertAdjacentHTML('beforeend','<br><span class="share-note">この端末では直接共有できないため「共有教材を保存」を使ってください。</span>');
 }catch(e){
  console.error(e);
  $('shareStatus').textContent=e.message||'共有教材を作れませんでした。';
 }
}
async function nativeShare(){
 if(!preparedFile)return;
 try{
  await navigator.share({
   files:[preparedFile],
   title:A()?.getProject?.()?.title||'デジタル絵譜'
  });
 }catch(e){
  if(e?.name!=='AbortError'){
   console.error(e);
   msg('直接共有できなかったため、ファイルとして保存してください。');
  }
 }
}
function downloadPrepared(){
 if(!preparedFile)return;
 const a=document.createElement('a');
 const url=URL.createObjectURL(preparedFile);
 a.href=url;
 a.download=preparedFile.name;
 document.body.append(a);
 a.click();
 a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
}
async function importShared(file){
 const input=$('sharedLessonFile');
 try{
  if(!file)return;
  msg('共有教材を読み込んでいます…');
  const a=A();
  if(!a?.syncLoadShared)throw Error('共有教材の読み込み機能を準備できませんでした。');
  let firstError=null;
  try{
   if(file.size<13)throw Error('ファイルサイズが小さすぎます。');
   const head=await file.slice(0,12).arrayBuffer(),view=new DataView(head),len=view.getUint32(8,false);
   if(!len||len>5000000||12+len>=file.size)throw Error('メタデータ長が不正です。');
   const text=await file.slice(12,12+len).text();
   const project=JSON.parse(text);
   const audio=file.slice(12+len,file.size,project?.media?.type||'application/octet-stream');
   if(!audio.size)throw Error('音源データがありません。');
   const result=await a.syncLoadShared(project,audio);
   msg('「'+(result?.title||'教材')+'」を読み込みました。');
   a.showPart?.('all');
   return;
  }catch(e){firstError=e;console.warn('直接読み込みに失敗',e);}
  if(a?.syncImportBundle){
   try{
    const result=await a.syncImportBundle(file);
    msg('「'+(result?.title||'教材')+'」を読み込みました。');
    a.showPart?.('all');
    return;
   }catch(e){
    console.warn('旧方式でも失敗',e);
    throw Error('直接読込: '+(firstError?.message||'不明')+' ／ 旧方式: '+(e?.message||'不明'));
   }
  }
  throw firstError||Error('共有教材を読み込めませんでした。');
 }catch(e){
  console.error(e);
  const detail='共有教材を読み込めませんでした：'+(e?.message||'原因不明')+'（'+file.name+' / '+bytes(file.size)+'）';
  msg(detail);
  alert(detail);
 }finally{
  if(input)input.value='';
 }
}
function init(){
 if(!A())return setTimeout(init,50);
 addStyles();
 makeUI();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})();