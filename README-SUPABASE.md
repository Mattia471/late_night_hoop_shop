# Late Night Hoop + Supabase

Questa versione sposta su Supabase:

- catalogo prodotti;
- prezzo;
- stock per colore/taglia;
- apertura/chiusura prenotazioni;
- dati social/evento;
- prenotazioni;
- righe ordine;
- decremento atomico dello stock;
- ripristino automatico stock quando una prenotazione `reserved` viene portata a `cancelled`;
- aggiornamento realtime delle disponibilità sul sito.

Le immagini restano in `public/`, mentre i relativi path sono salvati nella tabella `products`.

## 1. Installa il client Supabase

Nel progetto React:

```bash
npm install @supabase/supabase-js@2
```

## 2. Crea le tabelle

Nel Supabase Dashboard apri **SQL Editor** e lancia, in ordine:

1. `supabase/schema.sql`
2. `supabase/seed.sql`

Lo stock iniziale sarà:

| Colore | S | M | L | XL | XXL | Totale |
|---|---:|---:|---:|---:|---:|---:|
| White | 1 | 3 | 6 | 5 | 2 | 17 |
| Black | 2 | 3 | 6 | 5 | 2 | 18 |
| Totale | 3 | 6 | 12 | 10 | 4 | 35 |

Il prezzo di entrambe le tee è `2000` centesimi, cioè **20 €**.

> `seed.sql` non resetta lo stock delle varianti già esistenti, quindi può essere rilanciato senza riportare accidentalmente il magazzino a 35 pezzi.

## 3. Configura React

Copia `.env.example` in `.env.local`:

```env
REACT_APP_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
REACT_APP_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

La publishable key è pensata per il browser. Non mettere mai la secret key o la legacy `service_role` key nel frontend.

Dopo aver modificato `.env.local`, riavvia `npm start`.

## 4. Edge Function per creare gli ordini

La funzione si trova in:

```text
supabase/functions/create-order/index.ts
```

È pubblica perché il sito non richiede login. Tutta la scrittura sul database avviene però server-side usando la secret key automatica di Supabase.

Con Supabase CLI:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy create-order
```

Il file `supabase/config.toml` contiene già:

```toml
[functions.create-order]
verify_jwt = false
```

Puoi anche creare/deployare la funzione dal Dashboard copiando il contenuto di `index.ts`.

## 5. EmailJS opzionale

Ora EmailJS non è più necessario per salvare l'ordine. La prenotazione viene prima registrata nel database.

Se vuoi continuare a ricevere anche la mail al venditore, imposta questi **Edge Function Secrets**:

```text
EMAILJS_SERVICE_ID
EMAILJS_TEMPLATE_ID
EMAILJS_PUBLIC_KEY
SELLER_EMAIL
```

Il template `.env` è in `supabase/functions/.env.example`.

Con CLI puoi caricarli con:

```bash
supabase secrets set EMAILJS_SERVICE_ID=...
supabase secrets set EMAILJS_TEMPLATE_ID=...
supabase secrets set EMAILJS_PUBLIC_KEY=...
supabase secrets set SELLER_EMAIL=...
```

Se non configuri EmailJS, il sito continua a funzionare normalmente e gli ordini rimangono visibili su Supabase.

## Tabelle

### `event_settings`
Una sola riga (`id = 1`) con contenuti e impostazioni dell'evento:

- account Instagram evento;
- account Instagram sviluppatore;
- testo ritiro;
- testo personalizzazione;
- `reservation_open` per aprire/chiudere le prenotazioni;
- stock iniziale di riferimento.

Per chiudere subito le prenotazioni:

```sql
update public.event_settings
set reservation_open = false
where id = 1;
```

### `products`
Contiene le due colorway, prezzo e immagini.

### `product_variants`
Contiene le 10 combinazioni colore/taglia e lo stock realmente disponibile.

Questa è la tabella che il sito ascolta in Realtime.

### `orders`
Una riga per prenotazione. Stati supportati:

- `reserved`: prenotata e da ritirare;
- `collected`: ritirata/pagata allo stand;
- `cancelled`: annullata.

Se cambi un ordine da `reserved` a `cancelled`, il trigger restituisce automaticamente le quantità allo stock.

Una prenotazione `collected` non può essere riportata ad altri stati tramite il normale update, evitando reintegri accidentali.

### `order_items`
Dettaglio delle maglie prenotate, con snapshot di prodotto, colore, taglia e prezzo al momento dell'ordine.

## Query utili durante l'evento

### Stock attuale

```sql
select
  p.color,
  v.size,
  v.stock
from public.product_variants v
join public.products p on p.id = v.product_id
order by p.sort_order, v.sort_order;
```

### Prenotazioni da consegnare

```sql
select
  order_number,
  customer_name,
  customer_surname,
  customer_phone,
  total_cents / 100.0 as total_euro,
  created_at
from public.orders
where status = 'reserved'
order by created_at;
```

### Dettaglio ordine

```sql
select
  o.order_number,
  oi.product_name,
  oi.color,
  oi.size,
  oi.quantity,
  oi.unit_price_cents / 100.0 as prezzo_unitario_euro
from public.orders o
join public.order_items oi on oi.order_id = o.id
where o.order_number = 'LNH-...';
```

### Segna come ritirato

```sql
update public.orders
set status = 'collected'
where order_number = 'LNH-...';
```

### Annulla e rimetti automaticamente le maglie in stock

```sql
update public.orders
set status = 'cancelled'
where order_number = 'LNH-...';
```

## Perché lo stock non va più in overbooking

Il browser non modifica direttamente `product_variants.stock`.

La Edge Function chiama `create_event_order`, che esegue nel database un'unica transazione e blocca (`FOR UPDATE`) le righe delle varianti coinvolte. Se due utenti tentano di prenotare contemporaneamente l'ultimo pezzo della stessa taglia, solo la prima transazione che trova stock sufficiente viene confermata.

Il frontend riceve poi l'aggiornamento tramite Supabase Realtime e aggiorna il counting senza refresh della pagina.


## QR di ritiro

La v7 aggiunge il QR personale per ogni prenotazione e una schermata staff protetta da PIN.

Vedi `README-QR-RITIRO.md`.

Comandi aggiuntivi:

```bash
pnpm add qrcode
pnpm add -D @types/qrcode
pnpm supabase secrets set STAND_PICKUP_PIN=IL_TUO_PIN
pnpm supabase functions deploy create-order
pnpm supabase functions deploy collect-order
```

Se hai già eseguito lo schema della v6, esegui anche `supabase/qr-pickup-migration.sql`.
