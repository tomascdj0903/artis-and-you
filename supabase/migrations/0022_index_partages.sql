-- Index manquant signalé par l'analyseur Supabase : clé étrangère project_shares.invited_by sans index
-- (évite un parcours complet de la table quand une entreprise est supprimée ou archivée).
create index if not exists ix_project_shares_invited_by on public.project_shares(invited_by);

-- Non retenu, volontairement : retirer l'accès direct (EXECUTE) aux fonctions internes my_company(), is_gerant(),
-- my_client_ids()… Les règles d'accès (RLS) les appellent avec les droits de l'utilisateur connecté : les lui retirer
-- casserait toutes les lectures. Elles ne renvoient que des informations sur l'appelant lui-même.
