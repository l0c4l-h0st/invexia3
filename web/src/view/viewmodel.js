// Vue à la première personne : main gantée articulée et karambit cosmétique « KR-9 Serre ».
// Le karambit est modélisé pièce par pièce (lame en griffe à double émouture, gorge, crantage,
// anneau DLC à liseré orange, plaquettes G10 quadrillées, soie apparente, axes) pour accrocher la lumière.
// La main ne s'arrête jamais : couche « vivante », gestes spontanés (rotations autour de l'index,
// balanciers, claquements de poignet) et trois inspections à figures sur F.
import * as THREE from 'three';
import { mulberry32 } from '../core/noise.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

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
  x.fillText('KR-9 · SERRE', w - 26, h * 0.6);
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

// ---------------- karambit « KR-9 Serre » ----------------
// Repère du couteau : centre de l'anneau à l'origine, plan du couteau = XY, normale des plats = Z.
// Le manche part de l'anneau vers +X ; la lame en griffe s'enroule vers −Y (tranchant à l'intérieur de la courbe).
export const KR = { R: 0.066, phiMax: 1.92, bx: 0.106, by: 0.019 };
function arc(phi) {
  const cx = KR.bx, cy = KR.by - KR.R;
  const nx = Math.sin(phi), ny = Math.cos(phi);
  return { x: cx + KR.R * nx, y: cy + KR.R * ny, nx, ny };
}
function orientStrip(geo, expected) {
  // garantit que les normales calculées pointent vers l'extérieur attendu
  const idx = geo.index.array, pos = geo.attributes.position;
  const mid = Math.floor(idx.length / 6) * 3;
  const a = V3().fromBufferAttribute(pos, idx[mid]), b = V3().fromBufferAttribute(pos, idx[mid + 1]), c = V3().fromBufferAttribute(pos, idx[mid + 2]);
  const n = b.sub(a).cross(c.sub(a));
  if (n.dot(expected) < 0) {
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  }
  geo.computeVertexNormals();
}

function buildKarambitBlade(mats) {
  const N = 64, st = [];
  for (let i = 0; i <= N; i++) {
    const phi = KR.phiMax * Math.pow(i / N, 0.92);
    const k = phi / KR.phiMax;
    const w = 0.027 * (1 - Math.pow(k, 1.45)) + 0.00025;
    const ws = 0.42 * w, we = 0.58 * w;
    const t = 0.0044 * (1 - 0.6 * k * k);
    const fz = k > 0.08 && k < 0.6 ? Math.sin(Math.PI * (k - 0.08) / 0.52) : 0;
    st.push({ phi, k, ws, we, t, fz, a: arc(phi) });
  }
  const rho = (q, s) => -q.we + s * (q.ws + q.we);
  const flat = (q, sg) => { const fd = 0.0008 * q.fz; return [[sg * q.t / 2, 1], [sg * q.t / 2, 0.86], [sg * (q.t / 2 - fd), 0.74], [sg * q.t / 2, 0.62], [sg * q.t / 2, 0.5]]; };
  const P = (q, z, s) => [q.a.x + q.a.nx * rho(q, s), q.a.y + q.a.ny * rho(q, s), z];
  const strip = (getPts, mat, uvFn, expected) => {
    const pos = [], uv = [], idx = [];
    const m = getPts(st[0]).length;
    st.forEach((q) => getPts(q).forEach(([z, s], j) => { const p = P(q, z, s); pos.push(p[0], p[1], p[2]); uv.push(...uvFn(q, s, j)); }));
    for (let i = 0; i < N; i++) for (let j = 0; j < m - 1; j++) { const a = i * m + j, b = a + 1, c = a + m, d = c + 1; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    orientStrip(g, expected);
    return new THREE.Mesh(g, mat);
  };
  const grp = new THREE.Group();
  const uvA = (q, s) => [1 - q.k, s];
  const uvB = (q, s) => [q.k, s];
  grp.add(strip((q) => flat(q, 1), mats.faceA, uvA, V3(0, 0, 1)));
  grp.add(strip((q) => flat(q, -1), mats.faceB, uvB, V3(0, 0, -1)));
  grp.add(strip((q) => [[q.t / 2, 0.5], [0.00012, 0]], mats.bevel, uvB, V3(0, 0, 1)));
  grp.add(strip((q) => [[-q.t / 2, 0.5], [-0.00012, 0]], mats.bevel, uvB, V3(0, 0, -1)));
  const mid = arc(KR.phiMax * 0.4);
  grp.add(strip((q) => [[-q.t / 2, 1], [q.t / 2, 1]], mats.spine, (q, s, j) => [q.k, j], V3(mid.nx, mid.ny, 0)));
  // crantage du dos près du manche
  for (let i = 0; i < 9; i++) {
    const phi = 0.06 + i * 0.045, q = arc(phi), k = phi / KR.phiMax;
    const w = 0.027 * (1 - Math.pow(k, 1.45));
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.0016, 0.0013, 0.0048), mats.spine);
    tooth.position.set(q.x + q.nx * (0.42 * w + 0.0005), q.y + q.ny * (0.42 * w + 0.0005), 0);
    tooth.rotation.z = Math.atan2(q.ny, q.nx);
    grp.add(tooth);
  }
  return grp;
}

function handleOutline(grow = 0) {
  // contour du manche dans le plan XY (bosse sur le dessus, deux gorges dessous)
  const top = [], bot = [];
  for (let i = 0; i <= 24; i++) {
    const x = 0.011 + (KR.bx + 0.003 - 0.011) * i / 24;
    top.push([x, 0.0315 + 0.0035 * Math.sin(Math.PI * i / 24) + grow]);
  }
  for (let i = 24; i >= 0; i--) {
    const x = 0.013 + (KR.bx + 0.003 - 0.013) * i / 24;
    const groove = x > 0.03 && x < 0.094 ? 0.0026 * Math.cos((x - 0.03) / 0.032 * Math.PI * 2) : 0.0026;
    bot.push([x, 0.0055 + groove - grow]);
  }
  const s = new THREE.Shape();
  const pts = top.concat(bot);
  s.moveTo(pts[0][0] - grow, pts[0][1]);
  for (const [x, y] of pts.slice(1)) s.lineTo(x, y);
  s.closePath();
  return s;
}

export function buildKarambit(env, knurl, etch, temper) {
  const g10map = knurl.map.clone(); g10map.repeat.set(26, 26); g10map.needsUpdate = true;
  const g10nrm = knurl.normal.clone(); g10nrm.repeat.set(26, 26); g10nrm.needsUpdate = true;
  const mats = {
    faceA: new THREE.MeshPhysicalMaterial({ map: etch, metalness: 0.85, roughness: 0.36, envMap: env, envMapIntensity: 1.25, side: THREE.DoubleSide }),
    faceB: new THREE.MeshPhysicalMaterial({ map: temper, metalness: 1, roughness: 0.13, envMap: env, envMapIntensity: 1.65, side: THREE.DoubleSide }),
    bevel: new THREE.MeshPhysicalMaterial({ color: 0xf2f4f7, metalness: 1, roughness: 0.05, envMap: env, envMapIntensity: 2.1, side: THREE.DoubleSide }),
    spine: new THREE.MeshPhysicalMaterial({ color: 0x2a2c31, metalness: 0.9, roughness: 0.3, envMap: env, envMapIntensity: 1.0, side: THREE.DoubleSide }),
    dlc: new THREE.MeshPhysicalMaterial({ color: 0x24262a, metalness: 0.95, roughness: 0.24, envMap: env, envMapIntensity: 1.25, clearcoat: 0.7, clearcoatRoughness: 0.18 }),
    g10: new THREE.MeshStandardMaterial({ map: g10map, normalMap: g10nrm, normalScale: new THREE.Vector2(0.85, 0.85), roughness: 0.56, metalness: 0.05, envMap: env, envMapIntensity: 0.6 }),
    steel: new THREE.MeshPhysicalMaterial({ color: 0xbfc4cb, metalness: 1, roughness: 0.16, envMap: env, envMapIntensity: 1.7 }),
    liner: new THREE.MeshStandardMaterial({ color: 0xf0661c, roughness: 0.4, metalness: 0.3, envMap: env, envMapIntensity: 0.8 }),
  };
  const k = new THREE.Group();
  k.add(buildKarambitBlade(mats));
  // anneau (acier DLC) avec liseré orange intérieur
  const ring = new THREE.Shape(); ring.absarc(0, 0, 0.0215, 0, Math.PI * 2, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, 0.0127, 0, Math.PI * 2, true); ring.holes.push(hole);
  const rg = new THREE.ExtrudeGeometry(ring, { depth: 0.0058, bevelEnabled: true, bevelThickness: 0.0013, bevelSize: 0.0012, bevelSegments: 3, curveSegments: 40 });
  rg.translate(0, 0, -0.0029);
  k.add(new THREE.Mesh(rg, mats.dlc));
  const liner = new THREE.Mesh(new THREE.TorusGeometry(0.0129, 0.0011, 8, 40), mats.liner);
  k.add(liner);
  // manche : plaquettes G10 + soie apparente (liseré graphite)
  const hs = handleOutline(0);
  const hg = new THREE.ExtrudeGeometry(hs, { depth: 0.0128, bevelEnabled: true, bevelThickness: 0.0019, bevelSize: 0.0017, bevelSegments: 4, curveSegments: 12 });
  hg.translate(0, 0, -0.0064);
  k.add(new THREE.Mesh(hg, mats.g10));
  const tg = new THREE.ExtrudeGeometry(handleOutline(0.0009), { depth: 0.0042, bevelEnabled: false });
  tg.translate(0, 0, -0.0021);
  k.add(new THREE.Mesh(tg, mats.dlc));
  // axes en acier
  for (const [x, y] of [[0.036, 0.019], [0.08, 0.0205]]) {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.0024, 0.0024, 0.0172, 16), mats.steel);
    pin.rotation.x = Math.PI / 2; pin.position.set(x, y, 0);
    k.add(pin);
  }
  // mitre entre manche et lame
  const bs = new THREE.Shape();
  bs.moveTo(-0.004, -0.013); bs.lineTo(0.004, -0.014); bs.quadraticCurveTo(0.008, 0, 0.004, 0.015); bs.lineTo(-0.004, 0.016); bs.quadraticCurveTo(-0.006, 0, -0.004, -0.013);
  const bg = new THREE.ExtrudeGeometry(bs, { depth: 0.0142, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.001, bevelSegments: 3 });
  bg.translate(KR.bx + 0.001, KR.by + 0.001, -0.0071);
  k.add(new THREE.Mesh(bg, mats.dlc));
  const tip = arc(KR.phiMax), mid = arc(KR.phiMax * 0.62);
  return { group: k, tip: V3(tip.x, tip.y, 0), mid: V3(mid.x, mid.y, 0), com: V3(0.07, 0.005, 0), mats };
}

// ---------------- main droite articulée ----------------
// Repère canonique : poignet à l'origine, paume vers −Y, doigts vers −Z, pouce côté −X.
const FINGER_DEFS = {
  i: { x: -0.0285, z: -0.093, len: [0.043, 0.026, 0.02], r: 0.0088, spread: 0.06 },
  m: { x: -0.0095, z: -0.096, len: [0.046, 0.029, 0.021], r: 0.0092, spread: 0.0 },
  r: { x: 0.0095, z: -0.094, len: [0.044, 0.027, 0.02], r: 0.0087, spread: -0.05 },
  p: { x: 0.0275, z: -0.087, len: [0.035, 0.021, 0.018], r: 0.0076, spread: -0.11 },
};
function segMesh(r, len, mat) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 5, 12), mat);
  m.rotation.x = Math.PI / 2; m.position.z = -len / 2;
  return m;
}
export function buildRightRig(m) {
  const root = new THREE.Group();
  // paume, dos de main, coque de phalanges
  root.add(ellipsoid(V3(0.0, -0.0005, -0.053), V3(0.0435, 0.0165, 0.05), m.glove));
  root.add(ellipsoid(V3(0.002, -0.0085, -0.056), V3(0.038, 0.0105, 0.043), m.palm));
  root.add(ellipsoid(V3(0.0, 0.0115, -0.05), V3(0.034, 0.0058, 0.037), m.cuff));
  root.add(capsuleBetween(V3(-0.033, 0.0105, -0.088), V3(0.031, 0.0105, -0.082), 0.0068, m.armor));
  const fingers = {};
  for (const key of Object.keys(FINGER_DEFS)) {
    const d = FINGER_DEFS[key], chain = [];
    let parent = root;
    for (let s = 0; s < 3; s++) {
      const g = new THREE.Group();
      g.rotation.order = 'YXZ';
      if (s === 0) { g.position.set(d.x, -0.003, d.z); g.rotation.y = d.spread; } else g.position.set(0, 0, -d.len[s - 1]);
      const rr = d.r * [1, 0.96, 0.9][s];
      g.add(segMesh(rr, d.len[s], m.glove));
      if (s === 0) { const pad = new THREE.Mesh(new THREE.CapsuleGeometry(rr * 0.55, d.len[0] * 0.45, 4, 8), m.armor); pad.rotation.x = Math.PI / 2; pad.position.set(0, rr * 0.78, -d.len[0] * 0.48); g.add(pad); }
      if (s === 2) { const tipPad = ellipsoid(V3(0, -rr * 0.35, -d.len[2] * 0.75), V3(rr * 0.85, rr * 0.7, rr * 0.9), m.palm, 12); g.add(tipPad); }
      parent.add(g); chain.push(g); parent = g;
    }
    fingers[key] = chain;
  }
  // pouce : base orientée vers l'avant-gauche, flexion vers la paume
  const thumb = [];
  const tb = new THREE.Group();
  tb.position.set(-0.03, -0.013, -0.032);
  {
    // le pouce pointe vers l'avant le long de l'index et se replie vers l'auriculaire (+X)
    const d = V3(-0.2, -0.32, -0.93).normalize(), b = V3(1, -0.35, 0.05);
    b.sub(d.clone().multiplyScalar(b.dot(d))).normalize();
    const z = d.clone().negate(), y = b.clone().negate(), x = new THREE.Vector3().crossVectors(y, z);
    tb.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  }
  root.add(tb);
  tb.add(ellipsoid(V3(0, 0, -0.012), V3(0.015, 0.013, 0.022), m.glove));
  let parent = tb;
  const tl = [0.03, 0.03, 0.024], trr = [0.0118, 0.0104, 0.0095];
  for (let s = 0; s < 3; s++) {
    const g = new THREE.Group(); g.rotation.order = 'YXZ';
    if (s > 0) g.position.set(0, 0, -tl[s - 1]);
    g.add(segMesh(trr[s], tl[s], m.glove));
    if (s === 2) g.add(ellipsoid(V3(0, -trr[2] * 0.3, -tl[2] * 0.75), V3(trr[2] * 0.85, trr[2] * 0.7, trr[2] * 0.9), m.palm, 12));
    parent.add(g); thumb.push(g); parent = g;
  }
  // poignet, manchette, manche
  root.add(capsuleBetween(V3(0, -0.001, -0.004), V3(0.001, -0.003, 0.042), 0.029, m.cuff));
  root.add(capsuleBetween(V3(0, -0.002, 0.012), V3(0, -0.002, 0.024), 0.0306, m.stripe));
  root.add(capsuleBetween(V3(0.001, -0.004, 0.05), V3(0.006, -0.012, 0.44), 0.036, m.cuff));
  return { root, fingers, thumb };
}

// Postures des doigts (flexion en radians : phalange proximale, moyenne, distale) et du pouce.
export const HANDS = {
  grip: { i: [1.3, 1.38, 0.82], m: [1.42, 1.52, 0.92], r: [1.46, 1.52, 0.92], p: [1.5, 1.45, 0.88], t: [0.3, 0.42, 0.35] },
  loose: { i: [1.22, 1.3, 0.78], m: [1.2, 1.3, 0.8], r: [1.22, 1.3, 0.8], p: [1.25, 1.25, 0.78], t: [0.18, 0.3, 0.25] },
  open: { i: [1.12, 1.2, 0.72], m: [0.38, 0.28, 0.16], r: [0.42, 0.3, 0.16], p: [0.48, 0.36, 0.2], t: [-0.05, 0.08, 0.06] },
  release: { i: [0.45, 0.35, 0.2], m: [0.4, 0.3, 0.18], r: [0.45, 0.32, 0.18], p: [0.5, 0.38, 0.22], t: [-0.1, 0.05, 0.05] },
  point: { i: [1.12, 1.2, 0.72], m: [1.35, 1.45, 0.9], r: [1.42, 1.5, 0.9], p: [1.48, 1.42, 0.86], t: [0.25, 0.38, 0.3] },
};

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
  step(dt) { const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n; for (let i = 0; i < n; i++) this._step(h); }
  _step(dt) {
    const ax = (this.t.x - this.x.x) * this.k - this.v.x * this.c, ay = (this.t.y - this.x.y) * this.k - this.v.y * this.c, az = (this.t.z - this.x.z) * this.k - this.v.z * this.c;
    this.v.x += ax * dt; this.v.y += ay * dt; this.v.z += az * dt;
    this.x.x += this.v.x * dt; this.x.y += this.v.y * dt; this.x.z += this.v.z * dt;
  }
}

const EASE = {
  inout: (u) => u * u * u * (u * (u * 6 - 15) + 10),
  out: (u) => 1 - Math.pow(1 - u, 3),
  in: (u) => u * u * u,
  lin: (u) => u,
  back: (u) => { const c1 = 1.5, c3 = c1 + 1, v = u - 1; return 1 + c3 * v * v * v + c1 * v * v; },
  snap: (u) => 1 - Math.pow(1 - u, 5),
};

/** Orientation de la main : F = direction des doigts tendus, B = dos de la main. */
function qHand(F, B) {
  const z = F.clone().normalize().negate();
  const y = B.clone().sub(z.clone().multiplyScalar(B.dot(z))).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

function catmull(p0, p1, p2, p3, t, out) {
  const t2 = t * t, t3 = t2 * t;
  for (const c of ['x', 'y', 'z']) out[c] = 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3);
  return out;
}

const CHANNELS = ['pose', 'dx', 'dy', 'dz', 'roll', 'pitch', 'yaw', 'hand', 'spin', 'toss'];
const DEFAULTS = { pose: 'base', dx: 0, dy: 0, dz: 0, roll: 0, pitch: 0, yaw: 0, hand: 'grip', spin: 0, toss: 0 };

/** Clip d'animation à images clés : chaque canal reprend la valeur précédente s'il est omis. */
class Clip {
  constructor(name, keys, opts = {}) {
    this.name = name;
    let prev = { ...DEFAULTS };
    this.keys = keys.map((k) => { const f = { ...prev, ...k, ease: k.ease || 'inout', sound: k.sound }; prev = { ...f, sound: undefined }; return f; });
    this.dur = this.keys[this.keys.length - 1].t;
    this.opts = opts;
  }
}

const TAU = Math.PI * 2;
const FIDGETS = [
  new Clip('tour', [{ t: 0 }, { t: 0.1, hand: 'loose', spin: -0.35, ease: 'out' }, { t: 0.2, hand: 'open', sound: 'kspin' }, { t: 0.5, spin: TAU, ease: 'in' }, { t: 0.62, hand: 'grip', spin: TAU, ease: 'back', sound: 'kcatch' }]),
  new Clip('double', [{ t: 0 }, { t: 0.1, hand: 'loose', spin: -0.3, roll: 0.1, ease: 'out' }, { t: 0.2, hand: 'open', sound: 'kspin' }, { t: 0.72, spin: 2 * TAU, roll: -0.12, ease: 'inout' }, { t: 0.86, hand: 'grip', spin: 2 * TAU, roll: 0, ease: 'back', sound: 'kcatch' }]),
  new Clip('revers', [{ t: 0 }, { t: 0.1, hand: 'loose', spin: 0.35, ease: 'out' }, { t: 0.2, hand: 'open', sound: 'kspin' }, { t: 0.52, spin: -TAU, ease: 'in' }, { t: 0.64, hand: 'grip', spin: -TAU, ease: 'back', sound: 'kcatch' }]),
  new Clip('claque', [{ t: 0 }, { t: 0.09, roll: -0.55, pitch: 0.1, ease: 'out' }, { t: 0.22, roll: 0.25, pitch: -0.08, ease: 'inout', sound: 'kflick' }, { t: 0.42, roll: 0, pitch: 0, ease: 'back' }]),
  new Clip('balancier', [{ t: 0 }, { t: 0.16, hand: 'loose', spin: 0.75, ease: 'out' }, { t: 0.36, spin: -0.55 }, { t: 0.54, spin: 0.35 }, { t: 0.72, spin: -0.15 }, { t: 0.9, hand: 'grip', spin: 0, ease: 'back' }]),
  new Clip('pouce', [{ t: 0 }, { t: 0.12, hand: 'point', dy: 0.006, pitch: -0.12, ease: 'out' }, { t: 0.3, hand: 'loose', spin: 0.25, pitch: 0.06 }, { t: 0.5, hand: 'grip', spin: 0, pitch: 0, dy: 0, ease: 'back', sound: 'kcatch' }]),
];

// Inspections (F) : trois enchaînements de figures, joués à tour de rôle.
const INSPECTS = [
  new Clip('vitrine', [
    { t: 0, sound: 'kdraw' },
    { t: 0.38, pose: 'show', hand: 'grip', pitch: 0.08, ease: 'out' },
    { t: 1.0, pose: 'show', roll: 0.14, pitch: -0.04, yaw: 0.06 },
    { t: 1.14, hand: 'loose', spin: -0.32, roll: 0.1, ease: 'out' },
    { t: 1.22, hand: 'open', pose: 'spin', sound: 'kspin' },
    { t: 1.86, pose: 'spin', spin: 2 * TAU, roll: -0.06, ease: 'inout' },
    { t: 2.02, pose: 'show', hand: 'grip', spin: 2 * TAU, roll: 0, ease: 'back', sound: 'kcatch' },
    { t: 2.52, roll: Math.PI, pitch: 0.05, dy: -0.075, dx: -0.01, ease: 'inout', sound: 'kflip' },
    { t: 3.2, roll: Math.PI - 0.12, pitch: -0.04, yaw: -0.05 },
    { t: 3.3, hand: 'open', spin: 2 * TAU + 0.3, ease: 'out', sound: 'kspin' },
    { t: 3.72, spin: TAU, roll: TAU, dy: 0, dx: 0, ease: 'inout' },
    { t: 3.84, hand: 'grip', ease: 'back', sound: 'kcatch' },
    { t: 4.3, pose: 'base', roll: TAU, pitch: 0, yaw: 0, spin: TAU },
  ]),
  new Clip('lancer', [
    { t: 0, sound: 'kdraw' },
    { t: 0.32, pose: 'show', hand: 'grip', pitch: 0.12, dy: -0.02, ease: 'out' },
    { t: 0.42, hand: 'open', spin: -0.4, ease: 'out', sound: 'kspin' },
    { t: 0.78, spin: TAU, pitch: -0.1, ease: 'inout' },
    { t: 0.86, hand: 'release', dy: -0.012, pitch: 0.14, ease: 'out', sound: 'ktoss' },
    { t: 1.62, toss: 1, dy: 0.004, pitch: -0.04, ease: 'lin' },
    { t: 1.74, hand: 'grip', dy: -0.016, pitch: 0.16, ease: 'out', sound: 'kcatch' },
    { t: 2.1, pose: 'show', dy: 0, pitch: 0, ease: 'back' },
    { t: 2.62, roll: 0.12, yaw: 0.05 },
    { t: 3.12, roll: Math.PI, yaw: -0.04, dy: -0.075, dx: -0.01, ease: 'inout', sound: 'kflip' },
    { t: 3.55, roll: Math.PI + 0.1 },
    { t: 3.62, hand: 'open', spin: TAU + 0.35, ease: 'out', sound: 'kspin' },
    { t: 3.98, spin: 0, ease: 'inout' },
    { t: 4.08, hand: 'grip', roll: TAU, dy: 0, dx: 0, ease: 'back', sound: 'kcatch' },
    { t: 4.5, pose: 'base', roll: TAU, yaw: 0, spin: 0 },
  ]),
  new Clip('tourbillon', [
    { t: 0, sound: 'kdraw' },
    { t: 0.3, pose: 'spin', hand: 'loose', pitch: 0.1, ease: 'out' },
    { t: 0.4, hand: 'open', spin: -0.4, ease: 'out', sound: 'kspin' },
    { t: 0.85, spin: TAU, roll: 0.35, dx: -0.01, ease: 'in' },
    { t: 1.25, spin: 2 * TAU, roll: -0.35, dx: 0.01, dy: 0.006, ease: 'lin', sound: 'kspin' },
    { t: 1.65, spin: 3 * TAU, roll: 0.3, dx: -0.006, dy: -0.004, ease: 'lin', sound: 'kspin' },
    { t: 2.12, spin: 4 * TAU, roll: 0, dx: 0, dy: 0, ease: 'out' },
    { t: 2.24, hand: 'grip', ease: 'back', sound: 'kcatch' },
    { t: 2.5, pose: 'stab', dz: 0.02, pitch: 0.05, ease: 'in' },
    { t: 2.66, dz: -0.045, pitch: -0.08, ease: 'snap', sound: 'kflick' },
    { t: 2.95, pose: 'show', dz: 0, pitch: 0, roll: 0.15, ease: 'inout' },
    { t: 3.35, roll: 0.05 },
    { t: 3.8, pose: 'base', roll: 0, spin: 4 * TAU },
  ]),
];

export class ViewModel {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.01, 10);
    this.env = studioEnv(renderer);
    const gm = gloveMats(this.env);
    // main droite articulée + karambit
    this.right = new THREE.Group();
    this.rig = buildRightRig(gm);
    this.right.add(this.rig.root);
    this.scene.add(this.right);
    this.mount = new THREE.Group();
    this.mount.position.set(0, 0, -0.021);
    this.mount.rotation.x = Math.PI;
    this.rig.fingers.i[0].add(this.mount);
    const knurl = knurlTextures();
    this.kb = buildKarambit(this.env, knurl, etchTexture(), temperTexture());
    this.knife = this.kb.group;
    this.knife.matrixAutoUpdate = false;
    this.scene.add(this.knife);
    // main gauche
    this.left = buildLeftHand(gm);
    this.scene.add(this.left);
    // lumières (repère caméra)
    this.scene.add(new THREE.HemisphereLight(0xcdbcb0, 0x2a2420, 0.9));
    this.key = new THREE.DirectionalLight(0xffd2a8, 2.4); this.key.position.set(-1, 2, 1.2); this.scene.add(this.key);
    this.rim = new THREE.DirectionalLight(0xff7a30, 1.6); this.rim.position.set(2, 0.6, -1.5); this.scene.add(this.rim);
    this.fill = new THREE.DirectionalLight(0x9fb8ff, 0.5); this.fill.position.set(-2, -0.5, -0.5); this.scene.add(this.fill);
    this._speedLines();
    this._trail();

    const PS = ViewModel.POSES;
    this.poses = {};
    for (const k in PS) this.poses[k] = { p: PS[k].p.clone(), q: qHand(PS[k].F, PS[k].B) };
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
    this.react = new Spring(160, 14); // réaction du poignet aux rotations du couteau
    this.tilt = 0;
    this.time = 0;
    this.inspect = { active: false, t: 0, dur: INSPECTS[0].dur, events: 0, variant: -1, hold: false, clip: null };
    this.fidget = { clip: null, t: 0, timer: 2.2, last: -1, count: 0 };
    this.onSound = () => {};
    this.lastVel = V3(0, 0, 0);
    this.visible = true;
    this.qTmp = new THREE.Quaternion();
    this.lastSpin = 0; this.spinVel = 0;
    this.state = { spin: 0, toss: 0, hand: 'grip' };
    this.tmpM = new THREE.Matrix4(); this.tmpM2 = new THREE.Matrix4();
    this.prevTip = null;
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

  // traînée lumineuse de la pointe pendant les rotations rapides
  _trail() {
    const N = 18;
    this.trailN = N;
    this.trailPts = [];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 2 * 3), 3));
    g.setAttribute('a', new THREE.Float32BufferAttribute(new Float32Array(N * 2), 1));
    const idx = [];
    for (let i = 0; i < N - 1; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, b, c, b, d, c); }
    g.setIndex(idx);
    this.trailMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'attribute float a; varying float vA; void main(){ vA = a; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(vec3(1.0, 0.78, 0.55) * vA, vA); }',
    });
    this.trail = new THREE.Mesh(g, this.trailMat);
    this.trail.frustumCulled = false;
    this.trail.renderOrder = 3;
    this.scene.add(this.trail);
  }

  startInspect() {
    const I = this.inspect;
    if (I.active && !I.cancel && I.t < I.dur * 0.8) { I.cancel = 0.0001; return; } // second appui : fondu vers le repos
    this.fidget.clip = null;
    I.variant = (I.variant + 1) % INSPECTS.length;
    I.clip = INSPECTS[I.variant]; I.dur = I.clip.dur;
    I.active = true; I.t = 0; I.events = 0; I.lastT = -1; I.cancel = 0;
  }
  setInspect(t, variant = null) {
    const I = this.inspect;
    if (t === null) { I.active = false; I.hold = false; return; }
    if (variant !== null) I.variant = variant;
    if (I.variant < 0) I.variant = 0;
    I.clip = INSPECTS[I.variant]; I.dur = I.clip.dur;
    I.active = true; I.t = t; I.hold = true; I.lastT = t;
  }

  resize(aspect) { this.camera.aspect = aspect; this.camera.updateProjectionMatrix(); this.slMat.uniforms.aspect.value = aspect; }

  setPose(name, p, F, B) { this.poses[name] = { p: V3(...p), q: qHand(V3(...F), V3(...B)) }; }
  setHand(name, v) { HANDS[name] = v; }

  _poseOf(name, base) { return name === 'base' ? base : this.poses[name]; }

  /** Échantillonne un clip : renvoie position, orientation, doigts, rotation du couteau et lancer. */
  _sample(clip, t, base, out, prevT) {
    const K = clip.keys;
    let i = 0;
    while (i < K.length - 2 && t >= K[i + 1].t) i++;
    const a = K[i], b = K[i + 1];
    const u = Math.max(0, Math.min(1, (t - a.t) / Math.max(1e-4, b.t - a.t)));
    const e = EASE[b.ease](u);
    const posOf = (k) => { const P = this._poseOf(k.pose, base); return V3(P.p.x + k.dx, P.p.y + k.dy, P.p.z + k.dz); };
    const p0 = posOf(K[Math.max(0, i - 1)]), p1 = posOf(a), p2 = posOf(b), p3 = posOf(K[Math.min(K.length - 1, i + 2)]);
    catmull(p0, p1, p2, p3, e, out.p);
    const qa = this._poseOf(a.pose, base).q, qb = this._poseOf(b.pose, base).q;
    out.q.copy(qa).slerp(qb, e);
    const lerp = (x, y) => x + (y - x) * e;
    out.q.multiply(this.qTmp.setFromEuler(new THREE.Euler(lerp(a.pitch, b.pitch), lerp(a.yaw, b.yaw), lerp(a.roll, b.roll), 'ZXY')));
    out.spin = lerp(a.spin, b.spin);
    out.toss = lerp(a.toss, b.toss);
    const ha = HANDS[a.hand], hb = HANDS[b.hand];
    for (const f of ['i', 'm', 'r', 'p', 't']) for (let s = 0; s < 3; s++) out.hand[f][s] = ha[f][s] + (hb[f][s] - ha[f][s]) * e;
    // sons des clés franchies
    if (prevT !== undefined) for (const k of K) if (k.sound && k.t > prevT && k.t <= t) this.onSound(k.sound);
    return out;
  }

  /** st : {dt, mouseDX, mouseDY, vel, grounded, sprint, slide, dive, surf, surfSide, speed, stepPhase, landImpulse, shake, bob, speedLines, strafe} */
  update(st) {
    const dt = Math.min(0.25, st.dt);
    this.time += dt;
    const T = this.time;
    const W = this.w;
    const ap = (k, target, rate) => { W[k] += (target - W[k]) * Math.min(1, dt * rate); };
    ap('sprint', st.sprint && st.grounded ? 1 : 0, 8);
    ap('air', !st.grounded ? 1 : 0, 6);
    ap('slide', st.slide ? 1 : 0, 10);
    ap('dive', st.dive ? 1 : 0, 9);
    ap('left', (st.sprint && st.grounded) || st.slide || st.dive ? 1 : 0, 7);

    // 1. pose de locomotion
    const P = this.poses;
    const base = { p: P.run.p.clone(), q: P.run.q.clone() };
    const mix = (pose, w) => { if (w <= 0.001) return; base.p.lerp(pose.p, w); base.q.slerp(pose.q, w); };
    mix(P.air, W.air * (1 - W.slide));
    mix(P.sprint, W.sprint * (1 - W.air));
    mix(P.slide, Math.max(W.slide, W.dive));
    const ph = st.stepPhase * Math.PI;
    const amp = (0.0045 + 0.007 * W.sprint) * (st.grounded ? 1 : 0) * Math.min(1, st.speed / 4) * (0.45 + 0.55 * st.bob);
    base.p.x += Math.cos(ph) * amp * 0.9;
    base.p.y -= Math.abs(Math.sin(ph)) * amp * 1.3;
    base.p.z += W.sprint * Math.sin(ph) * 0.016;
    base.q.multiply(this.qTmp.setFromEuler(new THREE.Euler(W.sprint * Math.sin(ph) * 0.2, 0, Math.cos(ph) * amp * 6)));
    // 2. couche « vivante » : la main ne s'arrête jamais (respiration, roulis, tangage)
    const calm = 1 - W.sprint * 0.5;
    base.p.x += (Math.sin(T * 0.83) * 0.0024 + Math.sin(T * 2.1) * 0.0007) * calm;
    base.p.y += (Math.sin(T * 1.57 + 1.1) * 0.0019) * calm;
    base.p.z += Math.sin(T * 1.13 + 0.4) * 0.0014 * calm;
    base.q.multiply(this.qTmp.setFromEuler(new THREE.Euler(Math.sin(T * 1.27 + 0.5) * 0.045 * calm, Math.sin(T * 0.71) * 0.05 * calm, Math.sin(T * 0.93 + 2) * 0.075 * calm)));

    // 3. figures : inspection (F) ou gestes spontanés
    const out = { p: V3(0, 0, 0), q: new THREE.Quaternion(), spin: 0, toss: 0, hand: { i: [0, 0, 0], m: [0, 0, 0], r: [0, 0, 0], p: [0, 0, 0], t: [0, 0, 0] } };
    const I = this.inspect, Fd = this.fidget;
    let insp = 0;
    if (I.active && I.clip) {
      const prev = I.t;
      if (!I.hold) I.t += dt;
      this._sample(I.clip, Math.min(I.t, I.dur), base, out, I.hold || I.cancel ? undefined : prev);
      insp = Math.min(1, I.t / 0.35, Math.max(0, (I.dur - I.t) / 0.35));
      if (I.cancel) {
        // annulation : fondu de 0,3 s vers la pose de repos (rotation ramenée au tour entier le plus proche)
        I.cancel += dt;
        const k = EASE.inout(Math.min(1, I.cancel / 0.3));
        out.p.lerp(base.p, k); out.q.slerp(base.q, k);
        const target = Math.round(out.spin / TAU) * TAU;
        out.spin += (target - out.spin) * k; out.toss *= 1 - k;
        for (const f of ['i', 'm', 'r', 'p', 't']) for (let s2 = 0; s2 < 3; s2++) out.hand[f][s2] += (HANDS.grip[f][s2] - out.hand[f][s2]) * k;
        insp *= 1 - k;
        if (I.cancel >= 0.3) { I.active = false; I.cancel = 0; Fd.timer = 1.5; }
      }
      if (I.active && I.t >= I.dur && !I.hold) { I.active = false; Fd.timer = 1.8 + Math.random() * 1.5; }
    } else {
      Fd.timer -= dt;
      if (!Fd.clip && Fd.timer <= 0 && !st.slide && !st.dive) {
        let k; do { k = Math.floor(Math.random() * FIDGETS.length); } while (k === Fd.last && FIDGETS.length > 1);
        Fd.last = k; Fd.clip = FIDGETS[k]; Fd.t = 0; Fd.count++;
      }
      if (Fd.clip) {
        const prev = Fd.t;
        Fd.t += dt;
        this._sample(Fd.clip, Math.min(Fd.t, Fd.clip.dur), base, out, prev);
        if (Fd.t >= Fd.clip.dur) { Fd.clip = null; Fd.timer = 1.6 + Math.random() * 2.4; }
      } else {
        out.p.copy(base.p); out.q.copy(base.q);
        for (const f of ['i', 'm', 'r', 'p', 't']) for (let s = 0; s < 3; s++) out.hand[f][s] = HANDS.grip[f][s];
      }
    }
    W.insp = insp;
    // le couteau bascule en permanence sur l'index ; les doigts respirent
    out.spin += Math.sin(T * 2.3) * 0.07 + Math.sin(T * 5.1 + 1) * 0.02;
    for (const [f, ph2] of [['m', 0], ['r', 0.7], ['p', 1.4]]) out.hand[f][0] += Math.sin(T * 1.9 + ph2) * 0.035;
    out.hand.t[1] += Math.sin(T * 1.3) * 0.06;

    // 4. réaction du poignet à l'accélération angulaire du couteau
    const sv = (out.spin - this.lastSpin) / Math.max(dt, 1e-3);
    const sacc = (sv - this.spinVel) / Math.max(dt, 1e-3);
    this.lastSpin = out.spin; this.spinVel = sv;
    this.react.t.set(Math.max(-0.12, Math.min(0.12, -sacc * 0.0006)), Math.max(-0.08, Math.min(0.08, sv * 0.0025)), 0);
    this.react.step(dt);

    // 5. ressorts : souris, inertie du corps, réception
    const mdx = Math.max(-40, Math.min(40, st.mouseDX)), mdy = Math.max(-40, Math.min(40, st.mouseDY));
    this.sway.t.set(-mdx * 0.00045, mdy * 0.00045, 0);
    this.swayRot.t.set(mdy * 0.0035, -mdx * 0.0045, -mdx * 0.002);
    this.sway.step(dt); this.swayRot.step(dt);
    const acc = st.vel.clone().sub(this.lastVel).divideScalar(Math.max(dt, 1e-3));
    this.lastVel.copy(st.vel);
    acc.clampLength(0, 60);
    this.inertia.t.set(-acc.x * 0.00028, -acc.y * 0.00022, acc.z * 0.00018);
    this.inertia.step(dt);
    if (st.landImpulse) { this.land.v.y -= Math.min(1.3, st.landImpulse * 0.075); this.land.v.x += Math.min(0.4, st.landImpulse * 0.012); }
    this.land.step(dt);
    const targetTilt = Math.max(-0.35, Math.min(0.35, -st.strafe * 0.012)) + (st.surf ? st.surfSide * 0.18 : 0);
    this.tilt += (targetTilt - this.tilt) * Math.min(1, dt * 6);
    const trem = Math.max(0, (st.speed - 60) / 240) * st.shake * 0.0016;
    const pos = out.p;
    pos.x += this.sway.x.x + this.inertia.x.x + this.land.x.x * 0.5 + (Math.random() - 0.5) * trem;
    pos.y += this.sway.x.y + this.inertia.x.y + this.land.x.y + (Math.random() - 0.5) * trem;
    pos.z += this.inertia.x.z + Math.min(0.03, st.speed * 0.00012) * (1 - insp * 0.5);
    pos.y -= Math.min(0.02, st.speed * 0.00008);
    this.right.position.copy(pos);
    const e = new THREE.Euler(this.swayRot.x.x + this.land.x.y * 1.5 + this.react.x.x, this.swayRot.x.y + this.react.x.y, this.swayRot.x.z + this.tilt * (1 - insp * 0.6), 'XYZ');
    this.right.quaternion.copy(new THREE.Quaternion().setFromEuler(e).multiply(out.q));

    // 6. doigts et pouce
    const R = this.rig;
    for (const f of ['i', 'm', 'r', 'p']) for (let s = 0; s < 3; s++) R.fingers[f][s].rotation.x = -out.hand[f][s];
    for (let s = 0; s < 3; s++) R.thumb[s].rotation.x = -out.hand.t[s];

    // 7. karambit : accroché à l'index par l'anneau, tourne autour du doigt, peut être lancé
    this.right.updateMatrixWorld(true);
    const M = this.tmpM.copy(this.mount.matrixWorld).multiply(this.tmpM2.makeRotationZ(out.spin));
    if (out.toss > 0 && out.toss < 1) {
      const u = out.toss, h = 0.15 * 4 * u * (1 - u);
      const c = this.kb.com;
      const spinT = new THREE.Matrix4().makeTranslation(c.x, c.y, c.z).multiply(new THREE.Matrix4().makeRotationY(-2 * TAU * EASE.inout(u))).multiply(new THREE.Matrix4().makeRotationZ(0.35 * Math.sin(u * Math.PI))).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
      M.multiply(spinT).premultiply(new THREE.Matrix4().makeTranslation(-0.01 * Math.sin(u * Math.PI), h, 0.02 * Math.sin(u * Math.PI)));
    }
    this.knife.matrix.copy(M);
    this.knife.matrixWorldNeedsUpdate = true;
    this.state.spin = out.spin; this.state.toss = out.toss;

    // 8. traînée de la pointe
    const tip = this.kb.tip.clone().applyMatrix4(M), mid = this.kb.mid.clone().applyMatrix4(M);
    let sp = 0;
    if (this.prevTip) sp = tip.distanceTo(this.prevTip) / Math.max(dt, 1e-3) - pos.distanceTo(this.prevPos || pos) / Math.max(dt, 1e-3);
    this.prevTip = tip.clone(); this.prevPos = pos.clone();
    const inten = Math.max(0, Math.min(1, (sp - 1.0) / 2.5));
    this.trailInt = (this.trailInt || 0) + (inten - (this.trailInt || 0)) * Math.min(1, dt * 12);
    this.trailPts.unshift([tip, mid]);
    if (this.trailPts.length > this.trailN) this.trailPts.pop();
    const ta = this.trail.geometry.attributes.position.array, aa = this.trail.geometry.attributes.a.array;
    for (let k = 0; k < this.trailN; k++) {
      const pr = this.trailPts[Math.min(k, this.trailPts.length - 1)];
      ta.set([pr[0].x, pr[0].y, pr[0].z], k * 6); ta.set([pr[1].x, pr[1].y, pr[1].z], k * 6 + 3);
      const fade = Math.pow(1 - k / this.trailN, 1.6) * this.trailInt * 0.5;
      aa[k * 2] = fade; aa[k * 2 + 1] = fade * 0.05;
    }
    this.trail.geometry.attributes.position.needsUpdate = true; this.trail.geometry.attributes.a.needsUpdate = true;
    this.trail.visible = this.trailInt > 0.02;

    // 9. main gauche
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

    // 10. lignes de vitesse
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

// Poses de la main droite (repère caméra) : p = position du poignet, F = direction des doigts tendus, B = dos de la main.
ViewModel.POSES = {
  // index en haut, auriculaire en bas, paume tournée vers la caméra côté gauche : la griffe sort sous le poing
  run: { p: V3(0.172, -0.04, -0.31), F: V3(-0.78, 0.15, -0.6), B: V3(0.58, 0.12, -0.8) },
  sprint: { p: V3(0.185, -0.07, -0.29), F: V3(-0.55, 0.1, -0.83), B: V3(0.82, 0.1, -0.56) },
  air: { p: V3(0.168, -0.025, -0.31), F: V3(-0.8, 0.25, -0.55), B: V3(0.55, 0.2, -0.81) },
  slide: { p: V3(0.19, -0.08, -0.3), F: V3(-0.5, 0.0, -0.87), B: V3(0.85, 0.2, -0.48) },
  show: { p: V3(0.11, -0.025, -0.27), F: V3(-0.97, 0.2, 0.12), B: V3(0.13, 0.05, -0.99) },
  spin: { p: V3(0.1, -0.055, -0.36), F: V3(-0.95, 0.25, -0.15), B: V3(0.2, 0.1, -0.97) },
  toss: { p: V3(0.125, -0.06, -0.29), F: V3(-0.9, 0.3, -0.3), B: V3(0.3, 0.2, -0.93) },
  stab: { p: V3(0.14, -0.05, -0.285), F: V3(-0.45, 0.2, -0.87), B: V3(0.85, 0.15, -0.5) },
};
