import { mulberry32 } from '../util/noise.js';
import { WEAPONS } from './weapons.js';
import { todayStr } from './missions.js';

/*
 * Shop "today's deals": two weapons the player does not own yet, 30–50 % off, replaced at local midnight.
 * The order is seeded by the date, so everyone sees the same weapons (minus the ones they already own).
 */
function seedOf(str) { let s = 7; for (const ch of str) s = (s * 31 + ch.charCodeAt(0)) | 0; return s; }

export function dealsFor(owned, date = todayStr()) {
  const rnd = mulberry32(seedOf('deal' + date));
  const ids = Object.keys(WEAPONS).filter((id) => WEAPONS[id].price > 0 && !WEAPONS[id].hackOnly);
  const off = {};
  for (const id of ids) off[id] = [30, 40, 50][Math.floor(rnd() * 3)];
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  return ids.filter((id) => !owned.includes(id)).slice(0, 2).map((id) => {
    const price = WEAPONS[id].price;
    return { id, off: off[id], price, sale: Math.round((price * (100 - off[id])) / 100 / 10) * 10 };
  });
}

/** seconds left until the deals change */
export function dealSecondsLeft(now = new Date()) {
  const m = new Date(now); m.setHours(24, 0, 0, 0);
  return Math.max(0, Math.floor((m - now) / 1000));
}
