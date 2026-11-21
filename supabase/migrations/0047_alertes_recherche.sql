-- (appliquée en prod) Alertes de recherche des particuliers
create table if not exists public.search_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trade text not null default '', city text not null default '', lat double precision, lon double precision,
  urgent boolean not null default false, created_at timestamptz not null default now());
alter table public.search_alerts enable row level security;
drop policy if exists search_alerts_own on public.search_alerts;
create policy search_alerts_own on public.search_alerts for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create index if not exists search_alerts_user on public.search_alerts(user_id);
create table if not exists public.search_alert_hits (alert_id uuid references public.search_alerts(id) on delete cascade, company_id uuid references public.companies(id) on delete cascade, created_at timestamptz default now(), primary key (alert_id, company_id));
alter table public.search_alert_hits enable row level security;

-- Artisan qui devient visible (validé), ou qui active les urgences : on prévient les particuliers dont l'alerte correspond
create or replace function public.on_company_alerts() returns trigger
language plpgsql security definer set search_path = public as $$
declare a record; became boolean; urg_on boolean; nm text;
begin
  became := new.verification_status = 'approved' and new.visible_particuliers and new.archived_at is null
            and (tg_op = 'INSERT' or old.verification_status is distinct from 'approved' or not coalesce(old.visible_particuliers, false));
  urg_on := coalesce((new.settings->'planning'->>'urgence')::boolean, false) and tg_op = 'UPDATE' and not coalesce((old.settings->'planning'->>'urgence')::boolean, false)
            and new.verification_status = 'approved' and new.visible_particuliers;
  if not (became or urg_on) or coalesce(new.is_platform, false) then return new; end if;
  nm := coalesce(nullif(new.trade_name, ''), new.name);
  for a in select s.* from public.search_alerts s
           where (s.trade = '' or array_to_string(new.trades, ' ') ilike '%' || s.trade || '%')
             and (not s.urgent or coalesce((new.settings->'planning'->>'urgence')::boolean, false))
             and (s.urgent or became)
             and (s.city = '' or (s.lat is not null and new.zone_lat is not null
                    and 6371 * 2 * asin(sqrt(power(sin(radians(new.zone_lat - s.lat) / 2), 2) + cos(radians(s.lat)) * cos(radians(new.zone_lat)) * power(sin(radians(new.zone_lon - s.lon) / 2), 2))) <= coalesce(new.zone_km, 30))
                  or ((s.lat is null or new.zone_lat is null) and (coalesce(new.city, '') || ' ' || coalesce(new.zone, '')) ilike '%' || s.city || '%'))
             and not exists (select 1 from public.search_alert_hits h where h.alert_id = s.id and h.company_id = new.id)
  loop
    insert into public.search_alert_hits(alert_id, company_id) values (a.id, new.id) on conflict do nothing;
    insert into public.notifications(user_id, category, title, body, link)
    values (a.user_id, 'systeme', case when a.urgent then 'Nouvel artisan pour les urgences' else 'Nouvel artisan pour votre recherche' end,
      nm || ' · ' || coalesce(new.trades[1], '') || ' · ' || coalesce(new.city, ''), '/client/artisans/' || new.id);
  end loop;
  return new;
end $$;
revoke execute on function public.on_company_alerts() from public, anon, authenticated;
drop trigger if exists companies_search_alerts on public.companies;
create trigger companies_search_alerts after insert or update of verification_status, visible_particuliers, settings on public.companies
  for each row execute function public.on_company_alerts();
