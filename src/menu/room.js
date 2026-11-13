import { RoomClient, friendlyError, TEAM_SIZE, MODE_NAMES } from '../net/room.js';
import { CharStage } from './stage.js';
import { save } from '../save.js';
import { serverNow } from '../net/firebase.js';

const $ = (id) => document.getElementById(id);

/** [듀얼 플레이] panel (create / join) and the room lobby overlay with me + my friend on stage. */
export class RoomUI {
  constructor({ ui, onMatch }) {
    this.ui = ui;
    this.onMatch = onMatch;
    this.inGame = false;
    this.lastMatch = null;
    this.stage = new CharStage();
    this.room = new RoomClient({ onChange: () => this.render(), onClosed: (r) => this.closed(r) });
    this.busy = false;

    $('duel-create').onclick = () => this.create();
    $('duel-join-open').onclick = () => { $('duel-join').classList.remove('hidden'); $('duel-code').focus(); };
    const input = $('duel-code');
    input.oninput = () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); };
    input.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') this.join(input.value); };
    $('duel-join-go').onclick = () => this.join(input.value);
    $('room-copy').onclick = () => {
      navigator.clipboard?.writeText(this.room.code || '').then(() => this.ui.toast('방 코드를 복사했습니다'), () => this.ui.toast(`방 코드: ${this.room.code}`));
    };
    $('room-leave').onclick = () => this.leave();
    $('room-start').onclick = () => this.startPressed();
    document.querySelectorAll('#room-modes button').forEach((b) => {
      b.onclick = () => this.room.setMode(b.dataset.mode).catch((e) => this.ui.toast(friendlyError(e)));
    });
  }

  get visible() { return !$('room').classList.contains('hidden'); }

  async create() {
    if (this.busy) return;
    this.busy = true;
    this.ui.toast('방을 만드는 중…');
    try { await this.room.create(); this.showRoom(); } catch (e) { console.warn(e); this.ui.toast(friendlyError(e)); }
    this.busy = false;
  }

  async join(code) {
    if (this.busy) return;
    if (!/^[A-Z0-9]{5}$/.test(code || '')) { this.ui.toast('방 코드 5글자를 입력하세요'); this.ui.shake($('duel-code')); return; }
    this.busy = true;
    this.ui.toast('참가하는 중…');
    try { await this.room.join(code); this.showRoom(); } catch (e) { console.warn(e); this.ui.toast(friendlyError(e)); }
    this.busy = false;
  }

  showRoom() {
    this.ui.hide();
    $('room').classList.remove('hidden');
    this.room.refreshProfile().catch(() => {});
    this.render();
  }

  hideRoom() { $('room').classList.add('hidden'); this.stage.hide(); }

  async leave() {
    await this.room.leave();
    this.hideRoom();
    this.ui.show();
  }

  closed(reason) {
    if (reason) this.ui.toast(reason);
    this.hideRoom();
    if (!this.inGame) this.ui.show();
  }

  async startPressed() {
    const r = this.room;
    if (!r.isHost) return;
    try {
      if (r.meta.state === 'queue') await r.cancelQueue();
      else await r.play();
    } catch (e) { this.ui.toast(friendlyError(e)); }
  }

  /** back from a finished match */
  async returnToLobby() {
    this.inGame = false;
    if (!this.room.code) { this.ui.show(); return; }
    this.showRoom();
    await this.room.backToLobby().catch(() => {});
  }

  render() {
    const r = this.room;
    if (!r.code || !r.meta) return;
    const m = r.meta;
    // a match was created for us → go
    if (m.state === 'playing' && m.match && m.match !== this.lastMatch && !this.inGame) {
      this.lastMatch = m.match;
      this.inGame = true;
      this.hideRoom();
      this.onMatch(m.match);
      return;
    }
    if (!this.visible) return;
    $('room-code').textContent = r.code;
    document.querySelectorAll('#room-modes button').forEach((b) => {
      b.classList.toggle('on', b.dataset.mode === m.mode);
      b.disabled = !r.isHost || m.state !== 'lobby';
    });
    const start = $('room-start');
    const queued = m.state === 'queue';
    if (m.mode === 'duel') start.textContent = '시작';
    else start.textContent = queued ? '매칭 취소' : '매칭 시작';
    start.disabled = !r.isHost || (m.mode === 'duel' && !r.friendUid) || m.state === 'playing';
    this.updateStatus();
  }

  updateStatus() {
    const r = this.room, m = r.meta, el = $('room-status');
    if (!m || !this.visible) return;
    let text = '';
    el.classList.toggle('queue', m.state === 'queue');
    if (m.state === 'queue') {
      const secs = Math.max(0, Math.floor((serverNow() - (m.queuedAt || serverNow())) / 1000));
      const q = r.queueInfo;
      text = `${MODE_NAMES[m.mode]} 매칭 중… ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` + (q ? ` · ${q.waiting}/${q.need}명` : '');
    } else if (m.state === 'playing') text = '경기 시작!';
    else if (!r.friendUid) text = r.isHost ? '친구에게 방 코드를 알려 주세요 — 친구를 기다리는 중…' : '방장을 기다리는 중…';
    else if (r.isHost) text = m.mode === 'duel' ? '모드를 고르고 [시작]을 누르세요' : `[매칭 시작]을 누르면 ${TEAM_SIZE[m.mode]}대${TEAM_SIZE[m.mode]} 상대를 찾습니다`;
    else text = `방장이 모드를 고르는 중… (현재: ${MODE_NAMES[m.mode]})`;
    if (el.textContent !== text) el.textContent = text;
  }

  stageEntries() {
    const r = this.room;
    const me = r.players[r.uid] || { char: save.character, name: save.name };
    const f = r.friend;
    const hostTag = (uid) => (r.meta?.host === uid ? '방장' : '');
    const out = [{ charId: me.char, name: me.name, tag: ['나', hostTag(r.uid)].filter(Boolean).join(' · ') }];
    out.push(f ? { charId: f.char, name: f.name, tag: hostTag(r.friendUid) || '친구' } : { placeholder: true, name: '친구를 기다리는 중…' });
    return out;
  }

  /** called every frame while the menu background is drawn */
  draw(renderer, dt) {
    if (!this.visible) return;
    this.stage.setEntries(this.stageEntries());
    this.stage.update(dt);
    const W = innerWidth, H = innerHeight;
    this.stage.render(renderer, { x: Math.round(W * 0.15), y: Math.round(H * 0.17), w: Math.round(W * 0.7), h: Math.round(H * 0.56) });
    this._st = (this._st || 0) + dt;
    if (this._st > 0.5) { this._st = 0; this.updateStatus(); }
  }
}
