// Assistant Artesa : reçoit la question + les 2-3 fiches d'aide trouvées dans l'app, et demande à l'IA (Groq)
// de répondre en s'appuyant UNIQUEMENT sur ces fiches. La clé GROQ_API_KEY reste côté serveur (secret Supabase).
// Limites : 40 questions / jour / utilisateur, réponses courtes (max ~350 tokens), contexte réduit.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const MODELS = ['llama-3.3-70b-versatile', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant'];
const DAILY = 40;
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const auth = req.headers.get('authorization') || '';
  const url = Deno.env.get('SUPABASE_URL')!;
  const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: u } = await user.auth.getUser();
  if (!u?.user) return json({ error: 'auth' }, 401);
  const key = Deno.env.get('GROQ_API_KEY');
  if (!key) return json({ error: 'no_key' }, 503);

  const body = await req.json().catch(() => ({}));
  const question = String(body.question || '').slice(0, 500).trim();
  if (!question) return json({ error: 'empty' }, 400);
  const facts = (Array.isArray(body.facts) ? body.facts : []).slice(0, 3).map((f: any) => `- ${String(f.q).slice(0, 120)} : ${String(f.a).slice(0, 700)}`).join('\n');
  const history = (Array.isArray(body.history) ? body.history : []).slice(-4).map((m: any) => ({ role: m.me ? 'user' : 'assistant', content: String(m.text || '').slice(0, 400) }));

  // Quota quotidien par utilisateur (compté côté serveur)
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const day = new Date().toISOString().slice(0, 10);
  const { data: row } = await admin.from('assistant_usage').select('count').eq('user_id', u.user.id).eq('day', day).maybeSingle();
  if ((row?.count || 0) >= DAILY) return json({ error: 'quota', answer: 'Vous avez atteint la limite de questions pour aujourd’hui. Réessayez demain, ou consultez l’aide.' }, 429);
  await admin.from('assistant_usage').upsert({ user_id: u.user.id, day, count: (row?.count || 0) + 1 });

  // L'assistant sert aussi les particuliers (clients des artisans) : on adapte la présentation de l'app
  const who = body.audience === 'client'
    ? "Tu parles à un particulier, client d'artisans, qui utilise gratuitement l'espace client d'Artesa (trouver un artisan, demander un rendez-vous, signer ses devis, payer ses factures, suivre ses chantiers, écrire à ses artisans). Ce n'est pas un artisan : ne parle jamais de créer des devis ou des factures."
    : "Tu parles à un artisan ou à son équipe (logiciel pour artisans du bâtiment : devis, factures, planning, clients, réseau de pros).";
  const system = `Tu es l'assistant de l'application Artesa. ${who}
Réponds en français, de façon courte (3 à 5 phrases maximum), concrète, et vouvoie l'utilisateur.
Appuie-toi UNIQUEMENT sur les fiches d'aide ci-dessous. Si elles ne permettent pas de répondre, dis-le simplement et propose de contacter le support (Paramètres › Aide et support). N'invente jamais de fonctionnalité, de prix ni de chemin de menu.
Fiches d'aide :
${facts || '(aucune fiche trouvée)'}`;

  for (const model of MODELS) {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, temperature: 0.2, max_tokens: 350, messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: question }] }),
    }).catch(() => null);
    if (!r || !r.ok) continue;
    const d = await r.json().catch(() => null);
    const answer = d?.choices?.[0]?.message?.content?.trim();
    if (answer) return json({ answer, model });
  }
  return json({ error: 'ai_unavailable' }, 502);
});
