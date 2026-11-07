-- Artis & You — mises à jour de novembre 2026 (inscription, validation des comptes, filtres, relances…)

-- ───────────────── Inscription : coordonnées complètes ─────────────────
alter table public.profiles add column if not exists civility text default '';
alter table public.companies add column if not exists country text default 'France';

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, kind, civility, first_name, last_name, email, phone, lang, home)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'kind','particulier'),
          coalesce(new.raw_user_meta_data->>'civility',''),
          coalesce(new.raw_user_meta_data->>'first_name',''),
          coalesce(new.raw_user_meta_data->>'last_name',''),
          new.email,
          coalesce(new.raw_user_meta_data->>'phone',''),
          coalesce(new.raw_user_meta_data->>'lang','fr'),
          coalesce(new.raw_user_meta_data->'home','{}'::jsonb));
  return new;
end $$;

-- ───────────────── Validation des entreprises par l'équipe Artis & You ─────────────────
alter table public.companies add column if not exists verification_status text default 'pending' check (verification_status in ('pending','approved','rejected'));
alter table public.companies add column if not exists verification_note text default '';
alter table public.companies add column if not exists verified_at timestamptz;
update public.companies set verification_status = 'approved' where verified and verification_status = 'pending';

-- Une entreprise ne peut pas se valider elle-même
create or replace function public.protect_company_verification() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Exception : renvoi du dossier (rejected → pending) via resubmit_company()
  if coalesce(current_setting('ay.trusted', true),'') = '1' and old.verification_status = 'rejected' and new.verification_status = 'pending' and new.verified is not distinct from old.verified then
    return new;
  end if;
  if not public.is_admin() and (new.verified is distinct from old.verified or new.verification_status is distinct from old.verification_status) then
    raise exception 'Seule l''équipe Artis & You peut valider une entreprise.';
  end if;
  return new;
end $$;
drop trigger if exists companies_protect_verification on public.companies;
create trigger companies_protect_verification before update on public.companies for each row execute function public.protect_company_verification();

create or replace function public.admin_review_company(p_id uuid, p_status text, p_note text default '') returns public.companies
language plpgsql security definer set search_path = public as $$
declare c public.companies;
begin
  if not public.is_admin() then raise exception 'Réservé à l''équipe Artis & You.'; end if;
  update public.companies set verification_status = p_status, verified = (p_status = 'approved'), verification_note = coalesce(p_note,''), verified_at = now()
  where id = p_id returning * into c;
  perform public.notify_company(p_id, 'systeme',
    case when p_status = 'approved' then 'Votre entreprise est validée' else 'Votre inscription est à compléter' end,
    case when p_status = 'approved' then 'Votre profil est maintenant visible des clients.' else coalesce(p_note,'') end, '/pro/compte/entreprise');
  return c;
end $$;

create or replace function public.create_company(p jsonb) returns public.companies
language plpgsql security definer set search_path = public as $$
declare c public.companies; ref uuid;
begin
  perform set_config('ay.trusted','1',true);
  if public.my_company() is not null then raise exception 'Vous avez déjà une entreprise'; end if;
  if coalesce(p->>'referral','') <> '' then
    select id into ref from public.companies where referral_code = upper(p->>'referral');
  end if;
  insert into public.companies(owner_id, name, legal_form, siret, siren, trades, city, zip, address, country, phone, email, referred_by, verification_status, settings)
  values (auth.uid(), p->>'name', coalesce(p->>'legal_form',''), coalesce(p->>'siret',''), left(regexp_replace(coalesce(p->>'siret',''),'\D','','g'),9),
          coalesce(array(select jsonb_array_elements_text(p->'trades')),'{}'),
          coalesce(p->>'city',''), coalesce(p->>'zip',''), coalesce(p->>'address',''), coalesce(p->>'country','France'),
          coalesce(p->>'phone',''), coalesce(p->>'email',''), ref, 'pending',
          '{"planning":{"view":"week","hours":[7,19],"weekend":false,"colorBy":"team","days":[1,2,3,4,5,6],"slot":[8,18],"duration":60,"manual":true,"reminder":24,"visio":true},"docs":{"quotePrefix":"DE","invoicePrefix":"FA","creditPrefix":"AV","vat":20,"validity":30,"paymentTerms":"30 jours fin de mois","penalties":"3 fois le taux d''intérêt légal","discount":"Aucun pour paiement anticipé","onlinePayment":true,"einvoice":true},"pdf":{"color":"#7F1111","footer":"","template":"classique"},"notifications":{"push":true,"email":true,"sms":false}}'::jsonb)
  returning * into c;
  update public.profiles set kind='artisan', company_id = c.id, member_role='gerant' where id = auth.uid();
  insert into public.teams(company_id, name, color) values (c.id, 'Équipe principale', '#00123B');
  insert into public.notifications(user_id, category, title, body, link)
    select a.user_id, 'systeme', 'Nouvelle entreprise à valider', c.name || ' · SIRET ' || c.siret, '/client/admin' from public.admins a;
  return c;
end $$;

-- L'annuaire ne montre que les entreprises validées
create or replace function public.directory_search(p_query text default '', p_trade text default '', p_city text default '')
returns table(id uuid, name text, trade_name text, city text, zip text, trades text[], zone text, verified boolean,
              rating numeric, reviews_count int, visio boolean, is_mine boolean, logo_path text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.trade_name, c.city, c.zip, c.trades, c.zone, c.verified,
    (select round(avg(rating)::numeric,1) from public.reviews r where r.company_id = c.id and r.status='publie'),
    (select count(*)::int from public.reviews r where r.company_id = c.id and r.status='publie'),
    coalesce((c.settings->'planning'->>'visio')::boolean, true),
    exists(select 1 from public.clients cl where cl.company_id = c.id and cl.user_id = auth.uid()),
    c.logo_path
  from public.companies c
  where auth.uid() is not null and c.verification_status = 'approved'
    and (c.visible_particuliers or exists(select 1 from public.clients cl where cl.company_id = c.id and cl.user_id = auth.uid())
         or c.visible_pros and public.my_company() is not null)
    and (p_query = '' or c.name ilike '%'||p_query||'%' or c.trade_name ilike '%'||p_query||'%' or array_to_string(c.trades,' ') ilike '%'||p_query||'%')
    and (p_trade = '' or array_to_string(c.trades,' ') ilike '%'||p_trade||'%')
    and (p_city = '' or c.city ilike '%'||p_city||'%' or c.zone ilike '%'||p_city||'%')
  order by c.name
  limit 100
$$;

-- ───────────────── Clients : pays ─────────────────
alter table public.clients add column if not exists billing_country text default 'France';

-- ───────────────── Coffre-fort : rappel d'expiration envoyé une seule fois ─────────────────
alter table public.files add column if not exists reminded_at timestamptz;

-- ───────────────── Mon entreprise : zone d'intervention (ville + rayon) ─────────────────
alter table public.companies add column if not exists zone_city text default '';
alter table public.companies add column if not exists zone_lat double precision;
alter table public.companies add column if not exists zone_lon double precision;
alter table public.companies add column if not exists zone_km int default 30;

-- Renvoi du dossier après une demande de compléments
create or replace function public.resubmit_company() returns public.companies
language plpgsql security definer set search_path = public as $$
declare c public.companies;
begin
  select * into c from public.companies where id = public.my_company();
  if c.id is null then raise exception 'Entreprise introuvable'; end if;
  if c.verification_status <> 'rejected' then return c; end if;
  perform set_config('ay.trusted','1',true);
  update public.companies set verification_status = 'pending' where id = c.id returning * into c;
  insert into public.notifications(user_id, category, title, body, link)
    select a.user_id, 'systeme', 'Dossier complété à revalider', c.name || ' · SIRET ' || c.siret, '/client/admin' from public.admins a;
  return c;
end $$;

-- L'annuaire renvoie aussi la zone (pour la recherche par distance)
drop function if exists public.directory_search(text, text, text);
create or replace function public.directory_search(p_query text default '', p_trade text default '', p_city text default '')
returns table(id uuid, name text, trade_name text, city text, zip text, trades text[], zone text, verified boolean,
              rating numeric, reviews_count int, visio boolean, is_mine boolean, logo_path text, zone_lat double precision, zone_lon double precision, zone_km int)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.trade_name, c.city, c.zip, c.trades, c.zone, c.verified,
    (select round(avg(rating)::numeric,1) from public.reviews r where r.company_id = c.id and r.status='publie'),
    (select count(*)::int from public.reviews r where r.company_id = c.id and r.status='publie'),
    coalesce((c.settings->'planning'->>'visio')::boolean, true),
    exists(select 1 from public.clients cl where cl.company_id = c.id and cl.user_id = auth.uid()),
    c.logo_path, c.zone_lat, c.zone_lon, c.zone_km
  from public.companies c
  where auth.uid() is not null and c.verification_status = 'approved'
    and (c.visible_particuliers or exists(select 1 from public.clients cl where cl.company_id = c.id and cl.user_id = auth.uid())
         or c.visible_pros and public.my_company() is not null)
    and (p_query = '' or c.name ilike '%'||p_query||'%' or c.trade_name ilike '%'||p_query||'%' or array_to_string(c.trades,' ') ilike '%'||p_query||'%')
    and (p_trade = '' or array_to_string(c.trades,' ') ilike '%'||p_trade||'%')
    and (p_city = '' or c.city ilike '%'||p_city||'%' or c.zone ilike '%'||p_city||'%')
  order by c.name
  limit 200
$$;

-- ───────────────── Relances clients (historique et pause par document) ─────────────────
alter table public.documents add column if not exists reminders jsonb default '[]'::jsonb;
alter table public.documents add column if not exists reminders_paused boolean default false;

-- ───────────────── Demande de RDV : carte distincte dans la conversation + confirmation d'envoi ─────────────────
create or replace function public.request_appointment(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid; pid uuid; aid uuid; comp uuid := (p->>'company_id')::uuid; prof public.profiles; conv uuid;
begin
  cid := public.ensure_client(comp);
  select * into prof from public.profiles where id = auth.uid();
  insert into public.projects(company_id, client_id, title, address)
    values (comp, cid, coalesce(nullif(p->>'title',''), p->>'type'), coalesce(prof.home->>'address','') || ' ' || coalesce(prof.home->>'city',''))
    returning id into pid;
  insert into public.appointments(company_id, client_id, project_id, type, title, start_at, end_at, mode, status, request_text, photos,
     address, contact_name, contact_phone, requested_by)
  values (comp, cid, pid, p->>'type', coalesce(nullif(p->>'title',''), p->>'type'), (p->>'start_at')::timestamptz, (p->>'end_at')::timestamptz,
     coalesce(p->>'mode','site'), 'a_valider', coalesce(p->>'text',''), coalesce(p->'photos','[]'::jsonb),
     trim(coalesce(prof.home->>'address','') || ', ' || coalesce(prof.home->>'zip','') || ' ' || coalesce(prof.home->>'city',''), ', '),
     trim(prof.first_name || ' ' || prof.last_name), prof.phone, auth.uid())
  returning id into aid;
  -- conversation client
  select id into conv from public.conversations where kind='client' and company_id=comp and client_user_id=auth.uid();
  if conv is null then
    insert into public.conversations(kind, company_id, client_id, client_user_id, project_id) values ('client', comp, cid, auth.uid(), pid) returning id into conv;
  end if;
  -- La demande apparaît comme une carte « Demande de RDV envoyée » (et non comme un message ordinaire)
  insert into public.messages(conversation_id, sender_id, sender_name, body, attachments, card)
  values (conv, auth.uid(), trim(prof.first_name || ' ' || prof.last_name), coalesce(p->>'text',''), coalesce(p->'photos','[]'::jsonb),
          jsonb_build_object('type','demande','title','Demande de RDV envoyée','sub', coalesce(p->>'type','') || ' · ' || to_char((p->>'start_at')::timestamptz at time zone 'Europe/Paris','DD/MM HH24:MI') || case when p->>'mode' = 'visio' then ' · visio' else '' end, 'appointment_id', aid));
  perform public.notify_company(comp, 'rdv', 'Nouvelle demande de RDV', trim(prof.first_name||' '||prof.last_name)||' · '||coalesce(p->>'type','')||' · '||to_char((p->>'start_at')::timestamptz at time zone 'Europe/Paris','DD/MM HH24:MI'), '/pro/planning/rdv/'||aid);
  -- Confirmation d'envoi pour le particulier
  insert into public.notifications(user_id, category, title, body, link)
  values (auth.uid(), 'rdv', 'Demande envoyée', (select coalesce(nullif(trade_name,''), name) from public.companies where id = comp) || ' · ' || coalesce(p->>'type','') || ' · ' || to_char((p->>'start_at')::timestamptz at time zone 'Europe/Paris','DD/MM HH24:MI') || ' · en attente de confirmation', '/client/rdv/'||aid);
  return aid;
end $$;

-- Aperçu de la conversation : une demande de RDV s'affiche comme telle
create or replace function public.on_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.conversations;
begin
  select * into c from public.conversations where id = new.conversation_id;
  update public.conversations set last_message = left(
      case when new.card->>'type' = 'demande' then '📅 ' || (new.card->>'title') || coalesce(' · ' || nullif(new.body,''), '')
           else coalesce(nullif(new.body,''), case when new.card is not null then new.card->>'title' else '📎 Pièce jointe' end) end, 140),
    last_at = new.created_at where id = c.id;
  -- Son propre message n'est jamais « non lu »
  if new.sender_id is not null then
    insert into public.conversation_reads(conversation_id, user_id, last_read_at) values (c.id, new.sender_id, new.created_at)
    on conflict (conversation_id, user_id) do update set last_read_at = greatest(public.conversation_reads.last_read_at, excluded.last_read_at);
  end if;
  if c.client_user_id is not null and c.client_user_id <> new.sender_id then
    insert into public.notifications(user_id, category, title, body, link) values (c.client_user_id, 'message', 'Nouveau message', coalesce(new.sender_name,'') || ' : ' || left(coalesce(nullif(new.body,''), new.card->>'title', '📎'),80), '/client/messages/'||c.id);
  end if;
  return new;
end $$;

-- ───────────────── RDV : une notification au client à chaque modification (date, heure, équipe, visio/site, adresse) ─────────────────
create or replace function public.on_appointment() returns trigger
language plpgsql security definer set search_path = public as $$
declare uid uuid; ch text := '';
begin
  select user_id into uid from public.clients where id = new.client_id;
  if uid is null or uid = auth.uid() then return new; end if;
  if tg_op = 'UPDATE' then
    if (new.start_at at time zone 'Europe/Paris')::date is distinct from (old.start_at at time zone 'Europe/Paris')::date then ch := ch || ' · date : ' || to_char(new.start_at at time zone 'Europe/Paris','DD/MM'); end if;
    if to_char(new.start_at at time zone 'Europe/Paris','HH24:MI') is distinct from to_char(old.start_at at time zone 'Europe/Paris','HH24:MI') or new.end_at is distinct from old.end_at then
      ch := ch || ' · heure : ' || to_char(new.start_at at time zone 'Europe/Paris','HH24:MI') || '–' || to_char(new.end_at at time zone 'Europe/Paris','HH24:MI'); end if;
    if new.team_id is distinct from old.team_id then ch := ch || ' · équipe : ' || coalesce((select name from public.teams where id = new.team_id), '—'); end if;
    if new.mode is distinct from old.mode then ch := ch || case when new.mode = 'visio' then ' · en visio (WhatsApp)' else ' · sur site' end; end if;
    if coalesce(new.address,'') is distinct from coalesce(old.address,'') and new.mode <> 'visio' then ch := ch || ' · adresse : ' || new.address; end if;
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.notifications(user_id, category, title, body, link) values (uid, 'rdv',
      case new.status when 'valide' then case when ch <> '' then 'RDV confirmé (modifié)' else 'RDV confirmé' end when 'refuse' then 'RDV refusé' when 'annule' then 'RDV annulé' when 'termine' then 'Intervention terminée' else 'RDV mis à jour' end,
      new.title || ' · ' || to_char(new.start_at at time zone 'Europe/Paris','DD/MM HH24:MI') || case when new.status = 'valide' then ch else '' end, '/client/rdv/'||new.id);
  elsif tg_op = 'UPDATE' and ch <> '' then
    insert into public.notifications(user_id, category, title, body, link) values (uid,'rdv','RDV modifié', new.title || ch, '/client/rdv/'||new.id);
  elsif tg_op = 'UPDATE' and new.enroute_at is distinct from old.enroute_at and new.enroute_at is not null then
    insert into public.notifications(user_id, category, title, body, link) values (uid,'rdv','Votre artisan est en route',
      coalesce('Arrivée prévue vers ' || to_char(new.eta_at at time zone 'Europe/Paris','HH24"h"MI'), ''), '/client/rdv/'||new.id||'?enroute=1');
  elsif tg_op = 'INSERT' then
    insert into public.notifications(user_id, category, title, body, link) values (uid,'rdv','Nouveau RDV', new.title || ' · ' || to_char(new.start_at at time zone 'Europe/Paris','DD/MM HH24:MI'), '/client/rdv/'||new.id);
  end if;
  return new;
end $$;

-- ───────────────── Agenda par abonnement (lien secret lu par Google Agenda / Outlook / iPhone) ─────────────────
alter table public.companies add column if not exists calendar_token text unique;
create or replace function public.calendar_token(p_reset boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare tok text;
begin
  if public.my_company() is null then raise exception 'Réservé aux entreprises'; end if;
  select calendar_token into tok from public.companies where id = public.my_company();
  if tok is null or p_reset then
    tok := encode(extensions.gen_random_bytes(24), 'hex');
    perform set_config('ay.trusted','1',true);
    update public.companies set calendar_token = tok where id = public.my_company();
  end if;
  return tok;
end $$;
