(function(){
  'use strict';
  const tabs=Array.from(document.querySelectorAll('.guide-tabs [role="tab"]'));
  if(!tabs.length)return;
  function select(tab,focus=false){
    for(const item of tabs){
      const active=item===tab;
      item.setAttribute('aria-selected',String(active));
      item.tabIndex=active?0:-1;
      document.getElementById(item.getAttribute('aria-controls')).hidden=!active;
    }
    if(focus)tab.focus();
  }
  for(const [index,tab]of tabs.entries()){
    tab.addEventListener('click',()=>select(tab));
    tab.addEventListener('keydown',event=>{
      let next;
      if(event.key==='ArrowRight')next=(index+1)%tabs.length;
      else if(event.key==='ArrowLeft')next=(index-1+tabs.length)%tabs.length;
      else if(event.key==='Home')next=0;
      else if(event.key==='End')next=tabs.length-1;
      else return;
      event.preventDefault();select(tabs[next],true);
    });
  }
  select(tabs[0]);
  document.getElementById('guide-tabs').hidden=false;
})();
