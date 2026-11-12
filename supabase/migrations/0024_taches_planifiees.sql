-- 0024 : tâches quotidiennes côté serveur (pg_cron), sans que personne n'ouvre l'application.
--   1) 18 h (Paris) : rappel des rendez-vous du lendemain, au particulier et aux artisans concernés.
--   2) 8 h  (Paris) : relances automatiques (factures impayées, devis sans réponse) dans la messagerie,
--      pour les entreprises qui ont coché « automatique » dans Paramètres › Relances.
-- Les notifications créées déclenchent le push existant (trigger notifications_push).
-- Les fonctions vivent dans le schéma private : aucun utilisateur ne peut les appeler.

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

-- Formats français ------------------------------------------------------------------------------------------------
create or replace function private.fmt_money(n numeric) returns text language sql immutable as $$
  select replace(replace(to_char(coalesce(n, 0), 'FM999G999G999G990D00'), ',', ' '), '.', ',') || ' €'
$$;
create or replace function private.fmt_date(d date) returns text language sql immutable as $$
  select to_char(d, 'DD/MM/YYYY')
$$;

-- 1) Rappel de RDV la veille ---------------------------------------------------------------------------------------
create or replace function private.remind_tomorrow_appointments() returns int
language plpgsql security definer set search_path = public, private as $$
declare a record; n int := 0; d_from timestamptz; d_to timestamptz; when_txt text; cli_uid uuid; co_name text;
begin
  d_from := ((now() at time zone 'Europe/Paris')::date + 1)::timestamp at time zone 'Europe/Paris';
  d_to := d_from + interval '1 day';
  for a in
    select ap.*, c.user_id as client_uid, co.trade_name, co.name as co_name
    from public.appointments ap
    join public.companies co on co.id = ap.company_id
    left join public.clients c on c.id = ap.client_id
    where ap.status = 'valide' and not coalesce(ap.personal, false)
      and ap.start_at >= d_from and ap.start_at < d_to
  loop
    when_txt := 'Demain ' || to_char(a.start_at at time zone 'Europe/Paris', 'HH24"h"MI') || ' · ' || coalesce(nullif(a.title, ''), a.type, 'Rendez-vous');
    co_name := coalesce(nullif(a.trade_name, ''), a.co_name, '');
    -- Le particulier (s'il a un compte)
    if a.client_uid is not null and not exists (
      select 1 from public.notifications where user_id = a.client_uid and category = 'rdv' and title = 'Rappel : rendez-vous demain' and link = '/client/rdv/' || a.id
    ) then
      insert into public.notifications(user_id, category, title, body, link)
      values (a.client_uid, 'rdv', 'Rappel : rendez-vous demain', when_txt || case when co_name <> '' then ' avec ' || co_name else '' end
        || case when coalesce(a.address, '') <> '' then ' · ' || a.address else '' end, '/client/rdv/' || a.id);
      n := n + 1;
    end if;
    -- Les artisans : l'équipe concernée (ou tout le monde s'il n'y a pas d'équipe) et les gérants
    insert into public.notifications(user_id, category, title, body, link)
    select p.id, 'rdv', 'Rappel : rendez-vous demain',
      when_txt || case when coalesce(a.contact_name, '') <> '' then ' · ' || a.contact_name else '' end
        || case when coalesce(a.address, '') <> '' then ' · ' || a.address else '' end,
      '/pro/planning/rdv/' || a.id
    from public.profiles p
    where p.company_id = a.company_id
      and (a.team_id is null or p.team_id = a.team_id or p.member_role = 'gerant')
      and not exists (select 1 from public.notifications x where x.user_id = p.id and x.category = 'rdv' and title = 'Rappel : rendez-vous demain' and x.link = '/pro/planning/rdv/' || a.id);
  end loop;
  return n;
end $$;

-- 2) Relances automatiques ---------------------------------------------------------------------------------------
-- Même logique que web/src/lib/relances.js (dueReminders + sendReminder, canal messagerie). À garder synchronisé.
create or replace function private.default_scenarios() returns jsonb language sql immutable as $$
  select '{
    "facture": [
      {"id":"f0","on":true,"days":-3,"title":"Rappel avant échéance","text":"Bonjour {client},\n\nPetit rappel : la facture {numero} de {montant} arrive à échéance le {echeance}.\nVous pouvez la régler par virement (IBAN {iban}, référence {numero}).\n\nBonne journée,\n{entreprise}"},
      {"id":"f1","on":true,"days":1,"title":"Première relance","text":"Bonjour {client},\n\nSauf erreur de notre part, la facture {numero} de {montant}, échue le {echeance}, reste à régler ({reste} restant).\nSi le paiement est déjà parti, merci de ne pas tenir compte de ce message.\n\nCordialement,\n{entreprise}"},
      {"id":"f2","on":true,"days":8,"title":"Deuxième relance","text":"Bonjour {client},\n\nMalgré notre précédent message, la facture {numero} ({reste} restant) n’est toujours pas réglée alors qu’elle était due le {echeance}.\nMerci de procéder au règlement sous 8 jours.\n\nCordialement,\n{entreprise}"},
      {"id":"f3","on":false,"days":20,"title":"Dernière relance avant mise en demeure","text":"Bonjour {client},\n\nLa facture {numero} ({reste} restant, échue le {echeance}) demeure impayée malgré nos relances.\nSans règlement sous 8 jours, nous serons contraints d’engager une procédure de recouvrement.\n\n{entreprise}"}
    ],
    "devis": [
      {"id":"d1","on":true,"days":7,"title":"Suivi du devis","text":"Bonjour {client},\n\nAvez-vous pu consulter notre devis {numero} ({montant}) ? Je reste disponible pour en parler ou l’ajuster si besoin.\n\nBonne journée,\n{entreprise}"},
      {"id":"d2","on":true,"days":21,"title":"Dernier rappel du devis","text":"Bonjour {client},\n\nNotre devis {numero} est valable jusqu’au {validite}. Souhaitez-vous que nous planifiions les travaux ?\n\nCordialement,\n{entreprise}"}
    ]
  }'::jsonb
$$;

create or replace function private.send_auto_reminders() returns int
language plpgsql security definer set search_path = public, private as $$
declare co record; d record; cl record; today date; sc jsonb; steps jsonb; step jsonb; ref date; late int; sent jsonb;
        remaining numeric; conv_id uuid; body text; title text; sub text; n int := 0; who text;
begin
  today := (now() at time zone 'Europe/Paris')::date;
  for co in select * from public.companies where coalesce(settings->'relances'->>'auto', 'false') = 'true' and archived_at is null loop
    sc := jsonb_build_object(
      'facture', coalesce(co.settings->'relances'->'facture', private.default_scenarios()->'facture'),
      'devis', coalesce(co.settings->'relances'->'devis', private.default_scenarios()->'devis'));
    for d in select * from public.documents where company_id = co.id and number is not null and status <> 'annulee' and not coalesce(reminders_paused, false) loop
      remaining := greatest(0, coalesce((d.totals->>'net')::numeric, (d.totals->>'ttc')::numeric, 0) - coalesce(d.paid_amount, 0));
      if d.kind in ('facture', 'acompte') and remaining > 0.005 and d.due_date is not null then steps := sc->'facture'; ref := d.due_date;
      elsif d.kind = 'devis' and d.status = 'envoye' then steps := sc->'devis'; ref := coalesce((d.sent_at at time zone 'Europe/Paris')::date, d.issue_date);
      else continue; end if;
      if ref is null then continue; end if;
      late := today - ref;
      sent := coalesce(d.reminders, '[]'::jsonb);
      -- la plus récente des étapes échues pas encore envoyées (pas de rafale)
      select s into step from jsonb_array_elements(steps) s
        where (s->>'on')::boolean and late >= (s->>'days')::int
          and not exists (select 1 from jsonb_array_elements(sent) r where r->>'step' = s->>'id')
        order by (s->>'days')::int desc limit 1;
      if step is null then continue; end if;
      select * into cl from public.clients where id = d.client_id;
      if cl.user_id is null then continue; end if; -- messagerie uniquement : le client doit avoir un compte
      who := case when cl.type = 'pro' then coalesce(nullif(cl.contact_name, ''), nullif(cl.trade_name, ''), nullif(cl.company_name, ''), trim(cl.first_name || ' ' || cl.last_name))
                  else coalesce(nullif(trim(coalesce(cl.civility, '') || ' ' || coalesce(cl.last_name, '')), ''), trim(cl.first_name || ' ' || cl.last_name)) end;
      body := step->>'text';
      body := replace(body, '{client}', coalesce(who, ''));
      body := replace(body, '{numero}', coalesce(d.number, ''));
      body := replace(body, '{montant}', private.fmt_money((d.totals->>'ttc')::numeric));
      body := replace(body, '{reste}', private.fmt_money(remaining));
      body := replace(body, '{echeance}', coalesce(private.fmt_date(d.due_date), ''));
      body := replace(body, '{validite}', private.fmt_date(coalesce(d.issue_date, today) + coalesce(d.validity_days, 30)));
      body := replace(body, '{entreprise}', coalesce(nullif(co.trade_name, ''), co.name, ''));
      body := replace(body, '{iban}', coalesce(nullif(co.iban, ''), '—'));
      title := step->>'title';
      sub := case when d.kind = 'devis' then private.fmt_money((d.totals->>'ttc')::numeric) else private.fmt_money(remaining) || ' restant' end;
      select id into conv_id from public.conversations where kind = 'client' and company_id = co.id and client_id = cl.id limit 1;
      if conv_id is null then
        insert into public.conversations(kind, company_id, client_id, client_user_id) values ('client', co.id, cl.id, cl.user_id) returning id into conv_id;
      end if;
      insert into public.messages(conversation_id, sender_id, sender_name, sender_company_id, body, card)
      values (conv_id, co.owner_id, coalesce(nullif(co.trade_name, ''), co.name), co.id, body,
        jsonb_build_object('type', 'relance', 'title', title || ' · ' || d.number, 'sub', sub));
      -- les étapes plus anciennes jamais envoyées sont marquées « passées » : on ne les enverra pas après coup
      update public.documents set reminders = sent
        || coalesce((select jsonb_agg(jsonb_build_object('step', s->>'id', 'title', s->>'title', 'at', now(), 'skipped', true))
                     from jsonb_array_elements(steps) s
                     where (s->>'days')::int < (step->>'days')::int
                       and not exists (select 1 from jsonb_array_elements(sent) r where r->>'step' = s->>'id')), '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object('step', step->>'id', 'title', title, 'at', now(), 'channel', 'app', 'by', co.owner_id, 'auto', true))
        where id = d.id;
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;

revoke all on function private.remind_tomorrow_appointments() from public;
revoke all on function private.send_auto_reminders() from public;

-- Planification (heures UTC : 17 h UTC = 18 h Paris en hiver / 19 h en été ; 7 h UTC = 8 h / 9 h)
select cron.unschedule(jobname) from cron.job where jobname in ('artesa_rappel_rdv', 'artesa_relances');
select cron.schedule('artesa_rappel_rdv', '0 17 * * *', $$select private.remind_tomorrow_appointments()$$);
select cron.schedule('artesa_relances', '0 7 * * *', $$select private.send_auto_reminders()$$);

-- 3) Quota d'e-mails envoyés par la fonction `mail` (Resend) : table interne, écrite par la fonction (service_role)
create table if not exists public.mail_usage (company_id uuid not null references public.companies(id) on delete cascade, day date not null, count int not null default 0, primary key (company_id, day));
alter table public.mail_usage enable row level security;
revoke all on public.mail_usage from anon, authenticated;

-- 4) Clé primaire manquante sur les tentatives d'invitation (dernier avertissement Supabase)
alter table private.invite_attempts add column if not exists id bigint generated always as identity;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'private.invite_attempts'::regclass and contype = 'p') then
    alter table private.invite_attempts add primary key (id);
  end if;
end $$;
