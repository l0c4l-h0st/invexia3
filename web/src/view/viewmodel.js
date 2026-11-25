// Vue à la première personne : gants procéduraux et couteau cosmétique « VX-7 Ardent ».
// Le couteau est modélisé pièce par pièce (lame à double émouture, gorge, choil,
// crantage, garde, manche G10 quadrillé, pommeau à dragonne) pour accrocher la lumière.
import * as THREE from 'three';
import { mulberry32 } from '../core/noise.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------- textures ----------------
function cnv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function normalFromHeight(hgt, w, h, strength) {
  const c = cnv(w, h), x = c.getContext('2d'), img = x.createImageData(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const l = hgt[j * w + ((i - 1 + w) % w)], r = hgt[j * w + ((i + 1) % w)];
    const u = hgt[((j - 1 + h) % h) * w + i], d = hgt[((j + 1) % h) * w + i];
    let nx = (l - r) * strength, ny = (u - d) * strength, nz = 1;
    const L = Math.hypot(nx, ny, nz); nx /= L; ny /= L; nz /= L;
    const k = (j * w + i) * 4;
    img.data[k] = (nx * 0.5 + 0.5) * 255; img.data[k + 1] = (ny * 0.5 + 0.5) * 255; img.data[k + 2] = (nz * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

function knurlTextures() {
  // quadrillage en diamant du G10 + liseré graphite (fourrures)
  const w = 256, h = 256, rnd = mulberry32(9);
  const hgt = new Float32Array(w * h);
  const c = cnv(w, h), x = c.getContext('2d'), img = x.createImageData(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const a = ((i + j) % 32) / 32, b = ((i - j + 512) % 32) / 32;
    const pyr = Math.min(Math.min(a, 1 - a), Math.min(b, 1 - b)) * 2; // pyramides
    const n = rnd() * 0.08;
    hgt[j * w + i] = pyr + n;
    const k = (j * w + i) * 4;
    const u = i / w;
    const liner = (Math.abs(u - 0.25) < 0.018 || Math.abs(u - 0.75) < 0.018);
    const layer = 0.5 + 0.5 * Math.sin(j * 0.21 + Math.sin(i * 0.05) * 2); // strates du G10
    if (liner) { img.data[k] = 34; img.data[k + 1] = 35; img.data[k + 2] = 39; }
    else {
      const s = 0.72 + pyr * 0.35 + layer * 0.06;
      img.data[k] = Math.min(255, 222 * s); img.data[k + 1] = Math.min(255, 92 * s); img.data[k + 2] = Math.min(255, 30 * s);
    }
    img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return { map, normal: normalFromHeight(hgt, w, h, 6) };
}

function etchTexture() {
  // Face A : acier stonewash + courbes de niveau gravées orange + marquage
  const w = 512, h = 128, rnd = mulberry32(31);
  const c = cnv(w, h), x = c.getContext('2d');
  x.fillStyle = '#7c838c'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${rnd() < 0.5 ? '60,64,70' : '200,205,212'},${0.08 + rnd() * 0.12})`; const s = 1 + rnd() * 4; x.fillRect(rnd() * w, rnd() * h, s, s * 0.6); }
  x.lineWidth = 2.6;
  for (let k = 0; k < 9; k++) {
    x.strokeStyle = `rgba(255,${96 + k * 10},28,${0.95 - k * 0.05})`;
    x.beginPath();
    for (let i = 0; i <= w; i += 4) {
      const y = h * 0.5 + Math.sin(i * 0.018 + k * 0.6) * (10 + k * 4) + Math.sin(i * 0.051 + k) * 6 - (k - 4) * 9;
      i === 0 ? x.moveTo(i, y) : x.lineTo(i, y);
    }
    x.stroke();
  }
  // marquage côté garde (u ≈ 1 sur la face A)
  x.fillStyle = 'rgba(18,19,22,0.95)';
  x.textAlign = 'right';
  x.font = '800 30px "Big Shoulders Display", "Arial Narrow", Arial, sans-serif';
  x.fillText('VX-7 · ARDENT', w - 26, h * 0.6);
  x.font = '700 14px Arial, sans-serif';
  x.fillText('FRICHE FORGE  ·  14C28N', w - 28, h * 0.82);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function temperTexture() {
  // Face B : miroir avec couleurs de revenu (paille → bronze → violet → bleu)
  const w = 512, h = 64;
  const c = cnv(w, h), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, '#d9dde2'); g.addColorStop(0.28, '#e2cf9a'); g.addColorStop(0.45, '#c08a4a'); g.addColorStop(0.6, '#8a4f7a'); g.addColorStop(0.75, '#4c5fa8'); g.addColorStop(0.9, '#9fb4cf'); g.addColorStop(1, '#dfe3e8');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  const rnd = mulberry32(5);
  for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(255,255,255,${rnd() * 0.06})`; x.fillRect(rnd() * w, rnd() * h, 20 + rnd() * 60, 1); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function fabricNormal() {
  const w = 128, rnd = mulberry32(3);
  const hgt = new Float32Array(w * w);
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) hgt[j * w + i] = (Math.sin(i * 0.9) * 0.5 + Math.sin(j * 0.9) * 0.5) * 0.25 + rnd() * 0.35;
  return normalFromHeight(hgt, w, w, 2.5);
}

// ---------------- couteau ----------------
const LB = 0.158, GUARD_Y = 0.052;
function spineW(L) {
  if (L < 0.03) return 0.0125;
  if (L < 0.075) { const t = (L - 0.03) / 0.045; return 0.0125 + 0.002 * t * t * (3 - 2 * t); }
  if (L < 0.105) return 0.0145 - 0.001 * (L - 0.075) / 0.03;
  const t = (L - 0.105) / (LB - 0.105);
  return 0.0135 + (-0.002 - 0.0135) * (t * 0.85 + 0.15 * t * t); // contre-pointe anguleuse
}
function edgeW(L) {
  if (L < 0.004) return -0.0145;
  if (L < 0.016) { const t = (L - 0.004) / 0.012; return -0.0145 + 0.0055 * Math.sin(Math.PI * t); } // choil
  if (L < 0.1) return -0.0145 - 0.002 * Math.min(1, (L - 0.016) / 0.03);
  const t = (L - 0.1) / (LB - 0.1);
  return -0.0165 + (0.0145) * (1 - Math.sqrt(Math.max(0, 1 - t * t))); // ventre
}

function buildBlade(mats) {
  const N = 56;
  const st = [];
  for (let i = 0; i <= N; i++) {
    const L = LB * Math.pow(i / N, 0.92);
    const ws = spineW(L), we = edgeW(L);
    const t = 0.0042 * (1 - 0.6 * (L / LB) ** 2);
    const wg = we + 0.5 * (ws - we);
    const fz = L > 0.018 && L < 0.092 ? Math.sin(Math.PI * (L - 0.018) / 0.074) : 0;
    const wc = (ws + wg) / 2 + 0.0008;
    st.push({ L, ws, we, wg, t, fz, wc });
  }
  // points d'une section côté s (+1 face A, −1 face B)
  const flatPts = (q, s) => {
    const fw = 0.0022, fd = 0.0009 * q.fz;
    return [[s * q.t / 2, q.ws], [s * q.t / 2, q.wc + fw], [s * (q.t / 2 - fd), q.wc], [s * q.t / 2, q.wc - fw], [s * q.t / 2, q.wg]];
  };
  const strip = (getPts, mat, uvFn, flip) => {
    const pos = [], uv = [], idx = [];
    const m = getPts(st[0]).length;
    st.forEach((q, i) => {
      getPts(q).forEach(([x, w], k) => { pos.push(x, GUARD_Y + q.L, w); uv.push(...uvFn(q, w, k)); });
    });
    for (let i = 0; i < N; i++) for (let k = 0; k < m - 1; k++) {
      const a = i * m + k, b = a + 1, c = a + m, d = c + 1;
      if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = false;
    return mesh;
  };
  const uvFlat = (q, w) => [q.L / LB, (w - q.we) / Math.max(1e-4, q.ws - q.we)];
  const grp = new THREE.Group();
  // face A : u inversé pour que le marquage se lise à l'endroit quand la pointe est à gauche
  grp.add(strip((q) => flatPts(q, 1), mats.faceA, (q, w) => [1 - q.L / LB, 1 - (w - q.we) / Math.max(1e-4, q.ws - q.we)], false));
  grp.add(strip((q) => flatPts(q, -1), mats.faceB, uvFlat, true));
  grp.add(strip((q) => [[q.t / 2, q.wg], [0.00012, q.we]], mats.bevel, uvFlat, false));
  grp.add(strip((q) => [[-q.t / 2, q.wg], [-0.00012, q.we]], mats.bevel, uvFlat, true));
  grp.add(strip((q) => [[-q.t / 2, q.ws], [q.t / 2, q.ws]], mats.spine, (q, w, k) => [q.L / LB, k], false));
  // crantage du dos (jimping)
  for (let k = 0; k < 7; k++) {
    const L = 0.012 + k * 0.0026;
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.0046, 0.0011, 0.0016), mats.spine);
    tooth.position.set(0, GUARD_Y + L, spineW(L) + 0.0006);
    grp.add(tooth);
  }
  return grp;
}

function buildKnife(env) {
  const knurl = knurlTextures();
  const mats = {
    faceA: new THREE.MeshPhysicalMaterial({ map: etchTexture(), metalness: 0.85, roughness: 0.38, envMap: env, envMapIntensity: 1.2, side: THREE.DoubleSide }),
    faceB: new THREE.MeshPhysicalMaterial({ map: temperTexture(), metalness: 1, roughness: 0.14, envMap: env, envMapIntensity: 1.6, side: THREE.DoubleSide }),
    bevel: new THREE.MeshPhysicalMaterial({ color: 0xf2f4f7, metalness: 1, roughness: 0.06, envMap: env, envMapIntensity: 2.0, side: THREE.DoubleSide }),
    spine: new THREE.MeshPhysicalMaterial({ color: 0x2a2c31, metalness: 0.9, roughness: 0.3, envMap: env, envMapIntensity: 1.0, side: THREE.DoubleSide }),
    dlc: new THREE.MeshPhysicalMaterial({ color: 0x25272b, metalness: 0.95, roughness: 0.26, envMap: env, envMapIntensity: 1.2, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
    g10: new THREE.MeshStandardMaterial({ map: knurl.map, normalMap: knurl.normal, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.58, metalness: 0.05, envMap: env, envMapIntensity: 0.6 }),
    steel: new THREE.MeshPhysicalMaterial({ color: 0xb8bdc4, metalness: 1, roughness: 0.18, envMap: env, envMapIntensity: 1.6 }),
  };
  const knife = new THREE.Group();
  knife.add(buildBlade(mats));
  // garde : profil extrudé avec chanfreins
  const gs = new THREE.Shape();
  gs.moveTo(-0.019, -0.0035); gs.lineTo(0.016, -0.004); gs.quadraticCurveTo(0.021, -0.001, 0.018, 0.004); gs.lineTo(-0.017, 0.0045); gs.quadraticCurveTo(-0.024, 0.002, -0.019, -0.0035);
  const gg = new THREE.ExtrudeGeometry(gs, { depth: 0.011, bevelEnabled: true, bevelThickness: 0.0016, bevelSize: 0.0012, bevelSegments: 3 });
  gg.translate(0, 0, -0.0055);
  gg.rotateY(Math.PI / 2);
  const guard = new THREE.Mesh(gg, mats.dlc);
  guard.position.y = GUARD_Y - 0.002;
  guard.rotation.x = 0;
  knife.add(guard);
  // manche : section ovale lissée, gorges pour les doigts côté tranchant
  const NS = 30, NA = 28, y0 = -0.064, y1 = GUARD_Y - 0.004;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= NS; i++) {
    const t = i / NS, y = y0 + (y1 - y0) * t;
    const flare = Math.max(0, 1 - (y - y0) / 0.014) * 0.0022 + Math.max(0, 1 - (y1 - y) / 0.01) * 0.0012;
    const hx = 0.0094 + flare * 0.6 + 0.0006 * Math.sin(t * Math.PI);
    const front = 0.0124 + flare + 0.0011 * Math.cos((y - 0.03) / 0.0195 * Math.PI * 2) * (y > -0.05 && y < 0.04 ? 1 : 0);
    const back = 0.0122 + flare + 0.0016 * Math.sin(t * Math.PI);
    for (let k = 0; k <= NA; k++) {
      const a = k / NA * Math.PI * 2;
      const sz = Math.sin(a);
      const hz = sz > 0 ? back : front;
      pos.push(Math.cos(a) * hx, y, sz * hz);
      uv.push(k / NA * 3, t * 4);
    }
  }
  for (let i = 0; i < NS; i++) for (let k = 0; k < NA; k++) {
    const a = i * (NA + 1) + k, b = a + 1, c = a + NA + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const hg = new THREE.BufferGeometry();
  hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  hg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  hg.setIndex(idx); hg.computeVertexNormals(); hg.computeTangents?.();
  knife.add(new THREE.Mesh(hg, mats.g10));
  // pommeau + anneau de dragonne
  const pom = new THREE.Mesh(new THREE.CylinderGeometry(0.0098, 0.0112, 0.012, 24, 1), mats.steel);
  pom.scale.z = 1.3; pom.position.y = y0 - 0.005;
  knife.add(pom);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.0112, 24, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mats.dlc);
  cap.scale.set(1, 0.45, 1.3); cap.position.y = y0 - 0.011;
  knife.add(cap);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0055, 0.0016, 10, 24), mats.steel);
  ring.position.set(0, y0 - 0.019, 0.004); ring.rotation.y = Math.PI / 2;
  knife.add(ring);
  return knife;
}

// ---------------- gants ----------------
function capsuleBetween(a, b, r, mat) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const g = new THREE.CapsuleGeometry(r, Math.max(0.0001, len), 6, 12);
  const m = new THREE.Mesh(g, mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
  return m;
}
function ellipsoid(c, r, mat, segs = 20) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, segs, Math.round(segs * 0.7)), mat);
  m.position.copy(c); m.scale.copy(r);
  return m;
}

function gloveMats(env) {
  const fab = fabricNormal();
  fab.repeat.set(6, 6);
  return {
    glove: new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.82, metalness: 0.0, normalMap: fab, normalScale: new THREE.Vector2(0.6, 0.6), envMap: env, envMapIntensity: 0.4 }),
    palm: new THREE.MeshStandardMaterial({ color: 0x4a3a30, roughness: 0.7, metalness: 0, normalMap: fab, envMap: env, envMapIntensity: 0.4 }),
    armor: new THREE.MeshStandardMaterial({ color: 0xe0601e, roughness: 0.45, metalness: 0.05, envMap: env, envMapIntensity: 0.7 }),
    cuff: new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.9, metalness: 0, normalMap: fab }),
    stripe: new THREE.MeshStandardMaterial({ color: 0xd8581a, roughness: 0.6 }),
  };
}

/** Poing droit serré autour d'un manche vertical (axe Y, origine au centre de la prise). Avant-bras vers +Z. */
function buildRightHand(m, alpha) {
  const g = new THREE.Group();
  const ta = Math.tan(alpha);
  const P = (R, deg, y, k = 1) => V3(R * Math.cos(deg * Math.PI / 180), y, -R * Math.sin(deg * Math.PI / 180) - y * ta * k);
  const fingers = [[0.031, 0.0088, 1], [0.0115, 0.0093, 1.03], [-0.0075, 0.0089, 0.98], [-0.0255, 0.0078, 0.86]];
  for (const [y, r, s] of fingers) {
    const K = P(0.033, -28, y + 0.002, 0.6), J1 = P(0.0228 * s + 0.0008, 72, y), J2 = P(0.0222, 146, y), T = P(0.0195, 196, y - 0.001);
    g.add(capsuleBetween(K, J1, r, m.glove));
    g.add(capsuleBetween(J1, J2, r * 0.97, m.glove));
    g.add(capsuleBetween(J2, T, r * 0.9, m.glove));
    // plaque de protection sur la phalange proximale
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.006, r * 1.6, 0.018), m.armor);
    pad.position.copy(K).lerp(J1, 0.45); pad.position.x += 0.004; pad.position.z += 0.003;
    pad.lookAt(pad.position.clone().add(V3(1, 0, -0.35)));
    g.add(pad);
  }
  // paume, éminence thénar, pouce
  g.add(ellipsoid(V3(0.03, 0.002, 0.046), V3(0.019, 0.044, 0.047), m.glove));
  g.add(ellipsoid(V3(0.017, 0.006, 0.05), V3(0.008, 0.04, 0.04), m.palm));
  g.add(ellipsoid(V3(0.004, 0.03, 0.045), V3(0.014, 0.016, 0.024), m.glove));
  const t0 = V3(0.012, 0.033, 0.058), t1 = V3(-0.006, 0.04, 0.026 - 0.04 * ta * 0.4), t2 = V3(-0.017, 0.045, -0.002 - 0.045 * ta * 0.85), t3 = V3(-0.011, 0.047, -0.02 - 0.047 * ta);
  g.add(capsuleBetween(t0, t1, 0.011, m.glove));
  g.add(capsuleBetween(t1, t2, 0.0098, m.glove));
  g.add(capsuleBetween(t2, t3, 0.009, m.glove));
  // coque de phalanges : barre arrondie orange + plaque graphite sur le dos de la main
  g.add(capsuleBetween(V3(0.041, 0.034, 0.006 - 0.034 * ta * 0.6), V3(0.041, -0.026, 0.02 + 0.026 * ta * 0.6), 0.0075, m.armor));
  const plate = ellipsoid(V3(0.046, 0.003, 0.048), V3(0.006, 0.033, 0.03), m.cuff);
  g.add(plate);
  // poignet, manchette, manche : l'avant-bras prolonge le manche (prise sabre),
  // la rotation du poignet autour de la lame laisse donc l'avant-bras en place.
  const F = V3(0.12, -0.8, 0.58).normalize();
  const W = V3(0.03, -0.026, 0.062);
  g.add(ellipsoid(W.clone().addScaledVector(F, 0.012), V3(0.026, 0.03, 0.03), m.glove));
  g.add(capsuleBetween(W.clone().addScaledVector(F, 0.018), W.clone().addScaledVector(F, 0.06), 0.03, m.cuff));
  g.add(capsuleBetween(W.clone().addScaledVector(F, 0.03), W.clone().addScaledVector(F, 0.042), 0.0325, m.stripe));
  g.add(capsuleBetween(W.clone().addScaledVector(F, 0.068), W.clone().addScaledVector(F, 0.46), 0.041, m.cuff));
  return g;
}

/** Main gauche ouverte (« main lame ») : doigts vers −Z, paume vers +X. */
function buildLeftHand(m) {
  const g = new THREE.Group();
  g.add(ellipsoid(V3(0, 0, -0.048), V3(0.017, 0.043, 0.05), m.glove));
  g.add(ellipsoid(V3(0.007, 0, -0.05), V3(0.012, 0.038, 0.044), m.palm));
  const fingers = [[0.028, 0.0085, 1], [0.0095, 0.009, 1.06], [-0.009, 0.0086, 1.0], [-0.026, 0.0076, 0.84]];
  for (const [y, r, s] of fingers) {
    const K = V3(0, y, -0.092), J1 = V3(0.004, y, -0.092 - 0.042 * s), J2 = V3(0.011, y, -0.092 - 0.067 * s), T = V3(0.019, y, -0.092 - 0.083 * s);
    g.add(capsuleBetween(K, J1, r, m.glove)); g.add(capsuleBetween(J1, J2, r * 0.96, m.glove)); g.add(capsuleBetween(J2, T, r * 0.9, m.glove));
  }
  g.add(capsuleBetween(V3(0.012, 0.03, -0.03), V3(0.02, 0.046, -0.065), 0.0105, m.glove));
  g.add(capsuleBetween(V3(0.02, 0.046, -0.065), V3(0.022, 0.05, -0.092), 0.0092, m.glove));
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.07, 0.03), m.armor);
  arm.position.set(-0.017, 0, -0.085); g.add(arm);
  g.add(capsuleBetween(V3(0, 0, 0), V3(0, -0.004, 0.04), 0.03, m.cuff));
  g.add(capsuleBetween(V3(0, -0.002, 0.012), V3(0, -0.003, 0.024), 0.0325, m.stripe));
  g.add(capsuleBetween(V3(0, -0.005, 0.05), V3(-0.01, -0.02, 0.42), 0.041, m.cuff));
  return g;
}

// ---------------- environnement « studio » pour les reflets ----------------
function studioEnv(renderer) {
  const s = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'varying vec3 v; void main(){ float e = v.y; vec3 c = mix(vec3(0.10,0.09,0.09), vec3(0.42,0.36,0.34), smoothstep(-0.3,0.6,e)); c += vec3(0.9,0.45,0.18) * smoothstep(0.2,0.0,abs(e-0.02)) * 0.5; gl_FragColor = vec4(c,1.0); }',
  }));
  s.add(sky);
  const panel = (w, h, col, int, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(int), side: THREE.DoubleSide }));
    m.position.copy(pos); m.lookAt(0, 0, 0); s.add(m);
  };
  panel(6, 2.2, 0xffffff, 3.2, V3(-2, 7, 3));       // grande boîte à lumière au-dessus
  panel(1.0, 7, 0xff7a2a, 3.5, V3(7, 1, -2));      // bande orange (lueur des fourneaux)
  panel(0.8, 6, 0x9fc4ff, 1.8, V3(-7, 1.5, -3));   // bande froide
  panel(4, 0.6, 0xffe2c0, 2.2, V3(0, 3, -8));      // horizon avant
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.01).texture;
  pm.dispose();
  return tex;
}

// ---------------- animation ----------------
class Spring {
  constructor(k = 120, c = 16) { this.k = k; this.c = c; this.x = V3(0, 0, 0); this.v = V3(0, 0, 0); this.t = V3(0, 0, 0); }
  step(dt) {
    const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
    for (let i = 0; i < n; i++) this._step(h);
  }
  _step(dt) {
    const ax = (this.t.x - this.x.x) * this.k - this.v.x * this.c, ay = (this.t.y - this.x.y) * this.k - this.v.y * this.c, az = (this.t.z - this.x.z) * this.k - this.v.z * this.c;
    this.v.x += ax * dt; this.v.y += ay * dt; this.v.z += az * dt;
    this.x.x += this.v.x * dt; this.x.y += this.v.y * dt; this.x.z += this.v.z * dt;
  }
}

const ease = (t) => t * t * t * (t * (t * 6 - 15) + 10);
/** Orientation de la main à partir de la direction de la lame (B) et de la normale du dos de la main (N). */
export const ALPHA = 25 * Math.PI / 180; // inclinaison « sabre » du couteau dans le poing
const qBlade = (B, N, alpha = ALPHA) => {
  const b = B.clone().normalize();
  const x = N.clone().sub(b.clone().multiplyScalar(N.dot(b))).normalize();
  const c = new THREE.Vector3().crossVectors(x, b);
  const y = b.clone().multiplyScalar(Math.cos(alpha)).addScaledVector(c, Math.sin(alpha));
  const z = b.clone().multiplyScalar(-Math.sin(alpha)).addScaledVector(c, Math.cos(alpha));
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
};
const KNIFE_AXIS = new THREE.Vector3(0, Math.cos(ALPHA), -Math.sin(ALPHA));

export class ViewModel {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.01, 10);
    this.env = studioEnv(renderer);
    const gm = gloveMats(this.env);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    // main droite + couteau
    this.right = new THREE.Group();
    this.rightHand = buildRightHand(gm, ALPHA);
    this.knife = buildKnife(this.env);
    this.knife.rotation.x = -ALPHA;
    this.right.add(this.rightHand, this.knife);
    this.root.add(this.right);
    // main gauche
    this.left = buildLeftHand(gm);
    this.root.add(this.left);
    // lumières (repère caméra)
    this.scene.add(new THREE.HemisphereLight(0xcdbcb0, 0x2a2420, 0.9));
    this.key = new THREE.DirectionalLight(0xffd2a8, 2.4); this.key.position.set(-1, 2, 1.2); this.scene.add(this.key);
    this.rim = new THREE.DirectionalLight(0xff7a30, 1.6); this.rim.position.set(2, 0.6, -1.5); this.scene.add(this.rim);
    this.fill = new THREE.DirectionalLight(0x9fb8ff, 0.5); this.fill.position.set(-2, -0.5, -0.5); this.scene.add(this.fill);
    // lignes de vitesse
    this._speedLines();

    // poses (repère caméra)
    const PS = ViewModel.POSES;
    this.poses = {};
    for (const k in PS) this.poses[k] = { p: PS[k].p.clone(), q: qBlade(PS[k].b, PS[k].n) };
    this.poses.faceB = { p: PS.faceA.p.clone().add(V3(0.004, 0.002, 0)), q: this.poses.faceA.q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(KNIFE_AXIS, Math.PI)) };
    this.leftPoses = {
      hidden: { p: V3(-0.2, -0.32, -0.2), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, 0.3, -0.2)) },
      sprint: { p: V3(-0.13, -0.13, -0.27), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.25, 0.25, 0.15)) },
      slide: { p: V3(-0.15, -0.12, -0.3), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.5, 0.35, 1.25)) },
      dive: { p: V3(-0.1, -0.06, -0.34), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, 0.1, 0.1)) },
    };
    this.w = { sprint: 0, air: 0, slide: 0, dive: 0, left: 0, insp: 0 };
    this.sway = new Spring(140, 18);
    this.swayRot = new Spring(120, 15);
    this.inertia = new Spring(90, 13);
    this.land = new Spring(170, 15);
    this.tilt = 0;
    this.time = 0;
    this.inspect = { active: false, t: 0, dur: 3.4, events: 0 };
    this.onSound = () => {};
    this.lastVel = V3(0, 0, 0);
    this.phase = 0;
    this.visible = true;
    this.qTmp = new THREE.Quaternion();
  }

  _speedLines() {
    const g = new THREE.PlaneGeometry(2, 2);
    this.slMat = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { time: { value: 0 }, amount: { value: 0 }, aspect: { value: 1.7 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `varying vec2 vUv; uniform float time; uniform float amount; uniform float aspect;
        float h(float n){ return fract(sin(n)*43758.5453); }
        void main(){ vec2 p = (vUv - 0.5) * vec2(aspect, 1.0); float r = length(p); float a = atan(p.y, p.x);
          float seg = floor(a * 60.0 / 6.2831853); float rnd = h(seg * 7.13);
          float streak = smoothstep(0.92, 1.0, fract(rnd * 3.7 + time * (1.2 + rnd * 2.0) - r * 1.6));
          float lane = smoothstep(0.35, 0.0, abs(fract(a * 60.0 / 6.2831853) - 0.5));
          float mask = smoothstep(0.32, 0.85, r);
          float v = streak * lane * mask * amount * step(0.35, rnd);
          gl_FragColor = vec4(vec3(1.0, 0.92, 0.85) * v * 0.55, v * 0.55); }`,
    });
    this.speedLines = new THREE.Mesh(g, this.slMat);
    this.speedLines.frustumCulled = false;
    this.speedLines.renderOrder = -1;
    this.scene.add(this.speedLines);
  }

  startInspect() {
    if (this.inspect.active && this.inspect.t < this.inspect.dur * 0.75) { // second appui : retour rapide
      this.inspect.t = Math.max(this.inspect.t, this.inspect.dur - 0.55);
      return;
    }
    this.inspect.active = true; this.inspect.t = 0; this.inspect.events = 0;
    this.onSound('inspect-draw');
  }

  resize(aspect) { this.camera.aspect = aspect; this.camera.updateProjectionMatrix(); this.slMat.uniforms.aspect.value = aspect; }

  /** st : {dt, mouseDX, mouseDY, vel(view space THREE.Vector3), grounded, sprint, slide, dive, surf, speed, stepPhase, landImpulse, shake, bob, speedLines, strafe} */
  update(st) {
    const dt = Math.min(0.25, st.dt);
    this.time += dt;
    const W = this.w;
    const ap = (k, target, rate) => { W[k] += (target - W[k]) * Math.min(1, dt * rate); };
    ap('sprint', st.sprint && st.grounded ? 1 : 0, 8);
    ap('air', !st.grounded ? 1 : 0, 6);
    ap('slide', st.slide ? 1 : 0, 10);
    ap('dive', st.dive ? 1 : 0, 9);
    ap('left', (st.sprint && st.grounded) || st.slide || st.dive ? 1 : 0, 7);

    // inspection
    let insp = 0, ip = null, iq = null;
    const I = this.inspect;
    if (I.active) {
      if (!I.hold) I.t += dt;
      const t = I.t, P = this.poses;
      const keys = [0.42, 1.35, 1.9, 2.8, I.dur];
      if (t < keys[0]) { insp = ease(t / keys[0]); ip = P.faceA.p; iq = P.faceA.q; }
      else if (t < keys[1]) { insp = 1; const k = (t - keys[0]) / (keys[1] - keys[0]); ip = P.faceA.p.clone().add(V3(0.004 * k, 0.003 * Math.sin(k * 3), 0)); iq = P.faceA.q.clone().multiply(this.qTmp.setFromAxisAngle(V3(1, 0, 0), 0.12 * Math.sin(k * Math.PI))); }
      else if (t < keys[2]) {
        insp = 1; const k = ease((t - keys[1]) / (keys[2] - keys[1]));
        ip = P.faceA.p.clone().lerp(P.faceB.p, k).add(V3(0, 0.012 * Math.sin(k * Math.PI), 0.01 * Math.sin(k * Math.PI)));
        iq = P.faceA.q.clone().multiply(this.qTmp.setFromAxisAngle(KNIFE_AXIS, Math.PI * k));
        if (I.events === 0 && k > 0.45) { I.events = 1; this.onSound('inspect-flip'); }
      } else if (t < keys[3]) { insp = 1; const k = (t - keys[2]) / (keys[3] - keys[2]); ip = P.faceB.p.clone().add(V3(-0.004 * k, 0.002 * Math.sin(k * 3), 0)); iq = P.faceB.q.clone().multiply(this.qTmp.setFromAxisAngle(V3(1, 0, 0), -0.1 * Math.sin(k * Math.PI))); }
      else if (t < keys[4]) { insp = 1 - ease((t - keys[3]) / (keys[4] - keys[3])); ip = P.faceB.p; iq = P.faceB.q; if (I.events === 1) { I.events = 2; this.onSound('inspect-end'); } }
      else { I.active = false; }
    }
    W.insp = insp;

    // pose de base (mélanges)
    const P = this.poses;
    const pos = P.run.p.clone(), q = P.run.q.clone();
    const mix = (pose, w) => { if (w <= 0.001) return; pos.lerp(pose.p, w); q.slerp(pose.q, w); };
    mix(P.air, W.air * (1 - W.slide));
    mix(P.sprint, W.sprint * (1 - W.air));
    mix(P.slide, Math.max(W.slide, W.dive));
    // foulée : balancement du poignet synchronisé aux pas
    const ph = st.stepPhase * Math.PI;
    const amp = (0.0045 + 0.007 * W.sprint) * (st.grounded ? 1 : 0) * Math.min(1, st.speed / 4) * (1 - insp * 0.7) * (0.45 + 0.55 * st.bob);
    pos.x += Math.cos(ph) * amp * 0.9;
    pos.y -= Math.abs(Math.sin(ph)) * amp * 1.3;
    pos.z += W.sprint * Math.sin(ph) * 0.016 * (1 - insp);
    const sprintSwing = W.sprint * Math.sin(ph) * 0.35 * (1 - insp);
    q.multiply(this.qTmp.setFromEuler(new THREE.Euler(sprintSwing * 0.6, 0, Math.cos(ph) * amp * 6)));
    // inspection par-dessus
    if (insp > 0 && ip) { pos.lerp(ip, insp); q.slerp(iq, insp); }

    // ressorts : souris (inertie de la main), accélération, réception
    const mdx = Math.max(-40, Math.min(40, st.mouseDX)), mdy = Math.max(-40, Math.min(40, st.mouseDY));
    this.sway.t.set(-mdx * 0.00045, mdy * 0.00045, 0);
    this.swayRot.t.set(mdy * 0.0035, -mdx * 0.0045, -mdx * 0.002);
    this.sway.step(dt); this.swayRot.step(dt);
    const acc = st.vel.clone().sub(this.lastVel).divideScalar(Math.max(dt, 1e-3));
    this.lastVel.copy(st.vel);
    acc.clampLength(0, 60);
    this.inertia.t.set(-acc.x * 0.00028, -acc.y * 0.00022, acc.z * 0.00018);
    this.inertia.step(dt);
    if (st.landImpulse) {
      this.land.v.y -= Math.min(1.3, st.landImpulse * 0.075);
      this.land.v.x += Math.min(0.4, st.landImpulse * 0.012);
    }
    this.land.step(dt);
    // inclinaison avec le strafe / le surf
    const targetTilt = Math.max(-0.35, Math.min(0.35, -st.strafe * 0.012)) + (st.surf ? st.surfSide * 0.18 : 0);
    this.tilt += (targetTilt - this.tilt) * Math.min(1, dt * 6);
    // tremblement à très haute vitesse (réglage « secousses »)
    const trem = Math.max(0, (st.speed - 60) / 240) * st.shake * 0.0016;
    pos.x += this.sway.x.x + this.inertia.x.x + this.land.x.x * 0.5 + (Math.random() - 0.5) * trem;
    pos.y += this.sway.x.y + this.inertia.x.y + this.land.x.y + (Math.random() - 0.5) * trem;
    pos.z += this.inertia.x.z;
    // vent : les mains reculent légèrement avec la vitesse
    pos.z += Math.min(0.03, st.speed * 0.00012) * (1 - insp * 0.5);
    pos.y -= Math.min(0.02, st.speed * 0.00008);
    this.right.position.copy(pos);
    const e = new THREE.Euler(this.swayRot.x.x + this.land.x.y * 1.5, this.swayRot.x.y, this.swayRot.x.z + this.tilt, 'XYZ');
    this.right.quaternion.copy(new THREE.Quaternion().setFromEuler(e).multiply(q));

    // main gauche
    const L = this.leftPoses;
    const lp = L.hidden.p.clone(), lq = L.hidden.q.clone();
    const wl = W.left * (1 - insp * 0.6);
    let target = L.sprint;
    if (W.slide > 0.5) target = L.slide; else if (W.dive > 0.5) target = L.dive;
    lp.lerp(target.p, wl); lq.slerp(target.q, wl);
    lp.y += W.sprint * -Math.sin(ph) * 0.04 * (1 - W.slide);
    lp.z += W.sprint * -Math.sin(ph) * 0.03;
    lp.x += this.sway.x.x * 0.8; lp.y += this.sway.x.y * 0.8 + this.land.x.y * 0.8;
    this.left.position.copy(lp);
    this.left.quaternion.copy(lq).multiply(this.qTmp.setFromEuler(new THREE.Euler(W.sprint * Math.sin(ph) * 0.4, 0, 0)));
    this.left.visible = wl > 0.02;

    // lignes de vitesse
    this.slMat.uniforms.time.value = this.time;
    const sl = st.speedLines ? Math.max(0, Math.min(1, (st.speed - 45) / 110)) : 0;
    this.slMat.uniforms.amount.value += (sl - this.slMat.uniforms.amount.value) * Math.min(1, dt * 4);
    this.speedLines.visible = this.slMat.uniforms.amount.value > 0.01;
  }

  render() {
    if (!this.visible) return;
    this.renderer.clearDepth();
    this.renderer.render(this.scene, this.camera);
  }
}

// Poses de la main droite (repère caméra) : p = position, b = direction de la lame, n = dos de la main.
ViewModel.POSES = {
  run: { p: V3(0.118, -0.112, -0.26), b: V3(-0.42, 0.78, -0.42), n: V3(0.5, 0.2, 0.84) },
  sprint: { p: V3(0.135, -0.16, -0.235), b: V3(-0.3, 0.55, -0.78), n: V3(0.75, 0.55, 0.1) },
  air: { p: V3(0.13, -0.11, -0.26), b: V3(-0.5, 0.82, -0.1), n: V3(0.65, 0.3, -0.35) },
  slide: { p: V3(0.15, -0.15, -0.245), b: V3(-0.2, 0.5, -0.84), n: V3(0.85, 0.45, 0.1) },
  faceA: { p: V3(0.118, -0.1, -0.3), b: V3(-0.86, 0.42, -0.22), n: V3(0.1, 0.22, 0.97) },
};
