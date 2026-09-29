import { createClient } from 'npm:@supabase/supabase-js@^2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
return jsonResponse({
      ...(data as Record<string, unknown>),
      notification_sent: false,
    });
  } catch (error) {
    console.error('create-order error:', error);
    const message = error instanceof Error ? error.message : 'Errore interno.';
    return jsonResponse({ error: message }, 500);
  }
});
