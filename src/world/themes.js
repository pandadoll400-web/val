import * as THREE from 'three';

/**
 * Map themes. All three maps share the same collision layout (fair online play, same spawns);
 * colours, materials, props and particles differ.
 */
export const THEMES = {
  ice: {
    id: 'ice', name: '얼음 협곡', en: 'FROST CANYON',
    lead: '오로라가 일렁이는 영원한 겨울의 협곡에 총성이 울린다.<br />협곡에 숨어든 적 7명을 모두 처치하라.',
    fog: '#9eb3d9', fogNear: 70, fogFar: 380,
    sky: { horizon: '#9eb3d9', warm: '#faa885', mid: '#5261a8', top: '#0a122e', aurora: 1, stars: 1 },
    hemi: ['#cfe6ff', '#34496b', 1.15], sun: ['#ffd9bd', 2.6],
    cliff: ['#2a6c9c', '#9fd6f2', '#f3f8ff'], cliffRough: 0.32,
    floor: ['#9fcbe6', '#eef5fc'], bank: ['#a9cfe8', '#eef6ff'], river: '#8ccbec', riverRough: 0.06,
    block: { color: '#a9dcf5', emissive: '#0d3b5e', emissiveIntensity: 0.35, roughness: 0.12, opacity: 0.92 },
    rock: '#d4ebf8', crate: ['#7a5636', '#3d2c1e'],
    particles: { color: '#ffffff', size: 0.16, fall: 1.2, drift: 0.6, count: 2200 },
    prop: 'crystal', pillar: 'ice',
  },
  forest: {
    id: 'forest', name: '깊은 숲속', en: 'DEEP FOREST',
    lead: '빛조차 길을 잃는 울창한 숲. 반딧불 사이로 적의 발소리가 들린다.<br />숲에 숨어든 적 7명을 모두 처치하라.',
    fog: '#5d7a66', fogNear: 30, fogFar: 230,
    sky: { horizon: '#9cc4a8', warm: '#ffd59a', mid: '#2f5a4a', top: '#06140f', aurora: 0, stars: 0.35 },
    hemi: ['#d6f0c8', '#2a3520', 1.0], sun: ['#ffe6b0', 1.9],
    cliff: ['#2b3a26', '#4f6b3a', '#7f9a52'], cliffRough: 0.85,
    floor: ['#4a6b2c', '#6f8f3a'], bank: ['#3f5a28', '#6a8a3c'], river: '#3f6f6a', riverRough: 0.15,
    block: { color: '#6d7a62', emissive: '#1c2a14', emissiveIntensity: 0.2, roughness: 0.95, opacity: 1 },
    rock: '#6f7a5e', crate: ['#5e4027', '#2c1e12'],
    particles: { color: '#c8ff6a', size: 0.12, fall: 0.15, drift: 0.5, count: 900, glow: true },
    prop: 'tree', pillar: 'tree',
  },
  honey: {
    id: 'honey', name: '벌꿀 사냥터', en: 'HONEY HUNT',
    lead: '황금빛 꿀이 흐르는 벌집 골짜기. 달콤한 향기 뒤에 총구가 숨어 있다.<br />사냥터에 숨어든 적 7명을 모두 처치하라.',
    fog: '#e8b77a', fogNear: 60, fogFar: 360,
    sky: { horizon: '#ffcf8a', warm: '#ff9a4a', mid: '#c25a6a', top: '#2a1238', aurora: 0, stars: 0.2 },
    hemi: ['#ffe2b8', '#6b4a2a', 1.2], sun: ['#ffb36b', 2.6],
    cliff: ['#9a5a22', '#d99a4a', '#f6d38a'], cliffRough: 0.7,
    floor: ['#8fa83a', '#c2c84a'], bank: ['#9aa83a', '#d8c45a'], river: '#f2a516', riverRough: 0.1,
    block: { color: '#f5b52e', emissive: '#a35a00', emissiveIntensity: 0.45, roughness: 0.25, opacity: 0.88, honeycomb: true },
    rock: '#d9a55a', crate: ['#c98a3a', '#5a3a16'],
    particles: { color: '#ffe27a', size: 0.1, fall: 0.25, drift: 0.9, count: 1100, glow: true },
    prop: 'flower', pillar: 'hive',
  },
  lake: {
    id: 'lake', name: '거울 호수', en: 'MIRROR LAKE',
    lead: '하늘을 비추는 고요한 호수. 잔물결 위로 숨 막히는 저격전이 펼쳐진다.<br />호숫가에 숨어든 적 7명을 모두 처치하라.',
    fog: '#b9d4e2', fogNear: 70, fogFar: 400,
    sky: { horizon: '#d6ecf6', warm: '#fff0c8', mid: '#76b2e0', top: '#2a62a8', aurora: 0, stars: 0 },
    hemi: ['#eaf6ff', '#3d5a3a', 1.25], sun: ['#fff4de', 2.9],
    cliff: ['#3a5446', '#6d8c68', '#cfdcc4'], cliffRough: 0.85,
    floor: ['#557f34', '#86a84c'], bank: ['#5f8a3a', '#a8bf74'], river: '#4f9fcc', riverRough: 0.05,
    block: { color: '#8a6a48', emissive: '#000000', emissiveIntensity: 0, roughness: 0.85, opacity: 1 },
    rock: '#8f9a94', crate: ['#8a6440', '#3b2a1a'], wall: '#7b5a3c', roof: '#3f5f7a',
    particles: { color: '#ffffff', size: 0.08, fall: 0.12, drift: 0.8, count: 500 },
    prop: 'reed', pillar: 'pine', surface: 'grass',
  },
  desert: {
    id: 'desert', name: '모래 요새', en: 'DUNE FORT',
    lead: '태양이 모든 것을 태우는 사막의 요새 마을. 흙벽 건물 안팎이 전장이다.<br />요새에 숨어든 적 7명을 모두 처치하라.',
    fog: '#ecd3a2', fogNear: 60, fogFar: 340,
    sky: { horizon: '#f6dfb0', warm: '#ffb070', mid: '#86b6da', top: '#2a68a6', aurora: 0, stars: 0 },
    hemi: ['#fff2d8', '#8a6a3a', 1.25], sun: ['#fff0d0', 3.1],
    cliff: ['#9c5e34', '#d29e62', '#f2d6a0'], cliffRough: 0.92,
    floor: ['#d2ae72', '#efd8a2'], bank: ['#d2ae72', '#efd8a2'], river: '#cfa86a', riverRough: 0.9,
    block: { color: '#cfa36a', emissive: '#000000', emissiveIntensity: 0, roughness: 0.95, opacity: 1 },
    rock: '#c89a62', crate: ['#9a6a3a', '#4a3018'], wall: '#d8b27a', roof: '#b98a52',
    particles: { color: '#f2dcae', size: 0.07, fall: 0.25, drift: 3.2, count: 1600 },
    prop: 'cactus', pillar: 'palm', surface: 'sand',
  },
};
THEMES.ice.surface = 'snow'; THEMES.ice.wall = '#e8f4ff'; THEMES.ice.roof = '#cfe6f7';
THEMES.forest.surface = 'grass'; THEMES.forest.wall = '#6b4a2e'; THEMES.forest.roof = '#3c2a1c';
THEMES.honey.surface = 'grass'; THEMES.honey.wall = '#c98a3a'; THEMES.honey.roof = '#7a4a1a';
export const THEME_ORDER = ['ice', 'forest', 'honey', 'lake', 'desert'];
export const getTheme = (id) => THEMES[id] || THEMES.ice;
export const randomMap = () => THEME_ORDER[Math.floor(Math.random() * THEME_ORDER.length)];

/* ---------- honeycomb texture ---------- */
let combTex = null;
export function honeycombTexture() {
  if (combTex) return combTex;
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#f5b52e'; g.fillRect(0, 0, S, S);
  const r = 22, h = Math.sqrt(3) * r;
  g.lineWidth = 5; g.strokeStyle = '#8a4a08';
  for (let row = -1; row < S / h + 2; row++) {
    for (let col = -1; col < S / (r * 1.5) + 2; col++) {
      const x = col * r * 1.5, y = row * h + (col % 2 ? h / 2 : 0);
      g.beginPath();
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
      g.closePath();
      g.fillStyle = `rgba(255,${200 + Math.floor(Math.random() * 40)},80,${0.25 + Math.random() * 0.3})`;
      g.fill(); g.stroke();
    }
  }
  combTex = new THREE.CanvasTexture(c);
  combTex.colorSpace = THREE.SRGBColorSpace;
  combTex.wrapS = combTex.wrapT = THREE.RepeatWrapping;
  return combTex;
}

/* ---------- shared prop materials ---------- */
const M = {};
const mat = (key, opts) => (M[key] ||= Object.assign(new THREE.MeshStandardMaterial(opts), { _shared: true }));

/** forest tree: trunk + stacked cones (scale 1 ≈ 6 m tall) */
export function makeTree(rng, scale = 1) {
  const g = new THREE.Group();
  const trunkH = (2.2 + rng() * 1.2) * scale;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * scale, 0.26 * scale, trunkH, 7), mat('trunk', { color: '#4a3220', roughness: 0.95, flatShading: true }));
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  g.add(trunk);
  const leaf = mat(rng() < 0.5 ? 'leafA' : 'leafB', rng() < 0.5 ? { color: '#2f5a2a', roughness: 0.9, flatShading: true } : { color: '#3d6e2e', roughness: 0.9, flatShading: true });
  for (let i = 0; i < 3; i++) {
    const r = (1.5 - i * 0.38) * scale, h = (2.1 - i * 0.3) * scale;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), leaf);
    cone.position.y = trunkH * 0.75 + i * h * 0.55 + h / 2;
    cone.rotation.y = rng() * 3;
    cone.castShadow = true;
    g.add(cone);
  }
  return g;
}

export function makeMushroom(rng, scale = 1) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * scale, 0.12 * scale, 0.5 * scale, 8), mat('stem', { color: '#efe6cf', roughness: 0.8 }));
  stem.position.y = 0.25 * scale;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.32 * scale, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    mat(rng() < 0.5 ? 'capR' : 'capP', rng() < 0.5 ? { color: '#c8322a', roughness: 0.6 } : { color: '#8a4cc8', roughness: 0.5, emissive: '#3a1a66', emissiveIntensity: 0.6 }));
  cap.position.y = 0.48 * scale;
  g.add(stem, cap);
  return g;
}

export function makeBush(rng, scale = 1) {
  const g = new THREE.Group();
  const m = mat('bush', { color: '#3f6a2c', roughness: 0.95, flatShading: true });
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry((0.4 + rng() * 0.3) * scale, 0), m);
    s.position.set((rng() - 0.5) * scale, 0.3 * scale, (rng() - 0.5) * scale);
    g.add(s);
  }
  return g;
}

export function makeFlowers(rng, scale = 1) {
  const g = new THREE.Group();
  const cols = ['#ff4d6d', '#ffd23f', '#b47bff', '#ff8fd0', '#ffffff'];
  const stemM = mat('fstem', { color: '#4f8a2a', roughness: 0.9 });
  for (let i = 0; i < 6; i++) {
    const h = (0.35 + rng() * 0.45) * scale;
    const x = (rng() - 0.5) * 1.4 * scale, z = (rng() - 0.5) * 1.4 * scale;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015 * scale, 0.015 * scale, h, 4), stemM);
    stem.position.set(x, h / 2, z);
    const c = cols[Math.floor(rng() * cols.length)];
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09 * scale, 0), mat('fl' + c, { color: c, roughness: 0.5, emissive: c, emissiveIntensity: 0.15 }));
    head.position.set(x, h, z);
    head.scale.y = 0.5;
    g.add(stem, head);
  }
  return g;
}

/** honeycomb tower: a cluster of hexagonal prisms (scale 1 ≈ 10 m tall) */
export function makeHive(rng, scale = 1) {
  const g = new THREE.Group();
  const m = mat('hive', { color: '#f2b02a', emissive: '#8a4a00', emissiveIntensity: 0.4, roughness: 0.35, map: honeycombTexture() });
  const n = 5 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const h = (3 + rng() * 8) * scale, r = (0.45 + rng() * 0.25) * scale;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 6), m);
    const a = (i / n) * Math.PI * 2;
    const d = i === 0 ? 0 : 0.55 * scale;
    p.position.set(Math.cos(a) * d, h / 2, Math.sin(a) * d);
    p.castShadow = true;
    g.add(p);
  }
  // drip of honey on top
  const drip = new THREE.Mesh(new THREE.SphereGeometry(0.35 * scale, 10, 8), mat('honeyDrop', { color: '#ffb000', emissive: '#c56a00', emissiveIntensity: 0.6, roughness: 0.1, transparent: true, opacity: 0.9 }));
  drip.position.y = 2.2 * scale;
  drip.position.x = 0.6 * scale;
  g.add(drip);
  return g;
}

export function makeHiveBox(rng, scale = 1) {
  const g = new THREE.Group();
  const wood = mat('hivebox', { color: '#d79a3e', roughness: 0.7 });
  const stripe = mat('hivestripe', { color: '#5a3a16', roughness: 0.8 });
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.9 * scale, 0.32 * scale, 0.7 * scale), i % 2 ? stripe : wood);
    b.position.y = 0.16 * scale + i * 0.33 * scale;
    g.add(b);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.05 * scale, 0.08 * scale, 0.85 * scale), stripe);
  roof.position.y = 1.03 * scale;
  g.add(roof);
  return g;
}

/* ---------- lake / desert props ---------- */
export function makeReeds(rng, scale = 1) {
  const g = new THREE.Group();
  const m = mat('reed', { color: '#6f8a3a', roughness: 0.9 }), top = mat('reedTop', { color: '#6a4a2a', roughness: 0.9 });
  for (let i = 0; i < 9; i++) {
    const h = (0.9 + rng() * 0.9) * scale;
    const x = (rng() - 0.5) * 1.2 * scale, z = (rng() - 0.5) * 1.2 * scale;
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.012 * scale, 0.02 * scale, h, 4), m);
    s.position.set(x, h / 2, z);
    s.rotation.set((rng() - 0.5) * 0.25, 0, (rng() - 0.5) * 0.25);
    g.add(s);
    if (rng() < 0.6) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * scale, 0.04 * scale, 0.22 * scale, 6), top);
      c.position.set(x, h, z);
      g.add(c);
    }
  }
  return g;
}

/** lake pine: tall slim conifer (scale 1 ≈ 8 m) */
export function makePine(rng, scale = 1) {
  const g = new THREE.Group();
  const trunkH = 2.4 * scale;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * scale, 0.24 * scale, trunkH, 7), mat('trunk2', { color: '#5a3b26', roughness: 0.95, flatShading: true }));
  trunk.position.y = trunkH / 2; trunk.castShadow = true;
  g.add(trunk);
  const leaf = mat('pineLeaf', { color: '#244d34', roughness: 0.9, flatShading: true });
  for (let i = 0; i < 5; i++) {
    const r = (1.25 - i * 0.2) * scale, h = 1.5 * scale;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 9), leaf);
    cone.position.y = trunkH * 0.6 + i * 0.95 * scale + h / 2;
    cone.rotation.y = rng() * 3;
    cone.castShadow = true;
    g.add(cone);
  }
  return g;
}

export function makeCactus(rng, scale = 1) {
  const g = new THREE.Group();
  const m = mat('cactus', { color: '#4f8a3a', roughness: 0.75, flatShading: true });
  const h = (1.6 + rng() * 1.4) * scale;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * scale, 0.26 * scale, h, 8), m);
  body.position.y = h / 2; body.castShadow = true;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22 * scale, 8, 6), m);
  cap.position.y = h;
  g.add(body, cap);
  for (const side of [-1, 1]) {
    if (rng() < 0.3) continue;
    const ah = (0.5 + rng() * 0.6) * scale, y = h * (0.35 + rng() * 0.3);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * scale, 0.14 * scale, 0.45 * scale, 7), m);
    arm.rotation.z = Math.PI / 2; arm.position.set(side * 0.38 * scale, y, 0);
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * scale, 0.14 * scale, ah, 7), m);
    up.position.set(side * 0.58 * scale, y + ah / 2, 0);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.13 * scale, 7, 5), m);
    tip.position.set(side * 0.58 * scale, y + ah, 0);
    g.add(arm, up, tip);
  }
  if (rng() < 0.5) {
    const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08 * scale, 0), mat('cactusFl', { color: '#ff6fa8', emissive: '#ff3f88', emissiveIntensity: 0.3 }));
    fl.position.y = h + 0.18 * scale;
    g.add(fl);
  }
  return g;
}

/** desert palm (scale 1 ≈ 7 m) */
export function makePalm(rng, scale = 1) {
  const g = new THREE.Group();
  const tm = mat('palmTrunk', { color: '#8a6440', roughness: 0.95, flatShading: true });
  const segs = 7, lean = (rng() - 0.5) * 0.5;
  let x = 0, y = 0;
  for (let i = 0; i < segs; i++) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.17 * scale, 0.22 * scale, 0.9 * scale, 7), tm);
    s.position.set(x, y + 0.45 * scale, 0);
    s.rotation.z = -lean * (i / segs);
    s.castShadow = true;
    g.add(s);
    y += 0.88 * scale; x += lean * 0.12 * scale * i / segs * 3;
  }
  const lm = mat('palmLeaf', { color: '#3f7a2e', roughness: 0.8, side: THREE.DoubleSide, flatShading: true });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + rng() * 0.3;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.35 * scale, 2.8 * scale, 4, 1, true), lm);
    leaf.scale.z = 0.25;
    leaf.geometry.translate(0, 1.4 * scale, 0);
    leaf.position.set(x, y, 0);
    leaf.rotation.set(0, -a, 1.25 + rng() * 0.35, 'YXZ');
    leaf.castShadow = true;
    g.add(leaf);
  }
  const nut = mat('coconut', { color: '#5a3a1e', roughness: 0.7 });
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.14 * scale, 7, 5), nut);
    c.position.set(x + Math.cos(i * 2.1) * 0.22 * scale, y - 0.15 * scale, Math.sin(i * 2.1) * 0.22 * scale);
    g.add(c);
  }
  return g;
}

/** small decorative prop for a theme (no collision) */
export function makeThemeProp(theme, rng, s = 1) {
  switch (theme.prop) {
    case 'tree': return rng() < 0.5 ? makeMushroom(rng, s) : makeBush(rng, s * 0.7);
    case 'flower': return rng() < 0.75 ? makeFlowers(rng, s) : makeHiveBox(rng, s * 0.8);
    case 'reed': return rng() < 0.6 ? makeReeds(rng, s) : makeFlowers(rng, s * 0.8);
    case 'cactus': return rng() < 0.7 ? makeCactus(rng, s * 0.7) : makeBush(rng, s * 0.5);
    default: return null;
  }
}

/* ---------- floor detail texture (multiplied over the vertex colours) ---------- */
const detailCache = {};
export function floorDetailTexture(id) {
  if (detailCache[id]) return detailCache[id];
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  if (id === 'desert') {
    // wind ripples
    for (let y = 0; y < S; y += 9) {
      g.strokeStyle = `rgba(150,105,50,${0.10 + rnd() * 0.08})`; g.lineWidth = 2.5;
      g.beginPath();
      for (let x = 0; x <= S; x += 8) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 3);
      g.stroke();
    }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(120,80,40,${rnd() * 0.25})`; g.fillRect(rnd() * S, rnd() * S, 1.5, 1.5); }
  } else if (id === 'ice') {
    for (let i = 0; i < 1400; i++) { const v = 200 + rnd() * 55; g.fillStyle = `rgba(${v - 30},${v - 10},${v},${0.25 + rnd() * 0.3})`; g.fillRect(rnd() * S, rnd() * S, 2, 2); }
    for (let i = 0; i < 14; i++) { g.strokeStyle = 'rgba(120,170,210,0.25)'; g.lineWidth = 1; g.beginPath(); let x = rnd() * S, y = rnd() * S; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 40; y += (rnd() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
  } else {
    // grass blades / clover
    for (let i = 0; i < 2600; i++) {
      const x = rnd() * S, y = rnd() * S, l = 3 + rnd() * 6;
      g.strokeStyle = rnd() < 0.5 ? `rgba(30,60,10,${0.18 + rnd() * 0.22})` : `rgba(230,255,170,${0.10 + rnd() * 0.2})`;
      g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 3, y - l); g.stroke();
    }
    if (id === 'honey') for (let i = 0; i < 60; i++) { g.fillStyle = ['#ffd23f', '#ff8fd0', '#ffffff'][i % 3]; g.beginPath(); g.arc(rnd() * S, rnd() * S, 1.6, 0, 7); g.fill(); }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return (detailCache[id] = tex);
}
