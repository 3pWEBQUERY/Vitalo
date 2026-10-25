-- Accounts that start on one iPhone without an Apple ID. The app keeps a random secret in the
-- Keychain; only its hash is stored. Signing in with Apple later links the same account.
alter table users add column if not exists device_secret_hash text unique;
create index if not exists foods_catalog_idx on foods (updated_at) where source_ref is not null or source = 'editorial';
