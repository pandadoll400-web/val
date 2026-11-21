/*
 * Ranked points (RP) from online matches: win +25, loss −15, draw 0. Never below 0.
 */
export const RANKS = [
  { id: 'bronze', name: '브론즈', min: 0, icon: '🥉', color: '#c8834a' },
  { id: 'silver', name: '실버', min: 200, icon: '🥈', color: '#c8d2dc' },
  { id: 'gold', name: '골드', min: 500, icon: '🥇', color: '#ffcf5a' },
  { id: 'plat', name: '플래티넘', min: 900, icon: '💠', color: '#5ff7d8' },
  { id: 'diamond', name: '다이아', min: 1400, icon: '💎', color: '#7ab8ff' },
  { id: 'master', name: '마스터', min: 2000, icon: '👑', color: '#ff7ad8' },
];
export const RP_WIN = 25, RP_LOSS = -15;

export function rankOf(rp = 0) {
  let r = RANKS[0];
  for (const k of RANKS) if (rp >= k.min) r = k;
  return r;
}
export const getRank = (id) => RANKS.find((r) => r.id === id) || RANKS[0];
export const nextRank = (rp = 0) => RANKS.find((k) => k.min > rp) || null;
/** 0..1 progress toward the next rank (1 at master) */
export function rankProgress(rp = 0) {
  const cur = rankOf(rp), nx = nextRank(rp);
  return nx ? (rp - cur.min) / (nx.min - cur.min) : 1;
}
export const rankDelta = (win, draw) => (draw ? 0 : win ? RP_WIN : RP_LOSS);
