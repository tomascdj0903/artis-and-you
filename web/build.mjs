import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const serve = process.argv.includes('--serve');
fs.rmSync('dist', { recursive: true, force: true });
fs.cpSync('public', 'dist', { recursive: true });
const env = {
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_KEY: process.env.SUPABASE_KEY || '',
  ADMIN_EMAILS: process.env.ADMIN_EMAILS || 'tomascdj0903@gmail.com',
  APP_VERSION: JSON.parse(fs.readFileSync('package.json', 'utf8')).version,
  GITHUB_REPO: process.env.GITHUB_REPO || 'tomascdj0903/artis-and-you',
};
const opts = {
  entryPoints: ['src/main.jsx'], bundle: true, minify: !serve, sourcemap: serve,
  outdir: 'dist/assets', entryNames: 'app', format: 'esm', splitting: true, chunkNames: 'chunks/[name]-[hash]', target: 'es2020',
  jsx: 'automatic', loader: { '.svg': 'text' },
  define: { __ENV__: JSON.stringify(env), 'process.env.NODE_ENV': serve ? '"development"' : '"production"' },
  logLevel: 'info',
};
if (serve) {
  const ctx = await esbuild.context(opts);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: 'dist', port: 5173, fallback: 'dist/index.html' });
  console.log('http://localhost:' + port);
} else {
  await esbuild.build(opts);
  await prerender();
}

// La page d'accueil est écrite en HTML dans dist/index.html (moteurs de recherche, aperçus de lien, affichage immédiat).
// Les autres adresses reçoivent dist/app.html, la coque vide (voir vercel.json). En cas d'échec, le site reste celui d'avant.
async function prerender() {
  const shell = fs.readFileSync('dist/index.html', 'utf8');
  fs.writeFileSync('dist/app.html', shell);
  try {
    const out = 'dist/.prerender.cjs';
    await esbuild.build({
      entryPoints: ['scripts/prerender-entry.jsx'], bundle: true, outfile: out, format: 'cjs', platform: 'node', target: 'node20', jsx: 'automatic', loader: { '.svg': 'text' }, logLevel: 'silent',
      define: { __ENV__: JSON.stringify({ ...env, SUPABASE_URL: '', SUPABASE_KEY: '' }), 'process.env.NODE_ENV': '"production"' },
      // Le code de l'app s'attend à un navigateur : on lui fournit le strict minimum pour s'exécuter une fois
      banner: { js: `const __st = { getItem: () => null, setItem() {}, removeItem() {} }; const __el = () => ({ style: {}, dataset: {}, setAttribute() {}, appendChild() {}, addEventListener() {} });
Object.assign(globalThis, { window: globalThis, localStorage: __st, sessionStorage: __st, location: { pathname: '/', search: '', hash: '', origin: 'https://artis-and-you.vercel.app', protocol: 'https:', href: 'https://artis-and-you.vercel.app/' },
  document: { documentElement: __el(), head: __el(), body: __el(), createElement: __el, addEventListener() {}, removeEventListener() {}, querySelector: () => null, title: '', hidden: false, fonts: { load: async () => {} } },
  addEventListener() {}, removeEventListener() {}, scrollTo() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), history: { state: null, pushState() {}, replaceState() {} } });
if (!globalThis.navigator) globalThis.navigator = { userAgent: 'prerender', onLine: true };` },
    });
    const { html } = createRequire(import.meta.url)('./' + out);
    const body = html();
    fs.rmSync(out, { force: true });
    if (!body.includes('lp-hero')) throw new Error('rendu vide');
    fs.writeFileSync('dist/index.html', shell.replace('<div id="root"></div>', '<div id="root">' + body + '</div>'));
    console.log('Accueil pré-rendu : ' + Math.round(body.length / 1024) + ' Ko de HTML');
  } catch (e) { console.warn('Pré-rendu de l’accueil ignoré :', e.message); }
}
