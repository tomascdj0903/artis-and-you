// Factur-X (norme EN 16931, syntaxe UN/CEFACT CII, profil BASIC) : le XML embarqué dans le PDF des factures,
// qui rend la facture lisible par les logiciels comptables et les plateformes de dématérialisation (PDP).
// Référence : spécification Factur-X 1.0.07 (FNFE-MPE). Les montants sont ceux de `document.totals` (computeTotals).
import { computeTotals } from './docs.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n2 = (x) => (Math.round(Number(x || 0) * 100) / 100).toFixed(2);
const ymd = (d) => (d ? String(d).slice(0, 10).replace(/-/g, '') : '');
// Codes UN/ECE Recommandation 20 pour les unités de l'app
const UNIT = { u: 'C62', h: 'HUR', j: 'DAY', m: 'MTR', 'm²': 'MTK', m2: 'MTK', 'm³': 'MTQ', m3: 'MTQ', ml: 'MTR', kg: 'KGM', l: 'LTR', forfait: 'LS', lot: 'LS', t: 'TNE' };
// Type de document (UNTDID 1001) : 380 facture, 381 avoir, 386 facture d'acompte
const TYPE = { facture: '380', avoir: '381', acompte: '386' };

// Catégorie de TVA (UNTDID 5305) : S taux normal, E exonéré (franchise 293 B), AE autoliquidation
function vatCategory(d, company) {
  if (d.reverse_charge) return { code: 'AE', reason: 'Autoliquidation de la TVA, art. 283-2 nonies du CGI' };
  if (company.vat_regime === 'franchise') return { code: 'E', reason: 'TVA non applicable, art. 293 B du CGI' };
  return { code: 'S' };
}

const party = (tag, p) => `
      <ram:${tag}>
        <ram:Name>${esc(p.name)}</ram:Name>${p.siret ? `
        <ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${esc(p.siret.replace(/\s/g, ''))}</ram:ID></ram:SpecifiedLegalOrganization>` : ''}
        <ram:PostalTradeAddress>${p.zip ? `
          <ram:PostcodeCode>${esc(p.zip)}</ram:PostcodeCode>` : ''}${p.address ? `
          <ram:LineOne>${esc(p.address)}</ram:LineOne>` : ''}${p.city ? `
          <ram:CityName>${esc(p.city)}</ram:CityName>` : ''}
          <ram:CountryID>${esc(p.country || 'FR')}</ram:CountryID>
        </ram:PostalTradeAddress>${p.email ? `
        <ram:URIUniversalCommunication><ram:URIID schemeID="EM">${esc(p.email)}</ram:URIID></ram:URIUniversalCommunication>` : ''}${p.vat ? `
        <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(p.vat.replace(/\s/g, ''))}</ram:ID></ram:SpecifiedTaxRegistration>` : ''}
      </ram:${tag}>`;

export function isInvoice(d) { return ['facture', 'acompte', 'avoir'].includes(d?.kind) && !!d?.number; }

// Construit le XML Factur-X d'une facture finalisée. `company` et `client` : ceux figés dans le snapshot du document.
export function facturxXml({ d, company, client, source }) {
  const franchise = company.vat_regime === 'franchise';
  const totals = d.totals?.ttc != null ? d.totals : computeTotals(d.lines || [], { franchise, reverse: d.reverse_charge, deductions: d.totals?.deductions || [] });
  const cat = vatCategory(d, company);
  const items = (d.lines || []).filter((l) => l.kind === 'item' && (l.label || Number(l.qty)));
  const isPro = client.type === 'pro';
  const clientName = isPro ? (client.company_name || client.trade_name || [client.first_name, client.last_name].filter(Boolean).join(' ')) : [client.civility, client.first_name, client.last_name].filter(Boolean).join(' ');
  const seller = { name: company.name, siret: company.siret, vat: franchise ? '' : company.vat_number, address: company.address, zip: company.zip, city: company.city, email: company.email };
  const buyer = { name: clientName, siret: isPro ? client.siret : '', vat: isPro ? client.vat_number : '', address: client.billing_address, zip: client.billing_zip, city: client.billing_city, email: client.email };
  const lines = items.map((l, i) => {
    const rate = franchise || d.reverse_charge ? 0 : Number(l.vat ?? 20);
    const net = Number(l.qty || 0) * Number(l.price || 0);
    return `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument><ram:LineID>${i + 1}</ram:LineID></ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct><ram:Name>${esc(l.label || 'Prestation')}</ram:Name></ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${n2(l.price)}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${UNIT[l.unit] || 'C62'}">${n2(l.qty)}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${cat.code}</ram:CategoryCode><ram:RateApplicablePercent>${n2(rate)}</ram:RateApplicablePercent></ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${n2(net)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
  }).join('');
  const taxes = (totals.vat?.length ? totals.vat : [{ rate: 0, base: totals.ht, amount: 0 }]).map((v) => `
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${n2(v.amount)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>${cat.reason ? `
        <ram:ExemptionReason>${esc(cat.reason)}</ram:ExemptionReason>` : ''}
        <ram:BasisAmount>${n2(v.base)}</ram:BasisAmount>
        <ram:CategoryCode>${cat.code}</ram:CategoryCode>${d.vat_on_debits ? '' : `
        <ram:DueDateTypeCode>5</ram:DueDateTypeCode>`}
        <ram:RateApplicablePercent>${n2(v.rate)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>`).join('');
  const prepaid = Number(totals.deducted || 0);
  const due = Math.max(0, Number(totals.net ?? totals.ttc));
  const iban = (company.iban || '').replace(/\s/g, '');
  const notes = [d.object ? `Objet : ${d.object}` : '', cat.reason || ''].filter(Boolean);
  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${esc(d.number)}</ram:ID>
    <ram:TypeCode>${TYPE[d.kind] || '380'}</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">${ymd(d.issue_date)}</udt:DateTimeString></ram:IssueDateTime>${notes.map((x) => `
    <ram:IncludedNote><ram:Content>${esc(x)}</ram:Content></ram:IncludedNote>`).join('')}
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>${lines}
    <ram:ApplicableHeaderTradeAgreement>${party('SellerTradeParty', seller)}${party('BuyerTradeParty', buyer)}${source?.number ? `
      <ram:ContractReferencedDocument><ram:IssuerAssignedID>${esc(source.number)}</ram:IssuerAssignedID></ram:ContractReferencedDocument>` : ''}
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>${d.service_date ? `
      <ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime><udt:DateTimeString format="102">${ymd(d.service_date)}</udt:DateTimeString></ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent>` : ''}
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>${iban ? '30' : '1'}</ram:TypeCode>${iban ? `
        <ram:PayeePartyCreditorFinancialAccount><ram:IBANID>${esc(iban)}</ram:IBANID></ram:PayeePartyCreditorFinancialAccount>` : ''}
      </ram:SpecifiedTradeSettlementPaymentMeans>${taxes}
      <ram:SpecifiedTradePaymentTerms>${d.due_date ? `
        <ram:DueDateDateTime><udt:DateTimeString format="102">${ymd(d.due_date)}</udt:DateTimeString></ram:DueDateDateTime>` : ''}
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${n2(totals.ht)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${n2(totals.ht)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${n2(totals.tva)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${n2(totals.ttc)}</ram:GrandTotalAmount>${prepaid ? `
        <ram:TotalPrepaidAmount>${n2(prepaid)}</ram:TotalPrepaidAmount>` : ''}
        <ram:DuePayableAmount>${n2(due)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
`;
}

// Métadonnées XMP : identification PDF/A-3 et extension Factur-X (obligatoire pour que les lecteurs reconnaissent le fichier)
export function facturxXmp({ title, producer, created }) {
  const iso = created.toISOString();
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"><pdfaid:part>3</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance></rdf:Description>
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title><rdf:Alt><rdf:li xml:lang="x-default">${esc(title)}</rdf:li></rdf:Alt></dc:title><dc:creator><rdf:Seq><rdf:li>Artesa</rdf:li></rdf:Seq></dc:creator></rdf:Description>
    <rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/"><pdf:Producer>${esc(producer)}</pdf:Producer></rdf:Description>
    <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/"><xmp:CreatorTool>Artesa</xmp:CreatorTool><xmp:CreateDate>${iso}</xmp:CreateDate><xmp:ModifyDate>${iso}</xmp:ModifyDate></rdf:Description>
    <rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
      <pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType="Resource">
        <pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
        <pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>
        <pdfaSchema:prefix>fx</pdfaSchema:prefix>
        <pdfaSchema:property><rdf:Seq>
          <rdf:li rdf:parseType="Resource"><pdfaProperty:name>DocumentFileName</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>name of the embedded XML invoice file</pdfaProperty:description></rdf:li>
          <rdf:li rdf:parseType="Resource"><pdfaProperty:name>DocumentType</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>INVOICE</pdfaProperty:description></rdf:li>
          <rdf:li rdf:parseType="Resource"><pdfaProperty:name>Version</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>The actual version of the Factur-X XML schema</pdfaProperty:description></rdf:li>
          <rdf:li rdf:parseType="Resource"><pdfaProperty:name>ConformanceLevel</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>The conformance level of the embedded Factur-X data</pdfaProperty:description></rdf:li>
        </rdf:Seq></pdfaSchema:property>
      </rdf:li></rdf:Bag></pdfaExtension:schemas>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#"><fx:DocumentType>INVOICE</fx:DocumentType><fx:DocumentFileName>factur-x.xml</fx:DocumentFileName><fx:Version>1.0</fx:Version><fx:ConformanceLevel>BASIC</fx:ConformanceLevel></rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

// Ajoute à un PDFDocument (pdf-lib) le XML en pièce jointe et les métadonnées XMP
export async function attachFacturx(pdf, pdfLib, { xml, title }) {
  const { PDFName, PDFString, AFRelationship } = pdfLib;
  const bytes = new TextEncoder().encode(xml);
  await pdf.attach(bytes, 'factur-x.xml', { mimeType: 'text/xml', description: 'Factur-X invoice (EN 16931, BASIC)', creationDate: new Date(), modificationDate: new Date(), afRelationship: AFRelationship.Data });
  const xmp = facturxXmp({ title, producer: 'Artesa (pdf-lib)', created: new Date() });
  const stream = pdf.context.stream(new TextEncoder().encode(xmp), { Type: 'Metadata', Subtype: 'XML' });
  pdf.catalog.set(PDFName.of('Metadata'), pdf.context.register(stream));
  pdf.setTitle(title); pdf.setProducer('Artesa'); pdf.setCreator('Artesa');
  // Marquage « Trapped » et langue, attendus par PDF/A
  pdf.catalog.set(PDFName.of('Lang'), PDFString.of('fr-FR'));
}
