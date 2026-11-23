import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWorld} from '../src/world.js';
import {noteOffense,updatePolice,warnWitness,restoreStatements} from '../src/police.js';

const noop=()=>{};
const hooks={navigate:noop,travel:noop,arrest:noop,pushMessage:noop};
function fixture(){
  const person=(id,x,role='resident')=>({id,x,y:768,angle:0,role,hp:100,interior:null,trust:0});
  const witness=person('npc-6',601), officer=person('npc-10',1850,'police');
  const player={...person('Alex',768),outfit:'denim',equipped:false,heat:0,honor:0,exposure:0,investigation:0};
  const s={world:generateWorld(),elapsed:10,time:720,day:1,sequence:0,npcs:[witness,officer],player,cases:[],stats:{crimes:0}};
  return {s,witness,officer};
}
function report(s){return noteOffense(s,'vehicle theft',2,null,'car-2',noop,noop,noop);}
test('a civilian report takes time and threatens no other witness statement',()=>{
  const {s}=fixture();
  const second={...s.npcs[0],id:'npc-7',x:609};s.npcs.push(second);
  const c=report(s);
  assert.equal(s.player.investigation,0);assert.equal(c.witnesses.length,2);
  warnWitness(s,s.npcs[0],noop);
  assert.equal(c.witnesses[0].status,'withdrawn');
  assert.equal(c.witnesses[1].status,'pending');
  s.elapsed+=14;updatePolice(s,.1,hooks);
  assert.equal(c.witnesses[1].status,'reported');assert.equal(c.identified,false);
  assert.ok(s.player.investigation>0);assert.equal(s.player.heat,0);
});
test('officers need an observed match before pursuing an unknown person',()=>{
  const {s,officer}=fixture();s.player.equipped=true;
  const c=report(s);s.elapsed+=20;
  officer.x=655;
  s.player.equipped=false;updatePolice(s,.1,hooks);
  assert.equal(c.witnesses[0].description.face,null);
  assert.equal(c.witnesses[0].description.outfit,'denim');
  assert.equal(c.witnesses[0].description.weapon,'pistol');
  assert.equal(s.player.heat,0);
  s.player.vehicleId='car-2';updatePolice(s,.1,hooks);
  assert.ok(s.player.heat>0);assert.equal(s.policeStatus.stage,'pursuit');
});
test('unseen, unreported and personally recognized incidents stay distinct',()=>{
  const {s,witness}=fixture();witness.interior='b20';
  report(s);assert.equal(s.cases.length,0);assert.equal(s.player.heat,0);
  witness.interior=null;witness.x=747;witness.introduced=true;
  const c=report(s);assert.equal(c.witnesses[0].description.face,'Alex');
  warnWitness(s,witness,noop);s.elapsed+=15;updatePolice(s,.1,hooks);
  assert.equal(s.player.heat,0);assert.equal(s.player.investigation,0);
  assert.equal(c.resolved,true);
});
test('serialized descriptions and pending reporting deadlines survive a reload',()=>{
  const {s}=fixture();const c=report(s);
  const saved=JSON.parse(JSON.stringify(s.cases));const description=c.witnesses[0].description;
  c.witnesses=c.witnesses.map(w=>({id:w.id,identified:w.identified}));
  restoreStatements(s,saved);
  assert.deepEqual(c.witnesses[0].description,description);
  assert.equal(c.witnesses[0].reportAt,saved[0].witnesses[0].reportAt);
});
