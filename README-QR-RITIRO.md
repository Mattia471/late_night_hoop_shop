# Late Night Hoop - QR di ritiro

## Flusso

1. Il cliente conferma la prenotazione.
2. Supabase genera un `pickup_token` casuale per l'ordine.
3. Il frontend genera un QR contenente un URL del tipo:
   `https://tuosito.it/?pickup=TOKEN`
4. Il cliente salva il QR sul telefono.
5. Allo stand lo staff inquadra il QR con la fotocamera.
6. Si apre la pagina di check-in e viene chiamata la Edge Function `collect-order`
   per leggere lo stato della prenotazione.
7. Lo staff verifica ordine e importo, inserisce il PIN dello stand e preme
   **Segna come ritirato**.
8. La Edge Function aggiorna l'ordine a `collected` e valorizza `collected_at`.

## Perché c'è il PIN dello stand

Il QR è in mano al cliente. Se la scansione segnasse automaticamente l'ordine come ritirato,
il cliente potrebbe aprire da solo il proprio QR prima di arrivare allo stand.

Il PIN non viene inserito nel QR né nel frontend: rimane un secret della Edge Function.

## Dipendenze frontend con pnpm

```bash
pnpm add qrcode
pnpm add -D @types/qrcode
```

Supabase client rimane:

```bash
pnpm add @supabase/supabase-js
```

## Se il database v6 esiste già

Apri Supabase -> SQL Editor ed esegui:

```text
supabase/qr-pickup-migration.sql
```

La migration aggiunge:
- `orders.pickup_token`
- `orders.collected_at`
- aggiornamento `create_event_order`
- funzione `collect_event_order`

Se stai creando il database da zero puoi invece eseguire direttamente lo `schema.sql` aggiornato
e poi `seed.sql`.

## Configurare il PIN dello stand

Scegli un PIN che conosca solo lo staff, ad esempio 6 cifre.

```bash
pnpm supabase secrets set STAND_PICKUP_PIN=482731
```

Non usare questo esempio in produzione.

## Deploy Edge Functions

```bash
pnpm supabase functions deploy create-order
pnpm supabase functions deploy collect-order
```

Entrambe hanno `verify_jwt = false` nel `supabase/config.toml`.
La sicurezza del ritiro è affidata al token QR casuale + PIN dello staff.

## Test rapido

1. Crea una prenotazione dal sito.
2. Salva il QR dalla modale di conferma.
3. Inquadralo con un secondo telefono.
4. Deve aprirsi la schermata `Stand check-in`.
5. Verifica che siano visibili ordine, articoli e totale.
6. Inserisci il PIN corretto.
7. Dopo la conferma lo stato deve diventare `Ritirato`.
8. In Supabase, tabella `orders`, verifica:
   - `status = collected`
   - `collected_at` valorizzato
9. Scansionando di nuovo lo stesso QR deve apparire `Ordine già ritirato`.
