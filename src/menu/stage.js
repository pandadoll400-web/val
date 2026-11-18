import * as THREE from 'three';
import { makeSoldier, setPose, IDLE_POSE } from '../game/soldier.js';
import { getCharacter, RARITY } from '../data/characters.js';

/* soft round shadow under each character */
let shadowTex = null;
function shadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grd.addColorStop(0, 'rgba(10,20,40,.55)'); grd.addColorStop(1, 'rgba(10,20,40,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}

/**
 * Small 3D stage drawn on top of the menu background: the selected character standing in the
 * empty right side of the main menu, or me + my friend side by side in the room lobby.
 * Renders into a sub-rectangle of the main renderer (no extra WebGL context).
 */
export class CharStage {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    this.scene.add(new THREE.HemisphereLight('#dff0ff', '#2a3d5c', 1.5));
    const key = new THREE.DirectionalLight('#fff1e0', 2.2);
    key.position.set(3, 6, 6);
    const rim = new THREE.DirectionalLight('#8fd8ff', 1.6);
    rim.position.set(-4, 3, -5);
    this.scene.add(key, rim);
    this.slots = [];
    this.t = 0;
    this.labels = document.createElement('div');
    this.labels.className = 'stage-labels';
    document.body.appendChild(this.labels);
    this.rect = null;
  }

  /** entries: [{ charId, name, tag, placeholder }] — laid out left to right */
  setEntries(entries) {
    const key = JSON.stringify(entries);
    if (key === this._key) return;
    this._key = key;
    for (const s of this.slots) {
      this.scene.remove(s.group);
      s.group.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
      s.label.remove();
    }
    this.slots = [];
    const n = entries.length, gap = 1.7;
    entries.forEach((e, i) => {
      const group = new THREE.Group();
      group.position.x = (i - (n - 1) / 2) * gap;
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
      sh.position.y = 0.01;
      group.add(sh);
      let model = null;
      const label = document.createElement('div');
      label.className = 'stage-label' + (e.placeholder ? ' wait' : '');
      if (e.placeholder) {
        // silhouette waiting for the friend
        model = makeSoldier('#33415a', '#5a6a84', 'enemy');
        model.allMaterials?.forEach((m) => { m.transparent = true; m.opacity = 0.35; });
        label.innerHTML = `<b>${e.name || '친구를 기다리는 중…'}</b>`;
      } else {
        const c = getCharacter(e.charId);
        model = makeSoldier(c.color, c.accent, c.id, e.outfit);
        const r = RARITY[c.rarity];
        label.innerHTML = `${e.tag ? `<span class="tag">${e.tag}</span>` : ''}<b>${e.name || c.name}</b><small style="color:${r.color}">${c.name} · ${r.name}</small>`;
      }
      model.gun.visible = false;
      setPose(model, IDLE_POSE);
      model.group.rotation.y = Math.PI + (n > 1 ? (i === 0 ? 0.25 : -0.25) : 0.35); // face the camera, slightly angled
      group.add(model.group);
      this.scene.add(group);
      this.labels.appendChild(label);
      this.slots.push({ group, model, label, ph: Math.random() * 6, placeholder: !!e.placeholder });
    });
    const wide = Math.max(1, n);
    this.camera.position.set(0, 1.35, 4.6 + wide * 1.1);
    this.camera.lookAt(0, 1.0, 0);
  }

  update(dt) {
    this.t += dt;
    for (const s of this.slots) {
      const j = s.model.joints, t = this.t + s.ph;
      j.torso.rotation.x = Math.sin(t * 1.8) * 0.02;
      j.neck.rotation.y = Math.sin(t * 0.6) * 0.35;
      j.neck.rotation.x = Math.sin(t * 0.9) * 0.05;
      j.shL.rotation.z = -0.1 - Math.sin(t * 1.8) * 0.03;
      j.shR.rotation.z = 0.1 + Math.sin(t * 1.8) * 0.03;
      j.hips.position.y = 0.98 + Math.sin(t * 1.8) * 0.008;
    }
  }

  /** draw into rect {x, y, w, h} given in CSS pixels (top-left origin) over whatever is already on screen */
  render(renderer, rect) {
    this.rect = rect;
    const show = !!rect && this.slots.length > 0;
    this.labels.style.display = show ? '' : 'none';
    if (!show) return;
    const H = renderer.domElement.clientHeight;
    this.camera.aspect = rect.w / rect.h;
    this.camera.updateProjectionMatrix();
    const y = H - rect.y - rect.h;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.setScissorTest(true);
    renderer.setScissor(rect.x, y, rect.w, rect.h);
    renderer.setViewport(rect.x, y, rect.w, rect.h);
    renderer.render(this.scene, this.camera);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, renderer.domElement.clientWidth, H);
    renderer.autoClear = true;
    // name labels under the feet
    const v = new THREE.Vector3();
    for (const s of this.slots) {
      v.set(s.group.position.x, -0.05, 0).project(this.camera);
      s.label.style.left = rect.x + ((v.x + 1) / 2) * rect.w + 'px';
      s.label.style.top = rect.y + ((1 - v.y) / 2) * rect.h + 'px';
    }
  }

  hide() { this.labels.style.display = 'none'; }
}
