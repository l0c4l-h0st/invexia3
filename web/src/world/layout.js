// Plan du monde « Friche Ardente ». Toutes les positions en mètres.
// Nord = −z. Le Belvédère (départ) est au sommet du Terril, à l'origine.
import { GEO, dockWorld } from '../core/geo.js';
import { spline } from './builder.js';
import { mulberry32, smoothstep, clamp, lerp } from '../core/noise.js';
import { prismPlanes } from '../core/shapes.js';

const D2R = Math.PI / 180;
const S2 = Math.SQRT1_2;
const polar = (R, deg) => ({ x: R * Math.cos(deg * D2R), z: R * Math.sin(deg * D2R) });
const NE = (s, l) => ({ x: S2 * (s + l), z: S2 * (-s + l) });

// Teintes (multiplient les textures)
const TINT = {
  white: [1, 1, 1], warm: [1, 0.95, 0.88], dark: [0.55, 0.55, 0.58], rust: [0.95, 0.8, 0.7],
  orange: [1, 1, 1], brick: [1, 1, 1], pale: [1.08, 1.05, 1.0],
};
const CONTAINER_COLORS = [[0.85, 0.39, 0.12], [0.23, 0.25, 0.28], [0.54, 0.23, 0.15], [0.31, 0.42, 0.43], [0.79, 0.72, 0.61], [0.27, 0.33, 0.42], [0.9, 0.5, 0.18]];

// ---------- profils ----------
function channelParts(getHw, getHb, ang = 55, faceMat = 'orange', floorMat = 'deck', depth = 2) {
  const t = Math.tan(ang * D2R), d = -depth;
  const floor = { fn: (f) => { const hw = getHw(f); return [[-hw, 0], [hw, 0], [hw, d], [-hw, d]]; }, mats: [floorMat, 'concreteDark', 'concreteDark', 'concreteDark'] };
  const right = { fn: (f) => { const hw = getHw(f), hb = getHb(f), run = hb / t; return [[hw, d], [hw, 0], [hw + run, hb], [hw + run + 1.2, hb], [hw + run + 1.2, d]]; }, mats: ['none', faceMat, 'steel', 'concrete', 'concreteDark'] };
  const left = { fn: (f) => { const hw = getHw(f), hb = getHb(f), run = hb / t; return [[-hw, d], [-hw, 0], [-hw - run, hb], [-hw - run - 1.2, hb], [-hw - run - 1.2, d]]; }, mats: ['none', faceMat, 'steel', 'concrete', 'concreteDark'] };
  return [floor, right, left];
}
function wedgeParts(H, ang) {
  const w = H / Math.tan(ang * D2R);
  return [{ pts: [[-0.4, 0], [0.4, 0], [0.4 + w, -H], [-0.4 - w, -H]], mats: ['steel', 'orange', 'steel', 'orange'] }];
}

export function buildWorld(B) {
  const T = B.terrain;
  const rnd = mulberry32(20261125);
  const ground = (x, z) => T.heightAt(x, z);
  const info = { plazas: [], sectors: [], routes: {}, spawn: { x: 0, y: 104 + 0.71, z: 6, yaw: 0 } };

  // ======================= LE BELVÉDÈRE (départ) =======================
  B.box({ c: [0, 95, 0], h: [22, 9, 22], yaw: 45 * D2R, mat: 'concrete', topMat: 'deck', always: true });
  // garde-corps SO/SE avec ouvertures pour les rampes d'accès
  const edge = (dirDeg) => polar(22, dirDeg);
  for (const dir of [135, 45]) { // SO (135°) et SE (45°) en angle polaire (z sud)
    const c = edge(dir);
    const tx = -Math.sin(dir * D2R), tz = Math.cos(dir * D2R);
    for (const side of [-1, 1]) {
      const m = { x: c.x + tx * side * 14, z: c.z + tz * side * 14 };
      B.box({ c: [m.x, 104.55, m.z], h: [0.12, 0.55, 8], yaw: Math.atan2(tx, tz), mat: 'orangePlain', always: true });
    }
    // rampe d'accès vers le plateau du terril
    const out = polar(1, dir);
    let L = 42, end;
    for (let k = 0; k < 3; k++) { end = { x: c.x + out.x * L, z: c.z + out.z * L }; L = (104 - ground(end.x, end.z)) / Math.tan(16 * D2R); }
    end = { x: c.x + out.x * L, z: c.z + out.z * L };
    B.slab([c.x, 104, c.z], [end.x, ground(end.x, end.z) + 0.05, end.z], 11, 5, { mat: 'concrete', topMat: 'grating', always: true });
  }
  // mât radio avec balise
  B.cyl({ c: [0, 104, 25], r0: 2.2, r1: 0.5, h: 44, sides: 4, mat: 'steel', always: true, rot: Math.PI / 4 });
  B.fx.push({ type: 'beacon', pos: [0, 148.5, 25], color: 'red' });
  // panneaux directionnels au-dessus des deux départs
  B.signs.push({ pos: polar(19, -45), y: 110.5, face: 135, w: 15, h: 3.6, lines: ['HAUTS-FOURNEAUX', 'LES COULÉES · SURF  ↗ 2,2 km'], always: true });
  B.signs.push({ pos: polar(19, -135), y: 110.5, face: 45, w: 15, h: 3.6, lines: ['DOCKS DE LA DARSE', '↖ 2,2 km · GRAND VIADUC'], always: true });
  for (const d of [-45, -135]) {
    const c = polar(19, d);
    const tx = -Math.sin(d * D2R), tz = Math.cos(d * D2R);
    for (const s of [-1, 1]) B.box({ c: [c.x + tx * s * 8, 107.5, c.z + tz * s * 8], h: [0.35, 3.5, 0.35], mat: 'steel', always: true });
  }
  info.sectors.push({ name: 'Le Belvédère', sub: 'Départ · altitude 104 m', test: (x, y, z) => Math.hypot(x, z) < 34 && y > 101 });
  const terrilSector = { name: 'Le Terril', sub: 'Crassier de laitier', test: (x, y, z) => Math.hypot(x, z) < 360 };

  // ======================= LES COULÉES (surf NE) =======================
  const wH = 16, wA = 57;
  const cPath = (ctrl) => spline(ctrl.map(([s, l, y]) => ({ ...NE(s, l), y })), 6);
  // une seule coulée continue de 1,5 km : départ droit, grand S, puis tremplin vers la réception
  const C1 = cPath([[24, 0, 101], [130, 0, 95], [230, 0, 87.5], [330, 2, 80], [470, 24, 71.5], [610, 62, 64], [750, 82, 57.5], [880, 64, 51.5], [985, 26, 46.5], [1120, -24, 40.5], [1255, -58, 35], [1385, -44, 30], [1475, -9, 26.5], [1535, 0, 28], [1560, 0, 31]]);
  // couloir de réception : entrée en entonnoir (large et basse), plein jusqu'au sol
  const REC = cPath([[1495, 0, 3.4], [1620, 0, 3.6], [1760, 0, 3.6], [1890, 0, 3.4], [2000, 0, 3], [2035, 0, 2.2]]);
  { let d = 0; REC.forEach((p, i) => { if (i) d += Math.hypot(p.x - REC[i - 1].x, p.z - REC[i - 1].z); p.hw = 5 + 8 * (1 - smoothstep(40, 230, d)); }); }
  for (const P of [C1]) {
    B.sweep(P, wedgeParts(wH, wA), { always: true, mat: 'orange' });
    B.addKeepOut(P, 32, -400, 30);
    // tréteaux sous les rampes
    for (let i = 3; i < P.length - 2; i += 6) {
      const p = P[i], q = P[i + 1];
      const bot = p.y - wH;
      const g = ground(p.x, p.z);
      if (bot - g < 2.5) continue;
      const tx = q.x - p.x, tz = q.z - p.z, tl = Math.hypot(tx, tz) || 1;
      const sx = -tz / tl, sz = tx / tl;
      for (const s of [-1, 1]) {
        const lx = p.x + sx * s * 6, lz = p.z + sz * s * 6;
        const gl = ground(lx, lz);
        B.box({ c: [lx, (gl - 2 + bot) / 2, lz], h: [0.6, (bot - gl + 2) / 2, 0.6], yaw: Math.atan2(sx, sz), mat: 'steel' });
      }
      B.box({ c: [p.x, bot - 0.5, p.z], h: [7, 0.5, 0.5], yaw: Math.atan2(sx, sz) + Math.PI / 2, mat: 'steel', solid: false });
    }
  }
  const recParts = channelParts((f) => f.p.hw, () => 20, 55, 'orange', 'deck', 12);
  B.sweep(REC, recParts, { always: true });
  B.addKeepOut(REC, 34, -400, 40);
  info.routes.coulees = [C1, REC];
  info.sectors.push({ name: 'Les Coulées', sub: 'Ligne de surf · 1,7 km de descente', path: [...C1, ...REC], r: 42, yAbove: 30 });

  // ======================= GRAND VIADUC (NO) =======================
  const VIA = spline([
    { x: -15.6, z: -15.6, y: 104 }, { x: -48, z: -48, y: 104 }, { x: -120, z: -150, y: 102 }, { x: -235, z: -335, y: 97.5 },
    { x: -390, z: -520, y: 91.5 }, { x: -610, z: -630, y: 84 }, { x: -835, z: -745, y: 75 }, { x: -1005, z: -925, y: 63 },
    { x: -1105, z: -1105, y: 50 }, { x: -1185, z: -1188, y: 38 }, { x: -1214, z: -1214, y: 36 }, { x: -1245.5, z: -1245.5, y: 36 },
  ], 8);
  // berges basses au départ : la vue sur les Docks reste dégagée depuis le Belvédère
  { let d = 0; VIA.forEach((p, i) => { if (i) d += Math.hypot(p.x - VIA[i - 1].x, p.z - VIA[i - 1].z); p.hb = 1.2 + 5.8 * smoothstep(60, 260, d); }); }
  const viaParts = channelParts(() => 13, (f) => f.p.hb, 55);
  B.sweep(VIA, viaParts, { always: true });
  pillars(B, VIA, () => 13, -1, false);
  B.addKeepOut(VIA, 28, -400, 24);
  lampPosts(B, VIA, () => 13, (p) => p.hb);
  info.routes.viaduc = VIA;
  info.sectors.push({ name: 'Grand Viaduc', sub: 'Autoroute de bunny hop · 1,8 km', path: VIA, r: 34, yRel: -10 });
  info.sectors.push(terrilSector);

  // ======================= LA BOUCLE (anneau surélevé) =======================
  const ringR = [[-90, 1950], [-67.5, 1900], [-45, 1840], [-22.5, 1860], [0, 1960], [22.5, 1900], [45, 1840], [67.5, 1880], [90, 1960], [112.5, 1820], [135, 1650], [157.5, 1800], [180, 1960], [-157.5, 1900], [-135, 1830], [-112.5, 1900]];
  const RING = spline(ringR.map(([d, R]) => ({ ...polar(R, d), y: 0 })), 8, true);
  const plz = [
    { id: 'F', name: 'Échangeur des Fourneaux', deg: -33, y: 58, hump: 16 },
    { id: 'P', name: 'Échangeur de la Plaine', deg: 45, y: 44, hump: -12 },
    { id: 'G', name: 'Échangeur du Gazomètre', deg: 135, y: 70, hump: 8 },
    { id: 'D', name: 'Échangeur de la Darse', deg: -135, y: 36, hump: 10 },
  ];
  const normDeg = (d) => { while (d < -135) d += 360; while (d >= 225) d -= 360; return d; };
  const order = [plz[3], plz[0], plz[1], plz[2]]; // D(-135) F(-33) P(45) G(135)
  const ringY = (deg) => {
    deg = normDeg(deg);
    for (let k = 0; k < 4; k++) {
      const a = order[k], b = order[(k + 1) % 4];
      const a0 = a.deg, a1 = k === 3 ? b.deg + 360 : b.deg;
      if (deg >= a0 && deg < a1) {
        const zone = 4.1;
        const t = clamp((deg - (a0 + zone)) / ((a1 - zone) - (a0 + zone)), 0, 1);
        return lerp(a.y, b.y, smoothstep(0, 1, t)) + a.hump * Math.sin(Math.PI * t) ** 2;
      }
    }
    return 50;
  };
  const prof = (deg) => {
    // U standard (14, 8) ; large à l'est ; « vallées » en V au nord et au sud
    const band = (lo, hi, w) => smoothstep(lo - w, lo, deg) * (1 - smoothstep(hi, hi + w, deg));
    const v = Math.max(band(72, 112, 6), band(-112, -60, 6));
    const wide = band(-16, 16, 6);
    return { hw: 14 + 6 * wide - 10.5 * v, hb: 8 - 2 * wide + 7 * v };
  };
  for (const p of RING) {
    const deg = Math.atan2(p.z, p.x) / D2R;
    p.deg = deg; p.y = ringY(deg);
    const q = prof(normDeg(deg) > 180 ? normDeg(deg) - 360 : normDeg(deg));
    p.hw = q.hw; p.hb = q.hb;
  }
  // échangeurs (plates-formes)
  for (const P of plz) {
    let best = 0, bd = 1e9;
    for (let i = 0; i < RING.length; i++) { const d = Math.abs(((RING[i].deg - P.deg + 540) % 360) - 180); if (d < bd) { bd = d; best = i; } }
    const p = RING[best], q = RING[(best + 1) % RING.length], o = RING[(best - 1 + RING.length) % RING.length];
    let tx = q.x - o.x, tz = q.z - o.z; const tl = Math.hypot(tx, tz); tx /= tl; tz /= tl;
    const sx = -tz, sz = tx; // côté droit
    const R = Math.hypot(p.x, p.z), rx = p.x / R, rz = p.z / R; // radial sortant
    P.x = p.x; P.z = p.z; P.tx = tx; P.tz = tz; P.sx = sx; P.sz = sz; P.rx = rx; P.rz = rz; P.R = R;
    info.plazas.push(P);
    B.box({ c: [p.x, P.y - 1.5, p.z], h: [70, 1.5, 70], axes: { ax: [sx, 0, sz], ay: [0, 1, 0], az: [tx, 0, tz] }, mat: 'concrete', topMat: 'deck', always: true });
    for (const [a, b] of [[-42, -42], [42, -42], [-42, 42], [42, 42]]) {
      const x = p.x + sx * a + tx * b, z = p.z + sz * a + tz * b, g = ground(x, z) - 2;
      if (B.isClear(x, z, 5, g, P.y - 3)) B.box({ c: [x, (g + P.y - 3) / 2, z], h: [3.5, (P.y - 3 - g) / 2, 3.5], mat: 'concrete', color: [0.92, 0.9, 0.88] });
    }
    // mâts d'éclairage aux coins + portique de signalisation
    for (const [a, b] of [[-66, -66], [66, -66], [-66, 66], [66, 66]]) {
      const x = p.x + sx * a + tx * b, z = p.z + sz * a + tz * b;
      B.box({ c: [x, P.y + 7, z], h: [0.35, 7, 0.35], mat: 'steel' });
      B.fx.push({ type: 'lamp', pos: [x, P.y + 14.3, z] });
    }
    B.signs.push({ pos: { x: p.x + tx * 60, z: p.z + tz * 60 }, y: P.y + 9, face: Math.atan2(tz, tx) / D2R + 180, w: 16, h: 3.4, lines: [P.name.toUpperCase(), plazaHint(P.id)], always: true });
    for (const s of [-1, 1]) B.box({ c: [p.x + tx * 60 + sx * s * 9, P.y + 5, p.z + tz * 60 + sz * s * 9], h: [0.4, 5, 0.4], mat: 'steel' });
    info.sectors.push({ name: P.name, sub: `Plate-forme · altitude ${P.y} m`, test: (x, y, z) => Math.hypot(x - p.x, z - p.z) < 100 && y > P.y - 8 });
  }
  const inPlaza = (x, z) => info.plazas.some((P) => {
    const dx = x - P.x, dz = z - P.z;
    return Math.abs(dx * P.sx + dz * P.sz) < 70 && Math.abs(dx * P.tx + dz * P.tz) < 70;
  });
  B.sweep(RING, channelParts((f) => f.p.hw, (f) => f.p.hb, 55), {
    closed: true, always: true,
    skip: (fa, fb) => inPlaza((fa.p.x + fb.p.x) / 2, (fa.p.z + fb.p.z) / 2),
  });
  pillars(B, RING, (p) => p.hw, -1, true, inPlaza);
  lampPosts(B, RING, (p) => p.hw, (p) => p.hb, inPlaza);
  B.addKeepOut([...RING, RING[0]], 30, -12, 40);
  info.routes.ring = RING;
  info.sectors.push({ name: 'La Boucle', sub: 'Anneau surélevé · 11,8 km', path: RING, r: 36, yRel: -8 });

  // rampes d'accès au sol depuis les échangeurs
  const access = (P, dirx, dirz, fromEdge, width = 16) => {
    const sx0 = P.x + dirx * fromEdge, sz0 = P.z + dirz * fromEdge;
    let L = 150;
    for (let k = 0; k < 4; k++) { const ex = sx0 + dirx * L, ez = sz0 + dirz * L; L = (P.y - ground(ex, ez)) / Math.tan(15 * D2R); }
    const ex = sx0 + dirx * L, ez = sz0 + dirz * L;
    B.slab([sx0, P.y, sz0], [ex, ground(ex, ez) + 0.02, ez], width, 3, { mat: 'concrete', topMat: 'deck' });
    for (let d = 30; d < L - 20; d += 36) {
      const x = sx0 + dirx * d, z = sz0 + dirz * d, y = P.y - (P.y - ground(ex, ez)) * d / L;
      const g = ground(x, z);
      if (y - 3 - g > 2) B.box({ c: [x, (y - 3 + g - 2) / 2, z], h: [width / 2 - 1.5, (y - 3 - g + 2) / 2, 1.2], yaw: Math.atan2(dirx, dirz), mat: 'concrete' });
    }
    const pts = [{ x: sx0, z: sz0, y: P.y }, { x: ex, z: ez, y: ground(ex, ez) }];
    B.addKeepOut(pts, width / 2 + 6, -10, 30);
    return { x: ex, z: ez };
  };
  const pD = info.plazas.find((p) => p.id === 'D'), pF = info.plazas.find((p) => p.id === 'F'), pP = info.plazas.find((p) => p.id === 'P'), pG = info.plazas.find((p) => p.id === 'G');
  // Darse : vers l'extérieur, côté docks (décalé pour éviter le viaduc)
  access(pD, pD.rx, pD.rz, 70);
  access(pF, pF.rx, pF.rz, 70);
  access(pP, -pP.rx, -pP.rz, 70);
  access(pG, -pG.rx, -pG.rz, 70);

  // ======================= HAUTS-FOURNEAUX (NE) =======================
  furnaces(B, info, ground, rnd);
  // ======================= DOCKS DE LA DARSE (NO) =======================
  docks(B, info, ground, rnd);
  // ======================= GAZOMÈTRE (SO) =======================
  gasometer(B, info, ground, rnd, pG);
  // ======================= PLAINE DES SCORIES (SE) =======================
  plaine(B, info, ground, rnd);
  // ======================= PIPELINES (rideables) =======================
  pipelines(B, info, ground);
  info.roads = [
    [[240, 60], [700, -260], [1100, -800], [1380, -1290]],
    [[-230, -120], [-640, -560], [-1050, -1000], [-1330, -1380]],
    [[-200, 240], [-650, 760], [-1080, 1180]],
    [[230, 220], [650, 560], [1100, 1060], [1500, 1350]],
    [[320, -200], [900, 300], [1500, 700], [2150, 600]],
    [[-330, 120], [-900, 200], [-1700, 100], [-2300, 300]],
  ];
  // ======================= FRICHES (ruines diffuses) =======================
  info.sectors.push({ name: 'Crêtes de laitier', sub: 'Limite du monde', test: (x, y, z) => Math.hypot(x, z) > 2850 });
  scatter(B, info, ground, rnd);
  return info;
}

// Pipelines sur supports : gros tuyaux continus (on peut rouler dessus ou les surfer)
function pipelines(B, info, ground) {
  const lines = [
    { pts: [[1240, -1480], [600, -1380], [0, -1330], [-600, -1360], [-1120, -1420]], y: 9, r: 1.7 },
    { pts: [[-1080, 1180], [-500, 1450], [200, 1450], [760, 1030]], y: 7.5, r: 1.5 },
  ];
  for (const L of lines) {
    for (let k = 0; k < L.pts.length - 1; k++) {
      const [ax, az] = L.pts[k], [bx, bz] = L.pts[k + 1];
      const len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / 48);
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n;
        const x0 = lerp(ax, bx, t0), z0 = lerp(az, bz, t0), x1 = lerp(ax, bx, t1), z1 = lerp(az, bz, t1);
        const g0 = ground(x0, z0), g1 = ground(x1, z1);
        const y0 = Math.max(L.y, g0 + L.y * 0.75), y1 = Math.max(L.y, g1 + L.y * 0.75);
        const ok = [0, 0.5, 1].every((t) => B.isClear(lerp(x0, x1, t), lerp(z0, z1, t), L.r + 1.5, lerp(y0, y1, t) - L.r - 1, lerp(y0, y1, t) + L.r + 1));
        if (!ok) continue;
        B.pipe([x0, y0, z0], [x1, y1, z1], L.r, { mat: 'rust', sides: 12, color: [0.85, 0.78, 0.74] });
        // support en portique
        const g = ground(x0, z0);
        const dx = (x1 - x0) / len * n, dz = (z1 - z0) / len * n;
        B.box({ c: [x0, (g - 1 + y0 - L.r) / 2, z0], h: [L.r + 0.6, (y0 - L.r - g + 1) / 2, 0.45], yaw: Math.atan2(dx, dz), mat: 'steel' });
      }
      B.addKeepOut([{ x: ax, z: az, y: L.y }, { x: bx, z: bz, y: L.y }], L.r + 4, -30, 10);
    }
  }
}

function plazaHint(id) {
  return { F: 'HAUTS-FOURNEAUX ↓ · BOUCLE ⇄', P: 'PLAINE DES SCORIES ↓ · BOUCLE ⇄', G: 'GAZOMÈTRE · HÉLICE ↓', D: 'DOCKS ↓ · GRAND VIADUC → BELVÉDÈRE' }[id];
}

// Piles sous un tablier : paires (ou pile centrale si le tablier est étroit)
function pillars(B, path, getHw, every = -1, ring = false, skipFn = null) {
  const T = B.terrain;
  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], p = path[i];
    acc += Math.hypot(p.x - a.x, p.z - a.z);
    if (acc < 48) continue;
    acc = 0;
    if (skipFn && skipFn(p.x, p.z)) continue;
    const q = path[(i + 1) % path.length];
    let tx = q.x - a.x, tz = q.z - a.z; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    const sx = -tz, sz = tx;
    const hw = getHw(p);
    const top = p.y - 2;
    const offs = hw > 8 ? [-(hw - 4), hw - 4] : [0];
    const ok = offs.every((o) => {
      const x = p.x + sx * o, z = p.z + sz * o;
      return B.isClear(x, z, 3, T.heightAt(x, z), top - 1) && top - T.heightAt(x, z) > 5;
    });
    if (!ok) continue;
    for (const o of offs) {
      const x = p.x + sx * o, z = p.z + sz * o, g = T.heightAt(x, z) - 3;
      B.box({ c: [x, (g + top) / 2, z], h: [1.8, (top - g) / 2, 1.8], yaw: Math.atan2(sx, sz), mat: 'concrete', color: [0.92, 0.9, 0.88] });
      B.pillarSpots = B.pillarSpots || [];
      B.pillarSpots.push({ x, z });
    }
    B.box({ c: [p.x, top - 1.2, p.z], h: [2.2, 1.2, hw + 2], yaw: Math.atan2(sx, sz), mat: 'concreteDark', solid: true });
  }
  if (B.pillarSpots) {
    for (const s of B.pillarSpots.splice(0)) B.keepOut.push({ ax: s.x, az: s.z, bx: s.x + 0.01, bz: s.z, ay: 0, by: 0, r: 3, ymin: -1e9, ymax: 1e9 });
  }
}

// Lampadaires sur la crête des berges (visuels, sans collision)
function lampPosts(B, path, getHw, getHb, skipFn = null) {
  let acc = 0, side = 1;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], p = path[i];
    acc += Math.hypot(p.x - a.x, p.z - a.z);
    if (acc < 72) continue;
    acc = 0; side = -side;
    if (skipFn && skipFn(p.x, p.z)) continue;
    const q = path[(i + 1) % path.length];
    let tx = q.x - a.x, tz = q.z - a.z; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    const sx = -tz, sz = tx;
    const hw = getHw(p), hb = getHb(p), run = hb / Math.tan(55 * D2R);
    const o = side * (hw + run + 0.6);
    const x = p.x + sx * o, z = p.z + sz * o, y = p.y + hb;
    B.box({ c: [x, y + 5, z], h: [0.18, 5, 0.18], mat: 'steel', solid: false });
    B.fx.push({ type: 'lamp', pos: [x - sx * side * 1.2, y + 10.1, z - sz * side * 1.2] });
  }
}

// ---------------------------------------------------------------------------
function furnaces(B, info, ground, rnd) {
  const F = GEO.furnaces;
  const U = [S2, -S2], V = [S2, S2]; // radial (NE), tangentiel (SE)
  const W = (u, v) => ({ x: F.x + U[0] * u + V[0] * v, z: F.z + U[1] * u + V[1] * v });
  const yawU = Math.atan2(U[0], U[1]);
  const at = (u, v, y) => { const p = W(u, v); return [p.x, y, p.z]; };

  const TOP = 77; // plate-forme du gueulard
  info.furnaceTop = TOP;
  for (const fv of [-120, 0, 120]) {
    const c = W(60, fv);
    // corps du haut-fourneau
    B.cyl({ c: [c.x, -1, c.z], r0: 18, h: 37, sides: 24, mat: 'brick', always: true });
    B.cyl({ c: [c.x, 36, c.z], r0: 16.5, r1: 12, h: 38.5, sides: 24, mat: 'rust', always: true });
    B.box({ c: [c.x, TOP - 1.5, c.z], h: [17, 1.5, 17], yaw: yawU, mat: 'grating', always: true });
    B.cyl({ c: [c.x, TOP, c.z], r0: 9.5, r1: 4, h: 17, sides: 16, mat: 'steel', always: true });
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4;
      B.pipe([c.x + Math.cos(a) * 6.5, TOP + 14, c.z + Math.sin(a) * 6.5], [c.x + Math.cos(a) * 2.6, TOP + 40, c.z + Math.sin(a) * 2.6], 1.4, { mat: 'rust', always: true });
    }
    B.cyl({ c: [c.x, TOP + 39, c.z], r0: 3.8, h: 3.5, sides: 12, mat: 'steel', always: true });
    B.fx.push({ type: 'flame', pos: [c.x, TOP + 46, c.z], size: 13 });
    B.fx.push({ type: 'smoke', pos: [c.x, TOP + 50, c.z], rate: 1.6, size: 30 });
    B.fx.push({ type: 'beacon', pos: [c.x, TOP + 43.5, c.z], color: 'red' });
    // conduite descendante + pot à poussières
    const dc = W(100, fv + 42);
    B.pipe([c.x, TOP + 38, c.z], [dc.x, 44, dc.z], 2, { mat: 'rust', always: true });
    B.cyl({ c: [dc.x, 26, dc.z], r0: 3, r1: 9, h: 8, sides: 16, mat: 'steel' });
    B.cyl({ c: [dc.x, 34, dc.z], r0: 9, h: 12, sides: 16, mat: 'steel' });
    for (const [a, b] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) B.box({ c: [dc.x + a, 13, dc.z + b], h: [0.6, 13, 0.6], mat: 'steel' });
    // cowpers (surfables sur leurs dômes)
    for (const dv of [-32, 0, 32]) {
      const s = W(118, fv + dv);
      B.cyl({ c: [s.x, -1, s.z], r0: 9, h: 46, sides: 20, mat: 'steel', always: true, color: [0.85, 0.85, 0.9] });
      B.cyl({ c: [s.x, 45, s.z], r0: 9, r1: 7.6, h: 4.5, sides: 20, mat: 'steel', always: true, color: [0.85, 0.85, 0.9] });
      B.cyl({ c: [s.x, 49.5, s.z], r0: 7.6, r1: 4.6, h: 3.2, sides: 20, mat: 'steel', always: true, color: [0.85, 0.85, 0.9] });
      B.cyl({ c: [s.x, 52.7, s.z], r0: 4.6, r1: 0, h: 2.2, sides: 20, mat: 'steel', always: true, color: [0.85, 0.85, 0.9] });
    }
    // halle de coulée (toit en bâtière marchable)
    const hc = W(3, fv);
    B.box({ c: [hc.x, 9, hc.z], h: [33, 9, 25], yaw: yawU + Math.PI / 2, mat: 'shed' });
    const ridge0 = at(3 - 33, fv, 27.5), ridge1 = at(3 + 33, fv, 27.5);
    for (const s of [-1, 1]) {
      const e0 = at(3 - 33, fv + 26 * s, 18), e1 = at(3 + 33, fv + 26 * s, 18);
      // pan de toit : prisme entre faîtage et égout
      const A = [ridge0, e0, [e0[0], 17, e0[2]], [ridge0[0], 26.5, ridge0[2]]];
      const Bp = [ridge1, e1, [e1[0], 17, e1[2]], [ridge1[0], 26.5, ridge1[2]]];
      const { planes, verts } = prismPlanes(A, Bp);
      B.solid(planes, verts, 'shed');
      B.visual(hc.x, hc.z, (emit) => {
        B.face(emit('rust'), [ridge0, e0, e1, ridge1], [hc.x, 0, hc.z], [1, 1, 1], 'rust');
        B.face(emit('shed'), [ridge0, e0, [e0[0], 18, e0[2]]], [hc.x, 20, hc.z], [0.8, 0.8, 0.8], 'shed');
        B.face(emit('shed'), [ridge1, e1, [e1[0], 18, e1[2]]], [hc.x, 20, hc.z], [0.8, 0.8, 0.8], 'shed');
      });
    }
    // pont de chargement (skip) : du sol au gueulard, 12 m de large
    const s0 = at(-112, fv, 0.05), s1 = at(43.5, fv, TOP - 0.05);
    B.slab(s0, s1, 12, 2.5, { mat: 'steel', topMat: 'grating', always: true });
    for (let k = 1; k < 5; k++) {
      const t = k / 5, u = -112 + 155.5 * t, y = TOP * t;
      if (u > -32 && u < 38) continue;
      const p = W(u, fv);
      if (y > 6) B.box({ c: [p.x, (y - 3) / 2, p.z], h: [0.8, (y - 3) / 2 + 0.5, 0.8], mat: 'steel' });
    }
  }
  // collecteur de gaz : gros tuyau rideable reliant les halles
  B.pipe(at(-8, -150, 31), at(-8, 150, 31), 2.6, { mat: 'rust', sides: 12, always: true });
  for (const v of [-70, -35, 35, 70]) { const p = W(-8, v); B.box({ c: [p.x, 14.25, p.z], h: [0.7, 14.25, 0.7], mat: 'steel' }); }
  // halle de stockage (accueil depuis Les Coulées)
  for (const [v0, v1] of [[-190, -132], [-108, -32], [32, 108], [132, 190]]) {
    const p = W(-150, (v0 + v1) / 2);
    B.box({ c: [p.x, 10, p.z], h: [12, 10, (v1 - v0) / 2], yaw: yawU + Math.PI / 2, mat: 'concrete', topMat: 'concreteDark' });
  }
  // cheminées et torchère (repères lointains)
  for (const v of [-70, 70]) {
    const p = W(185, v);
    B.cyl({ c: [p.x, -1, p.z], r0: 7, r1: 4, h: 152, sides: 16, mat: 'concrete', always: true, color: [0.85, 0.82, 0.8] });
    B.fx.push({ type: 'smoke', pos: [p.x, 154, p.z], rate: 1.8, size: 30 });
    B.fx.push({ type: 'beacon', pos: [p.x, 152.5, p.z], color: 'red' });
  }
  const fl = W(230, 0);
  B.cyl({ c: [fl.x, -1, fl.z], r0: 3, r1: 1.6, h: 176, sides: 8, mat: 'steel', always: true });
  B.fx.push({ type: 'flame', pos: [fl.x, 182, fl.z], size: 18, flare: true });
  B.fx.push({ type: 'smoke', pos: [fl.x, 190, fl.z], rate: 1.0, size: 26 });
  // fosses à laitier incandescent
  for (const v of [-60, 60]) {
    const p = W(-70, v);
    B.box({ c: [p.x, -0.6, p.z], h: [16, 0.8, 9], yaw: yawU, mat: 'concreteDark' });
    B.fx.push({ type: 'glow', pos: [p.x, 0.25, p.z], w: 30, d: 16, yaw: yawU });
  }
  // parc à minerai (tas marchables) vers la rampe de l'échangeur
  for (let k = 0; k < 7; k++) {
    const p = W(-260 + rnd() * 120, 260 + k * 42 + rnd() * 10);
    const r = 14 + rnd() * 8;
    if (!B.isClear(p.x, p.z, r, 0, 12)) continue;
    B.cyl({ c: [p.x, -0.5, p.z], r0: r, r1: 0, h: r * 0.55, sides: 12, mat: 'rust', color: [0.75, 0.5, 0.4] });
  }
  info.sectors.push({ name: 'Hauts-Fourneaux', sub: 'Trois fourneaux · ponts de chargement vers les gueulards', test: (x, y, z) => Math.hypot(x - F.x, z - F.z) < 470 });
}

// ---------------------------------------------------------------------------
function docks(B, info, ground, rnd) {
  const D = GEO.docks;
  const A = [D.ax, D.az], Bv = [D.bx, D.bz];
  const at = (u, v, y) => { const p = dockWorld(u, v); return [p.x, y, p.z]; };
  const yawA = Math.atan2(D.ax, D.az);
  // murs de quai
  const hl = D.len / 2, hw = D.wid / 2;
  for (const s of [-1, 1]) {
    const p = dockWorld(0, s * (hw + 3));
    B.box({ c: [p.x, 0.5, p.z], h: [3, 2, hl + 6], yaw: yawA, mat: 'concrete', always: true });
    const q = dockWorld(s * (hl + 3), 0);
    B.box({ c: [q.x, 0.5, q.z], h: [3, 2, hw], yaw: yawA + Math.PI / 2, mat: 'concrete', always: true });
  }
  // cargo amarré : coque surfable
  const hull = [];
  for (let u = -158; u <= 78; u += 6) {
    let w = 1;
    if (u > 30) w = Math.max(0.12, 1 - Math.pow((u - 30) / 48, 1.6));
    if (u < -140) w = 1 - (-140 - u) / 18 * 0.25;
    const p = dockWorld(u, -52);
    hull.push({ x: p.x, z: p.z, y: 0, w });
  }
  B.sweep(hull, [{ pts: [[-17, 16], [17, 16], [11.5, 2], [5, -3.5], [-5, -3.5], [-11.5, 2]], mats: ['deck', 'hull', 'hull', 'hull', 'hull', 'hull'], capMat: 'hull' }], { always: true });
  // château arrière + cheminée
  const st = dockWorld(-138, -52);
  B.box({ c: [st.x, 28, st.z], h: [13, 12, 11], yaw: yawA + Math.PI / 2, mat: 'concrete', color: [1.05, 1.03, 1] , always: true});
  B.box({ c: [st.x, 41.5, st.z], h: [17, 1.5, 6], yaw: yawA + Math.PI / 2, mat: 'steel', always: true });
  const fn = dockWorld(-150, -52);
  B.box({ c: [fn.x, 46, fn.z], h: [3.2, 8, 4.5], yaw: yawA, mat: 'orangePlain', always: true });
  B.fx.push({ type: 'smoke', pos: [fn.x, 55, fn.z], rate: 0.5, size: 10 });
  // conteneurs sur le pont
  for (let u = -110; u <= 20; u += 14) for (let k = -2; k <= 2; k++) {
    const h = 1 + Math.floor(rnd() * 3);
    containerStack(B, at(u, -52 + k * 2.75, 16), yawA, h, rnd);
  }
  // portiques à conteneurs (grues) sur le quai intérieur
  for (const u of [-210, -70, 70, 210]) {
    for (const du of [-13, 13]) for (const dv of [-140, -119]) {
      const p = dockWorld(u + du, dv);
      B.box({ c: [p.x, 26, p.z], h: [1.3, 26, 1.3], mat: 'orangePlain', always: true });
    }
    for (const dv of [-140, -119]) { const p = dockWorld(u, dv); B.box({ c: [p.x, 50, p.z], h: [14.5, 2, 1.4], yaw: yawA + Math.PI / 2, mat: 'orangePlain', always: true }); }
    const bm = dockWorld(u, -70);
    B.box({ c: [bm.x, 55.5, bm.z], h: [3.2, 1.5, 95], yaw: yawA + Math.PI / 2, mat: 'orangePlain', always: true });
    const mh = dockWorld(u, -152);
    B.box({ c: [mh.x, 50.8, mh.z], h: [6, 3.2, 7], yaw: yawA, mat: 'steel', always: true });
    const ap = dockWorld(u, -124);
    B.box({ c: [ap.x, 72, ap.z], h: [1, 15, 1], mat: 'orangePlain', solid: false, always: true });
    B.pipe([ap.x, 86, ap.z], at(u, 20, 57), 0.25, { mat: 'steel', solid: false, sides: 6, always: true });
    B.pipe([ap.x, 86, ap.z], at(u, -160, 57), 0.25, { mat: 'steel', solid: false, sides: 6, always: true });
    B.fx.push({ type: 'beacon', pos: [ap.x, 87.5, ap.z], color: 'red' });
  }
  // galerie inclinée : du parc à conteneurs à la flèche de la grue n°2
  B.slab(at(-70, -330, 2.6), at(-70, -162, 57), 7, 1.6, { mat: 'steel', topMat: 'grating', always: true });
  // parc à conteneurs
  for (let bu = -320; bu < 320; bu += 92) for (let bv = -322; bv < -165; bv += 26) {
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
      if (rnd() < 0.12) continue;
      const u = bu + c * 12.8 + 6.4, v = bv + r * 2.75;
      const p = dockWorld(u, v);
      const h = 1 + Math.floor(rnd() * rnd() * 4.2);
      if (!B.isClear(p.x, p.z, 7, 2.5, 2.5 + h * 2.6)) continue;
      containerStack(B, [p.x, 2.5, p.z], yawA, h, rnd);
    }
  }
  // quai extérieur : hangars à toit cintré + silos
  for (const u of [-250, -80, 90]) {
    const c = dockWorld(u, 175);
    B.box({ c: [c.x, 8.5, c.z], h: [20, 6, 75], yaw: yawA, mat: 'shed' });
    const n = 8;
    for (let k = 0; k < n; k++) {
      const a0 = Math.PI * k / n, a1 = Math.PI * (k + 1) / n;
      const p0 = [-Math.cos(a0) * 20, 14.5 + Math.sin(a0) * 11], p1 = [-Math.cos(a1) * 20, 14.5 + Math.sin(a1) * 11];
      const A0 = at(u - 75, 175 + p0[0], p0[1]), A1 = at(u - 75, 175 + p1[0], p1[1]);
      const B0 = at(u + 75, 175 + p0[0], p0[1]), B1 = at(u + 75, 175 + p1[0], p1[1]);
      const lower = (P) => [P[0], P[1] - 0.6, P[2]];
      const sa = [A0, A1, lower(A1), lower(A0)], sb = [B0, B1, lower(B1), lower(B0)];
      const { planes, verts } = prismPlanes(sa, sb);
      B.solid(planes, verts, 'shed');
      B.visual(c.x, c.z, (emit) => B.face(emit('shed'), [A0, A1, B1, B0], [c.x, 0, c.z], [0.9, 0.9, 0.92], 'shed'));
    }
  }
  for (let k = 0; k < 10; k++) {
    const c = dockWorld(170 + k * 14.2, 215);
    B.cyl({ c: [c.x, 1, c.z], r0: 7, h: 42, sides: 16, mat: 'concrete', color: [0.95, 0.93, 0.9] });
  }
  const g0 = dockWorld(170 - 7, 215), g1 = dockWorld(170 + 9 * 14.2 + 7, 215);
  B.slab([g0.x, 46, g0.z], [g1.x, 46, g1.z], 8, 3, { mat: 'concrete', topMat: 'grating' });
  B.slab(at(-30, 262, 2.6), at(161, 215, 46), 6, 1.5, { mat: 'steel', topMat: 'grating' });
  // phare de la darse
  const lh = dockWorld(hl + 30, 0);
  B.cyl({ c: [lh.x, 0, lh.z], r0: 4, r1: 2.6, h: 52, sides: 12, mat: 'concrete', always: true, color: [1, 1, 1] });
  B.cyl({ c: [lh.x, 52, lh.z], r0: 3.4, h: 4, sides: 12, mat: 'orangePlain', always: true });
  B.fx.push({ type: 'beacon', pos: [lh.x, 57.5, lh.z], color: 'warm' });
  B.fx.push({ type: 'water' });
  info.sectors.push({
    name: 'Docks de la Darse', sub: 'Cargo surfable · portiques · parc à conteneurs',
    test: (x, y, z) => {
      const dx = x - D.cx, dz = z - D.cz;
      const u = dx * D.ax + dz * D.az, v = dx * D.bx + dz * D.bz;
      return Math.abs(u) < hl + 160 && v > -360 && v < hw + 220;
    },
  });
}

function containerStack(B, base, yaw, h, rnd) {
  const ax = [Math.cos(yaw), 0, -Math.sin(yaw)], az = [Math.sin(yaw), 0, Math.cos(yaw)];
  const H = h * 2.6;
  B.solid(...(() => {
    const c = [base[0], base[1] + H / 2, base[2]], hh = [1.22, H / 2, 6.1];
    const P = [], vs = [];
    for (const [a, e] of [[ax, hh[0]], [[0, 1, 0], hh[1]], [az, hh[2]]]) {
      P.push([a[0], a[1], a[2], a[0] * c[0] + a[1] * c[1] + a[2] * c[2] + e]);
      P.push([-a[0], -a[1], -a[2], -(a[0] * c[0] + a[1] * c[1] + a[2] * c[2]) + e]);
    }
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) vs.push([c[0] + ax[0] * hh[0] * sx + az[0] * hh[2] * sz, c[1] + hh[1] * sy, c[2] + ax[2] * hh[0] * sx + az[2] * hh[2] * sz]);
    return [P, vs, 'container'];
  })());
  for (let k = 0; k < h; k++) {
    B.instances.push({ type: 'container', pos: [base[0], base[1] + k * 2.6 + 1.3, base[2]], yaw, color: CONTAINER_COLORS[Math.floor(rnd() * CONTAINER_COLORS.length)] });
  }
}

// ---------------------------------------------------------------------------
function gasometer(B, info, ground, rnd, pG) {
  const G = GEO.gaso;
  // cuve et dôme (surfable sur son pourtour)
  B.cyl({ c: [G.x, -1, G.z], r0: 56, h: 39, sides: 32, collSides: 24, mat: 'steel', always: true, color: [0.75, 0.78, 0.82] });
  const dome = [[38, 56], [46, 50.5], [51, 40], [54, 25], [55.4, 0]];
  for (let k = 0; k < dome.length - 1; k++) {
    B.cyl({ c: [G.x, dome[k][0], G.z], r0: dome[k][1], r1: dome[k + 1][1], h: dome[k + 1][0] - dome[k][0], sides: 32, collSides: 24, mat: 'steel', always: true, color: [0.75, 0.78, 0.82], cap: false });
  }
  // charpente : 20 colonnes + anneau supérieur marchable
  const n = 20;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const x = G.x + Math.cos(a) * 61, z = G.z + Math.sin(a) * 61;
    B.box({ c: [x, 48, z], h: [0.8, 49, 0.8], yaw: -a, mat: 'rust', always: true });
    const a2 = ((k + 1) / n) * Math.PI * 2;
    const x2 = G.x + Math.cos(a2) * 61, z2 = G.z + Math.sin(a2) * 61;
    B.slab([x, 97, z], [x2, 97, z2], 3, 1.2, { mat: 'rust', topMat: 'grating', always: true });
    for (const y of [33, 65]) B.slab([x, y, z], [x2, y, z2], 1.0, 0.8, { mat: 'rust', solid: false, always: true });
  }
  B.fx.push({ type: 'beacon', pos: [G.x, 99, G.z], color: 'red' });
  // hélice : descente en spirale de l'échangeur (70 m) jusqu'au sol
  const Rh = 84;
  const phi0 = Math.atan2(pG.z - G.z, pG.x - G.x);
  const pts = [];
  const edgeX = pG.x + pG.rx * 70, edgeZ = pG.z + pG.rz * 70;
  pts.push({ x: edgeX, z: edgeZ, y: 70 });
  pts.push({ x: edgeX + pG.rx * 18, z: edgeZ + pG.rz * 18, y: 70 });
  const turns = 1.72, total = turns * Math.PI * 2;
  const startA = phi0 + 0.55;
  for (let k = 0; k <= 60; k++) {
    const t = k / 60;
    const a = startA + t * total;
    const y = 69 - 68.6 * smoothstep(0, 1, t * 1.02);
    pts.push({ x: G.x + Math.cos(a) * Rh, z: G.z + Math.sin(a) * Rh, y: Math.max(0.4, y) });
  }
  const endA = startA + total + 0.4;
  pts.push({ x: G.x + Math.cos(endA) * (Rh + 30), z: G.z + Math.sin(endA) * (Rh + 30), y: Math.max(0.3, ground(G.x + Math.cos(endA) * (Rh + 30), G.z + Math.sin(endA) * (Rh + 30))) });
  const HEL = spline(pts, 6);
  B.sweep(HEL, channelParts(() => 7.5, () => 4.5, 55), { always: true });
  B.addKeepOut(HEL, 18, -6, 20);
  for (let i = 4; i < HEL.length; i += 7) {
    const p = HEL[i];
    const g = ground(p.x, p.z);
    if (p.y - 2 - g < 4) continue;
    B.box({ c: [p.x, (p.y - 2 + g - 2) / 2, p.z], h: [1.3, (p.y - 2 - g + 2) / 2, 1.3], mat: 'concrete' });
  }
  info.routes.helix = HEL;
  // tours de refroidissement (hyperboloïdes)
  for (const [dx, dz] of [[190, 150], [-40, 270]]) {
    const x = G.x + dx, z = G.z + dz;
    const prof = [[0, 46], [35, 35], [70, 30], [95, 32], [112, 35.5]];
    for (let k = 0; k < prof.length - 1; k++) {
      B.cyl({ c: [x, prof[k][0] - (k === 0 ? 1 : 0), z], r0: prof[k][1], r1: prof[k + 1][1], h: prof[k + 1][0] - prof[k][0] + (k === 0 ? 1 : 0), sides: 32, collSides: 20, mat: 'concrete', always: true, color: [0.9, 0.88, 0.86], cap: k === prof.length - 2, capMat: 'concreteDark' });
    }
    B.fx.push({ type: 'steam', pos: [x, 114, z], rate: 2.0, size: 36 });
  }
  info.sectors.push({ name: 'Le Gazomètre', sub: 'Hélice de 0,9 km · dôme surfable', test: (x, y, z) => Math.hypot(x - G.x, z - G.z) < 360 });
}

// ---------------------------------------------------------------------------
function plaine(B, info, ground, rnd) {
  const P = GEO.plaine;
  // cônes de laitier (surfables)
  let placed = 0;
  for (let k = 0; k < 60 && placed < 13; k++) {
    const a = rnd() * Math.PI * 2, d = 120 + rnd() * 700;
    const x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d;
    const r = 22 + rnd() * 22, h = r * (1.2 + rnd() * 0.35);
    const g = ground(x, z);
    if (!B.isClear(x, z, r + 6, g, g + h)) continue;
    B.cyl({ c: [x, g - 2, z], r0: r, r1: 0, h: h + 2, sides: 14, mat: 'rust', color: [0.62, 0.48, 0.42] });
    B.keepOut.push({ ax: x, az: z, bx: x + 0.01, bz: z, ay: 0, by: 0, r: r + 4, ymin: -1e9, ymax: 1e9 });
    placed++;
  }
  // tremplins
  placed = 0;
  for (let k = 0; k < 80 && placed < 16; k++) {
    const a = rnd() * Math.PI * 2, d = 80 + rnd() * 760;
    const x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d;
    const dir = rnd() * Math.PI * 2;
    const L = 26 + rnd() * 10, H = 7 + rnd() * 5, W = 14;
    const dx = Math.sin(dir), dz = Math.cos(dir);
    const g0 = ground(x - dx * L / 2, z - dz * L / 2), g1 = ground(x + dx * L / 2, z + dz * L / 2);
    if (!B.isClear(x, z, L / 2 + 6, Math.min(g0, g1), Math.max(g0, g1) + H)) continue;
    kicker(B, x, z, dir, L, H, W, g0, g1);
    B.keepOut.push({ ax: x, az: z, bx: x + 0.01, bz: z, ay: 0, by: 0, r: L / 2 + 8, ymin: -1e9, ymax: 1e9 });
    placed++;
  }
  // ligne haute tension : des Hauts-Fourneaux vers le sud-est
  const line = [];
  for (let k = 0; k < 13; k++) {
    const t = k / 12;
    line.push({ x: lerp(520, 2150, t), z: lerp(-380, 1250, t) + Math.sin(t * 3) * 80 });
  }
  let prev = null;
  for (const p of line) {
    const g = ground(p.x, p.z);
    if (!B.isClear(p.x, p.z, 10, g, g + 48)) { prev = null; continue; }
    pylon(B, p.x, p.z, g);
    if (prev) for (const s of [-11, 11]) {
      const ya = prev.g + 44, yb = g + 44;
      B.visual((p.x + prev.x) / 2, (p.z + prev.z) / 2, (emit) => {
        const bk = emit('cable');
        const N = 10;
        for (let i = 0; i < N; i++) {
          const t0 = i / N, t1 = (i + 1) / N;
          const sag = (t) => -6 * 4 * t * (1 - t);
          const P0 = [lerp(prev.x, p.x, t0) + s * 0.7, lerp(ya, yb, t0) + sag(t0), lerp(prev.z, p.z, t0) - s * 0.7];
          const P1 = [lerp(prev.x, p.x, t1) + s * 0.7, lerp(ya, yb, t1) + sag(t1), lerp(prev.z, p.z, t1) - s * 0.7];
          const up = [0, 0.09, 0];
          B.poly(bk, [P0, P1, [P1[0], P1[1] + up[1], P1[2]], [P0[0], P0[1] + up[1], P0[2]]], [1, 1, 1], 'cable', [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 0, 1]);
          B.poly(bk, [[P0[0], P0[1] + up[1], P0[2]], [P1[0], P1[1] + up[1], P1[2]], P1, P0], [1, 1, 1], 'cable', [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 0, -1]);
        }
      });
    }
    prev = { x: p.x, z: p.z, g };
  }
  // cokerie : deux batteries de fours (toits marchables) + tour à charbon
  const ck = { x: 760, z: 420 };
  for (const dz of [-14, 14]) {
    const g = ground(ck.x, ck.z + dz);
    if (B.isClear(ck.x, ck.z + dz, 80, g, g + 16)) B.box({ c: [ck.x, g + 6.5, ck.z + dz], h: [80, 9, 8], mat: 'brick', topMat: 'concreteDark' });
  }
  {
    const g = ground(ck.x + 92, ck.z);
    B.box({ c: [ck.x + 92, g + 20, ck.z], h: [8, 22, 8], mat: 'concrete' });
    B.slab([ck.x - 140, ground(ck.x - 140, ck.z) + 0.02, ck.z], [ck.x - 81, ground(ck.x, ck.z) + 15.5, ck.z], 10, 2, { mat: 'concrete', topMat: 'deck' });
    const q = { x: ck.x + 110, z: ck.z + 40 };
    const gq = ground(q.x, q.z);
    B.box({ c: [q.x, gq + 15, q.z], h: [6, 17, 6], mat: 'concrete' });
    B.fx.push({ type: 'steam', pos: [q.x, gq + 33, q.z], rate: 1.4, size: 16 });
  }
  // voie ferrée et wagons
  const rail = [];
  for (let k = 0; k <= 30; k++) { const t = k / 30; rail.push({ x: lerp(360, 1700, t), z: lerp(260, 900, t) + Math.sin(t * 4) * 60 }); }
  for (let i = 0; i < rail.length - 1; i++) {
    const a = rail[i], b = rail[i + 1];
    const ga = ground(a.x, a.z), gb = ground(b.x, b.z);
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
    const sx = -dz / L, sz = dx / L;
    for (const s of [-0.75, 0.75]) B.slab([a.x + sx * s, ga + 0.25, a.z + sz * s], [b.x + sx * s, gb + 0.25, b.z + sz * s], 0.15, 0.25, { mat: 'steel', solid: false });
    if (i % 3 === 1 && rnd() < 0.8) {
      const m = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
      const g = ground(m.x, m.z);
      if (B.isClear(m.x, m.z, 9, g, g + 5)) B.box({ c: [m.x, g + 2.6, m.z], h: [1.6, 1.8, 7], yaw: Math.atan2(dx, dz), mat: rnd() < 0.5 ? 'rust' : 'container', color: [0.7, 0.36, 0.2] });
    }
  }
  info.sectors.push({ name: 'Plaine des Scories', sub: 'Zone ouverte · cônes surfables · tremplins', test: (x, y, z) => Math.hypot(x - P.x, z - P.z) < 900 });
}

function kicker(B, x, z, dir, L, H, W, g0, g1) {
  const dx = Math.sin(dir), dz = Math.cos(dir), sx = dz, sz = -dx;
  const back = [x - dx * L / 2, g0 - 1.5, z - dz * L / 2], front = [x + dx * L / 2, g1 + H, z + dz * L / 2], frontLow = [x + dx * L / 2, g1 - 1.5, z + dz * L / 2];
  const sec = (s) => [[back[0] + sx * s, back[1] + 1.5, back[2] + sz * s], [front[0] + sx * s, front[1], front[2] + sz * s], [frontLow[0] + sx * s, frontLow[1], frontLow[2] + sz * s], [back[0] + sx * s, back[1], back[2] + sz * s]];
  const A = sec(-W / 2), Bq = sec(W / 2);
  const { planes, verts } = prismPlanes(A, Bq);
  B.solid(planes, verts, 'orangePlain');
  B.visual(x, z, (emit) => {
    const inside = [x, (g0 + g1) / 2 + H / 3, z];
    B.face(emit('orange'), [A[0], A[1], Bq[1], Bq[0]], inside, [1, 1, 1], 'orange', [[0, 0], [L / 8, 0], [L / 8, W / 8], [0, W / 8]]);
    B.face(emit('steel'), [A[1], A[2], Bq[2], Bq[1]], inside, [1, 1, 1], 'steel');
    B.face(emit('steel'), A.slice(), inside, [0.8, 0.8, 0.8], 'steel');
    B.face(emit('steel'), Bq.slice(), inside, [0.8, 0.8, 0.8], 'steel');
  });
}

function pylon(B, x, z, g) {
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    B.pipe([x + a * 5, g - 0.5, z + b * 5], [x + a * 1.4, g + 46, z + b * 1.4], 0.35, { mat: 'steel', sides: 4 });
  }
  for (const y of [34, 42]) B.box({ c: [x, g + y, z], h: [12, 0.5, 0.8], yaw: Math.PI / 4, mat: 'steel' });
  for (const y of [10, 22]) B.box({ c: [x, g + y, z], h: [4.2, 0.2, 4.2], mat: 'steel', solid: false });
}

// ---------------------------------------------------------------------------
function scatter(B, info, ground, rnd) {
  // hangars en ruine dans les friches
  let n = 0;
  for (let k = 0; k < 400 && n < 34; k++) {
    const a = rnd() * Math.PI * 2, d = 450 + rnd() * 2300;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.hypot(x, z) > 2800) continue;
    const w = 14 + rnd() * 16, l = 24 + rnd() * 30, h = 7 + rnd() * 7, yaw = rnd() * Math.PI;
    const g = ground(x, z);
    if (!B.isClear(x, z, Math.hypot(w, l) / 2 + 4, g - 2, g + h + 6)) continue;
    const ca = Math.cos(yaw), sa = Math.sin(yaw);
    const W = (u, v) => [x + ca * u + sa * v, z - sa * u + ca * v];
    // murs avec ouvertures (portes)
    const walls = [[0, -l / 2, w / 2, 0.35, 0], [0, l / 2, w / 2, 0.35, 0], [-w / 2, -l / 4 - 2, 0.35, l / 4 - 2, 1], [-w / 2, l / 4 + 2, 0.35, l / 4 - 2, 1], [w / 2, 0, 0.35, l / 2, 1]];
    for (const [u, v, hu, hv] of walls) {
      const [px, pz] = W(u, v);
      const gg = ground(px, pz);
      B.box({ c: [px, gg + h / 2 - 1, pz], h: [hu, h / 2 + 1, hv], yaw, mat: rnd() < 0.5 ? 'shed' : 'concrete', color: [0.9, 0.86, 0.82] });
    }
    // toit en bâtière (marchable)
    const top = g + h - 1 + 4;
    for (const s of [-1, 1]) {
      const [ex, ez] = W(s * (w / 2 + 0.6), 0);
      const [rx0, rz0] = W(0, -l / 2 - 0.5), [rx1, rz1] = W(0, l / 2 + 0.5);
      const ea = W(s * (w / 2 + 0.6), -l / 2 - 0.5), eb = W(s * (w / 2 + 0.6), l / 2 + 0.5);
      const A = [[rx0, top, rz0], [ea[0], g + h - 1, ea[1]], [ea[0], g + h - 1.4, ea[1]], [rx0, top - 0.4, rz0]];
      const Bq = [[rx1, top, rz1], [eb[0], g + h - 1, eb[1]], [eb[0], g + h - 1.4, eb[1]], [rx1, top - 0.4, rz1]];
      const { planes, verts } = prismPlanes(A, Bq);
      B.solid(planes, verts, 'shed');
      B.visual(x, z, (emit) => {
        B.face(emit('rust'), [A[0], A[1], Bq[1], Bq[0]], [x, g, z], [0.85, 0.8, 0.78], 'rust');
        B.face(emit('rust'), [A[3], A[2], Bq[2], Bq[3]], [x, top + 10, z], [0.6, 0.6, 0.6], 'rust');
      });
    }
    n++;
  }
  // repères au sol : tas de laitier noir marchables
  for (let k = 0, m = 0; k < 200 && m < 22; k++) {
    const a = rnd() * Math.PI * 2, d = 420 + rnd() * 2300;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.hypot(x, z) > 2750) continue;
    const r = 18 + rnd() * 26, h = r * (0.3 + rnd() * 0.25);
    const g = ground(x, z);
    if (!B.isClear(x, z, r + 4, g, g + h)) continue;
    B.cyl({ c: [x, g - 1.5, z], r0: r, r1: 0, h: h + 1.5, sides: 12, mat: 'rust', color: [0.45, 0.4, 0.38] });
    m++;
  }
  // secteurs par défaut
  info.sectors.push({ name: 'Friches', sub: '', test: () => true, dynamic: true });
}
