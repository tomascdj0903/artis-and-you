import { useState } from 'react';
import { LuHammer, LuHouse, LuArrowLeft, LuMail } from 'react-icons/lu';
import { api, getSession, OFFLINE } from '../../lib/api.js';
import { markUnlocked } from '../../lib/security.js';
import { AddressFields } from '../../ui/address.jsx';
import { useApp } from '../../lib/store.jsx';
import { navigate, Link } from '../../lib/router.jsx';
import { t, LANGS, getLang } from '../../lib/i18n.js';
import { Field, Chips } from '../../ui/index.jsx';
import { TRADES, LEGAL_FORMS } from '../../lib/docs.js';

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
          <div className="center small faint"><Link to="/mentions-legales">{t('Mentions légales')}</Link> · <Link to="/cgu">{t('CGU')}</Link> · <Link to="/confidentialite">{t('Confidentialité')}</Link> · <Link to="/telecharger">{t('Applications')}</Link></div>
        </div>
      </div>
    </div>
  );
}

// Connexion par mot de passe : pas besoin de redemander Face ID juste après
const unlockedNow = () => { const id = getSession()?.user?.id; if (id) markUnlocked(id); };
export function Login() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [mfa, setMfa] = useState(false);
  const [code, setCode] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { const r = await api.signIn(email.trim(), pw, remember); if (r?.mfa) { setMfa(true); setBusy(false); return; } unlockedNow(); navigate('/', { replace: true }); }
    catch (x) { if (x.code === 'email_not_confirmed') { navigate('/verification?email=' + encodeURIComponent(email.trim().toLowerCase())); return; } setErr(x.message); }
    setBusy(false);
  };
  const submitCode = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await api.mfaLogin(code); unlockedNow(); navigate('/', { replace: true }); } catch (x) { setErr(x.message); setCode(''); }
    setBusy(false);
  };
  if (mfa) return (
    <AuthLayout>
      <form onSubmit={submitCode} style={{ display: 'grid', gap: 14 }}>
        <img className="auth-logo" src="/logo.svg" alt="Artis & You" />
        <h1 className="center" style={{ fontSize: 24, margin: 0 }}>{t('Double authentification')}</h1>
        <p className="center muted" style={{ margin: 0 }}>{t('Saisissez le code à 6 chiffres affiché dans votre application d’authentification.')}</p>
        <input className="pillinput center" style={{ fontSize: 26, letterSpacing: 8, fontWeight: 800 }} inputMode="numeric" autoComplete="one-time-code" maxLength={7} autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ''))} aria-label={t('Code')} placeholder="000000" />
        {err && <div className="error">{err}</div>}
        <button className="btn" style={{ height: 58, fontSize: 19 }} disabled={busy || code.replace(/\D/g, '').length !== 6}>{busy ? '…' : t('Valider')}</button>
        <button type="button" className="link center bold" onClick={() => { setMfa(false); setCode(''); setErr(''); }}>{t('Retour')}</button>
        <p className="small faint center">{t('Plus accès à votre application ? Écrivez à support@artisandyou.fr depuis votre adresse e-mail.')}</p>
      </form>
    </AuthLayout>
  );
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

const PHONE_RE = /^(\+?\d[\d .-]{8,16}\d)$/;
export const phoneValid = (p) => PHONE_RE.test((p || '').trim());

function AccountFields({ v, set }) {
  return (
    <>
      <div className="form-grid three">
        <Field label={t('Civilité')}><select value={v.civility} onChange={(e) => set({ ...v, civility: e.target.value })} required><option value="">—</option><option value="M.">{t('M.')}</option><option value="Mme">{t('Mme')}</option></select></Field>
        <Field label={t('Prénom')}><input value={v.first_name} onChange={(e) => set({ ...v, first_name: e.target.value })} required autoComplete="given-name" /></Field>
        <Field label={t('Nom')}><input value={v.last_name} onChange={(e) => set({ ...v, last_name: e.target.value })} required autoComplete="family-name" /></Field>
      </div>
      <Field label={t('E-mail')}><input type="email" value={v.email} onChange={(e) => set({ ...v, email: e.target.value })} required autoComplete="email" /></Field>
      <Field label={t('Téléphone mobile')}><input type="tel" value={v.phone} onChange={(e) => set({ ...v, phone: e.target.value })} required autoComplete="tel" placeholder="06 12 34 56 78" /></Field>
      <Field label={t('Mot de passe')} hint={t('8 caractères minimum, dont un chiffre')}><input type="password" value={v.password} onChange={(e) => set({ ...v, password: e.target.value })} required minLength={8} autoComplete="new-password" /></Field>
    </>
  );
}
const checkAccount = (v) => {
  if (!phoneValid(v.phone)) return t('Numéro de téléphone invalide.');
  if ((v.password || '').length < 8 || !/\d/.test(v.password)) return t('Le mot de passe doit contenir au moins 8 caractères, dont un chiffre.');
  return '';
};

export function SignupClient() {
  const [v, set] = useState({ civility: '', first_name: '', last_name: '', email: '', phone: '', password: '', home: { address: '', zip: '', city: '', country: 'France' } });
  const [cgu, setCgu] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    const bad = checkAccount(v); if (bad) return setErr(bad);
    if (!cgu) return setErr(t('Merci d’accepter les CGU.'));
    setBusy(true);
    try {
      const r = await api.signUp(v.email.trim().toLowerCase(), v.password, { kind: 'particulier', civility: v.civility, first_name: v.first_name, last_name: v.last_name, phone: v.phone, home: v.home, lang: getLang() });
      if (r.needsConfirm) setSent({ email: v.email.trim().toLowerCase(), devCode: r.devCode }); else navigate('/client', { replace: true });
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  if (sent) return <AuthLayout><VerifyEmailBox email={sent.email} devCode={sent.devCode} onDone={() => navigate('/client', { replace: true })} /></AuthLayout>;
  return (
    <AuthLayout>
      <form onSubmit={submit}>
        <button type="button" className="iconbtn" onClick={() => navigate('/inscription')} aria-label={t('Retour')}><LuArrowLeft /></button>
        <h1 style={{ fontSize: 26, margin: '8px 0 4px' }}>{t('Créer mon compte gratuit')}</h1>
        <p className="muted mb">{t('Pour trouver un artisan, prendre rendez-vous et suivre vos chantiers.')}</p>
        <AccountFields v={v} set={set} />
        <div className="field"><span>{t('Adresse de votre logement')}</span></div>
        <AddressFields value={v.home} onChange={(home) => set({ ...v, home })} required />
        <label className="check"><input type="checkbox" checked={cgu} onChange={(e) => setCgu(e.target.checked)} /><span>{t('J’accepte les')} <Link to="/cgu" className="red-t">{t('CGU')}</Link> {t('et la')} <Link to="/confidentialite" className="red-t">{t('politique de confidentialité')}</Link></span></label>
        {err && <div className="error">{err}</div>}
        <button className="btn block mt" disabled={busy}>{busy ? '…' : t('Créer mon compte')}</button>
      </form>
    </AuthLayout>
  );
}

// Saisie du code de vérification reçu par e-mail
export function VerifyEmailBox({ email, devCode: dc, onDone }) {
  const { reload } = useApp();
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState(dc);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await api.verifyEmail(email, code); await reload(); onDone ? onDone() : navigate('/', { replace: true }); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  };
  const resend = async () => { setErr(''); try { const r = await api.resendCode(email); if (r.devCode) setDevCode(r.devCode); setInfo(t('Un nouveau code vient d’être envoyé.')); } catch (x) { setErr(x.message); } };
  return (
    <form onSubmit={submit} className="center">
      <div className="big-ico" style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--navy)', color: '#fff', display: 'grid', placeItems: 'center', margin: '0 auto', fontSize: 32 }}><LuMail /></div>
      <h2 className="mt">{t('Vérifiez votre adresse e-mail')}</h2>
      <p className="muted">{t('Nous avons envoyé un code à 6 chiffres à {e}. Saisissez-le pour activer votre compte.', { e: email })}</p>
      {!OFFLINE && <p className="muted small">{t('Vous avez reçu un lien plutôt qu’un code ? Cliquez simplement dessus : votre compte sera activé et vous serez connecté.')}</p>}
      {OFFLINE && devCode && <div className="notice" style={{ textAlign: 'left' }}>{t('Mode local : aucun e-mail n’est envoyé. Votre code est {c}.', { c: devCode })}</div>}
      <input className="pillinput mt" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" required minLength={6} style={{ letterSpacing: 10 }} aria-label={t('Code de vérification')} />
      {err && <div className="error">{err}</div>}
      {info && <div className="notice">{info}</div>}
      <button className="btn block mt" disabled={busy || code.length < 6}>{busy ? '…' : t('Valider mon adresse')}</button>
      <button type="button" className="link mt" onClick={resend}>{t('Renvoyer le code')}</button>
    </form>
  );
}
export function Verify() {
  const email = new URLSearchParams(location.search).get('email') || '';
  return <AuthLayout><VerifyEmailBox email={email} /></AuthLayout>;
}

export function SignupPro() {
  const { profile, reload } = useApp();
  const hasAccount = !!profile && !getSession()?.recovery;
  const [step, setStep] = useState(hasAccount ? 2 : 1);
  const [v, set] = useState({ civility: '', first_name: '', last_name: '', email: '', phone: '', password: '' });
  const [c, setC] = useState({ name: '', legal_form: '', siret: '', trades: [], address: '', zip: '', city: '', country: 'France', phone: profile?.phone || '', email: profile?.email || '', referral: '' });
  const [mode, setMode] = useState('create');
  const [code, setCode] = useState('');
  const [cgu, setCgu] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);

  const s1 = async (e) => {
    e.preventDefault(); setErr('');
    const bad = checkAccount(v); if (bad) return setErr(bad);
    if (!cgu) return setErr(t('Merci d’accepter les CGU.'));
    setBusy(true);
    try {
      const em = v.email.trim().toLowerCase();
      const r = await api.signUp(em, v.password, { kind: 'artisan', civility: v.civility, first_name: v.first_name, last_name: v.last_name, phone: v.phone, lang: getLang() });
      setC((x) => ({ ...x, email: x.email || em, phone: x.phone || v.phone }));
      if (r.needsConfirm) setSent({ email: em, devCode: r.devCode }); else { await reload(); setStep(2); }
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  const s2 = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      if (mode === 'join') await api.rpc('join_company', { p_code: code.trim() });
      else {
        if (!siretValid(c.siret)) throw new Error(t('Le SIRET doit contenir 14 chiffres valides.'));
        if (!c.legal_form) throw new Error(t('Choisissez la forme juridique.'));
        if (!c.address || !c.zip || !c.city) throw new Error(t('L’adresse complète de l’entreprise est obligatoire.'));
        if (!phoneValid(c.phone || profile?.phone)) throw new Error(t('Numéro de téléphone invalide.'));
        if (!c.trades.length) throw new Error(t('Choisissez au moins un métier.'));
        await api.rpc('create_company', { p: { ...c, siret: c.siret.replace(/\s/g, ''), email: c.email || profile?.email || v.email, phone: c.phone || profile?.phone || v.phone } });
      }
      await reload(); navigate('/pro', { replace: true });
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  if (sent && step === 1) return <AuthLayout><VerifyEmailBox email={sent.email} devCode={sent.devCode} onDone={() => { setSent(null); setStep(2); }} /></AuthLayout>;
  return (
    <AuthLayout>
      {step === 1 ? (
        <form onSubmit={s1}>
          <button type="button" className="iconbtn" onClick={() => navigate('/inscription')} aria-label={t('Retour')}><LuArrowLeft /></button>
          <div className="small red-t bold">{t('Étape {n} sur 3', { n: 1 })}</div>
          <h1 style={{ fontSize: 26, margin: '4px 0 12px' }}>{t('Votre compte artisan')}</h1>
          <AccountFields v={v} set={set} />
          <label className="check"><input type="checkbox" checked={cgu} onChange={(e) => setCgu(e.target.checked)} /><span>{t('J’accepte les')} <Link to="/cgu" className="red-t">{t('CGU')}</Link> {t('et la')} <Link to="/confidentialite" className="red-t">{t('politique de confidentialité')}</Link></span></label>
          {err && <div className="error">{err}</div>}
          <button className="btn block mt" disabled={busy}>{busy ? '…' : t('Continuer')}</button>
        </form>
      ) : (
        <form onSubmit={s2}>
          <div className="small red-t bold">{t('Étape {n} sur 3', { n: 3 })}</div>
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
              <div className="form-grid two">
                <Field label={t('Forme juridique')}><select value={c.legal_form} onChange={(e) => setC({ ...c, legal_form: e.target.value })} required><option value="">{t('Choisir')}</option>{LEGAL_FORMS.map((x) => <option key={x} value={x}>{t(x)}</option>)}</select></Field>
                <Field label={t('SIRET')} hint={t('vérifié par notre équipe')}><input value={c.siret} onChange={(e) => setC({ ...c, siret: e.target.value })} required inputMode="numeric" placeholder="845 216 937 00024" /></Field>
              </div>
              <div className="field"><span>{t('Adresse du siège')}</span></div>
              <AddressFields value={c} onChange={(x) => setC({ ...c, ...x })} required />
              <div className="form-grid two">
                <Field label={t('Téléphone de l’entreprise')}><input type="tel" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} required /></Field>
                <Field label={t('E-mail de l’entreprise')}><input type="email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} required /></Field>
              </div>
              <div className="field"><span>{t('Vos métiers')}</span></div>
              {Object.entries(TRADES).map(([g, list]) => (
                <div key={g}><div className="small bold red-t" style={{ margin: '6px 0' }}>{t(g).toUpperCase()}</div>
                  <Chips multi options={list.map((x) => [x, t(x)])} value={c.trades} onChange={(trades) => setC({ ...c, trades })} /></div>
              ))}
              <Field label={t('Code de parrainage')} hint={t('facultatif — 1 mois offert')}><input value={c.referral} onChange={(e) => setC({ ...c, referral: e.target.value.toUpperCase() })} /></Field>
              <p className="small muted">{t('Votre compte sera vérifié par l’équipe Artis & You (SIRET, informations légales) avant d’être visible des clients.')}</p>
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
