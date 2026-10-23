import { useState } from 'react';
import { LuPlus } from 'react-icons/lu';
import { navigate } from '../../lib/router.jsx';
import { t } from '../../lib/i18n.js';
import { money, date, clientName } from '../../lib/format.js';
import { statusPill, effectiveStatus, kindLabel } from '../../lib/docs.js';
import { SearchBar, Sec, Table, StatusPill, Sheet, Chips } from '../../ui/index.jsx';

// Tableau des devis ou des factures (un client ou tous les clients)
export function DocList({ docs, clients, kind, newHref, from }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [st, setSt] = useState([]);
  const isQ = kind === 'devis';
  const list = docs.filter((d) => (isQ ? d.kind === 'devis' : d.kind !== 'devis'))
    .filter((d) => !st.length || st.includes(effectiveStatus(d)))
    .filter((d) => !q || [d.number, d.object, clientName(clients[d.client_id])].join(' ').toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.issue_date || '').localeCompare(a.issue_date || '') || (b.number || 'z').localeCompare(a.number || 'z'));
  const all = docs.filter((d) => (isQ ? d.kind === 'devis' : d.kind !== 'devis'));
  const meta = isQ ? t('{n} devis · {a} acceptés', { n: all.length, a: all.filter((d) => d.status === 'accepte').length })
    : t('{n} factures · {a} à payer', { n: all.filter((d) => d.kind !== 'avoir').length, a: all.filter((d) => ['envoyee', 'partielle', 'retard'].includes(effectiveStatus(d))).length });
  const opts = isQ ? [['brouillon', t('Brouillon')], ['envoye', t('En attente')], ['accepte', t('Accepté')], ['refuse', t('Refusé')], ['expire', t('Expiré')]]
    : [['brouillon', t('Brouillon')], ['envoyee', t('En attente')], ['partielle', t('Partielle')], ['retard', t('En retard')], ['payee', t('Payée')]];
  return (
    <>
      <SearchBar placeholder={isQ ? t('Recherchez un devis') : t('Recherchez une facture')} value={q} onChange={setQ} onFilter={() => setOpen(true)} filterActive={st.length > 0} />
      <Sec title={isQ ? t('Mes devis') : t('Mes factures')} meta={meta} />
      <Table rows={list} onRow={(d) => navigate('/pro/documents/' + d.id + (from ? '?from=' + from : ''))} empty={isQ ? t('Aucun devis pour le moment') : t('Aucune facture pour le moment')}
        cols={[
          { label: isQ ? t('N° devis') : t('N° facture'), render: (d) => <span className="small bold">{d.number || '—'}{d.kind !== 'devis' && d.kind !== 'facture' && <div className="faint">{kindLabel(d.kind)}</div>}</span> },
          { label: t('Statut'), render: (d) => <StatusPill s={statusPill(d)} /> },
          { label: t('Client'), render: (d) => clientName(clients[d.client_id]) },
          { label: t("Date d'émission"), render: (d) => <span className="small">{date(d.issue_date)}</span> },
          { label: t('Total HT'), num: true, render: (d) => money(d.totals?.ht) },
        ]} />
      {newHref && <button className="fab" onClick={() => navigate(newHref)} aria-label={isQ ? t('Nouveau devis') : t('Nouvelle facture')}><LuPlus /></button>}
      <Sheet open={open} onClose={() => setOpen(false)} title={t('Filtrer par statut')}>
        <Chips multi options={opts} value={st} onChange={setSt} />
        <div className="btns"><div className="two"><button className="btn ghost" onClick={() => setSt([])}>{t('Réinitialiser')}</button><button className="btn" onClick={() => setOpen(false)}>{t('Afficher {n}', { n: list.length })}</button></div></div>
      </Sheet>
    </>
  );
}
