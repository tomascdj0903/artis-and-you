// Affichage des vérifications officielles : qualifications RGE (ADEME) et numéro de TVA (VIES)
import { useEffect, useState } from 'react';
import { LuBadgeCheck, LuLeaf, LuExternalLink, LuShieldCheck, LuTriangleAlert, LuWand } from 'react-icons/lu';
import { rgeLookup, checkVat, frVatFromSiren, vatFormat } from '../lib/checks.js';
import { t } from '../lib/i18n.js';
import { date } from '../lib/format.js';

const ADEME_PAGE = 'https://france-renov.gouv.fr/annuaire-rge';

export function useRge(siren) {
  const [r, setR] = useState(null);
  useEffect(() => { let on = true; setR(null); if (String(siren || '').replace(/\D/g, '').length >= 9) rgeLookup(siren).then((x) => on && setR(x)); else setR({ ok: true, list: [] }); return () => { on = false; }; }, [siren]);
  return r;
}

// Fiche artisan vue par un particulier : badge seulement si une qualification en cours est trouvée
export function RgeBadge({ siren }) {
  const r = useRge(siren);
  if (!r?.ok || !r.list.length) return null;
  const domaines = [...new Set(r.list.map((x) => x.domaine))];
  return (
    <div className="card soft mb">
      <div className="row" style={{ gap: 8 }}><LuLeaf className="green-t" /><b>{t('Artisan RGE')}</b><span className="small muted">· {t('vérifié sur la liste officielle de l’ADEME')}</span></div>
      <div className="chips wrap mt" style={{ gap: 6 }}>{domaines.slice(0, 8).map((d) => <span key={d} className="chip" style={{ padding: '4px 10px', fontSize: 13 }}>{d}</span>)}{domaines.length > 8 && <span className="small muted">+{domaines.length - 8}</span>}</div>
      <p className="small muted" style={{ margin: '8px 0 0' }}>{t('Avec un artisan RGE, ces travaux peuvent ouvrir droit aux aides de l’État (MaPrimeRénov’, CEE, éco-prêt à taux zéro).')}</p>
    </div>
  );
}

// Compte de l'artisan : ses qualifications RGE trouvées à partir du SIREN
export function RgeCard({ siren }) {
  const r = useRge(siren);
  return (
    <div className="card soft">
      <div className="row" style={{ gap: 8 }}><LuLeaf /><b>{t('Qualifications RGE')}</b><span className="small muted">· {t('liste officielle de l’ADEME')}</span></div>
      {!r ? <p className="small muted">{t('Vérification…')}</p>
        : !r.ok ? <p className="small muted">{t('La liste de l’ADEME ne répond pas pour le moment. Réessayez plus tard.')}</p>
        : !r.list.length ? <p className="small muted" style={{ marginBottom: 0 }}>{t('Aucune qualification RGE en cours trouvée pour votre SIREN. Si vous êtes RGE, la liste de l’ADEME peut avoir quelques semaines de retard. Le badge « Artisan RGE » apparaîtra automatiquement sur votre fiche.')}</p>
        : <>
          <p className="small" style={{ margin: '6px 0' }}>{t('Le badge « Artisan RGE » est affiché sur votre fiche publique.')}</p>
          <ul className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
            {r.list.map((q, i) => <li key={i}><b>{q.domaine}</b> — {q.qualification} ({q.organisme}){q.fin ? ' · ' + t('jusqu’au {d}', { d: date(q.fin) }) : ''}{q.url && <> · <a href={q.url} target="_blank" rel="noopener noreferrer">{t('attestation')} <LuExternalLink size={11} /></a></>}</li>)}
          </ul>
        </>}
      <a className="small faint" href={ADEME_PAGE} target="_blank" rel="noopener noreferrer">{t('Annuaire officiel France Rénov’')} <LuExternalLink size={11} /></a>
    </div>
  );
}

const REASONS = { empty: 'Numéro vide', country: 'Code pays inconnu (les 2 premières lettres)', format: 'Format incorrect pour ce pays', key: 'La clé (2 chiffres après FR) ne correspond pas au SIREN', siren: 'Ce numéro ne correspond pas au SIREN indiqué' };

// Sous un champ « N° TVA » : calcul depuis le SIREN et vérification VIES
export function VatCheck({ value, siren, onFill }) {
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setRes(null), [value]);
  const guess = frVatFromSiren(siren);
  const run = async () => { setBusy(true); setRes(await checkVat(value, siren)); setBusy(false); };
  const local = value ? vatFormat(value, siren) : null;
  return (
    <div className="small" style={{ margin: '-4px 0 10px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
      {!value && guess && onFill && <button type="button" className="link small" onClick={() => onFill(guess)}><LuWand size={13} /> {t('Calculer depuis le SIREN : {v}', { v: guess })}</button>}
      {value && local && !local.ok && <span className="red-t"><LuTriangleAlert size={13} /> {t(REASONS[local.reason] || 'Numéro incorrect')}{local.reason === 'key' && guess && onFill ? <> · <button type="button" className="link small" onClick={() => onFill(guess)}>{t('Corriger en {v}', { v: guess })}</button></> : ''}</span>}
      {value && local?.ok && !res && <button type="button" className="link small" disabled={busy} onClick={run}><LuShieldCheck size={13} /> {busy ? t('Vérification…') : t('Vérifier auprès de l’Union européenne (VIES)')}</button>}
      {res?.status === 'valid' && <span className="green-t"><LuBadgeCheck size={13} /> {t('Numéro valide')}{res.name ? ' · ' + res.name : ''}</span>}
      {res?.status === 'invalid' && <span className="red-t"><LuTriangleAlert size={13} /> {t('Numéro inconnu du registre européen : vérifiez-le avec votre client.')}</span>}
      {res?.status === 'unchecked' && <span className="muted">{t('Format correct. Le registre européen ne répond pas pour le moment, réessayez plus tard.')}</span>}
    </div>
  );
}
