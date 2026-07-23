# «Судак Сегодня» — модель данных Supabase MVP

## 1. Общие правила

База строится на Supabase PostgreSQL. Для пользовательских таблиц включается RLS.

Общие поля:

- `id uuid primary key default gen_random_uuid()` — обязательно;
- `created_at timestamptz default now()` — обязательно;
- `updated_at timestamptz default now()` — обязательно;
- `created_by uuid references auth.users(id)` — если запись создаёт авторизованный пользователь;
- `updated_by uuid references auth.users(id)` — только если важно фиксировать последнего редактора.

Служебные поля `user_id`, `author_id`, `uploaded_by`, `reviewed_by`, `resolved_by`, `created_by` не принимаются из клиентского тела запроса. Их выставляет серверная операция или default на основе `auth.uid()`.

## 2. Enum и справочники

Enums:

- `profile_role`: `user`, `admin`;
- `organization_status`: `draft`, `pending`, `active`, `needs_changes`, `rejected`, `blocked`;
- `organization_member_role`: `owner`, `manager`;
- `organization_application_status`: `draft`, `submitted`, `needs_changes`, `approved`, `rejected`;
- `publication_type`: `event`, `announcement`, `promo`, `regular`, `news`;
- `publication_status`: `draft`, `scheduled`, `moderation`, `published`, `cancelled`, `completed`, `hidden`, `blocked`;
- `media_asset_purpose`: `organization_logo`, `organization_cover`, `application_confirmation`, `publication_photo`, `menu_item_photo`;
- `media_asset_visibility`: `public`, `private`;
- `inaccuracy_report_reason`: `wrong_datetime` — «Неверная дата или время», `wrong_price`, `cancelled`, `wrong_address`, `outdated`, `other`;
- `inaccuracy_report_status`: `new`, `reviewing`, `resolved`, `rejected`;
- `important_announcement_status`: `draft`, `active`, `expired`, `hidden`;
- `analytics_event_name`: `organization_view`, `publication_view`, `phone_click`, `route_click`, `menu_open`, `favorite_add`.

Справочники:

- `organization_types` — основной тип организации для каталога и страницы организации.
  Поля: `id`, `slug`, `name`, `description?`, `sort_order`, `is_active`, `created_at`, `updated_at`.
  Стартовые значения: `food`, `delivery`, `kids`, `culture`, `excursions`, `rental_entertainment`, `shops`, `services`, `administration`.
- `publication_categories` — категория конкретной публикации для ленты и фильтров.
  Поля: `id`, `slug`, `name`, `description?`, `sort_order`, `is_active`, `created_at`, `updated_at`.
  Стартовые значения: `city`, `kids`, `food`, `culture`, `sport`, `excursions`, `rental`, `shops`, `services`.

`today`, `tomorrow` и `free` — фильтры ленты, а не категории публикаций.

## 3. Основные таблицы

### profiles

Назначение: непубличный профиль авторизованного пользователя.

Обязательные поля: `id references auth.users(id)`, `role`.
Необязательные поля: `display_name`, `phone`.

### organizations

Назначение: публичная организация и владелец публикаций, меню или услуг.

Обязательные поля: `type_id references organization_types(id)`, `slug`, `name`, `status`, `created_by`.
Обязательные для `active`: `description`, `phone`.
Необязательные поля: `address`, `latitude`, `longitude`, `working_hours`, `contact_links jsonb`, `last_public_update_at`.

Логотип и обложка не хранятся колонками в `organizations`. Они задаются строками `media_assets` с `purpose = organization_logo` и `purpose = organization_cover`.

### organization_members

Назначение: связь пользователей с организациями и основа прав кабинета.

Обязательные поля: `organization_id`, `user_id`, `role`, `is_active`.
Ограничение: unique `(organization_id, user_id)`.

### organization_applications

Назначение: заявка пользователя на создание или подтверждение организации.

Обязательные поля: `applicant_id`, `status`.
Обязательные при отправке: `organization_name`, `type_id`, `description`, `phone`, `relationship`.
Необязательные поля: `address`, `confirmation_info`, `admin_comment`, `organization_id`, `submitted_at`, `reviewed_at`, `reviewed_by`.

Подтверждающее фото заявки хранится в `media_assets` с `purpose = application_confirmation`, `visibility = private`, `application_id`.

### publications

Назначение: городская лента и публичные страницы публикаций.

Обязательные поля: `organization_id`, `author_id`, `slug`, `type`, `status`, `title`, `category_id references publication_categories(id)`, `is_free`.
Обязательные для публичного статуса: `description`, `price_text`.
Для `event`: `starts_at`, `ends_at`.
Для `announcement`, `promo`, `regular`: `valid_until`.
Необязательные поля: `published_at`, `cancelled_at`, `completed_at`, `place`, `age_limit`, `contact_phone`, `sort_published_at`, `moderation_comment`.

Фото публикации хранится в `media_assets` с `purpose = publication_photo`, `publication_id`.

### publication_schedules

Назначение: расписание регулярных занятий без усложнения основной таблицы публикаций.

Обязательные поля: `publication_id`, `schedule_text`, `sort_order`.
Необязательные поля: `weekday`, `starts_at time`, `ends_at time`.

### menu_categories

Назначение: разделы меню или услуг внутри организации.

Обязательные поля: `organization_id`, `name`, `sort_order`, `is_active`.
Необязательные поля: `description`.

Это не категории каталога и не категории публикаций.

### menu_items

Назначение: позиция меню или услуга организации.

Обязательные поля: `organization_id`, `title`, `is_available`, `sort_order`.
Необязательные поля: `category_id references menu_categories(id)`, `description`, `price_text`.

Фото позиции хранится в `media_assets` с `purpose = menu_item_photo`, `menu_item_id`.

### media_assets

Назначение: единая лёгкая модель изображений MVP без сложного DAM.

Обязательные поля: `bucket_id`, `storage_path`, `purpose`, `visibility`, `uploaded_by`, `sort_order`.
Необязательные поля: `organization_id`, `application_id`, `publication_id`, `menu_item_id`, `alt_text`, `width`, `height`, `mime_type`, `size_bytes`, `deleted_at`.

Ограничения:

- у записи ровно один владелец: организация, заявка, публикация или позиция меню;
- `organization_logo` и `organization_cover` связаны только с `organization_id`;
- `application_confirmation` связано только с `application_id` и всегда `private`;
- `publication_photo` связано только с `publication_id`;
- `menu_item_photo` связано только с `menu_item_id`;
- для MVP используется одно активное изображение на пару `owner + purpose`, без галерей.

### important_announcements

Назначение: компактное важное объявление над лентой.

Обязательные поля: `status`, `title`, `description`, `created_by`.
Обязательные для `active`: `active_from`, `active_until`.
Необязательные поля: `publication_id`.

### inaccuracy_reports

Назначение: сообщение пользователя о неточности в публикации.

Обязательные поля: `publication_id`, `reason`, `status`.
Необязательные поля: `reporter_user_id`, `reporter_fingerprint`, `comment`, `admin_comment`, `resolved_by`, `resolved_at`.

Одна жалоба не меняет статус публикации автоматически.

### analytics_events

Назначение: простая статистика MVP.

Обязательные поля: `event_name`.
Необязательные поля: `organization_id`, `publication_id`, `menu_item_id`, `user_id`, `anonymous_id`, `metadata`.

## 4. RLS на уровне продукта

Helper-функции:

- `is_admin()` — пользователь имеет `profiles.role = admin`;
- `is_org_member(org_id uuid)` — пользователь активный представитель организации;
- `is_org_owner(org_id uuid)` — пользователь активный owner организации.

Публичный доступ:

- anon/authenticated читают активные `organization_types` и `publication_categories`;
- anon/authenticated читают `organizations.status = active`;
- anon/authenticated читают `publications.status in (published, cancelled)` активных организаций, если публикация ещё актуальна;
- anon/authenticated читают расписания только публичных публикаций;
- anon/authenticated читают активные категории меню и доступные позиции меню активных организаций;
- anon/authenticated читают активные важные объявления в пределах периода показа;
- anon/authenticated читают только `media_assets.visibility = public`, если связанная организация, публикация или позиция меню публично доступна.

Заявки:

- заявитель читает только свои заявки;
- заявитель создаёт и редактирует свои заявки только в `draft` или `needs_changes`;
- `organization_id`, `reviewed_by`, `reviewed_at`, `admin_comment` меняет только администратор через серверные операции;
- private-фото заявки видят только заявитель и администратор.

Кабинет организации:

- представитель читает и меняет только данные организаций, где есть активная строка `organization_members`;
- `organization_id`, `author_id`, `uploaded_by` проверяются через RLS и серверные операции;
- представитель не может выставлять административные статусы `hidden`, `blocked`, `approved`, `rejected`;
- публикация в `published` проходит серверную проверку полноты данных и статуса организации.

Администратор:

- читает все MVP-таблицы;
- меняет статусы заявок, организаций, публикаций, жалоб и важных объявлений;
- админские действия выполняются через Server Actions или RPC, чтобы фиксировать служебные поля и timestamps.

Storage:

- buckets: `organization-images`, `publication-images`, `menu-images`, `application-confirmation-images`;
- buckets остаются private;
- публичное чтение `storage.objects` разрешается только если есть разрешённая строка `media_assets` и связанная сущность публична;
- загрузка и удаление файлов выполняются серверными операциями после проверки membership или admin-прав.

## 5. Жизненные циклы

Заявка:

1. Пользователь создаёт `organization_applications` в `draft`.
2. При отправке сервер проверяет обязательные поля и переводит статус в `submitted`.
3. Администратор переводит заявку в `needs_changes`, `approved` или `rejected`.
4. При `approved` создаётся `organizations.status = active` и `organization_members.role = owner`.

Публикация:

1. Представитель создаёт черновик.
2. Сервер проверяет membership, полноту данных и статус организации.
3. Публикация становится `scheduled`, `moderation` или `published`.
4. Публичные выборки дополнительно фильтруют истёкшие `ends_at` и `valid_until`.
5. `cancelled` остаётся видимой с понятным статусом, пока полезна пользователю.
6. `completed`, `hidden`, `blocked` не попадают в основную ленту.

Изображения:

1. Файл загружается в подходящий bucket.
2. Сервер создаёт `media_assets` с нужным `purpose`.
3. При замене старый asset получает `deleted_at` или удаляется, если запись была черновой.
4. Опубликованные материалы лучше не ломать физическим удалением файлов.

## 6. Границы MVP

Не включать в backend MVP:

- заказы;
- оплату;
- билеты;
- бронирование;
- публичные комментарии;
- отзывы и рейтинги;
- чат;
- программу лояльности;
- сложные рекомендации;
- серверную синхронизацию избранного.
