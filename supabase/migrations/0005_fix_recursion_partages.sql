-- Corrige « infinite recursion detected in policy » entre projects et project_shares (page Mon réseau)
create or replace function public.my_project_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.projects where company_id = public.my_company()
$$;
create or replace function public.shared_project_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select project_id from public.project_shares where company_id = public.my_company()
$$;
revoke execute on function public.my_project_ids() from public, anon;
revoke execute on function public.shared_project_ids() from public, anon;
grant execute on function public.my_project_ids() to authenticated;
grant execute on function public.shared_project_ids() to authenticated;
drop policy if exists projects_shared on public.projects;
create policy projects_shared on public.projects for select using (id in (select public.shared_project_ids()));
drop policy if exists shares_company on public.project_shares;
create policy shares_company on public.project_shares for all
  using (project_id in (select public.my_project_ids()) or company_id = public.my_company())
  with check (project_id in (select public.my_project_ids()));
