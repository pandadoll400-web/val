import * as THREE from 'three';
import { mulberry32 } from '../util/noise.js';
import { makeTree, makeMushroom, makeBush, makeFlowers, makeHive, makeHiveBox, makeReeds, makePine, makeCactus, makePalm, makeUrn, honeycombTexture } from './themes.js';

/**
 * Per-map layouts. Every map has its own structure (online play is fine: everyone loads meta.map).
 * Playfield: x ∈ [-34, 34], z ∈ [-84, 84]. Team A spawns south (+z), B north (−z), C (free-for-all) east.
 * Builders here only use the world's add* helpers so collision / line of sight / bullets all work.
 */

const shared = {};
const smat = (key, opts) => (shared[key] ||= Object.assign(new THREE.MeshStandardMaterial(opts), { _shared: true }));

/* ---------------- textures ---------------- */
function brickTexture(base, line, w = 6, h = 4, jitter = 18) {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = line; g.fillRect(0, 0, S, S);
  const bw = S / w, bh = S / h;
  const b = new THREE.Color(base);
  for (let r = 0; r < h; r++) {
    for (let k = -1; k < w + 1; k++) {
      const x = k * bw + (r % 2 ? bw / 2 : 0);
      const v = (Math.random() - 0.5) * jitter / 255;
      g.fillStyle = `rgb(${Math.round((b.r + v) * 255)},${Math.round((b.g + v) * 255)},${Math.round((b.b + v) * 255)})`;
      g.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function plankTexture(base) {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const b = new THREE.Color(base);
  for (let i = 0; i < 8; i++) {
    const v = (Math.random() - 0.5) * 0.12;
    g.fillStyle = `rgb(${Math.round((b.r + v) * 255)},${Math.round((b.g + v) * 255)},${Math.round((b.b + v) * 255)})`;
    g.fillRect(0, i * 32, S, 32);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, i * 32, S, 2);
    for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(Math.random() * S, i * 32 + 6 + Math.random() * 20, 40 + Math.random() * 60, 1.5); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function waterNormalTexture() {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const a = (x / S) * Math.PI * 2, b = (y / S) * Math.PI * 2;
      const nx = Math.cos(a * 3 + Math.sin(b * 2) * 1.5) * 0.5 + Math.cos(a * 7 + b * 5) * 0.25;
      const ny = Math.cos(b * 4 + Math.sin(a * 3) * 1.2) * 0.5 + Math.sin(b * 9 - a * 4) * 0.25;
      const i = (y * S + x) * 4;
      img.data[i] = 128 + nx * 90; img.data[i + 1] = 128 + ny * 90; img.data[i + 2] = 255; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* ---------------- generic builders ---------------- */
/** a box that is cover + collider; tex repeat scales to the box size */
function box(w, x, y, z, sx, sy, sz, mat) { return w.addBlock(x, y, z, sx, sy, sz, mat); }

/**
 * Enterable building: 4 walls (door + window holes), flat walkable roof, optional parapet and outside stairs.
 * door/windows: sides 's' (+z), 'n' (−z), 'e' (+x), 'w' (−x).
 */
export function addHouse(w, x, z, W, D, H, opts = {}) {
  const T = 0.35;
  const wall = opts.wallMat, roofM = opts.roofMat || wall;
  const door = opts.door || 's';
  const doors = Array.isArray(door) ? door : [door];
  const windows = opts.windows ?? ['e', 'w', 'n', 's'].filter((s) => !doors.includes(s));
  const DW = 1.7, DH = 2.35, WW = 1.3, WY0 = 1.15, WY1 = 2.05;
  const sides = {
    s: { len: W, cx: x, cz: z + D / 2 - T / 2, alongX: true },
    n: { len: W, cx: x, cz: z - D / 2 + T / 2, alongX: true },
    e: { len: D, cx: x + W / 2 - T / 2, cz: z, alongX: false },
    w: { len: D, cx: x - W / 2 + T / 2, cz: z, alongX: false },
  };
  for (const [key, s] of Object.entries(sides)) {
    const holes = [];
    if (doors.includes(key)) holes.push({ c: 0, w: DW, y0: 0, y1: DH });
    if (windows.includes(key)) {
      const off = doors.includes(key) ? s.len * 0.3 : 0;
      if (off) { holes.push({ c: -off, w: WW, y0: WY0, y1: WY1 }); holes.push({ c: off, w: WW, y0: WY0, y1: WY1 }); }
      else if (s.len > 6) { holes.push({ c: -s.len * 0.25, w: WW, y0: WY0, y1: WY1 }); holes.push({ c: s.len * 0.25, w: WW, y0: WY0, y1: WY1 }); }
      else holes.push({ c: 0, w: WW, y0: WY0, y1: WY1 });
    }
    holes.sort((a, b) => a.c - b.c);
    const seg = (a, b, y0, y1) => {
      const L = b - a;
      if (L < 0.05 || y1 - y0 < 0.05) return;
      const c = (a + b) / 2;
      if (s.alongX) box(w, s.cx + c, y0, s.cz, L, y1 - y0, T, wall);
      else box(w, s.cx, y0, s.cz + c, T, y1 - y0, L, wall);
    };
    let cur = -s.len / 2;
    for (const h of holes) {
      seg(cur, h.c - h.w / 2, 0, H);
      seg(h.c - h.w / 2, h.c + h.w / 2, 0, h.y0);
      seg(h.c - h.w / 2, h.c + h.w / 2, h.y1, H);
      cur = h.c + h.w / 2;
    }
    seg(cur, s.len / 2, 0, H);
  }
  // roof slab (walkable)
  const roof = box(w, x, H, z, W + 0.3, 0.3, D + 0.3, roofM);
  roof.userData.roof = true;
  // interior floor rug
  if (opts.rug) {
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.5, D * 0.45), smat('rug' + opts.rug, { color: opts.rug, roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(x, 0.02, z);
    w.scene.add(rug);
  }
  // interior light glow so the inside is not pitch dark
  const lamp = new THREE.PointLight(opts.lamp || '#ffcf8a', 30, Math.max(W, D) * 1.4, 1.2);
  lamp.position.set(x, H - 0.5, z);
  w.scene.add(lamp);
  const st = opts.stairs;
  if (opts.parapet) {
    // low wall around the roof, with a gap where the outside stairs arrive
    const P = 0.7, t = 0.25, y = H + 0.3, gap = 3.2;
    const wallX = (zc, len) => box(w, x, y, zc, len, P, t, wall);
    if (st === 's') { box(w, x + gap / 2, y, z + D / 2, W + 0.3 - gap, P, t, wall); } else wallX(z + D / 2, W + 0.3);
    if (st === 'n') { box(w, x - gap / 2, y, z - D / 2, W + 0.3 - gap, P, t, wall); } else wallX(z - D / 2, W + 0.3);
    if (st === 'w') box(w, x - W / 2, y, z - gap / 2, t, P, D + 0.3 - gap, wall); else box(w, x - W / 2, y, z, t, P, D + 0.3, wall);
    if (st === 'e') box(w, x + W / 2, y, z + gap / 2, t, P, D + 0.3 - gap, wall); else box(w, x + W / 2, y, z, t, P, D + 0.3, wall);
  }
  if (st) {
    // outside stairs that end right next to the roof edge (gap in the parapet)
    const n = Math.ceil((H + 0.3) / 0.45), L = st === 'e' || st === 'w' ? D : W, d = Math.min(0.9, (L - 1) / n);
    for (let i = 0; i < n; i++) {
      const h = Math.min(H + 0.3, (i + 1) * 0.45), o = -L / 2 + d / 2 + i * d;
      if (st === 'w') box(w, x - W / 2 - 0.85, 0, z + o, 1.5, h, d, wall);          // rises toward +z
      else if (st === 'e') box(w, x + W / 2 + 0.85, 0, z - o, 1.5, h, d, wall);     // rises toward −z
      else if (st === 's') box(w, x - o, 0, z + D / 2 + 0.85, d, h, 1.5, wall);     // rises toward −x
      else box(w, x + o, 0, z - D / 2 - 0.85, d, h, 1.5, wall);                     // rises toward +x
    }
  }
  if (opts.gable) {
    // decorative pitched roof above the slab (bullets stop on it)
    const g = new THREE.Mesh(new THREE.CylinderGeometry(0.01, (W + 0.9) / Math.SQRT2, 2, 4, 1), roofM);
    g.rotation.y = Math.PI / 4;
    g.scale.set(1, 1, (D + 0.8) / (W + 0.9));
    g.position.set(x, H + 0.3 + 1, z);
    g.castShadow = true;
    w.scene.add(g); w.solids.push(g); w.cover.push(g);
  }
  return roof;
}

/** igloo: brick dome you can walk into through a short tunnel (dir: angle the door faces) */
export function addIgloo(w, x, z, R, dir) {
  const brick = shared.igloo ||= Object.assign(new THREE.MeshStandardMaterial({
    map: brickTexture('#f2f8ff', '#a9c8e0', 8, 6, 14), roughness: 0.55, side: THREE.DoubleSide, emissive: '#16304a', emissiveIntensity: 0.12,
  }), { _shared: true });
  brick.map.repeat.set(4, 2);
  // upper cap is whole; the lower band leaves an opening where the tunnel joins
  const th1 = Math.acos(2.15 / R), phiDoor = Math.PI - dir, gap = 0.34;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 8, 0, Math.PI * 2, 0, th1), brick);
  const band = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 6, phiDoor + gap, Math.PI * 2 - gap * 2, th1, Math.PI / 2 - th1), brick);
  for (const dome of [cap, band]) {
    dome.position.set(x, 0, z);
    dome.castShadow = true; dome.receiveShadow = true;
    w.scene.add(dome); w.solids.push(dome); w.cover.push(dome);
  }
  const dx = Math.cos(dir), dz = Math.sin(dir);
  // tunnel: arch + side walls
  const TL = 1.9, TR = 1.1;
  const tg = new THREE.Group(); // built along +x, then turned to face dir
  const a2 = new THREE.Mesh(new THREE.CylinderGeometry(TR, TR, TL, 16, 1, true, 0, Math.PI), brick);
  a2.rotation.z = Math.PI / 2;     // axis along x, half on top
  a2.position.set(0, 0.95, 0);
  const sideGeo = new THREE.BoxGeometry(TL, 0.95, 0.25);
  const s1 = new THREE.Mesh(sideGeo, brick); s1.position.set(0, 0.475, TR - 0.12);
  const s2 = new THREE.Mesh(sideGeo, brick); s2.position.set(0, 0.475, -TR + 0.12);
  tg.add(a2, s1, s2);
  tg.position.set(x + dx * (R + TL / 2 - 0.5), 0, z + dz * (R + TL / 2 - 0.5));
  tg.rotation.y = -dir;
  w.scene.add(tg);
  tg.traverse((m) => { if (m.isMesh) { m.castShadow = true; w.solids.push(m); w.cover.push(m); } });
  // colliders: ring of posts with a gap at the door
  const ringR = R - 0.35, N = 28;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    let da = Math.atan2(Math.sin(a - dir), Math.cos(a - dir));
    if (Math.abs(da) < 0.33) continue;
    const px = x + Math.cos(a) * ringR, pz = z + Math.sin(a) * ringR;
    w.addCollider(new THREE.Box3(new THREE.Vector3(px - 0.35, 0, pz - 0.35), new THREE.Vector3(px + 0.35, 2.4, pz + 0.35)));
  }
  w.addCollider(new THREE.Box3(new THREE.Vector3(x - R * 0.8, 2.45, z - R * 0.8), new THREE.Vector3(x + R * 0.8, R, z + R * 0.8)));
  // tunnel walls (axis aligned approximations along the tunnel)
  for (let k = 0; k < 3; k++) {
    const d = R - 0.2 + k * 0.6;
    const cx = x + dx * d, cz = z + dz * d, px = -dz, pz = dx;
    for (const sgn of [-1, 1]) {
      const wx = cx + px * sgn * (TR + 0.05), wz = cz + pz * sgn * (TR + 0.05);
      w.addCollider(new THREE.Box3(new THREE.Vector3(wx - 0.3, 0, wz - 0.3), new THREE.Vector3(wx + 0.3, 2.0, wz + 0.3)));
    }
  }
  // a little ice lamp inside
  const lamp = new THREE.PointLight('#9fe7ff', 5, R * 2.2, 1.5);
  lamp.position.set(x, 1.6, z);
  w.scene.add(lamp);
  const glow = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), smat('iceLamp', { color: '#bff4ff', emissive: '#6fdcff', emissiveIntensity: 2.2 }));
  glow.position.set(x - dx * (R - 1), 0.25, z - dz * (R - 1));
  w.scene.add(glow);
}

/** tree with a trunk collider (blocks bullets / sight at body height) */
function addTree(w, x, z, maker, scale) {
  const o = maker(w.rng, scale);
  o.position.set(x, 0, z);
  o.rotation.y = w.rng() * 6;
  w.scene.add(o);
  o.traverse((m) => { if (m.isMesh) { w.solids.push(m); w.cover.push(m); } });
  const r = 0.32 * scale * 0.7 + 0.1;
  w.addCollider(new THREE.Box3(new THREE.Vector3(x - r, 0, z - r), new THREE.Vector3(x + r, 10, z + r)));
}

/** fallen log lying along x (alongX) or z */
function addLog(w, x, z, len, alongX, r = 0.5) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, len, 10), smat('log', { color: '#5a3b24', roughness: 0.95, flatShading: true }));
  if (alongX) m.rotation.z = Math.PI / 2; else m.rotation.x = Math.PI / 2;
  m.position.set(x, r, z);
  m.castShadow = true; m.receiveShadow = true;
  w.scene.add(m); w.solids.push(m); w.cover.push(m);
  const cap = smat('logEnd', { color: '#b88a5a', roughness: 0.9 });
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.CircleGeometry(r * 0.95, 10), cap);
    if (alongX) { c.rotation.y = s * Math.PI / 2; c.position.set(x + s * len / 2 + s * 0.01, r, z); }
    else { c.rotation.y = s > 0 ? 0 : Math.PI; c.position.set(x, r, z + s * len / 2 + s * 0.01); }
    w.scene.add(c);
  }
  const hx = alongX ? len / 2 : r, hz = alongX ? r : len / 2;
  w.addCollider(new THREE.Box3(new THREE.Vector3(x - hx, 0, z - hz), new THREE.Vector3(x + hx, r * 2, z + hz)));
}

/** shallow water: ellipses (x, z, rx, rz) — slows players, splashes; islands are cut out */
function addWater(w, pools, color, islands = []) {
  const nrm = waterNormalTexture();
  nrm.repeat.set(6, 6);
  const mat = new THREE.MeshStandardMaterial({
    color, roughness: 0.06, metalness: 0.35, transparent: true, opacity: 0.82, normalMap: nrm, normalScale: new THREE.Vector2(0.35, 0.35),
    envMapIntensity: 1.4,
  });
  for (const p of pools) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 48), mat);
    m.rotation.x = -Math.PI / 2;
    m.scale.set(p.rx, p.rz, 1);
    m.position.set(p.x, 0.3, p.z);
    m.receiveShadow = true;
    w.scene.add(m);
    // darker lake bed
    const bed = new THREE.Mesh(new THREE.CircleGeometry(1, 40), smat('bed' + color, { color: new THREE.Color(color).multiplyScalar(0.35), roughness: 1 }));
    bed.rotation.x = -Math.PI / 2;
    bed.scale.set(p.rx * 0.97, p.rz * 0.97, 1);
    bed.position.set(p.x, 0.015, p.z);
    w.scene.add(bed);
  }
  w.water.push(...pools);
  w.islands.push(...islands);
  w.waterMat = mat;
}

/** frozen lake surface: walkable ice (no slow-down, icy footsteps), drawn with cracks */
function iceTexture() {
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 20, S / 2, S / 2, S / 1.4);
  grd.addColorStop(0, '#9fd2ea'); grd.addColorStop(1, '#d8eef8');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2200; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.35})`; g.fillRect(Math.random() * S, Math.random() * S, 2, 2); }
  g.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    let x = Math.random() * S, y = Math.random() * S;
    g.strokeStyle = `rgba(255,255,255,${0.35 + Math.random() * 0.4})`; g.lineWidth = 1 + Math.random() * 1.5;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 7; k++) { x += (Math.random() - 0.5) * 90; y += (Math.random() - 0.5) * 90; g.lineTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 4);
  return t;
}
function addIce(w, sheet) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 56), new THREE.MeshStandardMaterial({ map: iceTexture(), roughness: 0.08, metalness: 0.15, envMapIntensity: 1.6 }));
  m.rotation.x = -Math.PI / 2;
  m.scale.set(sheet.rx, sheet.rz, 1);
  m.position.set(sheet.x, 0.02, sheet.z);
  m.receiveShadow = true;
  w.scene.add(m);
  w.ice.push(sheet);
}

function plankBridge(w, x, z, len, alongX, width = 3, h = 0.4) {
  const tex = shared.plankTex ||= plankTexture('#8a6440');
  const m = shared.plank ||= Object.assign(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }), { _shared: true });
  if (alongX) box(w, x, 0, z, len, h, width, m); else box(w, x, 0, z, width, h, len, m);
  // posts
  const pm = smat('post', { color: '#4a3220', roughness: 0.9 });
  for (let t = -len / 2; t <= len / 2; t += 3) {
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.3, 6), pm);
      if (alongX) p.position.set(x + t, 0.65, z + s * width / 2); else p.position.set(x + s * width / 2, 0.65, z + t);
      w.scene.add(p);
    }
  }
}

function scatter(w, n, seed, fn, avoid = 1.6) {
  const rng = mulberry32(seed);
  let placed = 0, guard = 0;
  while (placed < n && guard++ < n * 40) {
    const x = (rng() - 0.5) * (w.halfW * 2 - 4), z = (rng() - 0.5) * (w.halfL * 2 - 8);
    if (w.blockedAt(x, z, avoid) || w.inWater(x, z) || w.onIce(x, z) || Math.abs(z) > 66 && Math.abs(x) < 9) continue;
    if (fn(x, z, rng) !== false) placed++;
  }
}

const snowPine = (rng, s) => makePine(rng, s, true);

/* ---------- campsite pieces ---------- */
function addTent(w, x, z, rot, color) {
  const cloth = smat('tent' + color, { color, roughness: 0.85, side: THREE.DoubleSide, flatShading: true });
  const g = new THREE.Group();
  const shape = new THREE.Shape([new THREE.Vector2(-1.25, 0), new THREE.Vector2(1.25, 0), new THREE.Vector2(0, 1.6)]);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 2.6, bevelEnabled: false });
  geo.translate(0, 0, -1.3);
  g.add(new THREE.Mesh(geo, cloth));
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.0), smat('tentDoor', { color: '#2a2018', roughness: 1, side: THREE.DoubleSide }));
  door.position.set(0, 0.5, 1.31);
  g.add(door);
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; w.solids.push(m); w.cover.push(m); } });
  w.scene.add(g);
  const along = Math.abs(Math.sin(rot)) > 0.7;
  const hx = along ? 1.3 : 1.1, hz = along ? 1.1 : 1.3;
  w.addCollider(new THREE.Box3(new THREE.Vector3(x - hx, 0, z - hz), new THREE.Vector3(x + hx, 1.7, z + hz)));
}

function addCampfire(w, x, z, big = false) {
  const s = big ? 1.4 : 1;
  const stone = smat('fireStone', { color: '#7a7470', roughness: 0.9, flatShading: true });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22 * s, 0), stone);
    r.position.set(x + Math.cos(a) * 0.85 * s, 0.12, z + Math.sin(a) * 0.85 * s);
    w.scene.add(r);
  }
  const logM = smat('fireLog', { color: '#4a2e18', roughness: 0.95 });
  for (let i = 0; i < 4; i++) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * s, 0.08 * s, 1.1 * s, 6), logM);
    l.position.set(x, 0.25 * s, z); l.rotation.set(0.9, (i / 4) * Math.PI * 2, 0, 'YXZ');
    w.scene.add(l);
  }
  const flameM = new THREE.MeshBasicMaterial({ color: '#ffb23a', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const flames = [];
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry((0.35 - i * 0.08) * s, (1.1 - i * 0.2) * s, 7), i ? flameM : new THREE.MeshBasicMaterial({ color: '#ff6a1a', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    f.position.set(x, 0.55 * s, z);
    w.scene.add(f); flames.push(f);
  }
  const light = new THREE.PointLight('#ff9a4a', big ? 40 : 18, big ? 16 : 10, 1.3);
  light.position.set(x, 1.3 * s, z);
  w.scene.add(light);
  w.flickers.push({ light, flames, base: light.intensity, s });
  w.addCollider(new THREE.Box3(new THREE.Vector3(x - 0.7 * s, 0, z - 0.7 * s), new THREE.Vector3(x + 0.7 * s, 0.45, z + 0.7 * s)));
}

function addPicnicTable(w, x, z, alongX) {
  const wood = smat('picnic', { color: '#9a6a3a', roughness: 0.85 });
  const W = alongX ? 2.2 : 0.9, D = alongX ? 0.9 : 2.2;
  w.addBlock(x, 0.7, z, W, 0.08, D, wood);
  for (const s of [-1, 1]) {
    if (alongX) w.addBlock(x, 0.4, z + s * 0.75, 2.2, 0.06, 0.32, wood); else w.addBlock(x + s * 0.75, 0.4, z, 0.32, 0.06, 2.2, wood);
  }
  w.addCollider(new THREE.Box3(new THREE.Vector3(x - W / 2, 0, z - D / 2), new THREE.Vector3(x + W / 2, 0.78, z + D / 2)));
}

function addStringLights(w, a, b) {
  const post = smat('lightPost', { color: '#3a2a1a', roughness: 0.9 });
  for (const p of [a, b]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 6), post);
    m.position.set(p[0], 1.6, p[1]); w.scene.add(m);
  }
  const cols = ['#ffd27a', '#ff8fd0', '#8fd8ff', '#b6ff7a'];
  const n = 14;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, y = 3.1 - Math.sin(t * Math.PI) * 0.7;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), new THREE.MeshBasicMaterial({ color: cols[i % 4] }));
    bulb.position.set(x, y, z);
    w.scene.add(bulb);
  }
}

/** capture zone marker (flag, ground ring, letter); recoloured by the domination mode */
function addZone(w, id, x, z, r = 5) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 5, 8), smat('flagPole', { color: '#d8d8e0', metalness: 0.6, roughness: 0.3 }));
  pole.position.y = 2.5;
  const flagGeo = new THREE.PlaneGeometry(1.6, 1, 12, 4);
  flagGeo.translate(0.8, 0, 0);
  const flagMat = new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: 0.8, side: THREE.DoubleSide, emissive: '#ffffff', emissiveIntensity: 0.15 });
  const flag = new THREE.Mesh(flagGeo, flagMat);
  flag.position.y = 4.4;
  const ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.25, r, 64), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
  const fillMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
  const fill = new THREE.Mesh(new THREE.RingGeometry(0.2, r - 0.3, 48, 1, 0, 0.001), fillMat);
  fill.rotation.x = -Math.PI / 2; fill.position.y = 0.06;
  // letter on a sprite above the flag
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const cg = c.getContext('2d');
  cg.font = '900 96px sans-serif'; cg.textAlign = 'center'; cg.textBaseline = 'middle';
  cg.lineWidth = 10; cg.strokeStyle = 'rgba(0,0,0,.6)'; cg.strokeText(id, 64, 68); cg.fillStyle = '#fff'; cg.fillText(id, 64, 68);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const letter = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  letter.scale.set(1.4, 1.4, 1); letter.position.y = 5.8; letter.renderOrder = 9;
  g.add(pole, flag, ring, fill, letter);
  w.scene.add(g);
  w.zones.push({ id, x, z, r, flag, flagMat, ringMat, fill, fillMat, basePos: flagGeo.attributes.position.array.slice(), prog: -1 });
}

/** zone visuals: owner colour, capture progress ring */
export function setZoneVisual(zone, ownerColor, capColor, prog) {
  zone.flagMat.color.set(ownerColor); zone.flagMat.emissive.set(ownerColor);
  zone.ringMat.color.set(ownerColor);
  zone.fillMat.color.set(capColor);
  const p = Math.round(Math.max(0, Math.min(1, prog)) * 60) / 60;
  if (p !== zone.prog) {
    zone.prog = p;
    zone.fill.geometry.dispose();
    zone.fill.geometry = new THREE.RingGeometry(0.2, zone.r - 0.3, 48, 1, Math.PI / 2, Math.max(0.001, p * Math.PI * 2));
  }
}

/* ================= maps ================= */
export const MAP_LAYOUTS = {
  ice(w) {
    const ice = w.mats.block;
    w.teamSpawns = { A: [0, 76, 0], B: [0, -72, Math.PI], C: [28, 26, Math.PI / 2] };
    // player start zone (z 60..84)
    w.addBlock(0, 0, 64, 8, 1.3, 0.8, ice);
    w.addCrate(-14, 0, 66, 2); w.addCrate(-14, 2, 66, 2); w.addCrate(-16.2, 0, 66.5, 1.8);
    w.addCrate(14, 0, 62, 2.2);
    w.addRock(-24, 0, 72, 4, 3, 4);
    w.addRock(23, 0, 76, 3.5, 2.6, 3.5);
    // forward zone
    w.addRock(-12, 0, 46, 5, 3.5, 4);
    w.addRock(14, 0, 34, 4, 3, 5);
    w.addCrate(-24, 0, 52, 2); w.addCrate(-21.8, 0, 52, 2);
    w.addBlock(0, 0, 40, 6, 1.4, 0.8, ice);
    w.addBlock(20, 0, 54, 0.8, 1.4, 5, ice);
    w.addPillar(6, 50);
    w.addPillar(-4, 30);
    for (let i = 0; i < 5; i++) w.addBlock(27, 0, 46 - i, 4, 0.45 * (i + 1), 1.0, ice);
    w.addBlock(27, 0, 39.5, 6, 2.25, 4, ice);
    // center
    w.addRock(0, 0, 8, 7, 5, 7);
    w.addCrate(10, 0, 14, 2); w.addCrate(12.2, 0, 14, 2); w.addCrate(11, 2, 14, 2);
    w.addCrate(-10, 0, 2, 2); w.addCrate(-12.2, 0, 2.4, 2);
    w.addBlock(-20, 0, 16, 5, 1.4, 0.8, ice);
    w.addBlock(22, 0, -2, 0.8, 1.4, 6, ice);
    w.addBlock(-18, 0, -8, 0.8, 1.4, 5, ice);
    w.addRock(26, 0, 20, 3.5, 3, 4);
    w.addRock(-27, 0, 0, 4, 3.5, 4);
    w.addPillar(15, 0);
    w.addPillar(-8, -14);
    // far zone
    w.addRock(-14, 0, -30, 4, 3, 4);
    w.addRock(16, 0, -36, 5, 3.5, 4);
    w.addRock(0, 0, -50, 6, 5, 6);
    w.addRock(-22, 0, -58, 4, 3, 5);
    w.addRock(24, 0, -64, 4.5, 3.5, 4);
    w.addRock(-6, 0, -72, 4, 3, 4);
    w.addCrate(8, 0, -24, 2); w.addCrate(-24, 0, -40, 2.2); w.addCrate(20, 0, -48, 2);
    w.addCrate(10, 0, -70, 2); w.addCrate(12.2, 0, -70, 2); w.addCrate(-16, 0, -70, 2);
    w.addBlock(0, 0, -28, 8, 1.5, 0.8, ice);
    w.addBlock(-10, 0, -46, 0.8, 1.4, 6, ice);
    w.addBlock(12, 0, -58, 6, 1.4, 0.8, ice);
    w.addBlock(0, 0, -78, 10, 1.6, 0.8, ice);
    w.addPillar(-30, -20);
    w.addPillar(28, -30);
    w.addPillar(-4, -62);
    for (let i = 0; i < 5; i++) w.addBlock(-27, 0, -10 - i, 4, 0.45 * (i + 1), 1.0, ice);
    w.addBlock(-27, 0, -16.5, 6, 2.25, 4, ice);
    // igloos (walk in through the tunnel)
    addIgloo(w, -22, 32, 3.6, 0);              // door faces +x
    addIgloo(w, 20, -15, 3.6, Math.PI);        // door faces −x
    addIgloo(w, -15, -60, 3.6, 0);
  },

  forest(w) {
    w.teamSpawns = { A: [0, 77, 0], B: [0, -76, Math.PI], C: [29, 22, Math.PI / 2] };
    const T = w.theme;
    const cabinWall = new THREE.MeshStandardMaterial({ map: plankTexture(T.wall), roughness: 0.9 });
    cabinWall.map.repeat.set(2, 2);
    const cabinRoof = new THREE.MeshStandardMaterial({ color: T.roof, roughness: 0.95, flatShading: true });
    // winding creek across the middle + log bridges
    const creek = [];
    for (let i = 0; i < 7; i++) creek.push({ x: -33 + i * 11, z: -2 + Math.sin(i * 1.3) * 4, rx: 8, rz: 3.2 });
    addWater(w, creek, '#3f7f78');
    plankBridge(w, -12, -2 + Math.sin(2 * 1.3) * 4 * 0.5, 10, false, 2.6);
    plankBridge(w, 15, -2 + Math.sin(4.3 * 1.3) * 4 * 0.6, 10, false, 2.6);
    // hunter's cabin (north-east) and a woodshed (south-west)
    addHouse(w, 19, -40, 9, 7, 3, { wallMat: cabinWall, roofMat: cabinRoof, door: 'w', gable: true, rug: '#7a2f2a', lamp: '#ffb860' });
    addHouse(w, -20, 38, 6, 6, 2.8, { wallMat: cabinWall, roofMat: cabinRoof, door: 'e', windows: ['s', 'n'], gable: true, lamp: '#ffb860' });
    // fallen logs (low cover)
    addLog(w, -4, 58, 7, true); addLog(w, 12, 46, 6, false); addLog(w, -22, 18, 7, true);
    addLog(w, 6, 22, 5, true); addLog(w, -10, -22, 7, false); addLog(w, 22, -18, 6, true);
    addLog(w, -6, -52, 8, true); addLog(w, 4, -66, 6, false);
    // mossy boulders
    w.addRock(-27, 0, 62, 4, 3, 4); w.addRock(26, 0, 64, 3.5, 2.6, 3.5); w.addRock(-2, 0, 34, 5, 3.2, 4);
    w.addRock(26, 0, 8, 4, 3, 4); w.addRock(-26, 0, -12, 4, 3.5, 5); w.addRock(10, 0, -30, 4, 3, 4);
    w.addRock(-18, 0, -64, 5, 3.5, 4); w.addRock(22, 0, -64, 4, 3, 4);
    // crates of the camp
    w.addCrate(14, 0, 68, 2); w.addCrate(16.2, 0, 68, 2); w.addCrate(-14, 0, -74, 2); w.addCrate(-16.2, 0, -74, 2);
    // giant trees with trunk colliders (the forest is the cover)
    for (const [x, z] of [[-8, 48], [8, 36], [-16, 6], [4, 10], [-4, -12], [12, -8], [-14, -36], [4, -40], [-26, 50], [27, 40], [28, -40], [-28, -46], [0, -58]]) {
      if (!w.blockedAt(x, z, 1.2)) addTree(w, x, z, makeTree, 2.4);
    }
    scatter(w, 34, 31, (x, z, rng) => addTree(w, x, z, makeTree, 1.6 + rng() * 1.0), 2.2);
    scatter(w, 40, 32, (x, z, rng) => { const o = rng() < 0.5 ? makeBush(rng, 0.8 + rng() * 0.6) : makeMushroom(rng, 0.8 + rng()); o.position.set(x, 0, z); w.scene.add(o); }, 1.2);
  },

  honey(w) {
    w.teamSpawns = { A: [0, 77, 0], B: [0, -77, Math.PI], C: [29, 30, Math.PI / 2] };
    const T = w.theme, comb = w.mats.block;
    const shedWall = new THREE.MeshStandardMaterial({ map: plankTexture(T.wall), roughness: 0.8 });
    const shedRoof = new THREE.MeshStandardMaterial({ color: T.roof, roughness: 0.9, flatShading: true });
    // round plaza ringed by giant honeycomb towers
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      w.addPillar(Math.cos(a) * 16, Math.sin(a) * 16);
    }
    // honey pond in the middle (decor, a bit slow like the creek)
    addWater(w, [{ x: 0, z: 0, rx: 5.5, rz: 5.5 }], '#f2a516');
    w.addCrate(7, 0, 4, 1.8); w.addCrate(-7, 0, -4, 1.8);
    // hex comb maze walls — south half
    const wallH = 2.3;
    for (const [x, z, sx, sz] of [
      [-12, 58, 8, 0.9], [12, 58, 8, 0.9], [0, 50, 0.9, 7], [-22, 46, 0.9, 8], [22, 46, 0.9, 8],
      [-8, 38, 7, 0.9], [10, 36, 0.9, 6], [-26, 30, 6, 0.9], [26, 28, 6, 0.9],
    ]) w.addBlock(x, 0, z, sx, wallH, sz, comb);
    // north half (mirrored, shifted so it is not identical)
    for (const [x, z, sx, sz] of [
      [-10, -58, 9, 0.9], [14, -56, 7, 0.9], [2, -48, 0.9, 7], [-22, -44, 0.9, 7], [21, -42, 0.9, 9],
      [-6, -36, 8, 0.9], [-26, -28, 6, 0.9], [26, -30, 6, 0.9],
    ]) w.addBlock(x, 0, z, sx, wallH, sz, comb);
    // grassy terraces (hill-like, climb by steps)
    const turf = smat('turf', { color: '#8fae3e', roughness: 0.95 });
    for (const [x, z, s] of [[-24, 10, 1], [24, -12, -1]]) {
      w.addBlock(x, 0, z, 9, 1.35, 9, turf);
      for (let i = 0; i < 3; i++) w.addBlock(x + s * (4.95 + (2 - i) * 0.9), 0, z, 0.9, 0.45 * (i + 1), 3, turf);
      const fl = makeFlowers(w.rng, 2); fl.position.set(x, 1.35, z); w.scene.add(fl);
    }
    // beekeeper's storehouse
    addHouse(w, -21, -12, 8, 7, 3.2, { wallMat: shedWall, roofMat: shedRoof, door: 'e', gable: true, rug: '#d9a02a', lamp: '#ffc060' });
    addHouse(w, 20, 14, 7, 6, 3, { wallMat: shedWall, roofMat: shedRoof, door: 'w', windows: ['n', 's'], gable: true, lamp: '#ffc060' });
    // hive boxes as low cover
    for (const [x, z] of [[-6, 68], [6, 70], [-28, 62], [28, 60], [-4, -68], [8, -70], [-28, -62], [28, -64], [14, 24], [-14, -24]]) {
      const hb = makeHiveBox(w.rng, 1.3); hb.position.set(x, 0, z); w.scene.add(hb);
      hb.traverse((m) => { if (m.isMesh) { w.solids.push(m); w.cover.push(m); } });
      w.addCollider(new THREE.Box3(new THREE.Vector3(x - 0.65, 0, z - 0.5), new THREE.Vector3(x + 0.65, 1.38, z + 0.5)));
    }
    scatter(w, 50, 41, (x, z, rng) => { const o = makeFlowers(rng, 0.9 + rng() * 0.6); o.position.set(x, 0, z); w.scene.add(o); }, 1);
  },

  lake(w) {
    w.teamSpawns = { A: [0, 77, 0], B: [0, -77, Math.PI], C: [29, 44, Math.PI / 2] };
    const T = w.theme;
    const boatWall = new THREE.MeshStandardMaterial({ map: plankTexture(T.wall), roughness: 0.85 });
    const boatRoof = new THREE.MeshStandardMaterial({ color: T.roof, roughness: 0.7, flatShading: true });
    const islands = [{ x: -8, z: -12, r: 4.6 }, { x: 9, z: 15, r: 4.2 }];
    // the lake is frozen solid; only three holes in the ice are open water
    addIce(w, { x: 0, z: 0, rx: 23, rz: 36 });
    addWater(w, [{ x: 10, z: -16, rx: 4, rz: 3 }, { x: -12, z: 14, rx: 3.5, rz: 4.5 }, { x: 4, z: 28, rx: 3, rz: 2.4 }], T.river, islands);
    // islands
    const sand = smat('islandSnow', { color: '#eef5fb', roughness: 1 });
    for (const is of islands) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(is.r, is.r + 0.6, 0.5, 24), sand);
      m.position.set(is.x, 0.1, is.z); m.receiveShadow = true;
      w.scene.add(m);
      addTree(w, is.x + 0.8, is.z - 0.6, snowPine, 1.1);
      w.addRock(is.x - 1.6, 0, is.z + 1.2, 2.4, 1.8, 2.2);
    }
    // long plank bridge across the lake + a pier
    plankBridge(w, 0, 2, 50, true, 3);
    plankBridge(w, 14, -22, 14, true, 2.4);
    plankBridge(w, -12, 26, 12, true, 2.4);
    // boathouse on the east shore (enterable) and a fishing hut on the west
    addHouse(w, 27, -22, 7, 9, 3.2, { wallMat: boatWall, roofMat: boatRoof, door: 'w', gable: true, rug: '#2f5f8a', lamp: '#ffe0a0' });
    addHouse(w, -28, 28, 6, 7, 3, { wallMat: boatWall, roofMat: boatRoof, door: 'e', gable: true, lamp: '#ffe0a0' });
    // rowboats pulled up on the shore (low cover)
    const boatM = smat('boat', { color: '#a8452e', roughness: 0.7 });
    for (const [x, z, rot] of [[-26, -8, 0.3], [26, 10, -0.2], [-24, -40, 0.1]]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.6, 3.6, 10, 1, false, 0, Math.PI), boatM);
      b.rotation.set(Math.PI / 2, rot, Math.PI);
      b.position.set(x, 0.6, z);
      b.castShadow = true;
      w.scene.add(b); w.solids.push(b); w.cover.push(b);
      w.addCollider(new THREE.Box3(new THREE.Vector3(x - 1, 0, z - 1.9), new THREE.Vector3(x + 1, 0.95, z + 1.9)));
    }
    // shore rocks and pines
    for (const [x, z, s] of [[-28, 60, 4], [28, 62, 3.5], [-6, 52, 4.5], [10, 46, 3.5], [-28, -60, 4], [26, -58, 4], [4, -52, 5], [-12, -46, 3.5], [-30, 2, 3.5], [30, -4, 3.5]]) w.addRock(x, 0, z, s, s * 0.75, s);
    w.addCrate(-14, 0, 66, 2); w.addCrate(14, 0, 64, 2); w.addCrate(-12, 0, -68, 2); w.addCrate(14, 0, -66, 2); w.addCrate(15.8, 2, -66, 1.4);
    for (const [x, z] of [[-20, 50], [20, 50], [-22, -52], [18, -46], [-30, 44], [30, -40], [24, 34], [-25, -26]]) addTree(w, x, z, snowPine, 1.7);
    // reeds along the shore
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const x = Math.cos(a) * 23 * (0.98 + Math.random() * 0.06), z = Math.sin(a) * 36 * (0.98 + Math.random() * 0.06);
      if (Math.abs(z - 2) < 2.5) continue;
      const r = makeReeds(w.rng, 1.2); r.position.set(x, 0, z); w.scene.add(r);
    }
    scatter(w, 30, 51, (x, z, rng) => { const o = rng() < 0.6 ? makeFlowers(rng, 0.8) : makeBush(rng, 0.6); o.position.set(x, 0, z); w.scene.add(o); }, 1);
  },

  camp(w) {
    w.teamSpawns = { A: [0, 64, 0], B: [0, -64, Math.PI], C: [44, 34, Math.PI / 2] };
    const T = w.theme;
    const cabinWall = new THREE.MeshStandardMaterial({ map: plankTexture(T.wall), roughness: 0.9 });
    const cabinRoof = new THREE.MeshStandardMaterial({ color: T.roof, roughness: 0.95, flatShading: true });
    const rvWall = new THREE.MeshStandardMaterial({ color: '#f2efe6', roughness: 0.5, metalness: 0.1 });
    const rvRoof = new THREE.MeshStandardMaterial({ color: '#d8d4c8', roughness: 0.5 });
    // three capture zones, the same distance from both bases
    addZone(w, 'A', -30, 0); addZone(w, 'B', 0, 0); addZone(w, 'C', 30, 0);
    // B: big campfire square with log benches, picnic tables and string lights
    addCampfire(w, 0, 0, true);
    addLog(w, 0, 3.4, 3, true, 0.3); addLog(w, 0, -3.4, 3, true, 0.3);
    addPicnicTable(w, -8, 6, true); addPicnicTable(w, 8, -6, true); addPicnicTable(w, 8, 7, false); addPicnicTable(w, -8, -7, false);
    addStringLights(w, [-9, 9], [9, 9]); addStringLights(w, [-9, -9], [9, -9]);
    // A: log cabin + woodpile
    addHouse(w, -42, 8, 8, 7, 3, { wallMat: cabinWall, roofMat: cabinRoof, door: 'e', gable: true, rug: '#8a2f2a', lamp: '#ffb860' });
    addLog(w, -34, -8, 4, true, 0.35); addLog(w, -34, -8.7, 4, true, 0.35); addLog(w, -34, -8.35, 4, true, 0.35);
    addTent(w, -24, 9, 0.2, '#e8572a'); addTent(w, -22, -9, Math.PI + 0.3, '#2a8ae8');
    // C: pond with a canoe, tents
    addWater(w, [{ x: 41, z: -6, rx: 6, rz: 8 }], '#3f6f7a');
    const canoe = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.35, 4, 10, 1, false, 0, Math.PI), smat('canoe', { color: '#d8642a', roughness: 0.6 }));
    canoe.rotation.set(Math.PI / 2, 0.4, Math.PI); canoe.position.set(34, 0.35, 10); canoe.castShadow = true;
    w.scene.add(canoe); w.solids.push(canoe); w.cover.push(canoe);
    w.addCollider(new THREE.Box3(new THREE.Vector3(33.2, 0, 8), new THREE.Vector3(34.8, 0.6, 12)));
    addTent(w, 24, -9, Math.PI - 0.2, '#3fae4a'); addTent(w, 22, 9, -0.3, '#e8c02a');
    addHouse(w, 42, -26, 7, 6, 3, { wallMat: cabinWall, roofMat: cabinRoof, door: 'w', gable: true, lamp: '#ffb860' });
    // team bases: a camper van (walk in) + tents + campfire
    for (const s of [1, -1]) {
      const bz = 58 * s;
      addHouse(w, -18, bz, 7.5, 3.6, 2.7, { wallMat: rvWall, roofMat: rvRoof, door: s > 0 ? 'n' : 's', windows: ['e', 'w'], lamp: '#fff0c0' });
      for (const wx of [-20.5, -15.5]) for (const wz of [-1.9, 1.9]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 14), smat('tyre', { color: '#1a1a1a', roughness: 0.9 }));
        wheel.rotation.x = Math.PI / 2; wheel.position.set(wx, 0.45, bz + wz); w.scene.add(wheel);
      }
      addTent(w, 14, bz - 4 * s, s > 0 ? 0 : Math.PI, s > 0 ? '#e85a8a' : '#5a7ae8');
      addTent(w, 20, bz + 2 * s, s > 0 ? 0.4 : Math.PI + 0.4, '#f0a03a');
      addCampfire(w, 4, bz + 2 * s);
      w.addCrate(-8, 0, bz - 6 * s, 1.2); w.addCrate(-6.8, 0, bz - 6 * s, 1.2);  // coolers / supply boxes
      addPicnicTable(w, 8, bz - 10 * s, true);
    }
    // mid-field cover between bases and zones
    for (const [x, z] of [[-14, 30], [14, 28], [-14, -30], [14, -28], [-38, 34], [38, 32], [-38, -34], [38, -36]]) addLog(w, x, z, 5, (x > 0) === (z > 0), 0.45);
    for (const [x, z, sz] of [[0, 24, 4], [0, -24, 4], [-24, 40, 3.5], [24, -40, 3.5], [-46, -14, 3], [46, 16, 3]]) w.addRock(x, 0, z, sz, sz * 0.7, sz);
    // trees everywhere except the zones and the bases
    const clear = (x, z) => w.zones.some((q) => Math.hypot(x - q.x, z - q.z) < q.r + 3) || Math.abs(z) > 50 && Math.abs(x) < 26;
    const rng = mulberry32(88);
    let n = 0;
    for (let i = 0; i < 400 && n < 46; i++) {
      const x = (rng() - 0.5) * 96, z = (rng() - 0.5) * 136;
      if (clear(x, z) || w.blockedAt(x, z, 2.5) || w.inWater(x, z)) continue;
      addTree(w, x, z, makeTree, 1.6 + rng() * 1.1);
      n++;
    }
    scatter(w, 40, 71, (x, z, r) => { if (clear(x, z)) return false; const o = r() < 0.5 ? makeBush(r, 0.7 + r() * 0.5) : makeMushroom(r, 0.7 + r() * 0.6); o.position.set(x, 0, z); w.scene.add(o); }, 1.2);
  },

  desert(w) {
    w.teamSpawns = { A: [0, 77, 0], B: [0, -77, Math.PI], C: [30, 2, Math.PI / 2] };
    const T = w.theme;
    const adobe = new THREE.MeshStandardMaterial({ map: brickTexture(T.wall, '#a8804c', 5, 7, 22), roughness: 0.95 });
    adobe.map.repeat.set(1.5, 1.5);
    const roof = new THREE.MeshStandardMaterial({ color: T.roof, roughness: 0.95 });
    // the fort town: 5 enterable buildings, two of them with stairs to a walled rooftop
    addHouse(w, -18, 22, 10, 8, 5.2, { wallMat: adobe, roofMat: roof, door: ['e', 's'], parapet: true, stairs: 'w', rug: '#a83a2a' });
    addHouse(w, 16, 36, 8, 7, 3.2, { wallMat: adobe, roofMat: roof, door: 's', rug: '#2a6aa8' });
    addHouse(w, 18, -20, 10, 8, 5.2, { wallMat: adobe, roofMat: roof, door: ['w', 'n'], parapet: true, stairs: 'e', rug: '#c88a2a' });
    addHouse(w, -16, -42, 8, 8, 3.2, { wallMat: adobe, roofMat: roof, door: 'e', rug: '#6a2a8a' });
    addHouse(w, 0, 0, 6, 6, 3, { wallMat: adobe, roofMat: roof, door: ['n', 's'], windows: ['e', 'w'] });
    // market tents (cloth roof + crates)
    const cloths = ['#c8342a', '#2a6ac8', '#e8b02a'];
    [[-4, 40], [6, 52], [-8, -22], [4, -56]].forEach(([x, z], i) => {
      const pole = smat('pole', { color: '#5a3a1e', roughness: 0.9 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), pole);
        p.position.set(x + sx * 1.8, 1.3, z + sz * 1.4); w.scene.add(p);
      }
      const cloth = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 2.8, 0.9, 4, 1, true), smat('cloth' + i, { color: cloths[i % 3], roughness: 0.9, side: THREE.DoubleSide }));
      cloth.rotation.y = Math.PI / 4; cloth.scale.set(1.3, 1, 1);
      cloth.position.set(x, 3.05, z); cloth.castShadow = true;
      w.scene.add(cloth); w.cover.push(cloth); w.solids.push(cloth);
      w.addCrate(x - 0.7, 0, z, 1.2); w.addCrate(x + 0.7, 0, z + 0.2, 1.1);
    });
    // well in the square
    const well = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 1.1, 16), adobe);
    well.position.set(-4, 0.55, 58); w.scene.add(well); w.solids.push(well); w.cover.push(well);
    w.addCollider(new THREE.Box3(new THREE.Vector3(-5.1, 0, 56.9), new THREE.Vector3(-2.9, 1.1, 59.1)));
    // sand dunes / sandstone rocks
    for (const [x, z, s] of [[-26, 64, 5], [26, 66, 4], [-28, -66, 5], [28, -62, 4.5], [26, 8, 4], [-28, -8, 4.5], [8, 18, 3.5], [-6, -66, 4]]) w.addRock(x, 0, z, s, s * 0.6, s * 1.2);
    // low adobe walls
    for (const [x, z, sx, sz] of [[0, 66, 10, 0.7], [0, -68, 10, 0.7], [-26, 44, 0.7, 7], [27, -44, 0.7, 7], [10, 10, 5, 0.7], [-10, -8, 0.7, 5]]) w.addBlock(x, 0, z, sx, 1.3, sz, adobe);
    w.addCrate(14, 0, 68, 2); w.addCrate(-14, 0, -72, 2); w.addCrate(26, 0, 50, 2); w.addCrate(-26, 0, -52, 2);
    // palms & cacti
    for (const [x, z] of [[-8, 60], [0, 60], [24, 22], [-24, 2], [-26, -30], [28, -4], [10, -40], [-4, 28]]) addTree(w, x, z, makePalm, 1.2);
    scatter(w, 22, 61, (x, z, rng) => {
      const big = rng() < 0.45;
      const o = makeCactus(rng, big ? 1.2 : 0.7); o.position.set(x, 0, z); w.scene.add(o);
      if (big) { o.traverse((m) => { if (m.isMesh) { w.solids.push(m); w.cover.push(m); } }); w.addCollider(new THREE.Box3(new THREE.Vector3(x - 0.3, 0, z - 0.3), new THREE.Vector3(x + 0.3, 3, z + 0.3))); }
    }, 2);
  },
  /* v2.2 Persepolis: a raised Apadana terrace with a column hall, two gates with lamassu, ruins.
     Point-symmetric ((x, z) → (−x, −z)) so both teams get the same map. */
  perse(w) {
    w.teamSpawns = { A: [0, 77, 0], B: [0, -77, Math.PI], C: [30, 2, Math.PI / 2] };
    const stone = new THREE.MeshStandardMaterial({ map: brickTexture('#dcc4a2', '#a88a62', 3, 4, 16), roughness: 0.85 });
    stone.map.repeat.set(3, 2);
    const dark = smat('perseDark', { color: '#5a4a3e', roughness: 0.6, metalness: 0.1 });
    const gold = smat('perseGold', { color: '#ffcf5a', metalness: 0.9, roughness: 0.3, emissive: '#5a3a00', emissiveIntensity: 0.2 });
    const lapis = smat('perseLapis', { color: '#1f3fa8', roughness: 0.4, emissive: '#0a1a5a', emissiveIntensity: 0.3 });
    const relief = new THREE.MeshStandardMaterial({ map: reliefTexture(), roughness: 0.85 });
    const solid = (m) => { m.castShadow = true; m.receiveShadow = true; w.scene.add(m); w.solids.push(m); w.cover.push(m); return m; };
    const both = (fn) => { fn(1); fn(-1); }; // s = 1 and the point-mirrored copy

    // ---- Apadana: terrace 24×20, 2.25 m high, stairs on all four sides (step 0.45)
    const TH = 2.25;
    w.addBlock(0, 0, 0, 24, TH, 20, stone);
    for (let i = 0; i < 5; i++) {
      const h = 0.45 * (i + 1);
      both((s) => w.addBlock(0, 0, s * (14.5 - i), 7, h, 1, stone));       // south / north stairs
      both((s) => w.addBlock(s * (16.5 - i), 0, 0, 1, h, 6, stone));       // east / west stairs
    }
    // gold-lapis frieze along the terrace front
    both((s) => { const f = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.5, 0.06), relief); f.position.set(s * 8, 1.3, s * 10.04); f.rotation.y = s > 0 ? 0 : Math.PI; w.scene.add(f); });
    // column hall on top: 4×3 columns with double-bull capitals
    for (const x of [-9, -3, 3, 9]) for (const z of [-6, 0, 6]) {
      if (x === 3 && z === 0 || x === -3 && z === 0) continue; // open middle
      const H = 6;
      solid(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, H, 14), stone)).position.set(x, TH + H / 2, z);
      solid(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.3, 14), stone)).position.set(x, TH + 0.15, z);
      const cap = solid(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 0.8), dark)); cap.position.set(x, TH + H + 0.35, z);
      for (const sx of [-1, 1]) solid(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.9), gold)).position.set(x + sx * 1.0, TH + H + 0.75, z);
      w.addCollider(new THREE.Box3(new THREE.Vector3(x - 0.6, TH, z - 0.6), new THREE.Vector3(x + 0.6, TH + H + 1, z + 0.6)));
    }
    // a throne dais in the open middle (low cover)
    w.addBlock(0, TH, 0, 4, 0.9, 1.6, stone);
    solid(new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.25), gold)).position.set(0, TH + 1.7, -0.5);

    // ---- Gates of All Nations (south of centre for A, north for B) with lamassu
    both((s) => {
      const z = s * 48;
      for (const sx of [-1, 1]) w.addBlock(sx * 3.6, 0, z, 2.4, 7.5, 3, stone);
      const lintel = solid(new THREE.Mesh(new THREE.BoxGeometry(9.6, 1.2, 3.2), stone)); lintel.position.set(0, 8.1, z);
      w.addCollider(new THREE.Box3().setFromObject(lintel));
      solid(new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.25, 0.1), lapis)).position.set(0, 7.3, z + s * 1.62);
      for (const sx of [-1, 1]) lamassu(w, sx * 7.4, z, s, stone, gold, solid);
    });

    // ---- ruins: broken columns, relief walls, crates and urns (all mirrored)
    both((s) => {
      for (const [x, z, h] of [[20, 30, 3.2], [8, 30, 1.2], [24, 4, 2.4], [-20, 26, 1.6], [-8, 34, 2.8], [14, 62, 2], [-24, 60, 1.4]]) {
        const X = s * x, Z = s * z;
        solid(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, h, 12), stone)).position.set(X, h / 2, Z);
        w.addCollider(new THREE.Box3(new THREE.Vector3(X - 0.65, 0, Z - 0.65), new THREE.Vector3(X + 0.65, h, Z + 0.65)));
      }
      const drum = solid(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.4, 12), stone)); drum.rotation.z = Math.PI / 2; drum.position.set(s * 14, 0.6, s * 26);
      w.addCollider(new THREE.Box3(new THREE.Vector3(s * 14 - 0.7, 0, s * 26 - 0.6), new THREE.Vector3(s * 14 + 0.7, 1.2, s * 26 + 0.6)));
      for (const [x, z, sx, sz] of [[16, 18, 7, 0.7], [-18, 16, 0.7, 6], [26, 40, 0.7, 8], [-6, 60, 8, 0.7], [-27, -2, 0.7, 7]]) {
        const m = w.addBlock(s * x, 0, s * z, sx, 1.5, sz, relief);
        m.material = relief;
      }
      w.addCrate(s * 12, 0, s * 40, 2); w.addCrate(s * 13.8, 0, s * 40.4, 1.6); w.addCrate(s * -14, 0, s * 52, 2);
      w.addCrate(s * 28, 0, s * 20, 1.8); w.addCrate(s * -26, 0, s * 36, 2);
    });
    // two small palace buildings (one with stairs to a walled roof)
    addHouse(w, -22, 42, 9, 8, 5.2, { wallMat: stone, roofMat: stone, door: ['e', 's'], parapet: true, stairs: 'w', rug: '#1f3fa8' });
    addHouse(w, 22, -42, 9, 8, 5.2, { wallMat: stone, roofMat: stone, door: ['w', 'n'], parapet: true, stairs: 'e', rug: '#1f3fa8' });
    // palms and cypresses along the processional way
    for (const [x, z] of [[-6, 24], [6, 24], [-6, 64], [6, 64]]) both((s) => addTree(w, s * x, s * z, s > 0 ? makePalm : makePine, s > 0 ? 1.1 : 1.3));
    scatter(w, 30, 83, (x, z, r) => { const o = makeUrn(r, 1 + r() * 0.8); o.position.set(x, 0, z); o.rotation.y = r() * 6; w.scene.add(o); }, 1.4);
  },
};

/** relief wall texture: a procession of figures in a frieze */
function reliefTexture() {
  if (shared.relief) return shared.relief;
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#d8c09a'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#b89a72'; g.fillRect(0, 0, S, 18); g.fillRect(0, S - 18, S, 18);
  for (let row = 0; row < 2; row++) {
    const y0 = 30 + row * 108;
    for (let i = 0; i < 6; i++) {
      const x = 14 + i * 42;
      g.fillStyle = 'rgba(110,80,50,.55)';
      g.fillRect(x, y0 + 18, 16, 56);                         // robe
      g.beginPath(); g.arc(x + 8, y0 + 10, 8, 0, 7); g.fill(); // head
      g.fillRect(x + 4, y0 - 6, 8, 8);                        // tall hat
      g.fillRect(x + 16, y0 + 30, 10, 4);                     // arm with gift
      g.fillStyle = 'rgba(255,207,90,.7)'; g.fillRect(x + 24, y0 + 26, 6, 8);
    }
  }
  g.strokeStyle = 'rgba(31,63,168,.6)'; g.lineWidth = 4; g.strokeRect(2, 2, S - 4, S - 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return (shared.relief = t);
}

/** winged bull guardian standing by a gate, facing away from it (dir = ±1 along z) */
function lamassu(w, x, z, dir, stone, gold, solid) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = dir > 0 ? 0 : Math.PI;
  w.scene.add(g);
  const part = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = true; g.add(o); w.solids.push(o); w.cover.push(o); return o; };
  part(new THREE.BoxGeometry(1.6, 1.2, 3.6), stone, 0, 0.6, 0);            // plinth
  part(new THREE.BoxGeometry(1.4, 1.8, 3.2), stone, 0, 2.1, 0);            // body
  for (const lx of [-0.45, 0.45]) for (const lz of [-1.2, 1.2]) part(new THREE.BoxGeometry(0.35, 0.9, 0.35), stone, lx, 0.75, lz);
  part(new THREE.BoxGeometry(1.0, 1.3, 1.0), stone, 0, 3.4, 1.7);          // human head
  part(new THREE.CylinderGeometry(0.45, 0.5, 0.8, 10), gold, 0, 4.4, 1.7); // crown
  part(new THREE.BoxGeometry(0.9, 0.7, 0.3), stone, 0, 2.7, 2.2);          // beard
  for (const sx of [-1, 1]) {
    const wing = part(new THREE.BoxGeometry(0.12, 1.6, 2.8), gold, sx * 0.75, 3.2, -0.2);
    wing.rotation.x = -0.35;
  }
  w.addCollider(new THREE.Box3(new THREE.Vector3(x - 0.9, 0, z - 2.3), new THREE.Vector3(x + 0.9, 4.8, z + 2.3)));
}
