import { currentUser } from '../net/auth.js';
import { sendRequest, accept, decline, removeFriend, invite, clearInvite, watchFriends, startPresence } from '../net/friends.js';
import { rankOf } from '../data/rank.js';
import { rankOn } from './rank.js';
import { audio } from '../audio.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const INVITE_TTL = 3 * 60 * 1000;

/** 👥 friends: add by nickname, accept requests, see who is online, invite to my room, join invites */
export class FriendsUI {
  constructor({ ui, room, inGame }) {
    this.ui = ui;
    this.room = room;       // RoomUI
    this.inGame = inGame;   // () => true while a match is running
    this.state = { friends: [], requests: [], invites: [] };
    this.seenInvites = new Set();
    startPresence();

    const pop = document.createElement('div');
    pop.id = 'friends-pop';
    pop.className = 'advent-pop fr-pop hidden';
    pop.innerHTML = `<div class="advent-card friends-card">
        <div class="advent-head"><b>👥 친구</b><small id="fr-sub"></small><button class="x" id="fr-close">✕</button></div>
        <div class="fr-add"><input id="fr-nick" maxlength="12" placeholder="친구 닉네임" autocomplete="off"><button class="btn primary small" id="fr-send">친구 요청</button></div>
        <div id="fr-body"></div>
      </div>`;
    document.body.appendChild(pop);
    $('fr-close').onclick = () => this.close();
    pop.addEventListener('click', (e) => { if (e.target === pop) this.close(); });
    $('fr-send').onclick = () => this.add();
    $('fr-nick').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') this.add(); });

    // invite button in the room screen
    const ib = document.createElement('button');
    ib.id = 'room-invite';
    ib.className = 'btn ghost small';
    ib.textContent = '👥 친구 초대';
    ib.onclick = () => this.open();
    $('room-copy').after(ib);

    // invite card
    const card = document.createElement('div');
    card.id = 'invite-card';
    card.className = 'invite-card hidden';
    document.body.appendChild(card);

    watchFriends((s) => { this.state = s; this.update(); });
  }

  get roomCode() { return this.room?.room?.code || ''; }

  update() {
    const n = this.state.requests.length + this.liveInvites().length;
    const btn = $('friends-btn');
    if (btn) {
      const on = this.state.friends.filter((f) => f.online).length;
      btn.innerHTML = `👥 친구${on ? ` <small class="fr-on">● ${on}</small>` : ''}${n ? `<i class="dot">${n}</i>` : ''}`;
    }
    this.showInvite();
    if (!$('friends-pop').classList.contains('hidden')) this.render();
  }

  liveInvites() { return this.state.invites.filter((v) => Date.now() - v.at < INVITE_TTL && v.code !== this.roomCode); }

  open() { $('friends-pop').classList.remove('hidden'); this.render(); setTimeout(() => currentUser() && $('fr-nick').focus(), 50); }
  close() { $('friends-pop').classList.add('hidden'); }

  async add() {
    const nick = $('fr-nick').value.trim();
    if (!nick) return;
    try {
      const r = await sendRequest(nick);
      $('fr-nick').value = '';
      this.ui.toast(r === 'accepted' ? `${nick}님과 친구가 되었어요!` : `${nick}님에게 친구 요청을 보냈어요`);
    } catch (e) { this.ui.toast(e.message || '요청을 보내지 못했어요'); }
  }

  render() {
    const u = currentUser();
    $('fr-sub').textContent = u ? `${this.state.friends.length}명 · 접속 중 ${this.state.friends.filter((f) => f.online).length}명` : '';
    $('fr-nick').disabled = $('fr-send').disabled = !u;
    if (!u) { $('fr-body').innerHTML = '<div class="hint">👤 로그인하면 친구를 추가하고 방으로 초대할 수 있어요 (왼쪽 위 계정 버튼)</div>'; return; }
    const code = this.roomCode;
    const req = this.state.requests.map((r) => `<div class="fr-row req"><span class="nm">📨 ${esc(r.nick)}</span>
        <button class="btn primary small" data-acc="${r.uid}" data-nick="${esc(r.nick)}">수락</button><button class="btn ghost small" data-dec="${r.uid}">거절</button></div>`).join('');
    const inv = this.liveInvites().map((v) => `<div class="fr-row req"><span class="nm">🎮 ${esc(v.nick)}님의 초대</span>
        <button class="btn primary small" data-join="${v.uid}">참가</button><button class="btn ghost small" data-ign="${v.uid}">무시</button></div>`).join('');
    const list = this.state.friends.map((f) => { const k = rankOf(f.rp); return `<div class="fr-row ${f.online ? 'on' : ''}">
        <span class="st">${f.online ? '🟢' : '⚫'}</span><span class="nm">${esc(f.nick)}${rankOn() ? ` <em class="rk" style="color:${k.color}">${k.icon}</em>` : ''}<small>${f.online ? '접속 중' : '오프라인'}</small></span>
        ${code ? `<button class="btn primary small" data-inv="${f.uid}" ${f.online ? '' : 'disabled'}>초대</button>` : ''}
        <button class="btn ghost small fr-x" data-del="${f.uid}" data-nick="${esc(f.nick)}" title="친구 삭제">✕</button></div>`; }).join('');
    $('fr-body').innerHTML = (req || inv ? `<div class="fr-sec">받은 요청 · 초대</div>${inv}${req}` : '')
      + `<div class="fr-sec">친구 목록${code ? ' · 방 코드 ' + code : ''}</div>`
      + (list || '<div class="hint">아직 친구가 없어요. 닉네임으로 친구 요청을 보내 보세요!</div>')
      + (code ? '' : '<div class="hint">방을 만들면 (플레이 › 온라인) 친구를 초대할 수 있어요</div>');
    const B = $('fr-body');
    B.querySelectorAll('[data-acc]').forEach((b) => (b.onclick = () => accept(b.dataset.acc, b.dataset.nick).then(() => this.ui.toast(`${b.dataset.nick}님과 친구가 되었어요!`), () => this.ui.toast('수락하지 못했어요'))));
    B.querySelectorAll('[data-dec]').forEach((b) => (b.onclick = () => decline(b.dataset.dec)));
    B.querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => { if (confirm(`${b.dataset.nick}님을 친구에서 삭제할까요?`)) removeFriend(b.dataset.del); }));
    B.querySelectorAll('[data-inv]').forEach((b) => (b.onclick = () => invite(b.dataset.inv, code).then(() => { this.ui.toast('초대를 보냈어요!'); b.disabled = true; b.textContent = '보냄'; }, () => this.ui.toast('초대하지 못했어요'))));
    B.querySelectorAll('[data-join]').forEach((b) => (b.onclick = () => this.join(b.dataset.join)));
    B.querySelectorAll('[data-ign]').forEach((b) => (b.onclick = () => clearInvite(b.dataset.ign)));
  }

  /** pop a card for a new invite */
  showInvite() {
    const card = $('invite-card');
    const v = this.liveInvites().find((x) => !this.seenInvites.has(x.uid + x.code + x.at));
    if (!v) { if (!this.liveInvites().some((x) => x.uid === card.dataset.uid)) card.classList.add('hidden'); return; }
    this.seenInvites.add(v.uid + v.code + v.at);
    card.dataset.uid = v.uid;
    card.innerHTML = `<b>🎮 ${esc(v.nick)}님이 방에 초대했어요</b><small>방 코드 ${esc(v.code)}</small>
      <div><button class="btn primary small" id="inv-join">참가</button><button class="btn ghost small" id="inv-ign">무시</button></div>`;
    card.classList.remove('hidden');
    audio.init(); audio.magIn?.();
    $('inv-join').onclick = () => this.join(v.uid);
    $('inv-ign').onclick = () => { card.classList.add('hidden'); clearInvite(v.uid); };
  }

  async join(fromUid) {
    const v = this.state.invites.find((x) => x.uid === fromUid);
    $('invite-card').classList.add('hidden');
    if (!v) return;
    if (this.inGame?.()) { this.ui.toast('게임이 끝난 뒤 참가할 수 있어요'); return; }
    clearInvite(fromUid);
    this.close();
    if (this.roomCode) await this.room.leave?.();
    this.room.join(v.code);
  }
}
