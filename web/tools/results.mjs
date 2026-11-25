// Génère tests/RESULTS.md à partir des résultats JSON des tests.
import { readFileSync, writeFileSync } from 'node:fs';
const r = JSON.parse(readFileSync('tests/results.json', 'utf8'));
const m = JSON.parse(readFileSync('tests/results-moves.json', 'utf8'));
const cell = (o, n = 420) => '`' + JSON.stringify(o).replace(/\|/g, '/').slice(0, n) + '`';
const lines = [
  '# Résultats mesurés (Chromium headless, Playwright)', '',
  `Exécution : ${r.started} — fichier testé : \`dist/velocity-fps.html\`.`,
  `Rendu : ${r.final.gpu} (rendu **logiciel**, sans GPU : ${r.frame.fps.toFixed(1)} images/s, médiane ${Math.round(r.frame.p50)} ms par image). Ces images/s ne représentent pas une machine avec carte graphique.`,
  'La physique tourne à pas fixe de 120 Hz : les durées sont en **temps de jeu**.',
  'Le pilote automatique n’utilise que les commandes d’un joueur, avec des contraintes humaines : chaque touche de strafe est tenue au moins 0,18 s et la vue tourne au plus de 300°/s.', '',
  `## Batterie principale (tests/e2e.mjs) : ${r.checks.filter((c) => c.ok).length}/${r.checks.length}`, '',
  '| Vérification | Résultat | Mesures |', '| --- | --- | --- |',
  ...r.checks.map((c) => `| ${c.name} | ${c.ok ? 'OK' : 'ÉCHEC'} | ${cell(c.detail)} |`),
  '', `## Mouvements (tests/moves.mjs) : ${m.filter((c) => c.ok).length}/${m.length}`, '',
  '| Vérification | Résultat | Mesures |', '| --- | --- | --- |',
  ...m.map((c) => { const { test, ok, ...d } = c; return `| ${test} | ${ok ? 'OK' : 'ÉCHEC'} | ${cell(d, 300)} |`; }),
  '', '## Parcours rapide (extrait, temps de jeu)', '',
  '| t (s) | vitesse (m/s) | secteur |', '| --- | --- | --- |',
  ...r.run.log.filter((x, i) => i % 4 === 0).map((x) => `| ${x.t} | ${x.v} | ${x.sector} |`),
  '', 'Captures : `tests/shots/` (pendant les tests, 640×360) et `tests/showcase/` (1280×720, dont `karambit-figures.gif`).',
];
writeFileSync('tests/RESULTS.md', lines.join('\n') + '\n');
console.log('tests/RESULTS.md écrit');
