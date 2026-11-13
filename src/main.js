import * as THREE from 'three';
import './styles.css';
import { MenuBackground } from './menu/background.js';
import { MenuUI } from './menu/ui.js';
import { RoomUI } from './menu/room.js';
import { AccountUI } from './menu/account.js';
import { CharStage } from './menu/stage.js';
import { Game } from './game/game.js';
import { NetSession } from './net/session.js';
import { audio } from './audio.js';
import { save } from './save.js';
import { IS_TOUCH } from './game/touch.js';

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, IS_TOUCH ? 1.25 : 1.75)); // phones: fewer pixels for smooth FPS
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = !IS_TOUCH;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const bg = new MenuBackground(renderer);
// ?lite (automated multi-client tests): simulate everything but skip drawing
const LITE = new URLSearchParams(location.search).has('lite');
let game = null;

let lastMode = 'solo';
function startGame(mode = lastMode, net = null) {
  if (!net) lastMode = mode;
  audio.init();
  ui.hide();
  if (game) game.dispose();
  game = new Game(renderer, { mode, net, onExit: exitGame, onRestart: () => startGame(lastMode) });
  game.start();
  window.__game = game; // handy for debugging in the console
}

function exitGame(kind) {
  if (!game) return;
  const wasNet = !!game.net;
  game.dispose();
  game = null;
  if (!wasNet) { ui.show(); return; }
  if (kind === 'leave') { room.inGame = false; room.leave(); }
  else room.returnToLobby();
}

const ui = new MenuUI({ onPlay: (mode) => startGame(mode) });
window.__ui = ui; // debugging handle
const account = new AccountUI({ ui });
window.__account = account;

// online: the room lobby hands us a match id → load it and play
const room = new RoomUI({
  ui,
  onMatch: async (matchId) => {
    try {
      const match = await NetSession.load(matchId);
      const net = new NetSession(matchId, room.room.uid, match);
      startGame(match.meta.mode, net);
    } catch (e) {
      console.warn(e);
      ui.toast('경기에 들어가지 못했습니다');
      room.returnToLobby();
    }
  },
});
window.__room = room;

// the selected character standing in the empty right side of the main menu
const menuStage = new CharStage();

const clock = new THREE.Clock();
let frame = 0;
function loop() {
  requestAnimationFrame(loop);
  const raw = clock.getDelta();
  const dt = Math.min(raw, 0.05);
  frame++;
  if (game) {
    game.update(dt);
    if (LITE) game.scene.updateMatrixWorld(); else game.render();
    menuStage.hide();
    return;
  }
  if (LITE) return;
  bg.update(dt);
  // while the character panel is open, draw the background at half rate so the preview stays smooth
  if (!ui.previewActive || frame % 2 === 0) bg.render();
  ui.updatePreview(Math.min(raw, 0.25)); // real time, so emotes play at full speed even at low FPS
  const menuIdle = !ui.root.classList.contains('hidden') && !ui.openId && innerWidth > 760;
  if (menuIdle) {
    menuStage.setEntries([{ charId: save.character, name: save.name }]);
    menuStage.update(dt);
    const W = innerWidth, H = innerHeight;
    menuStage.render(renderer, { x: Math.round(W * 0.5), y: Math.round(H * 0.1), w: Math.round(W * 0.46), h: Math.round(H * 0.72) });
  } else menuStage.hide();
  room.draw(renderer, dt);
}

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  bg.resize();
  game?.resize();
  if (ui.previewActive) ui.resizePreview();
});

loop();
