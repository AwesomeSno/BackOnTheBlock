import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../src/simulation.js';
import {hitsCar} from '../src/driving.js';
import {distance,isWalkable} from '../src/world.js';
import {movePedestrian,pedestrianPath,pedestrianWorld,vehicleExitPoint} from '../src/pedestrian.js';

test('residents can walk past both sides of the Bellport van without walking through it',()=>{
  const state=createGame('parking-audit'), van=state.vehicles[0];
  for(const [dx,dy] of [[50,0],[0,50],[40,40],[-35,35]]) {
    const actor={x:van.x-dx,y:van.y-dy,interior:null},goal={x:van.x+dx,y:van.y+dy};
    const path=pedestrianPath(state,actor,goal);
    assert.ok(path.length>1);
    for(const point of path) {
      let steps=0;
      while(distance(actor,point)>.05 && steps++<3000){
        const d=distance(actor,point),ratio=Math.min(1,1.2/d);
        assert.ok(movePedestrian(state,actor,(point.x-actor.x)*ratio,(point.y-actor.y)*ratio),'route step is usable');
        assert.ok(!state.vehicles.some(car=>hitsCar(actor.x,actor.y,car,7)),'body remains clear of parked vehicles');
        assert.ok(isWalkable(state.world,actor.x,actor.y));
      }
      assert.ok(steps<3000);
    }
    assert.ok(distance(actor,goal)<.1);
  }
});

test('parked navigation layout follows a vehicle that moves, and admits a safe approach to blocked goals',()=>{
  const s=createGame('parking-audit'),car=s.vehicles[0];
  const cached=pedestrianWorld(s);
  assert.equal(pedestrianWorld(s),cached);
  const blocked={x:car.x,y:car.y},from={x:car.x-53,y:car.y};
  const alt=pedestrianPath(s,from,blocked).at(-1);
  assert.ok(alt&&!hitsCar(alt.x,alt.y,car,8)&&distance(alt,blocked)<45);
  car.speed=80;
  assert.notEqual(pedestrianWorld(s),cached);
  car.x=768;car.y=820;car.speed=0;
  assert.ok(isWalkable(pedestrianWorld(s),blocked.x,blocked.y));
  assert.ok(!isWalkable(pedestrianWorld(s),car.x,car.y));
});

test('a pedestrian overlapped by a newly parked car can leave without a jump',()=>{
  const s=createGame('parking-audit'),car=s.vehicles[0],actor={x:car.x,y:car.y,interior:null};
  for(let i=0;i<52;i++){
    const before={...actor};movePedestrian(s,actor,1,0);
    assert.ok(distance(actor,before)<=1.01 && isWalkable(s.world,actor.x,actor.y));
    if(!hitsCar(actor.x,actor.y,car,8))return;
  }
  assert.fail('actor remained trapped inside the parked car');
});

test('exits reject an adjacent parked vehicle, active traffic and occupied passenger points',()=>{
  const s=createGame('parking-audit'),car=s.vehicles[0],next=s.vehicles[1];
  Object.assign(car,{x:768,y:600,angle:Math.PI/2,speed:0});
  Object.assign(next,{x:723,y:600,angle:Math.PI/2});
  s.life.traffic.push({id:'cross-traffic',x:807,y:600,angle:Math.PI/2,speed:2,active:true,model:'sedan'});
  const driver=vehicleExitPoint(s,car),friend=vehicleExitPoint(s,car,[driver]);
  for(const point of [driver,friend]){
    assert.ok(point && isWalkable(s.world,point.x,point.y));
    assert.ok(![...s.vehicles,...s.life.traffic].some(v=>hitsCar(point.x,point.y,v,8)));
  }
  assert.ok(distance(driver,friend)>=18);
});
