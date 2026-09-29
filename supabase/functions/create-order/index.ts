import { createClient } from 'npm:@supabase/supabase-js@^2';
import { corsHeaders } from 'npm:@supabase/supabase-js@^2/cors';

type OrderRequest = {
  requestId?: string;
  customer?: {
    nome?: string;
    cognome?: string;
    telefono?: string;
    email?: string;
  };
  items?: Array<{
    variantId?: number;
    quantity?: number;
  }>;
};

const jsonResponse = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: corsHeaders,
  });

const getAdminKey = (): string => {
  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');

  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, string>;
      const key = parsed.default || Object.values(parsed)[0];
      if (key) return key;
    } catch {
      // Fallback alla legacy service role key qui sotto.
    }
  }

  const legacyServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!legacyServiceRoleKey) {
    throw new Error('Secret key Supabase non disponibile nella Edge Function.');
  }

  return legacyServiceRoleKey;
};

const notifySeller = async (
  order: { order_number: string; total_cents: number },
  customer: NonNullable<OrderRequest['customer']>,
  items: NonNullable<OrderRequest['items']>,
  supabaseAdmin: ReturnType<typeof createClient>,
): Promise<boolean> => {
  const serviceId = Deno.env.get('EMAILJS_SERVICE_ID');
  const templateId = Deno.env.get('EMAILJS_TEMPLATE_ID');
  const publicKey = Deno.env.get('EMAILJS_PUBLIC_KEY');
  const sellerEmail = Deno.env.get('SELLER_EMAIL');

  if (!serviceId || !templateId || !publicKey || !sellerEmail) {
    return false;
  }

  const variantIds = items
    .map((item) => Number(item.variantId))
    .filter((variantId) => Number.isFinite(variantId));

  const { data: variants } = await supabaseAdmin
    .from('product_variants')
    .select('id,size,products(name,color,price_cents)')
    .in('id', variantIds);

  const itemLines = items.map((item) => {
    const variant = (variants || []).find((row: any) => row.id === Number(item.variantId)) as any;
    const product = variant?.products;
    const quantity = Number(item.quantity || 0);
    const lineTotal = product ? (product.price_cents * quantity) / 100 : 0;

    return `• ${product?.name || 'Tee'} - ${product?.color || ''} (Taglia: ${variant?.size || ''}) x${quantity} - €${lineTotal.toFixed(2)}`;
  });

  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: {
          to_name: 'Venditore',
          to_email: sellerEmail,
          order_number: order.order_number,
          customer_name: `${customer.nome || ''} ${customer.cognome || ''}`.trim(),
          customer_phone: customer.telefono || '',
          customer_email: customer.email || 'Non indicata',
          order_items: itemLines.join('\n'),
          total_price: (order.total_cents / 100).toFixed(2),
          company_name: 'Late Night Hoop',
          pickup_method: 'Ritiro e pagamento esclusivamente presso lo stand',
          customization: 'Personalizzazione gratuita disponibile presso lo stand',
        },
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Email notification error:', error);
    return false;
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return jsonResponse({ ok: true });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Metodo non consentito.' }, 405);
  }

  try {
    const payload = (await req.json()) as OrderRequest;

    if (!payload.requestId || !payload.customer || !Array.isArray(payload.items)) {
      return jsonResponse({ error: 'Payload prenotazione non valido.' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL non disponibile.');
    }

    const supabaseAdmin = createClient(supabaseUrl, getAdminKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await supabaseAdmin.rpc('create_event_order', {
      p_request_id: payload.requestId,
      p_customer: payload.customer,
      p_items: payload.items.map((item) => ({
        variant_id: item.variantId,
        quantity: item.quantity,
      })),
    });

    if (error) {
      const message = error.message || 'Errore durante la prenotazione.';
      const conflict =
        message.toLowerCase().includes('disponibil') ||
        message.toLowerCase().includes('variante') ||
        message.toLowerCase().includes('chiuse');

      return jsonResponse({ error: message }, conflict ? 409 : 400);
    }

    const notificationSent = await notifySeller(
      data as { order_number: string; total_cents: number },
      payload.customer,
      payload.items,
      supabaseAdmin,
    );

    return jsonResponse({
      ...(data as Record<string, unknown>),
      notification_sent: notificationSent,
    });
  } catch (error) {
    console.error('create-order error:', error);
    const message = error instanceof Error ? error.message : 'Errore interno.';
    return jsonResponse({ error: message }, 500);
  }
});
