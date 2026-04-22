# Regole di Flusso di Lavoro (AI Workflow)

QUESTO FILE CONTIENE ISTRUZIONI CRITICHE PER L'AGENTE AI (Antigravity/Gemini o altri) CHE LAVORA SU QUESTO PROGETTO.
DEVI SEGUIRE STRICTLY QUESTE REGOLE PER OGNI TASK.

## Regola Master:
Da direttiva dell'utente, l'iter di lavoro su SvaPro deve SEMPRE seguire questo schema:
1. **Sviluppo Locale**: Tutte le modifiche al codice (creazione nuove pagine, bugfix, refactoring) vanno fatte e testate prima in locale. 
2. **Review dell'Utente (STOP)**: Dopo aver preparato una modifica locale, l'AI deve fermarsi e chiedere espressamente all'utente di testare e guardare l'interfaccia in locale (su `localhost` o IP locale).
3. **Approvazione esplicita**: L'AI NON DEVE eseguire NESSUN deploy su server di produzione (es. Railway) fìnchè l'utente non digita un via libera chiaro (es. "ok approvo", "perfetto, manda online", "deploy").
4. **Deploy su Railway**: Solo a ricezione del via libera, l'AI eseguirà il commit su branch principale, il `git push`, e controllerà l'aggiornamento (se automatizzato) oppure eseguirà i comandi di deploy.

## Perché questo file?
Questo file serve a centralizzare il contesto (Context) fra i vari computer dell'utente (Casa, Negozio Caserta, ecc.). L'AI, leggendolo o avendolo nel workspace, è costretta a rispettare il processo senza che l'utente debba ripeterlo ogni volta.
