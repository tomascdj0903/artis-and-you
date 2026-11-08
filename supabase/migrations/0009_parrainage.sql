-- Parrainage : 1 mois offert au filleul (60 jours d'essai) et au parrain (+30 jours)
create or replace function public.on_company_referral() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.referred_by is not null and new.referred_by <> new.id then
    new.trial_ends_at := now() + interval '60 days';
    update public.companies set trial_ends_at = greatest(coalesce(trial_ends_at, now()), now()) + interval '30 days' where id = new.referred_by;
    perform public.notify_company(new.referred_by, 'systeme', 'Parrainage réussi 🎁', new.name || ' a rejoint Artis & You avec votre code : 1 mois offert.', '/pro/compte/abonnement');
  end if;
  return new;
end $$;
revoke execute on function public.on_company_referral() from public, anon, authenticated;
drop trigger if exists companies_referral on public.companies;
create trigger companies_referral before insert on public.companies for each row execute function public.on_company_referral();
