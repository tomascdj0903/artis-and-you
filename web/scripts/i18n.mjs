// Génère src/i18n/{en,pt,it}.js depuis _keys.json (clés FR), _xx.txt (index|traduction) et _extra.txt (fr|en|pt|it)
import fs from 'node:fs';
const dir = new URL('../src/i18n/', import.meta.url);
const keys = JSON.parse(fs.readFileSync(new URL('_keys.json', dir), 'utf8'));
const extra = fs.readFileSync(new URL('_extra.txt', dir), 'utf8').split('\n').filter(Boolean).map((l) => l.split('|'));
const vars = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');
let problems = 0;
['en', 'pt', 'it'].forEach((lang, li) => {
  const out = {};
  for (const line of fs.readFileSync(new URL(`_${lang}.txt`, dir), 'utf8').split('\n')) {
    const m = line.match(/^(\d+)\|(.*)$/); if (!m) continue;
    const fr = keys[+m[1]]; const tr = m[2].replace(/\\n/g, '\n');
    if (fr === undefined) { console.log(lang, 'index inconnu', m[1]); problems++; continue; }
    if (vars(fr) !== vars(tr)) { console.log(lang, 'variables différentes :', JSON.stringify(fr), '→', JSON.stringify(tr)); problems++; }
    out[fr] = tr;
  }
  for (const e of extra) if (e[li + 1]) out[e[0]] = e[li + 1];
  fs.writeFileSync(new URL(`${lang}.js`, dir), '// Fichier généré par scripts/i18n.mjs — modifier _' + lang + '.txt\nexport default ' + JSON.stringify(out, null, 0).replace(/","/g, '",\n"') + ';\n');
  console.log(lang, Object.keys(out).length, 'traductions');
});
process.exitCode = problems ? 1 : 0;
