import * as THREE from 'three';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r1, r2, h, s = 12) => new THREE.CylinderGeometry(r1, r2, h, s);

/**
 * Articulated low-poly soldier. Origin at the feet, facing -Z, ~1.9m tall.
 * style: 'rookie' | 'frost' | 'blaze' | 'shadow' | 'volt' | 'enemy'
 * joints: hips, torso, neck, shL, elL, shR, elR, legL, knL, legR, knR (+ handL/handR anchors)
 */
export function makeSoldier(color = '#4f7fa8', accent = '#9be8ff', style = 'enemy') {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.08 });
  const bodyDark = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.55), roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: '#23272e', roughness: 0.72, metalness: 0.2 });
  const plate = new THREE.MeshStandardMaterial({ color: '#d9e4ec', roughness: 0.42, metalness: 0.25 });
  const metal = new THREE.MeshStandardMaterial({ color: '#59626e', roughness: 0.35, metalness: 0.8 });
  const glow = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.6 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 });
  const skin = new THREE.MeshStandardMaterial({ color: '#e0b48f', roughness: 0.7 });
  const mats = [body, bodyDark, dark, plate, metal, glow, accentMat, skin];
  const hitParts = [];
  const add = (parent, geo, mat, x, y, z, part = 'body', rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.userData.part = part;
    parent.add(m);
    hitParts.push(m);
    return m;
  };
  const joint = (parent, x, y, z) => { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; };

  /* ---- lower body ---- */
  const hips = joint(g, 0, 0.98, 0);
  add(hips, box(0.42, 0.2, 0.26), dark, 0, 0, 0);
  add(hips, box(0.44, 0.06, 0.28), metal, 0, 0.07, 0);                 // belt
  add(hips, box(0.1, 0.09, 0.06), bodyDark, -0.13, 0.0, -0.15);         // pouches
  add(hips, box(0.1, 0.09, 0.06), bodyDark, 0.13, 0.0, -0.15);
  add(hips, box(0.08, 0.12, 0.08), bodyDark, 0.24, -0.04, 0.02);        // holster
  const legs = [], knees = [];
  for (const s of [-1, 1]) {
    const leg = joint(hips, s * 0.115, -0.06, 0);
    add(leg, box(0.18, 0.44, 0.21), body, 0, -0.21, 0);
    add(leg, box(0.08, 0.1, 0.05), bodyDark, s * 0.1, -0.2, 0);          // thigh pocket
    const knee = joint(leg, 0, -0.43, 0);
    add(knee, box(0.19, 0.1, 0.07), plate, 0, -0.01, -0.1);              // knee pad
    add(knee, box(0.16, 0.38, 0.18), body, 0, -0.2, 0);
    add(knee, box(0.18, 0.13, 0.3), dark, 0, -0.41, -0.04);              // boot
    add(knee, box(0.185, 0.04, 0.31), metal, 0, -0.47, -0.04);
    legs.push(leg); knees.push(knee);
  }

  /* ---- upper body ---- */
  const torso = joint(hips, 0, 0.08, 0);
  add(torso, box(0.4, 0.22, 0.24), body, 0, 0.12, 0);                   // abdomen
  add(torso, box(0.52, 0.38, 0.31), body, 0, 0.42, 0);                  // chest
  add(torso, box(0.46, 0.34, 0.08), plate, 0, 0.43, -0.17);             // chest plate
  add(torso, box(0.12, 0.08, 0.04), bodyDark, -0.13, 0.33, -0.22);       // mag pouches
  add(torso, box(0.12, 0.08, 0.04), bodyDark, 0.0, 0.33, -0.22);
  add(torso, box(0.12, 0.08, 0.04), bodyDark, 0.13, 0.33, -0.22);
  add(torso, box(0.5, 0.04, 0.32), glow, 0, 0.23, 0);                   // glow strip
  add(torso, box(0.24, 0.07, 0.24), dark, 0, 0.64, 0);                  // collar
  add(torso, box(0.08, 0.02, 0.02), glow, -0.15, 0.55, -0.215);          // badge light

  // neck + head
  const neck = joint(torso, 0, 0.68, 0);
  add(neck, box(0.12, 0.08, 0.12), dark, 0, 0.03, 0);
  const head = joint(neck, 0, 0.08, 0);
  const headParts = [];
  const hadd = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = add(head, geo, mat, x, y, z, 'head', rx, ry, rz); headParts.push(m); return m; };
  hadd(box(0.26, 0.26, 0.27), skin, 0, 0.13, 0);                         // face/head base

  // arms
  const arm = (s) => {
    const sh = joint(torso, s * 0.33, 0.56, 0);
    add(sh, box(0.18, 0.15, 0.2), plate, 0, 0.01, 0);                      // shoulder pad
    add(sh, box(0.13, 0.3, 0.14), body, 0, -0.16, 0);
    const el = joint(sh, 0, -0.31, 0);
    add(el, box(0.125, 0.27, 0.13), bodyDark, 0, -0.13, 0);
    add(el, box(0.135, 0.08, 0.14), plate, 0, -0.05, 0);                  // forearm guard
    const hand = joint(el, 0, -0.29, 0);
    add(hand, box(0.1, 0.11, 0.1), dark, 0, -0.02, 0);
    return { sh, el, hand };
  };
  const L = arm(-1), R = arm(1);

  /* ---- style accessories ---- */
  const helmet = () => {
    hadd(box(0.32, 0.17, 0.33), body, 0, 0.24, 0.005);
    hadd(box(0.34, 0.05, 0.35), plate, 0, 0.3, 0.005);
    hadd(box(0.33, 0.12, 0.06), body, 0, 0.18, 0.15);                     // back
  };
  if (style === 'rookie') {
    helmet();
    hadd(box(0.34, 0.03, 0.08), accentMat, 0, 0.24, -0.16);                // stripe
    hadd(box(0.28, 0.07, 0.06), dark, 0, 0.335, -0.09);                    // goggles on helmet
    hadd(box(0.1, 0.05, 0.02), glow, -0.065, 0.335, -0.122);
    hadd(box(0.1, 0.05, 0.02), glow, 0.065, 0.335, -0.122);
    hadd(box(0.05, 0.02, 0.01), dark, -0.06, 0.15, -0.137);                // eyes
    hadd(box(0.05, 0.02, 0.01), dark, 0.06, 0.15, -0.137);
    hadd(box(0.08, 0.015, 0.01), dark, 0, 0.07, -0.137, 0, 0, 0.08);       // smirk
    add(torso, box(0.34, 0.1, 0.34), accentMat, 0, 0.66, 0);               // scarf
    add(torso, box(0.1, 0.28, 0.04), accentMat, 0.1, 0.5, 0.18, 'body', 0.2, 0, 0.1);
  } else if (style === 'frost') {
    hadd(box(0.36, 0.34, 0.36), body, 0, 0.16, 0.02);                      // hood
    hadd(box(0.38, 0.08, 0.1), plate, 0, 0.0, -0.13);                      // fur trim
    hadd(box(0.24, 0.07, 0.02), glow, 0, 0.15, -0.165);                    // visor
    hadd(box(0.2, 0.08, 0.02), plate, 0, 0.06, -0.17);                     // mask
    for (const s of [-1, 1]) {
      const sh = s < 0 ? L.sh : R.sh;
      for (let i = 0; i < 3; i++) add(sh, cyl(0, 0.04, 0.22, 6), glow, s * 0.04 + s * i * 0.03, 0.14, -0.04 + i * 0.05, 'body', 0, 0, -s * (0.3 + i * 0.2));
    }
    add(torso, box(0.5, 0.5, 0.06), plate, 0, 0.0, 0.2, 'body', -0.1, 0, 0); // coat tail
  } else if (style === 'blaze') {
    helmet();
    hadd(box(0.22, 0.12, 0.06), dark, 0, 0.09, -0.15);                     // gas mask
    for (const s of [-1, 1]) hadd(cyl(0.045, 0.045, 0.07, 10), metal, s * 0.1, 0.06, -0.18, Math.PI / 2, 0, s * 0.5);
    hadd(box(0.09, 0.04, 0.02), glow, -0.06, 0.16, -0.175);
    hadd(box(0.09, 0.04, 0.02), glow, 0.06, 0.16, -0.175);
    for (const s of [-1, 1]) {
      add(torso, cyl(0.07, 0.07, 0.42, 12), accentMat, s * 0.11, 0.4, 0.25); // fuel tanks
      add(torso, cyl(0.035, 0.035, 0.05, 10), metal, s * 0.11, 0.64, 0.25);
    }
    add(torso, box(0.3, 0.06, 0.1), metal, 0, 0.4, 0.25);
  } else if (style === 'shadow') {
    hadd(box(0.36, 0.36, 0.36), body, 0, 0.17, 0.03);                      // hood
    hadd(box(0.28, 0.3, 0.02), dark, 0, 0.12, -0.155);                     // dark face
    hadd(box(0.08, 0.025, 0.01), glow, -0.06, 0.16, -0.168, 0, 0, -0.15);  // eye slits
    hadd(box(0.08, 0.025, 0.01), glow, 0.06, 0.16, -0.168, 0, 0, 0.15);
    add(torso, box(0.36, 0.12, 0.34), bodyDark, 0, 0.66, 0);              // scarf
    for (const s of [-1, 1]) add(torso, box(0.1, 0.55, 0.02), bodyDark, s * 0.08, 0.4, 0.2, 'body', 0.35, 0, s * 0.1);
    for (const s of [-1, 1]) add(hips, box(0.2, 0.5, 0.04), body, s * 0.12, -0.28, 0.15, 'body', -0.05); // coat flaps
  } else if (style === 'volt') {
    helmet();
    hadd(box(0.3, 0.1, 0.03), glow, 0, 0.16, -0.155);                      // big visor
    hadd(cyl(0.01, 0.01, 0.22, 6), metal, 0.13, 0.42, 0.06);               // antenna
    hadd(new THREE.SphereGeometry(0.025, 8, 6), glow, 0.13, 0.54, 0.06);
    for (const s of [-1, 1]) {
      const sh = s < 0 ? L.sh : R.sh;
      add(sh, new THREE.TorusGeometry(0.08, 0.02, 6, 16), glow, 0, 0.1, 0, 'body', Math.PI / 2);
    }
    add(torso, box(0.06, 0.3, 0.02), glow, 0, 0.45, -0.215, 'body', 0, 0, 0.4); // bolt emblem
    add(torso, box(0.3, 0.35, 0.14), metal, 0, 0.42, 0.22);                 // battery pack
    add(torso, box(0.2, 0.05, 0.02), glow, 0, 0.5, 0.295);
  } else if (style === 'nitro') {
    // racing helmet with a wide visor + jet booster on the back
    hadd(new THREE.SphereGeometry(0.2, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), body, 0, 0.17, 0.01);
    hadd(box(0.3, 0.08, 0.04), glow, 0, 0.16, -0.16);                       // visor
    hadd(box(0.05, 0.22, 0.36), accentMat, 0, 0.27, 0.01);                  // racing stripe
    hadd(box(0.2, 0.06, 0.03), dark, 0, 0.05, -0.15);                       // chin guard
    add(torso, box(0.34, 0.36, 0.16), metal, 0, 0.42, 0.24);                // booster pack
    for (const s of [-1, 1]) {
      add(torso, cyl(0.06, 0.08, 0.26, 10), dark, s * 0.11, 0.24, 0.27);    // nozzles
      add(torso, cyl(0.05, 0.0, 0.18, 8), glow, s * 0.11, 0.06, 0.27, 'body', Math.PI);   // flames
    }
    for (const s of [-1, 1]) add(s < 0 ? L.sh : R.sh, box(0.05, 0.05, 0.2), accentMat, 0, 0.09, 0); // shoulder flame stripes
  } else if (style === 'ghost') {
    // pale hooded cloak, blank mask with hollow eyes, wisps
    hadd(box(0.38, 0.4, 0.38), body, 0, 0.17, 0.03);                        // deep hood
    hadd(box(0.26, 0.28, 0.03), plate, 0, 0.12, -0.16);                     // white mask
    hadd(box(0.06, 0.07, 0.01), dark, -0.06, 0.16, -0.177);                 // hollow eyes
    hadd(box(0.06, 0.07, 0.01), dark, 0.06, 0.16, -0.177);
    hadd(box(0.04, 0.03, 0.01), glow, -0.06, 0.155, -0.18);
    hadd(box(0.04, 0.03, 0.01), glow, 0.06, 0.155, -0.18);
    add(torso, box(0.6, 0.85, 0.06), body, 0, 0.18, 0.2, 'body', 0.08);     // long cloak
    for (const s of [-1, 1]) add(hips, box(0.24, 0.55, 0.04), body, s * 0.13, -0.3, -0.15, 'body', 0.06); // robe front
    for (let i = 0; i < 3; i++) add(torso, new THREE.SphereGeometry(0.04, 8, 6), glow, (i - 1) * 0.22, 0.85 + (i % 2) * 0.1, 0.1); // wisps
  } else if (style === 'echo') {
    // big headphones, conductor coat, speaker on the back
    helmet();
    for (const s of [-1, 1]) {
      hadd(cyl(0.09, 0.09, 0.07, 14), dark, s * 0.17, 0.16, 0, 0, 0, Math.PI / 2);
      hadd(cyl(0.06, 0.06, 0.075, 14), glow, s * 0.19, 0.16, 0, 0, 0, Math.PI / 2);
    }
    hadd(new THREE.TorusGeometry(0.18, 0.02, 6, 18, Math.PI), accentMat, 0, 0.18, 0);   // headband
    hadd(box(0.26, 0.06, 0.02), glow, 0, 0.15, -0.155);                     // visor
    add(torso, cyl(0.15, 0.15, 0.1, 18), dark, 0, 0.42, 0.22, 'body', Math.PI / 2);     // speaker
    add(torso, cyl(0.1, 0.1, 0.11, 18), glow, 0, 0.42, 0.23, 'body', Math.PI / 2);
    for (const s of [-1, 1]) add(hips, box(0.2, 0.42, 0.04), accentMat, s * 0.12, -0.24, 0.15, 'body', -0.08); // tailcoat
  } else if (style === 'glitch') {
    // hacker hoodie with a pixel-grid visor and floating data cubes
    hadd(box(0.36, 0.35, 0.36), body, 0, 0.17, 0.03);                       // hood
    hadd(box(0.28, 0.12, 0.02), dark, 0, 0.15, -0.16);
    for (let i = 0; i < 6; i++) hadd(box(0.03, 0.03, 0.01), glow, -0.1 + i * 0.04, 0.15 + (i % 2) * 0.03, -0.172); // pixel eyes
    hadd(box(0.22, 0.1, 0.02), dark, 0, 0.05, -0.16);                       // face mask
    for (const [x, y, z] of [[-0.42, 0.75, 0.05], [0.44, 0.82, -0.02], [0.38, 0.55, 0.18]])
      add(torso, box(0.07, 0.07, 0.07), glow, x, y, z, 'body', 0.6, 0.7, 0);   // floating cubes
    add(torso, box(0.06, 0.4, 0.06), accentMat, -0.12, 0.42, 0.18, 'body', 0, 0, 0.3); // cables
    add(torso, box(0.06, 0.4, 0.06), accentMat, 0.12, 0.42, 0.18, 'body', 0, 0, -0.3);
  } else if (style === 'inker') {
    // beret, painter's apron with splats, giant brush on the back
    hadd(box(0.26, 0.26, 0.27), skin, 0, 0.13, 0);
    hadd(cyl(0.19, 0.2, 0.06, 16), body, 0.03, 0.3, 0.01, 0, 0, -0.18);      // beret
    hadd(cyl(0.015, 0.015, 0.05, 6), dark, 0.03, 0.35, 0.01);
    hadd(box(0.05, 0.02, 0.01), dark, -0.06, 0.15, -0.137);
    hadd(box(0.05, 0.02, 0.01), dark, 0.06, 0.15, -0.137);
    hadd(box(0.1, 0.03, 0.01), accentMat, 0.05, 0.1, -0.138);                // ink smudge
    add(torso, box(0.42, 0.5, 0.03), plate, 0, 0.3, -0.19);                 // apron
    for (const [x, y] of [[-0.1, 0.4], [0.08, 0.25], [0.12, 0.45]]) add(torso, box(0.08, 0.07, 0.01), accentMat, x, y, -0.207); // splats
    add(torso, cyl(0.025, 0.025, 0.85, 8), metal, 0.05, 0.45, 0.22, 'body', 0, 0, 0.5);   // brush handle
    add(torso, cyl(0.06, 0.02, 0.18, 10), accentMat, 0.27, 0.82, 0.22, 'body', 0, 0, 0.5); // brush tip
  } else if (style === 'inferno') {
    // horned crown, flaming shoulders (fire left / water right) and a long cape
    helmet();
    for (const s of [-1, 1]) hadd(cyl(0, 0.04, 0.2, 8), dark, s * 0.14, 0.38, 0, 0, 0, -s * 0.5);  // horns
    hadd(box(0.3, 0.06, 0.03), glow, 0, 0.15, -0.16);
    add(L.sh, cyl(0.0, 0.11, 0.26, 8), glow, 0, 0.2, 0);                    // fire on the left shoulder
    const water = new THREE.MeshStandardMaterial({ color: '#4fd8ff', emissive: '#1f8fe0', emissiveIntensity: 1.2, transparent: true, opacity: 0.85 });
    mats.push(water);
    add(R.sh, new THREE.SphereGeometry(0.1, 12, 10), water, 0, 0.18, 0);    // water orb on the right
    add(torso, box(0.62, 1.0, 0.04), accentMat, 0, 0.12, 0.21, 'body', 0.1); // cape
    add(torso, box(0.62, 0.06, 0.06), glow, 0, 0.63, 0.2);                   // cape clasp
  } else if (style === 'titan') {
    // horned stone helmet, huge rock pauldrons, armour plates
    hadd(box(0.36, 0.22, 0.36), plate, 0, 0.22, 0.01);
    hadd(box(0.3, 0.05, 0.02), glow, 0, 0.16, -0.18);
    for (const s of [-1, 1]) hadd(cyl(0.02, 0.06, 0.24, 6), plate, s * 0.2, 0.36, 0, 0, 0, -s * 0.9);  // horns
    for (const s of [-1, 1]) {
      const sh = s < 0 ? L.sh : R.sh;
      add(sh, new THREE.DodecahedronGeometry(0.17, 0), plate, s * 0.03, 0.07, 0);  // rock pauldron
      add(sh, box(0.02, 0.16, 0.02), glow, s * 0.12, 0.04, -0.12);              // lava crack
    }
    add(torso, box(0.56, 0.42, 0.1), plate, 0, 0.42, -0.19);                // heavy chest plate
    add(torso, box(0.04, 0.3, 0.01), glow, 0, 0.42, -0.245, 'body', 0, 0, 0.3); // crack
    add(torso, box(0.5, 0.45, 0.12), plate, 0, 0.42, 0.22);                  // back plate

  } else {
    helmet();
    hadd(box(0.28, 0.09, 0.03), glow, 0, 0.15, -0.15);                     // visor
    hadd(box(0.2, 0.08, 0.02), dark, 0, 0.06, -0.14);
  }

  /* ---- rifle (enemy / default hold) ---- */
  const gun = new THREE.Group();
  gun.position.set(0.1, 0.38, -0.42);
  torso.add(gun);
  const gm = new THREE.Mesh(box(0.07, 0.11, 0.6), dark);
  const gs = new THREE.Mesh(box(0.05, 0.08, 0.2), dark); gs.position.set(0, -0.02, 0.36);
  const gb = new THREE.Mesh(cyl(0.018, 0.018, 0.3, 8).rotateX(Math.PI / 2), metal); gb.position.set(0, 0.02, -0.44);
  const gmag = new THREE.Mesh(box(0.04, 0.14, 0.06), metal); gmag.position.set(0, -0.11, -0.08); gmag.rotation.x = 0.2;
  const gsight = new THREE.Mesh(box(0.04, 0.05, 0.1), glow); gsight.position.set(0, 0.08, 0);
  gun.add(gm, gs, gb, gmag, gsight);
  gm.castShadow = true;
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.02, -0.6);
  gun.add(muzzle);

  // silhouettes: Titan is bulky, Ghost and Glitch are lanky
  const SHAPE = { titan: [1.18, 1.08], ghost: [0.92, 1.04], glitch: [0.94, 1.02], inferno: [1.05, 1.06], nitro: [1, 0.98] }[style];
  if (SHAPE) { torso.scale.set(SHAPE[0], SHAPE[1], SHAPE[0]); for (const l of legs) l.scale.set(SHAPE[0], SHAPE[1], SHAPE[0]); }
  const joints = { hips, torso, neck, head, shL: L.sh, elL: L.el, shR: R.sh, elR: R.el, legL: legs[0], knL: knees[0], legR: legs[1], knR: knees[1], handL: L.hand, handR: R.hand };
  const model = {
    group: g, head, helmet: headParts[0], hitParts, legs, knees, arms: [L.sh, R.sh], gun, muzzle, joints,
    materials: { body, glow }, allMaterials: mats,
  };
  setPose(model, AIM_POSE);
  return model;
}

/* ---------------- poses ---------------- */
// Each entry: [rx, ry, rz]. Arm +rx raises it forward; left arm outward = -rz, right arm outward = +rz.
export const IDLE_POSE = {
  torso: [0, 0, 0], neck: [0, 0, 0], shL: [0.05, 0, -0.1], elL: [0.25, 0, 0], shR: [0.05, 0, 0.1], elR: [0.25, 0, 0],
  legL: [0, 0, 0], knL: [0, 0, 0], legR: [0, 0, 0], knR: [0, 0, 0], hipY: 0,
};
export const AIM_POSE = {
  ...IDLE_POSE,
  shR: [1.2, 0, 0.05], elR: [0.35, 0, 0], shL: [1.35, 0.55, 0], elL: [0.25, 0, 0],
};
const JOINT_KEYS = ['torso', 'neck', 'shL', 'elL', 'shR', 'elR', 'legL', 'knL', 'legR', 'knR'];

export function setPose(model, pose) {
  const j = model.joints;
  for (const k of JOINT_KEYS) if (pose[k]) j[k].rotation.set(pose[k][0], pose[k][1], pose[k][2]);
  j.hips.position.y = 0.98 + (pose.hipY || 0);
}

const smooth = (t) => t * t * (3 - 2 * t);
/** Blend two poses (missing joints fall back to IDLE). */
export function blendPose(a, b, t) {
  const u = smooth(Math.min(1, Math.max(0, t)));
  const out = {};
  for (const k of JOINT_KEYS) {
    const pa = a[k] || IDLE_POSE[k], pb = b[k] || IDLE_POSE[k];
    out[k] = [pa[0] + (pb[0] - pa[0]) * u, pa[1] + (pb[1] - pa[1]) * u, pa[2] + (pb[2] - pa[2]) * u];
  }
  out.hipY = (a.hipY || 0) + ((b.hipY || 0) - (a.hipY || 0)) * u;
  return out;
}
