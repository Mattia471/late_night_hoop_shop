# Late Night Hoop - Email di conferma con QR

Questa versione non usa EmailJS.

L'invio avviene dalla Supabase Edge Function `create-order` tramite **Brevo Transactional Email API**.

## Flusso

Alla conferma della prenotazione:

1. Supabase crea l'ordine e scala lo stock.
2. Viene generato il token personale di ritiro.
3. La Edge Function genera il QR PNG.
4. Il cliente riceve una mail con:
   - codice ordine;
   - articoli / colori / taglie;
   - totale da pagare allo stand;
   - indicazione personalizzazione gratuita;
   - link di check-in;
   - QR allegato in PNG.
5. `latenighthoop@gmail.com` riceve automaticamente la stessa mail in BCC.

Se Brevo non fosse disponibile, l'ordine rimane comunque registrato e valido.

## Mittente

Configurazione prevista:

```text
Late Night Hoop <latenighthoop@gmail.com>
```

Prima di usarlo devi registrare e verificare questo sender su Brevo.
Brevo invierà una mail di conferma a `latenighthoop@gmail.com`.

## Setup Brevo

1. Crea un account Brevo.
2. Vai in **Senders & Domains**.
3. Crea un sender:
   - Name: `Late Night Hoop`
   - Email: `latenighthoop@gmail.com`
4. Apri Gmail e conferma la verifica.
5. In Brevo crea una API key.

## Secrets Supabase

```bash
pnpm supabase secrets set BREVO_API_KEY=LA_TUA_API_KEY
pnpm supabase secrets set PUBLIC_SITE_URL=https://IL-TUO-SITO.vercel.app
pnpm supabase secrets set LNH_SENDER_EMAIL=latenighthoop@gmail.com
pnpm supabase secrets set LNH_SENDER_NAME="Late Night Hoop"
```

Usa come `PUBLIC_SITE_URL` il dominio pubblico definitivo del sito, non un URL preview temporaneo.

## Deploy

```bash
pnpm supabase functions deploy create-order
```

La funzione di ritiro QR resta:

```bash
pnpm supabase functions deploy collect-order
```

## Dipendenze

Non serve installare Brevo nel frontend: la Edge Function chiama direttamente l'API HTTPS.

Per il QR frontend resta necessario:

```bash
pnpm add qrcode
pnpm add -D @types/qrcode
```

La Edge Function importa `qrcode` direttamente via `npm:` nel runtime Supabase.

## Email cliente

L'email è ora obbligatoria nel checkout perché è il canale usato per mandare il riepilogo e una copia del QR.

## Deliverability

Per partire puoi verificare `latenighthoop@gmail.com` come sender su Brevo.
Se in futuro avrai un dominio dedicato, autenticare il dominio con SPF/DKIM migliorerà la deliverability.
