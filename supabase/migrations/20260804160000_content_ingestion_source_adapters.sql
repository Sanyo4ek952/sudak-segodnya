-- Route the closed pilot through deterministic RSS/JSON-LD/site adapters.
-- Runtime extraction does not use an LLM: new domains are reviewed and receive
-- a versioned adapter before they are enabled for recurring collection.

update public.content_sources
set url = 'https://www.culture.ru/afisha/respublika-krym-sudak',
    canonical_url = 'https://www.culture.ru/afisha/respublika-krym-sudak',
    kind = 'html',
    notes = 'Адаптер culture-ru-events-v1 находит карточки событий и читает их Event JSON-LD. Неизвестные типы остаются в закрытой очереди.',
    updated_at = now()
where id = '60000000-0000-0000-0000-000000000001';

update public.content_sources
set url = 'https://tavrida.art/news',
    canonical_url = 'https://tavrida.art/news',
    kind = 'html',
    notes = 'Адаптер tavrida-news-v1 читает карточки официального раздела новостей. Даты будущих событий подтверждаются администратором по детальной странице.',
    updated_at = now()
where id = '60000000-0000-0000-0000-000000000002';

update public.content_sources
set kind = 'html',
    notes = 'Адаптер sudak-aquapark-actions-v1 читает только детальные страницы /actions/. Срок, тариф и ограничения требуют ручной проверки.',
    updated_at = now()
where id = '60000000-0000-0000-0000-000000000003';

update public.content_sources
set url = 'https://libsudak.ru/news/rss/',
    canonical_url = 'https://libsudak.ru/news/rss/',
    kind = 'rss',
    notes = 'Официальная RSS 2.0 лента учреждения; адаптер libsudak-rss-v1. Материалы сохраняются только в закрытой очереди.',
    updated_at = now()
where id = '60000000-0000-0000-0000-000000000004';

update public.content_sources
set kind = 'html',
    notes = 'Адаптер tavrida-meganom-visit-v1 для официальной страницы самостоятельных посещений. Интервалы и наличие мест перепроверяются вручную.',
    updated_at = now()
where id = '60000000-0000-0000-0000-000000000005';

notify pgrst, 'reload schema';
