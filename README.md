# SvaPro

SvaPro e un gestionale retail multi-tenant basato su Laravel 11 + React (Vite).
Include moduli per catalogo, ordini, magazzino, clienti, dipendenti, loyalty, fatture, report e smart reorder.

## Stack Tecnologico

- Backend: Laravel 11, Sanctum, SQLite/MySQL, queue + scheduler
- Frontend: React, React Router, Vite, Recharts
- PDF: barryvdh/laravel-dompdf
- Push/Loyalty: Firebase service integration

## Requisiti

- PHP 8.2+
- Composer 2+
- Node.js 20+
- npm 10+

## Setup Rapido (Locale)

1. Clona il repository.
2. Installa dipendenze backend:

```bash
composer install
```

3. Installa dipendenze frontend:

```bash
npm install
```

4. Crea env locale:

```bash
cp .env.example .env
```

5. Genera APP_KEY:

```bash
php artisan key:generate
```

6. Prepara database (default SQLite):

```bash
touch database/database.sqlite
php artisan migrate --seed
```

7. Avvia backend:

```bash
php artisan serve --host=127.0.0.1 --port=8000
```

8. Avvia frontend:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

## Variabili Ambiente Frontend

In `.env` / `.env.example`:

- `VITE_API_URL=/api`
- `VITE_ENABLE_DEMO_LOGIN=false`

Note:

- In locale, con Vite proxy attivo, `/api` e la configurazione consigliata.
- Per staging/prod puoi impostare un URL assoluto (es. `https://api.dominio.com/api`).
- `VITE_ENABLE_DEMO_LOGIN=true` abilita scorciatoie credenziali demo nel login. In produzione va tenuto su `false`.

## Scheduler e Job

Comandi schedulati in `routes/console.php`:

- `loyalty:dispatch-push --limit=200` ogni minuto
- `loyalty:process-firebase-deliveries --limit=50` ogni minuto
- `inventory:auto-reorder --all --central` ogni giorno alle 04:10

Per eseguire scheduler in locale:

```bash
php artisan schedule:work
```

## Comandi Utili

Esegui test feature principali:

```bash
php artisan test tests/Feature/ApiWorkflowTest.php
```

Build frontend produzione:

```bash
npm run build
```

Preflight runtime locale (Windows PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/preflight-runtime.ps1
```

## Moduli Principali

- Dashboard KPI e trend
- Catalogo prodotti/varianti con metadati fiscali
- Ordini con gestione alert stock insufficiente
- Smart reorder con generazione ordini acquisto
- Loyalty wallet, notifiche push, monitoraggio
- Fatture PDF ed export CSV
- Control Tower e multi-tenant switch (superadmin)

## API Nuove Rilevanti

- `GET /api/orders/stock-alerts`
- `POST /api/orders/stock-alerts/{alertId}/resolve`
- `POST /api/inventory/smart-reorder/run-auto`

## Troubleshooting

### Bianco su bianco nei modali

I modali chiari usano lo scope CSS `modal-light` per garantire contrasto testo/campi.

### 401 o sessione persa

Verifica:

- `authToken` presente in localStorage
- `X-Tenant-Code` coerente con utente
- backend attivo su porta corretta

### Errori DB

Se SQLite non esiste:

```bash
touch database/database.sqlite
php artisan migrate --seed
```

## Sicurezza

- Non usare credenziali demo in ambienti reali.
- Mantieni `VITE_ENABLE_DEMO_LOGIN=false` fuori da ambienti demo.
- Non committare chiavi private o credenziali Firebase.

## Produzione e Vendibilita (Checklist)

Questa checklist e il minimo per andare online in modo affidabile e vendibile verso clienti.

### 1) Hardening base (obbligatorio)

- `APP_DEBUG=false` e `LOG_LEVEL=warning` in produzione.
- Rate limit attivo su `/api/login` e su API autenticate.
- Health endpoint pubblico disattivato di default.
- CORS esplicito via `CORS_ALLOWED_ORIGINS`.

### 2) Deploy affidabile (obbligatorio)

- CI attiva con workflow GitHub Actions: [`.github/workflows/ci.yml`](.github/workflows/ci.yml).
- Pipeline con: install backend, migrate+seed, test backend, build frontend.
- Policy consigliata: no merge su `main` senza CI verde.

### 3) Piano esecutivo pronto

- Piano operativo 10 giorni disponibile in [`docs/GO_LIVE_10_GIORNI.md`](docs/GO_LIVE_10_GIORNI.md).
- Include: runtime/backend, sito SvaPro per acquisto/download, strategia offline e compliance.

### 3) Operativita minima produzione

- Queue worker attivo (consigliato Redis in prod).
- Scheduler attivo (`php artisan schedule:work` o cron).
- Rotazione log e monitor errori centralizzato.
- Backup DB giornaliero + test ripristino periodico.

### 4) Pronto per vendita SaaS

- Billing reale (Stripe/Cashier + webhook) prima della vendita pubblica.
- Onboarding tenant (provisioning, ruoli, store default, seed dati base).
- Contratti e compliance: privacy policy, termini, DPA, retention.

### 5) Qualita prodotto cliente

- Completare i18n su tutte le pagine e messaggi errore.
- Aumentare test coverage su auth, tenant isolation, inventory concurrency, billing.
- Definire SLO/SLA (uptime, tempi supporto, tempi ripristino).

## Operativita Interna (Uso Reale)

- Checklist giornaliera/settimanale/mensile: [docs/OPERATIONS_CHECKLIST_INTERNA.md](docs/OPERATIONS_CHECKLIST_INTERNA.md)
- Piano test offline e sincronizzazione vendite: [docs/TEST_PLAN_OFFLINE_SYNC.md](docs/TEST_PLAN_OFFLINE_SYNC.md)
- Stato accise/giacenze/legale: [docs/ACCISA_GIACENZE_LEGALE_STATUS.md](docs/ACCISA_GIACENZE_LEGALE_STATUS.md)

## Licenza

Progetto interno SvaPro. Uso e distribuzione secondo policy del team/proprieta del committente.
