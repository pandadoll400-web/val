import { WEAPONS, DEFAULT_LOADOUT } from './data/weapons.js';
import { CHARACTERS } from './data/characters.js';

const KEY = 'frostcanyon.save.v1';
const DEFAULT = {
  coins: 500,
  owned: ['rookie'],
  character: 'rookie',
  ownedWeapons: null, // filled below (migration)
  sens: 1.0,
  volume: 0.7,
  fov: 75,
  name: '',
  ownedOutfits: [],
  outfit: null,
};

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    // saves written before v1.1 have no version number
    if (!('ver' in s)) s.ver = Object.keys(s).length ? 1 : 2;
    return { ...DEFAULT, ...s };
  } catch {
    return { ...DEFAULT, ver: 2 };
  }
}

/** fix up / migrate a save object in place (also used for saves loaded from the cloud) */
function normalize(save) {
  for (const [k, v] of Object.entries(DEFAULT)) if (save[k] === undefined) save[k] = Array.isArray(v) ? [...v] : v;
  if (!save.name) save.name = '플레이어' + Math.floor(Math.random() * 900 + 100);
  if (!Array.isArray(save.owned)) save.owned = ['rookie'];
  // v2 (v1.1): characters are sold for coins again — the ones handed out for free in v0.9-v1.0 are locked
  if ((save.ver || 1) < 2) { save.owned = ['rookie']; save.ver = 2; }
  if (!save.owned.includes('rookie')) save.owned.unshift('rookie');
  if (!CHARACTERS.some((c) => c.id === save.character) || !save.owned.includes(save.character)) save.character = 'rookie';
  // weapons: the free ones are always owned; a weapon equipped in an older save stays owned
  if (!Array.isArray(save.ownedWeapons)) save.ownedWeapons = [];
  for (const id of Object.keys(WEAPONS)) if (WEAPONS[id].price === 0 && !save.ownedWeapons.includes(id)) save.ownedWeapons.push(id);
  if (WEAPONS[save.weapon] && !save.ownedWeapons.includes(save.weapon)) save.ownedWeapons.push(save.weapon);
  // 3-slot loadout (무기1 / 무기2 / 보조); migrate the single weapon of older saves into its slot
  if (!save.loadout || typeof save.loadout !== 'object') {
    save.loadout = { ...DEFAULT_LOADOUT };
    const old = WEAPONS[save.weapon];
    if (old) save.loadout[old.cat] = old.id;
  }
  for (const cat of Object.keys(DEFAULT_LOADOUT)) {
    const id = save.loadout[cat];
    if (!WEAPONS[id] || WEAPONS[id].cat !== cat || !save.ownedWeapons.includes(id)) save.loadout[cat] = DEFAULT_LOADOUT[cat];
  }
  delete save.weapon;
  // weapon skins bought in the shop, and which skin each weapon uses
  if (!Array.isArray(save.ownedSkins)) save.ownedSkins = [];
  if (!save.skins || typeof save.skins !== 'object') save.skins = {};
  // bundle character outfits
  if (!Array.isArray(save.ownedOutfits)) save.ownedOutfits = [];
  if (save.outfit && !save.ownedOutfits.includes(save.outfit)) save.outfit = null;
  return save;
}

export const save = normalize(load());

/* ---------- cloud sync (set by the account system when logged in) ---------- */
let cloudWriter = null;
let cloudTimer = 0;
export function setCloudWriter(fn) { cloudWriter = fn; }

/** the part of the save that belongs to the account (settings stay per device) */
export function accountData() {
  const { sens, volume, fov, ...rest } = save;
  return JSON.parse(JSON.stringify(rest));
}

/** replace the account part of the save with data loaded from the cloud */
export function applyAccountData(data) {
  const keep = { sens: save.sens, volume: save.volume, fov: save.fov };
  for (const k of Object.keys(save)) delete save[k];
  Object.assign(save, { ...DEFAULT, ...data, ...keep });
  if (!('ver' in data)) save.ver = 2;
  normalize(save);
  persist(true);
}

/** the "hack" account owns every character and weapon */
export function grantAll() {
  for (const c of CHARACTERS) if (!save.owned.includes(c.id)) save.owned.push(c.id);
  for (const id of Object.keys(WEAPONS)) if (!save.ownedWeapons.includes(id)) save.ownedWeapons.push(id);
}

/** fresh progress for a new account (or after logging out) */
export function resetSave(name = '') {
  applyAccountData({ coins: DEFAULT.coins, owned: ['rookie'], character: 'rookie', ver: 2, name });
}

export function persist(localOnly = false) {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ }
  if (localOnly || !cloudWriter) return;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(() => cloudWriter?.(accountData()), 800);
}
