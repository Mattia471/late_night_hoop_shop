create extension if not exists pgcrypto;

alter table public.orders
  add column if not exists pickup_token text;

alter table public.orders
  add column if not exists collected_at timestamptz;

update public.orders
set pickup_token = encode(gen_random_bytes(24), 'hex')
where pickup_token is null;

alter table public.orders
  alter column pickup_token set default encode(gen_random_bytes(24), 'hex');

alter table public.orders
  alter column pickup_token set not null;

create unique index if not exists orders_pickup_token_uidx
  on public.orders(pickup_token);

create or replace function public.create_event_order(
  p_request_id uuid,
  p_customer jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_pickup_token text;
  v_name text := trim(coalesce(p_customer ->> 'nome', ''));
  v_surname text := trim(coalesce(p_customer ->> 'cognome', ''));
  v_phone text := trim(coalesce(p_customer ->> 'telefono', ''));
  v_phone_digits text;
  v_email text := nullif(trim(coalesce(p_customer ->> 'email', '')), '');
  v_total_cents integer := 0;
  v_recent_orders integer := 0;
  v_reservation_open boolean;
  v_item record;
  v_variant record;
  v_existing jsonb;
begin
  if p_request_id is null then
    raise exception 'Request ID mancante.';
  end if;

  select jsonb_build_object(
    'order_id', o.id,
    'order_number', o.order_number,
    'total_cents', o.total_cents,
    'pickup_token', o.pickup_token
  )
  into v_existing
  from public.orders as o
  where o.request_id = p_request_id;

  if v_existing is not null then
    return v_existing;
  end if;

  select es.reservation_open
  into v_reservation_open
  from public.event_settings as es
  where es.id = 1;

  if coalesce(v_reservation_open, false) = false then
    raise exception 'Le prenotazioni sono attualmente chiuse.';
  end if;

  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'Nome non valido.';
  end if;

  if char_length(v_surname) < 1 or char_length(v_surname) > 80 then
    raise exception 'Cognome non valido.';
  end if;

  v_phone_digits := regexp_replace(v_phone, '[^0-9]', '', 'g');
  if char_length(v_phone_digits) < 8 or char_length(v_phone) > 40 then
    raise exception 'Numero di telefono non valido.';
  end if;

  if v_email is not null and char_length(v_email) > 255 then
    raise exception 'Email non valida.';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La prenotazione non contiene prodotti.';
  end if;

  if jsonb_array_length(p_items) > 10 then
    raise exception 'Troppe varianti nella stessa prenotazione.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as raw_item(variant_id bigint, quantity integer)
    where raw_item.variant_id is null
       or raw_item.quantity is null
       or raw_item.quantity <= 0
  ) then
    raise exception 'Quantità o variante non valida.';
  end if;

  select count(*)::integer
  into v_recent_orders
  from public.orders as recent_order
  where regexp_replace(recent_order.customer_phone, '[^0-9]', '', 'g') = v_phone_digits
    and recent_order.status = 'reserved'
    and recent_order.created_at > now() - interval '15 minutes';

  if v_recent_orders >= 3 then
    raise exception 'Hai già inviato diverse prenotazioni. Attendi qualche minuto prima di riprovare.';
  end if;

  v_order_number :=
    'LNH-' ||
    to_char(clock_timestamp(), 'YYMMDDHH24MISS') ||
    '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

  insert into public.orders (
    request_id,
    order_number,
    customer_name,
    customer_surname,
    customer_phone,
    customer_email,
    total_cents,
    status,
    pickup_method,
    personalization_free
  ) values (
    p_request_id,
    v_order_number,
    v_name,
    v_surname,
    v_phone,
    v_email,
    0,
    'reserved',
    'Ritiro e pagamento esclusivamente presso lo stand',
    true
  )
  returning id, pickup_token into v_order_id, v_pickup_token;

  for v_item in
    select parsed.variant_id, sum(parsed.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as parsed(variant_id bigint, quantity integer)
    group by parsed.variant_id
    order by parsed.variant_id
  loop
    select
      variant.id,
      variant.stock,
      variant.size,
      product.name,
      product.color,
      product.price_cents
    into v_variant
    from public.product_variants as variant
    join public.products as product on product.id = variant.product_id
    where variant.id = v_item.variant_id
      and variant.active = true
      and product.active = true
    for update of variant;

    if not found then
      raise exception 'Una delle varianti selezionate non è più disponibile.';
    end if;

    if v_variant.stock < v_item.quantity then
      raise exception 'Disponibilità insufficiente per % / taglia %. Rimangono % pezzi.',
        v_variant.color,
        v_variant.size,
        v_variant.stock;
    end if;

    update public.product_variants
    set stock = stock - v_item.quantity
    where id = v_variant.id;

    insert into public.order_items (
      order_id,
      product_variant_id,
      product_name,
      color,
      size,
      quantity,
      unit_price_cents
    ) values (
      v_order_id,
      v_variant.id,
      v_variant.name,
      v_variant.color,
      v_variant.size,
      v_item.quantity,
      v_variant.price_cents
    );

    v_total_cents := v_total_cents + (v_variant.price_cents * v_item.quantity);
  end loop;

  update public.orders
  set total_cents = v_total_cents
  where id = v_order_id;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total_cents', v_total_cents,
    'pickup_token', v_pickup_token
  );
end;
$$;

revoke all on function public.create_event_order(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_event_order(uuid, jsonb, jsonb) to service_role;

create or replace function public.collect_event_order(
  p_pickup_token text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  if p_pickup_token is null or char_length(trim(p_pickup_token)) < 20 then
    raise exception 'QR di ritiro non valido.';
  end if;

  select *
  into v_order
  from public.orders
  where pickup_token = trim(p_pickup_token)
  for update;

  if not found then
    raise exception 'Prenotazione non trovata.';
  end if;

  if v_order.status = 'cancelled' then
    raise exception 'La prenotazione è stata annullata.';
  end if;

  if v_order.status = 'collected' then
    return jsonb_build_object(
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'status', v_order.status,
      'collected_at', v_order.collected_at
    );
  end if;

  update public.orders
  set
    status = 'collected',
    collected_at = now()
  where id = v_order.id;

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'status', 'collected',
    'collected_at', now()
  );
end;
$$;

revoke all on function public.collect_event_order(text) from public, anon, authenticated;
grant execute on function public.collect_event_order(text) to service_role;
