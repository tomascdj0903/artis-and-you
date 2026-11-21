-- (appliquée en prod) Avis enrichis : notes par critère et photos (visibles une fois l'avis publié)
alter table public.reviews add column if not exists criteria jsonb;
alter table public.reviews add column if not exists photos jsonb not null default '[]'::jsonb;

drop function if exists public.post_review(uuid, integer, text);
create or replace function public.post_review(p_company uuid, p_rating integer, p_comment text, p_criteria jsonb default null, p_photos jsonb default '[]'::jsonb)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare a uuid; ok boolean; prof public.profiles; crit jsonb; ph jsonb;
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'Choisissez une note de 1 à 5.'; end if;
  if exists(select 1 from public.reviews where company_id = p_company and author_id = auth.uid()) then raise exception 'Vous avez déjà donné votre avis sur ce pro.'; end if;
  select ap.id into a from public.appointments ap
   where ap.company_id = p_company and ap.client_id in (select public.my_client_ids())
     and ap.status in ('valide','termine') and ap.start_at < now()
   order by ap.start_at desc limit 1;
  ok := a is not null or exists (select 1 from public.documents d
     where d.company_id = p_company and d.client_id in (select public.my_client_ids())
       and ((d.kind in ('facture','acompte') and d.status in ('payee','partielle')) or (d.kind = 'devis' and d.status = 'accepte')));
  if not ok then raise exception 'Un avis ne peut être donné qu''après un vrai rendez-vous ou une facture réglée.'; end if;
  -- critères notés de 1 à 5 (ponctualité, propreté, respect du devis, rapport qualité-prix)
  select jsonb_object_agg(k, least(5, greatest(1, (v #>> '{}')::int))) into crit
    from jsonb_each(coalesce(p_criteria, '{}'::jsonb)) as e(k, v)
    where k in ('ponctualite','proprete','devis','prix') and jsonb_typeof(v) = 'number';
  -- photos : seulement celles envoyées par l'auteur, 6 au maximum
  select coalesce(jsonb_agg(x), '[]'::jsonb) into ph from (
    select x from jsonb_array_elements_text(coalesce(p_photos, '[]'::jsonb)) x
    where x like 'u/' || auth.uid()::text || '/avis/%' limit 6) s;
  select * into prof from public.profiles where id = auth.uid();
  insert into public.reviews(company_id, author_id, author_label, appointment_id, rating, comment, criteria, photos)
  values (p_company, auth.uid(), prof.first_name || ' ' || left(prof.last_name,1) || '.', a, p_rating, left(coalesce(p_comment,''), 2000), crit, ph);
  perform public.notify_company(p_company,'systeme','Nouvel avis client', p_rating||'/5', '/pro/compte/avis');
end $function$;
grant execute on function public.post_review(uuid, integer, text, jsonb, jsonb) to authenticated;

-- Photos d'avis : visibles par tous une fois l'avis publié ; par l'artisan concerné et l'équipe avant
drop policy if exists review_photos_read on storage.objects;
create policy review_photos_read on storage.objects for select to authenticated using (
  bucket_id = 'files' and (storage.foldername(name))[3] = 'avis' and exists (
    select 1 from public.reviews r where r.photos @> jsonb_build_array(objects.name)
      and (r.status = 'publie' or r.company_id = public.my_company() or public.is_admin())));

create or replace function public.directory_get(p_id uuid)
 returns jsonb language sql stable security definer set search_path to 'public' as $function$
  select case when auth.uid() is null then null else jsonb_build_object(
    'id', c.id, 'name', c.name, 'trade_name', c.trade_name, 'city', c.city, 'zip', c.zip, 'address', c.address,
    'phone', c.phone, 'email', c.email, 'website', c.website, 'trades', c.trades, 'zone', c.zone,
    'certifications', c.certifications, 'description', c.description, 'siren', c.siren, 'verified', c.verified,
    'logo_path', c.logo_path, 'planning', c.settings->'planning', 'is_platform', c.is_platform,
    'zone_lat', c.zone_lat, 'zone_lon', c.zone_lon, 'zone_km', c.zone_km,
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
    'criteria', (select jsonb_object_agg(k, avg_v) from (select k, round(avg((r.criteria->>k)::numeric), 1) avg_v
                   from public.reviews r, unnest(array['ponctualite','proprete','devis','prix']) k
                   where r.company_id = c.id and r.status = 'publie' and r.criteria ? k group by k) z),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('rating',rating,'comment',comment,'author',author_label,'reply',reply,'created_at',created_at,'criteria',criteria,'photos',photos) order by created_at desc)
                 from (select * from public.reviews r where r.company_id=c.id and r.status='publie' order by created_at desc limit 20) r),'[]'::jsonb),
    'photos', coalesce((select jsonb_agg(path) from (select path from public.files f where f.company_id=c.id and f.kind='photo' and f.shared_with_pros limit 12) f),'[]'::jsonb)
  ) end
  from public.companies c where c.id = p_id and c.archived_at is null
$function$;
