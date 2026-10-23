import { useState } from 'react';
import { LuPlus, LuCamera, LuFileText, LuDownload, LuChevronRight, LuFolder, LuTriangleAlert, LuLock, LuTrash2 } from 'react-icons/lu';
import { api } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { navigate } from '../../lib/router.jsx';
import { t } from '../../lib/i18n.js';
import { clientName, dateMed, date, iso, rel } from '../../lib/format.js';
import { DOC_TYPES, VAULT_TYPES, docTypeLabel, validity } from '../../lib/docs.js';
import { TopBar, SearchBar, Sec, Sheet, Field, Chips, useData, Loader, Empty, Img, Lightbox, openFile, pickFiles, Toggle, StatusPill, Pill } from '../../ui/index.jsx';
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
      {!list.length ? <Empty text={t('Aucun client')} /> : (
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
      <button className="fab" onClick={() => setAdd(true)} aria-label={t('Ajouter des photos')}><LuPlus /></button>
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
      <div className="grow" onClick={onOpen} style={{ cursor: onOpen ? 'pointer' : undefined }}>
        <div className="t1">{f.name}</div>
        <div className="t2">{extra}</div>
        <div className="row small" style={{ marginTop: 4 }}><Pill c="grey">{docTypeLabel(f.doc_type, types)}</Pill><span className="faint">{date(f.issued_at || f.created_at)}</span>{f.shared_with_client && <Pill c="green">{t('Partagé')}</Pill>}</div>
      </div>
      <button className="round" onClick={() => openFile(f.path, f.name)} aria-label={t('Télécharger')}><LuDownload /></button>
    </div>
  );
}

export function OtherDocsClient({ params }) {
  const { company } = useApp();
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
      <button className="fab" onClick={() => setAdd(true)} aria-label={t('Ajouter un document')}><LuPlus /></button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('Filtrer par type')} right={<span className="red-t bold small">{t('{n} sélectionnés', { n: types.length })}</span>}>
        <div className="checklist">{DOC_TYPES.map(([k, l]) => <label key={k} className="check"><input type="checkbox" checked={types.includes(k)} onChange={(e) => setTypes(e.target.checked ? [...types, k] : types.filter((x) => x !== k))} />{t(l)}</label>)}</div>
        <div className="btns"><div className="two"><button className="btn ghost" onClick={() => setTypes([])}>{t('Réinitialiser')}</button><button className="btn" onClick={() => setOpen(false)}>{t('Afficher {n} documents', { n: list.length })}</button></div></div>
      </Sheet>
      <UploadSheet open={add} onClose={() => setAdd(false)} kind="doc" types={DOC_TYPES} clientId={params.id} onDone={() => { setAdd(false); reload(); }} />
      <EditFile f={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); }} types={DOC_TYPES} />
    </div>
  );
}

function UploadSheet({ open, onClose, kind, types, clientId, onDone, presetType }) {
  const { company, run } = useApp();
  const [v, setV] = useState({ doc_type: presetType || types[0][0], name: '', issued_at: iso(new Date()), valid_until: '', shared_with_client: kind === 'doc' });
  const [file, setFile] = useState(null);
  if (!open) return null;
  const save = () => run(async () => {
    if (!file) throw new Error(t('Choisissez un fichier.'));
    const up = await uploadTo(`${company.id}/${kind}/${clientId || 'entreprise'}`, file);
    await api.insert('files', { company_id: company.id, client_id: clientId || null, kind, doc_type: v.doc_type, name: v.name || file.name.replace(/\.[^.]+$/, ''), path: up.path, mime: file.type, size: file.size, issued_at: v.issued_at || null, valid_until: v.valid_until || null, shared_with_client: v.shared_with_client });
    onDone();
  }, t('Document ajouté'));
  return (
    <Sheet open onClose={onClose} title={t('Ajouter un document')}>
      <button className="btn ghost block mb" onClick={async () => { const [f] = await pickFiles({ multiple: false, accept: 'application/pdf,image/*,.doc,.docx,.xls,.xlsx' }); if (f) { setFile(f); if (!v.name) setV({ ...v, name: f.name.replace(/\.[^.]+$/, '') }); } }}>{file ? '📎 ' + file.name : t('Choisir le fichier')}</button>
      <Field label={t('Type')}><select value={v.doc_type} onChange={(e) => setV({ ...v, doc_type: e.target.value })}>{types.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select></Field>
      <Field label={t('Nom')}><input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
      <div className="form-grid two"><Field label={t('Délivré le')}><input type="date" value={v.issued_at} onChange={(e) => setV({ ...v, issued_at: e.target.value })} /></Field><Field label={t('Valide jusqu’au')}><input type="date" value={v.valid_until} onChange={(e) => setV({ ...v, valid_until: e.target.value })} /></Field></div>
      <label className="check"><input type="checkbox" checked={v.shared_with_client} onChange={(e) => setV({ ...v, shared_with_client: e.target.checked })} />{kind === 'vault' ? t('Partager avec mes clients (visible dans leur espace)') : t('Partager avec le client')}</label>
      <button className="btn block mt" onClick={save}>{t('Enregistrer')}</button>
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
        <div className="r"><span className="k">{t('Partagé avec le client')}</span><Toggle checked={f.shared_with_client} onChange={(v) => run(() => api.update('files', { id: f.id }, { shared_with_client: v })).then(onDone)} /></div>
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
  const [files, reload] = useData(() => api.select('files', { company_id: company.id, kind: 'vault' }, { order: 'created_at.desc' }), []);
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
      <div className="list">
        {shown.map((x) => (
          <button key={x.k} className="li click" onClick={() => navigate('/pro/coffre-fort/' + x.k)}>
            <div className="ficon navy"><LuFolder /></div>
            <div className="grow"><div className="t1">{t(x.l)}</div>
              <div className="row small">{t('{n} doc', { n: x.fs.length })}{x.cur ? <StatusPill s={validity(x.cur)} /> : <Pill c="grey">{t('À ajouter')}</Pill>}</div>
              {x.cur?.valid_until && <div className="t2">{t('Valide jusqu’au {d}', { d: date(x.cur.valid_until) })}</div>}</div>
            <LuChevronRight />
          </button>
        ))}
      </div>
      <button className="fab" onClick={() => setAdd(true)} aria-label={t('Ajouter un document')}><LuPlus /></button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('Filtrer')} right={<span className="red-t bold small">{t('{n} sélectionnés', { n: f.st.length + f.types.length })}</span>}>
        <div className="small bold">{t('Statut')}</div>
        <Chips multi options={[['ok', t('À jour')], ['soon', t('Expire bientôt')], ['exp', t('Expiré')]]} value={f.st} onChange={(st) => setF({ ...f, st })} />
        <div className="small bold">{t('Type de document')}</div>
        <div className="checklist">{VAULT_TYPES.map(([k, l]) => <label key={k} className="check"><input type="checkbox" checked={f.types.includes(k)} onChange={(e) => setF({ ...f, types: e.target.checked ? [...f.types, k] : f.types.filter((y) => y !== k) })} />{t(l)}</label>)}</div>
        <div className="btns"><div className="two"><button className="btn ghost" onClick={() => setF({ st: [], types: [] })}>{t('Réinitialiser')}</button><button className="btn" onClick={() => setOpen(false)}>{t('Afficher {n} documents', { n: shown.reduce((s, x) => s + x.fs.length, 0) })}</button></div></div>
      </Sheet>
      <UploadSheet open={add} onClose={() => setAdd(false)} kind="vault" types={VAULT_TYPES} onDone={() => { setAdd(false); reload(); }} />
    </div>
  );
}

export function VaultType({ params }) {
  const { company, run } = useApp();
  const [add, setAdd] = useState(false);
  const [files, reload] = useData(() => api.select('files', { company_id: company.id, kind: 'vault', doc_type: params.type }, { order: 'issued_at.desc' }), [params.type]);
  if (!files) return <div className="content"><TopBar title={t('Mon coffre-fort')} /><Loader /></div>;
  const remind = files[0]?.remind_days ?? 15;
  const shared = files.some((f) => f.shared_with_client);
  const setAll = (patch) => run(async () => { for (const f of files) await api.update('files', { id: f.id }, patch); }, t('Réglage enregistré')).then(reload);
  return (
    <div className="content narrow">
      <TopBar title={t('Mon coffre-fort')} sub={docTypeLabel(params.type, VAULT_TYPES)} />
      <Sec title={t('Documents')} meta={t('{n} documents', { n: files.length })} />
      {!files.length ? <Empty text={t('Aucun document de ce type.')} /> : (
        <div className="list">{files.map((f) => (
          <div key={f.id} className="li">
            <div className="ficon"><LuFileText /></div>
            <div className="grow"><div className="t1">{f.name}</div><div className="t2">{t('Délivrée le {d}', { d: date(f.issued_at) })}</div><div className="row small" style={{ marginTop: 4 }}><StatusPill s={validity(f)} /><span className="faint">{f.valid_until ? (validity(f)[1] === t('Expiré') ? t('Expirée le {d}', { d: date(f.valid_until) }) : t('Valide jusqu’au {d}', { d: date(f.valid_until) })) : t('Sans date de fin')}</span></div></div>
            <button className="round" onClick={() => openFile(f.path, f.name)} aria-label={t('Télécharger')}><LuDownload /></button>
            <button className="iconbtn" onClick={() => run(async () => { await api.remove('files', { id: f.id }); }, t('Document supprimé')).then(reload)} aria-label={t('Supprimer')}><LuTrash2 /></button>
          </div>
        ))}</div>
      )}
      <Sec title={t('Rappel')} />
      <div className="kv">
        <div className="r"><span className="k">{t('Me prévenir avant expiration')}<div className="small faint">{t('{n} jours avant', { n: remind || 15 })}</div></span><Toggle checked={remind > 0} onChange={(v) => setAll({ remind_days: v ? 15 : 0 })} /></div>
        <div className="r"><span className="k">{t('Partager avec mes clients pros')}<div className="small faint">{t('Visible dans leur espace Artis & You')}</div></span><Toggle checked={shared} onChange={(v) => setAll({ shared_with_client: v })} /></div>
      </div>
      <button className="fab" onClick={() => setAdd(true)} aria-label={t('Ajouter')}><LuPlus /></button>
      <UploadSheet open={add} onClose={() => setAdd(false)} kind="vault" types={VAULT_TYPES} presetType={params.type} onDone={() => { setAdd(false); reload(); }} />
    </div>
  );
}
