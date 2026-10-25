-- Admin sign-in: lockout after repeated failures, one-time use of each TOTP code,
-- sliding session expiry (PRD 15.6).
alter table admin_users add column if not exists failed_logins integer not null default 0;
alter table admin_users add column if not exists locked_until timestamptz;
alter table admin_users add column if not exists totp_last_step bigint;
alter table admin_sessions add column if not exists last_seen_at timestamptz not null default now();
create index if not exists admin_sessions_admin_idx on admin_sessions (admin_id);
create index if not exists audit_log_created_idx on audit_log (created_at desc);
create index if not exists audit_log_target_idx on audit_log (target_type, target_id);
create index if not exists ai_requests_created_idx on ai_requests (created_at);
create index if not exists reports_open_idx on reports (status, created_at) where status = 'open';
