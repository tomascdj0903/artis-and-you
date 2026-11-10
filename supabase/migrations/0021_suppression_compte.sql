-- Suppression du compte depuis l'application (exigée par Apple, droit à l'effacement RGPD).
--   • Particulier ou salarié : son compte est supprimé. Les fiches client, devis, factures et conversations
--     restent chez l'artisan (ce sont ses documents), détachés du compte supprimé.
--   • Gérant seul : son compte est supprimé et l'entreprise est ARCHIVÉE : retirée de l'annuaire, plus de nouvelles
--     demandes, mais devis et factures conservés (obligation légale de 10 ans) et toujours consultables par ses clients.
--   • Gérant avec une équipe : refusé tant que l'équipe n'est pas retirée (sinon les salariés perdraient leur accès).
-- Rien n'est effacé côté entreprise. La purge au bout de 10 ans reste à programmer.

alter table public.companies add column if not exists archived_at timestamptz;

create or replace function public.delete_my_account() returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); p public.profiles; others int;
begin
  if me is null then raise exception 'Connexion requise.'; end if;
  select * into p from public.profiles where id = me;
  if p.company_id is not null and coalesce(p.member_role, 'gerant') = 'gerant' then
    select count(*) into others from public.profiles where company_id = p.company_id and id <> me;
    if others > 0 then
      raise exception 'Retirez d''abord les membres de votre équipe (Paramètres › Mon équipe), puis recommencez.';
    end if;
    update public.companies set archived_at = now(), visible_particuliers = false, visible_pros = false where id = p.company_id;
    delete from public.company_invites where company_id = p.company_id;
    delete from public.network where company_id = p.company_id or pro_id = p.company_id;
  end if;
  -- Les conversations d'un particulier restent chez l'artisan, détachées du compte
  update public.conversations set client_user_id = null where client_user_id = me;
  delete from auth.users where id = me;  -- profil, notifications, abonnements push, lectures : supprimés en cascade
  return 'ok';
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Une entreprise archivée ne reçoit plus de demande de rendez-vous ni de nouvelle conversation
create or replace function public.block_archived_company() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists(select 1 from public.companies where archived_at is not null
            and id in (new.company_id, nullif(to_jsonb(new)->>'other_company_id', '')::uuid)) then
    raise exception 'Cet artisan n''utilise plus Artesa.';
  end if;
  return new;
end $$;
revoke execute on function public.block_archived_company() from public, anon, authenticated;
drop trigger if exists appointments_archived on public.appointments;
create trigger appointments_archived before insert on public.appointments for each row execute function public.block_archived_company();
drop trigger if exists conversations_archived on public.conversations;
create trigger conversations_archived before insert on public.conversations for each row execute function public.block_archived_company();

-- Une entreprise archivée ne bloque pas une réinscription avec le même SIRET ou le même e-mail
-- (le SIRET reste « déjà venu » : pas de nouvel essai gratuit ni de parrainage).
create or replace function public.on_company_siret() returns trigger
language plpgsql security definer set search_path = public as $$
declare s text;
begin
  if tg_op = 'DELETE' then
    s := regexp_replace(coalesce(old.siret,''),'\D','','g');
    if s <> '' then insert into public.siret_history(siret, deleted_at) values (s, now()) on conflict (siret) do update set deleted_at = now(); end if;
    return old;
  end if;
  s := regexp_replace(coalesce(new.siret,''),'\D','','g');
  if s <> '' then
    if exists(select 1 from public.companies where regexp_replace(siret,'\D','','g') = s and id <> new.id and archived_at is null) then
      raise exception 'Ce SIRET est déjà utilisé par une entreprise inscrite sur Artesa. Connectez-vous avec le compte existant ou contactez-nous.';
    end if;
    if tg_op = 'INSERT' then
      if exists(select 1 from public.siret_history where siret = s) then
        new.referred_by := null; new.trial_ends_at := now();
      end if;
      insert into public.siret_history(siret) values (s) on conflict (siret) do nothing;
    end if;
  end if;
  if coalesce(new.email,'') <> '' and exists(select 1 from public.companies where lower(email) = lower(new.email) and id <> new.id and archived_at is null) then
    raise exception 'Cette adresse e-mail est déjà utilisée par une autre entreprise. Utilisez une adresse différente pour chaque entreprise.';
  end if;
  return new;
end $$;
revoke execute on function public.on_company_siret() from public, anon, authenticated;

create or replace function public.siret_status(p_siret text) returns text
language sql stable security definer set search_path = public as $$
  select case
    when exists(select 1 from public.companies where regexp_replace(siret,'\D','','g') = regexp_replace(p_siret,'\D','','g') and archived_at is null) then 'active'
    when exists(select 1 from public.siret_history where siret = regexp_replace(p_siret,'\D','','g')) then 'known'
    when exists(select 1 from public.companies where regexp_replace(siret,'\D','','g') = regexp_replace(p_siret,'\D','','g')) then 'known'
    else 'new' end
$$;
revoke execute on function public.siret_status(text) from public, anon;
grant execute on function public.siret_status(text) to authenticated;
