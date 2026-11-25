// Textures procédurales (canvas 2D) : aucune ressource externe.
import * as THREE from 'three';
import { mulberry32 } from '../core/noise.js';

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function noiseFill(ctx, w, h, base, amp, rnd, scale = 1) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  // bruit multi-échelle par blocs (rapide, tileable)
  const layers = [];
  for (const s of [64, 16, 4, 1]) {
    const gw = Math.max(1, Math.round(w / (s * scale))), gh = Math.max(1, Math.round(h / (s * scale)));
    const g = new Float32Array(gw * gh);
    for (let i = 0; i < g.length; i++) g[i] = rnd() * 2 - 1;
    layers.push({ g, gw, gh, a: s === 64 ? 0.45 : s === 16 ? 0.3 : s === 4 ? 0.17 : 0.08 });
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let n = 0;
    for (const L of layers) {
      const fx = x / w * L.gw, fy = y / h * L.gh;
      const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const i00 = (y0 % L.gh) * L.gw + (x0 % L.gw), i10 = (y0 % L.gh) * L.gw + ((x0 + 1) % L.gw);
      const i01 = ((y0 + 1) % L.gh) * L.gw + (x0 % L.gw), i11 = ((y0 + 1) % L.gh) * L.gw + ((x0 + 1) % L.gw);
      const a = L.g[i00] + (L.g[i10] - L.g[i00]) * sx, b = L.g[i01] + (L.g[i11] - L.g[i01]) * sx;
      n += (a + (b - a) * sy) * L.a;
    }
    const k = (y * w + x) * 4;
    d[k] = Math.max(0, Math.min(255, base[0] + n * amp[0]));
    d[k + 1] = Math.max(0, Math.min(255, base[1] + n * amp[1]));
    d[k + 2] = Math.max(0, Math.min(255, base[2] + n * amp[2]));
    d[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function tex(c, repeat = true, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

function streaks(ctx, w, h, rnd, n, color, alpha) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = rnd() * h * 0.6, len = 20 + rnd() * h * 0.5;
    const g = ctx.createLinearGradient(x, y, x, y + len);
    g.addColorStop(0, `rgba(${color},${alpha})`); g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g; ctx.fillRect(x, y, 1 + rnd() * 3, len);
  }
}

export function makeTextures(anisotropy = 8) {
  const rnd = mulberry32(77);
  const T = {};
  // Béton de coffrage
  {
    const c = canvas(512), x = c.getContext('2d');
    noiseFill(x, 512, 512, [142, 136, 128], [40, 38, 36], rnd);
    x.strokeStyle = 'rgba(40,38,36,0.35)'; x.lineWidth = 2;
    for (let i = 0; i <= 512; i += 128) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 512); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(512, i); x.stroke(); }
    x.fillStyle = 'rgba(30,28,26,0.5)';
    for (let i = 32; i < 512; i += 64) for (let j = 32; j < 512; j += 64) { x.beginPath(); x.arc(i, j, 2.2, 0, 7); x.fill(); }
    streaks(x, 512, 512, rnd, 40, '50,40,30', 0.22);
    T.concrete = tex(c);
  }
  {
    const c = canvas(256), x = c.getContext('2d');
    noiseFill(x, 256, 256, [78, 76, 74], [26, 25, 24], rnd);
    streaks(x, 256, 256, rnd, 18, '20,18,16', 0.3);
    T.concreteDark = tex(c);
  }
  // Acier graphite
  {
    const c = canvas(256), x = c.getContext('2d');
    noiseFill(x, 256, 256, [70, 73, 79], [18, 18, 20], rnd, 0.6);
    x.strokeStyle = 'rgba(20,21,24,0.6)'; x.lineWidth = 2;
    for (let i = 0; i <= 256; i += 128) { x.strokeRect(i + 1, 1, 126, 254); }
    x.fillStyle = 'rgba(120,60,30,0.25)';
    for (let i = 0; i < 30; i++) { x.beginPath(); x.arc(rnd() * 256, rnd() * 256, 1 + rnd() * 6, 0, 7); x.fill(); }
    streaks(x, 256, 256, rnd, 12, '110,55,25', 0.25);
    T.steel = tex(c);
  }
  // Rouille
  {
    const c = canvas(256), x = c.getContext('2d');
    noiseFill(x, 256, 256, [128, 68, 38], [70, 40, 26], rnd, 0.8);
    x.fillStyle = 'rgba(40,22,14,0.35)';
    for (let i = 0; i < 160; i++) { x.beginPath(); x.arc(rnd() * 256, rnd() * 256, rnd() * 3, 0, 7); x.fill(); }
    T.rust = tex(c);
  }
  // Orange signal des rampes (u = le long de la rampe) : joints transversaux = repères de vitesse
  {
    const c = canvas(512), x = c.getContext('2d');
    noiseFill(x, 512, 512, [232, 102, 28], [26, 16, 8], rnd, 0.7);
    x.fillStyle = 'rgba(32,33,36,0.85)';
    for (let i = 0; i < 512; i += 256) x.fillRect(i, 0, 10, 512);
    x.fillStyle = 'rgba(60,30,12,0.35)';
    for (let i = 128; i < 512; i += 256) x.fillRect(i, 0, 3, 512);
    x.fillStyle = 'rgba(255,190,140,0.12)';
    for (let i = 0; i < 70; i++) { const yy = rnd() * 512; x.fillRect(rnd() * 512, yy, 30 + rnd() * 120, 1); }
    // bande graphite longitudinale près du bord bas
    x.fillStyle = 'rgba(36,37,40,0.9)'; x.fillRect(0, 488, 512, 24);
    for (let i = 0; i < 512; i += 32) { x.fillStyle = 'rgba(240,110,30,0.9)'; x.beginPath(); x.moveTo(i, 512); x.lineTo(i + 12, 488); x.lineTo(i + 24, 488); x.lineTo(i + 12, 512); x.fill(); }
    T.orange = tex(c);
  }
  {
    const c = canvas(256), x = c.getContext('2d');
    noiseFill(x, 256, 256, [220, 96, 30], [24, 14, 8], rnd, 0.6);
    x.fillStyle = 'rgba(60,30,14,0.3)';
    for (let i = 0; i < 40; i++) { x.fillRect(rnd() * 256, rnd() * 256, 2 + rnd() * 10, 1 + rnd() * 3); }
    streaks(x, 256, 256, rnd, 10, '90,40,15', 0.3);
    T.orangePlain = tex(c);
  }
  // Tablier : asphalte + marquages orange en tirets (u = le long)
  {
    const c = canvas(512), x = c.getContext('2d');
    noiseFill(x, 512, 512, [48, 48, 51], [16, 16, 16], rnd, 0.5);
    x.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 2000; i++) x.fillRect(rnd() * 512, rnd() * 512, 1, 1);
    x.fillStyle = 'rgba(236,112,34,0.85)';
    for (let i = 0; i < 512; i += 128) x.fillRect(i, 248, 64, 16);
    x.fillStyle = 'rgba(210,205,195,0.45)';
    x.fillRect(0, 0, 512, 5);
    T.deck = tex(c);
  }
  // Caillebotis
  {
    const c = canvas(128), x = c.getContext('2d');
    x.fillStyle = '#26282c'; x.fillRect(0, 0, 128, 128);
    x.fillStyle = '#5a5e66';
    for (let i = 0; i < 128; i += 8) x.fillRect(i, 0, 3, 128);
    x.fillStyle = '#4a4d54';
    for (let i = 0; i < 128; i += 32) x.fillRect(0, i, 128, 3);
    T.grating = tex(c);
  }
  // Briques réfractaires
  {
    const c = canvas(256), x = c.getContext('2d');
    x.fillStyle = '#3c2a24'; x.fillRect(0, 0, 256, 256);
    for (let r = 0; r < 16; r++) for (let k = 0; k < 4; k++) {
      const off = (r % 2) * 32;
      const v = 90 + rnd() * 60;
      x.fillStyle = `rgb(${v + 30},${v * 0.55},${v * 0.4})`;
      x.fillRect(k * 64 + off - 64 + 2, r * 16 + 2, 60, 12);
      x.fillRect(k * 64 + off + 2, r * 16 + 2, 60, 12);
    }
    streaks(x, 256, 256, rnd, 20, '20,10,5', 0.35);
    T.brick = tex(c);
  }
  // Tôle ondulée (hangars, conteneurs)
  const corrugated = (base, rust) => {
    const c = canvas(256), x = c.getContext('2d');
    noiseFill(x, 256, 256, base, [14, 14, 14], rnd, 0.5);
    for (let i = 0; i < 256; i += 8) {
      const g = x.createLinearGradient(i, 0, i + 8, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.28)'); g.addColorStop(0.5, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0.28)');
      x.fillStyle = g; x.fillRect(i, 0, 8, 256);
    }
    if (rust) streaks(x, 256, 256, rnd, 26, '120,55,25', 0.35);
    return tex(c);
  };
  T.shed = corrugated([120, 124, 128], true);
  T.container = corrugated([200, 200, 200], true);
  // Coque du cargo
  {
    const c = canvas(512), x = c.getContext('2d');
    noiseFill(x, 512, 512, [58, 62, 68], [12, 12, 14], rnd, 0.5);
    x.strokeStyle = 'rgba(20,20,22,0.5)'; x.lineWidth = 2;
    for (let i = 0; i < 512; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 512); x.stroke(); }
    for (let i = 0; i < 512; i += 128) { x.beginPath(); x.moveTo(0, i); x.lineTo(512, i); x.stroke(); }
    streaks(x, 512, 512, rnd, 60, '130,60,25', 0.3);
    T.hull = tex(c);
  }
  // Sol de laitier
  {
    const c = canvas(512), x = c.getContext('2d');
    noiseFill(x, 512, 512, [104, 94, 84], [44, 40, 36], rnd, 0.6);
    for (let i = 0; i < 5000; i++) {
      const v = rnd();
      x.fillStyle = v < 0.5 ? 'rgba(20,18,16,0.5)' : v < 0.8 ? 'rgba(150,130,110,0.4)' : 'rgba(170,80,30,0.35)';
      const s = 1 + rnd() * 2.5;
      x.fillRect(rnd() * 512, rnd() * 512, s, s);
    }
    T.ground = tex(c);
  }
  // Normales de l'eau
  {
    const c = canvas(256), x = c.getContext('2d');
    const img = x.createImageData(256, 256);
    const hgt = new Float32Array(256 * 256);
    for (let k = 0; k < 40; k++) {
      const fx = Math.floor(1 + rnd() * 6), fy = Math.floor(1 + rnd() * 6), ph = rnd() * 6.28, a = 1 / (fx + fy);
      for (let y = 0; y < 256; y++) for (let xx = 0; xx < 256; xx++) hgt[y * 256 + xx] += Math.sin((xx * fx + y * fy) / 256 * Math.PI * 2 + ph) * a;
    }
    for (let y = 0; y < 256; y++) for (let xx = 0; xx < 256; xx++) {
      const dx = hgt[y * 256 + ((xx + 1) & 255)] - hgt[y * 256 + ((xx - 1) & 255)];
      const dy = hgt[((y + 1) & 255) * 256 + xx] - hgt[((y - 1) & 255) * 256 + xx];
      const k = (y * 256 + xx) * 4;
      img.data[k] = 128 - dx * 60; img.data[k + 1] = 128 - dy * 60; img.data[k + 2] = 255; img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    T.waterNormal = tex(c, true, false);
  }
  // Particules douces (fumée) et halo
  {
    const c = canvas(128), x = c.getContext('2d');
    for (let i = 0; i < 18; i++) {
      const cx = 40 + rnd() * 48, cy = 40 + rnd() * 48, r = 20 + rnd() * 30;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    }
    const m = x.createRadialGradient(64, 64, 30, 64, 64, 64);
    m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)');
    x.globalCompositeOperation = 'destination-out'; x.fillStyle = m; x.fillRect(0, 0, 128, 128);
    T.puff = tex(c, false, false);
  }
  {
    const c = canvas(64), x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.15, 'rgba(255,255,255,0.8)'); g.addColorStop(0.4, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    T.halo = tex(c, false, false);
  }
  {
    const c = canvas(64, 128), x = c.getContext('2d');
    const g = x.createRadialGradient(32, 92, 2, 32, 80, 60);
    g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.25, 'rgba(255,190,80,0.9)'); g.addColorStop(0.6, 'rgba(255,90,20,0.45)'); g.addColorStop(1, 'rgba(120,20,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 128);
    T.flame = tex(c, false, true);
  }
  for (const k in T) T[k].anisotropy = anisotropy;
  return T;
}

/** Panneau de signalisation (texte) */
export function signTexture(lines, w = 1024, h = 256) {
  const c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#1d1f23'; x.fillRect(0, 0, w, h);
  x.fillStyle = '#f06a1c'; x.fillRect(0, 0, w, 18); x.fillRect(0, h - 10, w, 10);
  x.strokeStyle = 'rgba(255,255,255,0.15)'; x.lineWidth = 4; x.strokeRect(8, 26, w - 16, h - 44);
  x.fillStyle = '#f2efe9';
  x.textBaseline = 'middle';
  x.font = `800 ${Math.round(h * 0.34)}px "Big Shoulders Display", "Arial Narrow", Arial, sans-serif`;
  x.fillText(lines[0], 36, h * 0.42, w - 72);
  if (lines[1]) {
    x.fillStyle = '#f08a3c';
    x.font = `600 ${Math.round(h * 0.17)}px "Barlow", Arial, sans-serif`;
    x.fillText(lines[1], 38, h * 0.76, w - 76);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
