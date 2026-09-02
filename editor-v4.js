'use strict';

/* v4 direct editor interactions: tap empty space to add, drag empty space to move the whole part. */
document.addEventListener('DOMContentLoaded',()=>{
  const timeline=document.getElementById('timeline');
  const audio=document.getElementById('audio');
  const listen=document.getElementById('editListen');
  const listenPause=document.getElementById('editListenPause');

  if(listen) listen.onclick=async()=>{
    try{
      if(!audio.src) await prepareAudio();
      await audio.play();
      toast('曲を聞きながら絵譜を動かせます');
    }catch(e){console.error(e);toast('曲を再生できませんでした');}
  };
  if(listenPause) listenPause.onclick=()=>audio.pause();

  if(!timeline) return;
  let active=false,startX=0,startClientX=0,startSeq=[],moved=false,pointerId=null;

  timeline.addEventListener('pointerdown',e=>{
    if(e.target.closest('.event-card,.add-event')) return;
    const id=currentInstId();
    const seq=state.seq[id]||[];
    if(!seq.length){
      const rect=timeline.getBoundingClientRect();
      const beat=snap((e.clientX-rect.left)/PX_PER_BEAT-PRE_ROLL);
      openAdd(beat);
      return;
    }
    active=true; moved=false; pointerId=e.pointerId; startX=e.clientX; startClientX=e.clientX;
    startSeq=seq.map(x=>({id:x.id,beat:Number(x.beat||0)}));
    pushUndo();
    timeline.setPointerCapture?.(e.pointerId);
  });

  timeline.addEventListener('pointermove',e=>{
    if(!active||e.pointerId!==pointerId) return;
    const dx=e.clientX-startX;
    if(Math.abs(e.clientX-startClientX)>5)moved=true;
    if(!moved)return;
    let delta=Math.round((dx/PX_PER_BEAT)/SNAP)*SNAP;
    const minStart=Math.min(...startSeq.map(x=>x.beat));
    if(minStart+delta<0)delta=-minStart;
    const id=currentInstId();
    const seq=state.seq[id]||[];
    for(const origin of startSeq){
      const item=seq.find(x=>x.id===origin.id);if(!item)continue;
      item.beat=snap(origin.beat+delta);
      const el=timeline.querySelector(`.event-card[data-id="${CSS.escape(item.id)}"]`);
      if(el)el.style.left=`${(PRE_ROLL+item.beat)*PX_PER_BEAT}px`;
    }
  });

  timeline.addEventListener('pointerup',e=>{
    if(!active||e.pointerId!==pointerId)return;
    active=false;
    timeline.releasePointerCapture?.(e.pointerId);
    if(moved){saveProject();toast('この楽器の絵譜を動かしました');return;}
    // A short tap on empty timeline inserts a sound at that beat.
    state.undo.pop();
    const rect=timeline.getBoundingClientRect();
    const beat=snap((e.clientX-rect.left)/PX_PER_BEAT-PRE_ROLL);
    openAdd(beat);
  });

  timeline.addEventListener('pointercancel',()=>{active=false;});
});
