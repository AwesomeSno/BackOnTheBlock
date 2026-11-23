import {isWalkable} from './world.js';

const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const toward=(n,target,step)=>n+Math.sign(target-n)*Math.min(step,Math.abs(target-n));

function roadSurface(world,x,y) {
  const half=world.roads.width/2;
  if(world.roads.vertical.some(v=>Math.abs(v-x)<half)||world.roads.horizontal.some(v=>Math.abs(v-y)<half))return 'road';
  if(world.parks.some(p=>x>=p.x&&x<=p.x+p.w&&y>=p.y&&y<=p.y+p.h))return 'grass';
  return 'pavement';
}
// Solid car body is a capsule: a short wheelbase segment with rounded bumpers.
function halfAxle(car){return car.model==='van'||car.service?14:12;}
function axle(car){const a=car.angle||0,l=halfAxle(car);return [Math.cos(a)*l,Math.sin(a)*l];}
function pointToAxle(x,y,car){
  const [dx,dy]=axle(car),t=clamp(((x-car.x)*dx+(y-car.y)*dy)/(dx*dx+dy*dy),-1,1);
  return Math.hypot(x-car.x-t*dx,y-car.y-t*dy);
}
export function hitsCar(x,y,car,radius=7){return Math.abs(x-car.x)<36&&Math.abs(y-car.y)<36&&pointToAxle(x,y,car)<10+radius;}
function touchesCar(a,b){
  if(Math.abs(a.x-b.x)>52||Math.abs(a.y-b.y)>52)return false;
  const [ax,ay]=axle(a),[bx,by]=axle(b);
  return pointToAxle(a.x+ax,a.y+ay,b)<20||pointToAxle(a.x-ax,a.y-ay,b)<20||
    pointToAxle(b.x+bx,b.y+by,a)<20||pointToAxle(b.x-bx,b.y-by,a)<20||pointToAxle(a.x,a.y,b)<20;
}
function clearPose(world,pose,others) {
  const [dx,dy]=axle(pose);
  return isWalkable(world,pose.x,pose.y,10)&&isWalkable(world,pose.x-dx,pose.y-dy,10)&&
    isWalkable(world,pose.x+dx,pose.y+dy,10)&&!others.some(other=>touchesCar(pose,other));
}
export function drive(state,car,turn,gas,brake,dt) {
  const surface=roadSurface(state.world,car.x,car.y),van=car.model==='van';
  const forwardLimit=(van?219:267)*(surface==='grass'?.46:surface==='pavement'?.75:1);
  const reversing=gas&&car.speed*gas<0;
  car.steer=toward(car.steer||0,turn,dt*(turn?3.1:5.5));
  if(brake||reversing)car.speed=toward(car.speed,0,dt*(brake?260:185));
  else if(gas&&car.fuel>0)car.speed=toward(car.speed,gas>0?forwardLimit:-72,dt*(van?98:124)*(surface==='grass'?.62:1));
  else car.speed=toward(car.speed,0,dt*(surface==='grass'?65:18));
  const speed=Math.abs(car.speed);
  const angle=car.angle+car.steer*Math.sign(car.speed)*Math.min(speed/48,1)*dt*(van?1.85:2.15)/(1+speed/180);
  const others=[...state.vehicles.filter(v=>v!==car),...(state.life?.traffic||[]).filter(v=>v.active!==false)];
  const slices=Math.max(1,Math.ceil(speed*dt/5));
  for(let i=0;i<slices;i++){
    const nextAngle=car.angle+(angle-car.angle)/(slices-i);
    const step=car.speed*dt/slices;
    const pose={x:car.x+Math.cos(nextAngle)*step,y:car.y+Math.sin(nextAngle)*step,angle:nextAngle,model:car.model};
    if(!clearPose(state.world,pose,others)){
      car.speed=speed>43?-car.speed*.12:0;car.steer*=.68;
      if(speed>38&&(!car.lastImpact||state.elapsed-car.lastImpact>.8)){
        car.lastImpact=state.elapsed;car.health=Math.max(0,car.health-speed*.045);
        state.effects.push({kind:'burst',x:pose.x+Math.cos(nextAngle)*18,y:pose.y+Math.sin(nextAngle)*18,life:.36,color:'#ffba60'});
        return speed;
      }
      break;
    }
    Object.assign(car,{x:pose.x,y:pose.y,angle:nextAngle});
  }
  if((brake&&speed>75||surface==='grass'&&speed>38)&&state.elapsed-(car.lastDust||-1)>.13) {
    car.lastDust=state.elapsed;
    state.effects.push({kind:'dust',x:car.x-Math.cos(car.angle)*17,y:car.y-Math.sin(car.angle)*17,life:.44,color:surface==='grass'?'#cbb36a':'#bfc7cc'});
  }
  return 0;
}
