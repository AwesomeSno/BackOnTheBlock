import { generateWorld, hashSeed, random, distance, moveActor, findPath, canSee, buildingByType, isWalkable } from './world.js';

const VERSION = 1;
const MINUTES_PER_SECOND = 2.4;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const sameRoom = (a, b) => (a.interior || null) === (b.interior || null);
const openingHours = { shop: [420, 1320], cafe: [420, 1380], depot: [360, 1260], office: [480, 1080], garage: [420, 1200] };
const people = [
  ['Nikhil', 'friend', 'Keeps his promises, then complains about them.', 'You grew up on this block together. He stayed while you tried an electrical apprenticeship.'],
  ['Kavya', 'courier', 'Quick-witted and careful about who gets close.', 'She moved here to keep her younger brother in school. The depot keeps delaying her wages.'],
  ['Leela', 'shopkeeper', 'Practical, watchful, quietly generous.', 'She once lost the shop to a bad loan. A neighbour bought it back, one monthly payment at a time.'],
  ['Rafi', 'mechanic', 'Patient with engines, less patient with excuses.', 'His father taught him to repair things before buying replacements. He still owns the first wrench.'],
  ['Sana', 'nurse', 'Kind without being easily fooled.', 'She worked night shifts during the flood. She remembers who opened their doors.'],
  ['Dev', 'dispatcher', 'Calls every complication a small administrative issue.', 'He has been altering dispatch records for Varun. The mistakes were never accidental.'],
  ['Varun', 'broker', 'Polite until a person becomes an expense.', 'He hides stolen clinic supplies in legitimate consignments and calls the losses insurance work.'],
  ['Meera', 'clerk', 'Dry humour, excellent records.', 'She has saved a little each month for her own print shop. The business plan is longer than most novels.'],
  ['Asha', 'neighbour', 'Observant, proud, slow to ask for help.', 'She looked after your mother during your last year away. She never expected repayment.'],
  ['Imran', 'cook', 'Feeds people before asking questions.', 'His old restaurant closed. He started again with a hotplate and three borrowed chairs.'],
  ['Officer Balan', 'police', 'A patient witness statement beats a dramatic chase.', 'He knows the depot has problems. He needs evidence that can survive a hearing.'],
  ['Officer Roy', 'police', 'Very serious about forms in triplicate.', 'He joined to help people, and spends most afternoons finding missing bicycles.'],
  ['Tara', 'student', 'Curious, independent, allergic to bad advice.', 'She repairs old radios to pay for college. Her first sale was to your mother.'],
  ['Manu', 'gardener', 'Quiet until somebody steps on a seedling.', 'He planted the park after the flood. Half its trees are named after people who helped.'],
  ['Priya', 'resident', 'Organised, sceptical, surprisingly funny.', 'She lost an office job and built a small bookkeeping practice from her kitchen.'],
  ['Joseph', 'driver', 'Knows every shortcut and every bad boss.', 'He used to drive the clinic van. He recognises its missing supplies on the depot loading list.'],
  ['Anu', 'resident', 'Friendly but protective of her time.', 'She cares for an elderly aunt and still makes it to the evening walking club.'],
  ['Gopi', 'vendor', 'Has a price for almost everything.', 'He is saving to move his stall out of the rain. His expensive sandwiches subsidise the free ones.'],
  ['Fathima', 'teacher', 'Gentle questions, very difficult follow-ups.', 'She taught you arithmetic. She remembers you were better at fixing the classroom fan.'],
  ['Vinod', 'worker', 'Talks big when he feels small.', 'He hurt his hand on an unpaid shift. He is worried the depot will replace him.'],
  ['Neha', 'resident', 'Takes promises literally.', 'She built a mutual-aid list during the flood and still keeps it updated.'],
  ['Suraj', 'worker', 'Always looking for the next way forward.', 'He is studying for a bus licence. Every practice test lives in his lunch box.'],
  ['Latha', 'resident', 'Likes company and notices absences.', 'She has lived on this street for forty years. The map has changed more often than she has.'],
  ['Arun', 'resident', 'Easygoing, until somebody takes his bicycle.', 'He makes furniture from discarded timber and pays his rent in very ordinary instalments.']
];

function openPosition(world, requested, radius = 10, interior = null) {
  if (isWalkable(world, requested.x, requested.y, radius, interior)) return { ...requested };
  for (let ring = 12; ring <= 360; ring += 12) {
    for (let side = 0; side < 16; side++) {
      const angle = side / 16 * Math.PI * 2;
      const candidate = { x: requested.x + Math.cos(angle) * ring, y: requested.y + Math.sin(angle) * ring };
      if (isWalkable(world, candidate.x, candidate.y, radius, interior)) return candidate;
    }
  }
  return interior ? { x: 320, y: 410 } : { x: world.roads.vertical[0], y: world.roads.horizontal[0] };
}

function building(state, type) {
  return buildingByType(state.world, type) || state.world.buildings.find(item => item.type === type) || state.world.buildings[0];
}
function byId(state, id) { return state.world.buildings.find(item => item.id === id); }
function npcById(state, id) { return state.npcs.find(item => item.id === id); }
function pushMessage(state, text, tone = 'info') {
  state.messages.push({ id: ++state.sequence, text, tone, time: state.elapsed });
  if (state.messages.length > 7) state.messages.shift();
}
function log(state, text) {
  state.journal.unshift({ time: state.time, day: state.day, text });
  state.journal.length = Math.min(state.journal.length, 100);
  state.dirty = true;
}
function remember(state, npc, key, text, trust = 0) {
  if (!npc) return;
  if (npc.memories.some(item => item.key === key)) return;
  npc.trust = clamp(npc.trust + trust, -100, 100);
  npc.memories.unshift({ key, text, day: state.day, time: state.time });
  npc.memories.length = Math.min(npc.memories.length, 18);
  state.dirty = true;
}
function isOpen(state, place) {
  const hours = openingHours[place.type];
  return !hours || (state.time >= hours[0] && state.time < hours[1]);
}
function clue(state, key, text) {
  if (state.story.clues.includes(key)) return;
  state.story.clues.push(key);
  state.story.phase = Math.max(1, state.story.phase);
  log(state, text);
  pushMessage(state, 'Journal updated • ' + text, 'good');
}
function finishStory(state, ending) {
  if (state.story.resolved) return;
  state.story.resolved = true;
  state.story.phase = 3;
  state.story.ending = ending;
  state.story.parcel = false;
  state.story.debt = 0;
  const endings = {
    evidence: 'The records are filed. Varun loses his contract, the clinic gets its supplies, and the block keeps moving. Your next shift is your own choice.',
    independent: 'The last payment clears. You walk out without signing another dispatch sheet. The city has ordinary work, difficult friends, and a future you can afford to plan.',
    partner: 'Varun calls you a partner. Your pay improves, your neighbours are less certain about you, and the clinic keeps buying back what was already theirs. The city carries on.'
  };
  log(state, endings[ending]);
  pushMessage(state, 'CHAPTER COMPLETE • ' + (ending === 'evidence' ? 'The paper trail' : ending === 'independent' ? 'Your own terms' : 'The arrangement'), 'story');
  state.endingNotice = { ending, text: endings[ending], time: state.elapsed };
  state.dirty = true;
}

export function createGame(seed = 'back-on-the-block') {
  const world = generateWorld(seed);
  const state = {
    version: VERSION, seed, rngState: (hashSeed(seed) ^ 0x7a921b35) >>> 0,
    time: 480, elapsed: 0, day: 1, sequence: 0, world,
    player: { x: 0, y: 0, angle: 0, hp: 100, maxHp: 100, cash: 85, stamina: 100,
      honor: 0, heat: 0, investigation: 0, inventory: { medkit: 1, snack: 2, ammo: 0, pistol: 0 },
      interior: null, vehicleId: null, companionId: null, caseEvidence: [], moving: false, attackCooldown: 0,
      hurtCooldown: 0, shotCooldown: 0, magazine: 0, reloadingUntil: 0, equipped: false, identified: false, lastSeen: null, lastCrime: -1000, exposure: 0 },
    npcs: [], vehicles: [], events: [], cases: [], effects: [], messages: [], journal: [],
    story: { phase: 0, clues: [], resolved: false, ending: null, debt: 240, parcel: false, parcelInspected: false,
      accepted: false, declined: false, delivered: false, illegalRuns: 0, employerWarned: false },
    job: null, eventCooldown: 22, eventIndex: 0, eventHistory: [], eventCooldowns: {}, eventQueue: [], hangout: null, worldChanges: {},
    stats: { jobs: 0, helped: 0, crimes: 0, arrests: 0, deliveries: 0 }, dirty: false,
    nextSchedule: 0, policeCooldown: 0, recoveryNotice: null, endingNotice: null
  };
  const home = building(state, 'home');
  state.homeId = home.id;
  Object.assign(state.player, home.door);
  state.player.y += 26;
  const homes = world.buildings.filter(item => item.type === 'home' || item.type === 'apartment');
  const roleWork = { friend: 'garage', courier: 'depot', shopkeeper: 'shop', mechanic: 'garage', nurse: 'clinic', dispatcher: 'depot', broker: 'depot', clerk: 'office', neighbour: 'home', cook: 'cafe', police: 'police', student: 'cafe', gardener: 'park', teacher: 'office', driver: 'depot', worker: 'depot', vendor: 'shop' };
  state.npcs = people.map((person, index) => {
    const house = homes[index % Math.max(1, homes.length)] || home;
    const work = building(state, roleWork[person[1]] || 'office');
    const location = index === 0 ? { x: state.player.x + 43, y: state.player.y + 12 } : work.door;
    return { id: `npc-${index}`, name: person[0], role: person[1], age: 23 + index % 28, homeId: house.id, workId: work.id,
      x: location.x, y: location.y, interior: null, trust: index === 0 ? 28 : 0, memories: [], disclosures: [], sharedPast: [], lastDisclosure: -1000,
      task: index === 0 ? 'waiting to welcome you' : 'heading to work', personality: person[2], backstory: person[3],
      relation: index === 0 ? 'old friend' : 'stranger', hp: 100, angle: 0, moving: false, path: [],
      targetId: null, scheduleAt: index === 0 ? 90 : 0, lastTalk: -1000, hangoutAt: -1000,
      lastGift: -1000, introduced: index === 0, romantic: false, romanceAsked: false, recoveryAt: 0, panicUntil: 0,
      cash: 35 + index * 7, needs: { energy: 100, hunger: 20 }, wageDay: 0, mealDay: 0,
      color: ['#dbb98b', '#a9c29a', '#c9a8a7', '#96b4bd', '#cbb76e'][index % 5] };
  });
  for (let index = 0; index < 12; index++) {
    const owner = state.npcs[index + 2];
    const x = index === 0 ? home.door.x + 80 : world.roads.vertical[index % world.roads.vertical.length] + (index % 2 ? 24 : -24);
    const y = index === 0 ? home.door.y + 55 : world.roads.horizontal[Math.floor(index / 3) % 4] + 70 + index % 3 * 55;
    const parking = openPosition(world, { x: clamp(x, 90, world.width - 90), y: clamp(y, 90, world.height - 90) }, 23);
    state.vehicles.push({ id: `car-${index}`, x: parking.x, y: parking.y,
      angle: Math.PI / 2, speed: 0, health: 100, fuel: 100, ownerId: index === 0 ? 'player' : owner.id,
      color: ['#b66b52', '#738d86', '#c4ae72', '#748b9f', '#b4ada0'][index % 5], model: index % 4 === 0 ? 'van' : 'sedan', stolen: false, parked: true });
  }
  log(state, 'You are Alex, 25. A job fell through, and you have returned to the block where you grew up. There is a room waiting and ₹240 in rent arrears. You can decide what comes next.');
  log(state, 'Nikhil is waiting outside home. The dispatch depot has offered quick delivery money. The office and garage offer ordinary work.');
  pushMessage(state, 'Back on the block. Talk to Nikhil, or head for the depot.', 'story');
  return state;
}

function witnesses(state, source = state.player, range = 350) {
  return state.npcs.filter(npc => npc.hp > 0 && sameRoom(npc, source) && distance(npc, source) < range && canSee(state.world, npc, source));
}
function crime(state, type, severity, victimId = null) {
  const observers = witnesses(state);
  const record = { id: `case-${++state.sequence}`, type, severity, x: state.player.x, y: state.player.y,
    interior: state.player.interior, time: state.elapsed, day: state.day, witnesses: [], identified: false, resolved: false };
  state.stats.crimes++;
  state.player.honor = clamp(state.player.honor - severity * 2, -100, 100);
  state.player.lastCrime = state.elapsed;
  for (const npc of observers) {
    const knows = npc.introduced || distance(npc, state.player) < 135;
    record.witnesses.push({ id: npc.id, identified: knows });
    record.identified ||= knows;
    remember(state, npc, record.id, knows ? `Saw you ${type}.` : `Saw an unidentified person involved in ${type}.`, knows ? -severity * 5 : 0);
    npc.panicUntil = state.elapsed + 14;
  }
  if (victimId && observers.some(npc => npc.id === victimId)) remember(state, npcById(state, victimId), record.id + '-victim', `You were involved when they lost something to ${type}.`, -severity * 8);
  if (observers.length) {
    state.cases.push(record);
    state.player.investigation = clamp(state.player.investigation + severity * (record.identified ? 18 : 8), 0, 100);
    state.player.identified ||= record.identified;
    const officer = observers.find(npc => npc.role === 'police');
    if (officer || (record.identified && severity >= 3)) {
      state.player.heat = clamp(state.player.heat + severity * 24, 0, 100);
      state.player.lastSeen = { x: state.player.x, y: state.player.y, interior: state.player.interior, time: state.elapsed };
    }
    pushMessage(state, record.identified ? `Witnesses identified you • ${type}` : `Witnesses reported ${type}. Your identity is uncertain.`, 'danger');
    log(state, `${type}: ${observers.length} witness${observers.length === 1 ? '' : 'es'}${record.identified ? ' identified you' : ' reported an unknown suspect'}.`);
  } else {
    pushMessage(state, 'No one nearby witnessed that.', 'muted');
  }
  state.dirty = true;
  return record;
}

function legalPressure(state, dt) {
  const player = state.player;
  const police = state.npcs.filter(npc => npc.role === 'police' && npc.hp > 0);
  let visible = false;
  for (const officer of police) {
    const sees = sameRoom(officer, player) && distance(officer, player) < 320 && canSee(state.world, officer, player);
    if (sees && player.heat > 0) {
      visible = true;
      officer.task = 'pursuing an identified suspect';
      officer.path = [];
      moveTowards(state, officer, player, 125, dt);
      player.lastSeen = { x: player.x, y: player.y, interior: player.interior, time: state.elapsed };
      if (distance(officer, player) < (player.vehicleId ? 37 : 29)) player.exposure += dt;
    } else if (player.heat > 0 && player.lastSeen && state.elapsed - player.lastSeen.time < 18) {
      const last = player.lastSeen;
      officer.task = 'searching the last reported location';
      if (officer.interior === last.interior) moveTowards(state, officer, last, 85, dt);
      else travel(state, officer, last.interior, last, dt);
    }
  }
  if (!visible) {
    player.exposure = Math.max(0, player.exposure - dt * 1.8);
    if (state.elapsed - player.lastCrime > 6) player.heat = Math.max(0, player.heat - dt * 1.3);
  }
  if (player.exposure > 2.5) arrest(state);
  // An unconfirmed description fades. Identified reports remain until resolved.
  if (!player.identified && player.heat <= 0 && state.elapsed - player.lastCrime > 40) {
    player.investigation = Math.max(0, player.investigation - dt * 0.15);
  }
}
function arrest(state) {
  const station = building(state, 'police');
  const fine = Math.min(state.player.cash, 35 + Math.round(state.player.investigation / 3));
  state.player.cash -= fine;
  state.player.inventory.pistol = 0;
  state.player.inventory.ammo = 0;
  state.player.magazine = 0;
  state.player.reloadingUntil = 0;
  state.player.vehicleId = null;
  state.player.interior = null;
  Object.assign(state.player, station.door);
  state.player.y += 30;
  state.player.hp = Math.max(50, state.player.hp);
  state.player.heat = 0;
  state.player.investigation = 0;
  state.player.identified = false;
  state.player.exposure = 0;
  state.stats.arrests++;
  for (const report of state.cases) report.resolved = true;
  state.time = (state.time + 75) % 1440;
  log(state, `Released after processing. Paid ₹${fine}; any weapon was confiscated. The clerk suggests trying a less memorable afternoon.`);
  pushMessage(state, 'Released. Your story and relationships continue.', 'story');
  state.recoveryNotice = { title: 'A very long form', text: `You paid ₹${fine}. The block is still there. Legal work is available.`, time: state.elapsed };
}
function recover(state) {
  const clinic = building(state, 'clinic');
  const charge = Math.min(30, state.player.cash);
  state.player.cash -= charge;
  state.player.hp = 65;
  state.player.stamina = 80;
  state.player.vehicleId = null;
  state.player.interior = null;
  state.player.heat = 0;
  state.player.exposure = 0;
  Object.assign(state.player, clinic.door);
  state.player.y += 30;
  state.time = (state.time + 90) % 1440;
  if (state.job) cancelJob(state, 'Your accepted job ended when you were taken to the clinic.');
  log(state, `The clinic patched you up for ₹${charge}. The nurse leaves a glass of water beside a form asking you to be more careful.`);
  pushMessage(state, 'Back on your feet. The clinic offers free basic triage if you are broke.', 'good');
  state.recoveryNotice = { title: 'Back on your feet', text: `Treatment cost ₹${charge}. People remember what happened, but you can keep going.`, time: state.elapsed };
}

function moveTowards(state, actor, target, speed, dt) {
  const length = distance(actor, target);
  actor.moving = length > 7;
  if (length < 7) return true;
  const dx = (target.x - actor.x) / length;
  const dy = (target.y - actor.y) / length;
  actor.angle = Math.atan2(dy, dx);
  moveActor(state.world, actor, dx * Math.min(length, speed * dt), dy * Math.min(length, speed * dt));
  return distance(actor, target) < 12;
}
function travel(state, npc, targetInterior, targetPoint, dt) {
  if (npc.interior && npc.interior !== targetInterior) {
    const place = byId(state, npc.interior);
    if (moveTowards(state, npc, place.room.exit, 65, dt)) {
      npc.interior = null;
      npc.x = place.door.x;
      npc.y = place.door.y + 18;
      npc.path = [];
    }
    return;
  }
  if (!npc.interior && targetInterior) {
    const destination = byId(state, targetInterior);
    if (!destination) return;
    if (distance(npc, destination.door) < 22) {
      npc.interior = destination.id;
      Object.assign(npc, destination.room.entry);
      npc.path = [];
      return;
    }
    navigate(state, npc, destination.door, dt);
    return;
  }
  if (npc.interior) moveTowards(state, npc, targetPoint, 52, dt);
  else navigate(state, npc, targetPoint, dt);
}
function navigate(state, npc, targetPoint, dt) {
  if (!npc.path || !npc.path.length || state.elapsed > (npc.pathAt || 0) + 12) {
    npc.path = findPath(state.world, npc, targetPoint) || [];
    npc.pathAt = state.elapsed;
  }
  const waypoint = npc.path[0] || targetPoint;
  if (moveTowards(state, npc, waypoint, npc.panicUntil > state.elapsed ? 105 : 58, dt) && npc.path.length) npc.path.shift();
}
function updateNPCs(state, dt) {
  for (const npc of state.npcs) {
    npc.needs.hunger = clamp(npc.needs.hunger + dt * 0.025, 0, 100);
    npc.needs.energy = clamp(npc.needs.energy + dt * (npc.interior === npc.homeId ? 0.12 : -0.025), 0, 100);
    if (state.time >= 1020 && npc.wageDay < state.day && npc.role !== 'student') {
      npc.cash += npc.role === 'broker' ? 95 : npc.role === 'worker' ? 35 : 48;
      npc.wageDay = state.day;
    }
    if (state.time >= 1060 && npc.mealDay < state.day && npc.cash >= 8) {
      npc.cash -= 8;
      npc.needs.hunger = Math.max(0, npc.needs.hunger - 45);
      npc.mealDay = state.day;
    }
    if (npc.hp <= 0) {
      npc.moving = false;
      npc.task = 'recovering at the clinic';
      if (state.elapsed >= npc.recoveryAt) {
        npc.hp = 55;
        npc.interior = building(state, 'clinic').id;
        Object.assign(npc, byId(state, npc.interior).room.entry);
        npc.scheduleAt = state.elapsed + 25;
        npc.path = [];
      }
      continue;
    }
    if (npc.role === 'police' && state.player.heat > 0) continue;
    if (npc.id === state.player.companionId && state.player.heat <= 0 && npc.trust >= 5) {
      if (state.player.vehicleId) {
        npc.passengerOf = state.player.vehicleId;
        npc.interior = null;
        npc.x = state.player.x;
        npc.y = state.player.y;
        npc.angle = state.player.angle;
        npc.moving = false;
        npc.task = 'riding with you';
        npc.path = [];
        continue;
      }
      if (npc.passengerOf) {
        npc.passengerOf = null;
        npc.interior = state.player.interior;
        npc.x = state.player.x;
        npc.y = state.player.y;
        moveActor(state.world, npc, 18, 0);
      }
      npc.task = 'walking with you';
      const goal = { x: state.player.x - 38, y: state.player.y + 24 };
      travel(state, npc, state.player.interior, goal, dt);
      continue;
    }
    if (npc.panicUntil > state.elapsed) {
      npc.task = 'keeping a safe distance';
      if (sameRoom(npc, state.player) && distance(npc, state.player) < 170) {
        const d = Math.max(1, distance(npc, state.player));
        moveActor(state.world, npc, (npc.x - state.player.x) / d * dt * 90, (npc.y - state.player.y) / d * dt * 90);
      }
      continue;
    }
    if (npc.scheduleAt > state.elapsed) { npc.moving = false; continue; }
    let targetPlace;
    let task;
    if (npc.role === 'police') {
      const junction = Math.floor(state.elapsed / 28 + Number(npc.id.slice(4))) % state.world.roads.horizontal.length;
      const patrol = { x: state.world.roads.vertical[junction], y: state.world.roads.horizontal[(junction + 2) % state.world.roads.horizontal.length] };
      npc.task = 'neighbourhood patrol';
      travel(state, npc, null, patrol, dt);
      continue;
    }
    const workStart = npc.role === 'cook' || npc.role === 'shopkeeper' ? 420 : 540;
    if (state.time >= workStart && state.time < 1020) {
      targetPlace = byId(state, npc.workId);
      task = 'at work';
    } else if (state.time >= 1020 && state.time < 1230) {
      targetPlace = building(state, 'cafe');
      task = 'taking an evening break';
    } else {
      targetPlace = byId(state, npc.homeId);
      task = 'at home';
    }
    if (!targetPlace) continue;
    npc.task = task;
    npc.targetId = targetPlace.id;
    travel(state, npc, targetPlace.id, { x: 230 + Number(npc.id.slice(4)) % 4 * 60, y: 330 }, dt);
  }
}

function updatePlayer(state, dt, input) {
  const player = state.player;
  if (player.reloadingUntil && state.elapsed >= player.reloadingUntil) {
    player.magazine = Math.min(6, player.inventory.ammo);
    player.reloadingUntil = 0;
    pushMessage(state, `Loaded ${player.magazine} rounds.`, 'info');
  }
  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  player.hurtCooldown = Math.max(0, player.hurtCooldown - dt);
  player.shotCooldown = Math.max(0, player.shotCooldown - dt);
  const x = clamp(finite(input.x), -1, 1);
  const y = clamp(finite(input.y), -1, 1);
  if (player.vehicleId) {
    const vehicle = state.vehicles.find(item => item.id === player.vehicleId);
    if (!vehicle || vehicle.health <= 0) {
      if (vehicle) vehicle.speed = 0;
      exitVehicle(state);
      return;
    }
    const acceleration = -y * (vehicle.fuel > 0 ? 135 : 0);
    vehicle.speed += acceleration * dt;
    vehicle.speed *= Math.exp(-dt * (input.brake ? 5.2 : 0.55));
    vehicle.speed = clamp(vehicle.speed, -90, vehicle.model === 'van' ? 225 : 285);
    if (Math.abs(vehicle.speed) > 6) vehicle.angle += x * dt * 2.1 * Math.sign(vehicle.speed) * Math.min(1, Math.abs(vehicle.speed) / 65);
    const oldX = vehicle.x;
    const oldY = vehicle.y;
    vehicle.radius = 23;
    vehicle.interior = null;
    moveActor(state.world, vehicle, Math.cos(vehicle.angle) * vehicle.speed * dt, Math.sin(vehicle.angle) * vehicle.speed * dt);
    const moved = Math.hypot(vehicle.x - oldX, vehicle.y - oldY);
    if (moved < Math.abs(vehicle.speed) * dt * 0.35 && Math.abs(vehicle.speed) > 55) {
      vehicle.health = Math.max(0, vehicle.health - Math.abs(vehicle.speed) * 0.045);
      damagePlayer(state, Math.abs(vehicle.speed) * 0.025);
      vehicle.speed *= -0.22;
      state.effects.push({ kind: 'burst', x: vehicle.x, y: vehicle.y, life: 0.3, color: '#e5c087' });
    }
    vehicle.fuel = Math.max(0, vehicle.fuel - Math.abs(vehicle.speed) * dt * 0.0012);
    player.x = vehicle.x;
    player.y = vehicle.y;
    player.angle = vehicle.angle;
    player.moving = Math.abs(vehicle.speed) > 4;
    if (Math.abs(vehicle.speed) > 90) {
      for (const npc of state.npcs) {
        if (npc.hp > 0 && !npc.interior && npc.passengerOf !== vehicle.id && npc.id !== player.companionId && distance(vehicle, npc) < 29 && player.hurtCooldown <= 0) {
          hurtNPC(state, npc, 45, 'reckless driving');
          vehicle.speed *= 0.6;
          player.hurtCooldown = 0.8;
        }
      }
    }
  } else {
    const magnitude = Math.hypot(x, y);
    const running = input.run && player.stamina > 1 && magnitude > 0;
    const speed = running ? 175 : 112;
    if (magnitude) {
      moveActor(state.world, player, x / Math.max(1, magnitude) * speed * dt, y / Math.max(1, magnitude) * speed * dt);
      player.angle = Math.atan2(y, x);
    }
    player.moving = magnitude > 0;
    player.stamina = clamp(player.stamina + dt * (running ? -19 : 15), 0, 100);
  }
  if ((player.equipped || input.fire) && input.aim && Number.isFinite(input.aim.x) && Number.isFinite(input.aim.y)) {
    player.angle = Math.atan2(input.aim.y - player.y, input.aim.x - player.x);
  }
  if (input.fire) attack(state);
  if (input.honk && player.vehicleId && (player.honkAt || -1000) < state.elapsed - 1.5) {
    player.honkAt = state.elapsed;
    pushMessage(state, 'The horn works. Your neighbours have confirmed it.', 'muted');
    for (const npc of state.npcs) if (!npc.interior && distance(npc, player) < 140) npc.panicUntil = state.elapsed + 1.5;
  }
}
function damagePlayer(state, damage) {
  if (state.player.hurtCooldown > 0) return;
  state.player.hp = Math.max(0, state.player.hp - damage);
  state.player.hurtCooldown = 0.45;
  state.effects.push({ kind: 'burst', x: state.player.x, y: state.player.y, life: 0.2, color: '#b37669' });
}
function hurtNPC(state, npc, damage, offense = 'assault') {
  if (npc.hp <= 0) return;
  crime(state, offense, damage >= 40 ? 4 : 2, npc.id);
  npc.hp = Math.max(0, npc.hp - damage);
  npc.panicUntil = state.elapsed + 18;
  if (npc.hp <= 0) {
    npc.recoveryAt = state.elapsed + 50;
    npc.task = 'waiting for medical help';
    if (state.player.companionId === npc.id) state.player.companionId = null;
    pushMessage(state, `${npc.name} is unconscious. Medical help is on its way.`, 'danger');
    log(state, `${npc.name} was injured. They will recover at the clinic and remember what happened.`);
  }
}
function attack(state) {
  const player = state.player;
  if (player.attackCooldown > 0 || player.hp <= 0) return;
  const armed = player.equipped && player.inventory.pistol > 0;
  if (armed && (player.inventory.ammo <= 0 || player.magazine <= 0 || player.reloadingUntil > state.elapsed)) {
    player.attackCooldown = 0.8;
    pushMessage(state, player.reloadingUntil > state.elapsed ? 'Reloading…' : player.inventory.ammo > 0 ? 'Empty magazine. Press R to reload.' : 'Out of ammunition. Holster the pistol to defend yourself unarmed.', 'warn');
    return;
  }
  player.attackCooldown = armed ? 0.32 : 0.7;
  if (armed) { player.inventory.ammo--; player.magazine--; }
  const range = armed ? 430 : 49;
  const direction = { x: Math.cos(player.angle), y: Math.sin(player.angle) };
  let victim = null;
  let nearestDistance = range;
  for (const npc of state.npcs) {
    if (npc.hp <= 0 || !sameRoom(npc, player)) continue;
    const d = distance(npc, player);
    const dot = ((npc.x - player.x) * direction.x + (npc.y - player.y) * direction.y) / Math.max(1, d);
    if (d < nearestDistance && dot > (armed ? 0.93 : 0.2) && canSee(state.world, player, npc)) {
      nearestDistance = d;
      victim = npc;
    }
  }
  if (armed) {
    const end = victim || { x: player.x + direction.x * range, y: player.y + direction.y * range };
    state.effects.push({ kind: 'tracer', x: player.x, y: player.y, toX: end.x, toY: end.y, life: 0.13, color: '#efd493' });
  } else state.effects.push({ kind: 'burst', x: player.x + direction.x * 24, y: player.y + direction.y * 24, life: 0.15, color: '#d9c09c' });
  if (victim) hurtNPC(state, victim, armed ? 45 : 19, armed ? 'armed assault' : 'assault');
  else if (armed && state.elapsed - (player.lastShotReport || -100) > 5) {
    player.lastShotReport = state.elapsed;
    crime(state, 'discharging a weapon', 3);
  }
  state.dirty = true;
}
function exitVehicle(state) {
  const vehicle = state.vehicles.find(item => item.id === state.player.vehicleId);
  if (!vehicle) { state.player.vehicleId = null; return true; }
  if (Math.abs(vehicle.speed) > 45) { pushMessage(state, 'Slow down before getting out.', 'warn'); return false; }
  const origin = { x: vehicle.x, y: vehicle.y, interior: null, radius: 10 };
  for (const angle of [vehicle.angle + Math.PI / 2, vehicle.angle - Math.PI / 2, vehicle.angle + Math.PI, vehicle.angle]) {
    const candidate = { ...origin };
    moveActor(state.world, candidate, Math.cos(angle) * 45, Math.sin(angle) * 45);
    if (distance(origin, candidate) > 20) {
      state.player.x = candidate.x;
      state.player.y = candidate.y;
      state.player.vehicleId = null;
      vehicle.speed = 0;
      vehicle.parked = true;
      const passenger = state.npcs.find(npc => npc.passengerOf === vehicle.id);
      if (passenger) {
        passenger.passengerOf = null;
        passenger.interior = null;
        passenger.x = candidate.x;
        passenger.y = candidate.y;
        passenger.path = [];
        moveActor(state.world, passenger, 18, 0);
      }
      return true;
    }
  }
  pushMessage(state, 'Park farther from the wall so there is room to get out.', 'warn');
  return false;
}

function updateJob(state, dt) {
  const job = state.job;
  if (!job) return;
  if (job.kind === 'shift' && state.player.interior === job.fromId) {
    job.progress += dt;
    if (job.progress >= job.duration) completeJob(state);
  }
  if (state.elapsed > job.deadline) cancelJob(state, 'The accepted job deadline passed. A replacement worker finished it.');
}
function startJob(state, kind, from) {
  if (state.job) { pushMessage(state, 'Finish or cancel the job you have already accepted.', 'warn'); return; }
  const destinations = state.world.buildings.filter(item => (kind === 'illicit' ? ['pawn', 'bar'].includes(item.type) : ['shop', 'cafe', 'clinic', 'office'].includes(item.type)) && item.id !== from.id);
  const destination = destinations[Math.floor(random(state) * destinations.length)] || building(state, 'cafe');
  const delivery = kind !== 'shift';
  state.job = { id: `job-${++state.sequence}`, kind, fromId: from.id, toId: destination.id,
    reward: kind === 'illicit' ? 95 : delivery ? 65 : 48, accepted: state.elapsed, deadline: state.elapsed + (delivery ? 300 : 150),
    duration: 22, progress: 0, description: delivery ? `Deliver ${kind === 'illicit' ? 'knowingly stolen supplies' : 'ordinary stock'} to ${destination.name}.` : `Complete a paid shift inside ${from.name}.` };
  log(state, `Accepted work. ${state.job.description}`);
  pushMessage(state, delivery ? 'Delivery accepted. Your map and objective show the address.' : 'Shift started. Stay inside for 22 seconds. You can still talk and move.', 'good');
}
function completeJob(state) {
  const job = state.job;
  if (!job) return;
  state.player.cash += job.reward;
  state.player.honor = clamp(state.player.honor + 3, -100, 100);
  state.stats.jobs++;
  if (job.kind === 'delivery') state.stats.deliveries++;
  if (job.kind === 'illicit') {
    state.story.illegalRuns++;
    crime(state, 'handling stolen supplies', 2);
    remember(state, state.npcs[6], `illegal-${state.story.illegalRuns}`, 'You completed a knowing illicit consignment.', 6);
    if (state.story.illegalRuns >= 3) pushMessage(state, 'Varun offers a partnership at the depot.', 'story');
  }
  log(state, `Completed ${job.kind === 'shift' ? 'a shift' : 'a delivery'}. Earned ₹${job.reward}.`);
  pushMessage(state, `Work complete • +₹${job.reward}`, 'good');
  state.job = null;
  if (state.stats.jobs === 1 && job.kind !== 'illicit') remember(state, state.npcs[0], 'first-job', 'You found ordinary work after coming home.', 4);
}
function cancelJob(state, text) {
  if (state.job && state.job.kind !== 'shift') {
    state.eventQueue.push({ type: 'restock', npcId: 'npc-2', reason: 'A delivery was missed. The shop is short of stock.' });
    state.eventCooldown = Math.min(state.eventCooldown, 10);
  }
  state.job = null;
  log(state, text);
  pushMessage(state, text, 'warn');
}

function spawnEvent(state) {
  const types = ['dropped_wallet', 'injury', 'friend_favor', 'restock', 'wage_dispute', 'lost_bag'];
  const available = state.npcs.filter(npc => npc.hp > 0 && npc.panicUntil <= state.elapsed && !state.events.some(event => event.npcId === npc.id && ['open', 'accepted'].includes(event.stage)));
  let queued = state.eventQueue.shift();
  let type;
  let npc;
  if (state.eventIndex === 0) {
    // An opening opportunity nearby introduces consequences before the random city incidents.
    type = 'dropped_wallet';
    npc = state.npcs[0];
  } else if (queued) {
    type = queued.type;
    npc = available.find(item => item.id === queued.npcId);
    if (!npc) { state.eventQueue.push(queued); return; }
  } else {
    const eligible = types.filter(candidate => state.elapsed - (state.eventCooldowns[candidate] ?? -1000) > 150 && (candidate !== 'wage_dispute' || !state.story.resolved));
    if (!eligible.length) return;
    type = eligible[Math.floor(random(state) * eligible.length)];
    let pool = available.filter(person => sameRoom(person, state.player) && distance(person, state.player) < 650);
    if (type === 'friend_favor') pool = available.filter(person => person.role === 'friend' && person.trust >= 5);
    if (type === 'wage_dispute') pool = available.filter(person => person.role === 'courier');
    if (type === 'restock') pool = available.filter(person => person.role === 'shopkeeper');
    if (type === 'injury') pool = pool.filter(person => person.hp >= 70);
    if (!pool.length) return;
    npc = pool[Math.floor(random(state) * pool.length)];
  }
  if (!npc || npc.hp <= 0) return;
  state.eventIndex++;
  state.eventCooldowns[type] = state.elapsed;
  const event = { id: `event-${++state.sequence}`, type, x: npc.x, y: npc.y, interior: npc.interior,
    stage: 'open', expires: state.elapsed + 140, npcId: npc.id, ownerId: npc.id, accepted: false, known: false, reason: queued?.reason || null };
  if (state.eventIndex === 1) { event.x = state.player.x + 35; event.y = state.player.y + 15; event.interior = state.player.interior; }
  state.events.push(event);
  if (type === 'injury') { npc.hp = 40; npc.scheduleAt = state.elapsed + 130; npc.task = 'sitting down with an injured hand'; }
  if (type === 'friend_favor') { event.expires = state.elapsed + 200; event.targetId = building(state, 'shop').id; }
}

function updateEvents(state, dt) {
  state.eventCooldown -= dt;
  if (state.eventCooldown <= 0 && state.events.filter(event => ['open', 'accepted'].includes(event.stage)).length < 2) {
    spawnEvent(state);
    state.eventCooldown = 48 + random(state) * 30;
  }
  for (const event of state.events) {
    if (!['open', 'accepted'].includes(event.stage)) continue;
    const npc = npcById(state, event.npcId);
    if (!npc) { event.stage = 'expired'; continue; }
    if (event.type !== 'dropped_wallet' && event.type !== 'lost_bag') Object.assign(event, { x: npc.x, y: npc.y, interior: npc.interior });
    if (event.expires < state.elapsed) {
      event.stage = 'expired';
      if (event.accepted && event.type === 'friend_favor') {
        remember(state, npc, event.id + '-missed', 'You promised to help and did not make it back in time.', -5);
        log(state, `A promise to ${npc.name} expired. They found another way to manage.`);
      }
      if (event.type === 'injury') {
        npc.hp = 65;
        npc.interior = building(state, 'clinic').id;
        Object.assign(npc, byId(state, npc.interior).room.entry);
        npc.scheduleAt = state.elapsed + 35;
        npc.task = 'recovering after a neighbour called the clinic';
      }
    }
  }
  if (state.hangout) {
    const npc = npcById(state, state.hangout.npcId);
    if (npc && npc.hp > 0 && sameRoom(npc, state.player) && distance(npc, state.player) < 180 && state.player.heat <= 0) {
      state.hangout.progress += dt;
      if (state.hangout.progress > 24) {
        remember(state, npc, `hangout-${state.day}-${Math.floor(state.elapsed / 160)}`, 'You made time to walk and talk without asking for anything.', 8);
        npc.hangoutAt = state.elapsed;
        log(state, `Spent some time with ${npc.name}. They seem more at ease around you.`);
        pushMessage(state, `${npc.name} enjoyed the company.`, 'good');
        state.hangout = null;
      }
    }
  }
}

export function tick(state, delta, input = {}) {
  const dt = clamp(finite(delta), 0, 0.1);
  if (!dt) return;
  state.elapsed += dt;
  state.time += dt * MINUTES_PER_SECOND;
  if (state.time >= 1440) { state.time %= 1440; state.day++; state.dirty = true; }
  state.player.lastX = state.player.x;
  state.player.lastY = state.player.y;
  updatePlayer(state, dt, input);
  updateNPCs(state, dt);
  legalPressure(state, dt);
  updateJob(state, dt);
  updateEvents(state, dt);
  state.effects = state.effects.filter(effect => (effect.life -= dt) > 0).slice(-100);
  if (state.events.length > 40) state.events = state.events.filter(event => ['open', 'accepted'].includes(event.stage) || state.elapsed - event.expires < 180);
  if (state.cases.length > 50) state.cases = [...state.cases.filter(report => !report.resolved), ...state.cases.filter(report => report.resolved).slice(-10)].slice(-50);
  state.messages = state.messages.filter(message => state.elapsed - message.time < 9);
  if (state.player.hp <= 0) recover(state);
  if (state.player.companionId) {
    const friend = npcById(state, state.player.companionId);
    if (!friend || friend.trust < 5 || friend.hp <= 0) {
      state.player.companionId = null;
      state.hangout = null;
    }
  }
}

export function nearby(state) {
  const player = state.player;
  const targets = [];
  const add = (kind, id, label, point, range) => {
    const d = distance(player, point);
    if (d <= range) targets.push({ kind, id, label, distance: d });
  };
  if (player.vehicleId) {
    add('vehicle', player.vehicleId, 'Leave vehicle', player, 1);
    return targets;
  }
  for (const npc of state.npcs) if (npc.hp > 0 && sameRoom(player, npc)) add('npc', npc.id, npc.name, npc, 84);
  for (const event of state.events) if (['open', 'accepted'].includes(event.stage) && !(event.collected && ['dropped_wallet', 'lost_bag'].includes(event.type)) && sameRoom(event, player)) {
    const names = { dropped_wallet: 'A dropped wallet', injury: 'Someone needs help', friend_favor: 'A favour for a friend', restock: 'A stock shortage', wage_dispute: 'An unpaid wage', lost_bag: 'An unattended bag' };
    add('event', event.id, names[event.type], event, 100);
  }
  if (player.interior) {
    const place = byId(state, player.interior);
    if (!place) return targets;
    add('exit', place.id, 'Leave ' + place.name, place.room.exit, 76);
    add('counter', place.id, place.type === 'home' || place.type === 'apartment' ? 'Kitchen table' : 'Counter • ' + place.name, place.room.spots.counter, 110);
    if (place.id === state.homeId || place.type === 'apartment') {
      add('bed', place.id, place.id === state.homeId ? 'Rest until morning' : 'A private bed', place.room.spots.bed, 95);
      add('stash', place.id, 'Cupboard', place.room.spots.stash, 95);
    }
  } else {
    for (const place of state.world.buildings) add('building', place.id, place.name, place.door, 76);
    for (const vehicle of state.vehicles) add('vehicle', vehicle.id, vehicle.ownerId === 'player' ? 'Your ' + vehicle.model : 'Parked ' + vehicle.model, vehicle, 70);
  }
  return targets.sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
}

const option = (id, label, hint = '', disabled = false) => ({ id, label, hint, disabled });
function resolveTarget(state, target) {
  if (typeof target === 'string') return nearby(state).find(item => item.id === target) || { kind: target.startsWith('npc-') ? 'npc' : 'counter', id: target };
  return target || null;
}
export function interaction(state, requested) {
  const target = resolveTarget(state, requested);
  if (!target) return { title: 'The block', body: 'Move closer to someone or something useful.', options: [option('close', 'Keep walking')] };
  const player = state.player;
  if (target.kind === 'npc') return npcInteraction(state, npcById(state, target.id));
  if (target.kind === 'event') return eventInteraction(state, state.events.find(event => event.id === target.id));
  if (target.kind === 'vehicle') {
    const vehicle = state.vehicles.find(item => item.id === target.id);
    if (!vehicle) return { title: 'Vehicle', body: 'It is no longer here.', options: [] };
    const yours = vehicle.ownerId === 'player';
    return { title: yours ? 'Your old runabout' : 'A parked ' + vehicle.model, subtitle: `Condition ${Math.round(vehicle.health)}% • Fuel ${Math.round(vehicle.fuel)}%`,
      body: player.vehicleId ? 'Park somewhere clear before getting out.' : yours ? 'It still starts. The indicator has opinions of its own.' : 'This belongs to someone on the block. Taking it may be witnessed or reported by its owner.',
      options: [option(player.vehicleId ? 'vehicle_exit' : 'vehicle_enter', player.vehicleId ? 'Get out' : yours ? 'Get in' : 'Take the vehicle', yours ? 'W/S drive • A/D steer • Space brake' : 'Theft has consequences'), option('close', 'Leave it')] };
  }
  const place = byId(state, target.id);
  if (!place) return { title: 'The block', body: 'There is nothing to interact with here.', options: [] };
  if (target.kind === 'building') {
    const open = isOpen(state, place);
    const hours = openingHours[place.type];
    return { title: place.name, subtitle: place.district, body: !open ? `Closed. Posted hours ${formatTime(hours[0])}–${formatTime(hours[1])}.` : place.type === 'apartment' ? 'A shared entrance. Residents keep their own cupboards and their own opinions.' : 'The door is open.',
      options: [option('enter', 'Go inside', open ? '' : 'Come back during opening hours', !open), option('close', 'Stay outside')] };
  }
  if (target.kind === 'exit') return { title: place.name, body: 'Head back to the street.', options: [option('exit', 'Go outside'), option('close', 'Stay here')] };
  if (target.kind === 'bed') return { title: 'A place to begin again', body: place.id === state.homeId ? 'Sleep until 08:00. Health and stamina recover. Accepted tasks may expire while you rest.' : 'This bed belongs to someone else.', options: [option('sleep', 'Sleep until morning', 'Time passes for everyone', place.id !== state.homeId), option('close', 'Stay awake')] };
  if (target.kind === 'stash') {
    const yours = place.id === state.homeId;
    return { title: yours ? 'Your cupboard' : 'Someone else’s cupboard', body: yours ? 'Your belongings fit on one shelf. There is room for a better year.' : 'A small envelope is tucked under a stack of shirts. Taking it is theft.', options: [option(yours ? 'home_supplies' : 'steal_stash', yours ? 'Check your old supplies' : 'Take the envelope', yours ? 'One old snack, once' : '₹35 • personal consequences', yours && Boolean(state.worldChanges.homeSupplies)), option('close', 'Close the cupboard')] };
  }
  return counterInteraction(state, place);
}

function npcInteraction(state, npc) {
  if (!npc) return { title: 'A neighbour', body: 'They have moved on.', options: [] };
  const memories = npc.memories.slice(0, 2).map(item => item.text).join(' ');
  const greeting = npc.role === 'friend' && !npc.memories.some(item => item.key === 'welcome') ? '“You made it. Your room is ready. The car still starts, mostly. I heard dispatch is hiring.”' : npc.trust < -25 ? '“I remember what happened. Keep this brief.”' : npc.trust >= 30 ? '“Good to see you. How are things holding up?”' : '“Hello. You looking for somebody?”';
  const known = npc.disclosures.length ? '\n\n' + npc.backstory : '';
  const body = `${npc.lastQuote ? '“' + npc.lastQuote + '”' : greeting}\n\n${npc.personality}${known}${memories ? '\n\nThey remember: ' + memories : ''}`;
  const options = [option('talk', 'Ask how their day is going', npc.task), option('history', npc.disclosures.length ? 'Talk about what they shared' : 'Ask about their life', npc.trust < 18 ? 'They need to know you better' : 'A personal conversation'), option('hangout', 'Spend some time together', 'Walk nearby for 24 seconds. Available once every few minutes.', npc.trust < 5 || state.elapsed - npc.hangoutAt < 160), option('invite', state.player.companionId === npc.id ? 'Say goodbye for now' : 'Ask them to walk with you', 'A trusted person can keep you company', npc.trust < 12), option('gift', 'Share a snack', 'Uses one snack • one gift per day', state.player.inventory.snack < 1 || state.elapsed - npc.lastGift < 300)];
  const quietSetting = state.player.interior && ['home', 'apartment', 'cafe', 'bar'].includes(byId(state, state.player.interior)?.type);
  const sharedCount = npc.sharedPast.length;
  const disclosureReady = sharedCount < 3 && npc.trust >= [30, 50, 70][sharedCount] && state.elapsed - npc.lastDisclosure >= 120 && (quietSetting || state.player.companionId === npc.id) && state.player.heat <= 0;
  if (disclosureReady) options.push(option('share_past', ['Tell them why you came home', 'Tell them what happened at the apprenticeship', 'Tell them what you have been afraid to admit'][sharedCount], 'A private disclosure to this person. You can choose another subject.'));
  if (state.events.some(event => event.npcId === npc.id && event.stage === 'accepted' && event.collected && ['dropped_wallet', 'lost_bag'].includes(event.type))) options.unshift(option('return_found', 'Return their missing property', 'Give the found item back in person'));
  if (['courier', 'driver', 'dispatcher', 'nurse'].includes(npc.role)) options.push(option('ask_delivery', 'Ask about the clinic deliveries', 'An alternate way to investigate'));
  if (npc.role === 'friend') options.push(option('friend_advice', 'Ask Nikhil what he would do'));
  if (npc.role === 'police') options.push(option('surrender', 'Discuss your legal situation'), option('report_story', 'Give a statement about the depot', 'Requires two useful clues', state.story.clues.length < 2 || state.story.resolved));
  if (npc.id === 'npc-1' && npc.trust >= 42) options.push(option('romance', npc.romantic ? 'Talk about the two of you' : 'Ask if this could be a date', 'An invitation, with room to decline'));
  if (npc.trust < 0) options.push(option('apologize', 'Acknowledge what you did', 'Words help once. Actions take longer.'));
  options.push(option('close', 'See you around'));
  return { title: npc.name, subtitle: `${npc.relation} • ${npc.task} • Trust ${Math.round(npc.trust)}`, body, options };
}
function counterInteraction(state, place) {
  const options = [];
  let body = '';
  if (state.job?.toId === place.id && ['delivery', 'illicit'].includes(state.job.kind)) options.push(option('complete_delivery', state.job.kind === 'illicit' ? 'Hand over the illicit consignment' : 'Hand over the ordinary delivery', `Earn ₹${state.job.reward}`));
  const promise = state.events.find(event => event.type === 'friend_favor' && event.accepted && event.stage === 'accepted' && event.targetId === place.id);
  if (promise) options.push(option('collect_favor', 'Collect the screws Nikhil ordered', 'Take them back to him'));
  if (place.type === 'depot') {
    body = 'The noticeboard offers ordinary stock deliveries. Dev also has a “special handling” parcel. The handwriting on its invoice is trying very hard to look official.';
    options.push(option('legal_delivery', 'Take an ordinary delivery', '₹65 • a clear destination and a five-minute deadline', Boolean(state.job)));
    if (!state.story.resolved) {
      if (!state.story.accepted && !state.story.declined) options.push(option('accept_parcel', 'Accept the special delivery', 'Promised ₹110. You have not been told it is illegal.'), option('decline_parcel', 'Refuse the special delivery', 'Ordinary work remains available'));
      if (state.story.parcel) options.push(option('inspect_parcel', 'Inspect the parcel and invoice', 'Find out what you are carrying'), option('return_parcel', 'Return the parcel to the depot', 'You can refuse to deliver it'));
      options.push(option('inspect_manifest', 'Read the loading manifest', 'An accessible evidence route'));
      if (state.story.phase >= 1) options.push(option('settle_debt', 'Clear your ₹240 arrears with earned money', 'A lawful way out', state.player.cash < state.story.debt), option('illegal_delivery', 'Accept another illicit run', '₹95 • knowing participation', Boolean(state.job)));
      if (state.story.illegalRuns >= 3) options.push(option('join_partner', 'Take Varun’s partnership offer', 'Resolves the story on his terms'));
    }
  } else if (place.type === 'shop') {
    body = 'Leela points at the price labels. “The sandwich is expensive. The advice is complimentary and often unwanted.”';
    options.push(option('buy_snack', 'Buy a snack', '₹8 • restores 12 health and stamina', state.player.cash < 8 || state.player.inventory.snack >= 20), option('buy_medkit', 'Buy a first aid kit', '₹28 • restores 45 health', state.player.cash < 28 || state.player.inventory.medkit >= 10), option('shop_help', 'Help with the stock', 'Paid indoor shift • ₹48', Boolean(state.job)));
  } else if (place.type === 'cafe' || place.type === 'bar') {
    body = 'Imran has tea on the stove and a radio that only receives bad news. “Sit down. It sounds better with company.”';
    options.push(option('tea', 'Have tea and a meal', '₹12 • restore 22 health', state.player.cash < 12), option('cafe_shift', 'Take a washing-up shift', '₹48 • 22 seconds inside', Boolean(state.job)));
  } else if (place.type === 'clinic') {
    body = 'Treatment first, paperwork second. That order is written on a sign because somebody once tried the opposite.';
    options.push(option('treatment', state.player.cash < 20 ? 'Ask for basic triage' : 'Get treatment', state.player.cash < 20 ? 'Free • recover to at least 50 health' : '₹20 • full health', state.player.hp >= 100), option('clinic_records', 'Ask about the missing supplies', 'A public inventory discrepancy'));
    if (state.story.parcel) options.push(option('deliver_parcel', 'Hand over the clinic parcel', state.story.parcelInspected ? 'Return stolen supplies to the people who need them' : 'Complete the job before you understand it'));
  } else if (place.type === 'office') {
    body = 'The temporary-work sheet has room for one more name. The motivational poster says “YOU ARE REPLACEABLE” with a coffee stain over the last word.';
    options.push(option('office_shift', 'Take a filing shift', '₹48 • 22 seconds inside', Boolean(state.job)));
  } else if (place.type === 'garage') {
    body = 'Rafi can offer repair work. Your old car can be patched up and filled here, too.';
    options.push(option('garage_shift', 'Take a repair shift', '₹48 • 22 seconds inside', Boolean(state.job)), option('repair_car', 'Repair and refuel your car', '₹25 • works even if the car was left elsewhere', state.player.cash < 25));
  } else if (place.type === 'police') {
    body = 'A laminated sign reads PLEASE TAKE A NUMBER. Nobody remembers where the number machine went.';
    options.push(option('surrender', 'Settle your current case', 'Pay an affordable fine. Confiscated weapons are not returned.'), option('report_story', 'Submit the delivery evidence', 'Two clues let the story resolve through a formal report', state.story.clues.length < 2 || state.story.resolved));
  } else if (place.type === 'pawn') {
    body = '“Everything has a previous owner,” says the sign. The clerk is vague about which previous owners have agreed to this.';
    options.push(option('buy_pistol', 'Buy a second-hand pistol', '₹145 • possession alone creates no pursuit', state.player.cash < 145 || state.player.inventory.pistol > 0), option('buy_ammo', 'Buy twelve rounds', '₹24', state.player.cash < 24 || state.player.inventory.ammo > 188), option('sell_snack', 'Sell a spare snack', '+₹4', state.player.inventory.snack < 1));
  } else {
    body = 'The table holds rent notices, old photographs and a half-finished list of things to fix.';
    if (place.id === state.homeId) options.push(option('settle_debt', 'Pay off your rent arrears', `₹${state.story.debt} • an independent ending`, state.story.resolved || state.player.cash < state.story.debt), option('home_history', 'Look at the old photograph', 'Your history is fixed, even when your choices change'));
  }
  if (state.job) options.push(option('cancel_job', 'Cancel your accepted job', 'No payment for unfinished work'));
  options.push(option('close', 'Step away'));
  return { title: place.name, subtitle: 'Counter • ' + formatTime(state.time), body, options };
}
function eventInteraction(state, event) {
  if (!event || !['open', 'accepted'].includes(event.stage)) return { title: 'A passing moment', body: 'Somebody has already dealt with it.', options: [option('close', 'Keep going')] };
  event.known = true;
  const npc = npcById(state, event.npcId);
  const descriptions = {
    dropped_wallet: [`${npc.name} dropped a wallet`, 'A bus pass, a family photograph and ₹25. The photograph has been folded and unfolded for years.', [option('event_return', 'Return it to its owner', 'They remember the help'), option('event_keep', 'Keep the money', 'Theft if witnessed'), option('close', 'Leave it where it is')]],
    injury: [`${npc.name} needs help`, 'A hand caught on a loose metal shutter. They are trying to make it look less painful than it is.', [option('event_medkit', 'Use a first aid kit', 'A real cost, a real favour', state.player.inventory.medkit < 1), option('event_call', 'Call the clinic', 'Help arrives without using an item'), option('event_rob', 'Take the loose wage envelope', 'A harmful choice people can witness'), option('close', 'Keep walking')]],
    friend_favor: ['A small promise', event.collected ? 'You have Nikhil’s packet of screws. Hand them over before he starts his shift.' : 'Nikhil needs a packet of screws from the shop. He promises this is the last “quick favour”, which you have both heard before.', [option(event.collected ? 'event_finish_favor' : 'event_accept_favor', event.collected ? 'Hand over the screws' : event.accepted ? 'Keep the promise in mind' : 'Promise to collect them', 'A named commitment with a deadline', event.accepted && !event.collected), option('close', event.accepted ? 'I will be back' : 'I cannot promise today')]],
    restock: ['A stock shortage', 'A shop delivery has gone astray. Helping with a quick stock count would get things moving again.', [option('event_restock', 'Help count the remaining stock', '+₹18 • advances 15 game minutes'), option('close', 'Maybe another time')]],
    wage_dispute: ['An unpaid wage', 'Kavya’s dispatch slip says PAID. Her bank account has a less imaginative opinion. She kept a copy of the manifest.', [option('event_wage', 'Read the slip and help file a claim', 'Useful evidence and a grateful courier'), option('event_pay', 'Cover the missing ₹25 yourself', 'A personal favour', state.player.cash < 25), option('close', 'Leave the argument alone')]],
    lost_bag: ['An unattended bag', 'A tool bag sits beside the pavement. The name on the inside tag should help you find its owner.', [option('event_return_bag', 'Find its owner and return it', 'A repair contact remembers'), option('event_keep', 'Sell the contents for ₹30', 'Theft if witnessed'), option('close', 'Leave it alone')]]
  };
  const [title, body, options] = descriptions[event.type];
  return { title, subtitle: event.accepted ? 'You made a promise' : 'A local situation', body, options };
}

function formatTime(minutes) {
  const value = Math.floor(minutes) % 1440;
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function changeTime(state, minutes) {
  state.time += minutes;
  while (state.time >= 1440) { state.time -= 1440; state.day++; }
}
function buy(state, key, cost, amount = 1) {
  const limit = { snack: 20, medkit: 10, pistol: 1, ammo: 200 }[key] || 100;
  if (state.player.cash < cost || state.player.inventory[key] + amount > limit) return false;
  state.player.cash -= cost;
  state.player.inventory[key] += amount;
  log(state, `Bought ${amount} ${key}${amount > 1 ? 's' : ''} for ₹${cost}.`);
  pushMessage(state, `${key === 'ammo' ? amount + ' rounds' : key} added • −₹${cost}`, 'good');
  return true;
}
function setQuote(state, npc, text) {
  npc.lastQuote = text;
  pushMessage(state, `${npc.name}: ${text}`, 'info');
  state.dirty = true;
  return { close: false, text };
}
function resolveEvent(state, event, text, trust = 0, honor = 0, recordMemory = true) {
  if (!event || !['open', 'accepted'].includes(event.stage)) return;
  event.stage = 'resolved';
  state.eventHistory.push({ id: event.id, type: event.type, time: state.elapsed, outcome: text });
  state.eventHistory.length = Math.min(50, state.eventHistory.length);
  state.stats.helped += honor > 0 ? 1 : 0;
  state.player.honor = clamp(state.player.honor + honor, -100, 100);
  if (recordMemory) remember(state, npcById(state, event.npcId), event.id, text, trust);
  log(state, text);
  pushMessage(state, text, honor < 0 ? 'warn' : 'good');
}

export function act(state, actionId, targetId = null) {
  const player = state.player;
  if (actionId === 'close') return { close: true };
  if (actionId === 'use_medkit' || actionId === 'use_snack') {
    const item = actionId === 'use_medkit' ? 'medkit' : 'snack';
    if (player.inventory[item] < 1 || (player.hp >= player.maxHp && (item !== 'snack' || player.stamina >= 100))) {
      pushMessage(state, player.inventory[item] < 1 ? `You have no ${item}.` : 'You do not need that yet.', 'muted');
      return { close: false };
    }
    player.inventory[item]--;
    player.hp = Math.min(player.maxHp, player.hp + (item === 'medkit' ? 45 : 12));
    if (item === 'snack') player.stamina = 100;
    log(state, item === 'medkit' ? 'Used a first aid kit.' : 'Ate a snack and caught your breath.');
    pushMessage(state, item === 'medkit' ? 'First aid • +45 health' : 'Snack • +12 health and restored stamina', 'good');
    return { close: false };
  }
  if (actionId === 'equip') {
    if (!player.inventory.pistol) { pushMessage(state, 'You do not own a weapon. Unarmed defence is available.', 'muted'); return { close: false }; }
    player.equipped = !player.equipped;
    pushMessage(state, player.equipped ? 'Pistol equipped. Aim carefully. Bystanders can witness violence.' : 'Pistol holstered.', 'info');
    state.dirty = true;
    return { close: false };
  }
  if (actionId === 'reload') {
    if (!player.inventory.pistol || player.inventory.ammo <= 0) pushMessage(state, 'You need a pistol and spare rounds to reload.', 'muted');
    else if (player.reloadingUntil > state.elapsed) pushMessage(state, 'Already reloading.', 'muted');
    else if (player.magazine >= Math.min(6, player.inventory.ammo)) pushMessage(state, 'The magazine is full.', 'muted');
    else { player.reloadingUntil = state.elapsed + 1.1; pushMessage(state, 'Reloading • one second', 'info'); }
    return { close: false };
  }
  if (actionId === 'dismiss_companion') {
    const oldCompanion = npcById(state, player.companionId);
    if (oldCompanion) oldCompanion.passengerOf = null;
    player.companionId = null;
    state.hangout = null;
    pushMessage(state, 'You part ways for now.', 'info');
    return { close: true };
  }
  if (actionId === 'honk') { player.honkAt = -100; pushMessage(state, 'A brief horn. Several people look up.', 'muted'); return { close: true }; }
  if (actionId === 'surrender' && !targetId) {
    if (player.heat <= 0 && player.investigation <= 0) { pushMessage(state, 'There is no active case to settle.', 'muted'); return { close: false }; }
    arrest(state);
    return { close: true };
  }
  const candidates = nearby(state).filter(target => target.id === targetId);
  let target = candidates.find(item => interaction(state, item).options.some(option => option.id === actionId && !option.disabled));
  if (!target) {
    pushMessage(state, 'That action is no longer available here.', 'warn');
    return { close: true };
  }
  const place = byId(state, targetId);
  const npc = npcById(state, targetId);
  const event = state.events.find(item => item.id === targetId);
  switch (actionId) {
    case 'enter':
      if (!place || !isOpen(state, place) || player.vehicleId) return { close: true };
      player.interior = place.id;
      Object.assign(player, place.room.entry);
      player.moving = false;
      pushMessage(state, 'Entered ' + place.name, 'muted');
      break;
    case 'exit':
      player.interior = null;
      Object.assign(player, place.door);
      player.y += 24;
      player.moving = false;
      pushMessage(state, 'Back outside ' + place.name, 'muted');
      break;
    case 'vehicle_enter': {
      const vehicle = state.vehicles.find(item => item.id === targetId);
      if (vehicle.health <= 0) { pushMessage(state, 'The car needs a repair before it can run.', 'warn'); break; }
      if (vehicle.ownerId !== 'player' && !vehicle.stolen) {
        vehicle.stolen = true;
        crime(state, 'vehicle theft', 2, vehicle.ownerId);
      }
      player.vehicleId = vehicle.id;
      Object.assign(player, { x: vehicle.x, y: vehicle.y, interior: null });
      vehicle.parked = false;
      pushMessage(state, 'W/S drive • A/D steer • Space brake • E get out', 'info');
      break;
    }
    case 'vehicle_exit': exitVehicle(state); break;
    case 'sleep':
      if (player.heat > 0) { pushMessage(state, 'You cannot sleep through an active pursuit.', 'warn'); break; }
      if (state.job) cancelJob(state, 'You rested through an accepted job. No wages were paid.');
      for (const commitment of state.events) {
        if (commitment.accepted && commitment.stage === 'accepted') {
          remember(state, npcById(state, commitment.npcId), commitment.id + '-missed', 'You slept through a promise to help.', -5);
          commitment.stage = 'expired';
        }
      }
      state.day++;
      state.time = 480;
      player.hp = player.maxHp;
      player.stamina = 100;
      player.companionId = null;
      state.hangout = null;
      state.player.cash = Math.max(0, state.player.cash - Math.min(8, state.player.cash));
      log(state, 'Slept until morning. A small day-to-day living cost was paid. The block wakes up again.');
      pushMessage(state, 'A new morning • health and stamina restored', 'good');
      break;
    case 'home_history':
      log(state, 'An old photograph. A classroom fan, two kids holding a screwdriver, Nikhil trying to look as if he knows what he is doing. You remember more than you feel like explaining today.');
      pushMessage(state, 'Your history is in the journal.', 'story');
      break;
    case 'home_supplies':
      if (!state.worldChanges.homeSupplies) { state.worldChanges.homeSupplies = true; player.inventory.snack++; pushMessage(state, 'One emergency snack. The label says BEST BEFORE YOUR LAST JOB.', 'good'); }
      break;
    case 'steal_stash':
      if (!state.worldChanges[targetId + '-stash']) {
        state.worldChanges[targetId + '-stash'] = true;
        player.cash += 35;
        crime(state, 'theft from a home', 2, state.npcs.find(item => item.homeId === targetId)?.id);
        log(state, 'Took ₹35 from a private cupboard. The missing envelope will be noticed.');
      } else pushMessage(state, 'The cupboard is empty.', 'muted');
      break;
    case 'legal_delivery': startJob(state, 'delivery', place); break;
    case 'office_shift': case 'cafe_shift': case 'garage_shift': case 'shop_help': startJob(state, 'shift', place); break;
    case 'complete_delivery': completeJob(state); break;
    case 'cancel_job': cancelJob(state, 'Cancelled the accepted job before payment.'); break;
    case 'accept_parcel':
      state.story.accepted = true;
      state.story.parcel = true;
      state.story.phase = 1;
      log(state, 'Accepted a special clinic delivery. Dev called it routine stock. You have not knowingly agreed to theft. You can inspect, return, or hand it over.');
      pushMessage(state, 'Parcel collected. The clinic is marked on your map. You can inspect it at the depot.', 'story');
      break;
    case 'decline_parcel':
      state.story.declined = true;
      state.story.phase = 1;
      log(state, 'Refused Dev’s special parcel. Ordinary deliveries and shifts remain available. Rent arrears can be cleared with earned money.');
      pushMessage(state, 'You declined. Your time is still yours.', 'good');
      break;
    case 'inspect_parcel':
      state.story.parcelInspected = true;
      state.story.phase = 2;
      clue(state, 'parcel', 'The supposedly new stock carries a clinic property stamp and a scraped-off serial number. Someone is billing the clinic for its own supplies.');
      break;
    case 'inspect_manifest':
      clue(state, 'manifest', 'The depot manifest lists the same clinic supplies twice, under different drivers. Dev signed both entries.');
      state.story.phase = Math.max(2, state.story.phase);
      break;
    case 'return_parcel':
      state.story.parcel = false;
      state.story.declined = true;
      state.story.phase = 2;
      remember(state, state.npcs[5], 'parcel-return', 'You returned the parcel and refused to carry it further.', -4);
      log(state, 'Returned the parcel. Dev says you are making a simple job complicated. Legal work, records, and the clinic offer other routes forward.');
      pushMessage(state, 'Parcel returned. You can investigate or earn your way clear.', 'story');
      break;
    case 'deliver_parcel':
      if (state.story.parcel) {
        state.story.parcel = false;
        state.story.delivered = true;
        state.story.phase = 2;
        if (state.story.parcelInspected) {
          player.honor = clamp(player.honor + 10, -100, 100);
          remember(state, state.npcs[4], 'returned-supplies', 'You returned the clinic’s missing supplies.', 14);
          clue(state, 'clinic', 'Sana confirmed the supplies were already clinic property. The copied invoice can support a report.');
          log(state, 'Returned the supplies to the clinic. Dev’s promised fee never arrives.');
        } else {
          player.cash += 110;
          clue(state, 'clinic', 'The nurse recognises the delivered supplies as the clinic’s own missing stock. You now know Dev misrepresented the job.');
          log(state, 'Completed the first parcel delivery before learning it was a scam. Paid ₹110. Future work from Varun would be a knowing choice.');
        }
      }
      break;
    case 'illegal_delivery':
      if (!state.job) {
        state.story.phase = 2;
        startJob(state, 'illicit', place);
        log(state, 'Accepted a knowingly illicit consignment. Deliver it to collect the promised payment.');
      }
      break;
    case 'settle_debt':
      if (!state.story.resolved && player.cash >= state.story.debt) {
        player.cash -= state.story.debt;
        finishStory(state, 'independent');
      }
      break;
    case 'join_partner':
      if (state.story.illegalRuns >= 3) finishStory(state, 'partner');
      break;
    case 'report_story':
      if (state.story.clues.length >= 2 && !state.story.resolved) {
        finishStory(state, 'evidence');
        player.cash += 80;
        player.investigation = Math.max(0, player.investigation - 25);
        remember(state, state.npcs[10], 'story-report', 'You brought a useful paper trail about the depot.', 15);
        log(state, 'Received an ₹80 witness-expense payment. Unrelated incidents still have their own case records.');
      }
      break;
    case 'clinic_records': clue(state, 'clinic', 'The clinic’s public inventory lists a missing batch matching the depot consignment. A police report needs another source.'); break;
    case 'buy_snack': buy(state, 'snack', 8); break;
    case 'buy_medkit': buy(state, 'medkit', 28); break;
    case 'buy_ammo': buy(state, 'ammo', 24, 12); break;
    case 'buy_pistol': if (buy(state, 'pistol', 145)) { player.equipped = false; player.inventory.ammo += 6; player.magazine = 6; } break;
    case 'sell_snack':
      if (player.inventory.snack > 0) { player.inventory.snack--; player.cash += 4; log(state, 'Sold a spare snack for ₹4.'); pushMessage(state, '+₹4', 'good'); }
      break;
    case 'tea':
      if (player.cash >= 12) { player.cash -= 12; player.hp = Math.min(100, player.hp + 22); player.stamina = 100; log(state, 'Had a hot meal at the cafe.'); pushMessage(state, 'Warm food • +22 health', 'good'); }
      break;
    case 'treatment':
      if (player.cash >= 20) { player.cash -= 20; player.hp = 100; log(state, 'Paid ₹20 for full clinic treatment.'); }
      else { player.hp = Math.max(player.hp, 50); log(state, 'Received free basic triage.'); }
      pushMessage(state, 'The nurse asks you to keep the bandage dry.', 'good');
      break;
    case 'repair_car': {
      const car = state.vehicles.find(item => item.ownerId === 'player');
      if (car && player.cash >= 25) { player.cash -= 25; car.health = 100; car.fuel = 100; Object.assign(car, { x: place.door.x + 62, y: place.door.y + 35, speed: 0 }); log(state, 'Paid ₹25. Rafi recovered, repaired and refuelled your car.'); pushMessage(state, 'Your car is ready outside.', 'good'); }
      break;
    }
    case 'surrender': if (player.heat > 0 || player.investigation > 0) arrest(state); else pushMessage(state, 'There is no active case against you.', 'muted'); break;
    case 'talk':
      npc.introduced = true;
      if (npc.relation === 'stranger') npc.relation = 'neighbour';
      if (state.elapsed - npc.lastTalk > 65) {
        npc.lastTalk = state.elapsed;
        npc.trust = clamp(npc.trust + 3, -100, 100);
      }
      if (npc.role === 'friend') {
        remember(state, npc, 'welcome', 'You came home and made time to talk.', 0);
        return setQuote(state, npc, 'You can take a wrong turn without moving there permanently. Start with one paid shift. Eat something. Then decide whose advice costs too much.');
      }
      return setQuote(state, npc, npc.trust < -15 ? 'I heard the apology. I need to see what happens next.' : `I’m ${npc.task}. ${['Rent is due even on the days nothing interesting happens.', 'The cafe is still open. That counts as good news.', 'A little ordinary work beats an exciting explanation to the police.', 'I hope tomorrow is boring in a useful way.'][Number(npc.id.slice(4)) % 4]}`);
    case 'history':
      if (npc.trust >= 18) {
        if (!npc.disclosures.includes('past')) { npc.disclosures.push('past'); log(state, `${npc.name} told you privately: ${npc.backstory}`); }
        return setQuote(state, npc, npc.backstory);
      }
      return setQuote(state, npc, 'Maybe another time. We have only just started talking.');
    case 'share_past': {
      const facts = [
        'I came home after the firm folded. I told people I wanted a break. The truth is I could not afford the next month away.',
        'I was training as an electrician. The firm collapsed before my final assessment. I kept the tools, but they never signed the qualification.',
        'I was scared people here would only see the person who came back empty-handed. I want to build a life that I can explain without pretending.'
      ];
      const next = npc.sharedPast.length;
      if (next < facts.length) {
        npc.sharedPast.push(next);
        npc.lastDisclosure = state.elapsed;
        remember(state, npc, `shared-past-${next}`, ['You trusted them with the reason you came home.', 'You told them what happened to your training.', 'You shared the fear you had kept to yourself.'][next], 4);
        log(state, `Told ${npc.name} privately: “${facts[next]}”`);
        return setQuote(state, npc, ['Thanks for telling me. Coming back took something too.', 'That was the firm failing you. It does not erase what you learned.', 'You do not need a better story to deserve another chance. I am glad you told me.'][next]);
      }
      break;
    }
    case 'friend_advice':
      if (!npc.memories.some(item => item.key === 'delivery-advice')) {
        remember(state, npc, 'delivery-advice', 'You asked for advice about the depot.', 0);
        log(state, 'Nikhil suggests checking clinic records and the depot manifest. Advice is a lead, rather than evidence.');
      }
      return setQuote(state, npc, 'Get the facts before you get the blame. The clinic keeps records. So does the depot, although theirs are more creative.');
    case 'ask_delivery':
      clue(state, 'witness', `${npc.name} confirms that clinic consignments have returned to the depot under new invoices. The drivers were told they were ordinary deliveries.`);
      return setQuote(state, npc, 'The same boxes came through twice. Different invoice, same clinic stamp. I kept wondering who was paying for the second trip.');
    case 'hangout':
      state.player.companionId = npc.id;
      state.hangout = { npcId: npc.id, progress: 0, started: state.elapsed };
      npc.scheduleAt = state.elapsed;
      log(state, `Agreed to spend some actual time with ${npc.name}. Walk nearby for a while.`);
      pushMessage(state, `${npc.name} will walk with you. Company takes a little time.`, 'good');
      break;
    case 'invite':
      if (player.companionId === npc.id) { player.companionId = null; state.hangout = null; return setQuote(state, npc, 'See you around. Take care of yourself.'); }
      player.companionId = npc.id;
      npc.scheduleAt = state.elapsed;
      return setQuote(state, npc, 'I have a little time. Let’s walk.');
    case 'gift':
      if (player.inventory.snack > 0 && state.elapsed - npc.lastGift >= 300) {
        player.inventory.snack--;
        npc.lastGift = state.elapsed;
        remember(state, npc, `gift-${state.day}`, 'You shared a snack when you could have kept it.', 5);
        return setQuote(state, npc, 'Thanks. I forgot lunch again.');
      }
      break;
    case 'apologize':
      remember(state, npc, 'apology', 'You acknowledged the harm. Trust will take useful actions to rebuild.', 4);
      return setQuote(state, npc, 'I appreciate you saying it. Let’s see how things go.');
    case 'romance':
      if (npc.romantic) return setQuote(state, npc, 'I like what we have. Keep making time for it.');
      if (!npc.romanceAsked) {
        npc.romanceAsked = true;
        npc.romantic = npc.trust >= 55 && player.honor >= 0 && npc.memories.some(item => item.key.startsWith('hangout'));
        npc.relation = npc.romantic ? 'dating' : 'friend';
        log(state, npc.romantic ? 'Kavya accepted a date. It is a relationship to keep making time for.' : 'Kavya said she would prefer to stay friends. You respected her answer.');
      }
      return setQuote(state, npc, npc.romantic ? 'Yes. A real date. Somewhere without dispatch slips.' : 'I like talking with you. I would rather keep this as a friendship.');
    case 'event_return': case 'event_return_bag':
      event.accepted = true;
      event.collected = true;
      event.stage = 'accepted';
      event.expires = state.elapsed + 300;
      log(state, `Picked up the ${event.type === 'lost_bag' ? 'tool bag' : 'wallet'} to return to ${npcById(state, event.npcId).name}. Find them in person.`);
      pushMessage(state, 'Found item collected. Its owner is marked on your map.', 'story');
      break;
    case 'return_found': {
      const found = state.events.find(item => item.npcId === targetId && item.stage === 'accepted' && item.collected && ['dropped_wallet', 'lost_bag'].includes(item.type));
      if (found) {
        resolveEvent(state, found, `You returned ${npc.name}’s ${found.type === 'lost_bag' ? 'tool bag' : 'wallet'} in person.`, 12, 5);
        if (found.type === 'lost_bag') { state.eventQueue.push({ type: 'restock', npcId: 'npc-2', reason: 'The returned parts made another small repair possible. The shopkeeper could use a hand with stock.' }); }
      }
      break;
    }
    case 'event_keep': {
      player.cash += event.type === 'lost_bag' ? 30 : 25;
      const report = crime(state, 'theft', 2, event.ownerId);
      const ownerKnows = report.witnesses.some(witness => witness.id === event.ownerId && witness.identified);
      resolveEvent(state, event, 'You kept the missing property’s money. Its owner has a harder afternoon.', ownerKnows ? -9 : 0, -4, ownerKnows);
      break;
    }
    case 'event_medkit':
      if (player.inventory.medkit > 0) { player.inventory.medkit--; npcById(state, event.npcId).hp = 80; resolveEvent(state, event, 'You used your first aid kit to help an injured neighbour.', 15, 7); }
      break;
    case 'event_call':
      npcById(state, event.npcId).hp = 65;
      resolveEvent(state, event, 'You called the clinic and stayed until help was arranged.', 8, 4);
      break;
    case 'event_rob': {
      player.cash += 35;
      const report = crime(state, 'robbing an injured person', 3, event.npcId);
      resolveEvent(state, event, 'You took the injured worker’s wage envelope.', report.witnesses.some(witness => witness.id === event.npcId && witness.identified) ? -25 : 0, -12);
      break;
    }
    case 'event_accept_favor':
      event.accepted = true;
      event.stage = 'accepted';
      log(state, 'Promised Nikhil you would collect his screws from the shop. Return before the promise expires.');
      pushMessage(state, 'Promise accepted. The shop is marked on your map.', 'story');
      break;
    case 'collect_favor': {
      const favor = state.events.find(item => item.type === 'friend_favor' && item.stage === 'accepted' && item.targetId === targetId);
      if (favor) { favor.collected = true; log(state, 'Collected Nikhil’s screws. Take them back to him.'); pushMessage(state, 'Screws collected. Find Nikhil.', 'good'); }
      break;
    }
    case 'event_finish_favor': resolveEvent(state, event, 'You kept your promise and brought Nikhil’s screws before his shift.', 12, 5); player.cash += 12; break;
    case 'event_restock': changeTime(state, 15); player.cash += 18; resolveEvent(state, event, 'You helped with the stock count. The shop can reopen its delivery counter.', 7, 3); break;
    case 'event_wage':
      clue(state, 'wage-slip', 'Kavya’s unpaid slip names the same clinic batch as the depot manifest. She kept a signed copy.');
      resolveEvent(state, event, 'You helped Kavya file a claim for her missing wages.', 10, 5);
      break;
    case 'event_pay': if (player.cash >= 25) { player.cash -= 25; resolveEvent(state, event, 'You covered Kavya’s missing wages without asking for a favour in return.', 14, 5); } break;
    default: pushMessage(state, 'That action is unavailable.', 'muted'); return { close: false };
  }
  state.dirty = true;
  return { close: true };
}

export function objective(state) {
  const player = state.player;
  const finish = (text, target = null) => ({ text, target });
  if (player.heat > 0) return finish('Pursuit • break police line of sight, or surrender to resolve the case.', building(state, 'police').door);
  if (state.job) {
    const place = byId(state, state.job.kind === 'shift' ? state.job.fromId : state.job.toId);
    const point = player.interior === place.id ? { ...place.room.spots.counter, interior: place.id } : { ...place.door, interior: null };
    return finish(state.job.kind === 'shift' ? `Paid shift • stay inside ${place.name} (${Math.ceil(state.job.duration - state.job.progress)}s).` : `Work • deliver ${state.job.kind === 'illicit' ? 'illicit supplies' : 'ordinary stock'} to ${place.name}.`, point);
  }
  const found = state.events.find(item => item.accepted && item.stage === 'accepted' && item.collected && ['dropped_wallet', 'lost_bag'].includes(item.type));
  if (found) {
    const owner = npcById(state, found.npcId);
    return finish(`Found property • return the ${found.type === 'lost_bag' ? 'tool bag' : 'wallet'} to ${owner.name}.`, { x: owner.x, y: owner.y, interior: owner.interior });
  }
  const promise = state.events.find(item => item.type === 'friend_favor' && item.accepted && item.stage === 'accepted');
  if (promise) {
    const person = npcById(state, promise.npcId);
    const place = byId(state, promise.targetId);
    if (promise.collected) return finish(`Promise • bring the screws back to ${person.name}.`, { x: person.x, y: person.y, interior: person.interior });
    return finish(`Promise • collect Nikhil’s screws from ${place.name}.`, player.interior === place.id ? { ...place.room.spots.counter, interior: place.id } : place.door);
  }
  if (state.story.resolved) return finish('Free play • work, explore, build relationships and keep making a life.');
  if (state.story.phase === 0) {
    const friend = state.npcs[0];
    return finish('Welcome home • talk to Nikhil, or investigate the depot’s delivery offer.', { x: friend.x, y: friend.y, interior: friend.interior });
  }
  if (state.story.parcel) {
    const place = building(state, 'clinic');
    return finish('The parcel • inspect or return it at the depot, or ask the clinic about the consignment.', player.interior === place.id ? { ...place.room.spots.counter, interior: place.id } : place.door);
  }
  if (state.story.clues.length >= 2) {
    const place = building(state, 'police');
    return finish('Your next move • report the evidence, clear ₹240 arrears through work, or accept Varun’s terms.', player.interior === place.id ? { ...place.room.spots.counter, interior: place.id } : place.door);
  }
  return finish('A way forward • inspect depot records, speak to a courier, or earn enough to clear ₹240 arrears.', building(state, 'depot').door);
}

export function toSave(state) {
  const { world, effects, messages, dirty, recoveryNotice, endingNotice, ...persistent } = state;
  return JSON.parse(JSON.stringify({ ...persistent, version: VERSION, npcs: state.npcs.map(({ path, ...npc }) => ({ ...npc, path: [] })) }));
}

export function fromSave(data) {
  if (!data || typeof data !== 'object' || data.version !== VERSION || !['string', 'number'].includes(typeof data.seed)) throw new Error('This save is not compatible with this game.');
  const state = createGame(String(data.seed).slice(0, 120));
  const safeNumber = (value, fallback, low, high) => clamp(finite(value, fallback), low, high);
  state.elapsed = safeNumber(data.elapsed, 0, 0, 1e8);
  state.time = safeNumber(data.time, 480, 0, 1439.999);
  state.day = Math.floor(safeNumber(data.day, 1, 1, 1e6));
  state.sequence = Math.floor(safeNumber(data.sequence, 0, 0, 1e9));
  state.rngState = finite(data.rngState, state.rngState) >>> 0;
  const savedPlayer = data.player || {};
  const validInterior = id => typeof id === 'string' && byId(state, id) ? id : null;
  const player = state.player;
  player.interior = validInterior(savedPlayer.interior);
  const area = player.interior ? byId(state, player.interior).room : state.world;
  player.x = safeNumber(savedPlayer.x, player.x, player.interior ? 38 : 72, area.width - (player.interior ? 38 : 72));
  player.y = safeNumber(savedPlayer.y, player.y, player.interior ? 48 : 72, area.height - (player.interior ? 32 : 72));
  for (const [key, low, high] of [['hp', 1, 100], ['cash', 0, 1e7], ['stamina', 0, 100], ['honor', -100, 100], ['heat', 0, 100], ['investigation', 0, 100], ['angle', -1e4, 1e4]]) player[key] = safeNumber(savedPlayer[key], player[key], low, high);
  player.identified = Boolean(savedPlayer.identified);
  player.equipped = Boolean(savedPlayer.equipped);
  player.magazine = Math.floor(safeNumber(savedPlayer.magazine, Math.min(6, finite(savedPlayer.inventory?.ammo)), 0, 6));
  player.reloadingUntil = 0;
  player.lastCrime = safeNumber(savedPlayer.lastCrime, -1000, -1000, state.elapsed);
  player.lastSeen = savedPlayer.lastSeen && Number.isFinite(savedPlayer.lastSeen.x) && Number.isFinite(savedPlayer.lastSeen.y) ? { x: clamp(savedPlayer.lastSeen.x, 0, state.world.width), y: clamp(savedPlayer.lastSeen.y, 0, state.world.height), interior: validInterior(savedPlayer.lastSeen.interior), time: safeNumber(savedPlayer.lastSeen.time, 0, 0, state.elapsed) } : null;
  for (const [key, max] of [['medkit', 10], ['snack', 20], ['ammo', 200], ['pistol', 1]]) player.inventory[key] = Math.floor(safeNumber(savedPlayer.inventory?.[key], player.inventory[key], 0, max));
  player.magazine = Math.min(player.magazine, player.inventory.ammo);
  const strings = (value, max = 20) => Array.isArray(value) ? value.filter(item => typeof item === 'string').map(item => item.slice(0, 500)).slice(0, max) : [];
  if (Array.isArray(data.npcs)) {
    for (const npc of state.npcs) {
      const saved = data.npcs.find(item => item?.id === npc.id);
      if (!saved) continue;
      npc.interior = validInterior(saved.interior);
      const room = npc.interior ? byId(state, npc.interior).room : state.world;
      npc.x = safeNumber(saved.x, npc.x, 38, room.width - 38);
      npc.y = safeNumber(saved.y, npc.y, 48, room.height - 32);
      npc.hp = safeNumber(saved.hp, 100, 0, 100);
      npc.trust = safeNumber(saved.trust, 0, -100, 100);
      npc.recoveryAt = safeNumber(saved.recoveryAt, state.elapsed + 25, 0, state.elapsed + 120);
      npc.disclosures = strings(saved.disclosures, 10);
      npc.sharedPast = Array.isArray(saved.sharedPast) ? [...new Set(saved.sharedPast.filter(n => Number.isInteger(n) && n >= 0 && n < 3))] : [];
      npc.lastDisclosure = safeNumber(saved.lastDisclosure, -1000, -1000, state.elapsed);
      npc.memories = Array.isArray(saved.memories) ? saved.memories.filter(item => typeof item?.key === 'string' && typeof item.text === 'string').slice(0, 18).map(item => ({ key: item.key.slice(0, 100), text: item.text.slice(0, 600), day: safeNumber(item.day, 1, 1, 1e6), time: safeNumber(item.time, 480, 0, 1440) })) : [];
      for (const key of ['lastTalk', 'hangoutAt', 'lastGift', 'scheduleAt', 'panicUntil']) npc[key] = safeNumber(saved[key], npc[key], -1000, state.elapsed + 300);
      npc.introduced = Boolean(saved.introduced);
      npc.romantic = Boolean(saved.romantic);
      npc.romanceAsked = Boolean(saved.romanceAsked);
      npc.relation = npc.romantic ? 'dating' : npc.introduced ? (saved.relation === 'old friend' ? 'old friend' : 'neighbour') : 'stranger';
      npc.cash = safeNumber(saved.cash, npc.cash, 0, 1e7);
      npc.needs = { energy: safeNumber(saved.needs?.energy, 100, 0, 100), hunger: safeNumber(saved.needs?.hunger, 20, 0, 100) };
      npc.wageDay = safeNumber(saved.wageDay, 0, 0, state.day);
      npc.mealDay = safeNumber(saved.mealDay, 0, 0, state.day);
      npc.path = [];
    }
  }
  if (Array.isArray(data.vehicles)) {
    for (const vehicle of state.vehicles) {
      const saved = data.vehicles.find(item => item?.id === vehicle.id);
      if (!saved) continue;
      for (const [key, low, high] of [['x', 75, state.world.width - 75], ['y', 75, state.world.height - 75], ['angle', -1e4, 1e4], ['health', 0, 100], ['fuel', 0, 100]]) vehicle[key] = safeNumber(saved[key], vehicle[key], low, high);
      vehicle.stolen = Boolean(saved.stolen);
      vehicle.speed = 0;
    }
  }
  player.vehicleId = state.vehicles.some(vehicle => vehicle.id === savedPlayer.vehicleId && vehicle.health > 0) && !player.interior ? savedPlayer.vehicleId : null;
  player.companionId = state.npcs.some(npc => npc.id === savedPlayer.companionId && npc.trust >= 5 && npc.hp > 0) ? savedPlayer.companionId : null;
  if (player.vehicleId) Object.assign(player, { x: state.vehicles.find(item => item.id === player.vehicleId).x, y: state.vehicles.find(item => item.id === player.vehicleId).y });
  if (data.story && typeof data.story === 'object') {
    const saved = data.story;
    const story = state.story;
    for (const key of ['resolved', 'parcel', 'parcelInspected', 'accepted', 'declined', 'delivered', 'employerWarned']) story[key] = Boolean(saved[key]);
    story.phase = Math.floor(safeNumber(saved.phase, 0, 0, 3));
    story.debt = safeNumber(saved.debt, 240, 0, 240);
    story.illegalRuns = Math.floor(safeNumber(saved.illegalRuns, 0, 0, 999));
    story.clues = [...new Set(strings(saved.clues, 10))];
    story.ending = ['evidence', 'independent', 'partner'].includes(saved.ending) ? saved.ending : null;
    if (story.resolved && !story.ending) { story.resolved = false; story.phase = 2; }
    if (story.resolved) story.phase = 3;
  }
  if (Array.isArray(data.events)) state.events = data.events.filter(event => event && typeof event.id === 'string' && ['dropped_wallet', 'injury', 'friend_favor', 'restock', 'wage_dispute', 'lost_bag'].includes(event.type) && npcById(state, event.npcId)).slice(-30).map(event => ({ id: event.id.slice(0, 80), type: event.type, x: safeNumber(event.x, 320, 0, state.world.width), y: safeNumber(event.y, 400, 0, state.world.height), interior: validInterior(event.interior), npcId: event.npcId, ownerId: event.npcId, targetId: byId(state, event.targetId)?.id || building(state, 'shop').id, stage: ['open', 'accepted', 'resolved', 'expired'].includes(event.stage) ? event.stage : 'expired', expires: safeNumber(event.expires, state.elapsed + 30, 0, state.elapsed + 600), accepted: Boolean(event.accepted), collected: Boolean(event.collected), known: Boolean(event.known) }));
  if (data.job && ['shift', 'delivery', 'illicit'].includes(data.job.kind) && byId(state, data.job.fromId) && byId(state, data.job.toId)) {
    state.job = { id: String(data.job.id).slice(0, 80), kind: data.job.kind, fromId: data.job.fromId, toId: data.job.toId, reward: data.job.kind === 'shift' ? 48 : data.job.kind === 'illicit' ? 95 : 65, accepted: safeNumber(data.job.accepted, state.elapsed, 0, state.elapsed), deadline: safeNumber(data.job.deadline, state.elapsed + 60, 0, state.elapsed + 300), duration: 22, progress: safeNumber(data.job.progress, 0, 0, 22), description: String(data.job.description || 'Accepted work').slice(0, 300) };
  }
  if (data.hangout && npcById(state, data.hangout.npcId) && player.companionId === data.hangout.npcId) state.hangout = { npcId: data.hangout.npcId, progress: safeNumber(data.hangout.progress, 0, 0, 24), started: state.elapsed };
  state.eventQueue = Array.isArray(data.eventQueue) ? data.eventQueue.filter(item => item?.type === 'restock' && npcById(state, item.npcId)).slice(0, 5).map(item => ({ type: item.type, npcId: item.npcId, reason: String(item.reason || '').slice(0, 200) })) : [];
  state.eventCooldowns = {};
  for (const type of ['dropped_wallet', 'injury', 'friend_favor', 'restock', 'wage_dispute', 'lost_bag']) state.eventCooldowns[type] = safeNumber(data.eventCooldowns?.[type], -1000, -1000, state.elapsed);
  state.eventIndex = Math.floor(safeNumber(data.eventIndex, 0, 0, 1e6));
  state.eventCooldown = safeNumber(data.eventCooldown, 30, 1, 100);
  state.eventHistory = Array.isArray(data.eventHistory) ? data.eventHistory.filter(item => typeof item?.outcome === 'string').slice(-50).map(item => ({ id: String(item.id).slice(0, 80), type: String(item.type).slice(0, 40), time: safeNumber(item.time, 0, 0, state.elapsed), outcome: item.outcome.slice(0, 500) })) : [];
  state.journal = Array.isArray(data.journal) ? data.journal.filter(item => typeof item?.text === 'string').slice(0, 100).map(item => ({ text: item.text.slice(0, 1000), day: safeNumber(item.day, 1, 1, 1e6), time: safeNumber(item.time, 480, 0, 1440) })) : state.journal;
  state.cases = Array.isArray(data.cases) ? data.cases.filter(item => typeof item?.id === 'string' && typeof item.type === 'string').slice(-50).map(item => ({ id: item.id.slice(0, 80), type: item.type.slice(0, 120), severity: safeNumber(item.severity, 1, 1, 5), x: safeNumber(item.x, player.x, 0, state.world.width), y: safeNumber(item.y, player.y, 0, state.world.height), interior: validInterior(item.interior), time: safeNumber(item.time, 0, 0, state.elapsed), day: safeNumber(item.day, 1, 1, state.day), witnesses: Array.isArray(item.witnesses) ? item.witnesses.filter(w => npcById(state, w.id)).map(w => ({ id: w.id, identified: Boolean(w.identified) })) : [], identified: Boolean(item.identified), resolved: Boolean(item.resolved) })) : [];
  if (data.worldChanges && typeof data.worldChanges === 'object' && !Array.isArray(data.worldChanges)) {
    for (const [key, value] of Object.entries(data.worldChanges).slice(0, 100)) if (key === 'homeSupplies' || state.world.buildings.some(place => key === place.id + '-stash')) state.worldChanges[key] = Boolean(value);
  }
  for (const key of Object.keys(state.stats)) state.stats[key] = Math.floor(safeNumber(data.stats?.[key], 0, 0, 1e7));
  if (!isWalkable(state.world, player.x, player.y, 10, player.interior)) {
    const safe = player.interior ? byId(state, player.interior).room.entry : byId(state, state.homeId).door;
    Object.assign(player, safe);
  }
  for (const npc of state.npcs) if (!isWalkable(state.world, npc.x, npc.y, 10, npc.interior)) {
    const safe = npc.interior ? byId(state, npc.interior).room.entry : byId(state, npc.homeId).door;
    Object.assign(npc, safe);
  }
  for (const vehicle of state.vehicles) if (!isWalkable(state.world, vehicle.x, vehicle.y, 23)) {
    vehicle.x = state.world.roads.vertical[0] + 22;
    vehicle.y = state.world.roads.horizontal[0] + 100 + Number(vehicle.id.slice(4)) * 55;
  }
  if (player.vehicleId) { const car = state.vehicles.find(item => item.id === player.vehicleId); player.x = car.x; player.y = car.y; }
  pushMessage(state, 'Your block, just where you left it.', 'good');
  state.dirty = false;
  return state;
}
