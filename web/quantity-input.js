/* Quick quantity changes share the existing inputs, validation and draft saving. */
(function(){
'use strict';
const form=document.getElementById('kvkform');
if(!form)return;
let active=null,opener=null;
const panel=document.createElement('section');
panel.id='quantity-adjustments';panel.className='quantity-panel';panel.hidden=true;
panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','quantity-title');
panel.innerHTML='<div class="quantity-heading"><h2 id="quantity-title">Adjust quantity</h2><button type="button" class="quantity-close" aria-label="Close quantity adjustments">×</button></div><output class="quantity-value" aria-live="polite"></output><div class="quantity-buttons" aria-label="Add quantity"></div><div class="quantity-buttons quantity-subtract" aria-label="Subtract quantity"></div><p class="quantity-hint">Or type the exact amount in the field.</p>';
document.body.append(panel);
function nameOf(field){
 if(field.getAttribute('aria-label'))return field.getAttribute('aria-label');
 const label=field.closest('label');
 if(label){const copy=label.cloneNode(true);copy.querySelectorAll('input,button,select').forEach(n=>n.remove());const context=field.closest('.kvk-wallet,.kvk-offer')?.querySelector('h3,h4')?.textContent.trim();return [context,copy.textContent.trim()].filter(Boolean).join(' · ');}
 const cell=field.closest('td'),row=cell?.parentElement,table=cell?.closest('table');
 if(row&&table)return [row.querySelector('th,td')?.textContent,table.tHead?.rows[0]?.cells[cell.cellIndex]?.textContent].filter(Boolean).join(' · ');
 return 'Quantity';
}
function close(restore=false){
 panel.hidden=true;opener?.setAttribute('aria-expanded','false');
 if(restore&&opener?.isConnected)opener.focus();
 active=null;opener=null;
}
function position(){
 if(!active?.isConnected){close();return;}
 const anchor=opener.getBoundingClientRect(),width=Math.min(304,innerWidth-24);
 if(anchor.bottom<0||anchor.top>innerHeight){close();return;}
 panel.style.width=width+'px';
 panel.style.left=Math.max(12,Math.min(anchor.right-width,innerWidth-width-12))+'px';
 const height=panel.offsetHeight;
 panel.style.top=Math.max(12,Math.min(anchor.bottom+8,innerHeight-height-12))+'px';
}
function value(){return active.value===''?0:active.valueAsNumber;}
function allowed(delta){
 const current=value(),next=current+delta;
 return !active.disabled&&!active.readOnly&&!active.validity.badInput&&Number.isSafeInteger(current)&&Number.isSafeInteger(next)&&next>=Number(active.min||0)&&next<=(active.max===''?Number.MAX_SAFE_INTEGER:Number(active.max));
}
function refresh(){
 if(!active)return;
 panel.querySelector('output').textContent=active.value===''?'Not set':Number.isFinite(value())?value().toLocaleString():active.value;
 for(const button of panel.querySelectorAll('[data-quantity-delta]'))button.disabled=!allowed(Number(button.dataset.quantityDelta));
}
function open(field,button){
 if(opener===button){close(true);return;}
 close();active=field;opener=button;
 document.getElementById('quantity-title').textContent=nameOf(field);
 const range=Number(field.max||Number.MAX_SAFE_INTEGER)-Number(field.min||0),steps=[1,10,100].filter(step=>step<=range);
 for(const [index,direction]of [1,-1].entries()){
  const group=panel.querySelectorAll('.quantity-buttons')[index];
  group.replaceChildren(...steps.map(step=>{
   const b=document.createElement('button'),delta=step*direction;
   b.type='button';b.dataset.quantityDelta=delta;b.textContent=(direction>0?'+':'−')+step;
   b.setAttribute('aria-label',(direction>0?'Add ':'Subtract ')+step);
   b.onclick=()=>{
    if(!allowed(delta))return;
    active.value=String(value()+delta);
    active.dispatchEvent(new Event('input',{bubbles:true}));
    refresh();
   };
   return b;
  }));
 }
 button.setAttribute('aria-expanded','true');panel.hidden=false;refresh();position();
 (panel.querySelector('[data-quantity-delta]:not(:disabled)')||panel.querySelector('.quantity-close')).focus({preventScroll:true});
}
function enhance(){
 if(active&&!active.isConnected)close();
 for(const field of form.querySelectorAll('input[type=number]')){
  if(field.parentElement.classList.contains('quantity-input')||field.disabled||field.readOnly)continue;
  const wrapper=document.createElement('span'),button=document.createElement('button');
  wrapper.className='quantity-input';button.type='button';button.className='quantity-adjust';button.textContent='±';
  button.setAttribute('aria-label','Adjust '+nameOf(field));button.setAttribute('aria-haspopup','dialog');
  button.setAttribute('aria-controls',panel.id);button.setAttribute('aria-expanded','false');button.title='Quick add or subtract';
  field.before(wrapper);wrapper.append(field,button);button.onclick=()=>{if(!field.disabled&&!field.readOnly)open(field,button);};
 }
}
panel.querySelector('.quantity-close').onclick=()=>close(true);
document.addEventListener('pointerdown',e=>{if(active&&!panel.contains(e.target)&&!opener.contains(e.target))close();});
document.addEventListener('keydown',e=>{if(active&&e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);}});
document.addEventListener('focusin',e=>{if(active&&!panel.contains(e.target)&&e.target!==active&&e.target!==opener)close();});
form.addEventListener('toggle',()=>{if(active&&active.closest('details:not([open])'))close();},true);
form.addEventListener('input',e=>{if(e.target===active)refresh();});
window.addEventListener('resize',()=>{if(active)position();});
document.addEventListener('scroll',e=>{if(active&&!panel.contains(e.target))position();},true);
new MutationObserver(enhance).observe(form,{childList:true,subtree:true});
enhance();
})();
