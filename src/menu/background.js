import * as THREE from 'three';
import { mulberry32, fbm } from '../util/noise.js';
import {
  FOG_COLOR, makeSky, makeEnvironment, createCliffGeometry, updateCliff, cliffMaterial,
  makeCrystalCluster, makeIceRock, makeSnow, applySkyTheme,
} from '../world/canyonParts.js';
import { THEMES, makeTree, makeMushroom, makeBush, makeFlowers, makeHive, makeHiveBox } from '../world/themes.js';

const CHUNK_LEN = 80;
const CHUNKS = 7;
const SPEED = 9;

const riverMat = new THREE.MeshStandardMaterial({ color: '#8ccbec', roughness: 0.06, metalness: 0.15 });
const bankMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });

/** Animated ice-canyon fly-through used behind the main menu. */
export class MenuBackground {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(FOG_COLOR, 50, 420);
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 2500);
    this.t = 0;
    this.theme = THEMES.ice;

    this.sky = makeSky(this.theme);
    this.scene.add(this.sky);
    this.scene.environment = makeEnvironment(renderer, this.theme);
    this.scene.environmentIntensity = 0.7;

    this.hemi = new THREE.HemisphereLight('#cfe6ff', '#2a3d5c', 1.1);
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight('#ffd2b0', 2.4);
    sun.position.set(-40, 60, -120);
    this.sun = sun;
    this.scene.add(sun, sun.target);

    this.chunks = [];
    for (let i = 0; i < CHUNKS; i++) {
      const c = this.createChunk();
      this.buildChunk(c, i);
      this.chunks.push(c);
    }

    this.snow = makeSnow(2600, 55);
    this.scene.add(this.snow);
  }

  /** switch the whole fly-through to another map theme (ice / forest / honey) */
  setTheme(id) {
    const T = THEMES[id] || THEMES.ice;
    if (T === this.theme) return;
    this.theme = T;
    applySkyTheme(this.sky, T);
    this.scene.fog.color.set(T.fog);
    this.scene.fog.near = Math.max(30, T.fogNear - 20);
    this.scene.fog.far = T.fogFar + 40;
    this.hemi.color.set(T.hemi[0]); this.hemi.groundColor.set(T.hemi[1]); this.hemi.intensity = T.hemi[2] * 0.95;
    this.sun.color.set(T.sun[0]); this.sun.intensity = T.sun[1] * 0.92;
    const old = this.scene.environment;
    this.scene.environment = makeEnvironment(this.renderer, T);
    old?.dispose();
    riverMat.color.set(T.river); riverMat.roughness = T.riverRough;
    for (const c of this.chunks) { c.left.material.roughness = T.cliffRough; this.buildChunk(c, c.index); }
    this.scene.remove(this.snow);
    this.snow.geometry.dispose();
    this.snow = makeSnow(Math.round(T.particles.count * 1.2), 55, T.particles);
    this.scene.add(this.snow);
  }

  createChunk() {
    const group = new THREE.Group();
    const mat = cliffMaterial();
    const left = new THREE.Mesh(createCliffGeometry(), mat);
    const right = new THREE.Mesh(createCliffGeometry(), mat);
    const bankGeo = new THREE.PlaneGeometry(130, CHUNK_LEN, 40, 24);
    bankGeo.rotateX(-Math.PI / 2);
    bankGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(bankGeo.attributes.position.count * 3), 3));
    const bank = new THREE.Mesh(bankGeo, bankMat);
    const river = new THREE.Mesh(new THREE.PlaneGeometry(20, CHUNK_LEN), riverMat);
    river.rotation.x = -Math.PI / 2;
    river.position.y = 0.05;
    const props = new THREE.Group();
    group.add(left, right, bank, river, props);
    this.scene.add(group);
    return { group, left, right, bank, river, props, index: 0 };
  }

  buildChunk(c, index) {
    c.index = index;
    const z0 = -index * CHUNK_LEN;
    const T = this.theme || THEMES.ice;
    const opts = { z0, len: CHUNK_LEN, baseX: 24, height: 70, seed: 7, notch: 14, colors: T.id === 'ice' ? null : T.cliff };
    updateCliff(c.left.geometry, { ...opts, side: -1 });
    updateCliff(c.right.geometry, { ...opts, side: 1, seed: 13 });

    // Snow banks rising toward the cliffs
    const p = c.bank.geometry.attributes.position;
    const col = c.bank.geometry.attributes.color;
    const snow = new THREE.Color(T.bank[1]), blue = new THREE.Color(T.bank[0]), tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const zl = p.getZ(i);
      const zw = z0 - CHUNK_LEN / 2 + zl;
      const ax = Math.abs(x);
      const n = fbm(x * 0.08, zw * 0.08, 3, 3);
      const y = ax < 10 ? -0.2 : THREE.MathUtils.smoothstep(ax, 10, 34) * 5 + n * 0.8 * THREE.MathUtils.smoothstep(ax, 10, 16);
      p.setY(i, y);
      tmp.copy(blue).lerp(snow, THREE.MathUtils.clamp(0.5 + n + (ax - 10) * 0.05, 0, 1));
      col.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    p.needsUpdate = true; col.needsUpdate = true;
    c.bank.geometry.computeVertexNormals();
    c.bank.position.set(0, 0, z0 - CHUNK_LEN / 2);
    c.river.position.z = z0 - CHUNK_LEN / 2;

    // Props
    c.props.children.slice().forEach((o) => {
      c.props.remove(o);
      o.traverse((m) => { if (m.isMesh && !(m.geometry.type === 'CylinderGeometry' && m.geometry.parameters.radiusTop === 0 && m.geometry.parameters.radialSegments === 6)) m.geometry.dispose(); });
    });
    const rng = mulberry32(index * 7919 + 3);
    const prop = (s) => T.prop === 'tree' ? (rng() < 0.6 ? makeTree(rng, s * 1.1) : rng() < 0.5 ? makeMushroom(rng, s * 1.4) : makeBush(rng, s))
      : T.prop === 'flower' ? (rng() < 0.65 ? makeFlowers(rng, s * 1.6) : makeHiveBox(rng, s))
      : makeCrystalCluster(rng, s);
    for (let i = 0; i < 9; i++) {
      const side = rng() < 0.5 ? -1 : 1;
      const cl = prop(1 + rng() * 1.8);
      cl.position.set(side * (12 + rng() * 12), 0, z0 - rng() * CHUNK_LEN);
      c.props.add(cl);
    }
    const rockMat = T.id === 'ice' ? undefined : (this._rockMats ||= {})[T.id] ||= new THREE.MeshStandardMaterial({ color: T.rock, roughness: 0.85, flatShading: true });
    for (let i = 0; i < 5; i++) {
      const s = 1.5 + rng() * 3.5;
      const rock = makeIceRock(rng, s, s * (0.6 + rng() * 0.6), s, rockMat);
      const side = rng() < 0.5 ? -1 : 1;
      rock.position.set(side * (9 + rng() * 14), 0.2, z0 - rng() * CHUNK_LEN);
      rock.rotation.y = rng() * Math.PI;
      c.props.add(rock);
    }
    // Occasional ice pillar on the frozen river
    if (rng() < 0.6) {
      const pil = T.pillar === 'tree' ? makeTree(rng, 2.4) : T.pillar === 'hive' ? makeHive(rng, 1.2) : makeIceRock(rng, 1.4, 9 + rng() * 6, 1.4);
      pil.position.set((rng() - 0.5) * 8, 0, z0 - rng() * CHUNK_LEN);
      c.props.add(pil);
      const cl = prop(1.5);
      cl.position.copy(pil.position).add(new THREE.Vector3(1.5, 0, 0.5));
      c.props.add(cl);
    }
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    const z = -t * SPEED;
    const cam = this.camera;
    cam.position.set(Math.sin(t * 0.07) * 5, 7 + Math.sin(t * 0.11) * 2.5, z);
    cam.lookAt(Math.sin((t + 3) * 0.07) * 5, 5.5 + Math.sin((t + 3) * 0.11) * 2, z - 30);
    cam.rotation.z += Math.sin(t * 0.09) * 0.03;

    for (const c of this.chunks) {
      const chunkStart = -c.index * CHUNK_LEN;
      if (chunkStart - CHUNK_LEN > z + 20) this.buildChunk(c, c.index + CHUNKS);
    }

    this.sky.position.copy(cam.position);
    this.sky.material.uniforms.uTime.value = t;
    this.sun.position.set(cam.position.x - 40, 60, cam.position.z - 120);
    this.sun.target.position.set(cam.position.x, 0, cam.position.z - 20);
    this.snow.userData.update(dt, cam.position);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
