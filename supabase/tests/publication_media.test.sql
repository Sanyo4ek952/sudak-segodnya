begin;

select plan(14);

select has_table('public', 'publication_media', 'publication_media exists');
select has_table('public', 'content_candidate_media', 'content_candidate_media exists');
select has_column('public', 'publication_media', 'sort_order', 'publication media is ordered');
select has_column('public', 'publication_media', 'embed_url', 'publication media stores a validated embed URL');
select has_column('public', 'publication_media', 'source_candidate_media_id', 'candidate materialization is idempotent');
select has_column('public', 'content_candidate_media', 'included', 'candidate media can be excluded');
select has_column('public', 'content_candidate_media', 'status', 'candidate media preparation status exists');
select col_type_is('public', 'publication_media', 'kind', 'public.publication_media_kind', 'publication media uses a constrained kind');
select col_type_is('public', 'content_candidate_media', 'status', 'public.content_candidate_media_status', 'candidate status uses an enum');
select has_function('public', 'append_publication_media', array[
  'uuid', 'uuid', 'public.publication_media_kind', 'text', 'text', 'text',
  'text', 'text', 'integer', 'integer', 'integer', 'uuid'
], 'protected append RPC exists');
select has_function('public', 'reorder_publication_media', array['uuid', 'uuid[]'], 'protected reorder RPC exists');
select has_function('public', 'remove_publication_media', array['uuid'], 'protected remove RPC exists');
select policies_are('public', 'publication_media', array[
  'Public can read media for public publications'
], 'publication media has the expected public RLS policy');
select policies_are('public', 'content_candidate_media', array[
  'Admins can manage candidate media'
], 'candidate media is admin-only');

select * from finish();
rollback;
