-- 1) Réseau : demandes de connexion (comme LinkedIn), connexion des deux côtés à l'acceptation
create table if not exists public.network_requests (
  id uuid primary key default gen_random_uuid(),
  from_company uuid not null references public.companies(id) on delete cascade,
  to_company uuid not null references public.companies(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  message text default '',
  created_at timestamptz default now(),
  answered_at timestamptz,
  unique (from_company, to_company)
);
create index if not exists ix_netreq_to on public.network_requests(to_company);
alter table public.network_requests enable row level security;
create policy netreq_sel on public.network_requests for select to authenticated using (from_company = public.my_company() or to_company = public.my_company());

drop policy if exists network_company on public.network;
create policy network_sel on public.network for select to authenticated using (company_id = public.my_company());
create policy network_del on public.network for delete to authenticated using (company_id = public.my_company());

create or replace function public.network_request(p_to uuid, p_message text default '') returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := public.my_company(); rev public.network_requests; mine public.companies;
begin
  if me is null then raise exception 'Réservé aux professionnels'; end if;
  if p_to = me then raise exception 'Impossible'; end if;
  if exists(select 1 from public.network where company_id = me and pro_id = p_to) then return 'connected'; end if;
  select * into mine from public.companies where id = me;
  select * into rev from public.network_requests where from_company = p_to and to_company = me and status = 'pending';
  if rev.id is not null then
    perform public.network_answer(rev.id, true);
    return 'connected';
  end if;
  insert into public.network_requests(from_company, to_company, message) values (me, p_to, coalesce(p_message,''))
  on conflict (from_company, to_company) do update set status = 'pending', created_at = now(), answered_at = null, message = excluded.message;
  perform public.notify_company(p_to, 'systeme', 'Demande de connexion', coalesce(nullif(mine.trade_name,''), mine.name) || ' souhaite rejoindre votre réseau', '/pro/reseau?demandes=1');
  return 'pending';
end $$;

create or replace function public.network_answer(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r public.network_requests; me uuid := public.my_company(); co public.companies;
begin
  select * into r from public.network_requests where id = p_id and status = 'pending';
  if r.id is null or r.to_company <> me then raise exception 'Demande introuvable'; end if;
  update public.network_requests set status = case when p_accept then 'accepted' else 'declined' end, answered_at = now() where id = p_id;
  if p_accept then
    insert into public.network(company_id, pro_id) values (r.from_company, r.to_company), (r.to_company, r.from_company) on conflict do nothing;
    select * into co from public.companies where id = me;
    perform public.notify_company(r.from_company, 'systeme', 'Demande acceptée', coalesce(nullif(co.trade_name,''), co.name) || ' fait maintenant partie de votre réseau', '/pro/reseau/' || me);
  end if;
end $$;

create or replace function public.network_remove(p_pro uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.network where (company_id = public.my_company() and pro_id = p_pro) or (company_id = p_pro and pro_id = public.my_company());
end $$;

-- Demandes reçues/envoyées avec le nom des entreprises
create or replace function public.network_requests_list() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'status', r.status, 'created_at', r.created_at, 'message', r.message,
    'incoming', r.to_company = public.my_company(),
    'company', jsonb_build_object('id', c.id, 'name', c.name, 'trade_name', c.trade_name, 'city', c.city, 'trades', c.trades, 'logo_path', c.logo_path))
    order by r.created_at desc), '[]'::jsonb)
  from public.network_requests r join public.companies c on c.id = case when r.to_company = public.my_company() then r.from_company else r.to_company end
  where r.status = 'pending' and (r.to_company = public.my_company() or r.from_company = public.my_company())
$$;

-- 2) RDV : historique des déplacements + message dans la conversation du client
alter table public.appointments add column if not exists history jsonb default '[]'::jsonb;
create or replace function public.appointment_history() returns trigger
language plpgsql as $$
begin
  if new.start_at is distinct from old.start_at or new.end_at is distinct from old.end_at then
    new.history := coalesce(old.history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('at', now(), 'kind', 'moved', 'from', old.start_at, 'from_end', old.end_at, 'to', new.start_at, 'to_end', new.end_at, 'by', auth.uid()));
  end if;
  return new;
end $$;
drop trigger if exists appointments_history on public.appointments;
create trigger appointments_history before update on public.appointments for each row execute function public.appointment_history();

create or replace function public.appointment_moved_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare uid uuid; conv uuid; co public.companies; nm text;
begin
  if new.start_at is not distinct from old.start_at and new.end_at is not distinct from old.end_at then return new; end if;
  select user_id into uid from public.clients where id = new.client_id;
  if uid is null or uid = auth.uid() then return new; end if;
  select * into co from public.companies where id = new.company_id;
  select id into conv from public.conversations where kind = 'client' and company_id = new.company_id and client_user_id = uid limit 1;
  if conv is null then
    insert into public.conversations(kind, company_id, client_id, client_user_id, project_id) values ('client', new.company_id, new.client_id, uid, new.project_id) returning id into conv;
  end if;
  select trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')) into nm from public.profiles where id = auth.uid();
  insert into public.messages(conversation_id, sender_id, sender_name, sender_company_id, body, card)
  values (conv, auth.uid(), coalesce(nullif(nm,''), co.name), new.company_id,
    'Le rendez-vous « ' || coalesce(new.title,'') || ' » a été déplacé du ' || to_char(old.start_at at time zone 'Europe/Paris','DD/MM à HH24:MI') || ' au ' || to_char(new.start_at at time zone 'Europe/Paris','DD/MM à HH24:MI') || '.',
    jsonb_build_object('type','rdv_change','title','RDV déplacé','sub', to_char(new.start_at at time zone 'Europe/Paris','DD/MM HH24:MI') || '–' || to_char(new.end_at at time zone 'Europe/Paris','HH24:MI'), 'appointment_id', new.id));
  return new;
end $$;
revoke execute on function public.appointment_moved_message() from public, anon, authenticated;
drop trigger if exists appointments_moved_msg on public.appointments;
create trigger appointments_moved_msg after update on public.appointments for each row execute function public.appointment_moved_message();

-- Pas de double notification : le RDV déplacé est déjà notifié par on_appointment
create or replace function public.on_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.conversations;
begin
  select * into c from public.conversations where id = new.conversation_id;
  update public.conversations set last_message = left(
      case when new.card->>'type' = 'demande' then '📅 ' || (new.card->>'title') || coalesce(' · ' || nullif(new.body,''), '')
           when new.card->>'type' = 'rdv_change' then '📅 ' || (new.card->>'title') || ' · ' || (new.card->>'sub')
           else coalesce(nullif(new.body,''), case when new.card is not null then new.card->>'title' else '📎 Pièce jointe' end) end, 140),
    last_at = new.created_at where id = c.id;
  if new.sender_id is not null then
    insert into public.conversation_reads(conversation_id, user_id, last_read_at) values (c.id, new.sender_id, new.created_at)
    on conflict (conversation_id, user_id) do update set last_read_at = greatest(public.conversation_reads.last_read_at, excluded.last_read_at);
  end if;
  if c.client_user_id is not null and c.client_user_id is distinct from new.sender_id and coalesce(new.card->>'type','') <> 'rdv_change' then
    insert into public.notifications(user_id, category, title, body, link) values (c.client_user_id, 'message', 'Nouveau message', coalesce(new.sender_name,'') || ' : ' || left(coalesce(nullif(new.body,''), new.card->>'title', '📎'),80), '/client/messages/'||c.id);
  end if;
  return new;
end $$;

-- 3) Chantiers en commun : participants et planning partagé
create or replace function public.shared_projects() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x->>'title'), '[]'::jsonb) from (
    select jsonb_build_object('id', p.id, 'title', p.title, 'address', p.address, 'owner', p.company_id, 'finished_at', p.finished_at,
      'members', (select jsonb_agg(jsonb_build_object('id', c.id, 'name', coalesce(nullif(c.trade_name,''), c.name), 'trades', c.trades))
                  from public.companies c where c.id = p.company_id or c.id in (select company_id from public.project_shares s where s.project_id = p.id))) x
    from public.projects p
    where exists(select 1 from public.project_shares s where s.project_id = p.id)
      and (p.company_id = public.my_company() or p.id in (select project_id from public.project_shares where company_id = public.my_company()))
  ) q
$$;

create or replace function public.shared_project_planning(p_project uuid, p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare ok boolean;
begin
  select exists(select 1 from public.projects p where p.id = p_project and (p.company_id = public.my_company() or exists(select 1 from public.project_shares s where s.project_id = p.id and s.company_id = public.my_company()))) into ok;
  if not ok then raise exception 'Chantier introuvable'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'type', a.type, 'start_at', a.start_at, 'end_at', a.end_at, 'status', a.status,
      'company_id', a.company_id, 'company', coalesce(nullif(c.trade_name,''), c.name), 'trades', c.trades, 'mine', a.company_id = public.my_company()) order by a.start_at)
    from public.appointments a join public.companies c on c.id = a.company_id
    where a.project_id = p_project and a.status in ('a_valider','valide','termine') and a.start_at < p_to and a.end_at > p_from), '[]'::jsonb);
end $$;

-- 4) Notes internes : une seule note par auteur et par cible
create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('pro_pro','pro_client')),
  author_company uuid not null references public.companies(id) on delete cascade,
  author_user uuid default auth.uid() references auth.users(id) on delete set null,
  target_company uuid references public.companies(id) on delete cascade,
  target_client uuid references public.clients(id) on delete cascade,
  target_user uuid references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text default '',
  created_at timestamptz default now(),
  unique (author_company, target_company),
  unique (author_company, target_client)
);
create index if not exists ix_ratings_tc on public.ratings(target_company);
create index if not exists ix_ratings_tu on public.ratings(target_user);
alter table public.ratings enable row level security;
create policy ratings_sel on public.ratings for select to authenticated using (author_company = public.my_company() or (kind = 'pro_pro' and target_company = public.my_company()));

create or replace function public.rate_pro(p_company uuid, p_rating int, p_comment text default '') returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.my_company();
begin
  if me is null or p_company = me then raise exception 'Impossible'; end if;
  if not exists(select 1 from public.projects p where (p.company_id = me and exists(select 1 from public.project_shares s where s.project_id = p.id and s.company_id = p_company))
                                              or (p.company_id = p_company and exists(select 1 from public.project_shares s where s.project_id = p.id and s.company_id = me))
                                              or exists(select 1 from public.project_shares s1 join public.project_shares s2 on s1.project_id = s2.project_id where s1.company_id = me and s2.company_id = p_company))
  then raise exception 'Vous pourrez noter ce pro après avoir travaillé ensemble sur un chantier.'; end if;
  if exists(select 1 from public.ratings where author_company = me and target_company = p_company) then raise exception 'Vous avez déjà noté ce pro.'; end if;
  insert into public.ratings(kind, author_company, target_company, rating, comment) values ('pro_pro', me, p_company, p_rating, coalesce(p_comment,''));
  perform public.notify_company(p_company, 'systeme', 'Nouvelle note d''un pro', p_rating || '/5', '/pro/compte/avis');
end $$;

create or replace function public.rate_client(p_client uuid, p_rating int, p_comment text default '') returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.my_company(); cl public.clients;
begin
  select * into cl from public.clients where id = p_client and company_id = me;
  if cl.id is null then raise exception 'Client introuvable'; end if;
  if not exists(select 1 from public.appointments a where a.client_id = p_client and a.status in ('valide','termine') and a.start_at < now())
     and not exists(select 1 from public.documents d where d.client_id = p_client and d.number is not null)
  then raise exception 'Vous pourrez noter ce client après un premier rendez-vous ou un premier document.'; end if;
  if exists(select 1 from public.ratings where author_company = me and target_client = p_client) then raise exception 'Vous avez déjà noté ce client.'; end if;
  insert into public.ratings(kind, author_company, target_client, target_user, rating, comment) values ('pro_client', me, p_client, cl.user_id, p_rating, coalesce(p_comment,''));
end $$;

-- Note moyenne d'un client (vue par les pros seulement) : toutes les entreprises qui l'ont noté
create or replace function public.client_score(p_client uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.my_company() is null then null else (
    select jsonb_build_object('avg', round(avg(r.rating)::numeric, 1), 'n', count(*), 'mine', max(case when r.author_company = public.my_company() then r.rating end))
    from public.ratings r, public.clients c
    where c.id = p_client and c.company_id = public.my_company() and r.kind = 'pro_client' and (r.target_client = c.id or (c.user_id is not null and r.target_user = c.user_id))) end
$$;

-- Note d'un pro par ses pairs
create or replace function public.pro_score(p_company uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('avg', round(avg(rating)::numeric, 1), 'n', count(*), 'mine', max(case when author_company = public.my_company() then rating end))
  from public.ratings where kind = 'pro_pro' and target_company = p_company and auth.uid() is not null
$$;

-- Avis client → pro : une seule fois par client
create or replace function public.post_review(p_company uuid, p_rating int, p_comment text) returns void
language plpgsql security definer set search_path = public as $$
declare a uuid; prof public.profiles;
begin
  if exists(select 1 from public.reviews where company_id = p_company and author_id = auth.uid()) then raise exception 'Vous avez déjà donné votre avis sur ce pro.'; end if;
  select ap.id into a from public.appointments ap
   where ap.company_id = p_company and ap.client_id in (select public.my_client_ids())
     and ap.status in ('valide','termine') and ap.start_at < now()
   order by ap.start_at desc limit 1;
  if a is null then raise exception 'Un avis ne peut être donné qu''après un vrai rendez-vous.'; end if;
  select * into prof from public.profiles where id = auth.uid();
  insert into public.reviews(company_id, author_id, author_label, appointment_id, rating, comment)
  values (p_company, auth.uid(), prof.first_name || ' ' || left(prof.last_name,1) || '.', a, p_rating, p_comment);
  perform public.notify_company(p_company,'systeme','Nouvel avis client', p_rating||'/5', '/pro/compte/avis');
end $$;

-- 5) RDV terminés automatiquement à l'heure de fin
create or replace function public.finish_past_appointments() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.appointments set status = 'termine' where status = 'valide' and end_at < now() and company_id = public.my_company();
  get diagnostics n = row_count; return n;
end $$;

do $$ declare f text; begin
  foreach f in array array['network_request(uuid,text)','network_answer(uuid,boolean)','network_remove(uuid)','network_requests_list()','shared_projects()','shared_project_planning(uuid,timestamptz,timestamptz)','rate_pro(uuid,integer,text)','rate_client(uuid,integer,text)','client_score(uuid)','pro_score(uuid)','post_review(uuid,integer,text)','finish_past_appointments()'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
