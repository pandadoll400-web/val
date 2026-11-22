import * as THREE from 'three';
import { save, persist, outfitFor, randomCharSkin } from '../save.js';
import { CHAR_SKINS, getCharSkin } from '../data/charSkins.js';
import { CHARACTERS, RARITY, getCharacter, EARLY_ITEMS, EARLY_UNTIL, earlyOn } from '../data/characters.js';
import { WEAPONS, CATEGORIES, CATEGORY_ORDER, getWeapon } from '../data/weapons.js';
import { makeSoldier } from '../game/soldier.js';
import { buildGun, getWeaponIcons, getWeaponIcon } from '../game/gunModels.js';
import { EmotePlayer, speak } from './emotes.js';
import { BUNDLES, skinsForWeapon, skinId } from '../data/skins.js';
import { audio } from '../audio.js';
import { currentUser } from '../net/auth.js';
import { dealsFor, dealSecondsLeft } from '../data/deals.js';

const isHack = () => (currentUser()?.nick || '').toLowerCase() === 'hack';
/** Christmas skins / bundle go on sale December 1st (shown as a preview until then) */
/** weapons sold for coins only from December (taser); the season pass still gives it */
const notYet = (w) => w.decSale && !xmasOpen();
const xmasOpen = () => { const d = new Date(); return d.getFullYear() > 2026 || (d.getFullYear() === 2026 && d.getMonth() === 11); };
/** today's deal for a weapon (or null) and the price it sells for right now */
const dealOf = (wid) => (isHack() ? dealsFor(save.ownedWeapons).find((d) => d.id === wid) || null : null);
const priceOf = (wid) => dealOf(wid)?.sale ?? WEAPONS[wid].price;
const hasCharSkin = () => save.ownedOutfits.some((o) => getCharSkin(o)?.set === 'xmas' && getCharSkin(o).char !== 'bloom');

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
        if (mode === 'solo') { // pick a difficulty first
          const row = $('solo-diff');
          row.classList.toggle('hidden');
          row.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.d === (save.soloDiff || 'normal')));
          return;
        }
        this.onPlay(mode);
      };
    });
    $('solo-diff').querySelectorAll('button').forEach((b) => {
      b.onclick = () => { save.soloDiff = b.dataset.d; persist(); $('solo-diff').classList.add('hidden'); this.onPlay('solo'); };
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
    this.onRefresh?.();
    { const cc = getCharacter(save.character); if (cc.shopOnly && !save.owned.includes(cc.id) && !isHack()) save.character = 'rookie'; }
    if (getCharacter(this.viewChar || 'rookie').shopOnly && !save.owned.includes(this.viewChar) && !isHack()) this.viewChar = save.character;
    const c = getCharacter(save.character), lo = save.loadout;
    const wn = (id) => `<b style="color:${RARITY[WEAPONS[id].rarity].color}">${WEAPONS[id].name}</b>`;
    $('loadout-chip').innerHTML = `캐릭터 <b>${c.name}</b> <span style="color:${RARITY[c.rarity].color}">(${RARITY[c.rarity].name})</span>
      · 무기 ${wn(lo.primary)} / ${wn(lo.secondary)} / ${wn(lo.sidearm)}
      <div class="ver">v2.4 · 빌드 ${__BUILD__}</div>`;
  }

  /* ---------- characters ---------- */
  renderChars() {
    const list = $('char-list');
    list.innerHTML = '';
    for (const c of CHARACTERS) {
      if (c.shopOnly && !save.owned.includes(c.id) && !isHack()) continue; // shop-only (early access) characters show up once bought
      const r = RARITY[c.rarity];
      const owned = save.owned.includes(c.id);
      const el = document.createElement('button');
      el.className = 'ccard' + (c.id === this.viewChar ? ' active' : '') + (owned ? '' : ' locked') + (c.rarity === 'infinity' ? ' infinity' : '');
      el.style.setProperty('--rc', r.color);
      el.innerHTML = `
        <div class="swatch face" title="눌러서 스킨 보기" style="background:linear-gradient(135deg, ${c.color}, ${c.accent})">${(() => { const f = getPortrait(c, outfitFor(c.id)); return f ? `<img src="${f}" alt="${c.name}">` : c.name[0]; })()}${isHack() ? '<span class="face-tag">👕</span>' : ''}</div>
        <div><div class="cname">${c.name}</div><div class="csub">${r.name}</div></div>
        <div class="cright">${save.character === c.id ? '<span class="equipped">선택됨</span>' : owned ? '보유' : `🔒 ◆ ${c.price.toLocaleString()}`}</div>`;
      el.onclick = () => { this.viewChar = c.id; this.skinView = null; this.renderChars(); this.playEmote(); };
      // the portrait opens that character's skins
      if (isHack()) el.querySelector('.swatch.face').onclick = (e) => { e.stopPropagation(); this.viewChar = c.id; this.skinView = c.id; this.renderChars(); };
      list.appendChild(el);
    }
    if (isHack() && this.skinView === this.viewChar) { this.renderCharSkins(getCharacter(this.viewChar)); return; }
    this.skinView = null;
    const c = getCharacter(this.viewChar);
    const r = RARITY[c.rarity];
    const owned = save.owned.includes(c.id);
    const selected = save.character === c.id;
    const mySkins = CHAR_SKINS.filter((k) => k.char === c.id && !k.hackOnly);
    const tag = (k) => (k.set === 'perse' ? '🏛️' : '🎄');
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
      ${owned ? '' : '<div class="hint">적 처치 1명당 ◆20, 승리 시 ◆300을 얻습니다.</div>'}
      ${!mySkins.length ? '' : isHack() ? '<div class="hint">👕 왼쪽 목록의 캐릭터 사진을 누르면 스킨을 볼 수 있어요</div>' : `<div class="skin-row outfit-row"><span>스킨</span>
        <button class="skin-opt ${!outfitFor(c.id) ? 'on' : ''}" data-o="">기본</button>
        ${mySkins.map((k) => save.ownedOutfits.includes(k.id)
          ? `<button class="skin-opt ${k.set} ${outfitFor(c.id) === k.id ? 'on' : ''}" data-o="${k.id}">${tag(k)} ${k.name}</button>`
          : `<button class="skin-opt ${k.set} locked" data-peek="${k.id}" title="눌러서 미리보기">🔒 ${tag(k)} ${k.name} · ${k.set === 'perse' ? '시즌 번들' : '12월 출시'}</button>`).join('')}</div>`}`;
    $('char-detail').querySelectorAll('[data-o]').forEach((b) => (b.onclick = () => {
      if (b.dataset.o) save.outfits[c.id] = b.dataset.o; else delete save.outfits[c.id];
      persist();
      this.renderChars();
    }));
    $('char-detail').querySelectorAll('[data-peek]').forEach((b) => (b.onclick = () => {
      this.setPreviewCharacter(c, b.dataset.peek);
      const k = getCharSkin(b.dataset.peek);
      this.toast(k.set === 'perse' ? `🏛️ ${k.name} — 상점 › 시즌 번들에서 얻을 수 있어요 (미리보기)` : `🎄 ${k.name} — 12월에 출시돼요! (미리보기)`);
    }));
    $('char-emote').onclick = () => this.playEmote();
    $('char-action').onclick = (e) => {
      if (owned) save.character = c.id;
      else if (c.shopOnly) { this.toast('🛒 상점에서만 구매할 수 있어요'); return; }
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

  /** skin window for one character (opened from its portrait): default + its skins, click to preview, equip if owned */
  renderCharSkins(c) {
    const owned = save.owned.includes(c.id);
    const cur = outfitFor(c.id);
    const peek = this.skinPeek && (this.skinPeek === 'default' || getCharSkin(this.skinPeek)?.char === c.id) ? this.skinPeek : (cur || 'default');
    const opts = [{ id: 'default', name: '기본', have: true }, ...CHAR_SKINS.filter((k) => k.char === c.id && (!k.hackOnly || isHack())).map((k) => ({ id: k.id, name: k.name, have: save.ownedOutfits.includes(k.id), xmas: k.set === 'xmas', perse: k.set === 'perse' }))];
    $('char-detail').innerHTML = `
      <div class="d-name">${c.name} <span class="d-sub">· 스킨</span><button id="skin-back" class="btn ghost small skin-back">✕ 닫기</button></div>
      <div class="skin-grid">
        ${opts.map((o) => {
          const on = (o.id === 'default' ? !cur : cur === o.id);
          const face = getPortrait(c, o.id === 'default' ? null : o.id);
          return `<button class="skin-card ${o.xmas ? 'xmas' : ''} ${o.perse ? 'perse' : ''} ${peek === o.id ? 'peek' : ''} ${on ? 'on' : ''} ${o.have ? '' : 'locked'}" data-k="${o.id}">
            <div class="sk-face" style="background:linear-gradient(135deg, ${c.color}, ${c.accent})">${face ? `<img src="${face}" alt="">` : ''}</div>
            <div class="sk-name">${o.xmas ? '🎄 ' : o.perse ? '🏛️ ' : ''}${o.name}</div>
            <div class="sk-state">${on ? '장착 중' : o.have ? '보유' : o.perse ? '🔒 시즌 번들' : '🔒 12월 출시'}</div></button>`;
        }).join('')}
      </div>
      ${(() => {
        const o = opts.find((x) => x.id === peek);
        const on = peek === 'default' ? !cur : cur === peek;
        if (!o.have) return o.perse ? '<button class="btn primary small" disabled>🏛️ 상점 › 시즌 번들에서 얻을 수 있어요</button>' : '<button class="btn primary small" disabled>🎄 12월에 출시돼요</button>';
        if (!owned) return '<button class="btn primary small" disabled>캐릭터를 먼저 구매하세요</button><div class="hint">스킨은 캐릭터를 가진 뒤 장착할 수 있어요</div>';
        return `<button id="skin-equip" class="btn primary small" ${on ? 'disabled' : ''}>${on ? '장착 중' : `${o.name} 장착`}</button>`;
      })()}`;
    $('skin-back').onclick = () => { this.skinView = null; this.skinPeek = null; this.renderChars(); };
    $('char-detail').querySelectorAll('.skin-card').forEach((b) => (b.onclick = () => { this.skinPeek = b.dataset.k; this.renderChars(); }));
    const eq = $('skin-equip');
    if (eq) eq.onclick = () => {
      if (peek === 'default') delete save.outfits[c.id]; else save.outfits[c.id] = peek;
      persist();
      audio.init(); audio.magIn();
      this.toast(`${c.name}: ${peek === 'default' ? '기본' : getCharSkin(peek).name} 장착`);
      this.refresh();
      this.renderChars();
    };
    this.setPreviewCharacter(c, peek === 'default' ? null : peek);
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
      if (WEAPONS[id].hackOnly && !isHack()) continue; // (none right now)
      if (WEAPONS[id].shopOnly && !save.ownedWeapons.includes(id) && !isHack()) continue; // shop-only (early access) weapons show up once bought
      const w = WEAPONS[id];
      const r = RARITY[w.rarity];
      const owned = save.ownedWeapons.includes(id);
      const el = document.createElement('button');
      el.className = 'ccard' + (id === this.viewWeapon ? ' active' : '') + (owned ? '' : ' locked');
      el.style.setProperty('--rc', r.color);
      el.innerHTML = `
        <div class="swatch wicon" style="background:linear-gradient(135deg, #1c2638, ${r.color}55)">${icons[id] ? `<img src="${icons[id]}" alt="">` : KIND_ICON[w.kind]}</div>
        <div><div class="cname">${w.name}</div><div class="csub">${r.name}</div></div>
        <div class="cright">${save.loadout[w.cat] === id ? '<span class="equipped">장착됨</span>' : owned ? '보유' : notYet(w) ? '🔒 12월 출시' : w.price ? `🔒 ◆ ${priceOf(id).toLocaleString()}${dealOf(id) ? ` <span class="deal-tag">-${dealOf(id).off}%</span>` : ''}` : '무료'}</div>`;
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
      <button id="weapon-action" class="btn primary small" ${equipped || (!owned && notYet(w)) ? 'disabled' : ''}>
        ${equipped ? `${catName}에 장착됨` : owned ? `${catName}에 장착` : notYet(w) ? '🔒 12월부터 코인으로 구매 가능' : `구매하기 ◆ ${priceOf(w.id).toLocaleString()}${dealOf(w.id) ? ` (🔥 -${dealOf(w.id).off}%)` : ''}`}
      </button>
      ${owned ? '' : notYet(w) ? '<div class="hint">지금은 🏛️ 시즌 패스 50레벨 보상으로 받을 수 있어요</div>' : `<div class="hint">구매 후 [장착]을 누르면 ${catName} 슬롯에 들어갑니다.</div>`}`;
    $('weapon-action').onclick = (e) => {
      if (owned) {
        save.loadout[w.cat] = w.id;
        audio.init();
        audio.magIn();
        this.toast(`${catName}: ${w.name} 장착 완료`);
      } else if (notYet(w)) {
        this.toast('🔒 테이저건은 12월부터 코인으로 살 수 있어요');
        return;
      } else if (w.shopOnly) {
        this.toast('🛒 상점에서만 구매할 수 있어요');
        return;
      } else if (save.coins >= priceOf(w.id)) {
        save.coins -= priceOf(w.id);
        save.ownedWeapons.push(w.id);
        this.toast(`${w.name} 구매 완료 — [장착]을 누르세요`);
      } else {
        this.shake(e.currentTarget);
        this.toast(`코인이 부족합니다 (◆ ${(priceOf(w.id) - save.coins).toLocaleString()} 더 필요)`);
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
    const opts = skinsForWeapon(w.id).filter((o) => !o.bundle.hackOnly || isHack());
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
    let html;
    {
      // "bundles" and "season bundles" tabs
      const early = earlyOn();
      const tab = this.shopTab === 'season' ? 'season' : (this.shopTab || 'newchar') === 'newchar' && early ? 'newchar' : 'bundles';
      const pick = tab === 'newchar' ? [] : BUNDLES.filter((b) => (tab === 'season' ? b.season : !b.season)).sort((a, b) => !!a.soon - !!b.soon);
      html = `<div class="shop-tabs">${early ? `<button class="shop-tab new ${tab === 'newchar' ? 'on' : ''}" data-tab="newchar">신규 캐릭터! 🆕</button>` : ''}<button class="shop-tab ${tab === 'bundles' ? 'on' : ''}" data-tab="bundles">번들</button><button class="shop-tab ${tab === 'season' ? 'on' : ''}" data-tab="season">시즌 번들 🏛️</button></div>` +
        (tab === 'newchar' ? this.newCharHtml() : '') + (tab === 'bundles' ? this.dealsHtml() : '') + pick.map((b) => this.bundleHtml(b)).join('');
    }
    list.innerHTML = html;
    list.querySelectorAll('.shop-tab').forEach((t) => (t.onclick = () => { this.shopTab = t.dataset.tab; this.renderShop(); list.scrollTop = 0; }));
    this.bindShop(list);
  }

  /** 신규 캐릭터! tab: early-access cards (Chaos, spear) under one countdown banner */
  newCharHtml() {
    const head = `<div class="nc-banner">⚡ 얼리 액세스 · 📅 11월 30일까지만 판매 · <b id="early-left">${this.earlyLeftText()}</b></div>`;
    return head + EARLY_ITEMS.map((it, i) => (it.type === 'char' ? this.earlyCharHtml(it, i) : this.earlyWeaponHtml(it, i))).join('');
  }

  earlyOwned(it) { return it.type === 'char' ? save.owned.includes(it.id) : save.ownedWeapons.includes(it.id); }

  earlyFoot(it, i, name) {
    const owned = this.earlyOwned(it), off = Math.round((1 - it.price / it.was) * 100);
    return `${it.bonus ? `<div class="nc-bonus">🎁 번들 보너스: 구매하면 <b>◆ ${it.bonus}</b> 지급</div>` : ''}
      <div class="b-foot">
        <div class="b-price">${owned ? '보유 중' : `<s>◆ ${it.was.toLocaleString()}</s> ◆ ${it.price.toLocaleString()} <span class="nc-off">-${off}%</span>`}</div>
        <button class="btn primary small nc-buy" data-i="${i}" ${owned ? 'disabled' : ''}>${owned ? '구매 완료' : '얼리 액세스 구매'}</button>
      </div>
      <div class="hint">${owned ? (it.type === 'char' ? '캐릭터 탭에서 선택할 수 있어요' : '무기 탭 무기2에서 장착할 수 있어요') : `${name}은(는) 이 상점에서만 살 수 있어요 (${it.type === 'char' ? '캐릭터' : '무기'} 탭 판매 없음)`}</div>`;
  }

  earlyCharHtml(it, i) {
    const c = getCharacter(it.id), r = RARITY[c.rarity];
    const face = getPortrait(c);
    return `<section class="bundle newchar">
      <div class="b-ribbon" style="background:linear-gradient(90deg,#7a5cff,#ffcf5a)">⚡ 얼리 액세스 · 신규 캐릭터</div>
      <div class="nc-top">
        <div class="nc-face" style="background:linear-gradient(135deg, ${c.color}, ${c.accent})">${face ? `<img src="${face}" alt="">` : c.name[0]}</div>
        <div class="nc-info">
          <div class="b-title">⏳ ${c.name} <span class="rbadge" style="background:${r.color}">${r.name}</span></div>
          <div class="b-tag">${c.title}</div>
          <div class="b-desc">${c.desc}</div>
        </div>
      </div>
      <div class="nc-skills">${['q', 'e'].map((k) => `<div><b><span class="k">${k.toUpperCase()}</span> ${c[k].name}</b><small>${c[k].desc}</small></div>`).join('')}</div>
      ${this.earlyFoot(it, i, c.name)}
    </section>`;
  }

  earlyWeaponHtml(it, i) {
    const w = WEAPONS[it.id], r = RARITY[w.rarity], icon = getWeaponIcon(it.id);
    return `<section class="bundle newchar weapon">
      <div class="b-ribbon" style="background:linear-gradient(90deg,#c8242c,#ffcf5a)">⚡ 얼리 액세스 · 신규 무기</div>
      <div class="nc-top">
        <div class="nc-face wicon">${icon ? `<img src="${icon}" alt="">` : '🔱'}</div>
        <div class="nc-info">
          <div class="b-title">🔱 ${w.name} <span class="rbadge" style="background:${r.color}">${r.name}</span></div>
          <div class="b-tag">${w.model} · 무기2 · 근접</div>
          <div class="b-desc">${w.desc}</div>
        </div>
      </div>
      <div class="nc-skills">
        <div><b><span class="k">좌</span> 찌르기 ${w.damage}</b><small>칼보다 긴 사거리(${w.range}m)로 찌른다</small></div>
        <div><b><span class="k">우</span> 던지기 ${w.throwDmg}</b><small>창 ${w.mag}개 · 머리 ${w.throwDmg * w.headMul} · 떨어진 창을 주워 다시 던진다</small></div>
      </div>
      ${this.earlyFoot(it, i, w.name)}
    </section>`;
  }

  earlyLeftText() {
    const s = Math.max(0, Math.floor((EARLY_UNTIL - Date.now()) / 1000));
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return `판매 종료까지 ${d ? d + '일 ' : ''}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')} 남음`;
  }

  buyEarly(btn) {
    const it = EARLY_ITEMS[+btn.dataset.i];
    if (!it || !earlyOn() || this.earlyOwned(it)) return;
    if (save.coins < it.price) {
      this.shake(btn);
      this.toast(`코인이 부족합니다 (◆ ${(it.price - save.coins).toLocaleString()} 더 필요)`);
      return;
    }
    save.coins += (it.bonus || 0) - it.price;
    if (it.type === 'char') {
      const c = getCharacter(it.id);
      save.owned.push(c.id);
      save.character = c.id;
      this.viewChar = c.id;
      this.toast(`⏳ ${c.name} 획득! 번들 보너스 ◆${it.bonus} — 캐릭터 탭에서 선택되었어요`);
    } else {
      const w = WEAPONS[it.id];
      save.ownedWeapons.push(w.id);
      save.loadout[w.cat] = w.id;
      this.toast(`🔱 ${w.name} 획득! 무기 탭 무기2에 장착됐어요`);
    }
    persist();
    audio.init(); audio.kill();
    this.refresh();
    this.renderShop();
  }

  bundleOwned(b) {
    return b.weapons.every((wid) => save.ownedSkins.includes(skinId(b.id, wid))) && (!b.randomCharSkin || hasCharSkin()) && (b.outfits || []).every((o) => save.ownedOutfits.includes(o));
  }

  bundleHtml(b) {
    {
      const owned = this.bundleOwned(b);
      const free = !b.price;
      const soon = b.soon && !xmasOpen() && !owned;
      const r = RARITY[b.rarity];
      return `<section class="bundle ${b.id}">
        <div class="b-ribbon" style="background:${r.color}">${r.name} 번들</div>${soon ? '<div class="b-soon">12월에 출시!</div>' : ''}
        <div class="b-title">${b.name}</div>
        <div class="b-tag">${b.tagline}</div>
        <div class="b-weapons">
          ${b.weapons.map((wid) => `<button class="b-w" data-b="${b.id}" data-w="${wid}" title="눌러서 3D로 보기">
            <img src="${getWeaponIcon(wid, skinId(b.id, wid))}" alt=""><span>${WEAPONS[wid].name}</span></button>`).join('')}
          ${(b.outfits || []).map((o) => { const k = getCharSkin(o); return `<button class="b-w outfit" data-b="${b.id}" data-outfit="${o}" title="눌러서 3D로 보기">
            <img src="${getPortrait(getCharacter(k.char), o)}" alt=""><span>👮 ${k.name}</span></button>`; }).join('')}
          ${b.randomCharSkin ? `<button class="b-w outfit" data-b="${b.id}" data-outfit="xmas_rookie" title="예시: 산타 루키 · 눌러서 3D로 보기">
            <img src="${getPortrait(getCharacter('rookie'), 'xmas_rookie')}" alt=""><span>🎁 랜덤 캐릭터 스킨 1개</span></button>` : ''}
        </div>
        <div class="b-desc">${b.desc}</div>
        <div class="b-fx">✦ 처치 이펙트: <b>${b.killFx}</b></div>
        <div class="b-foot">
          <div class="b-price">${soon ? '🎄 12월에 출시!' : owned ? '보유 중' : free ? '무료' : `◆ ${b.price.toLocaleString()}`}</div>
          <button class="btn primary small b-buy" data-b="${b.id}" ${owned || soon ? 'disabled' : ''}>${soon ? '출시 예정' : owned ? (free ? '받기 완료' : '구매 완료') : free ? '무료 받기' : '번들 구매'}</button>
        </div>
      </section>`;
    }
  }

  bindShop(list) {
    list.querySelectorAll('.b-buy').forEach((btn) => (btn.onclick = () => this.buyBundle(btn.dataset.b, btn)));
    list.querySelectorAll('.nc-buy').forEach((btn) => (btn.onclick = () => this.buyEarly(btn)));
    list.querySelectorAll('.deal-buy').forEach((btn) => (btn.onclick = (e) => { e.stopPropagation(); this.buyDeal(btn.dataset.w, btn); }));
    list.querySelectorAll('.deal-card').forEach((el) => (el.onclick = () => this.openShopPreview(null, el.dataset.w)));
    clearInterval(this._dealTimer);
    this._dealTimer = setInterval(() => {
      const el = $('deal-left'), ea = $('early-left');
      if ((!el && !ea) || this.openId !== 'panel-shop') { clearInterval(this._dealTimer); return; }
      if (ea) { if (!earlyOn()) { this.renderShop(); return; } ea.textContent = this.earlyLeftText(); }
      if (!el) return;
      const s = dealSecondsLeft();
      if (s <= 0) { this.renderShop(); return; }
      el.textContent = `${Math.floor(s / 3600)}시간 ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}분 ${String(s % 60).padStart(2, '0')}초 남음`;
    }, 1000);
    list.querySelectorAll('.b-w').forEach((btn) => (btn.onclick = () => this.openShopPreview(btn.dataset.b, btn.dataset.w, btn.dataset.outfit)));
  }

  /** "today's deals": two weapons the player does not own, 30–50 % off */
  dealsHtml() {
    if (!isHack()) return '';
    const deals = dealsFor(save.ownedWeapons);
    const cards = deals.map((d) => {
      const w = WEAPONS[d.id], r = RARITY[w.rarity], cat = CATEGORIES.find((c) => c.id === w.cat).name;
      return `<div class="deal-card" data-w="${d.id}" style="--rc:${r.color}" title="눌러서 3D로 보기">
        <div class="deal-off">-${d.off}%</div>
        <img src="${getWeaponIcon(d.id)}" alt="">
        <div class="deal-name">${w.name}<small>${r.name} · ${cat}</small></div>
        <div class="deal-price"><s>◆ ${d.price.toLocaleString()}</s><b>◆ ${d.sale.toLocaleString()}</b></div>
        <button class="btn primary small deal-buy" data-w="${d.id}">구매</button>
      </div>`;
    }).join('');
    return `<section class="deals">
      <div class="deals-head"><b>🔥 오늘의 할인</b><small id="deal-left"></small></div>
      <div class="deals-row">${cards || '<div class="hint">모든 무기를 보유 중!</div>'}</div>
    </section>`;
  }

  buyDeal(wid, btn) {
    const d = dealOf(wid);
    if (!d || save.ownedWeapons.includes(wid)) return;
    if (save.coins < d.sale) {
      this.shake(btn);
      this.toast(`코인이 부족합니다 (◆ ${(d.sale - save.coins).toLocaleString()} 더 필요)`);
      return;
    }
    save.coins -= d.sale;
    save.ownedWeapons.push(wid);
    persist();
    audio.init(); audio.kill();
    this.toast(`🔥 ${WEAPONS[wid].name} 할인 구매 완료! (무기 탭에서 장착)`);
    this.refresh();
    this.renderShop();
  }

  buyBundle(bid, btn) {
    const b = BUNDLES.find((x) => x.id === bid);
    if (b.soon && !xmasOpen()) { this.toast('🎄 12월에 출시돼요!'); return; }
    if (save.coins < b.price) {
      this.shake(btn);
      this.toast(`코인이 부족합니다 (◆ ${(b.price - save.coins).toLocaleString()} 더 필요)`);
      return;
    }
    save.coins -= b.price;
    for (const wid of b.weapons) {
      const sid = skinId(b.id, wid);
      if (!save.ownedSkins.includes(sid)) save.ownedSkins.push(sid);
      if (!save.skins[wid] || b.price === 0) save.skins[wid] = sid; // auto-apply if the weapon had no skin
    }
    let got = null;
    for (const o of b.outfits || []) {
      if (!save.ownedOutfits.includes(o)) save.ownedOutfits.push(o);
      save.outfits[getCharSkin(o).char] = o;
    }
    if (b.randomCharSkin && !hasCharSkin()) {
      got = randomCharSkin();
      if (got) { save.ownedOutfits.push(got.id); save.outfits[got.char] = got.id; }
    }
    persist();
    audio.init();
    audio.kill();
    this.toast(got ? `${b.name} 획득! 캐릭터 스킨: 🎄 ${got.name} (${getCharacter(got.char).name})` : `${b.name} 번들 구매 완료! 무기 탭에서 스킨을 바꿀 수 있어요`);
    this.refresh();
    this.renderShop();
  }

  openShopPreview(bid, wid, outfit) {
    const b = BUNDLES.find((x) => x.id === bid);
    const pop = $('shop-pop');
    pop.classList.remove('hidden');
    pop.className = 'shop-pop ' + (bid || 'deal');
    $('shop-pop-title').textContent = b ? `${b.name} · ${outfit ? '캐릭터 의상' : WEAPONS[wid].name}` : `🔥 오늘의 할인 · ${WEAPONS[wid].name}`;
    const slot = pop.querySelector('.preview-slot');
    slot.appendChild(this.preview.canvas);
    this.previewActive = true;
    if (outfit) { this.setSubject('char'); this.setPreviewCharacter(getCharacter(getCharSkin(outfit)?.char || save.character), outfit); }
    else { this.setSubject('weapon'); this.setPreviewWeapon(wid, bid ? skinId(bid, wid) : null); }
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

  setPreviewCharacter(c, outfit = outfitFor(c.id)) {
    const p = this.preview;
    if (p.charId === c.id + '|' + outfit) return;
    p.charId = c.id + '|' + outfit;
    p.emote?.stop();
    if (p.model) {
      p.actor.remove(p.model.group);
      p.model.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    }
    p.model = makeSoldier(c.color, c.accent, c.id, outfit);
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
      p.weapon?.skinAnim?.(performance.now() * 0.001);
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
export function getPortrait(c, outfit = null) {
  const key = c.id + (outfit ? '|' + outfit : '');
  if (portraitCache[key] !== undefined) return portraitCache[key];
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
    const m = makeSoldier(c.color, c.accent, c.id, outfit);
    m.gun.visible = false;
    m.group.rotation.y = Math.PI; // face the camera (+z)
    scene.add(m.group);
    m.group.updateMatrixWorld(true);
    const h = m.head.getWorldPosition(new THREE.Vector3());
    h.y += outfit ? 0.2 : 0.1;
    if (outfit) cam.fov = 34; else cam.fov = 26;
    cam.updateProjectionMatrix();
    cam.position.set(h.x + 0.26, h.y + 0.05, h.z + 1.0);
    cam.lookAt(h.x, h.y - 0.04, h.z);
    r.render(scene, cam);
    portraitCache[key] = r.domElement.toDataURL();
    scene.remove(m.group);
    m.group.traverse((o) => o.isMesh && o.geometry.dispose());
  } catch (e) {
    console.warn('portrait render failed', e);
    portraitCache[key] = '';
  }
  return portraitCache[key];
}
