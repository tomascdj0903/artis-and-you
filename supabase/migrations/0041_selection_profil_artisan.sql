-- (appliquée en prod)
-- Côté particulier : « Ma sélection » (artisans enregistrés) et profil d'artisan plus riche.

create table if not exists public.client_favorites (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);
alter table public.client_favorites enable row level security;
drop policy if exists client_favorites_own on public.client_favorites;
create policy client_favorites_own on public.client_favorites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create index if not exists client_favorites_company on public.client_favorites(company_id);

-- Délai de réponse médian de l'artisan aux messages de particuliers (90 derniers jours, au moins 3 échanges)
create or replace function public.company_response_minutes(p_company uuid) returns int
language sql stable security definer set search_path = public as $$
  with q as (
    select m.created_at asked,
      (select min(r.created_at) from public.messages r where r.conversation_id = m.conversation_id and r.created_at > m.created_at and r.sender_company_id = p_company) answered
    from public.messages m join public.conversations c on c.id = m.conversation_id
    where c.company_id = p_company and c.kind = 'client' and m.sender_id = c.client_user_id
      and m.created_at > now() - interval '90 days'
      and not exists (select 1 from public.messages p where p.conversation_id = m.conversation_id and p.created_at < m.created_at and p.created_at > m.created_at - interval '12 hours' and p.sender_id = c.client_user_id)
  )
  select case when count(answered) >= 3 then round(percentile_cont(0.5) within group (order by extract(epoch from answered - asked) / 60))::int end
  from q
$$;
revoke execute on function public.company_response_minutes(uuid) from public, anon;

create or replace function public.directory_get(p_id uuid)
 returns jsonb language sql stable security definer set search_path to 'public' as $function$
  select case when auth.uid() is null then null else jsonb_build_object(
    'id', c.id, 'name', c.name, 'trade_name', c.trade_name, 'city', c.city, 'zip', c.zip, 'address', c.address,
    'phone', c.phone, 'email', c.email, 'website', c.website, 'trades', c.trades, 'zone', c.zone,
    'certifications', c.certifications, 'description', c.description, 'siren', c.siren, 'verified', c.verified,
    'logo_path', c.logo_path, 'planning', c.settings->'planning', 'is_platform', c.is_platform,
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

-- « Ma sélection » : artisans enregistrés + artisans avec qui le particulier a déjà travaillé
create or replace function public.my_artisans()
returns table(id uuid, name text, trade_name text, city text, trades text[], verified boolean, logo_path text,
              rating numeric, reviews_count int, is_fav boolean, is_mine boolean, note text, saved_at timestamptz, last_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.trade_name, c.city, c.trades, c.verified, c.logo_path,
    (select round(avg(rating)::numeric,1) from public.reviews r where r.company_id = c.id and r.status='publie'),
    (select count(*)::int from public.reviews r where r.company_id = c.id and r.status='publie'),
    f.user_id is not null, cl.id is not null, f.note, f.created_at,
    greatest((select max(a.start_at) from public.appointments a where a.company_id = c.id and a.client_id = cl.id),
             (select max(d.created_at) from public.documents d where d.company_id = c.id and d.client_id = cl.id and d.number is not null))
  from public.companies c
  left join public.client_favorites f on f.company_id = c.id and f.user_id = auth.uid()
  left join public.clients cl on cl.company_id = c.id and cl.user_id = auth.uid()
  where auth.uid() is not null and c.archived_at is null and coalesce(c.is_platform, false) = false
    and (cl.id is not null or (f.user_id is not null and c.verification_status = 'approved'))
  order by f.created_at desc nulls last, c.name
$$;
revoke execute on function public.my_artisans() from public, anon;
grant execute on function public.my_artisans() to authenticated;
