// Tests automatiques des parcours principaux (mode local, sans Supabase) : node tests/e2e.mjs après « npm run build »
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const DIST = path.resolve('dist'); const PORT = 5199; const BASE = `http://localhost:${PORT}`;
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.html': 'text/html', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = path.join(DIST, decodeURIComponent(req.url.split('?')[0]));
  // Comme Vercel : « / » sert l'accueil pré-rendu, les autres adresses la coque de l'app
  if (!p.startsWith(DIST) || !fs.existsSync(p)) p = path.join(DIST, 'app.html'); else if (fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
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
  await pg.goto(BASE + '/'); await pg.waitForSelector('h1:has-text("facturation électronique")');
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
  for (const p of ['/pro/clients', '/pro/planning', '/pro/documents', '/pro/crm', '/pro/crm/kpi', '/pro/messages', '/pro/reseau', '/pro/notifications', '/pro/compte', '/pro/relances', '/pro/planning/reglages', '/pro/documents/nouveau?kind=devis']) {
    await pg.goto(BASE + p); await pg.waitForTimeout(400); await skipTour();
    if (!pg.url().includes(p)) throw new Error('Redirigé depuis ' + p + ' vers ' + pg.url());
    if (await pg.locator('[role=alert]:has-text("Impossible de charger")').count()) throw new Error('Échec de chargement : ' + p);
    if (await pg.locator('h1:has-text("Un problème est survenu")').count()) throw new Error('Écran d’erreur sur : ' + p);
  }
});
await step('Création d’un client', async () => {
  await pg.goto(BASE + '/pro/clients/nouveau'); await pg.waitForTimeout(400); await skipTour();
  await field('Nom').fill('Faure'); await field('Prénom').fill('Lucie'); await field('E-mail').fill('lucie@ex.fr');
  await pg.click('button.btn:has-text("Enregistrer")'); await pg.waitForURL(/\/pro\/clients\/[0-9a-f-]{8,}/);
});
await step('Création d’un devis', async () => {
  await pg.goto(BASE + '/pro/documents/nouveau?kind=devis'); await pg.waitForTimeout(500); await skipTour();
  await pg.locator('.picker input').first().click(); await pg.locator('.picker-list button').first().click();
  await field('Objet').fill('Remplacement du chauffe-eau');
  const row = pg.locator('div:has(> input[placeholder="Désignation"])').first();
  await row.locator('input[placeholder="Désignation"]').fill('Chauffe-eau 200 L');
  await row.locator('input').nth(2).fill('690');
  await pg.click('button:has-text("Enregistrer le brouillon")'); await pg.waitForURL(/\/pro\/documents\/[0-9a-f-]{8,}/);
});
await step('Envoi d’un message au client', async () => {
  const id = pg.url().match(/clients\/([0-9a-f-]{8,})/)?.[1] || (await pg.evaluate(async () => (await window.__ayApi.select('clients', {}))[0]?.id));
  await pg.goto(BASE + '/pro/clients/' + id + '/chat'); await pg.waitForTimeout(600); await skipTour();
  await pg.fill('form.composer input[type=text]', 'Bonjour, votre devis est prêt.');
  await pg.click('form.composer button.send');
  await pg.waitForSelector('.bubble.out:has-text("votre devis est prêt")', { timeout: 5000 });
});
await step('La recherche globale trouve le client', async () => {
  await pg.goto(BASE + '/pro'); await pg.waitForTimeout(400); await skipTour();
  await pg.fill('.search input', 'faure'); await pg.waitForSelector('.suggest :text("Lucie Faure")');
});
await step('La cloche affiche les notifications', async () => {
  await pg.click('.notifbell .iconbtn'); await pg.waitForSelector('.notifpop');
});
// ── Nouveautés : conversation, tarifs, statistiques, avis, suivi des erreurs ──
const idb = (fn) => pg.evaluate((src) => new Promise((res, rej) => { const r = indexedDB.open('artis-and-you', 2); r.onsuccess = () => { const st = r.result.transaction('kv', 'readwrite').objectStore('kv'); const g = st.get('ay-local-db'); g.onsuccess = () => { const db = g.result; const out = new Function('db', src)(db); const p = st.put(db, 'ay-local-db'); p.onsuccess = () => res(out); p.onerror = () => rej(p.error); }; }; r.onerror = () => rej(r.error); }), fn);
let clientId, quoteId;
await step('Réponses rapides dans la conversation', async () => {
  clientId = await pg.evaluate(async () => (await window.__ayApi.select('clients', {}))[0]?.id);
  await pg.goto(BASE + '/pro/clients/' + clientId + '/chat'); await pg.waitForTimeout(600); await skipTour();
  await pg.locator('.quick-replies .qr').first().click();
  if (!(await pg.inputValue('form.composer input[type=text]')).trim()) throw new Error('Le champ ne s’est pas rempli');
  await pg.fill('form.composer input[type=text]', '');
});
await step('Envoyer un devis depuis la conversation (menu « Devis et factures »)', async () => {
  quoteId = await idb("const d = db.documents.find((x) => x.kind === 'devis'); d.status = 'envoye'; d.number = d.number || 'D-2026-0001'; return d.id;");
  await pg.reload(); await pg.waitForTimeout(800); await skipTour();
  await pg.click('form.composer button.att >> nth=0'); await pg.click('.sheet button.opt:has-text("Devis et factures")');
  await pg.click('.sheet button.opt:has-text("Envoyer un devis")'); await pg.click('.sheet .li:has-text("D-2026-0001")');
  await pg.waitForSelector('.doc-card:has-text("D-2026-0001")');
});
await step('Mes tarifs ajoutés au devis', async () => {
  await idb("const c = db.companies.find((x) => !x.is_platform); c.settings = { ...(c.settings || {}), profile: { ...(c.settings?.profile || {}), tarifs: { deplacement: 48, horaire: 60, items: [{ label: 'Débouchage', price: 120 }] } } }; return c.id;");
  await pg.goto(BASE + '/pro/documents/nouveau?kind=devis'); await pg.waitForTimeout(600); await skipTour();
  await pg.click('button:has-text("Mes tarifs")'); await pg.click('.sheet .li:has-text("Déplacement")');
  const vals = await pg.locator('input[placeholder="Désignation"]').evaluateAll((l) => l.map((x) => x.value));
  if (!vals.includes('Déplacement')) throw new Error('Ligne absente : ' + vals.join(', '));
  const price = await pg.locator('.lg:has(input[value="Déplacement"]) input[type=number]').nth(1).inputValue();
  if (Math.abs(Number(price) - 40) > 0.01) throw new Error('Prix HT attendu 40, obtenu ' + price);
});
await step('Statistiques de la fiche et demande d’avis automatique', async () => {
  await pg.goto(BASE + '/pro/compte/entreprise'); await pg.waitForTimeout(700); await skipTour();
  await pg.waitForSelector('.pstat:has-text("Vues de la fiche")');
  await pg.goto(BASE + '/pro/compte/avis'); await pg.waitForTimeout(500);
  await pg.waitForSelector('text=Demander un avis automatiquement');
});
await step('Les erreurs de l’app sont enregistrées (regroupées)', async () => {
  const n = await pg.evaluate(async () => { await window.__ayApi.rpc('log_client_error', { p_message: 'test e2e', p_path: '/pro/x/12345678-1234-1234-1234-123456789abc' }); await window.__ayApi.rpc('log_client_error', { p_message: 'test e2e', p_path: '/pro/x/12345678-1234-1234-1234-123456789abc' }); return 1; });
  const e = await idb("const e = db.app_errors.find((x) => x.message === 'test e2e'); return e && { c: e.count, p: e.path };");
  if (!e || e.c !== 2 || e.p !== '/pro/x/:id') throw new Error(JSON.stringify(e));
});
// ── Côté particulier ──
await step('Inscription d’un particulier', async () => {
  await pg.evaluate(() => { localStorage.removeItem('ay-session'); sessionStorage.removeItem('ay-session'); });
  await pg.goto(BASE + '/inscription/particulier'); await pg.waitForTimeout(800);
  for (const [l, v] of [['Prénom', 'Lucie'], ['Nom', 'Faure'], ['E-mail', 'lucie@ex.fr'], ['Téléphone mobile', '06 11 22 33 44'], ['Adresse', '3 rue Test'], ['Code postal', '06600'], ['Ville', 'Antibes']]) await field(l).fill(v).catch(() => {});
  await pg.fill('input[type=password]', 'secret123');
  if (await pg.locator('label.field:has(span:text-is("Civilité"))').count()) await field('Civilité').selectOption({ index: 1 });
  await pg.check('form label.check input').catch(() => {}); await pg.click('button:has-text("Continuer"), button:has-text("Créer mon compte")');
  await pg.waitForTimeout(800); const m = (await pg.locator('.notice').first().innerText().catch(() => '')).match(/(\d{6})/);
  if (m) { await pg.fill('input[autocomplete="one-time-code"]', m[1]); await pg.click('form button.btn'); }
  await pg.waitForURL('**/client**'); await pg.waitForTimeout(600); await skipTour();
});
await step('Demande avec photo : le métier est proposé', async () => {
  await pg.goto(BASE + '/client/photo'); await pg.waitForTimeout(500); await skipTour();
  await pg.fill('textarea', 'Une fuite sous l’évier depuis ce matin');
  await pg.click('button:has-text("Trouver le bon métier")'); await pg.waitForSelector('text=Métier proposé');
  const v = await pg.locator('.card select').inputValue(); if (!/Plomberie/.test(v)) throw new Error('Métier : ' + v);
});
await step('Devis signé à deux', async () => {
  const uid = await pg.evaluate(() => JSON.parse(localStorage.getItem('ay-session') || sessionStorage.getItem('ay-session') || '{}')?.user?.id);
  await idb(`const c = db.clients.find((x) => x.id === '${clientId}'); c.user_id = '${uid}'; const co = db.companies.find((x) => x.id === c.company_id); co.verification_status = 'approved'; co.verified = true; return 1;`);
  await pg.reload(); await pg.waitForTimeout(600);
  await pg.goto(BASE + '/client/devis/' + quoteId + '/pdf'); await pg.waitForTimeout(1200); await skipTour();
  await pg.click('button:has-text("Signer le devis électroniquement")'); await pg.check('.sheet label.check:has-text("Nous sommes deux") input');
  await pg.locator('.sheet .cosign input').fill('Marc Faure');
  await pg.check('.sheet label.check:has-text("Bon pour accord") input');
  await pg.click('.sheet button.btn.block:has-text("Signer")'); await pg.waitForTimeout(1200);
  const d = await idb(`const d = db.documents.find((x) => x.id === '${quoteId}'); return { s: d.status, n: d.signed_name, co: d.conditions?.signature?.cosigner?.name };`);
  if (d.s !== 'accepte' || d.co !== 'Marc Faure' || !/ et Marc Faure$/.test(d.n)) throw new Error(JSON.stringify(d));
});
await step('Carnet du logement', async () => {
  await pg.goto(BASE + '/client/carnet'); await pg.waitForTimeout(700); await skipTour();
  await pg.waitForSelector('.carnet h1:has-text("Carnet du logement")'); await pg.waitForSelector('button:has-text("Télécharger en PDF")');
});
await step('Aucune erreur JavaScript', async () => { if (errors.length) throw new Error(errors.slice(0, 3).join(' | ')); });

await browser.close(); server.close();
console.log(failed ? `\n${failed} test(s) en échec` : '\nTous les tests passent');
process.exit(failed ? 1 : 0);
