-- Invitation des clients par leur artisan : à l'inscription, la fiche client existante (même e-mail) est rattachée au compte
alter table public.clients add column if not exists invited_at timestamptz;

create or replace function public.ensure_client(p_company uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid; p public.profiles; n int;
begin
  select id into cid from public.clients where company_id = p_company and user_id = auth.uid();
  if cid is not null then return cid; end if;
  select * into p from public.profiles where id = auth.uid();
  -- fiche déjà créée par l'artisan avec la même adresse e-mail (vérifiée à l'inscription) : on la rattache
  select id into cid from public.clients where company_id = p_company and user_id is null and coalesce(email,'') <> '' and lower(email) = lower(p.email) order by created_at limit 1;
  if cid is not null then update public.clients set user_id = auth.uid() where id = cid; return cid; end if;
  select count(*)+1 into n from public.clients where company_id = p_company;
  insert into public.clients(company_id, user_id, type, last_name, first_name, email, mobile, number,
     billing_address, billing_zip, billing_city, site_address, site_zip, site_city)
  values (p_company, auth.uid(), 'particulier', p.last_name, p.first_name, p.email, p.phone, 'CL-'||lpad(n::text,5,'0'),
     coalesce(p.home->>'address',''), coalesce(p.home->>'zip',''), coalesce(p.home->>'city',''),
     coalesce(p.home->>'address',''), coalesce(p.home->>'zip',''), coalesce(p.home->>'city',''))
  returning id into cid;
  return cid;
end $$;
