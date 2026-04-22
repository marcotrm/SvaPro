Agisci come senior full stack developer esperto Laravel/PostgreSQL + frontend.

Sto sviluppando il modulo Inventario del mio gestionale. Il modulo è stato generato seguendo una specifica, ma adesso devo fare un controllo completo perché ci sono errori.

Errore già rilevato:
SQLSTATE[42703]: Undefined column: 7 ERROR: column p.brand does not exist

La query cercava colonne non esistenti tipo:
- p.brand
- p.category
- p.cost_price

Devi fare un check completo di tutto il modulo inventario e correggere tutti i possibili errori simili.

IMPORTANTE:
Non devi inventare colonne.
Non devi usare campi ipotetici.
Devi adattare tutto allo schema reale già presente nel progetto.

Prima fase: analisi
1. Analizza le migration esistenti.
2. Analizza i model esistenti.
3. Analizza le relazioni tra:
   - products
   - product_variants
   - brands, se esiste
   - categories, se esiste
   - suppliers, se esiste
   - stores
   - warehouses
   - stock
   - stock_levels
   - inventory tables
   - users
   - tenants
4. Trova tutte le query del modulo inventario.
5. Trova tutti i controller, service, request, resource e componenti frontend relativi all’inventario.
6. Dimmi prima quali problemi hai trovato, poi correggili.

Problemi da controllare e correggere:

BACKEND

1. Query con colonne inesistenti
Controlla tutte le query che fanno select su colonne tipo:
- p.brand
- p.category
- p.cost_price
- p.supplier
- p.type
- pv.brand
- pv.category
- pv.cost_price
- stock.quantity
- store.name

Verifica che queste colonne esistano davvero.
Se non esistono:
- usa la relazione corretta;
- usa join corrette;
- oppure rimuovi il campo se non indispensabile.

2. Filtri inventario
Nel frontend vedo le voci per filtrare, ma non sono cliccabili o non funzionano.

Devi controllare:
- se i filtri sono popolati dal backend;
- se esistono endpoint per recuperare marche, categorie, tipologie, fornitori;
- se i select/dropdown ricevono dati;
- se i select/dropdown hanno onChange funzionante;
- se lo stato React/Vue/JS viene aggiornato;
- se il bottone “applica filtri” usa davvero i valori scelti;
- se i filtri vengono inviati nella request di creazione bolla;
- se il backend legge davvero i filtri;
- se la query backend applica davvero i filtri.

3. Creazione bolla inventario
Controlla che:
- la bolla venga creata correttamente;
- venga assegnata allo store giusto;
- venga generato un numero bolla;
- vengano create le righe prodotto;
- venga salvata la giacenza teorica al momento della creazione;
- la giacenza teorica non venga ricalcolata dopo;
- non vengano create righe duplicate;
- vengano considerati solo prodotti attivi;
- venga rispettato tenant_id;
- venga rispettato lo store selezionato.

4. Giacenze
Controlla da quale tabella reale viene presa la giacenza.

Non dare per scontato che esista stock_levels.

Cerca nel progetto:
- stock
- stocks
- stock_levels
- warehouse_stock
- store_stock
- inventories
- movements
- product_variant_id
- store_id
- warehouse_id

Adatta il modulo inventario alla struttura reale.

5. Product variants
Nel progetto esiste product_variants.

Controlla se l’inventario deve lavorare su:
- product_id
oppure
- product_variant_id

Se i barcode stanno su product_variants, la bolla deve probabilmente usare product_variant_id, non solo product_id.

Controlla bene:
- barcode;
- sku;
- flavor;
- variante;
- prezzo;
- giacenza.

6. API store
Regola fondamentale:
Le API lato store non devono mai restituire la giacenza teorica.

Controlla tutte queste API:
- lista bolle store;
- dettaglio bolla store;
- scansione barcode;
- aggiornamento quantità manuale;
- chiusura bolla.

Assicurati che non restituiscano:
- theoretical_quantity;
- cost_price;
- difference;
- valore stock;
- dati riservati del deposito.

7. Scansione barcode
Controlla che:
- il barcode venga cercato nella tabella corretta;
- se il barcode è in product_variants, cerca lì;
- se viene trovato, incrementa counted_quantity;
- se non viene trovato nella bolla, registra anomalia;
- non crea duplicati;
- registra ogni scansione;
- aggiorna lo stato della riga;
- mantiene la bolla in stato IN_PROGRESS.

8. Chiusura bolla
Controlla che:
- lo store possa chiudere solo le proprie bolle;
- dopo la chiusura non possa più modificare;
- il sistema calcoli differenze;
- imposti MATCHED se differenza = 0;
- imposti MISMATCHED se differenza diversa da 0;
- notifichi o renda visibile la bolla al deposito.

9. Permessi
Controlla che:
- deposito/admin vedano tutto;
- store veda solo le sue bolle;
- store non possa vedere altri store;
- store non possa approvare;
- store non possa riaprire;
- solo admin/deposito possa approvare o riaprire.

10. Tenant
Se il progetto usa tenant_id:
- ogni query deve filtrare per tenant_id;
- evitare dati incrociati tra tenant diversi;
- products, stores, bolle e stock devono essere coerenti con lo stesso tenant.

FRONTEND

11. Filtri non cliccabili
Problema attuale:
Nel frontend c’è la voce filtro, ma non è cliccabile.

Controlla:
- se è un select disabilitato;
- se manca il valore options;
- se manca lo stato locale;
- se manca onChange;
- se il componente è coperto da un overlay invisibile;
- se c’è z-index sbagliato;
- se il dropdown è dentro un contenitore con overflow hidden;
- se manca import del componente Select;
- se il componente è renderizzato ma non interattivo;
- se c’è pointer-events: none;
- se il bottone o input è disabled;
- se manca type="button" e il form si resetta;
- se ci sono errori console JavaScript;
- se il componente controllato ha value ma non onChange.

Correggi il problema.

12. Dropdown filtri
I filtri devono funzionare per:
- store;
- marca;
- categoria;
- tipologia;
- fornitore;
- solo prodotti con giacenza > 0;
- prodotti attivi;
- ricerca per nome, sku o barcode.

Se alcuni dati non esistono nel database, nascondi temporaneamente il filtro oppure popolalo dai dati reali disponibili.

13. Creazione bolla lato frontend
Controlla che:
- i campi siano compilabili;
- il pulsante crea bolla funzioni;
- venga mostrata anteprima prodotti;
- venga mostrato errore se nessun prodotto trovato;
- venga mostrato loading;
- venga mostrato successo;
- dopo la creazione porti al dettaglio bolla o lista bolle.

14. Pagina store
Controlla che:
- lo store veda le bolle assegnate;
- possa aprire la bolla;
- il campo barcode sia attivo;
- dopo una scansione il campo barcode resti in focus;
- si veda la quantità contata;
- non si veda la quantità teorica;
- il pulsante chiudi inventario funzioni.

15. Stato visivo
Controlla che:
- verde = allineato;
- rosso = differenza;
- giallo = da verificare;
- grigio = non contato.

Verifica che i badge/stati non vadano in errore se lo stato è null o non previsto.

16. Error handling
Aggiungi gestione errori chiara:
- prodotto non trovato;
- barcode non presente nella bolla;
- bolla già chiusa;
- permesso negato;
- nessun prodotto trovato dai filtri;
- errore backend;
- errore database.

17. Console e network
Controlla eventuali errori:
- console browser;
- chiamate API fallite;
- 404 endpoint;
- 500 backend;
- payload sbagliato;
- CSRF/token;
- auth;
- CORS, se applicabile.

OBIETTIVO FINALE

Alla fine voglio che il modulo Inventario funzioni così:

Deposito:
1. apre sezione Inventario;
2. clicca Crea bolla;
3. seleziona store;
4. seleziona marca/categoria/tipologia o altri filtri disponibili;
5. vede anteprima prodotti;
6. crea bolla;
7. la bolla appare allo store.

Store:
1. apre sezione Inventario;
2. vede la bolla assegnata;
3. apre bolla;
4. vede prodotti ma NON vede giacenza teorica;
5. spara barcode;
6. il sistema conta automaticamente;
7. chiude la bolla.

Deposito:
1. vede il riscontro;
2. vede teorico, contato e differenza;
3. vede pallino verde se allineato;
4. vede pallino rosso se non allineato;
5. può chiedere chiarimenti;
6. può approvare.

Prima di modificare il codice:
- fammi un elenco dei file coinvolti;
- fammi un elenco dei problemi trovati;
- poi correggi in modo ordinato.

Quando correggi:
- non rompere le funzionalità esistenti;
- usa lo schema reale del database;
- non inventare colonne;
- non duplicare logiche;
- mantieni codice pulito e modulare;
- aggiungi commenti dove serve;
- aggiungi controlli di sicurezza;
- aggiungi test base se possibile.