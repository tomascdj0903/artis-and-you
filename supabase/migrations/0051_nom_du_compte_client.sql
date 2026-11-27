-- (appliquée en prod) Fiche client rattachée à un compte Artis & You : l'artisan voit aussi le nom du compte.
-- Cas réel (27/11/2026) : une fiche « Tomas Zidane » créée avec l'e-mail d'une autre personne s'est rattachée à son compte ;
-- toutes ses conversations avec cet artisan affichaient « Tomas Zidane ». On garde le nom de la fiche (carnet de l'artisan)
-- et on stocke à côté le nom réel du compte, tenu à jour quand le particulier modifie son profil.
alter table public.clients add column if not exists account_name text not null default '';

create or replace function public.client_account_name() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Toujours recalculé : l'artisan ne peut pas l'écrire lui-même
  if new.user_id is null then new.account_name := '';
  else
    select trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')) into new.account_name from public.profiles where id = new.user_id;
    new.account_name := coalesce(new.account_name, '');
  end if;
  return new;
end $$;
drop trigger if exists clients_zz_account_name on public.clients;
-- « zz » : après le rattachement automatique par e-mail (clients_attach_email), les déclencheurs s'exécutent par ordre alphabétique
create trigger clients_zz_account_name before insert or update on public.clients
  for each row execute function public.client_account_name();
revoke execute on function public.client_account_name() from public, anon, authenticated;

create or replace function public.profile_sync_client_name() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.first_name is distinct from old.first_name or new.last_name is distinct from old.last_name then
    update public.clients set account_name = trim(coalesce(new.first_name,'') || ' ' || coalesce(new.last_name,'')) where user_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists profiles_sync_client_name on public.profiles;
create trigger profiles_sync_client_name after update of first_name, last_name on public.profiles
  for each row execute function public.profile_sync_client_name();
revoke execute on function public.profile_sync_client_name() from public, anon, authenticated;

-- Fiches déjà rattachées
update public.clients c set account_name = trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,''))
from public.profiles p where p.id = c.user_id;
