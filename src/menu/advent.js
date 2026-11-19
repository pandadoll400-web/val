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

  open() { this.render(); $('advent-pop').classList.remove('hidden'); }
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
      for (const b of BUNDLES) if (!b.soon) for (const w of b.weapons) if (!save.ownedSkins.includes(skinId(b.id, w))) pool.push(skinId(b.id, w));
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
