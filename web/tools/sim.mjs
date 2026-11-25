// Simulateur hors navigateur : règle les gains de strafe / surf.
import { Collision } from '../src/core/collision.js';
import { Player } from '../src/core/player.js';
import { PHYS, TICK } from '../src/core/config.js';
import { boxPlanes, boxVerts, prismPlanes } from '../src/core/shapes.js';
import { Bot } from '../src/test/bot.js';

const args = Object.fromEntries(process.argv.slice(2).map(a => a.split('=')));
if (args.cap) PHYS.airWishCap = +args.cap;
if (args.accel) PHYS.airAccel = +args.accel;
const turn = +(args.turn || 360);

function flatWorld() {
  const col = new Collision(null);
  col.add(boxPlanes([0, -5, 0], [20000, 5, 20000]), boxVerts([0, -5, 0], [20000, 5, 20000]), 'concrete');
  return col;
}

function runBhop(seconds) {
  const col = flatWorld();
  const pl = new Player(col);
  pl.spawn(0, 0.71, 0, 0);
  const bot = new Bot({ route: [{ x: 0, z: -1e7 }], maxTurnDeg: turn });
  const out = [];
  for (let t = 0; t < seconds * 120; t++) {
    pl.tick(bot.input(pl), TICK);
    if (t % 120 === 0) out.push(`${(t / 120).toFixed(0)}s:${pl.hspeed.toFixed(1)}`);
  }
  console.log(`BHOP cap=${PHYS.airWishCap} accel=${PHYS.airAccel} turn≤${turn}°/s maxYawRate=${(bot.maxYawRate * 180 / Math.PI).toFixed(0)}°/s`);
  console.log(out.join('  '));
  console.log('rebonds', pl.stats.bhops, 'chaîne max', pl.stats.maxChain);
  return pl;
}

function runSurf() {
  const col = flatWorld();
  // rampe descendante : faîte de (0,120,0) vers (0,40,-1200), section triangulaire 14 m de haut, faces 58°
  const H = 14, w = H / Math.tan(58 * Math.PI / 180);
  const seg = 60;
  for (let i = 0; i < 20; i++) {
    const z0 = -i * seg, z1 = -(i + 1) * seg;
    const y0 = 120 - i * 4, y1 = 120 - (i + 1) * 4;
    const A = [[0, y0, z0], [w, y0 - H, z0], [-w, y0 - H, z0]];
    const B = [[0, y1, z1], [w, y1 - H, z1], [-w, y1 - H, z1]];
    const { planes, verts } = prismPlanes(A, B, i > 0, i < 19);
    col.add(planes, verts, 'metal');
  }
  const pl = new Player(col);
  pl.spawn(5, 125, -5, 0);
  const bot = new Bot({ route: [{ x: 4, z: -1300 }], maxTurnDeg: turn });
  let surfT = 0, minVz = 0, stuck = 0;
  for (let t = 0; t < 30 * 120; t++) {
    const inp = bot.input(pl);
    pl.tick(inp, TICK);
    if (pl.surfing) surfT += TICK;
    if (t % 120 === 0) process.stdout.write(`${(t / 120).toFixed(0)}s z=${pl.pos.z.toFixed(0)} y=${pl.pos.y.toFixed(0)} v=${pl.speed.toFixed(1)} ${pl.surfing ? 'S' : '-'} | `);
    if (pl.pos.z < -1180) break;
  }
  console.log(`\nSURF fin: z=${pl.pos.z.toFixed(0)} y=${pl.pos.y.toFixed(1)} vitesse=${pl.speed.toFixed(1)} m/s, temps en surf=${surfT.toFixed(1)} s, chocs=${pl.stats.wallHits}`);
}

function runBrake() {
  const col = flatWorld();
  const pl = new Player(col);
  pl.spawn(0, 0.71, 0, 0);
  pl.vel.z = -120; pl.vel.y = 0;
  let t = 0;
  // en l'air : on démarre haut
  pl.pos.y = 300;
  while (pl.hspeed > 5 && t < 30 * 120) { pl.tick({ brake: true, yaw: 0, pitch: 0 }, TICK); t++; }
  console.log(`FREIN en l'air 120→5 m/s : ${(t / 120).toFixed(2)} s`);
  pl.spawn(0, 0.71, 0, 0); pl.vel.z = -120; t = 0;
  for (let k = 0; k < 4; k++) pl.tick({ yaw: 0, pitch: 0 }, TICK);
  while (pl.hspeed > 0.1 && t < 30 * 120) { pl.tick({ brake: true, yaw: 0, pitch: 0 }, TICK); t++; }
  console.log(`FREIN au sol 120→0 m/s : ${(t / 120).toFixed(2)} s`);
}

const which = args.mode || 'all';
if (which === 'all' || which === 'bhop') runBhop(+(args.t || 40));
if (which === 'all' || which === 'surf') runSurf();
if (which === 'all' || which === 'brake') runBrake();
