# Late Night Hoop v9 - Supabase DB only

Nessun invio email: niente EmailJS e niente Brevo.

## Flusso
1. `create-order` registra la prenotazione in Supabase.
2. `orders` salva cliente, codice ordine, stato, totale, pickup token e date.
3. `order_items` salva prodotto, colore, taglia, quantità e prezzo.
4. Lo stock viene decrementato nella stessa operazione transazionale.
5. Dopo la conferma il frontend mostra il QR personale.
6. La modale QR resta aperta: NON c'è chiusura automatica.
7. Il cliente la chiude solo con `Ho salvato il QR · chiudi`.
8. Allo stand il QR apre il check-in.
9. Dopo il PIN staff, l'ordine passa da `reserved` a `collected`.

## Database già esistente
Nel Supabase SQL Editor esegui:

`supabase/db-only-migration.sql`

Non elimina o modifica gli ordini esistenti. Aggiunge la vista amministrativa:
`public.order_admin_summary`.

## Deploy
Ridispiega `create-order` perché questa versione non invia più email:

```bash
pnpm supabase functions deploy create-order
```

E, se necessario:

```bash
pnpm supabase functions deploy collect-order
```

## Secret
Resta necessario soltanto il PIN staff:

```bash
pnpm supabase secrets set STAND_PICKUP_PIN=IL_TUO_PIN
```

I secret EmailJS/Brevo non servono.

## Query utili

Tutti:
```sql
select * from public.order_admin_summary order by created_at desc;
```

Da ritirare:
```sql
select * from public.order_admin_summary
where status = 'reserved'
order by created_at asc;
```

Ritirati:
```sql
select * from public.order_admin_summary
where status = 'collected'
order by collected_at desc;
```
