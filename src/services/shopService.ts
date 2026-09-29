import { supabase } from '../lib/supabase';
import {
  CartItem,
  CustomerInfo,
  EventSettings,
  Product,
  ProductVariant,
  ReservationResult,
  TeeSize,
} from '../types';

type ProductRow = {
  id: number;
  slug: string;
  name: string;
  color: 'Black' | 'White';
  price_cents: number;
  images: string[] | null;
  description: string;
  badge: string | null;
  customizable: boolean;
  sort_order: number;
};

type VariantRow = {
  id: number;
  product_id: number;
  size: TeeSize;
  stock: number;
  active: boolean;
  sort_order: number;
};

type EventSettingsRow = {
  id: number;
  event_name: string;
  event_instagram_handle: string;
  event_instagram_url: string;
  developer_instagram_handle: string;
  developer_instagram_url: string;
  pickup_copy: string;
  customization_copy: string;
  reservation_open: boolean;
  initial_stock: number;
};

const mapEventSettings = (row: EventSettingsRow): EventSettings => ({
  id: row.id,
  eventName: row.event_name,
  eventInstagramHandle: row.event_instagram_handle,
  eventInstagramUrl: row.event_instagram_url,
  developerInstagramHandle: row.developer_instagram_handle,
  developerInstagramUrl: row.developer_instagram_url,
  pickupCopy: row.pickup_copy,
  customizationCopy: row.customization_copy,
  reservationOpen: row.reservation_open,
  initialStock: row.initial_stock,
});

export const getEventSettings = async (): Promise<EventSettings> => {
  const { data, error } = await supabase
    .from('event_settings')
    .select(
      'id,event_name,event_instagram_handle,event_instagram_url,developer_instagram_handle,developer_instagram_url,pickup_copy,customization_copy,reservation_open,initial_stock',
    )
    .eq('id', 1)
    .single();

  if (error) throw error;
  return mapEventSettings(data as EventSettingsRow);
};

export const getProducts = async (): Promise<Product[]> => {
  const [productsResponse, variantsResponse] = await Promise.all([
    supabase
      .from('products')
      .select('id,slug,name,color,price_cents,images,description,badge,customizable,sort_order')
      .eq('active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('product_variants')
      .select('id,product_id,size,stock,active,sort_order')
      .eq('active', true)
      .order('sort_order', { ascending: true }),
  ]);

  if (productsResponse.error) throw productsResponse.error;
  if (variantsResponse.error) throw variantsResponse.error;

  const productRows = (productsResponse.data || []) as ProductRow[];
  const variantRows = (variantsResponse.data || []) as VariantRow[];

  return productRows.map((product): Product => {
    const variants: ProductVariant[] = variantRows
      .filter((variant) => variant.product_id === product.id)
      .map((variant) => ({
        id: variant.id,
        productId: variant.product_id,
        size: variant.size,
        stock: variant.stock,
        active: variant.active,
        sortOrder: variant.sort_order,
      }));

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      color: product.color,
      price: product.price_cents / 100,
      images: product.images || [],
      sizes: variants.map((variant) => variant.size),
      variants,
      description: product.description,
      badge: product.badge || undefined,
      customizable: product.customizable,
    };
  });
};

export const getShopData = async (): Promise<{
  settings: EventSettings;
  products: Product[];
}> => {
  const [settings, products] = await Promise.all([getEventSettings(), getProducts()]);
  return { settings, products };
};

const readFunctionError = async (error: unknown): Promise<string> => {
  const fallback = 'Non siamo riusciti a registrare la prenotazione. Riprova tra qualche secondo.';
  if (!error || typeof error !== 'object') return fallback;

  const maybeError = error as {
    message?: string;
    context?: { json?: () => Promise<{ error?: string }> };
  };

  try {
    if (maybeError.context?.json) {
      const body = await maybeError.context.json();
      if (body?.error) return body.error;
    }
  } catch {
    // Ignora errori durante la lettura del body e usa il messaggio standard.
  }

  return maybeError.message || fallback;
};

export const createReservation = async (
  customer: CustomerInfo,
  cart: CartItem[],
): Promise<ReservationResult> => {
  const requestId = crypto.randomUUID();

  const { data, error } = await supabase.functions.invoke('create-order', {
    body: {
      requestId,
      customer,
      items: cart.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
      })),
    },
  });

  if (error) {
    throw new Error(await readFunctionError(error));
  }

  if (!data?.order_number || !data?.order_id) {
    throw new Error('La prenotazione non ha restituito un codice valido. Riprova.');
  }

  return {
    orderId: data.order_id,
    orderNumber: data.order_number,
    totalCents: data.total_cents,
    notificationSent: Boolean(data.notification_sent),
  };
};

export const subscribeInventory = (onChange: () => void): (() => void) => {
  const channel = supabase
    .channel('lnh-inventory-live')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'product_variants',
      },
      () => onChange(),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
};
