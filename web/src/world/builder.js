// Constructeur de monde : chaque primitive crée sa collision tout de suite et
// enregistre sa géométrie dans un « chunk » (zone de 600 m) construit à la demande.
import { boxPlanes, boxVerts, prismPlanes, frustumPlanes, frustumVerts, axesYPR, cross, norm, sub, dot, add, scale } from '../core/shapes.js';
import { smoothstep } from '../core/noise.js';

export const CHUNK = 600;

const SURFACE = {
  steel: 'metal', rust: 'metal', orange: 'metal', orangePlain: 'metal', grating: 'metal', container: 'metal',
  hull: 'metal', shed: 'metal', deck: 'concrete', concrete: 'concrete', concreteDark: 'concrete', brick: 'concrete',
};

const UVS = { concrete: 6, concreteDark: 6, steel: 4, rust: 5, orange: 8, orangePlain: 4, deck: 8, grating: 2, brick: 3, shed: 6, container: 3, hull: 10, glass: 4 };

export class Bucket {
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; }
  v(p, n, uv, c) {
    this.p.push(p[0], p[1], p[2]); this.n.push(n[0], n[1], n[2]); this.u.push(uv[0], uv[1]); this.c.push(c[0], c[1], c[2]);
  }
  get count() { return this.p.length / 3; }
}

class Chunk {
  constructor(key, ix, iz) {
    this.key = key; this.ix = ix; this.iz = iz;
    this.cx = (ix + 0.5) * CHUNK; this.cz = (iz + 0.5) * CHUNK;
    this.jobs = []; this.loaded = false; this.group = null; this.tris = 0;
  }
}

export class WorldBuilder {
  constructor(col, terrain) {
    this.col = col; this.terrain = terrain;
    this.chunks = new Map();
    this.always = new Chunk('always', 0, 0);
    this.keepOut = [];      // couloirs à garder libres [{ax,az,bx,bz,r,ymin,ymax}]
    this.instances = [];    // conteneurs etc. {type, m: [pos, yaw, scale], color}
    this.fx = [];           // fumées/flammes/feux {type, pos, ...}
    this.signs = [];        // panneaux {pos, yaw, w, h, lines, always}
    this.paths = {};        // tracés nommés (secteurs, tests)
    this.landmarks = [];
    this.brushCount = 0;
  }

  chunkAt(x, z) {
    const ix = Math.floor(x / CHUNK), iz = Math.floor(z / CHUNK);
    const k = ix + ',' + iz;
    let c = this.chunks.get(k);
    if (!c) { c = new Chunk(k, ix, iz); this.chunks.set(k, c); }
    return c;
  }
  _chunk(o, x, z) { return o.always ? this.always : this.chunkAt(x, z); }

  solid(planes, verts, mat) {
    this.brushCount++;
    return this.col.add(planes, verts, SURFACE[mat] || 'concrete');
  }

  // ---------- émission de géométrie ----------
  shade(p, base) {
    // assombrit près du sol (occlusion approximative) + légère variation
    const g = this.terrain.heightAt(p[0], p[2]);
    const k = 0.62 + 0.38 * smoothstep(0, 5, p[1] - g);
    return [base[0] * k, base[1] * k, base[2] * k];
  }

  static planarUV(p, n, s) {
    const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
    if (ay >= ax && ay >= az) return [p[0] / s, p[2] / s];
    if (ax >= az) return [p[2] / s, p[1] / s];
    return [p[0] / s, p[1] / s];
  }

  /** Polygone convexe plan (éventail). n facultatif (sinon calculé). */
  poly(bucket, pts, color, mat, uvs = null, n = null) {
    if (!n) {
      const e1 = sub(pts[1], pts[0]), e2 = sub(pts[2], pts[0]);
      n = norm(cross(e1, e2));
    }
    const s = UVS[mat] || 4;
    const uv = uvs || pts.map((p) => WorldBuilder.planarUV(p, n, s));
    const cs = pts.map((p) => this.shade(p, color));
    for (let i = 1; i < pts.length - 1; i++) {
      bucket.v(pts[0], n, uv[0], cs[0]); bucket.v(pts[i], n, uv[i], cs[i]); bucket.v(pts[i + 1], n, uv[i + 1], cs[i + 1]);
    }
  }

  /** Face orientée vers l'extérieur par rapport à un point intérieur. */
  face(bucket, pts, inside, color, mat, uvs) {
    const e1 = sub(pts[1], pts[0]), e2 = sub(pts[2], pts[0]);
    let n = norm(cross(e1, e2));
    if (dot(n, sub(inside, pts[0])) > 0) { pts = pts.slice().reverse(); if (uvs) uvs = uvs.slice().reverse(); n = scale(n, -1); }
    if (!isFinite(n[0])) return;
    this.poly(bucket, pts, color, mat, uvs, n);
  }

  // ---------- primitives ----------
  /** Boîte orientée. o = {c,h,yaw,pitch,roll,mat,color,solid,always,faces} */
  box(o) {
    const { ax, ay, az } = o.axes || axesYPR(o.yaw || 0, o.pitch || 0, o.roll || 0);
    const c = o.c, h = o.h;
    const mat = o.mat || 'concrete';
    if (o.solid !== false) this.solid(boxPlanes(c, h, ax, ay, az), boxVerts(c, h, ax, ay, az), o.surf || mat);
    const color = o.color || [1, 1, 1];
    const topMat = o.topMat || mat;
    this._chunk(o, c[0], c[2]).jobs.push((emit) => {
      const axes = [ax, ay, az];
      for (let a = 0; a < 3; a++) {
        if (o.noBottom && a === 1) { /* rien */ }
        for (const s of [1, -1]) {
          if (o.noBottom && a === 1 && s === -1) continue;
          const A = axes[a], U = axes[(a + 1) % 3], V = axes[(a + 2) % 3];
          const hu = h[(a + 1) % 3], hv = h[(a + 2) % 3];
          const fc = add(c, scale(A, h[a] * s));
          const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => add(fc, add(scale(U, hu * i), scale(V, hv * j))));
          const m = (a === 1 && s === 1) ? topMat : mat;
          this.face(emit(m), pts, c, color, m);
        }
      }
    });
  }

  /** Dalle inclinée dont le DESSUS passe par a→b (rampes, passerelles). */
  slab(a, b, width, thick, o = {}) {
    const dir = sub(b, a);
    const L = Math.hypot(dir[0], dir[1], dir[2]);
    const az = scale(dir, 1 / L);
    let ax = norm(cross([0, 1, 0], az));
    const ay = cross(az, ax);
    const mid = scale(add(a, b), 0.5);
    const c = sub(mid, scale(ay, thick / 2));
    this.box({ ...o, c, h: [width / 2, thick / 2, L / 2], axes: { ax, ay, az } });
  }

  /** Cylindre vertical / tronc de cône. o = {c:[x,y,z] base, r0, r1, h, sides, mat, color, solid, always, cap} */
  cyl(o) {
    const sides = o.sides || 16, r1 = o.r1 ?? o.r0;
    const mat = o.mat || 'steel';
    if (o.solid !== false) {
      const { planes, verts } = frustumPlanes(o.c, o.r0, r1, o.h, Math.min(sides, o.collSides || 16), o.rot || 0);
      this.solid(planes, verts, o.surf || mat);
    }
    const color = o.color || [1, 1, 1];
    this._chunk(o, o.c[0], o.c[2]).jobs.push((emit) => {
      const { bot, top } = frustumVerts(o.c, o.r0 * 1.004, r1 * 1.004, o.h, sides, o.rot || 0);
      const b = emit(mat);
      const slope = (o.r0 - r1) / o.h;
      const circ = 2 * Math.PI * Math.max(o.r0, r1);
      const s = UVS[mat] || 4;
      for (let i = 0; i < sides; i++) {
        const j = (i + 1) % sides;
        const a0 = (o.rot || 0) + (i / sides) * Math.PI * 2, a1 = (o.rot || 0) + ((i + 1) / sides) * Math.PI * 2;
        const n0 = norm([Math.cos(a0), slope, Math.sin(a0)]), n1 = norm([Math.cos(a1), slope, Math.sin(a1)]);
        const u0 = (i / sides) * circ / s, u1 = ((i + 1) / sides) * circ / s;
        const v0 = o.c[1] / s, v1 = (o.c[1] + o.h) / s;
        const c0 = this.shade(bot[i], color), c1 = this.shade(bot[j], color), c2 = this.shade(top[j], color), c3 = this.shade(top[i], color);
        if (r1 > 0.01) {
          b.v(bot[i], n0, [u0, v0], c0); b.v(top[j], n1, [u1, v1], c2); b.v(bot[j], n1, [u1, v0], c1);
          b.v(bot[i], n0, [u0, v0], c0); b.v(top[i], n0, [u0, v1], c3); b.v(top[j], n1, [u1, v1], c2);
        } else {
          const apex = [o.c[0], o.c[1] + o.h, o.c[2]];
          b.v(bot[i], n0, [u0, v0], c0); b.v(apex, norm([Math.cos((a0 + a1) / 2), slope, Math.sin((a0 + a1) / 2)]), [(u0 + u1) / 2, v1], c3); b.v(bot[j], n1, [u1, v0], c1);
        }
      }
      if (o.cap !== false && r1 > 0.01) {
        const cm = o.capMat || mat;
        this.poly(emit(cm), top.slice().reverse(), color, cm, null, [0, 1, 0]);
      }
      if (o.bottomCap) this.poly(emit(mat), bot.slice(), color, mat, null, [0, -1, 0]);
    });
  }

  /** Tuyau (cylindre) entre deux points. */
  pipe(a, b, r, o = {}) {
    const sides = o.sides || 12;
    const dir = sub(b, a);
    const L = Math.hypot(dir[0], dir[1], dir[2]);
    const az = scale(dir, 1 / L);
    const ref = Math.abs(az[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const ax = norm(cross(ref, az));
    const ay = cross(az, ax);
    const ring = (p, rr) => {
      const out = [];
      for (let i = 0; i < sides; i++) {
        const t = (i / sides) * Math.PI * 2 + Math.PI / sides;
        out.push(add(p, add(scale(ax, Math.cos(t) * rr), scale(ay, Math.sin(t) * rr))));
      }
      return out;
    };
    const A = ring(a, r), B = ring(b, r);
    const mat = o.mat || 'steel';
    if (o.solid !== false) {
      const { planes, verts } = prismPlanes(A, B);
      this.solid(planes, verts, o.surf || mat);
    }
    const color = o.color || [1, 1, 1];
    const mid = scale(add(a, b), 0.5);
    this._chunk(o, mid[0], mid[2]).jobs.push((emit) => {
      const bk = emit(mat);
      const s = UVS[mat] || 4;
      for (let i = 0; i < sides; i++) {
        const j = (i + 1) % sides;
        const ti = (i / sides) * Math.PI * 2 + Math.PI / sides, tj = (j / sides) * Math.PI * 2 + Math.PI / sides;
        const ni = add(scale(ax, Math.cos(ti)), scale(ay, Math.sin(ti))), nj = add(scale(ax, Math.cos(tj)), scale(ay, Math.sin(tj)));
        const u0 = i / sides * 2 * Math.PI * r / s, u1 = (i + 1) / sides * 2 * Math.PI * r / s;
        const ca = this.shade(A[i], color), cb = this.shade(B[i], color), cc = this.shade(B[j], color), cd = this.shade(A[j], color);
        bk.v(A[i], ni, [u0, 0], ca); bk.v(A[j], nj, [u1, 0], cd); bk.v(B[j], nj, [u1, L / s], cc);
        bk.v(A[i], ni, [u0, 0], ca); bk.v(B[j], nj, [u1, L / s], cc); bk.v(B[i], ni, [u0, L / s], cb);
      }
      if (o.caps) {
        this.poly(bk, A.slice().reverse(), color, mat, null, scale(az, -1));
        this.poly(bk, B.slice(), color, mat, null, az);
      }
    });
  }

  /**
   * Extrusion d'un profil le long d'un tracé.
   * path : [{x,y,z}] (densément échantillonné) ; parts : [{pts:[[a,b],...] convexe, mats:[...] par arête, mat, solid}]
   * Les jointures entre segments sont internes (jamais bloquantes).
   */
  sweep(path, parts, o = {}) {
    const n = path.length;
    const closed = !!o.closed;
    // repères (côté horizontal) + abscisse curviligne
    const frames = [];
    let dist = 0;
    for (let i = 0; i < n; i++) {
      const p = path[i];
      const pa = path[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], pb = path[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
      let tx = pb.x - pa.x, tz = pb.z - pa.z;
      const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      if (i > 0) dist += Math.hypot(p.x - path[i - 1].x, p.y - path[i - 1].y, p.z - path[i - 1].z);
      // côté droit (vu dans le sens de la marche) : (−tz, tx)
      frames.push({ p, sx: -tz, sz: tx, d: dist, w: p.w ?? 1 });
    }
    const segs = closed ? n : n - 1;
    const sec = (f, pt) => [f.p.x + f.sx * pt[0] * f.w, f.p.y + pt[1], f.p.z + f.sz * pt[0] * f.w];
    for (let i = 0; i < segs; i++) {
      const fa = frames[i], fb = frames[(i + 1) % n];
      if (o.skip && o.skip(fa, fb, i)) continue;
      const first = !closed && i === 0, last = !closed && i === segs - 1;
      const skipPrev = o.skip && i > 0 && o.skip(frames[i - 1], fa, i - 1);
      const skipNext = o.skip && i < segs - 1 && o.skip(fb, frames[(i + 2) % n], i + 1);
      for (const part of parts) {
        const ptsA = part.fn ? part.fn(fa) : part.pts, ptsB = part.fn ? part.fn(fb) : part.pts;
        const A = ptsA.map((pt) => sec(fa, pt)), B = ptsB.map((pt) => sec(fb, pt));
        if (part.solid !== false && o.solid !== false) {
          const { planes, verts } = prismPlanes(A, B, !(first || skipPrev), !(last || skipNext));
          this.solid(planes, verts, part.surf || part.mat || o.mat || 'concrete');
        }
        const midx = (fa.p.x + fb.p.x) / 2, midz = (fa.p.z + fb.p.z) / 2;
        const dA = fa.d, dB = fa.d + Math.hypot(fb.p.x - fa.p.x, fb.p.z - fa.p.z);
        this._chunk(o, midx, midz).jobs.push((emit) => {
          const inside = scale(add(A.reduce((s, q) => add(s, q), [0, 0, 0]), B.reduce((s, q) => add(s, q), [0, 0, 0])), 1 / (2 * A.length));
          const m = ptsA.length;
          let acc = 0;
          for (let k = 0; k < m; k++) {
            const k2 = (k + 1) % m;
            const mat = (part.mats && part.mats[k]) || part.mat || o.mat || 'concrete';
            const el = Math.hypot(ptsA[k2][0] - ptsA[k][0], ptsA[k2][1] - ptsA[k][1]);
            if (mat === null || mat === 'none') { acc += el; continue; }
            const s = UVS[mat] || 4;
            const uvs = [[dA / s, acc / s], [dA / s, (acc + el) / s], [dB / s, (acc + el) / s], [dB / s, acc / s]];
            acc += el;
            this.face(emit(mat), [A[k], A[k2], B[k2], B[k]], inside, part.color || o.color || [1, 1, 1], mat, uvs);
          }
          const capMat = part.capMat || part.mat || o.mat || 'concrete';
          if (first || skipPrev) this.face(emit(capMat), A.slice(), inside, part.color || o.color || [1, 1, 1], capMat);
          if (last || skipNext) this.face(emit(capMat), B.slice(), inside, part.color || o.color || [1, 1, 1], capMat);
        });
      }
    }
    return frames;
  }

  /** Géométrie visuelle libre (sans collision). fn(emit) */
  visual(x, z, fn, always = false) { (always ? this.always : this.chunkAt(x, z)).jobs.push(fn); }

  addKeepOut(path, r, ymin = -1e9, ymax = 1e9) {
    for (let i = 0; i < path.length - 1; i++) this.keepOut.push({ ax: path[i].x, az: path[i].z, bx: path[i + 1].x, bz: path[i + 1].z, ay: path[i].y, by: path[i + 1].y, r, ymin, ymax });
  }
  /** Vrai si un objet en (x,z) entre ymin et ymax ne gêne aucun couloir réservé. */
  isClear(x, z, rad, ymin = -1e9, ymax = 1e9) {
    for (const k of this.keepOut) {
      const dx = k.bx - k.ax, dz = k.bz - k.az;
      const L2 = dx * dx + dz * dz || 1;
      let t = ((x - k.ax) * dx + (z - k.az) * dz) / L2;
      t = Math.max(0, Math.min(1, t));
      const px = k.ax + dx * t, pz = k.az + dz * t;
      const d = Math.hypot(x - px, z - pz);
      if (d < k.r + rad) {
        const py = k.ay + (k.by - k.ay) * t;
        const lo = py + k.ymin, hi = py + k.ymax;
        if (ymax > lo && ymin < hi) return false;
      }
    }
    return true;
  }
}

// ---------- tracés ----------
/** Catmull-Rom centripète échantillonnée tous les ds mètres. pts : [{x,y,z,w?}] */
export function spline(pts, ds = 8, closed = false) {
  const P = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
  const out = [];
  const segs = closed ? pts.length : pts.length - 1;
  for (let s = 0; s < segs; s++) {
    const p0 = P[s], p1 = P[s + 1], p2 = P[s + 2], p3 = P[s + 3];
    const L = Math.hypot(p2.x - p1.x, p2.z - p1.z);
    const steps = Math.max(1, Math.round(L / ds));
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      out.push(cr(p0, p1, p2, p3, t));
    }
  }
  if (!closed) out.push({ ...pts[pts.length - 1] });
  return out;
}
function cr(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  const o = { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y), z: f(p0.z, p1.z, p2.z, p3.z) };
  if (p1.w !== undefined) o.w = f(p0.w ?? 1, p1.w ?? 1, p2.w ?? 1, p3.w ?? 1);
  return o;
}
export function pathLength(path) {
  let L = 0;
  for (let i = 1; i < path.length; i++) L += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
  return L;
}
