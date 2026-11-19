import * as THREE from 'three';
import { WEAPONS } from '../data/weapons.js';
import { buildGun, makeArm, makeLegs, VM } from './gunModels.js';
import { damp, clamp } from '../util/noise.js';
import { audio } from '../audio.js';
import { save, outfitFor } from '../save.js';
import { getCharSkin } from '../data/charSkins.js';
import { starGeo } from './soldier.js';

const smooth = (t) => t * t * (3 - 2 * t);
const lerpArr = (a, b, u) => (typeof a === 'number' ? a + (b - a) * u : a.map((v, i) => v + (b[i] - v) * u));
/** Keyframe sampler: frames = [[t, value], ...] with smoothstep easing between keys. */
function kf(frames, t) {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 0; i < frames.length - 1; i++) {
    const a = frames[i], b = frames[i + 1];
    if (t <= b[0]) return lerpArr(a[1], b[1], smooth((t - a[0]) / (b[0] - a[0] || 1)));
  }
  return frames[frames.length - 1][1];
}
const Z3 = [0, 0, 0];
const VM_SCALE = 0.8; // overall viewmodel size

/* colours of the hand orb per caster */
const CAST_STYLES = {
  frost: { core: '#8fdcff', shell: '#2f9fff', glow: '#4fb8ff', spark: ['#7fd8ff', '#2f8fff'], light: '#6fd8ff' },
  fire: { core: '#fff1b0', shell: '#ff6a1a', glow: '#ff8a2a', spark: ['#ffd25a', '#ff4a1a'], light: '#ff8a3a' },
  water: { core: '#d8f4ff', shell: '#2f8fff', glow: '#3fa8ff', spark: ['#8fd8ff', '#2f6fff'], light: '#4fb8ff' },
  steam: { core: '#ffffff', shell: '#d6e2ec', glow: '#eef6ff', spark: ['#ffffff', '#cfe0ee'], light: '#ffffff' },
  arcane: { core: '#fff2c0', shell: '#ffb627', glow: '#ff3df2', spark: ['#ffd36b', '#c27bff'], light: '#ffcf6b' },
  ink: { core: '#6a4dff', shell: '#1d0f6b', glow: '#3a2bd8', spark: ['#7a5cff', '#20d0ff'], light: '#5a4dff' },
  glitch: { core: '#5dffb0', shell: '#8a3dff', glow: '#39ff9e', spark: ['#39ff9e', '#b47bff'], light: '#9a5cff' },
  echo: { core: '#ffe3f4', shell: '#ff5fb8', glow: '#ff7ad0', spark: ['#ff9fdc', '#b47bff'], light: '#ff7ad0' },
  bloom: { core: '#f4ffd0', shell: '#6fdc4a', glow: '#ff8fd0', spark: ['#b6ff6a', '#ff9fdc'], light: '#9dff7a' },
};

/** Bloom's glowing seed held in the palm (arm-local units) */
export function makeSeed(fx, color = '#9dff5a') {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.015, 14, 10), new THREE.MeshStandardMaterial({ color: '#7a4a22', roughness: 0.6, emissive: '#3a1a08', emissiveIntensity: 0.3 }));
  shell.scale.set(0.85, 1.25, 0.85);
  const sprout = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.022, 6), new THREE.MeshBasicMaterial({ color }));
  sprout.position.y = 0.024;
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), new THREE.MeshBasicMaterial({ color }));
  leaf.scale.set(1.6, 0.4, 0.8); leaf.position.set(0.008, 0.026, 0); leaf.rotation.z = -0.5;
  g.add(shell, sprout, leaf, fx.glowSprite(color, 0.09));
  return g;
}

/** Christmas skin: a gold star (right hand) and a red ornament (left hand) replace the seeds */
export function makeXmasStar(fx) {
  const g = new THREE.Group();
  const star = new THREE.Mesh(starGeo(0.02, 0.006), new THREE.MeshStandardMaterial({ color: '#ffd24a', emissive: '#ffb000', emissiveIntensity: 1.4, metalness: 0.6, roughness: 0.3 }));
  g.add(star, fx.glowSprite('#ffd24a', 0.1));
  return g;
}
export function makeXmasOrnament(fx) {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.016, 14, 10), new THREE.MeshStandardMaterial({ color: '#e0182a', metalness: 0.8, roughness: 0.15 }));
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.006, 8), new THREE.MeshStandardMaterial({ color: '#ffd24a', metalness: 0.9, roughness: 0.2 }));
  cap.position.y = 0.018;
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.004, 0.0012, 4, 10), cap.material);
  loop.position.y = 0.024;
  g.add(ball, cap, loop, fx.glowSprite('#ff5a6a', 0.07));
  return g;
}

/** glowing music note (eighth note) used by Echo; units match the arm-local orb */
export function makeNote(fx, color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.016, 14, 10), mat);
  head.scale.set(1.35, 0.95, 0.7);
  head.rotation.z = 0.45;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.058, 6), mat);
  stem.position.set(0.019, 0.029, 0);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.006, 0.005), mat);
  flag.position.set(0.028, 0.052, 0);
  flag.rotation.z = -0.7;
  const flag2 = flag.clone();
  flag2.position.y = 0.04;
  g.add(head, stem, flag, flag2, fx.glowSprite(color, 0.11));
  return g;
}

/* Reload animation tracks (gun-local space). Each track: L=left-hand, tilt=[rx,ry,rz] */
function reloadTracks(id, L) {
  if (id === 'smg' || id === 'dmr' || id === 'lmg' || id === 'burst' || id === 'flamer' || id === 'railgun') return reloadTracks('rifle', L);
  if (id === 'rifle') return {
    tilt: [[0, Z3], [0.12, [0.15, 0.2, 0.55]], [0.66, [0.15, 0.2, 0.55]], [0.74, [0.05, 0.25, 0.35]], [0.88, [0.05, 0.25, 0.35]], [1, Z3]],
    left: [[0, L], [0.1, [0, -0.1, -0.15]], [0.16, [0, -0.12, -0.14]], [0.3, [0.03, -0.5, -0.06]], [0.44, [0.03, -0.5, -0.06]],
      [0.58, [0, -0.17, -0.14]], [0.64, [0, -0.13, -0.14]], [0.72, [0.04, 0.065, 0.04]], [0.78, [0.04, 0.065, 0.13]], [0.84, [0.04, 0.07, 0.08]], [1, L]],
    magY: [[0, 0], [0.16, 0], [0.3, -0.42], [0.44, -0.36], [0.58, -0.04], [0.64, 0]],
    magHide: [0.3, 0.44],
    handleZ: [[0, 0], [0.74, 0], [0.78, 0.07], [0.81, 0]],
    events: [[0.16, 'magOut'], [0.62, 'magIn'], [0.63, 'refill'], [0.78, 'rack']],
  };
  if (id === 'pistol') return {
    tilt: [[0, Z3], [0.12, [0.25, 0, 0.4]], [0.85, [0.25, 0, 0.4]], [1, Z3]],
    left: [[0, L], [0.12, [-0.03, -0.14, 0.02]], [0.3, [-0.02, -0.5, 0.05]], [0.45, [-0.02, -0.5, 0.05]], [0.6, [0, -0.16, 0.02]],
      [0.66, [0, -0.12, 0.02]], [0.74, [-0.005, 0.075, 0.02]], [0.8, [-0.005, 0.075, 0.07]], [0.88, L], [1, L]],
    magY: [[0, 0], [0.12, 0], [0.28, -0.4], [0.45, -0.34], [0.6, -0.04], [0.66, 0]],
    magHide: [0.28, 0.45],
    slideZ: [[0, 0], [0.76, 0], [0.8, 0.035], [0.83, 0]],
    events: [[0.12, 'magOut'], [0.64, 'magIn'], [0.65, 'refill'], [0.8, 'rack']],
  };
  if (id === 'sniper') {
    const K = [0.07, 0.035, 0.05], Kb = [0.07, 0.035, 0.12];
    return {
      tilt: [[0, Z3], [0.08, [0.1, 0.15, 0.4]], [0.9, [0.1, 0.15, 0.4]], [1, Z3]],
      left: [[0, L], [0.1, K], [0.13, K], [0.2, Kb], [0.27, [0, -0.08, -0.1]], [0.38, [0.02, -0.5, -0.05]], [0.5, [0.02, -0.5, -0.05]],
        [0.6, [0, -0.08, -0.1]], [0.67, Kb], [0.75, Kb], [0.8, K], [0.84, K], [1, L]],
      boltRot: [[0, 0], [0.13, 0], [0.16, 1.1], [0.8, 1.1], [0.84, 0]],
      boltZ: [[0, 0], [0.16, 0], [0.2, 0.07], [0.72, 0.07], [0.78, 0]],
      magY: [[0, 0], [0.27, 0], [0.38, -0.4], [0.5, -0.35], [0.6, 0]],
      magHide: [0.38, 0.5],
      events: [[0.15, 'click'], [0.2, 'rack'], [0.28, 'magOut'], [0.59, 'magIn'], [0.6, 'refill'], [0.77, 'rack']],
    };
  }
  return null;
}

function cycleTracks(id, L) {
  if (id === 'sniper') {
    const K = [0.07, 0.035, 0.05], Kb = [0.07, 0.035, 0.12];
    return {
      tilt: [[0, Z3], [0.2, [0.05, 0, 0.2]], [0.8, [0.05, 0, 0.2]], [1, Z3]],
      left: [[0, L], [0.15, K], [0.22, K], [0.4, Kb], [0.55, K], [0.7, K], [1, L]],
      boltRot: [[0, 0], [0.18, 0], [0.25, 1.1], [0.55, 1.1], [0.62, 0]],
      boltZ: [[0, 0], [0.25, 0], [0.38, 0.07], [0.45, 0.07], [0.55, 0]],
      events: [[0.24, 'click'], [0.4, 'eject'], [0.55, 'rack']],
    };
  }
  if (id === 'shotgun') return {
    tilt: [[0, Z3], [0.3, [0.06, 0, -0.08]], [0.8, [0.06, 0, -0.08]], [1, Z3]],
    pumpZ: [[0, 0], [0.18, 0], [0.42, 0.09], [0.68, 0]],
    events: [[0.2, 'pump'], [0.42, 'eject']],
  };
  return null;
}

/** First-person weapons: viewmodel, firing, ADS, reload, recoil. */
export class WeaponSystem {
  constructor(game) {
    this.game = game;
    this.vmScene = new THREE.Scene();
    this.vmCamera = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, 0.005, 20);
    this.vmScene.environment = game.world.envMap;
    this.vmScene.environmentIntensity = 0.8;
    this.vmScene.add(new THREE.HemisphereLight('#e2f1ff', '#3b4660', 1.5));
    const key = new THREE.DirectionalLight('#fff3e6', 3.0);
    key.position.set(1, 2, 1.5);
    const rim = new THREE.DirectionalLight('#9fe7ff', 1.2);
    rim.position.set(-1.5, 1, -1);
    const fill = new THREE.DirectionalLight('#cfe6ff', 1.2);
    fill.position.set(0, 0.5, 2);
    this.vmScene.add(key, rim, fill);
    this.vmFlash = new THREE.PointLight('#ffb35a', 0, 2.5, 1.5);
    this.vmScene.add(this.vmFlash);

    this.charSkin = getCharSkin(outfitFor(game.character.id));
    this.sleeve = new THREE.MeshStandardMaterial({ color: this.charSkin?.sleeve || game.character.color, roughness: 0.8 });
    this.root = new THREE.Group();
    this.pivot = new THREE.Group();
    this.root.add(this.pivot);
    this.pivot.scale.setScalar(VM_SCALE);
    this.vmScene.add(this.root);
    this.rightArm = makeArm(this.sleeve, 1);
    this.leftArm = makeArm(this.sleeve, -1);
    this.pivot.add(this.rightArm, this.leftArm);
    if (this.charSkin) {
      // christmas skin: white fur cuffs
      const fur = new THREE.MeshStandardMaterial({ color: '#f7f7f2', roughness: 0.95 });
      for (const [arm, side] of [[this.rightArm, 1], [this.leftArm, -1]]) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.096, 0.07), fur);
        c.position.set(side * 0.012, -0.02, 0.06); c.rotation.set(0.32, side * 0.25, 0);
        arm.add(c);
      }
    }
    this.vmMaterials = [...Object.values(VM), this.sleeve];
    // first-person legs shown while sliding
    this.legs = makeLegs(this.sleeve);
    this.legs.visible = false;
    this.vmScene.add(this.legs);
    this.slideAmt = 0;
    this.inspectT = -1;

    const lo = save.loadout;
    this.slots = [lo.primary, lo.secondary, lo.sidearm].map((id) => {
      const def = WEAPONS[id];
      const sid = save.skins[id] && save.ownedSkins.includes(save.skins[id]) ? save.skins[id] : null;
      const model = buildGun(id, sid);
      model.group.traverse((o) => { if (o.isMesh && !this.vmMaterials.includes(o.material)) this.vmMaterials.push(o.material); });
      model.group.visible = false;
      this.pivot.add(model.group);
      if (model.handShell) { model.handShell.visible = false; this.leftArm.add(model.handShell); model.handShell.position.set(0.0, 0.04, -0.02); }
      return { id, def, model, skin: model.skin || null, mag: def.mag, reserve: def.reserve, reload: reloadTracks(id, model.leftRest.toArray()), cycle: cycleTracks(id, model.leftRest.toArray()) };
    });

    this.burns = new Map();
    this.cur = -1;
    this.time = 0;
    this.drawT = 1;
    this.reloading = false;
    this.reloadP = 0;
    this.shellPhase = null;
    this.firedEvents = new Set();
    this.cycleP = -1;
    this.nextFire = 0;
    this.lastShot = -10;
    this.adsT = 0;
    this.adsHeld = false;
    this.trigger = false;
    this.triggerUsed = false;
    this.bloom = 0;
    this.kick = { z: 0, rx: 0, ry: 0 };
    this.sway = { x: 0, y: 0 };
    this.sprintT = 0;
    this.leftPos = new THREE.Vector3();
    this.autoReloadAt = 0;
    this.scoped = false;
    this.raycaster = new THREE.Raycaster();

    // melee / bow state
    this.meleeT = -1;
    this.meleeHeavy = false;
    this.meleeSide = 1;
    this.meleeHitDone = false;
    this.adsUsed = false;
    this.bowDraw = 0;
    this.bowVis = 0;
    this.nockT = 0;
    this.arrows = [];
    this.stuck = [];
    this.burstLeft = 0;
    // grenades
    this.throwT = -1;
    this.throwShort = false;
    this.thrown = false;
    this.grenades = [];
    // hand casts: Frost/Nitro "렌지" orb (right hand), Echo notes (left / both hands)
    this.casting = false;
    this.castT = 0;
    this.castTime = 0;
    this.castStyle = 'frost';
    this.echo = null; // { kind: 'insert'|'combine', t, dur, done, fired, onFire, onDone }
    this.castArm = makeArm(this.sleeve, 1);
    this.castArmL = makeArm(this.sleeve, -1);
    this.orb = new THREE.Group();
    const orbCore = new THREE.Mesh(new THREE.SphereGeometry(0.024, 20, 16), new THREE.MeshBasicMaterial({ color: '#8fdcff' }));
    const orbShell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.038, 1),
      new THREE.MeshBasicMaterial({ color: '#2f9fff', transparent: true, opacity: 0.7, wireframe: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    const orbGlow = game.effects.glowSprite('#4fb8ff', 0.15);
    this.orb.add(orbCore, orbShell, orbGlow);
    this.orbSparks = [];
    for (let i = 0; i < 7; i++) {
      const sp = game.effects.glowSprite(i % 2 ? '#7fd8ff' : '#2f8fff', 0.018);
      sp.userData = { a: (i / 7) * Math.PI * 2, r: 0.05 + Math.random() * 0.025, s: 2 + Math.random() * 3, y: (Math.random() - 0.5) * 0.04 };
      this.orb.add(sp);
      this.orbSparks.push(sp);
    }
    this.orb.userData = { core: orbCore, shell: orbShell, glow: orbGlow };
    this.orb.position.set(0, 0.075, -0.035);
    this.castArm.add(this.orb);
    this.orbLight = new THREE.PointLight('#6fd8ff', 0, 1.2, 1.5);
    this.castArm.add(this.orbLight);
    this.orbLight.position.copy(this.orb.position);
    // Echo music notes held in the palms
    this.noteR = makeNote(game.effects, '#ff5fb8');
    this.noteL = makeNote(game.effects, '#c9a2ff');
    this.noteR.position.set(0, 0.07, -0.03);
    this.noteL.position.set(0, 0.07, -0.03);
    this.castArm.add(this.noteR);
    this.castArmL.add(this.noteL);
    this.noteR.visible = this.noteL.visible = false;
    // Bloom seeds
    this.seedR = this.charSkin ? makeXmasStar(game.effects) : makeSeed(game.effects, '#9dff5a');
    this.seedL = this.charSkin ? makeXmasOrnament(game.effects) : makeSeed(game.effects, '#ff8fd0');
    this.seedR.position.set(0, 0.07, -0.03);
    this.seedL.position.set(0, 0.07, -0.03);
    this.castArm.add(this.seedR);
    this.castArmL.add(this.seedL);
    this.seedR.visible = this.seedL.visible = false;
    this.leftOrb = new THREE.Group();
    const lCore = new THREE.Mesh(new THREE.SphereGeometry(0.024, 20, 16), new THREE.MeshBasicMaterial({ color: '#d8f4ff' }));
    const lShell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.038, 1),
      new THREE.MeshBasicMaterial({ color: '#2f8fff', transparent: true, opacity: 0.7, wireframe: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    const lGlow = game.effects.glowSprite('#3fa8ff', 0.15);
    this.leftOrb.add(lCore, lShell, lGlow);
    this.leftOrb.userData = { core: lCore, shell: lShell, glow: lGlow };
    this.leftOrb.position.set(0, 0.075, -0.035);
    this.leftOrb.visible = false;
    this.castArmL.add(this.leftOrb);
    this.leftCast = null; // { t, style } Inker: ink held in the left hand while Q is down
    this.castArm.visible = this.castArmL.visible = false;
    this.vmScene.add(this.castArm, this.castArmL);
    // floating notes around the gun while Echo's damage buff is active
    this.buffNotes = [];
    for (let i = 0; i < 3; i++) {
      const n = makeNote(game.effects, i % 2 ? '#c9a2ff' : '#ff5fb8');
      n.scale.setScalar(0.45);
      n.visible = false;
      n.userData.ph = (i / 3) * Math.PI * 2;
      this.vmScene.add(n);
      this.buffNotes.push(n);
    }
    this.equip(0, true);
  }

  /* ---------------- hand casts (Frost/Nitro hold orb · Echo notes) ---------------- */
  startCast(style = 'frost') {
    this.casting = true;
    this.castTime = 0;
    this.reloading = false;
    this.shellPhase = null;
    this.inspectT = -1;
    this.bowDraw = 0;
    this.burstLeft = 0;
    this.setCastStyle(style);
  }
  endCast() { this.casting = false; }

  setCastStyle(style) {
    this.castStyle = style;
    const P = CAST_STYLES[style] || CAST_STYLES.frost;
    const u = this.orb.userData;
    u.core.material.color.set(P.core);
    u.shell.material.color.set(P.shell);
    u.glow.material.color.set(P.glow);
    this.orbSparks.forEach((sp, i) => sp.material.color.set(i % 2 ? P.spark[0] : P.spark[1]));
    this.orbLight.color.set(P.light);
  }

  setLeftStyle(style) {
    const P = CAST_STYLES[style] || CAST_STYLES.water, u = this.leftOrb.userData;
    u.core.material.color.set(P.core); u.shell.material.color.set(P.shell); u.glow.material.color.set(P.glow);
  }

  /** Inferno Q: fire orb in the right hand + water orb in the left, pushed together into steam (onFire at the merge) */
  playSteamCombine(onFire) {
    if (this.echo || this.casting) return false;
    this.echo = { kind: 'steam', t: 0, dur: 0.95, fired: false, onFire };
    this.startCast('fire');
    this.setLeftStyle('water');
    return true;
  }

  /** Inker Q: ink gathers in the left hand while the key is held (the gun stays up) */
  startLeftCast(style = 'ink') {
    this.leftCast = { t: 0, style };
    this.setLeftStyle(style);
  }
  endLeftCast() { if (this.leftCast) this.leftCast.ending = true; }
  leftPower() { return this.leftCast ? clamp((this.leftCast.t - 0.25) / 1.75, 0, 1) : 0; }

  updateLeftCast(dt) {
    const L = this.leftCast;
    if (!L) return;
    const p = this.game.player;
    L.t += dt;
    L.k = damp(L.k || 0, L.ending ? 0 : 1, L.ending ? 14 : 9, dt);
    const c = smooth(Math.min(1, L.k));
    this.leftArm.visible = false;
    this.castArmL.visible = p.alive && c > 0.02;
    this.leftOrb.visible = this.castArmL.visible;
    this.castArmL.scale.setScalar(VM_SCALE);
    this.castArmL.position.set(-0.12 - Math.cos(p.bobPhase) * 0.006, -0.46 + 0.27 * c - Math.abs(Math.sin(p.bobPhase)) * 0.008, -0.46);
    this.castArmL.rotation.set(0.32, 0.22, -0.1);
    const pw = L.ending ? 1 : this.leftPower();
    const grow = Math.min(1, L.t / 0.4);
    this.leftOrb.scale.setScalar(Math.max(0.001, (0.3 + 0.35 * grow + 0.6 * pw) * (1 + Math.sin(this.time * (8 + pw * 8)) * 0.07)));
    const u = this.leftOrb.userData;
    u.shell.rotation.x += dt * (2 + pw * 5); u.shell.rotation.y -= dt * (3 + pw * 5);
    u.glow.material.opacity = 0.4 + 0.5 * pw;
    if (L.ending && c <= 0.02) {
      this.leftCast = null;
      this.castArmL.visible = this.leftOrb.visible = false;
      this.leftArm.visible = !['melee', 'grenade'].includes(this.def.kind);
    }
  }

  /** Echo Q: left hand brings up a note and slots it into the gun (onDone when inserted) */
  playEchoInsert(onDone) {
    if (this.echo) return false;
    this.echo = { kind: 'insert', t: 0, dur: 0.85, fired: false, onFire: onDone };
    return true;
  }

  /** Echo E: lower the gun, a note in each hand, bring them together and fire (onFire at the merge) */
  playEchoCombine(onFire) {
    if (this.echo || this.casting) return false;
    this.echo = { kind: 'combine', t: 0, dur: 0.85, fired: false, onFire };
    this.startCast('echo');
    return true;
  }

  /** Bloom Q: right hand shows a seed and pushes it down into the ground (onFire when planted) */
  playSeedPlant(onFire) {
    if (this.echo || this.casting) return false;
    this.echo = { kind: 'plant', t: 0, dur: 0.9, fired: false, onFire };
    this.startCast('bloom');
    return true;
  }

  /** Bloom E: a seed in each hand, both tossed forward (onFire at the throw) */
  playSeedToss(onFire) {
    if (this.echo || this.casting) return false;
    this.echo = { kind: 'seeds', t: 0, dur: 0.85, fired: false, onFire };
    this.startCast('bloom');
    return true;
  }

  /** world-space position of the orb in the hand (for spawning the projectile) */
  orbWorld(obj = this.orb) {
    const v = obj.getWorldPosition(new THREE.Vector3());
    const dist = v.length();
    v.project(this.vmCamera);
    const cam = this.game.camera;
    const dir = new THREE.Vector3(v.x, v.y, 0.5).unproject(cam).sub(cam.position).normalize();
    return cam.position.clone().addScaledVector(dir, Math.max(0.5, dist));
  }

  updateEcho(dt) {
    const e = this.echo;
    if (!e) return;
    e.t += dt;
    const k = Math.min(1, e.t / e.dur);
    const p = this.game.player;
    const bob = Math.abs(Math.sin(p.bobPhase)) * 0.008;
    if (e.kind === 'plant') {
      // right hand: holds the seed up, then stabs it down toward the floor
      const c = smooth(Math.min(1, this.castT));
      this.castArm.visible = p.alive && c > 0.02;
      this.castArm.scale.setScalar(VM_SCALE);
      this.orb.visible = false; this.orbLight.intensity = 0.8;
      const pos = kf([[0, [0.16, -0.6, -0.46]], [0.3, [0.1, -0.2, -0.46]], [0.5, [0.08, -0.17, -0.48]], [0.68, [0.06, -0.5, -0.56]], [1, [0.14, -0.7, -0.46]]], k);
      const rot = kf([[0, [0.5, -0.2, 0.1]], [0.3, [0.32, -0.22, 0.1]], [0.5, [0.2, -0.2, 0.1]], [0.68, [-0.9, -0.1, 0.05]], [1, [-0.4, -0.2, 0.1]]], k);
      this.castArm.position.set(pos[0], pos[1] - bob, pos[2]);
      this.castArm.rotation.set(rot[0], rot[1], rot[2]);
      this.seedR.visible = this.castArm.visible && k < 0.66;
      this.seedR.rotation.y += dt * 3;
      this.seedR.scale.setScalar(1.2 + Math.sin(e.t * 10) * 0.08);
      if (!e.fired && k >= 0.66) { e.fired = true; e.onFire?.(); }
      if (k >= 0.7) this.casting = false;
    } else if (e.kind === 'seeds') {
      // both hands hold a seed, then flick them forward (one for me, one for a team mate)
      const c = smooth(Math.min(1, this.castT));
      const vis = p.alive && c > 0.02;
      this.castArm.visible = this.castArmL.visible = vis;
      this.castArm.scale.setScalar(VM_SCALE); this.castArmL.scale.setScalar(VM_SCALE);
      this.orb.visible = false; this.orbLight.intensity = 0.6;
      // christmas skin: the star and the ornament are brought together first, then tossed
      const spread = this.charSkin ? kf([[0, 0.17], [0.3, 0.08], [0.5, 0.025], [0.58, 0.025], [0.7, 0.2], [1, 0.22]], k) : kf([[0, 0.17], [0.35, 0.12], [0.55, 0.1], [0.7, 0.2], [1, 0.22]], k);
      if (this.charSkin && !e.merged && k >= 0.5) {
        e.merged = true;
        const at = this.orbWorld(this.seedR);
        this.game.effects.burst(at, { count: 16, color: '#ffd24a', speed: 2, size: 0.02, gravity: 0, life: 0.6 });
        this.game.effects.burst(at, { count: 8, color: '#ff3a4a', speed: 2, size: 0.02, gravity: 0, life: 0.6 });
        audio.click?.(3200, 0.25);
      }
      const fwd = kf([[0, -0.46], [0.5, -0.46], [0.65, -0.58], [1, -0.5]], k);
      const y = -0.45 + 0.27 * c - bob;
      this.castArm.position.set(spread, y, fwd);
      this.castArmL.position.set(-spread, y, fwd);
      const flick = kf([[0, 0.32], [0.55, 0.4], [0.68, -0.3], [1, 0.1]], k);
      this.castArm.rotation.set(flick, -0.22, 0.1);
      this.castArmL.rotation.set(flick, 0.22, -0.1);
      this.seedR.visible = this.seedL.visible = vis && k < 0.64;
      this.seedR.rotation.y += dt * 4; this.seedL.rotation.y -= dt * 4;
      if (!e.fired && k >= 0.64) { e.fired = true; e.onFire?.(); }
      if (k >= 0.7) this.casting = false;
    } else if (e.kind === 'insert') {
      // left hand: rises from the bottom-left holding a note, then pushes it into the gun
      this.leftArm.visible = false;
      this.castArmL.visible = p.alive;
      this.castArmL.scale.setScalar(VM_SCALE);
      const pos = kf([[0, [-0.2, -0.55, -0.46]], [0.3, [-0.11, -0.2, -0.45]], [0.5, [-0.08, -0.18, -0.44]], [0.7, [0.02, -0.21, -0.42]], [1, [-0.1, -0.6, -0.42]]], k);
      const rot = kf([[0, [0.6, 0.3, -0.1]], [0.3, [0.32, 0.22, -0.1]], [0.5, [0.25, 0.3, -0.15]], [0.7, [0.1, 0.9, -0.3]], [1, [0.6, 0.4, 0]]], k);
      this.castArmL.position.set(pos[0], pos[1] - bob, pos[2]);
      this.castArmL.rotation.set(rot[0], rot[1], rot[2]);
      this.noteL.visible = k < 0.68;
      this.noteL.rotation.y += dt * 4;
      this.noteL.scale.setScalar(k < 0.55 ? 1 + Math.sin(e.t * 12) * 0.06 : Math.max(0.01, 1 - (k - 0.55) / 0.13));
      if (!e.fired && k >= 0.68) {
        e.fired = true;
        const fx = this.game.effects;
        const at = this.muzzleWorld();
        fx.burst(at, { count: 14, color: '#ff8fd0', speed: 1.6, size: 0.025, gravity: 0, life: 0.5 });
        e.onFire?.();
      }
    } else {
      // both hands: a note each, swing together to the centre, merge into a glowing chord orb, fire
      const c = smooth(Math.min(1, this.castT));
      const vis = p.alive && c > 0.02;
      this.castArm.visible = this.castArmL.visible = vis;
      this.castArm.scale.setScalar(VM_SCALE);
      this.castArmL.scale.setScalar(VM_SCALE);
      const spread = kf([[0, 0.17], [0.3, 0.15], [0.55, 0.035], [0.75, 0.04], [1, 0.12]], k);
      const y = -0.45 + 0.27 * c - bob;
      this.castArm.position.set(spread, y, -0.46);
      this.castArmL.position.set(-spread, y, -0.46);
      const tw = kf([[0, 0], [0.55, 0.35], [1, 0.1]], k);
      this.castArm.rotation.set(0.32, -0.22 - tw, 0.1);
      this.castArmL.rotation.set(0.32, 0.22 + tw, -0.1);
      const merged = k >= 0.55;
      if (e.kind === 'steam') {
        if (merged && !e.mergedStyle) { e.mergedStyle = true; this.setCastStyle('steam'); this.game.effects.puff(this.orbWorld(), '#eef6ff', 0.4, 0.4, 0.8); }
        this.leftOrb.visible = vis && !merged;
        this.orb.visible = vis && k < 0.78;
        const sc = merged ? 1.3 + (k - 0.55) * 3 : 0.8 + Math.sin(e.t * 14) * 0.06;
        this.orb.scale.setScalar(sc);
        this.leftOrb.scale.setScalar(0.8 + Math.sin(e.t * 14 + 1) * 0.06);
        this.orb.userData.shell.rotation.y += dt * 6;
        this.leftOrb.userData.shell.rotation.y -= dt * 6;
        this.orbLight.intensity = 1.2;
      } else {
      this.noteR.visible = this.noteL.visible = vis && !merged;
      this.noteR.rotation.y += dt * 5; this.noteL.rotation.y -= dt * 5;
      this.orb.visible = vis && merged && k < 0.78;
      }
      if (this.orb.visible && e.kind !== 'steam') {
        this.orb.scale.setScalar(0.9 + Math.sin(e.t * 30) * 0.1);
        this.orb.userData.shell.rotation.y += dt * 8;
        this.orbLight.intensity = 1.5;
      } else this.orbLight.intensity = 0;
      if (!e.fired && k >= 0.62) {
        e.fired = true;
        e.onFire?.();
      }
      if (k >= 0.62) this.casting = false; // gun comes back up
    }
    if (e.t >= e.dur) {
      this.echo = null;
      this.castArmL.visible = false;
      this.noteR.visible = this.noteL.visible = false;
      this.seedR.visible = this.seedL.visible = false;
      this.orb.visible = true;
      this.leftOrb.visible = false;
      if (!this.casting) this.castArm.visible = false;
      this.leftArm.visible = !['melee', 'grenade'].includes(this.def.kind);
    }
  }

  updateBuffNotes(dt) {
    const on = this.game.skills.damageMul() > 1 && this.game.player.alive && !this.scoped;
    for (const n of this.buffNotes) {
      n.visible = on;
      if (!on) continue;
      n.userData.ph += dt * 1.6;
      const a = n.userData.ph;
      n.position.set(0.14 + Math.cos(a) * 0.07, -0.13 + Math.sin(a * 1.3) * 0.04, -0.5 + Math.sin(a) * 0.06);
      n.rotation.y += dt * 3;
    }
  }

  updateCast(dt) {
    this.castT = damp(this.castT, this.casting ? 1 : 0, this.casting ? 9 : 12, dt);
    if (this.casting) this.castTime += dt;
    this.updateBuffNotes(dt);
    if (this.echo) { this.updateEcho(dt); return; }
    this.updateLeftCast(dt);
    const c = smooth(Math.min(1, this.castT));
    this.castArm.visible = c > 0.02 && this.game.player.alive;
    if (!this.castArm.visible) { this.orbLight.intensity = 0; return; }
    const grow = Math.min(1, this.castTime / 0.4);
    const power = this.castPower();
    const p = this.game.player;
    this.castArm.position.set(0.11 + Math.cos(p.bobPhase) * 0.006, -0.45 + 0.27 * c - Math.abs(Math.sin(p.bobPhase)) * 0.008, -0.46);
    this.castArm.rotation.set(0.32, -0.22, 0.1);
    this.castArm.scale.setScalar(VM_SCALE);
    const pulse = 1 + Math.sin(this.time * (9 + power * 8)) * (0.06 + power * 0.05);
    const big = this.castStyle === 'arcane' ? 2.1 : 1; // Inferno's shield orb is huge
    const sc = (this.castStyle === 'arcane' ? 1 : 0.3 + 0.35 * grow + 0.55 * power) * big * pulse * (this.casting ? 1 : c);
    this.orb.scale.setScalar(Math.max(0.001, sc));
    const u = this.orb.userData;
    const spin = 1 + power * 2.5;
    u.shell.rotation.x += dt * 2.3 * spin; u.shell.rotation.y += dt * 3.1 * spin;
    if (this.castStyle === 'fire') u.shell.scale.setScalar(1 + Math.sin(this.time * 23) * 0.12);
    else if (this.castStyle === 'glitch') {
      // digital jitter: the orb snaps around and flickers
      u.shell.scale.setScalar(Math.random() < 0.2 ? 1.4 : 1);
      this.orb.position.set((Math.random() < 0.25 ? (Math.random() - 0.5) * 0.02 : 0), 0.075, -0.035);
    }
    else u.shell.scale.setScalar(1);
    u.glow.material.opacity = 0.35 + 0.25 * grow + 0.4 * power;
    for (const sp of this.orbSparks) {
      const d = sp.userData;
      d.a += dt * d.s * spin;
      sp.position.set(Math.cos(d.a) * d.r, d.y + Math.sin(d.a * 1.7) * 0.015, Math.sin(d.a) * d.r);
    }
    this.orbLight.intensity = (0.8 + 1.6 * power) * grow * c;
  }

  /** 0..1 charge of a hold-to-cast skill: nothing before 0.25 s, full at 2 s */
  castPower() { return clamp((this.castTime - 0.25) / 1.75, 0, 1); }

  /* ---------------- grenades ---------------- */
  throwGrenade(short) {
    const s = this.slot;
    if (this.throwT >= 0 || this.drawT < 0.9 || s.mag <= 0 || this.casting) return;
    this.throwT = 0;
    this.throwShort = short;
    this.thrown = false;
    this.triggerUsed = true;
    audio.skill('pin');
  }

  releaseGrenade() {
    const game = this.game, s = this.slot, def = s.def, cam = game.camera;
    s.mag = 0;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const mesh = buildGun(def.id, null).held;
    mesh.position.set(0, 0, 0);
    mesh.scale.setScalar(1.7);
    mesh.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const pos = cam.position.clone().addScaledVector(fwd, 0.5).add(new THREE.Vector3(0, -0.1, 0));
    mesh.position.copy(pos);
    game.scene.add(mesh);
    const vel = this.throwShort
      ? fwd.clone().multiplyScalar(8).add(new THREE.Vector3(0, 1.5, 0))
      : fwd.clone().multiplyScalar(19).add(new THREE.Vector3(0, 4.5, 0));
    vel.add(game.player.vel.clone().multiplyScalar(0.5));
    this.grenades.push({ mesh, vel, fuse: def.fuse, def, spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8) });
    audio.skill('throw');
    game.skills.onPlayerShot();
  }

  explodeGrenade(gr) {
    const game = this.game, def = gr.def, pos = gr.mesh.position.clone();
    game.scene.remove(gr.mesh);
    gr.mesh.traverse((o) => o.isMesh && o.geometry.dispose());
    if (def.smoke) {
      pos.y = game.skills.floorBelow(pos.clone().setY(pos.y + 0.5));
      game.skills.createSteam(pos, false, { smoke: true, radius: def.radius, t: def.duration });
      game.effects.burst(pos.clone().setY(pos.y + 0.3), { count: 18, color: '#9aa0a6', speed: 4, size: 0.06, life: 0.6 });
      audio.skill('steam', game.player.position.distanceTo(pos));
      return;
    }
    const fx = game.effects;
    fx.explosion(pos.clone().setY(pos.y + 0.3), '#ffb35a', def.radius * 0.75);
    fx.burst(pos.clone().setY(pos.y + 0.2), { count: 26, color: '#ffcf7a', speed: 11, size: 0.05, life: 0.7 });
    fx.burst(pos.clone().setY(pos.y + 0.1), { count: 18, color: 'ice', speed: 7, size: 0.08 });
    fx.puff(pos.clone().setY(pos.y + 0.8), '#7a7f88', 4, 1.2, 1.6);
    fx.ring?.(pos.clone().setY(0.05), '#ffb35a', def.radius, 0.5, 0.15);
    const pd = game.player.position.distanceTo(pos);
    audio.skill('boom', pd);
    if (pd < 16) game.player.addRecoil(0.02 * (1 - pd / 16), (Math.random() - 0.5) * 0.02);
    let hitAny = false;
    game.net?.fx({ k: 'boom', x: pos.x, y: pos.y + 0.3, z: pos.z, c: '#ffb35a', s: def.radius * 0.75 });
    for (const b of game.hostiles()) {
      if (!b.alive) continue;
      const c = b.position.clone().setY(b.position.y + 1);
      const d = c.distanceTo(pos);
      if (d > def.radius) continue;
      const dmg = game.player.weakT > 0 ? 1 : Math.round((def.minDamage + (def.damage - def.minDamage) * (1 - d / def.radius)) * game.skills.damageMul());
      const res = b.applyDamage(dmg, { weapon: def.name, from: 'player', point: c, skin: null });
      game.hud.damageNumber(c.setY(b.position.y + 1.9), dmg, false);
      game.hud.hitmarker(res.killed ? 'kill' : 'hit');
      if (res.killed) audio.kill(); else audio.hit(false);
      hitAny = true;
    }
    if (hitAny) game.hits++;
    game.onPlayerShot();
  }

  updateGrenades(dt) {
    const world = this.game.world;
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const gr = this.grenades[i];
      gr.fuse -= dt;
      gr.vel.y -= 18 * dt;
      const prev = gr.mesh.position.clone();
      const p = gr.mesh.position;
      p.addScaledVector(gr.vel, dt);
      if (p.y < 0.07) {
        p.y = 0.07;
        if (gr.vel.y < -1.5) audio.click(500, 0.12);
        gr.vel.y = Math.abs(gr.vel.y) * 0.35; gr.vel.x *= 0.7; gr.vel.z *= 0.7;
        gr.spin.multiplyScalar(0.7);
      }
      const box = world.colliders.find((b) => b.containsPoint(p));
      if (box) {
        p.copy(prev);
        if (prev.y >= box.max.y) { gr.vel.y = Math.abs(gr.vel.y) * 0.35; gr.vel.x *= 0.7; gr.vel.z *= 0.7; }
        else if (prev.x < box.min.x || prev.x > box.max.x) gr.vel.x *= -0.45;
        else gr.vel.z *= -0.45;
      }
      gr.mesh.rotation.x += gr.spin.x * dt;
      gr.mesh.rotation.y += gr.spin.y * dt;
      gr.mesh.rotation.z += gr.spin.z * dt;
      if (Math.random() < 0.3) this.game.effects.puff(p.clone(), '#c9ccd2', 0.08, 0.3, 0.4);
      if (gr.fuse <= 0) { this.grenades.splice(i, 1); this.explodeGrenade(gr); }
    }
  }

  updateThrow(dt) {
    const s = this.slot, def = s.def, m = s.model;
    if (this.adsHeld && !this.adsUsed && this.game.player.alive) { this.throwGrenade(true); this.adsUsed = true; }
    if (!this.adsHeld) this.adsUsed = false;
    if (this.throwT >= 0) {
      this.throwT += dt / 0.8;
      if (!this.thrown && this.throwT >= 0.45) { this.thrown = true; this.releaseGrenade(); }
      if (this.throwT >= 1) {
        this.throwT = -1;
        if (s.reserve > 0) { s.mag = 1; s.reserve--; this.drawT = 0; audio.swap(); }
      }
    }
    if (this.throwT < 0 && s.mag === 0 && s.reserve > 0) { s.mag = 1; s.reserve--; this.drawT = 0; }
    m.held.visible = s.mag > 0 && !(this.throwT >= 0.45);
    // the pin comes out during the wind-up
    m.pin.visible = !(this.throwT >= 0.15);
  }

  get slot() { return this.slots[this.cur]; }
  get def() { return this.slot.def; }
  get isAds() { return this.adsT > 0.5; }

  /** respawn in online matches: full magazines and reserves, back to slot 1 */
  refill() {
    this.leftCast = null;
    for (const s of this.slots) { s.mag = s.def.mag; s.reserve = s.def.reserve; }
    this.reloading = false;
    this.throwT = -1;
    this.echo = null;
    this.casting = false;
    this.equip(0, true);
  }

  equip(i, instant = false) {
    if (i === this.cur || i < 0 || i >= this.slots.length) return;
    if (this.cur >= 0) this.slot.model.group.visible = false;
    if (this.slot?.model.handShell) this.slot.model.handShell.visible = false;
    this.cur = i;
    const m = this.slot.model;
    m.group.visible = true;
    this.rightArm.position.copy(m.grip);
    this.leftPos.copy(m.leftRest);
    this.reloading = false;
    this.shellPhase = null;
    this.cycleP = -1;
    this.drawT = instant ? 1 : 0;
    this.inspectT = -1;
    this.autoReloadAt = 0;
    this.burstLeft = 0;
    this.meleeT = -1;
    this.throwT = -1;
    this.bowDraw = 0;
    this.bowVis = 0;
    this.adsUsed = true;
    this.leftArm.visible = !['melee', 'grenade'].includes(this.def.kind);
    if (!instant) audio.swap();
    this.game.hud?.onWeaponChange();
  }


  onMouseMove(dx, dy) {
    const k = 1 - this.adsT * 0.7;
    this.sway.x = clamp(this.sway.x - dx * 0.00011 * k, -0.04, 0.04);
    this.sway.y = clamp(this.sway.y + dy * 0.00011 * k, -0.04, 0.04);
  }

  sensMul() {
    const def = this.def;
    const k = def.scope ? Math.max(0.18, def.adsFov / save.fov) : 0.7;
    return 1 + (k - 1) * this.adsT;
  }

  /* ---------------- reload ---------------- */
  /** F: bring the gun up and turn it to admire the details */
  inspect() {
    if (this.reloading || this.drawT < 1 || this.cycleP >= 0 || this.adsHeld) return;
    this.inspectT = 0;
    audio.swap();
  }

  reload() {
    this.inspectT = -1;
    const s = this.slot, def = s.def;
    if (def.kind !== 'gun' || this.casting || def.noReload) return;
    if (this.reloading || this.drawT < 1 || s.mag >= def.mag || s.reserve <= 0 || this.cycleP >= 0) return;
    this.reloading = true;
    this.reloadP = 0;
    this.firedEvents.clear();
    if (def.id === 'shotgun') { this.shellPhase = 'start'; this.shellT = 0; }
  }

  updateReload(dt) {
    const s = this.slot, def = s.def;
    if (def.id === 'shotgun') {
      this.shellT += dt;
      if (this.shellPhase === 'start' && this.shellT >= 0.3) { this.shellPhase = 'insert'; this.shellT = 0; this.shellDone = false; }
      else if (this.shellPhase === 'insert') {
        const q = this.shellT / def.reload;
        if (q >= 0.55 && !this.shellDone) {
          this.shellDone = true;
          s.mag++; s.reserve--;
          audio.shell();
        }
        if (q >= 1) {
          this.shellT = 0; this.shellDone = false;
          if (s.mag >= def.mag || s.reserve <= 0) this.shellPhase = 'end';
        }
      } else if (this.shellPhase === 'end') {
        if (this.shellT >= 0.15 && !this.firedEvents.has('pump')) { this.firedEvents.add('pump'); audio.pump(); }
        if (this.shellT >= 0.55) { this.reloading = false; this.shellPhase = null; }
      }
      return;
    }
    this.reloadP += dt / def.reload;
    for (const [t, ev] of s.reload.events) {
      if (this.reloadP >= t && !this.firedEvents.has(t)) {
        this.firedEvents.add(t);
        if (ev === 'refill') {
          const need = def.mag - s.mag;
          const take = Math.min(need, s.reserve);
          s.mag += take; s.reserve -= take;
        } else if (ev === 'click') audio.click(2000, 0.3);
        else audio[ev]?.();
      }
    }
    if (this.reloadP >= 1) this.reloading = false;
  }

  /* ---------------- firing ---------------- */
  currentSpread() {
    const def = this.def, sp = def.spread, p = this.game.player;
    let hip = sp.hip + this.bloom + (p.moving ? sp.move : 0) + (p.onGround ? 0 : 0.05);
    if (p.sprinting) hip += 0.03;
    const ads = sp.ads + (p.moving ? sp.move * 0.25 : 0) + this.bloom * 0.4 + (p.onGround ? 0 : 0.03);
    return hip + (ads - hip) * smooth(this.adsT);
  }

  tryFire(fromBurst = false) {
    this.inspectT = -1;
    const s = this.slot, def = s.def;
    if (this.casting || this.castT > 0.3) return;
    if (def.kind === 'grenade') { this.throwGrenade(false); return; }
    if (def.kind === 'melee') { this.melee(false); return; }
    if (def.kind === 'bow') return; // handled by draw/release in update()
    if (this.drawT < 0.9) return;
    if (this.reloading) {
      if (def.id === 'shotgun' && s.mag > 0) { this.reloading = false; this.shellPhase = null; }
      else return;
    }
    if (this.cycleP >= 0 || this.time < this.nextFire) return;
    if (s.mag <= 0) {
      this.burstLeft = 0;
      if (!this.triggerUsed) { audio.dry(); this.triggerUsed = true; }
      this.reload();
      return;
    }
    s.mag--;
    s.lastShot = this.time;
    this.triggerUsed = true;
    const skills = this.game.skills;
    this.nextFire = this.time + def.fireInterval / skills.fireRateMul();
    if (def.burst) {
      this.burstLeft = fromBurst ? this.burstLeft - 1 : def.burst - 1;
      if (this.burstLeft <= 0) { this.burstLeft = 0; this.nextFire = this.time + def.burstDelay / skills.fireRateMul(); }
    }
    this.lastShot = this.time;
    const md = s.model;
    if (md.dual) { this.dualSide = !this.dualSide; md.muzzle = this.dualSide ? md.muzzleL : md.muzzleR; md.eject = this.dualSide ? md.ejectL : md.ejectR; }
    if (def.flame) this.fireFlame(def); else if (def.rail) this.fireRail(def); else this.fireBullets(def);

    // recoil
    const r = def.recoil, adsK = 1 - this.adsT * 0.35;
    this.kick.z += r.kickZ * adsK;
    this.kick.rx += r.kickRX * adsK;
    this.kick.ry += s.model.dual ? (this.dualSide ? 0.02 : -0.02) : (Math.random() - 0.5) * r.kickRX * 0.3;
    this.game.player.addRecoil(r.pitch * adsK, (Math.random() - 0.5) * 2 * r.yaw);
    this.bloom = Math.min(def.spread.maxBloom, this.bloom + def.spread.bloom);

    // muzzle + sound
    const m = s.model;
    const vmPos = m.muzzle.getWorldPosition(new THREE.Vector3());
    if (!this.scoped && !def.flame) this.game.effects.muzzleFlash(this.vmScene, vmPos, this.muzzleWorld(), m.flashScale);
    this.vmFlash.position.copy(vmPos);
    this.vmFlash.intensity = 3;
    this.vmFlashT = 0.05;
    audio.shot(def.id);

    if (def.id === 'shotgun' || def.id === 'sniper') { this.cycleP = 0; this.firedEvents.clear(); }
    else if (!def.flame) this.ejectShell();
    skills.onPlayerShot();
    this.game.onPlayerShot();
    if (s.mag === 0 && s.reserve > 0) this.autoReloadAt = this.time + (def.id === 'sniper' ? def.cycle + 0.1 : 0.25);
  }

  ejectShell() {
    const m = this.slot.model;
    if (this.scoped) return;
    const p = m.eject.getWorldPosition(new THREE.Vector3());
    this.game.effects.shell(this.vmScene, p, new THREE.Vector3(1, 0.2, 0.2), this.def.id === 'shotgun');
  }

  /** World-space muzzle position (maps the viewmodel muzzle through screen space into the world camera). */
  muzzleWorld() {
    const m = this.slot.model;
    const v = m.muzzle.getWorldPosition(new THREE.Vector3());
    const dist = v.length();
    v.project(this.vmCamera);
    const cam = this.game.camera;
    const dir = new THREE.Vector3(v.x, v.y, 0.5).unproject(cam).sub(cam.position).normalize();
    return cam.position.clone().addScaledVector(dir, Math.max(0.4, dist));
  }

  fireBullets(def) {
    const game = this.game, cam = game.camera;
    const origin = cam.position.clone();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    const spread = this.currentSpread();
    const muzzle = this.muzzleWorld();
    const targets = game.world.solids.concat(game.enemyMeshes());
    const hits = new Map();
    const pellets = def.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
      const dir = fwd.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
      this.raycaster.set(origin, dir);
      this.raycaster.far = def.range;
      const hit = this.raycaster.intersectObjects(targets, false)[0];
      const end = hit ? hit.point : origin.clone().addScaledVector(dir, def.range);
      if (i === 0) this.lastTracerEnd = end.clone();
      if (i < 4 || Math.random() < 0.5) game.effects.tracer(muzzle, end, def.tracer, def.id === 'sniper' ? 0.03 : 0.016, def.id === 'sniper' ? 500 : 280);
      if (!hit) continue;
      const enemy = hit.object.userData.enemy;
      const normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : null;
      if (normal && normal.dot(dir) > 0) normal.negate();
      if (enemy && enemy.alive) {
        const head = this.game.hack || hit.object.userData.part === 'head';
        let dmg = head ? def.head : def.damage;
        if (def.falloffStart && hit.distance > def.falloffStart) dmg *= clamp(1 - (hit.distance - def.falloffStart) / 30, 0.3, 1);
        const h = hits.get(enemy) || { dmg: 0, head: false, point: hit.point };
        h.dmg += dmg * game.skills.damageMul(); h.head = h.head || head;
        hits.set(enemy, h);
        game.effects.impact(hit.point, normal, 'hit');
      } else {
        game.effects.impact(hit.point, normal, hit.object.material === game.world.crateMat ? 'wood' : 'ice');
      }
    }
    if (hits.size) game.hits++;
    for (const [enemy, h] of hits) {
      if (game.player.weakT > 0) h.dmg = 1;
      const res = enemy.applyDamage(Math.round(h.dmg), { weapon: def.name, headshot: h.head, from: 'player', point: h.point, skin: this.slot.skin });
      game.hud.hitmarker(res.killed ? 'kill' : h.head ? 'head' : 'hit');
      game.hud.damageNumber(h.point, Math.round(h.dmg), h.head);
      if (res.killed) audio.kill(); else audio.hit(h.head);
    }
  }

  /** flamethrower: everything hostile inside the cone (and not behind a wall) takes damage and catches fire */
  fireFlame(def) {
    const game = this.game, cam = game.camera;
    const origin = cam.position.clone();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    game.effects.flame(this.muzzleWorld(), fwd, def.range, 3);
    this.lastTracerEnd = origin.clone().addScaledVector(fwd, def.range);
    let any = false;
    for (const e of game.hostiles()) {
      if (!e.alive) continue;
      const c = e.position.clone().setY(e.position.y + 1.1);
      const d = c.distanceTo(origin);
      if (d > def.range + 0.6) continue;
      const dir = c.clone().sub(origin).normalize();
      if (dir.dot(fwd) < (d < 2 ? 0.6 : def.cone)) continue;
      this.raycaster.set(origin, dir); this.raycaster.far = d;
      if (this.raycaster.intersectObjects(game.world.solids, false).length) continue;
      any = true;
      const head = game.hack;
      let dmg = (head ? def.head : def.damage) * game.skills.damageMul();
      if (game.player.weakT > 0) dmg = 1;
      const res = e.applyDamage(Math.round(dmg), { weapon: def.name, headshot: head, from: 'player', point: c, skin: this.slot.skin });
      game.hud.hitmarker(res.killed ? 'kill' : head ? 'head' : 'hit');
      if (res.killed) audio.kill();
      else this.burns.set(e, { t: def.burn.secs, acc: 0, def, skin: this.slot.skin });
    }
    if (any) game.hits++;
  }

  /** railgun: hold the trigger to charge, it fires by itself when full; letting go early cancels */
  updateRail(dt, can) {
    const s = this.slot, def = s.def, m = s.model;
    const ready = can && this.trigger && !this.reloading && this.drawT >= 0.9 && this.time >= this.nextFire && !this.casting;
    if (ready && s.mag > 0) {
      if (!this.railT) audio.railCharge?.();
      this.railT = (this.railT || 0) + dt;
      if (this.railT >= def.charge) { this.railT = 0; this.tryFire(); }
    } else {
      if (this.trigger && can && s.mag <= 0 && !this.triggerUsed) this.tryFire(); // empty: click + reload
      this.railT = 0;
    }
    if (m.coilMat) m.coilMat.emissiveIntensity = 0.4 + (this.railT / def.charge) * 3.5;
  }

  /** railgun shot: pierces every enemy on the line up to the first wall */
  fireRail(def) {
    const game = this.game, cam = game.camera;
    const origin = cam.position.clone();
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    this.raycaster.set(origin, dir);
    this.raycaster.far = def.range;
    const hits = this.raycaster.intersectObjects(game.world.solids.concat(game.enemyMeshes()), false);
    let end = origin.clone().addScaledVector(dir, def.range);
    const done = new Set();
    let hitAny = false;
    for (const h of hits) {
      const enemy = h.object.userData.enemy;
      if (!enemy) { end = h.point.clone(); game.effects.impact(h.point, null, 'ice'); break; }
      if (done.has(enemy) || !enemy.alive) continue;
      done.add(enemy);
      hitAny = true;
      const head = game.hack || h.object.userData.part === 'head';
      let dmg = (head ? def.head : def.damage) * game.skills.damageMul();
      if (game.player.weakT > 0) dmg = 1;
      const res = enemy.applyDamage(Math.round(dmg), { weapon: def.name, headshot: head, from: 'player', point: h.point, skin: this.slot.skin });
      game.hud.hitmarker(res.killed ? 'kill' : head ? 'head' : 'hit');
      game.hud.damageNumber(h.point, Math.round(dmg), head);
      if (res.killed) audio.kill(); else audio.hit(head);
    }
    if (hitAny) game.hits++;
    this.lastTracerEnd = end.clone();
    game.effects.railBeam(this.muzzleWorld(), end);
  }

  /** burning enemies take a little damage every tick */
  updateBurns(dt) {
    const game = this.game;
    for (const [e, b] of this.burns) {
      b.t -= dt; b.acc += dt;
      if (!e.alive || e.gone || b.t <= 0) { this.burns.delete(e); continue; }
      if (Math.random() < dt * 8) game.effects.puff(e.position.clone().setY(e.position.y + 0.6 + Math.random()), '#ff7a1a', 0.6, 0.4, 0.8);
      if (b.acc >= b.def.burn.tick) {
        b.acc -= b.def.burn.tick;
        const p = e.position.clone().setY(e.position.y + 1.1);
        const res = e.applyDamage(b.def.burn.dmg, { weapon: b.def.name, from: 'player', point: p, skin: b.skin });
        game.hud.damageNumber(p, b.def.burn.dmg, false);
        if (res.killed) { audio.kill(); game.hud.hitmarker('kill'); this.burns.delete(e); }
      }
    }
  }

  /* ---------------- melee ---------------- */
  melee(heavy) {
    if (this.meleeT >= 0 || this.drawT < 0.9) return;
    this.meleeT = 0;
    this.meleeHeavy = heavy;
    this.meleeHitDone = false;
    this.meleeSide = -this.meleeSide;
    this.triggerUsed = true;
    audio.slash(heavy);
  }

  meleeHit() {
    const game = this.game, def = this.def, cam = game.camera;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    let best = null, bestD = Infinity;
    for (const b of game.hostiles()) {
      if (!b.alive) continue;
      const c = b.position.clone().setY(b.position.y + 1.2);
      const d = c.distanceTo(cam.position);
      if (d > def.range + 0.5) continue;
      const dir = c.sub(cam.position).normalize();
      if (dir.dot(fwd) < 0.5) continue;
      if (d < bestD) { bestD = d; best = b; }
    }
    if (!best) { audio.click(600, 0.12); return; }
    const toBot = best.position.clone().sub(game.player.position).setY(0).normalize();
    const botFwd = new THREE.Vector3(-Math.sin(best.yaw), 0, -Math.cos(best.yaw));
    const backstab = botFwd.dot(toBot) > 0.35;
    const dmg = game.player.weakT > 0 ? 1 : Math.round((backstab ? def.back : this.meleeHeavy ? def.heavy : def.damage) * game.skills.damageMul());
    const point = best.position.clone().setY(best.position.y + 1.3);
    const res = best.applyDamage(dmg, { weapon: def.name, headshot: backstab, from: 'player', point, skin: this.slot.skin, melee: true });
    game.effects.impact(point, toBot.clone().negate(), 'hit');
    game.hud.hitmarker(res.killed ? 'kill' : backstab ? 'head' : 'hit');
    game.hud.damageNumber(point, dmg, backstab);
    if (backstab) game.hud.msg('백스탭!', 1);
    if (res.killed) audio.kill(); else audio.hit(backstab);
    game.player.addRecoil(0.01, 0);
    game.onPlayerShot(true);
  }

  /* ---------------- bow ---------------- */
  makeArrowMesh() {
    const g = new THREE.Group();
    const add = (geo, mat, z) => { const m = new THREE.Mesh(geo, mat); m.position.z = z; g.add(m); return m; };
    add(new THREE.CylinderGeometry(0.0045, 0.0045, 0.72, 6).rotateX(Math.PI / 2), VM.rubber, -0.36);
    add(new THREE.CylinderGeometry(0.0, 0.01, 0.05, 4).rotateX(Math.PI / 2), VM.steel, -0.745);
    for (let i = 0; i < 3; i++) {
      const f = add(new THREE.BoxGeometry(0.0015, 0.02, 0.07), i ? VM.white : VM.accent, -0.07);
      f.rotation.z = (i / 3) * Math.PI * 2;
    }
    const glow = this.game.effects.glowSprite('#bff0ff', 0.12);
    glow.position.z = -0.05;
    g.add(glow);
    return g;
  }

  fireArrow(power) {
    const game = this.game, s = this.slot, def = s.def, cam = game.camera;
    s.mag = 0;
    this.nockT = s.reserve > 0 ? def.reload : 0;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const spread = this.currentSpread() * (1 - power * 0.8);
    fwd.x += (Math.random() - 0.5) * spread * 2;
    fwd.y += (Math.random() - 0.5) * spread * 2;
    fwd.normalize();
    const speed = def.arrowSpeed[0] + (def.arrowSpeed[1] - def.arrowSpeed[0]) * power;
    const mesh = this.makeArrowMesh();
    const pos = cam.position.clone().addScaledVector(fwd, 0.6).add(new THREE.Vector3(0, -0.05, 0));
    mesh.position.copy(pos);
    game.scene.add(mesh);
    this.arrows.push({ mesh, pos, vel: fwd.multiplyScalar(speed), power, life: 6, skin: s.skin });
    this.kick.z += def.recoil.kickZ;
    this.kick.rx += def.recoil.kickRX;
    game.player.addRecoil(def.recoil.pitch, 0);
    audio.bow(power);
    this.game.skills.onPlayerShot();
    game.onPlayerShot();
  }

  updateArrows(dt) {
    const game = this.game, def = WEAPONS.bow;
    const ray = this.raycaster;
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.life -= dt;
      const prev = a.pos.clone();
      a.vel.y -= 9.8 * 0.55 * dt;
      a.pos.addScaledVector(a.vel, dt);
      const seg = a.pos.clone().sub(prev);
      const len = seg.length();
      ray.set(prev, seg.normalize());
      ray.far = len + 0.75;
      const hit = ray.intersectObjects(game.world.solids.concat(game.enemyMeshes()), false)[0];
      a.mesh.position.copy(a.pos);
      a.mesh.lookAt(a.pos.clone().sub(a.vel));
      if (Math.random() < 0.5) game.effects.puff(a.pos.clone(), '#bff0ff', 0.12, 0.25, 0.4);
      if (hit) {
        const enemy = hit.object.userData.enemy;
        a.mesh.position.copy(hit.point).addScaledVector(ray.ray.direction, 0.25);
        if (enemy && enemy.alive) {
          const head = this.game.hack || hit.object.userData.part === 'head';
          const dmg = game.player.weakT > 0 ? 1 : Math.round((def.damage + (def.maxDamage - def.damage) * a.power) * (head ? def.headMul : 1) * game.skills.damageMul());
          const res = enemy.applyDamage(dmg, { weapon: def.name, headshot: head, from: 'player', point: hit.point, skin: a.skin });
          game.hud.hitmarker(res.killed ? 'kill' : head ? 'head' : 'hit');
          game.hud.damageNumber(hit.point, dmg, head);
          game.effects.impact(hit.point, null, 'hit');
          if (res.killed) audio.kill(); else audio.hit(head);
          game.hits++;
          // stick into the body part
          hit.object.attach(a.mesh);
        } else {
          const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : null;
          game.effects.impact(hit.point, n, 'ice');
        }
        a.mesh.children.filter((c) => c.isSprite).forEach((c) => a.mesh.remove(c));
        this.stuck.push({ mesh: a.mesh, t: 10 });
        if (this.stuck.length > 25) { const o = this.stuck.shift(); o.mesh.parent?.remove(o.mesh); }
        this.arrows.splice(i, 1);
        continue;
      }
      if (a.life <= 0 || a.pos.y < -5) { game.scene.remove(a.mesh); this.arrows.splice(i, 1); }
    }
    for (let i = this.stuck.length - 1; i >= 0; i--) {
      const st = this.stuck[i];
      st.t -= dt;
      if (st.t <= 0) { st.mesh.parent?.remove(st.mesh); this.stuck.splice(i, 1); }
    }
  }

  updateBow(dt) {
    const s = this.slot, def = s.def, p = this.game.player;
    const rate = this.game.skills.fireRateMul();
    if (this.nockT > 0) {
      this.nockT -= dt * this.game.skills.reloadMul();
      if (this.nockT <= 0 && s.reserve > 0) { s.mag = 1; s.reserve--; audio.click(1500, 0.2); }
    }
    const ready = s.mag > 0 && this.nockT <= 0 && this.drawT >= 1 && p.alive && this.inspectT < 0 && !this.casting;
    if (this.trigger && ready) {
      if (this.bowDraw === 0) audio.click(700, 0.18);
      this.bowDraw = Math.min(1, this.bowDraw + (dt / def.drawTime) * rate);
      this.inspectT = -1;
    } else if (!this.trigger && this.bowDraw > 0) {
      if (this.bowDraw > 0.15 && s.mag > 0) this.fireArrow(this.bowDraw);
      this.bowDraw = 0;
    }
    this.bowVis = this.bowDraw > this.bowVis ? this.bowDraw : damp(this.bowVis, this.bowDraw, 40, dt);
    const m = s.model;
    m.setDraw(this.bowVis);
    this.rightArm.position.copy(m.grip);
    // arrow: hidden after release, slides back in while nocking
    const nockP = this.nockT > 0 ? 1 - this.nockT / def.reload : 1;
    m.arrow.visible = s.mag > 0 || (this.nockT > 0 && nockP > 0.4);
    m.arrow.position.y = s.mag > 0 ? 0 : -0.12 * (1 - nockP);
  }

  /* ---------------- per-frame ---------------- */
  update(dt) {
    this.time += dt;
    const game = this.game, p = game.player, s = this.slot, def = s.def, m = s.model;
    const relMul = game.skills.reloadMul();

    if (this.burns.size) this.updateBurns(dt);
    // self-recharging fuel (flamethrower): refills a moment after the trigger is let go, held or not
    for (const sl of this.slots) {
      const rc = sl.def.recharge;
      if (!rc || sl.mag >= sl.def.mag || this.time - (sl.lastShot || -9) < rc.delay) continue;
      sl.chargeAcc = (sl.chargeAcc || 0) + rc.rate * dt;
      const add = Math.floor(sl.chargeAcc);
      if (add > 0) { sl.chargeAcc -= add; sl.mag = Math.min(sl.def.mag, sl.mag + add); }
    }
    m.skinAnim?.(this.time);
    if (this.drawT < 1) this.drawT = Math.min(1, this.drawT + dt / 0.38);
    if (this.reloading) this.updateReload(dt * relMul);
    if (this.cycleP >= 0) {
      this.cycleP += dt / (def.cycle / game.skills.fireRateMul());
      for (const [t, ev] of s.cycle.events) {
        if (this.cycleP >= t && !this.firedEvents.has('c' + t)) {
          this.firedEvents.add('c' + t);
          if (ev === 'eject') this.ejectShell();
          else if (ev === 'click') audio.click(2000, 0.3);
          else audio[ev]?.();
        }
      }
      if (this.cycleP >= 1) this.cycleP = -1;
    }
    if (this.autoReloadAt && this.time >= this.autoReloadAt && this.cycleP < 0) { this.autoReloadAt = 0; this.reload(); }
    if (def.kind === 'melee') {
      if (def.guard) this.guarding = this.adsHeld && p.alive && this.meleeT < 0 && this.drawT >= 0.9 && !game.skills.bikeT;
      else if (this.adsHeld && !this.adsUsed && p.alive) { this.melee(true); this.adsUsed = true; }
      if (!this.adsHeld) this.adsUsed = false;
      if (this.meleeT >= 0) {
        this.meleeT += dt / (this.meleeHeavy ? def.heavyTime : def.lightTime);
        if (!this.meleeHitDone && this.meleeT >= (this.meleeHeavy ? 0.55 : 0.42)) { this.meleeHitDone = true; this.meleeHit(); }
        if (this.meleeT >= 1) this.meleeT = -1;
      }
    }
    if (!def.guard) this.guarding = false;
    this.guardT = damp(this.guardT || 0, this.guarding ? 1 : 0, 16, dt);
    if (def.kind === 'bow') this.updateBow(dt);
    if (def.kind === 'grenade') this.updateThrow(dt);
    this.updateArrows(dt);
    this.updateGrenades(dt);
    this.updateCast(dt);

    // ADS / sprint
    const sniperCycling = def.scope && this.cycleP >= 0;
    const wantAds = this.adsHeld && p.alive && !this.reloading && this.drawT > 0.6 && !sniperCycling && def.kind !== 'melee' && def.kind !== 'grenade' && !this.casting;
    this.adsT = damp(this.adsT, wantAds ? 1 : 0, def.scope ? 11 : 15, dt);
    const sprinting = p.sprinting && p.moving && !wantAds && !this.reloading && this.time - this.lastShot > 0.3;
    this.sprintT = damp(this.sprintT, sprinting ? 1 : 0, 9, dt);
    this.slideTilt = damp(this.slideTilt || 0, p.sliding ? 1 : 0, 10, dt);
    this.slideAmt = damp(this.slideAmt, p.sliding ? 1 : 0, p.sliding ? 14 : 8, dt);
    if (this.inspectT >= 0) {
      if (wantAds || this.reloading || !p.alive) this.inspectT = -1;
      else { this.inspectT += dt / 2.6; if (this.inspectT >= 1) this.inspectT = -1; }
    }

    const onBike = game.skills.bikeT > 0;
    if (def.rail) this.updateRail(dt, p.alive && !onBike);
    else if (this.trigger && p.alive && !onBike && (def.auto || !this.triggerUsed)) this.tryFire();
    if (this.burstLeft > 0 && p.alive && this.time >= this.nextFire) this.tryFire(true);

    this.bloom = damp(this.bloom, 0, 5, dt);
    this.kick.z = damp(this.kick.z, 0, 14, dt);
    this.kick.rx = damp(this.kick.rx, 0, 12, dt);
    this.kick.ry = damp(this.kick.ry, 0, 12, dt);
    this.sway.x = damp(this.sway.x, 0, 7, dt);
    this.sway.y = damp(this.sway.y, 0, 7, dt);
    if (this.vmFlashT > 0) { this.vmFlashT -= dt; if (this.vmFlashT <= 0) this.vmFlash.intensity = 0; }

    // ---- root pose ----
    const e = smooth(this.adsT);
    if (m.aimParts) { const show = this.adsT < 0.15; for (const o of m.aimParts) o.visible = show; } // skin parts never block the sights
    const pos = new THREE.Vector3().copy(m.hip).lerp(m.dual ? m.hip : new THREE.Vector3(0, -m.sightY * VM_SCALE, m.adsZ * 0.85), e);
    const bobA = p.bobAmt * (1 - e * 0.85);
    pos.x += Math.cos(p.bobPhase) * 0.011 * bobA + this.sway.x * (1 - e * 0.8);
    pos.y += -Math.abs(Math.sin(p.bobPhase)) * 0.012 * bobA + this.sway.y * (1 - e * 0.8);
    pos.y += clamp(-p.vel.y * 0.003, -0.03, 0.03) * (1 - e * 0.7);
    pos.z += this.kick.z;
    const st = smooth(this.sprintT);
    pos.x -= 0.03 * st; pos.y -= 0.05 * st; pos.z += 0.03 * st;
    const dr = 1 - smooth(this.drawT);
    pos.y -= 0.3 * dr;
    const cr = smooth(Math.min(1, this.castT)); // gun lowered while casting
    pos.y -= 0.42 * cr; pos.x += 0.06 * cr;
    let irot = Z3;
    if (this.throwT >= 0) {
      const t = this.throwT;
      const tp = this.throwShort
        ? kf([[0, Z3], [0.35, [0.02, -0.06, 0.05]], [0.5, [-0.02, -0.02, -0.18]], [0.75, [0, -0.08, -0.08]], [1, Z3]], t)
        : kf([[0, Z3], [0.35, [0.05, 0.07, 0.03]], [0.5, [-0.04, 0.03, -0.16]], [0.75, [0, -0.12, -0.05]], [1, Z3]], t);
      irot = this.throwShort
        ? kf([[0, Z3], [0.35, [-0.6, 0, 0.2]], [0.5, [0.6, 0, 0]], [0.75, [0.3, 0, 0]], [1, Z3]], t)
        : kf([[0, Z3], [0.35, [0.45, -0.25, 0.35]], [0.5, [-0.7, 0.15, -0.15]], [0.75, [-0.35, 0, 0]], [1, Z3]], t);
      pos.add(new THREE.Vector3(tp[0], tp[1], tp[2]));
    }
    if (this.meleeT >= 0) {
      const t = this.meleeT, sd = this.meleeSide;
      const mp = this.meleeHeavy
        ? kf([[0, Z3], [0.35, [0.02, -0.02, 0.1]], [0.55, [-0.06, 0.03, -0.24]], [0.75, [-0.05, 0.02, -0.2]], [1, Z3]], t)
        : kf([[0, Z3], [0.2, [0.07 * sd, 0.07, 0.03]], [0.45, [-0.2 * sd, -0.07, -0.09]], [0.7, [-0.13 * sd, -0.08, -0.02]], [1, Z3]], t);
      const mr = this.meleeHeavy
        ? kf([[0, Z3], [0.35, [0.3, 0, 0.2]], [0.55, [-0.2, 0.3, 0]], [0.75, [-0.15, 0.3, 0]], [1, Z3]], t)
        : kf([[0, Z3], [0.2, [0.4, -0.3 * sd, 0.6 * sd]], [0.45, [-0.3, 0.7 * sd, -0.9 * sd]], [0.7, [-0.2, 0.4 * sd, -0.6 * sd]], [1, Z3]], t);
      pos.add(new THREE.Vector3(mp[0], mp[1], mp[2]));
      irot = mr;
    }
    if (this.guardT > 0.01) {
      const gk = smooth(this.guardT);
      pos.add(new THREE.Vector3(-0.13 * gk, 0.07 * gk, -0.02 * gk));
      irot = [irot[0] + 0.15 * gk, irot[1] + 0.5 * gk, irot[2] + 1.3 * gk];
    }
    if (this.inspectT >= 0) {
      const t = this.inspectT;
      const w = kf([[0, 0], [0.12, 1], [0.88, 1], [1, 0]], t);
      pos.lerp(new THREE.Vector3(0.03, -0.11, -0.36), w);
      irot = kf([[0, Z3], [0.15, [0.15, 0.85, 0.3]], [0.42, [0.25, 1.15, 0.4]], [0.58, [-0.05, -0.55, -0.3]], [0.85, [-0.15, -0.85, -0.4]], [1, Z3]], t);
    }
    this.root.position.copy(pos);
    this.root.rotation.set(
      this.kick.rx - 0.25 * st - 0.9 * dr - 0.8 * cr + this.sway.y * 1.5 + irot[0],
      this.kick.ry + 0.6 * st + this.sway.x * 2 + irot[1],
      0.25 * st + Math.cos(p.bobPhase) * 0.01 * bobA + 0.35 * this.slideTilt * (1 - e) + irot[2],
    );

    // ---- pivot / parts animation ----
    const L = m.leftRest.toArray();
    let tilt = Z3, left = L, magY = 0, magVis = true, slideZ = 0, handleZ = 0, boltRot = 0, boltZ = 0, pumpZ = 0, shellVis = false;
    if (this.reloading && s.reload) {
      const R = s.reload, t = this.reloadP;
      tilt = kf(R.tilt, t); left = kf(R.left, t);
      magY = kf(R.magY, t); magVis = !(t > R.magHide[0] && t < R.magHide[1]);
      if (R.slideZ) slideZ = kf(R.slideZ, t);
      if (R.handleZ) handleZ = kf(R.handleZ, t);
      if (R.boltRot) { boltRot = kf(R.boltRot, t); boltZ = kf(R.boltZ, t); }
    } else if (this.reloading && def.id === 'shotgun') {
      const T = [0.1, -0.15, -0.5], port = [0, -0.06, -0.06];
      if (this.shellPhase === 'start') {
        const u = smooth(Math.min(1, this.shellT / 0.3));
        tilt = lerpArr(Z3, T, u); left = lerpArr(L, [0, -0.15, -0.02], u);
      } else if (this.shellPhase === 'insert') {
        const q = Math.min(1, this.shellT / def.reload);
        tilt = T;
        left = kf([[0, [0, -0.15, -0.02]], [0.35, port], [0.55, [0, -0.035, -0.1]], [1, [0, -0.15, -0.02]]], q);
        shellVis = q < 0.55;
      } else {
        const u = Math.min(1, this.shellT / 0.55);
        tilt = lerpArr(T, Z3, smooth(Math.min(1, u * 2)));
        pumpZ = kf([[0, 0], [0.25, 0], [0.5, 0.09], [0.8, 0]], u);
        left = u < 0.33 ? lerpArr([0, -0.15, -0.02], L, smooth(u * 3)) : [L[0], L[1], L[2] + pumpZ];
      }
    } else if (this.cycleP >= 0 && s.cycle) {
      const C = s.cycle, t = this.cycleP;
      tilt = kf(C.tilt, t);
      if (C.left) left = kf(C.left, t);
      if (C.boltRot) { boltRot = kf(C.boltRot, t); boltZ = kf(C.boltZ, t); }
      if (C.pumpZ) { pumpZ = kf(C.pumpZ, t); left = [L[0], L[1], L[2] + pumpZ]; }
    }
    if (def.id === 'pistol' && !this.reloading) {
      const k = (this.time - this.lastShot) / 0.08;
      slideZ = k < 1 ? 0.03 * (1 - k) : 0;
      if (s.mag === 0) slideZ = 0.03; // slide locked back
    }
    if (this.slideAmt > 0.01 && !this.reloading) {
      // left hand leaves the gun and touches the ground (lower-left of the screen)
      this.root.updateMatrixWorld(true);
      const ground = this.pivot.worldToLocal(new THREE.Vector3(-0.3, -0.25, -0.55)).toArray();
      left = lerpArr(left, ground, smooth(Math.min(1, this.slideAmt * 1.3)));
    }
    const rt = 22;
    this.pivot.rotation.x = damp(this.pivot.rotation.x, tilt[0], rt, dt);
    this.pivot.rotation.y = damp(this.pivot.rotation.y, tilt[1], rt, dt);
    this.pivot.rotation.z = damp(this.pivot.rotation.z, tilt[2], rt, dt);
    this.leftPos.x = damp(this.leftPos.x, left[0], 28, dt);
    this.leftPos.y = damp(this.leftPos.y, left[1], 28, dt);
    this.leftPos.z = damp(this.leftPos.z, left[2], 28, dt);
    this.leftArm.position.copy(this.leftPos);
    if (m.mag) { m.mag.position.copy(m.magBase); m.mag.position.y += magY; m.mag.visible = magVis; }
    if (m.slide) m.slide.position.z = m.slideBase.z + slideZ;
    if (m.handle) m.handle.position.z = m.handleBase.z + handleZ;
    if (m.bolt) { m.bolt.rotation.z = boltRot; m.bolt.position.z = m.boltBase.z + boltZ; }
    if (m.pump) m.pump.position.z = m.pumpBase.z + pumpZ;
    if (m.handShell) m.handShell.visible = shellVis;

    // ---- cameras / scope ----
    this.scoped = !!def.scope && this.adsT > 0.55;
    this.root.visible = !this.scoped && p.alive && cr < 0.97 && !onBike;
    this.updateBikeBar(dt, onBike && p.alive);
    const cam = game.camera;
    const baseFov = save.fov;
    cam.fov = baseFov + (def.adsFov - baseFov) * e + 9 * this.slideAmt * (1 - e);
    this.updateLegs(p);
    cam.updateProjectionMatrix();
    this.vmCamera.fov = 56 - 10 * e;
    this.vmCamera.updateProjectionMatrix();
  }

  /** Biker E: handlebars + both hands in front of the camera while riding */
  updateBikeBar(dt, on) {
    if (!this.bikeBar) {
      if (!on) return;
      const g = new THREE.Group();
      const metal = new THREE.MeshStandardMaterial({ color: '#d43a2a', metalness: 0.6, roughness: 0.35 });
      const chrome = new THREE.MeshStandardMaterial({ color: '#cfd6dd', metalness: 1, roughness: 0.2 });
      const grip = new THREE.MeshStandardMaterial({ color: '#141518', roughness: 0.9 });
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 12).rotateZ(Math.PI / 2), chrome);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.2, 12), metal);
      stem.position.set(0, -0.1, 0.02);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.4), metal);
      frame.position.set(0, -0.2, -0.12); frame.rotation.x = -0.5;
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 28).rotateY(Math.PI / 2), grip);
      wheel.position.set(0, -0.36, -0.36);
      g.add(bar, stem, frame, wheel);
      for (const sx of [-1, 1]) {
        const gp = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.1, 10).rotateZ(Math.PI / 2), grip);
        gp.position.x = sx * 0.28; g.add(gp);
        const arm = makeArm(this.sleeve, sx);
        arm.scale.setScalar(VM_SCALE);
        arm.position.set(sx * 0.28, -0.02, 0.06);
        g.add(arm);
      }
      g.position.set(0, -0.19, -0.5);
      this.bikeBar = g;
      this.bikeBar.visible = false;
      this.vmScene.add(g);
    }
    this.bikeBar.visible = on;
    if (on) {
      const p = this.game.player;
      this.bikeBar.rotation.z = Math.sin(p.bobPhase) * 0.04;
      this.bikeBar.position.y = -0.19 + Math.abs(Math.sin(p.bobPhase)) * 0.008;
    }
  }

  /** Slide legs: lead leg stretched forward, other leg tucked; they slide in from below. */
  updateLegs(p) {
    const a = smooth(Math.min(1, this.slideAmt));
    this.legs.visible = a > 0.02 && p.alive;
    if (!this.legs.visible) return;
    this.legs.position.set(-0.13, -0.95 + 0.58 * a, 0.12 - 0.17 * a);
    if (p.sliding) this.legs.position.x += (Math.random() - 0.5) * 0.006;
    const [lead, tuck] = this.legs.userData.legs;
    // lead leg stretched forward along the ground, toe up; other leg tucked under (shin folds down/back)
    lead.rotation.set(0.1, -0.06, 0);
    lead.userData.knee.rotation.x = 0.04;
    tuck.rotation.set(-0.35, 0.3, 0.2);
    tuck.userData.knee.rotation.x = -1.3 * a;
  }

  /** Titan E: arms turn into rough stone with glowing cracks */
  setGolem(on) {
    if (on && !this._sleeveBase) this._sleeveBase = { c: this.sleeve.color.clone(), e: this.sleeve.emissive.clone(), r: this.sleeve.roughness };
    if (on) {
      this.sleeve.color.set('#7a7068'); this.sleeve.emissive.set('#ff5a10'); this.sleeve.emissiveIntensity = 0.18;
      this.sleeve.roughness = 1; this.sleeve.flatShading = true;
      for (const a of [this.rightArm, this.leftArm, this.castArm, this.castArmL]) a.scale.setScalar(1.18);
    } else if (this._sleeveBase) {
      this.sleeve.color.copy(this._sleeveBase.c); this.sleeve.emissive.copy(this._sleeveBase.e); this.sleeve.emissiveIntensity = 1;
      this.sleeve.roughness = this._sleeveBase.r; this.sleeve.flatShading = false;
      for (const a of [this.rightArm, this.leftArm]) a.scale.setScalar(1);
    }
    this.sleeve.needsUpdate = true;
  }

  /** Make viewmodel see-through (Shadow's stealth). */
  setGhost(on) {
    for (const mat of this.vmMaterials) {
      if (mat === VM.glass || mat === VM.red) continue;
      mat.transparent = on;
      mat.opacity = on ? 0.3 : 1;
      mat.needsUpdate = true;
    }
  }

  render(renderer) {
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.vmScene, this.vmCamera);
    renderer.autoClear = true;
  }

  resize() {
    this.vmCamera.aspect = innerWidth / innerHeight;
    this.vmCamera.updateProjectionMatrix();
  }

  dispose() {
    this.setGhost(false);
    for (const gr of this.grenades) this.game.scene.remove(gr.mesh);
    this.grenades = [];
    this.slots.forEach((s) => s.model.group.traverse((o) => o.isMesh && o.geometry.dispose()));
  }
}
