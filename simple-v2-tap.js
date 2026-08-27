'use strict';

/* v2.1 teacher sync controls: decimal BPM, robust 4-tap, start shift, rhythm edit. */
(() => {
  let taps = [];
  let tapPlayerState = -1;
  const MIN_BPM = 30;
  const MAX_BPM = 300;

  function isYT(song = selectedSong()) {
    return !!song && (song.source === 'youtube' || song.mime === 'youtube');
  }

  function preciseMediaTime() {
    const song = selectedSong();
    if (!song) return 0;
    if (isYT(song) && typeof window.digitalScoreYouTubeTime === 'function') {
      return Number(window.digitalScoreYouTubeTime()) || 0;
    }
    try { return Number(player()?.currentTime || 0); } catch (_) { return 0; }
  }

  function bpmText(song = selectedSong()) {
    return `${Number(song?.bpm || 120).toFixed(1)} BPM`;
  }

  function shiftText(song = selectedSong()) {
    const v = Number(song?.scoreShiftBeats || 0);
    if (Math.abs(v) < 0.0005) return '0.0拍';
    return `${v > 0 ? '+' : ''}${v.toFixed(1)}拍`;
  }

  function addStyles() {
    const s = document.createElement('style');
    s.textContent = `
      .sync-panel{display:grid;gap:12px;border:2px solid var(--line);border-radius:18px;padding:15px;margin-top:14px;background:#fff}
      .sync-panel h3{margin:0}.sync-value{text-align:center;font-size:1.55rem;font-weight:1000;padding:8px;border-radius:14px;background:#fff7e8}
      .sync-buttons{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.sync-buttons button{min-height:54px;border:2px solid var(--line);border-radius:14px;background:#fff;font-weight:900}
      .sync-note{font-size:.9rem;color:var(--muted);line-height:1.5;margin:0}
      #simpleTapStatus{font-variant-numeric:tabular-nums}
      #editRhythmPerfBtn{min-height:48px;border-radius:14px;border:2px solid #777;background:#2d2d2d;color:#fff;padding:0 14px;font-weight:900}
      @media(max-width:540px){.sync-buttons{grid-template-columns:repeat(2,1fr)}}
    `;
    document.head.appendChild(s);
  }

  async function saveSong(song) {
    await dbPut(STORE_SONGS, song);
    try { updateTempoStatus(); } catch (_) {}
    try { renderSongs(); } catch (_) {}
    refreshControls();
    if (state.screen === 'performance') {
      try { applyTrackPosition(preciseMediaTime()); } catch (_) {}
    }
  }

  async function adjustBpm(delta) {
    const song = selectedSong();
    if (!song) return toast('先に曲を選んでください');
    const next = Math.max(MIN_BPM, Math.min(MAX_BPM, Number(song.bpm || 120) + delta));
    song.bpm = Math.round(next * 10) / 10;
    await saveSong(song);
    toast(`テンポ ${bpmText(song)}`);
  }

  async function adjustShift(delta) {
    const song = selectedSong();
    if (!song) return toast('先に曲を選んでください');
    const next = Math.max(-64, Math.min(64, Number(song.scoreShiftBeats || 0) + delta));
    song.scoreShiftBeats = Math.round(next * 10) / 10;
    await saveSong(song);
    toast(`絵譜の開始 ${shiftText(song)}`);
  }

  const baseApplyTrackPosition = applyTrackPosition;
  applyTrackPosition = function(time) {
    const song = selectedSong();
    if (!song || !Number(song.scoreShiftBeats || 0)) return baseApplyTrackPosition(time);
    const originalOffset = Number(song.beatOffset || 0);
    const bpm = Number(song.bpm || 120) || 120;
    const shiftSec = Number(song.scoreShiftBeats || 0) * 60 / bpm;
    song.beatOffset = originalOffset + shiftSec;
    try { return baseApplyTrackPosition(time); }
    finally { song.beatOffset = originalOffset; }
  };

  function createControls() {
    const teacher = document.getElementById('simpleTeacherModal')?.querySelector('.simple-modal');
    if (!teacher || document.getElementById('syncBpmPanel')) return;

    const tapBox = document.getElementById('simpleTapBtn')?.closest('.simple-teacher-box');

    const bpm = document.createElement('div');
    bpm.id = 'syncBpmPanel'; bpm.className = 'sync-panel';
    bpm.innerHTML = `
      <h3>テンポを細かく合わせる</h3>
      <div id="syncBpmValue" class="sync-value">120.0 BPM</div>
      <div class="sync-buttons">
        <button data-bpm="-1">−1.0</button><button data-bpm="-0.1">−0.1</button>
        <button data-bpm="0.1">＋0.1</button><button data-bpm="1">＋1.0</button>
      </div>
      <p class="sync-note">4回タップのあと、少しずつずれるときは ±0.1 で合わせます。値は曲ごとに保存されます。</p>`;

    const shift = document.createElement('div');
    shift.id = 'syncShiftPanel'; shift.className = 'sync-panel';
    shift.innerHTML = `
      <h3>絵譜のスタート位置</h3>
      <div id="syncShiftValue" class="sync-value">0.0拍</div>
      <div class="sync-buttons">
        <button data-shift="-1">1拍 早く</button><button data-shift="-0.1">0.1拍 早く</button>
        <button data-shift="0.1">0.1拍 遅く</button><button data-shift="1">1拍 遅く</button>
      </div>
      <p class="sync-note">曲は合っているけれど「ここ！」に来るのが早い・遅いときに使います。</p>`;

    if (tapBox) {
      tapBox.insertAdjacentElement('afterend', bpm);
      bpm.insertAdjacentElement('afterend', shift);
    } else {
      teacher.append(bpm, shift);
    }

    bpm.querySelectorAll('[data-bpm]').forEach(b => b.onclick = () => adjustBpm(Number(b.dataset.bpm)));
    shift.querySelectorAll('[data-shift]').forEach(b => b.onclick = () => adjustShift(Number(b.dataset.shift)));

    const controls = document.querySelector('.performance-controls');
    if (controls && !document.getElementById('editRhythmPerfBtn')) {
      const edit = document.createElement('button');
      edit.id = 'editRhythmPerfBtn'; edit.textContent = '✏ リズムを直す';
      edit.onclick = () => {
        pause();
        state.rhythmIndex = 0;
        renderRhythmEditor();
        showScreen('rhythm');
      };
      controls.appendChild(edit);
    }

    refreshControls();
  }

  function refreshControls() {
    const song = selectedSong();
    const b = document.getElementById('syncBpmValue'); if (b) b.textContent = song ? bpmText(song) : '曲を選んでください';
    const s = document.getElementById('syncShiftValue'); if (s) s.textContent = song ? shiftText(song) : '曲を選んでください';
    const status = document.getElementById('simpleTapStatus');
    if (status && song && !taps.length) status.textContent = `現在 ${bpmText(song)} ／ 開始 ${shiftText(song)}`;
  }

  function regressionBeatSeconds(points) {
    const xs = [0,1,2,3];
    const ys = points.map(p => p.wall / 1000);
    const xMean = 1.5;
    const yMean = ys.reduce((a,b) => a+b, 0) / ys.length;
    let num = 0, den = 0;
    for (let i=0;i<4;i++) { num += (xs[i]-xMean)*(ys[i]-yMean); den += (xs[i]-xMean)**2; }
    return num / den;
  }

  function circularPhase(points, beatSec) {
    let sx = 0, sy = 0;
    points.forEach((p, i) => {
      const phaseSec = p.media - i * beatSec;
      const angle = 2 * Math.PI * (phaseSec / beatSec);
      sx += Math.cos(angle); sy += Math.sin(angle);
    });
    let angle = Math.atan2(sy, sx);
    if (angle < 0) angle += 2 * Math.PI;
    return (angle / (2 * Math.PI)) * beatSec;
  }

  async function robustTap() {
    const song = selectedSong();
    if (!song) return toast('先に曲を選んでください');
    const now = performance.now();
    if (taps.length && now - taps[taps.length-1].wall > 2500) taps = [];
    taps.push({ wall: now, media: preciseMediaTime() });
    if (taps.length > 4) taps.shift();
    const status = document.getElementById('simpleTapStatus');
    if (status) status.textContent = `${['①','②','③','④'].slice(0,taps.length).join(' ')}　${taps.length}/4`;
    if (taps.length < 4) return;

    let beatSec = regressionBeatSeconds(taps);
    if (!Number.isFinite(beatSec) || beatSec < 0.22 || beatSec > 2.2) {
      taps = [];
      if (status) status.textContent = 'もう一度、一定の拍で4回タップしてください';
      return toast('タップ間隔を読み取れませんでした');
    }
    let bpm = 60 / beatSec;
    while (bpm < 50) { bpm *= 2; beatSec /= 2; }
    while (bpm > 220) { bpm /= 2; beatSec *= 2; }
    bpm = Math.round(bpm * 10) / 10;
    beatSec = 60 / bpm;

    song.bpm = bpm;
    song.beatOffset = circularPhase(taps, beatSec);
    await saveSong(song);
    if (status) status.textContent = `✓ ${bpm.toFixed(1)} BPM　拍位置も合わせました`;
    toast(`4タップ補正：${bpm.toFixed(1)} BPM`);
    taps = [];
  }

  async function startTapPlayback() {
    const song = selectedSong();
    if (!song) return toast('先に曲を選んでください');
    taps = [];
    try {
      await prepareMedia();
      await play();
      const status = document.getElementById('simpleTapStatus');
      if (status) status.textContent = '曲を聞いて、拍に合わせて4回タップ';
    } catch (e) {
      console.error(e);
      toast('曲を再生できませんでした');
    }
  }

  function ensureTapPlaybackButton() {
    const tap = document.getElementById('simpleTapBtn');
    if (!tap || document.getElementById('simpleTapPlayBtn')) return;
    const playBtn = document.createElement('button');
    playBtn.id = 'simpleTapPlayBtn';
    playBtn.type = 'button';
    playBtn.textContent = '▶ 曲を流す';
    playBtn.style.cssText = 'width:100%;min-height:64px;border:0;border-radius:18px;background:#f05d23;color:#fff;font-size:1.2rem;font-weight:1000;margin:8px 0 10px';
    tap.parentNode.insertBefore(playBtn, tap);
  }

  function replaceTapHandlers() {
    ensureTapPlaybackButton();
    const oldTap = document.getElementById('simpleTapBtn');
    if (oldTap && oldTap.dataset.robustTap !== '1') {
      const fresh = oldTap.cloneNode(true);
      fresh.dataset.robustTap = '1';
      fresh.textContent = '1・2・3・4 に合わせてタップ';
      oldTap.replaceWith(fresh);
      fresh.onclick = robustTap;
    }
    const oldPlay = document.getElementById('simpleTapPlayBtn');
    if (oldPlay && oldPlay.dataset.robustTap !== '1') {
      const freshPlay = oldPlay.cloneNode(true);
      freshPlay.dataset.robustTap = '1';
      oldPlay.replaceWith(freshPlay);
      freshPlay.onclick = startTapPlayback;
    }
  }

  window.addEventListener('message', e => {
    let d = e.data;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (_) { return; } }
    if (d?.event === 'infoDelivery' && Number.isFinite(d?.info?.playerState)) tapPlayerState = Number(d.info.playerState);
  });

  function bindRefresh() {
    document.getElementById('songGrid')?.addEventListener('click', () => setTimeout(refreshControls, 0));
    document.getElementById('simpleTeacherBtn')?.addEventListener('click', () => setTimeout(refreshControls, 0));
  }

  function boot() {
    addStyles();
    createControls();
    replaceTapHandlers();
    bindRefresh();
    setTimeout(() => { createControls(); replaceTapHandlers(); refreshControls(); }, 900);
    setTimeout(() => { replaceTapHandlers(); refreshControls(); }, 1800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
