-- Late Night Hoop v10
-- Vista di sola lettura per /orders.
-- Espone esclusivamente gli ordini reserved e NON espone telefono, email o pickup_token.

create or replace view public.pending_orders_public
with (security_invoker = true)
as
select
  o.order_number,
  o.customer_name,
  o.customer_surname,
  o.total_cents,
  o.created_at,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'product_name', oi.product_name,
        'color', oi.color,
        'size', oi.size,
        'quantity', oi.quantity
      )
      order by oi.id
    ) filter (where oi.id is not null),
    '[]'::jsonb
  ) as items
from public.orders o
left join public.order_items oi on oi.order_id = o.id
where o.status = 'reserved'
group by o.id;

revoke all on public.pending_orders_public from public, anon, authenticated;
grant select on public.pending_orders_public to anon, authenticated;

-- La view usa security_invoker, quindi servono SELECT sulle tabelle sottostanti.
-- Le policy RLS continuano a governare l'accesso.
grant select on public.orders to anon, authenticated;
grant select on public.order_items to anon, authenticated;

drop policy if exists "read reserved orders for public list" on public.orders;
create policy "read reserved orders for public list"
on public.orders
for select
to anon, authenticated
using (status = 'reserved');

drop policy if exists "read items of reserved orders for public list" on public.order_items;
create policy "read items of reserved orders for public list"
on public.order_items
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and o.status = 'reserved'
  )
);
