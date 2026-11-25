import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node-tools/node_modules/playwright/index.js');
const SHOT = process.env.SHOT || '/tmp/claude-0/-home-user-invexia3/62fbc2c4-2ed1-5ca7-94a2-3ae29a304854/scratchpad';
const Q = process.env.Q || 'medium';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.addInitScript((q) => { window.__VELOCITY_TEST = { quality: q, noLock: true, settings: { showHelp: false } }; }, Q);
await page.goto('file:///home/user/invexia3/web/dist/velocity-fps.html');
await page.waitForFunction(() => !document.getElementById('play').disabled, null, { timeout: 120000 });
await page.click('#play');
await page.waitForTimeout(500);
const D = Math.PI / 180;
const shots = (process.env.ONLY ? process.env.ONLY.split(',') : null);
const views = [
  ['ne', 0, 104.71, 6, -45 * D, -0.02], ['nw', 0, 104.71, 6, 45 * D, -0.02],
  ['viaduc', -600, 86, -630, 50 * D, -0.05], ['ring', 0, 60, -1950, -88 * D, -0.03],
  ['fourneaux', 1419, 3, -1419, -45 * D, 0.12], ['docks', -1560 + 250 * 0.707, 4, -1560 + 250 * 0.707, 45 * D, 0.05],
  ['gaso', -1167, 71, 1167, 135 * D, -0.02], ['coulees', 50, 103, -50, -45 * D, -0.12],
  ['plaine', 900, 30, 800, -135 * D, -0.05], ['aerien', 300, 700, 900, 0, -0.42],
];
for (const [name, x, y, z, yaw, pitch] of views) {
  if (shots && !shots.includes(name)) continue;
  await page.evaluate(([x, y, z, yaw, pitch]) => { const v = window.__velocity; v.teleport(x, y, z, yaw); v.freeze(true); v.view(yaw, pitch); v.streamNow(); }, [x, y, z, yaw, pitch]);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOT}/tour-${name}.png` });
  const st = await page.evaluate(() => window.__velocity.state());
  console.log(name, st.sector, 'calls', st.calls, 'tris', st.tris, 'fps', st.fps.toFixed(1), 'chunks', st.stream.loaded);
}
console.log(errs.join('\n'));
await browser.close();
