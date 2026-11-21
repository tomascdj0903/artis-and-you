// Demande de devis pour une formule « sur devis » (Entreprise…), ouverte à tous, connecté ou non.
// L'entreprise décrit son équipe et ses besoins ; la demande arrive dans l'espace admin (tuile « Demandes de devis »)
// et l'équipe Artis & You reçoit une notification pour préparer le devis.
import { useState } from 'react';
import { LuArrowLeft, LuCheck, LuSend } from 'react-icons/lu';
import { api } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { navigate, Link } from '../../lib/router.jsx';
import { t } from '../../lib/i18n.js';
import { usePlatform } from '../../lib/platform.js';
import { Field, Wordmark } from '../../ui/index.jsx';

const TEAM = ['6 à 10 personnes', '11 à 20 personnes', '21 à 50 personnes', 'Plus de 50 personnes'];
const SITES = ['Moins de 10', '10 à 30', '30 à 100', 'Plus de 100'];
const START = ['Dès que possible', 'Dans le mois', 'Dans les 3 mois', 'Je me renseigne'];

export function QuoteRequest() {
  const { profile, company } = useApp() || {};
  const { plans, extras } = usePlatform();
  // Ce qu'on peut proposer en plus des formules (réglé dans Admin › Offres et tarifs › Compléments) : l'entreprise coche ce qui l'intéresse
  const EXTRAS = (extras || []).filter((x) => x.active !== false && String(x.label || '').trim());
  const planId = new URLSearchParams(location.search).get('formule') || 'entreprise';
  const plan = plans.find((p) => p.id === planId) || plans.find((p) => p.quote) || plans[plans.length - 1];
  // Toutes les fonctions proposées dans les formules (sans les lignes « Tout Solo », « Tout Équipe »)
  const features = [...new Set(plans.flatMap((p) => p.features || []).filter((f) => !/^Tout /.test(f)))];
  const co = company?.is_platform ? null : company; // l'équipe Artis & You qui teste la page : rien de pré-rempli
  const [f, setF] = useState({
    company_name: co?.name || '', siret: co?.siret || '', trades: (co?.trades || []).join(', '), city: co?.city || '',
    team_size: TEAM[0], users_needed: '', sites_per_month: SITES[1], options: [], current_tools: '', start_when: START[0], message: '',
    contact_name: co ? [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') : '', email: co ? profile?.email || '' : '', phone: co ? profile?.phone || '' : '', consent: false,
  });
  const [state, setState] = useState('');
  const [err, setErr] = useState('');
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const toggle = (o) => set('options', f.options.includes(o) ? f.options.filter((x) => x !== o) : [...f.options, o]);
  const send = async (e) => {
    e.preventDefault(); setErr('');
    // On relit aussi les champs dans la page : un remplissage automatique du navigateur ne passe pas toujours par onChange
    const fd = new FormData(e.currentTarget), v = { ...f };
    for (const k of ['company_name', 'siret', 'trades', 'city', 'users_needed', 'current_tools', 'message', 'contact_name', 'email', 'phone']) { const x = fd.get(k); if (typeof x === 'string' && x.trim() && !String(v[k] || '').trim()) v[k] = x; }
    if (v !== f) setF(v);
    const miss = [v.company_name.trim().length < 2 && t('le nom de l’entreprise'), v.contact_name.trim().length < 2 && t('votre nom'), !/\S+@\S+\.\S+/.test(v.email) && t('un e-mail valide'), !v.consent && t('cocher la case d’accord en bas')].filter(Boolean);
    if (miss.length) { setErr(t('Il manque : {l}.', { l: miss.join(', ') })); return; }
    setState('…');
    try { await api.rpc('request_quote', { p: { ...v, plan: plan?.id || 'entreprise' } }); setState('ok'); window.scrollTo(0, 0); }
    catch (x) { setState(''); setErr(x.message || String(x)); }
  };

  return (
    <div className="content narrow quote-page" style={{ paddingTop: 20, paddingBottom: 60 }}>
      <button className="iconbtn" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/'))} aria-label={t('Retour')}><LuArrowLeft /></button>
      <div style={{ margin: '10px 0 6px' }}><Wordmark size={34} /></div>
      {state === 'ok' ? (
        <div className="card soft">
          <h1 style={{ fontSize: 26, margin: '0 0 8px' }}>{t('Demande envoyée')}</h1>
          <p>{t('Merci ! L’équipe Artis & You étudie vos besoins et vous envoie un devis sur mesure sous 48 heures ouvrées, à l’adresse {e}.', { e: f.email })}</p>
          <p className="small muted">{t('En attendant, vous pouvez déjà essayer Artis & You gratuitement pendant 30 jours.')}</p>
          <div className="row wrap" style={{ gap: 10 }}>
            {!profile && <Link to="/inscription/artisan" className="btn">{t('Créer mon compte et essayer')}</Link>}
            <Link to={profile ? '/' : '/'} className="btn ghost">{t('Retour à l’accueil')}</Link>
          </div>
        </div>
      ) : (
        <form onSubmit={send}>
          <h1 style={{ fontSize: 28, margin: '0 0 6px' }}>{t('Demander un devis {p}', { p: t(plan?.name || 'Entreprise') })}</h1>
          <p className="muted">{t('Dites-nous comment vous travaillez : nous vous proposons une formule et un prix adaptés à votre entreprise. Réponse sous 48 heures ouvrées, sans engagement.')}</p>

          <h2 className="quote-h">{t('Votre entreprise')}</h2>
          <div className="form-grid two">
            <Field label={t('Nom de l’entreprise')} req><input name="company_name" value={f.company_name} onChange={(e) => set('company_name', e.target.value)} autoComplete="organization" /></Field>
            <Field label={t('SIRET')} hint={t('facultatif')}><input name="siret" value={f.siret} onChange={(e) => set('siret', e.target.value)} inputMode="numeric" /></Field>
            <Field label={t('Métier(s)')}><input name="trades" value={f.trades} onChange={(e) => set('trades', e.target.value)} placeholder={t('ex. plomberie, chauffage')} /></Field>
            <Field label={t('Ville')}><input name="city" value={f.city} onChange={(e) => set('city', e.target.value)} autoComplete="address-level2" /></Field>
          </div>

          <h2 className="quote-h">{t('Votre équipe')}</h2>
          <div className="form-grid two">
            <Field label={t('Taille de l’équipe')}><select value={f.team_size} onChange={(e) => set('team_size', e.target.value)}>{TEAM.map((x) => <option key={x} value={x}>{t(x)}</option>)}</select></Field>
            <Field label={t('Personnes qui utiliseront Artis & You')} hint={t('environ')}><input type="number" min={1} name="users_needed" value={f.users_needed} onChange={(e) => set('users_needed', e.target.value)} /></Field>
            <Field label={t('Chantiers ou interventions par mois')}><select value={f.sites_per_month} onChange={(e) => set('sites_per_month', e.target.value)}>{SITES.map((x) => <option key={x} value={x}>{t(x)}</option>)}</select></Field>
            <Field label={t('Démarrage souhaité')}><select value={f.start_when} onChange={(e) => set('start_when', e.target.value)}>{START.map((x) => <option key={x} value={x}>{t(x)}</option>)}</select></Field>
          </div>

          <h2 className="quote-h">{t('Ce qui vous intéresse')}</h2>
          <p className="small muted" style={{ marginTop: 0 }}>{t('Cochez tout ce dont vous avez besoin : nous construisons le devis à partir de vos choix.')}</p>
          <div className="quote-opts">
            {[...features.map((o) => ({ label: o })), ...EXTRAS].map(({ label: o, desc }) => (
              <label key={o} className={'quote-opt' + (f.options.includes(o) ? ' on' : '')}>
                <input type="checkbox" checked={f.options.includes(o)} onChange={() => toggle(o)} />
                <span className="qo-box" aria-hidden="true">{f.options.includes(o) && <LuCheck />}</span>
                <span>{t(o)}{desc && <small className="muted" style={{ display: 'block', fontWeight: 400 }}>{desc}</small>}</span>
              </label>
            ))}
          </div>
          <div className="form-grid two">
            <Field label={t('Outils que vous utilisez aujourd’hui')} hint={t('facultatif')}><input name="current_tools" value={f.current_tools} onChange={(e) => set('current_tools', e.target.value)} placeholder={t('ex. Excel, logiciel de devis, agenda papier…')} /></Field>
          </div>
          <Field label={t('Autre chose à nous dire ?')} hint={t('facultatif')}><textarea rows={4} name="message" value={f.message} onChange={(e) => set('message', e.target.value)} placeholder={t('Vos attentes, vos contraintes, ce qui vous fait perdre du temps aujourd’hui…')} /></Field>

          <h2 className="quote-h">{t('Vos coordonnées')}</h2>
          <div className="form-grid two">
            <Field label={t('Votre nom')} req><input name="contact_name" value={f.contact_name} onChange={(e) => set('contact_name', e.target.value)} autoComplete="name" /></Field>
            <Field label={t('E-mail')} req><input type="email" name="email" value={f.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" /></Field>
            <Field label={t('Téléphone')} hint={t('pour en parler de vive voix')}><input type="tel" name="phone" value={f.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="tel" /></Field>
          </div>
          <label className="check"><input type="checkbox" checked={f.consent} onChange={(e) => set('consent', e.target.checked)} /><span>{t('J’accepte qu’Artis & You utilise ces informations pour me recontacter et m’envoyer un devis.')} <Link to="/confidentialite">{t('Confidentialité')}</Link></span></label>
          {err && <div className="notice mt" role="alert">{err}</div>}
          <button className="btn block mt" disabled={state === '…'}><LuSend /> {state === '…' ? t('Envoi…') : t('Envoyer ma demande de devis')}</button>
        </form>
      )}
    </div>
  );
}
