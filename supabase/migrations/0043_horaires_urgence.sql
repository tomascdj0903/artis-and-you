-- (appliquée en prod) Urgences : l'artisan choisit ses horaires d'urgence
-- planning.urgence (bool), planning.urgence_mode 'same' (= plages disponibles) | 'custom',
-- planning.urgence_247 (bool), planning.urgence_days (int[]), planning.urgence_slot [début, fin] (fin <= début : se termine le lendemain)
drop function if exists public.next_free(uuid[], int);
create or replace function public.next_free(p_ids uuid[], p_minutes int default 60, p_urgent boolean default false)
returns table(company_id uuid, next_at timestamptz, urgence boolean)
language plpgsql stable security definer set search_path = public as $$
declare c record; pl jsonb; ds int[]; s0 int; s1 int; d int; day date; t timestamptz; lim timestamptz; found timestamptz;
  mins int := greatest(30, least(coalesce(p_minutes, 60), 480)); urg boolean; custom boolean; all_day boolean;
begin
  if auth.uid() is null then return; end if;
  for c in select co.id, co.settings from public.companies co
           where co.id = any(p_ids[1:80]) and co.verification_status = 'approved' and co.archived_at is null loop
    pl := coalesce(c.settings->'planning', '{}'::jsonb);
    urg := coalesce((pl->>'urgence')::boolean, false);
    custom := p_urgent and urg and pl->>'urgence_mode' = 'custom';
    all_day := custom and coalesce((pl->>'urgence_247')::boolean, false);
    if custom and not all_day then
      ds := coalesce((select array_agg(x::int) from jsonb_array_elements_text(case when jsonb_typeof(pl->'urgence_days') = 'array' then pl->'urgence_days' end) x), array[0,1,2,3,4,5,6]);
      s0 := coalesce((pl->'urgence_slot'->>0)::int, 18); s1 := coalesce((pl->'urgence_slot'->>1)::int, 22);
    elsif all_day then
      ds := array[0,1,2,3,4,5,6]; s0 := 0; s1 := 24;
    else
      ds := coalesce((select array_agg(x::int) from jsonb_array_elements_text(case when jsonb_typeof(pl->'days') = 'array' then pl->'days' end) x), array[1,2,3,4,5,6]);
      s0 := coalesce((pl->'slot'->>0)::int, 8); s1 := coalesce((pl->'slot'->>1)::int, 18);
    end if;
    found := null;
    -- on part de la veille pour une plage de nuit commencée hier (ex. 20 h → 6 h)
    for d in -1..13 loop
      day := (now() at time zone 'Europe/Paris')::date + d;
      continue when not (extract(dow from day)::int = any(ds));
      t := (day + make_interval(hours => s0)) at time zone 'Europe/Paris';
      lim := (day + make_interval(hours => case when s1 <= s0 then s1 + 24 else s1 end)) at time zone 'Europe/Paris';
      continue when lim <= now();
      if t < now() then t := to_timestamp(ceil(extract(epoch from now()) / 1800) * 1800); end if;
      while t + make_interval(mins => mins) <= lim loop
        if not exists (select 1 from public.appointments a where a.company_id = c.id and a.status in ('a_valider','valide')
                       and a.start_at < t + make_interval(mins => mins) and a.end_at > t) then found := t; exit; end if;
        t := t + interval '30 minutes';
      end loop;
      exit when found is not null;
    end loop;
    company_id := c.id; next_at := found; urgence := urg;
    return next;
  end loop;
end $$;
revoke execute on function public.next_free(uuid[], int, boolean) from public, anon;
grant execute on function public.next_free(uuid[], int, boolean) to authenticated;
