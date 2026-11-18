import * as THREE from 'three';
import { makeGlowTexture } from '../world/canyonParts.js';

const glowTex = makeGlowTexture(64);

function makeFlashTexture() {
  const s = 128, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.translate(s / 2, s / 2);
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, s / 2);
  grd.addColorStop(0, 'rgba(255,255,230,1)');
  grd.addColorStop(0.25, 'rgba(255,200,90,0.9)');
  grd.addColorStop(1, 'rgba(255,120,20,0)');
  g.fillStyle = grd;
  for (let i = 0; i < 7; i++) {
    g.rotate((Math.PI * 2) / 7);
    g.beginPath();
    g.moveTo(-6, 0); g.lineTo(0, -s / 2 * (0.6 + Math.random() * 0.4)); g.lineTo(6, 0);
    g.fill();
  }
  g.beginPath(); g.arc(0, 0, s * 0.22, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const flashTex = makeFlashTexture();

// unit cylinder spanning z = 0..1 (aim with lookAt, scale z = length)
const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
const shardGeo = new THREE.TetrahedronGeometry(1);
const decalGeo = new THREE.CircleGeometry(1, 10);
const shellGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.03, 8).rotateZ(Math.PI / 2);
const sphereGeo = new THREE.SphereGeometry(1, 16, 12);
const ringGeo = new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2);

const matCache = new Map();
function basicMat(color, additive = true, opacity = 1) {
  const key = color + additive + opacity;
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false, fog: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
  }
  return matCache.get(key);
}

const shardMats = {
  ice: new THREE.MeshStandardMaterial({ color: '#e6f7ff', emissive: '#4fb6ff', emissiveIntensity: 0.3, roughness: 0.2, flatShading: true }),
  hit: new THREE.MeshBasicMaterial({ color: '#ff8a3a' }),
  wood: new THREE.MeshStandardMaterial({ color: '#7a5636', roughness: 0.8 }),
};
const brassMat = new THREE.MeshStandardMaterial({ color: '#d4a640', metalness: 0.9, roughness: 0.3 });
const decalMat = new THREE.MeshBasicMaterial({
  map: glowTex, color: '#1a2633', transparent: true, opacity: 0.85, depthWrite: false,
  polygonOffset: true, polygonOffsetFactor: -4,
});

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

/** Visual effects: tracers, impacts, flashes, shells, explosions, lightning. */
export class Effects {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.items = [];     // { obj, life, max, update(dt,k) }
    this.decals = [];

    this.worldLight = new THREE.PointLight('#ffb35a', 0, 14, 1.6);
    this.scene.add(this.worldLight);
    this.worldLightT = 0;
  }

  add(obj, life, update, parent = this.scene) {
    parent.add(obj);
    this.items.push({ obj, life, max: life, update, parent });
    return obj;
  }

  /* ---- bullets ---- */
  tracer(from, to, color = '#ffc35a', width = 0.018, speed = 260) {
    const dist = from.distanceTo(to);
    if (dist < 0.3) return;
    const dir = _v.copy(to).sub(from).normalize().clone();
    const start = from.clone();
    const streak = Math.min(4, dist * 0.5);
    const mesh = new THREE.Mesh(beamGeo, basicMat(color, true, 0.95));
    const trail = new THREE.Mesh(beamGeo, basicMat(color, true, 0.18).clone());
    trail.position.copy(start);
    trail.lookAt(to);
    trail.scale.set(width * 0.5, width * 0.5, dist);
    const travel = dist / speed;
    let t = 0;
    this.add(mesh, travel + 0.02, (dt) => {
      t += dt;
      const head = Math.min(dist, t * speed);
      const tail = Math.max(0, head - streak);
      mesh.position.copy(start).addScaledVector(dir, tail);
      mesh.lookAt(_v2.copy(start).addScaledVector(dir, head + 0.001));
      mesh.scale.set(width, width, Math.max(0.01, head - tail));
    });
    this.add(trail, 0.12, (dt, k) => {
      trail.material.opacity = 0.18 * k;
      if (k <= 0.05) trail.material.dispose();
    });
  }

  burst(point, { count = 8, color = 'ice', speed = 4, size = 0.05, gravity = 12, life = 0.6, normal } = {}) {
    const mat = shardMats[color] || basicMat(color);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(shardGeo, mat);
      m.position.copy(point);
      const s = size * (0.5 + Math.random());
      m.scale.setScalar(s);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random()));
      if (normal) v.addScaledVector(normal, speed * 0.6);
      const spin = new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(12);
      this.add(m, life * (0.6 + Math.random() * 0.6), (dt, k) => {
        v.y -= gravity * dt;
        m.position.addScaledVector(v, dt);
        if (m.position.y < 0.02) { m.position.y = 0.02; v.multiplyScalar(0.4); v.y = Math.abs(v.y) * 0.3; }
        m.rotation.x += spin.x * dt; m.rotation.y += spin.y * dt;
        m.scale.setScalar(s * Math.min(1, k * 2));
      });
    }
  }

  puff(point, color = '#e8f6ff', size = 0.6, life = 0.5, opacity = 0.7) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, depthWrite: false }));
    sp.position.copy(point);
    sp.scale.setScalar(size * 0.4);
    this.add(sp, life, (dt, k) => {
      sp.scale.setScalar(size * (1.2 - k * 0.8));
      sp.material.opacity = opacity * k;
      sp.position.y += dt * 0.4;
      if (k <= 0.02) sp.material.dispose();
    });
  }

  impact(point, normal, kind = 'ice') {
    if (kind === 'hit') {
      this.burst(point, { count: 7, color: 'hit', speed: 3, size: 0.03, life: 0.35, normal });
      this.puff(point, '#ff9a5a', 0.5, 0.25, 0.8);
      return;
    }
    this.burst(point, { count: 6, color: kind === 'wood' ? 'wood' : 'ice', speed: 3.5, size: 0.04, normal });
    this.puff(point, '#eaf6ff', 0.7, 0.45, 0.6);
    if (normal) this.decal(point, normal);
  }

  decal(point, normal) {
    const d = new THREE.Mesh(decalGeo, decalMat);
    d.position.copy(point).addScaledVector(normal, 0.015);
    d.lookAt(_v.copy(d.position).add(normal));
    d.scale.setScalar(0.05 + Math.random() * 0.03);
    this.scene.add(d);
    this.decals.push(d);
    if (this.decals.length > 80) this.scene.remove(this.decals.shift());
  }

  /* ---- muzzle ---- */
  muzzleFlash(vmParent, vmPos, worldPos, scale = 1, color = '#ffd08a') {
    for (let i = 0; i < 2; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: flashTex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false,
        rotation: Math.random() * Math.PI * 2,
      }));
      sp.position.copy(vmPos);
      const s = (0.09 + Math.random() * 0.06) * scale * (i ? 0.6 : 1);
      sp.scale.setScalar(s);
      sp.renderOrder = 10;
      this.add(sp, 0.05, (dt, k) => { sp.material.opacity = k; if (k <= 0.05) sp.material.dispose(); }, vmParent);
    }
    this.worldLight.position.copy(worldPos);
    this.worldLight.intensity = 6 * scale;
    this.worldLightT = 0.06;
  }

  worldFlash(pos, scale = 0.6) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: flashTex, color: '#ffc070', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
      rotation: Math.random() * 6,
    }));
    sp.position.copy(pos);
    sp.scale.setScalar(scale);
    this.add(sp, 0.06, (dt, k) => { sp.material.opacity = k; if (k <= 0.05) sp.material.dispose(); });
  }

  shell(vmParent, pos, dir, big = false) {
    const m = new THREE.Mesh(shellGeo, big ? basicMat('#c8322b', false) : brassMat);
    if (big) m.scale.set(1.6, 1.6, 1.6);
    m.position.copy(pos);
    const v = dir.clone().multiplyScalar(1.4 + Math.random() * 0.6).add(new THREE.Vector3(0, 0.9 + Math.random() * 0.4, 0.3));
    const spin = 20 + Math.random() * 15;
    this.add(m, 0.7, (dt) => {
      v.y -= 6 * dt;
      m.position.addScaledVector(v, dt);
      m.rotation.z += spin * dt;
      m.rotation.y += spin * 0.5 * dt;
    }, vmParent);
  }

  /* ---- skills ---- */
  explosion(pos, color = '#ff8a3a', radius = 4) {
    const s = new THREE.Mesh(sphereGeo, basicMat(color, true, 0.8).clone());
    s.position.copy(pos);
    this.add(s, 0.45, (dt, k) => {
      s.scale.setScalar(radius * (1.15 - k));
      s.material.opacity = 0.8 * k;
      if (k <= 0.03) s.material.dispose();
    });
    this.ring(pos, color, radius * 1.1, 0.5);
    this.puff(pos.clone().setY(pos.y + 0.5), color, radius * 1.5, 0.6, 0.6);
    this.burst(pos, { count: 18, color: color === '#9fe7ff' ? 'ice' : color, speed: 9, size: 0.08, life: 0.8 });
    this.worldLight.position.copy(pos).setY(pos.y + 1);
    this.worldLight.color.set(color);
    this.worldLight.intensity = 25;
    this.worldLightT = 0.25;
  }

  ring(pos, color, radius, life = 0.5, y = 0.08) {
    const r = new THREE.Mesh(ringGeo, basicMat(color, true, 0.9).clone());
    r.material.side = THREE.DoubleSide;
    r.position.copy(pos).setY(pos.y + y);
    this.add(r, life, (dt, k) => {
      r.scale.setScalar(Math.max(0.01, radius * (1 - k * k)));
      r.material.opacity = 0.9 * k;
      if (k <= 0.03) r.material.dispose();
    });
  }

  lightning(from, to, color = '#8ff7ff', width = 0.03) {
    const segs = Math.max(4, Math.floor(from.distanceTo(to) / 1.5));
    const pts = [from.clone()];
    for (let i = 1; i < segs; i++) {
      const p = from.clone().lerp(to, i / segs);
      p.add(new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).multiplyScalar(0.7));
      pts.push(p);
    }
    pts.push(to.clone());
    for (let i = 0; i < pts.length - 1; i++) {
      for (const [w, op] of [[width, 1], [width * 4, 0.25]]) {
        const m = new THREE.Mesh(beamGeo, basicMat(color, true, op).clone());
        m.position.copy(pts[i]);
        m.lookAt(pts[i + 1]);
        m.scale.set(w, w, pts[i].distanceTo(pts[i + 1]));
        this.add(m, 0.28, (dt, k) => { m.material.opacity = op * k; if (k <= 0.04) m.material.dispose(); });
      }
    }
    this.worldLight.position.copy(to);
    this.worldLight.color.set(color);
    this.worldLight.intensity = 12;
    this.worldLightT = 0.15;
  }

  /** Biker chain: a line of steel links shooting out from `from` to `to` */
  chain(from, to) {
    const d = from.distanceTo(to), n = Math.max(3, Math.floor(d / 0.32));
    const mat = new THREE.MeshStandardMaterial({ color: '#b9c0c8', metalness: 1, roughness: 0.3 });
    const geo = new THREE.TorusGeometry(0.09, 0.025, 6, 10);
    const dir = to.clone().sub(from).normalize();
    for (let i = 0; i <= n; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(from).lerp(to, i / n);
      m.lookAt(m.position.clone().add(dir));
      m.rotateY(Math.PI / 2);
      if (i % 2) m.rotateX(Math.PI / 2);
      m.visible = false;
      const show = i / n * 0.12;
      let t = 0;
      this.add(m, 0.9, (dt, k) => { t += dt; m.visible = t >= show; if (k <= 0.03 && i === n) { geo.dispose(); mat.dispose(); } });
    }
  }

  /* ---- skin kill effects (linger ~4.5s at the kill spot) ---- */
  killFx(kind, pos) {
    pos = pos.clone().setY(0);
    if (kind === 'aurora') this.fxAurora(pos);
    else if (kind === 'inferno') this.fxInferno(pos);
    else if (kind === 'cyber') this.fxCyber(pos);
    else if (kind === 'xmas') this.fxXmas(pos);
  }

  /** Aurora: a light pillar with spiralling teal/violet ribbons and falling stardust */
  fxAurora(pos) {
    const life = 4.5;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.8, 9, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: '#5ff7d8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    pillar.position.copy(pos).setY(4.5);
    this.add(pillar, life, (dt, k) => {
      const t = life * (1 - k);
      pillar.material.opacity = Math.min(1, t * 3) * k * 0.45;
      pillar.material.color.setHSL(0.47 + Math.sin(t * 1.5) * 0.12, 0.9, 0.6);
      pillar.scale.x = pillar.scale.z = 1 + Math.sin(t * 4) * 0.08;
      if (k <= 0.02) { pillar.geometry.dispose(); pillar.material.dispose(); }
    });
    const ribbons = [];
    for (let i = 0; i < 26; i++) {
      const sp = this.glowSprite(i % 2 ? '#3fffd0' : '#9a6bff', 0.5);
      sp.userData = { a: (i / 26) * Math.PI * 6, h: (i / 26) * 7 };
      ribbons.push(sp);
    }
    const group = new THREE.Group();
    group.position.copy(pos);
    ribbons.forEach((r) => group.add(r));
    this.add(group, life, (dt, k) => {
      const t = life * (1 - k);
      for (const r of ribbons) {
        const a = r.userData.a + t * 2.2, h = (r.userData.h + t * 1.6) % 8;
        r.position.set(Math.cos(a) * (1.1 - h * 0.08), h, Math.sin(a) * (1.1 - h * 0.08));
        r.material.opacity = k * (1 - h / 8);
      }
    });
    this.ring(pos, '#5ff7d8', 3.5, 1.2);
    for (let i = 0; i < 3; i++) setTimeout(() => this.ring(pos, i % 2 ? '#9a6bff' : '#3fffd0', 2.5, 1.0), 400 + i * 600);
    // falling stardust
    let acc = 0;
    this.add(new THREE.Object3D(), life, (dt) => {
      acc += dt;
      while (acc > 0.05) {
        acc -= 0.05;
        this.burst(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 6 + Math.random() * 2, (Math.random() - 0.5) * 3)),
          { count: 1, color: Math.random() < 0.5 ? '#bffcff' : '#d6b8ff', speed: 0.3, size: 0.05, gravity: 3, life: 2 });
      }
    });
    this.flashLight(pos, '#5ff7d8', 14, 0.8);
  }

  /** Inferno: fire burst, then a burning dragon glyph circle with embers that lingers */
  fxInferno(pos) {
    const life = 5;
    this.explosion(pos.clone().setY(1), '#ff6a1a', 3);
    // glyph: two concentric rings + 6 claw marks, drawn on a canvas texture
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.translate(128, 128);
    g.strokeStyle = '#ff7a20'; g.shadowColor = '#ff5000'; g.shadowBlur = 14; g.lineWidth = 6;
    g.beginPath(); g.arc(0, 0, 110, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 88, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 6; i++) {
      g.rotate(Math.PI / 3);
      g.lineWidth = 5; g.strokeStyle = i % 2 ? '#ffc040' : '#ff7a20';
      g.beginPath(); g.moveTo(10, -20); g.quadraticCurveTo(50, -10, 80, -40); g.stroke();
    }
    g.fillStyle = '#ffd060'; g.font = '900 64px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.rotate(-Math.PI * 2); g.fillText('龍', 0, 4);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const glyph = new THREE.Mesh(new THREE.PlaneGeometry(4, 4).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    glyph.position.copy(pos).setY(0.06);
    this.add(glyph, life, (dt, k) => {
      const t = life * (1 - k);
      glyph.material.opacity = Math.min(1, t * 2) * Math.min(1, k * 3) * (0.8 + Math.random() * 0.2);
      glyph.rotation.y += dt * 0.4;
      if (k <= 0.02) { glyph.geometry.dispose(); glyph.material.dispose(); tex.dispose(); }
    });
    // ring of flames
    const flames = new THREE.Group();
    flames.position.copy(pos);
    const fl = [];
    for (let i = 0; i < 16; i++) {
      const sp = this.glowSprite(i % 3 ? '#ff6a1a' : '#ffd060', 0.6);
      const a = (i / 16) * Math.PI * 2;
      sp.userData = { a, ph: Math.random() * 6 };
      flames.add(sp); fl.push(sp);
    }
    const light = new THREE.PointLight('#ff6a1a', 0, 10, 1.5);
    light.position.y = 1;
    flames.add(light);
    this.add(flames, life, (dt, k) => {
      for (const f of fl) {
        f.userData.ph += dt * 9;
        const s = (0.5 + Math.sin(f.userData.ph) * 0.2) * Math.min(1, k * 3);
        f.scale.set(s, s * 1.8, 1);
        f.position.set(Math.cos(f.userData.a) * 1.9, 0.4 + Math.sin(f.userData.ph * 0.7) * 0.1, Math.sin(f.userData.a) * 1.9);
      }
      light.intensity = (5 + Math.random() * 3) * Math.min(1, k * 3);
      if (Math.random() < 0.5) this.burst(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3.5, 0.2, (Math.random() - 0.5) * 3.5)),
        { count: 1, color: '#ffb35a', speed: 0.6, size: 0.04, gravity: -3, life: 1.2 });
    });
  }

  /** Cyber: glitching hologram cube rising, neon rings and floating pixels */
  fxCyber(pos) {
    const life = 4.5;
    const cube = new THREE.Group();
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({ color: '#3ff6ff', transparent: true }));
    const inner = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.45, 0)),
      new THREE.LineBasicMaterial({ color: '#ff2bd6', transparent: true }));
    const core = this.glowSprite('#ff2bd6', 1.2);
    cube.add(edges, inner, core);
    cube.position.copy(pos).setY(1);
    this.add(cube, life, (dt, k) => {
      const t = life * (1 - k);
      cube.position.y = 1 + Math.min(1.2, t * 0.8) + Math.sin(t * 3) * 0.08;
      cube.rotation.y += dt * 1.6; cube.rotation.x += dt * 0.7;
      inner.rotation.y -= dt * 3;
      const glitch = Math.random() < 0.12;
      cube.position.x = pos.x + (glitch ? (Math.random() - 0.5) * 0.3 : 0);
      cube.scale.setScalar((glitch ? 1.15 : 1) * Math.min(1, t * 4));
      edges.material.opacity = inner.material.opacity = k * (glitch ? 0.4 : 1);
      core.material.opacity = k * 0.8;
      if (k <= 0.02) { edges.geometry.dispose(); inner.geometry.dispose(); edges.material.dispose(); inner.material.dispose(); }
    });
    // floor grid
    const grid = new THREE.GridHelper(4, 10, '#ff2bd6', '#3ff6ff');
    grid.material.transparent = true;
    grid.material.depthWrite = false;
    grid.position.copy(pos).setY(0.05);
    this.add(grid, life, (dt, k) => {
      const t = life * (1 - k);
      grid.material.opacity = Math.min(1, t * 2) * k * 0.8;
      if (k <= 0.02) { grid.geometry.dispose(); grid.material.dispose(); }
    });
    for (let i = 0; i < 4; i++) setTimeout(() => this.ring(pos, i % 2 ? '#ff2bd6' : '#3ff6ff', 3, 0.9), i * 500);
    // floating pixels
    const pixGeo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
    for (let i = 0; i < 22; i++) {
      const m = new THREE.Mesh(pixGeo, new THREE.MeshBasicMaterial({ color: i % 2 ? '#ff2bd6' : '#3ff6ff', transparent: true }));
      const start = pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.5, Math.random() * 0.5, (Math.random() - 0.5) * 2.5));
      const v = 0.4 + Math.random() * 0.8, delay = Math.random() * 1.5;
      m.position.copy(start);
      this.add(m, life, (dt, k) => {
        const t = life * (1 - k) - delay;
        m.visible = t > 0;
        m.position.y = start.y + Math.max(0, t) * v;
        m.material.opacity = k * (Math.random() < 0.1 ? 0.2 : 1);
        if (k <= 0.02) m.material.dispose();
      });
    }
    this.flashLight(pos, '#ff2bd6', 12, 0.6);
  }

  /** flamethrower: a puff of fire sprites streaming from 'from' along 'dir' (range metres) */
  flame(from, dir, range = 9, n = 3) {
    for (let i = 0; i < n; i++) {
      const col = ['#ffd35a', '#ff8a2a', '#ff5a14'][i % 3];
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
      const v = dir.clone().multiplyScalar(range * (1.5 + Math.random() * 0.5));
      v.x += (Math.random() - 0.5) * 2.2; v.y += (Math.random() - 0.3) * 1.8; v.z += (Math.random() - 0.5) * 2.2;
      sp.position.copy(from).addScaledVector(dir, Math.random() * 0.4);
      const life = 0.45 + Math.random() * 0.2;
      sp.scale.setScalar(0.15);
      this.add(sp, life, (dt, k) => {
        sp.position.addScaledVector(v, dt);
        v.multiplyScalar(1 - dt * 1.8); v.y += dt * 2.5;
        sp.scale.setScalar(0.2 + (1 - k) * 1.6);
        sp.material.opacity = Math.min(1, k * 1.6) * 0.85;
        if (k <= 0.02) sp.material.dispose();
      });
    }
    if (Math.random() < 0.3) this.puff(from.clone().addScaledVector(dir, range * 0.8), '#5a4a40', 1.4, 0.8, 0.25);
  }

  /** Christmas: a gift box pops up and bursts into snowflakes, ribbons and a small tree of lights */
  fxXmas(pos) {
    const life = 4;
    const gift = new THREE.Group();
    const red = new THREE.MeshStandardMaterial({ color: '#d0202a', roughness: 0.5 });
    const gold = new THREE.MeshStandardMaterial({ color: '#ffd24a', metalness: 0.8, roughness: 0.3, emissive: '#6a4a00', emissiveIntensity: 0.4 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), red);
    const lid = new THREE.Group();
    lid.add(new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.16, 0.88), red));
    lid.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.17, 0.14), gold), new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.17, 0.9), gold));
    const bow1 = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 6, 12), gold); bow1.position.set(-0.12, 0.16, 0); bow1.rotation.y = Math.PI / 2;
    const bow2 = bow1.clone(); bow2.position.x = 0.12;
    lid.add(bow1, bow2);
    lid.position.y = 0.38;
    box.add(new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.61, 0.14), gold), new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.61, 0.82), gold));
    gift.add(box, lid);
    gift.position.copy(pos).setY(0.3);
    let popped = false;
    this.add(gift, life, (dt, k) => {
      const t = life * (1 - k);
      gift.scale.setScalar(Math.min(1, t * 5) * (t < 0.9 ? 1 + Math.sin(t * 30) * 0.05 * (0.9 - t) : 1));
      gift.rotation.y += dt * 0.8;
      if (t > 0.9) { lid.position.y += dt * 4; lid.rotation.x += dt * 5; lid.rotation.z += dt * 3; }
      if (t > 0.9 && !popped) {
        popped = true;
        this.burst(pos.clone().setY(0.8), { count: 26, color: '#ffffff', speed: 7, size: 0.07, gravity: 3, life: 2 });
        this.burst(pos.clone().setY(0.8), { count: 12, color: '#ff3a4a', speed: 6, size: 0.06, gravity: 5, life: 1.5 });
        this.burst(pos.clone().setY(0.8), { count: 12, color: '#3adf6a', speed: 6, size: 0.06, gravity: 5, life: 1.5 });
        this.ring(pos, '#ffd24a', 3, 0.8);
        this.flashLight(pos, '#ffd24a', 10, 0.5);
      }
      if (k < 0.3) gift.scale.multiplyScalar(k / 0.3);
      if (k <= 0.02) gift.traverse((o) => o.geometry?.dispose());
    });
    // gently falling snow around the spot
    const flakeGeo = new THREE.OctahedronGeometry(0.05, 0);
    for (let i = 0; i < 30; i++) {
      const m = new THREE.Mesh(flakeGeo, basicMat('#ffffff', false, 0.9));
      const start = pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 2.5 + Math.random() * 2, (Math.random() - 0.5) * 4));
      const sp = 0.5 + Math.random() * 0.5, ph = Math.random() * 6;
      m.position.copy(start);
      this.add(m, life, (dt, k) => {
        const t = life * (1 - k);
        m.position.y = Math.max(0.05, start.y - t * sp);
        m.position.x = start.x + Math.sin(t * 2 + ph) * 0.2;
        m.rotation.y += dt * 2;
        m.visible = k > 0.05;
      });
    }
  }

  flashLight(pos, color, intensity, time) {
    this.worldLight.position.copy(pos).setY(1.5);
    this.worldLight.color.set(color);
    this.worldLight.intensity = intensity;
    this.worldLightT = time;
  }

  glowSprite(color, size) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    sp.scale.setScalar(size);
    return sp;
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      const k = Math.max(0, it.life / it.max);
      it.update?.(dt, k);
      if (it.life <= 0) {
        it.parent.remove(it.obj);
        this.items.splice(i, 1);
      }
    }
    if (this.worldLightT > 0) {
      this.worldLightT -= dt;
      if (this.worldLightT <= 0) { this.worldLight.intensity = 0; this.worldLight.color.set('#ffb35a'); }
    }
  }
}
