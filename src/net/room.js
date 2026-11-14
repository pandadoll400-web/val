import {
  getDb, ref, set, get, update, remove, push, onValue, off, onDisconnect, runTransaction,
  myUid, serverNow, watchServerOffset, isPermissionError, serverTimestamp,
} from './firebase.js';
import { save } from '../save.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1
const randomCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

/** players per team for each online mode */
export const TEAM_SIZE = { duel: 1, duo: 2 };
/** team kills needed to win */
export const WIN_KILLS = { duel: 5, duo: 10 };
export const MODE_NAMES = { duel: '듀얼 1대1', duo: '듀오 2대2' };

export function myProfile() {
  const skins = {};
  for (const id of Object.values(save.loadout)) if (save.skins?.[id] && save.ownedSkins.includes(save.skins[id])) skins[id] = save.skins[id];
  return { name: save.name, char: save.character, loadout: { ...save.loadout }, skins, joined: Date.now() };
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
  r(path = '') { return ref(getDb(), `rooms/${this.code}${path ? '/' + path : ''}`); }

  async create() {
    for (let tries = 0; tries < 6; tries++) {
      const code = randomCode();
      const res = await runTransaction(ref(getDb(), `rooms/${code}/meta`), (cur) => {
        if (cur) return undefined; // taken → abort
        return { host: this.uid, mode: 'duel', state: 'lobby', created: Date.now() };
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
    if (meta.state !== 'lobby') throw fail('이미 게임 중이거나 매칭 중인 방입니다');
    let full = false;
    const res = await runTransaction(ref(getDb(), `rooms/${code}/players`), (cur) => {
      cur = cur || {};
      if (!cur[this.uid] && Object.keys(cur).length >= 2) { full = true; return undefined; }
      full = false;
      cur[this.uid] = myProfile();
      return cur;
    }, { applyLocally: false });
    if (!res.committed) throw fail(full ? '방이 가득 찼습니다 (최대 2명)' : '참가하지 못했습니다');
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

  async refreshProfile() { if (this.code) await set(this.r(`players/${this.uid}`), myProfile()); }
  async setMode(mode) { if (this.isHost && this.meta?.state === 'lobby') await update(this.r('meta'), { mode }); }

  /* ---------------- start / matchmaking (host) ---------------- */
  async play() {
    if (!this.isHost || this.meta.state !== 'lobby') return;
    const mode = this.meta.mode;
    if (mode === 'duel') {
      if (!this.friendUid) throw fail('듀얼은 친구가 들어와야 시작할 수 있습니다');
      const members = { [this.uid]: this.players[this.uid], [this.friendUid]: this.players[this.friendUid] };
      const teams = { [this.uid]: 'A', [this.friendUid]: 'B' };
      await createMatch('duel', [{ code: this.code, members }], teams);
      return;
    }
    await this.enqueue(mode);
  }

  async enqueue(mode) {
    const entry = { code: this.code, host: this.uid, size: this.size, members: { ...this.players }, ts: serverTimestamp() };
    const qref = ref(getDb(), `mm/${mode}/${this.code}`);
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
    if (mode) await remove(ref(getDb(), `mm/${mode}/${this.code}`)).catch(() => {});
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
    this._metaRef = this._playersRef = null;
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
export async function createMatch(mode, parties, teams) {
  const mref = push(ref(getDb(), 'matches'));
  const players = {};
  const slot = { A: 0, B: 0 };
  for (const p of parties) {
    for (const [uid, prof] of Object.entries(p.members)) {
      const team = teams[uid];
      players[uid] = { ...prof, team, slot: slot[team]++, party: p.code };
    }
  }
  const startAt = serverNow() + 3500;
  const map = ['ice', 'forest', 'honey'][Math.floor(Math.random() * 3)]; // every match: a random map
  await set(mref, { meta: { mode, map, state: 'playing', startAt, created: Date.now(), target: WIN_KILLS[mode] }, players });
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
    this.qref = ref(getDb(), `mm/${mode}`);
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
