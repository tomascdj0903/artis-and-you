import { useEffect, useState } from 'react';
import { companyMissing, VAULT_FORM, VAULT_TYPES, docTypeLabel, similarTrades } from '../../lib/docs.js';
import { useTrades, loadTrades } from '../../ui/trades.jsx';
import { HELP, HELP_CATS } from '../../lib/help.js';
import { LawRefs } from '../../ui/lawref.jsx';
import { AdminIdentities } from '../../ui/identity.jsx';
import { bioAvailable, bioEnabled, bioEnable, bioDisable, groupSecret } from '../../lib/security.js';
import { LuBell, LuCalendar, LuFileText, LuEuro, LuMessageSquare, LuInfo, LuMail, LuPhone, LuBug, LuDownload, LuTrash2, LuMoon, LuSun, LuCheck, LuX } from 'react-icons/lu';
import JSZip from 'jszip';
import { api, uid, APP_VERSION, OFFLINE } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { navigate, Link } from '../../lib/router.jsx';
import { resetTours } from '../../ui/tour.jsx';
import { t, LANGS } from '../../lib/i18n.js';
import { rel, dateMed, fullName, date, dateTime } from '../../lib/format.js';
import { download } from '../../lib/xlsx.js';
import { TopBar, SearchBar, suggestList, Sec, Chips, Field, Toggle, SettingToggle, useData, Loader, Empty, Avatar, pickFiles, Stars, Pill, KV, Sheet, openFile, Img, Lightbox } from '../../ui/index.jsx';
import { uploadTo } from './chat.jsx';
import { CropSheet } from '../../ui/crop.jsx';

const NICON = { rdv: LuCalendar, documents: LuFileText, paiement: LuEuro, message: LuMessageSquare, systeme: LuInfo };
export function Notifications() {
  const { isPro, refreshUnread } = useApp();
  const [f, setF] = useState('');
  const [q, setQ] = useState('');
  const [list, reload] = useData(() => api.select('notifications', { user_id: uid() }, { order: 'created_at.desc', limit: 200 }), []);
  if (!list) return <div className="content"><TopBar title={t('Notifications')} /><Loader /></div>;
  const shown = list.filter((n) => (!f || n.category === f || (f === 'rdv' && n.category === 'message')) && (!q || (n.title + ' ' + n.body).toLowerCase().includes(q.toLowerCase())));
  const open = async (n) => { if (!n.read) { await api.update('notifications', { id: n.id }, { read: true }); refreshUnread(); } if (n.link) navigate(n.link.replace(/^\/pro\/reglages\/profil-public/, '/pro/compte/avis')); else reload(); };
  const readAll = async () => { await api.update('notifications', { user_id: uid(), read: false }, { read: true }); refreshUnread(); reload(); };
  let last = '';
  return (
    <div className="content narrow">
      <TopBar title={t('Notifications')} back={isPro} settings={isPro ? '/pro/compte/notifications' : '/client/compte/notifications'}  />
      {list.some((n) => !n.read) && <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 8 }}><button className="btn xs ghost" onClick={readAll}>{t('Tout marquer comme lu')}</button></div>}
      <SearchBar placeholder={isPro ? t('Rechercher') : t('Recherchez un pro')} value={q} onChange={setQ} suggest={() => suggestList(shown, { label: (n) => n.title, sub: (n) => n.body, go: open })} />
      <Chips options={[['', t('Toutes')], ['rdv', t('RDV et chantier')], ['documents', t('Documents')], ['paiement', t('Paiement')]]} value={f} onChange={setF} />
      {!shown.length ? <Empty icon={LuBell} text={t('Aucune notification')} /> : shown.map((n) => {
        const day = n.created_at.slice(0, 10); const show = day !== last; last = day; const I = NICON[n.category] || LuBell;
        return (
          <div key={n.id}>
            {show && <div className="small bold muted" style={{ margin: '14px 0 6px' }}>{dateMed(day)}</div>}
            <button className="card row" style={{ width: '100%', textAlign: 'left', marginBottom: 10, background: n.read ? 'var(--bordeaux-50)' : 'var(--bordeaux-100)', color: 'inherit', borderWidth: n.read ? 1 : 2, borderColor: n.read ? 'var(--line)' : 'var(--bordeaux)' }} onClick={() => open(n)}>
              <span className="ficon"><I /></span>
              <div className="grow"><div className="row between"><Pill c="navy">{t({ rdv: 'RDV', documents: 'Documents', paiement: 'Paiement', message: 'Message', systeme: 'Info' }[n.category])}</Pill>{!n.read && <span style={{ width: 10, height: 10, borderRadius: 5, background: 'var(--bordeaux)' }} />}</div>
                <b style={{ display: 'block', marginTop: 6 }}>{t(n.title)}</b><span className="small muted">{n.body}</span><div className="small red-t bold">{rel(n.created_at)}</div></div>
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function MyProfile() {
  const { profile, setProfile, run } = useApp();
  const [p, setP] = useState(profile);
  const [pw, setPw] = useState('');
  const [crop, setCrop] = useState(null);
  const photo = async () => { const [f] = await pickFiles({ accept: 'image/*', multiple: false }); if (f) setCrop(f); };
  const savePhoto = async (f) => { setCrop(null); await run(async () => { const up = await uploadTo((profile.company_id || 'u/' + profile.id) + '/avatars', f); setP({ ...p, avatar_path: up.path }); await api.update('profiles', { id: profile.id }, { avatar_path: up.path }); setProfile({ ...profile, avatar_path: up.path }); }, t('Photo enregistrée')); };
  const save = () => run(async () => {
    await api.update('profiles', { id: profile.id }, { first_name: p.first_name, last_name: p.last_name, phone: p.phone });
    if (p.email !== profile.email) { await api.updateEmail(p.email); await api.update('profiles', { id: profile.id }, { email: p.email }); }
    if (pw) { await api.updatePassword(pw); setPw(''); }
    setProfile({ ...profile, ...p });
  }, p.email !== profile.email ? t('Enregistré. Confirmez la nouvelle adresse via le lien reçu par e-mail.') : t('Profil enregistré'));
  if (profile.kind === 'admin') return (
    <div className="content narrow">
      <TopBar title={t('Connexion et sécurité')} />
      <div className="mb" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}><Avatar src="/favicon.svg" name="Artis & You" size="lg" /><b style={{ fontSize: 19 }}>Artis & You</b><span className="small muted">{t('Compte administrateur : vous apparaissez partout sous le nom « Artis & You » avec le logo.')}</span></div>
      <Field label={t('E-mail de connexion')} req><input type="email" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} /></Field>
      <Sec title={t('Sécurité')} />
      <Field label={t('Nouveau mot de passe')} hint={t('laisser vide pour ne pas changer')}><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} autoComplete="new-password" /></Field>
      <div className="btns"><button className="btn" onClick={save}>{t('Enregistrer')}</button></div>
      <Security />
    </div>
  );
  return (
    <div className="content narrow">
      <TopBar title={t('Mon profil')} />
      <div className="center mb"><Avatar name={p.first_name} last={p.last_name} path={p.avatar_path} size="lg" ring={profile.kind !== 'artisan'} /><button className="link red" onClick={photo}>{t('Changer la photo')}</button></div>
      <div className="form-grid two">
        <Field label={t('Prénom')} req><input value={p.first_name} onChange={(e) => setP({ ...p, first_name: e.target.value })} /></Field>
        <Field label={t('Nom')} req><input value={p.last_name} onChange={(e) => setP({ ...p, last_name: e.target.value })} /></Field>
        <Field label={t('E-mail')} req><input type="email" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} /></Field>
        <Field label={t('Téléphone')} req><input type="tel" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} /></Field>
      </div>
      {profile.kind === 'artisan' && <KV rows={[[t('Rôle'), t({ gerant: 'Gérant', chef: "Chef d'équipe", ouvrier: 'Ouvrier' }[profile.member_role]) + ' · ' + t('modifiable dans Mon équipe')]]} />}
      <Sec title={t('Sécurité')} />
      <Field label={t('Nouveau mot de passe')} hint={t('laisser vide pour ne pas changer')}><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} autoComplete="new-password" /></Field>
      <div className="btns"><button className="btn" onClick={save}>{t('Enregistrer')}</button></div>
      <Security />
      <CropSheet file={crop} round onClose={() => setCrop(null)} onDone={savePhoto} title={t('Recadrer la photo')} />
    </div>
  );
}

// Face ID / empreinte (sur cet appareil) et double authentification (application TOTP)
function Security() {
  const { profile, run, toast, confirm } = useApp();
  const [bioOk, setBioOk] = useState(null);
  const [bio, setBio] = useState(() => bioEnabled(profile.id));
  const [mfa, setMfa] = useState(null);
  const [enroll, setEnroll] = useState(null);
  const [code, setCode] = useState('');
  useEffect(() => { bioAvailable().then(setBioOk); api.mfaStatus().then(setMfa).catch(() => setMfa({ enabled: false })); }, []);
  const toggleBio = async (v) => {
    if (!v) { bioDisable(profile.id); setBio(false); toast(t('Déverrouillage biométrique désactivé')); return; }
    try { await bioEnable(profile.id, profile.email, fullName(profile)); setBio(true); toast(t('Déverrouillage biométrique activé sur cet appareil')); }
    catch (e) { toast(e.name === 'NotAllowedError' ? t('Activation annulée.') : e.message, true); }
  };
  const toggleMfa = async (v) => {
    if (v) { await run(async () => { setCode(''); setEnroll(await api.mfaEnroll()); }); return; }
    if (!(await confirm({ title: t('Désactiver la double authentification ?'), text: t('Votre compte ne sera plus protégé que par le mot de passe.'), ok: t('Désactiver'), danger: true }))) return;
    await run(async () => { await api.mfaDisable(mfa.factorId); setMfa({ enabled: false }); }, t('Double authentification désactivée'));
  };
  const confirmMfa = () => run(async () => { await api.mfaConfirm(enroll.factorId, code); setEnroll(null); setMfa(await api.mfaStatus()); }, t('Double authentification activée'));
  return (
    <>
      <Sec title={t('Connexion renforcée')} />
      <div className="kv">
        {bioOk === false
          ? <div className="r set-row"><span className="k">{t('Face ID / empreinte')}<small>{t('Non disponible sur cet appareil ou ce navigateur (il faut Face ID, Touch ID, une empreinte ou Windows Hello).')}</small></span><Toggle checked={false} onChange={() => {}} /></div>
          : <SettingToggle label={t('Face ID / empreinte')} hint={bio ? t('Demandé à l’ouverture de l’application sur cet appareil') : t('Déverrouillez l’application avec Face ID, Touch ID, votre empreinte ou Windows Hello')} checked={bio} onChange={toggleBio} />}
        <SettingToggle label={t('Double authentification')} hint={mfa?.enabled ? t('Un code de votre application d’authentification est demandé à chaque connexion') : t('Ajoutez un code à 6 chiffres (Google Authenticator, Microsoft Authenticator…) en plus du mot de passe')} checked={!!mfa?.enabled} onChange={toggleMfa} />
      </div>
      <Sheet open={!!enroll} onClose={() => setEnroll(null)} title={t('Activer la double authentification')}>
        {enroll && <>
          <p className="small"><b>1.</b> {t('Installez une application d’authentification (Google Authenticator, Microsoft Authenticator, 1Password…).')}</p>
          <p className="small"><b>2.</b> {enroll.qr ? t('Scannez ce QR code, ou saisissez la clé ci-dessous :') : t('Ajoutez un compte avec la clé ci-dessous (ou touchez « Ouvrir dans l’application » sur votre téléphone) :')}</p>
          {enroll.qr && <div className="center"><img src={enroll.qr} alt="QR code" style={{ width: 180, height: 180, background: '#fff', borderRadius: 12, padding: 8 }} /></div>}
          <div className="card soft center" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 17, fontWeight: 700, letterSpacing: 1, userSelect: 'all', wordBreak: 'break-all' }}>{groupSecret(enroll.secret)}</div>
          <div className="row" style={{ gap: 8, justifyContent: 'center', margin: '8px 0' }}>
            <button className="btn xs ghost" onClick={() => { navigator.clipboard?.writeText(enroll.secret); toast(t('Clé copiée')); }}>{t('Copier la clé')}</button>
            <a className="btn xs ghost" href={enroll.uri}>{t('Ouvrir dans l’application')}</a>
          </div>
          <p className="small"><b>3.</b> {t('Saisissez le code à 6 chiffres affiché :')}</p>
          <input className="input center" style={{ fontSize: 24, letterSpacing: 6, fontWeight: 800 }} inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ''))} placeholder="000000" aria-label={t('Code')} />
          <button className="btn block mt" disabled={code.replace(/\D/g, '').length !== 6} onClick={confirmMfa}>{t('Activer')}</button>
        </>}
      </Sheet>
    </>
  );
}

export function Appearance() {
  const { lang, setLang, theme, setTheme } = useApp();
  return (
    <div className="content narrow">
      <TopBar title={t('Langue et apparence')} />
      <Sec title={t('Langue')} />
      <Chips options={LANGS.map((l) => [l.code, l.label])} value={lang} onChange={setLang} />
      <Sec title={t('Mode d’affichage')} />
      <div className="kv"><div className="r"><span className="k row">{theme === 'dark' ? <LuMoon /> : <LuSun />} {t('Mode sombre')}</span><Toggle checked={theme === 'dark'} onChange={(v) => setTheme(v ? 'dark' : 'light')} /></div></div>
    </div>
  );
}

export function DataPrivacy() {
  const { profile, company, isPro, run, confirm, setProfile, toast } = useApp();
  const [pv, setPv] = useState({ audience: false, news: true, ...(profile.privacy || {}) });
  const set = async (k, v) => { const x = { ...pv, [k]: v }; setPv(x); await api.update('profiles', { id: profile.id }, { privacy: x }); setProfile({ ...profile, privacy: x }); };
  const exportAll = () => run(async () => {
    const zip = new JSZip();
    const tables = isPro ? ['companies', 'teams', 'clients', 'projects', 'documents', 'payments', 'purchases', 'appointments', 'items', 'files', 'reviews'] : ['clients', 'projects', 'documents', 'appointments', 'files'];
    zip.file('profil.json', JSON.stringify(profile, null, 2));
    for (const tb of tables) {
      const rows = isPro ? await api.select(tb, tb === 'companies' ? { id: company.id } : { company_id: company.id }) : await api.select(tb, {});
      zip.file(tb + '.json', JSON.stringify(rows, null, 2));
    }
    const convs = await api.select('conversations', {});
    for (const c of convs) zip.file(`messages/${c.id}.json`, JSON.stringify(await api.select('messages', { conversation_id: c.id }), null, 2));
    zip.file('notifications.json', JSON.stringify(await api.select('notifications', { user_id: profile.id }), null, 2));
    // données ajoutées depuis : sélection, alertes, avis rédigés, étapes de chantier, statistiques de fiche
    const extra = isPro ? { project_steps: { company_id: company.id }, profile_stats: { company_id: company.id } } : { client_favorites: { user_id: profile.id }, search_alerts: { user_id: profile.id }, reviews: { author_id: profile.id }, project_steps: {} };
    for (const [tb, f] of Object.entries(extra)) { try { zip.file(tb + '.json', JSON.stringify(await api.select(tb, f), null, 2)); } catch {} }
    // photos envoyées (avis, chantier) : listées avec leur chemin dans les fichiers JSON ci-dessus
    download(await zip.generateAsync({ type: 'blob' }), `artis-and-you-mes-donnees-${new Date().toISOString().slice(0, 10)}.zip`);
  }, t('Export téléchargé'));
  // Suppression du compte depuis l'app (double confirmation). Tant que la fonction n'existe pas en base, on retombe sur la demande par e-mail.
  const gerant = isPro && (profile.member_role || 'gerant') === 'gerant';
  const del = async () => {
    const what = !isPro ? t('Votre compte et vos accès seront supprimés. Les devis et factures restent chez vos artisans, qui doivent les conserver.')
      : gerant ? t('Votre compte sera supprimé et votre entreprise retirée d’Artis & You. Vos devis et factures sont conservés 10 ans (obligation légale) et restent consultables par vos clients. Exportez vos données avant.')
      : t('Votre compte et vos accès seront supprimés. Les données de l’entreprise restent chez votre employeur.');
    if (!(await confirm({ title: t('Supprimer mon compte ?'), text: what, ok: t('Continuer'), danger: true }))) return;
    if (!(await confirm({ title: t('Suppression définitive'), text: t('Cette action est immédiate et ne peut pas être annulée. Confirmez-vous la suppression du compte {e} ?', { e: profile.email }), ok: t('Supprimer définitivement'), danger: true }))) return;
    try {
      await api.rpc('delete_my_account');
    } catch (e) {
      if (/delete_my_account|PGRST202|Could not find|RPC inconnue/i.test(e.message || '')) {
        window.location.href = `mailto:support@artisandyou.fr?subject=${encodeURIComponent(t('Suppression de mon compte'))}&body=${encodeURIComponent(t('Bonjour, je souhaite supprimer mon compte Artis & You ({e}).', { e: profile.email }))}`;
      } else toast(e.message, true);
      return;
    }
    if (profile.avatar_path) await api.removeFile(profile.avatar_path).catch(() => {});
    await api.signOut().catch(() => {});
    location.href = '/';
  };
  return (
    <div className="content narrow">
      <TopBar title={t('Données et confidentialité')} />
      {!isPro && <><Sec title={t('Ce que voient les artisans')} /><KV rows={[[t('Nom'), fullName(profile)], [t('Téléphone'), profile.phone], [t('Adresse'), [profile.home?.address, profile.home?.city].filter(Boolean).join(', ')]]} /><p className="small muted">{t('Seulement les artisans à qui vous faites une demande.')}</p></>}
      {isPro && <><Sec title={t('Visibilité')} /><div className="kv"><Link className="r" to="/pro/compte/entreprise"><span className="k">{t('Profil public et visibilité')}</span><span className="v">›</span></Link></div></>}
      <Sec title={t('Vos choix')} />
      <div className="kv">
        <SettingToggle label={t('Aider à améliorer Artis & You')} hint={t('Partager des statistiques d’utilisation anonymes (pages consultées, erreurs). Aucune donnée client, devis ou facture n’est transmise.')} checked={pv.audience} onChange={(v) => set('audience', v)} />
        <SettingToggle label={t('Recevoir les nouveautés')} hint={t('Un e-mail de temps en temps sur les nouvelles fonctionnalités')} checked={pv.news} onChange={(v) => set('news', v)} />
      </div>
      <Sec title={t('Vos données')} />
      <div className="kv">
        <div className="r"><span className="k">{t('Hébergement')}</span><span className="v">{t('Union européenne (Paris)')}</span></div>
        <button className="r" style={{ width: '100%', border: 0, background: 'transparent', color: 'inherit' }} onClick={exportAll}><span className="k row"><LuDownload /> {t('Exporter toutes mes données (zip)')}</span><span className="v">›</span></button>
        <Link className="r" to="/cgu"><span className="k">{t('CGU')}</span><span className="v">›</span></Link>
        <Link className="r" to="/confidentialite"><span className="k">{t('Politique de confidentialité')}</span><span className="v">›</span></Link>
      </div>
      {OFFLINE && <>
        <Sec title={t('Sauvegarde de la base locale')} />
        <p className="small muted">{t('En mode local, toutes les données sont dans ce navigateur. Faites des sauvegardes régulières.')}</p>
        <div className="btns" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          <button className="btn ghost sm" onClick={() => run(async () => download(new Blob([await api.dump()], { type: 'application/json' }), `artis-and-you-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`), t('Sauvegarde téléchargée'))}><LuDownload /> {t('Sauvegarder')}</button>
          <button className="btn ghost sm" onClick={async () => { const [f] = await pickFiles({ accept: 'application/json', multiple: false }); if (!f) return; if (!(await confirm({ title: t('Restaurer cette sauvegarde ?'), text: t('Les données actuelles de ce navigateur seront remplacées.'), ok: t('Restaurer'), danger: true }))) return; await run(async () => { await api.restore(await f.text()); location.reload(); }); }}>{t('Restaurer')}</button>
        </div>
      </>}
      <div className="btns"><button className="btn light" onClick={del}><LuTrash2 /> {t('Supprimer mon compte')}</button></div>
    </div>
  );
}

export function Help() {
  const { isPro, wip, run, profile, setProfile } = useApp();
  const who = isPro ? 'pro' : 'client';
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [art, setArt] = useState(null);
  const [vote, setVote] = useState(() => { try { return JSON.parse(localStorage.getItem('ay-help-votes') || '{}'); } catch { return {}; } });
  const nz = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const all = HELP[who].map((a, i) => ({ i, cat: a[0], title: t(a[1]), sum: t(a[2]), steps: a[3].map((x) => t(x)), to: a[4], kw: a[5] || '', laws: a[6] || [] }));
  const words = nz(q).trim().split(/\s+/).filter(Boolean);
  const score = (a) => { const hay = nz([a.title, a.sum, a.steps.join(' '), a.kw, a.laws.join(' ')].join(' ')); const ti = nz(a.title + ' ' + a.kw); return words.every((w) => hay.includes(w)) ? words.reduce((s, w) => s + (ti.includes(w) ? 3 : 1), 0) : 0; };
  const list = words.length ? all.map((a) => [a, score(a)]).filter((x) => x[1]).sort((a, b) => b[1] - a[1]).map((x) => x[0]) : all.filter((a) => !cat || a.cat === cat);
  const cats = HELP_CATS[who];
  const setV = (i, v) => { const x = { ...vote, [who + i]: v }; setVote(x); try { localStorage.setItem('ay-help-votes', JSON.stringify(x)); } catch {} };
  const a = art != null ? all[art] : null;
  if (a) return (
    <div className="content narrow">
      <TopBar title={t('Aide et support')} sub={t(cats.find((c) => c[0] === a.cat)?.[1] || '')} />
      <button className="link bold mb" onClick={() => setArt(null)}>‹ {t('Retour aux articles')}</button>
      <h2 style={{ fontSize: 22, margin: '6px 0' }}>{a.title}</h2>
      <p className="muted">{a.sum}</p>
      <div className="steps" style={{ margin: '16px 0' }}>{a.steps.map((st, i) => <div key={i} className="step done"><div className="b">{i + 1}</div><div className="grow" style={{ paddingTop: 5 }}>{st}</div></div>)}</div>
      <LawRefs ids={a.laws} title={t('Textes de loi (touchez pour lire)')} />
      {a.to && <button className="btn block mt" onClick={() => navigate(a.to)}>{t('Y aller')} ›</button>}
      <div className="card soft center mt">
        {vote[who + a.i] ? <span className="small">{t('Merci pour votre retour !')}</span> : <><div className="small bold mb">{t('Cet article vous a-t-il aidé ?')}</div><div className="row" style={{ gap: 8, justifyContent: 'center' }}><button className="btn xs ghost" onClick={() => setV(a.i, 'oui')}>👍 {t('Oui')}</button><button className="btn xs ghost" onClick={() => setV(a.i, 'non')}>👎 {t('Non')}</button></div></>}
        {vote[who + a.i] === 'non' && <a className="small bold red-t" style={{ display: 'block', marginTop: 6 }} href={`mailto:support@artisandyou.fr?subject=${encodeURIComponent(t('Aide : {a}', { a: a.title }))}`}>{t('Écrire au support')}</a>}
      </div>
      {(() => { const rel = all.filter((x) => x.cat === a.cat && x.i !== a.i).slice(0, 3); return rel.length > 0 && <><Sec title={t('Articles liés')} /><div className="list">{rel.map((x) => <button key={x.i} className="li click" onClick={() => setArt(x.i)}><div className="grow"><div className="t1">{x.title}</div></div><span>›</span></button>)}</div></>; })()}
    </div>
  );
  return (
    <div className="content narrow">
      <TopBar title={t('Aide et support')} />
      <button className="btn ghost sm mb" onClick={async () => { await resetTours(profile, setProfile); navigate(isPro ? '/pro' : '/client'); }}>🎓 {t('Revoir le tutoriel')}</button>
      <SearchBar placeholder={t('Comment faire… (ex. relancer une facture, dimanche, logo)')} value={q} onChange={setQ} suggest={() => suggestList(list, { label: (x) => x.title, sub: (x) => x.sum, go: (x) => setArt(x.i) })} />
      {!words.length && <div className="help-cats">{cats.map(([k, l, e]) => <button key={k} className={'help-cat' + (cat === k ? ' on' : '')} onClick={() => setCat(cat === k ? '' : k)}><span>{e}</span>{t(l)}<small>{t('{n} articles', { n: all.filter((x) => x.cat === k).length })}</small></button>)}</div>}
      <Sec title={words.length ? (list.length > 1 ? t('{n} résultats', { n: list.length }) : t('{n} résultat', { n: list.length })) : cat ? t(cats.find((c) => c[0] === cat)[1]) : t('Tous les articles')} />
      {list.length ? <div className="list">{list.map((x) => <button key={x.i} className="li click" style={{ display: 'flex' }} onClick={() => setArt(x.i)}><div className="grow"><div className="small red-t bold">{t(cats.find((c) => c[0] === x.cat)?.[1] || '')}</div><div className="t1">{x.title}</div><div className="t2">{x.sum}</div></div><span>›</span></button>)}</div>
        : <Empty text={t('Aucun article ne correspond. Écrivez-nous, on vous répond rapidement.')} />}
      <Sec title={t('Nous contacter')} />
      <div className="list">
        <a className="li click" href="mailto:support@artisandyou.fr"><span className="ficon navy"><LuMail /></span><div className="grow"><div className="t1">{t('Écrire au support')}</div><div className="t2">support@artisandyou.fr · {t('réponse sous 24 h ouvrées')}</div></div></a>
        <button className="li click" onClick={() => run(async () => { const id = await api.rpc('support_conversation'); navigate((isPro ? '/pro' : '/client') + '/messages/' + id); })}><span className="ficon navy"><LuMessageSquare /></span><div className="grow t1">{t('Chat avec le support')}</div></button>
        <button className="li click" onClick={() => wip(t('La ligne téléphonique'))}><span className="ficon navy"><LuPhone /></span><div className="grow t1">{t('Appeler')}</div></button>
        <a className="li click" href={`mailto:support@artisandyou.fr?subject=${encodeURIComponent(t('Signaler un problème'))}&body=${encodeURIComponent('\n\n---\nVersion ' + APP_VERSION + ' · ' + navigator.userAgent)}`}><span className="ficon"><LuBug /></span><div className="grow t1">{t('Signaler un problème')}</div></a>
      </div>
      <Sec title={t('Informations')} />
      <div className="kv"><Link className="r" to="/mentions-legales"><span className="k">{t('Mentions légales')}</span><span className="v">›</span></Link><Link className="r" to="/cgu"><span className="k">{t('CGU')}</span><span className="v">›</span></Link><div className="r"><span className="k">{t('Version')}</span><span className="v">{APP_VERSION}</span></div></div>
    </div>
  );
}

export function NotFound() {
  return <div className="content"><TopBar title={t('Page introuvable')} /><Empty text={t('Cette page n’existe pas.')}><button className="btn sm" onClick={() => navigate('/')}>{t("Retour à l'accueil")}</button></Empty></div>;
}

// ─────────────── Administration Artis & You (vérification SIRET, avis) ───────────────
// Signalements de contenus (DSA art. 16-17) : décision motivée, envoyée à l'auteur du signalement
const REPORT_REASONS = { illicite: 'Contenu illicite', injure: 'Injure, menace, harcèlement', fraude: 'Arnaque ou fraude', vie_privee: 'Atteinte à la vie privée', droit_auteur: 'Droit d’auteur ou marque', faux_avis: 'Faux avis', autre: 'Autre' };
function AdminReports({ list, reload }) {
  const { run } = useApp();
  const [dec, setDec] = useState(null);
  if (!list.length) return <Empty text={t('Aucun signalement en attente')} />;
  return (
    <>
      {list.map((r) => (
        <div key={r.id} className="card soft mb">
          <div className="row between wrap"><b>{t(REPORT_REASONS[r.reason] || r.reason)}</b><Pill c="yellow">{r.target_type}</Pill></div>
          <p style={{ margin: '6px 0' }}>{r.explanation}</p>
          <div className="small muted">{[r.target_url && <a key="u" href={r.target_url} className="bold">{t('Voir le contenu')}</a>, r.reporter_name || r.reporter_email || t('Utilisateur connecté'), rel(r.created_at)].filter(Boolean).map((x, i) => <span key={i}>{i ? ' · ' : ''}{x}</span>)}</div>
          <div className="row wrap mt">
            <button className="btn xs" onClick={() => setDec({ r, status: 'retire', note: '' })}><LuCheck /> {t('Retirer le contenu')}</button>
            <button className="btn xs ghost" onClick={() => setDec({ r, status: 'rejete', note: '' })}><LuX /> {t('Maintenir')}</button>
          </div>
        </div>
      ))}
      <Sheet open={!!dec} onClose={() => setDec(null)} title={dec?.status === 'retire' ? t('Retirer le contenu') : t('Maintenir le contenu')}>
        {dec && <>
          <p className="small muted">{t('Expliquez la décision : les faits, la règle appliquée (loi ou CGU) et la possibilité de la contester. Pensez à retirer ou masquer vous-même le contenu concerné.')}</p>
          <Field label={t('Décision motivée (envoyée à l’auteur du signalement)')}><textarea value={dec.note} onChange={(e) => setDec({ ...dec, note: e.target.value })} /></Field>
          <button className="btn block" disabled={!dec.note.trim()} onClick={() => { run(() => api.rpc('admin_decide_report', { p_id: dec.r.id, p_status: dec.status, p_decision: dec.note.trim() }), t('Décision envoyée')).then(reload); setDec(null); }}>{t('Envoyer')}</button>
        </>}
      </Sheet>
    </>
  );
}

// Coffre-fort : chaque document déposé par un pro est vérifié avant d'être visible de ses clients
function AdminVault({ list, cm, reload }) {
  const { run } = useApp();
  const [refuse, setRefuse] = useState(null);
  const decide = (f, status, note = '') => run(() => api.rpc('admin_review_file', { p_id: f.id, p_status: status, p_note: note }), status === 'valide' ? t('Document validé') : t('Document refusé')).then(reload);
  if (!list.length) return <Empty text={t('Aucun document à vérifier')} />;
  return (
    <>
      {list.map((f) => {
        const co = cm[f.company_id] || {};
        const form = VAULT_FORM[f.doc_type] || {};
        return (
          <div key={f.id} className="card soft mb">
            <div className="row between wrap"><b>{co.trade_name || co.name}</b><Pill c="yellow">{docTypeLabel(f.doc_type, VAULT_TYPES)}</Pill></div>
            <div className="small">{f.name}</div>
            <div className="small muted">{[t(form.issued || 'Délivré le') + ' ' + (f.issued_at ? date(f.issued_at) : '—'), f.valid_until ? t('Valide jusqu’au {d}', { d: date(f.valid_until) }) : '', ...(form.fields || []).map(([k, l]) => f.meta?.[k] ? t(l) + ' : ' + f.meta[k] : '')].filter(Boolean).join(' · ')}</div>
            <div className="small muted">{['SIRET ' + (co.siret || '—'), co.insurer && f.doc_type === 'decennale' ? t('Assureur déclaré : {a}', { a: co.insurer }) : '', t('Déposé {d}', { d: rel(f.created_at) })].filter(Boolean).join(' · ')}</div>
            <div className="row wrap mt">
              <button className="btn xs ghost" onClick={() => openFile(f.path, f.name)}><LuDownload /> {t('Ouvrir')}</button>
              <button className="btn xs" onClick={() => decide(f, 'valide')}><LuCheck /> {t('Valider')}</button>
              <button className="btn xs ghost" onClick={() => setRefuse({ f, note: '' })}><LuX /> {t('Refuser')}</button>
            </div>
          </div>
        );
      })}
      <Sheet open={!!refuse} onClose={() => setRefuse(null)} title={t('Refuser le document')}>
        {refuse && <>
          <div className="chips mb">{[t('Document illisible'), t('Document expiré'), t('Ce n’est pas le bon document'), t('Le nom ou le SIRET ne correspond pas à l’entreprise')].map((x) => <button key={x} type="button" className="chip" onClick={() => setRefuse({ ...refuse, note: x })}>{x}</button>)}</div>
          <Field label={t('Motif (envoyé au pro)')}><textarea value={refuse.note} onChange={(e) => setRefuse({ ...refuse, note: e.target.value })} /></Field>
          <button className="btn block" disabled={!refuse.note.trim()} onClick={() => { decide(refuse.f, 'refuse', refuse.note.trim()); setRefuse(null); }}>{t('Envoyer')}</button></>}
      </Sheet>
    </>
  );
}

// Métiers proposés par les pros : corriger l'orthographe, fusionner avec un doublon, valider ou refuser
function AdminTrades({ list, cos, reload }) {
  const { run } = useApp();
  const cat = useTrades();
  const [edit, setEdit] = useState({});
  if (!list.length) return <Empty text={t('Aucun métier proposé')} />;
  const decide = (tr, action, name) => run(() => api.rpc('admin_review_trade', { p_id: tr.id, p_action: action, p_name: name || null, p_category: edit[tr.id]?.category || null }), action === 'refuse' ? t('Métier refusé') : t('Métier validé')).then(() => { loadTrades(true); reload(); });
  return list.map((tr) => {
    const e = edit[tr.id] || { name: tr.name, category: tr.category };
    const set = (patch) => setEdit({ ...edit, [tr.id]: { ...e, ...patch } });
    const near = similarTrades(e.name, cat.all.filter((x) => x !== tr.name));
    const users = cos.filter((c) => (c.trades || []).includes(tr.name));
    return (
      <div key={tr.id} className="card soft mb">
        <div className="row between wrap"><b>{tr.name}</b><span className="small muted">{t('Proposé {d}', { d: rel(tr.created_at) })} · {t('{n} entreprise(s)', { n: users.length })}{users.length ? ' : ' + users.map((c) => c.trade_name || c.name).join(', ') : ''}</span></div>
        <div className="form-grid two mt">
          <Field label={t('Nom corrigé')}><input value={e.name} onChange={(ev) => set({ name: ev.target.value })} /></Field>
          <Field label={t('Catégorie')}><select value={e.category} onChange={(ev) => set({ category: ev.target.value })}>{[...Object.keys(cat.groups), 'Autres métiers'].filter((x, i, a) => a.indexOf(x) === i).map((c) => <option key={c} value={c}>{t(c)}</option>)}</select></Field>
        </div>
        {near.length > 0 && <div className="notice small"><b>{t('Doublon possible :')}</b> {near.map((x) => <button key={x} type="button" className="chip" style={{ marginLeft: 6 }} onClick={() => decide(tr, 'valide', x)} title={t('Fusionner dans « {n} »', { n: x })}>{t('Fusionner dans « {n} »', { n: x })}</button>)}</div>}
        <div className="row wrap mt">
          <button className="btn xs" onClick={() => decide(tr, 'valide', e.name)}><LuCheck /> {e.name !== tr.name ? t('Corriger et valider') : t('Valider')}</button>
          <button className="btn xs ghost" onClick={() => decide(tr, 'refuse')}><LuX /> {t('Refuser')}</button>
        </div>
      </div>
    );
  });
}

// Modération a posteriori des photos (avis et suivi de chantier) : l'équipe peut retirer une photo inappropriée
function AdminPhotos() {
  const { run, confirm } = useApp();
  const [list, reload] = useData(() => api.rpc('admin_recent_photos', { p_limit: 120 }).then((l) => l || []), []);
  const [big, setBig] = useState(null);
  if (!list) return <Loader />;
  if (!list.length) return <Empty text={t('Aucune photo publiée pour le moment')} />;
  const remove = async (p) => { if (!(await confirm({ title: t('Retirer cette photo ?'), text: t('Elle disparaîtra de l’avis ou du suivi de chantier. L’artisan et le client ne sont pas prévenus automatiquement.'), ok: t('Retirer'), danger: true }))) return; await run(() => api.rpc('admin_remove_photo', { p_kind: p.kind, p_ref: p.ref, p_path: p.path }), t('Photo retirée')); reload(); };
  return (
    <>
      <p className="small muted">{t('Les {n} dernières photos ajoutées aux avis et aux suivis de chantier.', { n: list.length })}</p>
      <div className="mod-grid">{list.map((p) => (
        <div key={p.kind + p.path} className="mod-card">
          <Img path={p.path} alt="" onClick={() => setBig(p.path)} />
          <div className="small"><b>{p.company}</b> · {p.kind === 'avis' ? t('Avis') : t('Chantier')}</div>
          <div className="small faint">{p.title || '—'} · {dateTime(p.created_at)}</div>
          <button className="btn xs light" onClick={() => remove(p)}>{t('Retirer')}</button>
        </div>
      ))}</div>
      <Lightbox path={big} onClose={() => setBig(null)} />
    </>
  );
}

// Erreurs remontées par les navigateurs (regroupées par message et page)
function AdminErrors() {
  const { run } = useApp();
  const [all, setAll] = useState(false);
  const [list, reload] = useData(() => api.select('app_errors', all ? {} : { resolved: false }, { order: 'last_at.desc', limit: 200 }).catch(() => []), [all]);
  const [open, setOpen] = useState(null);
  if (!list) return <Loader />;
  return (
    <>
      <div className="row between mb"><span className="small muted">{t('{n} erreurs', { n: list.length })}</span><label className="check small"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> {t('Afficher aussi les erreurs réglées')}</label></div>
      {!list.length ? <Empty text={t('Aucune erreur signalée')} /> : list.map((e) => (
        <div key={e.id} className={'card soft mb' + (e.resolved ? ' faded' : '')}>
          <div className="row between"><b className="err-msg">{e.message}</b><Pill c={e.count > 20 ? 'red' : 'grey'}>×{e.count}</Pill></div>
          <div className="small faint">{e.path || '/'} · {t('dernière fois {d}', { d: dateTime(e.last_at) })}</div>
          {open === e.id && <pre className="err-stack">{e.stack || '—'}{'\n\n'}{e.agent}</pre>}
          <div className="row mt" style={{ gap: 6 }}>
            <button className="btn xs ghost" onClick={() => setOpen(open === e.id ? null : e.id)}>{open === e.id ? t('Masquer le détail') : t('Voir le détail')}</button>
            {!e.resolved && <button className="btn xs" onClick={() => run(() => api.update('app_errors', { id: e.id }, { resolved: true }), t('Marquée comme réglée')).then(reload)}><LuCheck /> {t('Réglée')}</button>}
          </div>
        </div>
      ))}
    </>
  );
}

export function Admin({ params }) {
  const { run, profile } = useApp();
  const [tab, setTab] = useState(() => params?.tab || new URLSearchParams(location.search).get('tab') || 'siret');
  const [refuse, setRefuse] = useState(null);
  const [revRefuse, setRevRefuse] = useState(null);
  const [b, reload] = useData(async () => {
    if (!profile.is_admin) return null;
    const [cos, revs, vault, trades, reports, idc] = await Promise.all([
      api.select('companies', {}, { order: 'created_at.desc', limit: 300 }).then((l) => l.filter((c) => !c.is_platform)),
      api.select('reviews', { status: 'en_attente' }, { order: 'created_at.asc' }),
      api.select('files', { kind: 'vault', review_status: 'en_attente' }, { order: 'created_at.asc' }),
      api.select('trades', { status: 'en_attente' }, { order: 'created_at.asc' }),
      api.select('content_reports', { status: 'recu' }, { order: 'created_at.asc' }).catch(() => []),
      api.select('identity_checks', {}, { order: 'created_at.asc' }).catch(() => []),
    ]);
    const coById = Object.fromEntries(cos.map((c) => [c.id, c]));
    const ids = idc.filter((r) => r.status === 'en_attente').map((r) => ({ ...r, company_name: coById[r.company_id]?.name, siren: coById[r.company_id]?.siren }));
    const idLeft = idc.filter((r) => r.status !== 'en_attente' && r.file_path);
    return { ids, idLeft, cos, revs, vault, trades, reports, cm: Object.fromEntries(cos.map((c) => [c.id, c])) };
  }, []);
  if (!profile.is_admin) return <div className="content"><TopBar title={t('Administration')} /><Empty text={t('Réservé à l’équipe Artis & You.')} /></div>;
  if (!b) return <div className="content"><TopBar title={t('Administration')} /><Loader /></div>;
  const st = (c) => c.verification_status || (c.verified ? 'approved' : 'pending');
  const pending = b.cos.filter((c) => st(c) === 'pending');
  const review = (c, status, note = '') => run(() => api.rpc('admin_review_company', { p_id: c.id, p_status: status, p_note: note }), status === 'approved' ? t('Entreprise validée') : t('Demande de compléments envoyée')).then(reload);
  const missing = (c) => companyMissing(c).map(([, l]) => t(l));
  return (
    <div className="content">
      <TopBar title={t('Administration')} sub="Artis & You" />
      <Chips options={[['siret', t('Entreprises à valider ({n})', { n: pending.length })], ['all', t('Toutes les entreprises ({n})', { n: b.cos.length })], ['avis', t('Avis à relire ({n})', { n: b.revs.length })], ['coffre', t('Documents à vérifier ({n})', { n: b.vault.length })], ['metiers', t('Métiers proposés ({n})', { n: b.trades.length })], ['signal', t('Signalements ({n})', { n: b.reports.length })], ['identite', t('Identités ({n})', { n: b.ids.length })], ['photos', t('Photos publiées')], ['erreurs', t('Erreurs de l’app')]]} value={tab} onChange={setTab} />
      {tab === 'photos' ? <AdminPhotos /> : tab === 'erreurs' ? <AdminErrors /> : tab === 'identite' ? <AdminIdentities list={b.ids} leftovers={b.idLeft} reload={reload} /> : tab === 'signal' ? <AdminReports list={b.reports} cm={b.cm} reload={reload} /> : tab === 'coffre' ? <AdminVault list={b.vault} cm={b.cm} reload={reload} /> : tab === 'metiers' ? <AdminTrades list={b.trades} cos={b.cos} reload={reload} /> : tab === 'avis' ? (!b.revs.length ? <Empty text={t('Aucun avis en attente')} /> : b.revs.map((r) => (
        <div key={r.id} className="card soft mb"><div className="row between"><b>{b.cm[r.company_id]?.name}</b><Stars n={r.rating} /></div><p>{r.comment}</p>{r.criteria && <div className="small muted">{Object.entries(r.criteria).map(([k, v]) => t({ ponctualite: 'Ponctualité', proprete: 'Propreté', devis: 'Respect du devis', prix: 'Rapport qualité-prix' }[k] || k) + ' ' + v + '/5').join(' · ')}</div>}{(r.photos || []).length > 0 && <div className="photos-grid sm">{r.photos.map((ph) => <Img key={ph} path={ph} />)}</div>}<div className="small muted">{r.author_label} · {date(r.created_at)}</div>
          <div className="row mt"><button className="btn xs" onClick={() => run(() => api.rpc('admin_moderate_review', { p_id: r.id, p_status: 'publie', p_reason: '' }), t('Avis publié')).then(reload)}><LuCheck /> {t('Publier')}</button><button className="btn xs ghost" onClick={() => setRevRefuse({ r, note: '' })}><LuX /> {t('Refuser')}</button></div></div>
      ))) : (
        (tab === 'siret' ? pending : b.cos).length === 0 ? <Empty text={t('Aucune entreprise en attente')} /> : (tab === 'siret' ? pending : b.cos).map((c) => {
          const m = missing(c);
          return (
            <div key={c.id} className="card soft mb">
              <div className="row between wrap"><b style={{ fontSize: 17 }}>{c.name}</b><Pill c={st(c) === 'approved' ? 'green' : st(c) === 'rejected' ? 'red' : 'yellow'}>{t({ approved: 'Validée', rejected: 'À compléter', pending: 'En attente' }[st(c)])}</Pill></div>
              <div className="small muted">{[c.legal_form, 'SIRET ' + c.siret, [c.address, c.zip, c.city].filter(Boolean).join(' '), c.phone, c.email].filter(Boolean).join(' · ')}</div>
              <div className="small">{(c.trades || []).map(t).join(', ')} · {t('Inscrite le {d}', { d: date(c.created_at) })}</div>
              {m.length > 0 && <div className="small red-t bold mt">{t('Manquant : {l}', { l: m.join(', ') })}</div>}
              {c.verification_note && <div className="small mt">{t('Note')} : {c.verification_note}</div>}
              <div className="row wrap mt">
                <a className="btn xs ghost" href={'https://annuaire-entreprises.data.gouv.fr/etablissement/' + (c.siret || '').replace(/\D/g, '')} target="_blank" rel="noreferrer">{t('Vérifier le SIRET')} ↗</a>
                {st(c) !== 'approved' && <button className="btn xs" onClick={() => review(c, 'approved')}><LuCheck /> {t('Approuver')}</button>}
                {st(c) !== 'rejected' && <button className="btn xs ghost" onClick={() => setRefuse({ c, note: m.length ? t('Merci de compléter : {l}.', { l: m.join(', ') }) : '' })}><LuX /> {t('Demander des compléments')}</button>}
              </div>
            </div>
          );
        })
      )}
      <Sheet open={!!revRefuse} onClose={() => setRevRefuse(null)} title={t('Refuser l’avis')}>
        {revRefuse && <>
          <div className="chips wrap mb" style={{ gap: 6 }}>{[t('Propos injurieux ou diffamatoires'), t('Hors sujet : ne concerne pas la prestation'), t('Contient des données personnelles'), t('Conflit d’intérêts'), t('Contenu illicite')].map((x) => <button key={x} type="button" className="chip" onClick={() => setRevRefuse({ ...revRefuse, note: x })}>{x}</button>)}</div>
          <Field label={t('Motif (envoyé à l’auteur)')}><textarea value={revRefuse.note} onChange={(e) => setRevRefuse({ ...revRefuse, note: e.target.value })} /></Field>
          <button className="btn block" disabled={!revRefuse.note.trim()} onClick={() => { run(() => api.rpc('admin_moderate_review', { p_id: revRefuse.r.id, p_status: 'refuse', p_reason: revRefuse.note.trim() }), t('Avis refusé, l’auteur est informé du motif')).then(reload); setRevRefuse(null); }}>{t('Envoyer')}</button></>}
      </Sheet>
      <Sheet open={!!refuse} onClose={() => setRefuse(null)} title={t('Demander des compléments')}>
        {refuse && <><Field label={t('Message à l’entreprise')}><textarea value={refuse.note} onChange={(e) => setRefuse({ ...refuse, note: e.target.value })} /></Field>
          <button className="btn block" onClick={() => { review(refuse.c, 'rejected', refuse.note); setRefuse(null); }}>{t('Envoyer')}</button></>}
      </Sheet>
    </div>
  );
}
