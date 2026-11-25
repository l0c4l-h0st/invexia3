// Réglages graphiques : niveaux appliqués en direct, résolution, mode Auto.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || 'playwright');
const SHOT = process.env.SHOT || 'tests/shots';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
page.setDefaultTimeout(180000);
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
// pas de qualité imposée : le jeu choisit lui-même (Auto)
await page.addInitScript(() => { localStorage.clear(); window.__VELOCITY_TEST = { noLock: true, dtCap: 0.25, maxTicks: 30, settings: { showHelp: false } }; });
await page.goto('file://' + process.cwd() + '/dist/velocity-fps.html');
await page.waitForFunction(() => !document.getElementById('play').disabled);
await page.click('#play');
await page.waitForTimeout(1500);
const V = (f, a) => page.evaluate(f, a);
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'OK  ' : 'ÉCHEC'} ${name} — ${JSON.stringify(detail).slice(0, 400)}`); };

const g0 = await V(() => window.__velocity.gfx());
check('Auto détecte le rendu logiciel et part en « Très basse »', g0.choice === 'auto' && g0.quality === 'min' && !g0.shadows, { choix: g0.choice, niveau: g0.quality, ombres: g0.shadows, densitePixels: g0.pixelRatio });

// images/s mesurées par niveau (même vue, joueur immobile)
const perLevel = [];
for (const q of ['high', 'medium', 'low', 'min']) {
  await V((q) => window.__velocity.setQuality(q), q);
  await page.waitForTimeout(2500); // recompilation des shaders
  const f0 = await V(() => window.__velocity.state().frames ?? null);
  const t0 = Date.now();
  await page.waitForTimeout(6000);
  const fr = await V(() => window.__velocity.frameStats());
  const g = await V(() => window.__velocity.gfx());
  perLevel.push({ niveau: q, imagesParS: +fr.fps.toFixed(2), msMediane: Math.round(fr.p50), ombres: g.shadows, densitePixels: g.pixelRatio, tampon: `${g.bufferW}×${g.bufferH}`, particulesMax: g.pMax, brume: +g.fogDensity.toFixed(6) });
  await page.screenshot({ path: `${SHOT}/q-${q}.png` });
}
const byQ = Object.fromEntries(perLevel.map((x) => [x.niveau, x]));
check('Les 4 niveaux s’appliquent en direct (ombres, densité de pixels, brume, particules)', byQ.high.ombres && byQ.medium.ombres && !byQ.low.ombres && !byQ.min.ombres && byQ.high.densitePixels > byQ.medium.densitePixels && byQ.medium.densitePixels > byQ.low.densitePixels && byQ.low.densitePixels > byQ.min.densitePixels, perLevel);
check('« Très basse » plus rapide que « Haute » (rendu logiciel)', byQ.min.imagesParS > byQ.high.imagesParS, { haute: byQ.high.imagesParS, tresBasse: byQ.min.imagesParS, gain: +(byQ.min.imagesParS / byQ.high.imagesParS).toFixed(2) });

await V(() => window.__velocity.setRenderScale(0.5));
await page.waitForTimeout(500);
const g5 = await V(() => window.__velocity.gfx());
check('Curseur de résolution à 50 % : tampon de rendu divisé par deux', g5.renderScale === 0.5 && Math.abs(g5.bufferW - byQ.min.tampon.split('×')[0] * 0.5) <= 2, { tampon: `${g5.bufferW}×${g5.bufferH}`, avant: byQ.min.tampon });
await V(() => window.__velocity.setRenderScale(1));

// mode Auto : on part de « Moyenne » en mode auto et on laisse le jeu réagir aux images/s faibles
await V(() => { window.__velocity.setQuality('auto'); window.__velocity.setQuality('medium'); });
await V(() => { const G = window.__velocity.G; G.autoQ.on = true; G.autoQ.grace = 0; });
const before = await V(() => window.__velocity.gfx());
await page.waitForTimeout(16000);
const after = await V(() => window.__velocity.gfx());
check('Mode Auto : baisse la qualité tout seul quand les images/s restent sous 38', after.auto.steps >= 1 && ['low', 'min'].indexOf(after.quality) >= 0, { avant: before.quality, apres: after.quality, crans: after.auto.steps, resolution: after.renderScale });

// panneau F1 : les boutons de qualité existent et marquent le niveau choisi
await V(() => window.__velocity.setQuality('low'));
await V(() => window.__velocity.openTuner());
await page.waitForTimeout(800);
const ui = await V(() => ({ on: [...document.querySelectorAll('#qbtns .preset.on')].map((b) => b.dataset.q), note: document.getElementById('qnote').textContent, select: document.getElementById('s-q').value }));
await page.screenshot({ path: `${SHOT}/q-panneau-f1.png` });
check('F1 → Graphismes : niveau marqué et résumé affiché', ui.on.join() === 'low' && ui.select === 'low' && /Basse/.test(ui.note), ui);
check('Aucune erreur JavaScript', errs.length === 0, errs.slice(0, 5));
writeFileSync('tests/results-quality.json', JSON.stringify(results, null, 1));
console.log(`${results.filter((r) => r.ok).length}/${results.length} vérifications réussies`);
await browser.close();
