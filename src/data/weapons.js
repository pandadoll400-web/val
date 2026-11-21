// Weapon definitions. Spread values are radians (cone half-angle).
// kind: 'gun' (hitscan) | 'bow' (draw & release projectile) | 'melee'
export const WEAPONS = {
  pistol: {
    id: 'pistol', cat: 'sidearm', name: '권총', model: 'P-9 사이드암', kind: 'gun', rarity: 'common', price: 0,
    desc: '가볍고 빠른 반자동 권총. 이동하며 쏘기 좋고 재장전이 빠르다.',
    damage: 38, head: 76, fireInterval: 0.15, auto: false, mag: 12, reserve: 96, reload: 1.3,
    range: 140, adsFov: 55, mobility: 1.0,
    spread: { hip: 0.014, move: 0.02, ads: 0.002, bloom: 0.012, maxBloom: 0.05 },
    recoil: { pitch: 0.014, yaw: 0.004, kickZ: 0.045, kickRX: 0.07 },
    tracer: '#ffd27a', stats: { damage: 30, rate: 55, range: 40, mobility: 95 },
  },
  knife: {
    id: 'knife', cat: 'sidearm', name: '전술 나이프', model: 'KR-1 탄토', kind: 'melee', rarity: 'common', price: 0,
    desc: '좌클릭 베기(75) · 우클릭 강하게 찌르기(110). 등 뒤를 노리면 일격(150). 들고 있으면 이동이 빨라진다.',
    damage: 75, heavy: 110, back: 150, range: 2.4, mag: 0, reserve: 0, mobility: 1.12, adsFov: 75,
    lightTime: 0.42, heavyTime: 0.85,
    spread: { hip: 0, move: 0, ads: 0, bloom: 0, maxBloom: 0 },
    stats: { damage: 70, rate: 60, range: 5, mobility: 100 },
  },
  smg: {
    id: 'smg', cat: 'primary', name: '기관단총', model: 'VX-9 서브머신건', kind: 'gun', rarity: 'rare', price: 0,
    desc: '분당 900발의 초고속 연사. 근거리 교전의 왕. 홀로그래픽 조준경 장착.',
    damage: 25, head: 48, fireInterval: 0.066, auto: true, mag: 32, reserve: 256, reload: 1.8,
    range: 110, adsFov: 52, mobility: 1.0,
    spread: { hip: 0.022, move: 0.018, ads: 0.006, bloom: 0.005, maxBloom: 0.04 },
    recoil: { pitch: 0.005, yaw: 0.005, kickZ: 0.02, kickRX: 0.025 },
    tracer: '#ffd27a', stats: { damage: 30, rate: 100, range: 35, mobility: 90 },
  },
  shotgun: {
    id: 'shotgun', cat: 'primary', name: '산탄총', model: 'GL-12 펌프액션', kind: 'gun', rarity: 'rare', price: 700,
    desc: '근거리 최강. 9발의 산탄을 한 번에 발사한다. 한 발씩 장전하는 펌프액션.',
    damage: 21, head: 32, pellets: 9, fireInterval: 0.8, auto: false, mag: 6, reserve: 48, reload: 0.5,
    range: 45, falloffStart: 12, adsFov: 58, mobility: 0.95, cycle: 0.6,
    spread: { hip: 0.07, move: 0.01, ads: 0.05, bloom: 0, maxBloom: 0 },
    recoil: { pitch: 0.04, yaw: 0.01, kickZ: 0.1, kickRX: 0.16 },
    tracer: '#ffb35a', stats: { damage: 90, rate: 25, range: 20, mobility: 80 },
  },
  rifle: {
    id: 'rifle', cat: 'primary', name: '소총', model: 'FR-7 돌격소총', kind: 'gun', rarity: 'epic', price: 1200,
    desc: '안정적인 자동 소총. 레드닷 조준경과 전술 라이트가 달려 있는 만능 무기.',
    damage: 32, head: 70, fireInterval: 0.095, auto: true, mag: 30, reserve: 210, reload: 2.1,
    range: 220, adsFov: 45, mobility: 0.92,
    spread: { hip: 0.02, move: 0.03, ads: 0.0025, bloom: 0.007, maxBloom: 0.05 },
    recoil: { pitch: 0.0075, yaw: 0.005, kickZ: 0.028, kickRX: 0.035 },
    tracer: '#ffc35a', stats: { damage: 45, rate: 85, range: 70, mobility: 75 },
  },
  bow: {
    id: 'bow', cat: 'secondary', name: '복합 활', model: 'AURORA 리커브', kind: 'bow', rarity: 'epic', price: 1400,
    desc: '좌클릭을 누르고 있으면 시위를 당기고, 놓으면 발사. 많이 당길수록 강하고 멀리 날아간다(50~160). 헤드샷 2배.',
    damage: 50, maxDamage: 160, headMul: 2, drawTime: 0.9, mag: 1, reserve: 30, reload: 0.6,
    range: 300, adsFov: 50, mobility: 1.0, arrowSpeed: [32, 85],
    spread: { hip: 0.01, move: 0.012, ads: 0.0, bloom: 0, maxBloom: 0 },
    recoil: { pitch: 0.006, yaw: 0.002, kickZ: 0.03, kickRX: 0.03 },
    tracer: '#bff0ff', stats: { damage: 85, rate: 30, range: 85, mobility: 95 },
  },
  dmr: {
    id: 'dmr', cat: 'secondary', name: '저격소총', model: 'MK-14 지정사수소총', kind: 'gun', rarity: 'legendary', price: 2200,
    desc: '반자동 정밀 저격소총. 4배 스코프로 중장거리를 빠르게 제압한다. 10발 탄창.',
    damage: 52, head: 150, fireInterval: 0.28, auto: false, mag: 10, reserve: 60, reload: 2.4,
    range: 350, adsFov: 26, mobility: 0.9, scope: true, scopeStyle: 'chevron',
    spread: { hip: 0.045, move: 0.05, ads: 0.0008, bloom: 0.01, maxBloom: 0.03 },
    recoil: { pitch: 0.022, yaw: 0.006, kickZ: 0.06, kickRX: 0.09 },
    tracer: '#ffe08a', stats: { damage: 75, rate: 45, range: 90, mobility: 65 },
  },
  sniper: {
    id: 'sniper', cat: 'secondary', name: '스나이퍼', model: 'NV-50 볼트액션', kind: 'gun', rarity: 'mythic', price: 3000,
    desc: '정밀한 볼트액션 저격총. 우클릭 시 8배 스코프. 몸 50 · 머리 150.',
    damage: 50, head: 150, fireInterval: 1.25, auto: false, mag: 5, reserve: 30, reload: 3.5,
    range: 450, adsFov: 12, mobility: 0.85, scope: true, cycle: 0.95,
    spread: { hip: 0.07, move: 0.1, ads: 0.0, bloom: 0, maxBloom: 0 },
    recoil: { pitch: 0.05, yaw: 0.01, kickZ: 0.11, kickRX: 0.2 },
    tracer: '#9fe7ff', stats: { damage: 100, rate: 12, range: 100, mobility: 55 },
  },
  lmg: {
    id: 'lmg', cat: 'primary', name: '경기관총', model: 'HX-60 분대지원화기', kind: 'gun', rarity: 'legendary', price: 1600,
    desc: '60발 박스 탄창으로 끊임없이 퍼붓는 제압 화기. 무겁고 재장전이 느리지만 탄막은 압도적이다.',
    damage: 34, head: 68, fireInterval: 0.085, auto: true, mag: 60, reserve: 240, reload: 3.2,
    range: 200, adsFov: 50, mobility: 0.82,
    spread: { hip: 0.03, move: 0.035, ads: 0.006, bloom: 0.004, maxBloom: 0.05 },
    recoil: { pitch: 0.006, yaw: 0.006, kickZ: 0.024, kickRX: 0.03 },
    tracer: '#ffb35a', stats: { damage: 50, rate: 90, range: 65, mobility: 45 },
  },
  burst: {
    id: 'burst', cat: 'secondary', name: '버스트 카빈', model: 'BR-3 점사 카빈', kind: 'gun', rarity: 'rare', price: 0,
    desc: '한 번 당기면 3발이 빠르게 나가는 점사 카빈. 레드닷 조준경으로 중거리 헤드샷에 강하다.',
    damage: 38, head: 80, fireInterval: 0.07, burst: 3, burstDelay: 0.32, auto: false, mag: 24, reserve: 168, reload: 2.0,
    range: 230, adsFov: 46, mobility: 0.95,
    spread: { hip: 0.022, move: 0.026, ads: 0.0018, bloom: 0.004, maxBloom: 0.03 },
    recoil: { pitch: 0.0085, yaw: 0.004, kickZ: 0.026, kickRX: 0.03 },
    tracer: '#ffd27a', stats: { damage: 55, rate: 60, range: 75, mobility: 85 },
  },
  grenade: {
    id: 'grenade', cat: 'sidearm', name: '수류탄', model: 'M-67 파편 수류탄', kind: 'grenade', rarity: 'epic', price: 500,
    desc: '좌클릭 멀리 던지기 · 우클릭 가까이 굴리기. 1.8초 뒤 폭발해 반경 7m에 최대 160 피해. 3개 지급, 탄약 상자로 보충.',
    damage: 160, minDamage: 35, radius: 7, fuse: 1.8, mag: 1, reserve: 2, reload: 0, mobility: 1.05, adsFov: 75, range: 0,
    spread: { hip: 0, move: 0, ads: 0, bloom: 0, maxBloom: 0 },
    stats: { damage: 95, rate: 15, range: 30, mobility: 100 },
  },
};

WEAPONS.smoke = {
  id: 'smoke', cat: 'sidearm', name: '연막탄', model: 'M-18 연막 수류탄', kind: 'grenade', smoke: true, rarity: 'rare', price: 400,
  desc: '좌클릭 멀리 · 우클릭 가까이. 1.4초 뒤 반경 5m에 8초간 짙은 연막 — 적의 시야를 가린다. 2개 지급, 탄약 상자로 보충.',
  damage: 0, minDamage: 0, radius: 5, duration: 8, fuse: 1.4, mag: 1, reserve: 1, reload: 0, mobility: 1.05, adsFov: 75, range: 0,
  spread: { hip: 0, move: 0, ads: 0, bloom: 0, maxBloom: 0 },
  stats: { damage: 0, rate: 15, range: 30, mobility: 100 },
};

WEAPONS.dualmini = {
  id: 'dualmini', cat: 'secondary', name: '미니소총', model: 'TWIN-M 쌍권 미니소총', kind: 'gun', dual: true, noReload: true, rarity: 'mythic', price: 2600,
  desc: '작은 소총 2자루를 양손에 들고 번갈아 쏜다. 탄약 3000발 — 재장전이 없다.',
  damage: 16, head: 32, fireInterval: 0.055, auto: true, mag: 3000, reserve: 0, reload: 0,
  range: 120, adsFov: 62, mobility: 0.95,
  spread: { hip: 0.03, move: 0.022, ads: 0.016, bloom: 0.004, maxBloom: 0.05 },
  recoil: { pitch: 0.004, yaw: 0.006, kickZ: 0.018, kickRX: 0.02 },
  tracer: '#ffd27a', stats: { damage: 28, rate: 100, range: 35, mobility: 85 },
};

WEAPONS.katana = {
  id: 'katana', cat: 'secondary', name: '카타나', model: 'OBORO 장검', kind: 'melee', guard: true, rarity: 'legendary', price: 2400,
  desc: '좌클릭 베기(85). 우클릭을 누르고 있으면 막기 — 정면에서 온 근접 외 모든 공격(총알·스킬)을 공격자에게 그대로 반사한다. 막는 동안 느려진다.',
  damage: 85, heavy: 85, back: 130, range: 3.0, mag: 0, reserve: 0, mobility: 1.05, adsFov: 75,
  lightTime: 0.5, heavyTime: 0.5,
  spread: { hip: 0, move: 0, ads: 0, bloom: 0, maxBloom: 0 },
  stats: { damage: 80, rate: 50, range: 8, mobility: 95 },
};

WEAPONS.flamer = {
  id: 'flamer', cat: 'primary', name: '화염방사기', model: 'PYRO-9 화염방사기', kind: 'gun', flame: true, noReload: true, rarity: 'infinity', price: 10000,
  desc: '9m 앞까지 불길을 계속 뿜는다. 불길에 닿은 적은 3초 동안 불타며 0.5초마다 추가 피해. 연료 100 — 재장전 없이, 쏘기를 멈추면 1초 뒤부터 스스로 충전된다. 벽은 뚫지 못한다.',
  damage: 6, head: 8, fireInterval: 0.05, auto: true, mag: 100, reserve: 0, reload: 0, recharge: { delay: 1, rate: 30 },
  range: 9, cone: 0.9, burn: { secs: 3, tick: 0.5, dmg: 5 }, adsFov: 68, mobility: 0.9,
  spread: { hip: 0, move: 0, ads: 0, bloom: 0, maxBloom: 0 },
  recoil: { pitch: 0.0008, yaw: 0.001, kickZ: 0.004, kickRX: 0.004 },
  tracer: '#ff8a2a', stats: { damage: 70, rate: 95, range: 12, mobility: 75 },
};

WEAPONS.railgun = {
  id: 'railgun', cat: 'secondary', name: '레일건', model: 'VOLT-R 전자기 레일건', kind: 'gun', rail: true, rarity: 'mythic', price: 6000,
  desc: '방아쇠를 0.7초 누르고 있으면 충전된 전자기 탄이 발사된다(몸 25 · 머리 50). 일직선 위의 적을 모두 관통한다(벽은 못 뚫음). 일찍 떼면 취소. 우클릭 조준경.',
  damage: 25, head: 50, charge: 0.7, fireInterval: 0.9, auto: true, mag: 4, reserve: 12, reload: 3.2,
  range: 300, adsFov: 30, mobility: 0.9, scope: true,
  spread: { hip: 0.004, move: 0.01, ads: 0, bloom: 0, maxBloom: 0 },
  recoil: { pitch: 0.03, yaw: 0.006, kickZ: 0.06, kickRX: 0.08 },
  tracer: '#5ff7ff', stats: { damage: 50, rate: 25, range: 100, mobility: 70 },
};

WEAPONS.taser = {
  id: 'taser', cat: 'sidearm', name: '테이저건', model: 'ZAP-2 전기 충격기', kind: 'gun', taser: true, noReload: true, noDeal: true, decSale: true, rarity: 'epic', price: 1500,
  desc: '12m 안의 적 1명에게 전기 침을 쏜다. 피해 15 + 1.5초 동안 느려짐(봇은 조준도 흔들림). 한 발 쏘면 4초 동안 스스로 충전된다. 벽은 못 뚫는다.',
  damage: 15, head: 15, fireInterval: 0.5, auto: false, mag: 1, reserve: 0, reload: 0, recharge: { delay: 0, rate: 0.25 },
  range: 12, adsFov: 60, mobility: 1.0, stun: 1.5,
  spread: { hip: 0, move: 0, ads: 0, bloom: 0, maxBloom: 0 },
  recoil: { pitch: 0.01, yaw: 0.003, kickZ: 0.03, kickRX: 0.05 },
  tracer: '#ffe94a', stats: { damage: 15, rate: 10, range: 10, mobility: 95 },
};

export const CATEGORIES = [
  { id: "primary", name: "무기1", sub: "돌격" },
  { id: "secondary", name: "무기2", sub: "정밀" },
  { id: "sidearm", name: "보조", sub: "보조" },
];
export const CATEGORY_ORDER = {
  primary: ["smg", "rifle", "shotgun", "lmg", "flamer"],
  secondary: ["burst", "dmr", "sniper", "bow", "dualmini", "katana", "railgun"],
  sidearm: ["pistol", "taser", "knife", "grenade", "smoke"],
};
export const WEAPON_ORDER = [...CATEGORY_ORDER.primary, ...CATEGORY_ORDER.secondary, ...CATEGORY_ORDER.sidearm];
export const DEFAULT_LOADOUT = { primary: "smg", secondary: "burst", sidearm: "pistol" };
export const getWeapon = (id) => WEAPONS[id] || WEAPONS.pistol;
