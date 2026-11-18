import * as THREE from 'three';
import { audio } from '../audio.js';
import { makeNote } from './weapons.js';
import { CHARACTERS, getCharacter } from '../data/characters.js';
import { isXmasSkin } from '../data/charSkins.js';
import { starGeo } from './soldier.js';

const iceWallMat = new THREE.MeshStandardMaterial({
  color: '#bfe9ff', emissive: '#2a8fd8', emissiveIntensity: 0.45, roughness: 0.08, metalness: 0.1,
  transparent: true, opacity: 0.82, flatShading: true,
});
const ray = new THREE.Raycaster();

/* frost field ground decal: snowflake rune inside a ring */
let frostTex = null;
function frostDecal() {
  if (frostTex) return frostTex;
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(180,240,255,.55)'); grd.addColorStop(0.7, 'rgba(80,180,255,.25)'); grd.addColorStop(1, 'rgba(80,180,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  g.translate(S / 2, S / 2);
  g.strokeStyle = '#e8fbff'; g.shadowColor = '#6fd8ff'; g.shadowBlur = 10; g.lineCap = 'round';
  g.lineWidth = 4;
  g.beginPath(); g.arc(0, 0, S * 0.44, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2;
  g.beginPath(); g.arc(0, 0, S * 0.38, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 6; i++) { // snowflake arms with branches
    g.save(); g.rotate((i / 6) * Math.PI * 2);
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -S * 0.34); g.stroke();
    g.lineWidth = 3;
    for (const k of [0.14, 0.22, 0.29]) {
      const y = -S * k, l = S * (0.36 - k) * 0.55;
      g.beginPath(); g.moveTo(0, y); g.lineTo(-l, y - l); g.moveTo(0, y); g.lineTo(l, y - l); g.stroke();
    }
    g.restore();
  }
  frostTex = new THREE.CanvasTexture(c);
  frostTex.colorSpace = THREE.SRGBColorSpace;
  return frostTex;
}

/* soft cloud sprite (steam) and splattered ink decal */
let steamTex = null, inkTex = null;
function steamTexture() {
  if (steamTex) return steamTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 9; i++) {
    const x = 34 + Math.random() * 60, y = 34 + Math.random() * 60, r = 22 + Math.random() * 26;
    const grd = g.createRadialGradient(x, y, 2, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  }
  steamTex = new THREE.CanvasTexture(c);
  return steamTex;
}
function inkTexture() {
  if (inkTex) return inkTex;
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.translate(S / 2, S / 2);
  const blob = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28, d = Math.random() * S * 0.3; blob(Math.cos(a) * d, Math.sin(a) * d, 18 + Math.random() * 30, 'rgba(52,36,210,.92)'); }
  for (let i = 0; i < 18; i++) { const a = Math.random() * 6.28, d = S * (0.3 + Math.random() * 0.16); blob(Math.cos(a) * d, Math.sin(a) * d, 4 + Math.random() * 9, 'rgba(52,36,210,.9)'); }
  for (let i = 0; i < 10; i++) { const a = Math.random() * 6.28, d = Math.random() * S * 0.25; blob(Math.cos(a) * d, Math.sin(a) * d, 6 + Math.random() * 10, 'rgba(32,208,255,.55)'); }
  inkTex = new THREE.CanvasTexture(c);
  inkTex.colorSpace = THREE.SRGBColorSpace;
  return inkTex;
}

/** Character Q/E abilities. Methods are named `${characterId}_${key}`. Return false = not used (no cooldown). */
export class SkillSystem {
  constructor(game) {
    this.game = game;
    this.char = game.character;
    this.cd = { q: 0, e: 0 };
    this.overheatT = 0;
    this.invisT = 0;
    this.marker = null;
    this.walls = [];
    this.zones = [];
    this.projectiles = [];
    this.orbs = [];
    this.charging = null; // { key, t } while a hold-to-cast skill is held
    this.souls = 0;       // Ghost: kills banked for Q
    this.glitchStacks = 0; // Glitch: kills banked for E (max 3)
    this.laser = null;    // Glitch: active Q laser
    this.echoBuffT = 0;   // Echo: weapon damage x1.5
    this.trail = null;    // Nitro: fire trail while dashing
    this.golemT = 0;      // Titan: stone golem (damage x1.6)
    this.titanStacks = 0; // Titan: +20 max HP per Q (max 3)
    this.bloomTree = null; // Bloom: planted life tree (revive point)
    this.bloomDmgT = 0;    // Bloom seed: weapon damage x1.5
    this.remoteTrees = {}; // Bloom trees planted by other players (visual only)
    this.stolen = null;    // Crick E: { char, t, cd } skills taken from an enemy
    this.bikeT = 0;        // Biker E: riding
    this.bikeHits = new Map();
  }

  /** the character whose Q/E I am using right now (Crick: the stolen one) */
  get activeChar() { return this.stolen?.char || this.char; }
  get curCd() { return this.stolen ? this.stolen.cd : this.cd; }

  /** key released: fire a held skill (Frost E) */
  release(key) {
    const ch = this.charging;
    if (!ch || ch.key !== key) return;
    this.charging = null;
    this.game.weapons.endCast();
    this.game.weapons.endLeftCast();
    if (!this.p.alive || this.game.paused) return;
    if (ch.t < 0.25) { this.game.hud.msg('조금 더 길게 눌러 구체를 모으세요', 1.2); return; }
    ch.power = Math.min(1, Math.max(0, (ch.t - 0.25) / 1.75)); // 0 = 35 dmg, 1 (2 s) = 100 dmg
    const ac = ch.char || this.activeChar;
    this[`${ac.id}_${key}_release`]?.(ch);
    (this.stolen && this.stolen.char === ac ? this.stolen.cd : this.cd)[key] = ac[key].cd;
    this.game.hud.skillFlash(key);
  }

  cancelCharge() {
    if (this.laser) this.endLaser();
    if (!this.charging) return;
    this.charging = null;
    this.game.weapons.endCast();
    this.game.weapons.endLeftCast();
  }

  fireRateMul() { return this.overheatT > 0 ? 1.6 : 1; }
  reloadMul() { return this.overheatT > 0 ? 1.4 : 1; }
  isInvisible() { return this.invisT > 0; }
  onPlayerShot() { if (this.invisT > 0) this.endInvis(); }

  use(key) {
    const game = this.game;
    if (!game.player.alive) return;
    if (this.p.silenceT > 0) { game.hud.msg(`스킬 봉인됨 — ${Math.ceil(this.p.silenceT)}초`, 0.8); return; }
    // Biker: E again while riding = get off early
    if (key === 'e' && this.bikeT > 0 && this.activeChar.id === 'biker') { this.endBike(); return; }
    const ac = this.activeChar, def = ac[key], cds = this.curCd;
    if (cds[key] > 0) { game.hud.msg(`${def.name} 재사용 대기 ${Math.ceil(cds[key])}초`); return; }
    const used = this[`${ac.id}_${key}`]?.();
    if (this.charging && !this.charging.char) this.charging.char = ac;
    if (used !== false) {
      (this.stolen && this.stolen.char === ac ? this.stolen.cd : this.cd)[key] = def.cd;
      game.hud.skillFlash(key);
      if (this.myXmas) game.effects.xmasSparkle(this.p.position.clone().addScaledVector(this.flatForward(), 1.8).setY(this.p.position.y - 0.6));
    }
  }

  /** hit by Crick Q (or my skills were stolen): no skills for a while, running ones stop */
  silence(secs) {
    this.p.silenceT = Math.max(this.p.silenceT, secs);
    this.cancelCharge();
    if (this.invisT > 0) this.endInvis();
    if (this.golemT > 0) this.endGolem();
    if (this.bikeT > 0) this.endBike();
    if (this.p.shieldT > 0) { this.p.shieldT = 0; this.game.weapons.endCast(); }
    this.game.hud.msg(`스킬 봉인! ${Math.round(secs)}초간 스킬 사용 불가`, 1.6);
    this.game.hud.flashTint('rgba(160,90,255,.35)');
    audio.skill('glitch');
  }

  /** enemy under the crosshair (or the closest one in a narrow cone in front) */
  aimEnemy(range = 40) {
    const game = this.game, cam = game.camera, dir = this.forward();
    ray.set(cam.position, dir);
    ray.far = range;
    const hit = ray.intersectObjects(game.world.solids.concat(game.enemyMeshes()), false)[0];
    let e = hit?.object.userData.enemy;
    if (!e || !e.alive) {
      e = null;
      let best = 0.94;
      for (const b of this.enemies()) {
        const to = this.chest(b).sub(cam.position);
        const d = to.length();
        if (d > 25) continue;
        const dot = to.normalize().dot(dir);
        if (dot > best) { best = dot; e = b; }
      }
    }
    const end = e ? this.chest(e) : hit ? hit.point : cam.position.clone().addScaledVector(dir, range);
    return { e, end };
  }

  /* ================= 크릭 ================= */
  crick_q() {
    const { e, end } = this.aimEnemy();
    const from = this.game.weapons.muzzleWorld();
    this.fx.lightning(from, end, '#b47bff', 0.03);
    this.game.net?.fx({ k: 'zap', a: { x: from.x, y: from.y, z: from.z }, b: { x: end.x, y: end.y, z: end.z }, c: '#b47bff' });
    audio.skill('glitch');
    if (!e) { this.game.hud.msg('빗나감', 1); this.cd.q = 1.5; return false; }
    e.applyEffect('silence', 10);
    this.fx.burst(end, { count: 26, color: '#b47bff', speed: 5, size: 0.05, gravity: 0, life: 0.7 });
    this.fx.ring?.(e.position.clone().setY(0.1), '#b47bff', 1.6, 0.6, 0.1);
    this.game.hud.msg(`${e.name || '적'} — 10초간 스킬 봉인`, 1.6);
    this.game.hud.hitmarker('head');
  }

  crick_e() {
    const { e, end } = this.aimEnemy();
    const from = this.game.weapons.muzzleWorld();
    this.fx.lightning(end, from, '#d9ff5a', 0.03);
    this.game.net?.fx({ k: 'zap', a: { x: end.x, y: end.y, z: end.z }, b: { x: from.x, y: from.y, z: from.z }, c: '#d9ff5a' });
    if (!e) { this.game.hud.msg('빗나감', 1); this.cd.e = 1.5; return false; }
    let cid = e.isRemote ? e.profile?.char : e.charId;
    if (!cid) { // AI without a character: a random one
      const pool = CHARACTERS.filter((c) => c.id !== 'crick');
      cid = e.charId = pool[Math.floor(Math.random() * pool.length)].id;
    }
    if (cid === 'crick') { this.game.hud.msg('크릭의 스킬은 빼앗을 수 없습니다', 1.4); this.cd.e = 1.5; return false; }
    const c = getCharacter(cid);
    this.cancelCharge();
    this.stolen = { char: c, t: 10, cd: { q: 0, e: 0 } };
    e.applyEffect('silence', 10);
    this.fx.burst(this.p.position.clone().setY(1.2), { count: 30, color: '#d9ff5a', speed: 4, size: 0.05, gravity: 0, life: 0.8 });
    this.game.hud.flashTint('rgba(200,255,90,.3)');
    this.game.hud.onSkillsChange?.();
    audio.skill('absorb');
    this.game.hud.msg(`${c.name}의 스킬을 빼앗았다! 10초 — Q ${c.q.name} · E ${c.e.name}`, 2.2);
  }

  endSteal() {
    if (!this.stolen) return;
    this.cancelCharge();
    if (this.bikeT > 0) this.endBike();
    if (this.golemT > 0) this.endGolem();
    this.stolen = null;
    this.game.hud.onSkillsChange?.();
    this.game.hud.msg('빼앗은 스킬이 사라졌습니다', 1.2);
  }

  /* ================= 바이커 ================= */
  biker_q() {
    const { e, end } = this.aimEnemy(25);
    const from = this.game.weapons.muzzleWorld();
    this.fx.chain?.(from, end);
    this.game.net?.fx({ k: 'chain', a: { x: from.x, y: from.y, z: from.z }, b: { x: end.x, y: end.y, z: end.z } });
    audio.skill('rock');
    if (!e || e.position.distanceTo(this.p.position) > 26) { this.game.hud.msg('체인이 빗나갔습니다', 1); this.cd.q = 2; return false; }
    e.applyEffect('root', 2.5);
    this.fx.ring?.(e.position.clone().setY(0.1), '#c8ccd2', 1.2, 0.6, 0.1);
    this.game.hud.msg(`${e.name || '적'} 묶음! 2.5초`, 1.3);
    this.game.hud.hitmarker('hit');
  }

  biker_e() {
    this.cancelCharge();
    this.bikeT = 10;
    this.bikeHits.clear();
    this.fx.puff(this.p.position.clone().setY(0.4), '#d8d8d8', 2, 0.5, 0.6);
    audio.skill('dash');
    this.game.hud.msg('자전거! 10초 — 부딪히면 50 피해 · E로 내리기', 1.8);
  }

  endBike() {
    if (this.bikeT <= 0) return;
    this.bikeT = 0;
    this.game.weapons.drawT = 0;
    this.fx.puff(this.p.position.clone().setY(0.4), '#d8d8d8', 1.6, 0.5, 0.5);
    audio.swap();
  }

  updateBike(dt) {
    if (this.bikeT <= 0) return;
    this.bikeT -= dt;
    if (this.bikeT <= 0 || !this.p.alive) { this.bikeT = 0.001; this.endBike(); return; }
    const p = this.p, sp = Math.hypot(p.vel.x, p.vel.z);
    if (sp < 4) return;
    for (const b of this.enemies()) {
      const dx = b.position.x - p.position.x, dz = b.position.z - p.position.z;
      if (dx * dx + dz * dz > 1.3 * 1.3 || Math.abs(b.position.y - p.position.y) > 1.5) continue;
      const last = this.bikeHits.get(b) || -9;
      if (this.clock - last < 0.8) continue;
      this.bikeHits.set(b, this.clock);
      this.damage(b, 50, '자전거');
      const k = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(9);
      if (!b.isRemote) b.knock = k;
      this.fx.burst(b.position.clone().setY(1), { count: 16, color: '#ffd36b', speed: 5, size: 0.05, life: 0.4 });
      this.game.hud.flashTint('rgba(255,200,90,.2)');
      p.addRecoil(0.03, 0);
      audio.skill('boom', 0);
    }
  }

  /* ---------- helpers ---------- */
  get p() { return this.game.player; }
  get fx() {
    const fx = this.game.effects;
    const xmas = this.fxCtx ? this.fxCtx.xmas : this.myXmas;
    if (!xmas) return fx;
    // Christmas skin: every effect spawned through this.fx gets the red / green / gold palette
    return this._xfx ||= new Proxy(fx, {
      get: (t, k) => {
        const v = t[k];
        return typeof v === 'function' ? (...a) => { const o = t.palette; t.palette = 'xmas'; try { return v.apply(t, a); } finally { t.palette = o; } } : v;
      },
    });
  }
  /** am I wearing a Christmas skin? */
  get myXmas() { return isXmasSkin(this.game.weapons?.charSkin?.id); }
  enemies() { return this.game.hostiles(); }
  forward() { return new THREE.Vector3(0, 0, -1).applyQuaternion(this.game.camera.quaternion); }
  flatForward() { return new THREE.Vector3(-Math.sin(this.p.yaw), 0, -Math.cos(this.p.yaw)); }
  chest(b) { return b.position.clone().setY(b.position.y + 1.3); }

  damage(bot, dmg, weapon) {
    if (!bot.alive) return;
    if (this.p.weakT > 0) dmg = 1;
    const res = bot.applyDamage(dmg, { weapon, from: 'player' });
    const hud = this.game.hud;
    hud.damageNumber(this.chest(bot).setY(bot.position.y + 1.9), Math.round(dmg), false);
    hud.hitmarker(res.killed ? 'kill' : 'hit');
    if (res.killed) audio.kill();
  }

  /* ================= 루키 ================= */
  rookie_q() {
    if (this.p.hp >= this.p.maxHp) { this.game.hud.msg('체력이 이미 가득 찼습니다'); return false; }
    this.p.heal(60);
    this.game.hud.flashTint('rgba(80,255,150,.35)');
    this.fx.burst(this.p.position.clone().setY(1), { count: 14, color: '#6dffa8', speed: 3, size: 0.05, gravity: -2, life: 0.9 });
    audio.skill('heal');
  }

  rookie_e() {
    this.p.dash(24, 0.2);
    this.fx.puff(this.p.position.clone().setY(0.4), '#e8f6ff', 2, 0.5, 0.6);
    this.game.hud.flashTint('rgba(200,230,255,.2)');
    audio.skill('dash');
  }

  /* ================= 프로스트 ================= */
  frost_q() {
    const f = this.flatForward();
    const pos = this.p.position.clone().addScaledVector(f, 4);
    // snap orientation to an axis so the AABB collider matches the visual
    this.buildIceWall(pos, Math.abs(f.z) > Math.abs(f.x));
  }

  buildIceWall(pos, alongX, visual = false) {
    const world = this.game.world;
    if (!visual) this.game.net?.fx({ k: 'wall', x: pos.x, y: pos.y, z: pos.z, ax: alongX });
    const w = alongX ? 4.6 : 0.8, d = alongX ? 0.8 : 4.6, h = 3;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 3, 2, 3), iceWallMat);
    const pa = mesh.geometry.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      if (pa.getY(i) > 0) pa.setX(i, pa.getX(i) + (Math.random() - 0.5) * 0.25);
    }
    mesh.geometry.computeVertexNormals();
    mesh.position.set(pos.x, pos.y + h / 2, pos.z);
    mesh.castShadow = true;
    mesh.scale.y = 0.05;
    this.game.scene.add(mesh);
    const box = new THREE.Box3(new THREE.Vector3(pos.x - w / 2, pos.y, pos.z - d / 2), new THREE.Vector3(pos.x + w / 2, pos.y + h, pos.z + d / 2));
    world.colliders.push(box);
    world.solids.push(mesh);
    world.cover.push(mesh);
    this.walls.push({ mesh, box, t: 10, grow: 0 });
    this.fx.burst(pos.clone().setY(0.3), { count: 16, color: 'ice', speed: 5, size: 0.08 });
    audio.skill('ice', this.p.position.distanceTo(pos));
  }

  /* 프로스트 렌지: hold E = lower the gun and gather an ice orb in the hand; release = fire it */
  frost_e() {
    if (this.charging) return false;
    this.charging = { key: 'e', t: 0 };
    this.game.weapons.startCast('frost');
    audio.skill('charge');
    return false; // cooldown starts on release
  }

  frost_e_release(ch) {
    const power = ch.power;
    const mesh = new THREE.Group();
    mesh.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshBasicMaterial({ color: '#e8fbff' })));
    mesh.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 1),
      new THREE.MeshBasicMaterial({ color: '#5fd0ff', wireframe: true, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })));
    mesh.add(this.fx.glowSprite('#6fd8ff', 1.3));
    mesh.scale.setScalar(0.65 + 0.6 * power);
    this.launchOrb(mesh, 55, { color: '#bff4ff', smoke: '#cfefff', onHit: (at) => { at.y = this.floorBelow(at); this.createFrostZone(at, power); } });
    audio.skill('orb');
    this.onPlayerShot();
  }

  updateOrbs(dt) {
    const game = this.game;
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      if (o.gravity) o.vel.y -= o.gravity * dt;
      const prev = o.mesh.position.clone();
      const step = o.vel.clone().multiplyScalar(dt);
      const len = step.length();
      ray.set(prev, step.clone().normalize());
      ray.far = len + 0.2;
      const hit = ray.intersectObjects(game.world.solids.concat(game.enemyMeshes()), false)[0];
      o.mesh.position.add(step);
      o.dist += len;
      const shell = o.mesh.children[1];
      if (shell && !o.spinNote) { shell.rotation.x += dt * 8; shell.rotation.y += dt * 6; }
      if (o.spinNote) o.mesh.rotation.z += dt * 6;
      this.fx.burst(prev, { count: 2, color: o.color, speed: 0.6, size: 0.05, gravity: 0, life: 0.45 });
      if (o.smoke && Math.random() < 0.5) this.fx.puff(prev, o.smoke, 0.25, 0.3, 0.4);
      let at = null, enemy = null;
      if (hit) {
        enemy = hit.object.userData.enemy || null;
        if (enemy) at = o.spinNote ? hit.point.clone() : enemy.position.clone().setY(enemy.position.y + 0.3);
        else {
          const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
          at = hit.point.clone().addScaledVector(n, 0.3);
        }
      } else if (o.mesh.position.y <= 0.05) at = o.mesh.position.clone().setY(0);
      else if (o.dist > (o.range || 90)) at = o.mesh.position.clone();
      if (!at) continue;
      game.scene.remove(o.mesh);
      o.mesh.traverse((c) => c.isMesh && c.geometry.dispose());
      this.orbs.splice(i, 1);
      o.onHit(at, enemy);
    }
  }

  /** height of the floor (ground or top of a box) under a point */
  floorBelow(p) {
    let y = 0;
    for (const b of this.game.world.colliders) {
      if (p.x > b.min.x && p.x < b.max.x && p.z > b.min.z && p.z < b.max.z && b.max.y <= p.y + 0.6 && b.max.y > y) y = b.max.y;
    }
    return y;
  }

  createFrostZone(pos, power = 1, visual = false) {
    if (!visual) this.game.net?.fx({ k: 'frost', x: pos.x, y: pos.y, z: pos.z, p: power });
    const group = new THREE.Group();
    group.position.copy(pos);
    const R = 4;
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(R * 2.1, R * 2.1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: frostDecal(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    decal.position.y = 0.04;
    const ring = new THREE.Mesh(new THREE.RingGeometry(R - 0.15, R, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#8fe4ff', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.position.y = 0.05;
    group.add(decal, ring);
    // ice crystal shards sprouting from the ground
    const shards = [];
    for (let i = 0, n = Math.round(8 + 8 * power); i < n; i++) {
      const h = (0.4 + Math.random() * 1.1) * (0.7 + 0.3 * power);
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.12 + Math.random() * 0.12, h, 5), iceWallMat);
      const a = Math.random() * Math.PI * 2, r = 0.6 + Math.sqrt(Math.random()) * (R - 0.8);
      m.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
      m.rotation.set((Math.random() - 0.5) * 0.6, Math.random() * 3, (Math.random() - 0.5) * 0.6);
      m.userData.h = h;
      m.scale.setScalar(0.01);
      group.add(m);
      shards.push(m);
    }
    const glows = [];
    for (let i = 0; i < 8; i++) {
      const sp = this.fx.glowSprite(i % 2 ? '#bff4ff' : '#4fb8ff', 1.2);
      const a = (i / 8) * Math.PI * 2;
      sp.position.set(Math.cos(a) * R * 0.55, 0.4, Math.sin(a) * R * 0.55);
      sp.userData.ph = Math.random() * 6;
      group.add(sp);
      glows.push(sp);
    }
    const light = new THREE.PointLight('#6fd8ff', 10, 14, 1.5);
    light.position.y = 1.2;
    group.add(light);
    this.game.scene.add(group);
    this.fx.explosion(pos.clone().setY(pos.y + 0.5), '#9fe7ff', 4);
    this.fx.burst(pos.clone().setY(pos.y + 0.3), { count: 30, color: 'ice', speed: 7, size: 0.09 });
    this.fx.ring?.(pos.clone().setY(pos.y + 0.06), '#8fe4ff', R, 0.5, 0.1);
    const d = this.p.position.distanceTo(pos);
    audio.skill('ice', d);
    audio.skill('boom', d + 10);
    // 20 ticks over 5 seconds; total 35 (tap) .. 100 (fully charged)
    const total = 35 + 65 * power;
    this.zones.push({ kind: 'frost', visual, dmg: total / 20, group, ring, decal, shards, glows, light, pos: pos.clone(), radius: R, t: 5, tick: 0, ticks: 20, age: 0 });
  }

  updateFrostZone(z, dt) {
    z.age += dt;
    const fade = Math.min(1, z.t / 0.6);
    const grow = Math.min(1, z.age / 0.25);
    for (const s of z.shards) s.scale.setScalar(Math.max(0.01, (1 - Math.pow(1 - grow, 3)) * (z.t < 0.6 ? fade : 1)));
    z.ring.rotation.y += dt * 0.6;
    z.decal.rotation.y -= dt * 0.25;
    z.ring.material.opacity = 0.9 * fade;
    z.decal.material.opacity = (0.85 + Math.sin(z.age * 5) * 0.15) * fade;
    for (const g of z.glows) { g.userData.ph += dt * 3; g.material.opacity = (0.5 + Math.sin(g.userData.ph) * 0.3) * fade; }
    z.light.intensity = (8 + Math.sin(z.age * 7) * 2) * fade;
    if (Math.random() < 0.6) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * z.radius;
      this.fx.burst(z.pos.clone().add(new THREE.Vector3(Math.cos(a) * r, 0.2, Math.sin(a) * r)),
        { count: 1, color: '#dff7ff', speed: 0.5, size: 0.05, gravity: -1.5, life: 1.2 });
    }
    z.tick -= dt;
    while (z.tick <= 0 && z.ticks > 0 && !z.visual) {
      z.tick += 0.25;
      z.ticks--;
      for (const b of this.enemies()) {
        const dx = b.position.x - z.pos.x, dz = b.position.z - z.pos.z;
        if (dx * dx + dz * dz < z.radius * z.radius && Math.abs(b.position.y - z.pos.y) < 2.5) {
          b.applyEffect('slow', 0.6);
          this.damage(b, z.dmg, '프로스트 렌지');
        }
      }
    }
  }

  /* ================= 블레이즈 ================= */
  blaze_q() {
    this.throwProjectile({
      color: '#ff8a3a', speed: 17, bounce: false, fuse: 4,
      onExplode: (pos) => {
        pos.y = Math.max(0, pos.y - 0.1);
        this.fx.explosion(pos, '#ff8a3a', 3.5);
        this.game.net?.fx({ k: 'boom', x: pos.x, y: pos.y, z: pos.z, c: '#ff8a3a', s: 3.5 });
        audio.skill('fire', this.p.position.distanceTo(pos));
        this.createFireZone(pos);
      },
    });
  }

  blaze_e() {
    this.overheatT = 6;
    audio.skill('buff');
    this.game.hud.msg('과열! 연사속도 +60%');
  }

  createFireZone(pos, { radius = 3.6, t = 5, dps = 35, count = 14, light = true, name = '화염병', spread = 3.2, visual = false } = {}) {
    if (!visual) this.game.net?.fx({ k: 'fire', x: pos.x, y: pos.y, z: pos.z, o: { radius, t, dps, count, light, name, spread } });
    const group = new THREE.Group();
    group.position.copy(pos);
    const flames = [];
    for (let i = 0; i < count; i++) {
      const sp = this.fx.glowSprite(i % 3 ? '#ff7a2a' : '#ffd25a', 1);
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
      sp.position.set(Math.cos(a) * r, 0.4, Math.sin(a) * r);
      sp.userData.ph = Math.random() * 10;
      group.add(sp);
      flames.push(sp);
    }
    let pl = null;
    if (light) {
      pl = new THREE.PointLight('#ff7a2a', 8, 12, 1.5);
      pl.position.y = 1;
      group.add(pl);
    }
    this.game.scene.add(group);
    this.zones.push({ group, flames, light: pl, pos: pos.clone(), radius, t, tick: 0, dps, name, spread, small: !light, visual });
  }

  /* ================= 섀도우 ================= */
  shadow_q() {
    this.invisT = 4;
    this.game.weapons.setGhost(true);
    for (const b of this.enemies()) if (b.state === 'hunt') { b.canSee = false; b.alertT = 1.5; }
    audio.skill('stealth');
    this.game.hud.msg('은신 — 사격하면 해제됩니다');
  }

  endInvis() {
    this.invisT = 0;
    this.game.weapons.setGhost(false);
  }

  shadow_e() {
    if (!this.marker) {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.8, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: '#a77dff', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
      ring.position.y = 0.05;
      const beam = this.fx.glowSprite('#8a5cff', 1);
      beam.scale.set(0.6, 4, 1);
      beam.position.y = 2;
      g.add(ring, beam);
      g.position.copy(this.p.position);
      this.game.scene.add(g);
      this.marker = { group: g, t: 20 };
      audio.skill('teleport');
      this.game.hud.msg('그림자 표식 설치 — E를 다시 눌러 순간이동');
      this.cd.e = 0.4;
      return false;
    }
    const from = this.p.position.clone();
    this.fx.puff(from.clone().setY(1), '#8a5cff', 3, 0.6, 0.8);
    this.p.position.copy(this.marker.group.position);
    this.p.vel.set(0, 0, 0);
    this.fx.puff(this.p.position.clone().setY(1), '#8a5cff', 3, 0.6, 0.8);
    this.fx.burst(this.p.position.clone().setY(1), { count: 16, color: '#a77dff', speed: 4, size: 0.05, gravity: -1 });
    this.removeMarker();
    this.game.hud.flashTint('rgba(120,60,255,.35)');
    audio.skill('teleport');
  }

  removeMarker() {
    if (!this.marker) return;
    this.game.scene.remove(this.marker.group);
    this.marker = null;
  }

  /* ================= 니트로 ================= */
  nitro_q() {
    this.p.dash(26, 0.35);
    this.trail = { t: 0.42, last: this.p.position.clone() };
    this.fireAt(this.p.position.clone());
    this.fx.puff(this.p.position.clone().setY(0.4), '#ff9a3a', 2.2, 0.5, 0.6);
    this.game.hud.flashTint('rgba(255,140,40,.25)');
    audio.skill('dash');
    audio.skill('fire');
  }

  fireAt(pos) {
    pos.y = this.floorBelow(pos.clone().setY(pos.y + 0.5));
    this.createFireZone(pos, { radius: 1.4, t: 3, dps: 30, count: 4, light: false, name: '니트로 부스트', spread: 1.1 });
  }

  updateTrail(dt) {
    const tr = this.trail;
    if (!tr) return;
    tr.t -= dt;
    const pos = this.p.position;
    const d = Math.hypot(pos.x - tr.last.x, pos.z - tr.last.z);
    if (d >= (tr.kind === 'ink' ? 1.8 : 0.9)) {
      if (tr.kind === 'ink') this.createInk(pos.clone().setY(this.floorBelow(pos.clone().setY(pos.y + 0.5))), { radius: 3.2, t: 5, boost: 0.4 });
      else this.fireAt(pos.clone());
      tr.last.copy(pos);
    }
    if (Math.random() < 0.8) this.fx.burst(pos.clone().setY(0.3), { count: 2, color: tr.kind === 'ink' ? '#5a4dff' : '#ffb35a', speed: 1.5, size: 0.05, gravity: -3, life: 0.5 });
    if (tr.t <= 0) this.trail = null;
  }

  /* 화염 렌지: hold E = fire orb in the hand; release = throw it (light gravity), explodes on impact */
  nitro_e() {
    if (this.charging) return false;
    this.charging = { key: 'e', t: 0 };
    this.game.weapons.startCast('fire');
    audio.skill('flame');
    return false;
  }

  nitro_e_release(ch) {
    const power = ch.power;
    const mesh = new THREE.Group();
    mesh.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff1b0' })));
    mesh.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 1),
      new THREE.MeshBasicMaterial({ color: '#ff6a1a', wireframe: true, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })));
    mesh.add(this.fx.glowSprite('#ff8a2a', 1.4));
    mesh.scale.setScalar(0.7 + 0.6 * power);
    this.launchOrb(mesh, 40, {
      gravity: 9, lift: 2.5, color: '#ffb35a', smoke: '#5a4a40',
      onHit: (at) => this.fireBlast(at, power),
    });
    audio.skill('firethrow');
  }

  fireBlast(pos, power) {
    const dmgMax = Math.round(35 + 65 * power), R = 4;
    this.fx.explosion(pos.clone().setY(pos.y + 0.5), '#ff8a3a', 3 + power * 2);
    this.game.net?.fx({ k: 'boom', x: pos.x, y: pos.y + 0.5, z: pos.z, c: '#ff8a3a', s: 3 + power * 2 });
    this.fx.burst(pos.clone().setY(pos.y + 0.3), { count: 28, color: '#ffcf7a', speed: 9, size: 0.06, life: 0.7 });
    this.fx.ring?.(pos.clone().setY(pos.y + 0.06), '#ff8a3a', R, 0.5, 0.1);
    const d = this.p.position.distanceTo(pos);
    audio.skill('boom', d);
    audio.skill('fire', d);
    for (const b of this.enemies()) {
      const c = b.position.clone().setY(b.position.y + 1);
      const dist = c.distanceTo(pos);
      if (dist > R) continue;
      b.burnT = 1;
      this.damage(b, Math.round(dmgMax * (1 - 0.4 * (dist / R))), '화염 렌지');
    }
    pos.y = this.floorBelow(pos.clone().setY(pos.y + 0.5));
    this.createFireZone(pos, { radius: 2.4, t: 2, dps: 30, count: 7, light: false, name: '화염 렌지', spread: 2.2 });
  }

  /* ================= 고스트 ================= */
  onKill() {
    if (this.char.id === 'glitch') {
      if (this.glitchStacks < 3) { this.glitchStacks++; this.game.hud.msg(`글리치 스택 ${this.glitchStacks}/3 — E로 사용`, 1.2); }
      return;
    }
    if (this.char.id !== 'ghost') return;
    if (this.souls >= 10) return;
    this.souls++;
    this.game.hud.msg(`영혼 +1 (Q 은신 ${this.souls * 2}초)`, 1.2);
  }

  goInvisible(secs, text) {
    this.invisT = Math.max(this.invisT, secs);
    this.game.weapons.setGhost(true);
    for (const b of this.enemies()) if (b.state === 'hunt') { b.canSee = false; b.alertT = 1.5; }
    this.fx.puff(this.p.position.clone().setY(1), '#cfe8ee', 2.5, 0.6, 0.8);
    this.fx.burst(this.p.position.clone().setY(1), { count: 16, color: '#5ff2e0', speed: 3, size: 0.05, gravity: -1, life: 0.8 });
    audio.skill('ghost');
    this.game.hud.msg(text);
  }

  ghost_q() {
    if (this.souls <= 0) { this.game.hud.msg('처치가 필요합니다 — 적 1명당 은신 2초'); return false; }
    const secs = this.souls * 2;
    this.souls = 0;
    this.goInvisible(secs, `망령 — ${secs}초 은신 (사격 시 해제)`);
  }

  ghost_e() {
    this.goInvisible(2, '유령화 — 2초 투명');
  }

  /* ================= 에코 ================= */
  damageMul() { return (this.echoBuffT > 0 ? 1.5 : 1) * (this.golemT > 0 ? 1.6 : 1) * (this.bloomDmgT > 0 ? 1.5 : 1); }

  echo_q() {
    const ok = this.game.weapons.playEchoInsert(() => {
      this.echoBuffT = 8;
      audio.skill('note');
      this.game.hud.msg('공명! 8초간 무기 피해 1.5배');
    });
    if (!ok) return false;
    audio.skill('pin');
  }

  echo_e() {
    const ok = this.game.weapons.playEchoCombine(() => {
      const mesh = new THREE.Group();
      const note = makeNote(this.fx, '#ff5fb8');
      note.scale.setScalar(7);
      note.position.set(-0.12, -0.2, 0);
      mesh.add(note, this.fx.glowSprite('#ff7ad0', 1.1));
      this.launchOrb(mesh, 60, {
        color: '#ff9fdc', smoke: null, range: 120, spinNote: note,
        onHit: (at, enemy) => {
          this.fx.ring?.(at.clone().setY(at.y + 0.1), '#ff7ad0', 2.2, 0.4, 0.08);
          this.fx.burst(at, { count: 16, color: '#ff9fdc', speed: 4, size: 0.05, gravity: -1, life: 0.6 });
          if (enemy && enemy.alive) this.damage(enemy, 20, '화음탄');
        },
      });
      audio.skill('chord');
      this.onPlayerShot();
    });
    if (!ok) return false;
  }

  /* ---------- straight / lobbed skill orbs (Frost, Nitro, Echo) ---------- */
  launchOrb(mesh, speed, opts) {
    const game = this.game, cam = game.camera;
    const dir = this.forward();
    const from = opts.from || game.weapons.orbWorld();
    ray.set(cam.position, dir);
    ray.far = 90;
    const aimHit = ray.intersectObjects(game.world.solids.concat(game.enemyMeshes()), false)[0];
    const target = aimHit ? aimHit.point : cam.position.clone().addScaledVector(dir, 90);
    const vel = target.clone().sub(from).normalize().multiplyScalar(speed);
    if (opts.lift) vel.y += opts.lift;
    mesh.position.copy(from);
    game.scene.add(mesh);
    this.orbs.push({ mesh, vel, dist: 0, ...opts });
  }

  /* ================= 글리치 ================= */
  /** Q: gather glitch energy in the right hand (0.5 s), then a 3 s laser — 20 damage per second */
  glitch_q() {
    if (this.laser) return false;
    this.game.weapons.startCast('glitch');
    this.laser = { t: -0.5, tick: 0, send: 0, beam: null };
    audio.skill('glitch');
  }

  makeBeam() {
    const g = new THREE.Group();
    const geo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
    const core = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#b8ffd9', transparent: true, opacity: 0.9, depthWrite: false }));
    const glow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#39ff9e', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const outer = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#8a3dff', transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    core.userData.r = 0.016; glow.userData.r = 0.045; outer.userData.r = 0.09;
    g.add(core, glow, outer);
    const hitGlow = this.fx.glowSprite('#39ff9e', 1.2);
    g.add(hitGlow);
    g.userData = { parts: [core, glow, outer], hitGlow };
    this.game.scene.add(g);
    return g;
  }

  placeBeam(g, a, b) {
    const len = a.distanceTo(b);
    g.position.copy(a);
    g.lookAt(b);
    for (const m of g.userData.parts) {
      const jit = 1 + (Math.random() - 0.5) * 0.5;
      m.scale.set(m.userData.r * jit, m.userData.r * jit, len);
    }
    g.userData.hitGlow.position.set(0, 0, len);
    g.userData.hitGlow.scale.setScalar(0.8 + Math.random() * 0.6);
    g.children[2].material.color.set(Math.random() < 0.15 ? '#39ff9e' : '#8a3dff'); // glitchy colour flicker
  }

  updateLaser(dt) {
    const L = this.laser;
    if (!L) return;
    const game = this.game;
    if (!this.p.alive) { this.endLaser(); return; }
    L.t += dt;
    if (L.t < 0) return; // still gathering
    if (!L.beam) { L.beam = this.makeBeam(); audio.skill('laser'); }
    const cam = game.camera;
    const from = game.weapons.orbWorld();
    const dir = this.forward();
    ray.set(cam.position, dir);
    ray.far = 80;
    const hit = ray.intersectObjects(game.world.solids.concat(game.enemyMeshes()), false)[0];
    const end = hit ? hit.point : cam.position.clone().addScaledVector(dir, 80);
    this.placeBeam(L.beam, from, end);
    if (Math.random() < 0.6) this.fx.burst(end, { count: 2, color: Math.random() < 0.5 ? '#39ff9e' : '#b47bff', speed: 3, size: 0.04, gravity: 0, life: 0.3 });
    L.tick -= dt;
    while (L.tick <= 0) {
      L.tick += 0.1;
      const enemy = hit?.object.userData.enemy;
      if (enemy && enemy.alive) this.damage(enemy, 2, '글리치 레이저');
    }
    L.send -= dt;
    if (L.send <= 0) {
      L.send = 0.1;
      game.net?.fx({ k: 'laser', id: game.net.uid, a: { x: from.x, y: from.y, z: from.z }, b: { x: end.x, y: end.y, z: end.z } });
    }
    if (L.t >= 3) this.endLaser();
  }

  endLaser() {
    const L = this.laser;
    if (!L) return;
    if (L.beam) { this.game.scene.remove(L.beam); L.beam.children.forEach((m) => m.geometry?.dispose()); }
    this.laser = null;
    this.game.weapons.endCast();
    this.game.net?.fx({ k: 'laser', id: this.game.net.uid, off: true });
  }

  /** the other player's laser, drawn from network updates */
  remoteLaser(d) {
    this.rLasers = this.rLasers || {};
    let r = this.rLasers[d.id];
    if (d.off) { if (r) { this.game.scene.remove(r.beam); delete this.rLasers[d.id]; } return; }
    if (!r) { r = this.rLasers[d.id] = { beam: this.makeBeam(), t: 0 }; audio.skill('laser', this.p.position.distanceTo(new THREE.Vector3(d.a.x, d.a.y, d.a.z))); }
    r.t = 0.4;
    r.a = new THREE.Vector3(d.a.x, d.a.y, d.a.z);
    r.b = new THREE.Vector3(d.b.x, d.b.y, d.b.z);
  }

  updateRemoteLasers(dt) {
    if (!this.rLasers) return;
    for (const [id, r] of Object.entries(this.rLasers)) {
      r.t -= dt;
      if (r.t <= 0) { this.game.scene.remove(r.beam); delete this.rLasers[id]; continue; }
      this.placeBeam(r.beam, r.a, r.b);
    }
  }

  /** E: spend every glitch stack on the enemy under the crosshair (effects stack up with the level) */
  glitch_e() {
    if (this.glitchStacks <= 0) { this.game.hud.msg('처치가 필요합니다 — 적 1명당 글리치 스택 +1'); return false; }
    const game = this.game, cam = game.camera, dir = this.forward();
    ray.set(cam.position, dir);
    ray.far = 120;
    const hit = ray.intersectObjects(game.world.solids.concat(game.enemyMeshes()), false)[0];
    const end = hit ? hit.point : cam.position.clone().addScaledVector(dir, 120);
    const from = game.weapons.muzzleWorld();
    this.fx.lightning(from, end, '#39ff9e', 0.03);
    this.fx.lightning(from, end, '#8a3dff', 0.02);
    game.net?.fx({ k: 'zap', a: { x: from.x, y: from.y, z: from.z }, b: { x: end.x, y: end.y, z: end.z }, c: '#39ff9e' });
    audio.skill('glitch');
    const enemy = hit?.object.userData.enemy;
    if (!enemy || !enemy.alive) {
      this.game.hud.msg('빗나감 — 스택은 유지됩니다', 1.2);
      this.cd.e = 1.5;
      return false;
    }
    const lvl = this.glitchStacks;
    this.glitchStacks = 0;
    enemy.applyEffect('glitch', lvl);
    this.fx.burst(end, { count: 24, color: '#39ff9e', speed: 5, size: 0.05, gravity: 0, life: 0.6 });
    this.fx.burst(end, { count: 16, color: '#b47bff', speed: 4, size: 0.06, gravity: 0, life: 0.6 });
    const names = ['', '감속', '감속 + 피해 1', '감속 + 피해 1 + 시야 가림'];
    this.game.hud.msg(`글리치 ${lvl}단계 — ${names[lvl]}`, 1.6);
    this.game.hud.hitmarker('head');
  }

  /* ================= 인페르노 (인피니티) ================= */
  /** Q: fire orb (right) + water orb (left) pushed together → a steam cloud where you aim that blocks sight */
  inferno_q() {
    const ok = this.game.weapons.playSteamCombine(() => {
      const game = this.game, cam = game.camera, dir = this.forward();
      ray.set(cam.position, dir);
      ray.far = 26;
      const hit = ray.intersectObjects(game.world.solids.concat(game.enemyMeshes()), false)[0];
      const at = hit ? hit.point.clone().addScaledVector(dir, -0.8) : cam.position.clone().addScaledVector(dir, 26);
      at.y = this.floorBelow(at);
      this.createSteam(at);
      audio.skill('steam', this.p.position.distanceTo(at));
    });
    if (!ok) return false;
    audio.skill('flame');
  }

  createSteam(pos, visual = false, opts = {}) {
    if (!visual) this.game.net?.fx({ k: 'steam', x: pos.x, y: pos.y, z: pos.z, o: opts });
    const R = opts.radius || 4.6, group = new THREE.Group();
    const cols = opts.smoke ? ['#8d939a', '#6f757c'] : ['#e9eff5', '#cfd9e3'];
    group.position.copy(pos);
    const puffs = [];
    for (let i = 0; i < 34; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTexture(), color: i % 4 ? cols[0] : cols[1], transparent: true, opacity: 0, depthWrite: false }));
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * R * 0.85;
      sp.position.set(Math.cos(a) * r, 0.4 + Math.random() * 3.4, Math.sin(a) * r);
      const s = 2.6 + Math.random() * 2.6;
      sp.scale.setScalar(s);
      sp.userData = { s, ph: Math.random() * 6, vy: 0.1 + Math.random() * 0.25, rot: (Math.random() - 0.5) * 0.4 };
      group.add(sp);
      puffs.push(sp);
    }
    this.game.scene.add(group);
    // invisible blocker: AI cannot see through the cloud
    const cover = new THREE.Mesh(new THREE.SphereGeometry(R * 0.9, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
    cover.position.copy(pos).setY(pos.y + 1.6);
    cover.scale.y = 0.75;
    this.game.scene.add(cover);
    this.game.world.cover.push(cover);
    this.fx.burst(pos.clone().setY(pos.y + 1), { count: 30, color: '#ffffff', speed: 6, size: 0.08, gravity: -1, life: 0.8 });
    this.zones.push({ kind: 'steam', group, puffs, cover, pos: pos.clone(), radius: R, t: opts.t || 6, age: 0, smoke: !!opts.smoke });
  }

  updateSteam(z, dt) {
    z.age += dt;
    const fadeIn = Math.min(1, z.age / 0.5), fadeOut = Math.min(1, z.t / 1.2);
    for (const sp of z.puffs) {
      const u = sp.userData;
      u.ph += dt;
      sp.position.y += u.vy * dt * 0.3;
      sp.material.rotation += u.rot * dt;
      sp.scale.setScalar(u.s * (0.7 + 0.3 * fadeIn) * (1 + Math.sin(u.ph) * 0.05));
      sp.material.opacity = (z.smoke ? 0.9 : 0.82) * fadeIn * fadeOut;
    }
  }

  /** E: a huge magic orb in one hand — every attack for 3 s is absorbed */
  inferno_e() {
    this.game.weapons.startCast('arcane');
    this.p.shieldT = 2;
    audio.skill('absorb');
    this.game.hud.msg('마력 결계 — 2초간 모든 공격 흡수', 1.5);
    this.fx.ring?.(this.p.position.clone().setY(0.1), '#ffb627', 2.5, 0.5, 0.1);
  }

  /* ================= 잉커 (영웅) ================= */
  /** Q (hold): ink grows in the left hand — the longer, the stronger; release to throw */
  inker_q() {
    if (this.charging) return false;
    this.charging = { key: 'q', t: 0 };
    this.game.weapons.startLeftCast('ink');
    audio.skill('ink');
    return false; // cooldown starts on release
  }

  inker_q_release(ch) {
    const power = ch.power;
    const mesh = new THREE.Group();
    mesh.add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), new THREE.MeshStandardMaterial({ color: '#3b2bd8', emissive: '#2a1ab0', emissiveIntensity: 0.8, roughness: 0.2 })));
    mesh.add(this.fx.glowSprite('#5a4dff', 0.9));
    mesh.scale.setScalar(0.7 + 0.6 * power);
    this.launchOrb(mesh, 30, {
      from: this.game.weapons.orbWorld(this.game.weapons.leftOrb),
      gravity: 14, lift: 4, color: '#7a5cff', smoke: null,
      onHit: (at) => this.inkSplash(at, power),
    });
    audio.skill('throw');
  }

  inkSplash(pos, power) {
    const R = 3.2, max = Math.round(20 + 60 * power); // up to 80 at the centre
    this.fx.burst(pos.clone().setY(pos.y + 0.4), { count: 30, color: '#4a3dff', speed: 7, size: 0.08, life: 0.7 });
    this.fx.burst(pos.clone().setY(pos.y + 0.3), { count: 14, color: '#20d0ff', speed: 5, size: 0.06, life: 0.6 });
    audio.skill('splat', this.p.position.distanceTo(pos));
    for (const b of this.enemies()) {
      const d = b.position.clone().setY(pos.y).distanceTo(pos);
      if (d > R + 0.4) continue;
      this.damage(b, Math.round(max * (1 - 0.4 * Math.min(1, d / R))), '잉크 폭탄');
    }
    pos.y = this.floorBelow(pos.clone().setY(pos.y + 0.5));
    this.createInk(pos, { radius: R, t: 6, boost: 0.15 + 0.25 * power }); // team mates: up to +40% speed
  }

  /** E: dash, leaving a trail of ink (team mates on it run 40% faster) */
  inker_e() {
    this.p.dash(26, 0.32);
    this.trail = { t: 0.38, last: this.p.position.clone(), kind: 'ink' };
    this.createInk(this.p.position.clone().setY(this.floorBelow(this.p.position.clone().setY(0.5))), { radius: 3.2, t: 5, boost: 0.4 });
    this.fx.puff(this.p.position.clone().setY(0.4), '#5a4dff', 2, 0.5, 0.6);
    audio.skill('dash');
    audio.skill('splat');
  }

  createInk(pos, { radius = 3, t = 6, boost = 0.4, team = this.game.myTeam, visual = false } = {}) {
    if (!visual) this.game.net?.fx({ k: 'ink', x: pos.x, y: pos.y, z: pos.z, o: { radius, t, boost, team } });
    const decal = new THREE.Mesh(new THREE.CircleGeometry(radius, 28).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: inkTexture(), transparent: true, depthWrite: false, color: '#ffffff' }));
    decal.position.copy(pos).setY(pos.y + 0.03 + Math.random() * 0.01);
    decal.rotation.y = Math.random() * 6;
    this.game.scene.add(decal);
    this.zones.push({ kind: 'ink', decal, pos: pos.clone(), radius, t, max: t, boost, team });
  }

  /** standing in my team's ink → faster (best puddle counts) */
  inkBoostAt(p) {
    let best = 0;
    for (const z of this.zones) {
      if (z.kind !== 'ink' || z.team !== this.game.myTeam) continue;
      const dx = p.x - z.pos.x, dz = p.z - z.pos.z;
      if (dx * dx + dz * dz < z.radius * z.radius && Math.abs(p.y - z.pos.y) < 1.5) best = Math.max(best, z.boost);
    }
    return best;
  }

  /* ================= 블룸 (인피니티) ================= */
  makeLifeTree(pos, xmas = false) {
    if (xmas) return this.makeXmasTree(pos);
    const g = new THREE.Group();
    const bark = new THREE.MeshStandardMaterial({ color: '#6a4426', roughness: 0.9, flatShading: true });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 1.6, 8), bark);
    trunk.position.y = 0.8;
    g.add(trunk);
    for (const s of [-1, 1]) {
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 0.8, 6), bark);
      br.position.set(s * 0.25, 1.4, 0); br.rotation.z = -s * 0.7;
      g.add(br);
    }
    const blossom = new THREE.MeshStandardMaterial({ color: '#ff9fd8', emissive: '#ff5fb8', emissiveIntensity: 0.35, roughness: 0.6, flatShading: true });
    const leaf = new THREE.MeshStandardMaterial({ color: '#6fdc4a', emissive: '#2f8a1a', emissiveIntensity: 0.25, roughness: 0.7, flatShading: true });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, r = 0.35 + (i % 3) * 0.18;
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32 + (i % 2) * 0.12, 0), i % 3 ? blossom : leaf);
      m.position.set(Math.cos(a) * r, 1.75 + (i % 3) * 0.22, Math.sin(a) * r);
      g.add(m);
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.85, 32), new THREE.MeshBasicMaterial({ color: '#9dff7a', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04;
    g.add(ring, this.fx.glowSprite('#b6ff6a', 2.2));
    const light = new THREE.PointLight('#b6ff8a', 4, 6, 1.5);
    light.position.y = 1.6;
    g.add(light);
    g.position.copy(pos);
    g.scale.setScalar(0.01);
    this.game.scene.add(g);
    return { g, ring, grow: 0, pos: pos.clone() };
  }

  /** Bloom's Christmas skin: a decorated Christmas tree instead of the blossom tree */
  makeXmasTree(pos) {
    const g = new THREE.Group();
    const S = (o) => new THREE.MeshStandardMaterial(o);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.5, 8), S({ color: '#5a3a20', roughness: 0.9 }));
    trunk.position.y = 0.25;
    g.add(trunk);
    const leaf = S({ color: '#1f7a36', roughness: 0.8, flatShading: true });
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.85 - i * 0.22, 0.8, 10), leaf);
      c.position.y = 0.75 + i * 0.5;
      g.add(c);
    }
    const star = new THREE.Mesh(starGeo(0.17, 0.05), S({ color: '#ffd24a', emissive: '#ffb000', emissiveIntensity: 1.6, metalness: 0.6, roughness: 0.3 }));
    star.position.y = 2.25;
    g.add(star);
    const cols = ['#e0182a', '#ffd24a', '#2a7bff', '#ff8fd0', '#ffffff'];
    const lights = [];
    for (let i = 0; i < 18; i++) {
      const lvl = i % 3, a = i * 2.4, r = (0.72 - lvl * 0.2) * 0.85, y = 0.55 + lvl * 0.5 + (i % 2) * 0.12;
      const orn = i % 2 === 0;
      const m = new THREE.Mesh(new THREE.SphereGeometry(orn ? 0.07 : 0.035, 10, 8), orn ? S({ color: cols[i % 5], metalness: 0.8, roughness: 0.15 }) : S({ color: cols[(i + 2) % 5], emissive: cols[(i + 2) % 5], emissiveIntensity: 2 }));
      m.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      g.add(m);
      if (!orn) lights.push(m);
    }
    for (const [x, z, c] of [[0.55, 0.25, '#d0202a'], [-0.45, 0.4, '#2a6ad8'], [0.1, -0.6, '#1f8a3a']]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.3), S({ color: c, roughness: 0.5 }));
      b.position.set(x, 0.13, z);
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.27, 0.06), S({ color: '#ffd24a', metalness: 0.7, roughness: 0.3 }));
      b.add(rib);
      g.add(b);
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.85, 32), new THREE.MeshBasicMaterial({ color: '#ffd24a', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04;
    const glow = this.game.effects.glowSprite('#ffd24a', 1.4);
    glow.position.y = 2.25;
    g.add(ring, glow);
    const light = new THREE.PointLight('#ffd27a', 4, 6, 1.5);
    light.position.y = 1.6;
    g.add(light);
    g.position.copy(pos);
    g.scale.setScalar(0.01);
    this.game.scene.add(g);
    return { g, ring, grow: 0, pos: pos.clone(), lights, star, xmas: true };
  }

  removeLifeTree(t, burst = true) {
    if (!t) return;
    if (burst) this.fx.burst(t.pos.clone().setY(1.6), { count: 30, color: t.xmas ? '#ffd24a' : '#ff9fd8', speed: 4, size: 0.07, gravity: 2, life: 1 });
    this.game.scene.remove(t.g);
    t.g.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  }

  bloom_q() {
    const fwd = this.flatForward();
    const at = this.p.position.clone().addScaledVector(fwd, 1.4);
    at.y = this.floorBelow(at.clone().setY(this.p.position.y + 0.3));
    const ok = this.game.weapons.playSeedPlant(() => {
      if (this.bloomTree) { this.removeLifeTree(this.bloomTree); this.game.net?.fx({ k: 'bloomEnd' }); }
      const xmas = this.myXmas;
      this.bloomTree = this.makeLifeTree(at, xmas);
      this.fx.burst(at.clone().setY(0.2), { count: 24, color: '#9dff5a', speed: 3, size: 0.05, gravity: -1, life: 0.9 });
      this.fx.ring?.(at.clone().setY(0.08), '#9dff7a', 2.5, 0.5, 0.1);
      audio.skill('rock');
      this.game.net?.fx({ k: 'bloom', x: at.x, y: at.y, z: at.z, xmas: xmas ? 1 : 0 });
      this.game.hud.msg(xmas ? '크리스마스 트리 — 죽으면 이 자리에서 되살아납니다' : '생명의 꽃나무 — 죽으면 이 자리에서 되살아납니다', 2);
    });
    if (!ok) return false;
  }

  /** called when I die: a life tree brings me back at its spot */
  tryBloomRevive() {
    const t = this.bloomTree;
    if (!t) return false;
    this.bloomTree = null;
    this.reviving = true;
    this.cancelCharge();
    this.game.hud.msg('꽃나무가 당신을 되살립니다…', 1.4);
    setTimeout(() => {
      const g = this.game;
      this.reviving = false;
      if (g.over || g.disposed) { this.removeLifeTree(t, false); return; }
      this.removeLifeTree(t);
      g.net?.fx({ k: 'bloomEnd' });
      g.player.spawn(t.pos.clone(), g.player.yaw);
      g.player.hp = g.player.maxHp;
      document.getElementById('death').classList.add('hidden');
      this.fx.burst(t.pos.clone().setY(1), { count: 40, color: '#9dff5a', speed: 5, size: 0.07, gravity: -1, life: 1.1 });
      g.hud.flashTint('rgba(150,255,120,.4)');
      g.hud.msg('부활!', 1.2);
      audio.skill('absorb');
    }, 1500);
    return true;
  }

  bloom_e() {
    const ok = this.game.weapons.playSeedToss(() => {
      const g = this.game;
      this.applyBloomSeed(Math.floor(Math.random() * 3), true);
      // the second seed: the closest team mate (person or AI)
      let best = null, bd = 1e9;
      for (const r of Object.values(g.remotes)) if (!r.enemy && r.alive && !r.gone) { const d = r.position.distanceTo(this.p.position); if (d < bd) { bd = d; best = r; } }
      for (const b of g.bots) if (g.net && b.team === g.myTeam && b.alive) { const d = b.position.distanceTo(this.p.position); if (d < bd) { bd = d; best = b; } }
      if (!best) { g.hud.msg('주변에 아군이 없어 씨앗 하나만 사용했습니다', 1.4); return; }
      const kind = Math.floor(Math.random() * 3);
      const from = this.p.camera.position.clone(), to = best.position.clone().setY(best.position.y + 1.2);
      this.fx.tracer(from, to, '#9dff5a', 0.03, 260);
      this.fx.burst(to, { count: 18, color: '#ff9fd8', speed: 2.5, size: 0.05, gravity: -1, life: 0.8 });
      if (best.isRemote) g.net?.sendEffect(best.uid, 'bloom', kind);
      else if (kind === 0) best.hp = Math.min(best.maxHp, best.hp + 30);
      g.hud.msg(`${best.name}에게 씨앗: ${['체력 +30', '피해 1.5배', '이동속도 1.5배'][kind]}`, 1.6);
    });
    if (!ok) return false;
  }

  /** a Bloom seed landed on me: 0 heal 30 · 1 damage x1.5 for 5 s · 2 speed x1.5 for 10 s */
  applyBloomSeed(kind, mine = false) {
    const p = this.p;
    if (!p.alive) return;
    if (kind === 0) p.heal(30);
    else if (kind === 1) this.bloomDmgT = 5;
    else p.speedBuffT = 10;
    this.fx.burst(p.position.clone().setY(1.2), { count: 22, color: kind === 0 ? '#7dff9a' : kind === 1 ? '#ff8fd0' : '#ffe066', speed: 3, size: 0.05, gravity: -1.5, life: 0.9 });
    this.game.hud.flashTint(kind === 0 ? 'rgba(120,255,150,.35)' : kind === 1 ? 'rgba(255,140,210,.35)' : 'rgba(255,230,100,.35)');
    this.game.hud.msg(`${mine ? '' : '블룸의 '}축복의 씨앗: ${['체력 +30', '5초간 피해 1.5배', '10초간 이동속도 1.5배'][kind]}`, 1.8);
    audio.skill('absorb');
  }

  /** a Bloom tree planted by someone else (visual) */
  remoteTree(from, d) {
    this.removeLifeTree(this.remoteTrees[from], false);
    delete this.remoteTrees[from];
    if (d) this.remoteTrees[from] = this.makeLifeTree(new THREE.Vector3(d.x, d.y, d.z), !!d.xmas);
  }

  onRoundReset() {
    this.endSteal();
    if (this.bikeT > 0) this.endBike();
    this.bloomDmgT = 0;
    this.p.speedBuffT = 0;
  }

  updateBloom(dt) {
    if (this.bloomDmgT > 0) this.bloomDmgT -= dt;
    const all = [this.bloomTree, ...Object.values(this.remoteTrees)];
    for (const t of all) {
      if (!t) continue;
      t.grow = Math.min(1, t.grow + dt * 2.2);
      const k = 1 - Math.pow(1 - t.grow, 3);
      t.g.scale.setScalar(Math.max(0.01, k * (1 + Math.sin(this.clock * 2) * 0.02)));
      t.ring.material.opacity = 0.35 + Math.sin(this.clock * 3) * 0.2;
      t.ring.rotation.z += dt * 0.5;
      if (t.xmas) {
        t.star.rotation.y += dt * 1.5;
        t.lights.forEach((l, i) => { l.material.emissiveIntensity = (Math.floor(this.clock * 3) + i) % 3 === 0 ? 3 : 0.4; });
      }
    }
  }

  /* ================= 타이탄 (영웅) ================= */
  titan_q() {
    if (this.p.maxHp >= 250) { this.game.hud.msg('최대 체력이 이미 최대입니다 (250)'); return false; }
    this.titanStacks++;
    this.p.maxHp = Math.min(250, this.p.maxHp + 10);
    this.p.heal(20);
    this.game.hud.flashTint('rgba(255,160,60,.3)');
    this.fx.burst(this.p.position.clone().setY(1), { count: 18, color: '#ffb35a', speed: 3, size: 0.06, gravity: -2, life: 0.9 });
    audio.skill('rock');
    this.game.hud.msg(`거인의 체력 — 최대 체력 ${this.p.maxHp}`, 1.4);
  }

  titan_e() {
    this.golemT = 8;
    this.game.weapons.setGolem(true);
    const c = this.p.position.clone();
    this.fx.ring?.(c.clone().setY(0.1), '#ff8a2a', 5, 0.5, 0.1);
    this.fx.burst(c.clone().setY(0.4), { count: 30, color: '#8a7f72', speed: 6, size: 0.1, life: 0.8 });
    this.fx.puff(c.clone().setY(0.5), '#9a8f82', 3, 0.6, 0.8);
    this.game.hud.flashTint('rgba(140,110,80,.45)');
    this.p.addRecoil(0.03, 0);
    audio.skill('rock');
    audio.skill('boom');
    this.game.hud.msg('돌 골렘! 8초간 피해 1.6배', 1.6);
  }

  endGolem() {
    this.golemT = 0;
    this.game.weapons.setGolem(false);
    this.fx.burst(this.p.position.clone().setY(1), { count: 20, color: '#8a7f72', speed: 4, size: 0.08, life: 0.7 });
    audio.skill('rock');
  }

  /* ================= 볼트 ================= */
  volt_q() {
    const game = this.game, cam = game.camera;
    const dir = this.forward();
    ray.set(cam.position, dir);
    ray.far = 140;
    const hit = ray.intersectObjects(game.world.solids.concat(game.enemyMeshes()), false)[0];
    const end = hit ? hit.point : cam.position.clone().addScaledVector(dir, 140);
    const from = game.weapons.muzzleWorld();
    this.fx.lightning(from, end, '#8ff7ff', 0.035);
    this.game.net?.fx({ k: 'zap', a: { x: from.x, y: from.y, z: from.z }, b: { x: end.x, y: end.y, z: end.z } });
    audio.skill('zap');
    const target = hit?.object.userData.enemy;
    if (target && target.alive) {
      const tp = this.chest(target);
      this.damage(target, 65, '전격 화살');
      const others = this.enemies().filter((b) => b !== target && b.position.distanceTo(tp) < 10)
        .sort((a, b) => a.position.distanceTo(tp) - b.position.distanceTo(tp)).slice(0, 2);
      let prev = tp;
      for (const o of others) {
        const op = this.chest(o);
        this.fx.lightning(prev, op, '#bffcff', 0.025);
        this.damage(o, 35, '전격 화살');
        prev = op;
      }
    } else if (hit) {
      this.fx.burst(end, { count: 10, color: '#8ff7ff', speed: 5, size: 0.04 });
    }
  }

  volt_e() {
    const c = this.p.position.clone();
    for (let i = 0; i < 3; i++) setTimeout(() => this.fx.ring(c, '#8ff7ff', 12, 0.6, 0.2 + i * 0.4), i * 90);
    this.fx.explosion(c.clone().setY(1), '#8ff7ff', 2.5);
    this.game.net?.fx({ k: 'ring', x: c.x, y: c.y + 0.2, z: c.z, c: '#8ff7ff', r: 12 });
    this.game.hud.flashTint('rgba(140,240,255,.35)');
    audio.skill('shock');
    for (const b of this.enemies()) {
      if (b.position.distanceTo(c) < 12) {
        this.fx.lightning(c.clone().setY(1.2), this.chest(b), '#8ff7ff', 0.02);
        b.applyEffect('stun', 2.5);
        this.damage(b, 45, '오버차지');
      }
    }
  }

  /* ---------- projectile ---------- */
  throwProjectile({ color, speed, bounce, fuse, onExplode }) {
    const cam = this.game.camera;
    const dir = this.forward();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2 }));
    const glow = this.fx.glowSprite(color, 0.8);
    mesh.add(glow);
    mesh.position.copy(cam.position).addScaledVector(dir, 0.6).add(new THREE.Vector3(0, -0.15, 0));
    const vel = dir.multiplyScalar(speed).add(new THREE.Vector3(0, 4, 0)).add(this.p.vel.clone().multiplyScalar(0.5));
    this.game.scene.add(mesh);
    this.projectiles.push({ mesh, vel, fuse, bounce, onExplode });
    audio.skill('throw');
  }

  updateProjectiles(dt) {
    const world = this.game.world;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.fuse -= dt;
      pr.vel.y -= 18 * dt;
      const prev = pr.mesh.position.clone();
      pr.mesh.position.addScaledVector(pr.vel, dt);
      const p = pr.mesh.position;
      let impact = false;
      if (p.y < 0.11) {
        impact = true;
        p.y = 0.11;
        if (pr.bounce) { pr.vel.y = Math.abs(pr.vel.y) * 0.4; pr.vel.x *= 0.65; pr.vel.z *= 0.65; }
      }
      const box = world.colliders.find((b) => b.containsPoint(p));
      if (box) {
        impact = true;
        if (pr.bounce) {
          p.copy(prev);
          if (prev.y >= box.max.y) pr.vel.y = Math.abs(pr.vel.y) * 0.4;
          else if (prev.x < box.min.x || prev.x > box.max.x) pr.vel.x *= -0.45;
          else pr.vel.z *= -0.45;
        }
      }
      pr.mesh.rotation.x += dt * 10;
      const hitEnemy = this.enemies().some((b) => b.position.distanceTo(p) < 1.2 && p.y < b.position.y + 2);
      if (pr.fuse <= 0 || (!pr.bounce && (impact || hitEnemy))) {
        this.game.scene.remove(pr.mesh);
        pr.mesh.geometry.dispose();
        pr.onExplode(p.clone());
        this.projectiles.splice(i, 1);
      }
    }
  }

  /* ---------- per frame ---------- */
  update(dt) {
    this.clock = (this.clock || 0) + dt;
    this.cd.q = Math.max(0, this.cd.q - dt);
    this.cd.e = Math.max(0, this.cd.e - dt);
    if (this.stolen) {
      this.stolen.cd.q = Math.max(0, this.stolen.cd.q - dt);
      this.stolen.cd.e = Math.max(0, this.stolen.cd.e - dt);
      this.stolen.t -= dt;
      if (this.stolen.t <= 0 || !this.p.alive) this.endSteal();
    }
    this.updateBike(dt);
    if (this.overheatT > 0) this.overheatT -= dt;
    if (this.echoBuffT > 0) this.echoBuffT -= dt;
    if (this.golemT > 0) { this.golemT -= dt; if (this.golemT <= 0 || !this.p.alive) this.endGolem(); }
    this.updateBloom(dt);
    if (this.p.shieldT > 0) {
      this.p.shieldT -= dt;
      if (this.p.shieldT <= 0) { this.game.weapons.endCast(); audio.skill('absorb'); }
    }
    this.p.inkBoost = this.inkBoostAt(this.p.position);
    const cam = this.game.camera.position;
    const inZ = this.zones.find((z) => z.kind === 'steam' && z.age > 0.3 && z.t > 0.6 && cam.distanceTo(z.pos.clone().setY(z.pos.y + 1.6)) < z.radius * 0.85);
    this.inSteam = inZ ? (inZ.smoke ? 'smoke' : 'steam') : false;
    this.updateTrail(dt);
    this.updateLaser(dt);
    this.updateRemoteLasers(dt);
    if (this.invisT > 0) { this.invisT -= dt; if (this.invisT <= 0) this.endInvis(); }
    this.game.hud.setTint(this.p.shieldT > 0 ? 'shield' : this.golemT > 0 ? 'golem' : this.invisT > 0 ? 'stealth' : this.overheatT > 0 ? 'overheat' : this.echoBuffT > 0 ? 'echo' : this.bloomDmgT > 0 ? 'bloom' : this.p.slowT > 0 ? 'slow' : null);

    const world = this.game.world;
    for (let i = this.walls.length - 1; i >= 0; i--) {
      const w = this.walls[i];
      w.t -= dt;
      w.grow = Math.min(1, w.grow + dt * 5);
      w.mesh.scale.y = 0.05 + 0.95 * (1 - Math.pow(1 - w.grow, 3));
      w.mesh.position.y = w.box.min.y + 1.5 * w.mesh.scale.y;
      if (w.t <= 0) {
        this.fx.burst(w.mesh.position, { count: 24, color: 'ice', speed: 6, size: 0.1 });
        audio.skill('ice', this.p.position.distanceTo(w.mesh.position));
        this.game.scene.remove(w.mesh);
        w.mesh.geometry.dispose();
        for (const arr of [world.colliders, world.solids, world.cover]) {
          const k = arr.indexOf(arr === world.colliders ? w.box : w.mesh);
          if (k >= 0) arr.splice(k, 1);
        }
        this.walls.splice(i, 1);
      }
    }

    if (this.charging) {
      this.charging.t += dt;
      if (!this.p.alive) this.cancelCharge();
    }
    this.updateOrbs(dt);
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.t -= dt;
      if (z.kind === 'steam') {
        this.updateSteam(z, dt);
        if (z.t <= 0) {
          this.game.scene.remove(z.group);
          this.game.scene.remove(z.cover);
          const k = this.game.world.cover.indexOf(z.cover);
          if (k >= 0) this.game.world.cover.splice(k, 1);
          z.group.children.forEach((s) => s.material.dispose());
          this.zones.splice(i, 1);
        }
        continue;
      }
      if (z.kind === 'ink') {
        z.decal.material.opacity = Math.min(1, z.t / 1.2);
        if (z.t <= 0) { this.game.scene.remove(z.decal); z.decal.geometry.dispose(); z.decal.material.dispose(); this.zones.splice(i, 1); }
        continue;
      }
      if (z.kind === 'frost') {
        this.updateFrostZone(z, dt);
        if (z.t <= 0) {
          this.game.scene.remove(z.group);
          z.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); if (o.material !== iceWallMat) o.material.dispose(); } });
          this.zones.splice(i, 1);
        }
        continue;
      }
      const fade = Math.min(1, z.t);
      for (const f of z.flames) {
        f.userData.ph += dt * 8;
        const s = (1.2 + Math.sin(f.userData.ph) * 0.4) * fade * (z.small ? 0.75 : 1);
        f.scale.set(s, s * 1.6, 1);
        f.position.y = 0.5 + Math.sin(f.userData.ph * 0.7) * 0.15;
      }
      if (z.light) z.light.intensity = (6 + Math.random() * 4) * fade;
      if (Math.random() < (z.small ? 0.12 : 0.3)) {
        this.fx.burst(z.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * z.spread * 1.5, 0.3, (Math.random() - 0.5) * z.spread * 1.5)),
          { count: 1, color: '#ffb35a', speed: 1, size: 0.04, gravity: -4, life: 0.8 });
      }
      z.tick -= dt;
      if (z.tick <= 0 && !z.visual) {
        z.tick = 0.25;
        for (const b of this.enemies()) {
          const dx = b.position.x - z.pos.x, dz = b.position.z - z.pos.z;
          if (dx * dx + dz * dz < z.radius * z.radius && Math.abs(b.position.y - z.pos.y) < 2) {
            // overlapping patches of the same fire don't stack
            const hitMap = b._fireHit || (b._fireHit = {});
            if (hitMap[z.name] > this.clock - 0.2) continue;
            hitMap[z.name] = this.clock;
            b.burnT = 0.5;
            this.damage(b, (z.dps || 35) * 0.25, z.name || '화염병');
          }
        }
      }
      if (z.t <= 0) {
        this.game.scene.remove(z.group);
        this.zones.splice(i, 1);
      }
    }

    if (this.marker) {
      this.marker.t -= dt;
      this.marker.group.children[0].rotation.y += dt * 2;
      if (this.marker.t <= 0) { this.removeMarker(); this.game.hud.msg('그림자 표식이 사라졌습니다'); }
    }

    this.updateProjectiles(dt);
  }
}
