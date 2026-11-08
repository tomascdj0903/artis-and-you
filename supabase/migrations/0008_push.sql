create extension if not exists pg_net with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.config (key text primary key, value text not null);
insert into private.config values ('vapid_public','<à générer>'),('vapid_private','<à générer>'),('push_secret','<à générer>'),('push_url','https://jkecsanrqktnrsibyiod.supabase.co/functions/v1/push')
  on conflict (key) do update set value = excluded.value;
create table if not exists public.push_subscriptions (
  endpoint text primary key, user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null, auth text not null, created_at timestamptz default now());
create index if not exists ix_push_user on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
create policy push_self on public.push_subscriptions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create or replace function public.on_notification_push() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if exists(select 1 from public.push_subscriptions where user_id = new.user_id) then
    perform net.http_post(url := (select value from private.config where key='push_url'),
      body := jsonb_build_object('id', new.id),
      headers := jsonb_build_object('Content-Type','application/json','x-push-secret',(select value from private.config where key='push_secret')));
  end if;
  return new;
end $$;
revoke execute on function public.on_notification_push() from public, anon, authenticated;
drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push after insert on public.notifications for each row execute function public.on_notification_push();
create or replace function private.push_config() returns jsonb language sql security definer set search_path = private as $$ select jsonb_object_agg(key, value) from private.config $$;
drop function if exists private.push_config();
create or replace function public.push_payload(p_id uuid) returns jsonb
language sql stable security definer set search_path = public, private as $$
  select jsonb_build_object(
    'secret', (select value from private.config where key='push_secret'),
    'vapid_public', (select value from private.config where key='vapid_public'),
    'vapid_private', (select value from private.config where key='vapid_private'),
    'n', (select to_jsonb(n) from public.notifications n where n.id = p_id),
    'subs', coalesce((select jsonb_agg(to_jsonb(s)) from public.push_subscriptions s where s.user_id = (select user_id from public.notifications where id = p_id)), '[]'::jsonb))
$$;
revoke execute on function public.push_payload(uuid) from public, anon, authenticated;
grant execute on function public.push_payload(uuid) to service_role;
create or replace function public.vapid_public_key() returns text language sql stable security definer set search_path = private as $$ select value from private.config where key='vapid_public' $$;
revoke execute on function public.vapid_public_key() from public, anon;
grant execute on function public.vapid_public_key() to authenticated;
