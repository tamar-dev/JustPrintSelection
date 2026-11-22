const t = uiText;
const uiLang = chrome.i18n.getUILanguage();
document.documentElement.lang = uiLang;
document.documentElement.dir = /^(he|ar|fa|ur)(-|$)/i.test(uiLang) ? 'rtl' : 'ltr';
const labels = {en:{undo:'Undo',redo:'Redo',add:'Add text',remove:'Remove',hint:'Edit text directly. Click an image to select it, then Remove. Select text to delete it.'},he:{undo:'בטל',redo:'בצע שוב',add:'הוסף טקסט',remove:'הסר',hint:'ניתן לערוך את הטקסט ישירות. לחצו על תמונה כדי לבחור אותה ואז על הסר. אפשר גם לסמן טקסט ולמחוק אותו.'}};
const l = labels[uiLang.split(/[-_]/)[0].toLowerCase()] || labels.en;
for (const [id,value] of [['print-label',t('printButton')],['undo-label',l.undo],['redo-label',l.redo],['add-label',l.add],['remove-label',l.remove],['hint',l.hint]]) document.getElementById(id).textContent=value;
const content=document.getElementById('content');
const status=document.getElementById('status');
const undoButton=document.getElementById('undo'), redoButton=document.getElementById('redo');
let history=[],position=-1,selectedImage=null,restoring=false,recordTimer;
function clearImageSelection(){ if(selectedImage) selectedImage.classList.remove('selected-for-removal'); selectedImage=null; }
function snapshot(){if(restoring)return;const html=content.innerHTML.replace(/ class="selected-for-removal"/g,'');if(history[position]===html)return;history=history.slice(0,position+1);history.push(html);if(history.length>80)history.shift();position=history.length-1;refresh();}
function refresh(){undoButton.disabled=position<=0;redoButton.disabled=position>=history.length-1;}
function restore(next){if(next<0||next>=history.length)return;restoring=true;clearImageSelection();content.innerHTML=history[next];position=next;refresh();restoring=false;content.focus();}
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
      if(!attrs.has(name)&&!safe)node.removeAttribute(attr.name);
    }
    sanitize(node);
  }
}
function cleanHtml(html){const parsed=new DOMParser().parseFromString(html,'text/html');sanitize(parsed.body);return parsed.body.innerHTML;}
content.addEventListener('input',()=>{clearTimeout(recordTimer);recordTimer=setTimeout(snapshot,250);});
content.addEventListener('click',event=>{const image=event.target.closest?.('img');clearImageSelection();if(image&&content.contains(image)){selectedImage=image;image.classList.add('selected-for-removal');}});
content.addEventListener('paste',event=>{event.preventDefault();const text=event.clipboardData?.getData('text/plain')||'';const selection=window.getSelection();if(!selection?.rangeCount)return;const range=selection.getRangeAt(0);if(!content.contains(range.commonAncestorContainer))return;range.deleteContents();const node=document.createTextNode(text);range.insertNode(node);range.setStartAfter(node);range.collapse(true);selection.removeAllRanges();selection.addRange(range);snapshot();});
document.getElementById('remove').addEventListener('click',()=>{
  clearTimeout(recordTimer);
  if(selectedImage){selectedImage.remove();selectedImage=null;snapshot();return;}
  const selection=window.getSelection();if(!selection?.rangeCount||selection.isCollapsed)return;
  const range=selection.getRangeAt(0);if(!content.contains(range.commonAncestorContainer))return;
  range.deleteContents();snapshot();content.focus();
});
document.getElementById('add-text').addEventListener('click',()=>{clearImageSelection();const p=document.createElement('p');p.appendChild(document.createElement('br'));content.appendChild(p);snapshot();content.focus();const range=document.createRange();range.selectNodeContents(p);range.collapse(true);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);});
undoButton.addEventListener('click',()=>{clearTimeout(recordTimer);snapshot();restore(position-1);});
redoButton.addEventListener('click',()=>{clearTimeout(recordTimer);restore(position+1);});
document.getElementById('print').addEventListener('click',()=>{clearTimeout(recordTimer);snapshot();clearImageSelection();window.print();});
(async()=>{
 const id=new URLSearchParams(location.search).get('id');
 if(!id||!/^[a-f0-9-]{36}$/i.test(id))throw new Error(t('invalidJob'));
 const key='print_'+id;const result=await chrome.storage.local.get(key);const payload=result[key];
 if(!payload)throw new Error(t('missingJob'));
 await chrome.storage.local.remove(key);
 document.title=t('printPageTitle');
 content.dir=payload.direction||'auto';
 content.innerHTML=cleanHtml(payload.html);
 snapshot();
})().catch(err=>{status.textContent=t('printError')+': '+err.message;content.contentEditable='false';});
