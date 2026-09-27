(()=>{
'use strict';
const A=()=>window.__scoreApp;
const $=id=>document.getElementById(id);
let pendingPhoto='';
let selectedIds=new Set();
let selectionReady=false;
let applyingSelection=false;
function msg(t){const a=A();if(a?.message)a.message(t);}
function validName(v){return /^[ぁ-ゖー・ 　]+$/.test(v);}
async function photoData(file){
 if(!file)return '';
 if(file.size>5*1024*1024)throw Error('顔写真は5 MB以内にしてください。');
 const bitmap=await createImageBitmap(file),side=Math.min(bitmap.width,bitmap.height),sx=(bitmap.width-side)/2,sy=bitmap.height>bitmap.width?Math.max(0,(bitmap.height-side)*.28):(bitmap.height-side)/2;
 const c=document.createElement('canvas');c.width=192;c.height=192;c.getContext('2d').drawImage(bitmap,sx,sy,side,side,0,0,192,192);bitmap.close();
 return c.toDataURL('image/jpeg',.86);
}
function addStyles(){const s=document.createElement('style');s.textContent=`
.part-icon img{width:76px!important;height:76px!important;max-width:none!important;max-height:none!important;object-fit:cover!important;object-position:center 38%!important;border-radius:50%;border:3px solid #fff;box-shadow:0 3px 10px #0003}.part-icon:has(img){height:82px}.student-picker{display:flex;gap:10px;align-items:center;overflow-x:auto;padding:10px 20px 14px;background:#fffaf0;border-bottom:1px solid #eadfbe}.student-picker-guide{flex:0 0 auto;font-size:13px;font-weight:800;color:#6b5a31;margin-right:2px}.student-choice{position:relative;flex:0 0 auto;display:grid;place-items:center;gap:3px;min-width:78px;padding:7px 9px}.student-choice.active:after{content:"✓";position:absolute;right:3px;top:3px;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:#2f7d32;color:#fff;font-size:14px;font-weight:900;box-shadow:0 2px 5px #0003}.student-choice img{width:70px;height:70px;border-radius:50%;object-fit:cover;object-position:center 38%;border:3px solid #fff;box-shadow:0 2px 8px #0003}.student-choice.active{background:#fff0b8;border-color:#b88918}.student-choice .fallback{font-size:30px;height:54px;display:grid;place-items:center}.student-choice small{font-size:12px;color:#3c321e;font-weight:750}body.performing .student-picker{padding:8px 10px}body.performing .student-choice{min-width:112px}body.performing .student-choice img{width:92px;height:92px}body.performing .student-choice small{font-size:16px}body.performing .part-icon:has(img){height:112px!important}body.performing .part-icon img{width:104px!important;height:104px!important}body.performing .part-label strong{font-size:24px!important}.student-setup{padding:12px;background:#fffaf0;border:1px solid #e6d7ab;border-radius:10px;margin:10px 0 16px}.student-setup h3{margin:0 0 8px}.student-preview{display:flex;align-items:center;gap:10px;margin-top:8px}.student-preview img{width:84px;height:84px;border-radius:50%;object-fit:cover;object-position:center 38%}.face-tool{background:#fff8dd!important}
`;document.head.append(s);}
function setupDialog(){
 const form=$('partForm');if(!form||$('studentName'))return;
 const grid=$('instrumentGrid'),box=document.createElement('div');box.className='student-setup';box.innerHTML='<h3>① この子を登録</h3><label>なまえ（ひらがな）<input id="studentName" maxlength="20" placeholder="例：ゆうか"></label><label>顔写真<input id="studentPhoto" type="file" accept="image/png,image/jpeg,image/webp" capture="user"></label><div id="studentPreview" class="student-preview" hidden><img alt=""><b></b></div><p class="hint">顔写真が、今までの太鼓や鈴などの楽器イラストの場所に表示されます。</p><h3>② 楽器をえらぶ</h3>';
 grid.parentNode.insertBefore(box,grid);
 const photo=$('studentPhoto');photo.onchange=async()=>{try{pendingPhoto=await photoData(photo.files?.[0]);const p=$('studentPreview');p.hidden=!pendingPhoto;if(pendingPhoto)p.querySelector('img').src=pendingPhoto;}catch(e){pendingPhoto='';msg(e.message);}};
 $('studentName').oninput=()=>{const p=$('studentPreview');p.querySelector('b').textContent=$('studentName').value;};
 // Take over preset instrument buttons so the child data is attached before saving.
 grid.addEventListener('click',e=>{
   const b=e.target.closest('button');if(!b)return;
   e.preventDefault();e.stopImmediatePropagation();
   const buttons=[...grid.querySelectorAll('button')],idx=buttons.indexOf(b),a=A(),name=$('studentName').value.trim();
   if(!name)return msg('なまえをひらがなで入力してください。');
   if(!validName(name))return msg('なまえはひらがなで入力してください。');
   if(!pendingPhoto)return msg('顔写真を選んでください。');
   const instrument=a.INSTRUMENTS[idx];if(!instrument)return;
   const part=a.addPart(instrument);if(!part)return;
   part.instrumentName=part.name;part.studentName=name;part.name=name;part.image=pendingPhoto;
   selectedIds.add(part.id);selectionReady=true;
   pendingPhoto='';$('studentName').value='';$('studentPhoto').value='';$('studentPreview').hidden=true;
   a.edited();a.score.mount(a.getViewPart());renderPicker();setTimeout(addFaceTools,0);
 },true);
}
function syncSelection(){
 const a=A();if(!a)return[];const parts=a.getProject().parts||[],ids=new Set(parts.map(p=>p.id));
 for(const id of [...selectedIds])if(!ids.has(id))selectedIds.delete(id);
 if(!selectionReady){
   const current=a.getViewPart();
   if(current&&current!=='all'&&ids.has(current))selectedIds.add(current);
   else parts.forEach(p=>selectedIds.add(p.id));
   selectionReady=true;
 }
 if(parts.length&&!selectedIds.size)selectedIds.add(parts[0].id);
 return parts;
}
function allSelected(parts){return !!parts.length&&parts.every(p=>selectedIds.has(p.id));}
function applySelection(){
 const a=A();if(!a||applyingSelection)return;const parts=syncSelection();if(!parts.length)return;
 applyingSelection=true;
 try{
   if(a.getViewPart()!=='all'){a.showPart('all');setTimeout(()=>{applyingSelection=false;applySelection();renderPicker();addFaceTools();},0);return;}
   const rows=[...document.querySelectorAll('#score .score-row')];
   rows.forEach((row,i)=>{const p=parts[i];if(!p)return;row.dataset.studentPartId=p.id;row.hidden=!selectedIds.has(p.id);});
 }finally{if(a.getViewPart()==='all')applyingSelection=false;}
}
function renderPicker(){
 const a=A();if(!a)return;const parts=syncSelection();let root=$('studentPicker');
 if(!root){root=document.createElement('div');root.id='studentPicker';root.className='student-picker';root.setAttribute('aria-label','演奏する絵譜をえらぶ。複数選べます');$('score')?.before(root);}
 root.replaceChildren();
 const guide=document.createElement('span');guide.className='student-picker-guide';guide.textContent='演奏する絵譜（複数えらべます）';root.append(guide);
 const make=(part,label,all=false)=>{
   const active=all?allSelected(parts):selectedIds.has(part.id),b=document.createElement('button');
   b.className='student-choice'+(active?' active':'');b.type='button';b.setAttribute('aria-pressed',String(active));
   if(all){const f=document.createElement('span');f.className='fallback';f.textContent='👥';b.append(f);}
   else if(part.image){const i=new Image();i.src=part.image;i.alt='';b.append(i);}
   else{const f=document.createElement('span');f.className='fallback';f.textContent=part.icon;b.append(f);}
   const n=document.createElement('small');n.textContent=label;b.append(n);
   b.onclick=()=>{
     if(all){selectedIds=new Set(parts.map(p=>p.id));}
     else if(selectedIds.has(part.id)){
       if(selectedIds.size===1){msg('1人以上えらんでください。');return;}
       selectedIds.delete(part.id);
     }else selectedIds.add(part.id);
     if(a.getViewPart()!=='all')a.showPart('all');
     setTimeout(()=>{applySelection();renderPicker();addFaceTools();},0);
   };
   return b;
 };
 root.append(make(null,'みんな',true));for(const p of parts)root.append(make(p,p.studentName||p.name));
 applySelection();
}
function addFaceTools(){
 const a=A();if(!a)return;document.querySelectorAll('.score-row').forEach(row=>{const label=row.querySelector('.part-label'),tools=row.querySelector('.part-tools');if(!label||!tools||tools.querySelector('.face-tool'))return;const title=label.querySelector('strong'),part=a.getProject().parts.find(p=>(p.studentName||p.name)===title?.textContent)||a.getProject().parts.find(p=>p.name===title?.textContent);if(!part)return;if(part.studentName)title.textContent=part.studentName;
 const b=document.createElement('button');b.className='face-tool';b.textContent='顔写真';b.onclick=()=>{const f=document.createElement('input');f.type='file';f.accept='image/png,image/jpeg,image/webp';f.onchange=async()=>{try{const d=await photoData(f.files?.[0]);if(!d)return;a.remember();part.image=d;a.edited();a.score.mount(a.getViewPart());renderPicker();setTimeout(addFaceTools,0);msg('顔写真を変更しました。');}catch(e){msg(e.message);}};f.click();};tools.insertBefore(b,tools.lastElementChild);});
}
function adaptExisting(){const a=A();if(!a)return;for(const p of a.getProject().parts){if(p.studentName&&!p.name)p.name=p.studentName;}const pitch=$('notePitch')?.closest('label');if(pitch)pitch.hidden=true;syncSelection();renderPicker();applySelection();addFaceTools();}
function init(){if(!A())return setTimeout(init,30);addStyles();setupDialog();adaptExisting();const mo=new MutationObserver(()=>{applySelection();renderPicker();addFaceTools();});mo.observe($('score'),{childList:true,subtree:true});$('performBtn')?.addEventListener('click',()=>setTimeout(()=>{renderPicker();addFaceTools();},20));$('exitPerformBtn')?.addEventListener('click',()=>setTimeout(()=>{renderPicker();addFaceTools();},20));}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();