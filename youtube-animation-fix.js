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

  function stopLoop() {
    running = false;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function draw() {
    if (!isYouTubeSong()) return;
    applyTrackPosition(playerTime);
    updateTimeUI(playerTime);
  }

  function loop(now) {
    if (!running || !isYouTubeSong()) return;

    if (!lastFrameAt) lastFrameAt = now;
    const delta = Math.max(0, Math.min((now - lastFrameAt) / 1000, 0.12));
    lastFrameAt = now;

    // YouTubeから現在時刻が届いている間はその値を最優先。
    // メッセージが一時的に途切れた場合だけ壁時計で補間する。
    const messageFresh = performance.now() - lastMessageAt < 900;
    if (!messageFresh && (playerState === 1 || playerState === -1)) {
      playerTime += delta;
    }

    draw();
    raf = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (!isYouTubeSong()) return;
    running = true;
    lastFrameAt = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function parseMessage(data) {
    if (typeof data === 'string') {
      try { return JSON.parse(data); } catch (e) { return null; }
    }
    return data && typeof data === 'object' ? data : null;
  }

  // YouTube IFrame Player API が送る現在時刻を受け取り、絵譜を正確に同期する。
  window.addEventListener('message', (event) => {
    if (!isYouTubeSong()) return;
    const data = parseMessage(event.data);
    if (!data || data.event !== 'infoDelivery' || !data.info) return;

    if (Number.isFinite(data.info.currentTime)) {
      playerTime = data.info.currentTime;
      lastMessageAt = performance.now();
      draw();
    }

    if (Number.isFinite(data.info.playerState)) {
      playerState = data.info.playerState;
      if (playerState === 1) {
        startLoop();
      } else if (playerState === 0 || playerState === 2 || playerState === 5) {
        stopLoop();
      }
    }
  });

  function bind() {
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');
    const seekBar = document.getElementById('seekBar');

    playBtn?.addEventListener('click', () => {
      if (!isYouTubeSong()) return;
      // youtube-addon.js がプレーヤーを準備する時間を待ってから補助ループを開始。
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
      playerState = 5;
      playerTime = 0;
      stopLoop();
      draw();
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

    // タブ復帰時にも表示位置を現在時刻へ戻す。
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && isYouTubeSong() && running) {
        startLoop();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }
})();
