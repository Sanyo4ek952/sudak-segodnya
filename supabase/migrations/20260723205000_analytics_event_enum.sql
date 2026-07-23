-- Enum additions are committed separately before functions start using them.

alter type public.analytics_event_name add value if not exists 'organization_click';
alter type public.analytics_event_name add value if not exists 'share';
alter type public.analytics_event_name add value if not exists 'calendar';

