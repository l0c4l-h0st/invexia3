// Détermine le secteur nommé (HUD) à partir de la position.
export class Sectors {
  constructor(list) {
    this.list = list.map((s) => {
      if (!s.path) return s;
      const pts = [];
      let acc = 1e9;
      for (let i = 0; i < s.path.length; i++) {
        const p = s.path[i];
        if (i > 0) acc += Math.hypot(p.x - s.path[i - 1].x, p.z - s.path[i - 1].z);
        if (acc >= 10) { pts.push(p); acc = 0; }
      }
      let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
      for (const p of pts) { minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x); minz = Math.min(minz, p.z); maxz = Math.max(maxz, p.z); }
      return { ...s, pts, minx: minx - s.r, maxx: maxx + s.r, minz: minz - s.r, maxz: maxz + s.r };
    });
  }

  at(x, y, z) {
    for (const s of this.list) {
      if (s.pts) {
        if (x < s.minx || x > s.maxx || z < s.minz || z > s.maxz) continue;
        let best = Infinity, by = 0;
        for (const p of s.pts) {
          const d = (p.x - x) ** 2 + (p.z - z) ** 2;
          if (d < best) { best = d; by = p.y; }
        }
        if (best < s.r * s.r && (s.yRel === undefined || y > by + s.yRel) && (s.yAbove === undefined || y < by + s.yAbove)) return s;
        continue;
      }
      if (s.test(x, y, z)) {
        if (s.dynamic) {
          const a = Math.atan2(z, x) * 180 / Math.PI;
          const dir = a > -135 && a <= -45 ? 'du Nord' : a > -45 && a <= 45 ? "de l'Est" : a > 45 && a <= 135 ? 'du Sud' : "de l'Ouest";
          return { name: `Friches ${dir}`, sub: 'Terrain ouvert' };
        }
        return s;
      }
    }
    return { name: 'Friche', sub: '' };
  }
}
