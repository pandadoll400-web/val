import { THEME_ORDER, getTheme } from '../world/themes.js';
import { currentUser } from '../net/auth.js';
import { QUICK_CHAT } from '../net/room.js';

const isHack = () => (currentUser()?.nick || '').toLowerCase() === 'hack';
import { RoomClient, friendlyError, TEAM_SIZE, MODE_NAMES, ROOM_SLOTS, NET_VER } from '../net/room.js';
import { getCharacter } from '../data/characters.js';
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
    this.room.onChat = () => this.renderChat();
    // room chat: free text + quick phrases
    $('room-chat-quick').innerHTML = QUICK_CHAT.map((q, i) => `<button data-q="${i}">${q}</button>`).join('');
    $('room-chat-quick').onclick = (e) => { const b = e.target.closest('button'); if (b) this.room.sendChat(QUICK_CHAT[+b.dataset.q]).catch(() => {}); };
    const cin = $('room-chat-in');
    const sendTyped = () => { if (cin.value.trim()) { this.room.sendChat(cin.value).catch(() => {}); cin.value = ''; } };
    cin.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') sendTyped(); };
    $('room-chat-send').onclick = sendTyped;
    this.busy = false;

    ui.onDuel = () => this.create(); // [플레이] → [듀얼]: a room with a code right away
    $('room-slots').onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const r = this.room, act = b.dataset.act, id = b.dataset.id;
      const p = act === 'add' ? r.addBot(b.dataset.team) : act === 'del' ? r.removeBot(id) : act === 'swap' ? r.swapTeam(id) : null;
      p?.catch((err) => this.ui.toast(friendlyError(err)));
    };
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
    // map picker: random + every map
    $('room-maps').innerHTML = '<span class="lbl">맵</span><button data-map="">🎲 랜덤</button>' + THEME_ORDER.map((id) => `<button data-map="${id}">${getTheme(id).name}</button>`).join('')
      + '<button data-map="xmas" class="xmas-map hidden">🎄 크리스마스 마을</button>';
    $('room-maps').querySelectorAll('button').forEach((b) => {
      b.onclick = () => this.room.setMap(b.dataset.map).catch((e) => this.ui.toast(friendlyError(e)));
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
      else {
        const old = Object.values(r.players).find((p) => p.v !== NET_VER);
        if (old) { this.ui.toast(`${old.name}님의 게임이 예전 버전입니다 — 새로고침(Ctrl+F5)해 달라고 하세요`); return; }
        await r.play();
      }
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
    const dom = m.mode === 'dom', duo = m.mode === 'duo';
    $('room-maps').classList.toggle('locked', dom || duo);
    $('room-maps').querySelectorAll('button').forEach((b) => {
      b.classList.toggle('on', dom ? b.dataset.map === 'camp' : duo ? b.dataset.map === '' : b.dataset.map === (m.map || ''));
      b.disabled = !r.isHost || m.state !== 'lobby' || dom || duo;
    });
    // hack-only map: the button shows for a hack host, and for everyone once it has been picked
    $('room-maps').querySelector('.xmas-map').classList.toggle('hidden', !(r.isHost && isHack()) && m.map !== 'xmas');
    const start = $('room-start');
    const queued = m.state === 'queue';
    if (m.mode !== 'duo') start.textContent = '시작';
    else start.textContent = queued ? '매칭 취소' : '매칭 시작';
    const slots = r.slots;
    start.disabled = !r.isHost || m.state === 'playing' || (m.mode !== 'duo' && slots.length !== ROOM_SLOTS[m.mode]);
    this.renderSlots(slots);
    this.updateStatus();
  }

  /** slot cards under the stage: team, name, host controls (+AI / ✕ / team swap) */
  renderSlots(slots) {
    const r = this.room, m = r.meta, host = r.isHost && m.state === 'lobby';
    const cap = m.mode === 'duo' ? Math.max(2, slots.length) : ROOM_SLOTS[m.mode];
    const html = [];
    const teamMode = m.mode === 'team' || m.mode === 'dom';
    const teamLabel = (t) => (teamMode ? t : m.mode === 'duo' ? '' : { A: '1', B: '2', C: '3', D: '4' }[t]);
    for (const s of slots) {
      const c = getCharacter(s.char);
      html.push(`<div class="room-slot t${s.team}"><span class="team">${teamLabel(s.team)}</span>
        <span class="nm">${!s.bot && s.level ? `<em class="lv${s.royal ? ' royal' : ''}">${s.royal ? '👑' : ''}Lv.${s.level}</em>` : ''}${s.name}${s.id === r.uid ? ' (나)' : ''}<small>${!s.bot && s.title ? `<b class="ttl">🎖️ ${s.title}</b> · ` : ''}${s.bot ? 'AI · ' : ''}${c.name}${!s.bot && s.v !== NET_VER ? ' · <b style="color:#ff6b6b">예전 버전</b>' : ''}</small></span>
        ${host && teamMode ? `<button data-act="swap" data-id="${s.id}" title="팀 바꾸기">⇄</button>` : ''}
        ${host && s.bot ? `<button class="del" data-act="del" data-id="${s.id}" title="AI 빼기">✕</button>` : ''}</div>`);
    }
    for (let i = slots.length; i < cap; i++) {
      let team = '';
      if (teamMode) { const a = slots.filter((s) => s.team === 'A').length; team = a < 2 ? 'A' : 'B'; }
      html.push(`<div class="room-slot empty"><span class="nm">빈자리<small>친구를 기다리는 중</small></span>
        ${host && m.mode !== 'duo' ? `<button class="add" data-act="add" data-team="${team}">+ AI</button>` : ''}</div>`);
    }
    const out = html.join('');
    if (this._slotsHtml !== out) { this._slotsHtml = out; $('room-slots').innerHTML = out; }
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
    else if (m.mode === 'duo') text = r.isHost ? `[매칭 시작]을 누르면 2대2 상대를 찾습니다 (사람만)` : '방장이 매칭을 시작하기를 기다리는 중…';
    else {
      const need = ROOM_SLOTS[m.mode], have = r.slots.length;
      if (have < need) text = r.isHost ? `${MODE_NAMES[m.mode]} · ${need - have}자리 비었음 — 친구에게 코드를 알려 주거나 [+ AI]를 누르세요` : `${MODE_NAMES[m.mode]} · 사람을 기다리는 중… (${have}/${need})`;
      else if (have > need) text = `인원이 너무 많습니다 — ${MODE_NAMES[m.mode]}은 ${need}명입니다`;
      else text = r.isHost ? `${MODE_NAMES[m.mode]} 준비 완료 — [시작]을 누르세요` : `${MODE_NAMES[m.mode]} · 방장이 시작하기를 기다리는 중…`;
    }
    if (el.textContent !== text) el.textContent = text;
  }

  stageEntries() {
    const r = this.room, m = r.meta || {};
    const hostTag = (uid) => (m.host === uid ? '방장' : '');
    const slots = r.slots;
    if (!slots.length) slots.push({ id: r.uid, char: save.character, name: save.name, team: 'A' });
    const out = slots.map((s) => ({
      charId: s.char, outfit: s.outfit || null, name: s.name,
      tag: s.bot ? 'AI' : [s.id === r.uid ? '나' : '친구', hostTag(s.id)].filter(Boolean).join(' · '),
    }));
    const cap = m.mode === 'duo' ? 2 : ROOM_SLOTS[m.mode] || 2;
    while (out.length < cap) out.push({ placeholder: true, name: '빈자리' });
    return out;
  }

  renderChat() {
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const log = $('room-chat-log');
    log.innerHTML = (this.room.chat || []).map((c) => `<div><b class="${c.uid === this.room.uid ? 'me' : ''}">${esc(c.name || '?')}</b> ${esc(c.msg)}</div>`).join('');
    log.scrollTop = log.scrollHeight;
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
