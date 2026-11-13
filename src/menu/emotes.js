import * as THREE from 'three';
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
