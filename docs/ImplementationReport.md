# Итоговый отчёт по реализации аудита «Судак Сегодня»

Дата: 2026-07-23.

Основной реестр каждого требования:
[`ImplementationTraceability.md`](./ImplementationTraceability.md).

## 1. Краткий итог

В рабочей копии реализована целевая модель лёгкой городской ленты и афиши:

- безопасное сохранение, публикация, редактирование и планирование через RPC;
- единая type-specific модель `Publication`;
- последовательная mobile-first форма с изображением и preview;
- реальная временная семантика, ranking и cursor pagination;
- компактная главная и исправленные фильтры;
- несколько организаций и все заявки пользователя;
- полный lifecycle заявки на добавление организации;
- профиль, меню, статистика и представители;
- owner/manager permissions и передача ownership;
- защищённая аналитика и административный audit trail;
- раздельные production/demo/test данные;
- синхронизированные продуктовые и технические документы.

Лайки, комментарии, подписки, чат, пользовательские публикации, заявки
жителей, внутренняя запись и аккаунты жителей не добавлялись.

## 2. Главные архитектурные решения

### Публикация

Одна таблица `publications` хранит `event`, `announcement`, `promo`,
`regular`, `news`. Клиент передаёт intent, но не `status`, `author_id` или
роль. Server Action валидирует DTO и вызывает SECURITY DEFINER RPC.

`save_member_publication`:

- получает автора из `auth.uid()`;
- проверяет активное membership и активную организацию;
- проверяет принадлежность редактируемой записи;
- повторяет критическую type-specific validation;
- атомарно сохраняет structured schedule;
- выставляет status/timestamps;
- поддерживает idempotency через `client_request_id`.

### Жизненный цикл

- `draft → published → completed`;
- `published → cancelled`;
- `published ↔ hidden` — административное восстановление;
- `blocked` — административное действие;
- `scheduled → published` — только через `publish_at` и фоновую функцию.

Представитель не устанавливает `hidden`, `blocked` или `moderation`.

### Актуальность и лента

Публичная RPC считает календарные границы в `Europe/Moscow`, учитывает
пересечение event-интервала, structured regular schedule и `valid_until`.
Истёкший материал исключается самим запросом независимо от cron.

Порядок прозрачен: важность, событие сейчас, ближайшее событие, близкий срок,
regular выбранного дня, свежая новость, остальные актуальные материалы.
Пагинация использует snapshot, cursor и `id` как tie-breaker.

### Организации и права

Пользователь видит все memberships и все заявки. Вторая организация создаётся
отдельной заявкой. Approval атомарно создаёт organization и owner membership.

Owner управляет доступом; manager управляет профилем, публикациями, меню и
статистикой. Последнего owner удалить нельзя. Передача ownership выполняется
атомарной RPC.

### Media

Buckets остаются private. Сервер проверяет membership, тип/размер файла и
строит путь от проверенной сущности. Связь хранится в `media_assets`.
Поддержаны preview, replace, remove и compensating cleanup после неуспешной
привязки.

### Аналитика и администрирование

Browser вызывает `track_public_analytics_event`; прямой anon/authenticated
insert запрещён. RPC проверяет allowlist, публичность и связи сущностей,
дедуплицирует просмотры/действия.

Административные hidden/restore/blocked и блокировка организации требуют
причину и создают `audit_events`.

## 3. Миграции

Добавлены:

1. `20260723170000_secure_publication_workflow.sql`
   — безопасная публикация, type validation, publish_at, cron, schedules.
2. `20260723180000_ranked_public_feed.sql`
   — временная семантика, ranking, cursor/snapshot.
3. `20260723190000_organization_audit_and_members.sql`
   — заявки, audit, invitations, owner protections/transfer.
4. `20260723200000_organization_profile_completion.sql`
   — полный профиль и проверка изменения типа.
5. `20260723205000_analytics_event_enum.sql`
   — новые типы analytics events отдельной транзакцией.
6. `20260723210000_secure_analytics_and_admin_moderation.sql`
   — защищённая аналитика и административная модерация.
7. `20260723220000_remove_codex_test_organization.sql`
   — точечное удаление только известной Codex-организации.
8. `20260723230000_fix_application_audit_and_owner_guards.sql`
   — корректный audit заявки и защита последнего owner.
9. `20260723240000_fix_invitation_crypto_search_path.sql`
   — безопасный `search_path` invitation RPC.
10. `20260723250000_fix_media_asset_replacement_rls.sql`
    — разделённые insert/update/delete-политики для безопасной замены media.
11. `20260723260000_allow_managers_to_read_soft_deleted_media.sql`
    — видимость управляемого soft-deleted asset для cleanup.
12. `20260723270000_allow_member_orphan_storage_cleanup.sql`
    — удаление orphan Storage object только внутри проверенной сущности.
13. `20260723280000_allow_member_storage_cleanup_visibility.sql`
    — SELECT-доступ, необходимый Storage API перед безопасным удалением.
14. `20260723290000_remove_exact_remote_codex_fixture.sql`
    — точечная очистка exact remote fixture по id+slug+полному имени; добавлена
    после read-only проверки, выявившей ошибочный name predicate старой
    миграции.

Существующие применённые миграции не редактировались.

## 4. Изменённые области

### Public app

- `src/app/(public)/page.tsx`;
- `src/app/(public)/favorites/page.tsx`;
- `src/app/(public)/organizations/[slug]/page.tsx`;
- `src/app/(public)/publications/[slug]/page.tsx`;
- `src/app/(public)/weather/page.tsx`;
- `src/app/(public)/invitations/[token]/page.tsx`;
- `src/app/api/publications/route.ts`;
- `src/app/api/favorites/route.ts`.

### Publications/feed

- `src/entities/publication/api/publications.ts`;
- `src/entities/publication/model/types.ts`;
- `src/entities/publication/model/filters.ts`;
- `src/entities/publication/model/publication-contract.ts`;
- `src/entities/publication/model/temporal-semantics.test.ts`;
- `src/entities/publication/model/publication-contract.test.ts`;
- `src/entities/publication/ui/publication-card.tsx`;
- `src/entities/publication/ui/publication-card.test.tsx`;
- `src/widgets/public-feed/ui/public-feed.tsx`;
- `src/widgets/public-feed/ui/feed-filters.tsx`;
- `src/widgets/public-feed/ui/feed-filters.test.ts`;
- `src/features/publication-actions/ui/publication-actions.tsx`.

### Business cabinet

- маршруты `src/app/business/**`;
- `src/features/business-cabinet/model/actions.ts`;
- `src/features/business-cabinet/model/types.ts`;
- `src/features/business-cabinet/ui/publication-form.tsx`;
- `src/features/business-cabinet/ui/organization-profile-form.tsx`;
- `src/features/business-cabinet/ui/menu-forms.tsx`;
- `src/features/business-cabinet/ui/representative-management.tsx`;
- `src/features/organization-application/**`.

### Organizations/favorites/analytics

- `src/entities/organization/api/organizations.ts`;
- `src/entities/organization/model/types.ts`;
- `src/entities/organization/ui/organization-card.tsx`;
- `src/features/save-favorite/**`;
- `src/widgets/favorites/ui/favorites-list.tsx`;
- `src/features/analytics/model/events.ts`;
- `src/features/analytics/ui/analytics-link.tsx`;
- `src/features/analytics/ui/analytics-action-listener.tsx`.
- `src/shared/lib/postgres-uuid.ts`;
- `src/shared/lib/postgres-uuid.test.ts`.

### Admin

- маршруты `src/app/admin/**`;
- `src/features/admin-application-review/**`;
- `src/features/admin-quality-control/model/**`;
- `src/features/admin-quality-control/ui/moderation-actions.tsx`;
- `src/features/admin-quality-control/ui/audit-history.tsx`.

### Supabase/types/data

- `src/shared/api/supabase/database.types.ts`;
- `supabase/config.toml`;
- `supabase/seeds/demo.sql`;
- `supabase/seeds/production.sql`;
- `supabase/seeds/README.md`;
- `supabase/tests/rls_mvp_public_content.sql`;
- `supabase/tests/rls_secure_publication_workflow.sql`;
- `supabase/tests/rls_organization_workflows.sql`;
- `supabase/tests/rls_secure_analytics_and_moderation.sql`;
- `supabase/tests/rls_media_asset_workflow.sql`.

### Документация

- `docs/Product.md`;
- `docs/Screen.md`;
- `docs/Database.md`;
- `docs/Architecture.md`;
- `docs/DevelopmentPlan.md`;
- `docs/ImplementationTraceability.md`;
- `docs/ImplementationReport.md`.

## 5. Автоматические проверки

Фактически выполнено:

| Проверка | Результат |
|---|---|
| `npm test` | 11 файлов, 57/57 тестов |
| `npx tsc --noEmit` | пройдено |
| `npm run lint` | пройдено |
| `npm run build` | пройдено, все app routes собраны |
| `npx supabase db reset` | пройдено: миграции 160000…290000 + demo seed |
| `npx supabase test db` | 6 файлов, 136/136 тестов |
| `git diff --check` | пройдено |

После reset отдельно подтверждены две активные `pg_cron`-задачи, отсутствие
Codex в локальном каталоге и отсутствие published/scheduled/cancelled news без
`valid_until`.

## 6. Визуальная проверка

Фактически проверены локальным приложением с применёнными миграциями; тот же
source после проверки успешно прошёл production build:

- главная: 320, 375, 1440 px;
- каталог: 320, 375, 1440 px;
- избранное: 320, 375, 1440 px;
- погода: 320, 375, 1440 px;
- организация: 320, 375, 1440 px.
- реальные карточки и detail event/news/cancelled;
- today/tomorrow, сохранение и cursor pagination;
- owner и manager protected flows;
- admin overview, applications list/detail и reason dialog.

Результаты:

- горизонтального page overflow нет;
- первая карточка начинается примерно на 418 px при 320 и 375 px;
- active filter: белый текст на `rgb(22,109,136)`;
- chip touch target — 44 px;
- системный scrollbar фильтров найден и исправлен;
- bottom navigation корректно видна на mobile и скрыта на desktop;
- long descriptions/addresses и отсутствие части изображений не ломают
  ширину;
- loading, error, empty и not-found состояния отображаются;
- 12 элементов первой cursor-порции и 15 после «Показать ещё», уникальных 15;
- owner видит две организации, все заявки и отдельный onboarding следующей;
- owner/manager оба безопасно редактируют published через RPC;
- manager не видит invitation/role/deactivation owner-actions;
- представители подписаны именем и email, не UUID;
- публикация и logo фактически прошли upload/replace/remove, orphan Storage
  objects после cleanup отсутствовали;
- подписанное изображение отображается через `next/image` в local development
  после dev-only разрешения local IP.

Не проверены визуально:

- submitted и needs_changes от лица заявителя;
- admin publications/organizations/reports/important/audit lists;
- end-to-end menu item image upload.

Локальные QA-аккаунты для этих состояний были созданы, но после части admin
проверки browser controller запретил дальнейшие переходы к локальному адресу.
Обход ограничения не выполнялся. Эти состояния проверены по коду, pgTAP и
production build, но не объявляются визуально просмотренными.

## 7. Дополнительные дефекты

Найдены и исправлены:

1. Устаревший production-процесс давал ложную старую разметку — проверка
   переведена на свежий build на отдельном порту.
2. PostgREST FK hint был назван `organizations_type_id_fkey`, хотя реальный
   constraint после rename сохранил имя `organizations_category_id_fkey`.
   Исправлены public, cabinet, admin queries и generated relationship.
3. На 320 px был заметен системный scrollbar фильтров — скрыт локально без
   удаления семантических ссылок.
4. Страница погоды не имела `h1` — `SectionHeader` переведён в `as="h1"`.
5. Weather CTA сжимал header на 320 px — вынесен отдельной полноширинной
   кнопкой на mobile.
6. Seed UUID с version nibble `0` корректен для PostgreSQL, но отклонялся
   `z.string().uuid()`: введена общая каноническая PostgreSQL UUID-схема.
   Исправлены favorites и защищённые route/action identifiers.
7. Draft после upload показывал публичную ссылку — ссылка теперь возвращается
   только для `published`/`cancelled`.
8. Unicode slug приходил в динамический route percent-encoded и давал 404 —
   добавлено безопасное декодирование для metadata и page query.
9. Next Image Optimizer блокировал локальный Supabase private IP — local IP
   разрешён только вне production; production SSRF-защита не ослаблена.
10. Manager не мог заменить seed-uploaded media и очистить orphan Storage
    objects — добавлены раздельные MediaAsset/Storage RLS и 14 pgTAP-проверок.
11. На 320 px первая карточка начиналась около 561 px — compact hero/weather
    и интервалы подняли её примерно до 418 px.
12. Фильтры favorites принимали не весь диапазон PostgreSQL UUID — API
    переведён на тот же централизованный contract.
13. Старая cleanup-миграция искала имя с `codex%`, а реальная организация
    называется «Тестовая организация Codex…» — добавлена новая миграция с
    exact id+slug+full name. Она проверена на локальном идентичном fixture.

Подтверждённое состояние после чистого локального reset:

- `codex_orgs = 0`;
- `news_without_valid_until = 0`;
- активны `sudak-publish-due-publications` и
  `sudak-complete-expired-publications`;
- demo содержит 9 организаций и отделён от production seed.

Read-only remote-проверка linked project `mvestlctctcsukzwuqoo` до push
подтвердила одну активную запись:
`2174abb6-f545-4272-8cc7-81ee86461f12`,
`codex-1784653614749-c3c4d448`. Миграции `170000`–`290000` на remote ещё не
применены.

## 8. Protected-экраны

Фактически просмотрено:

- owner: multi-org root, dashboard, profile, publication list/form/detail,
  media, menu, statistics и representatives;
- manager: кабинет, published edit и отсутствие owner-only controls;
- admin: overview, application list/detail/history и confirm dialog причины.

По коду, pgTAP и production build дополнительно подтверждены route guards,
invitation acceptance/revoke, last-owner protection, submitted/needs_changes
resubmit, admin moderation/audit. Последние состояния не считаются визуально
проверенными по причине из раздела 6.

## 9. Безопасное применение миграций

Сначала в локальной или staging Supabase:

```bash
npx supabase start
npx supabase test db
npx tsc --noEmit
npm test
npm run lint
npm run build
```

Только после успешного pgTAP:

```bash
npm run supabase:push
```

Перед production push:

1. проверить linked project;
2. сделать backup;
3. применить миграции сначала в staging;
4. проверить cron extension/jobs;
5. убедиться, что cleanup-миграция совпадает с точным slug Codex;
6. обновить generated types из применённой схемы и сравнить diff;
7. выполнить smoke-test anon, owner, manager и admin.

## 10. Запуск проекта

```bash
npm install
npm run dev
```

Открыть `http://localhost:3000`.

## 11. Ручная проверка ключевых сценариев

### Публикация

1. Owner/manager создаёт draft каждого типа.
2. Проверить меняющиеся поля и сохранение между шагами.
3. Проверить preview, upload/replace/remove.
4. Опубликовать и открыть public detail.
5. Отредактировать published.
6. Отменить event и завершить материал.
7. Запланировать на ближайшее время и дождаться cron.
8. Повторить submit с тем же request id и убедиться, что дубля нет.

### Время и лента

1. Event вчера→сегодня.
2. Event через полночь.
3. Event завтра.
4. Regular сегодня и завтра.
5. Promo/news до и после `valid_until`.
6. Последовательно загрузить несколько cursor-порций без дублей.

### Организации

1. Подать первую заявку.
2. Admin переводит в needs_changes с комментарием.
3. Повторно отправить и одобрить.
4. Создать вторую заявку и переключиться между организациями.
5. Изменить основной тип и проверить admin review.

### Представители

1. Owner приглашает manager.
2. Manager принимает приглашение.
3. Manager не видит owner-only действий.
4. Owner меняет роль, деактивирует/возвращает доступ.
5. Попытка удалить последнего owner отклоняется.
6. Передать ownership.

### Админка и аналитика

1. Скрыть/восстановить/заблокировать с причиной.
2. Проверить audit trail.
3. Отправить сообщение о неточности; убедиться, что публикация не скрылась.
4. Повторить аналитическое событие и проверить дедупликацию.
5. Проверить 30-дневные показатели кабинета.

## 12. Оставшиеся внешние действия

1. Проверить linked Supabase project и сделать backup.
2. Применить уже проверенные миграции сначала в staging, затем в production.
3. Проверить production `pg_cron`, catalog и отсутствие Codex fixture.
4. Выполнить remote smoke-test anon/owner/manager/admin.
5. При доступном браузерном контроллере досмотреть submitted/needs_changes,
   остальные admin-списки и menu-image flow.
