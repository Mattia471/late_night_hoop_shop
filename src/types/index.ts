export interface Product {
    id: number;
    name: string;
    price: number;
    images: string[];
    sizes: string[]; // <- tutte le taglie disponibili
    description: string;
}

export interface CartItem extends Product {
    quantity: number;
    size: string; // <- la taglia selezionata per il carrello
}


export interface CustomerInfo {
    nome: string;
    cognome: string;
    telefono: string;
    email: string;
}