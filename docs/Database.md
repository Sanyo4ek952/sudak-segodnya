# Database.md

# «Судак Сегодня» — модель данных Supabase MVP

## 1. Общие правила

База данных строится на Supabase PostgreSQL с включённым RLS для всех пользовательских таблиц.

Общие поля для большинства таблиц:

- `id uuid primary key default gen_random_uuid()` — обязательно;
- `created_at timestamptz default now()` — обязательно;
- `updated_at timestamptz default now()` — обязательно;
- `created_by uuid references auth.users(id)` — если запись создаётся авторизованным пользователем;
- `updated_by uuid references auth.users(id)` — если важно фиксировать последнего редактора.

Служебные поля пользователя (`user_id`, `author_id`, `created_by`, `reviewed_by`) не принимаются из клиентского тела запроса. Их выставляет серверная операция или default на основе `auth.uid()`.

## 2. Enum-значения MVP

`profile_role`:

- `user`;
- `admin`.

`organization_status`:

- `draft`;
- `pending`;
- `active`;
- `needs_changes`;
- `rejected`;
- `blocked`.

`organization_member_role`:

- `owner`;
- `manager`.

`organization_application_status`:

- `draft`;
- `submitted`;
- `needs_changes`;
- `approved`;
- `rejected`.

`publication_type`:

- `event`;
- `announcement`;
- `promo`;
- `regular`;
- `news`.

`publication_status`:

- `draft`;
- `scheduled`;
- `moderation`;
- `published`;
- `cancelled`;
- `completed`;
- `hidden`;
- `blocked`.

`inaccuracy_report_status`:

- `new`;
- `reviewing`;
- `resolved`;
- `rejected`.

`important_announcement_status`:

- `draft`;
- `active`;
- `expired`;
- `hidden`.

## 3. Таблицы

### profiles

Назначение: публично не отображаемый профиль авторизованного пользователя.

Поля:

- `id uuid primary key references auth.users(id) on delete cascade` — обязательно;
- `role profile_role default 'user'` — обязательно;
- `display_name text` — необязательно;
- `phone text` — необязательно;
- `created_at timestamptz default now()` — обязательно;
- `updated_at timestamptz default now()` — обязательно.

Связи:

- `profiles.id` связан с `auth.users.id`;
- используется в `organization_members`, `organization_applications`, `publications`, административных действиях.

Статусы:

- роль `user` для представителей;
- роль `admin` для администраторов.

Индексы:

- primary key по `id`;
- индекс по `role` для админ-панели.

Удаление:

- при удалении auth-пользователя профиль удаляется каскадно;
- связанные бизнес-записи не удаляются автоматически, если они уже публичны.

### organization_categories

Назначение: управляемый справочник категорий организаций для каталога и фильтров.

Поля:

- `id uuid primary key` — обязательно;
- `slug text unique` — обязательно;
- `name text` — обязательно;
- `description text` — необязательно;
- `sort_order integer default 0` — обязательно;
- `is_active boolean default true` — обязательно;
- `created_at timestamptz default now()` — обязательно;
- `updated_at timestamptz default now()` — обязательно.

Связи:

- `organizations.category_id` ссылается на основную категорию организации.

Статусы:

- активность задаётся `is_active`.

Индексы:

- unique по `slug`;
- индекс по `(is_active, sort_order)`.

Удаление:

- физически не удалять категорию, если есть организации;
- для скрытия использовать `is_active = false`.

### organizations

Назначение: организация, отображаемая в каталоге и как владелец публикаций.

Поля:

- `id uuid primary key` — обязательно;
- `category_id uuid references organization_categories(id)` — основная категория организации, обязательно;
- `slug text unique` — обязательно;
- `name text` — обязательно;
- `description text` — обязательно для публичной активной организации;
- `status organization_status default 'draft'` — обязательно;
- `address text` — необязательно до публикации, обязательно для `active`, если есть офлайн-точка;
- `phone text` — необязательно до публикации, обязательно для `active`;
- `working_hours text` — необязательно;
- `contact_links jsonb default '{}'` — необязательно, только внешние сайт/мессенджер/соцсети;
- `logo_path text` — необязательно;
- `cover_path text` — необязательно;
- `last_public_update_at timestamptz` — необязательно;
- `created_by uuid references auth.users(id)` — обязательно;
- `created_at timestamptz default now()` — обязательно;
- `updated_at timestamptz default now()` — обязательно.

Связи:

- имеет представителей через `organization_members`;
- имеет заявки через `organization_applications`;
- имеет публикации через `publications`;
- имеет меню через `menu_categories` и `menu_items`.

Статусы:

- `draft` — создана при черновой заявке;
- `pending` — ожидает проверки;
- `active` — публично доступна;
- `needs_changes` — администратор запросил уточнения;
- `rejected` — заявка отклонена;
- `blocked` — публичное отображение и публикации остановлены.

Индексы:

- unique по `slug`;
- индекс по `(status, category_id)`;
- индекс по `created_by`;
- полнотекстовый или trigram-индекс по `name`, если поиск будет на стороне БД.

Удаление:

- активные организации не удалять физически в MVP;
- черновик можно удалить владельцу, если нет опубликованных публикаций;
- блокировка выполняется через `status = 'blocked'`.

### organization_members

Назначение: связь пользователей с организациями и основа прав кабинета.

Поля:

- `id uuid primary key` — обязательно;
- `organization_id uuid references organizations(id) on delete cascade` — обязательно;
- `user_id uuid references auth.users(id) on delete restrict` — обязательно;
- `role organization_member_role default 'manager'` — обязательно;
- `is_active boolean default true` — обязательно;
- `created_at timestamptz default now()` — обязательно;
- `updated_at timestamptz default now()` — обязательно.

Связи:

- представитель связан с одной или несколькими организациями.

Статусы:

- активность membership задаётся `is_active`;
- роль `owner` может управлять представителями;
- роль `manager` управляет контентом.

Индексы:

- unique по `(organization_id, user_id)`;
- индекс по `(user_id, is_active)`;
- индекс по `(organization_id, is_active)`.

Удаление:

- при удалении организации членство удаляется каскадно;
- пользователя из организации лучше деактивировать через `is_active = false`.

### organization_applications

Назначение: заявка пользователя на создание или подтверждение организации.

Поля:

- `id uuid primary key` — обязательно;
- `organization_id uuid references organizations(id) on delete set null` — необязательно до создания организации;
- `applicant_id uuid references auth.users(id)` — обязательно;
- `status organization_application_status default 'draft'` — обязательно;
- `organization_name text` — обязательно при отправке;
- `category_id uuid references organization_categories(id)` — основная категория будущей организации, обязательно при отправке;
- `description text` — необязательно;
- `address text` — необязательно;
- `phone text` — необязательно;
- `relationship text` — обязательно при отправке;
- `confirmation_info text` — необязательно;
- `admin_comment text` — необязательно;
- `submitted_at timestamptz` — необязательно;
- `reviewed_at timestamptz` — необязательно;
- `reviewed_by uuid references auth.users(id)` — необязательно;
- `created_at timestamptz default now()` — обязательно;
- `updated_at timestamptz default now()` — обязательно.

Связи:

- принадлежит заявителю;
- после одобрения связана с организацией.

Статусы:

- `draft` — пользователь заполняет;
- `submitted` — на проверке;
- `needs_changes` — нужно уточнение;
- `approved` — одобрена;
- `rejected` — отклонена.

Индексы:

- индекс по `(applicant_id, status)`;
- индекс по `(status, submitted_at)`;
- индекс по `organization_id`.

Удаление:

- пользователь может удалить только свой `draft`;
- отправленные заявки сохраняются для админ-панели.

### publications

Назначение: городская лента и публичные страницы публикаций.

Поля:

- `id uuid primary key` — обязательно;
- `organization_id uuid references organizations(id) on delete restrict` — обязательно;
- `author_id uuid references auth.users(id)` — обязательно;
- `slug text unique` — обязательно;
- `type publication_type` — обязательно;
- `status publication_status default 'draft'` — обязательно;
- `title text` — обязательно;
- `description text` — обязательно для публикации;
- `category_slug text` — обязательно для фильтров ленты;
- `starts_at timestamptz` — обязательно для `event`, необязательно для других типов;
- `ends_at timestamptz` — обязательно для `event`, необязательно для других типов;
- `valid_until timestamptz` — обязательно для `announcement`, `promo`, `regular`;
- `published_at timestamptz` — необязательно;
- `cancelled_at timestamptz` — необязательно;
- `completed_at timestamptz` — необязательно;
- `place text` — необязательно, можно наследовать адрес организации;
- `price_text text` — обязательно для публичной публикации;
- `is_free boolean default false` — обязательно;
- `age_limit text` — необязательно;
- `image_path text` — необязательно;
- `contact_phone text` — необязательно, если отличается от организации;
- `sort_published_at timestamptz` — необязательно, для сортировки ленты;
- `moderation_comment text` — необязательно;
- `created_at timestamptz default now()` — обязательно;
- `updated_at timestamptz default now()` — обязательно.

Связи:

- принадлежит организации;
- автор должен быть активным представителем организации;
- регулярное расписание хранится в `publication_schedules`;
- сообщения о неточности связаны через `inaccuracy_reports`.

Статусы:

- `draft` — виден только представителям организации и администратору;
- `scheduled` — запланирован;
- `moderation` — ждёт проверки;
- `published` — публично доступен, если актуален;
- `cancelled` — публично доступен с понятной отметкой, пока актуален;
- `completed` — скрыт из основной ленты;
- `hidden` — скрыт администратором;
- `blocked` — заблокирован администратором.

Индексы:

- unique по `slug`;
- индекс по `(status, sort_published_at desc)`;
- индекс по `(organization_id, status)`;
- индекс по `(type, status)`;
- индекс по `starts_at`;
- индекс по `valid_until`;
- индекс по `author_id`.

Удаление:

- представитель может физически удалить только свой `draft`;
- опубликованные, отменённые, скрытые и заблокированные публикации не удаляются физически в MVP;
- организация не удаляется, если есть опубликованные публикации.

### publication_schedules

Назначение: расписание регулярных занятий без усложнения основной таблицы публикаций.

Поля:

- `id uuid primary key` — обязательно;
- `publication_id uuid references publications(id) on delete cascade` — обязательно;
- `schedule_text text` — обязательно;
- `weekday smallint` — необязательно, 1-7;
- `starts_at time` — необязательно;
- `ends_at time` — необязательно;
- `sort_order integer default 0` — обязательно;
- `created_at timestamptz default now()` — обязательно;
- `updated_at timestamptz default now()` — обязательно.

Связи:

- принадлежит публикации типа `regular`.

Статусы:

- отдельных статусов нет, наследует доступность публикации.

Индексы:

- индекс по `(publication_id, sort_order)`.

Удаление:

- удаляется каскадно при удалении черновика публикации;
- для опубликованной регулярной публикации изменения выполняются через редактирование расписания.

### menu_categories

Назначение: разделы меню или услуг организации.

Поля:

- `id uuid primary key` — обязательно;
- `organization_id uuid references organizations(id) on delete cascade` — обязательно;
- `name text` — обязательно;
- `description text` — необязательно;
- `sort_order integer default 0` — обязательно;
- `is_active boolean default true` — обязательно;
- `created_at timestamptz default now()` — обязательно;
- `updated_at timestamptz default now()` — обязательно.

Связи:

- принадлежит организации;
- содержит `menu_items`.

Статусы:

- активность задаётся `is_active`.

Индексы:

- индекс по `(organization_id, is_active, sort_order)`.

Удаление:

- представитель может удалить категорию своей организации, если это не ломает опубликованные данные;
- при удалении категории позиции удаляются каскадно или предварительно переносятся администратором/представителем.

### menu_items

Назначение: позиция меню или услуга организации.

Поля:

- `id uuid primary key` — обязательно;
- `organization_id uuid references organizations(id) on delete cascade` — обязательно;
- `category_id uuid references menu_categories(id) on delete set null` — необязательно;
- `title text` — обязательно;
- `description text` — необязательно;
- `price_text text` — необязательно;
- `image_path text` — необязательно;
- `is_available boolean default true` — обязательно;
- `sort_order integer default 0` — обязательно;
- `created_at timestamptz default now()` — обязательно;
- `updated_at timestamptz default now()` — обязательно.

Связи:

- принадлежит организации;
- может принадлежать категории меню.

Статусы:

- доступность задаётся `is_available`.

Индексы:

- индекс по `(organization_id, is_available, sort_order)`;
- индекс по `category_id`.

Удаление:

- представитель может удалить позицию своей организации;
- для временного скрытия использовать `is_available = false`.

### important_announcements

Назначение: компактное важное объявление, закрепляемое над лентой.

Поля:

- `id uuid primary key` — обязательно;
- `status important_announcement_status default 'draft'` — обязательно;
- `title text` — обязательно;
- `description text` — обязательно;
- `publication_id uuid references publications(id) on delete set null` — необязательно;
- `active_from timestamptz` — обязательно для `active`;
- `active_until timestamptz` — обязательно для `active`;
- `created_by uuid references auth.users(id)` — обязательно;
- `created_at timestamptz default now()` — обязательно;
- `updated_at timestamptz default now()` — обязательно.

Связи:

- может вести на связанную публикацию;
- создаётся администратором.

Статусы:

- `draft` — черновик;
- `active` — публично показывается в периоде;
- `expired` — срок закончился;
- `hidden` — снято администратором.

Индексы:

- индекс по `(status, active_from, active_until)`;
- индекс по `publication_id`.

Удаление:

- физическое удаление только для черновиков;
- активные и завершённые объявления переводятся в `expired` или `hidden`.

### inaccuracy_reports

Назначение: сообщение пользователя о неточности в публикации.

Поля:

- `id uuid primary key` — обязательно;
- `publication_id uuid references publications(id) on delete cascade` — обязательно;
- `reporter_user_id uuid references auth.users(id)` — необязательно;
- `reporter_fingerprint text` — необязательно для гостя;
- `reason text` — обязательно;
- `comment text` — необязательно;
- `status inaccuracy_report_status default 'new'` — обязательно;
- `admin_comment text` — необязательно;
- `resolved_by uuid references auth.users(id)` — необязательно;
- `resolved_at timestamptz` — необязательно;
- `created_at timestamptz default now()` — обязательно;
- `updated_at timestamptz default now()` — обязательно.

Связи:

- относится к публикации;
- может быть связана с авторизованным пользователем, но MVP допускает гостя.

Статусы:

- `new` — новое сообщение;
- `reviewing` — администратор смотрит;
- `resolved` — обработано;
- `rejected` — не подтвердилось.

Индексы:

- индекс по `(publication_id, status)`;
- индекс по `(status, created_at)`;
- частичный unique для защиты от повторной жалобы: `(publication_id, reporter_user_id, reason)` where `reporter_user_id is not null`;
- индекс по `(publication_id, reporter_fingerprint, reason)` для гостей.

Удаление:

- сообщения не удаляются пользователем после отправки;
- одна жалоба не меняет статус публикации автоматически.

### analytics_events

Назначение: простая статистика MVP без сложной аналитической системы.

Поля:

- `id uuid primary key` — обязательно;
- `event_name text` — обязательно;
- `organization_id uuid references organizations(id) on delete cascade` — необязательно;
- `publication_id uuid references publications(id) on delete cascade` — необязательно;
- `menu_item_id uuid references menu_items(id) on delete set null` — необязательно;
- `user_id uuid references auth.users(id)` — необязательно;
- `anonymous_id text` — необязательно;
- `metadata jsonb default '{}'` — необязательно;
- `created_at timestamptz default now()` — обязательно.

Допустимые события MVP:

- `organization_view`;
- `publication_view`;
- `phone_click`;
- `route_click`;
- `menu_open`;
- `favorite_add`.

Связи:

- событие может относиться к организации, публикации или позиции меню.

Статусы:

- статусов нет.

Индексы:

- индекс по `(organization_id, created_at)`;
- индекс по `(publication_id, created_at)`;
- индекс по `(event_name, created_at)`;
- индекс по `created_at`.

Удаление:

- при удалении черновых сущностей события можно удалить каскадно;
- для публичных сущностей в MVP допустимо агрегировать по существующим данным без отдельного архива.

### storage.objects

Назначение: системная таблица Supabase Storage для файлов организаций, публикаций и меню. Отдельную прикладную таблицу изображений в MVP не создавать.

Поля, которые важны для проектирования:

- `bucket_id text` — обязательно, bucket файла;
- `name text` — обязательно, путь файла внутри bucket;
- `owner uuid` — необязательно, пользователь-владелец файла;
- `metadata jsonb` — необязательно, метаданные файла;
- `created_at timestamptz` — системное поле;
- `updated_at timestamptz` — системное поле.

Связи:

- `organizations.logo_path` и `organizations.cover_path` хранят путь объекта;
- `publications.image_path` хранит путь объекта;
- `menu_items.image_path` хранит путь объекта.

Статусы:

- отдельных статусов нет;
- публичность определяется bucket policy и статусами связанных записей в прикладных таблицах.

Индексы:

- используются системные индексы Supabase Storage;
- дополнительные индексы в MVP не нужны.

Удаление:

- физическое удаление файла выполняется только серверной операцией после проверки прав;
- при удалении черновиков можно удалять неиспользуемые файлы;
- файлы опубликованных записей лучше сначала отвязать или заменить, чтобы не ломать публичные страницы.

## 4. RLS-политики

### Общие helper-проверки

В миграциях стоит добавить SQL-функции:

- `is_admin()` — true, если `profiles.id = auth.uid()` и `role = 'admin'`;
- `is_org_member(org_id uuid)` — true, если пользователь активный участник организации;
- `is_org_owner(org_id uuid)` — true, если пользователь активный owner организации.

Функции должны быть `security definer`, аккуратно ограничены `search_path` и использоваться только для проверок доступа.

### Публичный доступ

Anon и authenticated могут читать:

- `organization_categories` where `is_active = true`;
- `organizations` where `status = 'active'`;
- `publications` where organization active and status in `published`, `cancelled` and актуальность не истекла;
- `publication_schedules` только для публично доступных публикаций;
- `menu_categories` active только для active organizations;
- `menu_items` available только для active organizations;
- `important_announcements` where `status = 'active'` and now() between `active_from` and `active_until`.

Публичный пользователь может создать `inaccuracy_reports`, если запись проходит антидубль и rate limit на уровне Route Handler.

### Представитель организации

Представитель может читать:

- свои `organization_applications`;
- организации, где он активный member;
- members своей организации;
- все публикации, меню и статистику своей организации.

Представитель может создавать и обновлять:

- заявку, где `applicant_id = auth.uid()`;
- данные организации только при `is_org_member(id)`;
- публикации только с `organization_id`, где он активный member;
- меню только внутри своей организации.

`WITH CHECK` для публикаций:

- `organization_id` должен принадлежать организации текущего пользователя;
- `author_id` должен равняться `auth.uid()`;
- запрещены прямые значения `hidden`, `blocked`;
- переходы в `published` допускаются только через серверную операцию, которая проверяет полноту данных и статус организации.

### Администратор

Администратор может:

- читать все строки MVP-таблиц;
- менять статусы заявок, организаций, публикаций, жалоб и важных объявлений;
- создавать важные объявления;
- блокировать и восстанавливать организации и публикации.

Админские операции всё равно выполняются серверными действиями, чтобы фиксировать `reviewed_by`, `resolved_by`, комментарии и timestamps.

## 5. Защита от подмены

`organization_id`:

- в RLS `WITH CHECK` всегда проверять `is_org_member(organization_id)`;
- в Server Actions не принимать произвольную организацию без повторной проверки membership;
- для меню проверять совпадение `menu_items.organization_id` с `menu_categories.organization_id`.

`author_id`:

- выставлять на сервере как `auth.uid()`;
- в RLS требовать `author_id = auth.uid()` при insert;
- при update запрещать менять `author_id`.

Статусы:

- представители работают с обычными статусами `draft`, `scheduled`, `moderation`, `published`, `cancelled`, `completed`;
- `hidden` и `blocked` доступны только администратору;
- `approved`, `rejected`, `needs_changes` у заявок выставляет только администратор.

## 6. Жизненные циклы

### Заявка организации

1. Пользователь создаёт `organization_applications` в `draft`.
2. При отправке обязательные поля проверяются сервером, статус становится `submitted`.
3. Администратор проверяет данные.
4. При `needs_changes` пользователь видит комментарий и может исправить заявку.
5. При `approved` создаётся или активируется `organizations`, создаётся `organization_members` с ролью `owner`.
6. При `rejected` заявка остаётся в истории.

### Одобрение организации

1. Администратор проверяет заявку.
2. Серверная операция создаёт организацию со статусом `active` или переводит существующую из `pending` в `active`.
3. Создаётся активный owner-member.
4. Организация становится доступна в публичном каталоге.

### Создание публикации

1. Представитель выбирает свою организацию.
2. Сервер проверяет membership.
3. Черновик создаётся со статусом `draft`, `author_id = auth.uid()`.
4. При сохранении валидируются поля для выбранного типа.
5. При публикации сервер проверяет полноту данных, статус организации и допустимый переход статуса.

### Публикация

1. `draft` может стать `scheduled`, `moderation` или `published`.
2. Для подтверждённых организаций обычная публикация может сразу стать `published`, если правила модерации не требуют проверки.
3. `scheduled` становится публичной после наступления `published_at` или `starts_at`, если так задано бизнес-правилом этапа реализации.
4. Публичные выборки показывают только актуальные записи.

### Отмена

1. Представитель своей организации или администратор переводит публикацию в `cancelled`.
2. Записывается `cancelled_at`.
3. Публикация остаётся видимой с понятным статусом, пока это полезно пользователю.
4. Отмена не удаляет публикацию и не скрывает её как нарушение.

### Автоматическое завершение

1. Scheduled job или RPC находит публикации с истёкшим `ends_at` или `valid_until`.
2. Статус переводится в `completed`.
3. Публичная лента также фильтрует истёкшие публикации по времени, чтобы не зависеть только от job.
4. Завершённые публикации сохраняются в истории организации.

### Сообщение о неточности

1. Пользователь открывает дополнительное меню публикации.
2. Отправляет причину и необязательный комментарий.
3. Сервер применяет rate limit и проверку дублей.
4. Создаётся `inaccuracy_reports` со статусом `new`.
5. Публикация не скрывается автоматически.
6. Администратор переводит сообщение в `reviewing`, затем `resolved` или `rejected`.
