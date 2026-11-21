/*
 * Season pass: XP from every match, 50 levels. Each level has a free reward and, with the royal pass, a royal one.
 * Every reward is one concrete thing so the pass can show a picture of it:
 *   { type:'coins', n } · { type:'skin', sid } · { type:'outfit', id } · { type:'title', t } · { type:'weapon', id }
 * Past 50 every level still pays ◆100 (royal ◆200 more).
 */
export const SEASON_ID = 'perse';
export const SEASON_NAME = '🏛️ 페르세폴리스 시즌';
export const XP_PER_LEVEL = 600;
export const MAX_LEVEL = 50;

export const ROYAL_PRICE = 30000;
export const ROYAL_XP_MULT = 1.3;

const coins = (n) => ({ type: 'coins', n });
const skin = (sid) => ({ type: 'skin', sid });
const title = (t) => ({ type: 'title', t });

/* free row: coins, titles at 10/20/30/40, two weapon skins, the taser at 50 */
const FREE_SPECIAL = {
  10: title('신병'), 15: skin('cyber_smg'), 20: title('협곡 사냥꾼'), 30: title('얼음 전설'),
  35: skin('aurora_knife'), 40: title('협곡의 왕'), 50: { type: 'weapon', id: 'taser' },
};
/* royal row: a weapon skin every 5 levels, extra coins on the rest */
const ROYAL_SPECIAL = {
  5: skin('inferno_pistol'), 10: skin('cyber_bow'), 15: skin('aurora_rifle'), 20: skin('inferno_shotgun'),
  25: title('로얄 사냥꾼'), 30: skin('cyber_rifle'), 35: skin('inferno_dmr'), 40: skin('aurora_sniper'),
  45: { type: 'outfit', id: 'perse_volt' }, 50: skin('perse_taser'),
};
export const TITLES = Object.values(FREE_SPECIAL).filter((r) => r.type === 'title').map((r) => r.t);
export const ROYAL_TITLES = ['로얄 사냥꾼', '👑 페르시아의 왕'];

const tier = (lvl) => Math.floor((lvl - 1) / 10); // 0..4

/** free reward for a level */
export function freeReward(lvl) {
  if (lvl > MAX_LEVEL) return coins(100);
  return FREE_SPECIAL[lvl] || coins(100 + Math.min(tier(lvl), 2) * 100); // 100 · 200 · 300
}

/** royal rewards for a level (a list: level 50 gives a skin, a title and coins) */
export function royalRewards(lvl) {
  if (lvl > MAX_LEVEL) return [coins(200)];
  if (lvl === MAX_LEVEL) return [ROYAL_SPECIAL[lvl], title('👑 페르시아의 왕'), coins(5000)];
  return [ROYAL_SPECIAL[lvl] || coins(300 + Math.min(tier(lvl), 3) * 100)]; // 300 … 600
}

/** coins given instead when the reward is already owned */
export const dupeCoins = (r) => (r.type === 'weapon' ? 1500 : 500);

export const levelOf = (xp) => 1 + Math.floor((xp || 0) / XP_PER_LEVEL);
export const levelProgress = (xp) => ((xp || 0) % XP_PER_LEVEL) / XP_PER_LEVEL;

/** XP for one finished match */
export function matchXp({ kills = 0, headshots = 0, win = false, online = false }) {
  const xp = 50 + kills * 20 + headshots * 10 + (win ? 150 : 0);
  return Math.round(xp * (online ? 1.2 : 1));
}
