# Sito SvaPro - Blueprint Operativo

## Obiettivo
Vendere il gestionale sul sito SvaPro e consentire download, attivazione licenza e onboarding cliente.

## Funnel consigliato
1. Landing prodotto (value proposition, demo, feature, FAQ)
2. Pricing (piani, limiti licenza, SLA)
3. Checkout sul sito SvaPro
4. Pagina conferma ordine
5. Email automatica con:
   - link download
   - license key
   - guida installazione
   - link supporto

## Architettura minima
- Frontend sito: Next.js o Laravel + Blade (in base stack team)
- Backend provisioning: API per generazione licenze
- Storage download: bucket versionato con checksum
- CRM/helpdesk integration: onboarding e ticket

## Modello licenza suggerito
- License key per tenant
- Numero postazioni massimo per piano
- Binding iniziale a tenant_code + dominio/istanza
- Possibilita rigenerazione chiave da pannello admin interno

## API minime del portale
- POST /portal/orders/complete
- POST /portal/licenses/provision
- GET /portal/downloads/latest
- POST /portal/licenses/activate
- POST /portal/licenses/deactivate

## Processo post-vendita
1. Cliente acquista sul sito
2. Portale crea tenant in stato pending
3. Portale genera licenza e invia email
4. Cliente installa gestionale e attiva licenza
5. Sistema abilita tenant e crea utente admin

## Sicurezza
- License validation firmata (HMAC)
- Token download con scadenza breve
- Audit log su attivazioni/disattivazioni
- Limiti anti-abuso su endpoint licenza

## KPI da tracciare
- Conversione landing -> checkout
- Tasso attivazione post acquisto
- Tempo medio prima vendita in app
- Churn 30/60/90 giorni

## Deliverable MVP sito
- Landing + pricing + checkout + thank-you
- API provisioning licenza
- Email transazionale attivazione
- Pagina download con changelog e hash file
