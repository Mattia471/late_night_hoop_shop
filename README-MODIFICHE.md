# Late Night Hoop — Event Drop Refresh

File pronti da copiare nel progetto esistente.

## Cosa cambia
- Nuova direzione grafica streetwear/event drop mantenendo nero, lime e bianco.
- Catalogo ridotto alle 2 colorway reali della **LNH x Chuck Boxy Fit Tee**.
- Immagini fronte/retro aggiornate.
- Flusso rinominato da acquisto/checkout a **prenotazione**.
- Nessun pagamento online: il totale è indicato come importo da pagare allo stand.
- Ritiro esclusivamente allo stand.
- Personalizzazione evidenziata come disponibile allo stand.
- Conferma finale con codice di ritiro.
- Validazione minima migliorata per telefono ed email.
- Invio EmailJS atteso prima di mostrare la conferma, con messaggio d'errore in caso di fallimento.

## Dove copiare i file
- `src/App.tsx`
- `src/index.css`
- `src/types/index.ts`
- `tailwind.config.js`
- i 4 file `.jpeg` dentro `public/`

Il file `basket.png` continua a essere letto da `/basket.png`, quindi lascia quello già presente nel progetto.


## v5 - Stock evento e prezzo
- Prezzo aggiornato a 20,00 € per tutte le tee.
- Personalizzazione indicata come gratuita presso lo stand.
- Stock totale iniziale: 35 pezzi.
- Black: 18 pezzi — S 2, M 3, L 6, XL 5, XXL 2.
- White: 17 pezzi — S 1, M 3, L 6, XL 5, XXL 2.
- Conteggio disponibilità mostrato per colore e per taglia.
- Le taglie esaurite vengono disabilitate automaticamente.
- Il carrello non permette di superare lo stock disponibile della variante.
- A prenotazione confermata lo stock viene decrementato nella sessione browser corrente.

Nota: il progetto non ha un backend/database. Il conteggio implementato è quindi client-side e non sincronizza lo stock tra dispositivi o utenti diversi.

## v6 - Supabase
La v6 sostituisce la gestione client-side dello stock descritta sopra.

- Catalogo, prezzo, contenuti evento e disponibilità arrivano da Supabase.
- Stock condiviso e sincronizzato tra tutti i dispositivi.
- Prenotazione salvata in `orders` + `order_items`.
- Decremento stock atomico lato database, quindi niente overbooking dell'ultimo pezzo.
- Realtime sulle varianti per aggiornare le quantità senza refresh.
- Annullando una prenotazione `reserved`, lo stock viene ripristinato automaticamente.
- EmailJS è diventato opzionale e viene chiamato dalla Edge Function, non più dal browser.

Per installazione, tabelle e deploy usa `README-SUPABASE.md`.
