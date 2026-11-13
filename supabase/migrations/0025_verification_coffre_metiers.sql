-- 0025 : 1) les documents du coffre-fort déposés par un pro sont vérifiés par l'équipe Artesa avant d'être visibles des clients ;
--        2) un pro peut proposer un métier absent de la liste ; il l'utilise tout de suite, l'équipe le valide (ou corrige,
--           fusionne avec un existant, refuse) avant qu'il n'apparaisse pour les autres.

-- ───────────── 1) Coffre-fort : statut de vérification ─────────────
alter table public.files add column if not exists review_status text not null default 'valide';
alter table public.files add column if not exists review_note text not null default '';
alter table public.files add column if not exists reviewed_at timestamptz;
alter table public.files add column if not exists meta jsonb not null default '{}';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'files_review_status_check') then
    alter table public.files add constraint files_review_status_check check (review_status in ('en_attente', 'valide', 'refuse'));
  end if;
end $$;
create index if not exists ix_files_vault_review on public.files(review_status) where kind = 'vault';

-- Seule l'équipe Artesa fixe le statut. Tout dépôt (ou changement de fichier, de dates, de type) d'un pro repasse « en attente ».
create or replace function private.files_review_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.review_status := case when new.kind = 'vault' then 'en_attente' else 'valide' end;
    new.review_note := ''; new.reviewed_at := null;
  elsif new.kind = 'vault' and (new.path is distinct from old.path or new.doc_type is distinct from old.doc_type
        or new.issued_at is distinct from old.issued_at or new.valid_until is distinct from old.valid_until or new.meta is distinct from old.meta) then
    new.review_status := 'en_attente'; new.review_note := ''; new.reviewed_at := null;
  else
    new.review_status := old.review_status; new.review_note := old.review_note; new.reviewed_at := old.reviewed_at;
  end if;
  return new;
end $$;
drop trigger if exists files_review_guard on public.files;
create trigger files_review_guard before insert or update on public.files for each row execute function private.files_review_guard();

-- Prévenir l'équipe à chaque dépôt à vérifier
create or replace function private.files_notify_admins() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'vault' and new.review_status = 'en_attente'
     and (tg_op = 'INSERT' or old.review_status is distinct from 'en_attente') then
    insert into public.notifications(user_id, category, title, body, link)
    select a.user_id, 'documents', 'Document à vérifier',
      coalesce((select coalesce(nullif(trade_name, ''), name) from public.companies where id = new.company_id), '') || ' · ' || new.name,
      '/pro/admin?tab=coffre'
    from public.admins a;
  end if;
  return new;
end $$;
drop trigger if exists files_notify_admins on public.files;
create trigger files_notify_admins after insert or update of review_status on public.files for each row execute function private.files_notify_admins();

-- Lecture : un document du coffre-fort n'est visible des clients qu'une fois validé ; l'équipe voit tout le coffre-fort
drop policy if exists files_sel on public.files;
create policy files_sel on public.files for select to authenticated
  using (
    company_id = (select my_company())
    or (client_id in (select my_client_ids()) and (shared_with_client or kind = 'photo'))
    or (kind = 'vault' and shared_with_client and review_status = 'valide'
        and company_id in (select clients.company_id from public.clients where clients.user_id = (select auth.uid())))
    or (kind = 'vault' and (select is_admin()))
  );
drop policy if exists files_storage_client_read on storage.objects;
create policy files_storage_client_read on storage.objects for select to authenticated using (
  bucket_id = 'files' and (
    exists (select 1 from public.files f where f.path = objects.name and (
      (f.client_id in (select public.my_client_ids()) and (f.shared_with_client or f.kind = 'photo'))
      or (f.kind = 'vault' and f.shared_with_client and f.review_status = 'valide'
          and f.company_id in (select c.company_id from public.clients c where c.user_id = (select auth.uid())))
      or (f.kind = 'vault' and (select public.is_admin()))
      or (f.kind = 'photo' and f.shared_with_pros)))
    or exists (select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
               where public.can_see_conversation(c) and m.attachments @> jsonb_build_array(jsonb_build_object('path', objects.name)))
    or (storage.foldername(name))[2] = 'logo'
  ));

-- Décision de l'équipe : valide ou refuse (avec un motif), et le pro est prévenu
create or replace function public.admin_review_file(p_id uuid, p_status text, p_note text default '') returns public.files
language plpgsql security definer set search_path = public as $$
declare f public.files;
begin
  if not public.is_admin() then raise exception 'Réservé à l’équipe Artesa.'; end if;
  if p_status not in ('valide', 'refuse') then raise exception 'Statut invalide'; end if;
  update public.files set review_status = p_status, review_note = coalesce(p_note, ''), reviewed_at = now()
    where id = p_id and kind = 'vault' returning * into f;
  if f.id is null then raise exception 'Document introuvable'; end if;
  insert into public.notifications(user_id, category, title, body, link)
  select p.id, 'documents',
    case when p_status = 'valide' then 'Document validé' else 'Document refusé' end,
    f.name || case when p_status = 'refuse' and coalesce(p_note, '') <> '' then ' · ' || p_note else '' end,
    '/pro/coffre-fort/' || f.doc_type
  from public.profiles p where p.company_id = f.company_id and p.member_role = 'gerant';
  return f;
end $$;
revoke all on function public.admin_review_file(uuid, text, text) from public, anon;
grant execute on function public.admin_review_file(uuid, text, text) to authenticated;

-- ───────────── 2) Métiers ─────────────
-- Forme normalisée pour repérer les doublons : minuscules, sans accents ni ponctuation, pluriels simples retirés
create or replace function private.trade_norm(s text) returns text language sql immutable as $$
  select trim(regexp_replace(regexp_replace(regexp_replace(
    translate(lower(coalesce(s, '')), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœæ', 'aaaaaaceeeeiiiinooooouuuuyyoa'),
    '[^a-z0-9]+', ' ', 'g'),
    '([a-z]{3,})(s|x)\b', '\1', 'g'),
    '\s+', ' ', 'g'))
$$;

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Autres métiers',
  norm text not null unique,
  status text not null default 'en_attente' check (status in ('en_attente', 'valide', 'refuse')),
  builtin boolean not null default false,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.trades enable row level security;
drop policy if exists trades_sel on public.trades;
create policy trades_sel on public.trades for select to anon, authenticated
  using (status = 'valide' or created_by = (select auth.uid()) or (select public.is_admin()));
revoke insert, update, delete on public.trades from anon, authenticated;

-- La liste actuelle de l'application (web/src/lib/docs.js, TRADES) : à garder synchronisée
insert into public.trades(name, category, norm, status, builtin)
select x.name, x.cat, private.trade_norm(x.name), 'valide', true from (values
  ('Plomberie et chauffage', 'Bâtiment'), ('Électricité', 'Bâtiment'), ('Peinture', 'Bâtiment'), ('Carrelage', 'Bâtiment'), ('Menuiserie', 'Bâtiment'),
  ('Charpente', 'Bâtiment'), ('Couverture (toiture)', 'Bâtiment'), ('Maçonnerie', 'Bâtiment'), ('Plâtrerie', 'Bâtiment'), ('Serrurerie', 'Bâtiment'),
  ('Climatisation', 'Bâtiment'), ('Vitrerie', 'Bâtiment'), ('Isolation', 'Bâtiment'), ('Cuisiniste', 'Bâtiment'),
  ('Paysage', 'Extérieur'), ('Piscine', 'Extérieur'), ('Terrassement', 'Extérieur'), ('Élagage', 'Extérieur'), ('Clôture et portail', 'Extérieur'),
  ('Mécanique et carrosserie', 'Automobile'), ('Dépannage auto', 'Automobile'),
  ('Nettoyage', 'Services'), ('Déménagement', 'Services'), ('Informatique', 'Services'), ('Électroménager', 'Services'), ('Ramonage', 'Services'), ('Multiservice', 'Services')
) as x(name, cat)
on conflict (norm) do nothing;

-- Un pro propose un métier : renvoie le nom à utiliser (l'existant si c'est un doublon)
create or replace function public.propose_trade(p_name text, p_category text default 'Autres métiers') returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare n text; nm text; ex public.trades; cat text;
begin
  if auth.uid() is null then raise exception 'Connectez-vous pour ajouter un métier.'; end if;
  nm := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  nm := upper(left(nm, 1)) || substr(nm, 2);
  if length(nm) < 3 or length(nm) > 60 or nm !~ '[[:alpha:]]{3}' then raise exception 'Nom de métier invalide (3 à 60 caractères).'; end if;
  n := private.trade_norm(nm);
  select * into ex from public.trades where norm = n;
  if ex.id is not null then
    if ex.status = 'refuse' then raise exception 'Ce métier a été refusé par l’équipe Artesa. Choisissez-en un dans la liste.'; end if;
    return jsonb_build_object('name', ex.name, 'status', ex.status, 'existing', true);
  end if;
  if (select count(*) from public.trades where created_by = auth.uid() and status = 'en_attente') >= 5 then
    raise exception 'Vous avez déjà 5 métiers en attente de validation.';
  end if;
  cat := coalesce(nullif(trim(p_category), ''), 'Autres métiers');
  insert into public.trades(name, category, norm) values (nm, left(cat, 40), n);
  insert into public.notifications(user_id, category, title, body, link)
  select a.user_id, 'systeme', 'Nouveau métier proposé', nm || ' (' || cat || ')', '/pro/admin?tab=metiers' from public.admins a;
  return jsonb_build_object('name', nm, 'status', 'en_attente', 'existing', false);
end $$;
revoke all on function public.propose_trade(text, text) from public, anon;
grant execute on function public.propose_trade(text, text) to authenticated;

-- Les entreprises enregistrent toujours le nom officiel d'un métier connu (évite « plombier » / « Plomberie »)
create or replace function private.companies_trades_canon() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if new.trades is not null and (tg_op = 'INSERT' or new.trades is distinct from old.trades) then
    new.trades := array(
      select distinct on (coalesce(tr.name, x)) coalesce(tr.name, x)
      from unnest(new.trades) with ordinality u(x, i)
      left join public.trades tr on tr.norm = private.trade_norm(u.x) and tr.status <> 'refuse'
      where coalesce(tr.status, '') <> 'refuse'
      order by coalesce(tr.name, x), i);
  end if;
  return new;
end $$;
drop trigger if exists companies_trades_canon on public.companies;
create trigger companies_trades_canon before insert or update of trades on public.companies for each row execute function private.companies_trades_canon();

-- Décision de l'équipe : valider (en corrigeant le nom / la catégorie), fusionner avec un métier existant, ou refuser.
-- Les fiches des entreprises qui l'utilisent sont mises à jour.
create or replace function public.admin_review_trade(p_id uuid, p_action text, p_name text default null, p_category text default null) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare tr public.trades; target public.trades; nm text; n text;
begin
  if not public.is_admin() then raise exception 'Réservé à l’équipe Artesa.'; end if;
  select * into tr from public.trades where id = p_id;
  if tr.id is null then raise exception 'Métier introuvable'; end if;
  if p_action = 'refuse' then
    update public.trades set status = 'refuse', reviewed_at = now() where id = tr.id;
    update public.companies set trades = array_remove(trades, tr.name) where tr.name = any(trades);
    if tr.created_by is not null then
      insert into public.notifications(user_id, category, title, body, link)
      values (tr.created_by, 'systeme', 'Métier non retenu', tr.name || ' : choisissez le métier le plus proche dans la liste.', '/pro/compte/entreprise');
    end if;
    return jsonb_build_object('status', 'refuse');
  end if;
  if p_action <> 'valide' then raise exception 'Action invalide'; end if;
  nm := regexp_replace(trim(coalesce(nullif(p_name, ''), tr.name)), '\s+', ' ', 'g');
  n := private.trade_norm(nm);
  select * into target from public.trades where norm = n and id <> tr.id;
  if target.id is not null then
    -- Doublon : on fusionne dans le métier existant
    update public.companies set trades = array_replace(trades, tr.name, target.name) where tr.name = any(trades);
    delete from public.trades where id = tr.id;
    update public.trades set status = 'valide', reviewed_at = now() where id = target.id and status = 'en_attente';
    nm := target.name;
  else
    update public.trades set name = nm, norm = n, category = coalesce(nullif(trim(p_category), ''), category), status = 'valide', reviewed_at = now() where id = tr.id;
    if nm <> tr.name then update public.companies set trades = array_replace(trades, tr.name, nm) where tr.name = any(trades); end if;
  end if;
  if tr.created_by is not null then
    insert into public.notifications(user_id, category, title, body, link)
    values (tr.created_by, 'systeme', 'Métier validé', nm || ' est maintenant proposé à tous les pros et aux particuliers.', '/pro/compte/entreprise');
  end if;
  return jsonb_build_object('status', 'valide', 'name', nm, 'merged', target.id is not null);
end $$;
revoke all on function public.admin_review_trade(uuid, text, text, text) from public, anon;
grant execute on function public.admin_review_trade(uuid, text, text, text) to authenticated;
