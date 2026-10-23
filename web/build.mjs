import * as esbuild from 'esbuild';
import fs from 'node:fs';
const serve = process.argv.includes('--serve');
fs.rmSync('dist', { recursive: true, force: true });
fs.cpSync('public', 'dist', { recursive: true });
const env = {
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_KEY: process.env.SUPABASE_KEY || '',
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
}
