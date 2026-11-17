-- 0032 · Rendez-vous Artesa depuis le service client
--  - Artesa propose des créneaux (téléphone, WhatsApp, visio, autre) dans la conversation ; la personne choisit
--    et indique où la joindre. Ou l'inverse : un pro / particulier demande un RDV et l'équipe confirme.
--  - Le RDV confirmé s'inscrit dans l'agenda d'Artesa, dans « Mes RDV » du particulier ou dans le planning du pro.
-- Aucune donnée existante n'est modifiée.

create or replace function public.support_rdv_book(p_msg uuid, p_start timestamptz, p_mode text, p_contact text, p_platform text, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m public.messages; c public.conversations; plat uuid; mine uuid := public.my_company(); team boolean;
  card jsonb; st text; dur int; fin timestamptz; lbl text; pname text; cid uuid; appt uuid; pro_appt uuid;
  pr public.profiles; co public.companies; n int; info text; sender text;
begin
  if auth.uid() is null then raise exception 'Connectez-vous.'; end if;
  select * into m from public.messages where id = p_msg for update;
  if m.id is null or m.card->>'type' is distinct from 'artesa_rdv' then raise exception 'Demande introuvable.'; end if;
  select * into c from public.conversations where id = m.conversation_id;
  if c.kind <> 'support' or not public.can_see_conversation(c) then raise exception 'Demande introuvable.'; end if;
  plat := c.company_id; team := (mine = plat); card := m.card; st := card->>'status';
  if not exists (select 1 from public.companies where id = plat and is_platform) then raise exception 'Demande introuvable.'; end if;
  -- Une proposition d'Artesa se choisit par la personne ; une demande de la personne se confirme par l'équipe
  if st = 'propose' then
    if team or m.sender_company_id is distinct from plat then raise exception 'C''est à la personne contactée de choisir.'; end if;
    if jsonb_array_length(coalesce(card->'slots','[]'::jsonb)) > 0 and not coalesce((card->>'free')::boolean, false)
       and not exists (select 1 from jsonb_array_elements_text(card->'slots') s where s::timestamptz = p_start) then
      raise exception 'Choisissez un des créneaux proposés.'; end if;
  elsif st = 'demande' then
    if not team then raise exception 'L''équipe Artesa doit confirmer.'; end if;
  else raise exception 'Ce rendez-vous a déjà été traité.'; end if;
  if p_start is null or p_start < now() - interval '5 minutes' then raise exception 'Choisissez une date à venir.'; end if;
  if p_mode not in ('telephone','whatsapp','visio','autre') then raise exception 'Mode de contact inconnu.'; end if;
  if coalesce(trim(p_contact),'') = '' then raise exception 'Indiquez où vous joindre.'; end if;

  dur := greatest(10, least(240, coalesce((card->>'duration')::int, 30)));
  fin := p_start + make_interval(mins => dur);
  lbl := case p_mode when 'telephone' then 'Téléphone' when 'whatsapp' then 'WhatsApp' when 'visio' then 'Visio' else coalesce(nullif(trim(p_platform),''), 'Autre') end;
  info := lbl || ' · ' || left(trim(p_contact), 120) || case when coalesce(trim(p_platform),'') <> '' and p_mode <> 'autre' then ' (' || left(trim(p_platform), 60) || ')' else '' end
          || case when coalesce(trim(p_note),'') <> '' then E'\n' || left(trim(p_note), 500) else '' end
          || case when coalesce(card->>'topic','') <> '' then E'\nObjet : ' || left(card->>'topic', 200) else '' end;

  -- Fiche client chez Artesa (pour l'agenda d'Artesa et « Mes RDV » du particulier)
  if c.other_company_id is not null then
    select * into co from public.companies where id = c.other_company_id;
    pname := coalesce(nullif(co.trade_name,''), co.name);
    select id into cid from public.clients where company_id = plat and type = 'pro' and ((coalesce(co.siret,'') <> '' and siret = co.siret) or lower(company_name) = lower(co.name)) order by created_at limit 1;
    if cid is null then
      select count(*)+1 into n from public.clients where company_id = plat;
      insert into public.clients(company_id, type, company_name, email, phone, siret, billing_address, billing_zip, billing_city, number)
      values (plat, 'pro', co.name, coalesce(co.email,''), coalesce(co.phone,''), coalesce(co.siret,''), coalesce(co.address,''), coalesce(co.zip,''), coalesce(co.city,''), 'CL-'||lpad(n::text,5,'0'))
      returning id into cid;
    end if;
  else
    select * into pr from public.profiles where id = c.client_user_id;
    pname := trim(coalesce(pr.first_name,'') || ' ' || coalesce(pr.last_name,''));
    select id into cid from public.clients where company_id = plat and user_id = pr.id limit 1;
    if cid is null then
      select count(*)+1 into n from public.clients where company_id = plat;
      insert into public.clients(company_id, user_id, type, last_name, first_name, email, mobile, number)
      values (plat, pr.id, 'particulier', coalesce(pr.last_name,''), coalesce(pr.first_name,''), coalesce(pr.email,''), coalesce(pr.phone,''), 'CL-'||lpad(n::text,5,'0'))
      returning id into cid;
    end if;
  end if;

  insert into public.appointments(company_id, client_id, type, title, start_at, end_at, mode, status, notes, contact_name, contact_phone, requested_by, validated_at)
  values (plat, cid, 'Rendez-vous Artesa', 'Rendez-vous Artesa · ' || lbl, p_start, fin, 'visio', 'valide', info, coalesce(pname,''), left(trim(p_contact),60), auth.uid(), now())
  returning id into appt;
  -- Le pro le retrouve aussi dans son propre planning
  if c.other_company_id is not null then
    insert into public.appointments(company_id, type, title, start_at, end_at, mode, status, notes, contact_name, contact_phone, personal, requested_by, validated_at)
    values (c.other_company_id, 'Rendez-vous Artesa', 'Rendez-vous Artesa · ' || lbl, p_start, fin, 'visio', 'valide', info, 'Artesa', left(trim(p_contact),60), false, auth.uid(), now())
    returning id into pro_appt;
  end if;

  card := card || jsonb_build_object('status','confirme','start',p_start,'end',fin,'mode',p_mode,'contact',left(trim(p_contact),120),
           'platform',left(coalesce(trim(p_platform),''),60),'note',left(coalesce(trim(p_note),''),500),'appointment_id',appt,'pro_appointment_id',pro_appt,'confirmed_at',now());
  update public.messages set card = card where id = m.id;

  -- Message de confirmation dans la conversation (notifie l'autre côté)
  sender := case when team then 'Artesa' else coalesce(nullif(pname,''), 'Nouveau message') end;
  insert into public.messages(conversation_id, sender_id, sender_company_id, sender_name, body, card)
  values (c.id, auth.uid(), mine, sender, '', jsonb_build_object('type','rdv','title','Rendez-vous confirmé',
    'sub', to_char(p_start at time zone 'Europe/Paris','DD/MM/YYYY "à" HH24"h"MI') || ' · ' || lbl || ' · ' || left(trim(p_contact),60)));
  return jsonb_build_object('appointment_id', appt, 'pro_appointment_id', pro_appt);
end $$;
revoke execute on function public.support_rdv_book(uuid, timestamptz, text, text, text, text) from public, anon;
grant execute on function public.support_rdv_book(uuid, timestamptz, text, text, text, text) to authenticated;
