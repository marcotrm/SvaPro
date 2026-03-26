<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Servizio placeholder per l'invio fatture al Sistema di Interscambio (SDI).
 *
 * NOTA: L'integrazione reale con il provider SDI (es. Aruba, Fatture in Cloud, ecc.)
 * va implementata nel metodo sendToSdi() sostituendo il placeholder.
 */
class SdiService
{
    /**
     * Prepara e invia la fattura allo SDI.
     *
     * @return array{success: bool, message: string, sdi_identifier: ?string}
     */
    public function sendToSdi(int $invoiceId, int $tenantId): array
    {
        $invoice = DB::table('invoices')
            ->where('id', $invoiceId)
            ->where('tenant_id', $tenantId)
            ->first();

        if (! $invoice) {
            return ['success' => false, 'message' => 'Fattura non trovata.', 'sdi_identifier' => null];
        }

        if ($invoice->sdi_status === 'accepted') {
            return ['success' => false, 'message' => 'Fattura gia accettata dallo SDI.', 'sdi_identifier' => $invoice->sdi_identifier];
        }

        // Genera XML FatturaPA (placeholder — da implementare con dati reali)
        $xmlContent = $this->generateFatturaPaXml($invoice, $tenantId);

        // TODO: Invio reale al provider SDI
        // Esempio: $response = Http::post('https://provider-sdi.example/api/send', ['xml' => $xmlContent]);

        Log::info('SDI send placeholder', [
            'invoice_id' => $invoiceId,
            'invoice_number' => $invoice->invoice_number,
            'xml_length' => strlen($xmlContent),
        ]);

        // Placeholder: simula invio riuscito
        $sdiIdentifier = 'SDI-' . now()->format('Ymd') . '-' . str_pad((string) $invoiceId, 8, '0', STR_PAD_LEFT);

        DB::table('invoices')
            ->where('id', $invoiceId)
            ->update([
                'sdi_status' => 'sent',
                'sdi_identifier' => $sdiIdentifier,
                'sdi_sent_at' => now(),
                'sdi_error_message' => null,
                'updated_at' => now(),
            ]);

        return [
            'success' => true,
            'message' => 'Fattura inviata allo SDI (placeholder).',
            'sdi_identifier' => $sdiIdentifier,
        ];
    }

    /**
     * Genera XML FatturaPA semplificato (placeholder).
     */
    private function generateFatturaPaXml(object $invoice, int $tenantId): string
    {
        $tenant = DB::table('tenants')->where('id', $tenantId)->first();
        $customer = $invoice->customer_id
            ? DB::table('customers')->where('id', $invoice->customer_id)->first()
            : null;

        // Placeholder XML — da sostituire con generazione FatturaPA conforme
        return <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" versione="FPR12">
  <FatturaElettronicaHeader>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>{$tenant->vat_number}</IdCodice>
        </IdFiscaleIVA>
        <Anagrafica><Denominazione>{$tenant->name}</Denominazione></Anagrafica>
      </DatiAnagrafici>
    </CedentePrestatore>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Numero>{$invoice->invoice_number}</Numero>
        <Data>{$invoice->issued_at}</Data>
        <ImportoTotaleDocumento>{$invoice->grand_total}</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
    </DatiGenerali>
  </FatturaElettronicaBody>
</p:FatturaElettronica>
XML;
    }
}
