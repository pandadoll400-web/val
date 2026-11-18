import { QUICK_CHAT, cleanChat } from '../net/room.js';
import { IS_TOUCH } from './touch.js';

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * In-game chat for online matches. Enter: type a message (Enter send · Esc cancel), V: quick chat (1–6).
 * Phones: the 💬 button opens the quick phrases and a text box.
 */
export class GameChat {
  constructor(game) {
    this.game = game;
    this.typing = false;
    this.quick = false;
    const hud = document.getElementById('hud');
    this.root = document.createElement('div');
    this.root.className = 'game-chat';
    this.root.innerHTML = `<div class="chat-log"></div>
      <div class="chat-input hidden"><input maxlength="60" placeholder="메시지 입력 · Enter 보내기 · Esc 취소" autocomplete="off"></div>
      <div class="qc-list hidden">${QUICK_CHAT.map((q, i) => `<button data-q="${i}">${i + 1}. ${q}</button>`).join('')}</div>
      ${IS_TOUCH ? '<button class="chat-btn">💬</button>' : ''}`;
    hud.appendChild(this.root);
    if (!game.net) this.root.classList.add('hidden'); // solo / training: no chat
    this.log = this.root.querySelector('.chat-log');
    this.inputBox = this.root.querySelector('.chat-input');
    this.input = this.inputBox.querySelector('input');
    this.list = this.root.querySelector('.qc-list');
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { this.send(this.input.value); this.closeInput(); }
      else if (e.key === 'Escape') this.closeInput();
    });
    this.input.addEventListener('keyup', (e) => e.stopPropagation());
    this.list.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { this.send(QUICK_CHAT[+b.dataset.q]); this.closeQuick(); } });
    this.root.querySelector('.chat-btn')?.addEventListener('click', () => {
      if (this.quick) { this.closeQuick(); this.closeInput(); } else { this.openQuick(); this.openInput(); }
    });
    this.timer = setInterval(() => this.fade(), 1000);
  }

  get enabled() { return !!this.game.net; }

  /** called first by the game's keydown handler; true = the key was used by the chat */
  handleKey(e) {
    if (!this.enabled || this.typing) return this.typing;
    if (this.quick) {
      const n = +e.key;
      if (n >= 1 && n <= QUICK_CHAT.length) { this.send(QUICK_CHAT[n - 1]); this.closeQuick(); return true; }
      if (e.code === 'Escape' || e.code === 'KeyV') { this.closeQuick(); return true; }
      return false;
    }
    if (e.code === 'Enter' && !e.repeat) { this.openInput(); return true; }
    if (e.code === 'KeyV' && !e.repeat) { this.openQuick(); return true; }
    return false;
  }

  openInput() {
    const g = this.game;
    this.typing = true;
    g.keys = {}; g.weapons.trigger = false; g.weapons.adsHeld = false;
    this.inputBox.classList.remove('hidden');
    document.exitPointerLock?.();
    setTimeout(() => this.input.focus(), 0);
  }

  closeInput() {
    this.input.value = '';
    this.input.blur();
    this.inputBox.classList.add('hidden');
    if (!this.typing) return;
    this.typing = false;
    if (!IS_TOUCH && !this.game.over) this.game.lock();
  }

  openQuick() { this.quick = true; this.list.classList.remove('hidden'); }
  closeQuick() { this.quick = false; this.list.classList.add('hidden'); }

  send(msg) {
    msg = cleanChat(msg);
    if (!msg || !this.enabled || Date.now() - (this._t || 0) < 1000) return;
    this._t = Date.now();
    this.game.net.sendChat(msg);
  }

  /** a chat line arrived (mine included) */
  add(v) {
    const g = this.game, mine = v.uid === g.net?.uid, mate = mine || v.team === g.myTeam;
    const line = document.createElement('div');
    line.innerHTML = `<b class="${mate ? 'me' : ''}">${esc(v.name || '?')}</b>${esc(v.msg)}`;
    line.dataset.t = Date.now();
    this.log.appendChild(line);
    while (this.log.children.length > 7) this.log.firstChild.remove();
  }

  fade() {
    const now = Date.now();
    for (const l of this.log.children) l.classList.toggle('old', !this.typing && now - +l.dataset.t > 8000);
  }

  dispose() { clearInterval(this.timer); this.root.remove(); }
}
