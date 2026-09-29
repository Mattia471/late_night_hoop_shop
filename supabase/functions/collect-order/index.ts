import { createClient } from 'npm:@supabase/supabase-js@^2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PickupRequest = {
  action?: 'status' | 'collect';
  pickupToken?: string;
  standPin?: string;
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
      // Fallback alla legacy service role key.
    }
  }

  const legacyServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!legacyServiceRoleKey) {
    throw new Error('Secret key Supabase non disponibile nella Edge Function.');
  }

  return legacyServiceRoleKey;
};

const mapOrder = (order: any) => ({
  orderNumber: order.order_number,
  status: order.status,
  totalCents: order.total_cents,
  customerName: order.customer_name,
  customerSurname: order.customer_surname,
  createdAt: order.created_at,
  collectedAt: order.collected_at,
  items: (order.order_items || []).map((item: any) => ({
    productName: item.product_name,
    color: item.color,
    size: item.size,
    quantity: item.quantity,
    unitPriceCents: item.unit_price_cents,
  })),
});

const loadOrder = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  pickupToken: string,
) => {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select(`
      order_number,
      status,
      total_cents,
      customer_name,
      customer_surname,
      created_at,
      collected_at,
      order_items (
        product_name,
        color,
        size,
        quantity,
        unit_price_cents
      )
    `)
    .eq('pickup_token', pickupToken)
    .maybeSingle();

  if (error) throw error;
  return data;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return jsonResponse({ ok: true });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Metodo non consentito.' }, 405);
  }

  try {
    const payload = (await req.json()) as PickupRequest;
    const pickupToken = payload.pickupToken?.trim();

    if (!pickupToken || pickupToken.length < 20) {
      return jsonResponse({ error: 'QR di ritiro non valido.' }, 400);
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

    if (payload.action === 'status') {
      const order = await loadOrder(supabaseAdmin, pickupToken);

      if (!order) {
        return jsonResponse({ error: 'Prenotazione non trovata.' }, 404);
      }

      return jsonResponse({ order: mapOrder(order) });
    }

    if (payload.action !== 'collect') {
      return jsonResponse({ error: 'Azione non valida.' }, 400);
    }

    const configuredPin = Deno.env.get('STAND_PICKUP_PIN');
    if (!configuredPin) {
      throw new Error('STAND_PICKUP_PIN non configurato.');
    }

    if (!payload.standPin || payload.standPin !== configuredPin) {
      return jsonResponse({ error: 'PIN stand non corretto.' }, 401);
    }

    const { error: collectError } = await supabaseAdmin.rpc('collect_event_order', {
      p_pickup_token: pickupToken,
    });

    if (collectError) {
      const message = collectError.message || 'Impossibile segnare la prenotazione come ritirata.';
      const status = message.toLowerCase().includes('annullata') ? 409 : 400;
      return jsonResponse({ error: message }, status);
    }

    const order = await loadOrder(supabaseAdmin, pickupToken);
    if (!order) {
      return jsonResponse({ error: 'Prenotazione non trovata.' }, 404);
    }

    return jsonResponse({ order: mapOrder(order) });
  } catch (error) {
    console.error('collect-order error:', error);
    const message = error instanceof Error ? error.message : 'Errore interno.';
    return jsonResponse({ error: message }, 500);
  }
});
