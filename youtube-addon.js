'use strict';

/* YouTube add-on for Digital Ensemble Score */
(() => {
  const YT_KEY = 'digitalScore.youtubeApiKey';
  let ytPlayer = null;
  let ytReadyPromise = null;
  let ytPanel = null;
  let ytBox = null;

  function isYouTubeSong(song = selectedSong()) {
    return !!song && (song.source === 'youtube' || song.mime === 'youtube');
  }

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .youtube-btn{background:#ff0033!important;color:#fff!important;border:none!important}
      .youtube-btn:hover{filter:brightness(.96)}
      .youtube-modal{max-width:900px!important;width:min(94vw,900px)!important}
      .youtube-settings{display:grid;gap:10px;padding:12px;border:2px solid #f1dfd0;border-radius:16px;background:#fffaf5;margin-bottom:12px}
      .youtube-search-row{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
      .youtube-search-row input{flex:1;min-width:220px}
      .youtube-results{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;max-height:52vh;overflow:auto;padding:4px}
      .youtube-result{border:2px solid #eee;border-radius:16px;padding:10px;background:#fff;display:grid;gap:8px}
      .youtube-result img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:12px;background:#eee}
      .youtube-result h3{font-size:16px;margin:0;line-height:1.35}
      .youtube-result .channel{font-size:13px;color:#70675f}
      .youtube-direct{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
      .youtube-direct input{flex:1;min-width:240px}
      .youtube-player-panel{display:flex;gap:12px;align-items:center;margin:8px 0 10px;padding:8px 10px;border-radius:14px;background:#111;color:#fff}
      .youtube-player-box{width:min(36vw,420px);min-width:355px;aspect-ratio:16/9;overflow:hidden;border-radius:10px;background:#000;flex:none}
      .youtube-player-box iframe{width:100%;height:100%}
      .youtube-player-note{font-size:13px;line-height:1.4}
      .yt-source-badge{display:inline-block;margin-top:6px;padding:3px 8px;border-radius:999px;background:#ff0033;color:#fff;font-size:12px;font-weight:700}
      @media(max-width:760px){.youtube-player-panel{flex-direction:column;align-items:stretch}.youtube-player-box{width:100%;min-width:0}.youtube-player-note{text-align:center}}
    `;
    document.head.appendChild(style);
  }

  function injectUI() {
    const toolbar = document.querySelector('#screen-song .toolbar');
    if (toolbar && !document.getElementById('youtubeSearchBtn')) {
      const searchBtn = document.createElement('button');
      searchBtn.id = 'youtubeSearchBtn';
      searchBtn.className = 'youtube-btn';
      searchBtn.textContent = '▶ YouTubeで探す';
      const settingsBtn = document.createElement('button');
      settingsBtn.id = 'youtubeSettingsBtn';
      settingsBtn.className = 'soft-btn';
      settingsBtn.textContent = '⚙ YouTube設定';
      toolbar.insertBefore(settingsBtn, toolbar.children[1] || null);
      toolbar.insertBefore(searchBtn, settingsBtn);
    }

    if (!document.getElementById('youtubeModal')) {
      const modal = document.createElement('div');
      modal.id = 'youtubeModal';
      modal.className = 'modal-backdrop';
      modal.hidden = true;
      modal.innerHTML = `
        <div class="modal youtube-modal" role="dialog" aria-modal="true" aria-labelledby="youtubeModalTitle">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:start">
            <div><h2 id="youtubeModalTitle">YouTubeで曲を探す</h2><p class="hint">検索にはYouTube Data APIキーが必要です。URL貼り付けならAPIキーなしでも追加できます。</p></div>
            <button id="closeYouTubeModalBtn" class="icon-btn" aria-label="閉じる">×</button>
          </div>
          <div class="youtube-settings">
            <label>YouTube Data APIキー<input id="youtubeApiKeyInput" type="password" autocomplete="off" placeholder="AIza..." /></label>
            <div class="toolbar wrap"><button id="saveYouTubeKeyBtn" class="soft-btn">APIキーを保存</button><button id="clearYouTubeKeyBtn" class="soft-btn">APIキーを消す</button></div>
          </div>
          <div class="youtube-search-row"><input id="youtubeQueryInput" type="search" placeholder="例：アフリカンシンフォニー" /><button id="youtubeDoSearchBtn" class="youtube-btn">検索</button></div>
          <div id="youtubeSearchStatus" class="hint"></div>
          <div id="youtubeResults" class="youtube-results"></div>
          <hr style="margin:16px 0;border:0;border-top:1px solid #ddd">
          <h3>URLから直接追加</h3>
          <div class="youtube-direct"><input id="youtubeUrlInput" type="url" placeholder="https://www.youtube.com/watch?v=..." /><input id="youtubeTitleInput" type="text" placeholder="曲名（任意）" /><button id="youtubeAddUrlBtn" class="soft-btn">このURLを追加</button></div>
        </div>`;
      document.body.appendChild(modal);
    }

    const performance = document.getElementById('screen-performance');
    if (performance && !document.getElementById('youtubePlayerPanel')) {
      ytPanel = document.createElement('div');
      ytPanel.id = 'youtubePlayerPanel';
      ytPanel.className = 'youtube-player-panel';
      ytPanel.hidden = true;
      ytPanel.innerHTML = '<div id="youtubePlayerBox" class="youtube-player-box"><div id="youtubePlayer"></div></div><div class="youtube-player-note">YouTube動画と絵譜を同期して再生します。YouTube曲は「4回タップ補正」でテンポと拍位置を合わせてください。</div>';
      performance.insertBefore(ytPanel, document.getElementById('scoreViewport'));
      ytBox = document.getElementById('youtubePlayerBox');
    }
  }

  function youtubeApiKey() {
    return localStorage.getItem(YT_KEY) || '';
  }

  function openYouTubeModal(focusSearch = true) {
    document.getElementById('youtubeApiKeyInput').value = youtubeApiKey();
    document.getElementById('youtubeModal').hidden = false;
    if (focusSearch) setTimeout(() => document.getElementById('youtubeQueryInput').focus(), 50);
  }

  function closeYouTubeModal() {
    document.getElementById('youtubeModal').hidden = true;
  }

  function parseYouTubeId(value) {
    const s = String(value || '').trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
    try {
      const u = new URL(s);
      if (u.hostname.includes('youtu.be')) return u.pathname.split('/').filter(Boolean)[0] || '';
      if (u.hostname.includes('youtube.com')) {
        if (u.pathname === '/watch') return u.searchParams.get('v') || '';
        const m = u.pathname.match(/\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/);
        if (m) return m[1];
      }
    } catch (e) {}
    return '';
  }

  async function addYouTubeSong({ videoId, title, channelTitle = '', thumbnail = '' }) {
    if (!videoId) return;
    const existing = state.songs.find(s => s.source === 'youtube' && s.videoId === videoId);
    if (existing) {
      state.selectedSongId = existing.id;
      document.getElementById('songGoBtn').disabled = false;
      updateTempoStatus();
      renderSongs();
      closeYouTubeModal();
      toast('すでに追加済みの曲を選びました');
      return;
    }
    const song = {
      id: uid('song'),
      name: title || 'YouTube動画',
      bpm: 120,
      beatOffset: 0,
      duration: null,
      mime: 'youtube',
      source: 'youtube',
      videoId,
      channelTitle,
      thumbnail,
      blob: new Blob([], { type: 'application/x-youtube' }),
      createdAt: Date.now()
    };
    await dbPut(STORE_SONGS, song);
    state.songs.push(song);
    state.selectedSongId = song.id;
    document.getElementById('songGoBtn').disabled = false;
    updateTempoStatus();
    renderSongs();
    closeYouTubeModal();
    toast('YouTubeの曲を追加しました。演奏前に4回タップでテンポを合わせてください');
  }

  async function searchYouTube() {
    const keyInput = document.getElementById('youtubeApiKeyInput');
    const qInput = document.getElementById('youtubeQueryInput');
    const status = document.getElementById('youtubeSearchStatus');
    const results = document.getElementById('youtubeResults');
    const btn = document.getElementById('youtubeDoSearchBtn');
    const key = keyInput.value.trim() || youtubeApiKey();
    const q = qInput.value.trim();
    if (!key) {
      status.textContent = '検索にはAPIキーが必要です。下の「URLから直接追加」はAPIキーなしで使えます。';
      return;
    }
    if (!q) {
      status.textContent = '曲名やキーワードを入力してください。';
      return;
    }
    btn.disabled = true;
    btn.textContent = '検索中…';
    results.innerHTML = '';
    status.textContent = 'YouTubeを検索しています…';
    try {
      const params = new URLSearchParams({
        part: 'snippet', type: 'video', q, maxResults: '12', safeSearch: 'strict',
        videoEmbeddable: 'true', videoSyndicated: 'true', regionCode: 'JP', relevanceLanguage: 'ja', key
      });
      const resp = await fetch('https://www.googleapis.com/youtube/v3/search?' + params.toString());
      const data = await resp.json();
      if (!resp.ok) throw new Error(data && data.error && data.error.message ? data.error.message : ('HTTP ' + resp.status));
      const items = data.items || [];
      status.textContent = items.length ? items.length + '件表示しています。「この曲を使う」を押してください。' : '見つかりませんでした。';
      items.forEach(item => {
        const videoId = item.id && item.id.videoId;
        if (!videoId) return;
        const sn = item.snippet || {};
        const thumb = (sn.thumbnails && (sn.thumbnails.medium || sn.thumbnails.default) && (sn.thumbnails.medium || sn.thumbnails.default).url) || '';
        const card = document.createElement('article');
        card.className = 'youtube-result';
        card.innerHTML = `<img src="${escapeHtml(thumb)}" alt=""><h3>${escapeHtml(sn.title || 'YouTube動画')}</h3><div class="channel">${escapeHtml(sn.channelTitle || '')}</div>`;
        const use = document.createElement('button');
        use.className = 'youtube-btn';
        use.textContent = '＋ この曲を使う';
        use.onclick = () => addYouTubeSong({ videoId, title: sn.title || 'YouTube動画', channelTitle: sn.channelTitle || '', thumbnail: thumb });
        card.appendChild(use);
        results.appendChild(card);
      });
    } catch (e) {
      console.error(e);
      status.textContent = '検索できませんでした：' + e.message + '。APIキーのYouTube Data API v3設定とGitHub PagesのURL制限を確認してください。';
    } finally {
      btn.disabled = false;
      btn.textContent = '検索';
    }
  }

  function loadYouTubeAPI() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (ytReadyPromise) return ytReadyPromise;
    ytReadyPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        try { if (previous) previous(); } catch (e) {}
        resolve();
      };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      s.onerror = () => reject(new Error('YouTube Player APIを読み込めませんでした'));
      document.head.appendChild(s);
      setTimeout(() => { if (window.YT && window.YT.Player) resolve(); }, 5000);
    });
    return ytReadyPromise;
  }

  async function ensurePlayer(videoId) {
    await loadYouTubeAPI();
    if (!ytPlayer) {
      await new Promise((resolve) => {
        ytPlayer = new YT.Player('youtubePlayer', {
          width: '100%', height: '100%', videoId,
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
          events: {
            onReady: resolve,
            onStateChange: (ev) => {
              if (ev.data === YT.PlayerState.ENDED) {
                state.playing = false;
                cancelAnimationFrame(state.raf);
                onEnded();
              }
            }
          }
        });
      });
    } else {
      ytPlayer.cueVideoById(videoId);
    }
    return ytPlayer;
  }

  function ytTime() {
    try { return Number(ytPlayer && ytPlayer.getCurrentTime ? ytPlayer.getCurrentTime() : 0) || 0; } catch (e) { return 0; }
  }

  function ytDuration() {
    try { return Number(ytPlayer && ytPlayer.getDuration ? ytPlayer.getDuration() : 0) || Number(selectedSong() && selectedSong().duration || 0); } catch (e) { return Number(selectedSong() && selectedSong().duration || 0); }
  }

  const originalPrepareMedia = prepareMedia;
  const originalRenderSongs = renderSongs;
  const originalPlay = play;
  const originalPause = pause;
  const originalStop = stop;
  const originalUpdateTimeUI = updateTimeUI;
  const originalTick = tick;
  const originalTapTempo = tapTempo;

  renderSongs = function() {
    originalRenderSongs();
    const cards = Array.from(document.querySelectorAll('#songGrid .song-card'));
    state.songs.forEach((song, i) => {
      if (!isYouTubeSong(song) || !cards[i]) return;
      const h = cards[i].querySelector('h3');
      if (h) h.textContent = '▶ ' + song.name;
      const meta = cards[i].querySelectorAll('.meta');
      if (meta[1]) meta[1].textContent = song.channelTitle || 'YouTube';
      const badge = document.createElement('span');
      badge.className = 'yt-source-badge';
      badge.textContent = 'YouTube';
      cards[i].appendChild(badge);
    });
  };

  prepareMedia = async function() {
    const song = selectedSong();
    if (!isYouTubeSong(song)) {
      if (ytPanel) ytPanel.hidden = true;
      try { if (ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo(); } catch (e) {}
      return originalPrepareMedia();
    }
    document.getElementById('audioPlayer').pause();
    document.getElementById('videoPlayer').pause();
    document.getElementById('audioPlayer').hidden = true;
    document.getElementById('videoPlayer').hidden = true;
    ytPanel.hidden = false;
    await ensurePlayer(song.videoId);
    await new Promise(r => setTimeout(r, 400));
    const dur = ytDuration();
    if (dur && !song.duration) {
      song.duration = dur;
      dbPut(STORE_SONGS, song);
    }
  };

  updateTimeUI = function(t) {
    if (!isYouTubeSong()) return originalUpdateTimeUI(t);
    const dur = ytDuration();
    document.getElementById('timeLabel').textContent = `${formatTime(t)} / ${formatTime(dur)}`;
    document.getElementById('seekBar').value = dur ? Math.round((t / dur) * 1000) : 0;
  };

  tick = function() {
    if (!isYouTubeSong()) return originalTick();
    if (!state.playing) return;
    const t = ytTime();
    applyTrackPosition(t);
    updateTimeUI(t);
    let playing = false;
    try { playing = ytPlayer && ytPlayer.getPlayerState() === YT.PlayerState.PLAYING; } catch (e) {}
    if (playing) state.raf = requestAnimationFrame(tick);
  };

  play = async function() {
    if (!isYouTubeSong()) return originalPlay();
    try {
      await prepareMedia();
      ytPlayer.playVideo();
      state.playing = true;
      cancelAnimationFrame(state.raf);
      state.raf = requestAnimationFrame(tick);
    } catch (e) {
      console.error(e);
      toast('YouTubeを再生できませんでした。通信状態や動画の埋め込み許可を確認してください。');
    }
  };

  pause = function() {
    if (!isYouTubeSong()) return originalPause();
    try { if (ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo(); } catch (e) {}
    state.playing = false;
    cancelAnimationFrame(state.raf);
  };

  stop = function() {
    if (!isYouTubeSong()) return originalStop();
    pause();
    try { if (ytPlayer && ytPlayer.seekTo) ytPlayer.seekTo(0, true); } catch (e) {}
    applyTrackPosition(0);
    updateTimeUI(0);
  };

  tapTempo = async function() {
    const song = selectedSong();
    if (!isYouTubeSong(song)) return originalTapTempo();
    if (state.screen === 'song') {
      await prepareMedia();
      try { ytPlayer.playVideo(); } catch (e) {}
    }
    const now = performance.now();
    if (state.tapTimes.length && now - state.tapTimes[state.tapTimes.length - 1].wall > 2200) state.tapTimes = [];
    state.tapTimes.push({ wall: now, audio: ytTime() });
    if (state.tapTimes.length > 4) state.tapTimes.shift();
    toast(state.tapTimes.length + '/4 タップ');
    if (state.tapTimes.length === 4) {
      const ds = [];
      for (let i = 1; i < 4; i++) ds.push(state.tapTimes[i].wall - state.tapTimes[i - 1].wall);
      song.bpm = Math.max(40, Math.min(240, 60000 / (ds.reduce((a, b) => a + b, 0) / ds.length)));
      song.beatOffset = Math.max(0, state.tapTimes[0].audio || 0);
      await dbPut(STORE_SONGS, song);
      updateTempoStatus();
      renderSongs();
      if (state.screen === 'performance') renderPerformance();
      toast('約 ' + Math.round(song.bpm) + ' BPM・拍の位置を補正しました');
      state.tapTimes = [];
    }
  };

  function bindYouTubeUI() {
    document.getElementById('youtubeSearchBtn').onclick = () => openYouTubeModal(true);
    document.getElementById('youtubeSettingsBtn').onclick = () => openYouTubeModal(false);
    document.getElementById('closeYouTubeModalBtn').onclick = closeYouTubeModal;
    document.getElementById('youtubeModal').addEventListener('click', e => { if (e.target === document.getElementById('youtubeModal')) closeYouTubeModal(); });
    document.getElementById('saveYouTubeKeyBtn').onclick = () => {
      const key = document.getElementById('youtubeApiKeyInput').value.trim();
      if (!key) return toast('APIキーを入力してください');
      localStorage.setItem(YT_KEY, key);
      toast('YouTube APIキーをこの端末に保存しました');
    };
    document.getElementById('clearYouTubeKeyBtn').onclick = () => {
      localStorage.removeItem(YT_KEY);
      document.getElementById('youtubeApiKeyInput').value = '';
      toast('APIキーを消しました');
    };
    document.getElementById('youtubeDoSearchBtn').onclick = searchYouTube;
    document.getElementById('youtubeQueryInput').addEventListener('keydown', e => { if (e.key === 'Enter') searchYouTube(); });
    document.getElementById('youtubeAddUrlBtn').onclick = () => {
      const raw = document.getElementById('youtubeUrlInput').value;
      const id = parseYouTubeId(raw);
      if (!id) return toast('YouTubeのURLを確認してください');
      const title = document.getElementById('youtubeTitleInput').value.trim() || 'YouTube動画';
      addYouTubeSong({ videoId: id, title });
    };

    document.getElementById('tapTempoSongBtn').onclick = tapTempo;
    document.getElementById('tapTempoPerfBtn').onclick = tapTempo;
    document.getElementById('playBtn').onclick = play;
    document.getElementById('pauseBtn').onclick = pause;
    document.getElementById('stopBtn').onclick = stop;
    document.getElementById('seekBar').oninput = e => {
      if (!isYouTubeSong()) {
        const p = player();
        if (Number.isFinite(p.duration)) {
          p.currentTime = (Number(e.target.value) / 1000) * p.duration;
          applyTrackPosition(p.currentTime);
          updateTimeUI(p.currentTime);
        }
        return;
      }
      const dur = ytDuration();
      if (!dur) return;
      const t = (Number(e.target.value) / 1000) * dur;
      try { ytPlayer.seekTo(t, true); } catch (err) {}
      applyTrackPosition(t);
      updateTimeUI(t);
    };
    window.addEventListener('resize', () => { if (state.screen === 'performance' && isYouTubeSong()) applyTrackPosition(ytTime()); });
  }

  function boot() {
    injectStyles();
    injectUI();
    bindYouTubeUI();
    const p = document.querySelector('#screen-song .page-head p');
    if (p) p.textContent = '端末のMP3・M4A・WAV・MP4、またはYouTubeから曲を追加できます。';
    setTimeout(() => renderSongs(), 300);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
