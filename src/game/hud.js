import * as THREE from 'three';
import { getWeaponIcon } from './gunModels.js';
import { getPortrait } from '../menu/ui.js';
import { getCharacter } from '../data/characters.js';
import { MODE_NAMES, CAPTURE_TIME } from '../net/room.js';

const $ = (id) => document.getElementById(id);
const getThemeName = (game) => game.mapName || '얼음 협곡';
const TINTS = {
  stealth: 'radial-gradient(ellipse at center, rgba(90,40,200,0) 40%, rgba(90,40,200,.45) 100%)',
  overheat: 'radial-gradient(ellipse at center, rgba(255,90,20,0) 45%, rgba(255,90,20,.4) 100%)',
  golem: 'radial-gradient(ellipse at center, rgba(120,95,70,0) 45%, rgba(120,95,70,.45) 85%, rgba(255,120,40,.35) 100%)',
  shield: 'radial-gradient(ellipse at center, rgba(255,182,39,0) 40%, rgba(255,182,39,.35) 80%, rgba(255,61,242,.35) 100%)',
  echo: 'radial-gradient(ellipse at center, rgba(255,95,184,0) 45%, rgba(255,95,184,.38) 100%)',
  bloom: 'radial-gradient(ellipse at center, rgba(255,143,208,0) 45%, rgba(150,255,120,.32) 85%, rgba(255,143,208,.35) 100%)',
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
    this.el.mode.textContent = `FROST CANYON · ${getThemeName(game)} · ` + (game.net ? MODE_NAMES[game.mode] : game.mode === 'training' ? '훈련장' : `섬멸전 · ${game.diff.name}`);
    this.buildVersus();
    this.buildZones();
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

  /** Crick E: the skill buttons show the stolen character's skills while it lasts */
  onSkillsChange() {
    const ac = this.game.skills.activeChar, stolen = !!this.game.skills.stolen;
    for (const k of ['q', 'e']) {
      this.skillEls[k].el.querySelector('.sk-name').textContent = (stolen ? '⇄ ' : '') + ac[k].name;
      this.skillEls[k].el.classList.toggle('stolen', stolen);
    }
  }

  /** online: [my team portraits + score] [⌛ round clock] [enemy portraits + score] */
  buildVersus() {
    const g = this.game, bar = $('versus-bar');
    $('topcenter').classList.toggle('net', !!g.net);
    if (!g.net) { bar.classList.add('hidden'); bar.innerHTML = ''; return; }
    const net = g.net, byTeam = {};
    for (const [uid, p] of Object.entries(net.players)) (byTeam[p.team] ||= []).push({ uid, p });
    const side = (team, cls) => {
      const mem = (byTeam[team] || []).sort((a, b) => (a.uid === net.uid ? -1 : b.uid === net.uid ? 1 : a.p.slot - b.p.slot));
      const faces = mem.map(({ uid, p }) => {
        const c = getCharacter(p.char), face = getPortrait(c);
        return `<div class="vs-face" data-uid="${uid}" title="${p.name}"><div class="vs-img" style="border-color:${c.color}">${face ? `<img src="${face}" alt="">` : ''}</div><div class="vs-hp"><i></i></div><span class="vs-name">${p.name}</span></div>`;
      }).join('');
      return `<div class="vs-side ${cls}" data-team="${team}"><div class="vs-faces">${faces}</div><div class="vs-score">0</div></div>`;
    };
    const others = Object.keys(byTeam).filter((t) => t !== g.myTeam).sort();
    bar.innerHTML = side(g.myTeam, 'ally') + `<div class="vs-timer"><span class="vs-ico">⌛</span><span class="vs-time">1:30</span><small class="vs-ot">연장</small></div>`
      + others.map((t, i) => side(t, others.length > 1 ? `enemy e${i}` : 'enemy')).join('');
    bar.classList.remove('hidden');
    this.vsFaces = [...bar.querySelectorAll('.vs-face')].map((el) => ({ el, uid: el.dataset.uid, fill: el.querySelector('.vs-hp i') }));
    this.vsScores = [...bar.querySelectorAll('.vs-side')].map((el) => ({ team: el.dataset.team, el: el.querySelector('.vs-score') }));
    this.vsTime = bar.querySelector('.vs-time');
    this.vsTimer = bar.querySelector('.vs-timer');
  }

  /** domination: A / B / C chips at the top right (owner colour + capture progress) */
  buildZones() {
    const el = $('zone-hud'), g = this.game;
    $('hud').classList.toggle('dom', !!g.dom);
    if (!g.dom) { el.classList.add('hidden'); el.innerHTML = ''; return; }
    el.innerHTML = g.world.zones.map((z) => `<div class="zc" data-id="${z.id}"><b>${z.id}</b><div class="zbar"><i></i></div><span class="zt">0/${CAPTURE_TIME}초</span></div>`).join('');
    el.classList.remove('hidden');
    this.zoneEls = [...el.querySelectorAll('.zc')].map((c) => ({ c, bar: c.querySelector('.zbar i'), t: c.querySelector('.zt') }));
  }

  updateZones(st) {
    if (!this.zoneEls || !st) return;
    const g = this.game;
    st.forEach((s, i) => {
      const e = this.zoneEls[i];
      if (!e) return;
      const side = (t) => (t ? (t === g.myTeam ? 'ally' : 'enemy') : '');
      e.c.className = `zc ${s.o ? 'own-' + side(s.o) : ''} ${s.c ? 'cap-' + side(s.c) : ''}`;
      e.bar.style.width = (s.o && !s.p ? 100 : (s.p / CAPTURE_TIME) * 100) + '%';
      e.t.textContent = s.c ? `${side(s.c) === 'ally' ? '점령 중' : '상대 점령 중'} ${Math.floor(s.p)}/${CAPTURE_TIME}초` : s.o ? (side(s.o) === 'ally' ? '우리 구역' : '상대 구역') : `0/${CAPTURE_TIME}초`;
    });
  }

  updateVersus() {
    const g = this.game;
    if (!g.net || !this.vsTime) return;
    const s = g.score || {};
    for (const v of this.vsScores) { const n = String(s[v.team] || 0); if (v.el.textContent !== n) { v.el.textContent = n; v.el.classList.remove('pop'); void v.el.offsetWidth; v.el.classList.add('pop'); } }
    for (const f of this.vsFaces) {
      let hp = 0, max = 150, alive = true;
      if (f.uid === g.net.uid) { hp = g.player.hp; max = g.player.maxHp; alive = g.player.alive; }
      else {
        const r = g.remotes[f.uid] || g.bots.find((b) => b.uid === f.uid);
        if (r) { hp = r.hp; max = r.maxHp || 150; alive = r.alive && !r.gone; }
      }
      f.fill.style.width = Math.max(0, Math.min(100, (hp / max) * 100)) + '%';
      f.el.classList.toggle('dead', !alive);
    }
    const c = g.roundClock(), secs = Math.ceil(c.left);
    const txt = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    if (this.vsTime.textContent !== txt) this.vsTime.textContent = txt;
    this.vsTimer.classList.toggle('ot', c.ot);
    this.vsTimer.classList.toggle('low', !c.ot && c.left < 10);
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
    const spear = !!s.def.spear, melee = s.def.kind === 'melee' && !spear, nade = s.def.kind === 'grenade';
    this.el.mag.textContent = melee ? '∞' : nade ? s.mag + s.reserve : s.mag;
    this.el.mag.classList.toggle('low', !melee && (nade ? s.mag + s.reserve === 0 : spear ? s.mag === 0 : s.mag <= Math.ceil(s.def.mag * 0.25)));
    this.el.res.textContent = spear ? '던질 창' : melee ? '근접' : nade ? s.def.name : s.def.recharge ? '충전' : s.reserve;

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
    else if (spear) text = s.mag === 0 ? '던질 창 없음 — 떨어진 창을 주우세요 (찌르기는 가능)' : '';
    else if (nade) text = s.mag + s.reserve === 0 ? `${s.def.name} 없음 — 탄약 상자로 보충` : '';
    else if (s.def.recharge) text = s.mag === 0 ? (s.def.flame ? '연료 충전 중...' : '⚡ 충전 중...') : '';
    else if (s.def.rail && w.railT > 0) { const n = Math.min(4, Math.floor((w.railT / s.def.charge) * 5)); text = '⚡ 충전 ' + '▮'.repeat(n) + '▯'.repeat(4 - n); }
    else if (w.reloading) text = '재장전 중...';
    else if (s.mag === 0 && s.reserve === 0) text = s.def.kind === 'bow' ? '화살 없음 — 적이 떨군 상자를 주우세요' : '탄약 없음 — 적이 떨군 탄약 상자를 주우세요';
    else if (s.mag === 0) text = s.def.kind === 'bow' ? '' : 'R — 재장전';
    else if (s.mag <= Math.ceil(s.def.mag * 0.25) && s.reserve > 0) text = '탄약 부족 — R';
    if (this.el.msg.textContent !== text) this.el.msg.textContent = text;

    // skills
    for (const k of ['q', 'e']) {
      const sil = p.silenceT > 0;
      const se = this.skillEls[k], cd = g.skills.curCd[k], max = g.skills.activeChar[k].cd;
      se.cd.style.setProperty('--p', sil ? '100%' : (cd > 0 ? (cd / max) * 100 : 0) + '%');
      se.time.textContent = sil ? '🔒' + Math.ceil(p.silenceT) : cd > 0.05 ? Math.ceil(cd) : '';
      se.el.classList.toggle('ready', cd <= 0 && !sil);
      se.el.classList.toggle('silenced', sil);
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
    if (this._steam !== steam) { this._steam = steam; const so = document.getElementById('steam-overlay'); so.classList.toggle('on', !!steam); so.classList.toggle('smoke', steam === 'smoke'); }
    const badge = g.character.id === 'ghost' ? (g.skills.souls > 0 ? '👻' + g.skills.souls : '') : g.skills.echoBuffT > 0 ? '×1.5' : '';
    const st = g.skills.stolen, bk = g.skills.bikeT;
    const eb = this.skillEls.e.badge, ebt = st ? '⇄' + Math.ceil(st.t) : bk > 0 ? '🚲' + Math.ceil(bk) : g.character.id === 'glitch' ? '◈'.repeat(g.skills.glitchStacks) : '';
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

    this.updateVersus();
    this.el.score.textContent = g.net ? `K/D/A ${g.kills} / ${g.deaths} / ${g.assists}` : g.mode === 'training'
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
    $('versus-bar').classList.add('hidden');
    $('zone-hud').classList.add('hidden');
    $('hud').classList.remove('dom');
    $('topcenter').classList.remove('net');
  }
}
