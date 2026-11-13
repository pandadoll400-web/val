import * as THREE from 'three';
import { skinMaterials, skinBundle } from '../data/skins.js';

/* ---- procedural surface textures (wear, stipple, grain) ---- */
function canvasTex(draw, repeat = 3, srgb = false) {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  draw(c.getContext('2d'), S);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function noiseFill(g, S, base, amp) {
  const img = g.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const v = Math.max(0, Math.min(255, base + (Math.random() - 0.5) * amp));
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}
const TEX = {
  // brushed metal with scratches (roughness / bump)
  metal: canvasTex((g, S) => {
    noiseFill(g, S, 150, 50);
    for (let i = 0; i < 260; i++) { // brushed streaks
      g.strokeStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${0.04 + Math.random() * 0.06})`;
      g.lineWidth = 1;
      const y = Math.random() * S;
      g.beginPath(); g.moveTo(0, y); g.lineTo(S, y + (Math.random() - 0.5) * 4); g.stroke();
    }
    for (let i = 0; i < 40; i++) { // scratches
      g.strokeStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.25})`;
      const x = Math.random() * S, y = Math.random() * S, a = Math.random() * Math.PI, l = 8 + Math.random() * 30;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  }, 3),
  // stippled polymer grip texture
  stipple: canvasTex((g, S) => {
    noiseFill(g, S, 128, 30);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},0.35)`;
      g.beginPath(); g.arc(Math.random() * S, Math.random() * S, 1 + Math.random() * 1.5, 0, Math.PI * 2); g.fill();
    }
  }, 4),
  // wood grain (color)
  wood: canvasTex((g, S) => {
    g.fillStyle = '#8a5230'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y++) {
      const v = Math.sin(y * 0.35 + Math.sin(y * 0.05) * 4) * 0.5 + 0.5;
      g.fillStyle = `rgba(40,18,6,${0.12 + v * 0.28})`;
      g.fillRect(0, y, S, 1);
    }
    for (let i = 0; i < 12; i++) { // knots / streaks
      g.fillStyle = 'rgba(30,12,4,0.25)';
      g.beginPath(); g.ellipse(Math.random() * S, Math.random() * S, 20 + Math.random() * 30, 2 + Math.random() * 3, 0, 0, Math.PI * 2); g.fill();
    }
  }, 2, true),
  // arctic splinter camo (color)
  camo: canvasTex((g, S) => {
    g.fillStyle = '#c9d6df'; g.fillRect(0, 0, S, S);
    const cols = ['#9fb4c4', '#7f95a8', '#e9f0f4', '#6c8193'];
    for (let i = 0; i < 70; i++) {
      g.fillStyle = cols[i % cols.length];
      g.beginPath();
      const x = Math.random() * S, y = Math.random() * S;
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) g.lineTo(x + (Math.random() - 0.3) * 60, y + (Math.random() - 0.5) * 18);
      g.closePath(); g.fill();
    }
  }, 2, true),
};

/* Shared viewmodel materials */
export const VM = {
  metal: new THREE.MeshStandardMaterial({ color: '#2a2e35', metalness: 0.85, roughness: 0.55, roughnessMap: TEX.metal, bumpMap: TEX.metal, bumpScale: 0.35 }),
  metal2: new THREE.MeshStandardMaterial({ color: '#4a525e', metalness: 0.8, roughness: 0.62, roughnessMap: TEX.metal, bumpMap: TEX.metal, bumpScale: 0.3 }),
  steel: new THREE.MeshStandardMaterial({ color: '#a2a9b2', metalness: 0.95, roughness: 0.4, roughnessMap: TEX.metal }),
  poly: new THREE.MeshStandardMaterial({ color: '#1d2025', metalness: 0.1, roughness: 0.8, bumpMap: TEX.stipple, bumpScale: 0.25 }),
  rubber: new THREE.MeshStandardMaterial({ color: '#131417', roughness: 0.95, bumpMap: TEX.stipple, bumpScale: 0.6 }),
  tan: new THREE.MeshStandardMaterial({ color: '#a8906b', roughness: 0.75, bumpMap: TEX.stipple, bumpScale: 0.2 }),
  wood: new THREE.MeshStandardMaterial({ color: '#ffffff', map: TEX.wood, roughness: 0.45, metalness: 0.05, bumpMap: TEX.wood, bumpScale: 0.15 }),
  white: new THREE.MeshStandardMaterial({ color: '#dbe7ef', roughness: 0.55, bumpMap: TEX.stipple, bumpScale: 0.15 }),
  camo: new THREE.MeshStandardMaterial({ color: '#ffffff', map: TEX.camo, roughness: 0.6, bumpMap: TEX.stipple, bumpScale: 0.15 }),
  brass: new THREE.MeshStandardMaterial({ color: '#d4a640', metalness: 0.9, roughness: 0.28 }),
  glove: new THREE.MeshStandardMaterial({ color: '#2a2b30', roughness: 0.9 }),
  glove2: new THREE.MeshStandardMaterial({ color: '#3b3d44', roughness: 0.85 }),
  red: new THREE.MeshBasicMaterial({ color: '#ff2a2a' }),
  dotWhite: new THREE.MeshBasicMaterial({ color: '#d8fff0' }),
  shellRed: new THREE.MeshStandardMaterial({ color: '#c8322b', roughness: 0.45 }),
  glass: new THREE.MeshStandardMaterial({ color: '#7fc4ff', metalness: 1, roughness: 0, transparent: true, opacity: 0.22 }),
  lens: new THREE.MeshStandardMaterial({ color: '#1a3a5a', metalness: 1, roughness: 0.05, emissive: '#2a7fff', emissiveIntensity: 0.35 }),
  accent: new THREE.MeshStandardMaterial({ color: '#ff8f4a', roughness: 0.4, metalness: 0.3 }),
};

const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const C = (r, len, seg = 16) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2);
const CT = (r1, r2, len, seg = 18) => new THREE.CylinderGeometry(r1, r2, len, seg).rotateX(Math.PI / 2); // r1 at -z (front)

function part(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  parent.add(m);
  return m;
}
const point = (parent, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; };

/**
 * Side-silhouette extrusion with beveled edges.
 * pts: [[forward, y], ...] where forward = -z. Extruded symmetrically along x by `width`.
 */
function prof(parent, pts, width, mat, bevel = 0.0025, x = 0) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const depth = Math.max(0.001, width - bevel * 2);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(Math.PI / 2); // shape x -> -z (forward), extrusion -> x
  const m = new THREE.Mesh(g, mat);
  m.position.x = x;
  parent.add(m);
  return m;
}

/** Picatinny rail: base + teeth from z0 to z1 (z1 < z0, forward). */
function rail(parent, y, z0, z1, w = 0.024) {
  const len = z0 - z1;
  part(parent, B(w, 0.006, len), VM.metal, 0, y, (z0 + z1) / 2);
  const n = Math.floor(len / 0.012);
  for (let i = 0; i < n; i++) part(parent, B(w + 0.004, 0.005, 0.006), VM.metal, 0, y + 0.0055, z0 - 0.006 - i * 0.012);
}

/* ======================= PISTOL ======================= */
function pistol() {
  const g = new THREE.Group();
  const slide = new THREE.Group();
  slide.position.set(0, 0, -0.055);
  g.add(slide);
  prof(slide, [[-0.095, 0.031], [0.097, 0.031], [0.097, 0.058], [0.088, 0.066], [-0.084, 0.066], [-0.095, 0.058]], 0.032, VM.metal, 0.003);
  for (let i = 0; i < 6; i++) { // rear serrations
    part(slide, B(0.0335, 0.022, 0.0025), VM.poly, 0, 0.049, 0.08 - i * 0.006);
  }
  part(slide, B(0.004, 0.012, 0.04), VM.rubber, 0.0155, 0.054, -0.005); // ejection port
  part(slide, B(0.005, 0.009, 0.007), VM.metal, 0, 0.0705, -0.087);       // front sight
  part(slide, new THREE.SphereGeometry(0.0014, 6, 4), VM.dotWhite, 0, 0.0735, -0.0905);
  part(slide, B(0.0075, 0.009, 0.007), VM.metal, 0.0075, 0.0705, 0.086);  // rear sight (notch)
  part(slide, B(0.0075, 0.009, 0.007), VM.metal, -0.0075, 0.0705, 0.086);
  part(slide, C(0.0085, 0.012), VM.steel, 0, 0.048, -0.1);                // barrel crown
  part(slide, C(0.0045, 0.013), VM.rubber, 0, 0.048, -0.101);

  // frame
  prof(g, [[-0.09, 0.012], [0.085, 0.012], [0.09, 0.022], [0.09, 0.031], [-0.093, 0.031], [-0.093, 0.02]], 0.029, VM.poly, 0.002);
  for (let i = 0; i < 3; i++) part(g, B(0.03, 0.004, 0.006), VM.poly, 0, 0.009, -0.11 - i * 0.012); // accessory rail
  const guard = part(g, new THREE.TorusGeometry(0.019, 0.0035, 6, 14, Math.PI), VM.poly, 0, 0.012, -0.025, 0, Math.PI / 2, Math.PI);
  guard.scale.set(1, 1.1, 1);
  part(g, B(0.005, 0.02, 0.005), VM.steel, 0, 0.003, -0.022, 0.25); // trigger
  // grip (raked) with texture bands
  prof(g, [[-0.03, 0.014], [0.014, 0.014], [0.024, -0.088], [-0.018, -0.098], [-0.048, 0.004]], 0.031, VM.poly, 0.003);
  for (let i = 0; i < 5; i++) part(g, B(0.0325, 0.005, 0.03), VM.rubber, 0, -0.02 - i * 0.014, 0.012 + i * 0.0035, -0.22);
  part(g, B(0.012, 0.012, 0.012), VM.metal2, -0.0155, 0.026, -0.005); // slide stop
  // magazine (only base plate visible when seated)
  const mag = new THREE.Group();
  mag.position.set(0, -0.05, 0.012);
  mag.rotation.x = -0.22;
  part(mag, B(0.024, 0.1, 0.033), VM.metal2, 0, 0, 0);
  part(mag, B(0.03, 0.012, 0.042), VM.poly, 0, -0.053, 0.002);
  part(mag, new THREE.SphereGeometry(0.004, 6, 4), VM.brass, 0, 0.051, -0.008);
  g.add(mag);
  // front serrations, extractor, fiber-optic front dot, takedown lever, beavertail
  for (let i = 0; i < 4; i++) part(slide, B(0.0335, 0.018, 0.0022), VM.poly, 0, 0.05, -0.07 - i * 0.006);
  part(slide, B(0.003, 0.005, 0.03), VM.steel, 0.0165, 0.06, 0.02);
  part(slide, new THREE.SphereGeometry(0.0016, 6, 4), VM.red, 0, 0.0735, -0.0835);
  part(g, B(0.004, 0.006, 0.014), VM.metal2, -0.0155, 0.022, -0.06);
  prof(g, [[-0.03, 0.03], [-0.062, 0.029], [-0.058, 0.017], [-0.03, 0.012]], 0.026, VM.poly, 0.002);
  // compact weapon light on the accessory rail
  const light = new THREE.Group();
  light.position.set(0, 0.0, -0.118);
  prof(light, [[-0.035, 0.004], [0.04, 0.004], [0.045, -0.018], [-0.03, -0.022]], 0.03, VM.poly, 0.003);
  part(light, C(0.0105, 0.004), VM.lens, 0, -0.007, -0.046);
  part(light, B(0.008, 0.006, 0.012), VM.metal2, 0.016, -0.008, 0.012);
  g.add(light);
  return {
    group: g, kind: 'mag', mag, slide,
    muzzle: point(g, 0, 0.048, -0.172), eject: point(g, 0.02, 0.06, -0.06),
    sightY: 0.075, hip: new THREE.Vector3(0.16, -0.16, -0.36), adsZ: -0.24,
    grip: new THREE.Vector3(0, -0.035, 0.012), leftRest: new THREE.Vector3(-0.022, -0.055, 0.02),
    flashScale: 0.8,
  };
}

/* ======================= RIFLE ======================= */
function rifle() {
  const g = new THREE.Group();
  // upper receiver
  prof(g, [[-0.07, 0.0], [0.2, 0.0], [0.2, 0.058], [0.19, 0.064], [-0.06, 0.064], [-0.07, 0.056]], 0.05, VM.metal, 0.004);
  part(g, B(0.004, 0.022, 0.07), VM.rubber, 0.0255, 0.036, -0.06);    // ejection port
  part(g, B(0.004, 0.018, 0.064), VM.metal2, 0.0258, 0.036, -0.06);   // dust cover
  part(g, C(0.008, 0.02), VM.metal2, 0.03, 0.04, 0.0, 0, Math.PI / 2); // forward assist
  // lower receiver + magwell
  prof(g, [[-0.06, 0.0], [0.15, 0.0], [0.15, -0.012], [0.12, -0.028], [0.06, -0.03], [0.0, -0.026], [-0.06, -0.012]], 0.046, VM.metal2, 0.003);
  prof(g, [[0.1, -0.02], [0.18, -0.02], [0.185, -0.05], [0.095, -0.05]], 0.044, VM.metal2, 0.003);
  part(g, new THREE.TorusGeometry(0.02, 0.003, 6, 14, Math.PI), VM.metal2, 0, -0.026, -0.03, 0, Math.PI / 2, Math.PI);
  part(g, B(0.005, 0.022, 0.005), VM.steel, 0, -0.035, -0.035, 0.2);
  part(g, B(0.01, 0.008, 0.02), VM.accent, -0.024, 0.006, 0.02); // safety selector
  // handguard (octagonal) with slots
  const hg = part(g, new THREE.CylinderGeometry(0.031, 0.031, 0.29, 8).rotateX(Math.PI / 2), VM.tan, 0, 0.034, -0.36);
  hg.rotation.z = Math.PI / 8;
  for (let i = 0; i < 4; i++) {
    for (const sx of [-1, 1]) part(g, B(0.004, 0.009, 0.035), VM.rubber, sx * 0.0295, 0.034, -0.27 - i * 0.055);
  }
  part(g, C(0.035, 0.012, 8), VM.metal, 0, 0.034, -0.212);
  rail(g, 0.064, 0.05, -0.5);
  // barrel, gas block, muzzle brake
  part(g, C(0.0105, 0.2), VM.metal, 0, 0.038, -0.6);
  part(g, B(0.022, 0.026, 0.026), VM.metal, 0, 0.042, -0.53);
  part(g, C(0.018, 0.065, 12), VM.metal, 0, 0.038, -0.725);
  for (let i = 0; i < 3; i++) part(g, B(0.038, 0.007, 0.008), VM.rubber, 0, 0.038, -0.705 - i * 0.017);
  part(g, C(0.006, 0.01), VM.rubber, 0, 0.038, -0.758);
  // stock + buffer tube
  part(g, C(0.016, 0.17), VM.metal, 0, 0.028, 0.14);
  prof(g, [[-0.12, 0.05], [-0.27, 0.036], [-0.275, -0.048], [-0.255, -0.062], [-0.16, -0.022], [-0.12, -0.004]], 0.046, VM.tan, 0.004);
  part(g, B(0.05, 0.1, 0.018), VM.rubber, 0, -0.005, 0.282);
  part(g, B(0.006, 0.03, 0.06), VM.poly, 0.024, 0.03, 0.18); // adjust lever
  // pistol grip
  prof(g, [[-0.004, -0.01], [0.04, -0.01], [0.022, -0.104], [-0.018, -0.106], [-0.014, -0.03]], 0.034, VM.poly, 0.004);
  for (let i = 0; i < 4; i++) part(g, B(0.0355, 0.004, 0.034), VM.rubber, 0, -0.04 - i * 0.017, 0.01 + i * 0.004, -0.3);
  // vertical foregrip
  part(g, CT(0.013, 0.015, 0.075).rotateX(-Math.PI / 2), VM.poly, 0, -0.022, -0.4);
  part(g, C(0.0165, 0.01).rotateX(-Math.PI / 2), VM.rubber, 0, -0.063, -0.4);
  // charging handle
  const handle = new THREE.Group();
  handle.position.set(0, 0.058, 0.06);
  part(handle, B(0.052, 0.01, 0.014), VM.metal2, 0, 0, 0.012);
  part(handle, B(0.012, 0.008, 0.03), VM.metal2, 0, 0, 0);
  g.add(handle);
  // magazine (curved)
  const mag = new THREE.Group();
  mag.position.set(0, -0.03, -0.14);
  prof(mag, [[-0.03, 0.0], [0.03, 0.0], [0.05, -0.135], [-0.012, -0.142]], 0.031, VM.metal2, 0.003);
  for (let i = 0; i < 4; i++) prof(mag, [[-0.026 - i * 0.003, -0.025 - i * 0.028], [0.026 + i * 0.004, -0.025 - i * 0.028], [0.028 + i * 0.004, -0.029 - i * 0.028], [-0.026 - i * 0.003, -0.029 - i * 0.028]], 0.034, VM.poly, 0.001);
  prof(mag, [[-0.016, -0.14], [0.054, -0.133], [0.056, -0.148], [-0.016, -0.155]], 0.036, VM.poly, 0.002);
  part(mag, new THREE.SphereGeometry(0.0045, 6, 4), VM.brass, 0, 0.004, 0.01);
  g.add(mag);
  // red-dot sight (aligned: dot at y .105, z -.104)
  part(g, B(0.034, 0.01, 0.06), VM.metal, 0, 0.073, -0.085);
  prof(g, [[0.055, 0.078], [0.115, 0.078], [0.115, 0.084], [0.055, 0.084]], 0.044, VM.poly, 0.002);
  for (const sx of [-1, 1]) prof(g, [[0.06, 0.082], [0.11, 0.082], [0.108, 0.128], [0.064, 0.128]], 0.006, VM.poly, 0.0015, sx * 0.021);
  prof(g, [[0.062, 0.125], [0.11, 0.125], [0.106, 0.132], [0.066, 0.132]], 0.048, VM.poly, 0.0015);
  part(g, C(0.006, 0.01), VM.metal2, 0.027, 0.105, -0.09, 0, Math.PI / 2);
  part(g, B(0.036, 0.036, 0.002), VM.glass, 0, 0.105, -0.105);
  part(g, new THREE.SphereGeometry(0.0022, 8, 6), VM.red, 0, 0.105, -0.104);
  // folded flip-up iron sights
  prof(g, [[-0.035, 0.07], [-0.012, 0.07], [-0.015, 0.08], [-0.032, 0.08]], 0.024, VM.metal, 0.002);
  prof(g, [[0.47, 0.07], [0.495, 0.07], [0.49, 0.081], [0.473, 0.081]], 0.022, VM.metal, 0.002);
  // right side rail + weapon light with pressure switch
  part(g, B(0.006, 0.02, 0.12), VM.metal, 0.034, 0.034, -0.44);
  for (let i = 0; i < 8; i++) part(g, B(0.009, 0.022, 0.005), VM.metal, 0.035, 0.034, -0.388 - i * 0.014);
  part(g, C(0.015, 0.09), VM.metal, 0.05, 0.03, -0.45);
  part(g, C(0.018, 0.022), VM.metal, 0.05, 0.03, -0.5);
  for (let i = 0; i < 4; i++) part(g, C(0.0155, 0.004), VM.rubber, 0.05, 0.03, -0.42 - i * 0.012);
  part(g, C(0.015, 0.003), VM.lens, 0.05, 0.03, -0.512);
  part(g, B(0.012, 0.01, 0.024), VM.rubber, 0.05, 0.048, -0.42);
  // controls, brass deflector, sling swivel
  part(g, B(0.004, 0.02, 0.012), VM.metal2, -0.0245, 0.0, -0.11);
  part(g, C(0.006, 0.008), VM.metal2, 0.0245, -0.01, -0.08, 0, Math.PI / 2);
  part(g, B(0.01, 0.016, 0.018), VM.metal, 0.028, 0.045, -0.002);
  part(g, new THREE.TorusGeometry(0.009, 0.0022, 6, 12), VM.steel, -0.027, -0.01, 0.22, 0, Math.PI / 2, 0);
  return {
    group: g, kind: 'mag', mag, handle,
    muzzle: point(g, 0, 0.038, -0.765), eject: point(g, 0.03, 0.04, -0.06),
    sightY: 0.105, hip: new THREE.Vector3(0.19, -0.2, -0.42), adsZ: -0.2,
    grip: new THREE.Vector3(0, -0.045, 0.012), leftRest: new THREE.Vector3(0, -0.045, -0.4),
    flashScale: 1,
  };
}

/* ======================= SHOTGUN ======================= */
function shotgun() {
  const g = new THREE.Group();
  prof(g, [[-0.05, -0.022], [0.2, -0.022], [0.2, 0.05], [0.19, 0.058], [-0.04, 0.058], [-0.05, 0.045]], 0.052, VM.metal, 0.004);
  part(g, B(0.004, 0.024, 0.07), VM.rubber, 0.0265, 0.028, -0.07);            // ejection port
  part(g, B(0.03, 0.004, 0.08), VM.rubber, 0, -0.0225, -0.09);                // loading port
  part(g, B(0.0525, 0.003, 0.24), VM.brass, 0, 0.0, -0.08);                    // accent line
  // barrel + vent rib + mag tube + clamp
  part(g, C(0.0145, 0.52), VM.metal, 0, 0.044, -0.46);
  part(g, B(0.008, 0.004, 0.5), VM.metal2, 0, 0.0625, -0.46);
  for (let i = 0; i < 10; i++) part(g, B(0.006, 0.004, 0.006), VM.metal2, 0, 0.0595, -0.24 - i * 0.048);
  part(g, C(0.0125, 0.44), VM.metal2, 0, 0.007, -0.42);
  part(g, C(0.011, 0.01), VM.steel, 0, 0.007, -0.645);
  const clamp = part(g, B(0.034, 0.07, 0.016), VM.metal, 0, 0.026, -0.6);
  clamp.scale.set(1, 1, 1);
  part(g, C(0.0095, 0.012), VM.rubber, 0, 0.044, -0.722);
  // pump
  const pump = new THREE.Group();
  pump.position.set(0, 0.008, -0.36);
  prof(pump, [[-0.085, -0.022], [0.085, -0.022], [0.09, 0.012], [0.08, 0.024], [-0.08, 0.024], [-0.09, 0.012]], 0.06, VM.wood, 0.004);
  for (let i = 0; i < 7; i++) part(pump, B(0.062, 0.006, 0.008), VM.rubber, 0, 0.0, -0.06 + i * 0.02);
  g.add(pump);
  // stock + grip (one piece)
  prof(g, [[-0.04, 0.05], [-0.31, 0.03], [-0.315, -0.075], [-0.27, -0.082], [-0.1, -0.035], [-0.07, -0.09], [-0.04, -0.092], [-0.012, -0.03], [-0.04, -0.02]], 0.046, VM.wood, 0.005);
  part(g, B(0.05, 0.11, 0.02), VM.rubber, 0, -0.02, 0.322, 0.08);
  part(g, new THREE.TorusGeometry(0.02, 0.0035, 6, 14, Math.PI), VM.metal, 0, -0.022, -0.02, 0, Math.PI / 2, Math.PI);
  part(g, B(0.005, 0.022, 0.005), VM.steel, 0, -0.03, -0.022, 0.25);
  // sights
  part(g, new THREE.SphereGeometry(0.0042, 8, 6), VM.brass, 0, 0.0665, -0.71);
  part(g, B(0.006, 0.012, 0.008), VM.metal, 0.0075, 0.064, -0.02);
  part(g, B(0.006, 0.012, 0.008), VM.metal, -0.0075, 0.064, -0.02);
  // side saddle with 4 shells
  part(g, B(0.006, 0.03, 0.09), VM.poly, -0.029, 0.018, -0.08);
  for (let i = 0; i < 4; i++) {
    part(g, new THREE.CylinderGeometry(0.0095, 0.0095, 0.045, 10), VM.shellRed, -0.036, 0.018, -0.115 + i * 0.023);
    part(g, new THREE.CylinderGeometry(0.01, 0.01, 0.012, 10), VM.brass, -0.036, -0.003, -0.115 + i * 0.023);
  }
  // ventilated heat shield over the barrel (top half-tube with slots)
  part(g, new THREE.CylinderGeometry(0.021, 0.021, 0.26, 16, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2), VM.metal, 0, 0.044, -0.36);
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) part(g, B(0.007, 0.003, 0.016), VM.rubber, sx * 0.011, 0.0615, -0.26 - i * 0.04, 0, 0, -sx * 0.55);
  // engraving lines + sling swivels
  for (const y of [0.012, 0.04]) part(g, B(0.0532, 0.0018, 0.2), VM.brass, 0, y, -0.08);
  part(g, new THREE.TorusGeometry(0.009, 0.0022, 6, 12), VM.steel, 0, -0.09, 0.24, 0, Math.PI / 2, 0);
  part(g, new THREE.TorusGeometry(0.008, 0.002, 6, 12), VM.steel, 0, -0.012, -0.62, 0, Math.PI / 2, 0);
  const shell = new THREE.Group();
  part(shell, C(0.01, 0.05), VM.shellRed, 0, 0, 0);
  part(shell, C(0.0105, 0.014), VM.brass, 0, 0, 0.027);
  return {
    group: g, kind: 'shell', pump, handShell: shell,
    muzzle: point(g, 0, 0.044, -0.73), eject: point(g, 0.03, 0.03, -0.07),
    sightY: 0.068, hip: new THREE.Vector3(0.19, -0.2, -0.4), adsZ: -0.34,
    grip: new THREE.Vector3(0, -0.045, 0.02), leftRest: new THREE.Vector3(0, -0.024, -0.36),
    flashScale: 1.5,
  };
}

/* ======================= SNIPER ======================= */
function sniper() {
  const g = new THREE.Group();
  // receiver
  prof(g, [[-0.08, 0.0], [0.24, 0.0], [0.24, 0.048], [0.23, 0.056], [-0.07, 0.056], [-0.08, 0.048]], 0.05, VM.metal, 0.004);
  part(g, B(0.004, 0.02, 0.08), VM.rubber, 0.0255, 0.03, -0.0);
  // chassis + thumbhole stock (arctic camo)
  prof(g, [[0.6, 0.005], [0.06, 0.005], [-0.02, -0.03], [0.04, -0.05], [0.6, -0.04]], 0.058, VM.camo, 0.005);
  prof(g, [[-0.03, 0.03], [-0.42, 0.04], [-0.425, -0.085], [-0.38, -0.095], [-0.17, -0.06], [-0.12, -0.09], [-0.07, -0.1], [-0.03, -0.03]], 0.05, VM.camo, 0.006);
  prof(g, [[-0.16, 0.045], [-0.34, 0.05], [-0.34, 0.075], [-0.18, 0.07]], 0.042, VM.white, 0.006); // cheek riser
  part(g, B(0.054, 0.13, 0.02), VM.rubber, 0, -0.022, 0.43);
  for (let i = 0; i < 3; i++) part(g, B(0.0585, 0.006, 0.05), VM.poly, 0, -0.018, -0.32 - i * 0.08); // forend vents
  part(g, new THREE.TorusGeometry(0.02, 0.0035, 6, 14, Math.PI), VM.metal, 0, -0.026, 0.03, 0, Math.PI / 2, Math.PI);
  part(g, B(0.005, 0.022, 0.005), VM.steel, 0, -0.035, 0.028, 0.25);
  // fluted barrel + brake
  part(g, C(0.0125, 0.62), VM.metal, 0, 0.03, -0.55);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    part(g, B(0.003, 0.003, 0.3), VM.rubber, Math.cos(a) * 0.012, 0.03 + Math.sin(a) * 0.012, -0.5);
  }
  prof(g, [[0.84, 0.012], [0.92, 0.012], [0.92, 0.048], [0.84, 0.048]], 0.034, VM.metal, 0.003);
  for (let i = 0; i < 3; i++) part(g, B(0.036, 0.022, 0.009), VM.rubber, 0, 0.03, -0.855 - i * 0.022);
  // bipod (folded)
  for (const sx of [-1, 1]) part(g, C(0.005, 0.2), VM.metal, sx * 0.014, -0.045, -0.5);
  part(g, B(0.04, 0.014, 0.02), VM.metal, 0, -0.04, -0.6);
  // scope
  part(g, C(0.017, 0.24), VM.poly, 0, 0.1, -0.08);
  part(g, CT(0.029, 0.017, 0.08), VM.poly, 0, 0.1, -0.24);
  part(g, C(0.029, 0.03), VM.poly, 0, 0.1, -0.295);
  part(g, C(0.026, 0.002), VM.lens, 0, 0.1, -0.311);
  part(g, CT(0.017, 0.023, 0.06), VM.poly, 0, 0.1, 0.07);
  part(g, C(0.023, 0.02), VM.rubber, 0, 0.1, 0.11);
  part(g, C(0.02, 0.002), VM.lens, 0, 0.1, 0.121);
  part(g, new THREE.CylinderGeometry(0.012, 0.012, 0.025, 14), VM.metal2, 0, 0.127, -0.08);       // elevation turret
  part(g, new THREE.CylinderGeometry(0.012, 0.012, 0.025, 14).rotateZ(Math.PI / 2), VM.metal2, 0.027, 0.1, -0.08); // windage
  part(g, new THREE.CylinderGeometry(0.0125, 0.0125, 0.004, 14), VM.accent, 0, 0.14, -0.08);
  for (const z of [-0.16, 0.0]) {
    part(g, new THREE.TorusGeometry(0.019, 0.004, 6, 16).rotateY(Math.PI / 2).rotateZ(0), VM.metal, 0, 0.1, z, 0, Math.PI / 2, 0);
    part(g, B(0.022, 0.04, 0.016), VM.metal, 0, 0.069, z);
  }
  rail(g, 0.056, 0.06, -0.2, 0.022);
  // bolt
  const bolt = new THREE.Group();
  bolt.position.set(0.028, 0.035, 0.03);
  part(bolt, C(0.008, 0.07), VM.steel, 0, 0, 0);
  part(bolt, B(0.03, 0.006, 0.006), VM.metal2, 0.015, 0, 0.02);
  part(bolt, new THREE.SphereGeometry(0.011, 12, 8), VM.metal, 0.032, 0, 0.02);
  g.add(bolt);
  // bolt shroud, flip-open scope caps, cheek-riser knobs, rear monopod
  part(g, C(0.017, 0.04), VM.metal, 0, 0.03, 0.1);
  part(g, C(0.0175, 0.006), VM.accent, 0, 0.03, 0.123);
  const capF = part(g, C(0.031, 0.006), VM.poly, 0, 0.142, -0.31);
  capF.rotation.x = -1.35;
  const capR = part(g, C(0.025, 0.006), VM.poly, 0, 0.135, 0.125);
  capR.rotation.x = 1.35;
  for (const sx of [-1, 1]) part(g, C(0.008, 0.012), VM.metal2, sx * 0.026, 0.06, 0.25, 0, Math.PI / 2);
  part(g, new THREE.CylinderGeometry(0.007, 0.007, 0.07, 10), VM.metal, 0, -0.12, 0.33);
  part(g, new THREE.CylinderGeometry(0.014, 0.014, 0.008, 12), VM.rubber, 0, -0.157, 0.33);
  const mag = new THREE.Group();
  mag.position.set(0, -0.035, -0.1);
  prof(mag, [[-0.04, 0.03], [0.04, 0.03], [0.04, -0.03], [-0.04, -0.03]], 0.042, VM.poly, 0.003);
  part(mag, B(0.044, 0.008, 0.084), VM.metal2, 0, -0.03, 0);
  g.add(mag);
  return {
    group: g, kind: 'bolt', mag, bolt,
    muzzle: point(g, 0, 0.03, -0.93), eject: point(g, 0.03, 0.04, 0.0),
    sightY: 0.1, hip: new THREE.Vector3(0.2, -0.21, -0.43), adsZ: -0.16,
    grip: new THREE.Vector3(0, -0.05, 0.08), leftRest: new THREE.Vector3(0, -0.04, -0.38),
    flashScale: 1.6,
  };
}

/* ======================= SMG ======================= */
function smg() {
  const g = new THREE.Group();
  // upper / lower receiver
  prof(g, [[-0.06, 0.0], [0.17, 0.0], [0.17, 0.052], [0.16, 0.06], [-0.05, 0.06], [-0.06, 0.05]], 0.046, VM.metal, 0.004);
  prof(g, [[-0.05, 0.0], [0.12, 0.0], [0.12, -0.02], [0.02, -0.026], [-0.05, -0.012]], 0.044, VM.poly, 0.003);
  prof(g, [[0.07, -0.015], [0.13, -0.015], [0.13, -0.045], [0.07, -0.045]], 0.04, VM.poly, 0.003);   // magwell
  part(g, B(0.004, 0.018, 0.05), VM.rubber, 0.0235, 0.034, -0.04);                                   // ejection port
  part(g, B(0.014, 0.01, 0.03), VM.metal2, -0.03, 0.04, -0.12);                                      // side charging knob
  part(g, C(0.006, 0.025), VM.metal2, -0.04, 0.04, -0.12, 0, Math.PI / 2);
  // handguard + barrel + compensator
  const hg = part(g, new THREE.CylinderGeometry(0.027, 0.027, 0.17, 8).rotateX(Math.PI / 2), VM.metal, 0, 0.032, -0.25);
  hg.rotation.z = Math.PI / 8;
  for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) part(g, B(0.004, 0.008, 0.03), VM.rubber, sx * 0.026, 0.032, -0.2 - i * 0.045);
  part(g, C(0.01, 0.08), VM.metal, 0, 0.034, -0.37);
  prof(g, [[0.4, 0.018], [0.45, 0.018], [0.45, 0.05], [0.4, 0.05]], 0.03, VM.metal, 0.003);
  for (let i = 0; i < 3; i++) part(g, B(0.032, 0.006, 0.006), VM.rubber, 0, 0.05, -0.41 - i * 0.013);
  rail(g, 0.06, 0.04, -0.32, 0.022);
  // holographic sight (reticle ring + dot at y=.1)
  prof(g, [[0.0, 0.066], [0.1, 0.066], [0.1, 0.076], [0.0, 0.076]], 0.04, VM.poly, 0.002);
  for (const sx of [-1, 1]) prof(g, [[0.02, 0.074], [0.09, 0.074], [0.085, 0.128], [0.03, 0.128]], 0.006, VM.poly, 0.0015, sx * 0.023);
  prof(g, [[0.025, 0.126], [0.09, 0.126], [0.085, 0.134], [0.03, 0.134]], 0.052, VM.poly, 0.0015);
  part(g, B(0.04, 0.05, 0.002), VM.glass, 0, 0.1, -0.06);
  part(g, new THREE.TorusGeometry(0.009, 0.0007, 6, 24), VM.red, 0, 0.1, -0.059);
  part(g, new THREE.SphereGeometry(0.0012, 6, 4), VM.red, 0, 0.1, -0.059);
  part(g, B(0.012, 0.012, 0.02), VM.metal2, 0.026, 0.096, -0.04);                                    // brightness button
  // pistol grip + vertical foregrip
  prof(g, [[-0.004, -0.01], [0.038, -0.01], [0.022, -0.1], [-0.016, -0.102], [-0.012, -0.03]], 0.033, VM.poly, 0.004);
  for (let i = 0; i < 4; i++) part(g, B(0.0345, 0.004, 0.032), VM.rubber, 0, -0.038 - i * 0.016, 0.008 + i * 0.004, -0.3);
  part(g, CT(0.012, 0.014, 0.07).rotateX(-Math.PI / 2), VM.poly, 0, -0.012, -0.26);
  part(g, C(0.0155, 0.01).rotateX(-Math.PI / 2), VM.rubber, 0, -0.05, -0.26);
  part(g, new THREE.TorusGeometry(0.018, 0.003, 6, 14, Math.PI), VM.poly, 0, -0.022, -0.035, 0, Math.PI / 2, Math.PI);
  part(g, B(0.005, 0.02, 0.005), VM.steel, 0, -0.03, -0.035, 0.2);
  // folding wire stock
  for (const sx of [-1, 1]) part(g, B(0.006, 0.006, 0.22), VM.metal, sx * 0.016, 0.03, 0.15);
  part(g, B(0.038, 0.006, 0.006), VM.metal, 0, 0.03, 0.26);
  prof(g, [[-0.255, 0.04], [-0.27, 0.04], [-0.27, -0.045], [-0.255, -0.045]], 0.044, VM.rubber, 0.004);
  part(g, B(0.006, 0.07, 0.006), VM.metal, 0, -0.005, 0.26);
  // long straight magazine
  const mag = new THREE.Group();
  mag.position.set(0, -0.03, -0.1);
  prof(mag, [[-0.026, 0.0], [0.026, 0.0], [0.03, -0.16], [-0.022, -0.16]], 0.028, VM.metal2, 0.003);
  for (let i = 0; i < 5; i++) part(mag, B(0.0285, 0.003, 0.044), VM.poly, 0, -0.025 - i * 0.026, -0.002);
  prof(mag, [[-0.026, -0.158], [0.034, -0.158], [0.034, -0.172], [-0.026, -0.172]], 0.032, VM.poly, 0.002);
  part(mag, new THREE.SphereGeometry(0.004, 6, 4), VM.brass, 0, 0.003, 0.006);
  g.add(mag);
  return {
    group: g, kind: 'mag', mag,
    muzzle: point(g, 0, 0.034, -0.46), eject: point(g, 0.03, 0.04, -0.04),
    sightY: 0.1, hip: new THREE.Vector3(0.18, -0.19, -0.38), adsZ: -0.2,
    grip: new THREE.Vector3(0, -0.045, 0.012), leftRest: new THREE.Vector3(0, -0.04, -0.26),
    flashScale: 0.8,
  };
}

/* ======================= DMR ======================= */
function dmr() {
  const g = new THREE.Group();
  prof(g, [[-0.08, 0.0], [0.26, 0.0], [0.26, 0.056], [0.25, 0.063], [-0.07, 0.063], [-0.08, 0.055]], 0.05, VM.metal, 0.004);
  prof(g, [[-0.07, 0.0], [0.17, 0.0], [0.17, -0.014], [0.13, -0.03], [0.0, -0.03], [-0.07, -0.014]], 0.047, VM.metal2, 0.003);
  part(g, B(0.004, 0.022, 0.07), VM.rubber, 0.0255, 0.034, -0.05);
  part(g, B(0.01, 0.008, 0.02), VM.accent, -0.025, 0.006, 0.02);
  // long free-float handguard (tan) + fluted barrel + brake
  const hg = part(g, new THREE.CylinderGeometry(0.032, 0.032, 0.34, 8).rotateX(Math.PI / 2), VM.tan, 0, 0.034, -0.43);
  hg.rotation.z = Math.PI / 8;
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) part(g, B(0.004, 0.009, 0.03), VM.rubber, sx * 0.0305, 0.034, -0.3 - i * 0.05);
  rail(g, 0.064, 0.06, -0.6);
  part(g, C(0.012, 0.22), VM.metal, 0, 0.036, -0.7);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    part(g, B(0.003, 0.003, 0.14), VM.rubber, Math.cos(a) * 0.0115, 0.036 + Math.sin(a) * 0.0115, -0.68);
  }
  prof(g, [[0.8, 0.018], [0.87, 0.018], [0.87, 0.054], [0.8, 0.054]], 0.032, VM.metal, 0.003);
  for (let i = 0; i < 3; i++) part(g, B(0.034, 0.02, 0.008), VM.rubber, 0, 0.036, -0.815 - i * 0.018);
  // 4x scope
  part(g, C(0.015, 0.2), VM.poly, 0, 0.1, -0.08);
  part(g, CT(0.024, 0.015, 0.06), VM.poly, 0, 0.1, -0.21);
  part(g, C(0.024, 0.02), VM.poly, 0, 0.1, -0.25);
  part(g, C(0.021, 0.002), VM.lens, 0, 0.1, -0.261);
  part(g, CT(0.015, 0.02, 0.05), VM.poly, 0, 0.1, 0.045);
  part(g, C(0.02, 0.02), VM.rubber, 0, 0.1, 0.08);
  part(g, C(0.017, 0.002), VM.lens, 0, 0.1, 0.091);
  part(g, new THREE.CylinderGeometry(0.01, 0.01, 0.02, 14), VM.metal2, 0, 0.123, -0.08);
  part(g, new THREE.CylinderGeometry(0.01, 0.01, 0.02, 14).rotateZ(Math.PI / 2), VM.metal2, 0.024, 0.1, -0.08);
  part(g, new THREE.CylinderGeometry(0.0105, 0.0105, 0.004, 14), VM.accent, 0, 0.134, -0.08);
  for (const z of [-0.14, -0.01]) { part(g, B(0.02, 0.036, 0.016), VM.metal, 0, 0.072, z); part(g, new THREE.TorusGeometry(0.017, 0.004, 6, 16), VM.metal, 0, 0.1, z); }
  // adjustable stock + cheek riser + grip
  part(g, C(0.016, 0.16), VM.metal, 0, 0.03, 0.15);
  prof(g, [[-0.13, 0.05], [-0.3, 0.04], [-0.305, -0.05], [-0.28, -0.065], [-0.17, -0.025], [-0.13, -0.005]], 0.046, VM.poly, 0.004);
  prof(g, [[-0.16, 0.05], [-0.28, 0.045], [-0.28, 0.068], [-0.17, 0.07]], 0.04, VM.tan, 0.004);
  part(g, B(0.05, 0.11, 0.018), VM.rubber, 0, -0.008, 0.31);
  prof(g, [[-0.004, -0.01], [0.04, -0.01], [0.022, -0.104], [-0.018, -0.106], [-0.014, -0.03]], 0.034, VM.poly, 0.004);
  part(g, new THREE.TorusGeometry(0.02, 0.003, 6, 14, Math.PI), VM.metal2, 0, -0.026, -0.03, 0, Math.PI / 2, Math.PI);
  part(g, B(0.005, 0.022, 0.005), VM.steel, 0, -0.035, -0.035, 0.2);
  const handle = new THREE.Group();
  handle.position.set(0, 0.058, 0.07);
  part(handle, B(0.05, 0.01, 0.014), VM.metal2, 0, 0, 0.012);
  g.add(handle);
  // 10-round box magazine
  const mag = new THREE.Group();
  mag.position.set(0, -0.03, -0.14);
  prof(mag, [[-0.03, 0.0], [0.03, 0.0], [0.034, -0.09], [-0.026, -0.09]], 0.032, VM.poly, 0.003);
  prof(mag, [[-0.028, -0.088], [0.038, -0.088], [0.038, -0.1], [-0.028, -0.1]], 0.036, VM.metal2, 0.002);
  part(mag, new THREE.SphereGeometry(0.0045, 6, 4), VM.brass, 0, 0.004, 0.01);
  g.add(mag);
  return {
    group: g, kind: 'mag', mag, handle,
    muzzle: point(g, 0, 0.036, -0.875), eject: point(g, 0.03, 0.04, -0.05),
    sightY: 0.1, hip: new THREE.Vector3(0.19, -0.2, -0.42), adsZ: -0.18,
    grip: new THREE.Vector3(0, -0.045, 0.012), leftRest: new THREE.Vector3(0, -0.005, -0.42),
    flashScale: 1.2,
  };
}

/* ======================= BOW ======================= */
function bow() {
  const g = new THREE.Group();
  const RZ = -0.42; // riser position (left hand)
  const riserMat = VM.metal, limbMat = new THREE.MeshStandardMaterial({ color: '#1e2a38', metalness: 0.4, roughness: 0.35 });
  limbMat.userData.skinSlot = 'body';
  // riser: machined handle with cut-outs + grip wrap + arrow shelf + sight pin
  prof(g, [[0.0, -0.12], [0.03, -0.12], [0.035, -0.04], [0.015, 0.0], [0.035, 0.04], [0.03, 0.14], [0.0, 0.14], [-0.01, 0.05], [-0.025, 0.0], [-0.01, -0.05]], 0.03, riserMat, 0.004, 0);
  g.children[g.children.length - 1].position.z = RZ + 0.0;
  part(g, B(0.034, 0.075, 0.04), VM.rubber, 0, -0.035, RZ + 0.012);                 // grip wrap
  for (let i = 0; i < 4; i++) part(g, B(0.0355, 0.004, 0.042), VM.glove2, 0, -0.065 + i * 0.018, RZ + 0.012);
  part(g, B(0.012, 0.006, 0.02), VM.steel, -0.016, 0.004, RZ - 0.005);               // arrow rest
  part(g, B(0.01, 0.05, 0.01), VM.metal2, 0.025, 0.06, RZ - 0.03);                    // sight bar
  part(g, new THREE.SphereGeometry(0.003, 8, 6), VM.accent, 0.018, 0.06, RZ - 0.03);  // sight pin
  part(g, C(0.006, 0.12), VM.metal2, 0, -0.08, RZ - 0.07);                            // stabilizer
  part(g, C(0.012, 0.03), VM.rubber, 0, -0.08, RZ - 0.14);
  // limbs (recurve): pivot groups so they can flex
  const mkLimb = (dir) => {
    const L = new THREE.Group();
    L.position.set(0, dir * (dir > 0 ? 0.14 : 0.12), RZ + 0.01);
    const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, dir * 0.16, 0.035), new THREE.Vector3(0, dir * 0.31, 0.03), new THREE.Vector3(0, dir * 0.38, -0.025)];
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.011, 8), limbMat);
    tube.scale.set(1.8, 1, 0.9);
    L.add(tube);
    part(L, B(0.024, 0.03, 0.02), VM.metal2, 0, dir * 0.01, 0.005);                  // limb bolt
    const tip = new THREE.Object3D();
    tip.position.set(0, dir * 0.375, -0.02);
    L.add(tip);
    part(L, new THREE.SphereGeometry(0.008, 8, 6), VM.accent, 0, dir * 0.38, -0.025);
    g.add(L);
    return { L, tip };
  };
  const up = mkLimb(1), down = mkLimb(-1);
  // string (two segments) — updated in setDraw
  const strMat = new THREE.MeshStandardMaterial({ color: '#e8edf2', roughness: 0.6 });
  const strGeo = new THREE.CylinderGeometry(0.0016, 0.0016, 1, 6);
  const s1 = new THREE.Mesh(strGeo, strMat), s2 = new THREE.Mesh(strGeo, strMat);
  g.add(s1, s2);
  // arrow (carbon shaft, broadhead, fletching)
  const arrow = new THREE.Group();
  part(arrow, C(0.004, 0.72), VM.rubber, 0, 0, -0.36);
  part(arrow, C(0.0045, 0.02), VM.accent, 0, 0, -0.02);                               // nock
  part(arrow, CT(0.0, 0.009, 0.045, 4), VM.steel, 0, 0, -0.745);                       // broadhead
  part(arrow, C(0.005, 0.015), VM.metal2, 0, 0, -0.715);
  for (let i = 0; i < 3; i++) {
    const v = part(arrow, B(0.0012, 0.018, 0.07), i === 0 ? VM.accent : VM.white, 0, 0, -0.08);
    v.rotation.z = (i / 3) * Math.PI * 2;
    v.position.set(Math.sin(v.rotation.z) * -0.008, Math.cos(v.rotation.z) * 0.008, -0.08);
  }
  const tipPt = point(arrow, 0, 0, -0.77);
  g.add(arrow);
  const nock = new THREE.Vector3();
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  const setSeg = (mesh, a, b) => {
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.scale.y = a.distanceTo(b);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _b.copy(b).sub(a).normalize());
  };
  const model = {
    group: g, kind: 'bow', arrow, limbs: [up.L, down.L],
    muzzle: tipPt, eject: point(g, 0, 0, 0),
    sightY: 0.05, hip: new THREE.Vector3(-0.04, -0.1, -0.2), adsZ: -0.16,
    grip: new THREE.Vector3(0.005, -0.005, RZ + 0.15), leftRest: new THREE.Vector3(0, -0.035, RZ + 0.012),
    flashScale: 0,
    /** d: 0..1 draw amount */
    setDraw(d) {
      up.L.rotation.x = -0.18 * d;
      down.L.rotation.x = 0.18 * d;
      g.updateMatrixWorld(true);
      nock.set(0, 0, RZ + 0.13 + d * 0.3);
      const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
      up.tip.getWorldPosition(_a).applyMatrix4(inv);
      setSeg(s1, _a.clone(), nock);
      down.tip.getWorldPosition(_a).applyMatrix4(inv);
      setSeg(s2, _a.clone(), nock);
      arrow.position.set(0, 0, nock.z);
      model.grip.set(0.005, -0.005, nock.z + 0.02);
    },
  };
  model.setDraw(0);
  g.rotation.z = 0.38; // canted like a real archer so the aim point stays clear
  return model;
}

/* ======================= KNIFE ======================= */
function knife() {
  const g = new THREE.Group();
  const blade = new THREE.MeshStandardMaterial({ color: '#c9d1d9', metalness: 1, roughness: 0.22, roughnessMap: VM.steel.roughnessMap });
  blade.userData.skinSlot = 'blade';
  const edge = new THREE.MeshStandardMaterial({ color: '#f2f6fa', metalness: 1, roughness: 0.08 });
  // tanto blade (forward = -z), with darker coated spine and polished edge bevel
  prof(g, [[0.035, -0.012], [0.19, -0.012], [0.235, 0.004], [0.215, 0.017], [0.035, 0.017]], 0.0055, blade, 0.0012);
  prof(g, [[0.04, -0.012], [0.19, -0.012], [0.232, 0.003], [0.226, 0.0045], [0.188, -0.006], [0.04, -0.006]], 0.0068, edge, 0.0006);
  prof(g, [[0.04, 0.011], [0.21, 0.011], [0.214, 0.017], [0.04, 0.017]], 0.0062, VM.metal, 0.0008);
  part(g, B(0.0065, 0.004, 0.09), VM.metal, 0, 0.003, -0.1);                          // fuller groove
  for (let i = 0; i < 5; i++) part(g, B(0.007, 0.006, 0.003), VM.metal, 0, 0.018, -0.05 - i * 0.008); // spine jimping
  // guard + handle (rubber over-mold with grip rings) + pommel
  prof(g, [[0.025, -0.024], [0.037, -0.024], [0.037, 0.028], [0.025, 0.028]], 0.02, VM.metal2, 0.002);
  part(g, CT(0.015, 0.013, 0.11), VM.rubber, 0, 0.002, 0.03);
  for (let i = 0; i < 5; i++) part(g, C(0.0158, 0.006), VM.poly, 0, 0.002, -0.005 + i * 0.019);
  part(g, C(0.016, 0.02), VM.metal2, 0, 0.002, 0.095);
  part(g, CT(0.016, 0.011, 0.014), VM.steel, 0, 0.002, 0.111);
  part(g, new THREE.TorusGeometry(0.006, 0.0018, 6, 12), VM.steel, 0, 0.002, 0.12, 0, Math.PI / 2, 0);
  part(g, B(0.004, 0.012, 0.03), VM.accent, 0.0155, 0.002, 0.03);                     // accent inlay
  g.rotation.set(0.35, 0.2, -0.25);
  return {
    group: g, kind: 'melee', bladeTip: point(g, 0, 0.004, -0.235),
    muzzle: point(g, 0, 0.004, -0.235), eject: point(g, 0, 0, 0),
    sightY: 0, hip: new THREE.Vector3(0.15, -0.12, -0.3), adsZ: -0.3,
    grip: new THREE.Vector3(0, -0.01, 0.035), leftRest: new THREE.Vector3(-0.25, -0.5, 0.1),
    flashScale: 0,
  };
}


/* red-dot sight block (same as the rifle's): dot at y .105, z (-.104 + dz) */
function redDot(g, dz = 0) {
  const h = new THREE.Group();
  h.position.z = dz;
  g.add(h);
  part(h, B(0.034, 0.01, 0.06), VM.metal, 0, 0.073, -0.085);
  prof(h, [[0.055, 0.078], [0.115, 0.078], [0.115, 0.084], [0.055, 0.084]], 0.044, VM.poly, 0.002);
  for (const sx of [-1, 1]) prof(h, [[0.06, 0.082], [0.11, 0.082], [0.108, 0.128], [0.064, 0.128]], 0.006, VM.poly, 0.0015, sx * 0.021);
  prof(h, [[0.062, 0.125], [0.11, 0.125], [0.106, 0.132], [0.066, 0.132]], 0.048, VM.poly, 0.0015);
  part(h, C(0.006, 0.01), VM.metal2, 0.027, 0.105, -0.09, 0, Math.PI / 2);
  part(h, B(0.036, 0.036, 0.002), VM.glass, 0, 0.105, -0.105);
  part(h, new THREE.SphereGeometry(0.0022, 8, 6), VM.red, 0, 0.105, -0.104);
  return h;
}

/* ======================= LMG ======================= */
function lmg() {
  const g = new THREE.Group();
  // long receiver with hinged top cover
  prof(g, [[-0.09, 0.0], [0.24, 0.0], [0.24, 0.06], [0.22, 0.068], [-0.08, 0.068], [-0.09, 0.058]], 0.056, VM.metal, 0.004);
  prof(g, [[-0.05, 0.066], [0.2, 0.066], [0.19, 0.08], [-0.04, 0.08]], 0.05, VM.metal2, 0.003);  // feed cover
  part(g, C(0.006, 0.06), VM.steel, 0, 0.07, -0.21, 0, Math.PI / 2);                          // cover hinge
  prof(g, [[-0.08, 0.0], [0.17, 0.0], [0.17, -0.016], [0.12, -0.034], [0.0, -0.03], [-0.08, -0.014]], 0.05, VM.metal2, 0.003);
  part(g, B(0.004, 0.024, 0.08), VM.rubber, 0.0285, 0.036, -0.05);                             // ejection port
  // heavy barrel with perforated shroud
  const sh = part(g, new THREE.CylinderGeometry(0.036, 0.036, 0.3, 10).rotateX(Math.PI / 2), VM.camo, 0, 0.034, -0.38);
  sh.rotation.z = Math.PI / 10;
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) part(g, C(0.007, 0.008), VM.rubber, sx * 0.034, 0.034, -0.27 - i * 0.045, 0, Math.PI / 2);
  part(g, C(0.016, 0.26), VM.metal, 0, 0.034, -0.66);
  for (let i = 0; i < 8; i++) part(g, C(0.02, 0.006, 10), VM.metal2, 0, 0.034, -0.56 - i * 0.025);  // cooling fins
  part(g, CT(0.022, 0.018, 0.07, 10), VM.metal, 0, 0.034, -0.82);                              // flash hider
  for (let i = 0; i < 4; i++) part(g, B(0.005, 0.03, 0.05), VM.rubber, 0, 0.034, -0.82, 0, 0, (i / 4) * Math.PI);
  // carry handle
  part(g, B(0.014, 0.05, 0.014), VM.metal2, 0, 0.09, -0.56);
  part(g, B(0.016, 0.014, 0.12), VM.poly, 0, 0.115, -0.6);
  // folded bipod
  for (const sx of [-1, 1]) {
    part(g, C(0.006, 0.26), VM.metal, sx * 0.018, -0.008, -0.63);
    part(g, B(0.014, 0.01, 0.02), VM.rubber, sx * 0.018, -0.008, -0.5);
  }
  part(g, B(0.05, 0.018, 0.024), VM.metal, 0, 0.012, -0.76);
  rail(g, 0.08, 0.04, -0.17);
  redDot(g, 0.06).position.y = 0.012;
  // stock + grip
  prof(g, [[-0.09, 0.058], [-0.31, 0.046], [-0.32, -0.06], [-0.3, -0.07], [-0.18, -0.03], [-0.09, -0.012]], 0.05, VM.poly, 0.004);
  part(g, B(0.054, 0.12, 0.02), VM.rubber, 0, -0.008, 0.325);
  part(g, B(0.008, 0.04, 0.12), VM.metal2, 0, 0.065, 0.24);                                    // cheek riser
  prof(g, [[-0.004, -0.012], [0.04, -0.012], [0.022, -0.108], [-0.018, -0.11], [-0.014, -0.032]], 0.036, VM.poly, 0.004);
  for (let i = 0; i < 4; i++) part(g, B(0.0375, 0.004, 0.034), VM.rubber, 0, -0.042 - i * 0.017, 0.01 + i * 0.004, -0.3);
  part(g, new THREE.TorusGeometry(0.02, 0.003, 6, 14, Math.PI), VM.metal2, 0, -0.028, -0.03, 0, Math.PI / 2, Math.PI);
  part(g, B(0.005, 0.022, 0.005), VM.steel, 0, -0.037, -0.035, 0.2);
  // box magazine with ammo belt
  const mag = new THREE.Group();
  mag.position.set(0, -0.03, -0.13);
  prof(mag, [[-0.06, 0.0], [0.05, 0.0], [0.06, -0.13], [-0.07, -0.13]], 0.07, VM.camo, 0.004);
  part(mag, B(0.072, 0.012, 0.12), VM.metal2, 0, -0.13, 0.005);
  part(mag, B(0.074, 0.03, 0.04), VM.poly, 0, -0.06, 0.0);                                     // strap
  for (let i = 0; i < 5; i++) part(mag, C(0.0055, 0.03), VM.brass, 0.024, 0.01, -0.03 + i * 0.013, Math.PI / 2, 0, 0);
  g.add(mag);
  return {
    group: g, kind: 'mag', mag,
    muzzle: point(g, 0, 0.034, -0.86), eject: point(g, 0.034, 0.04, -0.05),
    sightY: 0.117, hip: new THREE.Vector3(0.19, -0.21, -0.42), adsZ: -0.2,
    grip: new THREE.Vector3(0, -0.047, 0.012), leftRest: new THREE.Vector3(0, -0.04, -0.4),
    flashScale: 1.15,
  };
}

/* ======================= BURST CARBINE ======================= */
function burst() {
  const g = new THREE.Group();
  // angular polymer upper/lower
  prof(g, [[-0.07, 0.0], [0.2, 0.0], [0.2, 0.054], [0.18, 0.064], [-0.06, 0.064], [-0.075, 0.05]], 0.048, VM.white, 0.005);
  prof(g, [[-0.06, 0.0], [0.15, 0.0], [0.15, -0.014], [0.11, -0.03], [0.0, -0.026], [-0.06, -0.012]], 0.046, VM.poly, 0.003);
  prof(g, [[0.09, -0.02], [0.17, -0.02], [0.175, -0.05], [0.09, -0.05]], 0.044, VM.poly, 0.003);
  part(g, B(0.004, 0.02, 0.06), VM.rubber, 0.0245, 0.036, -0.05);
  part(g, B(0.012, 0.008, 0.02), VM.accent, -0.025, 0.006, 0.02);                              // fire selector (3-burst)
  for (let i = 0; i < 3; i++) part(g, new THREE.SphereGeometry(0.0025, 6, 4), VM.accent, -0.0255, 0.018, 0.03 - i * 0.01);
  // tapered handguard with vents
  prof(g, [[0.07, 0.0], [0.34, 0.006], [0.36, 0.02], [0.36, 0.05], [0.34, 0.06], [0.07, 0.064]], 0.05, VM.white, 0.006);
  for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) part(g, B(0.004, 0.014, 0.022), VM.rubber, sx * 0.025, 0.032, -0.1 - i * 0.045);
  part(g, B(0.052, 0.006, 0.26), VM.metal2, 0, 0.004, -0.2);
  // barrel + compensator
  part(g, C(0.01, 0.12), VM.metal, 0, 0.034, -0.42);
  part(g, B(0.03, 0.03, 0.06), VM.metal, 0, 0.034, -0.5);
  for (let i = 0; i < 2; i++) for (const sx of [-1, 1]) part(g, B(0.004, 0.018, 0.01), VM.rubber, sx * 0.0152, 0.038, -0.49 - i * 0.02);
  rail(g, 0.064, 0.04, -0.33);
  redDot(g, 0.02);
  // stock
  part(g, C(0.015, 0.14), VM.metal, 0, 0.03, 0.13);
  prof(g, [[-0.11, 0.05], [-0.25, 0.04], [-0.255, -0.04], [-0.235, -0.055], [-0.15, -0.02], [-0.11, -0.004]], 0.044, VM.white, 0.005);
  part(g, B(0.046, 0.094, 0.016), VM.rubber, 0, -0.003, 0.262);
  // grip
  prof(g, [[-0.004, -0.01], [0.04, -0.01], [0.022, -0.104], [-0.018, -0.106], [-0.014, -0.03]], 0.034, VM.poly, 0.004);
  part(g, new THREE.TorusGeometry(0.02, 0.003, 6, 14, Math.PI), VM.poly, 0, -0.026, -0.03, 0, Math.PI / 2, Math.PI);
  part(g, B(0.005, 0.022, 0.005), VM.steel, 0, -0.035, -0.035, 0.2);
  // angled foregrip
  prof(g, [[0.2, -0.004], [0.26, -0.004], [0.24, -0.04], [0.21, -0.04]], 0.03, VM.poly, 0.004);
  // charging handle
  const handle = new THREE.Group();
  handle.position.set(0, 0.058, 0.06);
  part(handle, B(0.05, 0.01, 0.014), VM.metal2, 0, 0, 0.012);
  g.add(handle);
  // straight magazine
  const mag = new THREE.Group();
  mag.position.set(0, -0.03, -0.13);
  prof(mag, [[-0.028, 0.0], [0.028, 0.0], [0.04, -0.12], [-0.016, -0.124]], 0.03, VM.poly, 0.003);
  prof(mag, [[-0.018, -0.12], [0.044, -0.116], [0.046, -0.13], [-0.018, -0.134]], 0.034, VM.metal2, 0.002);
  part(mag, new THREE.SphereGeometry(0.0045, 6, 4), VM.brass, 0, 0.004, 0.01);
  g.add(mag);
  return {
    group: g, kind: 'mag', mag, handle,
    muzzle: point(g, 0, 0.034, -0.535), eject: point(g, 0.03, 0.04, -0.05),
    sightY: 0.105, hip: new THREE.Vector3(0.18, -0.2, -0.4), adsZ: -0.2,
    grip: new THREE.Vector3(0, -0.045, 0.012), leftRest: new THREE.Vector3(0, -0.05, -0.23),
    flashScale: 0.9,
  };
}

/* ======================= GRENADE ======================= */
function grenade() {
  const g = new THREE.Group();
  const held = new THREE.Group();   // the grenade in hand (hidden after the throw)
  g.add(held);
  const body = part(held, new THREE.SphereGeometry(0.034, 18, 14), VM.camo, 0, 0.0, 0);
  body.scale.set(1, 1.18, 1);
  for (let i = 0; i < 4; i++) part(held, new THREE.TorusGeometry(0.0345 * Math.cos((i - 1.5) * 0.4), 0.0018, 4, 22), VM.metal2, 0, (i - 1.5) * 0.016, 0, Math.PI / 2, 0, 0);
  part(held, C(0.013, 0.022).rotateX(Math.PI / 2), VM.metal, 0, 0.044, 0);                    // fuse head
  prof(held, [[-0.004, 0.05], [0.012, 0.05], [0.014, 0.028], [0.012, -0.03], [0.004, -0.03], [0.006, 0.042], [-0.004, 0.044]], 0.012, VM.steel, 0.001, 0); // spoon
  const pin = new THREE.Group();
  pin.position.set(0.016, 0.048, 0);
  part(pin, new THREE.TorusGeometry(0.011, 0.0018, 6, 18), VM.steel, 0.008, 0, 0, 0, Math.PI / 2, 0);
  part(pin, B(0.016, 0.003, 0.003), VM.steel, -0.004, 0, 0);
  held.add(pin);
  part(held, B(0.02, 0.006, 0.0012), VM.accent, 0, 0.012, 0.035);                             // marking band
  held.position.set(0, 0.03, -0.02);
  held.scale.setScalar(0.8);
  return {
    group: g, kind: 'grenade', held, pin,
    muzzle: point(g, 0, 0.035, -0.02), eject: point(g, 0, 0, 0),
    sightY: 0, hip: new THREE.Vector3(0.12, -0.1, -0.36), adsZ: -0.3,
    grip: new THREE.Vector3(0, 0, 0), leftRest: new THREE.Vector3(-0.25, -0.5, 0.1),
    flashScale: 0,
  };
}

export const GUN_BUILDERS = { pistol, knife, smg, shotgun, rifle, bow, dmr, sniper, lmg, burst, grenade };

// which skin slot each shared viewmodel material maps to
const SKIN_SLOT = new Map([
  [VM.metal, 'metal'], [VM.metal2, 'metal2'], [VM.poly, 'poly'], [VM.steel, 'steel'], [VM.accent, 'accent'],
  [VM.tan, 'body'], [VM.wood, 'body'], [VM.camo, 'body'], [VM.white, 'body'],
]);

/** Build a weapon model, optionally with a skin id like "aurora_rifle". */
export function buildGun(id, sid = null) {
  const m = GUN_BUILDERS[id]();
  const bundle = skinBundle(sid);
  if (bundle && bundle.weapons.includes(id)) {
    const mats = skinMaterials(bundle.id);
    m.group.traverse((o) => {
      if (!o.isMesh) return;
      const slot = o.material.userData.skinSlot || SKIN_SLOT.get(o.material);
      if (slot && mats[slot]) o.material = mats[slot];
    });
    m.skin = bundle.id;
  }
  if (m.mag) m.magBase = m.mag.position.clone();
  if (m.pump) m.pumpBase = m.pump.position.clone();
  if (m.slide) m.slideBase = m.slide.position.clone();
  if (m.handle) m.handleBase = m.handle.position.clone();
  if (m.bolt) m.boltBase = m.bolt.position.clone();
  m.group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return m;
}

/** First-person legs for sliding (camera space). Each leg extends toward -Z from the hip. */
export function makeLegs(pantsMat) {
  const root = new THREE.Group();
  const legs = [];
  for (const x of [0.12, -0.12]) {
    const hip = new THREE.Group();
    hip.position.set(x, 0, 0);
    part(hip, B(0.17, 0.17, 0.5), pantsMat, 0, 0, -0.25);
    part(hip, B(0.07, 0.1, 0.12), VM.poly, x > 0 ? 0.09 : -0.09, 0, -0.25);   // thigh pocket
    const knee = new THREE.Group();
    knee.position.set(0, 0, -0.5);
    hip.add(knee);
    part(knee, B(0.18, 0.08, 0.12), VM.white, 0, 0.07, -0.02);                // knee pad
    part(knee, B(0.15, 0.15, 0.44), pantsMat, 0, 0, -0.22);
    part(knee, B(0.17, 0.2, 0.14), VM.poly, 0, 0.02, -0.48);                  // boot shaft
    part(knee, B(0.17, 0.09, 0.26), VM.rubber, 0, -0.06, -0.55);              // sole / toe
    part(knee, B(0.175, 0.025, 0.27), VM.metal2, 0, -0.105, -0.55);
    hip.userData.knee = knee;
    root.add(hip);
    legs.push(hip);
  }
  root.userData.legs = legs;
  return root;
}

/** Gloved hand + sleeve forearm extending back toward the camera. side: +1 right, -1 left */
export function makeArm(sleeveMat, side) {
  const g = new THREE.Group();
  part(g, B(0.052, 0.058, 0.088), VM.glove, 0, 0, 0);
  for (let i = 0; i < 4; i++) part(g, B(0.013, 0.024, 0.05), VM.glove2, -side * 0.004 + (i - 1.5) * 0.0135, 0.032, -0.03 + Math.abs(i - 1.5) * 0.004);
  part(g, B(0.05, 0.012, 0.03), VM.glove2, 0, 0.03, 0.02);                                     // knuckle pad
  part(g, B(0.02, 0.022, 0.052), VM.glove, -side * 0.03, 0.012, -0.03, 0, side * 0.5, 0);      // thumb
  part(g, B(0.072, 0.078, 0.46), sleeveMat, side * 0.06, -0.075, 0.24, 0.32, side * 0.25, 0);
  part(g, B(0.08, 0.086, 0.06), VM.poly, side * 0.012, -0.02, 0.05, 0.32, side * 0.25, 0);      // cuff
  part(g, B(0.075, 0.03, 0.08), VM.accent, side * 0.05, -0.04, 0.17, 0.32, side * 0.25, 0);    // sleeve band
  return g;
}

/* ---- weapon icons (rendered once, cached as data URLs) ---- */
/* ---- weapon icons (rendered on demand, cached per weapon+skin as data URLs) ---- */
const iconCache = {};
let iconR = null;
export function getWeaponIcon(id, sid = null) {
  const key = id + '|' + (sid || '');
  if (iconCache[key]) return iconCache[key];
  try {
    const W = 220, H = 90;
    if (!iconR) {
      const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
      r.setSize(W, H, false);
      r.toneMapping = THREE.ACESFilmicToneMapping;
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight('#ffffff', '#445566', 2.2));
      const d = new THREE.DirectionalLight('#ffffff', 2.5);
      d.position.set(1, 2, 2);
      scene.add(d);
      const cam = new THREE.OrthographicCamera(-1, 1, 0.4, -0.4, 0.01, 10);
      cam.position.set(2, 0, 0);
      cam.lookAt(0, 0, 0);
      iconR = { r, scene, cam };
    }
    const { r, scene, cam } = iconR;
    const m = buildGun(id, sid);
    const box = new THREE.Box3().setFromObject(m.group);
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    m.group.position.sub(center);
    const half = Math.max(size.z / 2 / (W / H), size.y / 2) * 1.08;
    cam.left = -half * (W / H); cam.right = half * (W / H); cam.top = half; cam.bottom = -half;
    cam.updateProjectionMatrix();
    scene.add(m.group);
    r.render(scene, cam);
    iconCache[key] = r.domElement.toDataURL();
    scene.remove(m.group);
    m.group.traverse((o) => o.isMesh && o.geometry.dispose());
  } catch (e) {
    console.warn('icon render failed', e);
    iconCache[key] = '';
  }
  return iconCache[key];
}

/** base (no skin) icons for every weapon */
export function getWeaponIcons() {
  const out = {};
  for (const id of Object.keys(GUN_BUILDERS)) out[id] = getWeaponIcon(id);
  return out;
}
