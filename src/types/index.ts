export type TeeSize = 'S' | 'M' | 'L' | 'XL' | 'XXL';

export interface ProductVariant {
  id: number;
  productId: number;
  size: TeeSize;
  stock: number;
  active: boolean;
  sortOrder: number;
}

export interface Product {
  id: number;
  slug: string;
  name: string;
  color: 'Black' | 'White';
  price: number;
  images: string[];
  sizes: TeeSize[];
  variants: ProductVariant[];
  description: string;
  badge?: string;
  customizable?: boolean;
}

export interface CartItem extends Product {
  quantity: number;
  size: TeeSize;
  variantId: number;
}

export interface CustomerInfo {
  nome: string;
  cognome: string;
  telefono: string;
  email: string;
}

export interface EventSettings {
  id: number;
  eventName: string;
  eventInstagramHandle: string;
  eventInstagramUrl: string;
  developerInstagramHandle: string;
  developerInstagramUrl: string;
  pickupCopy: string;
  customizationCopy: string;
  reservationOpen: boolean;
  initialStock: number;
}

export interface ReservationResult {
  orderId: string;
  orderNumber: string;
  totalCents: number;
  notificationSent: boolean;
  pickupToken: string;
}

export type OrderStatus = 'reserved' | 'collected' | 'cancelled';

export interface PickupOrderItem {
  productName: string;
  color: string;
  size: TeeSize;
  quantity: number;
  unitPriceCents: number;
}

export interface PickupOrderSummary {
  orderNumber: string;
  status: OrderStatus;
  totalCents: number;
  customerName: string;
  customerSurname: string;
  createdAt: string;
  collectedAt: string | null;
  items: PickupOrderItem[];
}


export interface PendingOrderItem {
  productName: string;
  color: string;
  size: TeeSize;
  quantity: number;
}

export interface PendingOrder {
  orderNumber: string;
  customerName: string;
  customerSurname: string;
  totalCents: number;
  createdAt: string;
  items: PendingOrderItem[];
}
