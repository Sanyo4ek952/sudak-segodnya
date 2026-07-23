# Матрица реализации рекомендаций `ProjectAudit.md`

Последнее обновление: 2026-07-23.

Статусы:

- `Выполнено` — реализация присутствует, но применимая визуальная проверка
  конкретного состояния ещё не завершена.
- `Проверено` — реализация подтверждена доступной автоматической или
  фактической проверкой.
- `Ограничено средой` — код и автоматические проверки подготовлены, но
  конкретная визуальная проверка заблокирована браузерным контроллером либо
  применение требует отдельного доступа к удалённому окружению.

## Baseline

| Проверка | Результат до изменений |
|---|---|
| Git | Ветка `dev`, commit `66188d1` |
| `npm test` | 5 файлов, 27 тестов — пройдено |
| `npx tsc --noEmit` | Пройдено |
| `npm run lint` | Пройдено |
| `npm run build` | Пройдено |
| Supabase SQL/RLS | Исходно не запускались; после реализации — чистый reset и 136/136 pgTAP |
| Визуальная проверка | После реализации: public 320/375/1440; owner, manager и часть admin на локальных QA-аккаунтах |

## Трассировка

| ID | Рекомендация аудита | Приоритет | Реализация | Статус | Проверка |
|---|---|---|---|---|---|
| PUB-01 | Безопасные draft/publish через RPC | Срочно | `save_member_publication`, Server Action | Проверено | pgTAP + фактическая owner-публикация |
| PUB-02 | Редактирование опубликованной записи | Срочно | membership/ownership checks в RPC | Проверено | pgTAP + browser owner/manager edit |
| PUB-03 | Не доверять author/org/status клиента | Срочно | `auth.uid()`, intent и server checks | Проверено | negative pgTAP |
| PUB-04 | Атомарное расписание | Срочно | одна транзакция RPC | Проверено | pgTAP |
| PUB-05 | Убрать status select | Срочно | только бизнес-действия формы | Проверено | source review + TypeScript |
| PUB-06 | Допустимые переходы | Срочно | member/admin transition RPC | Проверено | pgTAP |
| PUB-07 | Без moderation в обычном flow | Срочно | status отсутствует в UI/DTO | Проверено | source review |
| PUB-08 | Не показывать нерабочий scheduled | Срочно | scheduled показан только вместе с publish_at/job | Проверено | source review |
| PUB-09 | Полное планирование | Позже | publish_at, safe publisher, cron, UI/errors | Проверено | pgTAP + две активные local cron jobs |
| VAL-01 | Общая type-specific validation | Срочно | Zod + SQL/RPC rules | Проверено | unit + pgTAP |
| VAL-02 | Event: время, место, цена | Срочно | единый contract + RPC | Проверено | unit + pgTAP |
| VAL-03 | Announcement/promo: срок и цена | Срочно | `valid_until`, price rules | Проверено | unit + pgTAP |
| VAL-04 | Regular: срок/schedule/place/price | Срочно | intervals + timezone | Проверено | unit + pgTAP |
| VAL-05 | News: обязательный срок | Срочно | Zod, constraint, RPC | Проверено | unit + pgTAP + clean seed query |
| FORM-01 | Последовательная type-specific форма | Важно | 6 шагов с локальным состоянием | Проверено | browser owner/manager |
| FORM-02 | Preview карточки/detail | Важно | preview на финальном шаге | Проверено | browser owner/manager |
| FORM-03 | Double submit и ошибки | Важно | pending + idempotency + error UI | Проверено | pgTAP idempotency + browser submit |
| MEDIA-01 | Изображение публикации | Важно | upload/preview/replace/remove | Проверено | browser Storage flow + pgTAP RLS |
| MEDIA-02 | Logo/cover организации | Важно | profile upload flow | Проверено | browser logo upload/replace/remove + pgTAP RLS |
| MEDIA-03 | Фото меню/услуг | Важно | menu item upload flow | Выполнено | UI просмотрен; общий Storage/RLS-контракт проверен |
| MEDIA-04 | MIME/size/path/orphan cleanup | Важно | server validation + compensating cleanup | Проверено | browser orphan cleanup + 14 media pgTAP |
| FEED-01 | «Сегодня»/«Завтра» | Важно | overlap/expiry/schedule/timezone | Проверено | unit + browser real data |
| FEED-02 | Прозрачное ranking | Важно | SQL priority tuple без engagement | Проверено | pgTAP + browser real data |
| FEED-03 | Cursor pagination | Позже | snapshot/cursor/API/load-more | Проверено | browser 12→15, без дублей |
| CARD-01 | Нет дублей бейджей | Срочно | единый status/type selection | Проверено | component unit |
| CARD-02 | Только применимые поля | Важно | type-aware facts | Проверено | component unit |
| CARD-03 | Cancelled/stale состояния | Важно | текст/стиль + stale favorites | Проверено | component unit + source review |
| CARD-04 | Share/detail/calendar | Важно | detail actions + analytics | Проверено | browser event/detail |
| HOME-01 | Уплотнить mobile first screen | Важно | compact hero/weather/spacing | Проверено | первая карточка: 418 px на 320 и 375 |
| HOME-02 | Контраст active chip | Срочно | mutually exclusive classes | Проверено | unit + computed contrast 5,87:1 |
| HOME-03 | Horizontal filter scroll | Важно | overflow, focus, URL state, hidden scrollbar | Проверено | mobile screenshot/DOM; links remain semantic |
| ORG-01 | Все memberships и заявки | Важно | list queries и «Мои организации» | Проверено | pgTAP + owner browser |
| ORG-02 | Вторая организация | Важно | отдельный новый draft | Проверено | pgTAP + owner browser |
| ORG-03 | Переключение организаций | Важно | organization switch links | Проверено | owner browser с двумя организациями |
| APP-01 | Полный lifecycle заявки | Важно | resubmit + admin transitions | Проверено | pgTAP |
| APP-02 | Идемпотентное одобрение | Важно | locked approval RPC | Проверено | pgTAP |
| APP-03 | Audit trail заявки | Важно | `audit_events` + UI | Проверено | pgTAP + admin detail browser |
| APP-04 | Однозначный термин | Важно | «Заявка на добавление организации» | Проверено | source/docs review |
| CAB-01 | Полная главная кабинета | Важно | completeness/expiry/actions/30d | Проверено | owner browser |
| CAB-02 | Полный профиль | Важно | fields/media/type review | Проверено | owner browser + Storage flow |
| CAB-03 | Фактическая дата обновления | Срочно | `last_public_update_at` | Проверено | source review |
| CAB-04 | Фильтры/поиск публикаций | Важно | URL status/type/query | Проверено | owner browser |
| MEM-01 | Имя/email вместо UUID | Важно | profile projection | Проверено | owner/manager browser |
| MEM-02 | Приглашения | Позже | create/revoke/accept/deactivate UI+RPC | Проверено | pgTAP + owner UI |
| MEM-03 | Owner/manager permissions | Важно | owner-only access RPC | Проверено | pgTAP + owner/manager browser |
| MEM-04 | Последний owner/role escalation | Важно | trigger + RPC checks | Проверено | negative pgTAP |
| MEM-05 | Передача ownership | Позже | атомарная RPC + UI | Проверено | pgTAP + owner UI |
| DATA-01 | Удалить Codex production fixture | Срочно | exact id+slug+name cleanup migration `20260723290000` | Выполнено | exact fixture удалён локально, owner-trigger включён; remote push ожидает явного разрешения |
| DATA-02 | Production/demo/test seeds | Важно | раздельные seed/fixtures | Проверено | source/config review |
| SCHED-01 | Структурированное расписание | Позже | multi-slot weekday/time/timezone | Проверено | unit + pgTAP |
| ANALYTICS-01 | Share/calendar события | Важно | enum/RPC/client actions | Проверено | pgTAP + browser event detail |
| ANALYTICS-02 | Дедупликация/защита | Важно | allowlist/entity checks/windows/locks | Проверено | pgTAP |
| ANALYTICS-03 | 30d/качество контента | Важно | cabinet aggregates/completeness/expiry | Проверено | owner browser |
| ADMIN-01 | Причины и история | Важно | moderation RPC + `audit_events` | Проверено | pgTAP + admin application detail |
| ADMIN-02 | Фильтры/статусы/подтверждения | Важно | admin UI and reason dialogs | Выполнено | overview/review browser; прочие admin-списки по коду |
| DOC-01 | `Product.md` | Срочно | роли/границы/expiry/scheduling | Проверено | documentation review |
| DOC-02 | `Screen.md` | Срочно | form/multi-org/cards/share | Проверено | documentation review |
| DOC-03 | `Database.md` | Срочно | RPC/rules/transitions/feed | Проверено | documentation review |
| DOC-04 | `Architecture.md` | Срочно | Server Action→RPC/jobs/expiry | Проверено | documentation review |
| DOC-05 | `DevelopmentPlan.md` | Срочно | фактические статусы/ограничения | Проверено | documentation review |
| TEST-01 | Unit бизнес-правил | Срочно | validation/time/card/filter/UUID/favorites | Проверено | 11 файлов, 57/57 |
| TEST-02 | SQL/RLS публикаций | Срочно | `rls_secure_publication_workflow.sql` | Проверено | clean reset; 136/136 общий pgTAP |
| TEST-03 | SQL заявок/members/admin/analytics/media | Важно | пять специализированных pgTAP-наборов | Проверено | 136/136 |
| TEST-04 | UI loading/error/empty/roles | Важно | состояния реализованы | Выполнено | public + owner/manager + часть admin |
| VIS-01 | Public 320/375/1440 | Срочно | responsive/contrast/overflow | Проверено | main/feed/cards/detail/catalog/favorites/weather/org |
| VIS-02 | Owner/manager/admin/application states | Важно | protected screens | Ограничено средой | owner/manager и admin review проверены; submitted/needs_changes и прочие admin-списки заблокированы browser policy |
| SCOPE-01 | Нет resident applications/social network | Обязательно | продукт и код | Проверено | source/product review |

## Границы визуальной проверки защищённых экранов

Фактически просмотрены с локальной Supabase:

- owner: две организации, все заявки, dashboard, профиль, публикации,
  six-step form/preview/edit, media, меню, статистика и представители;
- manager: кабинет, редактирование опубликованной записи и отсутствие
  owner-only действий представителей;
- admin: overview, список заявок, detail заявки, история и dialog обязательной
  причины без выполнения destructive-операции.

После этого browser controller запретил дальнейшие переходы к локальному
адресу. Поэтому submitted/needs_changes от лица заявителя, остальные
admin-списки и end-to-end menu-image upload проверены по коду и pgTAP, но не
помечены как визуально просмотренные. Удалённая БД не изменялась.
