import test from 'node:test';
import assert from 'node:assert/strict';
import {generateWorld,findPath,isWalkable,buildingByType,moveActor,canSee} from '../src/world.js';

test('seeds reproduce buildings, terrain, and interior arrangements',()=>{
  const a=generateWorld('rain-on-tuesday'),b=generateWorld('rain-on-tuesday'),c=generateWorld('other-side');
  assert.deepEqual(a,b);assert.notDeepEqual(a,c);
  assert.notDeepEqual(a.roads,c.roads);
});

test('every generated building is reachable from the starting home',()=>{
  for(const seed of ['first','second','third','with spaces','1234']) {
    const world=generateWorld(seed),home=buildingByType(world,'home');
    for(const building of world.buildings) {
      assert.ok(isWalkable(world,building.door.x,building.door.y),`${seed} ${building.id} door`);
      assert.ok(findPath(world,home.door,building.door).length,`${seed} ${building.id} path`);
      assert.ok(isWalkable(world,320,410,10,building.id),`${building.id} entry`);
      assert.ok(isWalkable(world,320,454,1,building.id),`${building.id} exit`);
    }
    for(const type of ['home','cafe','depot','garage','clinic','police','office','pawn','shop'])
      assert.equal(buildingByType(world,type).type,type);
  }
});

test('movement cannot cross a solid building and walls block sight',()=>{
  const world=generateWorld('walls'),b=world.buildings[0];
  const actor={x:b.x-20,y:b.y+b.h/2};
  moveActor(world,actor,b.w+40,0);
  assert.ok(actor.x < b.x);
  assert.equal(canSee(world,actor,{x:b.x+b.w+20,y:actor.y}),false);
});
