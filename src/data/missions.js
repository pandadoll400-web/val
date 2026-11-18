import { mulberry32 } from '../util/noise.js';

/* Daily missions: three different kinds a day, the same for everyone (seeded by the date). */
export const MISSION_TYPES = {
  kills:     { text: (n) => `적 ${n}명 처치`, opts: [[10, 100], [20, 150], [30, 200]] },
  headshots: { text: (n) => `헤드샷 ${n}번`, opts: [[3, 120], [6, 160], [10, 200]] },
  wins:      { text: (n) => `승리 ${n}번`, opts: [[1, 150], [2, 250]] },
  matches:   { text: (n) => `게임 ${n}판 하기`, opts: [[2, 100], [4, 150]] },
  skills:    { text: (n) => `스킬 ${n}번 사용`, opts: [[8, 100], [15, 130]] },
  melee:     { text: (n) => `근접 무기로 ${n}명 처치`, opts: [[2, 150], [4, 200]] },
  online:    { text: (n) => `온라인 게임 ${n}판 하기`, opts: [[1, 150], [2, 220]] },
};

export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function missionsFor(date) {
  let seed = 0;
  for (const ch of date) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
  const rnd = mulberry32(seed);
  const types = Object.keys(MISSION_TYPES);
  for (let i = types.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [types[i], types[j]] = [types[j], types[i]]; }
  return types.slice(0, 3).map((type) => {
    const o = MISSION_TYPES[type].opts;
    const [target, reward] = o[Math.floor(rnd() * o.length)];
    return { type, target, reward, prog: 0, claimed: false };
  });
}
