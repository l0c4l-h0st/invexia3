// Vérifie sprint, glissade (C au sol), plongeon (C en l'air) et secousses à zéro avec de vraies touches.
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || '/opt/node-tools/node_modules/playwright/index.js');
const SHOT = process.env.SHOT || 'tests/shots';
mkdirSync(SHOT, { recursive: true });
const FILE = 'file://' + new URL('../dist/velocity-fps.html', import.meta.url).pathname;
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => { window.__VELOCITY_TEST = { quality: 'low', dtCap: 0.25, maxTicks: 30, settings: { showHelp: false } }; });
await page.goto(FILE);
await page.waitForFunction(() => !document.getElementById('play').disabled, null, { timeout: 180000 });
await page.click('#play');
const st = () => page.evaluate(() => window.__velocity.state());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitGame = async (sec) => { const t0 = (await st()).stats.ticks; while ((await st()).stats.ticks - t0 < sec * 120) await sleep(100); };
const out = [];
// sondes internes : on enregistre l'instant exact où la glissade / le plongeon démarrent
await page.evaluate(() => {
  const G = window.__velocity.G, P = G.player;
  window.__probe = { slides: [], dives: [] };
  const os = P.startSlide.bind(P), od = P.startDive.bind(P);
  P.startSlide = (fromDive) => { const before = P.hspeed; os(fromDive); window.__probe.slides.push({ fromDive: !!fromDive, before: +before.toFixed(2), after: +P.hspeed.toFixed(2), tick: P.stats.ticks, slideT: P.slideT }); };
  P.startDive = (fx, fz) => { const before = { hs: P.hspeed, vy: P.vel.y, g: P.onGround }; od(fx, fz); window.__probe.dives.push({ before, after: { hs: +P.hspeed.toFixed(2), vy: +P.vel.y.toFixed(2) }, tick: P.stats.ticks }); };
  const ot = P.tick.bind(P);
  P.tick = (inp, dt) => { ot(inp, dt); const pr = window.__probe; const last = pr.slides[pr.slides.length - 1]; if (last && P.stats.ticks - last.tick === 60) last.slideTAfter0_5s = +P.slideT.toFixed(2), last.hsAfter0_5s = +P.hspeed.toFixed(2); };
});
await page.evaluate(() => { const v = window.__velocity, D = v.routes().plazas.find((p) => p.id === 'D'); v.teleport(D.x - D.tx * 60, D.y + 0.75, D.z - D.tz * 60, Math.atan2(-D.tx, -D.tz)); });
await waitGame(0.5);
await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
await waitGame(1.5);
let s = await st();
out.push({ test: 'Sprint (Maj)', ok: s.hspeed > 8.5, vitesse: +s.hspeed.toFixed(2) });
await page.keyboard.press('KeyC');
await waitGame(0.3);
await page.screenshot({ path: `${SHOT}/08-glissade.png` });
await waitGame(1.0);
let pr = await page.evaluate(() => window.__probe);
const sl = pr.slides[0];
out.push({ test: 'Glissade (C en sprint)', ok: !!sl && sl.after > sl.before && sl.slideTAfter0_5s > 0, ...sl });
// plongeon : Espace maintenu (rebonds), puis C en l'air
await page.keyboard.down('Space');
await waitGame(0.5);
await page.keyboard.press('KeyC');
await waitGame(1.0);
await page.keyboard.up('Space');
await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
await waitGame(1.0);
pr = await page.evaluate(() => window.__probe);
const dv = pr.dives[0];
out.push({ test: 'Plongeon (C en l’air)', ok: !!dv && !dv.before.g && dv.after.vy < dv.before.vy, ...dv });
out.push({ test: 'Réception du plongeon en glissade', ok: pr.slides.some((x) => x.fromDive), glissadesApresPlongeon: pr.slides.filter((x) => x.fromDive).length });
// secousses à 0 : la caméra ne doit pas bouger à la réception d'une grande chute
const cam = await page.evaluate(async () => {
  const v = window.__velocity, G = v.G;
  const res = {};
  for (const shake of [0.6, 0]) {
    G.camDip.x = G.camDip.v = 0;
    document.getElementById('s-shake').value = shake; document.getElementById('s-shake').dispatchEvent(new Event('input'));
    v.teleport(-70, 160, -76, Math.PI / 4);
    G.camShakeMax = 0;
    const t0 = G.player.stats.ticks;
    await new Promise((r) => { const iv = setInterval(() => { if (G.player.stats.ticks - t0 > 5 * 120) { clearInterval(iv); r(); } }, 50); });
    res[`secousses_${shake}`] = +G.camShakeMax.toFixed(3);
  }
  return res;
});
out.push({ test: 'Secousses réglables jusqu’à zéro (amplitude caméra max à la réception d’une chute de 55 m)', ok: cam.secousses_0 < 0.001 && cam['secousses_0.6'] > 0.02, ...cam });
out.push({ test: 'Aucune erreur JavaScript', ok: errors.length === 0, errors });
for (const o of out) console.log(`${o.ok ? 'OK  ' : 'ÉCHEC'} ${o.test} — ${JSON.stringify(o)}`);
writeFileSync('tests/results-moves.json', JSON.stringify(out, null, 2));
await browser.close();
