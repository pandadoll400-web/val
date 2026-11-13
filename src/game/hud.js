import * as THREE from 'three';
import { getWeaponIcon } from './gunModels.js';

const $ = (id) => document.getElementById(id);
const TINTS = {
  stealth: 'radial-gradient(ellipse at center, rgba(90,40,200,0) 40%, rgba(90,40,200,.45) 100%)',
  overheat: 'radial-gradient(ellipse at center, rgba(255,90,20,0) 45%, rgba(255,90,20,.4) 100%)',
  shield: 'radial-gradient(ellipse at center, rgba(255,182,39,0) 40%, rgba(255,182,39,.35) 80%, rgba(255,61,242,.35) 100%)',
  echo: 'radial-gradient(ellipse at center, rgba(255,95,184,0) 45%, rgba(255,95,184,.38) 100%)',
  slow: 'radial-gradient(ellipse at center, rgba(120,200,255,0) 45%, rgba(120,200,255,.4) 100%)',
};

export class HUD {
  constructor(game) {
    this.game = game;
    this.el = {
      hud: $('hud'), hpNum: $('hp-num'), hpFill: $('hp-fill'), mag: $('ammo-mag'), res: $('ammo-res'),
      wname: $('hud-wname'), slots: $('slots'), cross: $('crosshair'), hit: $('hitmarker'), scope: $('scope'),
      vignette: $('vignette'), tint: $('tint'), msg: $('center-msg'), feed: $('killfeed'), dmg: $('dmg-layer'),
      score: $('score-label'), mode: $('mode-label'),
    };
    this.dmgNums = [];
    this.speed = $('speedlines');
    this.vignette = 0;
    this.tintKind = undefined;

    $('hud-ammo').classList.remove('hidden');
    this.el.feed.innerHTML = '';
    this.el.dmg.innerHTML = '';
    $('death').classList.add('hidden');
    $('scoreboard').classList.add('hidden');
    this.el.mode.textContent = game.net ? `FROST CANYON · ${{ duel: '듀얼 1대1', duo: '듀오 2대2' }[game.mode]}` : game.mode === 'training' ? 'FROST CANYON · 훈련장' : 'FROST CANYON · 섬멸전';
    $('hud-char').textContent = `${game.character.name} · ${game.character.title}`;

    this.el.slots.innerHTML = game.weapons.slots.map((s, i) => `
      <div data-i="${i}"><span class="sk">${i + 1}</span>${(() => { const ic = getWeaponIcon(s.id, s.model.skin ? s.model.skin + '_' + s.id : null); return ic ? `<img src="${ic}" alt="">` : ''; })()}<span class="sn">${s.def.name}</span></div>`).join('');
    this.skillEls = {};
    for (const k of ['q', 'e']) {
      const el = $('skill-' + k);
      el.querySelector('.sk-name').textContent = game.character[k].name;
      this.skillEls[k] = { el, cd: el.querySelector('.cd'), time: el.querySelector('.sk-time'), bar: el.querySelector('.sk-bar i'), badge: el.querySelector('.sk-badge') };
    }
    this.onWeaponChange();
  }

  onWeaponChange() {
    const w = this.game.weapons;
    if (!w) return;
    this.el.wname.textContent = `${w.def.name} · ${w.def.model}`;
    [...this.el.slots.children].forEach((c, i) => c.classList.toggle('on', i === w.cur));
  }

  msg(text, secs = 1.8) {
    this.tempMsg = text;
    this.tempUntil = performance.now() + secs * 1000;
  }

  hitmarker(kind = 'hit') {
    const h = this.el.hit;
    h.className = '';
    void h.offsetWidth;
    h.className = 'show' + (kind === 'kill' ? ' kill' : kind === 'head' ? ' head' : '');
  }

  damageNumber(pos, amount, head) {
    const el = document.createElement('div');
    el.className = 'dmg' + (head ? ' head' : '');
    el.textContent = amount;
    this.el.dmg.appendChild(el);
    this.dmgNums.push({ el, pos: pos.clone(), t: 0, dx: (Math.random() - 0.5) * 40 });
  }

  hurt(fromPos) {
    this.vignette = Math.min(1, this.vignette + 0.45);
  }

  flashTint(color) {
    const t = this.el.tint;
    t.style.transition = 'none';
    t.style.background = color;
    t.style.opacity = 1;
    void t.offsetWidth;
    t.style.transition = 'opacity .6s';
    t.style.opacity = 0;
    this.tintKind = undefined;
  }

  setTint(kind) {
    if (kind === this.tintKind) return;
    this.tintKind = kind;
    const t = this.el.tint;
    t.style.transition = 'opacity .3s';
    if (kind) { t.style.background = TINTS[kind]; t.style.opacity = 1; } else t.style.opacity = 0;
  }

  skillFlash(k) {
    const el = this.skillEls[k].el;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }

  killfeed(html) {
    const d = document.createElement('div');
    d.className = 'kf';
    d.innerHTML = html;
    this.el.feed.prepend(d);
    setTimeout(() => d.remove(), 5000);
    while (this.el.feed.children.length > 6) this.el.feed.lastChild.remove();
  }

  update(dt) {
    const g = this.game, p = g.player, w = g.weapons, s = w.slot;
    this.el.hpNum.textContent = Math.ceil(p.hp);
    this.el.hpFill.style.width = (p.hp / p.maxHp) * 100 + '%';
    this.el.hpFill.classList.toggle('low', p.hp < 50);
    const melee = s.def.kind === 'melee', nade = s.def.kind === 'grenade';
    this.el.mag.textContent = melee ? '∞' : nade ? s.mag + s.reserve : s.mag;
    this.el.mag.classList.toggle('low', !melee && (nade ? s.mag + s.reserve === 0 : s.mag <= Math.ceil(s.def.mag * 0.25)));
    this.el.res.textContent = melee ? '근접' : nade ? '수류탄' : s.reserve;

    // crosshair
    const spreadPx = w.currentSpread() / Math.tan((g.camera.fov * Math.PI) / 360) * (innerHeight / 2);
    this.el.cross.style.setProperty('--g', Math.max(4, spreadPx) + 'px');
    this.el.cross.style.opacity = w.isAds ? 0 : 1;
    this.el.scope.classList.toggle('hidden', !w.scoped);
    this.el.scope.classList.toggle('chevron', s.def.scopeStyle === 'chevron');
    this.speed.style.opacity = (w.slideAmt * 0.85).toFixed(3);

    // center hints
    let text = '';
    if (this.tempMsg && performance.now() < this.tempUntil) text = this.tempMsg;
    else if (g.skills.charging) text = g.skills.charging.t < 0.25 ? '' : (g.skills.charging.key === 'q' ? 'Q를 떼서 잉크 던지기' : g.character.id === 'nitro' ? 'E를 떼서 불꽃 구체 던지기' : 'E를 떼서 냉기 구체 발사') + (g.skills.charging.t >= 2 ? ' — 최대 충전!' : '');
    else if (melee) text = '';
    else if (nade) text = s.mag + s.reserve === 0 ? '수류탄 없음 — 탄약 상자로 보충' : '';
    else if (w.reloading) text = '재장전 중...';
    else if (s.mag === 0 && s.reserve === 0) text = s.def.kind === 'bow' ? '화살 없음 — 적이 떨군 상자를 주우세요' : '탄약 없음 — 적이 떨군 탄약 상자를 주우세요';
    else if (s.mag === 0) text = s.def.kind === 'bow' ? '' : 'R — 재장전';
    else if (s.mag <= Math.ceil(s.def.mag * 0.25) && s.reserve > 0) text = '탄약 부족 — R';
    if (this.el.msg.textContent !== text) this.el.msg.textContent = text;

    // skills
    for (const k of ['q', 'e']) {
      const se = this.skillEls[k], cd = g.skills.cd[k], max = g.character[k].cd;
      se.cd.style.setProperty('--p', (cd > 0 ? (cd / max) * 100 : 0) + '%');
      se.time.textContent = cd > 0.05 ? Math.ceil(cd) : '';
      se.el.classList.toggle('ready', cd <= 0);
    }
    if (g.skills.marker) this.skillEls.e.time.textContent = '↩';
    const ch = g.skills.charging;
    for (const k of ['q', 'e']) {
      const on = !!ch && ch.key === k;
      this.skillEls[k].el.classList.toggle('charging', on);
      this.skillEls[k].bar.style.width = on ? Math.min(100, Math.max(0, (ch.t - 0.25) / 1.75) * 100) + '%' : '0%';
    }
    this.skillEls.e.el.classList.toggle('fire', g.character.id === 'nitro');
    this.skillEls.q.el.classList.toggle('ink', g.character.id === 'inker');
    const steam = g.skills.inSteam;
    if (this._steam !== steam) { this._steam = steam; document.getElementById('steam-overlay').classList.toggle('on', !!steam); }
    const badge = g.character.id === 'ghost' ? (g.skills.souls > 0 ? '👻' + g.skills.souls : '') : g.skills.echoBuffT > 0 ? '×1.5' : '';
    const eb = this.skillEls.e.badge, ebt = g.character.id === 'glitch' ? '◈'.repeat(g.skills.glitchStacks) : '';
    if (eb.textContent !== ebt) eb.textContent = ebt;
    eb.classList.toggle('on', !!ebt);
    eb.classList.toggle('glitch', !!ebt);
    // blinded by an enemy Glitch
    const blind = p.blindT > 0;
    if (this._blind !== blind) { this._blind = blind; document.getElementById('glitch-overlay').classList.toggle('hidden', !blind); }
    const qb = this.skillEls.q.badge;
    if (qb.textContent !== badge) qb.textContent = badge;
    qb.classList.toggle('on', !!badge);

    // vignette (also low health pulse)
    this.vignette = Math.max(0, this.vignette - dt * 1.2);
    const low = p.alive && p.hp < 50 ? 0.35 + Math.sin(performance.now() * 0.006) * 0.12 : 0;
    this.el.vignette.style.opacity = Math.max(this.vignette, low);

    // damage numbers
    const v = new THREE.Vector3();
    for (let i = this.dmgNums.length - 1; i >= 0; i--) {
      const d = this.dmgNums[i];
      d.t += dt;
      v.copy(d.pos).project(g.camera);
      const behind = v.z > 1;
      d.el.style.left = ((v.x + 1) / 2) * innerWidth + d.dx * d.t + 'px';
      d.el.style.top = ((1 - v.y) / 2) * innerHeight - d.t * 60 + 'px';
      d.el.style.opacity = behind ? 0 : Math.max(0, 1 - d.t / 0.9);
      if (d.t > 0.9) { d.el.remove(); this.dmgNums.splice(i, 1); }
    }

    this.el.score.textContent = g.net ? g.scoreText() : g.mode === 'training'
      ? `처치 ${g.kills} · 명중률 ${g.shots ? Math.round((g.hits / g.shots) * 100) : 0}% · 헤드샷 ${g.headshots}`
      : `처치 ${g.kills} / ${g.totalEnemies}`;
  }

  dispose() {
    this.el.dmg.innerHTML = '';
    this.el.feed.innerHTML = '';
    this.el.msg.textContent = '';
    this.el.tint.style.opacity = 0;
    this.el.vignette.style.opacity = 0;
    this.el.scope.classList.add('hidden');
  }
}
