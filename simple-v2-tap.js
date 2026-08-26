'use strict';

/* v2 tap-tempo patch: teacher flow = play song -> tap 4 beats. */
(() => {
  let taps = [];
  let ytTime = 0;
  let ytTimeAt = 0;

  function isYT(song = selectedSong()) {
    return !!song && (song.source === 'youtube' || song.mime === 'youtube');
  }

  function mediaTime() {
    const song = selectedSong();
    if (!song) return 0;
    if (isYT(song)) {
      if (performance.now() - ytTimeAt < 1800) return ytTime;
      return 0;
    }
    try { return Number(player()?.currentTime || 0); } catch (_) { return 0; }
  }

  function status(text) {
    const el = document.getElementById('simpleTapStatus');
    if (el) el.textContent = text;
  }

  async function startCorrectionPlayback() {
    const song = selectedSong();
    if (!song) return toast('先に曲を選んでください');
    taps = [];
    status('曲を聞いて、拍に合わせて下を4回タップ');
    try {
      await prepareMedia();
      await play();
      toast('曲を流しました。1・2・3・4に合わせてタップしてください');
    } catch (e) {
      console.error(e);
      toast('再生できませんでした。合奏画面の「▶ はじめる」から再生してタップしてください');
    }
  }

  async function doTap() {
    const song = selectedSong();
    if (!song) return toast('先に曲を選んでください');
    const now = performance.now();
    if (taps.length && now - taps[taps.length - 1].wall > 2400) taps = [];
    taps.push({ wall: now, media: mediaTime() });
    if (taps.length > 4) taps.shift();
    const marks = ['①','②','③','④'].slice(0, taps.length).join(' ');
    status(`${marks}　${taps.length} / 4`);
    if (taps.length < 4) return;

    const intervals = [];
    for (let i = 1; i < 4; i++) intervals.push((taps[i].wall - taps[i - 1].wall) / 1000);
    // One accidental uneven interval should not dominate: use the median of 3 intervals.
    const sorted = [...intervals].sort((a,b) => a-b);
    const secPerBeat = sorted[1];
    let bpm = 60 / secPerBeat;
    while (bpm < 50) bpm *= 2;
    while (bpm > 220) bpm /= 2;

    const beatDur = 60 / bpm;
    // First tap may be any beat in the song. Keep only its phase within one beat,
    // so the score does not jump off-screen when tapping midway through a song.
    const firstMedia = Math.max(0, Number(taps[0].media || 0));
    const phase = ((firstMedia % beatDur) + beatDur) % beatDur;

    song.bpm = bpm;
    song.beatOffset = phase;
    await dbPut(STORE_SONGS, song);
    try { updateTempoStatus(); renderSongs(); } catch (_) {}
    try {
      if (state.screen === 'performance') {
        renderPerformance();
        applyTrackPosition(mediaTime());
      }
    } catch (_) {}

    status(`✓ 完了　約 ${Math.round(bpm)} BPM`);
    toast(`拍を合わせました：${Math.round(bpm)} BPM`);
    taps = [];
  }

  function install() {
    const tap = document.getElementById('simpleTapBtn');
    if (!tap || document.getElementById('simpleTapPlayBtn')) return;

    const box = tap.closest('.simple-teacher-box');
    const playBtn = document.createElement('button');
    playBtn.id = 'simpleTapPlayBtn';
    playBtn.type = 'button';
    playBtn.textContent = '▶ 曲を流す';
    playBtn.style.cssText = 'width:100%;min-height:64px;border:0;border-radius:18px;background:#f05d23;color:#fff;font-size:1.2rem;font-weight:1000;margin:8px 0 10px';
    tap.parentNode.insertBefore(playBtn, tap);
    playBtn.onclick = startCorrectionPlayback;

    // Remove the previous tap handler by replacing the node.
    const fresh = tap.cloneNode(true);
    fresh.textContent = '1・2・3・4 に合わせてタップ';
    tap.replaceWith(fresh);
    fresh.onclick = doTap;

    const hint = box?.querySelector('.hint');
    if (hint) hint.textContent = '①「曲を流す」 ② 聞こえる拍に合わせて、大きな青いボタンを4回タップ。これだけでテンポと拍位置を合わせます。';
  }

  window.addEventListener('message', e => {
    let d = e.data;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (_) { return; } }
    if (d?.event === 'infoDelivery' && Number.isFinite(d?.info?.currentTime)) {
      ytTime = d.info.currentTime;
      ytTimeAt = performance.now();
    }
  });

  function boot() {
    install();
    setTimeout(install, 900);
    setTimeout(install, 1800);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
