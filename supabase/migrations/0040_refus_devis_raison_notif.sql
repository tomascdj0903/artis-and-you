-- (appliquée en prod) Refus d'un devis par le client : la notification de l'artisan donne le nom du client et la raison
CREATE OR REPLACE FUNCTION public.client_quote_action(p_id uuid, p_action text, p_reason text DEFAULT ''::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare d public.documents; who text;
begin
  select * into d from public.documents where id=p_id and kind='devis' and client_id in (select public.my_client_ids()) and number is not null;
  if d is null then raise exception 'Devis introuvable'; end if;
  if p_action = 'refuse' then
    update public.documents set status='refuse', refused_at=now(), conditions = coalesce(conditions,'{}'::jsonb) || jsonb_build_object('refusal_reason', left(coalesce(p_reason,''),500)) where id=p_id;
    select trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')) into who from public.clients where id = d.client_id;
    perform public.notify_company(d.company_id,'documents','Devis refusé',
      d.number || coalesce(' · ' || nullif(who,''), '') || coalesce(' · « ' || nullif(left(trim(p_reason),80),'') || ' »', ''), '/pro/documents/'||p_id);
  end if;
end $function$;
