import { useState } from 'react';
import { LuUser, LuCreditCard, LuBuilding2, LuUsers, LuFileText, LuBell, LuPlug, LuShield, LuCircleHelp, LuLogOut, LuChevronRight, LuPalette, LuStar, LuCopy, LuPlus, LuImage, LuCheck, LuShieldCheck, LuDownload } from 'react-icons/lu';
import { api, OFFLINE } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { navigate, Link } from '../../lib/router.jsx';
import { t } from '../../lib/i18n.js';
import { date, fullName, initials, money } from '../../lib/format.js';
import { PLANS, TRADES, kindLabel } from '../../lib/docs.js';
import { TopBar, Sec, KV, Field, Chips, Toggle, Sheet, useData, Loader, Empty, Avatar, Pill, Stars, pickFiles, Img } from '../../ui/index.jsx';
import { A4 } from '../common/docview.jsx';
import { uploadTo } from '../common/chat.jsx';

export function MenuRow({ to, icon: I, label, sub, onClick, red }) {
  const C = to ? Link : 'button';
  return <C to={to} onClick={onClick} className="li click" style={{ width: '100%' }}><span className={'ficon' + (red ? '' : ' navy')} style={{ width: 40, height: 40, fontSize: 19 }}><I /></span><div className="grow"><div className="t1" style={{ fontSize: 15 }}>{label}</div>{sub && <div className="t2">{sub}</div>}</div><LuChevronRight /></C>;
}

export function Account() {
  const { profile, company, isPro } = useApp();
  const ger = profile.member_role === 'gerant';
  const logout = async () => { await api.signOut(); navigate('/connexion', { replace: true }); };
  return (
    <div className="content narrow">
      <TopBar title={t('Paramètres et compte')} />
      <div className="card navy row" style={{ gap: 14 }}>
        <Avatar name={profile.first_name} last={profile.last_name} path={profile.avatar_path} size="lg" />
        <div><b style={{ fontSize: 19 }}>{fullName(profile)}</b><div className="muted">{company.name}</div><Pill c="white">{t({ gerant: 'Gérant', chef: "Chef d'équipe", ouvrier: 'Ouvrier' }[profile.member_role])}</Pill></div>
      </div>
      <Sec title={t('Compte')} />
      <div className="list">
        <MenuRow to="/pro/compte/profil" icon={LuUser} label={t('Mon profil')} sub={profile.email} />
        {ger && <MenuRow to="/pro/compte/abonnement" icon={LuCreditCard} label={t('Abonnement et parrainage')} sub={t('Formule {p}', { p: PLANS.find((p) => p.id === company.plan)?.name })} />}
      </div>
      <Sec title={t('Entreprise')} />
      <div className="list">
        {ger && <MenuRow to="/pro/compte/entreprise" icon={LuBuilding2} label={t('Mon entreprise')} sub={company.name} />}
        <MenuRow to="/pro/compte/equipe" icon={LuUsers} label={t('Mon équipe')} />
        {ger && <MenuRow to="/pro/compte/documents" icon={LuFileText} label={t('Devis et factures')} sub={t('Numérotation, TVA, paiement')} />}
        {ger && <MenuRow to="/pro/compte/avis" icon={LuStar} label={t('Mes avis clients')} />}
      </div>
      <Sec title={t('Application')} />
      <div className="list">
        <MenuRow to="/pro/compte/notifications" icon={LuBell} label={t('Notifications')} />
        <MenuRow to="/pro/compte/apparence" icon={LuPalette} label={t('Langue et apparence')} />
        {ger && <MenuRow to="/pro/compte/integrations" icon={LuPlug} label={t('Intégrations')} sub={t('Agenda, comptable, paiement')} />}
        <MenuRow to="/pro/compte/donnees" icon={LuShield} label={t('Données et confidentialité')} />
        <MenuRow to="/telecharger" icon={LuDownload} label={t('Logiciel PC / Mac')} />
        {profile.is_admin && <MenuRow to="/pro/admin" icon={LuShieldCheck} label={t('Administration Artis & You')} />}
      </div>
      <Sec title={t('Aide')} />
      <div className="list">
        <MenuRow to="/pro/compte/aide" icon={LuCircleHelp} label={t('Aide et support')} />
        <MenuRow onClick={logout} icon={LuLogOut} label={t('Se déconnecter')} red />
      </div>
    </div>
  );
}

export function Subscription() {
  const { company, wip } = useApp();
  const [filleuls] = useData(async () => (await api.select('companies', { referred_by: company.id }, { columns: 'id,name,created_at' }).catch(() => [])), []);
  const days = Math.ceil((new Date(company.trial_ends_at) - new Date()) / 864e5);
  const copy = () => { navigator.clipboard?.writeText(company.referral_code); };
  return (
    <div className="content">
      <TopBar title={t('Abonnement et parrainage')} />
      <div className="card navy"><div className="muted small">{t('Formule actuelle')}</div><b style={{ fontSize: 22 }}>{PLANS.find((p) => p.id === company.plan)?.name}</b>
        <div className="small muted">{days > 0 ? t('Essai gratuit jusqu’au {d} ({n} jours restants)', { d: date(company.trial_ends_at), n: days }) : t('Renouvellement mensuel')}</div></div>
      <Sec title={t('Formules')} meta={t('Prix HT / mois · sans engagement')} />
      <div className="grid3" style={{ display: 'grid', gap: 14 }}>
        {PLANS.map((p) => (
          <div key={p.id} className="card" style={{ borderColor: p.id === company.plan ? 'var(--bordeaux)' : 'var(--line)' }}>
            <div className="row between"><b style={{ fontSize: 20 }}>{p.name}</b>{p.id === company.plan && <Pill c="red">{t('Actuelle')}</Pill>}</div>
            <div style={{ fontSize: 30, fontWeight: 800 }}>{p.price} € <small className="small muted">{t('HT / mois')}</small></div>
            <div className="small muted">{t(p.desc)}</div>
            <ul className="small" style={{ paddingLeft: 18 }}>{p.features.map((f) => <li key={f}>{t(f)}</li>)}</ul>
            {p.id !== company.plan && <button className="btn sm block" onClick={() => wip(t('Le paiement de l’abonnement'))}>{t('Choisir {p}', { p: p.name })}</button>}
          </div>
        ))}
      </div>
      <Sec title={t('Paiement et factures')} />
      <div className="list"><MenuRow onClick={() => wip(t('Le paiement de l’abonnement'))} icon={LuCreditCard} label={t('Moyen de paiement')} sub={t('Aucun pour l’instant')} /><MenuRow onClick={() => wip(t('Les factures d’abonnement'))} icon={LuFileText} label={t('Mes factures Artis & You')} /></div>
      <Sec title={t('Parrainage')} />
      <div className="card soft">
        <p>{t('Partagez votre code : votre filleul et vous gagnez chacun 1 mois offert.')}</p>
        <div className="row"><b style={{ fontSize: 24, letterSpacing: 3 }} className="red-t">{company.referral_code}</b><button className="btn xs ghost" onClick={copy}><LuCopy /> {t('Copier')}</button>
          <a className="btn xs ghost" href={`mailto:?subject=${encodeURIComponent(t('Rejoignez-moi sur Artis & You'))}&body=${encodeURIComponent(t('Inscrivez-vous sur {u} avec mon code {c} : 1 mois offert.', { u: location.origin + '/inscription/artisan', c: company.referral_code }))}`}>{t('Partager')}</a></div>
      </div>
      <Sec title={t('Mes filleuls')} meta={t('{n} mois gagnés', { n: filleuls?.length || 0 })} />
      {filleuls?.length ? <div className="list">{filleuls.map((f) => <div className="li" key={f.id}><div className="grow"><div className="t1">{f.name}</div><div className="t2">{t('Inscrit le {d}', { d: date(f.created_at) })}</div></div><Pill c="green">+1 {t('mois')}</Pill></div>)}</div> : <Empty text={t('Pas encore de filleul.')} />}
    </div>
  );
}

export function CompanySettings() {
  const { company, setCompany, run } = useApp();
  const [c, setC] = useState(company);
  const F = (k, label, props = {}) => <Field label={label}><input value={c[k] ?? ''} onChange={(e) => setC({ ...c, [k]: e.target.value })} {...props} /></Field>;
  const save = () => run(async () => {
    const { id, counters, owner_id, created_at, referral_code, verified, plan, trial_ends_at, referred_by, ...row } = c;
    const x = await api.update('companies', { id: company.id }, row); setCompany({ ...company, ...row, ...(x || {}) });
  }, t('Entreprise enregistrée'));
  const logo = async () => { const [f] = await pickFiles({ accept: 'image/*', multiple: false }); if (!f) return; await run(async () => { const up = await uploadTo(company.id + '/logo', f); setC({ ...c, logo_path: up.path }); await api.update('companies', { id: company.id }, { logo_path: up.path }); setCompany({ ...company, logo_path: up.path }); }, t('Logo enregistré')); };
  return (
    <div className="content">
      <TopBar title={t('Mon entreprise')} />
      <div className="grid2">
        <div>
          <div className="row mb"><Avatar name={c.name} path={c.logo_path} size="lg" /><button className="btn ghost sm" onClick={logo}><LuImage /> {t('Logo de l’entreprise')}</button></div>
          {company.verified ? <Pill c="green"><LuShieldCheck /> {t('Entreprise vérifiée')}</Pill> : <div className="notice">{t('Votre SIRET est en cours de vérification par l’équipe Artis & You.')}</div>}
          <Sec title={t('Identité')} />
          <div className="form-grid two">{F('name', t('Raison sociale'))}{F('trade_name', t('Nom commercial'))}{F('legal_form', t('Forme juridique'), { placeholder: 'SARL, SAS, EI, micro-entreprise…' })}{F('capital', t('Capital'), { placeholder: '10 000 €' })}{F('siret', 'SIRET')}{F('siren', 'SIREN')}{F('vat_number', t('N° TVA intracom.'))}{F('rm', t('N° RM (Répertoire des métiers)'))}</div>
          <Field label={t('Régime de TVA')}><select value={c.vat_regime} onChange={(e) => setC({ ...c, vat_regime: e.target.value })}><option value="normal">{t('Assujetti à la TVA')}</option><option value="franchise">{t('Franchise en base (art. 293 B du CGI, micro-entreprise)')}</option></select></Field>
          <div className="form-grid three">{F('address', t('Adresse'))}{F('zip', t('Code postal'))}{F('city', t('Ville'))}</div>
          <div className="form-grid two">{F('phone', t('Téléphone'))}{F('email', t('E-mail'))}{F('website', t('Site web'))}</div>
          <p className="small muted">{t('Ces informations figurent sur les devis et factures.')}</p>
          <Sec title={t('Assurance décennale')} />
          <div className="form-grid three">{F('insurer', t('Assureur'))}{F('insurance_contract', t('N° de contrat'))}{F('insurance_coverage', t('Couverture'))}</div>
        </div>
        <div>
          <Sec title={t('Activité')} />
          {Object.entries(TRADES).map(([g, ls]) => <div key={g}><div className="small bold red-t">{t(g).toUpperCase()}</div><Chips multi options={ls.map((x) => [x, t(x)])} value={c.trades || []} onChange={(trades) => setC({ ...c, trades })} /></div>)}
          {F('zone', t("Zone d'intervention"), { placeholder: t('ex. Antibes + 30 km') })}
          {F('certifications', t('Certifications'), { placeholder: 'RGE, Qualibat, Qualifelec…' })}
          <Field label={t('Présentation')}><textarea value={c.description || ''} onChange={(e) => setC({ ...c, description: e.target.value })} /></Field>
          <Sec title={t('Profil public')} />
          <div className="card soft"><b>{c.trade_name || c.name}</b><div className="small muted">{(c.trades || []).slice(0, 2).map(t).join(' · ')} · {c.zone || c.city}</div><p className="small">{c.description}</p></div>
          <div className="kv mt">
            <div className="r"><span className="k">{t('Visible par les particuliers')}</span><Toggle checked={c.visible_particuliers} onChange={(v) => setC({ ...c, visible_particuliers: v })} /></div>
            <div className="r"><span className="k">{t('Visible par les pros')}</span><Toggle checked={c.visible_pros} onChange={(v) => setC({ ...c, visible_pros: v })} /></div>
          </div>
          <div className="btns"><button className="btn" onClick={save}>{t('Enregistrer')}</button></div>
        </div>
      </div>
    </div>
  );
}

const ROLE = { gerant: 'Gérant', chef: "Chef d'équipe", ouvrier: 'Ouvrier' };
const COLORS = ['#00123B', '#7F1111', '#1F6F78', '#6B4E9B', '#B5651D', '#2E7D32', '#AD1457', '#455A64'];
export function TeamSettings() {
  const { company, teams, setTeams, members, run, profile } = useApp();
  const ger = profile.member_role === 'gerant';
  const [newTeam, setNewTeam] = useState(false);
  const [invite, setInvite] = useState(false);
  const [invites, reloadInv] = useData(() => (ger ? api.select('company_invites', { company_id: company.id, used_by: null }) : Promise.resolve([])), []);
  return (
    <div className="content narrow">
      <TopBar title={t('Mon équipe')} />
      <Sec title={t('Équipes')} meta={t('La couleur est utilisée dans le planning')} />
      <div className="list">{teams.map((tm) => (
        <div key={tm.id} className="li">
          <input type="color" value={tm.color} disabled={!ger} onChange={async (e) => { const color = e.target.value; setTeams(teams.map((x) => (x.id === tm.id ? { ...x, color } : x))); await api.update('teams', { id: tm.id }, { color }); }} style={{ width: 40, height: 40, border: 0, borderRadius: 10, padding: 0, background: 'none' }} aria-label={t('Couleur')} />
          <div className="grow"><div className="t1">{tm.name}</div><div className="t2">{members.filter((m) => m.team_id === tm.id).map((m) => m.first_name).join(', ') || t('Aucun membre')}</div></div>
        </div>
      ))}</div>
      {ger && <button className="btn ghost sm mt" onClick={() => setNewTeam(true)}><LuPlus /> {t('Créer une équipe')}</button>}
      <Sec title={t('Membres')} meta={t('{n} membres', { n: members.length })} />
      <div className="list">{members.map((m) => (
        <button key={m.id} className="li click" onClick={() => ger && m.id !== profile.id && navigate('/pro/compte/equipe/' + m.id)}>
          <Avatar name={m.first_name} last={m.last_name} path={m.avatar_path} size="sm" color={teams.find((x) => x.id === m.team_id)?.color} />
          <div className="grow"><div className="t1">{fullName(m)} {m.id === profile.id && <span className="small muted">({t('vous')})</span>}</div><div className="t2">{teams.find((x) => x.id === m.team_id)?.name || t('Sans équipe')}</div></div>
          <Pill c={m.member_role === 'gerant' ? 'red' : m.member_role === 'chef' ? 'navy' : 'grey'}>{t(ROLE[m.member_role])}</Pill>
        </button>
      ))}</div>
      {ger && <button className="btn ghost sm mt" onClick={() => setInvite(true)}><LuPlus /> {t('Inviter un membre')}</button>}
      {ger && invites?.length > 0 && <><Sec title={t('Invitations en attente')} /><div className="list">{invites.map((i) => <div key={i.code} className="li"><b className="red-t" style={{ letterSpacing: 3, fontSize: 18 }}>{i.code}</b><div className="grow t2">{i.label} · {t(ROLE[i.member_role])}</div><button className="iconbtn" onClick={() => navigator.clipboard?.writeText(i.code)} aria-label={t('Copier')}><LuCopy /></button></div>)}</div></>}
      <TeamSheet open={newTeam} onClose={() => setNewTeam(false)} />
      <InviteSheet open={invite} onClose={() => { setInvite(false); reloadInv(); }} />
    </div>
  );
}
function TeamSheet({ open, onClose }) {
  const { company, teams, setTeams, run } = useApp();
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[teams.length % COLORS.length]);
  if (!open) return null;
  return (
    <Sheet open onClose={onClose} title={t('Créer une équipe')}>
      <Field label={t('Nom')}><input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('ex. Éq. Karim')} /></Field>
      <div className="row wrap mb">{COLORS.map((c) => <button key={c} onClick={() => setColor(c)} style={{ width: 36, height: 36, borderRadius: 18, background: c, border: color === c ? '3px solid var(--text)' : 0 }} aria-label={c} />)}</div>
      <button className="btn block" disabled={!name} onClick={() => run(async () => { const x = await api.insert('teams', { company_id: company.id, name, color }); setTeams([...teams, x]); onClose(); }, t('Équipe créée'))}>{t('Créer')}</button>
    </Sheet>
  );
}
function InviteSheet({ open, onClose }) {
  const { company, teams, run } = useApp();
  const [v, setV] = useState({ label: '', member_role: 'ouvrier', team_id: teams[0]?.id || '' });
  const [code, setCode] = useState(null);
  if (!open) return null;
  const msg = code && t('Rejoignez {c} sur Artis & You : créez votre compte sur {u} puis choisissez « Rejoindre une équipe » avec le code {k}.', { c: company.name, u: location.origin + '/inscription/artisan', k: code });
  return (
    <Sheet open onClose={() => { setCode(null); onClose(); }} title={t('Inviter un membre')}>
      {code ? (<div className="center"><p>{t('Code d’invitation')}</p><div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 6 }} className="red-t">{code}</div><p className="small muted">{msg}</p>
        <div className="btns" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}><a className="btn ghost" href={`sms:?&body=${encodeURIComponent(msg)}`}>{t('SMS')}</a><a className="btn ghost" href={`mailto:?subject=${encodeURIComponent(t('Invitation Artis & You'))}&body=${encodeURIComponent(msg)}`}>{t('E-mail')}</a></div></div>) : (<>
        <Field label={t('Nom du membre')}><input value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} /></Field>
        <Chips options={Object.entries(ROLE).filter(([k]) => k !== 'gerant').map(([k, l]) => [k, t(l)])} value={v.member_role} onChange={(member_role) => setV({ ...v, member_role })} />
        <Field label={t('Équipe')}><select value={v.team_id} onChange={(e) => setV({ ...v, team_id: e.target.value })}>{teams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
        <button className="btn block" onClick={() => run(async () => { const x = await api.insert('company_invites', { ...v, company_id: company.id, code: Math.random().toString(36).slice(2, 8).toUpperCase() }); setCode(x.code); })}>{t('Générer le code')}</button></>)}
    </Sheet>
  );
}

export function MemberSettings({ params }) {
  const { members, setMembers, teams, run } = useApp();
  const m0 = members.find((x) => x.id === params.id);
  const [m, setM] = useState(m0);
  if (!m) return <div className="content"><TopBar title={t('Fiche membre')} /><Empty text={t('Membre introuvable')} /></div>;
  const P = [['planning', 'Planning'], ['clients', 'Clients'], ['devis', 'Devis et factures'], ['prix', 'Prix et bibliothèque'], ['kpi', 'KPI et export comptable']];
  return (
    <div className="content narrow">
      <TopBar title={fullName(m)} sub={t('Fiche membre')} />
      <Sec title={t('Rôle')} />
      <Chips options={Object.entries(ROLE).map(([k, l]) => [k, t(l)])} value={m.member_role} onChange={(member_role) => setM({ ...m, member_role })} red />
      <Field label={t('Équipe')}><select value={m.team_id || ''} onChange={(e) => setM({ ...m, team_id: e.target.value || null })}><option value="">—</option>{teams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
      <Sec title={t("Droits d'accès")} />
      <div className="kv">{P.map(([k, l]) => <div key={k} className="r"><span className="k">{t(l)}</span><Toggle checked={m.member_role === 'gerant' || m.permissions?.[k]} onChange={(v) => setM({ ...m, permissions: { ...m.permissions, [k]: v } })} /></div>)}</div>
      <div className="btns">
        <button className="btn" onClick={() => run(async () => { await api.update('profiles', { id: m.id }, { member_role: m.member_role, team_id: m.team_id, permissions: m.permissions }); setMembers(members.map((x) => (x.id === m.id ? m : x))); navigate(-1); }, t('Membre enregistré'))}>{t('Enregistrer')}</button>
        <button className="btn light sm" onClick={() => run(async () => { await api.update('profiles', { id: m.id }, { company_id: null, kind: 'artisan' }); setMembers(members.filter((x) => x.id !== m.id)); navigate(-1); }, t('Membre retiré'))}>{t("Retirer de l'entreprise")}</button>
      </div>
    </div>
  );
}

export function DocSettings() {
  const { company, setCompany, run } = useApp();
  const [s, setS] = useState({ quotePrefix: 'DE', invoicePrefix: 'FA', creditPrefix: 'AV', vat: 20, validity: 30, paymentTerms: '30 jours fin de mois', penalties: "3 fois le taux d'intérêt légal", discount: 'Aucun pour paiement anticipé', mediator: '', labourRate: 45, onlinePayment: true, einvoice: true, ...(company.settings?.docs || {}) });
  const [iban, setIban] = useState({ iban: company.iban || '', bic: company.bic || '' });
  const F = (k, label, props = {}) => <Field label={label}><input value={s[k] ?? ''} onChange={(e) => setS({ ...s, [k]: e.target.value })} {...props} /></Field>;
  const save = () => run(async () => { const settings = { ...company.settings, docs: { ...s, vat: Number(s.vat), validity: Number(s.validity), labourRate: Number(s.labourRate) } }; await api.update('companies', { id: company.id }, { settings, ...iban }); setCompany({ ...company, settings, ...iban }); }, t('Réglages enregistrés'));
  const yr = new Date().getFullYear();
  return (
    <div className="content narrow">
      <TopBar title={t('Devis et factures')} />
      <Sec title={t('Numérotation')} />
      <div className="form-grid three">{F('quotePrefix', t('Préfixe devis'))}{F('invoicePrefix', t('Préfixe factures'))}{F('creditPrefix', t('Préfixe avoirs'))}</div>
      <p className="small muted">{t('Exemple : {a} · {b}. Numérotation continue, sans trou, par année (obligation légale).', { a: `${s.quotePrefix}-${yr}-0001`, b: `${s.invoicePrefix}-${yr}-0001` })}</p>
      <Sec title={t('Valeurs par défaut')} />
      <div className="form-grid two">
        <Field label={t('TVA par défaut')}><select value={s.vat} onChange={(e) => setS({ ...s, vat: e.target.value })}>{[20, 10, 5.5, 2.1, 0].map((r) => <option key={r} value={r}>{r} %</option>)}</select></Field>
        {F('validity', t('Validité des devis (jours)'), { type: 'number' })}{F('paymentTerms', t('Conditions de paiement'))}{F('penalties', t('Pénalités de retard'))}{F('discount', t('Escompte'))}{F('labourRate', t('Taux horaire main-d’œuvre (€ HT)'), { type: 'number' })}
      </div>
      {F('mediator', t('Médiateur de la consommation (obligatoire pour les particuliers)'), { placeholder: t('Nom et site du médiateur') })}
      <Sec title={t('Paiement')} />
      <div className="form-grid two"><Field label="IBAN"><input value={iban.iban} onChange={(e) => setIban({ ...iban, iban: e.target.value.toUpperCase() })} /></Field><Field label="BIC"><input value={iban.bic} onChange={(e) => setIban({ ...iban, bic: e.target.value.toUpperCase() })} /></Field></div>
      <div className="kv">
        <div className="r"><span className="k">{t('Paiement en ligne (carte, prélèvement)')}</span><Toggle checked={s.onlinePayment} onChange={(v) => setS({ ...s, onlinePayment: v })} /></div>
        <div className="r"><span className="k">{t('Facture électronique')}</span><Toggle checked={s.einvoice} onChange={(v) => setS({ ...s, einvoice: v })} /></div>
        <Link className="r" to="/pro/compte/pdf"><span className="k">{t('Modèle du PDF')}</span><span className="v">›</span></Link>
      </div>
      <div className="btns"><button className="btn" onClick={save}>{t('Enregistrer')}</button></div>
    </div>
  );
}

export function PdfSettings() {
  const { company, setCompany, run } = useApp();
  const [p, setP] = useState({ color: '#7F1111', footer: '', signature: '', ...(company.settings?.pdf || {}) });
  const sample = { kind: 'facture', number: 'FA-2027-0001', issue_date: new Date().toISOString().slice(0, 10), due_date: new Date().toISOString().slice(0, 10), object: t('Exemple de facture'), lines: [{ id: 'a', kind: 'section', label: t('Détail fournitures') }, { id: 'b', kind: 'item', label: t('Fourniture'), qty: 1, unit: 'u', price: 100, vat: 20 }, { id: 'c', kind: 'section', label: t('Détail prestations') }, { id: 'd', kind: 'item', label: t('Main-d’œuvre'), qty: 2, unit: 'h', price: 45, vat: 20 }], conditions: {}, totals: {}, operations_nature: 'Biens et services', paid_amount: 0 };
  const sig = async () => { const [f] = await pickFiles({ accept: 'image/*', multiple: false }); if (!f) return; const r = new FileReader(); r.onload = () => setP({ ...p, signature: r.result }); r.readAsDataURL(f); };
  return (
    <div className="content">
      <TopBar title={t('Modèle du PDF')} />
      <div className="grid2">
        <div>
          <Sec title={t('Personnalisation')} />
          <Field label={t('Couleur')}><input type="color" value={p.color} onChange={(e) => setP({ ...p, color: e.target.value })} style={{ height: 48 }} /></Field>
          <div className="row mb"><button className="btn ghost sm" onClick={() => navigate('/pro/compte/entreprise')}><LuImage /> {t('Logo')}</button><button className="btn ghost sm" onClick={sig}>{t('Signature (image)')}</button></div>
          <Field label={t('Pied de page')}><input value={p.footer} onChange={(e) => setP({ ...p, footer: e.target.value })} placeholder={t('ex. Membre d’une association agréée')} /></Field>
          <button className="btn block" onClick={() => run(async () => { const settings = { ...company.settings, pdf: p }; await api.update('companies', { id: company.id }, { settings }); setCompany({ ...company, settings }); }, t('Modèle enregistré'))}>{t('Enregistrer')}</button>
        </div>
        <div>
          <Sec title={t('Aperçu')} />
          <div className="a4-wrap" style={{ height: 560 }}><div style={{ transform: 'scale(.46)', transformOrigin: 'top left', width: 794 }}><A4 d={sample} company={{ ...company, settings: { ...company.settings, pdf: p } }} client={{ type: 'particulier', first_name: 'Tiago', last_name: 'Bernard', billing_address: '3 rue des Fleurs', billing_zip: '06800', billing_city: 'Cagnes-sur-Mer' }} /></div></div>
        </div>
      </div>
    </div>
  );
}

export function NotifSettings() {
  const { profile, setProfile, run } = useApp();
  const [n, setN] = useState({ push: true, email: true, sms: false, demande: true, rdv: true, devis: true, paiement: true, message: true, rappel_rdv: true, relance_devis: false, relance_facture: false, ...(profile.notif_prefs || {}) });
  const set = async (k, v) => { const x = { ...n, [k]: v }; setN(x); await api.update('profiles', { id: profile.id }, { notif_prefs: x }); setProfile({ ...profile, notif_prefs: x }); };
  const R = ([k, l, sub]) => <div key={k} className="r"><span className="k">{t(l)}{sub && <div className="small faint">{t(sub)}</div>}</span><Toggle checked={n[k]} onChange={(v) => set(k, v)} /></div>;
  return (
    <div className="content narrow">
      <TopBar title={t('Notifications')} />
      <Sec title={t('Canaux')} />
      <div className="kv">{[['push', 'Notifications dans l’application'], ['email', 'E-mail', 'Bientôt disponible'], ['sms', 'SMS', 'Bientôt disponible']].map(R)}</div>
      <Sec title={t('Mes alertes')} />
      <div className="kv">{[['demande', 'Nouvelle demande'], ['rdv', 'RDV à valider'], ['devis', 'Devis signé ou refusé'], ['paiement', 'Paiement reçu'], ['message', 'Nouveau message']].map(R)}</div>
      <Sec title={t('Envois automatiques aux clients')} />
      <div className="kv">{[['rappel_rdv', 'Rappel de RDV'], ['relance_devis', 'Relance devis', 'Après 7 jours sans réponse'], ['relance_facture', 'Relance facture', "Le lendemain de l'échéance"]].map(R)}</div>
      <p className="small muted">{t('Les envois automatiques par e-mail et SMS arrivent bientôt.')}</p>
    </div>
  );
}

export function Integrations() {
  const { company, setCompany, run, wip } = useApp();
  const [a, setA] = useState({ name: '', email: '', ...(company.accountant || {}) });
  return (
    <div className="content narrow">
      <TopBar title={t('Intégrations')} />
      <Sec title={t('Agenda')} />
      <div className="list"><MenuRow onClick={() => wip('Google Agenda')} icon={LuPlug} label="Google Agenda" sub={t('Non connecté')} /><MenuRow onClick={() => wip('Outlook')} icon={LuPlug} label="Outlook" sub={t('Non connecté')} /><MenuRow to="/pro/planning/reglages" icon={LuPlug} label={t('RDV perso dans le planning')} sub={t('Exporter / importer (.ics)')} /></div>
      <Sec title={t('Mon comptable')} />
      <div className="form-grid two"><Field label={t('Nom')}><input value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} /></Field><Field label={t('E-mail')}><input type="email" value={a.email} onChange={(e) => setA({ ...a, email: e.target.value })} /></Field></div>
      <button className="btn sm" onClick={() => run(async () => { await api.update('companies', { id: company.id }, { accountant: a }); setCompany({ ...company, accountant: a }); }, t('Comptable enregistré'))}>{t('Enregistrer')}</button>
      <Sec title={t('Paiement et facturation')} />
      <div className="list"><MenuRow onClick={() => wip(t('Le paiement en ligne'))} icon={LuCreditCard} label={t('Paiement en ligne')} sub={t('Carte et prélèvement SEPA')} /><MenuRow onClick={() => wip(t('La facture électronique via Artis & You'))} icon={LuFileText} label={t('Facture électronique')} sub={t('Plateforme agréée')} /></div>
    </div>
  );
}

export function Reviews() {
  const { company, run } = useApp();
  const [list, reload] = useData(() => api.select('reviews', { company_id: company.id }, { order: 'created_at.desc' }), []);
  const [reply, setReply] = useState(null);
  if (!list) return <div className="content"><TopBar title={t('Mes avis clients')} /><Loader /></div>;
  const pub = list.filter((r) => r.status === 'publie');
  const avg = pub.length ? pub.reduce((s, r) => s + r.rating, 0) / pub.length : 0;
  return (
    <div className="content narrow">
      <TopBar title={t('Mes avis clients')} sub={pub.length ? `${avg.toFixed(1).replace('.', ',')} / 5 · ${t('{n} avis', { n: pub.length })}` : ''} />
      <p className="small muted">{t('Les avis sont vérifiés (seulement après un vrai RDV) et relus par Artis & You avant publication.')}</p>
      {!list.length ? <Empty icon={LuStar} text={t('Pas encore d’avis.')} /> : list.map((r) => (
        <div key={r.id} className="card soft mb">
          <div className="row between"><Stars n={r.rating} /><Pill c={r.status === 'publie' ? 'green' : r.status === 'refuse' ? 'grey' : 'yellow'}>{t({ publie: 'Publié', en_attente: 'En relecture', refuse: 'Refusé' }[r.status])}</Pill></div>
          <p>{r.comment}</p><div className="small muted">{r.author_label} · {date(r.created_at)}</div>
          {r.reply ? <div className="notice"><b>{t('Votre réponse')} :</b> {r.reply}</div> : reply?.id === r.id ? (
            <div className="mt"><textarea className="input" value={reply.text} onChange={(e) => setReply({ ...reply, text: e.target.value })} /><button className="btn sm mt" onClick={() => run(() => api.update('reviews', { id: r.id }, { reply: reply.text }), t('Réponse publiée')).then(() => { setReply(null); reload(); })}>{t('Publier ma réponse')}</button></div>
          ) : <button className="link red" onClick={() => setReply({ id: r.id, text: '' })}>{t('Répondre')}</button>}
        </div>
      ))}
    </div>
  );
}
