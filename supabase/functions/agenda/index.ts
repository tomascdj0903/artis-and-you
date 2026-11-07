// Flux d'agenda (.ics) par abonnement : l'artisan colle ce lien UNE fois dans Google Agenda, Outlook ou le Calendrier
// de l'iPhone, qui le relit tout seul régulièrement (comme l'emploi du temps de l'université).
// URL : https://<projet>.supabase.co/functions/v1/agenda?token=<companies.calendar_token>[&team=<id>]
// Déploiement : supabase functions deploy agenda --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const f = (d: string | Date) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s = '') => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\;');
const RR: Record<string, string> = { weekly: 'FREQ=WEEKLY', monthly: 'FREQ=MONTHLY', yearly: 'FREQ=YEARLY' };

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';
  if (!/^[a-f0-9]{32,64}$/.test(token)) return new Response('Lien invalide', { status: 404 });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: co } = await db.from('companies').select('id,name,trade_name').eq('calendar_token', token).maybeSingle();
  if (!co) return new Response('Lien invalide ou révoqué', { status: 404 });
  const since = new Date(Date.now() - 90 * 864e5).toISOString();
  let q = db.from('appointments').select('id,title,type,start_at,end_at,address,mode,status,recurrence,team_id,client_id,contact_name,contact_phone,created_at')
    .eq('company_id', co.id).in('status', ['valide', 'a_valider', 'termine']).gte('end_at', since).order('start_at').limit(2000);
  const team = url.searchParams.get('team'); if (team) q = q.eq('team_id', team);
  const { data: ap } = await q;
  const ids = [...new Set((ap || []).map((a) => a.client_id).filter(Boolean))];
  const { data: cl } = ids.length ? await db.from('clients').select('id,type,first_name,last_name,company_name').in('id', ids) : { data: [] };
  const name = (c: any) => (c ? (c.type === 'pro' ? c.company_name : [c.first_name, c.last_name].filter(Boolean).join(' ')) : '');
  const cm = Object.fromEntries((cl || []).map((c: any) => [c.id, c]));
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Artis & You//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:' + esc('Artis & You · ' + (co.trade_name || co.name)), 'X-WR-TIMEZONE:Europe/Paris', 'REFRESH-INTERVAL;VALUE=DURATION:PT15M', 'X-PUBLISHED-TTL:PT15M'];
  for (const a of ap || []) {
    const who = name(cm[a.client_id]);
    L.push('BEGIN:VEVENT', 'UID:' + a.id + '@artisandyou', 'DTSTAMP:' + f(new Date()), 'DTSTART:' + f(a.start_at), 'DTEND:' + f(a.end_at),
      'SUMMARY:' + esc((a.status === 'a_valider' ? '[À valider] ' : '') + (a.title || a.type) + (who ? ' · ' + who : '')),
      'STATUS:' + (a.status === 'a_valider' ? 'TENTATIVE' : 'CONFIRMED'));
    if (a.mode === 'visio') L.push('LOCATION:Visio WhatsApp'); else if (a.address) L.push('LOCATION:' + esc(a.address));
    const desc = [a.contact_name && 'Contact : ' + a.contact_name, a.contact_phone && 'Tél. : ' + a.contact_phone, 'Ouvrir dans Artis & You : https://artis-and-you.vercel.app/pro/planning/rdv/' + a.id].filter(Boolean).join('\n');
    L.push('DESCRIPTION:' + esc(desc));
    if (RR[a.recurrence]) L.push('RRULE:' + RR[a.recurrence]);
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return new Response(L.join('\r\n'), { headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'no-cache' } });
});
