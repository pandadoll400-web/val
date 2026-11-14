import * as THREE from 'three';
import { collideMove } from '../world/iceCanyon.js';
import { damp, clamp } from '../util/noise.js';
import { save } from '../save.js';
import { audio } from '../audio.js';

const WALK = 5.4;
const SPRINT = 8.4;
const JUMP_V = 7.2;
const GRAVITY = 22;
const EYE = 1.62;
const REGEN_DELAY = 4.5;
const REGEN_RATE = 14;

/** First-person controller: WASD / Shift sprint / Space jump / mouse look + health. */
export class Player {
  constructor(game) {
    this.game = game;
    this.camera = game.camera;
    this.pos = new THREE.Vector3();
    this.position = this.pos; // alias used by AI
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.recoilKick = 0;
    this.radius = 0.4;
    this.height = 1.8;
    this.onGround = true;
    this.hp = 150;
    this.maxHp = 150;
    this.alive = true;
    this.sprinting = false;
    this.moving = false;
    this.bobPhase = 0;
    this.bobAmt = 0;
    this.landKick = 0;
    this.lastHurt = -10;
    this.time = 0;
    this.dashT = 0;
    this.dashDir = new THREE.Vector3();
    this.slowT = 0;
    this.glitchSlowT = 0; // Glitch E lvl 1: speed / 3
    this.weakT = 0;       // Glitch E lvl 2: my damage is 1
    this.blindT = 0;      // Glitch E lvl 3: screen covered
    this.shieldT = 0;     // Inferno E: every attack absorbed
    this.inkBoost = 0;    // Inker ink under my feet: +speed
    this.inputDir = new THREE.Vector3();
    // slide / crouch
    this.slideT = 0;
    this.slideCd = 0;
    this.slideDir = new THREE.Vector3();
    this.slideSpeed = 0;
    this.crouchAmt = 0;   // 0 standing .. 1 low
    this.crouching = false;
    this.cWas = false;
    this.eyeY = EYE;
  }

  get sliding() { return this.slideT > 0; }
  /** chest height used by enemies to aim */
  get aimHeight() { return 1.25 - this.crouchAmt * 0.55; }

  get invisible() { return this.game.skills?.isInvisible() || false; }

  spawn(pos, yaw = 0) {
    this.pos.copy(pos);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.maxHp = 150; // Titan's extra max HP is lost on death
    if (this.game.skills) { this.game.skills.titanStacks = 0; if (this.game.skills.golemT > 0) this.game.skills.endGolem(); }
    this.hp = this.maxHp;
    this.alive = true;
    this.glitchSlowT = this.weakT = this.blindT = this.shieldT = 0;
    this.updateCamera(0);
  }

  onMouseMove(dx, dy) {
    const s = 0.0022 * save.sens * this.game.weapons.sensMul();
    this.yaw -= dx * s;
    this.pitch = clamp(this.pitch - dy * s, -1.55, 1.55);
  }

  addRecoil(pitch, yaw) {
    this.pitch = clamp(this.pitch + pitch * 0.65, -1.55, 1.55);
    this.recoilKick += pitch * 0.35;
    this.yaw += yaw;
  }

  dash(speed = 24, time = 0.18) {
    const d = this.inputDir.lengthSq() > 0 ? this.inputDir.clone() : new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.dashDir.copy(d).normalize().multiplyScalar(speed);
    this.dashT = time;
  }

  applyDamage(dmg, info = {}) {
    if (!this.alive) return { killed: false };
    if (this.shieldT > 0) {
      // Inferno's barrier eats the hit
      if (this.time - (this._absorbMsg || 0) > 0.4) { this._absorbMsg = this.time; this.game.hud.msg('흡수!', 0.4); audio.skill('absorbHit'); }
      return { killed: false, absorbed: true };
    }
    this.hp -= dmg;
    this.lastHurt = this.time;
    this.game.hud.hurt(info.fromPos);
    audio.hurt();
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.game.onPlayerKilled(info);
      return { killed: true };
    }
    return { killed: false };
  }

  /** hit by Glitch E: effects stack with the level (1 slow · 2 + damage 1 · 3 + blind), 3 s each */
  applyGlitch(lvl) {
    if (lvl >= 1) this.glitchSlowT = 3;
    if (lvl >= 2) this.weakT = 3;
    if (lvl >= 3) this.blindT = 3;
    this.game.hud.msg(['', '글리치! 3초간 이동속도 1/3', '글리치! 감속 + 3초간 내 피해 1', '글리치! 감속 + 피해 1 + 시야 가림'][Math.min(3, lvl)], 2);
    audio.skill('glitch');
  }

  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }

  update(dt, keys) {
    this.time += dt;
    if (this.glitchSlowT > 0) this.glitchSlowT -= dt;
    if (this.weakT > 0) this.weakT -= dt;
    if (this.blindT > 0) this.blindT -= dt;
    if (!this.alive) { this.updateCamera(dt); return; }
    const w = this.game.weapons;
    const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    const r = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let wx = -sin * f + cos * r;
    let wz = -cos * f - sin * r;
    const len = Math.hypot(wx, wz);
    if (len > 0) { wx /= len; wz /= len; }
    this.inputDir.set(wx, 0, wz);

    // ---- C: slide (while moving fast) / crouch (hold) ----
    const cDown = !!keys.KeyC;
    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    this.slideCd = Math.max(0, this.slideCd - dt);
    if (cDown && !this.cWas && this.onGround && hSpeed > 4.5 && this.slideCd <= 0 && len > 0) {
      this.slideT = 0.75;
      this.slideCd = 0.9;
      this.slideDir.set(this.vel.x, 0, this.vel.z).normalize();
      this.slideSpeed = Math.max(hSpeed, 7) + 4.5;
      this.game.onPlayerSlide?.();
    }
    this.cWas = cDown;
    this.crouching = cDown && !this.sliding;

    this.sprinting = !!keys.ShiftLeft && f > 0 && !w.adsHeld && !w.trigger && !this.crouching && !this.sliding;
    let speed = (this.sprinting ? SPRINT : WALK) * w.def.mobility;
    speed *= 1 - 0.45 * w.adsT;
    if (this.crouching) speed *= 0.5;
    if (this.slowT > 0) { this.slowT -= dt; speed *= 0.5; }
    if (this.glitchSlowT > 0) speed /= 3;
    if (this.inkBoost > 0) speed *= 1 + this.inkBoost;
    const accel = this.onGround ? 14 : 2.5;
    this.vel.x = damp(this.vel.x, wx * speed, accel, dt);
    this.vel.z = damp(this.vel.z, wz * speed, accel, dt);
    if (this.sliding) {
      this.slideT -= dt;
      this.slideSpeed = Math.max(0, this.slideSpeed - 13 * dt);
      // allow a little steering toward the view direction
      const look = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      this.slideDir.lerp(look, Math.min(1, dt * 1.2)).normalize();
      this.vel.x = this.slideDir.x * this.slideSpeed;
      this.vel.z = this.slideDir.z * this.slideSpeed;
      if (!this.onGround) this.slideT = Math.min(this.slideT, 0.05);
      if (this.slideT <= 0 && keys.KeyC) this.crouching = true;
    }
    const lowTarget = this.sliding ? 1 : this.crouching ? 0.6 : 0;
    this.crouchAmt = damp(this.crouchAmt, lowTarget, this.sliding ? 16 : 12, dt);
    this.height = 1.8 - this.crouchAmt * 0.75;
    this.eyeY = EYE - this.crouchAmt * 0.72;
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vel.x = this.dashDir.x;
      this.vel.z = this.dashDir.z;
    }

    if (keys.Space && this.onGround) {
      if (this.sliding) this.slideT = 0; // slide-jump: keeps horizontal momentum (low air control)
      this.vel.y = JUMP_V;
      this.onGround = false;
    }
    this.vel.y -= GRAVITY * dt;

    const fallSpeed = this.vel.y;
    const wasGround = this.onGround;
    const res = collideMove(this.pos, this.vel, dt, this.radius, this.height, this.game.world.colliders, this.onGround);
    this.onGround = res.onGround;
    if (!wasGround && this.onGround && fallSpeed < -4) this.landKick = Math.min(0.25, -fallSpeed * 0.02);
    if (this.pos.y < -20) this.pos.set(0, 2, 70);

    // health regen
    if (this.time - this.lastHurt > REGEN_DELAY && this.hp < this.maxHp) this.heal(REGEN_RATE * dt);

    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.moving = hs > 0.8 && this.onGround && !this.sliding;
    this.bobAmt = damp(this.bobAmt, this.moving ? (this.sprinting ? 1.4 : 1) : 0, 8, dt);
    this.bobPhase += dt * hs * 1.7;
    this.updateCamera(dt);
  }

  updateCamera(dt) {
    this.landKick = damp(this.landKick, 0, 10, dt);
    this.recoilKick = damp(this.recoilKick, 0, 10, dt);
    const ads = this.game.weapons ? this.game.weapons.adsT : 0;
    const bobK = 1 - ads * 0.8;
    const bobY = Math.sin(this.bobPhase * 2) * 0.045 * this.bobAmt * bobK;
    const bobX = Math.cos(this.bobPhase) * 0.03 * this.bobAmt * bobK;
    const cam = this.camera;
    const eye = (this.alive ? this.eyeY : 0.35) + (this.sliding ? (Math.random() - 0.5) * 0.012 : 0);
    cam.position.set(
      this.pos.x + Math.cos(this.yaw) * bobX,
      this.pos.y + eye + bobY - this.landKick,
      this.pos.z - Math.sin(this.yaw) * bobX,
    );
    const slideRoll = this.sliding ? 0.06 * Math.min(1, this.slideT * 4) : 0;
    cam.rotation.set(this.pitch + this.recoilKick, this.yaw, this.alive ? Math.cos(this.bobPhase) * 0.004 * this.bobAmt + slideRoll : 0.5);
    cam.updateMatrixWorld();
  }
}
