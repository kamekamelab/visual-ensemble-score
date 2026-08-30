'use strict';

/* iPhone/iPad Photos video import fix. */
(() => {
  function inferMime(file) {
    const type = String(file?.type || '').toLowerCase();
    if (type.startsWith('video/') || type.startsWith('audio/')) return type;
    const name = String(file?.name || '').toLowerCase();
    if (/\.(mov|qt)$/.test(name)) return 'video/quicktime';
    if (/\.(mp4|m4v)$/.test(name)) return 'video/mp4';
    if (/\.(webm)$/.test(name)) return 'video/webm';
    if (/\.(mp3)$/.test(name)) return 'audio/mpeg';
    if (/\.(m4a|aac)$/.test(name)) return 'audio/mp4';
    if (/\.(wav)$/.test(name)) return 'audio/wav';
    return type || 'application/octet-stream';
  }

  function isSupportedMedia(file) {
    const mime = inferMime(file);
    return mime.startsWith('video/') || mime.startsWith('audio/');
  }

  function install() {
    const input = document.getElementById('songFileInput');
    const confirm = document.getElementById('confirmSongBtn');
    if (!input || !confirm || input.dataset.photosFix === '1') return;
    input.dataset.photosFix = '1';
    input.setAttribute('accept', 'video/*,audio/*,.mov,.mp4,.m4v,.mp3,.m4a,.wav');

    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!isSupportedMedia(file)) {
        toast('このファイル形式は読み込めません。MOV・MP4・M4V・MP3・M4A・WAVを選んでください');
        e.target.value = '';
        return;
      }
      state.tempSongFile = file;
      document.getElementById('songNameInput').value = file.name.replace(/\.[^.]+$/, '');
      const hint = document.querySelector('#songNameModal .hint');
      if (hint) {
        const mb = Math.max(0.1, file.size / 1024 / 1024).toFixed(1);
        hint.textContent = `${inferMime(file).startsWith('video/') ? '動画' : '音声'}・約 ${mb} MB。保存後にテンポを合わせられます。`;
      }
      document.getElementById('songNameModal').hidden = false;
    };

    confirm.onclick = async () => {
      const file = state.tempSongFile;
      if (!file) return;
      const name = document.getElementById('songNameInput').value.trim() || file.name;
      const btn = document.getElementById('confirmSongBtn');
      btn.disabled = true;
      btn.textContent = '保存中…';
      let analysis = null;
      const mime = inferMime(file);
      try {
        if (mime.startsWith('audio/')) analysis = await analyzeTempo(file);
      } catch (e) {
        console.warn('tempo analysis skipped', e);
      }

      const song = {
        id: uid('song'), name,
        bpm: analysis?.bpm || 120,
        beatOffset: analysis?.beatOffset || 0,
        duration: null, mime, blob: file, createdAt: Date.now()
      };

      let persisted = true;
      try {
        await dbPut(STORE_SONGS, song);
      } catch (e) {
        console.error('media save failed', e);
        persisted = false;
      }

      state.songs.push(song);
      state.selectedSongId = song.id;
      document.getElementById('songNameModal').hidden = true;
      state.tempSongFile = null;
      input.value = '';
      btn.disabled = false;
      btn.textContent = '保存して解析';
      document.getElementById('songGoBtn').disabled = false;
      renderSongs();
      updateTempoStatus();

      if (persisted) toast(mime.startsWith('video/') ? '写真の動画を追加しました' : '音声を追加しました');
      else toast('動画は追加できましたが容量が大きく端末に保存できませんでした。この画面を閉じるまでは使えます');
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(install, 0), { once: true });
  else setTimeout(install, 0);
})();
