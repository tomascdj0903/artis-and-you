-- Performance : index sur toutes les clés étrangères, auth.uid() évalué une seule fois, règles réservées aux connectés
do $$ declare r record; begin
  for r in
    select c.conrelid::regclass as tbl, c.conname, a.attname
    from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
    where c.contype='f' and c.connamespace='public'::regnamespace and array_length(c.conkey,1)=1
      and not exists (select 1 from pg_index i where i.indrelid=c.conrelid and i.indkey[0]=c.conkey[1])
  loop
    execute format('create index if not exists %I on %s(%I)', 'ix_'||left(r.conname,58), r.tbl, r.attname);
  end loop;
end $$;
drop index if exists public.messages_conversation_id_created_at_idx;
create index if not exists ix_messages_conv_created on public.messages(conversation_id, created_at);

-- auth.uid() -> (select auth.uid()) et toutes les règles « to authenticated »
do $$ declare p record; q text; w text; begin
  for p in select * from pg_policies where schemaname='public' loop
    q := replace(coalesce(p.qual,''), 'auth.uid()', '(select auth.uid())');
    w := replace(coalesce(p.with_check,''), 'auth.uid()', '(select auth.uid())');
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    execute format('create policy %I on %I.%I as permissive for %s to authenticated %s %s',
      p.policyname, p.schemaname, p.tablename, p.cmd,
      case when q<>'' then 'using ('||q||')' else '' end,
      case when w<>'' then 'with check ('||w||')' else '' end);
  end loop;
end $$;
-- teams : la règle « for all » couvre déjà la lecture
drop policy if exists teams_sel on public.teams;
