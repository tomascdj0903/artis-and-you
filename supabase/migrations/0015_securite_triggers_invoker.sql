-- Les triggers de protection doivent voir le rôle de l'appelant : SECURITY INVOKER
alter function public.protect_company_fields() security invoker;
alter function public.protect_review() security invoker;
alter function public.protect_message() security invoker;
alter function public.protect_conversation() security invoker;
