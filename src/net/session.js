import * as THREE from 'three';
import {
  getDb, ref, set, get, push, remove, onValue, onChildAdded, onChildChanged, onChildRemoved, off,
  onDisconnect, runTransaction, serverNow,
} from './firebase.js';
import { F_CROUCH, F_SLIDE, F_INVIS, F_ALIVE, F_GROUND, F_SPRINT, F_SHIELD, F_GOLEM, F_REVIVE } from '../game/remotePlayer.js';
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
    this.round = { n: 0, startAt: match.meta.startAt, score: {} };
    this.stats = {}; // uid → { k, d, a }
    // AI players simulated on my screen (I created the room)
    this.myBots = Object.keys(this.players).filter((u) => this.players[u].bot && this.players[u].owner === uid);
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
  /** everyone drawn as a RemotePlayer on my screen (not me, not the AI I simulate) */
  get others() { return Object.keys(this.players).filter((u) => u !== this.uid && !this.myBots.includes(u)); }
  /** everyone I send messages to (people and AI owned by someone else) */
  get peers() { return Object.keys(this.players).filter((u) => u !== this.uid && !this.myBots.includes(u)); }
  get humans() { return Object.keys(this.players).filter((u) => !this.players[u].bot); }

  attach(game) {
    this.game = game;
    const track = (rf) => { this.listeners.push(rf); return rf; };
    const live = track(this.r('live'));
    const onLive = (s) => { if (s.key === this.uid) return; const v = s.val(); if (v) { this.received++; game.remotes[s.key]?.push(v); } };
    onChildAdded(live, onLive);
    onChildChanged(live, onLive);
    onChildAdded(track(this.r(`ev/${this.uid}`)), (s) => this.onEvent(s));
    onValue(track(this.r('round')), (s) => {
      const r = s.val();
      if (!r) return;
      this.round = r;
      this.score = { ...(r.score || {}) };
      game.onNetRound?.(r);
    });
    for (const b of this.myBots) onChildAdded(track(this.r(`ev/${b}`)), (s) => this.onBotEvent(b, s));
    if (this.mode === 'dom') onValue(track(this.r('zones')), (s) => game.onNetZones?.(s.val()));
    onValue(track(this.r('stats')), (s) => { this.stats = s.val() || {}; game.onNetStats?.(this.stats); });
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
    for (const b of this.myBots) {
      onDisconnect(this.r(`here/${b}`)).remove();
      onDisconnect(this.r(`live/${b}`)).remove();
      set(this.r(`here/${b}`), true);
    }
  }

  dispose() {
    for (const rf of this.listeners) off(rf);
    this.listeners = [];
    // last one out (or the match is over and nobody else is here) deletes the whole match
    const others = [...this.present].filter((u) => u !== this.uid && !this.myBots.includes(u)).length;
    if (others === 0) { remove(ref(getDb(), `matches/${this.id}`)).catch(() => {}); return; }
    remove(this.r(`live/${this.uid}`)).catch(() => {});
    remove(this.r(`here/${this.uid}`)).catch(() => {});
    for (const b of this.myBots) { remove(this.r(`live/${b}`)).catch(() => {}); remove(this.r(`here/${b}`)).catch(() => {}); }
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
    if (g.skills.golemT > 0) f |= F_GOLEM;
    if (g.skills.reviving) f |= F_REVIVE;
    const t = this.tracerEnd || p.position;
    const data = [r2(p.position.x), r2(p.position.y), r2(p.position.z), r3(p.yaw), r3(p.pitch), g.weapons.def.id, f,
      Math.max(0, Math.round(p.hp)), this.shotSeq, r2(t.x), r2(t.y), r2(t.z), Math.round(serverNow())];
    set(this.r(`live/${this.uid}`), data).catch((e) => g.hud?.msg('네트워크 오류: ' + (e.code || e.message), 2));
    this.sent++;
    // the AI players I simulate
    for (const b of g.bots) {
      if (!b.uid) continue;
      let bf = 0;
      if (b.alive) bf |= F_ALIVE;
      if (b.onGround) bf |= F_GROUND;
      const te = b.tracerEnd || b.position;
      set(this.r(`live/${b.uid}`), [r2(b.position.x), r2(b.position.y), r2(b.position.z), r3(b.yaw), 0, 'rifle', bf,
        Math.max(0, Math.round(b.hp)), b.shotSeq || 0, r2(te.x), r2(te.y), r2(te.z), Math.round(serverNow())]).catch(() => {});
    }
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
  send(to, type, data = {}, from = this.uid) {
    if (!to || !this.present.has(to) && type !== 'feed') return;
    push(this.r(`ev/${to}`), { from, type, ...data }).catch(() => {});
  }

  /** one of my AI players shot a person */
  sendBotHit(bot, to, dmg) {
    this.send(to, 'hit', { dmg: Math.round(dmg), head: false, weapon: '소총', x: r2(bot.position.x), z: r2(bot.position.z) }, bot.uid);
  }

  /** a message for one of my AI players (hit / effect from another screen) */
  onBotEvent(botId, s) {
    const v = s.val();
    remove(s.ref).catch(() => {});
    if (!v || this.ended) return;
    const bot = this.game?.bots.find((b) => b.uid === botId);
    if (!bot || this.game.frozen) return;
    if (v.type === 'hit') bot.applyDamage(v.dmg, { killerUid: v.from, weapon: v.weapon, headshot: v.head, from: 'net' });
    else if (v.type === 'eff') bot.applyEffect(v.kind, v.dur);
  }

  sendHit(to, dmg, info = {}) {
    const p = this.game.player.position;
    this.send(to, 'hit', { dmg: Math.round(dmg), head: !!info.headshot, weapon: info.weapon || '', x: r2(p.x), z: r2(p.z) });
  }

  sendEffect(to, kind, dur) { this.send(to, 'eff', { kind, dur }); }
  fx(data) { for (const u of this.humans) if (u !== this.uid) this.send(u, 'fx', { d: data }); }

  onEvent(s) {
    const v = s.val();
    remove(s.ref).catch(() => {});
    if (!v || this.ended) return;
    const g = this.game;
    if (v.type === 'hit') g.onNetHit?.(v);
    else if (v.type === 'eff') g.onNetEffect?.(v);
    else if (v.type === 'fx') g.onNetFx?.(v.d && { ...v.d, from: v.from });
    else if (v.type === 'feed') g.onNetFeed?.(v);
  }

  /* ---------------- death → round point (the victim's screen reports it) ---------------- */
  async reportDeath(killerUid, weapon, head, victimUid = this.uid) {
    const killer = this.players[killerUid], victim = this.players[victimUid];
    const team = killer && killer.team !== victim.team ? killer.team : null;
    const feed = { killer: killerUid || '', killerName: killer?.name || '?', victim: victimUid, victimName: victim?.name || '?', weapon: weapon || '', head: !!head, team: team || '' };
    for (const u of this.humans) if (u !== this.uid) push(this.r(`ev/${u}`), { from: this.uid, type: 'feed', ...feed }).catch(() => {});
    if (victimUid !== this.uid) this.game.onNetFeed?.(feed); // an AI I simulate died: I see the feed too
    else this.creditBot(killerUid);
    // rounds end when only one team is left standing (decided in game.updateRound)
  }

  /** an AI I simulate got a kill → its K/D/A */
  creditBot(killerUid) {
    if (!this.myBots.includes(killerUid)) return;
    const b = this.game.bots.find((x) => x.uid === killerUid);
    if (!b) return;
    b.k = (b.k || 0) + 1;
    this.pushStatsFor(b.uid, b.k, b.d || 0, 0);
  }

  pushStatsFor(uid, k, d, a) {
    this.stats[uid] = { k, d, a };
    set(this.r(`stats/${uid}`), { k, d, a }).catch(() => {});
  }

  /** round over → point to team (null = no point), next round starts after a short break */
  async winRound(team, last) {
    const n = this.round.n;
    let finalScore = null;
    await runTransaction(this.r('round'), (cur) => {
      if (!cur || cur.n !== n || cur.over) return undefined; // someone already ended this round
      const score = { ...(cur.score || {}) };
      if (team) score[team] = (score[team] || 0) + 1;
      finalScore = score;
      const over = team && score[team] >= this.target;
      return { n: n + 1, startAt: serverNow() + 4500, score, last: { ...last, team: team || '' }, over: !!over };
    }).then((res) => {
      if (res.committed && team && finalScore && finalScore[team] >= this.target) this.endMatch({ winner: team, reason: last.reason });
    }).catch(() => {});
  }

  /** my kills / deaths / assists, shown to everybody on the result screen */
  pushStats(k, d, a) { this.pushStatsFor(this.uid, k, d, a); }

  /** domination: the judge publishes the zone states */
  writeZones(zones) { set(this.r('zones'), zones).catch(() => {}); }

  async endMatch(result) {
    await runTransaction(this.r('meta'), (m) => {
      if (!m || m.state === 'ended') return undefined;
      return { ...m, state: 'ended', result };
    }).catch(() => {});
  }
}
