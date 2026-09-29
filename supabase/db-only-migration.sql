-- Late Night Hoop v9 - DB only
-- Per database v7/v8 già esistente.

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
