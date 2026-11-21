-- (appliquée en prod) Côté particulier : disponibilités dans la recherche, urgences, demande envoyée à plusieurs artisans.

alter table public.appointments add column if not exists request_group uuid;
alter table public.appointments add column if not exists urgent boolean not null default false;
create index if not exists appointments_request_group on public.appointments(request_group) where request_group is not null;

-- Premier créneau libre de chaque artisan (horaires de son planning, heure de Paris, 14 jours), et s'il accepte les urgences
create or replace function public.next_free(p_ids uuid[], p_minutes int default 60)
returns table(company_id uuid, next_at timestamptz, urgence boolean)
language plpgsql stable security definer set search_path = public as $$
declare c record; pl jsonb; ds int[]; s0 int; s1 int; d int; day date; t timestamptz; lim timestamptz; found timestamptz; mins int := greatest(30, least(coalesce(p_minutes, 60), 480));
begin
  if auth.uid() is null then return; end if;
  for c in select co.id, co.settings from public.companies co
           where co.id = any(p_ids[1:80]) and co.verification_status = 'approved' and co.archived_at is null loop
    pl := coalesce(c.settings->'planning', '{}'::jsonb);
    ds := coalesce((select array_agg(x::int) from jsonb_array_elements_text(case when jsonb_typeof(pl->'days') = 'array' then pl->'days' else null end) x), array[1,2,3,4,5,6]);
    s0 := coalesce((pl->'slot'->>0)::int, 8); s1 := coalesce((pl->'slot'->>1)::int, 18);
    found := null;
    for d in 0..13 loop
      day := (now() at time zone 'Europe/Paris')::date + d;
      continue when not (extract(dow from day)::int = any(ds));
      t := (day + make_interval(hours => s0)) at time zone 'Europe/Paris';
      lim := (day + make_interval(hours => s1)) at time zone 'Europe/Paris';
      if t < now() then t := to_timestamp(ceil(extract(epoch from now()) / 1800) * 1800); end if;
      while t + make_interval(mins => mins) <= lim loop
        if not exists (select 1 from public.appointments a where a.company_id = c.id and a.status in ('a_valider','valide')
                       and a.start_at < t + make_interval(mins => mins) and a.end_at > t) then found := t; exit; end if;
        t := t + interval '30 minutes';
      end loop;
      exit when found is not null;
    end loop;
    company_id := c.id; next_at := found; urgence := coalesce((pl->>'urgence')::boolean, false);
    return next;
  end loop;
end $$;
revoke execute on function public.next_free(uuid[], int) from public, anon;
grant execute on function public.next_free(uuid[], int) to authenticated;

-- Demande de RDV : regroupement (même demande envoyée à plusieurs artisans) et urgence
create or replace function public.request_appointment(p jsonb)
 returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare cid uuid; pid uuid; aid uuid; comp uuid := (p->>'company_id')::uuid; prof public.profiles; conv uuid;
  grp uuid := nullif(p->>'group','')::uuid; urg boolean := coalesce((p->>'urgent')::boolean, false); n int := greatest(coalesce((p->>'group_size')::int, 1), 1);
begin
  cid := public.ensure_client(comp);
  select * into prof from public.profiles where id = auth.uid();
  if grp is not null and (select count(*) from public.appointments where request_group = grp and requested_by <> auth.uid()) > 0 then raise exception 'Demande invalide'; end if;
  if grp is not null and (select count(*) from public.appointments where request_group = grp) >= 3 then raise exception 'Une demande peut être envoyée à 3 artisans au maximum.'; end if;
  insert into public.projects(company_id, client_id, title, address)
    values (comp, cid, coalesce(nullif(p->>'title',''), p->>'type'), coalesce(prof.home->>'address','') || ' ' || coalesce(prof.home->>'city',''))
    returning id into pid;
  insert into public.appointments(company_id, client_id, project_id, type, title, start_at, end_at, mode, status, request_text, photos,
     address, contact_name, contact_phone, requested_by, request_group, urgent)
  values (comp, cid, pid, p->>'type', coalesce(nullif(p->>'title',''), p->>'type'), (p->>'start_at')::timestamptz, (p->>'end_at')::timestamptz,
     coalesce(p->>'mode','site'), 'a_valider', coalesce(p->>'text',''), coalesce(p->'photos','[]'::jsonb),
     trim(coalesce(prof.home->>'address','') || ', ' || coalesce(prof.home->>'zip','') || ' ' || coalesce(prof.home->>'city',''), ', '),
     trim(prof.first_name || ' ' || prof.last_name), prof.phone, auth.uid(), grp, urg)
  returning id into aid;
  select id into conv from public.conversations where kind='client' and company_id=comp and client_user_id=auth.uid();
  if conv is null then
    insert into public.conversations(kind, company_id, client_id, client_user_id, project_id) values ('client', comp, cid, auth.uid(), pid) returning id into conv;
  end if;
  insert into public.messages(conversation_id, sender_id, sender_name, body, attachments, card)
  values (conv, auth.uid(), trim(prof.first_name || ' ' || prof.last_name), coalesce(p->>'text',''), coalesce(p->'photos','[]'::jsonb),
          jsonb_build_object('type','demande','title', case when urg then 'Demande urgente envoyée' else 'Demande de RDV envoyée' end,
            'sub', coalesce(p->>'type','') || ' · ' || to_char((p->>'start_at')::timestamptz at time zone 'Europe/Paris','DD/MM HH24:MI') || case when p->>'mode' = 'visio' then ' · visio' else '' end
                   || case when n > 1 then ' · envoyée à ' || n || ' artisans' else '' end, 'appointment_id', aid));
  perform public.notify_company(comp, 'rdv', case when urg then 'URGENT · Nouvelle demande' else 'Nouvelle demande de RDV' end,
    trim(prof.first_name||' '||prof.last_name)||' · '||coalesce(p->>'type','')||' · '||to_char((p->>'start_at')::timestamptz at time zone 'Europe/Paris','DD/MM HH24:MI')
    || case when n > 1 then ' · demande envoyée à ' || n || ' artisans' else '' end, '/pro/planning/rdv/'||aid);
  insert into public.notifications(user_id, category, title, body, link)
  values (auth.uid(), 'rdv', 'Demande envoyée', (select coalesce(nullif(trade_name,''), name) from public.companies where id = comp) || ' · ' || coalesce(p->>'type','') || ' · ' || to_char((p->>'start_at')::timestamptz at time zone 'Europe/Paris','DD/MM HH24:MI') || ' · en attente de confirmation', '/client/rdv/'||aid);
  return aid;
end $function$;
