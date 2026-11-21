-- (appliquée en prod) Devis signé à deux, statistiques de fiche, demande d'avis auto, suivi des erreurs, modération des photos
-- 1) Devis signé à deux (couple, indivision) : 2e signataire sur le même appareil
drop function if exists public.client_quote_sign(uuid, text, text, text, boolean);
create or replace function public.client_quote_sign(p_id uuid, p_name text, p_image text default '', p_agent text default '', p_start_early boolean default false, p_cosigner jsonb default null)
 returns void language plpgsql security definer set search_path to 'public' as $function$
declare d public.documents; h text; consumer boolean; co_name text; co jsonb := '{}'::jsonb;
begin
  select * into d from public.documents where id = p_id and kind = 'devis' and number is not null and client_id in (select public.my_client_ids());
  if d is null then raise exception 'Devis introuvable'; end if;
  if d.status <> 'envoye' then raise exception 'Ce devis ne peut plus être signé.'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'Indiquez votre nom.'; end if;
  co_name := nullif(trim(coalesce(p_cosigner->>'name', '')), '');
  if p_cosigner is not null and co_name is null then raise exception 'Indiquez le nom de la deuxième personne qui signe.'; end if;
  if co_name is not null then co := jsonb_build_object('cosigner', jsonb_build_object('name', left(co_name, 120), 'image', left(coalesce(p_cosigner->>'image',''), 200000), 'at', now())); end if;
  select coalesce(c.type,'particulier') = 'particulier' into consumer from public.clients c where c.id = d.client_id;
  h := encode(extensions.digest(coalesce(d.number,'') || d.lines::text || d.totals::text, 'sha256'), 'hex');
  update public.documents set status = 'accepte', accepted_at = now(), signed_name = trim(p_name) || coalesce(' et ' || co_name, ''),
    conditions = coalesce(conditions,'{}'::jsonb)
      || jsonb_build_object('signature', jsonb_build_object(
           'image', left(coalesce(p_image,''), 200000), 'at', now(), 'by', auth.uid(), 'hash', h, 'agent', left(coalesce(p_agent,''), 300), 'mention', 'Bon pour accord') || co)
      || case when consumer then jsonb_build_object('retractation', jsonb_build_object(
           'applicable', true, 'until', (date_trunc('day', now() at time zone 'Europe/Paris') + interval '15 days' - interval '1 second') at time zone 'Europe/Paris',
           'start_early', coalesce(p_start_early,false), 'informed_at', now())) else '{}'::jsonb end
  where id = p_id;
  perform public.notify_company(d.company_id, 'documents', 'Devis signé', d.number || ' · ' || trim(p_name) || coalesce(' et ' || co_name, '')
    || case when consumer and not coalesce(p_start_early,false) then ' · délai de rétractation de 14 jours en cours' when consumer then ' · le client demande à commencer avant 14 jours' else '' end,
    '/pro/documents/' || p_id);
end $function$;
grant execute on function public.client_quote_sign(uuid, text, text, text, boolean, jsonb) to authenticated;

-- 2) Statistiques de la fiche artisan (vues, appels, partages) par jour
create table if not exists public.profile_stats (company_id uuid references public.companies(id) on delete cascade, day date not null default current_date,
  views int not null default 0, calls int not null default 0, shares int not null default 0, primary key (company_id, day));
alter table public.profile_stats enable row level security;
drop policy if exists profile_stats_company on public.profile_stats;
create policy profile_stats_company on public.profile_stats for select to authenticated using (company_id = (select public.my_company()) or (select public.is_admin()));
create or replace function public.track_profile(p_company uuid, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_kind not in ('view','call','share') then return; end if;
  if exists (select 1 from public.companies where id = p_company and owner_id = auth.uid()) or public.my_company() = p_company then return; end if;
  insert into public.profile_stats(company_id, day, views, calls, shares)
  values (p_company, (now() at time zone 'Europe/Paris')::date, (p_kind = 'view')::int, (p_kind = 'call')::int, (p_kind = 'share')::int)
  on conflict (company_id, day) do update set views = profile_stats.views + excluded.views, calls = profile_stats.calls + excluded.calls, shares = profile_stats.shares + excluded.shares;
end $$;
grant execute on function public.track_profile(uuid, text) to authenticated;
create or replace function public.my_profile_stats(p_days int default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.my_company() is null then null else jsonb_build_object(
    'views', coalesce((select sum(views) from public.profile_stats where company_id = public.my_company() and day > current_date - p_days), 0),
    'calls', coalesce((select sum(calls) from public.profile_stats where company_id = public.my_company() and day > current_date - p_days), 0),
    'shares', coalesce((select sum(shares) from public.profile_stats where company_id = public.my_company() and day > current_date - p_days), 0),
    'requests', (select count(*) from public.appointments where company_id = public.my_company() and requested_by is not null and created_at > now() - make_interval(days => p_days)),
    'answered', (select count(*) from public.appointments where company_id = public.my_company() and requested_by is not null and created_at > now() - make_interval(days => p_days) and (status <> 'a_valider' or proposed_start_at is not null)),
    'favorites', (select count(*) from public.client_favorites where company_id = public.my_company()),
    'response_minutes', public.company_response_minutes(public.my_company()),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'views', views, 'calls', calls) order by day) from public.profile_stats where company_id = public.my_company() and day > current_date - p_days), '[]'::jsonb)) end
$$;
grant execute on function public.my_profile_stats(int) to authenticated;

-- 3) Demande d'avis automatique 3 jours après une facture réglée (si l'artisan ne l'a pas désactivée)
create or replace function private.review_requests() returns int
language plpgsql security definer set search_path to 'public', 'private' as $$
declare r record; n int := 0;
begin
  for r in select distinct on (cl.user_id, d.company_id) cl.user_id, d.company_id, coalesce(nullif(co.trade_name,''), co.name) cname
           from public.documents d join public.clients cl on cl.id = d.client_id join public.companies co on co.id = d.company_id
           where d.kind = 'facture' and d.status = 'payee' and cl.user_id is not null and coalesce((co.settings->'reviews'->>'auto')::boolean, true)
             and (select max(p.paid_on) from public.payments p where p.document_id = d.id) between current_date - 30 and current_date - 3
             and not exists (select 1 from public.reviews rv where rv.company_id = d.company_id and rv.author_id = cl.user_id)
             and not exists (select 1 from public.notifications nt where nt.user_id = cl.user_id and nt.link = '/client/avis/' || d.company_id)
  loop
    insert into public.notifications(user_id, category, title, body, link)
    values (r.user_id, 'documents', 'Votre avis compte', 'Comment s''est passée l''intervention de ' || r.cname || ' ? Votre avis aide les autres particuliers.', '/client/avis/' || r.company_id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function private.review_requests() from public, anon, authenticated;
select cron.unschedule('artisandyou_avis') where exists (select 1 from cron.job where jobname = 'artisandyou_avis');
select cron.schedule('artisandyou_avis', '0 16 * * *', 'select private.review_requests()');

-- 4) Suivi des erreurs de l'application (regroupées par message + page)
create table if not exists public.app_errors (id uuid primary key default gen_random_uuid(), user_id uuid, path text, message text not null, stack text, agent text,
  count int not null default 1, first_at timestamptz not null default now(), last_at timestamptz not null default now(), resolved boolean not null default false);
create index if not exists app_errors_last on public.app_errors(last_at desc);
alter table public.app_errors enable row level security;
drop policy if exists app_errors_admin on public.app_errors;
create policy app_errors_admin on public.app_errors for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create or replace function public.log_client_error(p_message text, p_path text default '', p_stack text default '', p_agent text default '') returns void
language plpgsql security definer set search_path = public as $$
declare e uuid; m text := left(coalesce(p_message, ''), 500); pth text := left(regexp_replace(coalesce(p_path, ''), '[0-9a-f]{8}-[0-9a-f-]{27,}', ':id', 'g'), 200);
begin
  if m = '' then return; end if;
  select id into e from public.app_errors where message = m and path = pth and not resolved and last_at > now() - interval '7 days' limit 1;
  if e is not null then update public.app_errors set count = count + 1, last_at = now() where id = e and count < 100000; return; end if;
  if (select count(*) from public.app_errors where first_at > now() - interval '1 hour') > 200 then return; end if;
  insert into public.app_errors(user_id, path, message, stack, agent) values (auth.uid(), pth, m, left(coalesce(p_stack, ''), 4000), left(coalesce(p_agent, ''), 300));
end $$;
grant execute on function public.log_client_error(text, text, text, text) to anon, authenticated;

-- 5) Modération : l'équipe voit les photos de chantier ; dernières photos publiées (avis + chantiers)
drop policy if exists project_step_photos_read on storage.objects;
create policy project_step_photos_read on storage.objects for select to authenticated using (
  bucket_id = 'files' and (storage.foldername(name))[2] = 'chantier' and (public.is_admin() or exists (
    select 1 from public.project_steps st join public.projects p on p.id = st.project_id
    where st.photos @> jsonb_build_array(objects.name) and p.client_id in (select public.my_client_ids()))));
drop policy if exists project_steps_admin on public.project_steps;
create policy project_steps_admin on public.project_steps for select to authenticated using ((select public.is_admin()));
create or replace function public.admin_recent_photos(p_limit int default 60) returns table(kind text, ref uuid, company_id uuid, company text, title text, status text, path text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select * from (
    select 'avis'::text, r.id, r.company_id, coalesce(nullif(c.trade_name,''), c.name), left(coalesce(r.comment,''), 80), r.status, ph, r.created_at
      from public.reviews r join public.companies c on c.id = r.company_id, jsonb_array_elements_text(r.photos) ph
    union all
    select 'chantier', s.id, s.company_id, coalesce(nullif(c.trade_name,''), c.name), s.title, s.status, ph, s.created_at
      from public.project_steps s join public.companies c on c.id = s.company_id, jsonb_array_elements_text(s.photos) ph
  ) x where public.is_admin() order by 8 desc limit greatest(1, least(p_limit, 200))
$$;
grant execute on function public.admin_recent_photos(int) to authenticated;
create or replace function public.admin_remove_photo(p_kind text, p_ref uuid, p_path text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l''équipe'; end if;
  if p_kind = 'avis' then update public.reviews set photos = (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements_text(photos) x where x <> p_path) where id = p_ref;
  elsif p_kind = 'chantier' then update public.project_steps set photos = (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements_text(photos) x where x <> p_path) where id = p_ref;
  end if;
end $$;
grant execute on function public.admin_remove_photo(text, uuid, text) to authenticated;
