/* Common field feedback. Validation never sends data or changes model inputs. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
function reveal(field){
 for(let parent=field.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
 field.scrollIntoView({block:'center',behavior:'auto'});field.focus({preventScroll:true});
}
function label(field){return field.getAttribute('aria-label')||field.closest('label')?.childNodes[0]?.textContent.trim()||document.querySelector('label[for="'+field.id+'"]')?.textContent.trim()||field.id||'This entry';}
function clear(field){
 if(field.dataset.uiInvalid!=='true')return;
 field.removeAttribute('aria-invalid');delete field.dataset.uiInvalid;
 const hint=$(field.id+'-ui-error');if(hint)hint.remove();
 const described=(field.getAttribute('aria-describedby')||'').split(' ').filter(id=>id!==field.id+'-ui-error').join(' ');
 if(described)field.setAttribute('aria-describedby',described);else field.removeAttribute('aria-describedby');
}
function mark(field,message){
 if(!field)return;clear(field);field.setAttribute('aria-invalid','true');field.dataset.uiInvalid='true';
 const hint=document.createElement('small');hint.id=field.id+'-ui-error';hint.className='ui-field-error';hint.textContent=message;
 field.insertAdjacentElement('afterend',hint);
 field.setAttribute('aria-describedby',((field.getAttribute('aria-describedby')||'')+' '+hint.id).trim());
}
function feedback(scope,issues,message){
 let box=scope.querySelector(':scope > .ui-feedback');
 if(!box){box=document.createElement('div');box.className='ui-feedback';box.setAttribute('role','alert');box.tabIndex=-1;const header=scope.querySelector(':scope > .setup-chrome, :scope > header, :scope > summary');if(header)header.insertAdjacentElement('afterend',box);else scope.prepend(box);}
 box.hidden=false;box.replaceChildren();
 const title=document.createElement('strong');title.textContent=message||'Check '+issues.length+' '+(issues.length===1?'entry':'entries')+' below, then try again.';box.append(title);
 if(issues.length){const list=document.createElement('ul');for(const {field,message:text} of issues){mark(field,text);const item=document.createElement('li'),link=document.createElement('a');link.href='#'+field.id;link.textContent=label(field)+': '+text;link.onclick=event=>{event.preventDefault();reveal(field);};item.append(link);list.append(item);}box.append(list);reveal(issues[0].field);}else{box.scrollIntoView({block:'center'});box.focus({preventScroll:true});}
 return false;
}
function validate(scope){
 const issues=[];
 for(const field of scope.querySelectorAll('input,select,textarea')){
  // Closed details can contain editable settings; hidden conditional sections cannot.
  const conditional=field.closest('[hidden]');if(field.disabled||conditional||field.type==='hidden'||!field.willValidate)continue;
  clear(field);
  if(!field.validity.valid)issues.push({field,message:field.validity.valueMissing?'Enter a value.':field.validity.rangeUnderflow?'Use '+field.min+' or more.':field.validity.rangeOverflow?'Use '+field.max+' or less.':field.validity.stepMismatch?'Use increments of '+(field.step||1)+'.':'Enter a valid value.'});
 }
 const box=scope.querySelector(':scope > .ui-feedback');if(box)box.hidden=true;
 if(issues.length&&scope.id==='personalform'&&$('cloudfeedback'))$('cloudfeedback').textContent='Check the highlighted entries, then save again. Your draft is preserved.';
 return !issues.length||feedback(scope,issues);
}
window.BearUI={validate,feedback,mark,reveal,clear,clearFeedback:()=>document.querySelectorAll('.ui-feedback').forEach(box=>box.hidden=true)};
document.addEventListener('input',event=>{clear(event.target);for(let scope=event.target.parentElement;scope;scope=scope.parentElement){const box=scope.querySelector(':scope > .ui-feedback');if(box&&!scope.querySelector('[data-ui-invalid=true]'))box.hidden=true;}});
document.addEventListener('submit',event=>{if(!validate(event.target)){event.preventDefault();event.stopImmediatePropagation();}},true);
const scopes={personalpreview:'personalform',recommend:'advisorinput',refreshresults:'advisorinput',optimizewaves:'advisorinput',strategycommit:'strategyeditor',savemember:'membereditor',applystock:'trooptab',savecalibration:'timingcalibration',savedistance:'distancecutoffcontrols'};
document.addEventListener('click',event=>{const button=event.target.closest('button'),scope=$(scopes[button?.id]);if(scope&&!validate(scope)){event.preventDefault();event.stopImmediatePropagation();}},true);
document.querySelectorAll('.scroll').forEach(area=>{area.tabIndex=0;area.setAttribute('role','region');area.setAttribute('aria-label',area.querySelector('caption')?.textContent||'Scrollable table');});
// Preserve the selected player when moving between their setup and their history.
const player=new URLSearchParams(location.search).get('player');
if(player&&/^\d+$/.test(player)){for(const a of document.querySelectorAll('.app-nav a'))if(/(?:optimize-me|kvk-planner|history)\.html/.test(a.getAttribute('href')))a.href=a.getAttribute('href').split('?')[0]+'?player='+encodeURIComponent(player);}
})();
