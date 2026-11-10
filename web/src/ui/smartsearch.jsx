// Recherche globale de l'artisan avec propositions en direct (clients, devis, factures, RDV, produits, documents, actions)
import { useEffect, useMemo, useRef, useState } from 'react';
import { runAction } from '../lib/assistant-actions.js';
import { searchKB, nz } from '../lib/assistant-kb.js';
import { OFFLINE } from '../lib/api.js';
import { LuSearch, LuX, LuUser, LuFileText, LuFilePen, LuCalendar, LuPackage, LuFolder, LuZap, LuClock, LuHardHat, LuMessageSquare , LuSparkles } from 'react-icons/lu';
import { DictateButton } from './dictate.jsx';
import { api } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { navigate } from '../lib/router.jsx';
import { t } from '../lib/i18n.js';
import { clientName, money, date, dateShort, hm } from '../lib/format.js';
import { kindLabel, statusPill } from '../lib/docs.js';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const RKEY = 'ay-recent-search';
// Phrase impérative (« ouvre… », « fais un devis… ») : on exécute l'action au lieu d'afficher la réponse
const IMP = /^(ouvr|affich|montre|va |vas |aller|emmene|nouveau|nouvelle|cree|creer|fais|fait|prepare|ajoute|programme|planifie|cale|ecri|redige)/;
const imperative = (v) => IMP.test(nz(v).replace(/^(peux.?tu|tu peux|pourrais.?tu|stp|svp|s il te plait|merci de|je veux|je voudrais|j aimerais)\s+/, ''));
const recent = () => { try { return JSON.parse(localStorage.getItem(RKEY) || '[]'); } catch { return []; } };
const pushRecent = (q) => { try { localStorage.setItem(RKEY, JSON.stringify([q, ...recent().filter((x) => x !== q)].slice(0, 5))); } catch {} };

export const PRO_ACTIONS = [
  ['Nouveau client', '/pro/clients/nouveau', 'clients'], ['Nouveau devis', '/pro/documents/nouveau?kind=devis', 'devis'], ['Nouvelle facture', '/pro/documents/nouveau?kind=facture', 'devis'],
  ['Nouveau rendez-vous', '/pro/planning/nouveau', 'planning'], ['Planning de la semaine', '/pro/planning', 'planning'], ['Tous les devis', '/pro/documents/devis', 'devis'],
  ['Toutes les factures', '/pro/documents/factures', 'devis'], ['Factures en retard', '/pro/documents/factures?statut=retard', 'devis'], ['Mon coffre-fort', '/pro/coffre-fort', null],
  ['Photos des chantiers', '/pro/photos', null], ['Statut projet', '/pro/crm/statut', null], ['KPI de l’entreprise', '/pro/crm/kpi', 'kpi'], ['Export comptable', '/pro/crm/export', 'kpi'],
  ['Ma bibliothèque', '/pro/crm/bibliotheque', 'prix'], ['Ajouter un produit', '/pro/crm/bibliotheque/nouveau', 'prix'], ['Relances à faire', '/pro/relances', 'devis'], ['Messages', '/pro/messages', null],
  ['Mon réseau', '/pro/reseau', null], ['Mon entreprise', '/pro/compte/entreprise', null], ['Mon équipe', '/pro/compte/equipe', null], ['Réglages du planning', '/pro/planning/reglages', 'planning'], ['Aide et support', '/pro/compte/aide', null],
];

export function SmartSearch({ placeholder, scope }) {
  const { company, can } = useApp();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [sel, setSel] = useState(0);
  const box = useRef();
  // Phrase en langage naturel (tapée ou dictée) : l'assistant la comprend et propose l'action directe en tête
  const [ai, setAi] = useState(null); // { text, links } | { ask: true }
  const [aiAns, setAiAns] = useState(null);
  const voice = useRef(false);
  useEffect(() => {
    setAiAns(null);
    const v = q.trim();
    if (v.split(/\s+/).length < 2 && !/^[a-z]{2}[ -]?\d{4}/i.test(v)) { setAi(null); return; }
    let live = true;
    const id = setTimeout(async () => {
      const act = await runAction(v, { company }).catch(() => null);
      if (!live) return;
      if (act) {
        setAi(act);
        // Commande dictée à la voix et claire (« ouvre… », « fais un devis pour… ») : on l'exécute directement
        if (voice.current && act.go && (act.act || imperative(v))) { voice.current = false; setOpen(false); setQ(''); navigate(act.go); }
        return;
      }
      const kb = searchKB(v, '/pro');
      setAi(kb.length ? { text: t(kb[0].a), links: kb[0].links, kb: kb[0] } : /\?$|^(comment|pourquoi|est.?ce|quel|quelle|combien|ou |peut.?on|puis.?je)/i.test(v) ? { ask: true } : null);
    }, voice.current ? 0 : 450);
    return () => { live = false; clearTimeout(id); };
  }, [q]);
  const askAI = async () => {
    setAiAns({ busy: true });
    const kb = searchKB(q, '/pro');
    const r = OFFLINE ? {} : await api.fn('assistant', { question: q.trim(), facts: kb.map((e) => ({ q: e.q, a: e.a })) }).catch(() => ({}));
    setAiAns({ text: r.answer || (kb[0] ? t(kb[0].a) : t('Je n’ai pas de réponse précise. Essayez l’assistant (bouton +) ou le support.')) });
  };
  useEffect(() => {
    if (!open || data) return;
    (async () => {
      const cid = company.id;
      const [clients, docs, appts, items, files, projects, convs] = await Promise.all([
        api.select('clients', { company_id: cid }), api.select('documents', { company_id: cid }), api.select('appointments', { company_id: cid }, { order: 'start_at.desc', limit: 400 }),
        api.select('items', { company_id: cid }), api.select('files', { company_id: cid, kind: ['doc', 'vault'] }),
        api.select('projects', { company_id: cid }).catch(() => []), api.select('conversations', {}).catch(() => []),
      ]);
      const msgs = convs.length ? await api.select('messages', { conversation_id: convs.map((c) => c.id) }, { order: 'created_at.desc', limit: 500 }).catch(() => []) : [];
      setData({ clients, docs, appts, items, files, projects, msgs, cm: Object.fromEntries(clients.map((c) => [c.id, c])) });
    })().catch(() => setData({ clients: [], docs: [], appts: [], items: [], files: [], projects: [], msgs: [], cm: {} }));
  }, [open]);
  useEffect(() => {
    const f = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f);
  }, []);

  const groups = useMemo(() => {
    const n = norm(q.trim());
    const acts = PRO_ACTIONS.filter(([, , perm]) => !perm || can(perm)).filter(([l]) => !n || norm(t(l)).includes(n)).filter((a) => !scope || (scope === 'documents' ? /devis|factur|coffre|photo|relance/i.test(a[1]) : scope === 'crm' ? /crm|relance/.test(a[1]) : true));
    if (!n) {
      const r = recent().map((x) => ({ icon: LuClock, main: x, sub: t('Recherche récente'), fill: x }));
      return [[t('Récent'), r], [t('Raccourcis'), acts.slice(0, 6).map(([l, to]) => ({ icon: LuZap, main: t(l), to }))]].filter((g) => g[1].length);
    }
    if (!data) return [[t('Raccourcis'), acts.slice(0, 5).map(([l, to]) => ({ icon: LuZap, main: t(l), to }))]];
    const has = (...xs) => norm(xs.join(' ')).includes(n);
    const cw = (c) => (c ? [clientName(c), c.company_name, c.trade_name, c.last_name, c.first_name].join(' ') : '');
    const out = [];
    if (scope !== 'documents') {
      const cl = data.clients.filter((c) => has(clientName(c), c.last_name, c.first_name, c.company_name, c.trade_name, c.number, c.email, c.mobile, c.phone, c.billing_city, c.site_city)).slice(0, 5);
      out.push([t('Clients'), cl.map((c) => ({ icon: LuUser, main: clientName(c), sub: [c.number, c.site_city || c.billing_city].filter(Boolean).join(' · '), to: '/pro/clients/' + c.id }))]);
    }
    const dc = data.docs.filter((d) => has(d.number, d.object, cw(data.cm[d.client_id]), kindLabel(d.kind))).slice(0, 6);
    out.push([t('Devis et factures'), dc.map((d) => ({ icon: d.kind === 'devis' ? LuFilePen : LuFileText, main: `${d.number || t('Brouillon')} · ${d.object || kindLabel(d.kind)}`, sub: `${clientName(data.cm[d.client_id])} · ${statusPill(d)[1]} · ${money(d.totals?.ttc)}`, to: '/pro/documents/' + d.id }))]);
    if (scope !== 'documents') {
      const ap = data.appts.filter((a) => has(a.title, a.type, a.address, cw(data.cm[a.client_id]))).slice(0, 4);
      out.push([t('Rendez-vous'), ap.map((a) => ({ icon: LuCalendar, main: a.title || t(a.type), sub: `${dateShort(a.start_at)} ${hm(a.start_at)} · ${clientName(data.cm[a.client_id])}`, to: '/pro/planning/rdv/' + a.id }))]);
      if (can('prix')) out.push([t('Bibliothèque'), data.items.filter((i) => has(i.name, i.ref, i.family, i.supplier)).slice(0, 4).map((i) => ({ icon: LuPackage, main: i.name, sub: `${i.family || ''} · ${money(i.sale_price)} ${t('HT')}`, to: '/pro/crm/bibliotheque/' + i.id }))]);
    }
    if (scope !== 'documents') {
      out.push([t('Chantiers'), (data.projects || []).filter((x) => has(x.title, x.address, cw(data.cm[x.client_id]))).slice(0, 4).map((x) => ({ icon: LuHardHat, main: x.title, sub: [clientName(data.cm[x.client_id]), x.address].filter(Boolean).join(' · '), to: x.client_id ? '/pro/clients/' + x.client_id : '/pro/crm/statut' }))]);
      out.push([t('Messages'), (data.msgs || []).filter((m) => has(m.body, m.sender_name)).slice(0, 4).map((m) => ({ icon: LuMessageSquare, main: (m.body || '').slice(0, 80), sub: `${m.sender_name || ''} · ${dateShort(m.created_at)}`, to: '/pro/messages/' + m.conversation_id }))]);
    }
    out.push([t('Documents'), data.files.filter((f) => has(f.name, f.doc_type, cw(data.cm[f.client_id]))).slice(0, 4).map((f) => ({ icon: LuFolder, main: f.name, sub: f.kind === 'vault' ? t('Mon coffre-fort') : clientName(data.cm[f.client_id]), to: f.kind === 'vault' ? '/pro/coffre-fort/' + f.doc_type : '/pro/autres-docs/' + f.client_id }))]);
    out.push([t('Actions'), acts.slice(0, 4).map(([l, to]) => ({ icon: LuZap, main: t(l), to }))]);
    return out.filter((g) => g[1].length);
  }, [q, data, scope]);
  const flat = groups.flatMap((g) => g[1]);
  const pick = (it) => {
    if (!it) { if (q.trim()) { pushRecent(q.trim()); navigate('/pro/recherche?q=' + encodeURIComponent(q.trim())); } return; }
    if (it.fill) { setQ(it.fill); setSel(0); return; }
    if (q.trim()) pushRecent(q.trim());
    setOpen(false); navigate(it.to);
  };
  // Entrée sur une phrase : l'assistant répond ici même (ou exécute l'ordre), sans quitter la page
  const submit = async () => {
    const v = q.trim();
    if (!v) { pick(flat[sel]); return; }
    if (v.split(/\s+/).length >= 2 && sel === 0) {
      const act = await runAction(v, { company }).catch(() => null);
      if (act) {
        pushRecent(v);
        if (act.go && (act.act || imperative(v))) { setOpen(false); setQ(''); navigate(act.go); return; }
        setAi(act); setAiAns(null); setOpen(true); return;
      }
      const kb = searchKB(v, '/pro');
      if (kb.length) { setAi({ text: t(kb[0].a), links: kb[0].links, kb: kb[0] }); setOpen(true); return; }
      if (!flat.some((x) => !x.fill && x.icon !== LuZap)) { setAi({ ask: true }); setOpen(true); if (!OFFLINE) askAI(); else setAiAns({ text: t('Je n’ai pas de réponse précise. Essayez l’assistant (bouton +) ou le support.') }); return; }
    }
    pick(flat[sel]);
  };
  const key = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); submit(); }
    else if (e.key === 'Escape') setOpen(false);
  };
  let i = -1;
  return (
    <div className="searchrow" ref={box} style={{ position: 'relative' }}>
      <label className="search">
        <input value={q} placeholder={placeholder || t('Que recherchez-vous ?')} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setSel(0); setOpen(true); }} onKeyDown={key} aria-label={placeholder || t('Que recherchez-vous ?')} role="combobox" aria-expanded={open} />
        <DictateButton className="link" style={{ color: '#fff' }} onText={(s) => { voice.current = true; setQ(s); setSel(0); setOpen(true); }} />
        {q ? <button className="link" style={{ color: '#fff' }} onClick={() => setQ('')} aria-label={t('Effacer')}><LuX /></button> : <LuSearch />}
      </label>
      {open && (groups.length > 0 || (ai && q.trim())) && (
        <div className="suggest" role="listbox" style={{ top: 64 }}>
          {ai && q.trim() && (
            <div className="ss-ai">
              <div className="grp"><LuSparkles /> {t('Assistant')}</div>
              {ai.ask ? (
                <div className="ss-ai-body">{aiAns?.text || (aiAns?.busy ? t('Je réfléchis…') : t('C’est une question : je peux y répondre.'))}
                  {!aiAns && <button type="button" className="ss-ai-btn" onMouseDown={(e) => { e.preventDefault(); askAI(); }}>{t('Répondre avec l’IA')}</button>}</div>
              ) : (
                <div className="ss-ai-body">{(aiAns?.text || ai.text).split('\n').slice(0, 6).map((l, k) => <div key={k}>{l}</div>)}
                  <div className="ai-links">
                    {(ai.links || []).slice(0, 4).map((l) => l.href ? <a key={l.href} className="ai-link" href={l.href}>{t(l.label)} ›</a> : <button type="button" key={l.to + l.label} onMouseDown={(e) => { e.preventDefault(); if (q.trim()) pushRecent(q.trim()); setOpen(false); navigate(l.to); }}>{t(l.label)} ›</button>)}
                    {ai.kb && !aiAns && !OFFLINE && <button type="button" className="ghost" onMouseDown={(e) => { e.preventDefault(); askAI(); }}>{t('Préciser avec l’IA')}</button>}
                  </div>
                </div>
              )}
            </div>
          )}
          {groups.map(([g, items]) => (
            <div key={g}>
              <div className="grp">{g}</div>
              {items.map((it) => { i++; const k = i; const I = it.icon; return (
                <button type="button" key={k} className={k === sel ? 'on' : ''} onMouseEnter={() => setSel(k)} onMouseDown={(e) => { e.preventDefault(); pick(it); }}><I /><span><b>{it.main}</b>{it.sub && <small>{it.sub}</small>}</span></button>
              ); })}
            </div>
          ))}
          {q.trim() && <button type="button" onMouseDown={(e) => { e.preventDefault(); pick(null); }}><LuSearch /><span><b>{t('Voir tous les résultats pour « {q} »', { q: q.trim() })}</b></span></button>}
        </div>
      )}
      {open && q.trim() && data && !ai && groups.every((g) => g[0] === t("Actions")) && !groups.length && <div className="suggest" style={{ top: 64 }}><div className="grp">{t('Aucun résultat')}</div></div>}
    </div>
  );
}
