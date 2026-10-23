import { useState } from 'react';
import { LuHammer, LuHouse, LuArrowLeft, LuMail } from 'react-icons/lu';
import { api, getSession } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { navigate, Link } from '../../lib/router.jsx';
import { t, LANGS, getLang } from '../../lib/i18n.js';
import { Field, Chips } from '../../ui/index.jsx';
import { TRADES } from '../../lib/docs.js';

function AuthLayout({ children, art = true }) {
  const { setLang, lang } = useApp();
  return (
    <div className={'auth' + (art ? ' split' : '')}>
      {art && (
        <div className="auth-art">
          <img src="/logo.svg" alt="" style={{ width: 84 }} />
          <h2>{t('Les artisans')} <b>&amp;</b> {t('leurs clients, enfin au même endroit.')}</h2>
          <p>{t('Clients, planning, devis, factures, messages et réseau de pros pour l’artisan. Recherche d’artisans, rendez-vous, suivi de chantier et documents pour le particulier.')}</p>
          <ul><li>{t('Devis et factures conformes')}</li><li>{t('Prise de rendez-vous en ligne')}</li><li>{t('Messagerie client et équipe')}</li><li>{t('Coffre-fort de documents')}</li></ul>
        </div>
      )}
      <div style={{ display: 'grid', placeItems: 'center', padding: '24px 18px', minHeight: '100vh' }}>
        <div className="auth-box">
          {children}
          <div className="row center" style={{ justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {LANGS.map((l) => <button key={l.code} className={'link small' + (lang === l.code ? ' red' : '')} onClick={() => setLang(l.code)}>{l.label}</button>)}
          </div>
          <div className="center small faint"><Link to="/mentions-legales">{t('Mentions légales')}</Link> · <Link to="/cgu">{t('CGU')}</Link> · <Link to="/confidentialite">{t('Confidentialité')}</Link> · <Link to="/telecharger">{t('Logiciel PC / Mac')}</Link></div>
        </div>
      </div>
    </div>
  );
}

export function Login() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await api.signIn(email.trim(), pw, remember); navigate('/', { replace: true }); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <AuthLayout>
      <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
        <img className="auth-logo" src="/logo.svg" alt="Artis & You" />
        <input className="pillinput" type="email" autoComplete="email" placeholder={t('E-mail')} value={email} onChange={(e) => setEmail(e.target.value)} required aria-label={t('E-mail')} />
        <input className="pillinput" type="password" autoComplete="current-password" placeholder={t('Mot de passe')} value={pw} onChange={(e) => setPw(e.target.value)} required aria-label={t('Mot de passe')} />
        <Link to="/mot-de-passe-oublie" className="center bold">{t('Mot de passe oublié')}</Link>
        <label className="check" style={{ justifyContent: 'center', fontSize: 19, color: 'var(--bordeaux)' }}><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />{t('Se rappeler de moi')}</label>
        {err && <div className="error">{err}</div>}
        <button className="btn" style={{ height: 58, fontSize: 19 }} disabled={busy}>{busy ? '…' : t('Se connecter')}</button>
        <div style={{ height: 30 }} />
        <button type="button" className="btn navy" style={{ height: 58, fontSize: 19 }} onClick={() => navigate('/inscription')}>{t('Créer un compte')}</button>
      </form>
    </AuthLayout>
  );
}

export function SignupChoice() {
  return (
    <AuthLayout>
      <img className="auth-logo" src="/logo.svg" alt="" style={{ width: 110, height: 110 }} />
      <h1 className="center" style={{ fontSize: 26 }}>{t('Créer mon compte')}</h1>
      <p className="center muted">{t('Vous êtes…')}</p>
      <button className="opt red" onClick={() => navigate('/inscription/artisan')}><LuHammer /><div><b>{t('Artisan ou entreprise')}</b><small>{t('Gérer mes clients, mon planning, mes devis et factures. 30 jours d’essai.')}</small></div></button>
      <button className="opt" onClick={() => navigate('/inscription/particulier')}><LuHouse /><div><b>{t('Particulier')}</b><small>{t('Trouver un artisan, prendre RDV, suivre mes devis, factures et chantiers. Gratuit.')}</small></div></button>
      <Link to="/connexion" className="center bold mt">{t('J’ai déjà un compte')}</Link>
    </AuthLayout>
  );
}

// Vérifie un SIRET (14 chiffres + clé de Luhn)
export function siretValid(s) {
  const d = (s || '').replace(/\s/g, '');
  if (!/^\d{14}$/.test(d)) return false;
  if (d.startsWith('356000000')) return true; // La Poste
  let sum = 0;
  for (let i = 0; i < 14; i++) { let n = +d[13 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } sum += n; }
  return sum % 10 === 0;
}

function AccountFields({ v, set }) {
  return (
    <>
      <div className="form-grid two">
        <Field label={t('Prénom')}><input value={v.first_name} onChange={(e) => set({ ...v, first_name: e.target.value })} required autoComplete="given-name" /></Field>
        <Field label={t('Nom')}><input value={v.last_name} onChange={(e) => set({ ...v, last_name: e.target.value })} required autoComplete="family-name" /></Field>
      </div>
      <Field label={t('E-mail')}><input type="email" value={v.email} onChange={(e) => set({ ...v, email: e.target.value })} required autoComplete="email" /></Field>
      <Field label={t('Téléphone mobile')}><input type="tel" value={v.phone} onChange={(e) => set({ ...v, phone: e.target.value })} autoComplete="tel" /></Field>
      <Field label={t('Mot de passe')} hint={t('6 caractères minimum')}><input type="password" value={v.password} onChange={(e) => set({ ...v, password: e.target.value })} required minLength={6} autoComplete="new-password" /></Field>
    </>
  );
}

export function SignupClient() {
  const [v, set] = useState({ first_name: '', last_name: '', email: '', phone: '', password: '' });
  const [cgu, setCgu] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const { reload } = useApp();
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (!cgu) return setErr(t('Merci d’accepter les CGU.'));
    setBusy(true);
    try {
      const r = await api.signUp(v.email.trim(), v.password, { kind: 'particulier', first_name: v.first_name, last_name: v.last_name, phone: v.phone, lang: getLang() });
      if (r.needsConfirm) setSent(true); else { await reload(); navigate('/client', { replace: true }); }
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  if (sent) return <AuthLayout><ConfirmSent email={v.email} /></AuthLayout>;
  return (
    <AuthLayout>
      <form onSubmit={submit}>
        <button type="button" className="iconbtn" onClick={() => navigate('/inscription')} aria-label={t('Retour')}><LuArrowLeft /></button>
        <h1 style={{ fontSize: 26, margin: '8px 0 4px' }}>{t('Créer mon compte gratuit')}</h1>
        <p className="muted mb">{t('Pour trouver un artisan, prendre rendez-vous et suivre vos chantiers.')}</p>
        <AccountFields v={v} set={set} />
        <label className="check"><input type="checkbox" checked={cgu} onChange={(e) => setCgu(e.target.checked)} /><span>{t('J’accepte les')} <Link to="/cgu" className="red-t">{t('CGU')}</Link> {t('et la')} <Link to="/confidentialite" className="red-t">{t('politique de confidentialité')}</Link></span></label>
        {err && <div className="error">{err}</div>}
        <button className="btn block mt" disabled={busy}>{busy ? '…' : t('Créer mon compte')}</button>
      </form>
    </AuthLayout>
  );
}

function ConfirmSent({ email }) {
  return (
    <div className="center">
      <div className="big-ico" style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--navy)', color: '#fff', display: 'grid', placeItems: 'center', margin: '0 auto', fontSize: 32 }}><LuMail /></div>
      <h2 className="mt">{t('Vérifiez vos e-mails')}</h2>
      <p className="muted">{t('Un lien de confirmation a été envoyé à {e}. Cliquez dessus puis connectez-vous.', { e: email })}</p>
      <button className="btn block mt" onClick={() => navigate('/connexion')}>{t('Se connecter')}</button>
    </div>
  );
}

export function SignupPro() {
  const { profile, reload } = useApp();
  const hasAccount = !!profile && !getSession()?.recovery;
  const [step, setStep] = useState(hasAccount ? 2 : 1);
  const [v, set] = useState({ first_name: '', last_name: '', email: '', phone: '', password: '' });
  const [c, setC] = useState({ name: '', siret: '', trades: [], address: '', zip: '', city: '', referral: '' });
  const [mode, setMode] = useState('create');
  const [code, setCode] = useState('');
  const [cgu, setCgu] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const s1 = async (e) => {
    e.preventDefault(); setErr('');
    if (!cgu) return setErr(t('Merci d’accepter les CGU.'));
    setBusy(true);
    try {
      const r = await api.signUp(v.email.trim(), v.password, { kind: 'artisan', first_name: v.first_name, last_name: v.last_name, phone: v.phone, lang: getLang() });
      if (r.needsConfirm) setSent(true); else { await reload(); setStep(2); }
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  const s2 = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      if (mode === 'join') await api.rpc('join_company', { p_code: code.trim() });
      else {
        if (!siretValid(c.siret)) throw new Error(t('Le SIRET doit contenir 14 chiffres valides.'));
        if (!c.trades.length) throw new Error(t('Choisissez au moins un métier.'));
        await api.rpc('create_company', { p: { ...c, siret: c.siret.replace(/\s/g, ''), email: profile?.email || v.email, phone: profile?.phone || v.phone } });
      }
      await reload(); navigate('/pro', { replace: true });
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  if (sent) return <AuthLayout><ConfirmSent email={v.email} /></AuthLayout>;
  return (
    <AuthLayout>
      {step === 1 ? (
        <form onSubmit={s1}>
          <button type="button" className="iconbtn" onClick={() => navigate('/inscription')} aria-label={t('Retour')}><LuArrowLeft /></button>
          <div className="small red-t bold">{t('Étape {n} sur 2', { n: 1 })}</div>
          <h1 style={{ fontSize: 26, margin: '4px 0 12px' }}>{t('Votre compte artisan')}</h1>
          <AccountFields v={v} set={set} />
          <label className="check"><input type="checkbox" checked={cgu} onChange={(e) => setCgu(e.target.checked)} /><span>{t('J’accepte les')} <Link to="/cgu" className="red-t">{t('CGU')}</Link> {t('et la')} <Link to="/confidentialite" className="red-t">{t('politique de confidentialité')}</Link></span></label>
          {err && <div className="error">{err}</div>}
          <button className="btn block mt" disabled={busy}>{busy ? '…' : t('Continuer')}</button>
        </form>
      ) : (
        <form onSubmit={s2}>
          <div className="small red-t bold">{t('Étape {n} sur 2', { n: 2 })}</div>
          <h1 style={{ fontSize: 26, margin: '4px 0 12px' }}>{t('Votre entreprise')}</h1>
          <Chips options={[['create', t('Créer mon entreprise')], ['join', t('Rejoindre une équipe')]]} value={mode} onChange={setMode} />
          {mode === 'join' ? (
            <>
              <p className="muted">{t('Votre gérant vous a donné un code d’invitation (Paramètres → Mon équipe).')}</p>
              <Field label={t('Code d’invitation')}><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required maxLength={8} style={{ letterSpacing: 4, fontWeight: 800, textAlign: 'center' }} /></Field>
            </>
          ) : (
            <>
              <Field label={t('Raison sociale')}><input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} required /></Field>
              <Field label={t('SIRET')} hint={t('14 chiffres — vérifié par notre équipe')}><input value={c.siret} onChange={(e) => setC({ ...c, siret: e.target.value })} required inputMode="numeric" placeholder="845 216 937 00024" /></Field>
              <div className="form-grid three">
                <Field label={t('Adresse')}><input value={c.address} onChange={(e) => setC({ ...c, address: e.target.value })} /></Field>
                <Field label={t('Code postal')}><input value={c.zip} onChange={(e) => setC({ ...c, zip: e.target.value })} inputMode="numeric" /></Field>
                <Field label={t('Ville')}><input value={c.city} onChange={(e) => setC({ ...c, city: e.target.value })} required /></Field>
              </div>
              <div className="field"><span>{t('Vos métiers')}</span></div>
              {Object.entries(TRADES).map(([g, list]) => (
                <div key={g}><div className="small bold red-t" style={{ margin: '6px 0' }}>{t(g).toUpperCase()}</div>
                  <Chips multi options={list.map((x) => [x, t(x)])} value={c.trades} onChange={(trades) => setC({ ...c, trades })} /></div>
              ))}
              <Field label={t('Code de parrainage')} hint={t('facultatif — 1 mois offert')}><input value={c.referral} onChange={(e) => setC({ ...c, referral: e.target.value.toUpperCase() })} /></Field>
            </>
          )}
          {err && <div className="error">{err}</div>}
          <button className="btn block mt" disabled={busy}>{busy ? '…' : mode === 'join' ? t('Rejoindre l’équipe') : t('Commencer mon essai de 30 jours')}</button>
          <button type="button" className="link block mt" style={{ width: '100%' }} onClick={async () => { await api.signOut(); navigate('/connexion'); }}>{t('Se déconnecter')}</button>
        </form>
      )}
    </AuthLayout>
  );
}

export function Forgot() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e) => { e.preventDefault(); setErr(''); try { await api.recover(email.trim()); setDone(true); } catch (x) { setErr(x.message); } };
  return (
    <AuthLayout art={false}>
      <form onSubmit={submit}>
        <button type="button" className="iconbtn" onClick={() => navigate('/connexion')} aria-label={t('Retour')}><LuArrowLeft /></button>
        <h1 style={{ fontSize: 26, margin: '8px 0' }}>{t('Mot de passe oublié')}</h1>
        {done ? <p className="notice">{t('Si un compte existe pour {e}, un lien pour choisir un nouveau mot de passe vient d’être envoyé.', { e: email })}</p> : (
          <>
            <p className="muted">{t('Indiquez votre e-mail, nous vous envoyons un lien pour choisir un nouveau mot de passe.')}</p>
            <Field label={t('E-mail')}><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
            {err && <div className="error">{err}</div>}
            <button className="btn block">{t('Envoyer le lien')}</button>
          </>
        )}
      </form>
    </AuthLayout>
  );
}

export function NewPassword() {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const { reload } = useApp();
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try { await api.updatePassword(pw); const s = getSession(); if (s) delete s.recovery; await reload(); navigate('/', { replace: true }); } catch (x) { setErr(x.message); }
  };
  return (
    <AuthLayout art={false}>
      <form onSubmit={submit}>
        <h1 style={{ fontSize: 26, margin: '8px 0' }}>{t('Nouveau mot de passe')}</h1>
        <Field label={t('Mot de passe')} hint={t('6 caractères minimum')}><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} /></Field>
        {err && <div className="error">{err}</div>}
        <button className="btn block">{t('Enregistrer')}</button>
      </form>
    </AuthLayout>
  );
}
