-- 0026 : correctif de 0025. En Postgres, la fin de mot s'écrit \y (et non \b comme en JavaScript) :
-- sans ce correctif, « Plombiers » et « Plombier » n'étaient pas reconnus comme le même métier.
create or replace function private.trade_norm(s text) returns text language sql immutable as $$
  select trim(regexp_replace(regexp_replace(regexp_replace(
    translate(lower(coalesce(s, '')), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœæ', 'aaaaaaceeeeiiiinooooouuuuyyoa'),
    '[^a-z0-9]+', ' ', 'g'),
    '([a-z]{3,})(s|x)\y', '\1', 'g'),
    '\s+', ' ', 'g'))
$$;
-- Recalcule les formes normalisées déjà enregistrées (aucun doublon possible parmi les métiers de base)
update public.trades set norm = private.trade_norm(name) where norm is distinct from private.trade_norm(name);
