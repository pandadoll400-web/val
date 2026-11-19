import {
  getDb, ref, set, get, update, remove, push, onValue, onChildAdded, off, onDisconnect, runTransaction,
  myUid, serverNow, watchServerOffset, isPermissionError, serverTimestamp,
} from './firebase.js';
import { XP_PER_LEVEL } from '../data/pass.js';
import { currentUser } from './auth.js';
import { save, outfitFor } from '../save.js';
import { CHARACTERS } from '../data/characters.js';
import { randomMap, THEME_ORDER } from '../world/themes.js';

/** quick chat phrases (room + in game) */
export const QUICK_CHAT = ['좋아요!', '도와줘!', '여기로 와!', '조심해!', '고마워!', 'GG'];
export const cleanChat = (m) => String(m || '').replace(/s+/g, ' ').trim().slice(0, 60);

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1
const randomCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

/** players per team for each online mode (ffa: 3 teams of 1) */
export const TEAM_SIZE = { duel: 1, ffa: 1, team: 2, dom: 2, duo: 2 };
/** room slots (people + AI) per mode */
export const ROOM_SLOTS = { duel: 2, ffa: 3, team: 4, dom: 4, duo: 2 };
/** round wins needed to win the match (one kill = one round) */
export const WIN_KILLS = { duel: 5, ffa: 5, team: 5, dom: 2, duo: 5 };
export const MODE_NAMES = { duel: '듀얼 1대1', ffa: '개인전 1대1대1', team: '팀전 2대2', dom: '점령전 2대2', duo: '듀오 2대2 매칭' };
/** domination: seconds to capture one zone, match time limit */
export const CAPTURE_TIME = 20, DOM_TIME = 360;
export const ROUND_TIME = 90, OVERTIME = 30; // seconds
const MAX_ROOM = 4;
/** online version: everyone in a room must run the same build of the maps / rules (bump when they change) */
export const NET_VER = 11;
const OLD_VER = '게임 버전이 다릅니다 — 둘 다 새로고침(Ctrl+F5)해서 최신 버전으로 맞춘 뒤 다시 들어오세요';
const BOT_NAMES = ['AI 블리자드', 'AI 툰드라', 'AI 글래셔', 'AI 폴라리스', 'AI 아발란체', 'AI 서리발톱', 'AI 눈보라', 'AI 북풍'];

/** the slot list of a room: people (by join time) then AI bots, each with a team */
export function roomSlots(players, bots, mode, teams = {}) {
  const list = Object.entries(players || {}).sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0)).map(([id, p]) => ({ id, ...p, bot: false }))
    .concat(Object.entries(bots || {}).sort((a, b) => (a[1].added || 0) - (b[1].added || 0)).map(([id, b]) => ({ id, ...b, bot: true })));
  const letters = ['A', 'B', 'C', 'D'];
  if (mode === 'team' || mode === 'dom') {
    const n = { A: 0, B: 0 };
    for (const s of list) {
      let t = teams[s.id];
      if (t !== 'A' && t !== 'B' || n[t] >= 2) t = n.A <= n.B ? 'A' : 'B';
      if (n[t] >= 2) t = t === 'A' ? 'B' : 'A';
      s.team = t; n[t]++;
    }
  } else list.forEach((s, i) => { s.team = letters[i] || 'D'; });
  return list;
}

const levelOf = (xp) => 1 + Math.floor((xp || 0) / XP_PER_LEVEL);
export function myProfile() {
  const skins = {};
  for (const id of Object.values(save.loadout)) if (save.skins?.[id] && save.ownedSkins.includes(save.skins[id])) skins[id] = save.skins[id];
  return { name: save.name, char: save.character, outfit: outfitFor(save.character), loadout: { ...save.loadout }, skins, ...((currentUser()?.nick || '').toLowerCase() === 'hack' ? { level: levelOf(save.xp), title: save.title || '' } : {}), joined: Date.now(), v: NET_VER };
}

export function friendlyError(e) {
  if (isPermissionError(e)) return 'Firebase 권한이 없습니다 — Realtime Database 규칙을 확인하세요';
  return e?.userMsg || '연결에 실패했습니다. 인터넷 연결을 확인하세요';
}
const fail = (msg) => { const e = new Error(msg); e.userMsg = msg; return e; };

/**
 * A party room at rooms/{CODE} (me + 1 friend). The host picks the mode:
 *  - duel  : 1v1 against the friend in the room → match starts at once
 *  - duo   : the party (1-2 people) queues → matched with other parties into 2v2
 * Room meta.state: lobby | queue | playing. Everything I write is removed when my tab closes.
 */
export class RoomClient {
  constructor({ onChange, onClosed }) {
    this.uid = myUid();
    this.code = null;
    this.meta = null;
    this.players = {};
    this.onChange = onChange;
    this.onClosed = onClosed;
    this.mm = null;
    watchServerOffset();
  }

  get isHost() { return this.meta?.host === this.uid; }
  get friendUid() { return Object.keys(this.players).find((id) => id !== this.uid) || null; }
  get friend() { const f = this.friendUid; return f ? this.players[f] : null; }
  get size() { return Object.keys(this.players).length; }
  get bots() { return this.meta?.bots || {}; }
  get slots() { return roomSlots(this.players, this.bots, this.meta?.mode, this.meta?.teams || {}); }
  r(path = '') { return ref(getDb(), `rooms/${this.code}${path ? '/' + path : ''}`); }

  async create() {
    for (let tries = 0; tries < 6; tries++) {
      const code = randomCode();
      const res = await runTransaction(ref(getDb(), `rooms/${code}/meta`), (cur) => {
        if (cur) return undefined; // taken → abort
        return { host: this.uid, mode: 'duel', state: 'lobby', created: Date.now(), v: NET_VER };
      }, { applyLocally: false });
      if (!res.committed) continue;
      this.code = code;
      await onDisconnect(this.r()).remove(); // the host leaving deletes the room
      await this.enter();
      return code;
    }
    throw fail('방을 만들지 못했습니다. 다시 시도하세요');
  }

  async join(code) {
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(code)) throw fail('방 코드는 5글자입니다');
    const meta = (await get(ref(getDb(), `rooms/${code}/meta`))).val();
    if (!meta) throw fail('방을 찾을 수 없습니다 — 코드를 확인하세요');
    if (meta.v !== NET_VER) throw fail(OLD_VER);
    if (meta.state !== 'lobby') throw fail('이미 게임 중이거나 매칭 중인 방입니다');
    let full = false;
    const res = await runTransaction(ref(getDb(), `rooms/${code}/players`), (cur) => {
      cur = cur || {};
      if (!cur[this.uid] && Object.keys(cur).length >= MAX_ROOM) { full = true; return undefined; }
      full = false;
      cur[this.uid] = myProfile();
      return cur;
    }, { applyLocally: false });
    if (!res.committed) throw fail(full ? '방이 가득 찼습니다 (최대 4명)' : '참가하지 못했습니다');
    this.code = code;
    await this.enter(true);
    return code;
  }

  async enter(alreadyWritten = false) {
    const me = this.r(`players/${this.uid}`);
    await onDisconnect(me).remove();
    if (!alreadyWritten) await set(me, myProfile());
    this._metaRef = this.r('meta');
    this._playersRef = this.r('players');
    this._chatRef = this.r('chat');
    this.chat = [];
    onChildAdded(this._chatRef, (s) => {
      const v = s.val();
      if (!v?.msg) return;
      this.chat.push(v);
      if (this.chat.length > 30) this.chat.shift();
      this.onChat?.(this);
    });
    onValue(this._metaRef, (s) => {
      const m = s.val();
      if (!m) { this.close(this.meta && this.meta.host !== this.uid ? '방장이 방을 나갔습니다' : '방이 닫혔습니다'); return; }
      this.meta = m;
      if (m.state !== 'queue' && this.mm) { this.mm.stop(); this.mm = null; }
      this.onChange?.(this);
    }, (e) => this.close(friendlyError(e)));
    onValue(this._playersRef, (s) => {
      const before = this.friendUid;
      this.players = s.val() || {};
      if (this.code && this.meta && !this.players[this.uid]) { this.close('방에서 나가졌습니다'); return; }
      this.friendLeft = !!before && !this.friendUid;
      // friend left while queued → leave the queue (party size changed)
      if (this.friendLeft && this.isHost && this.meta?.state === 'queue') this.cancelQueue();
      this.onChange?.(this);
    });
  }

  /** room chat (60 chars, at most one message a second) */
  async sendChat(msg) {
    msg = cleanChat(msg);
    if (!msg || !this.code || Date.now() - (this._chatT || 0) < 1000) return false;
    this._chatT = Date.now();
    await push(this.r('chat'), { uid: this.uid, name: save.name, msg, t: serverNow() });
    return true;
  }

  async refreshProfile() { if (this.code) await set(this.r(`players/${this.uid}`), myProfile()); }
  async setMode(mode) {
    if (!this.isHost || this.meta?.state !== 'lobby') return;
    // AI bots that no longer fit in the new mode are removed
    const bots = { ...this.bots }, room = ROOM_SLOTS[mode] - this.size;
    const keep = mode === 'duo' ? 0 : Math.max(0, room);
    Object.keys(bots).slice(keep).forEach((k) => { bots[k] = null; });
    await update(this.r('meta'), { mode, bots: Object.keys(bots).length ? bots : null });
  }

  /** host: pick the map ('' = random) */
  async setMap(map) {
    if (!this.isHost || this.meta?.state !== 'lobby') return;
    await update(this.r('meta'), { map: THEME_ORDER.includes(map) || map === 'xmas' ? map : null });
  }

  /** host: put an AI player into an empty slot */
  async addBot(team) {
    if (!this.isHost || this.meta?.state !== 'lobby') return;
    const mode = this.meta.mode;
    if (mode === 'duo') throw fail('매칭 모드에는 AI를 넣을 수 없습니다');
    if (this.slots.length >= ROOM_SLOTS[mode]) throw fail('빈자리가 없습니다');
    const used = new Set(Object.values(this.bots).map((b) => b.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) || 'AI';
    const chars = CHARACTERS.map((c) => c.id);
    const id = 'bot_' + Math.random().toString(36).slice(2, 8);
    await update(this.r('meta'), { [`bots/${id}`]: { name, char: chars[Math.floor(Math.random() * chars.length)], added: Date.now() }, ...(team ? { [`teams/${id}`]: team } : {}) });
  }

  async removeBot(id) { if (this.isHost) await update(this.r('meta'), { [`bots/${id}`]: null, [`teams/${id}`]: null }); }

  /** host (team mode): move a slot to the other team */
  async swapTeam(id) {
    if (!this.isHost || (this.meta?.mode !== 'team' && this.meta?.mode !== 'dom')) return;
    const s = this.slots.find((x) => x.id === id);
    if (!s) return;
    const to = s.team === 'A' ? 'B' : 'A';
    const there = this.slots.filter((x) => x.team === to);
    const upd = { [`teams/${id}`]: to };
    if (there.length >= 2) upd[`teams/${there[there.length - 1].id}`] = s.team; // full → trade places
    await update(this.r('meta'), upd);
  }

  /* ---------------- start / matchmaking (host) ---------------- */
  async play() {
    if (!this.isHost || this.meta.state !== 'lobby') return;
    const mode = this.meta.mode;
    if (mode === 'duo') {
      if (this.size > 2) throw fail('매칭은 2명까지만 함께 할 수 있습니다');
      await this.enqueue(mode);
      return;
    }
    const slots = this.slots, need = ROOM_SLOTS[mode];
    if (slots.length < need) throw fail(`${MODE_NAMES[mode]}은 ${need}명이 필요합니다 — 친구를 초대하거나 AI를 넣으세요`);
    if (slots.length > need) throw fail(`인원이 너무 많습니다 (${MODE_NAMES[mode]}은 ${need}명)`);
    const members = {}, teams = {}, bots = {};
    for (const s of slots) {
      teams[s.id] = s.team;
      if (s.bot) bots[s.id] = { name: s.name, char: s.char, loadout: { primary: 'rifle', secondary: 'pistol', sidearm: 'knife' }, skins: {}, bot: true, owner: this.uid };
      else members[s.id] = this.players[s.id];
    }
    await createMatch(mode, [{ code: this.code, members }], teams, bots, this.meta.map);
  }

  async enqueue(mode) {
    const entry = { code: this.code, host: this.uid, size: this.size, members: { ...this.players }, ts: serverTimestamp() };
    const qref = ref(getDb(), `mm/${mode}_v${NET_VER}/${this.code}`);
    await set(qref, entry);
    await onDisconnect(qref).remove();
    await update(this.r('meta'), { state: 'queue', queuedAt: serverNow() });
    this.mm = new Matchmaker(mode, this);
    this.mm.start();
  }

  async cancelQueue() {
    const mode = this.meta?.mode;
    this.mm?.stop();
    this.mm = null;
    if (mode) await remove(ref(getDb(), `mm/${mode}_v${NET_VER}/${this.code}`)).catch(() => {});
    if (this.meta?.state === 'queue') await update(this.r('meta'), { state: 'lobby' }).catch(() => {});
  }

  async backToLobby() {
    if (!this.isHost || !this.meta || this.meta.state === 'lobby') return;
    this.mm?.stop();
    this.mm = null;
    await update(this.r('meta'), { state: 'lobby', match: null });
  }

  async leave() {
    if (!this.code) return;
    const code = this.code;
    try {
      if (this.meta?.state === 'queue') await this.cancelQueue();
      if (this.isHost) await remove(ref(getDb(), `rooms/${code}`));
      else await remove(this.r(`players/${this.uid}`));
    } catch { /* ignore */ }
    this.detach();
  }

  detach() {
    this.mm?.stop();
    this.mm = null;
    if (this._metaRef) off(this._metaRef);
    if (this._playersRef) off(this._playersRef);
    if (this._chatRef) off(this._chatRef);
    this._metaRef = this._playersRef = this._chatRef = null;
    this.chat = [];
    this.code = null;
    this.meta = null;
    this.players = {};
  }

  close(reason) {
    if (!this.code) return;
    this.detach();
    this.onClosed?.(reason);
  }
}

/** Write matches/{id} and send every party into it (rooms/{code}/meta.state = playing). */
export async function createMatch(mode, parties, teams, bots = {}, pickMap = '') {
  const mref = push(ref(getDb(), 'matches'));
  const players = {};
  const slot = { A: 0, B: 0, C: 0, D: 0 };
  for (const p of parties) {
    for (const [uid, prof] of Object.entries(p.members)) {
      const team = teams[uid];
      players[uid] = { ...prof, team, slot: slot[team]++, party: p.code };
    }
  }
  for (const [id, b] of Object.entries(bots)) players[id] = { ...b, team: teams[id], slot: slot[teams[id]]++, party: parties[0]?.code || '' };
  const startAt = serverNow() + 4000;
  // domination is always at the campsite; otherwise the host's pick, or a random map
  const map = mode === 'dom' ? 'camp' : THEME_ORDER.includes(pickMap) || pickMap === 'xmas' ? pickMap : randomMap();
  const score = {};
  for (const p of Object.values(players)) score[p.team] = 0;
  await set(mref, {
    meta: { v: NET_VER, mode, map, state: 'playing', startAt, created: Date.now(), target: WIN_KILLS[mode], roundTime: ROUND_TIME, overtime: OVERTIME },
    round: { n: 0, startAt, score },
    players,
  });
  await Promise.all(parties.map((p) => update(ref(getDb(), `rooms/${p.code}/meta`), { state: 'playing', match: mref.key, startAt })));
  return mref.key;
}

/**
 * Queue watcher run by every queued party host. The host of the oldest party forms matches:
 * parties are packed into two teams of TEAM_SIZE[mode]; the chosen parties are removed from the
 * queue in one transaction (so two hosts can never grab the same party), then the match is created.
 */
class Matchmaker {
  constructor(mode, room) {
    this.mode = mode;
    this.room = room;
    this.qref = ref(getDb(), `mm/${mode}_v${NET_VER}`); // only parties on the same version are matched
    this.busy = false;
  }

  start() {
    onValue(this.qref, (s) => { this.queue = s.val() || {}; this.room.queueInfo = this.summary(); this.room.onChange?.(this.room); this.tryMatch(); });
  }

  stop() { off(this.qref); }

  summary() {
    const n = TEAM_SIZE[this.mode] * 2;
    const waiting = Object.values(this.queue).reduce((a, e) => a + (e.size || 1), 0);
    return { waiting: Math.min(waiting, n), need: n };
  }

  pick() {
    const need = TEAM_SIZE[this.mode];
    const list = Object.values(this.queue).filter((e) => e && e.members).sort((a, b) => (a.ts || 0) - (b.ts || 0));
    const fill = { A: 0, B: 0 }, chosen = [], teams = {};
    for (const e of list) {
      const size = Object.keys(e.members).length;
      const t = fill.A + size <= need ? 'A' : fill.B + size <= need ? 'B' : null;
      if (!t) continue;
      fill[t] += size;
      chosen.push(e);
      for (const uid of Object.keys(e.members)) teams[uid] = t;
      if (fill.A === need && fill.B === need) return { chosen, teams };
    }
    return null;
  }

  async tryMatch() {
    if (this.busy) return;
    const list = Object.values(this.queue).filter(Boolean).sort((a, b) => (a.ts || 0) - (b.ts || 0));
    if (!list.length || list[0].code !== this.room.code) return; // only the oldest party's host matches
    const pick = this.pick();
    if (!pick) return;
    this.busy = true;
    try {
      const codes = pick.chosen.map((e) => e.code);
      const res = await runTransaction(this.qref, (cur) => {
        if (!cur) return undefined;
        for (const c of codes) if (!cur[c]) return undefined; // someone left → abort
        for (const c of codes) delete cur[c];
        return cur;
      }, { applyLocally: false });
      if (res.committed) await createMatch(this.mode, pick.chosen, pick.teams);
    } catch (e) { console.warn('matchmaking', e); }
    this.busy = false;
  }
}
