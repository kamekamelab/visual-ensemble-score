'use strict';

/* Smooth YouTube clock bridge for the scrolling score. */
(() => {
  let anchorTime = 0;
  let anchorWall = performance.now();
  let playerState = -1;
  let lastInfoAt = 0;

  function isYouTubeSong() {
    const song = selectedSong();
    return !!song && (song.source === 'youtube' || song.mime === 'youtube');
  }

  function normalizeBeatOffset() {
    const song = selectedSong();
    if (!song) return;
    const bpm = Number(song.bpm || 120);
    if (!Number.isFinite(bpm) || bpm <= 0) return;
    const beatSec = 60 / bpm;
    const raw = Number(song.beatOffset || 0);
    if (!Number.isFinite(raw)) { song.beatOffset = 0; return; }
    const normalized = ((raw % beatSec) + beatSec) % beatSec;
    if (Math.abs(raw - normalized) > 0.0005) {
      song.beatOffset = normalized;
      Promise.resolve(dbPut(STORE_SONGS, song)).catch(() => {});
    }
  }

  function smoothTime() {
    if (!isYouTubeSong()) return 0;
    const elapsed = Math.max(0, (performance.now() - anchorWall) / 1000);
    if (playerState === 1) return Math.max(0, anchorTime + elapsed);
    return Math.max(0, anchorTime);
  }

  window.digitalScoreYouTubeTime = smoothTime;

  function parseMessage(data) {
    if (typeof data === 'string') {
      try { return JSON.parse(data); } catch (_) { return null; }
    }
    return data && typeof data === 'object' ? data : null;
  }

  window.addEventListener('message', event => {
    if (!isYouTubeSong()) return;
    const data = parseMessage(event.data);
    if (!data || data.event !== 'infoDelivery' || !data.info) return;

    if (Number.isFinite(data.info.currentTime)) {
      anchorTime = Math.max(0, Number(data.info.currentTime));
      anchorWall = performance.now();
      lastInfoAt = anchorWall;
    }
    if (Number.isFinite(data.info.playerState)) {
      const current = smoothTime();
      anchorTime = current;
      anchorWall = performance.now();
      playerState = Number(data.info.playerState);
      if (playerState === 5) {
        anchorTime = 0;
        anchorWall = performance.now();
      }
    }
  });

  const previousTick = tick;
  tick = function() {
    if (!isYouTubeSong()) return previousTick();
    if (!state.playing) return;
    normalizeBeatOffset();
    const t = smoothTime();
    applyTrackPosition(t);
    updateTimeUI(t);
    state.raf = requestAnimationFrame(tick);
  };

  function resetVisualStart() {
    anchorTime = 0;
    anchorWall = performance.now();
    normalizeBeatOffset();
    requestAnimationFrame(() => {
      if (!isYouTubeSong()) return;
      try {
        if (!document.getElementById('scoreRows')?.children.length && state.selectedInstrumentIds?.length) renderPerformance();
        applyTrackPosition(0);
        updateTimeUI(0);
      } catch (_) {}
    });
  }

  function bind() {
    const performanceScreen = document.getElementById('screen-performance');
    if (performanceScreen) {
      const observer = new MutationObserver(() => {
        if (performanceScreen.classList.contains('active') && isYouTubeSong()) resetVisualStart();
      });
      observer.observe(performanceScreen, { attributes: true, attributeFilter: ['class'] });
    }

    document.getElementById('stopBtn')?.addEventListener('click', () => {
      if (isYouTubeSong()) resetVisualStart();
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && isYouTubeSong()) {
        anchorWall = performance.now();
        normalizeBeatOffset();
      }
    });

    setInterval(() => {
      if (!isYouTubeSong() || playerState !== 1) return;
      if (performance.now() - lastInfoAt > 5000) anchorWall = performance.now();
    }, 2000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once:true });
  else bind();
})();
