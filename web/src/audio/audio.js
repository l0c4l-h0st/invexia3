// Audio procédural (Web Audio) : le vent et le frottement renseignent sur la vitesse.
export class AudioEngine {
  constructor() { this.ctx = null; this.volume = 0.8; this.ready = false; this.stats = { oneShots: 0 }; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    // bruit blanc et rose
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.pink = ctx.createBuffer(1, len, ctx.sampleRate);
    const p = this.pink.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; p[i] = (b0 + b1 + b2) * 2.2; }
    // réverbération (réponse impulsionnelle synthétique)
    const ir = ctx.createBuffer(2, ctx.sampleRate * 2.4, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const x = ir.getChannelData(c); for (let i = 0; i < x.length; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / x.length, 3.2); }
    this.verb = ctx.createConvolver(); this.verb.buffer = ir;
    this.verbGain = ctx.createGain(); this.verbGain.gain.value = 0.22;
    this.verb.connect(this.verbGain).connect(this.master);
    this.fx = ctx.createGain(); this.fx.connect(this.master); this.fx.connect(this.verb);
    // couches continues
    const loop = (buf, type, f, q, g0 = 0) => {
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = ctx.createGain(); g.gain.value = g0;
      s.connect(fl).connect(g).connect(this.master);
      s.start(0, Math.random() * 1.5);
      return { s, fl, g };
    };
    this.wind = loop(this.pink, 'bandpass', 300, 0.6);
    this.windLo = loop(this.pink, 'lowpass', 120, 0.5);
    this.whistle = loop(this.noise, 'bandpass', 2400, 6);
    this.surf = loop(this.noise, 'bandpass', 1200, 1.4);
    this.slide = loop(this.noise, 'bandpass', 700, 0.9);
    this.brake = loop(this.pink, 'lowpass', 500, 0.7);
    this.roar = loop(this.pink, 'lowpass', 260, 0.8);
    // bourdonnement industriel lointain
    this.drone = ctx.createGain(); this.drone.gain.value = 0.05;
    const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 140;
    for (const f of [41.2, 55.4, 82.1]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 12; o.connect(dl); o.start(); }
    dl.connect(this.drone).connect(this.master);
    this.clankT = 4;
    this.ready = true;
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  /** st : {speed, hspeed, grounded, surfing, sliding, braking, furnaceDist, airborne} */
  update(dt, st) {
    if (!this.ready) return;
    const t = this.ctx.currentTime, k = 0.06;
    const v = Number.isFinite(st.speed) ? st.speed : 0;
    if (!Number.isFinite(st.hspeed)) st.hspeed = 0;
    if (!Number.isFinite(st.furnaceDist)) st.furnaceDist = 1e4;
    const w = Math.min(1, Math.max(0, (v - 3) / 70));
    this.wind.g.gain.setTargetAtTime(0.42 * Math.pow(w, 1.25) * (st.airborne ? 1 : 0.75), t, k);
    this.wind.fl.frequency.setTargetAtTime(220 + Math.min(3200, v * 16), t, k);
    this.windLo.g.gain.setTargetAtTime(0.5 * Math.min(1, v / 90), t, k);
    const wh = Math.max(0, (v - 45) / 160);
    this.whistle.g.gain.setTargetAtTime(0.14 * Math.min(1, Math.pow(wh, 1.3)), t, k);
    this.whistle.fl.frequency.setTargetAtTime(1600 + Math.min(5200, v * 14), t, k);
    this.surf.g.gain.setTargetAtTime(st.surfing ? Math.min(0.42, 0.08 + v / 220) : 0, t, st.surfing ? 0.03 : 0.12);
    this.surf.fl.frequency.setTargetAtTime(700 + Math.min(3800, v * 13), t, k);
    this.slide.g.gain.setTargetAtTime(st.sliding ? Math.min(0.35, 0.12 + st.hspeed / 60) : 0, t, 0.05);
    this.slide.fl.frequency.setTargetAtTime(450 + st.hspeed * 22, t, k);
    this.brake.g.gain.setTargetAtTime(st.braking && v > 2 ? Math.min(0.32, 0.08 + v / 300) : 0, t, 0.06);
    const roar = st.furnaceDist < 700 ? Math.pow(1 - st.furnaceDist / 700, 1.6) * 0.38 : 0;
    this.roar.g.gain.setTargetAtTime(roar, t, 0.3);
    // claquements métalliques lointains
    this.clankT -= dt;
    if (this.clankT < 0) { this.clankT = 7 + Math.random() * 12; this.clank(0.05 + Math.random() * 0.05); }
  }

  _env(node, t0, a, peak, dec, end = 0.0001) {
    node.gain.setValueAtTime(0.0001, t0);
    node.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
    node.gain.exponentialRampToValueAtTime(end, t0 + a + dec);
  }
  _noise(t0, dur, type, f, q, peak, a = 0.002, out = this.fx, buf = this.noise, f2 = null) {
    const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = buf;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t0); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    const g = ctx.createGain();
    s.connect(fl).connect(g).connect(out);
    this._env(g, t0, a, peak, dur);
    s.start(t0, Math.random() * 1.5, dur + a + 0.05);
    this.stats.oneShots++;
  }
  _tone(t0, f, dur, peak, type = 'sine', f2 = null, out = this.fx) {
    const ctx = this.ctx, o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    const g = ctx.createGain(); o.connect(g).connect(out);
    this._env(g, t0, 0.003, peak, dur);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  clank(v) {
    const t = this.ctx.currentTime;
    const base = 180 + Math.random() * 260;
    for (const m of [1, 2.76, 5.4]) this._tone(t, base * m, 1.4 / m, v / m, 'sine', null, this.verb);
  }

  play(name, o = {}) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'step': {
        const loud = Math.min(1, 0.35 + o.speed / 12) * (o.sprint ? 1.15 : 0.85);
        this._tone(t, 75 + Math.random() * 15, 0.09, 0.22 * loud);
        if (o.mat === 'metal') { this._noise(t, 0.05, 'bandpass', 3200, 1.5, 0.22 * loud); this._tone(t, 620 + Math.random() * 380, 0.18, 0.05 * loud, 'triangle'); }
        else if (o.mat === 'water') { this._noise(t, 0.16, 'lowpass', 1400, 0.8, 0.3 * loud, 0.01, this.fx, this.noise, 500); }
        else if (o.mat === 'gravel') { for (let k = 0; k < 3; k++) this._noise(t + k * 0.018, 0.04, 'bandpass', 2400 + Math.random() * 1500, 1.1, 0.16 * loud); }
        else this._noise(t, 0.05, 'bandpass', 1700, 1.2, 0.2 * loud);
        break;
      }
      case 'jump':
        this._noise(t, 0.16, 'bandpass', 500, 0.9, o.chained ? 0.06 : 0.12, 0.02, this.fx, this.pink, 1200);
        break;
      case 'land': {
        const k = Math.min(1, o.impact / 22);
        this._tone(t, 58, 0.25 + k * 0.2, 0.25 + 0.45 * k, 'sine', 38);
        if (o.mat === 'metal') { this._noise(t, 0.09, 'bandpass', 2600, 1.2, 0.15 + 0.3 * k); if (k > 0.5) this.clank(0.12 * k); }
        else if (o.mat === 'water') this._noise(t, 0.35, 'lowpass', 1800, 0.7, 0.4 * (0.4 + k), 0.01, this.fx, this.noise, 400);
        else this._noise(t, 0.12, 'lowpass', 1200 + k * 1800, 0.8, 0.18 + 0.3 * k);
        break;
      }
      case 'slide': this._noise(t, 0.35, 'bandpass', 900, 0.8, 0.22, 0.01, this.fx, this.noise, 500); break;
      case 'dive': this._noise(t, 0.4, 'bandpass', 400, 0.8, 0.2, 0.05, this.fx, this.pink, 1500); break;
      case 'impact': this._tone(t, 70, 0.2, Math.min(0.5, o.speed / 40), 'sine', 40); this._noise(t, 0.1, 'lowpass', 900, 0.7, Math.min(0.4, o.speed / 50)); break;
      case 'inspect-draw':
        this._noise(t, 0.25, 'bandpass', 800, 0.7, 0.12, 0.03, this.fx, this.pink, 1600);
        for (const f of [2140, 3460]) this._tone(t + 0.12, f, 0.7, 0.025);
        break;
      case 'inspect-flip':
        this._noise(t, 0.28, 'bandpass', 3000, 4, 0.16, 0.01, this.fx, this.noise, 8200);
        for (const [f, a] of [[2920, 0.06], [4630, 0.04], [6310, 0.025], [8110, 0.015]]) this._tone(t + 0.04, f, 1.1, a);
        break;
      case 'inspect-end': this._noise(t, 0.03, 'highpass', 3000, 0.7, 0.08); this._tone(t, 1800, 0.12, 0.02, 'triangle'); break;
      case 'respawn': this._noise(t, 0.6, 'lowpass', 600, 0.7, 0.2, 0.1, this.fx, this.pink, 200); break;
      case 'ui': this._tone(t, 880, 0.06, 0.05, 'triangle'); break;
      case 'gate': this._tone(t, 660, 0.15, 0.1, 'triangle'); this._tone(t + 0.12, 990, 0.25, 0.1, 'triangle'); break;
    }
  }
}
