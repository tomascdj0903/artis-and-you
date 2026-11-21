-- 0037 · Offres complémentaires (Admin › Offres et tarifs › Compléments)
-- Liste [{ id, label, unit ('forfait' | 'mois'), price, desc, active }] ; vide (null) = offres par défaut de l'application.
alter table public.platform_settings add column if not exists extras jsonb;
