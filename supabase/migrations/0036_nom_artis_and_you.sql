-- 0036 · Retour au nom « Artis & You »
-- Remplace le texte « Artesa » dans les messages des fonctions (erreurs, notifications, expéditeur du service client)
-- et renomme la fiche de la société plateforme. Les anciens messages et rendez-vous déjà enregistrés ne sont pas modifiés.
do $$
declare r record;
begin
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind = 'f' and p.prosrc like '%Artesa%'
  loop
    execute replace(pg_get_functiondef(r.oid), 'Artesa', 'Artis & You');
  end loop;
end $$;

update public.companies set name = 'Artis & You', trade_name = 'Artis & You'
where is_platform and name = 'Artesa';
