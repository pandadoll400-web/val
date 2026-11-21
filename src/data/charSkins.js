/*
 * Character skins (Christmas set). One per character, id `xmas_<charId>`; `look` picks the outfit
 * recipe in game/soldier.js, `sleeve` is the first-person sleeve colour.
 */
const L = (char, name, look, sleeve) => ({ id: `xmas_${char}`, char, name, look, sleeve, set: 'xmas' });

export const CHAR_SKINS = [
  L('rookie', '산타 루키', 'santa', '#c8202a'),
  L('frost', '루돌프 프로스트', 'reindeer', '#7a4a2a'),
  L('blaze', '진저브레드 블레이즈', 'gingerbread', '#a8632e'),
  L('nitro', '엘프 니트로', 'elf', '#2a9a44'),
  L('shadow', '호두까기 섀도우', 'nutcracker', '#b0182a'),
  L('ghost', '천사 고스트', 'angel', '#f4f2ea'),
  L('volt', '선물상자 볼트', 'present', '#2a6ad8'),
  L('echo', '캔디케인 에코', 'candy', '#f2f2f2'),
  L('inker', '스웨터 잉커', 'sweater', '#b8202e'),
  L('titan', '눈사람 타이탄', 'snowman', '#f4f8ff'),
  L('glitch', '크람푸스 글리치', 'krampus', '#2a2226'),
  L('inferno', '별의 군주 인페르노', 'star', '#d8a42a'),
  L('bloom', '트리 정원사 블룸', 'tree', '#1f7a36'),
  L('crick', '방울 사냥꾼 크릭', 'bells', '#1f6a3a'),
  L('biker', '썰매꾼 바이커', 'sleigh', '#8a1a22'),
  // v2.1 Persepolis season bundle (hack account only for now)
  { id: 'perse_volt', char: 'volt', name: '경찰관 볼트', look: 'police', sleeve: '#1a2a4a', set: 'perse', hackOnly: true },
];

export const getCharSkin = (id) => CHAR_SKINS.find((s) => s.id === id) || null;
export const skinOfChar = (charId) => CHAR_SKINS.find((s) => s.char === charId) || null;
export const isXmasSkin = (id) => !!id && id.startsWith('xmas_');
