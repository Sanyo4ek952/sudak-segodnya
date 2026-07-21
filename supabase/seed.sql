begin;

delete from public.important_announcements
where id in (
  '26000000-0000-0000-0000-000000000001'
);

delete from public.media_assets
where id in (
  '27000000-0000-0000-0000-000000000001',
  '27000000-0000-0000-0000-000000000002',
  '27000000-0000-0000-0000-000000000003',
  '27000000-0000-0000-0000-000000000004',
  '27000000-0000-0000-0000-000000000005',
  '27000000-0000-0000-0000-000000000006',
  '27000000-0000-0000-0000-000000000007',
  '27000000-0000-0000-0000-000000000008',
  '27000000-0000-0000-0000-000000000009',
  '27000000-0000-0000-0000-000000000010',
  '27000000-0000-0000-0000-000000000011',
  '27000000-0000-0000-0000-000000000012',
  '27000000-0000-0000-0000-000000000101',
  '27000000-0000-0000-0000-000000000102',
  '27000000-0000-0000-0000-000000000103',
  '27000000-0000-0000-0000-000000000104',
  '27000000-0000-0000-0000-000000000105',
  '27000000-0000-0000-0000-000000000106',
  '27000000-0000-0000-0000-000000000107',
  '27000000-0000-0000-0000-000000000108',
  '27000000-0000-0000-0000-000000000109',
  '27000000-0000-0000-0000-000000000110',
  '27000000-0000-0000-0000-000000000111',
  '27000000-0000-0000-0000-000000000112',
  '27000000-0000-0000-0000-000000000201',
  '27000000-0000-0000-0000-000000000202',
  '27000000-0000-0000-0000-000000000203',
  '27000000-0000-0000-0000-000000000204'
);

delete from public.publication_schedules
where id in (
  '23000000-0000-0000-0000-000000000001',
  '23000000-0000-0000-0000-000000000002',
  '23000000-0000-0000-0000-000000000003'
);

delete from public.menu_items
where id in (
  '25000000-0000-0000-0000-000000000001',
  '25000000-0000-0000-0000-000000000002',
  '25000000-0000-0000-0000-000000000003',
  '25000000-0000-0000-0000-000000000004',
  '25000000-0000-0000-0000-000000000005',
  '25000000-0000-0000-0000-000000000006',
  '25000000-0000-0000-0000-000000000007',
  '25000000-0000-0000-0000-000000000008'
);

delete from public.menu_categories
where id in (
  '24000000-0000-0000-0000-000000000001',
  '24000000-0000-0000-0000-000000000002',
  '24000000-0000-0000-0000-000000000003',
  '24000000-0000-0000-0000-000000000004',
  '24000000-0000-0000-0000-000000000005',
  '24000000-0000-0000-0000-000000000006',
  '24000000-0000-0000-0000-000000000007'
);

delete from public.publications
where id in (
  '22000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000002',
  '22000000-0000-0000-0000-000000000003',
  '22000000-0000-0000-0000-000000000004',
  '22000000-0000-0000-0000-000000000005',
  '22000000-0000-0000-0000-000000000006',
  '22000000-0000-0000-0000-000000000007',
  '22000000-0000-0000-0000-000000000008',
  '22000000-0000-0000-0000-000000000009',
  '22000000-0000-0000-0000-000000000010',
  '22000000-0000-0000-0000-000000000011',
  '22000000-0000-0000-0000-000000000012'
);

delete from public.organizations
where id in (
  '21000000-0000-0000-0000-000000000001',
  '21000000-0000-0000-0000-000000000002',
  '21000000-0000-0000-0000-000000000003',
  '21000000-0000-0000-0000-000000000004',
  '21000000-0000-0000-0000-000000000005',
  '21000000-0000-0000-0000-000000000006',
  '21000000-0000-0000-0000-000000000007',
  '21000000-0000-0000-0000-000000000008',
  '21000000-0000-0000-0000-000000000009'
);

delete from public.profiles
where id = '00000000-0000-0000-0000-000000000101';

delete from auth.users
where id = '00000000-0000-0000-0000-000000000101';

insert into public.organization_types (slug, name, description, sort_order, is_active)
values
  ('food', 'Рестораны и кафе', 'Кафе, рестораны, кофейни и места с быстрым перекусом.', 10, true),
  ('delivery', 'Доставка', 'Доставка еды, продуктов и локальных заказов.', 20, true),
  ('kids', 'Кружки и секции', 'Детские занятия, студии, кружки и спортивные секции.', 30, true),
  ('culture', 'Культура', 'Музеи, дома культуры, выставки и городские площадки.', 40, true),
  ('excursions', 'Экскурсии', 'Экскурсоводы, прогулки, маршруты и туры.', 50, true),
  ('rental_entertainment', 'Прокат и развлечения', 'Прокат, пляжные активности и городские развлечения.', 60, true),
  ('shops', 'Магазины', 'Магазины, лавки и локальные товары.', 70, true),
  ('services', 'Услуги', 'Полезные городские и бытовые сервисы.', 80, true),
  ('administration', 'Администрация', 'Городские учреждения и официальная информация.', 90, true)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active;

insert into public.publication_categories (slug, name, description, sort_order, is_active)
values
  ('city', 'Город', 'Важные городские объявления и полезная информация.', 10, true),
  ('kids', 'Детям', 'События, занятия и предложения для детей.', 20, true),
  ('food', 'Еда', 'Кафе, рестораны, доставка и специальные меню.', 30, true),
  ('culture', 'Культура', 'Концерты, выставки, музеи и городские программы.', 40, true),
  ('sport', 'Спорт и кружки', 'Тренировки, секции и регулярные активности.', 50, true),
  ('excursions', 'Экскурсии', 'Прогулки, маршруты и экскурсионные программы.', 60, true),
  ('rental', 'Прокат', 'Прокат инвентаря и сезонные развлечения.', 70, true),
  ('shops', 'Магазины', 'Локальные товары, магазины и лавки.', 80, true),
  ('services', 'Услуги', 'Сервисные предложения и полезная информация.', 90, true)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active;

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-000000000101', 'seed-content@sudak-today.local')
on conflict (id) do update
set email = excluded.email;

insert into public.profiles (id, role, display_name)
values ('00000000-0000-0000-0000-000000000101', 'user', 'Демо-редактор Судак Сегодня')
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
  latitude,
  longitude,
  created_by,
  last_public_update_at
)
values
  (
    '21000000-0000-0000-0000-000000000001',
    'kafe-u-kiparisa',
    'Кафе "У кипариса"',
    'Семейное кафе рядом с набережной: завтраки, свежая рыба, лимонады и быстрые обеды перед прогулкой по центру.',
    'active',
    (select id from public.organization_types where slug = 'food'),
    'ул. Набережная, 12',
    '+7 978 111-22-33',
    'Ежедневно 09:00-23:00',
    '{"telegram":"https://t.me/sudak_today_demo","website":"https://example.com/u-kiparisa"}'::jsonb,
    44.849128,
    34.974214,
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
    '{"website":"https://example.com/dk-sudak"}'::jsonb,
    44.851082,
    34.976391,
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
    '{"telegram":"https://t.me/sudak_today_demo"}'::jsonb,
    44.848551,
    34.975583,
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
    '{"telegram":"https://t.me/sudak_today_demo"}'::jsonb,
    44.853742,
    34.972761,
    '00000000-0000-0000-0000-000000000101',
    now() - interval '45 minutes'
  ),
  (
    '21000000-0000-0000-0000-000000000005',
    'sudak-krepost-museum',
    'Музей-заповедник "Судакская крепость"',
    'Историческая площадка с экскурсиями, вечерними прогулками и сезонными программами у стен крепости.',
    'active',
    (select id from public.organization_types where slug = 'culture'),
    'ул. Генуэзская крепость, 1',
    '+7 365 662-31-73',
    'Ежедневно 09:00-20:00',
    '{"website":"https://example.com/sudak-fortress"}'::jsonb,
    44.842998,
    34.958437,
    '00000000-0000-0000-0000-000000000101',
    now() - interval '35 minutes'
  ),
  (
    '21000000-0000-0000-0000-000000000006',
    'tropami-sudaka',
    'Экскурсионное бюро "Тропами Судака"',
    'Небольшие прогулки по городу, тропам к мысу Алчак и окрестностям Судака для жителей и гостей.',
    'active',
    (select id from public.organization_types where slug = 'excursions'),
    'Кипарисовая аллея, 10',
    '+7 978 222-40-50',
    'Ежедневно 10:00-19:00',
    '{"telegram":"https://t.me/sudak_today_demo"}'::jsonb,
    44.849463,
    34.976745,
    '00000000-0000-0000-0000-000000000101',
    now() - interval '55 minutes'
  ),
  (
    '21000000-0000-0000-0000-000000000007',
    'lavka-krymskie-podarki',
    'Лавка "Крымские подарки"',
    'Небольшой магазин с местным чаем, вареньем, открытками, керамикой и сувенирами от мастеров Судака.',
    'active',
    (select id from public.organization_types where slug = 'shops'),
    'ул. Ленина, 23',
    '+7 978 333-70-80',
    'Ежедневно 10:00-22:00',
    '{"website":"https://example.com/krymskie-podarki"}'::jsonb,
    44.850226,
    34.974896,
    '00000000-0000-0000-0000-000000000101',
    now() - interval '1 hour 25 minutes'
  ),
  (
    '21000000-0000-0000-0000-000000000008',
    'dostavka-mayak',
    'Доставка "Маяк"',
    'Доставка обедов, напитков и небольших заказов по центру Судака и к пляжам в течение дня.',
    'active',
    (select id from public.organization_types where slug = 'delivery'),
    'ул. Партизанская, 6',
    '+7 978 555-12-34',
    'Ежедневно 11:00-23:00',
    '{"telegram":"https://t.me/sudak_today_demo"}'::jsonb,
    44.852188,
    34.980228,
    '00000000-0000-0000-0000-000000000101',
    now() - interval '50 minutes'
  ),
  (
    '21000000-0000-0000-0000-000000000009',
    'klub-atlant',
    'Клуб движения "Атлант"',
    'Секции для детей и взрослых: утренние тренировки, растяжка и летние занятия на открытом воздухе.',
    'active',
    (select id from public.organization_types where slug = 'kids'),
    'ул. Коммунальная, 2',
    '+7 978 666-18-28',
    'Пн-Сб 08:00-20:00',
    '{"telegram":"https://t.me/sudak_today_demo"}'::jsonb,
    44.855328,
    34.970446,
    '00000000-0000-0000-0000-000000000101',
    now() - interval '1 hour 40 minutes'
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
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    created_by = excluded.created_by,
    last_public_update_at = excluded.last_public_update_at;

insert into public.organization_members (organization_id, user_id, role, is_active)
select id, '00000000-0000-0000-0000-000000000101', 'owner'::public.organization_member_role, true
from public.organizations
where id in (
  '21000000-0000-0000-0000-000000000001',
  '21000000-0000-0000-0000-000000000002',
  '21000000-0000-0000-0000-000000000003',
  '21000000-0000-0000-0000-000000000004',
  '21000000-0000-0000-0000-000000000005',
  '21000000-0000-0000-0000-000000000006',
  '21000000-0000-0000-0000-000000000007',
  '21000000-0000-0000-0000-000000000008',
  '21000000-0000-0000-0000-000000000009'
)
on conflict (organization_id, user_id) do update
set role = excluded.role,
    is_active = excluded.is_active;

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
    'vecher-muzyki-na-naberezhnoy',
    'event',
    'published',
    'Вечер музыки на набережной',
    'Открытый городской концерт с кавер-группой и короткой программой для детей перед началом.',
    (select id from public.publication_categories where slug = 'culture'),
    date_trunc('day', now()) + interval '19 hours',
    date_trunc('day', now()) + interval '21 hours',
    null,
    now() - interval '25 minutes',
    'Площадка у городского фонтана',
    'Бесплатно',
    true,
    null,
    '+7 365 662-10-45',
    now() - interval '25 minutes'
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
  ),
  (
    '22000000-0000-0000-0000-000000000006',
    '21000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000101',
    'zavtra-po-trope-alchak',
    'event',
    'published',
    'Завтра прогулка по тропе Алчак',
    'Маршрут вдоль моря с остановками у смотровых точек. Темп спокойный, нужна удобная обувь и вода.',
    (select id from public.publication_categories where slug = 'excursions'),
    date_trunc('day', now()) + interval '1 day 9 hours',
    date_trunc('day', now()) + interval '1 day 12 hours',
    null,
    now() - interval '50 minutes',
    'Сбор у начала Кипарисовой аллеи',
    '900 ₽',
    false,
    '10+',
    '+7 978 222-40-50',
    now() - interval '50 minutes'
  ),
  (
    '22000000-0000-0000-0000-000000000007',
    '21000000-0000-0000-0000-000000000008',
    '00000000-0000-0000-0000-000000000101',
    'besplatnaya-dostavka-do-plyazha',
    'promo',
    'published',
    'Бесплатная доставка к центральному пляжу',
    'Сегодня и завтра доставим обеды и напитки к центральному пляжу без доплаты при заказе от 800 ₽.',
    (select id from public.publication_categories where slug = 'food'),
    null,
    null,
    now() + interval '2 days',
    now() - interval '1 hour 15 minutes',
    'Доставка по центру и пляжной зоне',
    'Бесплатная доставка от 800 ₽',
    true,
    null,
    '+7 978 555-12-34',
    now() - interval '1 hour 15 minutes'
  ),
  (
    '22000000-0000-0000-0000-000000000008',
    '21000000-0000-0000-0000-000000000007',
    '00000000-0000-0000-0000-000000000101',
    'novaya-partiya-otkrytok',
    'announcement',
    'published',
    'Новая партия открыток с видами крепости',
    'В лавке появились открытки местных художников, магниты и небольшая керамика с морскими мотивами.',
    (select id from public.publication_categories where slug = 'shops'),
    null,
    null,
    now() + interval '30 days',
    now() - interval '1 hour 35 minutes',
    'Лавка "Крымские подарки"',
    'от 80 ₽',
    false,
    null,
    '+7 978 333-70-80',
    now() - interval '1 hour 35 minutes'
  ),
  (
    '22000000-0000-0000-0000-000000000009',
    '21000000-0000-0000-0000-000000000009',
    '00000000-0000-0000-0000-000000000101',
    'utrennyaya-zaryadka-u-morya',
    'regular',
    'published',
    'Утренняя зарядка у моря',
    'Легкая тренировка на свежем воздухе для взрослых и подростков. Подходит без специальной подготовки.',
    (select id from public.publication_categories where slug = 'sport'),
    null,
    null,
    now() + interval '28 days',
    now() - interval '2 hours 10 minutes',
    'Площадка рядом с центральным пляжем',
    'Бесплатно',
    true,
    '12+',
    '+7 978 666-18-28',
    now() - interval '2 hours 10 minutes'
  ),
  (
    '22000000-0000-0000-0000-000000000010',
    '21000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000101',
    'vechernyaya-ekskursiya-v-kreposti',
    'event',
    'cancelled',
    'Вечерняя экскурсия в крепости отменена',
    'Экскурсия отменена из-за сильного ветра. Купленные билеты можно перенести на ближайшую дневную программу.',
    (select id from public.publication_categories where slug = 'culture'),
    date_trunc('day', now()) + interval '1 day 18 hours',
    date_trunc('day', now()) + interval '1 day 20 hours',
    null,
    now() - interval '2 hours 40 minutes',
    'Судакская крепость',
    'Билеты переносятся',
    false,
    '6+',
    '+7 365 662-31-73',
    now() - interval '2 hours 40 minutes'
  ),
  (
    '22000000-0000-0000-0000-000000000011',
    '21000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000101',
    'krepost-prodlila-vechernie-chasy',
    'news',
    'published',
    'Крепость продлила вечерние часы',
    'До конца месяца кассы и основной маршрут работают на час дольше по пятницам и субботам.',
    (select id from public.publication_categories where slug = 'culture'),
    null,
    null,
    null,
    now() - interval '3 hours 20 minutes',
    'Судакская крепость',
    'Вход по обычному билету',
    false,
    null,
    '+7 365 662-31-73',
    now() - interval '3 hours 20 minutes'
  ),
  (
    '22000000-0000-0000-0000-000000000012',
    '21000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000101',
    'velosipedy-na-vecher',
    'promo',
    'published',
    'Вечерний прокат велосипедов дешевле',
    'После 18:00 действует сниженная цена на городские велосипеды для прогулки по набережной.',
    (select id from public.publication_categories where slug = 'rental'),
    null,
    null,
    now() + interval '12 days',
    now() - interval '3 hours 50 minutes',
    'Прокат "Море рядом"',
    '350 ₽ / час',
    false,
    '14+',
    '+7 978 444-55-66',
    now() - interval '3 hours 50 minutes'
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
values
  (
    '23000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000004',
    'Каждую среду и субботу в 12:00',
    null,
    '12:00',
    '13:30',
    10
  ),
  (
    '23000000-0000-0000-0000-000000000002',
    '22000000-0000-0000-0000-000000000009',
    'Понедельник, среда и пятница в 08:30',
    null,
    '08:30',
    '09:15',
    10
  ),
  (
    '23000000-0000-0000-0000-000000000003',
    '22000000-0000-0000-0000-000000000009',
    'Суббота в 09:00',
    6,
    '09:00',
    '09:45',
    20
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
  ('24000000-0000-0000-0000-000000000004', '21000000-0000-0000-0000-000000000004', 'Занятия', 'Разовые мастер-классы', 10, true),
  ('24000000-0000-0000-0000-000000000005', '21000000-0000-0000-0000-000000000005', 'Экскурсии', 'Билеты и прогулки по территории', 10, true),
  ('24000000-0000-0000-0000-000000000006', '21000000-0000-0000-0000-000000000008', 'Доставка', 'Популярные позиции для пляжа и прогулок', 10, true),
  ('24000000-0000-0000-0000-000000000007', '21000000-0000-0000-0000-000000000009', 'Тренировки', 'Разовые занятия и абонементы', 10, true)
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
  ('25000000-0000-0000-0000-000000000004', '21000000-0000-0000-0000-000000000004', '24000000-0000-0000-0000-000000000004', 'Мастер-класс по акварели', '90 минут, материалы включены.', '500 ₽', true, 10),
  ('25000000-0000-0000-0000-000000000005', '21000000-0000-0000-0000-000000000005', '24000000-0000-0000-0000-000000000005', 'Входной билет', 'Самостоятельная прогулка по основному маршруту крепости.', '350 ₽', true, 10),
  ('25000000-0000-0000-0000-000000000006', '21000000-0000-0000-0000-000000000008', '24000000-0000-0000-0000-000000000006', 'Обед к пляжу', 'Салат, горячее блюдо и напиток в удобной упаковке.', 'от 520 ₽', true, 10),
  ('25000000-0000-0000-0000-000000000007', '21000000-0000-0000-0000-000000000009', '24000000-0000-0000-0000-000000000007', 'Разовая тренировка', 'Утренняя группа на улице или вечерняя тренировка в зале.', '400 ₽', true, 10),
  ('25000000-0000-0000-0000-000000000008', '21000000-0000-0000-0000-000000000007', null, 'Набор открыток "Судак у моря"', 'Пять открыток с видами крепости, набережной и кипарисовой аллеи.', '320 ₽', true, 10)
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
  alt_text,
  width,
  height,
  sort_order,
  uploaded_by
) as (
  values
    ('27000000-0000-0000-0000-000000000001'::uuid, 'organization-images', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80', 'organization_cover'::public.media_asset_purpose, 'public'::public.media_asset_visibility, '21000000-0000-0000-0000-000000000001'::uuid, null::uuid, null::uuid, 'Столики семейного кафе у окна', 1200, 800, 10, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000002'::uuid, 'organization-images', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=400&q=80', 'organization_logo'::public.media_asset_purpose, 'public'::public.media_asset_visibility, '21000000-0000-0000-0000-000000000001'::uuid, null::uuid, null::uuid, 'Логотип кафе У кипариса', 400, 400, 0, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000003'::uuid, 'organization-images', 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1200&q=80', 'organization_cover'::public.media_asset_purpose, 'public'::public.media_asset_visibility, '21000000-0000-0000-0000-000000000002'::uuid, null::uuid, null::uuid, 'Сцена с вечерним светом перед концертом', 1200, 800, 10, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000004'::uuid, 'organization-images', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80', 'organization_cover'::public.media_asset_purpose, 'public'::public.media_asset_visibility, '21000000-0000-0000-0000-000000000003'::uuid, null::uuid, null::uuid, 'Пляж и море рядом с прокатом', 1200, 800, 10, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000005'::uuid, 'organization-images', 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=80', 'organization_cover'::public.media_asset_purpose, 'public'::public.media_asset_visibility, '21000000-0000-0000-0000-000000000004'::uuid, null::uuid, null::uuid, 'Кисти и краски на столе детской студии', 1200, 800, 10, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000006'::uuid, 'organization-images', 'https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=1200&q=80', 'organization_cover'::public.media_asset_purpose, 'public'::public.media_asset_visibility, '21000000-0000-0000-0000-000000000005'::uuid, null::uuid, null::uuid, 'Каменные стены исторической крепости', 1200, 800, 10, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000007'::uuid, 'organization-images', 'https://images.unsplash.com/photo-1544984243-ec57ea16fe25?auto=format&fit=crop&w=400&q=80', 'organization_logo'::public.media_asset_purpose, 'public'::public.media_asset_visibility, '21000000-0000-0000-0000-000000000005'::uuid, null::uuid, null::uuid, 'Знак музея-заповедника', 400, 400, 0, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000008'::uuid, 'organization-images', 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80', 'organization_cover'::public.media_asset_purpose, 'public'::public.media_asset_visibility, '21000000-0000-0000-0000-000000000006'::uuid, null::uuid, null::uuid, 'Пешеходная тропа у моря', 1200, 800, 10, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000009'::uuid, 'organization-images', 'https://images.unsplash.com/photo-1512909006721-3d6018887383?auto=format&fit=crop&w=1200&q=80', 'organization_cover'::public.media_asset_purpose, 'public'::public.media_asset_visibility, '21000000-0000-0000-0000-000000000007'::uuid, null::uuid, null::uuid, 'Полка с локальными сувенирами', 1200, 800, 10, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000010'::uuid, 'organization-images', 'https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=1200&q=80', 'organization_cover'::public.media_asset_purpose, 'public'::public.media_asset_visibility, '21000000-0000-0000-0000-000000000008'::uuid, null::uuid, null::uuid, 'Курьер с бумажным пакетом доставки', 1200, 800, 10, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000011'::uuid, 'organization-images', 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=80', 'organization_cover'::public.media_asset_purpose, 'public'::public.media_asset_visibility, '21000000-0000-0000-0000-000000000009'::uuid, null::uuid, null::uuid, 'Групповая тренировка в зале', 1200, 800, 10, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000012'::uuid, 'organization-images', 'https://images.unsplash.com/photo-1571019613914-85f342c6a11e?auto=format&fit=crop&w=400&q=80', 'organization_logo'::public.media_asset_purpose, 'public'::public.media_asset_visibility, '21000000-0000-0000-0000-000000000009'::uuid, null::uuid, null::uuid, 'Логотип клуба движения Атлант', 400, 400, 0, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000101'::uuid, 'publication-images', 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80', 'publication_photo'::public.media_asset_purpose, 'public'::public.media_asset_visibility, null::uuid, '22000000-0000-0000-0000-000000000001'::uuid, null::uuid, 'Музыканты на вечернем концерте', 1200, 800, 10, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000102'::uuid, 'publication-images', 'https://images.unsplash.com/photo-1493770348161-369560ae357d?auto=format&fit=crop&w=1200&q=80', 'publication_photo'::public.media_asset_purpose, 'public'::public.media_asset_visibility, null::uuid, '22000000-0000-0000-0000-000000000002'::uuid, null::uuid, 'Завтрак с кофе и выпечкой', 1200, 800, 10, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000103'::uuid, 'publication-images', 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=1200&q=80', 'publication_photo'::public.media_asset_purpose, 'public'::public.media_asset_visibility, null::uuid, '22000000-0000-0000-0000-000000000003'::uuid, null::uuid, 'Сапборд на спокойной воде', 1200, 800, 10, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000104'::uuid, 'publication-images', 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=80', 'publication_photo'::public.media_asset_purpose, 'public'::public.media_asset_visibility, null::uuid, '22000000-0000-0000-0000-000000000004'::uuid, null::uuid, 'Акварельные краски и кисти', 1200, 800, 10, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000105'::uuid, 'publication-images', 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80', 'publication_photo'::public.media_asset_purpose, 'public'::public.media_asset_visibility, null::uuid, '22000000-0000-0000-0000-000000000005'::uuid, null::uuid, 'Фотокамера и распечатанные снимки', 1200, 800, 10, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000106'::uuid, 'publication-images', 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80', 'publication_photo'::public.media_asset_purpose, 'public'::public.media_asset_visibility, null::uuid, '22000000-0000-0000-0000-000000000006'::uuid, null::uuid, 'Тропа у моря на рассвете', 1200, 800, 10, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000107'::uuid, 'publication-images', 'https://images.unsplash.com/photo-1600891964599-f61ba0e24092?auto=format&fit=crop&w=1200&q=80', 'publication_photo'::public.media_asset_purpose, 'public'::public.media_asset_visibility, null::uuid, '22000000-0000-0000-0000-000000000007'::uuid, null::uuid, 'Готовый обед в контейнерах', 1200, 800, 10, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000108'::uuid, 'publication-images', 'https://images.unsplash.com/photo-1512909006721-3d6018887383?auto=format&fit=crop&w=1200&q=80', 'publication_photo'::public.media_asset_purpose, 'public'::public.media_asset_visibility, null::uuid, '22000000-0000-0000-0000-000000000008'::uuid, null::uuid, 'Открытки и сувениры на полке', 1200, 800, 10, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000109'::uuid, 'publication-images', 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=80', 'publication_photo'::public.media_asset_purpose, 'public'::public.media_asset_visibility, null::uuid, '22000000-0000-0000-0000-000000000009'::uuid, null::uuid, 'Утренняя тренировка в группе', 1200, 800, 10, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000110'::uuid, 'publication-images', 'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1200&q=80', 'publication_photo'::public.media_asset_purpose, 'public'::public.media_asset_visibility, null::uuid, '22000000-0000-0000-0000-000000000010'::uuid, null::uuid, 'Каменная крепость на холме', 1200, 800, 10, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000111'::uuid, 'publication-images', 'https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=1200&q=80', 'publication_photo'::public.media_asset_purpose, 'public'::public.media_asset_visibility, null::uuid, '22000000-0000-0000-0000-000000000011'::uuid, null::uuid, 'Исторические стены крепости днем', 1200, 800, 10, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000112'::uuid, 'publication-images', 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=1200&q=80', 'publication_photo'::public.media_asset_purpose, 'public'::public.media_asset_visibility, null::uuid, '22000000-0000-0000-0000-000000000012'::uuid, null::uuid, 'Велосипеды в прокате', 1200, 800, 10, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000201'::uuid, 'menu-images', 'https://images.unsplash.com/photo-1495147466023-ac5c588e2e94?auto=format&fit=crop&w=1200&q=80', 'menu_item_photo'::public.media_asset_purpose, 'public'::public.media_asset_visibility, null::uuid, null::uuid, '25000000-0000-0000-0000-000000000001'::uuid, 'Сырники с ягодным соусом', 1200, 800, 10, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000202'::uuid, 'menu-images', 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=1200&q=80', 'menu_item_photo'::public.media_asset_purpose, 'public'::public.media_asset_visibility, null::uuid, null::uuid, '25000000-0000-0000-0000-000000000002'::uuid, 'Домашний лимонад с мятой', 1200, 800, 20, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000203'::uuid, 'menu-images', 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=1200&q=80', 'menu_item_photo'::public.media_asset_purpose, 'public'::public.media_asset_visibility, null::uuid, null::uuid, '25000000-0000-0000-0000-000000000003'::uuid, 'Сапборд с веслом', 1200, 800, 10, '00000000-0000-0000-0000-000000000101'::uuid),
    ('27000000-0000-0000-0000-000000000204'::uuid, 'menu-images', 'https://images.unsplash.com/photo-1600891964599-f61ba0e24092?auto=format&fit=crop&w=1200&q=80', 'menu_item_photo'::public.media_asset_purpose, 'public'::public.media_asset_visibility, null::uuid, null::uuid, '25000000-0000-0000-0000-000000000006'::uuid, 'Обед в доставке', 1200, 800, 10, '00000000-0000-0000-0000-000000000101'::uuid)
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
  alt_text,
  width,
  height,
  sort_order,
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
  alt_text,
  width,
  height,
  sort_order,
  uploaded_by
from demo_media
on conflict (id) do update
set bucket_id = excluded.bucket_id,
    storage_path = excluded.storage_path,
    purpose = excluded.purpose,
    visibility = excluded.visibility,
    organization_id = excluded.organization_id,
    publication_id = excluded.publication_id,
    menu_item_id = excluded.menu_item_id,
    alt_text = excluded.alt_text,
    width = excluded.width,
    height = excluded.height,
    sort_order = excluded.sort_order,
    uploaded_by = excluded.uploaded_by,
    deleted_at = null;

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
  'Сегодня вечером часть набережной будет занята концертом',
  'С 18:30 до 21:30 у городского фонтана пройдет концерт. Проход к морю сохранится через Кипарисовую аллею.',
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

commit;
