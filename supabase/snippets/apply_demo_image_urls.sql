begin;

update public.organizations
set cover_path = case slug
  when 'kafe-u-kiparisa' then 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80'
  when 'dom-kultury-sudak' then 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1200&q=80'
  when 'more-prokat' then 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80'
  when 'akvarel-kids' then 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=80'
  else cover_path
end
where slug in ('kafe-u-kiparisa', 'dom-kultury-sudak', 'more-prokat', 'akvarel-kids');

update public.publications
set image_path = case slug
  when 'vecher-na-naberezhnoy' then 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80'
  when 'zavtraki-do-poludnya' then 'https://images.unsplash.com/photo-1493770348161-369560ae357d?auto=format&fit=crop&w=1200&q=80'
  when 'sap-prokat-utrom' then 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80'
  when 'master-klass-akvarel' then 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=80'
  when 'novaya-vystavka-foto' then 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80'
  else image_path
end
where slug in (
  'vecher-na-naberezhnoy',
  'zavtraki-do-poludnya',
  'sap-prokat-utrom',
  'master-klass-akvarel',
  'novaya-vystavka-foto'
);

commit;
