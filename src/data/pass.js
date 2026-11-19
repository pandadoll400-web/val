/*
 * Season pass (free): XP from every match, 30 levels with a reward each. Past 30, every level still pays ◆100.
 */
export const SEASON_NAME = '🎄 홀리 나이트 시즌';
export const XP_PER_LEVEL = 600;
export const MAX_LEVEL = 30;

export const TITLES = { 5: '신병', 10: '협곡 사냥꾼', 20: '얼음 전설', 30: '협곡의 왕' };

/** reward for a level: { coins, title?, skin? } */
export function passReward(lvl) {
  if (lvl > MAX_LEVEL) return { coins: 100 };
  const r = { coins: 100 + Math.floor((lvl - 1) / 10) * 100 }; // 100 · 200 · 300 by tier
  if (TITLES[lvl]) r.title = TITLES[lvl];
  if (lvl === 15 || lvl === 25) r.skin = true;
  if (lvl === 30) r.coins += 1500;
  return r;
}

export const levelOf = (xp) => 1 + Math.floor((xp || 0) / XP_PER_LEVEL);
export const levelProgress = (xp) => ((xp || 0) % XP_PER_LEVEL) / XP_PER_LEVEL;

/** XP for one finished match */
export function matchXp({ kills = 0, headshots = 0, win = false, online = false }) {
  const xp = 50 + kills * 20 + headshots * 10 + (win ? 150 : 0);
  return Math.round(xp * (online ? 1.2 : 1));
}
