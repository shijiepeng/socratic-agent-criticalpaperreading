const $=s=>document.querySelector(s);
let page=1,tool='select',color='#f4cf60',zoom=100,selectionRange=null,selectionText='',drawing=null,pendingQuote='',history=[],redoHistory=[];
const pageCache={},inkCache={},englishInkCache={},englishCache={}; let selectionPaper=null;const svgNS='http://www.w3.org/2000/svg';
function toast(s){$('#toast').textContent=s;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,2300)}
function annotationState(){return {page,html:$('#paper').innerHTML,ink:$('#ink-layer').innerHTML,english:$('#english-paper').innerHTML,englishInk:$('#english-ink-layer').innerHTML}}
function updateHistoryButtons(){$('#undo').disabled=!history.length;$('#redo').disabled=!redoHistory.length}
function snapshot(){history.push(annotationState());if(history.length>80)history.shift();redoHistory=[];updateHistoryButtons()}
function restoreAnnotations(state){
  $('#paper').innerHTML=state.html;$('#ink-layer').innerHTML=state.ink;$('#english-paper').innerHTML=state.english;$('#english-ink-layer').innerHTML=state.englishInk;
  selectionRange=null;selectionText='';drawing=null;$('#selection-menu').hidden=true;
  alignSectionRows();if(page!==state.page)renderPage(state.page);cache();updateHistoryButtons();
}
function moveAnnotationHistory(from,to){
  if(document.activeElement?.classList.contains('paper-text-note'))document.activeElement.blur();
  const current=annotationState();let previous;
  while(from.length){
    const candidate=from.pop();
    if(candidate.html!==current.html||candidate.ink!==current.ink||candidate.english!==current.english||candidate.englishInk!==current.englishInk){previous=candidate;break}
  }
  if(previous){to.push(current);restoreAnnotations(previous)}else updateHistoryButtons();
}

function cache(){pageCache[page]=$('#paper').innerHTML;inkCache[page]=$('#ink-layer').innerHTML;englishInkCache[page]=$('#english-ink-layer').innerHTML;if(page>=0)englishCache[page]=$('#english-paper').innerHTML}
function sectionBody(html,index){
  if(index===1)html=html.slice(html.indexOf('<h2>'));
  if(index>0)html=html.replace(/<h1>/g,'<h2>').replace(/<\/h1>/g,'</h2>').replace(/<p class="english-title">.*?<\/p>/g,'');
  return html;
}
function mountFullArticle(){
  $('#paper').innerHTML='<div class="page-language">中文 · 译文</div>'+paperPages.map((p,i)=>`<section class="article-section" id="zh-section-${i}" data-section="${i}">${sectionBody(p.html,i)}</section>`).join('');
  $('#english-paper').innerHTML='<div class="page-language">ENGLISH · 原文</div>'+englishPages.map((html,i)=>`<section class="article-section" id="en-section-${i}" data-section="${i}">${sectionBody(html,i)}</section>`).join('');
}
function readingRoot(){return $('.workspace').classList.contains('english-only')?$('#english-paper'):$('#paper')}
function selectSection(n){
  page=n;$('#page-label').textContent=`${n+1} / ${paperPages.length}`;
  document.querySelectorAll('[data-page]').forEach(b=>{b.classList.toggle('selected',+b.dataset.page===n);b.setAttribute('aria-current',+b.dataset.page===n?'location':'false')});
  $('#prev-page').disabled=n===0;$('#next-page').disabled=n===paperPages.length-1;
}
function renderPage(n){
  if(n<0||n>=paperPages.length)return;
  selectSection(n);$('#selection-menu').hidden=true;
  const scroller=$('#paper-scroll'),section=readingRoot().querySelector(`[data-section="${n}"]`);
  scroller.scrollTop+=section.getBoundingClientRect().top-scroller.getBoundingClientRect().top-24;
}
function alignSectionRows(){
  const anchor=readingAnchor();
  const zh=[...$('#paper').querySelectorAll('.article-section')],en=[...$('#english-paper').querySelectorAll('.article-section')];
  [...zh,...en].forEach(s=>{s.style.minHeight='';s.querySelectorAll('p[data-number]').forEach(p=>p.style.minHeight='')});
  if($('.workspace').classList.contains('bilingual'))zh.forEach((s,i)=>{
    s.querySelectorAll('p[data-number]').forEach(p=>{
      const counterpart=en[i].querySelector(`[data-number="${p.dataset.number}"]`);
      if(counterpart){const height=Math.max(p.getBoundingClientRect().height/(zoom/100),counterpart.getBoundingClientRect().height/(zoom/100));p.style.minHeight=counterpart.style.minHeight=height+'px'}
    });
    const height=Math.max(s.getBoundingClientRect().height/(zoom/100),en[i].getBoundingClientRect().height/(zoom/100));s.style.minHeight=en[i].style.minHeight=height+'px';
  });
  updateZoomSurface();
  restoreReadingAnchor(anchor);
}
mountFullArticle();selectSection(0);
$('#paper-scroll').addEventListener('scroll',()=>{
  const top=$('#paper-scroll').getBoundingClientRect().top+60;
  let active=0;readingRoot().querySelectorAll('.article-section').forEach((s,i)=>{if(s.getBoundingClientRect().top<=top)active=i});
  selectSection(active);
},{passive:true});
let previousReaderWidth=0;
new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(Math.abs(width-previousReaderWidth)>1){previousReaderWidth=width;sizePaperSurface();alignSectionRows()}}).observe($('#paper-scroll'));
document.fonts.ready.then(alignSectionRows);
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>renderPage(+b.dataset.page));$('#prev-page').onclick=()=>renderPage(page-1);$('#next-page').onclick=()=>renderPage(page+1);
function setTool(t){if(document.activeElement?.classList.contains('paper-text-note'))document.activeElement.blur();tool=t;$('#eraser-cursor').hidden=true;$('#paper-scroll').dataset.tool=t;document.querySelectorAll('[data-tool]').forEach(b=>{b.classList.toggle('active',b.dataset.tool===t);b.setAttribute('aria-pressed',b.dataset.tool===t)});document.querySelectorAll('.ink-layer').forEach(layer=>{layer.classList.toggle('drawing',['pen','rectangle'].includes(t));layer.classList.toggle('erasing',t==='eraser')});$('#tool-status').textContent={select:'选中原文后点击“讨论”，可带入聊天',text:'点击论文添加文字 · 点击已有文字可编辑 · 橡皮擦可删除',pen:'在论文上拖动画笔 · 使用撤销可恢复',highlight:'拖选需要标记的文字，松开即可高亮',rectangle:'在论文上拖动，框出需要关注的内容',eraser:'按住并拖动圆形橡皮擦，擦除经过的标记'}[t];$('#selection-menu').hidden=true}
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{capturePaperSelection();setTool(b.dataset.tool);if(b.dataset.tool==='highlight'&&selectionRange)highlight()});document.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{color=b.dataset.color;document.querySelectorAll('[data-color]').forEach(c=>{c.classList.toggle('active',c===b);c.setAttribute('aria-pressed',c===b)})});
// Keep the unscaled layout independent of zoom; only the entire surface transforms.
function sizePaperSurface(){
  const scroller=$('#paper-scroll'),style=getComputedStyle(scroller);
  const available=scroller.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
  const bilingual=$('.workspace').classList.contains('bilingual');
  $('.paper-spread').style.width=(bilingual?Math.max(798,Math.min(1800,available)):Math.max(320,Math.min(850,available)))+'px';
  updateZoomSurface();
}
function updateZoomSurface(){
  const spread=$('.paper-spread'),stage=$('.paper-zoom-stage'),scale=zoom/100;
  spread.style.transform=`scale(${scale})`;
  stage.style.width=spread.offsetWidth*scale+'px';
  stage.style.height=spread.offsetHeight*scale+'px';
}
function paperPoint(layer,clientX,clientY){
  const point=new DOMPoint(clientX,clientY).matrixTransform(layer.getScreenCTM().inverse());
  return {x:point.x,y:point.y};
}
function setZoom(delta){
  const next=Math.max(50,Math.min(200,zoom+delta));if(next===zoom)return;
  if(document.activeElement?.classList.contains('paper-text-note'))document.activeElement.blur();
  const scroller=$('#paper-scroll'),stage=$('.paper-zoom-stage');
  const viewport=scroller.getBoundingClientRect(),before=stage.getBoundingClientRect(),oldScale=zoom/100;
  const focusX=viewport.left+scroller.clientWidth/2,focusY=viewport.top+scroller.clientHeight/2;
  const pointX=(focusX-before.left)/oldScale,pointY=(focusY-before.top)/oldScale;
  zoom=next;updateZoomSurface();
  const after=stage.getBoundingClientRect();
  scroller.scrollLeft+=after.left+pointX*(zoom/100)-focusX;
  scroller.scrollTop+=after.top+pointY*(zoom/100)-focusY;
  $('#zoom-value').textContent=`${zoom}%`;
  $('#zoom-out').disabled=zoom===50;$('#zoom-in').disabled=zoom===200;
  $('#selection-menu').hidden=true;$('#eraser-cursor').hidden=true;
}
sizePaperSurface();
new ResizeObserver(updateZoomSurface).observe($('.paper-spread'));
$('#zoom-in').onclick=()=>setZoom(10);$('#zoom-out').onclick=()=>setZoom(-10);$('#undo').onclick=()=>moveAnnotationHistory(history,redoHistory);$('#redo').onclick=()=>moveAnnotationHistory(redoHistory,history);
function capturePaperSelection(){
  const selection=window.getSelection();
  if(!selection||selection.isCollapsed){$('#selection-menu').hidden=true;return;}
  const root=[$('#paper'),$('#english-paper')].find(el=>el.contains(selection.anchorNode)&&el.contains(selection.focusNode));
  if(!root||selection.anchorNode.parentElement?.closest('.paper-text-note'))return;
  selectionPaper=root;selectionRange=selection.getRangeAt(0).cloneRange();selectionText=selection.toString().trim();
  
}
document.addEventListener('selectionchange',capturePaperSelection);
[$('#paper'),$('#english-paper')].forEach(root=>{
  root.addEventListener('pointerdown',e=>{if(e.button===0){selectionRange=null;selectionText='';$('#selection-menu').hidden=true;}});
  root.addEventListener('mouseup',e=>{if(e.button!==0||['eraser','text'].includes(tool)||e.target.closest('.paper-text-note'))return;capturePaperSelection();if(tool==='highlight'&&selectionRange)highlight();else if(tool==='select')showSelectionMenu()});
  root.addEventListener('keyup',()=>{capturePaperSelection();if(tool==='select')showSelectionMenu()});
});
$('.annotation-bar').addEventListener('mousedown',e=>{if(e.target.closest('button'))e.preventDefault()});
function showSelectionMenu(){
  const selection=window.getSelection();
  if(tool!=='select'||!selectionRange||!selectionText||!selection||selection.isCollapsed)return;
  const rect=selectionRange.getBoundingClientRect(),menu=$('#selection-menu');
  menu.hidden=false;
  const width=menu.offsetWidth,height=menu.offsetHeight;
  menu.style.left=Math.max(8,Math.min(innerWidth-width-8,rect.left+(rect.width-width)/2))+'px';
  menu.style.top=Math.max(8,Math.min(innerHeight-height-8,rect.top>height+12?rect.top-height-8:rect.bottom+8))+'px';
}
$('#discuss-quote').onmousedown=e=>e.preventDefault();
$('#discuss-quote').onclick=()=>{
  if(!selectionText)return;
  pendingQuote=selectionText;$('#quote-text').textContent=pendingQuote;$('#quote-draft').hidden=false;
  $('#selection-menu').hidden=true;window.getSelection()?.removeAllRanges();
  setChatOpen(true);$('#message-input').focus({preventScroll:true});
};
document.addEventListener('pointerdown',e=>{
  if(!e.target.closest('#selection-menu,#paper,#english-paper'))$('#selection-menu').hidden=true;
});
$('#paper-scroll').addEventListener('scroll',()=>{$('#selection-menu').hidden=true},{passive:true});


function highlight(){if(!selectionRange)return;snapshot();const walker=document.createTreeWalker(selectionPaper||$('#paper'),NodeFilter.SHOW_TEXT);let n;const nodes=[];while(n=walker.nextNode()){if(n.textContent.trim()&&selectionRange.intersectsNode(n))nodes.push(n)}for(const node of nodes){let a=node===selectionRange.startContainer?selectionRange.startOffset:0,b=node===selectionRange.endContainer?selectionRange.endOffset:node.length;if(b<=a)continue;const r=document.createRange();r.setStart(node,a);r.setEnd(node,b);const m=document.createElement('mark');m.style.background=color+'88';m.dataset.annotation='user';r.surroundContents(m)}window.getSelection().removeAllRanges();$('#selection-menu').hidden=true;cache()}
const newTextNotes=new WeakSet(),editedTextNotes=new WeakSet();
[$('#paper'),$('#english-paper')].forEach(root=>{
  root.addEventListener('click',e=>{
    const note=e.target.closest('.paper-text-note');
    if(tool==='eraser')return;
    if(tool!=='text'||note)return;
    const section=e.target.closest('.article-section')||root,box=section.getBoundingClientRect();
    snapshot();
    const text=document.createElement('div');text.className='paper-text-note';
    text.contentEditable='plaintext-only';text.setAttribute('role','textbox');text.setAttribute('aria-label','论文文字批注');text.setAttribute('aria-multiline','true');
    text.setAttribute('spellcheck','false');
    const x=Math.max(0,Math.min(e.clientX-box.left,box.width-100*(zoom/100))),y=Math.max(0,e.clientY-box.top);
    text.style.left=(x/box.width*100)+'%';text.style.top=(y/box.height*100)+'%';
    text.style.maxWidth=`calc(100% - ${x/box.width*100}% )`;
    text.style.color={'#f4cf60':'#875e08','#6da3ef':'#285ea8','#8ec6ad':'#287052','#e5a1b4':'#a13e62'}[color]||color;
    newTextNotes.add(text);section.append(text);text.focus({preventScroll:true});
  });
  root.addEventListener('focusin',e=>{if(e.target.classList.contains('paper-text-note')){if(newTextNotes.has(e.target)){newTextNotes.delete(e.target);editedTextNotes.add(e.target)}else editedTextNotes.delete(e.target)}});
  root.addEventListener('beforeinput',e=>{if(e.target.classList.contains('paper-text-note')&&!editedTextNotes.has(e.target)){snapshot();editedTextNotes.add(e.target)}});
  root.addEventListener('focusout',e=>{if(e.target.classList.contains('paper-text-note')){if(!e.target.textContent.trim())e.target.remove();cache()}});
  root.addEventListener('keydown',e=>{if(e.target.classList.contains('paper-text-note')&&e.key==='Escape'){e.target.blur()}});
});

document.querySelectorAll('.ink-layer').forEach(layer=>{
  layer.onpointerdown=e=>{
    if(e.button!==0)return;
    if(tool==='eraser')return;
    if(!['pen','rectangle'].includes(tool))return;
    e.preventDefault();snapshot();
    const {x,y}=paperPoint(layer,e.clientX,e.clientY);
    const shape=document.createElementNS(svgNS,tool==='pen'?'path':'rect');
    shape.setAttribute('stroke',color);shape.setAttribute('stroke-width','2.5');shape.setAttribute('fill','none');shape.setAttribute('stroke-linecap','round');
    drawing={layer,shape,x,y,d:`M${x},${y}`};if(tool==='pen')shape.setAttribute('d',drawing.d);
    layer.append(shape);layer.setPointerCapture(e.pointerId);
  };
  layer.onpointermove=e=>{
    if(!drawing||drawing.layer!==layer)return;
    const {x,y}=paperPoint(layer,e.clientX,e.clientY);
    if(tool==='pen'){drawing.d+=` L${x},${y}`;drawing.shape.setAttribute('d',drawing.d)}
    else Object.entries({x:Math.min(x,drawing.x),y:Math.min(y,drawing.y),width:Math.abs(x-drawing.x),height:Math.abs(y-drawing.y)}).forEach(([key,value])=>drawing.shape.setAttribute(key,value));
  };
  const finish=()=>{if(drawing?.layer===layer){drawing=null;cache()}};
  layer.onpointerup=finish;layer.onpointercancel=finish;
});

const eraserRadius=12;
let eraserStroke=null;
function showEraser(event){
  const cursor=$('#eraser-cursor');cursor.hidden=tool!=='eraser';
  cursor.style.left=event.clientX+'px';cursor.style.top=event.clientY+'px';
}
function circleHitsRect(x,y,rect,radius=eraserRadius){
  const dx=x-Math.max(rect.left,Math.min(x,rect.right)),dy=y-Math.max(rect.top,Math.min(y,rect.bottom));
  return dx*dx+dy*dy<=radius*radius;
}
function recordErasure(){if(!eraserStroke.recorded){snapshot();eraserStroke.recorded=true}}
function hitTextRanges(element,x,y){
  const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT),hits=[];let node,offset=0;
  while(node=walker.nextNode()){
    for(let i=0;i<node.length;i++){
      const range=document.createRange();range.setStart(node,i);range.setEnd(node,i+1);
      if([...range.getClientRects()].some(rect=>rect.width&&rect.height&&circleHitsRect(x,y,rect)))hits.push({range,index:offset+i});
    }
    offset+=node.length;
  }
  return hits;
}
function strokeSegments(shape){
  if(shape.tagName.toLowerCase()==='rect'){
    const x=+shape.getAttribute('x'),y=+shape.getAttribute('y'),w=+shape.getAttribute('width'),h=+shape.getAttribute('height');
    const points=[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h},{x,y}];return points.slice(1).map((point,i)=>[points[i],point]);
  }
  const commands=[...(shape.getAttribute('d')||'').matchAll(/([ML])\s*(-?[\d.]+(?:e[+-]?\d+)?)[,\s]+(-?[\d.]+(?:e[+-]?\d+)?)/gi)],segments=[];let previous;
  for(const command of commands){const point={x:+command[2],y:+command[3]};if(command[1].toUpperCase()==='L'&&previous)segments.push([previous,point]);previous=point}
  return segments;
}
function eraseAt(wrapper,x,y){
  const root=wrapper.querySelector('.paper'),layer=wrapper.querySelector('.ink-layer');
  if(!circleHitsRect(x,y,wrapper.getBoundingClientRect(),0))return;
  const {x:localX,y:localY}=paperPoint(layer,x,y),localRadius=eraserRadius/(zoom/100);
  layer.querySelectorAll(':scope > path,:scope > rect').forEach(shape=>{
    if(!circleHitsRect(x,y,shape.getBoundingClientRect(),eraserRadius+2))return;
    const segments=strokeSegments(shape),remaining=[];let changed=false;
    for(const [a,b] of segments){
      const dx=b.x-a.x,dy=b.y-a.y,A=dx*dx+dy*dy;
      if(A<.000001){if(Math.hypot(a.x-localX,a.y-localY)<=localRadius)changed=true;else remaining.push([a,b]);continue}
      const ox=a.x-localX,oy=a.y-localY,B=2*(ox*dx+oy*dy),C=ox*ox+oy*oy-localRadius*localRadius,discriminant=B*B-4*A*C;
      const cuts=[0,1];
      if(discriminant>0){const root=Math.sqrt(discriminant);for(const t of [(-B-root)/(2*A),(-B+root)/(2*A)])if(t>0&&t<1)cuts.push(t)}
      cuts.sort((u,v)=>u-v);
      for(let i=1;i<cuts.length;i++){
        const lo=cuts[i-1],hi=cuts[i],mid=(lo+hi)/2;
        if(Math.hypot(a.x+dx*mid-localX,a.y+dy*mid-localY)<localRadius){changed=true;continue}
        remaining.push([{x:a.x+dx*lo,y:a.y+dy*lo},{x:a.x+dx*hi,y:a.y+dy*hi}]);
      }
    }
    if(!changed)return;recordErasure();
    if(!remaining.length){shape.remove();return}
    const replacement=document.createElementNS(svgNS,'path');
    for(const name of ['stroke','stroke-width','stroke-linecap'])replacement.setAttribute(name,shape.getAttribute(name)||'round');
    replacement.setAttribute('fill','none');replacement.setAttribute('d',remaining.map(([a,b])=>`M${a.x},${a.y} L${b.x},${b.y}`).join(' '));shape.replaceWith(replacement);
  });
  root.querySelectorAll('mark').forEach(mark=>{
    if(mark.querySelector('mark')||![...mark.getClientRects()].some(r=>circleHitsRect(x,y,r)))return;
    const hits=hitTextRanges(mark,x,y);if(!hits.length)return;
    recordErasure();const erased=new Set(hits.map(h=>h.index)),text=mark.textContent,fragment=document.createDocumentFragment();
    for(let start=0;start<text.length;){let end=start+1;const clear=erased.has(start);while(end<text.length&&erased.has(end)===clear)end++;
      const segment=text.slice(start,end);
      if(clear)fragment.append(document.createTextNode(segment));else{const kept=mark.cloneNode(false);kept.removeAttribute('id');kept.textContent=segment;fragment.append(kept)}start=end;
    }
    mark.replaceWith(fragment);
  });
  root.querySelectorAll('.paper-text-note').forEach(note=>{
    if(!circleHitsRect(x,y,note.getBoundingClientRect()))return;
    const hits=hitTextRanges(note,x,y);if(!hits.length)return;
    recordErasure();hits.reverse().forEach(hit=>hit.range.deleteContents());if(!note.textContent.trim())note.remove();
  });
}
document.querySelectorAll('.paper-wrap').forEach(wrapper=>{
  wrapper.addEventListener('pointerdown',event=>{
    if(tool!=='eraser'||event.button!==0)return;
    event.preventDefault();event.stopPropagation();window.getSelection()?.removeAllRanges();
    eraserStroke={wrapper,pointerId:event.pointerId,lastX:event.clientX,lastY:event.clientY,recorded:false};
    wrapper.setPointerCapture(event.pointerId);showEraser(event);eraseAt(wrapper,event.clientX,event.clientY);
  },true);
  wrapper.addEventListener('pointermove',event=>{
    if(tool!=='eraser')return;showEraser(event);
    if(!eraserStroke||eraserStroke.wrapper!==wrapper||eraserStroke.pointerId!==event.pointerId)return;
    event.preventDefault();const {lastX,lastY}=eraserStroke,dx=event.clientX-lastX,dy=event.clientY-lastY;
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/(eraserRadius/2)));
    for(let i=1;i<=steps;i++)eraseAt(wrapper,lastX+dx*i/steps,lastY+dy*i/steps);
    eraserStroke.lastX=event.clientX;eraserStroke.lastY=event.clientY;
  },true);
  const finish=event=>{if(eraserStroke?.wrapper===wrapper&&eraserStroke.pointerId===event.pointerId){if(eraserStroke.recorded)cache();eraserStroke=null;if(wrapper.hasPointerCapture(event.pointerId))wrapper.releasePointerCapture(event.pointerId)}};
  wrapper.addEventListener('pointerup',finish,true);wrapper.addEventListener('pointercancel',finish,true);
  wrapper.addEventListener('pointerleave',()=>{$('#eraser-cursor').hidden=true});
});
$('#paper-scroll').addEventListener('scroll',()=>{$('#eraser-cursor').hidden=true},{passive:true});

const notesLayoutKey='critical-paper-reader-notes-layout-v1';
let notesLayout=null,notesGesture=null;
try{
  const saved=JSON.parse(localStorage.getItem(notesLayoutKey));
  if(saved&&['left','top','width','height'].every(k=>Number.isFinite(saved[k]))&&saved.width>0&&saved.height>0)notesLayout=saved;
}catch{}
function readNotesLayout(){const r=$('#notes-panel').getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height}}
function fitNotesLayout(layout){
  const margin=8,maxWidth=Math.max(1,innerWidth-margin*2),maxHeight=Math.max(1,innerHeight-margin*2);
  const width=Math.max(Math.min(280,maxWidth),Math.min(layout.width,maxWidth));
  const height=Math.max(Math.min(240,maxHeight),Math.min(layout.height,maxHeight));
  return {left:Math.max(margin,Math.min(layout.left,innerWidth-width-margin)),top:Math.max(margin,Math.min(layout.top,innerHeight-height-margin)),width,height};
}
function applyNotesLayout(layout){
  const fitted=fitNotesLayout(layout),panel=$('#notes-panel');
  Object.entries(fitted).forEach(([key,value])=>panel.style[key]=value+'px');panel.style.right='auto';
}
function saveNotesLayout(){
  if($('#notes-panel').hidden)return;
  notesLayout=readNotesLayout();try{localStorage.setItem(notesLayoutKey,JSON.stringify(notesLayout))}catch{}
}
function setNotesOpen(open){
  if(!open)saveNotesLayout();
  $('#notes-panel').hidden=!open;$('#notes-toggle').setAttribute('aria-expanded',open);
  if(open){applyNotesLayout(notesLayout||readNotesLayout());$('#note-input').focus({preventScroll:true})}
}
function beginNotesGesture(event,kind){
  if(event.button!==0||(kind==='move'&&event.target.closest('button')))return;
  event.preventDefault();notesGesture={kind,x:event.clientX,y:event.clientY,layout:readNotesLayout(),pointerId:event.pointerId};
  event.currentTarget.setPointerCapture(event.pointerId);$('#notes-panel').classList.add('adjusting');
}
function moveNotesGesture(event){
  if(!notesGesture||event.pointerId!==notesGesture.pointerId)return;
  const {kind,x,y,layout}=notesGesture,dx=event.clientX-x,dy=event.clientY-y;
  if(kind==='move')applyNotesLayout({...layout,left:layout.left+dx,top:layout.top+dy});
  else applyNotesLayout({...layout,width:Math.min(layout.width+dx,innerWidth-layout.left-8),height:Math.min(layout.height+dy,innerHeight-layout.top-8)});
}
function finishNotesGesture(event){
  if(!notesGesture||event.pointerId!==notesGesture.pointerId)return;
  notesGesture=null;$('#notes-panel').classList.remove('adjusting');saveNotesLayout();
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
}
[['#notes-drag-handle','move'],['#notes-resize-handle','resize']].forEach(([selector,kind])=>{
  const handle=$(selector);handle.addEventListener('pointerdown',e=>beginNotesGesture(e,kind));
  handle.addEventListener('pointermove',moveNotesGesture);handle.addEventListener('pointerup',finishNotesGesture);handle.addEventListener('pointercancel',finishNotesGesture);
});
$('#notes-resize-handle').addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
  e.preventDefault();const r=readNotesLayout(),step=e.shiftKey?40:10;
  applyNotesLayout({...r,width:Math.min(r.width+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),innerWidth-r.left-8),height:Math.min(r.height+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0),innerHeight-r.top-8)});saveNotesLayout();
});
window.addEventListener('resize',()=>{if(!$('#notes-panel').hidden)applyNotesLayout(notesLayout||readNotesLayout())});

$('#remove-quote').onclick=()=>{pendingQuote='';$('#quote-draft').hidden=true};
const markdownNoteKey='critical-paper-reader-markdown-v1';
try{$('#note-input').value=localStorage.getItem(markdownNoteKey)||''}catch{}
$('#note-input').addEventListener('input',()=>{
  try{localStorage.setItem(markdownNoteKey,$('#note-input').value);$('#note-save-status').textContent='已保存到本机'}
  catch{$('#note-save-status').textContent='暂存于当前页面'}
});
$('#notes-toggle').onclick=()=>setNotesOpen($('#notes-panel').hidden);
$('#notes-close').onclick=()=>{setNotesOpen(false);$('#notes-toggle').focus({preventScroll:true})};

function highlightCitation(number){
  const paragraphs=[$('#paper'),$('#english-paper')].map(root=>root.querySelector(`[data-number="${number}"]`)).filter(Boolean);
  if(!paragraphs.length)return;
  document.querySelectorAll('.citation-highlight,.paper-pulse').forEach(el=>el.classList.remove('citation-highlight','paper-pulse'));
  clearTimeout(highlightCitation.timer);
  const targets=paragraphs.map(p=>p.querySelector('mark[data-annotation="initial"]')||p);
  targets.forEach(el=>el.classList.add('citation-highlight','paper-pulse'));
  highlightCitation.timer=setTimeout(()=>targets.forEach(el=>el.classList.remove('paper-pulse')),1800);
  selectSection(Number(paragraphs[0].closest('[data-section]').dataset.section));
  $('#selection-menu').hidden=true;
  const visible=targets.filter(el=>el.getClientRects().length),scroller=$('#paper-scroll'),viewport=scroller.getBoundingClientRect();
  if(!visible.length)return;
  const top=Math.min(...visible.map(el=>el.getBoundingClientRect().top));
  scroller.scrollTo({top:scroller.scrollTop+top-viewport.top-72,behavior:'smooth'});
}

function addMessage(role,content,{citation=false,quote='',scroll=true}={}){const article=document.createElement('article');article.className='message '+role;if(role==='agent'){const label=document.createElement('div');label.className='message-label';label.textContent='AI助手';article.append(label)}if(quote){const q=document.createElement('blockquote');q.textContent=quote;article.append(q)}const p=document.createElement('p');p.textContent=content;article.append(p);if(citation){const b=document.createElement('button');b.className='citation';b.textContent='方法 · 咨询师 · 第 10 段';b.onclick=()=>highlightCitation('10');article.append(b)}$('#messages').append(article);if(scroll)$('#messages').scrollTop=$('#messages').scrollHeight}
$('#messages').innerHTML='<div class="chat-date">围绕研究方法的讨论</div>';
addMessage('user','我觉得这里有混淆变量，不能说是街头用语让青少年更愿意自我表露。',{scroll:false});
addMessage('agent','先回到原文：你注意到的哪一项研究安排，让你认为两种语言的作用可能没有被单独区分出来？',{scroll:false});
addMessage('user','A 只说标准英语，B 只说街头用语。两组不仅语言不同，咨询师也不同。',{quote:'咨询师 A 被要求使用标准英语完成所有访谈；……咨询师 B 则被要求使用……地方英语。',scroll:false});
addMessage('agent','你找到了两种条件同时变化的地方。如果 B 咨询师本身就更容易让青少年放松，会怎样影响我们对自我表露差异的解释？',{citation:true,scroll:false});
addMessage('user','即使语言没有作用，B 的个人风格也可能让他们说得更多。现在的设计没法把语言的作用和咨询师本人的作用分开。',{scroll:false});
addMessage('agent','这个解释把研究安排和推断上的困难连起来了。那么，这意味着“街头用语没有效果”，还是“这项研究还不能单独确定它的效果”？',{scroll:false});
let stopped=false;function respond(text){if(/结束|先到这里|不聊了/.test(text)){stopped=true;return '好，我们先停在这里。你可以把当前判断记到笔记里，之后再继续阅读。'}if(/提示/.test(text))return '可以先做一个对照：文中有没有让同一位咨询师分别使用两种语言？试着用这个信息检查，观察到的差异是否还有另一种解释。';if(/概念|混淆|是什么/.test(text))return '混淆是指：另一个因素与研究关注的条件一起变化，使我们难以区分各自的作用。回到这篇文章，你认为哪两个因素一直同时变化？';if(/没有效果|不能|确定|区分|因果/.test(text))return '我们可以把判断限定在这项研究能够支持的范围内。你会怎样用“文中的安排 → 另一种可能解释 → 结论受到的限制”，把你的批评写成一段话？';if(stopped){stopped=false;return '我们可以开始一个新的问题。你希望先看哪项研究做法，或哪一个结论？'}return '我们先把讨论对象说具体一些。你这句话主要针对文中的哪项研究安排或结论？可以选中相关原文发送过来。'}
function send(text){text=text.trim();if(!text)return;addMessage('user',text,{quote:pendingQuote});pendingQuote='';$('#quote-draft').hidden=true;$('#message-input').value='';$('#send').disabled=true;addMessage('agent',respond(text));}
$('#message-input').oninput=()=>$('#send').disabled=!$('#message-input').value.trim();$('#chat-form').onsubmit=e=>{e.preventDefault();send($('#message-input').value)};$('#message-input').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();send(e.target.value)}};

document.addEventListener('keydown',e=>{if(e.key==='Escape'){setNotesOpen(false);$('#selection-menu').hidden=true;setTool('select')}});

function setReadingMode(mode){
  const currentSection=page;
  $('.workspace').classList.toggle('bilingual',mode==='bilingual');
  $('.workspace').classList.toggle('english-only',mode==='english');
  $('#paper-wrap').hidden=mode==='english';
  $('#english-wrap').hidden=mode==='chinese';
  ['english','chinese','bilingual'].forEach(name=>$('#view-'+name).setAttribute('aria-pressed',mode===name));
  $('#reading-mode-label').textContent={english:'英文阅读',chinese:'中文阅读',bilingual:'中英对照'}[mode];
  $('#selection-menu').hidden=true;
  selectionRange=null;selectionText='';
  sizePaperSurface();alignSectionRows();
  requestAnimationFrame(()=>renderPage(currentSection));
}
function readingAnchor(){
  const scroller=$('#paper-scroll'),top=scroller.getBoundingClientRect().top;
  const first=[...readingRoot().querySelectorAll('h1,h2,h3,p')].find(el=>el.getBoundingClientRect().bottom>top+8);
  return first?{el:first,offset:first.getBoundingClientRect().top-top}:null;
}
function restoreReadingAnchor(anchor){if(!anchor)return;requestAnimationFrame(()=>{const scroller=$('#paper-scroll');scroller.scrollTop+=anchor.el.getBoundingClientRect().top-scroller.getBoundingClientRect().top-anchor.offset;});}
function setChatOpen(open){
  if(!open)saveChatLayout();
  $('.workspace').classList.toggle('chat-collapsed',!open);
  $('#chat-panel').hidden=!open;
  $('#chat-open').hidden=open;
  $('#chat-open').setAttribute('aria-expanded',open);
  $('#chat-collapse').setAttribute('aria-expanded',open);
  if(open)applyChatLayout(chatLayout||readChatLayout());
}
$('#view-english').onclick=()=>setReadingMode('english');
$('#view-chinese').onclick=()=>setReadingMode('chinese');
$('#view-bilingual').onclick=()=>setReadingMode('bilingual');
$('#chat-collapse').onclick=()=>{setChatOpen(false);$('#chat-open').focus({preventScroll:true})};
$('#chat-open').onclick=()=>{setChatOpen(true);$('#message-input').focus({preventScroll:true})};

function setOutlineOpen(open){$('#paper-outline').hidden=!open;$('#outline-toggle').setAttribute('aria-expanded',open)}
$('#outline-toggle').onclick=()=>setOutlineOpen($('#paper-outline').hidden);
$('#outline-close').onclick=()=>{setOutlineOpen(false);$('#outline-toggle').focus({preventScroll:true})};
document.querySelectorAll('#paper-outline [data-page]').forEach(button=>button.addEventListener('click',()=>setOutlineOpen(false)));
document.addEventListener('pointerdown',event=>{if(!event.target.closest('.outline-float'))setOutlineOpen(false)});
document.addEventListener('keydown',event=>{if(event.key==='Escape')setOutlineOpen(false)});

// The assistant floats above the reader; its geometry never changes paper width.
const chatLayoutKey='critical-paper-reader-chat-layout-v1';
let chatLayout=null,chatGesture=null;
try{const saved=JSON.parse(localStorage.getItem(chatLayoutKey));if(saved&&['left','top','width','height'].every(k=>Number.isFinite(saved[k]))&&saved.width>0&&saved.height>0)chatLayout=saved}catch{}
function readChatLayout(){const r=$('#chat-panel').getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height}}
function applyChatLayout(layout){
  const maxWidth=Math.max(1,innerWidth-16),maxHeight=Math.max(1,innerHeight-16);
  const width=Math.max(Math.min(320,maxWidth),Math.min(layout.width,maxWidth)),height=Math.max(Math.min(340,maxHeight),Math.min(layout.height,maxHeight));
  const fitted={left:Math.max(8,Math.min(layout.left,innerWidth-width-8)),top:Math.max(8,Math.min(layout.top,innerHeight-height-8)),width,height};
  Object.entries(fitted).forEach(([key,value])=>$('#chat-panel').style[key]=value+'px');$('#chat-panel').style.right='auto';
}
function saveChatLayout(){if($('#chat-panel').hidden)return;chatLayout=readChatLayout();try{localStorage.setItem(chatLayoutKey,JSON.stringify(chatLayout))}catch{}}
[['#chat-drag-handle','move'],['#chat-resize-handle','resize']].forEach(([selector,kind])=>{
  const handle=$(selector);
  handle.addEventListener('pointerdown',e=>{
    if(e.button!==0||(kind==='move'&&e.target.closest('button')))return;
    e.preventDefault();chatGesture={kind,x:e.clientX,y:e.clientY,layout:readChatLayout(),pointerId:e.pointerId};handle.setPointerCapture(e.pointerId);$('#chat-panel').classList.add('adjusting');
  });
  handle.addEventListener('pointermove',e=>{
    if(!chatGesture||e.pointerId!==chatGesture.pointerId)return;
    const {kind,x,y,layout}=chatGesture,dx=e.clientX-x,dy=e.clientY-y;
    if(kind==='move')applyChatLayout({...layout,left:layout.left+dx,top:layout.top+dy});
    else applyChatLayout({...layout,width:Math.min(layout.width+dx,innerWidth-layout.left-8),height:Math.min(layout.height+dy,innerHeight-layout.top-8)});
  });
  const finish=e=>{if(!chatGesture||e.pointerId!==chatGesture.pointerId)return;chatGesture=null;$('#chat-panel').classList.remove('adjusting');saveChatLayout();if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId)};
  handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);
});
$('#chat-resize-handle').addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
  e.preventDefault();const r=readChatLayout(),step=e.shiftKey?40:10;
  applyChatLayout({...r,width:Math.min(r.width+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),innerWidth-r.left-8),height:Math.min(r.height+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0),innerHeight-r.top-8)});saveChatLayout();
});
window.addEventListener('resize',()=>{if(!$('#chat-panel').hidden)applyChatLayout(chatLayout||readChatLayout())});
applyChatLayout(chatLayout||readChatLayout());
