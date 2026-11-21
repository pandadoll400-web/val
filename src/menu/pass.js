import { save, persist } from '../save.js';
import {
  SEASON_NAME, XP_PER_LEVEL, MAX_LEVEL, TITLES, ROYAL_TITLES, ROYAL_PRICE, ROYAL_XP_MULT,
  freeReward, royalRewards, dupeCoins, levelOf, levelProgress,
} from '../data/pass.js';
import { getBundle } from '../data/skins.js';
import { getCharSkin } from '../data/charSkins.js';
import { getCharacter } from '../data/characters.js';
import { WEAPONS } from '../data/weapons.js';
import { getWeaponIcon } from '../game/gunModels.js';
import { getPortrait } from './ui.js';
import { audio } from '../audio.js';
import { currentUser } from '../net/auth.js';

/** the season pass is on the "hack" account only for now */
export const passOn = () => (currentUser()?.nick || '').toLowerCase() === 'hack';

const $ = (id) => document.getElementById(id);
let onLevelUp = null;
/** the game sets this to show "level up" on its HUD */
export function setLevelNotifier(fn) { onLevelUp = fn; }

export const myLevel = () => levelOf(save.xp);

/** add XP (royal pass: ×1.3); returns { gained, from, to } */
export function addXp(n) {
  if (!passOn()) return null;
  n = Math.max(0, Math.round(n * (save.royal ? ROYAL_XP_MULT : 1)));
  const from = levelOf(save.xp);
  save.xp = (save.xp || 0) + n;
  const to = levelOf(save.xp);
  if (to > from) onLevelUp?.(`🎉 레벨 업! Lv.${to} — 메뉴의 🏛️ 시즌 패스에서 보상 받기`);
  persist(true);
  return { gained: n, from, to };
}

/** "+XP 320 · Lv.12 ▮▮▮▯" line for the result screen */
export function xpLine(r) {
  if (!r) return '';
  const p = levelProgress(save.xp);
  return `<div class="xp-line">+XP <b>${r.gained}</b>${save.royal ? ' <span class="royal-tag">👑×1.3</span>' : ''} · Lv.${r.to}${r.to > r.from ? ' <span class="lvup">🎉 레벨 업!</span>' : ''}
    <span class="xp-bar"><i style="width:${p * 100}%"></i></span><small>${Math.round(p * XP_PER_LEVEL)} / ${XP_PER_LEVEL}</small></div>`.replace(/\n\s*/g, ' ');
}

/* ---------- rewards: owned check, picture, granting ---------- */
function isOwned(r) {
  if (r.type === 'skin') return save.ownedSkins.includes(r.sid);
  if (r.type === 'outfit') return save.ownedOutfits.includes(r.id);
  if (r.type === 'weapon') return save.ownedWeapons.includes(r.id);
  if (r.type === 'title') return save.titles.includes(r.t);
  return false;
}

function rewardName(r) {
  if (r.type === 'coins') return `◆${r.n.toLocaleString()}`;
  if (r.type === 'title') return `칭호 「${r.t}」`;
  if (r.type === 'weapon') return `${WEAPONS[r.id].name} (무기)`;
  if (r.type === 'outfit') return `${getCharSkin(r.id).name} (캐릭터 스킨)`;
  const [bid, wid] = r.sid.split('_');
  return `${WEAPONS[wid].name} 스킨 · ${getBundle(bid).name.replace(/^[^\p{L}]+/u, '')}`;
}

/** a picture of the reward (weapon/skin icon, character portrait, coin or title badge) */
function rewardPic(r) {
  let img = '';
  if (r.type === 'skin') { const [, wid] = r.sid.split('_'); img = getWeaponIcon(wid, r.sid); }
  else if (r.type === 'weapon') img = getWeaponIcon(r.id);
  else if (r.type === 'outfit') { const k = getCharSkin(r.id); img = getPortrait(getCharacter(k.char), r.id); }
  if (r.type === 'coins') return `<div class="rw-pic coin"><span>◆</span></div>`;
  if (r.type === 'title') return `<div class="rw-pic title"><span>🎖️</span></div>`;
  return `<div class="rw-pic ${r.type}">${img ? `<img src="${img}" alt="">` : '🎁'}</div>`;
}

/** give a reward; returns the toast text for it */
function grant(r) {
  if (r.type !== 'coins' && r.type !== 'title' && isOwned(r)) { save.coins += dupeCoins(r); return `${rewardName(r)} 보유 중 → ◆${dupeCoins(r)}`; }
  if (r.type === 'coins') save.coins += r.n;
  else if (r.type === 'title') { if (!save.titles.includes(r.t)) save.titles.push(r.t); if (!save.title) save.title = r.t; }
  else if (r.type === 'skin') {
    save.ownedSkins.push(r.sid);
    const wid = r.sid.split('_')[1];
    if (!save.skins[wid]) save.skins[wid] = r.sid;
  } else if (r.type === 'outfit') save.ownedOutfits.push(r.id);
  else if (r.type === 'weapon') save.ownedWeapons.push(r.id);
  return rewardName(r);
}

const freeDue = (l) => l <= myLevel() && !save.passGot[l];
const royalDue = (l) => save.royal && l <= myLevel() && !save.royalGot[l];

/** menu button + popup */
export class PassUI {
  constructor({ ui }) {
    this.ui = ui;
    const btn = document.createElement('button');
    btn.id = 'pass-btn';
    btn.className = 'btn ghost pass-btn';
    btn.onclick = () => this.open();
    // sits under the shop button so it never covers the title
    const shop = $('btn-shop');
    shop.parentNode.insertBefore(btn, shop.nextSibling);
    const pop = document.createElement('div');
    pop.id = 'pass-pop';
    pop.className = 'advent-pop hidden';
    pop.innerHTML = `<div class="advent-card pass-card">
        <div class="advent-head"><b>${SEASON_NAME} 패스</b><small id="pass-sub"></small><button class="x" id="pass-close">✕</button></div>
        <div class="royal-box" id="royal-box"></div>
        <div class="pass-xp" id="pass-xp"></div>
        <div class="pass-rows"><div class="pr-lab"><span>무료</span><span class="r">👑 로얄</span></div><div class="pass-track" id="pass-track"></div></div>
        <div class="pass-titles" id="pass-titles"></div>
        <div class="advent-foot">판마다 XP: 기본 50 · 처치 20 · 헤드샷 +10 · 승리 +150 · 온라인 ×1.2 · 미션 보상 +50 · 👑 로얄 ×1.3 · 이미 가진 보상은 ◆로 바뀌어요</div>
      </div>`;
    $('menu').appendChild(pop);
    $('pass-close').onclick = () => this.close();
    pop.addEventListener('click', (e) => { if (e.target === pop) this.close(); });
    const prev = ui.onRefresh;
    ui.onRefresh = () => { prev?.(); this.update(); };
    this.update();
  }

  /** levels with something waiting */
  pending() {
    const out = [];
    for (let l = 1; l <= myLevel(); l++) if (freeDue(l) || royalDue(l)) out.push(l);
    return out;
  }

  update() {
    const btn = $('pass-btn');
    btn.classList.toggle('hidden', !passOn());
    if (!passOn()) { this.close(); return; }
    const lv = myLevel();
    btn.innerHTML = `<span class="pb-name">${save.royal ? '👑' : '🏛️'} 페르세폴리스 시즌</span><span class="pb-lv">Lv.${lv}</span><span class="pb-bar"><i style="width:${levelProgress(save.xp) * 100}%"></i></span>`;
    btn.classList.toggle('ready', this.pending().length > 0);
    btn.classList.toggle('royal', !!save.royal);
    if (!$('pass-pop').classList.contains('hidden')) this.render();
  }

  open() { this.render(); $('pass-pop').classList.remove('hidden'); this.scrollToCurrent(); }
  close() { $('pass-pop').classList.add('hidden'); }

  scrollToCurrent() {
    const t = $('pass-track'), cur = t.querySelector('.pv.claim, .pv.cur');
    if (cur) t.scrollLeft = cur.offsetLeft - t.clientWidth / 2 + cur.clientWidth / 2;
  }

  cellBox(rs, got, royal) {
    const r = rs[0], extra = rs.slice(1);
    const dupe = !got && r.type !== 'coins' && r.type !== 'title' && isOwned(r);
    return `<div class="pbox ${royal ? 'royal' : ''} ${got ? 'got' : ''} ${royal && !save.royal ? 'locked' : ''}" title="${rs.map(rewardName).join(' + ')}">
      ${rewardPic(r)}<small>${rewardName(r)}${extra.map((x) => `<br>＋${rewardName(x)}`).join('')}${dupe ? `<br><em class="dupe">보유 중 → ◆${dupeCoins(r)}</em>` : ''}</small>
      ${got ? '<i class="ok">✓</i>' : royal && !save.royal ? '<i class="lk">🔒</i>' : ''}</div>`;
  }

  render() {
    const lv = myLevel(), p = levelProgress(save.xp);
    $('pass-sub').textContent = `Lv.${lv}${lv > MAX_LEVEL ? ` (${MAX_LEVEL} 이후 레벨마다 ◆100${save.royal ? ' +◆200' : ''})` : ` / ${MAX_LEVEL}`}`;
    $('royal-box').innerHTML = save.royal
      ? '<div class="royal-on">👑 로얄 패스 활성 · XP ×1.3 · 아래 금색 줄 보상도 함께 받아요</div>'
      : `<div class="royal-buy"><div><b>👑 로얄 패스</b><small>금색 보상 줄 추가 · 5레벨마다 무기 스킨 · 45레벨 경찰관 볼트 · 50레벨 🏛️ 페르세 테이저건 스킨 + 「👑 페르시아의 왕」 + ◆5000 · 레벨마다 ◆300~600 · XP ×1.3</small></div>
          <button class="btn primary small" id="royal-buy" ${save.coins < ROYAL_PRICE ? 'disabled' : ''}>${save.coins < ROYAL_PRICE ? `◆ 부족 (◆${ROYAL_PRICE.toLocaleString()})` : `◆${ROYAL_PRICE.toLocaleString()} 구매`}</button></div>`;
    const rb = $('royal-buy');
    if (rb) rb.onclick = () => this.buyRoyal();
    $('pass-xp').innerHTML = `<span>Lv.${lv}</span><span class="xp-bar big"><i style="width:${p * 100}%"></i></span><small>${Math.round(p * XP_PER_LEVEL)} / ${XP_PER_LEVEL} XP</small>`;
    const cells = [];
    for (let l = 1; l <= MAX_LEVEL; l++) {
      const fr = freeReward(l), rr = royalRewards(l);
      const due = freeDue(l) || royalDue(l);
      const st = due ? 'claim' : l <= lv ? 'got' : l === lv + 1 ? 'cur' : 'lock';
      const big = fr.type !== 'coins' || l === MAX_LEVEL;
      cells.push(`<div class="pv ${st} ${big ? 'big' : ''}"><b>${l}</b>
        ${this.cellBox([fr], !!save.passGot[l], false)}
        ${this.cellBox(rr, !!save.royalGot[l], true)}
        ${due ? `<button class="btn primary small pv-claim" data-l="${l}">받기</button>` : l > lv ? '<em>🔒</em>' : '<em>✓</em>'}</div>`);
    }
    const extra = this.pending().filter((l) => l > MAX_LEVEL).length;
    if (extra) cells.push(`<div class="pv claim big"><b>${MAX_LEVEL + 1}+</b>
      <div class="pbox"><div class="rw-pic coin"><span>◆</span></div><small>◆100 × ${extra}</small></div>
      <div class="pbox royal ${save.royal ? '' : 'locked'}"><div class="rw-pic coin"><span>◆</span></div><small>◆200 × ${extra}</small></div>
      <button class="btn primary small pv-claim" data-l="extra">받기</button></div>`);
    $('pass-track').innerHTML = cells.join('');
    $('pass-track').querySelectorAll('.pv-claim').forEach((b) => (b.onclick = () => this.claim(b.dataset.l)));
    const titles = save.titles;
    const tbtn = (t, royal) => titles.includes(t)
      ? `<button class="skin-opt ${royal ? 'royal' : ''} ${save.title === t ? 'on' : ''}" data-t="${t}">${royal ? '' : '🎖️ '}${t}</button>`
      : `<button class="skin-opt locked ${royal ? 'royal' : ''}" disabled>🔒 ${t}</button>`;
    $('pass-titles').innerHTML = `<span>칭호</span><button class="skin-opt ${!save.title ? 'on' : ''}" data-t="">없음</button>` +
      TITLES.map((t) => tbtn(t, false)).join('') + ROYAL_TITLES.map((t) => tbtn(t, true)).join('');
    $('pass-titles').querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { save.title = b.dataset.t; persist(); this.render(); }));
  }

  buyRoyal() {
    if (save.royal || !passOn()) return;
    if (save.coins < ROYAL_PRICE) { this.ui.toast(`코인이 부족합니다 (◆ ${(ROYAL_PRICE - save.coins).toLocaleString()} 더 필요)`); return; }
    if (!confirm(`👑 로얄 패스를 ◆${ROYAL_PRICE.toLocaleString()}에 구매할까요?`)) return;
    save.coins -= ROYAL_PRICE;
    save.royal = true;
    persist();
    audio.init(); audio.kill();
    this.ui.toast('👑 로얄 패스 활성! 지난 레벨의 로얄 보상도 지금 받을 수 있어요');
    this.ui.refresh();
    this.render();
  }

  claim(which) {
    const lvls = which === 'extra' ? this.pending().filter((l) => l > MAX_LEVEL) : [+which];
    const msgs = [];
    for (const l of lvls) {
      if (freeDue(l)) { msgs.push(grant(freeReward(l))); save.passGot[l] = true; }
      if (royalDue(l)) { for (const r of royalRewards(l)) msgs.push('👑' + grant(r)); save.royalGot[l] = true; }
    }
    if (!msgs.length) return;
    persist();
    audio.init(); audio.kill();
    this.ui.toast(`🏛️ 패스 보상: ${msgs.length > 4 ? `${msgs.slice(0, 4).join(' · ')} 외 ${msgs.length - 4}개` : msgs.join(' · ')}`);
    this.ui.refresh();
    this.render();
  }
}
