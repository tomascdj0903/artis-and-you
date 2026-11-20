// Contrôle automatique des mises en page sur 18 formats d'écran (PC, Mac, ultra-large, iPad, Galaxy Tab, iPhone, Android),
// en mode démo local : node tests/layout.mjs après « npm run build ».
// Échec si une page déborde de l'écran, si une page renvoie ailleurs ou s'il y a une erreur JavaScript ;
// les petits défauts (titre coupé, élément qui dépasse dans un bloc) sont listés comme avertissements.
// Options : ONLY=iphone-se,pixel-7 (formats à tester), SHOT=iphone-se (captures dans OUT=/tmp/layout).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from 'playwright';

const DIST = path.resolve('dist'); const PORT = 5198; const BASE = `http://localhost:${PORT}`;
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.html': 'text/html', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = path.join(DIST, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(DIST) || !fs.existsSync(p)) p = path.join(DIST, 'app.html'); else if (fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(PORT);

const OUT = process.env.OUT || '/tmp/layout'; fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

// 1) Préparer les comptes de démo (artisan + particulier) dans un seul navigateur
const ctx0 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const pg = await ctx0.newPage(); pg.setDefaultTimeout(8000);
const field = (p, label) => p.locator(`label.field:has(span:text-is("${label}"))`).first().locator('input,select,textarea').first();
const skipTour = async (p) => { for (let i = 0; i < 3; i++) { if (await p.locator('.tour-x').count()) await p.click('.tour-x').catch(() => {}); else break; } };
await pg.goto(BASE + '/inscription'); await pg.click('button.opt:has-text("Artisan ou entreprise")');
await field(pg, 'Civilité').selectOption('M.'); await field(pg, 'Prénom').fill('Antoine'); await field(pg, 'Nom').fill('Morel');
await field(pg, 'E-mail').fill('pro@demo.test'); await field(pg, 'Téléphone mobile').fill('06 12 34 56 78'); await field(pg, 'Mot de passe').fill('secret123');
await pg.check('form label.check input'); await pg.click('button:has-text("Continuer")');
let code = (await pg.locator('.notice').first().innerText()).match(/(\d{6})/)[1];
await pg.fill('input[autocomplete="one-time-code"]', code); await pg.click('form button.btn');
await pg.waitForSelector('text=Votre entreprise');
await field(pg, 'Raison sociale').fill('Morel Plomberie Chauffage Sanitaire'); await field(pg, 'Forme juridique').selectOption('SARL'); await field(pg, 'SIRET').fill('73282932000074');
await field(pg, 'Adresse').fill('14 impasse des Artisans'); await field(pg, 'Code postal').fill('06600'); await field(pg, 'Ville').fill('Antibes');
await field(pg, 'Téléphone de l’entreprise').fill('04 93 00 00 00');
await pg.click('button.chip:has-text("Plomberie et chauffage")'); await pg.click('button:has-text("Commencer mon essai")');
await pg.waitForURL('**/pro'); await pg.waitForTimeout(500); await skipTour(pg);
await pg.goto(BASE + '/pro/clients/nouveau'); await pg.waitForTimeout(400); await skipTour(pg);
await field(pg, 'Nom').fill('Faure-Delacroix'); await field(pg, 'Prénom').fill('Marie-Charlotte'); await field(pg, 'E-mail').fill('client@demo.test');
await pg.click('button.btn:has-text("Enregistrer")'); await pg.waitForURL(/\/pro\/clients\/[0-9a-f-]{8,}/);
const clientUrl = new URL(pg.url()).pathname;
await pg.goto(BASE + '/pro/documents/nouveau?kind=devis'); await pg.waitForTimeout(500); await skipTour(pg);
await pg.locator('.picker input').first().click(); await pg.locator('.picker-list button').first().click();
await field(pg, 'Objet').fill('Remplacement complet du chauffe-eau et mise aux normes');
await pg.goto(BASE + '/pro'); await pg.waitForTimeout(800);
const proState = await ctx0.storageState({ indexedDB: true });
console.log('comptes prêts', clientUrl);

const PRO = ['/pro', '/pro/clients', clientUrl, '/pro/planning', '/pro/documents', '/pro/documents/nouveau?kind=devis', '/pro/messages', '/pro/crm', '/pro/compte', '/pro/notifications'];
const PUBLIC = ['/', '/connexion', '/inscription', '/tarifs', '/mentions-legales', '/cgu', '/telecharger'];

const VIEWS = [
  ['pc-asus-1366x768', { viewport: { width: 1366, height: 768 } }],
  ['macbook-air-1440x900', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }],
  ['macbook-pro14-1512x982', { viewport: { width: 1512, height: 982 }, deviceScaleFactor: 2 }],
  ['pc-1920x1080', { viewport: { width: 1920, height: 1080 } }],
  ['ultra-large-2560x1080', { viewport: { width: 2560, height: 1080 } }],
  ['ultra-large-3440x1440', { viewport: { width: 3440, height: 1440 } }],
  ['pc-petit-1024x768', { viewport: { width: 1024, height: 768 } }],
  ['ipad-portrait', devices['iPad (gen 7)']],
  ['ipad-paysage', devices['iPad (gen 7) landscape']],
  ['ipad-pro-11-paysage', devices['iPad Pro 11 landscape']],
  ['galaxy-tab-s4', devices['Galaxy Tab S4']],
  ['iphone-se', devices['iPhone SE']],
  ['iphone-15', devices['iPhone 15']],
  ['iphone-15-pro-max', devices['iPhone 15 Pro Max']],
  ['iphone-15-paysage', devices['iPhone 15 landscape']],
  ['galaxy-s9', devices['Galaxy S9+']],
  ['pixel-7', devices['Pixel 7']],
  ['android-petit-360x640', devices['Galaxy S8']],
];
const SHOT = new Set((process.env.SHOT || '').split(',').filter(Boolean));
const report = []; let fatal = 0;
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
for (const [name, dev] of VIEWS.filter(([n]) => !ONLY.length || ONLY.includes(n))) {
  const ctx = await browser.newContext({ ...dev, storageState: proState });
  const p = await ctx.newPage(); p.setDefaultTimeout(8000);
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  for (const url of [...PUBLIC, ...PRO]) {
    // Les pages publiques se testent déconnecté
    const isPub = PUBLIC.includes(url);
    const pp = isPub ? await (await browser.newContext({ ...dev })).newPage() : p;
    try { await pp.goto(BASE + url); } catch {}
    await pp.waitForTimeout(700); await skipTour(pp); await pp.waitForTimeout(150);
    if (!isPub && !new URL(pp.url()).pathname.startsWith(url.split('?')[0])) { report.push(`✗ ${name} ${url} → redirigé vers ${pp.url()}`); fatal++; }
    const r = await pp.evaluate(() => {
      const W = window.innerWidth, out = [];
      const doc = document.documentElement.scrollWidth - W;
      const scroller = (el) => { for (let e = el.parentElement; e; e = e.parentElement) { const s = getComputedStyle(e); if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) return true; } return false; };
      for (const el of document.querySelectorAll('body *')) {
        const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden' || s.position === 'fixed') continue;
        const b = el.getBoundingClientRect(); if (!b.width || !b.height) continue;
        if ((b.right > W + 2 || b.left < -2) && !scroller(el)) out.push((el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : el.tagName) + ' ' + Math.round(b.left) + '→' + Math.round(b.right));
        // texte coupé dans un bouton / une puce
        if (/^(BUTTON|A)$/.test(el.tagName) && el.scrollWidth > el.clientWidth + 2 && s.overflow !== 'visible' && s.textOverflow !== 'ellipsis') out.push('texte coupé ' + el.tagName + ' « ' + el.innerText.slice(0, 30) + ' »');
      }
      const h = document.querySelector('.topbar h1'); if (h && h.scrollWidth > h.clientWidth + 1) out.push('titre coupé « ' + h.innerText + ' » ' + h.scrollWidth + '/' + h.clientWidth + ' [' + [...document.querySelector('.topbar').children].map((c) => Math.round(c.getBoundingClientRect().width)).join(',') + '] topbar=' + Math.round(document.querySelector('.topbar').getBoundingClientRect().width) + ' ' + getComputedStyle(document.querySelector('.topbar')).gridTemplateColumns);
      return { doc, out: [...new Set(out)].slice(0, 6) };
    });
    if (r.doc > 2) fatal++;
    if (r.doc > 2 || r.out.length) report.push(`${r.doc > 2 ? '✗' : '·'} ${name} ${url} · débord page ${r.doc}px · ${r.out.join(' | ')}`);
    if (SHOT.has(name)) await pp.screenshot({ path: `${OUT}/${name}__${url.replace(/[/?=]/g, '_')}.png`, fullPage: false });
    if (isPub) await pp.context().close();
  }
  if (errs.length) { report.push(`✗ ${name} erreurs JS : ${[...new Set(errs)].join(' / ')}`); fatal++; }
  await ctx.close();
}
console.log(report.length ? report.join('\n') : 'Aucun défaut détecté');
console.log(fatal ? `\n${fatal} problème(s) bloquant(s)` : '\nMises en page OK sur tous les formats');
await browser.close(); server.close();
process.exit(fatal ? 1 : 0);
