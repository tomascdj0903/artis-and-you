-- Signature électronique du devis par le client (nom, image de signature, horodatage, empreinte du devis)
create or replace function public.client_quote_sign(p_id uuid, p_name text, p_image text default '', p_agent text default '')
returns void language plpgsql security definer set search_path = public as $$
declare d public.documents; h text;
begin
  select * into d from public.documents where id = p_id and kind = 'devis' and number is not null and client_id in (select public.my_client_ids());
  if d is null then raise exception 'Devis introuvable'; end if;
  if d.status <> 'envoye' then raise exception 'Ce devis ne peut plus être signé.'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'Indiquez votre nom.'; end if;
  h := encode(extensions.digest(coalesce(d.number,'') || d.lines::text || d.totals::text, 'sha256'), 'hex');
  update public.documents set status = 'accepte', accepted_at = now(), signed_name = trim(p_name),
    conditions = coalesce(conditions,'{}'::jsonb) || jsonb_build_object('signature', jsonb_build_object(
      'image', left(coalesce(p_image,''), 200000), 'at', now(), 'by', auth.uid(), 'hash', h, 'agent', left(coalesce(p_agent,''), 300), 'mention', 'Bon pour accord'))
  where id = p_id;
  perform public.notify_company(d.company_id, 'documents', 'Devis signé', d.number || ' · ' || trim(p_name), '/pro/documents/' || p_id);
end $$;
revoke execute on function public.client_quote_sign(uuid, text, text, text) from public, anon;
grant execute on function public.client_quote_sign(uuid, text, text, text) to authenticated;
