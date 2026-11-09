-- Un SIRET qui a déjà utilisé Artesa ne retouche pas l'essai gratuit ni le parrainage ; un SIRET / e-mail ne peut avoir qu'une entreprise active
create table if not exists public.siret_history (
  siret text primary key,
  first_seen timestamptz default now(),
  deleted_at timestamptz
);
alter table public.siret_history enable row level security; -- aucun accès direct

insert into public.siret_history(siret, first_seen)
  select regexp_replace(siret,'\D','','g'), min(created_at) from public.companies where coalesce(siret,'') <> '' group by 1
  on conflict do nothing;

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
    if exists(select 1 from public.companies where regexp_replace(siret,'\D','','g') = s and id <> new.id) then
      raise exception 'Ce SIRET est déjà utilisé par une entreprise inscrite sur Artesa. Connectez-vous avec le compte existant ou contactez-nous.';
    end if;
    if tg_op = 'INSERT' then
      if exists(select 1 from public.siret_history where siret = s) then
        -- déjà venu : pas d'essai gratuit, pas de parrainage
        new.referred_by := null; new.trial_ends_at := now();
      end if;
      insert into public.siret_history(siret) values (s) on conflict (siret) do nothing;
    end if;
  end if;
  if coalesce(new.email,'') <> '' and exists(select 1 from public.companies where lower(email) = lower(new.email) and id <> new.id) then
    raise exception 'Cette adresse e-mail est déjà utilisée par une autre entreprise. Utilisez une adresse différente pour chaque entreprise.';
  end if;
  return new;
end $$;
revoke execute on function public.on_company_siret() from public, anon, authenticated;
-- s'exécute avant le trigger de parrainage (ordre alphabétique : companies_a_siret < companies_referral)
drop trigger if exists companies_a_siret on public.companies;
create trigger companies_a_siret before insert or update of siret, email on public.companies for each row execute function public.on_company_siret();
drop trigger if exists companies_siret_del on public.companies;
create trigger companies_siret_del before delete on public.companies for each row execute function public.on_company_siret();

-- Vérification avant inscription (pour prévenir dès l'étape entreprise)
create or replace function public.siret_status(p_siret text) returns text
language sql stable security definer set search_path = public as $$
  select case
    when exists(select 1 from public.companies where regexp_replace(siret,'\D','','g') = regexp_replace(p_siret,'\D','','g')) then 'active'
    when exists(select 1 from public.siret_history where siret = regexp_replace(p_siret,'\D','','g')) then 'known'
    else 'new' end
$$;
revoke execute on function public.siret_status(text) from public, anon;
grant execute on function public.siret_status(text) to authenticated;
