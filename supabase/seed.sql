insert into auth.users (id, email)
values ('00000000-0000-0000-0000-000000000101', 'seed-content@sudak-today.local')
on conflict (id) do update
set email = excluded.email;

insert into public.profiles (id, role, display_name)
values ('00000000-0000-0000-0000-000000000101', 'user', 'Seed Content')
on conflict (id) do update
set role = excluded.role,
    display_name = excluded.display_name;

insert into public.organizations (
  id,
  slug,
  name,
  description,
  status,
  type_id,
  address,
  phone,
  working_hours,
  contact_links,
  created_by,
  last_public_update_at
)
values
  (
    '21000000-0000-0000-0000-000000000001',
    'kafe-u-kiparisa',
    'Кафе "У кипариса"',
    'Небольшое семейное кафе рядом с набережной: завтраки, рыба, лимонады и быстрые обеды для прогулочного дня.',
    'active',
    (select id from public.organization_types where slug = 'food'),
    'ул. Набережная, 12',
    '+7 978 111-22-33',
    'Ежедневно 09:00-23:00',
    '{"telegram":"https://t.me/sudak_today_demo"}'::jsonb,
    '00000000-0000-0000-0000-000000000101',
    now() - interval '20 minutes'
  ),
  (
    '21000000-0000-0000-0000-000000000002',
    'dom-kultury-sudak',
    'Дом культуры Судака',
    'Городская площадка для концертов, выставок, детских программ и встреч жителей.',
    'active',
    (select id from public.organization_types where slug = 'culture'),
    'ул. Ленина, 39',
    '+7 365 662-10-45',
    'Пн-Сб 10:00-19:00',
    '{}'::jsonb,
    '00000000-0000-0000-0000-000000000101',
    now() - interval '1 hour'
  ),
  (
    '21000000-0000-0000-0000-000000000003',
    'more-prokat',
    'Прокат "Море рядом"',
    'Прокат велосипедов, сапбордов и пляжного инвентаря с выдачей у центрального пляжа.',
    'active',
    (select id from public.organization_types where slug = 'rental_entertainment'),
    'Кипарисовая аллея, 4',
    '+7 978 444-55-66',
    'Ежедневно 08:00-21:00',
    '{}'::jsonb,
    '00000000-0000-0000-0000-000000000101',
    now() - interval '2 hours'
  ),
  (
    '21000000-0000-0000-0000-000000000004',
    'akvarel-kids',
    'Студия "Акварель"',
    'Творческие занятия для детей: рисование, керамика, открытки и летние мастер-классы.',
    'active',
    (select id from public.organization_types where slug = 'kids'),
    'ул. Гагарина, 7',
    '+7 978 777-10-20',
    'Вт-Вс 11:00-18:00',
    '{}'::jsonb,
    '00000000-0000-0000-0000-000000000101',
    now() - interval '45 minutes'
  )
on conflict (id) do update
set slug = excluded.slug,
    name = excluded.name,
    description = excluded.description,
    status = excluded.status,
    type_id = excluded.type_id,
    address = excluded.address,
    phone = excluded.phone,
    working_hours = excluded.working_hours,
    contact_links = excluded.contact_links,
    last_public_update_at = excluded.last_public_update_at;

insert into public.publications (
  id,
  organization_id,
  author_id,
  slug,
  type,
  status,
  title,
  description,
  category_id,
  starts_at,
  ends_at,
  valid_until,
  published_at,
  place,
  price_text,
  is_free,
  age_limit,
  contact_phone,
  sort_published_at
)
values
  (
    '22000000-0000-0000-0000-000000000001',
    '21000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000101',
    'vecher-na-naberezhnoy',
    'event',
    'published',
    'Вечер музыки на набережной',
    'Открытый городской концерт с кавер-группой и короткой программой для детей перед началом.',
    (select id from public.publication_categories where slug = 'culture'),
    now() + interval '5 hours',
    now() + interval '7 hours',
    null,
    now() - interval '30 minutes',
    'Площадка у городского фонтана',
    'Бесплатно',
    true,
    null,
    '+7 365 662-10-45',
    now() - interval '30 minutes'
  ),
  (
    '22000000-0000-0000-0000-000000000002',
    '21000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000101',
    'zavtraki-do-poludnya',
    'promo',
    'published',
    'Завтраки до полудня со скидкой',
    'До конца недели в кафе действует специальная цена на сырники, омлеты и кофе к завтраку.',
    (select id from public.publication_categories where slug = 'food'),
    null,
    null,
    now() + interval '10 days',
    now() - interval '1 hour',
    'Кафе "У кипариса"',
    'от 250 ₽',
    false,
    null,
    '+7 978 111-22-33',
    now() - interval '1 hour'
  ),
  (
    '22000000-0000-0000-0000-000000000003',
    '21000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000101',
    'sap-prokat-utrom',
    'announcement',
    'published',
    'Утренний прокат сапбордов открыт',
    'С 8 утра доступны сапборды и спасательные жилеты. Перед выходом инструктор проводит короткий инструктаж.',
    (select id from public.publication_categories where slug = 'rental'),
    null,
    null,
    now() + interval '14 days',
    now() - interval '2 hours',
    'Центральный пляж, стойка проката',
    '600 ₽ / час',
    false,
    '12+',
    '+7 978 444-55-66',
    now() - interval '2 hours'
  ),
  (
    '22000000-0000-0000-0000-000000000004',
    '21000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000101',
    'master-klass-akvarel',
    'regular',
    'published',
    'Детский мастер-класс по акварели',
    'Занятие для детей 6-10 лет: рисуем открытку с видом на крепость. Материалы входят в стоимость.',
    (select id from public.publication_categories where slug = 'kids'),
    null,
    null,
    now() + interval '21 days',
    now() - interval '3 hours',
    'Студия "Акварель"',
    '500 ₽',
    false,
    '6+',
    '+7 978 777-10-20',
    now() - interval '3 hours'
  ),
  (
    '22000000-0000-0000-0000-000000000005',
    '21000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000101',
    'novaya-vystavka-foto',
    'news',
    'published',
    'Открылась фотовыставка о старом Судаке',
    'В малом зале показывают архивные фотографии улиц, дворов и набережной. Вход свободный в часы работы.',
    (select id from public.publication_categories where slug = 'culture'),
    null,
    null,
    null,
    now() - interval '4 hours',
    'Дом культуры Судака',
    'Бесплатно',
    true,
    null,
    '+7 365 662-10-45',
    now() - interval '4 hours'
  )
on conflict (id) do update
set organization_id = excluded.organization_id,
    author_id = excluded.author_id,
    slug = excluded.slug,
    type = excluded.type,
    status = excluded.status,
    title = excluded.title,
    description = excluded.description,
    category_id = excluded.category_id,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    valid_until = excluded.valid_until,
    published_at = excluded.published_at,
    place = excluded.place,
    price_text = excluded.price_text,
    is_free = excluded.is_free,
    age_limit = excluded.age_limit,
    contact_phone = excluded.contact_phone,
    sort_published_at = excluded.sort_published_at;

insert into public.publication_schedules (id, publication_id, schedule_text, weekday, starts_at, ends_at, sort_order)
values (
  '23000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000004',
  'Каждую среду и субботу в 12:00',
  null,
  '12:00',
  '13:30',
  10
)
on conflict (id) do update
set publication_id = excluded.publication_id,
    schedule_text = excluded.schedule_text,
    weekday = excluded.weekday,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    sort_order = excluded.sort_order;

insert into public.menu_categories (id, organization_id, name, description, sort_order, is_active)
values
  ('24000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', 'Завтраки', 'Утреннее меню кафе', 10, true),
  ('24000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000001', 'Напитки', 'Кофе, лимонады и чай', 20, true),
  ('24000000-0000-0000-0000-000000000003', '21000000-0000-0000-0000-000000000003', 'Прокат', 'Инвентарь на час и на день', 10, true),
  ('24000000-0000-0000-0000-000000000004', '21000000-0000-0000-0000-000000000004', 'Занятия', 'Разовые мастер-классы', 10, true)
on conflict (id) do update
set organization_id = excluded.organization_id,
    name = excluded.name,
    description = excluded.description,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active;

insert into public.menu_items (
  id,
  organization_id,
  category_id,
  title,
  description,
  price_text,
  is_available,
  sort_order
)
values
  ('25000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', '24000000-0000-0000-0000-000000000001', 'Сырники с ягодным соусом', 'Порция из трех сырников, сметана и сезонный соус.', '290 ₽', true, 10),
  ('25000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000001', '24000000-0000-0000-0000-000000000002', 'Холодный лимонад с мятой', 'Домашний лимонад, 400 мл.', '180 ₽', true, 20),
  ('25000000-0000-0000-0000-000000000003', '21000000-0000-0000-0000-000000000003', '24000000-0000-0000-0000-000000000003', 'Сапборд', 'Доска, весло и жилет. Инструктаж перед выходом.', '600 ₽ / час', true, 10),
  ('25000000-0000-0000-0000-000000000004', '21000000-0000-0000-0000-000000000004', '24000000-0000-0000-0000-000000000004', 'Мастер-класс по акварели', '90 минут, материалы включены.', '500 ₽', true, 10)
on conflict (id) do update
set organization_id = excluded.organization_id,
    category_id = excluded.category_id,
    title = excluded.title,
    description = excluded.description,
    price_text = excluded.price_text,
    is_available = excluded.is_available,
    sort_order = excluded.sort_order;

with demo_media (
  id,
  bucket_id,
  storage_path,
  purpose,
  visibility,
  organization_id,
  publication_id,
  menu_item_id,
  uploaded_by
) as (
  values
    ('27000000-0000-0000-0000-000000000001'::uuid, 'organization-images', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80', 'organization_cover'::public.media_asset_purpose, 'public'::public.media_asset_visibility, '21000000-0000-0000-0000-000000000001'::uuid, null::uuid, null::uuid, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000002'::uuid, 'organization-images', 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1200&q=80', 'organization_cover'::public.media_asset_purpose, 'public'::public.media_asset_visibility, '21000000-0000-0000-0000-000000000002'::uuid, null::uuid, null::uuid, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000003'::uuid, 'organization-images', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80', 'organization_cover'::public.media_asset_purpose, 'public'::public.media_asset_visibility, '21000000-0000-0000-0000-000000000003'::uuid, null::uuid, null::uuid, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000004'::uuid, 'organization-images', 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=80', 'organization_cover'::public.media_asset_purpose, 'public'::public.media_asset_visibility, '21000000-0000-0000-0000-000000000004'::uuid, null::uuid, null::uuid, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000101'::uuid, 'publication-images', 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80', 'publication_photo'::public.media_asset_purpose, 'public'::public.media_asset_visibility, null::uuid, '22000000-0000-0000-0000-000000000001'::uuid, null::uuid, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000102'::uuid, 'publication-images', 'https://images.unsplash.com/photo-1493770348161-369560ae357d?auto=format&fit=crop&w=1200&q=80', 'publication_photo'::public.media_asset_purpose, 'public'::public.media_asset_visibility, null::uuid, '22000000-0000-0000-0000-000000000002'::uuid, null::uuid, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000103'::uuid, 'publication-images', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80', 'publication_photo'::public.media_asset_purpose, 'public'::public.media_asset_visibility, null::uuid, '22000000-0000-0000-0000-000000000003'::uuid, null::uuid, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000104'::uuid, 'publication-images', 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=80', 'publication_photo'::public.media_asset_purpose, 'public'::public.media_asset_visibility, null::uuid, '22000000-0000-0000-0000-000000000004'::uuid, null::uuid, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000105'::uuid, 'publication-images', 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80', 'publication_photo'::public.media_asset_purpose, 'public'::public.media_asset_visibility, null::uuid, '22000000-0000-0000-0000-000000000005'::uuid, null::uuid, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000201'::uuid, 'menu-images', 'https://images.unsplash.com/photo-1495147466023-ac5c588e2e94?auto=format&fit=crop&w=1200&q=80', 'menu_item_photo'::public.media_asset_purpose, 'public'::public.media_asset_visibility, null::uuid, null::uuid, '25000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000101'::uuid)
)
insert into public.media_assets (
  id,
  bucket_id,
  storage_path,
  purpose,
  visibility,
  organization_id,
  publication_id,
  menu_item_id,
  uploaded_by
)
select
  id,
  bucket_id,
  storage_path,
  purpose,
  visibility,
  organization_id,
  publication_id,
  menu_item_id,
  uploaded_by
from demo_media media
where not exists (
  select 1
  from public.media_assets asset
  where asset.deleted_at is null
    and asset.purpose = media.purpose
    and (
      (media.organization_id is not null and asset.organization_id = media.organization_id)
      or (media.publication_id is not null and asset.publication_id = media.publication_id)
      or (media.menu_item_id is not null and asset.menu_item_id = media.menu_item_id)
    )
);

insert into public.important_announcements (
  id,
  status,
  title,
  description,
  publication_id,
  active_from,
  active_until,
  created_by
)
values (
  '26000000-0000-0000-0000-000000000001',
  'active',
  'Сегодня вечером перекроют часть набережной',
  'С 18:30 до 21:30 проход у фонтана будет занят городским концертом. Обход доступен через Кипарисовую аллею.',
  '22000000-0000-0000-0000-000000000001',
  now() - interval '1 hour',
  now() + interval '1 day',
  '00000000-0000-0000-0000-000000000101'
)
on conflict (id) do update
set status = excluded.status,
    title = excluded.title,
    description = excluded.description,
    publication_id = excluded.publication_id,
    active_from = excluded.active_from,
    active_until = excluded.active_until,
    created_by = excluded.created_by;
