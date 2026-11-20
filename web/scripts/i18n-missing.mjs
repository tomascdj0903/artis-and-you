// Liste les textes passés à t('…') dans le code qui n'ont pas encore de traduction (en, pt, it)
// node scripts/i18n-missing.mjs [--json]
import fs from 'node:fs';
import path from 'node:path';
const root = new URL('../src/', import.meta.url).pathname;
const files = [];
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (f !== 'i18n') walk(p); } else if (/\.(jsx?|mjs)$/.test(f)) files.push(p); } };
walk(root);
const langs = {};
for (const l of ['en', 'pt', 'it']) langs[l] = (await import(path.join(root, 'i18n', l + '.js'))).default;
const re = /\bt\(\s*(['"])((?:\\.|(?!\1).)*?)\1/g;
const missing = new Map();
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(re)) {
    const s = m[2].replace(/\\(['"\\])/g, '$1').replace(/\\n/g, '\n');
    if (!/[A-Za-zÀ-ÿ]/.test(s)) continue;
    const miss = ['en', 'pt', 'it'].filter((l) => !(s in langs[l]));
    if (miss.length) missing.set(s, { miss, file: path.relative(root, f) });
  }
}
if (process.argv.includes('--json')) console.log(JSON.stringify([...missing.keys()], null, 1));
else { for (const [s, v] of missing) console.log(v.miss.join(','), '·', v.file, '·', JSON.stringify(s)); console.log(missing.size, 'textes sans traduction'); }
