# /orders - lista ordini pendenti

Pagina volutamente minimale e di sola lettura.

Mostra solo:
- codice ordine;
- nome e cognome;
- data/ora;
- totale;
- articoli, colore, taglia e quantità.

Non mostra:
- telefono;
- email;
- pickup token;
- pulsanti o azioni.

## Setup

Esegui in Supabase SQL Editor:

`supabase/orders-page-migration.sql`

Poi fai il normale deploy del frontend.

La pagina sarà disponibile su:

`/orders`

## Nota privacy

La pagina è pubblicamente raggiungibile se il sito lo è. Per questo la view non espone
telefono, email o token QR. Mostra comunque nome e cognome del cliente.
Se in futuro vuoi rendere `/orders` solo staff, conviene aggiungere autenticazione.
