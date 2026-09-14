(()=>{
'use strict';
const A=()=>window.__scoreApp;
const $=id=>document.getElementById(id);
let pendingPhoto='';
function msg(t){const a=A();if(a?.message)a.message(t);}
function validName(v){return /^[ぁ-ゖー・ 　]+$/.test(v);}
async function photoData(file){
 if(!file)return '';
 if(file.size>5*1024*1024)throw Error('顔写真は5 MB以内にしてください。');
 const bitmap=await createImageBitmap(file),side=Math.min(bitmap.width,bitmap.height),sx=(bitmap.width-side)/2,sy=(bitmap.height-side)/2;
 const c=document.createElement('canvas');c.width=192;c.height=192;c.getContext('2d').drawImage(bitmap,sx,sy,side,side,0,0,192,192);bitmap.close();
 return c.toDataURL('image/jpeg',.86);
}
function addStyles(){const s=document.createElement('style');s.textContent=`
.part-icon img{width:58px!important;height:58px!important;max-width:none!important;max-height:none!important;object-fit:cover!important;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px #0002}.part-icon:has(img){height:64px}.student-picker{display:flex;gap:10px;align-items:center;overflow-x:auto;padding:10px 20px 14px;background:#fffaf0;border-bottom:1px solid #eadfbe}.student-choice{flex:0 0 auto;display:grid;place-items:center;gap:3px;min-width:78px;padding:7px 9px}.student-choice img{width:54px;height:54px;border-radius:50%;object-fit:cover;border:3px solid #fff;box-shadow:0 2px 7px #0002}.student-choice.active{background:#fff0b8;border-color:#b88918}.student-choice .fallback{font-size:30px;height:54px;display:grid;place-items:center}.student-choice small{font-size:12px;color:#3c321e;font-weight:750}body.performing .student-picker{padding:8px 10px}body.performing .student-choice{min-width:88px}body.performing .student-choice img{width:62px;height:62px}body.performing .student-choice small{font-size:14px}.student-setup{padding:12px;background:#fffaf0;border:1px solid #e6d7ab;border-radius:10px;margin:10px 0 16px}.student-setup h3{margin:0 0 8px}.student-preview{display:flex;align-items:center;gap:10px;margin-top:8px}.student-preview img{width:64px;height:64px;border-radius:50%;object-fit:cover}.face-tool{background:#fff8dd!important}
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
   pendingPhoto='';$('studentName').value='';$('studentPhoto').value='';$('studentPreview').hidden=true;
   a.edited();a.score.mount(a.getViewPart());renderPicker();setTimeout(addFaceTools,0);
 },true);
}
function renderPicker(){
 const a=A();if(!a)return;let root=$('studentPicker');
 if(!root){root=document.createElement('div');root.id='studentPicker';root.className='student-picker';root.setAttribute('aria-label','じぶんの楽譜をえらぶ');$('score')?.before(root);}
 root.replaceChildren();
 const make=(part,label,all=false)=>{const b=document.createElement('button');b.className='student-choice'+(a.getViewPart()===(all?'all':part.id)?' active':'');if(all){const f=document.createElement('span');f.className='fallback';f.textContent='👥';b.append(f);}else if(part.image){const i=new Image();i.src=part.image;i.alt='';b.append(i);}else{const f=document.createElement('span');f.className='fallback';f.textContent=part.icon;b.append(f);}const n=document.createElement('small');n.textContent=label;b.append(n);b.onclick=()=>{a.showPart(all?'all':part.id);renderPicker();setTimeout(addFaceTools,0);};return b;};
 root.append(make(null,'みんな',true));for(const p of a.getProject().parts)root.append(make(p,p.studentName||p.name));
}
function addFaceTools(){
 const a=A();if(!a)return;document.querySelectorAll('.score-row').forEach(row=>{const label=row.querySelector('.part-label'),tools=row.querySelector('.part-tools');if(!label||!tools||tools.querySelector('.face-tool'))return;const title=label.querySelector('strong'),part=a.getProject().parts.find(p=>(p.studentName||p.name)===title?.textContent)||a.getProject().parts.find(p=>p.name===title?.textContent);if(!part)return;if(part.studentName)title.textContent=part.studentName;
 const b=document.createElement('button');b.className='face-tool';b.textContent='顔写真';b.onclick=()=>{const f=document.createElement('input');f.type='file';f.accept='image/png,image/jpeg,image/webp';f.onchange=async()=>{try{const d=await photoData(f.files?.[0]);if(!d)return;a.remember();part.image=d;a.edited();a.score.mount(a.getViewPart());renderPicker();setTimeout(addFaceTools,0);msg('顔写真を変更しました。');}catch(e){msg(e.message);}};f.click();};tools.insertBefore(b,tools.lastElementChild);});
}
function adaptExisting(){const a=A();if(!a)return;for(const p of a.getProject().parts){if(p.studentName&&!p.name)p.name=p.studentName;}const pitch=$('notePitch')?.closest('label');if(pitch)pitch.hidden=true;renderPicker();addFaceTools();}
function init(){if(!A())return setTimeout(init,30);addStyles();setupDialog();adaptExisting();const mo=new MutationObserver(()=>{renderPicker();addFaceTools();});mo.observe($('score'),{childList:true,subtree:true});$('performBtn')?.addEventListener('click',()=>setTimeout(()=>{renderPicker();addFaceTools();},20));$('exitPerformBtn')?.addEventListener('click',()=>setTimeout(()=>{renderPicker();addFaceTools();},20));}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();