import * as THREE from 'three';
import { makeSoldier } from './soldier.js';
import { collideMove } from '../world/iceCanyon.js';
import { damp, clamp } from '../util/noise.js';
import { audio } from '../audio.js';

const NAMES = ['아이스울프', '블리자드', '툰드라', '글래셔', '스노우폴', '폴라리스', '프로스트바이트', '아발란체',
  '서리발톱', '빙하병', '눈보라', '크레바스', '얼음송곳', '설원늑대', '북풍'];
const COLORS = ['#c0392b', '#b5482d', '#a83a4a', '#9c3d2a', '#b8432f'];

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const ray = new THREE.Raycaster();

function hasLOS(world, from, to) {
  _v.copy(to).sub(from);
  const d = _v.length();
  ray.set(from, _v.normalize());
  ray.far = d - 0.3;
  return ray.intersectObjects(world.cover, false).length === 0;
}

let nextId = 1;

/** Hostile AI soldier: patrols, spots the player, strafes and shoots in bursts. */
export class AIBot {
  constructor(game, pos, index, { passive = false } = {}) {
    this.passive = passive; // training dummy: never moves or attacks, respawns
    this.game = game;
    this.id = nextId++;
    this.name = NAMES[index % NAMES.length];
    this.position = pos.clone();
    this.vel = new THREE.Vector3();
    this.yaw = Math.random() * Math.PI * 2;
    this.hp = 150;
    this.maxHp = 150;
    this.alive = true;
    this.onGround = true;

    this.model = makeSoldier(passive ? '#d9823a' : COLORS[index % COLORS.length], passive ? '#ffd36b' : '#ff5b4a');
    this.home = pos.clone();
    if (passive) this.yaw = Math.PI; // face the shooting booth (+Z)
    this.model.group.position.copy(pos);
    game.scene.add(this.model.group);
    this.hitMeshes = this.model.hitParts;
    for (const m of this.hitMeshes) m.userData.enemy = this;

    this.state = 'patrol';
    this.waypoint = this.randomPoint();
    this.losT = Math.random() * 0.3;
    this.canSee = false;
    this.seenT = 0;           // time continuously seeing player (reaction)
    this.lastKnown = new THREE.Vector3();
    this.alertT = 0;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.strafeT = 0;
    this.burstLeft = 0;
    this.shotT = 1 + Math.random();
    this.slowT = 0;
    this.glitchSlowT = 0;
    this.weakT = 0;
    this.blindT = 0;
    this.stunT = 0;
    this.burnT = 0;
    this.flashT = 0;
    this.stuckT = 0;
    this.walkPhase = 0;
    this.deathT = 0;
    this.prefDist = 12 + Math.random() * 14;
  }

  randomPoint() {
    for (let i = 0; i < 20; i++) {
      const p = new THREE.Vector3((Math.random() - 0.5) * 60, 0, -78 + Math.random() * 120);
      if (!this.game.world.colliders.some((b) => p.x > b.min.x - 1 && p.x < b.max.x + 1 && p.z > b.min.z - 1 && p.z < b.max.z + 1 && b.max.y > 0.6)) return p;
    }
    return new THREE.Vector3(0, 0, 0);
  }

  get eye() { return _v2.set(this.position.x, this.position.y + 1.6, this.position.z); }

  alert(pos) {
    if (!this.alive) return;
    this.state = 'hunt';
    this.alertT = 12;
    if (pos) this.lastKnown.copy(pos);
  }

  applyDamage(dmg, info = {}) {
    if (!this.alive) return { killed: false };
    this.hp -= dmg;
    this.flashT = 0.1;
    if (!this.passive) this.alert(this.game.player.position);
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(info);
      return { killed: true };
    }
    return { killed: false };
  }

  applyEffect(type, dur) {
    if (type === 'glitch') {
      if (dur >= 1) this.glitchSlowT = 3;
      if (dur >= 2) this.weakT = 3;
      if (dur >= 3) { this.blindT = 3; this.canSee = false; }
      return;
    }
    if (type === 'slow') this.slowT = Math.max(this.slowT, dur);
    if (type === 'stun') this.stunT = Math.max(this.stunT, dur);
  }

  respawn() {
    this.alive = true;
    this.hp = this.maxHp;
    this.position.copy(this.home);
    const g = this.model.group;
    g.rotation.set(0, this.yaw, 0);
    g.position.copy(this.home);
    if (!g.parent) this.game.scene.add(g);
    this.model.materials.glow.emissiveIntensity = 1.6;
    this.game.effects.puff(this.home.clone().setY(1), '#ffd36b', 1.5, 0.5, 0.6);
  }

  die(info) {
    this.alive = false;
    this.deathT = 0;
    this.fallDir = Math.random() < 0.5 ? 1 : -1;
    this.model.materials.glow.emissiveIntensity = 0.1;
    this.game.onEnemyKilled(this, info);
  }

  shoot(player) {
    const muzzle = this.model.muzzle.getWorldPosition(new THREE.Vector3());
    const target = player.position.clone().setY(player.position.y + player.aimHeight);
    const dist = muzzle.distanceTo(target);
    let chance = 0.42 - dist * 0.005;
    if (player.moving) chance -= 0.1;
    if (player.sprinting) chance -= 0.08;
    if (!player.onGround) chance -= 0.1;
    if (player.sliding) chance -= 0.15;
    if (this.seenT < 0.8) chance *= 0.4;
    if (this.slowT > 0) chance *= 0.7;
    chance = clamp(chance, 0.05, 0.5);
    const hit = Math.random() < chance;
    const end = target.clone();
    if (hit) {
      player.applyDamage(this.weakT > 0 ? 1 : 10 + Math.floor(Math.random() * 4), { killer: this.name, weapon: '소총', fromPos: this.position.clone() });
    } else {
      const off = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).multiplyScalar(1.2 + dist * 0.03);
      end.add(off);
      end.sub(muzzle).multiplyScalar(1.6).add(muzzle);
      if (dist < 25 && Math.random() < 0.3) audio.whiz();
    }
    this.game.effects.tracer(muzzle, end, '#ff7a5a', 0.02, 180);
    this.game.effects.worldFlash(muzzle, 0.5);
    audio.shot('bot', dist);
  }

  update(dt) {
    const g = this.model.group;
    if (!this.alive) {
      this.deathT += dt;
      g.rotation.x = damp(g.rotation.x, (Math.PI / 2) * 0.95 * this.fallDir, 9, dt);
      if (this.deathT > 3) g.position.y = -(this.deathT - 3) * 0.6;
      if (this.passive && this.deathT > 3) { this.respawn(); return; }
      if (this.deathT > 5 && g.parent) g.parent.remove(g);
      return;
    }
    if (this.passive) {
      // training dummy: stand still facing the booth, idle breathing only
      if (this.flashT > 0) { this.flashT -= dt; this.model.materials.body.emissive.set(this.flashT > 0 ? '#ff2a2a' : '#000000'); }
      g.position.copy(this.position);
      g.rotation.set(0, this.yaw, 0);
      this.model.joints.torso.rotation.x = Math.sin(performance.now() * 0.002 + this.id) * 0.02;
      return;
    }
    const game = this.game, player = game.player;
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.model.materials.body.emissive.set(this.flashT > 0 ? '#ff2a2a' : '#000000');
    }
    if (this.burnT > 0) this.burnT -= dt;
    if (this.stunT > 0) {
      this.stunT -= dt;
      g.rotation.z = Math.sin(this.stunT * 30) * 0.06;
      this.model.materials.glow.emissive.set(this.stunT > 0 ? '#8ff7ff' : '#ff5b4a');
      return;
    }
    g.rotation.z = 0;
    if (this.slowT > 0) this.slowT -= dt;
    if (this.weakT > 0) this.weakT -= dt;
    if (this.glitchSlowT > 0) {
      this.glitchSlowT -= dt;
      this.model.materials.glow.emissive.set(Math.random() < 0.3 ? '#39ff9e' : '#8a3dff');
      if (this.glitchSlowT <= 0) this.model.materials.glow.emissive.set('#ff5b4a');
    }
    if (this.blindT > 0) { this.blindT -= dt; this.canSee = false; this.losT = 0.3; }

    // perception
    const toP = player.position.clone().sub(this.position);
    const dist = toP.length();
    this.losT -= dt;
    if (this.losT <= 0) {
      this.losT = 0.2 + Math.random() * 0.1;
      const visible = player.alive && !player.invisible && dist < 70;
      let see = false;
      if (visible) {
        const facing = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
        const inFov = facing.dot(toP.clone().setY(0).normalize()) > 0.2 || dist < 12 || this.state === 'hunt';
        see = (inFov && dist < 55) || (this.state === 'hunt' && dist < 70);
        if (see) see = hasLOS(game.world, this.eye.clone(), player.camera.position);
      }
      this.canSee = see;
      if (see) { this.lastKnown.copy(player.position); this.alert(); }
    }
    this.seenT = this.canSee ? this.seenT + dt : 0;
    if (this.state === 'hunt' && !this.canSee) {
      this.alertT -= dt;
      if (this.alertT <= 0 && !game.huntAll) { this.state = 'patrol'; this.waypoint = this.randomPoint(); }
    }
    if (game.huntAll && player.alive && !player.invisible) { this.state = 'hunt'; if (!this.canSee) this.lastKnown.copy(player.position); }

    // movement intent
    let speed = 3.2;
    const move = new THREE.Vector3();
    let faceTarget = null;
    if (this.state === 'hunt' && player.alive) {
      if (this.canSee) {
        faceTarget = player.position;
        const dir = toP.clone().setY(0).normalize();
        const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(this.strafeDir);
        this.strafeT -= dt;
        if (this.strafeT <= 0) { this.strafeDir *= -1; this.strafeT = 0.8 + Math.random() * 1.6; }
        move.add(side);
        if (dist > this.prefDist + 4) move.addScaledVector(dir, 1);
        else if (dist < this.prefDist - 6) move.addScaledVector(dir, -0.8);
        speed = 3.6;
        // shooting
        this.shotT -= dt;
        if (this.shotT <= 0 && this.seenT > 0.35) {
          if (this.burstLeft <= 0) this.burstLeft = 3 + Math.floor(Math.random() * 3);
          this.shoot(player);
          this.burstLeft--;
          this.shotT = this.burstLeft > 0 ? 0.13 : 0.9 + Math.random() * 0.9;
          if (this.slowT > 0) this.shotT *= 1.6;
        }
      } else {
        const d = _v2.copy(this.lastKnown).sub(this.position).setY(0);
        if (d.length() > 2) move.copy(d.normalize());
        faceTarget = this.lastKnown;
        speed = 4.6;
      }
    } else {
      const d = _v2.copy(this.waypoint).sub(this.position).setY(0);
      if (d.length() < 2) this.waypoint = this.randomPoint();
      else move.copy(d.normalize());
      speed = 2.4;
    }
    if (this.slowT > 0) speed *= 0.5;
    if (this.glitchSlowT > 0) speed /= 3;
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed);

    // stuck → sidestep
    if (this.stuckT > 0) { this.stuckT -= dt; move.copy(this.unstick).multiplyScalar(speed); }
    this.vel.x = damp(this.vel.x, move.x, 8, dt);
    this.vel.z = damp(this.vel.z, move.z, 8, dt);
    this.vel.y -= 22 * dt;
    const before = this.position.clone();
    const res = collideMove(this.position, this.vel, dt, 0.4, 1.85, game.world.colliders, this.onGround);
    this.onGround = res.onGround;
    const moved = before.distanceTo(this.position);
    if (move.lengthSq() > 1 && moved < speed * dt * 0.25 && this.stuckT <= 0) {
      this.stuckT = 0.6 + Math.random() * 0.6;
      this.unstick = new THREE.Vector3(-move.z, 0, move.x).normalize().multiplyScalar(Math.random() < 0.5 ? 1 : -1);
      if (this.state === 'patrol') this.waypoint = this.randomPoint();
    }

    // facing
    let targetYaw = this.yaw;
    if (faceTarget) targetYaw = Math.atan2(-(faceTarget.x - this.position.x), -(faceTarget.z - this.position.z));
    else if (move.lengthSq() > 0.1) targetYaw = Math.atan2(-move.x, -move.z);
    let dy = targetYaw - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * Math.min(1, dt * 8);

    // animate
    g.position.copy(this.position);
    g.rotation.y = this.yaw;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.walkPhase += dt * hs * 2.2;
    const sw = Math.sin(this.walkPhase) * Math.min(1, hs / 3) * 0.6;
    this.model.legs[0].rotation.x = sw;
    this.model.legs[1].rotation.x = -sw;
    this.model.knees[0].rotation.x = -Math.max(0, -sw) * 1.1;
    this.model.knees[1].rotation.x = -Math.max(0, sw) * 1.1;
    this.model.head.rotation.y = 0;
  }

  dispose() {
    if (this.model.group.parent) this.model.group.parent.remove(this.model.group);
    this.model.group.traverse((o) => o.isMesh && o.geometry.dispose());
  }
}
