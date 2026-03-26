# SvaPro - Piano Esecutivo 10 Giorni (Solo Punto 2 e 3)

## Obiettivo
Portare SvaPro a uno stato pronto per rilascio operativo senza integrare pagamenti nel gestionale.
I pagamenti avvengono sul sito SvaPro (e-commerce esterno).

## Scope incluso
- Punto 2: runtime/backend stabile, ripetibile, verificabile.
- Punto 3: piano operativo con deliverable e criteri di accettazione.
- Sito SvaPro: funnel acquisto + download + provisioning licenza.
- Analisi offline-first: funzionamento senza connessione con sync vendite al ritorno online.

## Scope escluso
- Gateway di pagamento nel gestionale.
- Fatturazione SaaS automatica dentro SvaPro app.

## Roadmap 10 giorni

### Giorno 1 - Baseline runtime
- Uniformare runtime team e server: PHP 8.3, Node 20.
- Eseguire scripts/preflight-runtime.ps1 su tutte le postazioni.
- Criterio: preflight verde su dev machine e su runner CI.

### Giorno 2 - Quality gate backend/frontend
- CI obbligatoria su branch principali.
- Build frontend e test backend green in pipeline.
- Criterio: nessun merge senza pipeline verde.

### Giorno 3 - Hardening operativo
- Validare APP_DEBUG false e log level produzione.
- Confermare rate limiting e CORS.
- Criterio: checklist security P0 completata e firmata.

### Giorno 4 - Sito SvaPro (fase 1)
- Definizione architettura sito: landing, pricing, checkout, area download.
- Definizione flusso post-acquisto: email con chiave/licenza e guida installazione.
- Criterio: specifica funzionale approvata.

### Giorno 5 - Sito SvaPro (fase 2)
- Implementazione pagine pubbliche e area documentazione.
- Endpoint provisioning licenza e registro dispositivi/istanze.
- Criterio: utente paga sul sito e riceve link download + licenza.

### Giorno 6 - Offline architecture design
- Disegno modello offline-first:
  - Cassa, ordini, giacenze locali sempre operative.
  - Event store locale append-only.
  - Coda sync vendite con retry idempotente.
- Criterio: RFC tecnica approvata.

### Giorno 7 - Offline MVP backend contract
- Endpoint sync batch vendite con idempotency key.
- Endpoint ack conflitti e riallineamento giacenze.
- Criterio: contratto API versionato e testato.

### Giorno 8 - Offline MVP frontend
- Storage locale (IndexedDB) e coda eventi vendite.
- Sync automatico al ritorno online.
- Criterio: vendita offline visibile in UI, poi sincronizzata online.

### Giorno 9 - Compliance accise/giacenze
- Audit legale su tracciati richiesti (ADM/Agenzia Dogane, registri fiscali).
- Gap analysis tra dati attuali e obblighi normativi.
- Criterio: documento conformita con elenco gap/bloccanti.

### Giorno 10 - Go/No-Go
- Test end-to-end operativi (online/offline/reconnect).
- Verifica legale finale e decisione go-live.
- Criterio: verbale go/no-go con owner e data rilascio.

## Deliverable finali
- Checklist runtime firmata.
- CI pipeline obbligatoria.
- Specifica sito SvaPro + provisioning licenze.
- RFC offline e MVP sync vendite.
- Documento compliance accise/giacenze/legale.
- Piano di rollout clienti.

Riferimenti:
- Blueprint sito SvaPro: `docs/SVAPRO_SITE_BLUEPRINT.md`
- Stato compliance: `docs/ACCISA_GIACENZE_LEGALE_STATUS.md`

## Rischi aperti principali
- Conflitti stock durante sync offline multi-postazione.
- Requisiti normativi accise non completamente coperti da report standard.
- Necessita di procedure di audit trail formalizzate.

## Decisione raccomandata
Senza il blocco offline + compliance validata, evitare vendita massiva.
Consentire al massimo una beta controllata con clienti pilota.
