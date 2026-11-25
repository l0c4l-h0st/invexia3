// Repères géographiques partagés par le terrain, la physique et la construction du monde.
// Axes : x = est, z = sud, y = haut. Le Belvédère (départ) est à l'origine.

const S2 = Math.SQRT1_2;

export const GEO = {
  half: 4608,          // demi-côté de la grille de terrain (m)
  cell: 16,            // pas de la grille (m)
  boundary: 3550,      // rayon de la limite jouable
  terril: { x: 0, z: 0, top: 92, plateau: 52, radius: 345 },
  furnaces: { x: 1560, z: -1560 },
  gaso: { x: -1330, z: 1330 },
  plaine: { x: 1150, z: 1100 },
  docks: {
    // bassin rectangulaire au nord-ouest, grand axe parallèle à la Boucle (NE↔SO)
    cx: -1560, cz: -1560,
    ax: S2, az: -S2,        // grand axe (unitaire)
    bx: -S2, bz: -S2,       // axe transversal (vers l'extérieur de la carte)
    len: 720, wid: 230,
    landY: 2.5, floorY: -1.4,
  },
  waterY: 0,
};

/** Coordonnées locales (u le long du bassin, v en travers) */
export function dockLocal(x, z) {
  const d = GEO.docks;
  const dx = x - d.cx, dz = z - d.cz;
  return { u: dx * d.ax + dz * d.az, v: dx * d.bx + dz * d.bz };
}
export function dockWorld(u, v) {
  const d = GEO.docks;
  return { x: d.cx + u * d.ax + v * d.bx, z: d.cz + u * d.az + v * d.bz };
}
export function inBasin(x, z, margin = 0) {
  const d = GEO.docks;
  const { u, v } = dockLocal(x, z);
  return Math.abs(u) < d.len / 2 + margin && Math.abs(v) < d.wid / 2 + margin;
}
