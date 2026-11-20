-- Demandes de devis « Entreprise » (formules « sur devis ») envoyées depuis le site.
-- N'importe qui peut envoyer une demande (connecté ou non) via la fonction request_quote ;
-- seule l'équipe Artesa peut les lire et les traiter. Chaque demande prévient les administrateurs.

create table if not exists public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  plan text not null default 'entreprise',
  company_name text not null,
  siret text default '',
  trades text default '',
  city text default '',
  team_size text default '',
  users_needed integer,
  sites_per_month text default '',
  options text[] not null default '{}',
  current_tools text default '',
  start_when text default '',
  message text default '',
  contact_name text not null,
  email text not null,
  phone text default '',
  status text not null default 'nouvelle' check (status in ('nouvelle','en_cours','devis_envoye','gagnee','perdue')),
  admin_note text default '',
  handled_by text default ''
);
create index if not exists quote_requests_status_idx on public.quote_requests(status, created_at desc);
alter table public.quote_requests enable row level security;
drop policy if exists quote_requests_admin_sel on public.quote_requests;
drop policy if exists quote_requests_admin_upd on public.quote_requests;
create policy quote_requests_admin_sel on public.quote_requests for select using (public.is_admin());
create policy quote_requests_admin_upd on public.quote_requests for update using (public.is_admin());

create or replace function public.request_quote(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare rid uuid; v_email text := lower(trim(coalesce(p->>'email','')));
begin
  if not coalesce((p->>'consent')::boolean, false) then raise exception 'Merci d''accepter d''être recontacté pour recevoir votre devis.'; end if;
  if length(trim(coalesce(p->>'company_name',''))) < 2 then raise exception 'Indiquez le nom de votre entreprise.'; end if;
  if length(trim(coalesce(p->>'contact_name',''))) < 2 then raise exception 'Indiquez votre nom.'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Indiquez un e-mail valide pour recevoir votre devis.'; end if;
  if (select count(*) from public.quote_requests where email = v_email and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Vous avez déjà envoyé plusieurs demandes, nous revenons vers vous rapidement.'; end if;
  insert into public.quote_requests(user_id, plan, company_name, siret, trades, city, team_size, users_needed, sites_per_month, options,
    current_tools, start_when, message, contact_name, email, phone)
  values (auth.uid(), left(coalesce(nullif(p->>'plan',''),'entreprise'),40), left(trim(p->>'company_name'),160), left(coalesce(p->>'siret',''),20),
    left(coalesce(p->>'trades',''),300), left(coalesce(p->>'city',''),120), left(coalesce(p->>'team_size',''),40),
    nullif(regexp_replace(coalesce(p->>'users_needed',''),'[^0-9]','','g'),'')::integer, left(coalesce(p->>'sites_per_month',''),40),
    coalesce(array(select left(x,120) from jsonb_array_elements_text(coalesce(p->'options','[]'::jsonb)) x limit 40), '{}'),
    left(coalesce(p->>'current_tools',''),500), left(coalesce(p->>'start_when',''),60), left(coalesce(p->>'message',''),4000),
    left(trim(p->>'contact_name'),120), v_email, left(coalesce(p->>'phone',''),40))
  returning id into rid;
  insert into public.notifications(user_id, category, title, body, link)
  select a.user_id, 'systeme', 'Nouvelle demande de devis',
    left(trim(p->>'company_name'),160) || coalesce(' · ' || nullif(p->>'team_size',''), ''), '/admin/devis-entreprise'
  from public.admins a;
  return rid;
end $$;
revoke execute on function public.request_quote(jsonb) from public;
grant execute on function public.request_quote(jsonb) to anon, authenticated;

-- Compteurs de l'espace admin : ajoute les demandes de devis à traiter
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
      'trades', (select count(*) from public.trades where status = 'en_attente'),
      'quote_requests', (select count(*) from public.quote_requests where status = 'nouvelle'))
  ) into r;
  return r;
end $$;
revoke execute on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
