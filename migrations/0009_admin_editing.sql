-- Foods created by the editorial team, and descriptions for challenges run by Vitalo.
alter table foods drop constraint if exists foods_source_check;
alter table foods add constraint foods_source_check check (source in ('off', 'usda', 'blv', 'user', 'partner', 'editorial'));
alter table challenges add column if not exists description text;
create index if not exists foods_updated_idx on foods (updated_at desc);
create index if not exists posts_created_idx on posts (created_at desc);
