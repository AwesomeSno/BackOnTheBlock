// City generation and navigation use one seed. Rendering never changes this stream.
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
export function generateWorld(seed='second-chance') {
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
export function isWalkable(world,x,y,radius=10,interior=null) {
  if(interior) {
    const room=world.buildings.find(b=>b.id===interior)?.room;
    if(!room)return false;
    if(x<26+radius||y<35+radius||x>room.width-26-radius||y>room.height-18-radius)return false;
    return !room.furniture.some(item=>inside(x,y,radius,item));
  }
  if(x<60+radius||y<60+radius||x>world.width-60-radius||y>world.height-60-radius)return false;
  return !world.buildings.some(building=>inside(x,y,radius,building));
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
function navigation(world) {
  if(navCache.has(world))return navCache.get(world);
  const cell=32,cols=Math.ceil(world.width/cell),rows=Math.ceil(world.height/cell);
  const free=new Uint8Array(cols*rows);
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)free[y*cols+x]=isWalkable(world,x*cell+16,y*cell+16,12)?1:0;
  const nav={cell,cols,rows,free,paths:new Map()};navCache.set(world,nav);return nav;
}
export function findPath(world,from,to) {
  if(from.interior||to.interior) return [{x:to.x,y:to.y}];
  const nav=navigation(world),{cols,rows,free,cell}=nav;
  function nearest(point) {
    const cx=Math.min(cols-1,Math.max(0,Math.floor(point.x/cell))),cy=Math.min(rows-1,Math.max(0,Math.floor(point.y/cell)));
    for(let r=0;r<7;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++) {
      const x=cx+dx,y=cy+dy;
      if(x>=0&&y>=0&&x<cols&&y<rows&&free[y*cols+x])return y*cols+x;
    }
    return -1;
  }
  const start=nearest(from),end=nearest(to);
  if(start<0||end<0)return [];
  const key=`${start}:${end}`;
  if(nav.paths.has(key))return nav.paths.get(key).map(p=>({...p}));
  const queue=[start],parents=new Int32Array(cols*rows).fill(-1);parents[start]=start;
  for(let head=0;head<queue.length;head++) {
    const at=queue[head];if(at===end)break;
    const x=at%cols,y=Math.floor(at/cols);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx=x+dx,ny=y+dy,index=ny*cols+nx;
      if(nx<0||ny<0||nx>=cols||ny>=rows||!free[index]||parents[index]>=0)continue;
      parents[index]=at;queue.push(index);
    }
  }
  if(parents[end]<0)return [];
  const path=[];let at=end;
  while(at!==start) {path.push({x:(at%cols)*cell+16,y:Math.floor(at/cols)*cell+16});at=parents[at];}
  path.reverse();path.push({x:to.x,y:to.y});
  if(nav.paths.size>300)nav.paths.clear();nav.paths.set(key,path);
  return path.map(p=>({...p}));
}
export function canSee(world,a,b) {
  if((a.interior||null)!==(b.interior||null))return false;
  if(a.interior)return true;
  const steps=Math.ceil(distance(a,b)/16);
  for(let i=1;i<steps;i++)if(!isWalkable(world,a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps,0))return false;
  return true;
}
