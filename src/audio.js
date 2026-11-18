import { save } from './save.js';

/** Procedural WebAudio sound effects — no external assets. */
class Sfx {
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = save.volume;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setVolume(v) { if (this.master) this.master.gain.value = v; }

  _noise(t, dur, { type = 'lowpass', freq = 3000, q = 0.7, vol = 1, attack = 0.002, sweepTo } = {}) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  _tone(t, dur, { type = 'sine', from = 440, to, vol = 0.3, attack = 0.003 } = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  get ok() { return !!this.ctx; }
  get now() { return this.ctx.currentTime; }

  shot(kind, dist = 0) {
    if (!this.ok) return;
    const t = this.now;
    const v = 1 / (1 + dist * 0.06);
    if (kind === 'flamer') { this._noise(t, 0.16, { type: 'bandpass', freq: 700, q: 0.7, vol: 0.32 * v, sweepTo: 1100, attack: 0.02 }); return; }
    const P = {
      pistol:  { lp: 4200, dur: 0.14, thump: 0.5, vol: 0.55 },
      rifle:   { lp: 3200, dur: 0.16, thump: 0.6, vol: 0.5 },
      shotgun: { lp: 2200, dur: 0.38, thump: 1.0, vol: 0.8 },
      sniper:  { lp: 2600, dur: 0.6, thump: 1.1, vol: 0.85 },
      bot:     { lp: 2400, dur: 0.14, thump: 0.35, vol: 0.4 },
    }[kind] || { lp: 3000, dur: 0.15, thump: 0.5, vol: 0.5 };
    const lp = dist > 25 ? P.lp * 0.5 : P.lp;
    this._noise(t, P.dur, { freq: lp, vol: P.vol * v, sweepTo: 400 });
    this._noise(t, 0.03, { type: 'highpass', freq: 3000, vol: 0.35 * v });
    this._tone(t, 0.12, { from: 140, to: 40, vol: P.thump * 0.6 * v });
    if (kind === 'sniper') this._noise(t + 0.08, 0.9, { freq: 900, vol: 0.18 * v, sweepTo: 200 });
  }

  click(freq = 2600, vol = 0.25, delay = 0) {
    if (!this.ok) return;
    const t = this.now + delay;
    this._noise(t, 0.04, { type: 'bandpass', freq, q: 3, vol });
    this._tone(t, 0.03, { type: 'square', from: freq * 0.4, vol: vol * 0.15 });
  }
  magOut() { this.click(1500, 0.3); this.click(900, 0.15, 0.05); }
  magIn() { this.click(1800, 0.35); this.click(2600, 0.25, 0.06); }
  rack() { this.click(2200, 0.3); this.click(3200, 0.3, 0.09); }
  shell() { this.click(2400, 0.25); }
  pump() { this.click(1200, 0.35); this.click(1600, 0.35, 0.12); }
  dry() { this.click(3500, 0.25); }
  slash(heavy) { if (this.ok) this._noise(this.now, heavy ? 0.32 : 0.2, { type: 'bandpass', freq: heavy ? 900 : 1600, q: 1.2, vol: 0.4, sweepTo: heavy ? 3000 : 4500, attack: 0.02 }); }
  bow(power = 1) {
    if (!this.ok) return;
    const t = this.now;
    this._tone(t, 0.18, { type: 'triangle', from: 180 + power * 120, to: 70, vol: 0.4 });
    this._noise(t, 0.15, { type: 'bandpass', freq: 1200, q: 1, vol: 0.3, sweepTo: 400 });
  }
  slide() { if (this.ok) this._noise(this.now, 0.6, { type: 'bandpass', freq: 1800, q: 0.8, vol: 0.35, sweepTo: 500, attack: 0.03 }); }
  swap() { this.click(1400, 0.15); this.click(2000, 0.12, 0.08); }

  hit(head) {
    if (!this.ok) return;
    const t = this.now;
    this._tone(t, 0.07, { type: 'triangle', from: head ? 1900 : 1300, vol: 0.22 });
  }
  kill() {
    if (!this.ok) return;
    const t = this.now;
    this._tone(t, 0.08, { type: 'triangle', from: 1500, vol: 0.25 });
    this._tone(t + 0.08, 0.14, { type: 'triangle', from: 2100, vol: 0.25 });
  }
  /** footstep on a surface (snow / grass / sand / wood / stone / ice / water); dist = metres from me */
  step(surface = 'snow', dist = 0, vol = 1) {
    if (!this.ok) return;
    const v = vol / (1 + dist * 0.12);
    if (v < 0.03) return;
    const t = this.now;
    const S = {
      snow:  [{ type: 'bandpass', freq: 2400, q: 0.9, vol: 0.22, dur: 0.11 }, { type: 'highpass', freq: 5000, vol: 0.08, dur: 0.05 }],
      grass: [{ type: 'bandpass', freq: 1500, q: 0.6, vol: 0.18, dur: 0.09 }, { type: 'highpass', freq: 3800, vol: 0.06, dur: 0.06 }],
      sand:  [{ type: 'bandpass', freq: 3200, q: 0.5, vol: 0.18, dur: 0.14 }],
      wood:  [{ type: 'lowpass', freq: 700, vol: 0.32, dur: 0.07 }, { type: 'bandpass', freq: 1800, q: 3, vol: 0.12, dur: 0.04 }],
      stone: [{ type: 'lowpass', freq: 1200, vol: 0.28, dur: 0.05 }, { type: 'highpass', freq: 4000, vol: 0.08, dur: 0.03 }],
      ice:   [{ type: 'bandpass', freq: 3000, q: 4, vol: 0.18, dur: 0.06 }, { type: 'lowpass', freq: 600, vol: 0.18, dur: 0.05 }],
      water: [{ type: 'bandpass', freq: 900, q: 0.8, vol: 0.3, dur: 0.22, sweepTo: 2400 }, { type: 'highpass', freq: 3000, vol: 0.1, dur: 0.15 }],
    }[surface] || [{ type: 'lowpass', freq: 1000, vol: 0.25, dur: 0.07 }];
    for (const s of S) this._noise(t, s.dur, { type: s.type, freq: dist > 15 ? s.freq * 0.6 : s.freq, q: s.q || 0.7, vol: s.vol * v, sweepTo: s.sweepTo, attack: 0.004 });
    if (surface !== 'water' && surface !== 'sand') this._tone(t, 0.06, { from: 110, to: 60, vol: 0.12 * v });
  }

  land(surface = 'snow') { this.step(surface, 0, 1.8); }

  hurt() { if (this.ok) this._noise(this.now, 0.2, { freq: 600, vol: 0.4 }); }
  whiz() { if (this.ok) this._noise(this.now, 0.12, { type: 'bandpass', freq: 3000, q: 2, vol: 0.12, sweepTo: 1200 }); }

  skill(kind, dist = 0) {
    if (!this.ok) return;
    const t = this.now;
    const v = 1 / (1 + dist * 0.05);
    switch (kind) {
      case 'heal':
        [660, 880, 1320].forEach((f, i) => this._tone(t + i * 0.08, 0.3, { from: f, vol: 0.2 }));
        break;
      case 'dash':
        this._noise(t, 0.3, { type: 'bandpass', freq: 600, q: 1.5, vol: 0.5, sweepTo: 3000 });
        break;
      case 'ice':
        [2400, 3100, 3700, 2900].forEach((f, i) => this._tone(t + i * 0.04, 0.4, { type: 'triangle', from: f, vol: 0.12 * v }));
        this._noise(t, 0.35, { type: 'highpass', freq: 4000, vol: 0.25 * v });
        break;
      case 'boom':
        this._noise(t, 0.9, { freq: 900, vol: 0.9 * v, sweepTo: 80 });
        this._tone(t, 0.5, { from: 90, to: 30, vol: 0.8 * v });
        break;
      case 'fire':
        this._noise(t, 1.2, { freq: 700, vol: 0.4 * v, attack: 0.05 });
        break;
      case 'buff':
        this._tone(t, 0.5, { type: 'sawtooth', from: 200, to: 800, vol: 0.12 });
        break;
      case 'stealth':
        this._tone(t, 0.6, { from: 900, to: 200, vol: 0.18 });
        break;
      case 'teleport':
        this._tone(t, 0.3, { type: 'sine', from: 300, to: 1800, vol: 0.2 });
        this._noise(t, 0.25, { type: 'bandpass', freq: 2000, q: 2, vol: 0.3 });
        break;
      case 'zap':
        this._tone(t, 0.25, { type: 'sawtooth', from: 1800, to: 120, vol: 0.25 * v });
        this._noise(t, 0.2, { type: 'highpass', freq: 2500, vol: 0.4 * v });
        break;
      case 'shock':
        this._tone(t, 0.8, { type: 'sawtooth', from: 120, to: 40, vol: 0.4 });
        this._noise(t, 0.7, { freq: 1500, vol: 0.6, sweepTo: 100 });
        break;
      case 'pin':
        this._tone(t, 0.05, { type: 'square', from: 2600, vol: 0.12 });
        this._noise(t + 0.05, 0.08, { type: 'highpass', freq: 5000, vol: 0.2 });
        this._tone(t + 0.12, 0.06, { type: 'triangle', from: 1800, vol: 0.1 });
        break;
      case 'charge':
        this._tone(t, 0.45, { type: 'sine', from: 300, to: 1400, vol: 0.14 });
        [1800, 2400, 3000].forEach((f, i) => this._tone(t + 0.1 + i * 0.07, 0.3, { type: 'triangle', from: f, vol: 0.06 }));
        break;
      case 'orb':
        this._tone(t, 0.3, { type: 'sine', from: 1600, to: 300, vol: 0.2 });
        this._noise(t, 0.3, { type: 'bandpass', freq: 3000, q: 1.5, vol: 0.35, sweepTo: 800 });
        break;
      case 'flame':
        this._noise(t, 0.6, { type: 'bandpass', freq: 500, q: 0.8, vol: 0.35, attack: 0.1, sweepTo: 1400 });
        this._tone(t, 0.5, { type: 'sawtooth', from: 120, to: 260, vol: 0.08 });
        break;
      case 'firethrow':
        this._noise(t, 0.4, { type: 'bandpass', freq: 1200, q: 1, vol: 0.4, sweepTo: 400 });
        this._tone(t, 0.3, { type: 'sawtooth', from: 400, to: 120, vol: 0.1 });
        break;
      case 'note':
        [1047, 1319, 1568].forEach((f, i) => this._tone(t + i * 0.06, 0.35, { type: 'triangle', from: f, vol: 0.16 }));
        break;
      case 'chord':
        [523, 659, 784, 1047].forEach((f) => this._tone(t, 0.45, { type: 'triangle', from: f, vol: 0.1 }));
        this._tone(t, 0.25, { type: 'sine', from: 2000, to: 600, vol: 0.12 });
        break;
      case 'ghost':
        this._tone(t, 0.8, { type: 'sine', from: 700, to: 180, vol: 0.18 });
        this._tone(t + 0.05, 0.7, { type: 'sine', from: 1050, to: 260, vol: 0.08 });
        this._noise(t, 0.5, { type: 'highpass', freq: 3000, vol: 0.12 });
        break;
      case 'glitch':
        for (let i = 0; i < 6; i++) this._tone(t + i * 0.035, 0.04, { type: 'square', from: 200 + Math.random() * 2400, vol: 0.12 * v });
        this._noise(t, 0.25, { type: 'bandpass', freq: 1800, q: 4, vol: 0.25 * v });
        break;
      case 'laser':
        this._tone(t, 3, { type: 'sawtooth', from: 180, to: 220, vol: 0.09 * v });
        this._tone(t, 3, { type: 'square', from: 92, to: 88, vol: 0.05 * v });
        this._noise(t, 3, { type: 'bandpass', freq: 2600, q: 3, vol: 0.12 * v });
        break;
      case 'steam':
        this._noise(t, 1.4, { type: 'highpass', freq: 2500, vol: 0.45 * v, attack: 0.05 });
        this._noise(t, 0.6, { freq: 600, vol: 0.3 * v, sweepTo: 200 });
        break;
      case 'absorb':
        [523, 784, 1047].forEach((f, i) => this._tone(t + i * 0.05, 0.6, { type: 'sine', from: f, to: f * 1.5, vol: 0.12 }));
        this._noise(t, 0.4, { type: 'bandpass', freq: 3000, q: 3, vol: 0.15 });
        break;
      case 'absorbHit':
        this._tone(t, 0.18, { type: 'triangle', from: 1800, to: 1200, vol: 0.14 });
        break;
      case 'ink':
        for (let i = 0; i < 4; i++) this._tone(t + i * 0.07, 0.08, { type: 'sine', from: 300 + i * 90, to: 520 + i * 90, vol: 0.12 });
        break;
      case 'splat':
        this._noise(t, 0.3, { freq: 900, vol: 0.5 * v, sweepTo: 200 });
        this._tone(t, 0.15, { type: 'sine', from: 220, to: 90, vol: 0.3 * v });
        break;
      case 'rock':
        this._noise(t, 0.5, { freq: 400, vol: 0.55, sweepTo: 80 });
        for (let i = 0; i < 4; i++) this._tone(t + i * 0.05, 0.12, { type: 'square', from: 90 + Math.random() * 60, to: 40, vol: 0.12 });
        break;
      case 'throw':
        this._noise(t, 0.2, { type: 'bandpass', freq: 900, q: 1, vol: 0.25, sweepTo: 400 });
        break;
      default:
        this._tone(t, 0.1, { from: 800, vol: 0.1 });
    }
  }
}

export const audio = new Sfx();
