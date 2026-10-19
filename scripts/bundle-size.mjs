// Prints the gzipped size of the JS the app needs on first launch: the entry + everything it statically imports,
// plus the Today route (the first screen) with its static imports. Lazy chunks (zxing, jszip, leaflet, html-to-image…) are listed separately.
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const dist = 'dist', assets = join(dist, 'assets');
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const entry = html.match(/assets\/(index-[^"]+\.js)/)?.[1];
const gz = (f) => gzipSync(readFileSync(join(assets, f))).length;
const statics = (f) => { const src = readFileSync(join(assets, f), 'utf8'); return [...src.matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)].map((m) => m[1]); };
const seen = new Set();
const walk = (f) => { if (seen.has(f)) return; seen.add(f); statics(f).forEach(walk); };
walk(entry);
const base = new Set(seen);
const today = readdirSync(assets).find((f) => /^Today-.*\.js$/.test(f));
walk(today);
const sum = (set) => [...set].reduce((a, f) => a + gz(f), 0);
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(`entry + static imports : ${kb(sum(base))} gzipped (${base.size} files)`);
console.log(`+ Today route          : ${kb(sum(seen))} gzipped (${seen.size} files)  ← initial JS (limit 200 KB)`);
const lazy = readdirSync(assets).filter((f) => f.endsWith('.js') && !seen.has(f)).map((f) => [f, gz(f)]).sort((a, b) => b[1] - a[1]).slice(0, 6);
console.log('largest lazy chunks    :', lazy.map(([f, n]) => `${f.replace(/-[\w-]+\.js$/, '')} ${kb(n)}`).join(' · '));
