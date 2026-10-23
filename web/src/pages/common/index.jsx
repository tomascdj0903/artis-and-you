import { useState } from 'react';
import { LuBell, LuCalendar, LuFileText, LuEuro, LuMessageSquare, LuInfo, LuSearch, LuMail, LuPhone, LuCirclePlay, LuBug, LuDownload, LuTrash2, LuMoon, LuSun, LuShieldCheck, LuCheck, LuX } from 'react-icons/lu';
import JSZip from 'jszip';
import { api, uid, APP_VERSION, OFFLINE } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { navigate, Link } from '../../lib/router.jsx';
import { t, LANGS } from '../../lib/i18n.js';
import { rel, dateMed, fullName, date } from '../../lib/format.js';
import { download } from '../../lib/xlsx.js';
import { TopBar, SearchBar, Sec, Chips, Field, Toggle, useData, Loader, Empty, Avatar, pickFiles, Stars, Pill, KV } from '../../ui/index.jsx';
import { uploadTo } from './chat.jsx';

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
      <TopBar title={t('Notifications')} back={isPro} right={list.some((n) => !n.read) && <button className="btn xs ghost" onClick={readAll}>{t('Tout lire')}</button>} />
      <SearchBar placeholder={isPro ? t('Rechercher') : t('Recherchez un pro')} value={q} onChange={setQ} />
      <Chips options={[['', t('Toutes')], ['rdv', t('RDV et chantier')], ['documents', t('Documents')], ['paiement', t('Paiement')]]} value={f} onChange={setF} />
      {!shown.length ? <Empty icon={LuBell} text={t('Aucune notification')} /> : shown.map((n) => {
        const day = n.created_at.slice(0, 10); const show = day !== last; last = day; const I = NICON[n.category] || LuBell;
        return (
          <div key={n.id}>
            {show && <div className="small bold muted" style={{ margin: '14px 0 6px' }}>{dateMed(day)}</div>}
            <button className="card row" style={{ width: '100%', textAlign: 'left', marginBottom: 10, background: 'var(--surface)', color: 'inherit', borderWidth: n.read ? 1 : 2, borderColor: n.read ? 'var(--line)' : 'var(--bordeaux)' }} onClick={() => open(n)}>
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
  const { profile, setProfile, run, wip, reload } = useApp();
  const [p, setP] = useState(profile);
  const [pw, setPw] = useState('');
  const photo = async () => { const [f] = await pickFiles({ accept: 'image/*', multiple: false }); if (!f) return; await run(async () => { const up = await uploadTo((profile.company_id || 'u/' + profile.id) + '/avatars', f); setP({ ...p, avatar_path: up.path }); await api.update('profiles', { id: profile.id }, { avatar_path: up.path }); setProfile({ ...profile, avatar_path: up.path }); }, t('Photo enregistrée')); };
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
        <Field label={t('Prénom')}><input value={p.first_name} onChange={(e) => setP({ ...p, first_name: e.target.value })} /></Field>
        <Field label={t('Nom')}><input value={p.last_name} onChange={(e) => setP({ ...p, last_name: e.target.value })} /></Field>
        <Field label={t('E-mail')}><input type="email" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} /></Field>
        <Field label={t('Téléphone')}><input type="tel" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} /></Field>
      </div>
      {profile.kind === 'artisan' && <KV rows={[[t('Rôle'), t({ gerant: 'Gérant', chef: "Chef d'équipe", ouvrier: 'Ouvrier' }[profile.member_role]) + ' · ' + t('modifiable dans Mon équipe')]]} />}
      <Sec title={t('Sécurité')} />
      <Field label={t('Nouveau mot de passe')} hint={t('laisser vide pour ne pas changer')}><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} autoComplete="new-password" /></Field>
      <div className="kv">
        <div className="r"><span className="k">Face ID / {t('empreinte')}</span><Toggle checked={false} onChange={() => wip('Face ID')} /></div>
        <div className="r"><span className="k">{t('Double authentification')}</span><Toggle checked={false} onChange={() => wip(t('La double authentification'))} /></div>
      </div>
      <div className="btns"><button className="btn" onClick={save}>{t('Enregistrer')}</button></div>
    </div>
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
  const { profile, company, isPro, run, confirm, setProfile } = useApp();
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
  const del = async () => {
    if (!(await confirm({ title: t('Supprimer mon compte ?'), text: t('Votre demande sera traitée sous 30 jours. Les factures émises restent conservées 10 ans (obligation légale).'), ok: t('Demander la suppression'), danger: true }))) return;
    window.location.href = `mailto:support@artisandyou.fr?subject=${encodeURIComponent(t('Suppression de mon compte'))}&body=${encodeURIComponent(t('Bonjour, je souhaite supprimer mon compte Artis & You ({e}).', { e: profile.email }))}`;
  };
  return (
    <div className="content narrow">
      <TopBar title={t('Données et confidentialité')} />
      {!isPro && <><Sec title={t('Ce que voient les artisans')} /><KV rows={[[t('Nom'), fullName(profile)], [t('Téléphone'), profile.phone], [t('Adresse'), [profile.home?.address, profile.home?.city].filter(Boolean).join(', ')]]} /><p className="small muted">{t('Seulement les artisans à qui vous faites une demande.')}</p></>}
      {isPro && <><Sec title={t('Visibilité')} /><div className="kv"><Link className="r" to="/pro/compte/entreprise"><span className="k">{t('Profil public et visibilité')}</span><span className="v">›</span></Link></div></>}
      <Sec title={t('Vos choix')} />
      <div className="kv">
        <div className="r"><span className="k">{t("Mesure d'audience anonyme")}</span><Toggle checked={pv.audience} onChange={(v) => set('audience', v)} /></div>
        <div className="r"><span className="k">{t('Recevoir les nouveautés')}</span><Toggle checked={pv.news} onChange={(v) => set('news', v)} /></div>
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

const FAQ = {
  pro: [
    ['Devis et factures', 'Comment transformer un devis en facture ?', 'Ouvrez le devis signé puis touchez « Transformer en facture ». Les acomptes déjà facturés sont déduits automatiquement.'],
    ['Devis et factures', 'Puis-je modifier une facture envoyée ?', 'Non : une facture émise est figée (obligation légale). Créez un avoir depuis la facture, puis une nouvelle facture.'],
    ['Devis et factures', 'Comment gérer la TVA à 5,5 % ou 10 % ?', 'Chaque ligne a son propre taux. Le PDF détaille la TVA par taux. Pour la micro-entreprise, choisissez la franchise en base dans Mon entreprise.'],
    ['Planning', 'Comment mes clients prennent-ils rendez-vous ?', 'Ils voient vos créneaux libres (Réglages du planning → plages disponibles) et envoient une demande que vous validez.'],
    ['Équipe', 'Comment ajouter un ouvrier ?', 'Paramètres → Mon équipe → Inviter un membre : un code est généré, il l’utilise à l’inscription.'],
    ['Comptabilité', 'Que contient l’export comptable ?', 'Un fichier Excel avec 4 onglets (ventes, encaissements, achats, TVA) et le FEC pour votre comptable.'],
  ],
  client: [
    ['Rendez-vous', 'Comment prendre rendez-vous ?', 'Cherchez un artisan, ouvrez sa fiche, touchez « Demander un RDV », décrivez votre besoin et choisissez un créneau.'],
    ['Documents', 'Où sont mes devis et factures ?', 'Onglet Documents : devis, factures, suivi de chantier et attestations.'],
    ['Avis', 'Quand puis-je donner un avis ?', 'Après un vrai rendez-vous avec l’artisan. Les avis sont relus avant publication.'],
    ['Compte', 'Mes données sont-elles partagées ?', 'Seulement avec les artisans à qui vous faites une demande : nom, téléphone, adresse.'],
  ],
};
export function Help() {
  const { isPro, wip } = useApp();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const list = FAQ[isPro ? 'pro' : 'client'].filter((f) => !q || (t(f[1]) + ' ' + t(f[2])).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="content narrow">
      <TopBar title={t('Aide et support')} />
      <SearchBar placeholder={t("Rechercher dans l'aide")} value={q} onChange={setQ} />
      <Sec title={t('Questions fréquentes')} />
      <div className="list">{list.map((f, i) => <button key={i} className="li click" style={{ display: 'block' }} onClick={() => setOpen(open === i ? null : i)}><div className="small red-t bold">{t(f[0])}</div><div className="t1">{t(f[1])}</div>{open === i && <p className="muted" style={{ margin: '8px 0 0' }}>{t(f[2])}</p>}</button>)}</div>
      <Sec title={t('Nous contacter')} />
      <div className="list">
        <a className="li click" href="mailto:support@artisandyou.fr"><span className="ficon navy"><LuMail /></span><div className="grow"><div className="t1">{t('Écrire au support')}</div><div className="t2">support@artisandyou.fr</div></div></a>
        <button className="li click" onClick={() => wip(t('Le chat avec le support'))}><span className="ficon navy"><LuMessageSquare /></span><div className="grow t1">{t('Chat avec le support')}</div></button>
        <button className="li click" onClick={() => wip(t('La ligne téléphonique'))}><span className="ficon navy"><LuPhone /></span><div className="grow t1">{t('Appeler')}</div></button>
        {isPro && <button className="li click" onClick={() => wip(t('Les tutoriels vidéo'))}><span className="ficon navy"><LuCirclePlay /></span><div className="grow t1">{t('Visite guidée et tutoriels vidéo')}</div></button>}
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
export function Admin() {
  const { run } = useApp();
  const [tab, setTab] = useState('avis');
  const [b, reload] = useData(async () => {
    const [cos, revs] = await Promise.all([api.select('companies', {}, { order: 'created_at.desc', limit: 200 }), api.select('reviews', { status: 'en_attente' }, { order: 'created_at.asc' })]);
    return { cos, revs, cm: Object.fromEntries(cos.map((c) => [c.id, c])) };
  }, []);
  if (!b) return <div className="content"><TopBar title={t('Administration')} /><Loader /></div>;
  return (
    <div className="content">
      <TopBar title={t('Administration')} sub="Artis & You" />
      <Chips options={[['avis', t('Avis à relire ({n})', { n: b.revs.length })], ['siret', t('Entreprises ({n})', { n: b.cos.length })]]} value={tab} onChange={setTab} />
      {tab === 'avis' ? (!b.revs.length ? <Empty text={t('Aucun avis en attente')} /> : b.revs.map((r) => (
        <div key={r.id} className="card soft mb"><div className="row between"><b>{b.cm[r.company_id]?.name}</b><Stars n={r.rating} /></div><p>{r.comment}</p><div className="small muted">{r.author_label} · {date(r.created_at)}</div>
          <div className="row mt"><button className="btn xs" onClick={() => run(() => api.update('reviews', { id: r.id }, { status: 'publie' }), t('Avis publié')).then(reload)}><LuCheck /> {t('Publier')}</button><button className="btn xs ghost" onClick={() => run(() => api.update('reviews', { id: r.id }, { status: 'refuse' }), t('Avis refusé')).then(reload)}><LuX /> {t('Refuser')}</button></div></div>
      ))) : (
        <div className="list">{b.cos.map((c) => (
          <div key={c.id} className="li"><div className="grow"><div className="t1">{c.name} {c.verified && <Pill c="green">{t('Vérifiée')}</Pill>}</div><div className="t2">SIRET {c.siret} · {c.city} · {date(c.created_at)}</div>
            <a className="small red-t bold" href={'https://annuaire-entreprises.data.gouv.fr/etablissement/' + (c.siret || '').replace(/\D/g, '')} target="_blank" rel="noreferrer">{t('Vérifier sur l’annuaire des entreprises')} ↗</a></div>
            <Toggle checked={c.verified} onChange={(v) => run(() => api.update('companies', { id: c.id }, { verified: v })).then(reload)} label={t('Vérifiée')} /></div>
        ))}</div>
      )}
    </div>
  );
}
