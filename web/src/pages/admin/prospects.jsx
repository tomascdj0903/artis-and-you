// Prospection de l'équipe Artesa : carnet de prospects importable (Excel/CSV), qui s'en occupe (Tomas, Clément…),
// qui a travaillé dessus, historique des échanges, relances, export. Pensé pour 2 personnes sur le même compte.
import { useMemo, useRef, useState } from 'react';
import { LuPlus, LuTrash2, LuSave, LuUpload, LuDownload, LuPhone, LuMail, LuGlobe, LuLayoutGrid, LuList, LuBellRing, LuUserCheck, LuNotebookPen, LuCalendarPlus, LuUserPlus, LuX } from 'react-icons/lu';
import { api } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { navigate } from '../../lib/router.jsx';
import { t } from '../../lib/i18n.js';
import { money0, date, rel, iso } from '../../lib/format.js';
import { usePlatform, useWho } from '../../lib/platform.js';
import { readSheet, makeXlsx, download } from '../../lib/xlsx.js';
import { TopBar, Pill, useData, Loader, Empty, Chips, Sheet, Field, Table, SearchBar } from '../../ui/index.jsx';

export const STAGES = [['prospect', 'À contacter'], ['contacte', 'Contacté'], ['demo', 'Démo prévue'], ['essai', 'En essai'], ['client', 'Abonné'], ['perdu', 'Perdu']];
const STAGE = Object.fromEntries(STAGES);
const OPEN = (d) => !['client', 'perdu'].includes(d.stage);
const EV = { appel: ['Appel', LuPhone], email: ['E-mail', LuMail], rdv: ['Rendez-vous', LuCalendarPlus], note: ['Note', LuNotebookPen], etape: ['Étape', LuUserCheck], import: ['Import', LuUpload] };
const EMPTY = { title: '', contact_name: '', company_name: '', email: '', phone: '', address: '', zip: '', city: '', trade: '', siret: '', website: '', source: '', stage: 'prospect', plan: 'solo', value: 0, priority: 'normale', owner: '', worked_by: [], tags: [], next_action: '', next_date: '', notes: '' };

// Colonnes reconnues automatiquement à l'import (en-têtes usuels, sans accents ni majuscules)
const FIELDS = [
  ['title', 'Nom / entreprise', ['entreprise', 'societe', 'raison sociale', 'nom entreprise', 'denomination', 'nom commercial', 'enseigne', 'company', 'name', 'nom']],
  ['contact_name', 'Contact', ['contact', 'interlocuteur', 'gerant', 'dirigeant', 'responsable', 'prenom nom', 'nom contact', 'nom du contact']],
  ['email', 'E-mail', ['email', 'e-mail', 'mail', 'courriel', 'adresse mail', 'adresse e-mail']],
  ['phone', 'Téléphone', ['telephone', 'tel', 'tél', 'portable', 'mobile', 'phone', 'numero', 'gsm']],
  ['address', 'Adresse', ['adresse', 'rue', 'address', 'voie']],
  ['zip', 'Code postal', ['code postal', 'cp', 'zip', 'postal']],
  ['city', 'Ville', ['ville', 'commune', 'city', 'localite']],
  ['trade', 'Métier', ['metier', 'activite', 'secteur', 'corps de metier', 'specialite', 'naf', 'categorie']],
  ['siret', 'SIRET', ['siret', 'siren']],
  ['website', 'Site web', ['site', 'site web', 'website', 'url', 'internet']],
  ['source', 'Origine', ['source', 'origine', 'provenance', 'canal']],
  ['owner', 'Responsable', ['responsable', 'commercial', 'owner', 'attribue a', 'suivi par']],
  ['next_date', 'Date de relance', ['relance', 'date relance', 'prochaine action', 'rappel', 'a rappeler le']],
  ['notes', 'Notes', ['notes', 'note', 'commentaire', 'commentaires', 'remarque', 'remarques', 'observations']],
];
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[_.]/g, ' ').replace(/\s+/g, ' ').trim();
const digits = (s) => String(s || '').replace(/\D/g, '');
function guessMap(head) {
  const used = new Set(), map = {};
  for (const [k, , syn] of FIELDS) {
    const i = head.findIndex((h, j) => !used.has(j) && syn.includes(norm(h)));
    const j = i >= 0 ? i : head.findIndex((h, x) => !used.has(x) && syn.some((s) => s.length > 3 && norm(h).includes(s)));
    if (j >= 0) { map[k] = j; used.add(j); }
  }
  return map;
}
const toDate = (v) => {
  if (!v) return null; const s = String(v).trim();
  if (/^\d{5}(\.\d+)?$/.test(s)) return iso(new Date(Date.UTC(1899, 11, 30) + Number(s) * 864e5)); // date Excel
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/); if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};
const dupKey = (d) => [d.email && 'e:' + String(d.email).toLowerCase().trim(), digits(d.phone).length >= 9 && 'p:' + digits(d.phone).slice(-9), digits(d.siret).length >= 9 && 's:' + digits(d.siret).slice(0, 9), d.title && 'n:' + norm(d.title) + '|' + norm(d.city)].filter(Boolean);

// Bandeau « Qui travaille ? »
export function WhoBar() {
  const { profile } = useApp();
  const [who, setWho, team] = useWho(profile);
  return (
    <div className={'card soft row wrap mb' + (who ? '' : ' warn')} style={{ gap: 10, alignItems: 'center', padding: '10px 14px' }}>
      <span className="small bold">{who ? t('Vous travaillez en tant que') : t('Qui travaille sur cet appareil ?')}</span>
      <Chips options={team.map((n) => [n, n])} value={who} onChange={setWho} />
      {!who && <span className="small muted">{t('Choisissez votre nom : vos actions seront signées.')}</span>}
    </div>
  );
}

export function AdminPipeline() {
  const { profile, run } = useApp();
  const s = usePlatform();
  const [who, , team] = useWho(profile);
  const [q, setQ] = useState('');
  const [view, setView] = useState(() => { try { return localStorage.getItem('ay_pipe_view') || 'kanban'; } catch { return 'kanban'; } });
  const [owner, setOwner] = useState('all');
  const [due, setDue] = useState(false);
  const [sel, setSel] = useState([]);
  const [confirmDel, setConfirmDel] = useState(false);
  const [edit, setEdit] = useState(null);
  const [imp, setImp] = useState(false);
  const [deals, reload] = useData(() => api.select('admin_deals', {}, { order: 'updated_at.desc', limit: 5000 }), []);
  const today = iso(new Date());
  const list = useMemo(() => {
    if (!deals) return [];
    const n = norm(q);
    return deals.filter((d) => (!n || norm([d.title, d.contact_name, d.company_name, d.city, d.email, d.trade, d.phone, (d.tags || []).join(' ')].join(' ')).includes(n))
      && (owner === 'all' || (owner === 'none' ? !d.owner : d.owner === owner || (d.worked_by || []).includes(owner)))
      && (!due || (OPEN(d) && d.next_date && d.next_date <= today)));
  }, [deals, q, owner, due, today]);
  if (!deals) return <div className="content"><TopBar title={t('Prospection')} /><Loader /></div>;

  const setV = (v) => { setView(v); try { localStorage.setItem('ay_pipe_view', v); } catch { /* */ } };
  const log = (deal_id, kind, content) => api.insert('admin_deal_events', { deal_id, kind, content, who, created_by: profile.id });
  const touch = (d) => ({ worked_by: who && !(d.worked_by || []).includes(who) ? [...(d.worked_by || []), who] : d.worked_by || [], updated_at: new Date().toISOString() });
  const move = (d, stage) => run(async () => { await api.update('admin_deals', { id: d.id }, { stage, ...touch(d) }); await log(d.id, 'etape', t('{a} → {b}', { a: t(STAGE[d.stage]), b: t(STAGE[stage]) })); reload(); });
  const bulk = (patch, label) => run(async () => { for (const id of sel) { const d = deals.find((x) => x.id === id); await api.update('admin_deals', { id }, { ...patch, ...touch(d) }); if (patch.stage) await log(id, 'etape', t(STAGE[patch.stage])); } setSel([]); reload(); }, label);
  const delSel = () => run(async () => { for (const id of sel) await api.remove('admin_deals', { id }); setSel([]); setConfirmDel(false); reload(); }, t('{n} prospect(s) supprimé(s)', { n: sel.length }));
  const exportX = () => run(async () => {
    const rows = [['Nom', 'Contact', 'E-mail', 'Téléphone', 'Adresse', 'CP', 'Ville', 'Métier', 'SIRET', 'Étape', 'Responsable', 'Ont travaillé dessus', 'Priorité', 'Prochaine action', 'Relance', 'Valeur / mois', 'Origine', 'Notes'],
      ...list.map((d) => [d.title, d.contact_name, d.email, d.phone, d.address, d.zip, d.city, d.trade, d.siret, STAGE[d.stage], d.owner, (d.worked_by || []).join(', '), d.priority, d.next_action, d.next_date || '', Number(d.value) || 0, d.source, d.notes])];
    download(await makeXlsx([{ name: 'Prospects', rows }]), `prospects-artesa-${today}.xlsx`);
  });
  const mine = deals.filter((d) => who && d.owner === who && OPEN(d)).length;
  const late = deals.filter((d) => OPEN(d) && d.next_date && d.next_date <= today).length;
  const won = deals.filter((d) => d.stage === 'client');

  return (
    <div className="content wide">
      <TopBar title={t('Prospection')} sub={t('Votre carnet de prospects, partagé à deux')} right={<div className="row" style={{ gap: 6 }}>
        <button className="btn ghost sm" onClick={() => setImp(true)}><LuUpload /> {t('Importer')}</button>
        <button className="btn ghost sm" onClick={exportX} disabled={!list.length}><LuDownload /> {t('Exporter')}</button>
        <button className="btn sm" onClick={() => setEdit({ ...EMPTY, owner: who, value: Number(s.plans.find((p) => p.id === 'solo')?.price) || 0 })}><LuPlus /> {t('Nouveau')}</button></div>} />
      <WhoBar />
      <div className="kpis mb">
        <div className="kpi"><small>{t('En cours')}</small><b>{deals.filter(OPEN).length}</b><span className="small muted">{t('{m} / mois potentiels', { m: money0(deals.filter(OPEN).reduce((a, d) => a + Number(d.value || 0), 0)) })}</span></div>
        <button className="kpi" style={{ textAlign: 'left' }} onClick={() => { setDue(true); setOwner('all'); }}><small>{t('À relancer')}</small><b className={late ? 'red-t' : ''}>{late}</b><span className="small muted">{t('aujourd’hui ou en retard')}</span></button>
        {who && <button className="kpi" style={{ textAlign: 'left' }} onClick={() => { setOwner(who); setDue(false); }}><small>{t('Mes prospects ({n})', { n: who })}</small><b>{mine}</b></button>}
        <div className="kpi"><small>{t('Abonnés gagnés')}</small><b>{won.length}</b><span className="small muted">{deals.length ? Math.round((won.length / deals.length) * 100) : 0} % {t('de conversion')}</span></div>
      </div>
      <SearchBar value={q} onChange={setQ} placeholder={t('Nom, ville, métier, téléphone…')} />
      <div className="row wrap between" style={{ gap: 8 }}>
        <Chips scroll options={[['all', t('Tous')], ...team.map((n) => [n, n]), ['none', t('Non attribués')]]} value={owner} onChange={setOwner} />
        <div className="row" style={{ gap: 6 }}>
          <button className={'chip' + (due ? ' on' : '')} onClick={() => setDue(!due)}><LuBellRing size={13} /> {t('À relancer')}</button>
          <button className={'iconbtn' + (view === 'kanban' ? ' on' : '')} onClick={() => setV('kanban')} aria-label={t('Vue tableau')}><LuLayoutGrid /></button>
          <button className={'iconbtn' + (view === 'list' ? ' on' : '')} onClick={() => setV('list')} aria-label={t('Vue liste')}><LuList /></button>
        </div>
      </div>

      {!deals.length ? <Empty text={t('Aucun prospect pour l’instant.')}><button className="btn" onClick={() => setImp(true)}><LuUpload /> {t('Importer un fichier Excel ou CSV')}</button></Empty>
        : view === 'kanban' ? (
          <div className="kanban mt">
            {STAGES.map(([k, l]) => { const col = list.filter((d) => d.stage === k); return (
              <div key={k} className="kcol">
                <div className="kcol-h"><b>{t(l)}</b><span className="small muted">{col.length}</span></div>
                {col.slice(0, 200).map((d) => <DealCard key={d.id} d={d} today={today} onOpen={() => setEdit({ ...EMPTY, ...d, next_date: d.next_date || '' })} onMove={(st) => move(d, st)} />)}
                {col.length > 200 && <span className="small muted">{t('+{n} autres : affinez la recherche', { n: col.length - 200 })}</span>}
              </div>); })}
          </div>
        ) : (
          <>
            {sel.length > 0 && <div className="card soft row wrap mt" style={{ gap: 8, alignItems: 'center' }}>
              <b className="small">{t('{n} sélectionné(s)', { n: sel.length })}</b>
              {team.map((n) => <button key={n} className="btn ghost sm" onClick={() => bulk({ owner: n }, t('Attribué à {n}', { n }))}><LuUserCheck /> {t('À {n}', { n })}</button>)}
              <select className="input xs" value="" onChange={(e) => e.target.value && bulk({ stage: e.target.value }, t('Étape modifiée'))} aria-label={t('Changer d’étape')}><option value="">{t('Changer d’étape…')}</option>{STAGES.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}</select>
              {!confirmDel ? <button className="btn ghost sm" onClick={() => setConfirmDel(true)}><LuTrash2 /> {t('Supprimer')}</button>
                : <button className="btn sm red" onClick={delSel}>{t('Confirmer : supprimer {n} prospect(s)', { n: sel.length })}</button>}
              <button className="iconbtn" onClick={() => { setSel([]); setConfirmDel(false); }} aria-label={t('Annuler')}><LuX /></button>
            </div>}
            <div className="mt"><Table rows={list.slice(0, 500)} onRow={(d) => setEdit({ ...EMPTY, ...d, next_date: d.next_date || '' })} empty={t('Aucun prospect ne correspond')} cols={[
              { label: <input type="checkbox" aria-label={t('Tout sélectionner')} checked={sel.length > 0 && sel.length === Math.min(list.length, 500)} onChange={(e) => setSel(e.target.checked ? list.slice(0, 500).map((d) => d.id) : [])} />,
                render: (d) => <input type="checkbox" aria-label={t('Sélectionner')} checked={sel.includes(d.id)} onClick={(e) => e.stopPropagation()} onChange={(e) => setSel(e.target.checked ? [...sel, d.id] : sel.filter((x) => x !== d.id))} /> },
              { label: t('Prospect'), render: (d) => <span><b>{d.title}</b><div className="small muted">{[d.contact_name, d.trade].filter(Boolean).join(' · ')}</div></span> },
              { label: t('Ville'), render: (d) => <span className="small">{d.city}</span> },
              { label: t('Étape'), render: (d) => <Pill c={d.stage === 'client' ? 'green' : d.stage === 'perdu' ? 'grey' : 'yellow'}>{t(STAGE[d.stage])}</Pill> },
              { label: t('Responsable'), render: (d) => <span className="small">{d.owner || '—'}{(d.worked_by || []).filter((x) => x !== d.owner).length > 0 && <span className="muted"> + {(d.worked_by || []).filter((x) => x !== d.owner).join(', ')}</span>}</span> },
              { label: t('Relance'), render: (d) => <span className={'small' + (OPEN(d) && d.next_date && d.next_date <= today ? ' red-t bold' : '')}>{d.next_date ? date(d.next_date) : '—'}</span> },
            ]} /></div>
            {list.length > 500 && <p className="small muted">{t('Les 500 premiers sont affichés : affinez la recherche ou exportez.')}</p>}
          </>
        )}

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? edit.title || t('Fiche prospect') : t('Nouveau prospect')}>
        {edit && <DealForm key={edit.id || 'new'} d={edit} set={setEdit} plans={s.plans} team={team} who={who} log={log} touch={touch} onDone={() => { setEdit(null); reload(); }} />}
      </Sheet>
      <Sheet open={imp} onClose={() => setImp(false)} title={t('Importer des prospects')}>
        {imp && <ImportForm deals={deals} team={team} who={who} onDone={() => { setImp(false); reload(); }} />}
      </Sheet>
    </div>
  );
}

function DealCard({ d, today, onOpen, onMove }) {
  const lateD = OPEN(d) && d.next_date && d.next_date <= today;
  return (
    <div className={'kcard' + (d.priority === 'haute' ? ' hot' : '')} onClick={onOpen}>
      <b>{d.title}</b>
      <div className="small muted">{[d.contact_name, d.trade, d.city].filter(Boolean).join(' · ')}</div>
      {(d.next_action || d.next_date) && <div className={'small' + (lateD ? ' red-t bold' : '')}>{[d.next_date && date(d.next_date), d.next_action].filter(Boolean).join(' · ')}</div>}
      <div className="row wrap" style={{ gap: 4 }}>
        {d.owner ? <span className="who-tag">{d.owner}</span> : <span className="small muted">{t('Non attribué')}</span>}
        {(d.worked_by || []).filter((x) => x !== d.owner).map((x) => <span key={x} className="who-tag ghost">{x}</span>)}
      </div>
      <div className="row between" style={{ gap: 4 }}>
        <span className="small bold">{money0(d.value)}/{t('mois')}</span>
        <select className="input xs" value={d.stage} onClick={(e) => e.stopPropagation()} onChange={(e) => onMove(e.target.value)} aria-label={t('Étape')}>{STAGES.map(([v, x]) => <option key={v} value={v}>{t(x)}</option>)}</select>
      </div>
    </div>
  );
}

function DealForm({ d, set, plans, team, who, log, touch, onDone }) {
  const { profile, company, run } = useApp();
  const [kind, setKind] = useState('appel');
  const [txt, setTxt] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [events, reloadEv] = useData(() => (d.id ? api.select('admin_deal_events', { deal_id: d.id }, { order: 'created_at.desc', limit: 200 }) : []), [d.id]);
  const F = (k, label, props = {}) => <Field label={label}><input value={d[k] ?? ''} onChange={(e) => set({ ...d, [k]: e.target.value })} {...props} /></Field>;
  const worked = d.worked_by || [];
  const save = () => run(async () => {
    const row = { ...d, value: Number(d.value) || 0, next_date: d.next_date || null, tags: typeof d.tags === 'string' ? d.tags.split(',').map((x) => x.trim()).filter(Boolean) : d.tags || [], ...touch(d) };
    delete row.id; delete row.created_at;
    if (d.id) await api.update('admin_deals', { id: d.id }, row);
    else { const r = await api.insert('admin_deals', { ...row, owner_id: profile.id }); await log(r.id, 'note', t('Fiche créée')); }
    onDone();
  }, t('Fiche enregistrée'));
  const addEvent = () => run(async () => {
    const now = new Date().toISOString();
    await log(d.id, kind, txt.trim());
    const patch = { ...touch(d), last_contact_at: ['appel', 'email', 'rdv'].includes(kind) ? now : d.last_contact_at || null };
    if (d.stage === 'prospect' && ['appel', 'email', 'rdv'].includes(kind)) patch.stage = 'contacte';
    await api.update('admin_deals', { id: d.id }, patch);
    set({ ...d, ...patch }); setTxt(''); reloadEv();
  });
  const toTask = () => run(async () => {
    await api.insert('admin_tasks', { title: (d.next_action || t('Relancer')) + ' · ' + d.title, due_date: d.next_date || null, assignee: d.owner || who, assignee_id: profile.id, deal_id: d.id, created_by: profile.id });
  }, t('Tâche ajoutée à « Tâches » et à l’agenda'));
  const toClient = () => run(async () => {
    const c = await api.insert('clients', { company_id: company.id, type: 'pro', company_name: d.title, contact_name: d.contact_name, email: d.email, phone: d.phone, website: d.website, siret: d.siret, billing_address: d.address, billing_zip: d.zip, billing_city: d.city, note: t('Venu de la prospection ({w})', { w: d.owner || who || '' }) });
    await log(d.id, 'note', t('Fiche client créée'));
    navigate('/pro/clients/' + c.id);
  }, t('Client créé : vous pouvez lui faire un devis ou une facture'));
  return (
    <>
      {F('title', t('Nom (entreprise ou artisan)'), { required: true })}
      <Field label={t('Pris en charge par')}><Chips options={[['', t('Personne')], ...team.map((n) => [n, n])]} value={d.owner || ''} onChange={(v) => set({ ...d, owner: v })} /></Field>
      <Field label={t('Ont travaillé dessus')}><div className="row wrap" style={{ gap: 14 }}>{team.map((n) => (
        <label key={n} className="check"><input type="checkbox" checked={worked.includes(n)} onChange={(e) => set({ ...d, worked_by: e.target.checked ? [...worked, n] : worked.filter((x) => x !== n) })} /><span>{n}</span></label>))}</div></Field>
      {d.id && <div className="row wrap" style={{ gap: 8 }}>
        {d.phone && <a className="btn ghost sm" href={'tel:' + d.phone.replace(/\s/g, '')}><LuPhone /> {d.phone}</a>}
        {d.email && <a className="btn ghost sm" href={'mailto:' + d.email}><LuMail /> {t('Écrire')}</a>}
        {d.website && <a className="btn ghost sm" href={/^https?:/.test(d.website) ? d.website : 'https://' + d.website} target="_blank" rel="noopener noreferrer"><LuGlobe /> {t('Site')}</a>}
      </div>}

      {d.id && <div className="card soft mt">
        <b>{t('Historique')}</b>
        <div className="row wrap mt" style={{ gap: 6 }}>{['appel', 'email', 'rdv', 'note'].map((k) => { const [l, I] = EV[k]; return <button key={k} className={'chip' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}><I size={13} /> {t(l)}</button>; })}</div>
        <textarea className="input mt" rows={2} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={kind === 'appel' ? t('Ex. : messagerie, rappeler jeudi ; intéressé par la formule Équipe…') : t('Ce qui s’est passé…')} />
        <button className="btn sm mt" disabled={!who} onClick={addEvent}><LuPlus /> {who ? t('Ajouter ({w})', { w: who }) : t('Choisissez d’abord votre nom en haut')}</button>
        <div className="timeline mt">{(events || []).map((e) => { const [l, I] = EV[e.kind] || EV.note; return (
          <div key={e.id} className="tl"><I size={14} /><div className="grow"><div className="small"><b>{e.who || '—'}</b> · {t(l)} · <span className="muted">{rel(e.created_at)}</span></div>{e.content && <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{e.content}</div>}</div></div>); })}
          {events && !events.length && <span className="small muted">{t('Rien pour l’instant.')}</span>}</div>
      </div>}

      <div className="form-grid two mt">
        <Field label={t('Étape')}><select value={d.stage} onChange={(e) => set({ ...d, stage: e.target.value })}>{STAGES.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}</select></Field>
        <Field label={t('Priorité')}><select value={d.priority || 'normale'} onChange={(e) => set({ ...d, priority: e.target.value })}><option value="basse">{t('Basse')}</option><option value="normale">{t('Normale')}</option><option value="haute">{t('Haute')}</option></select></Field>
        {F('next_action', t('Prochaine action'), { placeholder: t('Rappeler, envoyer la démo…') })}
        {F('next_date', t('Pour le'), { type: 'date' })}
      </div>
      {d.id && <button className="btn ghost sm" onClick={toTask}><LuCalendarPlus /> {t('En faire une tâche (agenda)')}</button>}
      <div className="form-grid two mt">
        {F('contact_name', t('Contact'))}{F('trade', t('Métier'))}
        {F('email', t('E-mail'), { type: 'email' })}{F('phone', t('Téléphone'), { type: 'tel' })}
        {F('address', t('Adresse'))}{F('zip', t('Code postal'))}
        {F('city', t('Ville'))}{F('siret', t('SIRET'))}
        {F('website', t('Site web'))}{F('source', t('Origine'), { placeholder: t('salon, bouche-à-oreille, fichier…') })}
        <Field label={t('Formule visée')}><select value={d.plan} onChange={(e) => set({ ...d, plan: e.target.value, value: plans.find((p) => p.id === e.target.value)?.price ?? d.value })}>{plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {money0(p.price)}</option>)}</select></Field>
        {F('value', t('Valeur / mois (€)'), { type: 'number', min: 0 })}
      </div>
      <Field label={t('Étiquettes (séparées par des virgules)')}><input value={Array.isArray(d.tags) ? d.tags.join(', ') : d.tags || ''} onChange={(e) => set({ ...d, tags: e.target.value })} /></Field>
      <Field label={t('Notes')}><textarea rows={4} value={d.notes || ''} onChange={(e) => set({ ...d, notes: e.target.value })} /></Field>
      <button className="btn block mt" disabled={!String(d.title).trim()} onClick={save}><LuSave /> {t('Enregistrer')}</button>
      {d.id && d.stage === 'client' && <button className="btn ghost block mt" onClick={toClient}><LuUserPlus /> {t('Créer la fiche client Artesa (devis, factures)')}</button>}
      {d.id && (!confirm ? <button className="btn ghost block mt" onClick={() => setConfirm(true)}><LuTrash2 /> {t('Supprimer')}</button>
        : <button className="btn red block mt" onClick={() => run(async () => { await api.remove('admin_deals', { id: d.id }); onDone(); }, t('Prospect supprimé'))}>{t('Confirmer la suppression (historique compris)')}</button>)}
      {d.id && <p className="small muted mt">{t('Créé {a} · modifié {b}', { a: rel(d.created_at), b: rel(d.updated_at) })}</p>}
    </>
  );
}

function ImportForm({ deals, team, who, onDone }) {
  const { profile, run } = useApp();
  const { plans } = usePlatform();
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState(null);
  const [hasHead, setHasHead] = useState(true);
  const [map, setMap] = useState({});
  const [owner, setOwner] = useState('');
  const [skipDup, setSkipDup] = useState(true);
  const [err, setErr] = useState('');
  const load = (f) => run(async () => {
    setErr(''); const r = await readSheet(f);
    if (!r.length) { setErr(t('Le fichier est vide.')); return; }
    setFile(f); setRows(r); setMap(guessMap(r[0]));
  });
  const head = rows ? (hasHead ? rows[0] : rows[0].map((_, i) => t('Colonne {n}', { n: i + 1 }))) : [];
  const body = rows ? (hasHead ? rows.slice(1) : rows) : [];
  const parsed = useMemo(() => body.map((r) => {
    const o = {}; for (const [k] of FIELDS) if (map[k] != null && map[k] !== '') o[k] = String(r[map[k]] ?? '').trim();
    if (!o.title) o.title = o.contact_name || o.email || '';
    return o;
  }).filter((o) => o.title), [rows, map, hasHead]);
  const existing = useMemo(() => new Set(deals.flatMap(dupKey)), [deals]);
  const plan = useMemo(() => {
    const seen = new Set(), keep = [], dup = [];
    for (const o of parsed) { const ks = dupKey(o); if (skipDup && ks.some((k) => existing.has(k) || seen.has(k))) dup.push(o); else { keep.push(o); ks.forEach((k) => seen.add(k)); } }
    return { keep, dup };
  }, [parsed, existing, skipDup]);
  const go = () => run(async () => {
    const src = file.name.replace(/\.[^.]+$/, '');
    const all = plan.keep.map((o) => {
      const own = o.owner && team.find((n) => norm(n) === norm(o.owner));
      return { ...o, owner: own || owner, worked_by: [], source: o.source || src, imported_from: file.name, plan: 'solo', value: Number(plans.find((p) => p.id === 'solo')?.price ?? plans[0]?.price) || 0, next_date: toDate(o.next_date), stage: 'prospect', owner_id: profile.id, updated_at: new Date().toISOString() };
    });
    for (let i = 0; i < all.length; i += 200) {
      const ins = await api.insert('admin_deals', all.slice(i, i + 200));
      await api.insert('admin_deal_events', (Array.isArray(ins) ? ins : [ins]).map((x) => ({ deal_id: x.id, kind: 'import', who, content: file.name, created_by: profile.id })));
    }
    onDone();
  }, t('{n} prospect(s) importé(s)', { n: plan.keep.length }));

  if (!rows) return (
    <>
      <p className="small">{t('Excel (.xlsx) ou CSV, une ligne par prospect. Les colonnes sont reconnues toutes seules (Entreprise, Contact, Téléphone, E-mail, Ville, Métier…) et vous pouvez corriger avant d’importer.')}</p>
      <input ref={input} type="file" accept=".xlsx,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(e) => { if (e.target.files?.[0]) load(e.target.files[0]); e.target.value = ''; }} />
      <button className="btn block" onClick={() => input.current?.click()}><LuUpload /> {t('Choisir le fichier')}</button>
      {err && <p className="small red-t mt">{err}</p>}
      <p className="small muted mt">{t('Ancien format .xls : ouvrez-le dans Excel puis « Enregistrer sous » .xlsx ou CSV.')}</p>
    </>
  );
  return (
    <>
      <p className="small"><b>{file.name}</b> · {t('{n} ligne(s)', { n: body.length })} <button className="link small" onClick={() => setRows(null)}>{t('changer')}</button></p>
      <label className="check"><input type="checkbox" checked={hasHead} onChange={(e) => setHasHead(e.target.checked)} /><span className="small">{t('La première ligne contient les titres des colonnes')}</span></label>
      <div className="form-grid two mt">{FIELDS.map(([k, l]) => (
        <Field key={k} label={t(l)}><select value={map[k] ?? ''} onChange={(e) => setMap({ ...map, [k]: e.target.value === '' ? undefined : Number(e.target.value) })}>
          <option value="">{t('— ignorer —')}</option>{head.map((h, i) => <option key={i} value={i}>{h || t('Colonne {n}', { n: i + 1 })}</option>)}</select></Field>))}</div>
      <Field label={t('Attribuer les prospects à')} hint={t('si le fichier n’a pas de colonne « Responsable »')}><Chips options={[['', t('Personne')], ...team.map((n) => [n, n])]} value={owner} onChange={setOwner} /></Field>
      <label className="check"><input type="checkbox" checked={skipDup} onChange={(e) => setSkipDup(e.target.checked)} /><span className="small">{t('Ignorer les doublons (même e-mail, téléphone, SIRET ou nom + ville)')}</span></label>
      <div className="card soft mt">
        <b className="small">{t('Aperçu')}</b>
        <div className="list mt">{plan.keep.slice(0, 5).map((o, i) => <div key={i} className="li"><div className="grow"><div className="t1">{o.title}</div><div className="t2">{[o.contact_name, o.phone, o.email, o.city].filter(Boolean).join(' · ')}</div></div></div>)}</div>
        <p className="small mt"><b>{t('{n} à importer', { n: plan.keep.length })}</b>{plan.dup.length > 0 && <span className="muted"> · {t('{n} doublon(s) ignoré(s)', { n: plan.dup.length })}</span>}{map.title == null && <span className="red-t"> · {t('Indiquez la colonne du nom')}</span>}</p>
      </div>
      <button className="btn block mt" disabled={!plan.keep.length} onClick={go}><LuUpload /> {t('Importer {n} prospect(s)', { n: plan.keep.length })}</button>
    </>
  );
}
