// Velocity FPS — boucle principale.
import * as THREE from 'three';
import { TICK, PHYS, DEFAULT_SETTINGS } from './core/config.js';
import { Terrain } from './core/terrain.js';
import { Collision } from './core/collision.js';
import { Player } from './core/player.js';
import { Input } from './core/input.js';
import { GEO } from './core/geo.js';
import { WorldBuilder } from './world/builder.js';
import { buildWorld } from './world/layout.js';
import { Sectors } from './world/sectors.js';
import { WorldRenderer } from './render/scene.js';
import { ViewModel } from './view/viewmodel.js';
import { AudioEngine } from './audio/audio.js';
import { Bot, headingOf, wrap } from './test/bot.js';

const $ = (id) => document.getElementById(id);
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const TEST = window.__VELOCITY_TEST || {};

// ---------------- réglages ----------------
const settings = (() => {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('velocity.settings') || '{}') }; } catch { return { ...DEFAULT_SETTINGS }; }
})();
if (TEST.settings) Object.assign(settings, TEST.settings);
if (settings.fpsCounter === undefined) settings.fpsCounter = true;
const save = () => { try { localStorage.setItem('velocity.settings', JSON.stringify(settings)); } catch { /* stockage indisponible */ } };
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* rien */ } } };

// ---------------- physique réglable (F1) ----------------
const PHYS_DEFAULT = { ...PHYS };
const TUNABLE = [
  ['airAccel', 'Accélération en l\'air', 5, 120, 1, (v) => v.toFixed(0)],
  ['airWishCap', 'Plafond de strafe (m/s)', 0.3, 4, 0.05, (v) => v.toFixed(2)],
  ['gravity', 'Gravité (m/s²)', 8, 30, 0.1, (v) => v.toFixed(1)],
  ['jumpVel', 'Impulsion de saut (m/s)', 4, 11, 0.05, (v) => v.toFixed(2)],
  ['friction', 'Friction au sol', 1, 10, 0.1, (v) => v.toFixed(1)],
  ['frictionMaxDecel', 'Friction max (m/s²)', 10, 300, 1, (v) => (v >= 300 ? 'libre' : v.toFixed(0))],
  ['walkSpeed', 'Marche (m/s)', 3, 9, 0.1, (v) => v.toFixed(1)],
  ['sprintSpeed', 'Sprint (m/s)', 5, 14, 0.1, (v) => v.toFixed(1)],
  ['slideBoost', 'Élan de glissade (m/s)', 0, 8, 0.1, (v) => v.toFixed(1)],
];
const pickTunable = (o) => Object.fromEntries(TUNABLE.map(([k]) => [k, o[k]]));
const PRESETS = {
  arcade: { airAccel: 60, airWishCap: 2.8, gravity: 18, jumpVel: 7.6, friction: 4, frictionMaxDecel: 35, walkSpeed: 5.6, sprintSpeed: 9.4, slideBoost: 4 },
  standard: pickTunable(PHYS_DEFAULT),
  source: { airAccel: 12, airWishCap: 0.76, gravity: 20.3, jumpVel: 7.15, friction: 5.2, frictionMaxDecel: 300, walkSpeed: 6.35, sprintSpeed: 6.35, slideBoost: 2 },
};
const PRESET_NOTES = {
  arcade: 'Arcade : gains de strafe plus forts, 100 m/s vite atteints, réceptions plus douces.',
  standard: 'Standard : réglage livré, environ 16 s de rebonds bien synchronisés pour passer 100 m/s sur du plat, moins avec une descente.',
  source: 'Source classique : plafond de strafe de 30 unités (0,76 m/s), friction sans limite. Exigeant : chaque m/s se mérite.',
};

const G = {
  state: 'loading', yaw: 0, pitch: 0, yawPrev: 0, acc: 0, time: 0,
  camDip: { x: 0, v: 0 }, camKick: { x: 0, v: 0 }, shakeT: 0, shakeA: 0, roll: 0,
  landImpulse: 0, fps: 0, frames: 0, fpsT: 0, frameMs: [],
  sector: null, sectorT: 0, sectorLog: [], visited: new Set(),
  pen: { max: 0, over5cm: 0, checks: 0 },
  bot: null, synth: null, help: { shown: false, t: 0, done: new Set() },
  milestones: new Set(), act: null, slidePressed: false,
  simTime: 0, snaps: [], snapAcc: 0, rewindDepth: 3, lastRewindAt: -99, rewinds: 0,
  sync: { n: 0, ok: 0, v0: 0, live: false }, syncLast: null, syncYaw: null,
  inspectCount: 0, airStart: 0,
};
window.__velocity = { G };

function applyPhys(o) { Object.assign(PHYS, o); }
async function boot() {
  if (!TEST.quality) { try { const sp = JSON.parse(localStorage.getItem('velocity.phys') || 'null'); if (sp) applyPhys(sp); } catch { /* rien */ } }
  const setLoad = (p, m) => { $('loadbar').style.width = `${Math.round(p * 100)}%`; $('loadmsg').textContent = m; };
  setLoad(0.05, 'Coulée du terrain…'); await nextFrame();
  const terrain = new Terrain();
  setLoad(0.25, 'Montage des rampes et viaducs…'); await nextFrame();
  const col = new Collision(terrain);
  const B = new WorldBuilder(col, terrain);
  const info = buildWorld(B);
  const sectors = new Sectors(info.sectors);
  setLoad(0.45, 'Allumage des hauts-fourneaux…'); await nextFrame();
  const canvas = $('view');
  let quality = TEST.quality || settings.quality;
  const probe = (() => { try { const gl = canvas.getContext('webgl2') || canvas.getContext('webgl'); const ext = gl && gl.getExtension('WEBGL_debug_renderer_info'); return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : ''; } catch { return ''; } })();
  if (quality === 'auto') quality = /swiftshader|llvmpipe|software/i.test(probe) ? 'low' : 'medium';
  const R = new WorldRenderer(canvas, quality);
  G.quality = quality; G.gpu = probe;
  setLoad(0.6, 'Terrain et horizon…'); await nextFrame();
  R.buildTerrain(terrain, info.roads);
  setLoad(0.72, 'Chargement des secteurs proches…'); await nextFrame();
  R.attachWorld(B);
  R.updateStreaming({ x: 0, z: 0 }, { x: 0, z: 0 }, 0, true);
  setLoad(0.86, 'Gants et couteau…'); await nextFrame();
  const vm = new ViewModel(R.renderer);
  const audio = new AudioEngine();
  vm.onSound = (n) => audio.play(n);
  const player = new Player(col);
  const sp = info.spawn;
  player.spawn(sp.x, sp.y, sp.z, sp.yaw);
  const input = new Input(canvas);
  Object.assign(G, { terrain, col, B, info, sectors, R, vm, audio, player, input });
  const onResize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    R.resize(w, h, TEST.renderScale || 1);
    vm.resize(w / h);
  };
  window.addEventListener('resize', onResize);
  onResize();
  applySettings();
  bindUI();
  setLoad(1, 'Prêt.');
  $('load').hidden = true;
  $('play').disabled = false;
  $('play').focus({ preventScroll: true });
  G.state = 'title';
  G.lastNow = performance.now();
  requestAnimationFrame(frame);
}

// ---------------- interface ----------------
function applySettings() {
  const { R, audio } = G;
  audio.setVolume(settings.volume);
  for (const [id, key, fmt] of [['sens', 'sensitivity', (v) => v.toFixed(2)], ['fov', 'fov', (v) => `${v}°`], ['shake', 'shake', (v) => `${Math.round(v * 100)} %`], ['bob', 'bob', (v) => `${Math.round(v * 100)} %`], ['vol', 'volume', (v) => `${Math.round(v * 100)} %`]]) {
    $(`s-${id}`).value = settings[key]; $(`o-${id}`).textContent = fmt(+settings[key]);
  }
  $('s-dfov').checked = settings.dynamicFov; $('s-lines').checked = settings.speedLines; $('s-inv').checked = settings.invertY; $('s-help').checked = settings.showHelp;
  $('s-q').value = settings.quality;
}

function bindUI() {
  const { input, audio } = G;
  $('play').addEventListener('click', () => startPlay(true));
  $('resume').addEventListener('click', () => startPlay(false));
  $('respawn').addEventListener('click', () => { stopActivity(); respawn(); startPlay(false); });
  $('fullscreen').addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      if (navigator.keyboard && navigator.keyboard.lock) await navigator.keyboard.lock().catch(() => {});
    } catch { toast('Plein écran indisponible ici', 'Ouvrez le fichier HTML autonome'); }
  });
  const bindRange = (id, key, fmt) => $(`s-${id}`).addEventListener('input', (e) => { settings[key] = +e.target.value; $(`o-${id}`).textContent = fmt(settings[key]); if (key === 'volume') audio.setVolume(settings.volume); save(); });
  bindRange('sens', 'sensitivity', (v) => v.toFixed(2));
  bindRange('fov', 'fov', (v) => `${v}°`);
  bindRange('shake', 'shake', (v) => `${Math.round(v * 100)} %`);
  bindRange('bob', 'bob', (v) => `${Math.round(v * 100)} %`);
  bindRange('vol', 'volume', (v) => `${Math.round(v * 100)} %`);
  $('s-dfov').addEventListener('change', (e) => { settings.dynamicFov = e.target.checked; save(); });
  $('s-lines').addEventListener('change', (e) => { settings.speedLines = e.target.checked; save(); });
  $('s-inv').addEventListener('change', (e) => { settings.invertY = e.target.checked; save(); });
  $('s-help').addEventListener('change', (e) => { settings.showHelp = e.target.checked; save(); if (e.target.checked) G.help.shown = false; });
  $('s-q').addEventListener('change', (e) => { settings.quality = e.target.value; save(); toast('Qualité enregistrée', 'Appliquée au prochain chargement de la page'); });
  $('act-coulees').addEventListener('click', () => startActivity('coulees'));
  $('act-boucle').addEventListener('click', () => startActivity('boucle'));
  $('act-stop').addEventListener('click', () => { stopActivity(); startPlay(false); });
  input.onLockChange = (locked) => {
    if (locked) { if (G.state !== 'playing') enterPlaying(); }
    else if (G.state === 'playing' && !input.dragLook) pause();
  };
  input.onEscape = () => {
    if (G.state === 'playing') pause();
    else if (G.state === 'paused' && performance.now() - (G.pausedAt || 0) > 400) startPlay(false);
  };
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'F1') return;
    e.preventDefault();
    if (G.state === 'playing') openTuner();
    else if (G.tuning) startPlay(false);
  }, { capture: true });
  $('tuner-close').addEventListener('click', () => startPlay(false));
  $('s-fps').checked = settings.fpsCounter;
  $('s-fps').addEventListener('change', (e) => { settings.fpsCounter = e.target.checked; save(); });
  document.querySelectorAll('#presets .preset').forEach((b) => b.addEventListener('click', () => { setPreset(b.dataset.preset); }));
  const box = $('physsliders');
  for (const [k, label, min, max, step, fmt] of TUNABLE) {
    const l = document.createElement('label'); l.className = 'set';
    l.innerHTML = `${label} <input type="range" id="p-${k}" min="${min}" max="${max}" step="${step}"><output id="po-${k}"></output>`;
    box.appendChild(l);
    l.querySelector('input').addEventListener('input', (e) => { PHYS[k] = +e.target.value; $(`po-${k}`).textContent = fmt(PHYS[k]); savePhys(); markPreset(); });
  }
  window.addEventListener('beforeunload', (e) => { if (G.state === 'playing' || G.state === 'paused') { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'playing') pause(); });
}

async function startPlay(first) {
  const { input, audio } = G;
  audio.init();
  audio.play('ui');
  $('lockwarn').hidden = true;
  if (TEST.noLock) { input.dragLook = true; enterPlaying(); return; }
  const ok = await input.lock();
  if (ok) { if (G.state !== 'playing') enterPlaying(); return; }
  // verrouillage refusé (aperçu intégré, sortie trop récente…)
  if (input.lastLockError && /InUse|WrongDocument|Security|NotSupported/i.test(input.lastLockError) || !input.lockSupported) {
    input.dragLook = true;
    enterPlaying();
    toast('Souris libre', 'Maintenez le clic pour regarder · ouvrez le HTML autonome pour la souris verrouillée');
  } else {
    $('lockwarn').hidden = false;
    $('lockwarn').textContent = 'Le navigateur a refusé de verrouiller la souris. Cliquez de nouveau sur « Reprendre ».';
  }
}

function savePhys() { try { localStorage.setItem('velocity.phys', JSON.stringify(pickTunable(PHYS))); } catch { /* rien */ } }
function markPreset() {
  const cur = pickTunable(PHYS);
  let found = null;
  for (const [name, p] of Object.entries(PRESETS)) if (Object.keys(p).every((k) => Math.abs(p[k] - cur[k]) < 1e-6)) found = name;
  document.querySelectorAll('#presets .preset').forEach((b) => b.classList.toggle('on', b.dataset.preset === found));
  $('presetnote').textContent = found ? PRESET_NOTES[found] : 'Réglage personnalisé.';
}
function setPreset(name) { applyPhys(PRESETS[name]); savePhys(); refreshTuner(); G.audio.play('ui'); }
function refreshTuner() {
  for (const [k, , , , , fmt] of TUNABLE) { $(`p-${k}`).value = PHYS[k]; $(`po-${k}`).textContent = fmt(PHYS[k]); }
  markPreset();
}
function openTuner() {
  if (G.state !== 'playing') return;
  G.state = 'paused'; G.tuning = true;
  G.pausedAt = performance.now();
  G.input.enabled = false;
  G.input.unlock();
  G.audio.suspend();
  $('tuner').hidden = false; $('hud').hidden = true;
  refreshTuner();
}

function enterPlaying() {
  const { input, audio } = G;
  G.state = 'playing';
  G.tuning = false;
  $('tuner').hidden = true;
  input.enabled = true;
  input.clearEdges();
  input.takeMouse();
  $('title').hidden = true; $('pause').hidden = true; $('hud').hidden = false;
  audio.resume();
  if (settings.showHelp && !G.help.shown) showHelp(true);
  G.lastNow = performance.now();
  G.acc = 0;
}

function pause() {
  if (G.state !== 'playing') return;
  G.state = 'paused';
  G.pausedAt = performance.now();
  G.input.enabled = false;
  G.input.unlock();
  G.audio.suspend();
  $('pause').hidden = false;
  $('hud').hidden = true;
  updateStats();
  $('act-stop').hidden = !G.act;
}

/** R : revient ~3 s en arrière, vitesse comprise (y compris en plein saut). On évite les instants
 *  de chute profonde ; des appuis rapprochés remontent plus loin. */
function rewind() {
  const pl = G.player, now = G.simTime;
  const back = now - G.lastRewindAt < 2.5 ? G.rewindDepth + 3 : 3;
  const target = now - back;
  let snap = null;
  for (let i = G.snaps.length - 1; i >= 0; i--) { const s = G.snaps[i]; if (s.t <= target && s.ok) { snap = s; break; } }
  if (!snap) for (let i = G.snaps.length - 1; i >= 0; i--) { if (G.snaps[i].t <= target) { snap = G.snaps[i]; break; } }
  if (!snap) snap = G.snaps[0];
  if (!snap) return false;
  G.lastRewind = { from: { x: pl.pos.x, z: pl.pos.z, speed: pl.hspeed }, to: { x: snap.x, z: snap.z, speed: Math.hypot(snap.vx, snap.vz) }, seconds: now - snap.t };
  pl.spawn(snap.x, snap.y, snap.z, snap.yaw);
  pl.vel.x = snap.vx; pl.vel.y = snap.vy; pl.vel.z = snap.vz;
  G.yaw = snap.yaw; G.pitch = snap.pitch; G.syncYaw = null;
  G.snaps = G.snaps.filter((s) => s.t <= snap.t);
  G.rewindDepth = back; G.lastRewindAt = now; G.rewinds++;
  G.R.stream.grace = 30;
  G.audio.play('respawn');
  helpDone('rewind');
  toast('Retour à l\'élan', `−${(now - snap.t).toFixed(1)} s · ${Math.round(Math.hypot(snap.vx, snap.vz))} m/s`);
  return true;
}

function respawn() {
  const sp = G.info.spawn;
  G.player.spawn(sp.x, sp.y, sp.z, sp.yaw);
  G.yaw = sp.yaw; G.pitch = 0;
}

function updateStats() {
  const s = G.player.stats;
  const best = store.get('velocity.best', {});
  $('stats').innerHTML = `
    <div><b>${(s.distance / 1000).toFixed(2)} km</b><span>parcourus</span></div>
    <div><b>${Math.round(s.topSpeed)} m/s</b><span>vitesse max</span></div>
    <div><b>${s.maxChain}</b><span>rebonds enchaînés</span></div>
    ${best.coulees ? `<div><b>${fmtTime(best.coulees)}</b><span>défi des Coulées</span></div>` : ''}
    ${best.boucle ? `<div><b>${fmtTime(best.boucle)}</b><span>tour de Boucle</span></div>` : ''}`;
}

function fmtTime(t) { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s.toFixed(2).padStart(5, '0')}`; }

let toastT = null;
function toast(title, sub = '') {
  const el = $('toast');
  el.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`;
  el.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('on'), 2600);
}

function showHelp(on) {
  const el = $('help');
  el.hidden = !on;
  el.style.opacity = on ? 1 : 0;
  if (on) { G.help.shown = true; G.help.t = 0; }
}
function helpDone(k) {
  if (G.help.done.has(k)) return;
  G.help.done.add(k);
  const li = document.querySelector(`#help li[data-k="${k}"]`);
  if (li) li.classList.add('done');
}

// ---------------- activités chronométrées (facultatives) ----------------
function startActivity(kind) {
  const P = G.info.plazas;
  stopActivity();
  if (kind === 'coulees') {
    respawn();
    G.yaw = Math.PI / 4; // vers le nord-est
    G.player.yaw = G.yaw;
    G.act = { kind, t: 0, running: false, label: 'Défi des Coulées · rejoindre le gueulard du fourneau central' };
  } else {
    const D = P.find((p) => p.id === 'D');
    G.player.spawn(D.x, D.y + 0.75, D.z, headingOf(D.tx, D.tz));
    G.yaw = headingOf(D.tx, D.tz); G.pitch = 0;
    G.act = { kind, t: 0, running: true, next: 0, order: ['F', 'P', 'G', 'D'], label: 'Tour de la Boucle · Fourneaux → Plaine → Gazomètre → Darse' };
  }
  $('chrono').hidden = false;
  toast(kind === 'coulees' ? 'Défi des Coulées' : 'Tour de la Boucle', G.act.label.split('·')[1]);
  startPlay(false);
}
function stopActivity() { G.act = null; $('chrono').hidden = true; }

function updateActivity(dt) {
  const a = G.act; if (!a) return;
  const p = G.player.pos;
  if (a.kind === 'coulees') {
    if (!a.running) {
      const s = (p.x - p.z) * Math.SQRT1_2, l = (p.x + p.z) * Math.SQRT1_2;
      if (s > 24 && Math.abs(l) < 40) { a.running = true; a.t = 0; G.audio.play('gate'); }
    } else {
      a.t += dt;
      const F = GEO.furnaces, cx = F.x + 60 * Math.SQRT1_2, cz = F.z - 60 * Math.SQRT1_2;
      if (Math.hypot(p.x - cx, p.z - cz) < 18 && p.y > G.info.furnaceTop - 1) finishActivity();
    }
  } else {
    a.t += dt;
    const id = a.order[a.next];
    const P = G.info.plazas.find((q) => q.id === id);
    if (Math.hypot(p.x - P.x, p.z - P.z) < 75 && p.y > P.y - 6) {
      G.audio.play('gate');
      a.next++;
      if (a.next >= a.order.length) finishActivity();
      else toast(`Point ${a.next}/4`, P.name);
    }
  }
  $('chrono').textContent = a.running ? fmtTime(a.t) : 'Partez quand vous voulez ↗';
}
function finishActivity() {
  const a = G.act;
  const best = store.get('velocity.best', {});
  const isBest = !best[a.kind] || a.t < best[a.kind];
  if (isBest) { best[a.kind] = a.t; store.set('velocity.best', best); }
  toast(`${fmtTime(a.t)}${isBest ? ' · record' : ''}`, 'Défi terminé, la balade continue');
  stopActivity();
}

// ---------------- boucle ----------------
const tmpV = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = (now - G.lastNow) / 1000;
  G.lastNow = now;
  const dt = Math.min(TEST.dtCap || 0.1, Math.max(0, rawDt));
  G.time += dt;
  G.frames++; G.fpsT += rawDt;
  G.frameMs.push(rawDt * 1000); if (G.frameMs.length > 240) G.frameMs.shift();
  if (G.fpsT >= 1) { G.fps = G.frames / G.fpsT; G.frames = 0; G.fpsT = 0; }
  const { player: pl, input, R, vm, audio } = G;
  let mdx = 0, mdy = 0;

  if (G.state === 'playing' && G.frozen) {
    input.takeMouse();
    trackSector(dt);
  } else if (G.state === 'playing') {
    [mdx, mdy] = input.takeMouse();
    if (G.bot) { mdx = 0; mdy = 0; }
    const sens = settings.sensitivity * 0.022 * Math.PI / 180;
    const yawStart = G.yaw;
    G.yaw -= mdx * sens;
    G.pitch -= mdy * sens * (settings.invertY ? -1 : 1);
    G.pitch = Math.max(-1.55, Math.min(1.55, G.pitch));
    if (input.pressed('KeyF')) { vm.startInspect(); G.inspectCount++; helpDone('inspect'); }
    if (input.pressed('KeyR')) rewind();
    if (input.pressed('KeyH')) showHelp($('help').hidden);
    if (input.pressed('KeyC')) G.slidePressed = true;
    if (input.pressed('Space')) G.jumpBuffer = 0.12; // un appui bref n'est jamais perdu
    G.acc += dt;
    let n = Math.floor(G.acc / TICK);
    const cap = TEST.maxTicks || 12;
    if (n > cap) { n = cap; G.acc = 0; }
    const yawEnd = G.yaw;
    for (let i = 0; i < n; i++) {
      let inp;
      if (G.bot) {
        inp = G.bot.input(pl, TICK);
        const real = input.state();
        inp.brake = inp.brake || real.brake;
        G.yaw = inp.yaw;
        if (G.botExtra) Object.assign(inp, G.botExtra);
      } else {
        inp = input.state();
        if (G.synth) for (const k in G.synth) inp[k] = inp[k] || G.synth[k];
        inp.yaw = yawStart + wrap(yawEnd - yawStart) * ((i + 1) / n);
      }
      inp.pitch = G.pitch;
      inp.slidePressed = G.slidePressed; G.slidePressed = false;
      if (G.jumpBuffer > 0) { inp.jumpPressed = true; G.jumpBuffer -= TICK; if (pl.onGround) G.jumpBuffer = 0; }
      if (inp.slide && G.synthSlideEdge) { inp.slidePressed = true; G.synthSlideEdge = false; }
      // jauge de synchronisation : en l'air, la souris tourne-t-elle du côté de la touche de strafe ?
      const dyaw = G.syncYaw === null ? 0 : wrap(inp.yaw - G.syncYaw);
      G.syncYaw = inp.yaw;
      if (!pl.onGround && !pl.surfing && G.sync.live) {
        const sl = inp.left && !inp.right, sr = inp.right && !inp.left, turning = Math.abs(dyaw) > 2e-5;
        if (sl || sr || turning) { G.sync.n++; if ((sl && dyaw > 2e-5) || (sr && dyaw < -2e-5)) G.sync.ok++; }
      }
      const vyAir = pl.vel.y;
      pl.tick(inp, TICK);
      G.simTime += TICK;
      // instantanés pour le retour à l'élan (R)
      G.snapAcc += TICK;
      if (G.snapAcc >= 0.2) {
        G.snapAcc = 0;
        G.snaps.push({ t: G.simTime, x: pl.pos.x, y: pl.pos.y, z: pl.pos.z, vx: pl.vel.x, vy: pl.vel.y, vz: pl.vel.z, yaw: G.yaw, pitch: G.pitch, ok: pl.onGround || pl.surfing || pl.vel.y > -22 });
        if (G.snaps.length > 200) G.snaps.shift();
      }
      handleEvents(pl, vyAir);
      // contrôle anti-traversée
      if ((G.pen.checks++ & 3) === 0) {
        const d = G.col.penetration(pl.pos, pl.r - 0.02);
        if (d > G.pen.max) G.pen.max = d;
        if (d > 0.05) G.pen.over5cm++;
      }
    }
    if (G.bot) G.yaw = G.bot.yaw;
    G.acc -= n * TICK;
    updateActivity(dt);
    trackSector(dt);
    trackHelp(dt);
  } else if (G.state === 'title') {
    // caméra d'ambiance autour du Belvédère
    const a = G.time * 0.05;
    G.yaw = Math.PI * 0.08 + Math.sin(a) * 0.5;
    G.pitch = -0.06 + Math.sin(a * 0.7) * 0.03;
  }

  // caméra
  const alpha = G.state === 'playing' ? Math.min(1, G.acc / TICK) : 1;
  const cam = R.camera;
  const px = pl.prev.x + (pl.pos.x - pl.prev.x) * alpha;
  const py = pl.prev.y + (pl.pos.y - pl.prev.y) * alpha;
  const pz = pl.prev.z + (pl.pos.z - pl.prev.z) * alpha;
  const shake = settings.shake, bobS = settings.bob;
  // ressorts caméra (réception, à-coups)
  {
    // ressorts intégrés par sous-pas fixes (stables même à 10 images/s)
    const nSub = Math.max(1, Math.ceil(dt * 240)), h = dt / nSub;
    for (let k = 0; k < nSub; k++) for (const s of [G.camDip, G.camKick]) { const a = -s.x * 140 - s.v * 17; s.v += a * h; s.x += s.v * h; }
  }
  const hs = pl.hspeed, sp = pl.speed;
  const stepPhase = (pl.stepDist / pl.stride + (pl.stepSide > 0 ? 1 : 0)) % 2;
  const bobAmp = pl.onGround && pl.slideT <= 0 ? Math.min(1, hs / 8.6) * (pl.sprinting ? 0.055 : 0.035) * bobS : 0;
  G.bobA = (G.bobA || 0) + (bobAmp - (G.bobA || 0)) * Math.min(1, dt * 8);
  const bobY = -Math.abs(Math.sin(stepPhase * Math.PI)) * G.bobA + G.bobA * 0.5;
  const bobX = Math.cos(stepPhase * Math.PI) * G.bobA * 0.35;
  G.shakeT = Math.max(0, G.shakeT - dt);
  const sk = G.shakeT > 0 ? G.shakeA * (G.shakeT / 0.2) * shake : 0;
  G.camShakeOffset = Math.abs(G.camDip.x * shake) + Math.abs(G.camKick.x * shake) + sk;
  G.camShakeMax = Math.max(G.camShakeMax || 0, G.camShakeOffset);
  const right = { x: Math.cos(G.yaw), z: -Math.sin(G.yaw) };
  // roulis : léger penché dans le strafe en l'air / en glissade
  const lat = pl.vel.x * right.x + pl.vel.z * right.z;
  const rollT = G.state === 'playing' ? Math.max(-0.035, Math.min(0.035, -lat * 0.0015)) * bobS + (pl.slideT > 0 ? 0.03 * bobS : 0) : 0;
  G.roll += (rollT - G.roll) * Math.min(1, dt * 5);
  if (G.state === 'title') {
    cam.position.set(Math.sin(G.time * 0.05) * 6, 108 + Math.sin(G.time * 0.2) * 0.5, 10);
  } else {
    cam.position.set(px + right.x * bobX, py + pl.eye + bobY + G.camDip.x * shake, pz + right.z * bobX);
  }
  cam.rotation.order = 'YXZ';
  cam.rotation.y = G.yaw + (Math.random() - 0.5) * sk;
  cam.rotation.x = G.pitch + G.camKick.x * shake + (Math.random() - 0.5) * sk;
  cam.rotation.z = G.roll + (Math.random() - 0.5) * sk * 0.5;
  // champ de vision (FOV horizontal → vertical) + élargissement avec la vitesse
  const dyn = settings.dynamicFov && G.state === 'playing' ? 16 * (1 - Math.exp(-Math.max(0, sp - 12) / 110)) : 0;
  G.fovH = (G.fovH || settings.fov) + ((settings.fov + dyn) - (G.fovH || settings.fov)) * Math.min(1, dt * 3);
  const hf = Math.min(150, G.fovH) * Math.PI / 180;
  const vf = 2 * Math.atan(Math.tan(hf / 2) / (16 / 9)) * 180 / Math.PI; // FOV défini en 16:9 (Hor+)
  if (Math.abs(cam.fov - vf) > 0.01) { cam.fov = vf; cam.updateProjectionMatrix(); }

  // monde
  R.updateStreaming(cam.position, G.state === 'playing' ? pl.vel : { x: 0, z: 0 }, 5);
  R.updateFx(dt, cam.position);
  R.updateSun(cam.position);

  // vue à la première personne
  const fwd = { x: -Math.sin(G.yaw), z: -Math.cos(G.yaw) };
  tmpV.set(lat, pl.vel.y, -(pl.vel.x * fwd.x + pl.vel.z * fwd.z));
  const surfSide = pl.surfing ? Math.sign(pl.surfN.x * right.x + pl.surfN.z * right.z) : 0;
  vm.update({
    dt, mouseDX: mdx, mouseDY: mdy, vel: tmpV, grounded: pl.onGround, sprint: pl.sprinting, slide: pl.slideT > 0, dive: pl.diving,
    surf: pl.surfing, surfSide, speed: sp, stepPhase, landImpulse: G.landImpulse, shake, bob: bobS, speedLines: settings.speedLines, strafe: lat,
  });
  G.landImpulse = 0;
  vm.visible = G.state !== 'title';

  // audio
  audio.update(dt, {
    speed: G.state === 'playing' ? sp : 0, hspeed: hs, airborne: !pl.onGround, surfing: pl.surfing, sliding: pl.slideT > 0, braking: pl.braking,
    furnaceDist: Math.hypot(pl.pos.x - GEO.furnaces.x, pl.pos.z - GEO.furnaces.z),
  });

  if (G.state !== 'title') updateHUD(dt);
  if (G.tuning) {
    G.perfT = (G.perfT || 0) - dt;
    if (G.perfT <= 0) {
      G.perfT = 0.5;
      const f = window.__velocity.frameStats(), inf = R.renderer.info.render;
      $('perf').innerHTML = `<div><b>${Math.round(f.fps)}</b><span>images/s</span></div><div><b>${(f.p50 || 0).toFixed(1)}</b><span>ms médiane</span></div><div><b>${(f.p95 || 0).toFixed(1)}</b><span>ms 95e centile</span></div><div><b>${inf.calls}</b><span>appels de dessin</span></div>`;
    }
  }
  R.render();
  vm.render();
}

function handleEvents(pl, vyAir) {
  const { audio } = G;
  for (const e of pl.events) {
    switch (e.type) {
      case 'step': audio.play('step', e); break;
      case 'jump':
        audio.play('jump', e);
        G.sync = { n: 0, ok: 0, v0: e.speed, live: true };
        break;
      case 'land': {
        audio.play('land', e);
        if (G.sync.live && G.sync.n > 8) G.syncLast = { pct: Math.round(100 * G.sync.ok / G.sync.n), gain: pl.hspeed - G.sync.v0 };
        G.sync.live = false;
        const chainK = pl.stats.chain > 0 ? 0.45 : 1;
        const k = Math.min(1, e.impact / 25);
        G.camDip.v -= (0.4 + 2.6 * k) * chainK * (e.dive ? 1.4 : 1);
        G.camKick.v -= (0.05 + 0.5 * k) * chainK;
        G.landImpulse = Math.max(G.landImpulse, e.impact * chainK);
        if (e.impact > 13) { G.shakeT = 0.2; G.shakeA = Math.min(0.03, (e.impact - 13) * 0.0016); }
        break;
      }
      case 'slide': audio.play('slide'); break;
      case 'dive': audio.play('dive'); break;
      case 'impact': audio.play('impact', e); if (e.speed > 15) { G.shakeT = 0.16; G.shakeA = Math.min(0.025, e.speed * 0.0006); } break;
      case 'respawn': audio.play('respawn'); toast('Retour au dernier point sûr'); break;
      default: break;
    }
  }
  pl.events.length = 0;
}

function trackSector(dt) {
  G.sectorT -= dt;
  if (G.sectorT > 0) return;
  G.sectorT = 0.2;
  const p = G.player.pos;
  const s = G.sectors.at(p.x, p.y, p.z);
  const sp = G.player.speed;
  const cur = G.sectorLog[G.sectorLog.length - 1];
  if (cur && cur.name === s.name) { cur.max = Math.max(cur.max, sp); cur.t1 = G.time; return; }
  G.sectorLog.push({ name: s.name, t0: G.time, t1: G.time, enter: sp, max: sp });
  if (G.sectorLog.length > 200) G.sectorLog.shift();
  G.visited.add(s.name);
  $('sector').querySelector('.name').textContent = s.name;
  $('sector').querySelector('.sub').textContent = s.sub || '';
  $('sector').classList.remove('dim');
  clearTimeout(G.sectorDim);
  G.sectorDim = setTimeout(() => $('sector').classList.add('dim'), 4000);
}

function trackHelp(dt) {
  const pl = G.player;
  if (pl.stats.distance > 12) helpDone('move');
  if (pl.stats.chain >= 5) helpDone('hop');
  if (pl.onGround) G.airStart = pl.hspeed; else if (pl.hspeed - G.airStart > 2.5) helpDone('strafe');
  if (pl.surfTime > 0.8) helpDone('surf');
  if (pl.braking && pl.speed > 3) helpDone('brake');
  if (G.help.shown && !$('help').hidden) {
    G.help.t += dt;
    if (G.help.t > 45 || G.help.done.size >= 5) {
      $('help').style.opacity = 0;
      setTimeout(() => { $('help').hidden = true; }, 900);
      settings.showHelp = false; save();
      $('s-help').checked = false;
    }
  }
}

const COMPASS = [
  { t: 'N', a: 0 }, { t: 'NO', a: Math.PI / 4 }, { t: 'O', a: Math.PI / 2 }, { t: 'SO', a: 3 * Math.PI / 4 }, { t: 'S', a: Math.PI }, { t: 'SE', a: -3 * Math.PI / 4 }, { t: 'E', a: -Math.PI / 2 }, { t: 'NE', a: -Math.PI / 4 },
];
function updateHUD(dt) {
  const pl = G.player;
  G.hudT = (G.hudT || 0) - dt;
  const sp = pl.speed, hs = pl.hspeed;
  if (G.hudT <= 0) {
    G.hudT = 1 / 20;
    $('spd').textContent = Math.round(hs);
    $('kmh').textContent = `${Math.round(hs * 3.6)} km/h${sp - hs > 8 ? ` · ${Math.round(sp)} m/s total` : ''}`;
    const frac = Math.min(1, Math.log1p(hs) / Math.log1p(200));
    const bar = $('spdbar');
    bar.style.width = `${frac * 100}%`;
    bar.style.background = hs > 100 ? '#ffd08a' : hs > 50 ? '#ffb15a' : '#f06a1c';
    const sy = G.sync.live && G.sync.n > 8 ? { pct: Math.round(100 * G.sync.ok / G.sync.n), gain: pl.hspeed - G.sync.v0, live: true } : G.syncLast;
    const syEl = $('sync');
    if (sy && (hs > 6 || sy.live)) {
      const cls = sy.pct >= 75 ? 'good' : sy.pct >= 45 ? 'mid' : 'low';
      syEl.innerHTML = `sync <b class="${cls}">${sy.pct} %</b> · ${sy.gain >= 0 ? '+' : '−'}${Math.abs(sy.gain).toFixed(1).replace('.', ',')} m/s${sy.live ? '' : ' au dernier saut'}`;
    } else syEl.textContent = '';
    G.fpsT2 = (G.fpsT2 || 0) - 1 / 20;
    if (G.fpsT2 <= 0) {
      G.fpsT2 = 0.5;
      const f = window.__velocity.frameStats();
      $('fps').hidden = !settings.fpsCounter;
      if (settings.fpsCounter) $('fps').textContent = `${Math.round(f.fps)} i/s · ${(f.p50 || 0).toFixed(1)} ms`;
    }
    const flags = [];
    if (pl.surfing) flags.push('SURF');
    if (pl.slideT > 0) flags.push('GLISSADE');
    if (pl.diving) flags.push('PLONGEON');
    if (pl.braking) flags.push('FREIN');
    if (pl.stats.chain >= 3) flags.push(`×${pl.stats.chain}`);
    const f = flags.join('|');
    if (f !== G.lastFlags) { G.lastFlags = f; $('flags').innerHTML = flags.map((x) => `<span>${x}</span>`).join(''); }
    // boussole
    const c = $('compass');
    if (!G.compassEls) {
      G.compassEls = COMPASS.map((d) => { const e = document.createElement('div'); e.className = 't'; e.textContent = d.t; c.appendChild(e); return { e, a: d.a }; });
      const marks = [['Hauts-Fourneaux', GEO.furnaces.x, GEO.furnaces.z], ['Docks', GEO.docks.cx, GEO.docks.cz], ['Gazomètre', GEO.gaso.x, GEO.gaso.z], ['Belvédère', 0, 0]];
      G.compassMarks = marks.map(([t, x, z]) => { const e = document.createElement('div'); e.className = 'm'; e.textContent = t; c.appendChild(e); return { e, x, z }; });
    }
    const W = c.clientWidth, pxr = W / (Math.PI * 0.9);
    for (const d of G.compassEls) { const r = wrap(d.a - G.yaw); d.e.style.left = `${W / 2 - r * pxr}px`; d.e.style.opacity = Math.abs(r) < 1.4 ? 1 : 0; }
    for (const m of G.compassMarks) {
      const dist = Math.hypot(m.x - pl.pos.x, m.z - pl.pos.z);
      const r = wrap(headingOf(m.x - pl.pos.x, m.z - pl.pos.z) - G.yaw);
      m.e.style.left = `${W / 2 - r * pxr}px`;
      m.e.style.opacity = Math.abs(r) < 1.3 && dist > 250 ? 1 : 0;
      m.e.textContent = `${m.e.textContent.split(' ·')[0]} · ${(dist / 1000).toFixed(1)} km`;
    }
  }
  if (hs > 100 && !G.milestones.has(100)) { G.milestones.add(100); toast('100 m/s', '360 km/h · continuez la ligne'); }
  if (hs > 200 && !G.milestones.has(200)) { G.milestones.add(200); toast('200 m/s', '720 km/h'); }
}

// ---------------- points d'accès pour les tests automatisés ----------------
Object.assign(window.__velocity, {
  state() {
    const p = G.player;
    if (!p) return { state: G.state };
    return {
      state: G.state, pos: { ...p.pos }, vel: { ...p.vel }, speed: p.speed, hspeed: p.hspeed, onGround: p.onGround, surfing: p.surfing,
      sliding: p.slideT > 0, braking: p.braking, yaw: G.yaw, stats: { ...p.stats }, sector: G.sectorLog.length ? G.sectorLog[G.sectorLog.length - 1].name : null,
      inspect: { active: G.vm.inspect.active, t: G.vm.inspect.t, weight: G.vm.w.insp }, fps: G.fps, quality: G.quality, gpu: G.gpu,
      stream: { ...G.R.stream }, pen: { ...G.pen }, locked: G.input.locked, dragLook: G.input.dragLook,
      calls: G.R.renderer.info.render.calls, tris: G.R.renderer.info.render.triangles,
    };
  },
  sectorLog: () => G.sectorLog.map((s) => ({ ...s })),
  routes() {
    const pick = (path, step = 6) => path.filter((_, i) => i % step === 0).map((p) => ({ x: p.x, y: p.y, z: p.z }));
    return { viaduc: pick(G.info.routes.viaduc, 3), ring: pick(G.info.routes.ring, 4), coulees: G.info.routes.coulees.map((c) => pick(c, 2)), plazas: G.info.plazas.map((p) => ({ id: p.id, x: p.x, z: p.z, y: p.y, tx: p.tx, tz: p.tz, sx: p.sx, sz: p.sz, rx: p.rx, rz: p.rz })), couleesFace: G.info.routes.coulees.map((c, ci) => c.filter((_, i) => i % 2 === 0).map((p, i, a) => { if (ci > 0) return { x: p.x, z: p.z, y: p.y, nopush: true }; const q = a[Math.min(a.length - 1, i + 1)], o = a[Math.max(0, i - 1)]; let tx = q.x - o.x, tz = q.z - o.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; return { x: p.x - tz * 5.5, z: p.z + tx * 5.5, y: p.y - 4 }; })) };
  },
  bot(opts) { G.bot = opts ? new Bot({ yaw: G.yaw, ...opts }) : null; G.botExtra = opts && opts.extra || null; return !!G.bot; },
  botSet(o) { if (G.bot) Object.assign(G.bot, o); if (o.extra !== undefined) G.botExtra = o.extra; },
  setSynth(o) { G.synth = o; if (o && o.slideEdge) G.synthSlideEdge = true; },
  look(dyaw, dpitch = 0) { G.yaw += dyaw; G.pitch += dpitch; },
  view(yaw, pitch = 0) { G.yaw = yaw; G.pitch = pitch; },
  freeze(on) { G.frozen = !!on; },
  streamNow() { G.R.updateStreaming(G.player.pos, { x: 0, z: 0 }, 0, true); },
  hideUI(on) { document.getElementById('hud').style.visibility = on ? 'hidden' : ''; },
  teleport(x, y, z, yaw = G.yaw) { G.player.spawn(x, y, z, yaw); G.yaw = yaw; G.R.stream.grace = 30; },
  setVel(x, y, z) { Object.assign(G.player.vel, { x, y, z }); },
  ground(x, z) { return G.terrain.heightAt(x, z); },
  penetrationAt(x, y, z) { return G.col.penetration({ x, y, z }, G.player.r - 0.02); },
  inspect() { G.vm.startInspect(); G.inspectCount++; },
  inspectAt(t, variant = null) { G.vm.setInspect(t, variant); },
  setPose(name, p, F, B) { G.vm.setPose(name, p, F, B); },
  rewind: () => rewind(),
  snapshots: () => G.snaps.length,
  lastRewind: () => G.lastRewind || null,
  phys: () => ({ ...PHYS }),
  setPreset: (n) => setPreset(n),
  openTuner: () => openTuner(),
  syncInfo: () => ({ live: { ...G.sync }, last: G.syncLast }),
  vmPose: () => ({ p: G.vm.right.position.toArray(), q: G.vm.right.quaternion.toArray(), k: G.vm.knife.matrix.elements.slice(12, 15), spin: G.vm.state.spin, fingers: G.vm.rig.fingers.m[0].rotation.x }),
  vmInfo: () => ({ fidgets: G.vm.fidget.count, fidget: G.vm.fidget.clip && G.vm.fidget.clip.name, inspect: G.vm.inspect.clip && G.vm.inspect.clip.name, spin: G.vm.state.spin, toss: G.vm.state.toss }),
  fidgetsOff(on = true) { G.vm.fidget.timer = on ? 1e9 : 0.5; G.vm.fidget.clip = null; },
  pause, resume: () => startPlay(false), play: () => startPlay(true),
  frameStats() { const a = [...G.frameMs].sort((x, y) => x - y); return { fps: G.fps, p50: a[Math.floor(a.length * 0.5)], p95: a[Math.floor(a.length * 0.95)] }; },
});

boot().catch((e) => { console.error(e); const m = $('loadmsg'); if (m) m.textContent = `Erreur au chargement : ${e.message}`; });
