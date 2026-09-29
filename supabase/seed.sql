insert into public.event_settings (
  id,
  event_name,
  event_instagram_handle,
  event_instagram_url,
  developer_instagram_handle,
  developer_instagram_url,
  pickup_copy,
  customization_copy,
  reservation_open,
  initial_stock
) values (
  1,
  'Late Night Hoop',
  '@latenight_hoop',
  'https://www.instagram.com/latenight_hoop/',
  '@mattiacucuzza_',
  'https://www.instagram.com/mattiacucuzza_/',
  'Ritiro e pagamento esclusivamente presso lo stand',
  'Personalizzazione gratuita presso lo stand',
  true,
  35
)
on conflict (id) do update set
  event_name = excluded.event_name,
  event_instagram_handle = excluded.event_instagram_handle,
  event_instagram_url = excluded.event_instagram_url,
  developer_instagram_handle = excluded.developer_instagram_handle,
  developer_instagram_url = excluded.developer_instagram_url,
  pickup_copy = excluded.pickup_copy,
  customization_copy = excluded.customization_copy,
  reservation_open = excluded.reservation_open,
  initial_stock = excluded.initial_stock;

insert into public.products (
  id,
  slug,
  name,
  color,
  price_cents,
  images,
  description,
  badge,
  customizable,
  active,
  sort_order
) values
  (
    1,
    'lnh-chuck-boxy-fit-tee-white',
    'LNH x Chuck Boxy Fit Tee',
    'White',
    2000,
    array['/lnh-chuck-white-front.jpeg', '/lnh-chuck-white-back.jpeg'],
    'Boxy fit event tee. Personalizzazione gratuita direttamente presso lo stand LNH.',
    'EVENT DROP',
    true,
    true,
    1
  ),
  (
    2,
    'lnh-chuck-boxy-fit-tee-black',
    'LNH x Chuck Boxy Fit Tee',
    'Black',
    2000,
    array['/lnh-chuck-black-front.jpeg', '/lnh-chuck-black-back.jpeg'],
    'Boxy fit event tee. Personalizzazione gratuita direttamente presso lo stand LNH.',
    'EVENT DROP',
    true,
    true,
    2
  )
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  color = excluded.color,
  price_cents = excluded.price_cents,
  images = excluded.images,
  description = excluded.description,
  badge = excluded.badge,
  customizable = excluded.customizable,
  active = excluded.active,
  sort_order = excluded.sort_order;

-- IMPORTANTE: lo stock viene impostato solo alla prima creazione della variante.
-- Se riesegui questo seed dopo aver ricevuto prenotazioni, lo stock corrente NON viene resettato.
insert into public.product_variants (id, product_id, size, stock, active, sort_order) values
  (101, 1, 'S',   1, true, 1),
  (102, 1, 'M',   3, true, 2),
  (103, 1, 'L',   6, true, 3),
  (104, 1, 'XL',  5, true, 4),
  (105, 1, 'XXL', 2, true, 5),
  (201, 2, 'S',   2, true, 1),
  (202, 2, 'M',   3, true, 2),
  (203, 2, 'L',   6, true, 3),
  (204, 2, 'XL',  5, true, 4),
  (205, 2, 'XXL', 2, true, 5)
on conflict (id) do update set
  product_id = excluded.product_id,
  size = excluded.size,
  active = excluded.active,
  sort_order = excluded.sort_order;
