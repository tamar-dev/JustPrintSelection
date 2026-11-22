const t = uiText;
const uiLang = chrome.i18n.getUILanguage();
document.documentElement.lang = uiLang;
document.documentElement.dir = /^(he|ar|fa|ur)(-|$)/i.test(uiLang) ? 'rtl' : 'ltr';
const labels = {en:{undo:'Undo',redo:'Redo',add:'Add text',remove:'Remove',hint:'Select text to format it. Edit text directly. Select an image and press Delete or Backspace to remove it. Use Ctrl+Z to undo and Ctrl+P to print.'},he:{undo:'בטל',redo:'בצע שוב',add:'הוסף טקסט',remove:'הסר',hint:'סמנו טקסט כדי לעצב אותו. ניתן לערוך ישירות. בחרו תמונה ולחצו Delete או Backspace להסרה. Ctrl+Z לביטול ו־Ctrl+P להדפסה.'}};
const l = labels[uiLang.split(/[-_]/)[0].toLowerCase()] || labels.en;
for (const [id,value] of [['print-label',t('printButton')],['undo-label',l.undo],['redo-label',l.redo],['add-label',l.add],['remove-label',l.remove],['hint',l.hint]]) document.getElementById(id).textContent=value;
const formattingLabels=uiLang.toLowerCase().startsWith('he')?{size:'גודל',color:'צבע',bold:'מודגש',italic:'נטוי',underline:'קו תחתון'}:{size:'Size',color:'Color',bold:'Bold',italic:'Italic',underline:'Underline'};
for(const [id,value] of [['font-size-label',formattingLabels.size],['font-color-label',formattingLabels.color]])document.getElementById(id).textContent=value;
for(const key of ['bold','italic','underline'])document.getElementById(key).setAttribute('aria-label',formattingLabels[key]);
const content=document.getElementById('content');
const isHebrew=uiLang.split(/[-_]/)[0].toLowerCase()==='he';
content.setAttribute('aria-label',isHebrew?'תוכן להדפסה שניתן לערוך':'Editable print content');
for(const key of ['bold','italic','underline']){
  const button=document.getElementById(key);
  button.setAttribute('title',formattingLabels[key]+' (Ctrl+'+key[0].toUpperCase()+')');
}
document.getElementById('font-size').setAttribute('aria-label',isHebrew?'גודל גופן':'Font size');
document.getElementById('font-color').setAttribute('aria-label',isHebrew?'צבע טקסט':'Text color');
const status=document.getElementById('status');
const undoButton=document.getElementById('undo'), redoButton=document.getElementById('redo');
let history=[],position=-1,selectedImage=null,restoring=false,recordTimer,savedRange=null;
const blockTags=new Set(['P','DIV','SECTION','ARTICLE','HEADER','FOOTER','MAIN','H1','H2','H3','H4','H5','H6','UL','OL','LI','BLOCKQUOTE','PRE','TABLE','FIGURE','FIGCAPTION','DL','DT','DD','IMG']);
const deleteBlockButton=document.getElementById('delete-block');
let hoveredBlock=null;
function pickBlock(target){
  if(!(target instanceof Element)||!content.contains(target))return null;
  let current=target;
  while(current&&current!==content){if(blockTags.has(current.tagName))return current;current=current.parentElement;}
  return null;
}
function hideBlockAction(){if(hoveredBlock)hoveredBlock.classList.remove('block-hover-target');hoveredBlock=null;deleteBlockButton.hidden=true;}
function showBlockAction(block){
  if(!block||!block.isConnected){hideBlockAction();return;}
  if(hoveredBlock&&hoveredBlock!==block)hoveredBlock.classList.remove('block-hover-target');
  hoveredBlock=block;
  hoveredBlock.classList.add('block-hover-target');
  const rect=block.getBoundingClientRect();
  if(!rect.width||!rect.height){hideBlockAction();return;}
  deleteBlockButton.hidden=false;
  const width=deleteBlockButton.offsetWidth||30;
  deleteBlockButton.style.left=Math.max(4,Math.min(window.innerWidth-width-4,rect.right-width))+'px';
  deleteBlockButton.style.top=Math.max(4,Math.min(window.innerHeight-36,rect.top+4))+'px';
}
content.addEventListener('pointermove',event=>{
  if(event.pointerType==='touch')return;
  const block=pickBlock(event.target);
  if(block!==hoveredBlock)showBlockAction(block);
});
content.addEventListener('pointerleave',event=>{if(event.relatedTarget!==deleteBlockButton)hideBlockAction();});
deleteBlockButton.addEventListener('click',()=>{
  if(!hoveredBlock||!content.contains(hoveredBlock))return;
  clearTimeout(recordTimer);snapshot();
  const block=hoveredBlock;hideBlockAction();block.remove();snapshot();
  // The contextual delete button becomes hidden; move focus to a stable control.
  // Otherwise Chrome can route Ctrl+Z to the browser instead of this editor.
  undoButton.focus({preventScroll:true});
});
deleteBlockButton.addEventListener('pointerleave',()=>hideBlockAction());
window.addEventListener('scroll',()=>{if(hoveredBlock)showBlockAction(hoveredBlock);},{passive:true});
window.addEventListener('resize',hideBlockAction);
function prepareImages(){for(const img of content.querySelectorAll('img')){img.tabIndex=0;img.setAttribute('aria-label',(img.alt||(isHebrew?'תמונה':'Image'))+(isHebrew?' — Enter לבחירה, Delete למחיקה':' — Enter to select, Delete to remove'));}}
function removeSelectedImage(){if(!selectedImage)return false;clearTimeout(recordTimer);snapshot();const image=selectedImage;clearImageSelection();image.remove();snapshot();content.focus();return true;}
function clearImageSelection(){ if(selectedImage) selectedImage.classList.remove('selected-for-removal'); selectedImage=null; }
// Strip editor-only highlighting from serialized markup without cloning the entire DOM.
function historyHtml(){
  return content.innerHTML.replace(/\\sclass="([^"]*)"/g,(attribute,classes)=>{
    const remaining=classes.split(/\\s+/).filter(name=>name&&name!=='selected-for-removal'&&name!=='block-hover-target');
    return remaining.length?' class="'+remaining.join(' ')+'"':'';
  });
}
function snapshot(){
  if(restoring)return;
  const html=historyHtml();
  if(history[position]===html)return;
  history=history.slice(0,position+1);
  history.push(html);
  if(history.length>80)history.shift();
  position=history.length-1;
  refresh();
}
function refresh(){undoButton.disabled=position<=0;redoButton.disabled=position>=history.length-1;}
function flushPendingEdit(){if(recordTimer){clearTimeout(recordTimer);recordTimer=null;snapshot();}}
function undo(){flushPendingEdit();restore(position-1);}
function redo(){flushPendingEdit();restore(position+1);}
function restore(next){if(next<0||next>=history.length)return;const scrollX=window.scrollX,scrollY=window.scrollY;restoring=true;hideBlockAction();clearImageSelection();savedRange=null;content.innerHTML=history[next];prepareImages();position=next;refresh();restoring=false;window.scrollTo(scrollX,scrollY);}
function safeTextStyle(style){
  const result=[];
  for(const declaration of style.split(';')){
    const colon=declaration.indexOf(':');if(colon<0)continue;
    const property=declaration.slice(0,colon).trim().toLowerCase();
    const value=declaration.slice(colon+1).trim().toLowerCase();
    if(property==='font-size'&&/^(?:[8-9]|[1-6][0-9]|7[0-2])px$/.test(value))result.push('font-size:'+value);
    if(property==='color'&&(/^#[0-9a-f]{3,8}$/.test(value)||/^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/.test(value)))result.push('color:'+value);
    if(property==='font-weight'&&/^(bold|normal|[1-9]00)$/.test(value))result.push('font-weight:'+value);
    if(property==='font-style'&&/^(italic|normal)$/.test(value))result.push('font-style:'+value);
    if(property==='text-decoration'&&/^(underline|none|line-through)$/.test(value))result.push('text-decoration:'+value);
  }
  return result.join(';');
}
function sanitize(parent){
  const tags=new Set(['DIV','SPAN','P','BR','B','STRONG','I','EM','U','S','SMALL','SUB','SUP','H1','H2','H3','H4','H5','H6','UL','OL','LI','BLOCKQUOTE','PRE','CODE','HR','TABLE','THEAD','TBODY','TFOOT','TR','TH','TD','CAPTION','A','IMG','SECTION','ARTICLE','HEADER','FOOTER','MAIN','FIGURE','FIGCAPTION','DL','DT','DD']);
  const attrs=new Set(['dir','lang','title','alt','colspan','rowspan']);
  for(const node of [...parent.childNodes]){
    if(node.nodeType===Node.COMMENT_NODE){node.remove();continue;}
    if(node.nodeType!==Node.ELEMENT_NODE)continue;
    if(!tags.has(node.tagName)){if(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','TEMPLATE','FORM'].includes(node.tagName)){node.remove();}else{node.replaceWith(...node.childNodes);sanitize(parent);}continue;}
    for(const attr of [...node.attributes]){
      const name=attr.name.toLowerCase(),value=attr.value;
      let safe=false;
      if(node.tagName==='IMG'&&name==='src'){try{const u=new URL(value);safe=['http:','https:'].includes(u.protocol)||/^data:image\/(png|jpeg|gif|webp);base64,/i.test(value);}catch{}}
      if(node.tagName==='A'&&name==='href'){try{safe=['http:','https:'].includes(new URL(value).protocol);}catch{}}
      if(name==='style'&&node.tagName!=='IMG'){
        const clean=safeTextStyle(value);
        if(clean)node.setAttribute('style',clean);else node.removeAttribute('style');
      }else if(!attrs.has(name)&&!safe)node.removeAttribute(attr.name);
    }
    sanitize(node);
  }
}
function cleanHtml(html){const parsed=new DOMParser().parseFromString(html,'text/html');sanitize(parsed.body);return parsed.body.innerHTML;}

// Keep a text selection while the user operates toolbar controls.
function selectionInEditor(){
  const selection=window.getSelection();
  if(!selection||selection.rangeCount===0)return null;
  const range=selection.getRangeAt(0);
  return content.contains(range.commonAncestorContainer)?range:null;
}
document.addEventListener('selectionchange',()=>{
  const range=selectionInEditor();
  if(range&&!range.collapsed)savedRange=range.cloneRange();
});
function restoreTextSelection(){
  const range=savedRange;
  if(!range||range.collapsed||!range.commonAncestorContainer.isConnected||!content.contains(range.commonAncestorContainer))return false;
  content.focus();
  const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
  return true;
}
function formatSelection(command,value){
  if(!restoreTextSelection())return;
  clearTimeout(recordTimer);snapshot();
  if(command==='fontSize'){
    const selection=window.getSelection();
    const range=selection.getRangeAt(0);
    const wrapper=document.createElement('span');
    wrapper.style.fontSize=Number(value)+'px';
    wrapper.appendChild(range.extractContents());
    range.insertNode(wrapper);
    selection.removeAllRanges();
    const newRange=document.createRange();
    newRange.selectNodeContents(wrapper);
    selection.addRange(newRange);
  }else{
    document.execCommand('styleWithCSS',false,'true');
    document.execCommand(command,false,value);
  }
  savedRange=null;snapshot();
}
for(const command of ['bold','italic','underline']){
  document.getElementById(command).addEventListener('click',()=>formatSelection(command));
}
document.getElementById('font-color').addEventListener('change',event=>formatSelection('foreColor',event.target.value));
document.getElementById('font-size').addEventListener('change',event=>formatSelection('fontSize',event.target.value));
// Keep selection on toolbar button presses; native buttons remain keyboard-accessible.
for(const button of document.querySelectorAll('.toolbar button')){
  if(['bold','italic','underline'].includes(button.id))button.addEventListener('mousedown',event=>event.preventDefault());
}

content.addEventListener('input',()=>{clearTimeout(recordTimer);recordTimer=setTimeout(()=>{recordTimer=null;snapshot();},250);});
content.addEventListener('focusin',event=>{if(event.target instanceof HTMLImageElement){clearImageSelection();selectedImage=event.target;selectedImage.classList.add('selected-for-removal');}});
content.addEventListener('click',event=>{const image=event.target.closest?.('img');clearImageSelection();if(image&&content.contains(image)){selectedImage=image;image.classList.add('selected-for-removal');}});
content.addEventListener('paste',event=>{event.preventDefault();const text=event.clipboardData?.getData('text/plain')||'';const selection=window.getSelection();if(!selection?.rangeCount)return;const range=selection.getRangeAt(0);if(!content.contains(range.commonAncestorContainer))return;range.deleteContents();const node=document.createTextNode(text);range.insertNode(node);range.setStartAfter(node);range.collapse(true);selection.removeAllRanges();selection.addRange(range);snapshot();});
document.getElementById('remove').addEventListener('click',()=>{
  clearTimeout(recordTimer);
  if(removeSelectedImage())return;
  const selection=window.getSelection();if(!selection?.rangeCount||selection.isCollapsed)return;
  const range=selection.getRangeAt(0);if(!content.contains(range.commonAncestorContainer))return;
  range.deleteContents();snapshot();content.focus();
});
document.addEventListener('keydown',event=>{
  const key=event.key.toLowerCase();
  // event.code remains KeyZ/KeyY with Hebrew and other keyboard layouts.
  const shortcut=event.code.startsWith('Key')?event.code.slice(3).toLowerCase():key;
  const modifier=(event.ctrlKey||event.metaKey)&&!event.altKey;
  if(modifier&&shortcut==='p'){event.preventDefault();document.getElementById('print').click();return;}
  if(modifier&&['b','i','u'].includes(shortcut)&&selectionInEditor()){
    event.preventDefault();formatSelection({b:'bold',i:'italic',u:'underline'}[shortcut]);return;
  }
  if(modifier&&(shortcut==='z'||shortcut==='y')){
    const target=event.target;
    const isEditableOutsideEditor=target instanceof HTMLElement&&
      !content.contains(target)&&target!==content&&
      (target.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target.tagName));
    if(!isEditableOutsideEditor){
      event.preventDefault();
      if(shortcut==='z'&&!event.shiftKey)undo();
      else if(shortcut==='y'||(shortcut==='z'&&event.shiftKey))redo();
    }
    return;
  }
  if(event.altKey||event.ctrlKey||event.metaKey)return;
  if((key==='delete'||key==='backspace')&&selectedImage){
    event.preventDefault();removeSelectedImage();return;
  }
  if((key==='enter'||key===' ')&&event.target instanceof HTMLImageElement&&content.contains(event.target)){
    event.preventDefault();clearImageSelection();selectedImage=event.target;selectedImage.classList.add('selected-for-removal');
  }
});
document.getElementById('add-text').addEventListener('click',()=>{clearImageSelection();const p=document.createElement('p');p.appendChild(document.createElement('br'));content.appendChild(p);snapshot();content.focus();const range=document.createRange();range.selectNodeContents(p);range.collapse(true);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);});
undoButton.addEventListener('click',undo);
redoButton.addEventListener('click',redo);
document.getElementById('print').addEventListener('click',()=>{clearTimeout(recordTimer);snapshot();hideBlockAction();clearImageSelection();window.print();});
(async()=>{
 const id=new URLSearchParams(location.search).get('id');
 if(!id||!/^[a-f0-9-]{36}$/i.test(id))throw new Error(t('invalidJob'));
 const key='print_'+id;const result=await chrome.storage.local.get(key);const payload=result[key];
 if(!payload)throw new Error(t('missingJob'));
 await chrome.storage.local.remove(key);
 document.title=t('printPageTitle');
 content.dir=['ltr','rtl','auto'].includes(payload.direction)?payload.direction:'auto';
 content.innerHTML=cleanHtml(payload.html);
 prepareImages();
 snapshot();
})().catch(err=>{status.textContent=t('printError')+': '+err.message;content.contentEditable='false';});
