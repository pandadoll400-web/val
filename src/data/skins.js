import * as THREE from 'three';

/* ---------- procedural pattern textures ---------- */
function tex(draw, repeat = 2, srgb = true) {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  draw(c.getContext('2d'), S);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let T = null;
function textures() {
  if (T) return T;
  T = {
    // teal → blue → violet sheen with star dust
    aurora: tex((g, S) => {
      const grd = g.createLinearGradient(0, 0, S, S);
      grd.addColorStop(0, '#2fe6c8'); grd.addColorStop(0.35, '#2a7bff'); grd.addColorStop(0.7, '#7a3cff'); grd.addColorStop(1, '#2fe6c8');
      g.fillStyle = grd; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 5; i++) { // soft aurora bands
        g.strokeStyle = `rgba(180,255,240,${0.12 + Math.random() * 0.1})`; g.lineWidth = 6 + Math.random() * 10;
        g.beginPath(); g.moveTo(0, Math.random() * S);
        for (let x = 0; x <= S; x += 32) g.lineTo(x, (Math.sin(x * 0.03 + i) * 0.5 + 0.5) * S);
        g.stroke();
      }
      for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${0.4 + Math.random() * 0.6})`; g.fillRect(Math.random() * S, Math.random() * S, 1.5, 1.5); }
    }),
    stars: tex((g, S) => {
      g.fillStyle = '#0d1230'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 220; i++) { g.fillStyle = `rgba(${150 + Math.random() * 100},${200 + Math.random() * 55},255,${Math.random()})`; g.fillRect(Math.random() * S, Math.random() * S, 1.5, 1.5); }
    }, 3),
    // cracked lava (emissive)
    lava: tex((g, S) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
      g.lineCap = 'round';
      for (let i = 0; i < 22; i++) {
        let x = Math.random() * S, y = Math.random() * S;
        g.strokeStyle = i % 3 ? '#ff5a14' : '#ffc040'; g.lineWidth = 1 + Math.random() * 2.5;
        g.shadowColor = '#ff6a00'; g.shadowBlur = 6;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; g.lineTo(x, y); }
        g.stroke();
      }
    }, 2),
    // neon circuit lines (emissive)
    circuit: tex((g, S) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 26; i++) {
        g.strokeStyle = i % 2 ? '#ff2bd6' : '#3ff6ff'; g.lineWidth = 2;
        g.shadowColor = g.strokeStyle; g.shadowBlur = 5;
        let x = Math.round(Math.random() * 16) * 16, y = Math.round(Math.random() * 16) * 16;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 4; k++) { if (k % 2) x += (Math.random() < 0.5 ? -1 : 1) * 48; else y += (Math.random() < 0.5 ? -1 : 1) * 48; g.lineTo(x, y); }
        g.stroke();
        g.fillStyle = g.strokeStyle; g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
      }
    }, 2),
    // red / white candy stripes with a thin green line
    candy: tex((g, S) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
      g.fillStyle = '#d81e2a';
      for (let i = -S; i < S * 2; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 28, 0); g.lineTo(i + 28 - S, S); g.lineTo(i - S, S); g.fill(); }
      g.fillStyle = '#2aa04a';
      for (let i = -S + 38; i < S * 2; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 8, 0); g.lineTo(i + 8 - S, S); g.lineTo(i - S, S); g.fill(); }
    }, 3),
  };
  return T;
}

const M = (o) => new THREE.MeshStandardMaterial(o);

/* ---------- bundles ---------- */
export const BUNDLES = [
  {
    id: 'aurora', name: '오로라 보레알리스', rarity: 'legendary', price: 1800,
    tagline: '극지의 밤하늘을 그대로 녹여낸 무지개빛 금속',
    desc: '청록에서 보라로 흐르는 오로라 도장과 별가루 그립, 시안빛 발광 라인. 처치하면 그 자리에 오로라 빛기둥이 솟아오릅니다.',
    killFx: '오로라 빛기둥', weapons: ['rifle', 'sniper', 'knife'],
  },
  {
    id: 'inferno', name: '인페르노 드래곤', rarity: 'mythic', price: 2400,
    tagline: '용의 숨결로 벼려낸 흑철과 황금',
    desc: '갈라진 틈 사이로 용암이 끓어오르는 흑철 바디에 황금 장식. 처치하면 그 자리에 꺼지지 않는 용의 불꽃 문양이 새겨집니다.',
    killFx: '용의 불꽃 문양', weapons: ['pistol', 'shotgun', 'dmr'],
  },
  {
    id: 'cyber', name: '네온 사이버펑크', rarity: 'epic', price: 3000,
    tagline: '2099년 네오서울 뒷골목의 네온사인',
    desc: '무광 화이트 위로 핫핑크·시안 회로가 흐르는 미래 도장. 처치하면 그 자리에 글리치 홀로그램 큐브가 떠오릅니다.',
    killFx: '글리치 홀로그램', weapons: ['smg', 'bow', 'rifle'],
  },
  {
    id: 'xmas', name: '🎄 홀리 나이트', rarity: 'infinity', price: 0, soon: true, randomCharSkin: true,
    tagline: '눈 내리는 협곡의 크리스마스 이브',
    desc: '사탕지팡이 총열·리본·장식 방울이 달린 무기 4종과, 캐릭터 크리스마스 스킨 중 랜덤 1개(산타·루돌프·눈사람·엘프…). 처치하면 그 자리에서 선물 상자가 터지며 눈이 내립니다.',
    killFx: '선물 상자 눈보라', weapons: ['rifle', 'pistol', 'knife', 'flamer'],
  },
];

export const skinId = (bundle, weapon) => `${bundle}_${weapon}`;
export const getBundle = (id) => BUNDLES.find((b) => b.id === id);
export const skinBundle = (sid) => (sid ? getBundle(sid.split('_')[0]) : null);
/** skins available for a weapon: [{ id, bundle }] */
export const skinsForWeapon = (weapon) => BUNDLES.filter((b) => b.weapons.includes(weapon)).map((b) => ({ id: skinId(b.id, weapon), bundle: b }));

/* ---------- materials per bundle (created lazily, cached) ---------- */
const matCache = {};
export function skinMaterials(bundleId) {
  if (matCache[bundleId]) return matCache[bundleId];
  const t = textures();
  let m;
  if (bundleId === 'aurora') {
    m = {
      metal: M({ color: '#ffffff', map: t.aurora, metalness: 0.85, roughness: 0.22, emissive: '#1a3a8a', emissiveIntensity: 0.25 }),
      metal2: M({ color: '#3a5ab8', metalness: 0.85, roughness: 0.3 }),
      poly: M({ color: '#ffffff', map: t.stars, metalness: 0.2, roughness: 0.5 }),
      body: M({ color: '#ffffff', map: t.aurora, emissiveMap: t.aurora, emissive: '#ffffff', emissiveIntensity: 0.25, metalness: 0.6, roughness: 0.28 }),
      accent: M({ color: '#5ff7ff', emissive: '#3fe0ff', emissiveIntensity: 2.2 }),
      steel: M({ color: '#d9f6ff', metalness: 1, roughness: 0.1, emissive: '#3fe0ff', emissiveIntensity: 0.15 }),
      blade: M({ color: '#ffffff', map: t.aurora, metalness: 1, roughness: 0.12, emissive: '#2a6aff', emissiveIntensity: 0.3 }),
    };
  } else if (bundleId === 'inferno') {
    m = {
      metal: M({ color: '#141416', metalness: 0.85, roughness: 0.4, emissiveMap: t.lava, emissive: '#ffffff', emissiveIntensity: 1.3 }),
      metal2: M({ color: '#2a2422', metalness: 0.8, roughness: 0.45 }),
      poly: M({ color: '#1a1514', roughness: 0.75 }),
      body: M({ color: '#1e1412', roughness: 0.55, metalness: 0.4, emissiveMap: t.lava, emissive: '#ffffff', emissiveIntensity: 1.1 }),
      accent: M({ color: '#f0c060', metalness: 1, roughness: 0.22 }),
      steel: M({ color: '#f2c45a', metalness: 1, roughness: 0.2 }),
      blade: M({ color: '#1a1414', metalness: 0.9, roughness: 0.3, emissiveMap: t.lava, emissive: '#ffffff', emissiveIntensity: 1.4 }),
    };
  } else if (bundleId === 'xmas') {
    const candy = t.candy;
    m = {
      metal: M({ color: '#c0161f', metalness: 0.5, roughness: 0.3 }),
      metal2: M({ color: '#1f7a36', metalness: 0.4, roughness: 0.4 }),
      poly: M({ color: '#174a26', roughness: 0.6 }),
      body: M({ color: '#ffffff', map: candy, roughness: 0.35 }),
      accent: M({ color: '#ffd24a', metalness: 0.9, roughness: 0.25, emissive: '#5a3a00', emissiveIntensity: 0.3 }),
      steel: M({ color: '#ffe08a', metalness: 1, roughness: 0.2 }),
      blade: M({ color: '#ffffff', map: candy, metalness: 0.3, roughness: 0.25 }),
    };
  } else {
    m = {
      metal: M({ color: '#e8ecf2', metalness: 0.2, roughness: 0.5, emissiveMap: t.circuit, emissive: '#ffffff', emissiveIntensity: 1.5 }),
      metal2: M({ color: '#2a2f3a', metalness: 0.6, roughness: 0.4 }),
      poly: M({ color: '#1b1d24', roughness: 0.6 }),
      body: M({ color: '#f2f4f8', roughness: 0.45, emissiveMap: t.circuit, emissive: '#ffffff', emissiveIntensity: 1.3 }),
      accent: M({ color: '#ff2bd6', emissive: '#ff2bd6', emissiveIntensity: 2.2 }),
      steel: M({ color: '#3ff6ff', emissive: '#3ff6ff', emissiveIntensity: 1.2, metalness: 0.5, roughness: 0.3 }),
      blade: M({ color: '#e8ecf2', metalness: 0.5, roughness: 0.3, emissiveMap: t.circuit, emissive: '#ffffff', emissiveIntensity: 1.5 }),
    };
  }
  matCache[bundleId] = m;
  return m;
}
