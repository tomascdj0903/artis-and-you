-- 1) Abonnements push : seuls les services de notification officiels (évite que le serveur appelle une URL arbitraire)
alter table public.push_subscriptions drop constraint if exists push_endpoint_officiel;
alter table public.push_subscriptions add constraint push_endpoint_officiel check (
  endpoint ~ '^https://(fcm\.googleapis\.com|web\.push\.apple\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com|android\.googleapis\.com)/');

-- 2) Codes d'invitation d'équipe (6 caractères) : 10 essais ratés par heure et par compte, contre la force brute
create table if not exists private.invite_attempts (user_id uuid not null, at timestamptz not null default now());
create index if not exists invite_attempts_user on private.invite_attempts(user_id, at);
create or replace function public.join_company(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare i public.company_invites;
begin
  if (select count(*) from private.invite_attempts where user_id = auth.uid() and at > now() - interval '1 hour') >= 10 then
    raise exception 'Trop d''essais. Réessayez dans une heure.';
  end if;
  perform set_config('ay.trusted','1',true);
  select * into i from public.company_invites where code = upper(p_code) and used_by is null;
  if i is null then
    -- pas d'exception ici : elle annulerait l'enregistrement de l'essai raté ; l'appli affiche l'erreur si null
    insert into private.invite_attempts(user_id) values (auth.uid());
    return null;
  end if;
  update public.profiles set kind='artisan', company_id=i.company_id, member_role=i.member_role, team_id=i.team_id,
    permissions = case i.member_role
      when 'ouvrier' then '{"planning":true,"clients":false,"devis":false,"prix":false,"kpi":false}'::jsonb
      when 'chef' then '{"planning":true,"clients":true,"devis":true,"prix":true,"kpi":false}'::jsonb
      else '{"planning":true,"clients":true,"devis":true,"prix":true,"kpi":true}'::jsonb end
  where id = auth.uid();
  update public.company_invites set used_by = auth.uid() where code = i.code;
  return i.company_id;
end $$;
