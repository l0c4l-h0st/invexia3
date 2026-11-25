// Terrain en grille de hauteurs. La physique et le rendu utilisent exactement
// les mêmes triangles (diagonale 00→11), donc pas de décalage pieds/sol.
import { GEO, dockLocal } from './geo.js';
import { fbm2, smoothstep, clamp, lerp } from './noise.js';

function smax(a, b, k) {
  const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1);
  return lerp(a, b, h) + k * h * (1 - h);
}

// Zones aplanies (complexes industriels)
const FLAT = [
  { x: GEO.furnaces.x, z: GEO.furnaces.z, r: 420, blend: 160, y: 0 },
  { x: GEO.gaso.x, z: GEO.gaso.z, r: 210, blend: 130, y: 0 },
];

export function rawHeight(x, z) {
  let h = 1.6 * fbm2(x * 0.0021 + 3.1, z * 0.0021 - 7.7, 3);
  h += 3.0 * fbm2(x * 0.0009 + 11.3, z * 0.0009 + 5.2, 2);
  // Plaine des Scories : dunes ondulées
  const P = GEO.plaine;
  const dp = Math.hypot(x - P.x, z - P.z);
  const mp = 1 - smoothstep(480, 1050, dp);
  if (mp > 0) h += mp * (4.5 + 8 * fbm2(x * 0.0052 + 1.7, z * 0.0052 - 4.1, 3));
  // Zones plates
  for (const f of FLAT) {
    const d = Math.hypot(x - f.x, z - f.z);
    const m = 1 - smoothstep(f.r, f.r + f.blend, d);
    if (m > 0) h = lerp(h, f.y, m);
  }
  // Docks : terre-plein à 2,5 m, bassin creusé
  const D = GEO.docks;
  const { u, v } = dockLocal(x, z);
  const lu = Math.abs(u) - (D.len / 2 + 300), lv = Math.abs(v) - (D.wid / 2 + 260);
  const ld = Math.max(lu, lv);
  const ml = 1 - smoothstep(0, 110, ld);
  if (ml > 0) h = lerp(h, D.landY, ml);
  const bu = Math.abs(u) - D.len / 2, bv = Math.abs(v) - D.wid / 2;
  const bd = Math.max(bu, bv);
  if (bd < 6) h = lerp(D.floorY, h, smoothstep(-6, 6, bd));
  // Le Terril (crassier) au centre — point de départ
  const T = GEO.terril;
  const dt = Math.hypot(x - T.x, z - T.z);
  if (dt < T.radius + 60) {
    const s = clamp((dt - T.plateau) / (T.radius - T.plateau), 0, 1);
    let ht = T.top * (1 - s * s * (3 - 2 * s));
    ht += 4 * s * (1 - s) * 6 * fbm2(x * 0.018, z * 0.018, 3);
    h = smax(h, ht, 8);
  }
  // Bordure : crêtes de laitier qui ferment le monde
  const R = Math.hypot(x, z);
  if (R > 2900) {
    const e = R - 2900;
    h += Math.min(170, e * e / 3200) + Math.min(60, e * 0.02 * (8 + 8 * fbm2(x * 0.004, z * 0.004, 2)));
  }
  return h;
}

export class Terrain {
  constructor() {
    const n = Math.round((2 * GEO.half) / GEO.cell) + 1;
    this.n = n;
    this.cell = GEO.cell;
    this.inv = 1 / GEO.cell;
    this.origin = -GEO.half;
    this.h = new Float32Array(n * n);
    for (let j = 0; j < n; j++) {
      const z = this.origin + j * this.cell;
      for (let i = 0; i < n; i++) {
        this.h[j * n + i] = rawHeight(this.origin + i * this.cell, z);
      }
    }
    // Maximum par blocs de 8×8 cellules (élimination rapide des tracés en hauteur)
    this.B = 8;
    this.bn = Math.ceil((n - 1) / this.B);
    this.bmax = new Float32Array(this.bn * this.bn);
    for (let bj = 0; bj < this.bn; bj++) for (let bi = 0; bi < this.bn; bi++) {
      let m = -1e9;
      for (let j = bj * this.B; j <= Math.min(n - 1, (bj + 1) * this.B); j++)
        for (let i = bi * this.B; i <= Math.min(n - 1, (bi + 1) * this.B); i++) m = Math.max(m, this.h[j * n + i]);
      this.bmax[bj * this.bn + bi] = m;
    }
    this._n = { x: 0, y: 1, z: 0 };
  }

  _cell(x, z) {
    const n = this.n;
    let gx = (x - this.origin) * this.inv, gz = (z - this.origin) * this.inv;
    gx = clamp(gx, 0, n - 1.0001); gz = clamp(gz, 0, n - 1.0001);
    const i = Math.floor(gx), j = Math.floor(gz);
    return { i, j, fx: gx - i, fz: gz - j };
  }

  heightAt(x, z) {
    const { i, j, fx, fz } = this._cell(x, z);
    const n = this.n, h = this.h, k = j * n + i;
    const h00 = h[k], h10 = h[k + 1], h01 = h[k + n], h11 = h[k + n + 1];
    if (fx >= fz) return h00 + fx * (h10 - h00) + fz * (h11 - h10);
    return h00 + fz * (h01 - h00) + fx * (h11 - h01);
  }

  /** Normale de la face (physique). Renvoie un objet réutilisé. */
  normalAt(x, z, out = this._n) {
    const { i, j, fx, fz } = this._cell(x, z);
    const n = this.n, h = this.h, k = j * n + i;
    const h00 = h[k], h10 = h[k + 1], h01 = h[k + n], h11 = h[k + n + 1];
    let dx, dz;
    if (fx >= fz) { dx = (h10 - h00) * this.inv; dz = (h11 - h10) * this.inv; }
    else { dz = (h01 - h00) * this.inv; dx = (h11 - h01) * this.inv; }
    const l = Math.hypot(dx, 1, dz);
    out.x = -dx / l; out.y = 1 / l; out.z = -dz / l;
    return out;
  }

  maxIn(minx, minz, maxx, maxz) {
    const c = this.cell * this.B;
    const bi0 = clamp(Math.floor((minx - this.origin) / c), 0, this.bn - 1);
    const bi1 = clamp(Math.floor((maxx - this.origin) / c), 0, this.bn - 1);
    const bj0 = clamp(Math.floor((minz - this.origin) / c), 0, this.bn - 1);
    const bj1 = clamp(Math.floor((maxz - this.origin) / c), 0, this.bn - 1);
    let m = -1e9;
    for (let j = bj0; j <= bj1; j++) for (let i = bi0; i <= bi1; i++) m = Math.max(m, this.bmax[j * this.bn + i]);
    return m;
  }

  /** Dégagement du centre d'une sphère de rayon r au-dessus du sol (négatif = pénétration). */
  clearance(x, y, z, r) {
    const nrm = this.normalAt(x, z);
    return y - (this.heightAt(x, z) + r / Math.max(0.2, nrm.y));
  }

  /** Tracé continu d'une sphère contre le terrain. */
  trace(sx, sy, sz, ex, ey, ez, r, out) {
    const top = this.maxIn(Math.min(sx, ex) - 20, Math.min(sz, ez) - 20, Math.max(sx, ex) + 20, Math.max(sz, ez) + 20);
    if (Math.min(sy, ey) - r * 3 > top) return false;
    const dx = ex - sx, dy = ey - sy, dz = ez - sz;
    const g0 = this.clearance(sx, sy, sz, r);
    if (g0 < 0) {
      const nrm = this.normalAt(sx, sz);
      if (dx * nrm.x + dy * nrm.y + dz * nrm.z < 0) {
        out.fraction = 0; out.nx = nrm.x; out.ny = nrm.y; out.nz = nrm.z; out.mat = 'gravel'; out.brush = null;
        return true;
      }
      return false;
    }
    const len = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(len / 2.5));
    let prev = 0;
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      const g = this.clearance(sx + dx * t, sy + dy * t, sz + dz * t, r);
      if (g < 0) {
        let lo = prev, hi = t;
        for (let it = 0; it < 12; it++) {
          const m = (lo + hi) * 0.5;
          if (this.clearance(sx + dx * m, sy + dy * m, sz + dz * m, r) < 0) hi = m; else lo = m;
        }
        if (lo < out.fraction) {
          const nrm = this.normalAt(sx + dx * hi, sz + dz * hi);
          out.fraction = lo; out.nx = nrm.x; out.ny = nrm.y; out.nz = nrm.z; out.mat = 'gravel'; out.brush = null;
          return true;
        }
        return false;
      }
      prev = t;
    }
    return false;
  }
}
