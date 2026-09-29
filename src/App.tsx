import React, { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  Banknote,
  CheckCircle,
  Download,
  ChevronLeft,
  ChevronRight,
  Instagram,
  Mail,
  MapPin,
  Minus,
  Paintbrush,
  Phone,
  Plus,
  QrCode,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';
import {
  CartItem,
  CustomerInfo,
  EventSettings,
  PendingOrder,
  PickupOrderSummary,
  Product,
  TeeSize,
} from './types';
import {
  collectPickupOrder,
  createReservation,
  getPendingOrders,
  getPickupOrder,
  getProducts,
  getShopData,
  subscribeInventory,
} from './services/shopService';

const FALLBACK_EVENT_SETTINGS: EventSettings = {
  id: 1,
  eventName: 'Late Night Hoop',
  eventInstagramHandle: '@latenight_hoop',
  eventInstagramUrl: 'https://www.instagram.com/latenight_hoop/',
  developerInstagramHandle: '@mattiacucuzza_',
  developerInstagramUrl: 'https://www.instagram.com/mattiacucuzza_/',
  pickupCopy: 'Ritiro e pagamento esclusivamente presso lo stand',
  customizationCopy: 'Personalizzazione gratuita presso lo stand',
  reservationOpen: true,
  initialStock: 35,
};

const emptyCustomerInfo: CustomerInfo = {
  nome: '',
  cognome: '',
  telefono: '',
  email: '',
};

const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [eventSettings, setEventSettings] = useState<EventSettings>(FALLBACK_EVENT_SETTINGS);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedSizes, setSelectedSizes] = useState<Record<number, TeeSize>>({});
  const [currentImageIndex, setCurrentImageIndex] = useState<Record<number, number>>({});
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>(emptyCustomerInfo);
  const [orderCompleted, setOrderCompleted] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderPickupToken, setOrderPickupToken] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const pickupTokenFromUrl = useMemo(
    () => new URLSearchParams(window.location.search).get('pickup')?.trim() || '',
    [],
  );
  const isOrdersPage = window.location.pathname.replace(/\/+$/, '') === '/orders';

  const totalPrice = useMemo(
    () => cart.reduce((total, item) => total + item.price * item.quantity, 0),
    [cart],
  );

  const totalItems = useMemo(
    () => cart.reduce((total, item) => total + item.quantity, 0),
    [cart],
  );

  const getCartQuantity = (productId: number, size: string): number =>
    cart.find((item) => item.id === productId && item.size === size)?.quantity || 0;

  const getVariantStock = (productId: number, size: string): number =>
    products
      .find((product) => product.id === productId)
      ?.variants.find((variant) => variant.size === size)?.stock || 0;

  const getAvailableStock = (productId: number, size: string): number =>
    Math.max(getVariantStock(productId, size) - getCartQuantity(productId, size), 0);

  const getProductAvailableStock = (productId: number): number =>
    products
      .find((product) => product.id === productId)
      ?.variants.reduce((total, variant) => total + variant.stock, 0) || 0;

  const totalAvailableStock = products.reduce(
    (total, product) => total + product.variants.reduce((sum, variant) => sum + variant.stock, 0),
    0,
  );

  const addToCart = (product: Product): void => {
    if (!eventSettings.reservationOpen) return;

    const selectedSize = selectedSizes[product.id];
    if (!selectedSize) return;

    const variant = product.variants.find((item) => item.size === selectedSize);
    if (!variant || getAvailableStock(product.id, selectedSize) <= 0) return;

    setCart((previousCart) => {
      const existingItem = previousCart.find((item) => item.variantId === variant.id);

      if (existingItem) {
        if (existingItem.quantity >= variant.stock) return previousCart;

        return previousCart.map((item) =>
          item.variantId === variant.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      return [
        ...previousCart,
        {
          ...product,
          size: selectedSize,
          variantId: variant.id,
          quantity: 1,
        },
      ];
    });

    setAddedToCart(true);
    window.setTimeout(() => setAddedToCart(false), 1600);
  };

  const updateQuantity = (id: number, size: string, change: number): void => {
    const maxStock = getVariantStock(id, size);

    setCart((previousCart) =>
      previousCart
        .map((item) => {
          if (item.id !== id || item.size !== size) return item;

          const quantity = Math.min(item.quantity + change, maxStock);
          return quantity > 0 ? { ...item, quantity } : null;
        })
        .filter((item): item is CartItem => item !== null),
    );
  };

  const handleSizeSelection = (productId: number, size: TeeSize): void => {
    setSelectedSizes((previous) => ({ ...previous, [productId]: size }));
  };

  const nextImage = (productId: number, totalImages: number): void => {
    setCurrentImageIndex((previous) => ({
      ...previous,
      [productId]: ((previous[productId] || 0) + 1) % totalImages,
    }));
  };

  const prevImage = (productId: number, totalImages: number): void => {
    setCurrentImageIndex((previous) => ({
      ...previous,
      [productId]: ((previous[productId] || 0) - 1 + totalImages) % totalImages,
    }));
  };

  const handleCustomerInfoChange = (field: keyof CustomerInfo, value: string): void => {
    setCustomerInfo((previous) => ({ ...previous, [field]: value }));
    if (submitError) setSubmitError('');
  };

  const isPhoneValid = customerInfo.telefono.replace(/\D/g, '').length >= 8;
  const isEmailValid =
    customerInfo.email.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email.trim());

  const isFormValid =
    customerInfo.nome.trim() !== '' &&
    customerInfo.cognome.trim() !== '' &&
    isPhoneValid &&
    isEmailValid &&
    acceptedTerms;

  const refreshProducts = useCallback(async (): Promise<void> => {
    try {
      const nextProducts = await getProducts();
      setProducts(nextProducts);
      setCatalogError('');
    } catch (error) {
      console.error('Errore aggiornamento catalogo:', error);
      setCatalogError('Non riesco ad aggiornare le disponibilità in questo momento.');
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async (): Promise<void> => {
      setIsLoadingCatalog(true);
      try {
        const shop = await getShopData();
        if (!mounted) return;
        setProducts(shop.products);
        setEventSettings(shop.settings);
        setCatalogError('');
      } catch (error) {
        console.error('Errore caricamento Supabase:', error);
        if (mounted) {
          setCatalogError('Non riesco a caricare il drop. Controlla la configurazione Supabase.');
        }
      } finally {
        if (mounted) setIsLoadingCatalog(false);
      }
    };

    void load();
    const unsubscribe = subscribeInventory(() => {
      void refreshProducts();
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [refreshProducts]);

  useEffect(() => {
    let cancelled = false;

    const buildQr = async (): Promise<void> => {
      if (!orderCompleted || !orderPickupToken) {
        setQrDataUrl('');
        return;
      }

      const pickupUrl = `${window.location.origin}${window.location.pathname}?pickup=${encodeURIComponent(orderPickupToken)}`;

      try {
        const dataUrl = await QRCode.toDataURL(pickupUrl, {
          width: 720,
          margin: 2,
          errorCorrectionLevel: 'M',
        });

        if (!cancelled) setQrDataUrl(dataUrl);
      } catch (error) {
        console.error('Errore generazione QR:', error);
        if (!cancelled) setQrDataUrl('');
      }
    };

    void buildQr();

    return () => {
      cancelled = true;
    };
  }, [orderCompleted, orderPickupToken]);

  const closeOrderConfirmation = (): void => {
    setOrderCompleted(false);
    setCart([]);
    setCustomerInfo(emptyCustomerInfo);
    setAcceptedTerms(false);
    setSelectedSizes({});
    setOrderPickupToken('');
    setQrDataUrl('');
  };

  const completeOrder = async (): Promise<void> => {
    if (!isFormValid || isSubmitting) return;

    if (!eventSettings.reservationOpen) {
      setSubmitError('Le prenotazioni sono attualmente chiuse.');
      return;
    }

    const hasUnavailableItems = cart.some(
      (item) => item.quantity > getVariantStock(item.id, item.size),
    );

    if (hasUnavailableItems) {
      setSubmitError('La disponibilità è cambiata. Controlla nuovamente il carrello.');
      await refreshProducts();
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const reservation = await createReservation(customerInfo, cart);

      setOrderNumber(reservation.orderNumber);
      setOrderPickupToken(reservation.pickupToken);
      setOrderCompleted(true);
      setShowCheckoutForm(false);
      setIsCartOpen(false);

      await refreshProducts();

      window.setTimeout(() => {
        setOrderCompleted(false);
        setCart([]);
        setCustomerInfo(emptyCustomerInfo);
        setAcceptedTerms(false);
        setSelectedSizes({});
      }, 7000);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Non siamo riusciti a registrare la prenotazione. Riprova tra qualche secondo.';
      setSubmitError(message);
      await refreshProducts();
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToDrop = (): void => {
    document.getElementById('drop')?.scrollIntoView({ behavior: 'smooth' });
  };

  if (isOrdersPage) {
    return <PendingOrdersPage />;
  }

  if (pickupTokenFromUrl) {
    return <PickupCheckIn pickupToken={pickupTokenFromUrl} />;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-white selection:bg-lime-400 selection:text-black">
      <Analytics />

      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <button onClick={scrollToDrop} className="flex items-center gap-3 text-left">
            <img src="/basket.png" alt="Late Night Hoop" className="h-10 w-10 object-contain sm:h-11 sm:w-11" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-white/50">Event drop</p>
              <p className="text-base font-black tracking-tight sm:text-xl">
                LATE NIGHT <span className="text-lime-400">HOOP</span>
              </p>
            </div>
          </button>

          <div className="flex items-center gap-3">
            <a
              href={eventSettings.eventInstagramUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-white/70 transition hover:text-lime-400 sm:flex"
              aria-label="Apri Instagram Late Night Hoop"
            >
              <Instagram size={17} /> {eventSettings.eventInstagramHandle}
            </a>
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative hidden h-11 items-center gap-2 rounded-full bg-lime-400 px-4 font-black text-black transition hover:bg-lime-300 md:flex"
              aria-label="Apri prenotazione"
            >
              <ShoppingCart size={19} />
              <span className="hidden text-sm sm:inline">PRENOTAZIONE</span>
              {totalItems > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-black text-black">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="event-grid relative isolate overflow-hidden border-b border-white/10">
          <div className="absolute -left-32 top-16 h-80 w-80 rounded-full bg-lime-400/20 blur-[120px]" />
          <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-lime-400/[0.08] to-transparent" />

          <div className="mx-auto grid min-h-[78vh] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-20">
            <div className="relative z-10">
              <div className="mb-6 inline-flex items-center gap-2 border border-lime-400/40 bg-lime-400/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-lime-400">
                <Sparkles size={14} /> Limited event drop
              </div>

              <h1 className="max-w-4xl text-5xl font-black uppercase leading-[0.88] tracking-[-0.055em] sm:text-7xl lg:text-[92px]">
                LNH x Chuck
                <span className="mt-2 block text-lime-400">Boxy Fit Tee</span>
              </h1>

              <p className="mt-7 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg">
                Prenota online la tua tee dell'evento. Nessun pagamento sul sito: la ritiri, la paghi e puoi
                personalizzarla direttamente allo stand.
              </p>

              <a
                href={eventSettings.eventInstagramUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-white/55 transition hover:text-lime-400"
              >
                <Instagram size={17} />
                Segui l'evento su <span className="text-white">{eventSettings.eventInstagramHandle}</span>
              </a>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={scrollToDrop}
                  className="bg-lime-400 px-7 py-4 text-sm font-black uppercase tracking-[0.12em] text-black transition hover:bg-lime-300"
                >
                  Scegli la tua tee
                </button>
                <div className="flex items-center gap-3 border border-white/15 px-5 py-4 text-xs font-bold uppercase tracking-[0.12em] text-white/70">
                  <Banknote size={18} className="text-lime-400" /> €20 · paghi allo stand
                </div>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl md:max-w-none">
              <div className="absolute -inset-3 rotate-2 border border-lime-400/25" />
              <div className="relative overflow-hidden border border-white/10 bg-[#e9e9e9]">
                <img
                  src="/lnh-chuck-black-back.jpeg"
                  alt="LNH x Chuck Boxy Fit Tee nera retro"
                  className="aspect-square w-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-black/90 px-4 py-3 backdrop-blur">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-lime-400">Drop 01</span>
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">Black / White</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-white/10 bg-lime-400 text-black">
          <div className="mx-auto grid max-w-7xl divide-y divide-black/20 px-4 sm:px-6 md:grid-cols-3 md:divide-x md:divide-y-0 lg:px-8">
            <div className="flex items-center gap-4 py-5 md:px-6">
              <MapPin size={24} strokeWidth={2.5} />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em]">Pick-up only</p>
                <p className="text-sm font-semibold">{eventSettings.pickupCopy}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 py-5 md:px-6">
              <Banknote size={24} strokeWidth={2.5} />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em]">Pay at the stand</p>
                <p className="text-sm font-semibold">Zero pagamenti online</p>
              </div>
            </div>
            <div className="flex items-center gap-4 py-5 md:px-6">
              <Paintbrush size={24} strokeWidth={2.5} />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em]">Make it yours</p>
                <p className="text-sm font-semibold">{eventSettings.customizationCopy}</p>
              </div>
            </div>
          </div>
        </section>

        <section id="drop" className="relative bg-[#070707] py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 flex flex-col justify-between gap-5 border-b border-white/10 pb-8 md:flex-row md:items-end">
              <div>
                <p className="mb-3 text-xs font-black uppercase tracking-[0.28em] text-lime-400">The event drop</p>
                <h2 className="text-4xl font-black uppercase tracking-[-0.035em] sm:text-5xl">Choose your color.</h2>
              </div>
              <div className="md:text-right">
                <p className="text-sm leading-relaxed text-white/50">
                  Stesso boxy fit, due colorway. Personalizzazione gratuita live allo stand.
                </p>
                <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-lime-400">
                  {totalAvailableStock} / {eventSettings.initialStock} pezzi disponibili
                </p>
              </div>
            </div>

            {catalogError && (
              <div className="mb-6 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                {catalogError}
              </div>
            )}

            <div className="grid gap-7 lg:grid-cols-2">
              {isLoadingCatalog && products.length === 0 ? (
                <div className="border border-white/10 bg-black p-10 text-center text-sm font-bold uppercase tracking-[0.16em] text-white/40 lg:col-span-2">
                  Caricamento drop...
                </div>
              ) : products.map((product) => {
                const currentIndex = currentImageIndex[product.id] || 0;
                const selectedSize = selectedSizes[product.id];
                const selectedSizeAvailable = selectedSize
                  ? getAvailableStock(product.id, selectedSize)
                  : 0;
                const productAvailableStock = getProductAvailableStock(product.id);

                return (
                  <article key={product.id} className="group border border-white/10 bg-black">
                    <div className="relative overflow-hidden bg-[#e8e8e8]">
                      <img
                        src={product.images[currentIndex]}
                        alt={`${product.name} ${product.color}`}
                        className="aspect-square w-full object-cover transition duration-500 group-hover:scale-[1.015]"
                      />

                      <div className="absolute left-4 top-4 bg-black px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-lime-400">
                        {product.badge}
                      </div>

                      <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
                        <div className="bg-lime-400 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-black">
                          {product.color}
                        </div>
                        <div className="bg-black/90 px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em] text-white">
                          {productAvailableStock} disponibili
                        </div>
                      </div>

                      {product.images.length > 1 && (
                        <>
                          <button
                            onClick={() => prevImage(product.id, product.images.length)}
                            className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center bg-black text-white transition hover:bg-lime-400 hover:text-black"
                            aria-label="Immagine precedente"
                          >
                            <ChevronLeft size={20} />
                          </button>
                          <button
                            onClick={() => nextImage(product.id, product.images.length)}
                            className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center bg-black text-white transition hover:bg-lime-400 hover:text-black"
                            aria-label="Immagine successiva"
                          >
                            <ChevronRight size={20} />
                          </button>
                          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
                            {product.images.map((_, index) => (
                              <button
                                key={index}
                                onClick={() =>
                                  setCurrentImageIndex((previous) => ({ ...previous, [product.id]: index }))
                                }
                                className={`h-1.5 transition-all ${
                                  index === currentIndex ? 'w-8 bg-lime-400' : 'w-4 bg-black/35'
                                }`}
                                aria-label={`Mostra immagine ${index + 1}`}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="p-5 sm:p-7">
                      <div className="flex items-start justify-between gap-6">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-lime-400">LNH x Chuck</p>
                          <h3 className="mt-2 text-2xl font-black uppercase tracking-[-0.025em]">Boxy Fit Tee / {product.color}</h3>
                        </div>
                        <p className="shrink-0 text-2xl font-black text-lime-400">€{product.price.toFixed(2)}</p>
                      </div>

                      <p className="mt-4 text-sm leading-relaxed text-white/55">{product.description}</p>

                      <div className="mt-6 flex flex-wrap gap-2">
                        <span className="border border-white/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/70">Boxy fit</span>
                        <span className="border border-white/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/70">Event exclusive</span>
                        <span className="border border-lime-400/40 bg-lime-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-lime-400">Custom gratuita</span>
                      </div>

                      <div className="mt-7">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/70">Scegli la taglia</p>
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">S · M · L · XL · XXL</p>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                          {product.sizes.map((size) => {
                            const available = getAvailableStock(product.id, size);
                            const isSoldOut = available <= 0;

                            return (
                              <button
                                key={size}
                                disabled={isSoldOut}
                                onClick={() => handleSizeSelection(product.id, size)}
                                className={`min-h-[58px] border px-1 py-2 text-xs font-black transition ${
                                  isSoldOut
                                    ? 'cursor-not-allowed border-white/5 bg-white/[0.02] text-white/20 line-through'
                                    : selectedSize === size
                                      ? 'border-lime-400 bg-lime-400 text-black'
                                      : 'border-white/15 bg-white/[0.03] text-white hover:border-white/50'
                                }`}
                              >
                                <span className="block">{size}</span>
                                <span className={`mt-1 block text-[9px] font-bold no-underline ${
                                  selectedSize === size && !isSoldOut ? 'text-black/60' : 'text-white/35'
                                }`}>
                                  {isSoldOut ? 'sold out' : `${available} rim.`}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <button
                        disabled={!eventSettings.reservationOpen || !selectedSize || selectedSizeAvailable <= 0}
                        onClick={() => addToCart(product)}
                        className={`mt-6 w-full py-4 text-sm font-black uppercase tracking-[0.14em] transition ${
                          eventSettings.reservationOpen && selectedSize && selectedSizeAvailable > 0
                            ? 'bg-lime-400 text-black hover:bg-lime-300'
                            : 'cursor-not-allowed bg-white/5 text-white/25'
                        }`}
                      >
                        {!eventSettings.reservationOpen
                          ? 'Prenotazioni chiuse'
                          : !selectedSize
                            ? 'Seleziona una taglia'
                            : selectedSizeAvailable > 0
                              ? `Prenota taglia ${selectedSize} · ${selectedSizeAvailable} disponibili`
                              : `Taglia ${selectedSize} esaurita`}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-y border-white/10 bg-lime-400 text-black">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border-[44px] border-black/[0.06]" />
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1fr_auto] md:items-center lg:px-8 lg:py-16">
            <div className="relative z-10">
              <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em]">
                <Instagram size={16} /> Official event Instagram
              </div>
              <h2 className="max-w-3xl text-4xl font-black uppercase leading-[0.95] tracking-[-0.045em] sm:text-5xl">
                Il drop vive allo stand.<br />
                <span className="text-black/55">L'evento continua su Instagram.</span>
              </h2>
              <p className="mt-5 max-w-2xl text-sm font-semibold leading-relaxed text-black/65 sm:text-base">
                Per aggiornamenti dell'evento, contenuti dal playground, novità sul merch e comunicazioni live,
                il riferimento ufficiale è {eventSettings.eventInstagramHandle}.
              </p>
            </div>

            <a
              href={eventSettings.eventInstagramUrl}
              target="_blank"
              rel="noreferrer"
              className="relative z-10 inline-flex min-w-[245px] items-center justify-center gap-3 border-2 border-black bg-black px-7 py-4 text-sm font-black uppercase tracking-[0.13em] text-lime-400 transition hover:bg-transparent hover:text-black"
            >
              <Instagram size={20} />
              Apri {eventSettings.eventInstagramHandle}
            </a>
          </div>
        </section>

        <section className="border-y border-white/10 bg-black py-20">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 md:grid-cols-[0.8fr_1.2fr] lg:px-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-lime-400">How it works</p>
              <h2 className="mt-4 text-4xl font-black uppercase leading-none tracking-[-0.04em] sm:text-5xl">
                Prenota qui.<br />Finisci tutto allo stand.
              </h2>
            </div>

            <div className="grid gap-px bg-white/10 sm:grid-cols-3">
              {[
                ['01', 'Prenota', 'Scegli colore e taglia e lascia i tuoi dati.'],
                ['02', 'Mostra il QR', 'Mostra il QR salvato allo staff, poi ritira e paga direttamente allo stand.'],
                ['03', 'Customizza gratis', 'Personalizza gratuitamente la tee direttamente allo stand.'],
              ].map(([number, title, copy]) => (
                <div key={number} className="bg-black p-6 sm:p-7">
                  <p className="text-4xl font-black text-lime-400">{number}</p>
                  <h3 className="mt-6 text-lg font-black uppercase tracking-tight">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-white/50">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {!isCartOpen && (
        <button
          onClick={() => setIsCartOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-lime-400 text-black shadow-2xl shadow-lime-400/30 ring-1 ring-black/20 transition hover:bg-lime-300 active:scale-95 md:hidden"
          aria-label="Apri prenotazione"
        >
          <ShoppingCart size={23} strokeWidth={2.5} />
          {totalItems > 0 && (
            <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-xs font-black text-black shadow-lg">
              {totalItems}
            </span>
          )}
        </button>
      )}

      <footer className="border-t border-white/10 bg-[#070707] py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <p className="text-3xl font-black tracking-tight">
                LATE NIGHT <span className="text-lime-400">HOOP</span>
              </p>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/40">
                Event merch, playground culture e community. Prenota online, ritira e paga allo stand.
              </p>
              <a
                href={eventSettings.eventInstagramUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-white/65 transition hover:text-lime-400"
              >
                <Instagram size={16} />
                {eventSettings.eventInstagramHandle}
              </a>
            </div>

            <a
              href={eventSettings.developerInstagramUrl}
              target="_blank"
              rel="noreferrer"
              className="group border border-white/10 bg-white/[0.025] px-5 py-4 transition hover:border-lime-400/60 hover:bg-lime-400/[0.06]"
              aria-label="Instagram dello sviluppatore"
            >
              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-white/35">
                Website design & development
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Instagram size={17} className="text-lime-400" />
                <span className="text-sm font-black text-white transition group-hover:text-lime-400">
                  {eventSettings.developerInstagramHandle}
                </span>
              </div>
            </a>
          </div>

          <div className="mt-10 border-t border-white/10 pt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/25">
            Late Night Hoop · Event Drop
          </div>
        </div>
      </footer>

      {isCartOpen && (
        <div className="fixed inset-0 z-50">
          <button
            className="absolute inset-0 h-full w-full bg-black/75 backdrop-blur-sm"
            onClick={() => setIsCartOpen(false)}
            aria-label="Chiudi prenotazione"
          />

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-lime-400/40 bg-[#090909] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-5 sm:px-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-lime-400">Event pick-up</p>
                <h3 className="mt-1 text-2xl font-black uppercase">La tua prenotazione</h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="grid h-10 w-10 place-items-center border border-white/15 text-white transition hover:border-lime-400 hover:text-lime-400"
                aria-label="Chiudi"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              {cart.length === 0 ? (
                <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
                  <ShoppingCart size={36} className="text-white/20" />
                  <p className="mt-4 font-black uppercase">Ancora vuota.</p>
                  <p className="mt-2 max-w-xs text-sm text-white/40">Scegli colore e taglia dal drop per iniziare la prenotazione.</p>
                  <button
                    onClick={() => {
                      setIsCartOpen(false);
                      window.setTimeout(scrollToDrop, 150);
                    }}
                    className="mt-6 bg-lime-400 px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-black"
                  >
                    Vai al drop
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div key={`${item.id}-${item.size}`} className="grid grid-cols-[72px_1fr_auto] gap-3 border border-white/10 bg-black p-3">
                        <img src={item.images[0]} alt={item.name} className="h-[72px] w-[72px] object-cover" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black">{item.name}</p>
                          <p className="mt-1 text-xs text-white/45">{item.color} · Taglia {item.size}</p>
                          <p className="mt-2 text-sm font-black text-lime-400">€{item.price.toFixed(2)}</p>
                        </div>
                        <div className="flex flex-col items-center justify-center gap-1">
                          <button
                            onClick={() => updateQuantity(item.id, item.size, 1)}
                            disabled={item.quantity >= getVariantStock(item.id, item.size)}
                            className={`grid h-7 w-7 place-items-center border transition ${
                              item.quantity >= getVariantStock(item.id, item.size)
                                ? 'cursor-not-allowed border-white/5 text-white/15'
                                : 'border-white/15 text-white hover:border-lime-400'
                            }`}
                            aria-label="Aumenta quantità"
                          >
                            <Plus size={14} />
                          </button>
                          <span className="text-xs font-black">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.size, -1)}
                            className="grid h-7 w-7 place-items-center border border-white/15 text-white hover:border-red-500 hover:text-red-400"
                            aria-label="Riduci quantità"
                          >
                            <Minus size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="my-5 grid grid-cols-2 gap-2">
                    <div className="border border-lime-400/25 bg-lime-400/[0.06] p-3">
                      <Banknote size={18} className="text-lime-400" />
                      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-lime-400">Pagamento</p>
                      <p className="mt-1 text-xs text-white/55">Solo allo stand</p>
                    </div>
                    <div className="border border-lime-400/25 bg-lime-400/[0.06] p-3">
                      <Paintbrush size={18} className="text-lime-400" />
                      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-lime-400">Custom</p>
                      <p className="mt-1 text-xs text-white/55">Gratuita allo stand</p>
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-5">
                    <div className="mb-5 flex items-end justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Totale da pagare allo stand</p>
                        <p className="mt-1 text-xs text-white/45">Nessun addebito online</p>
                      </div>
                      <p className="text-3xl font-black text-lime-400">€{totalPrice.toFixed(2)}</p>
                    </div>

                    {!showCheckoutForm ? (
                      <button
                        onClick={() => setShowCheckoutForm(true)}
                        className="w-full bg-lime-400 py-4 text-sm font-black uppercase tracking-[0.14em] text-black hover:bg-lime-300"
                      >
                        Inserisci i dati
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <p className="pb-1 text-xs font-black uppercase tracking-[0.16em] text-white/60">Dati per il ritiro</p>

                        <Field icon={<User size={17} />}>
                          <input
                            type="text"
                            placeholder="Nome *"
                            value={customerInfo.nome}
                            onChange={(event) => handleCustomerInfoChange('nome', event.target.value)}
                            className="field-input"
                          />
                        </Field>

                        <Field icon={<User size={17} />}>
                          <input
                            type="text"
                            placeholder="Cognome *"
                            value={customerInfo.cognome}
                            onChange={(event) => handleCustomerInfoChange('cognome', event.target.value)}
                            className="field-input"
                          />
                        </Field>

                        <Field icon={<Phone size={17} />}>
                          <input
                            type="tel"
                            placeholder="Telefono *"
                            value={customerInfo.telefono}
                            onChange={(event) => handleCustomerInfoChange('telefono', event.target.value)}
                            className="field-input"
                          />
                        </Field>
                        {customerInfo.telefono && !isPhoneValid && (
                          <p className="text-xs text-red-400">Inserisci un numero di telefono valido.</p>
                        )}

                        <Field icon={<Mail size={17} />}>
                          <input
                            type="email"
                            placeholder="Email (opzionale)"
                            value={customerInfo.email}
                            onChange={(event) => handleCustomerInfoChange('email', event.target.value)}
                            className="field-input"
                          />
                        </Field>
                        {customerInfo.email && !isEmailValid && (
                          <p className="text-xs text-red-400">Controlla il formato dell'email.</p>
                        )}

                        <label className="flex cursor-pointer items-start gap-3 border border-white/10 bg-white/[0.025] p-3 text-xs leading-relaxed text-white/55">
                          <input
                            type="checkbox"
                            checked={acceptedTerms}
                            onChange={(event) => setAcceptedTerms(event.target.checked)}
                            className="mt-0.5 h-4 w-4 accent-lime-400"
                          />
                          <span>
                            Confermo che questa è una prenotazione senza pagamento online. Ritiro e pagamento avverranno esclusivamente presso lo stand durante l'evento.
                          </span>
                        </label>

                        {submitError && (
                          <div className="border border-red-500/30 bg-red-500/10 p-3 text-xs leading-relaxed text-red-300">{submitError}</div>
                        )}

                        <div className="grid grid-cols-[0.8fr_1.2fr] gap-2 pt-1">
                          <button
                            onClick={() => setShowCheckoutForm(false)}
                            className="border border-white/15 py-3 text-xs font-black uppercase tracking-[0.12em] text-white hover:border-white/40"
                          >
                            Indietro
                          </button>
                          <button
                            onClick={completeOrder}
                            disabled={!isFormValid || isSubmitting}
                            className={`py-3 text-xs font-black uppercase tracking-[0.12em] transition ${
                              isFormValid && !isSubmitting
                                ? 'bg-lime-400 text-black hover:bg-lime-300'
                                : 'cursor-not-allowed bg-white/5 text-white/25'
                            }`}
                          >
                            {isSubmitting ? 'Invio...' : 'Conferma prenotazione'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      {orderCompleted && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/90 px-4 py-8 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-md border border-lime-400 bg-[#0a0a0a] p-6 text-center shadow-[0_0_80px_rgba(163,230,53,0.12)] sm:p-8">
            <CheckCircle className="mx-auto text-lime-400" size={50} strokeWidth={1.7} />
            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.26em] text-lime-400">Reservation confirmed</p>
            <h3 className="mt-2 text-3xl font-black uppercase tracking-[-0.03em]">Prenotazione ricevuta</h3>

            <div className="mx-auto mt-5 inline-block border border-white/15 bg-black px-5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Codice ritiro</p>
              <p className="mt-1 text-xl font-black text-lime-400 sm:text-2xl">{orderNumber}</p>
            </div>

            <div className="mx-auto mt-5 max-w-[300px] border border-white/15 bg-white p-3">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt={`QR ritiro ${orderNumber}`} className="aspect-square w-full" />
              ) : (
                <div className="grid aspect-square place-items-center text-black">
                  <QrCode size={52} />
                </div>
              )}
            </div>

            <div className="mt-4 border border-lime-400/25 bg-lime-400/[0.06] p-4 text-left">
              <div className="flex gap-3">
                <ShieldCheck size={21} className="mt-0.5 shrink-0 text-lime-400" />
                <p className="text-xs leading-relaxed text-white/60">
                  <strong className="text-white">Salva questo QR sul telefono.</strong> Mostralo allo staff al momento del ritiro.
                  Il QR è personale e non va condiviso.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-2">
              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download={`${orderNumber}-ritiro.png`}
                  className="flex w-full items-center justify-center gap-2 bg-lime-400 py-4 text-xs font-black uppercase tracking-[0.14em] text-black transition hover:bg-lime-300"
                >
                  <Download size={17} />
                  Salva QR
                </a>
              )}
              <button
                onClick={closeOrderConfirmation}
                className="w-full border border-white/15 py-3 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:border-white/40"
              >
                Ho salvato il QR · chiudi
              </button>
            </div>

            <p className="mx-auto mt-4 max-w-sm text-xs leading-relaxed text-white/40">
              Allo stand pagherai €{totalPrice.toFixed(2)}. La personalizzazione resta gratuita.
            </p>
          </div>
        </div>
      )}

      {addedToCart && (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-[55] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 border border-lime-400/50 bg-black/95 p-4 shadow-2xl backdrop-blur sm:left-auto sm:right-5 sm:translate-x-0">
          <div className="flex items-center gap-3">
            <CheckCircle size={22} className="shrink-0 text-lime-400" />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-lime-400">Aggiunta alla prenotazione</p>
              <p className="mt-1 text-xs text-white/50">Puoi continuare con un'altra variante o aprire il riepilogo.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


const PendingOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const loadOrders = async (): Promise<void> => {
      try {
        const data = await getPendingOrders();
        if (active) setOrders(data);
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Impossibile caricare gli ordini.',
          );
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadOrders();

    return () => {
      active = false;
    };
  }, []);

  const formatDate = (value: string): string =>
    new Intl.DateTimeFormat('it-IT', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));

  return (
    <div className="min-h-screen bg-black px-4 py-8 text-white sm:px-6">
      <main className="mx-auto max-w-4xl">
        <header className="mb-8 border-b border-white/10 pb-5">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-lime-400">
            Late Night Hoop
          </p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <h1 className="text-3xl font-black uppercase tracking-[-0.03em] sm:text-4xl">
              Ordini pendenti
            </h1>
            {!isLoading && !error && (
              <span className="text-sm font-black text-white/40">
                {orders.length}
              </span>
            )}
          </div>
        </header>

        {isLoading ? (
          <p className="py-12 text-center text-sm text-white/40">
            Caricamento ordini...
          </p>
        ) : error ? (
          <div className="border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div className="border border-white/10 p-8 text-center">
            <p className="font-black uppercase">Nessun ordine pendente</p>
            <p className="mt-2 text-sm text-white/40">
              Tutte le prenotazioni risultano ritirate o annullate.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <article
                key={order.orderNumber}
                className="border border-white/10 bg-[#090909] p-4 sm:p-5"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-xs font-black text-lime-400">
                      {order.orderNumber}
                    </p>
                    <h2 className="mt-1 text-lg font-black">
                      {order.customerName} {order.customerSurname}
                    </h2>
                    <p className="mt-1 text-xs text-white/35">
                      {formatDate(order.createdAt)}
                    </p>
                  </div>

                  <p className="text-xl font-black">
                    €{(order.totalCents / 100).toFixed(2)}
                  </p>
                </div>

                <div className="mt-4 border-t border-white/10 pt-3">
                  {order.items.map((item, index) => (
                    <p
                      key={`${order.orderNumber}-${index}`}
                      className="py-1 text-sm text-white/60"
                    >
                      <span className="font-bold text-white">{item.quantity}×</span>{' '}
                      {item.productName} · {item.color} · {item.size}
                    </p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

const PickupCheckIn: React.FC<{ pickupToken: string }> = ({ pickupToken }) => {
  const [order, setOrder] = useState<PickupOrderSummary | null>(null);
  const [standPin, setStandPin] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCollecting, setIsCollecting] = useState(false);
  const [error, setError] = useState('');

  const loadOrder = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError('');

    try {
      const nextOrder = await getPickupOrder(pickupToken);
      setOrder(nextOrder);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'QR non valido.');
    } finally {
      setIsLoading(false);
    }
  }, [pickupToken]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const confirmPickup = async (): Promise<void> => {
    if (!standPin.trim() || isCollecting) return;

    setIsCollecting(true);
    setError('');

    try {
      const collectedOrder = await collectPickupOrder(pickupToken, standPin.trim());
      setOrder(collectedOrder);
      setStandPin('');
    } catch (collectError) {
      setError(
        collectError instanceof Error
          ? collectError.message
          : 'Non è stato possibile confermare il ritiro.',
      );
    } finally {
      setIsCollecting(false);
    }
  };

  const formatDate = (value: string | null): string =>
    value
      ? new Intl.DateTimeFormat('it-IT', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(value))
      : '';

  return (
    <div className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 flex items-center gap-3">
          <img src="/basket.png" alt="Late Night Hoop" className="h-11 w-11 object-contain" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-lime-400">Stand check-in</p>
            <h1 className="text-xl font-black uppercase">Late Night Hoop</h1>
          </div>
        </div>

        <div className="border border-white/10 bg-[#090909] p-5 sm:p-7">
          {isLoading ? (
            <div className="py-16 text-center">
              <QrCode className="mx-auto text-lime-400" size={42} />
              <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-white/50">
                Verifica prenotazione...
              </p>
            </div>
          ) : error && !order ? (
            <div className="py-10 text-center">
              <X className="mx-auto text-red-400" size={42} />
              <h2 className="mt-4 text-2xl font-black uppercase">QR non valido</h2>
              <p className="mt-3 text-sm text-white/50">{error}</p>
            </div>
          ) : order ? (
            <>
              <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Prenotazione</p>
                  <p className="mt-1 break-all text-lg font-black text-lime-400">{order.orderNumber}</p>
                  <p className="mt-2 text-sm font-bold text-white/65">
                    {order.customerName} {order.customerSurname}
                  </p>
                </div>

                <div
                  className={`shrink-0 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] ${
                    order.status === 'collected'
                      ? 'bg-lime-400 text-black'
                      : order.status === 'cancelled'
                        ? 'bg-red-500 text-white'
                        : 'border border-lime-400 text-lime-400'
                  }`}
                >
                  {order.status === 'collected'
                    ? 'Ritirato'
                    : order.status === 'cancelled'
                      ? 'Annullato'
                      : 'Da ritirare'}
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {order.items.map((item, index) => (
                  <div
                    key={`${item.productName}-${item.size}-${index}`}
                    className="flex items-center justify-between gap-4 border border-white/10 bg-black p-3"
                  >
                    <div>
                      <p className="text-sm font-black">{item.productName}</p>
                      <p className="mt-1 text-xs text-white/45">
                        {item.color} · {item.size} · x{item.quantity}
                      </p>
                    </div>
                    <p className="text-sm font-black text-lime-400">
                      €{((item.unitPriceCents * item.quantity) / 100).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-end justify-between border-t border-white/10 pt-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">Da incassare</p>
                  <p className="mt-1 text-xs text-white/45">Pagamento allo stand</p>
                </div>
                <p className="text-3xl font-black text-lime-400">€{(order.totalCents / 100).toFixed(2)}</p>
              </div>

              {order.status === 'reserved' && (
                <div className="mt-6 border border-lime-400/30 bg-lime-400/[0.05] p-4">
                  <div className="flex items-center gap-2 text-lime-400">
                    <ShieldCheck size={19} />
                    <p className="text-xs font-black uppercase tracking-[0.15em]">Solo staff</p>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-white/45">
                    Dopo aver verificato consegna e pagamento, inserisci il PIN dello stand.
                  </p>

                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    value={standPin}
                    onChange={(event) => {
                      setStandPin(event.target.value);
                      if (error) setError('');
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void confirmPickup();
                    }}
                    placeholder="PIN stand"
                    className="mt-4 w-full border border-white/15 bg-black px-4 py-3 text-center text-lg font-black tracking-[0.25em] text-white outline-none transition focus:border-lime-400"
                  />

                  {error && (
                    <p className="mt-3 text-xs font-semibold text-red-400">{error}</p>
                  )}

                  <button
                    onClick={() => void confirmPickup()}
                    disabled={!standPin.trim() || isCollecting}
                    className={`mt-3 w-full py-4 text-xs font-black uppercase tracking-[0.14em] ${
                      standPin.trim() && !isCollecting
                        ? 'bg-lime-400 text-black hover:bg-lime-300'
                        : 'cursor-not-allowed bg-white/5 text-white/25'
                    }`}
                  >
                    {isCollecting ? 'Conferma in corso...' : 'Segna come ritirato'}
                  </button>
                </div>
              )}

              {order.status === 'collected' && (
                <div className="mt-6 border border-lime-400 bg-lime-400 p-5 text-center text-black">
                  <CheckCircle className="mx-auto" size={38} />
                  <p className="mt-3 text-lg font-black uppercase">Ordine già ritirato</p>
                  {order.collectedAt && (
                    <p className="mt-1 text-xs font-bold text-black/60">
                      {formatDate(order.collectedAt)}
                    </p>
                  )}
                </div>
              )}

              {order.status === 'cancelled' && (
                <div className="mt-6 border border-red-500/50 bg-red-500/10 p-5 text-center">
                  <X className="mx-auto text-red-400" size={36} />
                  <p className="mt-3 text-lg font-black uppercase text-red-300">Prenotazione annullata</p>
                  <p className="mt-2 text-xs text-white/45">Non consegnare il prodotto per questo ordine.</p>
                </div>
              )}
            </>
          ) : null}
        </div>

        <button
          onClick={() => {
            window.location.href = window.location.pathname;
          }}
          className="mt-4 w-full border border-white/10 py-3 text-xs font-black uppercase tracking-[0.14em] text-white/45 transition hover:border-white/30 hover:text-white"
        >
          Torna allo shop
        </button>
      </div>
    </div>
  );
};

const Field: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <div className="relative">
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35">{icon}</span>
    {children}
  </div>
);

export default App;
