import React, {useState} from 'react';
import {Banknote, Instagram, Minus, Plus, Shield, ShoppingCart, Users, ChevronLeft, ChevronRight, User, Phone, Mail, CheckCircle} from 'lucide-react';
import {CartItem, CustomerInfo, Product} from "./types";


const App: React.FC = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [selectedSizes, setSelectedSizes] = useState<{[key: number]: string}>({});
  const [currentImageIndex, setCurrentImageIndex] = useState<{[key: number]: number}>({});
  const [showCheckoutForm, setShowCheckoutForm] = useState<boolean>(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    nome: '',
    cognome: '',
    telefono: '',
    email: ''
  });
  const [orderCompleted, setOrderCompleted] = useState<boolean>(false);
  const [addedToCart, setAddedToCart] = useState<boolean>(false);
  const [orderNumber, setOrderNumber] = useState<string>('');

  const products: Product[] = [
    {
      id: 1,
      name: "Late Night Hoop - White",
      price: 15.00,
      images: ["shirt_white_1_front.jpeg", "shirt_white_1_retro.jpeg"], // Aggiungi più immagini qui
      sizes: ["S","M","L","XL","XXL"],
      description: ""
    },
    {
      id: 2,
      name: "Late Night Hoop - Black",
      price: 15.00,
      images: ["shirt_black_2_front.jpeg", "shirt_black_1_retro.jpeg"], // Aggiungi più immagini qui
      sizes: ["S","M","L","XL","XXL"],
      description: ""
    },
    {
      id: 4,
      name: "Late Night Hoop Arched - White",
      price: 15.00,
      images: ["shirt_white_2_front.jpeg", "shirt_white_1_retro.jpeg"], // Aggiungi più immagini qui
      sizes: ["S","M","L","XL","XXL"],
      description: ""
    },
    {
      id: 3,
      name: "Late Night Hoop Arched - Black",
      price: 15.00,
      images: ["shirt_black_1_front.jpeg", "shirt_black_1_retro.jpeg"], // Aggiungi più immagini qui
      sizes: ["S","M","L","XL","XXL"],
      description: ""
    },
  ];

  const addToCart = (product: Product): void => {
    const selectedSize = selectedSizes[product.id];
    if (!selectedSize) return;

    const existingItem = cart.find(
        item => item.id === product.id && item.size === selectedSize
    );

    if (existingItem) {
      setCart(cart.map(item =>
          item.id === product.id && item.size === selectedSize
              ? { ...item, quantity: item.quantity + 1 }
              : item
      ));
    } else {
      setCart([...cart, { ...product, size: selectedSize, quantity: 1 }]);
    }
    setAddedToCart(true)
    setTimeout(() => {
      setAddedToCart(false)
    }, 2000);
  };

  const updateQuantity = (id: number, size: string, change: number): void => {
    setCart(cart.map(item => {
      if (item.id === id && item.size === size) {
        const newQuantity = item.quantity + change;
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : null;
      }
      return item;
    }).filter((item): item is CartItem => item !== null));
  };

  const getTotalPrice = (): number => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getTotalItems = (): number => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const handleSizeSelection = (productId: number, size: string): void => {
    setSelectedSizes(prev => ({
      ...prev,
      [productId]: size
    }));
  };

  const nextImage = (productId: number, totalImages: number): void => {
    setCurrentImageIndex(prev => ({
      ...prev,
      [productId]: ((prev[productId] || 0) + 1) % totalImages
    }));
  };

  const prevImage = (productId: number, totalImages: number): void => {
    setCurrentImageIndex(prev => ({
      ...prev,
      [productId]: ((prev[productId] || 0) - 1 + totalImages) % totalImages
    }));
  };

  const getCurrentImageIndex = (productId: number): number => {
    return currentImageIndex[productId] || 0;
  };

  const handleCustomerInfoChange = (field: keyof CustomerInfo, value: string): void => {
    setCustomerInfo(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const isFormValid = (): boolean => {
    return customerInfo.nome.trim() !== '' &&
        customerInfo.cognome.trim() !== '' &&
        customerInfo.telefono.trim() !== '';
  };

  const generateOrderNumber = (): string => {
    return 'LNH' + Date.now().toString().slice(-6);
  };

  const sendEmail = async (orderNum: string): Promise<void> => {
    if (!customerInfo.email) return;

    try {
      // Configurazione EmailJS (sostituisci con i tuoi dati)
      const serviceID = process.env.EMAILJS_SERVICE_ID!;
      const templateID = process.env.EMAILJS_TEMPLATE_ID!;
      const publicKey = process.env.EMAILJS_PUBLIC_KEY!;

      const emailParams = {
        to_name: 'Venditore',
        to_email: 'cucuzzzamattia47@gmail.com',
        order_number: orderNum,
        customer_name: `${customerInfo.nome} ${customerInfo.cognome}`,
        customer_phone: customerInfo.telefono,
        customer_email: customerInfo.email,
        order_items: cart.map(item =>
            `• ${item.name} (Taglia: ${item.size}) x${item.quantity} - €${(item.price * item.quantity).toFixed(2)}`
        ).join('\n'),
        total_price: getTotalPrice().toFixed(2),
        company_name: 'Late Night Hoop'
      };


      // Invio email automatico (nascosto all'utente)
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: serviceID,
          template_id: templateID,
          user_id: publicKey,
          template_params: emailParams
        })
      });

      if (response.ok) {
        console.log('✅ Email inviata con successo a:', customerInfo.email);
      } else {
        console.error('❌ Errore invio email:', response.statusText);
      }

    } catch (error) {
      console.error('❌ Errore EmailJS:', error);
    }
  };


  const completeOrder = (): void => {
    const newOrderNumber = generateOrderNumber();
    setOrderNumber(newOrderNumber);

    // Invia Email
    sendEmail(newOrderNumber);

    // Mostra conferma ordine
    setOrderCompleted(true);
    setShowCheckoutForm(false);
    setIsCartOpen(false)

    // Reset dopo 5 secondi
    setTimeout(() => {
      setOrderCompleted(false);
      setCart([]);
      setCustomerInfo({
        nome: '',
        cognome: '',
        telefono: '',
        email: ''
      });
      setIsCartOpen(false);
    }, 5000);
  };

  return (
      <div className="min-h-screen bg-black text-white">
        {/* Header */}
        <header className="bg-gradient-to-r from-black to-gray-900 border-b-2 border-lime-400 sticky top-0 z-40">
          <div className="container mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <img src={"basket.png"} alt={'Late Night Hoop'} width={'50'}/>
                <div className="lg:text-3xl text-xl font-black text-lime-400">
                  LATE NIGHT<span className="text-white"> HOOP</span>
                </div>
              </div>
              <button
                  onClick={() => setIsCartOpen(!isCartOpen)}
                  className="relative bg-lime-400 text-black p-2 rounded-full font-bold hover:bg-lime-300 transition-all transform hover:scale-105"
              >
                <ShoppingCart className="inline-block" size={20}/>
                <span
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                  {getTotalItems()}
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative h-96 bg-gradient-to-r from-gray-900 to-black flex items-center overflow-hidden">
          <div className="absolute inset-0 bg-black/50 z-10"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-lime-400/20 to-transparent z-10"></div>
          <div className="container mx-auto px-4 z-20">
            <div className="max-w-2xl">
              <h1 className="lg:text-6xl text-5xl font-black mb-4 text-white">
                DOMINA IL
                <span className="text-lime-400 block">PLAYGROUND</span>
              </h1>
              <p className="text-xl text-gray-300 mb-8">
                Merchandising ufficiale per veri ballers. Stile streetball, qualità premium.
              </p>
              <div className="flex space-x-4">
                <div className="flex items-center space-x-2 text-lime-400 hover:underline cursor-pointer"
                     onClick={() => window.open("https://www.instagram.com/latenight_hoop/", " blank")}>
                  <Instagram size={20}/>
                  <span>Visitaci su Instagram</span>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute right-0 top-0 h-full w-1/3 opacity-20">
            <div className="h-full bg-gradient-to-l from-lime-400/30 to-transparent"></div>
          </div>
        </section>

        {/* Features */}
        {/*<section className="py-8 bg-gray-900">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div
                  className="flex items-center space-x-4 bg-black/50 p-6 rounded-lg border border-lime-400/20 hover:border-lime-400 transition-all transform hover:scale-105 hover:shadow-2xl hover:shadow-lime-400/20 cursor-pointer">
                <Users className="text-lime-400" size={32}/>
                <div>
                  <h3 className="font-bold text-lime-400">Ritiro di Persona</h3>
                  <p className="text-gray-400">Nessuna spedizione prevista</p>
                </div>
              </div>
              <div
                  className="flex items-center space-x-4 bg-black/50 p-6 rounded-lg border border-lime-400/20 hover:border-lime-400 transition-all transform hover:scale-105 hover:shadow-2xl hover:shadow-lime-400/20 cursor-pointer">
                <Shield className="text-lime-400" size={32}/>
                <div>
                  <h3 className="font-bold text-lime-400">Garanzia Qualità</h3>
                  <p className="text-gray-400">30 giorni soddisfatti o rimborsati</p>
                </div>
              </div>
              <div
                  className="flex items-center space-x-4 bg-black/50 p-6 rounded-lg border border-lime-400/20 hover:border-lime-400 transition-all transform hover:scale-105 hover:shadow-2xl hover:shadow-lime-400/20 cursor-pointer">
                <Banknote className="text-lime-400" size={32}/>
                <div>
                  <h3 className="font-bold text-lime-400">Pagamento alla consegna</h3>
                  <p className="text-gray-400">Pagherai comodamente al momento del ritiro, senza alcun anticipo
                    richiesto.</p>
                </div>
              </div>
            </div>
          </div>
        </section>*/}

        {/* Products */}
        <section className="py-16 bg-gradient-to-b from-gray-900 to-black">
          <div className="container mx-auto px-4">
            <h2 className="text-4xl font-black text-center mb-12 text-white">
              MERCH <span className="text-lime-400">COLLECTION</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {products.map(product => {
                const currentIndex = getCurrentImageIndex(product.id);
                const selectedSize = selectedSizes[product.id];

                return (
                    <div
                        key={product.id}
                        className="bg-gray-900 rounded-lg overflow-hidden border-2 border-gray-800 hover:border-lime-400 transition-all transform hover:scale-105 hover:shadow-2xl hover:shadow-lime-400/20"
                    >
                      <div className="relative">
                        <img
                            src={product.images[currentIndex]}
                            alt={product.name}
                            className="w-full h-[500px] object-cover"
                        />
                        <div
                            className="absolute top-4 right-4 bg-lime-400 text-black px-2 py-1 rounded-full text-sm font-bold">
                          NEW
                        </div>

                        {/* Slider Controls */}
                        {product.images.length > 1 && (
                            <>
                              <button
                                  onClick={() => prevImage(product.id, product.images.length)}
                                  className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-lime-400 transition-all"
                              >
                                <ChevronLeft size={20}/>
                              </button>
                              <button
                                  onClick={() => nextImage(product.id, product.images.length)}
                                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-lime-400 transition-all"
                              >
                                <ChevronRight size={20}/>
                              </button>

                              {/* Dots Indicator */}
                              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
                                {product.images.map((_, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setCurrentImageIndex(prev => ({...prev, [product.id]: index}))}
                                        className={`w-2 h-2 rounded-full transition-all ${
                                            index === currentIndex ? 'bg-lime-400' : 'bg-black/50'
                                        }`}
                                    />
                                ))}
                              </div>
                            </>
                        )}
                      </div>
                      <div className="p-6">
                        <h3 className="text-xl font-bold mb-2 text-white">{product.name}</h3>
                        <p className="text-gray-400 text-sm mb-4">{product.description}</p>

                        {/* Taglie disponibili */}
                        <div className="mb-4">
                          <p className="text-gray-300 mb-2 text-sm">Taglie disponibili:</p>
                          <div className="flex flex-wrap gap-2">
                            {product.sizes.map(size => (
                                <button
                                    key={size}
                                    onClick={() => handleSizeSelection(product.id, size)}
                                    className={`px-3 py-1 rounded-full border text-sm font-medium transition-all ${
                                        selectedSize === size
                                            ? "bg-lime-400 text-black border-lime-400"
                                            : "border-gray-600 text-gray-300 hover:border-lime-400 hover:text-lime-400"
                                    }`}
                                >
                                  {size}
                                </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex justify-between items-center">
                <span className="text-2xl font-black text-lime-400">
                  €{product.price.toFixed(2)}
                </span>
                          <button
                              disabled={!selectedSize}
                              onClick={() => addToCart(product)}
                              className={`px-6 py-2 rounded-full font-bold transform transition-all ${
                                  selectedSize
                                      ? "bg-lime-400 text-black hover:bg-lime-300 hover:scale-105"
                                      : "bg-gray-700 text-gray-400 cursor-not-allowed"
                              }`}
                          >
                            AGGIUNGI
                          </button>
                        </div>
                      </div>
                    </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Cart Sidebar */}
        {isCartOpen && (
            <div className="fixed inset-0 z-50 flex">
              <div
                  className="absolute inset-0 bg-black/70 transition-opacity duration-300 ease-in-out"
                  onClick={() => setIsCartOpen(false)}
              ></div>
              <div
                  className={`ml-auto w-96 bg-gray-900 h-full overflow-y-auto border-l-2 border-lime-400 transform transition-transform duration-500 ease-out ${
                      isCartOpen ? 'translate-x-0' : 'translate-x-full'
                  }`}>
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-black text-lime-400">CARRELLO</h3>
                    <button
                        onClick={() => setIsCartOpen(false)}
                        className="text-white hover:text-lime-400 text-2xl transition-colors duration-200 hover:rotate-90 transform"
                    >
                      ×
                    </button>
                  </div>

                  {cart.length === 0 ? (
                      <p className="text-gray-400 text-center py-8">Il tuo carrello è vuoto</p>
                  ) : (
                      <>
                        {cart.map((item, index) => (
                            <div
                                key={`${item.id}-${item.size}`}
                                className={`flex items-center space-x-4 mb-4 p-4 bg-black rounded-lg border border-gray-700 transform transition-all duration-300 ease-out ${
                                    isCartOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
                                }`}
                                style={{transitionDelay: `${index * 100}ms`}}
                            >
                              <img src={item.images[0]} alt={item.name} className="w-16 h-16 object-cover rounded"/>
                              <div className="flex-1">
                                <h4 className="font-bold text-white text-sm">{item.name}</h4>
                                <p className="text-sm text-gray-400">Taglia: {item.size}</p>
                                <p className="text-lime-400 font-bold">€{item.price.toFixed(2)}</p>
                              </div>
                              <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => updateQuantity(item.id, item.size, -1)}
                                    className="bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-400 transition-colors duration-200 hover:scale-110 transform"
                                >
                                  <Minus size={16}/>
                                </button>
                                <span className="w-8 text-center font-bold text-white">{item.quantity}</span>
                                <button
                                    onClick={() => updateQuantity(item.id, item.size, 1)}
                                    className="bg-lime-400 text-black w-8 h-8 rounded-full flex items-center justify-center hover:bg-lime-300 transition-colors duration-200 hover:scale-110 transform"
                                >
                                  <Plus size={16}/>
                                </button>
                              </div>
                            </div>
                        ))}

                        <div
                            className={`border-t border-gray-700 pt-4 mt-6 transform transition-all duration-500 ease-out ${
                                isCartOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
                            }`}
                            style={{transitionDelay: `${cart.length * 100 + 200}ms`}}
                        >
                          <div className="flex justify-between items-center mb-4">
                            <span className="text-xl font-bold text-[#00BFFF]">TOTALE:</span>
                            <span className="text-2xl font-black text-lime-400">€{getTotalPrice().toFixed(2)}</span>
                          </div>

                          <div className="bg-gray-800 p-3 rounded-lg mb-4 border border-lime-400/30">
                            <p className="text-sm text-lime-400 font-bold">💵 PAGAMENTO IN CONTANTI</p>
                            <p className="text-xs text-gray-400">Pagherai direttamente al momento del ritiro</p>
                          </div>

                          {!showCheckoutForm ? (
                              <button
                                  onClick={() => setShowCheckoutForm(true)}
                                  className="w-full bg-lime-400 text-black py-4 rounded-lg font-black text-lg hover:bg-lime-300 transition-all duration-200 transform hover:scale-105"
                              >
                                PROCEDI AL CHECKOUT
                              </button>
                          ) : (
                              <div className="space-y-4">
                                <h4 className="text-lg font-bold text-[#00BFFF] mb-3">I tuoi dati per l'ordine</h4>

                                <div className="space-y-3">
                                  <div className="relative">
                                    <User className="absolute left-3 top-3 text-gray-400" size={18}/>
                                    <input
                                        type="text"
                                        placeholder="Nome *"
                                        value={customerInfo.nome}
                                        onChange={(e) => handleCustomerInfoChange('nome', e.target.value)}
                                        className="w-full bg-black border border-gray-600 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-400 focus:border-lime-400 focus:outline-none"
                                    />
                                  </div>

                                  <div className="relative">
                                    <User className="absolute left-3 top-3 text-gray-400" size={18}/>
                                    <input
                                        type="text"
                                        placeholder="Cognome *"
                                        value={customerInfo.cognome}
                                        onChange={(e) => handleCustomerInfoChange('cognome', e.target.value)}
                                        className="w-full bg-black border border-gray-600 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-400 focus:border-lime-400 focus:outline-none"
                                    />
                                  </div>

                                  <div className="relative">
                                    <Phone className="absolute left-3 top-3 text-gray-400" size={18}/>
                                    <input
                                        type="tel"
                                        placeholder="Numero di telefono *"
                                        value={customerInfo.telefono}
                                        onChange={(e) => handleCustomerInfoChange('telefono', e.target.value)}
                                        className="w-full bg-black border border-gray-600 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-400 focus:border-lime-400 focus:outline-none"
                                    />
                                  </div>

                                  <div className="relative">
                                    <Mail className="absolute left-3 top-3 text-gray-400" size={18}/>
                                    <input
                                        type="email"
                                        placeholder="Email (opzionale)"
                                        value={customerInfo.email}
                                        onChange={(e) => handleCustomerInfoChange('email', e.target.value)}
                                        className="w-full bg-black border border-gray-600 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-400 focus:border-lime-400 focus:outline-none"
                                    />
                                  </div>
                                </div>

                                <div className="flex space-x-2 pt-2">
                                  <button
                                      onClick={() => setShowCheckoutForm(false)}
                                      className="flex-1 bg-gray-700 text-white py-3 rounded-lg font-bold hover:bg-gray-600 transition-all"
                                  >
                                    INDIETRO
                                  </button>
                                  <button
                                      onClick={completeOrder}
                                      disabled={!isFormValid()}
                                      className={`flex-1 py-3 rounded-lg font-bold transition-all transform ${
                                          isFormValid()
                                              ? 'bg-lime-400 text-black hover:bg-lime-300 hover:scale-105'
                                              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                      }`}
                                  >
                                    CONFERMA ORDINE
                                  </button>
                                </div>
                              </div>
                          )}
                        </div>
                      </>
                  )}
                </div>
              </div>
            </div>
        )}

        {/* Order Confirmation Modal */}
        {orderCompleted && (
            <div className="fixed inset-0 z-60 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/80"></div>
              <div
                  className="relative bg-gray-900 p-8 rounded-2xl border-2 border-lime-400 max-w-md mx-4 text-center transform animate-pulse">
                <CheckCircle className="mx-auto text-lime-400 mb-4" size={64}/>
                <h3 className="text-2xl font-black text-[#00BFFF] mb-2">ORDINE CONFERMATO!</h3>
                <p className="text-lime-400 font-bold text-lg mb-2">Ordine #{orderNumber}</p>
                <p className="text-gray-300 text-sm mb-4">
                  Ti contatteremo a breve per organizzare il ritiro dei tuoi prodotti!
                </p>
                <div className="bg-black/50 p-3 rounded-lg">
                  <p className="text-xs text-gray-400">Questo messaggio si chiuderà automaticamente...</p>
                </div>
              </div>
            </div>
        )}

        {addedToCart && (
            <div className="fixed inset-0 z-60 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/80"></div>
              <div className="relative bg-gray-900 p-8 rounded-2xl border-2 border-lime-400 max-w-md mx-4 text-center transform animate-pulse">
                <img src={'./basket.png'} className="mx-auto text-lime-400 mb-4" width={64} />
                <h3 className="text-2xl font-black text-lime-400 mb-2">PRODOTTO AGGIUNTO!</h3>
                <p className="text-white font-semibold text-lg mb-2">Il prodotto è stato aggiunto nel tuo carrello.</p>
                <p className="text-gray-300 text-sm mb-4">
                  Puoi continuare a fare acquisti o procedere al checkout.
                </p>
                <div className="bg-black/50 p-3 rounded-lg">
                  <p className="text-xs text-gray-400">Questo messaggio si chiuderà automaticamente...</p>
                </div>
              </div>
            </div>
        )}


        {/* Footer */}
        <footer className="bg-black border-t-2 border-lime-400 py-12">
          <div className="container mx-auto px-4">
            <div className="text-center">
              <div className="text-4xl font-black text-lime-400 mb-4">
                LATE NIGHT <span className="text-white">HOOP</span>
              </div>
              <p className="text-gray-400 mb-6">
                Il playground non dorme mai. Nemmeno noi.
              </p>
              <div className="mt-2 text-sm text-gray-200">
                Sito sviluppato da <a href="https://www.instagram.com/mattiacucuzza_/" target="_blank" className="text-lime-400 hover:underline">Mattia Cucuzza </a>
              </div>
            </div>
          </div>
        </footer>

      </div>
  );
};

export default App;