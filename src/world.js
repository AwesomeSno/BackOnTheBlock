// Incident randomness is independent of the fixed island geography.
export function hashSeed(seed) {
  let hash = 2166136261;
  for (const char of String(seed)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0 || 1;
}
export function random(state) {
  let value = state.rngState += 0x6D2B79F5;
  value = Math.imul(value ^ value >>> 15, value | 1);
  value ^= value + Math.imul(value ^ value >>> 7, value | 61);
  state.rngState >>>= 0;
  return ((value ^ value >>> 14) >>> 0) / 4294967296;
}
export const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const inside = (x,y,r,box) => x+r>box.x && x-r<box.x+box.w && y+r>box.y && y-r<box.y+box.h;
const signs = {
  home:['ROOM ABOVE THE NOISE','BETTER DAYS ROOMS','PAYING GUESTS'],
  cafe:['THE USUAL','SMALL TALK CAFE','TEA & UNFINISHED BUSINESS'],
  clinic:['STILL HERE CLINIC','GOOD ENOUGH HEALTH'],
  garage:['SECOND GEAR','RUNNING REPAIRS','REALLY FINAL ESTIMATE'],
  shop:['EVERYDAY STORES','ESSENTIALS & OTHER THINGS'],
  pawn:['CASH CONVERTER','PREVIOUSLY LOVED','NO QUESTIONS PAWN'],
  depot:['QUICK SHIFT LOGISTICS','ON TIME DELIVERY*'],
  police:['CIVIC SAFETY OFFICE','DISTRICT POLICE'],
  bar:['LAST ROUND','THE SMALL HOURS','AFTER WORK'],
  apartment:['PALM VIEW','HAPPY TENANTS','SEA VIEW*'],
  office:['NEW HORIZONS','PRIORITY SERVICES','TOMORROW HOLDINGS'],
};
export function buildingByType(world,type) {
  return world.buildings.find(building=>building.type===type) || world.buildings[0];
}
function makeRoom(type,roll) {
  const room={width:640,height:480,entry:{x:320,y:410},exit:{x:320,y:454},
    spots:{counter:{x:320,y:155},bed:{x:150,y:270},stash:{x:535,y:270}},furniture:[]};
  const add=(x,y,w,h,kind)=>room.furniture.push({x,y,w,h,kind});
  if(type==='home'||type==='apartment') {
    add(54,180,115,152,'bed'); add(475,195,105,95,'cupboard');
    add(235,56,180,65,'kitchen'); add(244,218,135,64,'table');
    room.spots.counter={x:320,y:145}; room.spots.bed={x:195,y:265}; room.spots.stash={x:530,y:330};
  } else if(type==='cafe'||type==='bar') {
    add(75,60,490,60,'counter'); add(78,215,95,70,'table');add(455,215,95,70,'table');
    add(75,335,95,55,'sofa');add(455,335,95,55,'sofa');
  } else if(type==='garage'||type==='depot') {
    add(65,60,210,65,'workbench');add(365,60,205,65,'shelf');
    add(62,225,105,110,'crates');add(475,235,95,105,'crates');
  } else if(type==='clinic') {
    add(65,65,130,80,'desk');add(405,65,165,65,'shelf');
    add(70,220,100,130,'clinicbed');add(470,220,100,130,'clinicbed');
  } else {
    add(70,65,500,65,'counter');add(60,230,110,110,'shelf');add(470,230,110,110,'shelf');
  }
  if(roll()>0.5) {
    for(const item of room.furniture)item.x=room.width-item.x-item.w;
    for(const spot of Object.values(room.spots))spot.x=room.width-spot.x;
  }
  room.wallColor=['#c9c3ad','#bdc2b0','#c9b6a7'][Math.floor(roll()*3)];
  return room;
}
export function legacyWorld(seed) {
  const rng={rngState:hashSeed(seed)};
  const roll=()=>random(rng);
  const roads=[128,748+Math.floor(roll()*40),1388+Math.floor(roll()*40),2028+Math.floor(roll()*40),2688];
  const world={seed:String(seed),width:2816,height:2816,
    roads:{vertical:roads,horizontal:[...roads],width:92},buildings:[],parks:[],decorations:[],
    districts:['Old Market','Railway Quarter','Palm Ward','Dockside'],water:{edge:Math.floor(roll()*4)}};
  const types=['apartment','shop','apartment','cafe','office','apartment','bar','apartment','garage','pawn'];
  // Ensure the narrative and recovery services exist on every seed.
  const guaranteed=new Map([[20,'home'],[21,'cafe'],[24,'depot'],[25,'garage'],[5,'clinic'],[48,'police'],[38,'office'],[39,'pawn'],[9,'bar'],[4,'shop']]);
  let serial=0;
  for(let row=0;row<4;row++) for(let col=0;col<4;col++) {
    const bx=roads[col],by=roads[row];
    for(let slot=0;slot<4;slot++,serial++) {
      const id=`b${serial}`;
      const sx=slot%2,sy=Math.floor(slot/2);
      const px=bx+111+sx*255,py=by+108+sy*252;
      if(!guaranteed.has(serial)&&roll()<0.16) {
        world.parks.push({id:`park-${serial}`,x:px,y:py,w:203,h:205,trees:Math.floor(roll()*5)+3});
        continue;
      }
      const type=guaranteed.get(serial)||types[Math.floor(roll()*types.length)];
      const w=168+Math.floor(roll()*35),h=142+Math.floor(roll()*40);
      const x=px+Math.floor(roll()*17),y=py+Math.floor(roll()*16);
      const names=signs[type];
      const building={id,type,name:names[Math.floor(roll()*names.length)],x,y,w,h,
        door:{x:x+w/2,y:y+h+20},district:world.districts[(row>=2?2:0)+(col>=2?1:0)],
        ownerId:null,color:['#bc6c50','#b89d66','#749286','#738d99','#a48f95'][Math.floor(roll()*5)],
        accent:['#f2d28a','#bfddc3','#ede3cb'][Math.floor(roll()*3)],
        floors:1+Math.floor(roll()*3),variant:Math.floor(roll()*4),room:makeRoom(type,roll)};
      world.buildings.push(building);
      for(let k=0;k<3;k++) world.decorations.push({kind:['bin','lamp','bench'][k],x:x+24+k*60,y:y+h+43,variant:Math.floor(roll()*4)});
    }
  }
  world.start=buildingByType(world,'home').door;
  return world;
}
// Rows run north to south. Each four-lot block lists NW, NE, SW and SE.
const blocks = [
  ['apartment','cafe','park','apartment'], ['shop','clinic','apartment','office'], ['office','bar','apartment','park'], ['apartment','cafe','park','shop'],
  ['apartment','shop','park','apartment'], ['home','cafe','park','apartment'], ['depot','garage','office','apartment'], ['apartment','bar','park','shop'],
  ['apartment','garage','park','shop'], ['apartment','apartment','office','pawn'], ['office','annex','shop','apartment'], ['cafe','apartment','park','bar'],
  ['police','apartment','shop','park'], ['apartment','shop','cafe','apartment'], ['depot','office','park','apartment'], ['garage','cafe','apartment','park']
];
const localNames = {
  home:['Bennett Rooms'], cafe:['Café Marisol','Blue Hour Coffee','Dawn Patrol Diner','Las Olas Café'],
  apartment:['Sea Grape Court','Caribe Flats','Meridian House','Magnolia Terrace','The Palms','Bluebird Court','Mariner House','West Bay Flats'],
  clinic:['St Anne Medical'], police:['Bellport Precinct'], bar:['The Slipway','Luna Social','The Low Tide'],
  garage:['Kingfisher Motors','South Quay Garage','Pelican Auto'], shop:['Harbour Provisions','Coral Market','Plaza Records','Bay Hardware','Luna Bakery','West Pier Books'],
  depot:['Meridian Dispatch','Lucero Freight'], office:['Port Exchange','Marina Finance','Lucero Mutual','Coral Tower','Meridian Centre','Signal House'],
  pawn:['Anchor Exchange']
};
export function generateWorld() {
  const roads=[128,768,1408,2048,2688];
  const world={name:'Port Lucero',seed:'port-lucero',width:3264,height:2816,roads:{vertical:roads,horizontal:[...roads],width:92},
    water:{edge:1,shoreX:2792},districts:['Bellport','North Marina','Coral Hill','South Quay'],buildings:[],parks:[],decorations:[],solids:[]};
  const counts={};
  for (const [block, lots] of blocks.entries()) for (const [slot,type] of lots.entries()) {
    if(type==='annex')continue;
    const serial=4*block+slot,row=Math.floor(block/4),col=block%4;
    const id='b'+serial, rng={rngState:hashSeed(id+'-pl')},roll=()=>random(rng);
    const x=roads[col]+100+(slot%2)*254+Math.floor(roll()*14);
    const y=roads[row]+108+Math.floor(slot/2)*251+Math.floor(roll()*14);
    if(type==='park') {
      const plants=[[25,42],[168,35],[32,158],[170,170]].map(([dx,dy],i)=>({x:x+dx,y:y+dy,kind:(i+block)%3?'palm':'broadleaf'}));
      world.parks.push({id:'park-'+serial,x,y,w:208,h:207,trees:plants.length,plants});
      for(const plant of plants)world.solids.push({x:plant.x-4,y:plant.y-3,w:8,h:7});
      continue;
    }
    const n=counts[type]||0;counts[type]=n+1;
    const w=serial===40?434:175+Math.floor(roll()*27),h=137+Math.floor(roll()*35);
    const floors=serial===40?14:type==='office'?5+(serial%5):type==='apartment'?2+(serial%4):type==='home'?3:type==='clinic'?4:1+(serial%2);
    const titles=localNames[type];
    const name=titles[n%titles.length]+(n>=titles.length?' '+(Math.floor(n/titles.length)+1):'');
    const b={id,type,name,x,y,w,h,door:{x:x+w/2,y:y+h+18},floors,
      district:world.districts[(row>=2?2:0)+(col>=2?1:0)],ownerId:null,
      color:['#de8569','#efd39b','#79bbba','#86a8c2','#d9a194'][serial%5],accent:['#fff0c7','#b8d9ef','#eb774f'][serial%3],
      variant:serial%4,room:makeRoom(type,roll)};
    world.buildings.push(b);world.solids.push({x,y,w,h});
    const furnishing=type==='garage'||type==='depot'?'bin':'bench';
    for(const [kind,dx] of [[furnishing,22],['lamp',w-14]]) {
      const footX=x+dx,footY=y+h+33;
      world.decorations.push({kind,x:footX,y:footY,variant:serial%4});
      const half=kind==='bench'?14:kind==='bin'?6:3;
      world.solids.push({x:footX-half,y:footY-4,w:2*half,h:8});
    }
  }
  world.start=buildingByType(world,'home').door;
  return world;
}
const solidBins = new WeakMap();
function nearbySolids(world,x,y,r) {
  let bins=solidBins.get(world);
  if(!bins) {
    bins=new Map();
    for(const s of world.solids||world.buildings) {
      for(let a=Math.floor(s.x/128);a<=Math.floor((s.x+s.w)/128);a++)
        for(let b=Math.floor(s.y/128);b<=Math.floor((s.y+s.h)/128);b++){
          const key=a+b*64;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(s);
        }
    }
    solidBins.set(world,bins);
  }
  const ax=Math.floor((x-r)/128),ay=Math.floor((y-r)/128),bx=Math.floor((x+r)/128),by=Math.floor((y+r)/128);
  if(ax===bx&&ay===by)return bins.get(ax+ay*64)||[];
  const result=[];
  for(let a=ax;a<=bx;a++)for(let b=ay;b<=by;b++)result.push(...(bins.get(a+b*64)||[]));
  return result;
}
export function isWalkable(world,x,y,radius=10,interior=null) {
  if(interior) {
    const room=world.buildings.find(b=>b.id===interior)?.room;
    if(!room)return false;
    if(x<26+radius||y<35+radius||x>room.width-26-radius||y>room.height-18-radius)return false;
    return !room.furniture.some(item=>inside(x,y,radius,item));
  }
  if(x<60+radius||y<60+radius||x>(world.water?.shoreX??world.width-60)-radius||y>world.height-60-radius)return false;
  return !nearbySolids(world,x,y,radius).some(s=>inside(x,y,radius,s));
}
export function moveActor(world,actor,dx,dy) {
  const radius=actor.radius||10;
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/12));
  let moved=false;
  for(let i=0;i<steps;i++) {
    if(isWalkable(world,actor.x+dx/steps,actor.y,radius,actor.interior)) {actor.x+=dx/steps;moved=true;}
    if(isWalkable(world,actor.x,actor.y+dy/steps,radius,actor.interior)) {actor.y+=dy/steps;moved=true;}
  }
  return moved;
}
const navCache=new WeakMap();
function navigation(world,interior) {
  const room=interior&&world.buildings.find(b=>b.id===interior)?.room;
  const space=room||world;
  if(navCache.has(space))return navCache.get(space);
  const cell=room?16:24,cols=Math.ceil(space.width/cell),rows=Math.ceil(space.height/cell);
  const free=new Uint8Array(cols*rows);
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)free[y*cols+x]=isWalkable(world,(x+.5)*cell,(y+.5)*cell,10,interior)?1:0;
  const links=new Uint8Array(free.length);
  for(let i=0;i<free.length;i++){
    if(!free[i])continue;
    const x=(i%cols+.5)*cell,y=(Math.floor(i/cols)+.5)*cell;
    if(i%cols<cols-1&&free[i+1]&&isWalkable(world,x+cell/2,y,10,interior)){links[i]|=1;links[i+1]|=2;}
    if(i+cols<free.length&&free[i+cols]&&isWalkable(world,x,y+cell/2,10,interior)){links[i]|=4;links[i+cols]|=8;}
  }
  const nav={cell,cols,rows,free,links,paths:new Map()};navCache.set(space,nav);return nav;
}
function clearSegment(world,a,b,radius,room) {
  const steps=Math.max(1,Math.ceil(distance(a,b)/8));
  for(let i=1;i<=steps;i++)if(!isWalkable(world,a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps,radius,room))return false;
  return true;
}
export function findPath(world,from,to) {
  const room=from.interior||null;
  if(to.interior&&to.interior!==room)return [];
  if(clearSegment(world,from,to,10,room))return [{x:to.x,y:to.y}];
  const nav=navigation(world,room),{cols,rows,free,cell}=nav;
  const point=i=>({x:(i%cols+.5)*cell,y:(Math.floor(i/cols)+.5)*cell});
  function nearest(p) {
    const cx=Math.floor(p.x/cell),cy=Math.floor(p.y/cell);
    for(let r=0;r<5;r++){
      let best=-1,dist=Infinity;
      for(let y=Math.max(0,cy-r);y<=Math.min(rows-1,cy+r);y++)for(let x=Math.max(0,cx-r);x<=Math.min(cols-1,cx+r);x++) {
        const i=y*cols+x,d=distance(p,point(i));
        if(free[i]&&d<dist&&clearSegment(world,p,point(i),10,room)){best=i;dist=d;}
      }
      if(best>=0)return best;
    }
    return -1;
  }
  const start=nearest(from),end=nearest(to);if(start<0||end<0)return [];
  const key=start+':'+end;
  let route=nav.paths.get(key);
  if(!route) {
    const offsets=[1,-1,cols,-cols];
    const queue=[start],parents=new Int32Array(cols*rows).fill(-1);parents[start]=start;
    for(let head=0;head<queue.length;head++){
      const at=queue[head];if(at===end)break;
      const mask=nav.links[at];
      for(let side=0;side<4;side++){
        if(!(mask&(1<<side)))continue;
        const next=at+offsets[side];
        if(parents[next]>=0)continue;
        parents[next]=at;queue.push(next);
      }
    }
    if(parents[end]<0)return [];
    const turns=[end];let at=end,heading=0;
    while(at!==start){const prev=parents[at];if(heading&&at-prev!==heading)turns.push(at);heading=at-prev;at=prev;}
    turns.push(start);route=turns.reverse().map(point);
    if(nav.paths.size>=640)nav.paths.clear();nav.paths.set(key,route);
  }
  return [...route.map(p=>({...p})),{x:to.x,y:to.y}];
}
export function canSee(world,a,b) {
  if((a.interior||null)!==(b.interior||null))return false;
  if(a.interior)return true; // furniture sits below eye level
  const steps=Math.max(1,Math.ceil(distance(a,b)/10));
  for(let i=1;i<steps;i++){
    const x=a.x+(b.x-a.x)*i/steps,y=a.y+(b.y-a.y)*i/steps;
    if(world.buildings.some(building=>inside(x,y,0,building)))return false;
  }
  return true;
}
