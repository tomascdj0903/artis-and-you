-- Avis vérifié : après un vrai rendez-vous passé OU une facture payée / un devis signé chez ce pro
-- (le bouton « Donner mon avis » s'affiche aussi sur une facture payée)
create or replace function public.post_review(p_company uuid, p_rating integer, p_comment text)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare a uuid; ok boolean; prof public.profiles;
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'Choisissez une note de 1 à 5.'; end if;
  if exists(select 1 from public.reviews where company_id = p_company and author_id = auth.uid()) then raise exception 'Vous avez déjà donné votre avis sur ce pro.'; end if;
  select ap.id into a from public.appointments ap
   where ap.company_id = p_company and ap.client_id in (select public.my_client_ids())
     and ap.status in ('valide','termine') and ap.start_at < now()
   order by ap.start_at desc limit 1;
  ok := a is not null or exists (select 1 from public.documents d
     where d.company_id = p_company and d.client_id in (select public.my_client_ids())
       and ((d.kind in ('facture','acompte') and d.status in ('payee','partielle')) or (d.kind = 'devis' and d.status = 'accepte')));
  if not ok then raise exception 'Un avis ne peut être donné qu''après un vrai rendez-vous ou une facture réglée.'; end if;
  select * into prof from public.profiles where id = auth.uid();
  insert into public.reviews(company_id, author_id, author_label, appointment_id, rating, comment)
  values (p_company, auth.uid(), prof.first_name || ' ' || left(prof.last_name,1) || '.', a, p_rating, left(coalesce(p_comment,''), 2000));
  perform public.notify_company(p_company,'systeme','Nouvel avis client', p_rating||'/5', '/pro/compte/avis');
end $function$;
