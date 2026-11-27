-- Jetons des intégrations serveur à serveur (ex. n8n → page Prospects de l'admin).
-- On ne stocke que l'empreinte SHA-256 du jeton : le jeton lui-même reste dans l'outil qui appelle (n8n).
-- Aucune politique RLS : la table n'est lisible que par les Edge Functions (clé serveur), jamais depuis l'appli.
create table if not exists public.integration_tokens (
  name text primary key,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz default now()
);
alter table public.integration_tokens enable row level security;
revoke all on public.integration_tokens from anon, authenticated;
