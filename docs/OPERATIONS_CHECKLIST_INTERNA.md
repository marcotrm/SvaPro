# SvaPro - Checklist Operativa Interna

## Apertura giornata
1. Verifica servizio backend raggiungibile.
2. Verifica dashboard senza errori bloccanti.
3. Verifica coda offline vendite = 0 prima apertura cassa.

## Durante la giornata
1. Vendite POS create da modulo ordine con righe complete.
2. Alert stock monitorati da pagina Alert Stock.
3. Rettifiche magazzino solo da utenti autorizzati.

## Chiusura giornata
1. Export ordini giornaliero (CSV/PDF dove necessario).
2. Verifica backup DB creato in storage/app/backups.
3. Verifica assenza vendite in coda offline.

## Settimanale
1. Test ripristino da ultimo backup in ambiente test.
2. Verifica consistenza giacenze top 20 SKU.
3. Revisione audit log operazioni sensibili.

## Mensile
1. Revisione regole fiscali (IVA/accise) con referente fiscale.
2. Aggiornamento runbook incidenti.
3. Simulazione scenario offline -> online con sync completo.
