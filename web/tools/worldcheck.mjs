// Construit le monde hors navigateur et vérifie quelques invariants.
import { Terrain } from '../src/core/terrain.js';
import { Collision } from '../src/core/collision.js';
import { WorldBuilder } from '../src/world/builder.js';
import { buildWorld } from '../src/world/layout.js';
import { Sectors } from '../src/world/sectors.js';
import { Bucket } from '../src/world/builder.js';

let t0 = performance.now();
const terrain = new Terrain();
const t1 = performance.now();
const col = new Collision(terrain);
const B = new WorldBuilder(col, terrain);
const info = buildWorld(B);
const t2 = performance.now();
console.log(`terrain ${(t1 - t0).toFixed(0)} ms, monde ${(t2 - t1).toFixed(0)} ms, volumes=${B.brushCount}, chunks=${B.chunks.size}, conteneurs=${B.instances.length}, fx=${B.fx.length}, panneaux=${B.signs.length}`);

// génération de toute la géométrie (temps + triangles)
let tris = 0, maxChunkMs = 0, maxTris = 0;
const gen = (c) => {
  const s = performance.now();
  const buckets = new Map();
  const emit = (m) => { let b = buckets.get(m); if (!b) { b = new Bucket(); buckets.set(m, b); } return b; };
  for (const j of c.jobs) j(emit);
  let n = 0; for (const b of buckets.values()) n += b.count / 3;
  const ms = performance.now() - s;
  maxChunkMs = Math.max(maxChunkMs, ms); maxTris = Math.max(maxTris, n);
  tris += n;
  return { n, ms };
};
const a = gen(B.always);
console.log(`chunk permanent : ${a.n} triangles en ${a.ms.toFixed(0)} ms`);
for (const c of B.chunks.values()) gen(c);
console.log(`total ${tris} triangles ; chunk max ${maxTris} tri, ${maxChunkMs.toFixed(1)} ms`);

// spawn : au-dessus du sol, pas dans un volume
const sp = info.spawn;
console.log('spawn pénétration', col.penetration({ x: sp.x, y: sp.y, z: sp.z }, 0.7).toFixed(3));
const sec = new Sectors(info.sectors);
for (const [n, p] of Object.entries({ spawn: [0, 105, 6], via: [-600, 86, -630], ringN: [0, 60, -1950], furn: [1560, 5, -1560], docks: [-1560, 3, -1300], gaso: [-1330, 5, 1330], plaine: [1150, 10, 1100], east: [2300, 5, 300], edge: [3000, 100, 0] })) {
  console.log(n.padEnd(8), sec.at(...p).name);
}
for (const P of info.plazas) console.log('plaza', P.id, P.x.toFixed(0), P.z.toFixed(0), 'y', P.y, 'R', P.R.toFixed(0));
console.log('routes', Object.fromEntries(Object.entries(info.routes).map(([k, v]) => [k, Array.isArray(v[0]) ? v.map(x => x.length) : v.length])));
