// Envoi d'e-mails au nom de l'artisan (relances, suivis) via Resend. Inactif tant que les secrets ne sont pas posés :
//   RESEND_API_KEY  : clé du compte Resend (https://resend.com, gratuit jusqu'à 3 000 e-mails / mois)
//   MAIL_FROM       : expéditeur vérifié chez Resend, ex. "Artesa <notifications@artesa.fr>"
// Sans clé, la fonction répond { error: 'no_key' } et l'application retombe sur l'application mail de l'artisan (mailto).
// Garde-fous : utilisateur connecté, destinataire = un client de SON entreprise, 60 e-mails / jour / entreprise, texte brut uniquement.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const ALLOWED = /^https:\/\/(artis-and-you(-[a-z0-9-]+)?|artesa-pro)\.vercel\.app$|^http:\/\/localhost(:\d+)?$/;
const cors = (req: Request) => {
  const o = req.headers.get('origin') || '';
  return { 'Access-Control-Allow-Origin': ALLOWED.test(o) ? o : 'https://artis-and-you.vercel.app', Vary: 'Origin', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
};
const DAILY = 60;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

Deno.serve(async (req) => {
  const CORS = cors(req);
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'content-type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const key = Deno.env.get('RESEND_API_KEY'), from = Deno.env.get('MAIL_FROM');
  const body = await req.json().catch(() => ({}));
  if (body.probe) return json({ enabled: !!(key && from) });
  if (!key || !from) return json({ error: 'no_key' }, 503);

  const url = Deno.env.get('SUPABASE_URL')!;
  const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('authorization') || '' } } });
  const { data: u } = await user.auth.getUser();
  if (!u?.user) return json({ error: 'auth' }, 401);
  const to = String(body.to || '').trim().toLowerCase();
  const subject = String(body.subject || '').slice(0, 200).trim();
  const text = String(body.text || '').slice(0, 8000).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || !subject || !text) return json({ error: 'invalid' }, 400);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: prof } = await admin.from('profiles').select('company_id, first_name, last_name, email').eq('id', u.user.id).maybeSingle();
  if (!prof?.company_id) return json({ error: 'no_company' }, 403);
  // Le destinataire doit être un client de l'entreprise (pas de relais ouvert)
  const { data: cli } = await admin.from('clients').select('id').eq('company_id', prof.company_id).ilike('email', to).limit(1);
  if (!cli?.length) return json({ error: 'not_a_client' }, 403);
  const { data: co } = await admin.from('companies').select('name, trade_name, email').eq('id', prof.company_id).maybeSingle();

  const day = new Date().toISOString().slice(0, 10);
  const { data: row } = await admin.from('mail_usage').select('count').eq('company_id', prof.company_id).eq('day', day).maybeSingle();
  if ((row?.count || 0) >= DAILY) return json({ error: 'quota' }, 429);
  await admin.from('mail_usage').upsert({ company_id: prof.company_id, day, count: (row?.count || 0) + 1 });

  const name = co?.trade_name || co?.name || 'Artesa';
  const replyTo = co?.email || prof.email || undefined;
  const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.5;color:#2B1F1C;max-width:600px">${esc(text).replace(/\n/g, '<br>')}<hr style="border:0;border-top:1px solid #E6DDD3;margin:24px 0"><div style="font-size:12px;color:#8A7F78">Envoyé par ${esc(name)} via Artesa. Répondez à cet e-mail pour contacter directement l'entreprise.</div></div>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${name.replace(/[<>"]/g, '')} via Artesa <${from.match(/<([^>]+)>/)?.[1] || from}>`, to: [to], subject, text, html, reply_to: replyTo }),
  }).catch(() => null);
  if (!r) return json({ error: 'mail_unavailable' }, 502);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return json({ error: 'mail_failed', detail: d?.message || r.status }, 502);
  return json({ ok: true, id: d.id });
});
