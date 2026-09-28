(()=>{
'use strict';
const A=()=>window.__scoreApp;
const $=id=>document.getElementById(id);
const LIB='https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js';
let peer=null,mode='',room='',hostConns=new Map(),guestConn=null,guestReady=false,clockOffset=0,pingSamples=[],clientSeq=0;
let teacherPrepared=false,clockTimer=0,correctionTimer=0,activeStartAt=0,activeStartPosition=0,incomingBundle=null,sendingBundle=false,visualRaf=0,visualStartAt=0,visualStartPosition=0,visualLastFrame=0,countCtx=null,countTimers=[],guestClosedReason='';

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
.sync-open{background:#eef7ff!important;border-color:#75a8d8!important}.sync-modal{width:min(650px,calc(100% - 24px));}.sync-choice{display:grid;grid-template-columns:1fr 1fr;gap:10px}.sync-choice button{min-height:76px;font-size:17px}.sync-box{padding:14px;border:1px solid #dfd4b9;border-radius:12px;background:#fffaf0;margin-top:12px}.room-code{font-size:38px;font-weight:900;letter-spacing:.18em;text-align:center;margin:8px 0}.sync-status{font-weight:750}.device-list{display:grid;gap:7px;margin:10px 0}.device-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 11px;background:#fff;border:1px solid #e4d9bc;border-radius:9px}.device-approval{align-items:flex-start;background:#fff8e8;border-color:#d9ae53}.approval-copy{display:grid;gap:3px}.approval-actions{display:flex;gap:6px;flex-wrap:wrap}.approval-actions button{min-height:38px!important;padding:6px 10px!important}.approve-yes{background:#e8f6eb!important;border-color:#62a36c!important;font-weight:800}.approve-no{background:#fff1f1!important;border-color:#c96d6d!important;color:#8b2f2f!important}.ready{color:#257334;font-weight:900}.not-ready{color:#9a6a15}.sync-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.sync-actions button{min-height:50px}.sync-start{background:#6bbf72!important;border-color:#4d9b54!important}.sync-end{background:#fff1f1!important;border-color:#c96d6d!important;color:#8b2f2f!important;font-weight:800}.sync-badge{position:fixed;right:10px;bottom:10px;z-index:250;background:#24343d;color:#fff;border-radius:999px;padding:7px 11px;font-size:12px;box-shadow:0 3px 12px #0003}.sync-room-input{font-size:28px!important;font-weight:900;text-align:center;letter-spacing:.18em}.sync-note{font-size:12px;color:#736743;line-height:1.6}.sync-hidden{display:none!important}@media(max-width:650px){.sync-choice{grid-template-columns:1fr}.room-code{font-size:32px}.sync-modal{padding:16px}.sync-actions button{flex:1 1 42%}}
`;document.head.append(s);}
function makeUI(){if($('syncModal'))return;
 const open=document.createElement('button');open.id='syncOpenBtn';open.className='sync-open';open.textContent='📡 みんなで演奏';
 const area=$('performanceArea');const heading=area?.querySelector('.workspace-heading .actions');if(heading)heading.prepend(open);else document.body.append(open);
 const d=document.createElement('dialog');d.id='syncModal';d.className='sync-modal';d.innerHTML=`
 <div class="dialog-head"><h2>📡 みんなで演奏</h2><button id="syncClose">閉じる</button></div>
 <p class="sync-note">先生の端末でルームを作り、ほかの端末は4けたの番号で参加します。子機には絵譜・顔写真・設定だけを送り、音源は先生の端末だけで再生します。iPadは軽量な絵譜表示専用です。</p>
 <div id="syncHome" class="sync-choice"><button id="makeRoom" class="primary">先生<br><small>ルームを作る</small></button><button id="joinMode">子ども用端末<br><small>ルームに参加</small></button></div>
 <div id="hostPanel" class="sync-box sync-hidden"><div class="sync-status">ルーム番号</div><div id="hostCode" class="room-code">----</div><div id="hostStatus">接続を待っています。</div><div id="deviceList" class="device-list"></div><div class="sync-actions"><button id="sendBundle">絵譜をもう一度送る</button><button id="hostPrepare">この端末も準備OK</button><button id="hostStart" class="sync-start">▶ 8拍カウント → スタート</button><button id="hostPause">Ⅱ 一時停止</button><button id="hostReset">↺ 最初へ</button><button id="hostEndRoom" class="sync-end">ルームを解散</button></div></div>
 <div id="guestPanel" class="sync-box sync-hidden"><label>ルーム番号<input id="roomInput" class="sync-room-input" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="0000"></label><div class="sync-actions"><button id="joinRoom" class="primary">参加する</button><button id="guestPrepare" disabled>この端末を準備OK</button></div><p id="guestStatus" class="sync-status">ルーム番号を入れてください。</p></div>`;
 document.body.append(d);
 const badge=document.createElement('button');badge.id='syncBadge';badge.className='sync-badge';badge.hidden=true;badge.onclick=()=>d.showModal();document.body.append(badge);
 open.onclick=()=>d.showModal();$('syncClose').onclick=()=>d.close();$('makeRoom').onclick=()=>startHost();$('joinMode').onclick=()=>showGuest();$('joinRoom').onclick=()=>joinRoom();$('guestPrepare').onclick=()=>prepareGuest();$('sendBundle').onclick=()=>sendBundleToAll();$('hostPrepare').onclick=()=>prepareHost();$('hostStart').onclick=()=>hostCommand('start');$('hostPause').onclick=()=>hostCommand('pause');$('hostReset').onclick=()=>hostCommand('reset');$('hostEndRoom').onclick=()=>endHostRoom();
}
function setPanels(which){$('syncHome').classList.toggle('sync-hidden',!!which);$('hostPanel').classList.toggle('sync-hidden',which!=='host');$('guestPanel').classList.toggle('sync-hidden',which!=='guest');}
function setBadge(text){const b=$('syncBadge');if(!b)return;b.textContent=text;b.hidden=!text;}
function stopCorrection(){clearInterval(correctionTimer);correctionTimer=0;activeStartAt=0;A()?.syncRestoreRate?.();}
function stopVisual(){cancelAnimationFrame(visualRaf);visualRaf=0;visualStartAt=0;visualLastFrame=0;}
function clearCountIn(){for(const t of countTimers)clearTimeout(t);countTimers=[];}
async function ensureCountAudio(){
 const C=window.AudioContext||window.webkitAudioContext;if(!C)throw Error('この端末ではカウント音を鳴らせません。');
 countCtx ||= new C();await countCtx.resume();return countCtx;
}
function scheduleTan(ctx,at){
 const body=ctx.createOscillator(),click=ctx.createOscillator(),g=ctx.createGain(),cg=ctx.createGain();
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
 body.onended=()=>{try{body.disconnect();click.disconnect();g.disconnect();cg.disconnect();}catch{}};
}
async function playCountIn(firstTapDelayMs,beatMs,count=8){
 clearCountIn();const ctx=await ensureCountAudio(),firstAt=ctx.currentTime+firstTapDelayMs/1000;
 for(let i=0;i<count;i++)scheduleTan(ctx,firstAt+i*beatMs/1000);
 for(let i=0;i<count;i++)countTimers.push(setTimeout(()=>{$('hostStatus').textContent=`カウント ${i+1} / ${count}　タン`;},firstTapDelayMs+i*beatMs));
}
function destroyPeer(){clearInterval(clockTimer);clockTimer=0;stopCorrection();stopVisual();clearCountIn();try{peer?.destroy();}catch{}peer=null;hostConns.clear();guestConn=null;guestReady=false;teacherPrepared=false;clockOffset=0;pingSamples=[];incomingBundle=null;sendingBundle=false;}
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
   $('hostPrepare').textContent='この端末も準備OK';
   msg('ルームを解散しました。');
 },120);
}
function peerErrorText(err){const t=err?.type||'';if(t==='peer-unavailable')return 'そのルームが見つかりません。番号を確認してください。';if(t==='network'||t==='server-error'||t==='socket-error')return '通信サーバーにつながりません。学校のWi-Fi設定を確認してください。';return '接続できませんでした。もう一度お試しください。';}
async function startHost(retry=0){
 try{await loadPeer();destroyPeer();mode='host';room=randRoom();setPanels('host');$('hostCode').textContent=room;$('hostStatus').textContent='ルームを作っています…';renderDevices();peer=new Peer(peerId(room));
 peer.on('open',()=>{$('hostStatus').textContent='ほかの端末の参加を待っています。';setBadge('📡 先生 '+room);});
 peer.on('connection',conn=>acceptGuest(conn));
 peer.on('error',err=>{if(err.type==='unavailable-id'&&retry<4){startHost(retry+1);return;}$('hostStatus').textContent=peerErrorText(err);});
 }catch(e){$('hostStatus').textContent=e.message;}
}
function approveGuest(info){
 if(!info?.conn?.open||info.approved)return;
 info.approved=true;info.ready=false;info.bundle=false;
 try{info.conn.send({type:'approved',room,teacherNow:Date.now()});}catch{}
 renderDevices();
}
function denyGuest(info){
 if(!info)return;
 try{if(info.conn?.open)info.conn.send({type:'denied'});}catch{}
 setTimeout(()=>{try{info.conn?.close();}catch{}hostConns.delete(info.conn?.peer);renderDevices();},120);
}
function acceptGuest(conn){
 const info={conn,ready:false,bundle:false,approved:false,label:'端末 '+(++clientSeq)};hostConns.set(conn.peer,info);
 conn.on('open',()=>{try{conn.send({type:'approval-pending'});}catch{};renderDevices();});
 conn.on('data',data=>{
  if(!data||typeof data!=='object'||!info.approved)return;
  if(data.type==='ready'){info.ready=!!data.ready;renderDevices();}
  if(data.type==='bundle-received'){info.bundle=true;renderDevices();}
  if(data.type==='request-bundle')sendBundleTo(info).catch(e=>{try{conn.send({type:'bundle-error',message:e.message});}catch{};});
  if(data.type==='ping'){const t1=Date.now();conn.send({type:'pong',t0:data.t0,t1,t2:Date.now()});}
 });
 conn.on('close',()=>{hostConns.delete(conn.peer);renderDevices();});
 conn.on('error',()=>{hostConns.delete(conn.peer);renderDevices();});
 renderDevices();
}
function renderDevices(){
 const root=$('deviceList');if(!root)return;root.replaceChildren();
 const items=[...hostConns.values()];
 if(!items.length){const p=document.createElement('div');p.className='sync-note';p.textContent='まだ参加している端末はありません。';root.append(p);return;}
 items.forEach((x,i)=>{
  const r=document.createElement('div');
  if(!x.approved){
   r.className='device-row device-approval';
   const copy=document.createElement('div');copy.className='approval-copy';
   const q=document.createElement('b');q.textContent='この端末を許可しますか？';
   const sub=document.createElement('span');sub.className='sync-note';sub.textContent='端末 '+(i+1)+' が参加を希望しています。';
   copy.append(q,sub);
   const actions=document.createElement('div');actions.className='approval-actions';
   const yes=document.createElement('button');yes.type='button';yes.className='approve-yes';yes.textContent='許可する';yes.onclick=()=>approveGuest(x);
   const no=document.createElement('button');no.type='button';no.className='approve-no';no.textContent='許可しない';no.onclick=()=>denyGuest(x);
   actions.append(yes,no);r.append(copy,actions);
  }else{
   r.className='device-row';
   const b=document.createElement('b');b.textContent='端末 '+(i+1);
   const st=document.createElement('span');st.className=x.ready?'ready':'not-ready';
   st.textContent=(x.bundle?'絵譜✓':'絵譜待ち')+'・'+(x.ready?'✓ 準備OK':'準備待ち');
   r.append(b,st);
  }
  root.append(r);
 });
 const approved=items.filter(x=>x.approved),pending=items.length-approved.length;
 $('hostStatus').textContent=approved.length+'台 許可済み／'+approved.filter(x=>x.bundle).length+'台 絵譜受信／'+approved.filter(x=>x.ready).length+'台 準備OK'+(pending?'／'+pending+'台 承認待ち':'');
}
function showGuest(){destroyPeer();mode='guest';setPanels('guest');$('guestStatus').textContent='ルーム番号を入れてください。';$('guestPrepare').disabled=true;setBadge('');}
async function joinRoom(){
 const code=String($('roomInput').value||'').replace(/\D/g,'').slice(0,4);$('roomInput').value=code;if(code.length!==4)return msg('4けたのルーム番号を入れてください。');
 try{await loadPeer();destroyPeer();mode='guest';room=code;$('guestStatus').textContent='接続しています…';peer=new Peer();
 peer.on('open',()=>{const conn=peer.connect(peerId(code),{serialization:'binary',reliable:true});guestConn=conn;guestClosedReason='';conn.on('open',()=>{setBadge('📡 承認待ち '+code);$('guestStatus').textContent='先生の許可を待っています…';$('guestPrepare').disabled=true;});conn.on('data',guestData);conn.on('close',()=>guestDisconnected());conn.on('error',()=>guestDisconnected());});
 peer.on('error',err=>{$('guestStatus').textContent=peerErrorText(err);});
 }catch(e){$('guestStatus').textContent=e.message;}
}
function guestDisconnected(){clearInterval(clockTimer);clockTimer=0;stopCorrection();$('guestStatus').textContent=guestClosedReason||'接続が切れました。もう一度参加してください。';guestClosedReason='';$('guestPrepare').disabled=true;setBadge('');guestReady=false;}
function sendPing(){if(guestConn?.open)guestConn.send({type:'ping',t0:Date.now()});}
function startClockSync(){
 pingSamples=[];clearInterval(clockTimer);clockTimer=0;
 let n=0;const burst=()=>{if(!guestConn?.open||n>=8)return;sendPing();n++;setTimeout(burst,140);};burst();
 clockTimer=setInterval(sendPing,10000);
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
async function sendBundleTo(info){
 if(!info?.conn?.open)return;
 if(!info.approved)throw Error('許可されていない端末には絵譜を送れません。');
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
 if(sendingBundle)return;const items=[...hostConns.values()].filter(x=>x.approved);if(!items.length)return msg('許可済みの端末がありません。');
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
  incomingBundle=null;guestReady=false;$('guestPrepare').disabled=false;$('guestPrepare').textContent='この端末を準備OK';
  $('guestStatus').textContent=`✓ 「${result?.title||'教材'}」の絵譜を受信しました。顔写真を選んでから「準備OK」を押してください。音は先生の端末から流れます。`;
  guestConn?.send({type:'bundle-received',title:result?.title||'',size:blob.size});
 }catch(e){incomingBundle=null;$('guestStatus').textContent='絵譜を開けませんでした。先生側からもう一度送ってください。';msg(e.message);}
}
function guestData(data){if(!data||typeof data!=='object')return;
 if(data.type==='approval-pending'){
   $('guestStatus').textContent='先生の許可を待っています…';
   return;
 }
 if(data.type==='approved'){
   setBadge('📡 参加中 '+room);
   $('guestStatus').textContent='許可されました。先生の絵譜を受信しています…';
   startClockSync();
   guestConn?.send({type:'request-bundle'});
   return;
 }
 if(data.type==='denied'){
   guestClosedReason='先生がこの端末の参加を許可しませんでした。';
   $('guestStatus').textContent=guestClosedReason;setBadge('');
   try{guestConn?.close();}catch{}
   return;
 }
 if(data.type==='room-closed'){
   guestClosedReason='先生がルームを解散しました。';
   clearInterval(clockTimer);clockTimer=0;stopCorrection();stopVisual();clearCountIn();
   try{guestConn?.close();}catch{}
   guestConn=null;guestReady=false;room='';setBadge('');
   $('guestPrepare').disabled=true;$('guestPrepare').textContent='この端末を準備OK';
   $('guestStatus').textContent='先生がルームを解散しました。';
   msg('先生がルームを解散しました。');
   return;
 }
 if(data.type==='bundle-meta'){incomingBundle={id:data.id,size:Number(data.size)||0,total:Number(data.total)||0,received:0,chunks:new Array(Number(data.total)||0)};$('guestPrepare').disabled=true;$('guestStatus').textContent=`絵譜を受信中… 0%`;return;}
 if(data.type==='bundle-chunk'&&incomingBundle&&data.id===incomingBundle.id){if(!incomingBundle.chunks[data.index]){incomingBundle.chunks[data.index]=data.data;incomingBundle.received++;}$('guestStatus').textContent=`絵譜を受信中… ${Math.round(incomingBundle.received/incomingBundle.total*100)}%`;return;}
 if(data.type==='bundle-end'&&incomingBundle&&data.id===incomingBundle.id){finishIncomingBundle();return;}
 if(data.type==='bundle-error'){$('guestStatus').textContent=data.message||'先生の教材を送れませんでした。';return;}
 if(data.type==='pong'){const t3=Date.now(),rtt=t3-data.t0,offset=((data.t1-data.t0)+(data.t2-t3))/2;pingSamples.push({rtt,offset});if(pingSamples.length>18)pingSamples.shift();const best=[...pingSamples].sort((a,b)=>a.rtt-b.rtt).slice(0,5);clockOffset=best.reduce((sum,x)=>sum+x.offset,0)/best.length;}
 if(data.type==='start')scheduleRemoteStart(data.at,data.position||0);
 if(data.type==='pause'){stopCorrection();stopVisual();if(A()?.syncIsVisualOnly?.())A()?.syncSetVisualTime?.(Number(data.position)||A()?.getSyncTime?.()||0);else A()?.syncPause?.();}
 if(data.type==='reset'){stopCorrection();stopVisual();if(A()?.syncIsVisualOnly?.())A()?.syncSetVisualTime?.(0);else A()?.syncSeek?.(0);}
}
async function unlockMedia(){const a=A();if(!a?.hasMedia?.())throw Error('教材の受信がまだ終わっていません。');await a.syncUnlock();}
async function prepareGuest(){try{if(!A()?.getProject?.()?.parts?.length)throw Error('絵譜の受信がまだ終わっていません。');guestReady=true;guestConn?.send({type:'ready',ready:true});$('guestStatus').textContent='✓ 準備OKです。先生のスタートを待ちます。';$('guestPrepare').textContent='✓ 準備OK';A()?.enterPerformance?.();window.dispatchEvent(new Event('score-performance-ready'));$('syncModal').close();}catch(e){msg(e.message);}}
async function prepareHost(){try{await ensureCountAudio();await unlockMedia();teacherPrepared=true;$('hostPrepare').textContent='✓ この端末も準備OK';A()?.enterPerformance?.();window.dispatchEvent(new Event('score-performance-ready'));}catch(e){msg(e.message);}}
function expectedPosition(){
 const a=A(),rate=a?.getSyncRate?.()||1,teacherNow=Date.now()+(mode==='guest'?clockOffset:0);
 return activeStartPosition+Math.max(0,teacherNow-activeStartAt)/1000*rate;
}
function startCorrection(teacherAt,position){
 stopCorrection();activeStartAt=Number(teacherAt)||0;activeStartPosition=Number(position)||0;
 const run=()=>{if(!activeStartAt)return;const expected=expectedPosition();A()?.syncCorrect?.(expected);};
 setTimeout(run,350);correctionTimer=setInterval(run,1200);
}
function startVisualClock(teacherAt,position){
 stopVisual();visualStartAt=Number(teacherAt)||0;visualStartPosition=Number(position)||0;
 const step=ts=>{
   if(!visualStartAt)return;
   if(ts-visualLastFrame>=33){
     visualLastFrame=ts;
     const rate=A()?.getSyncRate?.()||1,teacherNow=Date.now()+clockOffset;
     const pos=visualStartPosition+Math.max(0,teacherNow-visualStartAt)/1000*rate;
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
   setTimeout(()=>startVisualClock(teacherAt,position),delay);
   return;
 }
 A()?.syncScheduleStart?.(delay,position);
 setTimeout(()=>startCorrection(teacherAt,position),delay+120);
}
async function hostCommand(type){
 if(type==='start'){
  const approved=[...hostConns.values()].filter(x=>x.approved),notReady=approved.filter(x=>!x.ready).length;if(notReady&&!confirm(`準備OKでない端末が${notReady}台あります。スタートしますか？`))return;
  if(!teacherPrepared){await prepareHost();if(!teacherPrepared)return;}
  clearCountIn();stopCorrection();stopVisual();
  await ensureCountAudio();
  const beatSec=Math.max(.12,Math.min(4.2,Number(A()?.syncBeatSeconds?.())||.5)),beatMs=beatSec*1000,count=8,lead=500;
  const songDelay=lead+beatMs*count,at=Date.now()+songDelay,position=0;
  for(const {conn,approved} of hostConns.values())if(approved&&conn.open)conn.send({type:'start',at,position});
  A()?.syncScheduleStart?.(songDelay,position);
  setTimeout(()=>startCorrection(at,position),songDelay+120);
  await playCountIn(lead,beatMs,count);
  $('hostStatus').textContent=`8拍カウント後にスタートします（${Math.round(60/beatSec)} BPM相当）`;
  countTimers.push(setTimeout(()=>{$('hostStatus').textContent='▶ 演奏スタート';},songDelay));
  return;
 }
 if(type==='pause'){clearCountIn();const position=A()?.getSyncTime?.()||0;for(const {conn,approved} of hostConns.values())if(approved&&conn.open)conn.send({type:'pause',position});stopCorrection();if(teacherPrepared)A()?.syncPause?.();return;}
 if(type==='reset'){clearCountIn();for(const {conn,approved} of hostConns.values())if(approved&&conn.open)conn.send({type:'reset',position:0});stopCorrection();if(teacherPrepared)A()?.syncSeek?.(0);return;}
}
function init(){if(!A())return setTimeout(init,40);addStyles();makeUI();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();