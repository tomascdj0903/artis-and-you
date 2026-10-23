-- Artis & You — schéma initial
-- Deux espaces dans une seule base : les artisans (entreprises + membres) et les particuliers.

create extension if not exists pgcrypto;

-- ───────────────────────── Profils ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  kind text not null default 'particulier' check (kind in ('artisan','particulier')),
  first_name text default '',
  last_name text default '',
  email text default '',
  phone text default '',
  avatar_path text,
  lang text default 'fr',
  theme text default 'light',
  company_id uuid,
  member_role text default 'gerant' check (member_role in ('gerant','chef','ouvrier')),
  team_id uuid,
  permissions jsonb default '{"planning":true,"clients":true,"devis":true,"prix":true,"kpi":true}'::jsonb,
  -- particulier : logement
  home jsonb default '{}'::jsonb,
  notif_prefs jsonb default '{}'::jsonb,
  privacy jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- ───────────────────────── Entreprises ─────────────────────────
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  name text not null,                -- raison sociale
  trade_name text default '',        -- enseigne / nom commercial
  legal_form text default '',
  capital text default '',
  siret text default '',
  siren text default '',
  vat_number text default '',
  rm text default '',
  address text default '',
  zip text default '',
  city text default '',
  phone text default '',
  email text default '',
  website text default '',
  logo_path text,
  trades text[] default '{}',        -- métiers
  zone text default '',
  certifications text default '',
  description text default '',
  insurer text default '',
  insurance_contract text default '',
  insurance_coverage text default 'France métropolitaine',
  iban text default '',
  bic text default '',
  vat_regime text default 'normal' check (vat_regime in ('normal','franchise')),
  plan text default 'solo' check (plan in ('solo','equipe','entreprise')),
  trial_ends_at timestamptz default (now() + interval '30 days'),
  referral_code text unique default upper(substr(md5(random()::text),1,8)),
  referred_by uuid references public.companies(id) on delete set null,
  visible_particuliers boolean default true,
  visible_pros boolean default true,
  verified boolean default false,
  settings jsonb default '{}'::jsonb,
  counters jsonb default '{}'::jsonb,
  accountant jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
alter table public.profiles add constraint profiles_company_fk foreign key (company_id) references public.companies(id) on delete set null;

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  color text default '#00123B',
  created_at timestamptz default now()
);
alter table public.profiles add constraint profiles_team_fk foreign key (team_id) references public.teams(id) on delete set null;

create table public.company_invites (
  code text primary key default upper(substr(md5(random()::text),1,6)),
  company_id uuid not null references public.companies(id) on delete cascade,
  member_role text default 'ouvrier',
  team_id uuid references public.teams(id) on delete set null,
  label text default '',
  used_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ───────────────────────── Clients ─────────────────────────
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  number text,
  user_id uuid references auth.users(id) on delete set null, -- compte particulier lié
  type text default 'particulier' check (type in ('pro','particulier')),
  civility text default '',
  last_name text default '',
  first_name text default '',
  company_name text default '',  -- raison sociale
  trade_name text default '',
  legal_form text default '',
  creation_date date,
  email text default '',
  phone text default '',
  mobile text default '',
  website text default '',
  contact_name text default '',
  contact_role text default '',
  billing_address text default '',
  billing_zip text default '',
  billing_city text default '',
  site_name text default '',
  site_address text default '',
  site_zip text default '',
  site_city text default '',
  siret text default '',
  siren text default '',
  vat_number text default '',
  rcs text default '',
  payment_terms text default '30 jours fin de mois',
  payment_mode text default 'Virement',
  max_outstanding numeric default 0,
  status text default 'actif' check (status in ('actif','prospect','inactif')),
  note text default '',
  note_updated_at timestamptz,
  created_at timestamptz default now()
);
create index on public.clients(company_id);
create index on public.clients(user_id);

-- ───────────────────────── Projets / chantiers ─────────────────────────
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  title text not null,
  address text default '',
  manual jsonb default '{}'::jsonb,   -- étapes forcées à la main {step:true/false}
  finished_at timestamptz,
  created_at timestamptz default now()
);
create index on public.projects(company_id);

create table public.project_shares (
  project_id uuid references public.projects(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (project_id, company_id)
);

-- ───────────────────────── Bibliothèque ─────────────────────────
create table public.items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind text default 'article' check (kind in ('article','ouvrage')),
  name text not null,
  ref text default '',
  family text default '',
  trades text[] default '{}',
  unit text default 'pièce',
  supplier text default '',
  purchase_price numeric default 0,
  coef numeric default 1,
  sale_price numeric default 0,
  vat_rate numeric default 20,
  labour_hours numeric default 0,
  components jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);
create index on public.items(company_id);

-- ───────────────────────── Devis & factures ─────────────────────────
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,
  kind text not null check (kind in ('devis','facture','acompte','avoir')),
  number text,                       -- attribué à la finalisation, jamais réutilisé
  status text not null default 'brouillon',
  -- devis : brouillon, envoye, accepte, refuse | factures : brouillon, envoyee, payee, partielle, retard, annulee
  object text default '',
  intervention_type text default 'Chantier',
  issue_date date default current_date,
  service_date date,
  due_date date,
  validity_days int default 30,
  start_date date,
  duration text default '',
  work_address text default '',
  delivery_address text default '',
  operations_nature text default 'Biens et services',
  vat_on_debits boolean default false,
  reverse_charge boolean default false,
  lines jsonb default '[]'::jsonb,
  totals jsonb default '{}'::jsonb,
  conditions jsonb default '{}'::jsonb,
  deposit_pct numeric default 0,
  source_id uuid references public.documents(id) on delete set null,  -- devis d'origine / facture annulée
  snapshot jsonb,                    -- émetteur + client figés à la finalisation
  paid_amount numeric default 0,
  sent_at timestamptz,
  accepted_at timestamptz,
  refused_at timestamptz,
  signed_name text,
  locked boolean default false,
  created_by uuid default auth.uid(),
  created_at timestamptz default now()
);
create index on public.documents(company_id);
create index on public.documents(client_id);
create unique index documents_number_uq on public.documents(company_id, number) where number is not null;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete restrict,
  amount numeric not null,
  method text default 'Virement',
  paid_on date default current_date,
  via_platform boolean default false,
  note text default '',
  created_at timestamptz default now()
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  date date default current_date,
  supplier text default '',
  label text default '',
  amount_ht numeric default 0,
  vat numeric default 0,
  file_path text,
  created_at timestamptz default now()
);

-- ───────────────────────── Rendez-vous ─────────────────────────
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  type text default 'Chantier',
  title text default '',
  start_at timestamptz not null,
  end_at timestamptz not null,
  mode text default 'site' check (mode in ('site','visio')),
  status text default 'a_valider' check (status in ('a_valider','valide','refuse','annule','termine')),
  request_text text default '',
  photos jsonb default '[]'::jsonb,
  notes text default '',
  address text default '',
  contact_name text default '',
  contact_phone text default '',
  recurrence text default 'none' check (recurrence in ('none','weekly','monthly','yearly')),
  personal boolean default false,
  requested_by uuid references auth.users(id),
  validated_at timestamptz,
  enroute_at timestamptz,
  eta_at timestamptz,
  created_at timestamptz default now()
);
create index on public.appointments(company_id, start_at);

-- ───────────────────────── Fichiers ─────────────────────────
create table public.files (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  kind text not null check (kind in ('photo','doc','vault')),
  doc_type text default 'autre',
  name text not null,
  path text not null,
  mime text default '',
  size bigint default 0,
  issued_at date,
  valid_until date,
  remind_days int default 15,
  shared_with_client boolean default false,
  shared_with_pros boolean default false,
  author_label text default '',
  uploaded_by uuid default auth.uid(),
  created_at timestamptz default now()
);
create index on public.files(company_id, kind);

-- ───────────────────────── Messagerie ─────────────────────────
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('client','team','pro','support')),
  company_id uuid references public.companies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  client_user_id uuid references auth.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  other_company_id uuid references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  last_message text default '',
  last_at timestamptz default now(),
  created_at timestamptz default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid default auth.uid() references auth.users(id) on delete set null,
  sender_name text default '',
  sender_company_id uuid,
  body text default '',
  attachments jsonb default '[]'::jsonb,
  card jsonb,
  created_at timestamptz default now()
);
create index on public.messages(conversation_id, created_at);

create table public.conversation_reads (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  last_read_at timestamptz default now(),
  primary key (conversation_id, user_id)
);

-- ───────────────────────── Réseau, avis, notifications ─────────────────────────
create table public.network (
  company_id uuid references public.companies(id) on delete cascade,
  pro_id uuid references public.companies(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (company_id, pro_id)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_label text default '',
  appointment_id uuid references public.appointments(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  comment text default '',
  reply text,
  status text default 'en_attente' check (status in ('en_attente','publie','refuse')),
  created_at timestamptz default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text default 'rdv' check (category in ('rdv','documents','paiement','message','systeme')),
  title text not null,
  body text default '',
  link text default '',
  read boolean default false,
  created_at timestamptz default now()
);
create index on public.notifications(user_id, created_at desc);

-- ───────────────────────── Fonctions d'aide ─────────────────────────
create or replace function public.my_company() returns uuid
language sql stable security definer set search_path = public as $$
  select company_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_gerant() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select member_role = 'gerant' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.my_client_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.clients where user_id = auth.uid()
$$;

create or replace function public.can_see_conversation(c public.conversations) returns boolean
language sql stable security definer set search_path = public as $$
  select (c.company_id is not null and c.company_id = public.my_company())
      or (c.other_company_id is not null and c.other_company_id = public.my_company())
      or (c.client_user_id = auth.uid())
$$;

-- Notifie tous les membres d'une entreprise
create or replace function public.notify_company(p_company uuid, p_cat text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications(user_id, category, title, body, link)
  select id, p_cat, p_title, p_body, p_link from public.profiles where company_id = p_company;
$$;

-- ───────────────────────── Création du profil à l'inscription ─────────────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, kind, first_name, last_name, email, phone, lang)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'kind','particulier'),
          coalesce(new.raw_user_meta_data->>'first_name',''),
          coalesce(new.raw_user_meta_data->>'last_name',''),
          new.email,
          coalesce(new.raw_user_meta_data->>'phone',''),
          coalesce(new.raw_user_meta_data->>'lang','fr'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── RPC : entreprise ─────────────────────────
create or replace function public.create_company(p jsonb) returns public.companies
language plpgsql security definer set search_path = public as $$
declare c public.companies; ref uuid;
begin
  perform set_config('ay.trusted','1',true);
  if public.my_company() is not null then raise exception 'Vous avez déjà une entreprise'; end if;
  if coalesce(p->>'referral','') <> '' then
    select id into ref from public.companies where referral_code = upper(p->>'referral');
  end if;
  insert into public.companies(owner_id, name, siret, siren, trades, city, zip, address, phone, email, referred_by, settings)
  values (auth.uid(), p->>'name', coalesce(p->>'siret',''), left(regexp_replace(coalesce(p->>'siret',''),'\D','','g'),9),
          coalesce(array(select jsonb_array_elements_text(p->'trades')),'{}'),
          coalesce(p->>'city',''), coalesce(p->>'zip',''), coalesce(p->>'address',''),
          coalesce(p->>'phone',''), coalesce(p->>'email',''), ref,
          '{"planning":{"view":"week","hours":[7,19],"weekend":false,"colorBy":"team","days":[1,2,3,4,5,6],"slot":[8,18],"duration":60,"manual":true,"reminder":24,"visio":true},"docs":{"quotePrefix":"DE","invoicePrefix":"FA","creditPrefix":"AV","vat":20,"validity":30,"paymentTerms":"30 jours fin de mois","penalties":"3 fois le taux d''intérêt légal","discount":"Aucun pour paiement anticipé","onlinePayment":true,"einvoice":true},"pdf":{"color":"#7F1111","footer":""},"notifications":{"push":true,"email":true,"sms":false}}'::jsonb)
  returning * into c;
  update public.profiles set kind='artisan', company_id = c.id, member_role='gerant' where id = auth.uid();
  insert into public.teams(company_id, name, color) values (c.id, 'Équipe principale', '#00123B');
  return c;
end $$;

create or replace function public.join_company(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare i public.company_invites;
begin
  perform set_config('ay.trusted','1',true);
  select * into i from public.company_invites where code = upper(p_code) and used_by is null;
  if i is null then raise exception 'Code invalide ou déjà utilisé'; end if;
  update public.profiles set kind='artisan', company_id=i.company_id, member_role=i.member_role, team_id=i.team_id,
    permissions = case i.member_role
      when 'ouvrier' then '{"planning":true,"clients":false,"devis":false,"prix":false,"kpi":false}'::jsonb
      when 'chef' then '{"planning":true,"clients":true,"devis":true,"prix":true,"kpi":false}'::jsonb
      else '{"planning":true,"clients":true,"devis":true,"prix":true,"kpi":true}'::jsonb end
  where id = auth.uid();
  update public.company_invites set used_by = auth.uid() where code = i.code;
  return i.company_id;
end $$;

-- Numérotation légale : séquence continue par entreprise, type et année
create or replace function public.finalize_document(p_id uuid) returns public.documents
language plpgsql security definer set search_path = public as $$
declare d public.documents; c public.companies; cl public.clients; prefix text; yr text; n int; key text;
begin
  select * into d from public.documents where id = p_id for update;
  if d is null or d.company_id <> public.my_company() then raise exception 'Document introuvable'; end if;
  if d.number is not null then return d; end if;
  select * into c from public.companies where id = d.company_id for update;
  select * into cl from public.clients where id = d.client_id;
  prefix := case d.kind when 'devis' then coalesce(c.settings->'docs'->>'quotePrefix','DE')
                        when 'avoir' then coalesce(c.settings->'docs'->>'creditPrefix','AV')
                        else coalesce(c.settings->'docs'->>'invoicePrefix','FA') end;
  yr := to_char(coalesce(d.issue_date, current_date), 'YYYY');
  key := prefix || '-' || yr;
  n := coalesce((c.counters->>key)::int, 0) + 1;
  update public.companies set counters = coalesce(counters,'{}'::jsonb) || jsonb_build_object(key, n) where id = c.id;
  update public.documents set
    number = key || '-' || lpad(n::text, 4, '0'),
    status = case when d.kind = 'devis' then 'envoye' else 'envoyee' end,
    sent_at = now(),
    locked = (d.kind <> 'devis'),
    snapshot = jsonb_build_object('company', to_jsonb(c) - 'counters' - 'settings', 'client', to_jsonb(cl))
  where id = p_id returning * into d;
  return d;
end $$;

-- Une facture émise ne se modifie plus (seuls statut / paiements bougent) et ne se supprime pas
create or replace function public.protect_documents() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.number is not null and old.kind <> 'devis' then raise exception 'Une facture numérotée ne peut pas être supprimée : créez un avoir.'; end if;
    return old;
  end if;
  if old.locked and (new.lines is distinct from old.lines or new.totals is distinct from old.totals
     or new.client_id is distinct from old.client_id or new.number is distinct from old.number
     or new.issue_date is distinct from old.issue_date) then
    raise exception 'Cette facture est émise : elle ne peut plus être modifiée. Créez un avoir.';
  end if;
  return new;
end $$;
create trigger documents_protect before update or delete on public.documents
  for each row execute function public.protect_documents();

-- Paiements → statut de la facture
create or replace function public.sync_paid() returns trigger
language plpgsql security definer set search_path = public as $$
declare did uuid; total numeric; paid numeric;
begin
  did := coalesce(new.document_id, old.document_id);
  select coalesce((totals->>'ttc')::numeric,0) into total from public.documents where id = did;
  select coalesce(sum(amount),0) into paid from public.payments where document_id = did;
  update public.documents set paid_amount = paid,
    status = case when paid >= total - 0.005 and total > 0 then 'payee' when paid > 0 then 'partielle' else status end
  where id = did;
  return null;
end $$;
create trigger payments_sync after insert or update or delete on public.payments
  for each row execute function public.sync_paid();

-- ───────────────────────── RPC : côté particulier ─────────────────────────
-- Annuaire (réservé aux inscrits) : seulement les champs publics
create or replace function public.directory_search(p_query text default '', p_trade text default '', p_city text default '')
returns table(id uuid, name text, trade_name text, city text, zip text, trades text[], zone text, verified boolean,
              rating numeric, reviews_count int, visio boolean, is_mine boolean, logo_path text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.trade_name, c.city, c.zip, c.trades, c.zone, c.verified,
    (select round(avg(rating)::numeric,1) from public.reviews r where r.company_id = c.id and r.status='publie'),
    (select count(*)::int from public.reviews r where r.company_id = c.id and r.status='publie'),
    coalesce((c.settings->'planning'->>'visio')::boolean, true),
    exists(select 1 from public.clients cl where cl.company_id = c.id and cl.user_id = auth.uid()),
    c.logo_path
  from public.companies c
  where auth.uid() is not null
    and (c.visible_particuliers or exists(select 1 from public.clients cl where cl.company_id = c.id and cl.user_id = auth.uid())
         or c.visible_pros and public.my_company() is not null)
    and (p_query = '' or c.name ilike '%'||p_query||'%' or c.trade_name ilike '%'||p_query||'%' or array_to_string(c.trades,' ') ilike '%'||p_query||'%')
    and (p_trade = '' or array_to_string(c.trades,' ') ilike '%'||p_trade||'%')
    and (p_city = '' or c.city ilike '%'||p_city||'%' or c.zone ilike '%'||p_city||'%')
  order by c.verified desc, c.name
  limit 100
$$;

create or replace function public.directory_get(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'id', c.id, 'name', c.name, 'trade_name', c.trade_name, 'city', c.city, 'zip', c.zip, 'address', c.address,
    'phone', c.phone, 'email', c.email, 'website', c.website, 'trades', c.trades, 'zone', c.zone,
    'certifications', c.certifications, 'description', c.description, 'siren', c.siren, 'verified', c.verified,
    'logo_path', c.logo_path, 'planning', c.settings->'planning',
    'rating', (select round(avg(rating)::numeric,1) from public.reviews r where r.company_id=c.id and r.status='publie'),
    'distribution', (select jsonb_object_agg(s, (select count(*) from public.reviews r where r.company_id=c.id and r.status='publie' and r.rating=s)) from generate_series(1,5) s),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('rating',rating,'comment',comment,'author',author_label,'reply',reply,'created_at',created_at) order by created_at desc)
                 from (select * from public.reviews r where r.company_id=c.id and r.status='publie' order by created_at desc limit 20) r),'[]'::jsonb),
    'photos', coalesce((select jsonb_agg(path) from (select path from public.files f where f.company_id=c.id and f.kind='photo' and f.shared_with_pros limit 12) f),'[]'::jsonb)
  ) end
  from public.companies c where c.id = p_id
$$;

-- Créneaux occupés d'un artisan (sans aucun détail)
create or replace function public.busy_slots(p_company uuid, p_from timestamptz, p_to timestamptz)
returns table(start_at timestamptz, end_at timestamptz)
language sql stable security definer set search_path = public as $$
  select start_at, end_at from public.appointments
  where company_id = p_company and status in ('a_valider','valide') and start_at < p_to and end_at > p_from and auth.uid() is not null
$$;

-- Lien particulier ↔ fiche client chez l'artisan (créée si besoin)
create or replace function public.ensure_client(p_company uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid; p public.profiles; n int;
begin
  select id into cid from public.clients where company_id = p_company and user_id = auth.uid();
  if cid is not null then return cid; end if;
  select * into p from public.profiles where id = auth.uid();
  select count(*)+1 into n from public.clients where company_id = p_company;
  insert into public.clients(company_id, user_id, type, last_name, first_name, email, mobile, number,
     billing_address, billing_zip, billing_city, site_address, site_zip, site_city)
  values (p_company, auth.uid(), 'particulier', p.last_name, p.first_name, p.email, p.phone, 'CL-'||lpad(n::text,5,'0'),
     coalesce(p.home->>'address',''), coalesce(p.home->>'zip',''), coalesce(p.home->>'city',''),
     coalesce(p.home->>'address',''), coalesce(p.home->>'zip',''), coalesce(p.home->>'city',''))
  returning id into cid;
  return cid;
end $$;

create or replace function public.request_appointment(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid; pid uuid; aid uuid; comp uuid := (p->>'company_id')::uuid; prof public.profiles; conv uuid;
begin
  cid := public.ensure_client(comp);
  select * into prof from public.profiles where id = auth.uid();
  insert into public.projects(company_id, client_id, title, address)
    values (comp, cid, coalesce(nullif(p->>'title',''), p->>'type'), coalesce(prof.home->>'address','') || ' ' || coalesce(prof.home->>'city',''))
    returning id into pid;
  insert into public.appointments(company_id, client_id, project_id, type, title, start_at, end_at, mode, status, request_text, photos,
     address, contact_name, contact_phone, requested_by)
  values (comp, cid, pid, p->>'type', coalesce(nullif(p->>'title',''), p->>'type'), (p->>'start_at')::timestamptz, (p->>'end_at')::timestamptz,
     coalesce(p->>'mode','site'), 'a_valider', coalesce(p->>'text',''), coalesce(p->'photos','[]'::jsonb),
     trim(coalesce(prof.home->>'address','') || ', ' || coalesce(prof.home->>'zip','') || ' ' || coalesce(prof.home->>'city',''), ', '),
     trim(prof.first_name || ' ' || prof.last_name), prof.phone, auth.uid())
  returning id into aid;
  -- conversation client
  select id into conv from public.conversations where kind='client' and company_id=comp and client_user_id=auth.uid();
  if conv is null then
    insert into public.conversations(kind, company_id, client_id, client_user_id, project_id) values ('client', comp, cid, auth.uid(), pid) returning id into conv;
  end if;
  if coalesce(p->>'text','') <> '' then
    insert into public.messages(conversation_id, sender_id, sender_name, body, attachments)
    values (conv, auth.uid(), trim(prof.first_name || ' ' || prof.last_name), p->>'text', coalesce(p->'photos','[]'::jsonb));
  end if;
  perform public.notify_company(comp, 'rdv', 'Nouvelle demande de RDV', trim(prof.first_name||' '||prof.last_name)||' · '||coalesce(p->>'type',''), '/pro/planning/rdv/'||aid);
  return aid;
end $$;

create or replace function public.start_conversation(p_company uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare conv uuid; cid uuid; mine uuid := public.my_company();
begin
  if mine is not null then
    if mine = p_company then raise exception 'Impossible'; end if;
    select id into conv from public.conversations where kind='pro' and ((company_id=mine and other_company_id=p_company) or (company_id=p_company and other_company_id=mine));
    if conv is null then insert into public.conversations(kind, company_id, other_company_id) values ('pro', mine, p_company) returning id into conv; end if;
    return conv;
  end if;
  cid := public.ensure_client(p_company);
  select id into conv from public.conversations where kind='client' and company_id=p_company and client_user_id=auth.uid();
  if conv is null then insert into public.conversations(kind, company_id, client_id, client_user_id) values ('client', p_company, cid, auth.uid()) returning id into conv; end if;
  return conv;
end $$;

create or replace function public.client_appointment_action(p_id uuid, p_action text, p jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare a public.appointments;
begin
  select * into a from public.appointments where id = p_id and client_id in (select public.my_client_ids());
  if a is null then raise exception 'RDV introuvable'; end if;
  if p_action = 'cancel' then
    update public.appointments set status='annule' where id=p_id;
    perform public.notify_company(a.company_id,'rdv','RDV annulé par le client', a.title, '/pro/planning/rdv/'||p_id);
  elsif p_action = 'move' then
    update public.appointments set start_at=(p->>'start_at')::timestamptz, end_at=(p->>'end_at')::timestamptz, status='a_valider' where id=p_id;
    perform public.notify_company(a.company_id,'rdv','Le client propose un autre créneau', a.title, '/pro/planning/rdv/'||p_id);
  end if;
end $$;

create or replace function public.client_quote_action(p_id uuid, p_action text, p_reason text default '') returns void
language plpgsql security definer set search_path = public as $$
declare d public.documents;
begin
  select * into d from public.documents where id=p_id and kind='devis' and client_id in (select public.my_client_ids()) and number is not null;
  if d is null then raise exception 'Devis introuvable'; end if;
  if p_action = 'refuse' then
    update public.documents set status='refuse', refused_at=now(), conditions = conditions || jsonb_build_object('refusal_reason', p_reason) where id=p_id;
    perform public.notify_company(d.company_id,'documents','Devis refusé', d.number, '/pro/documents/'||p_id);
  end if;
end $$;

create or replace function public.post_review(p_company uuid, p_rating int, p_comment text) returns void
language plpgsql security definer set search_path = public as $$
declare a uuid; prof public.profiles;
begin
  select ap.id into a from public.appointments ap
   where ap.company_id = p_company and ap.client_id in (select public.my_client_ids())
     and ap.status in ('valide','termine') and ap.start_at < now()
   order by ap.start_at desc limit 1;
  if a is null then raise exception 'Un avis ne peut être donné qu''après un vrai rendez-vous.'; end if;
  select * into prof from public.profiles where id = auth.uid();
  insert into public.reviews(company_id, author_id, author_label, appointment_id, rating, comment)
  values (p_company, auth.uid(), prof.first_name || ' ' || left(prof.last_name,1) || '.', a, p_rating, p_comment);
  perform public.notify_company(p_company,'systeme','Nouvel avis client', p_rating||'/5', '/pro/reglages/profil-public');
end $$;

-- ───────────────────────── Notifications automatiques ─────────────────────────
create or replace function public.on_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.conversations;
begin
  select * into c from public.conversations where id = new.conversation_id;
  update public.conversations set last_message = left(coalesce(nullif(new.body,''), case when new.card is not null then new.card->>'title' else '📎 Pièce jointe' end), 140), last_at = new.created_at where id = c.id;
  if c.client_user_id is not null and c.client_user_id <> new.sender_id then
    insert into public.notifications(user_id, category, title, body, link) values (c.client_user_id, 'message', 'Nouveau message', coalesce(new.sender_name,'') || ' : ' || left(coalesce(nullif(new.body,''), new.card->>'title', '📎'),80), '/client/messages/'||c.id);
  end if;
  return new;
end $$;
create trigger messages_after after insert on public.messages for each row execute function public.on_message();

create or replace function public.on_appointment() returns trigger
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  select user_id into uid from public.clients where id = new.client_id;
  if uid is null or uid = auth.uid() then return new; end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.notifications(user_id, category, title, body, link) values (uid, 'rdv',
      case new.status when 'valide' then 'RDV confirmé' when 'refuse' then 'RDV refusé' when 'annule' then 'RDV annulé' when 'termine' then 'Intervention terminée' else 'RDV mis à jour' end,
      new.title || ' · ' || to_char(new.start_at at time zone 'Europe/Paris','DD/MM HH24:MI'), '/client/rdv/'||new.id);
  elsif tg_op = 'UPDATE' and new.start_at is distinct from old.start_at then
    insert into public.notifications(user_id, category, title, body, link) values (uid,'rdv','RDV déplacé', new.title || ' · ' || to_char(new.start_at at time zone 'Europe/Paris','DD/MM HH24:MI'), '/client/rdv/'||new.id);
  elsif tg_op = 'UPDATE' and new.enroute_at is distinct from old.enroute_at and new.enroute_at is not null then
    insert into public.notifications(user_id, category, title, body, link) values (uid,'rdv','Votre artisan est en route',
      coalesce('Arrivée prévue vers ' || to_char(new.eta_at at time zone 'Europe/Paris','HH24"h"MI'), ''), '/client/rdv/'||new.id||'?enroute=1');
  elsif tg_op = 'INSERT' then
    insert into public.notifications(user_id, category, title, body, link) values (uid,'rdv','Nouveau RDV', new.title || ' · ' || to_char(new.start_at at time zone 'Europe/Paris','DD/MM HH24:MI'), '/client/rdv/'||new.id);
  end if;
  return new;
end $$;
create trigger appointments_after after insert or update on public.appointments for each row execute function public.on_appointment();

create or replace function public.on_document() returns trigger
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  select user_id into uid from public.clients where id = new.client_id;
  if uid is null then return new; end if;
  if new.number is not null and old.number is null then
    insert into public.notifications(user_id, category, title, body, link) values (uid, 'documents',
      case when new.kind='devis' then 'Nouveau devis à signer' when new.kind='avoir' then 'Nouvel avoir' else 'Nouvelle facture' end,
      new.number || ' · ' || coalesce(new.object,''), case when new.kind='devis' then '/client/devis/' else '/client/factures/' end || new.id);
  elsif new.status = 'payee' and old.status <> 'payee' then
    insert into public.notifications(user_id, category, title, body, link) values (uid,'paiement','Paiement enregistré', new.number, '/client/factures/'||new.id);
  end if;
  return new;
end $$;
create trigger documents_after after update on public.documents for each row execute function public.on_document();

-- ───────────────────────── Sécurité (RLS) ─────────────────────────
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.teams enable row level security;
alter table public.company_invites enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.project_shares enable row level security;
alter table public.items enable row level security;
alter table public.documents enable row level security;
alter table public.payments enable row level security;
alter table public.purchases enable row level security;
alter table public.appointments enable row level security;
alter table public.files enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.conversation_reads enable row level security;
alter table public.network enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;

create policy profiles_sel on public.profiles for select using (id = auth.uid() or (company_id is not null and company_id = public.my_company()));
create policy profiles_upd_self on public.profiles for update using (id = auth.uid())
  with check (id = auth.uid() and company_id is not distinct from public.my_company());
create policy profiles_upd_gerant on public.profiles for update using (company_id = public.my_company() and public.is_gerant());

create policy companies_sel on public.companies for select using (id = public.my_company() or id in (select pro_id from public.network where company_id = public.my_company()));
create policy companies_upd on public.companies for update using (id = public.my_company() and public.is_gerant());

create policy teams_all on public.teams for all using (company_id = public.my_company()) with check (company_id = public.my_company() and public.is_gerant());
create policy teams_sel on public.teams for select using (company_id = public.my_company());
create policy invites_all on public.company_invites for all using (company_id = public.my_company() and public.is_gerant()) with check (company_id = public.my_company() and public.is_gerant());

create policy clients_company on public.clients for all using (company_id = public.my_company()) with check (company_id = public.my_company());
create policy clients_self on public.clients for select using (user_id = auth.uid());

create policy projects_company on public.projects for all using (company_id = public.my_company()) with check (company_id = public.my_company());
create policy projects_client on public.projects for select using (client_id in (select public.my_client_ids()));
create policy projects_shared on public.projects for select using (id in (select project_id from public.project_shares where company_id = public.my_company()));
create policy shares_company on public.project_shares for all using (project_id in (select id from public.projects where company_id = public.my_company()) or company_id = public.my_company())
  with check (project_id in (select id from public.projects where company_id = public.my_company()));

create policy items_company on public.items for all using (company_id = public.my_company()) with check (company_id = public.my_company());

create policy documents_company on public.documents for all using (company_id = public.my_company()) with check (company_id = public.my_company());
create policy documents_client on public.documents for select using (number is not null and client_id in (select public.my_client_ids()));

create policy payments_company on public.payments for all using (company_id = public.my_company()) with check (company_id = public.my_company());
create policy payments_client on public.payments for select using (document_id in (select id from public.documents where client_id in (select public.my_client_ids())));
create policy purchases_company on public.purchases for all using (company_id = public.my_company()) with check (company_id = public.my_company());

create policy appointments_company on public.appointments for all using (company_id = public.my_company()) with check (company_id = public.my_company());
create policy appointments_client on public.appointments for select using (client_id in (select public.my_client_ids()));

create policy files_company on public.files for all using (company_id = public.my_company()) with check (company_id = public.my_company());
create policy files_client on public.files for select using (
  (client_id in (select public.my_client_ids()) and (shared_with_client or kind = 'photo'))
  or (kind = 'vault' and shared_with_client and company_id in (select company_id from public.clients where user_id = auth.uid())));
create policy files_client_ins on public.files for insert with check (client_id in (select public.my_client_ids()) and company_id in (select company_id from public.clients where user_id = auth.uid()));

create policy conv_sel on public.conversations for select using (public.can_see_conversation(conversations));
create policy conv_ins on public.conversations for insert with check (company_id = public.my_company());
create policy conv_upd on public.conversations for update using (public.can_see_conversation(conversations));

create policy msg_sel on public.messages for select using (exists(select 1 from public.conversations c where c.id = conversation_id and public.can_see_conversation(c)));
create policy msg_ins on public.messages for insert with check (sender_id = auth.uid() and exists(select 1 from public.conversations c where c.id = conversation_id and public.can_see_conversation(c)));

create policy reads_self on public.conversation_reads for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy network_company on public.network for all using (company_id = public.my_company()) with check (company_id = public.my_company());

create policy reviews_sel on public.reviews for select using (status = 'publie' or company_id = public.my_company() or author_id = auth.uid());
create policy reviews_reply on public.reviews for update using (company_id = public.my_company());

create policy notif_self on public.notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────────────────── Stockage des fichiers ─────────────────────────
insert into storage.buckets (id, name, public) values ('files', 'files', false) on conflict do nothing;
-- Chemins : <company_id>/... pour l'entreprise, u/<user_id>/... pour un particulier
create policy files_storage_company on storage.objects for all to authenticated
  using (bucket_id = 'files' and ((storage.foldername(name))[1] = public.my_company()::text
          or ((storage.foldername(name))[1] = 'u' and (storage.foldername(name))[2] = auth.uid()::text)))
  with check (bucket_id = 'files' and ((storage.foldername(name))[1] = public.my_company()::text
          or ((storage.foldername(name))[1] = 'u' and (storage.foldername(name))[2] = auth.uid()::text)));
-- Un particulier peut lire les fichiers de l'entreprise qui le concernent (référencés dans files ou messages)
create policy files_storage_client_read on storage.objects for select to authenticated
  using (bucket_id = 'files' and (
    exists(select 1 from public.files f where f.path = name and (f.client_id in (select public.my_client_ids()) or (f.kind='vault' and f.shared_with_client)))
    or exists(select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
              where public.can_see_conversation(c) and m.attachments @> jsonb_build_array(jsonb_build_object('path', name)))
    or (storage.foldername(name))[2] = 'logo'));

-- Le particulier voit les infos de ses artisans ; un pro voit les entreprises avec qui il échange
create policy companies_client on public.companies for select using (id in (select company_id from public.clients where user_id = auth.uid()));
create policy companies_conv on public.companies for select using (
  id in (select c.company_id from public.conversations c where c.other_company_id = public.my_company())
  or id in (select c.other_company_id from public.conversations c where c.company_id = public.my_company()));
