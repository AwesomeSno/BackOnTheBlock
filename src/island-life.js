import {buildingByType, canSee, distance, findPath, isWalkable, moveActor} from './world.js';

// A resident stays the same person across games. Only the day's encounters vary.
const profiles = [
  ['Miles Bennett','Marine electrician',31,'garage',530,1010,'watching the ferries','Closes up his mum’s shop on Tuesdays.','English','cap'],
  ['Elena Cruz','Cycle courier',27,'depot',445,935,'swapping night-market tips','Saves the prettiest stamps from undeliverable letters.','English,Spanish','braid'],
  ['June Porter','Grocer',55,'shop',390,915,'the domino table','Gives each stray cat the name of a former mayor.','English','glasses'],
  ['Samir Khan','Transmission mechanic',41,'garage',510,990,'pickup cricket','Collects matchboxes from every port he has worked in.','English,Urdu','vest'],
  ['Grace Ellis','Island paramedic',36,'clinic',360,1100,'ocean swims','Knows exactly which clinic radio needs a knock to work.','English,Spanish','bun'],
  ['Dean Mercer','Dispatch supervisor',46,'depot',385,955,'the late baseball scores','Keeps an immaculate tie and a deeply untidy desk.','English','glasses'],
  ['Victor Hale','Freight broker',50,'office',575,1050,'lunch on the quay','Always asks for the table with its back to the wall.','English','none'],
  ['Isabel Vega','Payroll clerk',33,'office',495,970,'the second-hand book stall','Marks her favourite passages with old bus tickets.','English,Spanish','bun'],
  ['Alma Reyes','Retired seamstress',66,'shop',560,800,'the morning market','Has been hemming the school uniforms on this street for thirty years.','English,Spanish','glasses'],
  ['Tomas Rivera','Breakfast cook',44,'cafe',300,770,'feeding the harbour cats','Times the bread by the first ferry horn.','English,Spanish','apron'],
  ['Officer Morgan Reed','Patrol sergeant',42,'police',360,1080,'the chess tables','Writes birthdays in the back of the duty notebook.','English','cap'],
  ['Officer Luis Santos','Harbour constable',30,'police',690,1350,'playing league football','Keeps spare laces in the glove box for the youth team.','English,Spanish','cap'],
  ['Emilia Ortiz','Radio repair student',23,'garage',555,895,'finding records','Repairs the community station’s microphones on weekends.','English,Spanish','curls'],
  ['Oscar Grant','Groundskeeper',59,'garage',345,825,'grafting fruit trees','Measures storms against a pencil mark on the pump shed.','English','cap'],
  ['Leila Demir','Bookkeeper',38,'office',515,955,'watching old thrillers','Keeps a second ledger for the island cinema club.','English,Turkish','wave'],
  ['Felix Moore','Minibus driver',54,'depot',365,880,'early coffee','Remembers his regular passengers by their stops.','English','vest'],
  ['Rosa Delgado','Home-care aide',32,'clinic',430,940,'evening walks','Grows hot peppers on a second-floor fire escape.','English,Spanish','braid'],
  ['Theo Bell','Fruit seller',35,'shop',355,845,'a five-a-side game','Sells the last pineapple at cost to whoever brings the stall home.','English','apron'],
  ['Asha Shah','Schoolteacher',47,'office',440,875,'the library shelves','Runs a homework club out of two borrowed cafe tables.','English,Gujarati','glasses'],
  ['Darren Cole','Dock labourer',26,'depot',410,895,'the repair yard','Races model sailboats made from packing scraps.','English','vest'],
  ['Cass Morgan','Community organiser',34,'office',545,1020,'the neighbourhood garden','Carries a ring of keys for half the residents on her floor.','English','buzz'],
  ['Hugo Alvarez','Forklift operator',29,'depot',370,855,'the evening football game','Is rebuilding an outboard motor one payday at a time.','English,Spanish','vest'],
  ['Pearl James','Retired music tutor',72,'cafe',600,830,'the promenade','Still tunes the piano in the upstairs dance hall.','English','glasses'],
  ['Leon Brooks','Cabinetmaker',39,'garage',465,985,'the timber auction','Keeps handwritten dimensions on the backs of receipts.','English','none'],
];

const colors = {
  skin: ['#a96e46','#b97b56','#744931','#a57356','#bd8967','#d6a583','#986344','#c99068','#a26c50','#a97555','#804f37','#bc8867','#c28b66','#6e422e','#be8c6c','#a36646','#b77b5e','#845738','#ae7654','#c48f69','#9c6c50','#a56c49','#895b40','#7f5139'],
  shirts: ['#e4ad45','#bb494f','#81a9ad','#327b88','#42a3ac','#c6c9bf','#4b5569','#dd775a','#f2c268','#e8ddc2','#334a6b','#354f73','#9a6ca7','#527856','#648caa','#b79458','#c16c54','#71a881','#af637b','#d08335','#677d9c','#e4a53c','#8596b7','#7c9c8c'],
  hair: ['#322628','#392923','#5b4034','#292625','#49372e','#554d46','#a09787','#272224'],
  pants: ['#303948','#465765','#4f5049','#364344','#454351','#424b56'],
};
const hairStyles = ['crop','braid','wave','buzz','bun','curls'];
const accessories = new Set(['cap','glasses','apron','vest']);
const byId = (state,id) => state.npcs.find(n => n.id === id);
const placeById = (state,id) => state.world.buildings.find(b => b.id === id);
const byType = (state,type) => buildingByType(state.world,type);
const clamp = (v,lo,hi) => Math.min(hi,Math.max(lo,v));
const sameRoom = (a,b) => (a.interior || null) === (b.interior || null);
const closest = (items,p) => items.reduce((best,v) => !best || distance(v,p)<distance(best,p) ? v : best,null);
const avenue = (lines,v) => lines.reduce((a,b)=>Math.abs(a-v)<Math.abs(b-v)?a:b);

function roll(life) {
  life.rng = (Math.imul(life.rng,1664525) + 1013904223) >>> 0;
  return life.rng / 4294967296;
}

function openGround(world, preferred, radius=10, interior=null, taken=[]) {
  for (let ring=0; ring<=144; ring+=12) {
    const samples=ring?16:1;
    for(let i=0;i<samples;i++){
      const angle=i*2*Math.PI/samples;
      const point={x:preferred.x+Math.cos(angle)*ring,y:preferred.y+Math.sin(angle)*ring};
      if(isWalkable(world,point.x,point.y,radius,interior) && !taken.some(other=>sameRoom({interior},other) && distance(point,other)<23)) return point;
    }
  }
  return interior?world.buildings.find(b=>b.id===interior).room.entry:world.start;
}
function identityFor(index) {
  const [name,occupation,age,work,shiftStart,shiftEnd,favorite,detail,languages,look]=profiles[index];
  return {name,age,work,occupation,shiftStart,shiftEnd,favorite,detail,languages:languages.split(','),household:'',restDay:1+(index*3)%7,
    appearance:{height:0.89+((index*7)%23)/100,build:0.84+((index*17)%39)/100,skin:colors.skin[index],hair:colors.hair[(index*3)%colors.hair.length],shirt:colors.shirts[index],pants:colors.pants[(index*5)%colors.pants.length],hairStyle:hairStyles.includes(look)?look:hairStyles[index%6],accessory:accessories.has(look)?look:'none'}};
}
const outsideWork=new Set([0,1,3,8,10,11,13,15,17,19,21]);
const gathering = ['cafe','shop','bar','office'];
function scheduleStop(state, npc, site, task, outside){
  const index=Number(npc.id.slice(4));
  const point=outside?{x:site.door.x+((index%5)-2)*19,y:site.door.y+16+(index%3)*8}:{x:205+(index%4)*69,y:322+(index%3)*22};
  return {task, targetId:site.id, outside, point:openGround(state.world,point,8,outside?null:site.id)};
}
const scheduleCache=new WeakMap();
export function residentRoutine(state,npc) {
  const i=Number(npc.id.slice(4)), id=npc.identity;
  let memo=scheduleCache.get(npc);
  const key=state.day+'-'+Math.floor(state.time/5);
  if(memo?.key===key)return memo.stop;
  const now=state.time,work=placeById(state,npc.workId),home=placeById(state,npc.homeId);
  const cafe=byType(state,'cafe'),rest=((state.day+5)%7)+1===id.restDay;
  const meal=id.shiftStart+170+(i%5)*13;
  const evening=state.world.buildings.filter(b=>b.type===gathering[i%4]);
  const haunt=evening[i%Math.max(1,evening.length)]||cafe;
  let stop;
  if(now>=id.shiftStart-60 && now<id.shiftStart && !rest)stop=scheduleStop(state,npc,cafe,'picking up breakfast',i%2===0);
  else if(now>=id.shiftStart && now<id.shiftEnd && !rest){
    if(now>=meal && now<meal+40) stop=scheduleStop(state,npc,cafe,'on a lunch break',i%3!==0);
    else if(i===13){const parks=state.world.parks;if(parks.length){const park=parks[(state.day+Math.floor(now/120))%parks.length];stop={task:'checking the park irrigation',targetId:null,outside:true,point:openGround(state.world,{x:park.x+park.w/2,y:park.y+park.h/2})};}}
    else if(i===1||i===15){const stops=['depot','shop','clinic','garage'];const site=byType(state,stops[(Math.floor((now-id.shiftStart)/90)+i)%4]);stop=scheduleStop(state,npc,site,i===1?'on the parcel round':'checking the route stops',true);}
    if(!stop)stop=scheduleStop(state,npc,work,'on shift as '+id.occupation.toLowerCase(),outsideWork.has(i));
  }else if((rest&&now>=510&&now<1150)||(now>=id.shiftEnd&&now<id.shiftEnd+145)){
    stop=scheduleStop(state,npc,haunt,id.favorite,i%4!==1);
  }else stop=scheduleStop(state,npc,home,now<355||now>1270?'asleep at home':'home for the evening',false);
  scheduleCache.set(npc,{key,stop});
  return stop;
}
function nearRoad(world,point) {
  const vx=avenue(world.roads.vertical,point.x),hy=avenue(world.roads.horizontal,point.y);
  return Math.abs(vx-point.x)<Math.abs(hy-point.y)
    ? {x:vx,y:clamp(point.y,world.roads.horizontal[0],world.roads.horizontal.at(-1)),axis:'v'}
    : {x:clamp(point.x,world.roads.vertical[0],world.roads.vertical.at(-1)),y:hy,axis:'h'};
}
function curb(world,point) {
  const road=nearRoad(world,point);
  const side=road.axis==='v' ? Math.sign(point.x-road.x)||1 : Math.sign(point.y-road.y)||1;
  const offset=world.roads.width/2+9;
  return openGround(world,{x:road.x+(road.axis==='v'?offset*side:0),y:road.y+(road.axis==='h'?offset*side:0)});
}
function shoulder(world,point){
  const road=nearRoad(world,point),off=world.roads.width*.43;
  const side=road.axis==='v'?(Math.sign(point.x-road.x)||1):(Math.sign(point.y-road.y)||1);
  return {x:road.x+(road.axis==='v'?side*off:0),y:road.y+(road.axis==='h'?side*off:0)};
}
function responseRoute(world,from,to){
  return [...roadPath(world,from,to),shoulder(world,to)];
}
function roadPath(world,from,to){
  const a=nearRoad(world,from),b=nearRoad(world,to);
  const points=[{x:a.x,y:a.y}];
  if(a.axis==='v'&&b.axis==='h')points.push({x:a.x,y:b.y});
  else if(a.axis==='h'&&b.axis==='v')points.push({x:b.x,y:a.y});
  else if(a.axis==='v'&&a.x!==b.x){
    const j=avenue(world.roads.horizontal,(a.y+b.y)/2);points.push({x:a.x,y:j},{x:b.x,y:j});
  }else if(a.axis==='h'&&a.y!==b.y){
    const j=avenue(world.roads.vertical,(a.x+b.x)/2);points.push({x:j,y:a.y},{x:j,y:b.y});
  }
  points.push({x:b.x,y:b.y});
  return points.filter((p,i,arr)=>i===0||distance(p,arr[i-1])>1);
}
function makeTraffic(state){
  const fleet=[],xs=state.world.roads.vertical,ys=state.world.roads.horizontal;
  const palette=['#307e99','#e3c14e','#be5c47','#f1eee1','#579c85','#3a5776','#d97848','#89949c'];
  for(let i=0;i<16;i++){
    const col=i%4,row=Math.floor(i/4), offset=i%2?-18:18;
    const left=xs[col]+offset,right=xs[col+1]-offset,top=ys[row]+offset,bottom=ys[row+1]-offset;
    const route=[{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom}];
    if(i%2)route.reverse();
    const segment=(col+row)%4, from=route[segment],to=route[(segment+1)%4],progress=.14+((i*7)%11)/16;
    fleet.push({id:'traffic-'+i,active:true,service:null,model:i%4,color:palette[i%palette.length],health:100,
      route,leg:(segment+1)%4,x:from.x+(to.x-from.x)*progress,y:from.y+(to.y-from.y)*progress,angle:Math.atan2(to.y-from.y,to.x-from.x),speed:0,cruise:72+(i%5)*10});
  }
  for (const [service,type,model,color] of [['ambulance','clinic',1,'#eee8d9'],['police','police',2,'#536981']]){
    const site=byType(state,type),road=nearRoad(state.world,site.door),bay=shoulder(state.world,site.door);
    fleet.push({id:'unit-'+service,active:true,service,model,color,health:100,angle:road.axis==='v'?Math.PI/2:0,speed:0,siren:false,x:bay.x,y:bay.y,route:[],leg:0,cruise:167});
  }
  return fleet;
}
export function initializeLife(state){
  state.life={version:1,rng:(state.rngState^0x937ad8)>>>0,serial:0,traffic:makeTraffic(state),speech:[],chats:[],reactions:[],history:[],incident:null,nextIncident:15,nextChat:1,incidentCount:0,lastKind:null};
  const homes=state.world.buildings.filter(b=>b.type==='home'||b.type==='apartment');
  const householdUnits=[0,1,2,3,4,5,6,1,2,7,8,9,1,10,4,11,7,9,3,10,12,11,2,12];
  const home=byType(state,'home'),placed=[state.player];
  for(const [i,npc] of state.npcs.entries()){
    if(i>=profiles.length)continue;
    const data=identityFor(i);npc.name=data.name;npc.age=data.age;
    const jobs=state.world.buildings.filter(b=>b.type===data.work);
    const address=homes[(householdUnits[i]*3)%Math.max(homes.length,1)]||home;
    npc.homeId=address.id;npc.workId=(jobs[(i<12?0:i)%Math.max(1,jobs.length)]||byType(state,'office')).id;
    npc.identity={occupation:data.occupation,languages:data.languages,household:address.name+' · unit '+(1+householdUnits[i]),detail:data.detail,favorite:data.favorite,shiftStart:data.shiftStart,shiftEnd:data.shiftEnd,restDay:data.restDay};
    npc.appearance=data.appearance;npc.color=data.appearance.shirt;npc.pose=null;npc.ambientBusy=false;npc.inServiceVehicle=null;
    if(i!==0){
      const routine=residentRoutine(state,npc);
      let preferred=routine.point,interior=routine.outside?null:routine.targetId;
      // The open market is on this street every morning. Four residents already
      // have a reason to be outside when a new game opens.
      if([8,13,17,22].includes(i)){
        const m=[8,13,17,22].indexOf(i);
        preferred={x:home.door.x+[-80,-45,95,130][m],y:home.door.y+[37,56,42,58][m]};
        interior=null;npc.scheduleAt=32+m*3;npc.task=['picking out something for breakfast','collecting the empty planters','unloading the fruit stall','walking to the morning market'][m];
      }else npc.task=routine.task;
      Object.assign(npc,openGround(state.world,preferred,10,interior,placed),{interior});
    }
    placed.push(npc);
  }
}

export function sayLine(state,speaker,text,kind='dialogue'){
  if(!state.life||!speaker||!text)return;
  const direct=kind==='dialogue';
  if(direct&&speaker===state.player) state.life.speech=state.life.speech.filter(line=>line.kind!=='dialogue');
  const latest=direct?state.life.speech.filter(line=>line.kind==='dialogue'&&line.until>state.elapsed).at(-1):null;
  const start=latest?latest.until:state.elapsed;
  const line={
    id:'line-'+(++state.life.serial),speakerId:speaker.id||'player',speaker:speaker.name||'Alex',
    text:String(text).slice(0,450),kind,start,until:start+clamp(text.length/17,2.15,direct?15:6.5),
    x:speaker.x,y:speaker.y,interior:speaker.interior||null,
  };
  state.life.speech.push(line);
  if(state.life.speech.length>30)state.life.speech.shift();
}
export function audibleLines(state){
  const p=state.player;
  const lines=(state.life?.speech||[]).filter(line=>{
    if(line.start>state.elapsed||line.until<state.elapsed||!sameRoom(p,line))return false;
    if(line.speakerId==='player') return true;
    const range=line.kind==='dialogue'?240:178;
    return distance(p,line)<range&&canSee(state.world,p,line);
  });
  const direct=lines.filter(l=>l.kind==='dialogue');
  return direct.length?direct.slice(-1):lines.sort((a,b)=>distance(a,p)-distance(b,p)).slice(0,2);
}
const talkTopics=[
  ['You seen the gull that steals receipts?','Only bird on the island keeping proper books.'],
  ['They changed the ferry timetable again.','The ferry knows that?'],
  ['My landlord calls the leak a water feature.','Does the rent include swimming lessons?'],
  ['That fruit stall was my classroom once.','Well, the mangoes are finally doing homework.'],
  ['¿Todo bien? You look tired.','Night shift. Even the coffee wants to go home.'],
  ['Tell me they fixed the streetlight.','They put reflective tape on it. Looks great in sunlight.'],
  ['Radio says we’re getting rain.','Then the washing’s coming back in. Again.'],
  ['¿Trajiste las llaves? The spare keys?','In my pocket. Check the blue tape.'],
  ['You still playing on Friday?','Yeah. Tell them my knee has officially stopped complaining.'],
  ['The council’s resurfacing Harbour Road.','Which part? The bit outside the councillor’s house?'],
  ['Your aunt still makes those coconut buns?','Saturday mornings. Get there before the choir.'],
  ['First ferry was empty today.','Everyone heard about the new baggage fee.'],
];
function freeForLife(state,npc){
  if(!npc||npc.hp<50||npc.ambientBusy||npc.inServiceVehicle||npc.passengerOf||npc.panicUntil>state.elapsed||npc.conversationUntil>state.elapsed||npc.id===state.player.companionId)return false;
  return !(state.events||[]).some(e=>(e.stage==='open'||e.stage==='accepted')&&e.npcId===npc.id&&e.type!=='dropped_wallet'&&e.type!=='lost_bag');
}
function startChat(state){
  const life=state.life;
  if(life.chats.length>=3)return;
  const residents=state.npcs.filter(n=>freeForLife(state,n)&&n.id!=='npc-0'&&!(n.task||'').includes('asleep'));
  const candidates=[];
  for(let i=0;i<residents.length;i++)for(let j=i+1;j<residents.length;j++){
    const a=residents[i],b=residents[j],d=distance(a,b);
    if(sameRoom(a,b)&&d<96&&d>12&&canSee(state.world,a,b)&&Math.max(a.socialAfter||0,b.socialAfter||0)<=state.elapsed) candidates.push({a,b});
  }
  if(!candidates.length)return;
  let pair=candidates[Math.floor(roll(life)*candidates.length)];
  if(life.serial===0)pair=candidates.find(c=>c.a.id==='npc-8'&&c.b.id==='npc-13')||pair;
  const {a,b}=pair;
  const topic=Math.floor(roll(life)*talkTopics.length);
  const lines=topic===4||topic===7 ? (a.identity.languages.includes('Spanish')&&b.identity.languages.includes('Spanish') ? talkTopics[topic] : talkTopics[8]) : talkTopics[topic];
  const recent=life.history.at(-1);
  const remarks=recent&&state.elapsed-recent.at<90&&[a,b].some(n=>recent.witnesses?.includes(n.id)) ? (recent.kind==='accident'?['That crossing needs a light. Someone just got hit there.','I saw the ambulance. I hope they’re all right.']:['Someone’s bag got taken right outside.','So that’s why the patrol car came through.']):lines;
  a.ambientBusy=b.ambientBusy=true;a.pose=b.pose='talk';a.task='talking with '+b.name;b.task='talking with '+a.name;
  a.angle=Math.atan2(b.y-a.y,b.x-a.x);b.angle=a.angle+Math.PI;a.moving=b.moving=false;
  sayLine(state,a,remarks[0],'ambient');
  life.chats.push({a:a.id,b:b.id,reply:remarks[1],at:state.elapsed+2.8,end:state.elapsed+6.9,answered:false});
}
function updateChats(state){
  const life=state.life;
  for(let i=life.chats.length-1;i>=0;i--){
    const chat=life.chats[i],a=byId(state,chat.a),b=byId(state,chat.b);
    const interrupted=!a||!b||!sameRoom(a,b)||distance(a,b)>115||[a,b].some(n=>n.hp<50||n.id===state.player.companionId||n.conversationUntil>state.elapsed);
    if(interrupted||state.elapsed>=chat.end){
      for(const n of [a,b])if(n){n.ambientBusy=false;n.pose=null;n.socialAfter=state.elapsed+18;}
      life.chats.splice(i,1);
    }else if(!chat.answered&&state.elapsed>=chat.at){
      chat.answered=true;sayLine(state,b,chat.reply,'ambient');
    }
  }
  if(state.elapsed>=life.nextChat){startChat(state);life.nextChat=state.elapsed+2.5+roll(life)*4;}
}
function vehicleAdvance(car,dt,speed,repeat){
  const dest=car.route[car.leg];
  if(!dest){car.speed=0;return true;}
  const dx=dest.x-car.x,dy=dest.y-car.y,length=Math.hypot(dx,dy);
  if(length>.01)car.angle=Math.atan2(dy,dx);
  const step=Math.min(length,speed*dt);
  if(length>.01){car.x+=dx/length*step;car.y+=dy/length*step;}
  car.speed=speed;
  if(length-step<1){
    car.leg++;
    if(repeat)car.leg%=car.route.length;
    else if(car.leg>=car.route.length){car.speed=0;return true;}
  }
  return false;
}
function emergencyConflict(car,unit){
  if(!unit.siren||unit.speed<4)return false;
  const ux=Math.cos(unit.angle),uy=Math.sin(unit.angle),dx=car.x-unit.x,dy=car.y-unit.y;
  const front=dx*ux+dy*uy,lateral=Math.abs(dx*uy-dy*ux);
  if(front< -8||front>160||lateral>95)return false;
  if(lateral<31)return true;
  // Where two roads cross, compare the cars' projected positions. Parallel
  // traffic on the next street should never brake for an unrelated call.
  const vx=Math.cos(car.angle)*car.speed-ux*unit.speed,vy=Math.sin(car.angle)*car.speed-uy*unit.speed;
  const t=clamp(-(dx*vx+dy*vy)/(vx*vx+vy*vy||1),0,1.0);
  return Math.hypot(dx+t*vx,dy+t*vy)<31;
}
const junctionReservations=new WeakMap();
function junctions(state){
  let reservations=junctionReservations.get(state);
  if(!reservations){reservations=new Map();junctionReservations.set(state,reservations);}
  for(const [key,permit] of reservations){
    const car=permit.car;
    if(car.incidentId||car.resumeRoute||distance(car,permit.center)>114){reservations.delete(key);continue;}
    // A car joining a lane during a dispatch detour can end up ahead of its
    // permit holder. Let the physical head of the queue clear the crossing.
    const target=car.route[car.leg],cx=Math.cos(car.angle),cy=Math.sin(car.angle);
    if(!target||distance(target,permit.center)>36)continue;
    let head=car,best=0;
    for(const other of state.life.traffic){
      const goal=other.route[other.leg];
      if(other===car||other.service||other.incidentId||other.resumeRoute||!goal||distance(goal,permit.center)>36)continue;
      const dx=other.x-car.x,dy=other.y-car.y,front=dx*cx+dy*cy;
      if(front>best&&front<100&&Math.abs(dx*cy-dy*cx)<17&&Math.cos(other.angle-car.angle)>.7){head=other;best=front;}
    }
    permit.car=head;
  }
  return reservations;
}
function driveTraffic(state,dt) {
  const life=state.life,crossings=junctions(state);
  for(const car of life.traffic){
    if(car.service||car.incidentId)continue;
    if(car.resumeRoute){
      if(vehicleAdvance(car,dt,car.cruise*.8,false)){
        car.route=car.resumeRoute;car.leg=car.rejoinIndex||0;car.resumeRoute=null;
      }
      continue;
    }
    const target=car.route[car.leg],remaining=distance(car,target);
    const horizontal=Math.abs(Math.cos(car.angle))>.7;
    const signal=(Math.floor(state.elapsed/7)+Math.round(target.x/640)+Math.round(target.y/640))%2;
    let waitForTurn=false;
    if(remaining<98){
      const center={x:avenue(state.world.roads.vertical,target.x),y:avenue(state.world.roads.horizontal,target.y)};
      const key=center.x+','+center.y,permit=crossings.get(key);
      if(!permit){
        if((horizontal?signal!==0:signal!==1)||remaining<32)crossings.set(key,{car,center});
        else waitForTurn=true;
      }else waitForTurn=permit.car!==car;
    }
    const dirX=Math.cos(car.angle),dirY=Math.sin(car.angle);
    const vehicles=life.traffic;
    let hazard=waitForTurn;
    const priority=vehicles.find(unit=>unit.service&&emergencyConflict(car,unit));
    car.yieldingTo=priority?.id||null;
    if(priority){
      hazard=true;
      const sameHeading=Math.cos(car.angle-priority.angle)>.8;
      if(sameHeading){
        // Ease towards the outside of this lane, keeping the crossing clear.
        if(horizontal){const side=Math.sign(dirX);car.y+=clamp(target.y+10*side-car.y,-12*dt,12*dt);}
        else{const side=-Math.sign(dirY);car.x+=clamp(target.x+10*side-car.x,-12*dt,12*dt);}
      }
    }
    for(const other of vehicles){
      if(other===car||!other.active||Math.abs(car.x-other.x)>85||Math.abs(car.y-other.y)>85)continue;
      const dx=other.x-car.x,dy=other.y-car.y,front=dx*dirX+dy*dirY;
      const sameLane=Math.cos(other.angle-car.angle)>.68;
      if(sameLane&&front>0&&front<48&&Math.abs(dx*dirY-dy*dirX)<15){hazard=true;break;}
    }
    // A driver can stop for the player and for people using a crossing.
    if(!hazard){
      const p=state.player;
      const dx=p.x-car.x,dy=p.y-car.y,front=dx*dirX+dy*dirY;
      hazard=!p.interior&&front>0&&front<(p.vehicleId?56:38)&&Math.abs(dx*dirY-dy*dirX)<(p.vehicleId?19:12);
    }
    if(!hazard){
      for(const person of state.npcs){
        if(person.interior||person.inServiceVehicle||person.passengerOf||!person.moving)continue;
        const dx=person.x-car.x,dy=person.y-car.y,front=dx*dirX+dy*dirY;
        if(front>0&&front<40&&Math.abs(dx*dirY-dy*dirX)<12){hazard=true;break;}
      }
    }
    car.braking=Boolean(hazard&&car.speed>3);
    const speed=hazard?Math.max(0,car.speed-dt*220):Math.min(car.cruise,car.speed+dt*49);
    vehicleAdvance(car,dt,speed,true);
  }
}
const moves=new WeakMap();
function walk(state,npc,goal,room,dt,speed){
  if(npc.interior&&npc.interior!==room){
    const building=placeById(state,npc.interior);
    if(walkSame(state,npc,building.room.exit,dt,speed)){
      npc.interior=null;Object.assign(npc,openGround(state.world,building.door));moves.delete(npc);npc.path=[];
    }
    return false;
  }
  if(!npc.interior&&room){
    const building=placeById(state,room);
    if(walkSame(state,npc,building.door,dt,speed)){
      npc.interior=room;Object.assign(npc,building.room.entry);moves.delete(npc);npc.path=[];
    }
    return false;
  }
  return walkSame(state,npc,goal,dt,speed);
}
function walkSame(state,npc,goal,dt,speed){
  if(distance(npc,goal)<9){npc.moving=false;return true;}
  let route=moves.get(npc);
  if(!route||route.room!==npc.interior||distance(route.goal,goal)>13){
    route={goal:{...goal},room:npc.interior,path:findPath(state.world,npc,{...goal,interior:npc.interior})||[],index:0};
    moves.set(npc,route);
  }
  let target=route.path[route.index]||goal;
  while(distance(npc,target)<7&&route.index<route.path.length){route.index++;target=route.path[route.index]||goal;}
  const d=distance(npc,target);
  if(d<1)return false;
  const pace=Math.min(speed*dt,d),oldX=npc.x,oldY=npc.y;
  moveActor(state.world,npc,(target.x-npc.x)*pace/d,(target.y-npc.y)*pace/d);
  npc.moving=distance(npc,{x:oldX,y:oldY})>.05;
  npc.angle=Math.atan2(target.y-oldY,target.x-oldX);
  if(!npc.moving)moves.delete(npc);
  return distance(npc,goal)<10;
}
function reserve(npc,task){
  npc.ambientBusy=true;npc.path=[];moves.delete(npc);npc.moving=false;npc.task=task;npc.pose=null;
}
function release(npc){
  if(!npc)return;
  npc.ambientBusy=false;npc.inServiceVehicle=null;npc.pose=null;npc.path=[];moves.delete(npc);
}
function transition(state,event,stage){event.stage=stage;event.stageAt=state.elapsed;}
function setRoute(car,path){car.route=path;car.leg=0;car.speed=0;}
function seated(npc,car){npc.inServiceVehicle=car.id;npc.passengerOf=car.id;npc.interior=null;npc.x=car.x;npc.y=car.y;npc.moving=false;}
function stepOut(state,npc,car,spot){
  npc.inServiceVehicle=null;npc.passengerOf=null;npc.interior=null;
  const p=openGround(state.world,spot||car,9,null,state.npcs.filter(n=>n!==npc&&!n.interior&&!n.inServiceVehicle));
  Object.assign(npc,p);npc.path=[];moves.delete(npc);
}
function announceStreet(state,actor,line){sayLine(state,actor,line,'ambient');}
function memory(npc,key,text,state){
  if(npc.memories.some(m=>m.key===key))return;
  npc.memories.unshift({key,text,day:state.day,time:state.time});
  npc.memories=npc.memories.slice(0,18);
}
function pickParticipants(state,kind){
  const life=state.life;
  let available=state.npcs.filter(n=>freeForLife(state,n)&&!['friend','police','nurse','dispatcher','broker','courier'].includes(n.role));
  if(available.length<2)return null;
  const local=n=>n.interior?placeById(state,n.interior).door:n;
  const outdoors=available.filter(n=>!n.interior);
  if(outdoors.length>1)available=outdoors;
  const preferred=life.incidentCount===0?byType(state,'home').door:null;
  const victim=preferred?closest(available,preferred):available[Math.floor(roll(life)*available.length)];
  const near=available.filter(n=>n!==victim).map(n=>({n,d:distance(local(n),local(victim)),tie:roll(life)*110})).sort((a,b)=>(a.d+a.tie)-(b.d+b.tie));
  // On a bad day someone from the cash-in-hand crew may take a risk.
  // A retiree or the person waiting for a bus does not suddenly become a robber.
  const crew=new Set(['npc-15','npc-19','npc-21','npc-23']);
  if(kind==='robbery'){
    const possible=state.npcs.filter(n=>n!==victim&&crew.has(n.id)&&freeForLife(state,n));
    if(!possible.length)return null;
    possible.sort((a,b)=>distance(local(a),local(victim))-distance(local(b),local(victim)));
    return {victim,actor:possible[0],site:curb(state.world,local(victim))};
  }
  const actor=near[0].n;
  return {victim,actor,site:curb(state.world,local(victim))};
}
function startIncident(state){
  const life=state.life;
  const lastTwo=life.history.slice(-2);
  const repeatLimit=lastTwo.length===2&&lastTwo[0].kind===lastTwo[1].kind;
  const other=life.lastKind==='accident'?'robbery':'accident';
  // Each opening includes one example of both systems. Later calls vary with
  // traffic hours, and consecutive occurrences are perfectly possible.
  const commute=(state.time>=380&&state.time<590)||(state.time>=990&&state.time<1150);
  const kind=life.incidentCount===1||repeatLimit?other:(roll(life)<(commute?.58:.38)?'accident':'robbery');
  const people=pickParticipants(state,kind);
  if(!people)return false;
  const {victim,actor,site}=people;
  const responders=state.npcs.filter(n=>freeForLife(state,n)&&(kind==='accident'?n.id==='npc-4'||n.id==='npc-16':n.role==='police'&&state.player.heat<=0));
  if(!responders.length)return false;
  const responder=responders.find(n=>n.id!==actor.id&&n.id!==victim.id);
  if(!responder)return false;
  const event={id:'street-'+(++life.serial),kind,victimId:victim.id,actorId:actor.id,responderId:responder.id,unitId:'unit-'+(kind==='accident'?'ambulance':'police'),trafficId:null,site,stage:'approach',stageAt:state.elapsed,start:state.elapsed,witnesses:[],amount:0};
  const road=nearRoad(state.world,site);
  event.road={x:road.x,y:road.y};event.axis=road.axis;
  // Incidents happen on the road grid. They are selected from the residents'
  // locations and are never relocated around a moving camera.
  if(kind==='accident'){
    const choices=life.traffic.filter(v=>!v.service&&!v.incidentId);
    const car=closest(choices,site);
    if(!car)return false;
    event.trafficId=car.id;
    car.incidentId=event.id;car.resumeLeg=car.leg;car.resumeRoute=car.route;
    const approach=road.axis==='v'?{x:road.x,y:clamp(road.y-85,state.world.roads.horizontal[0],state.world.roads.horizontal.at(-1))}:{x:clamp(road.x-85,state.world.roads.vertical[0],state.world.roads.vertical.at(-1)),y:road.y};
    setRoute(car,roadPath(state.world,car,approach));event.crashSpot=road;
    reserve(actor,'waiting at the crossing');
  } else reserve(actor,'catching up with '+victim.name.split(' ')[0]);
  reserve(victim,kind==='accident'?'walking to the crossing':'taking the pavement home');
  reserve(responder,kind==='accident'?'on medical standby':'on patrol');
  if(responder.interior===state.homeId)responder.task='covering the on-call shift';
  life.incident=event;life.incidentCount++;life.lastKind=kind;
  return true;
}
function releaseTraffic(state,event){
  const car=state.life.traffic.find(v=>v.id===event.trafficId);
  if(!car||!car.incidentId)return;
  const original=car.resumeRoute;
  car.incidentId=null;
  if(!original?.length)return;
  const join=closest(original,car);
  car.rejoinIndex=(original.indexOf(join)+1)%original.length;
  setRoute(car,[...roadPath(state.world,car,join),{x:join.x,y:join.y}]);
}
function conclude(state,event,outcome){
  const life=state.life, responders=state.npcs.filter(n=>[event.responderId,event.actorId,event.victimId].includes(n.id));
  for(const n of responders){
    if(n.inServiceVehicle){const car=life.traffic.find(v=>v.id===n.inServiceVehicle);if(car)stepOut(state,n,car);}
    release(n);
  }
  const unit=life.traffic.find(v=>v.id===event.unitId);if(unit){unit.siren=false;unit.speed=0;unit.route=[];unit.leg=0;}
  releaseTraffic(state,event);
  if(outcome){
    life.history.push({id:event.id,kind:event.kind,outcome,at:state.elapsed,day:state.day,time:state.time,victimId:event.victimId,actorId:event.actorId,responderId:event.responderId,witnesses:event.witnesses.slice()});
    if(life.history.length>35)life.history.shift();
  }
  life.incident=null;life.nextIncident=state.elapsed+38+roll(life)*58;
}
function markWitnesses(state,e){
  const victim=byId(state,e.victimId);
  const eyes=state.npcs.filter(n=>!n.interior&&!n.inServiceVehicle&&!n.passengerOf&&n.hp>20&&distance(n,victim)<200&&canSee(state.world,n,victim));
  e.witnesses=[...new Set([e.victimId,e.actorId,...eyes.map(n=>n.id)])];
  if(e.kind==='accident'){
    memory(byId(state,e.actorId),e.id,'I was standing at the crossing when the car hit that pedestrian. I called it in.',state);
  }
  for(const n of eyes){
    if([e.victimId,e.actorId,e.responderId].includes(n.id))continue;
    const observed=e.kind==='accident'?'I saw the car hit someone as they crossed the street.':'I saw someone grab a bag and run from the pavement.';
    memory(n,e.id+'-witness',observed,state);
    if(n.id===state.player.companionId||n.policeDuty||n.conversationUntil>state.elapsed)continue;
    const chat=state.life.chats.find(c=>c.a===n.id||c.b===n.id);
    if(chat){chat.end=state.elapsed;updateChats(state);}
    if(!freeForLife(state,n))continue;
    const stepAway=e.kind==='robbery'&&roll(state.life)<.65;
    reserve(n,stepAway?'moving back from the commotion':'watching the street');
    const d=Math.max(1,distance(n,victim));
    const back=openGround(state.world,{x:n.x+(n.x-victim.x)/d*29,y:n.y+(n.y-victim.y)/d*29});
    n.angle=Math.atan2(victim.y-n.y,victim.x-n.x);
    state.life.reactions.push({npcId:n.id,until:state.elapsed+3+roll(state.life)*3,point:stepAway?back:null});
  }
}
function updateReactions(state,dt){
  const list=state.life.reactions;
  for(let i=list.length-1;i>=0;i--){
    const reaction=list[i],n=byId(state,reaction.npcId);
    if(!n||n.hp<=0||n.id===state.player.companionId||n.conversationUntil>state.elapsed||reaction.until<=state.elapsed){
      if(n)release(n);list.splice(i,1);continue;
    }
    if(reaction.point)walk(state,n,reaction.point,null,dt,55);
  }
}
function advanceIncident(state,dt){
  const life=state.life,e=life.incident,a=byId(state,e.actorId),v=byId(state,e.victimId),r=byId(state,e.responderId);
  const car=life.traffic.find(n=>n.id===e.trafficId),unit=life.traffic.find(n=>n.id===e.unitId);
  const medical=e.kind==='accident',stageTime=state.elapsed-e.stageAt;
  if(!a||!v||!r||!unit||r.hp<=0||a.hp<=0||v.hp<=0||state.elapsed-e.start>270){conclude(state,e,null);return;}
  const destination=byType(state,medical?'clinic':'police');
  const passenger=medical?v:a;
  if(e.stage==='approach'){
    const isThere=walk(state,v,e.site,null,dt,71);
    if(medical){
      const step=e.axis==='v'?{x:e.site.x,y:e.site.y+24}:{x:e.site.x+24,y:e.site.y};
      const actorThere=walk(state,a,step,null,dt,74),carThere=vehicleAdvance(car,dt,108,false);
      if(isThere&&actorThere&&carThere){
        transition(state,e,'crossing');setRoute(car,[e.crashSpot]);
        announceStreet(state,v,'I can make the light.');
      }
    }else{
      const actorThere=walk(state,a,{x:e.site.x+12,y:e.site.y+11},null,dt,90);
      if(isThere&&actorThere&&distance(a,v)<39){
        e.amount=Math.min(v.cash,16+Math.floor(roll(life)*18));v.cash-=e.amount;a.cash+=e.amount;
        announceStreet(state,v,'Hey! That’s my bag!');
        memory(v,e.id,'Someone grabbed my bag on the way home.',state);
        const along=e.axis==='v'?{x:e.site.x,y:clamp(e.site.y+145,95,state.world.height-95)}:{x:clamp(e.site.x+145,95,state.world.width-95),y:e.site.y};
        e.flee=openGround(state.world,along);a.task='running with the stolen bag';v.task='calling in the theft';
        e.canEscape=life.incidentCount>2&&roll(life)<0.22;markWitnesses(state,e);transition(state,e,'report');
      }
    }
    return;
  }
  if(e.stage==='crossing'){
    const pedestrianReady=walk(state,v,e.crashSpot,null,dt,67);
    if(distance(v,e.crashSpot)<34)vehicleAdvance(car,dt,91,false);
    if(distance(car,v)<23||(pedestrianReady&&distance(car,e.crashSpot)<12)){
      car.speed=0;v.hp=Math.min(v.hp,33);v.pose='fallen';v.moving=false;v.task='waiting for medical help';
      a.task='calling the ambulance';a.moving=false;markWitnesses(state,e);
      state.effects.push({kind:'burst',x:v.x,y:v.y,life:.55,color:'#f4c571'});
      announceStreet(state,a,'Call the clinic! Someone’s down at the crossing.');
      memory(v,e.id,'A car caught me at the crossing. A passerby called for help.',state);
      transition(state,e,'report');
    }
    return;
  }
  if(!medical&&['report','pickup','enroute'].includes(e.stage)){
    const gotAway=walk(state,a,e.flee,null,dt,82);
    if(gotAway&&e.canEscape&&state.elapsed-e.start>44){conclude(state,e,a.name+' got away with the bag.');return;}
  }
  if(e.stage==='report'){
    if(stageTime<2)return;
    const current=r.interior?placeById(state,r.interior).door:r;
    e.pickup=curb(state.world,current);setRoute(unit,responseRoute(state.world,unit,e.pickup));
    r.task=medical?'answering an emergency call':'responding to a reported theft';unit.siren=true;
    announceStreet(state,medical?a:v,medical?'Stay with me. An ambulance is coming.':'I can describe them. I’m still here.');
    transition(state,e,'pickup');
  }else if(e.stage==='pickup'){
    const ready=walk(state,r,e.pickup,null,dt,101);
    const arrived=vehicleAdvance(unit,dt,unit.cruise,false);
    if(ready&&arrived){
      seated(r,unit);setRoute(unit,responseRoute(state.world,unit,e.site));transition(state,e,'enroute');
    }
  }else if(e.stage==='enroute'){
    const arrived=vehicleAdvance(unit,dt,unit.cruise,false);seated(r,unit);
    if(arrived){
      stepOut(state,r,unit);r.task=medical?'reaching the patient':'locating the reported suspect';
      announceStreet(state,r,medical?'Ambulance crew. Give us some room, please.':'Island patrol. Where did they go?');
      transition(state,e,'attend');
    }
  }else if(e.stage==='attend'){
    const offset={x:passenger.x+14,y:passenger.y+4};
    if(walk(state,r,offset,null,dt,117)&&distance(r,passenger)<37){
      r.pose=medical?'treat':null;r.task=medical?'treating a casualty':'making an arrest';
      if(medical){announceStreet(state,r,'Can you tell me your name? We’re going to get you up.');}
      else{
        a.pose='cuffed';a.moving=false;a.task='in police custody';
        announceStreet(state,r,'I’m taking you to the station.');
        memory(a,e.id,'I spent the afternoon at the station after taking a bag.',state);
      }
      transition(state,e,'assess');
    }
  }else if(e.stage==='assess'){
    if(stageTime<4)return;
    r.pose=null;
    if(medical){
      v.hp=Math.max(v.hp,52);v.pose=null;v.task='being helped to the ambulance';
      r.task='escorting the patient';transition(state,e,'board');
    }else{
      v.task='waiting to recover the bag';r.task='returning recovered property';
      transition(state,e,'handover');
    }
  }else if(e.stage==='handover'){
    const returned=walk(state,r,{x:v.x+13,y:v.y+4},null,dt,82);
    walk(state,a,{x:r.x+12,y:r.y+12},null,dt,83);
    if(returned&&distance(r,v)<31){
      const recovered=Math.min(a.cash,e.amount);a.cash-=recovered;v.cash+=recovered;
      announceStreet(state,v,'That’s mine. The strap was like that already.');
      r.task='escorting a detainee';transition(state,e,'board');
    }
  }else if(e.stage==='board'){
    const arrived=walk(state,r,unit,null,dt,79);
    const boarded=walk(state,passenger,{x:unit.x+8,y:unit.y+6},null,dt,medical?52:75);
    if(arrived&&boarded){
      seated(r,unit);seated(passenger,unit);setRoute(unit,responseRoute(state.world,unit,destination.door));
      unit.siren=medical;transition(state,e,'transport');releaseTraffic(state,e);
    }
  }else if(e.stage==='transport'){
    const atStation=vehicleAdvance(unit,dt,unit.cruise*.91,false);seated(r,unit);seated(passenger,unit);
    if(atStation){stepOut(state,r,unit);stepOut(state,passenger,unit);unit.siren=false;transition(state,e,'admit');}
  }else if(e.stage==='admit'){
    const ready=walk(state,r,{x:285,y:357},destination.id,dt,83);
    const admitted=walk(state,passenger,{x:365,y:360},destination.id,dt,67);
    if(ready&&admitted){
      if(medical){v.hp=Math.max(v.hp,78);v.task='recovering at the clinic';}
      else{a.task='being booked at the station';}
      passenger.scheduleAt=state.elapsed+44;r.scheduleAt=state.elapsed+9;
      conclude(state,e,medical?r.name+' brought '+v.name+' to the clinic.':r.name+' arrested '+a.name+' and recovered '+v.name+'’s bag.');
    }
  }
}
export function updateLife(state,dt){
  const life=state.life;
  if(!life||!dt)return;
  life.speech=life.speech.filter(line=>line.until>state.elapsed);
  driveTraffic(state,dt);
  updateChats(state);
  updateReactions(state,dt);
  if(life.incident)advanceIncident(state,dt);
  else if(state.elapsed>=life.nextIncident && !startIncident(state))life.nextIncident=state.elapsed+4;
}

const finite=(x,lo,hi)=>typeof x==='number'&&Number.isFinite(x)&&x>=lo&&x<=hi;
const stages=['approach','crossing','report','pickup','enroute','attend','assess','handover','board','transport','admit'];
export function restoreLife(state,data){
  // createGame has already assigned fixed profiles and a valid fleet. Only
  // accept positions, participant references and route points on this island.
  const raw=data?.life,life=state.life;
  if(!raw||raw.version!==1||!life)return;
  const point=p=>p&&finite(p.x,0,state.world.width)&&finite(p.y,0,state.world.height);
  const clean=p=>({x:p.x,y:p.y});
  const validPath=a=>Array.isArray(a)&&a.length<=30&&a.every(point);
  const validId=id=>typeof id==='string'&&Boolean(byId(state,id));
  for(const key of ['serial','incidentCount','rng'])if(finite(raw[key],0,0xffffffff))life[key]=Math.floor(raw[key]);
  life.nextIncident=finite(raw.nextIncident,0,state.elapsed+240)?raw.nextIncident:state.elapsed+18;
  life.nextChat=state.elapsed+2;
  life.lastKind=['robbery','accident'].includes(raw.lastKind)?raw.lastKind:null;
  const active=raw.incident;
  if(active&&['robbery','accident'].includes(active.kind)&&stages.includes(active.stage)&&
     [active.actorId,active.victimId,active.responderId].every(validId)&&new Set([active.actorId,active.victimId,active.responderId]).size===3&&
     point(active.site)&&point(active.road)&&finite(active.stageAt,0,state.elapsed+.1)&&finite(active.start,0,state.elapsed+.1)&&
     (active.kind!=='robbery'||active.stage!=='crossing')&&
     (active.kind!=='accident'||active.stage!=='handover')&&
     (active.kind==='robbery'||(point(active.crashSpot)&&life.traffic.some(v=>v.id===active.trafficId&&!v.service)))&&
     (active.kind==='accident'||active.stage==='approach'||point(active.flee))&&
     (active.stage!=='pickup'||point(active.pickup))&&typeof active.id==='string'){
    const e=life.incident={id:active.id.slice(0,70),kind:active.kind,stage:active.stage,actorId:active.actorId,victimId:active.victimId,
      responderId:active.responderId,start:active.start,stageAt:active.stageAt,unitId:'unit-'+(active.kind==='accident'?'ambulance':'police'),
      trafficId:active.kind==='accident'?active.trafficId:null,amount:finite(active.amount,0,100)?active.amount:0,
      witnesses:Array.isArray(active.witnesses)?active.witnesses.filter(validId).slice(0,28):[],axis:active.axis==='v'?'v':'h',canEscape:Boolean(active.canEscape)};
    for(const key of ['site','road','crashSpot','flee','pickup'])if(point(active[key]))e[key]=clean(active[key]);
    for(const id of [e.actorId,e.victimId,e.responderId]){
      const npc=byId(state,id),old=Array.isArray(data.npcs)&&data.npcs.find(n=>n?.id===id);
      reserve(npc,typeof old?.task==='string'?old.task.slice(0,100):'responding to a street incident');
      if(['treat','fallen','cuffed'].includes(old?.pose))npc.pose=old.pose;
      if(old?.inServiceVehicle===e.unitId){npc.inServiceVehicle=e.unitId;npc.passengerOf=e.unitId;}
    }
  }
  if(Array.isArray(raw.traffic)){
    for(const car of life.traffic){
      const old=raw.traffic.find(v=>v?.id===car.id);
      if(!point(old)||!validPath(old.route))continue;
      const pending=life.incident?.trafficId===car.id&&old.incidentId===life.incident.id;
      if(!car.service&&(!pending&&!old.resumeRoute&&!old.route.length))continue;
      Object.assign(car,clean(old),{angle:finite(old.angle,-8,8)?old.angle:0,speed:finite(old.speed,0,250)?old.speed:0});
      if(car.service||pending||validPath(old.resumeRoute)){
        car.route=old.route.map(clean);
        if(!car.service&&old.resumeRoute?.length&&validPath(old.resumeRoute))car.resumeRoute=old.resumeRoute.map(clean);
        if(pending)car.incidentId=life.incident.id;
        if(car.resumeRoute&&!pending){
          if(finite(old.rejoinIndex,0,car.resumeRoute.length-1))car.rejoinIndex=Math.floor(old.rejoinIndex);
          else{const next=closest(car.resumeRoute,car);car.rejoinIndex=(car.resumeRoute.indexOf(next)+1)%car.resumeRoute.length;setRoute(car,roadPath(state.world,car,next));continue;}
        }
      }
      car.leg=finite(old.leg,0,car.route.length)?Math.floor(old.leg):0;
      if(!car.service&&!car.incidentId&&!car.resumeRoute?.length)car.leg%=car.route.length;
      car.siren=Boolean(old.siren&&life.incident?.unitId===car.id);
    }
  }
  for(const person of state.npcs){
    if(!person.inServiceVehicle)continue;
    const unit=life.traffic.find(v=>v.id===person.inServiceVehicle);
    if(unit)seated(person,unit);
  }
  if(Array.isArray(raw.history))life.history=raw.history.filter(h=>h&&['accident','robbery'].includes(h.kind)&&validId(h.actorId)&&validId(h.victimId)&&validId(h.responderId)&&typeof h.outcome==='string'&&finite(h.at,0,state.elapsed+.1)).slice(-35).map(h=>({
    id:String(h.id).slice(0,70),kind:h.kind,outcome:h.outcome.slice(0,250),at:h.at,day:h.day,time:h.time,actorId:h.actorId,victimId:h.victimId,responderId:h.responderId,witnesses:Array.isArray(h.witnesses)?h.witnesses.filter(validId).slice(0,28):[],
  }));
}
