(()=>{
'use strict';
const AI_MODEL='gpt-5.6-sol';
let undoSnapshot=null;
const addChoice={};
const SOUND_CHOICES={
  taiko:[['タン','hit'],['タタ','double'],['ウン','rest']],
  bell:[['シャン','bell-hit'],['ウン','bell-rest'],['✨ シャララララー ✨','bell-long']],
  tamb:[['シャラララー','phrase'],['タン','hit'],['ウン','rest']],
  snare:[['タン','hit'],['タカ','phrase'],['ウン','rest']],
  bass:[['ドン','hit'],['ウン','rest']],
  cymbal:[['ジャーン','phrase'],['ウン','rest']],
  triangle:[['チン','hit'],['ウン','rest']],
  castanet:[['カッ','hit'],['ウン','rest']],
  maracas:[['シャカ','hit'],['ウン','rest']],
  xylophone:[['タン','hit'],['ウン','rest']],
  tonechime:[['リーン','phrase'],['ウン','rest']],
  recorder:[['トゥ','hit'],['ウン','rest']]
};
function cloneData(v){return JSON.parse(JSON.stringify(v));}
function capture(){return {bpm:state.bpm,startOffset:state.startOffset,lanes:cloneData(state.lanes),taikoSequence:cloneData(INSTRUMENTS.find(x=>x.id==='taiko')?.sequence||[])};}
function restore(s){if(!s)return;state.bpm=s.bpm;state.startOffset=s.startOffset;state.lanes=cloneData(s.lanes);const taiko=INSTRUMENTS.find(x=>x.id==='taiko');if(taiko)taiko.sequence=cloneData(s.taikoSequence);$('bpmInput').value=state.bpm.toFixed(2);renderBoard();updatePositions();saveState(false);}
function noteWidthFor(id,kind){if(id==='taiko')return kind==='double'?92:72;if(id==='bell')return kind==='bell-long'?Math.max(220,3*beatSec()*PX_PER_SEC-12):76;return 132;}
function installLaneEditors(){
  state.selected.forEach(id=>{
    const laneEl=document.getElementById('lane-'+id);if(!laneEl)return;
    const label=laneEl.querySelector('.label'),track=laneEl.querySelector('.track');
    laneEl.querySelector('.soundPalette')?.remove();
    if(state.editId!==id)return;
    const choices=SOUND_CHOICES[id]||[[inst(id)?.phrase||'音','phrase']];
    if(!addChoice[id])addChoice[id]={text:choices[0][0],kind:choices[0][1]};
    const p=document.createElement('div');p.className='soundPalette';
    const title=document.createElement('div');title.className='soundPaletteTitle';title.textContent='追加する音を選ぶ → 右のレーンをタップ';p.appendChild(title);
    choices.forEach(([text,kind])=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.className='soundAddBtn'+(addChoice[id].text===text&&addChoice[id].kind===kind?' selected':'');b.onclick=e=>{e.stopPropagation();addChoice[id]={text,kind};installLaneEditors();};p.appendChild(b);});
    label.appendChild(p);
    track.onclick=e=>{
      if(state.deleteMode||state.editId!==id||e.target.closest('.note'))return;
      const choice=addChoice[id]||{text:choices[0][0],kind:choices[0][1]};
      const r=track.getBoundingClientRect(),localX=e.clientX-r.left,off=(state.lanes[id].offset||0)+(state.startOffset||0),w=noteWidthFor(id,choice.kind);
      const time=Math.max(0,(audio.currentTime||0)+((localX-w/2)-START_X)/PX_PER_SEC-off);
      state.lanes[id].notes.push({id:makeId(),time,text:choice.text,kind:choice.kind});
      state.lanes[id].notes.sort((a,b)=>a.time-b.time);renderBoard();saveState(false);$('statusText').textContent=choice.text+' を追加しました。';
    };
  });
}
const originalRenderBoard=renderBoard;
renderBoard=function(){originalRenderBoard();installLaneEditors();};
function applyAction(a){
  const ids=INSTRUMENTS.map(x=>x.id);
  if(a.type==='set_bpm'&&Number.isFinite(a.value)){state.bpm=Math.max(40,Math.min(220,a.value));$('bpmInput').value=state.bpm.toFixed(2);rebuildAuto();return;}
  if(a.type==='shift_global'&&Number.isFinite(a.value)){state.startOffset+=a.value;return;}
  if(a.type==='shift_instrument'&&ids.includes(a.instrument)&&Number.isFinite(a.value)){ensureLane(a.instrument);state.lanes[a.instrument].offset=(state.lanes[a.instrument].offset||0)+a.value;return;}
  if(a.type==='delete_range'&&ids.includes(a.instrument)&&Number.isFinite(a.start)&&Number.isFinite(a.end)){ensureLane(a.instrument);const lo=Math.min(a.start,a.end),hi=Math.max(a.start,a.end);state.lanes[a.instrument].notes=state.lanes[a.instrument].notes.filter(n=>n.time<lo||n.time>hi);return;}
  if(a.type==='regenerate_instrument'&&ids.includes(a.instrument)){state.lanes[a.instrument]={offset:state.lanes[a.instrument]?.offset||0,notes:autoNotes(a.instrument)};return;}
  if(a.type==='add_note'&&ids.includes(a.instrument)&&Number.isFinite(a.start)&&typeof a.text==='string'&&a.text){ensureLane(a.instrument);state.lanes[a.instrument].notes.push({id:makeId(),time:Math.max(0,a.start),text:a.text,kind:a.kind||'phrase'});return;}
  if(a.type==='set_taiko_pattern'&&Array.isArray(a.pattern)&&a.pattern.length===4){const taiko=INSTRUMENTS.find(x=>x.id==='taiko');if(!taiko)return;taiko.sequence=a.pattern.map((text,beat)=>({text,beat,kind:text==='タタ'?'double':text==='ウン'?'rest':'hit'}));taiko.phrase=a.pattern.join('・');state.lanes.taiko={offset:state.lanes.taiko?.offset||0,notes:autoNotes('taiko')};}
}
function scoreContext(){const lanes={};for(const id of state.selected){const lane=state.lanes[id];lanes[id]={name:inst(id)?.name,offset:lane?.offset||0,noteCount:lane?.notes?.length||0};}return {bpm:state.bpm,startOffset:state.startOffset,currentTime:Number((audio.currentTime||0).toFixed(2)),duration:Number((state.duration||0).toFixed(2)),selected:state.selected,editing:state.editId||state.mode,lanes,taikoPattern:(INSTRUMENTS.find(x=>x.id==='taiko')?.sequence||[]).map(x=>x.text)};}
const schema={type:'object',properties:{summary:{type:'string'},actions:{type:'array',items:{type:'object',properties:{type:{type:'string',enum:['set_bpm','shift_global','shift_instrument','delete_range','regenerate_instrument','add_note','set_taiko_pattern']},instrument:{anyOf:[{type:'string',enum:['taiko','bell','tamb','snare','bass','cymbal','triangle','castanet','maracas','xylophone','tonechime','recorder']},{type:'null'}]},value:{anyOf:[{type:'number'},{type:'null'}]},start:{anyOf:[{type:'number'},{type:'null'}]},end:{anyOf:[{type:'number'},{type:'null'}]},text:{anyOf:[{type:'string'},{type:'null'}]},kind:{anyOf:[{type:'string'},{type:'null'}]},pattern:{anyOf:[{type:'array',items:{type:'string'},minItems:4,maxItems:4},{type:'null'}]}},required:['type','instrument','value','start','end','text','kind','pattern'],additionalProperties:false}}},required:['summary','actions'],additionalProperties:false};
function injectUI(){
  const style=document.createElement('style');style.textContent=`
.note.current:not(.taiko-double):not(.taiko-hit):not(.taiko-rest){background:#fff36b!important;border-color:#d83b35!important;box-shadow:0 0 0 10px #ffe66a,0 0 24px 14px #ffd54a,0 4px 8px #0002!important;transform:translateY(-50%) scale(1.14)!important;z-index:9}
.note.bell-hit,.note.bell-rest{width:68px!important;height:68px!important;min-height:68px!important;font-size:14px!important;padding:4px!important}
.soundPalette{width:100%;display:flex;flex-wrap:wrap;gap:5px;justify-content:center;margin-top:4px;padding-top:5px;border-top:1px dashed #8c745c}.soundPaletteTitle{width:100%;font-size:10px;font-weight:900;text-align:center}.soundAddBtn{min-height:34px!important;padding:4px 7px!important;font-size:11px!important}.soundAddBtn.selected{background:#d83b35;color:#fff;border-color:#d83b35}.track.editing{cursor:crosshair}
#aiEditBtn{background:#6f55c7;color:#fff;border-color:#6f55c7}.aiBackdrop{position:fixed;inset:0;background:#0008;z-index:300;display:grid;place-items:center;padding:14px}.aiBackdrop[hidden]{display:none}.aiPanel{width:min(680px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:20px;padding:18px;box-shadow:0 18px 60px #0005}.aiHead{display:flex;justify-content:space-between;align-items:center;gap:10px}.aiHead h2{margin:0}.aiPanel textarea{width:100%;min-height:110px;border:2px solid #cfc5dd;border-radius:12px;padding:12px;font:inherit;font-size:17px}.aiKey{width:100%;border:2px solid #ddd;border-radius:10px;padding:9px;margin:8px 0}.aiActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.aiRun{background:#6f55c7;color:#fff;border-color:#6f55c7}.aiUndo{background:#fff}.aiMsg{margin-top:10px;padding:10px;background:#f6f2ff;border-radius:10px;min-height:42px}.aiExamples{font-size:13px;color:#655b70;line-height:1.6}.aiNote{font-size:12px;color:#766e7e;margin-top:7px}`;document.head.appendChild(style);
  const btn=document.createElement('button');btn.id='aiEditBtn';btn.textContent='✨ AIで直す';document.querySelector('.controls')?.appendChild(btn);
  const back=document.createElement('div');back.className='aiBackdrop';back.id='aiBackdrop';back.hidden=true;back.innerHTML=`<div class="aiPanel"><div class="aiHead"><h2>✨ AIで絵譜を直す</h2><button id="aiClose">×</button></div><p class="aiExamples">例：「太鼓を0.2秒遅く」「BPMを103.5に」「今いるところから5秒間の太鼓を消して」</p><textarea id="aiInstruction" placeholder="直したいことを日本語で入力"></textarea><input id="aiKey" class="aiKey" type="password" autocomplete="off" placeholder="OpenAI APIキー（保存しません）"><div class="aiNote">APIキーはこの画面を開いている間だけ使い、アプリには保存しません。</div><div class="aiActions"><button id="aiRun" class="aiRun">AIに直してもらう</button><button id="aiUndo" class="aiUndo">↶ AI修正を元に戻す</button></div><div id="aiMsg" class="aiMsg">指示を入力してください。</div></div>`;document.body.appendChild(back);
  btn.onclick=()=>{back.hidden=false;$('aiInstruction').focus()};$('aiClose').onclick=()=>back.hidden=true;back.addEventListener('click',e=>{if(e.target===back)back.hidden=true});$('aiUndo').onclick=()=>{if(!undoSnapshot)return $('aiMsg').textContent='まだAI修正はありません。';restore(undoSnapshot);undoSnapshot=null;$('aiMsg').textContent='AI修正前に戻しました。'};$('aiRun').onclick=runAI;installLaneEditors();
}
async function runAI(){const key=$('aiKey').value.trim(),instruction=$('aiInstruction').value.trim(),msg=$('aiMsg'),run=$('aiRun');if(!instruction){msg.textContent='直したいことを入力してください。';return;}if(!key){msg.textContent='OpenAI APIキーを入力してください。キーは保存しません。';return;}run.disabled=true;msg.textContent='AIが修正内容を考えています…';try{const payload={model:AI_MODEL,store:false,instructions:'あなたは特別支援学校向けの流れる絵譜を安全に編集するアシスタントです。ユーザーの日本語指示を許可された編集actionsだけに変換してください。',input:[{role:'user',content:[{type:'input_text',text:'現在の絵譜: '+JSON.stringify(scoreContext())+'\nユーザーの指示: '+instruction}]}],text:{format:{type:'json_schema',name:'score_edits',strict:true,schema}}};const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},body:JSON.stringify(payload)});if(!r.ok)throw new Error('API '+r.status);const data=await r.json();const text=data.output_text||data.output?.flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text;if(!text)throw new Error('no output');const plan=JSON.parse(text);undoSnapshot=capture();for(const a of plan.actions||[])applyAction(a);renderBoard();updatePositions();saveState(false);msg.textContent=(plan.summary||'AIで修正しました。')+'（元に戻すこともできます）';}catch(e){console.error(e);msg.textContent='AI編集に接続できませんでした。APIキーや通信状態を確認してください。';}finally{run.disabled=false;}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',injectUI);else injectUI();
})();