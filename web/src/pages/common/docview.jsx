// Affichage d'un devis / d'une facture : détail structuré (écran) + document A4 (PDF)
import { useEffect, useState } from 'react';
import { api, fileUrls } from '../../lib/api.js';
import { t } from '../../lib/i18n.js';
import { money, date, dateTime, clientName, fullName } from '../../lib/format.js';
import { computeTotals, sectionSubtotals, kindLabel, statusPill, effectiveStatus } from '../../lib/docs.js';
import { KV, Sec, StatusPill } from '../../ui/index.jsx';

export async function loadDoc(id) {
  const d = await api.one('documents', { id });
  if (!d) return null;
  const [companyLive, clientLive, payments, source] = await Promise.all([
    api.one('companies', { id: d.company_id }).catch(() => null),
    d.client_id ? api.one('clients', { id: d.client_id }).catch(() => null) : null,
    api.select('payments', { document_id: id }, { order: 'paid_on.asc' }).catch(() => []),
    d.source_id ? api.one('documents', { id: d.source_id }).catch(() => null) : null,
  ]);
  const company = d.snapshot?.company ? { ...companyLive, ...d.snapshot.company, settings: companyLive?.settings || {} } : companyLive || {};
  const client = d.snapshot?.client || clientLive || {};
  return { d, company, client, clientLive, payments, source };
}

const addr = (a, z, c) => [a, [z, c].filter(Boolean).join(' ')].filter(Boolean).join(', ');
export const clientAddress = (c) => addr(c.billing_address, c.billing_zip, c.billing_city);
export const siteAddress = (c) => [c.site_name, addr(c.site_address, c.site_zip, c.site_city)].filter(Boolean).join(' · ');
const companyAddr = (c) => addr(c.address, c.zip, c.city);

export function conditionsOf(d, company) {
  const s = company.settings?.docs || {};
  const c = d.conditions || {};
  return {
    paymentTerms: c.paymentTerms ?? s.paymentTerms ?? '30 jours fin de mois',
    discount: c.discount ?? s.discount ?? 'Aucun pour paiement anticipé',
    penalties: c.penalties ?? s.penalties ?? "3 fois le taux d'intérêt légal",
    deposit: c.deposit ?? (d.deposit_pct ? `${d.deposit_pct} % à la commande` : ''),
    mediator: c.mediator ?? s.mediator ?? '',
    notes: c.notes ?? '',
  };
}
export const totalsOf = (d, company) => (d.totals?.ttc !== undefined && d.locked ? d.totals : computeTotals(d.lines, { franchise: company.vat_regime === 'franchise', reverse: d.reverse_charge, deductions: d.totals?.deductions || [] }));

// ─────────────── Détail à l'écran ───────────────
export function DocHero({ d, client, company, forClient }) {
  const tot = totalsOf(d, company);
  const st = effectiveStatus(d);
  const label = d.kind === 'devis'
    ? st === 'envoye' ? (forClient ? t('À signer avant le {d}', { d: date(addDaysIso(d.issue_date, d.validity_days)) }) : t('En attente de signature')) : statusPill(d)[1]
    : ['envoyee', 'partielle', 'retard'].includes(st) ? (d.due_date ? t('À payer · échéance {d}', { d: date(d.due_date) }) : t('À payer')) : statusPill(d)[1];
  return (
    <div className="hero">
      <h2>{d.number || t('Brouillon')}</h2>
      <div className="l2">{d.object || kindLabel(d.kind)} · {forClient ? company.trade_name || company.name : clientName(client)}</div>
      <div className="row">
        <span className="pill" style={{ border: '1.5px solid #fff', color: '#fff' }}>{label}</span>
        <div className="amount"><small>{d.kind === 'devis' ? t('Total TTC') : t('Net à payer')}</small>{money(d.kind === 'devis' ? tot.ttc : tot.net - (d.kind !== 'avoir' ? Number(d.paid_amount || 0) : 0) || tot.net)}</div>
      </div>
    </div>
  );
}
export const addDaysIso = (s, n) => { const x = new Date((s || new Date().toISOString().slice(0, 10)) + 'T12:00:00'); x.setDate(x.getDate() + Number(n || 30)); return x.toISOString().slice(0, 10); };

export function DocSections({ d, company, client, payments = [], source, forClient }) {
  const tot = totalsOf(d, company);
  const cond = conditionsOf(d, company);
  const isQuote = d.kind === 'devis';
  const subs = sectionSubtotals(d.lines);
  const franchise = company.vat_regime === 'franchise';
  return (
    <div className="grid2" style={{ marginTop: 6 }}>
      <div>
        <Sec title={t('Émetteur')} />
        <KV rows={[
          [t('Raison sociale'), company.name], [t('Forme juridique'), [company.legal_form, company.capital && t('capital {c}', { c: company.capital })].filter(Boolean).join(' · ')],
          [t('Adresse'), companyAddr(company)], [t('Téléphone'), company.phone, { href: company.phone && 'tel:' + company.phone }], [t('E-mail'), company.email, { href: company.email && 'mailto:' + company.email }],
          [t('SIRET'), company.siret], company.rm && [t('N° RM'), company.rm], [t('N° TVA intracom.'), franchise ? t('TVA non applicable') : company.vat_number],
        ]} />
        <Sec title={t('Client')} />
        <KV rows={client.type === 'pro' ? [
          [t('Raison sociale'), [client.company_name, client.legal_form && `(${client.legal_form})`].filter(Boolean).join(' ')], client.trade_name && [t('Enseigne'), client.trade_name],
          [t('Adresse de facturation'), clientAddress(client)], [t('SIREN'), client.siren || (client.siret || '').slice(0, 9)], [t('N° TVA intracom.'), client.vat_number],
        ] : [[t('Nom'), [client.civility, fullName(client)].filter(Boolean).join(' ')], [t('Adresse'), clientAddress(client)], [t('Téléphone'), client.mobile || client.phone], [t('E-mail'), client.email]]} />
        <Sec title={isQuote ? t('Devis') : kindLabel(d.kind)} />
        <KV rows={isQuote ? [
          [t("Date d'émission"), date(d.issue_date)], [t('Validité'), t('{n} jours', { n: d.validity_days })], [t('Lieu des travaux'), d.work_address || siteAddress(client)],
          [t('Début prévu'), d.start_date ? date(d.start_date) : '—'], [t('Durée estimée'), d.duration],
        ] : [
          [t("Date d'émission"), date(d.issue_date)], [t('Date de la prestation'), date(d.service_date || d.issue_date)], source && [d.kind === 'avoir' ? t('Facture d’origine') : t('Devis de référence'), source.number],
          [t('Échéance'), d.kind === 'avoir' ? '—' : date(d.due_date)], [t('Adresse de livraison'), d.delivery_address || d.work_address || siteAddress(client)],
          [t('Nature des opérations'), t(d.operations_nature)], [t('TVA sur les débits'), d.vat_on_debits ? t('Oui') : t('Non')],
          forClient && d.number && [t('Facture électronique'), t('Archivée')],
        ]} />
      </div>
      <div>
        <Sec title={isQuote ? t('Détail du devis') : t('Détail de la facture')} />
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>{t('Désignation')}</th><th className="num">{t('Qté')}</th><th className="num">{t('PU HT')}</th><th className="num">{t('Total HT')}</th></tr></thead>
            <tbody>
              {d.lines.map((l) => l.kind === 'section' ? (
                <tr key={l.id}><td colSpan={4} className="red-t bold" style={{ background: 'var(--bordeaux-50)' }}>{l.label}</td></tr>
              ) : l.kind === 'text' ? (
                <tr key={l.id}><td colSpan={4} className="small muted">{l.label}</td></tr>
              ) : (
                <tr key={l.id}><td>{l.label}{l.desc && <div className="small muted">{l.desc}</div>}</td><td className="num" style={{ fontWeight: 400 }}>{l.qty} {l.unit !== 'u' ? l.unit : ''}</td><td className="num" style={{ fontWeight: 400 }}>{money(l.price)}</td><td className="num">{money(l.qty * l.price)}</td></tr>
              ))}
              {Object.keys(subs).length > 1 && d.lines.filter((l) => l.kind === 'section').map((s) => <tr key={'s' + s.id}><td colSpan={3} className="num small">{t('Sous-total HT')} · {s.label}</td><td className="num">{money(subs[s.id])}</td></tr>)}
            </tbody>
          </table>
        </div>
        <Sec title={t('Totaux')} />
        <KV rows={[
          [t('Total HT'), money(tot.ht)],
          ...(franchise ? [[t('TVA'), t('Non applicable, art. 293 B du CGI')]] : d.reverse_charge ? [[t('TVA'), t('Autoliquidation')]] : tot.vat.filter((v) => v.base).map((v) => [t('TVA {r} %', { r: String(v.rate).replace('.', ',') }), money(v.amount)])),
          [t('Total TTC'), money(tot.ttc)],
          ...(tot.deductions || []).map((x) => [t('Acompte déduit {n}', { n: x.number || '' }), '− ' + money(x.ttc)]),
          !isQuote && payments.length > 0 && [t('Déjà réglé'), '− ' + money(d.paid_amount)],
          [isQuote ? t('Total TTC') : t('Net à payer'), money(isQuote ? tot.ttc : Math.max(0, tot.net - (d.kind === 'avoir' ? 0 : Number(d.paid_amount || 0)))), { total: true }],
        ]} />
        <Sec title={t('Conditions')} />
        <KV rows={[
          isQuote ? [t('Paiement'), cond.paymentTerms] : [t('Échéance'), `${date(d.due_date)} (${cond.paymentTerms})`],
          isQuote && cond.deposit && [t('Acompte'), cond.deposit], [t('Escompte'), cond.discount], [t('Pénalités de retard'), cond.penalties],
          [t('Indemnité de recouvrement'), t('40 € (forfaitaire)')], client.type !== 'pro' && cond.mediator && [t('Médiateur'), cond.mediator],
        ]} />
        <Sec title={t('Assurance décennale')} />
        <KV rows={[[t('Assureur'), company.insurer], [t('N° de contrat'), company.insurance_contract], [t('Couverture'), company.insurance_coverage]]} />
        {isQuote ? (
          <>
            <Sec title={t('Bon pour accord')} />
            <div className="card soft">{d.status === 'accepte' ? <span className="green-t bold">✓ {t('Signé par {n} le {d}', { n: d.signed_name || clientName(client), d: dateTime(d.accepted_at) })}</span>
              : d.status === 'refuse' ? <span className="bold">{t('Refusé le {d}', { d: dateTime(d.refused_at) })}{d.conditions?.refusal_reason ? ' · ' + d.conditions.refusal_reason : ''}</span>
              : <span className="muted">{t('Signature du client : en attente')}</span>}</div>
          </>
        ) : d.kind !== 'avoir' && (
          <>
            <Sec title={t('Paiement')} />
            <KV rows={[
              [t('Reste à payer'), money(Math.max(0, tot.net - Number(d.paid_amount || 0))), { red: true }],
              [t('IBAN'), company.iban], company.bic && [t('BIC'), company.bic],
              company.settings?.docs?.onlinePayment !== false && [t('En ligne'), t('Carte ou prélèvement via Artis & You')],
              ...payments.map((p) => [`${date(p.paid_on)} · ${t(p.method)}`, money(p.amount)]),
            ]} />
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────── Document A4 ───────────────
export function A4({ d, company, client, source, logoUrl }) {
  const tot = totalsOf(d, company);
  const cond = conditionsOf(d, company);
  const isQuote = d.kind === 'devis';
  const subs = sectionSubtotals(d.lines);
  const franchise = company.vat_regime === 'franchise';
  const color = company.settings?.pdf?.color || '#7F1111';
  const ini = (company.name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const title = { devis: 'DEVIS', facture: 'FACTURE', acompte: "FACTURE D'ACOMPTE", avoir: 'AVOIR' }[d.kind];
  const rest = Math.max(0, tot.net - Number(d.paid_amount || 0));
  return (
    <div className="a4" style={{ '--doc-color': color }}>
      <div className="hd">
        <div className="logo">
          <div className="mk">{logoUrl ? <img src={logoUrl} alt="" crossOrigin="anonymous" /> : ini}</div>
          <div><b style={{ fontSize: 14 }}>{company.trade_name || company.name}</b><div className="small">{companyAddr(company)}<br />{[company.phone, company.email].filter(Boolean).join(' · ')}</div></div>
        </div>
        <div className="ttl">
          <h1>{t(title)}</h1>
          <div className="small"><b>N° {d.number || t('BROUILLON')}</b><br />{t("Date d'émission")} : {date(d.issue_date)}
            {isQuote ? <><br />{t('Validité')} : {t('{n} jours', { n: d.validity_days })}</> : d.kind !== 'avoir' && <><br />{t('Échéance')} : {date(d.due_date)}</>}
            {source && <><br />{d.kind === 'avoir' ? t('Facture d’origine') : t('Devis de référence')} : {source.number}</>}</div>
        </div>
      </div>
      <div className="two">
        <div>
          <div className="lab">{t('Objet')}</div><b>{d.object}</b>
          <div className="lab" style={{ marginTop: 8 }}>{isQuote ? t('Lieu des travaux') : t('Adresse de livraison et date de la prestation')}</div>
          <div>{d.work_address || d.delivery_address || siteAddress(client)}{!isQuote && <><br />{t('Prestation réalisée le {d}', { d: date(d.service_date || d.issue_date) })}</>}</div>
          {isQuote && (d.start_date || d.duration) && <div className="small">{d.start_date && t('Début prévu : {d}', { d: date(d.start_date) })}{d.duration && ' · ' + t('Durée : {d}', { d: d.duration })}</div>}
          {!isQuote && <div className="small">{t('Nature des opérations')} : {t(d.operations_nature)} · {t('TVA sur les débits')} : {d.vat_on_debits ? t('oui') : t('non')}</div>}
        </div>
        <div className="box">
          <div className="lab">{t('Client')}</div>
          <b>{client.type === 'pro' ? [client.company_name, client.legal_form && `(${client.legal_form})`].filter(Boolean).join(' ') : [client.civility, fullName(client)].filter(Boolean).join(' ')}</b>
          {client.type === 'pro' && client.trade_name && <div>{t('Enseigne')} {client.trade_name}{client.contact_name ? ' · ' + client.contact_name : ''}</div>}
          <div>{clientAddress(client)}</div>
          {client.type === 'pro' && <div className="small">{client.siren || client.siret ? 'SIREN ' + (client.siren || client.siret.slice(0, 9)) : ''}{client.vat_number ? ' · TVA ' + client.vat_number : ''}</div>}
        </div>
      </div>
      <table>
        <thead><tr><th>{t('Désignation')}</th><th className="n">{t('Qté')}</th><th className="n">{t('PU HT (€)')}</th>{!franchise && !d.reverse_charge && <th className="n">{t('TVA')}</th>}<th className="n">{t('Total HT (€)')}</th></tr></thead>
        <tbody>
          {d.lines.map((l, i) => {
            const nextSec = d.lines.slice(i + 1).find((x) => x.kind === 'section');
            const isLastOfSection = l.kind !== 'section' && (i === d.lines.length - 1 || d.lines[i + 1].kind === 'section');
            const secId = [...d.lines.slice(0, i + 1)].reverse().find((x) => x.kind === 'section')?.id;
            const cols = !franchise && !d.reverse_charge ? 5 : 4;
            return [
              l.kind === 'section' ? <tr className="sec" key={l.id}><td colSpan={cols}>{l.label}</td></tr>
                : l.kind === 'text' ? <tr key={l.id}><td colSpan={cols} className="small">{l.label}</td></tr>
                : <tr key={l.id}><td>{l.label}{l.desc && <div className="small">{l.desc}</div>}</td><td className="n">{l.qty} {l.unit !== 'u' ? l.unit : ''}</td><td className="n">{money(l.price).replace(/\s?€/, '')}</td>{!franchise && !d.reverse_charge && <td className="n">{String(l.vat).replace('.', ',')} %</td>}<td className="n">{money(l.qty * l.price).replace(/\s?€/, '')}</td></tr>,
              isLastOfSection && secId && Object.keys(subs).length > 0 && <tr className="sub" key={l.id + 's'}><td colSpan={cols - 1}>{t('Sous-total HT')}</td><td className="n">{money(subs[secId]).replace(/\s?€/, '')}</td></tr>,
            ];
          })}
        </tbody>
      </table>
      <div className="tot">
        <div><span>{t('Total HT')}</span><b>{money(tot.ht)}</b></div>
        {franchise ? <div><span>{t('TVA')}</span><span>{t('non applicable')}</span></div> : d.reverse_charge ? <div><span>{t('TVA')}</span><span>{t('autoliquidation')}</span></div>
          : tot.vat.filter((v) => v.base).map((v) => <div key={v.rate}><span>{t('TVA {r} %', { r: String(v.rate).replace('.', ',') })}</span><span>{money(v.amount)}</span></div>)}
        <div><span>{t('Total TTC')}</span><b>{money(tot.ttc)}</b></div>
        {(tot.deductions || []).map((x, i) => <div key={i}><span>{t('Acompte {n}', { n: x.number || '' })}</span><span>− {money(x.ttc)}</span></div>)}
        {!isQuote && Number(d.paid_amount) > 0 && <div><span>{t('Déjà réglé')}</span><span>− {money(d.paid_amount)}</span></div>}
        <div className="g"><span>{isQuote ? t('Total TTC') : d.kind === 'avoir' ? t('Montant de l’avoir') : t('Net à payer')}</span><span>{money(isQuote ? tot.ttc : d.kind === 'avoir' ? tot.net : rest)}</span></div>
      </div>
      <div style={{ marginTop: 14 }} className="small">
        {franchise && <div><b>{t('TVA non applicable, art. 293 B du CGI.')}</b></div>}
        {d.reverse_charge && <div><b>{t('Autoliquidation : TVA due par le preneur, art. 283-2 nonies du CGI.')}</b></div>}
        <div><b>{t('Conditions de règlement')} :</b> {cond.paymentTerms}{!isQuote && d.due_date ? ', ' + t('au plus tard le {d}', { d: date(d.due_date) }) : ''}. {cond.deposit && isQuote ? t('Acompte') + ' : ' + cond.deposit + '. ' : ''}{t('Escompte')} : {cond.discount}. {t('Pénalités de retard')} : {cond.penalties}. {client.type === 'pro' ? t('Indemnité forfaitaire pour frais de recouvrement : 40 €.') : ''}</div>
        {company.insurer && <div><b>{t('Assurance décennale')} :</b> {company.insurer}{company.insurance_contract ? ', ' + t('contrat {n}', { n: company.insurance_contract }) : ''}, {t('couverture')} {company.insurance_coverage}.</div>}
        {client.type !== 'pro' && cond.mediator && <div><b>{t('Médiateur de la consommation')} :</b> {cond.mediator}</div>}
        {cond.notes && <div className="wsb">{cond.notes}</div>}
      </div>
      {isQuote ? (
        <div className="sig">
          <div className="box"><div className="lab">{t("L'entreprise")}</div>{company.settings?.pdf?.signature && <img src={company.settings.pdf.signature} alt="" style={{ maxHeight: 60 }} />}</div>
          <div className="box"><div className="lab">{t('Bon pour accord')}</div><div className="small">{t('Date, signature et mention « Bon pour accord »')}</div>{d.status === 'accepte' && <div style={{ marginTop: 8 }}><b>{t('Signé par {n} le {d}', { n: d.signed_name || '', d: dateTime(d.accepted_at) })}</b></div>}</div>
        </div>
      ) : d.kind !== 'avoir' && (
        <div className="pay">
          <div className="box"><div className="lab">{t('Paiement par virement')}</div>IBAN {company.iban || '—'}<br />{company.bic && <>BIC {company.bic}<br /></>}{t('Référence à indiquer')} : {d.number}</div>
          {company.settings?.docs?.onlinePayment !== false && <div className="box"><div className="lab">{t('Paiement en ligne')}</div>{t('Carte ou prélèvement via le lien Artis & You')}</div>}
        </div>
      )}
      <div className="foot">{[company.name, company.legal_form && company.capital ? `${company.legal_form} au capital de ${company.capital}` : company.legal_form, company.siret && 'SIRET ' + company.siret, company.rm && 'RM ' + company.rm, !franchise && company.vat_number && 'TVA ' + company.vat_number].filter(Boolean).join(' · ')}{company.settings?.pdf?.footer ? ' · ' + company.settings.pdf.footer : ''} · {t('Page 1/1')}</div>
    </div>
  );
}

export function useLogo(company) {
  const [u, setU] = useState(null);
  useEffect(() => { if (company?.logo_path) fileUrls([company.logo_path]).then((r) => setU(r[company.logo_path])); }, [company?.logo_path]);
  return u;
}

// Export PDF : capture de la page A4 puis assemblage avec pdf-lib
export async function exportPdf(node, filename) {
  const [{ toCanvas }, { PDFDocument }] = await Promise.all([import('html-to-image'), import('pdf-lib')]);
  const canvas = await toCanvas(node, { pixelRatio: 2, backgroundColor: '#ffffff', skipFonts: false, cacheBust: true });
  const pdf = await PDFDocument.create();
  const pageW = 595.28, pageH = 841.89;
  const sliceH = Math.round(canvas.width * (pageH / pageW));
  for (let y = 0; y < canvas.height; y += sliceH) {
    const c = document.createElement('canvas'); c.width = canvas.width; c.height = Math.min(sliceH, canvas.height - y);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(canvas, 0, -y);
    const png = await pdf.embedPng(c.toDataURL('image/png'));
    const page = pdf.addPage([pageW, pageH]);
    const h = (c.height / c.width) * pageW;
    page.drawImage(png, { x: 0, y: pageH - h, width: pageW, height: h });
  }
  const bytes = await pdf.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return blob;
}

export function A4Preview({ bundle, innerRef }) {
  const logo = useLogo(bundle.company);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const f = () => setScale(Math.min(1, (Math.min(window.innerWidth, 1180) - (window.innerWidth >= 1024 ? 320 : 40)) / 794));
    f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f);
  }, []);
  return (
    <div className="a4-wrap" style={{ height: 1123 * scale + 40 }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: 794 }}>
        <div ref={innerRef}><A4 {...bundle} logoUrl={logo} /></div>
      </div>
    </div>
  );
}
export const pdfName = (d) => `${d.number || kindLabel(d.kind) + '-brouillon'}.pdf`;
export { StatusPill };
