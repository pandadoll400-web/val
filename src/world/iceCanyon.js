import * as THREE from 'three';
import { mulberry32, fbm } from '../util/noise.js';
import {
  FOG_COLOR, makeSky, makeEnvironment, createCliffGeometry, updateCliff, cliffMaterial,
  makeCrystalCluster, makeIceRock, makeSnow,
} from './canyonParts.js';
import { getTheme, makeTree, makeMushroom, makeBush, makeFlowers, makeHive, makeHiveBox, honeycombTexture, makePine, makePalm, makeReeds, makeCactus, makeThemeProp, floorDetailTexture, makeUrn, makeXmasTree, makeGiftProp } from './themes.js';
import { MAP_LAYOUTS } from './maps.js';

const HALF_W = 34;   // playable half-width (x)
const HALF_L = 84;   // playable half-length (z)

const crateMat = new THREE.MeshStandardMaterial({ color: '#7a5636', roughness: 0.8 });
const crateEdgeMat = new THREE.MeshStandardMaterial({ color: '#3d2c1e', roughness: 0.8 });
const iceBlockMat = new THREE.MeshStandardMaterial({
  color: '#a9dcf5', roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.92, flatShading: true,
  emissive: '#0d3b5e', emissiveIntensity: 0.35,
});
const rockMat = new THREE.MeshStandardMaterial({ color: '#d4ebf8', roughness: 0.38, flatShading: true });

/**
 * Playable ice canyon. Holds collision boxes (`colliders`) and raycastable meshes (`solids`).
 * layout: 'range' (training) — 'arena' arrives in a later stage.
 */
export class IceCanyonWorld {
  constructor(scene, renderer, layout = 'arena', themeId = 'ice') {
    this.scene = scene;
    this.layout = layout;
    const T = this.theme = getTheme(themeId);
    // the training range (booth at z 76) is built for the default size, whatever the theme
    [this.halfW, this.halfL] = layout === 'range' ? [HALF_W, HALF_L] : (T.size || [HALF_W, HALF_L]);
    // materials of this map
    const b = T.block;
    this.mats = {
      block: themeId === 'ice' ? iceBlockMat : new THREE.MeshStandardMaterial({ color: b.color, emissive: b.emissive, emissiveIntensity: b.emissiveIntensity, roughness: b.roughness,
        transparent: b.opacity < 1, opacity: b.opacity, flatShading: !b.honeycomb, map: b.honeycomb ? honeycombTexture() : null }),
      rock: themeId === 'ice' ? rockMat : new THREE.MeshStandardMaterial({ color: T.rock, roughness: 0.85, flatShading: true }),
      crate: themeId === 'ice' ? crateMat : new THREE.MeshStandardMaterial({ color: T.crate[0], roughness: 0.8 }),
      crateEdge: themeId === 'ice' ? crateEdgeMat : new THREE.MeshStandardMaterial({ color: T.crate[1], roughness: 0.8 }),
    };
    this.colliders = [];
    this.solids = [];
    this.cover = [];   // meshes that block line of sight (no floor/cliffs)
    this.spawns = [];
    this.water = [];   // shallow water ellipses {x, z, rx, rz}
    this.islands = []; // dry circles inside the water {x, z, r}
    this.ice = [];     // frozen sheets (walkable, icy footsteps)
    this.zones = [];   // capture zones (campsite)
    this.flickers = []; // campfire lights
    this.teamSpawns = { A: [0, 76, 0], B: [0, -72, Math.PI], C: [28, 0, Math.PI / 2] };
    this.crateMat = this.mats.crate;
    this.rng = mulberry32(2024);
    this.time = 0;

    scene.fog = new THREE.Fog(T.fog, T.fogNear, T.fogFar);
    this.sky = makeSky(T);
    scene.add(this.sky);
    scene.environment = makeEnvironment(renderer, T);
    scene.environmentIntensity = 0.7;
    this.envMap = scene.environment;

    scene.add(new THREE.HemisphereLight(T.hemi[0], T.hemi[1], T.hemi[2]));
    const sun = new THREE.DirectionalLight(T.sun[0], T.sun[1]);
    sun.position.set(40, 70, -90);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110; sc.near = 1; sc.far = 300;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.04;
    scene.add(sun, sun.target);

    this.buildCanyon();
    this.buildFloor();
    if (layout === 'range') this.buildRange();
    else this.buildArena();

    this.snow = makeSnow(T.particles.count, 50, T.particles);
    scene.add(this.snow);
    if (themeId !== 'ice') this.decorate();
  }

  /** is (x, z) blocked by a ground-standing obstacle? (roofs / igloo caps do not count) */
  blockedAt(x, z, pad = 1) {
    return this.colliders.some((b) => b.min.y < 1.2 && b.max.y > 0.3 && b.max.y < 90 &&
      x > b.min.x - pad && x < b.max.x + pad && z > b.min.z - pad && z < b.max.z + pad);
  }

  /** standing in shallow water (slows down, splashes) */
  inWater(x, z, y = 0) {
    if (y > 0.25) return false;
    for (const is of this.islands) if ((x - is.x) ** 2 + (z - is.z) ** 2 < is.r * is.r) return false;
    for (const p of this.water) if (((x - p.x) / p.rx) ** 2 + ((z - p.z) / p.rz) ** 2 < 1) return true;
    return false;
  }

  onIce(x, z) {
    for (const p of this.ice) if (((x - p.x) / p.rx) ** 2 + ((z - p.z) / p.rz) ** 2 < 1) return true;
    return false;
  }

  /** footstep surface under (x, z, y) */
  surfaceAt(x, z, y = 0) {
    if (this.inWater(x, z, y)) return 'water';
    if (y < 0.2 && this.onIce(x, z)) return 'ice';
    if (y > 0.2) return this.theme.id === 'ice' ? 'ice' : this.theme.id === 'desert' || this.theme.id === 'perse' ? 'stone' : 'wood';
    return this.theme.surface || 'snow';
  }

  /** small decorative props on the open floor (no collision) */
  decorate() {
    const rng = mulberry32(777), T = this.theme;
    let placed = 0, guard = 0;
    while (placed < 46 && guard++ < 900) {
      const x = (rng() - 0.5) * (this.halfW * 2 - 4), z = (rng() - 0.5) * (this.halfL * 2 - 6);
      if (this.blockedAt(x, z, 1.2) || this.inWater(x, z) || this.onIce(x, z)) continue;
      const o = makeThemeProp(T, rng, 0.8 + rng() * 0.6);
      if (!o) break;
      o.position.set(x, 0, z);
      o.rotation.y = rng() * 6;
      this.scene.add(o);
      placed++;
    }
  }

  /* ---------- static geometry ---------- */
  buildCanyon() {
    const mat = cliffMaterial();
    mat.roughness = this.theme.cliffRough;
    const mk = (opts) => {
      const geo = createCliffGeometry(70, 26);
      updateCliff(geo, { ...opts, colors: this.theme.id === 'ice' ? null : this.theme.cliff });
      const m = new THREE.Mesh(geo, mat);
      m.receiveShadow = true;
      return m;
    };
    const sideOpts = { z0: 100, len: 200, baseX: this.halfW + 1, height: 55 };
    const left = mk({ ...sideOpts, side: -1, seed: 3 });
    const right = mk({ ...sideOpts, side: 1, seed: 11 });
    const endOpts = { z0: 60, len: 120, baseX: this.halfL + 1, height: 50, side: 1 };
    const far = mk({ ...endOpts, seed: 21 });
    far.rotation.y = Math.PI / 2;     // -> z = -(baseX + off)
    const near = mk({ ...endOpts, seed: 27 });
    near.rotation.y = -Math.PI / 2;   // -> z = +(baseX + off)
    for (const m of [left, right, far, near]) { this.scene.add(m); this.solids.push(m); }

    // invisible boundary colliders
    const B = 200;
    this.addCollider(new THREE.Box3(new THREE.Vector3(-B, -10, -B), new THREE.Vector3(-this.halfW, 100, B)));
    this.addCollider(new THREE.Box3(new THREE.Vector3(this.halfW, -10, -B), new THREE.Vector3(B, 100, B)));
    this.addCollider(new THREE.Box3(new THREE.Vector3(-B, -10, -B), new THREE.Vector3(B, 100, -this.halfL)));
    this.addCollider(new THREE.Box3(new THREE.Vector3(-B, -10, this.halfL), new THREE.Vector3(B, 100, B)));

    // props hugging the walls (crystals / trees / hives & flowers)
    const rng = this.rng, P = this.theme.prop;
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1;
      const cl = P === 'tree' ? makeTree(rng, 1.3 + rng() * 0.9) : P === 'flower' ? (i % 3 ? makeFlowers(rng, 1.4) : makeHiveBox(rng, 1.3))
        : P === 'gift' ? (i % 3 ? makeXmasTree(rng, 1.3 + rng() * 0.5) : makeGiftProp(rng, 1.6))
        : P === 'reed' ? (i % 3 ? makePine(rng, 1.4 + rng() * 0.6, this.theme.snowy) : makeReeds(rng, 1.5)) : P === 'cactus' ? (i % 3 ? makeCactus(rng, 1.2 + rng() * 0.5) : makePalm(rng, 1.2))
        : P === 'urn' ? (i % 3 ? makeUrn(rng, 1.6 + rng() * 0.8) : makePalm(rng, 1.2))
        : makeCrystalCluster(rng, 1 + rng() * 1.6);
      cl.position.set(side * (this.halfW - 0.5 + rng() * 1.5), 0, -this.halfL + rng() * this.halfL * 2);
      this.scene.add(cl);
    }
  }

  buildFloor() {
    const geo = new THREE.PlaneGeometry(this.halfW * 2 + 40, this.halfL * 2 + 40, 60, 120);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    const col = new Float32Array(p.count * 3);
    const snow = new THREE.Color(this.theme.floor[1]), ice = new THREE.Color(this.theme.floor[0]), tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const n = fbm(x * 0.05, z * 0.05, 5, 4);
      p.setY(i, Math.max(0, (Math.abs(x) - this.halfW + 2) * 0.4) + Math.max(0, (Math.abs(z) - this.halfL + 2) * 0.4));
      tmp.copy(ice).lerp(snow, THREE.MathUtils.smoothstep(n, -0.15, 0.2));
      col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const detail = floorDetailTexture(this.theme.id).clone();
    detail.needsUpdate = true;
    detail.repeat.set(26, 60);
    const floor = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, roughness: this.theme.id === 'ice' ? 0.55 : 0.95, metalness: 0.02 }));
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.solids.push(floor);
  }

  buildRange() {
    const rng = this.rng;
    const PLAYER_Z = 72;
    this.spawns.push({ pos: new THREE.Vector3(0, 0, PLAYER_Z + 4), yaw: 0 });

    // shooting booth counter (gaps at the sides let you walk out)
    const iceBlock = this.mats.block;
    this.addBlock(0, 0, PLAYER_Z - 4, 22, 1.05, 0.6, iceBlock);
    this.addBlock(-11.6, 0, PLAYER_Z - 1.5, 0.6, 2.4, 5.6, iceBlock);
    this.addBlock(11.6, 0, PLAYER_Z - 1.5, 0.6, 2.4, 5.6, iceBlock);

    // distance rows
    this.targetSpots = [];
    const rows = [
      { d: 10, xs: [-8, -4, 0, 4, 8] },
      { d: 25, xs: [-9, -3, 3, 9] },
      { d: 50, xs: [-10, 0, 10] },
      { d: 80, xs: [-6, 6] },
    ];
    for (const row of rows) {
      const z = PLAYER_Z - row.d;
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(26, 0.25),
        new THREE.MeshBasicMaterial({ color: '#4fe3ff', transparent: true, opacity: 0.7, fog: true }),
      );
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(0, 0.02, z + 1.6);
      this.scene.add(strip);
      const sign = makeSign(`${row.d}m`);
      sign.position.set(-14.5, 3.2, z);
      this.scene.add(sign);
      const sign2 = sign.clone();
      sign2.position.x = 14.5;
      this.scene.add(sign2);
      for (const x of row.xs) this.targetSpots.push(new THREE.Vector3(x, 0, z));
    }

    // side cover / movement practice
    this.addCrate(-20, 0, 50, 2);
    this.addCrate(-20, 2, 50, 2);
    this.addCrate(-22.2, 0, 50.4, 2);
    this.addCrate(21, 0, 30, 2.2);
    this.addCrate(23.4, 0, 31, 1.6);
    this.addCrate(-24, 0, 10, 2);
    this.addCrate(24, 0, -20, 2);
    this.addCrate(-22, 0, -40, 2.4);
    this.addBlock(-18, 0, 20, 6, 1.3, 0.8, iceBlock);
    this.addBlock(19, 0, 5, 0.8, 1.3, 6, iceBlock);
    this.addBlock(0, 0, -30, 8, 1.6, 0.8, iceBlock);
    this.addRock(-26, 0, 34, 3.5, 3, 3.5);
    this.addRock(27, 0, -2, 3, 4, 4);
    this.addRock(24, 0, 58, 2.6, 2.4, 2.6);
    this.addRock(-25, 0, -15, 4, 3.5, 4);
    this.addRock(14, 0, -55, 5, 4, 4);
    this.addRock(-12, 0, -62, 4, 5, 4);

    // ice staircase + lookout platform (step height 0.45)
    for (let i = 0; i < 5; i++) this.addBlock(27, 0, 46 - i * 1.0, 4, 0.45 * (i + 1), 1.0, iceBlock);
    this.addBlock(27, 0, 39.5, 6, 2.25, 4, iceBlock);

    // ice pillars
    for (const [x, z] of [[-16, 0], [16, -40], [-6, -50], [20, 64]]) this.addPillar(x, z);
  }

  buildArena() {
    (MAP_LAYOUTS[this.theme.id] || MAP_LAYOUTS.ice)(this);
    const A = this.teamSpawns.A;
    this.spawns.push({ pos: new THREE.Vector3(A[0], 0, A[1]), yaw: A[2] });
  }

  /** Random open spots for enemies (seeded), away from the player start. */
  enemySpawns(n) {
    const rng = mulberry32(99 + Math.floor(Math.random() * 1000));
    const pts = [];
    let guard = 0;
    while (pts.length < n && guard++ < 2000) {
      const p = new THREE.Vector3((rng() - 0.5) * (this.halfW * 2 - 8), 0, -(this.halfL - 4) + rng() * (this.halfL * 1.42 - 4));
      const blocked = this.blockedAt(p.x, p.z, 1) || this.inWater(p.x, p.z);
      if (blocked || pts.some((q) => q.distanceTo(p) < 9)) continue;
      pts.push(p);
    }
    return pts;
  }

  /* ---------- builders ---------- */
  addPillar(x, z) {
    this.addCollider(new THREE.Box3(new THREE.Vector3(x - 0.9, 0, z - 0.9), new THREE.Vector3(x + 0.9, 12, z + 0.9)));
    const kind = this.theme.pillar;
    if (kind !== 'ice') {
      // giant tree / honeycomb tower / pine / palm in the same footprint
      const o = kind === 'tree' ? makeTree(this.rng, 2.2) : kind === 'hive' ? makeHive(this.rng, 1.05) : kind === 'pine' ? makePine(this.rng, 1.8, this.theme.snowy) : kind === 'xmasTree' ? makeXmasTree(this.rng, 1.8) : makePalm(this.rng, 1.4);
      o.position.set(x, 0, z);
      this.scene.add(o);
      o.traverse((m) => { if (m.isMesh) { this.solids.push(m); this.cover.push(m); } });
      const deco = makeThemeProp(this.theme, this.rng, 1.1) || makeFlowers(this.rng, 1.2);
      deco.position.set(x + 1.4, 0, z + 0.8);
      this.scene.add(deco);
      return;
    }
    const pil = makeIceRock(this.rng, 1.2, 8 + this.rng() * 4, 1.2, this.mats.rock);
    pil.position.set(x, 0, z);
    this.scene.add(pil);
    this.solids.push(pil);
    this.cover.push(pil);
    const cl = makeCrystalCluster(this.rng, 1.2);
    cl.position.set(x + 1.2, 0, z + 0.6);
    this.scene.add(cl);
  }
  addCollider(box) { this.colliders.push(box); return box; }

  addBlock(x, y, z, w, h, d, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    this.scene.add(m);
    this.solids.push(m);
    this.cover.push(m);
    this.addCollider(new THREE.Box3().setFromObject(m));
    return m;
  }

  addCrate(x, y, z, s) {
    const g = this.addBlock(x, y, z, s, s, s, this.mats.crate);
    const t = s * 0.1, e = s * 1.02, hs = s / 2;
    // dark frame: 4 vertical posts + top/bottom rims
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(t, e, t), this.mats.crateEdge);
      post.position.set(sx * hs, 0, sz * hs);
      g.add(post);
    }
    for (const sy of [-1, 1]) {
      for (const [w, d, px, pz] of [[e, t, 0, hs], [e, t, 0, -hs], [t, e, hs, 0], [t, e, -hs, 0]]) {
        const rim = new THREE.Mesh(new THREE.BoxGeometry(w, t, d), this.mats.crateEdge);
        rim.position.set(px, sy * hs, pz);
        g.add(rim);
      }
    }
    return g;
  }

  addRock(x, y, z, sx, sy, sz) {
    const r = makeIceRock(this.rng, sx / 2, sy, sz / 2, this.mats.rock);
    r.position.set(x, y, z);
    this.scene.add(r);
    this.solids.push(r);
    this.cover.push(r);
    const k = 0.8;
    this.addCollider(new THREE.Box3(
      new THREE.Vector3(x - sx / 2 * k, y, z - sz / 2 * k),
      new THREE.Vector3(x + sx / 2 * k, y + sy * 0.9, z + sz / 2 * k)));
    return r;
  }

  update(dt, camPos) {
    this.time += dt;
    this.sky.position.copy(camPos);
    this.sky.material.uniforms.uTime.value = this.time;
    this.snow.userData.update(dt, camPos);
    for (const f of this.flickers) {
      const k = 0.8 + Math.sin(this.time * 13 + f.base) * 0.12 + Math.sin(this.time * 31) * 0.08;
      f.light.intensity = f.base * k;
      f.flames.forEach((m, i) => { m.scale.set(1, k + i * 0.1 + Math.sin(this.time * (17 + i * 5)) * 0.15, 1); m.rotation.y += 0.05; });
    }
    for (const z of this.zones) {
      const a = z.flag.geometry.attributes.position, b = z.basePos;
      for (let i = 0; i < a.count; i++) { const x = b[i * 3]; a.array[i * 3 + 2] = Math.sin(x * 3 - this.time * 6) * 0.12 * x; }
      a.needsUpdate = true;
    }
    if (this.waterMat) { const n = this.waterMat.normalMap; n.offset.x = this.time * 0.02; n.offset.y = this.time * 0.013; }
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && !o.material._shared) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.map?.dispose(); m.dispose(); });
      }
    });
    this.envMap?.dispose();
  }
}

function makeSign(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(8,20,40,0.85)';
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#4fe3ff'; g.lineWidth = 8;
  g.strokeRect(4, 4, 248, 120);
  g.fillStyle = '#ffffff';
  g.font = '900 72px "Noto Sans KR", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
  s.scale.set(3, 1.5, 1);
  return s;
}

/* ---------- collision ---------- */
const STEP = 0.5;

function overlaps(p, r, h, b) {
  return p.x + r > b.min.x && p.x - r < b.max.x &&
         p.z + r > b.min.z && p.z - r < b.max.z &&
         p.y + h > b.min.y && p.y < b.max.y;
}

/**
 * Move a vertical capsule-ish box (radius r, height h, feet at pos) through AABB colliders.
 * Mutates pos/vel. Returns { onGround }.
 */
export function collideMove(pos, vel, dt, r, h, boxes, wasOnGround) {
  // horizontal, axis by axis, with step-up
  for (const axis of ['x', 'z']) {
    const delta = vel[axis] * dt;
    if (!delta) continue;
    pos[axis] += delta;
    for (const b of boxes) {
      if (!overlaps(pos, r, h, b)) continue;
      const rise = b.max.y - pos.y;
      if (wasOnGround && rise > 0 && rise <= STEP) {
        const oldY = pos.y;
        pos.y = b.max.y + 0.001;
        if (!boxes.some((o) => o !== b && overlaps(pos, r, h, o))) continue;
        pos.y = oldY;
      }
      pos[axis] = delta > 0 ? b.min[axis] - r - 0.001 : b.max[axis] + r + 0.001;
      vel[axis] = 0;
    }
  }

  // vertical
  const prevY = pos.y;
  pos.y += vel.y * dt;
  let onGround = false;
  if (pos.y <= 0) { pos.y = 0; vel.y = 0; onGround = true; }
  for (const b of boxes) {
    if (!overlaps(pos, r, h, b)) continue;
    if (vel.y <= 0 && prevY >= b.max.y - 0.05) {
      pos.y = b.max.y; vel.y = 0; onGround = true;
    } else if (vel.y > 0) {
      pos.y = b.min.y - h; vel.y = 0;
    }
  }
  // ground probe (stay grounded when standing exactly on a top face)
  if (!onGround && vel.y <= 0) {
    for (const b of boxes) {
      if (Math.abs(pos.y - b.max.y) < 0.02 &&
          pos.x + r > b.min.x && pos.x - r < b.max.x && pos.z + r > b.min.z && pos.z - r < b.max.z) {
        onGround = true; break;
      }
    }
  }
  return { onGround };
}
