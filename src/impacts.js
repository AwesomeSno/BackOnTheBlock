import {hitsCar} from './vehicle-geometry.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function vehicleDamage(speed){return clamp(Math.pow(Math.max(0,speed-26),2)*.0014,0,92);}
export function pedestrianDamage(speed){return clamp(Math.pow(Math.max(0,speed-12),1.38)*.075,0,100);}

export function dentVehicle(state,car,speed,point,scale=1){
  const amount=vehicleDamage(speed)*scale;
  if(!amount)return 0;
  car.health=Math.max(0,(car.health??100)-amount);
  const angle=Math.atan2(point.y-car.y,point.x-car.x)-(car.angle||0);
  const along=Math.cos(angle),across=Math.sin(angle);
  const side=Math.abs(along)>.65?(along>0?'front':'rear'):(across>0?'right':'left');
  car.damage??={front:0,rear:0,left:0,right:0};
  car.damage[side]=Math.min(100,(car.damage[side]||0)+amount);
  car.lastCollision={at:state.elapsed,speed,side};
  if(car.health===0){car.speed=0;car.braking=true;}
  state.effects.push({kind:'burst',x:point.x,y:point.y,life:.38,color:'#ffbf70'});
  return amount;
}

const fleet=state=>[...state.vehicles,...(state.life?.traffic||[]).filter(c=>c.active!==false)];
export function captureRoadMotion(state){
  return new Map([...fleet(state),state.player,...state.npcs].map(a=>[a.id||'player',{x:a.x,y:a.y,angle:a.angle||0,speed:a.speed||0,interior:a.interior||null}]));
}

// Test the route of both the vehicle and pedestrian within the same physics tick.
// This catches high-speed contacts that would otherwise step over a small person.
export function resolveRoadImpacts(state,before,dt,harm){
  const scripted=state.life?.incident;
  const actors=[state.player,...state.npcs];
  for(const car of fleet(state)){
    const old=before.get(car.id);if(!old)continue;
    const travelled=Math.hypot(car.x-old.x,car.y-old.y);
    if(travelled<.02||travelled>80)continue;
    const speed=Math.min(330,Math.max(Math.abs(car.speed||0),travelled/dt));
    if(speed<16)continue;
    for(const actor of actors){
      const id=actor.id||'player',previous=before.get(id);
      if(!previous||actor.interior||previous.interior||actor.vehicleId||actor.inServiceVehicle||actor.passengerOf||actor.medicalHeld)continue;
      if(actor!==state.player&&actor.id===state.player.companionId&&state.player.vehicleId===car.id)continue;
      if(scripted&&[scripted.victimId,scripted.actorId,scripted.responderId].includes(actor.id))continue;
      if(state.elapsed-(actor.lastVehicleHit??-100)<1.1)continue;
      if(Math.abs(car.x-actor.x)>travelled+45||Math.abs(car.y-actor.y)>travelled+45)continue;
      const steps=Math.max(1,Math.ceil((travelled+Math.hypot(actor.x-previous.x,actor.y-previous.y))/5));
      let contact=null;
      for(let n=0;n<=steps;n++){
        const f=n/steps,x=previous.x+(actor.x-previous.x)*f,y=previous.y+(actor.y-previous.y)*f;
        const pose={...car,x:old.x+(car.x-old.x)*f,y:old.y+(car.y-old.y)*f};
        if(hitsCar(x,y,pose,6)){contact={x,y};break;}
      }
      if(!contact)continue;
      actor.lastVehicleHit=state.elapsed;
      const damage=pedestrianDamage(speed);
      dentVehicle(state,car,speed,contact,.15);
      car.speed*=.58;car.braking=true;
      harm(actor,damage,{speed,angle:car.angle||0,car,playerCaused:state.player.vehicleId===car.id});
      state.effects.push({kind:'burst',...contact,life:.3,color:'#dbb386'});
    }
  }
}
