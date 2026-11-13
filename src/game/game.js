import * as THREE from 'three';
import { IceCanyonWorld } from '../world/iceCanyon.js';
import { Player } from './player.js';
import { WeaponSystem } from './weapons.js';
import { Effects } from './effects.js';
import { SkillSystem } from './skills.js';
import { HUD } from './hud.js';
import { AIBot } from './bots.js';
import { save, persist } from '../save.js';
import { getCharacter } from '../data/characters.js';
import { audio } from '../audio.js';
import { RemotePlayer } from './remotePlayer.js';
import { IS_TOUCH, TouchControls } from './touch.js';
import { serverNow } from '../net/firebase.js';
import { MODE_NAMES } from '../net/room.js';

const $ = (id) => document.getElementById(id);
export const ENEMY_COUNT = 15;
const COIN_PER_KILL = 20;
const COIN_WIN = 300;

/** One match: the player vs 15 AI enemies in the ice canyon. Kill all 15 to win. */
export class Game {
  constructor(renderer, { mode = 'solo', onExit, onRestart, net = null }) {
    this.mode = mode;
    this.net = net;
    this.myTeam = net ? net.myTeam : 'A';
    this.myName = save.name;
    this.remotes = {};
    this.score = { A: 0, B: 0 };
    this.startAt = net ? net.meta.startAt : 0;
    this.respawnAt = 0;
    this.hits = 0;
    this.pickups = [];
    this.renderer = renderer;
    this.onExit = onExit;
    this.onRestart = onRestart;
    this.keys = {};
    this.paused = false;
    this.over = false;
    this.time = 0;
    this.kills = 0;
    this.headshots = 0;
    this.shots = 0;
    this.coinsEarned = 0;
    this.totalEnemies = ENEMY_COUNT;
    this.huntAll = false;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(save.fov, innerWidth / innerHeight, 0.05, 2500);
    this.camera.rotation.order = 'YXZ';
    this.character = getCharacter(save.character);

    this.world = new IceCanyonWorld(this.scene, renderer, mode === 'training' ? 'range' : 'arena');
    this.effects = new Effects(this);
    this.player = new Player(this);
    this.skills = new SkillSystem(this);
    this.weapons = new WeaponSystem(this);
    this.hud = new HUD(this);
    this.touch = IS_TOUCH ? new TouchControls(this) : null;

    this.bots = net ? [] : mode === 'training'
      ? this.world.targetSpots.map((p, i) => new AIBot(this, p, i, { passive: true }))
      : this.world.enemySpawns(ENEMY_COUNT).map((p, i) => new AIBot(this, p, i));
    this.totalEnemies = this.bots.length;
    if (net) {
      for (const uid of net.others) {
        const pr = net.players[uid];
        this.remotes[uid] = new RemotePlayer(this, uid, pr, { enemy: pr.team !== this.myTeam, team: pr.team });
      }
      net.attach(this);
    }

    this.bindInput();
  }

  /** everything my bullets and skills can hurt: AI bots + enemy players (team mates are never hit) */
  hostiles() {
    const out = this.bots.filter((b) => b.alive);
    for (const r of Object.values(this.remotes)) if (r.enemy && r.alive && !r.gone) out.push(r);
    return out;
  }

  enemyMeshes() {
    const out = [];
    for (const b of this.hostiles()) out.push(...b.hitMeshes);
    return out;
  }

  /* ---------- lifecycle ---------- */
  start() {
    const sp = this.net ? this.teamSpawn(this.myTeam, this.net.me.slot) : this.world.spawns[0];
    this.player.spawn(sp.pos, sp.yaw);
    $('hud').classList.remove('hidden');
    $('result').classList.add('hidden');
    audio.init();
    if (this.net) this.hud.msg(`${MODE_NAMES[this.mode]} — ${this.net.target}킬을 먼저 달성하는 팀이 승리!`, 3.5);
    else this.hud.msg(this.mode === 'training' ? '훈련장 — 표적은 움직이거나 공격하지 않습니다 · Esc로 나가기' : `적 ${this.totalEnemies}명을 모두 처치하라!`, 3.5);
    this.lock();
  }

  lock() {
    if (IS_TOUCH) return; // phones: no pointer lock, the touch overlay drives the camera
    const p = this.renderer.domElement.requestPointerLock?.();
    if (p && p.catch) p.catch(() => {});
  }

  dispose() {
    this.unbindInput();
    document.exitPointerLock?.();
    this.net?.dispose();
    this.touch?.dispose();
    for (const r of Object.values(this.remotes)) r.dispose();
    this.hud.dispose();
    this.weapons.dispose();
    for (const b of this.bots) b.dispose();
    $('hud').classList.add('hidden');
    $('pause').classList.add('hidden');
    $('result').classList.add('hidden');
    this.world.dispose();
  }

  /* ---------- events ---------- */
  onPlayerShot() {
    this.shots++;
    if (this.net) this.net.onLocalShot(this.weapons.def.kind === 'gun' ? this.weapons.lastTracerEnd : null);
    if (this.mode === 'training') return;
    // gunfire alerts nearby enemies (not while sneaking up with the pistol from far away)
    const radius = this.weapons.def.id === 'pistol' || this.weapons.def.kind === 'melee' ? 22 : 38;
    for (const b of this.bots) {
      if (b.alive && b.position.distanceTo(this.player.position) < radius) b.alert(this.player.position);
    }
  }

  onPlayerSlide() {
    audio.slide();
    this.effects.puff(this.player.position.clone().setY(0.3), '#eef7ff', 1.6, 0.5, 0.7);
  }

  onEnemyKilled(bot, info) {
    this.kills++;
    if (info.from === 'player' || info.from === undefined) this.skills.onKill();
    // skin kill effect left at the spot where the enemy fell
    const skin = info.skin;
    if (skin && info.from === 'player') this.effects.killFx(skin, bot.position.clone());
    if (info.headshot) this.headshots++;
    const me = this.character.name;
    this.hud.killfeed(`<span class="me">${me}</span><span class="w">${info.weapon || ''}${info.headshot ? ' <span class="hs">◎ 헤드샷</span>' : ''}</span>${this.mode === 'training' ? '표적' : bot.name}`);
    if (this.mode === 'training') return; // dummies respawn, no win condition
    this.coinsEarned += COIN_PER_KILL;
    this.spawnAmmo(bot.position);
    const left = this.totalEnemies - this.kills;
    if (left > 0 && left <= 5 && !this.huntAll) {
      this.huntAll = true;
      this.hud.msg(`남은 적 ${left}명 — 적들이 당신을 추적합니다!`, 3);
    }
    if (left <= 0) setTimeout(() => this.finish(true), 1200);
  }

  /* ---------- ammo boxes dropped by enemies ---------- */
  spawnAmmo(pos) {
    if (this.weapons.slots.every((s) => s.def.kind === 'melee')) return;
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.3), new THREE.MeshStandardMaterial({ color: '#3d5a3a', roughness: 0.6 }));
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.06, 0.32), new THREE.MeshStandardMaterial({ color: '#ffb84a', emissive: '#ff9a2a', emissiveIntensity: 0.8 }));
    box.castShadow = true;
    g.add(box, band, this.effects.glowSprite('#ffb84a', 1.1));
    g.position.copy(pos).setY(0.35);
    this.scene.add(g);
    this.pickups.push({ g, t: 0 });
  }

  updatePickups(dt) {
    const p = this.player, w = this.weapons;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const k = this.pickups[i];
      k.t += dt;
      k.g.rotation.y += dt * 2;
      k.g.position.y = 0.35 + Math.sin(k.t * 3) * 0.08;
      if (p.alive && k.g.position.distanceTo(p.position.clone().setY(0.35)) < 1.6) {
        // refills every slot: the weapon in hand gets the most
        const parts = [];
        w.slots.forEach((s, i) => {
          const cur = i === w.cur, k = s.def.kind;
          if (k === 'melee') return;
          if (k === 'grenade') {
            if (s.mag + s.reserve < 3) { if (s.mag === 0 && w.throwT < 0) s.mag = 1; else s.reserve++; parts.push('수류탄 +1'); }
            return;
          }
          const add = k === 'bow' ? (cur ? 6 : 3) : Math.max(1, s.def.mag) * (cur ? 2 : 1);
          s.reserve += add;
          if (cur) parts.unshift(`+${add} ${k === 'bow' ? '화살' : '탄약'}`);
        });
        this.hud.msg(parts.join(' · ') || '탄약 보충', 1.4);
        audio.magIn();
        this.scene.remove(k.g);
        this.pickups.splice(i, 1);
      } else if (k.t > 45) { this.scene.remove(k.g); this.pickups.splice(i, 1); }
    }
  }

  onPlayerKilled(info) {
    if (this.net) {
      this.hud.killfeed(`${info.killer || '상대'}<span class="w">${info.weapon || ''}</span><span class="me">${this.myName}</span>`);
      $('death').classList.remove('hidden');
      $('death-by').textContent = `${info.killer || '상대'}에게 처치당했습니다`;
      this.respawnAt = this.time + 3;
      this.skills.cancelCharge();
      this.net.reportDeath(info.killerUid, info.weapon, info.headshot);
      return;
    }
    this.hud.killfeed(`${info.killer || '적'}<span class="w">${info.weapon || ''}</span><span class="me">${this.character.name}</span>`);
    $('death').classList.remove('hidden');
    $('death-by').textContent = `${info.killer || '적'}에게 처치당했습니다`;
    $('death-timer').textContent = '';
    setTimeout(() => this.finish(false), 2200);
  }

  finish(win) {
    if (this.over) return;
    this.over = true;
    if (win) this.coinsEarned += COIN_WIN;
    save.coins += this.coinsEarned;
    persist();
    document.exitPointerLock?.();
    $('death').classList.add('hidden');
    $('pause').classList.add('hidden');
    $('result-title').textContent = win ? '승리!' : '패배';
    $('result-title').style.color = win ? '#7dffb0' : '#ff5a64';
    const mins = Math.floor(this.time / 60), secs = Math.floor(this.time % 60);
    $('result-body').innerHTML = `
      ${win ? '협곡의 적을 모두 섬멸했습니다.' : '협곡의 추위 속에 쓰러졌습니다.'}<br>
      처치 <b>${this.kills} / ${this.totalEnemies}</b> · 헤드샷 <b>${this.headshots}</b><br>
      플레이 시간 <b>${mins}분 ${String(secs).padStart(2, '0')}초</b><br>
      획득 코인 <span class="coin">◆ ${this.coinsEarned.toLocaleString()}</span>`;
    $('result').classList.remove('hidden');
    $('result-again').textContent = '다시하기';
    $('result-exit').textContent = '메뉴로';
    $('result-again').onclick = () => this.onRestart();
    $('result-exit').onclick = () => this.onExit();
  }

  /* ---------- input ---------- */
  bindInput() {
    const canvas = this.renderer.domElement;
    const locked = () => document.pointerLockElement === canvas;
    this._onKeyDown = (e) => {
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      this.keys[e.code] = true;
      if (e.code === 'ShiftRight') this.keys.ShiftLeft = true;
      if (this.paused || this.over || !this.player.alive || e.repeat || this.frozen) return;
      const w = this.weapons;
      if (e.code === 'KeyR') w.reload();
      else if (e.code === 'KeyQ') this.skills.use('q');
      else if (e.code === 'KeyE') this.skills.use('e');
      else if (e.code === 'KeyF') w.inspect();
      else if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') w.equip(+e.code.slice(5) - 1);
      else if (e.code === 'KeyG') { const gi = w.slots.findIndex((s) => s.def.kind === 'grenade'); if (gi >= 0) w.equip(gi); }
    };
    this._onKeyUp = (e) => {
      this.keys[e.code] = false;
      if (e.code === 'KeyE') this.skills.release('e');
      if (e.code === 'KeyQ') this.skills.release('q');
      if (e.code === 'ShiftRight') this.keys.ShiftLeft = false;
    };
    this._onMouseMove = (e) => {
      if (!locked() || this.paused || this.over) return;
      this.player.onMouseMove(e.movementX, e.movementY);
      this.weapons.onMouseMove(e.movementX, e.movementY);
    };
    this._onMouseDown = (e) => {
      if (this.over) return;
      if (!locked()) { if (!this.paused) this.lock(); return; }
      if (e.button === 0) { this.weapons.trigger = true; this.weapons.triggerUsed = false; }
      if (e.button === 2) this.weapons.adsHeld = true;
    };
    this._onMouseUp = (e) => {
      if (e.button === 0) this.weapons.trigger = false;
      if (e.button === 2) this.weapons.adsHeld = false;
    };
    this._onWheel = (e) => {
      if (!locked() || this.paused || this.over || !this.player.alive) return;
      const w = this.weapons, n = w.slots.length;
      if (performance.now() - (this._wheelT || 0) < 120) return;
      this._wheelT = performance.now();
      w.equip((w.cur + (e.deltaY > 0 ? 1 : -1) + n) % n);
    };
    this._onContext = (e) => e.preventDefault();
    this._onLockChange = () => { if (!locked() && !this.over) this.setPaused(true); };
    this._onBlur = () => { this.keys = {}; this.weapons.trigger = false; this.weapons.adsHeld = false; this.skills.cancelCharge(); };

    addEventListener('keydown', this._onKeyDown);
    addEventListener('keyup', this._onKeyUp);
    addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mousedown', this._onMouseDown);
    addEventListener('mouseup', this._onMouseUp);
    addEventListener('wheel', this._onWheel, { passive: true });
    addEventListener('contextmenu', this._onContext);
    document.addEventListener('pointerlockchange', this._onLockChange);
    addEventListener('blur', this._onBlur);

    $('pause-resume').onclick = () => { this.setPaused(false); this.lock(); };
    $('pause-exit').onclick = () => this.onExit(this.net ? 'lobby' : undefined);
    const sens = $('pause-sens');
    sens.value = save.sens;
    $('pause-sens-v').textContent = save.sens.toFixed(2);
    sens.oninput = () => {
      save.sens = parseFloat(sens.value);
      $('pause-sens-v').textContent = save.sens.toFixed(2);
      persist();
    };
  }

  unbindInput() {
    removeEventListener('keydown', this._onKeyDown);
    removeEventListener('keyup', this._onKeyUp);
    removeEventListener('mousemove', this._onMouseMove);
    this.renderer.domElement.removeEventListener('mousedown', this._onMouseDown);
    removeEventListener('mouseup', this._onMouseUp);
    removeEventListener('wheel', this._onWheel);
    removeEventListener('contextmenu', this._onContext);
    document.removeEventListener('pointerlockchange', this._onLockChange);
    removeEventListener('blur', this._onBlur);
  }

  setPaused(p) {
    this.paused = p;
    this.keys = {};
    this.weapons.trigger = false;
    this.weapons.adsHeld = false;
    if (p) this.skills.cancelCharge();
    $('pause').classList.toggle('hidden', !p);
  }

  /* ---------- loop ---------- */
  update(dt) {
    if (this.paused && !this.net) return; // online matches keep running behind the pause menu
    this.time += dt;
    const frozen = this.frozen;
    if (frozen) {
      this.weapons.trigger = false;
      const left = Math.ceil((this.startAt - serverNow()) / 1000);
      this.hud.msg(left > 0 ? `${left}` : '', 0.3);
    } else if (this.net && this._wasFrozen) this.hud.msg('시작!', 1);
    this._wasFrozen = frozen;
    if (this.net && !this.player.alive && this.respawnAt && !this.over) {
      const left = this.respawnAt - this.time;
      $('death-timer').textContent = left > 0 ? `${Math.ceil(left)}초 후 부활` : '';
      if (left <= 0) this.respawnPlayer();
    }
    this.player.update(dt, this.over || this.paused || frozen ? {} : this.keys);
    if (this.player.sliding && Math.random() < 0.6) {
      const p = this.player.position;
      this.effects.burst(p.clone().setY(0.1), { count: 2, color: 'ice', speed: 2.5, size: 0.03, life: 0.4 });
      if (Math.random() < 0.3) this.effects.puff(p.clone().setY(0.25), '#eef7ff', 0.9, 0.4, 0.5);
      // snow kicked up by the hand touching the ground (front-left)
      const yaw = this.player.yaw;
      const hand = p.clone().add(new THREE.Vector3(-Math.cos(yaw) * 0.5 - Math.sin(yaw) * 0.6, 0.1, Math.sin(yaw) * 0.5 - Math.cos(yaw) * 0.6));
      this.effects.burst(hand, { count: 1, color: 'ice', speed: 2, size: 0.025, life: 0.35 });
    }
    this.weapons.update(dt);
    this.skills.update(dt);
    for (const b of this.bots) b.update(dt);
    for (const r of Object.values(this.remotes)) r.update(dt);
    this.net?.update(dt);
    // players that never showed up (or vanished without a clean exit) count as gone after 10 s
    if (this.net && !this.over && (this._presT = (this._presT || 0) + dt) > 2) {
      this._presT = 0;
      if (serverNow() > this.startAt + 10000) for (const uid of Object.keys(this.remotes)) if (!this.net.present.has(uid)) this.onPlayerLeft(uid);
    }
    this.updatePickups(dt);
    this.effects.update(dt);
    this.world.update(dt, this.camera.position);
    this.hud.update(dt);
    this.touch?.update();
  }

  /* ================= online match (duel / duo / squad) ================= */
  get frozen() { return !!this.net && serverNow() < this.startAt; }

  /** open floor spot near (x, z) — same result on every client (world is deterministic) */
  freeSpot(x, z) {
    const blocked = (px, pz) => this.world.colliders.some((b) => b.max.y > 0.3 && b.max.y < 90 &&
      px > b.min.x - 0.8 && px < b.max.x + 0.8 && pz > b.min.z - 0.8 && pz < b.max.z + 0.8);
    for (let r = 0; r < 14; r += 0.75) {
      for (let a = 0; a < 12; a++) {
        const px = x + Math.cos((a / 12) * Math.PI * 2) * r, pz = z + Math.sin((a / 12) * Math.PI * 2) * r;
        if (!blocked(px, pz)) return new THREE.Vector3(px, 0, pz);
        if (r === 0) break;
      }
    }
    return new THREE.Vector3(x, 0, z);
  }

  /** team A starts in the south, team B in the north; slot spreads team mates sideways */
  teamSpawn(team, slot = 0) {
    const off = [0, 2.6, -2.6, 5.2, -5.2][slot % 5] + (this.player.alive ? 0 : (Math.random() - 0.5) * 6);
    return team === 'A'
      ? { pos: this.freeSpot(off, 76), yaw: 0 }
      : { pos: this.freeSpot(-off, -72), yaw: Math.PI };
  }

  respawnPlayer() {
    const sp = this.teamSpawn(this.myTeam, this.net.me.slot);
    this.player.spawn(sp.pos, sp.yaw);
    this.weapons.refill();
    this.skills.cancelCharge();
    if (this.skills.invisT > 0) this.skills.endInvis();
    this.respawnAt = 0;
    $('death').classList.add('hidden');
    this.effects.puff(sp.pos.clone().setY(1), '#bfe9ff', 1.6, 0.5, 0.6);
  }

  onNetHit(v) {
    if (!this.player.alive || this.frozen || this.over) return;
    const from = this.net.players[v.from];
    this.player.applyDamage(v.dmg, {
      killer: from?.name || '상대', weapon: v.weapon, fromPos: new THREE.Vector3(v.x, 1, v.z), killerUid: v.from, headshot: v.head,
    });
  }

  onNetEffect(v) {
    if (!this.player.alive) return;
    if (v.kind === 'slow' || v.kind === 'stun') this.player.slowT = Math.max(this.player.slowT, v.dur || 1);
    else if (v.kind === 'glitch') this.player.applyGlitch(v.dur || 1);
  }

  onNetFeed(v) {
    const mine = v.killer === this.net.uid;
    const name = (uid, n) => (uid === this.net.uid ? `<span class="me">${n}</span>` : n);
    this.hud.killfeed(`${name(v.killer, v.killerName)}<span class="w">${v.weapon}${v.head ? ' <span class="hs">◎ 헤드샷</span>' : ''}</span>${name(v.victim, v.victimName)}`);
    if (!mine) return;
    this.kills++;
    if (v.head) this.headshots++;
    this.coinsEarned += COIN_PER_KILL;
    this.skills.onKill();
    const rp = this.remotes[v.victim];
    if (rp) {
      const skin = this.weapons.slot.skin;
      if (skin) this.effects.killFx(skin, rp.position.clone());
      this.spawnAmmo(rp.position);
    }
  }

  onNetScore(score) { this.score = score; }

  onNetFx(d) {
    if (!d) return;
    const V = (o) => new THREE.Vector3(o.x, o.y, o.z);
    const s = this.skills;
    if (d.k === 'wall') s.buildIceWall(V(d), d.ax, true);
    else if (d.k === 'frost') s.createFrostZone(V(d), d.p, true);
    else if (d.k === 'fire') s.createFireZone(V(d), { ...d.o, visual: true });
    else if (d.k === 'boom') {
      this.effects.explosion(V(d), d.c, d.s);
      this.effects.burst(V(d), { count: 20, color: d.c, speed: 8, size: 0.06, life: 0.6 });
      audio.skill('boom', this.player.position.distanceTo(V(d)));
    } else if (d.k === 'zap') {
      this.effects.lightning(V(d.a), V(d.b), d.c || '#8ff7ff', 0.03);
      audio.skill('zap', this.player.position.distanceTo(V(d.a)));
    } else if (d.k === 'ring') this.effects.ring(V(d), d.c, d.r, 0.6, 0.15);
    else if (d.k === 'laser') s.remoteLaser(d);
    else if (d.k === 'steam') s.createSteam(V(d), true);
    else if (d.k === 'ink') s.createInk(V(d), { ...d.o, visual: true });
  }

  onPlayerLeft(uid) {
    const rp = this.remotes[uid];
    if (!rp || rp.gone) return;
    rp.gone = true;
    rp.alive = false;
    rp.model.group.visible = false;
    this.hud.msg(`${rp.name} 님이 나갔습니다`, 2.5);
    // nobody left on the other team → we win
    const enemiesLeft = Object.values(this.remotes).some((r) => r.enemy && !r.gone);
    if (!enemiesLeft && !this.over) this.net.endMatch({ winner: this.myTeam, reason: 'left' });
  }

  scoreText() {
    const s = this.score || { A: 0, B: 0 }, my = this.myTeam, other = my === 'A' ? 'B' : 'A';
    const label = this.mode === 'duel' ? ['나', Object.values(this.remotes)[0]?.name || '상대'] : ['우리 팀', '상대 팀'];
    return `${label[0]} ${s[my] || 0} : ${s[other] || 0} ${label[1]} · ${this.net.target}킬 선승`;
  }

  finishNet(result) {
    if (this.over) return;
    this.over = true;
    const win = result.winner === this.myTeam;
    if (win) this.coinsEarned += COIN_WIN;
    save.coins += this.coinsEarned;
    persist();
    document.exitPointerLock?.();
    this.weapons.trigger = false;
    $('death').classList.add('hidden');
    $('pause').classList.add('hidden');
    $('result-title').textContent = win ? '승리!' : '패배';
    $('result-title').style.color = win ? '#7dffb0' : '#ff5a64';
    const s = this.score || {}, my = this.myTeam, other = my === 'A' ? 'B' : 'A';
    $('result-body').innerHTML = `
      ${result.reason === 'left' ? (win ? '상대가 모두 나가서 승리했습니다.' : '경기가 종료되었습니다.') : win ? '상대를 제압했습니다!' : '상대 팀이 먼저 목표 처치 수에 도달했습니다.'}<br>
      점수 <b>${s[my] || 0} : ${s[other] || 0}</b><br>
      내 처치 <b>${this.kills}</b> · 헤드샷 <b>${this.headshots}</b><br>
      획득 코인 <span class="coin">◆ ${this.coinsEarned.toLocaleString()}</span>`;
    $('result').classList.remove('hidden');
    $('result-again').textContent = '대기실로';
    $('result-exit').textContent = '방 나가기';
    $('result-again').onclick = () => this.onExit('lobby');
    $('result-exit').onclick = () => this.onExit('leave');
  }


  render() {
    this.renderer.render(this.scene, this.camera);
    this.weapons.render(this.renderer);
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.weapons.resize();
  }
}
