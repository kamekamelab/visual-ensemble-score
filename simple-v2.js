'use strict';

/* v2 simplified classroom UI. Loaded after app.js and YouTube integration. */
(() => {
  const MAIN_IDS = ['taiko','snare','bell','tambourine','castanet','triangle','cymbal','xylophone','glockenspiel','melodica','recorder','piano'];
  const INSERT_TOKENS = [
    ['タン',1],['タ',.5],['タタ',1],['タタン',1],['ドン',1],['シャン',1],['リン',1],['チン',1],['シャラララー',3],['ジャーン',3],['ウン',1,true]
  ];
  let showAllInstruments = false;
  let insertPosition = 0;
  let ytObservedTime = 0;
  let ytObservedAt = 0;
  let tapSession = [];

  function addStyle() {
    const s = document.createElement('style');
    s.textContent = `
      .top-actions{display:none!important}
      #simpleTeacherBtn{min-height:46px;border:2px solid var(--line);background:#fff;border-radius:14px;padding:0 15px;font-weight:900}
      #screen-song .toolbar{display:none!important}
      #screen-instrument #addInstrumentBtn,#screen-instrument #clearInstrumentBtn,#screen-instrument #categoryTabs{display:none!important}
      #screen-rhythm .custom-token-row,#screen-rhythm .pitch-box,#saveAsPatternBtn,#undoTokenBtn,#clearSequenceBtn{display:none!important}
      #screen-rhythm .rhythm-layout{grid-template-columns:1fr!important;max-width:1000px;margin:auto}
      #screen-rhythm .rhythm-layout>div{border-radius:22px}
      #tokenPalette{display:none!important}
      .simple-hidden{display:none!important}
      #simpleMoreInstruments{display:block;margin:16px auto 0;min-height:50px;border:2px solid var(--line);background:#fff;border-radius:14px;padding:0 20px;font-weight:900}
      .simple-rhythm-help{text-align:center;color:var(--muted);margin:10px 0 14px;line-height:1.5}
      .simple-gap{min-width:46px;height:62px;border:2px dashed #d4b287;background:#fff;border-radius:14px;font-size:1.4rem;font-weight:1000;color:#8e6a39;flex:none}
      .simple-seq-token{min-width:80px;min-height:86px;border-radius:15px;background:#fff0dc;border:3px solid #efb56f;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:8px;font-weight:900;flex:none}
      .simple-seq-token.rest{background:#edf0f4;border-color:#a8b2bc}.simple-seq-token.long{min-width:132px;background:#fff0a7;border-color:#d7aa28}
      .simple-seq-token small{font-size:.72rem;color:#71695f}
      #simpleRhythmTools{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:14px}
      #simpleRhythmTools button{min-height:50px;border:2px solid var(--line);background:#fff;border-radius:14px;padding:0 18px;font-weight:900}
      #simpleTeacherModal,#simpleInsertModal{position:fixed;inset:0;background:#0008;z-index:500;display:grid;place-items:center;padding:16px}
      #simpleTeacherModal[hidden],#simpleInsertModal[hidden]{display:none}
      .simple-modal{width:min(720px,96vw);max-height:92vh;overflow:auto;background:#fff;color:#2d2a26;border-radius:24px;padding:22px;box-shadow:0 20px 70px #0005}
      .simple-modal-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.simple-modal-head h2{margin:0}
      .simple-close{width:48px;height:48px;border:2px solid var(--line);border-radius:14px;background:#fff;font-size:1.4rem}
      .simple-teacher-box{border:2px solid var(--line);border-radius:18px;padding:15px;margin-top:14px}.simple-teacher-box h3{margin:0 0 8px}
      .simple-teacher-actions{display:flex;gap:9px;flex-wrap:wrap}.simple-teacher-actions>*{margin:0!important}
      #simpleTapBtn{width:100%;min-height:82px;border:0;border-radius:18px;background:#2474d2;color:#fff;font-size:1.35rem;font-weight:1000}
      #simpleTapStatus{text-align:center;margin-top:9px;font-weight:900;font-size:1.05rem}
      .simple-insert-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.simple-insert-grid button{min-height:70px;border:2px solid var(--line);border-radius:15px;background:#fff7e8;font-weight:900}
      #tapTempoPerfBtn{display:none!important}
      @media(max-width:560px){.simple-insert-grid{grid-template-columns:repeat(2,1fr)}#simpleTeacherBtn{padding:0 10px;font-size:.9rem}}
    `;
    document.head.appendChild(s);
  }

  function createTeacherUI() {
    const topbar = document.querySelector('.topbar');
    if (topbar && !document.getElementById('simpleTeacherBtn')) {
      const b = document.createElement('button');
      b.id = 'simpleTeacherBtn';
      b.textContent = '⚙ 先生';
      topbar.appendChild(b);
    }
    if (!document.getElementById('simpleTeacherModal')) {
      const m = document.createElement('div');
      m.id = 'simpleTeacherModal'; m.hidden = true;
      m.innerHTML = `<div class="simple-modal">
        <div class="simple-modal-head"><h2>⚙ 先生モード</h2><button id="simpleTeacherClose" class="simple-close">×</button></div>
        <div class="simple-teacher-box"><h3>曲を追加</h3><p class="hint">普段の画面には追加設定を出さず、ここで準備します。</p><div id="simpleSongTools" class="simple-teacher-actions"></div></div>
        <div class="simple-teacher-box"><h3>拍を合わせる</h3><p class="hint">曲を再生しながら、1・2・3・4に合わせて4回タップします。4回の間隔からBPMを決め、1回目のタップを拍の基準にします。</p><button id="simpleTapBtn">ここを4回タップ</button><div id="simpleTapStatus">まだタップしていません</div></div>
        <div class="simple-teacher-box"><h3>保存・その他</h3><div id="simpleOtherTools" class="simple-teacher-actions"></div></div>
      </div>`;
      document.body.appendChild(m);
    }
    document.getElementById('simpleTeacherBtn').onclick = openTeacher;
    document.getElementById('simpleTeacherClose').onclick = () => document.getElementById('simpleTeacherModal').hidden = true;
    document.getElementById('simpleTapBtn').onclick = tapCorrect;
  }

  function moveTeacherTools() {
    const songTools = document.getElementById('simpleSongTools');
    const other = document.getElementById('simpleOtherTools');
    if (!songTools || !other) return;
    const fileLabel = document.getElementById('songFileInput')?.closest('label');
    const ytSearch = document.getElementById('youtubeSearchBtn');
    const ytSettings = document.getElementById('youtubeSettingsBtn');
    const addInst = document.getElementById('addInstrumentBtn');
    const backup = document.getElementById('backupBtn');
    const restore = document.getElementById('restoreFileInput')?.closest('label');
    [fileLabel, ytSearch, ytSettings].forEach(x => { if (x && !songTools.contains(x)) songTools.appendChild(x); });
    [addInst, backup, restore].forEach(x => { if (x && !other.contains(x)) other.appendChild(x); });
    [fileLabel, ytSearch, ytSettings, addInst, backup, restore].forEach(x => x?.classList.remove('simple-hidden'));
  }

  function openTeacher() {
    moveTeacherTools();
    tapSession = [];
    const s = selectedSong();
    document.getElementById('simpleTapStatus').textContent = s ? `現在: 約 ${Math.round(s.bpm || 120)} BPM` : '先に曲を選んでください';
    document.getElementById('simpleTeacherModal').hidden = false;
  }

  function simplifyHeadings() {
    const songP = document.querySelector('#screen-song .page-head p');
    if (songP) songP.textContent = '保存してある曲をタッチしてください。曲の追加は「⚙ 先生」からできます。';
    const instP = document.querySelector('#screen-instrument .page-head p');
    if (instP) instP.textContent = '使う楽器をタッチしてください。';
    const rhythmP = document.querySelector('#screen-rhythm .page-head p');
    if (rhythmP && state.screen !== 'rhythm') rhythmP.textContent = '主に使うリズムを1つ選んでから、必要なところだけ変えます。';
    const play = document.getElementById('playBtn'); if (play) play.textContent = '▶ はじめる';
    const pause = document.getElementById('pauseBtn'); if (pause) pause.textContent = 'Ⅱ とめる';
    const stop = document.getElementById('stopBtn'); if (stop) stop.textContent = '↺ はじめから';
  }

  function installInstrumentView() {
    if (!document.getElementById('simpleMoreInstruments')) {
      const b = document.createElement('button'); b.id = 'simpleMoreInstruments'; b.textContent = 'ほかの楽器も見る';
      document.getElementById('instrumentGrid')?.insertAdjacentElement('afterend', b);
      b.onclick = () => { showAllInstruments = !showAllInstruments; renderInstruments(); };
    }
    renderInstruments = function() {
      let list = allInstruments();
      if (!showAllInstruments) list = list.filter(i => MAIN_IDS.includes(i.id) || String(i.id).startsWith('custom'));
      const root = document.getElementById('instrumentGrid'); if (!root) return; root.innerHTML = '';
      list.forEach(inst => {
        const b = document.createElement('button');
        b.className = 'instrument-card' + (state.selectedInstrumentIds.includes(inst.id) ? ' selected' : '');
        b.innerHTML = `<span class="instrument-icon">${iconHtml(inst)}</span><span>${escapeHtml(inst.name)}</span>`;
        b.onclick = () => toggleInstrument(inst.id); root.appendChild(b);
      });
      document.getElementById('instrumentGoBtn').disabled = !state.selectedInstrumentIds.length;
      const more = document.getElementById('simpleMoreInstruments'); if (more) more.textContent = showAllInstruments ? 'よく使う楽器だけ' : 'ほかの楽器も見る';
    };
  }

  function installInsertModal() {
    if (document.getElementById('simpleInsertModal')) return;
    const m = document.createElement('div'); m.id = 'simpleInsertModal'; m.hidden = true;
    m.innerHTML = `<div class="simple-modal"><div class="simple-modal-head"><h2>ここに入れる音</h2><button id="simpleInsertClose" class="simple-close">×</button></div><div id="simpleInsertGrid" class="simple-insert-grid"></div></div>`;
    document.body.appendChild(m);
    document.getElementById('simpleInsertClose').onclick = () => m.hidden = true;
  }

  function renderSimpleSequence() {
    const id = state.selectedInstrumentIds[state.rhythmIndex];
    const seq = state.sequences[id] || [];
    const root = document.getElementById('rhythmSequence'); if (!root) return; root.innerHTML = '';
    if (!seq.length) { root.innerHTML = '<div class="sequence-empty">まず主リズムを1つ選んでください。</div>'; return; }
    for (let pos = 0; pos <= seq.length; pos++) {
      const gap = document.createElement('button'); gap.className = 'simple-gap'; gap.textContent = '＋'; gap.title = 'ここに音を入れる';
      gap.onclick = () => openInsert(pos); root.appendChild(gap);
      if (pos < seq.length) {
        const t = seq[pos]; const b = document.createElement('button');
        b.className = 'simple-seq-token ' + (t.rest ? 'rest' : t.beats > 1 ? 'long' : '');
        b.innerHTML = `<b>${escapeHtml(t.text)}</b><small>${t.beats}拍</small>`;
        b.title = 'タッチすると削除';
        b.onclick = () => { seq.splice(pos, 1); renderRhythmEditor(); autoSaveProject(); };
        root.appendChild(b);
      }
    }
  }

  function openInsert(pos) {
    insertPosition = pos;
    const grid = document.getElementById('simpleInsertGrid'); grid.innerHTML = '';
    INSERT_TOKENS.forEach(raw => {
      const tok = normalizeToken(raw); const b = document.createElement('button');
      b.textContent = `${tok.text}（${tok.beats}拍）`;
      b.onclick = () => {
        const id = state.selectedInstrumentIds[state.rhythmIndex];
        (state.sequences[id] ||= []).splice(insertPosition, 0, tok);
        document.getElementById('simpleInsertModal').hidden = true; renderRhythmEditor(); autoSaveProject();
      };
      grid.appendChild(b);
    });
    document.getElementById('simpleInsertModal').hidden = false;
  }

  function installRhythmEditor() {
    const second = document.querySelector('#screen-rhythm .rhythm-layout>div:nth-child(2)');
    if (second && !document.getElementById('simpleRhythmTools')) {
      const d = document.createElement('div'); d.id = 'simpleRhythmTools';
      d.innerHTML = '<button id="simpleChooseAgain">主リズムをえらび直す</button><button id="simpleAllRest">全部休みにする</button>';
      second.appendChild(d);
      document.getElementById('simpleChooseAgain').onclick = () => { const id = state.selectedInstrumentIds[state.rhythmIndex]; state.sequences[id] = []; renderRhythmEditor(); autoSaveProject(); };
      document.getElementById('simpleAllRest').onclick = () => { const id = state.selectedInstrumentIds[state.rhythmIndex]; state.sequences[id] = [1,2,3,4].map(() => ({text:'ウン',beats:1,rest:true,pitch:''})); renderRhythmEditor(); autoSaveProject(); };
    }
    renderRhythmEditor = function() {
      const id = state.selectedInstrumentIds[state.rhythmIndex], inst = instrumentById(id); if (!inst) return;
      document.getElementById('rhythmProgress').textContent = `${state.rhythmIndex + 1} / ${state.selectedInstrumentIds.length} 個目`;
      document.getElementById('rhythmInstrumentHeader').innerHTML = `<span class="instrument-icon">${iconHtml(inst)}</span><span>${escapeHtml(inst.name)}</span>`;
      const seq = state.sequences[id] || [];
      const firstCol = document.querySelector('#screen-rhythm .rhythm-layout>div:nth-child(1)');
      const secondCol = document.querySelector('#screen-rhythm .rhythm-layout>div:nth-child(2)');
      firstCol?.classList.toggle('simple-hidden', seq.length > 0); secondCol?.classList.toggle('simple-hidden', seq.length === 0);
      const pg = document.getElementById('presetGrid'); pg.innerHTML = '';
      [...PRESETS, ...state.patterns.map(p => ({name:'★ ' + p.name, tokens:p.tokens}))].forEach(p => {
        const b = document.createElement('button'); b.className = 'preset-btn'; b.textContent = p.name;
        b.onclick = () => { state.sequences[id] = p.tokens.map(t => normalizeToken(t)); renderRhythmEditor(); autoSaveProject(); };
        pg.appendChild(b);
      });
      const h3s = firstCol?.querySelectorAll('h3'); if (h3s?.[0]) h3s[0].textContent = 'まず、主に使うリズムを1つえらぼう';
      renderSimpleSequence();
      document.getElementById('rhythmBackBtn').disabled = state.rhythmIndex === 0;
      document.getElementById('rhythmNextBtn').textContent = state.rhythmIndex === state.selectedInstrumentIds.length - 1 ? '合奏へ →' : 'つぎの楽器 →';
    };
  }

  function currentMediaTime() {
    const s = selectedSong();
    if (s && (s.source === 'youtube' || s.mime === 'youtube')) {
      if (performance.now() - ytObservedAt < 1800) return ytObservedTime;
      return 0;
    }
    try { return Number(player()?.currentTime || 0); } catch (e) { return 0; }
  }

  async function tapCorrect() {
    const s = selectedSong(); if (!s) return toast('先に曲を選んでください');
    const now = performance.now();
    if (tapSession.length && now - tapSession.at(-1).wall > 2500) tapSession = [];
    tapSession.push({wall:now, media:currentMediaTime()}); if (tapSession.length > 4) tapSession.shift();
    document.getElementById('simpleTapStatus').textContent = `${tapSession.length} / 4 タップ`;
    if (tapSession.length !== 4) return;
    const ds = []; for (let i = 1; i < 4; i++) ds.push((tapSession[i].wall - tapSession[i-1].wall) / 1000);
    ds.sort((a,b) => a-b); const sec = ds[1]; let bpm = 60 / sec;
    while (bpm < 55) bpm *= 2; while (bpm > 210) bpm /= 2;
    const beatDur = 60 / bpm; const first = tapSession[0].media;
    const phase = ((first % beatDur) + beatDur) % beatDur;
    s.bpm = bpm; s.beatOffset = phase;
    await dbPut(STORE_SONGS, s); updateTempoStatus(); renderSongs();
    if (state.screen === 'performance') { renderPerformance(); applyTrackPosition(currentMediaTime()); }
    document.getElementById('simpleTapStatus').textContent = `✓ ${Math.round(bpm)} BPM　拍の位置も補正しました`;
    toast(`拍を合わせました：${Math.round(bpm)} BPM`); tapSession = [];
  }

  function observeYouTube() {
    window.addEventListener('message', e => {
      let d = e.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (_) { return; } }
      if (d?.event === 'infoDelivery' && Number.isFinite(d?.info?.currentTime)) { ytObservedTime = d.info.currentTime; ytObservedAt = performance.now(); }
    });
  }

  function rebindAfterAddons() {
    moveTeacherTools();
    const songTap = document.getElementById('tapTempoSongBtn'); const perfTap = document.getElementById('tapTempoPerfBtn');
    if (songTap) songTap.onclick = tapCorrect; if (perfTap) perfTap.onclick = tapCorrect;
    renderInstruments(); simplifyHeadings();
  }

  function boot() {
    addStyle(); createTeacherUI(); installInsertModal(); installInstrumentView(); installRhythmEditor(); observeYouTube(); simplifyHeadings();
    setTimeout(rebindAfterAddons, 700);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();
