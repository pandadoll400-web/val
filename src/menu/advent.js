import { save, persist } from '../save.js';
import { BUNDLES, skinId, getBundle } from '../data/skins.js';
import { WEAPONS } from '../data/weapons.js';
import { currentUser } from '../net/auth.js';
import { audio } from '../audio.js';

/*
 * Christmas calendar (Dec 1 – 25). Shows up for everyone on December 1st; the "hack" account sees it
 * early and may open any box. Each box can only be opened on its own day.
 *   1–23: 40–50 coins · 24: a random weapon skin · 25: Bloom's Christmas skin
 */
const YEAR = 2026, LAST = 25;
const isHack = () => (currentUser()?.nick || '').toLowerCase() === 'hack';
const $ = (id) => document.getElementById(id);

function today() {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
}

function treeSvg() {
  const lights = [];
  const cols = ['#ff3a4a', '#ffd24a', '#3fa8ff', '#ff7ad8', '#7dffb0'];
  [[70, 70, 3], [55, 115, 4], [40, 165, 5], [28, 215, 6]].forEach(([x0, y, n], row) => {
    for (let i = 0; i < n; i++) { const x = x0 + (i * (190 - 2 * x0)) / (n - 1); lights.push(`<circle class="light" cx="${x}" cy="${y + Math.sin(i * 1.7) * 6}" r="5" fill="${cols[(i + row) % 5]}"/>`); }
  });
  const balls = [[80, 95, '#d81e2a'], [118, 140, '#ffd24a'], [62, 190, '#3f7bff'], [128, 200, '#d81e2a'], [95, 160, '#e8e8f0']]
    .map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="8" fill="${c}" stroke="#fff6" stroke-width="1.5"/>`).join('');
  return `<div class="xtree" id="xtree"><svg viewBox="0 0 190 300">
    <rect x="83" y="235" width="24" height="30" fill="#6a3a1a"/>
    <polygon points="95,30 140,95 50,95" fill="#1f8a3a"/><polygon points="95,60 155,140 35,140" fill="#1a7a32"/>
    <polygon points="95,95 170,190 20,190" fill="#16702c"/><polygon points="95,135 185,240 5,240" fill="#126226"/>
    <path d="M55 95 Q95 110 140 92 M40 140 Q95 160 152 136 M25 190 Q95 212 168 186" stroke="#ffd24a" stroke-width="3" fill="none" opacity=".8"/>
    ${balls}${lights.join('')}
    <polygon class="star" points="95,6 101,19 115,20 104,29 108,43 95,35 82,43 86,29 75,20 89,19" fill="#ffd24a"/>
    <rect x="30" y="258" width="38" height="32" rx="3" fill="#d81e2a"/><rect x="46" y="258" width="6" height="32" fill="#ffd24a"/>
    <rect x="118" y="262" width="44" height="28" rx="3" fill="#3f7bff"/><rect x="137" y="262" width="6" height="28" fill="#fff"/>
    <rect x="75" y="270" width="36" height="22" rx="3" fill="#2aa04a"/><rect x="90" y="270" width="6" height="22" fill="#ffd24a"/>
  </svg></div>`;
}

export class AdventUI {
  constructor({ ui }) {
    this.ui = ui;
    const btn = document.createElement('button');
    btn.id = 'advent-btn';
    btn.className = 'advent-btn hidden';
    btn.innerHTML = '🎄 <span>크리스마스 캘린더</span>';
    btn.onclick = () => this.open();
    $('menu').appendChild(btn);
    const pop = document.createElement('div');
    pop.id = 'advent-pop';
    pop.className = 'advent-pop hidden';
    pop.innerHTML = `<div class="advent-card">
        <div class="advent-head"><b>🎄 크리스마스 캘린더</b><small>하루 한 칸 · 그날만 열 수 있어요</small><button class="x" id="advent-close">✕</button></div>
        <div class="advent-grid" id="advent-grid"></div>
        <div class="advent-foot">1~23일 ◆40~50 · 24일 🎁 랜덤 무기 스킨 · 25일 🌲 블룸 크리스마스 스킨</div>
      </div>`;
    $('menu').appendChild(pop);
    $('advent-close').onclick = () => this.close();
    pop.addEventListener('click', (e) => { if (e.target === pop) this.close(); });
    ui.onRefresh = () => this.update();
    this.update();
  }

  get data() {
    if (!save.advent || save.advent.y !== YEAR) save.advent = { y: YEAR, got: {} };
    return save.advent;
  }

  /** is the calendar on right now (December 1st to 25th), or is this the hack account (early preview) */
  get active() {
    const t = today();
    return (t.y === YEAR && t.m === 12 && t.d <= LAST) || isHack();
  }

  update() {
    $('advent-btn').classList.toggle('hidden', !this.active);
    const t = today();
    const openable = t.y === YEAR && t.m === 12 && t.d <= LAST && !this.data.got[t.d];
    $('advent-btn').classList.toggle('ready', openable || (isHack() && Object.keys(this.data.got).length < LAST));
    if (!$('advent-pop').classList.contains('hidden')) this.render();
  }

  open() {
    this.render();
    const pop = $('advent-pop');
    // v2.1 (hack only): a Christmas tree stands next to the calendar
    pop.classList.toggle('tree', isHack());
    if (isHack() && !$('xtree')) pop.insertAdjacentHTML('beforeend', treeSvg());
    $('xtree')?.classList.toggle('hidden', !isHack());
    pop.classList.remove('hidden');
  }
  close() { $('advent-pop').classList.add('hidden'); }

  state(day) {
    const got = this.data.got[day];
    if (got) return 'got';
    if (isHack()) return 'open';
    const t = today();
    if (t.y !== YEAR || t.m !== 12) return 'future';
    if (day === t.d) return 'open';
    return day < t.d ? 'missed' : 'future';
  }

  render() {
    const icon = (d) => (d === 25 ? '🌲' : d === 24 ? '🎁' : '◆');
    $('advent-grid').innerHTML = Array.from({ length: LAST }, (_, i) => i + 1).map((d) => {
      const st = this.state(d), got = this.data.got[d];
      const body = st === 'got' ? `<i>✓</i><small>${got}</small>` : st === 'open' ? `<i>${icon(d)}</i><small>열기!</small>` : st === 'missed' ? '<i>✕</i><small>놓침</small>' : `<i>🔒</i><small>${icon(d)}</small>`;
      return `<button class="adv ${st} ${d >= 24 ? 'big' : ''}" data-d="${d}" ${st === 'open' ? '' : 'disabled'}><b>${d}</b>${body}</button>`;
    }).join('');
    $('advent-grid').querySelectorAll('.adv.open').forEach((b) => (b.onclick = () => this.claim(+b.dataset.d)));
  }

  claim(day) {
    if (this.state(day) !== 'open') return;
    let label;
    if (day === 25) {
      if (!save.ownedOutfits.includes('xmas_bloom')) save.ownedOutfits.push('xmas_bloom');
      save.outfits.bloom = 'xmas_bloom';
      label = '블룸 스킨';
      this.ui.toast('🌲 메리 크리스마스! 트리 정원사 블룸 스킨을 받았어요 (캐릭터 탭 → 블룸)');
    } else if (day === 24) {
      const pool = [];
      for (const b of BUNDLES) if (!b.soon && !b.season && !b.hackOnly) for (const w of b.weapons) if (!save.ownedSkins.includes(skinId(b.id, w))) pool.push(skinId(b.id, w));
      if (pool.length) {
        const sid = pool[Math.floor(Math.random() * pool.length)];
        const [bid, wid] = sid.split('_');
        save.ownedSkins.push(sid);
        label = '무기 스킨';
        this.ui.toast(`🎁 ${getBundle(bid).name} · ${WEAPONS[wid].name} 스킨을 받았어요! (무기 탭)`);
      } else {
        save.coins += 500;
        label = '◆500';
        this.ui.toast('🎁 스킨을 모두 가지고 있어 ◆500을 받았어요!');
      }
    } else {
      const n = 40 + Math.floor(Math.random() * 11);
      save.coins += n;
      label = `◆${n}`;
      this.ui.toast(`🎄 ${day}일 선물: ◆${n}`);
    }
    this.data.got[day] = label;
    persist();
    audio.init(); audio.kill();
    this.ui.refresh();
    this.render();
  }
}
