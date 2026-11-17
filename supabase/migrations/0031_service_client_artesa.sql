-- 0031 · Service client Artesa
--  - L'équipe peut écrire à un particulier (en plus des pros).
--  - Un pro est bien notifié quand Artesa lui écrit (avant, seul le sens pro → Artesa notifiait).
--  - Les messages de l'équipe sont signés « Artesa », jamais d'un prénom.
-- Aucune donnée existante n'est modifiée.

create or replace function public.admin_support_start_user(p_user uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare conv uuid; plat uuid := public.my_company();
begin
  if not public.is_admin() or not exists (select 1 from public.companies where id = plat and is_platform) then raise exception 'Réservé à l''équipe Artesa.'; end if;
  if not exists (select 1 from public.profiles where id = p_user and kind = 'particulier') then raise exception 'Compte introuvable.'; end if;
  select id into conv from public.conversations where kind = 'support' and company_id = plat and client_user_id = p_user;
  if conv is null then insert into public.conversations(kind, company_id, client_user_id, last_message) values ('support', plat, p_user, '') returning id into conv; end if;
  return conv;
end $$;
revoke execute on function public.admin_support_start_user(uuid) from public, anon;
grant execute on function public.admin_support_start_user(uuid) to authenticated;

-- Signature « Artesa » imposée côté serveur pour les messages de l'entreprise interne
create or replace function public.protect_message() returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated','anon') then
    new.sender_id := auth.uid();
    new.sender_company_id := public.my_company();
    new.sender_name := left(coalesce(new.sender_name,''), 120);
    if new.sender_company_id is not null and exists (select 1 from public.companies where id = new.sender_company_id and is_platform) then
      new.sender_name := 'Artesa';
    end if;
    new.created_at := now();
    if new.card is not null and new.card->>'type' in ('project_invite','rdv_change') then new.card := null; end if;
  end if;
  return new;
end $$;

create or replace function public.on_message() returns trigger language plpgsql security definer set search_path = public as $$
declare c public.conversations; txt text; att text; from_co uuid; target_co uuid; lnk text; who text;
begin
  att := case when exists (select 1 from jsonb_array_elements(coalesce(new.attachments,'[]'::jsonb)) a where a->>'kind' = 'voice' or a->>'mime' like 'audio/%') then '🎤 Message vocal' when exists (select 1 from jsonb_array_elements(coalesce(new.attachments,'[]'::jsonb)) a where a->>'mime' like 'image/%') then '📷 Photo' else '📎 Pièce jointe' end;
  select * into c from public.conversations where id = new.conversation_id;
  update public.conversations set last_message = left(
      case when new.card->>'type' = 'demande' then '📅 ' || (new.card->>'title') || coalesce(' · ' || nullif(new.body,''), '')
           when new.card->>'type' = 'rdv_change' then '📅 ' || (new.card->>'title') || ' · ' || (new.card->>'sub')
           else coalesce(nullif(new.body,''), case when new.card is not null then new.card->>'title' else att end) end, 140),
    last_at = new.created_at where id = c.id;
  if new.sender_id is not null then
    insert into public.conversation_reads(conversation_id, user_id, last_read_at) values (c.id, new.sender_id, new.created_at)
    on conflict (conversation_id, user_id) do update set last_read_at = greatest(public.conversation_reads.last_read_at, excluded.last_read_at);
  end if;
  txt := left(coalesce(nullif(new.body,''), new.card->>'title', att), 90);
  who := coalesce(nullif(new.sender_name,''), 'Nouveau message');
  from_co := new.sender_company_id;

  -- 1) Le particulier quand c'est l'autre côté qui écrit
  if c.client_user_id is not null and c.client_user_id is distinct from new.sender_id and coalesce(new.card->>'type','') <> 'rdv_change' then
    insert into public.notifications(user_id, category, title, body, link)
    values (c.client_user_id, 'message', who, txt, '/client/messages/' || c.id);
  end if;

  -- 2) Les pros destinataires : l'entreprise qui n'a pas envoyé le message
  if c.kind in ('pro','support') and c.other_company_id is not null then
    target_co := case when from_co = c.company_id then c.other_company_id else c.company_id end;
  elsif from_co is distinct from c.company_id then
    target_co := c.company_id;               -- message d'un client (ou d'un particulier au support) vers l'entreprise
  elsif c.kind = 'team' then
    target_co := c.company_id;               -- message d'équipe : les collègues
  end if;
  if target_co is not null and coalesce(new.card->>'type','') <> 'rdv_change' then
    lnk := '/pro/messages/' || c.id;
    insert into public.notifications(user_id, category, title, body, link)
    select p.id, 'message', who, txt, lnk from public.profiles p
    where p.company_id = target_co and p.id is distinct from new.sender_id
      and (c.kind <> 'team' or c.team_id is null or p.team_id = c.team_id or p.member_role = 'gerant');
  end if;
  return new;
end $$;
