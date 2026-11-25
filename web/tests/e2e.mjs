// Tests de bout en bout dans un vrai navigateur (Chromium, Playwright).
// Le pilote automatique n'utilise que les commandes d'un joueur : touches + rotation bornée de la vue.
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || '/opt/node-tools/node_modules/playwright/index.js');
const SHOT = process.env.SHOT || 'tests/shots';
mkdirSync(SHOT, { recursive: true });
const FILE = process.env.FILE || 'file://' + new URL('../dist/velocity-fps.html', import.meta.url).pathname;
const R = { started: new Date().toISOString(), file: FILE, checks: [] };
const check = (name, ok, detail) => { R.checks.push({ name, ok, detail }); console.log(`${ok ? 'OK  ' : 'ÉCHEC'} ${name} — ${JSON.stringify(detail)}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.addInitScript(() => { window.__VELOCITY_TEST = { quality: 'low', dtCap: 0.25, maxTicks: 30, settings: { showHelp: true } }; });
const t0 = Date.now();
await page.goto(FILE);
await page.waitForFunction(() => !document.getElementById('play').disabled, null, { timeout: 180000 });
R.loadMs = Date.now() - t0;
const st = () => page.evaluate(() => window.__velocity.state());
const V = (fn, arg) => page.evaluate(fn, arg);
// attend un temps de JEU (le rendu logiciel de ce conteneur peut tourner plus lentement que le temps réel)
const waitGame = async (sec, limitMs = 120000) => { const t0 = (await st()).stats.ticks, r0 = Date.now(); while (Date.now() - r0 < limitMs) { await sleep(200); if ((await st()).stats.ticks - t0 >= sec * 120) return true; } return false; };

// ---------- 1. lancement par un vrai clic ----------
await page.click('#play');
await sleep(1500);
let s = await st();
check('Partie lancée par clic sur « Jouer »', s.state === 'playing', { state: s.state, pointerLock: s.locked, repliSourisLibre: s.dragLook, gpu: s.gpu, chargementMs: R.loadMs });
await page.screenshot({ path: `${SHOT}/01-depart.png` });

// ---------- 2. rebonds avec les vraies touches (Z/W + Espace maintenus) ----------
await V(() => { const v = window.__velocity; v.teleport(-70, 104.75, -76, Math.PI / 4 + 0.05); });
await sleep(800);
const before = (await st()).stats;
await page.keyboard.down('KeyW');
await waitGame(0.9);
await page.keyboard.down('Space');
await waitGame(6);
await page.keyboard.up('Space');
await page.keyboard.up('KeyW');
await waitGame(0.6);
s = await st();
await page.screenshot({ path: `${SHOT}/02-rebonds-viaduc.png` });
check('Au moins 5 rebonds enchaînés (touches réelles W/Z + Espace maintenus, 6 s de jeu)', s.stats.maxChain >= 5, { rebonds: s.stats.bhops - before.bhops, chaineMax: s.stats.maxChain, sauts: s.stats.jumps - before.jumps, secteur: s.sector });

// ---------- 3. ligne rapide : Belvédère → Grand Viaduc → Darse → Boucle ----------
await V(() => { const v = window.__velocity; const sp = v.G.info.spawn; v.teleport(sp.x, sp.y, sp.z, Math.PI / 4); });
await sleep(500);
await V(() => {
  const v = window.__velocity, r = v.routes();
  const D = r.plazas.find((p) => p.id === 'D');
  let iD = 0, bd = 1e18;
  r.ring.forEach((p, i) => { const d = (p.x - D.x) ** 2 + (p.z - D.z) ** 2; if (d < bd) { bd = d; iD = i; } });
  // sens D → Ouest → Gazomètre : profil en U sur tout le trajet
  const ring = []; for (let k = 3; k < r.ring.length; k++) ring.push(r.ring[(iD - k + 2 * r.ring.length) % r.ring.length]);
  window.__ringFwd = ring; window.__iD = iD;
  v.bot({ route: [{ x: -26, z: -26 }, ...r.viaduc.slice(2), { x: D.x, z: D.z }, ...ring], maxTurnDeg: 300, reach: 28 });
});
const runLog = [];
let tRun = 0, inspected = null, shot100 = false, t100 = null, fastTicks = 0;
const runStart = Date.now();
const ticks0 = (await st()).stats.ticks;
while (Date.now() - runStart < 420000) {
  await sleep(1000);
  s = await st();
  tRun = (s.stats.ticks - ticks0) / 120;
  if (s.hspeed > 100 && t100 === null) t100 = +tRun.toFixed(1);
  runLog.push({ t: +tRun.toFixed(1), v: +s.hspeed.toFixed(1), sector: s.sector, y: +s.pos.y.toFixed(1), ground: s.onGround, surf: s.surfing });
  if (s.hspeed > 100 && !shot100) { shot100 = true; await page.screenshot({ path: `${SHOT}/03-plus-de-100ms.png` }); }
  // inspection en plein vol avec la vraie touche F
  if (!inspected && s.hspeed > 80 && !s.onGround) {
    const pre = await st();
    await page.keyboard.press('KeyF');
    await waitGame(0.8);
    const mid = await st();
    await page.screenshot({ path: `${SHOT}/04-inspection-en-vol.png` });
    await waitGame(1.0);
    const mid2 = await st();
    await page.screenshot({ path: `${SHOT}/04b-inspection-face-b.png` });
    await waitGame(2.0);
    const post = await st();
    inspected = { vitesseAvant: +pre.hspeed.toFixed(1), vitessePendant: +mid2.hspeed.toFixed(1), vitesseApres: +post.hspeed.toFixed(1), poidsPendant: +mid.inspect.weight.toFixed(2), actifPendant: mid.inspect.active, tempsInspect: +mid2.inspect.t.toFixed(2), distanceParcourue: +Math.hypot(post.pos.x - pre.pos.x, post.pos.z - pre.pos.z).toFixed(0), finie: !post.inspect.active, enLair: !mid.onGround };
  }
  const log = await V(() => window.__velocity.sectorLog());
  const fast = new Set(log.filter((x) => x.max > 100).map((x) => x.name));
  if (s.hspeed > 100) fastTicks++;
  if (fast.size >= 4 && inspected) break;
}
const slog = await V(() => window.__velocity.sectorLog());
const fastSectors = [...new Set(slog.filter((x) => x.max > 100).map((x) => x.name))];
s = await st();
R.run = { secondes: +tRun.toFixed(0), log: runLog, secteurs: slog.map((x) => ({ nom: x.name, entree: +x.enter.toFixed(0), max: +x.max.toFixed(0) })) };
check('Plusieurs secteurs franchis à plus de 100 m/s', fastSectors.length >= 3, { secteurs: fastSectors, premiers100ms_apres_s: t100, vitesseMax: +s.stats.topSpeed.toFixed(1), distanceKm: +(s.stats.distance / 1000).toFixed(2), dureeJeu_s: +tRun.toFixed(0), rotationVueMax_degParS: await V(() => Math.round(window.__velocity.G.bot.maxYawRate * 180 / Math.PI)) });
check('Inspection du couteau en plein vol sans bloquer le mouvement', !!inspected && inspected.actifPendant && inspected.poidsPendant > 0.5 && inspected.vitessePendant > 0.85 * inspected.vitesseAvant && inspected.finie, inspected);

// ---------- 4. frein volontaire (vraie touche Ctrl) ----------
const vBrake0 = (await st()).hspeed;
await page.keyboard.down('ControlLeft');
await V(() => window.__velocity.botSet({ brake: true }));
const tb0 = Date.now();
let tStop = null; const ticksB = (await st()).stats.ticks;
while (Date.now() - tb0 < 30000) {
  await sleep(250);
  s = await st();
  if (s.hspeed < 5) { tStop = (s.stats.ticks - ticksB) / 120; break; }
}
await page.keyboard.up('ControlLeft');
check('Frein (Ctrl) : arrêt depuis la vitesse de pointe', tStop !== null, { vitesseDepart: +vBrake0.toFixed(1), tempsJeu_s: tStop && +tStop.toFixed(2), vitesseFinale: +s.hspeed.toFixed(2), secteur: s.sector });

// ---------- 5. demi-tour et retour sur ses pas ----------
const secBefore = s.sector;
const yawBefore = s.yaw;
await V(() => {
  const v = window.__velocity, r = v.routes(), p = v.G.player.pos;
  const ring = r.ring;
  let iP = 0, bd = 1e18;
  ring.forEach((q, i) => { const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2; if (d < bd) { bd = d; iP = i; } });
  // retour : on repart dans l'autre sens (indices croissants) jusqu'à la Darse
  const back = [];
  for (let i = iP + 2; ; i++) { const k = i % ring.length; back.push(ring[k]); if (k === window.__iD) break; if (back.length > ring.length) break; }
  const D = r.plazas.find((q) => q.id === 'D');
  const via = r.viaduc.slice().reverse();
  v.botSet({ route: [...back, { x: D.x, z: D.z }, ...via], wp: 0, brake: false, cruise: 110 });
});
const tt0 = Date.now(); let turned = null; const tk0 = (await st()).stats.ticks; R.turn = [];
const tTurn = await V(() => window.__velocity.G.time);
while (Date.now() - tt0 < 900000) {
  await sleep(1500);
  s = await st();
  R.turn.push({ t: +((s.stats.ticks - tk0) / 120).toFixed(1), v: +s.hspeed.toFixed(1), sector: s.sector, x: Math.round(s.pos.x), z: Math.round(s.pos.z) });
  if ((s.stats.ticks - tk0) / 120 > 180) break;
  if (turned === null) { const d = Math.abs(((s.yaw - yawBefore + Math.PI * 3) % (Math.PI * 2)) - Math.PI); if (d > 2.6) turned = +((s.stats.ticks - tk0) / 120).toFixed(1); }
  const log = await V(() => window.__velocity.sectorLog());
  const since = log.filter((x) => x.t0 > tTurn).map((x) => x.name);
  if (since.includes('Grand Viaduc') && turned !== null) break;
}
const visitedBefore = new Set(slog.map((x) => x.name));
const slog2 = await V(() => window.__velocity.sectorLog());
const after = slog2.filter((x) => x.t1 > tTurn).map((x) => x.name);
await page.screenshot({ path: `${SHOT}/05-retour-viaduc.png` });
const recognized = [...new Set(after)].filter((n) => visitedBefore.has(n) && n !== secBefore);
check('Demi-tour puis retour sur ses pas dans des lieux déjà traversés', turned !== null && recognized.length >= 2, { secteurAvant: secBefore, demiTourApres_s: turned, secteursTraverses: [...new Set(after)], reconnus: recognized });
await V(() => window.__velocity.bot(null));

// ---------- 6. collisions à pleine vitesse ----------
const crash = await V(async () => {
  window.__velocity.G.pen.max = 0;
  const v = window.__velocity, G = v.G, out = [];
  const run = (x, y, z, yaw, vx, vy, vz, secs, measure) => new Promise((res) => {
    v.teleport(x, y, z, yaw); v.setVel(vx, vy, vz);
    const pen0 = G.pen.max; G.pen.max = 0; const hits0 = G.player.stats.wallHits;
    const t0 = G.player.stats.ticks;
    const iv = setInterval(() => {
      if ((G.player.stats.ticks - t0) / 120 >= secs) { clearInterval(iv); res({ ...measure(), penetrationMax_m: +G.pen.max.toFixed(4), chocs: G.player.stats.wallHits - hits0 }); }
    }, 50);
  });
  const g = { x: -1330, z: 1330 };
  out.push({ test: 'Gazomètre (cuve r=56 m) à 300 m/s', ...(await run(g.x + 150, 20, g.z, Math.PI / 2, -300, 0, 0, 1.2, () => ({ distanceAuCentre_m: +Math.hypot(G.player.pos.x - g.x, G.player.pos.z - g.z).toFixed(1), dehors: Math.hypot(G.player.pos.x - g.x, G.player.pos.z - g.z) > 56 }))) });
  // fourneau central : on arrive par le côté (axe tangentiel), à 6 m du sol
  const S = Math.SQRT1_2, F = { x: 1560 + 60 * S, z: -1560 - 60 * S };
  const vF = (p) => (p.x - F.x) * S + (p.z - F.z) * S; // coordonnée le long de l'axe tangentiel (SE)
  out.push({ test: 'Base de haut-fourneau (r=18 m) à 400 m/s', ...(await run(F.x + 70 * S, 6, F.z + 70 * S, Math.atan2(S, S), -400 * S, 0, -400 * S, 1.0, () => ({ distanceAuCentre_m: +Math.hypot(G.player.pos.x - F.x, G.player.pos.z - F.z).toFixed(1), dehors: Math.hypot(G.player.pos.x - F.x, G.player.pos.z - F.z) > 17.6 && vF(G.player.pos) > 0 }))) });
  out.push({ test: 'Chute verticale à 350 m/s sur le terrain', ...(await run(600, 700, 420, 0, 30, -350, 0, 2.5, () => ({ hauteurAuDessusDuSol_m: +(G.player.pos.y - G.terrain.heightAt(G.player.pos.x, G.player.pos.z)).toFixed(2), auDessus: G.player.pos.y > G.terrain.heightAt(G.player.pos.x, G.player.pos.z) }))) });
  const D = v.routes().plazas.find((p) => p.id === 'D');
  out.push({ test: 'Berge de la Boucle frôlée à 400 m/s', ...(await run(D.x + D.tx * 120, D.y + 1.2, D.z + D.tz * 120, Math.atan2(-D.tx, -D.tz), D.tx * 380 + D.sx * 90, 0, D.tz * 380 + D.sz * 90, 1.0, () => ({ altitude: +G.player.pos.y.toFixed(1) }))) });
  return out;
});
for (const c of crash) check(`Collision : ${c.test}`, c.penetrationMax_m < 0.05 && (c.dehors !== false) && (c.auDessus !== false), c);

// ---------- 7. pause et reprise ----------
await V(() => { const v = window.__velocity; v.teleport(-70, 104.75, -76, Math.PI / 4); });
await page.keyboard.down('KeyW');
await waitGame(1.2);
await page.keyboard.press('Escape');
await page.keyboard.up('KeyW');
await sleep(600);
const p1 = await st(); await sleep(2000); const p2 = await st();
await page.screenshot({ path: `${SHOT}/06-pause.png` });
const frozen = p1.state === 'paused' && Math.hypot(p2.pos.x - p1.pos.x, p2.pos.z - p1.pos.z) < 0.001;
await page.click('#resume');
await sleep(800);
await page.keyboard.down('KeyW');
await waitGame(1.5);
await page.keyboard.up('KeyW');
const p3 = await st();
check('Pause (Échap) fige la partie, « Reprendre » la relance', frozen && p3.state === 'playing' && Math.hypot(p3.pos.x - p2.pos.x, p3.pos.z - p2.pos.z) > 1, { etatApresEchap: p1.state, deplacementPendantPause_m: +Math.hypot(p2.pos.x - p1.pos.x, p2.pos.z - p1.pos.z).toFixed(4), etatApresReprise: p3.state, deplacementApresReprise_m: +Math.hypot(p3.pos.x - p2.pos.x, p3.pos.z - p2.pos.z).toFixed(1) });

// ---------- 8. surf sur Les Coulées (pilote automatique) ----------
await V(() => {
  const v = window.__velocity, r = v.routes(); const sp = v.G.info.spawn;
  v.teleport(sp.x, sp.y, sp.z, -Math.PI / 4);
  const pts = r.couleesFace.flat();
  v.bot({ route: [{ x: 17, z: -17 }, ...pts.slice(1), { x: 1440, z: -1480 }, { x: 1443, z: -1500 }], maxTurnDeg: 300, reach: 24, yaw: -Math.PI / 4 });
});
const cs = Date.now(); let surfMax = 0, surfT = 0, reached = false, cTop = 0;
while (Date.now() - cs < 200000) {
  await sleep(1000);
  s = await st();
  if (s.surfing) surfT++;
  surfMax = Math.max(surfMax, s.hspeed);
  if (s.sector === 'Hauts-Fourneaux') { reached = true; cTop = s.stats.topSpeed; break; }
  if (s.surfing && surfT === 3) await page.screenshot({ path: `${SHOT}/07-surf-coulees.png` });
}
await V(() => window.__velocity.bot(null));
check('Surf des Coulées jusqu’aux Hauts-Fourneaux (pilote auto)', reached, { arrive: reached, vitesseMax: +surfMax.toFixed(1), secondesAvecContactSurf: surfT, secteur: s.sector, chute: s.pos.y < 3 && !reached });

// ---------- 9. décor chargé à temps, pénétrations, erreurs ----------
s = await st();
check('Décor chargé à temps (zone du joueur toujours prête)', s.stream.misses === 0, s.stream);
check('Aucune traversée de géométrie détectée pendant toute la session', s.pen.over5cm === 0, s.pen);
check('Aucune erreur JavaScript', errors.length === 0, errors.slice(0, 5));
R.frame = await V(() => window.__velocity.frameStats());
R.final = s;
R.ok = R.checks.every((c) => c.ok);
writeFileSync('tests/results.json', JSON.stringify(R, null, 2));
console.log(`\n${R.checks.filter((c) => c.ok).length}/${R.checks.length} vérifications réussies. Images : ${JSON.stringify(R.frame)}`);
await browser.close();
