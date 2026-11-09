-- Audit sécurité (9/11/2026) : corrections RLS / triggers / Storage
-- Principe : current_user = 'authenticated' quand la requête vient directement de l'API ;
-- les fonctions SECURITY DEFINER (RPC, triggers) tournent sous le propriétaire et ne sont pas bloquées.

-- 1) Entreprises : un gérant ne peut plus s'offrir un abonnement, prolonger son essai,
--    changer son parrain / code, ses compteurs de numérotation ni le propriétaire.
create or replace function public.protect_company_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_user in ('authenticated','anon') and not public.is_admin() then
    if new.plan is distinct from old.plan or new.trial_ends_at is distinct from old.trial_ends_at
       or new.referred_by is distinct from old.referred_by or new.referral_code is distinct from old.referral_code
       or new.counters is distinct from old.counters or new.owner_id is distinct from old.owner_id
       or new.calendar_token is distinct from old.calendar_token or new.verified_at is distinct from old.verified_at
       or new.verification_note is distinct from old.verification_note or new.id is distinct from old.id then
      raise exception 'Modification non autorisée de champs protégés de l''entreprise.';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.protect_company_fields() from public, anon, authenticated;
drop trigger if exists companies_protect_fields on public.companies;
create trigger companies_protect_fields before update on public.companies for each row execute function public.protect_company_fields();

-- 2) Avis : le pro ne peut que répondre (pas publier, ni changer la note ou le texte)
create or replace function public.protect_review() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_user in ('authenticated','anon') and not public.is_admin() then
    if (to_jsonb(new) - 'reply') is distinct from (to_jsonb(old) - 'reply') then
      raise exception 'Vous pouvez seulement répondre à cet avis.';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.protect_review() from public, anon, authenticated;
drop trigger if exists reviews_protect on public.reviews;
create trigger reviews_protect before update on public.reviews for each row execute function public.protect_review();

-- 3) Messages : l'expéditeur et son entreprise sont imposés par le serveur (pas d'usurpation)
create or replace function public.protect_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_user in ('authenticated','anon') then
    new.sender_id := auth.uid();
    new.sender_company_id := public.my_company();
    new.sender_name := left(coalesce(new.sender_name,''), 120);
    new.created_at := now();
    if new.card is not null and new.card->>'type' in ('project_invite','rdv_change') then new.card := null; end if;
  end if;
  return new;
end $$;
revoke execute on function public.protect_message() from public, anon, authenticated;
drop trigger if exists messages_protect on public.messages;
create trigger messages_protect before insert on public.messages for each row execute function public.protect_message();

-- 4) Conversations : impossible de changer les participants (sauf rattacher le compte du client à sa fiche)
create or replace function public.protect_conversation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_user in ('authenticated','anon') then
    if new.kind is distinct from old.kind or new.company_id is distinct from old.company_id
       or new.other_company_id is distinct from old.other_company_id or new.client_id is distinct from old.client_id
       or new.team_id is distinct from old.team_id then
      raise exception 'Les participants d''une conversation ne peuvent pas être modifiés.';
    end if;
    if new.client_user_id is distinct from old.client_user_id and not (
         old.client_user_id is null and old.company_id = public.my_company()
         and new.client_user_id = (select user_id from public.clients where id = old.client_id)) then
      raise exception 'Les participants d''une conversation ne peuvent pas être modifiés.';
    end if;
    if new.project_id is distinct from old.project_id and not (new.project_id is null or new.project_id in (select public.my_project_ids())) then
      raise exception 'Chantier non autorisé.';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.protect_conversation() from public, anon, authenticated;
drop trigger if exists conversations_protect on public.conversations;
create trigger conversations_protect before update on public.conversations for each row execute function public.protect_conversation();

-- 5) Paiements : seulement sur ses propres documents (sinon on pouvait marquer « payée » la facture d'un autre)
drop policy if exists payments_company on public.payments;
create policy payments_company on public.payments for all to authenticated
  using (company_id = (select public.my_company()))
  with check (company_id = (select public.my_company()) and document_id in (select id from public.documents where company_id = (select public.my_company())));

-- 6) Un pro ne peut rattacher un RDV / document / chantier / fichier qu'à SES clients et SES chantiers
create or replace function public.my_company_client_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.clients where company_id = public.my_company()
$$;
revoke execute on function public.my_company_client_ids() from public, anon;
grant execute on function public.my_company_client_ids() to authenticated;

do $$ declare t text; begin
  foreach t in array array['appointments','documents','projects'] loop
    execute format('drop policy if exists %I on public.%I', t || '_own_client', t);
    execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (client_id is null or client_id in (select public.my_company_client_ids()))', t || '_own_client', t);
    execute format('drop policy if exists %I on public.%I', t || '_own_client_upd', t);
    execute format('create policy %I on public.%I as restrictive for update to authenticated using (true) with check (client_id is null or client_id in (select public.my_company_client_ids()))', t || '_own_client_upd', t);
  end loop;
end $$;
-- RDV d'un chantier partagé : le chantier doit être le mien ou partagé avec moi
drop policy if exists appointments_own_project on public.appointments;
create policy appointments_own_project on public.appointments as restrictive for insert to authenticated
  with check (project_id is null or project_id in (select public.my_project_ids()) or project_id in (select public.shared_project_ids()));
drop policy if exists documents_own_project on public.documents;
create policy documents_own_project on public.documents as restrictive for insert to authenticated
  with check (project_id is null or project_id in (select public.my_project_ids()));
-- Fichiers : client de l'entreprise, ou le particulier lui-même
drop policy if exists files_own_client on public.files;
create policy files_own_client on public.files as restrictive for insert to authenticated
  with check (client_id is null or client_id in (select public.my_company_client_ids()) or client_id in (select public.my_client_ids()));

-- 7) Storage : la règle de lecture comparait f.path à f.name (colonne de la table files) au lieu du chemin
--    du fichier demandé ; et un document du coffre-fort partagé était lisible par n'importe quel compte.
drop policy if exists files_storage_client_read on storage.objects;
create policy files_storage_client_read on storage.objects for select to authenticated using (
  bucket_id = 'files' and (
    exists (select 1 from public.files f where f.path = objects.name and (
      (f.client_id in (select public.my_client_ids()) and (f.shared_with_client or f.kind = 'photo'))
      or (f.kind = 'vault' and f.shared_with_client and f.company_id in (select c.company_id from public.clients c where c.user_id = (select auth.uid())))
      or (f.kind = 'photo' and f.shared_with_pros)))
    or exists (select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
               where public.can_see_conversation(c) and m.attachments @> jsonb_build_array(jsonb_build_object('path', objects.name)))
    or (storage.foldername(name))[2] = 'logo'
  ));
-- Taille maximale des fichiers : 25 Mo
update storage.buckets set file_size_limit = 26214400 where id = 'files';
