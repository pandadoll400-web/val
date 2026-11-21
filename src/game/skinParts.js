import * as THREE from 'three';

/*
 * Bundle skins change the weapon's shape, not only its paint: each bundle bolts its own parts onto the
 * model. Parts are placed from the gun's bounding box and muzzle, so one recipe fits every weapon.
 * Moving parts are driven by model.skinAnim(t).
 */

const mats = {};
function M(key, o) { return mats[key] || (mats[key] = new THREE.MeshStandardMaterial(o)); }

let candyTex = null;
function candy() {
  if (candyTex) return candyTex;
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#d81e2a';
  for (let i = -S; i < S * 2; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 14, 0); g.lineTo(i + 14 - S, S); g.lineTo(i - S, S); g.fill(); }
  g.fillStyle = '#2aa04a';
  for (let i = -S + 18; i < S * 2; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 5, 0); g.lineTo(i + 5 - S, S); g.lineTo(i - S, S); g.fill(); }
  candyTex = new THREE.CanvasTexture(c);
  candyTex.wrapS = candyTex.wrapT = THREE.RepeatWrapping;
  candyTex.repeat.set(1, 3);
  candyTex.colorSpace = THREE.SRGBColorSpace;
  return candyTex;
}

const add = (parent, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.userData.skinPart = true;
  parent.add(m);
  return m;
};
/** parts that sit in the line of sight: hidden while aiming down sights */
let AIM = [];
const aim = (o) => { AIM.push(o); return o; };
const addA = (...a) => aim(add(...a));

/** where to put things on this gun */
function measure(model) {
  const g = model.group;
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  const size = box.getSize(new THREE.Vector3());
  const muzzle = model.muzzle ? model.muzzle.position.clone() : new THREE.Vector3(0, (box.min.y + box.max.y) / 2, box.min.z);
  const s = THREE.MathUtils.clamp(Math.max(size.z, size.y * 0.8) / 0.6, 0.35, 1.4); // part scale
  const meshes = [];
  g.traverse((o) => { if (o.isMesh) meshes.push(o); });
  return { box, size, muzzle, s, meshes, melee: model.kind === 'melee' || !model.muzzle, cx: (box.min.x + box.max.x) / 2 };
}

const _ray = new THREE.Raycaster();
/** the gun's cross-section at depth z: top / bottom / mid height and left / right side (null if nothing there) */
function surf(m, z) {
  const cast = (o, d) => { _ray.set(o, d); return _ray.intersectObjects(m.meshes, false)[0]; };
  const t = cast(new THREE.Vector3(m.cx, m.box.max.y + 0.2, z), new THREE.Vector3(0, -1, 0));
  if (!t) return null;
  const b = cast(new THREE.Vector3(m.cx, m.box.min.y - 0.2, z), new THREE.Vector3(0, 1, 0));
  const top = t.point.y, bottom = b ? b.point.y : top - 0.02;
  // sides measured just under the top, where the receiver / barrel is
  const y = top - Math.min(0.02, (top - bottom) * 0.3);
  const r = cast(new THREE.Vector3(m.box.max.x + 0.2, y, z), new THREE.Vector3(-1, 0, 0));
  const l = cast(new THREE.Vector3(m.box.min.x - 0.2, y, z), new THREE.Vector3(1, 0, 0));
  return { top, bottom, y, right: r ? r.point.x : m.cx + 0.01, left: l ? l.point.x : m.cx - 0.01 };
}
const zAt = (m, k) => m.box.max.z - m.size.z * k;

/** n points spread along the top surface of the gun, back → front (found by casting down onto the model) */
function alongTop(m, n, from = 0.15, to = 0.8) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const k = from + (to - from) * (n === 1 ? 0.5 : i / (n - 1));
    const z = m.box.max.z - m.size.z * k;
    _ray.set(new THREE.Vector3(m.cx, m.box.max.y + 0.2, z), new THREE.Vector3(0, -1, 0));
    const hit = _ray.intersectObjects(m.meshes, false)[0];
    if (hit) out.push(new THREE.Vector3(hit.point.x, hit.point.y, z));
  }
  return out;
}

function aurora(model, m) {
  const g = model.group, s = m.s;
  const ice = M('ice', { color: '#c8f6ff', emissive: '#3fd8ff', emissiveIntensity: 0.6, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.85, flatShading: true });
  const spike = (h) => new THREE.OctahedronGeometry(1, 0).scale(0.012 * s, h * s, 0.012 * s);
  // crystal ridge on top
  alongTop(m, 5).forEach((p, i) => {
    const h = 0.022 + (i % 2 ? 0.006 : 0.014);
    addA(g, spike(h), ice, p.x, p.y + h * s * 0.5, p.z, -0.35 + Math.random() * 0.2, 0, (Math.random() - 0.5) * 0.4);
  });
  // side clusters
  for (let i = 0; i < 2; i++) {
    const z = zAt(m, 0.35 + i * 0.2), c = surf(m, z);
    if (!c) continue;
    for (const sx of [-1, 1]) add(g, spike(0.018), ice, (sx > 0 ? c.right : c.left) + sx * 0.008 * s, c.y, z, 0, 0, sx * -1.1);
  }
  // crystal crown around the muzzle
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, r = 0.022 * s;
    const c = addA(g, spike(0.022), ice, m.muzzle.x + Math.cos(a) * r, m.muzzle.y + Math.sin(a) * r, m.muzzle.z + 0.01);
    c.rotation.set(-Math.PI / 2 + Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
  }
  // three light shards orbiting the barrel
  const orbit = new THREE.Group();
  orbit.position.set(m.muzzle.x, m.muzzle.y, m.muzzle.z + m.size.z * 0.3);
  g.add(aim(orbit));
  const glow = M('auroraGlow', { color: '#ffffff', emissive: '#7af7ff', emissiveIntensity: 2.4 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2, r = 0.06 * s;
    add(orbit, new THREE.OctahedronGeometry(0.008 * s, 0), glow, Math.cos(a) * r, Math.sin(a) * r, 0);
  }
  return (t) => { orbit.rotation.z = t * 1.6; orbit.children.forEach((c, i) => { c.rotation.y = t * 3 + i; c.position.z = Math.sin(t * 2 + i * 2) * 0.01; }); };
}

function inferno(model, m) {
  const g = model.group, s = m.s;
  const scaleMat = M('scale', { color: '#2a1410', metalness: 0.7, roughness: 0.35, emissive: '#ff3a00', emissiveIntensity: 0.25 });
  const gold = M('gold', { color: '#f2c45a', metalness: 1, roughness: 0.2 });
  // overlapping dragon scales on both sides
  const sg = new THREE.SphereGeometry(1, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.016 * s, 0.006 * s, 0.02 * s).rotateZ(Math.PI / 2);
  for (let row = 0; row < 2; row++) for (let i = 0; i < 6; i++) {
    const z = zAt(m, 0.2 + i * 0.09 + row * 0.045), c = surf(m, z);
    if (!c) continue;
    const y = c.y - row * Math.min(0.018 * s, (c.top - c.bottom) * 0.4);
    for (const sx of [-1, 1]) {
      const p = add(g, sg, scaleMat, sx > 0 ? c.right : c.left, y, z);
      if (sx < 0) p.rotation.y = Math.PI;
    }
  }
  // golden spine
  alongTop(m, 6, 0.1, 0.7).forEach((p, i) => addA(g, new THREE.ConeGeometry(0.008 * s, (0.03 - i * 0.002) * s, 4), gold, p.x, p.y + 0.012 * s, p.z, -0.6, 0, 0));
  // horned dragon jaw at the muzzle
  for (const sx of [-1, 1]) {
    addA(g, new THREE.ConeGeometry(0.008 * s, 0.07 * s, 6), gold, m.muzzle.x + sx * 0.02 * s, m.muzzle.y + 0.025 * s, m.muzzle.z + 0.04 * s, 1.1, 0, sx * -0.35);
  }
  addA(g, new THREE.ConeGeometry(0.02 * s, 0.06 * s, 4).rotateX(-Math.PI / 2), scaleMat, m.muzzle.x, m.muzzle.y - 0.022 * s, m.muzzle.z + 0.02 * s);
  for (const sx of [-1, 1]) addA(g, new THREE.SphereGeometry(0.004 * s, 6, 4), M('dragonEye', { color: '#ffcc33', emissive: '#ff8800', emissiveIntensity: 3 }), m.muzzle.x + sx * 0.016 * s, m.muzzle.y + 0.012 * s, m.muzzle.z + 0.03 * s);
  // ember at the muzzle
  const ember = addA(g, new THREE.SphereGeometry(0.007 * s, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff9a2a', transparent: true }), m.muzzle.x, m.muzzle.y, m.muzzle.z - 0.01);
  return (t) => { const f = 0.7 + Math.sin(t * 17) * 0.15 + Math.sin(t * 7.3) * 0.15; ember.scale.setScalar(f); ember.material.opacity = 0.6 + f * 0.3; };
}

function cyber(model, m) {
  const g = model.group, s = m.s;
  const neonP = M('neonP', { color: '#ff2bd6', emissive: '#ff2bd6', emissiveIntensity: 2.4 });
  const neonC = M('neonC', { color: '#3ff6ff', emissive: '#3ff6ff', emissiveIntensity: 2 });
  // holographic sight window
  const top = alongTop(m, 1, 0.45, 0.45)[0] || alongTop(m, 1, 0.3, 0.3)[0] || new THREE.Vector3(m.cx, m.box.max.y, zAt(m, 0.45));
  const holo = new THREE.Group();
  holo.position.set(top.x, top.y + 0.03 * s, top.z);
  g.add(aim(holo));
  const pane = add(holo, new THREE.PlaneGeometry(0.05 * s, 0.032 * s), new THREE.MeshBasicMaterial({ color: '#3ff6ff', transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }), 0, 0, 0);
  for (const [w, h, x, y] of [[0.052, 0.002, 0, 0.016], [0.052, 0.002, 0, -0.016], [0.002, 0.034, 0.026, 0], [0.002, 0.034, -0.026, 0]]) add(holo, new THREE.BoxGeometry(w * s, h * s, 0.002), neonC, x * s, y * s, 0);
  add(holo, new THREE.TorusGeometry(0.006 * s, 0.0007 * s, 4, 16), neonP, 0, 0, 0.001);
  for (const sx of [-1, 1]) addA(g, new THREE.BoxGeometry(0.003 * s, 0.03 * s, 0.004 * s), M('cyberPost', { color: '#1b1d24' }), top.x + sx * 0.024 * s, top.y + 0.012 * s, top.z);
  // neon fins
  for (let i = 0; i < 2; i++) {
    const z = zAt(m, 0.55 + i * 0.12), c = surf(m, z);
    if (!c) continue;
    for (const sx of [-1, 1]) addA(g, new THREE.BoxGeometry(0.003 * s, 0.026 * s, 0.045 * s), i ? neonC : neonP, (sx > 0 ? c.right : c.left) + sx * 0.008 * s, c.top, z, 0.5, 0, sx * 0.6);
  }
  // blinking LED strip on both sides
  const led = new THREE.MeshStandardMaterial({ color: '#3ff6ff', emissive: '#3ff6ff', emissiveIntensity: 2 });
  const leds = [];
  for (let i = 0; i < 5; i++) {
    const z = zAt(m, 0.2 + i * 0.07), c = surf(m, z);
    if (!c) continue;
    for (const sx of [-1, 1]) leds.push(add(g, new THREE.BoxGeometry(0.002, 0.006 * s, 0.012 * s), led.clone(), (sx > 0 ? c.right : c.left) + sx * 0.001, c.y, z));
  }
  return (t) => {
    pane.material.opacity = 0.2 + Math.sin(t * 9) * 0.05 + (Math.random() < 0.02 ? 0.2 : 0);
    leds.forEach((l, i) => { l.material.emissiveIntensity = ((Math.floor(t * 8) + i) % 5 === 0) ? 4 : 0.6; });
  };
}

function xmas(model, m) {
  const g = model.group, s = m.s;
  const candyMat = M('candy', { color: '#ffffff', map: candy(), roughness: 0.3, metalness: 0.05 });
  const green = M('holly', { color: '#1f8a3a', roughness: 0.5, flatShading: true });
  const berry = M('berry', { color: '#e0182a', roughness: 0.25, emissive: '#600008', emissiveIntensity: 0.4 });
  const ribbon = M('ribbon', { color: '#d81e2a', roughness: 0.35, metalness: 0.2 });
  const gold = M('xgold', { color: '#ffd24a', metalness: 0.9, roughness: 0.25 });
  const snow = M('snow', { color: '#ffffff', roughness: 0.9, emissive: '#cfe8ff', emissiveIntensity: 0.15 });
  if (!m.melee) {
    // candy-cane sleeve over the front of the barrel
    const len = m.size.z * 0.28;
    addA(g, new THREE.CylinderGeometry(0.014 * s, 0.014 * s, len, 14).rotateX(Math.PI / 2), candyMat, m.muzzle.x, m.muzzle.y, m.muzzle.z + len / 2 + 0.005);
    // holly at the muzzle
    for (let i = 0; i < 3; i++) {
      const a = -0.6 + i * 0.6;
      addA(g, new THREE.SphereGeometry(1, 6, 4).scale(0.008 * s, 0.002 * s, 0.018 * s), green, m.muzzle.x + Math.sin(a) * 0.02 * s, m.muzzle.y + 0.018 * s, m.muzzle.z + 0.03 * s, 0.3, a, 0);
    }
    for (let i = 0; i < 3; i++) addA(g, new THREE.SphereGeometry(0.0055 * s, 8, 6), berry, m.muzzle.x + (i - 1) * 0.006 * s, m.muzzle.y + 0.022 * s, m.muzzle.z + 0.022 * s);
  } else {
    // candy stripes around the handle end of melee weapons + holly at the guard
    add(g, new THREE.CylinderGeometry(0.014 * s, 0.014 * s, m.size.z * 0.25, 12).rotateX(Math.PI / 2), candyMat, m.cx, (m.box.min.y + m.box.max.y) / 2, m.box.max.z - m.size.z * 0.15);
  }
  // snow piled along the top
  alongTop(m, 4, 0.2, 0.7).forEach((p, i) => addA(g, new THREE.SphereGeometry(1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale((0.012 - (i % 2) * 0.003) * s, 0.006 * s, 0.018 * s), snow, p.x, p.y, p.z));
  // ribbon bow on the left side
  const bz = zAt(m, 0.3), bc = surf(m, bz) || { y: (m.box.min.y + m.box.max.y) / 2, left: m.cx - m.size.x * 0.5 };
  const by = bc.y, bx = bc.left - 0.004;
  for (const sz of [-1, 1]) add(g, new THREE.TorusGeometry(0.012 * s, 0.003 * s, 6, 12), ribbon, bx, by + 0.006 * s, bz + sz * 0.012 * s, 0, Math.PI / 2, sz * 0.5);
  add(g, new THREE.SphereGeometry(0.005 * s, 8, 6), ribbon, bx, by, bz);
  for (const sz of [-1, 1]) add(g, new THREE.BoxGeometry(0.002, 0.024 * s, 0.006 * s), ribbon, bx, by - 0.012 * s, bz + sz * 0.006 * s, sz * 0.3, 0, 0);
  // hanging ornaments under the gun
  const balls = [];
  [['#e0182a', 0.35], ['#ffd24a', 0.5], ['#2a7bff', 0.62]].forEach(([col, k], i) => {
    const z = zAt(m, k), c = surf(m, z);
    if (!c) return;
    const hang = new THREE.Group();
    hang.position.set(m.cx + (i - 1) * 0.008, c.bottom, z);
    g.add(hang);
    add(hang, new THREE.CylinderGeometry(0.0007, 0.0007, 0.025 * s, 4), gold, 0, -0.0125 * s, 0);
    add(hang, new THREE.SphereGeometry(0.009 * s, 12, 8), M('orn' + i, { color: col, metalness: 0.8, roughness: 0.15 }), 0, -0.03 * s, 0);
    add(hang, new THREE.CylinderGeometry(0.003 * s, 0.003 * s, 0.004 * s, 8), gold, 0, -0.021 * s, 0);
    balls.push(hang);
  });
  return (t) => balls.forEach((b, i) => { b.rotation.x = Math.sin(t * 2.4 + i * 1.7) * 0.25; b.rotation.z = Math.sin(t * 1.9 + i) * 0.15; });
}

/* v2.1 Persepolis: gold winged disc on both sides, gold muzzle rings, turquoise studs along the top */
function perse(model, m) {
  const g = model.group, s = m.s;
  const gold = M('pgold', { color: '#ffcf5a', metalness: 1, roughness: 0.2, emissive: '#5a3a00', emissiveIntensity: 0.25 });
  const lapis = M('plapis', { color: '#1f3fa8', metalness: 0.4, roughness: 0.3, emissive: '#0a1a5a', emissiveIntensity: 0.3 });
  const turq = M('pturq', { color: '#3fe0d0', metalness: 0.3, roughness: 0.2, emissive: '#1fa89a', emissiveIntensity: 0.6 });
  if (!m.melee) {
    for (let i = 0; i < 2; i++) addA(g, new THREE.TorusGeometry(0.016 * s, 0.0035 * s, 8, 18), gold, m.muzzle.x, m.muzzle.y, m.muzzle.z + 0.006 + i * 0.014 * s);
  }
  // winged disc (faravahar-like) on each side
  const z = zAt(m, 0.4), c = surf(m, z) || { y: (m.box.min.y + m.box.max.y) / 2, left: m.cx - m.size.x * 0.5, right: m.cx + m.size.x * 0.5 };
  const discs = [];
  for (const sx of [-1, 1]) {
    const grp = new THREE.Group();
    grp.position.set((sx > 0 ? c.right : c.left) + sx * 0.003, c.y, z);
    grp.rotation.y = sx * Math.PI / 2;
    g.add(grp);
    add(grp, new THREE.CylinderGeometry(0.011 * s, 0.011 * s, 0.003, 18).rotateX(Math.PI / 2), lapis, 0, 0, 0);
    add(grp, new THREE.TorusGeometry(0.011 * s, 0.0022 * s, 6, 18), gold, 0, 0, 0.001);
    for (const wx of [-1, 1]) for (let k = 0; k < 3; k++) {
      add(grp, new THREE.BoxGeometry(0.03 * s - k * 0.007 * s, 0.0035 * s, 0.002), gold, wx * (0.024 * s - k * 0.002 * s), 0.004 * s - k * 0.0045 * s, 0.001, 0, 0, wx * (0.18 + k * 0.08));
    }
    discs.push(grp);
  }
  // turquoise studs along the top
  alongTop(m, 4, 0.25, 0.7).forEach((p) => addA(g, new THREE.OctahedronGeometry(0.006 * s), turq, p.x, p.y + 0.004 * s, p.z));
  return (t) => discs.forEach((d) => (d.children[0].material.emissiveIntensity = 0.3 + Math.sin(t * 3) * 0.15));
}

const RECIPES = { aurora, inferno, cyber, xmas, perse };

/** bolt the bundle's own parts onto a freshly built weapon model */
export function addSkinParts(bundleId, weaponId, model) {
  const fn = RECIPES[bundleId];
  if (!fn) return;
  // measure and build in the model's own frame (some models are rotated for the hand pose)
  const g = model.group, pos = g.position.clone(), rot = g.rotation.clone(), scl = g.scale.clone();
  g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); g.scale.set(1, 1, 1);
  const m = measure(model);
  AIM = [];
  const anim = fn(model, m);
  model.aimParts = AIM;
  AIM = [];
  g.position.copy(pos); g.rotation.copy(rot); g.scale.copy(scl);
  m.box = null;
  model.group.traverse((o) => { if (o.userData.skinPart) o.castShadow = false; });
  if (anim) model.skinAnim = anim;
}
