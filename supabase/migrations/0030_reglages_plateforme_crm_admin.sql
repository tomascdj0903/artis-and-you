-- 0030 · Réglages de la plateforme et espace de travail de l'équipe Artesa
--  - platform_settings : formules et prix des abonnements, durée de l'essai gratuit, bandeau d'information.
--    Lisibles par tous (page d'accueil, page Abonnement), modifiables seulement par l'équipe.
--  - admin_deals / admin_tasks / admin_notes : prospection (pipeline), tâches et notes partagées de l'équipe.
--  - admin_deal_events : historique de chaque prospect (appels, e-mails, RDV, notes) avec qui l'a fait.
--  - team (dans platform_settings) : les membres de l'équipe (Tomas, Clément…), pour savoir qui a fait quoi,
--    même si vous partagez le même identifiant.
-- Aucune donnée existante n'est modifiée.

create table if not exists public.platform_settings (
  id text primary key default 'main' check (id = 'main'),
  plans jsonb not null,
  trial_days int not null default 30 check (trial_days between 0 and 365),
  banner text default '',
  support_email text default 'support@artisandyou.fr',
  team jsonb not null default '["Tomas","Clément"]'::jsonb,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.platform_settings enable row level security;
create policy platform_settings_read on public.platform_settings for select using (true);
create policy platform_settings_admin on public.platform_settings for update using (public.is_admin()) with check (public.is_admin());
insert into public.platform_settings(id, plans) values ('main', '[
  {"id":"solo","name":"Solo","price":19,"users":1,"desc":"Pour l’artisan seul","features":["Clients, devis et factures illimités","Planning et prise de RDV en ligne","Messagerie clients","Coffre-fort et documents","Export comptable Excel et FEC"]},
  {"id":"equipe","name":"Équipe","price":39,"users":5,"desc":"Jusqu’à 5 utilisateurs","features":["Tout Solo","Équipes et couleurs au planning","Rôles et droits (chef d’équipe, ouvrier)","Messagerie d’équipe","Statut projet et KPI"]},
  {"id":"entreprise","name":"Entreprise","price":69,"users":0,"desc":"Utilisateurs illimités","features":["Tout Équipe","Utilisateurs illimités","Chantiers partagés avec le réseau","Bibliothèque d’ouvrages avancée","Support prioritaire"]}
]'::jsonb) on conflict (id) do nothing;
grant select on public.platform_settings to anon, authenticated;

-- L'essai gratuit des nouvelles entreprises suit le réglage (le parrainage peut ensuite l'allonger)
create or replace function public.on_company_trial() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(new.is_platform, false) then
    new.trial_ends_at := now() + make_interval(days => coalesce((select trial_days from public.platform_settings where id = 'main'), 30));
  end if;
  return new;
end $$;
create trigger companies_0_trial before insert on public.companies for each row execute function public.on_company_trial();

-- Prospection : artisans à convaincre, partenaires, fournisseurs…
create table if not exists public.admin_deals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  contact_name text default '',
  company_name text default '',
  email text default '',
  phone text default '',
  city text default '',
  source text default '',
  stage text not null default 'prospect' check (stage in ('prospect','contacte','demo','essai','client','perdu')),
  plan text default 'solo',
  value numeric default 0,
  next_action text default '',
  next_date date,
  owner_id uuid references auth.users(id) on delete set null,
  owner text default '',                 -- membre de l'équipe qui a pris le prospect en charge
  worked_by text[] not null default '{}',-- membres qui ont travaillé dessus
  trade text default '',
  siret text default '',
  address text default '',
  zip text default '',
  website text default '',
  priority text default 'normale' check (priority in ('basse','normale','haute')),
  tags text[] not null default '{}',
  last_contact_at timestamptz,
  imported_from text default '',
  notes text default '',
  company_id uuid references public.companies(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists public.admin_deal_events (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.admin_deals(id) on delete cascade,
  who text default '',
  kind text not null default 'note' check (kind in ('appel','email','rdv','note','etape','import')),
  content text default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists admin_deal_events_deal on public.admin_deal_events(deal_id, created_at desc);
create table if not exists public.admin_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  details text default '',
  due_date date,
  assignee_id uuid references auth.users(id) on delete set null,
  assignee text default '',              -- membre de l'équipe (nom), utile si l'identifiant est partagé
  deal_id uuid references public.admin_deals(id) on delete cascade,
  done boolean not null default false,
  done_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);
create table if not exists public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Sans titre',
  content text default '',
  folder text default 'Général',
  pinned boolean default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.admin_deals enable row level security;
alter table public.admin_tasks enable row level security;
alter table public.admin_notes enable row level security;
alter table public.admin_deal_events enable row level security;
create policy admin_deal_events_all on public.admin_deal_events for all using (public.is_admin()) with check (public.is_admin());
create policy admin_deals_all on public.admin_deals for all using (public.is_admin()) with check (public.is_admin());
create policy admin_tasks_all on public.admin_tasks for all using (public.is_admin()) with check (public.is_admin());
create policy admin_notes_all on public.admin_notes for all using (public.is_admin()) with check (public.is_admin());
create index if not exists admin_tasks_open on public.admin_tasks(done, due_date);

-- Service client : conversations « support » entre Artesa et un pro (ou un particulier).
-- Artesa reste invisible : seule l'équipe ouvre une conversation avec un pro, ou le pro/particulier écrit au support.
create or replace function public.support_conversation() returns uuid
language plpgsql security definer set search_path = public as $$
declare conv uuid; plat uuid; mine uuid := public.my_company();
begin
  if auth.uid() is null then raise exception 'Connectez-vous.'; end if;
  select id into plat from public.companies where is_platform order by created_at limit 1;
  if plat is null then raise exception 'Le support n''est pas encore disponible.'; end if;
  if mine = plat then raise exception 'Impossible'; end if;
  if mine is not null then
    select id into conv from public.conversations where kind = 'support' and company_id = plat and other_company_id = mine;
    if conv is null then insert into public.conversations(kind, company_id, other_company_id, last_message) values ('support', plat, mine, '') returning id into conv; end if;
  else
    select id into conv from public.conversations where kind = 'support' and company_id = plat and client_user_id = auth.uid();
    if conv is null then insert into public.conversations(kind, company_id, client_user_id, last_message) values ('support', plat, auth.uid(), '') returning id into conv; end if;
  end if;
  return conv;
end $$;
revoke execute on function public.support_conversation() from public, anon;
grant execute on function public.support_conversation() to authenticated;

create or replace function public.admin_support_start(p_company uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare conv uuid; plat uuid := public.my_company();
begin
  if not public.is_admin() or not exists (select 1 from public.companies where id = plat and is_platform) then raise exception 'Réservé à l''équipe Artesa.'; end if;
  select id into conv from public.conversations where kind = 'support' and company_id = plat and other_company_id = p_company;
  if conv is null then insert into public.conversations(kind, company_id, other_company_id, last_message) values ('support', plat, p_company, '') returning id into conv; end if;
  return conv;
end $$;
revoke execute on function public.admin_support_start(uuid) from public, anon;
grant execute on function public.admin_support_start(uuid) to authenticated;
