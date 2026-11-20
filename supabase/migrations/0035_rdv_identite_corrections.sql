-- 0035 · Corrections RDV et identité (Notion n° 25, 26, 27, 28)
--  - n° 25 : une demande de RDV ne déclenche plus qu'une notification chez l'artisan (« Nouvelle demande de RDV »),
--    plus la notification « message » en double due à la carte déposée dans la conversation.
--  - n° 26 : l'aperçu de la conversation affiche « Demande de RDV · <nom du particulier> » (et non « Demande de RDV envoyée »).
--  - n° 27 : quand l'artisan change le créneau d'une DEMANDE de RDV (pas d'un RDV déjà validé), le nouveau créneau
--    est proposé au particulier, qui l'accepte ou le refuse ; le RDV n'est plus changé sans son accord.
--  - n° 28 : une pièce d'identité ne peut pas être validée si un motif de refus a été indiqué.
-- Migration additive : aucune donnée existante n'est modifiée ni supprimée.

create or replace function public.on_message() returns trigger language plpgsql security definer set search_path = public as $$
declare c public.conversations; txt text; att text; from_co uuid; target_co uuid; lnk text; who text;
begin
  att := case when exists (select 1 from jsonb_array_elements(coalesce(new.attachments,'[]'::jsonb)) a where a->>'kind' = 'voice' or a->>'mime' like 'audio/%') then '🎤 Message vocal' when exists (select 1 from jsonb_array_elements(coalesce(new.attachments,'[]'::jsonb)) a where a->>'mime' like 'image/%') then '📷 Photo' else '📎 Pièce jointe' end;
  select * into c from public.conversations where id = new.conversation_id;
  update public.conversations set last_message = left(
      case when new.card->>'type' = 'demande' then '📅 Demande de RDV' || coalesce(' · ' || nullif(new.sender_name,''), '') || coalesce(' · ' || nullif(new.body,''), '')
           when new.card->>'type' = 'rdv_proposal' then '📅 ' || (new.card->>'title') || ' · ' || (new.card->>'sub')
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
  if c.client_user_id is not null and c.client_user_id is distinct from new.sender_id and coalesce(new.card->>'type','') not in ('rdv_change','rdv_proposal','demande') then
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
  if target_co is not null and coalesce(new.card->>'type','') not in ('rdv_change','rdv_proposal','demande') then
    lnk := '/pro/messages/' || c.id;
    insert into public.notifications(user_id, category, title, body, link)
    select p.id, 'message', who, txt, lnk from public.profiles p
    where p.company_id = target_co and p.id is distinct from new.sender_id
      and (c.kind <> 'team' or c.team_id is null or p.team_id = c.team_id or p.member_role = 'gerant');
  end if;
  return new;
end $$;

-- Les cartes de RDV ne peuvent être créées que par la base (pas envoyées telles quelles par l'application)
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
    if new.card is not null and new.card->>'type' in ('project_invite','rdv_change','rdv_proposal','demande') then new.card := null; end if;
  end if;
  return new;
end $$;

-- ───────── n° 27 : nouveau créneau proposé pour une demande de RDV ─────────
alter table public.appointments add column if not exists proposed_start_at timestamptz;
alter table public.appointments add column if not exists proposed_end_at timestamptz;
alter table public.appointments add column if not exists proposed_at timestamptz;

-- Avant toute mise à jour d'une demande (statut « à valider », envoyée par un particulier) par quelqu'un d'autre
-- que ce particulier : si le créneau change, il devient une proposition et le RDV garde son créneau d'origine.
create or replace function public.appointment_propose_slot() returns trigger
language plpgsql security definer set search_path = public as $$
declare conv uuid; nm text; co public.companies;
begin
  if old.status <> 'a_valider' or old.requested_by is null or auth.uid() is null or auth.uid() = old.requested_by then return new; end if;
  if new.start_at is not distinct from old.start_at and new.end_at is not distinct from old.end_at then return new; end if;
  new.proposed_start_at := new.start_at; new.proposed_end_at := new.end_at; new.proposed_at := now();
  new.start_at := old.start_at; new.end_at := old.end_at;
  if new.status = 'valide' then new.status := 'a_valider'; new.validated_at := old.validated_at; end if;
  select * into co from public.companies where id = new.company_id;
  select id into conv from public.conversations where kind = 'client' and company_id = new.company_id and client_user_id = old.requested_by limit 1;
  select trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')) into nm from public.profiles where id = auth.uid();
  if conv is not null then
    insert into public.messages(conversation_id, sender_id, sender_name, sender_company_id, body, card)
    values (conv, auth.uid(), coalesce(nullif(nm,''), co.name), new.company_id,
      'Nouveau créneau proposé pour « ' || coalesce(new.title,'') || ' » : le ' || to_char(new.proposed_start_at at time zone 'Europe/Paris','DD/MM à HH24:MI') || '. Merci de l''accepter ou de le refuser.',
      jsonb_build_object('type','rdv_proposal','title','Nouveau créneau proposé','sub', to_char(new.proposed_start_at at time zone 'Europe/Paris','DD/MM HH24:MI') || '–' || to_char(new.proposed_end_at at time zone 'Europe/Paris','HH24:MI'), 'appointment_id', new.id));
  end if;
  insert into public.notifications(user_id, category, title, body, link)
  values (old.requested_by, 'rdv', 'Nouveau créneau proposé',
    coalesce(nullif(co.trade_name,''), co.name) || ' · ' || coalesce(new.title,'') || ' · ' || to_char(new.proposed_start_at at time zone 'Europe/Paris','DD/MM HH24:MI') || ' · à accepter ou refuser', '/client/rdv/' || new.id);
  return new;
end $$;
revoke execute on function public.appointment_propose_slot() from public, anon, authenticated;
drop trigger if exists appointments_a_proposal on public.appointments;
create trigger appointments_a_proposal before update on public.appointments for each row execute function public.appointment_propose_slot();

-- Réponse du particulier à la proposition
create or replace function public.appointment_proposal_answer(p_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare a public.appointments; nm text;
begin
  select * into a from public.appointments where id = p_id;
  if a.id is null or a.requested_by is distinct from auth.uid() then raise exception 'Rendez-vous introuvable'; end if;
  if a.proposed_start_at is null or a.status <> 'a_valider' then raise exception 'Aucun nouveau créneau à confirmer'; end if;
  select trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')) into nm from public.profiles where id = auth.uid();
  if p_accept then
    update public.appointments set start_at = a.proposed_start_at, end_at = a.proposed_end_at, status = 'valide', validated_at = now(),
      proposed_start_at = null, proposed_end_at = null, proposed_at = null where id = p_id;
  else
    update public.appointments set proposed_start_at = null, proposed_end_at = null, proposed_at = null where id = p_id;
  end if;
  perform public.notify_company(a.company_id, 'rdv',
    case when p_accept then 'Nouveau créneau accepté' else 'Nouveau créneau refusé' end,
    coalesce(nullif(nm,''), 'Le client') || ' · ' || coalesce(a.title,'') || ' · ' || to_char(a.proposed_start_at at time zone 'Europe/Paris','DD/MM HH24:MI')
      || case when p_accept then ' · RDV confirmé' else ' · la demande reste à traiter' end, '/pro/planning/rdv/' || p_id);
end $$;
revoke execute on function public.appointment_proposal_answer(uuid, boolean) from public, anon;
grant execute on function public.appointment_proposal_answer(uuid, boolean) to authenticated;

-- ───────── n° 28 : pas de validation d'une pièce avec un motif de refus ─────────
create or replace function public.admin_identity_review(p_id uuid, p_status text, p_note text default '')
returns text language plpgsql security definer set search_path = public as $$
declare r public.identity_checks;
begin
  if not public.is_admin() then raise exception 'Réservé à l''équipe Artesa'; end if;
  if p_status not in ('verifie','refuse') then raise exception 'Décision inconnue'; end if;
  if p_status = 'refuse' and coalesce(trim(p_note),'') = '' then raise exception 'Indiquez le motif du refus.'; end if;
  if p_status = 'verifie' and coalesce(trim(p_note),'') <> '' then raise exception 'Un motif de refus est indiqué : cliquez sur « Refuser », ou effacez le motif pour valider.'; end if;
  update public.identity_checks set status = p_status, note = coalesce(trim(p_note),''), reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_id and status = 'en_attente' returning * into r;
  if r.id is null then raise exception 'Demande déjà traitée'; end if;
  insert into public.notifications(user_id, category, title, body, link)
  values (r.user_id, 'systeme',
    case when p_status = 'verifie' then 'Identité vérifiée' else 'Pièce d''identité refusée' end,
    case when p_status = 'verifie' then 'Votre identité est vérifiée. La copie de votre pièce a été supprimée.'
         else 'Motif : ' || trim(p_note) || '. La copie a été supprimée ; vous pouvez en envoyer une nouvelle.' end,
    case when r.purpose = 'dirigeant' then '/pro/compte/entreprise' else '/client/compte' end);
  return r.file_path;
end $$;
revoke execute on function public.admin_identity_review(uuid, text, text) from public, anon;
grant execute on function public.admin_identity_review(uuid, text, text) to authenticated;
