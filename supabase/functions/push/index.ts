// Envoie une notification push (Web Push) sur les appareils de l'utilisateur à chaque nouvelle notification
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok');
  const { id } = await req.json().catch(() => ({}));
  if (!id) return new Response('missing id', { status: 400 });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: p, error } = await db.rpc('push_payload', { p_id: id });
  if (error || !p) return new Response('not found', { status: 404 });
  if (req.headers.get('x-push-secret') !== p.secret) return new Response('forbidden', { status: 403 });
  if (!p.n || !p.subs?.length) return new Response('no subs');
  webpush.setVapidDetails('mailto:contact@artisandyou.fr', p.vapid_public, p.vapid_private);
  const payload = JSON.stringify({ title: p.n.title, body: p.n.body || '', link: p.n.link || '/', tag: p.n.id });
  let sent = 0;
  for (const s of p.subs) {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 }); sent++; }
    catch (e) { if (e?.statusCode === 404 || e?.statusCode === 410) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint); }
  }
  return new Response(JSON.stringify({ sent }), { headers: { 'content-type': 'application/json' } });
});
