<?php

namespace App\Services;

class FatturaPAService
{
    /**
     * Generate an XML FatturaPA document for a supplier invoice.
     * Compatible with Italian SDI / Cassetto Fiscale format (FPR12).
     *
     * @param array $invoice      Supplier invoice data from DB
     * @param array $lines        Invoice line items
     * @param array $supplier     Supplier (cedente/prestatore) data
     * @param array $company      Azienda (cessionario/committente) data
     * @return string             XML content as string
     */
    public static function generate(array $invoice, array $lines, array $supplier, array $company): string
    {
        $numero   = htmlspecialchars($invoice['invoice_number'] ?? 'FT-' . $invoice['id']);
        $data     = isset($invoice['issued_at'])
            ? date('Y-m-d', strtotime($invoice['issued_at']))
            : date('Y-m-d');
        $totale   = number_format((float) ($invoice['total_net'] ?? 0), 2, '.', '');
        $iva      = number_format((float) ($invoice['tax_amount'] ?? 0), 2, '.', '');
        $imponibile = number_format((float) ($invoice['total_net'] ?? 0) - (float) ($invoice['tax_amount'] ?? 0), 2, '.', '');
        $aliquota = $iva > 0 ? '22.00' : '0.00';

        // Cedente (Fornitore)
        $cedentePiva   = htmlspecialchars($supplier['vat_number'] ?? '00000000000');
        $cedenteNome   = htmlspecialchars($supplier['name'] ?? 'Fornitore');
        $cedenteNaz    = 'IT';
        $cedenteInd    = htmlspecialchars($supplier['address'] ?? '');
        $cedenteCap    = htmlspecialchars($supplier['postal_code'] ?? '00000');
        $cedenteComune = htmlspecialchars($supplier['city'] ?? '');
        $cedenteProv   = htmlspecialchars($supplier['province'] ?? 'RM');

        // Cessionario (Azienda ricevente)
        $cessNome   = htmlspecialchars($company['name'] ?? 'Azienda');
        $cessPiva   = htmlspecialchars($company['vat_number'] ?? '00000000000');
        $cessInd    = htmlspecialchars($company['address'] ?? '');
        $cessCap    = htmlspecialchars($company['postal_code'] ?? '00000');
        $cessComune = htmlspecialchars($company['city'] ?? '');
        $cessProv   = htmlspecialchars($company['province'] ?? 'RM');

        // Build line items XML
        $dettaglioLinee = '';
        foreach ($lines as $idx => $line) {
            $numLinea    = $idx + 1;
            $descr       = htmlspecialchars($line['description'] ?? ($line['product_name'] ?? 'Prodotto/Servizio'));
            $qty         = number_format((float) ($line['qty'] ?? 1), 2, '.', '');
            $unitPrice   = number_format((float) ($line['unit_cost'] ?? 0), 2, '.', '');
            $lineTot     = number_format((float) ($line['qty'] ?? 1) * (float) ($line['unit_cost'] ?? 0), 2, '.', '');
            $dettaglioLinee .= <<<XML
            <DettaglioLinee>
                <NumeroLinea>{$numLinea}</NumeroLinea>
                <Descrizione>{$descr}</Descrizione>
                <Quantita>{$qty}</Quantita>
                <PrezzoUnitario>{$unitPrice}</PrezzoUnitario>
                <PrezzoTotale>{$lineTot}</PrezzoTotale>
                <AliquotaIVA>{$aliquota}</AliquotaIVA>
            </DettaglioLinee>

XML;
        }

        // If no lines, add a placeholder line
        if (empty($lines)) {
            $dettaglioLinee = <<<XML
            <DettaglioLinee>
                <NumeroLinea>1</NumeroLinea>
                <Descrizione>Fattura fornitore {$numero}</Descrizione>
                <Quantita>1.00</Quantita>
                <PrezzoUnitario>{$imponibile}</PrezzoUnitario>
                <PrezzoTotale>{$imponibile}</PrezzoTotale>
                <AliquotaIVA>{$aliquota}</AliquotaIVA>
            </DettaglioLinee>

XML;
        }

        $xml = <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12"
    xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2 http://www.fatturapa.gov.it/export/fatturazione/sdi/fatturapa/v1.2/Schema_del_file_xml_FatturaPA_versione_1.2.xsd">

    <FatturaElettronicaHeader>
        <DatiTrasmissione>
            <IdTrasmittente>
                <IdPaese>{$cedenteNaz}</IdPaese>
                <IdCodice>{$cedentePiva}</IdCodice>
            </IdTrasmittente>
            <ProgressivoInvio>00001</ProgressivoInvio>
            <FormatoTrasmissione>FPR12</FormatoTrasmissione>
            <CodiceDestinatario>0000000</CodiceDestinatario>
        </DatiTrasmissione>

        <CedentePrestatore>
            <DatiAnagrafici>
                <IdFiscaleIVA>
                    <IdPaese>{$cedenteNaz}</IdPaese>
                    <IdCodice>{$cedentePiva}</IdCodice>
                </IdFiscaleIVA>
                <Anagrafica>
                    <Denominazione>{$cedenteNome}</Denominazione>
                </Anagrafica>
                <RegimeFiscale>RF01</RegimeFiscale>
            </DatiAnagrafici>
            <Sede>
                <Indirizzo>{$cedenteInd}</Indirizzo>
                <CAP>{$cedenteCap}</CAP>
                <Comune>{$cedenteComune}</Comune>
                <Provincia>{$cedenteProv}</Provincia>
                <Nazione>{$cedenteNaz}</Nazione>
            </Sede>
        </CedentePrestatore>

        <CessionarioCommittente>
            <DatiAnagrafici>
                <IdFiscaleIVA>
                    <IdPaese>IT</IdPaese>
                    <IdCodice>{$cessPiva}</IdCodice>
                </IdFiscaleIVA>
                <Anagrafica>
                    <Denominazione>{$cessNome}</Denominazione>
                </Anagrafica>
            </DatiAnagrafici>
            <Sede>
                <Indirizzo>{$cessInd}</Indirizzo>
                <CAP>{$cessCap}</CAP>
                <Comune>{$cessComune}</Comune>
                <Provincia>{$cessProv}</Provincia>
                <Nazione>IT</Nazione>
            </Sede>
        </CessionarioCommittente>
    </FatturaElettronicaHeader>

    <FatturaElettronicaBody>
        <DatiGenerali>
            <DatiGeneraliDocumento>
                <TipoDocumento>TD01</TipoDocumento>
                <Divisa>EUR</Divisa>
                <Data>{$data}</Data>
                <Numero>{$numero}</Numero>
                <ImportoTotaleDocumento>{$totale}</ImportoTotaleDocumento>
            </DatiGeneraliDocumento>
        </DatiGenerali>

        <DatiBeniServizi>
{$dettaglioLinee}
            <DatiRiepilogo>
                <AliquotaIVA>{$aliquota}</AliquotaIVA>
                <ImponibileImporto>{$imponibile}</ImponibileImporto>
                <Imposta>{$iva}</Imposta>
                <EsigibilitaIVA>I</EsigibilitaIVA>
            </DatiRiepilogo>
        </DatiBeniServizi>

        <DatiPagamento>
            <CondizioniPagamento>TP02</CondizioniPagamento>
            <DettaglioPagamento>
                <ModalitaPagamento>MP05</ModalitaPagamento>
                <ImportoPagamento>{$totale}</ImportoPagamento>
            </DettaglioPagamento>
        </DatiPagamento>
    </FatturaElettronicaBody>

</p:FatturaElettronica>
XML;

        return $xml;
    }
}
