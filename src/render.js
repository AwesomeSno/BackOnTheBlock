const COLORS = {
  ink: '#263b3a', cream: '#f5edcf', paper: '#ded7b9', sand: '#c9c1a1',
  terracotta: '#b96e50', teal: '#4e8078', blue: '#537d8a', asphalt: '#686e63',
  grass: '#9aa877', leaf: '#708661', roadLine: '#d6cfaf', red: '#b54e3d', gold: '#dca64f',
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
function text(ctx, value, x, y, size = 12, color = COLORS.ink, align = 'left', family = 'monospace') {
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
  for (const name of ['player-up', 'player-down', 'player-left', 'player-right', 'car-0', 'car-1', 'car-2', 'car-3', 'tree', 'bench', 'bin', 'lamp']) {
    const asset = imageAsset(name);
    assets[name] = asset.image;
    loads.push(asset.loaded);
  }
  let mapBase = null;
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

  function tree(context, x, y, size = 1, seed = 0) {
    const sprite = assets.tree;
    ellipse(context, x + 9 * size, y - 4 * size, 25 * size, 9 * size, '#465a412d');
    if (imageReady(sprite)) {
      const width = 55 * size;
      const height = sprite.height / sprite.width * width;
      context.drawImage(sprite, Math.round(x - width / 2), Math.round(y - height), width, height);
      return;
    }
    rect(context, x - 3 * size, y - 45 * size, 7 * size, 44 * size, '#776b4e');
    const rng = random(seed);
    for (let i = 0; i < 9; i++) {
      const dx = (rng() - 0.5) * 42 * size;
      const dy = (rng() - 0.5) * 30 * size;
      ellipse(context, x + dx, y - 48 * size + dy, 18 * size, 15 * size, i % 3 ? '#809360' : '#9eaa76');
    }
  }

  function bench(context, x, y, angle = 0) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    if (imageReady(assets.bench)) {
      const image = assets.bench;
      context.drawImage(image, -22, -image.height / image.width * 44, 44, image.height / image.width * 44);
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
    mapBase = makeCanvas(world.width, world.height);
    const context = mapBase.getContext('2d');
    context.imageSmoothingEnabled = false;
    const rng = random(hash(world.seed || 'block'));
    const roads = world.roads || {};
    const vertical = roads.vertical || [];
    const horizontal = roads.horizontal || [];
    const roadWidth = roads.width || 92;
    const sidewalk = 24;
    rect(context, 0, 0, world.width, world.height, '#b8b394');
    for (let i = 0; i < 6000; i++) {
      const x = rng() * world.width;
      const y = rng() * world.height;
      rect(context, x, y, 2 + rng() * 5, 1, i % 3 ? '#c9c1a64a' : '#777f6136');
    }
    for (const x of vertical) {
      rect(context, x - roadWidth / 2 - sidewalk, 0, roadWidth + sidewalk * 2, world.height, '#d8d0b5');
      rect(context, x - roadWidth / 2, 0, roadWidth, world.height, COLORS.asphalt);
      line(context, x - roadWidth / 2 - 3, 0, x - roadWidth / 2 - 3, world.height, '#ece2c5', 3);
      line(context, x + roadWidth / 2 + 3, 0, x + roadWidth / 2 + 3, world.height, '#ece2c5', 3);
      for (let y = 0; y < world.height; y += 58) {
        rect(context, x - 2, y, 3, 25, '#d5cba5');
        if (horizontal.every(yy => Math.abs(yy - y) > 100)) {
          line(context, x - roadWidth / 2 - 14, y, x - roadWidth / 2 - 14, y + 52, '#b9b6a0', 1);
          line(context, x + roadWidth / 2 + 14, y, x + roadWidth / 2 + 14, y + 52, '#b9b6a0', 1);
        }
      }
    }
    for (const y of horizontal) {
      rect(context, 0, y - roadWidth / 2 - sidewalk, world.width, roadWidth + sidewalk * 2, '#d8d0b5');
      rect(context, 0, y - roadWidth / 2, world.width, roadWidth, COLORS.asphalt);
      line(context, 0, y - roadWidth / 2 - 3, world.width, y - roadWidth / 2 - 3, '#ece2c5', 3);
      line(context, 0, y + roadWidth / 2 + 3, world.width, y + roadWidth / 2 + 3, '#ece2c5', 3);
      for (let x = 0; x < world.width; x += 58) {
        rect(context, x, y - 2, 25, 3, '#d5cba5');
        if (vertical.every(xx => Math.abs(xx - x) > 100)) {
          line(context, x, y - roadWidth / 2 - 14, x + 52, y - roadWidth / 2 - 14, '#b9b6a0', 1);
          line(context, x, y + roadWidth / 2 + 14, x + 52, y + roadWidth / 2 + 14, '#b9b6a0', 1);
        }
      }
    }
    for (const x of vertical) for (const y of horizontal) {
      const half = roadWidth / 2;
      rect(context, x - half, y - half, roadWidth, roadWidth, COLORS.asphalt);
      for (let i = -36; i < 38; i += 12) {
        rect(context, x + i, y - half - 24, 7, 20, '#e3dcc0');
        rect(context, x + i, y + half + 5, 7, 20, '#e3dcc0');
        rect(context, x - half - 24, y + i, 20, 7, '#e3dcc0');
        rect(context, x + half + 5, y + i, 20, 7, '#e3dcc0');
      }
      for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
        const sx = x + dx * (half + 31);
        const sy = y + dy * (half + 30);
        rect(context, sx - 5, sy - 3, 10, 6, '#919681');
        if (dx * dy === 1) {
          line(context, sx, sy, sx, sy - 27, '#536257', 2);
          rect(context, sx - 4, sy - 31, 8, 13, '#314c45');
          rect(context, sx - 2, sy - 28, 4, 3, '#b5704d');
          rect(context, sx - 2, sy - 22, 4, 3, '#aabd77');
        }
      }
      // Manhole covers and repaired asphalt give intersections wear without visual noise.
      ellipse(context, x + 21, y + 16, 10, 7, '#565f56');
      for (let i = -5; i <= 5; i += 4) line(context, x + 14, y + 16 + i, x + 28, y + 16 + i, '#798071');
    }
    // Asphalt cracks stay decorative and use a separate deterministic stream.
    for (let i = 0; i < 900; i++) {
      const x = rng() * world.width;
      const y = rng() * world.height;
      if (!vertical.some(xx => Math.abs(x - xx) < roadWidth / 2 - 9) && !horizontal.some(yy => Math.abs(y - yy) < roadWidth / 2 - 9)) continue;
      line(context, x, y, x + 7, y + 3, '#515b513a');
      line(context, x + 7, y + 3, x + 12, y - 1, '#515b513a');
    }
    // A shallow canal occupies the non-walkable city edge selected by the seed.
    if (world.water) {
      const edge = Number(world.water.edge) || 0;
      context.save();
      if (edge === 1) { context.translate(world.width, 0); context.rotate(Math.PI / 2); }
      else if (edge === 2) { context.translate(world.width, world.height); context.rotate(Math.PI); }
      else if (edge === 3) { context.translate(0, world.height); context.rotate(-Math.PI / 2); }
      const edgeLength = edge % 2 ? world.height : world.width;
      rect(context, 0, 0, edgeLength, 41, '#6b9b94');
      rect(context, 0, 37, edgeLength, 7, '#aab9a0');
      for (let x = 8; x < edgeLength; x += 23) {
        line(context, x, 13 + x % 13, x + 11, 13 + x % 13, '#a5c0a6', 2);
        rect(context, x, 40, 3, 9, '#647b67');
      }
      line(context, 0, 48, edgeLength, 48, '#8c957b', 2);
      context.restore();
    }
    for (const park of world.parks || []) drawPark(context, park, hash(park.id || `${park.x}-${park.y}`));
    for (const building of world.buildings || []) drawBuilding(context, building);
    const streetNames = ['WEST COMMON', 'MARKET STREET', 'CIVIC AVENUE', 'CANAL ROAD', 'EAST SERVICE ROAD'];
    horizontal.forEach((y, i) => {
      for (let j = 0; j < vertical.length - 1; j++) {
        const x = (vertical[j] + vertical[j + 1]) / 2;
        context.save();
        context.globalAlpha = 0.5;
        text(context, streetNames[i % streetNames.length], x, y + 33, 10, '#ece4c8', 'center');
        context.restore();
        lamp(context, x + 102, y - roadWidth / 2 - 13);
        if ((i + j) % 2 === 0) planter(context, x - 112, y - roadWidth / 2 - 28, 42);
      }
    });
    // Edge foliage softens the city's geometric boundary.
    for (let i = 0; i < 34; i++) {
      const x = 20 + rng() * (world.width - 40);
      const y = i % 2 ? 32 : world.height - 13;
      tree(context, x, y, 0.8 + rng() * 0.5, i + 44);
    }
    worldReference = world;
    mapSeed = world.seed;
  }

  function drawPark(context, park, seed) {
    const { x, y, w, h } = park;
    const rng = random(seed);
    rect(context, x + 4, y + 7, w, h, '#7b896426');
    rect(context, x, y, w, h, '#a4b483');
    rect(context, x + 6, y + 6, w - 12, h - 12, '#9cae7d');
    for (let i = 0; i < w * h / 220; i++) {
      const px = x + 12 + rng() * (w - 24);
      const py = y + 12 + rng() * (h - 24);
      line(context, px, py, px + 3, py - 3, i % 4 ? '#7c9660' : '#bdc291');
    }
    rect(context, x + w / 2 - 13, y + 3, 26, h - 6, '#cdc6a3');
    rect(context, x + 3, y + h / 2 - 13, w - 6, 26, '#cdc6a3');
    ellipse(context, x + w / 2, y + h / 2, 34, 24, '#b9b69b');
    ellipse(context, x + w / 2, y + h / 2, 24, 16, '#6b9791');
    ellipse(context, x + w / 2, y + h / 2 - 2, 17, 10, '#89b4a7');
    rect(context, x + w / 2 - 2, y + h / 2 - 13, 4, 15, '#d8d4b6');
    for (const dx of [0.19, 0.81]) for (const dy of [0.25, 0.83]) tree(context, x + w * dx, y + h * dy, 1.1, seed + dx * 100 + dy);
    bench(context, x + w * 0.28, y + h / 2 + 34);
    bench(context, x + w * 0.72, y + h / 2 - 26);
    text(context, park.name || 'COMMON GROUND', x + w / 2, y + h - 17, 10, '#526e50', 'center');
  }

  function drawBuilding(context, building) {
    const { x, y, w, h } = building;
    const type = building.type || 'home';
    const rng = random(hash(building.id));
    const palette = BUILDING_COLORS[type] || BUILDING_COLORS.home;
    const [wall, roof, accent] = palette;
    const facade = Math.min(43, h * 0.25);
    const roofH = h - facade;
    const door = building.door || { x: x + w / 2, y: y + h };
    // Continuous entrance paving makes the location's usable face clear.
    rect(context, door.x - 24, door.y - 8, 48, 37, '#d9cfaf');
    for (let sy = door.y + 4; sy < door.y + 30; sy += 9) line(context, door.x - 24, sy, door.x + 24, sy, '#b8b89c');
    polygon(context, [[x + 10, y + 12], [x + w + 17, y + 13], [x + w + 17, y + h + 14], [x + 10, y + h + 14]], '#3c4b3d2e');
    rect(context, x, y + roofH, w, facade, wall);
    rect(context, x + 5, y + h - 7, w - 10, 7, '#777b66');
    // Small masonry courses on the facade.
    for (let sy = y + roofH + 8; sy < y + h - 6; sy += 12) {
      line(context, x + 3, sy, x + w - 3, sy, '#655a4521');
      for (let sx = x + (Math.round(sy) % 2 ? 17 : 7); sx < x + w - 5; sx += 35) line(context, sx, sy, sx, sy + 11, '#655a4521');
    }
    rect(context, x, y, w, roofH, roof);
    rect(context, x + 6, y + 7, w - 12, roofH - 12, roof);
    context.save();
    context.beginPath();
    context.rect(x + 5, y + 5, w - 10, roofH - 10);
    context.clip();
    if (type === 'home' || type === 'bar' || type === 'apartment') {
      // Shallow roof tiles keep the overhead view while adding hand-drawn rhythm.
      for (let sy = y + 9; sy < y + roofH; sy += 10) {
        line(context, x + 3, sy, x + w - 3, sy, '#38483c30');
        for (let sx = x - 10; sx < x + w; sx += 18) line(context, sx + sy % 18, sy, sx + sy % 18, sy + 7, '#d6cfaf35');
      }
    } else {
      for (let sx = x + 10; sx < x + w; sx += 16) line(context, sx, y + 7, sx, y + roofH - 6, '#d9dbbe25');
      for (let i = 0; i < 22; i++) rect(context, x + rng() * w, y + rng() * roofH, 2 + rng() * 4, 1, '#394c3f20');
    }
    context.restore();
    // Lit parapet and fascia, gutters and downspouts.
    rect(context, x - 3, y - 3, w + 6, 6, '#d6ccb0');
    rect(context, x - 3, y, 5, roofH + 4, '#cfcaaf');
    rect(context, x + w - 3, y, 6, roofH + 5, '#677c70');
    rect(context, x - 3, y + roofH - 3, w + 6, 7, '#53695d');
    line(context, x + w - 8, y + roofH + 4, x + w - 8, y + h - 3, '#586f66', 3);
    if (w > 115 && roofH > 67) {
      const vx = x + w - 58;
      const vy = y + 24;
      rect(context, vx + 5, vy + 7, 34, 27, '#42594a36');
      rect(context, vx, vy, 33, 25, '#b6b9a3');
      rect(context, vx - 2, vy - 2, 37, 4, '#d6d4b7');
      for (let i = 0; i < 4; i++) line(context, vx + 5, vy + 6 + i * 4, vx + 27, vy + 6 + i * 4, '#6b7f73', 2);
      if (w > 200) {
        rect(context, x + 23, y + 20, 39, 31, '#566b62');
        rect(context, x + 26, y + 23, 33, 24, '#a6b9ad');
        line(context, x + 43, y + 23, x + 43, y + 47, '#d4d7bd', 2);
        line(context, x + 26, y + 34, x + 59, y + 34, '#d4d7bd', 2);
      }
    }
    const business = !['home', 'apartment'].includes(type);
    const signText = building.name || type.toUpperCase();
    if (business) {
      const signW = Math.min(w - 19, Math.max(90, signText.length * 7));
      const sx = x + (w - signW) / 2;
      const sy = y + roofH - 11;
      rect(context, sx + 2, sy + 3, signW, 23, '#35494044');
      rect(context, sx, sy, signW, 21, accent);
      line(context, sx + 3, sy + 3, sx + signW - 3, sy + 3, '#f5e9ba55');
      text(context, signText.toUpperCase(), x + w / 2, sy + 15, Math.min(12, (signW - 9) / Math.max(1, signText.length) * 1.55), COLORS.cream, 'center');
      if (['cafe', 'shop', 'bar', 'pawn'].includes(type)) {
        // Canvas storefront canopy and alternating scallops.
        const aw = w * 0.64;
        const ax = x + (w - aw) / 2;
        const ay = y + roofH + 11;
        polygon(context, [[ax, ay], [ax + aw, ay], [ax + aw + 5, ay + 11], [ax - 5, ay + 11]], accent);
        for (let i = 0; i < aw; i += 19) {
          rect(context, ax + i, ay, Math.min(9, aw - i), 10, '#f4e5be');
          rect(context, ax + i - 1, ay + 10, 11, 3, '#dfd0a9');
        }
      }
    }
    const doorX = Math.min(x + w - 22, Math.max(x + 14, door.x - 10));
    const doorY = y + h - 28;
    for (const wx of [x + 16, x + w - 48]) {
      if (Math.abs(wx + 17 - door.x) < 30) continue;
      rect(context, wx - 3, doorY - 1, 37, 22, '#667c6e');
      rect(context, wx, doorY + 1, 31, 17, '#a9c1ad');
      rect(context, wx, doorY + 10, 31, 2, '#d8d5b6');
      rect(context, wx + 14, doorY + 1, 2, 17, '#e0d8b9');
      rect(context, wx - 4, doorY + 20, 40, 4, '#b3b79a');
      line(context, wx + 3, doorY + 6, wx + 10, doorY + 3, '#e6e4c5', 2);
    }
    rect(context, doorX - 3, doorY - 3, 26, 31, '#e3d5b4');
    rect(context, doorX, doorY, 20, 28, '#38554d');
    rect(context, doorX + 3, doorY + 3, 14, 12, '#8cae9b');
    rect(context, doorX + 14, doorY + 20, 3, 3, '#e1c18b');
    rect(context, doorX - 3, doorY + 28, 27, 4, '#777d66');
    if (['clinic', 'police'].includes(type)) {
      rect(context, x + 11, y + 12, 25, 25, accent);
      if (type === 'clinic') {
        rect(context, x + 21, y + 16, 6, 17, COLORS.cream);
        rect(context, x + 16, y + 21, 16, 6, COLORS.cream);
      } else text(context, 'PD', x + 24, y + 30, 13, COLORS.cream, 'center');
    }
    if (type === 'garage' || type === 'depot') {
      const bx = x + 15;
      rect(context, bx, y + roofH + 8, Math.min(67, w / 3), facade - 9, '#65776a');
      for (let sy = y + roofH + 11; sy < y + h - 3; sy += 5) line(context, bx + 2, sy, bx + Math.min(65, w / 3 - 2), sy, '#96a08a');
      rect(context, x + w - 43, y + h + 3, 27, 25, '#ac9368');
      line(context, x + w - 41, y + h + 7, x + w - 19, y + h + 23, '#75694d', 2);
      line(context, x + w - 19, y + h + 7, x + w - 41, y + h + 23, '#75694d', 2);
    } else if (business) {
      planter(context, x + 7, y + h + 2, 26);
      const bx = x + w - 40;
      rect(context, bx, y + h + 8, 26, 25, '#3e5c52');
      rect(context, bx - 2, y + h + 5, 30, 4, '#829d86');
      text(context, type === 'cafe' ? 'COFFEE' : type === 'bar' ? 'OPEN' : 'LOCAL', bx + 13, y + h + 23, 5, '#eee1b7', 'center');
    }
    // Posted hours and street number are small environmental details.
    rect(context, doorX + 26, doorY + 3, 14, 17, '#ece0bc');
    for (let i = 0; i < 4; i++) rect(context, doorX + 28, doorY + 6 + i * 3, i % 2 ? 6 : 9, 1, '#8d937b');
    text(context, String(hash(building.id) % 90 + 10), x + 5, y + roofH + 17, 7, '#536d61');
  }

  function drawInterior(building) {
    const room = building.room || { width: 640, height: 480, furniture: [] };
    const w = room.width || 640;
    const h = room.height || 480;
    const palette = BUILDING_COLORS[building.type] || BUILDING_COLORS.home;
    rect(ctx, -4000, -4000, 8000, 8000, '#677368');
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
    for (const item of room.furniture || []) drawFurniture(item, building.type);
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

  function drawActor(actor, state, isPlayer = false, selected = false) {
    if (!Number.isFinite(actor.x) || !Number.isFinite(actor.y) || actor.vehicleId || actor.passengerOf || !inView(actor.x, actor.y)) return;
    const x = Math.round(actor.x);
    const y = Math.round(actor.y);
    const t = state.elapsed || 0;
    const dead = actor.hp !== undefined && actor.hp <= 0;
    const role = actor.role || '';
    ellipse(ctx, x + 2, y + 2, dead ? 20 : 13, dead ? 7 : 5, '#263d3b38');
    if (isPlayer) {
      ctx.strokeStyle = COLORS.cream;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y + 1, 16, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      rect(ctx, x - 3, y - 66, 6, 4, COLORS.terracotta);
      polygon(ctx, [[x - 3, y - 62], [x + 3, y - 62], [x, y - 58]], COLORS.terracotta);
    } else if (selected) {
      ctx.strokeStyle = COLORS.teal;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y + 1, 17, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    const angle = actor.angle || 0;
    let direction = 'down';
    if (Math.cos(angle) > 0.58) direction = 'right';
    else if (Math.cos(angle) < -0.58) direction = 'left';
    else if (Math.sin(angle) < 0) direction = 'up';
    const sprite = assets[`player-${direction}`];
    ctx.save();
    if (dead) {
      ctx.translate(x, y - 10);
      ctx.rotate(Math.PI / 2);
      ctx.translate(-x, -y + 10);
    }
    if (!isPlayer) {
      const tint = hash(actor.id || actor.name || role);
      const hue = role === 'police' ? 175 : tint % 290;
      ctx.filter = `hue-rotate(${hue}deg) saturate(${role === 'police' ? 0.6 : 0.65 + tint % 3 * 0.15})`;
    }
    if (imageReady(sprite)) {
      const frameWidth = Math.floor(sprite.width / 6);
      const frame = actor.moving && !dead ? Math.floor(t * 9 + (isPlayer ? 0 : hash(actor.id || '') % 6)) % 6 : 0;
      const scale = 3.2;
      ctx.drawImage(sprite, frame * frameWidth, 0, frameWidth, sprite.height,
        Math.round(x - frameWidth * scale / 2), Math.round(y - sprite.height * scale + 3),
        frameWidth * scale, sprite.height * scale);
    } else {
      rect(ctx, x - 9, y - 34, 18, 25, isPlayer ? COLORS.terracotta : COLORS.teal);
      ellipse(ctx, x, y - 42, 9, 10, '#dbbc8c');
      rect(ctx, x - 7, y - 49, 14, 5, '#39443b');
      rect(ctx, x - 8, y - 9, 6, 10, '#3b5047');
      rect(ctx, x + 2, y - 9, 6, 10, '#3b5047');
    }
    ctx.filter = 'none';
    ctx.restore();
    if (role === 'police' && !dead) {
      rect(ctx, x - 11, y - 47, 22, 5, '#506c7e');
      rect(ctx, x - 3, y - 46, 5, 3, '#e1c779');
    }
    if (selected && !isPlayer) {
      const label = actor.name || 'Neighbour';
      ctx.font = '600 12px monospace';
      const width = ctx.measureText(label).width + 18;
      rect(ctx, x - width / 2 + 2, y - 78, width, 23, '#34594c33');
      rect(ctx, x - width / 2, y - 80, width, 23, COLORS.cream);
      text(ctx, label, x, y - 64, 12, COLORS.ink, 'center');
    }
    if (actor.hp !== undefined && actor.hp < 80 && !dead) {
      rect(ctx, x - 15, y - 58, 30, 4, '#263b3a77');
      rect(ctx, x - 15, y - 58, 30 * Math.max(0, actor.hp) / 100, 4, COLORS.terracotta);
    }
  }

  function drawCar(vehicle, state, selected) {
    if (!inView(vehicle.x, vehicle.y)) return;
    const numericModel = Number(vehicle.model);
    const model = Math.abs(Number.isFinite(numericModel) ? Math.floor(numericModel) : hash(vehicle.model || vehicle.id)) % 4;
    const sprite = assets[`car-${model}`];
    ctx.save();
    ctx.translate(Math.round(vehicle.x), Math.round(vehicle.y));
    ctx.rotate((vehicle.angle || 0) + Math.PI / 2);
    rect(ctx, -23 + 5, -34 + 6, 46, 70, '#273e3840');
    if (imageReady(sprite)) {
      ctx.drawImage(sprite, -sprite.width, -sprite.height, sprite.width * 2, sprite.height * 2);
    } else {
      rect(ctx, -21, -37, 42, 74, vehicle.color || '#b7825c');
      rect(ctx, -17, -12, 34, 25, '#3c5d50');
      rect(ctx, -18, -29, 36, 9, '#a0bbac');
    }
    if ((state.time ?? 720) < 360 || (state.time ?? 720) > 1110) {
      polygon(ctx, [[-17, -32], [-50, -160], [18, -160], [16, -32]], '#f5e6a310');
      rect(ctx, -16, -31, 8, 4, '#fff3bb');
      rect(ctx, 8, -31, 8, 4, '#fff3bb');
    }
    if (vehicle.health < 40) {
      const t = state.elapsed || 0;
      for (let i = 0; i < 3; i++) ellipse(ctx, Math.sin(t * 2 + i) * 5, -29 - ((t * 12 + i * 15) % 45), 5 + i * 2, 6, '#4e605452');
    }
    if (selected || state.player?.vehicleId === vehicle.id) {
      ctx.strokeStyle = state.player?.vehicleId === vehicle.id ? COLORS.cream : COLORS.gold;
      ctx.lineWidth = 2;
      ctx.strokeRect(-28, -43, 56, 86);
    }
    if (vehicle.role === 'police' || vehicle.police) {
      rect(ctx, -12, -3, 12, 5, Math.floor((state.elapsed || 0) * 6) % 2 ? '#a95449' : '#c9c4a6');
      rect(ctx, 0, -3, 12, 5, Math.floor((state.elapsed || 0) * 6) % 2 ? '#c9c4a6' : '#577d98');
    }
    ctx.restore();
  }

  function drawEffects(state) {
    for (const effect of state.effects || []) {
      if (!inView(effect.x, effect.y)) continue;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (effect.life || 0.3) * 3);
      if (effect.kind === 'tracer') {
        line(ctx, effect.x, effect.y - 23, effect.toX ?? effect.x, (effect.toY ?? effect.y) - 23, effect.color || '#e8cf84', 2);
      } else {
        const value = hash(`${effect.x}-${effect.y}`);
        for (let i = 0; i < 7; i++) {
          const angle = i * Math.PI * 2 / 7 + value % 10;
          const radius = (1 - Math.min(1, effect.life || 0)) * 20 + 5;
          rect(ctx, effect.x + Math.cos(angle) * radius, effect.y + Math.sin(angle) * radius, 3, 3, effect.color || '#bd8c5c');
        }
      }
      ctx.restore();
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
      ctx.arc(event.x, event.y - 58 + pulse, 10, 0, Math.PI * 2);
      ctx.stroke();
      text(ctx, '!', event.x, event.y - 53 + pulse, 14, COLORS.ink, 'center');
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
    if (!mapBase || worldReference !== world || mapSeed !== world.seed) drawBase(world);
    const player = state.player;
    const now = performance.now();
    const delta = Math.min(0.1, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    interior = player.interior ? world.buildings.find(item => item.id === player.interior) : null;
    const inRoom = Boolean(interior);
    const driven = player.vehicleId ? (state.vehicles || []).find(item => item.id === player.vehicleId) : null;
    const focus = driven || player;
    const zoom = inRoom ? Math.min(1.15, viewport.width / 710, viewport.height / 570) : Math.min(1.1, Math.max(0.72, viewport.width / 1050));
    const room = interior?.room;
    const targetX = inRoom ? (room.width || 640) / 2 : focus.x + (driven ? Math.cos(driven.angle || 0) * Math.min(85, Math.abs(driven.speed || 0) * 0.12) : 0);
    const targetY = inRoom ? (room.height || 480) / 2 : focus.y - 28 + (driven ? Math.sin(driven.angle || 0) * Math.min(85, Math.abs(driven.speed || 0) * 0.12) : 0);
    const changedInterior = lastInterior !== player.interior;
    const smoothing = view.reducedMotion || firstFrame || changedInterior ? 1 : 1 - Math.exp(-delta * 8);
    camera.x += (targetX - camera.x) * smoothing;
    camera.y += (targetY - camera.y) * smoothing;
    camera.zoom = zoom;
    lastInterior = player.interior;
    firstFrame = false;
    ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
    rect(ctx, 0, 0, viewport.width, viewport.height, COLORS.sand);
    ctx.save();
    ctx.translate(Math.round(viewport.width / 2), Math.round(viewport.height / 2));
    ctx.scale(zoom, zoom);
    ctx.translate(-Math.round(camera.x), -Math.round(camera.y));
    if (inRoom) drawInterior(interior);
    else {
      ctx.drawImage(mapBase, 0, 0);
      for (const item of world.decorations || []) {
        if (!inView(item.x, item.y)) continue;
        if (item.kind === 'bench') bench(ctx, item.x, item.y);
        else if (item.kind === 'lamp') lamp(ctx, item.x, item.y, (state.time ?? 720) < 360 || (state.time ?? 720) > 1110);
        else if (item.kind === 'bin') {
          const sprite = assets.bin;
          if (!drawSprite(sprite, item.x, item.y, 1.2)) {
            rect(ctx, item.x - 8, item.y - 17, 16, 19, '#4f7260');
            rect(ctx, item.x - 10, item.y - 21, 20, 5, '#82947a');
          }
        }
      }
      // Each block has a little life outside its doorway.
      const time = (state.time ?? 720) % 1440;
      const nightAmount = time < 420 ? Math.min(1, (420 - time) / 90) : Math.max(0, Math.min(1, (time - 1080) / 120));
      if (nightAmount > 0) {
        ctx.save();
        ctx.globalAlpha = nightAmount;
        ctx.globalCompositeOperation = 'multiply';
        rect(ctx, camera.x - viewport.width / zoom, camera.y - viewport.height / zoom, viewport.width * 2 / zoom, viewport.height * 2 / zoom, '#b6c2b1');
        ctx.restore();
      }
    }
    const actors = (state.npcs || []).filter(actor => (actor.interior || null) === (player.interior || null));
    const drawables = actors.map(actor => ({ type: 'actor', value: actor, y: actor.y }));
    if (!inRoom) for (const vehicle of state.vehicles || []) drawables.push({ type: 'car', value: vehicle, y: vehicle.y + 25 });
    if (!player.vehicleId) drawables.push({ type: 'player', value: player, y: player.y });
    drawables.sort((a, b) => a.y - b.y);
    for (const item of drawables) {
      const selected = view.highlight?.id === item.value.id;
      if (item.type === 'car') drawCar(item.value, state, selected);
      else drawActor(item.value, state, item.type === 'player', selected);
    }
    drawEffects(state);
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
    // Fine etched frame, never a blur or a screen-covering noise texture.
    ctx.strokeStyle = '#f7efce66';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, viewport.width - 1, viewport.height - 1);
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
    const padding = full ? 20 : 5;
    const scale = Math.min((width - padding * 2) / world.width, (height - padding * 2) / world.height);
    const offsetX = (width - world.width * scale) / 2;
    const offsetY = (height - world.height * scale) / 2;
    rect(mapCtx, 0, 0, width, height, '#eee6c9');
    mapCtx.save();
    mapCtx.translate(offsetX, offsetY);
    mapCtx.scale(scale, scale);
    rect(mapCtx, 0, 0, world.width, world.height, '#c4c9a7');
    for (const park of world.parks || []) rect(mapCtx, park.x, park.y, park.w, park.h, '#8ba478');
    for (const x of world.roads?.vertical || []) rect(mapCtx, x - 46, 0, 92, world.height, '#ece2c5');
    for (const y of world.roads?.horizontal || []) rect(mapCtx, 0, y - 46, world.width, 92, '#ece2c5');
    for (const building of world.buildings || []) {
      const color = (BUILDING_COLORS[building.type] || BUILDING_COLORS.home)[2];
      rect(mapCtx, building.x, building.y, building.w, building.h, color);
      if (full) {
        text(mapCtx, ABBREVIATIONS[building.type] || '', building.x + building.w / 2, building.y + building.h / 2 + 10, 10 / scale, '#f7efd3', 'center');
      }
    }
    mapCtx.restore();
    function point(x, y) { return [offsetX + x * scale, offsetY + y * scale]; }
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
      const [x, y] = point(target.x, target.y);
      const size = full ? 12 : 8;
      line(mapCtx, x, y, x, y - size * 1.5, COLORS.ink, full ? 3 : 2);
      polygon(mapCtx, [[x, y - size * 1.55], [x + size, y - size * 1.17], [x, y - size * 0.8]], COLORS.ink);
      polygon(mapCtx, [[x + 1, y - size * 1.42], [x + size * .68, y - size * 1.17], [x + 1, y - size * .93]], COLORS.gold);
    }
    let playerX = state.player.x;
    let playerY = state.player.y;
    if (state.player.interior) {
      const building = world.buildings.find(item => item.id === state.player.interior);
      if (building) { playerX = building.door.x; playerY = building.door.y; }
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
        text(mapCtx, districtNames[i].toUpperCase(), width * cx, height * cy, 10, '#3d6257', 'center');
      }
    }
  }

  return { draw, drawMap, screenToWorld, ready };
}
