-- 0027 · Conformité légale
--  1. Droit de rétractation des particuliers sur les devis signés en ligne (Code conso L221-18, L221-21, L221-25)
--     + « bouton de rétractation » en ligne avec accusé de réception (ordonnance 2026-2, applicable depuis le 19/06/2026)
--  2. Signalement de contenus illicites (règlement UE 2022/2065 « DSA », art. 16 et 17)
--  3. Motif de refus des avis communiqué à l'auteur (Code conso L111-7-2, D111-17 ; DSA art. 17)
-- Migration additive : aucune donnée existante n'est modifiée ni supprimée.

-- ─────────── 1. Rétractation ───────────
-- La signature enregistre désormais si le client est un particulier, la date limite de rétractation
-- et sa demande éventuelle de commencer les travaux avant la fin du délai.
drop function if exists public.client_quote_sign(uuid, text, text, text);
create or replace function public.client_quote_sign(p_id uuid, p_name text, p_image text default '', p_agent text default '', p_start_early boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare d public.documents; h text; consumer boolean;
begin
  select * into d from public.documents where id = p_id and kind = 'devis' and number is not null and client_id in (select public.my_client_ids());
  if d is null then raise exception 'Devis introuvable'; end if;
  if d.status <> 'envoye' then raise exception 'Ce devis ne peut plus être signé.'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'Indiquez votre nom.'; end if;
  select coalesce(c.type,'particulier') = 'particulier' into consumer from public.clients c where c.id = d.client_id;
  h := encode(extensions.digest(coalesce(d.number,'') || d.lines::text || d.totals::text, 'sha256'), 'hex');
  update public.documents set status = 'accepte', accepted_at = now(), signed_name = trim(p_name),
    conditions = coalesce(conditions,'{}'::jsonb)
      || jsonb_build_object('signature', jsonb_build_object(
           'image', left(coalesce(p_image,''), 200000), 'at', now(), 'by', auth.uid(), 'hash', h, 'agent', left(coalesce(p_agent,''), 300), 'mention', 'Bon pour accord'))
      || case when consumer then jsonb_build_object('retractation', jsonb_build_object(
           'applicable', true, 'until', (date_trunc('day', now() at time zone 'Europe/Paris') + interval '15 days' - interval '1 second') at time zone 'Europe/Paris',
           'start_early', coalesce(p_start_early,false), 'informed_at', now())) else '{}'::jsonb end
  where id = p_id;
  perform public.notify_company(d.company_id, 'documents', 'Devis signé', d.number || ' · ' || trim(p_name)
    || case when consumer and not coalesce(p_start_early,false) then ' · délai de rétractation de 14 jours en cours' when consumer then ' · le client demande à commencer avant 14 jours' else '' end,
    '/pro/documents/' || p_id);
end $$;
revoke execute on function public.client_quote_sign(uuid, text, text, text, boolean) from public, anon;
grant execute on function public.client_quote_sign(uuid, text, text, text, boolean) to authenticated;

-- Le client particulier renonce au devis signé, dans le délai, en deux clics ; il reçoit un accusé de réception.
create or replace function public.client_quote_withdraw(p_id uuid, p_reason text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare d public.documents; r jsonb; ack jsonb; uid uuid := auth.uid();
begin
  select * into d from public.documents where id = p_id and kind = 'devis' and client_id in (select public.my_client_ids());
  if d is null then raise exception 'Devis introuvable'; end if;
  r := d.conditions->'retractation';
  if d.status <> 'accepte' or r is null or not coalesce((r->>'applicable')::boolean, false) then raise exception 'Ce devis ne peut pas faire l''objet d''une rétractation en ligne.'; end if;
  if now() > (r->>'until')::timestamptz then raise exception 'Le délai de rétractation de 14 jours est dépassé.'; end if;
  ack := jsonb_build_object('at', now(), 'by', uid, 'reason', left(coalesce(p_reason,''), 500), 'number', d.number);
  update public.documents set status = 'retracte',
    conditions = jsonb_set(coalesce(conditions,'{}'::jsonb), '{retractation}', r || jsonb_build_object('withdrawn_at', now(), 'reason', left(coalesce(p_reason,''), 500)))
  where id = p_id;
  perform public.notify_company(d.company_id, 'documents', 'Rétractation du client', d.number || ' : le client a exercé son droit de rétractation.', '/pro/documents/' || p_id);
  insert into public.notifications(user_id, category, title, body, link)
    values (uid, 'documents', 'Accusé de réception de votre rétractation',
      'Votre rétractation du devis ' || coalesce(d.number,'') || ' a bien été enregistrée le ' || to_char(now() at time zone 'Europe/Paris', 'DD/MM/YYYY à HH24:MI') || '. L''artisan doit vous rembourser les sommes versées au plus tard 14 jours après cette date.',
      '/client/documents/' || p_id);
  return ack;
end $$;
revoke execute on function public.client_quote_withdraw(uuid, text) from public, anon;
grant execute on function public.client_quote_withdraw(uuid, text) to authenticated;

-- ─────────── 2. Signalements (DSA) ───────────
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  reporter_name text default '',
  reporter_email text default '',
  target_type text not null check (target_type in ('avis','fiche','message','photo','autre')),
  target_id text default '',
  target_url text default '',
  reason text not null check (reason in ('illicite','injure','fraude','vie_privee','droit_auteur','faux_avis','autre')),
  explanation text not null,
  good_faith boolean not null default false,
  status text not null default 'recu' check (status in ('recu','retire','rejete')),
  decision text default '',
  decided_at timestamptz,
  created_at timestamptz default now()
);
alter table public.content_reports enable row level security;
create policy content_reports_own_sel on public.content_reports for select using (reporter_id = auth.uid() or public.is_admin());
create policy content_reports_admin_upd on public.content_reports for update using (public.is_admin());

create or replace function public.report_content(p_type text, p_target text, p_url text, p_reason text, p_explanation text, p_name text default '', p_email text default '', p_good_faith boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  if not coalesce(p_good_faith,false) then raise exception 'Merci de confirmer que votre signalement est fait de bonne foi.'; end if;
  if length(coalesce(trim(p_explanation),'')) < 10 then raise exception 'Expliquez en quelques mots pourquoi ce contenu pose problème.'; end if;
  if auth.uid() is null and coalesce(trim(p_email),'') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Indiquez votre e-mail pour recevoir notre réponse.'; end if;
  if (select count(*) from public.content_reports where (reporter_id = auth.uid() or (auth.uid() is null and reporter_email = p_email)) and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Trop de signalements en peu de temps, réessayez plus tard.'; end if;
  insert into public.content_reports(reporter_id, reporter_name, reporter_email, target_type, target_id, target_url, reason, explanation, good_faith)
  values (auth.uid(), left(coalesce(p_name,''),120), left(coalesce(p_email,''),200), p_type, left(coalesce(p_target,''),100), left(coalesce(p_url,''),500), p_reason, left(p_explanation, 4000), true)
  returning id into rid;
  if auth.uid() is not null then
    insert into public.notifications(user_id, category, title, body, link)
    values (auth.uid(), 'systeme', 'Signalement reçu', 'Nous avons bien reçu votre signalement. Vous recevrez notre décision motivée.', '');
  end if;
  return rid;
end $$;
grant execute on function public.report_content(text, text, text, text, text, text, text, boolean) to anon, authenticated;

create or replace function public.admin_decide_report(p_id uuid, p_status text, p_decision text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.content_reports;
begin
  if not public.is_admin() then raise exception 'Réservé à l''équipe Artesa'; end if;
  if p_status not in ('retire','rejete') or coalesce(trim(p_decision),'') = '' then raise exception 'Indiquez la décision et son motif.'; end if;
  update public.content_reports set status = p_status, decision = trim(p_decision), decided_at = now() where id = p_id returning * into r;
  if r.reporter_id is not null then
    insert into public.notifications(user_id, category, title, body, link)
    values (r.reporter_id, 'systeme', case when p_status = 'retire' then 'Contenu retiré suite à votre signalement' else 'Signalement examiné : contenu maintenu' end, trim(p_decision), '');
  end if;
end $$;
revoke execute on function public.admin_decide_report(uuid, text, text) from public, anon;
grant execute on function public.admin_decide_report(uuid, text, text) to authenticated;

-- ─────────── 3. Avis : motif du refus ───────────
alter table public.reviews add column if not exists refusal_reason text;
alter table public.reviews add column if not exists decided_at timestamptz;

create or replace function public.admin_moderate_review(p_id uuid, p_status text, p_reason text default '')
returns void language plpgsql security definer set search_path = public as $$
declare r public.reviews;
begin
  if not public.is_admin() then raise exception 'Réservé à l''équipe Artesa'; end if;
  if p_status not in ('publie','refuse') then raise exception 'Statut inconnu'; end if;
  if p_status = 'refuse' and coalesce(trim(p_reason),'') = '' then raise exception 'Indiquez le motif du refus.'; end if;
  update public.reviews set status = p_status, refusal_reason = nullif(trim(coalesce(p_reason,'')),''), decided_at = now() where id = p_id returning * into r;
  if r.author_id is not null then
    insert into public.notifications(user_id, category, title, body, link)
    values (r.author_id, 'systeme', case when p_status = 'publie' then 'Votre avis est publié' else 'Votre avis n''a pas été publié' end,
      case when p_status = 'publie' then 'Merci pour votre avis !' else 'Motif : ' || trim(p_reason) || '. Vous pouvez contester cette décision en écrivant à support@artisandyou.fr.' end, '');
  end if;
end $$;
revoke execute on function public.admin_moderate_review(uuid, text, text) from public, anon;
grant execute on function public.admin_moderate_review(uuid, text, text) to authenticated;
