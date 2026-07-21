begin;

set search_path = public, extensions;

select plan(24);

create or replace function pg_temp.statement_raises(statement text)
returns boolean
language plpgsql
as $$
begin
  execute statement;
  return false;
exception when others then
  return true;
end;
$$;

delete from public.inaccuracy_reports where reporter_fingerprint like 'seed-%';
delete from public.important_announcements where created_by = '00000000-0000-0000-0000-000000000101';
delete from public.publication_schedules
where publication_id in (
  select id from public.publications where author_id = '00000000-0000-0000-0000-000000000101'
);
delete from public.publications where author_id = '00000000-0000-0000-0000-000000000101';
delete from public.menu_items where organization_id::text like '21000000-%';
delete from public.menu_categories where organization_id::text like '21000000-%';
delete from public.organization_members where organization_id::text like '21000000-%';
delete from public.organizations where id::text like '21000000-%';

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000011', 'content-rep@example.test'),
  ('00000000-0000-0000-0000-000000000012', 'content-other@example.test'),
  ('00000000-0000-0000-0000-000000000013', 'content-admin@example.test')
on conflict (id) do nothing;

insert into public.profiles (id, role, display_name)
values
  ('00000000-0000-0000-0000-000000000011', 'user', 'Content Rep'),
  ('00000000-0000-0000-0000-000000000012', 'user', 'Other Rep'),
  ('00000000-0000-0000-0000-000000000013', 'admin', 'Content Admin')
on conflict (id) do update
set role = excluded.role,
    display_name = excluded.display_name;

insert into public.organization_categories (id, slug, name, sort_order)
values ('30000000-0000-0000-0000-000000000008', 'services', 'Services', 80)
on conflict (slug) do update
set name = excluded.name,
    is_active = true;

insert into public.organizations (id, slug, name, description, status, category_id, created_by)
values
  ('11000000-0000-0000-0000-000000000001', 'content-active-org', 'Content Active Org', 'Description', 'active', '30000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000013'),
  ('11000000-0000-0000-0000-000000000002', 'content-blocked-org', 'Content Blocked Org', 'Description', 'blocked', '30000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000013'),
  ('11000000-0000-0000-0000-000000000003', 'content-member-org', 'Content Member Org', 'Description', 'pending', '30000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000013');

insert into public.organization_members (organization_id, user_id, role)
values ('11000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000011', 'manager');

insert into public.publications (
  id,
  organization_id,
  author_id,
  slug,
  type,
  status,
  title,
  description,
  category_slug,
  starts_at,
  ends_at,
  valid_until,
  published_at,
  price_text,
  sort_published_at
)
values
  ('12000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000013', 'visible-event', 'event', 'published', 'Visible Event', 'Description', 'culture', now() + interval '1 hour', now() + interval '3 hours', null, now(), 'Бесплатно', now()),
  ('12000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000013', 'expired-event', 'event', 'published', 'Expired Event', 'Description', 'culture', now() - interval '3 hours', now() - interval '1 hour', null, now() - interval '1 day', 'Бесплатно', now() - interval '1 day'),
  ('12000000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000013', 'hidden-event', 'event', 'hidden', 'Hidden Event', 'Description', 'culture', now() + interval '1 hour', now() + interval '3 hours', null, now(), 'Бесплатно', now()),
  ('12000000-0000-0000-0000-000000000004', '11000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000013', 'blocked-org-event', 'event', 'published', 'Blocked Org Event', 'Description', 'culture', now() + interval '1 hour', now() + interval '3 hours', null, now(), 'Бесплатно', now()),
  ('12000000-0000-0000-0000-000000000005', '11000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000011', 'member-draft', 'news', 'draft', 'Member Draft', null, 'services', null, null, null, null, null, null);

insert into public.publication_schedules (publication_id, schedule_text, sort_order)
values
  ('12000000-0000-0000-0000-000000000001', 'Каждую субботу в 12:00', 10),
  ('12000000-0000-0000-0000-000000000003', 'Скрытое расписание', 10);

insert into public.menu_categories (id, organization_id, name, sort_order, is_active)
values
  ('13000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'Active Menu', 10, true),
  ('13000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000001', 'Inactive Menu', 20, false),
  ('13000000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000003', 'Member Menu', 10, true);

insert into public.menu_items (id, organization_id, category_id, title, price_text, is_available, sort_order)
values
  ('14000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', 'Visible Item', '100 ₽', true, 10),
  ('14000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', 'Unavailable Item', '100 ₽', false, 20);

insert into public.important_announcements (id, status, title, description, active_from, active_until, created_by)
values
  ('15000000-0000-0000-0000-000000000001', 'active', 'Active Announcement', 'Description', now() - interval '1 hour', now() + interval '1 day', '00000000-0000-0000-0000-000000000013'),
  ('15000000-0000-0000-0000-000000000002', 'draft', 'Draft Announcement', 'Description', null, null, '00000000-0000-0000-0000-000000000013');

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

select is(
  (select array_agg(slug order by slug) from public.publications),
  array['visible-event'::text],
  'anon reads only active and current public publications'
);

select is(
  (select count(*) from public.publication_schedules),
  1::bigint,
  'anon reads schedules only for public publications'
);

select is(
  (select array_agg(name order by name) from public.menu_categories),
  array['Active Menu'::text],
  'anon reads active menu categories only for active organizations'
);

select is(
  (select array_agg(title order by title) from public.menu_items),
  array['Visible Item'::text],
  'anon reads available menu items only'
);

select is(
  (select array_agg(title order by title) from public.important_announcements),
  array['Active Announcement'::text],
  'anon reads only active important announcements in period'
);

select ok(
  not pg_temp.statement_raises(
    $$ insert into public.inaccuracy_reports (publication_id, reporter_fingerprint, reason)
       values ('12000000-0000-0000-0000-000000000001', 'guest-one', 'wrong_time') $$
  ),
  'anon can report an inaccuracy for a public publication'
);

select ok(
  pg_temp.statement_raises(
    $$ insert into public.inaccuracy_reports (publication_id, reporter_fingerprint, reason)
       values ('12000000-0000-0000-0000-000000000003', 'guest-one', 'wrong_time') $$
  ),
  'anon cannot report a hidden publication'
);

select ok(
  not pg_temp.statement_raises(
    $$ select public.create_inaccuracy_report(
         '12000000-0000-0000-0000-000000000001',
         'wrong_price',
         'Wrong price comment',
         'guest-rpc-one'
       ) $$
  ),
  'anon can report an inaccuracy through rpc'
);

select ok(
  pg_temp.statement_raises(
    $$ select public.create_inaccuracy_report(
         '12000000-0000-0000-0000-000000000001',
         'wrong_price',
         'Duplicate comment',
         'guest-rpc-one'
       ) $$
  ),
  'rpc limits duplicate reports for same publication and reason'
);

select ok(
  pg_temp.statement_raises(
    $$ select public.create_inaccuracy_report(
         '12000000-0000-0000-0000-000000000003',
         'wrong_price',
         'Hidden publication comment',
         'guest-rpc-hidden'
       ) $$
  ),
  'rpc rejects reports for hidden publications'
);

select ok(
  not pg_temp.statement_raises(
    $$ insert into public.analytics_events (event_name, publication_id, anonymous_id)
       values ('publication_view', '12000000-0000-0000-0000-000000000001', 'anon-one') $$
  ),
  'anon can write analytics for a public publication'
);

select ok(
  pg_temp.statement_raises(
    $$ insert into public.analytics_events (event_name, publication_id, anonymous_id)
       values ('publication_view', '12000000-0000-0000-0000-000000000003', 'anon-one') $$
  ),
  'anon cannot write analytics for a hidden publication'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  exists (
    select 1
    from public.publications
    where slug = 'member-draft'
  ),
  'representative reads their organization draft publication'
);

select ok(
  not pg_temp.statement_raises(
    $$ insert into public.publications (
         organization_id,
         author_id,
         slug,
         type,
         status,
         title,
         category_slug
       )
       values (
         '11000000-0000-0000-0000-000000000003',
         '00000000-0000-0000-0000-000000000011',
         'new-member-draft',
         'news',
         'draft',
         'New Member Draft',
         'services'
       ) $$
  ),
  'representative can create a draft publication for own organization'
);

select ok(
  pg_temp.statement_raises(
    $$ insert into public.publications (
         organization_id,
         author_id,
         slug,
         type,
         status,
         title,
         category_slug
       )
       values (
         '11000000-0000-0000-0000-000000000001',
         '00000000-0000-0000-0000-000000000011',
         'foreign-org-draft',
         'news',
         'draft',
         'Foreign Org Draft',
         'services'
       ) $$
  ),
  'representative cannot create publication for another organization'
);

select ok(
  pg_temp.statement_raises(
    $$ insert into public.publications (
         organization_id,
         author_id,
         slug,
         type,
         status,
         title,
         category_slug
       )
       values (
         '11000000-0000-0000-0000-000000000003',
         '00000000-0000-0000-0000-000000000011',
         'hidden-member-draft',
         'news',
         'hidden',
         'Hidden Member Draft',
         'services'
       ) $$
  ),
  'representative cannot create hidden publication'
);

select ok(
  pg_temp.statement_raises(
    $$ insert into public.publications (
         organization_id,
         author_id,
         slug,
         type,
         status,
         title,
         description,
         category_slug,
         price_text
       )
       values (
         '11000000-0000-0000-0000-000000000003',
         '00000000-0000-0000-0000-000000000011',
         'direct-published-member',
         'news',
         'published',
         'Direct Published Member',
         'Description',
         'services',
         'Бесплатно'
       ) $$
  ),
  'representative cannot publish directly without server operation'
);

select ok(
  pg_temp.statement_raises(
    $$ update public.publications
       set author_id = '00000000-0000-0000-0000-000000000012'
       where slug = 'member-draft' $$
  ),
  'representative cannot change publication author'
);

select ok(
  not pg_temp.statement_raises(
    $$ insert into public.menu_items (organization_id, category_id, title)
       values ('11000000-0000-0000-0000-000000000003', '13000000-0000-0000-0000-000000000003', 'Member Item') $$
  ),
  'representative can create menu item in own organization'
);

select ok(
  pg_temp.statement_raises(
    $$ insert into public.menu_items (organization_id, category_id, title)
       values ('11000000-0000-0000-0000-000000000003', '13000000-0000-0000-0000-000000000001', 'Wrong Category Item') $$
  ),
  'menu item category must belong to the same organization'
);

select ok(
  pg_temp.statement_raises(
    $$ insert into public.important_announcements (status, title, description, active_from, active_until, created_by)
       values ('active', 'Forged', 'Description', now(), now() + interval '1 day', '00000000-0000-0000-0000-000000000011') $$
  ),
  'representative cannot create important announcements'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000013', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*) from public.publications),
  6::bigint,
  'admin reads all publications'
);

select ok(
  not pg_temp.statement_raises(
    $$ update public.publications
       set status = 'hidden'
       where slug = 'visible-event' $$
  ),
  'admin can hide a publication'
);

select ok(
  not pg_temp.statement_raises(
    $$ update public.inaccuracy_reports
       set status = 'resolved',
           resolved_by = '00000000-0000-0000-0000-000000000013',
           resolved_at = now()
       where reason = 'wrong_time' $$
  ),
  'admin can resolve inaccuracy reports'
);

select * from finish();

rollback;
