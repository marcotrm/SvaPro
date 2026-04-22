Devi correggere il problema dei dropdown vuoti nella modale "Crea Bolla Inventario".

Situazione attuale:
- La modale si apre correttamente.
- I campi sono cliccabili.
- Però i menu a tendina sono vuoti:
  - Negozio
  - Marca
  - Categoria
  - Tipo prodotto
- Nel form appare errore "Seleziona un negozio".
- Il frontend mostra le voci, ma non riceve dati reali da backend.

Obiettivo:
Popolare correttamente i dropdown della modale Crea Bolla Inventario usando i dati reali già presenti nel database.

Prima di modificare il codice, fai debug completo.

1. Trova il componente frontend della modale:
   - Crea Bolla Inventario
   - CreateInventoryModal
   - InventoryCreateModal
   - InventorySessionCreate
   - o nome equivalente

2. Trova dove vengono caricati:
   - stores / negozi
   - brands / marche
   - categories / categorie
   - product types / tipi prodotto

3. Controlla nel frontend:
   - quali endpoint vengono chiamati
   - se la chiamata parte davvero quando la modale si apre
   - se viene usato useEffect/onMounted correttamente
   - se la response viene salvata nello state
   - se lo state viene passato alle select
   - se le select usano value e onChange correttamente
   - se ci sono errori console
   - se ci sono 404/500 nel Network
   - se i nomi dei campi response coincidono con quelli usati nel frontend

4. Controlla nel backend:
   - se esistono endpoint per inventory filters/options
   - se esiste un endpoint tipo:
     GET /api/inventory/options
     GET /api/inventory/filters
     GET /api/stores
     GET /api/products/filters
   - se gli endpoint sono registrati nelle routes
   - se sono protetti da auth corretta
   - se rispettano tenant_id
   - se restituiscono dati nel formato corretto

5. Se gli endpoint non esistono, creali.

Crea un endpoint unico consigliato:

GET /api/inventory/options

Deve restituire:

{
  "stores": [
    {
      "id": 1,
      "name": "Negozio Caserta"
    }
  ],
  "brands": [
    {
      "value": "Brand A",
      "label": "Brand A"
    }
  ],
  "categories": [
    {
      "value": "Categoria A",
      "label": "Categoria A"
    }
  ],
  "types": [
    {
      "value": "Tipo A",
      "label": "Tipo A"
    }
  ]
}

IMPORTANTE:
Non inventare colonne.
Prima controlla lo schema reale del database.

Per stores/negozi:
- cerca tabella stores
- oppure warehouses
- oppure locations
- oppure shops
- oppure punti vendita
- usa la tabella reale già presente
- filtra per tenant_id se esiste
- filtra per is_active se esiste

Per brands/marche:
- se esiste una tabella brands, usa quella
- se non esiste, recupera distinct brand dai prodotti o varianti solo se la colonna esiste
- se non esiste nessuna colonna brand, non rompere il codice: restituisci array vuoto e nascondi o disabilita il filtro marca nel frontend

Per categories/categorie:
- se esiste una tabella categories, usa quella
- se non esiste, recupera distinct category dai prodotti o varianti solo se la colonna esiste
- se non esiste nessuna colonna category, restituisci array vuoto e nascondi o disabilita il filtro categoria

Per types/tipi prodotto:
- controlla se esiste type, product_type, category_type, family o simile
- se esiste, usa quella colonna reale
- se non esiste, restituisci array vuoto e nascondi o disabilita il filtro tipo

6. Correggi il frontend.

Quando la modale si apre deve chiamare:

GET /api/inventory/options

Poi deve valorizzare:

storesOptions
brandOptions
categoryOptions
typeOptions

Le select devono mostrare:
- "— Seleziona negozio —" se stores è vuoto o nessuno selezionato
- "Tutte le marche" se brands è disponibile
- "Tutte le categorie" se categories è disponibile
- "Tutti i tipi" se types è disponibile

Se un filtro opzionale ha array vuoto:
- non mostrare errore
- disabilitalo oppure nascondilo temporaneamente
- mostra eventualmente "Nessuna marca disponibile"

Il campo negozio invece è obbligatorio:
- se stores è vuoto, mostra alert:
  "Nessun negozio disponibile. Controlla configurazione store/magazzini."
- il pulsante crea bolla deve restare disabilitato finché non viene scelto un negozio

7. Controlla il formato dati.

Se il backend restituisce:

stores: [{ id, name }]

il frontend deve usare:
- value = store.id
- label = store.name

Se il backend restituisce:
brands: [{ value, label }]

il frontend deve usare:
- value = option.value
- label = option.label

8. Aggiungi logging temporaneo per debug.

Nel frontend aggiungi temporaneamente:

console.log("Inventory options loaded:", data);

Nel backend puoi loggare:
- tenant_id
- numero stores trovati
- numero brands trovati
- numero categories trovate
- numero types trovati

Poi, dopo la correzione, rimuovi o lascia solo log non invasivi.

9. Verifica anche la preview prodotti.

Dopo che seleziono negozio e filtri, il sistema deve poter caricare l’anteprima prodotti.

Se non esiste, crea endpoint:

POST /api/inventory/preview

Body:
{
  "store_id": 1,
  "filters": {
    "brand": null,
    "category": null,
    "type": null,
    "search": "12345",
    "only_positive_stock": false
  }
}

Response:
{
  "total": 25,
  "items": [
    {
      "id": 1,
      "product_id": 10,
      "product_variant_id": 22,
      "name": "Prodotto esempio",
      "sku": "SKU001",
      "barcode": "805...",
      "brand": null,
      "category": null,
      "type": null,
      "theoretical_quantity": 5
    }
  ]
}

ATTENZIONE:
La preview deposito può vedere theoretical_quantity.
La pagina store invece NON deve mai vedere theoretical_quantity.

10. Alla fine controlla:

- il menu negozio mostra almeno i negozi reali
- marca/categoria/tipo si popolano solo se i dati esistono
- se marca/categoria/tipo non esistono nel database non mandano in errore la modale
- selezionando un negozio sparisce l’errore "Seleziona un negozio"
- il pulsante crea bolla funziona
- i filtri vengono inviati davvero al backend
- il backend non usa colonne inesistenti tipo p.brand se non esistono
- il tenant_id viene rispettato
- non vengono mostrati dati di altri tenant

Prima fammi un report dei file coinvolti e del motivo per cui i dropdown erano vuoti.
Poi applica le modifiche.