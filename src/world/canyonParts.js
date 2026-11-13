import * as THREE from 'three';
import { fbm, mulberry32 } from '../util/noise.js';

export const FOG_COLOR = 0x9eb3d9;

/* ---------------- Sky (gradient + low sun + aurora + stars) ---------------- */
const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const skyFrag = /* glsl */ `
uniform float uTime;
varying vec3 vDir;
float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 horizon = vec3(0.62, 0.70, 0.85);
  vec3 warm    = vec3(0.98, 0.66, 0.52);
  vec3 mid     = vec3(0.32, 0.38, 0.66);
  vec3 top     = vec3(0.04, 0.07, 0.18);
  vec3 sunDir = normalize(vec3(0.25, 0.06, -1.0));
  float s = max(dot(d, sunDir), 0.0);
  vec3 col = mix(horizon, mid, smoothstep(0.02, 0.3, h));
  col = mix(col, top, smoothstep(0.3, 0.85, h));
  col = mix(col, warm, pow(s, 6.0) * (1.0 - smoothstep(0.0, 0.35, h)) * 0.8);
  col += vec3(1.0, 0.85, 0.7) * pow(s, 400.0) * 1.5;

  float a = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float w = sin(d.x * 2.5 + fi * 2.1 + uTime * 0.12 + sin(d.z * 3.0 + uTime * 0.17 + fi) * 1.2);
    float y = 0.38 + fi * 0.09 + w * 0.07;
    float band = exp(-pow((h - y) * 14.0, 2.0));
    float rays = 0.55 + 0.45 * sin(d.x * 28.0 + d.z * 9.0 + uTime * 0.5 + fi * 4.0);
    a += band * rays;
  }
  vec3 aur = mix(vec3(0.15, 1.0, 0.65), vec3(0.45, 0.4, 1.0), smoothstep(0.4, 0.65, h));
  col += aur * a * 0.32 * smoothstep(0.12, 0.35, h);

  vec3 cell = floor(d * 260.0);
  float st = step(0.9975, hash(cell)) * smoothstep(0.25, 0.7, h);
  col += vec3(st) * (0.6 + 0.4 * sin(uTime * 3.0 + hash(cell + 7.0) * 30.0));

  if (h < 0.0) col = mix(horizon, horizon * 0.8, smoothstep(0.0, -0.3, h));
  gl_FragColor = vec4(col, 1.0);
}`;

export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: skyVert, fragmentShader: skyFrag,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

export function makeEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const s = new THREE.Scene();
  s.add(makeSky());
  const tex = pmrem.fromScene(s, 0, 0.1, 2000).texture;
  pmrem.dispose();
  return tex;
}

/* ---------------- Canvas textures ---------------- */
export function makeGlowTexture(size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------------- Cliff walls ---------------- */
const C_DEEP = new THREE.Color('#2a6c9c');
const C_ICE = new THREE.Color('#9fd6f2');
const C_SNOW = new THREE.Color('#f3f8ff');
const tmpC = new THREE.Color();

export function createCliffGeometry(segL = 64, segH = 26) {
  const geo = new THREE.BufferGeometry();
  const count = (segL + 1) * (segH + 1);
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const idx = [];
  for (let i = 0; i < segL; i++) {
    for (let j = 0; j < segH; j++) {
      const a = i * (segH + 1) + j, b = (i + 1) * (segH + 1) + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  geo.setIndex(idx);
  geo.userData = { segL, segH };
  return geo;
}

/**
 * Fill cliff geometry. Cliff runs from z0 to z0 - len along -Z, at x = side * (baseX + offsets).
 * Offsets are always >= 0 so the wall never intrudes past baseX (keeps collision simple).
 */
export function updateCliff(geo, { z0, len, side, baseX, height, seed = 1, notch = 0 }) {
  const { segL, segH } = geo.userData;
  const pos = geo.attributes.position.array;
  const col = geo.attributes.color.array;
  let k = 0;
  for (let i = 0; i <= segL; i++) {
    const z = z0 - (i / segL) * len;
    const widen = notch ? Math.max(0, fbm(z * 0.012, 3.3, seed + 9, 2)) * notch : 0;
    for (let j = 0; j <= segH; j++) {
      const t = j / segH;
      const y = -4 + t * (height + 4);
      const n1 = fbm(z * 0.03, y * 0.05, seed, 4);
      const n2 = fbm(z * 0.12, y * 0.16, seed + 50, 3);
      const strata = Math.sin(y * 0.9 + n1 * 3) * 0.5 + 0.5;
      const lean = Math.pow(t, 1.6) * 14;
      const off = lean + (n1 + 1) * 3.6 + (n2 + 1) * 0.9 + strata * 0.7 + widen;
      pos[k] = side * (baseX + off);
      pos[k + 1] = y;
      pos[k + 2] = z;

      tmpC.copy(C_DEEP).lerp(C_ICE, THREE.MathUtils.smoothstep(n2 + t * 0.7, -0.4, 0.55));
      const snow = THREE.MathUtils.clamp(
        THREE.MathUtils.smoothstep(t + n1 * 0.25, 0.62, 0.82) + (strata > 0.85 ? 0.35 : 0), 0, 1);
      tmpC.lerp(C_SNOW, snow);
      col[k] = tmpC.r; col[k + 1] = tmpC.g; col[k + 2] = tmpC.b;
      k += 3;
    }
  }
  geo.attributes.position.needsUpdate = true;
  geo.attributes.color.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
}

export const cliffMaterial = () => new THREE.MeshStandardMaterial({
  vertexColors: true, roughness: 0.32, metalness: 0.05, flatShading: true, side: THREE.DoubleSide,
});

/* ---------------- Props ---------------- */
const crystalMat = new THREE.MeshStandardMaterial({
  color: '#8fe4ff', emissive: '#1f8fe0', emissiveIntensity: 0.9, roughness: 0.08, metalness: 0.1,
  transparent: true, opacity: 0.88, flatShading: true,
});
const crystalGeo = new THREE.CylinderGeometry(0, 1, 1, 6, 1);
crystalGeo.translate(0, 0.5, 0);

export function makeCrystalCluster(rng, scale = 1) {
  const g = new THREE.Group();
  const n = 3 + Math.floor(rng() * 5);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(crystalGeo, crystalMat);
    const h = (0.8 + rng() * 2.6) * scale;
    const r = (0.12 + rng() * 0.22) * scale;
    m.scale.set(r, h, r);
    m.position.set((rng() - 0.5) * scale * 1.2, 0, (rng() - 0.5) * scale * 1.2);
    m.rotation.set((rng() - 0.5) * 0.9, rng() * Math.PI, (rng() - 0.5) * 0.9);
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

const rockMat = new THREE.MeshStandardMaterial({ color: '#cfe8f7', roughness: 0.4, metalness: 0.05, flatShading: true });
export function makeIceRock(rng, sx, sy, sz, mat = rockMat) {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const p = geo.attributes.position;
  const seed = Math.floor(rng() * 1000);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 1 + fbm(x * 1.3 + z * 0.9 + seed, y * 1.3 - z * 0.4, seed, 3) * 0.35;
    p.setXYZ(i, x * n * sx, Math.max(y * n, -0.3) * sy, z * n * sz);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* ---------------- Snow particles ---------------- */
export function makeSnow(count = 2500, range = 60) {
  const pos = new Float32Array(count * 3);
  const rng = mulberry32(42);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rng() - 0.5) * range * 2;
    pos[i * 3 + 1] = rng() * 40;
    pos[i * 3 + 2] = (rng() - 0.5) * range * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.16, map: makeGlowTexture(32), transparent: true, depthWrite: false, opacity: 0.9, color: '#ffffff',
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  let t = 0;
  pts.userData.update = (dt, center) => {
    t += dt;
    const a = geo.attributes.position.array;
    for (let i = 0; i < count; i++) {
      const k = i * 3;
      a[k + 1] -= dt * (1.2 + (i % 7) * 0.15);
      a[k] += Math.sin(t * 0.7 + i) * dt * 0.4 + dt * 0.6;
      // wrap around the center
      if (a[k + 1] < center.y - 8) a[k + 1] += 40;
      const dx = a[k] - center.x, dz = a[k + 2] - center.z;
      if (dx > range) a[k] -= range * 2; else if (dx < -range) a[k] += range * 2;
      if (dz > range) a[k + 2] -= range * 2; else if (dz < -range) a[k + 2] += range * 2;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return pts;
}
