import {createGame,tick,nearby,interaction,act,toSave,fromSave,objective} from './simulation.js';
import {createRenderer} from './render.js';
import {distance} from './world.js';
import {audibleLines,sayLine,medicalStatus} from './island-life.js';

const $=id=>document.getElementById(id);
const canvas=$('world');
const renderer=createRenderer(canvas);
const saveKey=location.search.includes('debug')?'back-on-the-block-test-v1':'back-on-the-block-v1';
const settingsKey='back-on-the-block-settings';
let settings={motion:!matchMedia('(prefers-reduced-motion: reduce)').matches,music:0.6};
try {settings={...settings,...JSON.parse(localStorage.getItem(settingsKey)||'{}')};}catch{}
let state=createGame();
let playing=false,modalOpen=false,currentPanel=null,previousFocus=null,manualWaypoint=null;
let keys=new Set(),fire=false,fireTap=false,lastTime=performance.now(),hudClock=0,saveClock=0;
let pointer=null,aim=null,savedExists=false;
let street=null,choicePage=0,choiceSignature='',subtitleSignature='';
let hintUntil=0;
const hudElements=['hud','legal','minimap-button','objective','toolbar'];
const choiceCount=3;
const spokenActions = {
  talk: 'How’s your day going?', history: 'Tell me a little about yourself.',
  ask_delivery: 'What have you heard about the clinic runs?', friend_advice: 'What would you do?',
  hangout: 'Got time to hang out?', invite: 'Want to walk with me?', gift: 'Here. I brought you something.',
  apologize: 'I’m sorry about what happened.', romance: 'You want to go out sometime?',
  return_found: 'I think you lost this.', warn_witness: 'Hold on. Can we talk about that call?',
  surrender: 'I’d like to talk about my case.', report_story: 'I have something to report.',
  close: 'See you around.'
};
const touchInput=matchMedia('(any-pointer: coarse)');
function destination(goal) {
  const point=manualWaypoint||goal.target;
  if(point?.interior&&point.interior!==state.player.interior) {
    const place=state.world.buildings.find(b=>b.id===point.interior);
    return place?{...place.door,name:place.name}:point;
  }
  return point;
}
const music=new Audio();
music.loop=true;music.volume=Math.max(0,Math.min(1,Number(settings.music)||0));
let musicURL=null;
const diagnostic=location.search.includes('debug')?document.createElement('output'):null;
if(diagnostic){diagnostic.id='game-diagnostics';diagnostic.hidden=true;document.body.append(diagnostic);}
const seenMessages=new Set();
let lastEndingNotice=null,lastRecoveryNotice=null;
const escapeText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function notify(text,tone='normal') {
  const node=document.createElement('div');node.className=`toast ${tone==='danger'?'bad':tone}`;node.textContent=text;
  $('notifications').append(node);
  while($('notifications').children.length>2)$('notifications').firstElementChild.remove();
  setTimeout(()=>node.remove(),4700);
}
function storageAvailable() {
  try{savedExists=!!localStorage.getItem(saveKey);}catch{savedExists=false;}
  $('continue-button').hidden=!savedExists;
  const first = savedExists ? $('continue-button') : $('new-game');
  selectMenuItem(first);
}
function save(showNotice=false) {
  if(!playing)return;
  try {
    const snapshot=JSON.stringify(toSave(state));
    localStorage.setItem(saveKey,snapshot);
    savedExists=true;
    if(showNotice)notify('Saved. The neighbourhood will be here when you get back.','good');
  } catch {
    notify('Browser storage is unavailable. Use Export save in the pause menu to keep your progress.','bad');
  }
}
function selectMenuItem(item) {
  for(const button of $('main-menu').querySelectorAll('button')) button.classList.toggle('is-selected',button===item);
}
function start(resume=false) {
  try {
    const next=resume?fromSave(JSON.parse(localStorage.getItem(saveKey))):createGame();
    state=next;playing=true;manualWaypoint=null;pointer=null;aim=null;
    seenMessages.clear();lastEndingNotice=null;lastRecoveryNotice=null;
    clearStreet();clearSpeech();$('notifications').replaceChildren();
    $('title-screen').hidden=true;
    for(const id of hudElements) $(id).hidden=false;
    $('touch-controls').hidden=!touchInput.matches;
    hintUntil=state.elapsed+(resume?0:12);
    $('control-hints').hidden=resume||touchInput.matches;
    closeModal();
    canvas.focus({preventScroll:true});
    refreshHUD();
    save();
    if(musicURL&&settings.music>0)music.play().catch(()=>{});
  }catch(error){notify(`Could not open that save. ${error.message}`,'bad');}
}
function openModal(title,kicker='THE NEIGHBOURHOOD',panel=null) {
  if(!modalOpen)previousFocus=document.activeElement;
  clearStreet();document.body.classList.add('dialog-open');
  modalOpen=true;currentPanel=panel;keys.clear();fire=false;fireTap=false;
  $('modal').hidden=false;$('modal-title').textContent=title;$('modal-kicker').textContent=kicker;
  $('modal-content').replaceChildren();$('modal-actions').replaceChildren();
  $('close-modal').focus();
  music.pause();
}
function closeModal() {
  modalOpen=false;currentPanel=null;document.body.classList.remove('dialog-open');
  $('modal').hidden=true;keys.clear();fire=false;fireTap=false;
  if(playing) canvas.focus({preventScroll:true});
  else previousFocus?.focus?.({preventScroll:true});
  if(playing&&musicURL&&settings.music>0)music.play().catch(()=>{});
}
function paragraph(text,className='') {
  const node=document.createElement('p');node.textContent=text;node.className=className;$('modal-content').append(node);return node;
}
function addAction(label,callback,hint='',primary=false,disabled=false) {
  const button=document.createElement('button');button.className=`action-option${primary?' primary':''}`;button.disabled=disabled;
  const main=document.createElement('span');main.textContent=label;button.append(main);
  if(hint){const small=document.createElement('small');small.textContent=hint;button.append(small);}
  button.addEventListener('click',callback);$('modal-actions').append(button);return button;
}
function clearStreet() {
  street=null;choicePage=0;choiceSignature='';
  $('street-actions').hidden=true;document.body.classList.remove('busy-street');
}
function clearSpeech() {
  subtitleSignature='';$('subtitles').replaceChildren();
}
function hearDirect(npc,text) {
  if(text&&npc) sayLine(state,npc,text,'dialogue');
}
function refreshSpeech() {
  const lines=audibleLines(state);
  const signature=lines.map(line=>line.id).join(',');
  if(signature===subtitleSignature)return;
  subtitleSignature=signature;
  const captions=lines.map(line=>{
    const row=document.createElement('div');row.className='caption';row.dataset.kind=line.kind;
    const who=document.createElement('strong');who.textContent=line.speaker+'  ';
    row.append(who,document.createTextNode(line.text));return row;
  });
  $('subtitles').replaceChildren(...captions);
}
function perform(action,targetId=null,target=null) {
  try {
    const npc=target?.kind==='npc'?state.npcs.find(n=>n.id===targetId):null;
    const askedLeave=npc&&action==='invite'&&state.player.companionId===npc.id;
    const result=act(state,action,targetId)||{};
    const medicalAction=action==='call_ambulance'||action==='first_aid';
    if(npc&&!medicalAction) {
      const privateNote=action==='share_past'&&state.journal.find(note=>note.text?.includes('privately:'));
      const line=privateNote?.text?.match(/“(.+)”/)?.[1]||(askedLeave?'Catch you later.':spokenActions[action]);
      if(line) hearDirect(state.player,line);
      if(result.text) hearDirect(npc,result.text);
    }
    if(result.close===false&&target) {
      choiceSignature='';renderStreet();
    } else {
      clearStreet();
      if(modalOpen)closeModal();
      if(result.text&&(!npc||medicalAction))notify(result.text,result.tone||'normal');
    }
    saveClock=0;save();refreshHUD();
  }catch(error){notify(`That action could not finish. ${error.message}`,'bad');console.error(error);}
}
function openInteraction(target) {
  const data=interaction(state,target);
  if(!data)return;
  choicePage=0;choiceSignature='';
  street={target};
  if(target.kind==='npc') {
    const actor=state.npcs.find(n=>n.id===target.id);
    const greeting=data.greeting || data.body.match(/^[“"]([^”"]+)[”"]/)?.[1];
    if(actor&&actor.hp>0&&!actor.medicalHeld&&greeting) {
      hearDirect(actor,greeting.replace(/^[“"]|[”"]$/g,''));
      actor.conversationUntil=state.elapsed+.65;
    }
  }
  renderStreet();
}
function renderStreet() {
  if(!street)return;
  const targets=nearby(state);
  const target=street.target;
  if(!targets.length||(target&&!targets.some(t=>t.id===target.id&&t.kind===target.kind))) {clearStreet();return;}
  const data=target?interaction(state,target):null;
  if(target&&!data){clearStreet();return;}
  let choices,detail='',heading;
  if(target) {
    heading=data.title;
    if(target.kind==='npc') {
      const npc=state.npcs.find(n=>n.id===target.id);
      detail=npc?.identity?.occupation||'';
    } else detail=data.body||'';
    choices=(data.options||[]).filter(opt=>opt.id!=='close').map(opt=>({
      label:opt.label,disabled:!!opt.disabled,hint:opt.hint||'', action:()=>perform(opt.id,target.id,target)
    }));
  } else {
    heading='Nearby';
    choices=targets.map(t=>({label:t.label,hint:t.kind==='npc'?'Speak':t.kind==='building'?'Entrance':t.kind==='vehicle'?'Vehicle':'Inspect',action:()=>openInteraction(t)}));
  }
  const pages=Math.max(1,Math.ceil(choices.length/choiceCount));
  choicePage=Math.min(choicePage,pages-1);
  const page=choices.slice(choicePage*choiceCount,(choicePage+1)*choiceCount);
  const signature=JSON.stringify([heading,detail,choicePage,choices.map(item=>[item.label,item.hint,item.disabled])]);
  if(signature===choiceSignature)return;
  choiceSignature=signature;
  $('street-actions').hidden=false;document.body.classList.add('busy-street');
  $('street-heading').textContent=heading;$('street-detail').textContent=detail;
  const options=page.map((choice,index)=>{
    const button=document.createElement('button');button.className='street-choice';button.disabled=!!choice.disabled;
    const key=document.createElement('kbd');key.textContent=index+1;
    const label=document.createElement('span');label.textContent=choice.label;
    if(choice.hint&&(!target||target.kind!=='npc'||choice.disabled)) {
      const small=document.createElement('small');small.textContent=choice.hint;label.append(small);
    }else if(choice.hint)button.title=choice.hint;
    button.append(key,label);button.onclick=choice.action;return button;
  });
  $('street-options').replaceChildren(...options);
  const more=$('more-options');more.hidden=pages<2;
  if(pages>1){more.textContent=`More  ·  ${choicePage+1}/${pages}   [Q]`;more.onclick=()=>{choicePage=(choicePage+1)%pages;renderStreet();};}
}
function interact() {
  if(!playing||modalOpen||state.player.medicalHeld||state.player.hp<=0)return;
  if(street){clearStreet();return;}
  const targets=nearby(state);
  if(!targets.length){notify('Move closer to a person, door or vehicle.');return;}
  if(targets.length===1){openInteraction(targets[0]);return;}
  street={target:null};choicePage=0;choiceSignature='';renderStreet();
}
function panelTabs(active) {
  const tabs=document.createElement('nav');tabs.className='panel-tabs';tabs.setAttribute('aria-label','Notebook sections');
  for(const [id,label] of [['bag','Bag'],['people','Contacts'],['journal','Notes'],['case','Your record'],['map','Map']]) {
    const button=document.createElement('button');button.textContent=label;button.className=id===active?'active':'';
    button.onclick=()=>showPanel(id);tabs.append(button);
  }
  $('modal-content').append(tabs);
}
function showPanel(id) {
  if(!playing)return;
  const titles={bag:'Inventory',people:'Contacts',journal:'Journal',case:'Police record',map:'Port Lucero'};
  openModal(titles[id]||'Journal','FIELD NOTES',id);panelTabs(id);
  if(id==='bag') {
    const inventory=state.player.inventory;
    const items=[['medkit','First aid kit','Restores health. Keep one for a bad day.','use_medkit'],['snack','Something to eat','A little health and energy.','use_snack'],['ammo','Pistol rounds','Includes ammunition already in the magazine.'],['pistol','Pistol',touchInput.matches?'Equip here and tap the street to aim and fire.':'F to equip or put away. Click or J to fire.','equip']];
    for(const [key,name,detail,action] of items) {
      const row=document.createElement('div');row.className='inventory-row';
      row.innerHTML=`<div><strong>${escapeText(name)} × ${Number(inventory[key]||0)}</strong><br><span class="hint">${escapeText(detail)}</span></div>`;
      if(action){const b=document.createElement('button');b.textContent=action==='equip'?'Equip / stow':'Use';b.disabled=!inventory[key];b.onclick=()=>{act(state,action);save();showPanel(id);};row.append(b);}
      $('modal-content').append(row);
    }
    paragraph('Supplies are available at shops and the clinic. The garage repairs vehicles and sells fuel.','hint');
    if(state.player.companionId)addAction('Ask your companion to head home',()=>perform('dismiss_companion'));
  } else if(id==='people') {
    const known=state.npcs.filter(n=>n.introduced||n.role==='friend');
    paragraph('Spend time together. Keep your promises. Everyone remembers their own version of you.','hint');
    if(!known.length)paragraph('Get out and meet someone. Names will end up here.');
    for(const npc of known) {
      const row=document.createElement('section');row.className='person-row';
      const trust=Number(npc.trust||0);
      row.innerHTML=`<strong>${escapeText(npc.name)}</strong> <span class="hint">${escapeText(npc.role)}</span><div class="detail">${trust>65?'Close':trust>30?'Warming up':trust< -20?'Wary':'Getting to know you'} · trust ${Math.round(trust)}<progress max="200" value="${trust+100}" aria-label="Trust"></progress></div>`;
      const identity=npc.identity;
      if(identity) {
        const about=document.createElement('p');about.className='detail';
        about.textContent=[identity.occupation,identity.languages?.join(' / '),identity.detail].filter(Boolean).join(' · ');row.append(about);
      }
      const memories=(npc.memories||[]).slice(0,3);
      for(const memory of memories){const p=document.createElement('p');p.className='detail';p.textContent=typeof memory==='string'?memory:memory.text||memory.type||'A shared moment';row.append(p);}
      if(npc.sharedPast?.length){const p=document.createElement('p');p.className='detail';p.textContent=`You've shared ${npc.sharedPast.length} personal memories with them.`;row.append(p);}
      if(npc.disclosures?.length){const p=document.createElement('p');p.className='detail';p.textContent=`Personal conversations shared: ${npc.disclosures.length}`;row.append(p);}
      $('modal-content').append(row);
    }
  } else if(id==='journal') {
    paragraph(objective(state).text);
    for(const note of state.journal.slice(0,70)) {
      const row=document.createElement('div');row.className='journal-row';
      const text=typeof note==='string'?note:note.text;
      row.innerHTML=`<time>${typeof note==='object'&&note.day?`DAY ${note.day}`:'A NOTE TO YOURSELF'}</time><p>${escapeText(text)}</p>`;
      $('modal-content').append(row);
    }
  } else if(id==='case') {
    const player=state.player;
    paragraph(`Personal standing  ${Math.round(player.honor||0)}   ·   ${state.policeStatus?.label||'No current alert'}`);
    const records=(state.cases||[]).filter(record=>record.reported||record.witnesses?.some(w=>w.status==='reported'));
    if(!records.length)paragraph('No reports on file.');
    for(const record of records.slice(-12).reverse()) {
      const statements=(record.witnesses||[]).filter(w=>w.status==='reported');
      const descriptions=statements.flatMap(w=>{
        const d=w.description||{};
        return Object.entries(d).filter(([,value])=>value).map(([field,value])=>`${field}: ${value}`);
      });
      const details=[...new Set(descriptions)].join(', ');
      paragraph(`${record.type||'Incident'} · ${record.resolved?'Closed':record.identified?'Identified suspect':'Identity unconfirmed'}${details?' · Reported details: '+details:''}`);
    }
    paragraph('Witnesses can describe what they saw. A report can stay on file after the search ends.','hint');
  } else if(id==='map') {
    const wrap=document.createElement('div');wrap.className='map-wrap';
    const map=document.createElement('canvas');map.width=680;map.height=680;map.setAttribute('aria-label','Town map. The arrow marks your position. A flag marks your current destination.');wrap.append(map);$('modal-content').append(wrap);renderer.drawMap(map,state,true,manualWaypoint||objective(state).target);
    paragraph('The arrow marks you. The flag marks your destination. Choose a place below to pin its door.','hint');
    const places=document.createElement('div');places.className='places';
    const types=['home','cafe','depot','shop','clinic','garage','police','pawn','bar','office'];
    for(const type of types) {
      const building=state.world.buildings.find(b=>b.type===type);if(!building)continue;
      const button=document.createElement('button');button.textContent=`${type.toUpperCase()} / ${building.name}`;
      button.onclick=()=>{manualWaypoint={...building.door,name:building.name};closeModal();notify(`Pinned ${building.name}.`);};places.append(button);
    }
    $('modal-content').append(places);
    if(manualWaypoint)addAction('Clear your map pin',()=>{manualWaypoint=null;closeModal();});
  }
}
function exportSave() {
  const blob=new Blob([JSON.stringify(toSave(state),null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`port-lucero-day-${state.day}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function showPause() {
  if(!playing)return;
  openModal('Paused','PORT LUCERO','pause');
  paragraph(`Day ${state.day||1} · ${$('location').textContent}`);
  addAction('Resume',closeModal,'',true);
  addAction('Save your progress',()=>save(true));
  addAction('Export save',exportSave,'Keep a copy outside this browser');
  addAction('Import save',()=>$('import-save').click());
  addAction('Settings',showSettings);
  addAction('Controls & credits',()=>showCredits(true));
  addAction('Main menu',()=>{
    save();playing=false;document.body.classList.remove('in-car','needs-care');clearStreet();clearSpeech();closeModal();$('notifications').replaceChildren();
    $('title-screen').hidden=false;
    for(const id of [...hudElements,'control-hints','prompt','touch-controls'])$(id).hidden=true;
    storageAvailable();$('continue-button').focus();
  });
}
function storeSettings(){try{localStorage.setItem(settingsKey,JSON.stringify(settings));}catch{}}
function showSettings() {
  openModal('Settings','PORT LUCERO','settings');
  paragraph('Choose a local audio file to play on a loop while you’re on the street.');
  addAction('Preview a background track',()=>$('import-music').click());
  const musicLabel=document.createElement('label');musicLabel.textContent='Music volume';
  const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='1';slider.step='.05';slider.value=settings.music;slider.setAttribute('aria-label','Music volume');slider.oninput=()=>{settings.music=Number(slider.value);music.volume=settings.music;storeSettings();};musicLabel.append(slider);$('modal-content').append(musicLabel);
  addAction(`Extra motion ${settings.motion?'on':'off'}`,()=>{settings.motion=!settings.motion;storeSettings();showSettings();});
  if(musicURL)addAction('Remove preview track',()=>{music.pause();music.removeAttribute('src');URL.revokeObjectURL(musicURL);musicURL=null;showSettings();});
  addAction('Back',playing?showPause:closeModal);
}
function showCredits(inGame=false) {
  openModal('Controls & credits','BACK ON THE BLOCK','credits');
  paragraph('WASD or arrows: walk. Shift: run. E: interact. In a car, W/S accelerate or reverse and A/D steer. Space brakes. G honks. F equips or stows a pistol. Click or J fires. R reloads. H uses a first aid kit. C calls an ambulance. M map. N people. I bag. L notes. Escape pauses.');
  if(touchInput.matches)paragraph('Use the arrows to move or steer. Hold Run to sprint or Brake to slow your car. Tap a spot on the street to strike or fire in that direction. Open Bag in the notebook to equip a pistol.');
  paragraph('Press E near a resident. Pick a topic with 1, 2 or 3, and Q for more. Conversations play out in the street. Walk away or press E to leave.');
  paragraph('Concept and direction from Harinand. Development with OpenAI Codex assistance. Bench and bin sprites from the supplied PostApocalypse Asset Pack by TheLazyStone. Barlow Condensed by the Barlow Project Authors. The city uses deterministic procedural drawing. No image or music generation tools were used for this build.');
  paragraph('Sprite license details are in assets/LICENSE.txt. The display typeface is distributed under the SIL Open Font License.','hint');
  addAction('Read the full design document',()=>window.open('design/Game%20Design.html','_blank','noopener'));
  addAction('Close',inGame?showPause:closeModal);
}
function handleKey(key) {
  if(key==='escape'&&street){clearStreet();return;}
  if(key==='escape'||key==='p') {if(modalOpen)closeModal();else showPause();return;}
  if(!playing||modalOpen)return;
  if(key==='c'){perform('call_ambulance');return;}
  if(street&&['1','2','3'].includes(key)){
    $('street-options').children[Number(key)-1]?.click();return;
  }
  if(street&&key==='q'&&!$('more-options').hidden){$('more-options').click();return;}
  if(key==='e')interact();
  const panels={m:'map',n:'people',i:'bag',l:'journal'};
  if(panels[key])showPanel(panels[key]);
  if(key==='h'){act(state,'use_medkit');save();}
  if(key==='f')act(state,'equip');
  if(key==='r')act(state,'reload');
  if(key==='g'&&state.player.vehicleId)act(state,'honk');
}
window.addEventListener('keydown',event=>{
  const key=event.key.toLowerCase();
  if(!playing&&!modalOpen) {
    const menu=[...$('main-menu').querySelectorAll('button:not([hidden])')];
    const selected=menu.indexOf($('main-menu').querySelector('.is-selected'));
    if(['arrowup','arrowdown','w','s'].includes(key)) {
      event.preventDefault();
      const direction=['arrowup','w'].includes(key)?-1:1;
      const item=menu[(selected+direction+menu.length)%menu.length];item.focus();selectMenuItem(item);
    }else if(key==='enter'&&!event.repeat&&document.activeElement?.tagName!=='BUTTON') {
      event.preventDefault();menu[Math.max(0,selected)]?.click();
    }
    return;
  }
  if(!modalOpen&&(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement))return;
  if(!modalOpen&&playing&&['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))event.preventDefault();
  if(modalOpen&&key==='tab') {
    const focusable=[...$('modal-card').querySelectorAll('button:not(:disabled),a,input')];
    if(!focusable.length)return;
    const first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
  if(!event.repeat&&(!modalOpen||key==='escape'||(key==='p'&&currentPanel==='pause')))handleKey(key);
  if(!modalOpen&&playing)keys.add(key);
});
window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
window.addEventListener('blur',()=>{keys.clear();fire=false;if(playing&&!modalOpen)showPause();music.pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();fire=false;if(playing&&!modalOpen)showPause();music.pause();save();}});
canvas.addEventListener('pointermove',event=>{pointer={x:event.clientX,y:event.clientY};});
canvas.addEventListener('pointerdown',event=>{if(playing&&!modalOpen&&event.button===0){pointer={x:event.clientX,y:event.clientY};fire=true;fireTap=true;canvas.setPointerCapture(event.pointerId);}});
canvas.addEventListener('pointerup',()=>fire=false);canvas.addEventListener('pointercancel',()=>fire=false);
$('new-game').onclick=()=>{
  if(!savedExists){start();return;}
  openModal('Start a new game?','PORT LUCERO');
  paragraph('This replaces your local progress. You can export the current save from the pause menu.');
  addAction('Start new game',()=>start(),'',true);addAction('Keep current game',closeModal);
};
$('continue-button').onclick=()=>start(true);
for(const item of $('main-menu').querySelectorAll('button')) {
  item.addEventListener('pointerenter',()=>selectMenuItem(item));item.addEventListener('focus',()=>selectMenuItem(item));
}
$('settings-button').onclick=showSettings;
$('credits-button').onclick=()=>showCredits();$('close-modal').onclick=closeModal;
$('prompt').onclick=interact;$('end-interaction').onclick=clearStreet;
$('call-ambulance').onclick=()=>perform('call_ambulance');
$('pause-button').onclick=showPause;$('save-button').onclick=()=>save(true);$('minimap-button').onclick=()=>showPanel('map');
document.querySelectorAll('[data-panel]').forEach(button=>button.onclick=()=>showPanel(button.dataset.panel));
document.querySelectorAll('[data-touch]').forEach(button=>{
  let heldKey=null;
  button.onpointerdown=event=>{if(!modalOpen){event.preventDefault();heldKey=button.dataset.touch;keys.add(heldKey);button.setPointerCapture(event.pointerId);}};
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>{keys.delete(heldKey);heldKey=null;});
});
document.querySelectorAll('[data-tap]').forEach(button=>button.onclick=()=>handleKey(button.dataset.tap));
$('import-save').onchange=async event=>{
  const file=event.target.files[0];event.target.value='';if(!file)return;
  if(file.size>4000000){notify('That save file is too large.','bad');return;}
  try{const loaded=fromSave(JSON.parse(await file.text()));state=loaded;manualWaypoint=null;clearStreet();clearSpeech();seenMessages.clear();lastEndingNotice=null;lastRecoveryNotice=null;save();closeModal();notify('Save imported. Welcome back.','good');}catch(error){notify(`Could not import that save. ${error.message}`,'bad');}
};
$('import-music').onchange=event=>{
  const file=event.target.files[0];event.target.value='';if(!file)return;
  if(musicURL)URL.revokeObjectURL(musicURL);musicURL=URL.createObjectURL(file);music.src=musicURL;music.volume=settings.music;notify('Track selected. It will play when you return to the street.','good');
};
function updateInstruments(player,vehicle) {
  const instruments=$('vehicle-vitals');
  instruments.hidden=!vehicle;
  document.body.classList.toggle('in-car',!!vehicle);
  if(vehicle) {
    for(const [id,value] of [['car-condition',vehicle.health],['car-fuel',vehicle.fuel]]) {
      const meter=$(id),fraction=Math.max(0,Math.min(100,value));
      meter.value=fraction;meter.parentElement.dataset.low=String(fraction<=25);
      $(id+'-text').textContent=Math.ceil(fraction)+'%';
    }
    const warning=vehicle.health<=0?'Vehicle disabled':vehicle.fuel<=0?'Out of fuel':vehicle.health<=25?'Critical damage':vehicle.fuel<=12?'Low fuel':'';
    $('car-warning').hidden=!warning;$('car-warning').textContent=warning;
  }
  $('vehicle-status').hidden=!!vehicle;
  $('vehicle-status').textContent=player.equipped?
    `${player.magazine||0}/6 LOADED · ${Math.max(0,(player.inventory.ammo||0)-(player.magazine||0))} SPARE`:
    `ENERGY ${Math.round(player.stamina)}`;
}
function updateMedicalHUD(player) {
  const care=medicalStatus(state,player);
  const stage=care?.stage,down=player.hp<=0||player.medicalHeld;
  const injury=player.injury;
  const hasSymptoms=down||stage||player.hp<=65||injury&&injury.until>state.elapsed;
  const panel=$('medical-status');panel.hidden=!hasSymptoms;
  document.body.classList.toggle('needs-care',!!hasSymptoms);
  if(!hasSymptoms)return;
  const remaining=injury?.until>state.elapsed?Math.ceil(injury.until-state.elapsed):0;
  const symptom=injury?.severity==='critical'?'Critical injury':injury?.severity==='serious'?'Serious injury':down?'Downed':injury?'Minor injury':'Wounded';
  const careTitles={treatment:'Receiving treatment',board:'Medical transfer',transport:'Ambulance transport',admit:'Clinic admission',intake:'Receiving treatment'};
  const title=careTitles[stage]||symptom;
  const progress=stage?care.message:down?'Medical assistance needed':remaining?`Recovering · ${remaining}s`:'';
  if($('injury-label').textContent!==title)$('injury-label').textContent=title;
  if($('care-progress').textContent!==progress)$('care-progress').textContent=progress;
  $('call-ambulance').hidden=!!stage;
  if(down&&street)clearStreet();
}
function refreshHUD() {
  if(!playing)return;
  const p=state.player,world=state.world,room=world.buildings.find(b=>b.id===p.interior);
  if(diagnostic)diagnostic.textContent=JSON.stringify({seed:state.seed,player:p,job:state.job,story:state.story,nearby:nearby(state),buildings:world.buildings.map(({id,type,name,door,room})=>({id,type,name,door,spots:room.spots})),npcs:state.npcs.map(({id,name,x,y,interior,trust,task,sharedPast})=>({id,name,x,y,interior,trust,task,sharedPast}))});
  const hour=Math.floor(state.time/60)%24,minute=Math.floor(state.time)%60;
  const roadMidX=world.roads.vertical[2],roadMidY=world.roads.horizontal[2];
  $('location').textContent=room?room.name:world.districts[(p.y>=roadMidY?2:0)+(p.x>=roadMidX?1:0)];
  $('day-label').textContent=`DAY ${String(state.day||1).padStart(2,'0')}`;
  $('clock').textContent=`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  $('money').textContent=`$${Math.floor(p.cash).toLocaleString('en-US')}`;
  $('control-hints').hidden=touchInput.matches||state.elapsed>=hintUntil||!!street||modalOpen;
  $('health').value=p.hp;$('health-text').textContent=Math.ceil(p.hp);
  const vehicle=state.vehicles.find(v=>v.id===p.vehicleId);
  if(touchInput.matches) {
    $('touch-pace').textContent=vehicle?'Brake':'Run';
    $('touch-pace').dataset.touch=vehicle?' ':'shift';
    $('touch-extra').hidden=!vehicle&&!p.equipped;
    $('touch-extra').textContent=vehicle?'Honk':'Reload';
    $('touch-extra').dataset.tap=vehicle?'g':'r';
  }
  updateInstruments(p,vehicle);
  updateMedicalHUD(p);
  if(vehicle||!$('medical-status').hidden)$('control-hints').hidden=true;
  const dispatch=state.policeStatus||{stage:'clear',seconds:0,label:'Clear'};
  $('legal').dataset.stage=dispatch.stage;
  const marker={witness:25,search:10,pursuit:90,'on file':38}[dispatch.stage]||50;
  $('legal').style.setProperty('--dispatch-marker',marker+'%');
  $('case-status').textContent=dispatch.label;
  const seconds=Math.max(0,Math.ceil(dispatch.seconds||0));
  $('dispatch-timer').textContent=seconds?`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`:'';
  const goal=objective(state);
  $('chapter').textContent=state.story.resolved?'LIFE GOES ON':['GETTING SETTLED','LOOSE ENDS','A WAY OUT','A SECOND CHANCE'][state.story.phase]||'YOUR NEIGHBOURHOOD';
  $('objective-text').textContent=goal.text;
  const point=destination(goal);
  $('waypoint-text').textContent=point&&!p.interior?`${manualWaypoint?.name||'Next lead'} · ${Math.round(distance(p,point)/10)} m`:'';
  const targets=nearby(state);
  if(street&&!modalOpen)renderStreet();
  $('prompt').hidden=!targets.length||modalOpen||!!street||p.medicalHeld||p.hp<=0;
  if(targets.length)$('prompt-text').textContent=targets.length>1?`Nearby · ${targets[0].label}`:targets[0].label;
  if(!modalOpen)refreshSpeech();
  renderer.drawMap($('minimap'),state,false,manualWaypoint||goal.target);
  if(state.endingNotice&&lastEndingNotice!==state.endingNotice.time) {
    lastEndingNotice=state.endingNotice.time;
    openModal('A second chance.','YOUR STORY CONTINUES');
    paragraph(state.endingNotice.text);
    paragraph('The neighbourhood is still here. Your friends, work, possessions, and unfinished business stay with you.');
    addAction('Back to your life',closeModal,'',true);
    save();
  } else if(state.recoveryNotice&&lastRecoveryNotice!==state.recoveryNotice.time) {
    lastRecoveryNotice=state.recoveryNotice.time;
    openModal(state.recoveryNotice.title,'BACK ON YOUR FEET');
    paragraph(state.recoveryNotice.text);
    addAction('Keep going',closeModal,'',true);
    save();
  }
  for(const message of state.messages||[]) {
    const id=message.id??`${message.time}:${message.text}`;
    if(seenMessages.has(id))continue;seenMessages.add(id);
    if(Number(message.time||0)>state.elapsed-15)notify(message.text,message.tone||'normal');
  }
}
function frame(now) {
  const dt=Math.min(0.04,(now-lastTime)/1000);lastTime=now;
  if(playing&&!modalOpen) {
    if(street?.target?.kind==='npc') {
      const actor=state.npcs.find(n=>n.id===street.target.id);
      if(actor&&actor.hp>0&&!actor.medicalHeld&&actor.interior===state.player.interior&&distance(actor,state.player)<85)actor.conversationUntil=state.elapsed+.65;
    }
    const held=key=>keys.has(key);
    aim=pointer?renderer.screenToWorld(pointer.x,pointer.y):null;
    const input={x:Number(held('d')||held('arrowright'))-Number(held('a')||held('arrowleft')),y:Number(held('s')||held('arrowdown'))-Number(held('w')||held('arrowup')),run:held('shift'),brake:held(' '),fire:fire||fireTap||held('j'),aim};
    fireTap=false;
    try{tick(state,dt,input);}catch(error){console.error(error);showPause();notify('The simulation paused after an unexpected problem. Your previous save is still available.','bad');}
    saveClock+=dt;
    if(saveClock>20){saveClock=0;save();}
  }
  const goal=objective(state);
  renderer.draw(state,{title:!playing,time:now/1000,aim,highlight:playing&&!modalOpen?nearby(state)[0]:null,reducedMotion:!settings.motion,waypoint:destination(goal)});
  hudClock+=dt;if(hudClock>.12){hudClock=0;refreshHUD();}
  requestAnimationFrame(frame);
}
// Read-only diagnostics make save and simulation checks inspectable during browser QA.
window.blockSnapshot=()=>JSON.parse(JSON.stringify({seed:state.seed,time:state.time,day:state.day,elapsed:state.elapsed,player:state.player,story:state.story,events:state.events,npcs:state.npcs.map(({id,name,role,x,y,interior,trust,task,memories,disclosures})=>({id,name,role,x,y,interior,trust,task,memories,disclosures})),objective:objective(state)}));
window.addEventListener('pagehide',()=>save());
storageAvailable();
Promise.resolve(renderer.ready).catch(error=>notify(`Some artwork could not load. ${error.message}`,'bad'));
requestAnimationFrame(frame);
