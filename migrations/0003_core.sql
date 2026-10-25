-- Core schema from PRD chapter 16. Every user table carries updated_at and deleted_at
-- so the sync can transfer changes and deletions.

create extension if not exists pg_trgm;

-- MARK: Accounts

create table users (
  id uuid primary key default gen_random_uuid(),
  apple_sub text unique,
  email text,
  plan text not null default 'free' check (plan in ('free', 'plus')),
  plan_expires_at timestamptz,
  locked_at timestamptz,
  lock_reason text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table profiles (
  user_id uuid primary key references users(id) on delete cascade,
  display_name text,
  birth_year smallint check (birth_year between 1900 and 2100),
  sex_for_calc text check (sex_for_calc in ('female', 'male')),
  body_type text not null default 'neutral' check (body_type in ('female', 'male', 'neutral')),
  height_cm numeric(5,1) check (height_cm between 100 and 250),
  activity_level text,
  diet_type text,
  allergens text[] not null default '{}',
  units text not null default 'metric',
  locale text not null default 'de-CH',
  protection_mode boolean not null default false,
  settings jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table goals (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('lose', 'maintain', 'gain', 'muscle', 'custom')),
  target_weight_kg numeric(5,2),
  target_date date,
  pace text,
  kcal_target integer not null check (kcal_target > 0),
  protein_g integer,
  carbs_g integer,
  fat_g integer,
  water_ml integer,
  valid_from date not null,
  created_at timestamptz not null default now()
);
create index goals_user_valid_idx on goals (user_id, valid_from desc);

create table device_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  refresh_hash text not null unique,
  device_name text,
  app_version text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index device_sessions_user_idx on device_sessions (user_id);

create table consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('healthData', 'aiProcessing', 'appleHealth', 'notifications', 'community', 'healthSync')),
  granted boolean not null,
  version text not null,
  text_hash text,
  created_at timestamptz not null default now()
);
create index consents_user_kind_idx on consents (user_id, kind, created_at desc);

-- MARK: Diary

alter table foods add column if not exists created_by uuid references users(id) on delete set null;
alter table foods add column if not exists is_private boolean not null default false;
alter table foods add column if not exists servings jsonb not null default '[]';
alter table foods add column if not exists nutrients jsonb not null default '{}';
alter table foods add column if not exists confirmations integer not null default 0;
alter table foods add column if not exists reports integer not null default 0;
alter table foods add column if not exists search tsvector generated always as (
  to_tsvector('german', coalesce(name, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(names->>'de', '') || ' ' || coalesce(names->>'fr', '') || ' ' || coalesce(names->>'it', ''))
) stored;
create index if not exists foods_search_idx on foods using gin (search);
create index if not exists foods_name_trgm_idx on foods using gin (name gin_trgm_ops);

create table food_confirmations (
  food_id uuid not null references foods(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  kcal_100 numeric(7,2) not null,
  protein_100 numeric(6,2),
  carbs_100 numeric(6,2),
  fat_100 numeric(6,2),
  created_at timestamptz not null default now(),
  primary key (food_id, user_id)
);

create table food_revisions (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references foods(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  admin_id uuid,
  changes jsonb not null,
  previous jsonb,
  status text not null default 'pending' check (status in ('pending', 'applied', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index food_revisions_food_idx on food_revisions (food_id, created_at desc);

create table meal_entries (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  entry_date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  status text not null default 'logged' check (status in ('logged', 'planned')),
  food_id uuid references foods(id) on delete set null,
  name_snapshot text not null,
  quantity_g numeric(8,2) not null check (quantity_g >= 0),
  serving_unit text,
  serving_count numeric(6,2),
  kcal numeric(7,1) not null check (kcal >= 0),
  protein_g numeric(6,1),
  carbs_g numeric(6,1),
  fat_g numeric(6,1),
  fiber_g numeric(6,1),
  sugar_g numeric(6,1),
  salt_g numeric(6,2),
  category text,
  source text not null check (source in ('manual', 'barcode', 'photo_ai', 'text_ai', 'label', 'recipe', 'copy', 'quick')),
  ai_confidence numeric(3,2) check (ai_confidence between 0 and 1),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index meal_entries_user_date_idx on meal_entries (user_id, entry_date) where deleted_at is null;
create index meal_entries_user_updated_idx on meal_entries (user_id, updated_at);

create table water_entries (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  entry_date date not null,
  logged_at timestamptz not null,
  ml integer not null check (ml > 0),
  drink_type text not null default 'water',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index water_entries_user_date_idx on water_entries (user_id, entry_date) where deleted_at is null;
create index water_entries_user_updated_idx on water_entries (user_id, updated_at);

create table weight_entries (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  measured_at timestamptz not null,
  weight_kg numeric(5,2) not null check (weight_kg between 20 and 500),
  body_fat_pct numeric(4,1) check (body_fat_pct between 2 and 70),
  lean_mass_kg numeric(5,2),
  waist_cm numeric(5,1),
  hip_cm numeric(5,1),
  source text not null default 'manual' check (source in ('manual', 'healthkit', 'scale')),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index weight_entries_user_time_idx on weight_entries (user_id, measured_at) where deleted_at is null;
create index weight_entries_user_updated_idx on weight_entries (user_id, updated_at);

create table check_ins (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  entry_date date not null,
  hunger smallint check (hunger between 0 and 5),
  satiety smallint check (satiety between 0 and 5),
  mood smallint check (mood between 0 and 5),
  energy smallint check (energy between 0 and 5),
  sleep smallint check (sleep between 0 and 5),
  evening_hunger smallint check (evening_hunger between 0 and 5),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index check_ins_user_date_idx on check_ins (user_id, entry_date) where deleted_at is null;
create index check_ins_user_updated_idx on check_ins (user_id, updated_at);

-- MARK: AI, coach, operations

create table ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  kind text not null check (kind in ('photo', 'text', 'label', 'coach', 'moderation')),
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cost_usd numeric(10,6) not null default 0,
  duration_ms integer not null default 0,
  status text not null check (status in ('ok', 'error', 'rejected', 'timeout')),
  error text,
  created_at timestamptz not null default now()
);
create index ai_requests_user_day_idx on ai_requests (user_id, created_at);
create index ai_requests_created_idx on ai_requests (created_at);

create table coach_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  signal text not null,
  payload jsonb not null,
  computed_at timestamptz not null default now()
);
create index coach_signals_user_idx on coach_signals (user_id, computed_at desc);

create table coach_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  signal_id uuid references coach_signals(id) on delete set null,
  signal text not null,
  title text not null,
  body text not null,
  options jsonb not null default '[]',
  basis text not null,
  status text not null default 'open' check (status in ('open', 'accepted', 'dismissed', 'expired')),
  chosen_option text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index coach_suggestions_user_idx on coach_suggestions (user_id, created_at desc);

create table push_tokens (
  token text primary key,
  user_id uuid not null references users(id) on delete cascade,
  environment text not null default 'production' check (environment in ('production', 'sandbox')),
  locale text,
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on push_tokens (user_id);

create table subscriptions (
  user_id uuid primary key references users(id) on delete cascade,
  product_id text not null,
  original_transaction_id text not null unique,
  status text not null check (status in ('active', 'grace', 'expired', 'revoked', 'refunded')),
  expires_at timestamptz,
  environment text not null,
  updated_at timestamptz not null default now()
);

create table app_store_events (
  id uuid primary key default gen_random_uuid(),
  notification_uuid text unique,
  notification_type text not null,
  subtype text,
  original_transaction_id text,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

-- MARK: Community

create table community_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_.]{3,24}$'),
  bio text check (char_length(bio) <= 160),
  avatar_media_id uuid references media(id) on delete set null,
  visibility text not null default 'followers' check (visibility in ('private', 'followers', 'public')),
  goal_tags text[] not null default '{}',
  discoverable boolean not null default false,
  region text,
  age_confirmed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table community_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 60),
  description text,
  rules text,
  visibility text not null default 'public' check (visibility in ('public', 'private', 'invite')),
  owner_id uuid not null references users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended', 'removed')),
  created_at timestamptz not null default now()
);

create table group_members (
  group_id uuid not null references community_groups(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'moderator', 'member')),
  status text not null default 'active' check (status in ('active', 'invited', 'requested')),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  group_id uuid references community_groups(id) on delete cascade,
  kind text not null check (kind in ('text', 'photo', 'meal', 'progress', 'milestone', 'recipe')),
  body text check (char_length(body) <= 2000),
  attachment jsonb,
  visibility text not null default 'followers' check (visibility in ('followers', 'public', 'group')),
  status text not null default 'pending' check (status in ('pending', 'published', 'held', 'removed')),
  moderation jsonb,
  reaction_count integer not null default 0,
  comment_count integer not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index posts_feed_idx on posts (created_at desc, id desc) where status = 'published' and deleted_at is null;
create index posts_user_idx on posts (user_id, created_at desc);
create index posts_group_idx on posts (group_id, created_at desc);

create table post_media (
  post_id uuid not null references posts(id) on delete cascade,
  media_id uuid not null references media(id) on delete cascade,
  position smallint not null default 0,
  primary key (post_id, media_id)
);

create table reactions (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('heart', 'clap', 'strong')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  parent_id uuid references comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  status text not null default 'published' check (status in ('published', 'held', 'removed')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index comments_post_idx on comments (post_id, created_at);

create table follows (
  follower_id uuid not null references users(id) on delete cascade,
  followee_id uuid not null references users(id) on delete cascade,
  status text not null default 'accepted' check (status in ('accepted', 'pending')),
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on follows (followee_id);

create table blocks (
  blocker_id uuid not null references users(id) on delete cascade,
  blocked_id uuid not null references users(id) on delete cascade,
  kind text not null default 'block' check (kind in ('block', 'mute')),
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table challenges (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references community_groups(id) on delete cascade,
  kind text not null check (kind in ('veggies', 'water', 'protein', 'breakfast', 'steps', 'custom')),
  title text not null,
  target_days integer not null check (target_days between 1 and 90),
  starts_on date not null,
  ends_on date not null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table challenge_progress (
  challenge_id uuid not null references challenges(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  day date not null,
  primary key (challenge_id, user_id, day)
);

-- MARK: Moderation

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references users(id) on delete set null,
  target_type text not null check (target_type in ('post', 'comment', 'user', 'group', 'food')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'harassment', 'eating_disorder', 'body_shaming', 'extreme_diet', 'advertising', 'wrong_values', 'inappropriate', 'other')),
  details text,
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index reports_open_idx on reports (status, created_at);
create index reports_target_idx on reports (target_type, target_id);

create table user_sanctions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('warning', 'suspension', 'ban')),
  reason text not null,
  until timestamptz,
  admin_id uuid,
  created_at timestamptz not null default now()
);

create table appeals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  sanction_id uuid references user_sanctions(id) on delete cascade,
  body text not null,
  status text not null default 'open' check (status in ('open', 'granted', 'denied')),
  decided_by uuid,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

-- MARK: Admin

create table admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  password_hash text not null,
  totp_secret text,
  totp_enabled boolean not null default false,
  role text not null check (role in ('admin', 'moderator', 'editor', 'support')),
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  disabled_at timestamptz
);

create table admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references admin_users(id) on delete cascade,
  token_hash text not null unique,
  ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid references admin_users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on audit_log (created_at desc);

create table feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text not null default '',
  updated_at timestamptz not null default now()
);

create table app_settings (
  key text primary key,
  value jsonb not null,
  description text not null default '',
  updated_at timestamptz not null default now()
);

insert into app_settings (key, value, description) values
  ('min_app_version', '"1.0"', 'Older app versions are asked to update.'),
  ('ai_free_daily_quota', '3', 'AI analyses per day on the free plan.'),
  ('ai_plus_daily_quota', '60', 'Fair-use AI analyses per day on Vitalo Plus.'),
  ('ai_kill_switch', 'false', 'When true, AI endpoints return 503 and the app falls back to manual logging.'),
  ('kcal_minimum_female', '1200', 'Calorie floor for female and neutral calculation.'),
  ('kcal_minimum_male', '1500', 'Calorie floor for male calculation.'),
  ('max_weekly_loss_pct', '1.0', 'Weekly loss above this share of body weight triggers a calm note.')
on conflict (key) do nothing;

insert into feature_flags (key, enabled, description) values
  ('community', true, 'Community tab, posting and groups.'),
  ('ai_photo', true, 'Photo recognition with Claude.'),
  ('ai_text', true, 'Natural-language logging with Claude.'),
  ('coach', true, 'Adaptive coach suggestions.'),
  ('coach_ai_wording', false, 'Let Claude phrase coach suggestions (numbers are always validated).')
on conflict (key) do nothing;
