import { save, persist } from '../save.js';
import { SEASON_NAME, XP_PER_LEVEL, MAX_LEVEL, TITLES, passReward, levelOf, levelProgress } from '../data/pass.js';
import { BUNDLES, skinId, getBundle } from '../data/skins.js';
import { WEAPONS } from '../data/weapons.js';
import { audio } from '../audio.js';
import { currentUser } from '../net/auth.js';

/** v2.0: the season pass is on the "hack" account only for now */
export const passOn = () => (currentUser()?.nick || '').toLowerCase() === 'hack';

const $ = (id) => document.getElementById(id);
let onLevelUp = null;
/** the game sets this to show "level up" on its HUD */
export function setLevelNotifier(fn) { onLevelUp = fn; }

export const myLevel = () => levelOf(save.xp);

/** add XP; returns { gained, from, to } */
export function addXp(n) {
  if (!passOn()) return null;
  n = Math.max(0, Math.round(n));
  const from = levelOf(save.xp);
  save.xp = (save.xp || 0) + n;
  const to = levelOf(save.xp);
  if (to > from) onLevelUp?.(`🎉 레벨 업! Lv.${to} — 메뉴의 🏅 시즌 패스에서 보상 받기`);
  persist(true);
  return { gained: n, from, to };
}

/** "+XP 320 · Lv.12 ▮▮▮▯" line for the result screen */
export function xpLine(r) {
  if (!r) return '';
  const p = levelProgress(save.xp);
  return `<div class="xp-line">+XP <b>${r.gained}</b> · Lv.${r.to}${r.to > r.from ? ' <span class="lvup">🎉 레벨 업!</span>' : ''}
    <span class="xp-bar"><i style="width:${p * 100}%"></i></span><small>${Math.round(p * XP_PER_LEVEL)} / ${XP_PER_LEVEL}</small></div>`.replace(/\n\s*/g, ' ');
}

/** a weapon skin this save does not own (bundles that are not out yet excluded), or null */
function randomWeaponSkin() {
  const pool = [];
  for (const b of BUNDLES) if (!b.soon && !b.hackOnly) for (const w of b.weapons) if (!save.ownedSkins.includes(skinId(b.id, w))) pool.push(skinId(b.id, w));
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}

const canClaim = (lvl) => lvl <= myLevel() && !save.passGot[lvl];

/** menu button + popup */
export class PassUI {
  constructor({ ui }) {
    this.ui = ui;
    const btn = document.createElement('button');
    btn.id = 'pass-btn';
    btn.className = 'missions-btn pass-btn';
    btn.onclick = () => this.open();
    $('menu').appendChild(btn);
    const pop = document.createElement('div');
    pop.id = 'pass-pop';
    pop.className = 'advent-pop hidden';
    pop.innerHTML = `<div class="advent-card pass-card">
        <div class="advent-head"><b>🏅 ${SEASON_NAME} 패스</b><small id="pass-sub"></small><button class="x" id="pass-close">✕</button></div>
        <div class="pass-xp" id="pass-xp"></div>
        <div class="pass-track" id="pass-track"></div>
        <div class="pass-titles" id="pass-titles"></div>
        <div class="advent-foot">판마다 XP: 기본 50 · 처치 20 · 헤드샷 +10 · 승리 +150 · 온라인 ×1.2 · 미션 보상 +50</div>
      </div>`;
    $('menu').appendChild(pop);
    $('pass-close').onclick = () => this.close();
    pop.addEventListener('click', (e) => { if (e.target === pop) this.close(); });
    const prev = ui.onRefresh;
    ui.onRefresh = () => { prev?.(); this.update(); };
    this.update();
  }

  /** levels with a reward waiting (past 30 they are claimed in one go) */
  pending() {
    const out = [];
    for (let l = 1; l <= myLevel(); l++) if (!save.passGot[l]) out.push(l);
    return out;
  }

  update() {
    const btn = $('pass-btn');
    btn.classList.toggle('hidden', !passOn());
    if (!passOn()) { this.close(); return; }
    const lv = myLevel();
    btn.innerHTML = `🏅 <span>Lv.${lv}</span><span class="pb-bar"><i style="width:${levelProgress(save.xp) * 100}%"></i></span>`;
    btn.classList.toggle('ready', this.pending().length > 0);
    btn.classList.toggle('low', !$('advent-btn')?.classList.contains('hidden'));
    if (!$('pass-pop').classList.contains('hidden')) this.render();
  }

  open() { this.render(); $('pass-pop').classList.remove('hidden'); this.scrollToCurrent(); }
  close() { $('pass-pop').classList.add('hidden'); }

  scrollToCurrent() {
    const t = $('pass-track'), cur = t.querySelector('.pv.claim, .pv.cur');
    if (cur) t.scrollLeft = cur.offsetLeft - t.clientWidth / 2 + cur.clientWidth / 2;
  }

  render() {
    const lv = myLevel(), p = levelProgress(save.xp);
    $('pass-sub').textContent = `Lv.${lv}${lv > MAX_LEVEL ? ' (30 이후 레벨마다 ◆100)' : ` / ${MAX_LEVEL}`}`;
    $('pass-xp').innerHTML = `<span>Lv.${lv}</span><span class="xp-bar big"><i style="width:${p * 100}%"></i></span><small>${Math.round(p * XP_PER_LEVEL)} / ${XP_PER_LEVEL} XP</small>`;
    const cells = [];
    for (let l = 1; l <= MAX_LEVEL; l++) {
      const r = passReward(l), got = save.passGot[l], st = got ? 'got' : l <= lv ? 'claim' : l === lv + 1 ? 'cur' : 'lock';
      const icon = r.title ? '🎖️' : r.skin ? '🎁' : '◆';
      const what = [r.title ? `칭호 「${r.title}」` : '', r.skin ? '랜덤 무기 스킨' : '', `◆${r.coins}`].filter(Boolean).join('<br>');
      cells.push(`<div class="pv ${st} ${r.title || r.skin || l === 30 ? 'big' : ''}"><b>${l}</b><i>${icon}</i><small>${what}</small>
        ${st === 'claim' ? `<button class="btn primary small pv-claim" data-l="${l}">받기</button>` : st === 'got' ? '<em>✓</em>' : '<em>🔒</em>'}</div>`);
    }
    const extra = this.pending().filter((l) => l > MAX_LEVEL).length;
    if (extra) cells.push(`<div class="pv claim big"><b>31+</b><i>◆</i><small>◆100 × ${extra}</small><button class="btn primary small pv-claim" data-l="extra">받기</button></div>`);
    $('pass-track').innerHTML = cells.join('');
    $('pass-track').querySelectorAll('.pv-claim').forEach((b) => (b.onclick = () => this.claim(b.dataset.l)));
    const titles = save.titles;
    $('pass-titles').innerHTML = `<span>칭호</span><button class="skin-opt ${!save.title ? 'on' : ''}" data-t="">없음</button>` +
      Object.values(TITLES).map((t) => titles.includes(t)
        ? `<button class="skin-opt ${save.title === t ? 'on' : ''}" data-t="${t}">🎖️ ${t}</button>`
        : `<button class="skin-opt locked" disabled>🔒 ${t}</button>`).join('');
    $('pass-titles').querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { save.title = b.dataset.t; persist(); this.render(); }));
  }

  claim(which) {
    const lvls = which === 'extra' ? this.pending().filter((l) => l > MAX_LEVEL) : [+which];
    const msgs = [];
    for (const l of lvls) {
      if (!canClaim(l)) continue;
      const r = passReward(l);
      let coins = r.coins;
      if (r.title && !save.titles.includes(r.title)) { save.titles.push(r.title); if (!save.title) save.title = r.title; msgs.push(`칭호 「${r.title}」`); }
      if (r.skin) {
        const sid = randomWeaponSkin();
        if (sid) {
          save.ownedSkins.push(sid);
          const [bid, wid] = sid.split('_');
          msgs.push(`${getBundle(bid).name} · ${WEAPONS[wid].name} 스킨`);
        } else coins += 500;
      }
      save.coins += coins;
      save.passGot[l] = true;
      msgs.unshift(`◆${coins}`);
    }
    if (!msgs.length) return;
    persist();
    audio.init(); audio.kill();
    this.ui.toast(`🏅 패스 보상: ${msgs.join(' · ')}`);
    this.ui.refresh();
    this.render();
  }
}
