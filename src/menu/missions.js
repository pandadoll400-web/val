import { save, persist } from '../save.js';
import { MISSION_TYPES, missionsFor, todayStr } from '../data/missions.js';
import { audio } from '../audio.js';

const $ = (id) => document.getElementById(id);
let onComplete = null;
/** the game sets this to show "mission complete" on its HUD */
export function setMissionNotifier(fn) { onComplete = fn; }

/** today's missions (replaced at local midnight) */
export function dailyList() {
  const date = todayStr();
  if (!save.daily || save.daily.date !== date || !Array.isArray(save.daily.list)) save.daily = { date, list: missionsFor(date) };
  return save.daily.list;
}

/** count progress for a mission type */
export function track(type, n = 1) {
  let changed = false;
  for (const m of dailyList()) {
    if (m.type !== type || m.prog >= m.target) continue;
    m.prog = Math.min(m.target, m.prog + n);
    changed = true;
    if (m.prog >= m.target) onComplete?.(`📋 미션 완료: ${MISSION_TYPES[m.type].text(m.target)} — 메뉴에서 ◆${m.reward} 받기`);
  }
  if (changed) persist(true);
}

export const missionText = (m) => MISSION_TYPES[m.type].text(m.target);

/** menu button + popup */
export class MissionsUI {
  constructor({ ui }) {
    this.ui = ui;
    const btn = document.createElement('button');
    btn.id = 'missions-btn';
    btn.className = 'missions-btn';
    btn.innerHTML = '📋 <span>일일 미션</span>';
    btn.onclick = () => this.open();
    $('menu').appendChild(btn);
    const pop = document.createElement('div');
    pop.id = 'missions-pop';
    pop.className = 'advent-pop hidden';
    pop.innerHTML = `<div class="advent-card missions-card">
        <div class="advent-head"><b>📋 일일 미션</b><small>매일 자정에 바뀌어요</small><button class="x" id="missions-close">✕</button></div>
        <div id="missions-list" class="missions-list"></div>
      </div>`;
    $('menu').appendChild(pop);
    $('missions-close').onclick = () => this.close();
    pop.addEventListener('click', (e) => { if (e.target === pop) this.close(); });
    const prev = ui.onRefresh;
    ui.onRefresh = () => { prev?.(); this.update(); };
    this.update();
  }

  update() {
    const list = dailyList();
    const ready = list.some((m) => m.prog >= m.target && !m.claimed);
    const btn = $('missions-btn');
    btn.classList.toggle('ready', ready);
    // sits under the calendar button when that one is showing
    btn.classList.toggle('low', !$('advent-btn')?.classList.contains('hidden'));
    if (!$('missions-pop').classList.contains('hidden')) this.render();
  }

  open() { this.render(); $('missions-pop').classList.remove('hidden'); }
  close() { $('missions-pop').classList.add('hidden'); }

  render() {
    $('missions-list').innerHTML = dailyList().map((m, i) => {
      const done = m.prog >= m.target;
      return `<div class="mission ${m.claimed ? 'claimed' : done ? 'done' : ''}">
        <div class="m-top"><b>${missionText(m)}</b><span class="m-rew">◆${m.reward}</span></div>
        <div class="m-bar"><i style="width:${(m.prog / m.target) * 100}%"></i></div>
        <div class="m-foot"><span>${m.prog} / ${m.target}</span>
          <button class="btn primary small m-claim" data-i="${i}" ${done && !m.claimed ? '' : 'disabled'}>${m.claimed ? '받음 ✓' : done ? '받기' : '진행 중'}</button></div>
      </div>`;
    }).join('');
    $('missions-list').querySelectorAll('.m-claim').forEach((b) => (b.onclick = () => this.claim(+b.dataset.i)));
  }

  claim(i) {
    const m = dailyList()[i];
    if (!m || m.claimed || m.prog < m.target) return;
    m.claimed = true;
    save.coins += m.reward;
    persist();
    audio.init(); audio.kill();
    this.ui.toast(`미션 보상 ◆${m.reward}!`);
    this.ui.refresh();
  }
}
