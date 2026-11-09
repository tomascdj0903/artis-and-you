-- CRITIQUE : un gérant pouvait déplacer son profil (ou celui d'un employé) dans n'importe quelle autre entreprise
-- et accéder ensuite à toutes ses données. Le gérant ne peut que garder le membre dans son entreprise ou l'en retirer.
drop policy if exists profiles_upd_gerant on public.profiles;
create policy profiles_upd_gerant on public.profiles for update to authenticated
  using (company_id = (select public.my_company()) and (select public.is_gerant()))
  with check ((company_id is null or company_id = (select public.my_company())) and id <> (select auth.uid()));
-- Son propre profil : jamais changer d'entreprise soi-même (seulement via create_company / join_company)
create or replace function public.protect_profile() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if current_user in ('authenticated','anon') then
    if new.id = auth.uid() and new.company_id is distinct from old.company_id then
      raise exception 'Vous ne pouvez pas changer d''entreprise vous-même.';
    end if;
    if new.id = auth.uid() and not public.is_gerant() and (new.member_role is distinct from old.member_role or new.permissions is distinct from old.permissions or new.team_id is distinct from old.team_id or new.kind is distinct from old.kind) then
      raise exception 'Seul le gérant peut modifier les rôles et droits.';
    end if;
  end if;
  return new;
end $$;
