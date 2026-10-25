-- Brands with their logos, resolved once and cached.
create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_key text not null unique,
  domain text,
  provider_id text,
  icon_url text,
  logo_url text,
  source text not null default 'none' check (source in ('brandfetch', 'manual', 'none')),
  quality_score numeric(4,3),
  is_hidden boolean not null default false,
  fetched_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Shared food database (subset of the PRD core schema), filled from Open Food Facts on demand.
create table if not exists foods (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('off', 'usda', 'blv', 'user', 'partner')),
  source_ref text,
  name text not null,
  names jsonb not null default '{}',
  brand text,
  brand_id uuid references brands(id) on delete set null,
  barcode text,
  image_url text,
  serving_g numeric(7,2),
  kcal_100 numeric(7,2) not null check (kcal_100 >= 0),
  protein_100 numeric(6,2),
  carbs_100 numeric(6,2),
  fat_100 numeric(6,2),
  fiber_100 numeric(6,2),
  sugar_100 numeric(6,2),
  salt_100 numeric(6,3),
  quality text not null default 'community' check (quality in ('verified', 'community', 'unverified', 'suspect')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists foods_barcode_uidx on foods (barcode) where barcode is not null;
create index if not exists foods_brand_idx on foods (brand_id);
