// Witness statements belong to their observers. Police only use statements that reach dispatch.
import {canSee, distance} from './world.js';

export const outfits = ['denim','marigold','graphite'];
const fieldNames = ['face','outfit','vehicle','weapon','companion'];
const cap = value => Math.min(100, Math.max(0,value));

function describe(state, observer, range, vehicleId) {
  const p = state.player;
  const daylight = p.interior || (state.time > 380 && state.time < 1120);
  const familiar = observer.introduced && range < (daylight ? 155 : 90);
  const face = familiar ? 'Alex' : range < (daylight ? 84 : 48) ? 'clear likeness' : null;
  const friend = state.npcs.find(n => n.id === p.companionId);
  return {face, outfit:range < (daylight ? 255 : 145) ? p.outfit : null,
    vehicle:vehicleId ?? p.vehicleId ?? null, weapon:p.equipped && range < 175 ? 'pistol' : null,
    companion:friend && friend.interior === observer.interior && distance(observer,friend)<180 && canSee(state.world,observer,friend) ? friend.id : null};
}
function lineOfSight(state, observer, subject, radius, near=65) {
  if(observer.hp <= 0 || observer.pose==='cuffed' || observer.pose==='fallen' || observer.inServiceVehicle || observer.passengerOf || observer.interior !== subject.interior)return false;
  const d=distance(observer,subject);
  if(d>radius || !canSee(state.world,observer,subject))return false;
  if(d<near)return true;
  return (Math.cos(observer.angle||0)*(subject.x-observer.x)+Math.sin(observer.angle||0)*(subject.y-observer.y))/d > -0.25;
}
function fileReport(state,record,witness,pushMessage) {
  witness.status='reported';
  const first=!record.reported;
  record.reported=true;
  record.identified ||= Boolean(witness.description.face);
  const p=state.player;
  if(first){
    p.investigation=cap(p.investigation+record.severity*(witness.description.face?15:8));
    p.lastSeen={x:record.x,y:record.y,interior:record.interior,time:state.elapsed};
    p.searchUntil=state.elapsed+30+record.severity*6;
    pushMessage(state,'Dispatch received a report of '+record.type+'.','danger');
  }
  p.identified ||= record.identified;
  if(witness.officer) {
    p.heat=cap(Math.max(p.heat,25+record.severity*13));
    p.lastSeen={x:record.x,y:record.y,interior:record.interior,time:state.elapsed};
    p.searchUntil=state.elapsed+45;
  }
}
export function noteOffense(state,type,severity,victimId,vehicleId,remember,pushMessage,log) {
  const p=state.player;
  const record={id:'case-'+(++state.sequence),type,severity,x:p.x,y:p.y,interior:p.interior,time:state.elapsed,day:state.day,
    witnesses:[],reported:false,identified:false,resolved:false};
  state.stats.crimes++;p.honor=Math.max(-100,p.honor-severity*2);p.lastCrime=state.elapsed;
  for(const npc of state.npcs) {
    const range=distance(npc,p);
    if(!lineOfSight(state,npc,p,285,npc.id===victimId?120:65))continue;
    const description=describe(state,npc,range,vehicleId);
    const witness={id:npc.id,identified:Boolean(description.face),description,officer:npc.role==='police',
      status:'pending',reportAt:state.elapsed+7+(Number(npc.id.slice(4))%6)};
    record.witnesses.push(witness);
    remember(state,npc,record.id,witness.identified?'Saw you involved in '+type+'.':'Saw an unidentified person involved in '+type+'.',witness.identified?-severity*5:0);
    npc.panicUntil=state.elapsed+3.5;
    if(witness.officer)fileReport(state,record,witness,pushMessage);
  }
  if(record.witnesses.length) {
    state.cases.push(record);
    if(!record.reported)pushMessage(state,'A witness is reaching for a phone.','warn');
    log(state,type+' witnessed by '+record.witnesses.length+'.');
  }
  state.dirty=true;return record;
}
export function pendingStatement(state,npc) {
  return state.cases.some(c=>!c.resolved&&c.witnesses.some(w=>w.id===npc.id&&!w.officer&&w.status==='pending'));
}
export function warnWitness(state,npc,remember) {
  let answered=false,withdrew=false;
  for(const c of state.cases)for(const w of c.witnesses) {
    if(c.resolved||w.id!==npc.id||w.status!=='pending'||w.officer||w.warned)continue;
    w.warned=true;answered=true;
    // Personal responses are stable across save/load.
    const standsFirm=npc.role==='nurse'||npc.trust < -35||Number(npc.id.slice(4))%5===2;
    if(standsFirm)w.reportAt=Math.min(w.reportAt,state.elapsed+1.3);
    else {w.status='withdrawn';withdrew=true;}
    remember(state,npc,c.id+'-warn','You tried to stop my call.',-12);
    if(c.witnesses.every(v=>v.status==='withdrawn'||v.status==='unable'))c.resolved=true;
  }
  if(answered)state.player.honor=Math.max(-100,state.player.honor-4);
  return withdrew?'Fine. I’m hanging up. Stay away from me.':'I already dialled. Get away from me.';
}
function matches(state,w,officer) {
  const d=w.description;if(!d)return false;
  const p=state.player,r=distance(p,officer);
  if(d.face && r<(p.vehicleId?95:142))return true;
  const ride=d.vehicle && d.vehicle===p.vehicleId;
  const partner=state.npcs.find(n=>n.id===p.companionId);
  const companion=d.companion&&partner?.id===d.companion&&lineOfSight(state,officer,partner,195);
  const clothing=d.outfit&&d.outfit===p.outfit;
  return Boolean(ride || (clothing && (companion || (d.weapon==='pistol'&&p.equipped))));
}
export function updatePolice(state,dt,{navigate,travel,arrest,pushMessage}) {
  const p=state.player;
  let nextCall=Infinity;
  for(const record of state.cases) {
    if(record.resolved)continue;
    for(const w of record.witnesses) {
      if(w.status!=='pending')continue;
      const caller=state.npcs.find(n=>n.id===w.id);
      if(!caller||caller.hp<=0){w.status='unable';continue;}
      if(w.reportAt<=state.elapsed)fileReport(state,record,w,pushMessage);
      else nextCall=Math.min(nextCall,w.reportAt-state.elapsed);
    }
    if(!record.reported&&record.witnesses.every(w=>w.status==='unable'||w.status==='withdrawn'))record.resolved=true;
  }
  let seen=false,contact=false;
  const searchLeft=Math.max(0,(p.searchUntil||0)-state.elapsed);
  const filed=state.cases.filter(c=>c.reported&&!c.resolved);
  for(const officer of state.npcs.filter(n=>n.role==='police'&&n.hp>0&&!n.ambientBusy&&!n.passengerOf)) {
    officer.policeDuty=false;
    if(!filed.length)continue;
    const sees=lineOfSight(state,officer,p,300,85);
    const match=sees&&filed.some(c=>c.witnesses.some(w=>w.status==='reported'&&matches(state,w,officer)));
    if(match) {
      seen=true;officer.policeDuty=true;officer.task='pursuing a matching description';
      p.heat=cap(Math.max(p.heat,46));p.lastSeen={x:p.x,y:p.y,interior:p.interior,time:state.elapsed};p.searchUntil=state.elapsed+40;
      navigate(state,officer,p,dt,132);
      if(distance(officer,p)<(p.vehicleId?35:25))contact=true;
    } else if(searchLeft>0&&p.lastSeen) {
      officer.policeDuty=true;officer.task='checking the reported location';
      travel(state,officer,p.lastSeen.interior,p.lastSeen,dt);
    }
  }
  p.exposure=contact?p.exposure+dt:Math.max(0,p.exposure-dt*2);
  if(!seen)p.heat=Math.max(0,p.heat-dt*6);
  if(!seen&&searchLeft<=0&&!p.identified)p.investigation=Math.max(0,p.investigation-dt*.9);
  if(p.exposure>2.5)arrest(state);
  const seconds=Math.max(0,Math.ceil((p.searchUntil||0)-state.elapsed));
  state.policeStatus=p.heat>0?{stage:'pursuit',seconds,label:'In pursuit'}:
    Number.isFinite(nextCall)?{stage:'witness',seconds:Math.ceil(nextCall),label:'Witness calling'}:
    seconds&&p.investigation>0?{stage:'search',seconds,label:'Area search'}:
    p.investigation>0?{stage:'on file',seconds:0,label:'Report on file'}:{stage:'clear',seconds:0,label:'Clear'};
}
export function restoreStatements(state,savedCases) {
  for(const c of state.cases){
    const source=savedCases.find(item=>item?.id===c.id);
    c.reported=source?.reported===undefined?true:Boolean(source.reported);
    for(const w of c.witnesses) {
      const saved=source?.witnesses?.find(v=>v?.id===w.id);
      w.status=['pending','reported','withdrawn','unable'].includes(saved?.status)?saved.status:'reported';
      w.officer=state.npcs.find(n=>n.id===w.id)?.role==='police';
      w.warned=Boolean(saved?.warned);
      w.reportAt=Number.isFinite(saved?.reportAt)?Math.min(state.elapsed+20,saved.reportAt):state.elapsed;
      w.description=Object.fromEntries(fieldNames.map(key=>[key,typeof saved?.description?.[key]==='string'?saved.description[key].slice(0,64):null]));
      if(!saved?.description&&w.identified)w.description.face='clear likeness';
    }
  }
}
