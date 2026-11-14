import * as THREE from 'three';
import { makeSoldier } from './soldier.js';
import { getCharacter } from '../data/characters.js';
import { damp } from '../util/noise.js';
import { serverNow } from '../net/firebase.js';
import { audio } from '../audio.js';

const INTERP_DELAY = 110; // ms behind the newest data → always two snapshots to blend between
const MAX_EXTRAP = 200;   // ms of extrapolation when packets are late

export const F_CROUCH = 1, F_SLIDE = 2, F_INVIS = 4, F_ALIVE = 8, F_GROUND = 16, F_SPRINT = 32, F_SHIELD = 64, F_GOLEM = 128, F_REVIVE = 256;

function nameTag(text, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 30px sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.7)';
  g.strokeText(text, 128, 32);
  g.fillStyle = color; g.fillText(text, 128, 32);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  sp.scale.set(1.6, 0.4, 1);
  sp.renderOrder = 10;
  return sp;
}

const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

/**
 * The other human player, seen through the network. Its hit meshes point back to this object so the
 * normal weapon/skill hit code works on it; damage is turned into a 'hit' message (victim-authoritative).
 */
export class RemotePlayer {
  constructor(game, uid, profile, { enemy = true, team = 'B' } = {}) {
    this.game = game;
    this.isRemote = true;
    this.uid = uid;
    this.team = team;
    this.enemy = enemy;
    this.profile = profile;
    this.name = profile?.name || '친구';
    const c = getCharacter(profile?.char);
    this.charName = c.name;
    this.model = makeSoldier(c.color, c.accent, c.id);
    this.position = new THREE.Vector3(0, -50, 0);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.hp = 150;
    this.maxHp = 150;
    this.predHp = 150;
    this.alive = true;
    this.invisible = false;
    this.crouch = 0;
    this.moving = false;
    this.sprinting = false;
    this.sliding = false;
    this.onGround = true;
    this.weaponId = 'rifle';
    this.walkPhase = 0;
    this.deathT = 0;
    this.flashT = 0;
    this.shotSeq = -1;
    this.buf = [];
    this.lastData = 0;
    this.slowT = 0; this.stunT = 0; this.burnT = 0; // written by skills code, unused here
    this.state = 'hunt'; this.canSee = false; this.alertT = 0;

    this.hitMeshes = this.model.hitParts;
    for (const m of this.hitMeshes) m.userData.enemy = this;
    this.tag = nameTag(this.name, enemy ? '#ff6b6b' : '#7fd0ff');
    this.tag.position.y = 2.25;
    this.model.group.add(this.tag);
    this.tag.visible = !enemy; // no name over enemies in combat
    this.model.group.visible = false;
    game.scene.add(this.model.group);
    // Inferno barrier seen from outside
    this.bubble = new THREE.Mesh(new THREE.SphereGeometry(1.25, 20, 14), new THREE.MeshBasicMaterial({ color: '#ffb627', transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.bubble.position.y = 1;
    this.bubble.visible = false;
    this.model.group.add(this.bubble);
    this._mats = this.model.allMaterials || [];
  }

  get eye() { return this.position.clone().setY(this.position.y + 1.6 - this.crouch * 0.7); }
  get aimHeight() { return 1.25 - this.crouch * 0.55; }

  /** network snapshot: [x,y,z,yaw,pitch,weapon,flags,hp,shotSeq,tx,ty,tz,ts] */
  push(s) {
    if (!Array.isArray(s)) return;
    const snap = { x: s[0], y: s[1], z: s[2], yaw: s[3], pitch: s[4], w: s[5], f: s[6] | 0, hp: s[7], seq: s[8], t: [s[9], s[10], s[11]], ts: s[12] };
    const last = this.buf[this.buf.length - 1];
    if (last && snap.ts <= last.ts) return;
    this.buf.push(snap);
    if (this.buf.length > 24) this.buf.shift();
    this.lastData = performance.now();
    // health / life are taken from the owner
    this.hp = snap.hp;
    if (performance.now() - (this._hitAt || 0) > 400 || snap.hp < this.predHp) this.predHp = snap.hp;
    const alive = !!(snap.f & F_ALIVE);
    if (alive && !this.alive) { this.deathT = 0; this.predHp = snap.hp; }
    this.alive = alive;
    this.invisible = !!(snap.f & F_INVIS);
    this.shield = !!(snap.f & F_SHIELD);
    this.golem = !!(snap.f & F_GOLEM);
    this.reviving = !!(snap.f & F_REVIVE);
    this.weaponId = snap.w;
    // new shots since the last snapshot → muzzle flash, tracer, sound on my screen
    if (this.shotSeq >= 0 && snap.seq > this.shotSeq) this.game.net?.playRemoteShots(this, Math.min(4, snap.seq - this.shotSeq), snap.t);
    this.shotSeq = snap.seq;
    if (!this.model.group.visible) {
      this.model.group.visible = true;
      this.position.set(snap.x, snap.y, snap.z);
    }
  }

  /** position at (now - delay) by blending the two snapshots around it */
  sample() {
    const b = this.buf;
    if (!b.length) return null;
    const rt = serverNow() - INTERP_DELAY;
    if (rt <= b[0].ts) return b[0];
    for (let i = 0; i < b.length - 1; i++) {
      const a = b[i], c = b[i + 1];
      if (rt >= a.ts && rt <= c.ts) {
        const u = (rt - a.ts) / Math.max(1, c.ts - a.ts);
        return { x: a.x + (c.x - a.x) * u, y: a.y + (c.y - a.y) * u, z: a.z + (c.z - a.z) * u, yaw: lerpAngle(a.yaw, c.yaw, u), pitch: a.pitch + (c.pitch - a.pitch) * u, f: u < 0.5 ? a.f : c.f };
      }
    }
    // newer than everything we have: extrapolate a little from the last two
    const c = b[b.length - 1], a = b[b.length - 2] || c;
    const over = Math.min(MAX_EXTRAP, rt - c.ts), span = Math.max(1, c.ts - a.ts);
    const u = a === c ? 0 : over / span;
    return { x: c.x + (c.x - a.x) * u, y: c.y + (c.y - a.y) * u, z: c.z + (c.z - a.z) * u, yaw: c.yaw, pitch: c.pitch, f: c.f };
  }

  /* --- called by the local weapon / skill code --- */
  applyDamage(dmg, info = {}) {
    if (!this.alive || !this.enemy) return { killed: false };
    if (this.shield) { this.game.hud.msg('흡수됨', 0.4); return { killed: false }; }
    this.predHp -= dmg;
    this._hitAt = performance.now();
    this.flashT = 0.1;
    this.game.net?.sendHit(this.uid, dmg, info);
    return { killed: this.predHp <= 0 };
  }

  applyEffect(type, dur) { if (this.enemy) this.game.net?.sendEffect(this.uid, type, dur); }
  alert() {}

  update(dt) {
    const g = this.model.group;
    const s = this.sample();
    if (s) {
      const prev = this.position.clone();
      this.position.set(s.x, s.y, s.z);
      const hs = dt > 0 ? Math.hypot(this.position.x - prev.x, this.position.z - prev.z) / dt : 0;
      this.vel.set((this.position.x - prev.x) / Math.max(dt, 1e-3), 0, (this.position.z - prev.z) / Math.max(dt, 1e-3));
      this.yaw = s.yaw;
      this.pitch = s.pitch;
      this.crouch = damp(this.crouch, (s.f & F_SLIDE) ? 1 : (s.f & F_CROUCH) ? 0.6 : 0, 12, dt);
      this.sliding = !!(s.f & F_SLIDE);
      this.sprinting = !!(s.f & F_SPRINT);
      this.onGround = !!(s.f & F_GROUND);
      this.moving = hs > 0.8;
      const ph0 = this.walkPhase;
      this.walkPhase += dt * Math.min(hs, 9) * 2.2;
    if (this.moving && this.onGround && this.alive && Math.floor(this.walkPhase / Math.PI) !== Math.floor(ph0 / Math.PI)) {
      const cam = this.game.camera.position, d = cam.distanceTo(this.position);
      if (d < 32) audio.step(this.game.world.surfaceAt(this.position.x, this.position.z, this.position.y), d, this.crouch > 0.3 ? 0.3 : this.sprinting ? 1.1 : 0.8);
    }
      const sw = Math.sin(this.walkPhase) * Math.min(1, hs / 3) * 0.6;
      this.model.legs[0].rotation.x = sw;
      this.model.legs[1].rotation.x = -sw;
      this.model.knees[0].rotation.x = -Math.max(0, -sw) * 1.1 - this.crouch * 0.9;
      this.model.knees[1].rotation.x = -Math.max(0, sw) * 1.1 - this.crouch * 0.9;
    }
    g.position.copy(this.position);
    this.model.joints.hips.position.y = 0.98 - this.crouch * 0.4;
    this.model.joints.neck.rotation.x = -this.pitch * 0.6;
    const melee = this.weaponId === 'knife' || this.weaponId === 'grenade';
    this.model.gun.visible = !melee;
    // death: fall over; back on the feet when the owner respawns
    if (!this.alive) {
      this.deathT += dt;
      g.rotation.set(damp(g.rotation.x, Math.PI / 2 * 0.95, 9, dt), this.yaw, 0);
    } else {
      g.rotation.set(damp(g.rotation.x, 0, 12, dt), this.yaw, 0);
    }
    this.bubble.visible = !!this.shield && this.alive;
    // Titan golem: bigger, stone-coloured with glowing cracks
    if (this.golem !== this._golemShown) {
      this._golemShown = this.golem;
      const b = this.model.materials.body;
      if (!this._bodyBase) this._bodyBase = b.color.clone();
      b.color.copy(this.golem ? new THREE.Color('#7a7068') : this._bodyBase);
      b.emissive.set(this.golem ? '#ff5a10' : '#000000');
      b.emissiveIntensity = this.golem ? 0.25 : 1;
      this.model.group.scale.setScalar(this.golem ? 1.35 : 1);
      this.game.effects.burst(this.position.clone().setY(1), { count: 20, color: '#8a7f72', speed: 4, size: 0.08, life: 0.7 });
    }
    if (this.bubble.visible) this.bubble.material.opacity = 0.2 + Math.sin(performance.now() * 0.01) * 0.06;
    // stealth: almost invisible (only a faint shimmer)
    const op = this.invisible ? 0.07 : 1;
    if (op !== this._op) {
      this._op = op;
      for (const m of this._mats) { m.transparent = op < 1; m.opacity = op; m.needsUpdate = true; }
      this.tag.visible = op === 1 && !this.enemy;
    }
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.model.materials.body.emissive?.set(this.flashT > 0 ? '#ff2a2a' : '#000000');
    }
    // no data for a while → hide
    if (performance.now() - this.lastData > 4000) g.visible = false;
    else if (this.buf.length) g.visible = true;
  }

  muzzleWorld() { return this.model.muzzle.getWorldPosition(new THREE.Vector3()); }

  dispose() {
    this.game.scene.remove(this.model.group);
    this.model.group.traverse((o) => o.isMesh && o.geometry.dispose());
  }
}
