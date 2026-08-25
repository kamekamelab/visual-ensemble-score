'use strict';

const DB_NAME = 'digital-ensemble-score-db';
const DB_VERSION = 1;
const STORE_SONGS = 'songs';
const STORE_INSTRUMENTS = 'customInstruments';
const STORE_PATTERNS = 'patterns';
const STORE_PROJECTS = 'projects';
const PX_PER_BEAT = 112;
const PRE_ROLL_BEATS = 4;
const PRAISES = ['バッチリ！','すごい！','ピッタリ！','いい音！','みんなでそろった！','やったね！'];

const BUILTIN_INSTRUMENTS = [
  {id:'taiko',name:'太鼓',cat:'打楽器',icon:'🥁'}, {id:'snare',name:'小太鼓',cat:'打楽器',icon:'🥁'}, {id:'bassdrum',name:'大太鼓',cat:'打楽器',icon:'🥁'}, {id:'timpani',name:'ティンパニ',cat:'打楽器',icon:'🥁'}, {id:'handdrum',name:'ハンドドラム',cat:'打楽器',icon:'🪘'},
  {id:'tambourine',name:'タンバリン',cat:'打楽器',icon:'🪘'}, {id:'castanet',name:'カスタネット',cat:'打楽器',icon:'◒'}, {id:'triangle',name:'トライアングル',cat:'打楽器',icon:'△'},
  {id:'cymbal',name:'シンバル',cat:'打楽器',icon:'◉'}, {id:'bell',name:'鈴',cat:'打楽器',icon:'🔔'}, {id:'handbell',name:'ハンドベル',cat:'打楽器',icon:'🔔'},
  {id:'woodblock',name:'ウッドブロック',cat:'打楽器',icon:'▰'}, {id:'claves',name:'クラベス',cat:'打楽器',icon:'╱╲'}, {id:'maracas',name:'マラカス',cat:'打楽器',icon:'🪇'},
  {id:'guiro',name:'ギロ',cat:'打楽器',icon:'▥'}, {id:'conga',name:'コンガ',cat:'打楽器',icon:'🪘'}, {id:'bongo',name:'ボンゴ',cat:'打楽器',icon:'🪘'}, {id:'cabasa',name:'カバサ',cat:'打楽器',icon:'◎'}, {id:'agogo',name:'アゴゴベル',cat:'打楽器',icon:'🔔'}, {id:'cowbell',name:'カウベル',cat:'打楽器',icon:'🔔'},
  {id:'xylophone',name:'木琴',cat:'鍵盤',icon:'🎼'}, {id:'glockenspiel',name:'鉄琴',cat:'鍵盤',icon:'🎼'}, {id:'marimba',name:'マリンバ',cat:'鍵盤',icon:'🎼'}, {id:'vibraphone',name:'ビブラフォン',cat:'鍵盤',icon:'🎼'}, {id:'chime',name:'チャイム',cat:'鍵盤',icon:'🔔'},
  {id:'piano',name:'ピアノ',cat:'鍵盤',icon:'🎹'}, {id:'keyboard',name:'キーボード',cat:'鍵盤',icon:'🎹'}, {id:'organ',name:'オルガン',cat:'鍵盤',icon:'🎹'}, {id:'melodica',name:'鍵盤ハーモニカ',cat:'鍵盤',icon:'🎹'},
  {id:'recorder',name:'リコーダー',cat:'管楽器',icon:'🪈'}, {id:'flute',name:'フルート',cat:'管楽器',icon:'🪈'}, {id:'clarinet',name:'クラリネット',cat:'管楽器',icon:'♩'},
  {id:'sax',name:'サクソフォン',cat:'管楽器',icon:'🎷'}, {id:'trumpet',name:'トランペット',cat:'管楽器',icon:'🎺'}, {id:'trombone',name:'トロンボーン',cat:'管楽器',icon:'🎺'},
  {id:'horn',name:'ホルン',cat:'管楽器',icon:'🎺'}, {id:'euphonium',name:'ユーフォニアム',cat:'管楽器',icon:'🎺'}, {id:'tuba',name:'チューバ',cat:'管楽器',icon:'🎺'},
  {id:'violin',name:'バイオリン',cat:'弦楽器',icon:'🎻'}, {id:'viola',name:'ビオラ',cat:'弦楽器',icon:'🎻'}, {id:'cello',name:'チェロ',cat:'弦楽器',icon:'🎻'},
  {id:'contrabass',name:'コントラバス',cat:'弦楽器',icon:'🎻'}, {id:'guitar',name:'ギター',cat:'弦楽器',icon:'🎸'}, {id:'ukulele',name:'ウクレレ',cat:'弦楽器',icon:'🎸'}, {id:'harp',name:'ハープ',cat:'弦楽器',icon:'♬'},
  {id:'tonechime',name:'トーンチャイム',cat:'その他',icon:'▮'}, {id:'doremi-mat',name:'ドレミマット',cat:'その他',icon:'🟦'}, {id:'body',name:'ボディパーカッション',cat:'その他',icon:'👏'}
];

const PRESETS = [
  {name:'タン タン タン ウン',tokens:[['タン',1],['タン',1],['タン',1],['ウン',1,true]]},
  {name:'タン タタ ウン',tokens:[['タン',1],['タ',.5],['タ',.5],['ウン',1,true]]},
  {name:'タタン タタン',tokens:[['タタン',1],['タタン',1]]},
  {name:'シャン シャン シャン ウン',tokens:[['シャン',1],['シャン',1],['シャン',1],['ウン',1,true]]},
  {name:'シャラララー ウン',tokens:[['シャラララー',3],['ウン',1,true]]},
  {name:'ジャーン ウン',tokens:[['ジャーン',3],['ウン',1,true]]},
  {name:'4拍休む',tokens:[['ウン',4,true]]}
];

const PALETTE = [
  ['タン',1],['タ',.5],['タタ',1],['タタン',1],['トン',1],['ドン',1],['シャン',1],['リン',1],['チン',1],['パン',1],['シャラ',1],['シャラララー',3],['ジャーン',3],['ウン',1,true]
];

const state = {
  screen:'start', songs:[], customInstruments:[], patterns:[], projects:[], selectedSongId:null, selectedInstrumentIds:[],
  rhythmIndex:0, sequences:{}, category:'すべて', tempSongFile:null, pitchMode:false, soloId:null,
  playing:false, raf:0, tapTimes:[], projectId:null
};

const $ = (id)=>document.getElementById(id);
const player = () => $('videoPlayer').hidden ? $('audioPlayer') : $('videoPlayer');

function showScreen(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  $(`screen-${name}`).classList.add('active'); state.screen=name;
  if(name==='performance') setTimeout(()=>requestImmersive(),50);
  window.scrollTo(0,0);
}

function toast(msg){ const el=$('toast'); el.textContent=msg; el.hidden=false; clearTimeout(el._t); el._t=setTimeout(()=>el.hidden=true,2600); }
function uid(prefix='id'){ return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }
function formatTime(sec){ if(!Number.isFinite(sec)) return '0:00'; const m=Math.floor(sec/60); const s=Math.floor(sec%60).toString().padStart(2,'0'); return `${m}:${s}`; }
function selectedSong(){ return state.songs.find(s=>s.id===state.selectedSongId); }
function allInstruments(){ return [...BUILTIN_INSTRUMENTS,...state.customInstruments]; }
function instrumentById(id){ return allInstruments().find(i=>i.id===id); }
function iconHtml(inst){ return inst?.image ? `<img src="${inst.image}" alt="">` : (inst?.icon || '♪'); }

function openDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      [STORE_SONGS,STORE_INSTRUMENTS,STORE_PATTERNS,STORE_PROJECTS].forEach(n=>{ if(!db.objectStoreNames.contains(n)) db.createObjectStore(n,{keyPath:'id'}); });
    };
    req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
  });
}
async function dbAll(store){ const db=await openDB(); return new Promise((res,rej)=>{ const r=db.transaction(store).objectStore(store).getAll(); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
async function dbPut(store,value){ const db=await openDB(); return new Promise((res,rej)=>{ const tx=db.transaction(store,'readwrite'); tx.objectStore(store).put(value); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error); }); }
async function dbDelete(store,id){ const db=await openDB(); return new Promise((res,rej)=>{ const tx=db.transaction(store,'readwrite'); tx.objectStore(store).delete(id); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error); }); }

async function loadData(){
  try{
    state.songs=await dbAll(STORE_SONGS); state.customInstruments=await dbAll(STORE_INSTRUMENTS); state.patterns=await dbAll(STORE_PATTERNS); state.projects=await dbAll(STORE_PROJECTS);
  }catch(e){ console.error(e); toast('保存データを開けませんでした'); }
  renderSongs(); renderInstrumentCategories(); renderInstruments();
}

function renderSongs(){
  const grid=$('songGrid'); grid.innerHTML='';
  if(!state.songs.length) grid.innerHTML='<div class="song-card"><h3>まだ曲がありません</h3><div class="meta">「＋ 曲を追加」から端末の音楽や動画を選んでください。</div></div>';
  state.songs.forEach(song=>{
    const d=document.createElement('div'); d.className='song-card'+(song.id===state.selectedSongId?' selected':''); d.tabIndex=0;
    const project=state.projects.filter(p=>p.songId===song.id).sort((a,b)=>b.updatedAt-a.updatedAt)[0];
    const instNames=(project?.instruments||[]).map(id=>instrumentById(id)?.name).filter(Boolean);
    d.innerHTML=`<button class="delete-mini" aria-label="${song.name}を削除">×</button><h3>♫ ${escapeHtml(song.name)}</h3><div class="meta">${song.bpm?`${Math.round(song.bpm)} BPM`:'テンポ未設定'}${song.duration?` ・ ${formatTime(song.duration)}`:''}</div><div class="meta">${song.mime?.startsWith('video')?'動画':'音声'}</div>${instNames.length?`<div class="meta">使用楽器: ${escapeHtml(instNames.join('・'))}</div>`:''}`;
    d.addEventListener('click',(ev)=>{ if(ev.target.closest('.delete-mini')) return; state.selectedSongId=song.id; $('songGoBtn').disabled=false; updateTempoStatus(); renderSongs(); });
    d.addEventListener('keydown',(ev)=>{ if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();d.click();} });
    d.querySelector('.delete-mini').onclick=async()=>{ if(confirm(`「${song.name}」を削除しますか？`)){ await dbDelete(STORE_SONGS,song.id); const related=state.projects.filter(p=>p.songId===song.id); for(const p of related) await dbDelete(STORE_PROJECTS,p.id); state.projects=state.projects.filter(p=>p.songId!==song.id); state.songs=state.songs.filter(s=>s.id!==song.id); if(state.selectedSongId===song.id)state.selectedSongId=null; renderSongs(); } };
    grid.appendChild(d);
  });
}
function updateTempoStatus(){ const s=selectedSong(); $('tempoStatus').textContent=s?.bpm?`テンポ: ${Math.round(s.bpm)} BPM`:'テンポ: 未設定'; }

function renderInstrumentCategories(){
  const cats=['すべて',...new Set(allInstruments().map(i=>i.cat))]; const root=$('categoryTabs'); root.innerHTML='';
  cats.forEach(cat=>{ const b=document.createElement('button'); b.className=cat===state.category?'primary':'soft-btn'; b.textContent=cat; b.onclick=()=>{state.category=cat;renderInstrumentCategories();renderInstruments();}; root.appendChild(b); });
}
function renderInstruments(){
  const list=allInstruments().filter(i=>state.category==='すべて'||i.cat===state.category); const root=$('instrumentGrid'); root.innerHTML='';
  list.forEach(inst=>{ const b=document.createElement('button'); b.className='instrument-card'+(state.selectedInstrumentIds.includes(inst.id)?' selected':''); b.innerHTML=`<span class="instrument-icon">${iconHtml(inst)}</span><span>${escapeHtml(inst.name)}</span>`; b.onclick=()=>toggleInstrument(inst.id); root.appendChild(b); });
  $('instrumentGoBtn').disabled=!state.selectedInstrumentIds.length;
}
function toggleInstrument(id){ const a=state.selectedInstrumentIds; const i=a.indexOf(id); if(i>=0)a.splice(i,1); else a.push(id); renderInstruments(); autoSaveProject(); }

function renderRhythmEditor(){
  const id=state.selectedInstrumentIds[state.rhythmIndex]; const inst=instrumentById(id); if(!inst)return;
  $('rhythmProgress').textContent=`${state.rhythmIndex+1} / ${state.selectedInstrumentIds.length} 個目`;
  $('rhythmInstrumentHeader').innerHTML=`<span class="instrument-icon">${iconHtml(inst)}</span><span>${escapeHtml(inst.name)}</span>`;
  const presets=$('presetGrid'); presets.innerHTML='';
  [...PRESETS,...state.patterns.map(p=>({name:'★ '+p.name,tokens:p.tokens}))].forEach(p=>{ const b=document.createElement('button'); b.className='preset-btn'; b.textContent=p.name; b.onclick=()=>{state.sequences[id]=p.tokens.map(t=>normalizeToken(t));renderSequence();autoSaveProject();}; presets.appendChild(b); });
  const palette=$('tokenPalette'); palette.innerHTML=''; PALETTE.forEach(t=>{ const tok=normalizeToken(t); const b=document.createElement('button'); b.className='token-btn '+(tok.rest?'rest':tok.beats>1?'long':''); b.textContent=`${tok.text} (${tok.beats}拍)`; b.onclick=()=>addToken(tok); palette.appendChild(b); });
  $('rhythmBackBtn').disabled=state.rhythmIndex===0;
  $('rhythmNextBtn').textContent=state.rhythmIndex===state.selectedInstrumentIds.length-1?'Go！ 合奏へ':'次へ →'; renderSequence();
}
function normalizeToken(t){ if(Array.isArray(t)) return {text:String(t[0]),beats:Number(t[1])||1,rest:Boolean(t[2]),pitch:t[3]||''}; return {text:String(t.text||'タン'),beats:Number(t.beats)||1,rest:Boolean(t.rest),pitch:t.pitch||''}; }
function addToken(t){ const id=state.selectedInstrumentIds[state.rhythmIndex]; (state.sequences[id] ||= []).push({...t}); renderSequence(); autoSaveProject(); }
function renderSequence(){
  const id=state.selectedInstrumentIds[state.rhythmIndex]; const seq=state.sequences[id]||[]; const root=$('rhythmSequence'); root.innerHTML='';
  if(!seq.length){ root.innerHTML='<div class="sequence-empty">上のリズムを選ぶか、音を追加してください。</div>'; return; }
  seq.forEach((t,idx)=>{ const el=document.createElement('button'); el.className='seq-token '+(t.rest?'rest':''); el.innerHTML=`<b>${escapeHtml(t.text)}</b>${t.pitch?`<span class="pitch">${escapeHtml(t.pitch)}</span>`:''}<span class="beats">${t.beats}拍</span>`; el.title='タッチすると削除'; el.onclick=()=>{seq.splice(idx,1);renderSequence();autoSaveProject();}; root.appendChild(el); });
}

async function autoSaveProject(){
  if(!state.selectedSongId) return; if(!state.projectId) state.projectId=uid('project');
  const song=selectedSong();
  const names=state.selectedInstrumentIds.map(id=>instrumentById(id)?.name).filter(Boolean);
  const project={id:state.projectId,songId:state.selectedSongId,name:`${song?.name||'曲'}｜${names.join('・')||'楽器未設定'}`,instruments:[...state.selectedInstrumentIds],sequences:structuredCloneSafe(state.sequences),updatedAt:Date.now()};
  try{await dbPut(STORE_PROJECTS,project); const i=state.projects.findIndex(p=>p.id===project.id); if(i>=0)state.projects[i]=project; else state.projects.push(project);}catch(e){console.error(e);}
}

async function loadBestProjectForSong(){
  state.projectId=null; state.selectedInstrumentIds=[]; state.sequences={}; state.rhythmIndex=0; state.soloId=null;
  try{ const all=await dbAll(STORE_PROJECTS); state.projects=all; const p=all.filter(x=>x.songId===state.selectedSongId).sort((a,b)=>b.updatedAt-a.updatedAt)[0]; if(p){state.projectId=p.id;state.selectedInstrumentIds=p.instruments||[];state.sequences=p.sequences||{};return true;} }catch(e){console.error(e);} return false;
}

function structuredCloneSafe(v){ return JSON.parse(JSON.stringify(v)); }
function escapeHtml(s){ return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

async function fileToDataURL(file){ return new Promise((res,rej)=>{ const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(file); }); }
async function blobToArrayBuffer(blob){ return await blob.arrayBuffer(); }

async function analyzeTempo(blob){
  try{
    const Ctx=window.AudioContext||window.webkitAudioContext; if(!Ctx) return null;
    const ctx=new Ctx(); const arr=await blobToArrayBuffer(blob); const buf=await ctx.decodeAudioData(arr.slice(0));
    const sr=buf.sampleRate, ch=buf.getChannelData(0); const maxSec=Math.min(buf.duration,90); const end=Math.floor(maxSec*sr); const frame=Math.max(256,Math.floor(sr*0.02));
    const env=[]; for(let i=0;i<end;i+=frame){ let sum=0; const lim=Math.min(i+frame,end); for(let j=i;j<lim;j++){const v=ch[j];sum+=v*v;} env.push(Math.sqrt(sum/Math.max(1,lim-i))); }
    const diff=env.map((v,i)=>Math.max(0,v-(env[i-1]||v))); const fps=sr/frame; let best={score:-Infinity,bpm:120};
    for(let bpm=60;bpm<=190;bpm++){ const lag=Math.round((60/bpm)*fps); let score=0; for(let i=lag;i<diff.length;i++) score+=diff[i]*diff[i-lag]; if(score>best.score)best={score,bpm}; }
    const threshold=Math.max(...diff)*0.22; let firstOnset=0; for(let i=1;i<diff.length;i++){ if(diff[i]>=threshold){firstOnset=i/fps;break;} }
    await ctx.close(); return {bpm:best.bpm,beatOffset:firstOnset};
  }catch(e){ console.warn('tempo analyze failed',e); return null; }
}

async function tapTempo(){
  const s=selectedSong(); if(!s)return toast('先に曲を選んでください');
  if(state.screen==='song'){ await prepareMedia(); }
  const p=player();
  if(state.screen==='song' && p.paused){ try{await p.play();}catch(e){} }
  const now=performance.now(); if(state.tapTimes.length&&now-state.tapTimes.at(-1).wall>2200) state.tapTimes=[];
  state.tapTimes.push({wall:now,audio:Number.isFinite(p.currentTime)?p.currentTime:null}); if(state.tapTimes.length>4)state.tapTimes.shift();
  toast(`${state.tapTimes.length}/4 タップ`);
  if(state.tapTimes.length===4){
    const ds=[]; for(let i=1;i<4;i++)ds.push(state.tapTimes[i].wall-state.tapTimes[i-1].wall);
    const bpm=60000/(ds.reduce((a,b)=>a+b,0)/ds.length); s.bpm=Math.max(40,Math.min(240,bpm));
    if(state.tapTimes[0].audio!==null) s.beatOffset=Math.max(0,state.tapTimes[0].audio);
    await dbPut(STORE_SONGS,s); updateTempoStatus();renderSongs(); if(state.screen==='performance')renderPerformance();
    toast(`約 ${Math.round(s.bpm)} BPM・拍の位置を補正しました`); state.tapTimes=[];
  }
}

async function prepareMedia(){
  const song=selectedSong(); if(!song)return; const isVideo=song.mime?.startsWith('video'); const p=isVideo?$('videoPlayer'):$('audioPlayer'); const other=isVideo?$('audioPlayer'):$('videoPlayer'); other.pause(); other.removeAttribute('src'); other.hidden=true; p.hidden=!isVideo?true:false;
  if(p._url)URL.revokeObjectURL(p._url); p._url=URL.createObjectURL(song.blob); p.src=p._url; p.load();
  await new Promise(res=>{ if(p.readyState>=1) return res(); const done=()=>{p.removeEventListener('loadedmetadata',done);res();};p.addEventListener('loadedmetadata',done); setTimeout(done,2000); });
  if(Number.isFinite(p.duration)&&!song.duration){song.duration=p.duration;dbPut(STORE_SONGS,song);}
}

function renderPerformance(){
  const song=selectedSong(); if(!song)return; $('performanceMeta').textContent=`${song.name} ・ ${Math.round(song.bpm||120)} BPM ・ ${state.selectedInstrumentIds.length}パート`;
  const root=$('scoreRows'); root.innerHTML=''; const count=Math.max(1,state.selectedInstrumentIds.length); root.style.setProperty('--row-h',`${100/count}%`);
  state.selectedInstrumentIds.forEach(id=>{
    const inst=instrumentById(id), seq=state.sequences[id]||[]; const row=document.createElement('div'); row.className='score-row'; row.dataset.instrument=id; row.style.setProperty('--row-h',`${100/count}%`);
    const label=document.createElement('button'); label.className='row-label'; label.innerHTML=`<span class="instrument-icon">${iconHtml(inst)}</span><span>${escapeHtml(inst.name)}</span>`; label.onclick=()=>enterSolo(id);
    const track=document.createElement('div'); track.className='track'; let beat=0; const repeats=calcRepeats(song,seq);
    for(let r=0;r<repeats;r++) seq.forEach(t=>{ const el=document.createElement('div'); el.className='score-token '+(t.rest?'rest':t.beats>1?'long':''); el.style.left=`${beat*PX_PER_BEAT}px`; el.style.width=`${Math.max(58,t.beats*PX_PER_BEAT-10)}px`; el.innerHTML=`<span>${escapeHtml(t.text)}</span>${t.pitch?`<span class="pitch">${escapeHtml(t.pitch)}</span>`:''}`; track.appendChild(el); beat+=t.beats; });
    row.append(label,track); root.appendChild(row);
  });
  applyTrackPosition(0); updateTimeUI(0);
}
function calcRepeats(song,seq){ const beats=seq.reduce((a,t)=>a+t.beats,0)||4; const total=(song.duration||180)*(song.bpm||120)/60; return Math.min(300,Math.max(1,Math.ceil((total+PRE_ROLL_BEATS)/beats)+1)); }
function enterSolo(id){ state.soloId=id; $('scoreViewport').classList.add('solo'); document.querySelectorAll('.score-row').forEach(r=>r.classList.toggle('solo-active',r.dataset.instrument===id)); $('allPartsBtn').hidden=false; requestImmersive(); }
function exitSolo(){ state.soloId=null; $('scoreViewport').classList.remove('solo'); document.querySelectorAll('.score-row').forEach(r=>r.classList.remove('solo-active')); $('allPartsBtn').hidden=true; }

function applyTrackPosition(time){
  const bpm=selectedSong()?.bpm||120; const offset=selectedSong()?.beatOffset||0; const beats=(time-offset)*bpm/60-PRE_ROLL_BEATS; const viewport=$('scoreViewport'); const nowX=viewport.clientWidth*.48; const labelW=state.soloId?180:(window.innerWidth<=520?92:window.innerWidth<=820?112:138); const x=nowX-labelW-beats*PX_PER_BEAT;
  document.querySelectorAll('.track').forEach(t=>t.style.transform=`translate3d(${x}px,0,0)`);
}
function tick(){ const p=player(); if(!state.playing)return; const t=p.currentTime||0; applyTrackPosition(t);updateTimeUI(t); if(!p.paused&&!p.ended)state.raf=requestAnimationFrame(tick); }
function updateTimeUI(t){ const p=player(); const dur=Number.isFinite(p.duration)?p.duration:(selectedSong()?.duration||0); $('timeLabel').textContent=`${formatTime(t)} / ${formatTime(dur)}`; $('seekBar').value=dur?Math.round((t/dur)*1000):0; }
async function play(){ const p=player(); try{ await p.play(); state.playing=true;cancelAnimationFrame(state.raf);tick(); }catch(e){console.error(e);toast('再生できませんでした。もう一度タッチしてください。');} }
function pause(){ const p=player();p.pause();state.playing=false;cancelAnimationFrame(state.raf); }
function stop(){ const p=player();pause();p.currentTime=0;applyTrackPosition(0);updateTimeUI(0); }
function onEnded(){ pause();showCelebration(); }
function showCelebration(){ $('praiseText').textContent=PRAISES[Math.floor(Math.random()*PRAISES.length)];$('celebration').hidden=false;setTimeout(()=>{$('celebration').hidden=true;exitSolo();},2600); }

async function requestImmersive(){ document.body.classList.add('immersive'); try{ if(document.documentElement.requestFullscreen&&!document.fullscreenElement) await document.documentElement.requestFullscreen(); }catch(e){ /* iPhone等ではCSS表示を継続 */ } }
async function toggleFullscreen(){ try{ if(document.fullscreenElement)await document.exitFullscreen(); else await requestImmersive(); }catch(e){toast('この端末ではブラウザーの全画面表示を使います');} }

async function exportBackup(){
  try{
    const payload={version:1,exportedAt:new Date().toISOString(),instruments:state.customInstruments.map(({id,name,cat,icon,image})=>({id,name,cat,icon,image})),patterns:state.patterns,projects:await dbAll(STORE_PROJECTS),songs:[]};
    for(const s of state.songs){ payload.songs.push({...s,blob:await blobToBase64(s.blob)}); }
    const blob=new Blob([JSON.stringify(payload)],{type:'application/json'}); const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`デジタル絵譜_バックアップ_${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('バックアップを書き出しました');
  }catch(e){console.error(e);toast('バックアップに失敗しました');}
}
async function blobToBase64(blob){ const u8=new Uint8Array(await blob.arrayBuffer()); let b=''; const chunk=0x8000; for(let i=0;i<u8.length;i+=chunk)b+=String.fromCharCode(...u8.subarray(i,i+chunk)); return `data:${blob.type};base64,${btoa(b)}`; }

function dataUrlToBlob(dataUrl){
  const [head,data]=String(dataUrl).split(','); const mime=(head.match(/data:([^;]+)/)||[])[1]||'application/octet-stream';
  const bin=atob(data||''); const bytes=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i); return new Blob([bytes],{type:mime});
}
async function importBackup(file){
  try{
    const payload=JSON.parse(await file.text());
    if(!payload || payload.version!==1 || !Array.isArray(payload.songs)) throw new Error('backup format');
    for(const s of payload.songs){ const song={...s,blob:typeof s.blob==='string'?dataUrlToBlob(s.blob):s.blob}; await dbPut(STORE_SONGS,song); }
    for(const x of payload.instruments||[]) await dbPut(STORE_INSTRUMENTS,x);
    for(const x of payload.patterns||[]) await dbPut(STORE_PATTERNS,x);
    for(const x of payload.projects||[]) await dbPut(STORE_PROJECTS,x);
    await loadData(); toast('バックアップを読み込みました');
  }catch(e){ console.error(e); toast('バックアップを読み込めませんでした'); }
}

function bind(){
  $('startBtn').onclick=()=>showScreen('song'); $('homeBtn').onclick=()=>{pause();showScreen('start');}; $('fullscreenBtn').onclick=toggleFullscreen; $('backupBtn').onclick=exportBackup; $('restoreFileInput').onchange=async(e)=>{const f=e.target.files?.[0]; if(!f)return; await importBackup(f); e.target.value='';};
  $('songFileInput').onchange=(e)=>{ const file=e.target.files?.[0];if(!file)return;state.tempSongFile=file;$('songNameInput').value=file.name.replace(/\.[^.]+$/,'');$('songNameModal').hidden=false; };
  $('cancelSongBtn').onclick=()=>{$('songNameModal').hidden=true;state.tempSongFile=null;$('songFileInput').value='';};
  $('confirmSongBtn').onclick=async()=>{ const file=state.tempSongFile;if(!file)return;const name=$('songNameInput').value.trim()||file.name;const btn=$('confirmSongBtn');btn.disabled=true;btn.textContent='解析中…';let analysis=null;if(file.type.startsWith('audio'))analysis=await analyzeTempo(file); const song={id:uid('song'),name,bpm:analysis?.bpm||120,beatOffset:analysis?.beatOffset||0,duration:null,mime:file.type||'audio/mpeg',blob:file,createdAt:Date.now()}; await dbPut(STORE_SONGS,song);state.songs.push(song);state.selectedSongId=song.id;$('songNameModal').hidden=true;state.tempSongFile=null;$('songFileInput').value='';btn.disabled=false;btn.textContent='保存して解析';$('songGoBtn').disabled=false;renderSongs();updateTempoStatus();toast(analysis?`自動解析: 約 ${Math.round(analysis.bpm)} BPM`:'保存しました。4回タップでテンポを合わせられます'); };
  $('tapTempoSongBtn').onclick=tapTempo;
  $('songGoBtn').onclick=async()=>{ const restored=await loadBestProjectForSong(); if(restored)toast('前回の楽器とリズムを読み込みました'); renderInstrumentCategories();renderInstruments();showScreen('instrument'); };
  $('clearInstrumentBtn').onclick=()=>{state.selectedInstrumentIds=[];state.sequences={};renderInstruments();autoSaveProject();};
  $('addInstrumentBtn').onclick=()=>{$('instrumentModal').hidden=false;}; $('cancelInstrumentBtn').onclick=()=>{$('instrumentModal').hidden=true;};
  $('saveInstrumentBtn').onclick=async()=>{ const name=$('newInstrumentName').value.trim();if(!name)return toast('楽器名を入れてください');const f=$('newInstrumentImage').files?.[0];const inst={id:uid('custom'),name,cat:$('newInstrumentCategory').value,icon:'♪',image:f?await fileToDataURL(f):null};await dbPut(STORE_INSTRUMENTS,inst);state.customInstruments.push(inst);$('instrumentModal').hidden=true;$('newInstrumentName').value='';$('newInstrumentImage').value='';renderInstrumentCategories();renderInstruments();toast(`${name}を保存しました`);};
  $('instrumentGoBtn').onclick=()=>{state.rhythmIndex=0;state.selectedInstrumentIds.forEach(id=>state.sequences[id] ||= []);renderRhythmEditor();showScreen('rhythm');autoSaveProject();};
  $('addCustomTokenBtn').onclick=()=>{const text=$('customTokenInput').value.trim();if(!text)return;addToken({text,beats:Number($('customBeatsSelect').value),rest:/ウン|休/.test(text),pitch:''});$('customTokenInput').value='';};
  $('undoTokenBtn').onclick=()=>{const id=state.selectedInstrumentIds[state.rhythmIndex];state.sequences[id]?.pop();renderSequence();autoSaveProject();}; $('clearSequenceBtn').onclick=()=>{const id=state.selectedInstrumentIds[state.rhythmIndex];state.sequences[id]=[];renderSequence();autoSaveProject();};
  $('pitchModeToggle').onchange=(e)=>{$('pitchControls').hidden=!e.target.checked;state.pitchMode=e.target.checked;};
  $('applyPitchBtn').onclick=()=>{const pitch=$('pitchInput').value.trim();if(!pitch)return;const id=state.selectedInstrumentIds[state.rhythmIndex],seq=state.sequences[id]||[];seq.filter(t=>!t.rest).forEach(t=>t.pitch=pitch);renderSequence();autoSaveProject();};
  $('saveAsPatternBtn').onclick=()=>{$('patternNameInput').value='';$('patternModal').hidden=false;};$('cancelPatternBtn').onclick=()=>{$('patternModal').hidden=true;};
  $('confirmPatternBtn').onclick=async()=>{const name=$('patternNameInput').value.trim();const id=state.selectedInstrumentIds[state.rhythmIndex];const seq=state.sequences[id]||[];if(!name||!seq.length)return toast('名前とリズムが必要です');const p={id:uid('pattern'),name,tokens:structuredCloneSafe(seq)};await dbPut(STORE_PATTERNS,p);state.patterns.push(p);$('patternModal').hidden=true;renderRhythmEditor();toast('マイリズムに保存しました');};
  $('rhythmBackBtn').onclick=()=>{if(state.rhythmIndex>0){state.rhythmIndex--;renderRhythmEditor();}};
  $('rhythmNextBtn').onclick=async()=>{const id=state.selectedInstrumentIds[state.rhythmIndex];if(!(state.sequences[id]||[]).length)return toast('この楽器のリズムを1つ以上入れてください');await autoSaveProject();if(state.rhythmIndex<state.selectedInstrumentIds.length-1){state.rhythmIndex++;renderRhythmEditor();}else{requestImmersive();await prepareMedia();renderPerformance();showScreen('performance');}};
  $('playBtn').onclick=play;$('pauseBtn').onclick=pause;$('stopBtn').onclick=stop;$('tapTempoPerfBtn').onclick=tapTempo;$('allPartsBtn').onclick=exitSolo;
  $('seekBar').oninput=(e)=>{const p=player();if(Number.isFinite(p.duration)){p.currentTime=(Number(e.target.value)/1000)*p.duration;applyTrackPosition(p.currentTime);updateTimeUI(p.currentTime);}};
  [$('audioPlayer'),$('videoPlayer')].forEach(p=>{p.addEventListener('ended',onEnded);p.addEventListener('timeupdate',()=>{if(!state.playing)updateTimeUI(p.currentTime);});});
  window.addEventListener('resize',()=>{if(state.screen==='performance')applyTrackPosition(player().currentTime||0);});
}

async function init(){ bind(); await loadData(); if('serviceWorker' in navigator){ try{await navigator.serviceWorker.register('./sw.js');}catch(e){console.warn('SW',e);} } }
init();
