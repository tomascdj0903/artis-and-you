-- 0029 · Espace administrateur
--  - Nouveau type de compte « admin » : ni artisan, ni particulier. Il pilote la plateforme (tuiles d'administration)
--    et gère l'activité d'Artesa elle-même (clients, devis, factures, comptabilité) via une entreprise interne.
--  - L'entreprise interne (« entreprise plateforme ») n'apparaît jamais dans la recherche ni dans les statistiques.
--  - Statistiques de la plateforme calculées côté base (comptes, entreprises, essais, abonnements estimés).
-- Aucune donnée existante n'est modifiée.

-- Type de compte « admin »
alter table public.profiles drop constraint if exists profiles_kind_check;
alter table public.profiles add constraint profiles_kind_check check (kind in ('artisan','particulier','admin'));

-- Entreprise interne d'Artesa
alter table public.companies add column if not exists is_platform boolean not null default false;

-- Seule l'équipe Artesa peut donner le type « admin » ou marquer une entreprise comme interne
create or replace function public.protect_admin_fields() returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated','anon') and not public.is_admin() then
    if tg_table_name = 'profiles' and new.kind = 'admin' and old.kind is distinct from 'admin' then
      raise exception 'Type de compte réservé à l''équipe Artesa.'; end if;
    if tg_table_name = 'companies' and new.is_platform is distinct from old.is_platform then
      raise exception 'Réservé à l''équipe Artesa.'; end if;
  end if;
  return new;
end $$;
create trigger profiles_protect_admin before update on public.profiles for each row execute function public.protect_admin_fields();
create trigger companies_protect_admin before update on public.companies for each row execute function public.protect_admin_fields();

-- L'équipe voit la liste des comptes (onglet « Comptes »)
create policy profiles_admin_sel on public.profiles for select using (public.is_admin());

-- Mise en place du compte administrateur : crée l'entreprise interne « Artesa » (une seule fois) et rattache l'admin
create or replace function public.admin_setup_platform() returns public.companies
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.companies; prof public.profiles;
begin
  if not public.is_admin() then raise exception 'Réservé à l''équipe Artesa.'; end if;
  select * into prof from public.profiles where id = uid;
  select * into c from public.companies where is_platform order by created_at limit 1;
  if c.id is null then
    insert into public.companies(owner_id, name, trade_name, legal_form, country, email, verification_status, verified, verified_at,
                                 visible_particuliers, visible_pros, is_platform, trades, trial_ends_at)
    values (uid, 'Artesa', 'Artesa', '', 'France', '', 'approved', true, now(), false, false, true, '{}', null)
    returning * into c;
  end if;
  perform set_config('ay.trusted', '1', true);
  update public.profiles set kind = 'admin', company_id = c.id, member_role = 'gerant',
    permissions = '{"planning":true,"clients":true,"devis":true,"prix":true,"kpi":true}'::jsonb
  where id = uid;
  return c;
end $$;
revoke execute on function public.admin_setup_platform() from public, anon;
grant execute on function public.admin_setup_platform() to authenticated;

-- Statistiques de la plateforme (hors entreprise interne)
create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'Réservé à l''équipe Artesa.'; end if;
  with co as (select * from public.companies where not is_platform),
  pr as (select * from public.profiles where kind <> 'admin')
  select jsonb_build_object(
    'users', (select count(*) from pr),
    'artisans', (select count(*) from pr where kind = 'artisan'),
    'particuliers', (select count(*) from pr where kind = 'particulier'),
    'new_30d', (select count(*) from pr where created_at > now() - interval '30 days'),
    'new_7d', (select count(*) from pr where created_at > now() - interval '7 days'),
    'companies', (select count(*) from co),
    'approved', (select count(*) from co where verification_status = 'approved'),
    'pending', (select count(*) from co where verification_status = 'pending'),
    'rejected', (select count(*) from co where verification_status = 'rejected'),
    'in_trial', (select count(*) from co where trial_ends_at > now()),
    'trial_ending_7d', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'ends', trial_ends_at, 'plan', plan) order by trial_ends_at), '[]'::jsonb)
                        from co where trial_ends_at between now() and now() + interval '7 days'),
    'after_trial', (select count(*) from co where trial_ends_at <= now() and verification_status = 'approved'),
    'plans', (select coalesce(jsonb_object_agg(plan, n), '{}'::jsonb) from (select plan, count(*) n from co where trial_ends_at <= now() and verification_status = 'approved' group by plan) x),
    'quotes', (select count(*) from public.documents d join co on co.id = d.company_id where d.kind = 'devis' and d.number is not null),
    'invoices', (select count(*) from public.documents d join co on co.id = d.company_id where d.kind = 'facture' and d.number is not null),
    'appointments_30d', (select count(*) from public.appointments a join co on co.id = a.company_id where a.created_at > now() - interval '30 days'),
    'reviews', (select count(*) from public.reviews r join co on co.id = r.company_id where r.status = 'publie'),
    'signups_by_week', (select coalesce(jsonb_agg(jsonb_build_object('week', w, 'n', n) order by w), '[]'::jsonb) from (
        select to_char(date_trunc('week', created_at), 'YYYY-MM-DD') w, count(*) n from pr where created_at > now() - interval '12 weeks' group by 1) s),
    'todo', jsonb_build_object(
      'companies', (select count(*) from co where verification_status = 'pending'),
      'identities', (select count(*) from public.identity_checks where status = 'en_attente'),
      'vault', (select count(*) from public.files f join co on co.id = f.company_id where f.kind = 'vault' and f.review_status = 'en_attente'),
      'reviews', (select count(*) from public.reviews where status = 'en_attente'),
      'reports', (select count(*) from public.content_reports where status = 'recu'),
      'trades', (select count(*) from public.trades where status = 'en_attente'))
  ) into r;
  return r;
end $$;
revoke execute on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
