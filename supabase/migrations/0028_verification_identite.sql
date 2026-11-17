-- 0028 · Vérification d'identité
--  - Pros : pièce d'identité du dirigeant, obligatoire pour que l'entreprise soit validée (visible et autorisée
--    à transmettre devis et factures aux particuliers inscrits sur Artesa).
--  - Particuliers : compte certifié (facultatif) après contrôle de leur pièce d'identité.
--  - La copie de la pièce n'est PAS conservée : elle est supprimée dès le contrôle fait. On garde seulement
--    le résultat, la date et qui a vérifié (RGPD art. 5.1.c minimisation, 5.1.e limitation de la conservation,
--    art. 25 protection des données dès la conception ; recommandations de la CNIL).
-- Migration additive : aucune donnée existante n'est modifiée ni supprimée.

-- Espace de stockage privé dédié, séparé des fichiers de l'entreprise
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('identity', 'identity', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do nothing;

create policy identity_upload_own on storage.objects for insert to authenticated
  with check (bucket_id = 'identity' and (storage.foldername(name))[1] = auth.uid()::text);
create policy identity_admin_read on storage.objects for select to authenticated
  using (bucket_id = 'identity' and public.is_admin());
create policy identity_delete on storage.objects for delete to authenticated
  using (bucket_id = 'identity' and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text));

create table if not exists public.identity_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('dirigeant','client')),
  company_id uuid references public.companies(id) on delete cascade,
  doc_type text not null check (doc_type in ('cni','passeport','titre_sejour','permis')),
  holder_name text not null default '',
  file_path text,                       -- vidé dès que la copie est supprimée
  status text not null default 'en_attente' check (status in ('en_attente','verifie','refuse','annule')),
  note text default '',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  file_deleted_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists identity_checks_user on public.identity_checks(user_id, purpose, created_at desc);
alter table public.identity_checks enable row level security;
create policy identity_checks_sel on public.identity_checks for select using (user_id = auth.uid() or public.is_admin());

-- Dépôt d'une pièce (la copie a été envoyée dans identity/<uid>/…)
create or replace function public.identity_submit(p_purpose text, p_doc_type text, p_path text, p_holder text)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); co uuid; rid uuid;
begin
  if uid is null then raise exception 'Connectez-vous.'; end if;
  if p_purpose not in ('dirigeant','client') then raise exception 'Type de vérification inconnu'; end if;
  if coalesce(p_path,'') !~ ('^' || uid::text || '/') then raise exception 'Fichier invalide'; end if;
  if length(coalesce(trim(p_holder),'')) < 3 then raise exception 'Indiquez le nom tel qu''il figure sur la pièce.'; end if;
  if p_purpose = 'dirigeant' then
    select id into co from public.companies where owner_id = uid;
    if co is null then raise exception 'Seul le dirigeant qui a créé l''entreprise peut envoyer sa pièce.'; end if;
  end if;
  if exists (select 1 from public.identity_checks where user_id = uid and purpose = p_purpose and status = 'verifie') then
    raise exception 'Votre identité est déjà vérifiée.'; end if;
  -- une seule demande en attente à la fois
  update public.identity_checks set status = 'annule' where user_id = uid and purpose = p_purpose and status = 'en_attente';
  insert into public.identity_checks(user_id, purpose, company_id, doc_type, holder_name, file_path)
  values (uid, p_purpose, co, p_doc_type, left(trim(p_holder), 120), p_path) returning id into rid;
  return rid;
end $$;
revoke execute on function public.identity_submit(text, text, text, text) from public, anon;
grant execute on function public.identity_submit(text, text, text, text) to authenticated;

-- Décision de l'équipe ; renvoie le chemin de la copie à supprimer immédiatement
create or replace function public.admin_identity_review(p_id uuid, p_status text, p_note text default '')
returns text language plpgsql security definer set search_path = public as $$
declare r public.identity_checks;
begin
  if not public.is_admin() then raise exception 'Réservé à l''équipe Artesa'; end if;
  if p_status not in ('verifie','refuse') then raise exception 'Décision inconnue'; end if;
  if p_status = 'refuse' and coalesce(trim(p_note),'') = '' then raise exception 'Indiquez le motif du refus.'; end if;
  update public.identity_checks set status = p_status, note = coalesce(trim(p_note),''), reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_id and status = 'en_attente' returning * into r;
  if r.id is null then raise exception 'Demande déjà traitée'; end if;
  insert into public.notifications(user_id, category, title, body, link)
  values (r.user_id, 'systeme',
    case when p_status = 'verifie' then 'Identité vérifiée' else 'Pièce d''identité refusée' end,
    case when p_status = 'verifie' then 'Votre identité est vérifiée. La copie de votre pièce a été supprimée.'
         else 'Motif : ' || trim(p_note) || '. La copie a été supprimée ; vous pouvez en envoyer une nouvelle.' end,
    case when r.purpose = 'dirigeant' then '/pro/compte/entreprise' else '/client/compte' end);
  return r.file_path;
end $$;
revoke execute on function public.admin_identity_review(uuid, text, text) from public, anon;
grant execute on function public.admin_identity_review(uuid, text, text) to authenticated;

-- Confirme la suppression de la copie (appelée juste après la suppression du fichier)
create or replace function public.identity_file_deleted(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.identity_checks set file_path = null, file_deleted_at = now()
  where id = p_id and (public.is_admin() or (user_id = auth.uid() and status in ('en_attente','annule')));
end $$;
revoke execute on function public.identity_file_deleted(uuid) from public, anon;
grant execute on function public.identity_file_deleted(uuid) to authenticated;

-- Le particulier annule sa demande (la copie est supprimée côté application)
create or replace function public.identity_cancel(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare r public.identity_checks;
begin
  update public.identity_checks set status = 'annule' where id = p_id and user_id = auth.uid() and status = 'en_attente' returning * into r;
  return r.file_path;
end $$;
revoke execute on function public.identity_cancel(uuid) from public, anon;
grant execute on function public.identity_cancel(uuid) to authenticated;

-- Compte certifié : visible par les entreprises dont la personne est cliente
create or replace function public.client_certified(p_client uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select max(i.reviewed_at) from public.clients c join public.identity_checks i on i.user_id = c.user_id
  where c.id = p_client and c.company_id = public.my_company() and i.purpose = 'client' and i.status = 'verifie'
$$;
revoke execute on function public.client_certified(uuid) from public, anon;
grant execute on function public.client_certified(uuid) to authenticated;

-- Validation d'une entreprise : la pièce du dirigeant doit être vérifiée
create or replace function public.admin_review_company(p_id uuid, p_status text, p_note text default '') returns public.companies
language plpgsql security definer set search_path = public as $$
declare c public.companies;
begin
  if not public.is_admin() then raise exception 'Réservé à l''équipe Artesa.'; end if;
  if p_status = 'approved' and not exists (
    select 1 from public.identity_checks i join public.companies co on co.id = p_id
    where i.user_id = co.owner_id and i.purpose = 'dirigeant' and i.status = 'verifie') then
    raise exception 'La pièce d''identité du dirigeant n''est pas encore vérifiée.';
  end if;
  update public.companies set verification_status = p_status, verified = (p_status = 'approved'), verification_note = coalesce(p_note,''), verified_at = now()
  where id = p_id returning * into c;
  perform public.notify_company(p_id, 'systeme',
    case when p_status = 'approved' then 'Votre entreprise est validée' else 'Votre inscription est à compléter' end,
    case when p_status = 'approved' then 'Votre profil est maintenant visible des clients et vous pouvez leur transmettre vos devis et factures.' else coalesce(p_note,'') end, '/pro/compte/entreprise');
  return c;
end $$;

-- Tant que l'entreprise n'est pas validée, ses devis et factures ne sont pas transmis aux particuliers inscrits
-- (la politique de lecture en vigueur s'appelle documents_sel, issue d'une migration précédente)
alter policy documents_sel on public.documents using (
  (company_id = (select public.my_company()))
  or (number is not null and client_id in (select public.my_client_ids())
      and company_id in (select id from public.companies where verification_status = 'approved')));
