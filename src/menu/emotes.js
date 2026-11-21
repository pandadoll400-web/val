import * as THREE from 'three';
import { makeBike } from '../game/remotePlayer.js';
import { IDLE_POSE, blendPose, setPose } from '../game/soldier.js';
import { makeGlowTexture } from '../world/canyonParts.js';

const glowTex = makeGlowTexture(64);
const glowSprite = (color, size) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  s.scale.setScalar(size);
  return s;
};
const addMat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

// Reusable poses
const CROSS_ARMS = { shL: [0.55, -1.15, 0], elL: [1.95, 0, 0], shR: [0.6, 1.15, 0], elR: [1.95, 0, 0] };
const FINGER_GUN = { shR: [1.5, 0.1, 0.05], elR: [0.05, 0, 0] };

/*
 * Emote definition:
 *  line/lang/pitch/rate — voice line (speech bubble + browser TTS)
 *  dur — seconds; view — preview turntable angle while playing
 *  keys — [time, pose(partial), root{x,y,z,rx,ry,rz}] ; root moves the whole character (camera space: +x = screen right)
 *  setup(ctx) creates props; update(ctx, t, dt) animates them
 */
export const EMOTES = {
  rookie: {
    line: "Rookie's time~?", lang: 'en-US', pitch: 1.25, rate: 1.0, speakAt: 1.2, dur: 5.2, view: 0.55,
    keys: [
      [0, {}, {}],
      [0.55, { legL: [0.35, 0, 0], knL: [-0.5, 0, 0], torso: [0, 0.15, 0] }, { x: 0.15 }],
      [1.1, { ...CROSS_ARMS, legR: [0.1, 0, -0.32], knR: [-0.12, 0, 0], legL: [0, 0, 0.1], neck: [0.05, 0.4, 0.15], torso: [0, 0.1, 0] }, { x: 0.3, rz: -0.17 }],
      [2.3, { ...CROSS_ARMS, legR: [0.1, 0, -0.32], knR: [-0.12, 0, 0], legL: [0, 0, 0.1], neck: [-0.08, 0.3, 0.2], torso: [0, 0.1, 0] }, { x: 0.3, rz: -0.17 }],
      [2.8, { ...FINGER_GUN, shL: [0.3, -1.1, 0], elL: [1.9, 0, 0], legR: [0.1, 0, -0.32], knR: [-0.12, 0, 0], legL: [0, 0, 0.1], neck: [0.05, 0.1, 0.25], torso: [0, -0.15, 0] }, { x: 0.3, rz: -0.17 }],
      [3.05, { ...FINGER_GUN, shR: [1.85, 0.1, 0.05], shL: [0.3, -1.1, 0], elL: [1.9, 0, 0], legR: [0.1, 0, -0.32], knR: [-0.12, 0, 0], legL: [0, 0, 0.1], neck: [0.05, 0.1, 0.25], torso: [0, -0.15, 0] }, { x: 0.3, rz: -0.17 }],
      [3.35, { ...FINGER_GUN, shL: [0.3, -1.1, 0], elL: [1.9, 0, 0], legR: [0.1, 0, -0.32], knR: [-0.12, 0, 0], legL: [0, 0, 0.1], neck: [0.05, 0.1, 0.25], torso: [0, -0.15, 0] }, { x: 0.3, rz: -0.17 }],
      [4.4, { ...FINGER_GUN, shL: [0.3, -1.1, 0], elL: [1.9, 0, 0], legR: [0.1, 0, -0.32], knR: [-0.12, 0, 0], legL: [0, 0, 0.1], neck: [0.05, 0.1, 0.25], torso: [0, -0.15, 0] }, { x: 0.3, rz: -0.17 }],
      [5.2, {}, {}],
    ],
    setup(ctx) {
      const wall = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: '#b9dcf0', roughness: 0.2, flatShading: true, transparent: true, opacity: 0 });
      const slab = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.6, 1.6, 2, 6, 4), mat);
      const pa = slab.geometry.attributes.position;
      for (let i = 0; i < pa.count; i++) if (pa.getX(i) > 0) pa.setX(i, pa.getX(i) + Math.random() * 0.08);
      slab.geometry.computeVertexNormals();
      slab.position.set(1.0, 1.3, -0.1);
      wall.add(slab);
      ctx.actorParent.add(wall);
      ctx.props.push(wall);
      ctx.wallMat = mat;
      ctx.flash = glowSprite('#ffe27a', 0.01);
      ctx.model.joints.handR.add(ctx.flash);
      ctx.flash.position.set(0, -0.12, 0);
      ctx.props.push(ctx.flash);
    },
    update(ctx, t) {
      ctx.wallMat.opacity = Math.min(1, t / 0.5) * (t > 4.8 ? Math.max(0, (5.2 - t) / 0.4) : 1);
      const f = t > 3.0 && t < 3.25 ? 1 - Math.abs(t - 3.12) / 0.13 : 0;
      ctx.flash.scale.setScalar(0.01 + f * 0.35);
    },
  },

  frost: {
    line: '얼어붙을 준비는 됐나?', lang: 'ko-KR', pitch: 0.75, rate: 0.95, speakAt: 0.5, dur: 4.4, view: -0.25,
    keys: [
      [0, {}, {}],
      [0.45, { shR: [1.15, 0, 0.15], elR: [0.95, 0, 0], neck: [0.3, 0, 0], torso: [0.05, 0.15, 0] }, {}],
      [1.7, { shR: [1.15, 0, 0.15], elR: [0.95, 0, 0], neck: [0.05, 0.1, 0], torso: [0.05, 0.15, 0] }, {}],
      [2.1, { shR: [1.25, 0, 0.1], elR: [1.45, 0, 0], neck: [0, 0, 0], torso: [0, -0.1, 0] }, {}],
      [2.3, { shR: [1.2, 0, 0.1], elR: [1.5, 0, 0], torso: [0, -0.1, 0] }, { y: -0.03 }],
      [2.9, { ...CROSS_ARMS, neck: [-0.05, 0, 0] }, {}],
      [3.8, { ...CROSS_ARMS, neck: [-0.05, 0, 0] }, {}],
      [4.4, {}, {}],
    ],
    setup(ctx) {
      const crystal = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: '#bff0ff', emissive: '#2aa8ff', emissiveIntensity: 1.2, roughness: 0.05, transparent: true, opacity: 0.9, flatShading: true });
      for (let i = 0; i < 7; i++) {
        const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), mat);
        c.scale.set(0.5, 1.6 + Math.random(), 0.5);
        c.rotation.set((Math.random() - 0.5) * 1.6, Math.random() * 3, (Math.random() - 0.5) * 1.6);
        crystal.add(c);
      }
      crystal.add(glowSprite('#7fdcff', 0.5));
      crystal.position.set(0, -0.12, -0.1);
      crystal.scale.setScalar(0.01);
      ctx.model.joints.handR.add(crystal);
      ctx.crystal = crystal;
      ctx.props.push(crystal);
      ctx.shards = [];
      ctx.light = new THREE.PointLight('#5fc9ff', 0, 3);
      ctx.model.joints.handR.add(ctx.light);
      ctx.props.push(ctx.light);
    },
    update(ctx, t, dt) {
      const grow = Math.min(1, Math.max(0, (t - 0.45) / 1.0));
      ctx.crystal.visible = t < 2.2;
      ctx.crystal.scale.setScalar(0.01 + grow * (1 + Math.sin(t * 8) * 0.05));
      ctx.crystal.rotation.y += dt * 3;
      ctx.light.intensity = t < 2.2 ? grow * 3 : Math.max(0, 3 - (t - 2.2) * 6);
      if (t >= 2.2 && !ctx.shattered) {
        ctx.shattered = true;
        const origin = new THREE.Vector3();
        ctx.crystal.getWorldPosition(origin);
        ctx.actorParent.worldToLocal(origin);
        for (let i = 0; i < 26; i++) {
          const s = new THREE.Mesh(new THREE.TetrahedronGeometry(0.03 + Math.random() * 0.03), addMat('#bff0ff'));
          s.position.copy(origin);
          s.userData.v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.3).normalize().multiplyScalar(1.5 + Math.random() * 2);
          ctx.actorParent.add(s);
          ctx.props.push(s);
          ctx.shards.push(s);
        }
      }
      for (const s of ctx.shards) {
        s.userData.v.y -= 6 * dt;
        s.position.addScaledVector(s.userData.v, dt);
        s.rotation.x += dt * 8;
        s.material.opacity = Math.max(0, 1 - (t - 2.2) / 1.2);
      }
    },
  },

  blaze: {
    line: '전부 태워주지!', lang: 'ko-KR', pitch: 0.85, rate: 1.1, speakAt: 0.6, dur: 4.0, view: -0.2,
    keys: [
      [0, {}, {}],
      [0.35, { shR: [0.5, 0, 0.55], elR: [1.7, 0, 0], torso: [0, 0.35, 0], shL: [1.0, 0.7, 0], elL: [0.7, 0, 0] }, {}],
      [0.6, { shR: [1.35, -0.45, 0], elR: [0.4, 0, 0], torso: [0, -0.25, 0], shL: [1.25, 0.65, 0], elL: [0.75, 0, 0] }, { y: -0.03 }],
      [1.2, { shR: [1.35, -0.45, 0], elR: [0.4, 0, 0], torso: [0, -0.25, 0], shL: [1.25, 0.65, 0], elL: [0.75, 0, 0] }, {}],
      [1.6, { shL: [0, 0, -1.5], elL: [0, 0, -1.6], shR: [0, 0, 1.5], elR: [0, 0, 1.6], torso: [-0.08, 0, 0], neck: [-0.15, 0, 0], legL: [0, 0, -0.12], legR: [0, 0, 0.12] }, { y: -0.04 }],
      [3.2, { shL: [0, 0, -1.5], elL: [0, 0, -1.75], shR: [0, 0, 1.5], elR: [0, 0, 1.75], torso: [-0.08, 0, 0], neck: [-0.15, 0, 0], legL: [0, 0, -0.12], legR: [0, 0, 0.12] }, { y: -0.04 }],
      [4.0, {}, {}],
    ],
    setup(ctx) {
      ctx.flames = [];
      for (const hand of [ctx.model.joints.handL, ctx.model.joints.handR]) {
        const g = new THREE.Group();
        g.position.set(0, -0.05, 0);
        for (let i = 0; i < 6; i++) {
          const s = glowSprite(i % 2 ? '#ff7a2a' : '#ffd25a', 0.2);
          s.userData.ph = Math.random() * 10;
          g.add(s);
          ctx.flames.push(s);
        }
        hand.add(g);
        ctx.props.push(g);
      }
      ctx.light = new THREE.PointLight('#ff7a2a', 0, 4);
      ctx.light.position.set(0, 1.6, -0.5);
      ctx.actorParent.add(ctx.light);
      ctx.props.push(ctx.light);
    },
    update(ctx, t, dt) {
      const on = t > 0.6 ? Math.min(1, (t - 0.6) * 3) * (t > 3.4 ? Math.max(0, (4 - t) / 0.6) : 1) : 0;
      const big = t > 1.6 && t < 3.4 ? 1.6 : 1;
      for (const s of ctx.flames) {
        s.userData.ph += dt * 10;
        s.position.set(Math.sin(s.userData.ph) * 0.03, 0.05 + ((s.userData.ph * 0.15) % 0.25), Math.cos(s.userData.ph * 1.3) * 0.03);
        s.scale.setScalar((0.12 + Math.sin(s.userData.ph * 2) * 0.04) * on * big);
      }
      ctx.light.intensity = on * (3 + Math.random() * 2) * big;
    },
  },

  shadow: {
    line: '...내 그림자를 밟지 마.', lang: 'ko-KR', pitch: 0.6, rate: 0.85, speakAt: 2.0, dur: 4.6, view: -0.3,
    keys: [
      [0, {}, {}],
      [0.4, { hipY: -0.32, legL: [1.0, 0, 0], knL: [-1.7, 0, 0], legR: [0.45, 0, -0.15], knR: [-1.3, 0, 0], torso: [0.45, 0, 0], neck: [-0.4, 0, 0], shR: [0.9, 0, 0.3], elR: [0.6, 0, 0], shL: [0.4, 0, -0.3], elL: [0.8, 0, 0] }, {}],
      [1.4, { hipY: -0.32, legL: [1.0, 0, 0], knL: [-1.7, 0, 0], legR: [0.45, 0, -0.15], knR: [-1.3, 0, 0], torso: [0.45, 0, 0], neck: [-0.4, 0, 0], shR: [0.9, 0, 0.3], elR: [0.6, 0, 0], shL: [0.4, 0, -0.3], elL: [0.8, 0, 0] }, {}],
      [1.45, { ...CROSS_ARMS, neck: [0.4, 0, 0] }, { x: -0.35, ry: 0.3 }],
      [2.9, { ...CROSS_ARMS, neck: [0.35, 0, 0.05] }, { x: -0.35, ry: 0.3 }],
      [3.5, { ...CROSS_ARMS, neck: [-0.05, -0.2, 0] }, { x: -0.35, ry: 0.3 }],
      [4.0, { ...CROSS_ARMS, neck: [-0.05, -0.2, 0] }, { x: -0.35, ry: 0.3 }],
      [4.6, {}, {}],
    ],
    setup(ctx) {
      ctx.smoke = [];
      for (let i = 0; i < 18; i++) {
        const s = glowSprite(i % 2 ? '#5a2bd8' : '#2a1060', 0.01);
        s.material.blending = THREE.NormalBlending;
        s.userData.p = new THREE.Vector3((Math.random() - 0.5) * 0.8, Math.random() * 1.6, (Math.random() - 0.5) * 0.6);
        ctx.actorParent.add(s);
        ctx.props.push(s);
        ctx.smoke.push(s);
      }
      for (const m of ctx.model.allMaterials) { m.transparent = true; m.needsUpdate = true; }
    },
    update(ctx, t) {
      let op = 1;
      if (t > 0.8 && t < 1.45) op = 1 - (t - 0.8) / 0.55;
      else if (t >= 1.45 && t < 2.0) op = (t - 1.45) / 0.55;
      for (const m of ctx.model.allMaterials) m.opacity = Math.max(0, op);
      const puffs = [[0.8, 0], [1.45, -0.35]];
      ctx.smoke.forEach((s, i) => {
        const [t0, x] = puffs[i % 2];
        const k = (t - t0) / 1.2;
        const vis = k > 0 && k < 1;
        s.visible = vis;
        if (!vis) return;
        s.position.set(x + s.userData.p.x * (1 + k), s.userData.p.y + k * 0.4, s.userData.p.z);
        s.scale.setScalar(0.5 + k * 0.6);
        s.material.opacity = (1 - k) * 0.8;
      });
    },
    cleanup(ctx) {
      for (const m of ctx.model.allMaterials) { m.opacity = 1; m.transparent = false; m.needsUpdate = true; }
    },
  },

  volt: {
    line: '전압 최대! 짜릿하지?', lang: 'ko-KR', pitch: 1.35, rate: 1.15, speakAt: 0.7, dur: 4.0, view: -0.25,
    keys: [
      [0, {}, {}],
      [0.4, { shR: [3.0, 0, 0.12], elR: [0.1, 0, 0], shL: [0.15, 0, -0.45], elL: [1.3, 0, 0], neck: [-0.35, 0, 0], torso: [-0.1, 0, 0], legL: [0, 0, -0.1], legR: [0, 0, 0.1] }, {}],
      [1.7, { shR: [3.0, 0, 0.12], elR: [0.1, 0, 0], shL: [0.15, 0, -0.45], elL: [1.3, 0, 0], neck: [-0.3, 0, 0], torso: [-0.1, 0, 0], legL: [0, 0, -0.1], legR: [0, 0, 0.1] }, { y: 0.03 }],
      [2.2, { ...FINGER_GUN, shL: [0.15, 0, -0.45], elL: [1.3, 0, 0], torso: [0, -0.2, 0], neck: [0, 0.15, 0.1] }, {}],
      [3.4, { ...FINGER_GUN, shL: [0.15, 0, -0.45], elL: [1.3, 0, 0], torso: [0, -0.2, 0], neck: [0, 0.15, 0.1] }, {}],
      [4.0, {}, {}],
    ],
    setup(ctx) {
      ctx.bolts = [];
      for (let i = 0; i < 9; i++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1, 0.06), addMat(i % 3 ? '#8ff7ff' : '#ffffff'));
        const halo = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1, 0.22), addMat('#4fd8ff', 0.25));
        m.add(halo);
        m.visible = false;
        ctx.actorParent.add(m);
        ctx.props.push(m);
        ctx.bolts.push(m);
      }
      ctx.sparks = [];
      for (let i = 0; i < 10; i++) {
        const s = glowSprite('#bffcff', 0.08);
        s.visible = false;
        ctx.model.joints.handR.add(s);
        ctx.props.push(s);
        ctx.sparks.push(s);
      }
      ctx.light = new THREE.PointLight('#8ff7ff', 0, 6);
      ctx.light.position.set(0, 2.2, 0);
      ctx.actorParent.add(ctx.light);
      ctx.props.push(ctx.light);
      ctx.jitterT = 0;
    },
    update(ctx, t, dt) {
      const strike = t > 0.6 && t < 1.8;
      ctx.jitterT -= dt;
      if (strike && ctx.jitterT <= 0) {
        ctx.jitterT = 0.05;
        const hand = new THREE.Vector3();
        ctx.model.joints.handR.getWorldPosition(hand);
        ctx.actorParent.worldToLocal(hand);
        let a = new THREE.Vector3(hand.x + (Math.random() - 0.5) * 0.6, 4.5, hand.z);
        for (let i = 0; i < ctx.bolts.length; i++) {
          const k = (i + 1) / ctx.bolts.length;
          const b = a.clone().lerp(hand, 1 / (ctx.bolts.length - i));
          if (i < ctx.bolts.length - 1) b.add(new THREE.Vector3((Math.random() - 0.5) * 0.35, 0, (Math.random() - 0.5) * 0.2));
          const m = ctx.bolts[i];
          m.visible = true;
          m.position.copy(a).lerp(b, 0.5);
          m.scale.y = a.distanceTo(b);
          m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
          m.material.opacity = 0.6 + Math.random() * 0.4;
          a = b;
          void k;
        }
        ctx.light.intensity = 4 + Math.random() * 6;
      } else if (!strike) {
        ctx.bolts.forEach((m) => { m.visible = false; });
        ctx.light.intensity = Math.max(0, ctx.light.intensity - dt * 20);
      }
      const sparkOn = t > 0.6 && t < 3.4;
      ctx.sparks.forEach((s, i) => {
        s.visible = sparkOn && Math.random() < 0.7;
        const a = t * 12 + i * 2.1;
        s.position.set(Math.cos(a) * 0.12, -0.08 + Math.sin(a * 1.7) * 0.1, Math.sin(a) * 0.12);
      });
    },
  },
  /* ===== v1.5: lines + motions for the remaining characters ===== */
  nitro: {
    line: '속도가 곧 힘이지!', lang: 'ko-KR', pitch: 1.15, rate: 1.2, speakAt: 0.4, dur: 4.2, view: 0.5,
    keys: [
      [0, {}, {}],
      [0.5, { torso: [0.45, 0, 0], neck: [-0.35, 0, 0], shL: [0.9, 0, -0.2], elL: [1.2, 0, 0], shR: [-0.6, 0, 0.2], elR: [0.6, 0, 0], legL: [0.9, 0, 0], knL: [-1.4, 0, 0], legR: [-0.5, 0, 0], knR: [-0.3, 0, 0] }, { y: -0.18 }],
      [1.3, { torso: [0.45, 0, 0], neck: [-0.35, 0, 0], shL: [0.9, 0, -0.2], elL: [1.2, 0, 0], shR: [-0.6, 0, 0.2], elR: [0.6, 0, 0], legL: [0.9, 0, 0], knL: [-1.4, 0, 0], legR: [-0.5, 0, 0], knR: [-0.3, 0, 0] }, { y: -0.18 }],
      [1.55, { torso: [0.35, 0, 0], shL: [-0.8, 0, -0.2], elL: [0.8, 0, 0], shR: [1.0, 0, 0.2], elR: [1.0, 0, 0], legL: [-0.6, 0, 0], knL: [-0.4, 0, 0], legR: [0.9, 0, 0], knR: [-1.0, 0, 0] }, { x: 0.9, y: 0.05 }],
      [1.8, { torso: [0.35, 0, 0], shL: [1.0, 0, -0.2], elL: [1.0, 0, 0], shR: [-0.8, 0, 0.2], elR: [0.8, 0, 0], legL: [0.9, 0, 0], knL: [-1.0, 0, 0], legR: [-0.6, 0, 0], knR: [-0.4, 0, 0] }, { x: 1.6 }],
      [2.4, { torso: [-0.1, 0, 0.1], shR: [2.7, 0, 0.3], elR: [0.2, 0, 0], legL: [0.2, 0, 0.1], legR: [-0.1, 0, -0.1] }, { x: 0.2, ry: -0.4 }],
      [3.5, { torso: [-0.1, 0, 0.1], shR: [2.7, 0, 0.3], elR: [0.2, 0, 0], neck: [0.1, 0.3, 0], legL: [0.2, 0, 0.1], legR: [-0.1, 0, -0.1] }, { x: 0.2, ry: -0.4 }],
      [4.2, {}, {}],
    ],
    setup(ctx) {
      ctx.flames = [];
      for (let i = 0; i < 26; i++) {
        const f = glowSprite(i % 2 ? '#ff7a1a' : '#ffd23a', 0.35);
        f.visible = false;
        ctx.actorParent.add(f); ctx.props.push(f); ctx.flames.push(f);
      }
      ctx.boost = glowSprite('#ff8a2a', 0.6);
      ctx.model.joints.torso.add(ctx.boost); ctx.boost.position.set(0, 0.45, 0.3); ctx.props.push(ctx.boost);
      ctx.fi = 0;
    },
    update(ctx, t, dt) {
      ctx.boost.material.opacity = t > 0.5 && t < 2.2 ? 0.7 + Math.random() * 0.3 : 0.15;
      ctx.boost.scale.setScalar(t > 1.3 && t < 2.0 ? 1.1 : 0.5);
      if (t > 1.3 && t < 2.1) {
        // fire trail left behind the dash
        const f = ctx.flames[ctx.fi++ % ctx.flames.length];
        f.visible = true; f.position.set(-0.3 + (t - 1.3) * 2.2, 0.15, 0); f.userData.t = 0;
      }
      for (const f of ctx.flames) {
        if (!f.visible) continue;
        f.userData.t = (f.userData.t || 0) + dt;
        f.position.y += dt * 0.6;
        f.material.opacity = Math.max(0, 1 - f.userData.t / 0.9);
        f.scale.setScalar(0.35 + f.userData.t * 0.4);
        if (f.userData.t > 0.9) f.visible = false;
      }
    },
  },

  ghost: {
    line: '...이미 네 뒤에 있어.', lang: 'ko-KR', pitch: 0.55, rate: 0.85, speakAt: 2.2, dur: 4.8, view: -0.3,
    keys: [
      [0, {}, {}],
      [0.6, { shL: [0.4, 0, -1.3], elL: [0.3, 0, 0], shR: [0.4, 0, 1.3], elR: [0.3, 0, 0], neck: [0.25, 0, 0] }, {}],
      [1.2, { shL: [0.4, 0, -1.3], elL: [0.3, 0, 0], shR: [0.4, 0, 1.3], elR: [0.3, 0, 0], neck: [0.25, 0, 0] }, { y: 0.1 }],
      [1.9, { shL: [0.2, 0, -0.2], shR: [0.2, 0, 0.2] }, { x: -0.6, y: 0.1 }],
      [2.6, { ...CROSS_ARMS, neck: [0.15, -0.4, 0] }, { x: 0.5, ry: 0.5 }],
      [3.9, { ...CROSS_ARMS, neck: [0.1, -0.2, 0] }, { x: 0.5, ry: 0.4 }],
      [4.8, {}, {}],
    ],
    setup(ctx) {
      ctx.souls = [];
      for (let i = 0; i < 4; i++) { const s = glowSprite('#b8e8ff', 0.25); ctx.actorParent.add(s); ctx.props.push(s); ctx.souls.push(s); }
      ctx.mats = ctx.model.allMaterials || [];
      ctx.mats.forEach((m) => { m.userData.op = m.opacity; m.userData.tr = m.transparent; m.transparent = true; m.needsUpdate = true; });
    },
    update(ctx, t) {
      // fade out while vanishing, reappear at the side
      const op = t < 1.2 ? 1 : t < 1.7 ? 1 - (t - 1.2) / 0.5 * 0.92 : t < 2.4 ? 0.08 : t < 2.9 ? 0.08 + (t - 2.4) / 0.5 * 0.92 : 1;
      ctx.mats.forEach((m) => { m.opacity = op * (m.userData.op ?? 1); });
      ctx.souls.forEach((s, i) => {
        const a = t * 2.4 + (i / 4) * Math.PI * 2;
        s.position.set(Math.cos(a) * 0.55 + ctx.model.group.parent.position.x, 1.1 + Math.sin(t * 3 + i) * 0.25, Math.sin(a) * 0.55);
        s.material.opacity = 0.5 + Math.sin(t * 5 + i) * 0.3;
      });
    },
    cleanup(ctx) { ctx.mats.forEach((m) => { m.opacity = m.userData.op ?? 1; m.transparent = !!m.userData.tr; m.needsUpdate = true; }); },
  },

  echo: {
    line: '이 비트에 맞춰 쓰러져!', lang: 'ko-KR', pitch: 1.3, rate: 1.1, speakAt: 0.5, dur: 4.6, view: 0.2,
    keys: (() => {
      const k = [[0, {}, {}]];
      const head = { shL: [2.4, 0, -0.9], elL: [1.9, 0, 0], shR: [2.4, 0, 0.9], elR: [1.9, 0, 0] };
      for (let i = 0; i < 7; i++) {
        const tt = 0.45 + i * 0.5;
        k.push([tt, { ...head, neck: [0.3, 0, 0], torso: [0.08, 0, i % 2 ? 0.06 : -0.06], knL: [-0.35, 0, 0], knR: [-0.35, 0, 0], legL: [0.2, 0, 0], legR: [0.2, 0, 0] }, { y: -0.08, rz: i % 2 ? 0.04 : -0.04 }]);
        k.push([tt + 0.25, { ...head, neck: [-0.15, 0, 0], torso: [0, 0, 0] }, { y: 0 }]);
      }
      k.push([4.0, { ...FINGER_GUN, shL: [0.3, 0, -0.3] }, {}]);
      k.push([4.6, {}, {}]);
      return k;
    })(),
    setup(ctx) {
      ctx.notes = [];
      const cols = ['#ff5fb8', '#c9a2ff', '#7fd8ff'];
      for (let i = 0; i < 9; i++) {
        const n = new THREE.Group();
        const m = new THREE.MeshBasicMaterial({ color: cols[i % 3], transparent: true });
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), m); head.scale.set(1.3, 0.9, 0.7);
        const stem = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.17, 0.012), m); stem.position.set(0.055, 0.085, 0);
        const flag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.012), m); flag.position.set(0.085, 0.16, 0); flag.rotation.z = -0.6;
        n.add(head, stem, flag, glowSprite(cols[i % 3], 0.25));
        n.visible = false; n.userData.t = -1;
        ctx.actorParent.add(n); ctx.props.push(n); ctx.notes.push(n);
      }
      ctx.ni = 0; ctx.next = 0.45;
    },
    update(ctx, t, dt) {
      if (t >= ctx.next && t < 4.0) {
        ctx.next += 0.5;
        const n = ctx.notes[ctx.ni++ % ctx.notes.length];
        n.visible = true; n.userData.t = 0; n.userData.dx = (Math.random() - 0.5) * 0.8;
        n.position.set((Math.random() < 0.5 ? -0.25 : 0.25), 1.75, 0.1);
      }
      for (const n of ctx.notes) {
        if (n.userData.t < 0) continue;
        n.userData.t += dt;
        n.position.y += dt * 0.6; n.position.x += n.userData.dx * dt;
        n.rotation.z = Math.sin(n.userData.t * 6) * 0.3;
        n.children.forEach((c) => { if (c.material) c.material.opacity = Math.max(0, 1 - n.userData.t / 1.6); });
        if (n.userData.t > 1.6) { n.visible = false; n.userData.t = -1; }
      }
    },
  },

  glitch: {
    line: '시스템... 오류... 너 말이야.', lang: 'ko-KR', pitch: 0.7, rate: 0.9, speakAt: 0.8, dur: 4.6, view: -0.2,
    keys: [
      [0, {}, {}],
      [0.4, { neck: [0.1, 0.5, 0.3], shR: [0.5, 0, 0.9], elR: [1.4, 0, 0] }, {}],
      [1.0, { neck: [-0.1, -0.5, -0.3], shL: [0.5, 0, -0.9], elL: [1.4, 0, 0] }, { x: -0.5 }],
      [1.6, { neck: [0.2, 0.3, 0.4], torso: [0, 0.4, 0] }, { x: 0.45 }],
      [2.2, { neck: [0, 0, 0], ...FINGER_GUN }, { x: 0 }],
      [3.6, { neck: [0.05, 0, 0.1], ...FINGER_GUN }, {}],
      [4.6, {}, {}],
    ],
    setup(ctx) {
      ctx.cubes = [];
      for (let i = 0; i < 18; i++) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), addMat(i % 2 ? '#39ff9e' : '#b47bff'));
        c.visible = false;
        ctx.actorParent.add(c); ctx.props.push(c); ctx.cubes.push(c);
      }
      ctx.mats = ctx.model.allMaterials || [];
      ctx.mats.forEach((m) => { m.userData.tr = m.transparent; m.userData.op = m.opacity; m.transparent = true; m.needsUpdate = true; });
      ctx.lastJump = 0;
    },
    update(ctx, t, dt) {
      // digital flicker: the body blinks while it teleports
      const glitching = (t > 0.8 && t < 1.15) || (t > 1.45 && t < 1.75);
      const op = glitching ? (Math.random() < 0.5 ? 0.15 : 1) : 1;
      ctx.mats.forEach((m) => { m.opacity = op * (m.userData.op ?? 1); });
      if (glitching && t - ctx.lastJump > 0.08) {
        ctx.lastJump = t;
        for (const c of ctx.cubes) {
          if (c.visible) continue;
          c.visible = true; c.userData.t = 0;
          c.position.set(ctx.model.group.parent.position.x + (Math.random() - 0.5) * 0.7, 0.3 + Math.random() * 1.5, (Math.random() - 0.5) * 0.4);
          c.userData.v = new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 0.8, (Math.random() - 0.5) * 1.2);
          break;
        }
      }
      for (const c of ctx.cubes) {
        if (!c.visible) continue;
        c.userData.t += dt;
        c.position.addScaledVector(c.userData.v, dt);
        c.rotation.x += dt * 5; c.rotation.y += dt * 4;
        c.material.opacity = Math.max(0, 1 - c.userData.t / 1.2);
        if (c.userData.t > 1.2) c.visible = false;
      }
    },
    cleanup(ctx) { ctx.mats.forEach((m) => { m.opacity = m.userData.op ?? 1; m.transparent = !!m.userData.tr; m.needsUpdate = true; }); },
  },

  inker: {
    line: '세상은 내 캔버스야.', lang: 'ko-KR', pitch: 1.05, rate: 1.0, speakAt: 0.4, dur: 4.6, view: 0.3,
    keys: [
      [0, {}, {}],
      [0.5, { shR: [2.6, 0, 0.6], elR: [0.4, 0, 0], torso: [-0.1, 0.3, 0] }, {}],
      [1.0, { shR: [1.2, 0, -0.2], elR: [0.2, 0, 0], torso: [0.15, -0.35, 0] }, { x: 0.05 }],
      [1.5, { shR: [2.2, 0, 0.9], elR: [0.3, 0, 0], torso: [-0.05, 0.25, 0] }, {}],
      [2.0, { shR: [1.0, 0, 0.1], elR: [0.3, 0, 0], torso: [0.2, -0.3, 0] }, {}],
      [2.6, { shR: [0.6, 0, 0.2], elR: [1.6, 0, 0], shL: [0.4, 0, -0.5], elL: [1.6, 0, 0], neck: [0.1, 0.3, 0] }, {}],
      [3.8, { shR: [0.6, 0, 0.2], elR: [1.6, 0, 0], shL: [0.4, 0, -0.5], elL: [1.6, 0, 0], neck: [0.05, 0.2, 0.1] }, {}],
      [4.6, {}, {}],
    ],
    setup(ctx) {
      // brush in the hand
      const brush = new THREE.Group();
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 8), new THREE.MeshStandardMaterial({ color: '#8a5a2a' }));
      handle.position.y = -0.25;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 10), new THREE.MeshStandardMaterial({ color: '#5a3dff', emissive: '#3a1fd8', emissiveIntensity: 0.6 }));
      tip.position.y = -0.62; tip.rotation.x = Math.PI;
      brush.add(handle, tip);
      ctx.model.joints.handR.add(brush); ctx.props.push(brush);
      ctx.tip = tip;
      ctx.dots = [];
      for (let i = 0; i < 70; i++) {
        const d = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: i % 3 ? '#5a3dff' : '#20d0ff', transparent: true }));
        d.visible = false;
        ctx.actorParent.add(d); ctx.props.push(d); ctx.dots.push(d);
      }
      ctx.di = 0;
    },
    update(ctx, t) {
      if (t > 0.5 && t < 2.1) {
        // paint stroke hangs in the air where the brush passes
        const p = new THREE.Vector3();
        ctx.tip.getWorldPosition(p); ctx.actorParent.worldToLocal(p);
        const d = ctx.dots[ctx.di++ % ctx.dots.length];
        d.visible = true; d.position.copy(p); d.userData.t = t;
      }
      for (const d of ctx.dots) if (d.visible) d.material.opacity = Math.max(0, 1 - Math.max(0, t - 2.4) / 1.6);
    },
  },

  inferno: {
    line: '불과 물이... 내 손 안에.', lang: 'ko-KR', pitch: 0.7, rate: 0.9, speakAt: 0.6, dur: 4.6, view: 0,
    keys: [
      [0, {}, {}],
      [0.6, { shL: [1.0, 0, -0.9], elL: [1.2, 0, 0], shR: [1.0, 0, 0.9], elR: [1.2, 0, 0], neck: [0.2, 0, 0] }, {}],
      [1.8, { shL: [1.0, 0, -0.9], elL: [1.2, 0, 0], shR: [1.0, 0, 0.9], elR: [1.2, 0, 0], neck: [0.25, 0, 0] }, {}],
      [2.3, { shL: [1.2, 0.5, -0.1], elL: [0.8, 0, 0], shR: [1.2, -0.5, 0.1], elR: [0.8, 0, 0], neck: [0.2, 0, 0] }, {}],
      [2.6, { shL: [2.6, 0, -0.6], elL: [0.3, 0, 0], shR: [2.6, 0, 0.6], elR: [0.3, 0, 0], neck: [-0.2, 0, 0], torso: [-0.1, 0, 0] }, { y: 0.06 }],
      [3.8, { shL: [0.3, 0, -0.4], shR: [0.3, 0, 0.4], neck: [0, 0, 0] }, {}],
      [4.6, {}, {}],
    ],
    setup(ctx) {
      const orb = (col, glow) => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), addMat(col)), glowSprite(glow, 0.45)); g.scale.setScalar(0.01); return g; };
      ctx.fire = orb('#ffd25a', '#ff6a1a'); ctx.water = orb('#bfe9ff', '#2f8fff');
      ctx.model.joints.handL.add(ctx.fire); ctx.model.joints.handR.add(ctx.water);
      ctx.fire.position.y = ctx.water.position.y = -0.1;
      ctx.props.push(ctx.fire, ctx.water);
      ctx.puffs = [];
      for (let i = 0; i < 16; i++) { const s = glowSprite('#ffffff', 0.5); s.visible = false; ctx.actorParent.add(s); ctx.props.push(s); ctx.puffs.push(s); }
    },
    update(ctx, t, dt) {
      const grow = Math.min(1, Math.max(0, (t - 0.6) / 0.8));
      const show = t < 2.4;
      for (const o of [ctx.fire, ctx.water]) { o.visible = show; o.scale.setScalar(0.01 + grow * (1 + Math.sin(t * 9) * 0.08)); }
      if (t >= 2.4 && !ctx.burst) {
        ctx.burst = true;
        ctx.puffs.forEach((s) => { s.visible = true; s.position.set(ctx.model.group.parent.position.x, 1.9, 0.1); s.userData.v = new THREE.Vector3((Math.random() - 0.5) * 1.6, Math.random() * 1.2, (Math.random() - 0.5) * 1.2); s.userData.t = 0; });
      }
      for (const s of ctx.puffs) {
        if (!s.visible) continue;
        s.userData.t += dt;
        s.position.addScaledVector(s.userData.v, dt);
        s.scale.setScalar(0.5 + s.userData.t * 1.4);
        s.material.opacity = Math.max(0, 0.8 - s.userData.t / 1.8);
      }
    },
  },

  titan: {
    line: '산은... 무너지지 않는다.', lang: 'ko-KR', pitch: 0.45, rate: 0.8, speakAt: 0.3, dur: 4.6, view: -0.15,
    keys: [
      [0, {}, {}],
      [0.4, { shR: [1.3, 0, -0.6], elR: [1.9, 0, 0], neck: [-0.1, 0, 0] }, {}],
      [0.6, { shR: [1.0, 0, -0.4], elR: [2.1, 0, 0] }, { y: -0.02 }],
      [0.8, { shL: [1.3, 0, 0.6], elL: [1.9, 0, 0] }, {}],
      [1.0, { shL: [1.0, 0, 0.4], elL: [2.1, 0, 0] }, { y: -0.02 }],
      [1.6, { shL: [2.9, 0, -0.3], elL: [0.4, 0, 0], shR: [2.9, 0, 0.3], elR: [0.4, 0, 0], torso: [-0.2, 0, 0], neck: [-0.2, 0, 0] }, { y: 0.1 }],
      [2.0, { shL: [0.9, 0, -0.2], elL: [0.4, 0, 0], shR: [0.9, 0, 0.2], elR: [0.4, 0, 0], torso: [0.55, 0, 0], legL: [0.6, 0, 0], knL: [-1.0, 0, 0], legR: [-0.3, 0, 0], knR: [-0.6, 0, 0] }, { y: -0.25 }],
      [3.2, { shL: [0.9, 0, -0.2], elL: [0.4, 0, 0], shR: [0.9, 0, 0.2], elR: [0.4, 0, 0], torso: [0.5, 0, 0], legL: [0.6, 0, 0], knL: [-1.0, 0, 0], legR: [-0.3, 0, 0], knR: [-0.6, 0, 0] }, { y: -0.25 }],
      [4.0, { shL: [0.2, 0, -0.5], shR: [0.2, 0, 0.5], elL: [0.3, 0, 0], elR: [0.3, 0, 0] }, {}],
      [4.6, {}, {}],
    ],
    setup(ctx) {
      ctx.rocks = [];
      const rm = new THREE.MeshStandardMaterial({ color: '#8a7f72', roughness: 0.9, flatShading: true });
      for (let i = 0; i < 16; i++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.06 + Math.random() * 0.06, 0), rm); r.visible = false; ctx.actorParent.add(r); ctx.props.push(r); ctx.rocks.push(r); }
      ctx.crack = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.18, 24), addMat('#ff7a1a', 0));
      ctx.crack.rotation.x = -Math.PI / 2; ctx.crack.position.set(0, 0.02, 0.25);
      ctx.actorParent.add(ctx.crack); ctx.props.push(ctx.crack);
    },
    update(ctx, t, dt) {
      if (t >= 2.0 && !ctx.slam) {
        ctx.slam = true;
        ctx.rocks.forEach((r) => { r.visible = true; r.position.set(ctx.model.group.parent.position.x + (Math.random() - 0.5) * 0.3, 0.1, 0.3); r.userData.v = new THREE.Vector3((Math.random() - 0.5) * 3, 1.5 + Math.random() * 2, (Math.random() - 0.2) * 2); });
      }
      for (const r of ctx.rocks) {
        if (!r.visible) continue;
        r.userData.v.y -= 9 * dt;
        r.position.addScaledVector(r.userData.v, dt);
        if (r.position.y < 0.05) { r.position.y = 0.05; r.userData.v.set(0, 0, 0); }
        r.rotation.x += dt * 6;
      }
      const k = t < 2.0 ? 0 : Math.min(1, (t - 2.0) * 3);
      ctx.crack.scale.setScalar(1 + k * 5);
      ctx.crack.material.opacity = t < 2.0 ? 0 : Math.max(0, 1 - (t - 2.0) / 2.2);
    },
  },

  bloom: {
    line: '피어나라, 생명이여.', lang: 'ko-KR', pitch: 1.2, rate: 0.95, speakAt: 1.6, dur: 5.0, view: 0.25,
    keys: [
      [0, {}, {}],
      [0.5, { shR: [1.4, 0, 0.2], elR: [0.9, 0, 0], neck: [0.35, 0, 0] }, {}],
      [1.1, { shR: [0.8, 0, 0.1], elR: [0.3, 0, 0], torso: [0.6, 0, 0], neck: [0.2, 0, 0], legL: [0.5, 0, 0], knL: [-1.1, 0, 0], legR: [-0.2, 0, 0], knR: [-1.3, 0, 0] }, { y: -0.3 }],
      [1.6, { shR: [0.8, 0, 0.1], elR: [0.3, 0, 0], torso: [0.6, 0, 0], neck: [0.2, 0, 0], legL: [0.5, 0, 0], knL: [-1.1, 0, 0], legR: [-0.2, 0, 0], knR: [-1.3, 0, 0] }, { y: -0.3 }],
      [2.2, { shL: [2.5, 0, -0.7], elL: [0.3, 0, 0], shR: [2.5, 0, 0.7], elR: [0.3, 0, 0], neck: [-0.25, 0, 0] }, { x: -0.25 }],
      [4.2, { shL: [2.4, 0, -0.8], elL: [0.3, 0, 0], shR: [2.4, 0, 0.8], elR: [0.3, 0, 0], neck: [-0.2, 0.2, 0] }, { x: -0.25 }],
      [5.0, {}, {}],
    ],
    setup(ctx) {
      const tree = new THREE.Group();
      const bark = new THREE.MeshStandardMaterial({ color: '#6a4426', roughness: 0.9, flatShading: true });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 0.9, 7), bark); trunk.position.y = 0.45;
      tree.add(trunk);
      const pink = new THREE.MeshStandardMaterial({ color: '#ff9fd8', emissive: '#ff5fb8', emissiveIntensity: 0.4, flatShading: true });
      const green = new THREE.MeshStandardMaterial({ color: '#6fdc4a', emissive: '#2f8a1a', emissiveIntensity: 0.3, flatShading: true });
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), i % 3 ? pink : green); m.position.set(Math.cos(a) * 0.2, 0.95 + (i % 2) * 0.12, Math.sin(a) * 0.2); tree.add(m); }
      tree.add(glowSprite('#b6ff6a', 1.0));
      tree.position.set(0.35, 0, 0.35); tree.scale.setScalar(0.001);
      ctx.actorParent.add(tree); ctx.props.push(tree); ctx.tree = tree;
      ctx.petals = [];
      for (let i = 0; i < 24; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.04), addMat(i % 2 ? '#ff9fd8' : '#ffd0ec')); p.visible = false; ctx.actorParent.add(p); ctx.props.push(p); ctx.petals.push(p); }
    },
    update(ctx, t, dt) {
      const g = t < 1.5 ? 0 : Math.min(1, (t - 1.5) / 0.8);
      ctx.tree.scale.setScalar(0.001 + (1 - Math.pow(1 - g, 3)) * 1.0);
      ctx.tree.position.x = 0.35 + ctx.model.group.parent.position.x * 0;
      if (t > 2.2) {
        for (const p of ctx.petals) {
          if (!p.visible) { if (Math.random() < 0.08) { p.visible = true; p.position.set(0.35 + (Math.random() - 0.5) * 0.5, 1.2, 0.35 + (Math.random() - 0.5) * 0.4); p.userData.v = new THREE.Vector3((Math.random() - 0.5) * 0.6, -0.25 - Math.random() * 0.2, (Math.random() - 0.5) * 0.4); } continue; }
          p.position.addScaledVector(p.userData.v, dt);
          p.rotation.x += dt * 4; p.rotation.y += dt * 3;
          if (p.position.y < 0) p.visible = false;
        }
      }
    },
  },

  crick: {
    line: '네 힘은... 이제 내 거야.', lang: 'ko-KR', pitch: 0.85, rate: 0.95, speakAt: 1.8, dur: 4.4, view: 0.3,
    keys: [
      [0, {}, {}],
      [0.7, { shR: [1.5, 0, 0.1], elR: [0.1, 0, 0], torso: [0.1, -0.2, 0], neck: [0.05, -0.2, 0] }, {}],
      [1.6, { shR: [1.5, 0, 0.1], elR: [0.1, 0, 0], torso: [0.1, -0.2, 0], neck: [0.05, -0.2, 0] }, {}],
      [2.2, { shR: [0.9, 0, 0.1], elR: [1.4, 0, 0], torso: [-0.1, 0.1, 0], neck: [-0.15, 0, 0] }, {}],
      [3.3, { shR: [0.9, 0, 0.1], elR: [1.4, 0, 0], shL: [0.3, 0, -0.3], torso: [-0.1, 0.1, 0], neck: [-0.15, 0.2, 0] }, {}],
      [4.4, {}, {}],
    ],
    setup(ctx) {
      ctx.orbs = [];
      for (let i = 0; i < 8; i++) {
        const o = glowSprite(i % 2 ? '#d9ff5a' : '#b47bff', 0.12);
        o.visible = false; ctx.actorParent.add(o); ctx.props.push(o); ctx.orbs.push(o);
      }
      ctx.core = glowSprite('#d9ff5a', 0.3);
      ctx.model.joints.torso.add(ctx.core); ctx.core.position.set(0.15, 0.55, -0.45); ctx.props.push(ctx.core);
    },
    update(ctx, t) {
      // light orbs fly in from in front and are pulled into the open hand
      ctx.orbs.forEach((o, i) => {
        const u = (t - 0.8 - i * 0.12) / 1.2;
        o.visible = u > 0 && u < 1;
        if (o.visible) { const a = i * 0.8; o.position.set(Math.cos(a) * (1 - u) * 1.2 + 0.2, 1.3 + Math.sin(a) * (1 - u) * 0.5, -1.4 * (1 - u) - 0.4); }
      });
      ctx.core.material.opacity = t > 1.2 && t < 3.6 ? 0.6 + Math.sin(t * 12) * 0.3 : 0;
      ctx.core.scale.setScalar(0.2 + Math.min(1, Math.max(0, t - 1.2)) * 0.3);
    },
  },

  biker: {
    line: '길을 비켜라!', lang: 'ko-KR', pitch: 0.75, rate: 1.15, speakAt: 0.5, dur: 4.4, view: 0.6,
    keys: [
      [0, {}, {}],
      [0.4, { legL: [-1.2, 0, 0], knL: [-1.2, 0, 0], legR: [-0.6, 0, 0], knR: [-1.6, 0, 0], shL: [1.3, 0, -0.1], shR: [1.3, 0, 0.1], elL: [0.3, 0, 0], elR: [0.3, 0, 0], torso: [0.35, 0, 0] }, { y: 0.32 }],
      [1.6, { legL: [-0.6, 0, 0], knL: [-1.6, 0, 0], legR: [-1.2, 0, 0], knR: [-1.2, 0, 0], shL: [1.3, 0, -0.1], shR: [1.3, 0, 0.1], elL: [0.3, 0, 0], elR: [0.3, 0, 0], torso: [0.35, 0, 0] }, { y: 0.32, x: 0.5 }],
      [2.3, { legL: [-1.0, 0, 0], knL: [-1.3, 0, 0], legR: [-1.0, 0, 0], knR: [-1.3, 0, 0], shL: [1.6, 0, -0.1], shR: [1.6, 0, 0.1], elL: [0.2, 0, 0], elR: [0.2, 0, 0], torso: [-0.2, 0, 0], neck: [-0.3, 0, 0] }, { y: 0.45, x: 0.6, rx: -0.35 }],
      [3.2, { legL: [-1.0, 0, 0], knL: [-1.3, 0, 0], legR: [-1.0, 0, 0], knR: [-1.3, 0, 0], shL: [1.3, 0, -0.1], shR: [2.6, 0, 0.3], elL: [0.3, 0, 0], torso: [0.2, 0, 0] }, { y: 0.32, x: 0.6 }],
      [4.4, {}, {}],
    ],
    setup(ctx) {
      ctx.bike = makeBike();
      ctx.model.group.add(ctx.bike); ctx.props.push(ctx.bike);
    },
    update(ctx, t, dt) {
      const show = t > 0.2 && t < 4.1;
      ctx.bike.visible = show;
      ctx.bike.position.set(0, -0.32, 0);
      for (const w of ctx.bike.userData.wheels) w.rotation.x -= dt * 9;
    },
  },

  chaos: {
    line: '시간은... 내 편이다.', lang: 'ko-KR', pitch: 0.8, rate: 0.9, speakAt: 2.0, dur: 4.6, view: 0.3,
    keys: [
      [0, {}, {}],
      [0.6, { shR: [1.4, 0, 0.1], elR: [0.5, 0, 0], neck: [0.1, 0, 0] }, {}],
      [1.4, { shR: [1.4, 0, 0.1], elR: [0.5, 0, 0], neck: [0.1, 0, 0] }, {}],
      [2.0, { shR: [1.0, 0, 0.1], elR: [1.3, 0, 0], shL: [0.6, 0, -0.4], elL: [0.6, 0, 0], torso: [-0.05, 0.15, 0], neck: [-0.1, 0.1, 0] }, {}],
      [3.4, { shR: [1.0, 0, 0.1], elR: [1.3, 0, 0], shL: [1.8, 0, -0.2], elL: [0.2, 0, 0], torso: [-0.05, 0.15, 0], neck: [-0.15, 0, 0] }, {}],
      [4.6, {}, {}],
    ],
    setup(ctx) {
      // hourglass in the right hand
      const glass = new THREE.Group();
      const gold = addMat('#ffcf5a'), sand = addMat('#ffe6a0', 0.85);
      glass.add(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.09, 12), sand).translateY(0.045).rotateX(Math.PI));
      glass.add(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.09, 12), sand).translateY(-0.045));
      for (const y of [0.095, -0.095]) glass.add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.015, 12), gold).translateY(y));
      glass.add(glowSprite('#ffcf5a', 0.35));
      ctx.model.joints.handR?.add(glass);
      if (!ctx.model.joints.handR) { ctx.actorParent.add(glass); glass.position.set(0.3, 1.2, -0.3); }
      glass.position.y -= 0.12;
      ctx.glass = glass; ctx.props.push(glass);
      // golden clock hands spinning around the body
      ctx.hands = [];
      for (let i = 0; i < 12; i++) {
        const h = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.22), addMat(i % 3 ? '#ffcf5a' : '#a58cff'));
        h.visible = false; ctx.actorParent.add(h); ctx.props.push(h); ctx.hands.push(h);
      }
    },
    update(ctx, t) {
      // the hourglass flips over
      ctx.glass.rotation.z = t < 1.4 ? 0 : t < 2.0 ? ((t - 1.4) / 0.6) * Math.PI : Math.PI;
      ctx.hands.forEach((h, i) => {
        const u = t - 1.8 - i * 0.05;
        h.visible = u > 0 && t < 4.3;
        if (!h.visible) return;
        const a = (i / 12) * Math.PI * 2 - u * 1.2;
        h.position.set(Math.cos(a) * 0.8, 0.4 + (i % 4) * 0.35, Math.sin(a) * 0.8);
        h.rotation.y = -a;
      });
    },
  },

};

/** Plays an emote on a preview model. */
export class EmotePlayer {
  constructor(actor, actorParent, model) {
    this.actor = actor;           // group that receives root motion
    this.actorParent = actorParent;
    this.model = model;
    this.active = null;
  }

  play(id) {
    this.stop();
    const em = EMOTES[id];
    if (!em) return null;
    this.active = { id, em, t: 0, spoke: false, ctx: { model: this.model, actorParent: this.actorParent, props: [] } };
    em.setup?.(this.active.ctx);
    return em;
  }

  stop() {
    if (!this.active) return;
    const { em, ctx } = this.active;
    em.cleanup?.(ctx);
    for (const p of ctx.props) p.parent?.remove(p);
    this.active = null;
    this.actor.position.set(0, 0, 0);
    this.actor.rotation.set(0, 0, 0);
    setPose(this.model, IDLE_POSE);
  }

  /** returns { speak: line } on the frame the line should be spoken */
  update(dt) {
    const a = this.active;
    if (!a) return null;
    a.t += dt;
    const { em, t } = a;
    const keys = em.keys;
    let i = 0;
    while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const [t0, p0, r0] = keys[i], [t1, p1, r1] = keys[i + 1];
    const u = Math.min(1, Math.max(0, (t - t0) / (t1 - t0 || 1)));
    const pose = blendPose({ ...IDLE_POSE, ...p0 }, { ...IDLE_POSE, ...p1 }, u);
    setPose(this.model, pose);
    const s = u * u * (3 - 2 * u);
    const R = (k) => (r0[k] || 0) + ((r1[k] || 0) - (r0[k] || 0)) * s;
    this.actor.position.set(R('x'), R('y'), R('z'));
    this.actor.rotation.set(R('rx'), R('ry'), R('rz'));
    em.update?.(a.ctx, t, dt);
    let out = null;
    if (!a.spoke && t >= em.speakAt) { a.spoke = true; out = { speak: em }; }
    if (t >= em.dur) { this.stop(); return { done: true }; }
    return out;
  }
}

/** Browser text-to-speech (silently skipped if unavailable). */
export function speak(em, volume = 1) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(em.line.replace(/\.\.\./g, ''));
    u.lang = em.lang;
    u.pitch = em.pitch;
    u.rate = em.rate;
    u.volume = volume;
    const v = synth.getVoices().find((x) => x.lang?.replace('_', '-').startsWith(em.lang.slice(0, 2)));
    if (v) u.voice = v;
    synth.speak(u);
  } catch { /* ignore */ }
}
