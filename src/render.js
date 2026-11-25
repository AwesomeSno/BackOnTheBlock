import { buildGround, buildingImage, treeFor, shoreMotion } from './streetscape.js';
import { paintResident, paintVehicle } from './street-actors.js';
import { createHarbourView } from './harbour-view.js';

const COLORS = {
  ink: '#172c39', cream: '#fff4d9', paper: '#d7d5c9', sand: '#d8d0b6',
  terracotta: '#e56e45', teal: '#358f93', blue: '#54839c', asphalt: '#556167',
  grass: '#80ad60', leaf: '#34794b', roadLine: '#e7ce7f', red: '#b54e3d', gold: '#dca64f',
};
const BUILDING_COLORS = {
  home: ['#c4ad8a', '#998b74', '#b36c51'], apartment: ['#b6b1a0', '#8a9488', '#748878'],
  cafe: ['#e0c7a0', '#b18d6e', '#b65e48'], clinic: ['#d1d6b8', '#91a898', '#4d827b'],
  garage: ['#a8aaa0', '#7a8980', '#b0884f'], shop: ['#d4bd98', '#b2a084', '#527f70'],
  pawn: ['#c5b38c', '#9b8c72', '#b48c45'], depot: ['#a6a594', '#858d80', '#a66c4f'],
  police: ['#bdc8bd', '#82978f', '#4e7382'], bar: ['#b5a58f', '#7e8779', '#865c54'],
  office: ['#c3c5b4', '#8b9b90', '#647d77'],
};
const ABBREVIATIONS = {
  home: 'H', apartment: 'A', cafe: 'C', clinic: '+', garage: 'G', shop: 'S',
  pawn: 'P', depot: 'D', police: 'PD', bar: 'B', office: 'O',
};

function hash(value) {
  let n = 2166136261;
  for (const char of String(value)) n = Math.imul(n ^ char.charCodeAt(0), 16777619);
  return n >>> 0;
}
function random(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let n = Math.imul(value ^ value >>> 15, 1 | value);
    n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}
function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function line(ctx, x1, y1, x2, y2, color, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(Math.round(x1), Math.round(y1));
  ctx.lineTo(Math.round(x2), Math.round(y2));
  ctx.stroke();
}
function ellipse(ctx, x, y, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}
function polygon(ctx, points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i];
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}
function text(ctx, value, x, y, size = 12, color = COLORS.ink, align = 'left', family = 'Arial,sans-serif') {
  ctx.fillStyle = color;
  ctx.font = `600 ${size}px ${family}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(String(value), Math.round(x), Math.round(y));
}
function imageAsset(name) {
  const image = new Image();
  const loaded = new Promise(resolve => {
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
  });
  image.src = new URL(`../assets/${name}.png`, import.meta.url).href;
  return { image, loaded };
}
function imageReady(image) {
  return image?.complete && image.naturalWidth > 0;
}
function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}
function getWorld(state) {
  return state.world || { width: 2816, height: 2816, buildings: [], parks: [], roads: {} };
}

function hasEventMarker(event) {
  if (event.stage !== 'open' && event.stage !== 'accepted') return false;
  const foundProperty = event.type === 'dropped_wallet' || event.type === 'lost_bag';
  return !(foundProperty && event.collected);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const assets = {};
  const loads = [];
  for (const name of ['bench', 'bin']) {
    const asset = imageAsset(name);
    assets[name] = asset.image;
    loads.push(asset.loaded);
  }
  const drawHarbour = createHarbourView();
  let staticItems = [];
  let mapBase = null;
  let wasTitle = false;
  let worldReference = null;
  let mapSeed = null;
  let camera = { x: 512, y: 512, zoom: 1 };
  let viewport = { width: 1000, height: 720, dpr: 1 };
  let lastInterior = undefined;
  let lastFrame = 0;
  let firstFrame = true;
  let interior = null;
  const ready = Promise.all(loads).then(() => { worldReference = null; });

  function resize() {
    const width = Math.max(1, canvas.clientWidth || 1000);
    const height = Math.max(1, canvas.clientHeight || 720);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    viewport = { width, height, dpr };
    ctx.imageSmoothingEnabled = false;
  }

  function drawSprite(image, x, y, scale = 2) {
    if (!imageReady(image)) return false;
    ctx.drawImage(image, Math.round(x - image.width * scale / 2), Math.round(y - image.height * scale), image.width * scale, image.height * scale);
    return true;
  }

  function bench(context, x, y, angle = 0) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    if (imageReady(assets.bench)) {
      const image = assets.bench;
      context.drawImage(image, -15, -image.height / image.width * 30, 30, image.height / image.width * 30);
    } else {
      rect(context, -23, -10, 46, 17, '#746c52');
      for (let i = 0; i < 3; i++) rect(context, -23, -11 + i * 5, 46, 3, '#b09668');
      rect(context, -17, 5, 5, 7, COLORS.ink);
      rect(context, 12, 5, 5, 7, COLORS.ink);
    }
    context.restore();
  }

  function planter(context, x, y, w = 30) {
    rect(context, x + 3, y + 5, w, 18, '#635d4733');
    rect(context, x, y, w, 19, '#a87955');
    rect(context, x - 2, y - 3, w + 4, 6, '#c09267');
    for (let i = 5; i < w; i += 8) {
      rect(context, x + i, y - 13 - i % 7, 5, 14, '#667f51');
      rect(context, x + i - 3, y - 9, 10, 5, '#829864');
    }
  }

  function lamp(context, x, y, night = false) {
    line(context, x + 5, y, x + 13, y - 37, '#354542', 3);
    line(context, x + 13, y - 37, x - 5, y - 37, '#354542', 3);
    rect(context, x - 12, y - 41, 15, 6, '#435650');
    rect(context, x - 10, y - 36, 11, 2, '#ecdb9e');
    rect(context, x, y - 2, 11, 4, '#697167');
    if (night) ellipse(context, x - 7, y + 5, 45, 24, '#e8d38323');
  }

  function drawBase(world) {
    mapBase = buildGround(world);
    staticItems = [];
    for (const b of world.buildings) {
      staticItems.push({ type:'building', value:b, sprite:buildingImage(b), y:b.y+b.h });
    }
    for (const park of world.parks || []) for (const plant of park.plants || []) {
      staticItems.push({type:'plant',value:plant,sprite:treeFor(plant),y:plant.y});
    }
    for (const d of world.decorations || []) staticItems.push({type:'prop',value:d,y:d.y});
    staticItems.sort((a,b)=>a.y-b.y);
    worldReference=world;
    mapSeed=world.seed;
  }

  function drawInterior(building) {
    const room = building.room || { width: 640, height: 480, furniture: [] };
    const w = room.width || 640;
    const h = room.height || 480;
    const palette = BUILDING_COLORS[building.type] || BUILDING_COLORS.home;
    rect(ctx, -4000, -4000, 8000, 8000, '#162a36');
    // Paper grain around the room reads like an architectural cutaway.
    for (let y = -320; y < h + 320; y += 17) {
      for (let x = -320; x < w + 320; x += 29) rect(ctx, x + (y % 6), y, 2, 1, '#d1c5a21c');
    }
    rect(ctx, 7, 13, w + 4, h + 6, '#273d3555');
    rect(ctx, 0, 0, w, h, '#e1d6b6');
    rect(ctx, 17, 28, w - 34, h - 43, ['garage', 'depot'].includes(building.type) ? '#b0b09a' : '#d3c6a0');
    const tile = building.type === 'clinic' ? 32 : 40;
    for (let y = 29; y < h - 18; y += tile) for (let x = 18; x < w - 18; x += tile) {
      if (building.type === 'home' || building.type === 'apartment' || building.type === 'bar') {
        rect(ctx, x, y, Math.min(tile - 2, w - 18 - x), 2, '#ac9b762b');
        line(ctx, x, y, x, Math.min(h - 18, y + tile), '#ad9c7a4d');
      } else {
        if ((Math.floor(x / tile) + Math.floor(y / tile)) % 2) rect(ctx, x, y, Math.min(tile - 1, w - 18 - x), Math.min(tile - 1, h - 18 - y), '#e0dac01f');
        line(ctx, x, y, Math.min(w - 18, x + tile), y, '#8d957d40');
        line(ctx, x, y, x, Math.min(h - 18, y + tile), '#8d957d40');
      }
    }
    // The north and side walls leave the player's walking plane unambiguous.
    rect(ctx, 0, 0, w, 28, room.wallColor || palette[0]);
    rect(ctx, 0, 0, 17, h, room.wallColor || palette[0]);
    rect(ctx, w - 17, 0, 17, h, room.wallColor || palette[0]);
    rect(ctx, 0, h - 15, w, 15, room.wallColor || palette[0]);
    rect(ctx, 15, 25, w - 30, 4, '#6a7f70');
    rect(ctx, 14, 28, 4, h - 42, '#7e8e77');
    rect(ctx, w - 20, 28, 4, h - 42, '#6c8275');
    // Window light, noticeboards, framed neighbourhood prints and a wall clock.
    for (const x of [85, w - 140]) {
      rect(ctx, x - 5, 5, 65, 21, '#f0e6c6');
      rect(ctx, x, 8, 55, 15, '#9db8a2');
      rect(ctx, x + 25, 8, 3, 15, '#eef0d0');
      polygon(ctx, [[x, 29], [x + 55, 29], [x + 80, 92], [x + 11, 92]], '#f6ebbb19');
    }
    ellipse(ctx, w / 2, 13, 10, 10, '#39544a');
    ellipse(ctx, w / 2, 13, 8, 8, '#f0e6c6');
    line(ctx, w / 2, 13, w / 2, 7, '#476b5b', 1);
    line(ctx, w / 2, 13, w / 2 + 4, 15, '#476b5b', 1);
    if (['home', 'apartment', 'bar'].includes(building.type)) {
      rect(ctx, 214, 193, 207, 126, '#a5634d');
      rect(ctx, 220, 199, 195, 114, '#c2956c');
      rect(ctx, 225, 205, 185, 103, '#9a7056');
      for (let y = 210; y < 305; y += 13) for (let x = 230; x < 408; x += 14) rect(ctx, x + (y % 2 ? 3 : 0), y, 3, 3, '#e5bc884d');
    }

    // A few floor-level details make each room look occupied.
    planter(ctx, 30, h - 58, 24);
    rect(ctx, w - 67, 31, 28, 38, '#b99b66');
    rect(ctx, w - 63, 35, 20, 30, '#dfd5b2');
    for (let i = 0; i < 5; i++) rect(ctx, w - 60, 40 + i * 4, i % 2 ? 10 : 15, 1, '#929779');
    const exit = room.exit || { x: w / 2, y: h - 25 };
    rect(ctx, exit.x - 24, h - 19, 48, 19, '#537b6b');
    rect(ctx, exit.x - 28, h - 21, 56, 4, '#e4d7b0');
    rect(ctx, exit.x - 22, h - 39, 44, 18, '#a69c7e');
    text(ctx, 'EXIT', exit.x, h - 25, 10, '#f8ecc7', 'center');
    if (room.spots?.stash && ['home', 'apartment'].includes(building.type)) {
      const spot = room.spots.stash;
      rect(ctx, spot.x - 13, spot.y - 7, 26, 17, '#7a775c');
      rect(ctx, spot.x - 14, spot.y - 10, 28, 6, '#a1966a');
      rect(ctx, spot.x - 3, spot.y - 6, 6, 5, '#d4bb76');
    }
  }

  function drawFurniture(item, roomType) {
    const { x, y, w, h, kind } = item;
    rect(ctx, x + 4, y + 6, w, h, '#40534324');
    const wood = '#ab8d60';
    const dark = '#69785f';
    switch (kind) {
      case 'bed':
      case 'clinicbed': {
        const medical = kind === 'clinicbed';
        rect(ctx, x - 3, y - 4, w + 6, h + 9, medical ? '#7c9384' : '#8c7655');
        rect(ctx, x, y + 2, w, h - 2, '#e9dfbf');
        rect(ctx, x + 7, y + h * 0.27, w - 14, h * 0.68, medical ? '#a4c1b0' : '#b58266');
        rect(ctx, x + 11, y + 9, w - 22, 29, '#f4eccc');
        line(ctx, x + 11, y + 40, x + w - 11, y + 40, '#c9c09e', 2);
        for (let i = 0; i < 4; i++) line(ctx, x + 12, y + h - 14 - i * 9, x + w - 12, y + h - 14 - i * 9, medical ? '#bfd2b720' : '#e1bb8e4d', 2);
        if (medical) {
          line(ctx, x + w + 9, y + 12, x + w + 9, y + 50, '#5a7766', 2);
          rect(ctx, x + w + 4, y + 6, 10, 21, '#d2d5ae');
        }
        break;
      }
      case 'table':
        for (const dx of [13, w - 29]) {
          rect(ctx, x + dx, y - 14, 18, 19, '#687e65');
          rect(ctx, x + dx, y + h - 3, 18, 20, '#687e65');
          rect(ctx, x + dx, y - 15, 18, 4, '#9caa80');
        }
        rect(ctx, x, y, w, h, wood);
        rect(ctx, x + 3, y + 3, w - 6, h - 6, '#c1a371');
        line(ctx, x + 6, y + h - 6, x + w - 6, y + h - 6, '#9b8058', 2);
        ellipse(ctx, x + w * 0.3, y + h * 0.45, 11, 7, '#e9dfb7');
        ellipse(ctx, x + w * 0.3, y + h * 0.45, 6, 4, '#a4a476');
        rect(ctx, x + w * 0.67, y + h * 0.35, 11, 16, '#526e5d');
        rect(ctx, x + w * 0.67 + 2, y + h * 0.35 + 2, 7, 12, '#d9d2af');
        break;
      case 'sofa':
        rect(ctx, x, y, w, h, '#668478');
        rect(ctx, x + 7, y + 7, w - 14, h - 15, '#8fa38a');
        rect(ctx, x - 3, y - 2, w + 6, 10, '#506f60');
        rect(ctx, x - 3, y - 2, 10, h + 2, '#506f60');
        rect(ctx, x + w - 7, y - 2, 10, h + 2, '#506f60');
        line(ctx, x + w / 2, y + 8, x + w / 2, y + h - 8, '#728a72', 2);
        rect(ctx, x + 15, y + 15, 18, 16, '#c49b6c');
        break;
      case 'kitchen':
        rect(ctx, x, y, w, h, '#83927b');
        rect(ctx, x - 3, y - 3, w + 6, h * 0.64, '#d4d0ad');
        rect(ctx, x + 9, y + 6, 45, 24, '#6b8675');
        rect(ctx, x + 13, y + 9, 36, 18, '#9cb5a0');
        line(ctx, x + 32, y + 8, x + 32, y + 1, '#4d695e', 3);
        rect(ctx, x + w - 51, y + 2, 44, 31, '#5b6c5a');
        for (let i = 0; i < 4; i++) ellipse(ctx, x + w - 39 + i % 2 * 18, y + 9 + Math.floor(i / 2) * 16, 5, 4, '#344d42');
        for (let i = 0; i < 3; i++) {
          rect(ctx, x + 5 + i * (w / 3), y + h * 0.7, w / 3 - 10, h * 0.25, '#a9b398');
          rect(ctx, x + 22 + i * (w / 3), y + h * 0.75, 10, 2, '#526c57');
        }
        break;
      case 'counter':
      case 'workbench':
      case 'desk':
        rect(ctx, x, y, w, h, '#927f5b');
        rect(ctx, x - 2, y - 2, w + 4, h - 8, '#bca373');
        rect(ctx, x + 3, y + 3, w - 6, 2, '#dfc690');
        for (let i = 0; i < Math.max(1, Math.floor(w / 160)); i++) {
          const dx = x + 25 + i * 127;
          if (kind === 'workbench') {
            rect(ctx, dx, y + 14, 26, 18, '#657e6b');
            line(ctx, dx - 6, y + 9, dx + 18, y + 38, '#b0b9a0', 5);
            rect(ctx, dx + 42, y + 12, 14, 23, '#c88b58');
          } else {
            rect(ctx, dx, y + 11, 32, 20, '#394f46');
            rect(ctx, dx + 3, y + 14, 26, 12, '#87a18c');
            rect(ctx, dx - 3, y + 31, 38, 7, '#73846c');
            rect(ctx, dx + 47, y + 15, 22, 28, '#e4d9b6');
            for (let lineNo = 0; lineNo < 5; lineNo++) rect(ctx, dx + 51, y + 20 + lineNo * 4, 12, 1, '#939a7f');
          }
        }
        break;
      case 'shelf':
      case 'cupboard': {
        rect(ctx, x, y, w, h, kind === 'cupboard' ? '#827451' : '#71826b');
        const rows = kind === 'cupboard' ? 2 : 3;
        const rng = random(hash(`${x}-${y}-${roomType}`));
        for (let row = 0; row < rows; row++) {
          const sy = y + 4 + row * (h - 7) / rows;
          rect(ctx, x + 4, sy, w - 8, (h - 12) / rows - 5, '#455f4c');
          for (let col = 0; col < w / 18 - 1; col++) {
            const shade = ['#d3b47c', '#a27454', '#9bb199', '#b9c2a7', '#708f85'][Math.floor(rng() * 5)];
            rect(ctx, x + 8 + col * 17, sy + 6, 11, Math.max(8, h / rows - 15 - rng() * 7), shade);
          }
          rect(ctx, x + 2, sy + h / rows - 4, w - 4, 4, '#a6a584');
        }
        break;
      }
      case 'crates':
        rect(ctx, x, y, w, h, dark);
        for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
          const cw = (w - 8) / 2;
          const ch = (h - 8) / 2;
          const cx = x + 3 + col * (cw + 2);
          const cy = y + 3 + row * (ch + 2);
          rect(ctx, cx, cy, cw, ch, '#b59a69');
          rect(ctx, cx + 3, cy + 3, cw - 6, ch - 6, '#c7ae7c');
          line(ctx, cx + 3, cy + 3, cx + cw - 3, cy + ch - 3, '#8a7c56', 3);
          line(ctx, cx + cw - 3, cy + 3, cx + 3, cy + ch - 3, '#8a7c56', 3);
        }
        break;
      default:
        rect(ctx, x, y, w, h, wood);
        rect(ctx, x + 4, y + 4, w - 8, h - 8, '#c3ad7a');
    }
  }

  function inView(x, y, margin = 120) {
    return Math.abs(x - camera.x) < viewport.width / camera.zoom / 2 + margin && Math.abs(y - camera.y) < viewport.height / camera.zoom / 2 + margin;
  }

  function drawProp(item,night) {
    if(item.kind==='bench') bench(ctx,item.x,item.y);
    else if(item.kind==='lamp') lamp(ctx,item.x,item.y,night);
    else if(item.kind==='bin'){
      if(!drawSprite(assets.bin,item.x,item.y,.60)){
        rect(ctx,item.x-4,item.y-10,8,10,'#4e6965');
        rect(ctx,item.x-5,item.y-12,10,2,'#829187');
      }
    }
  }

  function drawEffects(state,still=false) {
    for(const effect of state.effects||[]){
      if(!inView(effect.x,effect.y)||(effect.interior||null)!==(state.player.interior||null))continue;
      const left=Math.max(0,effect.life??0),seed=hash(effect.x+'-'+effect.y);
      ctx.save();
      if(effect.kind==='tracer'){
        ctx.globalAlpha=Math.min(.92,left*11);
        line(ctx,effect.x,effect.y-16,effect.toX??effect.x,(effect.toY??effect.y)-16,effect.color||'#e9d298',1.3);
        if(!still){
          const a=Math.atan2((effect.toY??effect.y)-effect.y,(effect.toX??effect.x)-effect.x);
          const xx=effect.x+Math.cos(a)*7,yy=effect.y-16+Math.sin(a)*7;
          ellipse(ctx,xx,yy,3,2,'#fff5ba');ellipse(ctx,xx,yy,6,4,'#ffc15a44');
        }
      }else if(effect.kind==='dust'){
        const age=still?.46:Math.max(0,Math.min(1,1-left/.44));
        for(let i=0;i<4;i++){
          const side=((seed>>>(i*5))%11)-5;
          const dx=side*(.5+age*1.8),dy=-i-age*(2+i);
          ctx.globalAlpha=(1-age)*(.29-i*.032);
          ellipse(ctx,effect.x+dx,effect.y+dy,2.5+age*(5+i),1.3+age*(3+i*.6),effect.color||'#bdc6c6');
        }
      }else{
        const age=still?.55:Math.max(0,Math.min(1,1-left/.5)),strong=effect.color==='#ffba60'||effect.color==='#f4c571';
        ctx.globalAlpha=Math.min(1,left*4.1);
        for(let i=0;i<(strong?10:6);i++){
          const angle=i*Math.PI*2/(strong?10:6)+seed*.015;
          const radius=2+age*(8+((seed>>>(i%6))%18));
          const xx=effect.x+Math.cos(angle)*radius,yy=effect.y+Math.sin(angle)*radius*.69-age*(1-age)*10;
          const len=strong?2+age*3:1.5;
          line(ctx,xx,yy,xx-Math.cos(angle)*len,yy-Math.sin(angle)*len*.65,effect.color||'#bd8c5c',strong?1.4:2);
        }
      }
      ctx.restore();
    }
  }

  function atmosphere(state,view) {
    const minutes=state.time??720;
    const night=minutes<370?1:minutes<445?(445-minutes)/75:Math.max(0,Math.min(1,(minutes-1050)/100));
    const dusk=Math.max(0,1-Math.abs(minutes-1065)/78)+.55*Math.max(0,1-Math.abs(minutes-405)/55);
    const w=viewport.width/camera.zoom,h=viewport.height/camera.zoom;
    const x=camera.x-w/2,y=camera.y-h/2;
    if(dusk>0){
      ctx.fillStyle='rgba(245,147,82,'+(.12*dusk)+')';ctx.fillRect(x,y,w,h);
    }
    if(night>.01){
      ctx.fillStyle='rgba(16,30,63,'+(.47*night)+')';ctx.fillRect(x,y,w,h);
      for(const obj of staticItems){
        const item=obj.value;
        if(!inView(item.x,item.y,160))continue;
        if(obj.type==='prop'&&item.kind==='lamp'){
          const glow=ctx.createRadialGradient(item.x,item.y-7,1,item.x,item.y-7,22);
          glow.addColorStop(0,'rgba(255,213,131,'+(.27*night)+')');glow.addColorStop(1,'#ffce7400');
          ellipse(ctx,item.x,item.y-7,22,22,glow);
          rect(ctx,item.x-10,item.y-36,11,2,'#ffe9a4');
        }else if(obj.type==='building'){
          const cols=Math.max(2,Math.floor(item.w/34)),floors=Math.min(item.floors||1,14);
          const height=floors>5?22:26;
          const pos=item.y+item.h-23;
          // Only windows on the side facing the camera contribute light.
          if(state.player.y<=obj.y&&state.player.y>obj.sprite.top&&state.player.x>item.x-10&&state.player.x<item.x+item.w+10)continue;
          for(let fl=1;fl<floors;fl++){
            for(let i=0;i<cols;i++){
              if((i*3+fl+item.variant)%4!==0)continue;
              rect(ctx,item.x+12+i*(item.w-18)/cols,pos-fl*height+2,5,3,'rgba(255,209,125,'+(night*.74)+')');
            }
          }
        }
      }
    }
    if(view.reducedMotion)return;
    const t=state.elapsed||0;
    // Occasional frigatebirds cross the scene independent of the camera.
    for(let i=0;i<4;i++){
      const bx=(t*23+i*791)%(state.world.width+120)-60;
      const by=370+i*468+Math.sin(t*.08+i)*45;
      if(!inView(bx,by,36))continue;
      const flap=Math.sin(t*2.4+i)*1.8;
      line(ctx,bx-6,by+flap,bx,by+1,'#334d597f',1.15);
      line(ctx,bx,by+1,bx+7,by+flap-1,'#334d597f',1.15);
    }
  }

  function drawMarkers(state, view) {
    const player = state.player || {};
    for (const event of state.events || []) {
      if (!hasEventMarker(event) || !inView(event.x, event.y) || !Number.isFinite(event.x)) continue;
      if ((event.interior || null) !== (player.interior || null)) continue;
      const pulse = view.reducedMotion ? 0 : Math.sin((state.elapsed || 0) * 3) * 2;
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(event.x, event.y - 37 + pulse, 10, 0, Math.PI * 2);
      ctx.stroke();
      text(ctx, '!', event.x, event.y - 32 + pulse, 14, COLORS.ink, 'center');
    }
    if (view.waypoint && !player.interior && Number.isFinite(view.waypoint.x)) {
      const point = view.waypoint;
      const nearby = Math.hypot(point.x - player.x, point.y - player.y) < 55;
      if (!nearby) {
        let markerX = point.x;
        let markerY = point.y;
        const halfWidth = viewport.width / camera.zoom / 2 - 35;
        const halfHeight = viewport.height / camera.zoom / 2 - 45;
        const dx = point.x - camera.x;
        const dy = point.y - camera.y;
        const edge = Math.max(Math.abs(dx) / halfWidth, Math.abs(dy) / halfHeight, 1);
        markerX = camera.x + dx / edge;
        markerY = camera.y + dy / edge;
        ctx.save();
        ctx.translate(markerX, markerY - (edge === 1 ? 27 : 0));
        ctx.rotate(edge > 1 ? Math.atan2(dy, dx) : Math.PI / 2);
        polygon(ctx, [[14, 0], [-8, -9], [-4, 0], [-8, 9]], COLORS.cream);
        polygon(ctx, [[9, 0], [-5, -6], [-2, 0], [-5, 6]], COLORS.terracotta);
        ctx.restore();
        if (edge === 1) {
          ctx.strokeStyle = COLORS.terracotta;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(point.x, point.y + 2, 22, 9, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    const highlight = view.highlight;
    if (!highlight) return;
    if (player.interior && ['exit', 'counter', 'bed', 'stash'].includes(highlight.kind)) {
      const room = interior?.room;
      const point = highlight.kind === 'exit' ? room?.exit : room?.spots?.[highlight.kind];
      if (point) {
        ellipse(ctx, point.x, point.y, 20, 7, '#507e6455');
        rect(ctx, point.x - 9, point.y - 31, 18, 20, COLORS.ink);
        text(ctx, 'E', point.x, point.y - 16, 13, COLORS.cream, 'center');
      }
    }
    if (highlight.kind === 'building' || highlight.kind === 'door') {
      const building = getWorld(state).buildings.find(item => item.id === highlight.id);
      if (building && !player.interior) {
        const door = building.door;
        ellipse(ctx, door.x, door.y + 1, 22, 8, '#5d8a6b33');
        rect(ctx, door.x - 9, door.y - 26, 18, 20, COLORS.ink);
        text(ctx, 'E', door.x, door.y - 11, 13, COLORS.cream, 'center');
      }
    }
  }

  function draw(state, view = {}) {
    if (!state?.player) return;
    resize();
    const world = getWorld(state);
    if(view.title){
      drawHarbour(ctx,viewport,world,view.time ?? performance.now()/1000,view.reducedMotion);
      wasTitle=true;
      return;
    }
    if (!mapBase || worldReference !== world || mapSeed !== world.seed) drawBase(world);
    const player = state.player;
    const now = performance.now();
    const delta = Math.min(0.1, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    interior = player.interior ? world.buildings.find(item => item.id === player.interior) : null;
    const inRoom = Boolean(interior);
    const driven = player.vehicleId ? (state.vehicles || []).find(item => item.id === player.vehicleId) : null;
    const focus = driven || player;
    const zoom = inRoom ? Math.min(1.15, viewport.width / 710, viewport.height / 570) : Math.min(1.55, Math.max(1.03, viewport.width / 810));
    const room = interior?.room;
    const targetX = inRoom ? (room.width || 640) / 2 : focus.x + (driven ? Math.cos(driven.angle || 0) * Math.min(85, Math.abs(driven.speed || 0) * 0.12) : 0);
    const targetY = inRoom ? (room.height || 480) / 2 : focus.y - 28 + (driven ? Math.sin(driven.angle || 0) * Math.min(85, Math.abs(driven.speed || 0) * 0.12) : 0);
    const changedInterior = lastInterior !== player.interior;
    const smoothing = view.reducedMotion || firstFrame || changedInterior || wasTitle ? 1 : 1 - Math.exp(-delta * 8);
    camera.x += (targetX - camera.x) * smoothing;
    camera.y += (targetY - camera.y) * smoothing;
    camera.zoom = zoom;
    if(!inRoom){
      const horizontalMargin=Math.min(world.width/2, viewport.width/zoom/2);
      const verticalMargin=Math.min(world.height/2, viewport.height/zoom/2);
      camera.x=Math.min(world.width-horizontalMargin,Math.max(horizontalMargin,camera.x));
      camera.y=Math.min(world.height-verticalMargin,Math.max(verticalMargin,camera.y));
    }
    lastInterior = player.interior;
    firstFrame = false;
    wasTitle = false;
    ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
    rect(ctx, 0, 0, viewport.width, viewport.height, COLORS.sand);
    ctx.save();
    ctx.translate(Math.round(viewport.width / 2), Math.round(viewport.height / 2));
    ctx.scale(zoom, zoom);
    ctx.translate(-Math.round(camera.x), -Math.round(camera.y));
    const drawables = [];
    const time=state.time ?? 720,night=time<360||time>1110;
    if (inRoom) {
      drawInterior(interior);
      for (const furniture of interior.room.furniture) drawables.push({type:'furniture',value:furniture,y:furniture.y+furniture.h});
    } else {
      ctx.drawImage(mapBase,0,0);
      shoreMotion(ctx,camera,viewport,world,state.elapsed,view.reducedMotion);
      for(const item of staticItems){
        const v=item.value;
        if(item.type==='building'){
          const b=item.sprite, midX=v.x+b.img.width/2, midY=b.top+b.img.height/2;
          if(inView(midX,midY,Math.max(b.img.width,b.img.height)/2+8))drawables.push(item);
        }else if(inView(v.x,v.y,126))drawables.push(item);
      }
      for (const vehicle of [...state.vehicles||[],...state.life?.traffic||[]]) {
        if(vehicle.active!==false && inView(vehicle.x,vehicle.y,50))drawables.push({type:'car',value:vehicle,y:vehicle.y+7});
      }
    }
    for(const actor of state.npcs||[]){
      if((actor.interior||null)===(player.interior||null)&&!actor.passengerOf&&!actor.inServiceVehicle&&inView(actor.x,actor.y,45)){
        drawables.push({type:'actor',value:actor,y:actor.y});
      }
    }
    if(!player.vehicleId)drawables.push({type:'player',value:player,y:player.y});
    drawables.sort((a,b)=>a.y-b.y);
    for(const item of drawables){
      const v=item.value, selected=!!view.highlight && view.highlight.id===v.id;
      if(item.type==='building'){
        const img=item.sprite;
        const occludes=focus.y<=item.y && focus.y>img.top-5 && focus.x>v.x-10 && focus.x<v.x+v.w+11;
        ctx.save();
        if(occludes)ctx.globalAlpha=.24;
        ctx.drawImage(img.img,Math.round(v.x-img.ox),Math.round(v.y-img.oy));
        ctx.restore();
      }else if(item.type==='plant'){
        const img=item.sprite,occludes=focus.y<=v.y && focus.y>v.y-100&&Math.abs(focus.x-v.x)<32;
        ctx.save();if(occludes)ctx.globalAlpha=.42;
        ctx.drawImage(img.img,v.x-img.ox,v.y-img.oy);ctx.restore();
      }else if(item.type==='furniture')drawFurniture(v,interior.type);
      else if(item.type==='prop')drawProp(v,night);
      else if(item.type==='car')paintVehicle(ctx,v,state,selected,view.reducedMotion);
      else paintResident(ctx,v,state,item.type==='player',selected,view.reducedMotion);
    }
    if(!inRoom) atmosphere(state,view);
    drawEffects(state,view.reducedMotion);
    drawMarkers(state, view);
    if (view.aim && !player.vehicleId && player.equipped) {
      const aim = view.aim;
      const x = aim.x;
      const y = aim.y;
      ctx.strokeStyle = '#b56448a6';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.stroke();
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) line(ctx, x + dx * 10, y + dy * 10, x + dx * 15, y + dy * 15, '#b56448a6');
    }
    ctx.restore();

  }

  function screenToWorld(clientX, clientY) {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: camera.x + (clientX - bounds.left - viewport.width / 2) / camera.zoom,
      y: camera.y + (clientY - bounds.top - viewport.height / 2) / camera.zoom,
      interior: lastInterior || null,
    };
  }

  function drawMap(targetCanvas, state, full = false, waypoint = null) {
    if (!state?.world) return;
    const world = state.world;
    const width = Math.max(1, targetCanvas.clientWidth || (full ? 600 : 180));
    const height = Math.max(1, targetCanvas.clientHeight || (full ? 600 : 180));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (targetCanvas.width !== Math.round(width * dpr) || targetCanvas.height !== Math.round(height * dpr)) {
      targetCanvas.width = Math.round(width * dpr);
      targetCanvas.height = Math.round(height * dpr);
    }
    const mapCtx = targetCanvas.getContext('2d');
    mapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mapCtx.imageSmoothingEnabled = false;
    const door=state.player.interior ? world.buildings.find(b=>b.id===state.player.interior)?.door : null;
    const playerX=door?.x??state.player.x,playerY=door?.y??state.player.y;
    const scale=full?Math.min((width-30)/world.width,(height-36)/world.height):Math.min(width,height)/680;
    const offsetX=full?(width-world.width*scale)/2:(width/2-playerX*scale);
    const offsetY=full?(height-world.height*scale)/2:(height/2-playerY*scale);
    rect(mapCtx,0,0,width,height,'#172832');
    mapCtx.save();
    mapCtx.translate(offsetX,offsetY);mapCtx.scale(scale,scale);
    rect(mapCtx,0,0,world.width,world.height,'#4e5b5e');
    const shore=world.water?.shoreX||world.width;
    rect(mapCtx,shore,0,world.width-shore,world.height,'#326f80');
    rect(mapCtx,shore-12,0,12,world.height,'#a39671');
    for(const park of world.parks||[])rect(mapCtx,park.x,park.y,park.w,park.h,'#63836b');
    const rw=world.roads.width;
    for(const vx of world.roads.vertical)rect(mapCtx,vx-rw/2,0,rw,world.height,'#b0b4ab');
    for(const vy of world.roads.horizontal)rect(mapCtx,0,vy-rw/2,shore,rw,'#b0b4ab');
    for(const b of world.buildings){
      const commercial=['cafe','shop','bar','pawn'].includes(b.type);
      rect(mapCtx,b.x,b.y,b.w,b.h,commercial?'#887d71':'#69767a');
      if(full && !['home','apartment'].includes(b.type))text(mapCtx,ABBREVIATIONS[b.type]||'',b.x+b.w/2,b.y+b.h/2+5,Math.max(6,Math.min(9,width/62))/scale,'#fff2ce','center');
    }
    mapCtx.restore();
    function point(x,y){return [offsetX+x*scale,offsetY+y*scale];}
    for (const event of state.events || []) {
      if (!hasEventMarker(event) || !Number.isFinite(event.x)) continue;
      const naturallyVisible = !state.player.interior && !event.interior && Math.hypot(event.x - state.player.x, event.y - state.player.y) <= 300;
      if (!event.known && !naturallyVisible) continue;
      const eventBuilding = event.interior ? world.buildings.find(item => item.id === event.interior) : null;
      const location = eventBuilding?.door || event;
      const [x, y] = point(location.x, location.y);
      mapCtx.strokeStyle = '#c48736';
      mapCtx.lineWidth = 1.5;
      mapCtx.beginPath();
      mapCtx.arc(x, y, full ? 5 : 2.5, 0, Math.PI * 2);
      mapCtx.stroke();
    }
    for (const npc of state.npcs || []) {
      if (npc.role !== 'police' || npc.interior) continue;
      const [x, y] = point(npc.x, npc.y);
      ellipse(mapCtx, x, y, full ? 2.5 : 1.5, full ? 2.5 : 1.5, '#4d7d98');
    }
    if (waypoint) {
      const place = waypoint.interior && world.buildings.find(building => building.id === waypoint.interior);
      const target = place?.door || waypoint;
      let [x,y]=point(target.x,target.y);
      if(!full){
        const dx=x-width/2,dy=y-height/2;
        const edge=Math.max(1,Math.hypot(dx,dy)/(Math.min(width,height)*.5-12));
        x=width/2+dx/edge;y=height/2+dy/edge;
      }
      const size = full ? 12 : 7;
      line(mapCtx, x, y, x, y - size * 1.5, COLORS.ink, full ? 3 : 2);
      polygon(mapCtx, [[x, y - size * 1.55], [x + size, y - size * 1.17], [x, y - size * 0.8]], COLORS.ink);
      polygon(mapCtx, [[x + 1, y - size * 1.42], [x + size * .68, y - size * 1.17], [x + 1, y - size * .93]], COLORS.gold);
    }
    const [x, y] = point(playerX, playerY);
    const vehicle = state.player.vehicleId ? (state.vehicles || []).find(item => item.id === state.player.vehicleId) : null;
    const angle = vehicle?.angle ?? state.player.angle ?? 0;
    mapCtx.save();
    mapCtx.translate(x, y);
    mapCtx.rotate(angle);
    ellipse(mapCtx, 0, 0, full ? 8 : 6, full ? 8 : 6, '#f7efd3');
    polygon(mapCtx, [[full ? 10 : 7, 0], [-4, -4], [-2, 0], [-4, 4]], '#b75e43');
    mapCtx.restore();
    if (full) {
      const districtNames = world.districts || [];
      const corners = [[0.25, 0.05], [0.75, 0.05], [0.25, 0.95], [0.75, 0.95]];
      for (let i = 0; i < districtNames.length && i < corners.length; i++) {
        const [cx, cy] = corners[i];
        text(mapCtx, districtNames[i].toUpperCase(), width * cx, height * cy, 10, '#dce1d7', 'center');
      }
    }
  }

  return { draw, drawMap, screenToWorld, ready };
}
