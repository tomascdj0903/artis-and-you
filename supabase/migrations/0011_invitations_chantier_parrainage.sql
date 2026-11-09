-- 1) Projets en commun : invitation à accepter, réservée aux pros du réseau
alter table public.project_shares add column if not exists status text not null default 'accepted' check (status in ('pending','accepted'));
alter table public.project_shares add column if not exists invited_by uuid references public.companies(id) on delete set null;

-- Seuls les partages acceptés donnent accès au chantier
create or replace function public.shared_project_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select project_id from public.project_shares where company_id = public.my_company() and status = 'accepted'
$$;
-- Plus d'écriture directe : tout passe par project_invite / project_invite_answer / project_leave
drop policy if exists shares_company on public.project_shares;
drop policy if exists shares_sel on public.project_shares;
create policy shares_sel on public.project_shares for select to authenticated
  using (project_id in (select public.my_project_ids()) or company_id = (select public.my_company()));

create or replace function public.project_invite(p_project uuid, p_company uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare mc uuid := public.my_company(); pr public.projects; me public.companies; conv uuid;
begin
  select * into pr from public.projects where id = p_project and company_id = mc;
  if pr.id is null then raise exception 'Seul le pro qui a créé le chantier peut inviter.'; end if;
  if not exists(select 1 from public.network where company_id = mc and pro_id = p_company) then
    raise exception 'Ajoutez d''abord ce pro à votre réseau : il doit accepter votre demande avant d''être invité sur un chantier.';
  end if;
  if exists(select 1 from public.project_shares where project_id = p_project and company_id = p_company) then
    raise exception 'Ce pro est déjà invité sur ce chantier.';
  end if;
  insert into public.project_shares(project_id, company_id, status, invited_by) values (p_project, p_company, 'pending', mc);
  select * into me from public.companies where id = mc;
  select id into conv from public.conversations where kind = 'pro' and ((company_id = mc and other_company_id = p_company) or (company_id = p_company and other_company_id = mc)) limit 1;
  if conv is null then
    insert into public.conversations(kind, company_id, other_company_id, last_message, last_at) values ('pro', mc, p_company, '', now()) returning id into conv;
  end if;
  insert into public.messages(conversation_id, sender_id, sender_name, sender_company_id, body, card)
  values (conv, auth.uid(), me.name, mc, '', jsonb_build_object('type','project_invite','title','Invitation sur un chantier · ' || pr.title,'sub', coalesce(pr.address,''),'project_id', pr.id));
  perform public.notify_company(p_company, 'systeme', 'Invitation sur un chantier', coalesce(nullif(me.trade_name,''), me.name) || ' vous invite sur « ' || pr.title || ' »', '/pro/messages/' || conv);
  return conv;
end $$;

create or replace function public.project_invite_answer(p_project uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare mc uuid := public.my_company(); s public.project_shares; pr public.projects; me public.companies; conv uuid;
begin
  select * into s from public.project_shares where project_id = p_project and company_id = mc and status = 'pending';
  if s.project_id is null then raise exception 'Invitation introuvable ou déjà traitée.'; end if;
  select * into pr from public.projects where id = p_project;
  select * into me from public.companies where id = mc;
  if p_accept then update public.project_shares set status = 'accepted' where project_id = p_project and company_id = mc;
  else delete from public.project_shares where project_id = p_project and company_id = mc; end if;
  select id into conv from public.conversations where kind = 'pro' and ((company_id = mc and other_company_id = pr.company_id) or (company_id = pr.company_id and other_company_id = mc)) limit 1;
  if conv is not null then
    insert into public.messages(conversation_id, sender_id, sender_name, sender_company_id, body, card)
    values (conv, auth.uid(), me.name, mc, '', jsonb_build_object('type', case when p_accept then 'done' else 'info' end, 'title', case when p_accept then 'Invitation acceptée' else 'Invitation refusée' end, 'sub', pr.title, 'project_id', pr.id));
  end if;
  perform public.notify_company(pr.company_id, 'systeme', case when p_accept then 'Invitation acceptée' else 'Invitation refusée' end,
    coalesce(nullif(me.trade_name,''), me.name) || case when p_accept then ' rejoint le chantier « ' else ' ne rejoint pas le chantier « ' end || pr.title || ' »', '/pro/planning?projet=' || pr.id);
end $$;

create or replace function public.project_invites_list() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('project_id', p.id, 'title', p.title, 'address', p.address, 'created_at', s.created_at,
    'from', jsonb_build_object('id', c.id, 'name', coalesce(nullif(c.trade_name,''), c.name))) order by s.created_at desc), '[]'::jsonb)
  from public.project_shares s join public.projects p on p.id = s.project_id join public.companies c on c.id = p.company_id
  where s.company_id = public.my_company() and s.status = 'pending'
$$;

-- shared_projects / shared_project_planning : uniquement les participants ayant accepté
create or replace function public.shared_projects() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x->>'title'), '[]'::jsonb) from (
    select jsonb_build_object('id', p.id, 'title', p.title, 'address', p.address, 'owner', p.company_id, 'finished_at', p.finished_at,
      'members', (select jsonb_agg(jsonb_build_object('id', c.id, 'name', coalesce(nullif(c.trade_name,''), c.name), 'trades', c.trades))
                  from public.companies c where c.id = p.company_id or c.id in (select company_id from public.project_shares s where s.project_id = p.id and s.status = 'accepted'))) x
    from public.projects p
    where exists(select 1 from public.project_shares s where s.project_id = p.id and s.status = 'accepted')
      and (p.company_id = public.my_company() or p.id in (select public.shared_project_ids()))
  ) q
$$;
create or replace function public.shared_project_planning(p_project uuid, p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare ok boolean;
begin
  select exists(select 1 from public.projects p where p.id = p_project and (p.company_id = public.my_company() or p.id in (select public.shared_project_ids()))) into ok;
  if not ok then raise exception 'Chantier introuvable'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'type', a.type, 'start_at', a.start_at, 'end_at', a.end_at, 'status', a.status,
      'company_id', a.company_id, 'company', coalesce(nullif(c.trade_name,''), c.name), 'trades', c.trades, 'mine', a.company_id = public.my_company()) order by a.start_at)
    from public.appointments a join public.companies c on c.id = a.company_id
    where a.project_id = p_project and a.status in ('a_valider','valide','termine') and a.start_at < p_to and a.end_at > p_from
      and (c.id = (select company_id from public.projects where id = p_project) or c.id in (select company_id from public.project_shares where project_id = p_project and status = 'accepted'))), '[]'::jsonb);
end $$;

-- 2) Parrainage : filleul 2 mois offerts (60 jours), parrain +15 jours, 10 filleuls maximum
create or replace function public.on_company_referral() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.referred_by is not null and (new.referred_by = new.id or (select count(*) from public.companies where referred_by = new.referred_by) >= 10) then
    new.referred_by := null;
  end if;
  if new.referred_by is not null then
    new.trial_ends_at := now() + interval '60 days';
    update public.companies set trial_ends_at = greatest(coalesce(trial_ends_at, now()), now()) + interval '15 days' where id = new.referred_by;
    perform public.notify_company(new.referred_by, 'systeme', 'Parrainage réussi 🎁', new.name || ' a rejoint Artesa avec votre code : 15 jours offerts pour vous.', '/pro/compte/abonnement');
  end if;
  return new;
end $$;
revoke execute on function public.on_company_referral() from public, anon, authenticated;

create or replace function public.referral_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('count', (select count(*) from public.companies where referred_by = public.my_company()), 'max', 10)
$$;

do $$ declare f text; begin
  foreach f in array array['project_invite(uuid,uuid)','project_invite_answer(uuid,boolean)','project_invites_list()','referral_stats()'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
