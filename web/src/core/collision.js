// Collisions continues : sphère contre volumes convexes (plans), façon Quake 3,
// avec décalage uniforme des plans par le rayon (somme de Minkowski approchée).
// Les plans « internes » (jointures entre segments d'une même rampe) ne bloquent
// jamais : cela supprime le « ramp bug » des jeux de surf.

const EPS = 0.004;

export class Collision {
  constructor(terrain) {
    this.terrain = terrain;
    this.brushes = [];
    this.cs = 32;
    this.grid = new Map();
    this.stamp = 1;
    this.margin = 1.5; // rayon max supporté + marge
    this.stats = { traces: 0 };
  }

  _key(ix, iz) { return (ix + 4096) * 8192 + (iz + 4096); }

  /**
   * planes : [[nx,ny,nz,d,internal?], ...] (normale sortante, n·x = d sur la face)
   * verts  : sommets du volume (pour la boîte englobante)
   */
  add(planes, verts, mat = 'concrete') {
    const n = planes.length;
    const p = new Float64Array(n * 4);
    const internal = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const q = planes[i];
      p[i * 4] = q[0]; p[i * 4 + 1] = q[1]; p[i * 4 + 2] = q[2]; p[i * 4 + 3] = q[3];
      internal[i] = q[4] ? 1 : 0;
    }
    let minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
    for (const v of verts) {
      if (v[0] < minx) minx = v[0]; if (v[0] > maxx) maxx = v[0];
      if (v[1] < miny) miny = v[1]; if (v[1] > maxy) maxy = v[1];
      if (v[2] < minz) minz = v[2]; if (v[2] > maxz) maxz = v[2];
    }
    const b = { id: this.brushes.length, n, p, internal, minx, miny, minz, maxx, maxy, maxz, mat, stamp: 0 };
    this.brushes.push(b);
    const m = this.margin, cs = this.cs;
    const i0 = Math.floor((minx - m) / cs), i1 = Math.floor((maxx + m) / cs);
    const j0 = Math.floor((minz - m) / cs), j1 = Math.floor((maxz + m) / cs);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = this._key(i, j);
      let l = this.grid.get(k);
      if (!l) { l = []; this.grid.set(k, l); }
      l.push(b);
    }
    return b;
  }

  _forBrushes(minx, minz, maxx, maxz, fn) {
    const stamp = ++this.stamp, cs = this.cs;
    const i0 = Math.floor(minx / cs), i1 = Math.floor(maxx / cs);
    const j0 = Math.floor(minz / cs), j1 = Math.floor(maxz / cs);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const l = this.grid.get(this._key(i, j));
      if (!l) continue;
      for (let k = 0; k < l.length; k++) {
        const b = l[k];
        if (b.stamp === stamp) continue;
        b.stamp = stamp;
        if (fn(b) === false) return;
      }
    }
  }

  /** Tracé d'une sphère de rayon r de S vers E. Remplit out (fraction, normale, matière). */
  trace(sx, sy, sz, ex, ey, ez, r, out) {
    this.stats.traces++;
    out.fraction = 1; out.nx = 0; out.ny = 0; out.nz = 0; out.mat = null; out.brush = null; out.startsolid = false;
    const minx = Math.min(sx, ex) - r - 0.05, maxx = Math.max(sx, ex) + r + 0.05;
    const miny = Math.min(sy, ey) - r - 0.05, maxy = Math.max(sy, ey) + r + 0.05;
    const minz = Math.min(sz, ez) - r - 0.05, maxz = Math.max(sz, ez) + r + 0.05;
    const dx = ex - sx, dy = ey - sy, dz = ez - sz;
    this._forBrushes(minx, minz, maxx, maxz, (b) => {
      if (b.maxx < minx - r || b.minx > maxx + r || b.maxy < miny - r || b.miny > maxy + r || b.maxz < minz - r || b.minz > maxz + r) return;
      this._clip(b, sx, sy, sz, ex, ey, ez, dx, dy, dz, r, out);
    });
    if (this.terrain) this.terrain.trace(sx, sy, sz, ex, ey, ez, r, out);
    out.ex = sx + dx * out.fraction; out.ey = sy + dy * out.fraction; out.ez = sz + dz * out.fraction;
    return out;
  }

  _clip(b, sx, sy, sz, ex, ey, ez, dx, dy, dz, r, out) {
    const p = b.p, n = b.n, internal = b.internal;
    let enter = -1, leave = 1, startout = false, clip = -1;
    for (let i = 0; i < n; i++) {
      const nx = p[i * 4], ny = p[i * 4 + 1], nz = p[i * 4 + 2], d = p[i * 4 + 3] + r;
      const d1 = sx * nx + sy * ny + sz * nz - d;
      const d2 = ex * nx + ey * ny + ez * nz - d;
      if (d1 > 0) startout = true;
      if (d1 > 0 && (d2 >= EPS || d2 >= d1)) return;
      if (d1 <= 0 && d2 <= 0) continue;
      if (d1 > d2) {
        let f = (d1 - EPS) / (d1 - d2);
        if (f < 0) f = 0;
        if (f > enter) { enter = f; clip = i; }
      } else {
        let f = (d1 + EPS) / (d1 - d2);
        if (f > 1) f = 1;
        if (f < leave) leave = f;
      }
    }
    if (!startout) {
      // Départ à l'intérieur (pénétration numérique) : on traite le plan le plus proche comme contact.
      let best = -1, bd = -Infinity;
      for (let i = 0; i < n; i++) {
        if (internal[i]) continue;
        const d1 = sx * p[i * 4] + sy * p[i * 4 + 1] + sz * p[i * 4 + 2] - (p[i * 4 + 3] + r);
        if (d1 > bd) { bd = d1; best = i; }
      }
      if (best < 0) return;
      const nx = p[best * 4], ny = p[best * 4 + 1], nz = p[best * 4 + 2];
      if (dx * nx + dy * ny + dz * nz < 0 && out.fraction > 0) {
        out.fraction = 0; out.nx = nx; out.ny = ny; out.nz = nz; out.mat = b.mat; out.brush = b; out.startsolid = true;
      }
      return;
    }
    if (enter < leave && enter > -1 && enter < out.fraction && clip >= 0) {
      if (internal[clip]) return; // jointure de rampe : jamais bloquante
      out.fraction = enter < 0 ? 0 : enter;
      out.nx = p[clip * 4]; out.ny = p[clip * 4 + 1]; out.nz = p[clip * 4 + 2];
      out.mat = b.mat; out.brush = b;
    }
  }

  /** Repousse une position hors des volumes et du terrain. Renvoie la profondeur corrigée. */
  depenetrate(pos, r) {
    let total = 0;
    for (let pass = 0; pass < 4; pass++) {
      let moved = false;
      this._forBrushes(pos.x - r - 0.1, pos.z - r - 0.1, pos.x + r + 0.1, pos.z + r + 0.1, (b) => {
        if (pos.x < b.minx - r - 0.1 || pos.x > b.maxx + r + 0.1 || pos.y < b.miny - r - 0.1 || pos.y > b.maxy + r + 0.1 || pos.z < b.minz - r - 0.1 || pos.z > b.maxz + r + 0.1) return;
        const p = b.p;
        let best = -1, bd = -Infinity;
        for (let i = 0; i < b.n; i++) {
          const d = pos.x * p[i * 4] + pos.y * p[i * 4 + 1] + pos.z * p[i * 4 + 2] - (p[i * 4 + 3] + r);
          if (d >= 0) return; // dehors
          if (!b.internal[i] && d > bd) { bd = d; best = i; }
        }
        if (best < 0) return;
        const push = -bd + EPS * 0.5;
        pos.x += p[best * 4] * push; pos.y += p[best * 4 + 1] * push; pos.z += p[best * 4 + 2] * push;
        total += push; moved = true;
        return false;
      });
      if (!moved) break;
    }
    if (this.terrain) {
      const g = this.terrain.clearance(pos.x, pos.y, pos.z, r);
      if (g < 0) { pos.y -= g - EPS * 0.25; total += -g; }
    }
    return total;
  }

  /** Vrai si le centre est à l'intérieur d'un volume de plus de `tol` (tests anti-traversée). */
  penetration(pos, r) {
    let worst = 0;
    this._forBrushes(pos.x - r, pos.z - r, pos.x + r, pos.z + r, (b) => {
      const p = b.p;
      let best = -Infinity;
      for (let i = 0; i < b.n; i++) {
        const d = pos.x * p[i * 4] + pos.y * p[i * 4 + 1] + pos.z * p[i * 4 + 2] - (p[i * 4 + 3] + r);
        if (d >= 0) return;
        if (!b.internal[i] && d > best) best = d;
      }
      if (-best > worst) worst = -best;
    });
    if (this.terrain) {
      const g = this.terrain.clearance(pos.x, pos.y, pos.z, r);
      if (-g > worst) worst = -g;
    }
    return worst;
  }
}
