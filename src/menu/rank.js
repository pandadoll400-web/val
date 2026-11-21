import { save, persist } from '../save.js';
import { RANKS, rankOf, nextRank, rankProgress, rankDelta, getRank } from '../data/rank.js';
import { currentUser, watchAuth } from '../net/auth.js';
import { writeRank, topRanks } from '../net/friends.js';

const $ = (id) => document.getElementById(id);
/** ranked play (경쟁전) is on the "hack" account only for now */
export const rankOn = () => (currentUser()?.nick || '').toLowerCase() === 'hack';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** small rank icon for names (room list, scoreboard) */
export const rankBadge = (id) => (id ? `<em class="rk" title="${getRank(id).name}" style="color:${getRank(id).color}">${getRank(id).icon}</em>` : '');

/** apply an online result (logged-in accounts only); returns { delta, rp, from, to } or null */
export function applyRank(win, draw) {
  if (!rankOn()) return null;
  const from = rankOf(save.rp);
  const old = save.rp || 0;
  save.rp = Math.max(0, old + rankDelta(win, draw));
  const delta = save.rp - old;
  const to = rankOf(save.rp);
  persist();
  writeRank(save.rp);
  return { delta, rp: save.rp, from, to };
}

/** "🏆 골드 +25 (532) 승급!" line for the result screen */
export function rankLine(r) {
  if (!rankOn()) return '';
  if (!r) return '<div class="rank-line guest">🏆 로그인하면 랭크 점수가 기록돼요</div>';
  const up = r.to.min > r.from.min, down = r.to.min < r.from.min;
  return `<div class="rank-line">🏆 <b style="color:${r.to.color}">${r.to.icon} ${r.to.name}</b> <span class="${r.delta >= 0 ? 'up' : 'down'}">${r.delta >= 0 ? '+' : ''}${r.delta}</span> (${r.rp})${up ? ' <span class="promo">🎉 승급!</span>' : down ? ' <span class="demo">강등</span>' : ''}</div>`;
}

/** 🏆 ranking popup: my rank + global top 20 + friends */
export class RankUI {
  constructor({ ui, friends }) {
    this.ui = ui;
    this.friends = friends; // FriendsUI (for the friends tab)
    this.tab = 'all';
    const pop = document.createElement('div');
    pop.id = 'rank-pop';
    pop.className = 'advent-pop hidden';
    pop.innerHTML = `<div class="advent-card rank-card">
        <div class="advent-head"><b>🏆 랭크</b><small>온라인 승리 +25 · 패배 −15</small><button class="x" id="rank-close">✕</button></div>
        <div id="rank-me" class="rank-me"></div>
        <div class="shop-tabs rank-tabs"><button class="shop-tab" data-rt="all">전체 TOP 20</button><button class="shop-tab" data-rt="friends">친구</button></div>
        <div id="rank-list" class="rank-list"></div>
        <div class="advent-foot">${RANKS.map((r) => `<span style="color:${r.color}">${r.icon} ${r.name} ${r.min}</span>`).join(' · ')}</div>
      </div>`;
    $('menu').appendChild(pop);
    $('rank-close').onclick = () => this.close();
    pop.addEventListener('click', (e) => { if (e.target === pop) this.close(); });
    pop.querySelectorAll('[data-rt]').forEach((b) => (b.onclick = () => { this.tab = b.dataset.rt; this.render(); }));
    const prev = ui.onRefresh;
    ui.onRefresh = () => { prev?.(); this.update(); };
    watchAuth(() => this.update());
    this.update();
  }

  /** menu button shows my rank */
  update() {
    const btn = $('rank-btn');
    if (!btn) return;
    btn.classList.toggle('hidden', !rankOn());
    if (!rankOn()) this.close();
    const r = rankOf(save.rp);
    btn.innerHTML = currentUser() ? `🏆 <span style="color:${r.color}">${r.icon} ${r.name}</span> <small>${save.rp}</small>` : '🏆 랭크';
  }

  open() { $('rank-pop').classList.remove('hidden'); this.render(); }
  close() { $('rank-pop').classList.add('hidden'); }

  async render() {
    const r = rankOf(save.rp), nx = nextRank(save.rp), u = currentUser();
    $('rank-me').innerHTML = u
      ? `<div class="rk-big" style="color:${r.color}">${r.icon}</div><div class="rk-info"><b style="color:${r.color}">${r.name}</b> · ${save.rp} RP
          <span class="xp-bar big"><i style="width:${rankProgress(save.rp) * 100}%;background:${r.color}"></i></span>
          <small>${nx ? `${nx.icon} ${nx.name}까지 ${nx.min - save.rp} RP` : '최고 등급!'}</small></div>`
      : '<div class="rk-info"><b>로그인하면 랭크전에 참여할 수 있어요</b><small>온라인 판의 승패로 등급이 오르내립니다</small></div>';
    $('rank-pop').querySelectorAll('[data-rt]').forEach((b) => b.classList.toggle('on', b.dataset.rt === this.tab));
    const list = $('rank-list');
    const row = (i, nick, rp, mine) => { const k = rankOf(rp); return `<div class="rk-row ${mine ? 'mine' : ''}"><span class="n">${i}</span><span class="i" style="color:${k.color}">${k.icon}</span><span class="nm">${esc(nick)}</span><span class="rp">${rp} RP</span></div>`; };
    if (this.tab === 'friends') {
      if (!u) { list.innerHTML = '<div class="hint">로그인하고 친구를 추가해 보세요</div>'; return; }
      const fs = [...(this.friends?.state.friends || []).map((f) => ({ nick: f.nick, rp: f.rp, uid: f.uid })), { nick: u.nick, rp: save.rp, uid: u.uid }].sort((a, b) => b.rp - a.rp);
      list.innerHTML = fs.map((f, i) => row(i + 1, f.nick, f.rp, f.uid === u.uid)).join('') + (fs.length < 2 ? '<div class="hint">👥 친구를 추가하면 여기서 순위를 비교할 수 있어요</div>' : '');
      return;
    }
    list.innerHTML = '<div class="hint">불러오는 중…</div>';
    try {
      if (u) await writeRank(save.rp);
      const top = await topRanks(20);
      if (this.tab !== 'all') return;
      list.innerHTML = top.length ? top.map((t, i) => row(i + 1, t.nick, t.rp || 0, u && t.uid === u.uid)).join('') : '<div class="hint">아직 기록이 없어요</div>';
    } catch (e) {
      console.warn(e);
      list.innerHTML = '<div class="hint">랭킹을 불러오지 못했어요 (인터넷 연결 확인)</div>';
    }
  }
}
