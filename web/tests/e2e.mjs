// Tests automatiques des parcours principaux (mode local, sans Supabase) : node tests/e2e.mjs après « npm run build »
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const DIST = path.resolve('dist'); const PORT = 5199; const BASE = `http://localhost:${PORT}`;
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.html': 'text/html', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = path.join(DIST, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(DIST) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(DIST, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(PORT);

let failed = 0; const errors = [];
const step = async (name, fn) => { try { await fn(); console.log('✓', name); } catch (e) { failed++; console.log('✗', name, '\n   ', e.message.split('\n')[0], '·', pg.url()); if (process.env.SHOTS) await pg.screenshot({ path: `${process.env.SHOTS}/fail-${failed}.png` }); } };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const pg = await ctx.newPage();
pg.setDefaultTimeout(8000);
pg.on('pageerror', (e) => errors.push(e.message));
const field = (label) => pg.locator(`label.field:has(span:text-is("${label}"))`).first().locator('input,select,textarea').first();
const skipTour = async () => { if (await pg.locator('.tour-x').count()) await pg.click('.tour-x'); };

await step('La page d’accueil publique s’affiche', async () => {
  await pg.goto(BASE + '/'); await pg.waitForSelector('h1:has-text("Le chantier")');
});
await step('Inscription d’un artisan', async () => {
  await pg.goto(BASE + '/inscription'); await pg.click('button.opt:has-text("Artisan ou entreprise")');
  await field('Civilité').selectOption('M.'); await field('Prénom').fill('Antoine'); await field('Nom').fill('Morel');
  await field('E-mail').fill('antoine@test.fr'); await field('Téléphone mobile').fill('06 12 34 56 78'); await field('Mot de passe').fill('secret123');
  await pg.check('form label.check input'); await pg.click('button:has-text("Continuer")');
  const code = (await pg.locator('.notice').first().innerText()).match(/(\d{6})/)[1];
  await pg.fill('input[autocomplete="one-time-code"]', code); await pg.click('form button.btn');
  await pg.waitForSelector('text=Votre entreprise');
  await field('Raison sociale').fill('Morel Plomberie'); await field('Forme juridique').selectOption('SARL'); await field('SIRET').fill('73282932000074');
  await field('Adresse').fill('14 impasse des Artisans'); await field('Code postal').fill('06600'); await field('Ville').fill('Antibes');
  await field('Téléphone de l’entreprise').fill('04 93 00 00 00');
  await pg.click('button.chip:has-text("Plomberie et chauffage")'); await pg.click('button:has-text("Commencer mon essai")');
  await pg.waitForURL('**/pro');
});
await step('Le tutoriel d’entrée s’ouvre puis se ferme', async () => { await pg.waitForSelector('.tour-card'); await skipTour(); });
await step('Toutes les rubriques s’ouvrent sans erreur', async () => {
  for (const p of ['/pro/clients', '/pro/planning', '/pro/documents', '/pro/crm', '/pro/crm/kpi', '/pro/messages', '/pro/reseau', '/pro/notifications', '/pro/compte', '/pro/relances']) {
    await pg.goto(BASE + p); await pg.waitForTimeout(400); await skipTour();
    if (!pg.url().includes(p)) throw new Error('Redirigé depuis ' + p + ' vers ' + pg.url());
    if (await pg.locator('[role=alert]:has-text("Impossible de charger")').count()) throw new Error('Échec de chargement : ' + p);
  }
});
await step('Création d’un client', async () => {
  await pg.goto(BASE + '/pro/clients/nouveau'); await pg.waitForTimeout(400); await skipTour();
  await field('Nom').fill('Faure'); await field('Prénom').fill('Lucie'); await field('E-mail').fill('lucie@ex.fr');
  await pg.click('button.btn:has-text("Enregistrer")'); await pg.waitForURL(/\/pro\/clients\/[0-9a-f-]{8,}/);
});
await step('Création d’un devis', async () => {
  await pg.goto(BASE + '/pro/documents/nouveau?kind=devis'); await pg.waitForTimeout(500); await skipTour();
  const sel = field('Client'); const v = await sel.locator('option').nth(1).getAttribute('value'); await sel.selectOption(v);
  await field('Objet').fill('Remplacement du chauffe-eau');
  const row = pg.locator('div:has(> input[placeholder="Désignation"])').first();
  await row.locator('input[placeholder="Désignation"]').fill('Chauffe-eau 200 L');
  await row.locator('input').nth(2).fill('690');
  await pg.click('button:has-text("Enregistrer le brouillon")'); await pg.waitForURL(/\/pro\/documents\/[0-9a-f-]{8,}/);
});
await step('La recherche globale trouve le client', async () => {
  await pg.goto(BASE + '/pro'); await pg.waitForTimeout(400); await skipTour();
  await pg.fill('.search input', 'faure'); await pg.waitForSelector('.suggest :text("Lucie Faure")');
});
await step('La cloche affiche les notifications', async () => {
  await pg.click('.notifbell .iconbtn'); await pg.waitForSelector('.notifpop');
});
await step('Aucune erreur JavaScript', async () => { if (errors.length) throw new Error(errors.slice(0, 3).join(' | ')); });

await browser.close(); server.close();
console.log(failed ? `\n${failed} test(s) en échec` : '\nTous les tests passent');
process.exit(failed ? 1 : 0);
