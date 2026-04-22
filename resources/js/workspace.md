@workspace
# CONTESTO
Il progetto gestionale è quasi completo. Ho bisogno che tu scriva unicamente il motore di logica (Servizio/Controller) per il riordino automatico del magazzino centrale e dei negozi, tenendo conto dei tempi di consegna (Lead Time). 

# OBIETTIVO
Analizza i miei modelli/entità esistenti relativi a Prodotti, Inventario (Giacenze) e Ordini.
Crea un nuovo file di servizio (es. `ReplenishmentService` o `InventoryEngine`) che contenga due funzioni principali che verranno richiamate tramite un Cron Job giornaliero o un trigger specifico.

# REGOLE DELLA LOGICA DA IMPLEMENTARE

**1. Funzione DRP (Riordino verso i Negozi):**
- Itera su tutte le giacenze dei negozi.
- Calcola lo stock disponibile: `Giacenza Attuale - Impegnato`.
- Se lo stock è `<= Punto di Riordino`:
  - Controlla se esistono già ordini di trasferimento "In transito" per quell'articolo verso quel negozio.
  - Se la merce in arrivo NON è sufficiente a coprire il fabbisogno, genera un nuovo `Transfer Order` (Richiesta di Trasferimento dal Magazzino Centrale).
  - La quantità da ordinare è la `Quantità di Riordino` standard impostata.
  - Imposta la data di consegna prevista sommando alla data odierna il `Tempo di Approntamento` + `Tempo di Transito`.
  - Aggiorna lo stato della giacenza impegnata nel Magazzino Centrale.

**2. Funzione MRP (Riordino verso il Fornitore):**
- Itera su tutte le giacenze del Magazzino Centrale.
- Calcola lo stock disponibile al netto degli impegni (inclusi quelli appena generati per i negozi).
- Se lo stock del Magazzino Centrale `<= Punto di Riordino`:
  - Controlla gli Ordini di Acquisto già in corso verso i fornitori per quell'articolo.
  - Se la merce in arrivo NON è sufficiente, genera una "Proposta di Ordine d'Acquisto" (Purchase Order).
  - Imposta la data di arrivo prevista sommando alla data odierna il `Lead Time Fornitore`.

# ISTRUZIONI PER L'OUTPUT
1. Scrivi il codice di questo motore di logica adattandolo al linguaggio e al framework che trovi nel mio workspace.
2. Assicurati che il codice sia modulare e che includa la gestione delle transazioni del database (se qualcosa fallisce, nessun ordine deve essere salvato a metà).
3. Includi uno snippet che mostri come schedulare o richiamare queste due funzioni (es. un cron job fittizio o una API route dedicata `/api/trigger-replenishment`).