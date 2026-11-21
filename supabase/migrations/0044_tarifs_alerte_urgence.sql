-- (appliquée en prod) Tarifs de l'artisan sur sa fiche (arrêté du 24 janvier 2017) et relances des demandes urgentes sans réponse

-- Fiche artisan : tarifs (settings.profile.tarifs) renvoyés avec le profil public
create or replace function public.directory_get(p_id uuid)
 returns jsonb language sql stable security definer set search_path to 'public' as $function$
  select case when auth.uid() is null then null else jsonb_build_object(
    'id', c.id, 'name', c.name, 'trade_name', c.trade_name, 'city', c.city, 'zip', c.zip, 'address', c.address,
    'phone', c.phone, 'email', c.email, 'website', c.website, 'trades', c.trades, 'zone', c.zone,
    'certifications', c.certifications, 'description', c.description, 'siren', c.siren, 'verified', c.verified,
    'logo_path', c.logo_path, 'planning', c.settings->'planning', 'is_platform', c.is_platform,
    'tarifs', c.settings->'profile'->'tarifs',
    'profile', jsonb_build_object(
      'cover_path', c.settings->'profile'->>'cover_path',
      'founded_year', c.settings->'profile'->'founded_year',
      'languages', c.settings->'profile'->'languages',
      'team_size', (select count(*) from public.profiles pr where pr.company_id = c.id),
      'insurer', case when coalesce((c.settings->'profile'->>'show_insurance')::boolean, false) then c.insurer end,
      'insurance_coverage', case when coalesce((c.settings->'profile'->>'show_insurance')::boolean, false) then c.insurance_coverage end,
      'response_minutes', public.company_response_minutes(c.id),
      'jobs_done', (select count(*) from public.appointments a where a.company_id = c.id and a.status in ('valide','termine') and a.start_at < now()),
      'member_since', c.created_at),
    'is_fav', exists(select 1 from public.client_favorites f where f.company_id = c.id and f.user_id = auth.uid()),
    'is_mine', exists(select 1 from public.clients cl where cl.company_id = c.id and cl.user_id = auth.uid()),
    'rating', (select round(avg(rating)::numeric,1) from public.reviews r where r.company_id=c.id and r.status='publie'),
    'distribution', (select jsonb_object_agg(s, (select count(*) from public.reviews r where r.company_id=c.id and r.status='publie' and r.rating=s)) from generate_series(1,5) s),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('rating',rating,'comment',comment,'author',author_label,'reply',reply,'created_at',created_at) order by created_at desc)
                 from (select * from public.reviews r where r.company_id=c.id and r.status='publie' order by created_at desc limit 20) r),'[]'::jsonb),
    'photos', coalesce((select jsonb_agg(path) from (select path from public.files f where f.company_id=c.id and f.kind='photo' and f.shared_with_pros limit 12) f),'[]'::jsonb)
  ) end
  from public.companies c where c.id = p_id and c.archived_at is null
$function$;

-- Relances des demandes urgentes restées sans réponse
alter table public.appointments add column if not exists urgent_reminded_at timestamptz;
alter table public.appointments add column if not exists urgent_client_warned_at timestamptz;

create or replace function private.urgent_followup() returns int
language plpgsql security definer set search_path to 'public', 'private' as $$
declare a record; n int := 0; co_name text;
begin
  -- 10 min sans réponse : nouvelle alerte à l'artisan (notification + push)
  for a in select ap.* from public.appointments ap
           where ap.urgent and ap.status = 'a_valider' and ap.urgent_reminded_at is null and ap.created_at < now() - interval '10 minutes' and ap.created_at > now() - interval '6 hours'
  loop
    perform public.notify_company(a.company_id, 'rdv', 'URGENT · Demande toujours sans réponse',
      coalesce(a.contact_name, 'Un client') || ' attend votre réponse depuis ' || floor(extract(epoch from now() - a.created_at) / 60) || ' min · ' || coalesce(nullif(a.title,''), a.type, ''), '/pro/planning/rdv/' || a.id);
    update public.appointments set urgent_reminded_at = now() where id = a.id;
    n := n + 1;
  end loop;
  -- 30 min sans réponse : le client est invité à contacter un autre artisan disponible
  for a in select ap.*, cl.user_id as client_uid, co.trade_name, co.name as cname from public.appointments ap
           join public.clients cl on cl.id = ap.client_id join public.companies co on co.id = ap.company_id
           where ap.urgent and ap.status = 'a_valider' and ap.urgent_client_warned_at is null and ap.created_at < now() - interval '30 minutes' and ap.created_at > now() - interval '6 hours'
             and cl.user_id is not null
  loop
    co_name := coalesce(nullif(a.trade_name, ''), a.cname);
    insert into public.notifications(user_id, category, title, body, link)
    values (a.client_uid, 'rdv', 'Pas encore de réponse à votre urgence', co_name || ' n''a pas encore répondu. Vous pouvez contacter un autre artisan disponible.', '/client/urgence');
    update public.appointments set urgent_client_warned_at = now() where id = a.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function private.urgent_followup() from public, anon, authenticated;

select cron.unschedule('artisandyou_urgences') where exists (select 1 from cron.job where jobname = 'artisandyou_urgences');
select cron.schedule('artisandyou_urgences', '*/5 * * * *', 'select private.urgent_followup()');
