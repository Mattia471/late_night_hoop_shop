create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.event_settings (
  id smallint primary key default 1 check (id = 1),
  event_name text not null,
  event_instagram_handle text not null,
  event_instagram_url text not null,
  developer_instagram_handle text not null,
  developer_instagram_url text not null,
  pickup_copy text not null,
  customization_copy text not null,
  reservation_open boolean not null default true,
  initial_stock integer not null default 35 check (initial_stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id bigint primary key,
  slug text not null unique,
  name text not null,
  color text not null check (color in ('Black', 'White')),
  price_cents integer not null check (price_cents >= 0),
  images text[] not null default '{}',
  description text not null default '',
  badge text,
  customizable boolean not null default true,
  active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id bigint primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  size text not null check (size in ('S', 'M', 'L', 'XL', 'XXL')),
  stock integer not null check (stock >= 0),
  active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  order_number text not null unique,
  customer_name text not null,
  customer_surname text not null,
  customer_phone text not null,
  customer_email text,
  total_cents integer not null default 0 check (total_cents >= 0),
  status text not null default 'reserved' check (status in ('reserved', 'collected', 'cancelled')),
  pickup_method text not null default 'Ritiro e pagamento presso lo stand',
  personalization_free boolean not null default true,
  pickup_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  collected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_variant_id bigint not null references public.product_variants(id),
  product_name text not null,
  color text not null,
  size text not null,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  created_at timestamptz not null default now(),
  unique (order_id, product_variant_id)
);

create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_phone_idx on public.orders(customer_phone);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists product_variants_product_id_idx on public.product_variants(product_id);

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.touch_updated_at() from public, anon, authenticated;

drop trigger if exists event_settings_touch_updated_at on public.event_settings;
create trigger event_settings_touch_updated_at
before update on public.event_settings
for each row execute function private.touch_updated_at();

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
before update on public.products
for each row execute function private.touch_updated_at();

drop trigger if exists product_variants_touch_updated_at on public.product_variants;
create trigger product_variants_touch_updated_at
before update on public.product_variants
for each row execute function private.touch_updated_at();

drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at
before update on public.orders
for each row execute function private.touch_updated_at();

create or replace function private.handle_order_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'Una prenotazione annullata non può essere riaperta.';
  end if;

  if old.status = 'collected' and new.status <> 'collected' then
    raise exception 'Una prenotazione già ritirata non può cambiare stato.';
  end if;

  if old.status = 'reserved' and new.status = 'cancelled' then
    update public.product_variants as variant
    set stock = variant.stock + item.quantity
    from public.order_items as item
    where item.order_id = new.id
      and item.product_variant_id = variant.id;
  end if;

  return new;
end;
$$;

revoke all on function private.handle_order_status_transition() from public, anon, authenticated;

drop trigger if exists orders_status_transition on public.orders;
create trigger orders_status_transition
before update of status on public.orders
for each row execute function private.handle_order_status_transition();

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

revoke all on function public.create_event_order(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_event_order(uuid, jsonb, jsonb) to service_role;

alter table public.event_settings enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists event_settings_public_read on public.event_settings;
create policy event_settings_public_read
on public.event_settings
for select
to anon, authenticated
using (id = 1);

drop policy if exists products_public_read on public.products;
create policy products_public_read
on public.products
for select
to anon, authenticated
using (active = true);

drop policy if exists product_variants_public_read on public.product_variants;
create policy product_variants_public_read
on public.product_variants
for select
to anon, authenticated
using (
  active = true
  and exists (
    select 1
    from public.products as product
    where product.id = product_variants.product_id
      and product.active = true
  )
);

revoke all on table public.event_settings from anon, authenticated;
revoke all on table public.products from anon, authenticated;
revoke all on table public.product_variants from anon, authenticated;
revoke all on table public.orders from anon, authenticated;
revoke all on table public.order_items from anon, authenticated;

grant select on table public.event_settings to anon, authenticated;
grant select on table public.products to anon, authenticated;
grant select on table public.product_variants to anon, authenticated;

grant all on table public.event_settings to service_role;
grant all on table public.products to service_role;
grant all on table public.product_variants to service_role;
grant all on table public.orders to service_role;
grant all on table public.order_items to service_role;
grant usage, select on all sequences in schema public to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'product_variants'
     ) then
    execute 'alter publication supabase_realtime add table public.product_variants';
  end if;
end;
$$;


create or replace view public.order_admin_summary
with (security_invoker = true)
as
select
  o.id,
  o.order_number,
  o.status,
  o.customer_name,
  o.customer_surname,
  o.customer_phone,
  o.customer_email,
  o.total_cents,
  o.pickup_method,
  o.personalization_free,
  o.created_at,
  o.collected_at,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'product_name', oi.product_name,
        'color', oi.color,
        'size', oi.size,
        'quantity', oi.quantity,
        'unit_price_cents', oi.unit_price_cents
      )
      order by oi.id
    ) filter (where oi.id is not null),
    '[]'::jsonb
  ) as items
from public.orders o
left join public.order_items oi on oi.order_id = o.id
group by o.id;

revoke all on public.order_admin_summary from anon, authenticated;
