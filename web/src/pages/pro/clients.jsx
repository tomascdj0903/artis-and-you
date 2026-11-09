import { RateBox, InviteClientButtons } from './messages.jsx';
import { useState } from 'react';
import { LuChartColumn, LuMessageSquare, LuHistory, LuPlus, LuPencil, LuEuro, LuFileText, LuFilePen, LuX, LuCamera, LuCalendarCheck, LuHardHat, LuFolderOpen, LuMail } from 'react-icons/lu';
import { api } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { navigate, useLocation } from '../../lib/router.jsx';
import { t } from '../../lib/i18n.js';
import { money, date, dateTime, clientName, fullName, dateMed, hm } from '../../lib/format.js';
import { effectiveStatus, LEGAL_FORMS } from '../../lib/docs.js';
import { AddressFields, COUNTRIES } from '../../ui/address.jsx';
import { TopBar, SearchBar, Sec, KV, Table, Pill, Sheet, Chips, Field, useData, Loader, Empty, Seg } from '../../ui/index.jsx';
import { KpiView } from './kpi.jsx';
import { DocList } from './doclist.jsx';
import { Chat } from '../common/chat.jsx';
import { clientAddress } from '../common/docview.jsx';

export const typePill = (c) => (c.type === 'pro' ? <Pill c="navy">{t('Pro')}</Pill> : <Pill c="red-o">{t('Particulier')}</Pill>);

export function balanceOf(docs) {
  return docs.filter((d) => d.number && d.kind !== 'devis' && d.status !== 'annulee').reduce((s, d) => {
    if (d.kind === 'avoir') return s - Math.abs(Number(d.totals?.ttc || 0));
    return s + Math.max(0, Number(d.totals?.net ?? d.totals?.ttc ?? 0) - Number(d.paid_amount || 0));
  }, 0);
}

const norm = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const PERIODS = [['', 'Toutes'], ['30', '30 derniers jours'], ['90', '3 derniers mois'], ['365', '12 derniers mois'], ['year', 'Cette année']];
const SORTS = [['recent', 'Plus récents'], ['name', 'Nom (A → Z)'], ['city', 'Ville'], ['ca', 'Chiffre d’affaires'], ['due', 'Montant dû']];
const EMPTY_F = { type: '', status: '', cities: [], country: '', period: '', from: '', to: '', caMin: '', caMax: '', due: false, account: '', sort: 'recent' };

export function Clients() {
  const { company } = useApp();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(() => { try { return { ...EMPTY_F, ...JSON.parse(localStorage.getItem('ay-clients-filter') || '{}') }; } catch { return EMPTY_F; } });
  const setFilter = (x) => { setF(x); try { localStorage.setItem('ay-clients-filter', JSON.stringify(x)); } catch {} };
  const [b, , loading] = useData(async () => {
    const [clients, docs] = await Promise.all([api.select('clients', { company_id: company.id }, { order: 'created_at.desc' }), api.select('documents', { company_id: company.id })]);
    const stats = {};
    for (const d of docs) {
      if (!d.number || d.kind === 'devis' || d.status === 'annulee') continue;
      const s = (stats[d.client_id] = stats[d.client_id] || { ca: 0, due: 0 });
      const sign = d.kind === 'avoir' ? -1 : 1;
      s.ca += sign * Math.abs(Number(d.totals?.ht || 0));
      if (d.kind !== 'avoir') s.due += Math.max(0, Number(d.totals?.net ?? d.totals?.ttc ?? 0) - Number(d.paid_amount || 0));
    }
    return { clients: clients.map((c) => ({ ...c, ca: stats[c.id]?.ca || 0, due: stats[c.id]?.due || 0 })) };
  }, []);
  if (loading || !b) return <div className="content"><TopBar title={t('Clients')} /><Loader /></div>;
  const data = b.clients;
  const city = (c) => c.site_city || c.billing_city || '';
  const cities = [...new Set(data.map(city).filter(Boolean))].sort((x, y) => x.localeCompare(y));
  const countries = [...new Set(data.map((c) => c.billing_country || 'France'))];
  const since = f.period === 'year' ? `${new Date().getFullYear()}-01-01` : f.period ? new Date(Date.now() - Number(f.period) * 864e5).toISOString().slice(0, 10) : f.from;
  const n = norm(q);
  let list = data.filter((c) => (!f.type || c.type === f.type) && (!f.status || c.status === f.status)
    && (!f.cities.length || f.cities.includes(city(c))) && (!f.country || (c.billing_country || 'France') === f.country)
    && (!since || (c.created_at || '').slice(0, 10) >= since) && (!f.to || (c.created_at || '').slice(0, 10) <= f.to)
    && (f.caMin === '' || c.ca >= Number(f.caMin)) && (f.caMax === '' || c.ca <= Number(f.caMax)) && (!f.due || c.due > 0.005)
    && (!f.account || (f.account === 'oui' ? !!c.user_id : !c.user_id)))
    .filter((c) => !n || norm([c.last_name, c.first_name, c.company_name, c.trade_name, c.billing_city, c.site_city, c.number, c.email, c.mobile, c.phone].join(' ')).includes(n));
  const by = { name: (x, y) => clientName(x).localeCompare(clientName(y)), city: (x, y) => city(x).localeCompare(city(y)), ca: (x, y) => y.ca - x.ca, due: (x, y) => y.due - x.due, recent: (x, y) => (y.created_at || '').localeCompare(x.created_at || '') }[f.sort];
  list = list.slice().sort(by);
  const active = [
    f.type && [t(f.type === 'pro' ? 'Pro' : 'Particulier'), { type: '' }], f.status && [t({ actif: 'Actif', prospect: 'Prospect', inactif: 'Inactif' }[f.status]), { status: '' }],
    ...f.cities.map((x) => [x, { cities: f.cities.filter((y) => y !== x) }]), f.country && [t(f.country), { country: '' }],
    (f.period || f.from || f.to) && [f.period ? t(PERIODS.find((p) => p[0] === f.period)[1]) : `${f.from ? date(f.from) : '…'} → ${f.to ? date(f.to) : '…'}`, { period: '', from: '', to: '' }],
    (f.caMin !== '' || f.caMax !== '') && [`${t('CA')} ${f.caMin || 0} – ${f.caMax || '∞'} €`, { caMin: '', caMax: '' }], f.due && [t('Avec un montant dû'), { due: false }],
    f.account && [f.account === 'oui' ? t('Avec compte Artesa') : t('Sans compte Artesa'), { account: '' }],
  ].filter(Boolean);
  return (
    <div className="content">
      <TopBar title={t('Clients')} back={false} />
      <SearchBar placeholder={t('Recherchez un client')} value={q} onChange={setQ} onFilter={() => setOpen(true)} filterActive={active.length > 0} />
      {active.length > 0 && <div className="chips">{active.map(([l, patch], i) => <button key={i} className="chip on" onClick={() => setFilter({ ...f, ...patch })}>{l} ✕</button>)}<button className="link red small" onClick={() => setFilter({ ...EMPTY_F, sort: f.sort })}>{t('Tout effacer')}</button></div>}
      {data.some((c) => !c.user_id && c.type !== 'pro') && <button className="invite-strip" onClick={() => navigate('/pro/reseau/inviter-clients')}>📣 <span className="grow"><b>{t('Inviter mes clients sur Artesa')}</b><small>{t('Gratuit pour eux : ils retrouvent leurs documents et vous écrivent directement.')}</small></span><span className="red-t bold">›</span></button>}
      <Sec title={t('Mes clients')} meta={<span className="row" style={{ gap: 8 }}>{list.length !== data.length ? t('{n} sur {m}', { n: list.length, m: data.length }) : t('{n} clients', { n: data.length })}
        <select className="mini-select" value={f.sort} onChange={(e) => setFilter({ ...f, sort: e.target.value })} aria-label={t('Trier')}>{SORTS.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select></span>} />
      <Table rows={list} onRow={(c) => navigate('/pro/clients/' + c.id)} empty={data.length ? t('Aucun client ne correspond à ces filtres.') : t('Aucun client. Ajoutez votre premier client avec le bouton +.')}
        cols={[
          { label: t('Type'), render: typePill },
          { label: t('Nom'), strong: true, render: (c) => c.last_name || '—' },
          { label: t('Prénom'), render: (c) => c.first_name || '—' },
          { label: t('Raison sociale'), strong: true, render: (c) => c.trade_name || c.company_name || '—' },
          { label: t('Ville'), render: (c) => <span className="muted">{city(c)}</span> },
          ...(f.sort === 'ca' || f.caMin !== '' || f.caMax !== '' ? [{ label: t('CA HT'), num: true, render: (c) => money(c.ca, 0) }] : []),
          ...(f.sort === 'due' || f.due ? [{ label: t('Dû'), num: true, render: (c) => <span className={c.due > 0 ? 'red-t' : ''}>{money(c.due)}</span> }] : []),
        ]} />
      <button className="fab" onClick={() => navigate('/pro/clients/nouveau')} aria-label={t('Nouveau client')}><LuPlus /></button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('Filtrer')}>
        <div className="small bold">{t('Type')}</div>
        <Chips options={[['', t('Tous')], ['pro', t('Pro')], ['particulier', t('Particulier')]]} value={f.type} onChange={(type) => setFilter({ ...f, type })} />
        <div className="small bold">{t('Statut')}</div>
        <Chips options={[['', t('Tous')], ['actif', t('Actif')], ['prospect', t('Prospect')], ['inactif', t('Inactif')]]} value={f.status} onChange={(status) => setFilter({ ...f, status })} />
        {cities.length > 0 && <><div className="small bold">{t('Ville')}</div><Chips multi scroll={cities.length > 8} options={cities.map((x) => [x, x])} value={f.cities} onChange={(c2) => setFilter({ ...f, cities: c2 })} /></>}
        {countries.length > 1 && <><div className="small bold">{t('Pays')}</div><Chips options={[['', t('Tous')], ...countries.map((x) => [x, t(x)])]} value={f.country} onChange={(country) => setFilter({ ...f, country })} /></>}
        <div className="small bold">{t('Client depuis')}</div>
        <Chips options={PERIODS.map(([k, l]) => [k, t(l)])} value={f.period} onChange={(period) => setFilter({ ...f, period, from: '', to: '' })} />
        <div className="form-grid two"><Field label={t('Du')}><input type="date" value={f.from} onChange={(e) => setFilter({ ...f, from: e.target.value, period: '' })} /></Field><Field label={t('Au')}><input type="date" value={f.to} onChange={(e) => setFilter({ ...f, to: e.target.value, period: '' })} /></Field></div>
        <div className="small bold">{t('Chiffre d’affaires facturé (€ HT)')}</div>
        <div className="form-grid two"><Field label={t('Minimum')}><input type="number" min="0" value={f.caMin} onChange={(e) => setFilter({ ...f, caMin: e.target.value })} /></Field><Field label={t('Maximum')}><input type="number" min="0" value={f.caMax} onChange={(e) => setFilter({ ...f, caMax: e.target.value })} /></Field></div>
        <label className="check"><input type="checkbox" checked={f.due} onChange={(e) => setFilter({ ...f, due: e.target.checked })} />{t('Seulement les clients avec un montant dû')}</label>
        <div className="small bold">{t('Compte Artesa')}</div>
        <Chips options={[['', t('Tous')], ['oui', t('Avec compte')], ['non', t('Sans compte')]]} value={f.account} onChange={(account) => setFilter({ ...f, account })} />
        <div className="btns"><div className="two"><button className="btn ghost" onClick={() => setFilter({ ...EMPTY_F, sort: f.sort })}>{t('Réinitialiser')}</button><button className="btn" onClick={() => setOpen(false)}>{t('Afficher {n} clients', { n: list.length })}</button></div></div>
      </Sheet>
    </div>
  );
}

const EMPTY_CLIENT = { type: 'particulier', civility: '', last_name: '', first_name: '', company_name: '', trade_name: '', legal_form: '', creation_date: '', email: '', phone: '', mobile: '', website: '', contact_name: '', contact_role: '',
  billing_address: '', billing_zip: '', billing_city: '', billing_country: 'France', site_name: '', site_address: '', site_zip: '', site_city: '', siret: '', siren: '', vat_number: '', rcs: '', payment_terms: '30 jours fin de mois', payment_mode: 'Virement', max_outstanding: 0, status: 'actif' };

export function ClientEdit({ params }) {
  const { company, run } = useApp();
  const isNew = !params.id;
  const [c, setC] = useState(null);
  useData(async () => { const x = isNew ? { ...EMPTY_CLIENT } : await api.one('clients', { id: params.id }); setC(x); }, [params.id]);
  if (!c) return <div className="content"><TopBar title={t('Client')} /><Loader /></div>;
  const F = (k, label, props = {}) => <Field label={label}><input value={c[k] ?? ''} onChange={(e) => setC({ ...c, [k]: e.target.value })} {...props} /></Field>;
  const save = async (e) => {
    e.preventDefault();
    const row = { ...c }; delete row.id; delete row.created_at;
    if (!row.creation_date) row.creation_date = null;
    row.max_outstanding = Number(row.max_outstanding) || 0;
    if (row.siret && !row.siren) row.siren = row.siret.replace(/\D/g, '').slice(0, 9);
    if (!row.site_address && row.billing_address) Object.assign(row, { site_address: row.billing_address, site_zip: row.billing_zip, site_city: row.billing_city });
    await run(async () => {
      if (isNew) {
        const n = (await api.select('clients', { company_id: company.id }, { columns: 'id' })).length + 1;
        const x = await api.insert('clients', { ...row, company_id: company.id, number: 'CL-' + String(n).padStart(5, '0') });
        navigate('/pro/clients/' + x.id, { replace: true });
      } else { await api.update('clients', { id: c.id }, row); navigate(-1); }
    }, t('Client enregistré'));
  };
  return (
    <div className="content narrow">
      <TopBar title={isNew ? t('Nouveau client') : t('Modifier le client')} sub={isNew ? '' : clientName(c)} />
      <form onSubmit={save}>
        <Seg options={[['particulier', t('Particulier')], ['pro', t('Professionnel')]]} value={c.type} onChange={(type) => setC({ ...c, type })} />
        <Sec title={t('Identité')} />
        <div className="form-grid three">
          <Field label={t('Civilité')}><select value={c.civility} onChange={(e) => setC({ ...c, civility: e.target.value })}><option value="">—</option><option>M.</option><option>Mme</option></select></Field>
          {F('last_name', t('Nom'), { required: c.type === 'particulier' })}{F('first_name', t('Prénom'))}
        </div>
        {c.type === 'pro' && <div className="form-grid two">{F('company_name', t('Raison sociale'), { required: true })}{F('trade_name', t('Enseigne commerciale'))}<Field label={t('Forme juridique')}><select value={c.legal_form || ''} onChange={(e) => setC({ ...c, legal_form: e.target.value })}><option value="">{t('Choisir')}</option>{LEGAL_FORMS.map((x) => <option key={x} value={x}>{t(x)}</option>)}</select></Field>{F('creation_date', t('Date de création'), { type: 'date' })}</div>}
        <Sec title={t('Coordonnées')} />
        <div className="form-grid two">{F('email', t('E-mail'), { type: 'email' })}{F('mobile', t('Tél. mobile'), { type: 'tel' })}{F('phone', t('Tél. fixe'), { type: 'tel' })}{c.type === 'pro' && F('website', t('Site web'))}{c.type === 'pro' && F('contact_name', t('Contact'))}{c.type === 'pro' && F('contact_role', t('Fonction du contact'))}</div>
        <Sec title={t('Adresse de facturation')} />
        <AddressFields value={c} onChange={(x) => setC({ ...c, ...x })} required={c.type === 'pro'} keys={{ address: 'billing_address', zip: 'billing_zip', city: 'billing_city', country: 'billing_country' }} />
        <Sec title={t('Adresse de livraison (lieu du chantier)')} />
        {F('site_name', t('Nom du chantier'), { placeholder: t('ex. Villa Les Lauriers') })}
        <AddressFields value={c} onChange={(x) => setC({ ...c, ...x })} keys={{ address: 'site_address', zip: 'site_zip', city: 'site_city', country: null }} />
        {c.type === 'pro' && <><Sec title={t('Informations légales')} /><div className="form-grid two">{F('siret', t('SIRET'))}{F('siren', t('SIREN'))}{F('vat_number', t('N° TVA'))}{F('rcs', t('RCS'))}</div></>}
        <Sec title={t('Paiement')} />
        <div className="form-grid three">
          {F('payment_terms', t('Conditions de paiement'))}
          <Field label={t('Mode de paiement')}><select value={c.payment_mode} onChange={(e) => setC({ ...c, payment_mode: e.target.value })}>{['Virement', 'Carte bancaire', 'Prélèvement', 'Chèque', 'Espèces'].map((m) => <option key={m} value={m}>{t(m)}</option>)}</select></Field>
          {F('max_outstanding', t('Encours maximum (€)'), { type: 'number', min: 0 })}
          <Field label={t('Statut client')}><select value={c.status} onChange={(e) => setC({ ...c, status: e.target.value })}><option value="actif">{t('Actif')}</option><option value="prospect">{t('Prospect')}</option><option value="inactif">{t('Inactif')}</option></select></Field>
        </div>
        <div className="btns"><button className="btn block">{t('Enregistrer')}</button></div>
      </form>
    </div>
  );
}

export function useClientBundle(id) {
  return useData(async () => {
    const [c, docs] = await Promise.all([api.one('clients', { id }), api.select('documents', { client_id: id })]);
    return { c, docs };
  }, [id]);
}

export function ClientCard({ params }) {
  const { company, run, confirm, can } = useApp();
  const [b, reload, loading] = useClientBundle(params.id);
  const [note, setNote] = useState(null);
  if (loading || !b) return <div className="content"><TopBar title={t('Client')} /><Loader /></div>;
  const { c, docs } = b;
  if (!c) return <div className="content"><TopBar title={t('Client')} /><Empty text={t('Client introuvable')} /></div>;
  const solde = balanceOf(docs);
  const go = (s) => navigate(`/pro/clients/${c.id}/${s}`);
  const saveNote = async () => { await run(() => api.update('clients', { id: c.id }, { note, note_updated_at: new Date().toISOString() }), t('Note enregistrée')); setNote(null); reload(); };
  const del = async () => {
    if (docs.some((d) => d.number)) return run(async () => { throw new Error(t('Ce client a des documents émis : passez-le en « Inactif » plutôt que de le supprimer.')); });
    if (await confirm({ title: t('Supprimer ce client ?'), text: t('Cette action est définitive.'), ok: t('Supprimer'), danger: true })) { await run(() => api.remove('clients', { id: c.id }), t('Client supprimé')); navigate('/pro/clients'); }
  };
  const tiles = [
    ['devis', 'Devis', 'Créer, suivre, signer', can('devis'), LuFilePen], ['factures', 'Factures', 'Paiements et relances', can('devis'), LuFileText], ['chat', 'Messages', 'Discuter avec le client', true, LuMessageSquare],
    ['historique', 'Historique', 'RDV, paiements, documents', true, LuHistory], ['docs', 'Autres docs', 'Photos, plans, attestations', true, LuFolderOpen], ['kpi', 'KPI', 'Chiffres de ce client', can('kpi'), LuChartColumn],
  ].filter((x) => x[3]);
  return (
    <div className="content">
      <TopBar title={clientName(c)} sub={c.number} right={<button className="iconbtn" onClick={() => navigate(`/pro/clients/${c.id}/modifier`)} aria-label={t('Modifier')}><LuPencil /></button>} />
      <div className="hero">
        <span className="tag pill white">{c.type === 'pro' ? t('Pro') : t('Particulier')}</span>
        <h2 style={{ paddingRight: 90 }}>{clientName(c)}</h2>
        <div className="l2">{[c.type === 'pro' ? [c.civility, fullName(c)].filter(Boolean).join(' ') : '', c.site_city || c.billing_city].filter(Boolean).join(' · ')}</div>
        <div className="row"><span className="small">N° {c.number} · <span style={{ color: c.status === 'actif' ? '#7FD69A' : '#C6CDE3' }}>● {t({ actif: 'Actif', prospect: 'Prospect', inactif: 'Inactif' }[c.status])}</span></span>
          <div className="amount"><small>{t('Solde')}</small>{money(solde)}</div></div>
      </div>
      <div className="tiles three" style={{ marginTop: 14 }}>
        {tiles.map(([k, l, s, , Ic]) => <button key={k} className="tile ctile" onClick={() => go(k)}><Ic />{t(l)}<small>{t(s)}</small></button>)}
      </div>
      <div className="btns inline">
        <div className="two">
          {can('devis') && <button className="btn ghost sm" onClick={() => navigate(`/pro/documents/nouveau?kind=devis&client=${c.id}`)}><LuFilePen /> {t('Nouveau devis')}</button>}
          {can('devis') && <button className="btn ghost sm" onClick={() => navigate(`/pro/documents/nouveau?kind=facture&client=${c.id}`)}><LuFileText /> {t('Nouvelle facture')}</button>}
        </div>
        {can('planning') && <button className="btn ghost sm" onClick={() => navigate(`/pro/planning/nouveau?client=${c.id}`)}><LuCalendarCheck /> {t('Nouveau RDV')}</button>}
      </div>
      <div className="grid2">
        <div>
          <Sec title={t('Identité')} />
          <KV rows={[
            [t('N° client'), c.number], [t('Type de client'), c.type === 'pro' ? t('Professionnel') : t('Particulier')], [t('Civilité'), c.civility], [t('Nom'), c.last_name], [t('Prénom'), c.first_name],
            c.type === 'pro' && [t('Raison sociale'), c.company_name], c.type === 'pro' && [t('Enseigne commerciale'), c.trade_name], c.type === 'pro' && [t('Forme juridique'), c.legal_form],
            [t('Statut client'), <Pill c={c.status === 'actif' ? 'green' : 'grey'}>{t({ actif: 'Actif', prospect: 'Prospect', inactif: 'Inactif' }[c.status])}</Pill>],
            c.type === 'pro' && [t('Date de création'), date(c.creation_date)], [t('Compte Artesa'), c.user_id ? t('Oui') : t('Non')],
          ]} />
          <Sec title={t('Coordonnées')} />
          <KV rows={[
            [t('E-mail'), c.email, { href: c.email && 'mailto:' + c.email }], [t('Tél. fixe'), c.phone, { href: c.phone && 'tel:' + c.phone }], [t('Tél. mobile'), c.mobile, { href: c.mobile && 'tel:' + c.mobile }],
            c.type === 'pro' && [t('Site web'), c.website, { href: c.website && (c.website.startsWith('http') ? c.website : 'https://' + c.website) }],
            c.type === 'pro' && [t('Contact'), c.contact_name ? <>{c.contact_name}<div className="small muted">{c.contact_role}</div></> : ''],
          ]} />
          <Sec title={t('Adresses')} />
          <div className="kv">
            <div className="r" style={{ display: 'block' }}><div className="k">{t('Adresse de facturation')}</div><div className="bold">{clientAddress(c) || '—'}</div></div>
            <div className="r" style={{ display: 'block' }}><div className="k">{t('Adresse de livraison')}</div><div className="bold">{c.site_name && <div>{c.site_name}</div>}{[c.site_address, [c.site_zip, c.site_city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '—'}</div>
              {c.site_address && <a className="small red-t bold" href={'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent([c.site_address, c.site_zip, c.site_city].join(' '))} target="_blank" rel="noreferrer">{t('Itinéraire')} →</a>}</div>
          </div>
        </div>
        <div>
          {c.type === 'pro' && <><Sec title={t('Informations légales')} /><KV rows={[['SIRET', c.siret], ['SIREN', c.siren], [t('N° TVA'), c.vat_number], ['RCS', c.rcs]]} /></>}
          <Sec title={t('Paiement')} />
          <KV rows={[[t('Conditions de paiement'), c.payment_terms], [t('Mode de paiement'), t(c.payment_mode)], [t('Encours max'), money(c.max_outstanding)], [t('Solde'), money(solde), { red: solde > 0 }]]} />
          {!c.user_id && c.type !== 'pro' && <>
            <Sec title={t('Espace client Artesa')} />
            <div className="card soft"><div className="small mb">{t('Ce client n’a pas encore de compte. Invitez-le : c’est gratuit pour lui, il retrouve ses devis et factures et peut vous écrire directement.')}</div><InviteClientButtons c={c} onDone={reload} />{c.invited_at && <div className="small muted mt">{t('Invité le {d}', { d: date(c.invited_at) })}</div>}</div>
          </>}
          <Sec title={t('Fiabilité du client')} />
          <ClientRating id={c.id} />
          <div className="sec"><h2>{t('Note libre')}</h2><button className="plus" onClick={() => setNote(c.note || '')} aria-label={t('Modifier la note')}><LuPlus /></button></div>
          {note !== null ? (
            <div><textarea className="input" style={{ minHeight: 140 }} value={note} onChange={(e) => setNote(e.target.value)} autoFocus /><div className="btns"><div className="two"><button className="btn ghost" onClick={() => setNote(null)}>{t('Annuler')}</button><button className="btn" onClick={saveNote}>{t('Enregistrer')}</button></div></div></div>
          ) : c.note ? <div className="postit">{c.note}<small>{t('Modifiée le {d}', { d: date(c.note_updated_at) })}</small></div> : <p className="muted">{t('Aucune note. Touchez + pour en ajouter une.')}</p>}
          <div className="btns"><button className="btn light sm" onClick={del}>{t('Supprimer le client')}</button></div>
        </div>
      </div>
    </div>
  );
}

export function ClientKpi({ params }) {
  const [b] = useData(async () => {
    const [c, docs, appts] = await Promise.all([api.one('clients', { id: params.id }), api.select('documents', { client_id: params.id }), api.select('appointments', { client_id: params.id })]);
    return { c, docs, appts };
  }, [params.id]);
  return <div className="content"><TopBar title={t('KPI')} sub={b ? clientName(b.c) : ''} />{b ? <KpiView docs={b.docs} appts={b.appts} /> : <Loader />}</div>;
}

function ClientDocs({ params, kind }) {
  const [b, , loading] = useClientBundle(params.id);
  if (loading || !b) return <div className="content"><TopBar title={kind === 'devis' ? t('Devis') : t('Factures')} /><Loader /></div>;
  return (
    <div className="content">
      <TopBar title={kind === 'devis' ? t('Devis') : t('Factures')} sub={clientName(b.c)} />
      <DocList docs={b.docs} clients={{ [b.c.id]: b.c }} kind={kind} newHref={`/pro/documents/nouveau?kind=${kind}&client=${b.c.id}`} from="client" />
    </div>
  );
}
export const ClientInvoices = (p) => <ClientDocs {...p} kind="facture" />;
export const ClientQuotes = (p) => <ClientDocs {...p} kind="devis" />;

export function ClientChat({ params }) {
  const { company } = useApp();
  const [r] = useData(async () => {
    const c = await api.one('clients', { id: params.id });
    let conv = await api.one('conversations', { kind: 'client', company_id: company.id, client_id: params.id });
    if (!conv) conv = await api.insert('conversations', { kind: 'client', company_id: company.id, client_id: params.id, client_user_id: c.user_id || null });
    else if (c.user_id && !conv.client_user_id) await api.update('conversations', { id: conv.id }, { client_user_id: c.user_id });
    const projects = await api.select('projects', { client_id: params.id });
    return { c, conv, projects };
  }, [params.id]);
  if (!r) return <div className="content"><TopBar title={t('Chatbox')} /><Loader /></div>;
  const invite = `mailto:${r.c.email || ''}?subject=${encodeURIComponent(t('Suivez votre chantier sur Artesa'))}&body=${encodeURIComponent(t('Bonjour,\n\nPour échanger avec nous, recevoir vos devis et factures et suivre votre chantier, créez votre compte gratuit sur Artesa avec cette adresse e-mail :\n{url}\n\nÀ bientôt,\n{c}', { url: location.origin + '/inscription/particulier', c: company.name }))}`;
  return (
    <div className="content narrow">
      <TopBar title={t('Chatbox')} sub={clientName(r.c)} />
      <Chat convId={r.conv.id} projects={r.projects} banner={!r.c.user_id && (
        <div className="banner"><LuMail /><div className="grow small">{t('Ce client n’a pas encore de compte Artesa : il ne verra pas ces messages.')} <a className="red-t bold" href={invite}>{t('L’inviter par e-mail')}</a></div></div>
      )} />
    </div>
  );
}

export function ClientHistory({ params }) {
  const { query } = useLocation();
  const [tab, setTab] = useState(query.get('tab') || 'chantiers');
  const [b] = useData(async () => {
    const [c, docs, appts, pays, files, projects] = await Promise.all([
      api.one('clients', { id: params.id }), api.select('documents', { client_id: params.id }), api.select('appointments', { client_id: params.id }),
      api.select('payments', {}, { order: 'paid_on.desc' }), api.select('files', { client_id: params.id }), api.select('projects', { client_id: params.id }),
    ]);
    const ids = new Set(docs.map((d) => d.id));
    return { c, docs, appts, pays: pays.filter((p) => ids.has(p.document_id)), files, projects };
  }, [params.id]);
  if (!b) return <div className="content"><TopBar title={t('Historique')} /><Loader /></div>;
  const docNum = Object.fromEntries(b.docs.map((d) => [d.id, d]));
  let ev = [];
  if (tab === 'chantiers') {
    b.appts.forEach((a) => {
      ev.push({ at: a.created_at, icon: LuCalendarCheck, color: 'navy', title: a.requested_by ? t('Demande reçue') : t('RDV planifié'), sub: `${a.title} · ${dateMed(a.start_at)} ${hm(a.start_at)}`, link: '/pro/planning/rdv/' + a.id });
      if (a.validated_at) ev.push({ at: a.validated_at, icon: LuCalendarCheck, color: '', title: t('RDV validé'), sub: `${a.title} · ${dateMed(a.start_at)}`, link: '/pro/planning/rdv/' + a.id });
      (a.history || []).filter((h) => h.kind === 'moved').forEach((h) => ev.push({ at: h.at, icon: LuCalendarCheck, color: 'navy', title: t('RDV déplacé'), sub: `${a.title} · ${t('du {a} au {b}', { a: dateMed(h.from) + ' ' + hm(h.from), b: dateMed(h.to) + ' ' + hm(h.to) })}`, tag: t('Client prévenu'), link: '/pro/planning/rdv/' + a.id }));
      if (a.status === 'termine') ev.push({ at: a.end_at, icon: LuHardHat, color: '', title: t('Chantier terminé'), sub: a.title });
    });
    b.projects.filter((p) => p.finished_at).forEach((p) => ev.push({ at: p.finished_at, icon: LuHardHat, color: '', title: t('Chantier terminé'), sub: p.title }));
    const byDay = {};
    b.files.filter((f) => f.kind === 'photo').forEach((f) => { const k = f.created_at.slice(0, 10); byDay[k] = (byDay[k] || 0) + 1; });
    Object.entries(byDay).forEach(([d, n]) => ev.push({ at: d + 'T12:00:00', icon: LuCamera, color: 'navy', title: t('{n} photos ajoutées', { n }), sub: '', link: '/pro/photos/' + b.c.id }));
  } else if (tab === 'paiements') {
    ev = b.pays.map((p) => ({ at: p.paid_on + 'T12:00:00', when: p.created_at, icon: LuEuro, color: p.via_platform ? '' : 'ghost', title: p.via_platform ? t('{m} reçu', { m: t(p.method) }) : t('Paiement ajouté manuellement'), sub: `${docNum[p.document_id]?.number} · ${money(p.amount)} · ${t(p.method)}${p.note ? ' · ' + p.note : ''}`, tag: p.via_platform ? t('Via Artesa') : t('Ajouté par vous'), link: '/pro/documents/' + p.document_id }));
  } else {
    b.docs.filter((d) => d.number).forEach((d) => {
      const q = d.kind === 'devis';
      ev.push({ at: d.sent_at || d.created_at, icon: LuFileText, color: 'red', title: q ? t('Devis envoyé') : t('Facture envoyée'), sub: `${d.number} · ${money(d.totals?.ht)} ${t('HT')} · ${d.object}`, tag: q && d.status === 'envoye' ? t('En attente de signature') : '', link: '/pro/documents/' + d.id });
      if (d.accepted_at) ev.push({ at: d.accepted_at, icon: LuFilePen, color: '', title: t('Devis signé'), sub: `${d.number} · ${money(d.totals?.ht)} ${t('HT')}${d.signed_name ? ' · ' + t('Signé par {n}', { n: d.signed_name }) : ''}`, tag: t('Signé'), link: '/pro/documents/' + d.id });
      if (d.refused_at) ev.push({ at: d.refused_at, icon: LuX, color: 'ghost', title: t('Devis refusé'), sub: d.number, link: '/pro/documents/' + d.id });
    });
    b.files.filter((f) => f.kind === 'doc').forEach((f) => ev.push({ at: f.created_at, icon: LuFolderOpen, color: 'navy', title: f.shared_with_client ? t('Document partagé avec le client') : t('Document ajouté'), sub: f.name, link: '/pro/autres-docs/' + b.c.id }));
  }
  ev.sort((a, b2) => (b2.at || '').localeCompare(a.at || ''));
  let last = '';
  return (
    <div className="content narrow">
      <TopBar title={t('Historique')} sub={clientName(b.c)} />
      <Chips options={[['chantiers', t('Chantiers')], ['paiements', t('Paiements')], ['documents', t('Documents')]]} value={tab} onChange={setTab} />
      {!ev.length ? <Empty text={t('Rien pour le moment')} /> : (
        <div className="timeline">
          {ev.map((e, i) => {
            const day = (e.at || '').slice(0, 10); const show = day !== last; last = day;
            const I = e.icon;
            return (
              <div key={i}>
                {show && <div className="tl-day">{dateMed(day)}</div>}
                <div className="tl-item" onClick={e.link ? () => navigate(e.link) : undefined} style={e.link ? { cursor: 'pointer' } : undefined}>
                  <div className={'tl-ico ' + e.color}><I /></div>
                  <div className="tl-card"><div className="h">{e.title}<small>{hm(e.when || e.at)}</small></div><div className="small muted">{e.sub}</div>{e.tag && <div style={{ marginTop: 6 }}><Pill c={e.color === 'ghost' ? 'grey' : 'green'}>{e.tag}</Pill></div>}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ClientRating({ id }) {
  const { run } = useApp();
  const [score, reload] = useData(() => api.rpc('client_score', { p_client: id }).catch(() => null), [id]);
  return <RateBox score={score} label={t('Client sérieux ? Ponctuel, paie à temps ? Notez-le (une seule fois, visible des autres pros).')} onRate={(r, cm) => run(() => api.rpc('rate_client', { p_client: id, p_rating: r, p_comment: cm }), t('Merci pour votre note')).then(reload)} />;
}
