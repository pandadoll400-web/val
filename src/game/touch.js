// Touch controls for phones / tablets: left stick = move, drag right side = look, on-screen buttons.
// Everything is fed into the same inputs the keyboard and mouse use (game.keys, weapons.trigger, skills).
import * as THREE from 'three';

const _ray = new THREE.Raycaster();
const _center = new THREE.Vector2(0, 0);

export const IS_TOUCH = typeof window !== 'undefined' &&
  ((window.matchMedia && matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints > 0 && 'ontouchstart' in window));

const LOOK_SENS = 2.2; // touch pixels → "mouse" pixels

export class TouchControls {
  constructor(game) {
    this.game = game;
    this.stick = null;   // { id, x0, y0 }
    this.looks = new Map(); // touch id → { x, y }
    this.root = document.createElement('div');
    this.root.id = 'touch';
    this.root.innerHTML = `
      <div class="t-stick-zone"></div>
      <div class="t-stick hidden"><div class="t-knob"></div></div>
      <button class="t-btn t-fire" data-a="fire">●</button>
      <button class="t-btn t-ads" data-a="ads">◎</button>
      <button class="t-btn t-jump" data-a="jump">⤒</button>
      <button class="t-btn t-crouch" data-a="crouch">⤓</button>
      <button class="t-btn t-reload" data-a="reload">⟳</button>
      <button class="t-btn t-q" data-a="q">Q</button>
      <button class="t-btn t-e" data-a="e">E</button>
      <button class="t-btn t-nade" data-a="nade">💣</button>
      <button class="t-btn t-pause" data-a="pause">❚❚</button>
      <button class="t-btn t-auto" data-a="auto">AUTO</button>`;
    this.auto = false;
    this.fireHeld = false;
    document.body.appendChild(this.root);
    document.body.classList.add('touch-mode');
    this.stickEl = this.root.querySelector('.t-stick');
    this.knob = this.root.querySelector('.t-knob');

    this._start = (e) => this.onStart(e);
    this._move = (e) => this.onMove(e);
    this._end = (e) => this.onEnd(e);
    this.root.addEventListener('touchstart', this._start, { passive: false });
    this.root.addEventListener('touchmove', this._move, { passive: false });
    this.root.addEventListener('touchend', this._end, { passive: false });
    this.root.addEventListener('touchcancel', this._end, { passive: false });
    // weapon slots in the HUD are tappable
    this._slotTap = (e) => {
      const el = e.target.closest('#slots > div');
      if (!el) return;
      e.preventDefault();
      const i = [...el.parentNode.children].indexOf(el);
      if (this.canAct()) this.game.weapons.equip(i);
    };
    document.getElementById('slots').addEventListener('touchstart', this._slotTap, { passive: false });
  }

  canAct() { const g = this.game; return !g.paused && !g.over && g.player.alive && !g.frozen; }

  onStart(e) {
    e.preventDefault();
    const g = this.game;
    const slots = [...document.querySelectorAll('#slots > div')];
    for (const t of e.changedTouches) {
      const btn = t.target.closest?.('.t-btn');
      if (btn) { this.press(btn, t); continue; }
      // weapon slots (drawn by the HUD underneath this overlay)
      const si = slots.findIndex((el) => { const r = el.getBoundingClientRect(); return t.clientX >= r.left && t.clientX <= r.right && t.clientY >= r.top && t.clientY <= r.bottom; });
      if (si >= 0) { if (this.canAct()) this.game.weapons.equip(si); continue; }
      if (t.clientX < innerWidth * 0.42 && !this.stick) {
        // movement stick appears where the thumb lands
        this.stick = { id: t.identifier, x0: t.clientX, y0: t.clientY };
        this.stickEl.classList.remove('hidden');
        this.stickEl.style.left = t.clientX + 'px';
        this.stickEl.style.top = t.clientY + 'px';
        this.knob.style.transform = 'translate(-50%, -50%)';
      } else {
        this.looks.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
    }
    if (g.paused && !g.over && !g.net) { /* pause menu has its own buttons */ }
  }

  press(btn, t) {
    const g = this.game, w = g.weapons, a = btn.dataset.a;
    btn.classList.add('on');
    btn._touch = t.identifier;
    if (a === 'pause') { g.setPaused(!g.paused); return; }
    if (a === 'auto') {
      this.auto = !this.auto;
      btn.classList.toggle('latched', this.auto);
      g.hud.msg(this.auto ? '자동 발사 켜짐 — 조준선에 적이 닿으면 발사' : '자동 발사 꺼짐', 1.4);
      if (!this.auto && !this.fireHeld) w.trigger = false;
      return;
    }
    if (!this.canAct()) return;
    if (a === 'fire') {
      w.trigger = true; w.triggerUsed = false; this.fireHeld = true;
      this.looks.set(t.identifier, { x: t.clientX, y: t.clientY, fire: true }); // dragging the fire button also aims
    } else if (a === 'ads') { w.adsHeld = !w.adsHeld; btn.classList.toggle('latched', w.adsHeld); }
    else if (a === 'jump') g.keys.Space = true;
    else if (a === 'crouch') g.keys.KeyC = true;
    else if (a === 'reload') w.reload();
    else if (a === 'q') g.skills.use('q');
    else if (a === 'e') g.skills.use('e');
    else if (a === 'nade') { const gi = w.slots.findIndex((s) => s.def.kind === 'grenade'); if (gi >= 0) w.equip(gi); else g.hud.msg('보조 슬롯에 수류탄이 없습니다', 1.2); }
  }

  release(btn) {
    const g = this.game, w = g.weapons, a = btn.dataset.a;
    btn.classList.remove('on');
    if (a === 'fire') { w.trigger = false; this.fireHeld = false; }
    else if (a === 'jump') g.keys.Space = false;
    else if (a === 'crouch') g.keys.KeyC = false;
    else if (a === 'e') g.skills.release('e');
    else if (a === 'q') g.skills.release('q');
  }

  onMove(e) {
    e.preventDefault();
    const g = this.game;
    for (const t of e.changedTouches) {
      if (this.stick && t.identifier === this.stick.id) {
        let dx = t.clientX - this.stick.x0, dy = t.clientY - this.stick.y0;
        const R = 60, len = Math.hypot(dx, dy);
        if (len > R) { dx *= R / len; dy *= R / len; }
        this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        const nx = dx / R, ny = dy / R, mag = Math.min(1, len / R);
        g.keys.KeyW = ny < -0.3; g.keys.KeyS = ny > 0.3;
        g.keys.KeyA = nx < -0.3; g.keys.KeyD = nx > 0.3;
        g.keys.ShiftLeft = mag > 0.92 && ny < -0.6; // push all the way forward = sprint
        continue;
      }
      const l = this.looks.get(t.identifier);
      if (l) {
        const dx = (t.clientX - l.x) * LOOK_SENS, dy = (t.clientY - l.y) * LOOK_SENS;
        l.x = t.clientX; l.y = t.clientY;
        if (!g.paused && !g.over) { g.player.onMouseMove(dx, dy); g.weapons.onMouseMove(dx, dy); }
      }
    }
  }

  onEnd(e) {
    e.preventDefault();
    const g = this.game;
    for (const t of e.changedTouches) {
      if (this.stick && t.identifier === this.stick.id) {
        this.stick = null;
        this.stickEl.classList.add('hidden');
        g.keys.KeyW = g.keys.KeyS = g.keys.KeyA = g.keys.KeyD = g.keys.ShiftLeft = false;
      }
      this.looks.delete(t.identifier);
      for (const btn of this.root.querySelectorAll('.t-btn.on')) if (btn._touch === t.identifier) this.release(btn);
    }
  }

  /** keep button states in sync (ADS latch resets on weapon switch / death) */
  update() {
    const w = this.game.weapons;
    if (this.auto) this.autoFire();
    this.root.querySelector('.t-ads').classList.toggle('latched', !!w.adsHeld);
    this.root.classList.toggle('dead', !this.game.player.alive || this.game.over);
  }

  /** AUTO: pull the trigger only while an enemy is under the crosshair (nothing solid in between) */
  autoFire() {
    const g = this.game, w = g.weapons;
    if (this.fireHeld) return;
    const kind = w.def.kind;
    if (!this.canAct() || kind !== 'gun' || w.reloading) { if (this._autoOn) { w.trigger = false; this._autoOn = false; } return; }
    _ray.setFromCamera(_center, g.camera);
    _ray.far = 200;
    const enemies = g.enemyMeshes();
    let on = false;
    if (enemies.length) {
      const hit = _ray.intersectObjects(g.world.solids.concat(enemies), false)[0];
      const e = hit?.object.userData.enemy;
      on = !!e && e.alive !== false && !e.invisible && hit.distance < 35; // AUTO only reaches 35 m
    }
    // reaction delay: the enemy has to stay under the crosshair for 0.25 s before AUTO fires
    const now = performance.now();
    if (!on) this._autoSeen = 0;
    else if (!this._autoSeen) this._autoSeen = now;
    if (on && now - this._autoSeen < 350) on = false;
    if (on && !this._autoOn) { w.trigger = true; w.triggerUsed = false; this._autoTap = now; }
    else if (!on && this._autoOn) w.trigger = false;
    else if (on && !w.def.auto && w.triggerUsed && w.slot.mag > 0 && now - (this._autoTap || 0) > 350) { w.triggerUsed = false; this._autoTap = now; } // semi-auto: slower taps
    this._autoOn = on;
  }

  dispose() {
    document.getElementById('slots')?.removeEventListener('touchstart', this._slotTap);
    this.root.remove();
    document.body.classList.remove('touch-mode');
  }
}
