import test from 'node:test';
import assert from 'node:assert/strict';
import {drive} from '../src/driving.js';
import {fromSave, toSave} from '../src/simulation.js';
import {generateWorld, isWalkable, legacyWorld} from '../src/world.js';

function testRoad(solids = []) {
  const car = {id: 'player-car', model: 'sedan', x: 300, y: 400, angle: 0, speed: 0, fuel: 100, health: 100};
  const world = {
    width: 1200, height: 900, buildings: [], parks: [], solids,
    roads: {width: 92, vertical: [], horizontal: [400]}
  };
  const state = {world, vehicles: [car], effects: [], elapsed: 1, life: {traffic: []}};
  function advance(turn, throttle, brake = false) {
    state.elapsed += 0.04;
    return drive(state, car, turn, throttle, brake, 0.04);
  }
  return {car, state, advance};
}

test('braking stops a moving car without reversing, and reverse first takes off forward speed', () => {
  const {car, advance} = testRoad();
  car.speed = 92;
  for (let frame = 0; frame < 20; frame++) {
    const before = car.speed;
    advance(0, 0, true);
    assert.ok(car.speed >= 0 && car.speed <= before);
  }
  assert.equal(car.speed, 0);
  const stoppedX = car.x;
  advance(0, 0, true);
  assert.equal(car.x, stoppedX);

  car.speed = 49;
  let previousSpeed = car.speed;
  while (car.speed > 0) {
    advance(0, -1);
    assert.ok(car.speed >= 0 && car.speed < previousSpeed);
    previousSpeed = car.speed;
  }
  const turningPoint = car.x;
  advance(0, -1);
  assert.ok(car.speed < 0 && car.x < turningPoint);
});

test('steering needs wheel movement and reverses direction when backing up', () => {
  const still = testRoad();
  for (let i = 0; i < 15; i++) still.advance(1, 0);
  assert.deepEqual([still.car.x, still.car.y, still.car.angle], [300, 400, 0]);

  for (const direction of [1, -1]) {
    const {car, advance} = testRoad();
    car.speed = direction * 64;
    advance(1, direction);
    assert.ok(car.steer > 0 && car.steer < 1, 'the steering input should ease toward full lock');
    for (let i = 0; i < 7; i++) advance(1, direction);
    assert.ok(direction * car.angle > 0);
    assert.ok(direction * (car.x - 300) > 0);
  }
});

test('a fast car hits a thin wall at its bumper and cannot tunnel through it', () => {
  const wall = {x: 358, y: 355, w: 3, h: 90};
  const {car, state, advance} = testRoad([wall]);
  car.speed = 245;
  let impact = 0;
  for (let i = 0; i < 12 && !impact; i++) impact = advance(0, 1);
  assert.ok(impact > 100);
  assert.ok(car.x > 300 && car.x + 22 <= wall.x, 'front axle and rounded bumper should both clear wall');
  assert.ok(car.health < 100 && car.speed <= 0);
  assert.ok(state.effects.some(effect => effect.kind === 'burst'));
});

test('the player car collides with parked cars and with active cross traffic', () => {
  for (const moving of [false, true]) {
    const {car, state, advance} = testRoad();
    const obstacle = {id: 'other-car', model: 'van', x: 365, y: 400, angle: Math.PI / 2, active: true};
    if (moving) state.life.traffic.push(obstacle);
    else state.vehicles.push(obstacle);
    car.speed = 205;
    let impact = 0;
    for (let i = 0; i < 16 && !impact; i++) impact = advance(0, 1);
    assert.ok(impact > 0, moving ? 'active cross traffic' : 'parked vehicle');
    assert.ok(car.x < obstacle.x - 30);
    assert.ok(car.health < 100);
  }
});

test('a v1 street save preserves progress and moves an invalid old pavement position onto the island', () => {
  // This spot is outside on the old seed and is occupied by a fixed island building.
  const old = {
    version: 1, seed: 'old-port', elapsed: 84, day: 3, time: 685,
    player: {x: 1115, y: 235, interior: null, cash: 219, hp: 78, honor: 7,
      inventory: {medkit: 3, snack: 6, ammo: 13, pistol: 1}, magazine: 5},
    npcs: [{id: 'npc-0', trust: 54, introduced: true, relation: 'old friend', sharedPast: [0],
      memories: [{key: 'welcome', text: 'Nikhil lent me ₹10.', day: 1, time: 480}]}],
    story: {phase: 2, accepted: true, parcelInspected: true, clues: ['invoice','witness'], debt: 140},
    journal: [{text: 'Nikhil lent me ₹10.', day: 1, time: 480}]
  };
  const {x, y} = old.player;
  assert.ok(isWalkable(legacyWorld(old.seed), x, y));
  assert.equal(isWalkable(generateWorld(), x, y), false);
  const restored = fromSave(old);
  assert.equal(old.version, 1);
  assert.equal(old.journal[0].text, 'Nikhil lent me ₹10.');
  assert.equal(restored.world.name, 'Port Lucero');
  assert.ok(isWalkable(restored.world, restored.player.x, restored.player.y));
  assert.deepEqual([restored.player.cash, restored.player.hp, restored.player.honor], [219, 78, 7]);
  assert.deepEqual(restored.player.inventory, old.player.inventory);
  assert.equal(restored.player.magazine, 5);
  assert.deepEqual([restored.story.phase, restored.story.debt, restored.story.parcelInspected], [2, 140, true]);
  assert.deepEqual(restored.story.clues, old.story.clues);
  assert.equal(restored.npcs[0].name, 'Miles Bennett');
  assert.equal(restored.npcs[0].trust, 54);
  assert.deepEqual(restored.npcs[0].sharedPast, [0]);
  assert.equal(restored.npcs[0].memories[0].text, 'Miles lent me $10.');
  assert.equal(restored.journal[0].text, 'Miles lent me $10.');
  const resumed = fromSave(toSave(restored));
  assert.deepEqual(resumed.story, restored.story);
  assert.deepEqual(resumed.player.inventory, old.player.inventory);
});

test('an old garage interior and its active paid shift migrate to the same usable garage', () => {
  const seed = 'old-port';
  const oldGarage = legacyWorld(seed).buildings.find(place => place.type === 'garage');
  assert.equal(generateWorld().buildings.find(place => place.id === oldGarage.id)?.type, 'apartment');
  const restored = fromSave({
    version: 1, seed, elapsed: 42,
    player: {...oldGarage.room.entry, interior: oldGarage.id},
    job: {id: 'old-shift', kind: 'shift', fromId: oldGarage.id, toId: oldGarage.id,
      accepted: 35, deadline: 100, progress: 7, description: 'Workshop shift'}
  });
  const place = restored.world.buildings.find(b => b.id === restored.player.interior);
  assert.equal(place.type, 'garage');
  assert.ok(isWalkable(restored.world, restored.player.x, restored.player.y, 10, place.id));
  assert.equal(restored.job.fromId, place.id);
  assert.equal(restored.job.toId, place.id);
  assert.equal(restored.job.progress, 7);
});
