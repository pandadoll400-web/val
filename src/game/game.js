import * as THREE from 'three';
import { IceCanyonWorld } from '../world/iceCanyon.js';
import { Player } from './player.js';
import { WeaponSystem } from './weapons.js';
import { Effects } from './effects.js';
import { SkillSystem } from './skills.js';
import { HUD } from './hud.js';
import { AIBot, DIFFS } from './bots.js';
import { save, persist } from '../save.js';
import { getCharacter } from '../data/characters.js';
import { audio } from '../audio.js';
import { RemotePlayer } from './remotePlayer.js';
import { IS_TOUCH, TouchControls } from './touch.js';
import { serverNow } from '../net/firebase.js';
import { MODE_NAMES, ROUND_TIME, OVERTIME, CAPTURE_TIME, DOM_TIME } from '../net/room.js';
import { setZoneVisual } from '../world/maps.js';
import { getTheme, randomMap } from '../world/themes.js';
import { getPortrait } from '../menu/ui.js';
import { currentUser } from '../net/auth.js';

const $ = (id) => document.getElementById(id);
export const ENEMY_COUNT = 7;
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
    this.roundN = 0;
    this.roundStart = this.startAt;
    this.resetAt = 0;
    this.dom = !!net && mode === 'dom';
    this.zoneState = null; // domination: [{ o: owner, c: capturing team, p: seconds }]
    this.respawnAt = 0;
    this.deaths = 0;
    this.assists = 0;
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
    this.diff = DIFFS[save.soloDiff] || DIFFS.normal; // solo difficulty
    // the "hack" account: double-tap jump to fly, every hit counts as a headshot
    this.hack = (currentUser()?.nick || '').toLowerCase() === 'hack';

    this.mapId = net?.meta.map || window.__forceMap || randomMap(); // __forceMap: test hook
    this.mapName = getTheme(this.mapId).name;
    this.world = new IceCanyonWorld(this.scene, renderer, mode === 'training' ? 'range' : 'arena', this.mapId);
    this.effects = new Effects(this);
    this.player = new Player(this);
    this.skills = new SkillSystem(this);
    this.weapons = new WeaponSystem(this);
    this.hud = new HUD(this);
    this.touch = IS_TOUCH ? new TouchControls(this) : null;

    this.bots = net ? net.myBots.map((uid, i) => {
      const pr = net.players[uid], sp = this.teamSpawn(pr.team, pr.slot);
      const b = new AIBot(this, sp.pos, i, { net: { uid, team: pr.team, name: pr.name, char: pr.char } });
      b.yaw = sp.yaw; b.slot = pr.slot;
      return b;
    }) : mode === 'training'
      ? this.world.targetSpots.map((p, i) => new AIBot(this, p, i, { passive: true }))
      : this.world.enemySpawns(this.diff.count).map((p, i) => new AIBot(this, p, i, { diff: save.soloDiff }));
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
    const out = this.bots.filter((b) => b.alive && (!this.net || b.team !== this.myTeam));
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
    if (this.dom) this.hud.msg(`${this.mapName} · 점령전 — 구역에 ${CAPTURE_TIME}초 서 있으면 점령 · 구역 2개를 먼저 차지하면 승리!`, 4);
    else if (this.net) this.hud.msg(`${this.mapName} · ${MODE_NAMES[this.mode]} — 상대를 모두 쓰러뜨리면 라운드 승리 · ${this.net.target}점 먼저!`, 3.5);
    else this.hud.msg(this.mode === 'training' ? `${this.mapName} 훈련장 — 표적은 움직이거나 공격하지 않습니다 · Esc로 나가기` : `${this.mapName} · 난이도 ${this.diff.name} — 적 ${this.totalEnemies}명을 모두 처치하라!`, 3.5);
    this.lock();
  }

  lock() {
    if (IS_TOUCH) return; // phones: no pointer lock, the touch overlay drives the camera
    const p = this.renderer.domElement.requestPointerLock?.();
    if (p && p.catch) p.catch(() => {});
  }

  dispose() {
    this.disposed = true;
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
    if (this.net) { this.onNetBotKilled(bot, info); return; }
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
    if (left > 0 && left <= 3 && !this.huntAll) {
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
            if (s.mag + s.reserve < s.def.mag + s.def.reserve) { if (s.mag === 0 && w.throwT < 0) s.mag = 1; else s.reserve++; parts.push(`${s.def.name} +1`); }
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
    // Bloom: a planted life tree brings me back instead
    if (this.skills.tryBloomRevive()) {
      $('death').classList.remove('hidden');
      $('death-by').textContent = `${info.killer || '적'}에게 쓰러졌지만…`;
      $('death-timer').textContent = '꽃나무에서 되살아나는 중';
      return;
    }
    if (this.net) {
      this.hud.killfeed(`${info.killer || '상대'}<span class="w">${info.weapon || ''}</span><span class="me">${this.myName}</span>`);
      $('death').classList.remove('hidden');
      $('death-by').textContent = `${info.killer || '상대'}에게 처치당했습니다`;
      if (this.dom) this.respawnAt = this.time + 3;
      else $('death-timer').textContent = '살아남은 팀원이 싸우는 중 — 라운드가 끝나면 모두 시작 위치에서 다시 시작합니다';
      this.deaths++;
      this.net.pushStats(this.kills, this.deaths, this.assists);
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
    if (this.net && !this.over) { if (this.dom) this.updateDom(dt); else this.updateRound(dt); }
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
    if (!frozen) for (const b of this.bots) b.update(dt);
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
  get frozen() { return !!this.net && (this.dom ? serverNow() < this.startAt : serverNow() < this.roundStart || this.resetAt > 0); }

  /** the person with the smallest id among those still here decides rounds / zones */
  get isJudge() { return this.net.humans.filter((u) => u === this.net.uid || this.net.present.has(u)).sort()[0] === this.net.uid; }

  /* ================= domination (campsite, 3 zones, unlimited respawns) ================= */
  updateDom(dt) {
    // my respawn 3 s after death at the team base
    if (!this.player.alive && this.respawnAt) {
      const left = this.respawnAt - this.time;
      $('death-timer').textContent = left > 0 ? `${Math.ceil(left)}초 후 기지에서 부활` : '';
      if (left <= 0) this.respawnPlayer();
    }
    // AI I simulate respawn the same way
    for (const b of this.bots) {
      if (b.alive) { b._deadT = 0; continue; }
      b._deadT = (b._deadT || 0) + dt;
      if (b._deadT > 3) { b._deadT = 0; this.respawnBot(b); }
    }
    const zones = this.world.zones;
    if (!zones.length || this.frozen) return;
    const st = this.zoneState ||= zones.map(() => ({ o: '', c: '', p: 0 }));
    // flags + rings follow the (published) state on every screen
    for (let i = 0; i < zones.length; i++) {
      const s = st[i], own = s.o ? this.teamColor(s.o) : '#f2f2f2';
      setZoneVisual(zones[i], own, s.c ? this.teamColor(s.c) : own, s.p / CAPTURE_TIME);
    }
    if (!this.isJudge) return;
    // who is standing in each zone (alive only)
    const people = [];
    if (this.player.alive) people.push([this.player.position, this.myTeam]);
    for (const r of Object.values(this.remotes)) if (r.alive && !r.gone && r.model.group.visible) people.push([r.position, r.team]);
    for (const b of this.bots) if (b.alive) people.push([b.position, b.team]);
    for (let i = 0; i < zones.length; i++) {
      const z = zones[i], s = st[i];
      const inside = new Set(people.filter(([p]) => Math.hypot(p.x - z.x, p.z - z.z) < z.r && p.y < 3).map(([, t]) => t));
      if (inside.size === 1) {
        const t = [...inside][0];
        if (s.o === t) { if (s.p > 0) { s.p = Math.max(0, s.p - dt * 2); if (!s.p) s.c = ''; } }
        else {
          if (!s.c || s.p <= 0) s.c = t;
          if (s.c === t) {
            s.p += dt;
            if (s.p >= CAPTURE_TIME) { s.o = t; s.c = ''; s.p = 0; }
          } else s.p = Math.max(0, s.p - dt); // knock the other team's progress down first
        }
      } else if (inside.size === 0 && s.p > 0) { s.p = Math.max(0, s.p - dt * 0.5); if (!s.p) s.c = ''; }
    }
    const count = { A: 0, B: 0 };
    for (const s of st) if (s.o) count[s.o] = (count[s.o] || 0) + 1;
    this._zoneSend = (this._zoneSend || 0) + dt;
    if (this._zoneSend > 0.25) { this._zoneSend = 0; this.net.writeZones(st.map((s) => ({ o: s.o, c: s.c, p: Math.round(s.p * 10) / 10 }))); }
    const win = Object.keys(count).find((t) => count[t] >= 2);
    if (win) { this.net.writeZones(st); this.net.endMatch({ winner: win, reason: 'zones' }); return; }
    if (serverNow() > this.startAt + DOM_TIME * 1000) {
      const w = count.A > count.B ? 'A' : count.B > count.A ? 'B' : null;
      this.net.endMatch({ winner: w, reason: 'time' });
    }
  }

  teamColor(t) { return t === this.myTeam ? '#ffc21f' : '#8a4dff'; }

  onNetZones(z) {
    if (!Array.isArray(z)) return;
    const prev = this.zoneState;
    if (prev && !this.isJudge) for (let i = 0; i < z.length; i++) Object.assign(prev[i], z[i]);
    else if (!prev) this.zoneState = z.map((s) => ({ ...s }));
    const st = this.zoneState;
    // announcements when a zone changes hands
    const owners = st.map((s) => s.o || '');
    if (this._owners) owners.forEach((o, i) => {
      if (o && o !== this._owners[i]) {
        const id = this.world.zones[i]?.id || '?';
        this.hud.msg(o === this.myTeam ? `${id} 구역 점령!` : `상대가 ${id} 구역을 점령했습니다`, 2);
        audio.skill(o === this.myTeam ? 'absorb' : 'boom');
      }
    });
    this._owners = owners;
    this.score = { A: 0, B: 0 };
    for (const o of owners) if (o) this.score[o]++;
    this.hud.updateZones?.(st);
  }

  respawnBot(b) {
    const sp = this.teamSpawn(b.team, b.slot);
    b.home.copy(sp.pos);
    b.yaw = sp.yaw;
    b.slowT = b.stunT = b.glitchSlowT = b.weakT = b.blindT = 0;
    b.state = this.dom ? 'patrol' : 'hunt'; b.canSee = false; b.seenT = 0; b.target = null;
    b.vel.set(0, 0, 0);
    b.model.group.rotation.set(0, b.yaw, 0);
    b.respawn();
    if (this.dom) b.waypoint = b.randomPoint();
  }

  /** where an AI goes in domination: the closest zone its team does not own yet */
  zoneTargetFor(team, from) {
    const zs = this.world.zones, st = this.zoneState;
    let best = null, bd = 1e9;
    zs.forEach((z, i) => {
      if (st && st[i]?.o === team) return;
      const d = from ? Math.hypot(from.x - z.x, from.z - z.z) : 0;
      if (d < bd) { bd = d; best = z; }
    });
    best ||= zs[Math.floor(Math.random() * zs.length)];
    return new THREE.Vector3(best.x + (Math.random() - 0.5) * 5, 0, best.z + (Math.random() - 0.5) * 5);
  }

  /** seconds left in the round (overtime: negative phase handled by the HUD) */
  roundClock() {
    if (this.dom) return { left: Math.max(0, DOM_TIME - Math.max(0, serverNow() - this.startAt) / 1000), ot: false };
    const t = (serverNow() - this.roundStart) / 1000;
    if (t < 0) return { left: ROUND_TIME, ot: false, pre: true };
    if (t < ROUND_TIME) return { left: ROUND_TIME - t, ot: false };
    return { left: Math.max(0, ROUND_TIME + OVERTIME - t), ot: true };
  }

  /** round timer: 1:30 + 30 s overtime; then the side with more health takes the round */
  updateRound(dt = 0) {
    if (this.resetAt && this.time >= this.resetAt) { this.resetAt = 0; this.resetRound(); }
    if (this.frozen) return;
    // last team standing wins the round (judge decides, after a short grace for network lag)
    const alive = {};
    let humans = 0;
    if (this.player.alive || this.skills.reviving) { alive[this.myTeam] = 1; humans++; }
    for (const [u, r] of Object.entries(this.remotes)) if (!r.gone && (r.alive || r.reviving)) { alive[r.team] = 1; if (!this.net.players[u]?.bot) humans++; }
    for (const b of this.bots) if (b.alive) alive[b.team] = 1;
    const standing = Object.keys(alive);
    // no person left alive (only AI) → no waiting: decide right away by the health left
    const allDown = humans === 0 && standing.length > 1;
    const me = this.player.alive || this.skills.reviving;
    if (!me && !this.dom) $('death-timer').textContent = humans > 0 ? '살아남은 사람이 싸우는 중 — 라운드가 끝나면 모두 다시 시작합니다' : '곧 다음 판이 시작됩니다';
    if (standing.length <= 1 || allDown) {
      this._standT = (this._standT || 0) + dt;
      if (this._standT > 0.6 && this._decided !== this.roundN && this.isJudge) {
        this._decided = this.roundN;
        if (allDown) { const win = this.hpWinner(); this.net.winRound(win, { reason: win ? 'down' : 'draw' }); }
        else this.net.winRound(standing[0] || null, { reason: standing.length ? 'survive' : 'draw' });
      }
      return;
    }
    this._standT = 0;
    const c = this.roundClock();
    if (c.ot && !this._otShown) { this._otShown = true; this.hud.msg('연장전! 30초 안에 결판을 내세요', 2.2); }
    if (c.ot && c.left <= 0 && this._decided !== this.roundN) {
      // the person with the smallest id decides (everyone sees the same health numbers)
      if (!this.isJudge) return;
      this._decided = this.roundN;
      const win = this.hpWinner();
      this.net.winRound(win, { reason: win ? 'hp' : 'draw' });
    }
  }

  /** team with the most health left among the living (null = tie) */
  hpWinner() {
    const hp = {};
    const add = (team, v) => { hp[team] = (hp[team] || 0) + Math.max(0, v); };
    add(this.myTeam, this.player.alive ? this.player.hp : 0);
    for (const r of Object.values(this.remotes)) if (!r.gone) add(r.team, r.alive ? r.hp : 0);
    for (const b of this.bots) add(b.team, b.alive ? b.hp : 0);
    const sorted = Object.entries(hp).sort((a, b) => b[1] - a[1]);
    return sorted.length > 1 && sorted[0][1] > sorted[1][1] ? sorted[0][0] : null;
  }

  /** a new round from the network: freeze, then everybody back to the start positions */
  onNetRound(r) {
    this.score = { ...(r.score || {}) };
    if (r.n === this.roundN) { this.roundStart = r.startAt; return; }
    this.roundN = r.n;
    this.roundStart = r.startAt;
    this._otShown = false;
    if (this.over) return;
    const L = r.last || {};
    const mine = L.team && L.team === this.myTeam;
    const txt = L.reason === 'survive' ? (mine ? '우리 팀이 끝까지 살아남았습니다' : '상대가 끝까지 살아남았습니다')
      : L.reason === 'down' ? '모두 쓰러짐 — 남은 체력으로 판정'
      : L.reason === 'hp' ?'시간 종료 — 체력이 더 많은 쪽이 승리' : L.reason === 'draw' && !L.team ? '무승부 (점수 없음)' : '시간 종료 — 무승부 (점수 없음)';
    if (!r.over) this.hud.msg(`${L.team ? (mine ? '라운드 승리!' : '라운드 패배') : '무승부'} · ${txt}`, 2.2);
    this.weapons.trigger = false;
    this.resetAt = this.time + 1.3;
  }

  resetRound() {
    if (this.over) return;
    this.respawnPlayer();
    for (const b of this.bots) this.respawnBot(b);
    this.skills.onRoundReset?.();
  }

  /** one of the AI players I simulate died */
  onNetBotKilled(bot, info) {
    const killerUid = info.killerUid || (info.from === 'player' || !info.from ? this.net.uid : '');
    bot.d = (bot.d || 0) + 1;
    this.net.pushStatsFor(bot.uid, bot.k || 0, bot.d, 0);
    if (killerUid === this.net.uid && info.skin) this.effects.killFx(info.skin, bot.position.clone());
    this.net.reportDeath(killerUid, info.weapon, info.headshot, bot.uid);
  }

  /** open floor spot near (x, z) — same result on every client (world is deterministic) */
  freeSpot(x, z) {
    const blocked = (px, pz) => this.world.blockedAt(px, pz, 0.8) || this.world.inWater(px, pz);
    for (let r = 0; r < 14; r += 0.75) {
      for (let a = 0; a < 12; a++) {
        const px = x + Math.cos((a / 12) * Math.PI * 2) * r, pz = z + Math.sin((a / 12) * Math.PI * 2) * r;
        if (!blocked(px, pz)) return new THREE.Vector3(px, 0, pz);
        if (r === 0) break;
      }
    }
    return new THREE.Vector3(x, 0, z);
  }

  /** each map defines the start of team A (south), B (north), C (east, free-for-all); slot spreads team mates */
  teamSpawn(team, slot = 0) {
    const S = this.world.teamSpawns, sp = S[team] || (team === 'D' ? [-S.C[0], -S.C[1], -S.C[2]] : S.A);
    const off = [0, 2.6, -2.6, 5.2, -5.2][slot % 5];
    const yaw = sp[2];
    // sideways = perpendicular to the facing direction
    const sx = Math.cos(yaw), sz = -Math.sin(yaw);
    return { pos: this.freeSpot(sp[0] + sx * off, sp[1] + sz * off), yaw };
  }

  respawnPlayer() {
    const sp = this.teamSpawn(this.myTeam, this.net.me.slot);
    this.player.spawn(sp.pos, sp.yaw);
    this.weapons.refill();
    this.skills.cancelCharge();
    if (this.skills.invisT > 0) this.skills.endInvis();
    this.respawnAt = 0;
    this.player.hp = this.player.maxHp;
    $('death').classList.add('hidden');
    this.effects.puff(sp.pos.clone().setY(1), '#bfe9ff', 1.6, 0.5, 0.6);
  }

  onNetHit(v) {
    if (!this.player.alive || this.frozen || this.over) return;
    const from = this.net.players[v.from];
    this.player.applyDamage(v.dmg, {
      killer: from?.name || '상대', weapon: v.weapon, fromPos: new THREE.Vector3(v.x, 1, v.z), killerUid: v.from, headshot: v.head, melee: !!v.melee,
    });
  }

  onNetEffect(v) {
    if (!this.player.alive) return;
    if (v.kind === 'slow' || v.kind === 'stun') this.player.slowT = Math.max(this.player.slowT, v.dur || 1);
    else if (v.kind === 'glitch') this.player.applyGlitch(v.dur || 1);
    else if (v.kind === 'bloom') this.skills.applyBloomSeed(v.dur | 0);
    else if (v.kind === 'silence') this.skills.silence(v.dur || 10);
    else if (v.kind === 'root') { this.player.rootT = Math.max(this.player.rootT, v.dur || 2.5); this.hud.msg('체인에 묶였습니다!', 1.2); }
  }

  onNetFeed(v) {
    this.net.creditBot(v.killer);
    const mine = v.killer === this.net.uid;
    const name = (uid, n) => (uid === this.net.uid ? `<span class="me">${n}</span>` : n);
    this.hud.killfeed(`${name(v.killer, v.killerName)}<span class="w">${v.weapon}${v.head ? ' <span class="hs">◎ 헤드샷</span>' : ''}</span>${name(v.victim, v.victimName)}`);
    if (!mine) {
      // assist: I hurt the victim in the last 8 s but someone else got the kill
      const vr = this.remotes[v.victim];
      if (vr && vr._hitAt && performance.now() - vr._hitAt < 8000 && v.victim !== this.net.uid) {
        this.assists++;
        vr._hitAt = 0;
        this.hud.msg('어시스트!', 1);
        this.net.pushStats(this.kills, this.deaths, this.assists);
      }
      return;
    }
    this.kills++;
    this.net.pushStats(this.kills, this.deaths, this.assists);
    if (v.head) this.headshots++;
    this.coinsEarned += COIN_PER_KILL;
    this.skills.onKill();
    const rp = this.remotes[v.victim];
    if (rp) {
      const skin = this.weapons.slot.skin;
      if (skin) this.effects.killFx(skin, rp.position.clone());
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
    else if (d.k === 'steam') s.createSteam(V(d), true, d.o || {});
    else if (d.k === 'ink') s.createInk(V(d), { ...d.o, visual: true });
    else if (d.k === 'bloom') s.remoteTree(d.from || 'x', d);
    else if (d.k === 'bloomEnd') s.remoteTree(d.from || 'x', null);
    else if (d.k === 'chain') { this.effects.chain(V(d.a), V(d.b)); audio.skill('rock', this.player.position.distanceTo(V(d.a))); }
  }

  onPlayerLeft(uid) {
    const rp = this.remotes[uid];
    if (!rp || rp.gone) return;
    rp.gone = true;
    rp.alive = false;
    rp.model.group.visible = false;
    this.hud.msg(`${rp.name} 님이 나갔습니다`, 2.5);
    // nobody left on the other team → we win
    const enemiesLeft = Object.values(this.remotes).some((r) => r.enemy && !r.gone) || this.bots.some((b) => b.team !== this.myTeam);
    if (!enemiesLeft && !this.over) this.net.endMatch({ winner: this.myTeam, reason: 'left' });
  }

  /** K / D / A table for every player of the match, my team first */
  statsTable() {
    const net = this.net, st = { ...net.stats, [net.uid]: { k: this.kills, d: this.deaths, a: this.assists } };
    const rows = Object.entries(net.players).map(([uid, p]) => ({ uid, p, s: st[uid] || { k: 0, d: 0, a: 0 } }));
    const best = Math.max(...rows.map((r) => r.s.k));
    const team = (t) => rows.filter((r) => r.p.team === t).sort((a, b) => b.s.k - a.s.k || a.s.d - b.s.d).map((r) => {
      const c = getCharacter(r.p.char), face = getPortrait(c);
      return `<tr class="${r.uid === net.uid ? 'me' : ''}">
        <td class="kp">${face ? `<img src="${face}" alt="">` : ''}<span>${r.s.k === best && best > 0 ? '★ ' : ''}${r.p.name}<small>${c.name}</small></span></td>
        <td>${r.s.k}</td><td>${r.s.d}</td><td>${r.s.a}</td></tr>`;
    }).join('');
    const my = this.myTeam, others = [...new Set(rows.map((r) => r.p.team))].filter((t) => t !== my).sort();
    return `<table class="kda">
      <thead><tr><th>플레이어</th><th>킬</th><th>데스</th><th>어시</th></tr></thead>
      <tbody class="ally">${team(my)}</tbody>${others.map((t) => `<tbody class="enemy">${team(t)}</tbody>`).join('')}</table>`;
  }

  onNetStats() {
    if (this.over && !document.getElementById('result').classList.contains('hidden')) {
      const t = document.querySelector('#result-body table.kda');
      if (t) t.outerHTML = this.statsTable();
    }
  }

  scoreText() {
    const s = this.score || { A: 0, B: 0 }, my = this.myTeam, other = my === 'A' ? 'B' : 'A';
    const label = this.mode === 'duel' ? ['나', Object.values(this.remotes)[0]?.name || '상대'] : ['우리 팀', '상대 팀'];
    return `${label[0]} ${s[my] || 0} : ${s[other] || 0} ${label[1]} · ${this.net.target}킬 선승 · K/D/A ${this.kills}/${this.deaths}/${this.assists}`;
  }

  finishNet(result) {
    if (this.over) return;
    this.over = true;
    const win = result.winner === this.myTeam, draw = !result.winner;
    if (win) this.coinsEarned += COIN_WIN;
    save.coins += this.coinsEarned;
    persist();
    document.exitPointerLock?.();
    this.weapons.trigger = false;
    $('death').classList.add('hidden');
    $('pause').classList.add('hidden');
    $('result-title').textContent = draw ? '무승부' : win ? '승리!' : '패배';
    $('result-title').style.color = draw ? '#ffd36b' : win ? '#7dffb0' : '#ff5a64';
    const s = this.score || {}, my = this.myTeam;
    const otherScores = Object.keys(s).filter((t) => t !== my).sort().map((t) => s[t] || 0).join(' : ');
    $('result-body').innerHTML = `
      ${result.reason === 'zones' ? (win ? '구역 2개를 먼저 점령했습니다!' : '상대가 구역 2개를 먼저 점령했습니다.') : result.reason === 'time' ? (draw ? '시간 종료 — 점령한 구역 수가 같습니다.' : win ? '시간 종료 — 더 많은 구역을 점령했습니다!' : '시간 종료 — 상대가 더 많은 구역을 점령했습니다.') : result.reason === 'left' ? (win ? '상대가 모두 나가서 승리했습니다.' : '경기가 종료되었습니다.') : win ? `${this.net.target}점을 먼저 따냈습니다!` : `상대가 먼저 ${this.net.target}점을 따냈습니다.`}<br>
      점수 <b>${s[my] || 0} : ${otherScores || 0}</b><br>
      획득 코인 <span class="coin">◆ ${this.coinsEarned.toLocaleString()}</span>
      ${this.statsTable()}`;
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
