-- (appliquée en prod) Fiche client créée par l'artisan avec l'e-mail d'un compte déjà inscrit (e-mail confirmé) :
-- elle est rattachée tout de suite, et à la connexion pour les fiches plus anciennes.
create or replace function public.attach_client_by_email() returns trigger
language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  if new.user_id is null and coalesce(new.email,'') <> '' then
    select id into u from auth.users where lower(email) = lower(new.email) and email_confirmed_at is not null limit 1;
    if u is not null and not exists (select 1 from public.clients where company_id = new.company_id and user_id = u and id <> new.id)
       and not exists (select 1 from public.companies where id = new.company_id and owner_id = u) then
      new.user_id := u;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists clients_attach_email on public.clients;
create trigger clients_attach_email before insert or update of email on public.clients
  for each row execute function public.attach_client_by_email();

-- Appelée à l'ouverture de l'espace client : rattache les fiches restées sans compte et prévient le client
create or replace function public.link_my_clients() returns int
language plpgsql security definer set search_path = public as $$
declare em text; n int := 0; r record; d int;
begin
  if auth.uid() is null then return 0; end if;
  select email into em from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if em is null then return 0; end if;
  for r in select c.id, c.company_id from public.clients c
           where c.user_id is null and lower(coalesce(c.email,'')) = lower(em)
             and not exists (select 1 from public.clients x where x.company_id = c.company_id and x.user_id = auth.uid())
             and not exists (select 1 from public.companies co where co.id = c.company_id and co.owner_id = auth.uid())
  loop
    update public.clients set user_id = auth.uid() where id = r.id;
    select count(*) into d from public.documents where client_id = r.id and number is not null;
    if d > 0 then
      insert into public.notifications(user_id, category, title, body, link)
      select auth.uid(), 'documents', 'Nouveaux documents', coalesce(co.trade_name, co.name) || ' a partagé ' || d || ' document(s) avec vous', '/client/documents'
      from public.companies co where co.id = r.company_id;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.link_my_clients() from public, anon;
grant execute on function public.link_my_clients() to authenticated;
