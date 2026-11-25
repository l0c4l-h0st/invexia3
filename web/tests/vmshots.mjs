// Captures rapprochées de la main et du karambit (réglage des poses et des figures).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node-tools/node_modules/playwright/index.js');
const SHOT = process.env.SHOT || '/tmp/claude-0/-home-user-invexia3/62fbc2c4-2ed1-5ca7-94a2-3ae29a304854/scratchpad';
const LIST = (process.env.LIST || 'idle:null:0').split(',').map((x) => { const [n, t, v] = x.split(':'); return [n, t === 'null' ? null : +t, +v]; });
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.setDefaultTimeout(120000);
page.on('pageerror', (e) => console.log('pageerror', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
await page.addInitScript(() => { window.__VELOCITY_TEST = { quality: 'low', noLock: true, settings: { showHelp: false } }; });
await page.goto('file:///home/user/invexia3/web/dist/velocity-fps.html');
await page.waitForFunction(() => !document.getElementById('play').disabled);
await page.click('#play');
await page.evaluate(() => { const v = window.__velocity; v.teleport(-600, 86, -630, 0.9); v.freeze(true); v.view(0.9, -0.03); v.hideUI(true); v.fidgetsOff(true); });
await page.waitForTimeout(1500);
for (const [name, t, variant] of LIST) {
  await page.evaluate(([t, v]) => window.__velocity.inspectAt(t, v), [t, variant]);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOT}/kb-${name}.png`, clip: { x: 300, y: 140, width: 660, height: 400 } });
}
await browser.close();
