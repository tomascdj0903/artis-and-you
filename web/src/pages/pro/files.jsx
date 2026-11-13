import { kbd } from '../../lib/a11y.js';
import { useEffect, useRef, useState } from 'react';
import { PageFab } from '../../ui/fab.jsx';
import { LuCamera, LuFileText, LuDownload, LuChevronRight, LuFolder, LuTriangleAlert, LuLock, LuTrash2, LuUpload } from 'react-icons/lu';
import { api } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { navigate } from '../../lib/router.jsx';
import { t } from '../../lib/i18n.js';
import { clientName, dateMed, date, iso, rel } from '../../lib/format.js';
import { DOC_TYPES, VAULT_TYPES, VAULT_REQUIRED, VAULT_FORM, addMonths, reviewPill, docTypeLabel, validity } from '../../lib/docs.js';
import { TopBar, SearchBar, Sec, Sheet, Field, Chips, useData, Loader, Empty, Img, openFile, pickFiles, Toggle, SettingToggle, StatusPill, Pill } from '../../ui/index.jsx';
import { uploadTo } from '../common/chat.jsx';

function useClientsWith(kind) {
  const { company } = useApp();
  return useData(async () => {
    const [clients, files] = await Promise.all([api.select('clients', { company_id: company.id }), api.select('files', { company_id: company.id, kind })]);
    const by = {}; files.forEach((f) => { if (!f.client_id) return; by[f.client_id] = by[f.client_id] || { n: 0, last: '' }; by[f.client_id].n++; if (f.created_at > by[f.client_id].last) by[f.client_id].last = f.created_at; });
    return { clients: clients.map((c) => ({ ...c, n: by[c.id]?.n || 0, last: by[c.id]?.last || '' })).sort((a, b) => b.last.localeCompare(a.last) || clientName(a).localeCompare(clientName(b))), total: files.length };
  }, [kind]);
}

function ClientFileList({ kind, title, to }) {
  const [q, setQ] = useState('');
  const [onlyWith, setOnlyWith] = useState(false);
  const [open, setOpen] = useState(false);
  const [b] = useClientsWith(kind);
  if (!b) return <div className="content"><TopBar title={title} /><Loader /></div>;
  const list = b.clients.filter((c) => (!onlyWith || c.n) && (!q || (clientName(c) + ' ' + c.billing_city).toLowerCase().includes(q.toLowerCase())));
  const I = kind === 'photo' ? LuCamera : LuFileText;
  return (
    <div className="content">
      <TopBar title={title} sub={t('Tous les clients')} />
      <SearchBar placeholder={t('Recherchez un client')} value={q} onChange={setQ} onFilter={() => setOpen(true)} filterActive={onlyWith} />
      <Sec title={t('Mes clients')} meta={t('{n} clients · {m} {k}', { n: b.clients.length, m: b.total, k: kind === 'photo' ? t('photos') : t('documents') })} />
      {!list.length ? <Empty text={t('Aucun client pour le moment. Ajoutez-en un avec le bouton +.')} /> : (
        <div className="list">{list.map((c) => (
          <button key={c.id} className="li click" onClick={() => navigate(to + c.id)}>
            <div className="ficon"><I /></div>
            <div className="grow"><div className="t1">{clientName(c)}</div><div className="t2">{c.site_city || c.billing_city}{c.last ? ' · ' + rel(c.last) : ''}</div></div>
            <span className="count">{c.n} {kind === 'photo' ? t('photos') : t('docs')}</span><LuChevronRight />
          </button>
        ))}</div>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={t('Filtrer')}>
        <label className="check"><input type="checkbox" checked={onlyWith} onChange={(e) => setOnlyWith(e.target.checked)} />{kind === 'photo' ? t('Seulement les clients avec des photos') : t('Seulement les clients avec des documents')}</label>
        <button className="btn block mt" onClick={() => setOpen(false)}>{t('Afficher {n} clients', { n: list.length })}</button>
      </Sheet>
    </div>
  );
}
export const PhotosClients = () => <ClientFileList kind="photo" title={t('Photos')} to="/pro/photos/" />;
export const OtherDocsClients = () => <ClientFileList kind="doc" title={t('Autres docs')} to="/pro/autres-docs/" />;

export function PhotosClient({ params }) {
  const { company, profile, run } = useApp();
  const [big, setBig] = useState(null);
  const [add, setAdd] = useState(false);
  const [b, reload] = useData(async () => {
    const [c, files, projects, members] = await Promise.all([api.one('clients', { id: params.id }), api.select('files', { client_id: params.id, kind: 'photo' }, { order: 'created_at.desc' }), api.select('projects', { client_id: params.id }), api.select('profiles', { company_id: company.id })]);
    return { c, files, projects, pm: Object.fromEntries(projects.map((p) => [p.id, p])), mm: Object.fromEntries(members.map((m) => [m.id, m])) };
  }, [params.id]);
  if (!b) return <div className="content"><TopBar title={t('Photos')} /><Loader /></div>;
  const groups = {};
  b.files.forEach((f) => { const k = f.created_at.slice(0, 10) + '|' + (f.project_id || ''); (groups[k] = groups[k] || []).push(f); });
  const author = (f) => f.author_label || (f.uploaded_by === profile.id ? t('Par vous') : b.mm[f.uploaded_by] ? t('Par {n}', { n: b.mm[f.uploaded_by].first_name }) : t('Envoyées par le client'));
  return (
    <div className="content">
      <TopBar title={t('Photos')} sub={clientName(b.c)} />
      <Sec title={t('Toutes les photos')} meta={t('{n} photos', { n: b.files.length })} />
      {!b.files.length && <Empty icon={LuCamera} text={t('Aucune photo pour ce client.')} />}
      {Object.entries(groups).map(([k, fs]) => {
        const [day, pid] = k.split('|'); const p = b.pm[pid];
        return (
          <div key={k} className="mb">
            <div className="row between"><b className="red-t">{dateMed(day)}</b><span className="small muted">{t('{n} photos', { n: fs.length })}</span></div>
            <div className="small bold mb">{p?.title || t('Sans chantier')}{p?.address ? ' · ' + p.address : ''} <span className="muted" style={{ fontWeight: 400 }}>· {author(fs[0])}</span></div>
            <div className="photos-grid">{fs.map((f) => <Img key={f.id} path={f.path} onClick={() => setBig(f)} />)}</div>
          </div>
        );
      })}
      <PageFab primary={{ label: t('Ajouter des photos'), onClick: () => setAdd(true) }} />
      <AddPhotos open={add} onClose={() => setAdd(false)} projects={b.projects} onDone={() => { setAdd(false); reload(); }} clientId={params.id} />
      {big && (
        <div className="overlay center" onClick={() => setBig(null)}>
          <div className="modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <Img path={big.path} />
            <div className="kv mt" style={{ textAlign: 'left' }}>
              <div className="r"><span className="k">{t('Visible dans mon profil public (réalisations)')}</span><Toggle checked={big.shared_with_pros} onChange={async (v) => { await api.update('files', { id: big.id }, { shared_with_pros: v }); setBig({ ...big, shared_with_pros: v }); reload(); }} /></div>
            </div>
            <div className="btns" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <button className="btn ghost" onClick={() => openFile(big.path, big.name)}><LuDownload /> {t('Télécharger')}</button>
              <button className="btn light" onClick={async () => { await run(async () => { await api.remove('files', { id: big.id }); await api.removeFile(big.path).catch(() => {}); }, t('Photo supprimée')); setBig(null); reload(); }}><LuTrash2 /> {t('Supprimer')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddPhotos({ open, onClose, projects, onDone, clientId }) {
  const { company, run } = useApp();
  const [pid, setPid] = useState(projects[0]?.id || '');
  if (!open) return null;
  const go = async () => {
    const files = await pickFiles({ accept: 'image/*' });
    if (!files.length) return;
    await run(async () => {
      for (const f of files) {
        const up = await uploadTo(`${company.id}/photos/${clientId}`, f);
        await api.insert('files', { company_id: company.id, client_id: clientId, project_id: pid || null, kind: 'photo', name: f.name, path: up.path, mime: f.type, size: f.size });
      }
    }, t('{n} photos ajoutées', { n: files.length }));
    onDone();
  };
  return (
    <Sheet open onClose={onClose} title={t('Ajouter des photos')}>
      <Field label={t('Chantier')}><select value={pid} onChange={(e) => setPid(e.target.value)}><option value="">{t('Sans chantier')}</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></Field>
      <button className="btn block" onClick={go}><LuCamera /> {t('Choisir les photos')}</button>
    </Sheet>
  );
}

function FileRow({ f, onOpen, types = DOC_TYPES, extra }) {
  return (
    <div className="li">
      <div className="ficon"><LuFileText /></div>
      <div {...(onOpen ? kbd : null)} className="grow" onClick={onOpen} style={{ cursor: onOpen ? 'pointer' : undefined }}>
        <div className="t1">{f.name}</div>
        <div className="t2">{extra}</div>
        <div className="row small" style={{ marginTop: 4 }}><Pill c="grey">{docTypeLabel(f.doc_type, types)}</Pill><span className="faint">{date(f.issued_at || f.created_at)}</span>{f.shared_with_client && <Pill c="green">{t('Partagé')}</Pill>}</div>
      </div>
      <button className="round" onClick={() => openFile(f.path, f.name)} aria-label={t('Télécharger')}><LuDownload /></button>
    </div>
  );
}

export function OtherDocsClient({ params }) {
  const [q, setQ] = useState('');
  const [types, setTypes] = useState([]);
  const [open, setOpen] = useState(false);
  const [add, setAdd] = useState(false);
  const [edit, setEdit] = useState(null);
  const [b, reload] = useData(async () => {
    const [c, files] = await Promise.all([api.one('clients', { id: params.id }), api.select('files', { client_id: params.id, kind: 'doc' }, { order: 'created_at.desc' })]);
    return { c, files };
  }, [params.id]);
  if (!b) return <div className="content"><TopBar title={t('Autres docs')} /><Loader /></div>;
  const list = b.files.filter((f) => (!types.length || types.includes(f.doc_type)) && (!q || f.name.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="content">
      <TopBar title={t('Autres docs')} sub={clientName(b.c)} />
      <SearchBar placeholder={t('Recherchez un document')} value={q} onChange={setQ} onFilter={() => setOpen(true)} filterActive={types.length > 0} />
      <Sec title={t('Documents')} meta={t('{n} documents', { n: b.files.length })} />
      {!list.length ? <Empty text={t('Attestations, Kbis, contrats, plans… Ajoutez-les avec +.')} /> : <div className="list">{list.map((f) => <FileRow key={f.id} f={f} onOpen={() => setEdit(f)} extra={f.shared_with_client ? t('Partagé avec le client') : ''} />)}</div>}
      <PageFab primary={{ label: t('Ajouter un document'), onClick: () => setAdd(true) }} />
      <Sheet open={open} onClose={() => setOpen(false)} title={t('Filtrer par type')} right={<span className="red-t bold small">{t('{n} sélectionnés', { n: types.length })}</span>}>
        <div className="checklist">{DOC_TYPES.map(([k, l]) => <label key={k} className="check"><input type="checkbox" checked={types.includes(k)} onChange={(e) => setTypes(e.target.checked ? [...types, k] : types.filter((x) => x !== k))} />{t(l)}</label>)}</div>
        <div className="btns"><div className="two"><button className="btn ghost" onClick={() => setTypes([])}>{t('Réinitialiser')}</button><button className="btn" onClick={() => setOpen(false)}>{t('Afficher {n} documents', { n: list.length })}</button></div></div>
      </Sheet>
      <UploadSheet open={add} onClose={() => setAdd(false)} kind="doc" types={DOC_TYPES} clientId={params.id} onDone={() => { setAdd(false); reload(); }} />
      <EditFile f={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); }} types={DOC_TYPES} />
    </div>
  );
}

function UploadSheet({ open, onClose, kind, types, clientId, onDone, presetType, presetFile }) {
  const { company, run } = useApp();
  const [file, setFile] = useState(null);
  const [v, setV] = useState(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false); // verrou immédiat : plusieurs clics rapides avant le rafraîchissement de l'écran
  const blank = (type, f) => {
    const form = kind === 'vault' ? VAULT_FORM[type] || {} : {};
    const today = iso(new Date());
    const meta = Object.fromEntries((form.fields || []).map(([k, , from]) => [k, from === 'company.insurer' ? company.insurer || '' : from === 'company.insurance_contract' ? company.insurance_contract || '' : from === 'company.trades' ? (company.trades || []).join(', ') : '']));
    return { doc_type: type, name: f && kind !== 'vault' ? f.name.replace(/\.[^.]+$/, '') : '', issued_at: today, valid_until: addMonths(today, form.months), meta, shared_with_client: kind === 'doc' || (kind === 'vault' && vaultPrefs(company, type).shared), auto: true };
  };
  // À l'ouverture : type pré-rempli, fichier déjà choisi le cas échéant (bouton « Déposer » d'un dossier)
  useEffect(() => {
    if (!open) { setV(null); setFile(null); setBusy(false); return; }
    const type = presetType || types[0][0];
    setFile(presetFile || null); setV(blank(type, presetFile));
  }, [open, presetType, presetFile]);
  if (!open || !v) return null;
  const form = kind === 'vault' ? VAULT_FORM[v.doc_type] || {} : {};
  const typeLabel = docTypeLabel(v.doc_type, types);
  const setType = (type) => setV({ ...blank(type, file), name: v.auto ? '' : v.name });
  const setIssued = (d) => setV({ ...v, issued_at: d, valid_until: form.months ? addMonths(d, form.months) : v.valid_until });
  const save = () => {
    if (lock.current) return; // un seul envoi, même si on reclique pendant le téléversement
    lock.current = true; setBusy(true);
    run(async () => {
      if (!file) throw new Error(t('Choisissez un fichier.'));
      if (form.needEnd && !v.valid_until) throw new Error(t('Indiquez la date de fin de validité.'));
      if (form.needName && !v.name.trim()) throw new Error(t('Donnez un nom au document.'));
      for (const [k, l] of form.fields || []) if (!String(v.meta[k] || '').trim()) throw new Error(t('Renseignez : {l}.', { l: t(l) }));
      const up = await uploadTo(`${company.id}/${kind}/${clientId || 'entreprise'}`, file);
      const name = (v.name || '').trim() || (kind === 'vault' ? `${typeLabel} · ${date(v.issued_at)}` : file.name.replace(/\.[^.]+$/, ''));
      await api.insert('files', { company_id: company.id, client_id: clientId || null, kind, doc_type: v.doc_type, name, path: up.path, mime: file.type, size: file.size, issued_at: v.issued_at || null, valid_until: v.valid_until || null, shared_with_client: v.shared_with_client, meta: v.meta, ...(kind === 'vault' ? { remind_days: vaultPrefs(company, v.doc_type).remind } : {}) });
      onDone();
    }, kind === 'vault' ? t('Document déposé : l’équipe Artesa le vérifie') : t('Document ajouté')).finally(() => { lock.current = false; setBusy(false); });
  };
  const choose = async () => { const [f] = await pickFiles({ multiple: false, accept: 'application/pdf,image/*,.doc,.docx,.xls,.xlsx' }); if (f) setFile(f); };
  return (
    <Sheet open onClose={busy ? () => {} : onClose} title={kind === 'vault' ? t('Déposer : {l}', { l: typeLabel }) : t('Ajouter un document')}>
      <button type="button" className={'btn block mb ' + (file ? 'light' : 'ghost')} onClick={choose} disabled={busy}><LuFileText /> {file ? file.name : t('Choisir le fichier (PDF ou photo)')}</button>
      {!presetType && <Field label={t('Type')}><select value={v.doc_type} onChange={(e) => setType(e.target.value)}>{types.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select></Field>}
      {form.hint && <p className="small faint" style={{ marginTop: -4 }}>{t(form.hint)}</p>}
      {(form.fields || []).map(([k, l, , ph]) => <Field key={k} label={t(l)} req><input value={v.meta[k] || ''} placeholder={ph ? t(ph) : ''} onChange={(e) => setV({ ...v, meta: { ...v.meta, [k]: e.target.value } })} /></Field>)}
      <div className="form-grid two">
        <Field label={t(form.issued || 'Délivré le')}><input type="date" value={v.issued_at} onChange={(e) => setIssued(e.target.value)} /></Field>
        <Field label={t('Valide jusqu’au')} req={form.needEnd} hint={form.months ? t('calculée, modifiable') : t('facultatif')}><input type="date" value={v.valid_until} onChange={(e) => setV({ ...v, valid_until: e.target.value })} /></Field>
      </div>
      <Field label={t('Nom')} req={form.needName} hint={kind === 'vault' && !form.needName ? t('facultatif') : ''}><input value={v.name} placeholder={kind === 'vault' ? `${typeLabel} · ${date(v.issued_at)}` : ''} onChange={(e) => setV({ ...v, name: e.target.value, auto: false })} /></Field>
      <label className="check"><input type="checkbox" checked={v.shared_with_client} onChange={(e) => setV({ ...v, shared_with_client: e.target.checked })} />{kind === 'vault' ? t('Partager avec mes clients (visible dans leur espace)') : t('Partager avec le client')}</label>
      {kind === 'vault' && <p className="small faint">{t('L’équipe Artesa vérifie chaque document avant qu’il soit visible de vos clients. Vous êtes prévenu dès qu’il est validé.')}</p>}
      <button className="btn block mt" onClick={save} disabled={busy}>{busy ? t('Envoi en cours…') : t('Enregistrer')}</button>
    </Sheet>
  );
}

function EditFile({ f, onClose, onDone, types }) {
  const { run } = useApp();
  if (!f) return null;
  return (
    <Sheet open onClose={onClose} title={f.name}>
      <div className="kv">
        <div className="r"><span className="k">{t('Type')}</span><span className="v">{docTypeLabel(f.doc_type, types)}</span></div>
        <SettingToggle label={t('Partagé avec le client')} hint={t('Visible dans son espace Artesa')} checked={f.shared_with_client} onChange={(v) => run(() => api.update('files', { id: f.id }, { shared_with_client: v })).then(onDone)} />
      </div>
      <div className="btns" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <button className="btn ghost" onClick={() => openFile(f.path, f.name)}><LuDownload /> {t('Télécharger')}</button>
        <button className="btn light" onClick={() => run(async () => { await api.remove('files', { id: f.id }); await api.removeFile(f.path).catch(() => {}); }, t('Document supprimé')).then(onDone)}><LuTrash2 /> {t('Supprimer')}</button>
      </div>
    </Sheet>
  );
}

// ─────────────── Coffre-fort de l'entreprise ───────────────
export function Vault() {
  const { company } = useApp();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ st: [], types: [] });
  const [add, setAdd] = useState(false);
  const [dep, setDep] = useState(null); // dépôt direct depuis un dossier : { type, file }
  const [files, reload] = useData(() => api.select('files', { company_id: company.id, kind: 'vault' }, { order: 'created_at.desc' }), []);
  const deposit = async (e, type) => { e.stopPropagation(); const [file] = await pickFiles({ multiple: false, accept: 'application/pdf,image/*' }); if (file) setDep({ type, file }); };
  if (!files) return <div className="content"><TopBar title={t('Mon coffre-fort')} /><Loader /></div>;
  const stKey = (x) => ({ [t('À jour')]: 'ok', [t('Expire bientôt')]: 'soon', [t('Expiré')]: 'exp' }[validity(x)[1]]);
  // statut d'un type = le document le plus récent
  const folders = VAULT_TYPES.map(([k, l]) => {
    const fs = files.filter((x) => x.doc_type === k).sort((a, b) => (b.valid_until || '9').localeCompare(a.valid_until || '9'));
    return { k, l, fs, cur: fs[0] };
  }).filter((x) => x.fs.length || !q);
  const shown = folders.filter((x) => (!f.types.length || f.types.includes(x.k)) && (!f.st.length || (x.cur && f.st.includes(stKey(x.cur)))) && (!q || t(x.l).toLowerCase().includes(q.toLowerCase()) || x.fs.some((y) => y.name.toLowerCase().includes(q.toLowerCase()))));
  const alerts = folders.filter((x) => x.cur && stKey(x.cur) !== 'ok');
  return (
    <div className="content">
      <TopBar title={t('Mon coffre-fort')} sub={company.name} />
      <SearchBar placeholder={t('Recherchez un document')} value={q} onChange={setQ} onFilter={() => setOpen(true)} filterActive={f.st.length + f.types.length > 0} />
      {alerts.length > 0 && <div className="alert"><LuTriangleAlert className="red-t" size={26} /><div><b>{t('{n} documents à renouveler', { n: alerts.length })}</b><div className="small">{alerts.map((x) => `${t(x.l)} ${stKey(x.cur) === 'exp' ? t('expiré') : t('expire le {d}', { d: date(x.cur.valid_until) })}`).join(' · ')}</div></div></div>}
      <Sec title={<><LuLock className="red-t" /> {t('Mes documents')}</>} meta={t('{n} documents', { n: files.length })} />
      <p className="small faint" style={{ marginTop: -6 }}><b className="req-star">*</b> {t('document obligatoire pour exercer (à présenter sur demande d’un client ou d’un donneur d’ordre)')}</p>
      <div className="list">
        {shown.map((x) => (
          <div key={x.k} className="li click" {...kbd} onClick={() => navigate('/pro/coffre-fort/' + x.k)}>
            <div className="ficon navy"><LuFolder /></div>
            <div className="grow"><div className="t1"><span>{t(x.l)}{VAULT_REQUIRED.includes(x.k) && <b className="req-star" title={t('Obligatoire')}>{'\u00a0*'}</b>}</span></div>
              <div className="row small">{t('{n} doc', { n: x.fs.length })}{x.cur ? <StatusPill s={reviewPill(x.cur) || validity(x.cur)} /> : <Pill c="grey">{t('À ajouter')}</Pill>}</div>
              {x.cur?.valid_until && <div className="t2">{t('Valide jusqu’au {d}', { d: date(x.cur.valid_until) })}</div>}</div>
            <button type="button" className="btn xs ghost dep-btn" onClick={(e) => deposit(e, x.k)} aria-label={t('Déposer : {l}', { l: t(x.l) })}><LuUpload /> <span className="hide-sm">{t('Déposer')}</span></button>
            <LuChevronRight />
          </div>
        ))}
      </div>
      <PageFab primary={{ label: t('Ajouter un document'), onClick: () => setAdd(true) }} />
      <Sheet open={open} onClose={() => setOpen(false)} title={t('Filtrer')} right={<span className="red-t bold small">{t('{n} sélectionnés', { n: f.st.length + f.types.length })}</span>}>
        <div className="small bold">{t('Statut')}</div>
        <Chips multi options={[['ok', t('À jour')], ['soon', t('Expire bientôt')], ['exp', t('Expiré')]]} value={f.st} onChange={(st) => setF({ ...f, st })} />
        <div className="small bold">{t('Type de document')}</div>
        <div className="checklist">{VAULT_TYPES.map(([k, l]) => <label key={k} className="check"><input type="checkbox" checked={f.types.includes(k)} onChange={(e) => setF({ ...f, types: e.target.checked ? [...f.types, k] : f.types.filter((y) => y !== k) })} />{t(l)}</label>)}</div>
        <div className="btns"><div className="two"><button className="btn ghost" onClick={() => setF({ st: [], types: [] })}>{t('Réinitialiser')}</button><button className="btn" onClick={() => setOpen(false)}>{t('Afficher {n} documents', { n: shown.reduce((s, x) => s + x.fs.length, 0) })}</button></div></div>
      </Sheet>
      <UploadSheet open={add} onClose={() => setAdd(false)} kind="vault" types={VAULT_TYPES} onDone={() => { setAdd(false); reload(); }} />
      <UploadSheet open={!!dep} onClose={() => setDep(null)} kind="vault" types={VAULT_TYPES} presetType={dep?.type} presetFile={dep?.file} onDone={() => { setDep(null); reload(); }} />
    </div>
  );
}

// Réglages par type de document du coffre-fort (gardés même sans document, appliqués aux prochains ajouts)
export const vaultPrefs = (company, type) => ({ remind: 15, shared: false, ...(company?.settings?.vault?.[type] || {}) });

// Rappels d'expiration : une notification par document, une seule fois, quand on entre dans la période de rappel
export async function checkVaultReminders(company, profile) {
  if (!company?.id || !profile?.id) return;
  const files = await api.select('files', { company_id: company.id, kind: 'vault' });
  const now = new Date();
  for (const f of files) {
    const days = Number(f.remind_days) || 0;
    if (!days || !f.valid_until || f.reminded_at) continue;
    const left = Math.ceil((new Date(f.valid_until + 'T23:59:59') - now) / 864e5);
    if (left > days) continue;
    await api.insert('notifications', { user_id: profile.id, category: 'documents', title: left < 0 ? t('Document expiré : {n}', { n: f.name }) : t('Document à renouveler : {n}', { n: f.name }),
      body: left < 0 ? t('Expiré depuis le {d}', { d: date(f.valid_until) }) : t('Expire le {d} (dans {n} jours)', { d: date(f.valid_until), n: left }), link: '/pro/coffre-fort/' + f.doc_type });
    await api.update('files', { id: f.id }, { reminded_at: now.toISOString() });
  }
}

export function VaultType({ params }) {
  const { company, setCompany, run } = useApp();
  const [add, setAdd] = useState(false);
  const [files, reload] = useData(() => api.select('files', { company_id: company.id, kind: 'vault', doc_type: params.type }, { order: 'issued_at.desc' }), [params.type]);
  const [p, setP] = useState(() => vaultPrefs(company, params.type));
  if (!files) return <div className="content"><TopBar title={t('Mon coffre-fort')} /><Loader /></div>;
  const remind = p.remind;
  const shared = p.shared;
  // Enregistre le réglage pour ce type (même sans document) et l'applique aux documents existants
  const setAll = (patch) => {
    const n = { ...p, ...('remind_days' in patch ? { remind: patch.remind_days } : {}), ...('shared_with_client' in patch ? { shared: patch.shared_with_client } : {}) };
    setP(n);
    return run(async () => {
      const settings = { ...company.settings, vault: { ...(company.settings?.vault || {}), [params.type]: n } };
      await api.update('companies', { id: company.id }, { settings }); setCompany({ ...company, settings });
      for (const f of files) await api.update('files', { id: f.id }, { ...patch, ...('remind_days' in patch ? { reminded_at: null } : {}) });
    }, t('Réglage enregistré')).then(reload);
  };
  return (
    <div className="content narrow">
      <TopBar title={t('Mon coffre-fort')} sub={docTypeLabel(params.type, VAULT_TYPES)} />
      <button className="btn block mb" onClick={() => setAdd(true)}><LuUpload /> {t('Déposer un document')}</button>
      <Sec title={t('Documents')} meta={t('{n} documents', { n: files.length })} />
      {!files.length ? <Empty text={t('Aucun document de ce type.')} /> : (
        <div className="list">{files.map((f) => (
          <div key={f.id} className="li">
            <div className="ficon"><LuFileText /></div>
            <div className="grow"><div className="t1">{f.name}</div><div className="t2">{t('Délivrée le {d}', { d: date(f.issued_at) })}</div>{f.review_status === 'refuse' && f.review_note && <div className="small red-t">{t('Motif : {m}', { m: f.review_note })}</div>}<div className="row small" style={{ marginTop: 4 }}><StatusPill s={reviewPill(f) || validity(f)} /><span className="faint">{f.valid_until ? (validity(f)[1] === t('Expiré') ? t('Expirée le {d}', { d: date(f.valid_until) }) : t('Valide jusqu’au {d}', { d: date(f.valid_until) })) : t('Sans date de fin')}</span></div></div>
            <button className="round" onClick={() => openFile(f.path, f.name)} aria-label={t('Télécharger')}><LuDownload /></button>
            <button className="iconbtn" onClick={() => run(async () => { await api.remove('files', { id: f.id }); }, t('Document supprimé')).then(reload)} aria-label={t('Supprimer')}><LuTrash2 /></button>
          </div>
        ))}</div>
      )}
      <Sec title={t('Rappel et partage')} />
      <div className="kv">
        <SettingToggle label={t('Me prévenir avant expiration')} hint={remind > 0 ? t('Notification {n} jours avant la date de fin de validité', { n: remind }) : t('Aucun rappel pour ce type de document')} checked={remind > 0} onChange={(v) => setAll({ remind_days: v ? 15 : 0 })} />
        {remind > 0 && <div className="r"><span className="k">{t('Délai du rappel')}</span><select value={remind} onChange={(e) => setAll({ remind_days: +e.target.value })}>{[7, 15, 30, 60, 90].map((n) => <option key={n} value={n}>{t('{n} jours avant', { n })}</option>)}</select></div>}
        <SettingToggle label={t('Partager avec mes clients')} hint={shared ? t('Visible dans l’espace Artesa de vos clients (ex. attestation décennale)') : t('Visible uniquement par votre entreprise')} checked={shared} onChange={(v) => setAll({ shared_with_client: v })} />
      </div>
      {!files.length && <p className="small faint">{t('Ces réglages s’appliqueront aux documents que vous ajouterez.')}</p>}
      <PageFab primary={{ label: t('Ajouter'), onClick: () => setAdd(true) }} />
      <UploadSheet open={add} onClose={() => setAdd(false)} kind="vault" types={VAULT_TYPES} presetType={params.type} onDone={() => { setAdd(false); reload(); }} />
    </div>
  );
}
