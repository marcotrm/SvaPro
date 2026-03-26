# Test Plan - Offline Vendite e Sync

## Obiettivo
Confermare che la vendita possa essere registrata offline e sincronizzata al ritorno online.

## Precondizioni
1. Utente autenticato e tenant selezionato.
2. Magazzino e varianti presenti.
3. Browser con localStorage attivo.

## Scenario 1 - Vendita offline singola
1. Apri pagina Ordini.
2. Disconnetti rete (offline).
3. Crea ordine con almeno 1 riga prodotto.
4. Atteso: messaggio "Vendita salvata offline" e incremento coda offline.
5. Riconnetti rete.
6. Atteso: sync automatico e coda che torna a 0.
7. Verifica ordine presente in lista e stock aggiornato.

## Scenario 2 - Più vendite offline
1. Ripeti 3 vendite offline.
2. Verifica coda = 3.
3. Torna online.
4. Atteso: sync progressivo, coda a 0, ordini visibili.

## Scenario 3 - Sync manuale
1. Con rete online e coda > 0 usa "Sincronizza ora".
2. Atteso: riduzione coda e refresh ordini.

## Scenario 4 - Errore di validazione
1. Forza una riga non valida offline (se possibile).
2. Al sync atteso: ordine scartato, coda non bloccata per gli altri eventi.

## KPI minimi accettazione
1. 100% ordini validi offline sincronizzati entro 60 secondi dal reconnect.
2. Nessuna duplicazione ordine in caso di retry.
3. Stock e movimenti coerenti post-sync.
