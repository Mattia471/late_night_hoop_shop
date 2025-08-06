import React, { useState } from 'react';
import {ShoppingCart, Plus, Minus, Star, Users, Truck, Shield, Instagram, HandIcon, Banknote} from 'lucide-react';
import { Product, CartItem } from './types';
import './App.css';

const App: React.FC = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const products: Product[] = [
    {
      id: 1,
      name: "Late Night Hoop Jersey",
      price: 45.00,
      image: "shirt1.jpeg",
      sizes: ["S","M","L","XL"],
      description: "Jersey premium da basket, perfetta per i tuoi allenamenti notturni"
    },
    {
      id: 2,
      name: "Streetball Shorts",
      price: 35.00,
      image: "shirt2.jpeg",
      sizes: ["S","M","L","XL"],
      description: "Pantaloncini tecnici per il playground e la strada"
    },
    {
      id: 3,
      name: "Hoop Dreams Hoodie",
      price: 55.00,
      image: "shirt3.jpeg",
      sizes: ["S","M","L","XL"],
      description: "Felpa con cappuccio, stile streetwear per veri ballers"
    }
  ];

  const addToCart = (product: Product, selectedSize: string): void => {
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
  };



  const updateQuantity = (id: number, change: number): void => {
    setCart(cart.map(item => {
      if (item.id === id) {
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
                  className="relative bg-lime-400 text-black px-6 py-3 rounded-full font-bold hover:bg-lime-300 transition-all transform hover:scale-105"
              >
                <ShoppingCart className="inline-block mr-2" size={20} />
                CARRELLO
                {getTotalItems() > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                  {getTotalItems()}
                </span>
                )}
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
                <div className="flex items-center space-x-2 text-lime-400 hover:underline cursor-pointer" onClick={() => window.open("https://www.instagram.com/latenight_hoop/"," blank")}>
                  <Instagram size={20} />
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
        <section className="py-8 bg-gray-900">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-center space-x-4 bg-black/50 p-6 rounded-lg border border-lime-400/20 hover:border-lime-400 transition-all transform hover:scale-105 hover:shadow-2xl hover:shadow-lime-400/20 cursor-pointer">
                <Truck className="text-lime-400" size={32} />
                <div>
                  <h3 className="font-bold text-lime-400">Spedizione Gratuita</h3>
                  <p className="text-gray-400">Su ordini superiori a €50</p>
                </div>
              </div>
              <div className="flex items-center space-x-4 bg-black/50 p-6 rounded-lg border border-lime-400/20 hover:border-lime-400 transition-all transform hover:scale-105 hover:shadow-2xl hover:shadow-lime-400/20 cursor-pointer">
                <Shield className="text-lime-400" size={32} />
                <div>
                  <h3 className="font-bold text-lime-400">Garanzia Qualità</h3>
                  <p className="text-gray-400">30 giorni soddisfatti o rimborsati</p>
                </div>
              </div>
              <div className="flex items-center space-x-4 bg-black/50 p-6 rounded-lg border border-lime-400/20 hover:border-lime-400 transition-all transform hover:scale-105 hover:shadow-2xl hover:shadow-lime-400/20 cursor-pointer">
                <Banknote  className="text-lime-400" size={32}/>
                <div>
                  <h3 className="font-bold text-lime-400">Pagamento alla consegna</h3>
                  <p className="text-gray-400">Non devi pagare nulla all'ordine</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Products */}
        <section className="py-16 bg-gradient-to-b from-gray-900 to-black">
          <div className="container mx-auto px-4">
            <h2 className="text-4xl font-black text-center mb-12 text-white">
              MERCH <span className="text-lime-400">COLLECTION</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {products.map(product => {

                return (
                    <div
                        key={product.id}
                        className="bg-gray-900 rounded-lg overflow-hidden border-2 border-gray-800 hover:border-lime-400 transition-all transform hover:scale-105 hover:shadow-2xl hover:shadow-lime-400/20"
                    >
                      <div className="relative">
                        <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-[500px] object-cover"
                        />
                        <div
                            className="absolute top-4 right-4 bg-lime-400 text-black px-2 py-1 rounded-full text-sm font-bold">
                          NEW
                        </div>
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
                                    onClick={() => setSelectedSize(size)}
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
                              onClick={() => selectedSize && addToCart(product, selectedSize)}
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
                                key={item.id}
                                className={`flex items-center space-x-4 mb-4 p-4 bg-black rounded-lg border border-gray-700 transform transition-all duration-300 ease-out ${
                                    isCartOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
                                }`}
                                style={{transitionDelay: `${index * 100}ms`}}
                            >
                              <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded"/>
                              <div className="flex-1">
                                <h4 className="font-bold text-white text-sm">{item.name}</h4>
                                <p className="text-sm text-gray-400">Taglia: {item.size}</p>

                                <p className="text-lime-400 font-bold">€{item.price.toFixed(2)}</p>
                              </div>
                              <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => updateQuantity(item.id, -1)}
                                    className="bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-400 transition-colors duration-200 hover:scale-110 transform"
                                >
                                  <Minus size={16}/>
                                </button>
                                <span className="w-8 text-center font-bold text-white">{item.quantity}</span>
                                <button
                                    onClick={() => updateQuantity(item.id, 1)}
                                    className="bg-lime-400 text-black w-8 h-8 rounded-full flex items-center justify-center hover:bg-lime-300 transition-colors duration-200 hover:scale-110 transform"
                                >
                                  <Plus size={16} />
                                </button>
                              </div>
                            </div>
                        ))}

                        <div className={`border-t border-gray-700 pt-4 mt-6 transform transition-all duration-500 ease-out ${
                            isCartOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
                        }`}
                             style={{ transitionDelay: `${cart.length * 100 + 200}ms` }}
                        >
                          <div className="flex justify-between items-center mb-4">
                            <span className="text-xl font-bold text-white">TOTALE:</span>
                            <span className="text-2xl font-black text-lime-400">€{getTotalPrice().toFixed(2)}</span>
                          </div>
                          <button className="w-full bg-lime-400 text-black py-4 rounded-lg font-black text-lg hover:bg-lime-300 transition-all duration-200 transform hover:scale-105">
                            PROCEDI AL CHECKOUT
                          </button>
                        </div>
                      </>
                  )}
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
              <div className="flex justify-center space-x-8 text-gray-400">
                <a href="#" className="hover:text-lime-400 transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-lime-400 transition-colors">Terms of Service</a>
                <a href="#" className="hover:text-lime-400 transition-colors">Contatti</a>
              </div>
              <div className="mt-8 text-gray-600">
                © 2025 Late Night Hoop. Tutti i diritti riservati.
              </div>
            </div>
          </div>
        </footer>
      </div>
  );
};

export default App;