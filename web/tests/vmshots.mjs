import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node-tools/node_modules/playwright/index.js');
const SHOT = process.env.SHOT || '/tmp/claude-0/-home-user-invexia3/62fbc2c4-2ed1-5ca7-94a2-3ae29a304854/scratchpad';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.addInitScript(() => { window.__VELOCITY_TEST = { quality: 'low', noLock: true, settings: { showHelp: false } }; });
await page.goto('file:///home/user/invexia3/web/dist/velocity-fps.html');
await page.waitForFunction(() => !document.getElementById('play').disabled, null, { timeout: 120000 });
await page.click('#play');
await page.evaluate(() => { const v = window.__velocity; v.teleport(-600, 86, -630, 0.9); v.freeze(true); v.view(0.9, -0.03); v.hideUI(true); });
await page.waitForTimeout(1500);
for (const [name, t] of [['run', null], ['faceA', 0.9], ['flip', 1.62], ['faceB', 2.3]]) {
  await page.evaluate((t) => window.__velocity.inspectAt(t), t);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${SHOT}/vm-${name}.png`, clip: { x: 380, y: 200, width: 900, height: 520 } });
}
await browser.close();
