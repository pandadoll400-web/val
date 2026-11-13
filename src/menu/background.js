import * as THREE from 'three';
import { mulberry32, fbm } from '../util/noise.js';
import {
  FOG_COLOR, makeSky, makeEnvironment, createCliffGeometry, updateCliff, cliffMaterial,
  makeCrystalCluster, makeIceRock, makeSnow,
} from '../world/canyonParts.js';

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

    this.sky = makeSky();
    this.scene.add(this.sky);
    this.scene.environment = makeEnvironment(renderer);
    this.scene.environmentIntensity = 0.7;

    this.scene.add(new THREE.HemisphereLight('#cfe6ff', '#2a3d5c', 1.1));
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
    const opts = { z0, len: CHUNK_LEN, baseX: 24, height: 70, seed: 7, notch: 14 };
    updateCliff(c.left.geometry, { ...opts, side: -1 });
    updateCliff(c.right.geometry, { ...opts, side: 1, seed: 13 });

    // Snow banks rising toward the cliffs
    const p = c.bank.geometry.attributes.position;
    const col = c.bank.geometry.attributes.color;
    const snow = new THREE.Color('#eef6ff'), blue = new THREE.Color('#a9cfe8'), tmp = new THREE.Color();
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
      o.traverse((m) => { if (m.isMesh && m.geometry.type === 'IcosahedronGeometry') m.geometry.dispose(); });
    });
    const rng = mulberry32(index * 7919 + 3);
    for (let i = 0; i < 9; i++) {
      const side = rng() < 0.5 ? -1 : 1;
      const cl = makeCrystalCluster(rng, 1 + rng() * 1.8);
      cl.position.set(side * (12 + rng() * 12), 0, z0 - rng() * CHUNK_LEN);
      c.props.add(cl);
    }
    for (let i = 0; i < 5; i++) {
      const s = 1.5 + rng() * 3.5;
      const rock = makeIceRock(rng, s, s * (0.6 + rng() * 0.6), s);
      const side = rng() < 0.5 ? -1 : 1;
      rock.position.set(side * (9 + rng() * 14), 0.2, z0 - rng() * CHUNK_LEN);
      rock.rotation.y = rng() * Math.PI;
      c.props.add(rock);
    }
    // Occasional ice pillar on the frozen river
    if (rng() < 0.6) {
      const pil = makeIceRock(rng, 1.4, 9 + rng() * 6, 1.4);
      pil.position.set((rng() - 0.5) * 8, 0, z0 - rng() * CHUNK_LEN);
      c.props.add(pil);
      const cl = makeCrystalCluster(rng, 1.5);
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
