// Captures de présentation (1280×720, qualité moyenne).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || '/opt/node-tools/node_modules/playwright/index.js');
const OUT = process.env.OUT || 'tests/showcase';
mkdirSync(OUT, { recursive: true });
const FILE = 'file://' + new URL('../dist/velocity-fps.html', import.meta.url).pathname;
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
page.setDefaultTimeout(180000);;
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.addInitScript(() => { window.__VELOCITY_TEST = { quality: 'medium', settings: { showHelp: true } }; });
await page.goto(FILE);
await page.waitForFunction(() => !document.getElementById('play').disabled, null, { timeout: 180000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/a-titre.png` });
await page.click('#play');
await page.waitForTimeout(4000);
await page.evaluate(() => { const v = window.__velocity; v.freeze(true); v.view(0.02, -0.03); });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/b-depart-deux-destinations.png` });
const D = Math.PI / 180;
const scenes = [
  ['c-boucle-120ms', async () => { const v = window.__velocity, r = v.routes(), p = r.ring[30], q = r.ring[31]; const tx = q.x - p.x, tz = q.z - p.z, l = Math.hypot(tx, tz); v.teleport(p.x, p.y + 3, p.z, Math.atan2(-tx, -tz)); v.setVel(tx / l * 122, 1, tz / l * 122); v.view(Math.atan2(-tx, -tz), -0.04); v.inspectAt(null); }],
  ['d-inspection-face-a-en-vol', async () => { const v = window.__velocity, r = v.routes(), p = r.viaduc[30], q = r.viaduc[31]; const tx = q.x - p.x, tz = q.z - p.z, l = Math.hypot(tx, tz); v.teleport(p.x, p.y + 3, p.z, Math.atan2(-tx, -tz)); v.setVel(tx / l * 64, 2, tz / l * 64); v.view(Math.atan2(-tx, -tz), -0.05); v.inspectAt(0.9); }],
  ['e-inspection-face-b', async () => { window.__velocity.inspectAt(2.3); }],
  ['f-surf-coulees', async () => { const v = window.__velocity, r = v.routes(), c = r.couleesFace[0], p = c[40], q = c[41]; const tx = q.x - p.x, tz = q.z - p.z, l = Math.hypot(tx, tz); v.teleport(p.x, p.y + 1.5, p.z, Math.atan2(-tx, -tz)); v.setVel(tx / l * 58, -2, tz / l * 58); v.view(Math.atan2(-tx, -tz) + 0.12, -0.12); v.inspectAt(null); }],
  ['g-hauts-fourneaux', async () => { const v = window.__velocity; v.teleport(1395, 3, -1395, -45 * Math.PI / 180); v.setVel(0, 0, 0); v.view(-45 * Math.PI / 180 + 0.25, 0.2); }],
  ['h-docks-depuis-la-fleche', async () => { const v = window.__velocity; const S = Math.SQRT1_2; const u = -70, w = -100; const x = -1560 + u * S + w * -S, z = -1560 + u * -S + w * -S; v.teleport(x, 58, z, Math.atan2(S, -S) + 0.3); v.view(Math.atan2(S, -S) + 0.5, -0.32); }],
  ['i-gazometre', async () => { const v = window.__velocity; v.teleport(-1060, 72, 1060, 135 * Math.PI / 180); v.view(135 * Math.PI / 180, -0.05); }],
];
for (const [name, fn] of scenes) {
  await page.evaluate(`(${fn.toString()})()`);
  await page.evaluate(() => { window.__velocity.streamNow(); window.__velocity.hideUI(false); });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('ok', name);
}
await browser.close();
