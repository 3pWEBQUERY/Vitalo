-- Uploaded files (brand logos, community photos). Stored in the bucket in production,
-- on local disk in development; this table keeps the metadata.
create table if not exists media (
  id uuid primary key default gen_random_uuid(),
  storage_key text not null unique,
  content_type text not null,
  byte_size integer not null check (byte_size > 0),
  purpose text not null check (purpose in ('brand_icon', 'brand_logo', 'post', 'progress_photo', 'label')),
  owner_user_id uuid,
  created_at timestamptz not null default now()
);

alter table brands add column if not exists custom_icon_id uuid references media(id) on delete set null;
alter table brands add column if not exists custom_logo_id uuid references media(id) on delete set null;

-- Every spelling a brand appears under ("Coca-Cola", "COCA-COLA SERVICES SA/NV") points at one brand.
create table if not exists brand_aliases (
  alias_key text primary key,
  alias text not null,
  brand_id uuid not null references brands(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists brand_aliases_brand_idx on brand_aliases (brand_id);

-- Existing names become aliases of their brand.
insert into brand_aliases (alias_key, alias, brand_id)
select name_key, name, id from brands
on conflict (alias_key) do nothing;

-- Merge brands that resolved to the same provider entry; keep manual ones first, then the oldest.
with ranked as (
  select id, provider_id,
         first_value(id) over (partition by provider_id order by (source = 'manual') desc, fetched_at asc) as keep_id
  from brands where provider_id is not null
)
update brand_aliases a set brand_id = r.keep_id from ranked r where a.brand_id = r.id and r.id <> r.keep_id;

with ranked as (
  select id, first_value(id) over (partition by provider_id order by (source = 'manual') desc, fetched_at asc) as keep_id
  from brands where provider_id is not null
)
update foods f set brand_id = r.keep_id from ranked r where f.brand_id = r.id and r.id <> r.keep_id;

with ranked as (
  select id, first_value(id) over (partition by provider_id order by (source = 'manual') desc, fetched_at asc) as keep_id
  from brands where provider_id is not null
)
delete from brands b using ranked r where b.id = r.id and r.id <> r.keep_id;
