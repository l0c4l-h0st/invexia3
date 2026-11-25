// Construit le jeu en un seul fichier HTML autonome (Three.js inclus, aucun téléchargement).
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const res = await build({
  entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: ['es2020'],
  write: false, legalComments: 'none', charset: 'utf8',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const tpl = readFileSync('src/index.html', 'utf8');
const cut = tpl.indexOf('<div id="app">');
const head = tpl.slice(0, cut).trim(), body = tpl.slice(cut).trim();
const banner = '<!-- Velocity FPS v2 · Friche Ardente · jeu autonome (Three.js r160, licence MIT, inclus) -->';
const full = `<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${banner}\n${head}\n</head>\n<body>\n${body}\n<script>${js}</script>\n</body>\n</html>\n`;
const artifact = `${head}\n${banner}\n${body}\n<script>${js}</script>\n`;
mkdirSync('dist', { recursive: true });
writeFileSync('dist/velocity-fps.html', full);
writeFileSync('dist/artifact.html', artifact);
writeFileSync('../index.html', full);
console.log(`velocity-fps.html : ${(full.length / 1024).toFixed(0)} Ko (script ${(js.length / 1024).toFixed(0)} Ko)`);
