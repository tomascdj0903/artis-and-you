-- Sécurité : fonctions internes non appelables depuis l'API, rien pour les visiteurs non connectés
alter function public.protect_documents() set search_path = public;
do $$ declare r record; begin
  for r in select p.oid::regprocedure as f, p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef loop
    execute format('revoke execute on function %s from public, anon', r.f);
    if r.proname in ('notify_company','handle_new_user','on_appointment','on_document','on_message','protect_company_verification','protect_profile','sync_paid') then
      execute format('revoke execute on function %s from authenticated', r.f);
    else
      execute format('grant execute on function %s to authenticated', r.f);
    end if;
  end loop;
end $$;
