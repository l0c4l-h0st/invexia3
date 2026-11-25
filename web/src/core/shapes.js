// Calcul des plans de volumes convexes à partir de leurs sommets.
// Ces fonctions ne dépendent pas de Three.js (utilisables dans le simulateur node).

export function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
export function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
export function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
export function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
export function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
export function len(a) { return Math.hypot(a[0], a[1], a[2]); }
export function norm(a) { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

/** Normale de Newell d'un polygone (robuste pour quads légèrement non plans). */
export function newell(pts) {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return [nx, ny, nz];
}

function centroid(pts) {
  const c = [0, 0, 0];
  for (const p of pts) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
  return scale(c, 1 / pts.length);
}

/** Plan [nx,ny,nz,d,internal] passant par le polygone, orienté loin du point intérieur. */
export function facePlane(pts, inside, internal = false) {
  let n = newell(pts);
  const l = len(n);
  if (l < 1e-9) return null;
  n = scale(n, 1 / l);
  const c = centroid(pts);
  if (dot(n, sub(inside, c)) > 0) n = scale(n, -1);
  // d = max sur les sommets (le plan enveloppe tout le polygone)
  let d = -Infinity;
  for (const p of pts) d = Math.max(d, dot(n, p));
  return [n[0], n[1], n[2], d, internal ? 1 : 0];
}

/** Boîte orientée : centre c, demi-tailles h, axes unitaires ax, ay, az. */
export function boxVerts(c, h, ax = [1, 0, 0], ay = [0, 1, 0], az = [0, 0, 1]) {
  const v = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    v.push([
      c[0] + ax[0] * h[0] * sx + ay[0] * h[1] * sy + az[0] * h[2] * sz,
      c[1] + ax[1] * h[0] * sx + ay[1] * h[1] * sy + az[1] * h[2] * sz,
      c[2] + ax[2] * h[0] * sx + ay[2] * h[1] * sy + az[2] * h[2] * sz,
    ]);
  }
  return v;
}
export function boxPlanes(c, h, ax = [1, 0, 0], ay = [0, 1, 0], az = [0, 0, 1]) {
  const P = [];
  for (const [a, e] of [[ax, h[0]], [ay, h[1]], [az, h[2]]]) {
    P.push([a[0], a[1], a[2], dot(a, c) + e]);
    P.push([-a[0], -a[1], -a[2], -dot(a, c) + e]);
  }
  return P;
}

/** Axes d'une boîte tournée en lacet (yaw), tangage (pitch) puis roulis (roll). */
export function axesYPR(yaw = 0, pitch = 0, roll = 0) {
  // base locale : x = côté, y = haut, z = avant(-z au repos)
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  // R = Ry(yaw) * Rx(pitch) * Rz(roll)
  const m = [
    [cy * cr + sy * sp * sr, -cy * sr + sy * sp * cr, sy * cp],
    [cp * sr, cp * cr, -sp],
    [-sy * cr + cy * sp * sr, sy * sr + cy * sp * cr, cy * cp],
  ];
  return {
    ax: [m[0][0], m[1][0], m[2][0]],
    ay: [m[0][1], m[1][1], m[2][1]],
    az: [m[0][2], m[1][2], m[2][2]],
  };
}

/**
 * Prisme entre deux sections A et B (mêmes nombres de points, même ordre).
 * internalA/B : les bouchons sont des jointures internes (non bloquantes).
 */
export function prismPlanes(A, B, internalA = false, internalB = false) {
  const all = A.concat(B);
  const inside = centroid(all);
  const P = [];
  const n = A.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const q = [A[i], A[j], B[j], B[i]];
    const pl = facePlane(q, inside);
    if (pl) P.push(pl);
  }
  const ca = facePlane(A, inside, internalA);
  const cb = facePlane(B, inside, internalB);
  if (ca) P.push(ca);
  if (cb) P.push(cb);
  return { planes: P, verts: all };
}

/** Prisme vertical à N côtés (cylindre approché) ou tronc de cône. */
export function frustumVerts(c, r0, r1, h, sides, rot = 0) {
  const bot = [], top = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    bot.push([c[0] + Math.cos(a) * r0, c[1], c[2] + Math.sin(a) * r0]);
    top.push([c[0] + Math.cos(a) * r1, c[1] + h, c[2] + Math.sin(a) * r1]);
  }
  return { bot, top };
}
export function frustumPlanes(c, r0, r1, h, sides, rot = 0) {
  const { bot, top } = frustumVerts(c, r0, r1, h, sides, rot);
  if (r1 < 0.01) {
    // cône : sommet unique
    const apex = [c[0], c[1] + h, c[2]];
    const inside = [c[0], c[1] + h * 0.25, c[2]];
    const P = [];
    for (let i = 0; i < sides; i++) {
      const pl = facePlane([bot[i], bot[(i + 1) % sides], apex], inside);
      if (pl) P.push(pl);
    }
    P.push([0, -1, 0, -c[1]]);
    return { planes: P, verts: bot.concat([apex]) };
  }
  return prismPlanes(bot, top);
}
