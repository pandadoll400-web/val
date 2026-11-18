import * as THREE from 'three';
import { getCharSkin } from '../data/charSkins.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r1, r2, h, s = 12) => new THREE.CylinderGeometry(r1, r2, h, s);

/**
 * Articulated low-poly soldier. Origin at the feet, facing -Z, ~1.9m tall.
 * style: 'rookie' | 'frost' | 'blaze' | 'shadow' | 'volt' | 'enemy'
 * joints: hips, torso, neck, shL, elL, shR, elR, legL, knL, legR, knR (+ handL/handR anchors)
 */
export function makeSoldier(color = '#4f7fa8', accent = '#9be8ff', style = 'enemy', outfit = null) {
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
  } else if (style === 'bloom') {
    // flower crown, leaf cape, vine on the back, glowing pollen
    hadd(box(0.27, 0.1, 0.28), body, 0, 0.27, 0.005);                         // leafy hair
    const petal = new THREE.MeshStandardMaterial({ color: '#ff8fd0', emissive: '#ff4fa8', emissiveIntensity: 0.4, roughness: 0.6 });
    const centre = new THREE.MeshStandardMaterial({ color: '#ffe066', emissive: '#ffb000', emissiveIntensity: 0.6 });
    mats.push(petal, centre);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      hadd(new THREE.SphereGeometry(0.045, 8, 6), petal, Math.cos(a) * 0.15, 0.31, Math.sin(a) * 0.15);
      hadd(new THREE.SphereGeometry(0.02, 6, 5), centre, Math.cos(a) * 0.15, 0.335, Math.sin(a) * 0.15);
    }
    hadd(box(0.05, 0.03, 0.01), glow, -0.06, 0.15, -0.137);
    hadd(box(0.05, 0.03, 0.01), glow, 0.06, 0.15, -0.137);
    for (let i = 0; i < 5; i++) add(torso, box(0.16, 0.36, 0.02), accentMat, -0.24 + i * 0.12, 0.2 - Math.abs(i - 2) * 0.05, 0.21, 'body', 0.12, 0, (i - 2) * 0.12); // leaf cape
    add(torso, cyl(0.025, 0.025, 0.7, 6), body, 0.12, 0.35, 0.22, 'body', 0, 0, -0.4);   // vine
    for (const [x, y] of [[0.02, 0.15], [0.18, 0.45], [0.26, 0.62]]) add(torso, new THREE.SphereGeometry(0.05, 8, 6), petal, x, y, 0.25);
    add(R.hand, new THREE.SphereGeometry(0.035, 8, 6), glow, 0, -0.09, 0);       // pollen in the palm
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

  } else if (style === 'crick') {
    // hunter's hood with a glowing eye slit, a stolen-power orb on the belt and a crystal on the right hand
    hadd(box(0.34, 0.24, 0.35), body, 0, 0.21, 0.015);                        // hood
    hadd(box(0.36, 0.06, 0.12), body, 0, 0.32, -0.12, 0.4);                   // hood brim
    hadd(box(0.26, 0.03, 0.02), glow, 0, 0.16, -0.168);                       // eye slit
    add(torso, box(0.5, 0.06, 0.32), dark, 0, 0.02, 0);                       // belt
    add(torso, new THREE.SphereGeometry(0.06, 12, 10), glow, 0.18, 0.02, -0.17);
    add(R.hand, new THREE.OctahedronGeometry(0.05, 0), glow, 0, -0.1, 0);
    add(torso, box(0.56, 0.7, 0.03), accentMat, 0, 0.25, 0.2, 'body', 0.06);  // short cloak
  } else if (style === 'biker') {
    // full-face moto helmet, leather jacket with studs, chain over the shoulder
    hadd(box(0.34, 0.3, 0.35), dark, 0, 0.2, 0.005);                          // helmet shell
    hadd(box(0.3, 0.1, 0.03), glow, 0, 0.2, -0.17);                           // visor
    hadd(box(0.36, 0.04, 0.36), accentMat, 0, 0.3, 0.005);                    // stripe
    const steel = new THREE.MeshStandardMaterial({ color: '#b9c0c8', metalness: 1, roughness: 0.3 });
    mats.push(steel);
    for (let i = 0; i < 7; i++) add(torso, new THREE.TorusGeometry(0.035, 0.012, 5, 8), steel, -0.22 + i * 0.075, 0.62 - i * 0.07, -0.18, 'body', 0, 0, 0.8);
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) add(torso, new THREE.SphereGeometry(0.018, 6, 5), steel, sx * 0.15, 0.55 - i * 0.12, -0.19);
    add(torso, box(0.52, 0.12, 0.36), accentMat, 0, 0.66, 0);                 // collar
  } else {
    helmet();
    hadd(box(0.28, 0.09, 0.03), glow, 0, 0.15, -0.15);                     // visor
    hadd(box(0.2, 0.08, 0.02), dark, 0, 0.06, -0.14);
  }

  /* ---- outfits (character skins, see data/charSkins.js) ---- */
  const look = outfit === 'xmas' ? 'santa' : getCharSkin(outfit)?.look;
  if (look) {
    const O = { body, bodyDark, dark, plate, metal, glow, accentMat, skin, mats, add, hadd, hips, torso, head, arms: [L, R], legs, knees };
    O.M = (color, o = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o }); mats.push(m); return m; };
    LOOKS[look]?.(O);
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
  const SHAPE = { bloom: [0.97, 1.01], titan: [1.18, 1.08], ghost: [0.92, 1.04], glitch: [0.94, 1.02], inferno: [1.05, 1.06], nitro: [1, 0.98] }[style];
  if (SHAPE) { torso.scale.set(SHAPE[0], SHAPE[1], SHAPE[0]); for (const l of legs) l.scale.set(SHAPE[0], SHAPE[1], SHAPE[0]); }
  const joints = { hips, torso, neck, head, shL: L.sh, elL: L.el, shR: R.sh, elR: R.el, legL: legs[0], knL: knees[0], legR: legs[1], knR: knees[1], handL: L.hand, handR: R.hand };
  const model = {
    group: g, head, helmet: headParts[0], hitParts, legs, knees, arms: [L.sh, R.sh], gun, muzzle, joints,
    materials: { body, glow }, allMaterials: mats,
  };
  setPose(model, AIM_POSE);
  return model;
}

/* ---------------- Christmas outfit recipes ---------------- */
const sph = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
/** flat 5-point star (extruded), facing +z/-z */
export function starGeo(r = 0.1, depth = 0.03) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (i) s.lineTo(x, y); else s.moveTo(x, y);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.3, bevelSize: r * 0.05, bevelSegments: 1 });
  g.translate(0, 0, -depth / 2);
  return g;
}
const HAT_Y = 0.36; // top of the head (above most helmets)
function furTrim(O, fur) {
  const { add, hips, torso, arms, knees } = O;
  add(hips, box(0.47, 0.07, 0.31), fur, 0, -0.09, 0);
  for (const s of arms) add(s.el, box(0.15, 0.065, 0.155), fur, 0, -0.245, 0);
  for (const k of knees) add(k, box(0.2, 0.06, 0.22), fur, 0, -0.33, 0);
  add(torso, box(0.08, 0.52, 0.03), fur, 0, 0.38, -0.225);
}
function belt(O, col = '#141414', buckle = '#ffd24a') {
  const b = O.M(col, { roughness: 0.5 }), g = O.M(buckle, { metalness: 0.9, roughness: 0.25 });
  O.add(O.hips, box(0.455, 0.075, 0.295), b, 0, 0.07, 0);
  O.add(O.hips, box(0.1, 0.08, 0.02), g, 0, 0.07, -0.155);
}
function coneHat(O, color, trim, tip, { h = 0.36, tilt = 0.35, r = 0.175 } = {}) {
  const { hadd } = O;
  if (trim) hadd(new THREE.CylinderGeometry(r + 0.025, r + 0.025, 0.08, 16), trim, 0, HAT_Y, 0.02);
  hadd(new THREE.ConeGeometry(r, h, 16), color, 0, HAT_Y + h * 0.5, 0.02 + Math.sin(tilt) * h * 0.25, tilt);
  if (tip) hadd(sph(0.055), tip, 0, HAT_Y + h * 0.95, 0.02 + Math.sin(tilt) * h * 0.55);
}
const LOOKS = {
  santa(O) {
    O.body.color.set('#c8202a'); O.bodyDark.color.set('#7c1018');
    const fur = O.M('#f7f7f2', { roughness: 0.95 });
    furTrim(O, fur); belt(O);
    O.add(O.torso, box(0.38, 0.09, 0.36), O.M('#1f8a3a', { roughness: 0.8 }), 0, 0.62, 0);
    coneHat(O, O.body, fur, fur);
  },
  reindeer(O) {
    O.body.color.set('#7a4a2a'); O.bodyDark.color.set('#4a2a16');
    const antler = O.M('#d8b88a', { roughness: 0.8 }), tan = O.M('#d8b088', { roughness: 0.9 });
    O.add(O.torso, box(0.3, 0.3, 0.03), tan, 0, 0.36, -0.225);                         // light belly
    for (const s of [-1, 1]) {
      O.hadd(new THREE.CylinderGeometry(0.02, 0.028, 0.32, 6), antler, s * 0.1, HAT_Y + 0.12, 0.02, 0, 0, -s * 0.35);
      O.hadd(new THREE.CylinderGeometry(0.016, 0.02, 0.16, 6), antler, s * 0.2, HAT_Y + 0.2, 0.02, 0, 0, -s * 1.1);
      O.hadd(new THREE.CylinderGeometry(0.014, 0.018, 0.14, 6), antler, s * 0.14, HAT_Y + 0.3, 0.0, 0, 0, s * 0.3);
      O.hadd(new THREE.ConeGeometry(0.04, 0.1, 6), O.bodyDark, s * 0.16, HAT_Y - 0.05, 0.02, 0, 0, -s * 1.3); // ears
    }
    O.hadd(sph(0.045), O.M('#ff2a2a', { emissive: '#ff1010', emissiveIntensity: 1.6 }), 0, 0.1, -0.16);  // red nose
    const bell = O.M('#ffd24a', { metalness: 0.9, roughness: 0.2 });
    O.add(O.torso, box(0.36, 0.05, 0.34), O.M('#b0182a'), 0, 0.64, 0);
    O.add(O.torso, sph(0.04), bell, 0, 0.6, -0.18);
  },
  gingerbread(O) {
    O.body.color.set('#a8632e'); O.bodyDark.color.set('#7a4320'); O.skin.color.set('#b8723a');
    const icing = O.M('#ffffff', { roughness: 0.4 });
    for (const s of O.arms) for (let i = 0; i < 3; i++) O.add(s.el, box(0.14, 0.015, 0.145), icing, 0, -0.2 + i * 0.03, 0, 'body', 0, 0, (i % 2 ? 0.25 : -0.25));
    for (const k of O.knees) for (let i = 0; i < 3; i++) O.add(k, box(0.17, 0.015, 0.19), icing, 0, -0.3 + i * 0.03, 0, 'body', 0, 0, (i % 2 ? 0.25 : -0.25));
    ['#e0182a', '#2aa04a', '#ffd24a'].forEach((c, i) => O.add(O.torso, sph(0.035), O.M(c, { roughness: 0.3 }), 0, 0.52 - i * 0.12, -0.215));
    O.hadd(box(0.12, 0.012, 0.01), icing, 0, 0.065, -0.14);                                // icing smile
    for (const s of [-1, 1]) O.hadd(sph(0.022), icing, s * 0.06, 0.15, -0.14);
    O.hadd(new THREE.TorusGeometry(0.15, 0.015, 6, 24), icing, 0, HAT_Y - 0.02, 0.02, Math.PI / 2);
  },
  elf(O) {
    O.body.color.set('#2a9a44'); O.bodyDark.color.set('#1a6a2c');
    const red = O.M('#d81e2a'), white = O.M('#ffffff');
    for (let i = 0; i < 8; i++) O.add(O.torso, box(0.06, 0.08, 0.36), i % 2 ? red : white, -0.21 + i * 0.06, 0.64, 0); // striped collar
    belt(O);
    coneHat(O, O.body, red, O.M('#ffd24a', { metalness: 0.9, roughness: 0.2 }), { h: 0.5, tilt: 0.7, r: 0.16 });
    for (const s of [-1, 1]) O.hadd(new THREE.ConeGeometry(0.035, 0.13, 6), O.skin, s * 0.16, 0.18, 0.02, 0, 0, -s * 1.2); // pointy ears
    for (const k of O.knees) O.add(k, new THREE.ConeGeometry(0.06, 0.16, 6), O.M('#1a6a2c'), 0, -0.47, -0.22, -Math.PI / 2 - 0.4); // curly shoes
  },
  nutcracker(O) {
    O.body.color.set('#b0182a'); O.bodyDark.color.set('#1a2a6a');
    const gold = O.M('#ffd24a', { metalness: 0.9, roughness: 0.25 }), white = O.M('#f4f4f4'), black = O.M('#141414', { roughness: 0.4 });
    for (const s of O.arms) { O.add(s.sh, box(0.2, 0.04, 0.22), gold, 0, 0.1, 0); for (let i = 0; i < 4; i++) O.add(s.sh, box(0.012, 0.06, 0.012), gold, -0.08 + i * 0.05, 0.06, -0.1); }
    O.add(O.torso, box(0.07, 0.6, 0.02), white, 0, 0.4, -0.225, 'body', 0, 0, 0.6);
    O.add(O.torso, box(0.07, 0.6, 0.02), white, 0, 0.4, -0.226, 'body', 0, 0, -0.6);
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) O.add(O.torso, sph(0.018), gold, s * 0.09, 0.52 - i * 0.1, -0.23);
    O.hadd(new THREE.CylinderGeometry(0.16, 0.15, 0.34, 14), black, 0, HAT_Y + 0.15, 0.02);       // tall shako
    O.hadd(new THREE.CylinderGeometry(0.165, 0.165, 0.04, 14), gold, 0, HAT_Y, 0.02);
    O.hadd(starGeo(0.05, 0.02), gold, 0, HAT_Y + 0.16, -0.14);
    O.hadd(new THREE.ConeGeometry(0.04, 0.16, 8), O.M('#e0182a'), 0, HAT_Y + 0.4, 0.02);           // plume
    O.hadd(box(0.16, 0.035, 0.03), white, 0, 0.09, -0.15);                                      // moustache
    for (const k of O.knees) O.add(k, box(0.19, 0.2, 0.22), black, 0, -0.36, -0.01);
  },
  angel(O) {
    O.body.color.set('#f4f2ea'); O.bodyDark.color.set('#d8d2c0');
    const gold = O.M('#ffe27a', { emissive: '#ffcc33', emissiveIntensity: 1.6 }), wing = O.M('#ffffff', { roughness: 0.9, side: THREE.DoubleSide });
    O.hadd(new THREE.TorusGeometry(0.15, 0.018, 8, 28), gold, 0, HAT_Y + 0.12, 0.02, Math.PI / 2);
    for (const s of [-1, 1]) {
      const w = O.add(O.torso, new THREE.SphereGeometry(0.3, 10, 8).scale(0.25, 1, 0.6), wing, s * 0.24, 0.5, 0.22, 'body', 0.2, 0, s * 0.55);
      w.castShadow = false;
    }
    belt(O, '#ffe27a', '#ffffff');
  },
  present(O) {
    O.body.color.set('#2a6ad8'); O.bodyDark.color.set('#1a4aa8');
    const rib = O.M('#ffd24a', { metalness: 0.7, roughness: 0.3 });
    O.add(O.torso, box(0.08, 0.42, 0.33), rib, 0, 0.42, 0);
    O.add(O.torso, box(0.54, 0.08, 0.33), rib, 0, 0.42, 0);
    O.add(O.hips, box(0.44, 0.06, 0.28), rib, 0, -0.04, 0);
    for (const s of [-1, 1]) O.hadd(new THREE.TorusGeometry(0.09, 0.03, 8, 16), rib, s * 0.09, HAT_Y + 0.07, 0.02, 0, Math.PI / 2, s * 0.6);
    O.hadd(sph(0.04), rib, 0, HAT_Y + 0.03, 0.02);
    O.add(O.torso, box(0.1, 0.07, 0.01), O.M('#ffffff'), 0.16, 0.3, -0.2, 'body', 0, 0, 0.3);       // gift tag
  },
  candy(O) {
    O.body.color.set('#f4f4f4'); O.bodyDark.color.set('#d81e2a');
    const red = O.M('#d81e2a', { roughness: 0.35 });
    for (let i = 0; i < 5; i++) O.add(O.torso, box(0.56, 0.035, 0.33), red, 0, 0.26 + i * 0.08, 0, 'body', 0, 0, 0.35);
    for (const l of O.legs) for (let i = 0; i < 3; i++) O.add(l, box(0.19, 0.03, 0.22), red, 0, -0.08 - i * 0.12, 0, 'body', 0, 0, 0.35);
    const cane = new THREE.Group(); cane.position.set(0.12, 0.45, 0.2); O.torso.add(cane);
    O.add(cane, new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8), red, 0, 0, 0);
    O.add(cane, new THREE.TorusGeometry(0.08, 0.03, 8, 14, Math.PI), red, -0.08, 0.3, 0);
    O.hadd(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 14), red, 0.13, 0.25, -0.13, Math.PI / 2);   // peppermint badge
  },
  sweater(O) {
    O.body.color.set('#b8202e'); O.bodyDark.color.set('#7c1018');
    const white = O.M('#f4f4f4'), green = O.M('#1f8a3a');
    O.add(O.torso, box(0.53, 0.09, 0.32), white, 0, 0.36, 0);
    for (let i = 0; i < 6; i++) O.add(O.torso, box(0.05, 0.05, 0.325), green, -0.2 + i * 0.08, 0.36, 0, 'body', 0, 0, Math.PI / 4);
    O.add(O.torso, starGeo(0.05, 0.02), O.M('#ffd24a', { metalness: 0.6 }), 0, 0.53, -0.21);
    O.hadd(new THREE.SphereGeometry(0.17, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), O.body, 0, HAT_Y - 0.05, 0.02);   // knit beanie
    O.hadd(new THREE.CylinderGeometry(0.175, 0.175, 0.06, 14), white, 0, HAT_Y - 0.04, 0.02);
    O.hadd(sph(0.06), white, 0, HAT_Y + 0.14, 0.02);
  },
  snowman(O) {
    O.body.color.set('#f4f8ff'); O.bodyDark.color.set('#dfe8f2'); O.skin.color.set('#f4f8ff');
    const coal = O.M('#141414'), black = O.M('#141414', { roughness: 0.3 });
    for (let i = 0; i < 3; i++) O.add(O.torso, sph(0.03), coal, 0, 0.52 - i * 0.12, -0.215);
    O.hadd(new THREE.ConeGeometry(0.03, 0.16, 8), O.M('#ff8a1a'), 0, 0.11, -0.2, -Math.PI / 2);     // carrot nose
    O.hadd(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 16), black, 0, HAT_Y, 0.02);               // top hat
    O.hadd(new THREE.CylinderGeometry(0.13, 0.13, 0.26, 16), black, 0, HAT_Y + 0.13, 0.02);
    O.hadd(new THREE.CylinderGeometry(0.133, 0.133, 0.04, 16), O.M('#d81e2a'), 0, HAT_Y + 0.04, 0.02);
    O.add(O.torso, box(0.38, 0.09, 0.36), O.M('#d81e2a', { roughness: 0.8 }), 0, 0.62, 0);        // scarf
    O.add(O.torso, box(0.1, 0.3, 0.04), O.M('#d81e2a', { roughness: 0.8 }), 0.11, 0.48, -0.2, 'body', -0.15, 0, 0.1);
  },
  krampus(O) {
    O.body.color.set('#2a2226'); O.bodyDark.color.set('#1a1416');
    const fur = O.M('#3a2e2a', { roughness: 1, flatShading: true }), horn = O.M('#1a1416', { roughness: 0.4 }), chain = O.M('#9aa0a8', { metalness: 1, roughness: 0.3 });
    for (const s of O.arms) for (let i = 0; i < 3; i++) O.add(s.sh, new THREE.IcosahedronGeometry(0.07, 0), fur, -0.06 + i * 0.06, 0.08, (i - 1) * 0.05);
    for (let i = 0; i < 7; i++) O.add(O.hips, new THREE.IcosahedronGeometry(0.06, 0), fur, -0.21 + i * 0.07, -0.1, -0.12);
    for (const s of [-1, 1]) {
      O.hadd(new THREE.TorusGeometry(0.1, 0.03, 6, 12, Math.PI * 1.2), horn, s * 0.16, HAT_Y + 0.02, 0.04, 0, Math.PI / 2, s > 0 ? 0 : Math.PI);
      O.hadd(sph(0.022), O.M('#ff2a2a', { emissive: '#ff0000', emissiveIntensity: 2.5 }), s * 0.06, 0.15, -0.14);
    }
    for (let i = 0; i < 8; i++) O.add(O.torso, new THREE.TorusGeometry(0.03, 0.01, 5, 8), chain, -0.24 + i * 0.07, 0.6 - i * 0.055, -0.2, 'body', 0, i % 2 ? Math.PI / 2 : 0, 0.7);
  },
  star(O) {
    O.body.color.set('#7a1020'); O.bodyDark.color.set('#4a0812');
    const gold = O.M('#ffd24a', { metalness: 0.9, roughness: 0.2, emissive: '#a06a00', emissiveIntensity: 0.6 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      O.hadd(new THREE.ConeGeometry(0.035, 0.18, 6), gold, Math.sin(a) * 0.14, HAT_Y + 0.07, 0.02 + Math.cos(a) * 0.14, Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4);
    }
    O.hadd(new THREE.TorusGeometry(0.16, 0.02, 6, 24), gold, 0, HAT_Y - 0.01, 0.02, Math.PI / 2);
    O.hadd(starGeo(0.07, 0.03), gold, 0, HAT_Y + 0.2, 0.02);
    O.add(O.torso, starGeo(0.1, 0.03), gold, 0, 0.45, -0.22);
    O.add(O.hips, box(0.455, 0.06, 0.295), gold, 0, 0.07, 0);
  },
  tree(O) {
    O.body.color.set('#1f7a36'); O.bodyDark.color.set('#155a26');
    const gold = O.M('#ffd24a', { metalness: 0.9, roughness: 0.2, emissive: '#a06a00', emissiveIntensity: 0.6 });
    const cols = ['#e0182a', '#ffd24a', '#2a7bff', '#ff8fd0'];
    for (let i = 0; i < 8; i++) {
      const a = i * 0.8;
      O.add(O.torso, sph(0.032), O.M(cols[i % 4], { metalness: 0.8, roughness: 0.15 }), Math.sin(a) * 0.22, 0.2 + (i % 4) * 0.12, -0.18 + (Math.cos(a) < 0 ? 0 : -0.01));
    }
    for (let i = 0; i < 9; i++) O.add(O.torso, sph(0.016, 6, 4), gold, -0.25 + i * 0.0625, 0.58 - i * 0.05, -0.2);  // tinsel
    coneHat(O, O.M('#1f7a36', { flatShading: true }), null, null, { h: 0.4, tilt: 0, r: 0.2 });
    O.hadd(starGeo(0.08, 0.03), gold, 0, HAT_Y + 0.46, 0.02);
  },
  bells(O) {
    O.body.color.set('#1f6a3a'); O.bodyDark.color.set('#154a28');
    const gold = O.M('#ffd24a', { metalness: 0.9, roughness: 0.2 }), red = O.M('#c8202a');
    O.add(O.torso, box(0.56, 0.62, 0.04), red, 0, 0.3, 0.19, 'body', -0.08, 0, 0);                // cloak
    for (let i = 0; i < 5; i++) O.add(O.torso, sph(0.035), gold, -0.22 + i * 0.11, 0.0, 0.2);
    for (let i = 0; i < 3; i++) O.add(O.torso, new THREE.SphereGeometry(1, 6, 4).scale(0.03, 0.008, 0.06), O.M('#1f8a3a', { flatShading: true }), -0.12 + i * 0.03, 0.56, -0.22, 'body', 0, 0, (i - 1) * 0.6);
    O.add(O.torso, sph(0.02), red, -0.09, 0.55, -0.23);
    coneHat(O, red, null, gold, { h: 0.3, tilt: 0.9, r: 0.17 });
  },
  sleigh(O) {
    O.body.color.set('#8a1a22'); O.bodyDark.color.set('#5a1016');
    const fur = O.M('#f7f7f2', { roughness: 0.95 }), gold = O.M('#ffd24a', { metalness: 0.9, roughness: 0.25 }), lens = O.M('#7fd8ff', { metalness: 1, roughness: 0.05, emissive: '#2a7fff', emissiveIntensity: 0.4 });
    O.add(O.torso, box(0.42, 0.1, 0.38), fur, 0, 0.64, 0);
    for (const s of [-1, 1]) { O.hadd(new THREE.TorusGeometry(0.045, 0.012, 6, 14), gold, s * 0.065, HAT_Y - 0.02, -0.14); O.hadd(new THREE.CircleGeometry(0.04, 12), lens, s * 0.065, HAT_Y - 0.02, -0.145, 0, Math.PI, 0); }
    O.hadd(box(0.3, 0.03, 0.3), O.M('#3a2418'), 0, HAT_Y - 0.03, 0.03);                             // goggle strap / cap
    const scarf = O.M('#f4f4f4', { roughness: 0.9 });
    O.add(O.torso, box(0.1, 0.06, 0.5), scarf, 0.1, 0.62, 0.35, 'body', 0.3, 0.2, 0);
    for (const s of O.arms) O.add(s.hand, box(0.115, 0.125, 0.115), O.M('#5a3a20'), 0, -0.02, 0);
  },
};

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
