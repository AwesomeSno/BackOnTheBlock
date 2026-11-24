import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,tick,toSave,fromSave} from '../src/simulation.js';
import {audibleLines,residentRoutine,sayLine} from '../src/island-life.js';
import {buildingByType,distance,isWalkable} from '../src/world.js';

function runUntil(state, predicate, limit) {
  for(let i=0;i<limit*10;i++){
    tick(state,.1);
    if(predicate(state))return true;
  }
  return false;
}

test('residents have fixed, individual workplaces, breaks, home addresses and looks',()=>{
  const state=createGame('morning-watch');
  assert.equal(state.npcs.length,24);
  assert.equal(new Set(state.npcs.map(n=>n.identity.occupation)).size,24);
  assert.equal(new Set(state.npcs.map(n=>n.name)).size,24);
  assert.ok(new Set(state.npcs.map(n=>n.identity.shiftStart)).size>=16);
  assert.ok(new Set(state.npcs.map(n=>n.appearance.height)).size>=15);
  assert.ok(state.npcs.some(n=>n.identity.languages.includes('Spanish')));
  assert.equal(state.npcs[0].name,'Miles Bennett');
  for(const npc of state.npcs){
    assert.ok(isWalkable(state.world,npc.x,npc.y,9,npc.interior),npc.name);
    for(const other of state.npcs){
      if(other===npc||other.interior!==npc.interior)continue;
      assert.ok(distance(npc,other)>15,npc.name+' overlaps '+other.name);
    }
  }
  const mechanic=state.npcs[3];
  state.time=570;
  assert.match(residentRoutine(state,mechanic).task,/mechanic/);
  state.time=mechanic.identity.shiftStart+213;
  assert.match(residentRoutine(state,mechanic).task,/lunch/);
  state.time=1320;
  const home=residentRoutine(state,mechanic);
  assert.equal(home.targetId,mechanic.homeId);
  assert.equal(home.outside,false);
});

test('a stationary bystander can overhear conversations while residents and traffic move',()=>{
  const state=createGame('harbour-watch');
  const parked=state.life.traffic.filter(v=>!v.service).map(v=>({x:v.x,y:v.y}));
  const publicLines=[];
  for(let i=0;i<120;i++){
    tick(state,.1);
    for(const l of audibleLines(state)) if(!publicLines.some(other=>other.id===l.id))publicLines.push(l);
  }
  assert.ok(new Set(publicLines.map(l=>l.speakerId)).size>=2);
  assert.ok(state.life.traffic.filter((v,i)=>!v.service&&distance(v,parked[i])>60).length>=8);
  const npc=state.npcs[0];
  state.life.speech=[];
  npc.interior=state.homeId;
  sayLine(state,npc,'This should stay inside the apartment.','ambient');
  assert.equal(audibleLines(state).length,0);
  npc.interior=state.player.interior;
  Object.assign(npc,{x:state.player.x+25,y:state.player.y});
  sayLine(state,state.player,'How is your shift?');
  sayLine(state,npc,'Early ferry had a flat. It left on time anyway.');
  assert.equal(audibleLines(state)[0].speakerId,'player');
  state.elapsed=state.life.speech.at(-1).start+.01;
  assert.equal(audibleLines(state)[0].speaker,npc.name);
  sayLine(state,state.player,'See you later.');
  assert.equal(audibleLines(state).at(-1).text,'See you later.');
});

test('an unwatched accident and robbery reach the clinic and station with real participants',()=>{
  const state=createGame('harbour-watch');
  state.player.interior=state.homeId;
  Object.assign(state.player,state.world.buildings.find(b=>b.id===state.homeId).room.entry);
  const stages=new Set();
  const atOutcome=new Map();
  const completed=runUntil(state,()=>{
    const incident=state.life.incident;
    if(incident){
      stages.add(incident.kind+'/'+incident.stage);
      if(incident.stage==='transport'){
        const passengerId=incident.kind==='robbery'?incident.actorId:incident.victimId;
        const passenger=state.npcs.find(n=>n.id===passengerId);
        assert.equal(passenger.inServiceVehicle,incident.unitId);
        const unit=state.life.traffic.find(v=>v.id===incident.unitId);
        assert.ok(distance(passenger,unit)<1);
      }
    }
    const last=state.life.history.at(-1);
    if(last&&!atOutcome.has(last.kind)){
      const p=state.npcs.find(n=>n.id===(last.kind==='accident'?last.victimId:last.actorId));
      atOutcome.set(last.kind,p.interior);
    }
    return atOutcome.size===2;
  },380);
  assert.equal(completed,true);
  assert.equal(atOutcome.get('accident'),buildingByType(state.world,'clinic').id);
  assert.equal(atOutcome.get('robbery'),buildingByType(state.world,'police').id);
  for(const phase of ['accident/crossing','accident/assess','robbery/handover','robbery/transport'])assert.ok(stages.has(phase),phase);
  assert.equal(state.stats.crimes,0);
  assert.equal(state.player.heat,0);
  assert.equal(state.cases.length,0);
});

test('saving mid-emergency keeps crew, patient, vehicle and destination together',()=>{
  const initial=createGame('harbour-watch');
  assert.ok(runUntil(initial,s=>s.life.incident?.stage==='transport',160));
  const e=initial.life.incident;
  const restored=fromSave(JSON.parse(JSON.stringify(toSave(initial))));
  assert.equal(restored.life.incident.stage,'transport');
  const passenger=restored.npcs.find(n=>n.id===(e.kind==='accident'?e.victimId:e.actorId));
  assert.equal(passenger.inServiceVehicle,e.unitId);
  const unit=restored.life.traffic.find(v=>v.id===e.unitId);
  assert.ok(distance(unit,passenger)<1);
  assert.ok(runUntil(restored,s=>s.life.history.some(h=>h.id===e.id),90));
  assert.equal(restored.life.history.filter(h=>h.id===e.id).length,1);
  assert.equal(passenger.inServiceVehicle,null);
  assert.equal(passenger.ambientBusy,false);
});

test('invalid saved incident and fleet data cannot produce a stuck crew or invalid turn',()=>{
  const state=createGame('bad-city-save'),backup=toSave(state);
  backup.life.incident={id:'broken',kind:'robbery',stage:'crossing',actorId:'npc-15',victimId:'npc-3',responderId:'npc-10',site:{x:100,y:100},road:{x:128,y:128},stageAt:0,start:0};
  backup.life.traffic[0].route=[{x:NaN,y:Infinity}];
  const restored=fromSave(backup);
  assert.equal(restored.life.incident,null);
  for(let i=0;i<80;i++)tick(restored,.1);
  assert.ok(restored.life.traffic.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)));
});

test('drivers yield for an approaching ambulance in their lane and resume after it clears',()=>{
  const state=createGame('right-of-way');
  const driver=state.life.traffic[0];
  const farDriver=state.life.traffic[15];
  const unit=state.life.traffic.find(v=>v.service==='ambulance');
  const roadY=state.world.roads.horizontal[0];
  Object.assign(driver,{x:392,y:roadY+18,angle:0,speed:85,leg:1});
  Object.assign(unit,{x:330,y:roadY+6,angle:0,speed:140,siren:true});
  const beforeY=driver.y;
  tick(state,.1);
  assert.equal(driver.yieldingTo,unit.id);
  assert.ok(driver.speed<85);
  assert.ok(driver.y>beforeY);
  assert.equal(farDriver.yieldingTo,null);
  unit.siren=false;
  const slowed=driver.speed;
  tick(state,.1);
  assert.equal(driver.yieldingTo,null);
  assert.ok(driver.speed>slowed);
});

test('a local witness reacts and remembers, while a person inside learns nothing',()=>{
  const state=createGame('harbour-watch');
  assert.ok(runUntil(state,s=>s.life.incident?.stage==='crossing',200));
  const event=state.life.incident;
  const seen=state.npcs[22],absent=state.npcs[20];
  Object.assign(seen,{x:event.road.x+23,y:event.road.y+15,interior:null,ambientBusy:false,scheduleAt:state.elapsed+15});
  Object.assign(absent,{interior:state.homeId,scheduleAt:state.elapsed+15});
  assert.ok(runUntil(state,s=>s.life.incident?.stage==='report',8));
  assert.ok(event.witnesses.includes(seen.id));
  assert.ok(!event.witnesses.includes(absent.id));
  assert.equal(seen.task,'watching the street');
  assert.ok(seen.memories.some(m=>m.key===event.id+'-witness'&&m.text.startsWith('I saw')));
  assert.ok(absent.memories.every(m=>!m.key.startsWith(event.id)));
  const saved=fromSave(toSave(state));
  assert.ok(saved.npcs[22].memories.some(m=>m.key===event.id+'-witness'));
  assert.ok(saved.npcs[20].memories.every(m=>!m.key.startsWith(event.id)));
});

test('opposing turns and cars queued in one lane keep clearing the harbour junctions',()=>{
  // On this run two drivers used to give way to each other for the rest of
  // the day. Check actual movement long after their first meeting.
  const state=createGame('watch-2');
  const cars=state.life.traffic.filter(car=>!car.service);
  const travelled=cars.map(()=>0);
  for(let step=0;step<1800;step++){
    const before=cars.map(car=>({x:car.x,y:car.y}));
    tick(state,.1);
    if(step>=1200)cars.forEach((car,i)=>travelled[i]+=distance(car,before[i]));
  }
  for(const [i,moved] of travelled.entries())assert.ok(moved>125,cars[i].id+' remained blocked');
});
