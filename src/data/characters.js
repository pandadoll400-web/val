export const RARITY = {
  common:    { name: '일반', color: '#a7b1bd' },
  rare:      { name: '희귀', color: '#3d9bff' },
  epic:      { name: '영웅', color: '#b45cff' },
  legendary: { name: '전설', color: '#ffb627' },
  mythic:    { name: '신화', color: '#ff4d5e' },
  infinity:  { name: '인피니티', color: '#3dfff0' },
};

// every character has 150 HP; bought with ice coins (rookie is free)
export const CHARACTERS = [
  {
    id: 'rookie', name: '루키', title: '협곡 경비대 신병', rarity: 'common', price: 0,
    color: '#4f7fa8', accent: '#ffd36b',
    desc: '처음 협곡에 배치된 신병. 단순하지만 믿음직한 생존 기술을 가졌다.',
    q: { name: '구급 키트', desc: '즉시 체력 60 회복', cd: 18 },
    e: { name: '전술 대시', desc: '이동 방향으로 빠르게 돌진', cd: 6 },
  },
  {
    id: 'frost', name: '프로스트', title: '빙결 공병', rarity: 'rare', price: 500,
    color: '#5fc9ff', accent: '#e8fbff',
    desc: '얼음을 자유자재로 다루는 공병. 전장을 얼려 적의 발을 묶는다.',
    q: { name: '얼음 장벽', desc: '전방에 10초간 유지되는 얼음 벽 생성', cd: 16 },
    e: { name: '프로스트 렌지', desc: 'E를 누르고 있으면 손에 냉기 구체를 모으고, 떼면 발사. 오래 모을수록 강해져 착탄 지점에 5초간 총 35~100 피해 · 둔화', cd: 14, hold: true },
  },
  {
    id: 'blaze', name: '블레이즈', title: '화염 돌격병', rarity: 'epic', price: 1000,
    color: '#ff6a2b', accent: '#ffd0a0',
    desc: '얼음 협곡에서 유일하게 불을 다루는 돌격병. 거칠고 공격적이다.',
    q: { name: '화염병', desc: '착탄 지점에 5초간 불길 (초당 35 피해)', cd: 15 },
    e: { name: '과열', desc: '6초간 연사속도 +60%, 재장전 속도 +40%', cd: 20 },
  },
  {
    id: 'nitro', name: '니트로', title: '화염 질주자', rarity: 'epic', price: 1200,
    color: '#ff8a1f', accent: '#ffe066',
    desc: '부스터를 등에 멘 폭주족. 지나간 자리에 불길이 남는다.',
    q: { name: '니트로 부스트', desc: '이동 방향으로 돌진하며 3초간 타오르는 불길을 남김 (초당 30 피해)', cd: 12 },
    e: { name: '화염 렌지', desc: 'E를 누르고 있으면 손에 불꽃 구체를 모으고, 떼면 던짐. 착탄 시 폭발 35~100 피해 (오래 모을수록 강함)', cd: 14, hold: true },
  },
  {
    id: 'shadow', name: '섀도우', title: '그림자 암살자', rarity: 'legendary', price: 2000,
    color: '#7a4dff', accent: '#d6c8ff',
    desc: '눈보라 속에 숨어드는 암살자. 보이지 않는 곳에서 나타난다.',
    q: { name: '은신', desc: '4초간 투명화 — 적이 탐지하지 못함 (사격 시 해제)', cd: 16 },
    e: { name: '그림자 표식', desc: '표식 설치 후 다시 누르면 표식으로 순간이동', cd: 10 },
  },
  {
    id: 'ghost', name: '고스트', title: '유령 요원', rarity: 'legendary', price: 2200,
    color: '#cfe8ee', accent: '#5ff2e0',
    desc: '쓰러뜨린 적의 영혼을 거둬 모습을 감추는 요원.',
    q: { name: '망령', desc: '처치 1명당 2초 은신 (영혼 스택을 모두 소모, 사격 시 해제)', cd: 6 },
    e: { name: '유령화', desc: '즉시 2초간 투명 (사격 시 해제)', cd: 12 },
  },
  {
    id: 'volt', name: '볼트', title: '전격 특수요원', rarity: 'mythic', price: 3500,
    color: '#ffe14d', accent: '#8ff7ff',
    desc: '오로라의 에너지를 흡수한 특수요원. 번개로 적을 꿰뚫는다.',
    q: { name: '전격 화살', desc: '적중 시 65 피해 + 주변 적 2명에게 연쇄 35 피해', cd: 9 },
    e: { name: '오버차지', desc: '반경 12m 충격파: 45 피해 + 2.5초 기절', cd: 30 },
  },
  {
    id: 'echo', name: '에코', title: '음파 지휘자', rarity: 'mythic', price: 3800,
    color: '#ff5fb8', accent: '#c9a2ff',
    desc: '소리를 무기로 바꾸는 지휘자. 음표 하나로 전장의 리듬을 바꾼다.',
    q: { name: '공명 음표', desc: '왼손의 음표를 무기에 넣어 8초간 무기 피해 1.5배', cd: 18 },
    e: { name: '화음탄', desc: '양손의 음표를 합쳐 발사 — 적중 시 20 피해', cd: 7 },
  },
  {
    id: 'inker', name: '잉커', title: '잉크 아티스트', rarity: 'epic', price: 1300,
    color: '#3b2bd8', accent: '#20d0ff',
    desc: '전장을 캔버스로 쓰는 아티스트. 잉크로 적을 덮고 동료의 발걸음을 빠르게 한다.',
    q: { name: '잉크 폭탄', desc: 'Q를 누르고 있으면 왼손의 잉크가 커지고, 떼면 던짐 — 최대 80 피해 · 잉크 위 아군 이동속도 최대 +40%', cd: 10, hold: true },
    e: { name: '잉크 대시', desc: '이동 방향으로 돌진하며 넓은 잉크를 남김 (아군 이동속도 +40%)', cd: 7 },
  },
  {
    id: 'titan', name: '타이탄', title: '바위 거인', rarity: 'epic', price: 1400,
    color: '#7d6f62', accent: '#ff8a2a',
    desc: '산을 깎아 만든 듯한 거인. 버틸수록 강해지고, 분노하면 돌 골렘이 된다.',
    q: { name: '거인의 체력', desc: '최대 체력 +10 · 체력 20 회복 (최대 체력 250까지 누적, 죽으면 초기화)', cd: 3 },
    e: { name: '돌 골렘', desc: '8초간 돌 골렘으로 변신 — 주는 피해 1.6배', cd: 22 },
  },
  {
    id: 'glitch', name: '글리치', title: '오류의 해커', rarity: 'mythic', price: 5000,
    color: '#8a3dff', accent: '#39ff9e',
    desc: '현실의 코드를 비틀어 버리는 해커. 처치할수록 상대의 시스템을 망가뜨린다.',
    q: { name: '글리치 레이저', desc: '오른손에 글리치 기를 모아 3초간 레이저 발사 (초당 20 피해)', cd: 15 },
    e: { name: '글리치 코드', desc: '처치 1명당 스택 +1 (최대 3). 조준한 적에게 스택을 모두 사용 — 1: 3초간 속도 1/3 · 2: +3초간 그 적의 피해 1 · 3: +3초간 시야 가림', cd: 4 },
  },
  {
    id: 'inferno', name: '인페르노', title: '원소의 군주', rarity: 'infinity', price: 8000,
    color: '#ff5a1f', accent: '#4fd8ff',
    desc: '불과 물, 두 원소를 동시에 다루는 전설 너머의 존재. 무엇도 그를 상처 입히지 못한다.',
    q: { name: '증기 폭발', desc: '왼손의 물 구슬과 오른손의 화염 구슬을 합쳐 조준한 곳에 6초간 짙은 수증기 — 상대 시야를 가림', cd: 14 },
    e: { name: '마력 결계', desc: '한 손에 거대한 마법 구슬을 만들어 2초간 모든 공격을 흡수', cd: 18 },
  },
  {
    id: 'bloom', name: '블룸', title: '생명의 정원사', rarity: 'infinity', price: 8000,
    color: '#5fc83a', accent: '#ff8fd0',
    desc: '씨앗 하나로 죽음마저 되돌리는 정원사. 그의 꽃이 피어 있는 한 쓰러지지 않는다.',
    q: { name: '생명의 씨앗', desc: '씨앗을 바닥에 꽂아 즉시 꽃나무를 키운다 — 꽃나무가 있는 동안 죽으면 그 자리에서 되살아남', cd: 70 },
    e: { name: '축복의 씨앗', desc: '씨앗 2개 — 하나는 나, 하나는 가장 가까운 아군에게. 각각 무작위: 체력 +30 · 5초간 피해 1.5배 · 10초간 이동속도 1.5배', cd: 18 },
  },
  {
    id: 'crick', name: '크릭', title: '스킬 사냥꾼', rarity: 'epic', price: 0,
    color: '#1fa38a', accent: '#d9ff5a',
    desc: '상대의 힘을 읽고 끊어내는 사냥꾼. 남의 스킬을 봉인하고, 빼앗아 자기 것처럼 쓴다.',
    q: { name: '스킬 봉인', desc: '조준한 적의 스킬을 10초간 사용할 수 없게 만든다', cd: 20 },
    e: { name: '스킬 강탈', desc: '조준한 적의 Q·E 스킬을 10초간 빼앗아 내가 쓴다 (그동안 상대는 스킬 봉인)', cd: 25 },
  },
  {
    id: 'biker', name: '바이커', title: '사슬의 폭주족', rarity: 'legendary', price: 0,
    color: '#2b2f38', accent: '#ff4a2a',
    desc: '쇠사슬과 자전거 하나로 협곡을 누비는 폭주족. 붙잡고, 들이받는다.',
    q: { name: '체인', desc: '조준한 방향으로 쇠사슬을 던져 맞은 적을 2.5초간 묶는다 (이동 불가)', cd: 12 },
    e: { name: '자전거', desc: '10초간 자전거를 탄다 — 이동속도 1.7배, 사격 불가, 부딪힐 때마다 50 피해 (E로 일찍 내리기)', cd: 22 },
  },
  {
    id: 'chaos', name: '카오스', title: '시간의 마술사', rarity: 'mythic', price: 0, shopOnly: true,
    color: '#3a2a7a', accent: '#ffcf5a',
    desc: '흐르는 시간을 비트는 마술사. 실수는 되돌리고, 적의 시간은 멈춰 세운다.',
    q: { name: '되감기', desc: '3초 전의 위치와 체력으로 돌아간다 (체력은 그때가 더 많을 때만)', cd: 14 },
    e: { name: '시간 정지 구역', desc: '조준한 곳에 5초간 시계 결계 — 안의 적은 이동속도 절반 · 연사/재장전 느려짐', cd: 20 },
  },
];

/** character prices are set by rarity (rookie is free) */
const RARITY_PRICE = { common: 0, rare: 2500, epic: 5000, legendary: 10000, mythic: 15000, infinity: 30000 };
for (const c of CHARACTERS) if (c.id !== 'rookie') c.price = RARITY_PRICE[c.rarity];

/** shop "신규 캐릭터!" early access: Chaos until the end of 30 November (local time), 15000 → 14000 + 500 coins back */
export const EARLY = { char: 'chaos', price: 14000, was: 15000, bonus: 500, until: new Date(2026, 11, 1, 0, 0, 0).getTime() };
export const earlyOn = () => Date.now() < EARLY.until;

export const getCharacter =(id) => CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
