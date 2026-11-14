import * as THREE from 'three';
import { save, persist } from '../save.js';
import { CHARACTERS, RARITY, getCharacter } from '../data/characters.js';
import { WEAPONS, CATEGORIES, CATEGORY_ORDER, getWeapon } from '../data/weapons.js';
import { makeSoldier } from '../game/soldier.js';
import { buildGun, getWeaponIcons, getWeaponIcon } from '../game/gunModels.js';
import { EmotePlayer, speak } from './emotes.js';
import { BUNDLES, skinsForWeapon, skinId } from '../data/skins.js';
import { audio } from '../audio.js';

const $ = (id) => document.getElementById(id);
const PANELS = ['panel-mode', 'panel-chars', 'panel-weapons', 'panel-shop', 'panel-settings'];

/** Main menu: Play (mode select), Characters, Weapons, Settings. */
export class MenuUI {
  constructor({ onPlay }) {
    this.root = $('menu');
    this.onPlay = onPlay;
    this.viewChar = save.character;
    this.viewCat = 'primary';
    this.viewWeapon = save.loadout.primary;
    this.previewActive = false;
    this.openId = null;

    $('btn-play').onclick = () => this.toggle('panel-mode');
    $('btn-chars').onclick = () => { this.viewChar = save.character; this.toggle('panel-chars'); };
    $('btn-weapons').onclick = () => { this.viewWeapon = save.loadout[this.viewCat]; this.toggle('panel-weapons'); };
    $('btn-settings').onclick = () => this.toggle('panel-settings');
    $('btn-shop').onclick = () => this.toggle('panel-shop');
    $('shop-pop-close').onclick = () => this.closeShopPreview();
    this.root.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => this.closeAll()));
    addEventListener('keydown', (e) => { if (e.code === 'Escape' && !this.root.classList.contains('hidden')) this.closeAll(); });

    this.root.querySelectorAll('.mode-card').forEach((card) => {
      card.onclick = () => {
        const mode = card.dataset.mode;
        if (mode === 'multi') { this.onDuel?.(); return; }
        this.onPlay(mode);
      };
    });

    this.bindSettings();
    this.initPreview();
    this.refresh();
  }

  /* ---------- panels ---------- */
  toggle(id) {
    if (this.openId === id) { this.closeAll(); return; }
    this.open(id);
  }

  open(id) {
    this.closeAll();
    this.openId = id;
    $(id).classList.remove('hidden');
    if (id === 'panel-chars') this.renderChars();
    if (id === 'panel-weapons') this.renderWeapons();
    if (id === 'panel-settings') this.syncSettings();
    if (id === 'panel-shop') this.renderShop();
    const slot = id === 'panel-shop' ? null : $(id).querySelector('.preview-slot');
    if (slot) {
      slot.appendChild(this.preview.canvas);
      slot.appendChild(this.bubble);
      this.previewActive = true;
      this.setSubject(id === 'panel-weapons' ? 'weapon' : 'char');
      this.resizePreview();
      if (id === 'panel-chars') this.playEmote();
    }
  }

  closeAll() {
    PANELS.forEach((p) => $(p).classList.add('hidden'));
    $('shop-pop')?.classList.add('hidden');
    this.openId = null;
    this.previewActive = false;
    this.preview?.emote?.stop();
    this.bubble?.classList.remove('show');
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
  }

  hide() { this.closeAll(); this.root.classList.add('hidden'); }
  show() { this.root.classList.remove('hidden'); this.refresh(); }

  toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.add('hidden'), 2600);
  }

  shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

  refresh() {
    $('coin-count').textContent = save.coins.toLocaleString();
    const c = getCharacter(save.character), lo = save.loadout;
    const wn = (id) => `<b style="color:${RARITY[WEAPONS[id].rarity].color}">${WEAPONS[id].name}</b>`;
    $('loadout-chip').innerHTML = `캐릭터 <b>${c.name}</b> <span style="color:${RARITY[c.rarity].color}">(${RARITY[c.rarity].name})</span>
      · 무기 ${wn(lo.primary)} / ${wn(lo.secondary)} / ${wn(lo.sidearm)}
      <div class="ver">v1.4 · 빌드 ${__BUILD__}</div>`;
  }

  /* ---------- characters ---------- */
  renderChars() {
    const list = $('char-list');
    list.innerHTML = '';
    for (const c of CHARACTERS) {
      const r = RARITY[c.rarity];
      const owned = save.owned.includes(c.id);
      const el = document.createElement('button');
      el.className = 'ccard' + (c.id === this.viewChar ? ' active' : '') + (owned ? '' : ' locked') + (c.rarity === 'infinity' ? ' infinity' : '');
      el.style.setProperty('--rc', r.color);
      el.innerHTML = `
        <div class="swatch face" style="background:linear-gradient(135deg, ${c.color}, ${c.accent})">${(() => { const f = getPortrait(c); return f ? `<img src="${f}" alt="${c.name}">` : c.name[0]; })()}</div>
        <div><div class="cname">${c.name}</div><div class="csub">${r.name}</div></div>
        <div class="cright">${save.character === c.id ? '<span class="equipped">선택됨</span>' : owned ? '보유' : `🔒 ◆ ${c.price.toLocaleString()}`}</div>`;
      el.onclick = () => { this.viewChar = c.id; this.renderChars(); this.playEmote(); };
      list.appendChild(el);
    }
    const c = getCharacter(this.viewChar);
    const r = RARITY[c.rarity];
    const owned = save.owned.includes(c.id);
    const selected = save.character === c.id;
    $('char-detail').innerHTML = `
      <div class="d-name">${c.name}<span class="rbadge" style="background:${r.color}">${r.name}</span></div>
      <div class="d-title">${c.title}</div>
      <div class="d-desc">${c.desc}</div>
      <div class="skills">
        ${['q', 'e'].map((k) => `
          <div class="skillbox"><span class="k">${k.toUpperCase()}</span><span class="sn">${c[k].name}</span>
            <div class="sd">${c[k].desc}</div><div class="sc">재사용 대기 ${c[k].cd}초</div></div>`).join('')}
      </div>
      <button id="char-emote" class="btn ghost small">▶ 감정표현 보기 (대사 + 동작)</button>
      <button id="char-action" class="btn primary small" ${selected ? 'disabled' : ''}>
        ${selected ? '선택됨' : owned ? '이 캐릭터 선택' : `구매하기 ◆ ${c.price.toLocaleString()}`}
      </button>
      ${owned ? '' : '<div class="hint">적 처치 1명당 ◆20, 승리 시 ◆300을 얻습니다.</div>'}`;
    $('char-emote').onclick = () => this.playEmote();
    $('char-action').onclick = (e) => {
      if (owned) save.character = c.id;
      else if (save.coins >= c.price) {
        save.coins -= c.price;
        save.owned.push(c.id);
        save.character = c.id;
        this.toast(`${c.name} 획득!`);
      } else {
        this.shake(e.currentTarget);
        this.toast(`코인이 부족합니다 (◆ ${(c.price - save.coins).toLocaleString()} 더 필요)`);
        return;
      }
      persist();
      this.refresh();
      this.renderChars();
    };
    this.setPreviewCharacter(c);
  }

  playEmote() {
    const c = getCharacter(this.viewChar);
    this.setSubject('char');
    this.setPreviewCharacter(c);
    this.bubble.classList.remove('show');
    this.preview.emote.play(c.id);
  }

  showLine(em) {
    const c = getCharacter(this.viewChar);
    this.bubble.innerHTML = `<b style="color:#e8590c">${c.name}</b> ${em.line}`;
    this.bubble.classList.remove('show');
    void this.bubble.offsetWidth;
    this.bubble.classList.add('show');
    speak(em, save.volume);
  }

  /* ---------- weapons ---------- */
  renderWeapons() {
    const list = $('weapon-list');
    list.innerHTML = '';
    const icons = getWeaponIcons();
    // category tabs: 무기1 / 무기2 / 보조 (each shows what is equipped there)
    $('weapon-tabs').innerHTML = CATEGORIES.map((c, i) => {
      const eq = save.loadout[c.id], ic = getWeaponIcon(eq, this.activeSkin(eq));
      return `<button class="wtab ${c.id === this.viewCat ? 'on' : ''}" data-cat="${c.id}">
        <span class="wt-k">${i + 1}</span><span class="wt-n">${c.name}</span>
        ${ic ? `<img src="${ic}" alt="">` : ''}<span class="wt-e">${WEAPONS[eq].name}</span></button>`;
    }).join('');
    $('weapon-tabs').querySelectorAll('.wtab').forEach((b) => {
      b.onclick = () => { this.viewCat = b.dataset.cat; this.viewWeapon = save.loadout[this.viewCat]; this.renderWeapons(); };
    });
    if (WEAPONS[this.viewWeapon]?.cat !== this.viewCat) this.viewWeapon = save.loadout[this.viewCat];
    for (const id of CATEGORY_ORDER[this.viewCat]) {
      const w = WEAPONS[id];
      const r = RARITY[w.rarity];
      const owned = save.ownedWeapons.includes(id);
      const el = document.createElement('button');
      el.className = 'ccard' + (id === this.viewWeapon ? ' active' : '') + (owned ? '' : ' locked');
      el.style.setProperty('--rc', r.color);
      el.innerHTML = `
        <div class="swatch wicon" style="background:linear-gradient(135deg, #1c2638, ${r.color}55)">${icons[id] ? `<img src="${icons[id]}" alt="">` : KIND_ICON[w.kind]}</div>
        <div><div class="cname">${w.name}</div><div class="csub">${r.name}</div></div>
        <div class="cright">${save.loadout[w.cat] === id ? '<span class="equipped">장착됨</span>' : owned ? '보유' : w.price ? `🔒 ◆ ${w.price.toLocaleString()}` : '무료'}</div>`;
      el.onclick = () => { this.viewWeapon = id; this.renderWeapons(); };
      list.appendChild(el);
    }
    const w = getWeapon(this.viewWeapon);
    const r = RARITY[w.rarity];
    const owned = save.ownedWeapons.includes(w.id);
    const equipped = save.loadout[w.cat] === w.id;
    const catName = CATEGORIES.find((c) => c.id === w.cat).name;
    const statRow = (label, v) => `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${v}%"></i></div><span>${v}</span></div>`;
    const nade = w.kind === 'grenade';
    const dmg = nade ? `최대 ${w.damage} · ${w.radius}m` : w.kind === 'melee' ? `${w.damage} / ${w.heavy}` : w.kind === 'bow' ? `${w.damage}~${w.maxDamage}` : w.pellets ? `${w.damage}×${w.pellets}` : `${w.damage} / ${w.head}`;
    const mode = nade ? '투척' : w.kind === 'melee' ? '근접' : w.kind === 'bow' ? '당겨 쏘기' : w.burst ? `${w.burst}점사` : w.auto ? '자동' : w.cycle ? (w.pellets ? '펌프' : '볼트액션') : '반자동';
    $('weapon-detail').innerHTML = `
      <div class="d-name">${w.name}<span class="rbadge" style="background:${r.color}">${r.name}</span><span class="cbadge">${catName}</span></div>
      <div class="d-title">${w.model}</div>
      <div class="d-desc">${w.desc}</div>
      ${statRow('데미지', w.stats.damage)}${statRow('연사력', w.stats.rate)}${statRow('사거리', w.stats.range)}${statRow('기동성', w.stats.mobility)}
      <div class="specs">
        <div>${nade ? '폭발 피해' : w.kind === 'melee' ? '베기 / 찌르기' : w.kind === 'bow' ? '피해(충전)' : '몸통 / 헤드'}<b>${dmg}</b></div>
        <div>${nade ? '지급' : w.kind === 'bow' ? '화살' : '탄창'}<b>${nade ? `${w.mag + w.reserve}개` : w.kind === 'melee' ? '∞' : `${w.mag} / ${w.reserve}`}</b></div>
        <div>방식<b>${mode}</b></div>
      </div>
      ${this.skinRow(w)}
      <button id="weapon-action" class="btn primary small" ${equipped ? 'disabled' : ''}>
        ${equipped ? `${catName}에 장착됨` : owned ? `${catName}에 장착` : `구매하기 ◆ ${w.price.toLocaleString()}`}
      </button>
      ${owned ? '' : `<div class="hint">구매 후 [장착]을 누르면 ${catName} 슬롯에 들어갑니다.</div>`}`;
    $('weapon-action').onclick = (e) => {
      if (owned) {
        save.loadout[w.cat] = w.id;
        audio.init();
        audio.magIn();
        this.toast(`${catName}: ${w.name} 장착 완료`);
      } else if (save.coins >= w.price) {
        save.coins -= w.price;
        save.ownedWeapons.push(w.id);
        this.toast(`${w.name} 구매 완료 — [장착]을 누르세요`);
      } else {
        this.shake(e.currentTarget);
        this.toast(`코인이 부족합니다 (◆ ${(w.price - save.coins).toLocaleString()} 더 필요)`);
        return;
      }
      persist();
      this.refresh();
      this.renderWeapons();
    };
    this.root.querySelectorAll('#weapon-detail .skin-opt').forEach((b) => {
      b.onclick = () => {
        const sid = b.dataset.sid || null;
        if (sid && !save.ownedSkins.includes(sid)) { this.toast('상점에서 번들을 구매하면 사용할 수 있습니다'); this.shake(b); return; }
        if (sid) save.skins[w.id] = sid; else delete save.skins[w.id];
        persist();
        this.renderWeapons();
      };
    });
    this.setPreviewWeapon(w.id, this.activeSkin(w.id));
  }

  activeSkin(wid) {
    const sid = save.skins[wid];
    return sid && save.ownedSkins.includes(sid) ? sid : null;
  }

  skinRow(w) {
    const opts = skinsForWeapon(w.id);
    if (!opts.length) return '<div class="skin-row"><span>스킨</span><div class="hint">이 무기는 아직 스킨이 없습니다</div></div>';
    const cur = this.activeSkin(w.id);
    return `<div class="skin-row"><span>스킨</span>
      <button class="skin-opt ${!cur ? 'on' : ''}" data-sid="">기본</button>
      ${opts.map((o) => {
        const owned = save.ownedSkins.includes(o.id);
        return `<button class="skin-opt ${o.bundle.id} ${cur === o.id ? 'on' : ''} ${owned ? '' : 'locked'}" data-sid="${o.id}">${owned ? '' : '🔒 '}${o.bundle.name}</button>`;
      }).join('')}</div>`;
  }

  /* ---------- shop (vertical scrolling bundle list) ---------- */
  renderShop() {
    const list = $('shop-list');
    list.innerHTML = BUNDLES.map((b) => {
      const owned = b.weapons.every((wid) => save.ownedSkins.includes(skinId(b.id, wid)));
      const r = RARITY[b.rarity];
      return `<section class="bundle ${b.id}">
        <div class="b-ribbon" style="background:${r.color}">${r.name} 번들</div>
        <div class="b-title">${b.name}</div>
        <div class="b-tag">${b.tagline}</div>
        <div class="b-weapons">
          ${b.weapons.map((wid) => `<button class="b-w" data-b="${b.id}" data-w="${wid}" title="눌러서 3D로 보기">
            <img src="${getWeaponIcon(wid, skinId(b.id, wid))}" alt=""><span>${WEAPONS[wid].name}</span></button>`).join('')}
        </div>
        <div class="b-desc">${b.desc}</div>
        <div class="b-fx">✦ 처치 이펙트: <b>${b.killFx}</b></div>
        <div class="b-foot">
          <div class="b-price">${owned ? '보유 중' : `◆ ${b.price.toLocaleString()}`}</div>
          <button class="btn primary small b-buy" data-b="${b.id}" ${owned ? 'disabled' : ''}>${owned ? '구매 완료' : '번들 구매'}</button>
        </div>
      </section>`;
    }).join('');
    list.querySelectorAll('.b-buy').forEach((btn) => (btn.onclick = () => this.buyBundle(btn.dataset.b, btn)));
    list.querySelectorAll('.b-w').forEach((btn) => (btn.onclick = () => this.openShopPreview(btn.dataset.b, btn.dataset.w)));
  }

  buyBundle(bid, btn) {
    const b = BUNDLES.find((x) => x.id === bid);
    if (save.coins < b.price) {
      this.shake(btn);
      this.toast(`코인이 부족합니다 (◆ ${(b.price - save.coins).toLocaleString()} 더 필요)`);
      return;
    }
    save.coins -= b.price;
    for (const wid of b.weapons) {
      const sid = skinId(b.id, wid);
      if (!save.ownedSkins.includes(sid)) save.ownedSkins.push(sid);
      if (!save.skins[wid]) save.skins[wid] = sid; // auto-apply if the weapon had no skin
    }
    persist();
    audio.init();
    audio.kill();
    this.toast(`${b.name} 번들 구매 완료! 무기 탭에서 스킨을 바꿀 수 있어요`);
    this.refresh();
    this.renderShop();
  }

  openShopPreview(bid, wid) {
    const b = BUNDLES.find((x) => x.id === bid);
    const pop = $('shop-pop');
    pop.classList.remove('hidden');
    pop.className = 'shop-pop ' + bid;
    $('shop-pop-title').textContent = `${b.name} · ${WEAPONS[wid].name}`;
    const slot = pop.querySelector('.preview-slot');
    slot.appendChild(this.preview.canvas);
    this.previewActive = true;
    this.setSubject('weapon');
    this.setPreviewWeapon(wid, skinId(bid, wid));
    this.resizePreview();
  }

  closeShopPreview() {
    $('shop-pop').classList.add('hidden');
    this.previewActive = false;
  }

  /* ---------- settings ---------- */
  bindSettings() {
    const bind = (id, key, fmt, after) => {
      const el = $(id);
      el.oninput = () => {
        save[key] = parseFloat(el.value);
        $(id + '-v').textContent = fmt(save[key]);
        after?.(save[key]);
        persist();
      };
    };
    bind('set-sens', 'sens', (v) => v.toFixed(2));
    bind('set-vol', 'volume', (v) => Math.round(v * 100) + '%', (v) => audio.setVolume(v));
    bind('set-fov', 'fov', (v) => v + '°');
  }

  syncSettings() {
    $('set-sens').value = save.sens; $('set-sens-v').textContent = save.sens.toFixed(2);
    $('set-vol').value = save.volume; $('set-vol-v').textContent = Math.round(save.volume * 100) + '%';
    $('set-fov').value = save.fov; $('set-fov-v').textContent = save.fov + '°';
  }

  /* ---------- shared 3D preview ---------- */
  initPreview() {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    // simple studio environment for metal reflections
    const pm = new THREE.PMREMGenerator(r);
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.MeshBasicMaterial({ color: '#8fb4d8', side: THREE.BackSide })));
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    lamp.position.set(0, 6, 3); lamp.lookAt(0, 0, 0);
    envScene.add(lamp);
    scene.environment = pm.fromScene(envScene, 0.04).texture;
    scene.environmentIntensity = 0.6;
    pm.dispose();

    const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
    scene.add(new THREE.HemisphereLight('#dff1ff', '#283a58', 1.6));
    const key = new THREE.DirectionalLight('#ffffff', 2.4);
    key.position.set(2, 4, 3);
    const rim = new THREE.DirectionalLight('#7fd8ff', 2.5);
    rim.position.set(-3, 2, -3);
    scene.add(key, rim);
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.0, 0.12, 6),
      new THREE.MeshStandardMaterial({ color: '#bfe6ff', roughness: 0.15, metalness: 0.1, flatShading: true, emissive: '#1a5f9a', emissiveIntensity: 0.4 }),
    );
    pedestal.position.y = -0.06;
    scene.add(pedestal);
    const holder = new THREE.Group();
    scene.add(holder);
    const actor = new THREE.Group();
    holder.add(actor);
    // weapon turntable
    const wHolder = new THREE.Group();
    wHolder.position.set(0, 1.25, 0);
    scene.add(wHolder);

    this.preview = {
      renderer: r, canvas: r.domElement, scene, cam, holder, actor, pedestal, wHolder,
      model: null, charId: null, emote: null, weapon: null, weaponId: null, subject: 'char',
      yaw: -0.6, pitch: 0.15, zoom: 1, dragging: false, lastDrag: -10,
    };
    this.bubble = document.createElement('div');
    this.bubble.className = 'bubble';

    // input: click = replay emote (char) ; drag/wheel = rotate/zoom (weapon)
    const c = r.domElement;
    let sx = 0, sy = 0, moved = 0;
    c.addEventListener('pointerdown', (e) => {
      const p = this.preview;
      p.dragging = true; sx = e.clientX; sy = e.clientY; moved = 0;
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener('pointermove', (e) => {
      const p = this.preview;
      if (!p.dragging) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      sx = e.clientX; sy = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (p.subject === 'weapon') {
        p.yaw += dx * 0.012;
        p.pitch = Math.max(-1.2, Math.min(1.2, p.pitch + dy * 0.01));
      } else {
        p.holder.rotation.y += dx * 0.012;
      }
      p.lastDrag = performance.now();
    });
    const up = () => {
      const p = this.preview;
      if (p.dragging && moved < 5 && p.subject === 'char') this.playEmote();
      p.dragging = false;
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => {
      const p = this.preview;
      if (p.subject !== 'weapon') return;
      e.preventDefault();
      p.zoom = Math.max(0.55, Math.min(1.8, p.zoom * (e.deltaY > 0 ? 1.1 : 0.9)));
    }, { passive: false });
    c.style.cursor = 'grab';
  }

  setSubject(kind) {
    const p = this.preview;
    p.subject = kind;
    p.holder.visible = kind === 'char';
    p.pedestal.visible = kind === 'char';
    p.wHolder.visible = kind === 'weapon';
    if (kind === 'char') { p.cam.position.set(0, 1.45, 6.6); p.cam.lookAt(0, 1.38, 0); }
  }

  setPreviewCharacter(c) {
    const p = this.preview;
    if (p.charId === c.id) return;
    p.charId = c.id;
    p.emote?.stop();
    if (p.model) {
      p.actor.remove(p.model.group);
      p.model.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    }
    p.model = makeSoldier(c.color, c.accent, c.id);
    p.model.gun.visible = false;
    p.model.group.rotation.y = Math.PI; // face the camera
    p.holder.rotation.y = -0.4;
    p.actor.add(p.model.group);
    p.emote = new EmotePlayer(p.actor, p.holder, p.model);
    p.emote.stop();
  }

  setPreviewWeapon(id, sid = null) {
    const p = this.preview;
    const key = id + '|' + (sid || '');
    if (p.weaponId === key) return;
    p.weaponId = key;
    if (p.weapon) {
      p.wHolder.remove(p.weapon.group);
      p.weapon.group.traverse((o) => o.isMesh && o.geometry.dispose());
    }
    const m = buildGun(id, sid);
    // center and scale to a consistent display size
    const box = new THREE.Box3().setFromObject(m.group);
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    const s = 1.5 / Math.max(size.x, size.y, size.z);
    const inner = new THREE.Group();
    m.group.position.sub(center);
    inner.add(m.group);
    inner.scale.setScalar(s);
    m.group = inner; // so disposal/removal works on the wrapper
    p.wHolder.add(inner);
    p.weapon = m;
    p.yaw = -1.2; p.pitch = 0.12; p.zoom = 1;
  }

  resizePreview() {
    const p = this.preview;
    const w = p.canvas.parentElement?.clientWidth || 400;
    const h = p.canvas.parentElement?.clientHeight || 260;
    p.renderer.setSize(w, h, false);
    p.cam.aspect = w / h;
    p.cam.updateProjectionMatrix();
  }

  updatePreview(dt) {
    if (!this.previewActive || this.root.classList.contains('hidden')) return;
    const p = this.preview;
    if (p.subject === 'weapon') {
      if (!p.dragging && performance.now() - p.lastDrag > 1500) p.yaw += dt * 0.5;
      p.wHolder.rotation.set(p.pitch, p.yaw, 0, 'XYZ');
      const d = 3.4 * p.zoom;
      p.cam.position.set(0, 1.3, d);
      p.cam.lookAt(0, 1.25, 0);
    } else {
      const em = p.emote?.active?.em;
      if (em) p.holder.rotation.y += (em.view - p.holder.rotation.y) * Math.min(1, dt * 5);
      else if (!p.dragging) p.holder.rotation.y += dt * 0.6;
      const res = p.emote?.update(dt);
      if (res?.speak) this.showLine(res.speak);
      if (res?.done) this.bubble.classList.remove('show');
      if (p.model && !em) {
        const tt = performance.now() * 0.001;
        p.model.joints.neck.rotation.y = Math.sin(tt * 1.2) * 0.3;
        p.model.joints.torso.rotation.x = Math.sin(tt * 2) * 0.015;
      }
    }
    p.renderer.render(p.scene, p.cam);
  }
}

const KIND_ICON = { gun: '✦', melee: '⚔', bow: '➶', grenade: '●' };

/* ---- character face portraits for the character cards (rendered once, cached) ---- */
const portraitCache = {};
let portraitR = null;
export function getPortrait(c) {
  if (portraitCache[c.id] !== undefined) return portraitCache[c.id];
  try {
    const S = 128;
    if (!portraitR) {
      const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
      r.setSize(S, S, false);
      r.toneMapping = THREE.ACESFilmicToneMapping;
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight('#ffffff', '#4a5a70', 2.4));
      const key = new THREE.DirectionalLight('#ffffff', 2.6);
      key.position.set(1.5, 2, 3);
      const rim = new THREE.DirectionalLight('#9fe7ff', 1.5);
      rim.position.set(-2, 1, -1);
      scene.add(key, rim);
      const cam = new THREE.PerspectiveCamera(26, 1, 0.05, 20);
      portraitR = { r, scene, cam };
    }
    const { r, scene, cam } = portraitR;
    const m = makeSoldier(c.color, c.accent, c.id);
    m.gun.visible = false;
    m.group.rotation.y = Math.PI; // face the camera (+z)
    scene.add(m.group);
    m.group.updateMatrixWorld(true);
    const h = m.head.getWorldPosition(new THREE.Vector3());
    h.y += 0.1;
    cam.position.set(h.x + 0.26, h.y + 0.05, h.z + 1.0);
    cam.lookAt(h.x, h.y - 0.04, h.z);
    r.render(scene, cam);
    portraitCache[c.id] = r.domElement.toDataURL();
    scene.remove(m.group);
    m.group.traverse((o) => o.isMesh && o.geometry.dispose());
  } catch (e) {
    console.warn('portrait render failed', e);
    portraitCache[c.id] = '';
  }
  return portraitCache[c.id];
}
