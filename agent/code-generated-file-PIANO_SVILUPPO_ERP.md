import os

markdown_content = """# Piano di Sviluppo: ERP Cloud Multi-tenant per Settore Svapo
## Visione del Progetto
Un sistema gestionale integrato per catene di negozi di sigarette elettroniche con Deposito Fiscale centrale. Il sistema controlla scorte, vendite, personale, marketing (CRM) e conformità ADM (Agenzia Dogane e Monopoli).

---

## 🛠 Tech Stack Consigliato
* **Frontend:** React.js / Next.js (Tailwind CSS per la UI).
* **Backend:** Node.js (NestJS o Fastify) per gestire l'alta concorrenza.
* **Database:** PostgreSQL (con Row-Level Security per il multi-tenancy).
* **AI Engine:** Python (FastAPI) per i calcoli predittivi di riordino.
* **Infrastruttura:** Docker & AWS/DigitalOcean.

---

## ⚠️ AVVERTENZE CRITICHE: Sviluppo con AI
1.  **Evita il "Ghost Backend":** Mai creare bottoni o UI in frontend senza prima generare controller, rotte API e servizi nel backend.
2.  **Attenzione al Database Drift:** Usa rigorosamente lo schema `SCHEMA.sql`. Non inventare o rinominare tabelle/colonne in autonomia.
3.  **Logica di Business sul Server:** Tutti i calcoli di accise, prezzi, sconti e giacenze devono avvenire nel backend.
4.  **Timestamp Obbligatori:** Per la giacenza dinamica, ogni movimento deve avere un timestamp esatto registrato lato server.

---

## 🗺️ Roadmap di Sviluppo (Fasi)

### Fase 1: Fondamenta & Multi-tenancy
* [ ] Configurazione Database PostgreSQL (isolamento Tenant/Aziende).
* [ ] Autenticazione e RBAC (Ruoli: Admin, Magazziniere, Commesso, Store Manager).
* [ ] Struttura base dashboard e layout di navigazione.

### Fase 2: Ciclo Passivo & Magazzino Centrale (UPDATED)
* [ ] Anagrafiche: Prodotti, Negozi e **Fornitori**.
* [ ] Calcolatore Accise PLI (per ml, con/senza nicotina) e tracking Contrassegni di Stato.
* [ ] Gestione Ordini di Acquisto (verso fornitori esterni) e Carico Merci.
* [ ] Gestione Lotti, Scadenze (TPD) e Registro Carico/Scarico Fiscale ADM.

### Fase 3: Retail, POS & Flussi di Cassa (UPDATED)
* [ ] Interfaccia di vendita veloce (Touch).
* [ ] **Gestione Cassa (Prima Nota):** Registrazione prelievi, versamenti e chiusure giornaliere (Z-Report) suddivise per contante/carte.
* [ ] Integrazione Registratore Telematico per emissione e storno scontrini.

### Fase 4: Audit Magazzino & Inventario 
* [ ] Sistema di "Snapshot" per l'avvio della Giacenza Dinamica.
* [ ] POS: Interfaccia "Inventario Cieco" per i commessi (sparo prodotti senza quantità teorica).
* [ ] Dashboard Riconciliazione (Centrale): Confronto Atteso vs Rilevato (Semafori).
* [ ] Allineamento forzato con audit log per la tracciabilità.

### Fase 5: Logica AI, Trasferimenti & Resi (UPDATED)
* [ ] Algoritmo AI per fabbisogno negozi e riordino fornitori.
* [ ] Flusso Bolle di Trasferimento (Push Centrale -> Negozio).
* [ ] Ticketing Helpdesk interno (per discrepanze e comunicazioni).
* [ ] **Flusso RMA (Resi e Garanzie):** Gestione iter del prodotto difettoso (Cliente -> Negozio -> Deposito -> Fornitore).

### Fase 6: HR, CRM & Fidelity
* [ ] HR: Timbratura dipendenti (Geo-fencing) e Gestione Turni.
* [ ] CRM: Profilazione cliente, storico acquisti hardware.
* [ ] Loyalty: Punti, cashback, livelli fidelity.
* [ ] Promo Engine: Sconti globali (Sede) vs Sconti locali (Negozio con massimali/plafond).

### Fase 7: Amministrazione & Fisco
* [ ] Hub Fatturazione Elettronica: Emissione B2B/B2C, ricezione ciclo passivo, invio SDI.
* [ ] Dashboard KPI: Incassi, marginalità, scorte, out-of-stock.
* [ ] Export dati formattati per tracciati record ADM (Dogane).

---

## 🔒 Sicurezza e Coerenza Dati
1.  **Transazioni ACID:** Scarico e Carico devono fallire o avere successo insieme.
2.  **Audit Log Totale:** Registrare *Chi, Cosa, Quando e Perché (ID Ticket o Giustificativo).*
3.  **Soft Delete:** Mai usare `DELETE` reale. Usa `is_deleted = true`.

---
*Documento generato per lo sviluppo assistito da AI - Versione 1.2*
"""

file_path = "PIANO_SVILUPPO_ERP.md"

with open(file_path, "w", encoding="utf-8") as f:
    f.write(markdown_content)