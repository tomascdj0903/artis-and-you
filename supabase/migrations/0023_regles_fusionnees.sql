-- 0023 : une seule règle d'accès (RLS) par table et par action.
-- Avant, 9 tables avaient 2 à 4 règles permissives pour la même action : Postgres les évaluait toutes à chaque ligne.
-- Ici, on remplace chaque groupe par une règle unique équivalente (les conditions sont reliées par OR, ce qui est
-- exactement la sémantique des règles permissives). Les règles RESTRICTIVE (« _own_* ») ne bougent pas.
-- Les droits sont strictement identiques avant et après.

-- Rendez-vous ---------------------------------------------------------------------------------------------------
drop policy if exists appointments_company on public.appointments;
drop policy if exists appointments_client on public.appointments;
create policy appointments_sel on public.appointments for select to authenticated
  using (company_id = (select my_company()) or client_id in (select my_client_ids()));
create policy appointments_ins on public.appointments for insert to authenticated
  with check (company_id = (select my_company()));
create policy appointments_upd on public.appointments for update to authenticated
  using (company_id = (select my_company())) with check (company_id = (select my_company()));
create policy appointments_del on public.appointments for delete to authenticated
  using (company_id = (select my_company()));

-- Clients -------------------------------------------------------------------------------------------------------
drop policy if exists clients_company on public.clients;
drop policy if exists clients_self on public.clients;
create policy clients_sel on public.clients for select to authenticated
  using (company_id = (select my_company()) or user_id = (select auth.uid()));
create policy clients_ins on public.clients for insert to authenticated
  with check (company_id = (select my_company()));
create policy clients_upd on public.clients for update to authenticated
  using (company_id = (select my_company())) with check (company_id = (select my_company()));
create policy clients_del on public.clients for delete to authenticated
  using (company_id = (select my_company()));

-- Entreprises ---------------------------------------------------------------------------------------------------
drop policy if exists companies_admin_sel on public.companies;
drop policy if exists companies_client on public.companies;
drop policy if exists companies_conv on public.companies;
drop policy if exists companies_sel on public.companies;
create policy companies_sel on public.companies for select to authenticated
  using (
    id = (select my_company())
    or (select is_admin())
    or id in (select network.pro_id from public.network where network.company_id = (select my_company()))
    or id in (select clients.company_id from public.clients where clients.user_id = (select auth.uid()))
    or id in (select c.company_id from public.conversations c where c.other_company_id = (select my_company()))
    or id in (select c.other_company_id from public.conversations c where c.company_id = (select my_company()))
  );
drop policy if exists companies_admin_upd on public.companies;
drop policy if exists companies_upd on public.companies;
create policy companies_upd on public.companies for update to authenticated
  using ((select is_admin()) or (id = (select my_company()) and (select is_gerant())))
  with check ((select is_admin()) or (id = (select my_company()) and (select is_gerant())));

-- Documents -----------------------------------------------------------------------------------------------------
drop policy if exists documents_company on public.documents;
drop policy if exists documents_client on public.documents;
create policy documents_sel on public.documents for select to authenticated
  using (company_id = (select my_company()) or (number is not null and client_id in (select my_client_ids())));
create policy documents_ins on public.documents for insert to authenticated
  with check (company_id = (select my_company()));
create policy documents_upd on public.documents for update to authenticated
  using (company_id = (select my_company())) with check (company_id = (select my_company()));
create policy documents_del on public.documents for delete to authenticated
  using (company_id = (select my_company()));

-- Fichiers ------------------------------------------------------------------------------------------------------
drop policy if exists files_company on public.files;
drop policy if exists files_client_ins on public.files;
drop policy if exists files_client on public.files;
create policy files_sel on public.files for select to authenticated
  using (
    company_id = (select my_company())
    or (client_id in (select my_client_ids()) and (shared_with_client or kind = 'photo'))
    or (kind = 'vault' and shared_with_client
        and company_id in (select clients.company_id from public.clients where clients.user_id = (select auth.uid())))
  );
create policy files_ins on public.files for insert to authenticated
  with check (
    company_id = (select my_company())
    or (client_id in (select my_client_ids())
        and company_id in (select clients.company_id from public.clients where clients.user_id = (select auth.uid())))
  );
create policy files_upd on public.files for update to authenticated
  using (company_id = (select my_company())) with check (company_id = (select my_company()));
create policy files_del on public.files for delete to authenticated
  using (company_id = (select my_company()));

-- Paiements -----------------------------------------------------------------------------------------------------
drop policy if exists payments_company on public.payments;
drop policy if exists payments_client on public.payments;
create policy payments_sel on public.payments for select to authenticated
  using (
    company_id = (select my_company())
    or document_id in (select d.id from public.documents d where d.client_id in (select my_client_ids()))
  );
create policy payments_ins on public.payments for insert to authenticated
  with check (company_id = (select my_company())
    and document_id in (select d.id from public.documents d where d.company_id = (select my_company())));
create policy payments_upd on public.payments for update to authenticated
  using (company_id = (select my_company()))
  with check (company_id = (select my_company())
    and document_id in (select d.id from public.documents d where d.company_id = (select my_company())));
create policy payments_del on public.payments for delete to authenticated
  using (company_id = (select my_company()));

-- Profils -------------------------------------------------------------------------------------------------------
drop policy if exists profiles_upd_gerant on public.profiles;
drop policy if exists profiles_upd_self on public.profiles;
create policy profiles_upd on public.profiles for update to authenticated
  using (
    id = (select auth.uid())
    or (company_id = (select my_company()) and (select is_gerant()))
  )
  with check (
    (id = (select auth.uid()) and not (company_id is distinct from (select my_company())))
    or ((company_id is null or company_id = (select my_company())) and id <> (select auth.uid()))
  );

-- Chantiers -----------------------------------------------------------------------------------------------------
drop policy if exists projects_company on public.projects;
drop policy if exists projects_client on public.projects;
drop policy if exists projects_shared on public.projects;
create policy projects_sel on public.projects for select to authenticated
  using (company_id = (select my_company()) or client_id in (select my_client_ids()) or id in (select shared_project_ids()));
create policy projects_ins on public.projects for insert to authenticated
  with check (company_id = (select my_company()));
create policy projects_upd on public.projects for update to authenticated
  using (company_id = (select my_company())) with check (company_id = (select my_company()));
create policy projects_del on public.projects for delete to authenticated
  using (company_id = (select my_company()));

-- Avis ----------------------------------------------------------------------------------------------------------
drop policy if exists reviews_admin_sel on public.reviews;
drop policy if exists reviews_sel on public.reviews;
create policy reviews_sel on public.reviews for select to authenticated
  using ((select is_admin()) or status = 'publie' or company_id = (select my_company()) or author_id = (select auth.uid()));
drop policy if exists reviews_admin_upd on public.reviews;
drop policy if exists reviews_reply on public.reviews;
create policy reviews_upd on public.reviews for update to authenticated
  using ((select is_admin()) or company_id = (select my_company()))
  with check ((select is_admin()) or company_id = (select my_company()));
