import { useEffect, useState } from 'react';
import { companyMissing } from '../../lib/docs.js';
import { HELP, HELP_CATS } from '../../lib/help.js';
import { bioAvailable, bioEnabled, bioEnable, bioDisable, groupSecret } from '../../lib/security.js';
import { LuBell, LuCalendar, LuFileText, LuEuro, LuMessageSquare, LuInfo, LuMail, LuPhone, LuBug, LuDownload, LuTrash2, LuMoon, LuSun, LuCheck, LuX } from 'react-icons/lu';
import JSZip from 'jszip';
import { api, uid, APP_VERSION, OFFLINE } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { navigate, Link } from '../../lib/router.jsx';
import { resetTours } from '../../ui/tour.jsx';
import { t, LANGS } from '../../lib/i18n.js';
import { rel, dateMed, fullName, date } from '../../lib/format.js';
import { download } from '../../lib/xlsx.js';
import { TopBar, SearchBar, Sec, Chips, Field, Toggle, SettingToggle, useData, Loader, Empty, Avatar, pickFiles, Stars, Pill, KV, Sheet } from '../../ui/index.jsx';
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
      <SearchBar placeholder={isPro ? t('Rechercher') : t('Recherchez un pro')} value={q} onChange={setQ} />
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
    download(await zip.generateAsync({ type: 'blob' }), `artis-and-you-mes-donnees-${new Date().toISOString().slice(0, 10)}.zip`);
  }, t('Export téléchargé'));
  // Suppression du compte depuis l'app (double confirmation). Tant que la fonction n'existe pas en base, on retombe sur la demande par e-mail.
  const gerant = isPro && (profile.member_role || 'gerant') === 'gerant';
  const del = async () => {
    const what = !isPro ? t('Votre compte et vos accès seront supprimés. Les devis et factures restent chez vos artisans, qui doivent les conserver.')
      : gerant ? t('Votre compte sera supprimé et votre entreprise retirée d’Artesa. Vos devis et factures sont conservés 10 ans (obligation légale) et restent consultables par vos clients. Exportez vos données avant.')
      : t('Votre compte et vos accès seront supprimés. Les données de l’entreprise restent chez votre employeur.');
    if (!(await confirm({ title: t('Supprimer mon compte ?'), text: what, ok: t('Continuer'), danger: true }))) return;
    if (!(await confirm({ title: t('Suppression définitive'), text: t('Cette action est immédiate et ne peut pas être annulée. Confirmez-vous la suppression du compte {e} ?', { e: profile.email }), ok: t('Supprimer définitivement'), danger: true }))) return;
    try {
      await api.rpc('delete_my_account');
    } catch (e) {
      if (/delete_my_account|PGRST202|Could not find|RPC inconnue/i.test(e.message || '')) {
        window.location.href = `mailto:support@artisandyou.fr?subject=${encodeURIComponent(t('Suppression de mon compte'))}&body=${encodeURIComponent(t('Bonjour, je souhaite supprimer mon compte Artesa ({e}).', { e: profile.email }))}`;
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
        <SettingToggle label={t('Aider à améliorer Artesa')} hint={t('Partager des statistiques d’utilisation anonymes (pages consultées, erreurs). Aucune donnée client, devis ou facture n’est transmise.')} checked={pv.audience} onChange={(v) => set('audience', v)} />
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
  const { isPro, wip, profile, setProfile } = useApp();
  const who = isPro ? 'pro' : 'client';
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [art, setArt] = useState(null);
  const [vote, setVote] = useState(() => { try { return JSON.parse(localStorage.getItem('ay-help-votes') || '{}'); } catch { return {}; } });
  const nz = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const all = HELP[who].map((a, i) => ({ i, cat: a[0], title: t(a[1]), sum: t(a[2]), steps: a[3].map((x) => t(x)), to: a[4], kw: a[5] || '' }));
  const words = nz(q).trim().split(/\s+/).filter(Boolean);
  const score = (a) => { const hay = nz([a.title, a.sum, a.steps.join(' '), a.kw].join(' ')); const ti = nz(a.title + ' ' + a.kw); return words.every((w) => hay.includes(w)) ? words.reduce((s, w) => s + (ti.includes(w) ? 3 : 1), 0) : 0; };
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
      {a.to && <button className="btn block" onClick={() => navigate(a.to)}>{t('Y aller')} ›</button>}
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
      <SearchBar placeholder={t('Comment faire… (ex. relancer une facture, dimanche, logo)')} value={q} onChange={setQ} />
      {!words.length && <div className="help-cats">{cats.map(([k, l, e]) => <button key={k} className={'help-cat' + (cat === k ? ' on' : '')} onClick={() => setCat(cat === k ? '' : k)}><span>{e}</span>{t(l)}<small>{t('{n} articles', { n: all.filter((x) => x.cat === k).length })}</small></button>)}</div>}
      <Sec title={words.length ? (list.length > 1 ? t('{n} résultats', { n: list.length }) : t('{n} résultat', { n: list.length })) : cat ? t(cats.find((c) => c[0] === cat)[1]) : t('Tous les articles')} />
      {list.length ? <div className="list">{list.map((x) => <button key={x.i} className="li click" style={{ display: 'flex' }} onClick={() => setArt(x.i)}><div className="grow"><div className="small red-t bold">{t(cats.find((c) => c[0] === x.cat)?.[1] || '')}</div><div className="t1">{x.title}</div><div className="t2">{x.sum}</div></div><span>›</span></button>)}</div>
        : <Empty text={t('Aucun article ne correspond. Écrivez-nous, on vous répond rapidement.')} />}
      <Sec title={t('Nous contacter')} />
      <div className="list">
        <a className="li click" href="mailto:support@artisandyou.fr"><span className="ficon navy"><LuMail /></span><div className="grow"><div className="t1">{t('Écrire au support')}</div><div className="t2">support@artisandyou.fr · {t('réponse sous 24 h ouvrées')}</div></div></a>
        <button className="li click" onClick={() => wip(t('Le chat avec le support'))}><span className="ficon navy"><LuMessageSquare /></span><div className="grow t1">{t('Chat avec le support')}</div></button>
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

// ─────────────── Administration Artesa (vérification SIRET, avis) ───────────────
export function Admin() {
  const { run, profile } = useApp();
  const [tab, setTab] = useState('siret');
  const [refuse, setRefuse] = useState(null);
  const [b, reload] = useData(async () => {
    if (!profile.is_admin) return null;
    const [cos, revs] = await Promise.all([api.select('companies', {}, { order: 'created_at.desc', limit: 300 }), api.select('reviews', { status: 'en_attente' }, { order: 'created_at.asc' })]);
    return { cos, revs, cm: Object.fromEntries(cos.map((c) => [c.id, c])) };
  }, []);
  if (!profile.is_admin) return <div className="content"><TopBar title={t('Administration')} /><Empty text={t('Réservé à l’équipe Artesa.')} /></div>;
  if (!b) return <div className="content"><TopBar title={t('Administration')} /><Loader /></div>;
  const st = (c) => c.verification_status || (c.verified ? 'approved' : 'pending');
  const pending = b.cos.filter((c) => st(c) === 'pending');
  const review = (c, status, note = '') => run(() => api.rpc('admin_review_company', { p_id: c.id, p_status: status, p_note: note }), status === 'approved' ? t('Entreprise validée') : t('Demande de compléments envoyée')).then(reload);
  const missing = (c) => companyMissing(c).map(([, l]) => t(l));
  return (
    <div className="content">
      <TopBar title={t('Administration')} sub="Artesa" />
      <Chips options={[['siret', t('Entreprises à valider ({n})', { n: pending.length })], ['all', t('Toutes les entreprises ({n})', { n: b.cos.length })], ['avis', t('Avis à relire ({n})', { n: b.revs.length })]]} value={tab} onChange={setTab} />
      {tab === 'avis' ? (!b.revs.length ? <Empty text={t('Aucun avis en attente')} /> : b.revs.map((r) => (
        <div key={r.id} className="card soft mb"><div className="row between"><b>{b.cm[r.company_id]?.name}</b><Stars n={r.rating} /></div><p>{r.comment}</p><div className="small muted">{r.author_label} · {date(r.created_at)}</div>
          <div className="row mt"><button className="btn xs" onClick={() => run(() => api.update('reviews', { id: r.id }, { status: 'publie' }), t('Avis publié')).then(reload)}><LuCheck /> {t('Publier')}</button><button className="btn xs ghost" onClick={() => run(() => api.update('reviews', { id: r.id }, { status: 'refuse' }), t('Avis refusé')).then(reload)}><LuX /> {t('Refuser')}</button></div></div>
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
      <Sheet open={!!refuse} onClose={() => setRefuse(null)} title={t('Demander des compléments')}>
        {refuse && <><Field label={t('Message à l’entreprise')}><textarea value={refuse.note} onChange={(e) => setRefuse({ ...refuse, note: e.target.value })} /></Field>
          <button className="btn block" onClick={() => { review(refuse.c, 'rejected', refuse.note); setRefuse(null); }}>{t('Envoyer')}</button></>}
      </Sheet>
    </div>
  );
}
