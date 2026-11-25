import { distance, findPath, isWalkable, moveActor } from './world.js';
import { hitsCar } from './driving.js';

// Keep the static island and its walking grid cache intact. A player parking
// elsewhere invalidates the pedestrian grid once, instead of on every footstep.
const parkedLayouts = new WeakMap();
const bearings = [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4, -Math.PI / 4];

function parkedBody(car) {
  const halfAxle = car.model === 'van' || car.service ? 14 : 12;
  const dx = Math.cos(car.angle || 0) * halfAxle;
  const dy = Math.sin(car.angle || 0) * halfAxle;
  // Overlapping obstacles trace the same centerline as the driving capsule.
  // The small navigation margin keeps a foot clear between grid samples.
  return [-1, -.5, 0, .5, 1].map(f => ({
    x: car.x + f * dx - 11, y: car.y + f * dy - 11, w: 22, h: 22
  }));
}

export function pedestrianWorld(state) {
  const cars = (state.vehicles || []).filter(car => car.active !== false && Math.abs(car.speed || 0) < .01);
  const cached = parkedLayouts.get(state);
  if (cached?.world === state.world && cached.poses.length === cars.length && cars.every((car, i) => {
    const last = cached.poses[i];
    return car.id === last.id && car.x === last.x && car.y === last.y && car.angle === last.angle && car.model === last.model;
  })) return cached.navigation;
  const navigation = {...state.world, solids: [...(state.world.solids || state.world.buildings), ...cars.flatMap(parkedBody)]};
  const poses = cars.map(({id, x, y, angle, model}) => ({id, x, y, angle, model}));
  parkedLayouts.set(state, {world: state.world, poses, navigation});
  return navigation;
}

function clearGroundLine(world, from, to, radius) {
  const n = Math.max(1, Math.ceil(distance(from, to) / 3));
  for (let i = 1; i <= n; i++) {
    const f = i / n;
    if (!isWalkable(world, from.x + (to.x-from.x)*f, from.y + (to.y-from.y)*f, radius)) return false;
  }
  return true;
}

function clearApproach(state, navigation, at, toward, radius) {
  if (isWalkable(navigation, at.x, at.y, radius)) return at;
  if (!isWalkable(state.world, at.x, at.y, radius)) return null;
  const heading = Math.atan2(toward.y - at.y, toward.x - at.x);
  for (let reach = 4; reach <= 60; reach += 4) {
    for (const offset of bearings) {
      const angle = heading + offset;
      const p = {x: at.x + Math.cos(angle)*reach, y: at.y + Math.sin(angle)*reach};
      if (isWalkable(navigation, p.x, p.y, radius) && clearGroundLine(state.world, at, p, radius)) return p;
    }
  }
  return null;
}

export function pedestrianPath(state, from, to) {
  if (from.interior || to.interior) return findPath(state.world, from, to);
  const navigation = pedestrianWorld(state), radius = from.radius || 10;
  const start = clearApproach(state, navigation, from, to, radius);
  const end = clearApproach(state, navigation, to, from, radius);
  if (!start || !end) return [];
  const path = findPath(navigation, start, end);
  if (start !== from && path.length) path.unshift(start);
  return path;
}

export function movePedestrian(state, actor, dx, dy) {
  if (!dx && !dy) return false;
  const beforeX = actor.x, beforeY = actor.y;
  if (actor.interior) {
    moveActor(state.world, actor, dx, dy);
  } else {
    const navigation = pedestrianWorld(state), radius = actor.radius || 10;
    if (isWalkable(navigation,actor.x,actor.y,radius)) {
      moveActor(navigation, actor, dx, dy);
    } else {
      // A driver can park over a stationary person. Walk to the nearest free
      // edge at the requested speed, including when the original target is behind the car.
      const p = clearApproach(state,navigation,actor,{x:actor.x+dx,y:actor.y+dy},radius);
      if (!p) return false;
      const d = distance(actor,p), f = Math.min(1, Math.hypot(dx,dy) / Math.max(.001,d));
      moveActor(state.world,actor,(p.x-actor.x)*f,(p.y-actor.y)*f);
    }
  }
  return Math.hypot(actor.x-beforeX,actor.y-beforeY) > .00001;
}

export function vehicleExitPoint(state, car, reserved = []) {
  const cars = [...(state.vehicles || []), ...(state.life?.traffic || [])].filter(v=>v.active!==false && v.id!==car.id);
  const people = (state.npcs || []).filter(n=>!n.interior && !n.inServiceVehicle && !n.passengerOf && !n.vehicleId && n.id !== state.player?.companionId);
  const occupied = [...people,...reserved];
  const positions = [Math.PI/2,-Math.PI/2,Math.PI,0,Math.PI*.75,-Math.PI*.75,Math.PI*.25,-Math.PI*.25];
  for (const reach of [32,43,51]) {
    for (const offset of positions) {
      const heading = (car.angle || 0) + offset;
      const target = {x:car.x+Math.cos(heading)*reach,y:car.y+Math.sin(heading)*reach};
      if (hitsCar(target.x,target.y,car,9) || occupied.some(p=>distance(p,target)<18)) continue;
      if (!clearGroundLine(state.world,car,target,10)) continue;
      let blocked = false;
      for (let step=1;step<=8&&!blocked;step++) {
        const x=car.x+(target.x-car.x)*step/8,y=car.y+(target.y-car.y)*step/8;
        blocked=cars.some(v=>hitsCar(x,y,v,9));
      }
      if (!blocked) return target;
    }
  }
  return null;
}
