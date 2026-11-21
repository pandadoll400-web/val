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
    id: 'lake', name: '겨울 호수', en: 'WINTER LAKE',
    lead: '꽁꽁 얼어붙은 겨울 호수. 갈라지는 얼음 위로 숨 막히는 저격전이 펼쳐진다.<br />호숫가에 숨어든 적 7명을 모두 처치하라.',
    fog: '#c6d6e4', fogNear: 55, fogFar: 330,
    sky: { horizon: '#dfe9f2', warm: '#ffe6d0', mid: '#93aecb', top: '#3f5a7e', aurora: 0.25, stars: 0 },
    hemi: ['#eef6ff', '#5a6a80', 1.3], sun: ['#fff2e6', 2.3],
    cliff: ['#5f7a90', '#b8cfe0', '#f6faff'], cliffRough: 0.6,
    floor: ['#c9dceb', '#f4f9ff'], bank: ['#c9dceb', '#f4f9ff'], river: '#3f7fa8', riverRough: 0.05,
    block: { color: '#8a6a48', emissive: '#000000', emissiveIntensity: 0, roughness: 0.85, opacity: 1 },
    rock: '#9fb0be', crate: ['#8a6440', '#3b2a1a'], wall: '#7b5a3c', roof: '#e8f2fa',
    particles: { color: '#ffffff', size: 0.14, fall: 0.9, drift: 0.7, count: 1800 },
    prop: 'reed', pillar: 'pine', surface: 'snow', snowy: true,
  },
  camp: {
    id: 'camp', name: '캠핑장', en: 'CAMPSITE',
    lead: '모닥불이 타닥이는 여름밤의 캠핑장. 텐트 사이로 총성이 울린다.<br />캠핑장에 숨어든 적 7명을 모두 처치하라.',
    fog: '#5a4a6a', fogNear: 60, fogFar: 300, size: [50, 72],
    sky: { horizon: '#ffb98a', warm: '#ff7a3a', mid: '#6a4a8a', top: '#141634', aurora: 0, stars: 0.8 },
    hemi: ['#ffd8b8', '#2a3a2a', 1.05], sun: ['#ffb070', 2.0],
    cliff: ['#24331f', '#3f5a2e', '#6f8a4a'], cliffRough: 0.9,
    floor: ['#4f7a2c', '#7a9a3e'], bank: ['#4f7a2c', '#7a9a3e'], river: '#3f6f7a', riverRough: 0.1,
    block: { color: '#7a5a3a', emissive: '#000000', emissiveIntensity: 0, roughness: 0.85, opacity: 1 },
    rock: '#7a7a6e', crate: ['#8a6440', '#3b2a1a'], wall: '#7a5432', roof: '#4a2e1c',
    particles: { color: '#ffd27a', size: 0.11, fall: 0.1, drift: 0.5, count: 700, glow: true },
    prop: 'tree', pillar: 'tree', surface: 'grass',
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
// Christmas village: hack-only room map (never in THEME_ORDER / randomMap); uses the ice layout
THEMES.xmas = {
  id: 'xmas', name: '크리스마스 마을', en: 'CHRISTMAS VILLAGE',
  lead: '함박눈이 내리는 크리스마스 이브의 마을. 반짝이는 트리 사이로 총성이 울린다.<br />마을에 숨어든 적 7명을 모두 처치하라.',
  fog: '#33405e', fogNear: 50, fogFar: 300,
  sky: { horizon: '#5a6a9a', warm: '#ff9a7a', mid: '#2a3462', top: '#060a1e', aurora: 0.45, stars: 1 },
  hemi: ['#cfdcff', '#2a3048', 1.05], sun: ['#ffe2c8', 1.8],
  cliff: ['#3a4a6a', '#b8c8e0', '#f6faff'], cliffRough: 0.55,
  floor: ['#dfe9f4', '#ffffff'], bank: ['#dfe9f4', '#ffffff'], river: '#5a8ab8', riverRough: 0.05,
  block: { color: '#b02028', emissive: '#3a0008', emissiveIntensity: 0.25, roughness: 0.6, opacity: 1 },
  rock: '#c8d4e2', crate: ['#c0161f', '#ffd24a'], wall: '#a8202a', roof: '#ffffff',
  particles: { color: '#ffffff', size: 0.2, fall: 1.0, drift: 0.5, count: 2600 },
  prop: 'gift', pillar: 'xmasTree', surface: 'snow', snowy: true,
};
// v2.2 Persepolis: ancient palace terrace at sunset
THEMES.perse = {
  id: 'perse', name: '페르세폴리스', en: 'PERSEPOLIS',
  lead: '노을빛에 물든 고대 페르시아의 왕궁. 백 개의 기둥 사이로 총성이 울린다.<br />왕궁에 숨어든 적 7명을 모두 처치하라.',
  fog: '#e8b88a', fogNear: 60, fogFar: 330,
  sky: { horizon: '#ffc890', warm: '#ff8a4a', mid: '#b86a8a', top: '#3a2a6a', aurora: 0, stars: 0.15 },
  hemi: ['#ffe2c0', '#7a5a3a', 1.2], sun: ['#ffc890', 2.8],
  cliff: ['#8a5a3a', '#c89a6a', '#ecd0a0'], cliffRough: 0.9,
  floor: ['#cfa878', '#e8cc9a'], bank: ['#cfa878', '#e8cc9a'], river: '#c8a070', riverRough: 0.9,
  block: { color: '#d8c0a0', emissive: '#000000', emissiveIntensity: 0, roughness: 0.85, opacity: 1 },
  rock: '#c8a47a', crate: ['#8a5a32', '#3a2414'], wall: '#d8c0a0', roof: '#a88a62',
  particles: { color: '#ffd890', size: 0.08, fall: 0.15, drift: 1.6, count: 1100, glow: true },
  prop: 'urn', pillar: 'palm', surface: 'sand',
};
THEMES.ice.surface = 'snow'; THEMES.ice.wall = '#e8f4ff'; THEMES.ice.roof = '#cfe6f7';
THEMES.forest.surface = 'grass'; THEMES.forest.wall = '#6b4a2e'; THEMES.forest.roof = '#3c2a1c';
THEMES.honey.surface = 'grass'; THEMES.honey.wall = '#c98a3a'; THEMES.honey.roof = '#7a4a1a';
export const THEME_ORDER = ['ice', 'forest', 'honey', 'lake', 'desert', 'camp', 'perse'];
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
  const m = mat('reed', { color: '#a08a5a', roughness: 0.9 }), top = mat('reedTop', { color: '#5a3a1e', roughness: 0.9 });
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
export function makePine(rng, scale = 1, snowy = false) {
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
    if (snowy) {
      // snow cap on every layer
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.78, h * 0.42, 9), mat('pineSnow', { color: '#f4f9ff', roughness: 0.7, flatShading: true }));
      cap.position.y = cone.position.y + h * 0.3;
      cap.rotation.y = cone.rotation.y;
      g.add(cap);
    }
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

/** decorated Christmas tree: snowy pine + blinking light bulbs, ornaments and a star (scale 1 ≈ 8 m) */
export function makeXmasTree(rng, scale = 1) {
  const g = makePine(rng, scale, true);
  const cols = ['#ff3a4a', '#ffd24a', '#3a8aff', '#3adf6a', '#ff8fd0'];
  for (let i = 0; i < 26; i++) {
    const lvl = i % 5, r = (1.15 - lvl * 0.2) * scale * 0.9, a = i * 2.39;
    const y = 2.4 * scale * 0.6 + lvl * 0.95 * scale + 0.2 * scale;
    const c = cols[i % cols.length];
    const m = new THREE.Mesh(new THREE.SphereGeometry((i % 2 ? 0.09 : 0.13) * scale, 8, 6),
      i % 2 ? mat('bulb' + c, { color: c, emissive: c, emissiveIntensity: 2.2 }) : mat('orn' + c, { color: c, metalness: 0.8, roughness: 0.15 }));
    m.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    g.add(m);
  }
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, rr = (i % 2 ? 0.16 : 0.36) * scale; if (i) s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  const star = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.1 * scale, bevelEnabled: false }), mat('xstar', { color: '#ffd24a', emissive: '#ffb000', emissiveIntensity: 1.8, metalness: 0.5, roughness: 0.3 }));
  star.position.y = 2.4 * scale * 0.6 + 5 * 0.95 * scale + 0.6 * scale;
  g.add(star);
  return g;
}

/** presents, candy canes and a little snowman */
export function makeGiftProp(rng, scale = 1) {
  const g = new THREE.Group();
  const pick = rng();
  if (pick < 0.5) {
    const cols = ['#d0202a', '#1f8a3a', '#2a6ad8', '#ffd24a', '#8a3ad8'];
    for (let i = 0; i < 3; i++) {
      const w = (0.35 + rng() * 0.3) * scale, h = (0.3 + rng() * 0.3) * scale;
      const c = cols[Math.floor(rng() * cols.length)];
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat('gift' + c, { color: c, roughness: 0.5 }));
      b.position.set((i - 1) * 0.45 * scale, h / 2, (rng() - 0.5) * 0.4 * scale);
      b.rotation.y = rng();
      const rib = mat('giftRib', { color: '#ffd24a', metalness: 0.7, roughness: 0.3 });
      b.add(new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, h * 1.02, w * 0.16), rib), new THREE.Mesh(new THREE.BoxGeometry(w * 0.16, h * 1.02, w * 1.02), rib));
      b.castShadow = true;
      g.add(b);
    }
  } else if (pick < 0.75) {
    const red = mat('caneR', { color: '#d81e2a', roughness: 0.35 }), white = mat('caneW', { color: '#ffffff', roughness: 0.35 });
    for (let i = 0; i < 2; i++) {
      const h = 1.1 * scale;
      for (let k = 0; k < 8; k++) {
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * scale, 0.05 * scale, h / 8, 8), k % 2 ? red : white);
        seg.position.set(i * 0.5 * scale, (k + 0.5) * h / 8, 0);
        g.add(seg);
      }
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.14 * scale, 0.05 * scale, 8, 12, Math.PI), red);
      hook.position.set(i * 0.5 * scale - 0.14 * scale, h, 0);
      g.add(hook);
    }
  } else {
    const snow = mat('snowman', { color: '#f6faff', roughness: 0.8 }), coal = mat('coal', { color: '#141414' });
    for (const [r, y] of [[0.45, 0.4], [0.32, 1.05], [0.22, 1.5]]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(r * scale, 12, 10), snow);
      b.position.y = y * scale; b.castShadow = true;
      g.add(b);
    }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.05 * scale, 0.25 * scale, 8), mat('carrot', { color: '#ff8a1a' }));
    nose.rotation.x = Math.PI / 2; nose.position.set(0, 1.5 * scale, 0.3 * scale);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * scale, 0.16 * scale, 0.3 * scale, 12), coal);
    hat.position.y = 1.82 * scale;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.26 * scale, 0.26 * scale, 0.03 * scale, 12), coal);
    brim.position.y = 1.68 * scale;
    g.add(nose, hat, brim);
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.03 * scale, 6, 4), coal); e.position.set(sx * 0.08 * scale, 1.58 * scale, 0.19 * scale); g.add(e); }
  }
  return g;
}

/** clay amphora with a painted band (Persepolis) */
export function makeUrn(rng, scale = 1) {
  const g = new THREE.Group();
  const clay = mat('urnClay', { color: '#b8643a', roughness: 0.75 }), band = mat('urnBand', { color: '#1f3fa8', roughness: 0.5 });
  const pts = [[0, 0], [0.12, 0.02], [0.2, 0.18], [0.22, 0.32], [0.16, 0.5], [0.08, 0.6], [0.1, 0.66]].map(([x, y]) => new THREE.Vector2(x * scale, y * scale));
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), clay);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.222 * scale, 0.222 * scale, 0.05 * scale, 14, 1, true), band);
  ring.position.y = 0.3 * scale;
  body.castShadow = true;
  g.add(body, ring);
  g.rotation.z = rng() < 0.2 ? 1.4 : 0; // a few lie on their side
  if (g.rotation.z) g.position.y = 0.2 * scale;
  return g;
}

/** small decorative prop for a theme (no collision) */
export function makeThemeProp(theme, rng, s = 1) {
  switch (theme.prop) {
    case 'tree': return rng() < 0.5 ? makeMushroom(rng, s) : makeBush(rng, s * 0.7);
    case 'flower': return rng() < 0.75 ? makeFlowers(rng, s) : makeHiveBox(rng, s * 0.8);
    case 'reed': return rng() < 0.6 ? makeReeds(rng, s) : makeBush(rng, s * 0.6);
    case 'cactus': return rng() < 0.7 ? makeCactus(rng, s * 0.7) : makeBush(rng, s * 0.5);
    case 'gift': return makeGiftProp(rng, s);
    case 'urn': return rng() < 0.6 ? makeUrn(rng, s) : makeCactus(rng, s * 0.5);
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
  if (id === 'desert' || id === 'perse') {
    // wind ripples
    for (let y = 0; y < S; y += 9) {
      g.strokeStyle = `rgba(150,105,50,${0.10 + rnd() * 0.08})`; g.lineWidth = 2.5;
      g.beginPath();
      for (let x = 0; x <= S; x += 8) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 3);
      g.stroke();
    }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(120,80,40,${rnd() * 0.25})`; g.fillRect(rnd() * S, rnd() * S, 1.5, 1.5); }
  } else if (id === 'ice' || id === 'lake' || id === 'xmas') {
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
