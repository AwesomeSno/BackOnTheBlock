import {createGame,tick,nearby,interaction,act,toSave,fromSave,objective} from './simulation.js';
import {createRenderer} from './render.js';
import {distance} from './world.js';

const $=id=>document.getElementById(id);
const canvas=$('world');
const renderer=createRenderer(canvas);
const saveKey=location.search.includes('debug')?'back-on-the-block-test-v1':'back-on-the-block-v1';
const settingsKey='back-on-the-block-settings';
let settings={motion:!matchMedia('(prefers-reduced-motion: reduce)').matches,music:0.6};
try {settings={...settings,...JSON.parse(localStorage.getItem(settingsKey)||'{}')};}catch{}
let state=createGame('one-more-chance');
let playing=false,modalOpen=false,currentPanel=null,previousFocus=null,currentTarget=null,manualWaypoint=null;
let keys=new Set(),fire=false,fireTap=false,lastTime=performance.now(),hudClock=0,saveClock=0;
let pointer=null,aim=null,savedExists=false;
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
music.loop=true;music.volume=settings.music;
let musicURL=null;
const diagnostic=location.search.includes('debug')?document.createElement('output'):null;
if(diagnostic){diagnostic.id='game-diagnostics';diagnostic.hidden=true;document.body.append(diagnostic);}
const seenMessages=new Set();
let lastEndingNotice=null,lastRecoveryNotice=null;
const escapeText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function notify(text,tone='normal') {
  const node=document.createElement('div');node.className=`toast ${tone==='danger'?'bad':tone}`;node.textContent=text;
  $('notifications').append(node);
  while($('notifications').children.length>4)$('notifications').firstElementChild.remove();
  setTimeout(()=>node.remove(),6500);
}
function storageAvailable() {
  try{savedExists=!!localStorage.getItem(saveKey);}catch{savedExists=false;}
  $('continue-button').disabled=!savedExists;
  $('title-status').textContent=savedExists?'Your last life is saved on this browser.':'One town per seed. What happens here is up to you.';
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
function start(seed,resume=false) {
  try {
    const next=resume?fromSave(JSON.parse(localStorage.getItem(saveKey))):createGame(seed.trim()||'one-more-chance');
    state=next;playing=true;manualWaypoint=null;pointer=null;aim=null;seenMessages.clear();lastEndingNotice=null;lastRecoveryNotice=null;
    $('title-screen').hidden=true;
    for(const id of ['hud','legal','minimap-button','objective','toolbar','control-hints'])$(id).hidden=false;
    $('touch-controls').hidden=!touchInput.matches;
    closeModal();
    save();
    if(!resume) {
      openModal('A room. A job. A fresh start.','BACK ON THE BLOCK');
      paragraph("Nikhil said the room was sorted. The job too. For once, arriving here might actually have been a good idea.");
      paragraph("He's waiting outside your room. Walk over and say something. Or take a look around first. The city has already started its day.");
      paragraph(touchInput.matches?'Walk with the arrows. Tap Use near a person, door, or car. Tap the map to find places.':'WASD or arrows to walk. Shift to run. E near people, doors, vehicles, and objects. Your map marks useful places.');
      addAction('Step outside',()=>closeModal(),'',true);
    }
    if(musicURL&&settings.music>0)music.play().catch(()=>{});
  }catch(error){notify(`Could not open that save. ${error.message}`,'bad');}
}
function openModal(title,kicker='THE NEIGHBOURHOOD',panel=null) {
  if(!modalOpen)previousFocus=document.activeElement;
  modalOpen=true;currentPanel=panel;keys.clear();fire=false;fireTap=false;
  $('modal').hidden=false;$('modal-title').textContent=title;$('modal-kicker').textContent=kicker;
  $('modal-content').replaceChildren();$('modal-actions').replaceChildren();
  $('close-modal').focus();
  music.pause();
}
function closeModal() {
  modalOpen=false;currentPanel=null;currentTarget=null;
  $('modal').hidden=true;keys.clear();fire=false;fireTap=false;
  previousFocus?.focus?.();
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
function perform(action,targetId=null,keepTarget=null) {
  try {
    const result=act(state,action,targetId)||{};
    saveClock=0;save();
    if(result.close===false&&keepTarget)openInteraction(keepTarget);
    else {
      closeModal();
      if(result.text)notify(result.text,result.tone||'normal');
    }
    refreshHUD();
  } catch(error){notify(`That action could not finish. ${error.message}`,'bad');console.error(error);}
}
function openInteraction(target) {
  const data=interaction(state,target);
  if(!data)return;
  openModal(data.title||target.label,data.subtitle||'UP CLOSE');currentTarget=target;
  paragraph(data.body||'');
  for(const option of data.options||[]) {
    addAction(option.label,()=>perform(option.id,target.id,target),option.hint||'',false,!!option.disabled);
  }
  if(!data.options?.some(option=>option.id==='close'))addAction('Leave it for now',closeModal);
}
function interact() {
  if(!playing||modalOpen)return;
  const targets=nearby(state);
  if(!targets.length){notify('Get closer to a door, a person, a vehicle, or an event.');return;}
  if(targets.length===1){openInteraction(targets[0]);return;}
  openModal('What are you looking at?','NEAR YOU');
  targets.slice(0,7).forEach(target=>addAction(target.label,()=>openInteraction(target),target.kind));
}
function panelTabs(active) {
  const tabs=document.createElement('nav');tabs.className='panel-tabs';tabs.setAttribute('aria-label','Notebook sections');
  for(const [id,label] of [['bag','Bag'],['people','People'],['journal','Notes'],['case','Your record'],['map','Map']]) {
    const button=document.createElement('button');button.textContent=label;button.className=id===active?'active':'';
    button.onclick=()=>showPanel(id);tabs.append(button);
  }
  $('modal-content').append(tabs);
}
function showPanel(id) {
  if(!playing)return;
  const titles={bag:'What you have.',people:'People you know.',journal:'Worth remembering.',case:'Your side of the story.',map:'Find your way.'};
  openModal(titles[id]||'Notebook','YOUR NOTEBOOK',id);panelTabs(id);
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
    const known=state.npcs.filter(n=>n.introduced||n.trust!==0||n.role==='friend');
    paragraph('Spend time together. Keep your promises. Everyone remembers their own version of you.','hint');
    if(!known.length)paragraph('Get out and meet someone. Names will end up here.');
    for(const npc of known) {
      const row=document.createElement('section');row.className='person-row';
      const trust=Number(npc.trust||0);
      row.innerHTML=`<strong>${escapeText(npc.name)}</strong> <span class="hint">${escapeText(npc.role)}</span><div class="detail">${trust>65?'Close':trust>30?'Warming up':trust< -20?'Wary':'Getting to know you'} · trust ${Math.round(trust)}<progress max="200" value="${trust+100}" aria-label="Trust"></progress></div>`;
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
    paragraph(`Your conduct sits at ${Math.round(player.honor||0)}. This is your history. A person can only react to what they saw, experienced, or heard.`);
    paragraph(`Immediate danger ${Math.round(player.heat||0)} / 100. Investigation ${Math.round(player.investigation||0)} / 100.`);
    const records=state.cases||state.incidents||[];
    if(!records.length)paragraph('There is nothing in your record yet.');
    for(const record of records.slice(-12))paragraph(`${record.type||record.kind||'Incident'}${record.resolved?' · resolved':''}. ${record.description||record.text||(record.witnesses?.length?`${record.witnesses.length} witnesses. ${record.identified?'Identified suspect.':'Identity unconfirmed.'}`:'')}`);
    paragraph('Breaking line of sight helps end a pursuit. A case can remain after the chase. Visit the police counter to surrender or resolve a fine.','hint');
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
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`back-on-the-block-${state.seed}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function showPause() {
  if(!playing)return;
  openModal('Take a minute.','PAUSED','pause');
  paragraph(`Day ${state.day||1} in ${state.seed}. Your city waits while this panel is open.`);
  addAction('Back to the street',closeModal,'',true);
  addAction('Save your progress',()=>save(true));
  addAction('Export save',exportSave,'Keep a copy outside this browser');
  addAction('Import save',()=>$('import-save').click());
  addAction('Settings',showSettings);
  addAction('Controls & credits',()=>showCredits(true));
  addAction('Back to the title',()=>{save();playing=false;closeModal();$('title-screen').hidden=false;for(const id of ['hud','legal','minimap-button','objective','toolbar','control-hints','prompt','touch-controls'])$(id).hidden=true;storageAvailable();});
}
function storeSettings(){try{localStorage.setItem(settingsKey,JSON.stringify(settings));}catch{}}
function showSettings() {
  openModal('Make yourself comfortable.','SETTINGS','settings');
  paragraph('The soundtrack is waiting for your tracks. You can preview a local audio file here. It stays on this device and needs to be selected again after a reload.');
  addAction('Preview a background track',()=>$('import-music').click());
  const musicLabel=document.createElement('label');musicLabel.textContent='Music volume';
  const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='1';slider.step='.05';slider.value=settings.music;slider.setAttribute('aria-label','Music volume');slider.oninput=()=>{settings.music=Number(slider.value);music.volume=settings.music;storeSettings();};musicLabel.append(slider);$('modal-content').append(musicLabel);
  addAction(`Extra motion ${settings.motion?'on':'off'}`,()=>{settings.motion=!settings.motion;storeSettings();showSettings();});
  if(musicURL)addAction('Remove preview track',()=>{music.pause();music.removeAttribute('src');URL.revokeObjectURL(musicURL);musicURL=null;showSettings();});
  addAction('Back',showPause);
}
function showCredits(inGame=false) {
  openModal('The people behind the block.','CONTROLS & CREDITS','credits');
  paragraph('WASD or arrows: walk. Shift: run. E: interact. In a car, W/S accelerate or reverse and A/D steer. Space brakes. G honks. F equips or stows a pistol. Click or J fires. R reloads. H uses a first aid kit. M map. N people. I bag. L notes. Escape pauses.');
  if(touchInput.matches)paragraph('Use the arrows to move or steer. Hold Run to sprint or Brake to slow your car. Tap a spot on the street to strike or fire in that direction. Open Bag in the notebook to equip a pistol.');
  paragraph('Your town is generated from a seed. Its people and consequences persist in the save. The story has several ways out, and the neighbourhood keeps going afterward.');
  paragraph('Concept and direction from Harinand. Development with OpenAI Codex assistance. Sprite artwork from the supplied PostApocalypse Asset Pack by TheLazyStone. The city uses deterministic procedural drawing. No image or music generation tools were used for this build.');
  paragraph('The supplied asset licence permits noncommercial game use and requires payment for commercial use. See assets/LICENSE.txt. Background music is pending your tracks. Multiplayer and deeper life-simulation features remain future work.','hint');
  addAction('Read the full design document',()=>window.open('design/Game%20Design.html','_blank','noopener'));
  addAction('Close',inGame?showPause:closeModal);
}
function handleKey(key) {
  if(key==='escape'||key==='p') {if(modalOpen)closeModal();else showPause();return;}
  if(!playing||modalOpen)return;
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
$('new-game-form').onsubmit=event=>{
  event.preventDefault();
  if(savedExists){openModal('Start over in another town?','NEW LIFE');paragraph('Starting a new life replaces the browser save. You can keep your current one by continuing it and choosing Export save from Pause.');addAction('Start this new life',()=>start($('seed').value),'',true);addAction('Keep my saved life',closeModal);}
  else start($('seed').value);
};
$('continue-button').onclick=()=>start('',true);
$('shuffle-seed').onclick=()=>{const words=['after-rain','borrowed-time','small-miracles','wrong-turn','better-days','last-bus'];$('seed').value=words[Math.floor(Math.random()*words.length)]+'-'+Math.floor(Math.random()*999);};
$('credits-button').onclick=()=>showCredits();$('close-modal').onclick=closeModal;
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
  try{const loaded=fromSave(JSON.parse(await file.text()));state=loaded;manualWaypoint=null;save();closeModal();notify('Save imported. Welcome back.','good');}catch(error){notify(`Could not import that save. ${error.message}`,'bad');}
};
$('import-music').onchange=event=>{
  const file=event.target.files[0];event.target.value='';if(!file)return;
  if(musicURL)URL.revokeObjectURL(musicURL);musicURL=URL.createObjectURL(file);music.src=musicURL;music.volume=settings.music;notify('Track selected. It will play when you return to the street.','good');
};
function refreshHUD() {
  if(!playing)return;
  const p=state.player,world=state.world,room=world.buildings.find(b=>b.id===p.interior);
  if(diagnostic)diagnostic.textContent=JSON.stringify({seed:state.seed,player:p,job:state.job,story:state.story,nearby:nearby(state),buildings:world.buildings.map(({id,type,name,door,room})=>({id,type,name,door,spots:room.spots})),npcs:state.npcs.map(({id,name,x,y,interior,trust,task,sharedPast})=>({id,name,x,y,interior,trust,task,sharedPast}))});
  const hour=Math.floor(state.time/60)%24,minute=Math.floor(state.time)%60;
  $('location').textContent=room?room.name:world.districts[(p.y>=1408?2:0)+(p.x>=1408?1:0)];
  $('clock').textContent=`DAY ${state.day||1} · ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  $('money').textContent=`₹${Math.floor(p.cash).toLocaleString()}`;
  $('health').value=p.hp;$('health-text').textContent=Math.ceil(p.hp);
  const vehicle=state.vehicles.find(v=>v.id===p.vehicleId);
  if(touchInput.matches) {
    $('touch-pace').textContent=vehicle?'Brake':'Run';
    $('touch-pace').dataset.touch=vehicle?' ':'shift';
    $('touch-extra').hidden=!vehicle&&!p.equipped;
    $('touch-extra').textContent=vehicle?'Honk':'Reload';
    $('touch-extra').dataset.tap=vehicle?'g':'r';
  }
  $('vehicle-status').textContent=vehicle?`FUEL ${Math.round(vehicle.fuel)} · CAR ${Math.round(vehicle.health)}`:(p.equipped?`${p.magazine||0}/6 LOADED · ${Math.max(0,(p.inventory.ammo||0)-(p.magazine||0))} SPARE`:`ENERGY ${Math.round(p.stamina)}`);
  $('pursuit').value=p.heat||0;$('investigation').value=p.investigation||0;
  $('pursuit-status').textContent=p.heat>65?'Police closing in':p.heat>5?'Being pursued':'Clear';
  $('case-status').textContent=p.investigation>5?'Open investigation':'No active case';
  const goal=objective(state);
  $('chapter').textContent=state.story.resolved?'LIFE GOES ON':['GETTING SETTLED','LOOSE ENDS','A WAY OUT','A SECOND CHANCE'][state.story.phase]||'YOUR NEIGHBOURHOOD';
  $('objective-text').textContent=goal.text;
  const point=destination(goal);
  $('waypoint-text').textContent=point&&!p.interior?`${manualWaypoint?.name||'Next lead'} · ${Math.round(distance(p,point)/10)} m`:'';
  const targets=nearby(state);$('prompt').hidden=!targets.length||modalOpen;
  if(targets.length)$('prompt-text').textContent=targets.length>1?`${targets[0].label} + ${targets.length-1} nearby`:targets[0].label;
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
    const held=key=>keys.has(key);
    aim=pointer?renderer.screenToWorld(pointer.x,pointer.y):null;
    const input={x:Number(held('d')||held('arrowright'))-Number(held('a')||held('arrowleft')),y:Number(held('s')||held('arrowdown'))-Number(held('w')||held('arrowup')),run:held('shift'),brake:held(' '),fire:fire||fireTap||held('j'),aim};
    fireTap=false;
    try{tick(state,dt,input);}catch(error){console.error(error);showPause();notify('The simulation paused after an unexpected problem. Your previous save is still available.','bad');}
    saveClock+=dt;
    if(saveClock>20){saveClock=0;save();}
  }
  const goal=objective(state);
  renderer.draw(state,{aim,highlight:playing&&!modalOpen?nearby(state)[0]:null,reducedMotion:!settings.motion,waypoint:destination(goal)});
  hudClock+=dt;if(hudClock>.12){hudClock=0;refreshHUD();}
  requestAnimationFrame(frame);
}
// Read-only diagnostics make save and simulation checks inspectable during browser QA.
window.blockSnapshot=()=>JSON.parse(JSON.stringify({seed:state.seed,time:state.time,day:state.day,elapsed:state.elapsed,player:state.player,story:state.story,events:state.events,npcs:state.npcs.map(({id,name,role,x,y,interior,trust,task,memories,disclosures})=>({id,name,role,x,y,interior,trust,task,memories,disclosures})),objective:objective(state)}));
window.addEventListener('pagehide',()=>save());
storageAvailable();
Promise.resolve(renderer.ready).catch(error=>notify(`Some artwork could not load. ${error.message}`,'bad'));
requestAnimationFrame(frame);
