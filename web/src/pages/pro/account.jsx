import { useState } from 'react';
import { LuUser, LuCreditCard, LuBuilding2, LuUsers, LuFileText, LuBell, LuPlug, LuShield, LuCircleHelp, LuLogOut, LuChevronRight, LuPalette, LuStar, LuCopy, LuPlus, LuImage, LuCheck, LuShieldCheck, LuDownload, LuLock, LuFilePen } from 'react-icons/lu';
import { api, OFFLINE } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { navigate, Link } from '../../lib/router.jsx';
import { t } from '../../lib/i18n.js';
import { date, fullName, initials, money } from '../../lib/format.js';
import { PLANS, TRADES, kindLabel, LEGAL_FORMS, SOCIETIES, companyMissing } from '../../lib/docs.js';
import { AddressFields, CityInput } from '../../ui/address.jsx';
import { CropSheet } from '../../ui/crop.jsx';
import { siretValid } from '../auth/index.jsx';
import { TopBar, Sec, KV, Field, Chips, Seg, Toggle, SettingToggle, DeviceNotif, Sheet, useData, Loader, Empty, Avatar, Pill, Stars, pickFiles, Img } from '../../ui/index.jsx';
import { A4, useLogo } from '../common/docview.jsx';
import { uploadTo } from '../common/chat.jsx';
import { SignatureEditor } from '../../ui/signature.jsx';

export function MenuRow({ to, icon: I, label, sub, onClick, red }) {
  const C = to ? Link : 'button';
  return <C to={to} onClick={onClick} className="li click" style={{ width: '100%' }}><span className={'ficon' + (red ? '' : ' navy')} style={{ width: 40, height: 40, fontSize: 19 }}><I /></span><div className="grow"><div className="t1" style={{ fontSize: 15 }}>{label}</div>{sub && <div className="t2">{sub}</div>}</div><LuChevronRight /></C>;
}

export function Account() {
  const { profile, company, isPro, confirm } = useApp();
  const ger = profile.member_role === 'gerant';
  // Double demande avant de se déconnecter
  const logout = async () => {
    if (!(await confirm({ title: t('Se déconnecter ?'), text: OFFLINE ? t('Vos données restent dans ce navigateur. Vous devrez saisir à nouveau votre e-mail et votre mot de passe.') : t('Vous devrez saisir à nouveau votre e-mail et votre mot de passe (et votre code de double authentification si elle est activée).'), ok: t('Se déconnecter'), danger: true }))) return;
    await api.signOut(); navigate('/connexion', { replace: true });
  };
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
        {ger && <MenuRow to="/pro/compte/devis" icon={LuFilePen} label={t('Devis')} sub={t('Numérotation, TVA, validité, acompte')} />}
        {ger && <MenuRow to="/pro/compte/factures" icon={LuFileText} label={t('Factures')} sub={t('Numérotation, paiement, mentions')} />}
        {ger && <MenuRow to="/pro/compte/avis" icon={LuStar} label={t('Mes avis clients')} />}
      </div>
      <Sec title={t('Application')} />
      <div className="list">
        <MenuRow to="/pro/compte/notifications" icon={LuBell} label={t('Notifications')} />
        <MenuRow to="/pro/compte/apparence" icon={LuPalette} label={t('Langue et apparence')} />
        {ger && <MenuRow to="/pro/compte/integrations" icon={LuPlug} label={t('Intégrations')} sub={t('Agenda, comptable, paiement')} />}
        <MenuRow to="/pro/compte/donnees" icon={LuShield} label={t('Données et confidentialité')} />
        <MenuRow to="/telecharger" icon={LuDownload} label={t('Logiciel PC / Mac et application mobile')} />
        {profile.is_admin && <MenuRow to="/pro/admin" icon={LuShieldCheck} label={t('Administration Artesa')} />}
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
  const [refStats] = useData(() => api.rpc('referral_stats').catch(() => null), []);
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
      <div className="list"><MenuRow onClick={() => wip(t('Le paiement de l’abonnement'))} icon={LuCreditCard} label={t('Moyen de paiement')} sub={t('Aucun pour l’instant')} /><MenuRow onClick={() => wip(t('Les factures d’abonnement'))} icon={LuFileText} label={t('Mes factures Artesa')} /></div>
      <Sec title={t('Parrainage')} />
      <div className="card soft">
        <p>{t('Partagez votre code : votre filleul gagne 1 mois offert en plus de son essai (2 mois en tout), et vous gagnez 15 jours offerts. Jusqu’à 10 filleuls.')}</p>
        {refStats && <p className="small muted">{t('{n} filleuls sur 10', { n: refStats.count })}{refStats.count >= 10 ? ' · ' + t('Maximum atteint : votre code ne donne plus d’avantage.') : ''}</p>}
        <div className="row"><b style={{ fontSize: 24, letterSpacing: 3 }} className="red-t">{company.referral_code}</b><button className="btn xs ghost" onClick={copy}><LuCopy /> {t('Copier')}</button>
          <a className="btn xs ghost" href={`mailto:?subject=${encodeURIComponent(t('Rejoignez-moi sur Artesa'))}&body=${encodeURIComponent(t('Inscrivez-vous sur {u} avec mon code {c} : 1 mois offert en plus de l’essai.', { u: location.origin + '/inscription/artisan', c: company.referral_code }))}`}>{t('Partager')}</a></div>
      </div>
      <Sec title={t('Mes filleuls')} meta={t('{n} mois gagnés', { n: filleuls?.length || 0 })} />
      {filleuls?.length ? <div className="list">{filleuls.map((f) => <div className="li" key={f.id}><div className="grow"><div className="t1">{f.name}</div><div className="t2">{t('Inscrit le {d}', { d: date(f.created_at) })}</div></div><Pill c="green">+1 {t('mois')}</Pill></div>)}</div> : <Empty text={t('Pas encore de filleul.')} />}
    </div>
  );
}

export function CompanySettings() {
  const { company, setCompany, run, toast } = useApp();
  const [c, setC] = useState(company);
  const [crop, setCrop] = useState(null);
  const [tried, setTried] = useState(false);
  const miss = companyMissing(c);
  const missKeys = new Set(tried ? miss.map((m) => m[0]) : []);
  const F = (k, label, props = {}) => <label className={'field' + (missKeys.has(k) ? ' missing' : '')}><span>{label}{props.req && <b className="red-t"> *</b>}</span><input value={c[k] ?? ''} onChange={(e) => setC({ ...c, [k]: e.target.value })} {...props} req={undefined} /></label>;
  const visio = c.settings?.planning?.visio !== false;
  const pending = company.verification_status !== 'approved' && !company.verified;
  const save = async () => {
    setTried(true);
    if (pending && miss.length) { toast(t('Complétez les champs obligatoires : {l}', { l: miss.map((m) => t(m[1])).join(', ') }), true); return; }
    if (c.siret && !siretValid(c.siret)) { toast(t('Le SIRET doit contenir 14 chiffres valides.'), true); return; }
    await run(async () => {
      const { id, counters, owner_id, created_at, referral_code, verified, plan, trial_ends_at, referred_by, verification_status, verification_note, verified_at, ...row } = c;
      const x = await api.update('companies', { id: company.id }, row); setCompany({ ...company, ...row, ...(x || {}) });
      // Compléments envoyés : le dossier repart en vérification
      if (company.verification_status === 'rejected' && !miss.length) { const y = await api.rpc('resubmit_company', {}); if (y) setCompany({ ...company, ...row, ...y }); }
    }, company.verification_status === 'rejected' && !miss.length ? t('Merci ! Votre dossier est renvoyé à l’équipe Artesa.') : t('Entreprise enregistrée'));
  };
  const logo = async () => { const [f] = await pickFiles({ accept: 'image/*', multiple: false }); if (f) setCrop(f); };
  const saveLogo = (f) => { setCrop(null); run(async () => { const up = await uploadTo(company.id + '/logo', f); setC((x) => ({ ...x, logo_path: up.path })); await api.update('companies', { id: company.id }, { logo_path: up.path }); setCompany({ ...company, logo_path: up.path }); }, t('Logo enregistré')); };
  const km = Number(c.zone_km || 30);
  const zoneText = (city, n) => (city ? `${city} + ${n} km` : '');
  return (
    <div className="content">
      <TopBar title={t('Mon entreprise')} />
      <div className="grid2">
        <div>
          <div className="row mb"><Avatar name={c.name} path={c.logo_path} size="lg" /><div style={{ display: 'grid', gap: 6 }}><button className="btn ghost sm" onClick={logo}><LuImage /> {c.logo_path ? t('Changer le logo') : t('Ajouter le logo')}</button><span className="small faint">{t('Vous pourrez le recadrer avant de l’enregistrer.')}</span></div></div>
          {company.verified || company.verification_status === 'approved' ? <Pill c="green"><LuShieldCheck /> {t('Entreprise vérifiée')}</Pill> : (
            <div className="notice">
              <b>{company.verification_status === 'rejected' ? t('Informations à compléter') : t('Validation en cours par l’équipe Artesa')}</b>
              {company.verification_note && <div className="small">« {company.verification_note} »</div>}
              <ul className="req-list">{companyMissing(c).length ? companyMissing(c).map(([k, l]) => <li key={k} className="ko">✕ {t(l)}</li>) : <li className="ok">✓ {t('Toutes les informations obligatoires sont renseignées')}</li>}</ul>
            </div>
          )}
          <Sec title={t('Identité')} />
          <p className="small faint" style={{ marginTop: -6 }}><b className="red-t">*</b> {t('obligatoire pour la validation du compte')}</p>
          <div className="form-grid two">
            {F('name', t('Raison sociale'), { req: 1 })}{F('trade_name', t('Nom commercial'))}
            <label className={'field' + (missKeys.has('legal_form') ? ' missing' : '')}><span>{t('Forme juridique')}<b className="red-t"> *</b></span><select value={c.legal_form || ''} onChange={(e) => setC({ ...c, legal_form: e.target.value, ...(e.target.value === 'Micro-entreprise' ? { vat_regime: 'franchise' } : {}) })}><option value="">{t('Choisir…')}</option>{[...new Set([...LEGAL_FORMS, c.legal_form].filter(Boolean))].map((x) => <option key={x} value={x}>{t(x)}</option>)}</select></label>
            {F('capital', t('Capital'), { placeholder: '10 000 €', req: SOCIETIES.includes(c.legal_form) ? 1 : 0 })}
            {F('siret', 'SIRET', { req: 1, inputMode: 'numeric', onBlur: () => { const d = String(c.siret || '').replace(/\D/g, ''); if (d.length === 14) setC((x) => ({ ...x, siren: d.slice(0, 9) })); } })}{F('siren', 'SIREN', { req: 1 })}{F('vat_number', t('N° TVA intracom.'))}{F('rm', t('N° RM (Répertoire des métiers)'))}
          </div>
          <Field label={t('Régime de TVA')}><select value={c.vat_regime} onChange={(e) => setC({ ...c, vat_regime: e.target.value })}><option value="normal">{t('Assujetti à la TVA')}</option><option value="franchise">{t('Franchise en base (art. 293 B du CGI, micro-entreprise)')}</option></select></Field>
          <div className={missKeys.has('address') || missKeys.has('city') || missKeys.has('zip') ? 'missing-block' : ''}><AddressFields value={c} onChange={setC} required /></div>
          <div className="form-grid two">{F('phone', t('Téléphone'), { req: 1, type: 'tel' })}{F('email', t('E-mail'), { req: 1, type: 'email' })}{F('website', t('Site web'))}</div>
          <p className="small muted">{t('Ces informations figurent sur les devis et factures.')}</p>
          <Sec title={t('Assurance décennale')} />
          <div className="form-grid three">{F('insurer', t('Assureur'), { req: 1 })}{F('insurance_contract', t('N° de contrat'), { req: 1 })}{F('insurance_coverage', t('Couverture'))}</div>
        </div>
        <div>
          <Sec title={<>{t('Activité')}{missKeys.has('trades') && <span className="small red-t"> · {t('choisissez au moins un métier')}</span>}</>} />
          {Object.entries(TRADES).map(([g, ls]) => <div key={g}><div className="small bold red-t">{t(g).toUpperCase()}</div><Chips multi options={ls.map((x) => [x, t(x)])} value={c.trades || []} onChange={(trades) => setC({ ...c, trades })} /></div>)}
          <Sec title={t("Zone d'intervention")} />
          <Field label={t('Ville de départ')}><CityInput value={c.zone_city ?? c.city ?? ''} placeholder={t('ex. Antibes')} onChange={(v) => setC({ ...c, zone_city: v, zone: zoneText(v, km) })} onPick={(s) => setC((x) => ({ ...x, zone_city: s.city, zone_lat: s.lat, zone_lon: s.lon, zone: zoneText(s.city, km) }))} /></Field>
          <div className="range-row"><span className="small">{t('Rayon')}</span><input type="range" min={5} max={150} step={5} value={km} onChange={(e) => setC({ ...c, zone_km: +e.target.value, zone: zoneText(c.zone_city || c.city, +e.target.value) })} aria-label={t('Rayon')} /><b>{km} km</b></div>
          <p className="small faint">{c.zone_lat ? t('Les particuliers qui cherchent une ville à moins de {n} km de {v} vous trouveront.', { n: km, v: c.zone_city }) : t('Choisissez la ville dans la liste proposée pour activer la recherche par distance.')}</p>
          {F('certifications', t('Certifications'), { placeholder: 'RGE, Qualibat, Qualifelec…' })}
          <Field label={t('Présentation')}><textarea value={c.description || ''} onChange={(e) => setC({ ...c, description: e.target.value })} /></Field>
          <Sec title={t('Profil public')} />
          <div className="card soft"><b>{c.trade_name || c.name}</b><div className="small muted">{(c.trades || []).slice(0, 2).map(t).join(' · ')} · {c.zone || c.city}</div><p className="small">{c.description}</p></div>
          <div className="kv mt">
            <SettingToggle label={t('Visible par les particuliers')} hint={t('Votre fiche apparaît dans la recherche d’artisans')} checked={c.visible_particuliers} onChange={(v) => setC({ ...c, visible_particuliers: v })} />
            <SettingToggle label={t('Visible par les pros')} hint={t('Les autres artisans peuvent vous trouver et vous écrire')} checked={c.visible_pros} onChange={(v) => setC({ ...c, visible_pros: v })} />
            <SettingToggle label={t('Rendez-vous en visio (WhatsApp)')} hint={visio ? t('Vos clients peuvent demander une visio WhatsApp') : t('Uniquement des rendez-vous sur place')} checked={visio} onChange={(v) => setC({ ...c, settings: { ...c.settings, planning: { ...(c.settings?.planning || {}), visio: v } } })} />
          </div>
          <div className="btns"><button className="btn" onClick={save}>{t('Enregistrer')}</button></div>
        </div>
      </div>
      <CropSheet file={crop} onClose={() => setCrop(null)} onDone={saveLogo} title={t('Recadrer le logo')} />
    </div>
  );
}

const ROLE = { gerant: 'Gérant', chef: "Chef d'équipe", ouvrier: 'Ouvrier' };
const COLORS = ['#2B1F1C', '#B4432A', '#1F6F78', '#6B4E9B', '#B5651D', '#2E7D32', '#AD1457', '#455A64'];
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
  const msg = code && t('Rejoignez {c} sur Artesa : créez votre compte sur {u} puis choisissez « Rejoindre une équipe » avec le code {k}.', { c: company.name, u: location.origin + '/inscription/artisan', k: code });
  return (
    <Sheet open onClose={() => { setCode(null); onClose(); }} title={t('Inviter un membre')}>
      {code ? (<div className="center"><p>{t('Code d’invitation')}</p><div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 6 }} className="red-t">{code}</div><p className="small muted">{msg}</p>
        <div className="btns" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}><a className="btn ghost" href={`sms:?&body=${encodeURIComponent(msg)}`}>{t('SMS')}</a><a className="btn ghost" href={`mailto:?subject=${encodeURIComponent(t('Invitation Artesa'))}&body=${encodeURIComponent(msg)}`}>{t('E-mail')}</a></div></div>) : (<>
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

// Numérotation : une série par préfixe et par année, continue et sans trou.
// Un préfixe déjà utilisé cette année est verrouillé (exigence facture électronique : numéros uniques et chronologiques).
const PREFIX_RE = /^[A-Z0-9]{1,6}$/;
function PrefixField({ label, k, value, onChange, counters, kindLabel: kl }) {
  const { confirm } = useApp();
  const yr = new Date().getFullYear();
  const used = Number(counters?.[`${value}-${yr}`] || 0);
  const [edit, setEdit] = useState(false);
  const locked = used > 0 && !edit;
  const bad = value && !PREFIX_RE.test(value);
  return (
    <label className={'field' + (bad ? ' missing' : '')}><span>{label}</span>
      <div className="row" style={{ gap: 6 }}>
        <input value={value} disabled={locked} maxLength={6} onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} style={{ flex: 1 }} />
        {used > 0 && !edit && <button type="button" className="iconbtn" title={t('Déverrouiller')} onClick={async () => { if (await confirm({ title: t('Changer le préfixe des {k} ?', { k: kl }), text: t('{n} documents ont déjà été émis avec « {p} » cette année. Changer de préfixe crée une nouvelle série : c’est autorisé, mais chaque série doit rester continue et vous devrez pouvoir la justifier. Conseillé seulement au 1er janvier.', { n: used, p: value }), ok: t('Changer quand même'), danger: true })) setEdit(true); }}><LuLock /></button>}
      </div>
      <span className="small faint" style={{ fontWeight: 400 }}>{bad ? t('Lettres et chiffres uniquement (6 max.)') : t('Prochain : {n}', { n: `${value || '…'}-${yr}-${String((Number(counters?.[`${value}-${yr}`] || 0)) + 1).padStart(4, '0')}` })}</span>
    </label>
  );
}

// Réglages séparés : « Devis » et « Factures » (chacun avec ses valeurs par défaut et l'accès au modèle PDF)
export const QuoteSettings = () => <DocSettings scope="devis" />;
export const InvoiceSettings = () => <DocSettings scope="factures" />;
export function DocSettings({ scope = 'factures' }) {
  const { company, setCompany, run, toast } = useApp();
  const [s, setS] = useState({ quotePrefix: 'DE', invoicePrefix: 'FA', creditPrefix: 'AV', vat: 20, validity: 30, depositPct: 30, quoteTerms: '', paymentTerms: '30 jours fin de mois', penalties: "3 fois le taux d'intérêt légal", discount: 'Aucun pour paiement anticipé', mediator: '', labourRate: 45, onlinePayment: true, einvoice: true, ...(company.settings?.docs || {}) });
  const [iban, setIban] = useState({ iban: company.iban || '', bic: company.bic || '' });
  const isQ = scope === 'devis';
  const F = (k, label, props = {}) => <Field label={label} req={props.req}><input value={s[k] ?? ''} onChange={(e) => setS({ ...s, [k]: e.target.value })} {...props} req={undefined} /></Field>;
  const save = () => {
    const ps = [s.quotePrefix, s.invoicePrefix, s.creditPrefix];
    if (ps.some((x) => !PREFIX_RE.test(x || ''))) return toast(t('Préfixes : lettres et chiffres uniquement (6 max.)'), true);
    if (new Set(ps).size < 3) return toast(t('Les trois préfixes doivent être différents.'), true);
    return run(async () => { const settings = { ...company.settings, docs: { ...s, vat: Number(s.vat), validity: Number(s.validity), labourRate: Number(s.labourRate), depositPct: Number(s.depositPct) } }; await api.update('companies', { id: company.id }, { settings, ...(isQ ? {} : iban) }); setCompany({ ...company, settings, ...(isQ ? {} : iban) }); }, t('Réglages enregistrés'));
  };
  const P = (k, label, kl) => <PrefixField k={k} label={label} kindLabel={kl} value={s[k] || ''} counters={company.counters} onChange={(v) => setS({ ...s, [k]: v })} />;
  const pdfRow = <Link className="r" to="/pro/compte/pdf"><span className="k">{t('Modèle du PDF')}<small style={{ display: 'block', fontWeight: 400, color: 'var(--text-2)', fontSize: 12.5 }}>{t({ classique: 'Classique', moderne: 'Moderne', epure: 'Épuré' }[company.settings?.pdf?.template || 'classique'])} · {t('commun aux devis et factures')}</small></span><span className="v">›</span></Link>;
  return (
    <div className="content narrow">
      <TopBar title={isQ ? t('Devis') : t('Factures')} sub={t('Paramètres')} />
      <Sec title={t('Numérotation')} />
      {isQ ? <div className="form-grid two">{P('quotePrefix', t('Préfixe devis'), t('devis'))}</div>
        : <div className="form-grid two">{P('invoicePrefix', t('Préfixe factures'), t('factures'))}{P('creditPrefix', t('Préfixe avoirs'), t('avoirs'))}</div>}
      {!isQ && <div className="notice small num-lock"><LuLock style={{ flexShrink: 0, marginTop: 2 }} /><div>{t('Les numéros sont attribués automatiquement à l’envoi, à la suite, sans trou, par année. Une facture envoyée ne peut plus être modifiée ni supprimée : pour la corriger, faites un avoir. La date d’une facture est celle de son émission.')}</div></div>}
      <Sec title={t('Valeurs par défaut')} />
      {isQ ? <>
        <div className="form-grid two">
          <Field label={t('TVA par défaut')}><select value={s.vat} onChange={(e) => setS({ ...s, vat: e.target.value })}>{[20, 10, 5.5, 2.1, 0].map((r) => <option key={r} value={r}>{r} %</option>)}</select></Field>
          {F('validity', t('Validité des devis (jours)'), { type: 'number', min: 1 })}
          {F('labourRate', t('Taux horaire main-d’œuvre (€ HT)'), { type: 'number' })}
          <Field label={t('Acompte demandé à la signature')}><select value={s.depositPct} onChange={(e) => setS({ ...s, depositPct: e.target.value })}>{[0, 10, 20, 30, 40, 50].map((r) => <option key={r} value={r}>{r ? r + ' %' : t('Aucun')}</option>)}</select></Field>
        </div>
        {F('quoteTerms', t('Mention en bas des devis'), { placeholder: t('ex. Devis gratuit. Bon pour accord : date et signature.') })}
      </> : <>
        <div className="form-grid two">
          {F('paymentTerms', t('Conditions de paiement'), { req: 1 })}{F('penalties', t('Pénalités de retard'), { req: 1 })}{F('discount', t('Escompte'), { req: 1 })}
        </div>
      </>}
      <p className="small faint"><b className="req-star">*</b> {t('mention obligatoire sur les devis et factures (et pour la facture électronique)')}</p>
      {F('mediator', t('Médiateur de la consommation (obligatoire pour les particuliers)'), { placeholder: t('Nom et site du médiateur'), req: 1 })}
      {!isQ && <>
        <Sec title={t('Paiement')} />
        <div className="form-grid two"><Field label="IBAN" req><input value={iban.iban} onChange={(e) => setIban({ ...iban, iban: e.target.value.toUpperCase() })} /></Field><Field label="BIC"><input value={iban.bic} onChange={(e) => setIban({ ...iban, bic: e.target.value.toUpperCase() })} /></Field></div>
      </>}
      <div className="kv mt">
        {!isQ && <SettingToggle label={t('Paiement en ligne (carte, prélèvement)')} hint={t('Ajoute un encart « Payer en ligne » sur vos factures (paiement en ligne bientôt disponible)')} checked={s.onlinePayment} onChange={(v) => setS({ ...s, onlinePayment: v })} />}
        {!isQ && <SettingToggle label={t('Facture électronique')} hint={t('Format exigé entre entreprises à partir de 2026–2027 (transmission via plateforme agréée bientôt disponible)')} checked={s.einvoice} onChange={(v) => setS({ ...s, einvoice: v })} />}
        {pdfRow}
        <Link className="r" to={isQ ? '/pro/compte/factures' : '/pro/compte/devis'}><span className="k">{isQ ? t('Paramètres des factures') : t('Paramètres des devis')}</span><span className="v">›</span></Link>
      </div>
      <div className="btns"><button className="btn" onClick={save}>{t('Enregistrer')}</button></div>
    </div>
  );
}

const TEMPLATES = [
  ['classique', 'Classique', 'Logo et titre en haut, tableau coloré'],
  ['moderne', 'Moderne', 'Bandeau de couleur en en-tête'],
  ['epure', 'Épuré', 'Sobre, filets fins, sans aplat'],
];
export function PdfSettings() {
  const { company, setCompany, run, profile } = useApp();
  const [p, setP] = useState({ color: '#B4432A', footer: '', signature: '', template: 'classique', ...(company.settings?.pdf || {}) });
  const [kind, setKind] = useState('facture');
  const logoUrl = useLogo(company);
  const sample = { kind, number: kind === 'devis' ? 'DE-2027-0001' : 'FA-2027-0001', issue_date: new Date().toISOString().slice(0, 10), due_date: new Date().toISOString().slice(0, 10), validity_days: 30, object: kind === 'devis' ? t('Exemple de devis') : t('Exemple de facture'), lines: [{ id: 'a', kind: 'section', label: t('Détail fournitures') }, { id: 'b', kind: 'item', label: t('Fourniture'), qty: 1, unit: 'u', price: 100, vat: 20 }, { id: 'c', kind: 'section', label: t('Détail prestations') }, { id: 'd', kind: 'item', label: t('Main-d’œuvre'), qty: 2, unit: 'h', price: 45, vat: 20 }], conditions: {}, totals: {}, operations_nature: 'Biens et services', paid_amount: 0 };
  const mini = (k) => k === 'moderne' ? <><i style={{ left: 0, right: 0, top: 0, height: 18, background: p.color }} /><i style={{ left: 8, top: 4, width: 14, height: 10, background: '#fff', borderRadius: 2 }} /><i style={{ left: 8, right: 8, top: 32, height: 6, background: '#2B1F1C' }} /><i style={{ left: 8, right: 8, top: 42, height: 3, background: '#E5E7EE' }} /><i style={{ left: 8, right: 8, top: 48, height: 3, background: '#E5E7EE' }} /></>
    : k === 'epure' ? <><i style={{ left: 8, top: 6, width: 14, height: 10, border: '1.5px solid ' + p.color, borderRadius: 2 }} /><i style={{ left: 8, right: 8, top: 22, height: 1.5, background: p.color }} /><i style={{ left: 8, right: 8, top: 32, height: 1.5, background: p.color }} /><i style={{ left: 8, right: 8, top: 40, height: 3, background: '#E5E7EE' }} /><i style={{ left: 8, right: 8, top: 46, height: 3, background: '#E5E7EE' }} /></>
    : <><i style={{ left: 8, top: 6, width: 14, height: 10, background: '#2B1F1C', borderRadius: 2 }} /><i style={{ right: 8, top: 7, width: 22, height: 5, background: p.color }} /><i style={{ left: 8, right: 8, top: 30, height: 6, background: p.color }} /><i style={{ left: 8, right: 8, top: 40, height: 3, background: '#E5E7EE' }} /><i style={{ left: 8, right: 8, top: 46, height: 3, background: '#E5E7EE' }} /></>;
  return (
    <div className="content">
      <TopBar title={t('Modèle du PDF')} />
      <div className="grid2">
        <div>
          <Sec title={t('Modèle')} />
          <div className="tpl-pick">{TEMPLATES.map(([k, l, d]) => <button key={k} type="button" className={p.template === k ? 'on' : ''} onClick={() => setP({ ...p, template: k })}><div className="mini">{mini(k)}</div><b>{t(l)}</b><div className="small muted">{t(d)}</div></button>)}</div>
          <Sec title={t('Personnalisation')} />
          <Field label={t('Couleur')}><input type="color" value={p.color} onChange={(e) => setP({ ...p, color: e.target.value })} style={{ height: 48 }} /></Field>
          <div className="row mb"><button className="btn ghost sm" onClick={() => navigate('/pro/compte/entreprise')}><LuImage /> {company.logo_path ? t('Changer le logo') : t('Ajouter mon logo')}</button></div>
          <p className="small faint">{t('Votre logo apparaît en haut à gauche ; la mention « Document réalisé avec Artesa » en bas de page.')}</p>
          <Sec title={t('Signature')} />
          <SignatureEditor p={p} setP={setP} defaultName={fullName(profile)} />
          <Field label={t('Pied de page')}><input value={p.footer} onChange={(e) => setP({ ...p, footer: e.target.value })} placeholder={t('ex. Membre d’une association agréée')} /></Field>
          <button className="btn block" onClick={() => { if (!p.sig_text) return alert(t('Saisissez votre nom pour créer votre signature.')); run(async () => { const settings = { ...company.settings, pdf: p }; await api.update('companies', { id: company.id }, { settings }); setCompany({ ...company, settings }); }, t('Modèle enregistré')); }}>{t('Enregistrer')}</button>
        </div>
        <div>
          <Sec title={t('Aperçu')}><div style={{ minWidth: 180 }}><Seg options={[['facture', t('Facture')], ['devis', t('Devis')]]} value={kind} onChange={setKind} /></div></Sec>
          <div className="a4-wrap" style={{ height: 560 }}><div style={{ transform: 'scale(.46)', transformOrigin: 'top left', width: 794 }}><A4 d={sample} logoUrl={logoUrl} company={{ ...company, settings: { ...company.settings, pdf: p } }} client={{ type: 'particulier', first_name: 'Tiago', last_name: 'Bernard', billing_address: '3 rue des Fleurs', billing_zip: '06800', billing_city: 'Cagnes-sur-Mer' }} /></div></div>
        </div>
      </div>
    </div>
  );
}

export function NotifSettings() {
  const { profile, setProfile, company } = useApp();
  const [n, setN] = useState({ push: true, email: true, sms: false, demande: true, rdv: true, devis: true, paiement: true, message: true, rappel_rdv: true, ...(profile.notif_prefs || {}) });
  const set = async (k, v) => { const x = { ...n, [k]: v }; setN(x); await api.update('profiles', { id: profile.id }, { notif_prefs: x }); setProfile({ ...profile, notif_prefs: x }); };
  const R = ([k, l, sub]) => <SettingToggle key={k} label={t(l)} hint={sub && t(sub)} checked={n[k]} onChange={(v) => set(k, v)} />;
  const rel = company?.settings?.relances;
  return (
    <div className="content narrow">
      <TopBar title={t('Notifications')} />
      <Sec title={t('Canaux')} />
      <div className="kv"><DeviceNotif />{[['push', 'Notifications dans l’application'], ['email', 'E-mail', 'Bientôt disponible'], ['sms', 'SMS', 'Bientôt disponible']].map(R)}</div>
      <Sec title={t('Mes alertes')} />
      <div className="kv">{[['demande', 'Nouvelle demande', 'Un particulier demande un rendez-vous'], ['rdv', 'RDV à valider'], ['devis', 'Devis signé ou refusé'], ['paiement', 'Paiement reçu'], ['message', 'Nouveau message']].map(R)}</div>
      <Sec title={t('Envois automatiques aux clients')} />
      <div className="kv">
        {R(['rappel_rdv', 'Rappel de RDV', 'La veille du rendez-vous'])}
      </div>
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
      <div className="list"><MenuRow onClick={() => wip(t('Le paiement en ligne'))} icon={LuCreditCard} label={t('Paiement en ligne')} sub={t('Carte et prélèvement SEPA')} /><MenuRow onClick={() => wip(t('La facture électronique via Artesa'))} icon={LuFileText} label={t('Facture électronique')} sub={t('Plateforme agréée')} /></div>
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
      <p className="small muted">{t('Les avis sont vérifiés (seulement après un vrai RDV) et relus par Artesa avant publication.')}</p>
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
