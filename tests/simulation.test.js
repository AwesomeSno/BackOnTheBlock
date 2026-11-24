import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, tick, nearby, interaction, act, toSave, fromSave, objective } from '../src/simulation.js';
import { buildingByType, isWalkable } from '../src/world.js';

function counter(state, type) {
  const place = buildingByType(state.world, type);
  state.player.interior = place.id;
  Object.assign(state.player, place.room.spots.counter);
  return place;
}
function seconds(state, seconds, input = {}) {
  for (let step = 0; step < seconds * 30; step++) tick(state, 1 / 30, input);
}

test('seed generation and serialization preserve the same city and relationships', () => {
  const state = createGame('stable-city');
  const friend = state.npcs[0];
  assert.match(interaction(state, { kind: 'npc', id: friend.id }).body, /You made it/);
  act(state, 'talk', friend.id);
  seconds(state, 2);
  const restored = fromSave(toSave(state));
  assert.deepEqual(restored.world, state.world);
  assert.equal(restored.npcs[0].trust, friend.trust);
  assert.deepEqual(restored.npcs[0].memories, friend.memories);
  assert.equal(restored.rngState, state.rngState);
  assert.equal(restored.elapsed, state.elapsed);
  assert.ok(new Set(state.npcs.map(person => person.homeId)).size > 4);
});

test('every building can be entered and left without putting player in furniture', () => {
  const state = createGame('doors');
  for (const place of state.world.buildings) {
    state.time = 600;
    state.player.interior = null;
    Object.assign(state.player, place.door);
    assert.ok(nearby(state).some(target => target.kind === 'building' && target.id === place.id));
    act(state, 'enter', place.id);
    assert.equal(state.player.interior, place.id);
    assert.ok(isWalkable(state.world, state.player.x, state.player.y, 10, place.id));
    Object.assign(state.player, place.room.exit);
    act(state, 'exit', place.id);
    assert.equal(state.player.interior, null);
    assert.ok(isWalkable(state.world, state.player.x, state.player.y));
  }
});

test('legal job earns once, purchases conserve cash and items persist', () => {
  const state = createGame('wages');
  const office = counter(state, 'office');
  act(state, 'office_shift', office.id);
  assert.equal(state.job.kind, 'shift');
  seconds(state, 23);
  assert.equal(state.player.cash, 133);
  assert.equal(state.job, null);
  const shop = counter(state, 'shop');
  act(state, 'buy_medkit', shop.id);
  assert.equal(state.player.cash, 105);
  assert.equal(state.player.inventory.medkit, 2);
  state.player.cash = 4;
  act(state, 'buy_medkit', shop.id);
  assert.equal(state.player.cash, 4);
  assert.equal(state.player.inventory.medkit, 2);
  state.player.hp = 20;
  act(state, 'use_medkit');
  assert.equal(state.player.hp, 65);
  assert.equal(state.player.inventory.medkit, 1);
  assert.equal(fromSave(toSave(state)).player.hp, 65);
});

test('unseen theft does not tell an absent owner who committed it', () => {
  const state = createGame('knowledge');
  const car = state.vehicles[1];
  state.player.interior = null;
  Object.assign(state.player, { x: car.x, y: car.y });
  for (const person of state.npcs) { person.interior = state.homeId; person.x = 300; person.y = 390; }
  const owner = state.npcs.find(person => person.id === car.ownerId);
  const priorTrust = owner.trust;
  act(state, 'vehicle_enter', car.id);
  assert.equal(state.player.vehicleId, car.id);
  assert.equal(state.player.investigation, 0);
  assert.equal(state.player.heat, 0);
  assert.equal(owner.trust, priorTrust);
  assert.equal(owner.memories.length, 0);
});

test('identified officer witness creates pursuit and surrender restores playable control', () => {
  const state = createGame('justice');
  const car = state.vehicles[1];
  state.player.interior = null;
  Object.assign(state.player, { x: car.x, y: car.y });
  for (const person of state.npcs) person.interior = state.homeId;
  const officer = state.npcs.find(person => person.role === 'police');
  Object.assign(officer, { x: car.x + 35, y: car.y, interior: null });
  act(state, 'vehicle_enter', car.id);
  assert.ok(state.player.heat > 0);
  assert.ok(state.player.investigation > 0);
  assert.equal(state.cases[0].witnesses[0].id, officer.id);
  state.player.inventory.pistol = 1;
  state.player.equipped = true;
  state.time = 1410;
  act(state, 'surrender');
  assert.equal(state.player.equipped, false);
  assert.equal(state.day, 2);
  assert.equal(state.player.heat, 0);
  assert.equal(state.player.vehicleId, null);
  assert.equal(state.player.interior, null);
  assert.ok(state.player.cash >= 0);
  assert.equal(state.stats.arrests, 1);
});

test('honest opening parcel delivery is recorded as deception, evidence ending allows continued play', () => {
  const state = createGame('story-evidence');
  const depot = counter(state, 'depot');
  act(state, 'accept_parcel', depot.id);
  assert.equal(state.story.parcel, true);
  const clinic = counter(state, 'clinic');
  act(state, 'deliver_parcel', clinic.id);
  assert.equal(state.stats.crimes, 0);
  assert.equal(state.story.delivered, true);
  counter(state, 'depot');
  act(state, 'inspect_manifest', depot.id);
  assert.equal(state.story.clues.length, 2);
  const police = counter(state, 'police');
  act(state, 'report_story', police.id);
  assert.equal(state.story.ending, 'evidence');
  assert.equal(state.story.resolved, true);
  const cash = state.player.cash;
  act(state, 'report_story', police.id);
  assert.equal(state.player.cash, cash);
  const office = counter(state, 'office');
  act(state, 'office_shift', office.id);
  seconds(state, 23);
  assert.equal(state.player.cash, cash + 48);
  assert.match(objective(state).text, /Free play/);
});

test('independent and criminal endings have distinct real conditions', () => {
  const independent = createGame('independent');
  const home = counter(independent, 'home');
  act(independent, 'settle_debt', home.id);
  assert.equal(independent.story.resolved, false);
  independent.player.cash = 240;
  act(independent, 'settle_debt', home.id);
  assert.equal(independent.story.ending, 'independent');
  assert.equal(independent.player.cash, 0);

  const criminal = createGame('partner');
  const depot = counter(criminal, 'depot');
  act(criminal, 'decline_parcel', depot.id);
  for (let run = 0; run < 3; run++) {
    counter(criminal, 'depot');
    act(criminal, 'illegal_delivery', depot.id);
    assert.equal(criminal.job.kind, 'illicit');
    const destination = criminal.world.buildings.find(place => place.id === criminal.job.toId);
    criminal.player.interior = destination.id;
    Object.assign(criminal.player, destination.room.spots.counter);
    act(criminal, 'complete_delivery', destination.id);
  }
  counter(criminal, 'depot');
  act(criminal, 'join_partner', depot.id);
  assert.equal(criminal.story.ending, 'partner');
  assert.equal(criminal.story.illegalRuns, 3);
  for (const ended of [independent, criminal]) {
    const resumed = fromSave(toSave(ended));
    assert.equal(resumed.story.ending, ended.story.ending);
    const cash = resumed.player.cash;
    const office = counter(resumed, 'office');
    act(resumed, 'office_shift', office.id);
    seconds(resumed, 23);
    assert.equal(resumed.player.cash, cash + 48);
    assert.match(objective(resumed).text, /Free play/);
  }
});

test('hangout rewards actual time once and disclosure persists privately', () => {
  const state = createGame('friendship');
  const friend = state.npcs[0];
  const before = friend.trust;
  act(state, 'hangout', friend.id);
  assert.equal(friend.trust, before);
  seconds(state, 25);
  assert.equal(friend.trust, before + 8);
  act(state, 'hangout', friend.id);
  seconds(state, 1);
  assert.equal(friend.trust, before + 8);
  act(state, 'history', friend.id);
  assert.deepEqual(friend.disclosures, ['past']);
  const restored = fromSave(toSave(state));
  assert.deepEqual(restored.npcs[0].disclosures, ['past']);
  assert.ok(restored.npcs.slice(1).every(person => person.disclosures.length === 0));
});

test('death and malformed save data preserve a playable route forward', () => {
  const state = createGame('bounce-back');
  state.player.cash = 0;
  state.player.hp = 0;
  tick(state, 1 / 60);
  assert.equal(state.player.hp, 65);
  assert.equal(state.player.cash, 0);
  const saved = toSave(state);
  saved.player = { ...saved.player, hp: -50, cash: -900, x: NaN, inventory: { medkit: -5, pistol: 999 } };
  const restored = fromSave(saved);
  assert.ok(restored.player.hp > 0);
  assert.equal(restored.player.cash, 0);
  assert.equal(restored.player.inventory.medkit, 0);
  assert.equal(restored.player.inventory.pistol, 1);
  assert.ok(isWalkable(restored.world, restored.player.x, restored.player.y));
  assert.throws(() => fromSave({ version: -1 }));
});

test('event RNG sequence is deterministic within seed and differs across seeds', () => {
  const run = seed => {
    const state = createGame(seed);
    state.npcs.forEach((npc, index) => { npc.scheduleAt = 1e6; npc.interior = null; npc.x = state.player.x + index % 4 * 20; npc.y = state.player.y + index % 3 * 20; });
    for (let step = 0; step < 3600; step++) tick(state, 0.1);
    return state.events.map(event => event.type);
  };
  const first = run('events-one');
  assert.deepEqual(first, run('events-one'));
  assert.notDeepEqual(first, run('events-two'));
});

test('all retail purchases charge once per accepted action with valid inventory caps', () => {
  const state = createGame('retail');
  state.player.cash = 500;
  const pawn = counter(state, 'pawn');
  act(state, 'buy_pistol', pawn.id);
  assert.equal(state.player.cash, 355);
  assert.equal(state.player.inventory.pistol, 1);
  assert.equal(state.player.magazine, 6);
  act(state, 'buy_pistol', pawn.id);
  assert.equal(state.player.cash, 355);
  act(state, 'buy_ammo', pawn.id);
  assert.equal(state.player.cash, 331);
  assert.equal(state.player.inventory.ammo, 18);
  const shop = counter(state, 'shop');
  act(state, 'buy_snack', shop.id);
  assert.equal(state.player.cash, 323);
  assert.equal(state.player.inventory.snack, 3);
  act(state, 'buy_medkit', shop.id);
  assert.equal(state.player.cash, 295);
  assert.equal(state.player.inventory.medkit, 2);
  const clinic = counter(state, 'clinic');
  state.player.hp = 40;
  act(state, 'treatment', clinic.id);
  assert.equal(state.player.cash, 275);
  assert.equal(state.player.hp, 100);
  act(state, 'treatment', clinic.id);
  assert.equal(state.player.cash, 275);
});

test('equipped empty gun stays empty, and reload transfers available total into a magazine', () => {
  let state = createGame('ammo');
  state.player.inventory.pistol = 1;
  state.player.inventory.ammo = 7;
  state.player.magazine = 0;
  state.player.equipped = true;
  const nearbyPerson = state.npcs[0];
  state.player.interior = null;
  Object.assign(nearbyPerson, { x: state.player.x + 20, y: state.player.y, interior: null });
  state.player.angle = 0;
  tick(state, 0.1, { fire: true });
  assert.equal(nearbyPerson.hp, 100);
  act(state, 'reload');
  state = fromSave(toSave(state));
  seconds(state, 1.2);
  assert.equal(state.player.magazine, 6);
  assert.equal(state.player.inventory.ammo, 7);
  state.player.angle = 0;
  tick(state, 0.1, { fire: true });
  assert.equal(state.player.magazine, 5);
  assert.equal(state.player.inventory.ammo, 6);
});

test('private protagonist disclosure requires trust and calm, and belongs to that one person', () => {
  const state = createGame('private');
  const friend = state.npcs[0];
  friend.trust = 34;
  state.player.companionId = friend.id;
  act(state, 'share_past', friend.id);
  assert.deepEqual(friend.sharedPast, [0]);
  act(state, 'share_past', friend.id);
  assert.deepEqual(friend.sharedPast, [0]);
  assert.ok(state.npcs.slice(1).every(npc => npc.sharedPast.length === 0));
  const restored = fromSave(toSave(state));
  assert.deepEqual(restored.npcs[0].sharedPast, [0]);
  assert.ok(restored.npcs.slice(1).every(npc => npc.sharedPast.length === 0));
});

test('owned vehicle entry, driving, exit and remote repair preserve one valid player', () => {
  const state = createGame('service-5');
  const car = state.vehicles[0];
  Object.assign(state.player, { x: car.x, y: car.y, interior: null });
  act(state, 'vehicle_enter', car.id);
  assert.equal(state.player.vehicleId, car.id);
  seconds(state, 2, { y: -1 });
  assert.ok(Math.abs(car.speed) > 10);
  seconds(state, 3, { brake: true });
  act(state, 'vehicle_exit', car.id);
  assert.equal(state.player.vehicleId, null);
  assert.ok(isWalkable(state.world, state.player.x, state.player.y));
  const garage = counter(state, 'garage');
  car.health = 0;
  state.player.cash = 25;
  act(state, 'repair_car', garage.id);
  assert.equal(car.health, 100);
  assert.equal(car.fuel, 100);
  assert.equal(state.player.cash, 0);
  assert.ok(isWalkable(state.world, car.x, car.y, 23));
});

test('the welcome sends Alex to the dispatch counter and survives earlier save formats', () => {
  const state = createGame('dispatch-signpost');
  const friend = state.npcs[0];
  const depot = buildingByType(state.world, 'depot');
  assert.equal(objective(state).target.x, friend.x);
  const messageCount = state.messages.length;
  act(state, 'talk', friend.id);
  assert.equal(state.messages.length, messageCount);
  assert.deepEqual(objective(state).target, depot.door);
  const saved = toSave(state);
  delete saved.story.welcomed;
  const resumed = fromSave(saved);
  assert.deepEqual(objective(resumed).target, depot.door);
  counter(resumed, 'depot');
  assert.deepEqual(objective(resumed).target, { ...depot.room.spots.counter, interior: depot.id });
});

test('known assault victim remembers attacker, absent people receive no identity knowledge', () => {
  const state = createGame('assault-memory');
  const target = state.npcs[0];
  Object.assign(state.player, { x: 768, y: 768, interior: null, angle: 0 });
  for (const npc of state.npcs) npc.interior = state.homeId;
  Object.assign(target, { x: 790, y: 768, interior: null, scheduleAt: 1e6 });
  const absentTrust = state.npcs[2].trust;
  tick(state, 0.05, { fire: true });
  assert.equal(target.hp, 81);
  assert.ok(target.memories.some(memory => memory.text.includes('assault')));
  assert.ok(target.trust < 28);
  assert.equal(state.npcs[2].trust, absentTrust);
  assert.equal(state.npcs[2].memories.length, 0);
});

test('two in-game days keep actors, resources and effects finite and saveable', () => {
  const state = createGame('long-session');
  const nightAtHome = new Set();
  const daytimeStreetWorkers = new Set();
  for (let step = 0; step < 12000; step++) {
    tick(state, 0.1, {});
    if (step % 500 === 0) {
      for (const actor of [state.player, ...state.npcs, ...state.vehicles]) {
        assert.ok(Number.isFinite(actor.x) && Number.isFinite(actor.y), actor.id || 'player');
      }
      for (const npc of state.npcs) {
        if (state.time < 330 && npc.interior === npc.homeId) nightAtHome.add(npc.id);
        if (state.time > 440 && state.time < 990 && !npc.interior && npc.task.startsWith('on shift as ')) daytimeStreetWorkers.add(npc.id);
      }
      assert.ok(state.effects.length < 100);
      assert.ok(state.messages.length <= 7);
    }
  }
  assert.equal(state.day, 3);
  assert.ok(state.npcs.every(npc => npc.cash >= 0 && Number.isFinite(npc.cash)));
  assert.ok(nightAtHome.size >= 20, 'Most residents physically returned home overnight');
  assert.ok(daytimeStreetWorkers.size >= 4, 'Outdoor workers took up their daytime posts');
  const restored = fromSave(toSave(state));
  assert.equal(restored.day, state.day);
  assert.equal(restored.npcs.length, 24);
  assert.equal(restored.events.length, state.events.length);
});

test('unwitnessed wallet theft does not create an attributed personal memory', () => {
  const state = createGame('quiet-wallet');
  const owner = state.npcs[8];
  for (const npc of state.npcs) npc.interior = state.homeId;
  state.events.push({ id: 'event-test', type: 'dropped_wallet', npcId: owner.id, ownerId: owner.id, x: state.player.x, y: state.player.y, interior: null, stage: 'open', expires: 1000 });
  const trust = owner.trust;
  act(state, 'event_keep', 'event-test');
  assert.equal(owner.trust, trust);
  assert.equal(owner.memories.length, 0);
  assert.equal(state.player.investigation, 0);
});

test('companion travels as a passenger and gets out into usable space', () => {
  const state = createGame('passenger');
  const friend = state.npcs[0];
  state.player.companionId = friend.id;
  const car = state.vehicles[0];
  Object.assign(state.player, { x: car.x, y: car.y, interior: null });
  act(state, 'vehicle_enter', car.id);
  seconds(state, 1, { y: -1 });
  assert.equal(friend.passengerOf, car.id);
  assert.equal(friend.task, 'riding with you');
  assert.ok(Math.hypot(friend.x - car.x, friend.y - car.y) < 1);
  seconds(state, 2, { brake: true });
  act(state, 'vehicle_exit', car.id);
  tick(state, 0.1);
  assert.equal(friend.passengerOf, null);
  assert.ok(isWalkable(state.world, friend.x, friend.y));
});

test('found property requires meeting the owner, persists in transit and rewards only once', () => {
  const state = createGame('return-in-person');
  const owner = state.npcs[8];
  owner.interior = state.homeId;
  owner.x = 320;
  owner.y = 380;
  state.events.push({ id: 'event-found', type: 'dropped_wallet', npcId: owner.id, ownerId: owner.id, x: state.player.x, y: state.player.y, interior: null, stage: 'open', expires: 1000 });
  act(state, 'event_return', 'event-found');
  assert.equal(state.events[0].stage, 'accepted');
  assert.equal(owner.trust, 0);
  assert.equal(objective(state).target.interior, state.homeId);
  const restored = fromSave(toSave(state));
  const restoredOwner = restored.npcs.find(npc => npc.id === owner.id);
  assert.equal(restored.events[0].collected, true);
  act(restored, 'return_found', owner.id);
  assert.equal(restored.events[0].stage, 'accepted');
  Object.assign(restored.player, { x: restoredOwner.x, y: restoredOwner.y, interior: restoredOwner.interior });
  act(restored, 'return_found', owner.id);
  assert.equal(restored.events[0].stage, 'resolved');
  assert.equal(restoredOwner.trust, 12);
  act(restored, 'return_found', owner.id);
  assert.equal(restoredOwner.trust, 12);
});

test('a hundred seeds place every car and the welcoming friend on navigable ground', () => {
  for (let index = 0; index < 100; index++) {
    const state = createGame('wake-' + index);
    for (const car of state.vehicles) assert.ok(isWalkable(state.world, car.x, car.y, 23), `seed ${index}, ${car.id}`);
    const friend = state.npcs[0];
    assert.ok(isWalkable(state.world, friend.x, friend.y, 10));
    assert.ok(nearby(state).some(target => target.id === friend.id));
  }
});

test('the photograph gives a hint while leaving private disclosures for conversations', () => {
  const state = createGame('photograph');
  const home = counter(state, 'home');
  act(state, 'home_history', home.id);
  assert.match(state.journal[0].text, /classroom fan/);
  assert.ok(state.journal.every(entry => !/apprenticeship|signed off|training/i.test(entry.text)));
  assert.ok(state.npcs.every(person => !person.sharedPast.length));
});
