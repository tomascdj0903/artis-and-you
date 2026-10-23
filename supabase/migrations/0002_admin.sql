-- Administration Artis & You : vérification des SIRET, relecture des avis
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.admins enable row level security;
-- aucune politique : la table n'est lisible / modifiable que depuis le tableau de bord Supabase

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.admins where user_id = auth.uid())
$$;

create policy companies_admin_sel on public.companies for select using (public.is_admin());
create policy companies_admin_upd on public.companies for update using (public.is_admin());
create policy reviews_admin_sel on public.reviews for select using (public.is_admin());
create policy reviews_admin_upd on public.reviews for update using (public.is_admin());

-- Un gérant peut retirer un membre (la nouvelle ligne n'appartient plus à l'entreprise)
drop policy if exists profiles_upd_gerant on public.profiles;
create policy profiles_upd_gerant on public.profiles for update
  using (company_id = public.my_company() and public.is_gerant())
  with check (public.is_gerant());

-- Un membre ne peut pas modifier son propre rôle ni ses droits
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('ay.trusted', true),'') <> '1' and new.id = auth.uid() and not public.is_gerant() and (new.member_role is distinct from old.member_role or new.permissions is distinct from old.permissions) then
    raise exception 'Seul le gérant peut modifier les rôles et droits.';
  end if;
  return new;
end $$;
drop trigger if exists profiles_protect on public.profiles;
create trigger profiles_protect before update on public.profiles for each row execute function public.protect_profile();

-- Pour faire de vous un administrateur (à lancer une fois dans l'éditeur SQL de Supabase) :
-- insert into public.admins(user_id) select id from auth.users where email = 'tomascdj0903@gmail.com';
