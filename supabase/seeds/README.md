# Разделение данных Supabase

- `demo.sql` — демонстрационный каталог только для явного ручного запуска.
- `production.sql` — безопасный production seed без организаций и публикаций.
- `../tests/*.sql` — изолированные pgTAP fixtures; каждый тест очищает собственные UUID-префиксы.

`supabase/config.toml` подключает пустой `production.sql`, поэтому обычный
`supabase db reset` не восстанавливает демонстрационные организации и публикации.

Для явного ручного запуска демонстрационного каталога после reset используйте
локальное подключение к БД:

```powershell
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/seeds/demo.sql
```

В production применяются миграции, но `demo.sql` автоматически не запускается.
