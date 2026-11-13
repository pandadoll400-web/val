import * as THREE from 'three';
import {
  getDb, ref, set, get, push, remove, onValue, onChildAdded, onChildChanged, onChildRemoved, off,
  onDisconnect, runTransaction, serverNow,
} from './firebase.js';
import { F_CROUCH, F_SLIDE, F_INVIS, F_ALIVE, F_GROUND, F_SPRINT, F_SHIELD } from '../game/remotePlayer.js';
import { audio } from '../audio.js';
import { WEAPONS } from '../data/weapons.js';

const SEND_MS = 50; // my position / view: 20 times a second, never more
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;

/**
 * Networking for one online match at matches/{id} (2 to 8 human players, teams A / B).
 *  live/{uid}  my state every 50 ms            (removed on disconnect)
 *  here/{uid}  presence                        (removed on disconnect)
 *  ev/{uid}/…  my inbox: hit / eff / fx / feed (I delete what I read)
 *  score/{A|B} team kills (transaction by the victim) · meta.state = ended when a team reaches the target
 * Shots are resolved on the shooter's screen; only hits are sent, and the victim applies the damage.
 */
export class NetSession {
  constructor(matchId, uid, match) {
    this.id = matchId;
    this.uid = uid;
    this.meta = match.meta;
    this.mode = match.meta.mode;
    this.target = match.meta.target;
    this.players = match.players; // uid → { name, char, loadout, skins, team, slot, party }
    this.me = this.players[uid];
    this.myTeam = this.me.team;
    this.sendAcc = 0;
    this.sent = 0;
    this.received = 0;
    this.shotSeq = 0;
    this.tracerEnd = null;
    this.score = { A: 0, B: 0 };
    this.ended = false;
    this.present = new Set();
    this.listeners = [];
    this.game = null;
  }

  static async load(matchId) {
    const m = (await get(ref(getDb(), `matches/${matchId}`))).val();
    if (!m || !m.players) throw new Error('매치 정보를 찾을 수 없습니다');
    return m;
  }

  r(path) { return ref(getDb(), `matches/${this.id}/${path}`); }
  get others() { return Object.keys(this.players).filter((u) => u !== this.uid); }

  attach(game) {
    this.game = game;
    const track = (rf) => { this.listeners.push(rf); return rf; };
    const live = track(this.r('live'));
    const onLive = (s) => { if (s.key === this.uid) return; const v = s.val(); if (v) { this.received++; game.remotes[s.key]?.push(v); } };
    onChildAdded(live, onLive);
    onChildChanged(live, onLive);
    onChildAdded(track(this.r(`ev/${this.uid}`)), (s) => this.onEvent(s));
    onValue(track(this.r('score')), (s) => { this.score = { A: 0, B: 0, ...(s.val() || {}) }; game.onNetScore?.(this.score); });
    onValue(track(this.r('meta')), (s) => {
      const m = s.val();
      if (m) this.meta = m;
      if (m && m.state === 'ended' && !this.ended) { this.ended = true; game.finishNet?.(m.result || {}); }
    });
    const here = track(this.r('here'));
    onChildAdded(here, (s) => { this.present.add(s.key); });
    onChildRemoved(here, (s) => {
      this.present.delete(s.key);
      if (s.key !== this.uid) game.onPlayerLeft?.(s.key);
    });
    // presence + auto-cleanup on disconnect
    const meHere = this.r(`here/${this.uid}`), meLive = this.r(`live/${this.uid}`);
    onDisconnect(meHere).remove();
    onDisconnect(meLive).remove();
    set(meHere, true);
  }

  dispose() {
    for (const rf of this.listeners) off(rf);
    this.listeners = [];
    // last one out (or the match is over and nobody else is here) deletes the whole match
    const others = [...this.present].filter((u) => u !== this.uid).length;
    if (others === 0) { remove(ref(getDb(), `matches/${this.id}`)).catch(() => {}); return; }
    remove(this.r(`live/${this.uid}`)).catch(() => {});
    remove(this.r(`here/${this.uid}`)).catch(() => {});
  }

  /* ---------------- per frame: send my state at most every 50 ms ---------------- */
  update(dt) {
    this.sendAcc += dt * 1000;
    if (this.sendAcc >= SEND_MS) {
      this.sendAcc = Math.min(this.sendAcc - SEND_MS, SEND_MS); // never burst to catch up
      this.sendState();
    }
  }

  sendState() {
    const g = this.game, p = g.player;
    let f = 0;
    if (p.crouching) f |= F_CROUCH;
    if (p.sliding) f |= F_SLIDE;
    if (p.invisible) f |= F_INVIS;
    if (p.alive) f |= F_ALIVE;
    if (p.onGround) f |= F_GROUND;
    if (p.sprinting) f |= F_SPRINT;
    if (p.shieldT > 0) f |= F_SHIELD;
    const t = this.tracerEnd || p.position;
    const data = [r2(p.position.x), r2(p.position.y), r2(p.position.z), r3(p.yaw), r3(p.pitch), g.weapons.def.id, f,
      Math.max(0, Math.round(p.hp)), this.shotSeq, r2(t.x), r2(t.y), r2(t.z), Math.round(serverNow())];
    set(this.r(`live/${this.uid}`), data).catch((e) => g.hud?.msg('네트워크 오류: ' + (e.code || e.message), 2));
    this.sent++;
  }

  /** my weapon fired: shown to the others through shotSeq in the next state packet */
  onLocalShot(tracerEnd) {
    this.shotSeq++;
    this.tracerEnd = tracerEnd ? tracerEnd.clone() : null;
  }

  playRemoteShots(rp, n, tEnd) {
    const g = this.game;
    const from = rp.muzzleWorld();
    const end = new THREE.Vector3(tEnd[0], tEnd[1], tEnd[2]);
    const dist = from.distanceTo(g.player.position);
    const w = WEAPONS[rp.weaponId];
    if (!w || w.kind !== 'gun') return;
    if (end.distanceTo(rp.position) > 1) g.effects.tracer(from, end, w.tracer || '#ffc35a', 0.016, 280);
    g.effects.worldFlash(from, 0.5);
    const kind = { pistol: 'pistol', shotgun: 'shotgun', sniper: 'sniper', dmr: 'sniper' }[rp.weaponId] || 'rifle';
    for (let i = 0; i < Math.min(n, 2); i++) setTimeout(() => audio.shot(kind, dist), i * 60);
  }

  /* ---------------- messages ---------------- */
  send(to, type, data = {}) {
    if (!to || !this.present.has(to) && type !== 'feed') return;
    push(this.r(`ev/${to}`), { from: this.uid, type, ...data }).catch(() => {});
  }

  sendHit(to, dmg, info = {}) {
    const p = this.game.player.position;
    this.send(to, 'hit', { dmg: Math.round(dmg), head: !!info.headshot, weapon: info.weapon || '', x: r2(p.x), z: r2(p.z) });
  }

  sendEffect(to, kind, dur) { this.send(to, 'eff', { kind, dur }); }
  fx(data) { for (const u of this.others) this.send(u, 'fx', { d: data }); }

  onEvent(s) {
    const v = s.val();
    remove(s.ref).catch(() => {});
    if (!v || this.ended) return;
    const g = this.game;
    if (v.type === 'hit') g.onNetHit?.(v);
    else if (v.type === 'eff') g.onNetEffect?.(v);
    else if (v.type === 'fx') g.onNetFx?.(v.d);
    else if (v.type === 'feed') g.onNetFeed?.(v);
  }

  /* ---------------- death → score (the victim reports it) ---------------- */
  async reportDeath(killerUid, weapon, head) {
    const killer = this.players[killerUid];
    const team = killer ? killer.team : (this.myTeam === 'A' ? 'B' : 'A');
    const feed = { killer: killerUid || '', killerName: killer?.name || '?', victim: this.uid, victimName: this.me.name, weapon: weapon || '', head: !!head, team };
    for (const u of this.others) push(this.r(`ev/${u}`), { from: this.uid, type: 'feed', ...feed }).catch(() => {});
    const res = await runTransaction(this.r(`score/${team}`), (n) => (n || 0) + 1);
    const val = res.snapshot.val();
    if (val >= this.target) this.endMatch({ winner: team, reason: 'kills' });
  }

  async endMatch(result) {
    await runTransaction(this.r('meta'), (m) => {
      if (!m || m.state === 'ended') return undefined;
      return { ...m, state: 'ended', result };
    }).catch(() => {});
  }
}
