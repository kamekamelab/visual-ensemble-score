(()=>{
'use strict';
const A=()=>window.__scoreApp;
const $=id=>document.getElementById(id);
const LIB='https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js';
const COUNT_KEY='visual-score-sync-count-beats';
let peer=null,mode='',room='',hostConns=new Map(),guestConn=null,guestReady=false,guestPartId='none',clockOffset=0,pingSamples=[],clientSeq=0;
let teacherPrepared=false,clockTimer=0,hostSweepTimer=0,correctionTimer=0,correctionKickTimer=0,activeStartAt=0,activeStartPosition=0,incomingBundle=null,sendingBundle=false,visualRaf=0,visualStartAt=0,visualStartPosition=0,visualStartPerf=0,visualLastFrame=0,countCtx=null,countTimers=[],countNodes=new Set(),startTimers=[],performanceTapEnabled=false,guestClosedReason='',resumePending=false;

function msg(t){const a=A();if(a?.message)a.message(t);}
function randRoom(){return String(Math.floor(1000+Math.random()*9000));}
function peerId(code){return 'visual-score-room-'+code;}
function loadPeer(){return new Promise((resolve,reject)=>{
 if(window.Peer)return resolve(window.Peer);
 const old=document.querySelector('script[data-peerjs]');
 if(old){old.addEventListener('load',()=>resolve(window.Peer),{once:true});old.addEventListener('error',()=>reject(Error('通信機能を読み込めませんでした。')),{once:true});return;}
 const s=document.createElement('script');s.src=LIB;s.async=true;s.dataset.peerjs='1';s.onload=()=>window.Peer?resolve(window.Peer):reject(Error('通信機能を読み込めませんでした。'));s.onerror=()=>reject(Error('通信機能を読み込めませんでした。'));document.head.append(s);
 });}
function addStyles(){const s=document.createElement('style');s.textContent=`
.sync-open{background:#eef7ff!important;border-color:#75a8d8!important}.sync-modal{width:min(680px,calc(100% - 24px));}.sync-choice{display:grid;grid-template-columns:1fr 1fr;gap:10px}.sync-choice button{min-height:76px;font-size:1.0625rem}.sync-box{padding:14px;border:1px solid #dfd4b9;border-radius:12px;background:#fffaf0;margin-top:12px}.room-code{font-size:2.375rem;font-weight:900;letter-spacing:.18em;text-align:center;margin:8px 0}.sync-status{font-weight:750}.join-link{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end;margin:10px 0}.join-link label{min-width:0;margin:0}.join-link input{font-size:0.75rem;min-height:40px!important}.join-link button{min-height:40px!important}.device-list{display:grid;gap:7px;margin:10px 0}.device-row{display:grid;grid-template-columns:minmax(130px,1fr) minmax(190px,1.2fr);align-items:center;gap:10px;padding:9px 11px;background:#fff;border:1px solid #e4d9bc;border-radius:9px}.device-copy{display:grid;gap:2px}.device-row label{display:flex;align-items:center;gap:7px;margin:0}.device-row select{flex:1;min-width:0}.ready{color:#257334;font-weight:900}.not-ready{color:#9a6a15}.sync-count{display:flex;align-items:center;gap:8px;margin-top:12px;font-size:0.8125rem}.sync-count input{width:88px!important}.sync-practice{margin-top:12px;padding:10px 12px;border:1px solid #e4d9bc;border-radius:10px;background:#fff}.sync-practice summary{font-size:0.875rem;font-weight:800}.sync-practice .practice-volumes{margin-top:8px}.sync-practice .practice-volume{margin:0}.sync-practice .practice-volume input[type=range]{width:100%!important}.sync-mute[aria-pressed="true"]{background:#fbe2df!important;border-color:#a2272c!important;color:#81252a!important}.sync-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.sync-actions button{min-height:50px}.sync-start{background:#6bbf72!important;border-color:#4d9b54!important}.sync-end{background:#fff1f1!important;border-color:#c96d6d!important;color:#8b2f2f!important;font-weight:800}.sync-badge{position:fixed;right:10px;bottom:10px;z-index:250;background:#24343d;color:#fff;border-radius:999px;padding:7px 11px;font-size:0.75rem;box-shadow:0 3px 12px #0003}.sync-room-input{font-size:1.75rem!important;font-weight:900;text-align:center;letter-spacing:.18em}.sync-note{font-size:0.75rem;color:#736743;line-height:1.6}.sync-hidden{display:none!important}body.sync-guest.performing .workspace-heading .actions,body.sync-guest.performing .transport,body.sync-guest.performing #seek,body.sync-guest.performing .view-controls,body.sync-guest.performing #studentPickerToggle,body.sync-guest.performing #studentPicker,body.sync-guest #syncBadge{display:none!important}@media(max-width:650px){.sync-choice{grid-template-columns:1fr}.room-code{font-size:2rem}.sync-modal{padding:16px}.sync-actions button{flex:1 1 42%}.join-link,.device-row{grid-template-columns:1fr}}
`;document.head.append(s);}
function makeUI(){if($('syncModal'))return;
 const open=document.createElement('button');open.id='syncOpenBtn';open.className='sync-open';open.textContent='📡 みんなで演奏';
 const area=$('performanceArea');const heading=area?.querySelector('.workspace-heading .actions');if(heading)heading.prepend(open);else document.body.append(open);
 const d=document.createElement('dialog');d.id='syncModal';d.className='sync-modal';d.innerHTML=`
 <div class="dialog-head"><h2>📡 みんなで演奏</h2><button id="syncClose">閉じる</button></div>
 <p class="sync-note">先生がルームを作り、子機は参加用リンクまたは4けたの番号で参加します。参加後の表示パート・準備・再生はすべて先生が操作します。同期にはインターネットと外部のPeerJS通信サービスを使います。同じ番号を知る端末は自動参加し、ルームの解散で接続を終了します。絵譜・顔写真・設定は接続中の子機に送られ、音源は先生の端末だけで再生します。</p>
 <div id="syncHome" class="sync-choice"><button id="makeRoom" class="primary">先生<br><small>ルームを作る</small></button><button id="joinMode">子ども用端末<br><small>ルームに参加</small></button></div>
 <div id="hostPanel" class="sync-box sync-hidden"><div class="sync-status">ルーム番号</div><div id="hostCode" class="room-code">----</div><div class="join-link"><label>子機の参加用リンク<input id="joinLink" readonly></label><button id="copyJoinLink">リンクをコピー</button></div><div id="hostStatus">接続を待っています。</div><div id="deviceList" class="device-list"></div><label class="sync-count">スタート前のカウント（拍）<input id="countBeats" type="number" inputmode="numeric" min="0" max="32" step="1" value="8"><small>0でカウントなし</small></label><details class="sync-practice" open><summary>メトロノームとパート音</summary><label class="check"><input id="hostMetro" type="checkbox">メトロノームを鳴らす</label><label class="practice-volume"><span>メトロノーム音量</span><input id="hostMetroVolume" type="range" min="0" max="100" step="1" value="70" aria-label="先生の端末のメトロノーム音量"><output id="hostMetroVolumeValue" for="hostMetroVolume">70%</output></label><label class="check"><input id="hostPracticeSound" type="checkbox">パート音を鳴らす</label><button id="hostMuteAllParts" class="sync-mute" type="button" aria-pressed="false">パート音を一括消音</button><p class="sync-note">音は先生の端末から鳴ります。一括消音中もパートごとの音量は保持されます。</p><div id="hostPracticeVolumes" class="practice-volumes"></div></details><div class="sync-actions"><button id="sendBundle">絵譜をもう一度送る</button><button id="hostStart" class="sync-start">▶ 8拍カウント → スタート</button><button id="hostPause">Ⅱ 一時停止</button><button id="hostReset">↺ 最初へ</button><button id="hostEndRoom" class="sync-end">ルームを解散</button></div></div>
 <div id="guestPanel" class="sync-box sync-hidden"><label>ルーム番号<input id="roomInput" class="sync-room-input" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="0000"></label><div class="sync-actions"><button id="joinRoom" class="primary">参加する</button></div><p id="guestStatus" class="sync-status">ルーム番号を入れると、あとは先生の操作で進みます。</p></div>`;
 document.body.append(d);
 const badge=document.createElement('button');badge.id='syncBadge';badge.className='sync-badge';badge.hidden=true;badge.onclick=()=>d.showModal();document.body.append(badge);
 setCountBeats(loadCountBeats(),false);
 $('countBeats').oninput=()=>setCountBeats($('countBeats').value,false);
 $('countBeats').onchange=()=>setCountBeats($('countBeats').value,true);
 const showPerformance=()=>{d.close();A()?.enterPerformance?.();window.dispatchEvent(new Event('score-performance-start'));A()?.requestFullscreen?.();};
 d.addEventListener('click',e=>{const r=d.getBoundingClientRect(),outside=e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;if(outside&&performanceTapEnabled)showPerformance();});
 open.onclick=()=>{if(mode==='host')renderHostPractice();d.showModal();};$('syncClose').onclick=()=>d.close();$('makeRoom').onclick=()=>startHost();$('joinMode').onclick=()=>showGuest();$('joinRoom').onclick=()=>joinRoom();$('copyJoinLink').onclick=()=>copyJoinLink();$('sendBundle').onclick=()=>sendBundleToAll();$('hostStart').onclick=()=>hostCommand('start');$('hostPause').onclick=()=>hostCommand('pause');$('hostReset').onclick=()=>hostCommand('reset');$('hostEndRoom').onclick=()=>endHostRoom();
 $('hostPracticeSound').onchange=async()=>{const control=$('hostPracticeSound');control.disabled=true;try{await A()?.setPracticeSoundEnabled?.(control.checked);}catch(e){msg(e.message||'パート音を設定できませんでした。');}finally{control.disabled=false;renderHostPractice();}};
 $('hostMetro').onchange=async()=>{const control=$('hostMetro');control.disabled=true;try{await A()?.setMetronomeEnabled?.(control.checked);}catch(e){msg(e.message||'メトロノームを設定できませんでした。');}finally{control.disabled=false;renderHostPractice();}};
 $('hostMetroVolume').oninput=()=>{A()?.setMetronomeVolume?.($('hostMetroVolume').value);};
 $('hostMuteAllParts').onclick=()=>{const a=A();a?.setPartSoundsMuted?.(!a.getPartSoundsMuted?.());renderHostPractice();};
}
function normalizeCountBeats(value){const n=Math.round(Number(value));return Number.isFinite(n)?Math.max(0,Math.min(32,n)):8;}
function loadCountBeats(){try{return normalizeCountBeats(localStorage.getItem(COUNT_KEY)??8);}catch{return 8;}}
function setCountBeats(value,save){const count=normalizeCountBeats(value),action=resumePending?'再開':'スタート';$('countBeats').value=String(count);$('hostStart').textContent=count?`▶ ${count}拍カウント → ${action}`:`▶ カウントなしで${action}`;if(save)try{localStorage.setItem(COUNT_KEY,String(count));}catch{}return count;}
function selectedCountBeats(){return setCountBeats($('countBeats')?.value??8,true);}
function setPanels(which){$('syncHome').classList.toggle('sync-hidden',!!which);$('hostPanel').classList.toggle('sync-hidden',which!=='host');$('guestPanel').classList.toggle('sync-hidden',which!=='guest');if(which==='host')renderHostPractice();}
function joinUrl(){const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('room',room);return u.href;}
function updateJoinLink(){const input=$('joinLink');if(input)input.value=room?joinUrl():'';}
async function copyJoinLink(){
 const url=joinUrl();try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(url);else{const input=$('joinLink');input.focus();input.select();if(!document.execCommand('copy'))throw Error();}msg('参加用リンクをコピーしました。');}
 catch{const input=$('joinLink');input.focus();input.select();msg('リンクを選択しました。コピーして子機に送ってください。');}
}
function renderHostPractice(){
 const root=$('hostPracticeVolumes'),toggle=$('hostPracticeSound'),a=A();if(!root||!toggle||!a)return;
 $('hostMetro').checked=!!a.getMetronomeEnabled?.();const metroVolume=a.getMetronomeVolume?.()??70;$('hostMetroVolume').value=String(metroVolume);$('hostMetroVolumeValue').textContent=metroVolume+'%';
 const muted=!!a.getPartSoundsMuted?.(),muteButton=$('hostMuteAllParts');muteButton.setAttribute('aria-pressed',String(muted));muteButton.textContent=muted?'パート音を一括消音中・解除':'パート音を一括消音';
 toggle.checked=!!a.getPracticeSoundEnabled?.();root.replaceChildren();const parts=a.getProject?.()?.parts||[];
 if(!parts.length){const empty=document.createElement('p');empty.className='sync-note';empty.textContent='パートを追加すると音量バーが表示されます。';root.append(empty);return;}
 parts.forEach(part=>{
  const row=document.createElement('label');row.className='practice-volume';
  const name=document.createElement('span');name.textContent=`${part.icon} ${part.name}`;
  const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='100';slider.step='1';slider.value=String(Math.round((part.practiceVolume??.7)*100));slider.setAttribute('aria-label',part.name+'のパート音量');
  const value=document.createElement('output');value.textContent=slider.value+'%';let before=Number(part.practiceVolume??.7);
  const capture=()=>{before=Number(part.practiceVolume??.7);};slider.onpointerdown=capture;slider.onfocus=capture;
  slider.oninput=()=>{part.practiceVolume=Number(slider.value)/100;value.textContent=slider.value+'%';};
  slider.onchange=()=>{const after=Number(slider.value)/100;if(Math.abs(after-before)<1e-9)return;part.practiceVolume=before;a.remember?.();part.practiceVolume=after;a.edited?.();renderHostPractice();};
  row.append(name,slider,value);root.append(row);
 });
}
function setBadge(text){const b=$('syncBadge');if(!b)return;b.textContent=text;b.hidden=!text;}
function stopCorrection(){clearTimeout(correctionKickTimer);correctionKickTimer=0;clearInterval(correctionTimer);correctionTimer=0;activeStartAt=0;A()?.syncRestoreRate?.();}
function stopVisual(){cancelAnimationFrame(visualRaf);visualRaf=0;visualStartAt=0;visualStartPerf=0;visualLastFrame=0;}
function later(fn,delay){const id=setTimeout(()=>{startTimers=startTimers.filter(x=>x!==id);fn();},delay);startTimers.push(id);return id;}
function clearStartTimers(){for(const t of startTimers)clearTimeout(t);startTimers=[];}
function clearCountIn(){for(const t of countTimers)clearTimeout(t);countTimers=[];for(const n of countNodes){try{n.body.stop();n.click.stop();}catch{}try{n.body.disconnect();n.click.disconnect();n.g.disconnect();n.cg.disconnect();}catch{}}countNodes.clear();}
async function ensureCountAudio(){
 const C=window.AudioContext||window.webkitAudioContext;if(!C)throw Error('この端末ではカウント音を鳴らせません。');
 countCtx ||= new C();await countCtx.resume();return countCtx;
}
function scheduleTan(ctx,at){
 const body=ctx.createOscillator(),click=ctx.createOscillator(),g=ctx.createGain(),cg=ctx.createGain();
 const nodes={body,click,g,cg};countNodes.add(nodes);
 body.type='triangle';
 body.frequency.setValueAtTime(260,at);
 body.frequency.exponentialRampToValueAtTime(105,at+.13);
 click.type='square';
 click.frequency.setValueAtTime(720,at);
 click.frequency.exponentialRampToValueAtTime(260,at+.035);
 g.gain.setValueAtTime(.0001,at);
 g.gain.exponentialRampToValueAtTime(.78,at+.005);
 g.gain.exponentialRampToValueAtTime(.0001,at+.17);
 cg.gain.setValueAtTime(.0001,at);
 cg.gain.exponentialRampToValueAtTime(.22,at+.003);
 cg.gain.exponentialRampToValueAtTime(.0001,at+.045);
 body.connect(g);click.connect(cg);g.connect(ctx.destination);cg.connect(ctx.destination);
 body.start(at);click.start(at);body.stop(at+.18);click.stop(at+.05);
 body.onended=()=>{countNodes.delete(nodes);try{body.disconnect();click.disconnect();g.disconnect();cg.disconnect();}catch{}};
}
async function playCountIn(firstTapDelayMs,beatMs,count=8){
 clearCountIn();if(!count)return;const ctx=await ensureCountAudio(),firstAt=ctx.currentTime+firstTapDelayMs/1000;
 for(let i=0;i<count;i++)scheduleTan(ctx,firstAt+i*beatMs/1000);
 for(let i=0;i<count;i++)countTimers.push(setTimeout(()=>{$('hostStatus').textContent=`カウント ${i+1} / ${count}　タン`;},firstTapDelayMs+i*beatMs));
}
function destroyPeer(){clearInterval(clockTimer);clockTimer=0;clearInterval(hostSweepTimer);hostSweepTimer=0;clearStartTimers();stopCorrection();stopVisual();clearCountIn();if(teacherPrepared)A()?.syncPause?.();try{peer?.destroy();}catch{}peer=null;hostConns.clear();guestConn=null;guestReady=false;guestPartId='none';teacherPrepared=false;performanceTapEnabled=false;resumePending=false;clockOffset=0;pingSamples=[];incomingBundle=null;sendingBundle=false;document.body.classList.remove('sync-guest');}
function endHostRoom(){
 if(mode!=='host')return;
 if(!confirm('このルームを解散しますか？\n参加中の端末との接続が切れます。'))return;
 for(const {conn} of hostConns.values()){
   try{if(conn.open)conn.send({type:'room-closed'});}catch{}
 }
 setTimeout(()=>{
   destroyPeer();
   mode='';room='';
   setBadge('');
   setPanels('');
   $('hostCode').textContent='----';
   $('hostStatus').textContent='ルームを解散しました。';
   msg('ルームを解散しました。');
 },120);
}
function peerErrorText(err){const t=err?.type||'';if(t==='peer-unavailable')return 'そのルームが見つかりません。番号を確認してください。';if(t==='network'||t==='server-error'||t==='socket-error')return '通信サーバーにつながりません。学校のWi-Fi設定を確認してください。';return '接続できませんでした。もう一度お試しください。';}
async function startHost(retry=0){
 try{await loadPeer();destroyPeer();mode='host';room=randRoom();setPanels('host');$('hostCode').textContent=room;updateJoinLink();$('hostStatus').textContent='ルームを作っています…';renderDevices();peer=new Peer(peerId(room));
 peer.on('open',()=>{$('hostStatus').textContent='ほかの端末の参加を待っています。';setBadge('📡 先生 '+room);hostSweepTimer=setInterval(sweepGuests,5000);});
 peer.on('connection',conn=>acceptGuest(conn));
 peer.on('error',err=>{if(err.type==='unavailable-id'&&retry<4){startHost(retry+1);return;}$('hostStatus').textContent=peerErrorText(err);});
 }catch(e){$('hostStatus').textContent=e.message;}
}
function sweepGuests(){
 let changed=false;
 for(const [id,info] of hostConns){
  if(Date.now()-info.lastSeen<25000)continue;
  hostConns.delete(id);changed=true;try{info.conn.close();}catch{}
 }
 if(changed)renderDevices();
}
function acceptGuest(conn){
 const info={conn,ready:false,bundle:false,approved:true,partId:'none',label:'端末 '+(++clientSeq),lastSeen:Date.now()};hostConns.set(conn.peer,info);
 conn.on('open',()=>{try{conn.send({type:'approved',room,teacherNow:Date.now()});}catch{};renderDevices();});
 conn.on('data',data=>{
  if(!data||typeof data!=='object')return;
  info.lastSeen=Date.now();
  if(data.type==='ready'){info.ready=!!data.ready;renderDevices();}
  if(data.type==='bundle-received'){info.bundle=true;info.ready=true;sendViewPart(info);renderDevices();}
  if(data.type==='request-bundle')sendBundleTo(info).catch(e=>{try{conn.send({type:'bundle-error',message:e.message});}catch{};});
  if(data.type==='ping'){const t1=Date.now();conn.send({type:'pong',t0:data.t0,t1,t2:Date.now()});}
 });
 conn.on('close',()=>{hostConns.delete(conn.peer);renderDevices();});
 conn.on('error',()=>{hostConns.delete(conn.peer);renderDevices();});
 renderDevices();
}
function sendViewPart(info){if(info?.conn?.open)try{info.conn.send({type:'view-part',partId:info.partId||'none'});}catch{}}
function renderDevices(){
 const root=$('deviceList');if(!root)return;root.replaceChildren();
 const items=[...hostConns.values()];
 if(!items.length){const p=document.createElement('div');p.className='sync-note';p.textContent='まだ参加している端末はありません。';root.append(p);if(peer?.open)$('hostStatus').textContent='ほかの端末の参加を待っています。';return;}
 items.forEach((x,i)=>{
  const r=document.createElement('div');r.className='device-row';
  const copy=document.createElement('div');copy.className='device-copy';
  const b=document.createElement('b');b.textContent='端末 '+(i+1);
  const st=document.createElement('span');st.className=x.ready?'ready':'not-ready';st.textContent=x.ready?'✓ 表示準備完了':(x.bundle?'絵譜を開いています':'絵譜を送信中');copy.append(b,st);
  const label=document.createElement('label');label.textContent='表示';const select=document.createElement('select');select.setAttribute('aria-label',`端末 ${i+1} に表示するパート`);
  const parts=A()?.getProject?.()?.parts||[];select.append(new Option('表示しない','none'),new Option('みんな（すべて）','all'),...parts.map(p=>new Option(`${p.icon} ${p.studentName||p.name}`,p.id)));
  if(x.partId!=='none'&&x.partId!=='all'&&!parts.some(p=>p.id===x.partId))x.partId='none';select.value=x.partId;select.onchange=()=>{x.partId=select.value;sendViewPart(x);};label.append(select);r.append(copy,label);
  root.append(r);
 });
 $('hostStatus').textContent=items.length+'台 接続／'+items.filter(x=>x.ready).length+'台 表示準備完了';
}
function showGuest(){destroyPeer();mode='guest';setPanels('guest');$('guestStatus').textContent='ルーム番号を入れると、あとは先生の操作で進みます。';setBadge('');}
async function joinRoom(){
 const code=String($('roomInput').value||'').replace(/\D/g,'').slice(0,4);$('roomInput').value=code;if(code.length!==4)return msg('4けたのルーム番号を入れてください。');
 A()?.requestFullscreen?.();
 try{await loadPeer();destroyPeer();mode='guest';room=code;document.body.classList.add('sync-guest');A()?.syncShowPart?.('none');$('guestStatus').textContent='接続しています…';peer=new Peer();
 peer.on('open',()=>{const conn=peer.connect(peerId(code),{serialization:'binary',reliable:true});guestConn=conn;guestClosedReason='';conn.on('open',()=>{$('guestStatus').textContent='接続しました。絵譜を受信しています…';});conn.on('data',guestData);conn.on('close',()=>guestDisconnected());conn.on('error',()=>guestDisconnected());});
 peer.on('error',err=>{$('guestStatus').textContent=peerErrorText(err);});
 }catch(e){$('guestStatus').textContent=e.message;}
}
function guestDisconnected(){clearInterval(clockTimer);clockTimer=0;clearStartTimers();stopCorrection();stopVisual();clearCountIn();$('guestStatus').textContent=guestClosedReason||'接続が切れました。ページを再読み込みしてください。';guestClosedReason='';setBadge('');guestReady=false;}
function sendPing(){if(guestConn?.open)guestConn.send({type:'ping',t0:Date.now()});}
function startClockSync(){
 pingSamples=[];clearInterval(clockTimer);clockTimer=0;
 let n=0;const burst=()=>{if(!guestConn?.open||n>=8)return;sendPing();n++;setTimeout(burst,140);};burst();
 clockTimer=setInterval(sendPing,10000);
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
async function sendBundleTo(info){
 if(!info?.conn?.open)return;
 if(!info.approved)throw Error('接続していない端末には絵譜を送れません。');
 const a=A();if(!a?.syncExportVisualBundle)throw Error('絵譜送信機能を準備できませんでした。');
 const blob=await a.syncExportVisualBundle(),buffer=await blob.arrayBuffer(),chunkSize=32*1024,total=Math.ceil(buffer.byteLength/chunkSize),id='b'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
 info.bundle=false;info.ready=false;renderDevices();
 info.conn.send({type:'bundle-meta',id,size:buffer.byteLength,total,title:a.getProject?.().title||'教材'});
 for(let i=0;i<total;i++){
   if(!info.conn.open)throw Error('教材送信中に接続が切れました。');
   while((info.conn.dataChannel?.bufferedAmount||0)>512*1024)await sleep(25);
   info.conn.send({type:'bundle-chunk',id,index:i,data:buffer.slice(i*chunkSize,Math.min(buffer.byteLength,(i+1)*chunkSize))});
   if(i%8===0){$('hostStatus').textContent=`絵譜を送信中… ${Math.round((i+1)/total*100)}%`;await sleep(4);}
 }
 info.conn.send({type:'bundle-end',id});
}
async function sendBundleToAll(){
 if(sendingBundle)return;const items=[...hostConns.values()].filter(x=>x.approved);if(!items.length)return msg('接続中の端末がありません。');
 sendingBundle=true;$('sendBundle').disabled=true;
 try{for(const info of items)await sendBundleTo(info);$('hostStatus').textContent='絵譜を送信しました。';}
 catch(e){msg(e.message);}
 finally{sendingBundle=false;$('sendBundle').disabled=false;renderDevices();}
}
async function finishIncomingBundle(){
 const b=incomingBundle;if(!b||b.received!==b.total)return;
 $('guestStatus').textContent='絵譜を開いています…';
 try{
  const blob=new Blob(b.chunks,{type:'application/json'}),result=await A()?.syncImportVisualBundle?.(blob);
  incomingBundle=null;guestReady=true;A()?.syncShowPart?.(guestPartId);$('guestStatus').textContent=`✓ 「${result?.title||'教材'}」の表示準備ができました。`;
  guestConn?.send({type:'bundle-received',title:result?.title||'',size:blob.size});guestConn?.send({type:'ready',ready:true});
  $('syncModal').close();A()?.enterPerformance?.();window.dispatchEvent(new Event('score-performance-start'));
 }catch(e){incomingBundle=null;$('guestStatus').textContent='絵譜を開けませんでした。先生側からもう一度送ってください。';msg(e.message);}
}
function guestData(data){if(!data||typeof data!=='object')return;
 if(data.type==='approved'){
   $('guestStatus').textContent='先生の絵譜を受信しています…';
   startClockSync();
   guestConn?.send({type:'request-bundle'});
   return;
 }
 if(data.type==='room-closed'){
   guestClosedReason='先生がルームを解散しました。';
   clearInterval(clockTimer);clockTimer=0;clearStartTimers();stopCorrection();stopVisual();clearCountIn();
   try{guestConn?.close();}catch{}
   guestConn=null;guestReady=false;room='';setBadge('');
   $('guestStatus').textContent='先生がルームを解散しました。';
   msg('先生がルームを解散しました。');
   return;
 }
 if(data.type==='bundle-meta'){incomingBundle={id:data.id,size:Number(data.size)||0,total:Number(data.total)||0,received:0,chunks:new Array(Number(data.total)||0)};$('guestStatus').textContent=`絵譜を受信中… 0%`;return;}
 if(data.type==='bundle-chunk'&&incomingBundle&&data.id===incomingBundle.id){if(!incomingBundle.chunks[data.index]){incomingBundle.chunks[data.index]=data.data;incomingBundle.received++;}$('guestStatus').textContent=`絵譜を受信中… ${Math.round(incomingBundle.received/incomingBundle.total*100)}%`;return;}
 if(data.type==='bundle-end'&&incomingBundle&&data.id===incomingBundle.id){finishIncomingBundle();return;}
 if(data.type==='bundle-error'){$('guestStatus').textContent=data.message||'先生の教材を送れませんでした。';return;}
 if(data.type==='view-part'){guestPartId=String(data.partId||'none');if(guestReady)A()?.syncShowPart?.(guestPartId);return;}
 if(data.type==='pong'){const t3=Date.now(),rtt=t3-data.t0,offset=((data.t1-data.t0)+(data.t2-t3))/2;pingSamples.push({rtt,offset});if(pingSamples.length>18)pingSamples.shift();const best=[...pingSamples].sort((a,b)=>a.rtt-b.rtt).slice(0,5);clockOffset=best.reduce((sum,x)=>sum+x.offset,0)/best.length;}
 if(data.type==='start'){clearStartTimers();A()?.enterPerformance?.();window.dispatchEvent(new Event('score-performance-start'));scheduleRemoteStart(data.at,data.position||0);}
 if(data.type==='pause'){clearStartTimers();stopCorrection();stopVisual();if(A()?.syncIsVisualOnly?.())A()?.syncSetVisualTime?.(Number(data.position)||A()?.getSyncTime?.()||0);else A()?.syncPause?.();}
 if(data.type==='reset'){clearStartTimers();stopCorrection();stopVisual();if(A()?.syncIsVisualOnly?.())A()?.syncSetVisualTime?.(0);else A()?.syncSeek?.(0);}
}
async function unlockMedia(){const a=A();if(!a?.hasMedia?.())throw Error('教材の受信がまだ終わっていません。');await a.syncUnlock();}
async function prepareHost(){try{await ensureCountAudio();await unlockMedia();teacherPrepared=true;A()?.enterPerformance?.();window.dispatchEvent(new Event('score-performance-ready'));}catch(e){msg(e.message);}}
function expectedPosition(){
 const a=A(),rate=a?.getSyncRate?.()||1,teacherNow=Date.now()+(mode==='guest'?clockOffset:0);
 return activeStartPosition+Math.max(0,teacherNow-activeStartAt)/1000*rate;
}
function startCorrection(teacherAt,position){
 stopCorrection();activeStartAt=Number(teacherAt)||0;activeStartPosition=Number(position)||0;
 const run=()=>{if(!activeStartAt)return;const expected=expectedPosition();A()?.syncCorrect?.(expected);};
 correctionKickTimer=setTimeout(run,350);correctionTimer=setInterval(run,1200);
}
function startVisualClock(teacherAt,position){
 stopVisual();visualStartAt=Number(teacherAt)||0;visualStartPosition=Number(position)||0;
 const teacherNow=Date.now()+clockOffset;
 visualStartPerf=performance.now()-Math.max(0,teacherNow-visualStartAt);
 const step=ts=>{
   if(!visualStartAt)return;
   if(ts-visualLastFrame>=15){
     visualLastFrame=ts;
     const rate=A()?.getSyncRate?.()||1;
     const pos=visualStartPosition+Math.max(0,ts-visualStartPerf)/1000*rate;
     A()?.syncSetVisualTime?.(pos);
   }
   visualRaf=requestAnimationFrame(step);
 };
 visualRaf=requestAnimationFrame(step);
}
function scheduleRemoteStart(teacherAt,position){
 const localAt=teacherAt-clockOffset,delay=Math.max(0,localAt-Date.now());
 if(A()?.syncIsVisualOnly?.()){
   A()?.syncSetVisualTime?.(position);
   later(()=>startVisualClock(teacherAt,position),delay);
   return;
 }
 A()?.syncScheduleStart?.(delay,position);
 later(()=>startCorrection(teacherAt,position),delay+120);
}
async function hostCommand(type){
 if(type==='start'){
  const approved=[...hostConns.values()].filter(x=>x.approved),notReady=approved.filter(x=>!x.ready).length;if(notReady&&!confirm(`準備OKでない端末が${notReady}台あります。スタートしますか？`))return;
  $('syncModal').close();A()?.enterPerformance?.();A()?.requestFullscreen?.();
  if(!teacherPrepared){await prepareHost();if(!teacherPrepared)return;}
  window.dispatchEvent(new Event('score-performance-start'));
  clearStartTimers();clearCountIn();stopCorrection();stopVisual();
  await ensureCountAudio();
  const beatSec=Math.max(.12,Math.min(4.2,Number(A()?.syncBeatSeconds?.())||.5)),beatMs=beatSec*1000,count=selectedCountBeats(),lead=500;
  const songDelay=lead+beatMs*count,at=Date.now()+songDelay,position=resumePending?(Number(A()?.getSyncTime?.())||0):0;
  resumePending=false;setCountBeats(count,false);
  for(const {conn,approved} of hostConns.values())if(approved&&conn.open)conn.send({type:'start',at,position});
  A()?.syncScheduleStart?.(songDelay,position);
  await playCountIn(lead,beatMs,count);
  performanceTapEnabled=true;
  $('hostStatus').textContent=(count?`${count}拍カウント後にスタートします（${Math.round(60/beatSec)} BPM相当）`:'カウントなしでスタートします。')+' 枠の外側をタッチすると演奏画面へ戻れます。';
  countTimers.push(setTimeout(()=>{$('hostStatus').textContent='▶ 演奏スタート';},songDelay));
  return;
 }
 if(type==='pause'){clearStartTimers();clearCountIn();const position=A()?.getSyncTime?.()||0;resumePending=true;setCountBeats($('countBeats').value,false);for(const {conn,approved} of hostConns.values())if(approved&&conn.open)conn.send({type:'pause',position});stopCorrection();if(teacherPrepared)A()?.syncPause?.();$('hostStatus').textContent='一時停止しました。';return;}
 if(type==='reset'){clearStartTimers();clearCountIn();resumePending=false;setCountBeats($('countBeats').value,false);for(const {conn,approved} of hostConns.values())if(approved&&conn.open)conn.send({type:'reset',position:0});stopCorrection();if(teacherPrepared)A()?.syncSeek?.(0);$('hostStatus').textContent='最初に戻しました。';return;}
}
function init(){if(!A())return setTimeout(init,40);addStyles();makeUI();window.addEventListener('score-project-loaded',renderHostPractice);window.addEventListener('score-audio-settings-changed',renderHostPractice);window.addEventListener('pagehide',()=>{try{guestConn?.close();peer?.destroy();}catch{}});const code=new URL(location.href).searchParams.get('room')||'';if(/^\d{4}$/.test(code)){showGuest();$('roomInput').value=code;$('syncModal').showModal();joinRoom();}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
