-- Compteur de questions posées à l'assistant IA (quota quotidien par utilisateur), accessible au serveur seulement
create table if not exists public.assistant_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);
alter table public.assistant_usage enable row level security;
