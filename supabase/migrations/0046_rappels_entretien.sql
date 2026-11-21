-- (appliquée en prod)
-- Rappels d'entretien des équipements du logement (profiles.home.equipments), chaque matin
create or replace function private.maintenance_reminders() returns int
language plpgsql security definer set search_path to 'public', 'private' as $$
declare p record; eq jsonb; arr jsonb; due date; base date; months int; label text; n int := 0; changed boolean;
begin
  for p in select id, home from public.profiles where jsonb_typeof(home->'equipments') = 'array' and jsonb_array_length(home->'equipments') > 0 loop
    arr := '[]'::jsonb; changed := false;
    for eq in select * from jsonb_array_elements(p.home->'equipments') loop
      months := coalesce(nullif(eq->>'months','')::int, case eq->>'type' when 'pac' then 24 when 'clim' then 24 else 12 end);
      base := case when coalesce(eq->>'last_service','') ~ '^\d{4}-\d{2}-\d{2}$' then (eq->>'last_service')::date
                   when coalesce(eq->>'installed','') ~ '^\d{4}$' then make_date((eq->>'installed')::int, 1, 1) end;
      due := case when base is not null then (base + make_interval(months => months))::date end;
      if due is not null and due <= current_date + 14 and coalesce(eq->>'reminded_for','') <> due::text then
        label := coalesce(nullif(eq->>'label',''), case eq->>'type' when 'chaudiere' then 'votre chaudière' when 'pac' then 'votre pompe à chaleur'
          when 'clim' then 'votre climatisation' when 'cheminee' then 'le ramonage de votre cheminée' when 'chauffe_eau' then 'votre chauffe-eau'
          when 'vmc' then 'votre VMC' when 'piscine' then 'votre piscine' when 'detecteur' then 'votre détecteur de fumée' else 'votre équipement' end);
        insert into public.notifications(user_id, category, title, body, link)
        values (p.id, 'rdv', 'Entretien à prévoir',
          case when due < current_date then 'L''entretien de ' || label || ' est en retard (prévu le ' || to_char(due, 'DD/MM/YYYY') || ').'
               else 'L''entretien de ' || label || ' est à prévoir avant le ' || to_char(due, 'DD/MM/YYYY') || '.' end, '/client/compte/logement');
        eq := eq || jsonb_build_object('reminded_for', due::text); changed := true; n := n + 1;
      end if;
      arr := arr || jsonb_build_array(eq);
    end loop;
    if changed then update public.profiles set home = jsonb_set(home, '{equipments}', arr) where id = p.id; end if;
  end loop;
  return n;
end $$;
revoke execute on function private.maintenance_reminders() from public, anon, authenticated;
select cron.unschedule('artisandyou_entretiens') where exists (select 1 from cron.job where jobname = 'artisandyou_entretiens');
select cron.schedule('artisandyou_entretiens', '0 8 * * *', 'select private.maintenance_reminders()');
