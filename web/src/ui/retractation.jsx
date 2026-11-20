// Droit de rétractation du particulier sur un devis signé en ligne (contrat conclu à distance)
//  - information avant la signature + formulaire type (Code conso L221-5, R221-1 et son annexe)
//  - demande expresse de commencer avant la fin du délai (L221-25)
//  - fonction « Renoncer au contrat ici » + accusé de réception (L221-21, applicable depuis le 19/06/2026)
import { useState } from 'react';
import { LuUndo2, LuDownload, LuFileText } from 'react-icons/lu';
import { Sheet, Field } from './index.jsx';
import { LawRefs } from './lawref.jsx';
import { api } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { t } from '../lib/i18n.js';
import { date, dateTime } from '../lib/format.js';
import { download } from '../lib/xlsx.js';

export const isConsumer = (client) => (client?.type || 'particulier') === 'particulier';
const coLine = (co = {}) => [co.trade_name || co.name, co.address, [co.zip, co.city].filter(Boolean).join(' '), co.email].filter(Boolean).join(', ');

// Formulaire type de rétractation (annexe à l'article R221-1 du Code de la consommation)
export function formText(company, d, client) {
  return [
    'FORMULAIRE DE RÉTRACTATION',
    '(Veuillez compléter et renvoyer le présent formulaire uniquement si vous souhaitez vous rétracter du contrat.)',
    '',
    `À l'attention de : ${coLine(company) || '[nom, adresse et e-mail de l’artisan]'}`,
    '',
    `Je/Nous (*) vous notifie/notifions (*) par la présente ma/notre (*) rétractation du contrat portant sur la prestation de services ci-dessous :`,
    `Devis n° ${d?.number || '…'}${d?.title ? ' — ' + d.title : ''}`,
    `Commandé le : ${d?.accepted_at ? date(d.accepted_at) : '…'}`,
    `Nom du (des) consommateur(s) : ${[client?.first_name, client?.last_name].filter(Boolean).join(' ') || client?.name || '…'}`,
    `Adresse du (des) consommateur(s) : ${[client?.billing_address, client?.billing_zip, client?.billing_city].filter(Boolean).join(' ') || '…'}`,
    'Signature du (des) consommateur(s) (uniquement en cas de notification du présent formulaire sur papier) :',
    'Date :',
    '',
    '(*) Rayez la mention inutile.',
  ].join('\n');
}
const LAWS = ['conso-L221-18', 'conso-L221-21', 'conso-L221-25', 'conso-L221-28', 'conso-R221-1'];

// Bloc d'information affiché avant la signature, avec la demande de démarrage anticipé
export function RetractationInfo({ d, company, client, startEarly, setStartEarly }) {
  const [form, setForm] = useState(false);
  if (!isConsumer(client)) return null;
  return (
    <div className="card soft mt">
      <div className="small bold mb">{t('Votre droit de rétractation')}</div>
      <p className="small" style={{ margin: 0, lineHeight: 1.55 }}>{t('Ce devis est signé à distance : vous pouvez changer d’avis pendant 14 jours à compter de la signature, sans justification ni frais, avec le bouton « Renoncer au contrat » de votre espace ou le formulaire ci-dessous. L’artisan vous rembourse alors sous 14 jours.')}</p>
      <button type="button" className="link small bold mt" onClick={() => setForm(true)}><LuFileText size={13} /> {t('Voir le formulaire de rétractation')}</button>
      <label className="check" style={{ marginTop: 10 }}><input type="checkbox" checked={startEarly} onChange={(e) => setStartEarly(e.target.checked)} /><span className="small">{t('Je demande que les travaux commencent avant la fin du délai de 14 jours. Si je me rétracte ensuite, je paierai la part des travaux déjà réalisée.')}</span></label>
      <p className="small faint" style={{ margin: '6px 0 0' }}>{t('Pas de rétractation pour une réparation urgente que vous avez demandée à votre domicile, ni une fois les travaux entièrement terminés avec votre accord.')}</p>
      <LawRefs ids={LAWS} />
      {form && <Sheet open onClose={() => setForm(false)} title={t('Formulaire de rétractation')}>
        <pre className="small" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.6 }}>{formText(company, d, client)}</pre>
        <button className="btn ghost block" onClick={() => download(new Blob([formText(company, d, client)], { type: 'text/plain;charset=utf-8' }), `formulaire-retractation-${d?.number || 'devis'}.txt`)}><LuDownload /> {t('Télécharger')}</button>
      </Sheet>}
    </div>
  );
}

// Après la signature : bouton « Renoncer au contrat ici » tant que le délai court, puis accusé de réception
export function RetractationBox({ d, company, client, onDone }) {
  const { run } = useApp();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [ack, setAck] = useState(null);
  const r = d?.conditions?.retractation;
  if (!r?.applicable) return null;
  const receipt = (a) => [
    'ACCUSÉ DE RÉCEPTION — RÉTRACTATION',
    '',
    `Devis : ${d.number || ''}${d.title ? ' — ' + d.title : ''}`,
    `Artisan : ${coLine(company)}`,
    `Signé le : ${d.accepted_at ? dateTime(d.accepted_at) : ''}`,
    `Rétractation enregistrée le : ${dateTime(a?.at || r.withdrawn_at)}`,
    (a?.reason || r.reason) ? `Motif indiqué : ${a?.reason || r.reason}` : '',
    '',
    'Votre rétractation a été transmise à l’artisan. Il doit vous rembourser la totalité des sommes versées au plus tard 14 jours après cette date (art. L. 221-24 du Code de la consommation), sauf la part des travaux déjà réalisés à votre demande expresse avant la fin du délai (art. L. 221-25).',
    '',
    'Document généré par Artis & You.',
  ].filter((x) => x !== '').join('\n');
  const dl = (a) => download(new Blob([receipt(a)], { type: 'text/plain;charset=utf-8' }), `accuse-retractation-${d.number || 'devis'}.txt`);
  if (d.status === 'retracte') return (
    <div className="card soft mt">
      <div className="small bold">{t('Vous vous êtes rétracté le {d}', { d: dateTime(r.withdrawn_at) })}</div>
      <p className="small muted" style={{ margin: '4px 0 0' }}>{t('L’artisan doit vous rembourser les sommes versées sous 14 jours.')}</p>
      <button className="btn ghost sm mt" onClick={() => dl(null)}><LuDownload /> {t('Télécharger l’accusé de réception')}</button>
    </div>
  );
  if (d.status !== 'accepte' || new Date() > new Date(r.until)) return null;
  const go = () => run(async () => { const a = await api.rpc('client_quote_withdraw', { p_id: d.id, p_reason: reason.trim() }); setAck(a || { at: new Date().toISOString(), reason }); }, t('Rétractation enregistrée'));
  return (
    <>
      <div className="card soft mt">
        <div className="small bold">{t('Droit de rétractation jusqu’au {d}', { d: date(r.until) })}</div>
        {r.start_early && <p className="small muted" style={{ margin: '4px 0 0' }}>{t('Vous avez demandé un démarrage avant la fin du délai : en cas de rétractation, la part des travaux déjà réalisée reste due.')}</p>}
        <button className="btn light sm mt" onClick={() => setOpen(true)}><LuUndo2 /> {t('Renoncer au contrat ici')}</button>
      </div>
      <Sheet open={open} onClose={() => { setOpen(false); if (ack) onDone?.(); }} title={ack ? t('Rétractation enregistrée') : t('Renoncer au contrat')}>
        {ack ? <>
          <p>{t('Votre rétractation du devis {n} a été enregistrée le {d} et transmise à l’artisan. Un accusé de réception est aussi dans vos notifications.', { n: d.number, d: dateTime(ack.at) })}</p>
          <button className="btn block" onClick={() => dl(ack)}><LuDownload /> {t('Télécharger l’accusé de réception')}</button>
          <button className="btn ghost block mt" onClick={() => { setOpen(false); onDone?.(); }}>{t('Fermer')}</button>
        </> : <>
          <p>{t('Vous allez renoncer au devis {n} signé le {d}. L’artisan sera prévenu immédiatement et devra vous rembourser les sommes versées sous 14 jours.', { n: d.number, d: date(d.accepted_at) })}</p>
          <Field label={t('Motif (facultatif)')}><textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <button className="btn block" onClick={go}><LuUndo2 /> {t('Confirmer la rétractation')}</button>
          <LawRefs ids={['conso-L221-21', 'conso-L221-24', 'conso-L221-25']} />
        </>}
      </Sheet>
    </>
  );
}
