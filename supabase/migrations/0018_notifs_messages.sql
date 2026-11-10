-- Notifications (et donc push) pour TOUS les messages reçus :
-- avant, seul le particulier était prévenu ; le pro ne recevait rien (messages de clients, d'autres pros, de son équipe).
create or replace function public.on_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.conversations; txt text; from_co uuid; target_co uuid; lnk text; who text;
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
  txt := left(coalesce(nullif(new.body,''), new.card->>'title', '📎 Pièce jointe'), 90);
  who := coalesce(nullif(new.sender_name,''), 'Nouveau message');
  from_co := new.sender_company_id;

  -- 1) Le particulier (conversation client) quand c'est le pro qui écrit
  if c.client_user_id is not null and c.client_user_id is distinct from new.sender_id and coalesce(new.card->>'type','') <> 'rdv_change' then
    insert into public.notifications(user_id, category, title, body, link)
    values (c.client_user_id, 'message', who, txt, '/client/messages/' || c.id);
  end if;

  -- 2) Les pros destinataires : l'entreprise qui n'a pas envoyé le message
  if c.kind = 'pro' then
    target_co := case when from_co = c.company_id then c.other_company_id else c.company_id end;
  elsif from_co is distinct from c.company_id then
    target_co := c.company_id;               -- message d'un client vers le pro
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
