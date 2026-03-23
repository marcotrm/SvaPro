# ANALISI REQUIREMENTS - RIUNIONE CAPO 23/03/2026

---

## 📊 STATO ATTUALE vs DESIDERATO

### ✅ Funzionalità OK (Capo ha detto "PERFETTO")
- Dashboard iniziale
- Gestione catalogo base
- Gestione clienti base
- Gestione dipendenti
- Gestione ordini
- Accumulo punti automatico
- Incentivazione dipendenti
- Gestione multi-store base

### ⚠️ Funzionalità che hanno commenti/modifiche NECESSARIE
1. **Stock** - Attualmente BLOCCA ordine se insufficiente → **DEVE fare ALERT e permettere vendita** (TenPro model)
2. **Magazzino** - "DA VEDERE IL FUNZIONAMENTO" (incompleto lato UI)
3. **Varianti** - Ogni store decide catalogo per zona → **Aggiungere selezione store**
4. **Clienti** - Aggiungere intelligence su ritorno e fidelity tracking
5. **Dipendenti** - Aggiungere CRM con ranking performance
6. **Loyalty** - App mobile deve ricevere notifiche push
7. **Smart Reorder** - **GENERAZIONE AUTOMATICA ORDINI A SVAPOGROUP CENTRALE**

### ❌ Out of Scope
- Trasferimenti tra negozi (monopolio)

---

## 🚨 PRIORITY 1 - BLOCKING (Facciamo subito)

### 1.1 | STOCK ALERT vs BLOCCO ⭐ **CRITICAL**
**Cosa cambia:** Ordini con stock insufficiente NON vengono bloccati, ma...
- Creano l'ordine lo stesso
- Inviano ALERT a chi di dovere
- Permette al retail di continuare a vendere
- Sistema è responsabile di controllare, non ordine fallisce

**File da modificare:**
- `app/Http/Controllers/Api/OrderController.php` → logica `place()`
- Aggiungere table `order_alerts` o campo `has_stock_issue` su `sales_orders`

**Effort:** 2-3 ore

**Why:** TenPro lo fa così, altrimenti "perdiamo la vendita" (citazione capo)

---

### 1.2 | SMART REORDER AUTO → SVAPOGROUP ⭐ **DIFFERENZIALE**
**Cosa serve:** Lo smart reorder deve generare ordini AUTOMATICI verso SvapoGroup (magazzino centrale)

**Implementazione richiesta:**
- Per ogni prodotto: `giorni_per_riordino` + `qty_minima_magazzino` 
- Smart reorder guarda che se vendite ultimi 30gg > threshold → genera PO auto verso SvapoGroup
- Deve essere AUTOMATICO (non solo preview)

**File da modificare:**
- `app/Services/SmartReorderService.php` → aggiungere flag `auto_generate = true`
- `app/Http/Controllers/Api/SmartInventoryController.php` → aggiungere endpoint `/auto-run`
- Database migration: aggiungere `giorni_riordino` e `qty_minima` a `products`

**Effort:** 4-5 ore (logica già c'è, aggiungiamo automatismo)

**Why:** "DA MAGAZZINO CENTRALE, SVAPOGROUP DEVE DIVENTARE AUTOMATICA" - questo è il vostro differenziale

---

### 1.3 | PERMISSION LAYER - RETAIL NON MODIFICA GIACENZE/PREZZI ⚠️
**Cosa serve:** Role-based middleware che blocca:
- Retail store: NON può fare `POST /inventory/adjust` manualmente
- Retail store: NON può fare `PUT /products/{id}/price` 
- Solo admin/magazzino centrale può

**File da modificare:**
- `routes/api.php` → aggiungere middleware su endpoint sensibili
- `app/Http/Middleware/CheckRole.php` → estendere con check "can_modify_inventory"

**Effort:** 1-2 ore

**Why:** "avevano provato a fregarcela" - sicurezza aziendale

---

### 1.4 | CLIENTI - TRACKING RITORNO + FIDELITY ⭐
**Cosa serve:**
- Nuovo campo `last_purchase_date` su customers
- Nuovo campo `loyalty_card_issued_date` 
- Dashboard: filtro per città, ricerca, ranking "clienti che ritornano ogni X giorni"
- Capire frequenza media di ritorno

**File da modificare:**
- Migration: aggiungere fields
- `app/Models/Customer.php` → scope `whereCity()`, metodo `getDaysSinceLastPurchase()`
- `app/Http/Controllers/Api/CustomerController.php` → endpoint GET `/analytics/return-frequency`

**Effort:** 3-4 ore

**Why:** "RITORNO DEL CLIENTE... CAPIRE SE IL CLIENTE RITORNA E SE TORNA OGNI QUANTO TEMPO"

---

### 1.5 | DIPENDENTI - CRM + RANKING PERFORMANCE
**Cosa serve:**
- Dashboard che mostra: vendite per dipendente, punti accumulati, ranking
- Filtrare top performers
- Link ai giorni lavorati, assenze, ecc

**File da modificare:**
- New view/endpoint: `GET /employees/analytics/top-performers`
- `app/Http/Controllers/Api/EmployeeController.php` → aggiungere logica

**Effort:** 3-4 ore

**Why:** "I DATI DIPENDENTI E IMPORTANTISSIMO... CAPIRE I PIU PERFORMANTI"

---

## 🟡 PRIORITY 2 - HIGH (Settimana prossima)

### 2.1 | ACCISE E PREVALENZA - Formazione + Implementazione
- [ ] Capo fa formazione e spiega dominio
- [ ] Aggiungere fields `accise_amount`, `prevalenza_code` a `product_variants`
- [ ] Logica di calcolo nelle quote ordini

**Effort:** Dipende da formazione, estimato 5-6 ore dopo che capisci il concetto

---

### 2.2 | VARIANTI - CATALOGO PER STORE
**Cosa serve:** Ogni store sceglie quali varianti vedere/vendere
- Nuovo campo `store_id` su `product_variant_store` (pivot table)
- Endpoint: `GET /catalog/products?store_id=X` - ritorna solo varianti abilitate per quel store

**Effort:** 3-4 ore

**Why:** "OGNI STORE DEVO DECIDERE CHE TIPO DI CATALOGO UTILIZZARE, IN BASE ALLE ZONE"

---

### 2.3 | LOYALTY - NOTIFICHE PUSH PER APP
**Cosa serve:**
- Integrare Firebase Cloud Messaging (FCM) o simile
- Quando un punto viene accreditato → invia PUSH notification
- App client deve registrare device token

**Effort:** 5-6 ore + testing mobile

**Why:** "OGNI CLIENTE DEVE ESSERE IN GRADO DALL APP DI VEDERE QUESTI DATI E RICEVERE NOTIFICHE PUSH"

---

### 2.4 | MAGAZZINO - TEST + COMPLETAMENTO UI
**Cosa serve:** 
- Testare flusso completo di giacenza
- Completare interfaccia (attualmente backend OK, frontend "DA VEDERE")
- Mostrare movimenti, cause, tracking

**Effort:** 3-4 ore

**Why:** "QUESTA DA VEDERE IL FUNZIONAMENTO" (capo non ha capito bene cosa fa)

---

## 🔵 PRIORITY 3 - MEDIUM (Roadmap post Q1)

- [ ] Resi/cambi/rimborsi (completo, TenPro fa male)
- [ ] Inventario guidato con conteggio barcode
- [ ] POS evoluto
- [ ] Reportistica commerciale
- [ ] CRM/marketing
- [ ] Loyalty avanzata (tiers, missioni, cashback)
- [ ] Promozioni e bundle
- [ ] E-commerce sync
- [ ] Spedizioni completate lato frontend
- [ ] Gestione fornitori completa
- [ ] Permessi granulari avanzati
- [ ] Audit log
- [ ] KPI dipendenti
- [ ] Click & collect
- [ ] Documenti fiscali

---

## 📋 ORDINE DI ESECUZIONE CONSIGLIATO

### SETTIMANA 1
1. **Stock Alert vs Blocco** (2-3h) → QA
2. **Permission Layer** (1-2h) → QA
3. **Smart Reorder Auto** (4-5h) → QA

### SETTIMANA 2
1. Formazione ACCISE + PREVALENZA (capo spiega)
2. **Accise/Prevalenza** (5-6h) → QA
3. **Varianti per Store** (3-4h) → QA

### SETTIMANA 3
1. **Clienti - Return Analytics** (3-4h) → QA
2. **Dipendenti - Performance CRM** (3-4h) → QA
3. **Magazzino - UI completamento** (3-4h) → QA

### SETTIMANA 4
1. **Loyalty - Push Notifications** (5-6h) → QA

---

## 📊 IMPATTO STIMA

| Priorità | Feature | Effort | Impact | Blocka? |
|----------|---------|--------|--------|---------|
| P1 | Stock Alert | 2-3h | ALTO | SÌ |
| P1 | Smart Reorder Auto | 4-5h | **ALTO** | NO |
| P1 | Permission Layer | 1-2h | ALTO | SÌ |
| P1 | Clienti Ritorno | 3-4h | MEDIO | NO |
| P1 | Dipendenti CRM | 3-4h | MEDIO | NO |
| P2 | Accise/Prevalenza | 5-6h | ALTO | NO |
| P2 | Varianti Store | 3-4h | MEDIO | NO |
| P2 | Loyalty Push | 5-6h | MEDIO | NO |
| P3 | Magazzino UI | 3-4h | BASSO | NO |

---

## 🎯 PROSSIMO PASSO

**Vuoi che comincio da Priority 1? Consiglio l'ordine:**

1️⃣ **Permission Layer** (più veloce, derisca di base)  
2️⃣ **Stock Alert** (la devi cambiare sennò perdi vendite)  
3️⃣ **Smart Reorder Auto** (il vostro differenziale)

Oppure vuoi aspettare feedback del capo prima di partire?

