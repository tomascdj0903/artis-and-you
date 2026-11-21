// Assistant Artis & You : reçoit la question + les 2-3 fiches d'aide trouvées dans l'app, et demande à l'IA (Groq)
// de répondre en s'appuyant UNIQUEMENT sur ces fiches. La clé GROQ_API_KEY reste côté serveur (secret Supabase).
// Limites : 40 questions / jour / utilisateur, réponses courtes (max ~350 tokens), contexte réduit.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

// Seuls le site Artis & You (et ses aperçus Vercel) et le développement local peuvent appeler la fonction depuis un navigateur.
// Le logiciel PC/Mac charge le site : même origine.
const ALLOWED = /^https:\/\/(artis-and-you(-[a-z0-9-]+)?|artesa-pro)\.vercel\.app$|^http:\/\/localhost(:\d+)?$/;
const cors = (req: Request) => {
  const o = req.headers.get('origin') || '';
  return { 'Access-Control-Allow-Origin': ALLOWED.test(o) ? o : 'https://artis-and-you.vercel.app', Vary: 'Origin', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
};
const MODELS = ['llama-3.3-70b-versatile', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant'];
const DAILY = 40;

Deno.serve(async (req) => {
  const CORS = cors(req);
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'content-type': 'application/json' } });
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
  // Mode « photo » : devine le métier à partir d'une photo (et/ou d'une description) pour préremplir une demande
  if (body.mode === 'photo') return photoMode(body, u.user.id, admin0(url), key, json);
  const question = String(body.question || '').slice(0, 500).trim();
  if (!question) return json({ error: 'empty' }, 400);
  const facts = (Array.isArray(body.facts) ? body.facts : []).slice(0, 3).map((f: any) => `- ${String(f.q).slice(0, 120)} : ${String(f.a).slice(0, 700)}`).join('\n');
  const history = (Array.isArray(body.history) ? body.history : []).slice(-4).map((m: any) => ({ role: m.me ? 'user' : 'assistant', content: String(m.text || '').slice(0, 400) }));

  // Quota quotidien par utilisateur (compté côté serveur)
  const admin = admin0(url);
  const day = new Date().toISOString().slice(0, 10);
  const { data: row } = await admin.from('assistant_usage').select('count').eq('user_id', u.user.id).eq('day', day).maybeSingle();
  if ((row?.count || 0) >= DAILY) return json({ error: 'quota', answer: 'Vous avez atteint la limite de questions pour aujourd’hui. Réessayez demain, ou consultez l’aide.' }, 429);
  await admin.from('assistant_usage').upsert({ user_id: u.user.id, day, count: (row?.count || 0) + 1 });

  // L'assistant sert aussi les particuliers (clients des artisans) : on adapte la présentation de l'app
  const who = body.audience === 'client'
    ? "Tu parles à un particulier, client d'artisans, qui utilise gratuitement l'espace client d'Artis & You (trouver un artisan, demander un rendez-vous, signer ses devis, payer ses factures, suivre ses chantiers, écrire à ses artisans). Ce n'est pas un artisan : ne parle jamais de créer des devis ou des factures."
    : "Tu parles à un artisan ou à son équipe (logiciel pour artisans du bâtiment : devis, factures, planning, clients, réseau de pros).";
  const system = `Tu es l'assistant de l'application Artis & You. ${who}
Réponds dans la langue de la question de l'utilisateur (français par défaut), de façon courte (3 à 5 phrases maximum), concrète, et vouvoie l'utilisateur.
Appuie-toi UNIQUEMENT sur les fiches d'aide ci-dessous. Si elles ne permettent pas de répondre, dis-le simplement et propose de contacter le support (Paramètres › Aide et support). N'invente jamais de fonctionnalité, de prix ni de chemin de menu.
Écris en texte simple : pas de Markdown, pas d'astérisques, pas de titres. Tu ne peux faire aucune action toi-même (envoyer un message, créer un document) : ne dis jamais qu'une action a été faite ou qu'une notification sera envoyée.
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

function admin0(url: string) { return createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!); }
async function useQuota(admin: any, uid: string) {
  const day = new Date().toISOString().slice(0, 10);
  const { data: row } = await admin.from('assistant_usage').select('count').eq('user_id', uid).eq('day', day).maybeSingle();
  if ((row?.count || 0) >= DAILY) return false;
  await admin.from('assistant_usage').upsert({ user_id: uid, day, count: (row?.count || 0) + 1 });
  return true;
}
const VISION = ['qwen/qwen3.8-27b'];
async function photoMode(body: any, uid: string, admin: any, key: string, json: (b: unknown, s?: number) => Response) {
  const trades: string[] = (Array.isArray(body.trades) ? body.trades : []).map((x: any) => String(x).slice(0, 60)).filter(Boolean).slice(0, 120);
  const text = String(body.text || '').slice(0, 500).trim();
  const image = typeof body.image === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(body.image) && body.image.length < 1_500_000 ? body.image : '';
  if (!image && !text) return json({ error: 'empty' }, 400);
  if (!trades.length) return json({ error: 'trades' }, 400);
  if (!(await useQuota(admin, uid))) return json({ error: 'quota' }, 429);
  const system = `Tu aides un particulier à trouver le bon artisan. À partir de la photo et/ou de sa description, choisis le métier le plus adapté dans cette liste exacte : ${trades.join(' | ')}.
Réponds UNIQUEMENT en JSON : {"trade": "<un métier de la liste>", "besoin": "<description courte et neutre du problème visible, 15 mots max, en français>", "urgent": <true si fuite d'eau, gaz, panne électrique, porte bloquée ou danger, sinon false>, "confidence": <0 à 1>}.
Si tu ne peux pas savoir, mets "trade": "" et confidence 0. Ne donne aucun diagnostic de sécurité ni de prix.`;
  const content: any[] = [{ type: 'text', text: text ? 'Description du particulier : ' + text : 'Voici la photo du problème.' }];
  if (image) content.push({ type: 'image_url', image_url: { url: image } });
  const tries: any[] = image ? VISION.map((m) => [m, content]) : [];
  tries.push(...(text ? MODELS.map((m) => [m, content[0].text]) : []));
  for (const [model, c] of tries) {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, temperature: 0.1, max_tokens: 200, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: c }] }),
    }).catch(() => null);
    if (!r || !r.ok) continue;
    const d = await r.json().catch(() => null);
    let out: any = null; try { out = JSON.parse(d?.choices?.[0]?.message?.content || ''); } catch { continue; }
    const trade = trades.find((x) => x.toLowerCase() === String(out?.trade || '').toLowerCase()) || '';
    return json({ trade, besoin: String(out?.besoin || '').slice(0, 160), urgent: !!out?.urgent, confidence: Math.max(0, Math.min(1, Number(out?.confidence) || 0)), model, used_image: Array.isArray(c) });
  }
  return json({ error: 'ai_unavailable' }, 502);
}
