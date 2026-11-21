-- (appliquée en prod) Suivi de chantier en photos : étapes publiées par l'artisan, validées par le client
create table if not exists public.project_steps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null, note text, photos jsonb not null default '[]'::jsonb,
  status text not null default 'envoye' check (status in ('envoye','valide','a_revoir')),
  client_comment text, created_by uuid default auth.uid(), created_at timestamptz not null default now(), decided_at timestamptz);
create index if not exists project_steps_project on public.project_steps(project_id);
alter table public.project_steps enable row level security;
drop policy if exists project_steps_company on public.project_steps;
create policy project_steps_company on public.project_steps for all to authenticated
  using (company_id = (select public.my_company())) with check (company_id = (select public.my_company()));
drop policy if exists project_steps_client on public.project_steps;
create policy project_steps_client on public.project_steps for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.client_id in (select public.my_client_ids())));

-- L'artisan publie une étape (photos déjà envoyées dans son dossier) : le client est prévenu
create or replace function public.add_project_step(p_project uuid, p_title text, p_note text, p_photos jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare pr public.projects; sid uuid; ph jsonb; cuid uuid; co text;
begin
  select * into pr from public.projects where id = p_project and company_id = public.my_company();
  if pr is null then raise exception 'Chantier introuvable'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Donnez un titre à l''étape.'; end if;
  select coalesce(jsonb_agg(x), '[]'::jsonb) into ph from (select x from jsonb_array_elements_text(coalesce(p_photos, '[]'::jsonb)) x
    where x like pr.company_id::text || '/chantier/%' limit 12) s;
  insert into public.project_steps(project_id, company_id, title, note, photos) values (p_project, pr.company_id, left(trim(p_title), 120), left(coalesce(p_note, ''), 2000), ph) returning id into sid;
  select user_id into cuid from public.clients where id = pr.client_id;
  select coalesce(nullif(trade_name, ''), name) into co from public.companies where id = pr.company_id;
  if cuid is not null then
    insert into public.notifications(user_id, category, title, body, link)
    values (cuid, 'documents', 'Nouvelle étape de chantier', co || ' · ' || left(trim(p_title), 120) || ' · à valider', '/client/chantiers/' || p_project);
  end if;
  return sid;
end $$;
grant execute on function public.add_project_step(uuid, text, text, jsonb) to authenticated;

-- Le client valide l'étape ou demande une reprise
create or replace function public.decide_project_step(p_id uuid, p_ok boolean, p_comment text default '')
returns void language plpgsql security definer set search_path = public as $$
declare s public.project_steps;
begin
  select st.* into s from public.project_steps st join public.projects p on p.id = st.project_id
   where st.id = p_id and p.client_id in (select public.my_client_ids());
  if s is null then raise exception 'Étape introuvable'; end if;
  if not p_ok and coalesce(trim(p_comment), '') = '' then raise exception 'Expliquez ce qui doit être repris.'; end if;
  update public.project_steps set status = case when p_ok then 'valide' else 'a_revoir' end, client_comment = nullif(left(trim(coalesce(p_comment, '')), 1000), ''), decided_at = now() where id = p_id;
  perform public.notify_company(s.company_id, 'documents', case when p_ok then 'Étape validée par le client' else 'Le client demande une reprise' end,
    s.title || case when coalesce(trim(p_comment), '') <> '' then ' · « ' || left(trim(p_comment), 80) || ' »' else '' end, '/pro/chantiers/' || s.project_id);
end $$;
grant execute on function public.decide_project_step(uuid, boolean, text) to authenticated;

-- Photos des étapes : visibles par le client du chantier
drop policy if exists project_step_photos_read on storage.objects;
create policy project_step_photos_read on storage.objects for select to authenticated using (
  bucket_id = 'files' and (storage.foldername(name))[2] = 'chantier' and exists (
    select 1 from public.project_steps st join public.projects p on p.id = st.project_id
    where st.photos @> jsonb_build_array(objects.name) and p.client_id in (select public.my_client_ids())));
