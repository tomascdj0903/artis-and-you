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
