# Riassunto tecnico progetto: Late Night Hoop

## Descrizione generale
Il progetto `late-night-hoop` e una web app ecommerce single-page per vendere merchandising del brand Late Night Hoop, in particolare t-shirt. L'app permette di visualizzare una collezione prodotti, scegliere taglia, aggiungere articoli al carrello, modificare quantita, compilare un checkout semplice e inviare un ordine tramite EmailJS.

## Stack tecnico
- React 18
- TypeScript
- Create React App (`react-scripts`)
- Tailwind CSS
- lucide-react per le icone
- Vercel Analytics tramite `@vercel/analytics`
- EmailJS tramite chiamata `fetch` diretta alle API REST

## Struttura principale
- `src/App.tsx`: contiene quasi tutta la logica applicativa e il markup UI.
- `src/types/index.ts`: definisce le interfacce TypeScript principali.
- `src/index.tsx`: entry point React.
- `src/index.css`: importa Tailwind e font Inter da Google Fonts.
- `public/`: contiene immagini prodotto, logo basket e asset statici.
- `build/`: build di produzione gia presente.
- `package.json`: script standard CRA (`start`, `build`, `test`, `eject`).

## Modelli dati
In `src/types/index.ts`:

### Product
- `id`: identificativo numerico del prodotto.
- `name`: nome prodotto.
- `price`: prezzo unitario.
- `images`: array di immagini.
- `sizes`: array delle taglie disponibili.
- `description`: descrizione prodotto.

### CartItem
Estende `Product` e aggiunge:
- `quantity`: quantita nel carrello.
- `size`: taglia selezionata.

### CustomerInfo
- `nome`
- `cognome`
- `telefono`
- `email`

## Catalogo prodotti
Il catalogo e hardcoded dentro `App.tsx` nell'array `products`.

Prodotti attuali:
- `Late Night Hoop - White`
- `Late Night Hoop - Black`
- `Late Night Hoop Arched - White`
- `Late Night Hoop Arched - Black`

Prezzo fisso:
- `15.00`

Taglie:
- `S`, `M`, `L`, `XL`, `XXL`

Immagini usate:
- `shirt_white_1_front.jpeg`
- `shirt_white_1_retro.jpeg`
- `shirt_black_2_front.jpeg`
- `shirt_black_1_retro.jpeg`
- `shirt_white_2_front.jpeg`
- `shirt_black_1_front.jpeg`

## Funzionalita principali
L'app gestisce:
- visualizzazione prodotti in griglia responsive;
- slider immagini per ogni prodotto;
- selezione taglia per prodotto;
- aggiunta al carrello solo dopo selezione taglia;
- raggruppamento nel carrello per combinazione prodotto + taglia;
- incremento/decremento quantita;
- rimozione automatica dal carrello se la quantita scende a zero;
- calcolo totale articoli;
- calcolo prezzo totale;
- sidebar carrello;
- checkout con nome, cognome, telefono, email opzionale;
- checkbox obbligatoria per accettazione termini;
- conferma ordine;
- invio email ordine;
- modale temporanea "prodotto aggiunto";
- modale temporanea "ordine confermato".

## Stato React principale
In `App.tsx` vengono usati diversi `useState`:
- `cart`: lista articoli nel carrello.
- `isCartOpen`: apertura/chiusura sidebar carrello.
- `selectedSizes`: taglia selezionata per ogni prodotto.
- `currentImageIndex`: immagine corrente per ogni prodotto.
- `showCheckoutForm`: mostra/nasconde form checkout.
- `customerInfo`: dati cliente.
- `orderCompleted`: stato conferma ordine.
- `addedToCart`: stato modale prodotto aggiunto.
- `orderNumber`: numero ordine generato.
- `acceptedTerms`: accettazione termini.

## Checkout e ordini
La validazione del form richiede:
- nome non vuoto;
- cognome non vuoto;
- telefono non vuoto;
- termini accettati.

L'email e opzionale.

Il numero ordine viene generato con:

```ts
'LNH' + Date.now().toString().slice(-6)
```

Al completamento ordine:
- viene generato un numero ordine;
- viene inviata email al venditore;
- viene mostrata conferma ordine;
- carrello e dati cliente vengono resettati dopo 5 secondi.

## Invio email
La funzione `sendEmail` invia una richiesta POST a:

```txt
https://api.emailjs.com/api/v1.0/email/send
```

Parametri hardcoded:
- `serviceID = service_7lcd0t2`
- `templateID = template_3r2k30y`
- `publicKey = qeOlzhTQkJ-vdAIIz`
- destinatario venditore: `cucuzzzamattia47@gmail.com`

L'invio email avviene lato client, quindi service ID, template ID e public key sono visibili nel bundle frontend.

## UI e stile
La UI ha stile streetwear/basket:
- sfondo nero;
- accenti lime;
- grigi scuri;
- font Inter;
- layout responsive con Tailwind;
- header sticky;
- hero section;
- card prodotto;
- sidebar carrello;
- modali centrali.

Tailwind e configurato in `tailwind.config.js` con:
- content su `./src/**/*.{js,jsx,ts,tsx}`;
- estensione colori `lime.400` e `lime.300`;
- font sans basato su Inter.

## Asset pubblici
In `public/` sono presenti:
- `basket.png`
- `background.png`
- immagini prodotto `.jpeg`
- `index.html`
- `manifest.json`
- `robots.txt`

Le immagini vengono referenziate direttamente con path relativi come:

```tsx
<img src="basket.png" />
<img src={product.images[currentIndex]} />
```

## Testing
E presente un test CRA di default in `src/App.test.tsx`, ma risulta non aggiornato rispetto all'app reale:

```ts
screen.getByText(/learn react/i)
```

Questo probabilmente fallisce, perche l'app non mostra piu il testo "learn react".

## Note tecniche importanti
- Il progetto e monolitico: quasi tutta la logica e dentro `App.tsx`.
- Non c'e backend.
- Non c'e persistenza del carrello.
- Non c'e database prodotti.
- Non c'e pagamento online: il testo UI indica pagamento in contanti al ritiro.
- Alcune stringhe mostrano problemi di encoding, ad esempio `A"` al posto di `e` accentata e `�,�` al posto del simbolo euro.
- Alcuni commenti/stringhe italiane presentano caratteri corrotti.
- La validazione telefono/email e minima: controlla solo che il telefono non sia vuoto; l'email e opzionale e non validata.
- La chiave pubblica EmailJS e esposta nel frontend, come normale per EmailJS, ma la configurazione andrebbe comunque valutata con attenzione.
- Il test automatico va aggiornato.

## Comandi utili
```bash
npm start
npm run build
npm test
```
