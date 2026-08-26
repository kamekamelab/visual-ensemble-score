'use strict';

(() => {
  let raf = 0;
  let running = false;
  let playerTime = 0;
  let lastMessageAt = 0;
  let lastFrameAt = 0;
  let playerState = -1;

  function isYouTubeSong() {
    const song = selectedSong();
    return !!song && (song.source === 'youtube' || song.mime === 'youtube');
  }

  // 4回タップを曲の途中で行っても、絵譜全体をその時刻まで遅らせない。
  // 保存するのは「曲中の絶対時刻」ではなく「1拍の中の位相」に正規化する。
  function normalizeBeatOffset() {
    const song = selectedSong();
    if (!song) return;
    const bpm = Number(song.bpm || 120);
    if (!Number.isFinite(bpm) || bpm <= 0) return;
    const beatSec = 60 / bpm;
    const raw = Number(song.beatOffset || 0);
    if (!Number.isFinite(raw)) {
      song.beatOffset = 0;
      return;
    }
    const normalized = ((raw % beatSec) + beatSec) % beatSec;
    if (Math.abs(raw - normalized) > 0.001) {
      song.beatOffset = normalized;
      try { dbPut(STORE_SONGS, song); } catch (e) {}
    }
  }

  function stopLoop() {
    running = false;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function ensureRows() {
    if (state.screen !== 'performance') return;
    const rows = document.getElementById('scoreRows');
    if (!rows) return;
    if (!rows.children.length && Array.isArray(state.selectedInstrumentIds) && state.selectedInstrumentIds.length) {
      try { renderPerformance(); } catch (e) { console.warn('score rerender', e); }
    }
  }

  function draw() {
    if (!isYouTubeSong()) return;
    normalizeBeatOffset();
    ensureRows();
    applyTrackPosition(Math.max(0, playerTime));
    updateTimeUI(Math.max(0, playerTime));
  }

  function loop(now) {
    if (!running || !isYouTubeSong()) return;
    if (!lastFrameAt) lastFrameAt = now;
    const delta = Math.max(0, Math.min((now - lastFrameAt) / 1000, 0.12));
    lastFrameAt = now;

    const messageFresh = performance.now() - lastMessageAt < 900;
    if (!messageFresh && playerState === 1) playerTime += delta;

    draw();
    raf = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (!isYouTubeSong()) return;
    normalizeBeatOffset();
    running = true;
    lastFrameAt = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function resetScoreToStart() {
    playerTime = 0;
    lastMessageAt = 0;
    lastFrameAt = 0;
    playerState = 5;
    stopLoop();
    normalizeBeatOffset();
    setTimeout(() => {
      ensureRows();
      draw();
    }, 80);
  }

  function parseMessage(data) {
    if (typeof data === 'string') {
      try { return JSON.parse(data); } catch (e) { return null; }
    }
    return data && typeof data === 'object' ? data : null;
  }

  window.addEventListener('message', (event) => {
    if (!isYouTubeSong()) return;
    const data = parseMessage(event.data);
    if (!data || data.event !== 'infoDelivery' || !data.info) return;

    if (Number.isFinite(data.info.currentTime)) {
      playerTime = Math.max(0, data.info.currentTime);
      lastMessageAt = performance.now();
      draw();
    }

    if (Number.isFinite(data.info.playerState)) {
      playerState = data.info.playerState;
      if (playerState === 1) {
        startLoop();
      } else if (playerState === 0 || playerState === 2) {
        stopLoop();
      } else if (playerState === 5) {
        // cueVideoById 後。前の再生時刻を残さず先頭の絵譜を表示する。
        resetScoreToStart();
      }
    }
  });

  function bind() {
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');
    const seekBar = document.getElementById('seekBar');
    const performanceScreen = document.getElementById('screen-performance');

    playBtn?.addEventListener('click', () => {
      if (!isYouTubeSong()) return;
      normalizeBeatOffset();
      setTimeout(() => {
        if (!isYouTubeSong()) return;
        playerState = 1;
        startLoop();
      }, 350);
    });

    pauseBtn?.addEventListener('click', () => {
      if (!isYouTubeSong()) return;
      playerState = 2;
      stopLoop();
    });

    stopBtn?.addEventListener('click', () => {
      if (!isYouTubeSong()) return;
      resetScoreToStart();
    });

    seekBar?.addEventListener('input', (event) => {
      if (!isYouTubeSong()) return;
      const song = selectedSong();
      const duration = Number(song?.duration || 0);
      if (duration > 0) {
        playerTime = (Number(event.target.value) / 1000) * duration;
        draw();
      }
    });

    // 合奏画面に入るたび、以前のYouTube再生位置を引き継がない。
    if (performanceScreen) {
      const observer = new MutationObserver(() => {
        if (performanceScreen.classList.contains('active') && isYouTubeSong()) resetScoreToStart();
      });
      observer.observe(performanceScreen, { attributes: true, attributeFilter: ['class'] });
    }

    // 既に保存済みの大きなbeatOffsetも自動修復する。
    setTimeout(() => {
      if (isYouTubeSong()) normalizeBeatOffset();
      ensureRows();
    }, 700);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && isYouTubeSong()) {
        normalizeBeatOffset();
        ensureRows();
        if (running) startLoop(); else draw();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }
})();
