'use strict';

/* Intuitive editor v3: direct-touch score editing. */
(() => {
  const SNAP = 0.25;
  const MIN_BEATS = 0.25;
  const ADD_TOKENS = [
    ['タン',1],['タ',0.5],['タタ',1],['タタン',1],['ドン',1],['シャン',1],['リン',1],['チン',1],['シャラララー',3],['ジャーン',3],['ウン',1,true]
  ];
  let editInsertBeat = 0;

  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];
  const snap = (v) => Math.max(0, Math.round(v / SNAP) * SNAP);

  function ensureStarts(seq){
    let beat = 0;
    seq.forEach(t => {
      if (!Number.isFinite(Number(t.startBeat))) t.startBeat = beat;
      t.startBeat = Number(t.startBeat);
      t.beats = Math.max(MIN_BEATS, Number(t.beats || 1));
      beat = Math.max(beat, t.startBeat + t.beats);
    });
    seq.sort((a,b)=>a.startBeat-b.startBeat);
    return seq;
  }

  function patternLength(seq){
    const end = Math.max(4, ...seq.map(t => Number(t.startBeat||0) + Number(t.beats||1)));
    return Math.ceil(end / 4) * 4;
  }

  function addStyles(){
    const s = document.createElement('style');
    s.textContent = `
      .top-actions{display:none!important}
      #screen-song .toolbar{display:none!important}
      #screen-instrument #addInstrumentBtn,#screen-instrument #clearInstrumentBtn,#screen-instrument #categoryTabs{display:none!important}
      #screen-rhythm .rhythm-layout{display:block!important}
      #screen-rhythm .rhythm-layout>div:first-child{margin-bottom:16px}
      #screen-rhythm .custom-token-row,#screen-rhythm .pitch-box,#saveAsPatternBtn,#undoTokenBtn,#clearSequenceBtn,#tokenPalette{display:none!important}
      #simpleTeacherBtn{min-height:46px;border:2px solid var(--line);background:#fff;border-radius:14px;padding:0 14px;font-weight:900}
      #v3Help{font-weight:800;color:#655f57;text-align:center;margin:8px 0 14px}
      #rhythmSequence{display:block!important;position:relative;min-height:230px;overflow-x:auto;overflow-y:hidden;padding:48px 20px 32px;background:#fffaf4;border:3px dashed #dfc9ad;touch-action:pan-y}
      .v3-grid{position:absolute;left:20px;top:0;height:100%;pointer-events:none;background-image:linear-gradient(to right,rgba(36,116,210,.15) 1px,transparent 1px),linear-gradient(to right,rgba(36,116,210,.28) 2px,transparent 2px);background-size:28px 100%,112px 100%}
      .v3-beat-label{position:absolute;top:8px;font-size:.78rem;font-weight:900;color:#6f6a63;transform:translateX(-50%)}
      .v3-token{position:absolute;top:72px;height:104px;border-radius:18px;background:#ffd68b;border:4px solid #b56700;display:flex;align-items:center;justify-content:center;font-weight:1000;font-size:1.25rem;padding:8px 22px 8px 12px;box-shadow:0 5px 14px rgba(0,0,0,.12);touch-action:none;user-select:none;cursor:grab}
      .v3-token.rest{background:#e8edf2;border-color:#8a97a3}.v3-token.long{background:#ffeaa7;border-color:#c39400}
      .v3-delete{position:absolute;right:4px;top:4px;width:28px;height:28px;border:0;border-radius:999px;background:#fff8;font-size:1rem;font-weight:1000}
      .v3-resize{position:absolute;right:-5px;top:24px;bottom:24px;width:18px;border-radius:9px;background:#fff9;border:2px solid #8a6b35;cursor:ew-resize}
      .v3-add{position:absolute;top:184px;width:42px;height:42px;border-radius:50%;border:2px solid #b78b52;background:#fff;color:#8b6432;font-size:1.5rem;font-weight:1000;transform:translateX(-50%);touch-action:manipulation}
      #v3EditorTools{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:14px}
      #v3EditorTools button{min-height:50px;border:2px solid var(--line);background:#fff;border-radius:14px;padding:0 18px;font-weight:900}
      #v3AddModal,#v3TeacherModal{position:fixed;inset:0;background:#0008;z-index:700;display:grid;place-items:center;padding:16px}
      #v3AddModal[hidden],#v3TeacherModal[hidden]{display:none}
      .v3-modal{width:min(700px,96vw);max-height:90vh;overflow:auto;background:#fff;border-radius:24px;padding:22px;color:#2d2a26}
      .v3-modal-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.v3-modal-head h2{margin:0}.v3-close{width:46px;height:46px;border:2px solid var(--line);background:#fff;border-radius:14px;font-size:1.3rem}
      .v3-palette{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px}.v3-palette button{min-height:72px;border:2px solid var(--line);background:#fff7e8;border-radius:15px;font-weight:900}
      .v3-teacher-grid{display:grid;gap:14px;margin-top:14px}.v3-teacher-box{border:2px solid var(--line);border-radius:18px;padding:14px}.v3-teacher-box h3{margin:0 0 10px}.v3-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.v3-row button{min-height:48px;border:2px solid var(--line);background:#fff;border-radius:14px;padding:0 14px;font-weight:900}.v3-value{min-width:116px;text-align:center;font-weight:1000;font-size:1.25rem}
      #v3Tap{width:100%;min-height:72px;border:0;border-radius:18px;background:#2474d2;color:white;font-size:1.25rem;font-weight:1000}
      #v3TapStatus{text-align:center;font-weight:900;margin-top:8px}
      #editRhythmPerfBtn{min-height:48px;border-radius:14px;border:2px solid #777;background:#2d2d2d;color:#fff;padding:0 14px;font-weight:900}
      @media(max-width:560px){.v3-palette{grid-template-columns:repeat(2,1fr)}.v3-token{font-size:1.05rem;height:92px}.v3-resize{top:20px;bottom:20px}}
    `;
    document.head.appendChild(s);
  }

  function ensureTeacher(){
    const topbar = q('.topbar');
    let btn = document.getElementById('simpleTeacherBtn');
    if (!btn && topbar){ btn = document.createElement('button'); btn.id='simpleTeacherBtn'; btn.textContent='⚙ 先生'; topbar.appendChild(btn); }
    if (!document.getElementById('v3TeacherModal')){
      const m = document.createElement('div'); m.id='v3TeacherModal'; m.hidden=true;
      m.innerHTML = `<div class="v3-modal"><div class="v3-modal-head"><h2>⚙ 先生</h2><button id="v3TeacherClose" class="v3-close">×</button></div><div class="v3-teacher-grid"><div class="v3-teacher-box"><h3>曲を追加</h3><div id="v3SongTools" class="v3-row"></div></div><div class="v3-teacher-box"><h3>テンポ</h3><div class="v3-row"><button data-bpm="-1">−1</button><button data-bpm="-0.1">−0.1</button><span id="v3Bpm" class="v3-value">120.0 BPM</span><button data-bpm="0.1">＋0.1</button><button data-bpm="1">＋1</button></div></div><div class="v3-teacher-box"><h3>1・2・3・4で合わせる</h3><p class="hint">曲を流し、拍に合わせて4回タップします。</p><button id="v3Tap">1・2・3・4</button><div id="v3TapStatus">まだタップしていません</div></div><div class="v3-teacher-box"><h3>保存</h3><div id="v3OtherTools" class="v3-row"></div></div></div></div>`;
      document.body.appendChild(m);
      document.getElementById('v3TeacherClose').onclick=()=>m.hidden=true;
    }
    if(btn) btn.onclick=()=>{ moveTeacherTools(); refreshTeacher(); document.getElementById('v3TeacherModal').hidden=false; };
    qa('[data-bpm]').forEach(b=>b.onclick=()=>adjustBpm(Number(b.dataset.bpm)));
    installTap();
  }

  function moveTeacherTools(){
    const songTools=document.getElementById('v3SongTools'), other=document.getElementById('v3OtherTools');
    const file=document.getElementById('songFileInput')?.closest('label');
    const yt=document.getElementById('youtubeSearchBtn');
    const ytSet=document.getElementById('youtubeSettingsBtn');
    const backup=document.getElementById('backupBtn');
    const restore=document.getElementById('restoreFileInput')?.closest('label');
    [file,yt,ytSet].forEach(x=>{if(x&&songTools&&!songTools.contains(x))songTools.appendChild(x)});
    [backup,restore].forEach(x=>{if(x&&other&&!other.contains(x))other.appendChild(x)});
  }

  function refreshTeacher(){ const s=selectedSong(); const el=document.getElementById('v3Bpm'); if(el) el.textContent=`${Number(s?.bpm||120).toFixed(1)} BPM`; }

  async function adjustBpm(delta){ const s=selectedSong(); if(!s)return toast('先に曲を選んでください'); s.bpm=Math.max(30,Math.min(300,Math.round((Number(s.bpm||120)+delta)*10)/10)); await dbPut(STORE_SONGS,s); refreshTeacher(); try{updateTempoStatus();renderSongs();}catch(_){}; if(state.screen==='performance') try{applyTrackPosition(currentMediaTime())}catch(_){}; }

  function currentMediaTime(){ const s=selectedSong(); if(!s)return 0; if((s.source==='youtube'||s.mime==='youtube') && typeof window.digitalScoreYouTubeTime==='function') return Number(window.digitalScoreYouTubeTime())||0; try{return Number(player()?.currentTime||0)}catch(_){return 0} }

  function installTap(){
    const tap=document.getElementById('v3Tap'); if(!tap||tap.dataset.bound)return; tap.dataset.bound='1'; let taps=[];
    tap.onclick=async()=>{ const song=selectedSong(); if(!song)return toast('先に曲を選んでください'); const now=performance.now(); if(taps.length && now-taps.at(-1).wall>2500)taps=[]; taps.push({wall:now,media:currentMediaTime()}); document.getElementById('v3TapStatus').textContent=`${taps.length} / 4`; if(taps.length<4)return; const xs=[0,1,2,3],ys=taps.map(t=>t.wall/1000),mx=1.5,my=ys.reduce((a,b)=>a+b,0)/4; let num=0,den=0; for(let i=0;i<4;i++){num+=(xs[i]-mx)*(ys[i]-my);den+=(xs[i]-mx)**2;} const sec=num/den; let bpm=60/sec; while(bpm<50)bpm*=2; while(bpm>220)bpm/=2; const beatDur=60/bpm,first=taps[0].media; song.bpm=bpm; song.beatOffset=((first%beatDur)+beatDur)%beatDur; await dbPut(STORE_SONGS,song); refreshTeacher(); try{updateTempoStatus();renderSongs();}catch(_){}; document.getElementById('v3TapStatus').textContent=`✓ ${bpm.toFixed(1)} BPM`; taps=[]; };
  }

  function ensureAddModal(){ if(document.getElementById('v3AddModal'))return; const m=document.createElement('div');m.id='v3AddModal';m.hidden=true;m.innerHTML=`<div class="v3-modal"><div class="v3-modal-head"><h2>音を追加</h2><button id="v3AddClose" class="v3-close">×</button></div><div id="v3Palette" class="v3-palette"></div></div>`;document.body.appendChild(m);document.getElementById('v3AddClose').onclick=()=>m.hidden=true; }

  function openAdd(beat){ editInsertBeat=snap(beat); const grid=document.getElementById('v3Palette');grid.innerHTML=''; ADD_TOKENS.forEach(raw=>{const t=normalizeToken(raw),b=document.createElement('button');b.textContent=`${t.text}（${t.beats}拍）`;b.onclick=()=>{const id=state.selectedInstrumentIds[state.rhythmIndex];const seq=ensureStarts(state.sequences[id]||=[]);seq.push({...t,startBeat:editInsertBeat});ensureStarts(seq);document.getElementById('v3AddModal').hidden=true;renderRhythmEditor();autoSaveProject();};grid.appendChild(b)}); document.getElementById('v3AddModal').hidden=false; }

  function renderTimeline(){
    const id=state.selectedInstrumentIds[state.rhythmIndex],seq=ensureStarts(state.sequences[id]||[]),root=document.getElementById('rhythmSequence');if(!root)return;root.innerHTML='';if(!seq.length){root.innerHTML='<div class="sequence-empty">まず主リズムを1つ選んでください。</div>';return;} const total=Math.max(16,patternLength(seq)+4),width=total*112; const grid=document.createElement('div');grid.className='v3-grid';grid.style.width=width+'px';root.appendChild(grid); for(let b=0;b<=total;b++){if(b%4===0){const l=document.createElement('span');l.className='v3-beat-label';l.style.left=(20+b*112)+'px';l.textContent=b;root.appendChild(l)}} seq.forEach((t,idx)=>{const el=document.createElement('div');el.className='v3-token '+(t.rest?'rest':t.beats>1?'long':'');el.style.left=(20+t.startBeat*112)+'px';el.style.width=Math.max(72,t.beats*112-8)+'px';el.innerHTML=`<span>${escapeHtml(t.text)}</span><button class="v3-delete" aria-label="削除">×</button><span class="v3-resize" title="長さを変える"></span>`;el.querySelector('.v3-delete').onclick=e=>{e.stopPropagation();seq.splice(idx,1);renderRhythmEditor();autoSaveProject();};bindDrag(el,t,seq);bindResize(el,t,seq);root.appendChild(el);}); for(let b=0;b<=total;b++){const plus=document.createElement('button');plus.className='v3-add';plus.style.left=(20+b*112)+'px';plus.textContent='＋';plus.onclick=()=>openAdd(b);root.appendChild(plus)} const spacer=document.createElement('div');spacer.style.width=(width+60)+'px';spacer.style.height='1px';root.appendChild(spacer);
  }

  function bindDrag(el,t,seq){ let startX=0,startBeat=0; const down=e=>{if(e.target.closest('.v3-delete,.v3-resize'))return;startX=e.clientX;startBeat=t.startBeat;el.setPointerCapture?.(e.pointerId);};const move=e=>{if(!el.hasPointerCapture?.(e.pointerId))return;t.startBeat=snap(startBeat+(e.clientX-startX)/112);el.style.left=(20+t.startBeat*112)+'px';};const up=e=>{if(!el.hasPointerCapture?.(e.pointerId))return;el.releasePointerCapture?.(e.pointerId);ensureStarts(seq);autoSaveProject();};el.addEventListener('pointerdown',down);el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up); }

  function bindResize(el,t,seq){ const h=el.querySelector('.v3-resize');let startX=0,startBeats=1;h.addEventListener('pointerdown',e=>{e.stopPropagation();startX=e.clientX;startBeats=t.beats;h.setPointerCapture?.(e.pointerId)});h.addEventListener('pointermove',e=>{if(!h.hasPointerCapture?.(e.pointerId))return;t.beats=Math.max(MIN_BEATS,snap(startBeats+(e.clientX-startX)/112));el.style.width=Math.max(72,t.beats*112-8)+'px';});h.addEventListener('pointerup',e=>{if(h.hasPointerCapture?.(e.pointerId))h.releasePointerCapture?.(e.pointerId);ensureStarts(seq);autoSaveProject();}); }

  function installRhythmEditor(){
    const first=q('#screen-rhythm .rhythm-layout>div:nth-child(1)'),second=q('#screen-rhythm .rhythm-layout>div:nth-child(2)');if(first&&!document.getElementById('v3Help')){const p=document.createElement('p');p.id='v3Help';p.textContent='主リズムを選んだら、絵譜を指で動かして直せます。';first.prepend(p)}if(second&&!document.getElementById('v3EditorTools')){const d=document.createElement('div');d.id='v3EditorTools';d.innerHTML='<button id="v3ChooseAgain">主リズムを選び直す</button>';second.appendChild(d);document.getElementById('v3ChooseAgain').onclick=()=>{const id=state.selectedInstrumentIds[state.rhythmIndex];state.sequences[id]=[];renderRhythmEditor();autoSaveProject();};}
    renderRhythmEditor=function(){const id=state.selectedInstrumentIds[state.rhythmIndex],inst=instrumentById(id);if(!inst)return;document.getElementById('rhythmProgress').textContent=`${state.rhythmIndex+1} / ${state.selectedInstrumentIds.length} 個目`;document.getElementById('rhythmInstrumentHeader').innerHTML=`<span class="instrument-icon">${iconHtml(inst)}</span><span>${escapeHtml(inst.name)}</span>`;const seq=state.sequences[id]||[];first?.classList.toggle('simple-hidden',seq.length>0);second?.classList.toggle('simple-hidden',seq.length===0);const pg=document.getElementById('presetGrid');pg.innerHTML='';[...PRESETS,...state.patterns.map(p=>({name:'★ '+p.name,tokens:p.tokens}))].forEach(p=>{const b=document.createElement('button');b.className='preset-btn';b.textContent=p.name;b.onclick=()=>{let beat=0;state.sequences[id]=p.tokens.map(raw=>{const t=normalizeToken(raw),out={...t,startBeat:beat};beat+=t.beats;return out});renderRhythmEditor();autoSaveProject();};pg.appendChild(b)});const h=first?.querySelector('h3');if(h)h.textContent='まず主リズムを1つ選ぼう';renderTimeline();document.getElementById('rhythmBackBtn').disabled=state.rhythmIndex===0;document.getElementById('rhythmNextBtn').textContent=state.rhythmIndex===state.selectedInstrumentIds.length-1?'合奏へ →':'つぎの楽器 →';};
  }

  function overridePerformance(){ renderPerformance=function(){const song=selectedSong();if(!song)return;document.getElementById('performanceMeta').textContent=`${song.name} ・ ${Number(song.bpm||120).toFixed(1)} BPM ・ ${state.selectedInstrumentIds.length}パート`;const root=document.getElementById('scoreRows');root.innerHTML='';const count=Math.max(1,state.selectedInstrumentIds.length);root.style.setProperty('--row-h',`${100/count}%`);state.selectedInstrumentIds.forEach(id=>{const inst=instrumentById(id),seq=ensureStarts(state.sequences[id]||[]),row=document.createElement('div');row.className='score-row';row.dataset.instrument=id;row.style.setProperty('--row-h',`${100/count}%`);const label=document.createElement('button');label.className='row-label';label.innerHTML=`<span class="instrument-icon">${iconHtml(inst)}</span><span>${escapeHtml(inst.name)}</span>`;label.onclick=()=>enterSolo(id);const track=document.createElement('div');track.className='track';const cycle=patternLength(seq),totalBeats=(song.duration||180)*(song.bpm||120)/60+PRE_ROLL_BEATS,reps=Math.min(300,Math.ceil(totalBeats/cycle)+1);for(let r=0;r<reps;r++)seq.forEach(t=>{const beat=r*cycle+t.startBeat,el=document.createElement('div');el.className='score-token '+(t.rest?'rest':t.beats>1?'long':'');el.style.left=`${beat*PX_PER_BEAT}px`;el.style.width=`${Math.max(58,t.beats*PX_PER_BEAT-10)}px`;el.innerHTML=`<span>${escapeHtml(t.text)}</span>${t.pitch?`<span class="pitch">${escapeHtml(t.pitch)}</span>`:''}`;track.appendChild(el)});row.append(label,track);root.appendChild(row)});applyTrackPosition(0);updateTimeUI(0);}; }

  function simplify(){const p1=q('#screen-song .page-head p');if(p1)p1.textContent='曲をタッチして選びます。追加は「⚙ 先生」から。';const p2=q('#screen-instrument .page-head p');if(p2)p2.textContent='使う楽器をタッチします。';const p3=q('#screen-rhythm .page-head p');if(p3)p3.textContent='主リズムを選んで、絵譜を直接動かして直します。';const play=document.getElementById('playBtn');if(play)play.textContent='▶ はじめる';if(!document.getElementById('editRhythmPerfBtn')){const b=document.createElement('button');b.id='editRhythmPerfBtn';b.textContent='✏ 直す';b.onclick=()=>{try{pause()}catch(_){};state.rhythmIndex=0;renderRhythmEditor();showScreen('rhythm')};q('.performance-controls')?.appendChild(b)}}

  function boot(){addStyles();ensureTeacher();ensureAddModal();installRhythmEditor();overridePerformance();simplify();setTimeout(()=>{moveTeacherTools();simplify();},900);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
