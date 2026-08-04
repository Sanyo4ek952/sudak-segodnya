-- Closed pilot queue verified on 2026-08-04. These rows are never public until an
-- administrator explicitly reviews them through review_content_candidate().

insert into public.content_sources (
  id, name, kind, url, canonical_url, trust_level, is_active,
  fetch_interval_minutes, next_check_at, notes
)
values
  (
    '60000000-0000-0000-0000-000000000001', 'Культура.РФ — афиша Судака', 'html',
    'https://www.culture.ru/afisha/respublika-krym-sudak',
    'https://www.culture.ru/afisha/respublika-krym-sudak', 'official', true, 1440, now(),
    'Федеральный портал. robots.txt проверен 2026-08-04: /afisha и /events не запрещены. Использовать только факты, собственный краткий пересказ и активную ссылку.'
  ),
  (
    '60000000-0000-0000-0000-000000000002', 'Арт-кластер «Таврида»', 'html',
    'https://tavrida.art/', 'https://tavrida.art/', 'official', true, 1440, now(),
    'Официальный сайт организатора. robots.txt проверен 2026-08-04: публичные /news и /races не запрещены. Извлекать только факты.'
  ),
  (
    '60000000-0000-0000-0000-000000000003', 'Аквапарк «Судак» — акции', 'html',
    'https://sudak-aquapark.com/actions/', 'https://sudak-aquapark.com/actions/', 'official', true, 1440, now(),
    'Официальный сайт. robots.txt проверен 2026-08-04: /actions не запрещён. Старые акции остаются в списке, поэтому актуальность брать только с детальной страницы.'
  ),
  (
    '60000000-0000-0000-0000-000000000004', 'Судакская городская библиотека', 'html',
    'https://libsudak.ru/', 'https://libsudak.ru/', 'partner', true, 4320, now(),
    'Официальный сайт учреждения. robots.txt проверен 2026-08-04: главная и новости не запрещены. Регулярные занятия публиковать только с явным будущим расписанием.'
  ),
  (
    '60000000-0000-0000-0000-000000000005', 'Академия «Меганом» — события', 'html',
    'https://events.tavrida.art/meganomvisit', 'https://events.tavrida.art/meganomvisit', 'official', true, 1440, now(),
    'Официальная событийная страница Тавриды. robots.txt проверен 2026-08-04: /meganomvisit не запрещён.'
  ),
  (
    '60000000-0000-0000-0000-000000000006', 'Судакский музей — прямой сайт', 'html',
    'https://sudakmuseum.ru/', 'https://sudakmuseum.ru/', 'discovery', false, 4320, now(),
    'Официальный домен возвращал HTTP 403 автоматическому клиенту 2026-08-04. Отключён; использовать предоставленные музеем страницы на Культура.РФ.'
  )
on conflict (id) do update
set name = excluded.name,
    notes = excluded.notes,
    updated_at = now();

insert into public.content_ingestion_runs (
  id, source_id, trigger, status, idempotency_key, started_at, finished_at,
  discovered_count, created_count, duplicate_count, failed_count
)
select
  ('61000000-0000-0000-0000-00000000000' || row_number() over (order by source.id))::uuid,
  source.id,
  'agent',
  'succeeded',
  'pilot-2026-08-04-' || source.id,
  now(), now(), 0, 0, 0, 0
from public.content_sources source
where source.id in (
  '60000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000002',
  '60000000-0000-0000-0000-000000000003',
  '60000000-0000-0000-0000-000000000004',
  '60000000-0000-0000-0000-000000000005'
)
on conflict (idempotency_key) do nothing;

with pilot_organizations (
  id, source_id, run_id, external_id, source_url, name_pattern,
  name, type_slug, description, address, phone, working_hours, evidence_excerpt, warnings
) as (
  values
    (
      '62000000-0000-0000-0000-000000000001'::uuid,
      '60000000-0000-0000-0000-000000000001'::uuid,
      '61000000-0000-0000-0000-000000000001'::uuid,
      'culture-institute-21574',
      'https://www.culture.ru/institutes/21574/muzei-zapovednik-sudakskaya-krepost',
      '%судакская крепость%', 'Музей-заповедник «Судакская крепость»', 'culture',
      'Историко-архитектурный музей-заповедник с оборонительными сооружениями и музейными экспозициями.',
      'Республика Крым, г. Судак, ул. Генуэзская Крепость, 1',
      '+7 (365) 663-61-23; +7 (365) 663-61-27', null,
      'Карточка учреждения содержит адрес, телефоны и описание музея-заповедника.',
      jsonb_build_array('График работы нужно подтвердить перед одобрением.')
    ),
    (
      '62000000-0000-0000-0000-000000000002'::uuid,
      '60000000-0000-0000-0000-000000000001'::uuid,
      '61000000-0000-0000-0000-000000000001'::uuid,
      'culture-institute-20286',
      'https://www.culture.ru/institutes/20286/sudakskii-istoricheskii-muzei',
      '%судакский исторический музей%', 'Судакский исторический музей', 'culture',
      'Исторический музей в бывшем особняке Функа с экспозицией об истории Судака.',
      'Республика Крым, г. Судак, ул. Набережная, 11', '+7 (365) 663-61-30', null,
      'Официальная карточка содержит адрес, телефон и описание действующей экспозиции.',
      jsonb_build_array('Проверьте, является ли музей отдельной организацией или филиалом музея-заповедника.', 'График работы не указан.')
    ),
    (
      '62000000-0000-0000-0000-000000000003'::uuid,
      '60000000-0000-0000-0000-000000000003'::uuid,
      '61000000-0000-0000-0000-000000000003'::uuid,
      'aquapark-sudak', 'https://sudak-aquapark.com/actions/',
      '%аквапарк%судак%', 'Аквапарк «Судак»', 'rental_entertainment',
      'Аквапарк публикует действующие цены, акции, аттракционы и правила посещения.',
      'Республика Крым, г. Судак, ул. Гагарина, 79',
      '+7 (978) 567-94-71; +7 (36566) 3-38-81', 'Ежедневно 10:00–18:00',
      'Официальная страница содержит адрес, телефоны, часы работы и акции 2026 года.',
      jsonb_build_array('Сайт сохраняет в списке истёкшие акции; проверяйте даты на детальной странице.')
    ),
    (
      '62000000-0000-0000-0000-000000000004'::uuid,
      '60000000-0000-0000-0000-000000000004'::uuid,
      '61000000-0000-0000-0000-000000000004'::uuid,
      'libsudak-main', 'https://libsudak.ru/',
      '%центральная%библиотека%', 'Судакская центральная городская библиотека им. В. П. Рыкова', 'culture',
      'Городская библиотека проводит выставки, кружки, викторины и культурные мероприятия.',
      '298000, г. Судак, ул. Гагарина, 3', '+7 (36566) 3-12-06', null,
      'Футер официального сайта содержит адрес, телефон и сведения об учреждении.',
      jsonb_build_array('Режим работы нужно подтвердить перед одобрением.')
    ),
    (
      '62000000-0000-0000-0000-000000000005'::uuid,
      '60000000-0000-0000-0000-000000000002'::uuid,
      '61000000-0000-0000-0000-000000000002'::uuid,
      'tavrida-meganom', 'https://tavrida.art/',
      '%меганом%', 'Академия творческих индустрий «Меганом»', 'culture',
      'Образовательная площадка арт-кластера «Таврида» для программ творческих индустрий.',
      'Республика Крым, городской округ Судак, бухта Капсель', '8 (800) 551-44-40', null,
      'Официальный сайт Тавриды содержит программы Академии в Судаке и контактный телефон.',
      jsonb_build_array('Точный почтовый адрес и режим работы нужно подтвердить.')
    )
), prepared as (
  select input.*, existing.id as existing_organization_id
  from pilot_organizations input
  left join lateral (
    select organization_record.id
    from public.organizations organization_record
    where lower(organization_record.name) like input.name_pattern
    order by organization_record.created_at
    limit 1
  ) existing on true
)
insert into public.content_candidates (
  id, source_id, run_id, action, status, payload, evidence, warnings,
  source_url, external_id, content_hash, normalized_fingerprint,
  duplicate_organization_id, source_excerpt
)
select
  prepared.id, prepared.source_id, prepared.run_id, 'create_organization',
  case when prepared.existing_organization_id is null then 'pending'::public.content_candidate_status else 'duplicate' end,
  jsonb_build_object(
    'kind', 'organization', 'name', prepared.name, 'typeSlug', prepared.type_slug,
    'description', prepared.description, 'address', prepared.address, 'phone', prepared.phone,
    'workingHours', prepared.working_hours, 'contactLinks', '[]'::jsonb
  ),
  jsonb_build_array(jsonb_build_object(
    'field', 'organization', 'excerpt', prepared.evidence_excerpt, 'sourceUrl', prepared.source_url
  )),
  prepared.warnings,
  prepared.source_url, prepared.external_id,
  encode(digest(prepared.external_id || '|pilot-v1', 'sha256'), 'hex'),
  encode(digest(lower(prepared.name) || '|' || coalesce(prepared.phone, ''), 'sha256'), 'hex'),
  prepared.existing_organization_id,
  prepared.evidence_excerpt
from prepared
on conflict (id) do nothing;

with pilot_publications (
  id, source_id, run_id, external_id, source_url, organization_candidate_id,
  organization_pattern, organization_name, publication_type, title, description,
  category_slug, starts_at, ends_at, valid_until, place, price_text, is_free,
  age_limit, contact_phone, evidence_excerpt, warnings
) as (
  values
    (
      '62000000-0000-0000-0000-000000000101'::uuid, '60000000-0000-0000-0000-000000000001'::uuid,
      '61000000-0000-0000-0000-000000000001'::uuid, 'culture-event-7086596',
      'https://www.culture.ru/events/7086596/odisseya-kapitana-blada-festival-yubileinykh-filmov-snimavshikhsya-v-sudake?location=russia',
      '62000000-0000-0000-0000-000000000002'::uuid, '%судакский исторический музей%', 'Судакский исторический музей',
      'event', 'Кинолекторий «Одиссея капитана Блада»',
      'Кинолекторий к 35-летию фильма с рассказом о съёмках на набережной Судака и в Новом Свете.',
      'culture', '2026-08-12T15:00:00+03:00'::timestamptz, null, null,
      'Судакский исторический музей, ул. Набережная, 11', 'Бесплатно', true, '12+', '+7 (365) 663-61-30',
      'Официальная карточка учреждения указывает 12 августа 2026 года; афиша Судака — начало в 15:00.',
      jsonb_build_array('Время окончания не указано; заполните его перед публикацией.')
    ),
    (
      '62000000-0000-0000-0000-000000000102'::uuid, '60000000-0000-0000-0000-000000000001'::uuid,
      '61000000-0000-0000-0000-000000000001'::uuid, 'culture-event-7086614',
      'https://www.culture.ru/events/7086614/po-sledam-minuvshikh-epokh?location=respublika-krym-sudak',
      '62000000-0000-0000-0000-000000000001'::uuid, '%судакская крепость%', 'Музей-заповедник «Судакская крепость»',
      'event', 'Лекция-экскурсия «По следам минувших эпох»',
      'Лекция-экскурсия ко Дню археолога об исследованиях и находках в Храме с аркадой.',
      'culture', '2026-08-14T10:15:00+03:00'::timestamptz, null, null,
      'Музей-заповедник «Судакская крепость», ул. Генуэзская Крепость, 1', 'Бесплатно', true, '12+', '+7 (365) 663-61-23',
      'Карточка сообщает дату 14 августа 2026 года, возраст 12+ и бесплатный вход; афиша показывает 10:15.',
      jsonb_build_array('Время окончания не указано; заполните его перед публикацией.')
    ),
    (
      '62000000-0000-0000-0000-000000000103'::uuid, '60000000-0000-0000-0000-000000000001'::uuid,
      '61000000-0000-0000-0000-000000000001'::uuid, 'culture-event-7086750',
      'https://www.culture.ru/events/7086750/flag-moego-gosudarstva?location=russia',
      '62000000-0000-0000-0000-000000000001'::uuid, '%судакская крепость%', 'Музей-заповедник «Судакская крепость»',
      'event', 'Акция «Флаг моего государства»',
      'Патриотическая акция ко Дню Государственного флага с тематическим оформлением, фотозоной и развёртыванием флага.',
      'culture', '2026-08-22T10:00:00+03:00'::timestamptz, null, null,
      'Барбакан Судакской крепости, ул. Генуэзская Крепость, 1', 'Бесплатно', true, '6+', '+7 (365) 663-61-23',
      'Карточка сообщает 22 августа 2026 года, 6+ и бесплатный вход; афиша показывает 10:00.',
      jsonb_build_array('Время окончания не указано; заполните его перед публикацией.')
    ),
    (
      '62000000-0000-0000-0000-000000000104'::uuid, '60000000-0000-0000-0000-000000000001'::uuid,
      '61000000-0000-0000-0000-000000000001'::uuid, 'culture-event-7086574',
      'https://www.culture.ru/events/7086574/noch-kino-2026?location=respublika-krym-sudak',
      '62000000-0000-0000-0000-000000000002'::uuid, '%судакский исторический музей%', 'Судакский исторический музей',
      'event', '«Ночь кино 2026»',
      'Акция к 80-летию кинотеатра «Чайка»: история кинотеатра, архивные фотографии и показы отечественных фильмов.',
      'culture', '2026-08-29T12:00:00+03:00'::timestamptz, null, null,
      'Судакский исторический музей, ул. Набережная, 11', 'Бесплатно', true, '12+', '+7 (365) 663-61-30',
      'Официальная карточка содержит дату 29 августа, бесплатный вход и программу; афиша показывает 12:00.',
      jsonb_build_array('Список фильмов и время окончания не указаны.')
    ),
    (
      '62000000-0000-0000-0000-000000000105'::uuid, '60000000-0000-0000-0000-000000000001'::uuid,
      '61000000-0000-0000-0000-000000000001'::uuid, 'culture-event-7086669',
      'https://www.culture.ru/events/7086669/svideteli-epokhi?location=krym-i-sevastopol',
      '62000000-0000-0000-0000-000000000001'::uuid, '%судакская крепость%', 'Музей-заповедник «Судакская крепость»',
      'event', 'Открытие выставки «Свидетели эпохи»',
      'Открытие выставки к 100-летию начала археологических исследований крепости с фондовыми находками разных эпох.',
      'culture', '2026-08-31T14:00:00+03:00'::timestamptz, null, null,
      'Музей-заповедник «Судакская крепость», ул. Генуэзская Крепость, 1', 'Бесплатно', true, '12+', '+7 (365) 663-61-23',
      'Прямая карточка указывает 31 августа 2026 года; афиша показывает начало в 14:00.',
      jsonb_build_array('Не указан срок работы выставки после открытия.', 'Время окончания открытия не указано.')
    ),
    (
      '62000000-0000-0000-0000-000000000106'::uuid, '60000000-0000-0000-0000-000000000001'::uuid,
      '61000000-0000-0000-0000-000000000001'::uuid, 'culture-event-6099868',
      'https://www.culture.ru/events/6099868/ekskursionnaya-programma-po-sledam-chetyrekh-epokh?location=respublika-krym-sudak',
      '62000000-0000-0000-0000-000000000001'::uuid, '%судакская крепость%', 'Музей-заповедник «Судакская крепость»',
      'regular', 'Экскурсионная программа «По следам четырёх эпох»',
      'Маршрут по византийскому, генуэзскому, османскому и российскому периодам истории крепости.',
      'excursions', null, null, '2026-10-25T23:59:59+03:00'::timestamptz,
      'Музей-заповедник «Судакская крепость», ул. Генуэзская Крепость, 1', 'от 100 ₽', false, '12+', '+7 (365) 663-61-23',
      'Карточка задаёт период до 25 октября 2026 года, возраст 12+ и цену от 100 рублей.',
      jsonb_build_array('Нет расписания отдельных сеансов; сохраняйте как черновик до подтверждения времени.')
    ),
    (
      '62000000-0000-0000-0000-000000000107'::uuid, '60000000-0000-0000-0000-000000000002'::uuid,
      '61000000-0000-0000-0000-000000000002'::uuid, 'tavrida-festival-2026',
      'https://tavrida.art/news/8d714f3e-14ee-4a5a-972a-656f4e5c1648',
      '62000000-0000-0000-0000-000000000005'::uuid, '%меганом%', 'Академия творческих индустрий «Меганом»',
      'event', 'Фестиваль молодого искусства «Таврида.АРТ»',
      'Фестиваль музыки, кино, изобразительного искусства и театра проходит 7–9 августа 2026 года.',
      'culture', null, null, null, 'Арт-кластер «Таврида», городской округ Судак', null, false, null, '8 (800) 551-44-40',
      'Официальная новость организатора подтверждает проведение фестиваля 7–9 августа 2026 года.',
      jsonb_build_array('Точное время начала, условия входа, цена и возраст не указаны; проверьте программу перед публикацией.')
    ),
    (
      '62000000-0000-0000-0000-000000000108'::uuid, '60000000-0000-0000-0000-000000000002'::uuid,
      '61000000-0000-0000-0000-000000000002'::uuid, 'tavrida-school-cinema-2026',
      'https://tavrida.art/races/letnyaya-shkola-kino-i-lyudi',
      '62000000-0000-0000-0000-000000000005'::uuid, '%меганом%', 'Академия творческих индустрий «Меганом»',
      'event', 'Летняя школа «Кино и люди»',
      'Конкурсная программа для специалистов кино, музыки, танца, дизайна и анимации проходит 30 августа–5 сентября 2026 года.',
      'culture', null, null, null, 'Арт-кластер «Таврида», г. Судак', null, false, null, '8 (800) 551-44-40',
      'Прямая страница программы указывает Судак и даты 30 августа–5 сентября 2026 года.',
      jsonb_build_array('Точное время, срок подачи заявок, стоимость и возраст не указаны.', 'Это конкурсная программа, а не свободное посещение.')
    ),
    (
      '62000000-0000-0000-0000-000000000109'::uuid, '60000000-0000-0000-0000-000000000002'::uuid,
      '61000000-0000-0000-0000-000000000002'::uuid, 'tavrida-two-seas-2026',
      'https://tavrida.art/news/72b75235-457d-46ca-9e61-45f7536350d5',
      '62000000-0000-0000-0000-000000000005'::uuid, '%меганом%', 'Академия творческих индустрий «Меганом»',
      'event', 'Программа «Музыка двух морей»',
      'Программа для музыкантов проходит 13–18 сентября 2026 года; регистрация заявлена до 14 августа.',
      'culture', null, null, null, 'Академия «Меганом», арт-кластер «Таврида», г. Судак', null, false, null, '8 (800) 551-44-40',
      'Официальная новость задаёт даты 13–18 сентября и окончание регистрации 14 августа 2026 года.',
      jsonb_build_array('Точное время, стоимость и возраст не указаны.', 'Ссылку регистрации через сокращатель нужно проверить вручную.')
    ),
    (
      '62000000-0000-0000-0000-000000000110'::uuid, '60000000-0000-0000-0000-000000000003'::uuid,
      '61000000-0000-0000-0000-000000000003'::uuid, 'aquapark-family-pass-2026',
      'https://sudak-aquapark.com/actions/abonement-semeynyy/',
      '62000000-0000-0000-0000-000000000003'::uuid, '%аквапарк%судак%', 'Аквапарк «Судак»',
      'promo', 'Семейный абонемент: три посещения со скидкой 20%',
      'Именной семейный абонемент даёт каждому указанному члену семьи три посещения со скидкой 20%.',
      'rental', null, null, '2026-09-30T23:59:59+03:00'::timestamptz,
      'Аквапарк «Судак», ул. Гагарина, 79', 'скидка 20%', false, null, '+7 (978) 567-94-71',
      'Детальная страница подтверждает скидку 20%, три посещения и срок до 30 сентября 2026 года.',
      jsonb_build_array('Итоговая стоимость абонемента не указана; сверяйте базовые цены.')
    ),
    (
      '62000000-0000-0000-0000-000000000111'::uuid, '60000000-0000-0000-0000-000000000003'::uuid,
      '61000000-0000-0000-0000-000000000003'::uuid, 'aquapark-birthday-2026',
      'https://sudak-aquapark.com/actions/aktsiya-imeninnikam-besplatno/',
      '62000000-0000-0000-0000-000000000003'::uuid, '%аквапарк%судак%', 'Аквапарк «Судак»',
      'promo', 'Специальная цена для именинников',
      'В день рождения указаны специальные тарифы: 2 200 ₽ для взрослых и 1 800 ₽ для детей ростом до 130 см; бесплатный вход относится только к жителям Крыма.',
      'rental', null, null, '2026-09-30T23:59:59+03:00'::timestamptz,
      'Аквапарк «Судак», ул. Гагарина, 79', '2 200 ₽ взрослым; 1 800 ₽ детям до 130 см', false, null, '+7 (978) 567-94-71',
      'Официальная страница содержит тарифы, необходимые документы и срок акции до 30 сентября 2026 года.',
      jsonb_build_array('Нельзя сокращать условие до «именинникам бесплатно»: бесплатный вход указан только для жителей Крыма.')
    ),
    (
      '62000000-0000-0000-0000-000000000112'::uuid, '60000000-0000-0000-0000-000000000005'::uuid,
      '61000000-0000-0000-0000-000000000005'::uuid, 'meganom-daily-visit',
      'https://events.tavrida.art/meganomvisit',
      '62000000-0000-0000-0000-000000000005'::uuid, '%меганом%', 'Академия творческих индустрий «Меганом»',
      'regular', 'Самостоятельное посещение Академии «Меганом»',
      'Однодневные самостоятельные визиты доступны ежедневно после регистрации и оформления цифрового пропуска.',
      'culture', null, null, null, 'Академия «Меганом», встреча на КПП-8', 'Бесплатно', true, '0+', '8 (800) 551-44-40',
      'Официальная страница указывает ежедневное бесплатное посещение, 0+ и обязательную предварительную регистрацию.',
      jsonb_build_array('Количество мест ограничено.', 'Нет конечной даты и расписания интервалов; источник нужно регулярно перепроверять.')
    )
), prepared as (
  select input.*, existing.id as existing_organization_id
  from pilot_publications input
  left join lateral (
    select organization_record.id
    from public.organizations organization_record
    where lower(organization_record.name) like input.organization_pattern
      and organization_record.status = 'active'
    order by organization_record.created_at
    limit 1
  ) existing on true
)
insert into public.content_candidates (
  id, source_id, run_id, depends_on_candidate_id, action, status, payload,
  evidence, warnings, source_url, external_id, content_hash, normalized_fingerprint,
  target_organization_id, source_excerpt
)
select
  prepared.id, prepared.source_id, prepared.run_id,
  case when prepared.existing_organization_id is null then prepared.organization_candidate_id else null end,
  'create_publication', 'pending',
  jsonb_build_object(
    'kind', 'publication',
    'organizationId', prepared.existing_organization_id,
    'organizationName', prepared.organization_name,
    'targetPublicationId', null,
    'type', prepared.publication_type,
    'title', prepared.title,
    'description', prepared.description,
    'categorySlug', prepared.category_slug,
    'startsAt', prepared.starts_at,
    'endsAt', prepared.ends_at,
    'validUntil', prepared.valid_until,
    'place', prepared.place,
    'priceText', prepared.price_text,
    'isFree', prepared.is_free,
    'ageLimit', prepared.age_limit,
    'contactPhone', prepared.contact_phone,
    'scheduleEntries', '[]'::jsonb,
    'imageSourceUrl', null
  ),
  jsonb_build_array(jsonb_build_object(
    'field', 'publication', 'excerpt', prepared.evidence_excerpt, 'sourceUrl', prepared.source_url
  )),
  prepared.warnings || case
    when prepared.existing_organization_id is null
      then jsonb_build_array('Публикация ожидает решения по новой организации.')
    else '[]'::jsonb
  end,
  prepared.source_url,
  prepared.external_id,
  encode(digest(prepared.external_id || '|pilot-v1', 'sha256'), 'hex'),
  encode(digest(lower(prepared.organization_name || '|' || prepared.title || '|' || coalesce(prepared.starts_at::text, prepared.valid_until::text, '')), 'sha256'), 'hex'),
  prepared.existing_organization_id,
  prepared.evidence_excerpt
from prepared
on conflict (id) do nothing;

update public.content_ingestion_runs run_record
set discovered_count = counts.total,
    created_count = counts.total,
    updated_at = now()
from (
  select run_id, count(*)::integer as total
  from public.content_candidates
  where id between '62000000-0000-0000-0000-000000000001'::uuid
    and '62000000-0000-0000-0000-000000000112'::uuid
  group by run_id
) counts
where run_record.id = counts.run_id;
