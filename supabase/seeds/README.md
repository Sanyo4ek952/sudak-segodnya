# Разделение данных Supabase

- `demo.sql` — локальный демонстрационный каталог для `supabase db reset`.
- `production.sql` — безопасный production seed без организаций и публикаций.
- `../tests/*.sql` — изолированные pgTAP fixtures; каждый тест очищает собственные UUID-префиксы.

`supabase/config.toml` подключает только `demo.sql`, поэтому demo-данные появляются лишь при локальном reset. В production применяются миграции, но demo seed не запускается.

